#!/usr/bin/env bash
# Production-only deploy entry point. Retire polling after verified GitHub deployment.
set -Eeuo pipefail
[[ "$#" -eq 1 ]] || exit 2
request="$1"
if [[ "$request" =~ ^[0-9a-f]{40}$ ]]; then
  sha="$request"
  args=("$sha")
elif [[ "$request" =~ ^retry:([0-9a-f]{40})$ ]]; then
  sha="${BASH_REMATCH[1]}"
  args=(--retry "$sha")
else
  echo "Invalid production deployment request" >&2
  exit 2
fi

/usr/bin/bash /opt/imenu-migration/ops/deploy-preview.sh --production "${args[@]}"

state=/opt/imenu-migration/ops/production-deploy-state/deployed-sha
if [[ "$(cat "$state" 2>/dev/null || true)" == "$sha" ]] &&
   [[ "$(docker inspect imenu-production-app --format '{{.State.Health.Status}}' 2>/dev/null || true)" == healthy ]]; then
  if systemctl is-enabled --quiet imenu-production-deploy.timer 2>/dev/null; then
    systemctl disable --now imenu-production-deploy.timer
  fi
  rm -f /etc/systemd/system/imenu-production-deploy.timer /etc/systemd/system/imenu-production-deploy.service
  systemctl daemon-reload
  echo "Production verified healthy; legacy deployment polling removed"
fi
