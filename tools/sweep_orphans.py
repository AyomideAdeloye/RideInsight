"""Find and remove uploaded files no database row points at.

    python tools/sweep_orphans.py            # report only, deletes nothing
    python tools/sweep_orphans.py --delete   # actually remove them

Until file deletion was wired into the delete routes, removing a post or an
account left its images on disk forever — still publicly fetchable by anyone
holding the URL. This clears that backlog. Going forward the app deletes files
as it deletes rows, so this should find little or nothing; it is worth running
occasionally anyway, since a failed request can still strand a file.

DEFAULTS TO A DRY RUN. Read the list before passing --delete.
"""
import argparse
import json
import os
import sqlite3
import sys

DB = os.getenv("DB_PATH", "rideinsight.db")
UPLOADS = os.getenv("UPLOAD_FOLDER", "static/uploads")

# Every column that can hold a path to a file we host. Miss one and this
# script will happily delete files that are still in use, so when a new
# upload-bearing column is added it must be added here too.
REFERENCING_COLUMNS = [
    ("users",            ["avatar", "cover_photo"]),
    ("posts",            ["image", "video_url"]),
    ("club_posts",       ["image", "video_url"]),
    ("clubs",            ["banner", "avatar"]),
    ("garage",           ["image"]),
    ("builds",           ["thumbnail"]),
    ("meets",            ["image"]),
    ("stories",          ["image"]),
    ("vehicle_photos",   ["image"]),
    ("generated_models", ["glb_url", "thumbnail_url"]),
]
JSON_ARRAY_COLUMNS = [("listings", "images")]

# Files that live in the uploads folder but are shipped with the app rather
# than uploaded by a user. Never delete these.
PROTECTED = set()


def referenced(conn):
    names = set()

    def note(value):
        if not value or not isinstance(value, str):
            return
        if value.startswith(("http://", "https://", "//", "data:")):
            return          # external, not ours to delete
        base = os.path.basename(value.split("?")[0].strip())
        if base:
            names.add(base)

    for table, cols in REFERENCING_COLUMNS:
        for col in cols:
            try:
                for (v,) in conn.execute(f"SELECT {col} FROM {table}"):
                    note(v)
            except sqlite3.Error:
                pass        # table or column absent on an older database

    for table, col in JSON_ARRAY_COLUMNS:
        try:
            for (v,) in conn.execute(f"SELECT {col} FROM {table}"):
                try:
                    for item in json.loads(v or "[]"):
                        note(item)
                except (ValueError, TypeError):
                    pass
        except sqlite3.Error:
            pass

    return names


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.0f}{unit}" if unit == "B" else f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--delete", action="store_true",
                    help="actually delete (default is a dry run)")
    ap.add_argument("--db", default=DB)
    ap.add_argument("--uploads", default=UPLOADS)
    args = ap.parse_args()

    if not os.path.isdir(args.uploads):
        sys.exit(f"No uploads folder at {args.uploads}")
    if not os.path.exists(args.db):
        sys.exit(f"No database at {args.db}")

    conn = sqlite3.connect(args.db)
    try:
        keep = referenced(conn)
    finally:
        conn.close()

    on_disk = {f for f in os.listdir(args.uploads)
               if os.path.isfile(os.path.join(args.uploads, f))}
    orphans = sorted(on_disk - keep - PROTECTED)

    print(f"database   : {args.db}")
    print(f"uploads    : {args.uploads}")
    print(f"on disk    : {len(on_disk)}")
    print(f"referenced : {len(on_disk & keep)}")
    print(f"orphaned   : {len(orphans)}\n")

    if not orphans:
        print("Nothing to do.")
        return

    total = 0
    for name in orphans:
        size = os.path.getsize(os.path.join(args.uploads, name))
        total += size
        print(f"  {human(size):>8}  {name}")
    print(f"\n  {human(total)} in {len(orphans)} files")

    if not args.delete:
        print("\nDry run — nothing deleted. Re-run with --delete once the list "
              "above looks right.")
        return

    removed = 0
    for name in orphans:
        try:
            os.remove(os.path.join(args.uploads, name))
            removed += 1
        except OSError as exc:
            print(f"  could not delete {name}: {exc}")
    print(f"\nDeleted {removed} files, freed {human(total)}.")


if __name__ == "__main__":
    main()
