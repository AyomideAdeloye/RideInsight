# Run in VS Code's integrated terminal (PowerShell)
# Terminal > New Terminal, then: .\commit_now.ps1

Set-Location $PSScriptRoot

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

git push
git log --oneline -5
