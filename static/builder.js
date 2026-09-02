// ─── RideInsight 3D Builder ────────────────────────────────────────────────
// Modular mesh-swap builder powered by Three.js + real GLB assets

// ── Part configuration ─────────────────────────────────────────────────────
// ── Shared spoiler catalogue ───────────────────────────────────────────────
// The same spoilers are modelled on more than one body, so a slot name means
// the same part on every car. Previously each car defined its own meaning for
// Spoiler_A/B/C, which made a saved build's spoiler wrong if it was loaded
// onto a different body. One list, one meaning.
//
//   Spoiler_None  no spoiler
//   Spoiler_A     Lip Spoiler   (originally the muscle car's)
//   Spoiler_B     Sport Wing
//   Spoiler_C     GT Wing
//   Spoiler_D     Flat Trunk    (originally the Mazda's lip)
//
// Slots self-manage: a car only shows the ones actually present in its GLB.
const SPOILER_VARIANTS = [
    { name: "Spoiler_None", label: "None",        price: 0,   alwaysShow: true },
    { name: "Spoiler_A",    label: "Lip Spoiler", price: 3290,
      url: "https://bulletproofautomotive.com/product/adro-m2-hd-edition-at-m3/" },
    { name: "Spoiler_B",    label: "Sport Wing",  price: 51,
      url: "https://www.vevor.com/trunk-spoiler-c_11517/vevor-universal-rear-spoiler-46-3-gt-style-trunk-wing-for-sedans-and-coupes-p_010829674214" },
    // ECS "Functional Aerodynamic Rear Wing Kit", universal fitment.
    // Listed at "starting at $1,652.78" — the entry configuration.
    { name: "Spoiler_C",    label: "GT Wing",     price: 1653,
      url: "https://www.ecstuning.com/b-ecs-parts/functional-aerodynamic-rear-wing-kit-universal-fitment/013903la~dk/" },
    { name: "Spoiler_D",    label: "Flat Trunk",  price: 270,
      url: "https://www.darspoilers.com/products/acura-rsx-factory-post-no-light-spoiler-2002-2006?variant=31758423556" },
];

// Each car loads wearing the spoiler it actually ships with.
const spoilerCategory = (defaultName) => ({
    key:      "Spoiler",
    label:    "Spoiler",
    icon:     "flag",
    default:  defaultName,
    variants: SPOILER_VARIANTS,
});

// ── Shared wheel catalogue ─────────────────────────────────────────────────
// Same reasoning as spoilers: one slot name, one product, every car. These
// were duplicated per vehicle, which meant a price or link fix had to be made
// twice and could silently drift apart.
//
// Wheel_A is each car's own stock rim, so its price stays 0 — the label is
// overridden per car where the stock wheel is a known product.
const WHEEL_VARIANTS = [
    { name: "Wheel_A", label: "Stock",         price: 0 },
    { name: "Wheel_B", label: 'EV112 21"',     price: 4295,
      url: "https://evsportline.com/products/ev112-21-porsche-taycan-wheel-set-of-4" },
    { name: "Wheel_C", label: "SL-C13",        price: 5996,
      url: "https://www.spluxwheels.com/products/sl-c13" },
    { name: "Wheel_D", label: "Enkei TS-7",    price: 1152,
      url: "https://www.carid.com/enkei-wheels/ts-7-matte-bronze-6950365539.html" },
    { name: "Wheel_E", label: "ENKEI Triumph", price: 1131,
      url: "https://www.fitmentindustries.com/buy-wheel-offset/543-885-6538ZP/enkei-triumph-18x85-38" },
    { name: "Wheel_F", label: "ENKEI PF06",    price: 1609,
      url: "https://www.fitmentindustries.com/buy-wheel-offset/545-790-8035GG/enkei-pf06-17x9-35" },
];

// `stock` lets a car describe its own Wheel_A without forking the catalogue.
const wheelCategory = (stock) => ({
    key:      "Wheels",
    label:    "Wheels",
    icon:     "circle",
    default:  "Wheel_A",
    variants: stock
        ? WHEEL_VARIANTS.map(v => v.name === "Wheel_A" ? { ...v, ...stock } : v)
        : WHEEL_VARIANTS,
});

// ── Shared brake catalogue ─────────────────────────────────────────────────
const BRAKE_VARIANTS = [
    { name: "Brake_A", label: "Stock", price: 0 },
    { name: "Brake_B", label: "Brembo GT Slotted", price: 2295,
      url: "https://www.buybrakes.com/2016-mazda-6/big-brake-kits/bm-brembo-gt-systems-slotted-big-brake-kits" },
];

const brakeCategory = (stock) => ({
    key:      "Brakes",
    label:    "Brakes",
    icon:     "circle-dot",
    default:  "Brake_A",
    variants: stock
        ? BRAKE_VARIANTS.map(v => v.name === "Brake_A" ? { ...v, ...stock } : v)
        : BRAKE_VARIANTS,
});

// ── Shared exhaust catalogue ───────────────────────────────────────────────
// Mesh names: Exhaust_A, Exhaust_B, Exhaust_C. For dual-exit systems modelled
// as two objects, Exhaust_B_L and Exhaust_B_R both map to Exhaust_B.
//
// `hp` here is what makes a visual part a performance part too — an exhaust
// genuinely adds power, so it counts toward the build's output instead of
// being duplicated as a separate non-visual mod.
// Exhaust_Stock is whatever system the car left the factory with. Cars that
// name that mesh plain "Exhaust" map it here with an alias. A, B and C are the
// aftermarket systems, shared across bodies — so a car can carry its own stock
// pipe AND the three aftermarket options without them fighting for one slot.
const EXHAUST_VARIANTS = [
    { name: "Exhaust_Stock", label: "Stock",     price: 0 },
    // TODO: real prices + retailer links once sourced
    { name: "Exhaust_A", label: "Single Exit", price: 0 },
    { name: "Exhaust_B", label: "Dual Exit",   price: 450, hp: 12, effect: "exhaust" },
    { name: "Exhaust_C", label: "Quad Tips",   price: 900, hp: 18, effect: "exhaust" },
];

// `defaultName` is the slot this body ships wearing — it shows as "Included"
// and isn't billed. The muscle car's own pipe IS Exhaust_A; everyone else uses
// Exhaust_Stock.
const exhaustCategory = (defaultName = "Exhaust_Stock", stock) => ({
    key:      "Exhaust",
    label:    "Exhaust",
    icon:     "flame",
    default:  defaultName,
    variants: stock
        ? EXHAUST_VARIANTS.map(v => v.name === defaultName ? { ...v, ...stock } : v)
        : EXHAUST_VARIANTS,
});

const MUSCLECAR_CATEGORIES = [
    {
        key:      "Hood",
        label:    "Hood",
        icon:     "chevrons-up",
        variants: [
            { name: "Hood_A", label: "Stock Hood",  price: 0 },
            { name: "Hood_B", label: "Low Profile", price: 650 },
            { name: "Hood_C", label: "Vented Hood", price: 950 },
        ]
    },
    {
        key:      "FrontBumper",
        label:    "Front Bumper",
        icon:     "shield",
        variants: [
            { name: "FrontBumper_A", label: "Stock",      price: 0 },
            { name: "FrontBumper_B", label: "Sport",      price: 550 },
            { name: "FrontBumper_C", label: "Aggressive", price: 850 },
        ]
    },
    {
        key:      "RearBumper",
        label:    "Rear Bumper",
        icon:     "shield",
        variants: [
            { name: "RearBumper_A", label: "Stock",    price: 0 },
            { name: "RearBumper_B", label: "Sport",    price: 500 },
            { name: "RearBumper_C", label: "Diffuser", price: 800 },
        ]
    },
    spoilerCategory("Spoiler_A"),   // ships with the lip spoiler
    exhaustCategory("Exhaust_A"),
    {
        key:      "Fender",
        label:    "Fenders",
        icon:     "maximize-2",
        variants: [
            { name: "Fender_A", label: "Stock",     price: 0 },
            { name: "Fender_B", label: "Wide Body", price: 1200 },
            { name: "Fender_C", label: "Flared",    price: 750 },
        ]
    },
    {
        key:      "RunningBoard",
        label:    "Side Skirts",
        icon:     "minus",
        variants: [
            { name: "RunningBoard_A", label: "Standard", price: 0 },
            { name: "RunningBoard_B", label: "Sport",    price: 350 },
            { name: "RunningBoard_C", label: "Carbon",   price: 600 },
        ]
    },
    // Wheel_A here is the pack's own SM_Wheel set, mapped via `aliases`.
    wheelCategory(),
    brakeCategory(),
];

// ── Vehicle registry (RI-VAS) ──────────────────────────────────────────────
// Add a new body: drop the GLB in /static/models/, add an entry here with its
// part categories. Everything else (UI, paint, save/load) adapts automatically.
// Mazda 6 GJ (2014–2018) — first in-house model. Tripo → Blender → RI-VAS.
// Only stock (_A) parts exist so far; _B/_C variants get added as they're modeled.
const MAZDA6_GJ_CATEGORIES = [
    {
        key:      "Hood",
        label:    "Hood",
        icon:     "chevrons-up",
        variants: [
            { name: "Hood_A", label: "Stock Hood", price: 0 },
        ]
    },
    {
        key:      "FrontBumper",
        label:    "Front Bumper",
        icon:     "shield",
        variants: [
            { name: "FrontBumper_A", label: "Stock", price: 0 },
        ]
    },
    {
        key:      "RearBumper",
        label:    "Rear Bumper",
        icon:     "shield",
        variants: [
            { name: "RearBumper_A", label: "Stock", price: 0 },
        ]
    },
    // Base car has no spoiler — the flat trunk is an aftermarket part, so it
    // has to be billed like any other. Only the muscle car actually ships
    // with its spoiler.
    spoilerCategory("Spoiler_None"),
    {
        key:      "FrontLip",
        label:    "Front Lip",
        icon:     "chevrons-down",
        variants: [
            { name: "FrontLip_A", label: "None",     price: 0,   alwaysShow: true },
            { name: "FrontLip_B", label: "Splitter", price: 650 },
            { name: "FrontLip_C", label: "Chin Lip", price: 400 },
        ]
    },
    {
        key:      "SideSkirt",
        label:    "Side Skirts",
        icon:     "minus",
        variants: [
            { name: "SideSkirt_A", label: "None",   price: 0,   alwaysShow: true },
            { name: "SideSkirt_B", label: "Sport",  price: 700 },
            { name: "SideSkirt_C", label: "Carbon", price: 1100 },
        ]
    },
    // The Mazda's stock 19" is a known listing, so it overrides Wheel_A.
    exhaustCategory(),
    wheelCategory({ label: 'Stock 19"', url: "https://www.walmart.com/ip/1320398289" }),
    // Brake_A on this car IS the Brembo kit — the modelled calipers and rotors
    // were rebuilt as the GT slotted set, so the stock slot is the real
    // product. Export Brake_B_FL/FR/BL/BR to add a second option.
    brakeCategory({ label: "Brembo GT Slotted", price: 2295,
                    url: "https://www.buybrakes.com/2016-mazda-6/big-brake-kits/bm-brembo-gt-systems-slotted-big-brake-kits" }),
];

// ── Modern Sedan ───────────────────────────────────────────────────────────
// Bought pack. Only wheels and brakes are cut so far; the rest of the slots
// appear automatically as parts get exported.
const SEDAN_CATEGORIES = [
    wheelCategory(),
    brakeCategory(),
    exhaustCategory(),
    spoilerCategory("Spoiler_None"),
];

// ── BMW M3 / M4 ────────────────────────────────────────────────────────────
// Same platform, same parts bin, so they share one category list. Slots
// self-manage, so each car only shows what its own GLB actually contains —
// nothing breaks if one has a spoiler modelled and the other doesn't yet.
const BMW_M_CATEGORIES = [
    wheelCategory(),
    brakeCategory(),
    exhaustCategory(),
    spoilerCategory("Spoiler_None"),
    {
        key:      "Hood",
        label:    "Hood",
        icon:     "chevrons-up",
        variants: [
            { name: "Hood_A", label: "Stock", price: 0 },
            { name: "Hood_B", label: "Vented", price: 0 },
        ]
    },
    {
        key:      "FrontLip",
        label:    "Front Lip",
        icon:     "minus",
        default:  "FrontLip_None",
        variants: [
            { name: "FrontLip_None", label: "None", price: 0, alwaysShow: true },
            { name: "FrontLip_A", label: "Carbon Lip", price: 0 },
        ]
    },
    {
        key:      "FrontBumper",
        label:    "Front Bumper",
        icon:     "shield",
        variants: [
            { name: "FrontBumper_A", label: "Stock", price: 0 },
            { name: "FrontBumper_B", label: "Sport", price: 0 },
        ]
    },
    {
        key:      "RearBumper",
        label:    "Rear Bumper",
        icon:     "shield",
        variants: [
            { name: "RearBumper_A", label: "Stock", price: 0 },
            { name: "RearBumper_B", label: "Diffuser", price: 0 },
        ]
    },
];

// The M3 export names its single exhaust "Exhaust" and its lip "Front_Lip",
// which don't fit the slot convention. Aliasing beats re-exporting: both
// become swappable against None without touching the model.
const BMW_M_ALIASES = {
    "Exhaust_Stock": /^Exhaust$/i,
    "FrontLip_A":    /^Front_?Lip$/i,
};

const VEHICLES = {
    musclecar: {
        label:      "Muscle Car",
        sub:        "'67 American V8",
        glb:        "/static/models/musclecar.glb",
        categories: MUSCLECAR_CATEGORIES,
        // Modelled along X (bbox 4.92 × 2.07) with the front bumper at +X,
        // so it needs a quarter turn to face +Z like the other two.
        rotationY:  -Math.PI / 2,
        // This pack ships its stock wheels as SM_Wheel_FL/FR/BL/BR. Rather
        // than renaming them in Blender (and re-exporting a 15MB file), map
        // that name onto the Wheel_A slot so they behave as the stock variant
        // and hide when another wheel is selected.
        aliases: { "Wheel_A": /^SM_Wheel/i },
    },
    sedan_modern: {
        label:      "Modern Sedan",
        sub:        "Midsize · 4-door",
        glb:        "/static/models/sedan_modern.glb",
        categories: SEDAN_CATEGORIES,
        rotationY:  0,           // headlights sit at +Z — already faces camera
        // Factory pipe is exported as plain "Exhaust"; A/B/C are the
        // aftermarket systems carried over from the muscle car.
        aliases:    { "Exhaust_Stock": /^Exhaust$/i },
    },
    mazda6_gj: {
        label:      "Mazda 6",
        sub:        "GJ · 2014–2018",
        glb:        "/static/models/mazda6_gj.glb",
        categories: MAZDA6_GJ_CATEGORIES,
        rotationY:  0,        // Tripo exports already face +Z; muscle car needs PI
        aliases:    { "Exhaust_Stock": /^Exhaust$/i },
    },
    bmw_m3: {
        label:      "BMW M3",
        sub:        "G80 · Sedan",
        glb:        "/static/models/bmw_m3.glb",
        categories: BMW_M_CATEGORIES,
        rotationY:  0,        // headlights measured at +Z — already faces camera
        aliases:    BMW_M_ALIASES,
    },
    bmw_m4: {
        label:      "BMW M4",
        sub:        "G82 · Competition",
        glb:        "/static/models/bmw_m4.glb",
        categories: BMW_M_CATEGORIES,
        rotationY:  0,        // same bbox orientation as the M3
        aliases:    BMW_M_ALIASES,
    },
    // hypercar:   { label: "Hyper Car",   sub: "Exotic",        glb: "/static/models/hypercar.glb",   categories: [...] },
};

// ── Model matching: real car → best available 3D body ─────────────────────
// exact: specific make/model (+optional year range) → a dedicated model
// archetype: fallback by vehicle character when no exact model exists yet
const MODEL_MATCHERS = [
    // ── Exact models (in-house, RI-VAS compliant) ──
    { make: "mazda", model: "6", modelExact: true, years: [2014, 2018], vehicle: "mazda6_gj", exact: true },
    { make: "mazda", model: "mazda6", modelExact: true, years: [2014, 2018], vehicle: "mazda6_gj", exact: true },

    // ── Modern sedan archetype — the most-driven body style ──
    { make: "honda",      model: "accord",   vehicle: "sedan_modern" },
    { make: "honda",      model: "civic",    vehicle: "sedan_modern" },
    { make: "toyota",     model: "camry",    vehicle: "sedan_modern" },
    { make: "toyota",     model: "corolla",  vehicle: "sedan_modern" },
    { make: "nissan",     model: "altima",   vehicle: "sedan_modern" },
    { make: "nissan",     model: "sentra",   vehicle: "sedan_modern" },
    { make: "nissan",     model: "maxima",   vehicle: "sedan_modern" },
    { make: "hyundai",    model: "sonata",   vehicle: "sedan_modern" },
    { make: "hyundai",    model: "elantra",  vehicle: "sedan_modern" },
    { make: "kia",        model: "optima",   vehicle: "sedan_modern" },
    { make: "kia",        model: "k5",       vehicle: "sedan_modern" },
    { make: "kia",        model: "forte",    vehicle: "sedan_modern" },
    { make: "mazda",      model: "6",        modelExact: true, vehicle: "sedan_modern" },
    { make: "mazda",      model: "3",        modelExact: true, vehicle: "sedan_modern" },
    { make: "subaru",     model: "legacy",   vehicle: "sedan_modern" },
    { make: "subaru",     model: "impreza",  vehicle: "sedan_modern" },
    { make: "volkswagen", model: "passat",   vehicle: "sedan_modern" },
    { make: "volkswagen", model: "jetta",    vehicle: "sedan_modern" },
    { make: "chevrolet",  model: "malibu",   vehicle: "sedan_modern" },
    { make: "chevrolet",  model: "impala",   vehicle: "sedan_modern" },
    { make: "chevrolet",  model: "cruze",    vehicle: "sedan_modern" },
    { make: "ford",       model: "fusion",   vehicle: "sedan_modern" },
    { make: "ford",       model: "taurus",   vehicle: "sedan_modern" },
    { make: "acura",      model: "tlx",      vehicle: "sedan_modern" },
    { make: "lexus",      model: "es",       modelExact: true, vehicle: "sedan_modern" },
    { make: "bmw",        model: "3 series", vehicle: "sedan_modern" },
    { make: "bmw",        model: "5 series", vehicle: "sedan_modern" },
    { make: "mercedes",   model: "c-class",  vehicle: "sedan_modern" },
    { make: "mercedes",   model: "e-class",  vehicle: "sedan_modern" },
    { make: "audi",       model: "a4",       vehicle: "sedan_modern" },
    { make: "audi",       model: "a6",       vehicle: "sedan_modern" },

    // Archetype fallbacks — muscle/pony/performance RWD cars → muscle car body
    { make: "ford",      model: "mustang",    vehicle: "musclecar" },
    { make: "chevrolet", model: "camaro",     vehicle: "musclecar" },
    { make: "dodge",     model: "charger",    vehicle: "musclecar" },
    { make: "dodge",     model: "challenger", vehicle: "musclecar" },
    { make: "pontiac",   model: "gto",        vehicle: "musclecar" },
    { make: "pontiac",   model: "firebird",   vehicle: "musclecar" },
    { make: "plymouth",  model: "barracuda",  vehicle: "musclecar" },
];

// Returns { key, exact } — falls back to the default body
function matchVehicleModel(make, model, year) {
    const m  = (make  || "").toLowerCase();
    const md = (model || "").toLowerCase();
    const yr = parseInt(year, 10) || 0;
    for (const rule of MODEL_MATCHERS) {
        if (!m.includes(rule.make)) continue;
        // modelExact avoids false hits on short names ("6" matching "626"/"MX-6")
        const modelHit = rule.modelExact
            ? md.replace(/[\s-]/g, "") === rule.model
            : md.includes(rule.model);
        if (!modelHit) continue;
        if (rule.years && (yr < rule.years[0] || yr > rule.years[1])) continue;
        return { key: rule.vehicle, exact: !!rule.exact };
    }
    // Default: a modern sedan is the closest match for most unknown cars
    return { key: "sedan_modern", exact: false };
}

function updateModelMatchBanner(make, model, exact) {
    const banner = document.getElementById("modelMatchBanner");
    if (!banner) return;
    if (!make || !model) { banner.style.display = "none"; return; }
    banner.style.display = "flex";
    if (exact) {
        banner.className = "model-match-banner exact";
        banner.innerHTML = `<i data-lucide="badge-check"></i> Exact 3D model: ${make} ${model}`;
    } else {
        banner.className = "model-match-banner approx";
        banner.innerHTML = `<i data-lucide="info"></i> ${make} ${model} — showing closest body style (${VEHICLES[currentVehicleKey].label}). Exact model coming soon.`;
    }
    if (window.refreshIcons) window.refreshIcons();
}

let currentVehicleKey = "musclecar";
let PART_CATEGORIES   = VEHICLES[currentVehicleKey].categories;
let VARIANT_INFO      = {};
let ALL_PART_MESHES   = [];

function rebuildPartIndex() {
    PART_CATEGORIES = VEHICLES[currentVehicleKey].categories;
    VARIANT_INFO = {};
    PART_CATEGORIES.forEach(c => c.variants.forEach(v => {
        VARIANT_INFO[v.name] = { label: v.label, price: v.price, category: c.label,
                                 hp: v.hp || 0, effect: v.effect || "" };
    }));
    ALL_PART_MESHES = PART_CATEGORIES.flatMap(c => c.variants.map(v => v.name));
    Object.keys(selected).forEach(k => delete selected[k]);
    // A category can name its default so that adding an option to the front of
    // the list (like "None") doesn't silently change how the car loads.
    PART_CATEGORIES.forEach(c => {
        selected[c.key] = c.default || c.variants[0].name;
    });
}

// (An ALWAYS_VISIBLE list used to live here. It was dead code, and it listed
//  SM_Wheel_* as permanently visible — which now contradicts the musclecar
//  alias that maps those meshes onto the swappable Wheel_A slot. isBaseMesh()
//  is the single source of truth for base geometry.)

// Current selected variant per category (populated by rebuildPartIndex)
const selected = {};
rebuildPartIndex();

// Paint colors
const PAINT_COLORS = [
    { hex: "#1a1a1a", label: "Midnight Black" },
    { hex: "#f0f0f0", label: "Pearl White" },
    { hex: "#c0392b", label: "Racing Red" },
    { hex: "#2471a3", label: "Ocean Blue" },
    { hex: "#1e8449", label: "British Racing Green" },
    { hex: "#d4ac0d", label: "Satin Gold" },
    { hex: "#6c3483", label: "Midnight Purple" },
    { hex: "#e67e22", label: "Burnt Orange" },
];

let currentPaintHex = "#1a1a1a";

// ── Paint finish ───────────────────────────────────────────────────────────
// Clearcoat is what sells "car paint" vs "plastic toy".
const PAINT_FINISHES = [
    { key: "gloss",    label: "Gloss",    sub: "Factory",  price: 0,
      roughness: 0.14, metalness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.03, env: 1.1 },
    { key: "metallic", label: "Metallic", sub: "Flake",    price: 1200,
      roughness: 0.22, metalness: 0.85, clearcoat: 1.0, clearcoatRoughness: 0.06, env: 1.35 },
    { key: "satin",    label: "Satin",    sub: "Wrap",     price: 2500,
      roughness: 0.42, metalness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.35, env: 0.8 },
    { key: "matte",    label: "Matte",    sub: "Wrap",     price: 3000,
      roughness: 0.88, metalness: 0.08, clearcoat: 0.0, clearcoatRoughness: 1.0, env: 0.45 },
    { key: "chrome",   label: "Chrome",   sub: "Wrap",     price: 5000,
      roughness: 0.04, metalness: 1.0, clearcoat: 1.0, clearcoatRoughness: 0.02, env: 1.6 },
];
let currentFinish = "gloss";

// ── Window tint ────────────────────────────────────────────────────────────
// Doubles as a way to hide empty cabins on models with no interior mesh.
// Real-world pricing: film darkness barely changes cost — it's the same labor.
// ~$90 side windows, ~$110 windshield/rear = ~$200 for a full car.
// `dim` stays high so the film colour survives at dark levels — opacity
// carries the darkness instead of crushing the hue to black.
const TINT_LEVELS = [
    { key: "clear",   label: "Clear",   sub: "Factory", opacity: 0.26, dim: 1.00, price: 0 },
    { key: "light",   label: "Light",   sub: "50% VLT", opacity: 0.55, dim: 0.95, price: 200 },
    { key: "medium",  label: "Medium",  sub: "35% VLT", opacity: 0.74, dim: 0.85, price: 200 },
    { key: "dark",    label: "Dark",    sub: "20% VLT", opacity: 0.88, dim: 0.72, price: 200 },
    { key: "limo",    label: "Limo",    sub: "5% VLT",  opacity: 0.97, dim: 0.60, price: 200 },
];

// Vivid film colors — subtle shades were invisible behind dark glass
const TINT_COLORS = [
    { hex: "#0d1218", label: "Charcoal" },
    { hex: "#2b7fff", label: "Blue"     },
    { hex: "#22d3ee", label: "Cyan"     },
    { hex: "#17c964", label: "Green"    },
    { hex: "#e8a12c", label: "Gold"     },
    { hex: "#ef4444", label: "Red"      },
    { hex: "#a855f7", label: "Purple"   },
    { hex: "#ec4899", label: "Pink"     },
];

let currentTint    = "medium";     // default hides empty cabins
let currentTintHex = "#0d1218";

// ── Accent parts (spoilers, wings, splitters, diffusers) ───────────────────
// These are rarely body-matched in real life, so they get their own colour.
// Parts that follow the accent colour rather than the body paint. These are
// the bolt-ons people deliberately contrast: spoilers, lips, splitters,
// diffusers, skirts.
//
// "Lip_" previously required a trailing underscore, so a mesh called
// "Front_Lip" or a material called "Lip" fell through and took body paint.
// Matching the word anywhere makes the behaviour deliberate instead of
// depending on how the part happened to be named.
function isAccentPart(name) {
    const n = name || "";
    // "Lip" needs care: a bare substring match also catches Clip and Flip.
    // Accept it at the start, after a separator, or as a camelCase suffix.
    const isLip = /(^|[^A-Za-z])Lip/i.test(n) || /(Front|Rear|Side|Chin)Lip/i.test(n);
    return isLip || /Spoiler|Wing|Diffuser|Splitter|Canard|Skirt/i.test(n);
}

const ACCENT_FINISHES = [
    { key: "match",  label: "Body",   hex: null,      roughness: 0.14, metalness: 0.45 },
    { key: "gloss",  label: "Black",  hex: "#0b0d10", roughness: 0.10, metalness: 0.35 },
    { key: "matte",  label: "Matte",  hex: "#15171a", roughness: 0.85, metalness: 0.05 },
    { key: "carbon", label: "Carbon", hex: "#1a1d22", roughness: 0.22, metalness: 0.65 },
    { key: "silver", label: "Silver", hex: "#b9c0c8", roughness: 0.18, metalness: 0.85 },
];
let currentAccent    = "gloss";     // most spoilers are gloss black
let currentAccentHex = "#0b0d10";

// Caliper colour is its own choice — Brembo ships these as stock options,
// so the swatches mirror what you can actually order rather than free rein.
const CALIPER_COLORS = [
    { key: "red",     label: "Red",     hex: "#b02a2a" },
    { key: "black",   label: "Black",   hex: "#141619" },
    { key: "yellow",  label: "Yellow",  hex: "#e0b400" },
    { key: "silver",  label: "Silver",  hex: "#b6bcc4" },
    { key: "blue",    label: "Blue",    hex: "#1f4ed8" },
    { key: "gold",    label: "Gold",    hex: "#c8a13c" },
];
let currentCaliper    = "red";
let currentCaliperHex = "#b02a2a";

function applyCaliperColor(key, customHex) {
    const c = CALIPER_COLORS.find(x => x.key === key) || CALIPER_COLORS[0];
    if (customHex) { currentCaliper = "custom"; currentCaliperHex = customHex; }
    else { currentCaliper = c.key; currentCaliperHex = c.hex; }

    if (carModel) {
        const col = new THREE.Color(currentCaliperHex).convertSRGBToLinear();
        carModel.traverse(node => {
            if (!node.isMesh) return;
            const rivas = node.userData.rivasName || effectiveName(node);
            const mats  = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(mat => {
                if (!mat || !mat.color) return;
                // Same per-material rule as tint: calipers are often a
                // primitive inside a larger wheel/brake mesh.
                const isCaliper = /Caliper/i.test(mat.name || "")
                               || (mats.length === 1 && /Caliper/i.test(rivas));
                if (!isCaliper) return;
                mat.color.copy(col);
                mat.needsUpdate = true;
            });
        });
    }

    document.querySelectorAll(".caliper-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.caliper === currentCaliper);
    });
    const picker = document.getElementById("caliperCustomColor");
    if (picker && customHex) picker.value = customHex;
    updateBuildSummary();
}

function applyAccent(key, customHex) {
    const f = ACCENT_FINISHES.find(x => x.key === key) || ACCENT_FINISHES[1];
    currentAccent = f.key;
    if (customHex) { currentAccent = "custom"; currentAccentHex = customHex; }
    else if (f.hex) currentAccentHex = f.hex;

    applyPaint(currentPaintHex);   // repaints body + accents together

    document.querySelectorAll(".accent-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.accent === currentAccent);
    });
    const picker = document.getElementById("accentCustomColor");
    if (picker && customHex) picker.value = customHex;
    updateBuildSummary();
}

function isGlassPart(name) {
    const n = name || "";
    // Lights are often modelled as glass/lens material — never tint them,
    // or changing window tint recolours the headlights and taillights.
    if (/Light|Lamp|Lens|Head|Tail|Signal|Turn|Indicator|Fog|Rot_/i.test(n)) return false;
    return /Glass|Window|Windshield|Windscreen/i.test(n);
}

function applyGlassTint(key, colorHex) {
    const level = TINT_LEVELS.find(t => t.key === key) || TINT_LEVELS[2];
    currentTint = level.key;
    if (colorHex) currentTintHex = colorHex;

    // Darkness dims the chosen film colour rather than replacing it,
    // so a blue tint still reads blue at limo darkness.
    const col = new THREE.Color(currentTintHex).convertSRGBToLinear();
    col.multiplyScalar(level.dim);

    // Coloured films get a subtle self-lit glow so the hue reads through heavy
    // tint. Low-saturation choices (charcoal/grey) stay plain glass.
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(currentTintHex).getHSL(hsl);
    const glow     = hsl.s < 0.25 ? 0 : 0.35 * hsl.s;
    const emissive = new THREE.Color(currentTintHex).convertSRGBToLinear()
                         .multiplyScalar(glow);

    if (carModel) {
        carModel.traverse(node => {
            if (!node.isMesh) return;
            const rivas = node.userData.rivasName || effectiveName(node);
            const mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(mat => {
                if (!mat || !mat.color) return;

                // Decide per MATERIAL, not per mesh. One mesh can carry paint,
                // chrome and glass as separate primitives — the muscle car's
                // "Body" mesh does exactly that, with Car_GlassWindow buried
                // among them. Testing only material[0] missed it entirely, so
                // tint silently did nothing on that car.
                // The mesh-name fallback is only safe on single-material meshes,
                // where the name unambiguously describes the whole thing.
                const isGlass = isGlassPart(mat.name)
                             || (mats.length === 1 && isGlassPart(rivas));
                if (!isGlass) return;
                mat.color.copy(col);
                mat.transparent = true;
                mat.opacity     = level.opacity;
                mat.roughness   = 0.04;
                mat.metalness   = 0.1;
                mat.depthWrite  = level.opacity > 0.92;  // solid enough to occlude
                if (mat.emissive) {
                    mat.emissive.copy(emissive);
                    if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 1.0;
                }
                mat.needsUpdate = true;
            });
        });
    }

    // Update button + swatch states
    document.querySelectorAll(".tint-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tint === level.key);
    });
    document.querySelectorAll(".tint-color-swatch").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.hex === currentTintHex);
    });
    const picker = document.getElementById("tintCustomColor");
    if (picker && picker.value !== currentTintHex) picker.value = currentTintHex;

    updateBuildSummary();
}

function setTintColor(hex) { applyGlassTint(currentTint, hex); }

function buildFinishUI() {
    const container = document.getElementById("categorySections");
    if (!container) return;

    const header = document.createElement("div");
    header.className = "builder-section-group-label";
    header.innerHTML = `<i data-lucide="sparkles"></i> Paint Finish`;
    container.appendChild(header);

    const section = document.createElement("div");
    section.className = "builder-section";
    section.innerHTML = `
        <div class="builder-section-body">
            <div class="finish-row">
                ${PAINT_FINISHES.map(f => `
                    <button class="finish-btn ${f.key === currentFinish ? "active" : ""}"
                            data-finish="${f.key}"
                            onclick="applyFinish('${f.key}')">
                        <span class="finish-swatch finish-${f.key}"></span>
                        <span class="finish-label">${f.label}</span>
                        <span class="finish-sub">${f.price > 0 ? "+$" + f.price.toLocaleString() : f.sub}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `;
    container.appendChild(section);
}

function buildAccentUI() {
    const container = document.getElementById("categorySections");
    if (!container) return;

    const header = document.createElement("div");
    header.className = "builder-section-group-label";
    header.innerHTML = `<i data-lucide="wind"></i> Spoiler / Body Kit Finish`;
    container.appendChild(header);

    const section = document.createElement("div");
    section.className = "builder-section";
    section.innerHTML = `
        <div class="builder-section-body">
            <div class="accent-row">
                ${ACCENT_FINISHES.map(f => `
                    <button class="accent-btn ${f.key === currentAccent ? "active" : ""}"
                            data-accent="${f.key}"
                            onclick="applyAccent('${f.key}')">
                        <span class="accent-swatch" style="background:${f.hex || "linear-gradient(135deg,#c0392b,#2471a3)"};"></span>
                        <span class="accent-label">${f.label}</span>
                    </button>
                `).join("")}
            </div>
            <div class="accent-custom-row">
                <span class="accent-custom-label">Custom</span>
                <input type="color" id="accentCustomColor" value="${currentAccentHex}"
                       onchange="applyAccent('custom', this.value)">
            </div>
        </div>
    `;
    container.appendChild(section);
}

function buildCaliperUI() {
    const container = document.getElementById("categorySections");
    if (!container) return;

    // Only worth showing if the car actually has calipers modelled.
    let hasCaliper = false;
    if (carModel) {
        carModel.traverse(node => {
            if (hasCaliper || !node.isMesh) return;
            const rivas = node.userData.rivasName || effectiveName(node);
            const mats  = Array.isArray(node.material) ? node.material : [node.material];
            if (/Caliper/i.test(rivas) || mats.some(m => /Caliper/i.test(m?.name || ""))) {
                hasCaliper = true;
            }
        });
    }
    if (!hasCaliper) return;

    const header = document.createElement("div");
    header.className = "builder-section-group-label";
    header.innerHTML = `<i data-lucide="circle-dot"></i> Caliper Colour`;
    container.appendChild(header);

    const section = document.createElement("div");
    section.className = "builder-section";
    section.innerHTML = `
        <div class="builder-section-body">
            <div class="accent-row">
                ${CALIPER_COLORS.map(c => `
                    <button class="accent-btn caliper-btn ${c.key === currentCaliper ? "active" : ""}"
                            data-caliper="${c.key}"
                            onclick="applyCaliperColor('${c.key}')">
                        <span class="accent-swatch" style="background:${c.hex};"></span>
                        <span class="accent-label">${c.label}</span>
                    </button>
                `).join("")}
            </div>
            <div class="accent-custom-row">
                <span class="accent-custom-label">Custom</span>
                <input type="color" id="caliperCustomColor" value="${currentCaliperHex}"
                       onchange="applyCaliperColor('custom', this.value)">
            </div>
        </div>
    `;
    container.appendChild(section);
}

function buildTintUI() {
    const container = document.getElementById("categorySections");
    if (!container) return;

    const header = document.createElement("div");
    header.className = "builder-section-group-label";
    header.innerHTML = `<i data-lucide="sun"></i> Window Tint`;
    container.appendChild(header);

    const section = document.createElement("div");
    section.className = "builder-section";
    section.innerHTML = `
        <div class="builder-section-body">
            <div class="tint-row">
                ${TINT_LEVELS.map(t => `
                    <button class="tint-btn ${t.key === currentTint ? "active" : ""}"
                            data-tint="${t.key}"
                            onclick="applyGlassTint('${t.key}')"
                            title="${t.sub}">
                        <span class="tint-swatch" style="--tint:rgba(10,14,20,${t.opacity});"></span>
                        <span class="tint-label">${t.label}</span>
                        <span class="tint-sub">${t.price > 0 ? "+$" + t.price : t.sub}</span>
                    </button>
                `).join("")}
            </div>

            <div class="tint-color-row">
                <span class="tint-color-label">Film color</span>
                <div class="tint-color-swatches">
                    ${TINT_COLORS.map(c => `
                        <button class="tint-color-swatch ${c.hex === currentTintHex ? "active" : ""}"
                                data-hex="${c.hex}"
                                style="background:${c.hex};"
                                title="${c.label}"
                                onclick="setTintColor('${c.hex}')"></button>
                    `).join("")}
                    <input type="color" id="tintCustomColor" value="${currentTintHex}"
                           title="Custom film color"
                           onchange="setTintColor(this.value)">
                </div>
            </div>
        </div>
    `;
    container.appendChild(section);
}

// ── Three.js state ─────────────────────────────────────────────────────────
let renderer, scene, camera, controls;
let carModel = null;
let meshMap  = {};   // legacy exact-name map
let partNodes = {};  // variantName → [mesh nodes] (pattern-matched)
let baseNodes = [];  // always-visible meshes (body, interior, wheels)
let bodyMaterial = null;
let autoRotate = true;

// Match a mesh to a variant, allowing:
//   prefix        "Founder_Stang_1967_Hood_A"
//   split pieces  "Hood_A_1", "Hood_A_2"
//   per-corner    "Wheel_B_FL", "Brake_A_RR"  (so one click swaps all 4)
const CORNER_SUFFIX = "(_(FL|FR|RL|RR|BL|BR|L|R))?";
function matchesVariant(meshName, variantName) {
    // A vehicle can alias a vendor mesh name onto a RI-VAS slot, so bought
    // models don't have to be renamed in Blender just to fit the convention.
    const alias = VEHICLES[currentVehicleKey]?.aliases?.[variantName];
    if (alias && alias.test(meshName)) return true;

    const re = new RegExp("(^|_)" + variantName + CORNER_SUFFIX + "(_\\d+)?$", "i");
    return re.test(meshName);
}

// Blender/GLTF sometimes puts the RI-VAS name on the parent node while the
// mesh itself keeps a UUID name. Walk up to find the meaningful name.
const RIVAS_NAME_RE = /(SM_Wheel|Wheel_|Tire_|Tyre_|Brake_|Caliper|Rotor|Interior|Body|Hood_|FrontBumper_|RearBumper_|Fender_|Spoiler_|Exhaust|RunningBoard_|SKM_|Glass|Lights|Headlight|Taillight|Grille|Chrome|Trim|Pillar|Frit)/i;
function effectiveName(node) {
    let n = node;
    for (let i = 0; i < 4 && n; i++) {
        if (n.name && RIVAS_NAME_RE.test(n.name)) return n.name;
        n = n.parent;
    }
    return node.name || "";
}

// Meshes that must NEVER render (skinned duplicate of the whole car —
// without its armature it explodes into stretched "filament" geometry)
function isJunkMesh(name) {
    // SKM_ = skinned duplicate of the whole car; without its armature it
    // explodes into stretched "filament" geometry.
    // Phys_ = collision proxies from the asset pack. Invisible in-engine, but
    // here they'd render and inflate the bounding box used for auto-scaling.
    return /SKM_|^Phys_|_Phys_/i.test(name);
}

// Is this mesh part of the always-visible base (body shell, interior, wheels)?
function isBaseMesh(name) {
    // Fallback only: on a vehicle that aliases SM_Wheel onto Wheel_A, the
    // variant match runs first and this line is never reached.
    if (/SM_Wheel/i.test(name)) return true;
    if (/(^|_)Interior(_\d+)?$/i.test(name)) return true;
    if (/(^|_)Body(_\d+)?$/i.test(name)) return true;
    // Tires are universal — they stay mounted while rims swap around them
    if (/(^|_)Tire|(^|_)Tyre/i.test(name)) return true;
    if (/Glass|Window|Windshield|Lights?|Headlight|Taillight|Lamp|Grille|Chrome|Trim|Emblem|Badge|Mirror/i.test(name)) return true;
    return false;
}

// Parts that keep their own look instead of taking body paint
function isWheelOrInterior(name) {
    return /SM_Wheel|(^|_)Wheel_|(^|_)Rim_|(^|_)Tire_/i.test(name)
        || /(^|_)Brake_|(^|_)Caliper_|(^|_)Rotor_/i.test(name)
        || /(^|_)Interior(_\d+)?$/i.test(name)
        || /Glass|Window|Windshield/i.test(name)
        || /Lights?|Headlight|Taillight|Lamp/i.test(name)
        || /Grille|Chrome|Trim|Emblem|Badge|Mirror/i.test(name)
        || /Exhaust|Muffler|Tailpipe/i.test(name);
}

// Per-part-type material presets applied on load
// ORDER MATTERS: the most specific patterns must come first, or e.g.
// "Taillight" gets caught by the generic /light/ rule and renders white.
function styleForPart(name) {
    if (!name) return null;

    // ── Hand-authored materials: keep the colour set in Blender ────────────
    // A preset with no `color` key leaves mat.color untouched (prepMaterials
    // only assigns the keys it's given), and returning a preset at all stops
    // applyPaint() from repainting the part. So this preserves the exported
    // colour while still giving the surface sensible lens properties.
    //
    // Numbered lamp materials — Taillight1, Taillight2, Headlight2 — are the
    // case this exists for: a real tail lamp is several colours (red lens,
    // clear reverse, amber indicator) and forcing them all to one red throws
    // away work that was done deliberately.
    if (/^(Tail|Head|Brake|Fog|Turn|Signal|Marker)?light\s*_?\d+$/i.test(name))
        return { roughness: 0.12, metalness: 0.15, env: 0.9 };

    // Explicit opt-out for anything else you've coloured yourself: suffix the
    // material with _Keep (or _Raw) and the styler leaves it completely alone.
    if (/_(Keep|Raw)$/i.test(name))
        return { roughness: 0.4, metalness: 0.2 };

    // Window glass only — "GlassHeadlight"/"GlassTaillight" must fall through
    // to the lamp rules below, not be treated as a window.
    if (/Glass|Window|Windshield|Windscreen/i.test(name)
        && !/Light|Lamp|Head|Tail|Signal|Turn|Fog|Bulb|Trim|Moulding|Molding|Frame|Surround/i.test(name))
        return { color: 0x0d1218, roughness: 0.04, metalness: 0.1, opacity: 0.72, transparent: true };

    // Bulbs named by colour (e.g. Car_LightBulbRed on the muscle car)
    if (/Bulb.*Red|Red.*Bulb/i.test(name))
        return { color: 0xa8202c, roughness: 0.2, metalness: 0.1 };
    if (/Bulb.*(Yellow|Amber)|(Yellow|Amber).*Bulb/i.test(name))
        return { color: 0xd9a324, roughness: 0.2, metalness: 0.1 };
    if (/Bulb/i.test(name))
        return { color: 0xf2f4f7, roughness: 0.12, metalness: 0.1 };

    // Rear / brake / tail lamps — red lenses
    if (/Tail|Rear.*(Light|Lamp)|Brake.*(Light|Lamp)/i.test(name))
        return { color: 0x8c1220, roughness: 0.15, metalness: 0.2 };

    // Turn signals / indicators — amber
    if (/Turn|Signal|Indicator|Blinker|Rot_(Left|Right)/i.test(name))
        return { color: 0xd98324, roughness: 0.15, metalness: 0.2 };

    // Front / head lamps — near-white lenses
    if (/Head.*(Light|Lamp)|Front.*(Light|Lamp)|Fog|Lights?$|Lamp/i.test(name))
        return { color: 0xdfe8f2, roughness: 0.06, metalness: 0.2 };

    if (/Grille|Grill/i.test(name))
        return { color: 0x1c1f24, roughness: 0.45, metalness: 0.6 };

    // B-pillar / A-pillar covers — gloss black on nearly every modern car.
    // This single detail is what makes side glass read as one continuous panel.
    if (/Pillar/i.test(name))
        return { color: 0x0a0c0f, roughness: 0.12, metalness: 0.3, env: 0.9 };

    // Frit band — the matte ceramic dot-matrix border printed on glass edges
    if (/Frit|GlassBorder|GlassEdge/i.test(name))
        return { color: 0x0b0d10, roughness: 0.85, metalness: 0.0, env: 0.15 };

    // Blackout window surround / body moulding — checked before chrome so
    // "Trim" never falls through to the polished-metal rule.
    // Carbon fibre — hood inserts, roof panels, lips, diffusers. Without this
    // rule the name falls through to applyPaint() and takes body colour, which
    // is the single most common "why is my part the wrong colour" cause.
    if (/Carbon|CarbonFib(re|er)|(^|_)CF($|_)|Weave/i.test(name))
        return { color: 0x14171b, roughness: 0.28, metalness: 0.55, env: 0.85 };

    // Gloss black — decals, piano-black inserts, blacked-out panels. Sits
    // before the vent rule so "HoodDecal" doesn't get the satin treatment.
    // Near-zero roughness with full env reflection is what reads as glossy.
    if (/Decal|Gloss.?Bl(ac)?k|Bl(ac)?k.?Gloss|Piano|Shadowline/i.test(name))
        return { color: 0x0a0c0f, roughness: 0.06, metalness: 0.5, env: 1.0 };

    // Vents, ducts and louvres are matte/satin rather than glossy.
    if (/Vent|Duct|Louver|Louvre|Intake(?!.*Air)/i.test(name))
        return { color: 0x101317, roughness: 0.6, metalness: 0.3, env: 0.35 };

    // A diffuser is usually its own finish rather than painted with the car.
    if (/Diffuser|Splitter|Canard/i.test(name))
        return { color: 0x16191d, roughness: 0.4, metalness: 0.35, env: 0.5 };

    if (/Trim|Moulding|Molding|Blackout|Beltline/i.test(name))
        return { color: 0x15181c, roughness: 0.55, metalness: 0.25, env: 0.4 };

    // Chrome trim and actual mirror glass — but NOT mirror caps/housings,
    // which are body-coloured on most cars and should take paint.
    if (/Chrome|Emblem|Badge/i.test(name)
        || (/Mirror/i.test(name) && !/Side_?Mirror|MirrorCap|MirrorHousing|Mirror_?Cover/i.test(name)))
        return { color: 0xc9ced6, roughness: 0.12, metalness: 0.95 };

    // Exhaust tips — brushed steel
    if (/Exhaust|Muffler|Tailpipe|Pipe/i.test(name))
        return { color: 0x9aa0a8, roughness: 0.3, metalness: 0.9 };

    // Tires — real rubber is near-black, fully matte and reflects almost
    // nothing. Killing envMapIntensity is what stops it looking like grey
    // plastic under the studio lights.
    if (/Tire|Tyre|Rubber/i.test(name))
        return { color: 0x08090b, roughness: 1.0, metalness: 0.0, env: 0.08 };

    // Brake calipers / rotors — swappable big-brake kits
    if (/Caliper/i.test(name))
        return { color: new THREE.Color(currentCaliperHex).getHex(),
                 roughness: 0.35, metalness: 0.5 };
    if (/Brake|Rotor|Disc/i.test(name))
        return { color: 0x6e737a, roughness: 0.4, metalness: 0.8 };

    // Rims — finish is encoded in the material name, e.g. RimBlack,
    // RimBronze, RimGunmetal. Plain "Rim" defaults to silver.
    if (/Wheel|Rim/i.test(name)) {
        if (/Black|Gloss?Blk/i.test(name))        return { color: 0x0e1013, roughness: 0.18, metalness: 0.55 };
        if (/Matte|Satin/i.test(name))            return { color: 0x2c3035, roughness: 0.62, metalness: 0.35 };
        if (/Gunmetal|Anthracite|Graphite/i.test(name)) return { color: 0x3a4046, roughness: 0.32, metalness: 0.7 };
        if (/Bronze/i.test(name))                 return { color: 0x8a6a3a, roughness: 0.3, metalness: 0.8 };
        if (/Gold/i.test(name))                   return { color: 0xc9a227, roughness: 0.25, metalness: 0.9 };
        if (/White/i.test(name))                  return { color: 0xdfe3e8, roughness: 0.25, metalness: 0.6 };
        if (/Red|Crimson/i.test(name))            return { color: 0xa01d24, roughness: 0.22, metalness: 0.7 };
        if (/Blue/i.test(name))                   return { color: 0x1d4e9c, roughness: 0.22, metalness: 0.7 };
        if (/Copper/i.test(name))                 return { color: 0xa2603a, roughness: 0.28, metalness: 0.85 };
        if (/Chrome|Polish/i.test(name))          return { color: 0xdfe5ec, roughness: 0.05, metalness: 1.0 };
        return { color: 0x9aa1aa, roughness: 0.3, metalness: 0.85 };   // silver
    }

    if (/Interior|Seat|Dash/i.test(name))
        return { color: 0x23262b, roughness: 0.85, metalness: 0.05 };

    // Catch-all body detail (trim, plastics, badges bundled together).
    // Matches BodyDet / Body_Detail / _det etc.
    if (/det(ail)?s?$|detail|trim|plastic|rubber/i.test(name))
        return { color: 0x2b2f35, roughness: 0.7, metalness: 0.15 };

    return null;
}

// ── Performance mods (stat-based, no visual mesh swap) ─────────────────────
// Performance mods are the parts that aren't modelled — you buy them, they
// change the numbers, but nothing on the car looks different. Anything that
// IS modelled belongs in a visual category instead, where it can carry a
// performance effect of its own (see `hp` on a variant). Wheels and tires used
// to live here as well as there, so the same purchase existed twice.
const PERF_MODS = {
    engine: [
        { name: "Cold Air Intake",       cost: 70,   hp: 8,   icon: "wind",
          url: "https://www.spectreperformance.com/8219-universal-intake-tube-kit",
          note: "Tube kit only — filter sold separately" },
        { name: "Performance Exhaust",   cost: 800,  hp: 18,  icon: "flame" },
        { name: "Turbocharger Kit",      cost: 3500, hp: 120, icon: "loader" },
        { name: "Supercharger Kit",      cost: 4500, hp: 150, icon: "zap" },
        { name: "ECU Tune",              cost: 600,  hp: 25,  icon: "cpu" },
        { name: "Performance Headers",   cost: 900,  hp: 22,  icon: "flame" },
    ],
    suspension: [
        { name: "Coilover Kit",          cost: 1800, icon: "sliders" },
        { name: "Lowering Springs",      cost: 500,  icon: "arrow-down" },
        { name: "Sway Bar Kit",          cost: 400,  icon: "minus" },
        { name: "Air Suspension",        cost: 3000, icon: "cloud" },
        { name: "Adjustable Camber Kit", cost: 250,  icon: "ruler" },
        // Spacers change stance and track width but aren't modelled, so this
        // is the right home for them now the wheels group is gone.
        { name: "Wheel Spacers",         cost: 150,  icon: "move-horizontal" },
    ],
};

const perfModsSelected = { engine: new Set(), suspension: new Set(), wheels: new Set() };

// ── Build state ────────────────────────────────────────────────────────────
let basePriceCents = 0;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initScene();
    rebuildCustomizationUI();
    initVehicleDropdowns();
    initColorWheel();
    loadSavedBuilds();

    // Opened from the garage as /builder?build=12 — restore that build rather
    // than dropping the user on the default body.
    const wanted = new URLSearchParams(location.search).get("build");
    if (wanted) loadBuild(parseInt(wanted, 10));

    if (window.refreshIcons) window.refreshIcons();
});

// ── Three.js Scene ─────────────────────────────────────────────────────────
function initScene() {
    const canvas = document.getElementById("carCanvas");
    if (!canvas) return;

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    resizeRenderer();

    // Scene — studio sweep. A backdrop sphere is used instead of
    // scene.background, which doesn't reliably render plain textures in r128.
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9ea3ab);   // fallback behind the sphere
    scene.fog = null;                               // fog would flatten the gradient

    const backdrop = new THREE.Mesh(
        new THREE.SphereGeometry(90, 32, 24),
        new THREE.MeshBasicMaterial({
            map: makeBackdropTexture(),
            side: THREE.BackSide,        // we're inside it, so render inner faces
            depthWrite: false,
            fog: false,
        })
    );
    backdrop.name = "__backdrop";
    scene.add(backdrop);

    // Camera
    camera = new THREE.PerspectiveCamera(34, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    camera.position.set(5, 1.8, 9);

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.07;
    controls.minDistance     = 3;
    controls.maxDistance     = 18;
    controls.maxPolarAngle   = Math.PI / 2 - 0.04;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 0.7;
    controls.target.set(0, 0.5, 0);

    // Studio lights — soft, low-key
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    // Key light — upper right front
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(8, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far  = 60;
    key.shadow.camera.left = key.shadow.camera.bottom = -10;
    key.shadow.camera.right = key.shadow.camera.top = 10;
    key.shadow.bias = -0.001;
    scene.add(key);

    // Fill light — upper left
    const fill = new THREE.DirectionalLight(0xdde6f0, 0.35);
    fill.position.set(-8, 8, 4);
    scene.add(fill);

    // Rim light — behind car
    const rim = new THREE.DirectionalLight(0xffffff, 0.25);
    rim.position.set(0, 6, -10);
    scene.add(rim);

    // Ground — gray studio floor
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 80),
        new THREE.MeshStandardMaterial({ color: 0x8f939a, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = "__ground";
    scene.add(ground);

    // Soft lit pool under the car so the floor doesn't read as endless flat grey
    const poolCanvas = document.createElement("canvas");
    poolCanvas.width = poolCanvas.height = 256;
    const pctx = poolCanvas.getContext("2d");
    const rg = pctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    rg.addColorStop(0.0, "rgba(255,255,255,0.55)");
    rg.addColorStop(0.5, "rgba(255,255,255,0.22)");
    rg.addColorStop(1.0, "rgba(255,255,255,0)");
    pctx.fillStyle = rg;
    pctx.fillRect(0, 0, 256, 256);
    const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 26),
        new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(poolCanvas),
            transparent: true,
            depthWrite: false,
        })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.002;
    pool.name = "__pool";
    scene.add(pool);

    buildEnvMap();   // needs scene + renderer both ready
    loadEnvironment();
    loadModel();
    animate();

    window.addEventListener("resize", resizeRenderer);
}

function resizeRenderer() {
    const wrap = document.getElementById("viewer3dWrap");
    if (!wrap || !renderer) return;
    const w = wrap.clientWidth  || 800;
    const h = wrap.clientHeight || 600;
    renderer.setSize(w, h, false);
    if (camera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
}

// Vertical gradient backdrop — reads as a photo studio sweep rather than
// a flat colour fill. Much cheaper than loading an HDRI.
function makeBackdropTexture() {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 512;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    // Sphere maps top-of-image to top-of-sphere, so this reads:
    // dark ceiling -> mid wall -> bright horizon -> darker floor
    g.addColorStop(0.00, "#5f656e");
    g.addColorStop(0.35, "#8d939b");
    g.addColorStop(0.58, "#c6cad0");   // bright band at eye level
    g.addColorStop(0.75, "#9aa0a8");
    g.addColorStop(1.00, "#6b7079");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 512);
    const tex = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
    return tex;
}

// Studio environment map — gives metallic car paint its reflections
function buildEnvMap() {
    const size = 512;
    const ec = document.createElement("canvas");
    ec.width = size; ec.height = size / 2;
    const ctx = ec.getContext("2d");

    // Sky gradient (top) — muted gray so reflections don't wash out paint
    const sky = ctx.createLinearGradient(0, 0, 0, ec.height * 0.55);
    sky.addColorStop(0, "#b0b4ba");
    sky.addColorStop(1, "#8e9298");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, size, ec.height * 0.55);

    // Ground gradient (bottom)
    const gnd = ctx.createLinearGradient(0, ec.height * 0.55, 0, ec.height);
    gnd.addColorStop(0, "#75797f");
    gnd.addColorStop(1, "#63676d");
    ctx.fillStyle = gnd;
    ctx.fillRect(0, ec.height * 0.55, size, ec.height);

    // Two soft studio light boxes (highlights on the paint)
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(60, 10, 100, 60);   // left box
    ctx.fillRect(340, 10, 80, 50);   // right box

    const envTex = new THREE.CanvasTexture(ec);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    pmrem.dispose();
    envTex.dispose();
}

// ── Scene environment (garage / showroom) ──────────────────────────────────
// Loaded ONCE and kept separate from carModel, so it survives vehicle swaps
// and is never touched by paint, part-swapping or grounding logic.
const SCENE_ENV = {
    glb:       "/static/models/garage.glb",
    // null = auto-fit (scales so the bay is `fitDepth` units deep and its
    // floor sits on y=0). Set a number to override manually.
    scale:     null,
    fitDepth:  22,      // car is 7 units long, so ~3 car-lengths of bay
    rotationY: 0,       // radians — spin the garage to face the camera
    // Camera sits at +X/+Z, so +X reads as screen-right. Pushing the bay
    // right parks the car on its left rather than dead centre.
    // Ceiling is ~4: the walled bay is only ~11 wide (the Floor plane is much
    // bigger than the room), and the car is 3 wide sitting at x=0. Past 4 the
    // left wall crosses the car and it hangs off the bay.
    offsetX:   3,       // manual nudge after auto-fit
    // The floor is a zero-thickness plane, so grounding puts it at exactly
    // y=0 — the same plane the tyres rest on. Two coincident surfaces read as
    // wheels sunk into the floor. A hair below clears it without a visible gap.
    offsetY:   -0.02,
    offsetZ:   -2,      // push the back wall away from the car
};
let envModel = null;

// ── GLTF loader factory ────────────────────────────────────────────────────
// Draco-compressed GLBs typically drop geometry by 80-90% with no visible
// change. Compression is a storage format only — mesh names, hierarchy,
// materials and UVs come back identical, so RI-VAS naming, part swapping and
// paint are unaffected.
//
// The decoder is attached whenever DRACOLoader is available. Uncompressed
// files ignore it entirely, so mixed compressed/uncompressed models work side
// by side and a CDN failure only affects compressed files.
let _dracoLoader = null;
function makeGLTFLoader() {
    const loader = new THREE.GLTFLoader();
    if (typeof THREE.DRACOLoader === "function") {
        if (!_dracoLoader) {
            _dracoLoader = new THREE.DRACOLoader();
            // Decoder shipped with this exact three version, so loader and
            // decoder can't drift apart. No decoderConfig type: the loader
            // picks WebAssembly when available and falls back to JS, and WASM
            // decodes a car-sized mesh several times faster.
            _dracoLoader.setDecoderPath(
                "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/");
        }
        loader.setDRACOLoader(_dracoLoader);
    } else {
        console.warn("DRACOLoader unavailable — compressed models will not load.");
    }
    return loader;
}

function loadEnvironment() {
    if (!SCENE_ENV.glb) return;
    const loader = makeGLTFLoader();
    loader.load(
        SCENE_ENV.glb + "?v=" + Date.now(),
        (gltf) => {
            envModel = gltf.scene;
            envModel.traverse(node => {
                if (!node.isMesh) return;
                node.receiveShadow = true;
                node.castShadow    = false;   // cheaper; walls don't need to cast
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                mats.forEach(m => { if (m) m.envMapIntensity = 0.5; });
            });

            envModel.rotation.y = SCENE_ENV.rotationY;

            // ── Auto-fit: scale the bay around the car, then sit it on y=0 ──
            envModel.updateMatrixWorld(true);
            let box  = new THREE.Box3().setFromObject(envModel);
            let size = box.getSize(new THREE.Vector3());

            const scale = SCENE_ENV.scale
                ? SCENE_ENV.scale
                : (Math.max(size.x, size.z) > 0
                    ? SCENE_ENV.fitDepth / Math.max(size.x, size.z)
                    : 1);
            envModel.scale.setScalar(scale);
            envModel.updateMatrixWorld(true);

            // Re-measure after scaling, then centre on the car and drop the
            // floor to ground level.
            box = new THREE.Box3().setFromObject(envModel);
            const c = box.getCenter(new THREE.Vector3());
            envModel.position.x += -c.x + SCENE_ENV.offsetX;
            envModel.position.z += -c.z + SCENE_ENV.offsetZ;

            // Ground on the FLOOR mesh if we can find one. Walls or props that
            // dip below floor level would otherwise lift the whole garage.
            const floorBox = new THREE.Box3();
            let haveFloor = false;
            envModel.traverse(node => {
                if (!node.isMesh || !node.geometry) return;
                if (!/Plane|Floor|Ground/i.test(node.name || "")) return;
                if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
                floorBox.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
                haveFloor = true;
            });
            const groundY = haveFloor ? floorBox.min.y : box.min.y;
            envModel.position.y += -groundY + SCENE_ENV.offsetY;

            scene.add(envModel);

            const finalSize = new THREE.Box3().setFromObject(envModel).getSize(new THREE.Vector3());
            const finalBox = new THREE.Box3().setFromObject(envModel);
            console.log("[env] garage fitted", {
                scale:      +scale.toFixed(3),
                usedFloor:  haveFloor,
                size:       { w: +finalSize.x.toFixed(1), h: +finalSize.y.toFixed(1), d: +finalSize.z.toFixed(1) },
                bottomY:    +finalBox.min.y.toFixed(2),   // should be ~0 (or slightly below)
                topY:       +finalBox.max.y.toFixed(2),
            });

            // The garage brings its own floor and walls, so hide the studio
            // backdrop AND the built-in ground plane — two coplanar floors at
            // y=0 z-fight and flicker.
            ["__backdrop", "__ground", "__pool"].forEach(n => {
                const o = scene.getObjectByName(n);
                if (o) o.visible = false;
            });
        },
        undefined,
        () => { /* no garage.glb yet — keep the gradient backdrop */ }
    );
}

// Bumped on every load request. A GLB that finishes after a newer load has
// started belongs to a body the user has already switched away from, so its
// result is thrown away instead of being added to the scene. Without this,
// opening a saved build while the default car was still downloading left both
// models in the scene at once.
let modelLoadToken = 0;

function loadModel(onReady) {
    const loader  = makeGLTFLoader();
    const overlay = document.getElementById("modelLoadOverlay");
    const status  = document.getElementById("modelLoadStatus");
    const myToken = ++modelLoadToken;

    // Drop any car already in the scene before the new one arrives.
    if (carModel && scene) { scene.remove(carModel); carModel = null; }

    if (overlay) overlay.style.display = "flex";

    // Cache-bust so a freshly exported GLB always loads instead of the
    // browser's cached copy.
    loader.load(
        VEHICLES[currentVehicleKey].glb + "?v=" + Date.now(),
        (gltf) => {
            // A newer load started while this one was in flight — discard it.
            if (myToken !== modelLoadToken) return;
            carModel = gltf.scene;

            // Pattern-match every mesh into variant groups or base
            partNodes = {};
            ALL_PART_MESHES.forEach(v => { partNodes[v] = []; });
            baseNodes = [];
            const unmatched = [];

            const junkNodes = [];
            carModel.traverse(node => {
                if (!node.isMesh) return;
                const name = effectiveName(node);
                node.userData.rivasName = name;
                meshMap[name] = node;

                // Skinned duplicate car → permanently hidden
                if (isJunkMesh(name)) {
                    junkNodes.push(node);
                    node.visible = false;
                    return;
                }

                node.castShadow    = true;
                node.receiveShadow = true;

                // Try to assign to a part variant
                const variant = ALL_PART_MESHES.find(v => matchesVariant(name, v));
                if (variant) {
                    partNodes[variant].push(node);
                } else if (isBaseMesh(name)) {
                    baseNodes.push(node);
                } else {
                    unmatched.push(name);
                    baseNodes.push(node);   // unknown → keep visible
                }
            });
            if (junkNodes.length) console.log("Hidden skinned/junk meshes:", junkNodes.map(n => n.name));

            const variantCount = Object.values(partNodes).reduce((s, arr) => s + arr.length, 0);
            console.log(`Mapped ${variantCount} variant meshes, ${baseNodes.length} base meshes`);
            if (unmatched.length) console.log("Unmatched (kept visible):", unmatched);

            applyVisibility();

            // Rotate to face camera (per-vehicle: some exports already face +Z)
            const rotY = VEHICLES[currentVehicleKey].rotationY;
            carModel.rotation.y = (rotY === undefined) ? Math.PI : rotY;

            // Scale first using the car's footprint (length × width, not height)
            const box0  = visibleBox(carModel);
            const size0 = box0.getSize(new THREE.Vector3());
            const footprint = Math.max(size0.x, size0.z);
            const scale = footprint > 0 ? 7 / footprint : 1;
            carModel.scale.setScalar(scale);
            carModel.updateMatrixWorld(true);

            // Now center and sit on ground (visible meshes only)
            const box    = visibleBox(carModel);
            const center = box.getCenter(new THREE.Vector3());
            carModel.position.x = -center.x;
            carModel.position.z = -center.z;

            // Ground on the TIRES if we have them. Stray/unmatched meshes that
            // sit below the car would otherwise drag the bounding box down and
            // leave the car floating.
            const tireBox = new THREE.Box3();
            let haveTires = false;
            carModel.updateMatrixWorld(true);
            carModel.traverse(node => {
                if (!node.isMesh || !node.visible || !node.geometry) return;
                const nm = node.userData.rivasName || effectiveName(node);
                // Whatever actually touches the ground at each corner. Tires
                // where they're modelled separately (Mazda), otherwise the
                // wheel itself (the muscle car's SM_Wheel set includes its
                // tyre). A rim can also sit fractionally lower than the tyre
                // bounding box, which showed up as wheels sunk into the floor.
                //
                // Anchored to a corner suffix so props are excluded — Tire_Stack
                // would otherwise lift the whole car to clear it.
                if (!/^(?:Tire|SM_Wheel|Wheel_[A-Z])(?:_[A-Z])?_(FL|FR|BL|BR|RL|RR)(?:_\d+)?$/i.test(nm)) return;
                if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
                tireBox.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
                haveTires = true;
            });

            carModel.position.y = -(haveTires ? tireBox.min.y : box.min.y);
            console.log("[grounding]", {
                usedTires:   haveTires,
                tireMinY:    haveTires ? +tireBox.min.y.toFixed(3) : null,
                boxMinY:     +box.min.y.toFixed(3),
                appliedY:    +carModel.position.y.toFixed(3),
                scale:       +scale.toFixed(4),
            });

            scene.add(carModel);
            prepMaterials();
            upgradeBodyMaterialsToPhysical();

            // Fixed 3/4 camera — car fills the frame like a configurator
            controls.target.set(0, 0.9, 0);
            camera.position.set(4.2, 1.7, 7.5);
            controls.minDistance = 4;
            controls.maxDistance = 16;
            controls.update();

            // Rebuild the panel now that we know which meshes exist.
            // (The UI is built at page load, but partNodes only fills in once
            // the GLB has downloaded — without this, every variant looks
            // "not modelled yet" and the whole category is hidden.)
            rebuildCustomizationUI();

            // Apply default paint + tint + caliper colour
            applyPaint(currentPaintHex);
            applyGlassTint(currentTint);
            applyCaliperColor(currentCaliper,
                              currentCaliper === "custom" ? currentCaliperHex : null);

            if (overlay) overlay.style.display = "none";
            if (window.refreshIcons) window.refreshIcons();
            // Fired only now: partNodes is empty until the GLB has parsed, so
            // anything that swaps parts has to wait for this.
            if (typeof onReady === "function") onReady();
        },
        (progress) => {
            if (status && progress.total) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                status.textContent = `Loading model… ${pct}%`;
            }
        },
        (err) => {
            if (myToken !== modelLoadToken) return;
            console.error("GLB load failed:", err);
            if (status) status.textContent = "Failed to load model";
            // Still signal completion, or an awaiting loadBuild() hangs forever
            // on a missing or corrupt GLB.
            if (typeof onReady === "function") onReady();
        }
    );
}

// ── Vehicle switching ──────────────────────────────────────────────────────
function switchVehicle(key, onReady) {
    if (!VEHICLES[key] || key === currentVehicleKey) {
        if (typeof onReady === "function") onReady();
        return;
    }
    currentVehicleKey = key;

    // Tear down current model
    if (carModel && scene) { scene.remove(carModel); }
    carModel  = null;
    meshMap   = {};
    partNodes = {};
    baseNodes = [];

    // Reset perf mods (they're per-build, not per-vehicle, but a fresh body = fresh build)
    Object.values(perfModsSelected).forEach(s => s.clear());

    rebuildPartIndex();
    rebuildCustomizationUI();
    updateBuildSummary();
    loadModel(onReady);
}

function rebuildCustomizationUI() {
    const container = document.getElementById("categorySections");
    if (container) container.innerHTML = "";
    buildBodyStyleUI();
    buildPartSelectorUI();
    buildFinishUI();
    buildAccentUI();
    buildCaliperUI();
    buildTintUI();
    buildPerfModsUI();
    if (window.refreshIcons) window.refreshIcons();
}

// Body style picker at the top of the customization panel
function buildBodyStyleUI() {
    const container = document.getElementById("categorySections");
    if (!container) return;

    const header = document.createElement("div");
    header.className = "builder-section-group-label";
    header.innerHTML = `<i data-lucide="car-front"></i> Body Style`;
    container.appendChild(header);

    const section = document.createElement("div");
    section.className = "builder-section";
    section.innerHTML = `
        <div class="builder-section-body body-style-grid">
            ${Object.entries(VEHICLES).map(([key, v]) => `
                <button class="body-style-btn ${key === currentVehicleKey ? "active" : ""}"
                        data-vehicle="${key}"
                        onclick="switchVehicle('${key}')">
                    <span class="bs-label">${v.label}</span>
                    <span class="bs-sub">${v.sub || ""}</span>
                </button>
            `).join("")}
            <div class="body-style-soon">
                <span class="bs-label">More coming soon</span>
                <span class="bs-sub">Sports car · Hyper car · Motorcycles</span>
            </div>
        </div>
    `;
    container.appendChild(section);
}

// Bounding box over VISIBLE meshes only (ignores hidden junk/variant meshes)
function visibleBox(root) {
    const box = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverse(node => {
        if (!node.isMesh || !node.visible) return;
        if (!node.geometry) return;
        if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
        const b = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
        box.union(b);
    });
    return box;
}

function setVariantVisible(variantName, visible) {
    (partNodes[variantName] || []).forEach(node => { node.visible = visible; });
}

function applyVisibility() {
    // Hide ALL swappable variant meshes
    ALL_PART_MESHES.forEach(v => setVariantVisible(v, false));
    // Show selected variant for each category
    Object.values(selected).forEach(v => setVariantVisible(v, true));
    // Base meshes always visible
    baseNodes.forEach(node => { node.visible = true; });
}

function swapPart(categoryKey, variantName) {
    const prev = selected[categoryKey];
    if (prev === variantName) return;

    if (prev) setVariantVisible(prev, false);
    selected[categoryKey] = variantName;
    setVariantVisible(variantName, true);

    // Re-apply paint so newly shown parts match the current color
    applyPaint(currentPaintHex);

    // Update button states
    const catEl = document.getElementById(`cat-${categoryKey}`);
    if (catEl) {
        catEl.querySelectorAll(".part-variant-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.variant === variantName);
        });
    }
    updateBuildSummary();
}

// Meshes excluded from paint
const NO_PAINT_MESHES = new Set([
    "Interior",
    "SM_Wheel_FL", "SM_Wheel_FR", "SM_Wheel_BL", "SM_Wheel_BR",
]);

// Material names that must keep their original look (not body paint)
// Materials that keep their own look instead of taking body paint.
// "_det"/"detail" covers packs that put tires, grille, trim and badges into a
// single "BodyDetail" material (e.g. M_Car15_BodyDet on the modern sedan).
const NO_PAINT_MATERIAL = /glass|light|lamp|head|tail|chrome|mirror|wiper|trim|rubber|tire|tyre|interior|grill|window|windshield|lens|emissive|metal_dark|logo|badge|plate|det(ail)?s?$|detail|wheel|rim|brake|caliper|rotor|disc|exhaust|muffler|pipe|seat|dash/i;

// GLTF loads MeshStandardMaterial, which has no clearcoat. Swap paintable
// body materials to MeshPhysicalMaterial so finishes look like real car paint.
function upgradeBodyMaterialsToPhysical() {
    if (!carModel || !THREE.MeshPhysicalMaterial) return;
    carModel.traverse(node => {
        if (!node.isMesh || !node.material) return;
        const rivas = node.userData.rivasName || effectiveName(node);
        if (isWheelOrInterior(rivas)) return;

        const convert = (mat) => {
            if (!mat || mat.isMeshPhysicalMaterial) return mat;
            if (mat.name && NO_PAINT_MATERIAL.test(mat.name)) return mat;
            if (styleForPart(mat.name || "") || styleForPart(rivas)) return mat;
            const p = new THREE.MeshPhysicalMaterial();
            THREE.Material.prototype.copy.call(p, mat);
            p.color.copy(mat.color);
            p.map          = mat.map || null;
            p.normalMap    = mat.normalMap || null;
            p.roughness    = mat.roughness;
            p.metalness    = mat.metalness;
            p.name         = mat.name;
            return p;
        };

        node.material = Array.isArray(node.material)
            ? node.material.map(convert)
            : convert(node.material);
    });
}

function applyFinish(key) {
    const f = PAINT_FINISHES.find(x => x.key === key) || PAINT_FINISHES[0];
    currentFinish = f.key;
    applyPaint(currentPaintHex);
    document.querySelectorAll(".finish-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.finish === f.key);
    });
    updateBuildSummary();
}

function applyPaint(hex) {
    currentPaintHex = hex;
    if (!carModel) return;
    // convertSRGBToLinear: renderer outputs sRGB, so hex colors must be
    // converted to linear or they render oversaturated ("neon")
    const color = new THREE.Color(hex).convertSRGBToLinear();
    carModel.traverse(node => {
        if (!node.isMesh) return;
        const rivas = node.userData.rivasName || effectiveName(node);
        if (isWheelOrInterior(rivas)) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(mat => {
            if (!mat || !mat.color) return;
            if (mat.transparent && mat.opacity < 0.3) return;
            if (mat.name && NO_PAINT_MATERIAL.test(mat.name)) return;   // keep lights/glass/trim
            // Anything with a style preset (pillars, frit, grille, lights…)
            // is NOT a paintable panel — this used to overwrite their colours.
            if (styleForPart(mat.name || "") || styleForPart(rivas)) return;

            // Spoilers / wings / splitters use the accent colour unless the
            // user picked "Body" match.
            if (isAccentPart(rivas) || isAccentPart(mat.name || "")) {
                const af = ACCENT_FINISHES.find(x => x.key === currentAccent);
                if (currentAccent !== "match") {
                    mat.color.copy(new THREE.Color(currentAccentHex).convertSRGBToLinear());
                    if (af) {
                        mat.roughness = af.roughness;
                        mat.metalness = af.metalness;
                    }
                    mat.needsUpdate = true;
                    return;
                }
            }

            mat.color.copy(color);

            // Apply the selected finish to painted panels
            const f = PAINT_FINISHES.find(x => x.key === currentFinish) || PAINT_FINISHES[0];
            mat.roughness = f.roughness;
            mat.metalness = f.metalness;
            if (mat.envMapIntensity !== undefined) mat.envMapIntensity = f.env;
            if (mat.clearcoat !== undefined) {
                mat.clearcoat          = f.clearcoat;
                mat.clearcoatRoughness = f.clearcoatRoughness;
            }
            mat.needsUpdate = true;
        });
    });
    const preview = document.getElementById("paintPreview");
    if (preview) preview.style.background = hex;
}

function prepMaterials() {
    if (!carModel) return;
    const matNames = new Set();

    // Give every mesh its OWN material instance.
    // Blender often exports a whole car sharing one "DefaultMaterial"; without
    // cloning, painting the body would also tint glass, lights and wheels.
    // 10-20 extra materials per car is negligible at this scale.
    carModel.traverse(node => {
        if (!node.isMesh || !node.material) return;
        node.material = Array.isArray(node.material)
            ? node.material.map(m => m && m.clone())
            : node.material.clone();

        // Render opaque parts double-sided. Mirrored geometry (S X -1) often
        // exports with inverted normals, which would otherwise show up as
        // invisible chunks — most commonly on duplicated wheels/brakes.
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(mat => {
            if (mat && !mat.transparent) mat.side = THREE.DoubleSide;
        });
    });

    carModel.traverse(node => {
        if (!node.isMesh) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        const rivas = node.userData.rivasName || effectiveName(node);
        mats.forEach(mat => {
            if (!mat) return;
            if (mat.name) matNames.add(mat.name);

            // Style presets apply to EVERY part, including no-paint ones.
            // (NO_PAINT_MATERIAL only means "don't take body colour" — it must
            // not skip styling, or untextured models render everything white.)
            // Match on the material name first, then fall back to the mesh name,
            // since bought models name materials better than objects.
            const preset = styleForPart(mat.name || "") || styleForPart(rivas);

            if (preset) {
                if (preset.color !== undefined) mat.color.set(preset.color);
                if (preset.roughness !== undefined) mat.roughness = preset.roughness;
                if (preset.metalness !== undefined) mat.metalness = preset.metalness;
                if (preset.env !== undefined && mat.envMapIntensity !== undefined)
                    mat.envMapIntensity = preset.env;
                if (preset.transparent) { mat.transparent = true; mat.opacity = preset.opacity; }
            } else if (mat.name && NO_PAINT_MATERIAL.test(mat.name)) {
                // Unknown non-paint part (trim, badges…) — just make it neutral
                mat.roughness = 0.5;
                mat.metalness = 0.3;
            } else {
                // Lower metalness = truer, richer paint color
                mat.roughness = 0.35;
                mat.metalness = 0.15;
                if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 0.6;
            }
            mat.needsUpdate = true;
        });
    });
    console.log("Material names in model:", [...matNames]);
}

function setCarColor(hex) { applyPaint(hex); }

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// ── Camera controls ────────────────────────────────────────────────────────
function rotateLeft()  { controls.autoRotate = false; camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),  0.15); }
function rotateRight() { controls.autoRotate = false; camera.position.applyAxisAngle(new THREE.Vector3(0,1,0), -0.15); }
function toggleAutoRotate() {
    controls.autoRotate = !controls.autoRotate;
    const btn = document.getElementById("autoRotateBtn");
    if (btn) btn.textContent = controls.autoRotate ? "⏸ Auto" : "▶ Auto";
}

// ── Color wheel picker ─────────────────────────────────────────────────────
let pickedHue = 0, pickedSat = 0, pickedLight = 45;   // default: neutral dark gray

function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * c).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function paintFromWheel() {
    const hex = hslToHex(pickedHue, pickedSat, pickedLight);
    applyPaint(hex);
}

function onLightnessChange(v) {
    pickedLight = parseInt(v, 10);
    paintFromWheel();
}

function initColorWheel() {
    const wheel = document.getElementById("colorWheel");
    if (!wheel) return;
    const ctx  = wheel.getContext("2d");
    const size = wheel.width;
    const cx = size / 2, cy = size / 2, radius = size / 2 - 2;

    // Draw hue wheel with saturation from center (white → full hue)
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const i = (y * size + x) * 4;
            if (dist > radius) { img.data[i + 3] = 0; continue; }
            const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            const sat = Math.min(1, dist / radius);
            // HSL → RGB at L=50 for the wheel display
            const c = (1 - Math.abs(2 * 0.5 - 1)) * sat;
            const hp = hue / 60;
            const xv = c * (1 - Math.abs(hp % 2 - 1));
            let r = 0, g = 0, b = 0;
            if      (hp < 1) { r = c; g = xv; }
            else if (hp < 2) { r = xv; g = c; }
            else if (hp < 3) { g = c; b = xv; }
            else if (hp < 4) { g = xv; b = c; }
            else if (hp < 5) { r = xv; b = c; }
            else             { r = c; b = xv; }
            const m = 0.5 - c / 2;
            img.data[i]     = Math.round((r + m) * 255);
            img.data[i + 1] = Math.round((g + m) * 255);
            img.data[i + 2] = Math.round((b + m) * 255);
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);

    // Pick color on click/drag
    let dragging = false;
    const pick = (e) => {
        const rect = wheel.getBoundingClientRect();
        const px = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        const py = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
        const sx = px * (size / rect.width), sy = py * (size / rect.height);
        const dx = sx - cx, dy = sy - cy;
        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
        pickedHue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        pickedSat = Math.round((dist / radius) * 100);
        paintFromWheel();
    };
    wheel.addEventListener("mousedown",  e => { dragging = true; pick(e); });
    window.addEventListener("mousemove", e => { if (dragging) pick(e); });
    window.addEventListener("mouseup",   () => { dragging = false; });
    wheel.addEventListener("touchstart", e => { dragging = true; pick(e); e.preventDefault(); }, { passive: false });
    wheel.addEventListener("touchmove",  e => { if (dragging) { pick(e); e.preventDefault(); } }, { passive: false });
    window.addEventListener("touchend",  () => { dragging = false; });
}

// ── Part selector UI ───────────────────────────────────────────────────────
function buildPartSelectorUI() {
    const container = document.getElementById("categorySections");
    if (!container) return;

    // Nothing to show if this body has no swappable parts cut yet
    if (!PART_CATEGORIES.length) {
        const note = document.createElement("div");
        note.className = "builder-section-group-label";
        note.innerHTML = `<i data-lucide="paintbrush"></i> Visual Customization`;
        container.appendChild(note);
        const msg = document.createElement("div");
        msg.className = "builder-section";
        msg.innerHTML = `<div class="builder-section-body">
            <p class="empty-state" style="font-size:12.5px;padding:4px 0;">
                Body kit options for this vehicle are coming soon — paint and
                performance upgrades are available now.
            </p></div>`;
        container.appendChild(msg);
        return;
    }

    // Visual customization header
    const header = document.createElement("div");
    header.className = "builder-section-group-label";
    header.innerHTML = `<i data-lucide="paintbrush"></i> Visual Customization`;
    container.appendChild(header);

    PART_CATEGORIES.forEach(cat => {
        // Only show variants whose meshes actually exist in the loaded GLB.
        // Lets slots be pre-registered — a new part appears the moment it's
        // exported, with no code change.
        const available = cat.variants.filter(v =>
            v.alwaysShow || (partNodes[v.name] && partNodes[v.name].length > 0)
        );
        // Nothing modelled for this category yet → skip it entirely
        if (available.length === 0) return;
        if (available.length === 1 && available[0].alwaysShow) return;

        // If the default variant isn't actually in this model, fall back to
        // the first one that is, so the highlight always matches reality.
        if (!available.some(v => v.name === selected[cat.key])) {
            selected[cat.key] = available[0].name;
            setVariantVisible(available[0].name, true);
        }

        // Whatever this body ships with — shown as "Included" and not billed.
        // Must match the rule in updateBuildSummary().
        const stockName = cat.default || (cat.variants[0] && cat.variants[0].name);

        // Parts sourced from real retailers may not fit every vehicle —
        // the builder is for visualising looks and gauging cost.
        const needsFitmentNote = /Wheels|Brakes|Tires|Spoiler/i.test(cat.key);

        const section = document.createElement("div");
        section.className = "builder-section";
        section.id = `cat-${cat.key}`;

        section.innerHTML = `
            <div class="builder-section-header" onclick="toggleSection('cat-${cat.key}')">
                <span><i data-lucide="${cat.icon}"></i> ${cat.label}</span>
                <span class="section-toggle" id="toggle-cat-${cat.key}"><i data-lucide="chevron-down"></i></span>
            </div>
            <div class="builder-section-body" id="body-cat-${cat.key}">
                <div class="part-variants-row">
                    ${available.map((v, i) => `
                        <button
                            class="part-variant-btn ${v.name === selected[cat.key] ? "active" : ""}"
                            data-variant="${v.name}"
                            onclick="swapPart('${cat.key}', '${v.name}')">
                            <span class="pv-label">${v.label}</span>
                            ${v.hp ? `<span class="pv-hp">+${v.hp} hp</span>` : ""}
                            <span class="pv-price">${
                                // The part the car ships with reads "Included"
                                // even though it has a price — that price is
                                // what it costs on a car that doesn't have it,
                                // and the link stays so you can still buy one.
                                v.name === stockName
                                    ? "Included"
                                    : (v.price > 0 ? "+$" + v.price.toLocaleString() : "Included")
                            }</span>
                            ${v.url ? `<span class="pv-link" title="View product"
                                 onclick="event.stopPropagation();window.open('${v.url}','_blank','noopener')">
                                 <i data-lucide="external-link"></i></span>` : ""}
                        </button>
                    `).join("")}
                </div>
                ${needsFitmentNote ? `
                <p class="fitment-note">
                    <i data-lucide="info"></i>
                    Shown for looks and price reference. Fitment isn't verified —
                    confirm size and offset with the seller before buying.
                </p>` : ""}
            </div>
        `;
        container.appendChild(section);
    });
}

// ── Performance mods UI ────────────────────────────────────────────────────
function buildPerfModsUI() {
    const container = document.getElementById("categorySections");
    if (!container) return;

    const perfHeader = document.createElement("div");
    perfHeader.className = "builder-section-group-label";
    perfHeader.style.marginTop = "16px";
    perfHeader.innerHTML = `<i data-lucide="zap"></i> Performance Upgrades`;
    container.appendChild(perfHeader);

    // No wheels group: wheels and tires are modelled parts now, so they live
    // in the visual categories where you can actually see what you're buying.
    const perfDefs = [
        { key: "engine",     label: "Engine & Power",      icon: "settings"  },
        { key: "suspension", label: "Suspension",           icon: "wrench"    },
    ];

    perfDefs.forEach(def => {
        const mods = PERF_MODS[def.key];
        const section = document.createElement("div");
        section.className = "builder-section";

        section.innerHTML = `
            <div class="builder-section-header" onclick="toggleSection('perf-${def.key}')">
                <span><i data-lucide="${def.icon}"></i> ${def.label}</span>
                <span class="section-toggle" id="toggle-perf-${def.key}"><i data-lucide="chevron-down"></i></span>
            </div>
            <div class="builder-section-body" id="body-perf-${def.key}" style="display:none;">
                ${mods.map(mod => `
                    <div class="mod-row" id="modrow-${def.key}-${mod.name.replace(/\W/g,'_')}">
                        <div class="mod-info">
                            <i data-lucide="${mod.icon}" class="mod-icon"></i>
                            <div>
                                <div class="mod-name">${mod.name}</div>
                                ${mod.hp ? `<div class="mod-sub">+${mod.hp} hp (est.)</div>` : ""}
                                ${mod.note ? `<div class="mod-sub">${mod.note}</div>` : ""}
                            </div>
                        </div>
                        <div class="mod-right">
                            ${mod.url ? `<span class="pv-link" title="View product"
                                 onclick="event.stopPropagation();window.open('${mod.url}','_blank','noopener')">
                                 <i data-lucide="external-link"></i></span>` : ""}
                            <span class="mod-cost">$${mod.cost.toLocaleString()}</span>
                            <button class="mod-add-btn" onclick="toggleMod('${def.key}','${mod.name}',${mod.cost})">Add</button>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
        container.appendChild(section);
    });
}

function toggleMod(category, modName, cost) {
    const set  = perfModsSelected[category];
    const id   = `modrow-${category}-${modName.replace(/\W/g,'_')}`;
    const row  = document.getElementById(id);
    const btn  = row?.querySelector(".mod-add-btn");

    if (set.has(modName)) {
        set.delete(modName);
        if (row) row.classList.remove("mod-active");
        if (btn) btn.textContent = "Add";
    } else {
        set.add(modName);
        if (row) row.classList.add("mod-active");
        if (btn) btn.textContent = "Remove";
    }
    updateBuildSummary();
}

// ── Section toggle ─────────────────────────────────────────────────────────
function toggleSection(key) {
    const body   = document.getElementById(`body-${key}`);
    const toggle = document.getElementById(`toggle-${key}`);
    if (!body) return;
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "block";
    if (toggle) toggle.style.transform = open ? "rotate(-90deg)" : "rotate(0)";
    if (window.refreshIcons) window.refreshIcons();
}

// ── Vehicle dropdowns ──────────────────────────────────────────────────────
async function initVehicleDropdowns() {
    try {
        const res   = await fetch("/api/vehicle_years");
        const years = await res.json();
        const sel   = document.getElementById("baseYear");
        if (!sel) return;
        years.forEach(y => {
            const o = document.createElement("option");
            o.value = o.textContent = y;
            sel.appendChild(o);
        });
    } catch(e) {}
}

async function onYearChange() {
    const yr  = document.getElementById("baseYear").value;
    const sel = document.getElementById("baseMake");
    resetSel("baseMake",  "— Make —");
    resetSel("baseModel", "— Model —");
    resetSel("baseTrim",  "— Trim —");
    if (!yr) return;
    sel.innerHTML = `<option>Loading…</option>`;
    sel.disabled = true;
    const res   = await fetch(`/api/vehicle_makes?year=${yr}`);
    const makes = await res.json();
    sel.innerHTML = `<option value="">— Make —</option>`;
    makes.forEach(m => { const o = document.createElement("option"); o.value = o.textContent = m; sel.appendChild(o); });
    sel.disabled = false;
    updateBasePriceDisplay();
}

async function onMakeChange() {
    const yr   = document.getElementById("baseYear").value;
    const make = document.getElementById("baseMake").value;
    resetSel("baseModel", "— Model —");
    resetSel("baseTrim",  "— Trim —");
    if (!make) return;
    const modSel = document.getElementById("baseModel");
    modSel.innerHTML = `<option>Loading…</option>`;
    modSel.disabled = true;
    const res    = await fetch(`/api/vehicle_models?make=${encodeURIComponent(make)}&year=${yr}`);
    const models = await res.json();
    modSel.innerHTML = `<option value="">— Model —</option>`;
    models.forEach(m => { const o = document.createElement("option"); o.value = o.textContent = m; modSel.appendChild(o); });
    modSel.disabled = false;
    updateBasePriceDisplay();
}

async function onModelChange() {
    const yr    = document.getElementById("baseYear").value;
    const make  = document.getElementById("baseMake").value;
    const model = document.getElementById("baseModel").value;
    resetSel("baseTrim", "— Trim —");
    if (!model) return;
    const trimSel = document.getElementById("baseTrim");
    trimSel.innerHTML = `<option>Loading…</option>`;
    trimSel.disabled = true;
    const res   = await fetch(`/api/vehicle_trims?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${yr}`);
    const trims = await res.json();
    trimSel.innerHTML = `<option value="">— Trim (optional) —</option>`;
    trims.forEach(t => { const o = document.createElement("option"); o.value = o.textContent = t; trimSel.appendChild(o); });
    trimSel.disabled = false;
    updateBasePriceDisplay();
}

function onTrimChange() { updateBasePriceDisplay(); }

function resetSel(id, placeholder) {
    const s = document.getElementById(id);
    if (s) { s.innerHTML = `<option value="">${placeholder}</option>`; s.disabled = true; }
}

function updateBasePriceDisplay() {
    const yr    = document.getElementById("baseYear")?.value  || "";
    const make  = document.getElementById("baseMake")?.value  || "";
    const model = document.getElementById("baseModel")?.value || "";
    const disp  = document.getElementById("basePriceDisplay");
    if (!disp) return;
    if (!make || !model) {
        disp.textContent = "Select a vehicle above";
        basePriceCents = 0;
        updateModelMatchBanner("", "", false);
        updateBuildSummary();
        return;
    }

    // Load the best-matching 3D body for this real car
    const match = matchVehicleModel(make, model, yr);
    if (match.key !== currentVehicleKey) switchVehicle(match.key);
    updateModelMatchBanner(make, model, match.exact);

    const lm = make.toLowerCase();
    let price = 30000;
    if (["ferrari","lamborghini","porsche","mclaren","bentley"].some(b => lm.includes(b))) price = 150000;
    else if (["bmw","mercedes","audi","lexus","cadillac","acura","genesis"].some(b => lm.includes(b))) price = 55000;
    else if (["ford","chevrolet","dodge","gmc","ram","jeep"].some(b => lm.includes(b))) price = 35000;
    else if (["honda","toyota","mazda","subaru","hyundai","kia"].some(b => lm.includes(b))) price = 28000;

    const age = yr ? new Date().getFullYear() - parseInt(yr) : 3;
    if (age > 10) price = Math.round(price * 0.35);
    else if (age > 5) price = Math.round(price * 0.55);
    else if (age > 2) price = Math.round(price * 0.78);
    price = Math.round(price / 500) * 500;

    basePriceCents = price;
    disp.textContent = `~$${price.toLocaleString()}`;
    updateBuildSummary();
}

// ── Build summary ──────────────────────────────────────────────────────────
function updateBuildSummary() {
    let perfTotal = 0;
    const items = [];

    // Visual upgrades (non-stock selections)
    //
    // A category's default is what the car already wears, so it isn't a mod
    // and isn't billed — otherwise the muscle car would open at +$3,290 for
    // the lip spoiler it ships with. The same part still costs full price on
    // a car that doesn't come with it, which is why this is per-category
    // rather than a flag on the variant.
    let visualTotal = 0;
    PART_CATEGORIES.forEach(cat => {
        const variantName = selected[cat.key];
        const stock = cat.default || (cat.variants[0] && cat.variants[0].name);
        if (!variantName || variantName === stock) return;

        const info = VARIANT_INFO[variantName];
        if (info && info.price > 0) {
            visualTotal += info.price;
            items.push({ name: `${info.category}: ${info.label}`, cost: info.price });
        }
    });

    // Paint finish
    const fin = PAINT_FINISHES.find(f => f.key === currentFinish);
    if (fin && fin.price > 0) {
        visualTotal += fin.price;
        items.push({ name: `Paint Finish: ${fin.label} ${fin.sub}`, cost: fin.price });
    }

    // Window tint
    const tint = TINT_LEVELS.find(t => t.key === currentTint);
    if (tint && tint.price > 0) {
        visualTotal += tint.price;
        items.push({ name: `Window Tint: ${tint.label} (${tint.sub})`, cost: tint.price });
    }

    // Performance mods
    Object.values(perfModsSelected).forEach(set => {
        set.forEach(modName => {
            const allMods = Object.values(PERF_MODS).flat();
            const mod = allMods.find(m => m.name === modName);
            if (mod) { perfTotal += mod.cost; items.push(mod); }
        });
    });

    const summaryList = document.getElementById("summaryList");
    const partCount   = document.getElementById("partCount");
    if (summaryList) {
        summaryList.innerHTML = items.length
            ? items.map(m => `<div class="summary-item"><span>${m.name}</span><span>$${m.cost.toLocaleString()}</span></div>`).join("")
            : `<p class="empty-state" style="font-size:12px;padding:4px 0;">Stock build — pick parts to customize</p>`;
    }
    if (partCount) partCount.textContent = `${items.length} mod${items.length !== 1 ? "s" : ""}`;

    const modTotal = perfTotal + visualTotal;
    const summaryBase   = document.getElementById("summaryBase");
    const summaryVisual = document.getElementById("summaryVisual");
    const summaryMods   = document.getElementById("summaryMods");
    const summaryTotal  = document.getElementById("summaryTotal");
    if (summaryBase)   summaryBase.textContent   = basePriceCents ? `$${basePriceCents.toLocaleString()}` : "—";
    if (summaryVisual) summaryVisual.textContent = `$${visualTotal.toLocaleString()}`;
    if (summaryMods)   summaryMods.textContent   = `$${perfTotal.toLocaleString()}`;
    if (summaryTotal)  summaryTotal.textContent  = basePriceCents
        ? `$${(basePriceCents + modTotal).toLocaleString()}` : `$${modTotal.toLocaleString()}`;
}

// ── Save / Load builds ─────────────────────────────────────────────────────
// Grab what's on screen as the build's thumbnail. The renderer is created
// without preserveDrawingBuffer, so the buffer is cleared after each frame —
// we have to re-render and read it back in the same tick or we'd get a blank
// image. Downscaled to 480px and JPEG-encoded to keep it a few tens of KB.
function captureThumbnail() {
    try {
        if (!renderer || !scene || !camera) return "";
        renderer.render(scene, camera);
        const src = renderer.domElement;

        const w = 480;
        const h = Math.round(w * (src.height / src.width)) || 270;
        const out = document.createElement("canvas");
        out.width = w; out.height = h;
        const ctx = out.getContext("2d");
        ctx.drawImage(src, 0, 0, w, h);
        return out.toDataURL("image/jpeg", 0.72);
    } catch (e) {
        return "";   // never let a thumbnail failure block saving the build
    }
}

async function saveBuild() {
    const name = document.getElementById("buildName")?.value?.trim() || "My Build";
    const yr    = document.getElementById("baseYear")?.value  || "";
    const make  = document.getElementById("baseMake")?.value  || "";
    const model = document.getElementById("baseModel")?.value || "";
    const trim  = document.getElementById("baseTrim")?.value  || "";

    // Perf mods → parts list (server format)
    const parts = [];
    Object.entries(perfModsSelected).forEach(([cat, set]) => {
        set.forEach(modName => {
            const allMods = Object.values(PERF_MODS).flat();
            const mod = allMods.find(m => m.name === modName);
            if (mod) parts.push({ category: cat, name: mod.name, cost: mod.cost, effect: mod.hp ? `+${mod.hp} hp` : "", icon: mod.icon || "" });
        });
    });
    // Visual parts → parts list entries with real prices
    Object.entries(selected).forEach(([cat, variant]) => {
        const info = VARIANT_INFO[variant] || {};
        // effect carries the performance keyword when the part has one, so a
        // modelled exhaust counts toward output instead of being bought twice.
        parts.push({ category: `visual:${cat}`, name: variant, cost: info.price || 0,
                     effect: info.effect || info.label || "", icon: "" });
    });
    // Record which body this build uses
    parts.push({ category: "vehicle", name: currentVehicleKey, cost: 0, effect: VEHICLES[currentVehicleKey].label, icon: "" });
    // Window tint
    parts.push({ category: "accent", name: currentAccent, cost: 0,
                 effect: currentAccentHex, icon: currentAccentHex });
    parts.push({ category: "caliper", name: currentCaliper, cost: 0,
                 effect: currentCaliperHex, icon: currentCaliperHex });
    const finLevel = PAINT_FINISHES.find(f => f.key === currentFinish);
    parts.push({ category: "finish", name: currentFinish, cost: finLevel?.price || 0,
                 effect: finLevel ? finLevel.label : "", icon: "" });
    const tintLevel = TINT_LEVELS.find(t => t.key === currentTint);
    parts.push({ category: "tint", name: currentTint, cost: tintLevel?.price || 0,
                 effect: tintLevel ? `${tintLevel.label} (${tintLevel.sub})` : "",
                 icon: currentTintHex });   // film color rides along in `icon`

    const payload = {
        name,
        baseVehicle: { year: yr, make, model, trim },
        basePrice:   basePriceCents,
        parts,
        carColor:    currentPaintHex,
        thumbnail:   captureThumbnail(),
    };

    try {
        const res = await csrfFetch("/save_build", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });
        if (res.ok) {
            showToast("Build saved!");
            loadSavedBuilds();
        } else {
            showToast("Could not save — are you logged in?", true);
        }
    } catch(e) {
        showToast("Save failed", true);
    }
}

async function loadSavedBuilds() {
    const container = document.getElementById("savedBuilds");
    if (!container) return;
    try {
        const res   = await fetch("/get_builds");
        if (!res.ok) throw new Error();
        const builds = await res.json();
        if (!builds.length) {
            container.innerHTML = `<p class="empty-state" style="padding:8px 0;">No saved builds yet.</p>`;
            return;
        }
        container.innerHTML = builds.map(b => {
            const vehicle = [b.base_year, b.base_make, b.base_model].filter(Boolean).join(" ");
            return `
            <div class="saved-build-card">
                <div class="saved-build-info">
                    <strong>${b.name || "Unnamed Build"}</strong>
                    <span>${vehicle}</span>
                </div>
                <div class="saved-build-actions">
                    <button class="btn btn-ghost btn-sm" onclick="loadBuild(${b.id})">Load</button>
                    <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteBuild(${b.id})">Delete</button>
                </div>
            </div>`;
        }).join("");

        // Open it automatically when there's something in it. Collapsed at the
        // bottom of a long panel, it read as "there is no load button".
        const body   = document.getElementById("body-savedBuilds");
        const toggle = document.getElementById("toggle-savedBuilds");
        if (body && body.style.display === "none") {
            body.style.display = "block";
            if (toggle) toggle.style.transform = "rotate(0)";
        }
        const label = document.getElementById("savedBuildsCount");
        if (label) label.textContent = `(${builds.length})`;
    } catch(e) {
        container.innerHTML = `<p class="empty-state" style="padding:8px 0;">No saved builds yet.</p>`;
    }
}

async function loadBuild(id) {
    try {
        const res   = await fetch(`/get_build/${id}`);
        const build = await res.json();

        if (build.car_color) {
            applyPaint(build.car_color);
            const picker = document.getElementById("customColor");
            if (picker) picker.value = build.car_color;
        }

        // Restore parts (visual variants + perf mods)
        let parts = [];
        try { parts = JSON.parse(build.parts_json || "[]"); } catch(e) {}

        // Switch body first if the build uses a different vehicle
        // Switching bodies reloads the GLB, which is async. Restoring parts
        // before it finishes silently did nothing — partNodes was still empty,
        // so every swapPart() call was a no-op and the car showed its defaults.
        const vehiclePart = parts.find(p => p.category === "vehicle");
        if (vehiclePart && VEHICLES[vehiclePart.name] && vehiclePart.name !== currentVehicleKey) {
            await new Promise(resolve => switchVehicle(vehiclePart.name, resolve));
        }

        // Reset perf mods first
        Object.values(perfModsSelected).forEach(s => s.clear());
        document.querySelectorAll(".mod-row").forEach(r => r.classList.remove("mod-active"));
        document.querySelectorAll(".mod-add-btn").forEach(b => b.textContent = "Add");

        parts.forEach(p => {
            if (p.category && p.category.startsWith("visual:")) {
                const cat = p.category.slice(7);
                swapPart(cat, p.name);
            } else if (p.category === "accent") {
                applyAccent(p.name, p.name === "custom" ? (p.icon || p.effect) : null);
            } else if (p.category === "caliper") {
                applyCaliperColor(p.name, p.name === "custom" ? (p.icon || p.effect) : null);
            } else if (p.category === "finish") {
                applyFinish(p.name);
            } else if (p.category === "tint") {
                applyGlassTint(p.name, p.icon || currentTintHex);
            } else if (perfModsSelected[p.category]) {
                toggleMod(p.category, p.name, p.cost);
            }
        });

        if (build.name && document.getElementById("buildName")) {
            document.getElementById("buildName").value = build.name;
        }
        updateBuildSummary();
        showToast("Build loaded!");
    } catch(e) {
        showToast("Could not load build", true);
    }
}

async function deleteBuild(id) {
    if (!confirm("Delete this build?")) return;
    try {
        await csrfFetch(`/delete_build/${id}`, { method: "POST" });
        loadSavedBuilds();
    } catch(e) {}
}

function clearBuild() {
    // Reset visual parts to A variants
    PART_CATEGORIES.forEach(cat => swapPart(cat.key, cat.variants[0].name));
    // Reset perf mods
    Object.values(perfModsSelected).forEach(s => s.clear());
    document.querySelectorAll(".mod-row").forEach(r => r.classList.remove("mod-active"));
    document.querySelectorAll(".mod-add-btn").forEach(b => b.textContent = "Add");
    // Reset paint to neutral dark gray
    pickedHue = 0; pickedSat = 0; pickedLight = 45;
    const slider = document.getElementById("lightSlider");
    if (slider) slider.value = 45;
    paintFromWheel();
    applyFinish("gloss");
    applyAccent("gloss");
    applyGlassTint("medium");
    updateBuildSummary();
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
    const t = document.createElement("div");
    t.className = "builder-toast" + (isError ? " toast-error" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
}

// ── CSRF fetch helper ──────────────────────────────────────────────────────
async function csrfFetch(url, opts = {}) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content || "";
    opts.headers = { ...(opts.headers || {}), "X-CSRFToken": token };
    return fetch(url, opts);
}
