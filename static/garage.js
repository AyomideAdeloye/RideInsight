let garage = [];
let currentCarId = null;

// ─── Load ──────────────────────────────────────────────────────────
async function loadGarage() {
    const res = await fetch("/get_garage");
    garage    = await res.json();
    renderGarage();
}

function renderGarage() {
    const grid  = document.getElementById("garageGrid");
    const empty = document.getElementById("garageEmpty");
    // Clear existing cards (keep the empty div)
    Array.from(grid.children).forEach(c => { if (c.id !== "garageEmpty") c.remove(); });

    if (!garage.length) {
        empty.style.display = "flex";
        return;
    }
    empty.style.display = "none";
    garage.forEach(car => {
        const card = createGarageCard(car);
        grid.appendChild(card);
        loadMods(car.id);
    });
    if (window.lucide) lucide.createIcons();
}

function esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function timeAgo(dtStr) {
    if (!dtStr) return "";
    const dt    = new Date(dtStr.replace(" ", "T") + "Z");
    const delta = (Date.now() - dt.getTime()) / 1000;
    if (delta < 60)    return "just now";
    if (delta < 3600)  return Math.floor(delta/60) + "m ago";
    if (delta < 86400) return Math.floor(delta/3600) + "h ago";
    return Math.floor(delta/86400) + "d ago";
}

// ─── Card ──────────────────────────────────────────────────────────
function createGarageCard(car) {
    const card = document.createElement("div");
    card.className = "g-card";
    card.id = `g-card-${car.id}`;
    card.innerHTML = `
        ${car.image
            ? `<div class="g-card-img-wrap"><img src="${esc(car.image)}" class="g-card-img" loading="lazy"></div>`
            : `<div class="g-card-img-wrap g-card-img-placeholder"><i data-lucide="car"></i></div>`
        }
        <div class="g-card-body">
            <div class="g-card-title-row">
                <h3 class="g-car-name">${esc(car.year)} ${esc(car.make)} ${esc(car.model)}</h3>
                <button class="g-delete-btn" onclick="deleteCar(${car.id})" title="Remove vehicle">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            ${car.trim  ? `<span class="g-trim">${esc(car.trim)}</span>` : ""}
            ${car.notes ? `<p class="g-notes">${esc(car.notes)}</p>` : ""}

            <div class="g-mods-header" onclick="toggleMods(${car.id})">
                <span class="g-mods-label"><i data-lucide="wrench"></i> Mods</span>
                <span class="g-mods-count" id="g-mod-count-${car.id}">…</span>
                <i data-lucide="chevron-down" class="g-mods-chevron" id="g-chevron-${car.id}"></i>
            </div>

            <div class="g-mods-list" id="g-mods-${car.id}"></div>

            <div class="g-card-footer">
                <span class="g-total-cost" id="g-total-${car.id}">$0</span>
                <div class="g-card-actions">
                    <button class="btn btn-ghost g-action-btn" onclick="openAddModModal(${car.id})">
                        <i data-lucide="plus"></i> Add Mod
                    </button>
                    <button class="btn btn-ghost g-action-btn" onclick="shareCarToFeed(${car.id})">
                        <i data-lucide="share-2"></i> Share
                    </button>
                </div>
            </div>
        </div>
    `;
    return card;
}

// ─── Mods ──────────────────────────────────────────────────────────
async function loadMods(carId) {
    const res  = await fetch(`/get_mods/${carId}`);
    const mods = await res.json();

    const container = document.getElementById(`g-mods-${carId}`);
    const countEl   = document.getElementById(`g-mod-count-${carId}`);
    const totalEl   = document.getElementById(`g-total-${carId}`);

    let total = 0;
    mods.forEach(m => total += Number(m.cost || 0));

    countEl.textContent = mods.length + " mod" + (mods.length !== 1 ? "s" : "");
    totalEl.textContent = "$" + total.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});

    if (!mods.length) {
        container.innerHTML = `<div class="g-mods-empty">No mods yet — add your first upgrade!</div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    container.innerHTML = mods.map(m => `
        <div class="g-mod-row" id="g-mod-${m.id}">
            <div class="g-mod-dot"></div>
            <div class="g-mod-info">
                <span class="g-mod-name">${esc(m.name)}</span>
                <span class="g-mod-meta">${esc(m.category)}${m.created_at ? " · " + timeAgo(m.created_at) : ""}</span>
            </div>
            <div class="g-mod-right">
                <span class="g-mod-cost">$${Number(m.cost).toLocaleString()}</span>
                <a class="g-shop-link" href="/the_shop?q=${encodeURIComponent(m.name)}" target="_blank" title="Find in The Shop">
                    <i data-lucide="shopping-bag"></i>
                </a>
                <button class="g-mod-delete" onclick="deleteMod(${m.id}, ${carId})" title="Remove mod">
                    <i data-lucide="x"></i>
                </button>
            </div>
        </div>
    `).join("");

    if (window.lucide) lucide.createIcons();
}

function toggleMods(carId) {
    const list    = document.getElementById(`g-mods-${carId}`);
    const chevron = document.getElementById(`g-chevron-${carId}`);
    const open    = list.classList.toggle("open");
    chevron.style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
}

// ─── Delete ────────────────────────────────────────────────────────
async function deleteCar(carId) {
    if (!confirm("Remove this vehicle and all its mods?")) return;
    await csrfFetch(`/delete_car/${carId}`, { method: "POST" });
    document.getElementById(`g-card-${carId}`)?.remove();
    garage = garage.filter(c => c.id !== carId);
    if (!garage.length) document.getElementById("garageEmpty").style.display = "flex";
}

async function deleteMod(modId, carId) {
    await csrfFetch(`/delete_mod/${modId}`, { method: "POST" });
    document.getElementById(`g-mod-${modId}`)?.remove();
    loadMods(carId); // refresh count + total
}

// ─── Share ─────────────────────────────────────────────────────────
async function shareCarToFeed(carId) {
    const car = garage.find(c => c.id === carId);
    if (!car) return;
    // Open the main feed composer pre-filled
    const title = `My ${car.year} ${car.make} ${car.model} build`;
    const body  = car.notes || `Check out my ${car.year} ${car.make} ${car.model}!`;
    window.location.href = `/?share_title=${encodeURIComponent(title)}&share_body=${encodeURIComponent(body)}`;
}

// ─── Add Vehicle ───────────────────────────────────────────────────
function openAddCarModal() {
    document.getElementById("addCarModal").style.display = "flex";
    if (window.lucide) lucide.createIcons();
}

function previewCarImage(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById("carImagePreview").src = e.target.result;
        document.getElementById("carImagePreviewWrap").style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
}

function clearCarImage() {
    document.getElementById("carImageInput").value = "";
    document.getElementById("carImagePreviewWrap").style.display = "none";
}

async function submitCar() {
    const year  = document.getElementById("carYear").value.trim();
    const make  = document.getElementById("carMake").value.trim();
    const model = document.getElementById("carModel").value.trim();
    if (!year || !make || !model) { alert("Year, make, and model are required."); return; }
    const fd = new FormData();
    fd.append("year",  year);
    fd.append("make",  make);
    fd.append("model", model);
    fd.append("trim",  document.getElementById("carTrim").value.trim());
    fd.append("notes", document.getElementById("carNotes").value.trim());
    const img = document.getElementById("carImageInput").files[0];
    if (img) fd.append("image", img);
    await csrfFetch("/add_car", { method: "POST", body: fd });
    document.getElementById("addCarModal").style.display = "none";
    ["carYear","carMake","carModel","carTrim","carNotes"].forEach(id => document.getElementById(id).value = "");
    clearCarImage();
    loadGarage();
}

// ─── Add Mod ───────────────────────────────────────────────────────
function openAddModModal(carId) {
    currentCarId = carId;
    document.getElementById("modName").value     = "";
    document.getElementById("modCost").value     = "";
    document.getElementById("modCategory").value = "";
    document.getElementById("shopSuggestions").style.display = "none";
    document.getElementById("addModModal").style.display = "flex";
    if (window.lucide) lucide.createIcons();

    // Search shop when mod name is typed
    const nameInput = document.getElementById("modName");
    nameInput.oninput = () => searchShopForMod(nameInput.value);
}

async function searchShopForMod(query) {
    const box = document.getElementById("shopSuggestions");
    if (!query || query.length < 3) { box.style.display = "none"; return; }
    try {
        const res  = await fetch(`/api/listings?q=${encodeURIComponent(query)}&limit=3`);
        const data = await res.json();
        if (!data.length) { box.style.display = "none"; return; }
        box.style.display = "block";
        box.innerHTML = `
            <div class="shop-suggest-header"><i data-lucide="shopping-bag"></i> Found in The Shop:</div>
            ${data.map(l => `
                <a class="shop-suggest-item" href="/the_shop?q=${encodeURIComponent(query)}" target="_blank">
                    <span class="shop-suggest-name">${esc(l.title)}</span>
                    <span class="shop-suggest-price">$${Number(l.price).toLocaleString()}</span>
                </a>
            `).join("")}
        `;
        if (window.lucide) lucide.createIcons();
    } catch(e) {
        box.style.display = "none";
    }
}

async function submitMod() {
    const name     = document.getElementById("modName").value.trim();
    const cost     = document.getElementById("modCost").value;
    const category = document.getElementById("modCategory").value;
    if (!name) { alert("Mod name is required."); return; }
    await csrfFetch("/add_mod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: currentCarId, name, cost: parseFloat(cost) || 0, category })
    });
    document.getElementById("addModModal").style.display = "none";
    loadMods(currentCarId);
}

// ─── Helpers ───────────────────────────────────────────────────────
function closeModalOutside(e, id) {
    if (e.target === document.getElementById(id))
        document.getElementById(id).style.display = "none";
}

// Pre-fill composer if redirected from garage share
(function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share_title") && window.expandComposer) {
        expandComposer();
        const t = document.getElementById("composerTitle");
        const b = document.getElementById("composerBody");
        if (t) t.value = params.get("share_title");
        if (b) b.value = params.get("share_body") || "";
    }
})();

loadGarage();
