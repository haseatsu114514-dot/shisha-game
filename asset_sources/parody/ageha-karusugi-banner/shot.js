const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 620, height: 520 }, deviceScaleFactor: 2 });
  await p.goto('file://' + process.argv[2]);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.locator('#ad').screenshot({ path: process.argv[3] });
  await b.close();
})();
