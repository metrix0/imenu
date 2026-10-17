#!/usr/bin/env bash
# Restricted SSH commands for the production deployment identity.
set -Eeuo pipefail
request="${SSH_ORIGINAL_COMMAND:-}"
case "$request" in
  public-build-env)
    exec /usr/bin/sudo -n /opt/imenu-migration/ops/deploy-prebuilt-production.sh public-build-env
    ;;
esac
if [[ "$request" =~ ^pull:([0-9a-f]{40}):([0-9a-f]{64})$ ]]; then
  exec /usr/bin/sudo -n /opt/imenu-migration/ops/deploy-prebuilt-production.sh pull "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
elif [[ "$request" =~ ^upload:([0-9a-f]{40})$ ]]; then
  exec /usr/bin/sudo -n /opt/imenu-migration/ops/deploy-prebuilt-production.sh upload "${BASH_REMATCH[1]}"
elif [[ "$request" =~ ^activate:([0-9a-f]{40})$ ]]; then
  exec /usr/bin/sudo -n /opt/imenu-migration/ops/deploy-prebuilt-production.sh activate "${BASH_REMATCH[1]}"
elif [[ "$request" =~ ^retry-prebuilt:([0-9a-f]{40})$ ]]; then
  exec /usr/bin/sudo -n /opt/imenu-migration/ops/deploy-prebuilt-production.sh retry "${BASH_REMATCH[1]}"
elif [[ "$request" =~ ^[0-9a-f]{40}$ || "$request" =~ ^retry:[0-9a-f]{40}$ ]]; then
  exec /usr/bin/sudo -n /opt/imenu-migration/ops/github-production-deploy-hook.sh "$request"
fi
echo "Invalid production deployment request" >&2
exit 2
