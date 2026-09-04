const slidesList = document.querySelector("#slidesList");
const emptyState = document.querySelector("#emptyState");
const output = document.querySelector("#output");
const preview = document.querySelector("#preview");
const statusBadge = document.querySelector("#statusBadge");
const statusText = document.querySelector("#statusText");
const gasUrlInput = document.querySelector("#gasUrl");

// KPI 엘리먼트
const kpiSlideCount = document.querySelector("#kpiSlideCount");
const kpiCycleTime = document.querySelector("#kpiCycleTime");
const kpiDurationUnit = document.querySelector("#kpiDurationUnit");
const kpiInterval = document.querySelector("#kpiInterval");
const kpiVersion = document.querySelector("#kpiVersion");

const draftKey = "natureScreensaverAdminDraft";
const gasKey = "natureScreensaverGasUrl";
const historyKey = "natureScreensaverHistory";

const text = {
  waiting: "대기 중",
  ok: "정상",
  needsCheck: "확인 필요",
  generated: "config 생성 완료",
  copied: "복사 완료",
  downloaded: "다운로드 완료",
  uploading: "배포 처리 중...",
  uploaded: "배포 및 백업 완료!",
  uploadFailed: "배포 실패: ",
  untitled: "제목 없음",
  titlePlaceholder: "예: 정확한 환자확인 / 심폐소생술 절차",
  drivePlaceholder: "구글 드라이브 링크 또는 이미지 파일명",
  folderWarning: "폴더 링크는 지원되지 않습니다. 개별 이미지 파일 또는 공유 링크를 넣어주세요."
};

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function setStatus(msg, type = "waiting") {
  if (statusText) statusText.textContent = msg;
  if (statusBadge) {
    statusBadge.className = `status-badge ${type}`;
  }
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
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
  return "";
}

function makeDefaultFileName(order) {
  return `${String(order).padStart(2, "0")}_slide.png`;
}

function cleanFileNameToTitle(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/^\d+[-_.\s]*/, "")
    .trim();
}

function extractLinks(value) {
  return String(value || "").split(/\s+/).map(v => v.trim()).filter(Boolean);
}

/* ----------------------------------------------------
   배포 이력(History) 관리 엔진
---------------------------------------------------- */
function getHistory() {
  try {
    const raw = localStorage.getItem(historyKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("이력 불러오기 실패:", e);
    return [];
  }
}

function saveToHistory(config) {
  if (!config || !config.version) return;
  const list = getHistory();
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  const entry = {
    id: `hist_${Date.now()}`,
    version: config.version,
    date: dateStr,
    count: config.slides.length,
    notice: config.notice || "",
    config: JSON.parse(JSON.stringify(config))
  };

  // 동일한 버전이 이미 있으면 최신으로 교체, 없으면 맨 앞에 추가
  const existingIdx = list.findIndex(item => item.version === config.version);
  if (existingIdx >= 0) {
    list[existingIdx] = entry;
  } else {
    list.unshift(entry);
  }

  // 최대 30개 보관
  if (list.length > 30) list.pop();

  localStorage.setItem(historyKey, JSON.stringify(list));
}

function renderHistoryList() {
  const historyListEl = document.querySelector("#historyList");
  if (!historyListEl) return;

  const list = getHistory();
  const currentVersion = document.querySelector("#version")?.value?.trim();

  if (list.length === 0) {
    historyListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <h3>저장된 배포 이력이 없습니다</h3>
        <p>[배포하기] 버튼을 누르면 배포 당시의 설정이 이곳에 자동으로 기록됩니다.</p>
      </div>
    `;
    return;
  }

  historyListEl.innerHTML = "";
  list.forEach(item => {
    const isCurrent = item.version === currentVersion;
    const itemEl = document.createElement("div");
    itemEl.className = "history-item";

    itemEl.innerHTML = `
      <div class="history-item-info">
        <div class="history-item-header">
          <span class="history-version-badge">Ver ${esc(item.version)}</span>
          ${isCurrent ? '<span class="history-tag-current">현재 작업 중</span>' : ""}
          <span class="history-date">${esc(item.date)}</span>
        </div>
        <div class="history-meta">
          <span>슬라이드: <strong>${item.count}장</strong></span>
          <span>공지사항: <em>${esc(item.notice || "(없음)")}</em></span>
        </div>
      </div>
      <div class="history-item-actions">
        <button type="button" class="btn btn-primary btn-sm btn-restore" data-id="${item.id}">
          이 버전으로 복원
        </button>
        <button type="button" class="btn btn-ghost btn-sm text-danger btn-delete-history" data-id="${item.id}">
          삭제
        </button>
      </div>
    `;

    itemEl.querySelector(".btn-restore").addEventListener("click", () => {
      if (confirm(`Ver [${item.version}] 당시의 슬라이드 설정으로 복원(롤백)할까요?`)) {
        applyImportedConfig(item.config);
        document.querySelector("#historyModal").hidden = true;
        alert(`Ver [${item.version}] 설정으로 성공적으로 롤백되었습니다!`);
      }
    });

    itemEl.querySelector(".btn-delete-history").addEventListener("click", () => {
      if (confirm(`Ver [${item.version}] 이력을 삭제할까요?`)) {
        const updated = getHistory().filter(h => h.id !== item.id);
        localStorage.setItem(historyKey, JSON.stringify(updated));
        renderHistoryList();
      }
    });

    historyListEl.appendChild(itemEl);
  });
}

/* ----------------------------------------------------
   슬라이드 카드 렌더링 & Drag & Drop & 이미지 업로드
---------------------------------------------------- */
let draggedCard = null;

function renderSlideCard(data = {}) {
  const card = document.createElement("div");
  card.className = "slide-card";
  card.draggable = true;

  const currentCount = slidesList.querySelectorAll(".slide-card").length;
  const orderVal = data.order ?? currentCount + 1;
  const thumbUrl = data.localDataUrl || driveThumbnailUrl(data.url || "");
  const isLocalImage = Boolean(data.localDataUrl);

  const thumbHtml = thumbUrl
    ? `<img class="thumb-image" src="${esc(thumbUrl)}" alt="슬라이드 미리보기" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'thumb-placeholder\\'><span>⚠️</span><span>이미지 로드 불가</span></div>';" />`
    : `<div class="thumb-placeholder"><span>🖼️</span><span>이미지 선택 또는 링크</span></div>`;

  card.innerHTML = `
    <div class="slide-card-order">
      <span class="drag-grip" title="드래그하여 순서 변경">⋮⋮</span>
      <span class="order-badge">#${orderVal}</span>
      <input type="hidden" class="order-input" value="${orderVal}" />
    </div>

    <div class="slide-card-thumb" title="클릭하여 이미지 교체">
      ${thumbHtml}
      <div class="thumb-upload-overlay">
        <span>🔄 이미지 교체</span>
      </div>
      <input type="file" class="single-image-input" accept="image/png,image/jpeg" hidden />
    </div>

    <div class="slide-card-fields">
      <div class="field-row">
        <div class="input-sm-wrap">
          <label>슬라이드 제목 / 주제</label>
          <input class="slide-title" value="${esc(data.title ?? "")}" placeholder="${text.titlePlaceholder}" />
        </div>
        <div class="input-sm-wrap">
          <label>
            로컬 파일명
            ${isLocalImage ? '<span class="badge-local-file">직접 업로드됨</span>' : ''}
          </label>
          <input class="slide-filename code-font" value="${esc(data.fileName ?? makeDefaultFileName(orderVal))}" placeholder="01_slide.png" />
        </div>
      </div>

      <div class="input-sm-wrap">
        <label>구글 드라이브 링크 (또는 파일 경로)</label>
        <input class="slide-url" value="${esc(data.url ?? "")}" placeholder="${text.drivePlaceholder}" spellcheck="false" />
      </div>
    </div>

    <div class="slide-card-actions">
      <div class="btn-icon-group">
        <button type="button" class="btn btn-secondary btn-sm btn-up" title="위로 이동">↑</button>
        <button type="button" class="btn btn-secondary btn-sm btn-down" title="아래로 이동">↓</button>
      </div>
      <button type="button" class="btn btn-ghost btn-sm text-danger btn-remove" title="슬라이드 삭제">
        🗑️ 삭제
      </button>
    </div>
  `;

  // 로컬 데이터 URL 속성 보관
  if (data.localDataUrl) {
    card.dataset.localDataUrl = data.localDataUrl;
  }

  // 썸네일 클릭 시 단일 이미지 교체
  const thumbBox = card.querySelector(".slide-card-thumb");
  const singleInput = card.querySelector(".single-image-input");
  thumbBox.addEventListener("click", () => singleInput.click());
  singleInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target.result;
      card.dataset.localDataUrl = dataUrl;
      thumbBox.querySelector(".thumb-image")?.remove();
      thumbBox.querySelector(".thumb-placeholder")?.remove();
      const img = document.createElement("img");
      img.className = "thumb-image";
      img.src = dataUrl;
      thumbBox.insertBefore(img, thumbBox.firstChild);

      // 파일명 및 제목 자동 추천
      const titleInput = card.querySelector(".slide-title");
      if (!titleInput.value.trim()) {
        titleInput.value = cleanFileNameToTitle(file.name);
      }
      const fileInput = card.querySelector(".slide-filename");
      fileInput.value = file.name;
      const urlInput = card.querySelector(".slide-url");
      if (!urlInput.value.trim()) urlInput.value = file.name;

      refresh();
    };
    reader.readAsDataURL(file);
  });

  // 드래그 앤 드롭 순서 변경
  card.addEventListener("dragstart", (e) => {
    draggedCard = card;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("dragging");
    [...slidesList.querySelectorAll(".slide-card")].forEach(c => c.classList.remove("drag-over"));
    draggedCard = null;
    renumber();
    refresh();
  });

  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (draggedCard && draggedCard !== card) {
      card.classList.add("drag-over");
    }
  });

  card.addEventListener("dragleave", () => {
    card.classList.remove("drag-over");
  });

  card.addEventListener("drop", (e) => {
    e.preventDefault();
    card.classList.remove("drag-over");
    if (draggedCard && draggedCard !== card) {
      const rect = card.getBoundingClientRect();
      const next = (e.clientY - rect.top) > (rect.height / 2);
      slidesList.insertBefore(draggedCard, next ? card.nextSibling : card);
      renumber();
      refresh();
    }
  });

  // 버튼 이벤트
  card.querySelector(".btn-remove").addEventListener("click", () => {
    card.remove();
    renumber();
    refresh();
  });

  card.querySelector(".btn-up").addEventListener("click", () => {
    if (card.previousElementSibling) {
      slidesList.insertBefore(card, card.previousElementSibling);
      renumber();
      refresh();
    }
  });

  card.querySelector(".btn-down").addEventListener("click", () => {
    if (card.nextElementSibling) {
      slidesList.insertBefore(card.nextElementSibling, card);
      renumber();
      refresh();
    }
  });

  // URL 입력 변경 리스너
  const urlInput = card.querySelector(".slide-url");
  urlInput.addEventListener("change", () => {
    if (isDriveFolderUrl(urlInput.value)) {
      alert(text.folderWarning);
      return;
    }
    urlInput.value = driveDownloadUrl(urlInput.value);
    delete card.dataset.localDataUrl;
    updateCardThumbnail(card);
    refresh();
  });

  urlInput.addEventListener("input", () => {
    if (!card.dataset.localDataUrl) {
      updateCardThumbnail(card);
    }
    refresh();
  });

  card.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", refresh);
  });

  slidesList.appendChild(card);
  renumber();
  refresh();
}

function updateCardThumbnail(card) {
  if (card.dataset.localDataUrl) return;
  const urlVal = card.querySelector(".slide-url").value;
  const thumbBox = card.querySelector(".slide-card-thumb");
  const thumbUrl = driveThumbnailUrl(urlVal);

  const oldImg = thumbBox.querySelector(".thumb-image");
  const oldPh = thumbBox.querySelector(".thumb-placeholder");
  if (oldImg) oldImg.remove();
  if (oldPh) oldPh.remove();

  if (thumbUrl) {
    const img = document.createElement("img");
    img.className = "thumb-image";
    img.src = thumbUrl;
    img.alt = "슬라이드 미리보기";
    img.onerror = () => {
      img.remove();
      thumbBox.insertAdjacentHTML("afterbegin", `<div class="thumb-placeholder"><span>⚠️</span><span>이미지 로드 불가</span></div>`);
    };
    thumbBox.insertBefore(img, thumbBox.firstChild);
  } else {
    thumbBox.insertAdjacentHTML("afterbegin", `<div class="thumb-placeholder"><span>🖼️</span><span>링크를 입력하세요</span></div>`);
  }
}

function renumber() {
  const cards = [...slidesList.querySelectorAll(".slide-card")];
  cards.forEach((card, index) => {
    const order = index + 1;
    card.querySelector(".order-badge").textContent = `#${order}`;
    card.querySelector(".order-input").value = order;
  });

  if (emptyState) {
    emptyState.hidden = cards.length > 0;
  }
}

/* ----------------------------------------------------
   멀티 이미지 파일 드래그앤드롭 처리 (옵션 B 핵심)
---------------------------------------------------- */
function handleImageFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith("image/") || /\.(png|jpe?g)$/i.test(f.name));
  if (!files.length) {
    alert("PNG 또는 JPEG 이미지 파일만 등록할 수 있습니다.");
    return;
  }

  // 파일명 기준 정렬 (01_..., 02_... 순서대로)
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const currentCount = slidesList.querySelectorAll(".slide-card").length;

  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const order = currentCount + index + 1;
      const title = cleanFileNameToTitle(file.name) || `${order}번 슬라이드`;

      renderSlideCard({
        order,
        title,
        fileName: file.name,
        url: file.name,
        localDataUrl: dataUrl
      });
    };
    reader.readAsDataURL(file);
  });
}

// 이미지 멀티 드롭존 바인딩
const imageMultiDropZone = document.querySelector("#imageMultiDropZone");
const imageBatchInput = document.querySelector("#imageBatchInput");

if (imageMultiDropZone) {
  imageMultiDropZone.addEventListener("click", () => imageBatchInput.click());
  imageMultiDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    imageMultiDropZone.classList.add("dragover");
  });
  imageMultiDropZone.addEventListener("dragleave", () => {
    imageMultiDropZone.classList.remove("dragover");
  });
  imageMultiDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    imageMultiDropZone.classList.remove("dragover");
    if (e.dataTransfer.files?.length) {
      handleImageFiles(e.dataTransfer.files);
    }
  });
}

if (imageBatchInput) {
  imageBatchInput.addEventListener("change", (e) => {
    if (e.target.files?.length) {
      handleImageFiles(e.target.files);
      e.target.value = "";
    }
  });
}

/* ----------------------------------------------------
   설정 수집 & 유효성 검사 & 배포
---------------------------------------------------- */
function collect() {
  const cards = [...slidesList.querySelectorAll(".slide-card")];
  const slides = cards.map(card => {
    const rawUrl = card.querySelector(".slide-url").value.trim();
    const isLocal = Boolean(card.dataset.localDataUrl);
    return {
      order: Number(card.querySelector(".order-input").value || 0),
      title: card.querySelector(".slide-title").value.trim(),
      fileName: card.querySelector(".slide-filename").value.trim(),
      url: isLocal ? rawUrl : driveDownloadUrl(rawUrl)
    };
  }).filter(s => s.fileName || s.url || s.title).sort((a, b) => a.order - b.order);

  const duration = Number(document.querySelector("#duration").value || 20);
  const interval = Number(document.querySelector("#interval").value || 60);
  const version = document.querySelector("#version").value.trim();
  const notice = document.querySelector("#notice").value.trim();

  return {
    version,
    updateIntervalMinutes: interval,
    slideDurationSeconds: duration,
    backgroundColor: "#050505",
    fitMode: "contain",
    notice,
    slides
  };
}

function validate(config) {
  const errors = [];
  if (!config.version) errors.push("배포 버전을 입력하세요.");
  if (!Number.isInteger(config.updateIntervalMinutes) || config.updateIntervalMinutes < 5) errors.push("업데이트 주기는 5분 이상이어야 합니다.");
  if (!Number.isInteger(config.slideDurationSeconds) || config.slideDurationSeconds < 5) errors.push("슬라이드 표시시간은 5초 이상이어야 합니다.");
  if (!config.slides.length) errors.push("슬라이드를 1개 이상 등록하세요.");

  const names = new Set();
  for (const slide of config.slides) {
    if (!Number.isInteger(slide.order) || slide.order < 1) errors.push("슬라이드 순서를 확인하세요.");
    if (!/\.(png|jpe?g)$/i.test(slide.fileName)) errors.push(`${slide.fileName || "fileName"}: 파일명이 .png 또는 .jpg 로 끝나야 합니다.`);
    if (names.has(slide.fileName)) errors.push(`${slide.fileName}: 파일명이 중복됩니다.`);
    names.add(slide.fileName);
    if (isDriveFolderUrl(slide.url)) errors.push(`${slide.fileName}: ${text.folderWarning}`);
  }
  return [...new Set(errors)];
}

function refresh() {
  const config = collect();
  localStorage.setItem(draftKey, JSON.stringify(config));

  // KPI 업데이트
  const count = config.slides.length;
  const duration = config.slideDurationSeconds;
  const cycleSeconds = count * duration;

  if (kpiSlideCount) kpiSlideCount.innerHTML = `${count}<span class="kpi-unit">장</span>`;
  if (kpiCycleTime) kpiCycleTime.innerHTML = `${cycleSeconds}<span class="kpi-unit">초 (${Math.round(cycleSeconds / 60 * 10) / 10}분)</span>`;
  if (kpiDurationUnit) kpiDurationUnit.textContent = duration;
  if (kpiInterval) kpiInterval.innerHTML = `${config.updateIntervalMinutes}<span class="kpi-unit">분</span>`;
  if (kpiVersion) kpiVersion.textContent = config.version || "-";

  const errors = validate(config);
  if (errors.length) {
    setStatus(`${text.needsCheck} (${errors.length}건)`, "error");
  } else {
    setStatus(text.ok, "success");
  }
}

function generate() {
  const config = collect();
  const errors = validate(config);
  if (errors.length) {
    output.value = errors.map(e => `❌ ${e}`).join("\n");
    setStatus(`${text.needsCheck} (${errors.length}건)`, "error");
    document.querySelector("#jsonContent").hidden = false;
    return null;
  }
  output.value = JSON.stringify(config, null, 2);
  setStatus(text.generated, "success");
  return config;
}

/* ----------------------------------------------------
   배포 실행 (옵션 B: 히스토리 자동 저장 + 구글 연동)
---------------------------------------------------- */
async function executeDeploy() {
  // 1. 배포 시 자동으로 현재 날짜/시간 기반 새 버전 번호 부여
  document.querySelector("#version").value = versionStamp();
  refresh();

  const config = generate();
  if (!config) return;

  // 2. 로컬 개발 서버가 있으면 config.json 파일 자동 쓰기
  try {
    await fetch('/api/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config, null, 2)
    });
  } catch {
    // 순수 정적 환경(Vercel 등)에서는 패스
  }

  // 3. 구글 Apps Script 연동 URL이 있는 경우: 구글 드라이브 백업 동시 수행
  if (gasUrl) {
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
        alert(`🎉 배포 완료!\n\n• 배포 버전: ${config.version}\n• 슬라이드: ${config.slides.length}장\n\n구글 드라이브 백업 및 배포 이력 저장이 완료되었습니다.`);
      } else {
        throw new Error(result.message || "업로드 오류 발생");
      }
    } catch (err) {
      console.error(err);
      setStatus("배포 완료 (구글백업 실패)", "error");
      alert(`⚠️ 배포 이력은 저장되었으나 구글 드라이브 백업 전송 실패 (${err.message})\n\nGoogle Apps Script 설정을 확인해주세요.`);
    }
  } else {
    // 4. 구글 연동이 없는 경우: Vercel / GitHub 직접 배포 모드
    setStatus(text.uploaded, "success");
    alert(`🎉 배포 완료! [Ver ${config.version}]\n\n• 슬라이드: ${config.slides.length}장\n• 배포 이력(History) 및 로컬 config.json에 최신 설정이 저장되었습니다.\n\n깃허브에 푸시되면 Vercel(nature-screensaver.vercel.app)을 통해 전 병원 PC에 자동 반영됩니다!`);
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
    slidesList.innerHTML = "";
    config.slides.forEach(renderSlideCard);
  }
  renumber();
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
document.querySelector("#importCancel").addEventListener("click", () => { importModal.hidden = true; });
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
   화면보호기 실시간 시뮬레이터
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

  simInfo.textContent = `${simIndex + 1} / ${simSlides.length} 슬라이드 (${current.title || text.untitled})`;
  
  // 로컬 카드의 데이터 URL이 있으면 우선 사용
  const card = [...slidesList.querySelectorAll(".slide-card")][simIndex];
  const localUrl = card?.dataset?.localDataUrl;
  const thumbUrl = localUrl || driveThumbnailUrl(current.url);

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

function openSimulator() {
  const config = collect();
  if (!config.slides.length) {
    alert("시뮬레이션할 슬라이드가 등록되어 있지 않습니다.");
    return;
  }
  simSlides = config.slides;
  simNotice.textContent = config.notice || "";
  simulatorModal.hidden = false;
  showSimSlide(0);
  startSimTimer();
}

document.querySelector("#openSimulator").addEventListener("click", openSimulator);
document.querySelector("#floatSimulator").addEventListener("click", openSimulator);

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
   배포 이력 모달 이벤트 바인딩
---------------------------------------------------- */
const historyModal = document.querySelector("#historyModal");
const historyOpenBtn = document.querySelector("#historyOpen");
const historyCloseBtn = document.querySelector("#historyClose");
const historyOkBtn = document.querySelector("#historyOk");
const historyClearBtn = document.querySelector("#historyClear");

if (historyOpenBtn && historyModal) {
  historyOpenBtn.addEventListener("click", () => {
    renderHistoryList();
    historyModal.hidden = false;
  });
  historyCloseBtn.addEventListener("click", () => { historyModal.hidden = true; });
  historyOkBtn.addEventListener("click", () => { historyModal.hidden = true; });
  historyClearBtn.addEventListener("click", () => {
    if (confirm("모든 배포 이력을 삭제하시겠습니까?")) {
      localStorage.removeItem(historyKey);
      renderHistoryList();
    }
  });
}

/* ----------------------------------------------------
   기본 초기화 & 전역 이벤트
---------------------------------------------------- */
function versionStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}.${p(d.getHours())}${p(d.getMinutes())}`;
}

function loadDraft() {
  gasUrlInput.value = localStorage.getItem(gasKey) || "";
  gasUrlInput.addEventListener("input", () => {
    localStorage.setItem(gasKey, gasUrlInput.value.trim());
  });

  const saved = localStorage.getItem(draftKey);
  const config = saved ? JSON.parse(saved) : {
    version: "2026.07.27.001",
    updateIntervalMinutes: 60,
    slideDurationSeconds: 20,
    notice: "4주기 의료기관 인증평가 준비",
    slides: [
      { order: 1, title: "환자권리 존중 및 보호", fileName: "01_patient_rights.png", url: "" },
      { order: 2, title: "정확한 환자확인 절차", fileName: "02_patient_identification.png", url: "" },
      { order: 3, title: "화재 및 비상대응 행동요령", fileName: "03_fire_response.png", url: "" }
    ]
  };

  document.querySelector("#version").value = config.version || "";
  document.querySelector("#interval").value = config.updateIntervalMinutes || 60;
  document.querySelector("#duration").value = config.slideDurationSeconds || 20;
  document.querySelector("#notice").value = config.notice || "";

  slidesList.innerHTML = "";
  (config.slides || []).forEach(renderSlideCard);
  renumber();
  refresh();
}

// 배포 실행 바인딩
document.querySelector("#uploadDrive").addEventListener("click", executeDeploy);
document.querySelector("#floatUpload").addEventListener("click", executeDeploy);

// 슬라이드 관리 조작
document.querySelector("#add").addEventListener("click", () => {
  renderSlideCard();
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
});

document.querySelector("#bulkOpen").addEventListener("click", () => {
  const panel = document.querySelector("#bulkPanel");
  panel.hidden = !panel.hidden;
});

document.querySelector("#bulkAdd").addEventListener("click", () => {
  const links = extractLinks(document.querySelector("#bulkLinks").value);
  const folderLinks = links.filter(isDriveFolderUrl);
  if (folderLinks.length) alert(text.folderWarning);

  const currentCount = slidesList.querySelectorAll(".slide-card").length;
  links.filter(link => !isDriveFolderUrl(link)).forEach((link, idx) => {
    const order = currentCount + idx + 1;
    renderSlideCard({ order, title: "", fileName: makeDefaultFileName(order), url: driveDownloadUrl(link) });
  });

  document.querySelector("#bulkLinks").value = "";
  document.querySelector("#bulkPanel").hidden = true;
  renumber();
  refresh();
});

document.querySelector("#clearDraft").addEventListener("click", () => {
  if (!confirm("초안을 초기화하고 기본 상태로 되돌릴까요?")) return;
  localStorage.removeItem(draftKey);
  loadDraft();
});

document.querySelector("#renumber").addEventListener("click", () => {
  renumber();
  refresh();
});

document.querySelector("#newVersion").addEventListener("click", () => {
  document.querySelector("#version").value = versionStamp();
  refresh();
});

// JSON 조작
document.querySelector("#make").addEventListener("click", generate);
document.querySelector("#copy").addEventListener("click", async () => {
  if (!output.value.trim().startsWith("{")) generate();
  if (output.value.trim().startsWith("{")) {
    await navigator.clipboard.writeText(output.value);
    setStatus(text.copied, "success");
    alert("config.json 내용이 클립보드에 복사되었습니다.");
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

// 어코디언 토글
const settingsToggle = document.querySelector("#settingsToggle");
const settingsContent = document.querySelector("#settingsContent");
settingsToggle.addEventListener("click", () => {
  const isHidden = settingsContent.hidden;
  settingsContent.hidden = !isHidden;
  settingsToggle.classList.toggle("collapsed", !isHidden);
});

const jsonToggle = document.querySelector("#jsonToggle");
const jsonContent = document.querySelector("#jsonContent");
jsonToggle.addEventListener("click", () => {
  const isHidden = jsonContent.hidden;
  jsonContent.hidden = !isHidden;
  jsonToggle.classList.toggle("collapsed", !isHidden);
  if (!isHidden && !output.value) {
    generate();
  }
});

// GAS 가이드 모달
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

// 전역 인풋 리스너
["#version", "#interval", "#duration", "#notice"].forEach(sel => {
  document.querySelector(sel)?.addEventListener("input", refresh);
});

// 초기화
loadDraft();
