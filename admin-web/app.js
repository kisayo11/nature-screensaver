const tbody = document.querySelector("#slides tbody");
const output = document.querySelector("#output");
const preview = document.querySelector("#preview");
const statusBox = document.querySelector("#status");
const draftKey = "natureScreensaverAdminDraft";

const text = {
  waiting: "\uB300\uAE30 \uC911",
  ok: "\uC815\uC0C1",
  needsCheck: "\uD655\uC778 \uD544\uC694",
  generated: "config \uC0DD\uC131 \uC644\uB8CC",
  copied: "\uBCF5\uC0AC \uC644\uB8CC",
  downloaded: "\uB2E4\uC6B4\uB85C\uB4DC \uC644\uB8CC",
  untitled: "\uC81C\uBAA9 \uC5C6\uC74C",
  titlePlaceholder: "\uC608: \uC815\uD655\uD55C \uD658\uC790\uD655\uC778",
  drivePlaceholder: "\uAD6C\uAE00\uB4DC\uB77C\uC774\uBE0C \uACF5\uC720\uB9C1\uD06C \uB610\uB294 \uB2E4\uC6B4\uB85C\uB4DC \uB9C1\uD06C",
  up: "\uC704",
  down: "\uC544\uB798",
  normalize: "\uB9C1\uD06C\uBCC0\uD658",
  remove: "\uC0AD\uC81C"
};

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function setStatus(value) {
  statusBox.textContent = value;
}

function driveDownloadUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fileMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idParam = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const id = fileMatch?.[1] || idParam?.[1];
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  return raw;
}

function addRow(row = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="number" class="order" value="${esc(row.order ?? tbody.children.length + 1)}" min="1"></td>
    <td><input class="title" value="${esc(row.title ?? "")}" placeholder="${text.titlePlaceholder}"></td>
    <td><input class="fileName" value="${esc(row.fileName ?? "")}" placeholder="01_slide.png"></td>
    <td><input class="url" value="${esc(row.url ?? "")}" placeholder="${text.drivePlaceholder}"></td>
    <td class="actions">
      <button type="button" class="small up">${text.up}</button>
      <button type="button" class="small down">${text.down}</button>
      <button type="button" class="small normalize">${text.normalize}</button>
      <button type="button" class="small danger remove">${text.remove}</button>
    </td>
  `;
  tr.querySelector(".remove").addEventListener("click", () => { tr.remove(); renumber(); refresh(); });
  tr.querySelector(".up").addEventListener("click", () => { if (tr.previousElementSibling) tbody.insertBefore(tr, tr.previousElementSibling); renumber(); refresh(); });
  tr.querySelector(".down").addEventListener("click", () => { if (tr.nextElementSibling) tbody.insertBefore(tr.nextElementSibling, tr); renumber(); refresh(); });
  tr.querySelector(".normalize").addEventListener("click", () => { const input = tr.querySelector(".url"); input.value = driveDownloadUrl(input.value); refresh(); });
  tr.querySelectorAll("input").forEach(input => input.addEventListener("input", refresh));
  tbody.appendChild(tr);
  refresh();
}

function renumber() {
  [...tbody.querySelectorAll("tr")].forEach((tr, index) => {
    tr.querySelector(".order").value = index + 1;
  });
}

function collect() {
  const slides = [...tbody.querySelectorAll("tr")].map(tr => ({
    order: Number(tr.querySelector(".order").value || 0),
    title: tr.querySelector(".title").value.trim(),
    fileName: tr.querySelector(".fileName").value.trim(),
    url: driveDownloadUrl(tr.querySelector(".url").value)
  })).filter(s => s.fileName || s.url || s.title).sort((a, b) => a.order - b.order);

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

function validate(config) {
  const errors = [];
  if (!config.version) errors.push("\uBC30\uD3EC \uBC84\uC804\uC744 \uC785\uB825\uD558\uC138\uC694.");
  if (!Number.isInteger(config.updateIntervalMinutes) || config.updateIntervalMinutes < 5) errors.push("\uC5C5\uB370\uC774\uD2B8 \uC8FC\uAE30\uB294 5\uBD84 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
  if (!Number.isInteger(config.slideDurationSeconds) || config.slideDurationSeconds < 5) errors.push("\uC2AC\uB77C\uC774\uB4DC \uD45C\uC2DC\uC2DC\uAC04\uC740 5\uCD08 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
  if (!config.slides.length) errors.push("\uC2AC\uB77C\uC774\uB4DC\uB97C 1\uAC1C \uC774\uC0C1 \uC785\uB825\uD558\uC138\uC694.");
  const names = new Set();
  for (const slide of config.slides) {
    if (!Number.isInteger(slide.order) || slide.order < 1) errors.push("\uC2AC\uB77C\uC774\uB4DC \uC21C\uC11C\uB97C \uD655\uC778\uD558\uC138\uC694.");
    if (!slide.fileName.endsWith(".png")) errors.push(`${slide.fileName || "fileName"}: PNG \uD30C\uC77C\uBA85\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.`);
    if (names.has(slide.fileName)) errors.push(`${slide.fileName}: \uD30C\uC77C\uBA85\uC774 \uC911\uBCF5\uB429\uB2C8\uB2E4.`);
    names.add(slide.fileName);
    if (!slide.url.startsWith("https://")) errors.push(`${slide.fileName}: HTTPS \uB9C1\uD06C\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.`);
  }
  return [...new Set(errors)];
}

function refresh() {
  const config = collect();
  preview.innerHTML = "";
  for (const slide of config.slides) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${esc(slide.order)}. ${esc(slide.title || text.untitled)}</strong><span>${esc(slide.fileName)} ? ${esc(slide.url)}</span>`;
    preview.appendChild(li);
  }
  localStorage.setItem(draftKey, JSON.stringify(config));
  const errors = validate(config);
  setStatus(errors.length ? `${text.needsCheck} ${errors.length}\uAC74` : text.ok);
}

function generate() {
  const config = collect();
  const errors = validate(config);
  if (errors.length) {
    output.value = errors.map(e => `- ${e}`).join("\n");
    setStatus(`${text.needsCheck} ${errors.length}\uAC74`);
    return null;
  }
  output.value = JSON.stringify(config, null, 2);
  setStatus(text.generated);
  return config;
}

function versionStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}.${p(d.getHours())}${p(d.getMinutes())}`;
}

function loadDraft() {
  const saved = localStorage.getItem(draftKey);
  const config = saved ? JSON.parse(saved) : {
    version: "2026.07.27.001",
    updateIntervalMinutes: 60,
    slideDurationSeconds: 20,
    notice: "4\uC8FC\uAE30 \uC778\uC99D \uC900\uBE44",
    slides: [
      { order: 1, title: "\uD658\uC790\uAD8C\uB9AC", fileName: "01_patient_rights.png", url: "" },
      { order: 2, title: "\uC815\uD655\uD55C \uD658\uC790\uD655\uC778", fileName: "02_patient_identification.png", url: "" },
      { order: 3, title: "\uD654\uC7AC\uB300\uC751", fileName: "03_fire_response.png", url: "" }
    ]
  };
  document.querySelector("#version").value = config.version || "";
  document.querySelector("#interval").value = config.updateIntervalMinutes || 60;
  document.querySelector("#duration").value = config.slideDurationSeconds || 20;
  document.querySelector("#notice").value = config.notice || "";
  tbody.innerHTML = "";
  (config.slides || []).forEach(addRow);
  refresh();
}

document.querySelector("#add").addEventListener("click", () => addRow());
document.querySelector("#renumber").addEventListener("click", () => { renumber(); refresh(); });
document.querySelector("#make").addEventListener("click", generate);
document.querySelector("#newVersion").addEventListener("click", () => { document.querySelector("#version").value = versionStamp(); refresh(); });
document.querySelector("#copy").addEventListener("click", async () => {
  if (!output.value.trim().startsWith("{")) generate();
  if (output.value.trim().startsWith("{")) {
    await navigator.clipboard.writeText(output.value);
    setStatus(text.copied);
  }
});
document.querySelector("#download").addEventListener("click", () => {
  if (!output.value.trim().startsWith("{")) generate();
  if (!output.value.trim().startsWith("{")) return;
  const blob = new Blob([output.value], { type: "application/json;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "config.json";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(text.downloaded);
});
document.querySelectorAll("#version,#interval,#duration,#notice").forEach(input => input.addEventListener("input", refresh));

loadDraft();
