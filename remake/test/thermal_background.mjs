// 実温度の引継ぎ、吸い方・炭による上下、一時停止、描画・スマホ・低減モード。
// 冷たい色から始まり、適温は虹と陽炎・煙、超えるとだんだん火事のように黄色→赤の炎（青・紫の炎は使わない TH09・TH12・TH13）。
// 温度計の一番上で爆発して焦げる（TH06）。ボウルは燃やさない（TH04）。熱管理は「炭を焼きますか？」→吸い出しと同じ針（TH14・TH21）。冷え切り・フレーバー切れもダメになる（TH19・TH20）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const errors = [];
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
  assert.deepEqual(await page.evaluate(() => [0,.30,.46,.62,.6201,.76,.84,.90,.92,1,NaN].map(T.thermal.thermalBand).map(b=>b.id)),
    ['cold','warming','ready','ready','hot','fire','fire','inferno','inferno','inferno','cold']);
  // 爆発は温度計の一番上だけ。
  assert.deepEqual(await page.evaluate(() => [.98, .999, 1].map(T.conditions.isBurnt)), [false, false, true]);
  await page.evaluate(() => T.session.stepPanel('heat','炭焼き'));
  assert(!(await page.locator('.thermal-backdrop').isVisible()));
  // 前回の一台の灼熱を蒸らしへ持ち越さず、炭を置いた直後の温度から始める。
  await page.evaluate(() => { T.session.stepPanel('trial','x'); T.session.setBenchTemperature(cs,.96); T.session.stepPanel('steam','蒸らし時間'); });
  assert.equal(await band(), 'cold');
  // 見出しは素材スキンより後の暗幕で読める。台の上は煙だけで、ボウルは燃やさない。
  assert.match(await page.locator('.bench-top').evaluate(e=>getComputedStyle(e).backgroundImage), /rgba\(18, 11, 33/);
  const layout = await page.evaluate(() => {
    const eq = document.querySelector('.worker-equipment'), pic = eq.querySelector('.thermal-picture').getBoundingClientRect(), bowl = eq.querySelector('.worker-bowl').getBoundingClientRect();
    return { first: eq.firstElementChild.classList.contains('thermal-picture'), base: pic.bottom, bowlTop: bowl.top, bowlBottom: bowl.bottom, top: pic.top, stage: document.querySelector('.bench-worker-stage').getBoundingClientRect().top };
  });
  assert(layout.first, 'smoke picture must be behind the shisha parts');
  assert(layout.base > layout.bowlTop && layout.base < layout.bowlBottom, `smoke base ${layout.base} is not inside the bowl ${layout.bowlTop}-${layout.bowlBottom}`);
  assert(layout.top >= layout.stage, 'smoke picture leaves the stage');
  assert.equal(await page.locator('.thermal-flame').count(), 0, 'the bowl must not burn');
  await page.evaluate(() => { cs.steamSeconds=300; window.run=T.steam.runSteamDodge(cs); });
  await page.locator('[data-test="timer-stop"]:not([disabled])').waitFor();
  await page.waitForTimeout(600);
  await page.locator('[data-test="timer-stop"]').click();
  const before = Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'));
  const frozen = await pixels();
  await page.waitForTimeout(250);
  assert.equal(await pixels(), frozen, 'paused background still moves');
  assert.equal(Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature')), before);
  await page.locator('[data-test="timer-stop"]').click();
  await page.waitForTimeout(250); assert.notEqual(await pixels(), frozen);
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
  await page.keyboard.press('Space'); await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  await page.waitForSelector('.result-card.show');
  // 吸った後は、吸い方で上下した提供温度と背景が一致する。
  assert(Math.abs(Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'))-await page.evaluate(()=>cs.pull.temp))<.0001);
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  const images=[], colors={}, glows=[], hazes={}, rainbow={};
  for (const [temp, expected] of [[.2,'cold'],[.4,'warming'],[.54,'ready'],[.70,'hot'],[.83,'fire'],[.96,'inferno']]) {
    await page.evaluate(t=>{T.session.stepPanel('trial','温度のイメージ');T.session.setBenchTemperature(cs,t);},temp);
    assert.equal(await band(),expected); images.push(await pixels());
    colors[expected] = await mean();
    hazes[expected] = await haze();
    rainbow[expected] = await hues();
    glows.push(Number(await page.locator('.bench').evaluate(e => getComputedStyle(e).getPropertyValue('--thermal-glow-strength'))));
    await shot(`temperature-${expected}`);
  }
  assert.equal(new Set(images).size,6,'temperature pictures are identical');
  const [cr, cg, cb] = colors.cold, [gr, gg, gb] = colors.ready, [hr, hg, hb] = colors.hot, [fr, fg, fb] = colors.fire, [ir, ig, ib] = colors.inferno;
  assert(cb > cr + 25 && cr + cg + cb > 3 * 170, `cold is not a pale cold color: ${colors.cold}`);
  assert(rainbow.ready >= 5, `ideal is not a rainbow: ${rainbow.ready} hues`);
  assert(rainbow.cold <= 2, `cold already shows many colors: ${rainbow.cold}`);
  assert(fr > fg + 60 && fr > fb + 80, `overheat is not red: ${colors.fire}`);
  assert(hr > hb + 40 && hr > hg + 30, `hot stage is not turning warm: ${colors.hot}`);
  assert(ir > ig + 40 && ir > ib + 60, `inferno is not red-hot: ${colors.inferno}`);
  for (const name of ['hot', 'fire', 'inferno']) { const [r, g, b] = colors[name]; assert(!(b > r + 30 && b > g), `${name} uses blue or purple fire: ${[r, g, b]}`); }
  // 適温あたりから作業風景がゆらぐ。低温ではゆらさない。
  assert.equal(hazes.cold[0], '0'); assert.equal(hazes.cold[1], '');
  assert.equal(hazes.ready[0], '4'); assert.match(hazes.ready[1], /url\("?#thermal-haze-\d+"?\)/);
  // 同じ温度帯の中でも、温度に沿って絵が少しずつ移る（だんだん火事になる）。
  const within = [];
  for (const t of [.78, .84, .89]) { await page.evaluate(v => T.session.setBenchTemperature(cs, v), t); within.push(await pixels()); }
  assert.equal(await band(), 'fire'); assert.equal(new Set(within).size, 3, 'the fire band does not change gradually');
  assert.deepEqual([...glows].sort((a, b) => a - b), glows, `scene glow does not grow with heat: ${glows}`);

  // 熱管理: 「そろそろ調整の準備をしよう」→「炭を焼きますか？」で個数。温度計はこの時点で出る。替えた炭で少し温度が上がり、
  // 針のゲームが始まると炭が燃え進んで温度が動き続ける。最低1回吸って整え終える。
  const backdropTemp = async () => Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'));
  // 針が指定の範囲（%）に来た瞬間に吸う。
  const pullAt = (lo, hi) => page.evaluate(async ([a, b]) => {
    const needle = document.querySelector('.pg-needle'), at = () => parseFloat(needle.style.left);
    while (!needle.style.left) await new Promise(requestAnimationFrame);
    while (!(at() >= a && at() <= b)) await new Promise(requestAnimationFrame);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  }, [lo, hi]);
  await page.evaluate(() => { cs.pull.temp = .46; cs.leaf = null; window.run = T.care.runCare(cs); });
  await page.waitForSelector('[data-test="care-coals"]');
  assert.equal(await page.locator('.pull-read').textContent(), 'そろそろ調整の準備をしよう');
  assert.match(await page.locator('.care-coals-ask').textContent(), /炭を焼きますか？/);
  assert(await page.locator('.pull-care [data-test="pull-temperature"]').isVisible(), 'thermometer must show while choosing coals');
  assert.equal(await page.locator('.pull-care [data-test="thermo-cold"]').count(), 1);
  assert(!(await page.locator('.pull-play').isVisible()), 'the needle game shows before choosing coals');
  const chosen = await backdropTemp();
  await page.locator('[data-test="care-coal-2"]').click();
  await page.waitForFunction(() => document.querySelector('.pg-needle').style.left);
  const swapped = await backdropTemp();
  assert(swapped > chosen + .05, `coal swap did not raise the temperature: ${chosen} -> ${swapped}`);
  assert.match(await page.locator('.pull-read').textContent(), /↓ 炭が燃え進んで熱が落ちていく/);
  assert(await page.locator('[data-test="pull-serve"]').isDisabled(), 'can finish heat care without pulling');
  await page.waitForTimeout(500);
  assert.notEqual(await backdropTemp(), swapped, 'heat care temperature does not move');
  await pullAt(45, 55);
  assert(!(await page.locator('[data-test="pull-serve"]').isDisabled()), 'one pull should be enough to finish');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.result-card.show');
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), '熱管理 結果');
  assert.deepEqual(await page.evaluate(() => [cs.care.pulls, cs.care.coals, cs.leaf.hp]), [1, 2, 4]);
  assert(Math.abs(await backdropTemp() - await page.evaluate(() => cs.care.temp)) < .0001);
  await shot('care-pulled');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);

  // 熱管理の3回目からフレーバーが傷み、ダメージの演出が出る。体力が尽きるとその一台はダメになる。
  await page.evaluate(() => { cs.pull.temp = .54; cs.leaf = { hp: 2, max: 4 }; window.run = T.care.runCare(cs); });
  await page.locator('[data-test="care-coal-0"]').click();
  await page.waitForFunction(() => document.querySelector('.pg-needle').style.left);
  await pullAt(45, 55); await pullAt(45, 55);
  assert.equal(await page.locator('[data-test="leaf-hp"]').getAttribute('data-hp'), '2', 'the first two pulls must not hurt the flavor');
  await pullAt(45, 55);
  assert.equal(await page.locator('[data-test="leaf-hp"]').getAttribute('data-hp'), '1');
  assert.equal(await page.locator('.leaf-hp.hit').count(), 1, 'no damage effect');
  assert.equal(await page.locator('.leaf-pip.lost').count(), 3);
  await shot('leaf-damage');
  await pullAt(45, 55);
  await page.waitForSelector('.result-card.show');
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), 'フレーバーがダメになってしまった');
  assert.deepEqual(await page.evaluate(() => [cs.failed, cs.care.failed, cs.leaf.hp]), ['leaf', 'leaf', 0]);
  assert.equal(await band(), 'leaf-out');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);

  // 提供後に炭を替えずに放っておくと冷え切って、その一台はダメになる。
  await page.evaluate(() => { cs.failed = null; cs.pull.temp = .2; cs.leaf = null; Math.random = () => .99; window.run = T.care.runCare(cs); });
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
    const needle = document.querySelector('.pg-needle'), at = () => parseFloat(needle.style.left);
    while (!needle.style.left) await new Promise(requestAnimationFrame);
    while (at() > 40) await new Promise(requestAnimationFrame);
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
  await page.evaluate(() => { cs.burnt = false; cs.failed = null; cs.leaf = null; cs.pull = { ...cs.pull, temp: .93 }; window.run = T.care.runCare(cs); });
  await page.locator('[data-test="care-coal-3"]').click();
  await page.waitForSelector('[data-test="screen-blast"]', { timeout: 5000 });
  await shot('screen-blast');
  await page.waitForSelector('.result-card.show', { timeout: 15000 });
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), 'シーシャが焦げてしまった');
  assert.deepEqual(await page.evaluate(() => [cs.burnt, cs.care.failed, cs.care.score]), [true, 'burnt', 0]);
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  await page.evaluate(() => { T.session.stepPanel('trial', '温度のイメージ'); T.session.setBenchTemperature(cs, .54); });
  assert.equal(await band(), 'ready');
  assert.equal(await page.locator('.bench.thermal-burnt, .bench.thermal-ruined').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(()=>{T.session.stepPanel('trial','温度のイメージ');T.session.setBenchTemperature(cs,.96);});
  await page.waitForTimeout(120); const still=await pixels();
  await page.waitForTimeout(200); assert.equal(await pixels(),still);
  assert.equal(await page.locator('.thermal-wisps').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.deepEqual(await haze(), ['0', ''], 'reduced motion still warps the scene');
  await page.setViewportSize({width:390,height:844}); await shot('temperature-mobile');
  const bounds=await page.locator('.bench').boundingBox();assert(bounds.width<=391);
  await page.evaluate(()=>T.session.stepPanel('holes','穴あけ'));
  assert(!(await page.locator('.thermal-backdrop').isVisible()));
  assert.deepEqual(errors,[]);
  console.log('PASS: cold→rainbow with heat haze→gradual yellow→red fire (no blue/purple), heat care with coal choice then the pull game, flavor damage from the 3rd care pull, cold-out, flavor-out, full-screen blast, bowl not burning, burst on pull and heat care, readable header, steam reset, steam pause/resume and handoff, stable waiting temperature, coal cooling, reduced motion, mobile bounds and reset; page errors 0');
} finally { await browser.close(); }
