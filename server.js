import { exec } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import { chromium } from "playwright";
import { collectFollowers, profileFromInput } from "./lib/followers.js";
import { parseBuffer } from "./lib/parse.js";
import { withdrawRequest } from "./lib/withdraw.js";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(rootDir, "data");
const profileDir = path.join(dataDir, "browser-profile");
const statePath = path.join(dataDir, "state.json");
const withdrawnPath = path.join(dataDir, "withdrawn.json");
const phoneCodePath = path.join(dataDir, "phone-code.txt");
const shotPath = path.join(dataDir, "last-screen.png");
const port = 3847;
let phoneCode = "";

const MIN_DELAY = 8;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

let savedWithdrawn = new Set();
let state = {
  sourceName: "",
  warnings: [],
  items: [],
  delayMin: 12,
  delayMax: 22,
};
let context = null;
let opening = null;
let running = false;
let followersRunning = false;
let stopRequested = false;
const clients = new Set();

function publicState() {
  const counts = { total: state.items.length, selected: 0, withdrawn: 0, pending: 0, skipped: 0, error: 0 };
  for (const item of state.items) {
    if (item.selected) counts.selected += 1;
    if (item.status === "withdrawn") counts.withdrawn += 1;
    else if (item.status === "skipped") counts.skipped += 1;
    else if (item.status === "error") counts.error += 1;
    else counts.pending += 1;
  }
  return {
    sourceName: state.sourceName,
    warnings: state.warnings,
    items: state.items,
    delayMin: state.delayMin,
    delayMax: state.delayMax,
    running,
    counts,
  };
}

function emit(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) client.write(payload);
}

async function saveState() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

async function loadWithdrawn() {
  try {
    const raw = await fs.readFile(withdrawnPath, "utf8");
    const parsed = JSON.parse(raw);
    savedWithdrawn = new Set(
      (Array.isArray(parsed) ? parsed : []).map((name) => String(name).toLowerCase()).filter(Boolean)
    );
  } catch {
    savedWithdrawn = new Set();
  }
  for (const item of state.items) {
    if (item.status === "withdrawn") savedWithdrawn.add(item.username.toLowerCase());
  }
  await saveWithdrawn();
}

async function saveWithdrawn() {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(withdrawnPath, JSON.stringify([...savedWithdrawn].sort(), null, 2), "utf8");
}

function rememberWithdrawn(username) {
  const key = String(username || "").toLowerCase();
  if (!key || savedWithdrawn.has(key)) return false;
  savedWithdrawn.add(key);
  return true;
}

function applySavedWithdrawn(item) {
  if (!savedWithdrawn.has(item.username.toLowerCase()) && item.status !== "withdrawn") return item;
  return {
    ...item,
    status: "withdrawn",
    selected: false,
    detail: item.detail || "Kayıtlı. Bu hesaba tekrar istek atılmaz.",
  };
}

async function loadState() {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    state = {
      sourceName: parsed.sourceName || "",
      warnings: parsed.warnings || [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      delayMin: parsed.delayMin || 12,
      delayMax: parsed.delayMax || 22,
    };
  } catch {
    state = { sourceName: "", warnings: [], items: [], delayMin: 12, delayMax: 22 };
  }
}

function browserInstalledHint(error) {
  const message = String(error?.message || error || "");
  if (/executable doesn't exist|please run.*playwright install/i.test(message)) {
    return "Tarayıcı hazır değil. Proje klasöründe şu komutu çalıştır: npx playwright install chromium";
  }
  return "Tarayıcı açılamadı. Bilgisayarda Chrome yüklü olsun, yoksa npx playwright install chromium çalıştır.";
}

function channelOrder() {
  const chrome = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
  ];
  const edge = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const order = [];
  if (chrome.some((file) => file && existsSync(file))) order.push("chrome");
  if (edge.some((file) => existsSync(file))) order.push("msedge");
  order.push(null);
  return order;
}

function launchOptions(channel) {
  const options = {
    headless: false,
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    viewport: null,
    args: ["--start-maximized", "--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  if (channel) options.channel = channel;
  return options;
}

async function openContext() {
  if (context) return context;
  if (opening) return opening;
  opening = (async () => {
    await fs.mkdir(profileDir, { recursive: true });
    let lastError = null;
    for (const channel of channelOrder()) {
      try {
        const next = await chromium.launchPersistentContext(profileDir, launchOptions(channel));
        next.on("close", () => {
          if (context === next) context = null;
        });
        context = next;
        return context;
      } catch (error) {
        lastError = error;
      }
    }
    const detail = String(lastError?.message || "").split("\n")[0].slice(0, 220);
    throw new Error(detail ? `${browserInstalledHint(lastError)} ${detail}` : browserInstalledHint(lastError));
  })().finally(() => {
    opening = null;
  });
  return opening;
}

async function sessionConnected() {
  if (!context) return false;
  const cookies = await context.cookies("https://www.instagram.com");
  return cookies.some((cookie) => cookie.name === "sessionid" && cookie.value);
}

function clampDelays(minValue, maxValue) {
  const delayMin = Math.max(MIN_DELAY, Number(minValue) || 12);
  const delayMax = Math.max(delayMin, Number(maxValue) || delayMin);
  return { delayMin, delayMax };
}

async function interruptible(ms) {
  let left = ms;
  while (left > 0) {
    if (stopRequested) return false;
    const step = Math.min(250, left);
    await new Promise((resolve) => setTimeout(resolve, step));
    left -= step;
  }
  return !stopRequested;
}

async function runBatch(batch) {
  const page = context.pages()[0] || (await context.newPage());
  emit("run", { running: true, index: 0, total: batch.length, username: "" });
  emit("log", { level: "info", message: `${batch.length} profil sıraya alındı.` });

  for (let index = 0; index < batch.length; index++) {
    if (stopRequested) {
      emit("log", { level: "info", message: "Durduruldu." });
      break;
    }
    const item = state.items.find((entry) => entry.username === batch[index].username);
    if (!item || item.status === "withdrawn") continue;
    emit("run", { running: true, index: index + 1, total: batch.length, username: item.username });
    emit("log", { level: "info", message: `${item.username} açılıyor (${index + 1}/${batch.length})` });

    let result;
    try {
      result = await withdrawRequest(page, item.username);
    } catch (error) {
      const message = String(error?.message || error);
      if (/closed|has been closed|Target page/i.test(message)) {
        emit("log", { level: "error", message: "Tarayıcı kapandı. Kalan profiller durdu." });
        break;
      }
      result = { status: "error", detail: message.slice(0, 180) };
    }

    if (result.status === "blocked") {
      item.detail = result.detail;
      item.updatedAt = new Date().toISOString();
      emit("item", item);
      emit("log", { level: "error", message: result.detail });
      await page.screenshot({ path: shotPath }).catch(() => {});
      await saveState();
      break;
    }

    const alreadyGone = result.status === "skipped" && /bekleyen istek yok/i.test(result.detail || "");
    if (result.status === "withdrawn" || alreadyGone) {
      const added = rememberWithdrawn(item.username);
      item.status = "withdrawn";
      item.selected = false;
      item.detail = "Kayıtlı. Bu hesaba tekrar istek atılmaz.";
      if (added) await saveWithdrawn();
    } else {
      item.status = result.status;
      item.detail = result.detail;
    }
    item.updatedAt = new Date().toISOString();
    emit("item", item);
    emit("log", {
      level: item.status === "withdrawn" ? "ok" : result.status === "error" ? "error" : "info",
      message: `${item.username}: ${item.detail}`,
    });
    if (result.status === "error") await page.screenshot({ path: shotPath }).catch(() => {});
    await saveState();

    if (index < batch.length - 1 && !stopRequested) {
      const wait = (state.delayMin + Math.random() * (state.delayMax - state.delayMin)) * 1000;
      const seconds = Math.round(wait / 1000);
      emit("log", { level: "info", message: `${seconds} saniye bekleniyor.` });
      const keepGoing = await interruptible(wait);
      if (!keepGoing) {
        emit("log", { level: "info", message: "Durduruldu." });
        break;
      }
    }
  }

  running = false;
  emit("run", { running: false, index: 0, total: batch.length, username: "" });
  emit("log", { level: "info", message: "Tur bitti." });
}

function lanUrls() {
  const urls = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const v4 = entry.family === "IPv4" || entry.family === 4;
      if (!v4 || entry.internal || String(entry.address).startsWith("169.254.")) continue;
      urls.push(`http://${entry.address}:${port}`);
    }
  }
  return urls;
}

function clientIp(req) {
  return String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
}

function isLocal(req) {
  const ip = clientIp(req);
  return ip === "127.0.0.1" || ip === "::1";
}

function phoneCookie(req) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "ig_phone") return decodeURIComponent(rest.join("="));
  }
  return "";
}

async function loadPhoneCode() {
  try {
    const raw = (await fs.readFile(phoneCodePath, "utf8")).trim();
    if (/^\d{6}$/.test(raw)) {
      phoneCode = raw;
      return;
    }
  } catch {
    // A new code is written below.
  }
  phoneCode = String(randomInt(0, 1000000)).padStart(6, "0");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(phoneCodePath, phoneCode, "utf8");
}

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(rootDir, "public")));
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/") || req.path === "/api/phone") return next();
  if (isLocal(req) || phoneCookie(req) === phoneCode) return next();
  res.status(401).json({ error: "Telefonda önce bilgisayardaki kodu gir." });
});

app.get("/api/phone", (req, res) => {
  if (isLocal(req)) return res.json({ locked: false, local: true, urls: lanUrls(), code: phoneCode });
  res.json({ locked: phoneCookie(req) !== phoneCode, local: false });
});

app.post("/api/phone", (req, res) => {
  if (String(req.body?.code || "").trim() !== phoneCode) {
    return res.status(401).json({ error: "Kod yanlış." });
  }
  res.setHeader(
    "Set-Cookie",
    `ig_phone=${encodeURIComponent(phoneCode)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`
  );
  res.json({ ok: true });
});

app.get("/api/state", (_req, res) => {
  res.json(publicState());
});

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  clients.add(res);
  res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`);
  const timer = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(timer);
    clients.delete(res);
  });
});

app.get("/api/browser/status", async (_req, res) => {
  try {
    if (!context) return res.json({ state: "closed" });
    const connected = await sessionConnected();
    res.json({ state: connected ? "connected" : "login" });
  } catch {
    res.json({ state: "closed" });
  }
});

app.post("/api/browser/open", async (_req, res) => {
  try {
    const browser = await openContext();
    const page = browser.pages()[0] || (await browser.newPage());
    await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 45000 });
    const connected = await sessionConnected();
    emit("log", {
      level: "info",
      message: connected
        ? "Instagram oturumu hazır."
        : "Pencere açıldı. Bu pencerede Instagram'a giriş yap. Şifre uygulamaya yazılmaz.",
    });
    res.json({ ok: true, state: connected ? "connected" : "login" });
  } catch (error) {
    res.status(500).json({ error: error.message || "Tarayıcı açılamadı" });
  }
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Dosya seçilmedi" });
    const parsed = parseBuffer(req.file.originalname, req.file.buffer);
    const previous = new Map(state.items.map((item) => [item.username.toLowerCase(), item]));
    state.sourceName = req.file.originalname;
    state.warnings = parsed.warnings;
    state.items = parsed.usernames.map((username) => {
      const old = previous.get(username.toLowerCase());
      if (savedWithdrawn.has(username.toLowerCase()) || old?.status === "withdrawn") {
        return applySavedWithdrawn({
          username,
          status: "withdrawn",
          detail: old?.detail || "",
          selected: false,
          updatedAt: old?.updatedAt || new Date().toISOString(),
        });
      }
      if (old && old.status === "skipped") return { ...old, username, selected: false };
      return {
        username,
        status: "pending",
        detail: "",
        selected: parsed.trusted,
        updatedAt: new Date().toISOString(),
      };
    });
    await saveState();
    emit("state", publicState());
    res.json(publicState());
  } catch (error) {
    res.status(400).json({ error: error.message || "Dosya okunamadı" });
  }
});

app.post("/api/selection", async (req, res) => {
  const { usernames, selected, all, pick, count } = req.body || {};
  if (all === true || all === false) {
    for (const item of state.items) item.selected = all ? item.status !== "withdrawn" : false;
  } else if (pick === "first" || pick === "last") {
    const amount = Math.floor(Number(count));
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ error: "Seçilecek adet 1 veya daha büyük olmalı." });
    }
    const eligible = state.items.filter((item) => item.status !== "withdrawn");
    const size = Math.min(eligible.length, amount);
    const chosen = new Set((pick === "last" ? eligible.slice(-size) : eligible.slice(0, size)).map((item) => item.username.toLowerCase()));
    for (const item of state.items) item.selected = chosen.has(item.username.toLowerCase());
  } else if (Array.isArray(usernames)) {
    const set = new Set(usernames.map((name) => String(name).toLowerCase()));
    for (const item of state.items) {
      if (!set.has(item.username.toLowerCase())) continue;
      item.selected = item.status === "withdrawn" ? false : Boolean(selected);
    }
  }
  await saveState();
  res.json(publicState());
});

app.post("/api/followers", async (req, res) => {
  if (running || followersRunning) return res.status(409).json({ error: "Zaten çalışıyor" });
  if (!context) return res.status(400).json({ error: "Önce tarayıcıyı açıp Instagram'a giriş yap." });
  const connected = await sessionConnected().catch(() => false);
  if (!connected) return res.status(400).json({ error: "Instagram girişi görünmüyor. Açık pencereden giriş yap." });

  const username = profileFromInput(req.body?.username);
  if (!username) return res.status(400).json({ error: "Geçerli bir profil adı veya bağlantısı yaz." });
  const limit = Math.floor(Number(req.body?.limit));
  if (!Number.isFinite(limit) || limit < 1) {
    return res.status(400).json({ error: "Adet 1 veya daha büyük olmalı." });
  }

  followersRunning = true;
  stopRequested = false;
  res.json({ started: true, username });
  const page = context.pages()[0] || (await context.newPage());
  try {
    const result = await collectFollowers(page, username, {
      limit,
      shouldStop: () => stopRequested,
      onProgress: (names) => emit("followers", { username, count: names.length, done: false }),
    });
    emit("followers", {
      username,
      count: result.usernames.length,
      done: true,
      status: result.status,
      detail: result.detail,
      usernames: result.usernames,
    });
    emit("log", {
      level: result.status === "ok" ? "ok" : result.status === "blocked" ? "error" : "info",
      message: `${username}: ${result.detail}`,
    });
  } catch (error) {
    const message = String(error?.message || error).slice(0, 180);
    emit("followers", { username, count: 0, done: true, status: "error", detail: message, usernames: [] });
    emit("log", { level: "error", message });
  } finally {
    followersRunning = false;
    stopRequested = false;
  }
});

app.post("/api/run", async (req, res) => {
  if (running || followersRunning) return res.status(409).json({ error: "Zaten çalışıyor" });
  if (!context) return res.status(400).json({ error: "Önce tarayıcıyı açıp Instagram'a giriş yap." });
  const connected = await sessionConnected().catch(() => false);
  if (!connected) return res.status(400).json({ error: "Instagram girişi görünmüyor. Açık pencereden giriş yap." });

  const delays = clampDelays(req.body?.delayMin, req.body?.delayMax);
  state.delayMin = delays.delayMin;
  state.delayMax = delays.delayMax;
  const includeSkipped = Boolean(req.body?.includeSkipped);
  const actionable = state.items.filter((item) => {
    if (!item.selected) return false;
    if (item.status === "withdrawn") return false;
    if (item.status === "skipped" && !includeSkipped) return false;
    return item.status === "pending" || item.status === "error" || (includeSkipped && item.status === "skipped");
  });
  const limit = Number(req.body?.limit);
  const batch = Number.isFinite(limit) && limit > 0 ? actionable.slice(0, limit) : actionable;
  if (!batch.length) return res.status(400).json({ error: "Çekilecek seçili istek yok." });

  running = true;
  stopRequested = false;
  await saveState();
  res.json({ started: batch.length, delayMin: state.delayMin, delayMax: state.delayMax });
  runBatch(batch).catch(async (error) => {
    running = false;
    emit("log", { level: "error", message: String(error?.message || error) });
    emit("run", { running: false, index: 0, total: batch.length, username: "" });
  });
});

app.post("/api/stop", (_req, res) => {
  stopRequested = true;
  res.json({ ok: true });
});

app.use((error, _req, res, next) => {
  if (error?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Dosya 80 MB sınırını aşıyor." });
  next(error);
});

app.get("/api/debug/screenshot", async (_req, res) => {
  try {
    await fs.access(shotPath);
    res.sendFile(shotPath);
  } catch {
    res.status(404).end();
  }
});

await loadPhoneCode();
const server = app.listen(port, "0.0.0.0", async () => {
    await loadState();
    await loadWithdrawn();
    state.items = state.items.map(applySavedWithdrawn);
    await saveState();
  const address = `http://127.0.0.1:${port}`;
  console.log(address);
  for (const url of lanUrls()) console.log(`phone ${url}`);
  if (process.argv.includes("--open")) exec(`start "" "${address}"`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} dolu. Eski pencereyi kapatıp yeniden dene.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

process.on("SIGINT", async () => {
  stopRequested = true;
  await context?.close().catch(() => {});
  process.exit(0);
});
