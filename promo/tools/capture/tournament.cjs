// 大会（第1章 SMOKE CROWN CUP）。開発用ジャンプ __remake.dev.tournament() で当日から通し、
// 会話は高速送り・制作は自動操作（上手）で進めながら、狙った場面だけ通常の速さに戻して撮る。
const { open, shot, sleep } = require('./common.cjs');
const tmp = process.argv[2] === 'tmp';
const VN_TARGETS = [
  { name: 'tournament_stage_opening', text: 'SMOKE CROWN CUP、[imp]開幕' },
  { name: 'tournament_judges', text: '……お手並み拝見といこう' },
  { name: 'tournament_judges_b', text: 'どうも。いや〜、若い子たちの熱気' },
];
(async () => {
  const { browser, page, report } = await open();
  page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 300)); });
  await page.evaluate(async (targets) => {
    const R = window.__remake;
    const vn = await import('./js/vn/engine.js');
    const core = await import('./js/core/state.js');
    window.__auto = 'good';
    Object.defineProperty(R.craftTest, 'auto', { get: () => window.__auto, set: (v) => { window.__auto = v; }, configurable: true });
    window.__hit = null; window.__trace = []; window.__seenDlg = [];
    vn.hooks.onLine = (id, line) => {
      if (!window.__seenDlg.includes(id)) window.__seenDlg.push(id);
      window.__trace.push(`${id}|${line.speaker || '-'}|${(line.text || '').slice(0, 24)}`);
      // 途中順位（採点）と結果発表は、自動送りを止めて画面を待たせる
      if (id === 'ch1_tournament_r1_end' || id === 'remake_judging_intro') window.__auto = null;
      const t = targets.find(t => !t.done && String(line.text || '').startsWith(t.text));
      if (t) { t.done = true; window.__hit = t.name; vn.vnTest.turbo = false; window.__speed = core.config.textSpeed; core.config.textSpeed = 4; }
    };
    window.__resume = () => { window.__hit = null; vn.vnTest.turbo = true; core.config.textSpeed = window.__speed ?? core.config.textSpeed; };
    vn.vnTest.turbo = true;
    window.__tour = R.dev.tournament().catch(e => { window.__tourError = String(e.stack || e); console.error(window.__tourError); });
  }, VN_TARGETS);

  const t0 = Date.now();
  let standingsShot = false, countShots = 0, lastInfo = '';
  for (let i = 0; i < 1500; i++) {
    await sleep(250);
    const info = await page.evaluate(() => ({
      hit: window.__hit, auto: window.__auto, err: window.__tourError || null,
      vn: document.querySelector('#vn')?.classList.contains('active'), vnNext: !!document.querySelector('#vn .vn-next.show'),
      screen: document.body.dataset.screen, step: document.querySelector('.bench')?.dataset.step || '',
      standings: !!document.querySelector('[data-test="standings"]'), standingsNext: !!document.querySelector('[data-test="standings-next"]')?.offsetParent,
      count: !!document.querySelector('[data-test="result-count"]'), result: !!document.querySelector('[data-test="tournament-result"]'),
      resultNext: !!document.querySelector('[data-test="result-next"]')?.offsetParent,
      stepNext: !!document.querySelector('[data-test="step-next"]')?.offsetParent,
      phoneNext: !!document.querySelector('[data-test="phone-next"]')?.offsetParent,
      last: window.__trace.at(-1),
    }));
    const key = JSON.stringify({ ...info, last: undefined });
    if (key !== lastInfo) { console.log(Math.round((Date.now() - t0) / 1000) + 's', key, '|', info.last); lastInfo = key; }
    if (info.err) break;
    if (info.hit && info.vnNext) {
      // 立ち絵の入場と、右上の通知カード（好感度など）が消えるのを待つ
      await sleep(1800);
      await page.waitForFunction(() => !document.querySelector('#toasts > *, #banners > *'), null, { timeout: 12000 }).catch(() => {});
      await sleep(400);
      await shot(page, info.hit, { tmp });
      await page.evaluate(() => window.__resume());
      await page.mouse.click(640, 620);
      continue;
    }
    if (info.standings && info.standingsNext && !standingsShot) {
      await sleep(3000);
      await shot(page, 'tournament_standings_round1', { tmp });
      standingsShot = true;
      await page.evaluate(() => { window.__auto = 'good'; });
      await page.locator('[data-test="standings-next"]').click();
      continue;
    }
    if (info.count && countShots < 40) {
      // カウントは動きが速いので細かく撮り、きれいな1枚を後で選ぶ（tmp）
      await shot(page, `tournament_count_${String(countShots).padStart(2, '0')}`, { tmp: true });
      countShots++;
      await sleep(150);
      continue;
    }
    if (info.auto === null && info.stepNext) { await page.locator('[data-test="step-next"]').click().catch(() => {}); continue; }
    if (info.result && info.resultNext) {
      await sleep(6000);
      await shot(page, 'tournament_result_final', { tmp: true }); // 優勝者が分かる画面なので納品には含めない（確認用）
      break;
    }
  }
  console.log(await page.evaluate(() => window.__seenDlg.join(' ')));
  report();
  await browser.close();
})();
