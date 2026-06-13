// シーシャくじ（master_spec #25 / A2）の収支・リセマラ防止を検証
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require("playwright"); } catch { return require("/opt/node22/lib/node_modules/playwright"); } })();
const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
const log = (...a) => console.log("[kuji]", ...a);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => { console.error("PAGEERROR", e.message); process.exit(1); });
await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");

// (1) 1ボックス(g500)を引き切った時の収支検証：現金還元率100〜115%、利益はバイト1回(8000)未満
const res = await page.evaluate(() => {
  state = newState();
  state.phase = "daily";
  state.money = 999999;
  const g = D.kuji.grades.g500;
  const box = (state.kuji.g500 = (function () {
    // buildKujiBox 相当（公開関数を使う）
    return buildKujiBox("g500");
  })());
  const before = state.money;
  // 箱を引き切る
  for (let i = 0; i < g.boxSize; i++) {
    const idx = state.kuji.g500.order[state.kuji.g500.drawn];
    const prize = g.prizes[idx];
    state.money -= g.price;
    state.kuji.g500.drawn++;
    grantKujiPrize(prize);
    if (state.kuji.g500.drawn >= g.boxSize && g.lastOne) grantKujiPrize(g.lastOne);
  }
  // 売却可をすべて売る（機材＋goods）
  let recoverable = 0;
  const STARTERS = ["silicone_bowl", "lotos_hagal", "flat_charcoal"];
  for (const id of state.owned) {
    if (STARTERS.includes(id)) continue; // 初期装備は売却対象外（実装と同じ）
    const e = D.equipment.find((x) => x.id === id);
    if (e && e.price) recoverable += Math.round(e.price * 0.5);
  }
  for (const gd of state.goods) recoverable += gd.sell || 0;
  const invest = g.price * g.boxSize;
  return { invest, recoverable, ret: recoverable / invest, profit: recoverable - invest };
});
log(`g500: 投資${res.invest} 売却可${res.recoverable} 還元率${(res.ret*100).toFixed(0)}% 利益${res.profit}`);
if (res.ret < 0.95 || res.ret > 1.20) throw new Error("還元率が想定レンジ外: " + res.ret);
if (res.profit >= 8000) throw new Error("1箱の利益がバイト1回以上ある（経済が壊れる）: " + res.profit);
log("収支バランス OK");

// (2) リセマラ防止: 引く前の box.order を保存→セーブ→ロードしても次の賞は同じ
const reproducible = await page.evaluate(() => {
  state = newState(); state.phase = "daily"; state.money = 999999;
  state.kuji.g500 = buildKujiBox("g500");
  const nextIdx = state.kuji.g500.order[state.kuji.g500.drawn];
  save();
  const saved = JSON.parse(localStorage.getItem("shisha_ch1_save_v1"));
  // ロードし直し
  state = saved;
  const afterIdx = state.kuji.g500.order[state.kuji.g500.drawn];
  return nextIdx === afterIdx;
});
if (!reproducible) throw new Error("セーブ&ロードで次のくじが変わってしまう（リセマラ可能）");
log("リセマラ防止 OK");

// (3) UI: ショップでくじを1回引いて結果が出る
await page.evaluate(() => {
  state = newState(); state.phase = "daily"; state.money = 50000;
  state.flags._tutorial_done = true;
  showShop();
});
await page.waitForSelector("#screen-shop.active");
const kujiBtn = page.locator(".kuji-btn").first();
if (!(await kujiBtn.count())) throw new Error("くじボタンが無い");
await kujiBtn.click();
await page.waitForSelector("#kuji-overlay.show");
await page.waitForTimeout(900);
const revealed = await page.locator("#kuji-card.reveal").count();
if (!revealed) throw new Error("くじの開封演出が出ない");
log("くじ抽選UI OK");

console.log("[kuji] KUJI PASSED ✅");
await browser.close();
