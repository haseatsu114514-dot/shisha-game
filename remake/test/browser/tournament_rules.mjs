import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("tournament-rules", async check => {
  await check("rules-follow-current-and-legacy-challenges", async page => {
    const rules = await page.evaluate(async () => {
      const core = await import('./js/core/state.js');
      const { ruleSheetPanel } = await import('./js/scenes/rule-sheet.js');
      const s = core.newGame();
      const first = ruleSheetPanel(1).textContent;
      s.flags._legacy_mint_tournament = true;
      const legacy = ruleSheetPanel(1).textContent;
      delete s.flags._legacy_mint_tournament;
      s.phase = 'tournament';
      s.tournament.rulesVersion = 1;
      const legacyJudging = ruleSheetPanel(1).textContent;
      s.phase = 'daily';
      s.chapter = 2;
      const second = ruleSheetPanel(2).textContent;
      s.chapter = 3;
      const third = ruleSheetPanel(3).textContent;
      return { first, legacy, legacyJudging, second, third };
    });
    assert.match(rules.first, /レモン.*2g以上.*大会支給/);
    // 課題フレーバーは全章で大会が支給（無制限）。事前の練習が有利なことも短く伝える。
    assert.match(rules.first, /課題の葉は大会が用意.*好きなだけ使える/);
    assert.match(rules.first, /練習した葉ほど/);
    assert.match(rules.legacy, /ミント2g以上/);
    assert.match(rules.legacyJudging, /一台の総合点で順位を決める/);
    assert.doesNotMatch(rules.legacyJudging, /2・3・2・3点/);
    assert.match(rules.second, /ストロベリー.*4g以上/s);
    assert.match(rules.second, /課題の葉は大会が用意/);
    assert.match(rules.third, /ドバジ チョコレート.*4g以上.*大会支給/s);
    assert(!/私物持ち込み/.test(rules.third), "No brought-in wording once the challenge leaf is supplied");
    assert.match(rules.first, /審査員3人が各10点.*2・3・2・3点.*2位に1点.*その回までに仕上げた工程/);
    assert.doesNotMatch(rules.second + rules.third, /2・3・2・3点/);
    const open = () => page.evaluate(async () => { const s = await import('./js/core/state.js'); s.state.chapter = 1;
      void (await import('./js/scenes/rule-sheet.js')).openRuleSheet(); });
    await open();
    await page.locator('[data-test="rule-sheet"]').waitFor();
    assert.match(await page.locator('[data-test="rule-sheet"]').innerText(), /レモン.*2g以上/);
    assert.equal(await page.locator('[data-test="rule-sheet"]').evaluate(n => n.getBoundingClientRect().bottom <= n.closest('.modal-body').getBoundingClientRect().bottom + 1), true);
    await page.locator('[data-test="rule-sheet-close"]').click();

    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('html[data-density="phone"]').waitFor();
    await open();
    await page.waitForFunction(() => !document.querySelector('.rule-sheet-modal')?.getAnimations().some(animation => animation.playState === 'running'));
    const judging = page.locator('[data-test="rule-sheet"] .rule-article p').last();
    const fontPx = await judging.evaluate(p => parseFloat(getComputedStyle(p).fontSize) * p.getBoundingClientRect().width / p.offsetWidth);
    assert(fontPx >= 13.9, `Scoring details should be readable in landscape: ${fontPx}px`);
    await judging.scrollIntoViewIfNeeded();
    await page.locator('[data-test="rule-sheet-close"]').click();
  });
});
