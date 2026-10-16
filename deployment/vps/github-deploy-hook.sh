#!/usr/bin/env bash
# Root-owned entry point for the single-purpose GitHub Actions SSH identity.
set -Eeuo pipefail
request="${1:-}"
[[ "$#" -eq 1 ]] || exit 2
if [[ "$request" =~ ^[0-9a-f]{40}$ ]]; then
  exec /usr/bin/bash /opt/imenu-migration/ops/deploy-preview.sh "$request"
elif [[ "$request" =~ ^retry:([0-9a-f]{40})$ ]]; then
  exec /usr/bin/bash /opt/imenu-migration/ops/deploy-preview.sh --retry "${BASH_REMATCH[1]}"
fi
echo "Invalid deploy request" >&2
exit 2
