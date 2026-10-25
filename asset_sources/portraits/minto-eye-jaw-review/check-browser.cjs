// Preview-only substitution: production images remain untouched.
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, 'remake/test/browser/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      for (const version of ['current', 'candidate']) {
        const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
        const page = await context.newPage();
        const errors = [];
        let substitutions = 0;
        page.on('pageerror', error => errors.push(error.message));
        if (version === 'candidate') await page.route('**/img/sprites/characters/minto/chr_minto_normal.webp', async route => {
          substitutions++;
          await route.fulfill({ path: path.join(__dirname, 'normal-v2-preview.webp'), contentType: 'image/webp' });
        });
        await page.goto('http://127.0.0.1:8123/remake/');
        await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
        await page.locator('#boot').waitFor({ state: 'detached' });
        await page.evaluate(async () => {
          const state = await import('./js/core/state.js');
          state.newGame(); state.state.met.minto = true; state.state.flags.known_name_minto = true;
          const vn = await import('./js/vn/engine.js');
          window.previewRun = vn.play({ dialogue_id: '__minto_eye_review', metadata: { bg: 'peppermint.png' }, lines: [{ speaker: 'minto', face: 'normal', text: 'いらっしゃい、今日は何にする？' }] });
        });
        await page.locator('.portrait.active').waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('.portrait')].every(i => i.complete && i.naturalWidth));
        await page.waitForTimeout(800);
        const info = await page.locator('.portrait.active').evaluate(i => ({ src: i.src, naturalWidth: i.naturalWidth, displayedWidth: i.getBoundingClientRect().width }));
        assert(info.src.endsWith('chr_minto_normal.webp'));
        assert.equal(info.naturalWidth, 896);
        if (version === 'candidate') assert(substitutions > 0);
        assert.deepEqual(errors, []);
        await page.screenshot({ path: path.join(__dirname, `game-${version}-${viewport.width}.jpg`) });
        results.push({ version, viewport, substitutions, errors, ...info });
        await context.close();
      }
    }
    fs.writeFileSync(path.join(__dirname, 'browser-check.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
