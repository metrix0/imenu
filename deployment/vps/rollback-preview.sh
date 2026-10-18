#!/usr/bin/env bash
# Staging application image rollback only; never restores or changes database data.
set -Eeuo pipefail
umask 077
BASE=/opt/imenu-migration
if [[ -f "$BASE/ops/preview-deploy-state/active-release.yml" ]]; then
  case "${1:---check}" in
    --check) action=check-rollback ;;
    --restore-previous) action=rollback ;;
    *) exit 2 ;;
  esac
  exec /usr/bin/bash "$BASE/ops/deploy-prebuilt.sh" preview "$action"
fi
STATE="$BASE/ops/preview-deploy-state"
exec 9>"$STATE/deploy.lock"
flock -n 9 || { echo "Deployment in progress" >&2; exit 75; }
exec 8>"$BASE/ops/application-build.lock"
flock -n 8 || { echo "Application build or maintenance in progress" >&2; exit 75; }
previous="$(docker image inspect imenu-stage-app:rollback --format '{{.Id}}')"
current="$(docker inspect imenu-stage-app --format '{{.Image}}')"
if [[ "${1:---check}" == --check ]]; then
  echo "Current staging image: $current"
  echo "Previous staging image: $previous"
  echo "Database and production services untouched"
  exit 0
fi
[[ "$#" -eq 1 && "$1" == --restore-previous ]] || exit 2
compose="$STATE/rollback-compose.yml"
[[ -f "$compose" ]] || compose="$BASE/ops/config/compose.stage.yml"
export IMENU_STAGE_ENV_FILE="$BASE/secrets/app-stage.env"
docker tag "$current" imenu-stage-app:before-manual-rollback
docker tag "$previous" imenu-stage-app:latest
if ! docker compose -f "$compose" up -d --no-deps --force-recreate app; then
  docker tag "$current" imenu-stage-app:latest
  docker compose -f "$compose" up -d --no-deps --force-recreate app
  exit 1
fi
for _ in $(seq 1 48); do
  if [[ "$(docker inspect imenu-stage-app --format '{{.State.Health.Status}}')" == healthy ]]; then
    if [[ -f "$STATE/rollback-sha" ]]; then cp "$STATE/rollback-sha" "$STATE/deployed-sha"; else rm -f "$STATE/deployed-sha"; fi
    cp "$compose" "$STATE/active-compose.yml"
    echo "Previous staging application healthy; database untouched"
    exit 0
  fi
  sleep 5
done
docker tag "$current" imenu-stage-app:latest
docker compose -f "$compose" up -d --no-deps --force-recreate app
echo "Rollback candidate unhealthy; original application restored" >&2
exit 1

