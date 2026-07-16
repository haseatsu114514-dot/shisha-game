// A7（初見敗北率の検証・2026-07-16）: 「初見が普通に読んで普通に遊んで勝てるか」を
// 実UIで計測する調査用スクリプト。恒常テストではない（緑/赤の合否を持たない）ため、
// 通常のテスト一覧（web-build-test スキル）には数えない。
//
// モデル化した「初見プレイヤー」:
//  - 選択はチュートリアルで教わったとおり（トライアングル・蒸らし8分・ノーマル詰め・課題ミント2g）
//  - タイミング系ミニゲームは「反応が遅め・たまに外す」（ジャスト待ちをしない）
//  - FLAVOR TRIAL は深く考えずに適当なアピールをぶつける
//  - 蒸らし弾幕の被弾は 0〜3 をランダムに与える（弾幕はリアルタイムのため直接演技しない）
// プロファイル3種 × N走 で craft スコア（南雲バー80が実質の勝敗線）と順位を集計する。
//
// 使い方: python3 -m http.server 8123 を起動してから `node web/test/firstplay.mjs`
//         走行数は TRIALS=3 のように環境変数で変更できる
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const TRIALS = Number(process.env.TRIALS || 3);
const log = (...a) => console.log("[firstplay]", ...a);

// 初見像のプロファイル。ch1のソフトキャップは48＝「やり込み気味」でも45まで
const PROFILES = [
  { name: "寄り道少なめ(ステ15)", stats: 15, practiceBest: {}, rehearsal: "rough" },
  { name: "平均的(ステ28)", stats: 28, practiceBest: { pull: 1, foil: 1 }, rehearsal: "rough" },
  { name: "やり込み気味(ステ42)", stats: 42, practiceBest: { pull: 2, foil: 2 }, rehearsal: "good" },
];

const browser = await chromium.launch({ headless: true });

async function runOnce(profile) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector("#screen-title.active");

  // 大会当日へ直行（screenshots.mjs と同じ流儀）。準備の成果は profile で与える
  await page.evaluate((p) => {
    localStorage.clear();
    state = newState();
    state.phase = "daily";
    state.day = 14;
    state.ap = 0;
    state.flags._ev_day7 = true;
    state.flags._tutorial_done = true;
    state.flags._rehearsal_tier = p.rehearsal;
    state.practiceBest = p.practiceBest;
    state.stats = { technique: p.stats, sense: p.stats, guts: p.stats, charm: p.stats, insight: p.stats };
    startTournament();
  }, profile);

  const rand = (a, b) => a + Math.random() * (b - a);
  let result = null;
  let craft = null;

  for (let i = 0; i < 4000 && !result; i++) {
    if (await page.locator("#phone-overlay.show").count()) {
      const r = page.locator("#phone-overlay .lime-reply").first();
      if (await r.count()) await r.click().catch(() => {});
      await page.waitForTimeout(150);
      continue;
    }
    const screen = await page.evaluate(() => document.querySelector(".screen.active")?.id || "none");
    if (screen === "screen-dialogue") {
      const c = page.locator("#vn-choices .choice-btn").first();
      if (await c.count()) {
        // 初見: 選択肢は「上から目についたもの」= ランダム
        const btns = page.locator("#vn-choices .choice-btn");
        const n = await btns.count();
        await btns.nth(Math.floor(Math.random() * n)).click().catch(() => {});
      } else {
        await page.click("#vn-click-layer").catch(() => {});
      }
      await page.waitForTimeout(12);
      continue;
    }
    if (screen !== "screen-tournament") { await page.waitForTimeout(40); continue; }

    const title = (await page.locator("#tn-title").textContent()) || "";
    if (title.includes("機材選択")) {
      await page.locator("#tn-body .spot-btn:not([disabled])").first().click().catch(() => {});
    } else if (title.includes("テーマ選択")) {
      await page.locator(".spot-btn", { hasText: "フルーティ" }).click().catch(() => {});
    } else if (title.includes("ミックス")) {
      // チュートリアルどおり: 課題ミント2g＋ダブルアップル10g
      const plusOf = (id) => page.locator(`.mix-row[data-flavor-id="${id}"] button`, { hasText: "＋" });
      for (let k = 0; k < 2; k++) await plusOf("mint").click().catch(() => {});
      for (let k = 0; k < 10; k++) await plusOf("double_apple").click().catch(() => {});
      await page.locator("#tn-body button", { hasText: "この配合でいく" }).click().catch(() => {});
    } else if (title.includes("パッキング")) {
      await page.locator(".spot-btn", { hasText: "ノーマル" }).click().catch(() => {});
    } else if (title.includes("アルミ穴あけ") || title.includes("HOLE RHYTHM")) {
      // 初見: リズムに乗り切れず打点少なめ・間隔にムラ
      for (let ring = 0; ring < 3; ring++) {
        const target = [5, 4, 3][ring];
        for (let k = 0; k < target; k++) {
          await page.locator("#hole-punch").click().catch(() => {});
          await page.waitForTimeout(rand(120, 260));
        }
        const adv = page.locator("#hole-advance:not([disabled])");
        if (await adv.count()) await adv.click().catch(() => {});
        await page.waitForTimeout(80);
      }
      await page.locator("#tn-body button", { hasText: /次へ|結果を見る/ }).click().catch(() => {});
    } else if (title.includes("炭起こし") || title.includes("HEAT IGNITION")) {
      // 初見: 閃きのジャスト待ちができず、赤くなったら取る（反応も遅め）
      for (let k = 0; k < 300; k++) {
        const d = await page.evaluate(() => (window.__heatDebug ? __heatDebug() : null));
        if (!d) { await page.waitForTimeout(60); continue; }
        if (d.every((c) => c.taken)) break;
        const pick = d.find((c) => c.justNow && Math.random() < 0.4) ||
          d.find((c) => !c.taken && (c.zone === "hot" || c.zone === "ash"));
        if (pick) await page.locator(`#heat-coal-${pick.i}`).click().catch(() => {});
        await page.waitForTimeout(rand(80, 200));
      }
      await page.locator("#tn-body button", { hasText: /次へ|結果を見る/ }).click().catch(() => {});
    } else if (title.includes("炭をコンロにセット") || title.includes("炭の配置")) {
      await page.locator(".spot-btn", { hasText: "トライアングル" }).click().catch(() => {});
    } else if (title.includes("蒸らし時間")) {
      await page.locator(".spot-btn", { hasText: "8分" }).click().catch(() => {});
    } else if (title.includes("蒸らし中")) {
      // 弾幕はリアルタイムのため即終了し、被弾は初見想定の 0〜3 を与える
      await page.evaluate(() => { const o = window.__steamDebug && window.__steamDebug(); if (o && o.end) o.end(); });
      for (let k = 0; k < 120; k++) {
        const next = page.locator("#tn-body button", { hasText: "次へ" });
        if (await next.count()) {
          await page.evaluate(() => { if (tt) tt.steamHits = [0, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)]; });
          await next.click();
          break;
        }
        await page.waitForTimeout(25);
      }
    } else if (title.includes("炭替え・調整")) {
      await page.locator(".spot-btn", { hasText: "このままでいく" }).click().catch(() => {});
    } else if (title.includes("吸い出し")) {
      // 初見: ゾーンに入っても反応が遅れる・適温を待ちきれず提供してしまう
      let pulls = 0;
      for (let k = 0; k < 400; k++) {
        const d = await page.evaluate(() => (window.__pullDebug ? __pullDebug() : null));
        if (!d) { await page.waitForTimeout(60); continue; }
        if (d.canServe && (d.tempOk || pulls >= 3 || k > 250)) {
          await page.locator("#tn-pull-serve").click().catch(() => {});
          break;
        }
        if (d.pos >= d.wantZone[0] && d.pos <= d.wantZone[1] && Math.random() < 0.55) {
          await page.waitForTimeout(rand(40, 160)); // 反応遅れ
          await page.locator("#tn-pull-go").click().catch(() => {});
          pulls++;
          await page.waitForTimeout(120);
        } else {
          await page.waitForTimeout(25);
        }
      }
      await page.locator("#tn-body button", { hasText: "次へ" }).click().catch(() => {});
    } else if (title.includes("FLAVOR TRIAL")) {
      // 初見: 実績かどうかを気にせず、目についたアピールをぶつける
      if (await page.locator("#trial-doubt").count()) {
        const appeals = page.locator(".trial-appeal");
        const n = await appeals.count();
        if (n) await appeals.nth(Math.floor(Math.random() * n)).click().catch(() => {});
        await page.waitForTimeout(50);
        await page.locator("#tn-body button", { hasText: /次のザワザワへ|審査を終える/ }).click().catch(() => {});
      } else {
        await page.locator("#tn-body button", { hasText: "結果発表へ" }).click().catch(() => {});
      }
    } else if (title.includes("審査結果")) {
      const rows = await page.locator(".result-row").allTextContents();
      craft = await page.evaluate(() => window.__craftDebug ?? null);
      result = rows;
    } else if (await page.locator("#tn-body .primary-btn:not([disabled])").count()) {
      await page.locator("#tn-body .primary-btn:not([disabled])").first().click().catch(() => {});
    }
    await page.waitForTimeout(40);
  }

  await page.close();
  if (!result) return { ok: false, errors };
  const win = /1位.*はじめ|1位はじめ/.test(result[0] || "");
  return { ok: true, win, craft, rows: result, errors };
}

const summary = [];
for (const profile of PROFILES) {
  let wins = 0;
  const crafts = [];
  for (let t = 0; t < TRIALS; t++) {
    const r = await runOnce(profile);
    if (!r.ok) { log(profile.name, `run${t + 1}: 進行不能`, r.errors.slice(0, 2)); continue; }
    wins += r.win ? 1 : 0;
    crafts.push(r.craft);
    log(profile.name, `run${t + 1}: ${r.win ? "優勝" : "敗北"} craft=${r.craft} | ${r.rows[0]}`);
  }
  summary.push({ profile: profile.name, wins, trials: TRIALS, crafts });
}

log("==== まとめ（南雲バー=craft80 が実質の勝敗線） ====");
for (const s of summary) {
  log(`${s.profile}: 優勝 ${s.wins}/${s.trials} craft=[${s.crafts.join(", ")}]`);
}
await browser.close();
