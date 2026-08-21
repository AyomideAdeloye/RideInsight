import os
import re
import sqlite3
import requests
import bleach
from datetime import datetime
from dotenv import load_dotenv

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-me-in-production")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = 86400 * 7  # 7 days

UPLOAD_FOLDER = "static/uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB for video
ALLOWED_EXTENSIONS       = {"png", "jpg", "jpeg", "gif", "webp"}
ALLOWED_VIDEO_EXTENSIONS = {"mp4", "mov", "webm"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ─── Security extensions ────────────────────────────────────────
csrf = CSRFProtect(app)

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=[],
    storage_uri="memory://"
)

DB_NAME = "rideinsight.db"

# ─── Badge Definitions ───────────────────────────────────────────
BADGES = {
    "first_post":    {"name": "First Post",     "icon": "🏎️", "color": "#2563eb", "desc": "Posted your first community update"},
    "gearhead":      {"name": "Gearhead",       "icon": "🔩", "color": "#7c3aed", "desc": "Reached 10 posts on the feed"},
    "first_build":   {"name": "First Build",    "icon": "🔧", "color": "#ea580c", "desc": "Saved your first custom build"},
    "speed_demon":   {"name": "Speed Demon",    "icon": "🏁", "color": "#16a34a", "desc": "Won your first race"},
    "race_champion": {"name": "Race Champion",  "icon": "🏆", "color": "#ca8a04", "desc": "Won 5 races"},
    "popular":       {"name": "Popular",        "icon": "❤️", "color": "#dc2626", "desc": "Received 50 total likes"},
    "legend":        {"name": "Legend",         "icon": "⭐", "color": "#d97706", "desc": "Received 200 total likes"},
    "collector":     {"name": "Collector",      "icon": "🗝️", "color": "#0891b2", "desc": "5 or more cars in the garage"},
    "influencer":    {"name": "Influencer",     "icon": "👥", "color": "#9333ea", "desc": "Gained 10 followers"},
    "poll_creator":  {"name": "Poll Creator",   "icon": "📊", "color": "#0284c7", "desc": "Created your first poll"},
    "meet_host":     {"name": "Meet Host",      "icon": "📍", "color": "#be185d", "desc": "Hosted your first car meet"},
    "storyteller":   {"name": "Storyteller",    "icon": "📸", "color": "#059669", "desc": "Posted your first story"},
}

def check_and_award_badges(conn, user_id):
    """Check which badges the user has earned and insert any new ones."""
    earned = set(r[0] for r in conn.execute(
        "SELECT badge_key FROM user_badges WHERE user_id=?", (user_id,)
    ).fetchall())

    def award(key):
        if key not in earned:
            conn.execute(
                "INSERT OR IGNORE INTO user_badges (user_id, badge_key, awarded_at) VALUES (?,?,?)",
                (user_id, key, datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
            )
            uname_row = conn.execute("SELECT username FROM users WHERE id=?", (user_id,)).fetchone()
            badge_link = f"/profile/{uname_row['username']}" if uname_row else ""
            add_notification(conn, user_id,
                f"🏅 New badge unlocked: {BADGES[key]['icon']} {BADGES[key]['name']} — {BADGES[key]['desc']}",
                link=badge_link)
            earned.add(key)

    # Post milestones
    post_count = conn.execute("SELECT COUNT(*) FROM posts WHERE username=(SELECT username FROM users WHERE id=?)", (user_id,)).fetchone()[0]
    if post_count >= 1:  award("first_post")
    if post_count >= 10: award("gearhead")

    # Likes received
    total_likes = conn.execute("""
        SELECT COALESCE(SUM(p.likes), 0) FROM posts p
        WHERE p.username=(SELECT username FROM users WHERE id=?)
    """, (user_id,)).fetchone()[0]
    if total_likes >= 50:  award("popular")
    if total_likes >= 200: award("legend")

    # Build milestone
    build_count = conn.execute("SELECT COUNT(*) FROM builds WHERE user_id=?", (user_id,)).fetchone()[0]
    if build_count >= 1: award("first_build")

    # Garage / collector
    car_count = conn.execute("SELECT COUNT(*) FROM garage WHERE user_id=?", (user_id,)).fetchone()[0]
    if car_count >= 5: award("collector")

    # Race wins
    win_count = conn.execute("SELECT COUNT(*) FROM race_results WHERE user_id=? AND won=1", (user_id,)).fetchone()[0]
    if win_count >= 1: award("speed_demon")
    if win_count >= 5: award("race_champion")

    # Followers
    follower_count = conn.execute("SELECT COUNT(*) FROM follows WHERE following_id=?", (user_id,)).fetchone()[0]
    if follower_count >= 10: award("influencer")

    # Poll created
    poll_count = conn.execute("""
        SELECT COUNT(*) FROM posts
        WHERE username=(SELECT username FROM users WHERE id=?) AND poll_question IS NOT NULL
    """, (user_id,)).fetchone()[0]
    if poll_count >= 1: award("poll_creator")

    # Meet hosted
    meet_count = conn.execute("SELECT COUNT(*) FROM meets WHERE user_id=?", (user_id,)).fetchone()[0]
    if meet_count >= 1: award("meet_host")

    # Story posted
    story_count = conn.execute("SELECT COUNT(*) FROM stories WHERE user_id=?", (user_id,)).fetchone()[0]
    if story_count >= 1: award("storyteller")

# ─── Global template context ────────────────────────────────────
@app.context_processor
def inject_globals():
    """Inject dark_mode and unread message count into every template."""
    dark_mode = 0
    unread_msgs = 0
    if "user_id" in session:
        try:
            conn = get_db_connection()
            user = conn.execute(
                "SELECT dark_mode FROM users WHERE id = ?", (session["user_id"],)
            ).fetchone()
            if user:
                dark_mode = user["dark_mode"] or 0
            unread_msgs = conn.execute(
                "SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND is_read = 0",
                (session["user_id"],)
            ).fetchone()[0]
            conn.close()
        except Exception:
            pass
    color_scheme = "blue"
    badge_count  = 0
    draft_count  = 0
    if "user_id" in session:
        try:
            conn2 = get_db_connection()
            u2 = conn2.execute("SELECT color_scheme FROM users WHERE id = ?", (session["user_id"],)).fetchone()
            if u2 and u2["color_scheme"]:
                color_scheme = u2["color_scheme"]
            badge_count = conn2.execute(
                "SELECT COUNT(*) FROM user_badges WHERE user_id=?", (session["user_id"],)
            ).fetchone()[0]
            try:
                draft_count = conn2.execute(
                    "SELECT COUNT(*) FROM drafts WHERE user_id=?", (session["user_id"],)
                ).fetchone()[0]
            except Exception:
                draft_count = 0
            conn2.close()
        except Exception:
            pass
    return {"dark_mode": dark_mode, "unread_msgs": unread_msgs,
            "color_scheme": color_scheme, "badge_count": badge_count,
            "draft_count": draft_count, "ALL_BADGES": BADGES}


ALLOWED_TAGS = []  # strip all HTML from user text
ALLOWED_ATTRS = {}

def sanitize(text):
    """Strip all HTML tags from user-supplied text."""
    if not text:
        return ""
    return bleach.clean(str(text), tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True).strip()

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_video(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS

def save_upload(file_field):
    """Save an uploaded file and return its URL path, or empty string."""
    if file_field not in request.files:
        return ""
    f = request.files[file_field]
    if f.filename == "":
        return ""
    checker = allowed_video if file_field == "video" else allowed_file
    if not checker(f.filename):
        return ""
    filename = secure_filename(f.filename)
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    f.save(path)
    return "/" + path.replace("\\", "/")

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def add_notification(conn, user_id, text, link=""):
    """Insert a notification row for the given user, with optional click-through link."""
    conn.execute(
        "INSERT INTO notifications (user_id, text, created_at, link) VALUES (?, ?, ?, ?)",
        (user_id, text, datetime.utcnow().strftime("%Y-%m-%d %H:%M"), link)
    )

def time_ago(dt_str):
    """Very simple relative time from a stored datetime string."""
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
        delta = datetime.utcnow() - dt
        s = delta.total_seconds()
        if s < 60: return "just now"
        if s < 3600: return f"{int(s//60)}m ago"
        if s < 86400: return f"{int(s//3600)}h ago"
        return f"{int(s//86400)}d ago"
    except Exception:
        return dt_str or "some time ago"

# ─── DB Init ─────────────────────────────────────────────────────
def init_db():
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT DEFAULT '',
            cover_photo TEXT DEFAULT '',
            is_private INTEGER DEFAULT 0,
            dm_permission TEXT DEFAULT 'everyone',
            email_notifications INTEGER DEFAULT 1,
            inapp_notifications INTEGER DEFAULT 1,
            dark_mode INTEGER DEFAULT 0,
            color_scheme TEXT DEFAULT 'blue',
            main_car TEXT DEFAULT '',
            secondary_car TEXT DEFAULT ''
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            car TEXT,
            created_at TEXT,
            title TEXT,
            body TEXT,
            likes INTEGER DEFAULT 0,
            dislikes INTEGER DEFAULT 0,
            image TEXT,
            gif_url TEXT,
            video_url TEXT,
            link_url TEXT,
            link_title TEXT,
            link_image TEXT,
            link_description TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS dislikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            UNIQUE(user_id, post_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS garage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            owner TEXT,
            year TEXT,
            make TEXT,
            model TEXT,
            trim TEXT,
            image TEXT,
            notes TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS mods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            car_id INTEGER,
            name TEXT,
            cost REAL,
            category TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER,
            parent_id INTEGER DEFAULT NULL,
            username TEXT,
            body TEXT,
            likes INTEGER DEFAULT 0,
            dislikes INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS comment_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            comment_id INTEGER,
            UNIQUE(user_id, comment_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS comment_dislikes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            comment_id INTEGER,
            UNIQUE(user_id, comment_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS comparisons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            car1 TEXT,
            car2 TEXT,
            intent TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            UNIQUE(user_id, post_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS follows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            follower_id INTEGER,
            following_id INTEGER,
            UNIQUE(follower_id, following_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS builds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT,
            base_year TEXT,
            base_make TEXT,
            base_model TEXT,
            base_trim TEXT,
            base_price REAL DEFAULT 0,
            parts_json TEXT,
            car_color TEXT DEFAULT '#1f4ed8'
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            text TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS race_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            mode TEXT,
            player_build TEXT,
            opp_build TEXT,
            won INTEGER,
            time TEXT,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS generated_models (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cache_key TEXT UNIQUE,
            task_id TEXT,
            glb_url TEXT,
            thumbnail_url TEXT,
            created_at TEXT
        )
    """)

    try:
        conn.execute("ALTER TABLE generated_models ADD COLUMN task_id TEXT")
    except Exception:
        pass

    conn.execute("""
        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            condition TEXT DEFAULT 'used',
            price REAL NOT NULL,
            location TEXT,
            lat REAL,
            lng REAL,
            images TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS listing_saves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            listing_id INTEGER,
            UNIQUE(user_id, listing_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS clubs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            description TEXT,
            banner TEXT,
            avatar TEXT,
            make TEXT,
            is_auto INTEGER DEFAULT 0,
            created_by INTEGER,
            member_count INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS club_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            club_id INTEGER,
            user_id INTEGER,
            role TEXT DEFAULT 'member',
            joined_at TEXT,
            UNIQUE(club_id, user_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS club_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            club_id INTEGER,
            user_id INTEGER,
            username TEXT,
            title TEXT,
            body TEXT,
            image TEXT,
            gif_url TEXT,
            video_url TEXT,
            link_url TEXT,
            link_title TEXT,
            link_image TEXT,
            likes INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS club_post_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            UNIQUE(user_id, post_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            body TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS saved_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            post_id INTEGER,
            created_at TEXT,
            UNIQUE(user_id, post_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS poll_votes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            option_index INTEGER NOT NULL,
            UNIQUE(post_id, user_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS stories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            content TEXT DEFAULT '',
            image TEXT DEFAULT '',
            created_at TEXT,
            expires_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS story_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            story_id INTEGER NOT NULL,
            viewer_id INTEGER NOT NULL,
            UNIQUE(story_id, viewer_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS meets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            location TEXT DEFAULT '',
            meet_date TEXT DEFAULT '',
            meet_time TEXT DEFAULT '',
            image TEXT DEFAULT '',
            created_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS meet_rsvps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            meet_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            UNIQUE(meet_id, user_id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_badges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            badge_key TEXT NOT NULL,
            awarded_at TEXT,
            UNIQUE(user_id, badge_key)
        )
    """)

    # Migrate: add bio column
    try:
        conn.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
    except Exception:
        pass

    # Migrate: add new user settings columns if they don't exist
    for col, coltype, default in [
        ("is_private",          "INTEGER", "0"),
        ("dm_permission",       "TEXT",    "'everyone'"),
        ("email_notifications", "INTEGER", "1"),
        ("inapp_notifications", "INTEGER", "1"),
        ("dark_mode",           "INTEGER", "0"),
        ("main_car",            "TEXT",    "''"),
        ("secondary_car",       "TEXT",    "''"),
    ]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {coltype} DEFAULT {default}")
        except Exception:
            pass

    for col in ["gif_url TEXT", "video_url TEXT", "link_url TEXT", "link_title TEXT", "link_image TEXT", "link_description TEXT"]:
        try:
            conn.execute(f"ALTER TABLE posts ADD COLUMN {col}")
        except Exception:
            pass

    try:
        conn.execute("ALTER TABLE posts ADD COLUMN dislikes INTEGER DEFAULT 0")
    except Exception:
        pass

    for col in [("comments","parent_id","INTEGER"), ("comments","likes","INTEGER"), ("comments","dislikes","INTEGER"), ("comments","created_at","TEXT")]:
        try:
            conn.execute(f"ALTER TABLE {col[0]} ADD COLUMN {col[1]} {col[2]}")
        except Exception:
            pass

    # Migrate: add car_color column if it doesn't exist yet
    try:
        conn.execute("ALTER TABLE builds ADD COLUMN car_color TEXT DEFAULT '#1f4ed8'")
    except Exception:
        pass

    # Migrate: add avatar column if it doesn't exist yet
    try:
        conn.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT ''")
    except Exception:
        pass  # column already exists

    # Migrate: add cover_photo column if it doesn't exist yet
    try:
        conn.execute("ALTER TABLE users ADD COLUMN cover_photo TEXT DEFAULT ''")
    except Exception:
        pass

    # Migrate: add color_scheme column if it doesn't exist yet
    try:
        conn.execute("ALTER TABLE users ADD COLUMN color_scheme TEXT DEFAULT 'blue'")
    except Exception:
        pass

    # Migrate: add created_at to mods for timeline
    try:
        conn.execute("ALTER TABLE mods ADD COLUMN created_at TEXT DEFAULT ''")
    except Exception:
        pass

    # Migrate: add poll columns to posts
    for col in ["poll_question TEXT", "poll_options TEXT"]:
        try:
            conn.execute(f"ALTER TABLE posts ADD COLUMN {col}")
        except Exception:
            pass

    # Drafts: unposted composer content
    conn.execute("""
        CREATE TABLE IF NOT EXISTS drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT DEFAULT '',
            body TEXT DEFAULT '',
            car TEXT DEFAULT '',
            gif_url TEXT DEFAULT '',
            link_url TEXT DEFAULT '',
            updated_at TEXT DEFAULT ''
        )
    """)

    # Migrate: social media links on profiles
    for col in ["social_instagram", "social_tiktok", "social_youtube",
                "social_x", "social_website"]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} TEXT DEFAULT ''")
        except Exception:
            pass

    # Migrate: remember vehicle type on saved comparisons (car/motorcycle/boat)
    try:
        conn.execute("ALTER TABLE comparisons ADD COLUMN vehicle_type TEXT DEFAULT 'car'")
    except Exception:
        pass

    # Migrate: add link to notifications (clickable notifications)
    try:
        conn.execute("ALTER TABLE notifications ADD COLUMN link TEXT DEFAULT ''")
    except Exception:
        pass

    # Backfill links on old notifications where the target is parseable from text
    try:
        rows = conn.execute(
            "SELECT id, text FROM notifications WHERE link IS NULL OR link = ''"
        ).fetchall()
        for r in rows:
            text, link = r["text"], ""
            if " started following you" in text and text.startswith("@"):
                link = f"/profile/{text.split(' ')[0].lstrip('@')}"
            elif " sent you a message" in text and text.startswith("💬 "):
                link = f"/messages/{text.replace('💬 ', '').split(' ')[0]}"
            if link:
                conn.execute("UPDATE notifications SET link=? WHERE id=?", (link, r["id"]))
    except Exception:
        pass

    # Seed sample posts if empty
    existing = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    if existing == 0:
        sample_posts = [
            ("MazdaOwner", "2018 Mazda 6 Touring", "2024-01-01 10:00",
             "Worth modding or upgrading?",
             "I love the reliability, but the infotainment system has been giving me problems.", 12,
             "https://upload.wikimedia.org/wikipedia/commons/7/7f/2018_Mazda6_Sport_NAV_2.5_Front.jpg"),
            ("CarTalkDaily", "2020 Honda Civic Sport", "2024-01-01 08:00",
             "Best first project car under $8,000?",
             "Looking for something reliable, fun, and easy to work on.", 34,
             "https://upload.wikimedia.org/wikipedia/commons/2/27/2020_Honda_Civic_Sport_front_3.29.20.jpg"),
            ("BikeGuy", "Yamaha R6", "2024-01-01 06:00",
             "Motorcycle vs used sports car?",
             "Trying to compare cost, maintenance, insurance, and fun factor.", 21,
             "https://upload.wikimedia.org/wikipedia/commons/0/06/Yamaha_YZF-R6.jpg"),
        ]
        conn.executemany("""
            INSERT INTO posts (username, car, created_at, title, body, likes, image)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, sample_posts)

    conn.commit()
    conn.close()

# ─── Routes ──────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")

# Posts
@app.route("/post/<int:post_id>")
def post_permalink(post_id):
    conn = get_db_connection()
    post = conn.execute("SELECT id FROM posts WHERE id=?", (post_id,)).fetchone()
    conn.close()
    if not post:
        return render_template("error.html"), 404
    return render_template("post_detail.html", post_id=post_id)

@app.route("/get_posts")
def get_posts():
    query = sanitize(request.args.get("q", ""))
    uid   = session.get("user_id")
    conn  = get_db_connection()
    if query:
        rows = conn.execute("""
            SELECT p.*, u.main_car, u.avatar,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) as user_liked,
                (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id AND d.user_id = ?) as user_disliked
            FROM posts p
            LEFT JOIN users u ON u.username = p.username
            WHERE p.title LIKE ? OR p.body LIKE ? OR p.car LIKE ? OR p.username LIKE ?
            ORDER BY p.id DESC
        """, (uid, uid, f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%")).fetchall()
    else:
        rows = conn.execute("""
            SELECT p.*, u.main_car, u.avatar,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) as user_liked,
                (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id AND d.user_id = ?) as user_disliked
            FROM posts p
            LEFT JOIN users u ON u.username = p.username
            ORDER BY p.id DESC
        """, (uid, uid)).fetchall()
    conn.close()

    import json as _json_posts
    def enrich_post(p):
        d = {**dict(p), "time": time_ago(p["created_at"])}
        # Attach per-option vote counts and user's vote for polls
        if d.get("poll_options"):
            try:
                opts = _json_posts.loads(d["poll_options"])
                vote_counts = []
                total = 0
                for i in range(len(opts)):
                    cnt = conn2.execute(
                        "SELECT COUNT(*) FROM poll_votes WHERE post_id=? AND option_index=?",
                        (d["id"], i)
                    ).fetchone()[0] if False else 0  # conn closed; handled below
                    vote_counts.append(cnt)
                    total += cnt
                d["poll_vote_counts"] = vote_counts
                d["poll_total_votes"] = total
                d["poll_user_vote"] = None
            except Exception:
                pass
        return d

    # Re-open briefly to fetch poll votes
    conn2 = get_db_connection()
    result = []
    for p in rows:
        d = {**dict(p), "time": time_ago(p["created_at"])}
        if d.get("poll_options"):
            try:
                opts = _json_posts.loads(d["poll_options"])
                counts = []
                total = 0
                for i in range(len(opts)):
                    cnt = conn2.execute(
                        "SELECT COUNT(*) FROM poll_votes WHERE post_id=? AND option_index=?",
                        (d["id"], i)
                    ).fetchone()[0]
                    counts.append(cnt)
                    total += cnt
                user_vote_row = conn2.execute(
                    "SELECT option_index FROM poll_votes WHERE post_id=? AND user_id=?",
                    (d["id"], uid)
                ).fetchone()
                d["poll_vote_counts"] = counts
                d["poll_total_votes"] = total
                d["poll_user_vote"] = user_vote_row["option_index"] if user_vote_row else None
            except Exception:
                pass
        result.append(d)
    conn2.close()
    return jsonify(result)

@csrf.exempt
@app.route("/add_post", methods=["POST"])
def add_post():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    car             = sanitize(request.form.get("car", ""))
    title           = sanitize(request.form.get("title", ""))
    body            = sanitize(request.form.get("body", ""))
    gif_url         = sanitize(request.form.get("gif_url", ""))
    video_url       = sanitize(request.form.get("video_url", ""))
    link_url        = sanitize(request.form.get("link_url", ""))
    link_title      = sanitize(request.form.get("link_title", ""))
    link_image      = sanitize(request.form.get("link_image", ""))
    link_description= sanitize(request.form.get("link_description", ""))
    poll_question   = sanitize(request.form.get("poll_question", ""))
    poll_options_raw= request.form.get("poll_options", "")

    if not title or not body:
        return jsonify({"error": "Title and body required"}), 400

    # Validate poll if provided
    poll_options_json = None
    if poll_question and poll_options_raw:
        import json as _j
        try:
            opts = [sanitize(o) for o in _j.loads(poll_options_raw) if o.strip()]
            if len(opts) < 2:
                return jsonify({"error": "Poll needs at least 2 options"}), 400
            poll_options_json = _j.dumps(opts)
        except Exception:
            return jsonify({"error": "Invalid poll options"}), 400

    image_path  = save_upload("image")
    video_path  = save_upload("video") if not video_url else None

    conn = get_db_connection()
    conn.execute("""
        INSERT INTO posts (username, car, title, body, image, gif_url, video_url, link_url, link_title, link_image, link_description, likes, dislikes, created_at, poll_question, poll_options)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?)
    """, (session["username"], car, title, body,
          image_path, gif_url, video_path or video_url,
          link_url, link_title, link_image, link_description,
          datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
          poll_question or None, poll_options_json))
    conn.commit()
    try:
        check_and_award_badges(conn, session["user_id"])
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"message": "Post added"})

@csrf.exempt
@app.route("/api/vote_poll/<int:post_id>", methods=["POST"])
def vote_poll(post_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data = request.json or {}
    try:
        option_index = int(data.get("option_index", -1))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid option"}), 400

    conn = get_db_connection()
    post = conn.execute("SELECT poll_options FROM posts WHERE id=?", (post_id,)).fetchone()
    if not post or not post["poll_options"]:
        conn.close()
        return jsonify({"error": "No poll on this post"}), 404

    import json as _j
    opts = _j.loads(post["poll_options"])
    if option_index < 0 or option_index >= len(opts):
        conn.close()
        return jsonify({"error": "Invalid option index"}), 400

    # Upsert vote (allow changing vote)
    existing = conn.execute(
        "SELECT id FROM poll_votes WHERE post_id=? AND user_id=?",
        (post_id, session["user_id"])
    ).fetchone()
    if existing:
        conn.execute("UPDATE poll_votes SET option_index=? WHERE id=?", (option_index, existing["id"]))
    else:
        conn.execute("INSERT INTO poll_votes (post_id, user_id, option_index) VALUES (?,?,?)",
                     (post_id, session["user_id"], option_index))
    conn.commit()

    # Return updated counts
    counts = []
    total = 0
    for i in range(len(opts)):
        cnt = conn.execute(
            "SELECT COUNT(*) FROM poll_votes WHERE post_id=? AND option_index=?",
            (post_id, i)
        ).fetchone()[0]
        counts.append(cnt)
        total += cnt
    conn.close()
    return jsonify({"vote_counts": counts, "total_votes": total, "user_vote": option_index})

@csrf.exempt
@app.route("/like_post/<int:post_id>", methods=["POST"])
def like_post(post_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM likes WHERE user_id=? AND post_id=?",
        (session["user_id"], post_id)
    ).fetchone()
    if existing:
        # Toggle off — unlike
        conn.execute("DELETE FROM likes WHERE id=?", (existing["id"],))
        conn.execute("UPDATE posts SET likes = MAX(0, likes - 1) WHERE id=?", (post_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Like removed", "liked": False})
    # Remove dislike if exists
    conn.execute("DELETE FROM dislikes WHERE user_id=? AND post_id=?", (session["user_id"], post_id))
    conn.execute("UPDATE posts SET dislikes = MAX(0, dislikes - 1) WHERE id=?", (post_id,))
    # Add like
    conn.execute("INSERT INTO likes (user_id, post_id) VALUES (?,?)",
                 (session["user_id"], post_id))
    conn.execute("UPDATE posts SET likes = likes + 1 WHERE id=?", (post_id,))
    # notify post author
    post = conn.execute("SELECT username FROM posts WHERE id=?", (post_id,)).fetchone()
    if post:
        author = conn.execute("SELECT id FROM users WHERE username=?",
                              (post["username"],)).fetchone()
        if author and author["id"] != session["user_id"]:
            add_notification(conn, author["id"],
                             f"@{session['username']} liked your post.",
                             link=f"/post/{post_id}")
            try:
                check_and_award_badges(conn, author["id"])
            except Exception:
                pass
    conn.commit()
    conn.close()
    return jsonify({"message": "Post liked", "liked": True})

@csrf.exempt
@app.route("/dislike_post/<int:post_id>", methods=["POST"])
def dislike_post(post_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM dislikes WHERE user_id=? AND post_id=?",
        (session["user_id"], post_id)
    ).fetchone()
    if existing:
        # Toggle off dislike
        conn.execute("DELETE FROM dislikes WHERE id=?", (existing["id"],))
        conn.execute("UPDATE posts SET dislikes = MAX(0, dislikes - 1) WHERE id=?", (post_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Dislike removed", "disliked": False})
    # Remove like if exists
    conn.execute("DELETE FROM likes WHERE user_id=? AND post_id=?", (session["user_id"], post_id))
    conn.execute("UPDATE posts SET likes = MAX(0, likes - 1) WHERE id=?", (post_id,))
    conn.execute("INSERT INTO dislikes (user_id, post_id) VALUES (?,?)",
                 (session["user_id"], post_id))
    conn.execute("UPDATE posts SET dislikes = dislikes + 1 WHERE id=?", (post_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Post disliked", "disliked": True})

@app.route("/get_post_counts/<int:post_id>")
def get_post_counts(post_id):
    uid  = session.get("user_id")
    conn = get_db_connection()
    row  = conn.execute("""
        SELECT p.likes, p.dislikes,
            (SELECT COUNT(*) FROM likes    WHERE post_id=? AND user_id=?) as user_liked,
            (SELECT COUNT(*) FROM dislikes WHERE post_id=? AND user_id=?) as user_disliked
        FROM posts p WHERE p.id=?
    """, (post_id, uid, post_id, uid, post_id)).fetchone()
    conn.close()
    if not row:
        return jsonify({"likes": 0, "dislikes": 0, "user_liked": 0, "user_disliked": 0})
    return jsonify(dict(row))

@app.route("/get_comment_count/<int:post_id>")
def get_comment_count(post_id):
    conn  = get_db_connection()
    count = conn.execute(
        "SELECT COUNT(*) FROM comments WHERE post_id = ?", (post_id,)
    ).fetchone()[0]
    conn.close()
    return jsonify({"count": count})

# Comments
@app.route("/get_comments/<int:post_id>")
def get_comments(post_id):
    uid  = session.get("user_id")
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT c.id, c.post_id, c.parent_id, c.username, c.body, c.created_at,
            COALESCE(c.likes, 0) as likes,
            COALESCE(c.dislikes, 0) as dislikes,
            u.main_car, u.avatar,
            (SELECT COUNT(*) FROM comment_likes    cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as user_liked,
            (SELECT COUNT(*) FROM comment_dislikes cd WHERE cd.comment_id = c.id AND cd.user_id = ?) as user_disliked,
            (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) as reply_count
        FROM comments c
        LEFT JOIN users u ON u.username = c.username
        WHERE c.post_id = ? AND c.parent_id IS NULL
        ORDER BY c.id ASC
    """, (uid, uid, post_id)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/get_replies/<int:comment_id>")
def get_replies(comment_id):
    uid  = session.get("user_id")
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT c.id, c.post_id, c.parent_id, c.username, c.body, c.created_at,
            COALESCE(c.likes, 0) as likes,
            COALESCE(c.dislikes, 0) as dislikes,
            u.main_car, u.avatar,
            (SELECT COUNT(*) FROM comment_likes    cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as user_liked,
            (SELECT COUNT(*) FROM comment_dislikes cd WHERE cd.comment_id = c.id AND cd.user_id = ?) as user_disliked
        FROM comments c
        LEFT JOIN users u ON u.username = c.username
        WHERE c.parent_id = ?
        ORDER BY c.id ASC
    """, (uid, uid, comment_id)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/get_comment_counts/<int:comment_id>")
def get_comment_counts(comment_id):
    uid  = session.get("user_id")
    conn = get_db_connection()
    row  = conn.execute("""
        SELECT
            COALESCE(c.likes, 0) as likes,
            COALESCE(c.dislikes, 0) as dislikes,
            (SELECT COUNT(*) FROM comment_likes    WHERE comment_id=? AND user_id=?) as user_liked,
            (SELECT COUNT(*) FROM comment_dislikes WHERE comment_id=? AND user_id=?) as user_disliked
        FROM comments c WHERE c.id=?
    """, (comment_id, uid, comment_id, uid, comment_id)).fetchone()
    conn.close()
    if not row:
        return jsonify({"likes": 0, "dislikes": 0, "user_liked": 0, "user_disliked": 0})
    return jsonify(dict(row))

@csrf.exempt
@app.route("/like_comment/<int:comment_id>", methods=["POST"])
def like_comment(comment_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM comment_likes WHERE user_id=? AND comment_id=?",
        (session["user_id"], comment_id)
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM comment_likes WHERE id=?", (existing["id"],))
        conn.execute("UPDATE comments SET likes = MAX(0, COALESCE(likes,0)-1) WHERE id=?", (comment_id,))
        conn.commit(); conn.close()
        return jsonify({"liked": False})
    conn.execute("DELETE FROM comment_dislikes WHERE user_id=? AND comment_id=?", (session["user_id"], comment_id))
    conn.execute("UPDATE comments SET dislikes = MAX(0, COALESCE(dislikes,0)-1) WHERE id=?", (comment_id,))
    conn.execute("INSERT INTO comment_likes (user_id, comment_id) VALUES (?,?)", (session["user_id"], comment_id))
    conn.execute("UPDATE comments SET likes = COALESCE(likes,0)+1 WHERE id=?", (comment_id,))
    conn.commit(); conn.close()
    return jsonify({"liked": True})

@csrf.exempt
@app.route("/dislike_comment/<int:comment_id>", methods=["POST"])
def dislike_comment(comment_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM comment_dislikes WHERE user_id=? AND comment_id=?",
        (session["user_id"], comment_id)
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM comment_dislikes WHERE id=?", (existing["id"],))
        conn.execute("UPDATE comments SET dislikes = MAX(0, COALESCE(dislikes,0)-1) WHERE id=?", (comment_id,))
        conn.commit(); conn.close()
        return jsonify({"disliked": False})
    conn.execute("DELETE FROM comment_likes WHERE user_id=? AND comment_id=?", (session["user_id"], comment_id))
    conn.execute("UPDATE comments SET likes = MAX(0, COALESCE(likes,0)-1) WHERE id=?", (comment_id,))
    conn.execute("INSERT INTO comment_dislikes (user_id, comment_id) VALUES (?,?)", (session["user_id"], comment_id))
    conn.execute("UPDATE comments SET dislikes = COALESCE(dislikes,0)+1 WHERE id=?", (comment_id,))
    conn.commit(); conn.close()
    return jsonify({"disliked": True})

@csrf.exempt
@app.route("/add_comment", methods=["POST"])
def add_comment():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data      = request.json
    body      = sanitize(data.get("body", ""))
    if not body:
        return jsonify({"error": "Comment cannot be empty"}), 400
    post_id   = int(data.get("post_id", 0))
    parent_id = data.get("parent_id")  # None for top-level, int for reply
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO comments (post_id, parent_id, username, body, likes, dislikes, created_at) VALUES (?,?,?,?,0,0,?)",
        (post_id, parent_id, session["username"], body, datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
    )
    post = conn.execute("SELECT username FROM posts WHERE id=?", (post_id,)).fetchone()
    if post:
        author = conn.execute("SELECT id FROM users WHERE username=?",
                              (post["username"],)).fetchone()
        if author and author["id"] != session["user_id"]:
            add_notification(conn, author["id"],
                             f"@{session['username']} commented on your post.",
                             link=f"/post/{post_id}")
    conn.commit()
    conn.close()
    return jsonify({"message": "Comment added"})

# Search
@app.route("/search")
def search_page():
    return render_template("search.html")

@app.route("/api/explore")
def explore():
    """Search posts with filters: q, make, vehicle_type, hashtag, sort"""
    q            = sanitize(request.args.get("q", ""))
    make         = sanitize(request.args.get("make", ""))
    vehicle_type = sanitize(request.args.get("type", ""))
    hashtag      = sanitize(request.args.get("hashtag", "").lstrip("#"))
    sort         = sanitize(request.args.get("sort", "recent"))  # recent | popular
    uid          = session.get("user_id")

    conn = get_db_connection()

    conditions = []
    params     = [uid, uid]

    if q:
        conditions.append("(p.title LIKE ? OR p.body LIKE ? OR p.username LIKE ?)")
        params += [f"%{q}%", f"%{q}%", f"%{q}%"]
    if make:
        conditions.append("(p.car LIKE ? OR p.body LIKE ? OR p.title LIKE ?)")
        params += [f"%{make}%", f"%{make}%", f"%{make}%"]
    if hashtag:
        conditions.append("(p.title LIKE ? OR p.body LIKE ?)")
        params += [f"%#{hashtag}%", f"%#{hashtag}%"]

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    order = "ORDER BY (p.likes + p.dislikes) DESC, p.id DESC" if sort == "popular" else "ORDER BY p.id DESC"

    rows = conn.execute(f"""
        SELECT p.*, u.main_car, u.avatar,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
            (SELECT COUNT(*) FROM likes    l WHERE l.post_id = p.id AND l.user_id = ?) as user_liked,
            (SELECT COUNT(*) FROM dislikes d WHERE d.post_id = p.id AND d.user_id = ?) as user_disliked
        FROM posts p
        LEFT JOIN users u ON u.username = p.username
        {where}
        {order}
        LIMIT 50
    """, params).fetchall()
    conn.close()
    return jsonify([{**dict(r), "time": time_ago(r["created_at"])} for r in rows])

@app.route("/api/trending_hashtags")
def trending_hashtags():
    """Extract and count hashtags from recent posts."""
    import re
    conn  = get_db_connection()
    posts = conn.execute(
        "SELECT title, body FROM posts ORDER BY id DESC LIMIT 200"
    ).fetchall()
    conn.close()

    counts = {}
    pattern = re.compile(r"#(\w+)", re.IGNORECASE)
    for p in posts:
        text = (p["title"] or "") + " " + (p["body"] or "")
        for tag in pattern.findall(text):
            tag = tag.lower()
            counts[tag] = counts.get(tag, 0) + 1

    sorted_tags = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:15]
    return jsonify([{"tag": t, "count": c} for t, c in sorted_tags])

@app.route("/api/popular_makes")
def popular_makes():
    """Most mentioned car makes in posts."""
    conn  = get_db_connection()
    rows  = conn.execute("""
        SELECT car, COUNT(*) as count FROM posts
        WHERE car IS NOT NULL AND car != ''
        GROUP BY LOWER(car)
        ORDER BY count DESC
        LIMIT 20
    """).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# Garage
@app.route("/garage")
def garage():
    if "user_id" not in session:
        return redirect("/login")
    return render_template("garage.html")

@app.route("/garage/<username>")
def public_garage(username):
    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, username, avatar FROM users WHERE username=? COLLATE NOCASE", (username,)
    ).fetchone()
    if not user:
        conn.close()
        return "User not found", 404
    cars = conn.execute(
        "SELECT * FROM garage WHERE user_id=? ORDER BY id DESC", (user["id"],)
    ).fetchall()
    # Fetch mods for each car
    cars_with_mods = []
    for car in cars:
        mods = conn.execute(
            "SELECT * FROM mods WHERE car_id=? ORDER BY id ASC", (car["id"],)
        ).fetchall()
        total = sum(m["cost"] or 0 for m in mods)
        cars_with_mods.append({
            "car": dict(car),
            "mods": [dict(m) for m in mods],
            "total": total
        })
    conn.close()
    return render_template("public_garage.html", user=dict(user),
                           cars_with_mods=cars_with_mods)

@app.route("/get_garage")
def get_garage():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    cars = conn.execute(
        "SELECT * FROM garage WHERE user_id=? ORDER BY id DESC",
        (session["user_id"],)
    ).fetchall()
    conn.close()
    return jsonify([dict(c) for c in cars])

@csrf.exempt
@app.route("/add_car", methods=["POST"])
def add_car():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    year  = sanitize(request.form.get("year", ""))
    make  = sanitize(request.form.get("make", ""))
    model = sanitize(request.form.get("model", ""))
    trim  = sanitize(request.form.get("trim", ""))
    notes = sanitize(request.form.get("notes", ""))
    image_path = save_upload("image")
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO garage (user_id, owner, year, make, model, trim, image, notes)
        VALUES (?,?,?,?,?,?,?,?)
    """, (session["user_id"], session["username"], year, make, model, trim, image_path, notes))
    conn.commit()
    try:
        check_and_award_badges(conn, session["user_id"])
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"message": "Car added"})

@app.route("/get_mods/<int:car_id>")
def get_mods(car_id):
    conn = get_db_connection()
    mods = conn.execute("SELECT * FROM mods WHERE car_id=?", (car_id,)).fetchall()
    conn.close()
    return jsonify([dict(m) for m in mods])

@csrf.exempt
@app.route("/add_mod", methods=["POST"])
def add_mod():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data = request.json
    name     = sanitize(data.get("name", ""))
    category = sanitize(data.get("category", ""))
    try:
        cost = float(data.get("cost", 0))
    except ValueError:
        return jsonify({"error": "Invalid cost"}), 400
    car_id = int(data["car_id"])
    # verify ownership
    conn = get_db_connection()
    car = conn.execute("SELECT user_id FROM garage WHERE id=?", (car_id,)).fetchone()
    if not car or car["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403
    conn.execute("INSERT INTO mods (car_id, name, cost, category, created_at) VALUES (?,?,?,?,?)",
                 (car_id, name, cost, category, datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.commit()
    conn.close()
    return jsonify({"message": "Mod added"})

# Compare
@app.route("/compare")
def compare():
    return render_template("compare.html")

@app.route("/api/vehicle_image")
def vehicle_image():
    vtype = sanitize(request.args.get("type", "car"))
    make  = sanitize(request.args.get("make", ""))
    model = sanitize(request.args.get("model", ""))
    year  = sanitize(request.args.get("year", ""))
    query = sanitize(request.args.get("q", ""))

    if not query and not (make and model):
        return jsonify({"url": ""})

    headers = {"User-Agent": "RideInsight/1.0"}
    search_query = query or f"{year} {make} {model}".strip()

    # Boat/motorcycle names collide with places and people on Wikipedia
    # ("Malibu" -> Malibu Pier, "Yamaha" -> the corporation, etc).
    # Anchor the search and reject obviously-wrong subjects.
    TYPE_WORD = {"boat": "boat", "motorcycle": "motorcycle"}.get(vtype, "")
    BAD_TITLE_WORDS = (
        "pier", "beach", "city", "county", "california", "lake", "river",
        "island", "bay", "town", "village", "school", "park", "band",
        "album", "song", "film", "actor", "restaurant", "hotel", "street",
    )

    def title_is_plausible(title: str) -> bool:
        """Reject Wikipedia hits that clearly aren't the vehicle."""
        t = (title or "").lower()
        if any(w in t for w in BAD_TITLE_WORDS):
            return False
        # Must at least mention the make
        if make and make.lower().split()[0] not in t:
            return False
        return True

    # 1. Imagin.studio for cars (URL construction, no request needed)
    if vtype == "car" and make and model:
        # Normalize make for Imagin.studio
        imagin_make = make.lower().strip()
        # Imagin uses "mercedes-benz" not "mercedes"
        imagin_make_map = {
            "mercedes": "mercedes-benz",
            "vw": "volkswagen",
            "chevy": "chevrolet",
        }
        imagin_make = imagin_make_map.get(imagin_make, imagin_make)
        # Clean model — remove trim words Imagin doesn't understand
        imagin_model = model.lower().split()[0] if model else ""
        url = (f"https://cdn.imagin.studio/getimage?customer=img"
               f"&make={requests.utils.quote(imagin_make)}"
               f"&modelFamily={requests.utils.quote(imagin_model)}"
               f"&paintId=&angle=side")
        return jsonify({"url": url, "source": "imagin"})

    # 2. Unsplash for motorcycles and boats
    unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if unsplash_key:
        try:
            # Anchor with the vehicle type so "Malibu 21 VLX" doesn't
            # return beach photos
            unsplash_q = f"{search_query} {TYPE_WORD}".strip() if TYPE_WORD else search_query
            r = requests.get(
                "https://api.unsplash.com/search/photos",
                params={"query": unsplash_q, "per_page": 3, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {unsplash_key}"},
                timeout=6
            )
            if r.status_code == 200:
                results = r.json().get("results", [])
                for result in results:
                    url = result.get("urls", {}).get("regular", "")
                    if url:
                        return jsonify({"url": url, "source": "unsplash"})
        except Exception as e:
            app.logger.warning(f"Unsplash failed: {e}")

    # 3. Wikimedia REST fallback
    candidates = []
    if make and model and year:
        candidates.append(f"{year}_{make}_{model}")
    if make and model:
        candidates.append(f"{make}_{model}")
    candidates.append(search_query.replace(" ", "_"))

    for title in candidates:
        try:
            r = requests.get(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}",
                headers=headers, timeout=5
            )
            if r.status_code == 200:
                data = r.json()
                # For boats/motorcycles, verify the page is actually about
                # the vehicle before trusting its image
                if TYPE_WORD and not title_is_plausible(data.get("title", "")):
                    continue
                img = data.get("originalimage", {}).get("source", "") or \
                      data.get("thumbnail", {}).get("source", "")
                if img and not img.endswith(".svg"):
                    return jsonify({"url": img, "source": "wikimedia"})
        except:
            continue

    # 4. Wikimedia search fallback
    try:
        r = requests.get(
            "https://en.wikipedia.org/w/api.php",
            params={"action":"query","list":"search",
                    "srsearch": f"{search_query} {TYPE_WORD}".strip(),
                    "srlimit":3,"format":"json"},
            headers=headers, timeout=5
        )
        for result in r.json().get("query", {}).get("search", []):
            if TYPE_WORD and not title_is_plausible(result.get("title", "")):
                continue
            img_r = requests.get(
                "https://en.wikipedia.org/w/api.php",
                params={"action":"query","titles":result["title"],"prop":"pageimages",
                        "piprop":"original","format":"json","redirects":1},
                headers=headers, timeout=5
            )
            for page in img_r.json().get("query", {}).get("pages", {}).values():
                img = page.get("original", {}).get("source", "")
                if img and not img.endswith(".svg"):
                    return jsonify({"url": img, "source": "wikimedia_search"})
    except:
        pass

    return jsonify({"url": "", "source": "none"})

@app.route("/api/search_motorcycle")
def search_motorcycle():
    make  = sanitize(request.args.get("make", ""))
    model = sanitize(request.args.get("model", ""))
    year  = sanitize(request.args.get("year", ""))
    api_key = os.getenv("API_NINJAS_KEY")
    params = {"make": make, "model": model}
    if year: params["year"] = year
    resp = requests.get(
        "https://api.api-ninjas.com/v1/motorcycles",
        headers={"X-Api-Key": api_key},
        params=params,
        timeout=8
    )
    if resp.status_code != 200:
        return jsonify({"error": "Motorcycle API failed", "status": resp.status_code}), 500
    return jsonify(resp.json())

@app.route("/api/search_vehicle")
def search_vehicle():
    make  = sanitize(request.args.get("make", ""))
    model = sanitize(request.args.get("model", ""))
    year  = sanitize(request.args.get("year", ""))
    api_key = os.getenv("API_NINJAS_KEY")

    # Build a list of (make, model) attempts from most to least specific
    def clean_make(m):
        return m.lower().replace("-", " ").replace("  ", " ").strip()

    def model_variants(m):
        """Return progressively simpler model strings to try."""
        m = m.lower().strip()
        variants = [m]
        # Remove hyphens: "c-class" -> "c class"
        no_hyphen = m.replace("-", " ").strip()
        if no_hyphen != m:
            variants.append(no_hyphen)
        # First word only: "c class" -> "c", "3 series" -> "3"
        first_word = m.split()[0] if m else ""
        if first_word and first_word not in variants:
            variants.append(first_word)
        # First two words: "a4 quattro" -> "a4"
        words = m.split()
        if len(words) >= 2:
            two = " ".join(words[:2])
            if two not in variants:
                variants.append(two)
        return variants

    api_make = clean_make(make)
    attempts = []
    for mv in model_variants(model):
        attempts.append((api_make, mv, year))    # with year
        attempts.append((api_make, mv, ""))       # without year

    for att_make, att_model, att_year in attempts:
        params = {"make": att_make, "model": att_model}
        if att_year:
            params["year"] = att_year
        resp = requests.get(
            "https://api.api-ninjas.com/v1/cars",
            headers={"X-Api-Key": api_key},
            params=params,
            timeout=8
        )
        if resp.status_code == 200:
            data = resp.json()
            if not data:
                continue
            # Verify at least one result's model shares a meaningful word with the search
            search_words = set(
                w for w in model.lower().replace("-", " ").split()
                if len(w) > 1 and w not in ("the", "and", "for")
            )
            verified = [
                car for car in data
                if any(w in (car.get("model") or "").lower() for w in search_words)
            ] if search_words else data

            if verified:
                return jsonify(verified)

    return jsonify([])

@csrf.exempt
@app.route("/save_comparison", methods=["POST"])
def save_comparison():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data   = request.json
    car1   = sanitize(data.get("car1", ""))
    car2   = sanitize(data.get("car2", ""))
    intent = sanitize(data.get("intent", ""))
    vtype  = sanitize(data.get("vehicle_type", "car")) or "car"
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO comparisons (user_id, car1, car2, intent, vehicle_type) VALUES (?,?,?,?,?)",
        (session["user_id"], car1, car2, intent, vtype)
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Saved"})

@app.route("/saved")
def saved():
    return render_template("saved.html")

# ─── Badges ───────────────────────────────────────────────────────
@app.route("/badges")
def badges_page():
    if "user_id" not in session:
        return redirect(url_for("login"))
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT badge_key, awarded_at FROM user_badges WHERE user_id=?",
        (session["user_id"],)
    ).fetchall()
    conn.close()
    earned = {r["badge_key"]: r["awarded_at"] for r in rows}
    badges = [
        {**meta, "key": key, "earned": key in earned, "awarded_at": earned.get(key, "")}
        for key, meta in BADGES.items()
    ]
    # Unlocked first, then locked
    badges.sort(key=lambda b: (not b["earned"], b["name"]))
    return render_template("badges.html", badges=badges,
                           earned_count=len(earned), total=len(BADGES))

# ─── Drafts ───────────────────────────────────────────────────────
@app.route("/drafts")
def drafts_page():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("drafts.html")

@app.route("/api/drafts")
def api_drafts():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM drafts WHERE user_id=? ORDER BY id DESC",
        (session["user_id"],)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@csrf.exempt
@app.route("/api/drafts/save", methods=["POST"])
def api_draft_save():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    d = request.json or {}
    title = sanitize(d.get("title", ""))
    body  = sanitize(d.get("body", ""))
    car   = sanitize(d.get("car", ""))
    gif   = sanitize(d.get("gif_url", ""))
    link  = sanitize(d.get("link_url", ""))
    if not (title or body):
        return jsonify({"error": "Draft is empty"}), 400
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    conn = get_db_connection()
    draft_id = d.get("id")
    if draft_id:
        conn.execute("""UPDATE drafts SET title=?, body=?, car=?, gif_url=?,
                        link_url=?, updated_at=? WHERE id=? AND user_id=?""",
                     (title, body, car, gif, link, now, int(draft_id), session["user_id"]))
    else:
        conn.execute("""INSERT INTO drafts (user_id, title, body, car, gif_url,
                        link_url, updated_at) VALUES (?,?,?,?,?,?,?)""",
                     (session["user_id"], title, body, car, gif, link, now))
    conn.commit()
    conn.close()
    return jsonify({"message": "Draft saved"})

@csrf.exempt
@app.route("/api/drafts/<int:draft_id>/delete", methods=["POST"])
def api_draft_delete(draft_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    row = conn.execute("SELECT user_id FROM drafts WHERE id=?", (draft_id,)).fetchone()
    if not row or row["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403
    conn.execute("DELETE FROM drafts WHERE id=?", (draft_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted"})

# ─── Social links ─────────────────────────────────────────────────
@csrf.exempt
@app.route("/settings/update_socials", methods=["POST"])
def update_socials():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    d = request.json or {}
    fields = ["instagram", "tiktok", "youtube", "x", "website"]
    vals = []
    for f in fields:
        v = sanitize(d.get(f, "")).strip()
        # Accept either a handle or a full URL; store as given (max 200 chars)
        vals.append(v[:200])
    conn = get_db_connection()
    conn.execute("""UPDATE users SET social_instagram=?, social_tiktok=?,
                    social_youtube=?, social_x=?, social_website=? WHERE id=?""",
                 (*vals, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Social links saved"})

@app.route("/get_comparisons")
def get_comparisons():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM comparisons WHERE user_id=? ORDER BY id DESC",
        (session["user_id"],)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@csrf.exempt
@app.route("/delete_comparison/<int:comp_id>", methods=["POST"])
def delete_comparison(comp_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    row = conn.execute("SELECT user_id FROM comparisons WHERE id=?", (comp_id,)).fetchone()
    if not row or row["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403
    conn.execute("DELETE FROM comparisons WHERE id=?", (comp_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted"})

# Auth
@app.route("/signup", methods=["GET", "POST"])
@limiter.limit("10 per hour", methods=["POST"])
def signup():
    if request.method == "POST":
        username      = sanitize(request.form.get("username", ""))
        email         = sanitize(request.form.get("email", ""))
        password      = request.form.get("password", "")
        main_car      = sanitize(request.form.get("main_car", "")).strip()
        secondary_car = sanitize(request.form.get("secondary_car", "")).strip()

        if len(username) < 3:
            return render_template("signup.html", error="Username must be at least 3 characters.")
        if "@" in username:
            return render_template("signup.html", error="Username cannot be an email address — please choose a username like 'Aryoh_1'.")
        if len(password) < 8:
            return render_template("signup.html", error="Password must be at least 8 characters.")
        hashed = generate_password_hash(password)
        conn = get_db_connection()
        try:
            conn.execute(
                "INSERT INTO users (username, email, password, main_car, secondary_car) VALUES (?,?,?,?,?)",
                (username, email, hashed, main_car, secondary_car)
            )
            conn.commit()
            conn.close()
            return redirect("/login")
        except sqlite3.IntegrityError:
            conn.close()
            return render_template("signup.html", error="Username or email already exists.")
    return render_template("signup.html")
    return render_template("signup.html")

@app.route("/login", methods=["GET", "POST"])
@limiter.limit("20 per hour", methods=["POST"])
def login():
    if request.method == "POST":
        email    = sanitize(request.form.get("email", ""))
        password = request.form.get("password", "")
        conn = get_db_connection()
        user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        conn.close()
        if user and check_password_hash(user["password"], password):
            session.permanent = True
            session["user_id"]  = user["id"]
            session["username"] = user["username"]
            session["avatar"]   = user["avatar"] or ""
            return redirect("/")
        return render_template("login.html", error="Invalid email or password.")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

# Profile
@csrf.exempt
@app.route("/upload_avatar", methods=["POST"])
def upload_avatar():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    image_path = save_upload("avatar")
    if not image_path:
        return jsonify({"error": "No valid image provided"}), 400
    conn = get_db_connection()
    conn.execute("UPDATE users SET avatar=? WHERE id=?", (image_path, session["user_id"]))
    conn.commit()
    conn.close()
    session["avatar"] = image_path
    return jsonify({"url": image_path})

@csrf.exempt
@app.route("/remove_cover", methods=["POST"])
def remove_cover():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    conn.execute("UPDATE users SET cover_photo='' WHERE id=?", (session["user_id"],))
    conn.commit()
    conn.close()
    return jsonify({"message": "Cover removed"})

@csrf.exempt
@app.route("/upload_cover", methods=["POST"])
def upload_cover():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    image_path = save_upload("cover")
    if not image_path:
        return jsonify({"error": "No valid image provided"}), 400
    conn = get_db_connection()
    conn.execute("UPDATE users SET cover_photo=? WHERE id=?", (image_path, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"url": image_path})

@app.route("/profile/<username>")
def profile(username):
    import re
    if not re.match(r'^[\w\-]{1,50}$', username):
        return render_template("error.html", message=f"Invalid username: '{username}'. Usernames can only contain letters, numbers, and underscores."), 400
    conn = get_db_connection()
    user = conn.execute(
        "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
    ).fetchone()
    if not user:
        conn.close()
        return "User not found", 404
    cars  = conn.execute("SELECT * FROM garage WHERE user_id=? ORDER BY id DESC",
                         (user["id"],)).fetchall()
    posts = conn.execute("SELECT * FROM posts WHERE username=? ORDER BY id DESC",
                         (username,)).fetchall()
    comments = conn.execute(
        """SELECT c.id, c.body, c.created_at, c.likes,
                  p.id as post_id, p.title as post_title
           FROM comments c
           JOIN posts p ON p.id = c.post_id
           WHERE c.username = ?
           ORDER BY c.id DESC LIMIT 50""",
        (username,)
    ).fetchall()
    follower_count  = conn.execute(
        "SELECT COUNT(*) FROM follows WHERE following_id=?", (user["id"],)
    ).fetchone()[0]
    following_count = conn.execute(
        "SELECT COUNT(*) FROM follows WHERE follower_id=?", (user["id"],)
    ).fetchone()[0]
    is_following = False
    if "user_id" in session and session["user_id"] != user["id"]:
        is_following = bool(conn.execute(
            "SELECT id FROM follows WHERE follower_id=? AND following_id=?",
            (session["user_id"], user["id"])
        ).fetchone())
    conn.close()
    return render_template("profile.html", user=dict(user), cars=cars, posts=posts,
                           comments=comments,
                           follower_count=follower_count, following_count=following_count,
                           is_following=is_following,
                           is_own_profile=("user_id" in session and session["user_id"] == user["id"]))

@csrf.exempt
@app.route("/update_bio", methods=["POST"])
def update_bio():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    bio = sanitize(request.json.get("bio", ""))[:300]
    conn = get_db_connection()
    conn.execute("UPDATE users SET bio=? WHERE id=?", (bio, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Bio updated", "bio": bio})

@csrf.exempt
@app.route("/api/block/<username>", methods=["POST"])
def block_user(username):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    target = conn.execute("SELECT id FROM users WHERE username=? COLLATE NOCASE", (username,)).fetchone()
    if not target:
        conn.close()
        return jsonify({"error": "User not found"}), 404
    if target["id"] == session["user_id"]:
        conn.close()
        return jsonify({"error": "You can't block yourself"}), 400
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS blocks (blocker_id INTEGER, blocked_id INTEGER, PRIMARY KEY(blocker_id, blocked_id))")
        conn.execute("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?,?)", (session["user_id"], target["id"]))
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"message": f"@{username} has been blocked."})

@csrf.exempt
@app.route("/api/report/<username>", methods=["POST"])
def report_user(username):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    reason = sanitize(request.json.get("reason", ""))[:500]
    conn = get_db_connection()
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER, reported_username TEXT, reason TEXT, created_at TEXT)")
        conn.execute("INSERT INTO reports (reporter_id, reported_username, reason, created_at) VALUES (?,?,?,?)",
                     (session["user_id"], username, reason, datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"message": "Report received."})

@app.route("/search_users")
def search_users():
    q = sanitize(request.args.get("q", ""))
    if not q:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, username FROM users WHERE username LIKE ? LIMIT 20",
        (f"%{q}%",)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# Follow / Unfollow
@csrf.exempt
@app.route("/follow/<int:target_id>", methods=["POST"])
def follow(target_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    if target_id == session["user_id"]:
        return jsonify({"error": "Cannot follow yourself"}), 400
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM follows WHERE follower_id=? AND following_id=?",
        (session["user_id"], target_id)
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM follows WHERE follower_id=? AND following_id=?",
                     (session["user_id"], target_id))
        action = "unfollowed"
    else:
        conn.execute("INSERT INTO follows (follower_id, following_id) VALUES (?,?)",
                     (session["user_id"], target_id))
        add_notification(conn, target_id,
                         f"@{session['username']} started following you.",
                         link=f"/profile/{session.get('username','')}")
        action = "followed"
    conn.commit()
    try:
        check_and_award_badges(conn, target_id)
        conn.commit()
    except Exception:
        pass
    count = conn.execute(
        "SELECT COUNT(*) FROM follows WHERE following_id=?", (target_id,)
    ).fetchone()[0]
    conn.close()
    return jsonify({"action": action, "follower_count": count})

# Notifications
@app.route("/get_notifications")
def get_notifications():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30",
        (session["user_id"],)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@csrf.exempt
@app.route("/mark_notifications_read", methods=["POST"])
def mark_notifications_read():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    conn.execute("UPDATE notifications SET is_read=1 WHERE user_id=?",
                 (session["user_id"],))
    conn.commit()
    conn.close()
    return jsonify({"message": "Marked read"})

# ─── Tripo3D 3D Model Generation ──────────────────────────────────
@csrf.exempt
@csrf.exempt
@app.route("/api/clear_model_cache", methods=["POST"])
def clear_model_cache():
    """Clear cached models so they regenerate with image-to-model."""
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    conn.execute("DELETE FROM generated_models")
    conn.commit()
    conn.close()
    return jsonify({"message": "Cache cleared"})

@app.route("/api/tripo_balance")
def tripo_balance():
    api_key = os.getenv("TRIPO3D_API_KEY", "")
    if not api_key:
        return jsonify({"balance": 0, "error": "No API key"})
    try:
        resp = requests.get(
            "https://openapi.tripo3d.ai/v3/account/balance",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=6
        )
        data = resp.json().get("data", {})
        return jsonify({"balance": float(data.get("balance", 0))})
    except Exception as e:
        return jsonify({"balance": 0, "error": str(e)})

@app.route("/debug_tripo_gen")
def debug_tripo_gen():
    api_key = os.getenv("TRIPO3D_API_KEY", "")
    result  = {"balance": 530}

    # Fetch the 3 known task IDs directly
    task_ids = [
        "cfc70ced-5cdd-4d6f-8d58-d155d3",  # image_to_model
        "892576f6-da62-4f32-81e2-8d8d36",  # text_to_model
        "0e450dc2-aced-4cd6-b5e2-0721f",   # text_to_model
    ]

    # Actually get full task IDs from history endpoint
    try:
        r = requests.get(
            "https://openapi.tripo3d.ai/v3/account/usage?limit=5",
            headers={"Authorization": f"Bearer {api_key}"}, timeout=8
        )
        result["history_attempt"] = {"status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        result["history_error"] = str(e)

    # Check DB cache
    conn   = get_db_connection()
    models = conn.execute("SELECT * FROM generated_models ORDER BY id DESC LIMIT 5").fetchall()
    conn.close()
    result["cached_models"] = [dict(m) for m in models]

    return jsonify(result)

@app.route("/api/fetch_task/<task_id>")
def fetch_task(task_id):
    """Manually fetch a specific Tripo task and cache it."""
    api_key   = os.getenv("TRIPO3D_API_KEY", "")
    cache_key = request.args.get("cache_key", task_id)
    try:
        r    = requests.get(
            f"https://openapi.tripo3d.ai/v3/tasks/{task_id}",
            headers={"Authorization": f"Bearer {api_key}"}, timeout=10
        )
        data   = r.json()
        task   = data.get("data", {})
        output = task.get("output", {})

        # model_url is the V3 field; fall back to V2 names for safety
        glb_url = (output.get("model_url") or output.get("pbr_model") or
                   output.get("model") or output.get("base_model") or "")

        # Save to cache if found
        if glb_url and cache_key:
            conn = get_db_connection()
            conn.execute("""
                INSERT OR REPLACE INTO generated_models (cache_key, task_id, glb_url, thumbnail_url, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (cache_key, task_id, glb_url,
                  output.get("rendered_image_url") or output.get("rendered_image") or "",
                  datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
            conn.commit()
            conn.close()

        return jsonify({
            "task_id":     task_id,
            "status":      task.get("status"),
            "output_keys": list(output.keys()),
            "output":      output,
            "glb_url":     glb_url,
            "cached":      bool(glb_url),
        })
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route("/api/generate_3d", methods=["POST"])
def generate_3d():
    data  = request.json or {}
    year  = sanitize(data.get("year",  ""))
    make  = sanitize(data.get("make",  ""))
    model = sanitize(data.get("model", ""))
    color = sanitize(data.get("color", "red"))

    if not make or not model:
        return jsonify({"error": "Make and model required"}), 400

    # Cache key — normalize so "2020 Ford Mustang" and "2020 ford mustang" match
    cache_key = f"{year}_{make}_{model}".lower().replace(" ", "_")

    conn = get_db_connection()

    # Check cache first — free if already generated
    cached = conn.execute(
        "SELECT glb_url, thumbnail_url FROM generated_models WHERE cache_key = ?",
        (cache_key,)
    ).fetchone()

    if cached:
        conn.close()
        return jsonify({
            "status":        "cached",
            "glb_url":       cached["glb_url"],
            "thumbnail_url": cached["thumbnail_url"],
        })

    conn.close()

    # Not cached — call Tripo3D API
    api_key = os.getenv("TRIPO3D_API_KEY", "")
    if not api_key:
        return jsonify({"error": "Tripo3D API key not configured"}), 500

    # Step 1: Fetch a real photo of the vehicle to use as image-to-3D input
    photo_url = ""
    try:
        # Try Imagin.studio for cars first (clean side profile)
        imagin_url = (f"https://cdn.imagin.studio/getimage?customer=img"
                      f"&make={requests.utils.quote(make.lower())}"
                      f"&modelFamily={requests.utils.quote(model.lower().split()[0])}"
                      f"&paintId=&angle=side")

        # Also try Wikipedia as fallback
        wiki_candidates = [
            f"{year}_{make}_{model}".replace(" ", "_"),
            f"{make}_{model}".replace(" ", "_"),
        ]
        for candidate in wiki_candidates:
            try:
                wr = requests.get(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(candidate)}",
                    headers={"User-Agent": "RideInsight/1.0"},
                    timeout=5
                )
                if wr.status_code == 200:
                    pg = wr.json()
                    img = pg.get("originalimage", {}).get("source", "") or                           pg.get("thumbnail", {}).get("source", "")
                    if img and not img.endswith(".svg"):
                        photo_url = img
                        break
            except:
                continue

        # Fall back to Imagin.studio if no Wikipedia image
        if not photo_url:
            photo_url = imagin_url

    except Exception as e:
        app.logger.warning(f"Photo fetch failed: {e}")

    try:
        tripo_headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json"
        }

        task_url = ""
        if photo_url:
            # Step 1: Download the image
            img_resp = requests.get(photo_url, timeout=8, headers={"User-Agent": "RideInsight/1.0"})
            if img_resp.status_code == 200:
                # Step 2: Upload image to Tripo V3 to get a file_token
                upload_resp = requests.post(
                    "https://openapi.tripo3d.ai/v3/files",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": ("car.jpg", img_resp.content, "image/jpeg")},
                    timeout=20
                )
                if upload_resp.status_code == 200:
                    upload_data = upload_resp.json().get("data", {})
                    # V3 uses file_token; fall back to image_token for compatibility
                    image_token = (upload_data.get("file_token", "") or
                                   upload_data.get("image_token", ""))
                    if image_token:
                        payload  = {"file_token": image_token, "model": "v3.1-20260211"}
                        task_url = "https://openapi.tripo3d.ai/v3/generation/image-to-model"
                    else:
                        # Upload succeeded but no token — fall through to text
                        photo_url = ""
                else:
                    app.logger.warning(f"Tripo upload failed: {upload_resp.status_code} {upload_resp.text}")
                    photo_url = ""
            else:
                photo_url = ""

        if not photo_url:
            # Fallback: text_to_model
            payload  = {
                "prompt": f"{year} {make} {model} car, detailed 3D model, photorealistic",
                "model":  "v3.1-20260211"
            }
            task_url = "https://openapi.tripo3d.ai/v3/generation/text-to-model"

        resp = requests.post(
            task_url,
            headers=tripo_headers,
            json=payload,
            timeout=15
        )

        if resp.status_code != 200:
            return jsonify({"error": f"Tripo API error: {resp.status_code}", "detail": resp.text}), 500

        resp_data = resp.json()
        if resp_data.get("code", -1) != 0:
            return jsonify({"error": resp_data.get("message", "Unknown error"), "raw": resp_data}), 500

        task_id = resp_data.get("data", {}).get("task_id")
        if not task_id:
            return jsonify({"error": "No task_id returned", "raw": resp.text}), 500

        return jsonify({
            "status":    "generating",
            "task_id":   task_id,
            "cache_key": cache_key,
            "used_image": bool(photo_url),
        })

    except Exception as e:
        app.logger.error(f"generate_3d error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/poll_3d/<task_id>")
def poll_3d(task_id):
    """Poll Tripo3D for task completion and cache result."""
    cache_key = request.args.get("cache_key", "")
    api_key   = os.getenv("TRIPO3D_API_KEY", "")

    try:
        resp = requests.get(
            f"https://openapi.tripo3d.ai/v3/tasks/{task_id}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        full_resp = resp.json()
        data      = full_resp.get("data", {})
        status    = data.get("status", "unknown")

        app.logger.info(f"Tripo poll {task_id}: status={status} data={str(data)[:300]}")

        if status == "success":
            output = data.get("output", {})

            # V3 uses model_url; fall back to V2 field names for safety
            glb_url = (
                output.get("model_url")  or
                output.get("pbr_model")  or
                output.get("model")      or
                output.get("base_model") or
                ""
            )
            thumbnail_url = (
                output.get("rendered_image_url") or
                output.get("rendered_image")     or
                output.get("thumbnail")          or
                ""
            )

            app.logger.info(f"Tripo success: glb_url={glb_url[:80] if glb_url else 'EMPTY'} output_keys={list(output.keys())}")

            # Cache it
            if cache_key and glb_url:
                conn = get_db_connection()
                try:
                    conn.execute("""
                        INSERT OR REPLACE INTO generated_models (cache_key, task_id, glb_url, thumbnail_url, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    """, (cache_key, task_id, glb_url, thumbnail_url,
                          datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
                    conn.commit()
                except Exception as ce:
                    app.logger.error(f"Cache insert error: {ce}")
                conn.close()

            return jsonify({
                "status":        "success",
                "glb_url":       glb_url,
                "thumbnail_url": thumbnail_url,
                "output_keys":   list(output.keys()),  # debug info
            })

        elif status in ("failed", "cancelled"):
            return jsonify({"status": "failed", "detail": str(data)})
        else:
            progress = data.get("progress", 0)
            return jsonify({"status": "generating", "progress": progress})

    except Exception as e:
        app.logger.error(f"poll_3d error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/proxy_glb")
def proxy_glb():
    """Proxy GLB file through Flask to avoid CORS issues with Tripo CDN."""
    year       = sanitize(request.args.get("year",  ""))
    make       = sanitize(request.args.get("make",  ""))
    model_name = sanitize(request.args.get("model", ""))
    cache_key  = f"{year}_{make}_{model_name}".lower().replace(" ", "_")
    api_key    = os.getenv("TRIPO3D_API_KEY", "")

    # Get task_id from cache
    conn   = get_db_connection()
    cached = conn.execute(
        "SELECT task_id FROM generated_models WHERE cache_key = ?", (cache_key,)
    ).fetchone()
    conn.close()

    if not cached or not cached["task_id"]:
        return "Model not cached", 404

    # Fetch fresh URL from Tripo
    try:
        r      = requests.get(
            f"https://openapi.tripo3d.ai/v3/tasks/{cached['task_id']}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        output  = r.json().get("data", {}).get("output", {})
        glb_url = output.get("model_url") or output.get("pbr_model") or output.get("model") or ""
        if not glb_url:
            return "No GLB URL found", 404

        # Stream the GLB file back through Flask with proper headers
        glb_resp = requests.get(glb_url, timeout=30, stream=True)
        from flask import Response, stream_with_context
        return Response(
            stream_with_context(glb_resp.iter_content(chunk_size=8192)),
            content_type="model/gltf-binary",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Content-Disposition": f"inline; filename={cache_key}.glb"
            }
        )
    except Exception as e:
        return str(e), 500

@app.route("/api/get_fresh_model_url")
def get_fresh_model_url():
    """Get a fresh (non-expired) GLB URL by re-fetching from Tripo using cached task_id."""
    year      = sanitize(request.args.get("year",  ""))
    make      = sanitize(request.args.get("make",  ""))
    model_name = sanitize(request.args.get("model", ""))
    cache_key = f"{year}_{make}_{model_name}".lower().replace(" ", "_")
    api_key   = os.getenv("TRIPO3D_API_KEY", "")

    conn    = get_db_connection()
    cached  = conn.execute(
        "SELECT task_id FROM generated_models WHERE cache_key = ?", (cache_key,)
    ).fetchone()
    conn.close()

    if not cached or not cached["task_id"]:
        return jsonify({"error": "Not cached"}), 404

    # Re-fetch fresh URL from Tripo using the stored task_id
    try:
        r      = requests.get(
            f"https://openapi.tripo3d.ai/v3/tasks/{cached['task_id']}",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10
        )
        output  = r.json().get("data", {}).get("output", {})
        glb_url = (output.get("model_url") or output.get("pbr_model") or
                   output.get("model") or output.get("base_model") or "")

        if not glb_url:
            return jsonify({"error": "No GLB in task output", "keys": list(output.keys())}), 404

        return jsonify({"glb_url": glb_url, "task_id": cached["task_id"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/check_model_cache")
def check_model_cache():
    """Check if a model is already cached before spending credits."""
    year  = sanitize(request.args.get("year",  ""))
    make  = sanitize(request.args.get("make",  ""))
    model = sanitize(request.args.get("model", ""))
    cache_key = f"{year}_{make}_{model}".lower().replace(" ", "_")

    conn   = get_db_connection()
    cached = conn.execute(
        "SELECT glb_url, thumbnail_url FROM generated_models WHERE cache_key = ?",
        (cache_key,)
    ).fetchone()
    conn.close()

    if cached:
        return jsonify({"cached": True, "task_id": dict(cached).get("task_id", ""), "cache_key": cache_key})
    return jsonify({"cached": False})

# ─── Builder ──────────────────────────────────────────────────────
@app.route("/builder")
def builder():
    return render_template("builder.html")

@csrf.exempt
@app.route("/save_build", methods=["POST"])
def save_build():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    import json
    data = request.json
    name       = sanitize(data.get("name", ""))
    base       = data.get("baseVehicle") or {}
    base_price = float(data.get("basePrice", 0))
    parts      = data.get("parts", [])
    # sanitize parts
    clean_parts = []
    for p in parts:
        clean_parts.append({
            "category": sanitize(p.get("category", "")),
            "name":     sanitize(p.get("name", "")),
            "cost":     float(p.get("cost", 0)),
            "effect":   sanitize(p.get("effect", "")),
            "icon":     sanitize(p.get("icon", "")),
        })
    car_color  = sanitize(data.get("carColor", "#1f4ed8"))
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO builds (user_id, name, base_year, base_make, base_model, base_trim, base_price, parts_json, car_color)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (
        session["user_id"], name,
        sanitize(base.get("year", "")), sanitize(base.get("make", "")),
        sanitize(base.get("model", "")), sanitize(base.get("trim", "")),
        base_price, json.dumps(clean_parts), car_color
    ))
    conn.commit()
    conn.close()
    return jsonify({"message": "Build saved"})

@app.route("/get_builds")
def get_builds():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT * FROM builds WHERE user_id=? ORDER BY id DESC",
        (session["user_id"],)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/get_build/<int:build_id>")
def get_build(build_id):
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM builds WHERE id=?", (build_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Not found"}), 404
    return jsonify(dict(row))

@csrf.exempt
@app.route("/delete_car/<int:car_id>", methods=["POST"])
def delete_car(car_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    car = conn.execute("SELECT user_id FROM garage WHERE id=?", (car_id,)).fetchone()
    if not car or car["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403
    conn.execute("DELETE FROM mods WHERE car_id=?", (car_id,))
    conn.execute("DELETE FROM garage WHERE id=?", (car_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Car deleted"})

@csrf.exempt
@app.route("/delete_mod/<int:mod_id>", methods=["POST"])
def delete_mod(mod_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    # verify ownership via the garage car
    mod = conn.execute("SELECT m.id, g.user_id FROM mods m JOIN garage g ON g.id=m.car_id WHERE m.id=?", (mod_id,)).fetchone()
    if not mod or mod["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403
    conn.execute("DELETE FROM mods WHERE id=?", (mod_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Mod deleted"})

@csrf.exempt
@app.route("/api/share_build/<int:build_id>", methods=["POST"])
def share_build(build_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    import json as _j
    conn = get_db_connection()
    build = conn.execute("SELECT * FROM builds WHERE id=? AND user_id=?",
                         (build_id, session["user_id"])).fetchone()
    if not build:
        conn.close()
        return jsonify({"error": "Build not found"}), 404
    b = dict(build)
    parts = _j.loads(b["parts_json"] or "[]")
    total = b["base_price"] + sum(p.get("cost", 0) for p in parts)
    title = f"Check out my {b['base_year']} {b['base_make']} {b['base_model']} build — {b['name']}"
    body_lines = [f"💰 Total build cost: ${total:,.0f}"]
    if parts:
        body_lines.append("\nMods:")
        for p in parts[:8]:
            body_lines.append(f"  • {p['name']} ({p['category']}) — ${p['cost']:,.0f}")
        if len(parts) > 8:
            body_lines.append(f"  …and {len(parts)-8} more")
    body = "\n".join(body_lines)
    conn.execute("""
        INSERT INTO posts (username, car, title, body, likes, dislikes, created_at)
        VALUES (?,?,?,?,0,0,?)
    """, (session["username"],
          f"{b['base_year']} {b['base_make']} {b['base_model']}",
          title, body, datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.commit()
    try:
        check_and_award_badges(conn, session["user_id"])
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"message": "Shared to feed"})

@csrf.exempt
@app.route("/api/clone_build/<int:build_id>", methods=["POST"])
def clone_build(build_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    build = conn.execute("SELECT * FROM builds WHERE id=?", (build_id,)).fetchone()
    if not build:
        conn.close()
        return jsonify({"error": "Build not found"}), 404
    b = dict(build)
    new_name = f"{b['name']} (Clone)"
    conn.execute("""
        INSERT INTO builds (user_id, name, base_year, base_make, base_model, base_trim, base_price, parts_json, car_color)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (session["user_id"], new_name, b["base_year"], b["base_make"], b["base_model"],
          b["base_trim"], b["base_price"], b["parts_json"], b["car_color"]))
    new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"message": "Build cloned", "new_id": new_id})

@app.route("/api/all_builds")
def all_builds():
    """Public builds from all users for the clone browser."""
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT b.*, u.username FROM builds b
        JOIN users u ON u.id = b.user_id
        ORDER BY b.id DESC LIMIT 50
    """).fetchall()
    conn.close()
    import json as _j
    result = []
    for r in rows:
        d = dict(r)
        parts = _j.loads(d.get("parts_json") or "[]")
        d["total"] = d["base_price"] + sum(p.get("cost", 0) for p in parts)
        d["part_count"] = len(parts)
        result.append(d)
    return jsonify(result)

@csrf.exempt
@app.route("/delete_build/<int:build_id>", methods=["POST"])
def delete_build(build_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    conn.execute("DELETE FROM builds WHERE id=? AND user_id=?",
                 (build_id, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted"})

# ─── NHTSA Vehicle Data (for builder dropdowns) ───────────────────
NHTSA = "https://vpic.nhtsa.dot.gov/api/vehicles"

@app.route("/api/vehicle_years")
def vehicle_years():
    current_year = datetime.utcnow().year + 1
    years = list(range(current_year, 1980, -1))
    return jsonify(years)

@app.route("/api/moto_makes")
def moto_makes():
    try:
        r = requests.get(f"{NHTSA}/GetMakesForVehicleType/Motorcycle?format=json", timeout=8)
        makes = sorted(set(m["MakeName"].title() for m in r.json().get("Results", [])))
        return jsonify(makes)
    except Exception:
        return jsonify(["Honda","Kawasaki","Yamaha","Suzuki","Ducati","BMW","Harley-Davidson",
                        "KTM","Triumph","Royal Enfield","Aprilia","Indian","Can-Am"])

@app.route("/api/moto_models")
def moto_models():
    make = sanitize(request.args.get("make", ""))
    year = sanitize(request.args.get("year", ""))
    try:
        url = f"{NHTSA}/GetModelsForMakeYear/make/{requests.utils.quote(make)}/modelyear/{year}/vehicleType/Motorcycle?format=json"
        r   = requests.get(url, timeout=8)
        models = sorted(set(m["Model_Name"] for m in r.json().get("Results", [])))
        if not models:
            # fallback: get all models for make without year filter
            url2 = f"{NHTSA}/GetModelsForMake/{requests.utils.quote(make)}?format=json"
            r2   = requests.get(url2, timeout=6)
            models = sorted(set(m["Model_Name"] for m in r2.json().get("Results", [])))
        return jsonify(models)
    except Exception:
        return jsonify([])

BOAT_MAKES = {
    "Sea Ray": ["190 SPX","250 SLX","270 SDX","310 SLX","350 SLX","400 SLX","Sundancer 320","Sundancer 350","L590"],
    "Bayliner": ["VR4","VR5","VR6","Element E16","Element E18","Trophy 21CC","Trophy 22PD","180 Bowrider","190 Deck Boat"],
    "Yamaha": ["242X E-Series","252S","275SD","AR190","AR210","AR240","SX190","SX210","SX240","FSH Sport","FSH Deluxe"],
    "Boston Whaler": ["130 Super Sport","150 Montauk","170 Montauk","190 Montauk","210 Montauk","230 Dauntless","270 Dauntless","330 Outrage"],
    "Chaparral": ["21 SSi","21 H2O","230 SSi","244 Sunesta","270 OSX","280 OSX","300 OSX","337","H2O 19 Sport"],
    "Malibu": ["21 MLX","21 VLX","23 LSV","24 MXZ","25 LSV","Wake 22","Wakesetter 21 VLX","Wakesetter 23 LSV","Wakesetter 25 LSV"],
    "MasterCraft": ["NXT20","NXT22","NXT24","X22","X24","XT20","XT21","XT22","XT23","XT24"],
    "Grady-White": ["Fisherman 180","Fisherman 216","Fisherman 236","Freedom 285","Canyon 271","Canyon 306","Marlin 300"],
    "Tracker": ["Bass Tracker Classic","Pro 160","Pro 170","Pro 175","Pro Team 175","Panfish 16","Targa V-18 WT"],
    "Sun Tracker": ["Bass Buggy 16 XL","Bass Buggy 18 DLX","Party Barge 20 DLX","Party Barge 22 XP3","Party Barge 24 XP3","Fishin' Barge 22 DLX"],
}

@app.route("/api/boat_makes")
def boat_makes():
    return jsonify(sorted(BOAT_MAKES.keys()))

@app.route("/api/boat_models")
def boat_models():
    make = sanitize(request.args.get("make", ""))
    models = BOAT_MAKES.get(make, [])
    return jsonify(models)

@app.route("/api/vehicle_makes")
def vehicle_makes():
    year = sanitize(request.args.get("year", ""))
    try:
        r = requests.get(f"{NHTSA}/GetMakesForVehicleType/car?format=json", timeout=8)
        makes = sorted(set(m["MakeName"].title() for m in r.json().get("Results", [])))
        return jsonify(makes)
    except Exception as e:
        return jsonify([])

@app.route("/api/vehicle_models")
def vehicle_models():
    make = sanitize(request.args.get("make", ""))
    year = sanitize(request.args.get("year", ""))
    try:
        url = f"{NHTSA}/GetModelsForMakeYear/make/{requests.utils.quote(make)}/modelyear/{year}?format=json"
        r   = requests.get(url, timeout=8)
        models = sorted(set(m["Model_Name"] for m in r.json().get("Results", [])))
        return jsonify(models)
    except Exception as e:
        return jsonify([])

@app.route("/api/vehicle_trims")
def vehicle_trims():
    make  = sanitize(request.args.get("make", ""))
    model = sanitize(request.args.get("model", ""))
    year  = sanitize(request.args.get("year", ""))
    try:
        url = (f"{NHTSA}/GetModelsForMakeYear/make/{requests.utils.quote(make)}"
               f"/modelyear/{year}?format=json")
        r   = requests.get(url, timeout=8)
        results = r.json().get("Results", [])
        trims = sorted(set(
            m.get("Model_Name", "") for m in results
            if model.lower() in m.get("Model_Name", "").lower()
        ))
        if not trims:
            trims = ["Base", "Standard", "Sport", "Premium", "Limited"]
        return jsonify(trims)
    except:
        return jsonify(["Base", "Standard", "Sport", "Premium", "Limited"])

@app.route("/api/estimate_price")
def estimate_price():
    make  = sanitize(request.args.get("make", "")).lower()
    model = sanitize(request.args.get("model", "")).lower()
    year  = int(sanitize(request.args.get("year", "0")) or 0)
    trim  = sanitize(request.args.get("trim", "")).lower()

    # Price estimation based on make/class heuristics
    base = 25000

    # Make tier adjustments
    luxury = ["bmw","mercedes","audi","lexus","cadillac","lincoln","volvo","genesis","infiniti","acura"]
    ultra  = ["porsche","ferrari","lamborghini","bentley","rolls-royce","maserati","aston","mclaren","bugatti"]
    budget = ["mitsubishi","kia","hyundai","mazda","honda","toyota","nissan","subaru","volkswagen","chevrolet","ford"]

    if any(b in make for b in ultra):   base = 120000
    elif any(b in make for b in luxury): base = 48000
    elif any(b in make for b in budget): base = 28000

    # Model keywords
    model_adjustments = {
        "truck": 8000, "suv": 5000, "pickup": 8000, "van": 4000,
        "coupe": 3000, "convertible": 6000, "roadster": 12000,
        "wagon": 2000, "sport": 4000, "gt": 8000, "rs": 12000,
        "amg": 20000, "m3": 18000, "m5": 25000, "911": 40000,
        "electric": 10000, "hybrid": 5000,
    }
    for kw, adj in model_adjustments.items():
        if kw in model: base += adj

    # Trim adjustments
    trim_adjustments = {
        "base": -3000, "s": 0, "se": 2000, "sel": 5000,
        "limited": 8000, "sport": 5000, "premium": 10000,
        "platinum": 14000, "touring": 8000, "lx": 0, "ex": 4000,
        "gt": 6000, "r": 8000, "amg": 18000, "m": 15000,
    }
    for kw, adj in trim_adjustments.items():
        if kw in trim: base += adj

    # Year depreciation (newer = more expensive)
    current = datetime.utcnow().year
    if year > 0:
        age = current - year
        if age <= 0:   base = int(base * 1.05)
        elif age <= 2: base = int(base * 1.0)
        elif age <= 5: base = int(base * 0.82)
        elif age <= 10: base = int(base * 0.60)
        else:           base = int(base * 0.40)

    # Round to nearest 500
    base = round(base / 500) * 500
    return jsonify({"price": max(base, 5000)})

# ─── The Shop ──────────────────────────────────────────────────
import json as _json
import math as _math

def haversine(lat1, lng1, lat2, lng2):
    """Distance in miles between two coordinates."""
    R = 3958.8
    dlat = _math.radians(lat2 - lat1)
    dlng = _math.radians(lng2 - lng1)
    a = (_math.sin(dlat/2)**2 +
         _math.cos(_math.radians(lat1)) * _math.cos(_math.radians(lat2)) * _math.sin(dlng/2)**2)
    return R * 2 * _math.atan2(_math.sqrt(a), _math.sqrt(1 - a))

@app.route("/theshop")
@app.route("/the_shop")
def the_shop():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("the_shop.html")

@app.route("/theshop/listing/<int:listing_id>")
@app.route("/the_shop/listing/<int:listing_id>")
def listing_detail(listing_id):
    if "user_id" not in session:
        return redirect(url_for("login"))
    conn = get_db_connection()
    listing = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
    conn.close()
    if not listing:
        return redirect(url_for("the_shop"))
    return render_template("listing_detail.html", listing=dict(listing))

@app.route("/api/listings")
def get_listings():
    uid      = session.get("user_id")
    category = sanitize(request.args.get("category", ""))
    q        = sanitize(request.args.get("q", ""))
    sort     = sanitize(request.args.get("sort", "recent"))
    user_lat = request.args.get("lat", type=float)
    user_lng = request.args.get("lng", type=float)

    conn   = get_db_connection()
    where  = ["l.status = 'active'"]
    params = []

    if category:
        where.append("l.category = ?")
        params.append(category)
    if q:
        where.append("(l.title LIKE ? OR l.description LIKE ? OR l.username LIKE ?)")
        params += [f"%{q}%", f"%{q}%", f"%{q}%"]

    order = {
        "recent":  "l.id DESC",
        "price_asc":  "l.price ASC",
        "price_desc": "l.price DESC",
    }.get(sort, "l.id DESC")

    rows = conn.execute(f"""
        SELECT l.*,
            (SELECT COUNT(*) FROM listing_saves WHERE listing_id = l.id AND user_id = ?) as is_saved
        FROM listings l
        WHERE {' AND '.join(where)}
        ORDER BY {order}
        LIMIT 60
    """, [uid] + params).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["images"] = _json.loads(d["images"] or "[]")
        if user_lat and user_lng and d.get("lat") and d.get("lng"):
            dist = haversine(user_lat, user_lng, d["lat"], d["lng"])
            d["distance"] = round(dist, 1)
        results.append(d)

    if sort == "nearest" and user_lat:
        results.sort(key=lambda x: x.get("distance", 9999))

    return jsonify(results)

@app.route("/api/listings/my")
def my_listings():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT * FROM listings WHERE user_id = ? ORDER BY id DESC
    """, (session["user_id"],)).fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["images"] = _json.loads(d["images"] or "[]")
        results.append(d)
    return jsonify(results)

@app.route("/api/listings/<int:listing_id>")
def get_listing(listing_id):
    uid  = session.get("user_id")
    conn = get_db_connection()
    row  = conn.execute("""
        SELECT l.*,
            (SELECT COUNT(*) FROM listing_saves WHERE listing_id = l.id AND user_id = ?) as is_saved
        FROM listings l WHERE l.id = ?
    """, (uid, listing_id)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Not found"}), 404
    d = dict(row)
    d["images"] = _json.loads(d["images"] or "[]")
    return jsonify(d)

@csrf.exempt
@app.route("/api/listings/create", methods=["POST"])
def create_listing():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    title       = sanitize(request.form.get("title", "")).strip()
    description = sanitize(request.form.get("description", "")).strip()
    category    = sanitize(request.form.get("category", "")).strip()
    condition   = sanitize(request.form.get("condition", "used")).strip()
    location    = sanitize(request.form.get("location", "")).strip()
    lat         = request.form.get("lat", type=float)
    lng         = request.form.get("lng", type=float)

    try:
        price = float(request.form.get("price", 0))
    except ValueError:
        return jsonify({"error": "Invalid price"}), 400

    if not title or not category or price < 0:
        return jsonify({"error": "Title, category and price are required"}), 400

    # Handle multiple image uploads
    images = []
    for key in request.files:
        if key.startswith("image"):
            path = save_upload(key)
            if path:
                images.append(path)

    conn = get_db_connection()
    conn.execute("""
        INSERT INTO listings (user_id, username, title, description, category, condition,
                              price, location, lat, lng, images, status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (session["user_id"], session["username"], title, description, category,
          condition, price, location, lat, lng, _json.dumps(images),
          "active", datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    listing_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"message": "Listing created", "id": listing_id})

@csrf.exempt
@app.route("/api/listings/<int:listing_id>/delete", methods=["POST"])
def delete_listing(listing_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    listing = conn.execute("SELECT user_id FROM listings WHERE id=?", (listing_id,)).fetchone()
    if not listing or listing["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Not authorized"}), 403
    conn.execute("DELETE FROM listings WHERE id=?", (listing_id,))
    conn.execute("DELETE FROM listing_saves WHERE listing_id=?", (listing_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted"})

@csrf.exempt
@app.route("/api/listings/<int:listing_id>/mark_sold", methods=["POST"])
def mark_sold(listing_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    listing = conn.execute("SELECT user_id FROM listings WHERE id=?", (listing_id,)).fetchone()
    if not listing or listing["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Not authorized"}), 403
    conn.execute("UPDATE listings SET status='sold' WHERE id=?", (listing_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Marked as sold"})

@csrf.exempt
@app.route("/api/listings/<int:listing_id>/save", methods=["POST"])
def save_listing(listing_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM listing_saves WHERE user_id=? AND listing_id=?",
        (session["user_id"], listing_id)
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM listing_saves WHERE id=?", (existing["id"],))
        conn.commit(); conn.close()
        return jsonify({"saved": False})
    conn.execute("INSERT INTO listing_saves (user_id, listing_id) VALUES (?,?)",
                 (session["user_id"], listing_id))
    conn.commit(); conn.close()
    return jsonify({"saved": True})

# ─── Car Clubs ────────────────────────────────────────────────────
import re as _re

def slugify(text):
    return _re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

def auto_create_make_clubs(conn):
    """Create clubs for popular car makes if they don't exist."""
    makes = ["Honda", "Toyota", "Ford", "Chevrolet", "BMW", "Mercedes-Benz",
             "Audi", "Mazda", "Nissan", "Subaru", "Dodge", "Jeep", "Porsche",
             "Volkswagen", "Hyundai", "Kia", "Tesla", "Lexus", "Mustang", "Camaro"]
    for make in makes:
        slug = slugify(make)
        existing = conn.execute("SELECT id FROM clubs WHERE slug = ?", (slug,)).fetchone()
        if not existing:
            conn.execute("""
                INSERT OR IGNORE INTO clubs (name, slug, description, make, is_auto, member_count, created_at)
                VALUES (?, ?, ?, ?, 1, 0, ?)
            """, (f"{make} Club", slug, f"The official RideInsight club for {make} enthusiasts.",
                  make, datetime.utcnow().strftime("%Y-%m-%d %H:%M")))

@app.route("/clubs")
def clubs_page():
    if "user_id" not in session:
        return redirect(url_for("login"))
    conn = get_db_connection()
    auto_create_make_clubs(conn)
    conn.commit()
    conn.close()
    return render_template("clubs.html")

@app.route("/clubs/<slug>")
def club_page(slug):
    if "user_id" not in session:
        return redirect(url_for("login"))
    conn = get_db_connection()
    club = conn.execute("SELECT * FROM clubs WHERE slug = ?", (slug,)).fetchone()
    conn.close()
    if not club:
        return redirect(url_for("clubs_page"))
    return render_template("club_detail.html", club=dict(club))

@app.route("/api/clubs")
def get_clubs():
    uid   = session.get("user_id")
    sort  = request.args.get("sort", "members")
    q     = sanitize(request.args.get("q", ""))
    conn  = get_db_connection()
    auto_create_make_clubs(conn)
    conn.commit()

    where = "WHERE c.name LIKE ?" if q else ""
    params = [f"%{q}%"] if q else []
    order  = "ORDER BY c.member_count DESC" if sort == "members" else "ORDER BY c.id DESC"

    clubs = conn.execute(f"""
        SELECT c.*,
            (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id AND cm.user_id = ?) as is_member,
            (SELECT role FROM club_members cm WHERE cm.club_id = c.id AND cm.user_id = ?) as my_role
        FROM clubs c
        {where}
        {order}
    """, [uid, uid] + params).fetchall()
    conn.close()
    return jsonify([dict(c) for c in clubs])

@app.route("/api/clubs/my")
def my_clubs():
    if "user_id" not in session:
        return jsonify([])
    conn  = get_db_connection()
    clubs = conn.execute("""
        SELECT c.*, cm.role, cm.joined_at
        FROM clubs c
        JOIN club_members cm ON cm.club_id = c.id
        WHERE cm.user_id = ?
        ORDER BY cm.joined_at DESC
    """, (session["user_id"],)).fetchall()
    conn.close()
    return jsonify([dict(c) for c in clubs])

@csrf.exempt
@app.route("/api/clubs/create", methods=["POST"])
def create_club():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data = request.json or {}
    name = sanitize(data.get("name", "")).strip()
    desc = sanitize(data.get("description", "")).strip()
    make = sanitize(data.get("make", "")).strip()

    if not name or len(name) < 3:
        return jsonify({"error": "Club name must be at least 3 characters"}), 400

    slug = slugify(name)
    conn = get_db_connection()
    existing = conn.execute("SELECT id FROM clubs WHERE slug = ?", (slug,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "A club with that name already exists"}), 400

    conn.execute("""
        INSERT INTO clubs (name, slug, description, make, is_auto, created_by, member_count, created_at)
        VALUES (?,?,?,?,0,?,1,?)
    """, (name, slug, desc, make, session["user_id"],
          datetime.utcnow().strftime("%Y-%m-%d %H:%M")))

    club_id = conn.execute("SELECT id FROM clubs WHERE slug = ?", (slug,)).fetchone()["id"]
    conn.execute("""
        INSERT INTO club_members (club_id, user_id, role, joined_at)
        VALUES (?,?,?,?)
    """, (club_id, session["user_id"], "admin",
          datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.commit()
    conn.close()
    return jsonify({"message": "Club created", "slug": slug})

@csrf.exempt
@app.route("/api/clubs/<int:club_id>/join", methods=["POST"])
def join_club(club_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM club_members WHERE club_id=? AND user_id=?",
        (club_id, session["user_id"])
    ).fetchone()
    if existing:
        # Leave
        conn.execute("DELETE FROM club_members WHERE club_id=? AND user_id=?",
                     (club_id, session["user_id"]))
        conn.execute("UPDATE clubs SET member_count = MAX(0, member_count-1) WHERE id=?", (club_id,))
        conn.commit(); conn.close()
        return jsonify({"joined": False})
    conn.execute("""
        INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES (?,?,?,?)
    """, (club_id, session["user_id"], "member",
          datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.execute("UPDATE clubs SET member_count = member_count+1 WHERE id=?", (club_id,))
    conn.commit(); conn.close()
    return jsonify({"joined": True})

@app.route("/api/clubs/<slug>/info")
def club_info(slug):
    uid  = session.get("user_id")
    conn = get_db_connection()
    club = conn.execute("""
        SELECT c.*,
            (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id AND cm.user_id = ?) as is_member,
            (SELECT role FROM club_members WHERE club_id = c.id AND user_id = ?) as my_role
        FROM clubs c WHERE c.slug = ?
    """, (uid, uid, slug)).fetchone()

    members = conn.execute("""
        SELECT u.id, u.username, u.avatar, u.main_car, cm.role, cm.joined_at
        FROM club_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.club_id = ?
        ORDER BY CASE cm.role WHEN 'admin' THEN 0 ELSE 1 END, cm.joined_at ASC
    """, (club["id"],)).fetchall() if club else []
    conn.close()

    return jsonify({
        "club":    dict(club) if club else None,
        "members": [dict(m) for m in members]
    })

@app.route("/api/clubs/<slug>/posts")
def club_posts(slug):
    uid  = session.get("user_id")
    conn = get_db_connection()
    club = conn.execute("SELECT id FROM clubs WHERE slug=?", (slug,)).fetchone()
    if not club:
        return jsonify([])
    posts = conn.execute("""
        SELECT cp.*, u.avatar, u.main_car,
            (SELECT COUNT(*) FROM club_post_likes WHERE post_id=cp.id AND user_id=?) as user_liked
        FROM club_posts cp
        LEFT JOIN users u ON u.username = cp.username
        WHERE cp.club_id = ?
        ORDER BY cp.id DESC
    """, (uid, club["id"])).fetchall()
    conn.close()
    return jsonify([dict(p) for p in posts])

@csrf.exempt
@app.route("/api/clubs/<slug>/post", methods=["POST"])
def club_post(slug):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    club = conn.execute("SELECT id FROM clubs WHERE slug=?", (slug,)).fetchone()
    if not club:
        conn.close()
        return jsonify({"error": "Club not found"}), 404
    member = conn.execute(
        "SELECT id FROM club_members WHERE club_id=? AND user_id=?",
        (club["id"], session["user_id"])
    ).fetchone()
    if not member:
        conn.close()
        return jsonify({"error": "Join the club to post"}), 403

    title = sanitize(request.form.get("title", ""))
    body  = sanitize(request.form.get("body", ""))
    if not title or not body:
        conn.close()
        return jsonify({"error": "Title and body required"}), 400

    image = save_upload("image")
    conn.execute("""
        INSERT INTO club_posts (club_id, user_id, username, title, body, image, likes, created_at)
        VALUES (?,?,?,?,?,?,0,?)
    """, (club["id"], session["user_id"], session["username"], title, body, image,
          datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.commit(); conn.close()
    return jsonify({"message": "Posted"})

@csrf.exempt
@app.route("/api/clubs/post/<int:post_id>/like", methods=["POST"])
def like_club_post(post_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM club_post_likes WHERE user_id=? AND post_id=?",
        (session["user_id"], post_id)
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM club_post_likes WHERE id=?", (existing["id"],))
        conn.execute("UPDATE club_posts SET likes=MAX(0,likes-1) WHERE id=?", (post_id,))
        conn.commit(); conn.close()
        return jsonify({"liked": False})
    conn.execute("INSERT INTO club_post_likes (user_id, post_id) VALUES (?,?)",
                 (session["user_id"], post_id))
    conn.execute("UPDATE club_posts SET likes=likes+1 WHERE id=?", (post_id,))
    conn.commit(); conn.close()
    return jsonify({"liked": True})

@csrf.exempt
@app.route("/api/clubs/<int:club_id>/delete", methods=["POST"])
def delete_club(club_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    me = conn.execute(
        "SELECT role FROM club_members WHERE club_id=? AND user_id=?",
        (club_id, session["user_id"])
    ).fetchone()
    if not me or me["role"] != "admin":
        conn.close()
        return jsonify({"error": "Admins only"}), 403
    # Delete everything related to this club
    conn.execute("DELETE FROM club_post_likes WHERE post_id IN (SELECT id FROM club_posts WHERE club_id=?)", (club_id,))
    conn.execute("DELETE FROM club_posts WHERE club_id=?",   (club_id,))
    conn.execute("DELETE FROM club_members WHERE club_id=?", (club_id,))
    conn.execute("DELETE FROM clubs WHERE id=?",             (club_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Club deleted"})

@csrf.exempt
@app.route("/api/clubs/<int:club_id>/promote", methods=["POST"])
def promote_member(club_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data      = request.json or {}
    target_id = int(data.get("user_id", 0))
    new_role  = sanitize(data.get("role", "member"))
    if new_role not in ("admin", "member"):
        return jsonify({"error": "Invalid role"}), 400
    conn = get_db_connection()
    # Must be admin
    me = conn.execute(
        "SELECT role FROM club_members WHERE club_id=? AND user_id=?",
        (club_id, session["user_id"])
    ).fetchone()
    if not me or me["role"] != "admin":
        conn.close()
        return jsonify({"error": "Admins only"}), 403
    conn.execute(
        "UPDATE club_members SET role=? WHERE club_id=? AND user_id=?",
        (new_role, club_id, target_id)
    )
    conn.commit(); conn.close()
    return jsonify({"message": f"Role updated to {new_role}"})

# ─── Messages ─────────────────────────────────────────────────────
@app.route("/messages")
def messages():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("messages.html")

@app.route("/messages/<username>")
def messages_thread(username):
    if "user_id" not in session:
        return redirect(url_for("login"))
    conn = get_db_connection()
    other = conn.execute("SELECT id, username, avatar FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not other:
        return redirect(url_for("messages"))
    return render_template("messages.html", thread_user=dict(other))

@app.route("/api/conversations")
def get_conversations():
    if "user_id" not in session:
        return jsonify([])
    uid = session["user_id"]
    conn = get_db_connection()
    # Get the true latest message per conversation partner
    rows = conn.execute("""
        SELECT
            u.id, u.username, u.avatar,
            m.body as last_msg, m.created_at, m.is_read, m.sender_id,
            (SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND sender_id = u.id AND is_read = 0) as unread
        FROM messages m
        JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
        WHERE m.id IN (
            SELECT MAX(id) FROM messages
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
        )
        ORDER BY m.id DESC
    """, (uid, uid, uid, uid, uid)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/messages/<int:other_id>")
def get_thread(other_id):
    if "user_id" not in session:
        return jsonify([])
    uid = session["user_id"]
    conn = get_db_connection()
    msgs = conn.execute("""
        SELECT m.*, u.username, u.avatar
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
    """, (uid, other_id, other_id, uid)).fetchall()
    # Mark as read
    conn.execute("""
        UPDATE messages SET is_read = 1
        WHERE receiver_id = ? AND sender_id = ?
    """, (uid, other_id))
    conn.commit()
    conn.close()
    return jsonify([dict(m) for m in msgs])

@csrf.exempt
@app.route("/api/send_message", methods=["POST"])
def send_message():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data        = request.json or {}
    receiver_id = int(data.get("receiver_id", 0))
    body        = sanitize(data.get("body", "")).strip()

    if not body or not receiver_id:
        return jsonify({"error": "Missing fields"}), 400
    if receiver_id == session["user_id"]:
        return jsonify({"error": "Cannot message yourself"}), 400

    conn = get_db_connection()
    # Check receiver exists
    rec = conn.execute("SELECT id FROM users WHERE id = ?", (receiver_id,)).fetchone()
    if not rec:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    conn.execute("""
        INSERT INTO messages (sender_id, receiver_id, body, is_read, created_at)
        VALUES (?, ?, ?, 0, ?)
    """, (session["user_id"], receiver_id, body, datetime.utcnow().strftime("%Y-%m-%d %H:%M")))

    # Create notification for receiver
    sender_username = session.get("username", "Someone")
    conn.execute("""
        INSERT INTO notifications (user_id, text, is_read, created_at, link)
        VALUES (?, ?, 0, ?, ?)
    """, (receiver_id, f"💬 {sender_username} sent you a message",
          datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
          f"/messages/{sender_username}"))

    conn.commit()
    conn.close()
    return jsonify({"message": "Sent"})

@app.route("/api/me")
def api_me():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    return jsonify({"id": session["user_id"], "username": session.get("username", "")})

@app.route("/api/search_users")
def api_search_users():
    if "user_id" not in session:
        return jsonify([])
    q = sanitize(request.args.get("q", "")).strip()
    if len(q) < 1:
        return jsonify([])
    conn = get_db_connection()
    users = conn.execute("""
        SELECT id, username, avatar FROM users
        WHERE username LIKE ? AND id != ?
        LIMIT 10
    """, (f"%{q}%", session["user_id"])).fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

# ─── Settings ─────────────────────────────────────────────────────
@app.route("/settings")
def settings():
    if "user_id" not in session:
        return redirect(url_for("login"))
    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    conn.close()
    return render_template("settings.html", user=dict(user) if user else {})


@csrf.exempt
@app.route("/settings/update_cars", methods=["POST"])
def update_cars():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data          = request.json or {}
    main_car      = sanitize(data.get("main_car", "")).strip()
    secondary_car = sanitize(data.get("secondary_car", "")).strip()
    conn = get_db_connection()
    conn.execute("UPDATE users SET main_car = ?, secondary_car = ? WHERE id = ?",
                 (main_car, secondary_car, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Cars updated"})

@csrf.exempt
@app.route("/settings/update_account", methods=["POST"])
def update_account():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data     = request.json or {}
    username = sanitize(data.get("username", "")).strip()
    email    = sanitize(data.get("email", "")).strip()

    if not username or not email:
        return jsonify({"error": "Username and email are required"}), 400
    if "@" in username:
        return jsonify({"error": "Username cannot contain @"}), 400
    if not re.match(r"^[\w\-]{1,50}$", username):
        return jsonify({"error": "Username can only contain letters, numbers, - and _"}), 400

    conn = get_db_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?",
            (username, email, session["user_id"])
        ).fetchone()
        if existing:
            conn.close()
            return jsonify({"error": "Username or email already taken"}), 400

        conn.execute("UPDATE users SET username = ?, email = ? WHERE id = ?",
                     (username, email, session["user_id"]))
        conn.commit()
        conn.close()
        return jsonify({"message": "Account updated", "username": username, "email": email})
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500


@csrf.exempt
@app.route("/settings/change_password", methods=["POST"])
def change_password():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data         = request.json or {}
    current_pw   = data.get("current_password", "")
    new_pw       = data.get("new_password", "")

    if not current_pw or not new_pw:
        return jsonify({"error": "Both current and new password required"}), 400
    if len(new_pw) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT password FROM users WHERE id = ?", (session["user_id"],)).fetchone()

    if not user or not check_password_hash(user["password"], current_pw):
        conn.close()
        return jsonify({"error": "Current password is incorrect"}), 400

    new_hash = generate_password_hash(new_pw)
    conn.execute("UPDATE users SET password = ? WHERE id = ?", (new_hash, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Password changed successfully"})


@csrf.exempt
@app.route("/settings/update_privacy", methods=["POST"])
def update_privacy():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data           = request.json or {}
    is_private     = 1 if data.get("is_private") else 0
    dm_permission  = sanitize(data.get("dm_permission", "everyone"))
    if dm_permission not in ("everyone", "followers", "nobody"):
        dm_permission = "everyone"

    conn = get_db_connection()
    conn.execute("UPDATE users SET is_private = ?, dm_permission = ? WHERE id = ?",
                 (is_private, dm_permission, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Privacy settings updated"})


@csrf.exempt
@app.route("/settings/update_notifications", methods=["POST"])
def update_notifications():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data    = request.json or {}
    email_n = 1 if data.get("email_notifications") else 0
    inapp_n = 1 if data.get("inapp_notifications") else 0

    conn = get_db_connection()
    conn.execute("UPDATE users SET email_notifications = ?, inapp_notifications = ? WHERE id = ?",
                 (email_n, inapp_n, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Notification settings updated"})


@csrf.exempt
@app.route("/settings/update_theme", methods=["POST"])
def update_theme():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data       = request.json or {}
    dark_mode  = 1 if data.get("dark_mode") else 0

    conn = get_db_connection()
    conn.execute("UPDATE users SET dark_mode = ? WHERE id = ?", (dark_mode, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Theme updated"})

@csrf.exempt
@app.route("/settings/update_color_scheme", methods=["POST"])
def update_color_scheme():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data   = request.json or {}
    scheme = sanitize(data.get("color_scheme", "blue"))
    if scheme not in ("blue", "red", "green", "orange", "purple"):
        scheme = "blue"
    conn = get_db_connection()
    conn.execute("UPDATE users SET color_scheme = ? WHERE id = ?", (scheme, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": "Color scheme updated"})


@csrf.exempt
@app.route("/settings/delete_account", methods=["POST"])
def delete_account():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data     = request.json or {}
    password = data.get("password", "")
    user_id  = session["user_id"]

    conn = get_db_connection()
    user = conn.execute("SELECT password FROM users WHERE id = ?", (user_id,)).fetchone()

    if not user or not check_password_hash(user["password"], password):
        conn.close()
        return jsonify({"error": "Incorrect password"}), 400

    username = session.get("username", "")

    # 1) Mods hang off garage rows — delete before garage
    try:
        conn.execute("DELETE FROM mods WHERE car_id IN (SELECT id FROM garage WHERE user_id = ?)", (user_id,))
    except Exception:
        pass

    # 2) Tables keyed by user_id
    tables_with_user_id = [
        "garage", "comparisons", "likes", "dislikes", "builds",
        "notifications", "race_results", "saved_posts", "user_badges",
        "generated_models", "listing_saves", "poll_votes",
        "story_views", "meet_rsvps", "club_members",
        "comment_likes", "comment_dislikes", "listings", "stories", "meets",
    ]
    for table in tables_with_user_id:
        try:
            conn.execute(f"DELETE FROM {table} WHERE user_id = ?", (user_id,))
        except Exception:
            pass

    # 3) Tables keyed by username (posts/comments store the name, not the id)
    if username:
        for table in ("posts", "comments", "club_posts"):
            try:
                conn.execute(f"DELETE FROM {table} WHERE username = ?", (username,))
            except Exception:
                pass

    # 4) Relationship tables with two-sided keys
    try:
        conn.execute("DELETE FROM follows WHERE follower_id = ? OR following_id = ?", (user_id, user_id))
    except Exception:
        pass
    try:
        conn.execute("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?", (user_id, user_id))
    except Exception:
        pass

    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    session.clear()
    return jsonify({"message": "Account deleted"})


@app.route("/get_saved_posts")
def get_saved_posts():
    if "user_id" not in session:
        return jsonify([])
    conn  = get_db_connection()
    posts = conn.execute("""
        SELECT p.*, u.username, u.avatar, sp.created_at as saved_at
        FROM saved_posts sp
        JOIN posts p ON p.id = sp.post_id
        JOIN users u ON u.id = p.user_id
        WHERE sp.user_id = ?
        ORDER BY sp.id DESC
    """, (session["user_id"],)).fetchall()
    conn.close()
    return jsonify([dict(p) for p in posts])


@csrf.exempt
@app.route("/toggle_save_post/<int:post_id>", methods=["POST"])
def toggle_save_post(post_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn     = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM saved_posts WHERE user_id = ? AND post_id = ?",
        (session["user_id"], post_id)
    ).fetchone()

    if existing:
        conn.execute("DELETE FROM saved_posts WHERE id = ?", (existing["id"],))
        conn.commit()
        conn.close()
        return jsonify({"saved": False})
    else:
        conn.execute(
            "INSERT INTO saved_posts (user_id, post_id, created_at) VALUES (?, ?, ?)",
            (session["user_id"], post_id, datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
        )
        conn.commit()
        conn.close()
        return jsonify({"saved": True})

@app.route("/api/trending_news")
def trending_news():
    api_key = os.getenv("GNEWS_API_KEY", "")
    if not api_key:
        return jsonify({"error": "No GNEWS_API_KEY set"}), 500
    query = "cars OR electric vehicles OR motorcycles OR boats OR automotive OR EV"
    try:
        r = requests.get("https://gnews.io/api/v4/search", params={
            "q":      query,
            "lang":   "en",
            "max":    10,
            "apikey": api_key,
            "sortby": "publishedAt",
        }, timeout=8)
        data = r.json()
        articles = []
        for a in data.get("articles", []):
            articles.append({
                "title":       a.get("title", ""),
                "description": a.get("description", ""),
                "url":         a.get("url", ""),
                "image":       a.get("image", ""),
                "source":      a.get("source", {}).get("name", ""),
                "published":   a.get("publishedAt", "")[:10],
            })
        return jsonify(articles)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── GIF Search (Tenor) ───────────────────────────────────────────
@app.route("/api/gif_search")
def gif_search():
    q       = sanitize(request.args.get("q", "cars"))
    api_key = os.getenv("KLIPY_API_KEY", os.getenv("TENOR_API_KEY", ""))
    if not api_key:
        return jsonify({"error": "GIF API key not set — add KLIPY_API_KEY to .env"}), 500
    try:
        # Klipy API — key is in the URL path, not a query param
        # Format: https://api.klipy.com/api/v1/{key}/gifs/search?q=...
        r    = requests.get(
            f"https://api.klipy.com/api/v1/{api_key}/gifs/search",
            params={"q": q, "limit": 20},
            timeout=8
        )
        app.logger.info(f"Klipy status: {r.status_code} body: {r.text[:200]}")
        data = r.json()
        gifs = []
        # Klipy structure: body.data.data[].file.hd.gif.url
        results = data.get("data", {}).get("data", [])
        for result in results:
            file_ = result.get("file", {})
            # prefer sd over hd for faster loading
            sd  = file_.get("sd", file_.get("hd", {}))
            hd  = file_.get("hd", {})
            url     = hd.get("gif",  {}).get("url", "")
            preview = sd.get("gif",  {}).get("url", "") or sd.get("webp", {}).get("url", "") or url
            if url:
                gifs.append({"url": url, "preview": preview or url})
        return jsonify(gifs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Link Preview ─────────────────────────────────────────────────
@csrf.exempt
@app.route("/api/link_preview", methods=["POST"])
def link_preview():
    data = request.json or {}
    url  = data.get("url", "").strip()
    if not url.startswith("http"):
        return jsonify({"error": "Invalid URL"}), 400
    try:
        import re as _re
        r    = requests.get(url, timeout=6, headers={"User-Agent": "RideInsight/1.0"})
        html = r.text[:50000]

        def meta(prop):
            m = _re.search(rf'<meta[^>]+(?:property|name)=["\'](?:og:|twitter:)?{prop}["\'][^>]+content=["\']([^"\']*)["\']', html, _re.I)
            if not m:
                m = _re.search(rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\'](?:og:|twitter:)?{prop}["\']', html, _re.I)
            return m.group(1).strip() if m else ""

        title = meta("title") or _re.search(r"<title[^>]*>([^<]+)</title>", html, _re.I)
        if hasattr(title, "group"):
            title = title.group(1).strip()

        return jsonify({
            "url":         url,
            "title":       title or url,
            "image":       meta("image"),
            "description": meta("description")[:200] if meta("description") else "",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Race ─────────────────────────────────────────────────────────
@app.route("/race")
def race():
    return render_template("race.html")

# ─── Leaderboard ──────────────────────────────────────────────────
@app.route("/leaderboard")
def leaderboard():
    if "user_id" not in session:
        return redirect(url_for("login"))
    return render_template("leaderboard.html")

@app.route("/api/leaderboard")
def api_leaderboard():
    import json as _json
    conn = get_db_connection()

    # 1. Top Builders — ranked by total build value (base_price + parts cost)
    builds_raw = conn.execute("""
        SELECT b.user_id, b.base_price, b.parts_json,
               u.username, u.avatar, u.main_car,
               COUNT(b.id) OVER (PARTITION BY b.user_id) as build_count
        FROM builds b JOIN users u ON u.id = b.user_id
    """).fetchall()

    builder_totals = {}
    for b in builds_raw:
        uid = b["user_id"]
        parts_cost = sum(p.get("cost", 0) for p in (_json.loads(b["parts_json"] or "[]")))
        total = b["base_price"] + parts_cost
        if uid not in builder_totals:
            builder_totals[uid] = {
                "user_id": uid, "username": b["username"],
                "avatar": b["avatar"], "main_car": b["main_car"],
                "build_count": b["build_count"], "total_value": 0
            }
        builder_totals[uid]["total_value"] += total

    top_builders = sorted(builder_totals.values(), key=lambda x: x["total_value"], reverse=True)[:10]

    # 2. Most Liked Posts
    top_posts = conn.execute("""
        SELECT p.id, p.username, p.title, p.body, p.likes, p.image, p.car, p.created_at,
               u.avatar
        FROM posts p LEFT JOIN users u ON u.username = p.username
        ORDER BY p.likes DESC LIMIT 10
    """).fetchall()

    # 3. Race Champions — most wins
    race_champs = conn.execute("""
        SELECT r.user_id, u.username, u.avatar, u.main_car,
               SUM(r.won) as wins,
               COUNT(r.id) as total_races,
               ROUND(100.0 * SUM(r.won) / COUNT(r.id), 1) as win_rate
        FROM race_results r JOIN users u ON u.id = r.user_id
        GROUP BY r.user_id
        ORDER BY wins DESC LIMIT 10
    """).fetchall()

    # 4. Most Followed
    most_followed = conn.execute("""
        SELECT u.id, u.username, u.avatar, u.main_car,
               COUNT(f.id) as followers
        FROM users u LEFT JOIN follows f ON f.following_id = u.id
        GROUP BY u.id
        ORDER BY followers DESC LIMIT 10
    """).fetchall()

    conn.close()
    return jsonify({
        "builders":     top_builders,
        "posts":        [dict(p) for p in top_posts],
        "race_champs":  [dict(r) for r in race_champs],
        "most_followed":[dict(u) for u in most_followed],
    })

@csrf.exempt
@app.route("/save_race_result", methods=["POST"])
def save_race_result():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data = request.json or {}
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO race_results (user_id, mode, player_build, opp_build, won, time, created_at)
        VALUES (?,?,?,?,?,?,?)
    """, (
        session["user_id"],
        sanitize(data.get("mode", "")),
        sanitize(data.get("player_build", "")),
        sanitize(data.get("opp_build", "")),
        1 if data.get("won") else 0,
        sanitize(data.get("time", "")),
        datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    ))
    conn.commit()
    try:
        check_and_award_badges(conn, session["user_id"])
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"message": "Saved"})

@app.route("/get_race_results")
def get_race_results():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT * FROM race_results WHERE user_id=? ORDER BY id DESC LIMIT 20
    """, (session["user_id"],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/get_race_users")
def get_race_users():
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    # Users who have saved builds, excluding self
    rows = conn.execute("""
        SELECT DISTINCT u.id, u.username FROM users u
        INNER JOIN builds b ON b.user_id = u.id
        WHERE u.id != ?
    """, (session["user_id"],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/get_user_builds/<int:user_id>")
def get_user_builds(user_id):
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, name, base_year, base_make, base_model FROM builds WHERE user_id=? ORDER BY id DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

# ─── Badges ───────────────────────────────────────────────────────
@app.route("/api/badges/<username>")
def get_badges(username):
    conn = get_db_connection()
    user = conn.execute("SELECT id FROM users WHERE username=? COLLATE NOCASE", (username,)).fetchone()
    if not user:
        conn.close()
        return jsonify([])
    # Always recompute so existing activity is retroactively credited
    try:
        check_and_award_badges(conn, user["id"])
        conn.commit()
    except Exception:
        pass
    rows = conn.execute(
        "SELECT badge_key, awarded_at FROM user_badges WHERE user_id=? ORDER BY id ASC",
        (user["id"],)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        key = r["badge_key"]
        if key in BADGES:
            result.append({**BADGES[key], "key": key, "awarded_at": r["awarded_at"]})
    return jsonify(result)

# ─── Stories ──────────────────────────────────────────────────────
@app.route("/api/stories")
def get_stories():
    uid  = session.get("user_id")
    conn = get_db_connection()
    # Active stories only (not expired), newest first per user
    rows = conn.execute("""
        SELECT s.*, u.avatar,
            (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as view_count,
            CASE WHEN ? IS NOT NULL THEN
                (SELECT COUNT(*) FROM story_views sv2 WHERE sv2.story_id = s.id AND sv2.viewer_id = ?)
            ELSE 0 END as viewed_by_me
        FROM stories s
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.expires_at > datetime('now')
        ORDER BY s.created_at DESC
    """, (uid, uid)).fetchall()
    conn.close()
    # Group by user — one slot per user (latest story shown)
    seen_users = {}
    result = []
    for r in rows:
        d = dict(r)
        d["time"]   = time_ago(d["created_at"])
        d["is_own"] = 1 if (uid and d["user_id"] == uid) else 0
        if d["user_id"] not in seen_users:
            seen_users[d["user_id"]] = True
            result.append(d)
    # Put own story first if present
    result.sort(key=lambda x: -x["is_own"])
    return jsonify(result)

@csrf.exempt
@app.route("/api/stories/add", methods=["POST"])
def add_story():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    content    = sanitize(request.form.get("content", ""))
    image_path = save_upload("image")
    if not content and not image_path:
        return jsonify({"error": "Story needs text or an image"}), 400
    now     = datetime.utcnow()
    expires = now.replace(hour=now.hour).strftime("%Y-%m-%d %H:%M")
    from datetime import timedelta
    expires = (now + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M")
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO stories (user_id, username, content, image, created_at, expires_at)
        VALUES (?,?,?,?,?,?)
    """, (session["user_id"], session["username"], content, image_path,
          now.strftime("%Y-%m-%d %H:%M"), expires))
    conn.commit()
    try:
        check_and_award_badges(conn, session["user_id"])
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"message": "Story posted"})

@csrf.exempt
@app.route("/api/stories/view/<int:story_id>", methods=["POST"])
def view_story(story_id):
    if "user_id" not in session:
        return jsonify({"ok": True})
    conn = get_db_connection()
    try:
        conn.execute("INSERT OR IGNORE INTO story_views (story_id, viewer_id) VALUES (?,?)",
                     (story_id, session["user_id"]))
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"ok": True})

# ─── Car Meets ────────────────────────────────────────────────────
@app.route("/meets")
def meets():
    return render_template("meets.html")

@app.route("/api/meets")
def get_meets():
    uid  = session.get("user_id")
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT m.*,
            (SELECT COUNT(*) FROM meet_rsvps r WHERE r.meet_id = m.id) as rsvp_count,
            CASE WHEN ? IS NOT NULL THEN
                (SELECT COUNT(*) FROM meet_rsvps r2 WHERE r2.meet_id = m.id AND r2.user_id = ?)
            ELSE 0 END as user_rsvpd
        FROM meets m
        ORDER BY m.meet_date ASC, m.id DESC
    """, (uid, uid)).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["time"] = time_ago(d["created_at"])
        result.append(d)
    return jsonify(result)

@csrf.exempt
@app.route("/api/meets/create", methods=["POST"])
def create_meet():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    title       = sanitize(request.form.get("title", ""))
    description = sanitize(request.form.get("description", ""))
    location    = sanitize(request.form.get("location", ""))
    meet_date   = sanitize(request.form.get("meet_date", ""))
    meet_time   = sanitize(request.form.get("meet_time", ""))
    image_path  = save_upload("image")
    if not title or not meet_date:
        return jsonify({"error": "Title and date required"}), 400
    conn = get_db_connection()
    conn.execute("""
        INSERT INTO meets (user_id, username, title, description, location, meet_date, meet_time, image, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (session["user_id"], session["username"], title, description, location,
          meet_date, meet_time, image_path,
          datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.commit()
    try:
        check_and_award_badges(conn, session["user_id"])
        conn.commit()
    except Exception:
        pass
    conn.close()
    return jsonify({"message": "Meet created"})

@csrf.exempt
@app.route("/api/meets/rsvp/<int:meet_id>", methods=["POST"])
def rsvp_meet(meet_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    existing = conn.execute(
        "SELECT id FROM meet_rsvps WHERE meet_id=? AND user_id=?",
        (meet_id, session["user_id"])
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM meet_rsvps WHERE id=?", (existing["id"],))
        action = "removed"
    else:
        conn.execute("INSERT INTO meet_rsvps (meet_id, user_id) VALUES (?,?)",
                     (meet_id, session["user_id"]))
        action = "added"
    conn.commit()
    count = conn.execute(
        "SELECT COUNT(*) FROM meet_rsvps WHERE meet_id=?", (meet_id,)
    ).fetchone()[0]
    conn.close()
    return jsonify({"action": action, "rsvp_count": count})

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5001)