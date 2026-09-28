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
const PLAN = [
  "baito:sumi", "naru",
  "shop:mint", "baito:holes",
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

const browser = await chromium.launch({ headless: true });
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

let planIdx = 0;
let pendingAfter = null;
let pendingShopBuy = null;
let kujiDrawn = false;
let tournamentAttempt = 0;
let lastProgress = Date.now();
let lastKey = "";
let lastDay = null;
let resumed = false;
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

  // LIME: 返信は先頭の選択肢、読み終えたら閉じる
  if (snap.phone) { (await click('[data-test="reply-0"]')) || (await click('[data-test="phone-next"]')); continue; }
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
  }

  // セーブ→つづきから の確認: DAY2 の最初のマップで一度リロードし、同じ日・同じ時間帯から再開できること
  if (snap.screen === "map" && snap.day === 2 && snap.slot === 0 && !resumed) {
    resumed = true;
    const before = { day: snap.day, slot: snap.slot, money: snap.money };
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector('[data-test="title-continue"]:not([disabled])', { timeout: 20000 });
    await page.evaluate(() => { window.__remake.vnTest.turbo = true; window.__remake.craftTest.auto = "good"; });
    await page.click('[data-test="title-continue"]');
    await page.waitForFunction(() => document.querySelector(".map:not(.done)"), null, { timeout: 20000 });
    const after = await page.evaluate(() => { const s = window.__remake.state; return { day: s.day, slot: s.slot, money: s.money }; });
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`resume mismatch ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    log("つづきから OK", JSON.stringify(after));
    continue;
  }

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
// くじ: 1枚引いて箱が減っている
if (!(s.kuji.g500 && s.kuji.g500.drawn === 1)) throw new Error(`kuji not drawn: ${JSON.stringify(s.kuji)}`);
// ch1 のソフトキャップ（48）を超えていない
for (const [k, v] of Object.entries(s.stats)) if (v > 48) throw new Error(`stat ${k}=${v} exceeds ch1 soft cap`);
if (errors.length) { console.error(errors.join("\n")); throw new Error(`${errors.length} page errors`); }
log("PASS");
await browser.close();
