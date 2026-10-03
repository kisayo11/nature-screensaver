const slidesList = document.querySelector("#slidesList");
const emptyState = document.querySelector("#emptyState");
const output = document.querySelector("#output");
const preview = document.querySelector("#preview");
const statusBadge = document.querySelector("#statusBadge");
const statusText = document.querySelector("#statusText");
const githubTokenInput = document.querySelector("#githubToken");
const githubStatusBadge = document.querySelector("#githubStatusBadge");
const testGithubBtn = document.querySelector("#testGithubBtn");
const toggleGithubTokenBtn = document.querySelector("#toggleGithubToken");
const openGithubGuideBtn = document.querySelector("#openGithubGuide");
const githubGuideModal = document.querySelector("#githubGuideModal");
const githubGuideCloseBtn = document.querySelector("#githubGuideClose");
const githubGuideOkBtn = document.querySelector("#githubGuideOk");

// 배포 진행 상태 모달 엘리먼트
const deployProgressModal = document.querySelector("#deployProgressModal");
const deployProgressTitle = document.querySelector("#deployProgressTitle");
const deployProgressBar = document.querySelector("#deployProgressBar");
const deployStatusMessage = document.querySelector("#deployStatusMessage");
const deployProgressFooter = document.querySelector("#deployProgressFooter");
const deployDoneBtn = document.querySelector("#deployDoneBtn");

// KPI 엘리먼트
const kpiSlideCount = document.querySelector("#kpiSlideCount");
const kpiCycleTime = document.querySelector("#kpiCycleTime");
const kpiDurationUnit = document.querySelector("#kpiDurationUnit");
const kpiInterval = document.querySelector("#kpiInterval");
const kpiVersion = document.querySelector("#kpiVersion");

// 보안 및 인증 엘리먼트
const authLockScreen = document.querySelector("#authLockScreen");
const authPasswordInput = document.querySelector("#authPasswordInput");
const authSubmitBtn = document.querySelector("#authSubmitBtn");
const authForm = document.querySelector("#authForm");
const authErrorMsg = document.querySelector("#authErrorMsg");
const lockAppBtn = document.querySelector("#lockAppBtn");
const changePwdOpen = document.querySelector("#changePwdOpen");
const passwordModal = document.querySelector("#passwordModal");
const pwdClose = document.querySelector("#pwdClose");
const pwdCancel = document.querySelector("#pwdCancel");
const pwdSave = document.querySelector("#pwdSave");
const currentPwd = document.querySelector("#currentPwd");
const newPwd = document.querySelector("#newPwd");
const confirmPwd = document.querySelector("#confirmPwd");
const pwdChangeError = document.querySelector("#pwdChangeError");

const draftKey = "natureScreensaverAdminDraft";
const historyKey = "natureScreensaverHistory";
const authKey = "natureScreensaverAuth";
const pwdKey = "natureScreensaverPassword";
const githubTokenKey = "natureScreensaverGithubToken";
const defaultPassword = "01053884497";

const GITHUB_OWNER = "kisayo11";
const GITHUB_REPO = "nature-screensaver";
const GITHUB_BRANCH = "main";

const text = {
  waiting: "대기 중",
  ok: "정상",
  needsCheck: "확인 필요",
  generated: "config 생성 완료",
  copied: "복사 완료",
  downloaded: "다운로드 완료",
  uploading: "배포 처리 중...",
  uploaded: "배포 완료!",
  uploadFailed: "배포 실패: ",
  untitled: "제목 없음",
  titlePlaceholder: "예: 정확한 환자확인 / 심폐소생술 절차",
  drivePlaceholder: "슬라이드 이미지 파일명 또는 URL (예: 슬라이드1.PNG)",
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

function getSlideImageUrl(url, localDataUrl = null) {
  if (localDataUrl) return localDataUrl;
  const raw = String(url || "").trim();
  if (!raw) return "";

  // 1. 구글 드라이브 링크인 경우
  if (raw.includes("drive.google.com")) {
    const id = extractDriveId(raw);
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
  }

  // 2. data: URL (로컬 업로드 Base64)
  if (raw.startsWith("data:")) return raw;

  // 3. 로컬 호스트(localhost)에서 실행 중이고 URL이 vercel slides 주소인 경우 로컬 경로 매핑
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    if (raw.includes("/slides/")) {
      const fileName = raw.substring(raw.lastIndexOf("/slides/") + 8);
      return `/slides/${fileName}`;
    }
  }

  // 4. 일반 http/https 절대 URL
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  // 5. 상대 경로 (/slides/... 또는 slides/...)
  if (raw.startsWith("/")) return raw;
  if (raw.startsWith("slides/")) return "/" + raw;

  // 6. 파일명만 있는 경우 (예: 슬라이드1.PNG)
  return `/slides/${raw}`;
}

function driveDownloadUrl(value) {
  return String(value || "").trim();
}

function driveThumbnailUrl(value) {
  return getSlideImageUrl(value);
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
  const thumbUrl = getSlideImageUrl(data.url, data.localDataUrl);
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

      <div class="field-row">
        <div class="input-sm-wrap" style="flex: 2;">
          <label>슬라이드 이미지 주소 (URL 또는 파일명)</label>
          <input class="slide-url" value="${esc(data.url ?? "")}" placeholder="${text.drivePlaceholder}" spellcheck="false" />
        </div>
        <div class="input-sm-wrap" style="flex: 1; min-width: 120px;">
          <label>개별 노출시간(초)</label>
          <input type="number" class="slide-duration" min="3" placeholder="기본값(설정)" value="${data.durationSeconds ? data.durationSeconds : ""}" />
        </div>
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
    let rawUrl = card.querySelector(".slide-url").value.trim();
    const isLocal = Boolean(card.dataset.localDataUrl);
    const fileName = card.querySelector(".slide-filename").value.trim();
    const durInput = card.querySelector(".slide-duration");
    const durVal = durInput && durInput.value.trim() ? Number(durInput.value) : undefined;

    // 로컬에서 업로드된 이미지인 경우 자동으로 Vercel /slides/ 주소 자동 완성!
    if (isLocal && (!rawUrl || !rawUrl.startsWith("https://drive.google.com/"))) {
      rawUrl = `https://nature-screensaver.vercel.app/slides/${fileName}`;
      card.querySelector(".slide-url").value = rawUrl;
    }

    const slideObj = {
      order: Number(card.querySelector(".order-input").value || 0),
      title: card.querySelector(".slide-title").value.trim(),
      fileName: fileName,
      url: isLocal ? rawUrl : driveDownloadUrl(rawUrl)
    };
    if (durVal && durVal >= 3) {
      slideObj.durationSeconds = durVal;
    }
    return slideObj;
  }).filter(s => s.fileName || s.url || s.title).sort((a, b) => a.order - b.order);

  const duration = Number(document.querySelector("#duration").value || 20);
  const interval = Number(document.querySelector("#interval").value || 60);
  const version = document.querySelector("#version").value.trim();
  const notice = document.querySelector("#notice").value.trim();
  const dDayTitle = document.querySelector("#dDayTitle")?.value.trim() || undefined;
  const dDayDate = document.querySelector("#dDayDate")?.value.trim() || undefined;

  const res = {
    version,
    updateIntervalMinutes: interval,
    slideDurationSeconds: duration,
    backgroundColor: "#050505",
    fitMode: "contain",
    notice,
    slides
  };
  if (dDayTitle) res.dDayTitle = dDayTitle;
  if (dDayDate) res.dDayDate = dDayDate;
  return res;
}

function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return "0초";
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m > 0 && s > 0) return `${m}분 ${s}초`;
  if (m > 0) return `${m}분`;
  return `${s}초`;
}

function validate(config) {
  const errors = [];
  if (!config.version) errors.push("배포 버전을 입력하세요.");
  if (!Number.isInteger(config.updateIntervalMinutes) || config.updateIntervalMinutes < 1) errors.push("업데이트 주기는 1분 이상이어야 합니다.");
  if (!Number.isInteger(config.slideDurationSeconds) || config.slideDurationSeconds < 3) errors.push("슬라이드 표시시간은 3초 이상이어야 합니다.");
  if (!config.slides.length) errors.push("슬라이드를 1개 이상 등록하세요.");

  const names = new Set();
  for (const slide of config.slides) {
    if (!Number.isInteger(slide.order) || slide.order < 1) errors.push("슬라이드 순서를 확인하세요.");
    if (!/\.(png|jpe?g|webp)$/i.test(slide.fileName)) errors.push(`${slide.fileName || "fileName"}: 파일명이 .png, .jpg, 또는 .webp 로 끝나야 합니다.`);
    if (names.has(slide.fileName)) errors.push(`${slide.fileName}: 파일명이 중복됩니다.`);
    names.add(slide.fileName);
    if (isDriveFolderUrl(slide.url)) errors.push(`${slide.fileName}: ${text.folderWarning}`);
  }
  return [...new Set(errors)];
}

function refresh() {
  const config = collect();
  localStorage.setItem(draftKey, JSON.stringify(config));

  // KPI 업데이트 (개별 슬라이드 노출시간 반영)
  const count = config.slides.length;
  const duration = config.slideDurationSeconds;
  const cycleSeconds = config.slides.reduce((acc, s) => acc + (s.durationSeconds || duration), 0);

  if (kpiSlideCount) kpiSlideCount.innerHTML = `${count}<span class="kpi-unit">장</span>`;
  if (kpiCycleTime) {
    kpiCycleTime.innerHTML = `${formatDuration(cycleSeconds)}<span class="kpi-unit"> (${cycleSeconds}초)</span>`;
  }
  if (kpiDurationUnit) kpiDurationUnit.textContent = duration;
  if (kpiInterval) kpiInterval.innerHTML = `${config.updateIntervalMinutes}<span class="kpi-unit">분</span>`;
  if (kpiVersion) kpiVersion.textContent = config.version || "-";

  syncPresetChips();

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
   GitHub API 연동 & 클라우드 원격 배포 엔진
---------------------------------------------------- */
function setGithubStatus(type, text) {
  if (!githubStatusBadge) return;
  githubStatusBadge.className = `status-chip ${type}`;
  githubStatusBadge.textContent = text;
}

async function verifyGithubToken(token, showToast = false) {
  if (!token) {
    setGithubStatus("neutral", "토큰 미설정");
    if (showToast) alert("GitHub 토큰을 입력해 주세요.");
    return false;
  }
  setGithubStatus("loading", "연결 확인 중...");
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "Authorization": `Bearer ${token}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      const canPush = Boolean(data.permissions?.push || data.permissions?.admin);
      setGithubStatus("success", "✅ GitHub 연결됨");
      if (showToast) {
        alert(`🎉 GitHub 레포지토리 연동 성공!\n\n• 저장소: ${data.full_name} (${data.private ? 'Private' : 'Public'})\n• 배포 권한: ${canPush ? '푸시 가능(정상)' : '읽기 전용(권한 확인 필요)'}\n• 이제 어느 자리에서든 [배포하기]를 누르면 즉시 클라우드에 저장 및 배포됩니다.`);
      }
      return true;
    } else {
      const err = await res.json().catch(() => ({}));
      setGithubStatus("error", "❌ 토큰 인증 실패");
      if (showToast) {
        alert(`❌ GitHub 연결 실패: ${err.message || res.statusText}\n\n토큰이 올바른지, 만료되지 않았는지, 'repo' 권한이 체크되어 있는지 확인해 주세요.`);
      }
      return false;
    }
  } catch (e) {
    setGithubStatus("error", "❌ 네트워크 오류");
    if (showToast) alert(`네트워크 오류로 GitHub에 연결할 수 없습니다: ${e.message}`);
    return false;
  }
}

function setDeployStep(stepId, status, progress, message) {
  const item = document.querySelector(`#${stepId}`);
  if (item) {
    item.className = `deploy-step-item ${status}`;
    const icon = item.querySelector(".step-status-icon");
    if (icon) {
      if (status === "active") icon.textContent = "⏳";
      else if (status === "done") icon.textContent = "✅";
      else if (status === "error") icon.textContent = "❌";
      else icon.textContent = "⚪";
    }
  }
  if (deployProgressBar && progress !== undefined) {
    deployProgressBar.style.width = `${progress}%`;
  }
  if (deployStatusMessage && message) {
    deployStatusMessage.textContent = message;
  }
}

function utf8ToBase64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}

async function executeDeploy() {
  // 1. 배포 시 자동으로 현재 날짜/시간 기반 새 버전 번호 부여
  document.querySelector("#version").value = versionStamp();
  refresh();

  const config = generate();
  if (!config) return;

  // 배포 진행 모달 열기
  if (deployProgressModal) {
    deployProgressModal.hidden = false;
    if (deployProgressFooter) deployProgressFooter.hidden = true;
    if (deployProgressTitle) deployProgressTitle.textContent = "전 병원 PC 배포 진행 중";
    ["stepCheck", "stepAuth", "stepUpload", "stepCommit", "stepVercel"].forEach(id => {
      setDeployStep(id, "waiting", 0, "");
    });
  }

  try {
    // 1단계: 유효성 검사 및 브라우저 이력 저장
    setDeployStep("stepCheck", "active", 15, "설정값 및 슬라이드 유효성을 검사하고 있습니다...");
    saveToHistory(config);
    localStorage.setItem(draftKey, JSON.stringify(config));
    setDeployStep("stepCheck", "done", 25, "슬라이드 유효성 검사 완료");

    // 이미지 맵 추출
    const imagesMap = {};
    slidesList.querySelectorAll(".slide-card").forEach(card => {
      const fn = card.querySelector(".slide-filename").value.trim();
      const dataUrl = card.dataset.localDataUrl;
      if (fn && dataUrl) imagesMap[fn] = dataUrl;
    });

    const token = (githubTokenInput?.value || localStorage.getItem(githubTokenKey) || "").trim();

    // 2단계: Vercel Serverless /api/deploy 우선 호출 (토큰 서버사이드 은닉 및 일괄 트랜잭션)
    setDeployStep("stepAuth", "active", 35, "배포 서버 연결 상태를 확인하고 있습니다...");
    let serverlessSuccess = false;
    try {
      const serverlessRes = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, images: imagesMap, token })
      });
      if (serverlessRes.ok) {
        const sJson = await serverlessRes.json();
        setDeployStep("stepAuth", "done", 45, "배포 권한 인증 완료 (서버리스)");
        setDeployStep("stepUpload", "done", 70, `슬라이드 이미지 반영 완료 (${sJson.uploadedImages ?? Object.keys(imagesMap).length}건)`);
        setDeployStep("stepCommit", "done", 88, `단일 커밋 & 푸시 완료 (${(sJson.commitSha || "").substring(0, 7)})`);
        serverlessSuccess = true;
      }
    } catch (sErr) {
      console.warn("서버리스 배포 통신 스킵 -> 브라우저 직접 호출로 폴백:", sErr.message);
    }

    if (!serverlessSuccess) {
      // 로컬 dev-server 또는 브라우저 직접 호출 폴백
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      let useGithubApi = Boolean(token);

      if (!useGithubApi && !isLocalhost) {
        setDeployStep("stepAuth", "error", 35, "GitHub 토큰이 등록되어 있지 않습니다.");
        throw new Error("GitHub 개인 접근 토큰(PAT)이 등록되지 않았습니다. 상단 [1분 토큰 발급 가이드]를 참고하여 토큰을 입력해 주세요.");
      }

      if (useGithubApi) {
        const ghHeaders = {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `Bearer ${token}`
        };

        // 2-1: repo 및 main 브랜치 HEAD 조회
        const refRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`, { headers: ghHeaders });
        if (!refRes.ok) {
          setDeployStep("stepAuth", "error", 35, "GitHub 인증에 실패했습니다.");
          const errJson = await refRes.json().catch(() => ({}));
          throw new Error(`GitHub 인증 실패: ${errJson.message || refRes.statusText} (토큰의 repo 권한을 확인하세요)`);
        }
        const refData = await refRes.json();
        const currentCommitSha = refData.object.sha;

        // 2-2: 최신 커밋의 Tree SHA 조회
        const commitRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${currentCommitSha}`, { headers: ghHeaders });
        const commitData = await commitRes.json();
        const baseTreeSha = commitData.tree.sha;
        setDeployStep("stepAuth", "done", 45, `GitHub 연결 성공 (Base: ${currentCommitSha.substring(0, 7)})`);

        // 3단계: 신규 이미지 파일 Blob 생성
        setDeployStep("stepUpload", "active", 50, "슬라이드 이미지를 GitHub Blob 저장소로 업로드 중...");
        
        const newImages = Object.entries(imagesMap).map(([fileName, dataUrl]) => ({ fileName, dataUrl }));
        const uploadedBlobs = [];
        for (let i = 0; i < newImages.length; i++) {
          const img = newImages[i];
          setDeployStep("stepUpload", "active", 50 + Math.round(((i + 1) / Math.max(1, newImages.length)) * 20), `이미지 업로드 중 (${i + 1}/${newImages.length}): ${img.fileName}`);
          
          const cleanBase64 = img.dataUrl.replace(/^data:image\/\w+;base64,/, "");
          const blobRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`, {
            method: "POST",
            headers: ghHeaders,
            body: JSON.stringify({
              content: cleanBase64,
              encoding: "base64"
            })
          });
          if (!blobRes.ok) {
            const err = await blobRes.json().catch(() => ({}));
            throw new Error(`이미지 업로드 실패 (${img.fileName}): ${err.message || blobRes.statusText}`);
          }
          const blobData = await blobRes.json();
          uploadedBlobs.push({
            path: `admin-web/slides/${img.fileName}`,
            mode: "100644",
            type: "blob",
            sha: blobData.sha
          });
        }
        setDeployStep("stepUpload", "done", 70, `이미지 업로드 완료 (${uploadedBlobs.length}건)`);

        // 4단계: config.json Blob 생성 및 단일 트리/커밋 생성
        setDeployStep("stepCommit", "active", 75, "최신 config.json 반영 및 단일 커밋 생성 중...");
        const configStr = JSON.stringify(config, null, 2);
        const configBlobRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({
            content: utf8ToBase64(configStr),
            encoding: "base64"
          })
        });
        const configBlobData = await configBlobRes.json();

        // Tree Entries 구성 (admin-web/config.json 및 root config.json 동시 갱신)
        const treeEntries = [
          { path: "admin-web/config.json", mode: "100644", type: "blob", sha: configBlobData.sha },
          { path: "config.json", mode: "100644", type: "blob", sha: configBlobData.sha },
          { path: "published-config.json", mode: "100644", type: "blob", sha: configBlobData.sha },
          ...uploadedBlobs
        ];

        // 새 Tree 생성
        const treeRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: treeEntries
          })
        });
        const treeData = await treeRes.json();

        // 새 Commit 생성
        const commitMsg = `Deploy screensaver version ${config.version} [via Web Admin Cloud]`;
        const newCommitRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify({
            message: commitMsg,
            tree: treeData.sha,
            parents: [currentCommitSha]
          })
        });
        const newCommitData = await newCommitRes.json();

        // main 브랜치 Ref 업데이트
        const updateRefRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`, {
          method: "PATCH",
          headers: ghHeaders,
          body: JSON.stringify({
            sha: newCommitData.sha,
            force: false
          })
        });
        if (!updateRefRes.ok) {
          throw new Error("GitHub 브랜치 갱신(푸시)에 실패했습니다.");
        }
        setDeployStep("stepCommit", "done", 88, `GitHub 단일 커밋 완료 (${newCommitData.sha.substring(0, 7)})`);
      } else {
        // 로컬 dev-server 폴백 (localhost 실행 시)
        setDeployStep("stepAuth", "done", 45, "로컬 개발 서버 환경 감지");
        setDeployStep("stepUpload", "active", 60, "로컬 dev-server로 데이터 전송 중...");
        const res = await fetch('/api/save-bundle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config, images: imagesMap })
        });
        if (!res.ok) throw new Error("로컬 서버 저장 실패");
        setDeployStep("stepUpload", "done", 75, "로컬 파일 저장 완료");
        setDeployStep("stepCommit", "done", 88, "로컬 Git 커밋 & 푸시 완료");
      }
    }

    // 5단계: Vercel 배포 트리거 완료
    setDeployStep("stepVercel", "done", 100, "전 병원 PC 배포 준비 완료!");
    setStatus("배포 완료 (Vercel CDN 갱신 중)", "success");
    if (deployProgressTitle) deployProgressTitle.textContent = "🎉 전 병원 PC 배포 성공!";
    if (deployStatusMessage) {
      deployStatusMessage.innerHTML = `<strong>Ver ${config.version}</strong> 배포가 성공적으로 완료되었습니다.<br>GitHub에 영구 커밋되었으며, 약 15초 내로 Vercel 글로벌 CDN을 통해 전 병원 PC에 자동 반영됩니다.`;
    }
    if (deployProgressFooter) deployProgressFooter.hidden = false;

  } catch (err) {
    console.error("배포 중 오류:", err);
    setStatus("배포 실패", "error");
    if (deployProgressTitle) deployProgressTitle.textContent = "❌ 배포 실패";
    if (deployStatusMessage) {
      deployStatusMessage.textContent = err.message || "배포 도중 예기치 못한 오류가 발생했습니다.";
    }
    if (deployProgressFooter) deployProgressFooter.hidden = false;
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
  if (config.dDayTitle !== undefined && document.querySelector("#dDayTitle")) document.querySelector("#dDayTitle").value = config.dDayTitle;
  if (config.dDayDate !== undefined && document.querySelector("#dDayDate")) document.querySelector("#dDayDate").value = config.dDayDate;

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
  
  // 로컬 카드의 데이터 URL이 있으면 우선 사용하고, 없으면 이미지 URL 변환
  const card = [...slidesList.querySelectorAll(".slide-card")][simIndex];
  const localUrl = card?.dataset?.localDataUrl;
  const thumbUrl = getSlideImageUrl(current.url, localUrl);

  if (thumbUrl) {
    simImg.src = thumbUrl;
    simImg.hidden = false;
    simFallback.hidden = true;
    simImg.onerror = () => {
      simImg.hidden = true;
      simFallback.hidden = false;
      simFallbackTitle.textContent = current.title || text.untitled;
    };
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
  const current = simSlides[simIndex];
  const baseDuration = Number(document.querySelector("#duration").value || 20);
  const slideDuration = current?.durationSeconds || baseDuration;
  // 시뮬레이터에서는 최대 8초 정도로 쾌적하게 미리보기 지원
  const simSeconds = Math.max(3, Math.min(slideDuration, 8));
  simTimer = setTimeout(() => {
    nextSimSlide();
    if (simPlaying) startSimTimer();
  }, simSeconds * 1000);
}

function stopSimTimer() {
  simPlaying = false;
  simToggle.textContent = "▶ 재생";
  if (simTimer) clearTimeout(simTimer);
  simTimer = null;
}

function openSimulator() {
  const config = collect();
  if (!config.slides.length) {
    alert("시뮬레이션할 슬라이드가 등록되어 있지 않습니다.");
    return;
  }
  simSlides = config.slides;
  
  let noticeStr = config.notice || "";
  if (config.dDayDate) {
    const target = new Date(config.dDayDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
    const ddayBadge = diffDays === 0 ? "D-Day" : (diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`);
    const title = config.dDayTitle ? `[🌿 ${config.dDayTitle} ${ddayBadge}]` : `[🌿 ${ddayBadge}]`;
    noticeStr = `${title} ${noticeStr}`;
  }

  simNotice.textContent = noticeStr;
  simulatorModal.hidden = false;
  showSimSlide(0);
  startSimTimer();
}

document.querySelector("#openSimulator")?.addEventListener("click", openSimulator);

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
  // GitHub 토큰 초기화 및 자동 연결 검증
  if (githubTokenInput) {
    githubTokenInput.value = localStorage.getItem(githubTokenKey) || "";
    if (githubTokenInput.value) {
      verifyGithubToken(githubTokenInput.value, false);
    } else {
      setGithubStatus("neutral", "토큰 확인 필요");
    }
    githubTokenInput.addEventListener("input", () => {
      const val = githubTokenInput.value.trim();
      localStorage.setItem(githubTokenKey, val);
      if (!val) {
        setGithubStatus("neutral", "토큰 미설정");
      }
    });
  }

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
  if (config.dDayTitle !== undefined && document.querySelector("#dDayTitle")) document.querySelector("#dDayTitle").value = config.dDayTitle;
  if (config.dDayDate !== undefined && document.querySelector("#dDayDate")) document.querySelector("#dDayDate").value = config.dDayDate;

  slidesList.innerHTML = "";
  (config.slides || []).forEach(renderSlideCard);
  renumber();
  refresh();

  // 다른 PC나 새 브라우저 접속 시, 현재 서버(Vercel/GitHub)에 실제 배포된 최신 config.json을 자동 동기화
  fetch(`/config.json?_cb=${Date.now()}`)
    .then(r => r.ok ? r.json() : null)
    .then(remote => {
      if (remote && Array.isArray(remote.slides) && remote.slides.length > 0) {
        // 로컬 초안이 없거나 기본 초기값이면 서버 배포본으로 즉시 자동 동기화
        const isDefault = !saved || (config.version === "2026.07.27.001" && config.slides.length === 3);
        if (isDefault) {
          applyImportedConfig(remote);
          setStatus(`서버 최신 배포본 자동 동기화됨 (Ver ${remote.version})`, "success");
        }
      }
    })
    .catch(() => {});
}

// GitHub 연동 이벤트 바인딩
if (testGithubBtn) {
  testGithubBtn.addEventListener("click", () => {
    verifyGithubToken(githubTokenInput?.value?.trim(), true);
  });
}

if (toggleGithubTokenBtn) {
  toggleGithubTokenBtn.addEventListener("click", () => {
    if (!githubTokenInput) return;
    const isPwd = githubTokenInput.type === "password";
    githubTokenInput.type = isPwd ? "text" : "password";
    toggleGithubTokenBtn.textContent = isPwd ? "🙈" : "👁️";
  });
}

if (openGithubGuideBtn && githubGuideModal) {
  openGithubGuideBtn.addEventListener("click", () => { githubGuideModal.hidden = false; });
  githubGuideCloseBtn?.addEventListener("click", () => { githubGuideModal.hidden = true; });
  githubGuideOkBtn?.addEventListener("click", () => { githubGuideModal.hidden = true; });
}

if (deployDoneBtn && deployProgressModal) {
  deployDoneBtn.addEventListener("click", () => {
    deployProgressModal.hidden = true;
  });
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

// JSON 아코디언 토글
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

// 전역 인풋 리스너
["#version", "#interval", "#duration", "#notice"].forEach(sel => {
  document.querySelector(sel)?.addEventListener("input", refresh);
});

/* ----------------------------------------------------
   보안 인증 및 비밀번호 관리 엔진
---------------------------------------------------- */
function getStoredPassword() {
  return localStorage.getItem(pwdKey) || defaultPassword;
}

function isAuthed() {
  return sessionStorage.getItem(authKey) === "true";
}

function showLockScreen() {
  if (!authLockScreen) return;
  authLockScreen.hidden = false;
  if (authPasswordInput) {
    authPasswordInput.value = "";
    authPasswordInput.focus();
  }
  if (authErrorMsg) authErrorMsg.hidden = true;
}

function hideLockScreen() {
  if (!authLockScreen) return;
  authLockScreen.hidden = true;
}

function tryLogin() {
  const entered = authPasswordInput?.value ?? "";
  const stored = getStoredPassword();
  if (entered === stored) {
    sessionStorage.setItem(authKey, "true");
    hideLockScreen();
  } else {
    if (authErrorMsg) {
      authErrorMsg.hidden = false;
      authErrorMsg.textContent = "비밀번호가 올바르지 않습니다.";
    }
    const card = authLockScreen?.querySelector(".lock-card");
    if (card) {
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
    }
    if (authPasswordInput) {
      authPasswordInput.focus();
      authPasswordInput.select();
    }
  }
}

function initAuth() {
  if (!isAuthed()) {
    showLockScreen();
  } else {
    hideLockScreen();
  }

  authForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    tryLogin();
  });

  lockAppBtn?.addEventListener("click", () => {
    sessionStorage.removeItem(authKey);
    showLockScreen();
  });

  // 비밀번호 변경 모달 이벤트
  changePwdOpen?.addEventListener("click", () => {
    if (pwdChangeError) pwdChangeError.hidden = true;
    if (currentPwd) currentPwd.value = "";
    if (newPwd) newPwd.value = "";
    if (confirmPwd) confirmPwd.value = "";
    if (passwordModal) passwordModal.hidden = false;
    currentPwd?.focus();
  });

  const closePwdModal = () => { if (passwordModal) passwordModal.hidden = true; };
  pwdClose?.addEventListener("click", closePwdModal);
  pwdCancel?.addEventListener("click", closePwdModal);

  pwdSave?.addEventListener("click", () => {
    const cur = currentPwd?.value ?? "";
    const nxt = newPwd?.value ?? "";
    const cnf = confirmPwd?.value ?? "";
    const stored = getStoredPassword();

    if (cur !== stored) {
      if (pwdChangeError) {
        pwdChangeError.hidden = false;
        pwdChangeError.textContent = "현재 비밀번호가 일치하지 않습니다.";
      }
      currentPwd?.focus();
      return;
    }
    if (!nxt || nxt.length < 4) {
      if (pwdChangeError) {
        pwdChangeError.hidden = false;
        pwdChangeError.textContent = "새 비밀번호는 4자리 이상이어야 합니다.";
      }
      newPwd?.focus();
      return;
    }
    if (nxt !== cnf) {
      if (pwdChangeError) {
        pwdChangeError.hidden = false;
        pwdChangeError.textContent = "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.";
      }
      confirmPwd?.focus();
      return;
    }

    localStorage.setItem(pwdKey, nxt);
    alert("관리자 비밀번호가 성공적으로 변경되었습니다.");
    closePwdModal();
  });
}

/* ----------------------------------------------------
   주기 및 표시시간 프리셋 칩 연동
---------------------------------------------------- */
function initPresetChips() {
  document.querySelectorAll("#intervalPresets .preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const val = chip.dataset.val;
      const input = document.querySelector("#interval");
      if (input) {
        input.value = val;
        syncPresetChips();
        refresh();
      }
    });
  });

  document.querySelectorAll("#durationPresets .preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const val = chip.dataset.val;
      const input = document.querySelector("#duration");
      if (input) {
        input.value = val;
        syncPresetChips();
        refresh();
      }
    });
  });
}

function syncPresetChips() {
  const curInterval = document.querySelector("#interval")?.value;
  document.querySelectorAll("#intervalPresets .preset-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.val === String(curInterval));
  });

  const curDuration = document.querySelector("#duration")?.value;
  document.querySelectorAll("#durationPresets .preset-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.val === String(curDuration));
  });
}

// D-Day 및 추가 설정 이벤트 리스너
document.querySelector("#dDayTitle")?.addEventListener("input", refresh);
document.querySelector("#dDayDate")?.addEventListener("change", refresh);

/* ----------------------------------------------------
   원내 PC 화면보호기 가동 상태 모니터링 모달
---------------------------------------------------- */
const monitoringModal = document.querySelector("#monitoringModal");
const openMonitoringBtn = document.querySelector("#openMonitoringBtn");
const monitoringCloseBtn = document.querySelector("#monitoringClose");
const monitoringOkBtn = document.querySelector("#monitoringOk");
const refreshMonitoringBtn = document.querySelector("#refreshMonitoringBtn");
const monitoringTableBody = document.querySelector("#monitoringTableBody");
const activePcCountBadge = document.querySelector("#activePcCountBadge");

async function loadMonitoringPcs() {
  if (!monitoringTableBody) return;
  monitoringTableBody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">원내 PC 신호를 확인하는 중...</td></tr>`;
  try {
    const res = await fetch("/api/heartbeat");
    if (!res.ok) throw new Error("서버 응답 오류 (HTTP " + res.status + ")");
    const data = await res.json();
    const pcs = data.pcs || [];
    if (activePcCountBadge) activePcCountBadge.textContent = `활성 PC: ${pcs.length}대`;

    if (!pcs.length) {
      monitoringTableBody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">현재 보고된 PC 신호가 없습니다.<br><span style="font-size: 12px;">(병원 PC에서 화면보호기가 1회 이상 실행되면 자동 등록됩니다)</span></td></tr>`;
      return;
    }

    monitoringTableBody.innerHTML = pcs.map(p => {
      const d = new Date(p.lastSeen);
      const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
      const timeStr = diffMin <= 1 ? "방금 전" : (diffMin < 60 ? `${diffMin}분 전` : d.toLocaleString());
      const isOnline = diffMin <= 30;
      const statusBadge = isOnline 
        ? `<span class="status-chip success">정상 가동</span>` 
        : `<span class="status-chip neutral">대기 중</span>`;

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 10px 14px;">${statusBadge}</td>
          <td style="padding: 10px 14px; font-weight: 600;">💻 ${esc(p.machineName)}</td>
          <td style="padding: 10px 14px; color: var(--text-muted);">${esc(p.userName || '-')}</td>
          <td style="padding: 10px 14px;">${p.screenCount || 1}대 모니터</td>
          <td style="padding: 10px 14px;"><code class="code-font" style="font-size: 11px;">${esc(p.version)}</code></td>
          <td style="padding: 10px 14px; color: var(--text-muted);">${timeStr}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    monitoringTableBody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #ef4444;">PC 신호 조회 실패: ${esc(err.message)}</td></tr>`;
  }
}

if (openMonitoringBtn && monitoringModal) {
  openMonitoringBtn.addEventListener("click", () => {
    monitoringModal.hidden = false;
    loadMonitoringPcs();
  });
  monitoringCloseBtn?.addEventListener("click", () => { monitoringModal.hidden = true; });
  monitoringOkBtn?.addEventListener("click", () => { monitoringModal.hidden = true; });
  refreshMonitoringBtn?.addEventListener("click", loadMonitoringPcs);
}

// 초기화
initAuth();
initPresetChips();
loadDraft();

