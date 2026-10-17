#!/bin/bash
set -euo pipefail
umask 077
root=/opt/imenu-migration
exec 9>"$root/backups/backup.lock"
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%dT%H%M%SZ)
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
printf '{"created_at":"%s","kind":"%s","database":"postgres","consistency":"database snapshot; online WAHA SQLite snapshots; storage copied during archive"}\n' "$stamp" "$kind" > "$work/metadata.json"
out="$root/backups/imenu-$stamp.enc"
set +e
LC_ALL=C tar --xattrs --xattrs-include='user.*' --exclude='ops/temp-*' --exclude='ops/preview-checkout' --exclude='ops/production-source' --exclude='ops/production-checkout' --exclude='ops/preview-deploy-state/build.log' --exclude='ops/build.log' --exclude='ops/health.json' --exclude='ops/*.lock' --exclude='ops/__pycache__' -czf - -C "$work" database.dump globals.sql metadata.json systemd \
 -C "$root" secrets supabase/docker/.env supabase/docker/docker-compose.imenu-stage.yml \
 supabase/docker/docker-compose.imenu-auth.json supabase/docker/docker-compose.imenu-ops.json supabase/docker/docker-compose.imenu-production.json supabase/docker/volumes/storage \
 supabase/docker/volumes/functions ops "${extras[@]}" 2>"$work/tar-warnings.log" \
 | python3 "$root/ops/encrypt_backup.py" "$root/secrets/backup-recipient.pub.pem" > "$out.part"
statuses=("${PIPESTATUS[@]}")
set -e
if [[ "${statuses[1]}" -ne 0 ]]; then echo BACKUP_ENCRYPTION_FAILED >&2; exit 1; fi
if [[ "${statuses[0]}" -eq 1 ]]; then
python3 - "$root" "$work/tar-warnings.log" <<'TAR_CHECK'
import pathlib,sys
root=pathlib.Path(sys.argv[1]).resolve()
storage=(root/"supabase/docker/volumes/storage").resolve()
messages=pathlib.Path(sys.argv[2]).read_text().splitlines()
if not messages:
    raise SystemExit("Tar reported a changed source without diagnostic details")
prefix="tar: "
suffix=": file changed as we read it"
for message in messages:
    if not message.startswith(prefix) or not message.endswith(suffix):
        raise SystemExit("Backup rejected an unexpected tar warning")
    name=message[len(prefix):-len(suffix)]
    path=(root/name).resolve()
    if not path.is_relative_to(storage) or not path.is_dir():
        raise SystemExit("Backup rejected a changed file or non-Storage source")
print("STORAGE_DIRECTORY_CHANGES_ACCEPTED count="+str(len(messages)))
TAR_CHECK
elif [[ "${statuses[0]}" -ne 0 ]]; then
  cat "$work/tar-warnings.log" >&2
  exit 1
fi
mv "$out.part" "$out"
sha256sum "$out" > "$out.sha256"
printf '%s\n' "$out" > "$root/backups/latest-encrypted"
python3 - "$root/backups" <<'PY'
import pathlib, sys
root=pathlib.Path(sys.argv[1])
for p in sorted(root.glob("imenu-????????T??????Z.enc"), reverse=True)[7:]:
 p.unlink();p.with_suffix(p.suffix+".sha256").unlink(missing_ok=True)
PY
echo "ENCRYPTED_BACKUP_READY $stamp"
