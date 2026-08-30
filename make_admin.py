"""Grant or revoke admin rights.

Admins can open /admin/photos to approve community photo submissions.

Usage:
    python make_admin.py                 # list users and who's an admin
    python make_admin.py Aryoh_1         # make Aryoh_1 an admin
    python make_admin.py Aryoh_1 --off   # revoke
"""
import sys
import sqlite3

DB = "rideinsight.db"


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    # The column only exists after the app has started once and run migrations.
    cols = [r[1] for r in conn.execute("PRAGMA table_info(users)")]
    if "is_admin" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
        conn.commit()
        print("Added the is_admin column.\n")

    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    turn_off = "--off" in sys.argv

    if not args:
        print(f"{'USER':<24} ADMIN")
        print("-" * 32)
        for r in conn.execute("SELECT username, is_admin FROM users ORDER BY id"):
            print(f"{r['username']:<24} {'yes' if r['is_admin'] else 'no'}")
        print("\nTo grant:  python make_admin.py <username>")
        conn.close()
        return

    username = args[0]
    row = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
    if not row:
        print(f"No user called '{username}'. Run with no arguments to list users.")
        conn.close()
        return

    conn.execute("UPDATE users SET is_admin=? WHERE username=?",
                 (0 if turn_off else 1, username))
    conn.commit()
    conn.close()

    if turn_off:
        print(f"{username} is no longer an admin.")
    else:
        print(f"{username} is now an admin.")
        print("Sign out and back in, then open Settings -> Help & Legal.")


if __name__ == "__main__":
    main()
