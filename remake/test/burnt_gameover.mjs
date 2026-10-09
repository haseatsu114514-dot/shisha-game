// 温度計の一番上で爆発して焦げる（TH06）: 大会はその場でGAME OVER→大会の頭から再挑戦。
// レッスンはスミさんが詰め直して吸い出しからやり直し、前日リハーサルは専用の短い場面で終わる（ゲームは続く）。
// NODE_PATH=... [CHROME_EXECUTABLE_PATH=...] node remake/test/burnt_gameover.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const errors = [];
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
async function open() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', async () => {
      const { hooks } = await import('./js/vn/engine.js');
      window.__seen = [];
      const previous = hooks.onLine;
      hooks.onLine = (id, line) => { previous?.(id, line); if (window.__seen.at(-1) !== id) window.__seen.push(id); };
    });
  });
  await page.goto(BASE);
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(() => { localStorage.clear(); window.__remake.vnTest.turbo = true; });
  return page;
}
try {
  // 大会: 焦がした時点で審査へ進まずGAME OVER。再挑戦で大会の頭に戻る。
  let page = await open();
  await page.evaluate(() => { window.__remake.craftTest.auto = 'burn'; window.__run = window.__remake.dev.tournament(); });
  await page.waitForSelector('.bench[data-thermal-band="burnt"]', { timeout: 240000 });
  await page.waitForSelector('.end-screen.gameover', { timeout: 60000 });
  assert.match(await page.locator('.end-screen.gameover .end-sub').textContent(), /シーシャが焦げてしまった/);
  assert.equal(await page.locator('.end-screen.gameover .end-question').textContent(), '再挑戦しますか？');
  assert.equal(await page.locator('[data-test="game-over"]').getAttribute('data-reason'), 'burnt');
  const seen = await page.evaluate(() => window.__seen);
  assert(!seen.includes('remake_trial_intro') && !seen.includes('ch1_tournament_defeat'), `burnt run reached judging: ${seen.join(',')}`);
  assert.equal(await page.evaluate(() => window.__remake.state.tournament.lastRank), null);
  await page.evaluate(() => { window.__remake.craftTest.auto = 'good'; });
  await page.locator('[data-test="retry"]').click();
  await page.waitForFunction(() => window.__remake.state.tournament.attempts === 2, null, { timeout: 30000 });
  console.log('PASS: tournament burn → immediate GAME OVER (no judging) → retry from the tournament start');
  await page.close();

  // レッスン: 焦がしたらスミさんが詰め直し、吸い出しからやり直して最後まで終わる。
  page = await open();
  await page.evaluate(async () => {
    const { newGame } = await import('./js/core/state.js'); newGame();
    const ch1 = await import('./js/chapters/ch1.js');
    window.__remake.craftTest.auto = 'burn';
    window.__run = ch1.devTutorial();
  });
  await page.waitForSelector('.bench[data-thermal-band="burnt"]', { timeout: 120000 });
  await page.evaluate(() => { window.__remake.craftTest.auto = 'good'; });
  await page.waitForFunction(() => window.__remake.state.flags._tutorial_done && window.__seen.includes('remake_tutorial_result'), null, { timeout: 120000 });
  const lesson = await page.evaluate(() => window.__seen);
  assert(lesson.indexOf('remake_tutorial_burnt') >= 0 && lesson.indexOf('remake_tutorial_burnt') < lesson.indexOf('remake_tutorial_result'), `lesson order: ${lesson.join(',')}`);
  console.log('PASS: lesson burn → Sumi repacks → pull again → lesson result');
  await page.close();

  // 前日リハーサル: 焦がした通しは専用の場面で終わり、手応えは rough。
  page = await open();
  await page.evaluate(async () => {
    const { newGame } = await import('./js/core/state.js'); newGame();
    const ch1 = await import('./js/chapters/ch1.js');
    window.__remake.craftTest.auto = 'burn';
    window.__run = ch1.devRehearsal().then(() => { window.__done = true; });
  });
  await page.waitForFunction(() => window.__done, null, { timeout: 180000 });
  const rehearsal = await page.evaluate(() => ({ seen: window.__seen, result: window.__remake.state.rehearsal }));
  assert(rehearsal.seen.includes('remake_rehearsal_burnt') && !rehearsal.seen.includes('remake_rehearsal_rough'), rehearsal.seen.join(','));
  assert.equal(rehearsal.result, 'rough');
  console.log('PASS: rehearsal burn → its own short scene, rough result, game continues');
  assert.deepEqual(errors, []);
  console.log('PASS: page errors 0');
} finally { await browser.close(); }
