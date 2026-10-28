#!/usr/bin/env bash
# Keep live/container images and explicit application rollback tags; never prune volumes.
set -Eeuo pipefail
umask 077
BASE=/opt/imenu-migration
if [[ "${1:-}" == --build-lock-held ]]; then
    [[ "$(readlink /proc/self/fd/8)" == "$BASE/ops/application-build.lock" ]] || exit 2
    flock -n 8 || exit 75
else
    [[ "$#" -eq 0 ]] || exit 2
    exec 9>"$BASE/ops/application-build.lock"
    flock -n 9 || { echo "Build active; cleanup deferred"; exit 0; }
fi
# Avoid expensive Docker graph/cache scans when plenty of disk space is available.
# In particular, never prune merely because the 15-minute timer fired.
available="$(df --output=avail -B1 "$BASE" | tail -1)"
if (( available >= 42949672960 )); then
    echo "Docker cleanup skipped: at least 40 GiB available"
    exit 0
fi
python3 - <<'PY'
import json, subprocess
def run(*args):
    return subprocess.check_output(args, text=True).strip()
containers = run("docker", "ps", "-aq").split()
protected = set()
if containers:
    protected.update(c["Image"] for c in json.loads(run("docker", "inspect", *containers)))
for repository, tags in {
    "imenu-stage-app": ("latest", "rollback", "before-manual-rollback"),
    "imenu-production-app": ("final", "rollback"),
}.items():
    for tag in tags:
        p = subprocess.run(["docker", "image", "inspect", repository+":"+tag], capture_output=True, text=True)
        if p.returncode == 0:
            protected.add(json.loads(p.stdout)[0]["Id"])
for repository in ("imenu-stage-app", "imenu-production-app"):
    refs = run("docker", "image", "ls", repository, "--format", "{{.Repository}}:{{.Tag}}").splitlines()
    for ref in refs:
        if ref.endswith(":<none>"):
            continue
        image = json.loads(run("docker", "image", "inspect", ref))[0]
        if image["Id"] not in protected:
            subprocess.run(["docker", "image", "rm", ref], check=True)
PY
docker image prune --force
docker builder prune --all --force --max-used-space 8GB --min-free-space 40GB
df -h "$BASE"
