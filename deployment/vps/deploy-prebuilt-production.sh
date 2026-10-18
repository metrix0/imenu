#!/usr/bin/env bash
# Compatibility entry point for existing production SSH requests.
set -Eeuo pipefail
exec /usr/bin/bash /opt/imenu-migration/ops/deploy-prebuilt.sh production "$@"
