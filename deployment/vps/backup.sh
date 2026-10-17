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
tar --xattrs --xattrs-include='user.*' --exclude='ops/temp-*' --exclude='ops/preview-checkout' --exclude='ops/production-source' --exclude='ops/production-checkout' --exclude='ops/preview-deploy-state/build.log' --exclude='ops/build.log' --exclude='ops/health.json' --exclude='ops/*.lock' --exclude='ops/__pycache__' -czf - -C "$work" database.dump globals.sql metadata.json systemd \
 -C "$root" secrets supabase/docker/.env supabase/docker/docker-compose.imenu-stage.yml \
 supabase/docker/docker-compose.imenu-auth.json supabase/docker/docker-compose.imenu-ops.json supabase/docker/docker-compose.imenu-production.json supabase/docker/volumes/storage \
 supabase/docker/volumes/functions ops "${extras[@]}" \
 | python3 "$root/ops/encrypt_backup.py" "$root/secrets/backup-recipient.pub.pem" > "$out.part"
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
