import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), vn = await import("./js/vn/engine.js");
    const chapter = await import("./js/chapters/ch1.js");
    const story = await import("./js/chapters/tsumugi-story.js");
    const ui = await import("./js/core/ui.js");
    const s = core.newGame(); s.day = 11; s.slot = 2;
    s.met.tsumugi = s.met.sumi = true;
    Object.assign(s.flags, { _intro_tsumugi: true, _intro_sumi: true, _tsumugi_contest_research: true,
      _tsumugi_contest_progress: true, _lime_contact_tsumugi: true });
    core.config.textSpeed = 4; vn.vnTest.turbo = false;
    ui.clearScreen(); chapter.setupHooks();
    window.T = { core, vn, chapter, story, done: false, cgs: [], motionStarts: [] };
    const onCg = vn.hooks.onCg;
    vn.hooks.onCg = id => { T.cgs.push(id); onCg?.(id); };
    new MutationObserver(() => {
      if (document.querySelector(".mo-sketch") && !T.motionStarts.length)
        T.motionStarts.push(vn.backlog().map(l => l.text));
    }).observe(document.getElementById("fx"), { childList: true });
    T.task = story.playTsumugiStory(11, { sketch: () => story.playTsumugiSketch("ch1_tsumugi_sketch",
      "res://assets/backgrounds/bg_tonari_inside_night.png") }).then(() => { T.done = true; });
  });
}

await suite("tsumugi-sketch-timing", async check => {
  for (const mode of ["normal", "skip", "auto", "reduced", "load"]) {
    await check(mode, async page => {
      await setup(page);
      await page.waitForFunction(() => document.querySelector(".vn-next.show"));
      assert.equal(await page.locator(".mo-sketch").count(), 0, "no drawing before the introduction");
      if (mode === "skip") await page.locator(".vn-controls button").filter({ hasText: "SKIP" }).click();
      const auto = page.locator('[data-test="vn-auto"]');
      if (mode === "auto") {
        await auto.click();
        assert.equal(await auto.getAttribute("aria-pressed"), "true");
        // #1846: ボタンにフォーカスしたままEnterを押すとAUTOを操作する。
        await auto.evaluate(button => button.blur());
      }
      for (let i = 0; i < 180; i++) {
        if (await page.evaluate(() => T.done)) break;
        if (await page.locator(".mo-sketch").count()) {
          if (mode === "load") {
            await page.evaluate(() => { T.core.newGame(); T.core.state.chapter = 2; });
          } else {
            // 連打でも本編・応募処理が演出の裏で進まない。
            await page.keyboard.press("Enter");
            await page.locator(".mo-sketch").click({ force: true });
            assert.equal(await page.evaluate(() => !!T.core.state.flags._tsumugi_contest_submitted), false);
          }
          await page.locator(".mo-sketch").waitFor({ state: "detached", timeout: 15000 });
          if (mode === "auto") {
            await auto.click();
            assert.equal(await auto.getAttribute("aria-pressed"), "false");
            await auto.evaluate(button => button.blur());
          }
        } else if (!["skip", "auto"].includes(mode) || await page.evaluate(() => T.motionStarts.length > 0)) {
          await page.keyboard.press("Enter");
        }
        await page.waitForTimeout(100);
      }
      await page.waitForFunction(() => T.done, null, { timeout: 15000 });
      const result = await page.evaluate(() => ({ starts: T.motionStarts, cgs: T.cgs,
        submitted: !!T.core.state.flags._tsumugi_contest_submitted,
        lines: T.vn.backlog().map(l => l.text) }));
      assert.equal(await page.locator("[data-sketch-still], .mo-sketch").count(), 0);
      assert.equal(result.submitted, mode !== "load");
      assert.equal(result.cgs.length, mode === "load" ? 0 : 1);
      assert.equal(result.starts.length, mode === "reduced" ? 0 : 1);
      if (result.starts.length) assert(result.starts[0].includes("……できました。応募する絵"));
      if (mode !== "load") assert.equal(result.lines.filter(t => t === "「応募完了」。短い文字を、２人で確かめた。").length, 1);
    }, { reducedMotion: mode === "reduced" ? "reduce" : "no-preference" });
  }
});
