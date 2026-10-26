import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("story-assist-rules", async check => {
  await check("settings-keep-choices-and-tutorial", async page => {
    await page.locator('[data-test="title-config"]').click();
    await page.locator('[data-test="craft-assist-select"]').selectOption("auto");
    await page.locator('.modal-actions button').click();
    await page.reload();
    await page.locator('[data-test="title-new"]').waitFor();
    const result = await page.evaluate(async () => {
      const state = await import('./js/core/state.js');
      const craft = await import('./js/craft/common.js');
      state.newGame();
      const repeat = { mode: 'practice', condition: { slow: 1, window: 1, focus: 1 } };
      const tutorial = { ...repeat, mode: 'tutorial' };
      const values = { configured: state.config.craftAssist, repeated: craft.operationAuto(repeat), tutorial: craft.operationAuto(tutorial),
        selection: craft.autoSkill(), slow: craft.skill.slow(repeat), window: craft.skill.window(repeat) };
      state.config.craftAssist = 'normal';
      values.normalSlow = craft.skill.slow(repeat);
      values.normalWindow = craft.skill.window(repeat);
      return values;
    });
    assert.equal(result.configured, 'auto');
    assert.equal(result.repeated, 'good');
    assert.equal(result.tutorial, null);
    assert.equal(result.selection, null);
    assert(result.slow > result.normalSlow && result.window > result.normalWindow);
  });

  await check("rules-follow-current-and-legacy-challenges", async page => {
    const rules = await page.evaluate(async () => {
      const core = await import('./js/core/state.js');
      const { ruleSheetPanel } = await import('./js/scenes/rule-sheet.js');
      const s = core.newGame();
      const first = ruleSheetPanel(1).textContent;
      s.flags._legacy_mint_tournament = true;
      const legacy = ruleSheetPanel(1).textContent;
      delete s.flags._legacy_mint_tournament;
      s.chapter = 2;
      const second = ruleSheetPanel(2).textContent;
      s.chapter = 3;
      const third = ruleSheetPanel(3).textContent;
      return { first, legacy, second, third };
    });
    assert.match(rules.first, /レモン.*2g以上.*私物/);
    assert.match(rules.legacy, /ミント2g以上/);
    assert.match(rules.second, /ストロベリー.*主催者が用意/);
    assert.match(rules.third, /前夜に決めた一台/);
    assert(!/スコア|票|持ち点/.test(rules.first));
    await page.evaluate(async () => { const s = await import('./js/core/state.js'); s.state.chapter = 1;
      void (await import('./js/scenes/rule-sheet.js')).openRuleSheet(); });
    await page.locator('[data-test="rule-sheet"]').waitFor();
    assert.match(await page.locator('[data-test="rule-sheet"]').innerText(), /レモン.*2g以上/);
    assert.equal(await page.locator('[data-test="rule-sheet"]').evaluate(n => n.getBoundingClientRect().bottom <= n.closest('.modal-body').getBoundingClientRect().bottom + 1), true);
    await page.locator('[data-test="rule-sheet-close"]').click();
  });
});
