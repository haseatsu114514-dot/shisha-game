// 会話カットイン案デモ（#2903）。全案が ?cut= とボタンで切り替わり、案の行でカットインが左側に出て、
// A系は次の行まで残り・C系は短く消え、実際の台詞が引けて、本編の保存に触れないことを確かめる。
// サーバーを8123で起動後: node remake/test/conversation_cutin_demo.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { CUTINS, FRAMES, sampleLines } from "../js/vn/conversation-cutin-demo-data.js";

// --- データ（ブラウザ不要）
// デモと同じく、案ごとの会話ファイルだけを読む（会話の置き場が変わったら落ちる）
const dialogues = {};
for (const file of new Set(CUTINS.map((c) => c.sample.file))) {
  const j = JSON.parse(readFileSync(new URL(`../../data/dialogue/${file}.json`, import.meta.url), "utf8"));
  for (const d of j.dialogues || []) dialogues[d.dialogue_id] ??= d;
}
assert.ok(CUTINS.length >= 10, "10案前後");
assert.equal(new Set(CUTINS.map((c) => c.id)).size, CUTINS.length, "案の番号が重ならない");
for (const c of CUTINS) {
  assert.match(c.id, /^[AC]\d$/);
  assert.equal(c.kind, c.id[0], `${c.id}: A系/C系`);
  assert.ok(c.name && c.scene && c.change && c.origin, `${c.id}: 説明が揃っている`);
  assert.ok(FRAMES[c.frame], `${c.id}: 枠`);
  assert.ok(FRAMES[c.frame].x + FRAMES[c.frame].w <= 640, `${c.id}: 左半分に収まる`);
  assert.ok(FRAMES[c.frame].y + FRAMES[c.frame].h <= 526, `${c.id}: 文字欄にかからない`);
  assert.ok(Math.abs(c.pose.rot) <= 5, `${c.id}: 角度の変化は小さく（±5°以内）`);
  if (c.kind === "C") assert.ok(c.ms > 0 && c.ms <= 1000, `${c.id}: 1秒以内に消える`);
  const lines = sampleLines(c, dialogues);
  assert.equal(lines.filter((l) => l.cue).length, 1, `${c.id}: 実際の台詞 ${c.sample.anchor}`);
  const cue = lines.find((l) => l.cue);
  if (c.on === "partner") assert.ok(cue.speaker && cue.speaker !== "hajime", `${c.id}: 相手の行`);
  else assert.equal(cue.speaker, "hajime", `${c.id}: はじめの行`);
  for (const l of lines) assert.ok(!/[{}]/.test(l.text), `${c.id}: 差し込み文字なし`);
}

// --- ブラウザ
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const base = process.env.BASE_URL || "http://127.0.0.1:8123";
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => { window.__writes = 0; const set = Storage.prototype.setItem; Storage.prototype.setItem = function (...a) { window.__writes++; return set.apply(this, a); }; });
  const finish = () => page.waitForFunction(() => document.querySelector(".vn-next.show"), null, { timeout: 15000 });
  const toCue = async (c) => {
    const lines = sampleLines(c, dialogues);
    for (const l of lines) { await finish(); if (l.cue) return; await page.click("#stage"); }
  };

  // URL パラメータで直接開ける
  await page.goto(`${base}/remake/conversation-cutin-demo.html?cut=C3`);
  await page.waitForSelector("#ct-chips button");
  assert.equal(await page.locator("#ct-chips button").count(), CUTINS.length, "全案のボタン");
  assert.equal(await page.textContent("#ct-label i"), "C3");

  for (const c of CUTINS) {
    await page.click(`#ct-chips button[data-cut="${c.id}"]`);
    await page.waitForFunction((id) => document.querySelector("#ct-label i").textContent === id, c.id);
    assert.equal(new URL(page.url()).searchParams.get("cut"), c.id, `${c.id}: URL に反映`);
    await toCue(c);
    const node = await page.evaluate(() => {
      const n = document.querySelector(".ct-cutin"); if (!n) return null;
      const r = n.getBoundingClientRect(), s = document.querySelector("#stage").getBoundingClientRect(), img = n.querySelector(".ct-art");
      return { kind: n.dataset.kind, center: (r.left + r.width / 2 - s.left) / s.width, decoded: img.complete && img.naturalWidth > 0 };
    });
    if (c.kind === "A" || node) {
      assert.ok(node, `${c.id}: 案の行で出る`);
      assert.equal(node.kind, c.kind);
      assert.ok(node.center < 0.5, `${c.id}: 左側に出る`);
    }
    await page.waitForFunction(() => document.querySelector(".ct-cutin .ct-art")?.complete ?? true);
    if (c.kind === "C") {
      await page.waitForFunction(() => !document.querySelector(".ct-cutin"), null, { timeout: 3000 });
    } else {
      await page.waitForTimeout(1200);
      assert.equal(await page.locator(".ct-cutin").count(), 1, `${c.id}: A系は次の行まで残る`);
      await page.click("#stage"); // 文字送り中なら一括表示、次の行へ
      await finish(); if (await page.locator(".ct-cutin:not(.leave)").count()) await page.click("#stage");
      await page.waitForFunction(() => !document.querySelector(".ct-cutin:not(.leave)"));
    }
  }

  // C系を消さずに止める / カットインなし
  await page.goto(`${base}/remake/conversation-cutin-demo.html?cut=C1&hold=1`);
  await page.waitForSelector("#ct-chips button");
  await toCue(CUTINS.find((c) => c.id === "C1"));
  await page.waitForTimeout(1300);
  assert.equal(await page.locator(".ct-cutin").count(), 1, "hold=1 で C が残る");
  await page.goto(`${base}/remake/conversation-cutin-demo.html?cut=A1&off=1`);
  await page.waitForSelector("#ct-chips button");
  await toCue(CUTINS[0]);
  assert.equal(await page.locator(".ct-cutin").count(), 0, "off=1 では出さない");
  assert.equal(await page.locator("#ct-label.off").count(), 1, "ラベルに（カットインなし）");

  assert.equal(await page.evaluate(() => window.__writes), 0, "localStorage へ書かない");
  assert.deepEqual(errors, [], "ページエラー無し");
  console.log(`OK conversation_cutin_demo (${CUTINS.length} cuts)`);
} finally {
  await browser.close();
}
