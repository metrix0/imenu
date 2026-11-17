#!/bin/bash
set -euo pipefail
umask 077

root=/opt/imenu-migration
export TZ=America/Sao_Paulo
[[ "$(date +%d)" == 15 ]] || exit 0
read -r archive < "$root/backups/latest-encrypted"
[[ "$archive" == "$root/backups/"* && "${archive##*/}" =~ ^imenu-([0-9]{8})T([0-9]{6})Z\.enc$ ]]
backup_date="${BASH_REMATCH[1]}"
backup_time="${BASH_REMATCH[2]}"
backup_local=$(date -d "$backup_date ${backup_time:0:2}:${backup_time:2:2}:${backup_time:4:2} UTC" +%Y%m%d-%H)
[[ "$backup_local" == "$(date +%Y%m%d)-03" ]] || exit 0
checkpoint="$root/backups/.waha-update-${backup_date}T${backup_time}Z"
[[ -d "$checkpoint/sessions" ]] || exit 0

exec 9>"$root/backups/backup.lock"
flock -n 9
cd "$root/waha"
compose=(docker compose -p imenu-waha -f compose.yml)
container=imenu-kinghost-waha
repository=devlikeapro/waha

read_waha() {
  local script='
    async function get(path) {
      const response = await fetch("http://127.0.0.1:3000" + path, {
        headers: { "X-Api-Key": process.env.WAHA_API_KEY },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw Error("WAHA HTTP " + response.status);
      return response.json();
    }
    Promise.all([get("/api/version"), get("/api/sessions?all=true")]).then(([version, sessions]) => {
      const status = name => sessions.find(session => session.name === name)?.status ?? "MISSING";
      console.log(JSON.stringify({
        version: version.version,
        support: status("imenu-support"),
        blast: status("imenu-blast"),
        working: sessions.filter(session => session.status === "WORKING").length,
        total: sessions.length
      }));
    }).catch(error => { console.error(error.message); process.exitCode = 1; });
  '
  timeout 15s docker exec "$container" node -e "$script"
}

wait_for_waha() {
  local expected="$1" state deadline=$((SECONDS + 600))
  while (( SECONDS < deadline )); do
    if state=$(read_waha 2>/dev/null) && jq -e --arg version "$expected" \
      '.version == $version and .support == "WORKING" and .blast == "WORKING"' \
      <<< "$state" >/dev/null; then
      printf '%s\n' "$state"
      return 0
    fi
    sleep 10
  done
  printf 'WAHA_HEALTH_TIMEOUT version=%s last_state=%s\n' "$expected" "${state:-unavailable}" >&2
  return 1
}

release=$(curl -fsS --retry 2 --max-time 20 https://api.github.com/repos/devlikeapro/waha/releases/latest)
target=$(jq -er 'select(.draft == false and .prerelease == false)
  | .tag_name | select(test("^[0-9]{4}\\.[0-9]+\\.[0-9]+$"))' <<< "$release")
current_state=$(read_waha)
current=$(jq -er '.version | select(test("^[0-9]{4}\\.[0-9]+\\.[0-9]+$"))' <<< "$current_state")
if [[ "$target" == "$current" || "$(printf '%s\n' "$current" "$target" | sort -V | tail -1)" != "$target" ]]; then
  echo "WAHA_ALREADY_CURRENT $current"
  rm -rf -- "$checkpoint"
  exit 0
fi

sha256sum --check --status "$archive.sha256"
cmp -s compose.yml "$checkpoint/compose.yml"
old_image=$("${compose[@]}" config --images)
[[ "$old_image" =~ ^devlikeapro/waha@sha256:[a-f0-9]{64}$ ]]
[[ "$(docker inspect -f '{{.Config.Image}}' "$container")" == "$old_image" ]]
tag="$repository:latest-$target"
docker pull "$tag"
new_image=$(docker image inspect "$tag" --format '{{range .RepoDigests}}{{println .}}{{end}}' | awk '/^devlikeapro\/waha@sha256:/ {print; exit}')
[[ "$new_image" =~ ^devlikeapro/waha@sha256:[a-f0-9]{64}$ && "$new_image" != "$old_image" ]]
next_compose="$checkpoint/compose.next.yml"
cp -p compose.yml "$next_compose"
sed -i "s|$old_image|$new_image|" "$next_compose"
[[ "$(docker compose --project-directory "$root/waha" -p imenu-waha -f "$next_compose" config --images)" == "$new_image" ]]
cmp -s compose.yml "$checkpoint/compose.yml"

switch_started=0
rollback() {
  local code=$?
  trap - EXIT
  echo "WAHA_UPDATE_FAILED old=$current target=$target; starting rollback" >&2
  if (( switch_started )); then
    "${compose[@]}" stop waha || exit 1
    mv -T -- sessions "$checkpoint/failed-sessions" || exit 1
    if ! mv -T -- "$checkpoint/sessions" sessions; then
      mv -T -- "$checkpoint/failed-sessions" sessions
      exit 1
    fi
    cp -p "$checkpoint/compose.yml" "$next_compose" || exit 1
    mv -T -- "$next_compose" compose.yml || exit 1
  fi
  if "${compose[@]}" up -d --no-deps --pull never waha && wait_for_waha "$current"; then
    echo "WAHA_ROLLBACK_OK $current" >&2
  else
    echo "WAHA_ROLLBACK_UNVERIFIED $checkpoint" >&2
  fi
  exit "$code"
}
trap rollback EXIT
trap 'exit 143' TERM
trap 'exit 130' INT
echo "WAHA_UPDATE_START old=$current target=$target baseline=$current_state"
"${compose[@]}" stop waha
# Refresh the existing snapshot while SQLite is closed so rollback keeps pre-restart writes.
rsync -aH --checksum --numeric-ids --delete -- sessions/ "$checkpoint/sessions/"
switch_started=1
mv -T -- "$next_compose" compose.yml
"${compose[@]}" up -d --no-deps --pull never waha
wait_for_waha "$target"
trap - EXIT TERM INT
rm -rf -- "$checkpoint"
echo "WAHA_UPDATE_OK $target"
