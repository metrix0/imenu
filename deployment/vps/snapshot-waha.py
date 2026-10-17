#!/usr/bin/env python3
"""Copy WAHA configuration and take online SQLite session snapshots."""
from contextlib import closing
import pathlib
import shutil
import sqlite3
import sys
import time

source, target = map(pathlib.Path, sys.argv[1:3])
def ignored(directory, names):
    return [name for name in names if name.endswith((".db", "-wal", "-shm"))
            or (pathlib.Path(directory) == source and name == "backups")]
shutil.copytree(source, target, ignore=ignored)
databases = 0
for path in source.rglob("*.db"):
    if "backups" in path.relative_to(source).parts:
        continue
    destination = target / path.relative_to(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    def progress(status, remaining, total):
        if time.monotonic() - started > 60:
            raise TimeoutError("WAHA session snapshot exceeded 60 seconds")
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=10)) as src:
        with closing(sqlite3.connect(destination)) as dst:
            # This disposable copy is verified before the encrypted archive is published.
            dst.execute("PRAGMA synchronous=OFF")
            src.backup(dst, pages=1024, progress=progress, sleep=0.05)
            dst.execute("PRAGMA journal_mode=DELETE")
            if dst.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise RuntimeError("WAHA session snapshot failed integrity check")
    shutil.copystat(path, destination)
    databases += 1
print("WAHA_SNAPSHOT_READY databases=" + str(databases))
