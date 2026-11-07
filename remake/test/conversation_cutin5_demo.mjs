// 会話カットイン追加5案の見比べデモ（#2924）。5案すべてが ?cut= とボタンで切り替わり、案の行で既存の立ち絵の切り抜きが左側に出て、
// 消え方（その行だけ／0.3秒で薄れる／0.9秒で消える）と出せる条件（相手の立ち絵の枚数・1会話1回）が #2845 の決定どおりで、
// 実際の台詞が引けて、本編の保存に触れないことを確かめる。
// サーバーを8123で起動後: node remake/test/conversation_cutin5_demo.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { CUTINS, FRAMES, FOCUS, SPRITE_DIR, sampleLines, partnersAtCue } from "../js/vn/conversation-cutin5-demo-data.js";

// --- データ（ブラウザ不要）
const dialogues = {};
for (const file of new Set(CUTINS.map((c) => c.sample.file))) {
  const j = JSON.parse(readFileSync(new URL(`../../data/dialogue/${file}.json`, import.meta.url), "utf8"));
  for (const d of j.dialogues || []) dialogues[d.dialogue_id] ??= d;
}
assert.deepEqual([...new Set(CUTINS.map((c) => c.plan))].sort(), [1, 2, 3, 4, 5], "5案すべてに場面がある");
assert.deepEqual([...new Set(CUTINS.map((c) => c.plan))], [2, 1, 5, 4, 3], "ボタンは試す順 2→1→5→4→3");
assert.equal(new Set(CUTINS.map((c) => c.id)).size, CUTINS.length, "場面の番号が重ならない");
for (const c of CUTINS) {
  assert.ok(c.name && c.scene && c.faceNote, `${c.id}: 説明が揃っている`);
  assert.ok(FRAMES[c.frame], `${c.id}: 枠`);
  assert.ok(FRAMES[c.frame].x + FRAMES[c.frame].w <= 640, `${c.id}: 左半分に収まる`);
  assert.ok(FRAMES[c.frame].y + FRAMES[c.frame].h <= 526, `${c.id}: 文字欄にかからない`);
  assert.ok(FOCUS[c.pose.focus || "face"][c.face], `${c.id}: 表情 ${c.face} の顔位置`);
  // 既存の立ち絵だけを使う（新素材を足していない）
  assert.ok(existsSync(new URL(`../${SPRITE_DIR}/chr_hajime_${c.face}.webp`, import.meta.url)), `${c.id}: 既存の立ち絵 ${c.face}`);
  if (c.ms) assert.ok(c.ms <= 1000, `${c.id}: 1秒以内に消える`);
  const lines = sampleLines(c, dialogues);
  assert.equal(lines.filter((l) => l.cue).length, 1, `${c.id}: 実際の台詞 ${c.sample.anchor}`);
  const cue = lines.find((l) => l.cue);
  if (c.on === "partner") assert.ok(cue.speaker && cue.speaker !== "hajime", `${c.id}: 相手の行`);
  else assert.equal(cue.speaker, "hajime", `${c.id}: はじめの行`);
  assert.ok(c.partners.includes(partnersAtCue(lines)), `${c.id}: 案の行の相手の立ち絵の枚数が出せる条件に合う`);
  // 相手の行に出すのは相手の立ち絵1枚の時だけ。0枚（独白）を許すのは案3・4だけ（#2845 オーナー決定）
  if (c.on === "partner") assert.deepEqual(c.partners, [1], `${c.id}: 相手の行は1枚の時だけ`);
  if (c.partners.includes(0)) assert.ok([3, 4].includes(c.plan), `${c.id}: 独白は案3・4だけ`);
  for (const l of lines) assert.ok(!/[{}]/.test(l.text), `${c.id}: 差し込み文字なし`);
}
// 2c（軽い答え合わせ）は直前のはじめの行の表情を映す
{
  const c = CUTINS.find((x) => x.id === "2c");
  const lines = sampleLines(c, dialogues), i = lines.findIndex((l) => l.cue);
  assert.equal(lines.slice(0, i).reverse().find((l) => l.speaker === "hajime")?.face, c.face, "2c: 直前のはじめの表情");
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
  // 行を打ち終えた（▼）か、場面の最後まで進んだ（おしまい）
  const finish = () => page.waitForFunction(() => document.querySelector(".vn-next.show, #ct-end.show"), null, { timeout: 15000 });
  const toCue = async (c) => {
    for (const l of sampleLines(c, dialogues)) { await finish(); if (l.cue) return; await page.click("#stage"); }
  };

  await page.goto(`${base}/remake/conversation-cutin5-demo.html?cut=4m`);
  await page.waitForSelector("#ct-chips button");
  assert.equal(await page.locator("#ct-chips button").count(), CUTINS.length, "全場面のボタン");
  assert.equal(await page.getAttribute("#ct-label", "data-cut"), "4m");

  for (const c of CUTINS) {
    await page.click(`#ct-chips button[data-cut="${c.id}"]`);
    await page.waitForFunction((id) => document.querySelector("#ct-label").dataset.cut === id, c.id);
    assert.equal(new URL(page.url()).searchParams.get("cut"), c.id, `${c.id}: URL に反映`);
    await toCue(c);
    const node = await page.evaluate(() => {
      const n = document.querySelector(".ct-cutin"); if (!n) return null;
      const r = n.getBoundingClientRect(), s = document.querySelector("#stage").getBoundingClientRect();
      return { plan: n.dataset.plan, face: n.dataset.face, src: n.querySelector(".ct-art").getAttribute("src"),
        center: (r.left + r.width / 2 - s.left) / s.width, portraits: document.querySelectorAll(".vn-portraits img").length };
    });
    if (!c.ms || node) {
      assert.ok(node, `${c.id}: 案の行で出る`);
      assert.equal(node.plan, String(c.plan));
      assert.match(node.src, new RegExp(`chr_hajime_${c.face}\\.webp$`), `${c.id}: 既存の立ち絵 ${c.face}`);
      assert.ok(node.center < 0.5, `${c.id}: 左側に出る`);
      assert.ok(c.partners.includes(node.portraits), `${c.id}: 相手の立ち絵の枚数`);
    }
    await page.waitForFunction(() => { const i = document.querySelector(".ct-cutin .ct-art"); return !i || (i.complete && i.naturalWidth > 0); });
    if (c.ms) {
      await page.waitForFunction(() => !document.querySelector(".ct-cutin"), null, { timeout: 3000 });
    } else {
      await page.waitForTimeout(1200);
      assert.equal(await page.locator(".ct-cutin").count(), 1, `${c.id}: 次の行に進むまで残る`);
      // 薄れる途中（0.3秒）は負荷で取り逃がしやすいので、ページ内で .leave が付いたかを記録して判定する
      await page.evaluate(() => {
        window.__leave = false;
        const n = document.querySelector(".ct-cutin");
        new MutationObserver(() => { if (n.classList.contains("leave")) window.__leave = true; }).observe(n, { attributes: true });
      });
      await finish(); await page.click("#stage");
      await finish(); if (await page.locator(".ct-cutin:not(.leave)").count()) await page.click("#stage");
      assert.equal(await page.evaluate(() => window.__leave), c.stay === "fade", `${c.id}: 薄れて消えるのは案4だけ`);
      await page.waitForFunction(() => !document.querySelector(".ct-cutin:not(.leave)"));
      await page.waitForFunction(() => !document.querySelector(".ct-cutin"), null, { timeout: 3000 });
    }
  }

  // 2c を消さずに止める / カットインなし
  await page.goto(`${base}/remake/conversation-cutin5-demo.html?cut=2c&hold=1`);
  await page.waitForSelector("#ct-chips button");
  await toCue(CUTINS.find((c) => c.id === "2c"));
  await page.waitForTimeout(1300);
  assert.equal(await page.locator(".ct-cutin").count(), 1, "hold=1 で 2c が残る");
  await page.goto(`${base}/remake/conversation-cutin5-demo.html?cut=2a&off=1`);
  await page.waitForSelector("#ct-chips button");
  await toCue(CUTINS[0]);
  assert.equal(await page.locator(".ct-cutin").count(), 0, "off=1 では出さない");
  assert.equal(await page.locator("#ct-label.off").count(), 1, "ラベルに（カットインなし）");

  assert.equal(await page.evaluate(() => window.__writes), 0, "localStorage へ書かない");
  assert.deepEqual(errors, [], "ページエラー無し");
  console.log(`OK conversation_cutin5_demo (${CUTINS.length} scenes / 5 plans)`);
} finally {
  await browser.close();
}
