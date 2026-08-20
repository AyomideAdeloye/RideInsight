// ─── RideInsight 3D Builder ────────────────────────────────────────────────
// Modular mesh-swap builder powered by Three.js + real GLB assets

// ── Part configuration ─────────────────────────────────────────────────────
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
    {
        key:      "Spoiler",
        label:    "Spoiler",
        icon:     "flag",
        variants: [
            { name: "Spoiler_A", label: "Lip Spoiler", price: 0 },
            { name: "Spoiler_B", label: "Sport Wing",  price: 400 },
            { name: "Spoiler_C", label: "GT Wing",     price: 950 },
        ]
    },
    {
        key:      "Exhaust",
        label:    "Exhaust",
        icon:     "flame",
        variants: [
            { name: "Exhaust_A", label: "Single Exit", price: 0 },
            { name: "Exhaust_B", label: "Dual Exit",   price: 450 },
            { name: "Exhaust_C", label: "Quad Tips",   price: 900 },
        ]
    },
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
];

const VEHICLES = {
    musclecar: {
        label:      "Muscle Car",
        sub:        "'67 American V8",
        glb:        "/static/models/musclecar.glb",
        categories: MUSCLECAR_CATEGORIES,
    },
    mazda6_gj: {
        label:      "Mazda 6",
        sub:        "GJ · 2014–2018",
        glb:        "/static/models/mazda6_gj.glb",
        categories: MAZDA6_GJ_CATEGORIES,
        rotationY:  0,        // Tripo exports already face +Z; muscle car needs PI
    },
    // sportscar:  { label: "Sports Car",  sub: "Modern coupe",  glb: "/static/models/sportscar.glb",  categories: [...] },
    // hypercar:   { label: "Hyper Car",   sub: "Exotic",        glb: "/static/models/hypercar.glb",   categories: [...] },
};

// ── Model matching: real car → best available 3D body ─────────────────────
// exact: specific make/model (+optional year range) → a dedicated model
// archetype: fallback by vehicle character when no exact model exists yet
const MODEL_MATCHERS = [
    // ── Exact models (in-house, RI-VAS compliant) ──
    { make: "mazda", model: "6", modelExact: true, years: [2014, 2018], vehicle: "mazda6_gj", exact: true },
    { make: "mazda", model: "mazda6", modelExact: true, years: [2014, 2018], vehicle: "mazda6_gj", exact: true },

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
    return { key: "musclecar", exact: false };   // default body for now
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
        VARIANT_INFO[v.name] = { label: v.label, price: v.price, category: c.label };
    }));
    ALL_PART_MESHES = PART_CATEGORIES.flatMap(c => c.variants.map(v => v.name));
    Object.keys(selected).forEach(k => delete selected[k]);
    PART_CATEGORIES.forEach(c => { selected[c.key] = c.variants[0].name; });
}

// Meshes always visible (base car)
const ALWAYS_VISIBLE = [
    "Body", "Interior",
    "SM_Wheel_FL", "SM_Wheel_FR", "SM_Wheel_BL", "SM_Wheel_BR",
];

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

// ── Three.js state ─────────────────────────────────────────────────────────
let renderer, scene, camera, controls;
let carModel = null;
let meshMap  = {};   // legacy exact-name map
let partNodes = {};  // variantName → [mesh nodes] (pattern-matched)
let baseNodes = [];  // always-visible meshes (body, interior, wheels)
let bodyMaterial = null;
let autoRotate = true;

// Match "AnyPrefix_Hood_A", "AnyPrefix_Hood_A_1", "Hood_A_2" → variant "Hood_A"
function matchesVariant(meshName, variantName) {
    const re = new RegExp("(^|_)" + variantName + "(_\\d+)?$");
    return re.test(meshName);
}

// Meshes that must NEVER render (skinned duplicate of the whole car —
// without its armature it explodes into stretched "filament" geometry)
function isJunkMesh(name) {
    return /SKM_/i.test(name);
}

// Is this mesh part of the always-visible base (body shell, interior, wheels)?
function isBaseMesh(name) {
    if (/SM_Wheel/.test(name)) return true;
    if (/(^|_)Interior(_\d+)?$/.test(name)) return true;
    if (/(^|_)Body(_\d+)?$/.test(name)) return true;
    return false;
}

function isWheelOrInterior(name) {
    return /SM_Wheel/.test(name) || /(^|_)Interior(_\d+)?$/.test(name);
}

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
    rebuildCustomizationUI();
    initVehicleDropdowns();
    initColorWheel();
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
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    resizeRenderer();

    // Scene — clean studio look
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa8adb5);
    scene.fog = new THREE.Fog(0xa8adb5, 30, 70);

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
        new THREE.MeshStandardMaterial({ color: 0x9a9ea6, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    buildEnvMap();   // needs scene + renderer both ready
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

function loadModel() {
    const loader  = new THREE.GLTFLoader();
    const overlay = document.getElementById("modelLoadOverlay");
    const status  = document.getElementById("modelLoadStatus");

    if (overlay) overlay.style.display = "flex";

    loader.load(
        VEHICLES[currentVehicleKey].glb,
        (gltf) => {
            carModel = gltf.scene;

            // Pattern-match every mesh into variant groups or base
            partNodes = {};
            ALL_PART_MESHES.forEach(v => { partNodes[v] = []; });
            baseNodes = [];
            const unmatched = [];

            const junkNodes = [];
            carModel.traverse(node => {
                if (!node.isMesh) return;
                meshMap[node.name] = node;

                // Skinned duplicate car → permanently hidden
                if (isJunkMesh(node.name)) {
                    junkNodes.push(node);
                    node.visible = false;
                    return;
                }

                node.castShadow    = true;
                node.receiveShadow = true;

                // Try to assign to a part variant
                const variant = ALL_PART_MESHES.find(v => matchesVariant(node.name, v));
                if (variant) {
                    partNodes[variant].push(node);
                } else if (isBaseMesh(node.name)) {
                    baseNodes.push(node);
                } else {
                    unmatched.push(node.name);
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
            carModel.position.y = -box.min.y;     // bottom of car on y=0

            scene.add(carModel);
            prepMaterials();

            // Fixed 3/4 camera — car fills the frame like a configurator
            controls.target.set(0, 0.9, 0);
            camera.position.set(4.2, 1.7, 7.5);
            controls.minDistance = 4;
            controls.maxDistance = 16;
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

// ── Vehicle switching ──────────────────────────────────────────────────────
function switchVehicle(key) {
    if (!VEHICLES[key] || key === currentVehicleKey) return;
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
    loadModel();
}

function rebuildCustomizationUI() {
    const container = document.getElementById("categorySections");
    if (container) container.innerHTML = "";
    buildBodyStyleUI();
    buildPartSelectorUI();
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
const NO_PAINT_MATERIAL = /glass|light|lamp|head|tail|chrome|mirror|wiper|trim|rubber|tire|tyre|interior|grill|window|windshield|lens|emissive|metal_dark|logo|badge|plate/i;

function applyPaint(hex) {
    currentPaintHex = hex;
    if (!carModel) return;
    // convertSRGBToLinear: renderer outputs sRGB, so hex colors must be
    // converted to linear or they render oversaturated ("neon")
    const color = new THREE.Color(hex).convertSRGBToLinear();
    carModel.traverse(node => {
        if (!node.isMesh) return;
        if (isWheelOrInterior(node.name)) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(mat => {
            if (!mat || !mat.color) return;
            if (mat.transparent && mat.opacity < 0.3) return;
            if (mat.name && NO_PAINT_MATERIAL.test(mat.name)) return;   // keep lights/glass/trim
            mat.color.copy(color);
            mat.needsUpdate = true;
        });
    });
    const preview = document.getElementById("paintPreview");
    if (preview) preview.style.background = hex;
}

function prepMaterials() {
    if (!carModel) return;
    const matNames = new Set();
    carModel.traverse(node => {
        if (!node.isMesh) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(mat => {
            if (!mat) return;
            if (mat.name) matNames.add(mat.name);
            // Leave lights/glass/chrome/trim untouched
            if (mat.name && NO_PAINT_MATERIAL.test(mat.name)) return;
            if (isWheelOrInterior(node.name)) {
                mat.roughness = 0.8;
                mat.metalness = 0.1;
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
                            <span class="pv-label">${v.label}</span>
                            <span class="pv-price">${v.price > 0 ? "+$" + v.price.toLocaleString() : "Included"}</span>
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
    let visualTotal = 0;
    Object.values(selected).forEach(variantName => {
        const info = VARIANT_INFO[variantName];
        if (info && info.price > 0) {
            visualTotal += info.price;
            items.push({ name: `${info.category}: ${info.label}`, cost: info.price });
        }
    });

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
        parts.push({ category: `visual:${cat}`, name: variant, cost: info.price || 0, effect: info.label || "", icon: "" });
    });
    // Record which body this build uses
    parts.push({ category: "vehicle", name: currentVehicleKey, cost: 0, effect: VEHICLES[currentVehicleKey].label, icon: "" });

    const payload = {
        name,
        baseVehicle: { year: yr, make, model, trim },
        basePrice:   basePriceCents,
        parts,
        carColor:    currentPaintHex,
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
        const vehiclePart = parts.find(p => p.category === "vehicle");
        if (vehiclePart && VEHICLES[vehiclePart.name] && vehiclePart.name !== currentVehicleKey) {
            switchVehicle(vehiclePart.name);
        }

        // Reset perf mods first
        Object.values(perfModsSelected).forEach(s => s.clear());
        document.querySelectorAll(".mod-row").forEach(r => r.classList.remove("mod-active"));
        document.querySelectorAll(".mod-add-btn").forEach(b => b.textContent = "Add");

        parts.forEach(p => {
            if (p.category && p.category.startsWith("visual:")) {
                const cat = p.category.slice(7);
                swapPart(cat, p.name);
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
