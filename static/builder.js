// ─── RideInsight 3D Builder ────────────────────────────────────────────────
// Modular mesh-swap builder powered by Three.js + real GLB assets

// ── Part configuration ─────────────────────────────────────────────────────
const PART_CATEGORIES = [
    {
        key:      "Hood",
        label:    "Hood",
        icon:     "chevrons-up",
        variants: [
            { name: "Hood_A", label: "Stock Hood" },
            { name: "Hood_B", label: "Low Profile" },
            { name: "Hood_C", label: "Vented Hood" },
        ]
    },
    {
        key:      "FrontBumper",
        label:    "Front Bumper",
        icon:     "shield",
        variants: [
            { name: "FrontBumper_A", label: "Stock" },
            { name: "FrontBumper_B", label: "Sport" },
            { name: "FrontBumper_C", label: "Aggressive" },
        ]
    },
    {
        key:      "RearBumper",
        label:    "Rear Bumper",
        icon:     "shield",
        variants: [
            { name: "RearBumper_A", label: "Stock" },
            { name: "RearBumper_B", label: "Sport" },
            { name: "RearBumper_C", label: "Diffuser" },
        ]
    },
    {
        key:      "Spoiler",
        label:    "Spoiler",
        icon:     "flag",
        variants: [
            { name: "Spoiler_A", label: "Lip Spoiler" },
            { name: "Spoiler_B", label: "Sport Wing" },
            { name: "Spoiler_C", label: "GT Wing" },
        ]
    },
    {
        key:      "Exhaust",
        label:    "Exhaust",
        icon:     "flame",
        variants: [
            { name: "Exhaust_A", label: "Single Exit" },
            { name: "Exhaust_B", label: "Dual Exit" },
            { name: "Exhaust_C", label: "Quad Tips" },
        ]
    },
    {
        key:      "Fender",
        label:    "Fenders",
        icon:     "maximize-2",
        variants: [
            { name: "Fender_A", label: "Stock" },
            { name: "Fender_B", label: "Wide Body" },
            { name: "Fender_C", label: "Flared" },
        ]
    },
    {
        key:      "RunningBoard",
        label:    "Side Skirts",
        icon:     "minus",
        variants: [
            { name: "RunningBoard_A", label: "Standard" },
            { name: "RunningBoard_B", label: "Sport" },
            { name: "RunningBoard_C", label: "Carbon" },
        ]
    },
];

// Meshes always visible (base car)
const ALWAYS_VISIBLE = [
    "Body", "Interior",
    "SM_Wheel_FL", "SM_Wheel_FR", "SM_Wheel_BL", "SM_Wheel_BR",
    "SKM_Car002_Founder_Stang_1967_1967"
];

// All swappable mesh names (flat)
const ALL_PART_MESHES = PART_CATEGORIES.flatMap(c => c.variants.map(v => v.name));

// Current selected variant per category
const selected = {};
PART_CATEGORIES.forEach(c => { selected[c.key] = c.variants[0].name; });

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

// ── Three.js state ─────────────────────────────────────────────────────────
let renderer, scene, camera, controls;
let carModel = null;
let meshMap  = {};  // name → THREE.Object3D
let bodyMaterial = null;
let autoRotate = true;

// ── Performance mods (stat-based, no visual mesh swap) ─────────────────────
const PERF_MODS = {
    engine: [
        { name: "Cold Air Intake",       cost: 250,  hp: 8,   icon: "wind" },
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
    ],
    wheels: [
        { name: "18\" Aftermarket Rims", cost: 1200, icon: "circle" },
        { name: "19\" Forged Wheels",    cost: 2500, icon: "circle" },
        { name: "Performance Tires",     cost: 800,  icon: "circle" },
        { name: "Track Tires",           cost: 1200, icon: "circle" },
        { name: "Wheel Spacers",         cost: 150,  icon: "move-horizontal" },
    ],
};

const perfModsSelected = { engine: new Set(), suspension: new Set(), wheels: new Set() };

// ── Build state ────────────────────────────────────────────────────────────
let basePriceCents = 0;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initScene();
    buildPartSelectorUI();
    buildPerfModsUI();
    initVehicleDropdowns();
    initColorSwatches();
    loadSavedBuilds();
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    resizeRenderer();

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111827);
    scene.fog = new THREE.Fog(0x111827, 20, 60);

    // Camera
    camera = new THREE.PerspectiveCamera(38, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    camera.position.set(6, 2.2, 10);

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping   = true;
    controls.dampingFactor   = 0.07;
    controls.minDistance     = 4;
    controls.maxDistance     = 22;
    controls.maxPolarAngle   = Math.PI / 2 - 0.02;
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 0.9;
    controls.target.set(0, 0.6, 0);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff5e0, 1.8);
    key.position.set(6, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far  = 50;
    key.shadow.camera.left = key.shadow.camera.bottom = -8;
    key.shadow.camera.right = key.shadow.camera.top = 8;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x6fb5ff, 0.6);
    fill.position.set(-6, 3, -4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 4, -8);
    scene.add(rim);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Accent ground stripe
    const lineGeo = new THREE.PlaneGeometry(10, 0.05);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe11d48, transparent: true, opacity: 0.5 });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.001;
    scene.add(line);

    loadModel();
    animate();

    window.addEventListener("resize", resizeRenderer);
}

function resizeRenderer() {
    const canvas = document.getElementById("carCanvas");
    if (!canvas || !renderer) return;
    const w = canvas.parentElement.clientWidth || 600;
    const h = Math.max(340, Math.round(w * 0.6));
    canvas.style.width  = w + "px";
    canvas.style.height = h + "px";
    renderer.setSize(w, h, false);
    if (camera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
}

function loadModel() {
    const loader  = new THREE.GLTFLoader();
    const overlay = document.getElementById("modelLoadOverlay");
    const status  = document.getElementById("modelLoadStatus");

    if (overlay) overlay.style.display = "flex";

    loader.load(
        "/static/models/musclecar.glb",
        (gltf) => {
            carModel = gltf.scene;

            // Build name → node map
            carModel.traverse(node => {
                meshMap[node.name] = node;
                if (node.isMesh) {
                    node.castShadow    = true;
                    node.receiveShadow = true;
                    // Grab body material for paint
                    if (node.name === "Body" && !bodyMaterial) {
                        const mat = Array.isArray(node.material) ? node.material[0] : node.material;
                        if (mat) bodyMaterial = mat;
                    }
                }
            });

            // Set initial part visibility
            applyVisibility();

            // Rotate to face camera (Blender exports front facing -Z, Three.js camera looks at +Z)
            carModel.rotation.y = Math.PI;

            // Scale first using the car's footprint (length × width, not height)
            const box0  = new THREE.Box3().setFromObject(carModel);
            const size0 = box0.getSize(new THREE.Vector3());
            const footprint = Math.max(size0.x, size0.z);
            const scale = footprint > 0 ? 7 / footprint : 1;
            carModel.scale.setScalar(scale);

            // Now center and sit on ground
            const box    = new THREE.Box3().setFromObject(carModel);
            const center = box.getCenter(new THREE.Vector3());
            carModel.position.x = -center.x;
            carModel.position.z = -center.z;
            carModel.position.y = -box.min.y;     // bottom of car on y=0

            scene.add(carModel);

            // Aim camera at car's centre-mass
            const finalBox  = new THREE.Box3().setFromObject(carModel);
            const carHeight = finalBox.max.y - finalBox.min.y;
            controls.target.set(0, carHeight * 0.35, 0);
            camera.position.set(7, carHeight * 0.7, 11);
            controls.update();

            // Apply default paint
            applyPaint(currentPaintHex);

            if (overlay) overlay.style.display = "none";
            if (window.refreshIcons) window.refreshIcons();
        },
        (progress) => {
            if (status && progress.total) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                status.textContent = `Loading model… ${pct}%`;
            }
        },
        (err) => {
            console.error("GLB load failed:", err);
            if (status) status.textContent = "Failed to load model";
        }
    );
}

function applyVisibility() {
    // Hide ALL swappable meshes
    ALL_PART_MESHES.forEach(name => {
        if (meshMap[name]) meshMap[name].visible = false;
    });
    // Show selected variant for each category
    Object.values(selected).forEach(name => {
        if (meshMap[name]) meshMap[name].visible = true;
    });
    // Always show base meshes
    ALWAYS_VISIBLE.forEach(name => {
        if (meshMap[name]) meshMap[name].visible = true;
    });
}

function swapPart(categoryKey, variantName) {
    const prev = selected[categoryKey];
    if (prev === variantName) return;

    if (prev && meshMap[prev])     meshMap[prev].visible = false;
    selected[categoryKey] = variantName;
    if (meshMap[variantName]) meshMap[variantName].visible = true;

    // Update button states
    const catEl = document.getElementById(`cat-${categoryKey}`);
    if (catEl) {
        catEl.querySelectorAll(".part-variant-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.variant === variantName);
        });
    }
}

// Names of meshes that receive body paint
const PAINTABLE_MESHES = [
    "Body", "Hood_A", "Hood_B", "Hood_C",
    "FrontBumper_A", "FrontBumper_B", "FrontBumper_C",
    "RearBumper_A",  "RearBumper_B",  "RearBumper_C",
    "Fender_A",      "Fender_B",      "Fender_C",
    "RunningBoard_A","RunningBoard_B","RunningBoard_C",
    "Spoiler_A",     "Spoiler_B",     "Spoiler_C",
];

function applyPaint(hex) {
    currentPaintHex = hex;
    if (!carModel) return;
    const color = new THREE.Color(hex);
    PAINTABLE_MESHES.forEach(name => {
        const node = meshMap[name];
        if (!node || !node.isMesh) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(mat => { if (mat && mat.color) mat.color.set(color); });
    });
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

// ── Color swatches ─────────────────────────────────────────────────────────
function initColorSwatches() {
    const wrap = document.getElementById("colorSwatches");
    if (!wrap) return;
    PAINT_COLORS.forEach(c => {
        const btn = document.createElement("button");
        btn.className = "color-swatch";
        btn.style.background = c.hex;
        btn.title = c.label;
        btn.onclick = () => {
            applyPaint(c.hex);
            document.getElementById("customColor").value = c.hex;
            wrap.querySelectorAll(".color-swatch").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        };
        wrap.appendChild(btn);
    });
    // Activate first
    wrap.firstChild?.classList.add("active");
}

// ── Part selector UI ───────────────────────────────────────────────────────
function buildPartSelectorUI() {
    const container = document.getElementById("categorySections");
    if (!container) return;

    // Visual customization header
    const header = document.createElement("div");
    header.className = "builder-section-group-label";
    header.innerHTML = `<i data-lucide="paintbrush"></i> Visual Customization`;
    container.appendChild(header);

    PART_CATEGORIES.forEach(cat => {
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
                    ${cat.variants.map((v, i) => `
                        <button
                            class="part-variant-btn ${i === 0 ? "active" : ""}"
                            data-variant="${v.name}"
                            onclick="swapPart('${cat.key}', '${v.name}')">
                            ${v.label}
                        </button>
                    `).join("")}
                </div>
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

    const perfDefs = [
        { key: "engine",     label: "Engine & Power",      icon: "settings"  },
        { key: "suspension", label: "Suspension",           icon: "wrench"    },
        { key: "wheels",     label: "Wheels & Tires",       icon: "disc"      },
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
                            </div>
                        </div>
                        <div class="mod-right">
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
    if (!make || !model) { disp.textContent = "Select a vehicle above"; basePriceCents = 0; updateBuildSummary(); return; }

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
    let modTotal = 0;
    const items = [];

    Object.values(perfModsSelected).forEach(set => {
        set.forEach(modName => {
            const allMods = Object.values(PERF_MODS).flat();
            const mod = allMods.find(m => m.name === modName);
            if (mod) { modTotal += mod.cost; items.push(mod); }
        });
    });

    const summaryList = document.getElementById("summaryList");
    const partCount   = document.getElementById("partCount");
    if (summaryList) {
        summaryList.innerHTML = items.length
            ? items.map(m => `<div class="summary-item"><span>${m.name}</span><span>$${m.cost.toLocaleString()}</span></div>`).join("")
            : `<p class="empty-state" style="font-size:12px;padding:4px 0;">No performance mods added yet</p>`;
    }
    if (partCount) partCount.textContent = `${items.length} mod${items.length !== 1 ? "s" : ""}`;

    const summaryBase  = document.getElementById("summaryBase");
    const summaryMods  = document.getElementById("summaryMods");
    const summaryTotal = document.getElementById("summaryTotal");
    if (summaryBase)  summaryBase.textContent  = basePriceCents ? `$${basePriceCents.toLocaleString()}` : "—";
    if (summaryMods)  summaryMods.textContent  = `$${modTotal.toLocaleString()}`;
    if (summaryTotal) summaryTotal.textContent = basePriceCents
        ? `$${(basePriceCents + modTotal).toLocaleString()}` : `$${modTotal.toLocaleString()}`;
}

// ── Save / Load builds ─────────────────────────────────────────────────────
async function saveBuild() {
    const name = document.getElementById("buildName")?.value?.trim() || "My Build";
    const yr    = document.getElementById("baseYear")?.value  || "";
    const make  = document.getElementById("baseMake")?.value  || "";
    const model = document.getElementById("baseModel")?.value || "";
    const trim  = document.getElementById("baseTrim")?.value  || "";

    const perfMods = [];
    Object.entries(perfModsSelected).forEach(([cat, set]) => {
        set.forEach(modName => {
            const allMods = Object.values(PERF_MODS).flat();
            const mod = allMods.find(m => m.name === modName);
            if (mod) perfMods.push({ category: cat, name: mod.name, cost: mod.cost });
        });
    });

    const payload = {
        name,
        base_vehicle: [yr, make, model, trim].filter(Boolean).join(" ") || "Custom Build",
        base_price:   basePriceCents,
        paint:        currentPaintHex,
        visual_parts: { ...selected },
        perf_mods:    perfMods,
        total_cost:   basePriceCents + perfMods.reduce((s, m) => s + m.cost, 0),
    };

    try {
        const res = await csrfFetch("/api/save_build", {
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
        const res   = await fetch("/api/my_builds");
        if (!res.ok) throw new Error();
        const builds = await res.json();
        if (!builds.length) {
            container.innerHTML = `<p class="empty-state" style="padding:8px 0;">No saved builds yet.</p>`;
            return;
        }
        container.innerHTML = builds.map(b => `
            <div class="saved-build-card">
                <div class="saved-build-info">
                    <strong>${b.name || "Unnamed Build"}</strong>
                    <span>${b.base_vehicle || ""}</span>
                </div>
                <div class="saved-build-actions">
                    <button class="btn btn-ghost btn-sm" onclick="loadBuild(${b.id})">Load</button>
                    <button class="btn btn-ghost btn-sm btn-danger" onclick="deleteBuild(${b.id})">Delete</button>
                </div>
            </div>
        `).join("");
    } catch(e) {
        container.innerHTML = `<p class="empty-state" style="padding:8px 0;">No saved builds yet.</p>`;
    }
}

async function loadBuild(id) {
    try {
        const res  = await fetch(`/api/build/${id}`);
        const build = await res.json();

        if (build.paint) applyPaint(build.paint);
        if (build.visual_parts) {
            Object.entries(build.visual_parts).forEach(([cat, variant]) => swapPart(cat, variant));
        }
        if (build.name && document.getElementById("buildName")) {
            document.getElementById("buildName").value = build.name;
        }
        showToast("Build loaded!");
    } catch(e) {
        showToast("Could not load build", true);
    }
}

async function deleteBuild(id) {
    if (!confirm("Delete this build?")) return;
    try {
        await csrfFetch(`/api/build/${id}`, { method: "DELETE" });
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
    // Reset paint
    applyPaint(PAINT_COLORS[0].hex);
    const swatches = document.getElementById("colorSwatches");
    if (swatches) {
        swatches.querySelectorAll(".color-swatch").forEach((b, i) => b.classList.toggle("active", i === 0));
    }
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
