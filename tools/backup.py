"""Back up the database (and optionally uploads) safely, while the app runs.

    python tools/backup.py                    # snapshot to ./backups
    python tools/backup.py --out /var/backups # somewhere else
    python tools/backup.py --uploads          # also tar the uploads folder
    python tools/backup.py --restore FILE     # restore a snapshot

Why not just copy the .db file
------------------------------
Copying a live SQLite file with `cp` can capture it mid-write and produce a
subtly corrupt backup — and with WAL enabled there are also -wal and -shm
sidecar files holding committed data that a plain copy would miss.

`VACUUM INTO` asks SQLite itself to write a clean, fully-checkpointed copy
while holding a read lock. The result is a single consistent file, already
compacted, with no sidecars. It is the supported way to snapshot a running
database.

A backup you have never restored is a hope, not a backup. --restore is here so
you can actually test it, and `--check` verifies a snapshot opens and passes an
integrity check before it is kept.
"""
import argparse
import os
import shutil
import sqlite3
import sys
import tarfile
from datetime import datetime, timezone

DEFAULT_DB = os.getenv("DB_PATH", "rideinsight.db")
DEFAULT_UPLOADS = os.getenv("UPLOAD_FOLDER", "static/uploads")
DEFAULT_OUT = "backups"
KEEP = 7  # snapshots to retain


def _stamp():
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def _human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def verify(path):
    """Open a snapshot and run PRAGMA integrity_check."""
    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            result = conn.execute("PRAGMA integrity_check").fetchone()[0]
            tables = conn.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table'"
            ).fetchone()[0]
        finally:
            conn.close()
    except sqlite3.Error as exc:
        return False, f"could not open: {exc}"
    if result != "ok":
        return False, f"integrity_check said: {result}"
    return True, f"ok, {tables} tables"


def backup(db, out_dir, with_uploads=False, uploads_dir=DEFAULT_UPLOADS):
    if not os.path.exists(db):
        sys.exit(f"No database at {db}")
    os.makedirs(out_dir, exist_ok=True)

    dest = os.path.join(out_dir, f"rideinsight-{_stamp()}.db")

    # VACUUM INTO refuses to overwrite, which is a feature — never clobber a
    # previous snapshot because of a timestamp collision.
    conn = sqlite3.connect(db)
    try:
        conn.execute("VACUUM INTO ?", (dest,))
    finally:
        conn.close()

    ok, detail = verify(dest)
    if not ok:
        os.remove(dest)
        sys.exit(f"Snapshot failed verification ({detail}) — removed. "
                 f"The live database may be damaged; investigate before relying on it.")

    print(f"  db      {dest}  {_human(os.path.getsize(dest))}  [{detail}]")

    if with_uploads and os.path.isdir(uploads_dir):
        tar_path = os.path.join(out_dir, f"uploads-{_stamp()}.tar.gz")
        with tarfile.open(tar_path, "w:gz") as tar:
            tar.add(uploads_dir, arcname="uploads")
        print(f"  uploads {tar_path}  {_human(os.path.getsize(tar_path))}")

    prune(out_dir)
    return dest


def prune(out_dir, keep=KEEP):
    """Keep the newest `keep` of each kind; delete the rest."""
    for prefix in ("rideinsight-", "uploads-"):
        files = sorted(
            (f for f in os.listdir(out_dir) if f.startswith(prefix)),
            reverse=True,
        )
        for stale in files[keep:]:
            os.remove(os.path.join(out_dir, stale))
            print(f"  pruned  {stale}")


def restore(snapshot, db):
    ok, detail = verify(snapshot)
    if not ok:
        sys.exit(f"Refusing to restore — snapshot is not valid ({detail})")

    if os.path.exists(db):
        # Never overwrite the live database without keeping what was there.
        safety = f"{db}.replaced-{_stamp()}"
        shutil.copy2(db, safety)
        print(f"  current database saved to {safety}")

    shutil.copy2(snapshot, db)
    # WAL sidecars belong to the replaced database; leaving them would let
    # SQLite apply stale journal contents over the restored file.
    for sidecar in (db + "-wal", db + "-shm"):
        if os.path.exists(sidecar):
            os.remove(sidecar)
            print(f"  removed stale {os.path.basename(sidecar)}")

    print(f"  restored {snapshot} -> {db}  [{detail}]")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--uploads", action="store_true",
                    help="also archive the uploads folder")
    ap.add_argument("--uploads-dir", default=DEFAULT_UPLOADS)
    ap.add_argument("--restore", metavar="SNAPSHOT")
    ap.add_argument("--check", metavar="SNAPSHOT",
                    help="verify a snapshot without restoring it")
    args = ap.parse_args()

    if args.check:
        ok, detail = verify(args.check)
        print(("OK   " if ok else "BAD  ") + args.check + f"  [{detail}]")
        sys.exit(0 if ok else 1)

    if args.restore:
        restore(args.restore, args.db)
        return

    print(f"Backing up {args.db}")
    backup(args.db, args.out, args.uploads, args.uploads_dir)


if __name__ == "__main__":
    main()
