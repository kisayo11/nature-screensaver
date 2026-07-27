const tbody = document.querySelector("#slides tbody");
const output = document.querySelector("#output");

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function addRow(row = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="number" class="order" value="${esc(row.order ?? tbody.children.length + 1)}" min="1"></td>
    <td><input class="title" value="${esc(row.title ?? "")}"></td>
    <td><input class="fileName" value="${esc(row.fileName ?? "")}" placeholder="01_slide.png"></td>
    <td><input class="url" value="${esc(row.url ?? "")}" placeholder="https://drive.google.com/uc?export=download&id=..."></td>
    <td><button class="remove">Delete</button></td>
  `;
  tr.querySelector(".remove").addEventListener("click", () => tr.remove());
  tbody.appendChild(tr);
}

function collect() {
  const slides = [...tbody.querySelectorAll("tr")].map(tr => ({
    order: Number(tr.querySelector(".order").value || 0),
    title: tr.querySelector(".title").value.trim(),
    fileName: tr.querySelector(".fileName").value.trim(),
    url: tr.querySelector(".url").value.trim()
  })).filter(s => s.fileName && s.url).sort((a, b) => a.order - b.order);

  return {
    version: document.querySelector("#version").value.trim(),
    updateIntervalMinutes: Number(document.querySelector("#interval").value || 60),
    slideDurationSeconds: Number(document.querySelector("#duration").value || 20),
    backgroundColor: "#050505",
    fitMode: "contain",
    notice: document.querySelector("#notice").value.trim(),
    slides
  };
}

document.querySelector("#add").addEventListener("click", () => addRow());
document.querySelector("#make").addEventListener("click", () => { output.value = JSON.stringify(collect(), null, 2); });

addRow({ order: 1, title: "Patient rights", fileName: "01_patient_rights.png" });
addRow({ order: 2, title: "Patient identification", fileName: "02_patient_identification.png" });
