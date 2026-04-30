let posts = [];

function createPostCard(post) {
    const postCard = document.createElement("div");
    postCard.classList.add("post-card");

    postCard.innerHTML = `
        <div class="post-header">
            <p class="username">@${post.username}</p>
            <p class="user-car" onclick="filterByCar('${post.car}')">${post.car}</p>
            <p class="time">${post.time}</p>
        </div>

        <h2 class="post-title">${post.title}</h2>
        <p>${post.body}</p>

        ${post.image ? `<img src="${post.image}" class="post-image">` : ""}

        <div class="post-actions">
            <button onclick="likePost(${post.id})" id="like-btn-${post.id}">
            ▲ ${post.likes}</button>
            <button onclick="toggleComments(${post.id})">Comment</button>
            <button>Save</button>
            <button>Share</button>
        </div>
        <div id="comments-${post.id}" class="comments-section" style="display: none;">
            <div id="comments-list-${post.id}"></div>

            <input id="comment-user-${post.id}" placeholder="Username">
            <input id="comment-body-${post.id}" placeholder="Write a comment...">
            <button onclick="submitComment(${post.id})">Post Comment</button>
        </div>
        
    `;

    return postCard;
}

function filterByCar(carName) {
    const feed = document.getElementById("feed");
    feed.innerHTML = "";

    const filteredPosts = posts.filter(post => post.car === carName);

    filteredPosts.forEach(post => {
        feed.appendChild(createPostCard(post));
    });
}

async function likePost(postId) {
    const likedPosts = JSON.parse(localStorage.getItem("likedPosts")) || [];

    if (likedPosts.includes(postId)) {
        alert("You already liked this post.");
        return;
    }

    await fetch(`/like_post/${postId}`, {
        method: "POST"
    });

    likedPosts.push(postId);
    localStorage.setItem("likedPosts", JSON.stringify(likedPosts));

    loadPosts();
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);

    if (section.style.display === "none") {
        section.style.display = "block";
        await loadComments(postId);
    } else {
        section.style.display = "none";
    }
}

async function loadComments(postId) {
    const response = await fetch(`/get_comments/${postId}`);
    const comments = await response.json();

    const commentsList = document.getElementById(`comments-list-${postId}`);
    commentsList.innerHTML = "";

    comments.forEach(comment => {
        const div = document.createElement("div");
        div.classList.add("comment");

        div.innerHTML = `
            <p><strong>@${comment.username}</strong></p>
            <p>${comment.body}</p>
        `;

        commentsList.appendChild(div);
    });
}

async function submitComment(postId) {
    const username = document.getElementById(`comment-user-${postId}`).value;
    const body = document.getElementById(`comment-body-${postId}`).value;

    await fetch("/add_comment", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            post_id: postId,
            username,
            body
        })
    });

    document.getElementById(`comment-body-${postId}`).value = "";
    loadComments(postId);
}

async function loadPosts() {
    const response = await fetch("/get_posts");
    posts = await response.json();

    const feed = document.getElementById("feed");
    feed.innerHTML = "";

    posts.forEach(post => {
        feed.appendChild(createPostCard(post));
    });
}

function openPostModal() {
    document.getElementById("postModal").style.display = "flex";
}

function closePostModal() {
    document.getElementById("postModal").style.display = "none";
}

async function submitPost() {
    const username = document.getElementById("username").value;
    const car = document.getElementById("car").value;
    const title = document.getElementById("title").value;
    const body = document.getElementById("body").value;
    const image = document.getElementById("image").value;

    await fetch("/add_post", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
    },
      body: JSON.stringify({
          username,
          car,
          title,
          body,
          image
      })
    });

    closePostModal();
    loadPosts();
}

async function loadMods(carId) {
    const response = await fetch(`/get_mods/${carId}`);
    const mods = await response.json();

    const container = document.getElementById(`mods-${carId}`);
    container.innerHTML = "";
    container.classList.add("mod-list");

    let totalCost = 0;

    mods.forEach(mod => {
        const cost = Number(mod.cost);
        totalCost += cost;

        const div = document.createElement("div");
        div.classList.add("mod-item");

        div.innerHTML = `
            <p><strong>${mod.name}</strong></p>
            <p>$${cost.toFixed(2)} · ${mod.category}</p>
        `;

        container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.classList.add("total-cost");

    totalDiv.innerHTML = `
        Total Build Cost: $${totalCost.toFixed(2)}
    `;

    container.appendChild(totalDiv);
}

let currentCarId = null;

function openModModal(carId) {
    currentCarId = carId;
    document.getElementById("modModal").style.display = "flex";
}

function closeModModal() {
    document.getElementById("modModal").style.display = "none";
}

async function submitMod() {
    const name = document.getElementById("modName").value;
    const cost = document.getElementById("modCost").value;
    const category = document.getElementById("modCategory").value;

    await fetch("/add_mod", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            car_id: currentCarId,
            name,
            cost,
            category
        })
    });

    closeModModal();
    loadGarage();
}

loadMods(car.id);
loadPosts();