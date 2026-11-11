// シーシャ作り（大会と同じ作業台・同じ工程関数）。配合→詰め→穴あけ→炭の配置→炭焼き→蒸らし→吸い出しを
// 1台ぶん実際に操作して、遊んでいる最中の画面を撮る。
const { open, shot, sleep } = require('./common.cjs');
const { initCraft, visibleTests, panelText, runUntil, FOIL_HMD, punchHoles, armCoalPicker } = require('./craft_lib.cjs');
const tmp = process.argv[2] === 'tmp';
const nextIfCard = async (page) => { if (await page.locator('[data-test="step-next"]').isVisible().catch(() => false)) await page.locator('[data-test="step-next"]').click(); };
(async () => {
  const { browser, page, report } = await open();
  page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 300)); });
  await initCraft(page, { extra: FOIL_HMD });
  await runUntil(page, 'mix');

  // ---- 配合（なる直伝のレモン×ミント）
  await page.locator('[data-test="mix-ok"]').waitFor();
  await sleep(1200);
  const add = async (id, n) => { for (let i = 0; i < n; i++) { await page.locator(`[data-test="mix-plus-${id}"]`).click(); await sleep(140); } };
  await add('lemon', 8); await add('mint', 4);
  await sleep(1800);
  console.log('MIX', await panelText(page));
  await shot(page, 'craft_mix', { tmp });
  await page.locator('[data-test="mix-ok"]').click();

  // ---- 詰め
  await page.locator('[data-test="pack-confirm"]').waitFor();
  await sleep(1500);
  await page.locator('[data-test="opt-fluffy"]').click();
  await sleep(1800);
  console.log('PACK', await panelText(page));
  await shot(page, 'craft_pack', { tmp });
  await page.locator('[data-test="pack-confirm"]').click();
  await sleep(1200);
  await nextIfCard(page);

  // ---- アルミ穴あけ
  await page.locator('[data-test="hole-start"]').waitFor();
  await sleep(800);
  await page.locator('[data-test="hole-start"]').click();
  await page.locator('[data-test="hole-needle"]').waitFor();
  console.log(await punchHoles(page, 12));
  console.log(await punchHoles(page, 6));
  await shot(page, 'craft_holes', { tmp });
  console.log(await punchHoles(page, 6));
  await sleep(500);
  await page.locator('[data-test="hole-done"]').click();
  await page.locator('[data-test="step-next"]').waitFor();
  await sleep(2600);
  await shot(page, 'craft_holes_result', { tmp });
  await page.locator('[data-test="step-next"]').click();

  // ---- 炭の配置
  await sleep(1500);
  console.log('PLACE', await visibleTests(page));
  if (await page.locator('[data-test="opt-triangle"]').isVisible().catch(() => false)) {
    await sleep(800);
    await shot(page, 'craft_place', { tmp: true });
    await page.locator('[data-test="opt-triangle"]').click();
  }

  // ---- 炭焼き
  await page.locator('[data-test="coal-0"]').waitFor();
  await armCoalPicker(page);
  await page.waitForFunction(() => window.coalPicked >= 1, null, { timeout: 20000 });
  await sleep(250);
  await shot(page, 'craft_heat_coals', { tmp });
  await page.waitForFunction(() => window.coalPicked >= 3, null, { timeout: 20000 });
  await page.locator('[data-test="step-next"]').waitFor();
  await sleep(1500);
  await page.locator('[data-test="step-next"]').click();

  // ---- 蒸らし（時間を決めて、雑念を避ける）
  await page.locator('[data-test="timer-start"]').waitFor();
  await sleep(800);
  for (let i = 0; i < 5; i++) { await page.locator('[data-test="timer-minute-up"]').click(); await sleep(150); }
  await sleep(500);
  await shot(page, 'craft_steam_timer', { tmp: true });
  await page.locator('[data-test="timer-start"]').click();
  await page.locator('[data-test="dodge"]').waitFor();
  const keysSeq = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
  for (let i = 0; i < 12; i++) {
    await sleep(1400);
    await page.keyboard.down(keysSeq[i % 4]); await sleep(220); await page.keyboard.up(keysSeq[i % 4]);
    if (await page.locator('[data-test="step-next"]').isVisible().catch(() => false)) break;
    await shot(page, `craft_steam_${i}`, { tmp: true });
    console.log('steam', i, await page.evaluate(() => ({ clock: document.querySelector('[data-test="steam-clock"]')?.textContent, mental: document.querySelector('[data-test="dodge"]')?.dataset.mental })));
  }
  await page.locator('[data-test="step-next"]').waitFor({ timeout: 30000 });
  await sleep(1200);
  await page.locator('[data-test="step-next"]').click();

  // ---- 吸い出し（針を止めて温度を合わせる）
  await page.locator('[data-test="pull-stop"]').waitFor();
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-test="pull-stop"]:not([disabled])').waitFor({ timeout: 15000 });
    await sleep(650 + i * 160);
    await page.locator('[data-test="pull-stop"]').click();
    await sleep(450);
    await shot(page, `craft_pull_${i}`, { tmp: true });
    console.log('pull', i, await page.evaluate(() => ({ zone: document.querySelector('[data-test="pull-current-zone"]')?.textContent, count: document.querySelector('[data-test="pull-count"]')?.textContent })));
    await sleep(1600);
  }
  report();
  await browser.close();
})();
