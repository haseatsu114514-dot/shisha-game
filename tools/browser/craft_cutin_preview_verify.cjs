// 本編への接続前の配置・時間停止プロトタイプだけを実ゲームで検証する。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const url = process.env.CUTIN_PREVIEW_URL || 'http://127.0.0.1:8125/craft-cutin-placement/tools/browser/craft_cutin_preview.html';
const out = process.env.SHOTS || path.resolve(__dirname, '../../asset_sources/craft-success-cutins/placements-v2-20261008/review');
fs.mkdirSync(out, { recursive: true });
const report = { url, cases: [], browserErrors: [] };
const selector = { heat: '[data-test="coal-0"]', holes: '[data-test="hole-punch"]', steam: '[data-test="timer-stop"]', pull: '[data-test="pull-stop"]' };

async function boot(page, step = 'heat', mode = 'tournament') {
  await page.goto(url);
  await page.waitForFunction(() => window.cutinDemo?.effect);
  if (mode !== 'tournament') {
    await page.selectOption('#mode', mode);
    await page.waitForFunction(mode => window.cutinDemo?.window.__cutinSession?.mode === mode, mode);
  }
  if (step !== 'heat') {
    await page.selectOption('#step', step);
    await page.waitForFunction(step => window.cutinDemo?.window.__cutinStep === step, step);
  }
  const frame = page.frames().find(f => f.parentFrame());
  if (step === 'holes' && await frame.locator('[data-test="hole-start"]').count()) await frame.locator('[data-test="hole-start"]').click();
  await frame.waitForFunction(step => {
    if (step === 'heat') return document.querySelector('[data-test="coal-0"]')?.dataset.phase === 'raw';
    if (step === 'holes') return !!document.querySelector('.hr-time-bar b')?.style.width;
    if (step === 'steam') return document.querySelector('[data-test="timer-stop"]')?.disabled === false;
    return !!document.querySelector('.pg-needle')?.style.left;
  }, step);
  await frame.waitForFunction(() => [...document.querySelectorAll('.worker-actor,.audience-face img')].every(i => i.complete && i.naturalWidth));
  return frame;
}
const settle = frame => frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const snapshot = frame => frame.evaluate(() => {
  const q = s => document.querySelector(s), text = s => q(s)?.textContent || '';
  return {
    coals: [...document.querySelectorAll('.coal')].map(n => [n.dataset.phase, n.classList.contains('picked'), n.style.getPropertyValue('--red'), n.style.getPropertyValue('--hot'), n.style.getPropertyValue('--ash')]),
    heatTimings: [...document.querySelectorAll('.heat-picks li')].map(n => n.textContent),
    cursor: q('.foil-cursor')?.getAttribute('style') || '', timeBar: q('.hr-time-bar b')?.style.width || '',
    holes: q('.foil-holes')?.childElementCount || 0,
    heart: q('.dodge-heart')?.style.transform || '',
    bullets: [...document.querySelectorAll('.dodge-object,.dodge-word')].map(n => n.style.transform),
    timer: q('[data-test="steam-clock"]')?.getAttribute('aria-label') || '', hits: text('.dodge-hits'),
    refresh: text('[data-test="dodge-refresh"]'), timerPressed: q('[data-test="timer-stop"]')?.getAttribute('aria-pressed') || '',
    needle: q('.pg-needle')?.style.left || '', pulls: text('.pull-count'),
    temperatures: [...document.querySelectorAll('.thermo')].map(n => n.getAttribute('aria-valuenow')),
  };
});
const time = page => page.evaluate(() => ({ game: cutinDemo.clock.now(), raw: cutinDemo.clock.raw(), paused: cutinDemo.clock.paused, excluded: cutinDemo.clock.excludedMs }));
const hold = (page, variant) => page.evaluate(variant => cutinDemo.effect.show(variant, { hold: true }), variant);
const hide = page => page.evaluate(() => cutinDemo.effect.hide());

async function pauseCase(page, frame, step, variant) {
  await frame.locator('.bench-worker-name > b').click();
  assert(await hold(page, variant));
  await settle(frame);
  const before = await snapshot(frame), t0 = await time(page);
  assert(t0.paused);
  await page.waitForTimeout(270);
  const box = await frame.locator(selector[step]).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  assert.deepEqual(await snapshot(frame), before, `${step}/${variant}: pointer reached game during pause`);
  await page.keyboard.press('Space');
  await settle(frame);
  assert.deepEqual(await snapshot(frame), before, `${step}/${variant}: model or input progressed during pause`);
  const stopped = await time(page);
  assert.equal(stopped.game, t0.game);
  assert(stopped.raw - t0.raw >= 250);
  await hide(page);
  const resumed = await time(page);
  assert(!resumed.paused);
  assert(resumed.game - stopped.game < 60, 'pause duration was added on resume');
  await page.waitForTimeout(120);
  const after = await time(page);
  assert(after.game - resumed.game >= 100 && after.game - resumed.game < 210);
  assert.notDeepEqual(await snapshot(frame), before, 'game did not resume');
  report.cases.push({ step, variant, stoppedGameMs: stopped.game - t0.game, stoppedRealMs: +(stopped.raw - t0.raw).toFixed(2), resumeJumpMs: +(resumed.game - stopped.game).toFixed(2), resumedGameMs: +(after.game - resumed.game).toFixed(2), guardedMouseAndSpace: true });
}
async function geometry(page, frame, variant) {
  await hold(page, variant);
  const g = await frame.evaluate(() => {
    const rect = s => { const r = document.querySelector(s).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
    return { root: rect('.craft-cutin-preview'), host: rect('.bench-worker-stage'), scene: rect('.bench'), right: rect('.bench-right'), footer: rect('.bench-worker-name'), audience: document.querySelector('.bench-audience') ? rect('.bench-audience') : null, pointer: getComputedStyle(document.querySelector('.craft-cutin-preview')).pointerEvents };
  });
  const bounds = variant === 'full' ? g.scene : g.host;
  for (const key of ['x','y','width','height']) assert(Math.abs(g.root[key] - bounds[key]) < 1.5, `${variant}: wrong ${key}`);
  if (variant !== 'full') {
    for (const r of [g.right, g.footer, g.audience].filter(Boolean)) assert(g.root.x + g.root.width <= r.x + 1 || g.root.y + g.root.height <= r.y + 1 || g.root.y >= r.y + r.height - 1);
  }
  if (['pair','peek','window'].includes(variant)) assert.equal(g.pointer, 'none');
  await settle(frame);
  return g;
}
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1324, height: 980 } });
    page.on('pageerror', e => report.browserErrors.push(e.message));
    await page.goto(url);
    await page.evaluate(() => localStorage.setItem('suien_remake_save', 'cutin-existing-save-sentinel'));
    for (const step of ['heat','holes','steam','pull']) {
      const frame = await boot(page, step);
      if (step === 'heat') await frame.waitForFunction(() => document.querySelector('[data-test="coal-0"]')?.dataset.phase === 'early');
      assert(await frame.locator('[data-test="craft-feedback"]').isVisible(), `${step}: missing commentator`);
      assert((await frame.locator('[data-test="craft-feedback"]').textContent()).length > 0);
      if (step === 'heat') report.audienceUi = await frame.evaluate(() => ({
        cardHeight: getComputedStyle(document.querySelector('.bench-audience')).height,
        faceHeight: getComputedStyle(document.querySelector('.audience-face')).height,
        portraitWidth: document.querySelector('.audience-face img').style.width,
        commentFont: getComputedStyle(document.querySelector('.audience-note')).fontSize,
      }));
      for (const variant of ['full','center']) await pauseCase(page, frame, step, variant);
      // 演出が閉じた後、同じ実ボタンで入力が再び届く。
      const before = await snapshot(frame);
      await frame.locator(selector[step]).click();
      await settle(frame);
      const after = await snapshot(frame);
      if (step === 'heat') assert(after.coals[0][1]);
      if (step === 'holes') assert.equal(after.holes, before.holes + 1);
      if (step === 'pull') assert.notEqual(after.pulls, before.pulls);
      if (step === 'steam') assert.equal(after.timerPressed, 'true');
      console.log(`PASS ${step}: full/center freeze, guarded input, resume and restored button`);
    }
    let frame = await boot(page, 'pull');
    const t0 = await time(page);
    await page.click('#play');
    await page.waitForFunction(() => cutinDemo.effect.active === null);
    const t1 = await time(page);
    assert(t1.excluded - t0.excluded >= 1050);
    assert(t1.game - t0.game < 250);
    report.animation = { excludedMs: +(t1.excluded - t0.excluded).toFixed(2), gameDeltaMs: +(t1.game - t0.game).toFixed(2), automaticallyResumed: !t1.paused };
    for (const variant of ['pair','peek','window']) {
      await geometry(page, frame, variant);
      const a = await time(page); await page.waitForTimeout(120); const b = await time(page);
      assert(!b.paused && b.game > a.game + 100);
      await hide(page);
    }
    await frame.locator('.bench-guide').evaluate(n => n.open = true);
    assert.equal(await hold(page, 'full'), false);
    await frame.locator('.bench-guide').evaluate(n => n.open = false);
    await hold(page, 'center');
    await frame.locator('.bench-guide').evaluate(n => n.open = true);
    await page.waitForFunction(() => !cutinDemo.effect.active && !cutinDemo.clock.paused);
    report.guideGuard = true;

    frame = await boot(page, 'steam');
    await frame.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowRight', code:'ArrowRight', bubbles:true })));
    await page.waitForTimeout(100);
    await hold(page, 'center'); await settle(frame);
    await frame.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key:'ArrowRight', code:'ArrowRight', bubbles:true })));
    const heart = (await snapshot(frame)).heart;
    await hide(page); await page.waitForTimeout(150);
    assert.equal((await snapshot(frame)).heart, heart, 'held arrow remained stuck after release during pause');
    const pad = await frame.locator('[data-test="dodge-pad"]').boundingBox();
    await page.mouse.move(pad.x + pad.width * .8, pad.y + pad.height / 2); await page.mouse.down();
    assert(await frame.locator('[data-test="dodge-pad"]').evaluate(n => n.classList.contains('held')));
    await hold(page, 'full'); await settle(frame); await page.mouse.up();
    assert(!await frame.locator('[data-test="dodge-pad"]').evaluate(n => n.classList.contains('held')));
    await hide(page); report.heldInputRelease = true;

    // 表示サイズと全5配置。各静止比較の途中は時計を止めて同じ背景を使う。
    for (const size of [{name:'desktop', width:1280, height:720}, {name:'mobile-landscape',width:844,height:390}, {name:'mobile-portrait',width:390,height:844}]) {
      await page.setViewportSize({ width:size.width + 44, height:size.height + 340 });
      frame = await boot(page);
      await page.locator('main').evaluate(n => n.style.maxWidth = 'none');
      await page.locator('.frame').evaluate((n, size) => Object.assign(n.style,{width:`${size.width}px`,height:`${size.height}px`,aspectRatio:'auto'}),size);
      await frame.waitForFunction(() => document.querySelector('[data-test="coal-0"]')?.dataset.phase === 'just', null, { timeout:15000 });
      // 実成功を撮影。採点を変えず、PERFECTが表示された直後の画面を保存する。
      await page.evaluate(() => cutinDemo.clock.pause());
      await frame.locator('[data-test="coal-0"]').click();
      assert.equal(await frame.locator('[data-test="coal-timing-0"]').getAttribute('data-rating'), 'PERFECT');
      await page.waitForTimeout(500); // 成功時の金色フラッシュを終えてから配置を公平に比較する。
      const details = { size, variants:{} };
      for (const variant of ['center','full',...(size.name === 'desktop' ? ['pair','peek','window'] : [])]) {
        await page.evaluate(() => cutinDemo.clock.pause());
        details.variants[variant] = await geometry(page,frame,variant);
        await page.locator('.frame').screenshot({path:path.join(out,`${variant}-${size.name}.png`)});
        await hide(page);
      }
      report.cases.push(details);
    }
    for (const mode of ['tutorial','drill']) {
      frame = await boot(page,'heat',mode);
      const count = await frame.locator('[data-test="craft-audience"]').count();
      assert.equal(count, 1);
      assert.equal(await frame.locator('.bench-audience').getAttribute('data-speaker'), mode === 'tutorial' ? 'sumi' : 'hajime');
      assert(await frame.locator('[data-test="craft-feedback"]').textContent());
      assert.equal(await frame.locator('.bench-ticker').count(), 0);
      report.cases.push({mode,audienceCount:count,comment: count ? await frame.locator('[data-test="craft-feedback"]').textContent() : null});
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('suien_remake_save')), 'cutin-existing-save-sentinel');
    report.existingSavePreserved = true;
    await hold(page,'full'); await page.click('#restart');
    await page.waitForFunction(() => cutinDemo && !cutinDemo.clock.paused);
    assert.equal(await page.evaluate(() => cutinDemo.effect.active),null);
    report.restartClearsPause = true;
    assert.deepEqual(report.browserErrors,[]);
    fs.writeFileSync(path.join(out,'browser-validation.json'),JSON.stringify(report,null,2)+'\n');
    console.log('PASS automatic close, side-area geometry, guide guard, held input releases, desktop/mobile, commentators and save preservation');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
