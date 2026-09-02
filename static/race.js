// ═══════════════════════════════════════════════════════════════
//  RideInsight Race Engine
//  Drag Race | Player vs AI + Player vs User Build
// ═══════════════════════════════════════════════════════════════

// ─── State ────────────────────────────────────────────────────────
const raceMode     = "drag";   // Drag is the only mode. Track Race removed pre-launch.
let opponentType   = "ai";     // "ai"   | "user"
let playerBuild    = null;
let opponentBuild  = null;
let raceRunning    = false;
let animFrame      = null;

// ─── AI Builds ───────────────────────────────────────────────────
const AI_BUILDS = {
    easy: {
        name: "Stock Daily Driver",
        car: "2019 Honda Civic",
        parts: [],
        basePrice: 22000,
        carColor: "#c0392b"
    },
    medium: {
        name: "Lightly Modded Camry",
        car: "2020 Toyota Camry",
        parts: [
            { name:"Cold Air Intake", cost:250, effect:"intake" },
            { name:"Performance Exhaust", cost:800, effect:"exhaust" },
            { name:"ECU Tune", cost:600, effect:"ecu" },
        ],
        basePrice: 26000,
        carColor: "#2980b9"
    },
    hard: {
        name: "Full Street Build",
        car: "2020 Ford Mustang",
        parts: [
            { name:"Turbocharger Kit", cost:3500, effect:"turbo" },
            { name:"ECU Tune", cost:600, effect:"ecu" },
            { name:"Performance Exhaust", cost:800, effect:"exhaust" },
            { name:"Intercooler Upgrade", cost:700, effect:"intercooler" },
            { name:"Coilover Kit", cost:1200, effect:"lower" },
            { name:"Performance Headers", cost:900, effect:"exhaust" },
        ],
        basePrice: 35000,
        carColor: "#8e44ad"
    },
    insane: {
        name: "Street Monster",
        car: "2021 Dodge Charger",
        parts: [
            { name:"Supercharger Kit", cost:4500, effect:"turbo" },
            { name:"ECU Tune", cost:600, effect:"ecu" },
            { name:"Performance Exhaust", cost:800, effect:"exhaust" },
            { name:"Intercooler Upgrade", cost:700, effect:"intercooler" },
            { name:"Performance Headers", cost:900, effect:"exhaust" },
            { name:"Upgraded Fuel Injectors", cost:500, effect:"ecu" },
            { name:"Coilover Kit", cost:1200, effect:"lower" },
            { name:"Sway Bar Kit", cost:300, effect:"handling" },
            { name:"Racing Seats", cost:1500, effect:"seats" },
            { name:"Big Brake Kit", cost:3000, effect:"bigbrakes" },
        ],
        basePrice: 42000,
        carColor: "#e67e22"
    }
};

// ─── Performance Calculator ───────────────────────────────────────
function calcStats(build) {
    if (!build) return { hp: 150, handling: 50, braking: 50, weight: 1.0, nitro: 1 };

    const parts = build.parts || [];

    // Start from the body's own numbers rather than a flat 180 for everything —
    // otherwise an M3 and a Mazda 6 race identically once you strip the mods.
    // The vehicle key is recorded in the build as a "vehicle" part.
    const vehiclePart = parts.find(p => p.category === "vehicle");
    const base = (typeof baseStatsFor === "function")
        ? baseStatsFor(vehiclePart && vehiclePart.name)
        : { hp: 180, handling: 50, braking: 50, weight: 1.0 };

    let hp       = base.hp;
    let handling = base.handling;
    let braking  = base.braking;
    let weight   = base.weight;   // multiplier (lower = faster)
    let nitro    = 1;

    parts.forEach(p => {
        // Infer effect from part name if missing (for older saves)
        let e = p.effect || "";
        if (!e) {
            const n = (p.name || "").toLowerCase();
            if (n.includes("turbo") || n.includes("supercharger"))  e = "turbo";
            else if (n.includes("intake"))                           e = "intake";
            else if (n.includes("exhaust") || n.includes("header")) e = "exhaust";
            else if (n.includes("ecu") || n.includes("tune") || n.includes("injector")) e = "ecu";
            else if (n.includes("intercooler"))                      e = "intercooler";
            else if (n.includes("coilover") || n.includes("spring") || n.includes("shock")) e = "lower";
            else if (n.includes("sway") || n.includes("brace") || n.includes("bushing") || n.includes("camber") || n.includes("control arm")) e = "handling";
            else if (n.includes("big brake"))                        e = "bigbrakes";
            else if (n.includes("brake"))                            e = "brakes";
            else if (n.includes("seat"))                             e = "seats";
            else if (n.includes("roll cage"))                        e = "cage";
            else if (n.includes("widebody"))                         e = "widebody";
            else if (n.includes("air suspension"))                   e = "air";
            else if (n.includes('19"') || n.includes('19 inch'))   e = 'wheels19';
            else if (n.includes('18"') || n.includes('18 inch'))   e = 'wheels18';
            else if (n.includes("tire") || n.includes("tyre"))      e = "tires";
        }

        if (e === "turbo")       { hp += 180; }
        if (e === "intake")      { hp += 25; }
        if (e === "exhaust")     { hp += 35; }
        if (e === "ecu")         { hp += 45; }
        if (e === "intercooler") { hp += 30; }
        if (e === "lower")       { handling += 18; braking += 10; }
        if (e === "handling")    { handling += 20; }
        if (e === "bigbrakes")   { braking += 30; }
        if (e === "brakes")      { braking += 18; }
        if (e === "seats")       { weight -= 0.04; }
        if (e === "cage")        { weight += 0.05; }
        if (e === "widebody")    { handling += 8; }
        if (e === "air")         { handling += 12; }
        if (e === "camber")      { handling += 10; }
        if (e === "wheels18")    { handling += 6; weight -= 0.02; }
        if (e === "wheels19")    { handling += 10; weight -= 0.03; }
        if (e === "tires")       { handling += 14; braking += 8; }
    });

    // Nitro boost = number of power mods
    nitro = Math.min(5, 1 + parts.filter(p =>
        ["turbo","intake","exhaust","ecu","intercooler"].includes(p.effect)
    ).length);

    return {
        hp:       Math.min(hp, 950),
        handling: Math.min(handling, 99),
        braking:  Math.min(braking, 99),
        weight,
        nitro
    };
}

function getBuildDisplayName(build) {
    if (!build) return "Unknown";
    if (build.name) return build.name;
    if (build.baseVehicle) {
        const v = build.baseVehicle;
        return `${v.year} ${v.make} ${v.model}`;
    }
    return "Custom Build";
}

function getBuildColor(build) {
    const color = build?.carColor || build?.car_color || "#1f4ed8";
    // Ensure it's a valid hex color
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#1f4ed8";
}

// ─── Car Sprite System ───────────────────────────────────────────
const _sprites = {};

function loadSprite(key, src) {
    if (_sprites[key]) return _sprites[key];
    const img = new Image();
    img.src = src;
    _sprites[key] = img;
    return img;
}

const PLAYER_SPRITE = loadSprite("player", "/static/uploads/car_player.png");
const OPP_SPRITE    = loadSprite("opp",    "/static/uploads/car_opp.png");

function drawSportsCar(ctx, x, y, angle, color, nitroActive, scale = 1.0, isPlayer = true) {
    const img = isPlayer ? PLAYER_SPRITE : OPP_SPRITE;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const W = 90 * scale;
    const H = 50 * scale;

    if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, -W/2, -H/2, W, H);
    } else {
        // Simple fallback rectangle while image loads
        ctx.fillStyle = isPlayer ? "#ef4444" : "#eab308";
        ctx.beginPath();
        ctx.roundRect(-W/2, -H/2, W, H, 8);
        ctx.fill();
    }

    // Nitro flame
    if (nitroActive) {
        const fl = (22 + Math.random() * 14) * scale;
        const gr = ctx.createLinearGradient(-W/2, 0, -W/2 - fl, 0);
        gr.addColorStop(0,   "#ff6600");
        gr.addColorStop(0.4, "#ffaa00");
        gr.addColorStop(1,   "rgba(255,180,0,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(-W/2 + 2*scale, -7*scale);
        ctx.lineTo(-W/2 - fl, 0);
        ctx.lineTo(-W/2 + 2*scale,  7*scale);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function shadeColor(hex, pct) {
    let r = parseInt(hex.slice(1,3)||"33",16);
    let g = parseInt(hex.slice(3,5)||"33",16);
    let b = parseInt(hex.slice(5,7)||"33",16);
    if (isNaN(r)) r=51; if (isNaN(g)) g=51; if (isNaN(b)) b=51;
    return `rgb(${Math.max(0,Math.min(255,r+pct))},${Math.max(0,Math.min(255,g+pct))},${Math.max(0,Math.min(255,b+pct))})`;
}

// ─── Drag Race Engine ─────────────────────────────────────────────
let drag = {};

function initDrag(pBuild, oBuild) {
    const pStats = calcStats(pBuild);
    const oStats = calcStats(oBuild);
    const TRACK  = 400; // metres (quarter mile)

    drag = {
        track:   TRACK,
        player: { pos:0, vel:0, stats:pStats, color:getBuildColor(pBuild), name:getBuildDisplayName(pBuild), nitroLeft:pStats.nitro * 3, nitroActive:false, finished:false, time:0 },
        opp:    { pos:0, vel:0, stats:oStats, color:getBuildColor(oBuild), name:getBuildDisplayName(oBuild), nitroLeft:oStats.nitro * 3, nitroActive:false, finished:false, time:0 },
        countdown: 3,
        countdownTimer: 0,
        started: false,
        done: false,
        elapsed: 0,
        keys: {},
    };
}

function updateDrag(dt) {
    if (drag.done) return;

    // Countdown
    if (!drag.started) {
        drag.countdownTimer += dt;
        if (drag.countdownTimer >= 1) {
            drag.countdown--;
            drag.countdownTimer = 0;
            if (drag.countdown <= 0) drag.started = true;
        }
        return;
    }

    drag.elapsed += dt;

    // Player input
    const accel  = drag.keys["ArrowUp"]    || drag.keys["w"] || drag.keys["W"];
    const brake  = drag.keys["ArrowDown"]  || drag.keys["s"] || drag.keys["S"];
    const nitro  = drag.keys[" "] && drag.player.nitroLeft > 0;

    const p = drag.player;
    const maxVel = 0.5 + p.stats.hp / 600;
    const accelF = 0.008 + p.stats.hp / 80000;

    // Nitro works on its own — no need to also hold accelerate
    if (!p.finished) {
        p.nitroActive = !!nitro;
        const boost = nitro ? 1.6 : 1.0;

        if (accel || nitro) {
            p.vel = Math.min(maxVel * boost, p.vel + accelF * boost);
        } else if (brake) {
            p.vel = Math.max(0, p.vel - 0.015);
        } else {
            p.vel = Math.max(0, p.vel - 0.003); // coast / drag
        }
        if (nitro) p.nitroLeft = Math.max(0, p.nitroLeft - dt * 2);
    }

    if (!p.finished) {
        p.pos += p.vel * dt * 60;
        if (p.pos >= drag.track) {
            p.pos = drag.track;
            p.finished = true;
            p.time = drag.elapsed;
        }
    }

    // AI opponent
    const o = drag.opp;
    const oMaxVel  = 0.5 + o.stats.hp / 600;
    const oAccelF  = 0.008 + o.stats.hp / 80000;
    const aiNitro  = o.nitroLeft > 0 && drag.elapsed > 1 && Math.random() < 0.02;
    const aiBoost  = aiNitro ? 1.5 : 1.0;
    if (!o.finished) {
        o.nitroActive = aiNitro;
        if (aiNitro) o.nitroLeft = Math.max(0, o.nitroLeft - dt * 2);
        o.vel = Math.min(oMaxVel * aiBoost, o.vel + oAccelF * aiBoost);
        o.pos += o.vel * dt * 60;
        if (o.pos >= drag.track) {
            o.pos = drag.track;
            o.finished = true;
            o.time = drag.elapsed;
        }
    }

    if (p.finished && o.finished) drag.done = true;

    // Update HUD
    const mph = Math.round(p.vel * 200);
    document.getElementById("hudSpeed").textContent = mph;
    document.getElementById("hudTime").textContent  = drag.elapsed.toFixed(2);
}

function drawDrag(ctx, W, H) {
    // Background — sky + road
    ctx.fillStyle = "#1a2a4a";
    ctx.fillRect(0, 0, W, H);

    // Road
    const roadY = H * 0.55;
    const roadH = H * 0.45;
    ctx.fillStyle = "#2d2d2d";
    ctx.fillRect(0, roadY, W, roadH);

    // Road markings
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 20]);
    ctx.beginPath();
    ctx.moveTo(0, roadY + roadH * 0.5);
    ctx.lineTo(W, roadY + roadH * 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Finish line
    const finishX = W * 0.92;
    const checkSize = 12;
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
            ctx.fillStyle = (row + col) % 2 === 0 ? "#ffffff" : "#000000";
            ctx.fillRect(finishX + col * checkSize, roadY + row * checkSize, checkSize, checkSize);
        }
    }

    // Progress bar background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(40, 16, W - 80, 12);

    // Draw cars and progress bars
    [
        { racer: drag.player, laneY: roadY + roadH * 0.25, barY: 16, label: "YOU",  isPlayer: true  },
        { racer: drag.opp,    laneY: roadY + roadH * 0.72, barY: 34, label: "OPP",  isPlayer: false },
    ].forEach(({ racer, laneY, barY, label, isPlayer }) => {
        const prog = Math.min(racer.pos / drag.track, 1);
        const carX = 60 + prog * (W - 160);

        // Progress bar track
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(40, barY, W - 80, 8);
        // Progress fill
        ctx.fillStyle = isPlayer ? "#3b82f6" : "#ef4444";
        ctx.fillRect(40, barY, Math.max(8, (W - 80) * prog), 8);
        // Car color dot at progress position
        const dotX = 40 + (W - 80) * prog;
        ctx.fillStyle = isPlayer ? "#93c5fd" : "#fca5a5";
        ctx.beginPath();
        ctx.arc(dotX, barY + 4, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw car sprite
        drawSportsCar(ctx, carX, laneY, 0, racer.color, racer.nitroActive, 1.0, isPlayer);

        // Label
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px Inter, Arial";
        ctx.textAlign = "center";
        ctx.fillText(label, carX, laneY - 34);
    });

    // Countdown / GO
    if (!drag.started) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, W, H);
        const txt = drag.countdown > 0 ? String(drag.countdown) : "GO!";
        ctx.font = `bold ${drag.countdown > 0 ? 100 : 80}px Inter, Arial`;
        ctx.fillStyle = drag.countdown > 0 ? "#ff4444" : "#44ff44";
        ctx.textAlign = "center";
        ctx.fillText(txt, W/2, H/2 + 30);
    }

    // Speed lines
    if (drag.started && drag.player.vel > 0.2) {
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * W;
            const y = Math.random() * H;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - drag.player.vel * 80, y);
            ctx.stroke();
        }
    }
}


// ─── Main Loop ────────────────────────────────────────────────────
let lastTime = 0;

function gameLoop(ts) {
    if (!raceRunning) return;
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    const canvas = document.getElementById("raceCanvas");
    const ctx    = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    updateDrag(dt);
    drawDrag(ctx, W, H);
    if (drag.done) { raceRunning = false; showDragResults(); return; }

    animFrame = requestAnimationFrame(gameLoop);
}

function showDragResults() {
    const p = drag.player, o = drag.opp;
    const playerWon = !p.finished ? false : !o.finished ? true : p.time <= o.time;
    finishRace(playerWon, {
        "Your time":   p.finished ? p.time.toFixed(3) + "s" : "DNF",
        "Opp time":    o.finished ? o.time.toFixed(3) + "s" : "DNF",
        "Top speed":   Math.round(Math.max(...Array.from({length:10}, () => drag.player.vel) ) * 200) + " mph",
        "Distance":    "¼ mile (400m)",
    });
}

async function finishRace(playerWon, stats) {
    const banner = document.getElementById("resultsBanner");
    const statsEl = document.getElementById("resultsStats");

    banner.innerHTML = playerWon
        ? `<div class="result-win"><i data-lucide="trophy"></i> You Win!</div><p>${getBuildDisplayName(playerBuild)} beats ${getBuildDisplayName(opponentBuild)}</p>`
        : `<div class="result-lose"><i data-lucide="wind"></i> You Lost</div><p>${getBuildDisplayName(opponentBuild)} was faster</p>`;

    statsEl.innerHTML = Object.entries(stats)
        .map(([k, v]) => `<div class="result-stat"><span>${k}</span><strong>${v}</strong></div>`)
        .join("");

    document.getElementById("raceResults").style.display = "block";
    document.getElementById("raceHud").style.display     = "none";
    document.getElementById("raceControlsHint").style.display = "none";
    setTouchControlsVisible(false);
    if (window.refreshIcons) window.refreshIcons();

    // Save result
    try {
        await csrfFetch("/save_race_result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mode:        raceMode,
                player_build: getBuildDisplayName(playerBuild),
                opp_build:    getBuildDisplayName(opponentBuild),
                won:          playerWon,
                time:         stats["Your time"] || "N/A",
            })
        });
        loadLeaderboard();
    } catch(e) {}
}

// ─── Setup UI ─────────────────────────────────────────────────────
function switchOpponent(type) {
    opponentType = type;
    document.querySelectorAll(".opp-tab").forEach(t => t.classList.remove("active"));
    document.getElementById(`opp-${type}`).classList.add("active");
    document.getElementById("ai-opponent-panel").style.display   = type === "ai"   ? "block" : "none";
    document.getElementById("user-opponent-panel").style.display = type === "user" ? "block" : "none";
    if (type === "ai") onAIDifficultyChange();
    else opponentBuild = null;
    checkReady();
}

function onAIDifficultyChange() {
    const diffEl = document.getElementById("aiDifficulty");
    if (!diffEl) return;
    const diff    = diffEl.value;
    opponentBuild = AI_BUILDS[diff];
    const stats   = calcStats(opponentBuild);
    const preview = document.getElementById("aiPreview");
    if (preview) preview.innerHTML = buildPreviewHTML(opponentBuild, stats);
    checkReady();
}

// With no query this lists people you follow who have builds. Typing searches
// everyone, so you can still race someone you don't follow.
async function loadUserList(query = "") {
    const sel  = document.getElementById("opponentUserSelect");
    const hint = document.getElementById("opponentListHint");
    if (!sel) return;

    let users = [];
    try {
        const url = query ? `/get_race_users?q=${encodeURIComponent(query)}` : "/get_race_users";
        const res = await fetch(url);
        if (res.ok) users = await res.json();
    } catch (e) { /* leave the list empty and fall through to the hint */ }

    sel.innerHTML = `<option value="">— Select a user —</option>`;
    users.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = `@${u.username}`;
        sel.appendChild(opt);
    });

    if (hint) {
        if (users.length)      hint.textContent = query ? "" : "People you follow.";
        else if (query)        hint.textContent = "No users found with that name.";
        else                   hint.textContent = "You're not following anyone with a saved build yet — search by username, or hit Surprise me.";
    }
}

let searchTimer = null;
function onOpponentSearch() {
    clearTimeout(searchTimer);
    const q = document.getElementById("opponentSearch").value.trim();
    searchTimer = setTimeout(() => loadUserList(q), 250);
}

// Pulls a random pool and picks whichever build is closest in performance to
// the player's, so the race is competitive instead of a blowout.
async function pickRandomOpponent() {
    if (!playerBuild) {
        alert("Pick your own build first so we can find you a fair match.");
        return;
    }

    let pool = [];
    try {
        const res = await fetch("/get_random_opponent");
        if (res.ok) pool = await res.json();
    } catch (e) { /* handled by the empty check below */ }

    if (!pool.length) {
        const hint = document.getElementById("opponentListHint");
        if (hint) hint.textContent = "No other builds on the platform yet — race the AI for now.";
        return;
    }

    const myScore = perfScore(calcStats(playerBuild));
    let best = null, bestGap = Infinity;

    pool.forEach(row => {
        let parts = [];
        try { parts = JSON.parse(row.parts_json || "[]"); } catch (e) {}
        const cand = { ...row, parts, carColor: row.car_color || "#ef4444" };
        const gap  = Math.abs(perfScore(calcStats(cand)) - myScore);
        if (gap < bestGap) { bestGap = gap; best = cand; }
    });

    opponentBuild = best;

    // Reflect the pick in the dropdowns so it's clear who you drew
    const userSel = document.getElementById("opponentUserSelect");
    if (userSel && best.username && !Array.from(userSel.options).some(o => o.value == best.user_id)) {
        const opt = document.createElement("option");
        opt.value = best.user_id;
        opt.textContent = `@${best.username}`;
        userSel.appendChild(opt);
    }
    if (userSel) userSel.value = best.user_id;

    const buildSel = document.getElementById("opponentBuildSelect");
    if (buildSel) {
        buildSel.innerHTML = `<option value="${best.id}">${esc(best.name || "Build #" + best.id)}</option>`;
        buildSel.style.display = "block";
    }

    const preview = document.getElementById("opponentBuildPreview");
    if (preview) {
        preview.innerHTML = buildPreviewHTML(opponentBuild, calcStats(opponentBuild));
        preview.style.display = "block";
    }
    if (window.refreshIcons) window.refreshIcons();
    checkReady();
}

// Single number standing in for straight-line pace, used only for matchmaking.
function perfScore(s) {
    return (s.hp / s.weight) + s.nitro * 20;
}

async function onOpponentUserChange() {
    const userId = document.getElementById("opponentUserSelect").value;
    if (!userId) return;
    const res    = await fetch(`/get_user_builds/${userId}`);
    const builds = await res.json();
    const sel    = document.getElementById("opponentBuildSelect");
    sel.innerHTML = `<option value="">— Select their build —</option>`;
    builds.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.textContent = b.name || `Build #${b.id}`;
        sel.appendChild(opt);
    });
    sel.style.display = "block";
    opponentBuild = null;
    checkReady();
}

async function onOpponentBuildChange() {
    const buildId = document.getElementById("opponentBuildSelect").value;
    if (!buildId) return;
    const res   = await fetch(`/get_build/${buildId}`);
    const data  = await res.json();
    const parts = JSON.parse(data.parts_json || "[]");
    opponentBuild = { ...data, parts, carColor: data.car_color || data.carColor || "#ef4444" };
    const stats = calcStats(opponentBuild);
    const preview = document.getElementById("opponentBuildPreview");
    preview.innerHTML = buildPreviewHTML(opponentBuild, stats);
    preview.style.display = "block";
    checkReady();
}

async function loadPlayerBuilds() {
    try {
        const res    = await fetch("/get_builds");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const builds = await res.json();
        const sel    = document.getElementById("playerBuildSelect");
        if (!sel) return;
        sel.innerHTML = `<option value="">— Select a saved build —</option>`;
        if (builds.length === 0) {
            sel.innerHTML += `<option disabled>No saved builds — go build one first!</option>`;
            return;
        }
        builds.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = b.name || `${b.base_year} ${b.base_make} ${b.base_model}`;
            sel.appendChild(opt);
        });
    } catch(e) {
        console.error("loadPlayerBuilds failed:", e);
        const sel = document.getElementById("playerBuildSelect");
        if (sel) sel.innerHTML = `<option value="">Failed to load builds — are you logged in?</option>`;
    }
}

async function onPlayerBuildChange() {
    const buildId = document.getElementById("playerBuildSelect").value;
    if (!buildId) { playerBuild = null; checkReady(); return; }
    const res   = await fetch(`/get_build/${buildId}`);
    const data  = await res.json();
    const parts = JSON.parse(data.parts_json || "[]");
    playerBuild = { ...data, parts, carColor: data.car_color || data.carColor || "#1f4ed8" };
    const stats = calcStats(playerBuild);
    const preview = document.getElementById("playerBuildPreview");
    preview.innerHTML = buildPreviewHTML(playerBuild, stats);
    preview.style.display = "block";
    checkReady();
}

function buildPreviewHTML(build, stats) {
    const name = getBuildDisplayName(build);
    const parts = (build.parts || []).length;
    const hpBar = Math.min(100, (stats.hp / 950) * 100);
    const hanBar = Math.min(100, stats.handling);
    const brkBar = Math.min(100, stats.braking);
    return `
        <div class="build-preview-name">${esc(name)}</div>
        <div class="build-preview-parts">${parts} mod${parts !== 1 ? "s" : ""}</div>
        <div class="stat-bar-row"><span>HP</span><div class="stat-bar"><div class="stat-bar-fill hp" style="width:${hpBar}%"></div></div><span>${stats.hp}</span></div>
        <div class="stat-bar-row"><span>Handling</span><div class="stat-bar"><div class="stat-bar-fill hand" style="width:${hanBar}%"></div></div><span>${Math.round(stats.handling)}</span></div>
        <div class="stat-bar-row"><span>Braking</span><div class="stat-bar"><div class="stat-bar-fill brk" style="width:${brkBar}%"></div></div><span>${Math.round(stats.braking)}</span></div>
        <div class="stat-bar-row"><span>Nitro</span><div class="stat-bar"><div class="stat-bar-fill nit" style="width:${stats.nitro * 20}%"></div></div><span>${stats.nitro}x</span></div>
    `;
}

function checkReady() {
    const ready = playerBuild && opponentBuild;
    document.getElementById("raceStartBtn").disabled = !ready;
}

function startRace() {
    if (!playerBuild || !opponentBuild) return;

    const canvas = document.getElementById("raceCanvas");
    const wrap   = document.getElementById("raceCanvasWrap");
    canvas.width  = wrap.clientWidth  || 700;
    canvas.height = wrap.clientHeight || 420;

    document.getElementById("raceOverlay").style.display      = "none";
    document.getElementById("raceResults").style.display      = "none";
    document.getElementById("raceHud").style.display          = "flex";
    document.getElementById("raceControlsHint").style.display = "flex";
    setTouchControlsVisible(true);

    initDrag(playerBuild, opponentBuild);

    raceRunning = true;
    lastTime    = performance.now();
    animFrame   = requestAnimationFrame(gameLoop);
}

function rematch() {
    document.getElementById("raceResults").style.display = "none";
    startRace();
}

function resetRace() {
    raceRunning = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    document.getElementById("raceResults").style.display = "none";
    document.getElementById("raceOverlay").style.display = "flex";
    document.getElementById("raceHud").style.display     = "none";
    document.getElementById("raceControlsHint").style.display = "none";
    setTouchControlsVisible(false);
}

// ─── Leaderboard ──────────────────────────────────────────────────
async function loadLeaderboard() {
    const res  = await fetch("/get_race_results");
    const data = await res.json();
    const el   = document.getElementById("leaderboard");
    if (data.length === 0) {
        el.innerHTML = `<p class="empty-state" style="padding:8px 0;font-size:13px;">No races yet</p>`;
        return;
    }
    el.innerHTML = data.slice(0, 8).map((r, i) => `
        <div class="leaderboard-row ${r.won ? 'win' : 'loss'}">
            <span class="lb-rank">${i + 1}</span>
            <span class="lb-build">${esc(r.player_build)}</span>
            <span class="lb-result">${r.won ? '<i data-lucide="check-circle" style="color:#16a34a"></i>' : '<i data-lucide="x-circle" style="color:#dc2626"></i>'}</span>
            <span class="lb-time">${esc(r.time)}</span>
        </div>
    `).join("");
    if (window.refreshIcons) window.refreshIcons();
}

// ─── Keyboard ─────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
    if (!raceRunning) return;
    if (e.key === " ") e.preventDefault();
    drag.keys[e.key] = true;
});
document.addEventListener("keyup", e => {
    drag.keys[e.key] = false;
});

function esc(s) {
    if (!s) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function csrfFetch(url, opts = {}) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    return fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...(token ? {"X-CSRFToken": token} : {}) }});
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadPlayerBuilds();
    loadUserList();
    onAIDifficultyChange();
    loadLeaderboard();
    const hudMode = document.getElementById("hudMode");
    if (hudMode) hudMode.textContent = "DRAG";
    checkReady();
});
// ─── Touch controls (mobile) ──────────────────────────────────────
// Feeds the same key map the keyboard handler uses, so race physics
// needs no changes — a held button behaves exactly like a held key.
function setKey(key, down) {
    drag.keys[key] = down;
}

function initTouchControls() {
    const wrap = document.getElementById("raceTouchControls");
    if (!wrap) return;

    wrap.querySelectorAll(".rtc-btn").forEach(btn => {
        const key = btn.dataset.key;

        const press = (e) => {
            e.preventDefault();
            if (!raceRunning) return;
            setKey(key, true);
            btn.classList.add("active");
        };
        const release = (e) => {
            if (e) e.preventDefault();
            setKey(key, false);
            btn.classList.remove("active");
        };

        btn.addEventListener("touchstart", press,   { passive: false });
        btn.addEventListener("touchend",   release, { passive: false });
        btn.addEventListener("touchcancel", release, { passive: false });
        // Mouse fallback so it also works in desktop device-emulation
        btn.addEventListener("mousedown",  press);
        btn.addEventListener("mouseup",    release);
        btn.addEventListener("mouseleave", release);
    });
}

// Show/hide touch pad alongside the keyboard hint
function setTouchControlsVisible(visible) {
    const wrap = document.getElementById("raceTouchControls");
    if (!wrap) return;
    wrap.style.display = visible ? "flex" : "none";
}

document.addEventListener("DOMContentLoaded", initTouchControls);
