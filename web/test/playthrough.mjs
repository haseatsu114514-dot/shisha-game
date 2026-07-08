// 第1章ブラウザ版の自動通しプレイテスト。
// 使い方: リポジトリルートで `npx http-server -p 8123 &` を起動してから
//        `node web/test/playthrough.mjs`
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// グローバルインストールの playwright も拾えるようにする
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

import { playTnStep } from "./steps.mjs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const log = (...a) => console.log("[test]", ...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  // foil_taut.png は未アップ時に金属グラデへフォールバックする任意アセット。その404は無視
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");
log("title OK");
await page.click("#btn-new");
await page.waitForSelector("#disclaimer-overlay.visible");
await page.keyboard.press("Enter"); // 注意書きは Enter / クリックで本編へ
log("disclaimer acknowledged");

// 行動計画（マップで上から順に消費する）
// キャラ訪問でスポットが解禁される順序も兼ねて検証する
const plan = [
  "tonariでバイト", "Dr.fookah", "お客さんとして利用",
  "KEMURIKUSA", "EDEN",
  "PEPPERMINT", "Dr.fookah", "カフェ",
  "観音堂", "Dr.fookah", "チョイザップ",
  "tonariでバイト", "お客さんとして利用",
  "tonariでバイト", "C.STATION",
  "tonariでバイト", "家に帰る",
];
let planIdx = 0;
let guard = 0;
let failStreak = 0; // 同じ行き先のクリック連続失敗数（3回で諦めて次へ）

async function activeScreen() {
  return page.evaluate(() => document.querySelector(".screen.active")?.id || "none");
}

let tutorialSeen = false;
let limeSeen = false;
let lastTrace = "";
while (guard++ < 5000) {
  // 進行トレース（詰まり調査用・日/画面が変わった時と500刻みで出す）
  if (process.env.TRACE) {
    const tr = await page.evaluate(() => (typeof state === "undefined" || !state) ? "no-state" : `day=${state.day} ap=${state.ap} scr=${document.querySelector(".screen.active")?.id} dlg=${typeof engine !== "undefined" && engine ? engine.dialogueId : ""}`);
    if (tr !== lastTrace || guard % 500 === 0) { log(`[g${guard}]`, tr); lastTrace = tr; }
  }
  // LIME（朝のスマホ）が開いていたら返信して進める（先頭の返信＝招待は受ける）
  // 初回お誘いのシステムヒント（O12）が出ていたらOKで閉じる
  if (await page.locator("#hint-overlay .hint-ok").count()) {
    await page.locator("#hint-overlay .hint-ok").click().catch(() => {});
    await page.waitForTimeout(80);
    continue;
  }
  if (await page.locator("#phone-overlay.show").count()) {
    if (!limeSeen) { limeSeen = true; log("LIME morning phone shown"); }
    const reply = page.locator("#phone-overlay .lime-reply").first();
    if (await reply.count()) await reply.click();
    await page.waitForTimeout(250);
    continue;
  }
  // #16 つなぎのマップビート（強制イベント前の一拍）が出ていたら飛ばす
  if (await page.locator("#map-beat").count()) {
    await page.locator("#map-beat").click().catch(() => {});
    await page.waitForTimeout(80);
    continue;
  }
  // 夜の帰宅暗転（#night-fade）はタップ不要の自動遷移。明けるまで待つ
  if (await page.locator("#night-fade").count()) {
    await page.waitForTimeout(200);
    continue;
  }
  const screen = await activeScreen();
  if (screen === "screen-tournament") {
    const phase = await page.evaluate(() => state.phase);
    if (phase === "tournament") break; // 本番大会へ到達
    // 日常フェーズの tournament 画面＝チュートリアル
    if (!tutorialSeen) { tutorialSeen = true; log("tutorial making started"); }
    await playTnStep(page);
    continue;
  }
  if (screen === "screen-gameover") throw new Error("unexpected game over");
  if (screen === "screen-dialogue") {
    // 体力警告（stamina_warning）は「構わず続ける」を選んで前へ進める。既定の先頭選択
    // （やめておく＝cancel）だと行動を消費せず日が進まないため（低体力日の足踏み防止）
    const pushBtn = page.locator("#vn-choices .choice-btn", { hasText: "構わず続ける" });
    if (await pushBtn.count()) { await pushBtn.first().click().catch(() => {}); await page.waitForTimeout(15); continue; }
    const choice = page.locator("#vn-choices .choice-btn").first();
    if (await choice.count()) await choice.click();
    else await page.click("#vn-click-layer");
    await page.waitForTimeout(15);
    continue;
  }
  if (screen === "screen-shop") {
    // Day1強制の買い出し（N18）: ミントを選んで詳細パネルの「仕入れる」を押すまで店を出られない
    const errandPending = await page.evaluate(() => !!(state && state.flags._shop_errand_pending));
    if (errandPending) {
      const mintRow = page.locator('.shop-row[data-shop-id="mint"]');
      if (await mintRow.count()) await mintRow.click().catch(() => {});
      const buyBtn = page.locator("#shop-buy-btn:not([disabled])");
      if (await buyBtn.count()) await buyBtn.click().catch(() => {});
      await page.waitForTimeout(50);
      await page.click("#shop-close").catch(() => {});
      await page.waitForTimeout(30);
      continue;
    }
    // 凛さんのショールーム（1日1回）→ なければ店を出る
    const rin = page.locator("#shop-rin:not([disabled])");
    if (await rin.count()) { await rin.click(); await page.waitForTimeout(50); continue; }
    await page.click("#shop-close");
    await page.waitForTimeout(30);
    continue;
  }
  if (screen === "screen-map") {
    // Day1ガイド（A3）: 買い出し・偵察は目的地ピンだけ有効＝吹き出しが出ていたら目的地をタップ
    if (await page.locator(".map-guide-bubble").count()) {
      const target = page.locator("#map-pins .spot-pin.tut-pulse").first();
      if (await target.count()) await target.click().catch(() => {});
      await page.waitForTimeout(120);
      continue;
    }
    // 体力が低い日はまず家で休む（実プレイと同じ判断）。低体力でシーシャ行動を選ぶと
    // 警告ダイアログが出て、cancel だと行動を消費せず日が進まない＝プラン足踏みになる。
    // 就寝回復を絞った新バランス（sleep14）だと中盤で低体力に入るので、素直に休ませる
    const lowStam = await page.evaluate(() => typeof state !== "undefined" && state && (state.stamina ?? 100) < 30);
    if (lowStam) {
      const rest = page.locator(".spot-btn", { hasText: "家に帰る" }).first();
      if (await rest.count() && !(await rest.isDisabled())) {
        await rest.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(30);
        continue;
      }
    }
    const label = plan[planIdx % plan.length];
    planIdx++;
    // Dr.fookah(T28): ピン→サブメニュー[物販/凛]。テストは物販を選んで screen-shop へ（その先で #shop-rin が凛）
    if (label === "Dr.fookah") {
      try {
        const pin = page.locator("#map-pins .spot-pin", { hasText: "Dr.fookah" }).first();
        if (await pin.count() && !(await pin.isDisabled())) await pin.click({ timeout: 3000 });
        await page.waitForSelector("#fookah-menu.show", { timeout: 3000 });
        await page.locator("#fookah-menu #fookah-shop").click({ timeout: 3000 });
      } catch { planIdx--; }
      await page.waitForTimeout(30);
      continue;
    }
    // tonari統合(O16): 「お客さんとして利用/バイト」の2択は tonari ピン → サブメニューの2段
    const isTonariSub = ["tonariでバイト", "お客さんとして利用"].some((s) => label.includes(s));
    if (isTonariSub) {
      try {
        const pin = page.locator("#map-pins .spot-pin", { hasText: "tonari" }).first();
        if (await pin.count() && !(await pin.isDisabled())) await pin.click({ timeout: 3000 });
        await page.waitForSelector("#tonari-menu.show", { timeout: 3000 });
        const sub = page.locator("#tonari-menu .spot-btn", { hasText: label }).first();
        if (await sub.count() && !(await sub.isDisabled())) {
          await sub.click({ timeout: 3000 });
        } else {
          await page.locator("#tonari-menu .tn-close").click({ timeout: 2000 }).catch(() => {});
          await page.locator(".spot-btn", { hasText: "家に帰る" }).click({ timeout: 3000 }).catch(() => {});
        }
      } catch { planIdx--; }
      await page.waitForTimeout(30);
      continue;
    }
    const btn = page.locator(".spot-btn", { hasText: label }).first();
    // 未解禁（??? LOCK）・定休日でピンが無い行き先は飛ばして次へ（プランは周回するので後で再訪できる）。
    // ここで同じ行き先をリトライし続けると、解禁チェーンがズレた周回で永遠に詰まる
    if (!(await btn.count())) {
      log("plan skip (locked/closed):", label);
      await page.waitForTimeout(120);
      continue;
    }
    try {
      if (await btn.isDisabled()) {
        await page.locator(".spot-btn", { hasText: "家に帰る" }).click({ timeout: 3000 });
      } else {
        await btn.click({ timeout: 3000 });
      }
      failStreak = 0;
    } catch {
      // スマホ（LIME）が重なった等の一時的な失敗は同じ行き先を再試行。
      // 3連続で失敗したら恒久的に押せない状態とみなして次の行き先へ（無限リトライ防止）
      if (++failStreak >= 3) { failStreak = 0; log("plan giveup:", label); continue; }
      planIdx--;
      continue;
    }
    await page.waitForTimeout(30);
    continue;
  }
  if (screen === "screen-practice") {
    // ドリル（本番ミニゲームの部分練習）を選ぶ → 以降は screen-tournament 側で進む
    if (await page.locator("#practice-menu:not(.hidden) .spot-btn").count()) {
      await page.locator("#practice-menu .spot-btn").first().click();
    }
    await page.waitForTimeout(50);
    continue;
  }
  await page.waitForTimeout(50);
}

if (!tutorialSeen) throw new Error("tutorial making was not shown before tournament");
log("tutorial OK");
if (!limeSeen) throw new Error("LIME morning phone never appeared in 7 days");
log("LIME OK");
log("reached tournament, day check:", await page.locator("#hud-day").textContent());

// 検証しやすいようにステータスを底上げ（勝利ルートを確認する）
await page.evaluate(() => {
  state.stats = { technique: 80, sense: 80, guts: 80, charm: 80, insight: 80 };
});

// 大会: 機材 → テーマ → ミックス → パック → 穴あけ → 炭起こし → 配置 →
//       蒸らし(待ちビート) → 会話 → 調整 → 吸い出し → 結果
guard = 0;
let postPhoneSeen = false;
while (guard++ < 3000) {
  // 優勝の夜のスマホ（なるの採点表 →「？？？」通知）も読み進める
  // 初回お誘いのシステムヒント（O12）が出ていたらOKで閉じる
  if (await page.locator("#hint-overlay .hint-ok").count()) {
    await page.locator("#hint-overlay .hint-ok").click().catch(() => {});
    await page.waitForTimeout(80);
    continue;
  }
  if (await page.locator("#phone-overlay.show").count()) {
    if (!postPhoneSeen) { postPhoneSeen = true; log("post-victory LIME shown"); }
    const reply = page.locator("#phone-overlay .lime-reply").first();
    if (await reply.count()) await reply.click();
    await page.waitForTimeout(250);
    continue;
  }
  const screen = await activeScreen();
  if (screen === "screen-end") break;
  if (screen === "screen-dialogue") {
    const choice = page.locator("#vn-choices .choice-btn").first();
    if (await choice.count()) await choice.click();
    else await page.click("#vn-click-layer");
    await page.waitForTimeout(15);
    continue;
  }
  if (screen === "screen-tournament") {
    await playTnStep(page, { onResult: (rows) => log("result:", rows.join(" / ")) });
    continue;
  }
  await page.waitForTimeout(50);
}

if (!postPhoneSeen) throw new Error("post-victory LIME (score sheet / ???) was not shown");
const endTitle = await page.locator("#end-title").textContent();
log("end screen:", endTitle);
if (!endTitle.includes("第1章クリア")) throw new Error("expected clear, got: " + endTitle);

// ステータス画面の確認
await page.click("#btn-status");
const statusText = await page.locator("#status-body").textContent();
if (!statusText.includes("技術") || !statusText.includes("★")) throw new Error("status screen broken");
log("status screen OK");
log("money at clear:", await page.evaluate(() => state.money));

if (errors.length) {
  console.error("PAGE ERRORS:\n" + errors.join("\n"));
  process.exit(1);
}
log("PLAYTHROUGH PASSED ✅");
await browser.close();
