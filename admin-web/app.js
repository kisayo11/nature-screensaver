const tbody = document.querySelector("#slides tbody");
const output = document.querySelector("#output");
const preview = document.querySelector("#preview");
const statusBox = document.querySelector("#status");
const gasUrlInput = document.querySelector("#gasUrl");
const draftKey = "natureScreensaverAdminDraft";
const gasKey = "natureScreensaverGasUrl";

const text = {
  waiting: "대기 중",
  ok: "정상",
  needsCheck: "확인 필요",
  generated: "config 생성 완료",
  copied: "복사 완료",
  downloaded: "다운로드 완료",
  uploading: "구글드라이브 업로드 중...",
  uploaded: "구글드라이브 업로드 성공!",
  uploadFailed: "업로드 실패: ",
  noGasUrl: "Apps Script URL을 연동 설정에 입력해주세요.",
  untitled: "제목 없음",
  titlePlaceholder: "예: 정확한 환자확인",
  drivePlaceholder: "구글드라이브 공유링크 또는 다운로드 링크",
  up: "위",
  down: "아래",
  normalize: "링크변환",
  remove: "삭제",
  folderWarning: "폴더 링크는 PNG 개별 다운로드 링크로 변환할 수 없습니다. 각 PNG 파일 링크를 넣어주세요."
};

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function setStatus(msg, type = "") {
  statusBox.textContent = msg;
  statusBox.className = `status ${type}`;
}

function isDriveFolderUrl(value) {
  return /drive\/folders\/[a-zA-Z0-9_-]+/.test(String(value || ""));
}

function extractDriveId(value) {
  const raw = String(value || "").trim();
  const fileMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idParam = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return fileMatch?.[1] || idParam?.[1] || "";
}

function driveDownloadUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isDriveFolderUrl(raw)) return raw;
  const id = extractDriveId(raw);
  if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  return raw;
}

function driveThumbnailUrl(value) {
  const id = extractDriveId(value);
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w200`;
  return "";
}

function makeDefaultFileName(order) {
  return `${String(order).padStart(2, "0")}_slide.png`;
}

function extractLinks(value) {
  return String(value || "").split(/\s+/).map(v => v.trim()).filter(Boolean);
}

/* ----------------------------------------------------
   테이블 행 생성 & 썸네일 & Drag & Drop
---------------------------------------------------- */
let draggedRow = null;

function addRow(row = {}) {
  const tr = document.createElement("tr");
  tr.draggable = true;
  
  const thumbUrl = driveThumbnailUrl(row.url || "");
  const thumbHtml = thumbUrl
    ? `<img class="thumb-img" src="${esc(thumbUrl)}" alt="미리보기" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'thumb-placeholder\\'>이미지<br>불가</span>';" />`
    : `<span class="thumb-placeholder">링크<br>없음</span>`;

  tr.innerHTML = `
    <td class="col-drag"><span class="drag-handle" title="드래그하여 순서 변경">⋮⋮</span></td>
    <td class="col-order"><input type="number" class="order" value="${esc(row.order ?? tbody.children.length + 1)}" min="1"></td>
    <td class="col-thumb"><div class="thumb-box">${thumbHtml}</div></td>
    <td class="col-title"><input class="title" value="${esc(row.title ?? "")}" placeholder="${text.titlePlaceholder}"></td>
    <td class="col-filename"><input class="fileName" value="${esc(row.fileName ?? "")}" placeholder="01_slide.png"></td>
    <td class="col-url"><input class="url" value="${esc(row.url ?? "")}" placeholder="${text.drivePlaceholder}"></td>
    <td class="col-actions actions">
      <button type="button" class="small up">${text.up}</button>
      <button type="button" class="small down">${text.down}</button>
      <button type="button" class="small normalize">${text.normalize}</button>
      <button type="button" class="small danger remove">${text.remove}</button>
    </td>
  `;

  // 드래그 앤 드롭 이벤트
  tr.addEventListener("dragstart", (e) => {
    draggedRow = tr;
    tr.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  tr.addEventListener("dragend", () => {
    tr.classList.remove("dragging");
    [...tbody.querySelectorAll("tr")].forEach(r => r.classList.remove("drag-over"));
    draggedRow = null;
    renumber();
    refresh();
  });

  tr.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (draggedRow && draggedRow !== tr) {
      tr.classList.add("drag-over");
    }
  });

  tr.addEventListener("dragleave", () => {
    tr.classList.remove("drag-over");
  });

  tr.addEventListener("drop", (e) => {
    e.preventDefault();
    tr.classList.remove("drag-over");
    if (draggedRow && draggedRow !== tr) {
      const rect = tr.getBoundingClientRect();
      const next = (e.clientY - rect.top) > (rect.height / 2);
      tbody.insertBefore(draggedRow, next ? tr.nextSibling : tr);
      renumber();
      refresh();
    }
  });

  // 버튼 이벤트
  tr.querySelector(".remove").addEventListener("click", () => { tr.remove(); renumber(); refresh(); });
  tr.querySelector(".up").addEventListener("click", () => { if (tr.previousElementSibling) tbody.insertBefore(tr, tr.previousElementSibling); renumber(); refresh(); });
  tr.querySelector(".down").addEventListener("click", () => { if (tr.nextElementSibling) tbody.insertBefore(tr.nextElementSibling, tr); renumber(); refresh(); });
  tr.querySelector(".normalize").addEventListener("click", () => {
    const input = tr.querySelector(".url");
    if (isDriveFolderUrl(input.value)) {
      alert(text.folderWarning);
      return;
    }
    input.value = driveDownloadUrl(input.value);
    updateRowThumbnail(tr);
    refresh();
  });

  // 입력 변경 핸들러
  tr.querySelector(".url").addEventListener("input", () => {
    updateRowThumbnail(tr);
    refresh();
  });
  tr.querySelectorAll("input").forEach(input => input.addEventListener("input", refresh));

  tbody.appendChild(tr);
  refresh();
}

function updateRowThumbnail(tr) {
  const urlVal = tr.querySelector(".url").value;
  const thumbBox = tr.querySelector(".thumb-box");
  const thumbUrl = driveThumbnailUrl(urlVal);
  if (thumbUrl) {
    thumbBox.innerHTML = `<img class="thumb-img" src="${esc(thumbUrl)}" alt="미리보기" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'thumb-placeholder\\'>이미지<br>불가</span>';" />`;
  } else {
    thumbBox.innerHTML = `<span class="thumb-placeholder">링크<br>없음</span>`;
  }
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
  if (!config.version) errors.push("배포 버전을 입력하세요.");
  if (!Number.isInteger(config.updateIntervalMinutes) || config.updateIntervalMinutes < 5) errors.push("업데이트 주기는 5분 이상이어야 합니다.");
  if (!Number.isInteger(config.slideDurationSeconds) || config.slideDurationSeconds < 5) errors.push("슬라이드 표시시간은 5초 이상이어야 합니다.");
  if (!config.slides.length) errors.push("슬라이드를 1개 이상 입력하세요.");
  const names = new Set();
  for (const slide of config.slides) {
    if (!Number.isInteger(slide.order) || slide.order < 1) errors.push("슬라이드 순서를 확인하세요.");
    if (!slide.fileName.endsWith(".png")) errors.push(`${slide.fileName || "fileName"}: PNG 파일명이어야 합니다.`);
    if (names.has(slide.fileName)) errors.push(`${slide.fileName}: 파일명이 중복됩니다.`);
    names.add(slide.fileName);
    if (isDriveFolderUrl(slide.url)) errors.push(`${slide.fileName}: ${text.folderWarning}`);
    else if (!slide.url.startsWith("https://")) errors.push(`${slide.fileName}: HTTPS 링크가 필요합니다.`);
  }
  return [...new Set(errors)];
}

function refresh() {
  const config = collect();
  preview.innerHTML = "";
  for (const slide of config.slides) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${esc(slide.order)}. ${esc(slide.title || text.untitled)}</strong><span>${esc(slide.fileName)} ➔ ${esc(slide.url)}</span>`;
    preview.appendChild(li);
  }
  localStorage.setItem(draftKey, JSON.stringify(config));
  const errors = validate(config);
  setStatus(errors.length ? `${text.needsCheck} ${errors.length}건` : text.ok, errors.length ? "error" : "success");
}

function generate() {
  const config = collect();
  const errors = validate(config);
  if (errors.length) {
    output.value = errors.map(e => `- ${e}`).join("\n");
    setStatus(`${text.needsCheck} ${errors.length}건`, "error");
    return null;
  }
  output.value = JSON.stringify(config, null, 2);
  setStatus(text.generated, "success");
  return config;
}

/* ----------------------------------------------------
   구글 드라이브 config.json 자동 업로드 (GAS 연동)
---------------------------------------------------- */
async function uploadToDrive() {
  const gasUrl = gasUrlInput.value.trim();
  if (!gasUrl) {
    alert(text.noGasUrl);
    gasUrlInput.focus();
    return;
  }
  const config = generate();
  if (!config) return;

  setStatus(text.uploading, "loading");
  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(config, null, 2)
    });
    const result = await response.json();
    if (result.status === "success") {
      setStatus(text.uploaded, "success");
      alert("✅ 구글 드라이브에 config.json 업로드가 완료되었습니다!");
    } else {
      throw new Error(result.message || "업로드 오류 발생");
    }
  } catch (err) {
    console.error(err);
    setStatus(text.uploadFailed + err.message, "error");
    alert(`❌ 업로드 실패: ${err.message}\n\nGoogle Apps Script URL이 올바른지 확인해주세요.`);
  }
}

/* ----------------------------------------------------
   config.json 불러오기 (Import)
---------------------------------------------------- */
const importModal = document.querySelector("#importModal");
const importTextarea = document.querySelector("#importTextarea");
const configFileInput = document.querySelector("#configFileInput");
const dropZone = document.querySelector("#dropZone");

function applyImportedConfig(config) {
  if (!config || typeof config !== "object") throw new Error("올바른 JSON 객체가 아닙니다.");
  if (config.version) document.querySelector("#version").value = config.version;
  if (config.updateIntervalMinutes) document.querySelector("#interval").value = config.updateIntervalMinutes;
  if (config.slideDurationSeconds) document.querySelector("#duration").value = config.slideDurationSeconds;
  if (config.notice !== undefined) document.querySelector("#notice").value = config.notice;

  if (Array.isArray(config.slides)) {
    tbody.innerHTML = "";
    config.slides.forEach(addRow);
  }
  refresh();
  importModal.hidden = true;
  importTextarea.value = "";
  setStatus("불러오기 완료", "success");
}

function handleJsonText(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    applyImportedConfig(parsed);
  } catch (e) {
    alert("JSON 형식이 올바르지 않습니다: " + e.message);
  }
}

document.querySelector("#importOpen").addEventListener("click", () => { importModal.hidden = false; });
document.querySelector("#importClose").addEventListener("click", () => { importModal.hidden = true; });
document.querySelector("#importApply").addEventListener("click", () => {
  const val = importTextarea.value.trim();
  if (val) handleJsonText(val);
});

configFileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => handleJsonText(evt.target.result);
    reader.readAsText(file);
  }
});

dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => handleJsonText(evt.target.result);
    reader.readAsText(file);
  }
});

/* ----------------------------------------------------
   화면보호기 실시간 시뮬레이터 (Simulator Engine)
---------------------------------------------------- */
const simulatorModal = document.querySelector("#simulatorModal");
const simImg = document.querySelector("#simImg");
const simFallback = document.querySelector("#simFallback");
const simFallbackTitle = document.querySelector("#simFallbackTitle");
const simNotice = document.querySelector("#simNotice");
const simInfo = document.querySelector("#simInfo");
const simToggle = document.querySelector("#simToggle");

let simSlides = [];
let simIndex = 0;
let simTimer = null;
let simPlaying = true;

function showSimSlide(index) {
  if (!simSlides.length) return;
  simIndex = (index + simSlides.length) % simSlides.length;
  const current = simSlides[simIndex];
  
  simInfo.textContent = `${simIndex + 1} / ${simSlides.length} 슬라이드`;
  const thumbUrl = driveThumbnailUrl(current.url);

  if (thumbUrl) {
    simImg.src = thumbUrl;
    simImg.hidden = false;
    simFallback.hidden = true;
  } else {
    simImg.hidden = true;
    simFallback.hidden = false;
    simFallbackTitle.textContent = current.title || text.untitled;
  }
}

function nextSimSlide() {
  showSimSlide(simIndex + 1);
}

function startSimTimer() {
  stopSimTimer();
  simPlaying = true;
  simToggle.textContent = "⏸ 일시정지";
  const durationSec = Number(document.querySelector("#duration").value || 20);
  simTimer = setInterval(nextSimSlide, Math.max(3, Math.min(durationSec, 10)) * 1000);
}

function stopSimTimer() {
  simPlaying = false;
  simToggle.textContent = "▶ 재생";
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
}

document.querySelector("#openSimulator").addEventListener("click", () => {
  const config = collect();
  if (!config.slides.length) {
    alert("시뮬레이션을 재생할 슬라이드가 없습니다.");
    return;
  }
  simSlides = config.slides;
  simNotice.textContent = config.notice || "";
  simulatorModal.hidden = false;
  showSimSlide(0);
  startSimTimer();
});

document.querySelector("#simClose").addEventListener("click", () => {
  stopSimTimer();
  simulatorModal.hidden = true;
});
document.querySelector("#simPrev").addEventListener("click", () => { showSimSlide(simIndex - 1); });
document.querySelector("#simNext").addEventListener("click", nextSimSlide);
document.querySelector("#simToggle").addEventListener("click", () => {
  if (simPlaying) stopSimTimer();
  else startSimTimer();
});

/* ----------------------------------------------------
   기본 초기화 & 이벤터 바인딩
---------------------------------------------------- */
function versionStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}.${p(d.getHours())}${p(d.getMinutes())}`;
}

function loadDraft() {
  // GAS URL 복원
  gasUrlInput.value = localStorage.getItem(gasKey) || "";
  gasUrlInput.addEventListener("input", () => {
    localStorage.setItem(gasKey, gasUrlInput.value.trim());
  });

  const saved = localStorage.getItem(draftKey);
  const config = saved ? JSON.parse(saved) : {
    version: "2026.07.27.001",
    updateIntervalMinutes: 60,
    slideDurationSeconds: 20,
    notice: "4주기 인증 준비",
    slides: [
      { order: 1, title: "환자권리", fileName: "01_patient_rights.png", url: "" },
      { order: 2, title: "정확한 환자확인", fileName: "02_patient_identification.png", url: "" },
      { order: 3, title: "화재대응", fileName: "03_fire_response.png", url: "" }
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
document.querySelector("#bulkOpen").addEventListener("click", () => {
  const panel = document.querySelector("#bulkPanel");
  panel.hidden = !panel.hidden;
});
document.querySelector("#bulkAdd").addEventListener("click", () => {
  const links = extractLinks(document.querySelector("#bulkLinks").value);
  const folderLinks = links.filter(isDriveFolderUrl);
  if (folderLinks.length) alert(text.folderWarning);
  links.filter(link => !isDriveFolderUrl(link)).forEach(link => {
    const order = tbody.children.length + 1;
    addRow({ order, title: "", fileName: makeDefaultFileName(order), url: driveDownloadUrl(link) });
  });
  document.querySelector("#bulkLinks").value = "";
  renumber();
  refresh();
});
document.querySelector("#clearDraft").addEventListener("click", () => {
  if (!confirm("저장된 초안을 지우고 기본값으로 돌아갈까요?")) return;
  localStorage.removeItem(draftKey);
  loadDraft();
});
document.querySelector("#renumber").addEventListener("click", () => { renumber(); refresh(); });
document.querySelector("#make").addEventListener("click", generate);
document.querySelector("#uploadDrive").addEventListener("click", uploadToDrive);
document.querySelector("#newVersion").addEventListener("click", () => { document.querySelector("#version").value = versionStamp(); refresh(); });
document.querySelector("#copy").addEventListener("click", async () => {
  if (!output.value.trim().startsWith("{")) generate();
  if (output.value.trim().startsWith("{")) {
    await navigator.clipboard.writeText(output.value);
    setStatus(text.copied, "success");
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
  setStatus(text.downloaded, "success");
});
/* ----------------------------------------------------
   Google Apps Script 세팅 가이드 모달
---------------------------------------------------- */
const gasGuideModal = document.querySelector("#gasGuideModal");
const openGasGuideBtn = document.querySelector("#openGasGuide");
const gasGuideCloseBtn = document.querySelector("#gasGuideClose");
const gasGuideOkBtn = document.querySelector("#gasGuideOk");
const copyGasCodeBtn = document.querySelector("#copyGasCode");

if (openGasGuideBtn && gasGuideModal) {
  openGasGuideBtn.addEventListener("click", () => { gasGuideModal.hidden = false; });
  gasGuideCloseBtn.addEventListener("click", () => { gasGuideModal.hidden = true; });
  gasGuideOkBtn.addEventListener("click", () => { gasGuideModal.hidden = true; });
}

if (copyGasCodeBtn) {
  copyGasCodeBtn.addEventListener("click", async () => {
    const code = document.querySelector("#gasCodeBlock code")?.textContent;
    if (code) {
      await navigator.clipboard.writeText(code);
      copyGasCodeBtn.textContent = "✅ 복사 완료!";
      setTimeout(() => { copyGasCodeBtn.textContent = "📋 코드 복사"; }, 2000);
    }
  });
}

loadDraft();
