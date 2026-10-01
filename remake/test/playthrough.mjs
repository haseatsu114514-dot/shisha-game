// リメイク版 第1章の通しテスト。
//   1) 新規ゲーム → コールドオープン → チュートリアル → 14日間の日常（行動計画どおり）
//   2) 大会1回目は「下手」で挑んで GAME OVER になること
//   3) 「もう一度挑戦する」→「上手」で南雲票の逆転優勝 → 第1章クリアになること
// 使い方: リポジトリのルートで `python3 -m http.server 8123` を起動してから
//         node remake/test/playthrough.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); } catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const SHOTS = process.env.SHOTS || "";
const log = (...a) => console.log("[remake]", ...a);

// 行動計画（上から順に消費）。shop:* は時間を使わない買い物、after:* はバイト後の過ごし方
// DAY1 の昼は案内つきのおつかい（Dr.fookah でミント→KEMURIKUSA 偵察）で埋まる
const PLAN = [
  "baito:sumi", "naru",
  "baito:holes",
  "adam", "customer",
  "minto", "baito:sumi",
  "naru", "rest",
  "baito:heat", "cafe",
  "c_station", "customer",
  "adam", "baito:sumi",
  "rin", "kannon",
  "baito:pull", "rest",
  "naru", "choizap",
  "shop:lemon", "rin", "baito:sumi",
  "adam", "rest",
  "baito:steam", "customer",
  "minto", "customer", "rest", "rest",
];

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  // Webフォント（外部）の読み込み失敗はサンドボックス都合なので無視
  if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector('[data-test="title-new"]', { timeout: 20000 });
await page.evaluate(() => { localStorage.clear(); window.__remake.vnTest.turbo = true; window.__remake.craftTest.auto = "good"; });
log("title OK");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/title.png` });
await page.click('[data-test="title-new"]');
// 天気の種を固定（雨の日 = DAY2/7/10/13）。雨の日のマップ・バイトを必ず通す
await page.evaluate(() => { window.__remake.state.weatherSeed = 4; });

let planIdx = 0;
let pendingAfter = null;
let pendingShopBuy = null;
let kujiDrawn = false;
let tournamentAttempt = 0;
let lastProgress = Date.now();
let lastKey = "";
let lastDay = null;
let resumed = false;
let guided = 0;
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
const seenShots = new Set();
const deadline = Date.now() + 12 * 60 * 1000;

async function click(sel) {
  const el = await page.$(sel);
  if (!el) return false;
  try { await el.click({ timeout: 2000 }); return true; } catch { return false; }
}

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
      stats: s?.stats,
      lastRank: s?.tournament?.lastRank,
      endTitle: document.querySelector(".end-title")?.textContent || "",
      rain: document.querySelector("#screen .map:not(.done)")?.dataset.rain === "true",
      feel: !!document.querySelector(".bc-feel.show"),
      nico: !!document.querySelector(".nico"),
      rtFeel: !!document.querySelector(".rt-part.feel"),
      // 会話中に前の画面（作業台・結果表・マップ等）が後ろに見えていないか
      leak: document.querySelector("#vn")?.classList.contains("active") && !!document.querySelector("#screen > *") && getComputedStyle(document.querySelector("#screen")).visibility !== "hidden",
      // 優勝の夜の LIME の後ろに結果表が残っていないか
      resultUnderPhone: !!document.querySelector(".phone-overlay") && !!document.querySelector("#screen .result-table"),
      sub: document.querySelector(".sub-title")?.textContent || "",
      // 選択済み（.done）の画面は次の画面待ち。触らない
      live: !!document.querySelector("#screen > *:not(.done)"),
      step: document.querySelector(".bench-panel")?.dataset.step || "",
      mode: document.querySelector(".bench")?.dataset.mode || "",
    };
  });
  const key = JSON.stringify([snap.screen, snap.day, snap.slot, snap.phase, planIdx, snap.vn, snap.phone, snap.modal, snap.sub]);
  if (snap.day !== lastDay) { lastDay = snap.day; log(`DAY ${snap.day} (${snap.phase}) money=${snap.money} stamina=${snap.stamina}`); }
  if (key !== lastKey) { lastKey = key; lastProgress = Date.now(); }
  if (Date.now() - lastProgress > 30000) {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/stuck.png` });
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
    if (await click('[data-test="kuji-reveal"]')) continue;
    if (await click('[data-test="status-close"]')) continue;
    const btns = await page.$$("#modal .modal-actions button");
    if (btns.length) { await btns[0].click().catch(() => {}); continue; }
  }
  // 画面の種類ごとに最初の1枚だけ記録（SHOTS 指定時）
  const tag = `${snap.screen}${snap.step ? "-" + snap.mode + "-" + snap.step : ""}${snap.vn ? "-vn" : ""}`;
  if (SHOTS && !seenShots.has(tag)) { seenShots.add(tag); await page.waitForTimeout(snap.step ? 700 : 250); await page.screenshot({ path: `${SHOTS}/${String(seenShots.size).padStart(2, "0")}_${tag}.png` }); }
  if (snap.vn || !snap.live) continue; // 会話はターボで自動送り／選択済みの画面は次を待つ

  if (snap.screen === "end") {
    if (/GAME OVER/.test(snap.endTitle)) {
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
    await page.waitForSelector('[data-test="title-continue"]:not([disabled])', { timeout: 20000 });
    await page.evaluate(() => { window.__remake.vnTest.turbo = true; window.__remake.craftTest.auto = "good"; });
    await page.click('[data-test="title-continue"]');
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

  // 1日目の案内: 光っている1か所だけ選べる。計画は進めない
  if (snap.screen === "map" && (await page.$('[data-test="map-guide"]'))) {
    guided++;
    await click(".spot-pin.guide"); await click('[data-test="map-go"]');
    continue;
  }
  // LIME: 朝は通知だけ。はじめて届いた日はアイコンが照らされる（案内）→ 以後は赤丸があれば自分で開く
  if (snap.screen === "map" && (await click('[data-test="coach-lime"]'))) { limeCoach++; continue; }
  if (snap.screen === "map" && snap.rain) rainMaps++;
  // 路上占い師（週2日だけ出る）: 見かけたら一度だけ占ってもらう（時間は使わない）
  if (snap.screen === "map" && !fortuneTried && snap.money >= 3000 && (await page.$('[data-test="pin-fortune"]:not(.off)'))) {
    fortuneTried = true;
    await click('[data-test="pin-fortune"]'); await click('[data-test="map-go"]');
    continue;
  }
  if (snap.screen === "map" && (await page.$(".hud-lime.has")) && (await click('[data-test="hud-phone"]'))) { limeOpened++; continue; }
  if (snap.screen === "map") {
    const item = PLAN[planIdx] || "rest";
    const [kind, arg] = item.split(":");
    // 体力が心細ければ計画を進めずに休む
    if (snap.stamina < 38 && kind !== "shop" && kind !== "rest") {
      await click('[data-test="pin-rest"]'); await click('[data-test="map-go"]');
      continue;
    }
    planIdx++;
    if (kind === "baito" || kind === "customer") {
      pendingAfter = kind === "baito" ? arg : null;
      await click('[data-test="pin-tonari"]'); await click('[data-test="map-go"]');
      await page.waitForSelector('[data-test="tonari-baito"]', { timeout: 5000 }).catch(() => {});
      await click(kind === "baito" ? '[data-test="tonari-baito"]' : '[data-test="tonari-customer"]');
    } else if (kind === "shop" || kind === "rin") {
      pendingShopBuy = kind === "shop" ? arg : "__upstairs";
      await click('[data-test="pin-shop"]'); await click('[data-test="map-go"]');
    } else {
      const ok = (await click(`[data-test="pin-${kind}"]`)) && (await click('[data-test="map-go"]'));
      if (!ok) { log(`  (DAY ${snap.day}: ${kind} に行けないので休む)`); await click('[data-test="pin-rest"]'); await click('[data-test="map-go"]'); }
    }
    continue;
  }
  if (snap.screen === "shop") {
    // スミさんの頼み（ミント）を買うまでは店を出られない
    if (await page.$(".shop-errand:not(.done)")) {
      if (await click('[data-test="shop-leave"]')) { await page.waitForTimeout(200); errandBlocked ||= !!(await page.$(".shop-errand:not(.done)")); }
      await click('[data-test="buy-mint"]');
    }
    if (pendingShopBuy && pendingShopBuy !== "__upstairs") await click(`[data-test="buy-${pendingShopBuy}"]`);
    // くじを1回だけ引く（箱の並びが保存され、景品が手元に入ること）
    if (!kujiDrawn) {
      kujiDrawn = true;
      await click('.shop-tab[data-tab="kuji"]');
      await click('[data-test="kuji-g500"]');
      await page.waitForSelector('.kuji-card.reveal', { timeout: 5000 });
      await click('[data-test="kuji-reveal"]');
    }
    const up = pendingShopBuy === "__upstairs" && (await page.$('[data-test="shop-upstairs"]:not([disabled])'));
    pendingShopBuy = null;
    await click(up ? '[data-test="shop-upstairs"]' : '[data-test="shop-leave"]');
    continue;
  }
  if (snap.screen === "tonari") {
    if (/シフト上がり/.test(snap.sub)) {
      const a = pendingAfter;
      pendingAfter = null;
      if (a === "sumi") await click('[data-test="after-sumi"]');
      else if (a) await click('[data-test="after-drill"]');
      else await click('[data-test="after-none"]');
      if (a && a !== "sumi") { await page.waitForSelector(`[data-test="drill-${a}"]`, { timeout: 5000 }); await click(`[data-test="drill-${a}"]`); }
      continue;
    }
    if (/tonari/.test(snap.sub)) { await click('[data-test="sub-back"]'); continue; }
  }
}

const s = await page.evaluate(() => window.__remake.state);
log(`attempts=${s.tournament.attempts} lastRank=${s.tournament.lastRank} total=${s.tournament.lastTotal}`);
if (s.phase !== "cleared") throw new Error(`expected cleared, got ${s.phase}`);
if (s.tournament.attempts < 2) throw new Error("expected a defeat before the win");
// スロット: 日常の行動ごとに1回転（リプレイの追加回転を含む）。結果は全部演出まで消化されている
log(`slot: spins=${s.reel.count} note=${JSON.stringify(s.reel.note)} pending=${s.reel.pending.length}`);
if (s.reel.count < 20) throw new Error(`slot should spin once per action (count=${s.reel.count})`);
if (!s.reel.introDone) throw new Error("slot intro not shown");
// 夜の行動の分もその夜のうちに回し切る＝章の終わりに見せていない回転が残らない
if (s.reel.pending.length) throw new Error(`slot spins left unshown: ${s.reel.pending.length}`);
// 1日目の案内: 仕入れ→偵察の2回、案内マップを通った／ミントを買う前は店を出られない
log(`day1 errands: guided=${guided} errandBlocked=${errandBlocked} scout=${!!s.flags._errand_scout_done} mint=${s.flavors.includes("mint")}`);
if (guided !== 2 || !errandBlocked || !s.flags._errand_scout_done || !s.flavors.includes("mint")) throw new Error("day1 errands not completed as guided");
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
// 実況: 大会中に体感スコアと流れるコメントが出て、結果表に体感スコアが載る
log(`broadcast: feel=${feelSeen} nico=${nicoSeen} resultFeel=${rtFeelSeen}`);
if (!feelSeen || !nicoSeen || !rtFeelSeen) throw new Error("tournament broadcast layer missing");
// グラム在庫: 大会では詰んだ分だけ減る（再挑戦は会場入り前に戻す）。課題のミントは主催支給で減らない
log(`stock: before=${JSON.stringify(stock0)} after=${JSON.stringify(s.flavorStock)}`);
if (!stock0 || s.flavorStock.double_apple !== stock0.double_apple - 9) throw new Error("flavor stock not consumed as expected");
if ((s.flavorStock.mint || 0) !== (stock0.mint || 0)) throw new Error("supplied mint should not be consumed");
// 常連ノート: バイトで接客した客が記録されている
log(`notes: ${Object.keys(s.notes).length}`);
if (!Object.keys(s.notes).length) throw new Error("customer notes empty");
// くじ: 1枚引いて箱が減っている
if (!(s.kuji.g500 && s.kuji.g500.drawn === 1)) throw new Error(`kuji not drawn: ${JSON.stringify(s.kuji)}`);
// ch1 のソフトキャップ（48）を超えていない
for (const [k, v] of Object.entries(s.stats)) if (v > 48) throw new Error(`stat ${k}=${v} exceeds ch1 soft cap`);
if (errors.length) { console.error(errors.join("\n")); throw new Error(`${errors.length} page errors`); }
log("PASS");
await browser.close();
