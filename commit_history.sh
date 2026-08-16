#!/usr/bin/env bash
# Run this from the RideInsight repo root in VS Code's integrated terminal
# (Terminal > New Terminal, then: bash commit_history.sh)

set -e
cd "$(dirname "$0")"

echo "=== Committing RideInsight feature history ==="

# ── 1. 3D Builder ─────────────────────────────────────────────────────────────
git add static/builder.js templates/builder.html
git commit -m "Add 3D vehicle builder with Tripo API and photo fallback

- Three.js GLB viewer with Tripo3D image-to-model integration
- Photo overlay fallback when no 3D model cached or credits = 0
- loadVehiclePhoto() fetches /api/vehicle_image and overlays on canvas
- hideVehiclePhoto() removes overlay when real GLB model loads
- Color picker, part selector, save and share build functionality"

# ── 2. Garage redesign + public profiles ───────────────────────────────────────
git add static/garage.js templates/garage.html templates/public_garage.html
git commit -m "Redesign garage with public profiles and build sharing

- Garage grid redesign with mod tracking and build cards
- Public garage route /garage/<username> for shareable profiles
- Clone Build and Share Build actions on each build card
- Delete car / delete mod endpoints added"

# ── 3. Social pages (meets, clubs, leaderboard, messaging, marketplace) ────────
git add \
  templates/meets.html templates/clubs.html templates/club_detail.html \
  templates/leaderboard.html templates/messages.html templates/settings.html \
  templates/race.html templates/the_shop.html templates/listing_detail.html \
  templates/search.html \
  static/messages.js static/settings.js static/race.js
git commit -m "Add social and marketplace pages

- Car meets page with RSVP
- Clubs directory and club detail view
- Leaderboard page
- Direct messaging UI and messages.js
- Settings page and settings.js
- Race / track day page and race.js
- The Shop marketplace with listing detail view
- Global search page"

# ── 4. Base template and auth pages ────────────────────────────────────────────
git add \
  templates/base.html templates/login.html templates/signup.html \
  templates/profile.html templates/error.html
git commit -m "Add base template, auth pages, and user profile

- base.html: nav, dark mode toggle, flash messages, responsive layout
- login.html / signup.html: styled auth forms
- profile.html: avatar, badges, garage preview, activity feed
- error.html: friendly error page"

# ── 5. Feed, style, and core frontend updates ──────────────────────────────────
git add templates/index.html static/script.js static/style.css vehicles.json README.md
git commit -m "Update feed, styles, and core frontend

- index.html: story bubbles, poll composer, weekly challenge widget
- script.js: polls (create/vote/render), stories, badges, challenge logic
- style.css: dark mode fixes, risk-box contrast, garage/builder/meets CSS
- vehicles.json: updated vehicle data
- README updated"

# ── 6. Backend: all new routes and Tripo V3 migration ─────────────────────────
git add app.py
git commit -m "Update backend routes and migrate Tripo API to V3

- Social: polls, stories, car meets, clubs, badges, weekly challenge
- Garage: delete_car, delete_mod, share_build, clone_build, public garage
- Builder: vehicle image API, Tripo balance, generate/poll/proxy GLB
- Compare: vehicle comparison save/load endpoints
- Messaging, settings, race, leaderboard, marketplace routes
- Migrate all Tripo API calls from V2 to V3 (per official SKILL.md):
    * Balance: v2/openapi/user/balance -> v3/account/balance (parse as float)
    * Upload:  v2/openapi/upload       -> v3/files (field: file_token not image_token)
    * Generate: v2/openapi/task        -> v3/generation/image-to-model
                                          v3/generation/text-to-model
    * Poll/fetch: v2/openapi/task/{id} -> v3/tasks/{id}
    * Debug history: task/history      -> v3/account/usage
    * Output field: pbr_model/model    -> model_url (with V2 fallbacks)
    * Thumbnail:    rendered_image     -> rendered_image_url
    * model_version required in V3; using v3.1-20260211"

# ── 7. Fix 3D builder + finish The Shop marketplace ───────────────────────────
git add static/builder.js static/style.css app.py
git commit -m "Fix 3D builder photo overlay and complete The Shop marketplace

3D Builder:
- Fix canvas selector bug: #builderCanvas -> #carCanvas in loadVehiclePhoto()
  (was causing photo overlay to silently fail on every load)

The Shop / Marketplace:
- Add /theshop route alias alongside /the_shop (frontend uses no-underscore URL)
- Add /theshop/listing/<id> alias for listing detail route
- Add all missing shop CSS to style.css:
    * .theshop-page, .theshop-header layout
    * .explore-controls, .explore-search-row, .explore-search-wrap (search bar)
    * .explore-sort, .sort-btn (sort buttons with active state)
    * .explore-filters, .filter-label, .filter-chip (category chips)
    * .explore-loading, .explore-empty (state indicators)
    * .listing-no-img, .listing-cat-badge, .listing-cond (card elements)
    * Responsive breakpoints at 640px"

echo ""
echo "=== All commits done! Run 'git push' to push to GitHub ==="
git log --oneline -8
