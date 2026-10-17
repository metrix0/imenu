#!/usr/bin/env bash
# Deploy one exact branch HEAD to its isolated app; never changes the database or DNS.
set -Eeuo pipefail
umask 077

BASE=/opt/imenu-migration
SOURCE="$BASE/ops/preview-checkout"
STATE="$BASE/ops/preview-deploy-state"
REMOTE=https://github.com/metrix0/imenu.git
BUILD_ENV="$BASE/secrets/app-build.env"
RUN_ENV="$BASE/secrets/app-stage.env"
COMPOSE="$BASE/ops/config/compose.stage.yml"
BRANCH=preview
APP_CONTAINER=imenu-stage-app
IMAGE=imenu-stage-app
STABLE=latest
if [[ "${1:-}" == --production ]]; then
  shift
  BRANCH=main
  SOURCE="$BASE/ops/production-checkout"
  STATE="$BASE/ops/production-deploy-state"
  BUILD_ENV="$BASE/secrets/app-production-build.env"
  RUN_ENV="$BASE/secrets/app-production.env"
  COMPOSE="$BASE/ops/config/compose.production.yml"
  APP_CONTAINER=imenu-production-app
  IMAGE=imenu-production-app
  STABLE=final
  [[ -f "$BASE/ops/PRODUCTION_JOBS_ENABLED" ]] || { echo "Production is not active" >&2; exit 1; }
fi
mkdir -p "$STATE"
exec 9>"$STATE/deploy.lock"
flock -n 9 || { echo "Another deployment is active" >&2; exit 75; }

[[ -f "$BUILD_ENV" && -f "$RUN_ENV" && -f "$COMPOSE" ]] || { echo "Missing staging configuration" >&2; exit 1; }
[[ "$(docker network inspect imenu-stage_default --format '{{.Internal}}')" == true ]] || { echo "Staging network is not isolated" >&2; exit 1; }
python3 - "$RUN_ENV" "$BRANCH" <<'PY'
import pathlib,sys
env=dict(line.split("=",1) for line in pathlib.Path(sys.argv[1]).read_text().splitlines() if line.strip() and not line.startswith("#") and "=" in line)
expected="https://api.imenuapp.com.br" if sys.argv[2]=="main" else "https://api-vps-stage.imenuapp.com.br"
if env.get("NEXT_PUBLIC_SUPABASE_URL","").strip("'\\\"")!=expected:
    raise SystemExit("Refusing mismatched deployment environment")
PY
exec 8>"$BASE/ops/application-build.lock"
flock 8
cleanup_storage() {
  if [[ -x "$BASE/ops/docker-retention.sh" ]]; then
    "$BASE/ops/docker-retention.sh" --build-lock-held || echo "Storage cleanup failed; check imenu-docker-retention.service" >&2
  fi
}
docker inspect "$APP_CONTAINER" >/dev/null
export GIT_TERMINAL_PROMPT=0
export IMENU_STAGE_ENV_FILE="$RUN_ENV"

if [[ "$#" -eq 1 && "$1" == --check ]]; then
  git -c http.version=HTTP/1.1 ls-remote "$REMOTE" refs/heads/"$BRANCH"
  echo "Deployed: $(cat "$STATE/deployed-sha" 2>/dev/null || echo unrecorded)"
  echo "Failed: $(cat "$STATE/failed-sha" 2>/dev/null || echo none)"
  echo "Staging configuration and isolation OK"
  exit 0
fi
retry=false
if [[ "$#" -eq 2 && "$1" == --retry ]]; then
  retry=true
  sha="$2"
elif [[ "$#" -eq 1 ]]; then
  sha="$1"
else
  echo "Expected preview SHA or --retry SHA" >&2
  exit 2
fi
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid SHA" >&2; exit 2; }
remote_sha="$(git -c http.version=HTTP/1.1 ls-remote "$REMOTE" refs/heads/"$BRANCH" | cut -f1)"
[[ "$remote_sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Cannot resolve preview HEAD" >&2; exit 1; }
if [[ "$remote_sha" != "$sha" ]]; then
  echo "Skipping obsolete commit $sha; preview now points to $remote_sha"
  exit 0
fi
if [[ "$(cat "$STATE/deployed-sha" 2>/dev/null || true)" == "$sha" ]] && [[ "$(docker inspect "$APP_CONTAINER" --format '{{.State.Health.Status}}')" == healthy ]]; then
  echo "Already deployed and healthy: $sha"
  exit 0
fi
if [[ "$retry" != true && "$(cat "$STATE/failed-sha" 2>/dev/null || true)" == "$sha" ]]; then
  echo "Commit $sha previously failed; manual --retry required" >&2
  exit 1
fi
trap 'rc=$?; if [[ "$rc" -ne 0 ]]; then printf "%s\n" "$sha" >"$STATE/failed-sha"; echo "Recorded failed preview SHA: $sha" >&2; fi; cleanup_storage; exit "$rc"' EXIT


if [[ -d "$SOURCE/.git" ]] && ! git -C "$SOURCE" rev-parse --verify HEAD >/dev/null 2>&1; then
  rm -rf -- "$SOURCE"
fi
if [[ ! -d "$SOURCE/.git" ]]; then
  git -c http.version=HTTP/1.1 clone --quiet --filter=blob:none --depth 1 --single-branch --branch "$BRANCH" "$REMOTE" "$SOURCE"
else
  [[ "$(git -C "$SOURCE" remote get-url origin)" == "$REMOTE" ]] || { echo "Unexpected repository remote" >&2; exit 1; }
  git -C "$SOURCE" -c http.version=HTTP/1.1 fetch --quiet --depth 1 origin "$BRANCH"
  git -C "$SOURCE" reset --hard --quiet FETCH_HEAD
fi
actual="$(git -C "$SOURCE" rev-parse HEAD)"
if [[ "$actual" != "$sha" ]]; then
  echo "Checkout advanced to $actual; skipping obsolete $sha"
  trap cleanup_storage EXIT
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
candidate="$IMAGE:$BRANCH-$short_sha"
cleanup_storage
available="$(df --output=avail -B1 "$BASE" | tail -1)"
(( available >= 16106127360 )) || { echo "Less than 15 GiB free; refusing application build" >&2; exit 1; }
echo "Building $BRANCH $sha"
if ! docker build --build-arg "BUILD_PUBLIC_CONFIG_SHA256=$fingerprint" --secret "id=build_env,src=$BUILD_ENV" -f "$SOURCE/deployment/vps/Dockerfile" -t "$candidate" "$SOURCE" >"$STATE/build.log" 2>&1; then
  echo "Staging build failed" >&2
  tail -n 35 "$STATE/build.log" >&2
  exit 1
fi

candidate_compose="$COMPOSE"
if [[ "$BRANCH" == preview ]]; then
  candidate_compose="$SOURCE/deployment/vps/compose.stage.yml"
elif [[ -f "$SOURCE/deployment/vps/compose.production.yml" ]]; then
  candidate_compose="$SOURCE/deployment/vps/compose.production.yml"
fi
[[ -f "$candidate_compose" ]] || { echo "Candidate compose file missing" >&2; exit 1; }
if [[ -f "$STATE/active-compose.yml" ]]; then
  cp "$STATE/active-compose.yml" "$STATE/rollback-compose.yml"
else
  cp "$COMPOSE" "$STATE/rollback-compose.yml"
fi
if [[ -f "$STATE/deployed-sha" ]]; then cp "$STATE/deployed-sha" "$STATE/rollback-sha"; fi
COMPOSE="$candidate_compose"
current_head="$(git -c http.version=HTTP/1.1 ls-remote "$REMOTE" refs/heads/"$BRANCH" | cut -f1)"
if [[ "$current_head" != "$sha" ]]; then echo "Branch advanced during build; leaving current app running"; trap cleanup_storage EXIT; exit 0; fi
old_image="$(docker inspect "$APP_CONTAINER" --format '{{.Image}}')"
docker tag "$old_image" "$IMAGE:rollback"
docker tag "$candidate" "$IMAGE:$STABLE"

rollback() {
  echo "Restoring previous staging image" >&2
  docker tag "$IMAGE:rollback" "$IMAGE:$STABLE"
  docker compose -f "$STATE/rollback-compose.yml" up -d --no-deps --force-recreate app >&2 || true
}
if ! docker compose -f "$COMPOSE" up -d --no-deps --force-recreate app; then
  rollback
  exit 1
fi
healthy=false
for _ in $(seq 1 48); do
  status="$(docker inspect "$APP_CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || echo missing)"
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
cp "$candidate_compose" "$STATE/active-compose.yml"
printf '%s\n' "$sha" >"$STATE/deployed-sha"
rm -f -- "$STATE/failed-sha"
docker image rm "$candidate" >/dev/null 2>&1 || true
echo "Deployed healthy preview $BRANCH: $sha"
