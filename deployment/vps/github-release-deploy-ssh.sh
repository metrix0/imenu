#!/usr/bin/env bash
# Environment comes from the root-owned forced-command wrapper, never from SSH input.
set -Eeuo pipefail
[[ $# -eq 1 && "$1" =~ ^(preview|production)$ ]] || exit 2
target="$1"
request="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$request" == release-assets-ready ]]; then
  exec sudo -n /opt/imenu-migration/ops/deploy-prebuilt.sh "$target" assets-ready
elif [[ "$request" == release-build-env ]]; then
  exec sudo -n /opt/imenu-migration/ops/deploy-prebuilt.sh "$target" public-build-env
elif [[ "$request" =~ ^release-pull:([0-9a-f]{40}):([0-9a-f]{64})$ ]]; then
  exec sudo -n /opt/imenu-migration/ops/deploy-prebuilt.sh "$target" pull-release "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
elif [[ "$request" =~ ^release-(activate|retry|verify):([0-9a-f]{40})$ ]]; then
  exec sudo -n /opt/imenu-migration/ops/deploy-prebuilt.sh "$target" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
fi
echo 'Invalid release request' >&2
exit 2
