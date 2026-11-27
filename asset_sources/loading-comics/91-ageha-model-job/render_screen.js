// ②のスマホの画面（screen.html）を書き出す。使い方: node render_screen.js → screen.png（320x633 の3倍）
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 360, height: 700 }, deviceScaleFactor: 3 });
  await p.goto('file://' + path.join(__dirname, 'screen.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
  await p.waitForTimeout(300);
  await p.locator('#screen').screenshot({ path: path.join(__dirname, 'screen.png') });
  await b.close();
})();
