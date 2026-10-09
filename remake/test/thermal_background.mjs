// 実温度の引継ぎ、吸い方・炭による上下、一時停止、描画・スマホ・低減モード。
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
    window.T = { core, session, steam, pull, care, thermal };
    window.cs = session.newSession('drill');
    const b = session.openBench(cs);
    while (!b.root.isConnected) await new Promise(requestAnimationFrame);
  });
  const band = () => page.locator('.bench').getAttribute('data-thermal-band');
  const pixels = () => page.locator('.thermal-backdrop').evaluate(c => c.toDataURL());
  const shot = async name => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
  // 温度計と同じ適温端点。上限／不正値でも描画可能。
  assert.deepEqual(await page.evaluate(() => [0,.30,.46,.62,.6201,.76,.90,1,NaN].map(T.thermal.thermalBand).map(b=>b.id)),
    ['cold','warming','ready','ready','hot','fire','inferno','inferno','cold']);
  await page.evaluate(() => T.session.stepPanel('heat','炭焼き'));
  assert(!(await page.locator('.thermal-backdrop').isVisible()));
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
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.run);
  const images=[];
  for (const [temp, expected] of [[.2,'cold'],[.4,'warming'],[.54,'ready'],[.70,'hot'],[.83,'fire'],[.96,'inferno']]) {
    await page.evaluate(t=>{T.session.stepPanel('trial','温度のイメージ');T.session.setBenchTemperature(cs,t);},temp);
    assert.equal(await band(),expected); images.push(await pixels());
    await shot(`temperature-${expected}`);
  }
  assert.equal(new Set(images).size,6,'temperature pictures are identical');
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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(()=>{T.session.stepPanel('trial','温度のイメージ');T.session.setBenchTemperature(cs,.96);});
  await page.waitForTimeout(120); const still=await pixels();
  await page.waitForTimeout(200); assert.equal(await pixels(),still);
  assert.equal(await page.locator('.thermal-flame').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.setViewportSize({width:390,height:844}); await shot('temperature-mobile');
  const bounds=await page.locator('.bench').boundingBox();assert(bounds.width<=391);
  await page.evaluate(()=>T.session.stepPanel('holes','穴あけ'));
  assert(!(await page.locator('.thermal-backdrop').isVisible()));
  assert.deepEqual(errors,[]);
  console.log('PASS: six distinct pictures, steam pause/resume and handoff, stable waiting temperature, coal cooling, reduced motion, mobile bounds and reset; page errors 0');
} finally { await browser.close(); }
