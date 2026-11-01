// Real HUD/map, isolated saves. BASELINE=1 records the unchanged appearance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const baseline = process.env.BASELINE === '1';
const phase = baseline ? 'before' : 'after';
const dir = process.env.ARTIFACT_DIR || 'docs/qa/lime-badge-670';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
try {
  for (const [device, viewport, touch] of [
    ['pc', { width: 1280, height: 900 }, false],
    ['landscape', { width: 844, height: 390 }, true],
    ['portrait', { width: 390, height: 844 }, true],
  ]) for (const layout of ['normal', 'ds']) {
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(layout => localStorage.setItem('suien_title_layout', layout), layout);
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 45000 });
    await page.locator('#boot').waitFor({ state: 'detached' });
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js');
      const s = core.newGame();
      Object.assign(s, { phase: 'daily', day: 4, slot: 0, seed: 131, money: 90000 });
      s.met.minto = true;
      window.badgeQA = { core, hud: await import('./js/daily/hud.js'), phone: await import('./js/daily/phone.js'), clicks: [] };
      badgeQA.hud.initHud({ phone: () => badgeQA.clicks.push('phone'), status: () => badgeQA.clicks.push('status'), menu: () => badgeQA.clicks.push('menu') });
      badgeQA.hud.showHud(true);
      const map = await import('./js/daily/map.js');
      window.mapFlow = map.chooseSpot();
    });
    await page.locator('.map').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const saved = await page.evaluate(() => JSON.stringify(badgeQA.core.state));
    const states = [];
    for (const count of [0, 1, 9, 10, 99, 100, 999, 9, 0]) {
      await page.evaluate(n => badgeQA.hud.setPhoneBadge(n), count);
      const geometry = await page.locator('.hud-lime').evaluate((icon, count) => {
        const b = icon.querySelector('.badge'), css = getComputedStyle(b);
        const rect = n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const text = document.createRange(); text.selectNodeContents(b);
        return { count, text: b.textContent, display: css.display, radius: css.borderRadius,
          badge: rect(b), icon: rect(icon), textRect: rect(text), label: icon.getAttribute('aria-label'),
          numberRect: b.querySelector('.badge-number') ? rect(b.querySelector('.badge-number')) : null,
          plusRect: b.querySelector('.badge-plus') ? rect(b.querySelector('.badge-plus')) : null,
          fontSize: parseFloat(css.fontSize), plusSize: b.querySelector('.badge-plus') ? parseFloat(getComputedStyle(b.querySelector('.badge-plus')).fontSize) : null,
          adjacent: [...document.querySelectorAll('.hud-level,.hud-menu')].map(rect) };
      }, count);
      assert.equal(geometry.display, count ? (baseline ? 'grid' : 'flex') : 'none');
      assert.equal(geometry.text, count > (baseline ? 9 : 99) ? (baseline ? '9+' : '99+') : count ? String(count) : '');
      assert.equal(geometry.label, count ? `LIME（未読${count}件）` : 'LIME');
      if (count && !baseline) {
        const { badge: b, icon: i, textRect: t } = geometry;
        // DSレイアウトではHUD右側が下部タッチバーの横長ボタンになる（game-ds.css）ため、正方形アイコンの前提は通常レイアウトのみ。
        if (layout !== 'ds') assert(Math.abs(i.width - i.height) < .1, 'app icon must stay square');
        assert(Math.abs(b.width - b.height) < .1, 'badge must remain circular at 99+');
        if (layout !== 'ds') assert(Math.abs(b.width / i.width - .4) < .025, 'badge diameter follows reference icon ratio');
        assert.equal(geometry.radius, '50%');
        assert(b.x + b.width > i.x + i.width && b.x + b.width / 2 > i.x + i.width / 2 && b.y < i.y, 'upper-right overlap');
        const n = geometry.numberRect;
        const opticalOffset = .5 * b.width / 20;
        assert(Math.abs(n.x + n.width / 2 - b.x - b.width / 2 - opticalOffset) < .1 && Math.abs(n.y + n.height / 2 - b.y - b.height / 2) < .1, 'number keeps its optical center independently of plus');
        if (count > 99) {
          assert(geometry.plusSize >= 12 && geometry.plusRect.height < n.height, 'plus uses readable CSS size and renders smaller than the digit');
          assert(geometry.plusRect.y < n.y && geometry.plusRect.x > n.x + n.width / 2, 'plus is at upper right of number');
        } else assert.equal(geometry.plusRect, null);
        assert(t.x >= b.x && t.y >= b.y && t.x + t.width <= b.x + b.width && t.y + t.height <= b.y + b.height, 'text fits circle');
        assert(b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width && b.y + b.height <= viewport.height, 'badge fits viewport');
        if (layout !== 'ds') assert(geometry.adjacent.every(a => b.x + b.width <= a.x + .1 || a.x + a.width <= b.x + .1 || b.y + b.height <= a.y + .1 || a.y + a.height <= b.y + .1), 'badge overlaps adjacent control');
      }
      states.push(geometry);
      if (count === 1 && !baseline && device === 'pc' && layout === 'normal') {
        const r = await page.locator('.hud-right').boundingBox();
        await page.screenshot({ path: path.join(dir, 'after-pc-normal-one-hud.png'),
          clip: { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 24 } });
      }
      if ([9, 99, 100].includes(count) && !baseline && device === 'pc' && layout === 'normal') {
        const r = await page.locator('.hud-right').boundingBox();
        await page.screenshot({ path: path.join(dir, `after-pc-normal-count-${count}-hud.png`),
          clip: { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 24 } });
      }
      if (count === 10) {
        await page.screenshot({ path: path.join(dir, `${phase}-${device}-${layout}.jpg`), type: 'jpeg', quality: 82 });
        const r = await page.locator('.hud-right').boundingBox();
        await page.screenshot({ path: path.join(dir, `${phase}-${device}-${layout}-hud.png`),
          clip: { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: r.width + 24, height: r.height + 24 } });
      }
    }
    if (!baseline) {
      const boxes = states.filter(s => s.count > 0).map(s => s.badge);
      for (const box of boxes) assert.deepEqual(box, boxes[0], 'badge position and diameter must not change with digit count');
    }
    assert.equal(await page.evaluate(() => JSON.stringify(badgeQA.core.state)), saved, 'badge rendering changes game state');
    // Read/unread derives from the existing inbox flags; restoring the snapshot needs no save migration.
    const counts = await page.evaluate(() => {
      const s = badgeQA.core.state;
      s.inbox = [{ id: 'qa-badge', read: false }];
      const unread = badgeQA.phone.unreadCount(); badgeQA.hud.setPhoneBadge(unread);
      const before = document.querySelector('.hud-lime').classList.contains('has');
      s.inbox[0].read = true;
      const read = badgeQA.phone.unreadCount(); badgeQA.hud.setPhoneBadge(read);
      return { unread, read, before, after: document.querySelector('.hud-lime').classList.contains('has') };
    });
    assert.deepEqual(counts, { unread: 1, read: 0, before: true, after: false });
    await page.evaluate(() => badgeQA.hud.setPhoneBadge(10));
    const rotateHint = touch && device === 'portrait' && layout === 'normal';
    if (rotateHint) {
      assert(await page.locator('#rotate-hint').isVisible(), 'normal portrait keeps its existing rotation prompt');
    } else {
      for (const id of ['hud-status', 'hud-phone', 'hud-menu']) {
        const target = page.locator(`[data-test="${id}"]`);
        if (touch) await target.tap(); else await target.click();
      }
      assert.deepEqual(await page.evaluate(() => badgeQA.clicks), ['status', 'phone', 'menu']);
    }
    assert.deepEqual(errors, []);
    results.push({ device, viewport, layout, states, counts, rotateHint, errors });
    console.log(`PASS ${phase}: ${device}/${layout}`);
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(dir, `${phase}.json`), JSON.stringify({ ref: process.env.TEST_REF || null, results }, null, 2) + '\n');
  await browser.close();
}
