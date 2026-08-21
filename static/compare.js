// ─── Vehicle type handling ───────────────────────────────────────
function onTypeChange() {
    const type = document.getElementById("vehicleType").value;
    const show = (id, visible) => document.getElementById(id).style.display = visible ? "flex" : "none";

    show("v1-car-dropdowns",  type === "car");
    show("v2-car-dropdowns",  type === "car");
    show("v1-moto-dropdowns", type === "motorcycle");
    show("v2-moto-dropdowns", type === "motorcycle");
    show("v1-boat-dropdowns", type === "boat");
    show("v2-boat-dropdowns", type === "boat");

    if (type === "motorcycle") initMotoDropdowns();
    if (type === "boat")       initBoatDropdowns();
}

// ─── Motorcycle dropdowns ─────────────────────────────────────────
async function initMotoDropdowns() {
    // Populate year selects
    const res   = await fetch("/api/vehicle_years");
    const years = await res.json();
    [1,2].forEach(n => {
        const sel = document.getElementById(`v${n}moto-year`);
        if (sel.options.length > 1) return; // already populated
        years.forEach(y => { const o = document.createElement("option"); o.value = o.textContent = y; sel.appendChild(o); });
    });
    // Populate make selects
    const mres  = await fetch("/api/moto_makes");
    const makes = await mres.json();
    [1,2].forEach(n => {
        const sel = document.getElementById(`v${n}moto-make`);
        if (sel.options.length > 1) return;
        sel.disabled = false;
        makes.forEach(m => { const o = document.createElement("option"); o.value = o.textContent = m; sel.appendChild(o); });
    });
}

async function onMotoYearChange(n) {
    // year selected — model depends on year+make, just enable make
    const makeSel = document.getElementById(`v${n}moto-make`);
    makeSel.disabled = false;
}

async function onMotoMakeChange(n) {
    const make  = document.getElementById(`v${n}moto-make`).value;
    const year  = document.getElementById(`v${n}moto-year`).value;
    const modSel = document.getElementById(`v${n}moto-model`);
    modSel.innerHTML = '<option value="">Loading…</option>';
    modSel.disabled = true;
    const res    = await fetch(`/api/moto_models?make=${encodeURIComponent(make)}&year=${encodeURIComponent(year)}`);
    const models = await res.json();
    modSel.innerHTML = '<option value="">— Model —</option>';
    models.forEach(m => { const o = document.createElement("option"); o.value = o.textContent = m; modSel.appendChild(o); });
    modSel.disabled = false;
}

// ─── Boat dropdowns ───────────────────────────────────────────────
async function initBoatDropdowns() {
    // Years
    const res   = await fetch("/api/vehicle_years");
    const years = await res.json();
    [1,2].forEach(n => {
        const sel = document.getElementById(`v${n}boat-year`);
        if (sel.options.length > 1) return;
        years.forEach(y => { const o = document.createElement("option"); o.value = o.textContent = y; sel.appendChild(o); });
    });
    // Makes
    const mres  = await fetch("/api/boat_makes");
    const makes = await mres.json();
    [1,2].forEach(n => {
        const sel = document.getElementById(`v${n}boat-make`);
        if (sel.options.length > 1) return;
        sel.disabled = false;
        makes.forEach(m => { const o = document.createElement("option"); o.value = o.textContent = m; sel.appendChild(o); });
    });
}

async function onBoatMakeChange(n) {
    const make   = document.getElementById(`v${n}boat-make`).value;
    const modSel = document.getElementById(`v${n}boat-model`);
    modSel.innerHTML = '<option value="">Loading…</option>';
    modSel.disabled  = true;
    const res    = await fetch(`/api/boat_models?make=${encodeURIComponent(make)}`);
    const models = await res.json();
    modSel.innerHTML = '<option value="">— Model —</option>';
    models.forEach(m => { const o = document.createElement("option"); o.value = o.textContent = m; modSel.appendChild(o); });
    modSel.disabled = false;
}

// ─── Car dropdown cascade: Vehicle 1 ─────────────────────────────
async function initCompareYears() {
    const res   = await fetch("/api/vehicle_years");
    const years = await res.json();
    ["v1year", "v2year"].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">— Year —</option>`;
        years.forEach(y => {
            const opt = document.createElement("option");
            opt.value = y; opt.textContent = y;
            sel.appendChild(opt);
        });
    });
}

async function loadMakesInto(selId, year) {
    const sel = document.getElementById(selId);
    sel.innerHTML = `<option value="">Loading…</option>`;
    sel.disabled  = true;
    const res   = await fetch(`/api/vehicle_makes?year=${year}`);
    const makes = await res.json();
    sel.innerHTML = `<option value="">— Make —</option>`;
    makes.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
    });
    sel.disabled = makes.length === 0;
}

async function loadModelsInto(selId, make, year) {
    const sel = document.getElementById(selId);
    sel.innerHTML = `<option value="">Loading…</option>`;
    sel.disabled  = true;
    const res    = await fetch(`/api/vehicle_models?make=${encodeURIComponent(make)}&year=${year}`);
    const models = await res.json();
    sel.innerHTML = `<option value="">— Model —</option>`;
    models.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
    });
    sel.disabled = models.length === 0;
}

async function loadTrimsInto(selId, make, model, year) {
    const sel = document.getElementById(selId);
    sel.innerHTML = `<option value="">Loading…</option>`;
    sel.disabled  = true;
    const res   = await fetch(`/api/vehicle_trims?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`);
    const trims = await res.json();
    sel.innerHTML = `<option value="">— Trim (optional) —</option>`;
    trims.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        sel.appendChild(opt);
    });
    sel.disabled = false;
}

function resetSel(id, placeholder) {
    const s = document.getElementById(id);
    if (s) { s.innerHTML = `<option value="">${placeholder}</option>`; s.disabled = true; }
}

// Vehicle 1 cascade
async function onV1YearChange() {
    const yr = document.getElementById("v1year").value;
    resetSel("v1make",  "— Make —");
    resetSel("v1model", "— Model —");
    resetSel("v1trim",  "— Trim —");
    if (yr) await loadMakesInto("v1make", yr);
}
async function onV1MakeChange() {
    const yr   = document.getElementById("v1year").value;
    const make = document.getElementById("v1make").value;
    resetSel("v1model", "— Model —");
    resetSel("v1trim",  "— Trim —");
    if (make) await loadModelsInto("v1model", make, yr);
}
async function onV1ModelChange() {
    const yr    = document.getElementById("v1year").value;
    const make  = document.getElementById("v1make").value;
    const model = document.getElementById("v1model").value;
    resetSel("v1trim", "— Trim —");
    if (model) await loadTrimsInto("v1trim", make, model, yr);
}

// Vehicle 2 cascade
async function onV2YearChange() {
    const yr = document.getElementById("v2year").value;
    resetSel("v2make",  "— Make —");
    resetSel("v2model", "— Model —");
    resetSel("v2trim",  "— Trim —");
    if (yr) await loadMakesInto("v2make", yr);
}
async function onV2MakeChange() {
    const yr   = document.getElementById("v2year").value;
    const make = document.getElementById("v2make").value;
    resetSel("v2model", "— Model —");
    resetSel("v2trim",  "— Trim —");
    if (make) await loadModelsInto("v2model", make, yr);
}
async function onV2ModelChange() {
    const yr    = document.getElementById("v2year").value;
    const make  = document.getElementById("v2make").value;
    const model = document.getElementById("v2model").value;
    resetSel("v2trim", "— Trim —");
    if (model) await loadTrimsInto("v2trim", make, model, yr);
}

// Build search string from dropdowns (used by compareCars)
function getV1SearchText() {
    const type = document.getElementById("vehicleType").value;
    if (type === "motorcycle") {
        return [document.getElementById("v1moto-year").value,
                document.getElementById("v1moto-make").value,
                document.getElementById("v1moto-model").value].filter(Boolean).join(" ");
    }
    if (type === "boat") {
        return [document.getElementById("v1boat-year").value,
                document.getElementById("v1boat-make").value,
                document.getElementById("v1boat-model").value].filter(Boolean).join(" ");
    }
    const yr    = document.getElementById("v1year").value;
    const make  = document.getElementById("v1make").value;
    const model = document.getElementById("v1model").value;
    const trim  = document.getElementById("v1trim").value;
    return [yr, make, model, trim].filter(Boolean).join(" ");
}
function getV2SearchText() {
    const type = document.getElementById("vehicleType").value;
    if (type === "motorcycle") {
        return [document.getElementById("v2moto-year").value,
                document.getElementById("v2moto-make").value,
                document.getElementById("v2moto-model").value].filter(Boolean).join(" ");
    }
    if (type === "boat") {
        return [document.getElementById("v2boat-year").value,
                document.getElementById("v2boat-make").value,
                document.getElementById("v2boat-model").value].filter(Boolean).join(" ");
    }
    const yr    = document.getElementById("v2year").value;
    const make  = document.getElementById("v2make").value;
    const model = document.getElementById("v2model").value;
    const trim  = document.getElementById("v2trim").value;
    return [yr, make, model, trim].filter(Boolean).join(" ");
}

// ─── Image system with SVG fallbacks ─────────────────────────────

const SVG_FALLBACKS = {
    car: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs>
        <ellipse cx="200" cy="175" rx="175" ry="12" fill="rgba(0,0,0,0.3)"/>
        <rect x="40" y="110" width="320" height="55" rx="10" fill="url(#cg)"/>
        <path d="M90,110 Q115,60 150,52 L260,52 Q295,60 315,110 Z" fill="url(#cg)"/>
        <path d="M155,55 Q160,65 160,108 L248,108 Q248,65 248,55 Z" fill="rgba(150,210,255,0.4)" rx="4"/>
        <circle cx="110" cy="163" r="26" fill="#111"/><circle cx="110" cy="163" r="17" fill="#555"/><circle cx="110" cy="163" r="7" fill="#999"/>
        <circle cx="290" cy="163" r="26" fill="#111"/><circle cx="290" cy="163" r="17" fill="#555"/><circle cx="290" cy="163" r="7" fill="#999"/>
        <rect x="315" y="120" width="28" height="14" rx="4" fill="#ffe566"/>
        <rect x="58" y="123" width="22" height="12" rx="3" fill="#ff3300" opacity="0.8"/>
    </svg>`,
    motorcycle: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#374151"/><stop offset="100%" stop-color="#111827"/></linearGradient></defs>
        <ellipse cx="200" cy="182" rx="160" ry="10" fill="rgba(0,0,0,0.3)"/>
        <circle cx="100" cy="148" r="40" fill="#111"/><circle cx="100" cy="148" r="28" fill="#444"/><circle cx="100" cy="148" r="10" fill="#888"/>
        <circle cx="300" cy="148" r="40" fill="#111"/><circle cx="300" cy="148" r="28" fill="#444"/><circle cx="300" cy="148" r="10" fill="#888"/>
        <line x1="100" y1="148" x2="300" y2="148" stroke="#555" stroke-width="8"/>
        <path d="M160,148 Q170,80 200,70 Q230,62 260,80 L280,148 Z" fill="url(#mg)"/>
        <path d="M195,72 Q210,55 230,60 L240,80 Q215,72 200,78 Z" fill="rgba(150,200,255,0.35)"/>
        <rect x="270" y="100" width="30" height="10" rx="3" fill="#ff9900" opacity="0.9"/>
        <path d="M100,148 Q130,110 160,108" stroke="#666" stroke-width="5" fill="none"/>
        <path d="M300,148 Q280,130 265,120" stroke="#666" stroke-width="5" fill="none"/>
        <ellipse cx="310" cy="145" rx="8" ry="14" fill="#cc3300" opacity="0.7"/>
    </svg>`,
    boat: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0284c7"/><stop offset="100%" stop-color="#075985"/></linearGradient>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.5"/><stop offset="100%" stop-color="#0369a1" stop-opacity="0.8"/></linearGradient></defs>
        <rect x="0" y="140" width="400" height="60" fill="url(#wg)" rx="4"/>
        <path d="M30,140 Q35,100 80,95 L320,95 Q365,100 370,140 Z" fill="url(#bg)"/>
        <rect x="120" y="60" width="160" height="38" rx="6" fill="url(#bg)"/>
        <path d="M120,60 Q125,42 145,38 L275,38 Q295,42 280,60 Z" fill="rgba(186,230,253,0.3)"/>
        <rect x="118" y="38" width="4" height="60" fill="#555"/>
        <rect x="278" y="38" width="4" height="60" fill="#555"/>
        <rect x="60" y="98" width="280" height="8" rx="2" fill="rgba(255,255,255,0.15)"/>
        <rect x="355" y="110" width="20" height="10" rx="3" fill="#ffe566" opacity="0.9"/>
        <path d="M10,148 Q200,135 390,148" stroke="rgba(255,255,255,0.2)" stroke-width="2" fill="none"/>
    </svg>`
};

async function setCardImage(card, v, type) {
    const box = card.querySelector(".vehicle-image-box");
    if (!box) return;

    const typeLabel = type === "boat" ? "boat" : type === "motorcycle" ? "motorcycle" : "";
    const q = `${v.year || ""} ${v.make || ""} ${v.model || ""} ${typeLabel}`.trim();

    // Loading state
    box.innerHTML = `<div class="img-loading"><div class="img-spinner"></div><span>Finding image…</span></div>`;
    box.style.background = "#0f172a";
    box.style.position = "relative";

    // Step 1: real photo
    const params = new URLSearchParams({ type, make: v.make||"", model: v.model||"", year: v.year||"", q });
    try {
        const res  = await fetch(`/api/vehicle_image?${params}`);
        const data = await res.json();
        if (data.url) {
            const img = document.createElement("img");
            img.className = "compare-vehicle-image";
            img.loading = "lazy";
            img.src = data.url;
            img.onerror = () => showSVGFallback(box, type);
            box.innerHTML = "";
            box.style.background = "#111";
            box.appendChild(img);
            return;
        }
    } catch(e) {}

    // Step 2: SVG fallback
    showSVGFallback(box, type);
    if (window.refreshIcons) window.refreshIcons();
}

function showSVGFallback(box, type) {
    const svg = SVG_FALLBACKS[type] || SVG_FALLBACKS.car;
    box.innerHTML = svg + `<div class="svg-fallback-badge">Illustration</div>`;
    box.style.background = "#0f172a";
}



function buildVsStats(c1, c2) {
    const n1 = `${c1.year} ${c1.make} ${c1.model}`;
    const n2 = `${c2.year} ${c2.make} ${c2.model}`;

    const statRow = (label, val1, val2, unit = "", higherIsBetter = true) => {
        if (!val1 && !val2) return "";
        const v1n = parseFloat(val1) || 0;
        const v2n = parseFloat(val2) || 0;
        const max = Math.max(v1n, v2n, 1);
        const p1  = Math.round((v1n / max) * 100);
        const p2  = Math.round((v2n / max) * 100);
        const winner = higherIsBetter
            ? (v1n > v2n ? 1 : v2n > v1n ? 2 : 0)
            : (v1n < v2n ? 1 : v2n < v1n ? 2 : 0);

        return `
        <div class="vs-stat-row">
            <span class="vs-val vs-val-left ${winner === 1 ? "vs-winner" : ""}">${val1 ? val1 + unit : "—"}</span>
            <div class="vs-bars">
                <div class="vs-bar-left"><div class="vs-bar-fill-left ${winner === 1 ? "vs-fill-win" : ""}" style="width:${p1}%"></div></div>
                <span class="vs-stat-label">${label}</span>
                <div class="vs-bar-right"><div class="vs-bar-fill-right ${winner === 2 ? "vs-fill-win" : ""}" style="width:${p2}%"></div></div>
            </div>
            <span class="vs-val vs-val-right ${winner === 2 ? "vs-winner" : ""}">${val2 ? val2 + unit : "—"}</span>
        </div>`;
    };

    const hp1   = parseInt(c1.horsepower) || (c1.cylinders ? c1.cylinders * 55 : 0);
    const hp2   = parseInt(c2.horsepower) || (c2.cylinders ? c2.cylinders * 55 : 0);
    const costs1 = estimateCosts(c1, "car");
    const costs2 = estimateCosts(c2, "car");

    return `
    <div class="vs-stats-section">
        <div class="vs-stats-header">
            <span class="vs-name-left">${n1}</span>
            <span class="vs-badge">HEAD TO HEAD</span>
            <span class="vs-name-right">${n2}</span>
        </div>
        ${statRow("Horsepower", hp1 || "", hp2 || "", " hp")}
        ${statRow("Displacement", c1.displacement || "", c2.displacement || "", "L")}
        ${statRow("Cylinders", c1.cylinders || "", c2.cylinders || "", " cyl")}
        ${statRow("Est. Value", costs1.price || "", costs2.price || "", "", false)}
        ${statRow("Annual Cost", (costs1.insurance + costs1.fuelPerYear + costs1.maintenancePerYear) || "",
                                 (costs2.insurance + costs2.fuelPerYear + costs2.maintenancePerYear) || "", "", false)}
    </div>`;
}

async function compareCars(v1Override, v2Override) {
    const v1Input = (v1Override || getV1SearchText()).trim();
    const v2Input = (v2Override || getV2SearchText()).trim();
    const intent  = document.getElementById("intent").value;
    const type    = document.getElementById("vehicleType").value;

    if (!v1Input || !v2Input) { alert("Select both vehicles to compare."); return; }

    const results = document.getElementById("results");
    results.innerHTML = `<p style="color:var(--text-muted);padding:20px 0;">Loading comparison…</p>`;

    const v1 = await searchVehicle(v1Input, type);
    const v2 = await searchVehicle(v2Input, type);

    const [card1, card2] = await Promise.all([
        buildCompareCard(v1, v1Input, type),
        buildCompareCard(v2, v2Input, type),
    ]);
    const similarities = buildSimilarities(v1, v2, type);

    const vsSection = (type === "car" && v1 && v2 && !v1._notFound && !v2._notFound)
        ? buildVsStats(v1, v2) : "";

    results.innerHTML = `
        <div class="comparison-layout">
            <div id="left-car"></div>
            <div class="or-divider">OR</div>
            <div id="right-car"></div>
        </div>
        ${vsSection}
        <div class="similarities-box">
            <h2>Similarities</h2>
            ${similarities}
        </div>
        <div class="winner-box">
            <h2>Recommendation</h2>
            <button onclick="saveComparison()">Save Comparison</button>
            ${getWinner(v1, v2, intent, type)}
        </div>
        ${getRisks(v1, v2, intent, type)}
    `;
    document.getElementById("left-car").appendChild(card1);
    document.getElementById("right-car").appendChild(card2);
    if (window.refreshIcons) window.refreshIcons();
}

// Normalize make names for API Ninjas (doesn't like hyphens or full brand names)
function normalizeMake(make) {
    return make
        .toLowerCase()
        .replace("mercedes-benz", "mercedes")
        .replace("land rover", "land rover")
        .replace("alfa romeo", "alfa romeo")
        .replace("aston martin", "aston martin")
        .replace(/-/g, " ")
        .trim();
}

// ─── Boat entry synthesizer ────────────────────────────────────────
// Creates reasonable estimated specs from make/model name when not in boatData
function synthesizeBoatEntry(make, model, year) {
    const numMatch = model.match(/(\d+)/);
    let length_ft = 20;
    if (numMatch) {
        const n = parseInt(numMatch[1]);
        if (n >= 100) length_ft = Math.round(n / 10); // 190→19, 216→22, 250→25
        else if (n >= 10) length_ft = n;
    }
    const combined = (make + " " + model).toLowerCase();
    let type = "Powerboat";
    if (combined.includes("fisherman") || combined.includes("outrage") || combined.includes("dauntless") ||
        combined.includes("canyon") || combined.includes("marlin") || combined.includes("freedom"))  type = "Center Console";
    if (combined.includes("pontoon") || combined.includes("barge") || combined.includes("sundeck")) type = "Pontoon";
    if (combined.includes("wake") || combined.includes("surf") || combined.includes("lsv"))         type = "Wake Boat";
    if (combined.includes("bass") || combined.includes("tracker"))                                   type = "Bass Boat";
    if (combined.includes("cruiser") || combined.includes("express") || combined.includes("sundancer")) type = "Cruiser";
    let engine_type = "outboard";
    if (["Malibu","Nautique","MasterCraft","Supra","Centurion"].includes(make)) engine_type = "inboard";
    if (["Yamaha","Scarab"].includes(make)) engine_type = "jet";
    const hp       = length_ft >= 28 ? 300 : length_ft >= 24 ? 225 : length_ft >= 21 ? 175 : length_ft >= 18 ? 115 : 90;
    const capacity = Math.max(4, Math.floor(length_ft * 0.5));
    return {
        year: parseInt(year) || 2022, make, model, type,
        hull: "fiberglass", length_ft, engine_type, horsepower: hp,
        fuel_type: "gas", capacity_persons: capacity, beam_ft: +(length_ft * 0.38).toFixed(1),
        pros: [
            `${length_ft}-foot ${make} purpose-built for on-water performance`,
            "Quality marine grade construction",
            length_ft >= 24 ? "Generous deck space for groups and activities" : "Easy to tow and store"
        ],
        cons: [
            "Fuel, storage, and insurance costs vary by region",
            "Review dealer specs before purchase — estimated data shown",
            "Trailering and slip requirements depend on actual length"
        ],
        _synthesized: true
    };
}

async function searchVehicle(searchText, type = "car") {
    const parts = searchText.trim().split(" ");
    const year  = parts[0];
    const make  = parts[1];
    const model = parts.slice(2).join(" ");

    if (type === "boat") {
        const allParts = searchText.trim().split(" ");
        const yearStr  = allParts[0];
        const rest     = allParts.slice(1);

        let match = null;
        // Try 1, 2, 3-word makes
        for (let makeWords = 1; makeWords <= Math.min(3, rest.length - 1); makeWords++) {
            const tryMake  = rest.slice(0, makeWords).join(" ");
            const tryModel = rest.slice(makeWords).join(" ");
            if (!tryModel) continue;
            match = searchBoatData(tryMake, tryModel);
            if (match) break;
        }
        if (!match) match = searchBoatData(rest[0], rest.slice(1).join(" "));

        if (match) return { ...match, year: yearStr || match.year, _type: "boat" };

        // Synthesize: determine best make split (prefer 2-word makes for known brands)
        const twoWordMake  = rest.slice(0, 2).join(" ");
        const twoWordModel = rest.slice(2).join(" ");
        const synthMake  = twoWordModel ? twoWordMake  : rest[0];
        const synthModel = twoWordModel ? twoWordModel : rest.slice(1).join(" ");
        const synth = synthesizeBoatEntry(synthMake, synthModel || make, yearStr);
        return { ...synth, _type: "boat" };
    }

    if (type === "motorcycle") {
        let apiResult = null;
        try {
            const response = await fetch(`/api/search_motorcycle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`);
            const data = await response.json();
            if (data && data[0]) apiResult = { ...data[0], _type: "motorcycle" };
        } catch(e) {}

        // If API found data with real specs, use it
        if (apiResult && (apiResult.type || apiResult.displacement || apiResult.engine)) {
            return apiResult;
        }

        // API returned nothing or incomplete data — try local lookup
        const local = searchMotoData(make, model);
        if (local) {
            // Merge: local fills gaps in API data (or replaces fully if API returned nothing)
            return { ...local, year, make: make || local.make, model: model || local.model, _type: "motorcycle" };
        }

        if (apiResult) return apiResult; // API had at least weight/partial data
        return { year, make, model, _type: "motorcycle", _notFound: true };
    }

    // Car (default) — try API first, fall back to local dataset
    const apiMake = normalizeMake(make);
    const response = await fetch(`/api/search_vehicle?make=${encodeURIComponent(apiMake)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`);
    const data = await response.json();

    if (data && data.length > 0) {
        const searchModelWords = model.toLowerCase()
            .replace(/-/g, " ").replace(/[^a-z0-9 ]/g, "").split(" ").filter(w => w.length >= 1);

        // If no words to match on (shouldn't happen), just return first result
        if (searchModelWords.length === 0) {
            return { ...data[0], year, make, _type: "car" };
        }

        const bestMatch = data.find(car => {
            const resultModel = (car.model || "").toLowerCase().replace(/-/g, " ");
            return searchModelWords.some(word => resultModel.includes(word));
        });

        // If no word-match found, fall back to first result rather than failing
        if (bestMatch || data[0]) {
            return { ...(bestMatch || data[0]), year, make, _type: "car" };
        }
    }

    // API had no match — try local specs dataset (European/luxury brands)
    const localMatch = searchLocalCarSpecs(make, model, year);
    if (localMatch) {
        return { ...localMatch, _type: "car" };
    }

    return { year, make, model, _type: "car", _notFound: true };
}

// ─── Unified card builder ─────────────────────────────────────────
async function buildCompareCard(v, fallbackName, type) {
    let card;
    if (type === "boat")       card = buildBoatCard(v, fallbackName);
    else if (type === "motorcycle") card = buildMotoCard(v, fallbackName);
    else card = buildApiCompareCard(v, fallbackName);

    // Fetch image (real photo → AI fallback)
    if (!v || v._notFound) return card;
    setCardImage(card, v, type);  // async, updates box in place
    return card;
}

function buildBoatCard(b, fallbackName) {
    const card = document.createElement("div");
    card.classList.add("comparison-card");
    if (!b || b._notFound) {
        card.innerHTML = `
            <div class="vehicle-image-box missing-image">No boat data found</div>
            <h2>${fallbackName}</h2>
            <div class="features-box"><p style="color:var(--text-muted)">Try format: 2021 Sea Ray 250 SLX</p></div>`;
        return card;
    }
    const pros = (b.pros || []).map(p => `<li>${p}</li>`).join("");
    const cons = (b.cons || []).map(c => `<li>${c}</li>`).join("");
    card.innerHTML = `
        <div class="vehicle-image-box" style="background:#0d2235;display:flex;align-items:center;justify-content:center;"><i data-lucide="sailboat" style="width:56px;height:56px;color:#fff;"></i></div>
        <h2>${b.year} ${b.make.toUpperCase()} ${b.model.toUpperCase()}</h2>
        <div class="features-box">
            <h3>Pros</h3><ul>${pros}</ul>
            <h3>Cons</h3><ul>${cons}</ul>
            <h3>Specs</h3>
            <ul>
                <li><strong>Type:</strong> ${b.type}</li>
                <li><strong>Length:</strong> ${b.length_ft} ft</li>
                <li><strong>Engine:</strong> ${b.engine_type}</li>
                <li><strong>Horsepower:</strong> ${b.horsepower} hp</li>
                <li><strong>Capacity:</strong> ${b.capacity_persons} persons</li>
                <li><strong>Hull:</strong> ${b.hull}</li>
            </ul>
        </div>
        ${buildCostBox(b, "boat")}`;
    return card;
}

function buildMotoCard(m, fallbackName) {
    const card = document.createElement("div");
    card.classList.add("comparison-card");
    if (!m || m._notFound) {
        card.innerHTML = `
            <div class="vehicle-image-box missing-image">No motorcycle data found</div>
            <h2>${fallbackName}</h2>
            <div class="features-box"><p style="color:var(--text-muted)">Try format: 2021 Kawasaki Ninja 650</p></div>`;
        return card;
    }
    const pros = buildMotoPros(m);
    const cons = buildMotoCons(m);
    card.innerHTML = `
        <div class="vehicle-image-box" style="background:#0f0f0f;display:flex;align-items:center;justify-content:center;"><i data-lucide="bike" style="width:56px;height:56px;color:#fff;"></i></div>
        <h2>${m.year} ${(m.make||"").toUpperCase()} ${(m.model||"").toUpperCase()}</h2>
        <div class="features-box">
            <h3>Pros</h3><ul>${pros}</ul>
            <h3>Cons</h3><ul>${cons}</ul>
            <h3>Specs</h3>
            <ul>
                <li><strong>Type:</strong> ${m.type || "N/A"}</li>
                <li><strong>Displacement:</strong> ${m.displacement || "N/A"} cc</li>
                <li><strong>Engine:</strong> ${m.engine || "N/A"}</li>
                <li><strong>Power:</strong> ${m.power || "N/A"}</li>
                <li><strong>Torque:</strong> ${m.torque || "N/A"}</li>
                <li><strong>Weight:</strong> ${m.total_weight || (m.weight_kg ? `${m.weight_kg} kg (${Math.round(m.weight_kg * 2.205)} lbs)` : "N/A")}</li>
            </ul>
        </div>
        ${buildCostBox(m, "motorcycle")}`;
    return card;
}

function buildMotoPros(m) {
    const pros = [];
    if (m.displacement && parseInt(m.displacement) <= 650) pros.push("Manageable displacement — great for city riding and beginners");
    if (m.type && m.type.toLowerCase().includes("sport")) pros.push("Sport geometry for aggressive, confidence-inspiring riding");
    if (m.type && m.type.toLowerCase().includes("naked")) pros.push("Upright ergonomics are comfortable for daily commuting");
    if (m.type && (m.type.toLowerCase().includes("touring") || m.type.toLowerCase().includes("adventure"))) pros.push("Long-range touring capability with luggage options");
    if (pros.length === 0) pros.push("Solid all-around motorcycle specs");
    return pros.map(p => `<li>${p}</li>`).join("");
}

function buildMotoCons(m) {
    const cons = [];
    if (m.displacement && parseInt(m.displacement) >= 1000) cons.push("High displacement may be intimidating for newer riders");
    if (m.type && m.type.toLowerCase().includes("sport")) cons.push("Aggressive riding position can be fatiguing on long trips");
    const weightKg = m.weight_kg || (m.total_weight ? parseFloat(m.total_weight) : 0);
    if (weightKg > 220) cons.push("Heavier bike can be harder to maneuver at low speeds");
    if (cons.length === 0) cons.push("No major drawbacks from available specs");
    return cons.map(c => `<li>${c}</li>`).join("");
}

// ─── Similarities (unified) ───────────────────────────────────────
function buildSimilarities(v1, v2, type) {
    if (!v1 || !v2 || v1._notFound || v2._notFound) return "<p>Search for two valid vehicles to see similarities.</p>";

    if (type === "boat") {
        const sims = [];
        if (v1.engine_type === v2.engine_type) sims.push(`Both use ${v1.engine_type} propulsion.`);
        if (v1.fuel_type   === v2.fuel_type)   sims.push(`Both run on ${v1.fuel_type}.`);
        if (Math.abs(v1.length_ft - v2.length_ft) <= 2) sims.push(`Similar length — ${v1.length_ft} ft vs ${v2.length_ft} ft.`);
        if (v1.type === v2.type) sims.push(`Both are ${v1.type} style boats.`);
        if (sims.length === 0) sims.push("These boats have different specs based on available data.");
        return sims.map(s => `<p>${s}</p>`).join("");
    }

    if (type === "motorcycle") {
        const sims = [];
        if (v1.type === v2.type) sims.push(`Both are ${v1.type} motorcycles.`);
        const d1 = parseInt(v1.displacement), d2 = parseInt(v2.displacement);
        if (!isNaN(d1) && !isNaN(d2) && Math.abs(d1 - d2) <= 100) sims.push(`Similar displacement — ${d1}cc vs ${d2}cc.`);
        if (sims.length === 0) sims.push("These motorcycles have different configurations.");
        return sims.map(s => `<p>${s}</p>`).join("");
    }

    return buildApiSimilarities(v1, v2);
}


// ─── Cost Estimation ─────────────────────────────────────────────
function estimateCosts(v, type) {
    let price = 0, insurance = 0, fuelPerYear = 0, maintenancePerYear = 0;

    if (type === "car") {
        const make  = (v.make  || "").toLowerCase();
        const model = (v.model || "").toLowerCase();
        const cls   = (v.class || "").toLowerCase();
        const year  = parseInt(v.year) || 2020;
        const hp    = v.horsepower || (v.cylinders ? v.cylinders * 50 : 150);
        const disp  = v.displacement || 2.0;

        // Base price by brand tier
        const ultra  = ["porsche","ferrari","lamborghini","bentley","rolls-royce","maserati","mclaren"];
        const luxury = ["bmw","mercedes","audi","lexus","cadillac","lincoln","volvo","genesis","infiniti","acura","jaguar","land rover"];
        const mid    = ["honda","toyota","mazda","subaru","volkswagen","hyundai","kia","nissan","ford","chevrolet","gmc","dodge","jeep","ram"];

        if (ultra.some(b => make.includes(b)))   price = 110000;
        else if (luxury.some(b => make.includes(b))) price = 50000;
        else if (mid.some(b => make.includes(b))) price = 28000;
        else price = 32000;

        // Class adjustment
        if (cls.includes("large"))     price += 8000;
        if (cls.includes("midsize"))   price += 3000;
        if (cls.includes("suv"))       price += 6000;
        if (cls.includes("sport"))     price += 5000;
        if (cls.includes("subcompact")) price -= 4000;
        if (v.fuel_type === "electric") price += 12000;

        // Year depreciation
        const age = new Date().getFullYear() - year;
        if (age <= 0)       price = Math.round(price * 1.05);
        else if (age <= 2)  price = Math.round(price * 1.0);
        else if (age <= 5)  price = Math.round(price * 0.78);
        else if (age <= 10) price = Math.round(price * 0.55);
        else                price = Math.round(price * 0.35);
        price = Math.round(price / 500) * 500;

        // Insurance — base $1,200, adjusted for HP, class, drive type
        insurance = 1200;
        if (hp > 400)      insurance += 800;
        else if (hp > 250) insurance += 400;
        else if (hp > 180) insurance += 150;
        if (v.drive === "rwd" && hp > 200) insurance += 250;
        if (cls.includes("sport"))  insurance += 300;
        if (cls.includes("large"))  insurance += 200;
        if (luxury.some(b => make.includes(b))) insurance += 600;
        if (ultra.some(b => make.includes(b)))  insurance += 2000;
        if (age > 5)  insurance -= 200;
        if (age > 10) insurance -= 300;
        insurance = Math.round(insurance / 50) * 50;

        // Fuel — avg 12,000 miles/yr, ~$3.50/gal
        const mpg = disp <= 1.5 ? 34 : disp <= 2.0 ? 30 : disp <= 3.0 ? 24 : disp <= 4.0 ? 18 : 14;
        fuelPerYear = v.fuel_type === "electric" ? 600 : Math.round((12000 / mpg) * 3.50);

        // Maintenance
        if (ultra.some(b => make.includes(b)))   maintenancePerYear = 3500;
        else if (luxury.some(b => make.includes(b))) maintenancePerYear = 1800;
        else maintenancePerYear = 900;
        if (age > 8) maintenancePerYear += 500;
    }

    else if (type === "motorcycle") {
        const make = (v.make || "").toLowerCase();
        const disp = parseInt(v.displacement) || 600;

        const premiumBrands = ["ducati","bmw","triumph","aprilia","mv agusta"];
        const budgetBrands  = ["royal enfield","ktm","kawasaki","yamaha","honda","suzuki"];

        if (premiumBrands.some(b => make.includes(b))) price = 16000;
        else if (budgetBrands.some(b => make.includes(b))) price = 8000;
        else price = 11000;

        if (disp >= 1000) { price += 5000; }
        else if (disp >= 600) { price += 2000; }
        else if (disp <= 300) { price -= 2000; }

        const year = parseInt(v.year) || 2020;
        const age  = new Date().getFullYear() - year;
        if (age > 3)  price = Math.round(price * 0.75);
        if (age > 7)  price = Math.round(price * 0.55);
        price = Math.round(price / 250) * 250;

        insurance = disp >= 1000 ? 900 : disp >= 600 ? 650 : 450;
        if (premiumBrands.some(b => make.includes(b))) insurance += 300;
        insurance = Math.round(insurance / 50) * 50;

        fuelPerYear = Math.round((8000 / 45) * 3.50); // motorcycles avg ~45 mpg
        maintenancePerYear = 600;
    }

    else if (type === "boat") {
        const hp   = v.horsepower || 150;
        const len  = v.length_ft  || 20;
        const eng  = v.engine_type || "outboard";

        if (len >= 28)      price = 85000;
        else if (len >= 24) price = 45000;
        else if (len >= 20) price = 28000;
        else                price = 18000;

        if (hp >= 300)  price += 15000;
        else if (hp >= 200) price += 6000;
        if (eng === "inboard") price += 8000;
        if (v.type && v.type.includes("Wake")) price += 12000;

        price = Math.round(price / 500) * 500;

        // Boat insurance ~1-2% of value
        insurance = Math.round(price * 0.015 / 50) * 50;
        fuelPerYear = Math.round(hp * 0.6 * 50 * 3.50); // rough estimate
        maintenancePerYear = eng === "inboard" ? 2200 : 1400;
    }

    return { price, insurance, fuelPerYear, maintenancePerYear };
}

function buildCostBox(v, type) {
    const c = estimateCosts(v, type);
    if (!c.price) return "";
    const totalPerYear = c.insurance + c.fuelPerYear + c.maintenancePerYear;
    return `
        <div class="cost-breakdown-box">
            <h3><i data-lucide="dollar-sign"></i> Cost Estimate</h3>
            <div class="cost-row est-price">
                <span>Est. Market Value</span>
                <strong>~$${c.price.toLocaleString()}</strong>
            </div>
            <div class="cost-divider"></div>
            <div class="cost-row">
                <span><i data-lucide="shield"></i> Est. Insurance / yr</span>
                <strong>~$${c.insurance.toLocaleString()}</strong>
            </div>
            <div class="cost-row">
                <span><i data-lucide="fuel"></i> Est. Fuel / yr</span>
                <strong>~$${c.fuelPerYear.toLocaleString()}</strong>
            </div>
            <div class="cost-row">
                <span><i data-lucide="wrench"></i> Est. Maintenance / yr</span>
                <strong>~$${c.maintenancePerYear.toLocaleString()}</strong>
            </div>
            <div class="cost-row cost-total">
                <span>Total annual cost</span>
                <strong>~$${totalPerYear.toLocaleString()}</strong>
            </div>
            <p class="cost-disclaimer">* Estimates only. Actual costs vary by location, driver profile, and usage.</p>
        </div>
    `;
}

function buildPerformanceBars(car) {
    const hp   = parseInt(car.horsepower) || 0;
    const disp = parseFloat(car.displacement) || 0;
    const cyl  = parseInt(car.cylinders) || 0;

    if (!hp && !disp && !cyl) return "";

    const hpPct   = hp   ? Math.min(100, Math.round((hp / 700) * 100))   : 0;
    const dispPct = disp ? Math.min(100, Math.round((disp / 8.0) * 100)) : 0;
    const cylPct  = cyl  ? Math.min(100, Math.round((cyl / 12) * 100))   : 0;

    const bar = (label, val, pct, unit, color) => val ? `
        <div class="perf-bar-row">
            <span class="perf-bar-label">${label}</span>
            <div class="perf-bar-track">
                <div class="perf-bar-fill" style="width:${pct}%;background:${color};"></div>
            </div>
            <span class="perf-bar-val">${val}${unit}</span>
        </div>` : "";

    return `
        <div class="perf-bars">
            <h3>Performance</h3>
            ${bar("Horsepower", hp,   hpPct,   " hp", "var(--accent)")}
            ${bar("Displacement", disp, dispPct, "L",   "#f97316")}
            ${bar("Cylinders",   cyl,  cylPct,  " cyl","#8b5cf6")}
        </div>`;
}

function buildApiCompareCard(car, fallbackName) {
    const card = document.createElement("div");
    card.classList.add("comparison-card");

    if (!car || car._notFound) {
        card.innerHTML = `
            <div class="vehicle-image-box missing-image" style="display:flex;align-items:center;justify-content:center;"><i data-lucide="car" style="width:42px;height:42px;"></i></div>
            <h2>${esc(fallbackName)}</h2>
            <div class="features-box">
                <p style="color:var(--text-muted);font-size:13px;margin-bottom:10px;">
                    No spec data found for this vehicle. The API may not cover this make/model.<br>
                    Try format: <strong>2020 Honda Civic</strong>
                </p>
            </div>
        `;
        return card;
    }

    const pros = buildProsFromSpecs(car);
    const cons = buildConsFromSpecs(car);
    const trans = car.transmission === "a" ? "Automatic" : car.transmission === "m" ? "Manual" : car.transmission || "N/A";
    const drive = (car.drive || "N/A").toUpperCase();

    card.innerHTML = `
        <div class="vehicle-image-box" style="display:flex;align-items:center;justify-content:center;"><i data-lucide="car" style="width:56px;height:56px;"></i></div>

        <h2>${car.year} ${car.make.toUpperCase()} ${car.model.toUpperCase()}</h2>

        <div class="card-badges">
            ${car.drive    ? `<span class="card-badge">${drive}</span>` : ""}
            ${car.fuel_type ? `<span class="card-badge">${car.fuel_type.toUpperCase()}</span>` : ""}
            ${car.class    ? `<span class="card-badge">${car.class}</span>` : ""}
        </div>

        <div class="features-box">
            <h3>Pros</h3>
            <ul>${pros}</ul>

            <h3>Cons</h3>
            <ul>${cons}</ul>

            <h3>Specs</h3>
            <div class="specs-grid">
                ${car.cylinders    ? `<div class="spec-item"><span class="spec-label">Cylinders</span><span class="spec-val">${car.cylinders}</span></div>` : ""}
                ${car.displacement ? `<div class="spec-item"><span class="spec-label">Displacement</span><span class="spec-val">${car.displacement}L</span></div>` : ""}
                ${car.horsepower   ? `<div class="spec-item"><span class="spec-label">Horsepower</span><span class="spec-val">${car.horsepower} hp</span></div>` : ""}
                ${car.torque       ? `<div class="spec-item"><span class="spec-label">Torque</span><span class="spec-val">${car.torque}</span></div>` : ""}
                <div class="spec-item"><span class="spec-label">Drive</span><span class="spec-val">${drive}</span></div>
                <div class="spec-item"><span class="spec-label">Trans.</span><span class="spec-val">${trans}</span></div>
                ${car.fuel_type ? `<div class="spec-item"><span class="spec-label">Fuel</span><span class="spec-val">${car.fuel_type}</span></div>` : ""}
                ${car.class     ? `<div class="spec-item"><span class="spec-label">Class</span><span class="spec-val">${car.class}</span></div>` : ""}
            </div>
            ${car._local ? `<p style="color:var(--text-muted);font-size:11px;margin-top:6px;">* Specs from local database</p>` : ""}
        </div>

        ${buildPerformanceBars(car)}
        ${buildCostBox(car, "car")}
    `;

    return card;
}

function buildProsFromSpecs(car) {
    const pros = [];
    const make  = (car.make  || "").toLowerCase();
    const cls   = (car.class || "").toLowerCase();
    const hp    = parseInt(car.horsepower) || (car.cylinders ? car.cylinders * 55 : 150);
    const disp  = parseFloat(car.displacement) || 2.0;
    const cyl   = parseInt(car.cylinders) || 4;
    const drive = (car.drive || "").toLowerCase();
    const fuel  = (car.fuel_type || "gas").toLowerCase();
    const trans = (car.transmission || "a").toLowerCase();
    const year  = parseInt(car.year) || 2020;

    const luxuryBrands = ["acura","lexus","infiniti","bmw","mercedes","audi","cadillac","lincoln","genesis","volvo"];
    const isLuxury = luxuryBrands.some(b => make.includes(b));

    // Fuel / powertrain
    if (fuel === "electric") {
        pros.push("Zero emissions with instant electric torque from a standstill");
        pros.push("Lower running costs — no gasoline, fewer moving parts to service");
    } else if (fuel === "hybrid") {
        pros.push("Hybrid powertrain blends performance with improved fuel efficiency");
        pros.push("Electric motor assist adds torque at low speeds where gas engines are weakest");
    } else if (fuel === "diesel") {
        pros.push("Diesel delivers strong low-end torque and excellent highway fuel economy");
    }

    // Drivetrain
    if (drive === "awd" || drive === "4wd") {
        pros.push("All-wheel drive provides confident grip in rain, snow, and spirited driving");
    } else if (drive === "rwd" && hp > 250) {
        pros.push("Rear-wheel drive delivers a dynamic, rear-biased driving feel — ideal for enthusiasts");
    } else if (drive === "fwd") {
        pros.push("Front-wheel drive is reliable and predictable for daily commuting");
    }

    // Power / engine character
    if (hp >= 450) {
        pros.push(`${hp}hp output puts this in supercar territory — serious straight-line performance`);
    } else if (hp >= 300) {
        pros.push(`${hp}hp gives real performance credentials without going full exotic`);
    } else if (hp >= 200) {
        pros.push(`${hp}hp strikes a good balance of punch and daily usability`);
    } else if (hp > 0) {
        pros.push(`Modest ${hp}hp output prioritizes efficiency and low running costs`);
    }

    // Cylinder-specific character
    if (cyl === 8) {
        pros.push("V8 delivers the iconic exhaust note and character that enthusiasts value");
    } else if (cyl === 6 && disp <= 3.5) {
        pros.push("V6 hits a sweet spot between efficiency and available power");
    } else if (cyl <= 4 && disp <= 2.0) {
        pros.push("Compact engine keeps fuel and ownership costs low for daily use");
    }

    // Manual transmission
    if (trans === "m") {
        pros.push("Manual gearbox gives the driver full control and a more connected experience");
    }

    // Class
    if (cls.includes("two seater") || cls.includes("sport")) {
        pros.push("Purpose-built sports proportions keep weight low and driver focus high");
    }
    if (cls.includes("midsize") || cls.includes("large")) {
        pros.push("Larger class means comfortable room for passengers and real cargo space");
    }
    if (cls.includes("suv")) {
        pros.push("SUV body style combines practicality with available all-wheel drive and higher seating");
    }

    // Luxury / reliability
    if (isLuxury) {
        pros.push("Premium brand brings refined interior quality and strong long-term resale value");
    }

    // Modern tech
    if (year >= 2020) {
        pros.push("Recent model year includes modern driver-assist tech, connectivity, and safety features");
    }

    return pros.slice(0, 4).map(p => `<li>${p}</li>`).join("") || `<li>Solid vehicle specs for its class</li>`;
}

function buildConsFromSpecs(car) {
    const cons = [];
    const make  = (car.make  || "").toLowerCase();
    const cls   = (car.class || "").toLowerCase();
    const hp    = parseInt(car.horsepower) || (car.cylinders ? car.cylinders * 55 : 150);
    const disp  = parseFloat(car.displacement) || 2.0;
    const cyl   = parseInt(car.cylinders) || 4;
    const drive = (car.drive || "").toLowerCase();
    const fuel  = (car.fuel_type || "gas").toLowerCase();
    const trans = (car.transmission || "a").toLowerCase();
    const year  = parseInt(car.year) || 2020;

    const europeanLuxury = ["bmw","mercedes","audi","jaguar","land rover","maserati","alfa romeo","volvo"];
    const isEuroLuxury = europeanLuxury.some(b => make.includes(b));

    // Fuel consumption
    if (cyl >= 8 || disp >= 5.0) {
        cons.push(`${cyl}-cylinder ${disp}L engine means high fuel costs — expect 12–16 mpg in mixed driving`);
    } else if (cyl >= 6 && disp >= 3.5) {
        cons.push("V6 fuel economy won't satisfy drivers prioritizing efficiency");
    }

    // Drivetrain limitations
    if (drive === "rwd") {
        cons.push("Rear-wheel drive demands more attention in wet or icy conditions");
    } else if (drive === "fwd" && hp > 200) {
        cons.push("Front-wheel drive limits the performance feel for a car with this much power — torque steer can be an issue");
    }

    // Hybrid complexity
    if (fuel === "hybrid") {
        cons.push("Hybrid battery replacement is an expensive long-term consideration");
    }

    // Electric charging
    if (fuel === "electric") {
        cons.push("Range and charging speed depend heavily on infrastructure where you live");
    }

    // Older tech
    if (year <= 2016) {
        cons.push("Older model year means infotainment and safety tech feel dated versus current competition");
    }

    // Manual in traffic
    if (trans === "m") {
        cons.push("Manual gearbox gets tiring quickly in heavy stop-and-go city traffic");
    }

    // Practicality
    if (cls.includes("two seater")) {
        cons.push("Two-seat layout makes this a weekend car — no room for passengers or family errands");
    }
    if (cls.includes("subcompact")) {
        cons.push("Subcompact dimensions limit cargo space and long-trip comfort");
    }

    // Insurance / running costs for performance
    if (hp >= 350 || (cyl >= 8 && drive === "rwd")) {
        cons.push("High-performance profile typically attracts higher insurance premiums");
    }

    // European luxury maintenance
    if (isEuroLuxury) {
        cons.push("European luxury brands carry significantly higher service and parts costs out of warranty");
    }

    // Underpowered for type
    if (cyl <= 4 && hp < 180 && (cls.includes("large") || cls.includes("suv"))) {
        cons.push("Small engine in a large/heavy body results in sluggish acceleration when loaded");
    }

    return cons.slice(0, 3).map(c => `<li>${c}</li>`).join("") || `<li>No significant drawbacks based on available specs</li>`;
}

function buildApiSimilarities(car1, car2) {
    if (!car1 || !car2) {
        return `<p>Search for two valid vehicles to compare similarities.</p>`;
    }

    let similarities = [];

    if (car1.class === car2.class) {
        similarities.push(`Both are classified as ${car1.class}s.`);
    }

    if (car1.fuel_type === car2.fuel_type) {
        similarities.push(`Both use ${car1.fuel_type} fuel.`);
    }

    if (car1.drive === car2.drive) {
        similarities.push(`Both use ${car1.drive.toUpperCase()} drivetrain.`);
    }

    if (car1.cylinders === car2.cylinders) {
        similarities.push(`Both have ${car1.cylinders}-cylinder engines.`);
    }

    if (similarities.length === 0) {
        similarities.push("These vehicles have different specs based on the available data.");
    }

    return similarities.map(item => `<p>${item}</p>`).join("");
}

function getWinner(car1, car2, intent, type = 'car') {
    if (type === 'boat')       return getBoatWinner(car1, car2, intent);
    if (type === 'motorcycle') return getMotoWinner(car1, car2, intent);
    if (!car1 || !car2) {
        return "Enter two valid vehicles.";
    }

    let score1 = 0;
    let score2 = 0;

    let reasons1 = [];
    let reasons2 = [];

    function addPoint(carNumber, reason, points = 1) {
        if (carNumber === 1) {
            score1 += points;
            reasons1.push(reason);
        } else {
            score2 += points;
            reasons2.push(reason);
        }
    }

    if (intent === "daily") {
        if (car1.drive === "fwd") addPoint(1, "front-wheel drive is practical for everyday driving", 2);
        if (car2.drive === "fwd") addPoint(2, "front-wheel drive is practical for everyday driving", 2);

        if (car1.cylinders <= 4) addPoint(1, "4-cylinder engine is better suited for daily efficiency");
        if (car2.cylinders <= 4) addPoint(2, "4-cylinder engine is better suited for daily efficiency");

        if (car1.class && (car1.class.includes("midsize") || car1.class.includes("compact"))) {
            addPoint(1, "body size is practical for regular use");
        }

        if (car2.class && (car2.class.includes("midsize") || car2.class.includes("compact"))) {
            addPoint(2, "body size is practical for regular use");
        }
    }

    if (intent === "performance") {
        if (car1.displacement > car2.displacement) addPoint(1, "larger engine displacement gives stronger performance potential", 2);
        if (car2.displacement > car1.displacement) addPoint(2, "larger engine displacement gives stronger performance potential", 2);

        if (car1.cylinders > car2.cylinders) addPoint(1, "more cylinders usually means more power potential", 2);
        if (car2.cylinders > car1.cylinders) addPoint(2, "more cylinders usually means more power potential", 2);

        if (car1.drive === "rwd") addPoint(1, "rear-wheel drive is better for performance driving");
        if (car2.drive === "rwd") addPoint(2, "rear-wheel drive is better for performance driving");
    }

    if (intent === "budget") {
        if (car1.displacement < car2.displacement) addPoint(1, "smaller engine may reduce fuel and ownership costs", 2);
        if (car2.displacement < car1.displacement) addPoint(2, "smaller engine may reduce fuel and ownership costs", 2);

        if (car1.cylinders < car2.cylinders) addPoint(1, "fewer cylinders usually means lower maintenance costs", 2);
        if (car2.cylinders < car1.cylinders) addPoint(2, "fewer cylinders usually means lower maintenance costs", 2);

        if (car1.fuel_type === "gas") addPoint(1, "gas engines are easy to service and refuel");
        if (car2.fuel_type === "gas") addPoint(2, "gas engines are easy to service and refuel");
    }

    if (intent === "comfort") {
        if (car1.class && (car1.class.includes("midsize") || car1.class.includes("large"))) {
            addPoint(1, "larger class usually provides better cabin comfort", 2);
        }

        if (car2.class && (car2.class.includes("midsize") || car2.class.includes("large"))) {
            addPoint(2, "larger class usually provides better cabin comfort", 2);
        }

        if (car1.drive === "fwd") addPoint(1, "front-wheel drive is stable and predictable for regular driving");
        if (car2.drive === "fwd") addPoint(2, "front-wheel drive is stable and predictable for regular driving");
    }

    const name1 = `${car1.year} ${car1.make} ${car1.model}`;
    const name2 = `${car2.year} ${car2.make} ${car2.model}`;

    if (score1 > score2) {
        return `
            <strong>${name1}</strong> is the better choice for <strong>${formatIntent(intent)}</strong> because it offers:
            <ul>
                ${reasons1.map(reason => `<li>${reason}</li>`).join("")}
            </ul>
        `;
    }

    if (score2 > score1) {
        return `
            <strong>${name2}</strong> is the better choice for <strong>${formatIntent(intent)}</strong> because it offers:
            <ul>
                ${reasons2.map(reason => `<li>${reason}</li>`).join("")}
            </ul>
        `;
    }

    return `
        Both vehicles are evenly matched for <strong>${formatIntent(intent)}</strong> based on the available specs.
    `;
}

function getRisks(car1, car2, intent, type = 'car') {
    if (!car1 || !car2) return "";

    function buildRiskList(car) {
        let risks = [];

        if (car.displacement > 4.0) {
            risks.push("Higher fuel consumption due to large engine");
        }

        if (car.cylinders >= 6) {
            risks.push("Higher maintenance costs from larger engine");
        }

        if (car.drive === "rwd" && intent === "daily") {
            risks.push("Rear-wheel drive may be less practical in bad weather");
        }

        if (car.cylinders <= 4 && intent === "performance") {
            risks.push("Limited power compared to performance-focused engines");
        }

        if (car.class && car.class.includes("subcompact")) {
            risks.push("Less interior space and comfort");
        }

        if (risks.length === 0) {
            risks.push("No major concerns based on available data");
        }

        return risks;
    }

    const name1 = `${car1.year} ${car1.make} ${car1.model}`;
    const name2 = `${car2.year} ${car2.make} ${car2.model}`;

    return `
        <div class="risk-box">
            <h2>Things to Consider</h2>

            <p><strong>${name1}</strong></p>
            <ul>
                ${buildRiskList(car1).map(r => `<li>${r}</li>`).join("")}
            </ul>

            <p><strong>${name2}</strong></p>
            <ul>
                ${buildRiskList(car2).map(r => `<li>${r}</li>`).join("")}
            </ul>
        </div>
    `;
}

function formatIntent(intent) {
    if (intent === "daily") return "Daily Driving";
    if (intent === "performance") return "Performance";
    if (intent === "budget") return "Budget";
    if (intent === "comfort") return "Comfort";
    return "your selected priority";
}

function setupAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const box   = document.getElementById(suggestionsId);
    if (!input || !box) return;

    function showSuggestions() {
        const value = input.value.toLowerCase().trim();
        box.innerHTML = "";
        if (value.length < 1) { box.style.display = "none"; return; }

        const type    = document.getElementById("vehicleType")?.value || "car";
        const list    = vehicleSuggestions[type] || vehicleSuggestions.car;

        // Score matches: starts-with ranks higher than contains
        const matches = list
            .map(v => {
                const vl = v.toLowerCase();
                const score = vl.startsWith(value) ? 2
                            : vl.includes(value)   ? 1 : 0;
                return { v, score };
            })
            .filter(m => m.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map(m => m.v);

        if (matches.length === 0) { box.style.display = "none"; return; }

        matches.forEach(vehicle => {
            const item = document.createElement("div");
            item.classList.add("suggestion-item");

            // Highlight the matching part
            const idx = vehicle.toLowerCase().indexOf(value);
            if (idx !== -1) {
                item.innerHTML =
                    esc(vehicle.slice(0, idx)) +
                    `<strong>${esc(vehicle.slice(idx, idx + value.length))}</strong>` +
                    esc(vehicle.slice(idx + value.length));
            } else {
                item.textContent = vehicle;
            }

            item.addEventListener("mousedown", (e) => {
                e.preventDefault(); // prevent blur before click
                input.value = vehicle;
                box.innerHTML = "";
                box.style.display = "none";
            });
            box.appendChild(item);
        });

        box.style.display = "block";
    }

    input.addEventListener("input",  showSuggestions);
    input.addEventListener("focus",  showSuggestions);
    input.addEventListener("blur",   () => setTimeout(() => { box.style.display = "none"; }, 150));
    input.addEventListener("keydown", (e) => {
        const items = box.querySelectorAll(".suggestion-item");
        const active = box.querySelector(".suggestion-item.active");
        if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = active ? active.nextElementSibling : items[0];
            if (active) active.classList.remove("active");
            if (next) { next.classList.add("active"); input.value = next.textContent; }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prev = active ? active.previousElementSibling : items[items.length - 1];
            if (active) active.classList.remove("active");
            if (prev) { prev.classList.add("active"); input.value = prev.textContent; }
        } else if (e.key === "Enter") {
            if (active) { input.value = active.textContent; box.innerHTML = ""; box.style.display = "none"; }
        } else if (e.key === "Escape") {
            box.innerHTML = ""; box.style.display = "none";
        }
    });
}

setupAutocomplete("car1", "suggestions1");
setupAutocomplete("car2", "suggestions2");

async function saveComparison() {
    const car1   = getV1SearchText();
    const car2   = getV2SearchText();
    const intent = document.getElementById("intent").value;

    if (!car1 || !car2) { alert("Nothing to save — run a comparison first."); return; }

    const vehicle_type = document.getElementById("vehicleType")?.value || "car";
    const res = await csrfFetch("/save_comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car1, car2, intent, vehicle_type })
    });

    if (res.ok) {
        alert("Comparison saved!");
    } else {
        alert("Could not save — are you logged in?");
    }
}

function loadComparisonFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const car1   = params.get("car1");
    const car2   = params.get("car2");
    const intent = params.get("intent");
    const type   = params.get("type") || "car";

    if (car1 && car2) {
        document.getElementById("vehicleType").value = type;
        onTypeChange();
        if (intent) document.getElementById("intent").value = intent;
        compareCars(car1, car2);
    }
}

// Init year dropdowns on page load
initCompareYears();
onTypeChange();
loadComparisonFromUrl();
// ─── Boat winner ─────────────────────────────────────────────────
function getBoatWinner(b1, b2, intent) {
    if (!b1 || !b2 || b1._notFound || b2._notFound) return "<p>Enter two valid boats.</p>";
    let s1 = 0, s2 = 0, r1 = [], r2 = [];
    const n1 = `${b1.year} ${b1.make} ${b1.model}`;
    const n2 = `${b2.year} ${b2.make} ${b2.model}`;

    function add(n, reason, pts=1) { if(n===1){s1+=pts;r1.push(reason);}else{s2+=pts;r2.push(reason);} }

    if (intent === "daily" || intent === "budget") {
        if (b1.horsepower < b2.horsepower) add(1, "lower horsepower means lower fuel costs");
        else if (b2.horsepower < b1.horsepower) add(2, "lower horsepower means lower fuel costs");
        if (b1.length_ft < b2.length_ft) add(1, "smaller size is easier and cheaper to maintain");
        else if (b2.length_ft < b1.length_ft) add(2, "smaller size is easier and cheaper to maintain");
    }
    if (intent === "performance") {
        if (b1.horsepower > b2.horsepower) add(1, "more horsepower for better speed on water", 2);
        else if (b2.horsepower > b1.horsepower) add(2, "more horsepower for better speed on water", 2);
    }
    if (intent === "comfort") {
        if (b1.capacity_persons > b2.capacity_persons) add(1, "higher passenger capacity for groups", 2);
        else if (b2.capacity_persons > b1.capacity_persons) add(2, "higher passenger capacity for groups", 2);
        if (b1.length_ft > b2.length_ft) add(1, "larger size provides more deck space and comfort");
        else if (b2.length_ft > b1.length_ft) add(2, "larger size provides more deck space and comfort");
    }

    if (s1 > s2) return `<strong>${n1}</strong> is the better choice for <strong>${formatIntent(intent)}</strong> because it offers:<ul>${r1.map(r=>`<li>${r}</li>`).join("")}</ul>`;
    if (s2 > s1) return `<strong>${n2}</strong> is the better choice for <strong>${formatIntent(intent)}</strong> because it offers:<ul>${r2.map(r=>`<li>${r}</li>`).join("")}</ul>`;
    return `Both boats are evenly matched for <strong>${formatIntent(intent)}</strong> based on available specs.`;
}

// ─── Motorcycle winner ────────────────────────────────────────────
function getMotoWinner(m1, m2, intent) {
    if (!m1 || !m2 || m1._notFound || m2._notFound) return "<p>Enter two valid motorcycles.</p>";
    let s1 = 0, s2 = 0, r1 = [], r2 = [];
    const n1 = `${m1.year} ${m1.make} ${m1.model}`;
    const n2 = `${m2.year} ${m2.make} ${m2.model}`;
    const d1 = parseInt(m1.displacement) || 0;
    const d2 = parseInt(m2.displacement) || 0;

    function add(n, reason, pts=1) { if(n===1){s1+=pts;r1.push(reason);}else{s2+=pts;r2.push(reason);} }

    if (intent === "daily") {
        if (d1 <= 650 && d1 > 0) add(1, "manageable displacement is ideal for city commuting");
        if (d2 <= 650 && d2 > 0) add(2, "manageable displacement is ideal for city commuting");
        if (m1.type && m1.type.toLowerCase().includes("naked")) add(1, "naked/standard ergonomics suit daily riding");
        if (m2.type && m2.type.toLowerCase().includes("naked")) add(2, "naked/standard ergonomics suit daily riding");
    }
    if (intent === "performance") {
        if (d1 > d2) add(1, "larger displacement for more power", 2);
        else if (d2 > d1) add(2, "larger displacement for more power", 2);
        if (m1.type && m1.type.toLowerCase().includes("sport")) add(1, "sport geometry optimized for performance riding");
        if (m2.type && m2.type.toLowerCase().includes("sport")) add(2, "sport geometry optimized for performance riding");
    }
    if (intent === "budget") {
        if (d1 < d2) add(1, "smaller engine typically means lower insurance and fuel costs", 2);
        else if (d2 < d1) add(2, "smaller engine typically means lower insurance and fuel costs", 2);
    }
    if (intent === "comfort") {
        if (m1.type && (m1.type.toLowerCase().includes("touring") || m1.type.toLowerCase().includes("adventure"))) add(1, "touring/adventure geometry built for long-distance comfort", 2);
        if (m2.type && (m2.type.toLowerCase().includes("touring") || m2.type.toLowerCase().includes("adventure"))) add(2, "touring/adventure geometry built for long-distance comfort", 2);
    }

    if (s1 > s2) return `<strong>${n1}</strong> is the better choice for <strong>${formatIntent(intent)}</strong> because it offers:<ul>${r1.map(r=>`<li>${r}</li>`).join("")}</ul>`;
    if (s2 > s1) return `<strong>${n2}</strong> is the better choice for <strong>${formatIntent(intent)}</strong> because it offers:<ul>${r2.map(r=>`<li>${r}</li>`).join("")}</ul>`;
    return `Both motorcycles are evenly matched for <strong>${formatIntent(intent)}</strong> based on available specs.`;
}
// ─── Restore a saved comparison from URL params ───────────────────
// /compare?car1=...&car2=...&intent=...&type=motorcycle
(function restoreFromUrl() {
    const p     = new URLSearchParams(window.location.search);
    const car1  = p.get("car1");
    const car2  = p.get("car2");
    if (!car1 || !car2) return;

    const intent = p.get("intent") || "daily";
    const type   = p.get("type")   || "car";

    const run = () => {
        const typeSel   = document.getElementById("vehicleType");
        const intentSel = document.getElementById("intent");
        if (typeSel)   typeSel.value   = type;
        if (intentSel) intentSel.value = intent;
        // Show the right dropdown set for this vehicle type
        if (typeof onTypeChange === "function") onTypeChange();
        // compareCars accepts overrides, so we don't need the dropdowns populated
        if (typeof compareCars === "function") compareCars(car1, car2);
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
    } else {
        run();
    }
})();
