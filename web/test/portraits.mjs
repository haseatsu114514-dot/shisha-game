// 立ち絵の身長スケール回帰テスト: スミさんとみんとが同じ身長に見えたらFAIL（2026-07-02の報告）。
// characters.json の spriteScale → build_data.py(portrait_scales) → engine.applyPortraitTrim の
// 経路が一箇所でも切れると等身大に戻るので、実際に描画した高さの比で検証する。
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  try { return require("playwright"); }
  catch { return require("/opt/node22/lib/node_modules/playwright"); }
})();

const BASE = process.env.BASE_URL || "http://127.0.0.1:8123/web/";
let failed = 0;
const ok = (cond, label, detail = "") => {
  console.log(`${cond ? "OK " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  if (!cond) failed++;
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(BASE, { waitUntil: "load" });
await page.waitForSelector("#screen-title.active");

// ---- 1) データ経路: portrait_scales が bundle に載っているか（正本は characters.json の spriteScale）
const scales = await page.evaluate(() => (window.GAME_DATA || {}).portrait_scales || {});
ok(Object.keys(scales).length >= 10, "portrait_scales が bundle に存在", `${Object.keys(scales).length}件`);
// 主要キャラの身長順（sumi 179cm > naru > rin > minto > tsumugi 155cm 相当）
const order = ["sumi", "naru", "rin", "minto", "tsumugi"];
for (let i = 0; i + 1 < order.length; i++) {
  const [a, b] = [order[i], order[i + 1]];
  ok((scales[a] || 1) > (scales[b] || 1), `scale ${a} > ${b}`, `${scales[a]} > ${scales[b]}`);
}

// ---- 2) 描画経路: 実際に2人並べて、画面上の実体高さの比が scale 比どおりか
await page.evaluate(() => {
  state = newState();
  state.flags._tutorial_done = true;
  playCustom({
    dialogue_id: "__portrait_test",
    metadata: { bg: "res://assets/backgrounds/bg_tonari_inside.png" },
    lines: [
      { speaker: "sumi", face: "normal", text: "……" },
      { speaker: "minto", face: "normal", text: "……" },
      { speaker: "minto", face: "normal", text: "……。" },
    ],
  });
});
await page.waitForSelector("#screen-dialogue.active");
// 2人目が出るまで会話を送る
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(350);
  if ((await page.locator("#vn-portraits img").count()) >= 2) break;
  await page.locator("#vn-click-layer").click();
}
await page.waitForTimeout(400);

const m = await page.evaluate(() => {
  const trims = (window.GAME_DATA || {}).portrait_trims || {};
  const out = {};
  for (const img of document.querySelectorAll("#vn-portraits img")) {
    const who = img.dataset.speaker;
    const t = ((trims[who] || {}).normal) || null;
    const rect = img.getBoundingClientRect();
    if (t && t.h) out[who] = rect.height * t.h; // 透過余白を除いた「実体」の描画高さ(px)
  }
  return out;
});
ok(m.sumi > 0 && m.minto > 0, "sumi/minto の立ち絵が描画された", JSON.stringify(m));
if (m.sumi && m.minto) {
  const ratio = m.sumi / m.minto;
  const expected = (scales.sumi || 1) / (scales.minto || 1); // ≈1.15
  ok(Math.abs(ratio - expected) < 0.05, "実体高さの比が身長スケールどおり",
    `rendered=${ratio.toFixed(3)} expected=${expected.toFixed(3)}`);
  ok(ratio > 1.08, "スミさんがみんとより明確に大きい", `ratio=${ratio.toFixed(3)}`);
}

await page.screenshot({ path: "web/test/shots/portrait_scale.png" });
await browser.close();
if (failed) { console.error(`portraits: ${failed} 件 FAIL`); process.exit(1); }
console.log("portraits: all green");
