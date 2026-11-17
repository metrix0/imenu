import datetime
import importlib.util
import json
import pathlib
import unittest

PATH = pathlib.Path(__file__).resolve().parents[1] / "operational_alerts.py"
spec = importlib.util.spec_from_file_location("operational_alerts", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def response(delivery_id, status, url="https://example.test/api/webhooks/waha"):
    return (f'[12:00] INFO (WebhookSender/8): session:test - POST request was sent with status code: {status} '
            + json.dumps({"session": "test", "id": delivery_id, "url": url}))


class WahaWebhookDeliveryTests(unittest.TestCase):
    def test_repeated_403_at_one_destination_is_failure(self):
        result = module.summarize_webhook_delivery("\n".join([
            response("one", 403), response("two", 403), response("three", 200)
        ]))
        self.assertEqual(result["state"], "failed")
        self.assertEqual(result["http_status"], 403)
        self.assertEqual(result["worst_failures"], 2)
        self.assertNotIn("example.test", str(result))

    def test_retry_success_supersedes_failure(self):
        result = module.summarize_webhook_delivery("\n".join([
            response("one", 403), response("one", 200)
        ]))
        self.assertEqual(result["state"], "connected")
        self.assertEqual(result["failures"], 0)

    def test_one_failure_per_destination_is_not_outage(self):
        result = module.summarize_webhook_delivery("\n".join([
            response("one", 403), response("two", 500, "https://other.example/webhook")
        ]))
        self.assertEqual(result["state"], "degraded")
        self.assertEqual(result["worst_failures"], 1)

    def test_no_response_is_not_healthy(self):
        self.assertEqual(module.summarize_webhook_delivery("")["state"], "unverified")


class WahaAlarmTests(unittest.TestCase):
    def test_client_outdated_is_a_global_alarm_without_http_failure(self):
        alarms = list(module.confirmed_waha_alarms("Client outdated (405) connect failure"))
        self.assertEqual(len(alarms), 1)
        self.assertEqual(alarms[0][3], 405)

    def test_first_official_inbound_failure_is_critical(self):
        timestamp = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=30)).isoformat()
        log = f'{timestamp} (WebhookSender/7): session:imenu-support - POST request was sent with status code: 503 '
        log += json.dumps({"id": "one", "event": "message", "url": "https://www.imenuapp.com.br/api/webhooks/waha"})
        alarms = list(module.confirmed_waha_alarms(log))
        self.assertEqual([alarm[4] for alarm in alarms], ["waha:inbound:imenu-support"])
        self.assertEqual(list(module.confirmed_waha_alarms(log.replace("imenu-support", "imenu-restaurant"))), [])
        self.assertEqual(list(module.confirmed_waha_alarms(log + "\n" + log.replace("503", "200"))), [])


if __name__ == "__main__":
    unittest.main()
