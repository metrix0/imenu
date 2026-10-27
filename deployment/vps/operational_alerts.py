#!/usr/bin/env python3
"""Read-only iMenu operational checks and deduplicated ntfy alerts.

Called by the existing five-minute host monitor. Aggregate SQL and cron checks
run no more than once every 15 minutes; no customer data is exported.
"""
import datetime
import json
import os
import pathlib
import subprocess
import time
import urllib.parse
import urllib.request

DEEP_SECONDS = 15 * 60
STATE_NAME = "operational-alert-state.json"
METRICS = {
    "owner_push_missing_event": (3, "eligible orders missing a push dispatch event"),
    "printer_recent_failures": (3, "recent failed print jobs"),
    "wa_webhooks_stuck": (3, "WhatsApp webhooks stalled"),
    "wa_webhooks_failed": (3, "recent failed WhatsApp webhooks"),
    "wa_outbound_failed": (3, "recent failed WhatsApp messages"),
    "billing_webhooks_stuck": (1, "unprocessed billing webhooks"),
    "payout_failed_today": (1, "failed payout automation runs"),
}
# Escalate customer-impacting failures; resource pressure and maintenance
# warnings keep the normal notification title.
CRITICAL_OPERATIONS = {
    "owner_push_missing_event",
    "printer_recent_failures",
    "wa_webhooks_stuck",
    "wa_webhooks_failed",
    "wa_outbound_failed",
    "billing_webhooks_stuck",
    "payout_failed_today",
}
CRITICAL_CONTAINERS = {
    "imenu-production-app",
    "supabase-db",
    "supabase-auth",
    "supabase-envoy",
    "supabase-rest",
    "supabase-storage",
    "imenu-kinghost-waha",
}


def is_critical(key):
    if key == "host:application-health" or key == "host:memory-over-90-percent":
        return True
    if key.startswith("host:container:"):
        return key.removeprefix("host:container:") in CRITICAL_CONTAINERS
    if key.startswith("operation:"):
        return key.removeprefix("operation:") in CRITICAL_OPERATIONS
    return key in {"cron_failed:daily-payout", "cron_failed:reconcile-payouts"}


TIMERS = (
    "addon-expiry-whatsapp", "daily-payout", "ia-vendas-analysis",
    "reconcile-payouts", "storage-cleanup",
)
SQL = """
SELECT json_build_object(
  'owner_push_missing_event', (SELECT count(*) FROM public.orders o
    WHERE o.status::text IN ('pending_physical_payment','paid','preparing','delivering')
      AND o.created_at < now()-interval '10 minutes'
      AND o.created_at > now()-interval '2 hours'
      AND (o.payment_paid_at IS NULL OR o.payment_paid_at < now()-interval '10 minutes')
      AND EXISTS (SELECT 1 FROM public.owner_push_subscriptions s
        WHERE s.restaurant_id=o.restaurant_id AND s.enabled=true
          AND s.created_at <= o.created_at)
      AND NOT EXISTS (SELECT 1 FROM public.owner_push_order_events e WHERE e.order_id=o.id)),
  'owner_push_unretrieved', (SELECT count(*) FROM public.owner_push_notifications n
    JOIN public.owner_push_subscriptions s ON s.id=n.subscription_id
    WHERE n.tag LIKE 'order-%' AND n.delivered_at IS NULL AND s.enabled=true
      AND n.created_at < now()-interval '2 minutes'
      AND n.created_at > now()-interval '1 hour'),
  'printer_recent_failures', (SELECT count(*) FROM public.print_jobs
    WHERE status='failed' AND attempts > 0
      AND last_error IS DISTINCT FROM 'Impressão expirada após 72 horas na fila.'
      AND created_at > now()-interval '1 hour'),
  'wa_webhooks_stuck', (SELECT count(*) FROM public.whatsapp_webhook_events
    WHERE status='processing' AND received_at < now()-interval '15 minutes'
      AND received_at > now()-interval '4 hours'),
  'wa_webhooks_failed', (SELECT count(*) FROM public.whatsapp_webhook_events
    WHERE status='failed' AND received_at > now()-interval '1 hour'),
  'wa_outbound_failed', (SELECT count(*) FROM public.whatsapp_outbound_messages
    WHERE status='failed' AND created_at > now()-interval '1 hour'),
  'billing_webhooks_stuck', (SELECT count(*) FROM public.billing_webhook_events
    WHERE processed_at IS NULL AND received_at < now()-interval '15 minutes'
      AND received_at > now()-interval '4 hours'),
  'payout_failed_today', (SELECT count(*) FROM public.payout_automation_runs
    WHERE status IN ('failed','error') AND created_at > now()-interval '24 hours')
)::text
"""


def read_state(path):
    try:
        data = json.loads(path.read_text())
        if isinstance(data, dict):
            return data
    except (FileNotFoundError, ValueError, OSError):
        pass
    return {}


def aggregate_metrics():
    # The existing local Supabase database; no network/API calls or data changes.
    cmd = ["docker", "exec", "-e", "PGOPTIONS=-c statement_timeout=2500",
           "supabase-db", "psql", "-U", "supabase_admin", "-d", "postgres",
           "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", SQL]
    output = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=8)
    values = json.loads(output.stdout.strip())
    return {key: int(value) for key, value in values.items()}


def scheduled_jobs():
    issues = {}
    for name in TIMERS:
        timer = "imenu-job-" + name + ".timer"
        service = "imenu-job-" + name + ".service"
        active = subprocess.run(["systemctl", "is-active", "--quiet", timer],
                                timeout=2).returncode == 0
        if not active:
            issues["timer_inactive:" + name] = 1
        check = subprocess.run(["systemctl", "show", service, "-p", "Result", "--value"],
                               capture_output=True, text=True, timeout=2)
        if check.returncode == 0 and check.stdout.strip() not in ("", "success"):
            issues["cron_failed:" + name] = 1
    return issues


def ntfy_topic(root):
    # Use the already-configured production topic; never print it or store it in state.
    path = root / "secrets/app-production.env"
    for line in path.read_text().splitlines():
        if line.startswith("NTFY_TOPIC="):
            return line.split("=", 1)[1].strip().strip("\"'")
    raise RuntimeError("Existing NTFY_TOPIC was not found")


def notify(root, title, message):
    topic = ntfy_topic(root)
    if not topic:
        raise RuntimeError("Existing NTFY_TOPIC is empty")
    request = urllib.request.Request(
        "https://ntfy.sh/" + urllib.parse.quote(topic, safe=""),
        data=message.encode("utf-8"),
        headers={"Title": title, "Priority": "4", "Content-Type": "text/plain; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=6) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError("ntfy notification failed")


def inspect(root, host_alerts, dry_run=False):
    state_path = root / "ops" / STATE_NAME
    state = read_state(state_path)
    entries = state.get("entries", {})
    if not isinstance(entries, dict):
        entries = {}
    # Retire obsolete order-notified and queue-delay alarms without fake recoveries.
    entries.pop("operation:orders_unnotified", None)
    # Devices can be offline; stop alerting (or sending recovery notices) for missed fetches.
    entries.pop("operation:owner_push_unretrieved", None)
    for key in list(entries):
        if key == "operation:printer_queue_delayed" or key.startswith("operation:printer_queue_delayed:"):
            entries.pop(key, None)
    now = time.time()
    deep_due = now - float(state.get("last_deep_at", 0)) >= DEEP_SECONDS
    sampled = {"host:" + alert: 1 for alert in host_alerts}
    metrics = state.get("metrics", {})
    for old_metric in ("orders_unnotified", "printer_queue_delayed", "printer_stalled_by_restaurant"):
        metrics.pop(old_metric, None)
    deep_error = None
    if deep_due:
        try:
            metrics = aggregate_metrics()
            for name, (threshold, _) in METRICS.items():
                if metrics.get(name, 0) >= threshold:
                    sampled["operation:" + name] = metrics[name]
            sampled.update(scheduled_jobs())
        except (OSError, ValueError, subprocess.SubprocessError) as error:
            deep_error = type(error).__name__
            sampled["operation:metrics_unavailable"] = 1
        state["last_deep_at"] = now
        state["metrics"] = metrics
    else:
        # Deep samples are only evaluated on their actual 15-minute cadence.
        pass

    keys = set(sampled)
    keys.update(k for k in entries if k.startswith("host:"))
    if deep_due:
        keys.update(k for k in entries if not k.startswith("host:"))
    for key in keys:
        old = entries.get(key, {"streak": 0, "notified": False})
        present = key in sampled
        entries[key] = {
            "streak": int(old.get("streak", 0)) + 1 if present else 0,
            "notified": bool(old.get("notified", False)),
            "value": sampled.get(key, 0),
        }

    new_alarms = [key for key, value in entries.items()
                  if value["streak"] >= 2 and not value["notified"]]
    recovered = [key for key, value in entries.items()
                 if value["streak"] == 0 and value["notified"]]
    notification_error = None
    if not dry_run:
        critical_alarms = [key for key in new_alarms if is_critical(key)]
        normal_alarms = [key for key in new_alarms if not is_critical(key)]
        for title, items, acknowledged, critical in [
            ("TRIGGER ALARM · iMenu: critical alert", critical_alarms, True, True),
            ("iMenu: operational alert", normal_alarms, True, False),
            ("iMenu: recovered", recovered, False, False),
        ]:
            if not items:
                continue
            lines = [key + ((" (" + str(entries[key]["value"]) + ")") if acknowledged else "")
                     for key in sorted(items)]
            message = "\n".join((["TRIGGER ALARM"] if critical else []) + lines)
            try:
                notify(root, title, message)
                for key in items:
                    entries[key]["notified"] = acknowledged
            except (OSError, RuntimeError) as error:
                notification_error = type(error).__name__
                print("IMENU_NTFY_FAILED", notification_error)
        state["entries"] = {key: value for key, value in entries.items()
                            if value["streak"] or value["notified"]}
        state_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = state_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state))
        os.replace(tmp, state_path)

    active = sorted(key for key, value in entries.items() if value["streak"] or value["notified"])
    return {
        "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "deep_checked": bool(deep_due),
        "deep_error": deep_error,
        "ok": not active,
        "alerts": active,
        "metrics": metrics,
        "notification_error": notification_error,
    }


if __name__ == "__main__":
    root = pathlib.Path("/opt/imenu-migration")
    print(json.dumps(inspect(root, [], dry_run=True)))
