// 実描画・自然な章入口・保存不変・遅延/失敗を確認。第3章は保留。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite, storageSnapshot } from "./support.mjs";

const out = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/chapter-titles");
fs.mkdirSync(out, { recursive: true });

async function entries(page) {
  return page.evaluate(async () => (await import('./js/core/chapter-title-art.js')).CHAPTER_TITLE_ART);
}
async function start(page, entry) {
  await page.evaluate(async entry => {
    const ui = await import('./js/core/ui.js');
    window.titleFinished = false;
    window.titleTask = ui.chapterTitle(entry).then(() => { window.titleFinished = true; });
  }, entry);
}
async function drawn(page, entry) {
  const card = page.locator('.chapter-card.show');
  await card.waitFor();
  assert.equal(await card.getAttribute('data-chapter'), entry.no);
  assert.equal(await card.getAttribute('data-art'), 'ready');
  const image = card.locator('img');
  await image.evaluate(image => image.decode());
  assert.match(await image.getAttribute('src'), new RegExp(`/ch${entry.chapter}-title\\.webp$`));
  assert((await image.getAttribute('alt')).includes(entry.name));
  assert.equal(await card.locator('.cc-copy').isVisible(), false, 'Image and DOM titles were both shown');
  assert.equal(await card.locator('.cc-frame').count(), 0);
  const geometry = await image.evaluate(image => {
    const r = image.getBoundingClientRect();
    return { size: [image.naturalWidth, image.naturalHeight], fit: getComputedStyle(image).objectFit,
      transform: getComputedStyle(image).transform, visible: r.width > 0 && r.height > 0,
      fits: r.left >= -.5 && r.top >= -.5 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5 };
  });
  assert.deepEqual(geometry.size, [1280, 720]);
  assert.equal(geometry.fit, 'contain');
  assert.equal(geometry.transform, 'none');
  assert(geometry.visible && geometry.fits, JSON.stringify(geometry));
  await card.evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {}))));
}
async function done(page) {
  await page.waitForFunction(() => window.titleFinished);
  assert.equal(await page.locator('.chapter-card').count(), 0);
}

await suite('chapter-titles', async check => {
  for (const [label, options] of [
    ['pc', {}], ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`${label}-four-approved-images`, async page => {
      const selected = await entries(page);
      assert.deepEqual(selected.map(x => x.chapter), [1, 2, 4, 5]);
      await page.evaluate(async () => {
        const core = await import('./js/core/state.js'); core.newGame(); core.save();
        localStorage.setItem('suien_remake_slot1', 'preserve-manual');
        localStorage.setItem('unrelated', 'preserve');
      });
      const before = await storageSnapshot(page);
      const state = await page.evaluate(() => JSON.stringify(__remake.state));
      for (const entry of selected) {
        await start(page, entry); await drawn(page, entry);
        await page.screenshot({ path: path.join(out, `${label}-chapter-${entry.chapter}.png`) });
        await done(page);
      }
      assert.deepEqual(await storageSnapshot(page), before);
      assert.equal(await page.evaluate(() => JSON.stringify(__remake.state)), state);
    }, options);
  }

  await check('portrait-ds-keeps-full-title', async page => {
    await page.locator('[data-test="title-layout-ds"]').tap();
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); core.newGame();
      document.body.dataset.screen = 'map';
    });
    await page.locator('body.game-ds').waitFor();
    const before = await storageSnapshot(page), entry = (await entries(page))[0];
    await start(page, entry); await drawn(page, entry);
    await page.screenshot({ path: path.join(out, 'portrait-ds-chapter-1.png') });
    await done(page);
    assert.deepEqual(await storageSnapshot(page), before);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });

  await check('delayed-image-waits-before-visible-time', async page => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    let requested;
    const seen = new Promise(resolve => { requested = resolve; });
    await page.route('**/ch4-title.webp', async route => { requested(); await gate; await route.continue(); });
    const entry = (await entries(page)).find(x => x.chapter === 4);
    await start(page, entry); await seen;
    assert.equal(await page.locator('.chapter-card').count(), 0, 'Undecoded title obscured the game');
    assert.equal(await page.evaluate(() => window.titleFinished), false);
    release(); await drawn(page, entry);
    const visible = Date.now();
    await done(page);
    assert(Date.now() - visible >= 2200, 'Loading consumed the visible title duration');
  });

  await check('broken-image-falls-back-and-finishes', async page => {
    await page.route('**/ch5-title.webp', route => route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid image' }));
    const entry = (await entries(page)).find(x => x.chapter === 5), before = await storageSnapshot(page);
    await start(page, entry);
    const card = page.locator('.chapter-card.show'); await card.waitFor();
    assert.equal(await card.getAttribute('data-art'), 'text');
    assert.equal(await card.locator('img').count(), 0);
    assert.equal(await card.locator('.cc-copy').isVisible(), true);
    assert.equal(await card.locator('.cc-name').textContent(), entry.name);
    await done(page); assert.deepEqual(await storageSnapshot(page), before);
  });

  await check('chapter-three-remains-text-only', async page => {
    const before = await storageSnapshot(page);
    await start(page, { no: '第三章', name: '章題の確認用テキスト', read: 'TITLE TEST' });
    const card = page.locator('.chapter-card.show'); await card.waitFor();
    assert.equal(await card.getAttribute('data-art'), 'text');
    assert.equal(await card.locator('img').count(), 0);
    assert.equal(await card.locator('.cc-name').textContent(), '章題の確認用テキスト');
    await done(page); assert.deepEqual(await storageSnapshot(page), before);
  });

  await check('real-new-game-chapter-one-entry', async page => {
    await page.evaluate(() => { __remake.vnTest.turbo = true; });
    await page.locator('[data-test="title-new"]').click();
    await page.locator('.chapter-card.show').waitFor({ timeout: 60000 });
    await drawn(page, (await entries(page))[0]);
    assert.equal(await page.evaluate(() => __remake.state.chapter), 1);
    await page.screenshot({ path: path.join(out, 'new-game-chapter-1.png') });
    await page.locator('.chapter-card').waitFor({ state: 'detached' });
    await page.waitForFunction(() => __remake.state.flags._ch1_opening?.introDone, null, { timeout: 60000 });
  });

  await check('real-clear-button-chapter-two-entry', async page => {
    const before = await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); core.newGame();
      Object.assign(core.state, { chapter: 1, phase: 'cleared', day: 14, slot: 2, money: 45678 });
      core.state.flags._ch1_preview_seen = true;
      __remake.vnTest.turbo = true;
      const ch1 = await import('./js/chapters/ch1.js'); ch1.setupHooks(); await ch1.showClear();
      return { money: core.state.money, owned: [...core.state.owned] };
    });
    await page.locator('[data-test="end-chapter2"]').click();
    await drawn(page, (await entries(page)).find(x => x.chapter === 2));
    await page.screenshot({ path: path.join(out, 'clear-to-chapter-2.png') });
    await page.locator('[data-test="ch2-main-map"]').waitFor({ timeout: 30000 });
    const state = await page.evaluate(() => __remake.state);
    assert.equal(state.chapter, 2); assert.equal(state.day, 15);
    assert.equal(state.money, before.money); assert.deepEqual(state.owned, before.owned);
    const titleSeen = await page.evaluate(async () => (await import('./js/chapters/ch2-progress.js')).dayOneProgress(__remake.state).titleSeen);
    assert.equal(titleSeen, true);
  });

  await check('preview-four-chapters-without-saving', async page => {
    await page.evaluate(() => localStorage.setItem('suien_remake_save', 'preserve-original'));
    const before = await storageSnapshot(page);
    await page.goto(new URL('chapter-titles-preview.html', page.url()).href);
    assert.deepEqual(await page.locator('#chapter option').evaluateAll(nodes => nodes.map(n => n.value)), ['1', '2', '4', '5']);
    await page.locator('#chapter').selectOption('4'); await page.locator('#play').click();
    await page.locator('.chapter-card.show').waitFor();
    assert.match(await page.locator('.cc-art').getAttribute('src'), /ch4-title\.webp$/);
    await page.waitForFunction(() => !document.getElementById('play').disabled);
    assert.deepEqual(await storageSnapshot(page), before);
  });
});
