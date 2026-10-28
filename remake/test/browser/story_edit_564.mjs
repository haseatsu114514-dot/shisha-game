import assert from 'node:assert/strict';
import { suite } from './support.mjs';

async function setup(page) {
  await page.evaluate(async () => {
    window.E = { core: await import('./js/core/state.js'), vn: await import('./js/vn/engine.js'),
      rig: await import('./js/daily/home-rig.js'), lines: [] };
    E.core.newGame();
    E.vn.vnTest.turbo = true;
    E.vn.vnTest.choose = () => 0;
    E.vn.hooks.onLine = (id, line) => E.lines.push(line.text);
  });
}
await suite('story-edit-564', async check => {
  await check('gift-dialogue-reload-and-legacy-branch', async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      E.core.state.flavorStock.double_apple = 25;
      const first = await E.rig.giveSumiRig();
      const stock = structuredClone(E.core.state.flavorStock);
      const firstFlag = E.core.state.flags._sumi_double_apple_received;
      E.core.load();
      const second = await E.rig.giveSumiRig();
      const stockAfterReload = structuredClone(E.core.state.flavorStock);
      const giftLines = [...E.lines]; E.lines.length = 0;
      E.core.newGame(); E.core.state.schema = 18;
      E.core.state.flavorStock.double_apple = 0;
      E.core.save(); E.core.load();
      const legacyFlag = E.core.state.flags._sumi_double_apple_received;
      const legacyGiven = await E.rig.giveSumiRig();
      return { first, second, stock, stockAfterReload, firstFlag, giftLines,
        legacyGiven, legacyFlag, legacyLines:E.lines,
        legacyStock: E.core.state.flavorStock.double_apple };
    });
    // Current spec (#1081 D02; owner decision 2026-10-29): only the rig is
    // gifted. The scene sends the player to their own stock on both branches
    // ("手持ちを使え") and no double_apple is ever added.
    assert(result.first); assert.equal(result.second, false);
    assert.equal(result.stock.double_apple, 25, 'gift adds no leaves: stock is preserved');
    assert.equal(result.stockAfterReload.double_apple, 25, 'reload neither grants nor restores leaves');
    assert.equal(result.firstFlag, undefined, 'current schema never sets the receipt flag');
    assert(!result.giftLines.some(text => text?.includes('一箱やる')));
    assert(result.giftLines.some(text => text?.includes('手持ちを使え')));
    assert.equal(result.legacyFlag, true, 'schema <19 load migrates the receipt flag');
    assert(result.legacyGiven);
    assert(!result.legacyLines.some(text => text?.includes('一箱やる')));
    assert(result.legacyLines.some(text => text?.includes('手持ちを使え')));
    assert.equal(result.legacyStock, 0);
  });
  await check('switching-save-during-gift-does-not-grant', async page => {
    await setup(page);
    await page.evaluate(() => {
      E.vn.hooks.onLine = () => {
        if (!E.switched) { E.switched = true; E.core.newGame(); }
      };
    });
    const result = await page.evaluate(async () => ({ given: await E.rig.giveSumiRig(),
      stock: E.core.state.flavorStock, owned: E.core.state.owned,
      received: !!E.core.state.flags._sumi_double_apple_received }));
    assert.equal(result.given, false); assert.deepEqual(result.stock, {});
    assert(!result.owned.includes('home_rig_set')); assert(!result.received);
  });
  for (const [device, options] of [['pc', {}], ['touch', { viewport:{width:844,height:390}, isMobile:true, hasTouch:true }]]) {
    await check(`${device}-customer-entry-tsumugi-portrait`, async page => {
      await setup(page);
      await page.evaluate(() => {
        E.controller = new AbortController(); E.done = false;
        E.vn.hooks.onLine = (id, line) => {
          E.lines.push(line.text);
          if (line.text?.includes('頭を下げた')) { E.vn.vnTest.turbo = false; E.paused = true; }
        };
        E.vn.play('ch1_tsumugi_first', { signal:E.controller.signal }).then(() => E.done = true);
      });
      await page.waitForFunction(() => E.paused);
      await page.locator('.vn-portraits img[data-speaker="tsumugi"]').waitFor();
      assert.equal(await page.locator('.vn-portraits img[data-speaker="sumi"]').count(), 0);
      const lines = await page.evaluate(() => E.lines);
      assert(lines.some(text => text?.includes('スミさんが用意した')));
      assert(!lines.some(text => text?.includes('作ってきます') || text?.includes('バイトの合間')));
      await page.waitForFunction(() => document.querySelector('.vn-text')?.textContent.includes('頭を下げた'));
      // Let suite capture the actual paused portrait before context teardown.
    }, options);
  }
});
