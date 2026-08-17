"""
One-time cleanup: remove orphaned data inherited by TheBigBoss (user_id 2).

An old account with user_id 2 was deleted, but its garage/builds/races/badges
were never removed. SQLite reused id 2 for TheBigBoss, attaching all the old
data to the new account.

STOP the Flask server before running:  python cleanup_orphans.py
"""
import sqlite3

conn = sqlite3.connect("rideinsight.db")
conn.row_factory = sqlite3.Row

print("Before:")
for t in ["garage", "builds", "race_results", "user_badges"]:
    n = conn.execute(f"SELECT COUNT(*) c FROM {t} WHERE user_id=2").fetchone()["c"]
    print(f"  {t} rows for user 2: {n}")

conn.execute("DELETE FROM race_results WHERE user_id=2")
conn.execute("DELETE FROM builds WHERE user_id=2")
conn.execute("DELETE FROM garage WHERE user_id=2")
conn.execute("DELETE FROM user_badges WHERE user_id=2")
# mods attached to garage rows that no longer exist
conn.execute("DELETE FROM mods WHERE car_id NOT IN (SELECT id FROM garage)")
conn.commit()

print("\nAfter:")
for t in ["garage", "builds", "race_results", "user_badges"]:
    n = conn.execute(f"SELECT COUNT(*) c FROM {t} WHERE user_id=2").fetchone()["c"]
    print(f"  {t} rows for user 2: {n}")

conn.close()
print("\nDone. Restart the server and re-check TheBigBoss's profile/garage/leaderboard.")
