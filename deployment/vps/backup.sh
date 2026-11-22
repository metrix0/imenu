#!/bin/bash
set -euo pipefail
umask 077
root=/opt/imenu-migration
exec 9>"$root/backups/backup.lock"
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_window=$(TZ=America/Sao_Paulo date +%d-%H)
work=$(mktemp -d "$root/backups/.work.XXXXXX")
out=""
trap 'exit 143' TERM
trap 'exit 130' INT
trap 'rm -rf "$work"; [[ -z "$out" ]] || rm -f "$out.part"' EXIT
available=$(df --output=avail -B1 "$root" | tail -1)
((available > 10737418240)) || { echo BACKUP_INSUFFICIENT_DISK >&2; exit 1; }
docker exec supabase-db pg_dump -U supabase_admin -d postgres --format=custom > "$work/database.dump"
mkdir "$work/systemd"
cp /etc/systemd/system/imenu-*.service /etc/systemd/system/imenu-*.timer "$work/systemd/"
for dropin in /etc/systemd/system/imenu-*.service.d /etc/systemd/system/imenu-*.timer.d; do
  if [[ -d "$dropin" ]]; then cp -a "$dropin" "$work/systemd/"; fi
done
docker exec supabase-db pg_dumpall -U supabase_admin --globals-only > "$work/globals.sql"
kind=staging
if [[ -f "$root/ops/PRODUCTION_JOBS_ENABLED" ]]; then kind=production; fi
extras=()
if [[ -d "$root/tls" ]]; then extras+=(tls); fi
if [[ -d "$root/waha" ]]; then
  python3 "$root/ops/snapshot-waha.py" "$root/waha" "$work/waha"
  extras+=(-C "$work" waha)
fi
printf '{"created_at":"%s","kind":"%s","database":"postgres","consistency":"database snapshot; online WAHA SQLite snapshots; Storage and ops staged before archive"}\n' "$stamp" "$kind" > "$work/metadata.json"
# Stage mutable Storage separately so tar never archives files while they are changing.
storage="$root/supabase/docker/volumes/storage"
storage_snapshot="$work/supabase/docker/volumes/storage"
mkdir -p "$storage_snapshot"
for attempt in 1 2 3; do
  if rsync -aX --delete -- "$storage/" "$storage_snapshot/"; then
    break
  fi
  if (( attempt == 3 )); then echo STORAGE_SNAPSHOT_FAILED >&2; exit 1; fi
  sleep 2
done
# Ops includes files written by timers throughout the backup window.
ops_exclusions=(
  --exclude='/temp-*' --exclude='/preview-checkout' --exclude='/production-source'
  --exclude='/production-checkout' --exclude='/preview-deploy-state' --exclude='/production-deploy-state'
  --exclude='/preview-next-cache' --exclude='/production-next-cache'
  --exclude='/preview-releases' --exclude='/production-releases'
  --exclude='/deploy-upgrade-backup' --exclude='/release-assets' --exclude='/maintenance-before-*'
  --exclude='*.log' --exclude='/health.json' --exclude='/operational-alert-state.json'
  --exclude='*.lock' --exclude='/__pycache__'
)
mkdir "$work/ops"
for attempt in 1 2 3; do
  if rsync -aX --delete "${ops_exclusions[@]}" -- "$root/ops/" "$work/ops/"; then
    break
  fi
  if (( attempt == 3 )); then echo OPS_SNAPSHOT_FAILED >&2; exit 1; fi
  sleep 2
done
out="$root/backups/imenu-$stamp.enc"
set +e
LC_ALL=C tar --xattrs --xattrs-include='user.*' -czf - -C "$work" database.dump globals.sql metadata.json systemd ops \
 -C "$root" secrets supabase/docker/.env supabase/docker/docker-compose.imenu-stage.yml \
 supabase/docker/docker-compose.imenu-auth.json supabase/docker/docker-compose.imenu-ops.json supabase/docker/docker-compose.imenu-production.json \
 supabase/docker/volumes/functions "${extras[@]}" -C "$work" supabase/docker/volumes/storage 2>"$work/tar-warnings.log" \
 | python3 "$root/ops/encrypt_backup.py" "$root/secrets/backup-recipient.pub.pem" > "$out.part"
statuses=("${PIPESTATUS[@]}")
set -e
if [[ "${statuses[1]}" -ne 0 ]]; then echo BACKUP_ENCRYPTION_FAILED >&2; exit 1; fi
if [[ "${statuses[0]}" -ne 0 ]]; then
  cat "$work/tar-warnings.log" >&2
  echo BACKUP_ARCHIVE_FAILED >&2
  exit 1
fi
mv "$out.part" "$out"
sha256sum "$out" > "$out.sha256"
printf '%s\n' "$out" > "$root/backups/latest-encrypted"
python3 - "$root/backups" <<'PY'
import pathlib, sys
root=pathlib.Path(sys.argv[1])
for p in sorted(root.glob("imenu-????????T??????Z.enc"), reverse=True)[3:]:
 p.unlink();p.with_suffix(p.suffix+".sha256").unlink(missing_ok=True)
PY
if [[ "$backup_window" == 15-03 && -d "$work/waha/sessions" ]]; then
  # Reuse the WAHA snapshot; the encrypted archive's private key stays off-host.
  checkpoint="$work/waha-update"
  mkdir "$checkpoint"
  mv -- "$work/waha/compose.yml" "$work/waha/sessions" "$checkpoint/"
  mv -T -- "$checkpoint" "$root/backups/.waha-update-$stamp"
fi
echo "ENCRYPTED_BACKUP_READY $stamp"
