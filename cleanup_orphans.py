"""
One-time cleanup for orphaned data stranded on user_id 2.

History: in May, Aryoh_1 was user_id 2. fixusers.py later rebuilt accounts and
Aryoh_1 became user_id 1, but garage/builds/races still pointed at id 2.
TheBigBoss (created Aug 16) received id 2 and inherited all of it.

This script:
  - reassigns the May race history back to Aryoh_1 (user 1)
  - deletes the duplicate garage row and duplicate 'Big Boy' builds
  - clears TheBigBoss's wrongly-awarded badges

HOW TO RUN (important):
  1. STOP the Flask server (Ctrl+C in the terminal running it)
  2. python cleanup_orphans.py
  3. Restart the server
"""
import sqlite3

conn = sqlite3.connect("rideinsight.db")
conn.row_factory = sqlite3.Row

print("Before:")
for t in ["garage", "builds", "race_results", "user_badges"]:
    n = conn.execute(f"SELECT COUNT(*) c FROM {t} WHERE user_id=2").fetchone()["c"]
    print(f"  {t} rows on user 2: {n}")

# 1) Race history from May belongs to Aryoh_1 → give it back
conn.execute("UPDATE race_results SET user_id=1 WHERE user_id=2")

# 2) Duplicate 'Big Boy' builds (Aryoh already has copies as user 1) → delete
conn.execute("DELETE FROM builds WHERE user_id=2")

# 3) Duplicate Mazda garage row (owner literally says 'Aryoh_1') → delete
conn.execute("DELETE FROM mods WHERE car_id IN (SELECT id FROM garage WHERE user_id=2)")
conn.execute("DELETE FROM garage WHERE user_id=2")

# 4) TheBigBoss's badges were computed from the inherited data → clear
conn.execute("DELETE FROM user_badges WHERE user_id=2")

conn.commit()

print("\nAfter:")
for t in ["garage", "builds", "race_results", "user_badges"]:
    n = conn.execute(f"SELECT COUNT(*) c FROM {t} WHERE user_id=2").fetchone()["c"]
    print(f"  {t} rows on user 2: {n}")
n = conn.execute("SELECT COUNT(*) c FROM race_results WHERE user_id=1").fetchone()["c"]
print(f"  race_results now on Aryoh_1: {n}")

conn.close()
print("\nDone. Restart the server, then hard-refresh the leaderboard and profiles.")
