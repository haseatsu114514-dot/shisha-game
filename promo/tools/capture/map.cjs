// 街の地図（橙須）昼・夜。本物の日常ループ（runDaily）で地図を出し、ピンと店名が出そろった状態で撮る。
const { open, shot, sleep, setupDaily } = require('./common.cjs');
const tmp = process.argv[2] === 'tmp';
(async () => {
  for (const [name, slot] of [['map_day', 0], ['map_night', 1]]) {
    const { browser, page, report } = await open();
    await setupDaily(page, { day: 8, slot });
    await sleep(2500);
    await shot(page, name, { tmp });
    if (slot === 0) {
      // 行き先を選んだ状態（右下に店の写真と「ここへ行く」）
      await page.locator('[data-test="pin-tonari"]').click();
      await sleep(1500);
      await shot(page, 'map_day_select_tonari', { tmp });
    }
    report();
    await browser.close();
  }
})();
