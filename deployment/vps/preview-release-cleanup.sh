#!/usr/bin/env bash
# Prune obsolete preview releases only; never touch production or live rollback.
set -Eeuo pipefail
umask 077
BASE=/opt/imenu-migration
STATE="$BASE/ops/preview-deploy-state"
RELEASES="$BASE/ops/preview-releases"

[[ $# -eq 0 || ( $# -eq 1 && ( "$1" == --dry-run || "$1" == --now || "$1" == --now-dry-run ) ) ]] || exit 2
[[ -d "$STATE" && -d "$RELEASES" ]] || { echo "Preview state/releases missing" >&2; exit 1; }

# Skip rather than race a preview deploy, download, upload, or shared build.
exec 9>"$STATE/deploy.lock"
flock -n 9 || { echo "Preview deployment active; cleanup deferred"; exit 0; }
exec 8>"$BASE/ops/application-build.lock"
flock -n 8 || { echo "Application build active; cleanup deferred"; exit 0; }
exec 7>"$STATE/upload.lock"
flock -n 7 || { echo "Preview upload active; cleanup deferred"; exit 0; }
exec 6>"$STATE/download.lock"
flock -n 6 || { echo "Preview download active; cleanup deferred"; exit 0; }

python3 - "$STATE" "$RELEASES" "${1:-}" <<'PY'
import pathlib
import re
import shutil
import sys
import time

state, root = map(pathlib.Path, sys.argv[1:3])
dry_run = sys.argv[3] in ("--dry-run", "--now-dry-run")
if root.is_symlink() or root.resolve() != pathlib.Path("/opt/imenu-migration/ops/preview-releases"):
    raise SystemExit("Unexpected preview releases path")
pattern = re.compile(re.escape(str(root)) + r"/([0-9a-f]{40})(?![0-9a-f])")
keep = set()
# Fail closed if either recovery pointer is missing or malformed.
for name in ("active-release.yml", "rollback-release.yml"):
    file = state / name
    if not file.is_file():
        raise SystemExit(f"Missing {name}; cleanup refused")
    matches = pattern.findall(file.read_text())
    if not matches:
        raise SystemExit(f"No preview release reference in {name}; cleanup refused")
    keep.update(matches)
# Also preserve any candidate/restoration references.
for file in state.glob("*.yml"):
    keep.update(pattern.findall(file.read_text()))
for name in ("deployed-sha", "rollback-sha"):
    file = state / name
    if file.is_file() and re.fullmatch(r"[0-9a-f]{40}", file.read_text().strip()):
        keep.add(file.read_text().strip())

cutoff = float("inf") if sys.argv[3] in ("--now", "--now-dry-run") else time.time() - 3 * 86400
removed = 0
for path in sorted(root.iterdir()):
    if path.is_symlink() or not path.is_dir() or not re.fullmatch(r"[0-9a-f]{40}", path.name):
        continue
    marker = path / ".imenu-commit-sha"
    if path.name in keep or path.stat().st_mtime >= cutoff or not marker.is_file():
        continue
    if marker.read_text().strip() != path.name:
        continue
    if dry_run:
        print(f"Would remove obsolete preview release: {path.name}")
    else:
        shutil.rmtree(path)
        print(f"Removed obsolete preview release: {path.name}")
    removed += 1
print(f"Preview release cleanup: {'would remove' if dry_run else 'removed'}={removed}; protected={len(keep)}")
PY
