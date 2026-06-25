// 第2章（HAZE: OPEN CLOUD）の自動通しテスト + 恋愛システム（告白・浮気警告）の確認。
// 使い方: リポジトリルートで `npx http-server -p 8123 &` を起動してから
//        `node web/test/ch2.mjs`
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

import { playTnStep } from "./steps.mjs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const log = (...a) => console.log("[ch2]", ...a);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(5000); // 個別クリックの取りこぼしはループ側でリトライする
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");

// ---- 恋愛システム: 告白 → 恋人化 → 2人目で浮気警告
await page.evaluate(() => {
  state = newState();
  state.phase = "daily";
  state.flags._tutorial_done = true;
  state.affinity.tsumugi = 5;
  state.flags._confession_due = "tsumugi";
});
await page.evaluate(() => maybeStartConfession(() => {}));
for (let i = 0; i < 200; i++) {
  const c = page.locator("#vn-choices .choice-btn").first();
  if (await c.count()) {
    const t = await c.textContent();
    if (t.includes("好き")) { await c.click(); } else { await c.click(); }
  } else {
    await page.click("#vn-click-layer").catch(() => {});
  }
  if (await page.evaluate(() => state.lovers.includes("tsumugi"))) break;
  await page.waitForTimeout(20);
}
if (!(await page.evaluate(() => state.lovers.includes("tsumugi")))) throw new Error("confession accept failed");
log("confession → tsumugi is lover OK");

// 2人目（みんと）→ 浮気警告が出ること
await page.evaluate(() => {
  state.affinity.minto = 5;
  state.flags._confession_due = "minto";
  maybeStartConfession(() => {});
});
await page.waitForTimeout(400);
let warned = false;
for (let i = 0; i < 300; i++) {
  const c = page.locator("#vn-choices .choice-btn").first();
  if (await c.count()) {
    const texts = await page.locator("#vn-choices .choice-btn").allTextContents();
    if (texts.some((t) => t.includes("それでも"))) {
      warned = true;
      await page.locator("#vn-choices .choice-btn", { hasText: "それでも" }).click();
    } else {
      await c.click();
    }
  } else {
    await page.click("#vn-click-layer").catch(() => {});
  }
  if (await page.evaluate(() => state.lovers.includes("minto"))) break;
  await page.waitForTimeout(20);
}
if (!warned) throw new Error("cheating warning did not appear");
if (!(await page.evaluate(() => state.lovers.length === 2 && state.guilt > 0))) {
  throw new Error("second lover / guilt not recorded");
}
log("cheating warning + second lover + guilt OK");


// ---- 新システム検証: ？？？名前 / 定休日 / 好感度MAX警告 / 恋人デート誘い
// (1) 未紹介キャラは？？？・店ピンは店名のみ
await page.evaluate(() => {
  state = newState();
  state.phase = "daily";
  state.flags._tutorial_done = true;
  showMap();
});
await page.waitForSelector("#screen-map.active");
if ((await page.evaluate(() => displayName("naru"))) !== "？？？") throw new Error("unmet naru should be ？？？");
if (!(await page.locator(".spot-pin", { hasText: "KEMURIKUSAを覗く" }).count())) throw new Error("unknown naru pin label missing");
await page.evaluate(() => { state.flags._met_naru = true; showMap(); });
if ((await page.evaluate(() => displayName("naru"))) !== "なる") throw new Error("met naru should be なる");
if (!(await page.locator(".spot-pin", { hasText: "なるの店へ行く" }).count())) throw new Error("known naru pin label missing");
log("？？？ name system OK");

// (2) 定休日: day%7===3 は KEMURIKUSA が閉まる
await page.evaluate(() => { state.day = 3; showMap(); });
const naruPin = page.locator(".spot-pin", { hasText: "KEMURIKUSA" }).first();
if (!(await naruPin.isDisabled())) throw new Error("naru shop should be closed on day3");
if (!(await page.locator(".spot-pin", { hasText: "定休日" }).count())) throw new Error("closure tag missing");
log("closure system OK");

// (3) 好感度MAX警告: 通っても上がらない確認 → やめておくでコマ・金を消費しない
await page.evaluate(() => {
  state.day = 2; state.ap = 2; state.money = 30000;
  state.flags._met_naru = true;
  state.affinity.naru = 5;
  state.visits.naru = 99;
  showMap();
});
await page.locator(".spot-pin", { hasText: "KEMURIKUSA" }).first().click();
for (let i = 0; i < 30 && !(await page.locator("#vn-choices .choice-btn").count()); i++) {
  await page.click("#vn-click-layer").catch(() => {});
  await page.waitForTimeout(80);
}
const warnTexts = await page.locator("#vn-choices .choice-btn").allTextContents();
if (!warnTexts.some((t) => t.includes("やめておく"))) throw new Error("max-affinity warning missing");
await page.locator("#vn-choices .choice-btn", { hasText: "やめておく" }).click();
for (let i = 0; i < 20; i++) {
  if ((await page.evaluate(() => document.querySelector(".screen.active")?.id)) === "screen-map") break;
  await page.click("#vn-click-layer").catch(() => {});
  await page.waitForTimeout(60);
}
const after = await page.evaluate(() => ({ ap: state.ap, money: state.money }));
if (after.ap !== 2 || after.money !== 30000) throw new Error("cancel should not consume AP/money: " + JSON.stringify(after));
log("max-affinity warning OK");

// (4) 恋人のデート誘いLIME → 受けるとコマ消費なしでデート → 恋人ポイントが動く
await page.evaluate(() => {
  state = newState(); // 他キャラのLIMEが混ざらないよう素の状態から
  state.phase = "daily";
  state.flags._tutorial_done = true;
  state.lovers = ["tsumugi"];
  state.loveLevel.tsumugi = 1;
  state.lovePts.tsumugi = 9;
  state.day = 5; state.ap = 2;
  state.flags._met_tsumugi = true;
  morningPhone(() => {});
});
await page.waitForSelector("#phone-overlay.show");
await page.locator("#phone-overlay .lime-reply", { hasText: "行く" }).click();
for (let i = 0; i < 400; i++) {
  if (await page.locator("#phone-overlay.show").count()) {
    const r = page.locator("#phone-overlay .lime-reply").first();
    if (await r.count()) await r.click().catch(() => {});
    await page.waitForTimeout(120);
    continue;
  }
  const sc = await page.evaluate(() => document.querySelector(".screen.active")?.id);
  if (sc === "screen-dialogue") {
    const c = page.locator("#vn-choices .choice-btn").first();
    if (await c.count()) await c.click();
    else await page.click("#vn-click-layer").catch(() => {});
  }
  const pts = await page.evaluate(() => state.lovePts.tsumugi || 0);
  if (pts > 9) break;
  await page.waitForTimeout(30);
}
const dateRes = await page.evaluate(() => ({ pts: state.lovePts.tsumugi, ap: state.ap, last: state.lastDate.tsumugi }));
if (!(dateRes.pts > 9)) throw new Error("date should add love pts: " + JSON.stringify(dateRes));
if (dateRes.ap !== 1) throw new Error("invite date should consume exactly 1 AP: " + JSON.stringify(dateRes));
if (dateRes.last !== 5) throw new Error("lastDate not recorded");
log("lover date invite OK (1 AP consumed)");

// ---- 第2章: ch1クリア相当の状態から開始
await page.evaluate(() => {
  state = newState();
  state.phase = "cleared";
  state.flags._tutorial_done = true;
  state.stats = { technique: 38, sense: 36, guts: 30, charm: 32, insight: 34 };
  state.money = 60000;
  state.practiceBest = { foil: 2, coalfire: 2, pull: 2, focus: 2 };
  state.guilt = 3; // うしろめたさの煙演出（リグの濁り）を道中で検証する
  state.owned.push("home_rig_set"); // 家シーシャ（寝る前の一服）の出現を検証する
  state.visits.naru = 2; // ch1でなるとLIME交換済み相当（噂LIMEの配信条件）
  startChapter2();
});

const plan = ["シーシャの練習", "tonariでバイト", "シーシャの練習", "家に帰る"];
let planIdx = 0;
let stagesSeen = [];
let slumpSeen = false;
let guiltSmokeSeen = false;
const nightDialogues = new Set();
async function active() { return page.evaluate(() => document.querySelector(".screen.active")?.id); }

let guard = 0;
while (guard++ < 8000) {
  // LIME
  if (await page.locator("#phone-overlay.show").count()) {
    const reply = page.locator("#phone-overlay .lime-reply").first();
    if (await reply.count()) await reply.click();
    await page.waitForTimeout(200);
    continue;
  }
  // #16 つなぎのマップビート（強制イベント前の一拍）が出ていたら飛ばす
  if (await page.locator("#map-beat").count()) {
    await page.locator("#map-beat").click().catch(() => {});
    await page.waitForTimeout(80);
    continue;
  }
  const screen = await active();
  if (screen === "screen-end") break;
  if (screen === "screen-gameover") throw new Error("unexpected game over");
  if (screen === "screen-dialogue") {
    const id = await page.evaluate(() => engine && engine.dialogueId);
    if (id && (id.startsWith("ch2_") || id === "home_shisha_night")) nightDialogues.add(id);
    const c = page.locator("#vn-choices .choice-btn").first();
    if (await c.count()) await c.click();
    else await page.click("#vn-click-layer").catch(() => {});
    await page.waitForTimeout(15);
    continue;
  }
  if (screen === "screen-tournament") {
    const phase = await page.evaluate(() => state.phase);
    if (phase === "tournament") {
      const st = await page.evaluate(() => state.ch2Stage);
      if (st && !stagesSeen.includes(st)) { stagesSeen.push(st); log("stage:", st); }
      if (await page.locator(".taste-slump").count()) slumpSeen = true;
      if (await page.locator("#tn-rig .rig.guilt-2").count()) guiltSmokeSeen = true;
    }
    await playTnStep(page, { onResult: (rows) => log("result:", rows.map((r) => r.replace(/\s+/g, " ").trim()).join(" / ")) });
    continue;
  }
  if (screen === "screen-shop") {
    await page.click("#shop-close");
    await page.waitForTimeout(30);
    continue;
  }
  if (screen === "screen-map") {
    const label = plan[planIdx % plan.length];
    planIdx++;
    // tonari統合(#9): バイト/練習/スミさん/常連席 は tonari ピン → サブメニューの2段
    const isTonariSub = ["tonariでバイト", "シーシャの練習", "スミさんと話す", "常連席"].some((s) => label.includes(s));
    if (isTonariSub) {
      try {
        const pin = page.locator("#map-pins .spot-pin", { hasText: "tonari" }).first();
        if (await pin.count() && !(await pin.isDisabled())) await pin.click({ timeout: 3000 });
        await page.waitForSelector("#tonari-menu.show", { timeout: 3000 });
        const sub = page.locator("#tonari-menu .spot-btn", { hasText: label }).first();
        if (await sub.count() && !(await sub.isDisabled())) await sub.click({ timeout: 3000 });
        else {
          await page.locator("#tonari-menu .tn-close").click({ timeout: 2000 }).catch(() => {});
          await page.locator(".spot-btn", { hasText: "家に帰る" }).click({ timeout: 3000 }).catch(() => {});
        }
      } catch { planIdx--; }
      await page.waitForTimeout(30);
      continue;
    }
    const btn = page.locator(".spot-btn", { hasText: label }).first();
    try {
      if (await btn.isDisabled()) await page.locator(".spot-btn", { hasText: "家に帰る" }).click({ timeout: 3000 });
      else await btn.click({ timeout: 3000 });
    } catch {
      planIdx--;
      continue;
    }
    await page.waitForTimeout(30);
    continue;
  }
  if (screen === "screen-practice") {
    // 練習メニュー: 最初のドリルを回す
    const item = page.locator("#screen-practice .spot-btn").first();
    if (await item.count()) await item.click();
    await page.waitForTimeout(50);
    continue;
  }
  await page.waitForTimeout(40);
}

const endTitle = await page.locator("#end-title").textContent();
log("end screen:", endTitle);
if (!endTitle.includes("第2章クリア")) throw new Error("expected ch2 clear, got " + endTitle);
if (stagesSeen.join(",") !== "qual,semi,final") throw new Error("stages wrong: " + stagesSeen.join(","));
if (!slumpSeen) throw new Error("taste slump UI not seen");
if (!guiltSmokeSeen) throw new Error("guilt smoke tint (rig .guilt-2) not seen");
// 噂LIME（クロスオーバー噂システム）がch2で配信されること
const rumors = await page.evaluate(() => ["rumor_kemuri_experiments", "rumor_kumicho_cigarman"].filter((id) => state.limeDone.includes(id)));
if (rumors.length !== 2) throw new Error("rumor LIMEs not delivered: " + rumors.join(","));
for (const id of [
  "ch2_slump_taste", "ch2_lingering_smell", "ch2_pre_tournament_realisation",
  "ch2_sumi_silence", "ch2_naru_confrontation", "ch2_empty_victory_post",
  "home_shisha_night",
]) {
  if (!nightDialogues.has(id)) throw new Error("missing ch2 dialogue: " + id);
}
log("isolation/night dialogues:", [...nightDialogues].join(", "));
if (errors.length) throw new Error("page errors:\n" + errors.join("\n"));
log("CH2 PASSED ✅");
await browser.close();
