"""Usage quotas and cost controls.

Rate limiting (Flask-Limiter) answers "how fast?". This answers "how much?" —
the questions are different and both matter:

  * Rate limits are per IP and reset constantly. They stop hammering, but a
    patient attacker on a residential IP can still burn a month of paid API
    credit a few calls at a time.
  * Quotas are per user per day and persist. They cap what one account can
    consume however slowly it goes about it.
  * The circuit breaker is global. If something goes wrong at 3am — a bug, a
    loop, a determined stranger — it stops spending before the bill does.

Counters live in SQLite rather than memory because the whole point is that
they survive a restart. An in-memory counter resets on every deploy, which is
exactly when you least want the limits to disappear.

COST NOTE: Tripo3D charges per generation. It is the only endpoint here that
spends money directly, and it is the one worth being strict about.
"""
import os
import sqlite3
from datetime import datetime, timezone


# Per-user, per-day allowances. Generous enough that a real person will not
# notice, low enough that an abusive account cannot do much damage.
QUOTAS = {
    "generate_3d":  int(os.getenv("QUOTA_GENERATE_3D", 5)),
    "vehicle_image": int(os.getenv("QUOTA_VEHICLE_IMAGE", 100)),
    "spec_lookup":  int(os.getenv("QUOTA_SPEC_LOOKUP", 200)),
    "upload":       int(os.getenv("QUOTA_UPLOAD", 50)),
    "gif_search":   int(os.getenv("QUOTA_GIF_SEARCH", 100)),
}

# Ceiling across every user combined. Protects the bill when the per-user
# limit is bypassed by simply making more accounts.
GLOBAL_DAILY = {
    "generate_3d":   int(os.getenv("GLOBAL_GENERATE_3D", 50)),
    "vehicle_image": int(os.getenv("GLOBAL_VEHICLE_IMAGE", 2000)),
    "spec_lookup":   int(os.getenv("GLOBAL_SPEC_LOOKUP", 2500)),
}

# Total bytes one account may store. The production disk is 10 GB shared
# between every user and the database.
STORAGE_QUOTA_BYTES = int(os.getenv("QUOTA_STORAGE_MB", 200)) * 1024 * 1024


def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def init_quota_tables(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS usage_quotas (
            user_id INTEGER NOT NULL,
            action  TEXT    NOT NULL,
            day     TEXT    NOT NULL,
            count   INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, action, day)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS usage_global (
            action TEXT NOT NULL,
            day    TEXT NOT NULL,
            count  INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (action, day)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_quota_day ON usage_quotas (day)")


def usage_today(conn, user_id, action):
    row = conn.execute(
        "SELECT count FROM usage_quotas WHERE user_id=? AND action=? AND day=?",
        (user_id, action, _today())).fetchone()
    return row[0] if row else 0


def global_today(conn, action):
    row = conn.execute(
        "SELECT count FROM usage_global WHERE action=? AND day=?",
        (action, _today())).fetchone()
    return row[0] if row else 0


def check_quota(conn, user_id, action):
    """Return None if allowed, or (message, status) describing the refusal.

    Checked BEFORE doing the work — the point is to not spend the money, so a
    check that runs afterwards is decoration.
    """
    limit = QUOTAS.get(action)
    if limit is not None and user_id:
        used = usage_today(conn, user_id, action)
        if used >= limit:
            return ({
                "error": "Daily limit reached",
                "detail": f"You've used your {limit} {action.replace('_', ' ')} "
                          f"allowance for today. It resets at midnight UTC.",
                "used": used, "limit": limit,
            }, 429)

    cap = GLOBAL_DAILY.get(action)
    if cap is not None and global_today(conn, action) >= cap:
        # Deliberately vague: a caller does not need to know they hit a global
        # ceiling rather than their own, and saying so invites probing.
        return ({
            "error": "Temporarily unavailable",
            "detail": "This feature is busy right now. Please try again later.",
        }, 503)

    return None


def record_usage(conn, user_id, action, amount=1):
    """Count a completed action. Call only after the work actually happened."""
    day = _today()
    if user_id:
        conn.execute("""
            INSERT INTO usage_quotas (user_id, action, day, count)
            VALUES (?,?,?,?)
            ON CONFLICT(user_id, action, day)
            DO UPDATE SET count = count + ?
        """, (user_id, action, day, amount, amount))
    conn.execute("""
        INSERT INTO usage_global (action, day, count)
        VALUES (?,?,?)
        ON CONFLICT(action, day) DO UPDATE SET count = count + ?
    """, (action, day, amount, amount))


def storage_used(conn, user_id, upload_folder):
    """Bytes on disk attributable to this user's rows.

    Walks the referenced filenames rather than the whole folder, so one user
    cannot be charged for another's files.
    """
    total = 0
    seen = set()
    queries = [
        ("SELECT avatar, cover_photo FROM users WHERE id=?", (user_id,)),
        ("SELECT image, video_url FROM posts WHERE username="
         "(SELECT username FROM users WHERE id=?)", (user_id,)),
        ("SELECT image, video_url FROM club_posts WHERE user_id=?", (user_id,)),
        ("SELECT image FROM garage WHERE user_id=?", (user_id,)),
        ("SELECT image FROM meets WHERE user_id=?", (user_id,)),
        ("SELECT image FROM stories WHERE user_id=?", (user_id,)),
    ]
    for sql, params in queries:
        try:
            rows = conn.execute(sql, params).fetchall()
        except sqlite3.Error:
            continue
        for row in rows:
            for value in row:
                if not value or not isinstance(value, str):
                    continue
                if value.startswith(("http://", "https://", "//", "data:")):
                    continue
                name = os.path.basename(value.split("?")[0])
                if not name or name in seen:
                    continue
                seen.add(name)
                try:
                    total += os.path.getsize(os.path.join(upload_folder, name))
                except OSError:
                    pass
    return total


def check_storage(conn, user_id, upload_folder, incoming_bytes=0):
    used = storage_used(conn, user_id, upload_folder)
    if used + incoming_bytes > STORAGE_QUOTA_BYTES:
        mb = STORAGE_QUOTA_BYTES // (1024 * 1024)
        return ({
            "error": "Storage limit reached",
            "detail": f"You've used your {mb} MB of storage. "
                      f"Delete some photos or videos to free up space.",
            "used_mb": round(used / 1024 / 1024, 1), "limit_mb": mb,
        }, 429)
    return None


def prune_old_usage(conn, keep_days=30):
    """Old counters are dead weight; nothing reads yesterday's numbers."""
    cutoff = datetime.now(timezone.utc).timestamp() - keep_days * 86400
    cutoff_day = datetime.fromtimestamp(cutoff, timezone.utc).strftime("%Y-%m-%d")
    conn.execute("DELETE FROM usage_quotas WHERE day < ?", (cutoff_day,))
    conn.execute("DELETE FROM usage_global WHERE day < ?", (cutoff_day,))
