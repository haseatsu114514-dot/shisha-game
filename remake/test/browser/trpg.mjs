import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = new URL("trpg-preview.html", process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
const artifacts = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/trpg");
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];

async function hit(page, selector) {
  const locator = page.locator(selector);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await locator.tap();
  else await locator.click();
}
async function nextLines(page, keyboard = false) {
  for (let n = 0; n < 60; n++) {
    const next = page.locator('[data-test="trpg-next"]');
    if (!await next.isVisible()) return;
    if (keyboard) await page.keyboard.press("Enter"); else await hit(page, '[data-test="trpg-next"]');
  }
  throw new Error("Dialogue did not terminate");
}
// The declaration stage: a real table says who acts before any die is touched.
async function declare(page) {
  const card = page.locator('[data-test^="trpg-approach-"]').first();
  if (!await card.count() || !await card.isVisible()) return;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await card.tap(); else await card.click();
  await nextLines(page);
}

// New scenes: two questions for the story's character after the first roll, a twist after the guess.
async function interviewStep(page) {
  const snap = () => page.evaluate(() => window.__trpg?.snapshot?.() ?? null);
  if ((await snap())?.phase !== "interview" && !(await page.locator('[data-test="trpg-interview-done"], [data-test^="trpg-topic-"]').count())) return;
  for (let n = 0; n < 2; n++) {
    const topic = page.locator('[data-test^="trpg-topic-"]:not([disabled]):not(.selected)').first();
    if (!await topic.count()) break;
    if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await topic.tap(); else await topic.click();
    for (let i = 0; i < 40 && await page.locator('[data-test="trpg-next"]').isVisible(); i++) await page.locator('[data-test="trpg-next"]').click();
  }
  const done = page.locator('[data-test="trpg-interview-done"]');
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await done.tap(); else await done.click();
}
async function twistStep(page) {
  const option = page.locator('[data-test^="trpg-plan-tactic-"]').first();
  if (!await option.count()) return;
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (touch) await option.tap(); else await option.click();
  const open = page.locator('[data-test="trpg-twist-open"]');
  if (touch) await open.tap(); else await open.click();
  const card = page.locator('[data-test^="trpg-approach-"]').first();
  if (touch) await card.tap(); else await card.click();
  for (let i = 0; i < 40 && await page.locator('[data-test="trpg-next"]').isVisible(); i++) await page.locator('[data-test="trpg-next"]').click();
  const roll = page.locator('[data-test="trpg-roll"]');
  if (touch) await roll.tap(); else await roll.click();
  await page.locator('[data-test="trpg-settle"]').waitFor();
  const settle = page.locator('[data-test="trpg-settle"]');
  if (touch) await settle.tap(); else await settle.click();
  for (let i = 0; i < 60 && await page.locator('[data-test="trpg-next"]').isVisible(); i++) await page.locator('[data-test="trpg-next"]').click();
}
async function checkRoll(page, { support = null, reroll = false } = {}) {
  await declare(page);
  if (support) await hit(page, '[data-test="trpg-support-' + support + '"]');
  await hit(page, '[data-test="trpg-roll"]');
  await page.locator('[data-test="trpg-settle"]').waitFor();
  if (reroll) await hit(page, '[data-test="trpg-reroll-0"]');
  await hit(page, '[data-test="trpg-settle"]');
  await nextLines(page);
}
async function begin(page, keyboard = false) {
  const start = page.locator('[data-test="trpg-start"]');
  if (keyboard) await start.press("Enter"); else await hit(page, '[data-test="trpg-start"]');
  if (keyboard) {
    const line = await page.locator(".trpg-speech p").textContent();
    await page.locator('[data-test="trpg-log"]').press("Enter");
    await page.locator('[data-test="trpg-log-close"]').waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".trpg-speech p").textContent(), line);
    await page.locator('[data-test="trpg-next"]').focus();
  }
  await nextLines(page, keyboard);
  await checkRoll(page);
  assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "interview");
  await interviewStep(page);
  assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "explore");
  await fits(page);
}
async function explore(page, { spots = ["menu", "window", "bag"], hypothesis = "quiet" } = {}) {
  for (const id of spots) {
    await hit(page, '[data-test="trpg-spot-' + id + '"]');
    await nextLines(page);
  }
  await hit(page, '[data-test="trpg-consult-tsumugi"]');
  await nextLines(page);
  await hit(page, '[data-test="trpg-interpret"]');
  await hit(page, '[data-test="trpg-hypothesis-' + hypothesis + '"]');
  await nextLines(page);
  await twistStep(page);
}
async function finish(page, choices) {
  const fields = Object.keys(choices);
  for (const field of fields.slice(0, 2)) await hit(page, '[data-test="trpg-plan-' + field + '-' + choices[field] + '"]');
  await hit(page, '[data-test="trpg-prepare-open"]');
  await checkRoll(page, { support: choices.tool ? "hiyori" : "adam" });
  const last = fields[2];
  await hit(page, '[data-test="trpg-plan-' + last + '-' + choices[last] + '"]');
  await hit(page, '[data-test="trpg-serve-open"]');
  await checkRoll(page, { support: "tsumugi" });
}
async function fits(page) {
  const clips = await page.locator("button:not([hidden]), .trpg-speech p, .trpg-spot span, .trpg-object-label, .trpg-object-detail").evaluateAll(nodes => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    // A long shelf scrolls inside its own list: those books are reached by scrolling (checked in library-every-story), not clipped.
    const scrolled = n => { for (let a = n.parentElement; a && a.id !== "stage"; a = a.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(a).overflowY) && a.scrollHeight > a.clientHeight + 1) return true;
    } return false; };
    return nodes.filter(n => n.offsetWidth && n.offsetHeight && n.checkVisibility({ opacityProperty: true, visibilityProperty: true })).filter(n => {
      const r = n.getBoundingClientRect();
      return !scrolled(n) && (r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1
        || r.bottom > stage.bottom + 1) || !n.matches(".trpg-spot, .trpg-spot span, .trpg-object-choice, .trpg-object-label, .trpg-object-detail")
          && (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1);
    }).map(n => ({ text: n.textContent, width: n.clientWidth, scroll: n.scrollWidth }));
  });
  assert.deepEqual(clips, [], "Clipped controls or dialogue");
  const overlaps = await page.locator(".trpg-spot").evaluateAll(nodes => {
    const visible = nodes.filter(n => n.offsetWidth && n.offsetHeight);
    const result = [];
    for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i].getBoundingClientRect(), b = visible[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top))
        result.push([visible[i].textContent, visible[j].textContent]);
    }
    return result;
  });
  assert.deepEqual(overlaps, [], "Investigation labels cover each other");
}
async function run(label, params, options, body, beforeLoad = null) {
  if (process.env.CASE_FILTER && label !== process.env.CASE_FILTER) return;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    set.call(localStorage, "suien_remake_save", '{"schema":11,"day":8,"sentinel":"existing-player"}');
    set.call(localStorage, "suien_remake_slot1", "manual-save-sentinel");
    set.call(sessionStorage, "unrelated-tab", "keep-me");
    window.__storageTouches = [];
    for (const key of ["getItem", "setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[key];
      Storage.prototype[key] = function(...args) { window.__storageTouches.push([key, ...args]); return original.apply(this, args); };
    }
    window.__originalStorageGet = get;
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400) errors.push(response.status() + " " + response.url()); });
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    if (beforeLoad) await beforeLoad(page);
    await page.goto(url.href);
    if (label !== "loading-retry") await page.waitForFunction(() => window.__trpg?.ready === true);
    await body(page, errors);
    await fits(page);
    assert.deepEqual(errors, []);
    const storage = await page.evaluate(() => ({
      touches: __storageTouches,
      save: __originalStorageGet.call(localStorage, "suien_remake_save"),
      slot: __originalStorageGet.call(localStorage, "suien_remake_slot1"),
      other: __originalStorageGet.call(sessionStorage, "unrelated-tab"),
    }));
    assert.deepEqual(storage.touches, [], "The prototype accessed browser storage");
    assert.equal(storage.save, '{"schema":11,"day":8,"sentinel":"existing-player"}');
    assert.equal(storage.slot, "manual-save-sentinel");
    assert.equal(storage.other, "keep-me");
    await page.screenshot({ path: path.join(artifacts, label + ".png") });
    results.push({ label, status: "passed" });
    console.log("PASS " + label);
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, label + "-failed.png") }).catch(() => {});
    results.push({ label, status: "failed", error: error.stack, errors });
    console.error("FAIL " + label + "\n" + error.stack);
  } finally { await context.close(); }
}

try {
  await run("cover-pc", { seed: "9", traveler: "quiet" }, {}, async page => {
    await fits(page);
    // 遊び方は表紙の札ではなく、右上の「？」で開く（#2719）。押した後の指は、道具の名札が出ない所へ離す。
    await page.locator('[data-test="trpg-help"]').click();
    await page.mouse.move(2, 2);
    await fits(page); await page.keyboard.press("Escape");
    assert.equal(await page.locator(".trpg-overlay").count(), 0);
    // 閉じたら焦点は「？」へ戻る。名札の吹き出しが出たままにならないよう、確かめた後は卓へ焦点を戻す。
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "trpg-help", "Escape returns focus to the help button");
    await page.locator(".trpg-root").focus();
  });
  await run("quiet-pc-keyboard", { seed: "9", traveler: "quiet" }, {}, async page => {
    await begin(page, true);
    await page.screenshot({ path: path.join(artifacts, "explore-pc.png") });
    await page.locator('[data-test="trpg-spot-notebook"]').press("Enter");
    await nextLines(page, true);
    await page.locator('[data-test="trpg-compare-notes"]').click();
    assert((await page.locator(".trpg-note-card").first().textContent()).includes("ノート"));
    await page.keyboard.press("Escape");
    await explore(page);
    await page.screenshot({ path: path.join(artifacts, "prepare-pc.png") });
    await finish(page, { aroma: "tea", seat: "window", approach: "quiet" });
    assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "雨音のある一台");
    await page.locator('[data-test="trpg-finish"]').click();
    await page.locator('[data-test="trpg-select-ordinary-cup"]').waitFor();
    await hit(page, '[data-test="trpg-select-ordinary-cup"]');
    await page.locator('[data-test="trpg-start"]').waitFor();
    assert.equal((await page.evaluate(() => __trpg.snapshot())).teamwork, 2);
  });
  await run("home-touch", { seed: "3", traveler: "home" },
    { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, async page => {
      await page.locator('[data-test="trpg-start"]').tap();
      await nextLines(page); await checkRoll(page); await interviewStep(page);
      await explore(page); await finish(page, { aroma: "tea", seat: "shelf", approach: "memory" });
      assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "帰り道の一台");
    });
  await run("company-pc", { seed: "15", traveler: "company" }, {}, async page => {
    await begin(page); await explore(page);
    await finish(page, { aroma: "fruit", seat: "counter", approach: "company" });
    assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "話の始まる一台");
  });
  // 判定に賭けるもの（TRF01〜03）: seed 54 は最初の判定で20が出る。クリティカル → 質問が3つ → 思わぬ来客の成功で準備にGMのヒント。
  // スマホ横持ちで、ごほうびの札・切り札の札・ヒントの付箋が画面に収まることも一緒に見る。
  await run("stakes-critical-question-and-gm-hint", { seed: "54" },
    { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, async page => {
      const snap = () => page.evaluate(() => __trpg.snapshot());
      const inStage = async selector => page.locator(selector).first().evaluate(n => {
        const stage = document.getElementById("stage").getBoundingClientRect(), r = n.getBoundingClientRect();
        const actions = n.closest(".trpg-modal")?.querySelector(".trpg-modal-actions")?.getBoundingClientRect();
        return r.width > 0 && r.top >= stage.top - 1 && r.bottom <= (actions ? actions.top : stage.bottom) + 1 && r.left >= stage.left - 1 && r.right <= stage.right + 1;
      });
      await page.locator('[data-test="trpg-start"]').tap();
      await nextLines(page);
      // 宣言の画面で、成功すると何がもらえるかを先に告げる。卓の上は短い札（TRF07）、文の説明は読み上げと「？」に。
      const stake = page.locator('.trpg-declare-stage [data-test="trpg-stake"]');
      assert.match(await stake.textContent(), /^成功で質問 ＋1$/);
      assert.match(await stake.getAttribute("aria-label"), /成功すると.*聞き込み.*1つ増える/);
      // カードは 誰が・何を・能力・見込みの帯。説明の一文はカードに出さない（押す前の読み上げとマウスの説明に残す）。
      const card = page.locator('[data-test^="trpg-approach-"]').first();
      assert.equal(await card.locator(".trpg-approach-copy span").count(), 0, "The approach card carries no sentence");
      assert.equal(await card.locator('[data-test="trpg-approach-odds"]').count(), 1);
      assert.match(await card.getAttribute("aria-label"), /成功 約\d+%、ひと手間 約\d+%/);
      await page.locator('[data-test="trpg-declare-help"]').tap();
      assert.match(await page.locator(".trpg-inline-help-body").textContent(), /帯は見込み.*ごほうび/);
      await page.locator('[data-test="trpg-declare-help"]').tap();
      await page.locator('[data-test^="trpg-approach-"]').first().tap();
      await nextLines(page);
      assert.equal(await page.locator('.trpg-roll-stage [data-test="trpg-stake"]').getAttribute("data-kind"), "listen");
      assert(await inStage('.trpg-roll-stage [data-test="trpg-stake"]'), "The stake is visible on the roll table");
      await page.locator('[data-test="trpg-roll"]').tap();
      await page.locator('[data-test="trpg-settle"]').waitFor();
      const first = (await snap()).pending;
      assert(first.dice.includes(20), "Seed 54 opens with a 20");
      assert.equal(await page.locator('[data-test="trpg-roll-special"]').getAttribute("data-special"), "critical");
      assert.equal(await page.locator('[data-test="trpg-roll-total"]').getAttribute("data-grade"), "success", "A 20 always succeeds");
      assert.equal(await page.locator('[data-test="trpg-roll-reward"]').getAttribute("data-kind"), "question");
      assert.equal(await page.locator('[data-test="trpg-roll-special"]').textContent(), "クリティカル！", "The result names the event; the rule is explained in the help");
      assert(await inStage('[data-test="trpg-roll-reward"]'), "The reward is not hidden under the buttons");
      assert.equal(await page.locator('[data-test="trpg-reroll-0"]').count(), 0, "A critical offers no reroll");
      await page.locator('[data-test="trpg-settle"]').tap();
      await nextLines(page);
      assert.equal((await snap()).extraQuestions, 1);
      assert.match(await page.locator('[data-test="trpg-interview-left"]').textContent(), /あと 3 つ/);
      const topics = page.locator('[data-test^="trpg-topic-"]');
      for (let n = 0; n < 3; n++) { await topics.nth(n).tap(); await nextLines(page); }
      assert.equal((await snap()).asked.length, 3);
      assert(await topics.nth(3).isDisabled(), "The fourth question stays closed");
      await page.locator('[data-test="trpg-interview-done"]').tap();
      for (const id of ["menu", "window", "bag"]) { await page.locator('[data-test="trpg-spot-' + id + '"]').tap(); await nextLines(page); }
      await page.locator('[data-test="trpg-interpret"]').tap();
      await page.locator('[data-test="trpg-hypothesis-quiet"]').tap();
      await nextLines(page);
      await twistStep(page);
      const hints = (await snap()).hints;
      assert.deepEqual(Object.keys(hints).sort(), ["aroma", "seat"], "A successful twist marks one choice in each preparation field");
      const marked = page.locator('[data-test="trpg-plan-aroma-' + hints.aroma + '"]');
      assert.equal(await marked.getAttribute("data-hinted"), "true");
      assert.equal(await page.locator('.trpg-choice-cards [data-hinted="true"]').count(), 1);
      assert.match(await marked.locator(".trpg-hint-mark").textContent(), /合わなそう/);
      assert.match(await marked.getAttribute("aria-label"), /GMのヒント/);
      assert(await inStage('[data-test="trpg-hint-aroma"]'), "The hint tag stays on the stage");
      // 付箋は助言。印の付いた選択肢も選べる。
      await marked.tap();
      assert.equal((await snap()).plan.aroma, hints.aroma);
    });
  // じっくり調べる（目星・TRF14）: seed 9 は、自分の役（観察3）の出目が 14＋13＋3＝30 で成功。違う見立て2つに付箋が付き、本命だけが残る。
  // PCとスマホ横持ちで、札・出目の帯・付箋が卓に収まることも一緒に見る。
  for (const [label, options] of [["closer-look-pc", {}], ["closer-look-touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await run(label, { seed: "9" }, options, async page => {
      const snap = () => page.evaluate(() => __trpg.snapshot());
      const inStage = async selector => page.locator(selector).first().evaluate(n => {
        const stage = document.getElementById("stage").getBoundingClientRect(), r = n.getBoundingClientRect();
        return r.width > 0 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1 && r.left >= stage.left - 1 && r.right <= stage.right + 1;
      });
      await begin(page);
      for (const id of ["menu", "window", "bag"]) { await hit(page, '[data-test="trpg-spot-' + id + '"]'); await nextLines(page); }
      const heat = (await snap()).heat;
      await hit(page, '[data-test="trpg-interpret"]');
      const look = page.locator('[data-test="trpg-search"]');
      assert.equal(await look.textContent(), "じっくり調べる観察 ＋3 · 1回", "The card shows the stat and the limit; the rule is in the help");
      assert.match(await look.getAttribute("aria-label"), /フィンの観察で判定。一度だけ。成功 約\d+%で違う見立てが2つ、ひと手間 約\d+%で1つ分かる/);
      assert(await inStage('[data-test="trpg-search"]'), "The card stays on the stage");
      await hit(page, '[data-test="trpg-search"]');
      const found = (await snap()).search;
      assert.deepEqual(found.dice, [14, 13]); assert.equal(found.total, 30); assert.equal(found.grade, "success");
      assert.deepEqual(found.ruled.slice().sort(), ["company", "home"]);
      assert.equal((await snap()).heat, heat + 1, "A successful look lifts the table by one");
      assert.equal(await look.count(), 0, "One look per table");
      const strip = page.locator('[data-test="trpg-search-result"]');
      assert.equal(await strip.getAttribute("data-grade"), "success");
      assert.equal(await strip.textContent(), "1413＋3 ＝ 30成功！✕ 2つ");
      assert.match(await strip.getAttribute("aria-label"), /合計 30。成功！。違いそうな見立てが2つ分かった/);
      for (const id of found.ruled) {
        const card = page.locator('[data-test="trpg-hypothesis-' + id + '"]');
        assert.equal(await card.getAttribute("data-ruled"), "true");
        assert.match(await card.getAttribute("aria-label"), /じっくり調べた結果：違いそう/);
        assert.equal(await card.locator(".trpg-hint-mark").textContent(), "✕ 違いそう");
      }
      assert.equal(await page.locator('[data-test="trpg-hypothesis-quiet"]').getAttribute("data-ruled"), "false", "The truth is what is left");
      // 出目が止まり、付箋が出そろってから、卓に収まっていることを見る。
      await page.waitForFunction(() => [document.querySelector('[data-test="trpg-search-result"]'), ...document.querySelectorAll(".trpg-hypothesis-stage .trpg-hint-mark")]
        .every(n => n.getAnimations({ subtree: true }).every(a => a.playState === "finished")));
      assert(await inStage('[data-test="trpg-search-result"]'), "The result strip stays on the stage");
      for (const id of found.ruled) assert(await inStage('[data-test="trpg-ruled-' + id + '"]'), "The tag stays on the stage");
      const [back, result] = await Promise.all(['[data-test="trpg-hypothesis-back"]', '[data-test="trpg-search-result"]'].map(sel =>
        page.locator(sel).evaluate(n => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })));
      assert(back.right <= result.left + 1 && Math.abs((back.top + back.bottom) - (result.top + result.bottom)) < 4, "The two sit side by side under the cards");
      await page.screenshot({ path: path.join(artifacts, label + ".png") });
      // 開き直しても同じ結果。出目は転がし直さない。
      await hit(page, '[data-test="trpg-hypothesis-back"]'); await hit(page, '[data-test="trpg-interpret"]');
      assert.equal(await strip.getAttribute("data-fresh"), "false");
      assert.equal(await page.locator(".trpg-hypothesis-stage .trpg-hint-mark").count(), 2);
      // 残った見立てを選ぶと的中。決まりは「？」に書いてある。
      await hit(page, '[data-test="trpg-hypothesis-quiet"]'); await nextLines(page);
      assert.equal((await snap()).hypothesis, "quiet"); assert.equal((await snap()).profileId, "quiet");
      await hit(page, '[data-test="trpg-help"]');
      assert.match(await page.locator(".trpg-help-glossary").nth(1).textContent(), /じっくり調べる.*自分の役の観察で判定。成功で2つ、ひと手間で1つ/);
    });
  }
  await run("discovery-small-touch", { seed: "12", traveler: "quiet" },
    { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true }, async page => {
      await begin(page); await explore(page);
      await finish(page, { aroma: "spice", seat: "counter", approach: "company" });
      assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "一緒に見つけた一台");
    });
  // 演出（TRF08〜10）: 転生・物語の層と卓の層・判定の帯とカットイン・場面の題の札・手がかりの札。
  // どれも見た目だけで、操作を塞がない。seed 54 は最初の判定がクリティカル。
  // 演出は数秒で自分から消えるので、出た瞬間の中身をページの中で記録して、あとから確かめる（実行の速さに左右されない）。
  await run("staging-incarnation-layers-and-cutin", { seed: "54" }, {}, async page => {
    const root = page.locator(".trpg-root"), next = page.locator('[data-test="trpg-next"]');
    await page.evaluate(() => {
      const text = (node, selector) => node.querySelector(selector)?.textContent ?? null;
      window.__staged = [];
      new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1 || !node.matches(".trpg-incarnate, .trpg-cutin, .trpg-scene-card, .trpg-clue-card")) continue;
        const stage = document.querySelector(".trpg-root");
        window.__staged.push({ kind: node.className, small: text(node, "small"), strong: text(node, "strong"), tone: node.dataset.tone || "",
          special: node.dataset.special || "", calm: node.dataset.calm || "", hidden: node.getAttribute("aria-hidden"),
          pointer: getComputedStyle(node.closest(".trpg-fx-layer")).pointerEvents, clip: getComputedStyle(node.closest(".trpg-fx-layer")).overflowX,
          scroll: [stage.scrollWidth - stage.clientWidth, stage.scrollLeft],
          cards: [...node.querySelectorAll(".trpg-incarnate-card")].map(card => ({ front: text(card, ".front strong"), back: text(card, ".back strong"),
            title: text(card, ".back small"), art: card.querySelector(".back .trpg-costume i")?.getAttribute("style") || "" })) });
      } }).observe(document.querySelector(".trpg-root"), { childList: true, subtree: true });
    });
    const staged = kind => page.evaluate(k => window.__staged.filter(entry => entry.kind.includes(k)), kind);
    await page.locator('[data-test="trpg-start"]').click();
    // キャラ作りの時間は卓の会話: 座席の帯が出ていて、だれも役の姿ではない。
    assert.equal(await root.getAttribute("data-layer"), "table");
    assert(await page.locator(".trpg-table").evaluate(n => n.checkVisibility({ visibilityProperty: true, opacityProperty: true })));
    // 転生が出るまで送る。出た瞬間の1押しは、ページの中でまとめて行う: 演出を閉じるだけで、下の最初の一行は読み飛ばさない。
    let closed = null;
    for (let presses = 0; !closed; presses++) {
      assert(presses < 40, "The story begins after the character talk");
      closed = await page.evaluate(() => {
        const button = document.querySelector('[data-test="trpg-next"]'), line = () => document.querySelector(".trpg-speech p").textContent;
        if (!document.querySelector(".trpg-incarnate")) { button.click(); return null; }
        const before = line(); button.click();
        return { before, after: line(), gone: !document.querySelector(".trpg-incarnate"), kind: document.querySelector(".trpg-root").dataset.kind,
          who: document.querySelector(".trpg-speaker-label strong").textContent, art: getComputedStyle(document.querySelector(".trpg-speaker-art")).display };
      });
    }
    assert.equal(closed.after, closed.before, "The first press only puts the cards away");
    assert(closed.gone);
    // 転生: 卓にいるPLの数だけ札があり、表は本人、裏は役。
    const pc = (await page.evaluate(() => __trpg.snapshot())).pc, [incarnation] = await staged("trpg-incarnate");
    assert.equal(incarnation.cards.length, 3);
    assert.equal(incarnation.cards[0].front, "はじめ"); assert.equal(incarnation.cards[0].back, pc.name); assert.equal(incarnation.cards[0].title, pc.title);
    assert.match(incarnation.cards[0].art, /costumes\/ordinary-cup\/hajime_/, "The role side wears the costume art");
    assert.equal(incarnation.hidden, "true"); assert.equal(incarnation.pointer, "none", "The staging never blocks the table");
    // 物語の中: 語りは立ち絵なしで「語り」、座席の帯は隠れる。
    assert.equal(closed.kind, "narration"); assert.equal(closed.who, "語り"); assert.equal(closed.art, "none");
    await page.waitForFunction(() => !document.querySelector(".trpg-table").checkVisibility({ visibilityProperty: true, opacityProperty: true }));
    const seen = {};
    for (let n = 0; n < 60 && await next.isVisible(); n++) {
      const line = await page.evaluate(() => ({ kind: document.querySelector(".trpg-root").dataset.kind, who: document.querySelector(".trpg-speaker-label strong").textContent,
        aside: document.querySelector(".trpg-speaker-label span").textContent, art: document.querySelector(".trpg-speaker-art").innerHTML }));
      seen[line.kind] ||= line;
      await next.click();
    }
    assert.equal(seen.npc.who, "旅人オル"); assert.equal(seen.npc.aside, "GM ひより");
    assert.match(seen.npc.art, /trpg-npc-figure/); assert.match(seen.npc.art, /trpg-npc-gm/, "The GM's face stays beside the character they voice");
    assert.equal(seen.pc.who, pc.name, "A player in role is named by the character"); assert.equal(seen.pc.aside, "はじめ");
    assert.match(seen.pc.art, /costumes\/ordinary-cup\/hajime_/, "and wears the role costume");
    assert(seen.table, "Table talk returns between the story's lines");
    // 判定: 目標までの帯と、結果のカットイン。
    await page.locator('[data-test^="trpg-approach-"]').first().click();
    await nextLines(page);
    await page.locator('[data-test="trpg-roll"]').click();
    await page.locator('[data-test="trpg-settle"]').waitFor();
    assert((await page.evaluate(() => __trpg.snapshot())).pending.dice.includes(20), "Seed 54 opens with a 20");
    const gauge = page.locator(".trpg-roll-gauge");
    assert.equal(await gauge.getAttribute("data-grade"), "success"); assert.equal(await gauge.getAttribute("data-special"), "critical");
    assert.equal(await gauge.locator(".trpg-roll-gauge-goal").textContent(), "30");
    const marks = await gauge.evaluate(n => ["--mixed-at", "--success-at", "--mark-at"].map(k => parseFloat(n.style.getPropertyValue(k))));
    assert(marks[0] < marks[1] && marks[1] < marks[2] && marks[2] <= 100, "The mark stops on the success side: " + marks);
    await page.locator('[data-test="trpg-settle"]').click();
    await nextLines(page);
    const [cut] = await staged("trpg-cutin");
    assert.equal(cut.special, "critical"); assert.equal(cut.strong, "クリティカル！");
    assert.match(cut.small, new RegExp("^" + pc.name + " · ")); assert.equal(cut.pointer, "none");
    // 帯や札が舞台の外へはみ出しても、舞台の横スクロール幅を増やさない（増えると、押した拍子に舞台ごと横へずれる）。
    assert.equal(cut.clip, "hidden"); assert.deepEqual(cut.scroll, [0, 0], "The staging layer clips what leaves the stage");
    assert.deepEqual(await root.evaluate(n => [n.scrollWidth - n.clientWidth, n.scrollLeft]), [0, 0]);
    // 場面の題の札と、聞いた話の札。先へ進むと、場面の札は片付く。
    const scenes = await staged("trpg-scene-card");
    assert.deepEqual(scenes.map(card => [card.small, card.strong]), [["場面 2 / 7", "旅人と話す"]]);
    const cleared = await page.evaluate(() => { document.querySelector('[data-test^="trpg-topic-"]').click();
      return { scene: document.querySelectorAll(".trpg-scene-card").length, clue: document.querySelector(".trpg-clue-card small")?.textContent ?? null }; });
    assert.deepEqual(cleared, { scene: 0, clue: "聞いた話" }, "The scene card leaves when the player moves on");
    await nextLines(page);
    assert.equal(await root.getAttribute("data-layer"), "idle");
  });
  await run("reroll-cancel-and-low-motion", { seed: "8", traveler: "quiet" },
    { reducedMotion: "reduce" }, async page => {
      await page.locator('[data-test="trpg-start"]').click();
      // 動きを減らす設定: 転生は役の札を動かさずに短く見せるだけ（裏返しも光もない）。
      let calm = null;
      for (let presses = 0; !calm; presses++) {
        assert(presses < 40);
        calm = await page.evaluate(() => { const node = document.querySelector(".trpg-incarnate");
          if (!node) { document.querySelector('[data-test="trpg-next"]').click(); return null; }
          return { calm: node.dataset.calm, side: node.querySelector(".trpg-incarnate-card").dataset.side }; });
      }
      assert.deepEqual(calm, { calm: "true", side: "back" });
      await nextLines(page);
      await checkRoll(page, { reroll: true });
      assert.equal((await page.evaluate(() => __trpg.snapshot())).teamwork, 1);
      await page.locator('[data-test="trpg-log"]').click();
      assert((await page.locator(".trpg-log-line").count()) > 5);
      await page.keyboard.press("Escape");
      await page.locator('[data-test="trpg-exit"]').click();
      await page.locator('[data-test="trpg-exit-confirm"]').click();
      await page.locator('[data-test="trpg-select-ordinary-cup"]').waitFor();
      assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "library");
    });
  await run("character-builder-pc", { seed: "9", traveler: "quiet" }, {}, async page => {
    assert.equal(await page.locator('[data-test="trpg-cover-pc-name"]').textContent(), "フィン");
    await hit(page, '[data-test="trpg-build"]');
    await page.locator('[data-test="trpg-builder"]').waitFor();
    await fits(page);
    assert.equal(await page.locator('[data-test^="trpg-look-"]').count(), 0, "no look choice (#3050)");
    await hit(page, '[data-test="trpg-archetype-sailor"]');
    assert.equal(await page.locator('[data-test="trpg-stat-nerve-down"]').count(), 0, "easy mode hides the point-buy");
    await hit(page, '[data-test="trpg-builder-advanced"]');
    await hit(page, '[data-test="trpg-stat-nerve-down"]'); await hit(page, '[data-test="trpg-stat-talk-up"]');
    assert.equal(await page.locator('[data-test="trpg-stat-points"]').getAttribute("data-left"), "0");
    assert(await page.locator('[data-test="trpg-stat-talk-up"]').isDisabled(), "spent points disable raising");
    assert.equal(await page.locator('input[data-test="trpg-pc-name"], .trpg-builder input[type="text"]').count(), 0, "the role keeps its given name; no name field");
    await hit(page, '[data-test="trpg-build-confirm"]');
    assert.equal(await page.locator('[data-test="trpg-cover-pc-name"]').textContent(), "マル");
    const pc = (await page.evaluate(() => __trpg.snapshot())).pc;
    assert.deepEqual(pc, { name: "マル", title: "船乗り帰りの手伝い", archetype: "sailor", stats: { eye: 2, hand: 3, talk: 3, nerve: 3 } });
    // "Leave it to the dice" is reproducible from the model, and cancelling keeps the confirmed character.
    await hit(page, '[data-test="trpg-build"]'); await hit(page, '[data-test="trpg-build-random"]'); await hit(page, '[data-test="trpg-build-back"]');
    assert.deepEqual((await page.evaluate(() => __trpg.snapshot())).pc, pc);
    await hit(page, '[data-test="trpg-start"]'); await nextLines(page);
    assert.match(await page.locator('[data-test="trpg-seat-pc-hajime"]').textContent(), /マル/);
    await hit(page, '[data-test="trpg-approach-listen_talk"]');
    assert.match(await page.locator(".trpg-speech p").textContent(), /^マルは/);
    assert.equal(await page.locator(".trpg-root").evaluate(n => n.textContent.includes("{pc}")), false);
    await nextLines(page);
    assert.equal(await page.locator('[data-test="trpg-bonus"]').textContent(), "＋3", "the built talk stat is the roll's base");
    await fits(page);
  });
  await run("shopkeeper-tutorial-and-session-zero", { seed: "6", traveler: "quiet", tutorial: "1" }, {}, async page => {
    await page.locator('[data-test="trpg-tutorial-panel"]').waitFor();
    assert(!await page.locator('[data-test="trpg-start"]').isVisible(), "the cover waits for the shopkeeper");
    await fits(page);
    await nextLines(page);
    assert.equal(await page.locator('[data-test="trpg-tutorial-panel"]').count(), 0);
    await hit(page, '[data-test="trpg-start"]');
    const first = await page.locator(".trpg-speech p").textContent();
    assert.match(first, /キャラ作り/, "the GM opens session zero");
    await nextLines(page);
    assert.equal(await page.locator('[data-test="trpg-approach-best"]').count(), 1, "one approach carries the beginner's recommendation");
    await fits(page);
    await hit(page, '[data-test="trpg-approach-listen_talk"]');
    await nextLines(page);
    assert.equal(await page.locator(".trpg-root").evaluate(n => n.textContent.includes("{pc")), false);
  });
  await run("portrait-touch-hint", { seed: "1" },
    { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
      assert(await page.locator("#trpg-rotate").isVisible());
      await page.setViewportSize({ width: 844, height: 390 });
      await page.locator("#trpg-rotate").waitFor({ state: "hidden" });
      await fits(page);
    });
  await run("double-input-and-integration-abort", { seed: "13", traveler: "quiet" }, {}, async page => {
    await hit(page, '[data-test="trpg-start"]'); await nextLines(page); await declare(page);
    await page.locator('[data-test="trpg-roll"]').evaluate(node => { node.click(); node.click(); });
    await page.locator('[data-test="trpg-settle"]').waitFor();
    await page.locator('[data-test="trpg-settle"]').evaluate(node => { node.click(); node.click(); });
    await nextLines(page);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).checks.length, 1);
    const cancelled = await page.evaluate(async () => {
      const { runTrpg } = await import("/remake/js/trpg/index.js");
      const fixture = document.createElement("div");
      fixture.style.cssText = "position:absolute;inset:0;z-index:200";
      document.getElementById("stage").append(fixture);
      const signal = new AbortController();
      const pending = runTrpg(fixture, { seed: 9, signal: signal.signal });
      signal.abort();
      const result = await pending;
      const children = fixture.children.length;
      fixture.remove();
      return { result, children };
    });
    assert.equal(cancelled.result.cancelled, true);
    assert.equal(cancelled.children, 0);
    assert.equal(await page.locator(".trpg-root").count(), 1);
  });
  await run("library-every-story", {}, {}, async page => {
    assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "library");
    const catalog = JSON.parse(fs.readFileSync(new URL("../../../data/trpg_catalog.json", import.meta.url), "utf8"));
    assert.equal(await page.locator(".trpg-library-book").count(), catalog.scenarios.length);
    // Every book on the long shelf scrolls fully into view, above the footer, with its open button unclipped.
    const reach = await page.locator(".trpg-library-copy > button").evaluateAll(buttons => buttons.map(button => {
      button.scrollIntoView({ block: "nearest" });
      const r = button.getBoundingClientRect(), list = button.closest(".trpg-library-books").getBoundingClientRect();
      return r.top >= list.top - 1 && r.bottom <= list.bottom + 1 && button.scrollWidth <= button.clientWidth + 1 ? null : button.textContent;
    }));
    assert.deepEqual(reach.filter(Boolean), [], "Every book can be scrolled into view");
    await page.locator(".trpg-library-books").evaluate(list => { list.scrollTop = 0; });
    await page.screenshot({ path: path.join(artifacts, "library-pc.png") });
    await hit(page, '[data-test="trpg-select-ordinary-cup"]');
    assert.equal((await page.evaluate(() => __trpg.snapshot())).scenarioId, "ordinary-cup");
    await hit(page, '[data-test="trpg-exit"]');
    await page.locator('[data-test="trpg-select-shark-last-order"]').waitFor();
    await hit(page, '[data-test="trpg-select-shark-last-order"]');
    assert.equal((await page.evaluate(() => __trpg.snapshot())).scenarioId, "shark-last-order");
    assert((await page.locator(".trpg-cover-person").first().textContent()).includes("サメちゃん"));
    await page.screenshot({ path: path.join(artifacts, "shark-cover.png") });
  });
  const movies = [
    { label: "shark-scent-pc", profile: "scent", choices: { tool: "citrus", route: "pier", finale: "lure" }, ending: "海へ贈るラストオーダー", seed: 9, options: {} },
    { label: "shark-vibration-touch", profile: "vibration", choices: { tool: "sealed", route: "roof", finale: "silence" }, ending: "世界一静かなエンドロール", seed: 14,
      options: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
    { label: "shark-light-pc", profile: "light", choices: { tool: "beacon", route: "channel", finale: "signal" }, ending: "海上プレミア上映", seed: 4, options: {} },
    { label: "shark-sequel-small-touch", profile: "scent", choices: { tool: "beacon", route: "roof", finale: "silence" }, ending: "そして、翌朝の予告編", seed: 5,
      options: { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true } },
  ];
  for (const movie of movies) await run(movie.label, { scenario: "shark-last-order", traveler: movie.profile, seed: movie.seed }, movie.options, async page => {
    await begin(page);
    for (const id of ["radio", "leaves", "fan", "lamp"]) {
      await hit(page, '[data-test="trpg-spot-' + id + '"]'); await nextLines(page);
    }
    assert(await page.locator('[data-test="trpg-spot-rope"]').isDisabled());
    const pressure = (await page.evaluate(() => __trpg.snapshot())).pressure;
    await hit(page, '[data-test="trpg-compare-notes"]');
    assert((await page.locator(".trpg-note-card").first().textContent()).includes("無線"));
    await hit(page, '[data-test="trpg-notes-close"]');
    await hit(page, '[data-test="trpg-consult-hiyori"]'); await nextLines(page);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).pressure, pressure);
    if (movie.label === "shark-scent-pc") await page.screenshot({ path: path.join(artifacts, "shark-explore-pc.png") });
    await hit(page, '[data-test="trpg-interpret"]');
    await hit(page, '[data-test="trpg-hypothesis-' + movie.profile + '"]'); await nextLines(page);
    await twistStep(page);
    await finish(page, movie.choices);
    assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), movie.ending);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).checks.find(c => c.kind === "prepare").hypothesisBonus, 4); // d20版の見立て補正
    await fits(page);
    if (movie.label === "shark-scent-pc") {
      await hit(page, '[data-test="trpg-replay"]');
      await page.locator('[data-test="trpg-start"]').waitFor();
      const reset = await page.evaluate(() => __trpg.snapshot());
      assert.equal(reset.phase, "cover"); assert.equal(reset.teamwork, 2); assert.equal(reset.pressure, 0);
    }
  });
  await run("audio-and-check-cancellation", { scenario: "shark-last-order", traveler: "light", seed: 3 }, {}, async page => {
    // 音は既定でON（最初の操作まで AudioContext は作らない）。テーマ別BGMと録音SE（CC0・仮）を使う。
    const initial = await page.evaluate(() => __trpg.audio());
    assert.equal(initial.state, "idle"); assert.equal(initial.enabled, true); assert.equal(initial.bgm, "bgm_trpg_shark");
    await hit(page, '[data-test="trpg-audio"]');
    await page.waitForFunction(() => !__trpg.audio().enabled);
    await hit(page, '[data-test="trpg-audio"]');
    await page.waitForFunction(() => __trpg.audio().enabled && __trpg.audio().state === "running");
    await page.waitForFunction(() => __trpg.audio().samples >= 19); // 録音SEが全部読めた
    assert.equal((await page.evaluate(() => __trpg.audio())).ambience, 0); // BGMがあるテーマでは合成の環境音を重ねない
    await hit(page, '[data-test="trpg-start"]'); await nextLines(page);
    await hit(page, '[data-test="trpg-declare-back"]');
    assert.equal((await page.evaluate(() => __trpg.snapshot())).pending, null);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).checks.length, 0);
    await hit(page, '[data-test="trpg-listen-open"]'); await checkRoll(page);
    await hit(page, '[data-test="trpg-audio"]');
    await page.waitForFunction(() => !__trpg.audio().enabled && __trpg.audio().state === "suspended");
    assert.equal((await page.evaluate(() => __trpg.audio())).ambience, 0);
    await hit(page, '[data-test="trpg-exit"]'); await hit(page, '[data-test="trpg-exit-confirm"]');
    await page.locator('[data-test="trpg-select-ordinary-cup"]').waitFor();
  });
  let rejectCatalog = true;
  await run("loading-retry", {}, {}, async (page, errors) => {
    await page.locator('[data-test="trpg-retry-load"]').waitFor();
    rejectCatalog = false;
    await hit(page, '[data-test="trpg-retry-load"]');
    await page.locator('[data-test="trpg-select-shark-last-order"]').waitFor();
    assert(errors.length > 0);
    assert(errors.every(error => /503|Resource unavailable/.test(error)), errors.join("\n"));
    errors.length = 0;
  }, page => page.route("**/data/trpg_catalog.json", route => rejectCatalog ? route.fulfill({ status: 503, body: "Temporary failure" }) : route.continue()));
  let rejectScene = true;
  await run("scene-retry-and-shark-api-abort", { scenario: "shark-last-order", seed: 4, traveler: "scent" }, {}, async (page, errors) => {
    await begin(page);
    await page.locator('[data-test="trpg-scene-retry"]').waitFor();
    rejectScene = false;
    await hit(page, '[data-test="trpg-scene-retry"]');
    await page.locator('[data-test="trpg-scene-retry"]').waitFor({ state: "hidden" });
    assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "explore");
    const aborted = await page.evaluate(async () => {
      const { runTrpg, loadTrpgResources } = await import("/remake/js/trpg/index.js");
      const resources = await loadTrpgResources({ scenarioId: "shark-last-order" });
      const host = document.createElement("div"), abort = new AbortController();
      document.getElementById("stage").append(host);
      const result = runTrpg(host, { resources, signal: abort.signal });
      const mounted = host.children.length; abort.abort();
      const cancelled = await result;
      const children = host.children.length; host.remove();
      return { mounted, cancelled, children };
    });
    assert.equal(aborted.mounted, 1); assert.equal(aborted.children, 0);
    assert.equal(aborted.cancelled.scenarioId, "shark-last-order"); assert(aborted.cancelled.cancelled);
    assert(errors.length > 0);
    assert(errors.every(error => /503/.test(error)), errors.join("\n")); errors.length = 0;
  }, page => page.route("**/trpg_shark_room.webp*", route => rejectScene ? route.fulfill({ status: 503, body: "Temporary failure" }) : route.continue()));
} finally {
  await browser.close();
  fs.writeFileSync(path.join(artifacts, "results.json"), JSON.stringify({ results }, null, 2) + "\n");
}
assert(results.length > 0, "No TRPG browser cases were selected");
assert.equal(results.filter(r => r.status === "failed").length, 0, "TRPG browser cases failed");
