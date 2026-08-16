// ─── Messages JS ──────────────────────────────────────────────────
let activeUserId   = null;
let pollTimer      = null;

function esc(s) {
    if (!s) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/'/g,"&#39;").replace(/"/g,"&quot;");
}

// "2026-08-16 14:32" → "14:32" if today, else "Aug 16"
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtTime(ts) {
    if (!ts || ts.length < 16) return "";
    const today = new Date().toISOString().slice(0, 10);
    if (ts.slice(0, 10) === today) return ts.slice(11, 16);
    const mo = parseInt(ts.slice(5, 7), 10) - 1;
    return `${MONTHS[mo] || ""} ${parseInt(ts.slice(8, 10), 10)}`;
}

// Update the nav chat badge from conversation unread counts
function updateNavBadge(convs) {
    const total = convs.reduce((s, c) => s + (c.unread || 0), 0);
    // nav badge sits next to the chat icon link
    const chatLink = document.querySelector('a[href="/messages"], [onclick*="/messages"]');
    if (!chatLink) return;
    let badge = chatLink.querySelector(".notif-badge");
    if (total > 0) {
        if (!badge) {
            badge = document.createElement("span");
            badge.className = "notif-badge";
            chatLink.appendChild(badge);
        }
        badge.style.display = "flex";
        badge.textContent = total < 10 ? total : "9+";
    } else if (badge) {
        badge.style.display = "none";
    }
}

function csrfFetch(url, opts = {}) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    return fetch(url, { ...opts, headers: { ...(opts.headers||{}), ...(token?{"X-CSRFToken":token}:{}) }});
}

// ─── Conversations list ───────────────────────────────────────────
async function loadConversations() {
    const res   = await fetch("/api/conversations");
    const convs = await res.json();
    const list  = document.getElementById("conversationsList");

    if (convs.length === 0) {
        list.innerHTML = `<p class="empty-state" style="padding:16px;">No conversations yet.<br>Click the pencil icon to start one.</p>`;
        return;
    }

    list.innerHTML = convs.map(c => `
        <div class="conv-item ${activeUserId === c.id ? 'active' : ''} ${c.unread > 0 ? 'unread' : ''}"
             onclick="openThread(${c.id}, '${esc(c.username)}', '${esc(c.avatar||'')}')">
            <div class="conv-avatar-wrap">
                <img src="${esc(c.avatar||'')}" class="conv-avatar" onerror="this.style.display='none'">
                <div class="conv-avatar-placeholder">${esc(c.username[0].toUpperCase())}</div>
            </div>
            <div class="conv-info">
                <div class="conv-name">@${esc(c.username)}${c.unread > 0 ? `<span class="conv-unread-badge">${c.unread}</span>` : ''}</div>
                <div class="conv-preview">${esc(c.last_msg)}</div>
            </div>
            <div class="conv-time">${fmtTime(c.created_at)}</div>
        </div>
    `).join("");
    updateNavBadge(convs);
}

// ─── Thread ───────────────────────────────────────────────────────
async function openThread(userId, username, avatar) {
    activeUserId  = userId;
    _lastMsgCount = -1;   // force re-render for the new thread

    // Update thread UI
    const thread = document.getElementById("messagesThread");
    thread.innerHTML = `
        <div class="thread-header" id="threadHeader">
            <img src="${esc(avatar)}" class="thread-avatar" onerror="this.style.display='none'">
            <strong>@${esc(username)}</strong>
            <a href="/profile/${esc(username)}" class="view-profile-link">View profile</a>
        </div>
        <div class="thread-messages" id="threadMessages"><p class="empty-state">Loading…</p></div>
        <div class="thread-input">
            <input id="msgInput" placeholder="Write a message…" onkeydown="if(event.key==='Enter') sendMessage()">
            <button onclick="sendMessage()"><i data-lucide="send"></i></button>
        </div>
    `;
    if (window.refreshIcons) window.refreshIcons();

    // Highlight in sidebar
    document.querySelectorAll(".conv-item").forEach(el => el.classList.remove("active"));
    document.querySelector(`[onclick*="openThread(${userId}"]`)?.classList.add("active");

    await loadMessages();

    // Start polling for new messages
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadMessages, 4000);
}

let _lastMsgCount = -1;

async function loadMessages() {
    if (!activeUserId) return;
    const res  = await fetch(`/api/messages/${activeUserId}`);
    const msgs = await res.json();
    const box  = document.getElementById("threadMessages");
    if (!box) return;

    const myId = await getMyId();

    // Was the user already near the bottom before re-render?
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const hasNew     = msgs.length !== _lastMsgCount;
    _lastMsgCount    = msgs.length;

    if (!hasNew) return;   // nothing changed — don't re-render or move scroll

    box.innerHTML = msgs.length === 0
        ? `<p class="empty-state" style="padding:24px 0;">No messages yet. Say hello!</p>`
        : msgs.map(m => `
            <div class="msg-bubble ${m.sender_id === myId ? 'mine' : 'theirs'}">
                <div class="msg-body">${esc(m.body)}</div>
                <div class="msg-time">${fmtTime(m.created_at)}</div>
            </div>
        `).join("");

    // Scroll to bottom only when appropriate
    if (nearBottom || box.scrollTop === 0) box.scrollTop = box.scrollHeight;
    loadConversations();
}

let _myId = null;
async function getMyId() {
    if (_myId) return _myId;
    const res  = await fetch("/api/me");
    const data = await res.json();
    _myId = data.id;
    return _myId;
}

async function sendMessage() {
    if (!activeUserId) return;
    const input = document.getElementById("msgInput");
    const body  = input?.value?.trim();
    if (!body) return;

    input.value = "";
    await csrfFetch("/api/send_message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiver_id: activeUserId, body })
    });
    await loadMessages();
}

// ─── New conversation search ──────────────────────────────────────
function openNewMessage() {
    const panel = document.getElementById("newMsgSearch");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
    if (panel.style.display === "block") {
        document.getElementById("userSearchInput").focus();
    }
}

async function searchUsers(q) {
    const results = document.getElementById("userSearchResults");
    if (q.length < 1) { results.innerHTML = ""; return; }

    const res   = await fetch(`/api/search_users?q=${encodeURIComponent(q)}`);
    const users = await res.json();

    results.innerHTML = users.length === 0
        ? `<div class="user-result-empty">No users found</div>`
        : users.map(u => `
            <div class="user-result-item" onclick="startConversation(${u.id}, '${esc(u.username)}', '${esc(u.avatar||'')}')">
                <img src="${esc(u.avatar||'')}" class="user-result-avatar" onerror="this.style.display='none'">
                <span>@${esc(u.username)}</span>
            </div>
        `).join("");
}

function startConversation(userId, username, avatar) {
    document.getElementById("newMsgSearch").style.display = "none";
    document.getElementById("userSearchInput").value = "";
    document.getElementById("userSearchResults").innerHTML = "";
    openThread(userId, username, avatar);
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    await loadConversations();

    // If page loaded with a specific thread user (from /messages/username URL)
    if (typeof THREAD_USER !== "undefined" && THREAD_USER) {
        await openThread(THREAD_USER.id, THREAD_USER.username, THREAD_USER.avatar || "");
    } else {
        // No open thread — still poll the conversation list for new messages
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(loadConversations, 8000);
    }
});