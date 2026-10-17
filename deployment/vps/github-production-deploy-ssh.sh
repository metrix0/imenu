#!/usr/bin/env bash
# Production-only forced SSH command; no shell, tunneling or staging access.
set -Eeuo pipefail
request="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$request" =~ ^[0-9a-f]{40}$ || "$request" =~ ^retry:[0-9a-f]{40}$ ]]; then
  exec /usr/bin/sudo -n /opt/imenu-migration/ops/github-production-deploy-hook.sh "$request"
fi
echo "Invalid production deployment request" >&2
exit 2
