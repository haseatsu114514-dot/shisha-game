// 会話演出デモ（#2732・案は #2666）。12件が番号・名前つきで1件ずつ再生でき、演出ON/OFFで挙動が変わり、
// 本編の保存に触れず、サンプル本文が autoWrap の幅（全角24字×2行）に収まることを確かめる。
// サーバーを8123で起動後: node remake/test/conversation_effects_demo.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { EFFECTS, EFFECT_ORDER, plainText } from "../js/vn/conversation-effects-data.js";
import { textWidth, MAX_PAGE_LINES } from "../js/vn/text.js";

// --- データ（ブラウザ不要）
assert.deepEqual([...EFFECT_ORDER].sort((a, b) => a - b), [1, 2, 3, 7, 8, 11, 12, 13, 15, 22, 23, 29]);
assert.deepEqual(EFFECT_ORDER.slice(0, 5), [1, 2, 13, 22, 29], "先頭は推奨5件");
for (const e of EFFECTS) {
  assert.ok(e.name && e.summary && e.watch && e.spec, `${e.no}: 説明が揃っている`);
  assert.ok(e.lines.length >= 3, `${e.no}: サンプルは3行以上`);
  for (const l of e.lines) {
    const rows = plainText(l.text).split("\n");
    assert.ok(rows.length <= MAX_PAGE_LINES, `${e.no}: 2行以内 ${l.text}`);
    for (const r of rows) assert.ok(textWidth(r) <= 24, `${e.no}: 全角24字以内 ${r}`);
  }
}

// --- ブラウザ
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const base = process.env.BASE_URL || "http://127.0.0.1:8123";
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 804 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => { window.__writes = 0; const set = Storage.prototype.setItem; Storage.prototype.setItem = function (...a) { window.__writes++; return set.apply(this, a); }; });
  await page.goto(`${base}/remake/conversation-effects-demo.html`);
  await page.waitForSelector("#fx-chips button");
  assert.equal(await page.locator("#fx-chips button").count(), 12, "12件のボタン");
  const typed = () => page.evaluate(() => document.querySelector(".vn-text").textContent);
  const finish = () => page.waitForFunction(() => document.querySelector(".vn-next.show"), null, { timeout: 15000 }); // 行を出し終えるまで待つ
  const pick = async (no, on = true) => {
    await page.setChecked("#fx-on", on);
    await page.click(`#fx-chips button[data-fx="${no}"]`);
    await page.waitForFunction((n) => document.querySelector("#fx-label i").textContent === String(n), no);
  };

  // ラベル（番号と名前）
  await pick(1);
  assert.match(await page.textContent("#fx-label"), /^1溜めの一拍/);

  // 1 溜めの一拍: 3行目（beat 800ms）。ONは空のまま待ち、OFFは待たない
  for (const on of [true, false]) {
    await pick(1, on);
    await finish(); await page.click("#stage"); await finish(); await page.click("#stage");
    await page.waitForTimeout(250);
    const early = await typed();
    if (on) assert.equal(early, "", "1: ONは溜めの間、本文が空");
    else assert.ok(early.length > 0, "1: OFFは待たずに出る");
  }

  // 3 文中ポーズ: ONの方が時間がかかる。▼は止まっている間に出ない
  const timing = {};
  for (const on of [true, false]) {
    await pick(3, on);
    await finish(); await page.click("#stage");
    const t0 = Date.now();
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent.length > 0);
    await page.waitForFunction(() => document.querySelector(".vn-next.show"));
    timing[on] = Date.now() - t0;
  }
  assert.ok(timing[true] > timing[false] + 250, `3: ONは約0.4秒長い (${timing[true]} vs ${timing[false]})`);

  // 22 周辺減光 / 23 ピント送り: 該当行で層が付き、OFFでは付かない
  for (const [no, sel, cls, line] of [[22, "#demo-vignette", "on", 2], [23, "#bg", "demo-blur", 1]]) {
    for (const on of [true, false]) {
      await pick(no, on);
      for (let i = 0; i < line; i++) { await finish(); await page.click("#stage"); }
      await page.waitForFunction(() => document.querySelector(".vn-name.show"));
      const has = await page.evaluate(([s, c]) => document.querySelector(s).classList.contains(c), [sel, cls]);
      assert.equal(has, on, `${no}: ${on ? "ON" : "OFF"}`);
    }
  }

  // 8 震え文字: ONで span.shiver、動きを減らすで止まる（span は出ない）
  await pick(8, true);
  await finish();
  assert.ok(await page.locator(".vn-text .shiver").count() > 0, "8: 震え区間");
  await page.setChecked("#fx-reduce", true);
  await page.waitForFunction(() => document.querySelector("#fx-label i").textContent === "8");
  await finish();
  assert.equal(await page.locator(".vn-text .shiver").count(), 0, "8: reduceShake では震えない");
  await page.setChecked("#fx-reduce", false);

  // 7 心の声: （）の行だけ薄墨クラス
  await pick(7, true);
  await finish();
  assert.equal(await page.locator(".vn-text.demo-inner").count(), 1, "7: （）の行");
  await page.click("#stage"); await finish(); // 2行目: 通常の台詞
  assert.equal(await page.locator(".vn-text.demo-inner").count(), 0, "7: 通常の行には付かない");

  // 12 名札の色変わり: ONで名札にテーマ色、OFFで無し
  for (const on of [true, false]) {
    await pick(12, on);
    await page.waitForFunction(() => document.querySelector(".vn-name.show"));
    assert.equal(await page.locator(".vn-name.demo-theme").count(), on ? 1 : 0, `12: ${on ? "ON" : "OFF"}`);
  }

  // 全12件が最後まで進められ、「おしまい」が出る。SKIPでも進む。保存・本編のキーへ書かない
  await page.setChecked("#fx-on", true);
  await page.setChecked("#fx-skip", true);
  for (const no of EFFECT_ORDER) {
    await page.click(`#fx-chips button[data-fx="${no}"]`);
    await page.waitForSelector("#demo-end.show", { timeout: 20000 });
  }
  assert.equal(await page.evaluate(() => window.__writes), 0, "localStorage へ書かない");
  assert.deepEqual(errors, [], "ページエラー無し");
  console.log("OK conversation_effects_demo");
} finally {
  await browser.close();
}
