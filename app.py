import os
import re
import json
import uuid
import sqlite3
import requests
import bleach
from datetime import datetime
from dotenv import load_dotenv

from flask import (Flask, render_template, request, jsonify, session,
                   redirect, url_for, send_from_directory)
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
# Flask 3 dropped its re-export of escape; markupsafe is still a Flask dependency.
from markupsafe import escape
# Every third-party spec lookup goes through here, so the provider can be
# swapped or dropped without touching the routes. See providers.py.
import providers
# Per-user daily quotas and the global spend circuit breaker. Rate limits cap
# speed; these cap total consumption, which is what protects the bill.
import limits

load_dotenv()

app = Flask(__name__)

# Anything other than "development" is treated as production.
IS_PROD = os.getenv("FLASK_ENV", "development").lower() != "development"

# A known default secret key means anyone can forge a session cookie and log in
# as any user. Fine locally, fatal in production — so refuse to boot without it
# rather than starting up quietly insecure.
SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    if IS_PROD:
        raise RuntimeError(
            "SECRET_KEY is not set. Generate one with:\n"
            "    python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            "and set it as an environment variable on the host."
        )
    SECRET_KEY = "dev-only-not-for-production"
app.secret_key = SECRET_KEY

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
# Only send the session cookie over HTTPS in production. Enabling this locally
# would break sign-in over plain http://localhost.
app.config["SESSION_COOKIE_SECURE"] = IS_PROD
app.config["PERMANENT_SESSION_LIFETIME"] = 86400 * 7  # 7 days

# Both the database and user uploads have to live on the mounted persistent
# disk in production, or every redeploy wipes them. Locally the defaults keep
# everything in the project folder exactly as before.
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "static/uploads")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
# 25 MB, not 100. At 100 MB a 10 GB disk is only ~100 videos, and a full disk
# stops SQLite writing — a full-app outage, not just failed uploads. Most phone
# clips fit comfortably under 25 MB.
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024
ALLOWED_EXTENSIONS       = {"png", "jpg", "jpeg", "gif", "webp"}
ALLOWED_VIDEO_EXTENSIONS = {"mp4", "mov", "webm"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ─── Security extensions ────────────────────────────────────────
csrf = CSRFProtect(app)

def _rate_key():
    """Rate limit per account when signed in, per IP otherwise.

    Keying purely on IP punishes everyone behind one NAT — a university campus
    or an office looks like a single very busy visitor. Keying on the user id
    where we have one keeps the limit attached to the actor rather than the
    building.
    """
    uid = session.get("user_id")
    return f"user:{uid}" if uid else f"ip:{get_remote_address()}"


limiter = Limiter(
    key_func=_rate_key,
    app=app,
    # Previously empty, so 161 of 166 routes had no limit whatsoever. These are
    # a backstop that a normal session never reaches; anything genuinely
    # expensive gets its own stricter decorator below.
    default_limits=["1000 per hour", "60 per minute"],
    storage_uri=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
    strategy="fixed-window",
)

# NOTE: memory:// storage is per-process, so counters reset on restart and are
# not shared between workers. That is acceptable at one worker (see the
# Procfile) but the moment a second is added, set RATELIMIT_STORAGE_URI to a
# Redis URL or each worker will enforce its own separate allowance.

DB_NAME = os.getenv("DB_PATH", "rideinsight.db")

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

    # ── Builder ──
    "fabricator":    {"name": "Fabricator",     "icon": "🛠️", "color": "#ea580c", "desc": "Saved 5 custom builds"},
    "big_spender":   {"name": "Big Spender",    "icon": "💸", "color": "#16a34a", "desc": "Built a car with over $10,000 in mods"},
    "purist":        {"name": "Purist",         "icon": "🤍", "color": "#64748b", "desc": "Saved a completely stock build"},

    # ── Garage ──
    "two_car":       {"name": "Two-Car Garage", "icon": "🚙", "color": "#0891b2", "desc": "Added a second vehicle to your garage"},
    "fleet":         {"name": "Fleet",          "icon": "🏭", "color": "#1d4ed8", "desc": "10 or more vehicles in the garage"},

    # ── Comparison ──
    "researcher":    {"name": "Researcher",     "icon": "🔍", "color": "#7c3aed", "desc": "Saved your first comparison"},
    "analyst":       {"name": "Analyst",        "icon": "📈", "color": "#4338ca", "desc": "Saved 10 comparisons"},

    # ── Racing ──
    "undefeated":    {"name": "Undefeated",     "icon": "👑", "color": "#b45309", "desc": "Won 25 races"},
    "challenger":    {"name": "Challenger",     "icon": "⚔️", "color": "#be123c", "desc": "Raced another user's build"},

    # ── Community ──
    "commentator":   {"name": "Commentator",    "icon": "💬", "color": "#0284c7", "desc": "Left 25 comments"},
    "club_founder":  {"name": "Club Founder",   "icon": "🏛️", "color": "#7e22ce", "desc": "Founded a car club"},
    "club_member":   {"name": "Joiner",         "icon": "🤝", "color": "#0d9488", "desc": "Joined 3 car clubs"},
    "regular":       {"name": "Regular",        "icon": "📅", "color": "#65a30d", "desc": "RSVP'd to 5 car meets"},
    "well_known":    {"name": "Well Known",     "icon": "🌟", "color": "#c026d3", "desc": "Gained 100 followers"},
    "prolific":      {"name": "Prolific",       "icon": "✍️", "color": "#9333ea", "desc": "Reached 50 posts on the feed"},

    # ── Marketplace ──
    "seller":        {"name": "Seller",         "icon": "🏷️", "color": "#f59e0b", "desc": "Posted your first marketplace listing"},

    # ── Profile ──
    "identified":    {"name": "Identified",     "icon": "🪪", "color": "#475569", "desc": "Added a profile picture and bio"},
    "connected":     {"name": "Connected",      "icon": "🔗", "color": "#2563eb", "desc": "Linked a social account"},

    # ── Spotting ──
    "spotter":       {"name": "Spotter",        "icon": "📷", "color": "#0ea5e9", "desc": "Had your first photo approved"},
    "field_scout":   {"name": "Field Scout",    "icon": "🔭", "color": "#0369a1", "desc": "10 approved photos"},
    "trailblazer":   {"name": "Trailblazer",    "icon": "🚩", "color": "#e11d48", "desc": "First to photograph 5 different models"},

    # ── Meta ──
    "completionist": {"name": "Completionist",  "icon": "💯", "color": "#dc2626", "desc": "Earned 15 other badges"},
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

    # ── Extended badges ──────────────────────────────────────────
    # Every query below is wrapped, because a missing table or column on an
    # older database must not stop the badges above from being awarded.
    def safe(fn):
        try:    return fn()
        except Exception: return None

    if post_count >= 50: award("prolific")
    if build_count >= 5: award("fabricator")
    if car_count  >= 2:  award("two_car")
    if car_count  >= 10: award("fleet")
    if win_count  >= 25: award("undefeated")
    if follower_count >= 100: award("well_known")

    # Build spend — parts_json is a list of {cost} entries
    def _build_spend():
        import json as _json
        rows = conn.execute("SELECT parts_json FROM builds WHERE user_id=?", (user_id,)).fetchall()
        best, has_stock = 0, False
        for r in rows:
            try:    parts = _json.loads(r["parts_json"] or "[]")
            except Exception: continue
            spend = sum(float(p.get("cost") or 0) for p in parts if isinstance(p, dict))
            best = max(best, spend)
            # "Stock" means no paid parts, not an empty build
            if parts and spend == 0: has_stock = True
        return best, has_stock
    res = safe(_build_spend)
    if res:
        best_spend, has_stock = res
        if best_spend >= 10000: award("big_spender")
        if has_stock:           award("purist")

    # Comparisons saved
    cmp_count = safe(lambda: conn.execute(
        "SELECT COUNT(*) FROM comparisons WHERE user_id=?", (user_id,)).fetchone()[0])
    if cmp_count:
        if cmp_count >= 1:  award("researcher")
        if cmp_count >= 10: award("analyst")

    # Raced a real user's build rather than the AI
    pvp = safe(lambda: conn.execute(
        "SELECT COUNT(*) FROM race_results WHERE user_id=? AND opp_build IS NOT NULL "
        "AND opp_build != '' AND opp_build NOT LIKE '%Daily Driver%' "
        "AND opp_build NOT LIKE '%Camry%' AND opp_build NOT LIKE '%Street Build%' "
        "AND opp_build NOT LIKE '%Monster%'", (user_id,)).fetchone()[0])
    if pvp and pvp >= 1: award("challenger")

    # Comments left
    comment_count = safe(lambda: conn.execute(
        "SELECT COUNT(*) FROM comments WHERE username=(SELECT username FROM users WHERE id=?)",
        (user_id,)).fetchone()[0])
    if comment_count and comment_count >= 25: award("commentator")

    # Clubs founded / joined
    founded = safe(lambda: conn.execute(
        "SELECT COUNT(*) FROM clubs WHERE created_by=? AND is_auto=0", (user_id,)).fetchone()[0])
    if founded and founded >= 1: award("club_founder")

    joined = safe(lambda: conn.execute(
        "SELECT COUNT(*) FROM club_members WHERE user_id=?", (user_id,)).fetchone()[0])
    if joined and joined >= 3: award("club_member")

    # Meets attended
    rsvps = safe(lambda: conn.execute(
        "SELECT COUNT(*) FROM meet_rsvps WHERE user_id=?", (user_id,)).fetchone()[0])
    if rsvps and rsvps >= 5: award("regular")

    # Marketplace listing
    listed = safe(lambda: conn.execute(
        "SELECT COUNT(*) FROM listings WHERE user_id=?", (user_id,)).fetchone()[0])
    if listed and listed >= 1: award("seller")

    # Profile completeness
    prof = safe(lambda: conn.execute(
        "SELECT avatar, bio FROM users WHERE id=?", (user_id,)).fetchone())
    if prof and (prof["avatar"] or "").strip() and (prof["bio"] or "").strip():
        award("identified")

    socials = safe(lambda: conn.execute(
        "SELECT social_instagram, social_tiktok, social_youtube, social_x, "
        "social_reddit, social_facebook, social_website FROM users WHERE id=?",
        (user_id,)).fetchone())
    if socials and any((v or "").strip() for v in tuple(socials)):
        award("connected")

    # Approved community photos
    shots = safe(lambda: conn.execute(
        "SELECT COUNT(*) FROM vehicle_photos WHERE user_id=? AND status='approved'",
        (user_id,)).fetchone()[0])
    if shots:
        if shots >= 1:  award("spotter")
        if shots >= 10: award("field_scout")

    # Models this user photographed before anyone else. A model counts as
    # "claimed" by whoever has the lowest approved photo id for that key.
    firsts = safe(lambda: conn.execute("""
        SELECT COUNT(*) FROM (
            SELECT vehicle_key, MIN(id) AS first_id
            FROM vehicle_photos WHERE status='approved'
            GROUP BY vehicle_key
        ) f
        JOIN vehicle_photos p ON p.id = f.first_id
        WHERE p.user_id = ?
    """, (user_id,)).fetchone()[0])
    if firsts and firsts >= 5: award("trailblazer")

    # Meta badge — counted last so it sees everything awarded above
    if len(earned - {"completionist"}) >= 15: award("completionist")

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

# ─── CAPTCHA (Cloudflare Turnstile) ──────────────────────────────
# Turnstile rather than reCAPTCHA: free with no request ceiling, usually
# invisible to real users, and no data sharing with an ad network. The site
# key is public by design; the secret is not.
#
# Both unset means the check is skipped, so local development needs no keys.
# It refuses to be skipped in production — an unconfigured CAPTCHA that
# silently passes everything is worse than none, because you believe you have
# one.
TURNSTILE_SITE_KEY = os.getenv("TURNSTILE_SITE_KEY", "")
TURNSTILE_SECRET   = os.getenv("TURNSTILE_SECRET", "")
TURNSTILE_VERIFY   = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_captcha():
    """Returns (ok, message). Fails closed in production."""
    if not TURNSTILE_SECRET:
        if IS_PROD:
            app.logger.error("TURNSTILE_SECRET is not set — refusing signups.")
            return False, "Sign-ups are temporarily unavailable. Please try later."
        return True, ""          # local dev

    token = request.form.get("cf-turnstile-response", "")
    if not token:
        return False, "Please complete the human verification check."

    try:
        resp = requests.post(TURNSTILE_VERIFY, timeout=8, data={
            "secret":   TURNSTILE_SECRET,
            "response": token,
            "remoteip": get_remote_address(),
        })
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        # Cloudflare being unreachable shouldn't hand the door to bots.
        app.logger.warning("Turnstile verification failed: %s", exc)
        return False, "Could not complete verification. Please try again."

    if not data.get("success"):
        return False, "Verification failed. Please try again."
    return True, ""


def sanitize(text):
    """Strip all HTML tags from user-supplied text."""
    if not text:
        return ""
    return bleach.clean(str(text), tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True).strip()

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_video(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS

class StorageQuotaExceeded(Exception):
    """Raised when a user has filled their share of the disk."""

    def __init__(self, payload):
        super().__init__(payload.get("detail", "Storage limit reached"))
        self.payload = payload


def save_upload(file_field):
    """Save an uploaded file and return its URL path, or empty string.

    Raises StorageQuotaExceeded when the account is out of space. MAX_CONTENT_
    LENGTH caps a single upload; this caps the running total, which is what
    actually protects a shared 10 GB disk from one enthusiastic user.
    """
    if file_field not in request.files:
        return ""
    f = request.files[file_field]
    if f.filename == "":
        return ""
    checker = allowed_video if file_field == "video" else allowed_file
    if not checker(f.filename):
        return ""

    uid = session.get("user_id")
    if uid:
        # Size without reading the file into memory.
        f.seek(0, os.SEEK_END)
        incoming = f.tell()
        f.seek(0)
        conn = get_db_connection()
        try:
            denied = limits.check_storage(conn, uid, app.config["UPLOAD_FOLDER"],
                                          incoming)
        finally:
            conn.close()
        if denied:
            raise StorageQuotaExceeded(denied[0])
    # Make every upload unique. Keeping the original name meant two users
    # uploading "IMG_1234.jpg" — or any two cropped covers, which are all
    # named cover.jpg — would silently overwrite each other's file.
    safe = secure_filename(f.filename) or "upload"
    stem, ext = os.path.splitext(safe)
    filename = f"{stem[:40]}_{uuid.uuid4().hex[:12]}{ext.lower()}"
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    f.save(path)
    # Return a stable /uploads/ URL rather than the filesystem path. In
    # production UPLOAD_FOLDER sits on the mounted disk, outside static/,
    # where Flask's static handler cannot reach it — so the path and the URL
    # can no longer be the same string. served by uploaded_file() below.
    return "/uploads/" + filename

# Every column that can point at a file we host. delete_upload() consults this
# before removing anything, so a file still in use is never deleted. Add new
# upload-bearing columns here or they will not be protected.
UPLOAD_REFERENCE_COLUMNS = [
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


def _still_referenced(conn, filename):
    """Is any surviving row still pointing at this file?

    Uploads used to be saved under their original name, so two people — or one
    person twice — uploading "cover.jpg" wrote to the same file on disk. Those
    older rows share a physical file, which means deleting one row's image
    silently destroys another's. Newer uploads carry a uuid and can't collide,
    but the old ones are still out there.

    Matching on the filename (rather than the full stored path) also covers the
    legacy "/static/uploads/x.jpg" form and the current "/uploads/x.jpg" both
    pointing at the same thing.
    """
    like = f"%{filename}"
    for table, cols in UPLOAD_REFERENCE_COLUMNS:
        for col in cols:
            try:
                hit = conn.execute(
                    f"SELECT 1 FROM {table} WHERE {col} LIKE ? LIMIT 1", (like,)
                ).fetchone()
            except sqlite3.Error:
                continue        # table or column absent
            if hit:
                return True
    # listings.images is a JSON array of paths.
    try:
        hit = conn.execute(
            "SELECT 1 FROM listings WHERE images LIKE ? LIMIT 1", (like,)
        ).fetchone()
        if hit:
            return True
    except sqlite3.Error:
        pass
    return False


def delete_upload(*urls):
    """Delete uploaded files given the URLs stored in the database.

    Called wherever a row holding an upload is removed. Without this, deleting
    a post left its image on disk forever — still publicly fetchable by anyone
    who had the URL — and the privacy policy's promise that deleting an account
    removes its content was not actually true.

    Safe against three things it will genuinely encounter:

      * External URLs. gif_url and link_image point at Klipy and at scraped
        link previews, not at our disk. Anything with a scheme is skipped.
      * Path traversal. Only the basename is used, and the resolved path must
        still sit inside UPLOAD_FOLDER, so a crafted value like
        "../../app.py" cannot escape.
      * Files that are already gone. Deletion is best-effort; a missing file
        or a permissions error must never take down the request that is
        deleting the row.
    """
    base = os.path.abspath(app.config["UPLOAD_FOLDER"])
    candidates = []
    for url in urls:
        if not url or not isinstance(url, str):
            continue
        if url.startswith(("http://", "https://", "//", "data:")):
            continue
        name = os.path.basename(url.split("?")[0].strip())
        if not name or name in (".", ".."):
            continue
        path = os.path.abspath(os.path.join(base, name))
        if os.path.commonpath([base, path]) != base:
            app.logger.warning("delete_upload refused suspicious path: %r", url)
            continue
        candidates.append((name, path))

    if not candidates:
        return 0

    # Callers delete their rows first, then call this — so anything still
    # referencing the file belongs to a different row that is keeping it alive.
    removed = 0
    conn = get_db_connection()
    try:
        for name, path in candidates:
            if _still_referenced(conn, name):
                app.logger.info("Kept %s — still referenced elsewhere", name)
                continue
            try:
                if os.path.isfile(path):
                    os.remove(path)
                    removed += 1
            except OSError as exc:
                app.logger.warning("Could not delete %s: %s", path, exc)
    finally:
        conn.close()
    return removed


@app.after_request
def security_headers(response):
    """Baseline security headers — there were none before.

    CSP note: the app uses inline onclick handlers and inline <script> blocks
    throughout, so 'unsafe-inline' is unavoidable without a large refactor.
    The policy is still worth setting: it pins *where* scripts, styles, images
    and connections may come from, which blocks the injection of a remote
    payload even if markup escaping is bypassed somewhere.

    frame-ancestors 'none' is the modern clickjacking defence; X-Frame-Options
    is kept alongside it for older browsers.
    """
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' "
        "https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net "
        "https://challenges.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        # Uploads, remote vehicle photography and generated thumbnails.
        "img-src 'self' data: blob: https:; "
        "media-src 'self' blob: https:; "
        "connect-src 'self' https:; "
        "frame-src https://challenges.cloudflare.com; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'"
    )
    response.headers.setdefault("Content-Security-Policy", csp)
    # Stops the browser guessing a content type — an uploaded file that sniffs
    # as HTML would otherwise execute in our origin.
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()")
    if IS_PROD:
        # A year, and only in production — sending this over local http would
        # pin the browser to https for a host that doesn't serve it.
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.errorhandler(StorageQuotaExceeded)
def handle_storage_quota(exc):
    """One handler so every upload route reports the quota the same way."""
    return jsonify(exc.payload), 429


@app.errorhandler(429)
def handle_rate_limited(exc):
    """Rate limits should read as a clear message, not a generic error page."""
    if request.path.startswith("/api/") or request.is_json:
        return jsonify({
            "error": "Too many requests",
            "detail": "You're going a bit fast. Wait a moment and try again.",
        }), 429
    return render_template("error.html",
                           message="You're going a bit fast — "
                                   "wait a moment and try again."), 429


@app.errorhandler(413)
def handle_too_large(exc):
    """MAX_CONTENT_LENGTH rejects the request before any view runs."""
    mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
    return jsonify({
        "error": "File too large",
        "detail": f"Uploads are limited to {mb} MB.",
    }), 413


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    """Serve user uploads from wherever UPLOAD_FOLDER points.

    Needed because in production that folder is on the mounted disk rather
    than inside static/. send_from_directory resolves the path safely and
    rejects traversal attempts, so a crafted filename cannot escape the
    directory.

    Legacy /static/uploads/... URLs stored in older rows still resolve locally,
    where the folder really is under static/.
    """
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


def get_db_connection():
    # gunicorn runs 2 workers x 4 threads, so up to 8 connections share this
    # one file. On SQLite's defaults a second writer doesn't queue — it fails
    # immediately with "database is locked", which in production looks like a
    # random 500 whenever two people post at the same moment.
    #
    #   timeout      wait for a held lock instead of giving up instantly
    #   journal_mode=WAL   readers no longer block the writer, and vice versa
    #   busy_timeout       same wait applied inside SQLite itself
    #   synchronous=NORMAL safe under WAL and much faster than FULL
    #
    # WAL needs a real local filesystem. If this ever moves to a network mount
    # the journal mode must be reconsidered — that is a good moment to move to
    # Postgres instead.
    conn = sqlite3.connect(DB_NAME, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=15000")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
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
    # Rendered preview of the build, captured in the 3D builder on save.
    try:
        conn.execute("ALTER TABLE builds ADD COLUMN thumbnail TEXT DEFAULT ''")
    except Exception:
        pass

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

    # Waitlist signups from the landing page
    conn.execute("""
        CREATE TABLE IF NOT EXISTS waitlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            source TEXT DEFAULT 'landing',
            created_at TEXT DEFAULT ''
        )
    """)
    # Optional follow-up answers, collected after the email is saved.
    # location decides which city has enough density to launch first.
    for col, ddl in [("location", "TEXT DEFAULT ''"),
                     ("vehicle",  "TEXT DEFAULT ''"),
                     ("interest", "TEXT DEFAULT ''"),
                     ("token",    "TEXT DEFAULT ''")]:
        try:
            conn.execute(f"ALTER TABLE waitlist ADD COLUMN {col} {ddl}")
        except Exception:
            pass

    # "See it in the wild" — owner photos attached to a vehicle, held for
    # review before they appear. vehicle_key is a normalised make+model so a
    # 2016 photo shows for every year of that model.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS vehicle_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_key TEXT NOT NULL,
            vehicle_type TEXT DEFAULT 'car',
            make TEXT DEFAULT '',
            model TEXT DEFAULT '',
            year TEXT DEFAULT '',
            image TEXT NOT NULL,
            caption TEXT DEFAULT '',
            user_id INTEGER,
            username TEXT DEFAULT '',
            status TEXT DEFAULT 'pending',
            reviewed_by INTEGER,
            reviewed_at TEXT DEFAULT '',
            created_at TEXT DEFAULT ''
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vphotos_key "
                 "ON vehicle_photos (vehicle_key, status)")

    # Admin flag — gates the photo review queue
    try:
        conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0")
    except Exception:
        pass

    # Usage quotas — persisted so they survive a restart, unlike the
    # in-memory rate limiter.
    limits.init_quota_tables(conn)
    limits.prune_old_usage(conn)

    # ── User safety ───────────────────────────────────────────────
    # These were previously created lazily inside the block/report routes,
    # which meant any query reading them failed until someone had blocked or
    # reported for the first time. Creating them up front lets the feed filter
    # on blocks from the very first request.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS blocks (
            blocker_id INTEGER,
            blocked_id INTEGER,
            created_at TEXT DEFAULT '',
            PRIMARY KEY (blocker_id, blocked_id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id)")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reporter_id INTEGER,
            reported_username TEXT DEFAULT '',
            target_type TEXT DEFAULT 'user',   -- user | post | comment
            target_id INTEGER,
            reason TEXT DEFAULT '',
            status TEXT DEFAULT 'open',        -- open | actioned | dismissed
            reviewed_by INTEGER,
            reviewed_at TEXT DEFAULT '',
            created_at TEXT DEFAULT ''
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status)")
    # Older databases had a reports table without these columns.
    for col, ddl in (("target_type", "TEXT DEFAULT 'user'"),
                     ("target_id", "INTEGER"),
                     ("status", "TEXT DEFAULT 'open'"),
                     ("reviewed_by", "INTEGER"),
                     ("reviewed_at", "TEXT DEFAULT ''")):
        try:
            conn.execute(f"ALTER TABLE reports ADD COLUMN {col} {ddl}")
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
                "social_x", "social_website", "social_reddit", "social_facebook"]:
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

    # Blocking is only real if it's enforced on read. Filtering here rather
    # than in each query keeps one definition of "blocked" for the feed and
    # the search results both.
    hidden = blocked_usernames(conn, uid)
    if hidden:
        rows = [r for r in rows if (r["username"] or "").lower() not in hidden]
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

@limiter.limit("30 per hour")
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

@app.route("/delete_post/<int:post_id>", methods=["POST"])
def delete_post(post_id):
    """Delete your own post.

    This route did not exist, so users could not remove their own posts at all
    — while the privacy policy told them they could edit or delete posts at any
    time. Moderators reach the same behaviour through the reports queue.
    """
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401

    conn = get_db_connection()
    post = conn.execute("SELECT username, image, video_url FROM posts WHERE id=?",
                        (post_id,)).fetchone()
    if not post:
        conn.close()
        return jsonify({"error": "Post not found"}), 404

    # Posts are keyed by username rather than user_id.
    if (post["username"] or "").lower() != (session.get("username") or "").lower():
        conn.close()
        return jsonify({"error": "Not authorized"}), 403

    for table, col in (("comments", "post_id"), ("likes", "post_id"),
                       ("dislikes", "post_id"), ("saved_posts", "post_id"),
                       ("poll_votes", "post_id")):
        try:
            conn.execute(f"DELETE FROM {table} WHERE {col}=?", (post_id,))
        except sqlite3.Error:
            pass
    conn.execute("DELETE FROM posts WHERE id=?", (post_id,))
    conn.commit()
    conn.close()

    delete_upload(post["image"], post["video_url"])
    return jsonify({"message": "Post deleted"})


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
    hidden = blocked_usernames(conn, uid)
    conn.close()
    return jsonify([dict(r) for r in rows
                    if (r["username"] or "").lower() not in hidden])

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
    # Replies are fetched by their own endpoint, so filtering get_comments()
    # alone left a blocked user's replies visible one tap deeper.
    hidden = blocked_usernames(conn, uid)
    conn.close()
    return jsonify([dict(r) for r in rows
                    if (r["username"] or "").lower() not in hidden])

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

@limiter.limit("100 per hour")
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
    hidden = blocked_usernames(conn, session.get("user_id"))
    return jsonify([{**dict(r), "time": time_ago(r["created_at"])} for r in rows
                    if (r["username"] or "").lower() not in hidden])

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

@limiter.limit("120 per hour")
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

@limiter.limit("120 per hour")
@app.route("/api/search_motorcycle")
def search_motorcycle():
    make  = sanitize(request.args.get("make", ""))
    model = sanitize(request.args.get("model", ""))
    year  = sanitize(request.args.get("year", ""))
    # The frontend merges this with the local motoData entry, which is the
    # more accurate of the two wherever they disagree. An empty list here is
    # a normal outcome, not an error — it just means the local data stands.
    return jsonify(providers.fetch_moto_specs(make, model, year))

@limiter.limit("120 per hour")
@app.route("/api/search_vehicle")
def search_vehicle():
    make  = sanitize(request.args.get("make", ""))
    model = sanitize(request.args.get("model", ""))
    year  = sanitize(request.args.get("year", ""))
    return jsonify(providers.fetch_car_specs(make, model, year))

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

# ─── Legal / support pages ────────────────────────────────────────
# These are required before launch and again by the app stores later.
# Content lives here rather than in templates so the three pages share one
# layout and the "last updated" dates stay in one place.
LEGAL_UPDATED = "6 September 2026"
SUPPORT_EMAIL = "rideinsightapp@gmail.com"

@app.route("/support")
def support():
    body = f"""
    <p>RideInsight is built and run by one person, so you're emailing the
    developer directly — not a support queue.</p>

    <h3>Get in touch</h3>
    <p><a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a></p>
    <p>Expect a reply within a few days. Including your username and a
    screenshot makes bugs much faster to fix.</p>

    <h3>What to include for a bug report</h3>
    <ul>
      <li>What you were doing when it happened</li>
      <li>What you expected instead</li>
      <li>Your browser and whether you're on phone or desktop</li>
      <li>A screenshot if the problem is visual</li>
    </ul>

    <h3>Common questions</h3>
    <p><strong>The 3D builder won't load.</strong> It needs WebGL. Try a
    different browser, and make sure hardware acceleration is enabled.
    Models are large, so the first load on mobile data can be slow.</p>

    <p><strong>Will these parts fit my car?</strong> Not necessarily. The
    builder shows how parts look and roughly what they cost. Fitment isn't
    verified — always confirm size, offset and application with the seller
    before buying.</p>

    <p><strong>The specs on a vehicle are wrong.</strong> Vehicle data comes
    from third-party sources and our own records, and both contain errors.
    Email the correction and it'll get fixed.</p>

    <p><strong>Delete my account.</strong> Settings &rarr; Delete Account
    removes your account and its content. It can't be undone.</p>
    """
    return render_template("legal.html", title="Contact & Support",
                           icon="life-buoy", updated=None, body=body)

@app.route("/privacy")
def privacy():
    body = f"""
    <p>This policy explains what RideInsight collects, why, and what control
    you have over it. Plain language, no lawyer-speak where it can be avoided.</p>

    <h3>What we collect</h3>
    <ul>
      <li><strong>Account details</strong> — username, email, password (stored
          hashed, never in plain text).</li>
      <li><strong>Content you create</strong> — posts, comments, builds, garage
          vehicles, comparisons, messages, club and meet activity.</li>
      <li><strong>Uploads</strong> — profile photos, banners and post images.</li>
      <li><strong>Basic technical data</strong> — the usual server logs, used to
          keep the site running and to investigate abuse.</li>
    </ul>

    <h3>What we don't do</h3>
    <ul>
      <li>We don't sell your personal information.</li>
      <li>We don't run behavioural advertising.</li>
      <li>We don't read your private messages except where required to
          investigate a report of abuse.</li>
    </ul>

    <h3>Third parties</h3>
    <p>RideInsight uses the following outside services. Where a request is sent
    on your behalf it contains the vehicle you searched for, not your identity,
    unless stated otherwise.</p>
    <ul>
      <li><strong>API Ninjas</strong> and <strong>NHTSA vPIC</strong> —
          vehicle specifications and model lists.</li>
      <li><strong>FuelEconomy.gov</strong> (US Dept. of Energy) — fuel economy
          figures, where used.</li>
      <li><strong>Tripo3D</strong> — generates 3D vehicle models. See
          "AI features" below.</li>
      <li><strong>Unsplash</strong> — stock vehicle photography.</li>
      <li><strong>Klipy</strong> — the GIF picker. Searching for a GIF sends
          your search term to Klipy.</li>
      <li><strong>GNews</strong> — automotive news headlines.</li>
      <li><strong>Web3Forms</strong> — receives waitlist sign-ups from the
          marketing site, including the email address you enter.</li>
      <li><strong>Render</strong> — hosts the application and stores its
          database and uploaded files.</li>
      <li><strong>Cloudflare</strong> — serves the marketing site.</li>
    </ul>
    <p>Some parts in the builder link to external retailers; those links may be
    affiliate links, meaning RideInsight may earn a commission at no extra cost
    to you. Once you follow a link, that retailer's own privacy policy applies.</p>

    <h3>AI features</h3>
    <p>RideInsight uses a third-party AI service, <strong>Tripo3D</strong>, to
    generate 3D models of vehicles for the builder. Depending on the vehicle,
    this is done either from a text description (the year, make and model) or
    by sending a vehicle photograph to Tripo3D for conversion into a 3D model.
    Generated models are stored so the same vehicle does not have to be
    generated twice.</p>
    <p>These are the only AI features in RideInsight. There is no chatbot or
    assistant, and your posts, comments, messages and personal information are
    not sent to any AI service and are not used to train AI models.</p>

    <h3>Cookies</h3>
    <p>We use a session cookie to keep you signed in and to remember your theme
    preference. That's it — no third-party tracking cookies.</p>

    <h3>Your control</h3>
    <ul>
      <li>Edit or delete your posts, builds and garage entries at any time.</li>
      <li>Delete your account from Settings. This permanently removes your
          account, posts, comments, builds, garage, listings and messages, and
          deletes the photos and videos you uploaded from our storage. It
          cannot be undone. Clubs you created are kept so their other members
          don't lose them, with your name removed. Server logs and recent
          backups may retain some data for a short period before they age
          out.</li>
      <li>Email <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a> to request
          a copy of your data or ask a question about this policy.</li>
    </ul>

    <h3>Children</h3>
    <p>RideInsight isn't directed at children under 13, and we don't knowingly
    collect their information. If you believe a child has created an account,
    email us and it will be removed.</p>

    <h3>Security</h3>
    <p>Passwords are hashed and requests are protected against cross-site
    request forgery. No service is perfectly secure, so please use a unique
    password here.</p>
    <p>Please note that images and videos you upload are served from
    unguessable public web addresses. That means anyone you share a link with
    can view that file without signing in, so treat anything you upload as
    public rather than private. When you delete the post or your account, the
    file is deleted and the link stops working.</p>

    <h3>Changes</h3>
    <p>If this policy changes materially, the date at the top of this page will
    change and significant updates will be announced in the app.</p>
    """
    return render_template("legal.html", title="Privacy Policy",
                           icon="shield", updated=LEGAL_UPDATED, body=body)

@app.route("/terms")
def terms():
    body = f"""
    <p>By creating an account or using RideInsight, you agree to these terms.</p>

    <h3>Your account</h3>
    <p>You must be at least 13 years old. Keep your password to yourself — you're
    responsible for what happens under your account. One person, one account.</p>

    <h3>Your content</h3>
    <p>You keep ownership of everything you post. By posting it, you grant
    RideInsight permission to display and distribute it within the platform so
    the app can function. You're responsible for having the right to post what
    you upload — don't post photos that aren't yours to share.</p>

    <h3>Acceptable use</h3>
    <p>Don't use RideInsight to harass, threaten or impersonate people; post
    illegal content, spam or malware; scrape the site or hammer it with
    automated requests; or attempt to access accounts that aren't yours.
    Accounts that do these things may be suspended or removed.</p>
    <p><strong>There is no tolerance for objectionable content or abusive
    behaviour on RideInsight.</strong> That includes harassment, hate speech,
    threats, sexual content, content that exploits or endangers children, and
    anything illegal.</p>

    <h3>Reporting and moderation</h3>
    <p>You can report any post, comment or account from the menu on it, and you
    can block another user from their profile. Blocking hides that person's
    posts and comments from you and stops them messaging you.</p>
    <p>We review reports and aim to act on them within 24 hours. Content that
    breaches these terms is removed, and accounts that post it may be suspended
    or permanently removed without notice. If you believe we've got a decision
    wrong, email <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>.</p>

    <h3>Vehicle data and estimates</h3>
    <p>Specifications, valuations, running costs and performance figures shown
    on RideInsight are <strong>estimates for comparison purposes only</strong>.
    They come from third-party sources and our own calculations, and they will
    sometimes be wrong. Don't rely on them for a purchase, insurance,
    registration or any other decision with money attached. Verify with the
    manufacturer or seller.</p>

    <h3>Parts, fitment and affiliate links</h3>
    <p>The builder is a visualisation tool. Parts shown on a vehicle may not fit
    that vehicle, and prices change without notice. Confirm fitment and price
    with the retailer before you buy. Some outbound links are affiliate links,
    and RideInsight may earn a commission from purchases made through them at no
    extra cost to you. We aren't a party to your transaction with any retailer
    and can't help with their orders, shipping or returns.</p>

    <h3>Meets and marketplace</h3>
    <p>Car meets and marketplace listings are created by users, not by
    RideInsight. We don't verify listings, vet attendees or inspect vehicles.
    Meet people in public places, inspect anything before you buy it, and use
    your judgement — you're dealing with the other person, not with us.</p>

    <h3>Availability</h3>
    <p>RideInsight is provided as-is, without warranty. It may go down, lose
    data, or change features. Keep your own copies of anything you'd hate to
    lose.</p>

    <h3>Liability</h3>
    <p>To the extent permitted by law, RideInsight isn't liable for indirect or
    consequential losses arising from your use of the platform, including
    decisions made on the basis of estimated vehicle data or parts information.</p>

    <h3>Ending things</h3>
    <p>You can delete your account at any time from Settings. We may suspend
    accounts that breach these terms.</p>

    <h3>Changes</h3>
    <p>These terms may change; the date at the top will be updated when they do.
    Questions go to <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>.</p>
    """
    return render_template("legal.html", title="Terms & Conditions",
                           icon="file-text", updated=LEGAL_UPDATED, body=body)

# ─── "See it in the wild" — community vehicle photos ──────────────
# Photos are keyed on make+model with the year kept only as a caption, so a
# 2016 Mazda 6 shot shows for every Mazda 6 search. Keying on the exact year
# would leave almost every search empty until the library got large.
def vehicle_key(make, model):
    key = f"{(make or '').strip().lower()} {(model or '').strip().lower()}"
    return re.sub(r"[^a-z0-9]+", "", key)

def is_admin_user(conn, user_id):
    if not user_id:
        return False
    row = conn.execute("SELECT is_admin FROM users WHERE id=?", (user_id,)).fetchone()
    return bool(row and row["is_admin"])

@app.route("/api/vehicle_photos")
def get_vehicle_photos():
    """Approved photos for a vehicle. Public — no login needed to look."""
    key = vehicle_key(request.args.get("make", ""), request.args.get("model", ""))
    if not key:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT id, image, caption, year, username, created_at
        FROM vehicle_photos
        WHERE vehicle_key=? AND status='approved'
        ORDER BY id DESC LIMIT 30
    """, (key,)).fetchall()

    # Whoever got an approved photo of this model in first, ever. Ordered by id
    # rather than approval time so the credit follows who submitted first, not
    # who happened to be reviewed first.
    first = conn.execute("""
        SELECT id FROM vehicle_photos
        WHERE vehicle_key=? AND status='approved'
        ORDER BY id ASC LIMIT 1
    """, (key,)).fetchone()
    first_id = first["id"] if first else None

    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["is_first"] = (d["id"] == first_id)
        out.append(d)
    return jsonify(out)

@app.route("/api/vehicle_photos/submit", methods=["POST"])
@limiter.limit("10 per hour")
def submit_vehicle_photo():
    if "user_id" not in session:
        return jsonify({"error": "Sign in to submit a photo"}), 401

    make  = sanitize(request.form.get("make", "")).strip()
    model = sanitize(request.form.get("model", "")).strip()
    year  = sanitize(request.form.get("year", "")).strip()[:4]
    caption = sanitize(request.form.get("caption", "")).strip()[:140]
    key = vehicle_key(make, model)
    if not key:
        return jsonify({"error": "Missing vehicle"}), 400

    image_path = save_upload("photo")
    if not image_path:
        return jsonify({"error": "No valid image provided"}), 400

    conn = get_db_connection()
    # Cap pending submissions per user so the queue can't be flooded.
    pending = conn.execute(
        "SELECT COUNT(*) FROM vehicle_photos WHERE user_id=? AND status='pending'",
        (session["user_id"],)
    ).fetchone()[0]
    if pending >= 5:
        conn.close()
        return jsonify({"error": "You already have 5 photos awaiting review."}), 429

    uname = conn.execute("SELECT username FROM users WHERE id=?",
                         (session["user_id"],)).fetchone()
    conn.execute("""
        INSERT INTO vehicle_photos
            (vehicle_key, vehicle_type, make, model, year, image, caption,
             user_id, username, status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?)
    """, (key, sanitize(request.form.get("type", "car")), make, model, year,
          image_path, caption, session["user_id"],
          uname["username"] if uname else "",
          datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.commit(); conn.close()
    return jsonify({"message": "Thanks — your photo is queued for review."})

@app.route("/admin/photos")
def admin_photos():
    conn = get_db_connection()
    if not is_admin_user(conn, session.get("user_id")):
        conn.close()
        return render_template("error.html", message="Not authorised."), 403
    rows = conn.execute("""
        SELECT * FROM vehicle_photos
        WHERE status='pending' ORDER BY id ASC
    """).fetchall()
    approved = conn.execute(
        "SELECT COUNT(*) FROM vehicle_photos WHERE status='approved'").fetchone()[0]
    conn.close()
    return render_template("admin_photos.html",
                           photos=[dict(r) for r in rows], approved_count=approved)

@app.route("/api/admin/photos/<int:photo_id>/<action>", methods=["POST"])
def review_vehicle_photo(photo_id, action):
    if action not in ("approve", "reject"):
        return jsonify({"error": "Unknown action"}), 400
    conn = get_db_connection()
    if not is_admin_user(conn, session.get("user_id")):
        conn.close()
        return jsonify({"error": "Not authorised"}), 403

    photo = conn.execute("SELECT * FROM vehicle_photos WHERE id=?", (photo_id,)).fetchone()
    if not photo:
        conn.close()
        return jsonify({"error": "Not found"}), 404

    status = "approved" if action == "approve" else "rejected"
    conn.execute("""
        UPDATE vehicle_photos SET status=?, reviewed_by=?, reviewed_at=? WHERE id=?
    """, (status, session["user_id"],
          datetime.utcnow().strftime("%Y-%m-%d %H:%M"), photo_id))

    if photo["user_id"]:
        if status == "approved":
            # Did this claim the model? Check after the update above.
            first = conn.execute("""
                SELECT id, user_id FROM vehicle_photos
                WHERE vehicle_key=? AND status='approved'
                ORDER BY id ASC LIMIT 1
            """, (photo["vehicle_key"],)).fetchone()
            claimed = bool(first and first["id"] == photo_id)
            msg = (f"🚩 First ever photo of the {photo['make']} {photo['model']} — that one's yours"
                   if claimed else
                   f"📸 Your photo of the {photo['make']} {photo['model']} is now live")
            add_notification(conn, photo["user_id"], msg,
                             link=f"/compare?type={photo['vehicle_type']}")
        else:
            add_notification(conn, photo["user_id"],
                f"Your photo of the {photo['make']} {photo['model']} wasn't approved")

        # Approving a photo can earn Spotter, Field Scout or Trailblazer.
        try:
            check_and_award_badges(conn, photo["user_id"])
        except Exception:
            pass

    conn.commit(); conn.close()
    return jsonify({"message": status})

# ─── Landing page + waitlist ──────────────────────────────────────
@app.route("/offline")
def offline():
    """Shown by the service worker when a navigation fails with no network."""
    return render_template("offline.html")


@app.route("/sw.js")
def service_worker():
    """Serve the worker from the site root.

    A service worker can only control pages at or below its own path, so one
    served from /static/sw.js could not intercept "/" — it has to be at the
    root to cover the whole app.
    """
    response = send_from_directory("static", "sw.js")
    response.headers["Content-Type"] = "application/javascript"
    # Browsers cache the worker itself; a stale one would keep serving old
    # assets long after a deploy.
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.route("/welcome")
def landing():
    return render_template("landing.html")

@csrf.exempt
@limiter.limit("10 per hour")
@app.route("/api/waitlist", methods=["POST"])
@limiter.limit("10 per hour")
def api_waitlist():
    import re as _re
    data  = request.json or {}
    email = sanitize(data.get("email", "")).strip().lower()[:200]

    if not _re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", email, _re.I):
        return jsonify({"error": "Enter a valid email address."}), 400

    # Where the signup came from, so campus pushes can be told apart from
    # social traffic without reading timestamps.
    source = sanitize(data.get("source", "")).strip()[:40] or "landing"

    conn = get_db_connection()
    # A short token returned to the browser so the follow-up questions can only
    # update this row. Without it, anyone could POST an email and overwrite
    # someone else's answers.
    token = uuid.uuid4().hex[:16]
    try:
        conn.execute(
            "INSERT INTO waitlist (email, source, token, created_at) VALUES (?,?,?,?)",
            (email, source, token, datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
        )
        conn.commit()
        msg = "You're on the list. We'll be in touch."
    except sqlite3.IntegrityError:
        # Already signed up — hand back the existing token so they can still
        # answer the optional questions rather than hitting a dead end.
        row = conn.execute("SELECT token FROM waitlist WHERE email=?", (email,)).fetchone()
        token = row["token"] if row and row["token"] else ""
        msg = "You're already on the list."
    finally:
        conn.close()
    return jsonify({"message": msg, "token": token})


@csrf.exempt
@app.route("/api/waitlist/details", methods=["POST"])
@limiter.limit("20 per hour")
def api_waitlist_details():
    """Optional follow-up questions, asked after the email is already saved.

    Kept separate from the signup itself: every extra field on the button
    costs conversions, so the email lands first and these are a bonus.
    Location is the one that matters — it decides which city launches first.
    """
    data  = request.json or {}
    token = sanitize(data.get("token", "")).strip()[:32]
    if not token:
        return jsonify({"error": "Missing token"}), 400

    location = sanitize(data.get("location", "")).strip()[:120]
    vehicle  = sanitize(data.get("vehicle", "")).strip()[:120]
    interest = sanitize(data.get("interest", "")).strip()[:40]

    conn = get_db_connection()
    cur = conn.execute("""
        UPDATE waitlist SET location=?, vehicle=?, interest=? WHERE token=?
    """, (location, vehicle, interest, token))
    conn.commit()
    updated = cur.rowcount
    conn.close()
    if not updated:
        return jsonify({"error": "Unknown signup"}), 404
    return jsonify({"message": "Thanks — that helps."})

@app.route("/api/waitlist/count")
def api_waitlist_count():
    conn = get_db_connection()
    n = conn.execute("SELECT COUNT(*) FROM waitlist").fetchone()[0]
    conn.close()
    return jsonify({"count": n})

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
@app.route("/settings/update_socials", methods=["POST"])
def update_socials():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    d = request.json or {}
    fields = ["instagram", "tiktok", "youtube", "x", "reddit", "facebook", "website"]
    vals = []
    for f in fields:
        v = sanitize(d.get(f, "")).strip()
        # Accept either a handle or a full URL; store as given (max 200 chars)
        vals.append(v[:200])
    conn = get_db_connection()
    conn.execute("""UPDATE users SET social_instagram=?, social_tiktok=?,
                    social_youtube=?, social_x=?, social_reddit=?,
                    social_facebook=?, social_website=? WHERE id=?""",
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
        # Bot check before anything else. Rate limits slow a scripted signup
        # flood down; they don't stop it, and every fake account costs storage,
        # quota and moderation attention.
        ok, why = verify_captcha()
        if not ok:
            return render_template("signup.html", error=why,
                                   turnstile_key=TURNSTILE_SITE_KEY)

        username      = sanitize(request.form.get("username", ""))
        email         = sanitize(request.form.get("email", ""))
        password      = request.form.get("password", "")
        main_car      = sanitize(request.form.get("main_car", "")).strip()
        secondary_car = sanitize(request.form.get("secondary_car", "")).strip()

        if len(username) < 3:
            return render_template("signup.html", error="Username must be at least 3 characters.", turnstile_key=TURNSTILE_SITE_KEY)
        # Restrict the character set. sanitize() strips HTML tags but leaves
        # quotes and semicolons intact, and usernames get rendered into
        # JavaScript in a couple of templates — so a name like
        #   "; alert(1); //
        # could break out of the string it was placed in. Templates now use
        # |tojson as well; this is the other half of that fix, and it also
        # rules out lookalike and whitespace-padded names.
        if len(username) > 30:
            return render_template("signup.html", error="Username must be 30 characters or fewer.", turnstile_key=TURNSTILE_SITE_KEY)
        if not re.fullmatch(r"[A-Za-z0-9_.\-]+", username):
            return render_template("signup.html", error="Username can only contain letters, numbers, underscores, dots and hyphens.", turnstile_key=TURNSTILE_SITE_KEY)
        if "@" in username:
            return render_template("signup.html", error="Username cannot be an email address — please choose a username like 'Aryoh_1'.", turnstile_key=TURNSTILE_SITE_KEY)
        if len(password) < 8:
            return render_template("signup.html", error="Password must be at least 8 characters.", turnstile_key=TURNSTILE_SITE_KEY)
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
            return render_template("signup.html", error="Username or email already exists.", turnstile_key=TURNSTILE_SITE_KEY)
    return render_template("signup.html", turnstile_key=TURNSTILE_SITE_KEY)

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
            # Clear first: anything an attacker managed to seed into the
            # session before sign-in must not survive the privilege change.
            session.clear()
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

@app.route("/remove_cover", methods=["POST"])
def remove_cover():
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    old = conn.execute("SELECT cover_photo FROM users WHERE id=?",
                       (session["user_id"],)).fetchone()
    conn.execute("UPDATE users SET cover_photo='' WHERE id=?", (session["user_id"],))
    conn.commit()
    conn.close()
    delete_upload(old["cover_photo"] if old else "")
    return jsonify({"message": "Cover removed"})

@limiter.limit("20 per hour")
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

def blocked_usernames(conn, user_id):
    """Usernames hidden from this user — blocks in either direction.

    Blocking is mutual by design: if A blocks B, neither should be shown the
    other's content. A one-way block still lets the blocked person follow and
    reply to someone who wanted rid of them, which is the situation blocking
    exists to end.

    Returns a set of lowercase usernames. Posts and comments are keyed by
    username rather than id, so comparison has to be name-based.
    """
    if not user_id:
        return set()
    try:
        rows = conn.execute("""
            SELECT u.username FROM blocks b
            JOIN users u ON u.id = CASE
                WHEN b.blocker_id = ? THEN b.blocked_id ELSE b.blocker_id END
            WHERE b.blocker_id = ? OR b.blocked_id = ?
        """, (user_id, user_id, user_id)).fetchall()
    except sqlite3.Error:
        return set()          # blocks table not created yet
    return {r["username"].lower() for r in rows if r["username"]}


def blocked_user_ids(conn, user_id):
    """Same, as ids — for tables keyed by user_id rather than username."""
    if not user_id:
        return set()
    try:
        rows = conn.execute(
            "SELECT blocker_id, blocked_id FROM blocks WHERE blocker_id=? OR blocked_id=?",
            (user_id, user_id)).fetchall()
    except sqlite3.Error:
        return set()
    out = set()
    for r in rows:
        out.add(r["blocked_id"] if r["blocker_id"] == user_id else r["blocker_id"])
    return out


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

@app.route("/api/blocked")
def get_blocked():
    """People you've blocked.

    Blocking was one-way with no way back: nothing listed who you'd blocked,
    and their content is hidden everywhere, so you couldn't reach their profile
    to undo it either. That made every block permanent by accident.
    """
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT u.username, u.avatar, b.created_at
        FROM blocks b JOIN users u ON u.id = b.blocked_id
        WHERE b.blocker_id = ?
        ORDER BY b.rowid DESC
    """, (session["user_id"],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/unblock/<username>", methods=["POST"])
def unblock_user(username):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    target = conn.execute("SELECT id FROM users WHERE username=? COLLATE NOCASE",
                          (username,)).fetchone()
    if not target:
        conn.close()
        return jsonify({"error": "User not found"}), 404
    # Only remove the block this user created. A block placed on them by the
    # other person is not theirs to lift.
    conn.execute("DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?",
                 (session["user_id"], target["id"]))
    conn.commit()
    conn.close()
    return jsonify({"message": f"@{username} has been unblocked."})


@app.route("/api/report/<username>", methods=["POST"])
def report_user(username):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    reason = sanitize((request.json or {}).get("reason", ""))[:500]
    conn = get_db_connection()
    conn.execute("""INSERT INTO reports
                    (reporter_id, reported_username, target_type, reason, status, created_at)
                    VALUES (?,?,'user',?, 'open', ?)""",
                 (session["user_id"], sanitize(username), reason,
                  datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.commit()
    conn.close()
    return jsonify({"message": "Report received. Thanks — we'll review it."})


@limiter.limit("20 per hour")
@app.route("/api/report_content", methods=["POST"])
def report_content():
    """Report a specific post or comment.

    Reporting a whole account was the only option before, which is a blunt
    instrument — and app reviewers specifically test reporting an individual
    piece of content.
    """
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data = request.json or {}
    target_type = (data.get("type") or "").lower()
    if target_type not in ("post", "comment"):
        return jsonify({"error": "Invalid report target"}), 400
    try:
        target_id = int(data.get("id", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid id"}), 400
    if not target_id:
        return jsonify({"error": "Invalid id"}), 400

    reason = sanitize(data.get("reason", ""))[:500]
    conn = get_db_connection()
    table = "posts" if target_type == "post" else "comments"
    row = conn.execute(f"SELECT username FROM {table} WHERE id=?", (target_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found"}), 404

    conn.execute("""INSERT INTO reports
                    (reporter_id, reported_username, target_type, target_id,
                     reason, status, created_at)
                    VALUES (?,?,?,?,?, 'open', ?)""",
                 (session["user_id"], row["username"], target_type, target_id,
                  reason, datetime.utcnow().strftime("%Y-%m-%d %H:%M")))
    conn.commit()
    conn.close()
    return jsonify({"message": "Report received. Thanks — we'll review it."})


@app.route("/admin/reports")
def admin_reports():
    """Review queue for reported users and content.

    Apple's UGC guideline requires not just a report button but somewhere the
    reports actually go. Before this, they were written to a table no screen
    ever read.
    """
    if "user_id" not in session:
        return redirect(url_for("login"))
    conn = get_db_connection()
    if not is_admin_user(conn, session["user_id"]):
        conn.close()
        return render_template("error.html", message="Not authorised."), 403

    status = request.args.get("status", "open")
    if status not in ("open", "actioned", "dismissed"):
        status = "open"
    rows = conn.execute(
        "SELECT * FROM reports WHERE status=? ORDER BY id DESC LIMIT 200", (status,)
    ).fetchall()

    reports = []
    for r in rows:
        d = dict(r)
        # Pull the reported content inline so a moderator can judge it without
        # hunting for the post.
        d["content"] = ""
        if d.get("target_type") in ("post", "comment") and d.get("target_id"):
            table = "posts" if d["target_type"] == "post" else "comments"
            try:
                hit = conn.execute(
                    f"SELECT body FROM {table} WHERE id=?", (d["target_id"],)
                ).fetchone()
                d["content"] = (hit["body"] or "") if hit else "[deleted]"
            except sqlite3.Error:
                pass
        reporter = conn.execute("SELECT username FROM users WHERE id=?",
                                (d.get("reporter_id"),)).fetchone()
        d["reporter"] = reporter["username"] if reporter else "[deleted]"
        reports.append(d)

    counts = {s: conn.execute("SELECT COUNT(*) FROM reports WHERE status=?",
                              (s,)).fetchone()[0]
              for s in ("open", "actioned", "dismissed")}
    conn.close()
    return render_template("admin_reports.html", reports=reports,
                           status=status, counts=counts)


@app.route("/api/admin/reports/<int:report_id>/<action>", methods=["POST"])
def review_report(report_id, action):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    if action not in ("actioned", "dismissed", "delete_content"):
        return jsonify({"error": "Unknown action"}), 400

    conn = get_db_connection()
    if not is_admin_user(conn, session["user_id"]):
        conn.close()
        return jsonify({"error": "Not authorised"}), 403

    report = conn.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
    if not report:
        conn.close()
        return jsonify({"error": "Not found"}), 404

    if action == "delete_content" and report["target_id"]:
        table = "posts" if report["target_type"] == "post" else "comments"
        if report["target_type"] in ("post", "comment"):
            if table == "posts":
                # Reuse the same cleanup a normal delete does, so a moderated
                # post doesn't leave its image on disk.
                row = conn.execute("SELECT image, video_url FROM posts WHERE id=?",
                                   (report["target_id"],)).fetchone()
                conn.execute("DELETE FROM comments WHERE post_id=?", (report["target_id"],))
                conn.execute("DELETE FROM posts WHERE id=?", (report["target_id"],))
                if row:
                    delete_upload(row["image"], row["video_url"])
            else:
                conn.execute("DELETE FROM comments WHERE id=?", (report["target_id"],))

    new_status = "dismissed" if action == "dismissed" else "actioned"
    conn.execute("""UPDATE reports SET status=?, reviewed_by=?, reviewed_at=?
                    WHERE id=?""",
                 (new_status, session["user_id"],
                  datetime.utcnow().strftime("%Y-%m-%d %H:%M"), report_id))

    # Close the loop with the reporter. A report that vanishes into silence
    # teaches people not to bother reporting — which is how a community stops
    # policing itself. Deliberately vague about the outcome: the reporter does
    # not need to know what happened to the other account.
    if report["reporter_id"]:
        note = ("Thanks for your report — we reviewed it and took action."
                if new_status == "actioned" else
                "Thanks for your report — we reviewed it and didn't find a "
                "breach of our rules this time.")
        try:
            add_notification(conn, report["reporter_id"], note)
        except Exception:
            pass      # never fail the moderation action over a notification

    conn.commit()
    conn.close()
    return jsonify({"message": f"Report {new_status}."})

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
    hidden = blocked_usernames(conn, session.get("user_id"))
    conn.close()
    return jsonify([dict(r) for r in rows
                    if (r["username"] or "").lower() not in hidden])

# Follow / Unfollow
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
@limiter.limit("5 per hour; 20 per day")
def generate_3d():
    # The only endpoint that spends money per call — Tripo3D bills per
    # generation. It previously had no rate limit and no quota at all, so a
    # single script could have emptied the account in minutes.
    if "user_id" not in session:
        return jsonify({"error": "Sign in to generate a model"}), 401

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
        # A cache hit costs nothing, so it must not consume anyone's quota.
        conn.close()
        return jsonify({
            "status":        "cached",
            "glb_url":       cached["glb_url"],
            "thumbnail_url": cached["thumbnail_url"],
        })

    # Only now, when this will actually hit the paid API, is the quota checked.
    denied = limits.check_quota(conn, session["user_id"], "generate_3d")
    if denied:
        conn.close()
        body, status = denied
        return jsonify(body), status

    limits.record_usage(conn, session["user_id"], "generate_3d")
    conn.commit()
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

    # Thumbnail rendered by the builder as a data URL. NOT run through
    # sanitize(): it's base64 image data, not markup, and escaping would
    # corrupt it. Validated by shape and capped instead.
    thumb = data.get("thumbnail", "") or ""
    if not re.match(r"^data:image/(jpeg|png);base64,[A-Za-z0-9+/=]+$", thumb) \
       or len(thumb) > 400_000:
        thumb = ""

    conn = get_db_connection()
    conn.execute("""
        INSERT INTO builds (user_id, name, base_year, base_make, base_model, base_trim, base_price, parts_json, car_color, thumbnail)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (
        session["user_id"], name,
        sanitize(base.get("year", "")), sanitize(base.get("make", "")),
        sanitize(base.get("model", "")), sanitize(base.get("trim", "")),
        base_price, json.dumps(clean_parts), car_color, thumb
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
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM builds WHERE id=?", (build_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Not found"}), 404
    return jsonify(dict(row))

@app.route("/delete_car/<int:car_id>", methods=["POST"])
def delete_car(car_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    car = conn.execute("SELECT user_id, image FROM garage WHERE id=?", (car_id,)).fetchone()
    if not car or car["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403
    conn.execute("DELETE FROM mods WHERE car_id=?", (car_id,))
    conn.execute("DELETE FROM garage WHERE id=?", (car_id,))
    delete_upload(car["image"])
    conn.commit()
    conn.close()
    return jsonify({"message": "Car deleted"})

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
    hidden = blocked_usernames(conn, session.get("user_id"))
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

    return jsonify([x for x in results
                    if (x.get("username") or "").lower() not in hidden])

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

@app.route("/api/listings/<int:listing_id>/delete", methods=["POST"])
def delete_listing(listing_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    listing = conn.execute("SELECT user_id, images FROM listings WHERE id=?", (listing_id,)).fetchone()
    if not listing or listing["user_id"] != session["user_id"]:
        conn.close()
        return jsonify({"error": "Not authorized"}), 403
    conn.execute("DELETE FROM listings WHERE id=?", (listing_id,))
    conn.execute("DELETE FROM listing_saves WHERE listing_id=?", (listing_id,))
    # listings.images is a JSON array, not a single path.
    try:
        delete_upload(*json.loads(listing["images"] or "[]"))
    except (ValueError, TypeError):
        pass
    conn.commit()
    conn.close()
    return jsonify({"message": "Deleted"})

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

# ─── Club roles and limits ────────────────────────────────────────
# Ranked so a check is just a >= comparison. Admins can do everything a
# moderator can; moderators can moderate content but not restructure the club.
CLUB_ROLES = {"member": 0, "moderator": 1, "admin": 2}

# One person shouldn't be able to squat dozens of club names.
MAX_CLUBS_PER_USER = 5
# Guards against one admin promoting an entire club to moderator.
MAX_MODERATORS_PER_CLUB = 10

def club_role(conn, club_id, user_id):
    """Return this user's role in the club, or None if they aren't a member."""
    if not user_id:
        return None
    row = conn.execute(
        "SELECT role FROM club_members WHERE club_id=? AND user_id=?",
        (club_id, user_id)
    ).fetchone()
    return row["role"] if row else None

def club_rank(conn, club_id, user_id):
    return CLUB_ROLES.get(club_role(conn, club_id, user_id) or "", -1)

def require_club_role(conn, club_id, user_id, minimum):
    """None if permitted, else a ready-to-return (json, status) tuple."""
    if club_rank(conn, club_id, user_id) < CLUB_ROLES[minimum]:
        label = "Admins" if minimum == "admin" else "Moderators and admins"
        return jsonify({"error": f"{label} only"}), 403
    return None

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

    # Cap how many clubs one person can create, so names can't be squatted.
    # Auto-generated make clubs don't count against the limit.
    mine = conn.execute(
        "SELECT COUNT(*) FROM clubs WHERE created_by=? AND is_auto=0",
        (session["user_id"],)
    ).fetchone()[0]
    if mine >= MAX_CLUBS_PER_USER:
        conn.close()
        return jsonify({"error": f"You can create up to {MAX_CLUBS_PER_USER} clubs. "
                                 f"Delete one first."}), 400

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
    hidden = blocked_usernames(conn, uid)
    return jsonify([dict(p) for p in posts
                    if (p["username"] or "").lower() not in hidden])

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

@app.route("/api/clubs/<int:club_id>/delete", methods=["POST"])
def delete_club(club_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    denied = require_club_role(conn, club_id, session["user_id"], "admin")
    if denied:
        conn.close(); return denied
    # Delete everything related to this club
    conn.execute("DELETE FROM club_post_likes WHERE post_id IN (SELECT id FROM club_posts WHERE club_id=?)", (club_id,))
    conn.execute("DELETE FROM club_posts WHERE club_id=?",   (club_id,))
    conn.execute("DELETE FROM club_members WHERE club_id=?", (club_id,))
    conn.execute("DELETE FROM clubs WHERE id=?",             (club_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Club deleted"})

@app.route("/api/clubs/<int:club_id>/promote", methods=["POST"])
def promote_member(club_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    data      = request.json or {}
    target_id = int(data.get("user_id", 0))
    new_role  = sanitize(data.get("role", "member"))
    if new_role not in CLUB_ROLES:
        return jsonify({"error": "Invalid role"}), 400

    conn = get_db_connection()
    denied = require_club_role(conn, club_id, session["user_id"], "admin")
    if denied:
        conn.close(); return denied

    if target_id == session["user_id"]:
        conn.close()
        return jsonify({"error": "You can't change your own role"}), 400

    target = conn.execute(
        "SELECT role FROM club_members WHERE club_id=? AND user_id=?",
        (club_id, target_id)
    ).fetchone()
    if not target:
        conn.close()
        return jsonify({"error": "That user isn't a member of this club"}), 404

    # A club must always keep at least one admin, or nobody can manage it.
    if target["role"] == "admin" and new_role != "admin":
        admins = conn.execute(
            "SELECT COUNT(*) FROM club_members WHERE club_id=? AND role='admin'",
            (club_id,)
        ).fetchone()[0]
        if admins <= 1:
            conn.close()
            return jsonify({"error": "A club needs at least one admin"}), 400

    if new_role == "moderator" and target["role"] != "moderator":
        mods = conn.execute(
            "SELECT COUNT(*) FROM club_members WHERE club_id=? AND role='moderator'",
            (club_id,)
        ).fetchone()[0]
        if mods >= MAX_MODERATORS_PER_CLUB:
            conn.close()
            return jsonify({"error": f"Limit of {MAX_MODERATORS_PER_CLUB} moderators"}), 400

    conn.execute(
        "UPDATE club_members SET role=? WHERE club_id=? AND user_id=?",
        (new_role, club_id, target_id)
    )
    club = conn.execute("SELECT name, slug FROM clubs WHERE id=?", (club_id,)).fetchone()
    if club and new_role != "member":
        add_notification(conn, target_id,
                         f"You're now a {new_role} of {club['name']}",
                         link=f"/clubs/{club['slug']}")
    conn.commit(); conn.close()
    return jsonify({"message": f"Role updated to {new_role}"})

@app.route("/api/clubs/<int:club_id>/remove_member", methods=["POST"])
def remove_club_member(club_id):
    """Moderators and admins can remove members. Only admins can remove mods."""
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    target_id = int((request.json or {}).get("user_id", 0))

    conn = get_db_connection()
    denied = require_club_role(conn, club_id, session["user_id"], "moderator")
    if denied:
        conn.close(); return denied

    if target_id == session["user_id"]:
        conn.close()
        return jsonify({"error": "Use Leave Club instead"}), 400

    my_rank     = club_rank(conn, club_id, session["user_id"])
    target_rank = club_rank(conn, club_id, target_id)
    if target_rank < 0:
        conn.close()
        return jsonify({"error": "That user isn't a member"}), 404
    # You can only remove someone below you in rank.
    if target_rank >= my_rank:
        conn.close()
        return jsonify({"error": "You can't remove someone at or above your role"}), 403

    conn.execute("DELETE FROM club_members WHERE club_id=? AND user_id=?", (club_id, target_id))
    conn.execute("UPDATE clubs SET member_count = MAX(0, member_count-1) WHERE id=?", (club_id,))
    conn.commit(); conn.close()
    return jsonify({"message": "Member removed"})

@app.route("/api/clubs/post/<int:post_id>/delete", methods=["POST"])
def delete_club_post(post_id):
    """Post authors can delete their own; moderators and admins can delete any."""
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
    conn = get_db_connection()
    post = conn.execute(
        "SELECT club_id, user_id, image, video_url FROM club_posts WHERE id=?", (post_id,)
    ).fetchone()
    if not post:
        conn.close()
        return jsonify({"error": "Post not found"}), 404

    is_author = post["user_id"] == session["user_id"]
    if not is_author:
        denied = require_club_role(conn, post["club_id"], session["user_id"], "moderator")
        if denied:
            conn.close(); return denied

    conn.execute("DELETE FROM club_post_likes WHERE post_id=?", (post_id,))
    conn.execute("DELETE FROM club_posts WHERE id=?", (post_id,))
    conn.commit(); conn.close()
    delete_upload(post["image"], post["video_url"])
    return jsonify({"message": "Post deleted"})

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

    # A block has to stop direct messages, or it stops nothing that matters —
    # DMs are the main channel harassment actually arrives through. Checked in
    # both directions so the blocked party can't keep messaging either.
    if receiver_id in blocked_user_ids(conn, session["user_id"]):
        conn.close()
        return jsonify({"error": "You can't message this user."}), 403

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
    user_d = dict(user) if user else {}
    return render_template("settings.html", user=user_d,
                           is_admin=bool(user_d.get("is_admin")))


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

    # 0) Collect every file this user owns BEFORE the rows are deleted —
    #    afterwards there is nothing left pointing at them and they would be
    #    stranded on disk, still publicly fetchable. The privacy policy tells
    #    users deletion removes their content, so it has to actually do that.
    doomed = []

    def collect(sql, params, *cols):
        try:
            for row in conn.execute(sql, params).fetchall():
                for c in cols:
                    doomed.append(row[c])
        except Exception:
            pass   # table may not exist on an older database

    collect("SELECT avatar, cover_photo FROM users WHERE id=?", (user_id,),
            "avatar", "cover_photo")
    collect("SELECT image FROM garage WHERE user_id=?", (user_id,), "image")
    collect("SELECT thumbnail FROM builds WHERE user_id=?", (user_id,), "thumbnail")
    collect("SELECT image FROM meets WHERE user_id=?", (user_id,), "image")
    collect("SELECT image FROM stories WHERE user_id=?", (user_id,), "image")
    collect("SELECT image FROM vehicle_photos WHERE user_id=?", (user_id,), "image")
    collect("SELECT glb_url, thumbnail_url FROM generated_models WHERE user_id=?",
            (user_id,), "glb_url", "thumbnail_url")
    collect("SELECT image, video_url FROM club_posts WHERE user_id=?", (user_id,),
            "image", "video_url")
    if username:
        collect("SELECT image, video_url FROM posts WHERE username=?", (username,),
                "image", "video_url")
    # listings.images holds a JSON array rather than one path
    try:
        for row in conn.execute("SELECT images FROM listings WHERE user_id=?",
                                (user_id,)).fetchall():
            try:
                doomed.extend(json.loads(row["images"] or "[]"))
            except (ValueError, TypeError):
                pass
    except Exception:
        pass

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
        # These four were missing, so a deleted account left rows behind:
        # unsent drafts, club post likes, and submitted community photos.
        "drafts", "club_post_likes", "vehicle_photos",
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

    # Clubs this user created are deliberately NOT deleted — other members'
    # posts and membership live inside them, and removing one person's account
    # should not destroy a community. The creator reference is cleared instead.
    try:
        conn.execute("UPDATE clubs SET created_by=NULL WHERE created_by=?", (user_id,))
    except Exception:
        pass

    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    # Files last: only once the rows are definitely gone. Doing it earlier
    # would risk deleting someone's photos and then failing the transaction,
    # leaving rows pointing at files that no longer exist.
    removed = delete_upload(*doomed)
    app.logger.info("Account %s deleted, %d uploaded files removed", user_id, removed)

    session.clear()
    return jsonify({"message": "Account deleted"})


@app.route("/get_saved_posts")
def get_saved_posts():
    if "user_id" not in session:
        return jsonify([])
    conn  = get_db_connection()
    # posts are keyed by username (not user_id) — joining on p.user_id
    # matched nothing, so saved posts never appeared
    posts = conn.execute("""
        SELECT p.*, u.avatar, sp.created_at as saved_at
        FROM saved_posts sp
        JOIN posts p ON p.id = sp.post_id
        LEFT JOIN users u ON u.username = p.username COLLATE NOCASE
        WHERE sp.user_id = ?
        ORDER BY sp.id DESC
    """, (session["user_id"],)).fetchall()
    conn.close()
    return jsonify([dict(p) for p in posts])


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
    """Opponents you can pick by name.

    With no query, returns the people you follow who have at least one build —
    a short, meaningful list. With ?q=, searches every user by username so you
    can still race someone you don't follow. Never returns the whole user table.
    """
    if "user_id" not in session:
        return jsonify([])

    me = session["user_id"]
    q  = (request.args.get("q") or "").strip()
    conn = get_db_connection()

    if q:
        rows = conn.execute("""
            SELECT DISTINCT u.id, u.username,
                   (SELECT COUNT(*) FROM follows f
                     WHERE f.follower_id = ? AND f.following_id = u.id) AS following
            FROM users u
            INNER JOIN builds b ON b.user_id = u.id
            WHERE u.id != ? AND u.username LIKE ?
            ORDER BY following DESC, u.username COLLATE NOCASE
            LIMIT 25
        """, (me, me, f"%{q}%")).fetchall()
    else:
        rows = conn.execute("""
            SELECT DISTINCT u.id, u.username, 1 AS following
            FROM users u
            INNER JOIN builds b ON b.user_id = u.id
            INNER JOIN follows f ON f.following_id = u.id
            WHERE f.follower_id = ? AND u.id != ?
            ORDER BY u.username COLLATE NOCASE
            LIMIT 50
        """, (me, me)).fetchall()

    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/get_random_opponent")
def get_random_opponent():
    """A pool of random rival builds for the 'Surprise me' button.

    Returns full build rows so the client can score them with the same
    calcStats() the race physics uses and pick the closest match — keeping
    all performance maths in one place instead of duplicating it here.
    """
    if "user_id" not in session:
        return jsonify([])
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT b.*, u.username
        FROM builds b
        INNER JOIN users u ON u.id = b.user_id
        WHERE b.user_id != ?
        ORDER BY RANDOM()
        LIMIT 25
    """, (session["user_id"],)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/get_user_builds/<int:user_id>")
def get_user_builds(user_id):
    if "user_id" not in session:
        return jsonify({"error": "Not logged in"}), 401
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
    hidden = blocked_usernames(conn, session.get("user_id"))
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
    return jsonify([x for x in result
                    if (x["username"] or "").lower() not in hidden])

@limiter.limit("20 per hour")
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
    hidden = blocked_usernames(conn, session.get("user_id"))
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["time"] = time_ago(d["created_at"])
        result.append(d)
    return jsonify(result)

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

# ─── Fit Guides ──────────────────────────────────────────────────
# "What's the best car if I'm 6'4\"?" is one of the most-asked questions online
# and one of the worst-answered, because everyone answers from anecdote. These
# guides answer from published spec sheets.
#
# Two sources of content, deliberately split so neither can drift:
#   - content/fit-guides/<slug>.md    prose, authored by hand
#   - content/fit-guides/fit-data.json  every measurement, once
# The markdown carries a <!-- TABLES --> marker; the data tables are rendered
# from JSON at that point. A corrected figure is a one-line JSON edit and both
# the table and any future comparison integration pick it up.

GUIDES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "content", "fit-guides")
FIT_DATA_FILE = os.path.join(GUIDES_DIR, "fit-data.json")
TABLE_MARKER = "<!-- TABLES -->"

# Slugs come from the URL and are used to build a file path, so they are
# restricted to a character set that cannot escape the directory. Never
# relax this to include dots or slashes.
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")

try:
    import markdown as _markdown
except ImportError:      # pragma: no cover - guides degrade rather than 500
    _markdown = None


def _render_markdown(text):
    """Render guide prose.

    The input is repo-authored content, not user submissions, so its HTML is
    trusted. Never point this at anything a user can write — it does not go
    through sanitize().
    """
    if _markdown is None:
        # Missing dependency shouldn't take the page down; show the prose
        # readably and make the fix obvious in the logs.
        app.logger.warning("markdown not installed — guides rendering as plain text. "
                           "pip install markdown")
        return "<pre class='guide-raw'>" + escape(text) + "</pre>"
    return _markdown.markdown(text, extensions=["extra", "sane_lists"])


def load_fit_data(filename=None):
    """Load a guide's dataset.

    Guides declare their own `data:` file in front matter — cars are judged on
    headroom, bikes on seat height, and the two do not share a scale. The
    filename is validated because it arrives from a content file rather than
    being hardcoded.
    """
    name = filename or os.path.basename(FIT_DATA_FILE)
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,63}\.json", name or ""):
        raise ValueError("bad data filename")
    path = os.path.join(GUIDES_DIR, name)
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def fit_verdict(car, thresholds):
    """Judge on the honest number: if a with-roof figure exists, use it.

    An explicit `verdict` in the data always wins — some cars are a bad
    recommendation for reasons a single measurement doesn't capture (the Mazda 3
    has fine legroom and a roofline that ruins it).
    """
    if car.get("verdict"):
        return car["verdict"]
    h = car.get("headroomRoof") or car.get("headroom")
    if h is None:
        return "unknown"
    if h >= thresholds.get("good", 40.0):
        return "pick"
    if h >= thresholds.get("ok", 38.5):
        return "ok"
    return "avoid"


def parse_guide(path):
    """Split a guide file into `key: value` front matter and body.

    Front matter runs until a line of exactly `---`. Kept deliberately simple —
    no YAML dependency for what is five string fields.
    """
    raw = open(path, encoding="utf-8").read()
    meta, body = {}, raw
    if "\n---" in raw:
        head, _, body = raw.partition("\n---\n")
        for line in head.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                meta[k.strip()] = v.strip()
    return meta, body


def list_guides():
    if not os.path.isdir(GUIDES_DIR):
        return []
    out = []
    for name in sorted(os.listdir(GUIDES_DIR)):
        if not name.endswith(".md"):
            continue
        slug = name[:-3]
        if not SLUG_RE.match(slug):
            continue
        meta, _ = parse_guide(os.path.join(GUIDES_DIR, name))
        meta["slug"] = slug
        meta.setdefault("title", slug.replace("-", " ").title())
        out.append(meta)
    return out


@app.route("/guides")
def guides_index():
    return render_template("guides.html", guides=list_guides())


@app.route("/guides/<slug>")
def guide_detail(slug):
    if not SLUG_RE.match(slug or ""):
        return render_template("error.html", message="Guide not found."), 404
    path = os.path.join(GUIDES_DIR, slug + ".md")
    if not os.path.exists(path):
        return render_template("error.html", message="Guide not found."), 404

    meta, body = parse_guide(path)
    meta["slug"] = slug
    before, _, after = body.partition(TABLE_MARKER)

    # Seat-height guides don't fit the good/bad model the car guide uses: a
    # low seat is right for a short rider and wrong for a tall one, so there
    # is no single "better" direction to rank on. They get their own layout,
    # grouped into inseam bands instead of scored.
    if meta.get("layout") == "seatheight":
        data = load_fit_data(meta.get("data"))
        bikes = data.get("bikes", [])
        bands = [{**b, "bikes": [k for k in bikes if k.get("band") == b["key"]]}
                 for b in data.get("bands", [])]
        return render_template(
            "guide_detail.html",
            meta=meta,
            intro_html=_render_markdown(before),
            outro_html=_render_markdown(after),
            bands=[b for b in bands if b["bikes"]],
            coverage={"measured": data.get("measured", len(bikes)),
                      "total": data.get("totalBikes", len(bikes))},
            sources=data.get("sources", []),
        )

    data = load_fit_data(meta.get("data"))
    thresholds = data.get("thresholds", {})

    # Only sourced figures are publishable. Unverified rows are surfaced
    # separately as open research, never as a recommendation.
    cars = [c for c in data.get("cars", [])
            if c.get("verified") and c.get("headroom") is not None]
    for c in cars:
        c["verdictKey"] = fit_verdict(c, thresholds)
    pending = [c for c in data.get("cars", []) if not c.get("verified")]

    tiers = []
    for tier in data.get("tiers", []):
        rows = sorted((c for c in cars if c.get("tier") == tier["key"]),
                      key=lambda c: c.get("headroom") or 0, reverse=True)
        if rows:
            tiers.append({**tier, "cars": rows})

    return render_template(
        "guide_detail.html",
        meta=meta,
        intro_html=_render_markdown(before),
        outro_html=_render_markdown(after),
        tiers=tiers,
        pending=pending,
        sources=data.get("sources", []),
        # Ranked across every tier — the "price doesn't buy headroom" point
        # only lands when a Bronco Sport and a Q8 sit in the same table.
        ranked=sorted(cars, key=lambda c: c.get("headroom") or 0, reverse=True),
    )


@app.route("/api/fit_data")
def api_fit_data():
    """Publishable rows only, for the comparison page to flag fit inline."""
    data = load_fit_data()
    thresholds = data.get("thresholds", {})
    cars = [c for c in data.get("cars", [])
            if c.get("verified") and c.get("headroom") is not None]
    for c in cars:
        c["verdictKey"] = fit_verdict(c, thresholds)
    return jsonify({"cars": cars, "thresholds": thresholds})


if __name__ == "__main__":
    # Local development only. In production gunicorn imports `app` directly and
    # never runs this block — see the Procfile.
    #
    # debug=True must never reach production: the Werkzeug debugger exposes an
    # interactive console that executes arbitrary Python on the server.
    init_db()
    # host defaults to 127.0.0.1, which only accepts connections from this
    # machine — a phone on the same wifi gets "server stopped responding".
    # 0.0.0.0 listens on every interface so the LAN address works, which is
    # what testing on a real device needs.
    #
    # Only ever do this on a trusted network: with debug=True the Werkzeug
    # debugger is exposed, and it runs arbitrary Python. Set HOST=127.0.0.1
    # on public wifi.
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 5001))
    if host == "0.0.0.0":
        import socket
        try:
            lan = socket.gethostbyname(socket.gethostname())
            print(f"\n  Phone on the same wifi:  http://{lan}:{port}\n")
        except OSError:
            pass
    app.run(debug=not IS_PROD, host=host, port=port)
else:
    # Under gunicorn there's no __main__, so migrations would never run and the
    # first request would hit missing tables.
    init_db()