let garage = [];

function createGarageCard(car) {
    const card = document.createElement("div");
    card.classList.add("garage-card");

    card.innerHTML = `
        ${car.image ? `<img src="${car.image}" class="garage-image">` : ""}

        <div class="garage-info">
            <h3>${car.year} ${car.make} ${car.model}</h3>
            <p><strong>Trim:</strong> ${car.trim}</p>
            <p><strong>Owner:</strong> @${car.owner}</p>
            <p>${car.notes}</p>

            <button onclick="openModModal(${car.id})">Add Mod</button>

            <div id="mods-${car.id}"></div>
        </div>
    `;

    return card;
}

async function loadGarage() {
    const response = await fetch("/get_garage");
    garage = await response.json();

    const garageList = document.getElementById("garage-list");
    garageList.innerHTML = "";

    garage.forEach(car => {
        const card = createGarageCard(car);
        garageList.appendChild(card);

        loadMods(car.id);
    });
}

async function loadMods(carId) {
    const response = await fetch(`/get_mods/${carId}`);
    const mods = await response.json();

    const container = document.getElementById(`mods-${carId}`);
    container.innerHTML = "";

    mods.forEach(mod => {
        const div = document.createElement("div");
        div.innerHTML = `
            <p>${mod.name} - $${mod.cost} (${mod.category})</p>
        `;
        container.appendChild(div);
    });
}

function openGarageModal() {
    document.getElementById("garageModal").style.display = "flex";
}

function closeGarageModal() {
    document.getElementById("garageModal").style.display = "none";
}

async function submitCar() {
    const owner = document.getElementById("owner").value;
    const year = document.getElementById("year").value;
    const make = document.getElementById("make").value;
    const model = document.getElementById("model").value;
    const trim = document.getElementById("trim").value;
    const image = document.getElementById("carImage").value;
    const notes = document.getElementById("notes").value;

    await fetch("/add_car", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            owner,
            year,
            make,
            model,
            trim,
            image,
            notes
        })
    });

    closeGarageModal();
    loadGarage();
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

loadGarage();