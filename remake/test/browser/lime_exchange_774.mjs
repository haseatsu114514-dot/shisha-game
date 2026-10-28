// Isolated production VN + exchange + real save/load UI; no full chapter playthrough.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const out = path.resolve(process.env.QA_OUT || '.codex/artifacts/lime-exchange-774');
await fs.mkdir(out, { recursive: true });
// Use the production shell/styles. Deliberately omit boot/loadAll and unrelated assets.
const html = (await fs.readFile(path.join(root, 'remake/index.html'), 'utf8'))
  .split('<script>')[0] + '</body></html>';
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.html': 'text/html', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/remake/qa-lime.html') {
    res.setHeader('Content-Type', 'text/html'); res.end(html); return;
  }
  // Optional original module for a before/after reproduction; production files stay intact.
  if (process.env.LIME_SOURCE && url.pathname === '/remake/js/motions/lime.js') {
    res.setHeader('Content-Type', 'text/javascript');
    res.end(await fs.readFile(process.env.LIME_SOURCE)); return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, // CIランナーではChromiumサンドボックスが使えない（headless shell / 通常Chromiumとも起動失敗を実測）。他テストと同じPlaywright既定（sandboxなし）に合わせる。

  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const results = [];
try {
  for (const [label, viewport, id, ds] of [
    ['pc', { width: 1280, height: 720 }, 'naru', false],
    ['touch', { width: 844, height: 390 }, 'adam', true],
  ].filter(([label]) => !process.env.QA_ONLY || process.env.QA_ONLY === label)) {
    const context = await browser.newContext({ viewport, hasTouch: ds, isMobile: ds });
    const page = await context.newPage();
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', r => { if (r.status() >= 400) failed.push(new URL(r.url()).pathname); });
    await page.goto(base + '/remake/qa-lime.html');
    await page.evaluate(async ({ id, ds }) => {
      document.querySelector('#boot').remove();
      document.body.dataset.screen = 'daily';
      document.querySelector('#stage').style.setProperty('--k', String(Math.min(innerWidth / 1280, innerHeight / 720)));
      const core = await import('./js/core/state.js');
      const data = await import('./js/core/data.js');
      const ui = await import('./js/core/ui.js');
      const vn = await import('./js/vn/engine.js');
      const saves = await import('./js/scenes/saves.js');
      const layout = await import('./js/scenes/game-layout.js');
      const titleLayout = await import('./js/scenes/title-layout.js');
      const chars = await (await fetch('../data/characters.json')).json();
      data.DB.characters = Object.fromEntries(chars.map(c => [c.id, c]));
      data.DB.manifest = await (await fetch('./data/manifest.json')).json();
      const talks = await (await fetch(`../data/dialogue/ch1_${id}.json`)).json();
      const first = talks.dialogues.find(d => d.branches?.early_lime_exchange);
      ui.initLayers();
      localStorage.setItem(titleLayout.TITLE_LAYOUT_KEY, ds ? 'ds' : 'normal');
      layout.initGameLayout();
      const s = core.newGame(); s.phase = 'daily';
      s.met[id] = true; s.flags[`known_name_${id}`] = true; s.flags[`_intro_${id}`] = true;
      window.QA = { core, vn, saves, id, count: 0, first, done: false };
      new MutationObserver(records => {
        for (const r of records) for (const n of r.addedNodes)
          if (n.nodeType === 1 && n.matches('.mo-lime')) QA.count++;
      }).observe(document.querySelector('#fx'), { childList: true });
      // Only this canonical exchange branch is played; production engine/motion are unchanged.
      QA.exchange = () => {
        QA.done = false;
        QA.run = vn.play({ dialogue_id: first.dialogue_id + '_qa_exchange',
          lines: first.branches.early_lime_exchange }).then(() => { QA.done = true; });
      };
    }, { id, ds });
    // Real SAVE and LOAD slot clicks, with an empty/new state between them.
    async function saveLoad() {
      await page.evaluate(() => { QA.saved = structuredClone(QA.core.state); QA.flow = QA.saves.saveFlow(); });
      await page.locator('[data-test="slot-1"]').click();
      if (await page.locator('[data-test="confirm-overwrite"]').isVisible())
        await page.locator('[data-test="confirm-overwrite"]').click();
      await page.evaluate(async () => { await QA.flow; QA.core.newGame();
        QA.flow = QA.saves.loadFlow({ inGame: true }).then(key => QA.core.loadFromSlot(key)); });
      await page.locator('[data-test="slot-1"]').click();
      await page.locator('[data-test="confirm-load"]').click();
      const same = await page.evaluate(async () => {
        await QA.flow;
        const actual = { ...QA.core.state, savedAt: QA.saved.savedAt };
        return JSON.stringify(actual) === JSON.stringify(QA.saved);
      });
      assert(same, label + ': real slot UI must restore the state');
    }
    await saveLoad();
    await page.evaluate(() => QA.exchange());
    for (let i = 0; i < 30; i++) {
      if (await page.locator('.mo-lime').count()) break;
      await page.keyboard.press('Enter'); await page.waitForTimeout(100);
    }
    await page.locator('.mo-lime-toast').waitFor({ state: 'visible' });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.mo-lime-toast')).opacity) > .99);
    const boxes = await page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; };
      return { stage:rect(document.querySelector('.mo-lime')), toast:rect(document.querySelector('.mo-lime-toast')),
        phone:rect(document.querySelector('.mo-lime-phone')), rows:[...document.querySelectorAll('.mo-lime-row')].map(rect) };
    });
    await page.screenshot({ path: path.join(out, label + '-exchange.png') });
    for (const r of [boxes.toast, boxes.phone, ...boxes.rows]) {
      assert(r.x >= boxes.stage.x - 1 && r.y >= boxes.stage.y - 1);
      assert(r.x + r.w <= boxes.stage.x + boxes.stage.w + 1);
      assert(r.y + r.h <= boxes.stage.y + boxes.stage.h + 1);
    }
    assert.equal(Math.round(boxes.stage.h), ds ? 390 : 720);
    await page.waitForFunction(() => QA.done);
    assert.equal(await page.evaluate(() => QA.count), 1);
    await saveLoad();
    await page.evaluate(() => QA.exchange());
    for (let i=0; i<30 && !await page.evaluate(() => QA.done); i++) {
      await page.keyboard.press('Enter'); await page.waitForTimeout(100);
    }
    await page.waitForFunction(() => QA.done);
    assert.equal(await page.evaluate(() => QA.count), 1, 'no replay after LOAD');
    assert.deepEqual(errors, []); assert.deepEqual(failed.filter(x => x !== '/icon.svg'), []);
    results.push({ label, id, boxes, initial:1, replayAfterLoad:0, realSlotUi:true, pageerrors:errors, failed });
    await context.close();
  }
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ status:'PASS', results }, null, 2));
  console.log(JSON.stringify({ status:'PASS', results }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
