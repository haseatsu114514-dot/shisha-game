// 実module/実VN/実ch1入口を使う。素材待ち・LOADと共有章題の契約を混同しない。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { suite, storageSnapshot } from './support.mjs';
const out = path.resolve(process.env.ARTIFACT_DIR || '.codex/artifacts/ch1-title-motion');
fs.mkdirSync(out, { recursive: true });

async function setup(page) {
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'), ui = await import('./js/core/ui.js');
    const motion = await import('./js/chapters/ch1-title-motion.js'), audio = await import('./js/core/audio.js');
    const vn = await import('./js/vn/engine.js');
    core.newGame(); core.save();
    window.T = { core, ui, motion, vn, jingles: 0, done: false, result: null, error: null };
    const jingle = audio.SE.jingle;
    audio.SE.jingle = (...args) => { T.jingles++; return jingle(...args); };
    T.start = options => {
      T.done = false; T.result = null; T.started = performance.now();
      T.task = motion.playCh1Title(options).then(result => {
        T.done = true; T.result = result; T.finished = performance.now(); return result;
      }).catch(error => { T.error = error.stack; });
    };
    T.originalPixels = async () => {
      const img = new Image(); img.src = (await import('./js/core/chapter-title-art.js')).chapterTitleArt('第一章');
      await img.decode(); const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
      c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL();
    };
    const button = document.createElement('button'); button.textContent = '下の操作';
    Object.assign(button.style, { position: 'absolute', left: '40%', top: '45%', width: '20%', height: '10%' });
    T.underClicks = 0; button.onclick = () => T.underClicks++;
    ui.showScreen('qa-ch1-title', button); button.focus();
  });
}
const ready = page => page.locator('.ch1-title-motion[data-phase="playing"]').waitFor();
async function done(page) {
  await page.waitForFunction(() => T.done);
  assert.equal(await page.evaluate(() => T.error), null);
  assert.equal(await page.locator('.ch1-title-motion').count(), 0);
}
async function send(page, touch = false) {
  if (touch) await page.touchscreen.tap(page.viewportSize().width / 2, page.viewportSize().height / 2);
  else await page.mouse.click(page.viewportSize().width / 2, page.viewportSize().height / 2);
  await page.keyboard.press('Enter'); await page.keyboard.press('Space');
}
async function fitAndPixels(page) {
  const result = await page.locator('.ch1-title-motion canvas').evaluate(async canvas => {
    const r = canvas.getBoundingClientRect();
    return { pixels: canvas.toDataURL() === await T.originalPixels(), fit: getComputedStyle(canvas).objectFit,
      fits: r.left >= -.5 && r.top >= -.5 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5 };
  });
  assert(result.pixels && result.fits && result.fit === 'contain', JSON.stringify(result));
}
async function gatedImage(page, broken = false) {
  let release, requested;
  const gate = new Promise(resolve => release = resolve), seen = new Promise(resolve => requested = resolve);
  await page.route('**/ch1-title.webp', async route => {
    requested();
    if (broken) return route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid title image' });
    await gate; await route.continue();
  });
  await page.reload(); await page.locator('[data-test="title-new"]').waitFor();
  await page.locator('#boot').waitFor({ state: 'detached' });
  await seen; return release;
}

await suite('ch1-title-motion', async check => {
  for (const [label, options] of [
    ['pc', { viewport: { width: 1440, height: 900 } }],
    ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`${label}-4800ms-original-pixels-and-input-guard`, async page => {
      await setup(page); const before = await storageSnapshot(page);
      await page.evaluate(() => T.start()); await ready(page);
      await page.waitForTimeout(750);
      const early = await page.locator('canvas').evaluate(c => c.toDataURL());
      await page.screenshot({ path: path.join(out, `${label}-early.png`) });
      await send(page, label === 'touch');
      assert.equal(await page.evaluate(() => T.done), false, '送り入力で自然な章題が中断された');
      assert.equal(await page.evaluate(() => T.underClicks), 0);
      await page.waitForFunction(() => Number(document.querySelector('.ch1-title-motion')?.dataset.elapsed) >= 3150);
      const fullAt = await page.evaluate(() => performance.now());
      await fitAndPixels(page);
      assert.notEqual(await page.locator('canvas').evaluate(c => c.toDataURL()), early);
      await page.screenshot({ path: path.join(out, `${label}-full-title.png`) });
      await done(page);
      const result = await page.evaluate(() => ({ duration: T.finished - T.started, ended: T.finished, result: T.result, jingles: T.jingles }));
      assert(result.duration >= 4780 && result.duration < 5400, JSON.stringify(result));
      assert(result.ended - fullAt >= 1400, '完全表示後の読み時間が不足');
      assert.deepEqual(result.result, { cancelled: false, art: 'ready' }); assert.equal(result.jingles, 1);
      assert.deepEqual(await storageSnapshot(page), before);
      await send(page, label === 'touch');
      assert.equal(await page.evaluate(() => T.underClicks), 3, '終了後も入力ガードが残った');
      fs.writeFileSync(path.join(out, `${label}-timing.json`), JSON.stringify(result, null, 2));
    }, options);
  }
  for (const mode of ['auto', 'skip', 'control-release']) {
    await check(`${mode}-real-vn-before-and-after`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const dlg = id => ({ dialogue_id: id, lines: [{ speaker: 'hajime', text: id === 'before' ? '前の場面。' : '次の場面。' }] });
        T.phase = 'before';
        T.sequence = T.vn.dialogueSequence(async () => {
          await T.vn.play(dlg('before')); T.phase = 'title';
          await T.motion.playCh1Title(); T.phase = 'after';
          await T.vn.play(dlg('after')); T.phase = 'done';
        }).catch(e => T.error = e.stack);
      });
      await page.locator('#vn.active .vn-box').waitFor();
      if (mode === 'control-release') await page.keyboard.down('Control');
      else await page.locator(`[data-test="vn-${mode}"]`).click();
      await ready(page); await send(page);
      assert.equal(await page.evaluate(() => T.phase), 'title');
      if (mode === 'control-release') {
        await page.keyboard.up('Control');
        assert.equal(await page.evaluate(() => document.body.classList.contains('vn-skip')), false);
      }
      await page.locator('.ch1-title-motion').waitFor({ state: 'detached' });
      if (mode === 'control-release') {
        await page.waitForTimeout(300); assert.equal(await page.evaluate(() => T.phase), 'after');
        for (let i = 0; i < 4 && await page.evaluate(() => T.phase !== 'done'); i++) {
          await page.locator('.vn-box').click({ force: true }); await page.waitForTimeout(200);
        }
      }
      await page.waitForFunction(() => T.phase === 'done');
      assert.equal(await page.evaluate(() => T.error), null);
      assert.equal(await page.evaluate(() => T.jingles), 1);
      assert.equal(await page.evaluate(() => document.body.classList.contains('vn-skip')), false);
    });
  }
  await check('reduced-motion-static-and-readable', async page => {
    await setup(page); await page.evaluate(() => T.start()); await ready(page);
    await fitAndPixels(page); await done(page);
    const elapsed = await page.evaluate(() => T.finished - T.started);
    assert(elapsed >= 1680 && elapsed < 2400); assert.equal(await page.evaluate(() => T.jingles), 1);
  }, { reducedMotion: 'reduce' });
  await check('delayed-image-keeps-previous-scene-and-full-reading-time', async page => {
    const release = await gatedImage(page); await setup(page);
    const before = await storageSnapshot(page); await page.evaluate(() => T.start());
    await page.waitForTimeout(700); await send(page);
    assert.equal(await page.locator('.ch1-title-motion canvas').count(), 0);
    assert.equal(await page.evaluate(() => T.jingles), 0); assert.equal(await page.evaluate(() => T.underClicks), 0);
    release(); await ready(page); const drawnAt = Date.now();
    await done(page); assert(Date.now() - drawnAt >= 4700);
    assert.deepEqual(await storageSnapshot(page), before);
  });
  await check('broken-image-text-fallback', async page => {
    await gatedImage(page, true); await setup(page); await page.evaluate(() => T.start()); await ready(page);
    assert.equal(await page.locator('.ch1-title-motion').getAttribute('data-art'), 'text');
    assert.match(await page.locator('.ch1-title-motion').innerText(), /煙がつなぐ街/);
    assert.equal(await page.locator('.ch1-title-motion canvas').count(), 0);
    await done(page); assert.equal(await page.evaluate(() => T.jingles), 1);
  });
  await check('15000ms-image-timeout-late-image-does-not-replace-text', async page => {
    const release = await gatedImage(page); await setup(page); await page.evaluate(() => T.start());
    await page.locator('.ch1-title-motion[data-art="text"]').waitFor({ timeout: 20000 });
    release(); await page.waitForTimeout(250);
    assert.equal(await page.locator('.ch1-title-motion canvas').count(), 0);
    await done(page); assert.equal(await page.evaluate(() => T.jingles), 1);
  });
  await check('abort-loading-and-playing-removes-owned-work', async page => {
    const release = await gatedImage(page); await setup(page);
    await page.evaluate(() => { T.controller = new AbortController(); T.start({ signal: T.controller.signal }); T.controller.abort(); });
    await done(page); assert.equal(await page.evaluate(() => T.result.cancelled), true);
    release(); await page.waitForTimeout(150); assert.equal(await page.evaluate(() => T.jingles), 0);
    await page.evaluate(() => { T.controller = new AbortController(); T.start({ signal: T.controller.signal }); });
    await ready(page); await page.evaluate(() => T.controller.abort()); await done(page);
    assert.equal(await page.evaluate(() => T.result.cancelled), true);
    await send(page); assert.equal(await page.evaluate(() => T.underClicks), 3);
  });
  await check('recall-and-removed-host-cancel-old-owner', async page => {
    await setup(page); await page.evaluate(() => { T.first = T.motion.playCh1Title(); }); await ready(page);
    await page.evaluate(() => T.start()); await ready(page);
    assert.equal(await page.evaluate(async () => (await T.first).cancelled), true);
    assert.equal(await page.locator('.ch1-title-motion').count(), 1);
    await page.evaluate(() => T.ui.layers.fx.replaceChildren()); await done(page);
    assert.equal(await page.evaluate(() => T.result.cancelled), true);
    await page.waitForTimeout(150); assert.equal(await page.locator('.ch1-title-motion').count(), 0);
    await page.evaluate(() => T.start()); await ready(page); await done(page);
    assert.equal(await page.evaluate(() => T.result.cancelled), false);
  });
  await check('real-ch1-load-during-title-replays-once-and-skips-after-intro-done', async page => {
    page.setDefaultTimeout(60000); await setup(page);
    await page.evaluate(async () => {
      const ch1 = await import('./js/chapters/ch1.js'); T.ch1 = ch1; T.vn.vnTest.turbo = true;
      T.entries = []; T.vn.hooks.onLine = id => { if (T.entries.at(-1) !== id) T.entries.push(id); };
      T.oldDone = false; T.oldRun = ch1.startNewGame().then(() => T.oldDone = true).catch(e => T.error = e.stack);
    });
    await ready(page);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(T.core.SAVE_KEY)));
    assert.equal(saved.phase, 'opening'); assert.deepEqual(saved.flags._ch1_opening, {});
    await page.evaluate(() => {
      T.core.saveToSlot('suien_remake_slot1'); T.slot = localStorage.getItem('suien_remake_slot1');
      T.core.loadFromSlot('suien_remake_slot1');
    });
    await page.waitForFunction(() => T.oldDone); assert.equal(await page.locator('.ch1-title-motion').count(), 0);
    assert.equal(await page.evaluate(() => T.core.state.flags._ch1_opening.introDone), undefined);
    assert.equal(await page.evaluate(() => T.entries.includes('ch1_opening')), false);
    await page.evaluate(() => { T.resumeRun = T.ch1.resumeGame().catch(e => T.error = e.stack); });
    await ready(page); assert.equal(await page.evaluate(() => T.jingles), 2);
    await page.waitForFunction(() => T.core.state.flags._ch1_opening.introDone === true, null, { timeout: 60000 });
    const result = await page.evaluate(() => ({ saved: JSON.parse(localStorage.getItem(T.core.SAVE_KEY)), entries: T.entries, error: T.error,
      slot: localStorage.getItem('suien_remake_slot1'), originalSlot: T.slot }));
    assert.equal(result.error, null); assert.equal(result.saved.flags._ch1_opening.introDone, true);
    assert.equal(result.entries.filter(id => id === 'ch1_opening').length, 1); assert.equal(result.slot, result.originalSlot);
    await page.reload(); await page.locator('[data-test="title-new"]').waitFor();
    await setup(page); // Restore the real saved introDone state after this helper's isolated newGame.
    await page.evaluate(async saved => { T.core.setState(saved); T.core.save(); T.vn.vnTest.turbo = true;
      T.resumeRun = (await import('./js/chapters/ch1.js')).resumeGame().catch(e => T.error = e.stack);
    }, result.saved);
    await page.waitForTimeout(1500); assert.equal(await page.locator('.ch1-title-motion').count(), 0);
    assert.equal(await page.evaluate(() => T.jingles), 0); assert.equal(await page.evaluate(() => T.error), null);
  });
});
