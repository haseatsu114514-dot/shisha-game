// SKIPでも未読込の表情を出さず、CGと場面転換が終わってから次へ進む。
import assert from "node:assert/strict";
import "./vn_line_presentation.mjs";
import { suite, assertFits } from "./browser/support.mjs";

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame(); core.config.textSpeed = 4;
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const engine = await import("./js/vn/engine.js");
    const intro = await import("./js/vn/intro.js");
    ["sumi", "adam"].forEach(id => { core.state.met[id] = true; intro.markIntroSeen(id); });
    engine.vnTest.turbo = false;
    ui.clearScreen();
    await ui.setBg(data.bgUrl("bg_tonari_inside"), { instant: true });
    await Promise.all(["sumi", "adam"].map(id => ui.imageReady(data.portraitInfo(id, "normal").src, 15000)));
    window.V = { core, ui, data, engine };
  });
}

async function assertNameFits(page, sample = null) {
  const measured = await page.locator(".vn-name.show").evaluate(async element => {
    await document.fonts.ready;
    const bounds = rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
      width: rect.width, height: rect.height });
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    // Font ascent/descent can make scrollHeight exceed the 37px label even when
    // the painted glyphs fit. Measure their real baseline and ink, not that box.
    const probe = document.createElement("span");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "display:inline-block;width:0;height:0;padding:0;border:0;margin:0;line-height:0;vertical-align:baseline;visibility:hidden";
    let baseline;
    element.append(probe);
    try { baseline = probe.getBoundingClientRect().top; }
    finally { probe.remove(); }
    const context = document.createElement("canvas").getContext("2d");
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    context.textBaseline = "alphabetic";
    const ink = context.measureText(element.textContent);
    const scale = box.width / element.clientWidth;
    return { text: element.textContent, box: bounds(box), range: bounds(text),
      stage: bounds(document.getElementById("stage").getBoundingClientRect()),
      viewport: { width: innerWidth, height: innerHeight },
      client: { width: element.clientWidth, height: element.clientHeight },
      scroll: { width: element.scrollWidth, height: element.scrollHeight },
      font: context.font, lineHeight: style.lineHeight,
      visibility: style.visibility, opacity: Number(style.opacity),
      overflow: { x: style.overflowX, y: style.overflowY },
      ink: { baseline, ascent: ink.actualBoundingBoxAscent, descent: ink.actualBoundingBoxDescent,
        top: baseline - ink.actualBoundingBoxAscent * scale,
        bottom: baseline + ink.actualBoundingBoxDescent * scale } };
  });
  if (sample) console.log(`[vn-visual-readiness] Name geometry ${sample}: ${JSON.stringify(measured)}`);
  const { box, range, stage, viewport, ink } = measured;
  const diagnostic = JSON.stringify(measured);
  assert(box.width > 0 && box.height > 0 && measured.visibility === "visible" && measured.opacity > 0,
    `Invisible name: ${diagnostic}`);
  assert(box.left >= stage.left - 1 && box.top >= stage.top - 1
    && box.right <= stage.right + 1 && box.bottom <= stage.bottom + 1
    && box.left >= -1 && box.top >= -1 && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1,
  `Name outside stage/viewport: ${diagnostic}`);
  assert(range.width > 0 && range.left >= box.left - 1 && range.right <= box.right + 1,
    `Name text exceeds label width: ${diagnostic}`);
  assert(Number.isFinite(ink.top) && Number.isFinite(ink.bottom) && ink.bottom > ink.top
    && ink.top >= box.top - 1 && ink.bottom <= box.bottom + 1,
  `Name glyphs exceed label height: ${diagnostic}`);
}

async function expectNameLine(page, { text, name, speaker, thought = false }, sample = null) {
  await page.waitForFunction(text => document.querySelector(".vn-text")?.textContent === text, text);
  await page.locator(".vn-next.show").waitFor();
  const actual = await page.evaluate(() => {
    const name = document.querySelector(".vn-name");
    return { name: name.textContent, title: name.title, shown: name.classList.contains("show"),
      thought: document.querySelector(".vn-box").classList.contains("thought"),
      blips: N.blips.splice(0), last: V.engine.backlog().at(-1),
      portraits: document.querySelectorAll('.vn-portraits [data-speaker="hajime"], .vn-portraits [data-speaker="hazime"]').length };
  });
  assert.equal(actual.name, name);
  assert.equal(actual.title, name);
  assert.equal(actual.shown, !!name);
  assert.equal(actual.thought, thought);
  assert.equal(actual.portraits, 0, "A display name must not create a protagonist portrait");
  assert.deepEqual(actual.last, { name, text }, "The screen and backlog must use the same presentation");
  assert(actual.blips.length > 0, "This normal-typing line must exercise the production voice path");
  assert(actual.blips.every(id => id === speaker), `Display name changed the blip speaker: ${JSON.stringify(actual.blips)}`);
  if (name) await assertNameFits(page, sample);
  await assertFits(page, ".vn-text");
}

await suite("vn-visual-readiness", async (check) => {
  await check("protagonist-name-intro-log-and-slots", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      const { SE } = await import("./js/core/audio.js");
      const { paidAction } = await import("./js/core/stats.js");
      V.core.config.textSpeed = 3;
      V.core.state.met.hajime = true; // Meeting/portrait state alone is not the story introduction.
      V.engine.backlog().length = 0;
      window.N = { blips: [], saved: {}, SE, originalBlip: SE.blip,
        copy: value => { const copy = structuredClone(value); delete copy.savedAt; return copy; } };
      SE.blip = speaker => { N.blips.push(speaker); return N.originalBlip(speaker); };
      N.beforeTechnique = V.core.state.stats.technique;
      N.lines = [
        { speaker: "", text: "静かな煙が揺れる。" },
        { speaker: "hajime", text: "（まだ、名乗っていない）" },
        { speaker: "hazime", text: "まだ名前は出さない。" },
        { type: "intro", char_id: "hajime" },
        { speaker: "", text: "名乗った後も煙は揺れる。" },
        { speaker: "hajime", text: "（落ち着いていこう）" },
        { type: "jump", next_id: "ch1_cold_open" },
      ];
      N.jumpLines = [
        { speaker: "", text: "「こちらを向いて」" },
        { speaker: "sumi", portrait: false, text: "いつもどおりでいい。" },
        { speaker: "samechan", voice: "korochan", portrait: false, text: "ころころ、ころころ。" },
        { speaker: "", text: "……【技術】と【好感度】が少し上がった。" },
        { type: "choice", choices: [{ text: "閉じる" }] },
      ];
      N.originalLines = JSON.stringify([N.lines, N.jumpLines]);
      N.originalColdOpen = V.data.DB.dialogues.ch1_cold_open;
      // The exception must follow the jump destination, not the original running ID.
      V.data.DB.dialogues.ch1_cold_open = { dialogue_id: "ch1_cold_open", lines: N.jumpLines };
      N.scene = paidAction(
        () => V.engine.play({ dialogue_id: "name-intro-check", lines: N.lines }),
        { consumed: () => true },
      );
    });
    try {
      const before = [
        { speaker: "", text: "静かな煙が揺れる。", name: "???" },
        { speaker: "hajime", text: "（まだ、名乗っていない）", name: "???", thought: true },
        { speaker: "hazime", text: "まだ名前は出さない。", name: "???" },
      ];
      const after = [
        { speaker: "", text: "名乗った後も煙は揺れる。", name: "はじめ" },
        { speaker: "hajime", text: "（落ち着いていこう）", name: "はじめ", thought: true },
        { speaker: "", text: "「こちらを向いて」", name: "？？？" },
        { speaker: "sumi", text: "いつもどおりでいい。", name: "スミさん" },
        { speaker: "samechan", text: "ころころ、ころころ。", name: "コロちゃん" },
        { speaker: "", text: "……【好感度】が少し上がった。", name: "" },
      ];
      for (const [index, line] of before.entries()) {
        await expectNameLine(page, line, index === 0 ? "unknown-name-pc" : null);
        assert.equal(await page.evaluate(() => !!V.core.state.flags._intro_hajime), false);
        if (index === 0) {
          assert.equal(await page.evaluate(() => {
            const saved = V.core.saveToSlot("suien_remake_slot1");
            N.saved.suien_remake_slot1 = N.copy(V.core.state);
            return saved;
          }), true);
        }
        await page.keyboard.press("Enter");
      }
      // Use the real intro and its real hold; turbo/clock shortcuts would miss this boundary.
      await page.locator('.cutin.in[data-char="hajime"]').waitFor({ timeout: 20000 });
      assert.equal(await page.locator(".vn-name").textContent(), "???");
      await page.locator('.cutin[data-char="hajime"]').waitFor({ state: "detached", timeout: 20000 });
      for (const [index, line] of after.entries()) {
        await expectNameLine(page, line);
        assert.equal(await page.evaluate(() => !!V.core.state.flags._intro_hajime), true);
        if (index === 0) {
          assert.equal(await page.evaluate(() => {
            const saved = V.core.saveToSlot("suien_remake_slot2");
            N.saved.suien_remake_slot2 = N.copy(V.core.state);
            return saved;
          }), true);
        }
        await page.keyboard.press("Enter");
      }
      await page.locator('[data-test="choice-0"]').waitFor();
      const expectedLog = [...before, ...after].map(({ name, text }) => ({ name, text }));
      assert.deepEqual(await page.evaluate(() => V.engine.backlog()), expectedLog);
      assert.equal(await page.evaluate(() => JSON.stringify([N.lines, N.jumpLines]) === N.originalLines), true, "Presentation mutated the input dialogue");
      assert.equal(await page.evaluate(() => V.core.state.stats.technique - N.beforeTechnique), 0, "The paid action must defer the cue reward until completion");
      const beforeLog = await page.evaluate(() => N.copy(V.core.state));
      await page.locator('[data-test="vn-log"]').click();
      await page.locator(".vn-log.show").waitFor();
      assert.deepEqual(await page.locator(".vn-log .log-row").evaluateAll(rows => rows.map(row => ({
        name: row.querySelector("b")?.textContent || "", text: row.querySelector("span").textContent,
      }))), expectedLog, "Opening LOG must not rename pre-introduction history");
      await page.locator(".vn-log button").click();
      assert.deepEqual(await page.evaluate(() => N.copy(V.core.state)), beforeLog, "LOG reapplied a reward or changed progression");
      await page.locator('[data-test="choice-0"]').click();
      assert.deepEqual((await page.evaluate(() => N.scene)).value.visited, ["name-intro-check", "ch1_cold_open"]);
      assert.equal(await page.evaluate(() => V.core.state.stats.technique - N.beforeTechnique), 1, "The completed paid action must apply the cue reward exactly once");

      // Actual state-slot restoration, followed by a fresh line (not per-line VN resume).
      for (const [key, name] of [["suien_remake_slot1", "???"], ["suien_remake_slot2", "はじめ"], ["suien_remake_slot1", "???"]]) {
        const restored = await page.evaluate(key => {
          V.core.newGame();
          const actual = N.copy(V.core.loadFromSlot(key));
          N.scene = V.engine.play({ dialogue_id: "name-slot-check", lines: [
            { speaker: "", text: "保存を読み直した。" },
            { type: "choice", choices: [{ text: "閉じる" }] },
          ] });
          return { actual, expected: N.saved[key] };
        }, key);
        assert.deepEqual(restored.actual, restored.expected);
        await expectNameLine(page, { speaker: "", text: "保存を読み直した。", name });
        await page.keyboard.press("Enter");
        await page.locator('[data-test="choice-0"]').click();
        await page.evaluate(() => N.scene);
      }
    } finally {
      await page.evaluate(() => {
        if (!window.N) return;
        N.SE.blip = N.originalBlip;
        V.data.DB.dialogues.ch1_cold_open = N.originalColdOpen;
      }).catch(() => {});
    }
  });

  await check("protagonist-name-touch-skip-and-auto", async page => {
    await prepare(page);
    await page.evaluate(() => {
      V.engine.backlog().length = 0;
      window.nameScene = V.engine.play({ dialogue_id: "name-skip-check", lines: [
        { speaker: "", text: "名乗る前。" },
        { speaker: "hazime", text: "（まだ名前は伏せる）" },
        { type: "intro", char_id: "hajime" },
        { speaker: "", text: "名乗った後。" },
        { type: "choice", choices: [{ text: "続ける" }] },
      ] });
    });
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "名乗る前。");
    assert.equal(await page.locator(".vn-name.show").textContent(), "???");
    await page.locator('[data-test="vn-skip"]').tap();
    await page.locator('.cutin.in[data-char="hajime"]').waitFor({ timeout: 20000 });
    await page.locator('[data-test="choice-0"]').waitFor({ timeout: 20000 });
    assert.deepEqual(await page.evaluate(() => V.engine.backlog()), [
      { name: "???", text: "名乗る前。" },
      { name: "???", text: "（まだ名前は伏せる）" },
      { name: "はじめ", text: "名乗った後。" },
    ]);
    assert.equal(await page.evaluate(() => V.engine.isPlaying()), true, "SKIP answered a choice");
    await assertNameFits(page, "known-name-touch");
    await assertFits(page, ".vn-text");
    assert.equal(await page.locator('.vn-portraits [data-speaker="hajime"], .vn-portraits [data-speaker="hazime"]').count(), 0);
    await page.locator('[data-test="choice-0"]').tap();
    await page.evaluate(() => window.nameScene);
    assert.equal(await page.locator("body.vn-skip").count(), 0);

    await page.evaluate(() => {
      V.engine.backlog().length = 0;
      window.nameScene = V.engine.play({ dialogue_id: "name-auto-check", lines: [
        { speaker: "", text: "煙。" },
        { speaker: "hajime", text: "（……）" },
        { type: "choice", choices: [{ text: "閉じる" }] },
      ] });
    });
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "煙。");
    await page.locator('[data-test="vn-auto"]').tap();
    await page.locator('[data-test="choice-0"]').waitFor();
    assert.deepEqual(await page.evaluate(() => V.engine.backlog()), [
      { name: "はじめ", text: "煙。" }, { name: "はじめ", text: "（……）" },
    ]);
    assert.equal(await page.evaluate(() => V.engine.isPlaying()), true, "AUTO answered a choice");
    assert.equal(await page.locator('[data-test="vn-auto"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator('[data-test="vn-skip"]').getAttribute("aria-pressed"), "false");
    await page.locator('[data-test="vn-auto"]').tap();
    await page.locator('[data-test="choice-0"]').tap();
    await page.evaluate(() => window.nameScene);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  for (const [label, viewport] of [["portrait-pc", { width: 1280, height: 720 }], ["portrait-mobile", { width: 844, height: 390 }]]) {
    await check(label, async page => {
      await prepare(page);
      await page.route("**/chr_sumi_smile.webp", async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });
      await page.evaluate(() => {
        window.scene = V.engine.play({ dialogue_id: "slow-expression", lines: [
          { speaker: "sumi", face: "normal", text: "最初の台詞。" },
          { speaker: "adam", face: "normal", text: "次の台詞。" },
          { speaker: "sumi", face: "smile", text: "読み込んでから笑顔を見せる。" },
          { type: "choice", choices: [{ text: "続ける" }] },
        ] });
      });
      await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "最初の台詞。");
      await page.locator('[data-test="vn-skip"]').click();
      await page.waitForTimeout(180);
      assert.notEqual(await page.locator(".vn-text").textContent(), "読み込んでから笑顔を見せる。", "SKIP reached the delayed expression before it loaded");
      assert.equal(await page.locator('.portrait[data-speaker="sumi"]').evaluate(img => img.complete && img.naturalWidth > 0), true, "The previous portrait disappeared while loading");
      await page.locator('[data-test="choice-0"]').waitFor();
      assert.equal(await page.locator('.portrait[data-speaker="sumi"]').evaluate(img => img.complete && img.naturalWidth > 0 && img.src.endsWith("chr_sumi_smile.webp")), true);
      await page.locator('[data-test="choice-0"]').click();
      await page.evaluate(() => window.scene);
      assert.equal(await page.locator("body.vn-skip").count(), 0, "SKIP remained active after the scene");
    }, { viewport });
  }

  await check("cg-fade-and-choice", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      await V.ui.imageReady(V.data.cgUrl("cg_ch1_sumi_training"), 15000);
      window.audit = { maximum: 0, choiceDuringFade: false, stop: false };
      const sample = () => {
        if (audit.stop) return;
        const cg = document.querySelector(".vn-cg"), opacity = Number(getComputedStyle(cg).opacity);
        if (cg.classList.contains("show")) audit.maximum = Math.max(audit.maximum, opacity);
        if (document.querySelector(".vn-choice") && opacity > .01) audit.choiceDuringFade = true;
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      window.scene = V.engine.play({ dialogue_id: "cg-fade", lines: [
        { speaker: "sumi", text: "写真を見る。" },
        { type: "show_cg", cg_id: "cg_ch1_sumi_training" },
        { speaker: "sumi", text: "写真の後の台詞。" },
        { type: "hide_cg" },
        { type: "choice", choices: [{ text: "続ける" }] },
      ] });
    });
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "写真を見る。");
    await page.locator('[data-test="vn-skip"]').click();
    await page.locator('[data-test="choice-0"]').waitFor();
    await page.waitForTimeout(20);
    const audit = await page.evaluate(() => { audit.stop = true; return window.audit; });
    assert.ok(audit.maximum >= .95, `CG was hidden before the fade completed (${audit.maximum})`);
    assert.equal(audit.choiceDuringFade, false, "Choices appeared during the CG fade-out");
    await page.locator('[data-test="choice-0"]').click();
    await page.evaluate(() => window.scene);
  });

  await check("skip-curtain", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      await V.ui.imageReady(V.data.bgUrl("bg_home"), 15000);
      window.audit = { started: null, ended: null, overlap: false, stop: false };
      const sample = () => {
        if (audit.stop) return;
        const curtain = document.querySelector(".scene-curtain");
        if (curtain) { audit.started ??= performance.now(); if (document.querySelector(".vn-choice")) audit.overlap = true; }
        else if (audit.started !== null) audit.ended ??= performance.now();
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      window.scene = V.engine.play({ dialogue_id: "skip-curtain", lines: [
        { speaker: "sumi", text: "家へ帰る。" },
        { type: "bg", bg: "bg_home" },
        { type: "choice", choices: [{ text: "休む" }] },
      ] });
    });
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "家へ帰る。");
    await page.locator('[data-test="vn-skip"]').click();
    await page.locator('[data-test="choice-0"]').waitFor();
    await page.waitForFunction(() => audit.ended !== null);
    const audit = await page.evaluate(() => { audit.stop = true; return window.audit; });
    assert.ok(audit.ended - audit.started >= 250, `The scene curtain was too abrupt (${audit.ended - audit.started}ms)`);
    assert.equal(audit.overlap, false);
    await page.locator('[data-test="choice-0"]').click();
    await page.evaluate(() => window.scene);
  });
});
