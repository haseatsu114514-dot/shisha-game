import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js"), vn = await import("./js/vn/engine.js");
    const intro = await import("./js/vn/intro.js");
    core.newGame();
    Object.assign(core.config, { textSpeed: 4, autoSpeed: 3, skipSeenOnly: false,
      bgmVolume: 0, seVolume: 0, voiceBlip: false });
    for (const id of ["sumi", "adam"]) { core.markMet(id); intro.markIntroSeen(id); }
    ui.clearScreen(); vn.vnTest.turbo = false;
    await ui.setBg(data.bgUrl("bg_tonari_inside"), { instant: true });
    await Promise.all(["sumi", "adam"].map(id => ui.imageReady(data.portraitInfo(id, "normal").src, 15000)));
    window.atomic = { core, vn, ui, names: { sumi: data.displayName("sumi"), adam: data.displayName("adam") } };
    const native = Element.prototype.getAnimations;
    const gate = new Promise(resolve => { atomic.release = resolve; });
    Element.prototype.getAnimations = function (...args) {
      const animations = native.apply(this, args);
      if (this.matches('.portrait[data-speaker="adam"]')) {
        atomic.entranceWaiting = true;
        return [...animations, { finished: gate }];
      }
      return animations;
    };
    atomic.controller = new AbortController();
    atomic.scene = vn.play({ dialogue_id: "atomic-2190", lines: [
      { speaker: "sumi", text: "前の本文。" }, { speaker: "adam", text: "次の本文。" },
      { type: "choice", choices: [{ text: "終える" }] },
    ] }, { signal: atomic.controller.signal });
  });
  await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "前の本文。"
    && document.querySelector(".vn-next.show"));
  await page.evaluate(() => {
    atomic.samples = [];
    atomic.observer = new MutationObserver(() => {
      atomic.samples.push({ name: document.querySelector(".vn-name.show")?.textContent || "",
        text: document.querySelector(".vn-text")?.textContent || "" });
    });
    atomic.observer.observe(document.querySelector("#vn"), { subtree: true, childList: true, attributes: true, characterData: true });
  });
}

await suite("vn-speaker-atomic-2190", async check => {
  for (const mode of ["manual", "auto", "skip"]) {
    await check(`entry-wait-${mode}`, async page => {
      await prepare(page);
      if (mode === "manual") await page.locator(".vn-box").click();
      else await page.locator(`[data-test="vn-${mode}"]`).click();
      await page.waitForFunction(() => atomic.entranceWaiting);
      if (mode === "manual") await page.evaluate(() => {
        for (let i = 0; i < 10; i++) document.querySelector(".vn-box").dispatchEvent(
          new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
      });
      const waiting = await page.evaluate(() => ({ name: document.querySelector(".vn-name.show")?.textContent,
        text: document.querySelector(".vn-text").textContent, oldName: atomic.names.sumi }));
      assert.equal(waiting.name, waiting.oldName, "入場待ちは旧本文に旧名札をそろえる");
      assert.equal(waiting.text, "前の本文。");
      await page.evaluate(() => atomic.release());
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "次の本文。");
      assert.equal(await page.locator(".vn-name.show").textContent(), await page.evaluate(() => atomic.names.adam));
      if (mode === "manual") await page.locator(".vn-box").click();
      await page.locator('[data-test="choice-0"]').waitFor();
      const mixed = await page.evaluate(() => {
        atomic.observer.disconnect();
        return atomic.samples.filter(s => (s.text === "前の本文。" && s.name !== atomic.names.sumi)
          || (s.text === "次の本文。" && s.name !== atomic.names.adam));
      });
      assert.deepEqual(mixed, [], "全観測点で本文と名札の組が一致する");
      await page.locator('[data-test="choice-0"]').click();
      assert.equal((await page.evaluate(() => atomic.scene)).cancelled, undefined);
    }, { viewport: { width: 1180, height: 740 } });
  }
  await check("LOAD-and-abort-during-entry", async page => {
    await prepare(page);
    await page.locator(".vn-box").click();
    await page.waitForFunction(() => atomic.entranceWaiting);
    const outcome = await page.evaluate(async () => {
      atomic.core.save(); atomic.core.load();
      const loaded = atomic.core.state;
      atomic.controller.abort();
      const result = await atomic.scene;
      atomic.next = atomic.vn.play({ dialogue_id: "after-load", lines: [{ speaker: "sumi", text: "ロード先の本文。" }] });
      atomic.release();
      return { result, same: atomic.core.state === loaded };
    });
    assert.equal(outcome.result.cancelled, true); assert.equal(outcome.same, true);
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "ロード先の本文。");
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator(".vn-name.show").textContent(), await page.evaluate(() => atomic.names.sumi));
    assert.equal(await page.locator(".vn-text").textContent(), "ロード先の本文。");
    await page.locator(".vn-box").click(); await page.evaluate(() => atomic.next);
  }, { viewport: { width: 1180, height: 740 } });
  await check("hidden-reward-before-turbo-choice", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      atomic.controller.abort(); await atomic.scene;
      atomic.vn.vnTest.turbo = true; atomic.vn.vnTest.choose = () => 0;
      atomic.vn.play({ dialogue_id: "hidden-reward-choice", lines: [
        { text: "……【技術】が少し上がった。" },
        { type: "choice", choices: [{ text: "進む" }] },
        { text: "選択のあと。" },
      ] }).then(result => { atomic.rewardResult = result; });
    });
    await page.waitForFunction(() => atomic.rewardResult);
    assert.equal((await page.evaluate(() => atomic.rewardResult)).cancelled, undefined);
    assert.equal(await page.locator("#vn.active").count(), 0);
  }, { viewport: { width: 1180, height: 740 } });
});
