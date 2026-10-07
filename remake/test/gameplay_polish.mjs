// 任意チュートリアル・無言の会釈・HUD回復・実際のスマホ弾幕操作を検証。
// サーバーを8123で起動後: node remake/test/gameplay_polish.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const base = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const errors = [];
const open = async (context) => {
  const page = await context.newPage(); page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]'); return page;
};
try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await open(desktop);
  await page.evaluate(() => {
    __remake.vnTest.turbo = true; __remake.craftTest.auto = 'good';
    __remake.vnTest.choose = (id, choices) => id === 'remake_tutorial_offer' ? choices.indexOf('今は練習しない') : 0;
    window.benches = 0;
    new MutationObserver(() => { if (document.body.dataset.screen === 'bench') window.benches++; })
      .observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
  });
  await page.click('[data-test="title-new"]');
  await page.waitForFunction(() => __remake.state?.phase === 'daily');
  const skipped = await page.evaluate(() => ({ skipped: __remake.state.flags._tutorial_skipped,
    practiced: !!__remake.state.flags._tutorial_done, benches: window.benches }));
  assert.deepEqual(skipped, { skipped: true, practiced: false, benches: 0 });
  console.log('[polish] PASS: skipping the offered lesson reaches daily life without opening a craft bench');
  await page.reload(); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'); core.newGame(); core.state.phase = 'daily';
    const vn = await import('./js/vn/engine.js'); const hud = await import('./js/daily/hud.js');
    const ui = await import('./js/core/ui.js'); const stats = await import('./js/core/stats.js');
    const map = await import('./js/daily/map.js'); window.T = { core, vn, hud, ui, stats, map };
    hud.initHud({}); hud.showHud();
    const cameo = __remake.DB.dialogues.ch1_tutorial_oneesan.lines.find(l => l.portrait === 'tsumugi');
    window.cameoRun = vn.play({ dialogue_id: 'cameo-preview', lines: [cameo] });
  });
  await page.waitForSelector('.portrait[data-speaker="tsumugi"].bow');
  const cameo = await page.evaluate(() => ({ met: !!T.core.state.met.tsumugi,
    named: document.querySelector('.vn-name').classList.contains('show'),
    intros: !!T.core.state.flags._intro_tsumugi }));
  assert.deepEqual(cameo, { met: false, named: false, intros: false });
  if (shots) await page.screenshot({ path: `${shots}/tsumugi-bow.png` });
  await page.evaluate(() => { __remake.vnTest.turbo = true; });
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.evaluate(() => window.cameoRun);
  await page.evaluate(() => { window.mapRun = T.map.chooseSpot(); });
  await page.waitForSelector('.map');
  await page.evaluate(() => {
    T.core.state.stamina = 20; T.hud.updateHud();
    document.body.classList.add('vn-open'); T.stats.addStamina(30);
  });
  await page.waitForTimeout(80);
  assert.equal(await page.locator('.gain-card.stamina').count(), 0);
  assert.equal(await page.locator('.hud-stamina.recovering').count(), 0);
  await page.evaluate(() => document.body.classList.remove('vn-open'));
  await page.waitForSelector('.hud-stamina.recovering');
  assert.equal(await page.locator('.hud-bar b').evaluate(n => n.style.width), '50%');
  await page.waitForTimeout(550);
  const ratio = await page.locator('.hud-bar b').evaluate(n => n.getBoundingClientRect().width / n.parentElement.getBoundingClientRect().width);
  assert(Math.abs(ratio - .5) < .02);
  console.log('[polish] PASS: recovery waits for the visible map HUD and fills the original gauge without a card');
  const temperatures = await page.evaluate(async () => {
    const { startTemp } = await import('./js/craft/pull.js');
    return [3, 5, 8, 10].map(steamMin => {
      const cs = { heat: { heatPower: 70 }, place: 'triangle', pack: 'normal', steamMin,
        holes: { minimumComplete: true, total: 24 }, environment: { rainy: false } };
      const values = Array.from({ length: 100 }, () => startTemp(cs));
      return [Math.min(...values), Math.max(...values)];
    });
  });
  assert(temperatures[1][1] < .34, '5-minute startup should stay well below the ideal band');
  assert(temperatures[2][0] > temperatures[1][1] + .05, '8 minutes should provide useful additional warming');
  assert(temperatures[3][0] > temperatures[2][0]);
  console.log('[polish] PASS: five-minute startup remains low, while eight and ten minutes add heat');
  await page.evaluate(async () => {
    const session = await import('./js/craft/session.js');
    const heat = await import('./js/craft/heat.js');
    const cs = session.newSession('drill'); session.openBench(cs); __remake.craftTest.auto = 'good';
    window.heatRun = heat.runHeat(cs);
  });
  const geometry = await page.evaluate(() => {
    const worker = document.querySelector('.bench-worker').getBoundingClientRect();
    const rig = document.querySelector('.rig').getBoundingClientRect();
    const coals = [...document.querySelectorAll('.stove .coal')].map(n => [parseFloat(n.style.left), parseFloat(n.style.top)]);
    return { overlaps: worker.bottom > rig.top, coals, step: document.querySelector('.bench-worker').dataset.step };
  });
  assert(!geometry.overlaps); assert.equal(geometry.step, 'heat');
  assert.deepEqual(geometry.coals, [[50, 30], [38, 45], [62, 45]]);
  if (shots) await page.screenshot({ path: `${shots}/centered-coals.png` });
  await page.evaluate(() => window.heatRun);
  await page.evaluate(async () => {
    const { runHoles } = await import('./js/craft/holes.js'); const session = await import('./js/craft/session.js');
    const cs = session.newSession('drill'); session.openBench(cs); window.holesRun = runHoles(cs);
  });
  await page.waitForSelector('.hr-feedback .stamp');
  const feedback = await page.evaluate(() => {
    const a = document.querySelector('.foil').getBoundingClientRect(), b = document.querySelector('.hr-feedback .stamp').getBoundingClientRect();
    return { count: document.querySelectorAll('.hr-feedback .stamp').length, separate: b.left > a.right };
  });
  assert.equal(feedback.count, 1); assert(feedback.separate);
  if (shots) await page.screenshot({ path: `${shots}/foil-feedback.png` });
  await page.evaluate(() => window.holesRun);
  console.log('[polish] PASS: reserved worker area clears the rig, coals form a centered triangle, foil feedback stays outside the targets');

  const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const phone = await open(mobile);
  await phone.evaluate(async () => {
    const { newGame } = await import('./js/core/state.js'); newGame();
    const session = await import('./js/craft/session.js'); const steam = await import('./js/craft/steam.js');
    window.cs = session.newSession('drill'); cs.steamMin = 3; session.openBench(cs);
    window.steamRun = steam.runSteamDodge(cs);
  });
  const initial = await phone.evaluate(() => {
    const box = document.querySelector('.dodge').getBoundingClientRect(), heart = document.querySelector('.dodge-heart').getBoundingClientRect();
    const pad = document.querySelector('.dodge-pad').getBoundingClientRect();
    return { dx: heart.x + heart.width / 2 - box.x - box.width / 2, dy: heart.y + heart.height / 2 - box.y - box.height / 2,
      below: pad.top > box.bottom, bottom: pad.bottom, stageBottom: document.querySelector('#stage').getBoundingClientRect().bottom,
      disabled: document.querySelector('.dodge-refresh').disabled };
  });
  assert(Math.abs(initial.dx) < 2 && Math.abs(initial.dy) < 2); assert(initial.below);
  assert(initial.bottom <= initial.stageBottom); assert(initial.disabled);
  await phone.waitForFunction(() => !document.querySelector('.dodge-refresh').disabled);
  const cdp = await mobile.newCDPSession(phone);
  const pad = await phone.locator('.dodge-pad').boundingBox();
  const center = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 };
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ ...center, id: 1 }]);
  await touch('touchMove', [{ x: center.x + pad.width * .34, y: center.y, id: 1 }]);
  await phone.waitForTimeout(400); await touch('touchEnd', []);
  const moved = await phone.locator('.dodge-heart').evaluate(n => n.style.transform);
  await phone.waitForTimeout(150);
  assert.equal(await phone.locator('.dodge-heart').evaluate(n => n.style.transform), moved, 'Heart drifted after releasing the pad');
  assert(parseFloat(moved.match(/translate\(([\d.]+)/)[1]) > 340, 'Touch pad did not move the heart');
  await phone.waitForSelector('.dodge-object');
  await phone.locator('.dodge-refresh').tap();
  await phone.waitForSelector('.dodge-refresh-fx');
  assert.equal(await phone.locator('.dodge-word, .dodge-object').count(), 0);
  assert.match(await phone.locator('.dodge-refresh').textContent(), /×1/);
  if (shots) await phone.screenshot({ path: `${shots}/mobile-refresh.png` });
  await phone.keyboard.down('Space'); await phone.waitForTimeout(100);
  await phone.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true })));
  await phone.keyboard.up('Space');
  assert.match(await phone.locator('.dodge-refresh').textContent(), /×0/);
  assert(await phone.locator('.dodge-refresh').isDisabled());
  await phone.waitForSelector('.result-card.show', { timeout: 15000 });
  assert.equal(await phone.locator('.dodge-object, .dodge-word').count(), 0);
  await phone.locator('[data-test="step-next"]').tap(); await phone.evaluate(() => window.steamRun);
  assert.equal(await phone.evaluate(() => cs.steam.refreshesUsed), 2);
  console.log('[polish] PASS: center before countdown, touch pad below the field, release stops movement, visible mixed bullets, refresh clear/effect/two-use limit and cleanup');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
