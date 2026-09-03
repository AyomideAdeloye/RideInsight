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
# Only these assets are referenced by the landing page.
ASSETS = ["favicon.ico", "icon-180.png", "icon-512.png",
          "logo-navy.svg", "logo-red.svg"]

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

s = open(SRC, encoding="utf-8").read()

# 1. Root-absolute -> relative asset paths
s = s.replace('href="/static/', 'href="static/').replace('src="/static/', 'src="static/')

# 2. Flask-only routes -> the deployed app
for route in ("/support", "/privacy", "/terms", "/login"):
    s = s.replace(f'href="{route}"', f'href="{APP}{route}"')

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

leftover = re.findall(r'(?:src|href)="/(?!/)[^"]*"', s)
size = os.path.getsize(os.path.join(OUT, "index.html"))

print(f"site/index.html   {size:,} bytes")
print(f"assets copied     {copied}/{len(ASSETS)}")
print(f"absolute paths    {'none' if not leftover else leftover}")
if ACCESS_KEY.startswith("REPLACE_"):
    print(f"\n!  No access key yet. Put it in {KEY_FILE} and re-run this script.")
    print("   Get one free at https://web3forms.com")
else:
    print(f"access key        set ({ACCESS_KEY[:8]}…)")
