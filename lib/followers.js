import { cleanUsername, usernameFromUrl } from "./parse.js";
import { blockedReason, dismissPopups } from "./withdraw.js";

const HARD_CAP = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function profileFromInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (/instagram\.com/i.test(text) || /^https?:/i.test(text)) return usernameFromUrl(text);
  return cleanUsername(text);
}

export function usernamesFromHrefs(hrefs, selfName) {
  const self = String(selfName || "").toLowerCase();
  const seen = new Set();
  const out = [];
  for (const href of hrefs || []) {
    const name = usernameFromUrl(String(href || ""));
    if (!name) continue;
    const key = name.toLowerCase();
    if (key === self || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function followerLimit(value) {
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < 1) return 200;
  return Math.min(HARD_CAP, amount);
}

async function readDialogNames(dialog) {
  return dialog.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") || ""));
}

async function scrollDialog(dialog) {
  return dialog.evaluate((root) => {
    const nodes = [root, ...root.querySelectorAll("*")];
    let box = null;
    for (const el of nodes) {
      const style = getComputedStyle(el);
      const scrollable = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 8;
      if (!scrollable) continue;
      if (!box || el.clientHeight > box.clientHeight) box = el;
    }
    if (!box) return "missing";
    const before = box.scrollTop;
    box.scrollTop = Math.min(box.scrollHeight, box.scrollTop + Math.max(box.clientHeight * 0.85, 240));
    const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
    if (box.scrollTop === before && atEnd) return "end";
    if (box.scrollTop === before) return "stuck";
    return "moved";
  });
}

export async function collectFollowers(page, username, { limit, shouldStop, onProgress }) {
  const cap = followerLimit(limit);
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  const response = await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (response && (response.status() === 429 || response.status() === 401)) {
    return { status: "blocked", detail: "Instagram isteği kabul etmedi. Bir süre sonra devam et.", usernames: [] };
  }

  await sleep(1200 + Math.random() * 700);
  await page.locator("main header, header").first().waitFor({ timeout: 12000 }).catch(() => {});
  await dismissPopups(page);

  const pageUrl = page.url();
  const bodyText = await page.locator("body").innerText({ timeout: 8000 }).catch(() => "");
  const block = blockedReason(pageUrl, bodyText);
  if (block) return { status: "blocked", detail: block, usernames: [] };

  if (
    /sorry, this page isn't available|this page isn't available|sayfa kullanılamıyor|sayfa mevcut değil|user not found/i.test(
      bodyText.slice(0, 4000)
    )
  ) {
    return { status: "error", detail: "Profil bulunamadı.", usernames: [] };
  }

  const followersLink = page.locator('main a[href$="/followers/"]').first();
  if (!(await followersLink.count())) {
    if (/this account is private|bu hesap gizli|gizli hesap/i.test(bodyText.slice(0, 4000))) {
      return { status: "error", detail: "Bu hesap gizli. Takipçi listesi açılmadı.", usernames: [] };
    }
    return { status: "error", detail: "Takipçi bağlantısı bulunamadı.", usernames: [] };
  }

  await followersLink.click();
  const dialog = page.locator("[role='dialog']").last();
  try {
    await dialog.waitFor({ state: "visible", timeout: 12000 });
  } catch {
    return { status: "error", detail: "Takipçi penceresi açılmadı.", usernames: [] };
  }

  const ordered = [];
  const seen = new Set();
  let stale = 0;

  const absorb = () => {
    return readDialogNames(dialog).then((hrefs) => {
      let added = 0;
      for (const name of usernamesFromHrefs(hrefs, username)) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        ordered.push(name);
        added += 1;
        if (ordered.length >= cap) break;
      }
      return added;
    });
  };

  for (let round = 0; round < 400; round++) {
    if (shouldStop?.()) {
      return { status: "stopped", detail: "Durduruldu.", usernames: ordered };
    }
    const added = await absorb();
    if (onProgress) onProgress(ordered);
    if (ordered.length >= cap) {
      return { status: "ok", detail: `${ordered.length} takipçi listelendi.`, usernames: ordered };
    }
    stale = added ? 0 : stale + 1;
    const motion = await scrollDialog(dialog);
    if ((motion === "end" || motion === "missing") && stale > 0) break;
    if (motion === "stuck") stale += 1;
    if (stale >= 4) break;
    await sleep(800 + Math.random() * 700);
  }

  if (shouldStop?.()) return { status: "stopped", detail: "Durduruldu.", usernames: ordered };
  return {
    status: ordered.length ? "ok" : "error",
    detail: ordered.length ? `${ordered.length} takipçi listelendi.` : "Takipçi adı okunamadı.",
    usernames: ordered,
  };
}
