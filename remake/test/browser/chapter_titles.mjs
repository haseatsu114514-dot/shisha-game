// 実描画・自然な章入口・保存不変・遅延/失敗を確認。第3章は保留。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite, storageSnapshot } from "./support.mjs";

const out = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/chapter-titles");
fs.mkdirSync(out, { recursive: true });
const SEEN_LINES_KEY = 'suien_remake_seen_dialogue_lines';
const existingSeenLine = JSON.stringify(['qa-existing', 'main', 0]);

// 本編の通常送り/AUTOは読了行を保存する。既存の記録と他の全storageは厳密に保全する。
function withReadDialogue(snapshot, ids) {
  return { ...snapshot, local: { ...snapshot.local,
    [SEEN_LINES_KEY]: JSON.stringify([existingSeenLine, ...ids.map(id => JSON.stringify([id, 'main', 0]))]),
  } };
}

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
  const image = card.locator('img.cc-art'); // 演出用の装飾レイヤー(alt="")を除いた最終の章題画像
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
  assert.equal(await page.locator('.chapter-card, .chapter-title-shield').count(), 0);
}

// show前のcomputed styleを読まない。読むと初期スタイルを確定し、旧不具合を隠してしまう。
async function observeFade(page) {
  await page.evaluate(() => {
    window.fade = { samples: [], events: [], maxCards: 0, stopped: false };
    const sample = () => {
      const cards = document.querySelectorAll('.chapter-card.show');
      fade.maxCards = Math.max(fade.maxCards, cards.length);
      if (cards[0]) fade.samples.push({ t: performance.now(), out: cards[0].classList.contains('out'),
        opacity: Number(getComputedStyle(cards[0]).opacity) });
      if (!fade.stopped) requestAnimationFrame(sample);
    };
    document.addEventListener('transitionrun', event => {
      if (event.target.matches('.chapter-card') && event.propertyName === 'opacity')
        fade.events.push(event.target.classList.contains('out') ? 'out' : 'in');
    });
    requestAnimationFrame(sample);
  });
}
async function assertFade(page, label) {
  const fade = await page.evaluate(() => { window.fade.stopped = true; return window.fade; });
  fs.writeFileSync(path.join(out, `${label}-fade.json`), JSON.stringify(fade, null, 2) + '\n');
  const entry = fade.samples.filter(x => !x.out), exit = fade.samples.filter(x => x.out);
  assert.equal(fade.maxCards, 1, 'Multiple chapter cards overlapped');
  assert(entry.some(x => x.opacity < .1), 'Title appeared at full opacity on its first frame');
  assert(entry.some(x => x.opacity > .1 && x.opacity < .9), 'Missing intermediate fade-in frames');
  assert(entry.some(x => x.opacity >= .999), 'Title never became fully visible');
  assert(entry.filter(x => x.opacity >= .999).at(-1).t - entry.find(x => x.opacity >= .999).t >= 2000,
    'Fully visible reading time was shortened');
  assert(exit.some(x => x.opacity > .1 && x.opacity < .9), 'Missing intermediate fade-out frames');
  assert(exit.some(x => x.opacity < .02), 'Title was removed before fading out');
  assert.deepEqual(fade.events, ['in', 'out']);
  for (const [frames, direction] of [[entry, 1], [exit, -1]]) {
    for (let i = 1; i < frames.length; i++)
      assert(direction * (frames[i].opacity - frames[i - 1].opacity) >= -.01, 'Fade reversed unexpectedly');
  }
  assert.equal(await page.locator('.chapter-card, .chapter-title-shield').count(), 0);
}
async function sendAt(page, point, touch) {
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
}
async function advanceManually(page, finished, touch = false) {
  for (let i = 0; i < 50; i++) {
    if (await page.evaluate(finished)) return;
    if (touch) await page.locator('.vn-box').tap({ force: true });
    else await page.locator('.vn-box').click({ force: true });
    await page.waitForTimeout(80);
  }
  assert.fail('Manual advance did not finish');
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
    await page.locator('[data-test="title-layout-settings"]').tap();
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
    release(); await page.locator('.chapter-card.show').waitFor();
    // 表示開始から計る。drawn()は演出アニメの完了まで待つので、その後からでは残り時間を測れない。
    const visible = Date.now();
    await drawn(page, entry);
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
    await page.locator('.ch1-title-motion[data-art="ready"]').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => Number(document.querySelector('.ch1-title-motion')?.dataset.elapsed) >= 3150);
    assert.equal(await page.evaluate(() => __remake.state.chapter), 1);
    assert.equal(await page.locator('.ch1-title-motion canvas').count(), 1);
    assert.equal(await page.locator('.chapter-card').count(), 0);
    await page.screenshot({ path: path.join(out, 'new-game-chapter-1.png') });
    await page.locator('.ch1-title-motion').waitFor({ state: 'detached' });
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

  // 実VNの前後に同じ章表示処理を挟む。AUTO/SKIPは実ボタンで切り替え、turboは使わない。
  for (const [label, options] of [
    ['pc', {}], ['touch', { viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true }],
  ]) {
    for (const mode of ['normal', 'auto', 'skip']) {
      await check(`${label}-${mode}-fade-and-input`, async page => {
        let release, requested;
        const gate = new Promise(resolve => { release = resolve; });
        const seen = new Promise(resolve => { requested = resolve; });
        await page.route('**/ch4-title.webp', async route => { requested(); await gate; await route.continue(); });
        await observeFade(page);
        const point = await page.evaluate(async () => {
          const core = await import('./js/core/state.js'); core.newGame(); core.save();
          localStorage.setItem('suien_remake_seen_dialogue_lines', JSON.stringify([JSON.stringify(['qa-existing', 'main', 0])]));
          localStorage.setItem('suien_remake_slot1', 'preserve-manual');
          localStorage.setItem('unrelated', 'preserve');
          sessionStorage.setItem('unrelated', 'preserve-session');
          const ui = await import('./js/core/ui.js'), data = await import('./js/core/data.js');
          const vn = await import('./js/vn/engine.js');
          await ui.setBg(data.bgUrl('bg_tonari_inside', 'day'), { instant: true });
          const button = document.createElement('button'); button.textContent = '前場面の操作';
          Object.assign(button.style, { position: 'absolute', left: '40%', top: '45%', width: '20%', height: '10%' });
          window.underClicks = 0; button.onclick = () => window.underClicks++;
          ui.showScreen('qa-chapter-title', button);
          const r = button.getBoundingClientRect();
          window.sequencePhase = 'before'; window.sequenceError = null;
          const dialogue = id => ({ dialogue_id: id, lines: [{ speaker: 'hajime', text: id === 'qa-before' ? '前の場面。' : '次の場面。' }] });
          window.sequenceTask = vn.dialogueSequence(async () => {
            await vn.play(dialogue('qa-before'));
            button.focus(); window.sequencePhase = 'title';
            await ui.chapterTitle((await import('./js/core/chapter-title-art.js')).CHAPTER_TITLE_ART.find(x => x.chapter === 4));
            window.sequencePhase = 'after';
            await vn.play(dialogue('qa-after'));
            window.sequencePhase = 'done';
          }).catch(error => window.sequenceError = error.stack);
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        const before = await storageSnapshot(page);
        const stateBefore = await page.evaluate(() => JSON.stringify(__remake.state));
        await page.locator('#vn.active .vn-box').waitFor();
        if (mode === 'normal') await advanceManually(page, () => window.sequencePhase === 'title', label === 'touch');
        else if (label === 'touch') await page.locator(`[data-test="vn-${mode}"]`).tap();
        else await page.locator(`[data-test="vn-${mode}"]`).click();
        await seen;
        const duringTitle = mode === 'skip' ? before : withReadDialogue(before, ['qa-before']);
        assert.deepEqual(await storageSnapshot(page), duringTitle);
        assert.equal(await page.locator('.chapter-card').count(), 0, 'Unready image covered the previous scene');
        assert.equal(await page.locator('.chapter-title-shield').count(), 1, 'Loading left the previous controls live');
        await sendAt(page, point, label === 'touch');
        assert.equal(await page.evaluate(() => window.underClicks), 0, 'Input escaped while loading');
        assert.equal(await page.evaluate(() => window.sequencePhase), 'title');
        release();
        await page.waitForFunction(() => document.querySelector('.chapter-card.show'));
        await sendAt(page, point, label === 'touch');
        await page.waitForFunction(() => window.fade.samples.some(x => !x.out && x.opacity >= .999));
        assert.equal(await page.locator('.cc-copy').isVisible(), false);
        assert.equal(await page.evaluate(() => window.underClicks), 0, 'Input escaped during title');
        await page.waitForFunction(() => document.querySelector('.chapter-card.out'));
        assert.deepEqual(await storageSnapshot(page), duringTitle, 'Chapter title changed storage');
        await sendAt(page, point, label === 'touch');
        assert.equal(await page.evaluate(() => window.sequencePhase), 'title', 'Next scene began before fade-out completed');
        await page.locator('.chapter-title-shield').waitFor({ state: 'detached' });
        if (mode === 'normal') {
          await page.locator('#vn.active .vn-box').waitFor();
          assert.equal(await page.evaluate(() => window.sequencePhase), 'after');
          await advanceManually(page, () => window.sequencePhase === 'done', label === 'touch');
        } else await page.waitForFunction(() => window.sequencePhase === 'done');
        assert.equal(await page.evaluate(() => window.sequenceError), null);
        assert.equal(await page.evaluate(() => document.body.classList.contains('vn-skip')), false);
        assert.equal(await page.evaluate(() => window.underClicks), 0);
        await assertFade(page, `${label}-${mode}`);
        assert.deepEqual(await storageSnapshot(page), mode === 'skip' ? before : withReadDialogue(before, ['qa-before', 'qa-after']));
        assert.equal(await page.evaluate(() => JSON.stringify(__remake.state)), stateBefore);
        // ガード撤去後は通常のポインタ操作とフォーカス済みボタンのキー操作が再び使える。
        await sendAt(page, point, label === 'touch');
        assert.equal(await page.evaluate(() => window.underClicks), 3);
      }, options);
    }

    await check(`${label}-load-interrupted-title-and-preserve-legacy-slot`, async page => {
      const resources = value => ({ money: value.money, owned: value.owned, equip: value.equip,
        stats: value.stats, flavorStock: value.flavorStock, affinity: value.affinity });
      await page.evaluate(async () => {
        const core = await import('./js/core/state.js'); core.newGame();
        Object.assign(core.state, { phase: 'cleared', day: 14, slot: 2, money: 45678 });
        // 現行の第1章クリア済み保存はDAY7の卓上台を持っている。
        core.state.owned.push('home_rig_set');
        core.state.flags._ch1_preview_seen = true;
        __remake.vnTest.turbo = true;
        const ch1 = await import('./js/chapters/ch1.js'); ch1.setupHooks(); await ch1.showClear();
      });
      if (label === 'touch') await page.locator('[data-test="end-chapter2"]').tap();
      else await page.locator('[data-test="end-chapter2"]').click();
      await page.locator('.chapter-card.show').waitFor();
      const interrupted = await page.evaluate(() => JSON.parse(localStorage.getItem('suien_remake_save')));
      assert.equal(interrupted.flags._ch2_day1.titleSeen, false);
      // schema14の手動枠を残し、実LOADで現行へ移行する。元の手動枠は上書きしない。
      const legacy = { ...interrupted, schema: 14, flags: { ...interrupted.flags, _qa_preserved: true } };
      // 台がなかった旧保存を実LOAD。ほかの所持品・能力の厳密な比較は保持する。
      legacy.owned = legacy.owned.filter(id => id !== 'home_rig_set');
      delete legacy.trpg.club;
      const originalSlot = JSON.stringify(legacy);
      await page.evaluate(value => localStorage.setItem('suien_remake_slot1', value), originalSlot);
      await page.reload();
      await page.locator('[data-test="title-load"]').waitFor({ timeout: 30000 });
      await page.locator('#boot').waitFor({ state: 'detached' });
      await page.evaluate(() => { __remake.vnTest.turbo = true; });
      await observeFade(page);
      if (label === 'touch') {
        await page.locator('[data-test="title-load"]').tap(); await page.locator('[data-test="slot-1"]').tap();
      } else {
        await page.locator('[data-test="title-load"]').click(); await page.locator('[data-test="slot-1"]').click();
      }
      await page.locator('.chapter-card.show[data-chapter="第二章"]').waitFor();
      await page.locator('[data-test="ch2-main-map"]').waitFor({ timeout: 30000 });
      await assertFade(page, `${label}-load`);
      const loaded = await page.evaluate(() => __remake.state);
      assert.deepEqual(resources(loaded), resources(interrupted));
      assert.equal(loaded.owned.filter(id => id === 'home_rig_set').length, 1);
      assert.equal(loaded.chapter, 2); assert.equal(loaded.day, 15);
      assert.equal(loaded.flags._qa_preserved, true); assert.equal(loaded.flags._ch2_day1.titleSeen, true);
      assert.equal(loaded.flags._ch2_day1.stage, 'map');
      assert.equal(loaded.schema, await page.evaluate(async () => (await import('./js/core/state.js')).SCHEMA));
      assert.equal(await page.evaluate(() => localStorage.getItem('suien_remake_slot1')), originalSlot);
      // 読了済みオートセーブを再LOADしても、タイトルを二度出さない。
      await page.reload();
      await page.locator('[data-test="title-load"]').waitFor({ timeout: 30000 });
      await page.locator('#boot').waitFor({ state: 'detached' });
      await page.locator('[data-test="title-load"]').click(); await page.locator('[data-test="slot-0"]').click();
      await page.locator('[data-test="ch2-main-map"]').waitFor({ timeout: 30000 });
      assert.equal(await page.locator('.chapter-card, .chapter-title-shield').count(), 0);
      assert.deepEqual(resources(await page.evaluate(() => __remake.state)), resources(interrupted));
    }, options);
  }

  await check('timed-out-image-keeps-text-fallback-after-late-arrival', async page => {
    let release, requested;
    const gate = new Promise(resolve => { release = resolve; });
    const seen = new Promise(resolve => { requested = resolve; });
    await page.route('**/ch5-title.webp', async route => { requested(); await gate; await route.continue(); });
    const before = await storageSnapshot(page);
    await start(page, (await entries(page)).find(x => x.chapter === 5));
    await seen;
    const card = page.locator('.chapter-card.show'); await card.waitFor({ timeout: 20000 });
    assert.equal(await card.getAttribute('data-art'), 'text');
    release();
    await page.waitForTimeout(300);
    assert.equal(await card.locator('img').count(), 0, 'Late image replaced the fallback during display');
    assert.equal(await card.locator('.cc-copy').isVisible(), true);
    await done(page); assert.deepEqual(await storageSnapshot(page), before);
  });

  await check('preview-four-chapters-without-saving', async page => {
    await page.evaluate(() => {
      localStorage.setItem('suien_remake_save', 'preserve-original');
      localStorage.setItem('suien_remake_slot1', 'preserve-manual');
      localStorage.setItem('suien_remake_seen_dialogue_lines', JSON.stringify([JSON.stringify(['qa-existing', 'main', 0])]));
      localStorage.setItem('unrelated', 'preserve');
      sessionStorage.setItem('unrelated', 'preserve-session');
    });
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
