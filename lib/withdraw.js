export function fold(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/ı/g, "i");
}

export function kindOf(label) {
  const text = fold(label);
  if (!text) return "other";
  if (
    text === "unfollow" ||
    text.includes(fold("takibi bırak")) ||
    text.includes(fold("isteği geri çek")) ||
    text.includes(fold("istegi geri cek"))
  ) {
    return "unfollow";
  }
  if (/^(requested|istendi)\b/.test(text) || text.includes(fold("istek gönderildi"))) {
    return "requested";
  }
  if (text === "following" || text === fold("takiptesin") || text.includes(fold("takip ediliyor"))) {
    return "following";
  }
  if (
    text === fold("follow back") ||
    text.includes(fold("sen de takip et")) ||
    text === fold("geri takip") ||
    text === fold("geri takip et")
  ) {
    return "follow";
  }
  if (text === "follow" || text === fold("takip et")) return "follow";
  return "other";
}

const DISMISS = new Set(
  [
    "Not Now",
    "Şimdi Değil",
    "Not now",
    "Allow all cookies",
    "Tüm çerezlere izin ver",
    "Tümüne izin ver",
    "Accept all",
    "Only allow essential cookies",
    "Yalnızca temel çerezlere izin ver",
  ].map(fold)
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buttonLabel(button) {
  const text = (await button.innerText().catch(() => "")) || (await button.textContent().catch(() => "")) || "";
  const aria = (await button.getAttribute("aria-label").catch(() => "")) || "";
  return (text || aria).replace(/\s+/g, " ").trim();
}

async function collectButtons(root) {
  const buttons = root.locator("button, [role='button']");
  const count = await buttons.count();
  const list = [];
  const cap = Math.min(count, 30);
  for (let i = 0; i < cap; i++) {
    const el = buttons.nth(i);
    const label = await buttonLabel(el);
    if (!label) continue;
    list.push({ el, label, kind: kindOf(label) });
  }
  return list;
}

async function dismissPopups(page) {
  for (let round = 0; round < 3; round++) {
    const buttons = page.locator("[role='dialog'] button, [role='dialog'] [role='button']");
    const count = await buttons.count();
    let clicked = false;
    for (let i = 0; i < Math.min(count, 12); i++) {
      const button = buttons.nth(i);
      const label = fold(await buttonLabel(button));
      if (!DISMISS.has(label)) continue;
      if (!(await button.isVisible().catch(() => false))) continue;
      await button.click().catch(() => {});
      clicked = true;
      await sleep(400);
      break;
    }
    if (!clicked) break;
  }
}

async function profileRoot(page) {
  const header = page.locator("main header").first();
  if ((await header.count()) && (await header.locator("button, [role='button']").count())) return header;
  const second = page.locator("header").nth(1);
  if (await second.count()) return second;
  return header;
}

function blockedReason(url, text) {
  if (/\/challenge\/|\/accounts\/suspended|checkpoint/i.test(url)) {
    return "Instagram doğrulama istiyor. Açık pencerede onu tamamla, sonra yeniden başlat.";
  }
  if (/\/accounts\/login/i.test(url)) {
    return "Oturum düşmüş. Tarayıcıda yeniden giriş yap.";
  }
  const sample = fold(text).slice(0, 5000);
  const phrases = [
    "try again later",
    "please wait a few minutes",
    "action blocked",
    "we limit how often",
    "birkaç dakika bekleyin",
    "birkaç dakika bekle",
    "bu eylem engellendi",
    "bu işlem engellendi",
  ];
  if (phrases.some((phrase) => sample.includes(fold(phrase)))) {
    return "Instagram geçici sınır koydu. Bir süre bekleyip kaldığın yerden devam et.";
  }
  return "";
}

async function confirmWithdraw(page) {
  const dialog = page.locator("[role='dialog'], [role='menu']").last();
  try {
    await dialog.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    return false;
  }
  const buttons = dialog.locator("button, [role='button']");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    const label = await buttonLabel(button);
    if (kindOf(label) !== "unfollow") continue;
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click();
    return true;
  }
  return false;
}

async function readOutcome(root) {
  const list = await collectButtons(root);
  return {
    list,
    requested: list.some((item) => item.kind === "requested"),
    follow: list.some((item) => item.kind === "follow"),
    following: list.some((item) => item.kind === "following"),
  };
}

export async function withdrawRequest(page, username) {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (response && (response.status() === 429 || response.status() === 401)) {
    return { status: "blocked", detail: "Instagram isteği kabul etmedi. Bir süre sonra devam et." };
  }

  await sleep(1200 + Math.random() * 900);
  await page.locator("main header, header").first().waitFor({ timeout: 12000 }).catch(() => {});
  await dismissPopups(page);

  const pageUrl = page.url();
  const bodyText = await page.locator("body").innerText({ timeout: 8000 }).catch(() => "");
  const block = blockedReason(pageUrl, bodyText);
  if (block) return { status: "blocked", detail: block };

  if (
    /sorry, this page isn't available|this page isn't available|sayfa kullanılamıyor|sayfa mevcut değil|user not found/i.test(
      bodyText.slice(0, 4000)
    )
  ) {
    return { status: "skipped", detail: "Profil bulunamadı" };
  }

  const root = await profileRoot(page);
  let outcome = await readOutcome(root);
  if (!outcome.list.length) {
    await sleep(1500);
    outcome = await readOutcome(root);
  }

  const labels = outcome.list.map((item) => item.label).slice(0, 8).join(", ");
  if (!outcome.requested) {
    if (outcome.following) return { status: "skipped", detail: "Zaten takip ediliyor, dokunulmadı" };
    if (outcome.follow) return { status: "skipped", detail: "Bekleyen istek yok" };
    return {
      status: "error",
      detail: labels ? `İstek butonu yok. Görülenler: ${labels}` : "Profilde işlem butonu bulunamadı",
    };
  }

  const requested = outcome.list.find((item) => item.kind === "requested");
  await requested.el.click();
  await sleep(700);
  const confirmed = await confirmWithdraw(page);

  for (let i = 0; i < 8; i++) {
    await sleep(500);
    const after = await readOutcome(root);
    if (!after.requested && after.follow) {
      return { status: "withdrawn", detail: "İstek geri çekildi" };
    }
    if (!after.requested && after.following) {
      return { status: "error", detail: "Buton takiptesin oldu. Bu hesap istenmeden bırakılmış olabilir." };
    }
  }

  if (!confirmed) {
    return { status: "error", detail: "Onay penceresindeki geri çekme butonu bulunamadı" };
  }
  return { status: "error", detail: "Tıklama yapıldı ama istek kalktı mı doğrulanamadı" };
}
