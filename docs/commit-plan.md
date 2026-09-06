# Commit plan

A straight read of what's uncommitted and how to land it.

## First: clean up

```powershell
Remove-Item .git\*.lock -ErrorAction SilentlyContinue
Remove-Item .fuse_hidden* -Force -ErrorAction SilentlyContinue
```

The `.fuse_hidden*` files are artifacts of editing over a network mount, not
part of the project. `.gitignore` now covers them anyway.

Then check nothing secret is staged:

```
git status
git ls-files .env        # must print nothing
```

---

## The honest problem with splitting these

`app.py` contains security fixes, moderation, Fit Guides, deploy changes and
bug fixes all interleaved. Splitting them into separate commits means
`git add -p` and picking through roughly 2,000 changed lines by hand.

For a solo project pre-launch that is not a good use of an evening. **Option A
is the recommendation.** Option B is there if you specifically want the
security work isolated in history — which is a legitimate thing to want, since
"when did we start deleting uploads" may need answering with a date.

---

## Option A — one commit (recommended)

```
git add -A
git commit -F docs/commit-message.txt
git push
```

The message is in `docs/commit-message.txt`, ready to use.

---

## Option B — four commits

Files that belong only to one concern can be staged individually. `app.py`,
`static/style.css` and `templates/base.html` are touched by all four, so they
ride along with the first.

**1. Security and moderation** (the one worth isolating)

```
git add app.py limits.py static/style.css templates/base.html ^
        templates/signup.html templates/meets.html templates/settings.html ^
        templates/admin_reports.html static/script.js static/settings.js ^
        requirements.txt .gitignore
git commit -m "Security: CSRF, rate limits, quotas, moderation, XSS fixes"
```

**2. Fit Guides**

```
git add content/ static/fitData.js templates/guides.html ^
        templates/guide_detail.html tools/build_bike_fit.py static/compare.js ^
        templates/compare.html
git commit -m "Add Fit Guides: data-backed vehicle fit for tall drivers and riders"
```

**3. Deploy and PWA**

```
git add render.yaml Procfile DEPLOY.md docs/ tools/backup.py ^
        tools/sweep_orphans.py providers.py static/sw.js templates/offline.html
git commit -m "Deploy config, backups, provider seam and PWA support"
```

**4. Everything else**

```
git add -A
git commit -m "Fix share, stories, geolocation, race controls and notifications"
```

---

## After pushing

Pushing is the whole job for now. **Deployment is deferred to launch** — see
the note at the top of `DEPLOY.md`. The landing page is already live and free
on Cloudflare Pages; paid hosting only makes sense once there are waitlist
people to let in.

When that day comes, the sequence is:

1. **render.com** → sign in with GitHub → **New → Blueprint** → pick the repo.
2. Paste the five API keys when prompted (from your local `.env`).
3. Deploy. Note the `*.onrender.com` URL.
4. **Cloudflare → Turnstile** → add a widget for that hostname → paste the two
   keys into Render's Environment tab. Until then production signups are
   refused by design.
5. Re-test share, location and PWA install — all three need HTTPS and will
   only work properly once deployed.
