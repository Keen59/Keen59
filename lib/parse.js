import AdmZip from "adm-zip";
import { parse } from "node-html-parser";

const USERNAME_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;

const RESERVED = new Set([
  "about",
  "accounts",
  "ar",
  "challenge",
  "developer",
  "direct",
  "directory",
  "emails",
  "explore",
  "graphql",
  "legal",
  "lite",
  "nametag",
  "p",
  "privacy",
  "reel",
  "reels",
  "session",
  "stories",
  "tv",
  "web",
]);

const SENT_KEY = /follow_requests_sent|permanent_follow_requests|pending_follow_requests|sent_follow_requests/i;
const RECEIVED_KEY = /follow_requests_received|requests_received/i;
const REJECT_KEY = /relationships_followers|relationships_following|close_friends|blocked_users|restricted_users|removed_suggestions|recently_unfollowed|dismissed_suggested/i;

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const name of list) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function cleanUsername(raw) {
  if (raw == null) return null;
  let text = String(raw).replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  text = text.replace(/^@+/, "");
  text = text.split(/[/?#]/)[0];
  if (!USERNAME_RE.test(text)) return null;
  if (RESERVED.has(text.toLowerCase())) return null;
  return text;
}

export function usernameFromUrl(href) {
  if (!href) return null;
  try {
    const url = new URL(href, "https://www.instagram.com");
    const host = url.hostname.replace(/^www\./i, "");
    if (host !== "instagram.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "_u" && parts[1]) return cleanUsername(parts[1]);
    if (parts.length === 1) return cleanUsername(parts[0]);
    return null;
  } catch {
    return null;
  }
}

function nameKind(filename) {
  const base = String(filename || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .toLowerCase();
  if (/pending_follow_requests|follow_requests_sent|permanent_follow_requests|sent_follow/.test(base)) {
    return "sent";
  }
  if (/follow_requests_received|received_follow/.test(base)) return "received";
  if (/follower|following|close_friends|blocked/.test(base)) return "reject";
  return "unknown";
}

function emptyResult(warnings, extra = {}) {
  return { usernames: [], warnings, trusted: false, ...extra };
}

function usernameFromEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  return usernameFromUrl(entry.href) || cleanUsername(entry.value) || cleanUsername(entry.title);
}

function walkJson(node, mode, buckets) {
  if (Array.isArray(node)) {
    for (const item of node) walkJson(item, mode, buckets);
    return;
  }
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node.string_list_data)) {
    for (const entry of node.string_list_data) {
      const username = usernameFromEntry(entry);
      if (username) buckets[mode].push(username);
    }
  } else if (mode === "sent") {
    const direct = cleanUsername(node.value) || cleanUsername(node.title) || usernameFromUrl(node.href);
    if (direct && (node.href || node.value || node.timestamp)) buckets.sent.push(direct);
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "string_list_data" || value == null || typeof value !== "object") continue;
    let next = mode;
    if (RECEIVED_KEY.test(key)) next = "received";
    else if (SENT_KEY.test(key)) next = "sent";
    else if (REJECT_KEY.test(key)) next = "reject";
    walkJson(value, next, buckets);
  }
}

function parseJsonDocument(text, filename) {
  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return emptyResult(["JSON okunamadı. Dosya bozuk olabilir."]);
  }

  const buckets = { sent: [], received: [], reject: [], unknown: [] };
  walkJson(data, "unknown", buckets);
  const kind = nameKind(filename);
  const sent = unique(buckets.sent);
  const unknown = unique(buckets.unknown);

  if (sent.length) {
    return { usernames: sent, warnings: [], trusted: true };
  }
  if (kind === "sent" && unknown.length) {
    return { usernames: unknown, warnings: [], trusted: true };
  }
  if (kind === "received" || (buckets.received.length && !sent.length && !unknown.length)) {
    return emptyResult([
      "Bu dosya sana gelen takip istekleri. Gönderdiğin istekler için pending_follow_requests dosyası gerekir.",
    ]);
  }
  if (kind === "reject" || (buckets.reject.length && !unknown.length)) {
    return emptyResult([
      "Bu dosya takipçi veya takip listesi. Bekleyen istek dosyasını yükle: pending_follow_requests.html veya .json.",
    ]);
  }
  if (unknown.length) {
    return {
      usernames: unknown,
      warnings: [
        "Dosyanın bekleyen istek listesi olduğu başlıktan anlaşılmadı. Listeyi kontrol et; yanlışsa çalıştırma.",
      ],
      trusted: false,
    };
  }
  return emptyResult([
    "Bu JSON içinde gönderilmiş takip isteği bulunamadı. Instagram dışa aktarmasındaki pending_follow_requests dosyasını yükle.",
  ]);
}

function elementText(el) {
  return el.text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function hasExportClass(el) {
  const className = el.getAttribute("class") || "";
  return className.includes("_a6-i") || className.includes("_a6_q") || className.includes("_2pin");
}

function parseHtmlDocument(html, filename) {
  const root = parse(html);
  const title = `${root.querySelector("title")?.text || ""} ${root.querySelector("h1")?.text || ""}`;
  const exportLike = html.includes("_a6-") || html.includes("uiBoxWhite") || html.includes("_a6_q");
  let titleKind = "unknown";
  if (/pending follow request|bekleyen takip iste|follow requests sent|gonderilen takip istegi|gönderilen takip isteği/i.test(title)) {
    titleKind = "sent";
  } else if (/follow requests received|gelen takip iste|followers|following|takipçiler|takip ettiklerin/i.test(title)) {
    titleKind = /received|gelen takip/i.test(title) ? "received" : "reject";
  }

  const found = [];
  for (const el of root.querySelectorAll("*")) {
    const tag = String(el.tagName || "").toUpperCase();
    if (tag === "A") {
      const fromHref = usernameFromUrl(el.getAttribute("href") || "");
      if (fromHref) found.push(fromHref);
    }
    if (tag === "A" || tag === "H2" || tag === "H3" || tag === "TD" || hasExportClass(el)) {
      const username = cleanUsername(elementText(el));
      if (username) found.push(username);
    }
  }

  const usernames = unique(found);
  const kind = nameKind(filename);
  if (titleKind === "received" || kind === "received") {
    return emptyResult([
      "Bu dosya sana gelen takip istekleri. Gönderdiğin istekler için pending_follow_requests dosyası gerekir.",
    ]);
  }
  if ((titleKind === "reject" || kind === "reject") && titleKind !== "sent" && kind !== "sent") {
    return emptyResult([
      "Bu dosya takipçi veya takip listesi. Bekleyen istek dosyasını yükle: pending_follow_requests.html veya .json.",
    ]);
  }
  if (!usernames.length) {
    return emptyResult([
      "Dosyada profil bulunamadı. Instagram'ın indirdiğin bilgilerindeki pending_follow_requests.html veya .json dosyasını yükle.",
    ]);
  }

  const trusted = kind === "sent" || titleKind === "sent" || exportLike;
  const warnings = [];
  if (!trusted) {
    warnings.push(
      "Bu dosya resmi dışa aktarma gibi görünmüyor. Profiller listelendi ama otomatik çekim için işaretli değil. Doğru kişilerse seçip çalıştır."
    );
  }
  return { usernames, warnings, trusted };
}

export function decodeBuffer(buffer) {
  if (!buffer || !buffer.length) return "";
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString("utf8").replace(/^\uFEFF/, "");
  }
  const sample = Math.min(buffer.length, 240);
  let zeros = 0;
  for (let i = 1; i < sample; i += 2) if (buffer[i] === 0) zeros++;
  if (zeros > sample / 8) return buffer.toString("utf16le").replace(/^\uFEFF/, "");
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function parseZip(buffer) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return emptyResult(["Zip açılamadı."]);
  }

  const entries = zip.getEntries().filter((entry) => {
    if (entry.isDirectory) return false;
    const name = entry.entryName.replace(/\\/g, "/");
    if (name.startsWith("__MACOSX/")) return false;
    return /\.(html?|json)$/i.test(name);
  });

  const preferred = entries.filter((entry) => nameKind(entry.entryName) === "sent");
  const chosen = preferred.length ? preferred : [];
  if (!chosen.length) {
    const names = entries.map((entry) => entry.entryName.replace(/\\/g, "/").split("/").pop());
    return emptyResult([
      names.length
        ? `Zip içinde bekleyen takip isteği dosyası yok. Görülen dosyalar: ${names.slice(0, 14).join(", ")}`
        : "Zip içinde HTML veya JSON yok.",
    ]);
  }

  const usernames = [];
  const warnings = [];
  for (const entry of chosen) {
    const text = decodeBuffer(entry.getData());
    const parsed = parseText(entry.entryName, text);
    usernames.push(...parsed.usernames);
    warnings.push(...parsed.warnings);
  }
  const uniqueNames = unique(usernames);
  if (!uniqueNames.length) {
    return emptyResult(
      warnings.length ? warnings : ["Zip içindeki bekleyen istek dosyasında profil bulunamadı."]
    );
  }
  return { usernames: uniqueNames, warnings: unique(warnings), trusted: true };
}

function parseText(filename, text) {
  const trimmed = text.trim();
  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonDocument(text, filename);
  }
  return parseHtmlDocument(text, filename);
}

export function parseBuffer(filename, buffer) {
  const lower = String(filename || "").toLowerCase();
  if (lower.endsWith(".zip")) return parseZip(buffer);
  if (!/\.(html?|json)$/i.test(lower)) {
    return emptyResult(["HTML, JSON veya bu dosyaları içeren zip yükle."]);
  }
  return parseText(filename, decodeBuffer(buffer));
}
