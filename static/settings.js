// ─── Section Switching ────────────────────────────────────────────
function showSection(section) {
    document.querySelectorAll(".settings-nav-item").forEach(b => b.classList.remove("active"));
    document.querySelector(`.settings-nav-item[data-section="${section}"]`).classList.add("active");
    document.querySelectorAll(".settings-section").forEach(s => s.classList.remove("active"));
    document.getElementById(`section-${section}`).classList.add("active");

    if (section === "saved") loadSavedPosts();
}

function showMsg(elId, text, isError = false) {
    const el = document.getElementById(elId);
    const icon = isError ? "x-circle" : "check-circle";
    el.innerHTML = `<i data-lucide="${icon}"></i> ${text}`;
    el.className = "settings-msg " + (isError ? "error" : "success");
    el.style.display = "block";
    if (window.refreshIcons) window.refreshIcons();
    setTimeout(() => { el.style.display = "none"; }, 4000);
}

function csrfFetch(url, opts = {}) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    return fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...(token ? { "X-CSRFToken": token } : {}) } });
}

// ─── Account ──────────────────────────────────────────────────────
async function saveAccount() {
    const username = document.getElementById("settingsUsername").value.trim();
    const email    = document.getElementById("settingsEmail").value.trim();

    const res  = await csrfFetch("/settings/update_account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email })
    });
    const data = await res.json();

    if (data.error) showMsg("accountMsg", data.error, true);
    else showMsg("accountMsg", "Account updated successfully");
}

async function savePassword() {
    const current = document.getElementById("currentPassword").value;
    const next     = document.getElementById("newPassword").value;
    const confirm  = document.getElementById("confirmPassword").value;

    if (next !== confirm) { showMsg("passwordMsg", "New passwords don't match", true); return; }
    if (next.length < 8)  { showMsg("passwordMsg", "Password must be at least 8 characters", true); return; }

    const res  = await csrfFetch("/settings/change_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next })
    });
    const data = await res.json();

    if (data.error) showMsg("passwordMsg", data.error, true);
    else {
        showMsg("passwordMsg", "Password changed successfully");
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value      = "";
        document.getElementById("confirmPassword").value  = "";
    }
}

// ─── Cars ────────────────────────────────────────────────────────
async function saveCars() {
    const main_car      = document.getElementById("settingsMainCar").value.trim();
    const secondary_car = document.getElementById("settingsSecondaryCar").value.trim();

    const res  = await csrfFetch("/settings/update_cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ main_car, secondary_car })
    });
    const data = await res.json();

    if (data.error) showMsg("carsMsg", data.error, true);
    else showMsg("carsMsg", "Cars updated successfully");
}

// ─── Privacy ──────────────────────────────────────────────────────
async function savePrivacy() {
    const isPrivate    = document.getElementById("isPrivate").checked;
    const dmPermission = document.getElementById("dmPermission").value;

    const res  = await csrfFetch("/settings/update_privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_private: isPrivate, dm_permission: dmPermission })
    });
    const data = await res.json();

    if (data.error) showMsg("privacyMsg", data.error, true);
    else showMsg("privacyMsg", "Privacy settings saved");
}

// ─── Notifications ────────────────────────────────────────────────
async function saveNotifications() {
    const emailNotif = document.getElementById("emailNotif").checked;
    const inappNotif = document.getElementById("inappNotif").checked;

    const res  = await csrfFetch("/settings/update_notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_notifications: emailNotif, inapp_notifications: inappNotif })
    });
    const data = await res.json();

    if (data.error) showMsg("notifMsg", data.error, true);
    else showMsg("notifMsg", "Notification settings saved");
}

// ─── Appearance ───────────────────────────────────────────────────
async function toggleDarkMode() {
    const darkMode = document.getElementById("darkMode").checked;
    document.documentElement.classList.toggle("dark-mode", darkMode);

    await csrfFetch("/settings/update_theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dark_mode: darkMode })
    });
}

async function setColorScheme(scheme) {
    // Swap scheme class on <html>
    const html = document.documentElement;
    ["blue","red","green","orange","purple"].forEach(s => html.classList.remove("scheme-" + s));
    html.classList.add("scheme-" + scheme);

    // Update active swatch
    document.querySelectorAll(".color-swatch").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.scheme === scheme);
    });

    const res  = await csrfFetch("/settings/update_color_scheme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color_scheme: scheme })
    });
    const data = await res.json();
    if (data.error) showMsg("schemeMsg", data.error, true);
    else showMsg("schemeMsg", "Color scheme saved");
}

// ─── Saved Posts ──────────────────────────────────────────────────
async function loadSavedPosts() {
    const container = document.getElementById("savedPostsList");
    container.innerHTML = `<p class="empty-state">Loading…</p>`;

    try {
        const res   = await fetch("/get_saved_posts");
        const posts = await res.json();

        if (posts.length === 0) {
            container.innerHTML = `<p class="empty-state">No saved posts yet. Tap the bookmark icon on any post to save it here.</p>`;
            return;
        }

        container.innerHTML = posts.map(p => `
            <div class="saved-post-card">
                <div class="saved-post-header">
                    <img src="${p.avatar || '/static/default-avatar.png'}" class="saved-post-avatar" onerror="this.style.display='none'">
                    <strong>@${esc(p.username)}</strong>
                    <button class="unsave-btn" onclick="unsavePost(${p.id})" title="Remove from saved"><i data-lucide="trash-2"></i></button>
                </div>
                <p class="saved-post-content">${esc(p.content || "")}</p>
                ${p.image ? `<img src="${p.image}" class="saved-post-image">` : ""}
            </div>
        `).join("");
        if (window.refreshIcons) window.refreshIcons();
    } catch (e) {
        container.innerHTML = `<p class="empty-state">Failed to load saved posts.</p>`;
    }
}

async function unsavePost(postId) {
    await csrfFetch(`/toggle_save_post/${postId}`, { method: "POST" });
    loadSavedPosts();
}

function esc(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Danger Zone ──────────────────────────────────────────────────
function openDeleteModal()  { document.getElementById("deleteModal").style.display = "flex"; }
function closeDeleteModal() {
    document.getElementById("deleteModal").style.display = "none";
    document.getElementById("deletePassword").value = "";
    document.getElementById("deleteMsg").style.display = "none";
}

async function confirmDeleteAccount() {
    const password = document.getElementById("deletePassword").value;
    if (!password) { showMsg("deleteMsg", "Please enter your password", true); return; }

    const res  = await csrfFetch("/settings/delete_account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.error) {
        showMsg("deleteMsg", data.error, true);
    } else {
        window.location.href = "/login";
    }
}
// ─── Social links ─────────────────────────────────────────────────
async function saveSocials() {
    const payload = {
        instagram: document.getElementById("socialInstagram")?.value.trim() || "",
        tiktok:    document.getElementById("socialTiktok")?.value.trim()    || "",
        youtube:   document.getElementById("socialYoutube")?.value.trim()   || "",
        x:         document.getElementById("socialX")?.value.trim()         || "",
        website:   document.getElementById("socialWebsite")?.value.trim()   || "",
    };
    try {
        const res = await csrfFetch("/settings/update_socials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) showMsg("socialsMsg", data.error, true);
        else            showMsg("socialsMsg", "Social links saved");
    } catch (e) {
        showMsg("socialsMsg", "Could not save", true);
    }
}
