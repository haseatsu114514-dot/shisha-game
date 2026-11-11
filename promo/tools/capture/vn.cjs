// 会話パート。本編と同じ会話エンジン（vn/engine.js の play）で実際の台本を先頭から再生し、
// 指定の台詞に着いたところで高速送りを止めて、文字が出切った状態を撮る。
const { open, shot, sleep } = require('./common.cjs');

const SHOTS = {
  // (a) tonari 店内
  sumi: { name: 'vn_sumi_tonari', id: 'ch1_sumi_basics', bg: 'bg_tonari_inside', slot: 1, target: '葉っぱだけじゃ煙にならねえ' },
  sumi_diagram: { name: 'vn_sumi_tonari_diagram', id: 'ch1_sumi_basics', bg: 'bg_tonari_inside', slot: 1, target: 'そうだ。温められた葉っぱから出た煙は' },
  tsumugi: { name: 'vn_tsumugi_tonari', id: 'ch1_tsumugi_second', bg: 'bg_tonari_inside', slot: 0, target: '……同じ形は、二度と来ない' },
  // (b) みんと（ぺぱーみんと）
  minto: { name: 'vn_minto_peppermint', id: 'ch1_minto_first', bg: 'peppermint', slot: 0, target: '初めてのお客様には' },
  minto2: { name: 'vn_minto_peppermint_b', id: 'ch1_minto_first', bg: 'peppermint', slot: 0, target: 'ご指名ありがとうございますっ' },
  // (c) アダム（EDEN）／なる（KEMURIKUSA）
  adam: { name: 'vn_adam_eden', id: 'ch1_adam_first', bg: 'bg_eden_shop', slot: 1, target: 'ふっ……その顔' },
  adam2: { name: 'vn_adam_eden_b', id: 'ch1_adam_first', bg: 'bg_eden_shop', slot: 1, target: '無論。世界はリンゴに始まり' },
  naru: { name: 'vn_naru_kemurikusa', id: 'ch1_naru_second', bg: 'kemurikusa', slot: 0, target: 'だろ？ 菓子と同じだよ' },
};

(async () => {
  const keys = process.argv[2] ? process.argv[2].split(',') : Object.keys(SHOTS);
  const tmp = process.argv[3] === 'tmp';
  for (const key of keys) {
    const cfg = SHOTS[key];
    const { browser, page, report } = await open();
    page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 300)); });
    await page.evaluate(async (cfg) => {
      const core = await import('./js/core/state.js');
      const vn = await import('./js/vn/engine.js');
      const intro = await import('./js/vn/intro.js');
      const ui = await import('./js/core/ui.js');
      const hud = await import('./js/daily/hud.js');
      const s = core.newGame();
      Object.assign(s, { phase: 'daily', chapter: 1, day: 8, slot: cfg.slot, weatherSeed: 36 });
      for (const id of ['sumi', 'minto', 'naru', 'adam', 'tsumugi', 'rio']) s.met[id] = true;
      Object.assign(s.flags, { known_name_minto: true, known_name_adam: true, known_name_tsumugi: true, _met_adam: true, _met_tsumugi: true,
        _lime_contact_naru: true, _lime_contact_adam: true, _lime_contact_minto: true });
      for (const id of ['minto', 'naru', 'tsumugi', 'adam']) if (!s.contacts.includes(id)) s.contacts.push(id);
      for (const id of ['sumi', 'tsumugi', 'naru', 'adam', 'minto', 'rio', 'pakki']) intro.markIntroSeen(id);
      (await import('./js/chapters/ch1.js')).setupHooks();
      ui.clearScreen();
      hud.showHud?.(false);
      window.__hit = false;
      window.__trace = [];
      const prev = vn.hooks.onLine;
      vn.hooks.onLine = (id, line) => {
        prev?.(id, line);
        window.__trace.push(`${line.speaker || '-'}:${(line.text || '').slice(0, 30)}`);
        if (!window.__hit && String(line.text || '').startsWith(cfg.target)) {
          window.__hit = true;
          vn.vnTest.turbo = false;
          core.config.textSpeed = 4; // この行は一度に全文を出す
        }
      };
      vn.vnTest.turbo = true;
      window.__vnRun = vn.play(cfg.id, { bg: `res://assets/backgrounds/${cfg.bg}.png` });
    }, cfg);
    await page.waitForFunction(() => window.__hit, null, { timeout: 30000 }).catch(async () => {
      console.log('NOT HIT', key, await page.evaluate(() => window.__trace.slice(-8)));
    });
    await page.locator('#vn .vn-next.show').waitFor({ timeout: 15000 });
    await sleep(1800); // 立ち絵の入場・表情の切り替えが落ち着くまで
    console.log(key, await page.evaluate(() => ({ name: document.querySelector('.vn-name')?.textContent, text: document.querySelector('.vn-text')?.textContent,
      portraits: [...document.querySelectorAll('.vn-portraits img')].map(i => `${i.dataset.speaker}:${i.src.split('/').slice(-2).join('/')}:${i.complete && i.naturalWidth}`) })));
    await shot(page, cfg.name, { tmp });
    report();
    await browser.close();
  }
})();
