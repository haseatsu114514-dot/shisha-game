// ミックス画面のフレーバー候補が、バイトとそれ以外で正しく切り替わることを検証する。
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");

async function shownFlavors(mode, flags = {}) {
  return page.evaluate(({ selectedMode, selectedFlags }) => {
    state = newState();
    state.phase = "daily";
    Object.assign(state.flags, selectedFlags);
    beginMaking(selectedMode);
    tournamentStep("mix");
    return Array.from(document.querySelectorAll(".mix-row"), (row) => row.dataset.flavorId);
  }, { selectedMode: mode, selectedFlags: flags });
}

const tutorial = await shownFlavors("tutorial");
if (tutorial.join(",") !== "double_apple") throw new Error(`チュートリアルの初期所持はダブルアップルのみ: ${tutorial.join(", ")}`);
for (const id of ["peach", "grape"]) {
  if (tutorial.includes(id)) throw new Error(`チュートリアルに未所持フレーバーが出ている: ${id}`);
}

// 大会は所持フレーバー＋課題フレーバー（主催者支給）だけが並ぶ。
// 課題（ch1=ミント）を仕入れ忘れてもレギュレーションを満たせる＝詰み防止
const tournament = await shownFlavors("tournament");
const tournamentSet = new Set(tournament);
if (!tournamentSet.has("double_apple")) throw new Error(`初期所持のダブルアップルが大会に出ない: ${tournament.join(", ")}`);
if (!tournamentSet.has("mint")) throw new Error(`課題フレーバー（主催者支給）が大会に出ない: ${tournament.join(", ")}`);
if (tournament.length !== 2) throw new Error(`大会は所持＋課題のみのはず: ${tournament.join(", ")}`);
if (tournamentSet.has("peach")) throw new Error("大会に未所持フレーバーが出ている: peach");

const tutorialMixReady = await page.evaluate(() => {
  state = newState();
  state.phase = "daily";
  beginMaking("tutorial");
  tournamentStep("mix");
  const plus = document.querySelector('.mix-row[data-flavor-id="double_apple"] button:last-child');
  for (let i = 0; i < 12; i++) plus.click();
  return !document.querySelector(".mix-footer .primary-btn").disabled;
});
if (!tutorialMixReady) throw new Error("ダブルアップルだけでチュートリアルの配合を完成できない");

const mintStocked = await page.evaluate(() => {
  state = newState();
  state.phase = "daily";
  showShop();
  return Array.from(document.querySelectorAll("#shop-list .spot-btn"))
    .some((button) => button.textContent.includes("AF ミント") && !button.disabled);
});
if (!mintStocked) throw new Error("初期未所持のミントが Dr.fookah で購入できない");

const rescued = await page.evaluate(() => {
  state = newState();
  state.phase = "tournament";
  flavorBringIn(() => {});
  return { rescued: state.flags._flavor_rescued === true, mint: state.flags._flavor_mint === true };
});
if (!rescued.rescued || rescued.mint) throw new Error("スミさんの救済はダブルアップルのみであるべき");

const unlocked = await shownFlavors("tutorial", { _flavor_grape: true });
if (!unlocked.includes("grape")) throw new Error("入手済みフレーバーがチュートリアルに出ない: grape");

const mintOwned = await shownFlavors("tournament", { _flavor_mint: true });
if (!mintOwned.includes("mint")) throw new Error("購入済みのミントが大会に出ない");

const baito = await shownFlavors("baito");
for (const id of ["peach", "grape"]) {
  if (!baito.includes(id)) throw new Error(`バイトに店のフレーバーが出ない: ${id}`);
}
if (baito.includes("nightside_earlgrey")) throw new Error("接客不可の未発売サンプルがバイトに出ている");

if (errors.length) throw new Error(errors.join("\n"));
console.log("[flavor-ownership] PASSED ✅");
await browser.close();
