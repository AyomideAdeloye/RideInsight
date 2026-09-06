// ─── CSRF ────────────────────────────────────────────────────────
// Every state-changing request needs a CSRF token. There are well over a
// hundred fetch() calls across the app, and relying on each one to remember
// csrfFetch() is how 64 routes ended up exempted from protection instead.
//
// So the token is attached centrally: window.fetch is wrapped once here, and
// any same-origin request that isn't a GET/HEAD gets the header whether the
// caller asked for it or not. New code cannot forget.
//
// Cross-origin requests are left completely untouched — attaching our token to
// a third-party API would leak it.
(function () {
    const nativeFetch = window.fetch.bind(window);
    const SAFE = ["GET", "HEAD", "OPTIONS", "TRACE"];

    function token() {
        return document.querySelector('meta[name="csrf-token"]')?.content || "";
    }

    window.fetch = function (input, init = {}) {
        const method = (init.method || (input && input.method) || "GET").toUpperCase();
        if (SAFE.includes(method)) return nativeFetch(input, init);

        // Resolve the target against the current page so relative URLs
        // ("/like_post/3") are correctly seen as same-origin.
        let sameOrigin = true;
        try {
            const url = new URL(
                typeof input === "string" ? input : input.url,
                window.location.href
            );
            sameOrigin = url.origin === window.location.origin;
        } catch (e) { /* malformed URL — treat as same-origin and let it fail */ }

        if (!sameOrigin) return nativeFetch(input, init);

        const t = token();
        if (!t) return nativeFetch(input, init);

        // Headers may arrive as a Headers instance or a plain object.
        const headers = new Headers(
            init.headers || (input && input.headers) || {}
        );
        if (!headers.has("X-CSRFToken")) headers.set("X-CSRFToken", t);

        return nativeFetch(input, { ...init, headers });
    };
})();

// Kept because a lot of existing code calls it. The wrapper above already
// adds the header, so this is now just a passthrough — harmless either way,
// since the header is only ever set once.
function csrfFetch(url, options = {}) {
    return fetch(url, options);
}

let posts = [];


// ─── Profile Dropdown ────────────────────────────────────────────
function toggleProfileMenu() {
    const menu    = document.getElementById("profileDropdownMenu");
    const chevron = document.getElementById("profileChevron");
    const open    = menu.style.display !== "none";
    menu.style.display = open ? "none" : "block";
    if (chevron) chevron.style.transform = open ? "" : "rotate(180deg)";
    if (!open && window.refreshIcons) window.refreshIcons();
}

// Close profile dropdown when clicking outside
document.addEventListener("click", e => {
    const wrap = document.getElementById("profileDropdownWrap");
    if (wrap && !wrap.contains(e.target)) {
        const menu = document.getElementById("profileDropdownMenu");
        const chev = document.getElementById("profileChevron");
        if (menu) menu.style.display = "none";
        if (chev) chev.style.transform = "";
    }
});

// ─── Post Composer ────────────────────────────────────────────────
function expandComposer() {
    document.getElementById("composerPlaceholder").style.display = "none";
    document.getElementById("composerExpanded").style.display = "block";
    document.getElementById("composerTitle").focus();
    if (window.refreshIcons) window.refreshIcons();
}

function collapseComposer() {
    document.getElementById("composerExpanded").style.display = "none";
    document.getElementById("composerPlaceholder").style.display = "block";
    document.getElementById("composerBody").value  = "";
    document.getElementById("composerTitle").value = "";
    removeComposerImage();
    removeComposerVideo();
    removeComposerGif();
    clearLinkPreview();
    document.getElementById("composerGifPicker").style.display  = "none";
    document.getElementById("composerLinkEmbed").style.display  = "none";
}

// ─── Video ────────────────────────────────────────────────────────
function previewComposerVideo(input) {
    if (!input.files || !input.files[0]) return;
    const url = URL.createObjectURL(input.files[0]);
    document.getElementById("composerPreviewVideo").src = url;
    document.getElementById("composerVideoPreview").style.display = "block";
    // Clear other media
    removeComposerImage();
    removeComposerGif();
    clearLinkPreview();
}
function removeComposerVideo() {
    const input = document.getElementById("composerVideo");
    if (input) input.value = "";
    const vid = document.getElementById("composerPreviewVideo");
    if (vid) { vid.src = ""; }
    const wrap = document.getElementById("composerVideoPreview");
    if (wrap) wrap.style.display = "none";
}

// ─── GIF ──────────────────────────────────────────────────────────
let _selectedGifUrl = "";
let _gifSearchTimer = null;

function toggleGifPicker() {
    const picker = document.getElementById("composerGifPicker");
    const open   = picker.style.display !== "none";
    picker.style.display = open ? "none" : "block";
    if (!open) {
        document.getElementById("gifSearchInput").focus();
        searchGifs("car");  // default search
    }
}

function searchGifs(q) {
    clearTimeout(_gifSearchTimer);
    _gifSearchTimer = setTimeout(async () => {
        if (!q) return;
        const res  = await fetch(`/api/gif_search?q=${encodeURIComponent(q)}`);
        const gifs = await res.json();
        const grid = document.getElementById("gifResults");
        if (!grid) return;
        grid.innerHTML = gifs.map(g => `
            <img src="${esc(g.preview || g.url)}" class="gif-result"
                 onclick="selectGif('${esc(g.url)}')"
                 loading="lazy">
        `).join("");
    }, 400);
}

function selectGif(url) {
    _selectedGifUrl = url;

    // Clear other media first
    removeComposerImage();
    removeComposerVideo();
    clearLinkPreview();

    // Hide picker, show preview below composer
    document.getElementById("composerGifPicker").style.display = "none";

    // Show selected GIF preview
    const preview = document.getElementById("composerGifPreview");
    const img     = document.getElementById("composerSelectedGif");
    img.src = url;
    preview.style.display = "block";
}

function removeComposerGif() {
    _selectedGifUrl = "";
    const el = document.getElementById("composerGifPreview");
    if (el) el.style.display = "none";
    const img = document.getElementById("composerSelectedGif");
    if (img) img.src = "";
}

// ─── Link embed ───────────────────────────────────────────────────
let _linkData = null;

function toggleLinkEmbed() {
    const panel = document.getElementById("composerLinkEmbed");
    panel.style.display = panel.style.display !== "none" ? "none" : "block";
    if (panel.style.display === "block") {
        document.getElementById("linkUrlInput")?.focus();
    }
}

async function fetchLinkPreview() {
    const url = document.getElementById("linkUrlInput")?.value.trim();
    if (!url) return;
    const preview = document.getElementById("composerLinkPreview");
    preview.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Loading preview…</p>`;
    preview.style.display = "block";

    const res  = await csrfFetch("/api/link_preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (data.error) {
        preview.innerHTML = `<p style="color:var(--red);font-size:13px;">Could not load preview</p>`;
        return;
    }
    _linkData = data;
    preview.innerHTML = `
        <div class="link-preview-card">
            ${data.image ? `<img src="${esc(data.image)}" class="link-preview-img" onerror="this.style.display='none'">` : ""}
            <div class="link-preview-body">
                <div class="link-preview-title">${esc(data.title)}</div>
                ${data.description ? `<div class="link-preview-desc">${esc(data.description)}</div>` : ""}
                <div class="link-preview-url">${esc(data.url)}</div>
            </div>
            <button class="remove-preview-btn" onclick="clearLinkPreview()"><i data-lucide="x"></i></button>
        </div>
    `;
    if (window.refreshIcons) window.refreshIcons();
    // Clear other media
    removeComposerImage();
    removeComposerVideo();
    removeComposerGif();
}

function clearLinkPreview() {
    _linkData = null;
    const input = document.getElementById("linkUrlInput");
    if (input) input.value = "";
    const preview = document.getElementById("composerLinkPreview");
    if (preview) { preview.style.display = "none"; preview.innerHTML = ""; }
}

function onComposerInput() {
    // auto-expand textarea
    const ta = document.getElementById("composerBody");
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
}

function previewComposerImage(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById("composerPreviewImg").src = e.target.result;
        document.getElementById("composerImagePreview").style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
}

function removeComposerImage() {
    document.getElementById("composerImage").value = "";
    document.getElementById("composerPreviewImg").src = "";
    document.getElementById("composerImagePreview").style.display = "none";
}

// ─── Poll builder ───────────────────────────────────────────────
let _pollActive = false;

function togglePollBuilder() {
    _pollActive = !_pollActive;
    const builder = document.getElementById("composerPollBuilder");
    const btn     = document.getElementById("pollToolBtn");
    builder.style.display = _pollActive ? "block" : "none";
    btn.classList.toggle("active", _pollActive);
    if (!_pollActive) {
        document.getElementById("pollQuestion").value = "";
        document.querySelectorAll(".poll-option-input").forEach((el, i) => {
            el.value = "";
            el.placeholder = `Option ${i + 1}`;
        });
        // Reset to 2 options
        const list = document.getElementById("pollOptionsList");
        while (list.children.length > 2) list.removeChild(list.lastChild);
    }
    if (window.refreshIcons) window.refreshIcons();
}

function addPollOption() {
    const list = document.getElementById("pollOptionsList");
    if (list.children.length >= 4) return;
    const idx = list.children.length + 1;
    const row = document.createElement("div");
    row.className = "poll-option-row";
    row.innerHTML = `
        <input class="composer-field poll-option-input" placeholder="Option ${idx}">
        <button class="poll-remove-btn" onclick="removePollOption(this)" type="button"><i data-lucide="x"></i></button>
    `;
    list.appendChild(row);
    if (window.refreshIcons) window.refreshIcons();
}

function removePollOption(btn) {
    const list = document.getElementById("pollOptionsList");
    if (list.children.length <= 2) return;
    btn.closest(".poll-option-row").remove();
    // Re-number placeholders
    list.querySelectorAll(".poll-option-input").forEach((el, i) => {
        if (!el.value) el.placeholder = `Option ${i + 1}`;
    });
}

async function submitComposerPost() {
    const body      = document.getElementById("composerBody")?.value.trim();
    const title     = document.getElementById("composerTitle")?.value.trim();
    const imageFile = document.getElementById("composerImage")?.files[0];
    const videoFile = document.getElementById("composerVideo")?.files[0];

    if (!title) {
        const titleEl = document.getElementById("composerTitle");
        titleEl.focus();
        titleEl.style.borderColor = "var(--red)";
        titleEl.placeholder = "Title is required";
        setTimeout(() => { titleEl.style.borderColor = ""; titleEl.placeholder = "Title"; }, 3000);
        return;
    }
    if (!body) {
        const bodyEl = document.getElementById("composerBody");
        bodyEl.focus();
        bodyEl.style.borderColor = "var(--red)";
        bodyEl.placeholder = "Write something…";
        setTimeout(() => { bodyEl.style.borderColor = ""; bodyEl.placeholder = "What's going on today, friend?"; }, 3000);
        return;
    }

    const formData = new FormData();
    formData.append("body",  body);
    formData.append("car",   "");
    formData.append("title", title || "");

    if (imageFile)       formData.append("image", imageFile);
    if (videoFile)       formData.append("video", videoFile);
    if (_selectedGifUrl) formData.append("gif_url", _selectedGifUrl);
    if (_linkData) {
        formData.append("link_url",         _linkData.url || "");
        formData.append("link_title",       _linkData.title || "");
        formData.append("link_image",       _linkData.image || "");
        formData.append("link_description", _linkData.description || "");
    }

    // Poll
    if (_pollActive) {
        const question = document.getElementById("pollQuestion").value.trim();
        const opts = [...document.querySelectorAll(".poll-option-input")]
            .map(el => el.value.trim()).filter(Boolean);
        if (question && opts.length >= 2) {
            formData.append("poll_question", question);
            formData.append("poll_options",  JSON.stringify(opts));
        }
    }

    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    await fetch("/add_post", {
        method: "POST",
        headers: token ? { "X-CSRFToken": token } : {},
        body: formData
    });

    _pollActive = false;
    collapseComposer();
    await loadPosts();
    loadTrendingNews();
    if (window.refreshIcons) window.refreshIcons();
}

// ─── Poll rendering ─────────────────────────────────────────────
function renderPoll(post) {
    if (!post.poll_question || !post.poll_options) return "";
    let opts;
    try { opts = JSON.parse(post.poll_options); } catch { return ""; }
    const counts    = post.poll_vote_counts || opts.map(() => 0);
    const total     = post.poll_total_votes || 0;
    const userVote  = post.poll_user_vote;
    const hasVoted  = userVote !== null && userVote !== undefined;

    const bars = opts.map((opt, i) => {
        const count = counts[i] || 0;
        const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
        const active = hasVoted && userVote === i;
        return `
            <div class="poll-option ${hasVoted ? 'voted' : ''} ${active ? 'poll-winner' : ''}"
                 ${!hasVoted ? `onclick="votePoll(${post.id}, ${i}, this)"` : ""}
                 data-post="${post.id}" data-idx="${i}">
                <div class="poll-bar" style="width:${hasVoted ? pct : 0}%"></div>
                <span class="poll-label">${esc(opt)}</span>
                ${hasVoted ? `<span class="poll-pct">${pct}%</span>` : ""}
            </div>`;
    }).join("");

    return `
        <div class="post-poll" id="poll-${post.id}">
            <div class="poll-question">${esc(post.poll_question)}</div>
            <div class="poll-options">${bars}</div>
            <div class="poll-meta" id="poll-meta-${post.id}">${total} vote${total !== 1 ? "s" : ""}</div>
        </div>`;
}

async function votePoll(postId, optionIndex, el) {
    const res  = await csrfFetch(`/api/vote_poll/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_index: optionIndex })
    });
    const data = await res.json();
    if (data.error) return;

    const poll = document.getElementById(`poll-${postId}`);
    if (!poll) return;
    const opts = poll.querySelectorAll(".poll-option");
    const total = data.total_votes;
    opts.forEach((opt, i) => {
        const pct = total > 0 ? Math.round((data.vote_counts[i] / total) * 100) : 0;
        opt.classList.add("voted");
        opt.classList.toggle("poll-winner", i === data.user_vote);
        opt.onclick = null;
        opt.querySelector(".poll-bar").style.width = pct + "%";
        if (!opt.querySelector(".poll-pct")) {
            const sp = document.createElement("span");
            sp.className = "poll-pct";
            opt.appendChild(sp);
        }
        opt.querySelector(".poll-pct").textContent = pct + "%";
    });
    const meta = document.getElementById(`poll-meta-${postId}`);
    if (meta) meta.textContent = `${total} vote${total !== 1 ? "s" : ""}`;
}

// ─── Overflow menu (report / block / delete) ────────────────────
// The backend has had report and block endpoints for a while, but nothing in
// the feed called them — you could only report from a profile page. App store
// review tests reporting an individual post, and more to the point, a user
// being harassed shouldn't have to navigate to a profile to act.

// Who's logged in. Rendered into base.html so the menu can tell "your post"
// (offer delete) from "someone else's" (offer report and block).
function currentUser() {
    return document.querySelector('meta[name="current-user"]')?.content || "";
}

function postMenu(post) {
    const me = currentUser();
    if (!me) return "";                       // logged out: no actions
    const mine = me.toLowerCase() === (post.username || "").toLowerCase();
    const u = esc(post.username);
    return `
        <div class="pmenu">
            <button class="pmenu-btn" aria-label="More options"
                    onclick="togglePostMenu(event, ${post.id})">
                <i data-lucide="more-horizontal"></i>
            </button>
            <div class="pmenu-drop" id="pmenu-${post.id}">
                ${mine ? `
                    <button class="pmenu-item pmenu-danger" onclick="deleteOwnPost(${post.id})">
                        <i data-lucide="trash-2"></i> Delete post
                    </button>
                ` : `
                    <button class="pmenu-item" onclick="reportContent('post', ${post.id})">
                        <i data-lucide="flag"></i> Report post
                    </button>
                    <button class="pmenu-item" onclick="blockUser('${u}')">
                        <i data-lucide="ban"></i> Block @${u}
                    </button>
                `}
            </div>
        </div>`;
}

function togglePostMenu(event, id) {
    event.stopPropagation();
    const drop = document.getElementById(`pmenu-${id}`);
    if (!drop) return;
    const wasOpen = drop.classList.contains("open");
    closeAllPostMenus();
    if (!wasOpen) drop.classList.add("open");
}

function closeAllPostMenus() {
    document.querySelectorAll(".pmenu-drop.open, .cmenu-drop.open")
            .forEach(d => d.classList.remove("open"));
}
document.addEventListener("click", closeAllPostMenus);

async function reportContent(type, id) {
    const reason = prompt(
        `Why are you reporting this ${type}?\n\n` +
        `Examples: spam, harassment, hate speech, nudity, illegal content`);
    if (reason === null) return;              // cancelled
    const res = await fetch("/api/report_content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, reason })
    });
    const data = await res.json().catch(() => ({}));
    alert(data.message || data.error || "Could not send report.");
}

async function blockUser(username) {
    if (!confirm(`Block @${username}?\n\n` +
                 `You won't see their posts or comments, and they can't ` +
                 `message you.`)) return;
    const res = await fetch(`/api/block/${encodeURIComponent(username)}`,
                            { method: "POST" });
    const data = await res.json().catch(() => ({}));
    alert(data.message || data.error || "Could not block.");
    if (res.ok) location.reload();            // drop their content from view
}

async function deleteOwnPost(id) {
    if (!confirm("Delete this post? This can't be undone.")) return;
    const res = await fetch(`/delete_post/${id}`, { method: "POST" });
    if (res.ok) {
        document.getElementById(`post-card-${id}`)?.remove();
    } else {
        alert("Could not delete the post.");
    }
}

function commentMenu(c) {
    const me = currentUser();
    if (!me) return "";
    const mine = me.toLowerCase() === (c.username || "").toLowerCase();
    if (mine) return "";        // deleting own comments is a separate feature
    const u = esc(c.username);
    return `
        <div class="pmenu cmenu">
            <button class="pmenu-btn" aria-label="More options"
                    onclick="toggleCommentMenu(event, ${c.id})">
                <i data-lucide="more-horizontal"></i>
            </button>
            <div class="pmenu-drop cmenu-drop" id="cmenu-${c.id}">
                <button class="pmenu-item" onclick="reportContent('comment', ${c.id})">
                    <i data-lucide="flag"></i> Report comment
                </button>
                <button class="pmenu-item" onclick="blockUser('${u}')">
                    <i data-lucide="ban"></i> Block @${u}
                </button>
            </div>
        </div>`;
}

function toggleCommentMenu(event, id) {
    event.stopPropagation();
    const drop = document.getElementById(`cmenu-${id}`);
    if (!drop) return;
    const wasOpen = drop.classList.contains("open");
    closeAllPostMenus();
    if (!wasOpen) drop.classList.add("open");
}

// ─── Post Card ──────────────────────────────────────────────────
function createPostCard(post) {
    const card = document.createElement("div");
    card.classList.add("post-card");
    card.id = `post-card-${post.id}`;
    card.innerHTML = `
        <div class="post-header">
            <div class="post-author">
                <span class="username" onclick="window.location.href='/profile/${esc(post.username)}'">@${esc(post.username)}</span>
                ${post.main_car ? `<span class="post-user-car"><i data-lucide="car"></i>${esc(post.main_car)}</span>` : ""}
            </div>
            <div class="post-header-right">
                <span class="time">${esc(post.time)}</span>
                ${postMenu(post)}
            </div>
        </div>
        <h2 class="post-title">${esc(post.title)}</h2>
        <p class="post-body">${esc(post.body)}</p>
        ${post.image       ? `<img src="${esc(post.image)}" class="post-image" loading="lazy">` : ""}
        ${post.gif_url     ? `<img src="${esc(post.gif_url)}" class="post-image post-gif" loading="lazy">` : ""}
        ${post.video_url   ? `<video src="${esc(post.video_url)}" class="post-video" controls playsinline preload="metadata"></video>` : ""}
        ${post.link_url    ? `
            <a href="${esc(post.link_url)}" target="_blank" rel="noopener" class="post-link-card">
                ${post.link_image ? `<img src="${esc(post.link_image)}" class="post-link-img" onerror="this.style.display='none'">` : ""}
                <div class="post-link-body">
                    <div class="post-link-title">${esc(post.link_title || post.link_url)}</div>
                    ${post.link_description ? `<div class="post-link-desc">${esc(post.link_description)}</div>` : ""}
                    <div class="post-link-url">${esc(post.link_url)}</div>
                </div>
            </a>` : ""}
        ${renderPoll(post)}
        <div class="post-actions">
            <div class="vote-buttons">
                <button class="like-btn ${post.user_liked ? 'active' : ''}" id="like-btn-${post.id}" onclick="likePost(${post.id})"><i data-lucide="thumbs-up"></i> ${post.likes || 0}</button>
                <button class="dislike-btn ${post.user_disliked ? 'active' : ''}" id="dislike-btn-${post.id}" onclick="dislikePost(${post.id})"><i data-lucide="thumbs-down"></i> ${post.dislikes || 0}</button>
            </div>
            <button onclick="toggleComments(${post.id})"><i data-lucide="message-circle"></i> ${post.comment_count > 0 ? post.comment_count + ' ' : ''}Comment${post.comment_count !== 1 ? 's' : ''}</button>
            <button onclick="sharePost(${post.id})"><i data-lucide="share-2"></i> Share</button>
            <button class="save-btn" id="save-btn-${post.id}" onclick="toggleSavePost(${post.id})" title="Save post"><i data-lucide="bookmark"></i></button>
        </div>
        <div id="comments-${post.id}" class="comments-section" style="display:none;">
            <div id="comments-list-${post.id}"></div>
            <input id="comment-body-${post.id}" placeholder="Write a comment…">
            <button onclick="submitComment(${post.id})">Post Comment</button>
        </div>
    `;
    if (window.refreshIcons) window.refreshIcons();
    return card;
}

async function toggleSavePost(postId) {
    const btn = document.getElementById(`save-btn-${postId}`);
    const res  = await csrfFetch(`/toggle_save_post/${postId}`, { method: "POST" });
    const data = await res.json();
    if (btn) {
        btn.classList.toggle("saved", data.saved);
        btn.innerHTML = data.saved
            ? '<i data-lucide="bookmark-check"></i>'
            : '<i data-lucide="bookmark"></i>';
        if (window.refreshIcons) window.refreshIcons();
    }
}

function esc(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function filterByCar(carName) {
    const feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = "";
    posts.filter(p => p.car === carName).forEach(p => feed.appendChild(createPostCard(p)));
}

async function likePost(postId) {
    const res  = await csrfFetch(`/like_post/${postId}`, { method: "POST" });
    const data = await res.json();
    await refreshPostCounts(postId);
}

async function dislikePost(postId) {
    const res  = await csrfFetch(`/dislike_post/${postId}`, { method: "POST" });
    const data = await res.json();
    await refreshPostCounts(postId);
}

// Fetch fresh counts from server for a single post and update buttons
async function refreshPostCounts(postId) {
    const res  = await fetch(`/get_post_counts/${postId}`);
    const data = await res.json();

    const likeBtn    = document.getElementById(`like-btn-${postId}`);
    const dislikeBtn = document.getElementById(`dislike-btn-${postId}`);

    if (likeBtn) {
        likeBtn.innerHTML = `<i data-lucide="thumbs-up"></i> ${data.likes}`;
        likeBtn.classList.toggle("active", !!data.user_liked);
    }
    if (dislikeBtn) {
        dislikeBtn.innerHTML = `<i data-lucide="thumbs-down"></i> ${data.dislikes}`;
        dislikeBtn.classList.toggle("active", !!data.user_disliked);
    }
    if (window.refreshIcons) window.refreshIcons();
}

function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    if (section.style.display === "none") {
        section.style.display = "block";
        loadComments(postId);
    } else {
        section.style.display = "none";
    }
}

async function loadComments(postId) {
    const res      = await fetch(`/get_comments/${postId}`);
    const comments = await res.json();
    const container = document.getElementById(`comments-list-${postId}`);
    if (!container) return;
    container.innerHTML = "";

    comments.forEach(c => {
        const div = document.createElement("div");
        div.classList.add("comment");
        div.id = `comment-${c.id}`;
        div.innerHTML = `
            <div class="comment-author">
                <span class="username" onclick="window.location.href='/profile/${esc(c.username)}'">@${esc(c.username)}</span>
                ${c.main_car ? `<span class="post-user-car"><i data-lucide="car"></i>${esc(c.main_car)}</span>` : ""}
            </div>
            <p class="comment-body">${esc(c.body)}</p>
            <div class="comment-actions">
                <div class="vote-buttons">
                    <button class="like-btn ${c.user_liked ? 'active' : ''}" id="clike-${c.id}" onclick="likeComment(${c.id})">
                        <i data-lucide="thumbs-up"></i> ${c.likes || 0}
                    </button>
                    <button class="dislike-btn ${c.user_disliked ? 'active' : ''}" id="cdislike-${c.id}" onclick="dislikeComment(${c.id})">
                        <i data-lucide="thumbs-down"></i> ${c.dislikes || 0}
                    </button>
                </div>
                <button class="reply-toggle-btn" onclick="toggleReplyBox(${c.id}, ${postId})">
                    <i data-lucide="corner-down-right"></i>
                    ${c.reply_count > 0 ? c.reply_count + ' ' : ''}Repl${c.reply_count !== 1 ? 'ies' : 'y'}
                </button>
                ${commentMenu(c)}
            </div>
            <div class="replies-section" id="replies-${c.id}" style="display:none;">
                <div class="replies-list" id="replies-list-${c.id}"></div>
                <div class="reply-input-row">
                    <input id="reply-input-${c.id}" placeholder="Write a reply…" onkeydown="if(event.key==='Enter') submitReply(${c.id}, ${postId})">
                    <button onclick="submitReply(${c.id}, ${postId})"><i data-lucide="send"></i></button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
    if (window.refreshIcons) window.refreshIcons();
}

async function likeComment(commentId) {
    await csrfFetch(`/like_comment/${commentId}`, { method: "POST" });
    await refreshCommentVotes(commentId);
}

async function dislikeComment(commentId) {
    await csrfFetch(`/dislike_comment/${commentId}`, { method: "POST" });
    await refreshCommentVotes(commentId);
}

async function refreshCommentVotes(commentId) {
    const res  = await fetch(`/get_comment_counts/${commentId}`);
    const data = await res.json();
    const lb   = document.getElementById(`clike-${commentId}`);
    const db   = document.getElementById(`cdislike-${commentId}`);
    if (lb) { lb.innerHTML = `<i data-lucide="thumbs-up"></i> ${data.likes}`; lb.classList.toggle("active", !!data.user_liked); }
    if (db) { db.innerHTML = `<i data-lucide="thumbs-down"></i> ${data.dislikes}`; db.classList.toggle("active", !!data.user_disliked); }
    if (window.refreshIcons) window.refreshIcons();
}

function toggleReplyBox(commentId, postId) {
    const section = document.getElementById(`replies-${commentId}`);
    if (!section) return;
    const open = section.style.display !== "none";
    section.style.display = open ? "none" : "block";
    if (!open) loadReplies(commentId);
}

async function loadReplies(commentId) {
    const res     = await fetch(`/get_replies/${commentId}`);
    const replies = await res.json();
    const list    = document.getElementById(`replies-list-${commentId}`);
    if (!list) return;
    list.innerHTML = replies.map(r => `
        <div class="reply">
            <div class="comment-author">
                <span class="username" onclick="window.location.href='/profile/${esc(r.username)}'">@${esc(r.username)}</span>
                ${r.main_car ? `<span class="post-user-car"><i data-lucide="car"></i>${esc(r.main_car)}</span>` : ""}
            </div>
            <p class="comment-body">${esc(r.body)}</p>
            <div class="comment-actions">
                <div class="vote-buttons">
                    <button class="like-btn ${r.user_liked ? 'active' : ''}" id="clike-${r.id}" onclick="likeComment(${r.id})">
                        <i data-lucide="thumbs-up"></i> ${r.likes || 0}
                    </button>
                    <button class="dislike-btn ${r.user_disliked ? 'active' : ''}" id="cdislike-${r.id}" onclick="dislikeComment(${r.id})">
                        <i data-lucide="thumbs-down"></i> ${r.dislikes || 0}
                    </button>
                </div>
            </div>
        </div>
    `).join("");
    if (window.refreshIcons) window.refreshIcons();
}

async function submitReply(commentId, postId) {
    const input = document.getElementById(`reply-input-${commentId}`);
    const body  = input?.value.trim();
    if (!body) return;
    const res  = await csrfFetch("/add_comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, parent_id: commentId, body })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    input.value = "";
    await loadReplies(commentId);
    // update reply count button
    const replyBtn = document.querySelector(`#comment-${commentId} .reply-toggle-btn`);
    if (replyBtn) {
        const res2  = await fetch(`/get_replies/${commentId}`);
        const reps  = await res2.json();
        const count = reps.length;
        replyBtn.innerHTML = `<i data-lucide="corner-down-right"></i> ${count > 0 ? count + ' ' : ''}Repl${count !== 1 ? 'ies' : 'y'}`;
        if (window.refreshIcons) window.refreshIcons();
    }
}

async function submitComment(postId) {
    const input = document.getElementById(`comment-body-${postId}`);
    if (!input) return;
    const body = input.value.trim();
    if (!body) return;

    const res  = await csrfFetch("/add_comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, body })
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }

    input.value = "";
    await loadComments(postId);
    await refreshCommentCount(postId);
}

async function refreshCommentCount(postId) {
    const res   = await fetch(`/get_comment_count/${postId}`);
    const data  = await res.json();
    const count = data.count || 0;

    const commentBtns = document.querySelectorAll(`[onclick="toggleComments(${postId})"]`);
    commentBtns.forEach(btn => {
        btn.innerHTML = `<i data-lucide="message-circle"></i> ${count > 0 ? count + ' ' : ''}Comment${count !== 1 ? 's' : ''}`;
    });
    if (window.refreshIcons) window.refreshIcons();
}


// ─── Trending Automotive News ─────────────────────────────────────
let _newsCache = null;
let _newsCacheTime = 0;

async function loadTrendingNews() {
    const container = document.getElementById("trendingNews");
    if (!container) return;

    // Cache for 30 minutes to save API calls
    const now = Date.now();
    if (_newsCache && (now - _newsCacheTime) < 30 * 60 * 1000) {
        renderNews(_newsCache);
        return;
    }

    container.innerHTML = '<div class="trending-loading"><i data-lucide="loader"></i> Loading news…</div>';
    if (window.refreshIcons) window.refreshIcons();

    try {
        const res     = await fetch("/api/trending_news");
        const articles = await res.json();
        if (articles.error) {
            container.innerHTML = '<div class="trending-loading">News unavailable</div>';
            return;
        }
        _newsCache     = articles;
        _newsCacheTime = now;
        renderNews(articles);
    } catch(e) {
        container.innerHTML = '<div class="trending-loading">Could not load news</div>';
    }
}

function renderNews(articles) {
    const container = document.getElementById("trendingNews");
    if (!container) return;
    if (!articles || articles.length === 0) {
        container.innerHTML = '<div class="trending-loading">No news found</div>';
        return;
    }
    container.innerHTML = articles.map(a => `
        <a class="trending-article" href="${esc(a.url)}" target="_blank" rel="noopener">
            ${a.image ? `<img src="${esc(a.image)}" class="trending-img" loading="lazy" onerror="this.style.display='none'">` : ""}
            <div class="trending-article-body">
                <div class="trending-article-title">${esc(a.title)}</div>
                <div class="trending-article-meta">
                    <span>${esc(a.source)}</span>
                    <span>${esc(a.published)}</span>
                </div>
            </div>
        </a>
    `).join("");
}

async function loadPosts(query = "") {
    const url = query ? `/get_posts?q=${encodeURIComponent(query)}` : "/get_posts";
    const response = await fetch(url);
    posts = await response.json();
    const feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = "";
    if (posts.length === 0) {
        feed.innerHTML = `<div class="empty-state">No posts found.</div>`;
        return;
    }
    posts.forEach(post => feed.appendChild(createPostCard(post)));
}

async function sharePost(postId) {
    const url = `${window.location.origin}/post/${postId}`;

    // On a phone this opens the real share sheet — Instagram, Messages,
    // whatever they have — which is what people actually want from Share.
    if (navigator.share) {
        try {
            await navigator.share({ title: "RideInsight", url });
            return;
        } catch (err) {
            if (err && err.name === "AbortError") return;   // they cancelled
            // otherwise fall through to copying
        }
    }

    // No native sheet: desktop browsers mostly lack navigator.share, and it's
    // absent over plain http too. Offer the destinations directly rather than
    // dead-ending on "copy this link".
    showShareSheet(url);
}

function showShareSheet(url) {
    closeShareSheet();
    const enc = encodeURIComponent(url);
    const text = encodeURIComponent("Check this out on RideInsight");
    const targets = [
        { label: "Copy link",  icon: "link",     action: `copyShareLink('${url}')` },
        { label: "Email",      icon: "mail",     href: `mailto:?subject=${text}&body=${enc}` },
        { label: "Messages",   icon: "message-square", href: `sms:?&body=${text}%20${enc}` },
        { label: "WhatsApp",   icon: "phone",    href: `https://wa.me/?text=${text}%20${enc}` },
        { label: "X",          icon: "twitter",  href: `https://twitter.com/intent/tweet?url=${enc}&text=${text}` },
    ];
    const sheet = document.createElement("div");
    sheet.className = "story-sheet-backdrop";
    sheet.id = "shareSheet";
    sheet.innerHTML = `
        <div class="story-sheet" onclick="event.stopPropagation()">
            ${targets.map(t => t.href
                ? `<a class="story-sheet-item" href="${t.href}" target="_blank"
                      rel="noopener" onclick="closeShareSheet()">
                     <i data-lucide="${t.icon}"></i> ${t.label}
                   </a>`
                : `<button class="story-sheet-item" onclick="${t.action}">
                     <i data-lucide="${t.icon}"></i> ${t.label}
                   </button>`).join("")}
            <button class="story-sheet-item story-sheet-cancel"
                    onclick="closeShareSheet()">Cancel</button>
        </div>`;
    sheet.onclick = closeShareSheet;
    document.body.appendChild(sheet);
    if (window.refreshIcons) window.refreshIcons();
}

function closeShareSheet() {
    document.getElementById("shareSheet")?.remove();
}

async function copyShareLink(url) {
    closeShareSheet();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(url);
            alert("Link copied!");
            return;
        } catch (err) { /* fall through */ }
    }
    // Last resort where the Clipboard API is unavailable (plain http).
    prompt("Copy this link:", url);
}

// ─── Post Modal ─────────────────────────────────────────────────
function openPostModal() {
    document.getElementById("postModal").style.display = "flex";
}
function closePostModal() {
    document.getElementById("postModal").style.display = "none";
}

async function submitPost() {
    const formData = new FormData();
    formData.append("car",   document.getElementById("car").value);
    formData.append("title", document.getElementById("title").value);
    formData.append("body",  document.getElementById("body").value);
    const imageFile = document.getElementById("image").files[0];
    if (imageFile) formData.append("image", imageFile);
    await csrfFetch("/add_post", { method: "POST", body: formData });
    closePostModal();
    document.getElementById("car").value   = "";
    document.getElementById("title").value = "";
    document.getElementById("body").value  = "";
    loadPosts();
}

// ─── Sidebar ─────────────────────────────────────────────────────
function toggleMenu() {
    document.getElementById("sidebar").classList.toggle("hidden");
    document.getElementById("menuOverlay").classList.toggle("show");
}
function closeMenu() {
    document.getElementById("sidebar").classList.add("hidden");
    document.getElementById("menuOverlay").classList.remove("show");
}

// ─── Global Search ───────────────────────────────────────────────
function handleGlobalSearch(e) {
    if (e.key === "Enter") {
        const q = document.getElementById("globalSearch").value.trim();
        if (!q) return;
        if (document.getElementById("feed")) {
            loadPosts(q);
        } else {
            window.location.href = `/search?q=${encodeURIComponent(q)}`;
        }
    }
}

// ─── Notifications ───────────────────────────────────────────────
let notifOpen = false;

async function loadNotifications() {
    const res = await fetch("/get_notifications");
    if (!res.ok) return;
    const notifs = await res.json();
    const badge = document.getElementById("notifBadge");
    const list  = document.getElementById("notifList");
    if (!badge || !list) return;
    const unread = notifs.filter(n => !n.is_read).length;
    if (unread > 0) {
        badge.style.display = "flex";
        badge.textContent = unread > 9 ? "9+" : unread;
    } else {
        badge.style.display = "none";
    }
    if (notifs.length === 0) {
        list.innerHTML = `<div class="notif-empty">No notifications yet</div>`;
        return;
    }
    list.innerHTML = "";
    notifs.forEach(n => {
        const div = document.createElement("div");
        div.classList.add("notif-item");
        if (!n.is_read) div.classList.add("unread");
        div.innerHTML = `<div>${esc(n.text)}</div><div class="notif-time">${esc(n.created_at)}</div>`;
        if (n.link) {
            div.style.cursor = "pointer";
            div.onclick = () => { window.location.href = n.link; };
        }
        list.appendChild(div);
    });
}

function toggleNotifications() {
    const dropdown = document.getElementById("notifDropdown");
    notifOpen = !notifOpen;
    dropdown.classList.toggle("open", notifOpen);
    if (notifOpen) loadNotifications();
}

async function markAllRead() {
    await csrfFetch("/mark_notifications_read", { method: "POST" });
    loadNotifications();
}

// close notifications on outside click
document.addEventListener("click", (e) => {
    const btn = document.getElementById("notifBtn");
    const dd  = document.getElementById("notifDropdown");
    if (btn && dd && !btn.contains(e.target) && !dd.contains(e.target)) {
        notifOpen = false;
        dd.classList.remove("open");
    }
});

// ─── Weekly Challenge ─────────────────────────────────────────────
const WEEKLY_CHALLENGES = [
    {
        title: "Best Budget Build Under $20k",
        desc:  "Show us what you've built or dream-built without breaking the bank. Post your ride!",
        tag:   "#BudgetBuild",
        prompt:"Check out my budget build 💰 #BudgetBuild #WeeklyChallenge"
    },
    {
        title: "Before & After Transformation",
        desc:  "Drop a before and after — mods, paint, clean-up, or full build. We want to see the glow-up.",
        tag:   "#GlowUp",
        prompt:"Here's my before & after 🔧 #GlowUp #WeeklyChallenge"
    },
    {
        title: "Dream Garage — Pick 3",
        desc:  "If you could fill a 3-car garage with anything, what's in it? No budget limits.",
        tag:   "#DreamGarage",
        prompt:"My dream garage picks 🏎️ #DreamGarage #WeeklyChallenge"
    },
    {
        title: "Show Your Rarest Find",
        desc:  "Post your weirdest, rarest, or most underrated car — the one people always ask about.",
        tag:   "#RareFind",
        prompt:"Here's my rare find 🕵️ #RareFind #WeeklyChallenge"
    },
    {
        title: "First Car Stories",
        desc:  "Tell us about the first car you ever owned, drove, or fell in love with. The worse the story, the better.",
        tag:   "#FirstCar",
        prompt:"My first car story 🚗 #FirstCar #WeeklyChallenge"
    },
    {
        title: "Best Night Drive Setup",
        desc:  "What's your go-to car for a late night cruise? Show us your setup.",
        tag:   "#NightDrive",
        prompt:"My night drive setup 🌙 #NightDrive #WeeklyChallenge"
    },
    {
        title: "Track Day Machine",
        desc:  "What's your perfect track-ready build — stock or modified? Make the case.",
        tag:   "#TrackDay",
        prompt:"My track day machine 🏁 #TrackDay #WeeklyChallenge"
    },
    {
        title: "The Sleeper Build",
        desc:  "Looks stock but goes like a rocket? Show us the cars that fool everyone at the light.",
        tag:   "#Sleeper",
        prompt:"My sleeper build 😴💨 #Sleeper #WeeklyChallenge"
    },
];

function getWeekNumber() {
    const now  = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
}

function loadWeeklyChallenge() {
    const widget = document.getElementById('challengeWidget');
    if (!widget) return;
    const week = getWeekNumber();
    const c    = WEEKLY_CHALLENGES[week % WEEKLY_CHALLENGES.length];
    document.getElementById('challengeTitle').textContent = c.title;
    document.getElementById('challengeDesc').textContent  = c.desc;
    document.getElementById('challengeWeekLabel').textContent = `Week ${week}`;
    if (window.lucide) lucide.createIcons();
}

function joinChallenge() {
    const week = getWeekNumber();
    const c    = WEEKLY_CHALLENGES[week % WEEKLY_CHALLENGES.length];
    // Open the composer with pre-filled title
    expandComposer();
    const titleInput = document.getElementById('composerTitle');
    const bodyInput  = document.getElementById('composerBody');
    if (titleInput) titleInput.value = c.tag + ' — ' + c.title;
    if (bodyInput)  bodyInput.value  = c.prompt + '\n\n';
    titleInput?.focus();
}

// ─── Stories ──────────────────────────────────────────────────────
let _stories       = [];
let _storyIndex    = 0;   // which story (user slot) we're viewing
let _storyTimer    = null;
const STORY_DURATION = 6000; // ms per story

async function loadStories() {
    if (!document.getElementById('storiesStrip')) return;
    const res     = await fetch('/api/stories');
    _stories      = await res.json();
    renderStoryBubbles();
}

function renderStoryBubbles() {
    const container = document.getElementById('storyBubbles');
    if (!container) return;
    // Others = all stories except own (own is shown in the fixed left bubble)
    const others = _stories.filter(s => !s.is_own);
    container.innerHTML = others.map((s, i) => {
        const letter = (s.username || '?')[0].toUpperCase();
        const avatarHtml = s.avatar
            ? `<img src="${s.avatar}" class="story-avatar-img">`
            : `<div class="story-avatar-init">${letter}</div>`;
        const ringClass = s.viewed_by_me ? 'seen' : 'unseen';
        return `
            <div class="story-bubble-wrap" onclick="openStoryViewer(${i})">
                <div class="story-bubble">
                    <div class="story-avatar-ring ${ringClass}">${avatarHtml}</div>
                </div>
                <span class="story-label">@${escHtml(s.username)}</span>
            </div>
        `;
    }).join('');

    // Update "Your Story" bubble ring if user has an active story
    const ownBubble = document.getElementById('myStoryBubble');
    if (ownBubble) {
        const ownStory = _stories.find(s => s.is_own);
        const ring = ownBubble.querySelector('.story-avatar-ring');
        if (ring) {
            ring.classList.toggle('unseen', !!ownStory);
        }
    }

    if (window.lucide) lucide.createIcons();
}

function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let _storyList = []; // the list currently being shown in the viewer

function openStoryViewer(index) {
    _storyList  = _stories.filter(s => !s.is_own);
    if (!_storyList.length) return;
    _storyIndex = Math.max(0, Math.min(index, _storyList.length - 1));
    showStoryAt(_storyIndex);
}

function showStoryAt(idx) {
    if (idx < 0 || idx >= _storyList.length) { closeStoryViewer(); return; }
    const s = _storyList[idx];

    // Header
    const letter = (s.username || '?')[0].toUpperCase();
    document.getElementById('storyViewerAvatar').textContent = letter;
    document.getElementById('storyViewerUsername').textContent = '@' + s.username;
    document.getElementById('storyViewerTime').textContent = s.time || '';

    // Body
    const body = document.getElementById('storyViewerBody');
    body.innerHTML = '';
    if (s.image) {
        const img = document.createElement('img');
        img.src = s.image;
        body.appendChild(img);
    }
    if (s.content) {
        const p = document.createElement('div');
        p.className = 'story-viewer-text';
        p.textContent = s.content;
        body.appendChild(p);
    }

    // Progress bars
    const prog = document.getElementById('storyProgress');
    prog.innerHTML = _storyList.map((_, i) =>
        `<div class="story-progress-bar"><div class="story-progress-fill${i < idx ? ' done' : ''}" id="spf-${i}"></div></div>`
    ).join('');

    // Mark viewed
    fetch(`/api/stories/view/${s.id}`, { method: 'POST' }).catch(() => {});

    // Animate current bar
    clearTimeout(_storyTimer);
    const fill = document.getElementById(`spf-${idx}`);
    if (fill) {
        fill.style.transition = `width ${STORY_DURATION}ms linear`;
        requestAnimationFrame(() => { fill.style.width = '100%'; });
    }
    _storyTimer = setTimeout(() => {
        _storyIndex++;
        showStoryAt(_storyIndex);
    }, STORY_DURATION);

    document.getElementById('storyViewer').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function advanceStory(e) {
    if (e.target.closest('.story-viewer-close') || e.target.closest('.story-viewer-header')) return;
    const viewer = document.getElementById('storyViewer');
    const rect   = viewer.getBoundingClientRect();
    if (e.clientX < rect.width / 2) {
        _storyIndex = Math.max(0, _storyIndex - 1);
    } else {
        _storyIndex++;
    }
    clearTimeout(_storyTimer);
    showStoryAt(_storyIndex);
}

function closeStoryViewer(e) {
    if (e) e.stopPropagation();
    clearTimeout(_storyTimer);
    document.getElementById('storyViewer').style.display = 'none';
    loadStories(); // refresh viewed state
}

// "Your Story" bubble — the name always promised options, but it went straight
// to the viewer once you had a story, which left no way to post a second one.
// Now it asks, the way every stories UI does.
function openMyStoryOptions() {
    const ownStory = _stories.find(s => s.is_own);
    if (!ownStory) { openStoryCreator(); return; }
    showStorySheet();
}

function showStorySheet() {
    closeStorySheet();
    const sheet = document.createElement("div");
    sheet.className = "story-sheet-backdrop";
    sheet.id = "storySheet";
    sheet.innerHTML = `
        <div class="story-sheet" onclick="event.stopPropagation()">
            <button class="story-sheet-item" onclick="closeStorySheet(); viewMyStory()">
                <i data-lucide="eye"></i> View your story
            </button>
            <button class="story-sheet-item" onclick="closeStorySheet(); openStoryCreator()">
                <i data-lucide="plus"></i> Add another story
            </button>
            <button class="story-sheet-item story-sheet-cancel" onclick="closeStorySheet()">
                Cancel
            </button>
        </div>`;
    sheet.onclick = closeStorySheet;         // tap outside to dismiss
    document.body.appendChild(sheet);
    if (window.refreshIcons) window.refreshIcons();
}

function closeStorySheet() {
    document.getElementById("storySheet")?.remove();
}

function viewMyStory() {
    // Own story sorts first, so it's index 0.
    _storyIndex = 0;
    showStoryViewerAll(_stories, 0);
}

function showStoryViewerAll(list, idx) {
    if (!list.length || idx >= list.length) { closeStoryViewer(); return; }
    const s = list[idx];
    const letter = (s.username || '?')[0].toUpperCase();
    document.getElementById('storyViewerAvatar').textContent = letter;
    document.getElementById('storyViewerUsername').textContent = '@' + s.username;
    document.getElementById('storyViewerTime').textContent = s.time || '';
    const body = document.getElementById('storyViewerBody');
    body.innerHTML = '';
    if (s.image) { const img = document.createElement('img'); img.src = s.image; body.appendChild(img); }
    if (s.content) { const p = document.createElement('div'); p.className = 'story-viewer-text'; p.textContent = s.content; body.appendChild(p); }
    const prog = document.getElementById('storyProgress');
    prog.innerHTML = list.map((_, i) =>
        `<div class="story-progress-bar"><div class="story-progress-fill${i < idx ? ' done' : ''}" id="spf-${i}"></div></div>`
    ).join('');
    clearTimeout(_storyTimer);
    const fill = document.getElementById(`spf-${idx}`);
    if (fill) { fill.style.transition = `width ${STORY_DURATION}ms linear`; requestAnimationFrame(() => { fill.style.width = '100%'; }); }
    _storyTimer = setTimeout(() => showStoryViewerAll(list, idx + 1), STORY_DURATION);
    document.getElementById('storyViewer').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}
function openStoryCreator() {
    document.getElementById('storyCreatorModal').style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}
function closeStoryCreator() {
    document.getElementById('storyCreatorModal').style.display = 'none';
}
function previewStoryImage(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('storyImagePreview').src = e.target.result;
        document.getElementById('storyImagePreviewWrap').style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
}
function clearStoryImage() {
    document.getElementById('storyImageInput').value = '';
    document.getElementById('storyImagePreviewWrap').style.display = 'none';
}
async function submitStory() {
    const content = document.getElementById('storyContentInput').value.trim();
    const imgFile = document.getElementById('storyImageInput').files[0];
    if (!content && !imgFile) { alert('Add some text or a photo first.'); return; }
    const fd = new FormData();
    fd.append('content', content);
    if (imgFile) fd.append('image', imgFile);
    const res  = await fetch('/api/stories/add', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    closeStoryCreator();
    document.getElementById('storyContentInput').value = '';
    clearStoryImage();
    loadStories();
}

// ─── Single post page (/post/<id>) ────────────────────────────────
async function loadSinglePost(id) {
    const response = await fetch("/get_posts");
    posts = await response.json();
    const feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = "";
    const post = posts.find(p => p.id === id);
    if (!post) {
        feed.innerHTML = `<div class="empty-state">Post not found — it may have been deleted.</div>`;
        return;
    }
    feed.appendChild(createPostCard(post));
    if (window.lucide) lucide.createIcons();
    // Comments open by default on the post page
    toggleComments(id);
}

// ─── Image Lightbox (photos only, not GIFs) ───────────────────────
let _lightbox = null;

function openLightbox(src) {
    if (!_lightbox) {
        _lightbox = document.createElement("div");
        _lightbox.className = "img-lightbox";
        _lightbox.innerHTML = `
            <button class="img-lightbox-close" title="Close">&times;</button>
            <img class="img-lightbox-img" alt="">
        `;
        document.body.appendChild(_lightbox);

        const img = _lightbox.querySelector(".img-lightbox-img");

        // Click background or × → close
        _lightbox.addEventListener("click", e => {
            if (e.target !== img) closeLightbox();
        });
        // Click image → toggle zoom
        img.addEventListener("click", () => {
            img.classList.toggle("zoomed");
        });
        // Esc → close
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") closeLightbox();
        });
    }
    const img = _lightbox.querySelector(".img-lightbox-img");
    img.src = src;
    img.classList.remove("zoomed");
    _lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeLightbox() {
    if (!_lightbox) return;
    _lightbox.classList.remove("open");
    document.body.style.overflow = "";
}

// Delegate: any post photo (but NOT GIFs) opens the lightbox
document.addEventListener("click", e => {
    const t = e.target;
    if (t.tagName === "IMG" && t.classList.contains("post-image") && !t.classList.contains("post-gif")) {
        e.stopPropagation();
        openLightbox(t.src);
    }
}, true);

// ─── Init ─────────────────────────────────────────────────────────
if (document.getElementById("feed")) {
    if (window.SINGLE_POST_ID) {
        loadSinglePost(window.SINGLE_POST_ID);
    } else {
        const params = new URLSearchParams(window.location.search);
        const q = params.get("q");
        const focusPost = params.get("post");

        // Pre-fill composer when arriving from a Garage/Build share
        if (params.get("share_title")) {
            expandComposer();
            const t = document.getElementById("composerTitle");
            const b = document.getElementById("composerBody");
            if (t) t.value = params.get("share_title");
            if (b) b.value = params.get("share_body") || "";
        }
        loadPosts(q || "").then(() => {
            if (!focusPost) return;
            const card = document.getElementById(`post-card-${focusPost}`);
            if (!card) return;
            card.scrollIntoView({ behavior: "smooth", block: "start" });
            card.classList.add("post-focused");
            setTimeout(() => card.classList.remove("post-focused"), 2500);
            toggleComments(parseInt(focusPost, 10));
        });
    }
}

if (document.getElementById("storiesStrip")) {
    loadStories();
}

if (document.getElementById("challengeWidget")) {
    loadWeeklyChallenge();
}

// Poll notifications every 60s if logged in
if (document.getElementById("notifBadge")) {
    loadNotifications();
    setInterval(loadNotifications, 60000);
}
// ─── Mobile: relocate news + weekly challenge into the nav drawer ──
// On phones the right sidebar would otherwise sit at the very bottom
// of the feed. Move it to the top of the hamburger sidebar instead.
(function moveWidgetsToSidebarOnMobile() {
    const MOBILE_MAX = 900;
    let holder = null;   // wrapper we create inside the drawer
    let placed = false;

    function apply() {
        const aside   = document.querySelector(".right-sidebar");
        const sidebar = document.getElementById("sidebar");
        if (!aside || !sidebar) return;

        const isMobile = window.innerWidth <= MOBILE_MAX;

        if (isMobile && !placed) {
            holder = document.createElement("div");
            holder.className = "sidebar-widgets";
            holder.appendChild(aside);
            sidebar.insertBefore(holder, sidebar.firstChild);
            placed = true;
        } else if (!isMobile && placed) {
            // Put it back in the home layout for desktop
            const layout = document.querySelector(".home-layout");
            if (layout) layout.appendChild(aside);
            holder?.remove();
            holder = null;
            placed = false;
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", apply);
    } else {
        apply();
    }

    let t;
    window.addEventListener("resize", () => {
        clearTimeout(t);
        t = setTimeout(apply, 180);
    });
})();

// ─── Drafts ───────────────────────────────────────────────────────
let _currentDraftId = null;

async function saveDraft() {
    const title = document.getElementById("composerTitle")?.value.trim() || "";
    const body  = document.getElementById("composerBody")?.value.trim()  || "";

    if (!title && !body) {
        showDraftToast("Nothing to save yet", true);
        return;
    }

    const payload = {
        id:       _currentDraftId,
        title,
        body,
        car:      "",
        gif_url:  _selectedGifUrl || "",
        link_url: _linkData?.url || "",
    };

    try {
        const res = await csrfFetch("/api/drafts/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            _currentDraftId = null;
            collapseComposer();
            showDraftToast("Draft saved — find it under Drafts");
        } else {
            showDraftToast("Could not save draft", true);
        }
    } catch (e) {
        showDraftToast("Could not save draft", true);
    }
}

function showDraftToast(msg, isError = false) {
    document.querySelectorAll(".compare-toast").forEach(t => t.remove());
    const t = document.createElement("div");
    t.className = "compare-toast" + (isError ? " toast-error" : "");
    t.innerHTML = `<i data-lucide="${isError ? "alert-circle" : "check-circle"}"></i><span>${msg}</span>`;
    document.body.appendChild(t);
    if (window.refreshIcons) window.refreshIcons();
    setTimeout(() => t.remove(), 3200);
}

// Restore a draft handed over from the Drafts page
(function restoreDraftIntoComposer() {
    const raw = sessionStorage.getItem("ri_draft");
    if (!raw) return;
    sessionStorage.removeItem("ri_draft");

    const load = () => {
        let d;
        try { d = JSON.parse(raw); } catch (e) { return; }
        if (!document.getElementById("composerTitle")) return;

        expandComposer();
        _currentDraftId = d.id || null;
        document.getElementById("composerTitle").value = d.title || "";
        document.getElementById("composerBody").value  = d.body  || "";
        if (d.gif_url) selectGif(d.gif_url);
        onComposerInput();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", load);
    } else {
        load();
    }
})();
