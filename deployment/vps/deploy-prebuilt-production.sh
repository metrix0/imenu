#!/usr/bin/env bash
# Deploy a GitHub-built Next.js standalone release without rebuilding Docker on the VPS.
set -Eeuo pipefail
umask 077
BASE=/opt/imenu-migration
STATE="$BASE/ops/production-deploy-state"
RELEASES="$BASE/ops/production-releases"
CACHE="$BASE/ops/production-next-cache"
BUILD_ENV="$BASE/secrets/app-production-build.env"
COMPOSE="$BASE/ops/config/compose.production.yml"
REMOTE=https://github.com/metrix0/imenu.git
CONTAINER=imenu-production-app

public_config() {
  python3 - "$BUILD_ENV" <<'PY'
import json, pathlib, shlex, sys, hashlib
values = {}
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, raw = line.split("=", 1)
    if key.startswith("NEXT_PUBLIC_"):
        parsed = shlex.split(raw)
        if len(parsed) != 1 or any(c in parsed[0] for c in "\r\n"):
            raise SystemExit("Invalid public build setting")
        values[key] = parsed[0]
if not values or values.get("NEXT_PUBLIC_SUPABASE_URL") != "https://api.imenuapp.com.br":
    raise SystemExit("Unexpected production public configuration")
if len(sys.argv) > 2:
    print(hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest())
else:
    for key, value in sorted(values.items()):
        print(f"{key}={value}")
PY
}
public_hash() {
  python3 - "$BUILD_ENV" <<'PY'
import hashlib, json, pathlib, shlex, sys
public = {}
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, raw = line.split("=", 1)
        if k.startswith("NEXT_PUBLIC_"):
            parts = shlex.split(raw)
            if len(parts) != 1:
                raise SystemExit("Invalid public build configuration")
            public[k] = parts[0]
if public.get("NEXT_PUBLIC_SUPABASE_URL") != "https://api.imenuapp.com.br":
    raise SystemExit("Unexpected production environment")
print(hashlib.sha256(json.dumps(public, sort_keys=True).encode()).hexdigest())
PY
}
case "${1:-}" in
  public-build-env)
    [[ "$#" -eq 1 ]] || exit 2
    public_config
    exit 0
    ;;
  upload|activate|retry)
    [[ "$#" -eq 2 ]] || exit 2
    ;;
  *) echo "Invalid prebuilt deployment request" >&2; exit 2 ;;
esac
action="$1"
sha="$2"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 2
[[ -f "$BASE/ops/PRODUCTION_JOBS_ENABLED" && -f "$BUILD_ENV" && -f "$COMPOSE" ]] || exit 1
mkdir -p "$STATE" "$RELEASES"

if [[ "$action" == upload ]]; then
  exec 9>"$STATE/upload.lock"
  flock -n 9 || exit 75
  tmp="$(mktemp "$RELEASES/.upload-XXXXXXXX.tar.zst")"
  tmpdir=""
  trap 'rm -f -- "$tmp"; if [[ -n "$tmpdir" ]]; then rm -rf -- "$tmpdir"; fi' EXIT
  cat > "$tmp"
  size="$(stat -c %s "$tmp")"
  (( size > 0 && size < 1073741824 )) || { echo "Invalid release archive size" >&2; exit 1; }
  zstd -tq "$tmp"
  tmpdir="$(mktemp -d "$RELEASES/.extract-XXXXXXXX")"
  (umask 022; tar -I zstd --no-same-owner -xf "$tmp" -C "$tmpdir")
  chmod 755 "$tmpdir"
  [[ -f "$tmpdir/server.js" && -f "$tmpdir/.next/BUILD_ID" && -f "$tmpdir/.imenu-commit-sha" ]] || { echo "Incomplete standalone release" >&2; exit 1; }
  [[ "$(cat "$tmpdir/.imenu-commit-sha")" == "$sha" ]] || { echo "Release SHA mismatch" >&2; exit 1; }
  [[ "$(cat "$tmpdir/.imenu-public-config-sha256")" == "$(public_hash)" ]] || { echo "Public build configuration mismatch" >&2; exit 1; }
  [[ -f "$tmpdir/node_modules/next/package.json" ]] || { echo "Missing standalone dependencies" >&2; exit 1; }
  if [[ -d "$RELEASES/$sha" ]]; then
    [[ "$(cat "$RELEASES/$sha/.imenu-commit-sha")" == "$sha" ]] || exit 1
    echo "Release already uploaded: $sha"
  else
    mv -T "$tmpdir" "$RELEASES/$sha"
    tmpdir=""
    echo "Release uploaded: $sha ($size compressed bytes)"
  fi
  exit 0
fi

exec 9>"$STATE/deploy.lock"
flock -n 9 || { echo "Another deployment is active" >&2; exit 75; }
[[ -d "$RELEASES/$sha" && "$(cat "$RELEASES/$sha/.imenu-commit-sha" 2>/dev/null)" == "$sha" ]] || { echo "Release missing" >&2; exit 1; }
[[ "$(cat "$RELEASES/$sha/.imenu-public-config-sha256" 2>/dev/null)" == "$(public_hash)" ]] || { echo "Release public configuration changed" >&2; exit 1; }
[[ "$(docker network inspect imenu-stage_default --format '{{.Internal}}')" == true ]] || { echo "Production network isolation mismatch" >&2; exit 1; }
[[ "$(docker inspect "$CONTAINER" --format '{{.State.Health.Status}}')" != missing ]] || exit 1
export GIT_TERMINAL_PROMPT=0
remote_sha="$(git -c http.version=HTTP/1.1 ls-remote "$REMOTE" refs/heads/main | cut -f1)"
[[ "$remote_sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
if [[ "$remote_sha" != "$sha" ]]; then
  echo "Skipping obsolete main commit $sha; current main $remote_sha"
  exit 0
fi
if [[ "$(cat "$STATE/deployed-sha" 2>/dev/null || true)" == "$sha" && "$(docker inspect "$CONTAINER" --format '{{.State.Health.Status}}')" == healthy ]]; then
  echo "Already deployed and healthy: $sha"
  exit 0
fi
if [[ "$action" != retry && "$(cat "$STATE/failed-sha" 2>/dev/null || true)" == "$sha" ]]; then
  echo "This SHA previously failed; use retry-prebuilt" >&2
  exit 1
fi

install -d -o 1000 -g 1000 -m 755 "$CACHE"
candidate="$STATE/candidate-prebuilt.yml"
cat > "$candidate" <<EOF
services:
  app:
    working_dir: /app/release
    command: ["node", "server.js"]
    environment:
      HOSTNAME: "0.0.0.0"
      PORT: "3000"
    volumes:
      - type: bind
        source: $RELEASES/$sha
        target: /app/release
        read_only: true
      - type: bind
        source: $CACHE
        target: /app/release/.next/cache
EOF
docker compose -f "$COMPOSE" -f "$candidate" config -q

rollback() {
  echo "Reverting to the previous healthy production release" >&2
  if [[ -f "$STATE/active-prebuilt.yml" ]]; then
    docker compose -f "$COMPOSE" -f "$STATE/active-prebuilt.yml" up -d --no-deps --force-recreate app >&2 || true
  else
    docker compose -f "$COMPOSE" up -d --no-deps --force-recreate app >&2 || true
  fi
}
trap 'rc=$?; if [[ "$rc" -ne 0 ]]; then printf "%s\n" "$sha" > "$STATE/failed-sha"; fi' EXIT
echo "Activating prebuilt main $sha"
if ! docker compose -f "$COMPOSE" -f "$candidate" up -d --no-deps --force-recreate app; then
  rollback
  exit 1
fi
healthy=false
for _ in $(seq 1 48); do
  if [[ "$(docker inspect "$CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || true)" == healthy ]]; then
    healthy=true
    break
  fi
  sleep 5
done
if [[ "$healthy" != true ]]; then
  rollback
  echo "New release unhealthy" >&2
  exit 1
fi
[[ "$(docker inspect "$CONTAINER" --format '{{.Config.WorkingDir}}')" == /app/release ]] || { rollback; echo "Wrong runtime working directory" >&2; exit 1; }
if [[ -f "$STATE/active-prebuilt.yml" ]]; then
  cp "$STATE/active-prebuilt.yml" "$STATE/rollback-prebuilt.yml"
fi
cp "$candidate" "$STATE/active-prebuilt.yml"
if [[ -f "$STATE/deployed-sha" ]]; then
  cp "$STATE/deployed-sha" "$STATE/rollback-sha"
fi
printf '%s\n' "$sha" > "$STATE/deployed-sha"
rm -f "$STATE/failed-sha"
echo "Deployed healthy prebuilt production: $sha"
