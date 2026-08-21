function escHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const TYPE_META = {
    car:        { icon: "car",        label: "Car" },
    motorcycle: { icon: "bike",       label: "Motorcycle" },
    boat:       { icon: "sailboat",   label: "Boat" },
};

const INTENT_LABEL = {
    daily:       "Daily / Recreational",
    performance: "Performance",
    budget:      "Budget",
    comfort:     "Comfort / Touring",
};

async function loadSaved() {
    const container = document.getElementById("saved-list");
    if (!container) return;
    container.innerHTML = `<p class="empty-state" style="padding:20px 0;">Loading…</p>`;

    let data = [];
    try {
        const res = await fetch("/get_comparisons");
        data = await res.json();
    } catch (e) {
        container.innerHTML = `<p class="empty-state" style="padding:20px 0;">Could not load saved comparisons.</p>`;
        return;
    }

    // Skip empty/corrupt rows
    data = (data || []).filter(c => c.car1 && c.car2);

    if (!data.length) {
        container.innerHTML = `
            <div class="saved-empty">
                <i data-lucide="bookmark"></i>
                <p>No saved comparisons yet.</p>
                <a class="btn btn-primary" href="/compare">Compare Vehicles</a>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    container.innerHTML = data.map(comp => {
        const type = comp.vehicle_type || "car";
        const meta = TYPE_META[type] || TYPE_META.car;
        const url  = `/compare?car1=${encodeURIComponent(comp.car1)}`
                   + `&car2=${encodeURIComponent(comp.car2)}`
                   + `&intent=${encodeURIComponent(comp.intent || "daily")}`
                   + `&type=${encodeURIComponent(type)}`;
        return `
        <div class="saved-card">
            <div class="saved-card-head">
                <span class="saved-type-chip"><i data-lucide="${meta.icon}"></i> ${meta.label}</span>
                <span class="saved-intent">${escHtml(INTENT_LABEL[comp.intent] || comp.intent || "")}</span>
            </div>
            <h3 class="saved-matchup">
                <span>${escHtml(comp.car1)}</span>
                <span class="saved-vs">vs</span>
                <span>${escHtml(comp.car2)}</span>
            </h3>
            <div class="saved-card-actions">
                <a class="btn btn-primary btn-sm" href="${url}">Open Comparison</a>
                <button class="saved-delete-btn" onclick="deleteComparison(${comp.id})">
                    <i data-lucide="trash-2"></i> Delete
                </button>
            </div>
        </div>`;
    }).join("");

    if (window.lucide) lucide.createIcons();
}

async function deleteComparison(id) {
    if (!confirm("Delete this saved comparison?")) return;
    try {
        const token = document.querySelector('meta[name="csrf-token"]')?.content || "";
        await fetch(`/delete_comparison/${id}`, {
            method: "POST",
            headers: { "X-CSRFToken": token },
        });
    } catch (e) {}
    loadSaved();
}

loadSaved();
