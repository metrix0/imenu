#!/usr/bin/env bash
set -Eeuo pipefail
export GIT_TERMINAL_PROMPT=0
sha="$(git -c http.version=HTTP/1.1 ls-remote https://github.com/metrix0/imenu.git refs/heads/main | cut -f1)"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Cannot resolve main HEAD" >&2; exit 1; }
exec bash /opt/imenu-migration/ops/deploy-preview.sh --production "$sha"
