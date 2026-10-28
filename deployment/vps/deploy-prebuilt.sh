#!/usr/bin/env bash
# Shared standalone deployment; runtime secrets and rollback stay on the VPS.
set -Eeuo pipefail
umask 077
BASE=/opt/imenu-migration
REMOTE=https://github.com/metrix0/imenu.git
[[ $# -ge 2 ]] || exit 2
target="$1"; action="$2"; shift 2
case "$target" in
  production)
    BRANCH=main
    PREFIX=production
    BUILD_ENV="$BASE/secrets/app-production-build.env"
    RUN_ENV="$BASE/secrets/app-production.env"
    COMPOSE="$BASE/ops/config/compose.production.yml"
    CONTAINER=imenu-production-app
    EXPECTED_API=https://api.imenuapp.com.br
    [[ -f "$BASE/ops/PRODUCTION_JOBS_ENABLED" ]] || exit 1
    ;;
  preview)
    BRANCH=preview
    PREFIX=preview
    BUILD_ENV="$BASE/secrets/app-build.env"
    RUN_ENV="$BASE/secrets/app-stage.env"
    COMPOSE="$BASE/ops/config/compose.stage.yml"
    CONTAINER=imenu-stage-app
    EXPECTED_API=https://api-vps-stage.imenuapp.com.br
    ;;
  *) exit 2 ;;
esac
STATE="$BASE/ops/$PREFIX-deploy-state"
RELEASES="$BASE/ops/$PREFIX-releases"
CACHE="$BASE/ops/$PREFIX-next-cache"
export IMENU_STAGE_ENV_FILE="$RUN_ENV" GIT_TERMINAL_PROMPT=0
[[ -f "$BUILD_ENV" && -f "$RUN_ENV" && -f "$COMPOSE" ]] || exit 1
mkdir -p "$STATE" "$RELEASES"

public_config() {
  python3 - "$BUILD_ENV" "$EXPECTED_API" "${1:-env}" <<'PY'
import hashlib, json, pathlib, re, shlex, sys
values = {}
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    if line.startswith('NEXT_PUBLIC_') and '=' in line:
        key, raw = line.split('=', 1)
        parsed = shlex.split(raw)
        if not re.fullmatch(r'NEXT_PUBLIC_[A-Z0-9_]+', key) or len(parsed) != 1 or any(c in parsed[0] for c in '\r\n'):
            raise SystemExit('Invalid public build setting')
        values[key] = parsed[0]
if values.get('NEXT_PUBLIC_SUPABASE_URL') != sys.argv[2]:
    raise SystemExit('Mismatched public build environment')
if sys.argv[3] == 'hash':
    print(hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest())
else:
    for key, value in sorted(values.items()):
        print(f'{key}={value}')
PY
}
public_assets() {
  local manifest=""
  if [[ "$1" == prepare ]]; then manifest="$(cat)"; fi
  python3 - "$1" "$BASE/ops/release-assets" "$CONTAINER" "${2:-}" "$manifest" <<'PY'
import hashlib,json,os,pathlib,re,shutil,subprocess,sys,tempfile
mode,cache,container,release,raw=sys.argv[1:]
cache=pathlib.Path(cache);cache.mkdir(parents=True,exist_ok=True)
manifest=json.loads(raw) if mode=='prepare' else json.loads((pathlib.Path(release)/'.imenu-public-assets.json').read_text())
if not isinstance(manifest,list) or len(manifest)>20:
    raise SystemExit('Invalid public asset manifest')
seen=set()
for item in manifest:
    if (not isinstance(item,dict) or set(item)!={'path','sha256','size'} or
        not isinstance(item['path'],str) or not re.fullmatch(r'public/downloads/[\w .()-]+\.exe',item['path']) or
        item['path'] in seen or not re.fullmatch('[0-9a-f]{64}',item.get('sha256','')) or
        type(item.get('size')) is not int or not 0<item['size']<268435456):
        raise SystemExit('Invalid public asset entry')
    seen.add(item['path'])
def valid(path,item):
    if not path.is_file() or path.stat().st_size!=item['size']: return False
    with path.open('rb') as f:
        return hashlib.file_digest(f,'sha256').hexdigest()==item['sha256']
ready=True
for item in manifest:
    cached=cache/item['sha256']
    source=pathlib.Path(release)/item['path'] if release else None
    if source is not None and source.exists():
        if not valid(source,item): raise SystemExit('Archived installer checksum mismatch')
        if not valid(cached,item):
            fd,tmp=tempfile.mkstemp(dir=cache,prefix='.asset-');os.close(fd)
            try:
                shutil.copyfile(source,tmp);os.chmod(tmp,0o644);os.replace(tmp,cached)
            finally:
                if os.path.exists(tmp):os.unlink(tmp)
    elif not valid(cached,item) and mode=='prepare':
        wd=subprocess.check_output(['docker','inspect',container,'--format','{{.Config.WorkingDir}}'],text=True).strip()
        if wd not in ('/app','/app/release'): raise SystemExit('Unexpected runtime directory')
        fd,tmp=tempfile.mkstemp(dir=cache,prefix='.asset-');os.close(fd)
        try:
            p=subprocess.run(['docker','cp',container+':'+wd+'/'+item['path'],tmp],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if p.returncode==0 and valid(pathlib.Path(tmp),item):
                os.chmod(tmp,0o644);os.replace(tmp,cached)
        finally:
            if os.path.exists(tmp):os.unlink(tmp)
    if not valid(cached,item):
        if mode=='restore': raise SystemExit('Installer cache unavailable; full archive required')
        ready=False
    elif mode=='restore' and not source.exists():
        source.parent.mkdir(parents=True,exist_ok=True)
        os.link(cached,source)
if mode=='prepare':print('READY' if ready else 'FULL')
PY
}
case "$action" in
  assets-ready) [[ $# -eq 0 ]] || exit 2; public_assets prepare; exit 0 ;;
  public-build-env) [[ $# -eq 0 ]] || exit 2; public_config; exit 0 ;;
  upload|activate|retry|verify) [[ $# -eq 1 ]] || exit 2 ;;
  pull|pull-release) [[ $# -eq 2 && "$2" =~ ^[0-9a-f]{64}$ ]] || exit 2 ;;
  rollback|check-rollback) [[ $# -eq 0 ]] || exit 2 ;;
  *) exit 2 ;;
esac
sha="${1:-}"
if [[ -n "$sha" ]]; then [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 2; fi

if [[ "$action" == pull || "$action" == pull-release ]]; then
  exec 7>"$STATE/download.lock"
  flock -n 7 || exit 75
  IFS= read -r signed_url || exit 2
  python3 - "$signed_url" "$action" <<'PY'
import sys
from urllib.parse import urlsplit
u = urlsplit(sys.argv[1]); host = (u.hostname or '').lower()
allowed = host == 'release-assets.githubusercontent.com' if sys.argv[2] == 'pull-release' else host.endswith('.blob.core.windows.net') or host.endswith('.actions.githubusercontent.com')
if u.scheme != 'https' or not allowed or u.username or u.password or u.port not in (None,443) or u.fragment or len(sys.argv[1]) > 8192:
    raise SystemExit('Untrusted artifact URL')
PY
  # Content-addressed partial files survive a retry. Never persist or log signed URLs.
  partial="$RELEASES/.download-$2.part"
  started=$SECONDS
  if [[ "$action" == pull-release && -f "$partial" && "$(sha256sum "$partial" | cut -d ' ' -f1)" == "$2" ]]; then
    echo 'Reusing completed, checksum-verified download'
  else
  for attempt in 1 2 3; do
    rc=0
    curl --fail --silent --show-error --proto '=https' --max-redirs 0 \
      --connect-timeout 15 --max-time 120 --speed-limit 131072 --speed-time 30 \
      --max-filesize 1073741824 --continue-at - --output "$partial" "$signed_url" || rc=$?
    [[ "$rc" -eq 0 ]] && break
    echo "Download attempt $attempt failed (curl $rc); retaining partial bytes for resume" >&2
    [[ "$attempt" -lt 3 ]] || exit "$rc"
    sleep 2
  done
  fi
  (( $(stat -c %s "$partial") < 1073741824 )) || exit 1
  echo "TIMING download=$((SECONDS-started))s bytes=$(stat -c %s "$partial") source=$action"
  if [[ "$action" == pull ]]; then
    # Compatibility with in-flight deployments from the previous workflow.
    tarfile="$(mktemp "$RELEASES/.legacy-XXXXXXXX.tar.zst")"
    trap 'rm -f -- "$tarfile"' EXIT
    python3 - "$partial" "$tarfile" <<'PY'
import shutil,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    files=[f for f in z.infolist() if not f.is_dir()]
    if len(files)!=1 or files[0].filename!='production-release.tar.zst' or files[0].file_size>=1073741824:
        raise SystemExit('Unexpected legacy artifact')
    with z.open(files[0]) as src, open(sys.argv[2],'wb') as dst:
        shutil.copyfileobj(src,dst,1024*1024)
PY
  else
    tarfile="$partial"
  fi
  if [[ "$(sha256sum "$tarfile" | cut -d ' ' -f1)" != "$2" ]]; then
    rm -f -- "$partial"
    echo 'Artifact SHA256 mismatch; current application unchanged' >&2
    exit 1
  fi
  /usr/bin/bash "$0" "$target" upload "$sha" < "$tarfile"
  rm -f -- "$partial"
  exit 0
fi

if [[ "$action" == upload ]]; then
  exec 9>"$STATE/upload.lock"; flock -n 9 || exit 75
  tmp="$(mktemp "$RELEASES/.upload-XXXXXXXX.tar.zst")"; tmpdir=""
  trap 'rm -f -- "$tmp"; if [[ -n "$tmpdir" ]]; then rm -rf -- "$tmpdir"; fi' EXIT
  cat > "$tmp"
  size="$(stat -c %s "$tmp")"
  (( size > 0 && size < 1073741824 )) || exit 1
  started=$SECONDS
  zstd -tq "$tmp"
  tmpdir="$(mktemp -d "$RELEASES/.extract-XXXXXXXX")"
  (umask 022; tar -I zstd --no-same-owner -xf "$tmp" -C "$tmpdir")
  chmod 755 "$tmpdir"
  if [[ -f "$tmpdir/.imenu-public-assets.json" ]]; then public_assets restore "$tmpdir"; fi
  [[ -f "$tmpdir/server.js" && -f "$tmpdir/.next/BUILD_ID" && -f "$tmpdir/node_modules/next/package.json" ]] || exit 1
  [[ "$(cat "$tmpdir/.imenu-commit-sha")" == "$sha" ]] || exit 1
  [[ "$(cat "$tmpdir/.imenu-public-config-sha256")" == "$(public_config hash)" ]] || { echo 'Public config mismatch' >&2; exit 1; }
  if [[ -d "$RELEASES/$sha" ]]; then
    # A retry reuses the first verified release for this source/configuration.
    [[ "$(cat "$RELEASES/$sha/.imenu-public-config-sha256")" == "$(public_config hash)" ]] || exit 1
    echo "Reusing previously verified immutable release: $sha"
  else
    mv -T "$tmpdir" "$RELEASES/$sha"; tmpdir=""
  fi
  echo "TIMING verify_extract=$((SECONDS-started))s compressed_bytes=$size sha=$sha target=$target"
  exit 0
fi

exec 9>"$STATE/deploy.lock"
flock -n 9 || { echo 'Deployment active' >&2; exit 75; }
# Serialize VPS deploy smoke checks with image/cache pruning and other deployments.
exec 8>"$BASE/ops/application-build.lock"
flock -n 8 || { echo 'Another deployment or Docker cleanup is active' >&2; exit 75; }
[[ "$(docker network inspect imenu-stage_default --format '{{.Internal}}')" == true ]] || exit 1
install -d -o 1000 -g 1000 -m 755 "$CACHE"
health() {
  local name="$1"
  for _ in $(seq 1 45); do
    if [[ "$(docker inspect "$name" --format '{{.State.Health.Status}}' 2>/dev/null || true)" == healthy ]]; then return 0; fi
    [[ "$(docker inspect "$name" --format '{{.State.Running}}' 2>/dev/null || true)" == true ]] || return 1
    sleep 2
  done
  return 1
}
compose_up() {
  docker compose -f "$1" up -d --no-deps --force-recreate --pull never app
}
if [[ "$action" == check-rollback || "$action" == rollback ]]; then
  [[ -f "$STATE/rollback-release.yml" ]] || { echo 'No standalone rollback saved' >&2; exit 1; }
  docker compose -f "$STATE/rollback-release.yml" config -q
  [[ "$action" == check-rollback ]] && { echo 'Previous application rollback configuration available'; exit 0; }
  cp "$STATE/active-release.yml" "$STATE/before-manual-rollback.yml"
  if compose_up "$STATE/rollback-release.yml" && health "$CONTAINER"; then
    cp "$STATE/rollback-release.yml" "$STATE/active-release.yml"
    if [[ -f "$STATE/rollback-sha" ]]; then cp "$STATE/rollback-sha" "$STATE/deployed-sha"; else rm -f "$STATE/deployed-sha"; fi
    echo 'Previous application restored and healthy; database unchanged'
    exit 0
  fi
  compose_up "$STATE/before-manual-rollback.yml"
  health "$CONTAINER" || { echo 'CRITICAL: rollback and recovery unhealthy' >&2; exit 1; }
  echo 'Rollback candidate failed; original application restored' >&2; exit 1
fi
[[ -d "$RELEASES/$sha" && "$(cat "$RELEASES/$sha/.imenu-commit-sha")" == "$sha" ]] || exit 1
[[ "$(cat "$RELEASES/$sha/.imenu-public-config-sha256")" == "$(public_config hash)" ]] || exit 1
python3 - "$RUN_ENV" "$EXPECTED_API" <<'PY'
import pathlib,sys
v=dict(l.split('=',1) for l in pathlib.Path(sys.argv[1]).read_text().splitlines() if l.startswith('NEXT_PUBLIC_') and '=' in l)
if v.get('NEXT_PUBLIC_SUPABASE_URL','').strip("'\"")!=sys.argv[2]:
    raise SystemExit('Runtime environment mismatch')
PY
image="$(docker inspect "$CONTAINER" --format '{{.Image}}')"
candidate="$STATE/candidate-release.yml"
cat > "$STATE/release-overlay.yml" <<YAML
services:
  app:
    image: $image
    working_dir: /app/release
    command: ["node", "server.js"]
    environment:
      HOSTNAME: "0.0.0.0"
      PORT: "3000"
    labels:
      com.imenu.commit: "$sha"
    healthcheck:
      interval: 3s
      start_interval: 2s
    volumes:
      - type: bind
        source: $RELEASES/$sha
        target: /app/release
        read_only: true
      - type: bind
        source: $CACHE
        target: /app/release/.next/cache
YAML
docker compose -f "$COMPOSE" -f "$STATE/release-overlay.yml" config --no-env-resolution > "$candidate"
docker compose -f "$candidate" config -q

# Check the real release without exposing a port or running a browser on the production VPS.
# Browser/E2E suites run on GitHub-hosted CI runners, not alongside live services.
smoke="imenu-$PREFIX-release-check"
smoke_limits="$STATE/smoke-limits.yml"
started=$SECONDS
cat > "$smoke_limits" <<'YAML'
services:
  app:
    mem_limit: 512m
    memswap_limit: 512m
    cpus: 0.5
    pids_limit: 128
    environment:
      NODE_OPTIONS: "--max-old-space-size=256"
YAML
cleanup_smoke() {
  docker rm -f "$smoke" >/dev/null 2>&1 || true
  rm -f -- "$smoke_limits"
}
trap cleanup_smoke EXIT
docker rm -f "$smoke" >/dev/null 2>&1 || true
docker compose -f "$candidate" -f "$smoke_limits" run -d --no-deps --pull never --name "$smoke" app >/dev/null
if ! health "$smoke"; then
  echo 'Candidate failed private health check; live application unchanged' >&2
  exit 1
fi
[[ "$(docker exec "$smoke" cat /app/release/.imenu-commit-sha)" == "$sha" ]] || exit 1
docker exec "$smoke" node -e "require('sharp')"
cleanup_smoke
trap - EXIT
echo "TIMING preflight=$((SECONDS-started))s sha=$sha target=$target"
[[ "$action" == verify ]] && { echo 'Release verified; live application unchanged'; exit 0; }

if [[ "$target" == preview ]]; then
  [[ "$(curl -fsS --max-time 10 https://johnvitor.com/api/preview-deploy-status)" == ON ]] || { echo 'Preview toggle OFF; activation skipped'; exit 0; }
fi
remote_sha="$(git -c http.version=HTTP/1.1 ls-remote "$REMOTE" refs/heads/"$BRANCH" | cut -f1)"
[[ "$remote_sha" =~ ^[0-9a-f]{40}$ ]] || exit 1
[[ "$remote_sha" == "$sha" ]] || { echo "Skipping obsolete $sha; $BRANCH is $remote_sha"; exit 0; }
if [[ "$(cat "$STATE/deployed-sha" 2>/dev/null || true)" == "$sha" && "$(docker inspect "$CONTAINER" --format '{{.State.Health.Status}}')" == healthy ]]; then echo 'Already deployed and healthy'; exit 0; fi
if [[ "$action" != retry && "$(cat "$STATE/failed-sha" 2>/dev/null || true)" == "$sha" ]]; then echo 'Previously failed; explicit retry required' >&2; exit 1; fi

# Preserve the previous fixed-name container configuration for automatic rollback.
if [[ -f "$STATE/active-release.yml" ]]; then
  cp "$STATE/active-release.yml" "$STATE/restore-release.yml"
elif [[ -f "$STATE/active-prebuilt.yml" ]]; then
  docker compose -f "$COMPOSE" -f "$STATE/active-prebuilt.yml" config --no-env-resolution > "$STATE/restore-release.yml"
else
  docker compose -f "$COMPOSE" config --no-env-resolution > "$STATE/restore-release.yml"
fi

# Keep public traffic on a separate healthy container while the fixed-name
# container is replaced. Preserve the original name/ports for monitors and jobs.
handoff="imenu-$PREFIX-handoff"
proxy_file="$BASE/ops/cutover/Caddyfile.live"
[[ -f "$proxy_file" ]] || { echo "Live Caddyfile missing" >&2; exit 1; }
proxy_mount="$(docker inspect imenu-stage-proxy --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')"
[[ "$proxy_mount" == "$proxy_file" ]] || { echo "Unexpected Caddyfile mount" >&2; exit 1; }
proxy_backup="$(mktemp "$STATE/.proxy-before-XXXXXXXX")"
cp -p "$proxy_file" "$proxy_backup"
route_state=stable
recreated=false
handoff_started=false
started=$SECONDS

proxy_route() {
  local mode="$1" since ok=false public_host=www.imenuapp.com.br
  if [[ "$mode" == handoff ]]; then
    cmp -s "$proxy_backup" "$proxy_file" || { echo "Caddyfile changed concurrently" >&2; return 1; }
    # The live Caddyfile is bind-mounted as a file: write in place, never rename.
    python3 - "$proxy_backup" "$proxy_file" "$target" "$handoff" <<'PYROXY'
import os,pathlib,sys
source,dest=map(pathlib.Path,sys.argv[1:3])
target,handoff=sys.argv[3:]
text=source.read_text()
if target=="production":
    rules=[("reverse_proxy imenu-production-app:3000",f"reverse_proxy {handoff}:3000",2),
           ("ask http://imenu-production-app:3000",f"ask http://{handoff}:3000",1)]
else:
    rules=[("reverse_proxy app:3000",f"reverse_proxy {handoff}:3000",2)]
for old,new,minimum in rules:
    if text.count(old)<minimum: raise SystemExit(f"Unexpected {target} routes")
    text=text.replace(old,new)
with dest.open("w") as f:
    f.write(text);f.flush();os.fsync(f.fileno())
PYROXY
  else
    cat "$proxy_backup" > "$proxy_file"
  fi
  docker exec imenu-stage-proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
  since="$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)"
  docker kill --signal=USR1 imenu-stage-proxy >/dev/null
  for _ in $(seq 1 10); do
    if docker logs --since "$since" imenu-stage-proxy 2>&1 | grep -Fq '"msg":"successfully reloaded config from file"'; then
      ok=true; break
    fi
    sleep 1
  done
  [[ "$ok" == true ]] || { echo "Caddy reload not confirmed" >&2; return 1; }
  [[ "$target" == preview ]] && public_host=preview.imenuapp.com.br
  curl -kfsS --resolve "$public_host:443:127.0.0.1" --max-time 8 "https://$public_host/api/health" >/dev/null
}

finish() {
  local rc=$?
  trap - EXIT INT TERM
  if [[ "$rc" -ne 0 ]]; then
    if [[ "$recreated" == true ]]; then
      echo "Restoring previous application while handoff serves requests" >&2
      printf '%s\n' "$sha" > "$STATE/failed-sha"
      if compose_up "$STATE/restore-release.yml" && health "$CONTAINER"; then
        echo "Previous application restored and healthy" >&2
      else
        echo "CRITICAL: previous application recovery failed" >&2
      fi
    fi
    if [[ "$route_state" != stable ]] && health "$CONTAINER"; then
      if proxy_route stable; then route_state=stable
      else echo "CRITICAL: proxy restoration failed; handoff retained" >&2
      fi
    fi
  fi
  if [[ "$route_state" == stable ]]; then
    if [[ "$handoff_started" == true ]]; then docker rm -f "$handoff" >/dev/null 2>&1 || true; fi
    rm -f -- "$proxy_backup"
  else
    echo "CRITICAL: handoff retained at $handoff; restore proxy from $proxy_backup" >&2
  fi
  exit "$rc"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Run the full application (with its regular Compose resource limits) without
# publishing the stable service's host ports.
docker rm -f "$handoff" >/dev/null 2>&1 || true
docker compose -f "$candidate" run -d --no-deps --pull never --name "$handoff" app >/dev/null
handoff_started=true
health "$handoff" || { echo "Handoff unhealthy; original app untouched" >&2; exit 1; }
[[ "$(docker exec "$handoff" cat /app/release/.imenu-commit-sha)" == "$sha" ]] || exit 1

route_state=uncertain
proxy_route handoff
route_state=handoff
recreated=true
compose_up "$candidate"
health "$CONTAINER" || { echo "New application unhealthy" >&2; exit 1; }
[[ "$(docker exec "$CONTAINER" cat /app/release/.imenu-commit-sha)" == "$sha" ]] || exit 1
proxy_route stable
route_state=stable

cp "$STATE/restore-release.yml" "$STATE/rollback-release.yml"
if [[ -f "$STATE/deployed-sha" ]]; then cp "$STATE/deployed-sha" "$STATE/rollback-sha"; fi
cp "$candidate" "$STATE/active-release.yml"
printf '%s\n' "$sha" > "$STATE/deployed-sha"
rm -f "$STATE/failed-sha"
recreated=false
echo "TIMING activation=$((SECONDS-started))s sha=$sha target=$target"
echo "Deployed healthy $target: $sha"
# Keep the active and rollback releases; discard only obsolete verified releases/partials.
python3 - "$STATE" "$RELEASES" <<'PY'
import pathlib,re,shutil,sys,time
state,root=map(pathlib.Path,sys.argv[1:])
keep=set()
for name in ['active-release.yml','rollback-release.yml','active-prebuilt.yml']:
    p=state/name
    if p.exists(): keep.update(re.findall(re.escape(str(root))+'/([0-9a-f]{40})',p.read_text()))
for p in root.iterdir():
    if p.is_dir() and re.fullmatch('[0-9a-f]{40}',p.name) and p.name not in keep and time.time()-p.stat().st_mtime>86400:
        shutil.rmtree(p)
    elif p.name.startswith('.download-') and p.is_file() and time.time()-p.stat().st_mtime>86400:
        p.unlink()
PY
