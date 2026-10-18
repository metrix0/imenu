#!/usr/bin/env bash
# Restricted SSH forced command; no interactive shell, tunnels, or other commands.
set -Eeuo pipefail
request="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$request" == release-* ]]; then
  exec /usr/bin/bash /usr/local/libexec/imenu-release-deploy-ssh preview
fi
if [[ "$request" =~ ^[0-9a-f]{40}$ || "$request" =~ ^retry:[0-9a-f]{40}$ ]]; then
  exec sudo -n /opt/imenu-migration/ops/github-deploy-hook.sh "$request"
fi
echo "Invalid staging deploy request" >&2
exit 2

