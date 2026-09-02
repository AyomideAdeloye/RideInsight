// ═══════════════════════════════════════════════════════════════
//  Base performance per body, before any mods.
//
//  Shared by the builder and the race engine, so a car's stock numbers
//  are defined once. Loaded by both builder.html and race.html.
//
//  Keys must match the entries in VEHICLES (static/builder.js). Add a car
//  there and add its stats here, or it silently falls back to DEFAULT_BASE
//  and races identically to everything else.
//
//    hp        stock crank horsepower
//    handling  0-99, cornering grip and balance
//    braking   0-99, stopping power
//    weight    multiplier, 1.0 = mid-size saloon. Higher is slower.
// ═══════════════════════════════════════════════════════════════

const VEHICLE_BASE_STATS = {
    musclecar: {
        label: "'67 American V8",
        hp: 320, handling: 38, braking: 40, weight: 1.14,
        // Big torque, live rear axle, drum-era brakes: quick in a straight
        // line, poor everywhere else.
    },
    sedan_modern: {
        label: "Modern Sedan",
        hp: 190, handling: 52, braking: 54, weight: 1.00,
    },
    mazda6_gj: {
        label: "Mazda 6 GJ",
        hp: 184, handling: 56, braking: 55, weight: 0.97,
    },
    bmw_m3: {
        label: "BMW M3 G80",
        // Base G80, rear-wheel drive and the lighter of the two. Gives up
        // 30 hp to the Comp but carries less weight, so power-to-weight is
        // near enough identical — the race comes down to how it's built.
        hp: 473, handling: 78, braking: 80, weight: 1.03,
    },
    bmw_m4: {
        label: "BMW M4 Competition",
        // Competition xDrive: 503 hp, but the all-wheel-drive hardware is
        // roughly 50 kg of it. More power, more to haul.
        hp: 503, handling: 82, braking: 82, weight: 1.10,
    },
};

// Used when a build has no vehicle recorded — older saves, or a body that
// hasn't been given stats yet.
const DEFAULT_BASE = { hp: 180, handling: 50, braking: 50, weight: 1.0 };

function baseStatsFor(vehicleKey) {
    return VEHICLE_BASE_STATS[vehicleKey] || DEFAULT_BASE;
}
