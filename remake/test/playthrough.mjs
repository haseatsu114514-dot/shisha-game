// リメイク版 第1章の通しテスト。
//   1) 新規ゲーム → コールドオープン → チュートリアル → DAY1〜13の日常 → DAY14の大会
//   2) 大会1回目は「下手」で挑んで GAME OVER になること
//   3) 「もう一度挑戦する」→「上手」で南雲の最後の一票による優勝 → 第1章クリアになること
// 使い方: リポジトリのルートで `python3 -m http.server 8123` を起動してから
//         node remake/test/playthrough.mjs
import { enterPlannedShop, purchasePlannedFlavor } from "./playthrough-shopping.mjs";
import { PLAN, nextPlanAction } from "./playthrough-plan.mjs";
import { createRequire } from "module";
import { recordLoad } from "../tools/load-recorder.mjs";
import { installLoadingComicReader } from "./browser/loading_reader.mjs";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); } catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const STREET_MODE = process.env.STREET_MODE === "1";
const SHOTS = process.env.SHOTS || "";
const log = (...a) => console.log("[remake]", ...a);

// 時間を使う行動計画は上から順に消費。必須購入は中間準備後の最初の自由マップで行う。
// DAY1 の昼は案内つきのおつかい（Dr.fookah でレモン→KEMURIKUSA 偵察）、DAY2 は参加登録の後、スミさんの配達（PEPPERMINT・EDEN）で埋まる
// （配達の2枠は計画を消費しない。DAY3 から下の計画へ進む）

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
// This full-chapter run checks progression, scoring and CG recording. Normal-speed
// scene endings and navigation are covered by motion_endings/navigation_transitions.
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
await installLoadingComicReader(page);
const loadReport = process.env.LOAD_REPORT ? await recordLoad(page, BASE) : null;
await page.addInitScript(() => {
  if (window.top !== window) return; // 会話計測フックは本編だけ。歩行frameに相対importを注入しない。
  window.addEventListener("DOMContentLoaded", async () => {
    const audio = await import("./js/core/audio.js");
    const { hooks } = await import("./js/vn/engine.js");
    window.__tournamentBgmCues = {};
    const previous = hooks.onLine;
    hooks.onLine = (id, line) => {
      previous?.(id, line);
      if (["ch1_tournament_opening", "remake_round1_intro", "ch1_tournament_r1_end",
        "ch1_tournament_r2_end", "ch1_tournament_r3_end", "remake_round4_end", "remake_judging_intro"].includes(id)) {
        const attempt = window.__remake.state.tournament.attempts;
        window.__tournamentBgmCues[`${attempt}:${id}`] = audio.currentBgm();
      }
    };
  });
});
const errors = [];
page.on("pageerror", (e) => {
  const text = e.stack || e.message;
  console.error("[pageerror]", text);
  errors.push(`pageerror: ${text}`);
});
page.on("console", (m) => {
  // Webフォント（外部）の読み込み失敗はサンドボックス都合なので無視
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector('[data-test="title-new"]', { timeout: 20000 });
if (loadReport) { await loadReport.settle(); loadReport.snapshot("title-with-prefetch"); }
await page.evaluate(() => { localStorage.clear(); window.__remake.vnTest.turbo = true; window.__remake.craftTest.auto = "good"; });
log("title OK");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/title.png` });
await page.click('[data-test="title-new"]');
// 天気の種を固定（雨の日 = DAY2/7/10/13）。雨の日のマップ・バイトを必ず通す
await page.evaluate(() => { const s = window.__remake.state; s.weatherSeed = 4; s.seed = 1; s.reel.seed = 1; });

let planIdx = 0;
let pendingAfter = null;
let pendingShopBuy = null;
let lemonPurchased = false;
let lastPlanTrace = "";
let kujiDrawn = false;
let firstKujiBlocked = false;
let tournamentAttempt = 0;
let lastProgress = Date.now();
let lastKey = "";
let lastDay = null;
let resumed = false;
let guided = 0;
let deliveryGuided = 0;
let rainMaps = 0;
let screenLeaks = 0;
let resultUnderPhone = false;
let feelSeen = false;
let nicoSeen = false;
let rtFeelSeen = false;
let fortuneTried = false;
let slotLoaded = false;
let stock0 = null;
let limeCoach = 0;
let limeOpened = 0;
let errandBlocked = false;
let checkedTutorialGrowth = false;
let pendingDrill = null;
const seenShots = new Set();
const deadline = Date.now() + 12 * 60 * 1000;

async function click(sel) {
  const el = await page.$(sel);
  let ok = false;
  let error = null;
  if (el) try { await el.click({ timeout: 2000 }); ok = true; } catch (e) { error = e.message; }
  if (pendingShopBuy || /shop|buy-|kuji/.test(sel))
    log("shopping-click", JSON.stringify({ sel, ok, error, planIdx, pendingShopBuy, state: await shoppingSnapshot() }));
  return ok;
}

// Read-only evidence: no inventory, money or random source is rewritten.
async function shoppingSnapshot(id = pendingShopBuy) {
  return page.evaluate((id) => {
    const s = window.__remake.state;
    return { screen: document.body.dataset.screen, day: s.day, slot: s.slot,
      money: s.money, stock: s.flavorStock?.[id] || 0, owned: s.flavors.includes(id),
      price: window.__remake.DB.flavorById[id]?.price,
      quantity: Number(document.querySelector(`[data-test="quantity-${id}"]`)?.textContent || 0),
      flavorStock: { ...s.flavorStock }, kuji: s.kuji,
      goods: s.goods, equipment: s.owned };
  }, id);
}
async function shoppingRequired(sel) {
  if (!await click(sel)) throw new Error(`Shopping input failed: ${sel}; planIdx=${planIdx} pendingShopBuy=${pendingShopBuy}`);
}

// 任意の街歩き経由でも、同じ行動計画と大会の検証を実行する。
async function chooseDestination(id) {
  const doors = { cafe: "cafe", minto: "peppermint", naru: "kemurikusa" };
  if (STREET_MODE && doors[id]) {
    if (!(await page.$(`[data-test="pin-${id}"]:not(.off)`))) return false;
    const navigating = page.waitForEvent('framenavigated', f => f.url().includes('embed=1'));
    await click('[data-test="map-walk"]');
    const frame = await navigating;
    await frame.waitForFunction(() => window.__street?.state().ready && !window.__street.state().paused);
    // 通し確認では入口へ配置し、実キーで決定。実移動・タップは street_selection.mjs で検証。
    await frame.evaluate((door) => window.__street.warp(door), doors[id]);
    await frame.locator("#view").focus();
    await page.keyboard.press("KeyZ");
    await page.waitForSelector('[data-test="street-frame"]', { state: "detached" });
    return true;
  }
  return (await click(`[data-test="pin-${id}"]`)) && (await click('[data-test="map-go"]'));
}
let checkedDeliveryBoundary = false;

for (;;) {
  if (Date.now() > deadline) throw new Error("timeout (12min)");
  await page.waitForTimeout(60);
  const snap = await page.evaluate(() => {
    const s = window.__remake.state;
    return {
      screen: document.body.dataset.screen,
      vn: document.querySelector("#vn")?.classList.contains("active"),
      phone: !!document.querySelector(".phone-overlay"),
      modal: document.querySelector("#modal")?.classList.contains("show"),
      day: s?.day, slot: s?.slot, phase: s?.phase, stamina: s?.stamina, money: s?.money,
      errandDone: !!s?.flags?._errand_scout_done,
      midcheckDone: !!s?.flags?._ev_midcheck,
      coldPending: !!s?.flags?._cold_pending,
      sickOnce: !!s?.flags?._sick_once,
      restDay: s?.restDay,
      deliveriesDone: !!(s?.flags?._delivery_adam_done && s?.flags?._delivery_minto_done),
      stats: s?.stats,
      lastRank: s?.tournament?.lastRank,
      endTitle: document.querySelector(".end-screen.gameover") ? "GAME OVER" : document.querySelector(".end-title")?.textContent || "",
      rain: document.querySelector("#screen .map:not(.done)")?.dataset.rain === "true",
      feel: !!document.querySelector('.bench .bench-audience') && !document.querySelector('.arcade-score'),
      nico: !!document.querySelector(".nico"),
      rtFeel: !!document.querySelector('.result-table .rt-judge-comment')
        && !!document.querySelector('.result-table .craft-evaluation')
        && !document.querySelector('[data-test="result-score"], .rt-meter'),
      // 会話中に前の画面（作業台・結果表・マップ等）が後ろに見えていないか
      leak: document.querySelector("#vn")?.classList.contains("active") && !!document.querySelector("#screen > *") && getComputedStyle(document.querySelector("#screen")).visibility !== "hidden",
      // 優勝の夜の LIME の後ろに結果表が残っていないか
      resultUnderPhone: !!document.querySelector(".phone-overlay") && !!document.querySelector("#screen .result-table"),
      sub: document.querySelector(".sub-title")?.textContent || "",
      // 選択済み（.done）の画面は次の画面待ち。触らない
      live: !!document.querySelector("#screen > *:not(.done)"),
      revealing: !!document.querySelector('#screen .map:not(.done)[data-revealing="true"]'),
      step: document.querySelector(".bench-panel")?.dataset.step || "",
      mode: document.querySelector(".bench")?.dataset.mode || "",
    };
  });
  const key = JSON.stringify([snap.screen, snap.day, snap.slot, snap.phase, planIdx, snap.vn, snap.phone, snap.modal, snap.sub, snap.mode, snap.step]);
  if (!checkedTutorialGrowth && snap.day === 1 && snap.screen === "map") {
    const result = await page.evaluate(() => { const s = window.__remake.state;
      return { stats: s.stats, xp: s.statXp, spins: s.reel.count }; });
    if (Object.values(result.stats).some(n => n !== 10) || Object.values(result.xp).some(n => n !== 0) || result.spins !== 0)
      throw new Error(`Forced/tutorial growth: ${JSON.stringify(result)}`);
    checkedTutorialGrowth = true;
    log("tutorial/forced growth remains zero");
  }
  if (snap.day !== lastDay) {
    loadReport?.snapshot(`day-${snap.day}`); lastDay = snap.day;
    log(`DAY ${snap.day} (${snap.phase}) money=${snap.money} stamina=${snap.stamina}`,
      JSON.stringify({ slot: snap.slot, planIdx, next: PLAN[planIdx] || "rest", lemonPurchased,
        coldPending: snap.coldPending, sickOnce: snap.sickOnce, restDay: snap.restDay }));
  }
  if (key !== lastKey) { lastKey = key; lastProgress = Date.now(); }
  if (Date.now() - lastProgress > 30000) {
    log("stall-detail", JSON.stringify({ snap, limeCoach, limeOpened, fortuneTried,
      text: await page.locator('body').innerText() }));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/stuck.png` });
    if (errors.length) log("errors before stall:", JSON.stringify(errors));
    throw new Error(`stuck: ${key}`);
  }

  if (snap.leak) screenLeaks++;
  if (snap.resultUnderPhone) resultUnderPhone = true;
  if (snap.feel) feelSeen = true;
  if (snap.nico) nicoSeen = true;
  if (snap.rtFeel) rtFeelSeen = true;
  // LIME: 返信は押せる先頭の選択肢（誘いには乗る）→ 未読のトークを順に開く → 一覧へ戻る → 閉じる
  if (snap.phone) {
    (await click('.lime-reply[data-test^="reply-"]:not([disabled])'))
      || (await click(".lime-chat-row.unread"))
      || (await click('[data-test="phone-next"]'))
      || (await click('[data-test="phone-close"]'));
    continue;
  }
  // 体力の警告は素直に引き返す
  if (snap.modal) {
    // スロットの初回説明（タップ送り）・くじの開封（タップで閉じる）
    if (await click('[data-test="reel-intro"]')) continue;
    if (await click('[data-test="drill-finish"]')) continue;
    if (await click('[data-test="kuji-reveal"]')) continue;
    if (await click('[data-test="status-close"]')) continue;
    const btns = await page.$$("#modal .modal-actions button");
    if (btns.length) { await btns[0].click().catch(() => {}); continue; }
  }
  // 画面の種類ごとに最初の1枚だけ記録（SHOTS 指定時）
  const tag = `${snap.screen}${snap.step ? "-" + snap.mode + "-" + snap.step : ""}${snap.vn ? "-vn" : ""}`;
  if (SHOTS && !seenShots.has(tag)) { seenShots.add(tag); await page.waitForTimeout(snap.step ? 700 : 250); await page.screenshot({ path: `${SHOTS}/${String(seenShots.size).padStart(2, "0")}_${tag}.png` }); }
  // 解禁後にLIME案内等が現れるため、待機後は画面全体を読み直してから操作する。
  if (snap.vn || !snap.live || snap.revealing) continue; // 会話・画面切替・解禁の終了を待つ

  if (snap.screen === "end") {
    if (/GAME OVER/.test(snap.endTitle)) {
      // CONTINUE has its own caption/reaction controls, outside VN turbo.
      // Read each cue, then complete the chosen reaction through the real UI.
      if (await click('[data-test="continue-next"]:not([disabled])')) continue;
      if (await click('[data-test="continue-proceed"]:not([hidden]):not([disabled])')) continue;
      if (await page.$('.gameover[data-phase="reaction"]')) continue;
      log(`GAME OVER（1回目の挑戦・${snap.lastRank}位）→ 上手に切り替えて再挑戦`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/gameover.png` });
      if (snap.lastRank === 1) throw new Error("bad play should not win");
      await page.evaluate(() => { window.__remake.craftTest.auto = "good"; });
      await click('[data-test="retry"]');
      await page.waitForTimeout(1500);
      continue;
    }
    if (/クリア/.test(snap.endTitle)) {
      log("第1章クリア！", JSON.stringify({ money: snap.money, stats: snap.stats }));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/clear.png` });
      break;
    }
  }

  if (snap.phase === "tournament" && tournamentAttempt === 0) {
    if (snap.day !== 14) throw new Error(`Tournament must start on DAY14, got DAY${snap.day}`);
    tournamentAttempt = 1;
    // 1回目の本番は下手に作って、敗北ルートを通す
    await page.evaluate(() => { window.__remake.craftTest.auto = "bad"; });
    log(`大会当日（DAY ${snap.day}）── 1回目は下手に挑む`);
    stock0 = await page.evaluate(() => ({ ...window.__remake.state.flavorStock }));
  }

  // セーブ→つづきから の確認: DAY2 の最初のマップで一度リロードし、同じ日・同じ時間帯から再開できること
  if (snap.screen === "map" && snap.day === 2 && snap.slot === 0 && !resumed) {
    resumed = true;
    const before = { day: snap.day, slot: snap.slot, money: snap.money };
    // 手動セーブ: MENU → セーブ → スロット1
    await click('[data-test="hud-menu"]');
    await page.waitForSelector('[data-test="menu-save"]', { timeout: 5000 });
    await click('[data-test="menu-save"]');
    await page.waitForSelector('[data-test="slot-1"]', { timeout: 5000 });
    await click('[data-test="slot-1"]');
    await page.waitForTimeout(300);
    const slot1 = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_slot1") || "null"));
    if (!slot1 || slot1.day !== 2) throw new Error("manual save to slot 1 failed");
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('[data-test="title-load"]:not([disabled])', { timeout: 20000 });
    await page.evaluate(() => { window.__remake.vnTest.turbo = true; window.__remake.craftTest.auto = "good"; });
    await page.click('[data-test="title-load"]');
    await page.waitForSelector('[data-test="slot-0"]:not([disabled])');
    await page.click('[data-test="slot-0"]');
    await page.waitForFunction(() => document.querySelector(".map:not(.done)"), null, { timeout: 20000 });
    const after = await page.evaluate(() => { const s = window.__remake.state; return { day: s.day, slot: s.slot, money: s.money }; });
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`resume mismatch ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    log("つづきから OK", JSON.stringify(after));
    // タイトルの「ロード」→ スロット1 からも同じところへ戻れる
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('[data-test="title-load"]:not([disabled])', { timeout: 20000 });
    await page.evaluate(() => { window.__remake.vnTest.turbo = true; window.__remake.craftTest.auto = "good"; });
    await page.click('[data-test="title-load"]');
    await page.waitForSelector('[data-test="slot-1"]:not([disabled])', { timeout: 5000 });
    await page.click('[data-test="slot-1"]');
    await page.waitForFunction(() => document.querySelector(".map:not(.done)"), null, { timeout: 20000 });
    const loaded = await page.evaluate(() => { const s = window.__remake.state; return { day: s.day, slot: s.slot, money: s.money }; });
    if (JSON.stringify(before) !== JSON.stringify(loaded)) throw new Error(`slot load mismatch ${JSON.stringify(before)} -> ${JSON.stringify(loaded)}`);
    slotLoaded = true;
    log("ロード（スロット1）OK", JSON.stringify(loaded));
    continue;
  }

  // 1日目の案内・スミさんの配達: 光っている1か所だけ選べる。計画は進めない
  if (snap.screen === "map" && (await page.$('[data-test="map-guide"]'))) {
    const id = await page.locator(".spot-pin.guide").getAttribute("data-spot");
    if (!snap.errandDone || id === "c_station") guided++; else deliveryGuided++;
    if (snap.day === 1 && !["shop", "naru"].includes(id)) throw new Error("DAY1 must end after scouting");
    if (id === "minto" && (snap.day !== 2 || snap.slot !== 0)) throw new Error("Minto must be the first DAY2 delivery");
    if (id === "adam" && (snap.day !== 2 || snap.slot !== 1)) throw new Error("Adam must be the second DAY2 delivery");
    if (id === "c_station" && (snap.day !== 2 || snap.slot !== 0)) throw new Error("Registration must happen before DAY2 deliveries");
    await chooseDestination(id);
    continue;
  }
  // 配達が全部済むまでは、届け先だけを選べる案内のマップしか出ない
  if (snap.screen === "map" && !snap.deliveriesDone) throw new Error(`free map before deliveries (DAY ${snap.day} slot ${snap.slot})`);
  if (snap.screen === "map" && snap.deliveriesDone && !checkedDeliveryBoundary) {
    const minto = await page.evaluate(() => { const s = window.__remake.state; return { story: s.story.minto || 0, visits: s.visits.minto || 0, visited: s.visitedDay.minto === s.day }; });
    if (minto.story || minto.visits || minto.visited) throw new Error(`Delivery consumed normal minto visit: ${JSON.stringify(minto)}`);
    checkedDeliveryBoundary = true;
    log("DAY2 minto indoor delivery preserves normal first visit");
  }
  // LIME: 朝は通知だけ。はじめて届いた日はアイコンが照らされる（案内）→ 以後は赤丸があれば自分で開く
  if (snap.screen === "map" && (await click('[data-test="coach-lime"]'))) { limeCoach++; continue; }
  if (snap.screen === "map" && snap.rain) rainMaps++;
  // 路上占い師（週2日だけ出る）: 見かけたら一度だけ占ってもらう（時間は使わない）
  if (snap.screen === "map" && !fortuneTried && snap.money >= 3000 && (await page.$('[data-test="pin-fortune"]:not(.off)'))) {
    if (!await click('[data-test="pin-fortune"]') || !await click('[data-test="map-go"]'))
      throw new Error("Fortune input failed before visiting");
    fortuneTried = true;
    continue;
  }
  if (snap.screen === "map" && (await page.$(".hud-lime.has")) && (await click('[data-test="hud-phone"]'))) { limeOpened++; continue; }
  if (snap.screen === "map") {
    const { item, requiredPurchase } = nextPlanAction({ planIdx, phase: snap.phase,
      midcheckDone: snap.midcheckDone, lemonPurchased });
    const [kind, arg] = item.split(":");
    const decision = JSON.stringify({ day: snap.day, slot: snap.slot, planIdx, item, requiredPurchase,
      stamina: snap.stamina, midcheckDone: snap.midcheckDone, lemonPurchased,
      coldPending: snap.coldPending, sickOnce: snap.sickOnce, restDay: snap.restDay });
    if (decision !== lastPlanTrace) { lastPlanTrace = decision; log("plan-decision", decision); }
    // 体力が心細ければ計画を進めずに休む
    if (snap.stamina < 38 && kind !== "shop" && kind !== "rest") {
      await click('[data-test="pin-rest"]'); await click('[data-test="map-go"]');
      continue;
    }
    if (kind !== "shop") planIdx++;
    if (kind === "baito" || kind === "customer") {
      pendingAfter = kind === "baito" ? arg : null;
      await click('[data-test="pin-tonari"]'); await click('[data-test="map-go"]');
      await page.waitForSelector('[data-test="tonari-baito"]', { timeout: 5000 }).catch(() => {});
      await click(kind === "baito" ? '[data-test="tonari-baito"]' : '[data-test="tonari-customer"]');
    } else if (kind === "shop" || kind === "rin") {
      pendingShopBuy = kind === "shop" ? arg : "__upstairs";
      log("shopping-plan", JSON.stringify({ planIdx, pendingShopBuy, state: await shoppingSnapshot() }));
      await shoppingRequired('[data-test="pin-shop"]');
      await enterPlannedShop({ read: shoppingSnapshot, click,
        ready: () => page.waitForSelector('.shop-entry:not(.done)', { timeout: 5000 }) });
    } else {
      const ok = await chooseDestination(kind);
      if (!ok) { log(`  (DAY ${snap.day}: ${kind} に行けないので休む)`); await click('[data-test="pin-rest"]'); await click('[data-test="map-go"]'); }
    }
    continue;
  }
  if (snap.screen === "preparation") { await click('[data-test="prep-flavor-blueberry"]'); continue; }
  if (snap.screen === "shop-entry") {
    const upstairs = pendingShopBuy === "__upstairs" && await page.$('[data-test="shop-upstairs"]:not([disabled])');
    await shoppingRequired(upstairs ? '[data-test="shop-upstairs"]' : '[data-test="shop-enter"]');
    if (pendingShopBuy === "__upstairs") pendingShopBuy = null;
    continue;
  }
  if (snap.screen === "shop") {
    const firstErrandVisit = await page.evaluate(() => !window.__remake.state.flags._errand_shop_done
      && !!document.querySelector(".shop-errand"));
    // スミさんの頼み（レモン）を買うまでは店を出られない
    if (await page.$(".shop-errand:not(.done)")) {
      if (await click('[data-test="shop-leave"]')) { await page.waitForTimeout(200); errandBlocked ||= !!(await page.$(".shop-errand:not(.done)")); }
      const errand = await page.locator('.shop-row.errand [data-test^="buy-"]').first().getAttribute('data-test');
      await click(`[data-test="${errand}"]`);
      await click('[data-test="shop-checkout"]');
    }
    if (pendingShopBuy && pendingShopBuy !== "__upstairs") {
      await purchasePlannedFlavor({
        id: pendingShopBuy, read: shoppingSnapshot, click,
        trace: event => log("shopping-purchase", JSON.stringify({ planIdx, pendingShopBuy, ...event })),
        // Buying is independent of PLAN: preserve the next time-consuming action.
        consume: () => { lemonPurchased = true; pendingShopBuy = null; },
      });
    }
    // 初回買い出しでは拒否され、後日の通常営業で1回引ける。
    if (!kujiDrawn) {
      await shoppingRequired('.shop-tab[data-tab="kuji"]');
      const before = await shoppingSnapshot();
      await shoppingRequired('[data-test="kuji-g500"]');
      const after = await shoppingSnapshot();
      log("shopping-kuji", JSON.stringify({ planIdx, pendingShopBuy, before, after }));
      if (firstErrandVisit) {
        if (JSON.stringify(after) !== JSON.stringify(before) || await page.$('.kuji-card.reveal'))
          throw new Error("First lemon errand allowed a kuji purchase");
        firstKujiBlocked = true;
      } else {
        if (after.kuji.g500.drawn !== before.kuji.g500.drawn + 1 || after.money !== before.money - 500)
          throw new Error("Kuji input did not produce expected draw/payment");
        kujiDrawn = true;
        await page.waitForSelector('.kuji-card.reveal', { timeout: 5000 });
        await click('[data-test="kuji-reveal"]');
      }
    }
    await shoppingRequired('[data-test="shop-leave"]');
    continue;
  }
  if (snap.screen === "tonari") {
    if (/今日の復習/.test(snap.sub)) { await click('[data-test="drill-pull"]'); continue; }
    if (/シフト上がり/.test(snap.sub)) {
      // シフト後の自主練は家へ移した（#638）。計画の "baito:holes" などはシフトだけを行い、そのまま上がる。
      // スミ会話は #1081 B05 で必須化され、メニュー表示前に自動で流れる（"sumi" 計画も追加操作は不要）。
      const selected = await click('[data-test="after-none"]');
      // 画面の切替中に押せなかった場合は、予定した選択を消さず次の入力で再試行する。
      if (selected) { pendingDrill = null; pendingAfter = null; }
      continue;
    }
    if (snap.sub === "自主練" && pendingDrill) {
      if (await click(`[data-test="drill-${pendingDrill}"]`)) pendingDrill = null;
      continue;
    }
    if (/tonari/.test(snap.sub)) { await click('[data-test="sub-back"]'); continue; }
  }
}

const s = await page.evaluate(() => window.__remake.state);
if (s.day !== 14) throw new Error(`Tournament/clear day must remain DAY14, got DAY${s.day}`);
if (!s.flags._ev_first_practice || !s.flags._ev_midcheck || !s.flags._ev_rehearsal || !s.flags._ev_last_night) throw new Error("DAY13 rehearsal or last-night conversation was lost");
const practiceRuns = s.flags._craft_practice_runs || [];
const prepared = s.flags._prep_flavor;
// くじで先に材料を得た場合は、既存在庫で準備を済ませる契約。ブルーベリーの新規購入を強制しない。
if (practiceRuns.length < 3 || !s.flavors.includes("lemon") || !s.flavors.includes(prepared)
  || ["mint", "double_apple"].includes(prepared)
  || !(practiceRuns.find(run => run.kind === "midcheck")?.mix?.[prepared] > 0)) {
  throw new Error(`Missing practice/shopping: prepared=${prepared} runs=${JSON.stringify(practiceRuns)} flavors=${JSON.stringify(s.flavors)}`);
}
if (!lemonPurchased) throw new Error("Required lemon purchase was never confirmed");
log(`attempts=${s.tournament.attempts} lastRank=${s.tournament.lastRank} total=${s.tournament.lastTotal}`);
if (s.phase !== "cleared") throw new Error(`expected cleared, got ${s.phase}`);
const recognitionComments = await page.evaluate(() => Object.entries((window.__remake.DB || {}).dialogues || {}).flatMap(([id, d]) =>
  id.startsWith("ch1_craft_recognition_") ? d.lines.filter(l => l.speaker === "sumi").map(l => l.text) : []));
const scoreSheet = s.inbox.find(item => item.id === "_sys_sumi_scoresheet");
if (!recognitionComments.length || !scoreSheet?.msg.messages.some(text => recognitionComments.includes(text))) {
  throw new Error("A successful tournament did not acknowledge any actual craft step");
}
if (s.tournament.attempts < 2) throw new Error("expected a defeat before the win");
const bgmCues = await page.evaluate(() => window.__tournamentBgmCues);
for (let attempt = 1; attempt <= s.tournament.attempts; attempt++) {
  for (const [id, expected] of [
    ["ch1_tournament_opening", "bgm_tournament_edm"],
    ["remake_round1_intro", "bgm_tournament_craft"],
    ["ch1_tournament_r1_end", "bgm_tournament_craft"],
    ["ch1_tournament_r2_end", "bgm_tournament_craft"],
    ["ch1_tournament_r3_end", "bgm_tournament_craft"],
    ["remake_round4_end", "bgm_tournament_craft"],
    ["remake_judging_intro", "bgm_judging"],
  ]) {
    if (bgmCues[`${attempt}:${id}`] !== expected) throw new Error(`Wrong BGM at attempt ${attempt} ${id}: ${bgmCues[`${attempt}:${id}`]}`);
  }
}
log("tournament BGM: opening → crafting ROUND 1–4 → judging, including retry: PASS");
// スロット: 日常の行動ごとに1回転（リプレイの追加回転を含む）。結果は全部演出まで消化されている
log(`slot: seed=${s.reel.seed} spins=${s.reel.count} note=${JSON.stringify(s.reel.note)} pending=${s.reel.pending.length}`);
if (s.reel.count < 20) throw new Error(`slot should spin once per action (count=${s.reel.count})`);
if (!s.reel.introDone) throw new Error("slot intro not shown");
// 夜の行動の分もその夜のうちに回し切る＝章の終わりに見せていない回転が残らない
if (s.reel.pending.length) throw new Error(`slot spins left unshown: ${s.reel.pending.length}`);
// 1日目の案内: レモンの仕入れ→偵察→スミさんから私物として贈られる。
log(`day1 errands: guided=${guided} errandBlocked=${errandBlocked} scout=${!!s.flags._errand_scout_done} lemon=${s.flavors.includes("lemon")}`);
if (guided !== 3 || !errandBlocked || !s.flags._errand_scout_done || !s.flavors.includes("lemon") || !s.flags._lemon_gift_read) throw new Error("day1 errands not completed as guided");
// スミさんの配達（DAY2 昼 PEPPERMINT・夜 EDEN）: 初来店を配達の場面で通す
log(`deliveries: guided=${deliveryGuided} adam=${s.flags._delivery_adam_done}@${s.flags._delivery_adam} minto=${s.flags._delivery_minto_done}@${s.flags._delivery_minto}`);
if (deliveryGuided !== 2 || !s.flags._delivery_adam || !s.flags._delivery_minto || !s.flags._delivery_adam_done || !s.flags._delivery_minto_done)
  throw new Error("EDEN/PEPPERMINT deliveries not completed as guided");
// スミさんのバイト誘い（DAY3/8 は固定で届く。テストは誘いに乗る）
log(`sumi baito invites: ${s.limeRead.filter((id) => id.startsWith("_sumi_baito_inv_")).join(",")} lastBaitoDay=${s.lastBaitoDay}`);
if (!s.limeRead.includes("_sumi_baito_inv_d3")) throw new Error("sumi baito invite (DAY3) not delivered");
// LIME: 朝は受信箱に届くだけ。初回は案内で開き、以後は赤丸を見て開く。誘いには当日のうちに乗れる
const inbox = s.inbox || [];
log(`lime: coach=${limeCoach} opened=${limeOpened} inbox=${inbox.length} read=${inbox.filter((i) => i.read).length} accepted=${inbox.filter((i) => i.result === "accepted").length}`);
if (limeCoach !== 1) throw new Error("LIME tutorial (coach) should appear exactly once");
if (!inbox.length || inbox.some((i) => !i.read && i.day < 14)) throw new Error("LIME inbox: messages left unread");
if (!inbox.some((i) => i.result === "accepted")) throw new Error("LIME: no invitation accepted from the inbox");
// 前の画面が残らない: 会話の後ろに画面が透けない／優勝の夜の LIME の後ろに結果表が残らない
log(`screen leaks during VN=${screenLeaks} resultUnderPhone=${resultUnderPhone}`);
if (screenLeaks) throw new Error(`previous screen visible behind a scene (${screenLeaks} samples)`);
if (resultUnderPhone) throw new Error("result table left behind the LIME");
// 雨の日: 種を固定したので雨のマップを必ず通る
log(`rain maps=${rainMaps} / slot load=${slotLoaded} / fortune day=${s.fortuneDay} met=${!!s.flags._fortune_met}`);
if (!rainMaps) throw new Error("no rainy map shown");
if (!slotLoaded) throw new Error("manual save/load not verified");
if (!s.flags._fortune_met || !s.fortuneDay) throw new Error("fortune teller not visited");
// 実況と観客の反応、結果表の印と審査員コメントで手応えを伝える
log(`broadcast: feel=${feelSeen} nico=${nicoSeen} resultFeel=${rtFeelSeen}`);
if (!feelSeen || !nicoSeen || !rtFeelSeen) throw new Error("tournament broadcast layer missing");
// グラム在庫（再挑戦は会場入り前に戻す）。課題のレモンは大会支給で私物から減らない
// （オーナー決定 2026-10-28・9e99f279, Refs #1052）。卓上台にダブルアップル50gは付かない（#1081 D02・3bfcac5a）ので、
// 自動の「上手」配合 {lemon:3, double_apple:9} は持ち込みのダブルアップル在庫までに切り詰められ、残りは支給レモンで埋まる。
log(`stock: before=${JSON.stringify(stock0)} after=${JSON.stringify(s.flavorStock)}`);
if (!stock0) throw new Error("flavor stock before the tournament was not recorded");
const apple0 = stock0.double_apple || 0;
if ((s.flavorStock.double_apple || 0) !== apple0 - Math.min(9, apple0)) throw new Error("flavor stock not consumed as expected");
if (s.flavorStock.lemon !== stock0.lemon) throw new Error("supplied lemon should not consume private stock");
for (const id of new Set([...Object.keys(stock0), ...Object.keys(s.flavorStock)]))
  if (!["double_apple", "lemon"].includes(id) && (s.flavorStock[id] || 0) !== (stock0[id] || 0)) throw new Error(`unused ${id} should not be consumed`);
// くじ: 1枚引いて箱が減っている
if (!firstKujiBlocked) throw new Error("First lemon errand kuji refusal not verified");
if (!(s.kuji.g500 && s.kuji.g500.drawn === 1)) throw new Error(`kuji not drawn: ${JSON.stringify(s.kuji)}`);
// ch1 のソフトキャップ（48）を超えていない
for (const [k, v] of Object.entries(s.stats)) if (v > 48) throw new Error(`stat ${k}=${v} exceeds ch1 soft cap`);
if (errors.length) { console.error(errors.join("\n")); throw new Error(`${errors.length} page errors`); }
log("PASS");
if (loadReport) {
  await loadReport.settle();
  loadReport.snapshot("chapter-1-cleared-with-retry");
  loadReport.write(process.env.LOAD_REPORT, { browser: browser.version(), scope: "existing chapter-1 playthrough PLAN, turbo dialogue, automatic minigames, defeat then retry and win, save/load included; cumulative snapshots; branch-dependent routes are not all traversed." });
}
await browser.close();
