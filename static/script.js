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
            <button>Comment</button>
            <button>Save</button>
            <button>Share</button>
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