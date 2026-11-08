// 選ぶ工程の初回説明（#3028「説明の次にボタン」）: 初回は説明が先に出て閉じるまで操作できず、
// 既読が残るので2回目は直接操作できる。support.mjs の stepIntro オプションでこのスイートだけ案内を出す。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function init(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    window.T = { core,
      session: await import("./js/craft/session.js"),
      steps: await import("./js/craft/steps.js"),
      practice: await import("./js/craft/practice.js"),
    };
    T.open = async (cs) => {
      const b = T.session.openBench(cs, { steps: T.practice.CRAFT_STEPS });
      while (!b.root.isConnected) await new Promise(requestAnimationFrame);
      await T.session.waitBenchReady(cs);
    };
  });
}

await suite("step-intro", async check => {
  await check("mix-intro-first-time-only", async page => {
    await init(page);
    await page.evaluate(async () => {
      window.cs = T.session.newSession("drill");
      await T.open(cs);
      window.mixing = T.steps.stepMix(cs);
    });
    // 初回は説明（配合の案内）が開き、読み終わるまでパネルは操作できない。
    await page.locator(".bench-guide[open]").waitFor();
    assert.equal(await page.evaluate(() => document.querySelector(".bench-panel").inert), true);
    assert.match(await page.locator(".bench-guide-tip p").innerText(), /配合/);
    await page.locator('[data-test="bench-guide-close"]').click();
    assert.equal(await page.evaluate(() => document.querySelector(".bench-panel").inert), false);
    // 閉じたあとは通常どおり配合を決められる。
    const plus = page.locator('[data-test^="mix-plus-"]').first();
    for (let i = 0; i < 12; i++) await plus.click();
    await page.locator('[data-test="mix-ok"]').click();
    await page.evaluate(() => window.mixing);
    assert.equal(await page.evaluate(() => Object.values(cs.mix).reduce((a, b) => a + b, 0)), 12);
    assert.equal(await page.evaluate(() => !!T.core.state.flags.seenStepIntro?.mix), true);

    // 同じセーブの2台目は、説明なしで直接操作できる。
    await page.evaluate(async () => {
      window.cs2 = T.session.newSession("drill");
      await T.open(cs2);
      window.mixing2 = T.steps.stepMix(cs2);
    });
    await page.locator('[data-test^="mix-plus-"]').first().waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.querySelector(".bench-guide").open), false);
    assert.equal(await page.evaluate(() => document.querySelector(".bench-panel").inert), false);
  });
}, { stepIntro: true });
