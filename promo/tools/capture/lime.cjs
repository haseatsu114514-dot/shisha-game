// スマホ（LIME）。本物の日常ループで DAY8 の朝を通し、届いた LIME を HUD のアイコンから開く。
const { open, shot, sleep, setupDaily } = require('./common.cjs');
const tmp = process.argv[2] === 'tmp';
(async () => {
  const { browser, page, report } = await open();
  await setupDaily(page, { day: 8, slot: 0, extra: 'delete s.flags._morning_8;' });
  await sleep(2500);
  await page.locator('[data-test="hud-phone"]').click();
  await page.locator('[data-test="lime-chat-minto"]').waitFor();
  await sleep(1500);
  await shot(page, 'phone_lime_list', { tmp });
  // つむぎの誘い（返事の選択肢つき）
  await page.locator('[data-test="lime-chat-tsumugi"]').click();
  for (let i = 0; i < 10; i++) {
    await sleep(1800);
    const t = await page.evaluate(() => [...document.querySelectorAll('[data-test]')].filter(n => n.offsetParent).map(n => n.dataset.test));
    if (t.some(x => x.startsWith('reply-'))) break;
    if (t.includes('phone-next')) { await page.locator('[data-test="phone-next"]').click(); }
  }
  await sleep(1500);
  console.log(await page.evaluate(() => document.querySelector('.phone, .phone-overlay')?.innerText.slice(0, 400)));
  await shot(page, 'phone_lime_tsumugi_invite', { tmp });
  report();
  await browser.close();

  // みんとのトーク（スタンプつき）
  const b = await open();
  await setupDaily(b.page, { day: 8, slot: 0, extra: 'delete s.flags._morning_8;' });
  await sleep(2500);
  await b.page.locator('[data-test="hud-phone"]').click();
  await b.page.locator('[data-test="lime-chat-minto"]').click();
  await b.page.locator('[data-test="phone-next"]').waitFor({ timeout: 20000 });
  await sleep(4500); // 好感度の通知が消えるまで待つ
  console.log(await b.page.evaluate(() => document.querySelector('.phone, .phone-overlay')?.innerText.slice(0, 400)));
  await shot(b.page, 'phone_lime_minto', { tmp });
  b.report();
  await b.browser.close();
})();
