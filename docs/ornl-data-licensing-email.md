# Email to ORNL — fueleconomy.gov commercial use

Send to the FuelEconomy.gov feedback address (linked from the site footer;
ORNL administers the site for DOE/EPA).

**Why this is worth sending:** the site's disclaimer says documents "may be
freely distributed and used for non-commercial, scientific and educational
purposes." That reads as a blocker, but it is ambiguous in a way that matters:
the clause refers to *documents*, while the Web Services API returns factual
data, and factual data is generally not subject to copyright in the US. A
written answer either way costs one email and decides whether the spec layer
is free or a $39/month line item.

Keep whatever reply comes back — a written yes is the paper trail that makes
this safe to rely on.

---

**Subject:** Commercial use of FuelEconomy.gov Web Services data

Hello,

I'm developing a consumer vehicle-comparison web application and would like to
use the FuelEconomy.gov Web Services API (fueleconomy.gov/ws) to display EPA
fuel economy figures and basic engine specifications to users.

The disclaimer page states that documents from the site "may be freely
distributed and used for non-commercial, scientific and educational purposes."
I want to make sure I understand how that applies to the Web Services data
specifically, since my application would be a commercial product.

Three questions:

1. May the data returned by the Web Services API be used in a commercial
   application?
2. If so, is attribution required, and is there wording you would like used?
3. Are there rate limits or usage guidelines I should follow?

To be clear about scope: I would be displaying the fuel economy and
specification values only. I understand from the disclaimer that the vehicle
photographs are manufacturer-owned and separately licensed, and I would not be
using those.

Thank you for maintaining this resource, and for any guidance you can offer.

Best regards,
Ayomide Adeloye
RideInsight
adeloyeayomide0@gmail.com

---

## If the answer is yes

Add a `fueleconomy` provider to `providers.py` alongside the existing one and
switch `SPEC_PROVIDER`. The seam is already there, so it is a new function
rather than a rewrite. Endpoints:

- `GET /ws/rest/vehicle/menu/make?year=2020` — makes for a year
- `GET /ws/rest/vehicle/menu/model?year=2020&make=Honda` — models
- `GET /ws/rest/vehicle/menu/options?year=...&make=...&model=...` — trims with IDs
- `GET /ws/rest/vehicle/<id>` — the full record for one vehicle

Responses are XML by default; send `Accept: application/json` for JSON.
Note the four-step lookup: menu calls narrow down to a vehicle ID before the
record itself, so cache the menu results per session to keep it to one round
trip per comparison.

## If the answer is no, or there is no reply

Fall back to the plan already in place: API Ninjas as a paid bridge for the
long tail, curated local data as the growing core. Nothing is blocked on
this — the email is an attempt to make the spec layer free, not a dependency.
