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
    // toggle イベントはクリックの後で非同期に届くので、inert 解除を待ってから確かめる。
    await page.waitForFunction(() => !document.querySelector(".bench-panel").inert);
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

  await check("first-order-ingredients-fit-after-closing-the-guide", async page => {
    await init(page);
    await page.evaluate(async () => {
      const { configureFirstBrew } = await import("./js/chapters/first-brew.js");
      window.cs = configureFirstBrew(T.session.newSession("tutorial"));
      await T.open(cs);
      window.mixing = T.steps.stepMix(cs);
    });
    await page.locator('[data-test="bench-guide-close"]').tap();
    const mint = page.locator('[data-test="mix-plus-mint"]');
    await mint.waitFor();
    const list = page.locator(".mix-list");
    const controls = await list.evaluate(node => {
      const clip = node.getBoundingClientRect();
      return Array.from(node.querySelectorAll(".fr-btn"), button => {
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return {
          id: button.dataset.test,
          fits: box.top >= clip.top && box.bottom <= clip.bottom && box.height >= 43.9,
          reachable: button === hit || button.contains(hit),
        };
      });
    });
    assert.equal(controls.length, 6);
    assert(controls.every(button => button.fits && button.reachable), JSON.stringify(controls));
    await mint.tap();
    assert.equal(await page.evaluate(() => cs.mix.mint), 1);
    assert.equal(await list.evaluate(node => node.scrollTop), 0);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
}, { stepIntro: true });
