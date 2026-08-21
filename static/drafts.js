function escD(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function csrfFetchD(url, opts = {}) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    return fetch(url, {
        ...opts,
        headers: { ...(opts.headers || {}), ...(token ? { "X-CSRFToken": token } : {}) }
    });
}

async function loadDrafts() {
    const list = document.getElementById("draftsList");
    if (!list) return;

    let drafts = [];
    try {
        const res = await fetch("/api/drafts");
        drafts = await res.json();
    } catch (e) {
        list.innerHTML = `<p class="empty-state" style="padding:20px 0;">Could not load drafts.</p>`;
        return;
    }

    if (!drafts.length) {
        list.innerHTML = `
            <div class="drafts-empty">
                <i data-lucide="file-text"></i>
                <p>No drafts yet.</p>
                <span>Start a post and hit <strong>Save Draft</strong> to keep it for later.</span>
            </div>`;
        if (window.lucide) lucide.createIcons();
        return;
    }

    list.innerHTML = drafts.map(d => {
        const preview = (d.body || "").slice(0, 180);
        return `
        <div class="draft-card" id="draft-${d.id}">
            <div class="draft-main">
                <div class="draft-title">${escD(d.title) || "<em>Untitled draft</em>"}</div>
                ${preview ? `<p class="draft-preview">${escD(preview)}${d.body.length > 180 ? "…" : ""}</p>` : ""}
                <div class="draft-meta">
                    ${d.car ? `<span><i data-lucide="car"></i> ${escD(d.car)}</span>` : ""}
                    ${d.gif_url ? `<span><i data-lucide="image"></i> GIF</span>` : ""}
                    ${d.link_url ? `<span><i data-lucide="link"></i> Link</span>` : ""}
                    ${d.updated_at ? `<span><i data-lucide="clock"></i> ${escD(d.updated_at)}</span>` : ""}
                </div>
            </div>
            <div class="draft-actions">
                <button class="btn btn-primary btn-sm" onclick="editDraft(${d.id})">
                    <i data-lucide="pen-line"></i> Continue
                </button>
                <button class="saved-delete-btn" onclick="deleteDraft(${d.id})">
                    <i data-lucide="trash-2"></i> Delete
                </button>
            </div>
        </div>`;
    }).join("");

    if (window.lucide) lucide.createIcons();
}

// Hand the draft to the home composer via sessionStorage
function editDraft(id) {
    fetch("/api/drafts").then(r => r.json()).then(drafts => {
        const d = drafts.find(x => x.id === id);
        if (!d) return;
        sessionStorage.setItem("ri_draft", JSON.stringify(d));
        window.location.href = "/";
    });
}

async function deleteDraft(id) {
    if (!confirm("Delete this draft?")) return;
    await csrfFetchD(`/api/drafts/${id}/delete`, { method: "POST" });
    loadDrafts();
}

loadDrafts();
