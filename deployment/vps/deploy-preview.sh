#!/usr/bin/env bash
# Staging only. Never deploys main, touches production DNS, or enables jobs.
set -Eeuo pipefail
umask 077

BASE=/opt/imenu-migration
SOURCE="$BASE/ops/preview-checkout"
STATE="$BASE/ops/preview-deploy-state"
REMOTE=https://github.com/metrix0/imenu.git
BUILD_ENV="$BASE/secrets/app-build.env"
RUN_ENV="$BASE/secrets/app-stage.env"
COMPOSE="$BASE/app/deployment/vps/compose.stage.yml"
mkdir -p "$STATE"
exec 9>"$STATE/deploy.lock"
flock -n 9 || { echo "Another staging deployment is active"; exit 0; }

[[ -f "$BUILD_ENV" && -f "$RUN_ENV" && -f "$COMPOSE" ]] || { echo "Missing staging configuration" >&2; exit 1; }
[[ "$(docker network inspect imenu-stage_default --format '{{.Internal}}')" == true ]] || { echo "Staging network is not isolated" >&2; exit 1; }
[[ ! -e "$BASE/ops/PRODUCTION_JOBS_ENABLED" ]] || { echo "Production job marker exists" >&2; exit 1; }
docker inspect imenu-stage-app >/dev/null
export GIT_TERMINAL_PROMPT=0
export IMENU_STAGE_ENV_FILE="$RUN_ENV"

if [[ "$#" -eq 1 && "$1" == --check ]]; then
  git ls-remote "$REMOTE" refs/heads/preview
  echo "Current deployed SHA: $(cat "$STATE/deployed-sha" 2>/dev/null || echo unrecorded)"
  echo "Staging configuration and isolation OK"
  exit 0
fi
[[ "$#" -eq 0 ]] || { echo "Unexpected argument" >&2; exit 2; }

if [[ ! -d "$SOURCE/.git" ]]; then
  git clone --quiet --depth 1 --single-branch --branch preview "$REMOTE" "$SOURCE"
else
  [[ "$(git -C "$SOURCE" remote get-url origin)" == "$REMOTE" ]] || { echo "Unexpected repository remote" >&2; exit 1; }
  git -C "$SOURCE" fetch --quiet --depth 1 origin preview
  git -C "$SOURCE" reset --hard --quiet FETCH_HEAD
fi
sha="$(git -C "$SOURCE" rev-parse HEAD)"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
if [[ "$(cat "$STATE/deployed-sha" 2>/dev/null || true)" == "$sha" ]] && [[ "$(docker inspect imenu-stage-app --format '{{.State.Health.Status}}')" == healthy ]]; then
  echo "Already deployed and healthy: $sha"
  exit 0
fi

fingerprint="$(python3 - "$BUILD_ENV" <<'PY'
import hashlib, json, pathlib, shlex, sys
public = {}
for raw in pathlib.Path(sys.argv[1]).read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, raw_value = line.split('=', 1)
    if key.startswith('NEXT_PUBLIC_'):
        parts = shlex.split(raw_value)
        if len(parts) != 1:
            raise ValueError('Invalid build configuration')
        public[key] = parts[0]
if not public:
    raise ValueError('Missing public build configuration')
print(hashlib.sha256(json.dumps(public, sort_keys=True).encode()).hexdigest())
PY
)"
short_sha="$(printf '%s' "$sha" | cut -c1-12)"
candidate="imenu-stage-app:preview-$short_sha"
echo "Building staging $sha"
if ! docker build --build-arg "BUILD_PUBLIC_CONFIG_SHA256=$fingerprint" --secret "id=build_env,src=$BUILD_ENV" -f "$SOURCE/deployment/vps/Dockerfile" -t "$candidate" "$SOURCE" >"$STATE/build.log" 2>&1; then
  echo "Staging build failed" >&2
  tail -n 35 "$STATE/build.log" >&2
  exit 1
fi

old_image="$(docker inspect imenu-stage-app --format '{{.Image}}')"
docker tag "$old_image" imenu-stage-app:rollback
docker tag "$candidate" imenu-stage-app:latest

rollback() {
  echo "Restoring previous staging image" >&2
  docker tag imenu-stage-app:rollback imenu-stage-app:latest
  docker compose -f "$COMPOSE" up -d --no-deps --force-recreate app >&2 || true
}
if ! docker compose -f "$COMPOSE" up -d --no-deps --force-recreate app; then
  rollback
  exit 1
fi
healthy=false
for _ in $(seq 1 48); do
  status="$(docker inspect imenu-stage-app --format '{{.State.Health.Status}}' 2>/dev/null || echo missing)"
  if [[ "$status" == healthy ]]; then
    healthy=true
    break
  fi
  sleep 5
done
if [[ "$healthy" != true ]]; then
  rollback
  echo "New staging image was not healthy; previous image restored" >&2
  exit 1
fi
printf '%s\n' "$sha" >"$STATE/deployed-sha"
docker image rm "$candidate" >/dev/null 2>&1 || true
echo "Deployed healthy preview staging: $sha"
