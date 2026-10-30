// 温度計の一番上で爆発して焦げる（TH06）: 大会はその場でGAME OVER→大会の頭から再挑戦。
// レッスンはスミさんが詰め直して吸い出しからやり直し、前日リハーサルは専用の短い場面で終わる（ゲームは続く）。
// NODE_PATH=... [CHROME_EXECUTABLE_PATH=...] node remake/test/burnt_gameover.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { installLoadingComicReader } from './browser/loading_reader.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const errors = [];
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
async function open() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(e.message));
  // 作業台に入るロード画面は、漫画が出ると準備完了後にタップ待ちになる。プレイヤーと同じく読んで進む。
  await installLoadingComicReader(page);
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
  // 初回の実画面ではカウント後も選択可能で、諦めたらタイトルへ戻る。
  let page = await open();
  await page.clock.install();
  // 兄弟スイート（continue_keyboard 等）と同じく時計を止める。performance.now は
  // 実時間でも流れるため、止めないと20秒判定が実行速度に依存して 'speaking' で揺れる。
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.evaluate(() => window.__remake.dev.gameOver('rank', 0));
  await page.clock.runFor(1000);
  assert.equal(await page.locator('.go-title').textContent(), 'コンティニューする？');
  await page.clock.runFor(19050);
  assert.equal(await page.locator('.gameover').getAttribute('data-phase'), 'speaking');
  assert.equal(await page.locator('.go-count').textContent(), '∞');
  await page.locator('[data-test="game-over-title"]').click();
  await page.clock.runFor(3000);
  await page.waitForSelector('[data-test="title-new"]');
  console.log('PASS: first continue screen → no timeout → voluntary quit → title');
  await page.close();

  // 大会: 焦がした時点で審査へ進まずGAME OVER。再挑戦で大会の頭に戻る。
  page = await open();
  await page.evaluate(() => { window.__remake.craftTest.auto = 'burn'; window.__run = window.__remake.dev.tournament(); });
  await page.waitForSelector('.bench[data-thermal-band="burnt"]', { timeout: 240000 });
  await page.waitForSelector('.end-screen.gameover', { timeout: 60000 });
  assert.equal(await page.locator('.end-screen.gameover .go-title').textContent(), 'コンティニューする？');
  assert.equal(await page.locator('.end-screen.gameover img[src*="bg_game_over"]').count(), 0, 'GAME OVER is drawn without an image');
  assert.equal(await page.locator('.end-screen.gameover .go-sumi-img').count(), 1, 'Sumi uses the canon portrait');
  assert.equal(await page.locator('[data-test="continue-caption"]').count(), 1);
  assert.equal(await page.locator('[data-test="continue-next"]').count(), 1);
  assert.equal(await page.locator('[data-test="continue-voice"]').count(), 0, 'speech must be disabled by default');
  assert.equal(await page.locator('[data-test="game-over"]').getAttribute('data-reason'), 'burnt');
  const seen = await page.evaluate(() => window.__seen);
  assert(!seen.includes('remake_trial_intro') && !seen.includes('ch1_tournament_defeat'), `burnt run reached judging: ${seen.join(',')}`);
  assert.equal(await page.evaluate(() => window.__remake.state.tournament.lastRank), null);
  await page.evaluate(() => { window.__remake.craftTest.auto = 'good'; });
  await page.locator('[data-test="retry"]').click();
  assert.equal(await page.locator('[data-test="game-over"]').getAttribute('data-phase'), 'reaction');
  assert.equal(await page.evaluate(() => window.__remake.state.tournament.attempts), 1, 'reaction plays before rewinding the tournament');
  // 読み上げ領域は台詞の live だけを見る（残り時間・戻り先の説明も .go-a11y）。読み上げるのは retry 反応の text。
  assert.match(await page.locator('.go-a11y[aria-live]:not(.go-time-announcement)').textContent(), /一緒に戻るぞ|絶滅回避|俺たちの大会へ/);
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
  // 新規保存には持込在庫がない。旧セーブ救済の仕入れを実操作してから制作へ進む。
  // 第1章はレモン課題の仕入れ（12g以上）を済ませないと店を出られない（#1018）。1箱でその香りの準備も揃う。
  await page.locator('[data-test="buy-lemon"]').click();
  await page.locator('[data-test="shop-checkout"]').click();
  await page.locator('[data-test="shop-leave"]').click();
  await page.waitForFunction(() => window.__done, null, { timeout: 180000 });
  const rehearsal = await page.evaluate(() => ({ seen: window.__seen, result: window.__remake.state.rehearsal }));
  assert(rehearsal.seen.includes('remake_rehearsal_burnt') && !rehearsal.seen.includes('remake_rehearsal_rough'), rehearsal.seen.join(','));
  assert.equal(rehearsal.result, 'rough');
  console.log('PASS: rehearsal burn → its own short scene, rough result, game continues');
  assert.deepEqual(errors, []);
  console.log('PASS: page errors 0');
} finally { await browser.close(); }
