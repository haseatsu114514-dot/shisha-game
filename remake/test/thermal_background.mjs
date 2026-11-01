// 実温度の引継ぎ、吸い方・炭による上下、描画・スマホ・低減モード。
// 序盤は色のない灰色→ぬるいうちに暖かい色→緑は安定・最適温だけ静かな虹、超えるとだんだん火事のように黄色→赤の炎（TH09・TH12・TH13・TH24）。
// 温度計の一番上で爆発して焦げる（TH06）。ボウルは燃やさない（TH04）。熱管理は「炭を交換しますか？」→交換する炭を炭焼き→吸い出しと同じダイヤル（TH14・TH21・TH39）。冷え切り・フレーバー切れもダメになる（TH19・TH20）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLoadingComicReader } from './browser/loading_reader.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const errors = [];
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await installLoadingComicReader(page);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'); core.newGame();
    const session = await import('./js/craft/session.js');
    const steam = await import('./js/craft/steam.js');
    const pull = await import('./js/craft/pull.js');
    const care = await import('./js/craft/care.js');
    const thermal = await import('./js/craft/thermal.js');
    const conditions = await import('./js/craft/conditions.js');
    window.T = { core, session, steam, pull, care, thermal, conditions };
    window.cs = session.newSession('drill');
    const b = session.openBench(cs);
    while (!b.root.isConnected) await new Promise(requestAnimationFrame);
  });
  const band = () => page.locator('.bench').getAttribute('data-thermal-band');
  const pixels = () => page.locator('.thermal-backdrop').evaluate(c => c.toDataURL());
  const mean = () => page.locator('.thermal-backdrop').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return [r / n, g / n, b / n].map(Math.round);
  });
  // 鮮やかな画素の色相を6つに分け、何色が見えているか数える（虹なら5色以上）。
  const hues = () => page.locator('.thermal-backdrop').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, bins = Array(6).fill(0); let n = 0;
    for (let i = 0; i < d.length; i += 4 * 13) {
      const [r, g, b] = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255], max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < .35 || max < .45) continue;
      const hue = max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
      bins[Math.floor(hue) % 6]++; n++;
    }
    return bins.filter(v => v > n * .02).length;
  });
  const haze = async () => [await page.locator('.bench').getAttribute('data-thermal-haze'), await page.locator('.bench-worker-stage').evaluate(e => e.style.filter)];
  const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
  // 温度計と同じ適温端点。上限／不正値でも描画可能。
  assert.deepEqual(await page.evaluate(() => [0,.30,.42,.66,.6601,.76,.80,.85,.8999,.90,NaN].map(temp => T.thermal.thermalBand(T.conditions.visualTemperature(temp))).map(b=>b.id)),
    ['cold','warming','ready','ready','hot','fire','fire','fire','fire','inferno','cold']);
  // 爆発は温度計の一番上だけ。
  assert.deepEqual(await page.evaluate(() => [.98, .999, 1].map(T.conditions.isBurnt)), [false, false, true]);
  await page.evaluate(() => T.session.stepPanel('heat','炭焼き'));
  assert(!(await page.locator('.thermal-backdrop').isVisible()));
  // 前回の一台の灼熱を蒸らしへ持ち越さず、炭を置いた直後の温度から始める。
  await page.evaluate(() => { T.session.stepPanel('pull','x'); T.session.setBenchTemperature(cs,.96); T.session.stepPanel('steam','蒸らし時間'); });
  assert.equal(await band(), 'cold');
  // 見出しは素材スキンより後の紫の帯で読める。台の上は煙だけで、ボウルは燃やさない。
  assert.match(await page.locator('.bench-top').evaluate(e=>getComputedStyle(e).backgroundImage), /rgba\(81, 50, 105/);
  const layout = await page.evaluate(() => {
    const eq = document.querySelector('.worker-equipment'), pic = eq.querySelector('.thermal-picture').getBoundingClientRect(), bowl = eq.querySelector('.worker-bowl').getBoundingClientRect();
    return { first: eq.firstElementChild.classList.contains('thermal-picture'), base: pic.bottom, bowlTop: bowl.top, bowlBottom: bowl.bottom, top: pic.top, stage: document.querySelector('.bench-worker-stage').getBoundingClientRect().top };
  });
  assert(layout.first, 'smoke picture must be behind the shisha parts');
  assert(layout.base > layout.bowlTop && layout.base < layout.bowlBottom, `smoke base ${layout.base} is not inside the bowl ${layout.bowlTop}-${layout.bowlBottom}`);
  assert(layout.top >= layout.stage, 'smoke picture leaves the stage');
  assert.equal(await page.locator('.thermal-flame').count(), 0, 'the bowl must not burn');
  await page.evaluate(() => { cs.steamSeconds=300; window.run=T.steam.runSteamDodge(cs); });
  await page.locator('[data-test="dodge-refresh"]:not([disabled])').waitFor();
  await page.waitForTimeout(600);
  const before = Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'));
  const beforePixels = await pixels();
  await page.waitForTimeout(250);
  assert.notEqual(await pixels(), beforePixels, 'Steam background stopped moving');
  assert(Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature')) > before, 'Steam heat stopped rising');
  await page.waitForSelector('.result-card.show', { timeout: 35000 });
  const end = await page.evaluate(() => cs.steam.temp);
  assert(Math.abs(Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'))-end)<.0001);
  await shot('steam-temperature');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);

  // 吸い出しにその温度が渡り、待機中は予測針と背景を混同しない。
  await page.evaluate(() => { window.run=T.pull.runPull(cs); });
  await page.waitForSelector('.pg-needle');
  assert(Math.abs(Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'))-end)<.0001);
  await page.waitForTimeout(3200);
  assert(Math.abs(Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'))-end)<.0001);
  // 通常の入力で工程を終えてから、同じベンチの背景を比較する。
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-test="pull-stop"]:not([disabled])').waitFor();
    await page.keyboard.press('Space');
    await page.locator('.pull-play[data-draw]').waitFor({ state: 'hidden' });
  }
  await page.keyboard.press('Enter');
  await page.waitForSelector('.result-card.show');
  // 吸った後は、吸い方で上下した提供温度と背景が一致する。
  assert(Math.abs(Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'))-await page.evaluate(()=>cs.pull.temp))<.0001);
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  const images=[], colors={}, glows=[], hazes={}, rainbow={};
  for (const [temp, expected] of [[.2,'cold'],[.4,'warming'],[.46,'ready'],[.54,'optimal'],[.70,'hot'],[.83,'fire'],[.96,'inferno']]) {
    await page.evaluate(t=>{T.session.stepPanel('pull','温度のイメージ');T.session.setBenchTemperature(cs,t);},temp);
    assert.equal(await band(),expected); images.push(await pixels());
    colors[expected] = await mean();
    hazes[expected] = await haze();
    rainbow[expected] = await hues();
    glows.push(Number(await page.locator('.bench').evaluate(e => getComputedStyle(e).getPropertyValue('--thermal-glow-strength'))));
    await shot(`temperature-${expected}`);
  }
  assert.equal(new Set(images).size,7,'temperature pictures are identical');
  const [cr, cg, cb] = colors.cold, [gr, gg, gb] = colors.ready, [hr, hg, hb] = colors.hot, [fr, fg, fb] = colors.fire, [ir, ig, ib] = colors.inferno;
  assert(Math.max(cr, cg, cb) - Math.min(cr, cg, cb) < 22 && cr + cg + cb > 3 * 150, `the start is not colorless: ${colors.cold}`);
  const [wr, wg, wb] = colors.warming;
  assert(wr > wb + 25, `lukewarm is not turning warm: ${colors.warming}`);
  assert(rainbow.optimal >= 5, `ideal is not a rainbow: ${rainbow.optimal} hues`);
  assert(rainbow.cold <= 2, `cold already shows many colors: ${rainbow.cold}`);
  assert(fr > fg + 60 && fr > fb + 80, `overheat is not red: ${colors.fire}`);
  assert(hr > hb + 40 && hr > hg + 30, `hot stage is not turning warm: ${colors.hot}`);
  assert(ir > ig + 40 && ir > ib + 60, `inferno is not red-hot: ${colors.inferno}`);
  for (const name of ['hot', 'fire', 'inferno']) { const [r, g, b] = colors[name]; assert(!(b > r + 30 && b > g), `${name} uses blue or purple fire: ${[r, g, b]}`); }
  // 緑・虹はゆらさず、過熱だけに陽炎を出す。
  assert.equal(hazes.cold[0], '0'); assert.equal(hazes.cold[1], '');
  assert.deepEqual(hazes.ready, ['0', '']); assert.deepEqual(hazes.optimal, ['0', '']);
  assert(rainbow.ready <= 2, 'Green ideal band already shows a rainbow');
  assert(Number(hazes.hot[0]) > 0, 'Overheat haze disappeared');
  // 同じ温度帯の中でも、温度に沿って絵が少しずつ移る（だんだん火事になる）。
  const within = [];
  for (const t of [.78, .83, .88]) { await page.evaluate(v => T.session.setBenchTemperature(cs, v), t); await page.waitForTimeout(120); within.push(await pixels()); }
  assert.equal(await band(), 'fire'); assert.equal(new Set(within).size, 3, 'the fire band does not change gradually');
  assert.deepEqual([...glows].sort((a, b) => a - b), glows, `scene glow does not grow with heat: ${glows}`);

  // 熱管理: 「そろそろ調整の準備をしよう」→「炭を交換しますか？」で個数。温度計はこの時点で出る。交換する炭を炭焼きで焼き、
  // 交換した炭で温度が戻る。ダイヤルのゲームが始まると炭が燃え進んで温度が動き続ける。最低1回吸って整え終える。
  const backdropTemp = async () => Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'));
  // 針が指定の範囲（%）に来た瞬間に吸う。
  const pullAt = (lo, hi) => page.evaluate(async ([a, b]) => {
    const needle = document.querySelector('.pg-needle'), at = () => parseFloat(needle.dataset.pos);
    const button = document.querySelector('[data-test="pull-stop"]');
    while (button.disabled) await new Promise(requestAnimationFrame);
    while (!(at() >= a && at() <= b)) await new Promise(requestAnimationFrame);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    while (document.querySelector('.pull-play').dataset.draw) await new Promise(requestAnimationFrame);
  }, [lo, hi]);
  await page.evaluate(() => { cs.pull.temp = .46; window.run = T.care.runCare(cs); });
  await page.waitForSelector('[data-test="care-coals"]');
  assert.match(await page.locator('.care-coals-lead').textContent(), /調整/);
  assert.match(await page.locator('.care-coals-ask').textContent(), /炭を交換しますか？/);
  assert(await page.locator('.pull-care [data-test="pull-temperature"]').isVisible(), 'thermometer must show while choosing coals');
  assert.equal(await page.locator('.pull-care [data-test="thermo-cold"]').count(), 1);
  // 温度計は切れ目のないグラデーション。適温は管の色そのもの（別の色の板を重ねない）で、真ん中に虹の最適温を挟む。
  // 文字の目盛りは置かず、焦げる帯に炎・冷え切り帯に雪の印。焦げると冷え切りの帯は狭い。現在地は管の外の矢印でも示す。
  const gaugeLook = await page.evaluate(() => {
    const q = (sel) => document.querySelector(`.pull-care ${sel}`), h = (sel) => q(sel).getBoundingClientRect().height, tube = h('.thermo-tube');
    return { zone: getComputedStyle(q('.thermo-zone')).backgroundImage, optimalInside: q('.thermo-optimal').getBoundingClientRect().top > q('.thermo-zone').getBoundingClientRect().top,
      rainbow: getComputedStyle(q('.thermo-optimal')).backgroundImage.split('rgb').length - 1, scale: getComputedStyle(q('.thermo-scale')).backgroundImage.includes('linear-gradient'),
      marks: !!q('.thermo-danger .thermo-icon.flame') && !!q('.thermo-cold .thermo-icon.snow'), words: document.querySelectorAll('.pull-care .thermo-labels').length,
      danger: h('.thermo-danger') / tube, cold: h('.thermo-cold') / tube, pointer: !!q('[data-test="thermo-pointer"]') };
  });
  assert.equal(gaugeLook.zone, 'none', 'the ideal band must be the gauge gradient itself');
  assert(gaugeLook.rainbow >= 6 && gaugeLook.scale, `the optimal band is not a rainbow on a gradient: ${JSON.stringify(gaugeLook)}`);
  assert(gaugeLook.marks && gaugeLook.words === 0, `gauge must use marks instead of words: ${JSON.stringify(gaugeLook)}`);
  assert(gaugeLook.optimalInside && gaugeLook.pointer, JSON.stringify(gaugeLook));
  assert(gaugeLook.danger > .085 && gaugeLook.danger < .115 && gaugeLook.cold < .07, `danger zones have the wrong size: ${JSON.stringify(gaugeLook)}`);
  assert(!(await page.locator('.pull-play').isVisible()), 'the needle game shows before choosing coals');
  // 交換する炭は、もう一度炭焼きで焼く（個数ぶんだけ）。取り出し終えると交換して温度が戻る。
  const burnCoalsNow = async (n) => {
    await page.waitForSelector('.care-burn [data-test="coal-0"][data-phase]', { timeout: 8000 });
    assert.equal(await page.locator('.care-burn .coal').count(), n, `must burn ${n} coals for the swap`);
    for (let i = 0; i < n; i++) await page.locator(`.care-burn [data-test="coal-${i}"]`).dispatchEvent('pointerdown');
  };
  const chosen = await backdropTemp();
  await page.locator('[data-test="care-coal-2"]').click();
  await burnCoalsNow(2);
  await page.waitForFunction(() => parseFloat(document.querySelector('.pg-needle').dataset.pos) > 0, null, { timeout: 15000 });
  const swapped = await backdropTemp();
  assert(swapped > chosen + .03, `coal swap did not raise the temperature: ${chosen} -> ${swapped}`);
  assert.equal(await page.locator('.pull-drift').count(), 1, 'heat care must show the falling heat');
  assert.equal(await page.evaluate(() => cs.heat?.picks?.length ?? 0), 0, 'the swap burn must not overwrite the first coal result');
  assert(await page.locator('[data-test="pull-serve"]').isDisabled(), 'can finish heat care without pulling');
  await page.waitForTimeout(500);
  assert.notEqual(await backdropTemp(), swapped, 'heat care temperature does not move');
  await pullAt(45, 55);
  assert(!(await page.locator('[data-test="pull-serve"]').isDisabled()), 'one pull should be enough to finish');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.result-card.show');
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), '熱管理 結果');
  assert.deepEqual(await page.evaluate(() => [cs.care.pulls, cs.care.coals]), [1, 2]);
  assert(Math.abs(await backdropTemp() - await page.evaluate(() => cs.care.temp)) < .0001);
  await shot('care-pulled');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);

  // TH94・TH95: 左に赤い葉の持ち、右に吸った回数の5つの点。5回で吸えなくなる。3回目から吸いすぎ（葉が1枚ずつ焦げる・疲れ・減点）。
  await page.evaluate(() => { cs.pull.temp = .54; cs.leaf = { hp: 2, max: 5, burn: 0 }; window.run = T.care.runCare(cs); });
  await page.locator('[data-test="care-coal-0"]').click();
  await page.waitForFunction(() => parseFloat(document.querySelector('.pg-needle').dataset.pos) > 0);
  assert(await page.locator('[data-test="leaf-icon"]').isVisible(), 'the five-leaf life indicator must be visible');
  assert(await page.locator('[data-test="pull-count"]').isVisible(), 'the pull counter must be visible');
  const boxes = await page.locator('.pull-summary > .pull-life').evaluateAll(ns => ns.map(n => n.getBoundingClientRect().left));
  assert(boxes.length === 2 && boxes[0] < boxes[1], 'flavor life must sit left of the pull counter');
  await pullAt(45, 55); await pullAt(45, 55);
  assert.equal(await page.locator('[data-test="leaf-icon"]').getAttribute('data-hp'), '2', 'the first two pulls must not hurt the flavor');
  assert.equal(await page.locator('[data-test="pull-count"]').getAttribute('data-pulls'), '2');
  assert.equal(await page.locator('.bench-worker').getAttribute('data-fatigue'), '0', 'calm pulls must not tire Hajime');
  const staminaBefore = await page.evaluate(() => T.core.state.stamina);
  await pullAt(45, 55);
  assert.equal(await page.locator('[data-test="leaf-icon"]').getAttribute('data-hp'), '1');
  assert.equal(await page.locator('.leaf-icon.hit').count(), 1, 'the leaf must tremble when damaged');
  assert.equal(await page.locator('.stamp', { hasText: 'ダメージ' }).count(), 0, 'damage must not show text');
  // 吸いすぎで、はじめの体力も削れて疲れが付く。札ではなく、作業中のはじめの表情と汗で見せる。
  assert.equal(await page.locator('.bench-worker').getAttribute('data-fatigue'), '1', 'over-pulling must tire Hajime');
  assert.equal(await page.locator('.bench-worker').getAttribute('data-face'), 'normal');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.worker-sweat')).opacity) > .5, null, { timeout: 2000 }); // 疲れたはじめは汗をかく
  assert(await page.evaluate(() => T.core.state.stamina) < staminaBefore, 'over-pulling must cost stamina');
  await shot('leaf-damage');
  await pullAt(45, 55);
  assert.deepEqual(await page.locator('.flavor-leaf').evaluateAll(ns => ns.map(n => n.dataset.stage)), ['gone', 'gone', 'gone', 'black', 'red']);
  assert.equal(await page.evaluate(() => cs.leaf.hp), 1, 'the next red leaf must stay fresh while the current leaf is black');
  await pullAt(45, 55);
  assert.deepEqual(await page.locator('.flavor-leaf').evaluateAll(ns => ns.map(n => n.dataset.stage)), ['gone', 'gone', 'gone', 'gone', 'red']);
  assert.equal(await page.locator('[data-test="pull-count"] .pull-count-num').textContent(), '5/5');
  assert(await page.locator('[data-test="pull-stop"]').isDisabled(), 'five pulls is the cap');
  assert(!(await page.locator('[data-test="pull-serve"]').isDisabled()), 'serving stays available at the cap');
  await page.keyboard.press(' ');
  assert.equal(await page.locator('.pull-play').getAttribute('data-draw'), null, 'Space must not start a sixth pull');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.result-card.show');
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), '熱管理 結果');
  assert.deepEqual(await page.evaluate(() => [cs.care.pulls, cs.failed ?? null, cs.leaf.hp]), [5, null, 1]);
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);

  // 最後の赤が茶色になって赤0枚になると失敗する。
  await page.evaluate(() => { cs.pull.temp = .54; cs.leaf = { hp: 1, max: 5, burn: 0 }; window.run = T.care.runCare(cs); });
  await page.locator('[data-test="care-coal-0"]').click();
  await page.waitForFunction(() => parseFloat(document.querySelector('.pg-needle').dataset.pos) > 0);
  await pullAt(45, 55); await pullAt(45, 55); await pullAt(45, 55);
  await page.waitForSelector('.result-card.show');
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), 'フレーバーがダメになってしまった');
  assert.deepEqual(await page.evaluate(() => [cs.failed, cs.care.failed, cs.leaf.hp]), ['leaf', 'leaf', 0]);
  assert.equal(await band(), 'leaf-out');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);

  // 提供後に炭を替えずに放っておくと冷え切って、その一台はダメになる。
  await page.evaluate(() => { cs.failed = null; cs.pull.temp = .2; Math.random = () => .99; window.run = T.care.runCare(cs); });
  await page.locator('[data-test="care-coal-0"]').click();
  await page.waitForSelector('.result-card.show', { timeout: 20000 });
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), 'シーシャが冷え切ってしまった');
  assert.deepEqual(await page.evaluate(() => [cs.failed, cs.care.failed]), ['cold', 'cold']);
  assert.equal(await band(), 'cold-out');
  await shot('cold-out');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  await page.evaluate(() => { cs.failed = null; });

  // 吸い出しで温度計の一番上まで上げると爆発し、焦げた背景と「焦げてしまった」の結果になる。
  await page.evaluate(() => { cs.steam = { ...cs.steam, temp: .995 }; cs.pull = null; window.run = T.pull.runPull(cs); });
  await page.waitForSelector('.pg-needle');
  await page.evaluate(async () => {
    const needle = document.querySelector('.pg-needle'), at = () => parseFloat(needle.dataset.pos);
    while (document.querySelector('[data-test="pull-stop"]').disabled) await new Promise(requestAnimationFrame);
    while (at() < 75) await new Promise(requestAnimationFrame);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  });
  await page.waitForSelector('.bench.thermal-burnt[data-thermal-band="burnt"]');
  await page.waitForSelector('.result-card.show');
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), 'シーシャが焦げてしまった');
  assert.deepEqual(await page.evaluate(() => [cs.burnt, cs.pull.failed, cs.pull.score]), [true, 'burnt', 0]);
  assert.equal(await page.locator('[data-test="screen-blast"]').count(), 0, 'the full-screen blast must clean up');
  assert(Math.max(...await page.locator('.thermal-backdrop').evaluate(c => [...c.getContext('2d').getImageData(4, 4, 1, 1).data].slice(0, 3))) < 110, 'burnt background is not charred');
  await shot('burnt-pull');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  // 熱管理: 焦げる寸前で炭を3個も替えると、吸わなくても一番上へ届いて画面全体が爆発する。
  await page.evaluate(() => { cs.burnt = false; cs.failed = null; cs.pull = { ...cs.pull, temp: .93 }; window.run = T.care.runCare(cs); });
  await page.locator('[data-test="care-coal-3"]').click();
  await burnCoalsNow(3);
  await page.waitForSelector('[data-test="screen-blast"]', { timeout: 8000 });
  await shot('screen-blast');
  await page.waitForSelector('.result-card.show', { timeout: 15000 });
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), 'シーシャが焦げてしまった');
  assert.deepEqual(await page.evaluate(() => [cs.burnt, cs.care.failed, cs.care.score]), [true, 'burnt', 0]);
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  await page.evaluate(() => { T.session.stepPanel('pull', '温度のイメージ'); T.session.setBenchTemperature(cs, .54); });
  assert.equal(await band(), 'optimal');
  assert.equal(await page.locator('.bench.thermal-burnt, .bench.thermal-ruined').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(()=>{T.session.stepPanel('pull','温度のイメージ');T.session.setBenchTemperature(cs,.96);});
  await page.waitForTimeout(120); const still=await pixels();
  await page.waitForTimeout(200); assert.equal(await pixels(),still);
  assert.equal(await page.locator('.thermal-wisps').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(await haze(), ['0', ''], 'reduced motion still warps the scene');
  await page.setViewportSize({width:390,height:844});
  // 画面の縮小は resize イベントの後に走るので、収まるのを待ってから測る。
  await page.waitForFunction(() => document.querySelector('.bench').getBoundingClientRect().width <= 391, null, { timeout: 3000 });
  await shot('temperature-mobile');
  const bounds=await page.locator('.bench').boundingBox();assert(bounds.width<=391);
  await page.evaluate(()=>T.session.stepPanel('holes','穴あけ'));
  assert(!(await page.locator('.thermal-backdrop').isVisible()));
  assert.deepEqual(errors,[]);
  console.log('PASS: colorless→warm→stable green→quiet rainbow only in the optimal band→gradual yellow→red fire, clear gauge with a wide hazard band, narrow cold zone and pointer, stamina strain, heat care with the coal swap, a second coal burn and the dial game, fatigue on Hajime\'s face, one leaf at a time turning brown→black→gone beside a five-pull counter and cap, over-pull strain from the 3rd care pull, failure when the last red turns brown, cold-out, full-screen blast, bowl not burning, burst on pull and heat care, readable header, steam reset, steam pause/resume and handoff, stable waiting temperature, coal cooling, reduced motion, mobile bounds and reset; page errors 0');
} finally { await browser.close(); }
