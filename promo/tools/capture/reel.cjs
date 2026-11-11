// スロット「MOKUMOKUパッキー」。日常の地図の左下の筐体で、BIG（赤7揃い）の演出を __remake.reel.force で再生する。
const { open, sleep, setupDaily, TMP } = require('./common.cjs');
const path = require('path');
const variant = process.argv[2] || 'after';
const role = process.argv[3] || 'big';
(async () => {
  const { browser, page, report } = await open();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text().slice(0, 200)); });
  await setupDaily(page, { day: 8, slot: 1, extra: 's.reel.installed = true; s.reel.introDone = true; s.reel.settingGuideDone = true;' });
  await sleep(2500);
  console.log(await page.evaluate(() => window.__remake.reel.force.length), await page.evaluate(({ role, variant }) => window.__remake.reel.force(role, variant), { role, variant }));
  const t0 = Date.now();
  for (let i = 0; i < 26; i++) {
    const f = path.join(TMP, `reel_${role}_${variant}_${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
    console.log(i, Date.now() - t0, await page.evaluate(() => ({ cls: document.querySelector('.reel-widget, .rw')?.className, big: !!document.querySelector('.reel-big, .rw-big, .reel-zoom'), fx: document.querySelector('#fx')?.children.length })));
    await sleep(350);
  }
  report();
  await browser.close();
})();
