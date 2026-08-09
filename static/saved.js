async function loadSaved() {
    const res = await fetch("/get_comparisons");
    const data = await res.json();

    const container = document.getElementById("saved-list");
    container.innerHTML = "";

    data.forEach(comp => {
        const div = document.createElement("div");
        div.classList.add("saved-card");

        div.innerHTML = `
            <h3>${comp.car1} vs ${comp.car2}</h3>
            <p><strong>Intent:</strong> ${comp.intent}</p>
            <button onclick="openComparison('${comp.car1}', '${comp.car2}', '${comp.intent}')">
                Open Comparison
            </button>
        `;

        container.appendChild(div);
    });
}

function openComparison(car1, car2, intent) {
    const url = `/compare?car1=${encodeURIComponent(car1)}&car2=${encodeURIComponent(car2)}&intent=${encodeURIComponent(intent)}`;
    window.location.href = url;
}

loadSaved();