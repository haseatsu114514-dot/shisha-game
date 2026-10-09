// 実温度の引継ぎ、吸い方・炭による上下、一時停止、描画・スマホ・低減モード。
// 低温は薄く、過熱は赤→青→紫の炎（TH02・TH05）。温度計の一番上で爆発して焦げる（TH06）。ボウルは燃やさない（TH04）。
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
  const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
  // 温度計と同じ適温端点。上限／不正値でも描画可能。
  assert.deepEqual(await page.evaluate(() => [0,.30,.46,.62,.6201,.76,.84,.90,.92,1,NaN].map(T.thermal.thermalBand).map(b=>b.id)),
    ['cold','warming','ready','ready','hot','fire','blue','blue','inferno','inferno','cold']);
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
  const images=[], colors={}, glows=[];
  for (const [temp, expected] of [[.2,'cold'],[.4,'warming'],[.54,'ready'],[.70,'hot'],[.80,'fire'],[.88,'blue'],[.96,'inferno']]) {
    await page.evaluate(t=>{T.session.stepPanel('trial','温度のイメージ');T.session.setBenchTemperature(cs,t);},temp);
    assert.equal(await band(),expected); images.push(await pixels());
    colors[expected] = await page.locator('.thermal-backdrop').evaluate(c => [...c.getContext('2d').getImageData(4, 4, 1, 1).data].slice(0, 3));
    glows.push(Number(await page.locator('.bench').evaluate(e => getComputedStyle(e).getPropertyValue('--thermal-glow-strength'))));
    await shot(`temperature-${expected}`);
  }
  assert.equal(new Set(images).size,7,'temperature pictures are identical');
  const [cr, cg, cb] = colors.cold, [gr, gg, gb] = colors.ready, [fr, fg, fb] = colors.fire, [br, bg, bb] = colors.blue, [ir, ig, ib] = colors.inferno;
  assert(Math.min(cr, cg, cb) > 190 && Math.max(cr, cg, cb) - Math.min(cr, cg, cb) < 50, `cold is not pale: ${colors.cold}`);
  assert(gg > gr + 60 && gg > gb + 60, `ideal is not green: ${colors.ready}`);
  assert(fr > fg + 120 && fr > fb + 120, `overheat is not red: ${colors.fire}`);
  assert(bb > br + 100 && bb > bg + 60, `blue flame stage is not blue: ${colors.blue}`);
  assert(ib > ig + 60 && ir > ig + 40, `inferno is not purple: ${colors.inferno}`);
  assert.deepEqual([...glows].sort((a, b) => a - b), glows, `scene glow does not grow with heat: ${glows}`);
  // 炭を外すと実際の熱量も背景も下がる。
  await page.evaluate(() => { cs.pull.temp=.94; Math.random=()=>.5; window.run=T.care.runCare(cs); });
  assert.equal(await band(),'inferno');
  await page.locator('[data-test="care-remove"]').click();
  await page.locator('[data-test="care-remove"]').waitFor(); assert.equal(await band(),'fire');
  await page.locator('[data-test="care-remove"]').click();
  await page.locator('[data-test="care-remove"]').waitFor(); assert.equal(await band(),'hot');
  await page.locator('[data-test="care-remove"]').click();
  await page.waitForSelector('.result-card.show');
  assert(Math.abs(Number(await page.locator('.thermal-backdrop').getAttribute('data-temperature'))-await page.evaluate(()=>cs.care.temp))<.0001);
  await shot('care-cooled');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);

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
  assert.deepEqual(await page.evaluate(() => [cs.burnt, cs.pull.burnt, cs.pull.score]), [true, true, 0]);
  assert(Math.max(...await page.locator('.thermal-backdrop').evaluate(c => [...c.getContext('2d').getImageData(4, 4, 1, 1).data].slice(0, 3))) < 110, 'burnt background is not charred');
  await shot('burnt-pull');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  // 熱管理でも、炭を寄せて一番上へ届けば同じく焦げる。工程が変われば焦げた背景は残らない。
  await page.evaluate(() => { cs.burnt = false; cs.pull = { ...cs.pull, temp: .99, burnt: false }; Math.random = () => .5; window.run = T.care.runCare(cs); });
  await page.locator('[data-test="care-center"]').click();
  await page.waitForSelector('.result-card.show');
  assert.equal(await page.locator('.result-card.show .rc-title').textContent(), 'シーシャが焦げてしまった');
  assert.deepEqual(await page.evaluate(() => [cs.burnt, cs.care.burnt, cs.care.score]), [true, true, 0]);
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  await page.evaluate(() => { T.session.stepPanel('trial', '温度のイメージ'); T.session.setBenchTemperature(cs, .54); });
  assert.equal(await band(), 'ready');
  assert.equal(await page.locator('.bench.thermal-burnt').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(()=>{T.session.stepPanel('trial','温度のイメージ');T.session.setBenchTemperature(cs,.96);});
  await page.waitForTimeout(120); const still=await pixels();
  await page.waitForTimeout(200); assert.equal(await pixels(),still);
  assert.equal(await page.locator('.thermal-wisps').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.setViewportSize({width:390,height:844}); await shot('temperature-mobile');
  const bounds=await page.locator('.bench').boundingBox();assert(bounds.width<=391);
  await page.evaluate(()=>T.session.stepPanel('holes','穴あけ'));
  assert(!(await page.locator('.thermal-backdrop').isVisible()));
  assert.deepEqual(errors,[]);
  console.log('PASS: seven heat stages incl. red→blue→purple flames, bowl not burning, burst on pull and heat care, readable header, steam reset, steam pause/resume and handoff, stable waiting temperature, coal cooling, reduced motion, mobile bounds and reset; page errors 0');
} finally { await browser.close(); }
