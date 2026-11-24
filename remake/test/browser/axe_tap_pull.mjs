// New default input: exercise real mouse and touch events, not injected game outcomes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { suite, baseURL, storageSnapshot } from './support.mjs';
import { flick, flickFromHandle, flickFromBoard, stanceAt } from './axe_flick_input.mjs';
const root = page => page.locator('[data-test="axe-game"]');
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="axe-game"]')?.dataset.phase === value, value);
const handle = page => page.locator('[data-test="axe-pull-handle"]');
const ready = page => page.locator('[data-test="axe-action"]:not([disabled])');
const shotsPath = process.env.COMPARISON_DIR;
if (shotsPath) await fs.mkdir(shotsPath, { recursive: true });
async function capture(page, label) { if (shotsPath) await page.screenshot({ path: `${shotsPath}/${label}.png` }); }
async function start(page, touch = false) {
  await page.goto(new URL('axe-throw.html', baseURL).href);
  await page.locator('[data-test="axe-start"]').waitFor();
  await page.evaluate(() => { localStorage.setItem('axe-pull-keep', 'unchanged'); sessionStorage.setItem('axe-pull-keep', 'unchanged'); });
  const before = await storageSnapshot(page);
  if (touch) await page.locator('[data-test="axe-start"]').tap(); else await page.locator('[data-test="axe-start"]').click();
  await phase(page, 'choice');
  await page.locator('.axe-cutin').waitFor({ state: 'detached' });
  return before;
}
// 2026-11-13 オーナー「タップで位置決めるのもむずい」「縦横の軸は最初のに戻してもいい、投げる時だけ」:
// 狙いは的のタップで横→縦の針を止めて決め（真ん中で止める）、投げる時だけ上へ弾く（的のどこからでも、右の取っ手からでも）。強さは弾く速さ。
async function aim(page, touch = false) {
  await stanceAt(page, { touch });
  await phase(page, 'power');
}
async function throwAxe(page, { touch = false, power = .62, from = 'board', lean = 0 } = {}) {
  await aim(page, touch);
  if (from === 'board') await flickFromBoard(page, { touch, power, lean });
  else await flickFromHandle(page, { touch, power, lean });
  await phase(page, 'result');
}
// キーボード: Space で構え、Space で横・縦の針を止める
async function keyStance(page) {
  for (const next of ['horizontal', 'vertical', 'power']) {
    await ready(page).waitFor({ state: 'attached' });
    await page.keyboard.press('Space');
    await phase(page, next);
  }
  await handle(page).waitFor();
}
// 着地点（刃先の印）と、触れて決めた狙い（金の輪）の横の差（的の絵の座標。半径164）
const driftX = page => page.evaluate(() => { const x = s => Number(/translate\(([-\d.]+)/.exec(document.querySelector(s).getAttribute('transform'))?.[1]); return x('.axe-impact-mark') - x('.axe-fixed-aim'); });
await suite('axe-tap-pull', async check => {
  for (const [label, context, touch] of [
    ['pc', { viewport: { width: 1280, height: 720 } }, false],
    ['touch-landscape', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
    ['touch-wide', { viewport: { width: 932, height: 430 }, isMobile: true, hasTouch: true }, true],
  ]) await check(`${label}-three-throws-and-storage`, async page => {
    const before = await start(page, touch);
    await capture(page, `${label}-aim`);
    for (let i = 0; i < 3; i++) {
      // 1・3投目は的に触れてそのまま弾く、2投目はタップで狙ってから右の取っ手で弾く
      await throwAxe(page, { touch, from: i === 1 ? 'handle' : 'board' });
      const power = Number(await root(page).getAttribute('data-power'));
      assert(Number.isFinite(power) && Math.abs(power - .62) < .06, `visible flick power ${power}`);
      if (i === 0) await capture(page, `${label}-result`);
      if (touch) await ready(page).tap(); else await ready(page).click();
      await phase(page, i === 2 ? 'summary' : 'choice');
    }
    await capture(page, `${label}-summary`);
    const stage = await root(page).boundingBox(), summary = await page.locator('.axe-panel').boundingBox();
    assert(stage && summary);
    assert(summary.x >= stage.x - 1 && summary.y >= stage.y - 1
      && summary.x + summary.width <= stage.x + stage.width + 1
      && summary.y + summary.height <= stage.y + stage.height + 1, 'summary stays inside the first-person stage');
    if (touch) await ready(page).tap(); else await ready(page).click();
    await page.locator('[data-test="axe-start"]').waitFor();
    assert.deepEqual(await storageSnapshot(page), before, 'standalone input must not alter save data');
  }, context);

  await check('first-touch-aim-does-not-measure-the-pull-track', async page => {
    await start(page, true);
    const geometry = await root(page).evaluate(node => {
      const point = new DOMPoint(330, 245).matrixTransform(node.querySelector('.axe-target .axe-board-scale').getScreenCTM());
      return { x: point.x, y: point.y };
    });
    await root(page).evaluate(node => {
      const measure = node.getBoundingClientRect;
      window.axeAimLayoutReads = 0;
      window.axeFirstScoreTile = node.querySelector('.axe-tile');
      node.getBoundingClientRect = function () {
        window.axeAimLayoutReads++;
        return measure.call(this);
      };
    });
    await page.touchscreen.tap(geometry.x, geometry.y);
    await phase(page, 'horizontal');
    await page.waitForFunction(() => Number(document.querySelector('.axe-game').dataset.held) >= 300);
    assert.equal(await page.evaluate(() => window.axeAimLayoutReads), 0,
      'starting and animating the aim must not synchronously measure the unrelated release track');
    assert(await root(page).evaluate(node => node.querySelector('.axe-tile') === window.axeFirstScoreTile),
      'the unchanged score tiles stay in place when aiming starts');
    await root(page).evaluate(node => { delete node.getBoundingClientRect; });

    // Resizing the stage below the track's 80px floor changes the scale, not its internal size.
    const trackSize = page => root(page).evaluate(node => {
      const height = node.getBoundingClientRect().height, scale = height / node.clientHeight;
      const expected = Math.max(80, Math.min(228, height * .32)) / scale;
      return { expected, actual: parseFloat(node.querySelector('.axe-pull-track').style.height) };
    });
    const initial = await trackSize(page);
    assert(Math.abs(initial.actual - initial.expected) < .01, 'initial release track matches the visible stage');
    await page.setViewportSize({ width: 740, height: 200 });
    await page.waitForFunction(() => {
      const node = document.querySelector('.axe-game'), height = node.getBoundingClientRect().height;
      return Math.abs(parseFloat(node.querySelector('.axe-pull-track').style.height) - 80 * node.clientHeight / height) < .01;
    });
    const resized = await trackSize(page);
    assert(Math.abs(resized.actual - resized.expected) < .01 && resized.actual > initial.actual + 5,
      'the release track still follows the viewport scale');
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check('flick-speed-lean-and-tap-only', async page => {
    await start(page);
    // 針を止めて構えた後、的に触れて離すだけ（弾かない）なら投げない。狙いも動かない
    await aim(page);
    const before = await root(page).evaluate(n => [n.dataset.aimX, n.dataset.aimY]);
    const corner = await page.locator('.axe-target').evaluate(node => { const q = new DOMPoint(200, 120).matrixTransform(node.getScreenCTM()); return { x: q.x, y: q.y }; });
    await page.mouse.click(corner.x, corner.y); await page.waitForTimeout(300);
    assert.equal(await root(page).getAttribute('data-phase'), 'power', 'a tap alone never throws');
    assert.equal(await root(page).getAttribute('data-player-throws'), '0');
    assert.deepEqual(await root(page).evaluate(n => [n.dataset.aimX, n.dataset.aimY]), before, 'touching the board while throwing does not move the aim');
    // 遅い弾きは柄から当たって落ちる、速すぎる弾きは回りすぎて落ちる
    for (const [power, reason] of [[.3, '柄から当たって落下'], [.95, '回りすぎて落下']]) {
      await flickFromHandle(page, { power }); await phase(page, 'result');
      const actual = Number(await root(page).getAttribute('data-power'));
      assert(Math.abs(actual - power) < .06, `flick speed sets the power: ${actual} / ${power}`);
      assert.match(await page.locator('.axe-note').innerText(), new RegExp(reason));
      await ready(page).click(); await phase(page, 'choice'); await aim(page);
    }
    // 斜めに弾くと横へ流れる（右へ傾けた弾きは、まっすぐより右に刺さる）
    await flickFromHandle(page, { power: .62, lean: .6 }); await phase(page, 'result');
    const drift = await driftX(page);
    assert(drift > 10, `a flick leaning right lands right of the aim: ${drift}`);
  });

  // 2026-11-22 オーナー要望「斧の絵は〇の中に／〇もスワイプに合わせて上に移動」:
  // グリップの円と斧は1つのグループで一体に動き、矢印の根元も円の上昇に追随する。離す（取消）と元に戻る。
  await check('grip-circle-holds-the-axe-and-rises-with-the-pull', async page => {
    await start(page);
    await aim(page);
    // 初回のデモアニメ（円が勝手に上下する）が終わってから測る
    await page.waitForFunction(() => document.querySelector('[data-test="axe-pull-handle"]')?.dataset.demonstrate === 'false', null, { timeout: 1600 }).catch(() => {});
    const structure = await page.evaluate(() => {
      const g = document.querySelector('.axe-swipe-grip');
      return { circles: g?.querySelectorAll(':scope > circle').length ?? 0, images: g?.querySelectorAll(':scope > image').length ?? 0 };
    });
    assert.equal(structure.circles, 1, 'the grip circle is inside the swipe grip group');
    assert.equal(structure.images, 1, 'the axe image is inside the same grip group');
    const measure = () => page.evaluate(() => {
      const g = document.querySelector('.axe-swipe-grip');
      const c = g.querySelector('circle').getBoundingClientRect(), i = g.querySelector('image').getBoundingClientRect();
      const d = document.querySelector('.axe-flick-arrow path').getAttribute('d');
      return {
        circleTop: c.top, circleCx: c.left + c.width / 2, circleCy: c.top + c.height / 2,
        imageCx: i.left + i.width / 2, imageCy: i.top + i.height / 2,
        unit: c.height / 58, base: Number(/^M72 ([\d.]+)/.exec(d)?.[1]),
        tip: Number(/Q[\d.]+ [\d.]+ [\d.]+ ([\d.]+)/.exec(d)?.[1]),
      };
    });
    const rest = await measure();
    assert(Math.abs(rest.circleCx - rest.imageCx) < 3 && Math.abs(rest.circleCy - rest.imageCy) < 3, 'at rest the axe sits centred in the circle');
    assert(Math.abs(rest.base - 218) < 1, `at rest the arrow starts at the grip: ${rest.base}`);
    const box = await handle(page).boundingBox(), stage = await root(page).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2, rise = stage.height * .12;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x, y - rise, { steps: 5 });
    await page.waitForTimeout(200);
    const held = await measure();
    const risen = rest.circleTop - held.circleTop;
    assert(risen > 40, `the circle rises with the pull: ${risen.toFixed(1)}px`);
    assert(Math.abs(held.circleCx - held.imageCx) < 3 && Math.abs(held.circleCy - held.imageCy) < 3, 'while pulled, the axe stays centred in the risen circle');
    assert(Math.abs(held.base - 218) < 1, `the arrow base stays at the initial position while the grip rises: ${held.base}`);
    assert(held.tip < rest.tip - 4, `the arrow arc stretches as the pull grows: tip ${rest.tip} -> ${held.tip}`);
    await page.keyboard.press('Escape'); await page.mouse.up();
    await page.waitForTimeout(200);
    const back = await measure();
    assert(Math.abs(back.circleTop - rest.circleTop) < 2, 'on release the grip circle returns to its rest position');
    assert(Math.abs(back.base - 218) < 1, 'on release the arrow base stays at the initial position');
    assert(Math.abs(back.tip - rest.tip) < 1, 'on release the arrow tip returns to rest');
  });

  await check('cancel-and-resize-never-spend-throw', async page => {
    const before = await start(page);
    for (const operation of ['return', 'sideways', 'escape', 'pointercancel', 'resize']) {
      await aim(page);
      const grip = await handle(page).boundingBox(), stage = await root(page).boundingBox();
      const x = grip.x + grip.width / 2, y = grip.y + grip.height / 2, rise = stage.height * .2;
      if (operation === 'sideways') await flick(page, { x, y, height: stage.height, rise: rise * .5, lean: 3 });
      else {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x, y - rise, { steps: 4 });
        if (operation === 'return') await page.mouse.move(x, y, { steps: 4 });
        if (operation === 'escape') await page.keyboard.press('Escape');
        if (operation === 'pointercancel') await handle(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true });
        if (operation === 'resize') await page.setViewportSize({ width: 1200, height: 700 });
        await page.mouse.up();
      }
      await page.waitForTimeout(1000);
      const current = await root(page).getAttribute('data-phase');
      assert(['choice', 'power'].includes(current), `${operation} must not launch a throw: ${current}`);
    }
    assert.deepEqual(await storageSnapshot(page), before);
    await throwAxe(page); await ready(page).click(); await phase(page, 'choice');
  });

  await check('keyboard-repeat-focus-and-next-throw', async page => {
    const before = await start(page);
    await aim(page);
    await page.locator('[data-test="axe-reaim"]:not([disabled])').click();
    await phase(page, 'choice');
    assert.equal(await root(page).evaluate(node => node === document.activeElement), true, 'reaim restores keyboard focus');
    for (let i = 0; i < 3; i++) {
      await keyStance(page);
      await page.keyboard.down('Space'); await page.waitForTimeout(620); await page.keyboard.up('Space');
      await phase(page, 'result');
      assert.equal(await root(page).getAttribute('data-player-throws'), String(i + 1));
      await ready(page).click(); await phase(page, i === 2 ? 'summary' : 'choice');
    }
    await page.locator('[data-test="axe-retry"]:not([disabled])').click();
    await phase(page, 'choice');
    assert.equal(await root(page).evaluate(node => node === document.activeElement), true, 'retry restores keyboard focus');
    await keyStance(page);
    await page.keyboard.down('Space'); await page.waitForTimeout(620); await page.keyboard.up('Space');
    await phase(page, 'result');
    assert.equal(await root(page).getAttribute('data-player-throws'), '1', 'retry starts a fresh game');
    assert.deepEqual(await storageSnapshot(page), before);
  });

  for (const [label, context, touch] of [
    ['pc', { viewport: { width: 1280, height: 720 } }, false],
    ['touch-landscape', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
    ['touch-short', { viewport: { width: 740, height: 320 }, isMobile: true, hasTouch: true }, true],
  ]) await check(`${label}-aim-controls-clear-of-hand`, async page => {
    await start(page, touch);
    const activate = locator => touch ? locator.tap() : locator.click();
    // 2026-11-21 オーナー指示: 腕と斧は描かない。手元レイヤーは全工程で出ず、操作部品は何にも隠れない。
    const checkControls = async step => {
      const controls = step === 'power' ? ['axe-focus', 'axe-reaim', 'axe-pull-handle'] : ['axe-focus', 'axe-reaim', 'axe-action'];
      const layout = await root(page).evaluate((game, { controls }) => {
        const blockers = controls.filter(name => {
          const button = game.querySelector(`[data-test="${name}"]`);
          if (!button) return true;
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return !button.contains(hit);
        });
        return {
          blockers,
          laneOpacity: game.querySelector('.axe-lane-aim')?.getAttribute('opacity'),
          frontOpacity: game.querySelector('.axe-hand-front-img')?.getAttribute('opacity'),
        };
      }, { controls });
      assert.deepEqual(layout.blockers, [], `${step}: each control must be reachable and clear`);
      assert.equal(layout.laneOpacity, '0', `${step}: the lane hand layer must stay hidden`);
      assert.equal(layout.frontOpacity, '0', `${step}: the front hand layer must stay hidden`);
    };
    for (const step of ['horizontal', 'vertical', 'power']) {
      await activate(ready(page));
      await phase(page, step);
      await checkControls(step);
    }
    // 取っ手を掴んで引いている間も手は出ない（引きの状態は dataset で分かる）
    const grip = await handle(page).boundingBox();
    const point = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    if (touch) {
      const cdp = await page.context().newCDPSession(page);
      try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await page.waitForFunction(() => document.querySelector('[data-test="axe-game"]')?.dataset.pulling === 'true');
        await checkControls('power');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      } finally { await cdp.detach(); }
    } else {
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await page.waitForFunction(() => document.querySelector('[data-test="axe-game"]')?.dataset.pulling === 'true');
      await checkControls('power');
      await page.mouse.up();
    }
    await activate(page.locator('[data-test="axe-reaim"]'));
    await phase(page, 'choice');
    assert.equal(await root(page).getAttribute('data-player-throws'), '0');
  }, context);

  await check('touch-cancel-and-second-finger', async page => {
    await start(page, true);
    for (const operation of ['cancel', 'second-finger']) {
      await aim(page, true);
      const grip = await handle(page).boundingBox(), stage = await root(page).boundingBox(), cdp = await page.context().newCDPSession(page);
      const p = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }, endY = p.y - stage.height * .2;
      try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: endY, id: 1 }] });
        if (operation === 'second-finger') await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: endY, id: 1 }, { x: p.x - 70, y: p.y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      } finally { await cdp.detach(); }
      await page.waitForTimeout(1000);
      const current = await root(page).getAttribute('data-phase');
      assert(['choice', 'power'].includes(current), `${operation} must cancel, not throw: ${current}`);
    }
    await throwAxe(page, { touch: true });
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  // 2026-11-13 手応えレビュー（桜井政博スキル準拠）: 止め・弾き損ねの札・強さの振り返り・装備の色・自動送り
  await check('hitstop-holds-the-contact-pose-and-the-result-shows-my-power', async page => {
    await page.goto(new URL('axe-throw.html?feel=freeze:contact', baseURL).href);
    await page.locator('[data-test="axe-start"]').click(); await phase(page, 'choice');
    await page.locator('.axe-cutin').waitFor({ state: 'detached' });
    await aim(page); await flickFromBoard(page, { power: .62 });
    await page.waitForTimeout(1200);
    assert.equal(await root(page).getAttribute('data-phase'), 'flight', 'freeze:contact keeps the contact frame');
    assert.equal(await root(page).getAttribute('data-hitstop'), 'true');
    assert.equal(await page.locator('.axe-flight-trail').getAttribute('opacity'), '0', 'no trail while the axe is held');
    assert.equal(await page.locator('.axe-flight').getAttribute('opacity'), '1');
    // 通常は、止めが明けてから結果へ（強さの振り返りは結果カードに残る）
    await start(page); await throwAxe(page, { power: .62 });
    assert.equal(await root(page).getAttribute('data-hitstop'), 'false');
    const review = page.locator('[data-test="axe-power-review"]');
    assert.equal(await review.isVisible(), true);
    assert.match(await review.innerText(), /↻\d+% ちょうどいい/);
    assert.match(await review.getAttribute('aria-label'), /回転 \d+% · ちょうどいい/);
    assert.match(await page.locator('[data-test="axe-zoom"] figcaption').innerText(), /回転 \d+%/);
    assert.equal(await root(page).getAttribute('data-impact'), 'celebration');
  });

  await check('failed-flick-says-why-and-keeps-the-throw', async page => {
    await start(page); await aim(page);
    const stage = await root(page).boundingBox(), p = await page.locator('.axe-target').evaluate(node => {
      const point = new DOMPoint(330, 245).matrixTransform(node.getScreenCTM()); return { x: point.x, y: point.y }; });
    for (const [options, words] of [[{ rise: stage.height * .025 }, /弾きが浅い/], [{ rise: stage.height * .2, lean: 3 }, /斜めすぎ/]]) {
      await flick(page, { x: p.x, y: p.y, height: stage.height, ...options });
      const cue = page.locator('[data-test="axe-flick-cue"]');
      await cue.waitFor(); assert.match(await cue.innerText(), words);
      assert.equal(await root(page).getAttribute('data-phase'), 'power'); assert.equal(await root(page).getAttribute('data-player-throws'), '0');
      await page.waitForTimeout(800);
    }
    // 浅いが一応上へ弾いた（画面の高さの4〜6%）は、弱い投げとして結果が返る
    await flick(page, { x: p.x, y: p.y, height: stage.height, rise: stage.height * .05 });
    await phase(page, 'result');
    assert.equal(await root(page).getAttribute('data-outcome'), 'drop');
    assert.match(await page.locator('.axe-note').innerText(), /柄から当たって落下/);
  });

  await check('own-axe-flies-and-sticks-in-its-colours', async page => {
    await page.goto(new URL('axe-throw.html', baseURL).href);
    await page.locator('[data-test="axe-start"]').waitFor();
    await page.evaluate(async () => { const { runAxeThrow } = await import('./js/minigames/axe.js');
      window.gearRun = runAxeThrow({ host: document.getElementById('axe-app'), mode: 'practice', opponent: null, gearId: 'gear_hatchet_precision' }); });
    await phase(page, 'choice');
    assert.equal(await page.locator('.axe-flight').getAttribute('data-gear'), 'gear_hatchet_precision');
    await throwAxe(page);
    const fill = await page.locator('.axe-impacts polygon[data-face^="head"]').first().getAttribute('fill');
    const house = await page.evaluate(async () => { const { projectedAxe } = await import('./js/minigames/axe-geometry.js'); const { impactPose } = await import('./js/minigames/axe-flight.js');
      const { resolveThrow } = await import('./js/minigames/axe-model.js'); return projectedAxe(impactPose(resolveThrow({ x: 0, y: 0, power: .62 }))).polygons.find(p => p.id.startsWith('head')).fill; });
    assert.notEqual(fill, house, 'the precision head is not the house steel');
  });

  await check('versus-auto-advance-and-board-tap-next-aim', async page => {
    await page.goto(new URL('axe-throw.html', baseURL).href);
    await page.locator('[data-test="axe-versus"]').click(); await page.locator('[data-test="axe-setup-start"]').click();
    await phase(page, 'choice'); await page.locator('.axe-cutin').waitFor({ state: 'detached' });
    await throwAxe(page);
    assert.equal(await root(page).getAttribute('data-auto'), 'opponent');
    // ボタンを押さなくても相手の番へ進み、相手の結果からも自分の番へ戻る（タップで即）
    await phase(page, 'opponent-ready'); await phase(page, 'result');
    assert.equal(await root(page).getAttribute('data-actor'), 'opponent');
    assert.equal(await root(page).getAttribute('data-auto'), 'player');
    await page.waitForTimeout(650);
    // 相手の結果の間に的へ触れると、次の投の構え（宣言を選べる所）へ進む
    const p = await page.locator('.axe-target').evaluate(node => { const point = new DOMPoint(480, 420).matrixTransform(node.getScreenCTM()); return { x: point.x, y: point.y }; });
    await page.mouse.click(p.x, p.y);
    await phase(page, 'choice');
    assert.equal(await root(page).getAttribute('data-actor'), 'player');
    assert.equal(await root(page).getAttribute('data-player-throws'), '1');
    await throwAxe(page);
    await phase(page, 'opponent-ready'); await phase(page, 'result'); await phase(page, 'choice');
    assert.equal(await root(page).getAttribute('data-opponent-throws'), '2');
  });
}, { entry: new URL('axe-throw.html', baseURL).href, readySelector: '[data-test="axe-start"]', freshBrowserPerCase: true });

// 2026-11-13 オーナー「狙いの定め方が分かりずらい、的の真ん中かキルショットのやつとか」: 金の三角が止めたい所を指し、針が重なると緑になる
await suite('axe-tap-pull-aim-guide', async check => {
  await check('called-throws-spend-on-landing-and-skip-closed-rows', async page => {
    await start(page);
    await page.clock.install({ time: new Date('2026-11-19T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-19T12:00:01Z'));
    await page.clock.runFor(300);
    const picker = page.locator('[data-test="axe-call-picker"]');
    const remaining = () => page.locator('.axe-score-calls').first().getAttribute('data-remaining');
    const blue = await page.evaluate(async () => {
      const { KILLS, AIM_RANGE } = await import('./js/minigames/axe-model.js');
      const target = KILLS.find(k => k.id === 'upper-left');
      return { x: (target.x / AIM_RANGE + 1) / 2, y: (target.y / AIM_RANGE + 1) / 2 };
    });
    await picker.click();
    assert.equal(await page.locator('.axe-call-iris').getAttribute('data-cue'), 'declare');
    await stanceAt(page, blue);
    await flickFromHandle(page);
    await page.clock.runFor(2300);
    await phase(page, 'result');
    assert.equal(await remaining(), '1');
    assert.equal(await page.locator('.axe-call-iris').getAttribute('data-cue'), 'hit');
    assert.equal(await page.locator('.axe-prize-score').textContent(), await page.locator('.axe-score-burst').textContent());
    assert.equal(await root(page).getAttribute('data-outcome'), 'killshot');
    assert.equal(await page.locator('[data-test="axe-call-verdict"]').getAttribute('data-result'), 'hit');
    await ready(page).click();
    await stanceAt(page);
    await page.clock.runFor(320);
    for (const id of ['lower-left', 'lower-right', '', 'lower-left']) {
      await picker.click();
      assert.equal(await root(page).getAttribute('data-called'), id);
      assert.equal(await remaining(), '1');
    }
    await flickFromHandle(page);
    await page.clock.runFor(2300);
    await phase(page, 'result');
    assert.equal(await root(page).getAttribute('data-outcome'), 'killshot-miss');
    assert.equal(await page.locator('.axe-call-iris').getAttribute('data-cue'), 'miss');
    assert.equal(await page.locator('.axe-prize-score').count(), 0);
    assert.equal(await page.locator('[data-test="axe-call-verdict"]').getAttribute('data-result'), 'miss');
    assert.equal(await remaining(), '0');
    await ready(page).click();
    await phase(page, 'choice');
    await page.clock.runFor(320);
    assert(await picker.isDisabled());
    assert.equal(await page.locator('[data-test="axe-call-verdict"]').isVisible(), false);
  });
  await check('gold-marks-point-at-the-bull-then-at-the-declared-blue', async page => {
    await page.goto(new URL('axe-throw.html', baseURL).href);
    await page.locator('[data-test="axe-start"]').click(); await phase(page, 'choice');
    await page.locator('.axe-cutin').waitFor({ state: 'detached' });
    const mark = step => page.locator(`.axe-aim-guide[data-guide="${step}"]`);
    const markX = () => mark('horizontal').evaluate(n => Number(/translate\(([-\d.]+)/.exec(n.getAttribute('transform'))[1]));
    // 何も宣言しなければ真ん中の赤（的の絵の x=330）
    const p = await page.locator('.axe-target').evaluate(node => { const q = new DOMPoint(480, 420).matrixTransform(node.getScreenCTM()); return { x: q.x, y: q.y }; });
    await page.mouse.click(p.x, p.y); await phase(page, 'horizontal');
    assert.equal(await mark('horizontal').getAttribute('opacity'), '1'); assert.equal(await mark('vertical').getAttribute('opacity'), '0');
    assert.equal(await markX(), 330);
    await page.waitForFunction(() => document.querySelector('[data-test="axe-game"]').dataset.onTarget === 'true', null, { polling: 'raf', timeout: 5000 });
    assert.equal(await root(page).getAttribute('data-aim-goal'), 'bull');
    assert.equal(await page.locator('.axe-x-needle').getAttribute('stroke'), '#8ff0a4', 'the needle turns green over the mark');
    assert.equal(await page.locator('[data-test="axe-aim-prompt"]').count(), 0, 'the aim prompt was removed to slim the UI');
    assert.equal(await page.locator('.axe-gauge-label').count(), 0, 'the steps label replaces the axis pictograms');
    await page.locator('[data-test="axe-reaim"]:not([disabled])').click(); await phase(page, 'choice');
    const picker = page.locator('[data-test="axe-call-picker"]');
    const cancel = page.locator('[data-test="axe-call-cancel"]');
    const remaining = page.locator('.axe-score-calls').first();
    assert.equal(await cancel.isVisible(), false);
    for (const [index, id] of ['upper-left', 'lower-left', 'upper-right', 'lower-right', ''].entries()) {
      await picker.click();
      assert.equal(await root(page).getAttribute('data-called'), id);
      assert.equal(await cancel.isVisible(), Boolean(id));
      assert.equal(await remaining.getAttribute('data-remaining'), '2');
      if (id) {
        assert.equal(await page.locator('.axe-call-iris').getAttribute('data-cue'), index ? 'turn' : 'declare');
        assert.equal(await picker.locator('.selected').getAttribute('data-blue'), id);
        assert.equal(await page.locator('.axe-declare').getAttribute('data-kind'), index ? 'retarget' : 'challenge');
      }
    }
    assert.equal(await page.locator('.axe-call-iris').count(), 0);
    await picker.focus();
    await page.keyboard.press('Space');
    assert.equal(await root(page).getAttribute('data-called'), 'upper-left');
    await page.keyboard.press('Escape');
    assert.equal(await root(page).getAttribute('data-called'), '');
    await page.keyboard.press('Enter');
    await cancel.click();
    assert.equal(await root(page).getAttribute('data-called'), '');
    await picker.click();
    assert.match(await picker.getAttribute('aria-label'), /左上.*宣言中/);
    await page.mouse.click(p.x, p.y); await phase(page, 'horizontal');
    assert.equal(await root(page).getAttribute('data-called'), 'upper-left', 'a tap away from the centre keeps the call');
    assert(await markX() < 330 - 60, 'the mark moves to the upper-left blue');
    await page.waitForFunction(() => document.querySelector('[data-test="axe-game"]').dataset.onTarget === 'true', null, { polling: 'raf', timeout: 5000 });
    assert.equal(await root(page).getAttribute('data-aim-goal'), 'kill');
  });
}, { entry: new URL('axe-throw.html', baseURL).href, readySelector: '[data-test="axe-start"]', freshBrowserPerCase: true });
