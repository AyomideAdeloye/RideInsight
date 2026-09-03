"""Build the static landing page from the Flask template.

Run from the project root:   python tools/build_site.py

`templates/landing.html` stays the single source of truth. This produces
`site/index.html`, which is what gets deployed to Cloudflare Pages / Netlify /
GitHub Pages — no Flask, no database, no cold start.

Differences between the two:
  - asset paths become relative (GitHub Pages serves project sites from /repo/)
  - legal links point at the deployed app instead of Flask routes
  - the waitlist posts to a form service instead of /api/waitlist
"""
import os
import re
import shutil

SRC   = os.path.join("templates", "landing.html")
OUT   = "site"
# Where the Flask app will live, for the footer's legal links.
APP   = "https://app.rideinsight.com"
# Brand assets referenced by the landing page.
ASSETS = ["favicon.ico", "icon-180.png", "icon-512.png",
          "logo-navy.svg", "logo-red.svg"]

# Hero screenshot. Optional — the page falls back to a placeholder box if it's
# missing, so the build never breaks over it.
HERO = os.path.join("static", "landing", "builder.png")

# The Web3Forms access key is read from web3forms_key.txt (or the WEB3FORMS_KEY
# environment variable) rather than pasted into the generated HTML — otherwise
# re-running this script would silently wipe it and the waitlist would break.
# The key is not a secret: it ends up in the page source by design, and can only
# send submissions to your inbox, not read them.
KEY_FILE = "web3forms_key.txt"
ACCESS_KEY = os.getenv("WEB3FORMS_KEY", "").strip()
if not ACCESS_KEY and os.path.exists(KEY_FILE):
    ACCESS_KEY = open(KEY_FILE, encoding="utf-8").read().strip()
ACCESS_KEY = ACCESS_KEY or "REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY"


# ── Static legal pages ────────────────────────────────────────────────────
# /support, /privacy and /terms are Flask routes. The static site has no Flask,
# so the footer links would 404 on a live page. Rather than duplicating the
# policy text, the copy is imported straight out of app.py — one source of
# truth, and the pages can never drift apart.

LEGAL_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — RideInsight</title>
<meta name="robots" content="index,follow">
<link rel="icon" href="static/brand/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="static/brand/logo-navy.svg">
<meta name="theme-color" content="#16202e">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
  :root{{--navy:#16202e;--bg:#f7f8fa;--surface:#fff;--border:#e2e6ec;
         --text:#1a2230;--muted:#64748b;--accent:#e11d48}}
  body{{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);
        color:var(--text);line-height:1.65;-webkit-font-smoothing:antialiased}}
  .topbar{{background:var(--navy)}}
  nav{{max-width:820px;margin:0 auto;padding:0 24px;height:64px;
       display:flex;align-items:center;gap:10px}}
  nav a{{display:flex;align-items:center;gap:10px;text-decoration:none;
         font-size:21px;font-weight:700;color:var(--accent);letter-spacing:-.4px}}
  nav img{{border-radius:7px}}
  main{{max-width:820px;margin:0 auto;padding:40px 24px 70px}}
  h1{{font-size:clamp(26px,4vw,34px);font-weight:800;letter-spacing:-.8px;margin-bottom:6px}}
  .updated{{font-size:13px;color:var(--muted);margin-bottom:26px}}
  .body{{background:var(--surface);border:1px solid var(--border);border-radius:12px;
         padding:28px 30px;box-shadow:0 1px 3px rgba(20,30,50,.07)}}
  .body h3{{font-size:14px;font-weight:800;margin:26px 0 8px;text-transform:uppercase;
            letter-spacing:.05em;color:var(--accent)}}
  .body h3:first-child{{margin-top:0}}
  .body p{{margin-bottom:13px;font-size:15px}}
  .body ul{{margin:0 0 15px 20px}}
  .body li{{margin-bottom:7px;font-size:15px}}
  .body a{{color:var(--accent);font-weight:600;text-decoration:none}}
  .body a:hover{{text-decoration:underline}}
  footer{{max-width:820px;margin:0 auto;padding:22px 24px 50px;
          display:flex;gap:18px;flex-wrap:wrap;font-size:13.5px}}
  footer a{{color:var(--muted);text-decoration:none}}
  footer a:hover{{color:var(--accent)}}
  @media(max-width:640px){{.body{{padding:22px 20px}}}}
</style>
</head>
<body>
<div class="topbar"><nav>
  <a href="index.html"><img src="static/brand/logo-red.svg" alt="" width="30" height="30">RideInsight</a>
</nav></div>
<main>
  <h1>{title}</h1>
  {updated_html}
  <div class="body">{body}</div>
</main>
<footer>
  <a href="index.html">&larr; Home</a>
  <a href="support.html">Contact &amp; Support</a>
  <a href="privacy.html">Privacy Policy</a>
  <a href="terms.html">Terms &amp; Conditions</a>
</footer>
</body>
</html>
"""


def build_legal_pages():
    """Lift the policy copy out of app.py without importing it.

    Parsing the source rather than importing means no Flask, no bleach, no
    database side effects — and the text still has exactly one home, so these
    pages can't drift from what the app serves.
    """
    import ast

    src = open("app.py", encoding="utf-8").read()
    tree = ast.parse(src)

    # Module-level constants the policy f-strings interpolate
    consts = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
            for t in node.targets:
                if isinstance(t, ast.Name):
                    consts[t.id] = node.value.value

    TRIPLE_D = chr(34) * 3
    TRIPLE_S = chr(39) * 3

    def unwrap(seg):
        """Strip the f-prefix and quotes off a string literal's source."""
        seg = seg.strip()
        if seg[:1] == "f":
            seg = seg[1:]
        for q in (TRIPLE_D, TRIPLE_S, chr(34), chr(39)):
            if seg.startswith(q) and seg.endswith(q):
                return seg[len(q):-len(q)]
        return seg

    wanted = {"support": "support.html",
              "privacy": "privacy.html",
              "terms":   "terms.html"}
    written = 0

    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef) or node.name not in wanted:
            continue

        body_src, title, updated = None, node.name.title(), None

        for stmt in ast.walk(node):
            # body = f"""...html..."""
            if (isinstance(stmt, ast.Assign)
                    and any(isinstance(t, ast.Name) and t.id == "body"
                            for t in stmt.targets)):
                body_src = ast.get_source_segment(src, stmt.value)
            # return render_template("legal.html", title=..., updated=...)
            if (isinstance(stmt, ast.Call)
                    and getattr(stmt.func, "id", "") == "render_template"):
                for kw in stmt.keywords:
                    if kw.arg == "title" and isinstance(kw.value, ast.Constant):
                        title = kw.value.value
                    if kw.arg == "updated":
                        if isinstance(kw.value, ast.Name):
                            updated = consts.get(kw.value.id)
                        elif isinstance(kw.value, ast.Constant):
                            updated = kw.value.value

        if not body_src:
            print("legal pages       SKIPPED " + wanted[node.name] + " (no body found)")
            continue

        body = unwrap(body_src)
        for name, value in consts.items():
            if isinstance(value, str):
                body = body.replace("{" + name + "}", value)

        updated_html = ('<p class="updated">Last updated ' + updated + "</p>"
                        if updated else "")
        html = LEGAL_TEMPLATE.format(title=title, body=body,
                                     updated_html=updated_html)
        open(os.path.join(OUT, wanted[node.name]), "w",
             encoding="utf-8").write(html)
        written += 1

    return written

s = open(SRC, encoding="utf-8").read()

# 1. Root-absolute -> relative asset paths
s = s.replace('href="/static/', 'href="static/').replace('src="/static/', 'src="static/')

# 2. Legal routes -> sibling static pages. Only /login points at the app,
#    since there's nothing to sign in to on a static site.
for route in ("/support", "/privacy", "/terms"):
    s = s.replace(f'href="{route}"', f'href="{route.lstrip("/")}.html"')
s = s.replace('href="/login"', f'href="{APP}/login"')

# 3. Config block the user fills in once
s = s.replace(
    "document.getElementById('yr').textContent = new Date().getFullYear();",
    """// ── Configure this, then deploy ───────────────────────────────────
// Set in web3forms_key.txt at the project root, then re-run
// tools/build_site.py. Get a free key at https://web3forms.com
const ACCESS_KEY    = '__ACCESS_KEY__';
const FORM_ENDPOINT = 'https://api.web3forms.com/submit';
// ──────────────────────────────────────────────────────────────────

document.getElementById('yr').textContent = new Date().getFullYear();""",
    1)
s = s.replace("__ACCESS_KEY__", ACCESS_KEY)

# 4. Swap the Flask waitlist calls for a form-service POST.
#    A form service has no session, so there's no token to carry between the
#    signup and the follow-up — the email is repeated instead and the two rows
#    are matched on it in the export.
FOLLOWUP = '''// ── Optional follow-up ─────────────────────────────────────────────────
let joinedEmail = '';
let joinedSource = 'landing';
let chosenInterest = '';

function showFollowup(email, source) {
  joinedEmail = email;
  joinedSource = source;
  const box = document.getElementById('followup');
  if (box) box.hidden = false;
}

document.addEventListener('click', (e) => {
  const chip = e.target.closest('#interestChips button');
  if (!chip) return;
  const already = chip.classList.contains('on');
  document.querySelectorAll('#interestChips button').forEach(b => b.classList.remove('on'));
  if (!already) { chip.classList.add('on'); chosenInterest = chip.dataset.interest; }
  else chosenInterest = '';
});

// access_key identifies the Web3Forms inbox. Accept: application/json is what
// stops the browser navigating away to their thank-you page.
async function postToForm(payload) {
  const res = await fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ access_key: ACCESS_KEY, ...payload })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || ('form endpoint returned ' + res.status));
  }
  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  const send = document.getElementById('followupSend');
  const skip = document.getElementById('followupSkip');
  const box  = document.getElementById('followup');
  const msg  = document.getElementById('followupMsg');
  if (skip) skip.addEventListener('click', () => { if (box) box.hidden = true; });
  if (send) send.addEventListener('click', async () => {
    send.disabled = true;
    try {
      await postToForm({
        _subject: 'RideInsight waitlist — details',
        type:     'details',
        email:    joinedEmail,
        source:   joinedSource,
        location: (document.getElementById('locInput')?.value || '').trim(),
        vehicle:  (document.getElementById('carInput')?.value || '').trim(),
        interest: chosenInterest
      });
      if (msg) { msg.textContent = 'Thanks — that helps.'; msg.className = 'form-msg ok'; }
      setTimeout(() => { if (box) box.hidden = true; }, 1400);
    } catch (err) {
      if (msg) { msg.textContent = "Couldn't save that, but you're still on the list."; msg.className = 'form-msg err'; }
    }
    send.disabled = false;
  });
});

'''

start = s.index("// ── Optional follow-up")
end   = s.index("function wireForm(")
s = s[:start] + FOLLOWUP + s[end:]

SUBMIT_NEW = """      await postToForm({
        _subject: 'RideInsight waitlist — new signup',
        type:     'signup',
        email:    email,
        source:   src
      });
      msg.textContent = "You're on the list. We'll be in touch.";
      msg.className = 'form-msg ok';
      input.value = ''; btn.textContent = 'Joined ✓';
      showFollowup(email, src);
    } catch (err) {
      msg.textContent = 'Something went wrong. Try again.';
      msg.className = 'form-msg err';
      btn.disabled = false; btn.textContent = 'Get early access';
    }"""

m = re.search(r"      const res  = await fetch\('/api/waitlist'.*?\n    \}(?=\n  \}\);)",
              s, re.S)
if not m:
    raise SystemExit("Could not find the waitlist submit block in templates/landing.html.\n"
                     "It was probably edited — update tools/build_site.py to match.")
s = s[:m.start()] + SUBMIT_NEW + s[m.end():]

# ── Write ──
os.makedirs(os.path.join(OUT, "static", "brand"), exist_ok=True)
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(s)

copied = 0
for f in ASSETS:
    src_p = os.path.join("static", "brand", f)
    if os.path.exists(src_p):
        shutil.copy2(src_p, os.path.join(OUT, "static", "brand", f))
        copied += 1

os.makedirs(os.path.join(OUT, "static", "landing"), exist_ok=True)
hero_size = None
if os.path.exists(HERO):
    shutil.copy2(HERO, os.path.join(OUT, "static", "landing", "builder.png"))
    hero_size = os.path.getsize(HERO)

legal_written = build_legal_pages()

leftover = re.findall(r'(?:src|href)="/(?!/)[^"]*"', s)
size = os.path.getsize(os.path.join(OUT, "index.html"))

print(f"site/index.html   {size:,} bytes")
print(f"assets copied     {copied}/{len(ASSETS)}")
print(f"absolute paths    {'none' if not leftover else leftover}")
print(f"legal pages       {legal_written}/3")
if hero_size:
    print(f"hero screenshot   {hero_size/1000:,.0f} KB"
          + ("   <- large, consider compressing" if hero_size > 500_000 else ""))
else:
    print(f"hero screenshot   MISSING — save one to {HERO}")
if ACCESS_KEY.startswith("REPLACE_"):
    print(f"\n!  No access key yet. Put it in {KEY_FILE} and re-run this script.")
    print("   Get one free at https://web3forms.com")
else:
    print(f"access key        set ({ACCESS_KEY[:8]}…)")
