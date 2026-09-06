# Deploying RideInsight

> **Status: deferred until launch.** Nothing here needs doing yet.
>
> The landing page is already live and free on Cloudflare Pages, collecting
> waitlist signups, and that is the only thing the public needs right now. The
> app has no users — testing it over local wifi costs nothing and works fine.
>
> Hosting starts costing money the day it goes up (~$9.50/month), so the
> trigger for working through this document is **having waitlist people to let
> in**, not finishing a feature. Everything below is ready and doesn't expire.
>
> **What is still worth doing now:** push to GitHub. It's free, it's the
> backup, and it turns deploying later into a ten-minute job.


The app is a Flask + SQLite monolith with user uploads on disk. That works
fine, but it means **the host must give you a persistent disk** — container
filesystems are wiped on every deploy, and without a mounted volume you would
lose the database and every uploaded photo each time you shipped.

`render.yaml` describes the whole service, so create it from the blueprint
rather than clicking through the dashboard.

## Why Render Starter and not the free tier

Render's free tier sleeps after 15 minutes idle and takes about a minute to
wake. For a social app that means the first visitor of the day sits on a blank
page — the same reason the landing page went on Cloudflare Pages instead.
Starter is ~$7/month, has no cold start, and supports disks. Railway and
Fly.io no longer have free tiers at all, so the comparison is paid-vs-paid.

Confirm current pricing on Render's own site before committing; these figures
move.

## Steps

1. Push the repo to GitHub.
2. Render dashboard → **New → Blueprint** → connect the repo. It reads
   `render.yaml`.
3. Render will prompt for the five API keys marked `sync: false`. Paste them
   from your local `.env`. **Never commit `.env`** — see the note at the top of
   `.gitignore`, which had a BOM that stopped the ignore rule matching.
4. Deploy. First boot creates the tables via `init_db()`.

## What the disk holds

Mounted at `/var/data`:

| | Env var | Path |
|---|---|---|
| Database | `DB_PATH` | `/var/data/rideinsight.db` |
| Uploads | `UPLOAD_FOLDER` | `/var/data/uploads` |

Locally both fall back to the old in-project paths, so nothing changes when
running on your machine.

Because uploads now live outside `static/`, Flask's static handler can't serve
them. `save_upload()` returns `/uploads/<filename>` and the `uploaded_file()`
route serves from wherever `UPLOAD_FOLDER` points.

The disk is **10 GB**, sized for uploads rather than the database. At the
current 100 MB upload cap a 1 GB disk would be about ten videos — and when the
disk fills, SQLite writes start failing, so a full disk takes the whole app
down, not just uploads. 10 GB is roughly 170 phone videos or 2,500 photos at
~$0.25/GB/month. Render can grow a disk later but **never shrink it**.

Worth considering lowering `MAX_CONTENT_LENGTH` from 100 MB: capping video at
25 MB gets four times the posts per gigabyte, and most phone clips compress
fine.

## Backups

`tools/backup.py` takes a consistent snapshot while the app is running:

```
python tools/backup.py --uploads          # snapshot db + archive uploads
python tools/backup.py --check FILE       # verify a snapshot
python tools/backup.py --restore FILE     # restore one
```

It uses SQLite's `VACUUM INTO` rather than copying the file. A plain `cp` of a
live database can capture it mid-write, and with WAL enabled the `-wal` sidecar
holds committed data a file copy would miss. `VACUUM INTO` asks SQLite for a
clean, checkpointed, single-file copy — verified here against four threads
writing continuously throughout the snapshot.

Every snapshot is integrity-checked before it is kept, and a failed check
deletes it rather than leaving a backup you would trust and shouldn't. Restore
refuses invalid files and moves the existing database aside first. The last
seven of each kind are retained.

**Schedule it** as a Render cron job (or any scheduler) running daily:

```
python tools/backup.py --out /var/data/backups --uploads
```

**Backups on the same disk protect against mistakes, not disk failure.** Copy
them off-box for that — Cloudflare R2's free tier is 10 GB with no egress fees,
and you are already on Cloudflare.

**Test the restore before you need it.** An untested backup is a hope. The
round trip above — corrupt the database, restore, count the rows — takes two
minutes and is the only thing that proves any of this works.

## Why one worker

`--workers 1 --threads 8`, not two workers. Each gunicorn worker is a separate
Python process with the entire app loaded, and two do not sit comfortably in
Starter's 512 MB. Eight threads give the same concurrency from one process.

If memory holds and traffic grows, move to a larger plan *before* adding
workers.

## SQLite settings

`get_db_connection()` enables WAL and a 15-second busy timeout. Measured on 8
repeated trials, this is 17–45x faster under concurrent writes, and at 64
concurrent writers the defaults lost 22–50% of writes on every single trial
while WAL lost none.

**WAL requires a real local filesystem.** Render disks are block storage, so
this is fine. If the database ever moves to a network mount, WAL is no longer
safe — and that is the moment to move to Postgres rather than tuning further.

## Before going live

- [ ] Test on a real phone, not just a narrow browser window
- [ ] Sign up as a second user in an incognito window and walk the main flows
      (two tabs share one session, so incognito is required)
- [ ] Confirm nothing seeded or test-only is visible on a fresh database
- [ ] Update the Web3Forms site URL from `localhost` to the live address
- [ ] Point the landing page's "Sign in" at the deployed app — `APP` in
      `tools/build_site.py` is deliberately empty until the app has a real URL

## Installable app (PWA)

RideInsight installs to a phone home screen without the App Store: manifest,
icons, service worker and an offline page are all in place. On iOS that is
Share → Add to Home Screen; Android prompts automatically.

**This sidesteps App Store review entirely**, which matters because Apple's
guideline 4.2 rejects apps that are a website in a wrapper — and that is
exactly what a WebView around this Flask app would be. Ship the PWA now; only
consider a native shell once there is a reason for it, by which point there
should be real native features (push, camera, offline data) to justify it.

**Bump `CACHE` in `static/sw.js` on any deploy that changes CSS or JS**, or
returning visitors keep the old versions. It is the one manual step this adds.

The worker never caches HTML pages, API responses or `/uploads/` — only
`/static/` assets. That is deliberate: this is a logged-in social app, and a
cached page served to the wrong user would be a data leak. Stale feeds are
annoying; leaked ones are not survivable.

## Known gaps

- `static/default-avatar.png` is referenced by `settings.js` but does not
  exist. It fails silently via `onerror`, so avatars just disappear rather
  than showing a broken image.
- Uploads and the database share one disk. When uploads outgrow it, move them
  to object storage — Cloudflare R2 has 10 GB free with no egress fees, and
  you are already on Cloudflare.
