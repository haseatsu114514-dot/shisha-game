// バイトイベントの地の文に、名前欄を出さず客の立ち絵だけ添えられることを確認する。
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const CASES = [
  ["baito_beginner_01", "mob_firsttimer"],
  ["baito_mob_flavor_police", "mob_megane"],
  ["baito_mob_insta", "mob_insta"],
  ["baito_regular_01", "mob_occhan"],
  ["baito_foreign_tourist", "mob_tourist"],
];

const browser = await chromium.launch({ headless: true });
let failed = 0;

for (const [eventId, speaker] of CASES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector("#screen-title.active");

  const found = await page.evaluate((id) => {
    const event = GAME_DATA.baito_events.find((item) => item.id === id);
    if (!event) return false;
    GAME_DATA.baito_events = [event];
    state = newState();
    state.flags._tutorial_done = true;
    state.chapter = 1;
    state.usedBaito = [];
    doBaito(true);
    return true;
  }, eventId);

  if (!found) {
    console.error(`FAIL ${eventId}: event not found`);
    failed++;
    await page.close();
    continue;
  }

  await page.waitForSelector("#screen-dialogue.active");
  await page.locator("#vn-click-layer").click();
  const portrait = page.locator(`#vn-portraits img[data-speaker="${speaker}"]`);
  await portrait.waitFor({ state: "visible" });
  await page.waitForFunction(
    (id) => document.querySelector(`#vn-portraits img[data-speaker="${id}"]`)?.naturalWidth > 0,
    speaker,
  );

  const result = await page.evaluate((id) => {
    const img = document.querySelector(`#vn-portraits img[data-speaker="${id}"]`);
    return {
      width: img?.naturalWidth || 0,
      height: img?.naturalHeight || 0,
      nameHidden: getComputedStyle(document.querySelector("#vn-name")).display === "none",
    };
  }, speaker);
  const ok = result.width > 0 && result.height > 0 && result.nameHidden && pageErrors.length === 0;
  console.log(`${ok ? "OK " : "FAIL"} ${eventId} -> ${speaker} ${JSON.stringify(result)}`);
  if (!ok) {
    console.error(pageErrors.join("\n"));
    failed++;
  }
  await page.close();
}

await browser.close();
if (failed) process.exit(1);
console.log("baito portraits: all green");
