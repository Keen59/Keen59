import { parseBuffer } from "../lib/parse.js";

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
const openNextButton = document.querySelector("#open-next");
const log = document.querySelector("#log");

const STORAGE_KEY = "geri-cekilmis-hesaplar";
let items = [];
let saved = loadSaved();

function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set((Array.isArray(parsed) ? parsed : []).map((name) => String(name).toLowerCase()));
  } catch {
    return new Set();
  }
}

function storeSaved() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved].sort()));
}

function remember(item) {
  saved.add(item.username.toLowerCase());
  storeSaved();
  item.status = "saved";
  item.selected = false;
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
    const note = document.createElement("p");
    note.className = "warning";
    note.textContent = message;
    warnings.appendChild(note);
  }
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
    box.disabled = item.status === "saved";
    box.addEventListener("change", () => {
      if (item.status === "saved") {
        item.selected = false;
        box.checked = false;
        return;
      }
      item.selected = box.checked;
      renderMeta();
    });

    const link = document.createElement("a");
    link.href = `https://www.instagram.com/${encodeURIComponent(item.username)}/`;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.username;
    link.addEventListener("click", () => {
      remember(item);
      renderList();
    });

    const meta = document.createElement("div");
    meta.className = `meta ${item.status === "saved" ? "withdrawn" : ""}`;
    meta.textContent = item.status === "saved" ? "Kayıtlı, tekrar istek yok" : "Bekliyor";

    row.append(indexLabel, box, link, meta);
    list.appendChild(row);
  }
  list.scrollTop = scroll;
  renderMeta();
}

function renderMeta() {
  const selected = items.filter((item) => item.selected).length;
  const kept = items.filter((item) => item.status === "saved").length;
  counts.textContent = items.length ? `${items.length} profil · ${selected} seçili · ${kept} kayıtlı` : "";
}

function applyParsed(filename, parsed) {
  items = parsed.usernames.map((username) => {
    const known = saved.has(username.toLowerCase());
    return {
      username,
      selected: parsed.trusted && !known,
      status: known ? "saved" : "pending",
    };
  });
  source.textContent = filename ? `Yüklenen: ${filename}` : "";
  renderWarnings(parsed.warnings);
  dropLabel.textContent = filename || "Dosyayı buraya bırak veya seç";
  renderList();
  const kept = items.filter((item) => item.status === "saved").length;
  addLog(
    items.length ? `${items.length} profil bulundu.${kept ? ` ${kept} kayıtlı hesap seçilmedi.` : ""}` : parsed.warnings[0] || "Profil bulunamadı.",
    items.length ? "ok" : "error"
  );
}

async function upload(file) {
  dropLabel.textContent = "Okunuyor...";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseBuffer(file.name, bytes);
  applyParsed(file.name, parsed);
}

function setAll(selected) {
  for (const item of items) item.selected = selected && item.status !== "saved";
  renderList();
}

function pickRange() {
  const count = Math.floor(Number(pickCountInput.value));
  const pick = pickSideInput.value === "last" ? "last" : "first";
  if (!Number.isFinite(count) || count < 1) {
    addLog("Seçilecek adet 1 veya daha büyük olmalı.", "error");
    return;
  }
  const eligible = items.filter((item) => item.status !== "saved");
  const size = Math.min(eligible.length, count);
  const chosen = new Set((pick === "last" ? eligible.slice(-size) : eligible.slice(0, size)).map((item) => item.username.toLowerCase()));
  for (const item of items) item.selected = chosen.has(item.username.toLowerCase());
  renderList();
}

function openNext() {
  const selected = items.filter((item) => item.selected && item.status !== "saved");
  if (!selected.length) {
    addLog("Açılacak seçili profil yok.", "error");
    return;
  }
  const item = selected[0];
  window.open(`https://www.instagram.com/${encodeURIComponent(item.username)}/`, "_blank", "noopener");
  remember(item);
  addLog(`${item.username} kaydedildi. Buna tekrar istek atılmaz. Kalan seçili: ${selected.length - 1}.`);
  renderList();
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
pickApplyButton.addEventListener("click", pickRange);
openNextButton.addEventListener("click", openNext);
search.addEventListener("input", renderList);
renderList();
