// ═══════════════════════════════════════════════════════════════
//  RideInsight — Visual Vehicle Builder
//  Three features: 3D rotating car | 2.5D silhouette | part cards
// ═══════════════════════════════════════════════════════════════

// ─── Presets ─────────────────────────────────────────────────────
const PRESETS = {
    engine: [
        { name: "Cold Air Intake",          cost: 250,  icon: "wind", effect: "intake",    desc: "Increases airflow to the engine for more power and a better sound." },
        { name: "Performance Exhaust",       cost: 800,  icon: "flame", effect: "exhaust",   desc: "Reduces backpressure and gives your car an aggressive exhaust note." },
        { name: "Turbocharger Kit",          cost: 3500, icon: "loader", effect: "turbo",     desc: "Forces more air into the engine — significant horsepower gains." },
        { name: "Supercharger Kit",          cost: 4500, icon: "zap", effect: "turbo",     desc: "Belt-driven forced induction for instant, linear power delivery." },
        { name: "ECU Tune",                  cost: 600,  icon: "cpu", effect: "ecu",       desc: "Remaps fuel and ignition maps to maximize power from your setup." },
        { name: "Intercooler Upgrade",       cost: 700,  icon: "snowflake", effect: "intercooler", desc: "Cools compressed air for denser charge and consistent power." },
        { name: "High-Flow Catalytic Conv.", cost: 400,  icon: "wrench", effect: "exhaust",   desc: "Less restrictive cat keeps emissions legal while freeing up power." },
        { name: "Short Ram Intake",          cost: 150,  icon: "wind", effect: "intake",    desc: "Budget-friendly intake upgrade with a nice induction sound." },
        { name: "Upgraded Fuel Injectors",   cost: 500,  icon: "fuel", effect: "ecu",       desc: "Required for high-power builds to keep the engine properly fueled." },
        { name: "Performance Headers",       cost: 900,  icon: "flame", effect: "exhaust",   desc: "Equal-length headers improve scavenging and exhaust flow." },
    ],
    suspension: [
        { name: "Coilover Kit",              cost: 1200, icon: "ruler", effect: "lower",     desc: "Fully adjustable ride height and damping for street or track." },
        { name: "Lowering Springs",          cost: 350,  icon: "trending-down", effect: "lower",     desc: "Drop 1–2 inches for better handling and aggressive stance." },
        { name: "Sway Bar Kit",              cost: 300,  icon: "link", effect: "handling",  desc: "Reduces body roll in corners for a flatter, sportier feel." },
        { name: "Strut Tower Brace",         cost: 200,  icon: "construction", effect: "handling",  desc: "Stiffens the chassis for more precise turn-in response." },
        { name: "Upgraded Control Arms",     cost: 600,  icon: "settings-2", effect: "handling",  desc: "Adjustable arms allow dialing in camber and toe settings." },
        { name: "Adjustable Camber Kit",     cost: 250,  icon: "ruler", effect: "camber",    desc: "Correct camber after lowering for even tire wear." },
        { name: "Air Suspension Kit",        cost: 3000, icon: "circle", effect: "air",       desc: "Adjustable air bags — slam it for shows, raise it for driving." },
        { name: "Performance Shocks",        cost: 800,  icon: "wrench", effect: "lower",     desc: "Valved for performance driving without sacrificing daily comfort." },
        { name: "Subframe Brace",            cost: 180,  icon: "construction", effect: "handling",  desc: "Reduces chassis flex for sharper handling on aggressive inputs." },
        { name: "Upgraded Bushings",         cost: 300,  icon: "wrench", effect: "handling",  desc: "Polyurethane bushings eliminate slop for a tighter feel." },
    ],
    exterior: [
        { name: "Front Lip Spoiler",         cost: 300,  icon: "triangle", effect: "lip",       desc: "Adds downforce at the front and gives an aggressive look." },
        { name: "Rear Diffuser",             cost: 350,  icon: "wind", effect: "diffuser",  desc: "Manages underbody airflow and adds rear aero balance." },
        { name: "Side Skirts",               cost: 400,  icon: "car", effect: "skirts",    desc: "Connects front and rear aero while lowering the visual stance." },
        { name: "Carbon Fiber Hood",         cost: 1200, icon: "square", effect: "hood",      desc: "Saves weight up front and looks incredible — real carbon weave." },
        { name: "Widebody Kit",              cost: 4000, icon: "maximize", effect: "widebody",  desc: "Aggressive fender flares to fit wide wheels and dominate any show." },
        { name: "Window Tint",               cost: 250,  icon: "glasses", effect: "tint",      desc: "Keeps interior cool, adds privacy, and finishes the look." },
        { name: "Vinyl Wrap",                cost: 2500, icon: "palette", effect: "wrap",      desc: "Full color change — endless options, protects paint underneath." },
        { name: "Custom Paint",              cost: 3000, icon: "paintbrush", effect: "paint",     desc: "Professional respray for a flawless, lasting finish." },
        { name: "LED Headlights",            cost: 500,  icon: "lightbulb", effect: "lights",    desc: "Much brighter than halogen, modern look, and longer lasting." },
        { name: "Roof Spoiler",              cost: 350,  icon: "flag", effect: "spoiler",   desc: "Adds rear downforce and a sporty profile to any sedan." },
    ],
    interior: [
        { name: "Racing Seats",              cost: 1500, icon: "car", effect: "seats",     desc: "Lightweight bucket seats keep you planted in hard corners." },
        { name: "Roll Cage",                 cost: 2000, icon: "construction", effect: "cage",      desc: "Safety cage for track use — required for most motorsport classes." },
        { name: "Sport Steering Wheel",      cost: 400,  icon: "gamepad-2", effect: "wheel",     desc: "Smaller diameter for quicker steering and a race-ready feel." },
        { name: "Short Shifter",             cost: 250,  icon: "settings", effect: "shifter",   desc: "Shorter throws for faster gear changes." },
        { name: "Gauges / Boost Meter",      cost: 300,  icon: "gauge", effect: "gauges",    desc: "Monitor boost, oil pressure, and temps in real time." },
        { name: "Upgraded Head Unit",        cost: 600,  icon: "radio", effect: "audio",     desc: "Apple CarPlay / Android Auto with a clean modern screen." },
        { name: "Speaker Upgrade",           cost: 800,  icon: "volume-2", effect: "audio",     desc: "Component speakers for dramatically better sound quality." },
        { name: "Carbon Fiber Trim",         cost: 500,  icon: "square", effect: "trim",      desc: "Replaces plastic interior panels with real carbon fiber." },
        { name: "Harness Bar + Harness",     cost: 700,  icon: "lock", effect: "cage",      desc: "5-point harness for aggressive track driving." },
        { name: "Pedal Set",                 cost: 150,  icon: "footprints", effect: "pedals",    desc: "Aluminium pedals complete the performance interior look." },
    ],
    wheels: [
        { name: "18\" Aftermarket Wheels",   cost: 1200, icon: "circle", effect: "wheels18",  desc: "Lightweight alloys in 18-inch for improved handling and looks." },
        { name: "19\" Forged Wheels",        cost: 2500, icon: "circle", effect: "wheels19",  desc: "Forged for maximum strength with minimum weight." },
        { name: "Performance Tires (set)",   cost: 800,  icon: "circle", effect: "tires",     desc: "High-grip all-season performance rubber for street use." },
        { name: "Track Tires (set)",         cost: 1200, icon: "circle", effect: "tires",     desc: "Extreme grip slick-compound tires for track days." },
        { name: "Brake Upgrade Kit",         cost: 1500, icon: "octagon", effect: "brakes",    desc: "Slotted rotors and performance pads for shorter stopping distances." },
        { name: "Big Brake Kit",             cost: 3000, icon: "octagon", effect: "bigbrakes", desc: "Massive 6-piston calipers and two-piece rotors for track use." },
        { name: "Wheel Spacers",             cost: 150,  icon: "move-horizontal", effect: "spacers",   desc: "Push wheels outward for a more aggressive stance and fitment." },
        { name: "Lug Nut Set",               cost: 80,   icon: "wrench", effect: "lugnuts",   desc: "Racing lug nuts — lightweight and look great through spokes." },
        { name: "TPMS Sensors",              cost: 200,  icon: "radio-tower", effect: "tpms",      desc: "Keep monitoring tire pressure after your wheel upgrade." },
        { name: "Powder Coated Calipers",    cost: 400,  icon: "palette", effect: "brakes",    desc: "Bright colored calipers visible through the spokes." },
    ],
};

const CATEGORY_META = {
    engine:     { icon: "settings",  label: "Engine & Performance",    color: "#ef4444", zone: "engine"     },
    suspension: { icon: "wrench",  label: "Suspension & Handling",   color: "#f97316", zone: "suspension" },
    exterior:   { icon: "palette",  label: "Exterior & Body",         color: "#8b5cf6", zone: "exterior"   },
    interior:   { icon: "armchair",  label: "Interior",                color: "#06b6d4", zone: "interior"   },
    wheels:     { icon: "disc",  label: "Wheels, Tires & Brakes",  color: "#16a34a", zone: "wheels"     },
};

const PAINT_COLORS = [
    { name: "Midnight Black",  hex: "#1a1a1a" },
    { name: "Pearl White",     hex: "#f0f0f0" },
    { name: "Racing Red",      hex: "#cc0000" },
    { name: "Ocean Blue",      hex: "#1d4ed8" },
    { name: "Gunmetal",        hex: "#4b5563" },
    { name: "Forest Green",    hex: "#166534" },
    { name: "Burnt Orange",    hex: "#c2410c" },
    { name: "Champagne",       hex: "#d4a96a" },
];

// ─── State ────────────────────────────────────────────────────────
let build = { name: "", baseVehicle: null, basePrice: 0, parts: [], carColor: "#1a1a1a" };
let partIdCounter = 0;

// ═══════════════════════════════════════════════════════════════
//  3D Car Model — Proper curves, no Roblox vibes
// ═══════════════════════════════════════════════════════════════

let scene, camera, renderer, carGroup, autoRotate = true;
let glbLoaded = false;  // true when a real AI model is showing
let wheelMeshes = [], bodyMat;

function init3D() {
    const canvas = document.getElementById("carCanvas");
    const W = canvas.parentElement.clientWidth || 500;
    const H = 300;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1a);

    camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(5, 2.5, 5);
    camera.lookAt(0, 0.2, 0);

    const ambient = new THREE.AmbientLight(0x9aaabb, 0.7);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x4466ff, 0.25);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff7733, 0.2);
    rim.position.set(0, 1, -5);
    scene.add(rim);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshStandardMaterial({ color: 0x0d1520, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.75;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(20, 20, 0x1a2535, 0x1a2535);
    grid.position.y = -0.748;
    scene.add(grid);

    buildCarModel();
    animate3D();
}

function buildCarModel() {
    if (carGroup) { scene.remove(carGroup); carGroup = null; }
    carGroup = new THREE.Group();
    wheelMeshes = [];

    const hasLip      = build.parts.some(p => p.effect === "lip");
    const hasSpoiler  = build.parts.some(p => p.effect === "spoiler" || p.effect === "widebody");
    const hasWidebody = build.parts.some(p => p.effect === "widebody");
    const hasCFHood   = build.parts.some(p => p.effect === "hood");
    const hasLED      = build.parts.some(p => p.effect === "lights");
    const hasBrakes   = build.parts.some(p => p.effect === "brakes" || p.effect === "bigbrakes");
    const hasLower    = build.parts.some(p => ["lower","air","coilover"].includes(p.effect));
    const hasExhaust  = build.parts.some(p => p.effect === "exhaust");
    const hasSkirts   = build.parts.some(p => p.effect === "skirts") || hasWidebody;
    const hasSpacers  = build.parts.some(p => p.effect === "spacers") || hasWidebody;

    const rimSize  = build.parts.some(p => p.effect === "wheels19") ? 0.27
                   : build.parts.some(p => p.effect === "wheels18") ? 0.24
                   : 0.21;

    const carColor = new THREE.Color(build.carColor);
    bodyMat = new THREE.MeshStandardMaterial({ color: carColor, metalness: 0.7, roughness: 0.28 });
    const darkBodyMat = new THREE.MeshStandardMaterial({ color: carColor.clone().multiplyScalar(0.7), metalness: 0.7, roughness: 0.3 });
    const cfMat    = new THREE.MeshStandardMaterial({ color: 0x0f0f0f, metalness: 0.15, roughness: 0.65 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, metalness: 0.05, roughness: 0.05, transparent: true, opacity: 0.6 });
    const darkMat  = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
    const chrome   = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1.0, roughness: 0.05 });
    const lightMat = new THREE.MeshStandardMaterial({ color: hasLED ? 0xffffff : 0xffee88, emissive: hasLED ? 0xffffff : 0xffcc44, emissiveIntensity: hasLED ? 1.5 : 0.5 });
    const tailMat  = new THREE.MeshStandardMaterial({ color: 0xff1100, emissive: 0xff0000, emissiveIntensity: 0.6 });

    const hoodMat = hasCFHood ? cfMat : bodyMat;

    function box(w, h, d, mat, x, y, z, rx=0, ry=0, rz=0) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, rz);
        m.castShadow = true;
        carGroup.add(m);
        return m;
    }
    function cyl(rt, rb, h, seg, mat, x, y, z, rx=0, ry=0, rz=0) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, rz);
        m.castShadow = true;
        carGroup.add(m);
        return m;
    }

    // ── BODY ──
    // Main lower body
    box(4.0, 0.42, 1.72, bodyMat,    0,   -0.04, 0);
    // Rear lower (slightly narrower)
    box(1.1, 0.38, 1.65, darkBodyMat, -1.4, -0.04, 0);

    // Cabin – 3 segments to create a sloped silhouette
    // Center top
    box(1.55, 0.50, 1.58, bodyMat,  -0.10,  0.44, 0);
    // Front cabin slope (windshield base)
    box(0.80, 0.40, 1.56, bodyMat,   0.78,  0.33, 0, 0, 0, -0.40);
    // Rear cabin slope (backlight)
    box(0.65, 0.38, 1.56, bodyMat,  -0.95,  0.30, 0, 0, 0,  0.36);

    // Hood (flat-ish with slight slope)
    box(1.45, 0.10, 1.68, hoodMat,   1.08,  0.17, 0, 0, 0, -0.06);
    // Trunk deck
    box(0.90, 0.10, 1.65, bodyMat,  -1.60,  0.14, 0, 0, 0,  0.05);

    // ── ROOF ──
    box(1.50, 0.12, 1.48, bodyMat, -0.10, 0.70, 0);

    // ── GLASS ──
    // Windshield
    box(0.78, 0.44, 1.44, glassMat,  0.74, 0.42, 0, 0, 0, -0.52);
    // Rear window
    box(0.62, 0.40, 1.40, glassMat, -0.90, 0.39, 0, 0, 0,  0.50);
    // Side windows (two per side)
    [-0.82, 0.82].forEach(z => {
        box(0.52, 0.32, 0.04, glassMat, -0.02, 0.46, z);
        box(0.38, 0.28, 0.04, glassMat, -0.56, 0.44, z);
    });

    // ── A-PILLAR / C-PILLAR chrome trim ──
    [-0.76, 0.76].forEach(z => {
        box(2.8, 0.018, 0.018, chrome, 0, 0.22, z);
        box(0.018, 0.52, 0.018, chrome, 0.40, 0.42, z);
        box(0.018, 0.46, 0.018, chrome, -0.70, 0.38, z);
    });

    // ── BUMPERS ──
    box(0.18, 0.34, 1.66, darkMat,  2.04, -0.06, 0);
    box(0.18, 0.30, 1.66, darkMat, -2.04, -0.08, 0);

    // ── GRILLE ──
    box(0.06, 0.20, 0.82, darkMat, 2.10, -0.04, 0);
    for (let i = -2; i <= 2; i++) {
        box(0.04, 0.03, 0.78, chrome, 2.11, -0.04 + i*0.04, 0);
    }

    // ── HEADLIGHTS ──
    [-0.68, 0.68].forEach(z => {
        box(0.22, 0.12, 0.30, darkMat, 2.02, 0.10, z);
        box(0.05, 0.08, 0.24, lightMat, 2.07, 0.10, z);
        // DRL
        box(0.03, 0.025, 0.22, new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xffffff, emissiveIntensity: hasLED ? 2.5 : 0.4
        }), 2.07, 0.17, z);
    });

    // ── TAILLIGHTS ──
    [-0.66, 0.66].forEach(z => {
        box(0.05, 0.14, 0.26, tailMat, -2.07, 0.08, z);
        box(0.05, 0.025, 0.22, new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5
        }), -2.07, 0.18, z);
    });

    // ── DOOR SILLS ──
    box(2.60, 0.08, 1.74, darkMat, 0, -0.27, 0);

    // ── SIDE SKIRTS ──
    if (hasSkirts) {
        [-0.90, 0.90].forEach(z => box(2.40, 0.09, 0.055, darkMat, 0, -0.26, z));
    }

    // ── FRONT LIP ──
    if (hasLip) {
        box(0.06, 0.08, 1.58, darkMat, 2.12, -0.28, 0);
        box(0.40, 0.05, 1.58, darkMat, 1.92, -0.30, 0);
    }

    // ── REAR SPOILER ──
    if (hasSpoiler) {
        [-0.56, 0.56].forEach(z => box(0.26, 0.22, 0.05, darkMat, -1.80, 0.38, z));
        box(0.40, 0.05, 1.16, darkMat, -1.80, 0.52, 0, 0, 0, 0.12);
    }

    // ── WIDEBODY FENDERS ──
    if (hasWidebody) {
        [[1.18, 0.92], [1.18,-0.92], [-1.18, 0.92], [-1.18,-0.92]].forEach(([x,z]) => {
            box(0.55, 0.26, 0.10, bodyMat, x, -0.10, z > 0 ? 0.94 : -0.94);
        });
    }

    // ── CF HOOD VENTS ──
    if (hasCFHood) {
        [-0.2, 0.2].forEach(z => box(0.50, 0.025, 0.12, new THREE.MeshStandardMaterial({color:0x000000}), 1.10, 0.225, z));
    }

    // ── EXHAUST ──
    const exhPositions = hasExhaust ? [-0.28, 0.28] : [0];
    exhPositions.forEach(z => cyl(0.055, 0.055, 0.10, 12, chrome, -2.13, -0.28, z, Math.PI/2, 0, 0));

    // ── WHEELS ──
    const wOff = hasSpacers ? 0.10 : 0;
    const wY   = hasLower   ? -0.52 : -0.42;

    [[1.22, 0.91], [1.22,-0.91], [-1.22, 0.91], [-1.22,-0.91]].forEach(([wx, wz]) => {
        const side   = wz > 0 ? 1 : -1;
        const finalZ = wz + side * wOff;

        const wGroup = new THREE.Group();
        wGroup.position.set(wx, wY, finalZ);
        carGroup.add(wGroup);
        wheelMeshes.push(wGroup);

        const tireMat2 = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.92 });
        const rimColor = build.parts.some(p => p.name.includes("Forged")) ? 0xeeeeee
                       : build.parts.some(p => p.name.includes("Aftermarket")) ? 0x999999
                       : 0xbbbbbb;
        const rimMat2  = new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.9, roughness: 0.08 });

        // Outer tire ring — use cylinder, not torus. Much cleaner.
        const tireOuter = new THREE.Mesh(
            new THREE.CylinderGeometry(0.33, 0.33, 0.22, 28),
            tireMat2
        );
        tireOuter.rotation.x = Math.PI / 2;
        wGroup.add(tireOuter);

        // Inner tire wall
        const tireInner = new THREE.Mesh(
            new THREE.CylinderGeometry(0.21, 0.21, 0.24, 28),
            tireMat2
        );
        tireInner.rotation.x = Math.PI / 2;
        wGroup.add(tireInner);

        // Rim face (flat disc)
        const rimDisc = new THREE.Mesh(
            new THREE.CylinderGeometry(rimSize, rimSize, 0.10, 24),
            rimMat2
        );
        rimDisc.rotation.x = Math.PI / 2;
        rimDisc.position.z = side * 0.01;
        wGroup.add(rimDisc);

        // 5 spokes
        for (let i = 0; i < 5; i++) {
            const ang  = (i / 5) * Math.PI * 2;
            const spk  = new THREE.Mesh(new THREE.BoxGeometry(rimSize * 0.82, 0.042, 0.042), rimMat2);
            spk.rotation.z = ang;
            const sg = new THREE.Group();
            sg.rotation.x = Math.PI / 2;
            sg.add(spk);
            wGroup.add(sg);
        }

        // Center cap
        const capMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 10), chrome);
        capMesh.rotation.x = Math.PI / 2;
        wGroup.add(capMesh);

        // Brake disc (visible through spokes)
        const discMat2 = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.65, roughness: 0.4 });
        const discMesh = new THREE.Mesh(new THREE.CylinderGeometry(rimSize * 0.72, rimSize * 0.72, 0.032, 20), discMat2);
        discMesh.rotation.x = Math.PI / 2;
        discMesh.position.z = side * 0.03;
        wGroup.add(discMesh);

        if (hasBrakes) {
            const calColor = build.parts.some(p => p.name === "Powder Coated Calipers") ? 0xff3300 : 0xdd0000;
            const calMat   = new THREE.MeshStandardMaterial({ color: calColor, roughness: 0.4 });
            const cal      = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.175, 0.115), calMat);
            cal.position.set(0, 0.22, side * 0.04);
            wGroup.add(cal);
        }
    });

    carGroup.position.y = hasLower ? -0.10 : 0;
    scene.add(carGroup);
}

function animate3D() {
    requestAnimationFrame(animate3D);
    if (autoRotate && carGroup) carGroup.rotation.y += 0.004;
    wheelMeshes.forEach(w => { w.rotation.z += 0.015; });
    renderer.render(scene, camera);
}

function setCarColor(hex) {
    build.carColor = hex;
    document.querySelectorAll(".color-swatch").forEach(s => {
        s.classList.toggle("active", s.dataset.hex === hex);
    });
    document.getElementById("customColor").value = hex;

    if (glbLoaded && carGroup) {
        // Tint the GLB model by adjusting material colors
        const color = new THREE.Color(hex);
        carGroup.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    // Only tint materials that aren't very dark (windows, tires etc)
                    if (mat.color) {
                        const brightness = mat.color.r + mat.color.g + mat.color.b;
                        if (brightness > 0.4) {
                            mat.color.set(color);
                        }
                    }
                });
            }
        });
    } else {
        buildCarModel();
    }
}

function rotateLeft()  { if (carGroup) carGroup.rotation.y -= 0.35; }
function rotateRight() { if (carGroup) carGroup.rotation.y += 0.35; }
function toggleAutoRotate() {
    autoRotate = !autoRotate;
    document.getElementById("autoRotateBtn").innerHTML = autoRotate ? '<i data-lucide="pause"></i> Auto' : '<i data-lucide="play"></i> Auto'; if (window.refreshIcons) window.refreshIcons();
}

function initColorSwatches() {
    const row = document.getElementById("colorSwatches");
    row.innerHTML = "";
    PAINT_COLORS.forEach(c => {
        const btn = document.createElement("button");
        btn.classList.add("color-swatch");
        if (c.hex === build.carColor) btn.classList.add("active");
        btn.dataset.hex = c.hex;
        btn.style.background = c.hex;
        btn.title = c.name;
        btn.onclick = () => setCarColor(c.hex);
        row.appendChild(btn);
    });
    document.getElementById("customColor").value = build.carColor;
}

window.addEventListener("resize", () => {
    if (!renderer) return;
    const canvas = document.getElementById("carCanvas");
    const W = canvas.parentElement.clientWidth || 500;
    renderer.setSize(W, 300);
    camera.aspect = W / 300;
    camera.updateProjectionMatrix();
});
// ─── 2.5D SILHOUETTE ─────────────────────────────────────────────
const ZONES = {
    engine:     { label: "Engine",     x: 540, y: 140, w: 180, h: 80  },
    suspension: { label: "Suspension", x: 80,  y: 190, w: 640, h: 50  },
    exterior:   { label: "Body",       x: 120, y: 60,  w: 560, h: 160 },
    interior:   { label: "Interior",   x: 240, y: 80,  w: 240, h: 100 },
    wheels:     { label: "Wheels",     x: 80,  y: 210, w: 150, h: 80  },
};

function buildSilhouette() {
    const svg = document.getElementById("carSilhouette");
    const activeCategories = [...new Set(build.parts.map(p => p.category))];

    svg.innerHTML = `
    <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${build.carColor}" stop-opacity="1"/>
            <stop offset="100%" stop-color="${darken(build.carColor, 30)}" stop-opacity="1"/>
        </linearGradient>
        <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
    </defs>

    <!-- Shadow -->
    <ellipse cx="400" cy="285" rx="320" ry="18" fill="rgba(0,0,0,0.25)"/>

    <!-- Body lower -->
    <rect x="90" y="185" width="620" height="80" rx="16" fill="url(#bodyGrad)"/>

    <!-- Body upper / cabin -->
    <path d="M220,185 Q260,90 310,80 L500,80 Q560,82 590,185 Z" fill="url(#bodyGrad)"/>

    <!-- Hood -->
    <path d="M590,185 Q640,175 700,188 L710,245 L590,245 Z" fill="${darken(build.carColor, 15)}"/>

    <!-- Trunk -->
    <path d="M100,185 Q120,175 220,185 L220,245 L90,245 Z" fill="${darken(build.carColor, 20)}"/>

    <!-- Windshields -->
    <path d="M310,83 Q295,135 290,185 L430,185 L430,83 Z" fill="rgba(100,160,220,0.55)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <path d="M430,83 L430,185 L570,185 Q565,130 550,83 Z" fill="rgba(100,160,220,0.45)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>

    <!-- Side windows -->
    <rect x="295" y="88" width="125" height="80" rx="4" fill="rgba(80,130,190,0.4)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <rect x="428" y="88" width="115" height="80" rx="4" fill="rgba(80,130,190,0.35)" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>

    <!-- Wheels -->
    <circle cx="180" cy="255" r="48" fill="#111" stroke="#333" stroke-width="3"/>
    <circle cx="180" cy="255" r="30" fill="#888" stroke="#aaa" stroke-width="2"/>
    <circle cx="180" cy="255" r="10" fill="#ccc"/>
    <circle cx="620" cy="255" r="48" fill="#111" stroke="#333" stroke-width="3"/>
    <circle cx="620" cy="255" r="30" fill="#888" stroke="#aaa" stroke-width="2"/>
    <circle cx="620" cy="255" r="10" fill="#ccc"/>

    <!-- Headlights -->
    <rect x="700" y="210" width="30" height="16" rx="4" fill="${build.parts.some(p=>p.effect==='lights') ? '#ffffff' : '#ffe066'}" 
          ${build.parts.some(p=>p.effect==='lights') ? 'filter="url(#glow)"' : ''}/>
    <!-- Taillights -->
    <rect x="70" y="215" width="24" height="14" rx="3" fill="#ff2200" opacity="0.8"/>

    ${build.parts.some(p => p.effect === "lip") ? `
    <rect x="700" y="258" width="35" height="8" rx="3" fill="#222"/>` : ""}

    ${build.parts.some(p => p.effect === "spoiler" || p.effect === "widebody") ? `
    <rect x="68" y="175" width="55" height="8" rx="2" fill="#222"/>
    <rect x="60" y="163" width="70" height="6" rx="2" fill="#333"/>` : ""}

    ${build.parts.some(p => p.effect === "hood") ? `
    <path d="M590,185 Q640,175 700,188 L710,245 L590,245 Z" fill="#111"/>` : ""}

    ${build.parts.some(p => p.effect === "widebody") ? `
    <rect x="122" y="220" width="20" height="40" rx="4" fill="${build.carColor}" opacity="0.8"/>
    <rect x="658" y="220" width="20" height="40" rx="4" fill="${build.carColor}" opacity="0.8"/>` : ""}
    `;

    // Draw zone highlights
    Object.entries(ZONES).forEach(([cat, zone]) => {
        if (!activeCategories.includes(cat)) return;
        const meta  = CATEGORY_META[cat];
        const count = build.parts.filter(p => p.category === cat).length;
        const rect  = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x",       zone.x);
        rect.setAttribute("y",       zone.y);
        rect.setAttribute("width",   zone.w);
        rect.setAttribute("height",  zone.h);
        rect.setAttribute("rx",      "8");
        rect.setAttribute("fill",    meta.color);
        rect.setAttribute("opacity", "0.22");
        rect.setAttribute("stroke",  meta.color);
        rect.setAttribute("stroke-width", "2");
        rect.style.cursor = "pointer";

        // Badge
        const badge = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const cx = zone.x + zone.w / 2;
        const cy = zone.y + zone.h / 2;

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", cx); circle.setAttribute("cy", cy);
        circle.setAttribute("r", "18"); circle.setAttribute("fill", meta.color);
        circle.style.cursor = "pointer";

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", cx); text.setAttribute("y", cy + 5);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#fff");
        text.setAttribute("font-size", "14");
        text.setAttribute("font-weight", "bold");
        text.setAttribute("pointer-events", "none");
        text.textContent = count;

        // Tooltip on hover
        [rect, circle].forEach(el => {
            el.addEventListener("mouseenter", (e) => showSilTooltip(cat, e));
            el.addEventListener("mouseleave", hideSilTooltip);
        });

        badge.appendChild(circle);
        badge.appendChild(text);
        svg.appendChild(rect);
        svg.appendChild(badge);
    });

    buildSilLegend(activeCategories);
}

function showSilTooltip(cat, e) {
    const tt    = document.getElementById("silhouetteTooltip");
    const parts = build.parts.filter(p => p.category === cat);
    const meta  = CATEGORY_META[cat];
    tt.style.display = "block";
    tt.innerHTML = `<strong style="color:${meta.color}"><i data-lucide="${meta.icon}"></i> ${meta.label}</strong><br>` +
        parts.map(p => `• ${esc(p.name)} — $${p.cost.toLocaleString()}`).join("<br>");
    const svg = document.getElementById("carSilhouette");
    const rect = svg.getBoundingClientRect();
    tt.style.left = Math.min(e.clientX - rect.left + 10, rect.width - 200) + "px";
    tt.style.top  = (e.clientY - rect.top - 60) + "px";
    if (window.refreshIcons) window.refreshIcons();
}
function hideSilTooltip() {
    document.getElementById("silhouetteTooltip").style.display = "none";
}

function buildSilLegend(activeCategories) {
    const legend = document.getElementById("silLegend");
    if (activeCategories.length === 0) {
        legend.innerHTML = `<span style="color:var(--text-muted);font-size:13px;">Add parts to see highlights on the car</span>`;
        return;
    }
    legend.innerHTML = activeCategories.map(cat => {
        const meta  = CATEGORY_META[cat];
        const count = build.parts.filter(p => p.category === cat).length;
        return `<span class="sil-legend-item" style="border-color:${meta.color};color:${meta.color}">
            <i data-lucide="${meta.icon}"></i> ${meta.label} <strong>${count}</strong>
        </span>`;
    }).join("");
    if (window.refreshIcons) window.refreshIcons();
}

function darken(hex, amount) {
    let r = parseInt(hex.slice(1,3),16);
    let g = parseInt(hex.slice(3,5),16);
    let b = parseInt(hex.slice(5,7),16);
    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);
    return `rgb(${r},${g},${b})`;
}

// ─── PART CARDS (illustrated) ────────────────────────────────────
function renderPresets(category) {
    const grid = document.getElementById(`presets-${category}`);
    grid.innerHTML = "";
    PRESETS[category].forEach(preset => {
        const card = document.createElement("div");
        card.classList.add("part-card");
        card.id = `preset-${category}-${preset.name.replace(/\W/g,"_")}`;
        card.innerHTML = `
            <div class="part-card-icon"><i data-lucide="${preset.icon}"></i></div>
            <div class="part-card-body">
                <div class="part-card-name">${preset.name}</div>
                <div class="part-card-desc">${preset.desc}</div>
            </div>
            <div class="part-card-footer">
                <span class="part-card-cost">$${preset.cost.toLocaleString()}</span>
                <button class="part-card-add">+ Add</button>
            </div>
        `;
        const addBtn = card.querySelector(".part-card-add");
        addBtn.addEventListener("click", () => addPreset(category, preset.name, preset.cost, preset.effect, preset.icon, addBtn));
        grid.appendChild(card);
    });
    if (window.refreshIcons) window.refreshIcons();
}

// ─── Add / Remove Parts ───────────────────────────────────────────
function addPreset(category, name, cost, effect, icon, btn) {
    const id = ++partIdCounter;
    build.parts.push({ id, category, name, cost: Number(cost), effect, icon });
    btn.innerHTML   = '<i data-lucide="check"></i> Added';
    btn.disabled    = true;
    btn.classList.add("added");
    renderAddedPart(category, id, name, Number(cost), icon);
    refreshVisuals();
    if (window.refreshIcons) window.refreshIcons();
}

function addCustomPart(category) {
    const nameInput = document.getElementById(`customName-${category}`);
    const costInput = document.getElementById(`customCost-${category}`);
    const name = nameInput.value.trim();
    const cost = parseFloat(costInput.value) || 0;
    if (!name) { nameInput.focus(); return; }
    const id = ++partIdCounter;
    build.parts.push({ id, category, name, cost, effect: "custom", icon: "wrench" });
    renderAddedPart(category, id, name, cost, "wrench");
    nameInput.value = "";
    costInput.value = "";
    refreshVisuals();
}

function removePart(id) {
    const part = build.parts.find(p => p.id === id);
    if (!part) return;
    // re-enable preset card button
    const cardId = `preset-${part.category}-${part.name.replace(/\W/g,"_")}`;
    const card   = document.getElementById(cardId);
    if (card) {
        const btn = card.querySelector(".part-card-add");
        if (btn) { btn.textContent = "+ Add"; btn.disabled = false; btn.classList.remove("added"); }
    }
    build.parts = build.parts.filter(p => p.id !== id);
    document.getElementById(`part-${id}`)?.remove();
    refreshVisuals();
}

function renderAddedPart(category, id, name, cost, icon) {
    const container = document.getElementById(`added-${category}`);
    const div = document.createElement("div");
    div.classList.add("added-part");
    div.id = `part-${id}`;
    div.innerHTML = `
        <span class="added-part-icon"><i data-lucide="${icon}"></i></span>
        <span class="added-part-name">${esc(name)}</span>
        <span class="added-part-cost">$${cost.toLocaleString()}</span>
        <button class="remove-part-btn" onclick="removePart(${id})" title="Remove"><i data-lucide="x"></i></button>
    `;
    container.appendChild(div);
    if (window.refreshIcons) window.refreshIcons();
}

function refreshVisuals() {
    if (!glbLoaded) {
        // Only rebuild box car if no real GLB is showing
        buildCarModel();
    }
    // Always update silhouette and summary
    buildSilhouette();
    updateSummary();
}

// ─── Base Vehicle Dropdowns ──────────────────────────────────────
async function initYearDropdown() {
    const res   = await fetch("/api/vehicle_years");
    const years = await res.json();
    const sel   = document.getElementById("baseYear");
    sel.innerHTML = `<option value="">— Year —</option>`;
    years.forEach(y => {
        const opt = document.createElement("option");
        opt.value = y; opt.textContent = y;
        sel.appendChild(opt);
    });
}

async function onYearChange() {
    const year = document.getElementById("baseYear").value;
    const makeSel = document.getElementById("baseMake");
    makeSel.innerHTML = `<option value="">Loading makes…</option>`;
    makeSel.disabled  = true;
    resetDropdown("baseModel", "— Select make first —");
    resetDropdown("baseTrim",  "— Select model first —");
    clearBaseVehicle(true);

    if (!year) { makeSel.innerHTML = `<option value="">— Select year first —</option>`; return; }

    const res   = await fetch(`/api/vehicle_makes?year=${year}`);
    const makes = await res.json();
    makeSel.innerHTML = `<option value="">— Make —</option>`;
    makes.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m; opt.textContent = m;
        makeSel.appendChild(opt);
    });
    makeSel.disabled = false;
}

async function onMakeChange() {
    const year = document.getElementById("baseYear").value;
    const make = document.getElementById("baseMake").value;
    resetDropdown("baseModel", "Loading models…");
    resetDropdown("baseTrim",  "— Select model first —");
    clearBaseVehicle(true);

    if (!make) return;

    const res    = await fetch(`/api/vehicle_models?make=${encodeURIComponent(make)}&year=${year}`);
    const models = await res.json();
    const sel    = document.getElementById("baseModel");
    sel.innerHTML = `<option value="">— Model —</option>`;
    models.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
    });
    sel.disabled = models.length === 0;
    if (models.length === 0) sel.innerHTML = `<option value="">No models found</option>`;
}

async function onModelChange() {
    const year  = document.getElementById("baseYear").value;
    const make  = document.getElementById("baseMake").value;
    const model = document.getElementById("baseModel").value;
    resetDropdown("baseTrim", "Loading trims…");
    clearBaseVehicle(true);

    if (!model) return;

    const res   = await fetch(`/api/vehicle_trims?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`);
    const trims = await res.json();
    const sel   = document.getElementById("baseTrim");
    sel.innerHTML = `<option value="">— Trim —</option>`;
    trims.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t; opt.textContent = t;
        sel.appendChild(opt);
    });
    sel.disabled = false;
}

async function onTrimChange() {
    const year  = document.getElementById("baseYear").value;
    const make  = document.getElementById("baseMake").value;
    const model = document.getElementById("baseModel").value;
    const trim  = document.getElementById("baseTrim").value;
    if (!year || !make || !model) return;

    // Estimate price
    const priceDisplay = document.getElementById("basePriceDisplay");
    priceDisplay.textContent = "Estimating…";
    const res  = await fetch(`/api/estimate_price?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}&trim=${encodeURIComponent(trim)}`);
    const data = await res.json();
    const price = data.price || 0;

    document.getElementById("basePrice").value = price;
    priceDisplay.textContent = `~$${price.toLocaleString()}`;
    priceDisplay.style.color = "var(--blue)";
    priceDisplay.style.fontWeight = "700";

    // Auto-set the vehicle
    setBaseVehicle();
}

function setBaseVehicle() {
    const year  = document.getElementById("baseYear").value;
    const make  = document.getElementById("baseMake").value;
    const model = document.getElementById("baseModel").value;
    const trim  = document.getElementById("baseTrim").value;
    const price = parseFloat(document.getElementById("basePrice").value) || 0;
    if (!year || !make || !model) return;

    build.baseVehicle = { year, make, model, trim };
    build.basePrice   = price;

    const d = document.getElementById("baseVehicleDisplay");
    d.style.display = "flex";
    d.innerHTML = `
        <div class="base-vehicle-info">
            <span class="base-vehicle-name">${year} ${make} ${model}${trim ? " " + trim : ""}</span>
            <span class="base-vehicle-price">Est. Base: $${price.toLocaleString()}</span>
        </div>
    `;

    // Show the Generate 3D button
    const wrap = document.getElementById("generate3dWrap");
    if (wrap) {
        wrap.style.display = "block";
        // Auto-check cache so user knows if it's free
        const status = document.getElementById("generate3dStatus");
        const btn    = document.getElementById("generate3dBtn");
        status.style.display = "block";
        status.className     = "generate3d-status loading";
        status.textContent   = "Checking if 3D model is cached…";
        // Check cache and balance in parallel
        Promise.all([
            fetch(`/api/check_model_cache?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`).then(r => r.json()),
            fetch("/api/tripo_balance").then(r => r.json())
        ]).then(([cacheData, balData]) => {
            const balance = balData.balance || 0;
            if (cacheData.cached) {
                status.className = "generate3d-status success";
                status.innerHTML = '<i data-lucide="check-circle"></i> 3D model cached — click to load free!'; if (window.refreshIcons) window.refreshIcons();
                btn.innerHTML = '<i data-lucide="sparkles"></i> Load 3D Model (Free — Cached)'; if (window.refreshIcons) window.refreshIcons();
                btn.disabled = false;
                btn.dataset.cached = "true";
                btn.dataset.year   = year;
                btn.dataset.make   = make;
                btn.dataset.model  = model;
            } else if (balance < 20) {
                // No credits + no cache → fall back to a real vehicle photo
                status.className = "generate3d-status info";
                status.innerHTML = `<i data-lucide="image"></i> Showing vehicle photo (${balance} Tripo credits — <a href="https://platform.tripo3d.ai" target="_blank" style="color:var(--accent)">top up</a> to generate 3D)`;
                if (window.refreshIcons) window.refreshIcons();
                btn.innerHTML = '<i data-lucide="sparkles"></i> Generate 3D Model (Need Credits)';
                if (window.refreshIcons) window.refreshIcons();
                btn.disabled = true;
                // Load a real photo into the canvas area
                loadVehiclePhoto(year, make, model);
            } else {
                status.className = "generate3d-status info";
                status.innerHTML = `<i data-lucide="lightbulb"></i> Will use ~20 of your ${balance} credits to generate`; if (window.refreshIcons) window.refreshIcons();
                btn.innerHTML = '<i data-lucide="sparkles"></i> Generate 3D Model (~20 credits)'; if (window.refreshIcons) window.refreshIcons();
                btn.disabled = false;
                btn.dataset.cached = "false";
                // Still show a photo while they decide
                loadVehiclePhoto(year, make, model);
            }
        });
    }

    updateSummary();
}

function clearBaseVehicle(silent = false) {
    build.baseVehicle = null;
    build.basePrice   = 0;
    document.getElementById("baseVehicleDisplay").style.display = "none";
    document.getElementById("basePrice").value = "0";
    const pd = document.getElementById("basePriceDisplay");
    if (pd) { pd.textContent = "Select a vehicle above"; pd.style.color = ""; pd.style.fontWeight = ""; }
    if (!silent) updateSummary();
}

function resetDropdown(id, placeholder) {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    sel.disabled  = true;
}

// ─── Summary ──────────────────────────────────────────────────────
function updateSummary() {
    const modTotal   = build.parts.reduce((s, p) => s + p.cost, 0);
    const grandTotal = build.basePrice + modTotal;
    document.getElementById("summaryBase").textContent  = `$${build.basePrice.toLocaleString()}`;
    document.getElementById("summaryMods").textContent  = `$${modTotal.toLocaleString()}`;
    document.getElementById("summaryTotal").textContent = `$${grandTotal.toLocaleString()}`;
    document.getElementById("partCount").textContent    = `${build.parts.length} part${build.parts.length !== 1 ? "s" : ""}`;

    const grouped = {};
    build.parts.forEach(p => { if (!grouped[p.category]) grouped[p.category] = []; grouped[p.category].push(p); });

    const list = document.getElementById("summaryList");
    list.innerHTML = "";
    if (build.parts.length === 0) {
        list.innerHTML = `<p style="color:var(--text-muted);font-size:14px;padding:4px 0;">Add parts to see breakdown.</p>`;
        return;
    }
    Object.entries(grouped).forEach(([cat, parts]) => {
        const meta     = CATEGORY_META[cat];
        const catTotal = parts.reduce((s, p) => s + p.cost, 0);
        const block    = document.createElement("div");
        block.classList.add("summary-category");
        block.innerHTML = `
            <div class="summary-cat-header" style="border-color:${meta.color}20;">
                <span style="color:${meta.color}"><i data-lucide="${meta.icon}"></i> ${meta.label}</span>
                <span>$${catTotal.toLocaleString()}</span>
            </div>
            ${parts.map(p => `<div class="summary-part-row"><span><i data-lucide="${esc(p.icon)}"></i> ${esc(p.name)}</span><span>$${p.cost.toLocaleString()}</span></div>`).join("")}
        `;
        list.appendChild(block);
    });
    if (window.refreshIcons) window.refreshIcons();
}

// ─── Section builder ─────────────────────────────────────────────
function buildSections() {
    const container = document.getElementById("categorySections");
    container.innerHTML = "";
    Object.entries(CATEGORY_META).forEach(([key, meta]) => {
        const section = document.createElement("div");
        section.classList.add("builder-section");
        section.id = `section-${key}`;
        section.innerHTML = `
            <div class="builder-section-header" onclick="toggleSection('${key}')" style="border-left: 3px solid ${meta.color};">
                <span><i data-lucide="${meta.icon}"></i> ${meta.label}</span>
                <span class="section-toggle" id="toggle-${key}"><i data-lucide="chevron-down"></i></span>
            </div>
            <div class="builder-section-body" id="body-${key}" style="display:none;">
                <div class="preset-grid" id="presets-${key}"></div>
                <div class="custom-part-row">
                    <input id="customName-${key}" placeholder="Custom part…" class="custom-input">
                    <input id="customCost-${key}" placeholder="Cost ($)" type="number" min="0" class="custom-cost-input">
                    <button class="btn btn-primary" onclick="addCustomPart('${key}')">+ Add</button>
                </div>
                <div class="added-parts" id="added-${key}"></div>
            </div>
        `;
        container.appendChild(section);
        renderPresets(key);
    });
    if (window.refreshIcons) window.refreshIcons();
}

function toggleSection(key) {
    const body   = document.getElementById(`body-${key}`);
    const toggle = document.getElementById(`toggle-${key}`);
    if (!body) return;
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "block";
    toggle.innerHTML = open ? '<i data-lucide="chevron-right"></i>' : '<i data-lucide="chevron-down"></i>';
    if (window.refreshIcons) window.refreshIcons();
}

// ─── Save / Load Builds ───────────────────────────────────────────
async function saveBuild() {
    const name = document.getElementById("buildName").value.trim();
    if (!name) { document.getElementById("buildName").focus(); alert("Name your build first."); return; }
    if (!build.baseVehicle) { alert("Set a base vehicle first."); return; }
    build.name = name;
    const res = await csrfFetch("/save_build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(build)
    });
    if (res.ok) { alert("Build saved!"); loadSavedBuilds(); }
    else { const d = await res.json().catch(()=>({})); alert(d.error || "Could not save."); }
}

async function loadSavedBuilds() {
    const res    = await fetch("/get_builds");
    if (!res.ok) return;
    const builds = await res.json();
    const container = document.getElementById("savedBuilds");
    if (builds.length === 0) {
        container.innerHTML = `<p class="empty-state" style="padding:8px 0;">No saved builds yet.</p>`;
        return;
    }
    container.innerHTML = "";
    builds.forEach(b => {
        const parts    = JSON.parse(b.parts_json || "[]");
        const modTotal = parts.reduce((s, p) => s + p.cost, 0);
        const grand    = (b.base_price || 0) + modTotal;
        const card     = document.createElement("div");
        card.classList.add("saved-build-card");
        card.innerHTML = `
            <div class="saved-build-info">
                <div class="saved-build-name">${esc(b.name)}</div>
                <div class="saved-build-vehicle">${esc(b.base_year)} ${esc(b.base_make)} ${esc(b.base_model)}</div>
                <div class="saved-build-stats">
                    <span>${parts.length} parts</span>
                    <span>Mods: $${modTotal.toLocaleString()}</span>
                    <span class="saved-build-total">Total: $${grand.toLocaleString()}</span>
                </div>
            </div>
            <div class="saved-build-actions">
                <button class="btn btn-ghost" onclick="loadBuild(${b.id})">Load</button>
                <button class="btn btn-ghost" onclick="cloneBuild(${b.id})" title="Clone this build"><i data-lucide="copy"></i></button>
                <button class="btn btn-ghost" onclick="shareBuildToFeed(${b.id})" title="Share to feed"><i data-lucide="share-2"></i></button>
                <button class="btn btn-danger" onclick="deleteBuild(${b.id})">Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
}

async function cloneBuild(id) {
    const res  = await csrfFetch(`/api/clone_build/${id}`, { method: "POST" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    loadSavedBuilds();
    if (window.lucide) lucide.createIcons();
}

async function shareBuildToFeed(id) {
    const res  = await csrfFetch(`/api/share_build/${id}`, { method: "POST" });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    alert("Build shared to your feed!");
}

async function loadBuild(id) {
    const res  = await fetch(`/get_build/${id}`);
    const data = await res.json();
    clearBuild(true);
    document.getElementById("buildName").value = data.name || "";
    if (data.base_year) {
        // Restore dropdowns for saved build
        const yr   = data.base_year;
        const make = data.base_make;
        const model = data.base_model;
        const trim = data.base_trim || "";
        const price = data.base_price || 0;

        document.getElementById("baseYear").value  = yr;
        await onYearChange();
        document.getElementById("baseMake").value  = make;
        await onMakeChange();
        document.getElementById("baseModel").value = model;
        await onModelChange();
        document.getElementById("baseTrim").value  = trim;
        document.getElementById("basePrice").value = price;

        const pd = document.getElementById("basePriceDisplay");
        if (pd) { pd.textContent = `~$${Number(price).toLocaleString()}`; pd.style.color = "var(--blue)"; pd.style.fontWeight = "700"; }
        setBaseVehicle();
    }
    JSON.parse(data.parts_json || "[]").forEach(p => {
        const id2 = ++partIdCounter;
        build.parts.push({ id: id2, ...p });
        renderAddedPart(p.category, id2, p.name, p.cost, p.icon || "wrench");
        // mark preset card as added if it matches
        const cardId = `preset-${p.category}-${p.name.replace(/\W/g,"_")}`;
        const card   = document.getElementById(cardId);
        if (card) {
            const btn = card.querySelector(".part-card-add");
            if (btn) { btn.innerHTML = '<i data-lucide="check"></i> Added'; btn.disabled = true; btn.classList.add("added"); if (window.refreshIcons) window.refreshIcons(); }
        }
    });
    refreshVisuals();
}

async function deleteBuild(id) {
    if (!confirm("Delete this build?")) return;
    await csrfFetch(`/delete_build/${id}`, { method: "POST" });
    loadSavedBuilds();
}

function clearBuild(silent = false) {
    if (!silent && !confirm("Clear everything?")) return;
    build.parts = []; build.baseVehicle = null; build.basePrice = 0;
    build.carColor = "#1a1a1a"; partIdCounter = 0;
    document.getElementById("buildName").value = "";
    glbLoaded = false;  // Reset GLB flag so box car shows
    // Reset all dropdowns
    document.getElementById("baseYear").value  = "";
    resetDropdown("baseMake",  "— Select year first —");
    resetDropdown("baseModel", "— Select make first —");
    resetDropdown("baseTrim",  "— Select model first —");
    clearBaseVehicle(true);
    Object.keys(PRESETS).forEach(cat => {
        document.getElementById(`added-${cat}`).innerHTML = "";
        ["customName","customCost"].forEach(f => document.getElementById(`${f}-${cat}`).value = "");
        document.querySelectorAll(`#presets-${cat} .part-card-add`).forEach(btn => {
            btn.textContent = "+ Add"; btn.disabled = false; btn.classList.remove("added");
        });
    });
    initColorSwatches();
    refreshVisuals();
}

function esc(str) {
    if (str == null) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ─── Vehicle Photo Fallback ────────────────────────────────────────
// Shown when no Tripo credits or model is cached
async function loadVehiclePhoto(year, make, model) {
    try {
        const params = new URLSearchParams({ type: "car", make, model, year,
            q: `${year} ${make} ${model}` });
        const res  = await fetch(`/api/vehicle_image?${params}`);
        const data = await res.json();
        if (!data.url) return; // keep box car if no photo found

        const canvas = document.querySelector("#carCanvas");
        if (!canvas) return;
        const wrap = canvas.parentElement;

        // Overlay the photo on top of the canvas without removing the 3D scene
        let overlay = document.getElementById("builderPhotoOverlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "builderPhotoOverlay";
            overlay.style.cssText = `
                position:absolute; inset:0; border-radius:12px; overflow:hidden;
                background:#0a0a12; display:flex; align-items:center; justify-content:center;
                z-index:2;
            `;
            wrap.style.position = "relative";
            wrap.appendChild(overlay);
        }
        overlay.innerHTML = `
            <img src="${data.url}" alt="${year} ${make} ${model}"
                 style="max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;"
                 onerror="this.parentElement.remove()">
            <div style="position:absolute;bottom:8px;right:10px;font-size:11px;color:#fff8;
                        background:#0006;padding:2px 6px;border-radius:4px;">
                📷 Photo preview
            </div>`;
    } catch(e) { /* silently fall back to box car */ }
}

// Call this when a 3D model loads to hide the photo overlay
function hideVehiclePhoto() {
    const overlay = document.getElementById("builderPhotoOverlay");
    if (overlay) overlay.remove();
}

// ─── Boot ────────────────────────────────────────────────────────
// ─── Tripo3D Integration ──────────────────────────────────────────
let _pollInterval = null;

async function trigger3DGeneration() {
    if (!build.baseVehicle) return;

    const btn    = document.getElementById("generate3dBtn");
    const status = document.getElementById("generate3dStatus");
    const { year, make, model } = build.baseVehicle;

    // Check cache first — free if already exists
    status.style.display = "block";
    status.className     = "generate3d-status loading";
    status.textContent   = "Checking cache…";
    btn.disabled         = true;

    const cacheRes  = await fetch(`/api/check_model_cache?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const cacheData = await cacheRes.json();

    if (cacheData.cached) {
        status.className = "generate3d-status loading";
        status.textContent = "Loading 3D model…";
        // Use proxy route to avoid CORS issues with Tripo CDN
        const proxyUrl = `/api/proxy_glb?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
        status.className = "generate3d-status success";
        status.innerHTML = '<i data-lucide="check-circle"></i> Loading from cache — no credits used!'; if (window.refreshIcons) window.refreshIcons();
        load3DModel(proxyUrl);
        btn.disabled = false;
        return;
    }

    // Not cached — generate new model
    status.innerHTML = '<i data-lucide="sparkles"></i> Generating 3D model… (this takes ~30-60s)'; if (window.refreshIcons) window.refreshIcons();

    const res  = await csrfFetch("/api/generate_3d", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ year, make, model, color: build.carColor })
    });
    const data = await res.json();

    if (data.status === "cached") {
        status.className = "generate3d-status success";
        status.innerHTML = '<i data-lucide="check-circle"></i> Loaded from cache!'; if (window.refreshIcons) window.refreshIcons();
        load3DModel(data.glb_url);
        btn.disabled = false;
        return;
    }

    if (data.error) {
        status.className = "generate3d-status error";
        status.innerHTML = '<i data-lucide="x-circle"></i> ' + data.error; if (window.refreshIcons) window.refreshIcons();
        btn.disabled = false;
        return;
    }

    // Poll for completion
    const taskId   = data.task_id;
    const cacheKey = data.cache_key;
    let   attempts = 0;

    _pollInterval = setInterval(async () => {
        attempts++;
        if (attempts > 60) {  // 5 min timeout
            clearInterval(_pollInterval);
            status.className = "generate3d-status error";
            status.innerHTML = '<i data-lucide="x-circle"></i> Timed out. Try again.'; if (window.refreshIcons) window.refreshIcons();
            btn.disabled = false;
            return;
        }

        const pollRes  = await fetch(`/api/poll_3d/${taskId}?cache_key=${encodeURIComponent(cacheKey)}`);
        const pollData = await pollRes.json();

        if (pollData.status === "success") {
            clearInterval(_pollInterval);
            status.className = "generate3d-status success";
            status.innerHTML = '<i data-lucide="check-circle"></i> 3D model generated and cached!'; if (window.refreshIcons) window.refreshIcons();
            // Use proxy to avoid CORS
            const proxyUrl = `/api/proxy_glb?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
            load3DModel(proxyUrl);
            btn.disabled = false;
        } else if (pollData.status === "failed") {
            clearInterval(_pollInterval);
            status.className = "generate3d-status error";
            status.innerHTML = '<i data-lucide="x-circle"></i> Generation failed. Try again.'; if (window.refreshIcons) window.refreshIcons();
            btn.disabled = false;
        } else {
            const prog = pollData.progress || 0;
            status.innerHTML = `<i data-lucide="sparkles"></i> Generating… ${prog}%`; if (window.refreshIcons) window.refreshIcons();
        }
    }, 5000);  // poll every 5 seconds
}

function load3DModel(glbUrl) {
    if (!glbUrl || !scene) {
        console.error("load3DModel: missing glbUrl or scene", { glbUrl, scene });
        return;
    }

    console.log("Loading GLB:", glbUrl);

    const status = document.getElementById("generate3dStatus");

    function doLoad() {
        if (!THREE.GLTFLoader) {
            console.error("GLTFLoader not available");
            if (status) { status.className = "generate3d-status error"; status.innerHTML = '<i data-lucide="x-circle"></i> GLTFLoader not loaded'; if (window.refreshIcons) window.refreshIcons(); }
            return;
        }

        const loader = new THREE.GLTFLoader();
        loader.load(
            glbUrl,
            (gltf) => {
                // Remove existing car model
                if (carGroup) { scene.remove(carGroup); carGroup = null; }

                carGroup = gltf.scene;

                // Center and scale the model to fit the viewer
                const box    = new THREE.Box3().setFromObject(carGroup);
                const center = box.getCenter(new THREE.Vector3());
                const size   = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale  = 3.5 / maxDim;

                carGroup.scale.setScalar(scale);
                carGroup.position.copy(center.multiplyScalar(-scale));
                carGroup.position.y -= 0.3;

                // Add to scene
                scene.add(carGroup);
                autoRotate  = true;
                glbLoaded   = true;  // Mark GLB as active
                hideVehiclePhoto();  // Remove photo overlay now that 3D is loaded

                if (status) { status.className = "generate3d-status success"; status.innerHTML = '<i data-lucide="check-circle"></i> 3D model loaded!'; if (window.refreshIcons) window.refreshIcons(); }
                console.log("✅ GLB loaded successfully");
            },
            (progress) => {
                const pct = Math.round((progress.loaded / (progress.total || 1)) * 100);
                if (status) status.textContent = `Loading model… ${pct}%`;
            },
            (err) => {
                console.error("GLB load error:", err);
                if (status) { status.className = "generate3d-status error"; status.innerHTML = '<i data-lucide="x-circle"></i> Failed to load model. The URL may have expired — try regenerating.'; if (window.refreshIcons) window.refreshIcons(); }
            }
        );
    }

    // GLTFLoader may still be loading — wait for it
    if (THREE.GLTFLoader) {
        doLoad();
    } else {
        const check = setInterval(() => {
            if (THREE.GLTFLoader) { clearInterval(check); doLoad(); }
        }, 100);
        setTimeout(() => clearInterval(check), 5000);
    }
}

buildSections();
initYearDropdown();
init3D();
initColorSwatches();
buildSilhouette();
updateSummary();
loadSavedBuilds();

window.addEventListener("resize", () => {
    if (!renderer) return;
    const canvas = document.getElementById("carCanvas");
    const W = canvas.parentElement.clientWidth || 500;
    renderer.setSize(W, 280);
    camera.aspect = W / 280;
    camera.updateProjectionMatrix();
});