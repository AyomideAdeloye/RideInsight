# Getting RideInsight into the App Store

Two separate hurdles, and the second one is the one most people underestimate.

## Hurdle 1 — Guideline 1.2, user-generated content

This rejects social apps that lack moderation tooling, and reviewers test it
by hand. Requirements and current status:

| Requirement | Status |
|---|---|
| Filter objectionable content | Admin can delete reported posts and comments |
| Report mechanism | Report a user, a post or a comment |
| Block abusive users | Blocking is enforced on feed, comments, search and DMs |
| Published contact | `rideinsightapp@gmail.com` on `/support` |
| Act on reports | `/admin/reports` queue |

All four are now in place. Before this work, **blocking silently did nothing** —
the table was written and never read — and reports went to a table no screen
displayed. Both would have failed review, and both were real safety gaps
independent of Apple.

Remaining, and worth doing before submitting:

- **A terms clause committing to removing objectionable content and ejecting
  abusive users.** Apple asks for this explicitly in 1.2.
- **Acknowledge reports to the reporter.** "We'll review it" is shown; a
  notification once actioned is better.
- Consider an age rating of 17+ if you would rather not moderate to a lower
  bar. It costs some reach and buys latitude.

## Hurdle 2 — Guideline 4.2, minimum functionality

A WebView around a website gets rejected. The fix is genuine native
capability, not disguise. **Capacitor** wraps the existing Flask app and
exposes native APIs, so this is not a rewrite.

Native features that map naturally onto what RideInsight already does:

| Feature | Why it justifies a native app | Effort |
|---|---|---|
| **Push notifications** | Likes, comments, DMs, meet reminders. The single strongest signal, and genuinely useful. | Medium |
| **Camera capture** | Photograph a car straight into a post rather than picking a file. | Low |
| **Native share sheet** | Share a build to Instagram or Messages. | Low |
| **Geolocation** | "Meets near me" — you already collect location on the waitlist. | Low |
| **Haptics** | Feedback when swapping parts in the builder. | Low |
| **Offline garage** | View saved builds with no signal. | Medium |

Push plus camera plus share plus location is comfortably past the 4.2 bar. One
or two would not be.

## Order of work

1. **Ship the PWA now.** It is already complete and needs no review. Get real
   users first.
2. **Add push notifications to the web app.** Web Push works on iOS 16.4+ and
   Android, so this is useful before any wrapper exists — and it is the piece
   of native work that carries over.
3. **Then wrap with Capacitor** and add camera, share and geolocation.
4. **Submit.**

Doing it this way means the App Store version launches with a real user base
and real native features, rather than an empty shell that gets rejected.

## Also required at submission

- **$99/year** Apple Developer Program.
- **App Privacy labels** — declare email, user content, identifiers and usage
  data. The substance is already in `/privacy`.
- **Account deletion in-app** — 5.1.1(v). Already exists in Settings, and must
  stay reachable inside the wrapper rather than linking out to a browser.
- **EULA** — `/terms` qualifies. Link it from the App Store listing.
- **Sign in with Apple** — only required if you add Google or Facebook login.
  Email and password only, so not needed today. Adding social login later
  triggers this.
- **In-app purchase** — not required. Affiliate links to physical goods are
  fine; selling digital content or subscriptions inside the app would change
  that.
