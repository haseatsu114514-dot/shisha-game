// 共通ヘルパー: ブラウザ起動・欠け画像の検出・撮影
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 公式サイト（promo/）の「遊びかた」に載せる、ゲームの実画面を撮るための道具。使い方は promo/README.md。
// 出力先はリポジトリの外（既定は一時フォルダ）。PROMO_SHOTS で変えられる。
const os = require('os');
const BASE = process.env.PROMO_GAME_URL || 'http://127.0.0.1:8123/remake/';
const SHOTS = path.resolve(process.env.PROMO_SHOTS || path.join(os.tmpdir(), 'promo-shots'));
const TMP = path.join(SHOTS, 'candidates');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

async function open(url = BASE, { ready = '[data-test="title-new"]', init = null, storage = {}, comicReader = true } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  // ゲームは、自動操作のブラウザ（navigator.webdriver）では見た目の様式を旧版にする（検査用。remake/js/core/look.js）。
  // サイトに載せるのはプレイヤーが実際に見る画面なので、その印を外して既定の様式（新版）で撮る。
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); });
  const small = [];
  const failed = [];
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', async r => {
    try {
      const u = r.url();
      if (r.status() >= 400) failed.push(`${r.status()} ${u}`);
      if (/\.(webp|png|jpg|jpeg)(\?|$)/.test(u)) {
        const len = Number(r.headers()['content-length'] || -1);
        if (len >= 0 && len < 200) small.push(`${len} ${u}`);
      }
    } catch {}
  });
  if (comicReader) {
    await page.exposeBinding('__readLoadingComic', async () => { await page.keyboard.press('Enter'); });
    await page.addInitScript(() => {
      if (window.top !== window) return;
      const read = new WeakSet();
      new MutationObserver(() => {
        for (const gate of document.querySelectorAll('.loading-gate.is-ready')) {
          if (read.has(gate)) continue;
          read.add(gate);
          void window.__readLoadingComic();
        }
      }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  }
  await page.addInitScript((storage) => {
    try {
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
    } catch {}
  }, { suien_board_tutorial: 'off', suien_roamers: 'off', suien_step_intro: 'off', ...storage });
  if (init) await page.addInitScript(init);
  page.setDefaultTimeout(15000);
  await page.goto(url, { waitUntil: 'load' });
  if (ready) {
    await page.locator(ready).waitFor({ timeout: 40000 });
    await page.locator('#boot').waitFor({ state: 'detached' }).catch(() => {});
  }
  const report = () => {
    if (small.length) console.log('SMALL(LFS?)', [...new Set(small)].join('\n  '));
    if (failed.length) console.log('FAILED', [...new Set(failed)].join('\n  '));
    if (errors.length) console.log('ERRORS', [...new Set(errors)].join('\n  '));
  };
  return { browser, context, page, small, failed, errors, report };
}

async function shot(page, name, { tmp = false } = {}) {
  const file = path.join(tmp ? TMP : SHOTS, name.endsWith('.png') ? name : `${name}.png`);
  await page.screenshot({ path: file });
  console.log('SHOT', file);
  return file;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = { open, shot, sleep, BASE, SHOTS, TMP };

// 第1章の日常（本物の runDaily）を、途中まで進んだ自然な状態で地図まで出す
async function setupDaily(page, { day = 8, slot = 0, chapter = 1, money = 38500, stamina = 82, weatherSeed = 36, extra = null,
  growth = { xp: 520, level: 3, settledXp: 480, hidane: { any: 2 }, nodes: ['B1', 'B2', 'S1'] } } = {}) {
  await page.evaluate(async ({ day, slot, chapter, money, stamina, weatherSeed, extra, growth }) => {
    const core = await import('./js/core/state.js');
    const s = core.newGame();
    Object.assign(s, { phase: 'daily', chapter, day, slot, money, stamina, weatherSeed, seed: 131 });
    Object.assign(s.flags, { [`_morning_${day}`]: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _delivery_schedule_v2: true, _c_station_registered: true, _tutorial_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true, known_name_adam: true, known_name_tsumugi: true,
      _met_adam: true, _met_tsumugi: true, _spot_guide_naru: true, _spot_guide_adam: true, _spot_guide_minto: true, _cafe_introduced: true,
      _axe_bar_rumor_done: true, _lime_contact_minto: true, _lime_contact_naru: true, _lime_contact_adam: true });
    for (const id of ['sumi', 'minto', 'naru', 'adam', 'tsumugi', 'rio']) s.met[id] = true;
    for (const id of ['minto', 'naru', 'tsumugi', 'adam']) if (!s.contacts.includes(id)) s.contacts.push(id);
    Object.assign(s.affinity, { minto: 34, sumi: 30, naru: 26, tsumugi: 41, adam: 18, rio: 12 });
    s.flavorStock = { mint: 44, lemon: 50, double_apple: 32, blueberry: 50 };
    s.flavors = ['double_apple', 'mint', 'blueberry', 'lemon'];
    s.flavorMastery = { mint: 20, lemon: 14, double_apple: 9 };
    if (growth) Object.assign((await import('./js/core/growth.js')).ensureGrowth(s), growth);
    if (extra) new Function('s', extra)(s);
    const intro = await import('./js/vn/intro.js');
    for (const id of ['sumi', 'tsumugi', 'naru', 'adam', 'minto', 'rio', 'pakki']) intro.markIntroSeen(id);
    core.save(); core.load();
    (await import('./js/chapters/ch1.js')).setupHooks();
    (await import('./js/core/ui.js')).clearScreen();
    window.dailyRun = (await import('./js/daily/calendar.js')).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.dailyError = String(error.stack || error); console.error(window.dailyError); });
  }, { day, slot, chapter, money, stamina, weatherSeed, extra, growth });
  await page.locator('#screen .map:not(.done)').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.map img')].map(i => i.decode().catch(() => {}))); });
}

module.exports.setupDaily = setupDaily;
