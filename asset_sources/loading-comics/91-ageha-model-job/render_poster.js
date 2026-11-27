// パロディバナー（asset_sources/parody/ageha-karusugi-banner/banner.html）を、②のポスターの空白の比率（約1.41:1）に
// 組み直して書き出す。文言と写真は元のバナーと同じ。使い方: node render_poster.js → poster.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const banner = path.resolve(__dirname, '../../parody/ageha-karusugi-banner/banner.html');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 760, height: 560 }, deviceScaleFactor: 2 });
  await p.goto('file://' + banner);
  await p.addStyleTag({ content: `
    .ad{width:680px;height:482px}
    .l1{font-size:64px}.l2{font-size:66px}
    .body{top:206px;left:14px;gap:22px}
    .txt{font-size:21px;line-height:1.6}
    .link{font-size:22px}` });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.locator('#ad').screenshot({ path: path.join(__dirname, 'poster.png') });
  await b.close();
})();
