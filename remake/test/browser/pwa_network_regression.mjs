// 単独実行: node remake/test/browser/pwa_network_regression.mjs
// 独立 HTTP サーバーで実 SW・実ゲームモジュールを検証する。既存 support の設定は変えない。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const artifact = path.resolve(root, process.env.ARTIFACT_DIR || '.codex/artifacts/pwa-network');
const index = readFileSync(path.join(root, 'remake/index.html'), 'utf8');
const registration = index.match(/if \("serviceWorker" in navigator\) \{[\s\S]*?\n\}/)?.[0];
assert(registration, '実 index.html の SW 登録を使用する');
const sw = readFileSync(path.join(root, 'remake/sw.js'), 'utf8');
const imagePath = '/assets/backgrounds/bg_ch2_rei_entry.webp';
const image = readFileSync(path.join(root, imagePath));
assert(!image.toString('utf8', 0, 100).includes('git-lfs.github.com'), '画像の LFS 実体が必要');
const logs = [];
let revision = 1, workerRevision = 1, brokenImage = false;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  logs.push({ event: 'server', path: pathname, revision, brokenImage });
  res.setHeader('Cache-Control', 'public, max-age=3600');
  let body, type;
  if (pathname === '/remake/sw.js') {
    body = `${sw}\n// regression revision ${workerRevision}\n`; type = 'text/javascript';
    res.setHeader('Cache-Control', 'no-store');
  } else if (pathname === '/remake/pwa-network-test.html') {
    // 本編の自動起動はせず、必要な DOM 上で実モジュールを直接呼ぶ。
    body = `<div id="stage">${['bg','screen','vn','hud','fx','toasts','banners','wipe','modal'].map(id => `<div id="${id}"></div>`).join('')}</div><script>${registration}</script>`;
    type = 'text/html';
  } else if (pathname === '/outside.html') {
    body = '<p>outside remake scope</p>'; type = 'text/html';
  } else if (pathname === '/remake/pwa-fresh.html') {
    body = `<p>${revision}</p>`; type = 'text/html';
  } else if (pathname === '/remake/pwa-fresh.js') {
    body = `export default ${revision};`; type = 'text/javascript';
  } else if (pathname === '/data/dialogue/pwa_probe.json') {
    body = JSON.stringify({ dialogues: [{ dialogue_id: 'pwa_probe', lines: [{ text: String(revision) }] }] }); type = 'application/json';
  } else if (pathname === imagePath) {
    body = brokenImage ? 'invalid image' : image; type = 'image/webp';
    res.setHeader('Cache-Control', 'no-store');
  } else {
    const filename = path.resolve(root, '.' + pathname);
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try { body = readFileSync(filename); }
    catch { res.writeHead(404); res.end(); return; }
    type = ({ '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' })[path.extname(filename)] || 'application/octet-stream';
  }
  res.setHeader('Content-Type', type); res.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', error: error.stack }); console.error(`FAIL ${name}\n${error.stack}`); }
}
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
  for (const serviceWorkers of ['allow', 'block']) {
    await check(`${serviceWorkers}: registration, freshness, routes, real failed visit`, async () => {
      revision = workerRevision = 1; brokenImage = false;
      const context = await browser.newContext({ serviceWorkers });
      const record = value => logs.push({ serviceWorkers, ...value });
      context.on('request', req => record({ event: 'request', url: req.url(), worker: !!req.serviceWorker() }));
      context.on('response', res => record({ event: 'response', url: res.url(), fromSW: res.fromServiceWorker(), status: res.status() }));
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(`${origin}/remake/pwa-network-test.html`);
        if (serviceWorkers === 'allow') await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
        const state = await page.evaluate(async () => ({ controller: navigator.serviceWorker.controller?.scriptURL || null,
          registrations: (await navigator.serviceWorker.getRegistrations()).map(r => ({ scope: r.scope, state: r.active?.state })) }));
        record({ event: 'registration', ...state });
        assert.deepEqual(state, serviceWorkers === 'allow' ? {
          controller: `${origin}/remake/sw.js`, registrations: [{ scope: `${origin}/remake/`, state: 'activated' }],
        } : { controller: null, registrations: [] });

        // route を付けると HTTP キャッシュが無効になるため、鮮度検査を必ず先に行う。
        const fetchFresh = () => page.evaluate(async () => Promise.all(['./pwa-fresh.html', './pwa-fresh.js', '../data/dialogue/pwa_probe.json']
          .map(async url => (await fetch(url)).text())));
        const first = await fetchFresh(); revision = 2;
        const second = await fetchFresh();
        record({ event: 'freshness', first, second });
        if (serviceWorkers === 'allow') {
          assert.deepEqual(second, ['<p>2</p>', 'export default 2;', JSON.stringify({ dialogues: [{ dialogue_id: 'pwa_probe', lines: [{ text: '2' }] }] })]);
          assert(second.every((body, i) => body !== first[i]));
        } else assert.deepEqual(second, first, '対照群では max-age による旧本文が残る');
        // 実台詞ローダの no-cache も max-age を越えて更新を取る。
        const readDialogue = () => page.evaluate(async () => {
          const { readDialogues } = await import('./js/core/chapter-data.js');
          return (await readDialogues('pwa_probe', ['pwa_probe'])).pwa_probe.lines[0].text;
        });
        assert.equal(await readDialogue(), '2'); revision = 3; assert.equal(await readDialogue(), '3');

        // Playwright の注入とは独立に HTTP サーバー側で画像を壊す。
        // 実 visitPreparationSpot が費用・行動・既読・保存を変えないことを確認する。
        brokenImage = true;
        const visit = await page.evaluate(async () => {
          const core = await import('./js/core/state.js');
          const { DB } = await import('./js/core/data.js');
          const { readDialogues } = await import('./js/core/chapter-data.js');
          const ui = await import('./js/core/ui.js');
          const { PREPARATION_SPOTS, visitPreparationSpot } = await import('./js/chapters/ch2-preparation.js');
          ui.initLayers();
          Object.assign(DB.dialogues, await readDialogues('ch2_preparation', ['remake_ch2_rei_chat']));
          const value = core.newGame();
          Object.assign(value, { chapter: 2, day: 16, slot: 0, money: 35800, stamina: 100 });
          value.flags._ch2_day1 = { startDay: 15, stage: 'complete' };
          value.met.rei = true;
          core.save();
          const before = JSON.stringify(value), saved = localStorage.getItem('suien_remake_save');
          const result = await visitPreparationSpot(PREPARATION_SPOTS.find(s => s.charId === 'rei'), { staminaGuard: async () => true });
          return { result, before, after: JSON.stringify(value), saved, savedAfter: localStorage.getItem('suien_remake_save'), notice: document.querySelector('#toasts').textContent };
        });
        assert.deepEqual(visit.result, { used: false, exerted: false });
        assert.equal(visit.after, visit.before); assert.equal(visit.savedAfter, visit.saved);
        assert.match(visit.notice, /室内を読み込めませんでした/);
        record({ event: 'failed-visit', ...visit });
        brokenImage = false;
        assert.equal(await page.evaluate(async url => (await import('./js/core/ui.js')).imageReady(url, 3000), imagePath), true, '同じ URL で画像の再取得に成功する');
        const routed = [];
        await page.route(`**${imagePath}?injected`, route => { routed.push('image'); record({ event: 'page.route', url: route.request().url() }); return route.fulfill({ contentType: 'image/webp', body: 'broken image' }); });
        await page.route('**/data/dialogue/pwa_probe.json', route => { routed.push('dialogue'); record({ event: 'page.route', url: route.request().url() }); return route.fulfill({ contentType: 'application/json', body: '{bad json' }); });
        assert.equal(await page.evaluate(async url => (await import('./js/core/ui.js')).imageReady(url, 3000), imagePath + '?injected'), false);
        await assert.rejects(readDialogue(), /JSON|Unexpected|Expected/);
        assert.deepEqual(routed, ['image', 'dialogue']);
        await page.unrouteAll();

        if (serviceWorkers === 'allow') {
          workerRevision = 2;
          await page.evaluate(async () => {
            const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
            let timer;
            const deadline = new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('SW update/controllerchange timed out')), 15000);
            });
            try {
              await Promise.race([(async () => {
                await (await navigator.serviceWorker.getRegistration()).update(); await changed;
              })(), deadline]);
            } finally { clearTimeout(timer); }
          });
          await page.waitForFunction(() => navigator.serviceWorker.controller?.state === 'activated');
          record({ event: 'worker-update', state: 'activated' });
          assert.deepEqual(await page.evaluate(() => caches.keys()), []);
        }
        await page.goto(`${origin}/outside.html`);
        assert.equal(await page.evaluate(() => navigator.serviceWorker.controller), null, 'remake/ の外は制御しない');
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  mkdirSync(artifact, { recursive: true });
  writeFileSync(path.join(artifact, 'pwa-network.json'), JSON.stringify({ results, logs }, null, 2) + '\n');
}
assert.equal(results.filter(r => r.status === 'FAIL').length, 0, 'PWA network regression');
