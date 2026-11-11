// 会話演出デモ（#2732・案は #2666）。12件が番号・名前つきで1件ずつ再生でき、演出ON/OFFで挙動が変わり、
// #3417 の章ごとの新顔6件（別の段）も同じく ON/OFF で挙動が変わり、
// 本編の保存に触れず、サンプル本文が autoWrap の幅（全角24字×2行）に収まることを確かめる。
// サーバーを8123で起動後: node remake/test/conversation_effects_demo.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { EFFECTS, EFFECT_ORDER, NEW_FACE_ORDER, plainText } from "../js/vn/conversation-effects-data.js";
import { textWidth, MAX_PAGE_LINES } from "../js/vn/text.js";

// --- データ（ブラウザ不要）
assert.deepEqual([...EFFECT_ORDER].sort((a, b) => a - b), [1, 2, 3, 7, 8, 11, 12, 13, 15, 22, 23, 29]);
assert.deepEqual(EFFECT_ORDER.slice(0, 5), [1, 2, 13, 22, 29], "先頭は推奨5件");
// #3417 の新顔は選別済みの12件と重ならない別の段。どの章で初めて出すかを書いておく
assert.deepEqual(NEW_FACE_ORDER, [10, 9, 5, 37, 38, 32]);
assert.equal(EFFECTS.length, EFFECT_ORDER.length + NEW_FACE_ORDER.length);
for (const no of NEW_FACE_ORDER) {
  const e = EFFECTS.find((x) => x.no === no);
  assert.ok(e && e.tag === "新顔" && e.chapter, `${no}: 新顔の印と章`);
  assert.ok(!EFFECT_ORDER.includes(no), `${no}: 選別済みの段に入れない`);
}
assert.equal(plainText("ああ[pause=700]い[whisper]う[/whisper][blur]え[/blur]"), "ああいうえ", "新しい印も表示には出ない");
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
  assert.equal(await page.locator("#fx-chips-new button").count(), 6, "新顔6件のボタン（別の段）");
  const typed = () => page.evaluate(() => document.querySelector(".vn-text").textContent);
  const finish = () => page.waitForFunction(() => document.querySelector(".vn-next.show"), null, { timeout: 15000 }); // 行を出し終えるまで待つ
  const pick = async (no, on = true) => {
    await page.setChecked("#fx-on", on);
    await page.click(`.preview-tools button[data-fx="${no}"]`);
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

  // ---------------------------------------------------------------- 新顔（#3417）
  const step = async (n) => { for (let i = 0; i < n; i++) { await finish(); await page.click("#stage"); } };
  // 10 ささやき: 2行目に小さく沈む区間。OFF では出ない
  for (const on of [true, false]) {
    await pick(10, on);
    await step(1); await finish();
    assert.equal(await page.locator(".vn-text .demo-whisper").count() > 0, on, `10: ${on ? "ON" : "OFF"}`);
  }
  // 9 にじみ: 3行目にぼかしの区間。OFF と動きを減らすでは出ない
  for (const [on, reduce] of [[true, false], [false, false], [true, true]]) {
    await page.setChecked("#fx-reduce", reduce);
    await pick(9, on);
    await step(2); await finish();
    assert.equal(await page.locator(".vn-text .demo-nijimi").count() > 0, on && !reduce, `9: on=${on} reduce=${reduce}`);
  }
  await page.setChecked("#fx-reduce", false);
  // 5 無言の一コマ: 3行目で台詞欄が薄れ、本文は空。OFF は「……」の台詞
  for (const on of [true, false]) {
    await pick(5, on);
    await step(2); await finish();
    assert.equal(await page.locator(".vn-box.demo-silent").count(), on ? 1 : 0, `5: ${on ? "ON" : "OFF"}`);
    assert.equal(await typed(), on ? "" : "……");
    await page.click("#stage"); await finish();
    assert.equal(await page.locator(".vn-box.demo-silent").count(), 0, "5: 次の行で戻る");
  }
  // 37 息を止める: 2行目で ON はほぼ無音、OFF は採用済みの −6dB
  for (const on of [true, false]) {
    await pick(37, on);
    await step(1); await finish();
    assert.match(await page.textContent("#demo-bgm-db"), on ? /無音/ : /−6 dB/, `37: ${on ? "ON" : "OFF"}`);
  }
  // 38 文中ポーズの長さ指定: 3行目（0.8秒）は ON の方が OFF（0.4秒）より長い
  const hold = {};
  for (const on of [true, false]) {
    await pick(38, on);
    await step(2);
    const t0 = Date.now();
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent.length > 0);
    await finish();
    hold[on] = Date.now() - t0;
  }
  assert.ok(hold[true] > hold[false] + 250, `38: ONは約0.4秒長い (${hold[true]} vs ${hold[false]})`);
  // 32 扉の合図: ON は入場でベル・退場で風の音。OFF は鳴らさない。どちらも退場で立ち絵が外れる
  for (const on of [true, false]) {
    await pick(32, on);
    await finish();
    assert.deepEqual(await page.evaluate(() => window.__demoFx), on ? ["doorbell"] : [], `32 入場: ${on ? "ON" : "OFF"}`);
    await step(3); await finish();
    assert.deepEqual(await page.evaluate(() => window.__demoFx), on ? ["doorbell", "whoosh"] : [], `32 退場: ${on ? "ON" : "OFF"}`);
    assert.equal(await page.locator('.vn-portraits img[data-speaker="naru"]').count(), 0, "32: 退場で立ち絵が外れる");
  }

  // 全18件（選別済み12＋新顔6）が最後まで進められ、「おしまい」が出る。SKIPでも進む。保存・本編のキーへ書かない
  await page.setChecked("#fx-on", true);
  await page.setChecked("#fx-skip", true);
  for (const no of [...EFFECT_ORDER, ...NEW_FACE_ORDER]) {
    await page.click(`.preview-tools button[data-fx="${no}"]`);
    await page.waitForSelector("#demo-end.show", { timeout: 20000 });
  }
  assert.equal(await page.evaluate(() => window.__writes), 0, "localStorage へ書かない");
  assert.deepEqual(errors, [], "ページエラー無し");
  console.log("OK conversation_effects_demo");
} finally {
  await browser.close();
}
