const fileInput = document.querySelector("#file");
const drop = document.querySelector("#drop");
const dropLabel = document.querySelector("#drop-label");
const source = document.querySelector("#source");
const warnings = document.querySelector("#warnings");
const list = document.querySelector("#list");
const counts = document.querySelector("#counts");
const search = document.querySelector("#search");
const pickCountInput = document.querySelector("#pick-count");
const pickSideInput = document.querySelector("#pick-side");
const pickApplyButton = document.querySelector("#pick-apply");
const log = document.querySelector("#log");
const browserState = document.querySelector("#browser-state");
const runState = document.querySelector("#run-state");
const eta = document.querySelector("#eta");
const limitInput = document.querySelector("#limit");
const delayMinInput = document.querySelector("#delay-min");
const delayMaxInput = document.querySelector("#delay-max");
const includeSkipped = document.querySelector("#include-skipped");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");
const tryButton = document.querySelector("#try-one");
const openButton = document.querySelector("#open-browser");

let items = [];
let running = false;
let browser = "closed";

const statusText = {
  pending: "Bekliyor",
  withdrawn: "Çekildi",
  skipped: "Atlandı",
  error: "Hata",
};

function setBrowser(state) {
  browser = state;
  browserState.className = "status";
  if (state === "connected") {
    browserState.textContent = "Giriş yapıldı";
    browserState.classList.add("on");
  } else if (state === "login") {
    browserState.textContent = "Giriş bekleniyor";
    browserState.classList.add("wait");
  } else {
    browserState.textContent = "Kapalı";
  }
}

function addLog(message, level = "info") {
  const item = document.createElement("li");
  item.textContent = message;
  if (level === "ok" || level === "error") item.className = level;
  log.appendChild(item);
  log.scrollTop = log.scrollHeight;
}

function renderWarnings(messages) {
  warnings.replaceChildren();
  for (const message of messages || []) {
    const p = document.createElement("p");
    p.className = "warning";
    p.textContent = message;
    warnings.appendChild(p);
  }
}

function actionableCount() {
  return items.filter((item) => {
    if (!item.selected || item.status === "withdrawn") return false;
    if (item.status === "skipped" && !includeSkipped.checked) return false;
    return true;
  }).length;
}

function renderEta() {
  const count = Math.min(actionableCount(), Number(limitInput.value) || actionableCount());
  const min = Math.max(8, Number(delayMinInput.value) || 12);
  const max = Math.max(min, Number(delayMaxInput.value) || min);
  if (!count) {
    eta.textContent = "Seçili bekleyen istek yok.";
    return;
  }
  const minutes = Math.round((count * ((min + max) / 2)) / 60);
  eta.textContent = `${count} profil, yaklaşık ${Math.max(1, minutes)} dakika. En az bekleme 8 saniyedir.`;
}

function renderList() {
  const scroll = list.scrollTop;
  const query = search.value.trim().toLowerCase();
  const visible = items.filter((item) => item.username.toLowerCase().includes(query));
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = items.length ? "Aramayla eşleşen profil yok." : "Henüz dosya yok.";
    list.appendChild(empty);
  }
  for (const item of visible) {
    const row = document.createElement("article");
    row.className = "person";

    const indexLabel = document.createElement("span");
    indexLabel.className = "index";
    indexLabel.textContent = String(items.indexOf(item) + 1);

    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = Boolean(item.selected);
    box.addEventListener("change", async () => {
      item.selected = box.checked;
      await fetch("/api/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [item.username], selected: box.checked }),
      });
      renderMeta();
    });

    const link = document.createElement("a");
    link.href = `https://www.instagram.com/${encodeURIComponent(item.username)}/`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.username;

    const meta = document.createElement("div");
    meta.className = `meta ${item.status}`;
    meta.textContent = item.detail ? `${statusText[item.status] || item.status} · ${item.detail}` : statusText[item.status] || item.status;

    row.append(indexLabel, box, link, meta);
    list.appendChild(row);
  }
  list.scrollTop = scroll;
  renderMeta();
}

function renderMeta() {
  const selected = items.filter((item) => item.selected).length;
  const withdrawn = items.filter((item) => item.status === "withdrawn").length;
  counts.textContent = items.length ? `${items.length} profil · ${selected} seçili · ${withdrawn} çekildi` : "";
  renderEta();
}

function applyState(next) {
  items = next.items || [];
  source.textContent = next.sourceName ? `Yüklenen: ${next.sourceName}` : "";
  renderWarnings(next.warnings);
  if (next.delayMin) delayMinInput.value = next.delayMin;
  if (next.delayMax) delayMaxInput.value = next.delayMax;
  running = Boolean(next.running);
  startButton.disabled = running;
  tryButton.disabled = running;
  stopButton.disabled = !running;
  renderList();
}

function patchItem(item) {
  const index = items.findIndex((entry) => entry.username === item.username);
  if (index >= 0) items[index] = { ...items[index], ...item };
  renderList();
}

async function upload(file) {
  dropLabel.textContent = "Okunuyor...";
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body });
  const data = await response.json();
  if (!response.ok) {
    addLog(data.error || "Dosya okunamadı", "error");
    dropLabel.textContent = "Dosyayı buraya bırak veya seç";
    return;
  }
  dropLabel.textContent = file.name;
  applyState(data);
  addLog(`${data.items.length} profil bulundu.`);
}

async function setAll(selected) {
  const response = await fetch("/api/selection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: selected }),
  });
  applyState(await response.json());
}

async function pickRange() {
  const count = Math.floor(Number(pickCountInput.value));
  const pick = pickSideInput.value === "last" ? "last" : "first";
  if (!Number.isFinite(count) || count < 1) {
    addLog("Seçilecek adet 1 veya daha büyük olmalı.", "error");
    return;
  }
  const response = await fetch("/api/selection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pick, count }),
  });
  const data = await response.json();
  if (!response.ok) {
    addLog(data.error || "Seçilemedi", "error");
    return;
  }
  applyState(data);
}

async function start(limit) {
  const requested = limit || Number(limitInput.value) || actionableCount();
  const count = Math.min(actionableCount(), requested);
  if (!count) {
    addLog("Çekilecek seçili istek yok.", "error");
    return;
  }
  if (limit !== 1 && !confirm(`${count} profil açılacak ve bekleyen istek varsa geri çekilecek. Devam edilsin mi?`)) return;
  const response = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      limit,
      delayMin: Number(delayMinInput.value),
      delayMax: Number(delayMaxInput.value),
      includeSkipped: includeSkipped.checked,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    addLog(data.error || "Başlatılamadı", "error");
    return;
  }
  running = true;
  startButton.disabled = true;
  tryButton.disabled = true;
  stopButton.disabled = false;
  runState.textContent = "Çalışıyor. Açık tarayıcıyı kapatma.";
}

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) upload(fileInput.files[0]);
});

drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("over");
  if (event.dataTransfer.files[0]) upload(event.dataTransfer.files[0]);
});

document.querySelector("#select-all").addEventListener("click", () => setAll(true));
document.querySelector("#select-none").addEventListener("click", () => setAll(false));
pickApplyButton.addEventListener("click", () => pickRange());
search.addEventListener("input", renderList);
includeSkipped.addEventListener("change", renderEta);
limitInput.addEventListener("input", renderEta);
delayMinInput.addEventListener("input", renderEta);
delayMaxInput.addEventListener("input", renderEta);
startButton.addEventListener("click", () => start(Number(limitInput.value) || undefined));
tryButton.addEventListener("click", () => start(1));
stopButton.addEventListener("click", async () => {
  await fetch("/api/stop", { method: "POST" });
  addLog("Durdurma istendi. Şu anki profilden sonra durur.");
});

openButton.addEventListener("click", async () => {
  openButton.disabled = true;
  setBrowser("login");
  const response = await fetch("/api/browser/open", { method: "POST" });
  const data = await response.json();
  openButton.disabled = false;
  if (!response.ok) {
    setBrowser("closed");
    addLog(data.error || "Tarayıcı açılamadı", "error");
    return;
  }
  setBrowser(data.state);
});

const events = new EventSource("/api/events");
events.addEventListener("state", (event) => applyState(JSON.parse(event.data)));
events.addEventListener("item", (event) => patchItem(JSON.parse(event.data)));
events.addEventListener("log", (event) => {
  const entry = JSON.parse(event.data);
  addLog(entry.message, entry.level);
});
events.addEventListener("run", (event) => {
  const entry = JSON.parse(event.data);
  running = entry.running;
  startButton.disabled = running;
  tryButton.disabled = running;
  stopButton.disabled = !running;
  runState.textContent = entry.running
    ? `${entry.index}/${entry.total} · ${entry.username}`
    : "Hazır";
});

async function pollBrowser() {
  const response = await fetch("/api/browser/status");
  const data = await response.json();
  setBrowser(data.state);
}

fetch("/api/state").then((response) => response.json()).then(applyState);
pollBrowser();
setInterval(pollBrowser, 3000);
