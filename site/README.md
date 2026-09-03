# RideInsight landing page — static build

A standalone copy of the landing page. No Flask, no database, no server.
Hosts free on Cloudflare Pages, Netlify or GitHub Pages with no cold start.

The Flask version in `templates/landing.html` is untouched and still serves at
`/welcome` locally. This folder is a build artefact — regenerate it rather than
editing both by hand.

---

## 1. Create a form endpoint (5 minutes, free)

The waitlist needs somewhere to send emails. Two options:

- **Formspree** (formspree.io) — free tier, 50 submissions/month, emails you
  each one and exports CSV.
- **Tally** (tally.so) — free tier, unlimited submissions, nicer dashboard.

Create a form, copy its endpoint URL (looks like
`https://formspree.io/f/xxxxxxx`), then open `index.html` and replace:

```js
const FORM_ENDPOINT = 'REPLACE_WITH_YOUR_FORM_ENDPOINT';
```

> 50/month is tight if a campus push goes well. Tally's free tier has no
> submission cap, so it's the safer choice if you're handing out QR codes.

## 2. Point the legal links at the app

The static site has no `/support`, `/privacy` or `/terms` — those routes live in
the Flask app. Search `index.html` for `app.rideinsight.com` and change it to
wherever the app ends up. Until the app is deployed those links will 404, so
either host the app first or temporarily remove them from the footer.

## 3. Deploy

**Cloudflare Pages** (recommended — no cold start, free custom domain, global CDN)

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
3. Build command: *(leave empty)* · Build output directory: `site`
4. Deploy. You get `something.pages.dev` immediately.

**Netlify** — same idea. Publish directory `site`, no build command.

**GitHub Pages** — Settings → Pages → deploy from branch. Note that project
sites live under `/repo-name/`, which is why every asset path here is relative.

## 4. Custom domain

Buy the domain (~$10–12/year at Cloudflare Registrar or Namecheap), then add it
in your host's dashboard. DNS propagates in minutes to a few hours. HTTPS is
issued automatically and free on all three hosts.

---

## Tracking where signups come from

Add `?src=` to any link and it's recorded with the submission:

| Where | Link |
|---|---|
| Campus flyer QR | `rideinsight.com/?src=campus-gsu` |
| Instagram bio | `rideinsight.com/?src=instagram` |
| TikTok | `rideinsight.com/?src=tiktok` |
| LinkedIn post | `rideinsight.com/?src=linkedin` |

Use a distinct `src` per campus. When you have a few hundred signups that's how
you'll know which city has the density to launch into first.

## What gets submitted

Two rows per person, matched on email:

1. `type: signup` — email, source
2. `type: details` — email, source, location, vehicle, interest *(optional;
   skipping it never blocks the signup)*

## Regenerating

`site/index.html` is derived from `templates/landing.html`. If you change the
Flask template, regenerate rather than editing both:

    python tools/build_site.py
