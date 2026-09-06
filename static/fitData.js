// ═══════════════════════════════════════════════════════════════
//  Fit Guides — client-side access to the interior-dimension data.
//
//  The figures themselves live in content/fit-guides/fit-data.json and are
//  served by /api/fit_data. They are deliberately NOT duplicated here: the
//  guide page renders its tables server-side from the same file, so a
//  corrected measurement is a one-line JSON edit that both paths pick up.
//
//  This module exists so the comparison page can flag fit inline — when
//  someone puts an Audi Q8 next to a Bronco Sport, the four-inch headroom
//  gap is exactly the kind of thing the spec table won't surface on its own.
//
//  /api/fit_data returns publishable rows only (verified, with a figure).
//  Unverified cars never reach the client.
// ═══════════════════════════════════════════════════════════════

let _fitCache = null;
let _fitPending = null;

function loadFitData() {
    if (_fitCache) return Promise.resolve(_fitCache);
    // Share one in-flight request — the compare page can ask for both sides
    // at once, and two fetches for a static file is wasteful.
    if (_fitPending) return _fitPending;

    _fitPending = fetch("/api/fit_data")
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
        .then(data => {
            _fitCache = data;
            _fitPending = null;
            return data;
        })
        .catch(err => {
            // Fit data is an enhancement — a failure here must never break
            // the comparison page it decorates.
            console.warn("Fit data unavailable:", err);
            _fitPending = null;
            return { cars: [], thresholds: {} };
        });
    return _fitPending;
}

// Matching is deliberately strict, for the reason the guide itself documents:
// headroom moves between generations while the model name stays the same. The
// BMW 3 Series lost 1.6" from the F30 to the G20, and the Kia Soul's figure
// changed in 2020. A loose substring match would happily show Gen 2 Prius
// numbers for a 2015 Prius, which is precisely the error this guide exists to
// correct — so an entry only matches on an exact model name (or a declared
// alias) AND a model year inside its generation.
function normalizeModel(s) {
    return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// "2015–2020" / "2020–present" → [2015, 2020] / [2020, Infinity].
// Handles both the en-dash used in the data and a plain hyphen.
function parseYearRange(years) {
    const s = String(years || "");
    const m = s.match(/(\d{4})\s*[–-]\s*(\d{4}|present)/i);
    if (m) {
        return [parseInt(m[1], 10),
                /present/i.test(m[2]) ? Infinity : parseInt(m[2], 10)];
    }
    // A bare year is a single-year entry, not an open range — without this it
    // would fall through to "no range" and match every model year.
    const one = s.match(/^\s*(\d{4})\s*$/);
    if (one) return [parseInt(one[1], 10), parseInt(one[1], 10)];
    return null;
}

// Body style is not cosmetic here: a hatchback roofline costs real headroom
// against the same car's sedan. The Mazda 3 hatch measures ~1.5" less than
// figures quoted for the sedan, so matching "K4 Hatchback" to a K4 Sedan entry
// would report a number the buyer will never sit under.
const BODY_WORDS = {
    hatch: /hatch/i,
    sedan: /sedan|saloon/i,
    coupe: /coupe|coupé/i,
    wagon: /wagon|estate|touring/i,
    convertible: /convertible|cabrio|roadster/i,
};

function bodyStyleOf(text) {
    for (const [key, re] of Object.entries(BODY_WORDS)) {
        if (re.test(text || "")) return key;
    }
    return null;
}

function findFitCar(data, make, model, year) {
    if (!make || !model) return null;
    const mk = normalizeModel(make);
    const md = normalizeModel(model);
    const yr = parseInt(year, 10);

    return (data.cars || []).find(c => {
        if (normalizeModel(c.make) !== mk) return false;

        const names = [c.model].concat(c.aliases || []).map(normalizeModel);
        // Allow a trim suffix ("X5 M40i" matching "X5") but never a bare
        // substring in the other direction, which is what let "Prius" match
        // "Prius (Gen 2)".
        const nameHit = names.some(n => md === n || md.startsWith(n + " "));
        if (!nameHit) return false;

        // If both sides name a body style and they disagree, it's a different
        // car however well the badge matches.
        const askedBody = bodyStyleOf(model);
        const entryBody = bodyStyleOf(`${c.model} ${c.body || ""}`);
        if (askedBody && entryBody && askedBody !== entryBody) return false;

        // No year from the comparison page means we can't rule out a
        // generation mismatch — only trust it if the entry spans one
        // generation that is still current.
        const range = parseYearRange(c.years);
        if (!range) return true;
        if (!yr) return range[1] === Infinity;
        return yr >= range[0] && yr <= range[1];
    }) || null;
}

const FIT_LABELS = {
    pick:    "Fits tall drivers",
    ok:      "Workable",
    watch:   "Tight",
    avoid:   "Tight for tall drivers",
    unknown: "Not measured",
};

// The honest number: if a with-roof figure is published, that's the one a
// buyer will actually live with.
function fitHeadroom(car) {
    if (!car) return null;
    return car.headroomRoof != null ? car.headroomRoof : car.headroom;
}

function fitBadgeHTML(car) {
    if (!car) return "";
    const key = car.verdictKey || "unknown";
    const roof = car.headroomRoof != null
        ? ` <span class="fit-roof-warn">${car.headroomRoof}" with roof</span>`
        : "";
    return `<div class="fit-inline fit-${key}">
        <span class="fit-pill fit-pill-${key}">${FIT_LABELS[key] || key}</span>
        <span class="fit-inline-num">${car.headroom}" front headroom</span>${roof}
    </div>`;
}
