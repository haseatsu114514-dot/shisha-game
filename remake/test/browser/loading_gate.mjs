import assert from "node:assert/strict";
import path from "node:path";
import { suite, baseURL } from "./support.mjs";

await suite("loading-gate", async check => {
  for (const [label, viewport] of [["pc", { width: 1280, height: 900 }], ["mobile", { width: 844, height: 390 }]]) {
    await check(label, async page => {
      const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
      await page.locator('[data-demo="comic"]').click();
      await page.locator('.loading-gate').waitFor();
      assert.equal(await page.locator('#underlying').evaluate(node => node.closest('.demo-scene').inert), true);
      await page.locator('.loading-panels img').first().waitFor();
      assert.equal(await page.locator('.loading-panels img').count(), 2);
      assert.equal(await page.locator('.loading-status').innerText(), 'LOADING…');
      assert.equal(await page.locator('.loading-comic-title').innerText(), '２コマ漫画・配置確認');
      // Per-comic one-line note and live text bubbles overlaid on the art (typo-fixable dialogue).
      assert.match(await page.locator('.loading-comic-caption').innerText(), /一行解説/);
      assert.equal(await page.locator('.loading-bubble').count(), 2);
      assert.match(await page.locator('.loading-bubble').first().innerText(), /テキスト台詞1/);
      assert.equal(await page.locator('.loading-gate button, .loading-gate progress, .loading-gate figcaption').count(), 0);
      await page.screenshot({ path: path.resolve(`.codex/artifacts/remake-browser/loading-comic-${label}.png`) });
      const boxes = await page.locator('.loading-panels img').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, natural: node.naturalWidth };
      }));
      assert(boxes.every(box => box.natural > 0 && box.width > 0 && box.left >= 0 && box.right <= viewport.width));
      assert(boxes[0].right < boxes[1].left, "Panels read from left to right");
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.loading-gate').evaluate(node => node === document.activeElement), true);
      // Pending-phase input blocking is covered deterministically by input-held-until-ready.
      // When a comic is shown, preparation finishing opens a reading hold; a click advances past it.
      await page.evaluate(() => { window.clicksBehindGate = 0; window.addEventListener('click', () => { window.clicksBehindGate++; }, { once: true }); });
      await page.locator('.loading-gate.is-ready').waitFor();
      assert.equal(await page.locator('.loading-proceed').evaluate(node => getComputedStyle(node).opacity !== '0'), true, 'The reading prompt appears');
      assert.equal(await page.locator('.loading-status').innerText(), '準備完了', 'The status says loading has finished');
      assert.equal(await page.locator('.loading-proceed').innerText(), 'クリック・Enter で進む', 'A mouse-and-keyboard screen is told to click or press Enter');
      await page.locator('.loading-status').click();
      await page.locator('.loading-gate').waitFor({ state: 'detached' });
      assert.equal(await page.locator('#underlying').evaluate(node => node.closest('.demo-scene').inert), false);
      assert.match(await page.locator('#result').textContent(), /準備完了/);
      assert.equal(await page.evaluate(() => window.clicksBehindGate), 0, 'Gate clicks must not reach gameplay handlers');
      assert.equal(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })), storage);
    }, { viewport });
  }
  await check("input-held-until-ready", async page => {
    await page.evaluate(async () => {
      const { withLoading } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>';
      const comics = [{ id: 'input-held', title: 'input-held', minChapter: 1,
        panels: [{ src, alt: 'one' }, { src, alt: 'two' }] }];
      let started;
      const preparationStarted = new Promise(resolve => { started = resolve; });
      window.clicksBehindGate = 0;
      window.addEventListener('click', () => { window.clicksBehindGate++; }, { once: true });
      withLoading(() => new Promise(resolve => {
        window.__releaseLoadingGate = resolve;
        started();
      }), { host, delayMs: 0, comics }).then(() => {}, () => {});
      await preparationStarted;
    });
    assert.equal(await page.locator('.loading-gate').count(), 1);
    assert.equal(await page.locator('.loading-gate.is-ready').count(), 0);
    // The preparation stays held by the test, so waiting for the comic to render
    // first is safe — and keeps the layout shift from the panel pop-in out of
    // the click's way.
    await page.locator('.loading-panels img').first().waitFor();
    assert.equal(await page.locator('.loading-panels img').count(), 2);
    await page.locator('.loading-status').click();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.loading-gate').count(), 1, 'Input must not skip preparation');
    assert.equal(await page.evaluate(() => window.clicksBehindGate), 0);
    await page.evaluate(() => window.__releaseLoadingGate());
    await page.locator('.loading-gate.is-ready').waitFor();
    assert.equal(await page.locator('.loading-proceed').evaluate(node => getComputedStyle(node).opacity !== '0'), true, 'The reading prompt appears');
    assert.equal(await page.locator('.loading-gate').count(), 1);
    await page.keyboard.press('Enter');
    await page.locator('.loading-gate').waitFor({ state: 'detached' });
  });
  await check("late-art-keeps-layout-and-reading-guard", async page => {
    // The sheet's space is reserved while the art decodes, so the logo and gauge do not jump when it
    // arrives; and taps made before the ready look appears (left over from the previous screen, or
    // mashing) must not skip a comic nobody has read yet.
    await page.route('**/late-panel.svg', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"/>' });
    });
    await page.evaluate(async () => {
      const { withLoading } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const src = new URL('late-panel.svg', location.href).href;
      let started;
      const preparationStarted = new Promise(resolve => { started = resolve; });
      window.__lateGate = withLoading(() => new Promise(resolve => {
        window.__releaseLateGate = resolve;
        started();
      }), { host, delayMs: 0, comics: [{ id: 'late', title: 'late', minChapter: 1, caption: 'note',
        panels: [{ src, alt: 'one' }, { src, alt: 'two' }] }] });
      await preparationStarted;
    });
    const layout = () => page.evaluate(() => {
      const gate = document.querySelector('.loading-gate');
      const top = selector => Math.round(gate.querySelector(selector).getBoundingClientRect().top);
      return { logo: top('.loading-logo'), bar: top('.loading-bar'),
        card: getComputedStyle(gate.querySelector('.loading-card')).visibility,
        images: gate.querySelectorAll('.loading-panels img').length };
    });
    const before = await layout();
    assert.deepEqual([before.card, before.images], ['hidden', 0], 'The sheet stays hidden until its art is decoded');
    await page.locator('.loading-panels img').first().waitFor();
    const after = await layout();
    assert.deepEqual([after.logo, after.bar, after.card, after.images], [before.logo, before.bar, 'visible', 2],
      'Late art must not move the logo or the gauge');
    const hold = await page.evaluate(async () => {
      const releasedAt = performance.now();
      window.__releaseLateGate();
      let taps = 0;
      for (;;) {
        const gate = document.querySelector('.loading-gate');
        if (!gate) return { skipped: true, taps };
        const status = gate.querySelector('.loading-status').innerText;
        if (gate.classList.contains('is-ready')) return { skipped: false, taps, heldMs: performance.now() - releasedAt, status };
        if (status !== 'LOADING…') return { skipped: false, taps, early: status };
        gate.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        taps++;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    });
    assert.equal(hold.skipped, false, 'Taps made before the ready look must not skip the comic');
    assert.equal(hold.status, '準備完了', `The status changes only with the ready look, got ${JSON.stringify(hold)}`);
    assert(hold.taps >= 3 && hold.heldMs >= 200, `The reading guard must outlast early taps, got ${JSON.stringify(hold)}`);
    await page.locator('.loading-status').click();
    await page.locator('.loading-gate').waitFor({ state: 'detached' });
    await page.evaluate(() => window.__lateGate);
  });
  await check("portrait-readable", async page => {
    // Portrait escapes the shrunken #stage: the overlay covers the real viewport and stacks the
    // two panels large so the bubble text stays readable (and still advances on a key press).
    await page.locator('[data-demo="comic"]').click();
    await page.locator('.loading-gate').waitFor();
    await page.locator('.loading-panels img').first().waitFor();
    assert.equal(await page.locator('.loading-gate').evaluate(node => node.classList.contains('is-viewport') && node.parentElement === document.body), true, 'Portrait renders at viewport scale, outside #stage');
    const layout = await page.evaluate(() => {
      const arts = [...document.querySelectorAll('.loading-panel-art')].map(node => node.getBoundingClientRect());
      const bubble = document.querySelector('.loading-bubble');
      return {
        widths: arts.map(box => box.width),
        stacked: arts.length === 2 && arts[1].top >= arts[0].bottom - 2,
        bubbleFont: bubble ? parseFloat(getComputedStyle(bubble).fontSize) : 0,
        withinViewport: arts.every(box => box.left >= -1 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1),
      };
    });
    assert(layout.stacked, 'Portrait stacks the two panels vertically');
    assert(layout.widths.every(width => width >= 280), `Panels must be large in portrait, got ${layout.widths}`);
    assert(layout.bubbleFont >= 14, `Bubble text must stay readable in portrait, got ${layout.bubbleFont}px`);
    assert(layout.withinViewport, 'Portrait layout stays within the viewport');
    await page.screenshot({ path: path.resolve('.codex/artifacts/remake-browser/loading-comic-portrait.png') });
    await page.locator('.loading-gate.is-ready').waitFor();
    await page.keyboard.press('Enter');
    await page.locator('.loading-gate').waitFor({ state: 'detached' });
    assert.match(await page.locator('#result').textContent(), /準備完了/);
  }, { viewport: { width: 390, height: 844 } });
  await check("phone-landscape-readable", async page => {
    // A phone held sideways leaves the letterboxed #stage like portrait does: no logo, panels that use the
    // screen width, and small texts with a real-pixel floor (they used to shrink to about 8px).
    await page.locator('[data-demo="comic"]').click();
    await page.locator('.loading-gate').waitFor();
    await page.locator('.loading-panels img').first().waitFor();
    await page.locator('.loading-gate.is-ready').waitFor();
    const layout = await page.evaluate(() => {
      const gate = document.querySelector('.loading-gate');
      const box = selector => gate.querySelector(selector).getBoundingClientRect();
      const font = selector => parseFloat(getComputedStyle(gate.querySelector(selector)).fontSize);
      return {
        viewport: gate.classList.contains('is-viewport') && gate.parentElement === document.body,
        logo: getComputedStyle(gate.querySelector('.loading-logo')).display,
        panelWidths: [...gate.querySelectorAll('.loading-panel-art')].map(node => node.getBoundingClientRect().width),
        sideBySide: box('.loading-panel-art').top === [...gate.querySelectorAll('.loading-panel-art')][1].getBoundingClientRect().top,
        fonts: { title: font('.loading-comic-title'), caption: font('.loading-comic-caption'), status: font('.loading-status'), proceed: font('.loading-proceed') },
        within: ['.loading-card', '.loading-bar', '.loading-status', '.loading-proceed'].map(box)
          .every(rect => rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1),
        prompt: gate.querySelector('.loading-proceed').innerText,
      };
    });
    assert(layout.viewport, 'Short landscape renders the gate at viewport scale, outside #stage');
    assert.equal(layout.logo, 'none', 'The logo gives its height to the panels');
    assert(layout.sideBySide && layout.panelWidths.every(width => width >= 340), `Panels must be large and side by side, got ${layout.panelWidths}`);
    assert(layout.fonts.caption >= 12 && layout.fonts.proceed >= 12 && layout.fonts.status >= 13 && layout.fonts.title >= 16,
      `Small texts keep a readable floor, got ${JSON.stringify(layout.fonts)}`);
    assert(layout.within, 'The whole stack stays on screen');
    assert.equal(layout.prompt, 'タップで進む', 'A touch screen is only told to tap');
    await page.screenshot({ path: path.resolve('.codex/artifacts/remake-browser/loading-comic-phone-landscape.png') });
    await page.locator('.loading-status').tap();
    await page.locator('.loading-gate').waitFor({ state: 'detached' });
    assert.match(await page.locator('#result').textContent(), /準備完了/);
  }, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await check("fast-error-cancel", async page => {
    await page.evaluate(() => {
      window.gatesShown = 0;
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) if (node.matches?.('.loading-gate')) window.gatesShown++;
      }).observe(document.querySelector('#loading-demo'), { childList: true });
    });
    await page.locator('[data-demo="fast"]').click();
    await page.getByText('準備完了。次の場面を開始できます。', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.gatesShown), 0);
    await page.locator('[data-demo="error"]').click();
    await page.getByText('準備に失敗しました。再度お試しください。', { exact: true }).waitFor();
    assert.equal(await page.locator('.loading-gate').count(), 0);
    await page.locator('[data-demo="plain"]').click();
    await page.locator('.loading-gate').waitFor();
    await page.locator('#cancel').click();
    await page.getByText('中断しました。元の操作に戻れます。', { exact: true }).waitFor();
    await page.locator('#underlying').click();
    assert.match(await page.locator('#result').textContent(), /操作を受け付け/);
  });
  await check("no-comic-does-not-wait", async page => {
    await page.locator('[data-demo="plain"]').click();
    await page.locator('.loading-gate').waitFor();
    assert.equal(await page.locator('.loading-comic img').count(), 0);
    // No comic means no reading hold: the gate never becomes ready-to-advance and closes on its own.
    assert.equal(await page.locator('.loading-gate.is-ready').count(), 0);
    await page.getByText('準備完了。次の場面を開始できます。', { exact: true }).waitFor();
    assert.equal(await page.locator('.loading-gate').count(), 0);
  });
  // Short waits inside a scene (core/ui.js loadingNotice, the conversation's art) open soft gates: the same
  // loading screen, never competing with another gate. Right after a comic was read, a gate that still has
  // to show goes on with that comic (one continuous screen), without a second hold.
  await check("soft-gates-and-continuing-screen", async page => {
    const result = await page.evaluate(async () => {
      const { withLoading } = await import('./js/core/loading.js');
      localStorage.setItem('suien_loading_comics', 'always');
      const host = document.querySelector('#loading-demo');
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"/>';
      const comic = id => ({ id, title: id, minChapter: 1, panels: [{ src, alt: 'one' }, { src, alt: 'two' }] });
      const ready = () => new Promise(resolve => { const poll = () => host.querySelector('.loading-gate.is-ready') ? resolve() : setTimeout(poll, 20); poll(); });
      const tap = () => host.querySelector('.loading-gate').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      // A soft wait while a gate is open only waits for its own work.
      let release;
      const outer = withLoading(() => new Promise(resolve => { release = resolve; }), { host, delayMs: 0, comics: [comic('outer')] });
      const inner = await withLoading(async () => 'inner-done', { host, delayMs: 0, soft: true, comics: [comic('inner')] });
      await new Promise(resolve => { const poll = () => release ? resolve() : setTimeout(poll, 10); poll(); });
      const again = await withLoading(async () => 'again', { host, delayMs: 0, soft: true, comics: [comic('inner')] });
      const gates = again === 'again' ? host.querySelectorAll('.loading-gate').length : -1;
      release();
      await ready(); tap(); await outer;
      // Right after that read, a gate that shows carries the same comic and closes with its work.
      const titles = [];
      const observer = new MutationObserver(() => { const t = host.querySelector('.loading-comic-title')?.textContent; if (t && titles.at(-1) !== t) titles.push(t); });
      observer.observe(host, { subtree: true, childList: true, characterData: true });
      let readyDuringContinue = false;
      const readyWatch = new MutationObserver(() => { if (host.querySelector('.loading-gate.is-ready')) readyDuringContinue = true; });
      readyWatch.observe(host, { subtree: true, attributes: true, attributeFilter: ['class'] });
      const reads = [];
      await withLoading(() => new Promise(resolve => setTimeout(resolve, 500)), { host, delayMs: 0, comics: [comic('next')], onRead: c => reads.push(c.id) });
      readyWatch.disconnect(); observer.disconnect();
      // A gate that needs the screen waits for an open soft gate instead of failing.
      let releaseSoft;
      const soft = withLoading(() => new Promise(resolve => { releaseSoft = resolve; }), { host, delayMs: 0, soft: true, comics: [] });
      let hardStarted = false;
      const hard = withLoading(async () => { hardStarted = true; return 'hard-done'; }, { host, delayMs: 0, comics: [] });
      await new Promise(resolve => setTimeout(resolve, 100));
      const waited = !hardStarted;
      await new Promise(resolve => { const poll = () => releaseSoft ? resolve() : setTimeout(poll, 10); poll(); });
      releaseSoft();
      await soft;
      const hardValue = await hard;
      // Two gates that both need the screen are still refused.
      let pending;
      const first = withLoading(() => new Promise(resolve => { pending = resolve; }), { host, delayMs: 0, comics: [] });
      const refused = await withLoading(async () => {}, { host, comics: [] }).then(() => false, () => true);
      await new Promise(resolve => { const poll = () => pending ? resolve() : setTimeout(poll, 10); poll(); });
      pending(); await first;
      return { inner, gates, titles, readyDuringContinue, reads: reads.length, waited, hardValue, refused };
    });
    assert.deepEqual(result, { inner: 'inner-done', gates: 1, titles: ['outer'], readyDuringContinue: false, reads: 0,
      waited: true, hardValue: 'hard-done', refused: true });
  });
  await check("unread-first-and-read-record", async page => {
    const result = await page.evaluate(async () => {
      const { withLoading, selectLoadingComic } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"/>';
      const comics = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id, minChapter: 1, panels: [{ src, alt: 'one' }, { src, alt: 'two' }] }));
      // Unread comics are drawn until none is left; then every comic is offered again.
      const read = new Set();
      const order = [];
      for (let i = 0; i < comics.length; i++) { const comic = selectLoadingComic(comics, { isRead: id => read.has(id) }); order.push(comic.id); read.add(comic.id); }
      const allOnce = new Set(order).size === comics.length;
      const lastUnread = [1, 2, 3].map(() => selectLoadingComic(comics, { isRead: id => id !== 'c' }).id).join();
      const afterAll = [1, 2, 3, 4].map(() => selectLoadingComic(comics, { isRead: () => true }).id);
      const repeatsAvoided = afterAll.every((id, i) => i === 0 || id !== afterAll[i - 1]);
      // onRead: only when a shown comic is passed by the reader's own tap or key.
      const calls = [];
      const gate = (prepareMs, options = {}) => withLoading(() => new Promise(resolve => setTimeout(resolve, prepareMs)), {
        host, delayMs: 0, comics: [comics[0]], onRead: comic => calls.push(comic.id), ...options });
      const pending = gate(300);
      await new Promise(resolve => { const poll = () => host.querySelector('.loading-gate.is-ready') ? resolve() : setTimeout(poll, 20); poll(); });
      const beforeProceed = calls.length;
      host.querySelector('.loading-gate').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await pending;
      const afterProceed = calls.join();
      // A failing record must not break the gate.
      const throwing = gate(300, { onRead: () => { throw new Error('storage full'); } });
      await new Promise(resolve => { const poll = () => host.querySelector('.loading-gate.is-ready') ? resolve() : setTimeout(poll, 20); poll(); });
      host.querySelector('.loading-gate').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const survived = await throwing.then(() => true, () => false);
      // Leaving the scene during the reading hold is not a read.
      const controller = new AbortController();
      const left = gate(300, { signal: controller.signal });
      await new Promise(resolve => { const poll = () => host.querySelector('.loading-gate.is-ready') ? resolve() : setTimeout(poll, 20); poll(); });
      controller.abort();
      const aborted = await left.then(() => false, error => error.name === 'AbortError');
      // No comic on screen (broken art): nothing to record.
      await gate(300, { comics: [{ ...comics[0], panels: [{ src, alt: 'one' }, { src: 'data:image/png,invalid', alt: 'two' }] }] });
      return { allOnce, lastUnread, repeatsAvoided, beforeProceed, afterProceed, survived, aborted, total: calls.join() };
    });
    assert.deepEqual(result, { allOnce: true, lastUnread: 'c,c,c', repeatsAvoided: true, beforeProceed: 0, afterProceed: 'a', survived: true, aborted: true, total: 'a' });
  });
  // Fixed points (bench entry, minigame start, chapter start, resume, boot; core/loading.js comicLoadingRequired):
  // for players the comic gate shows every time, even with nothing to load. Automated browsers keep the
  // old rule (only when a wait occurs); suien_loading_comics = "always" / "wait" switches it for checks.
  await check("fixed-points-show-the-comic", async page => {
    const result = await page.evaluate(async () => {
      const { withLoading, comicLoadingRequired } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"/>';
      const comics = [{ id: 'fixed-a', title: 'fixed-a', minChapter: 1, panels: [{ src, alt: 'one' }, { src, alt: 'two' }] }];
      const ready = () => new Promise(resolve => { const poll = () => host.querySelector('.loading-gate.is-ready') ? resolve() : setTimeout(poll, 20); poll(); });
      let shown = false;
      const observer = new MutationObserver(() => { if (host.querySelector('.loading-gate')) shown = true; });
      observer.observe(host, { childList: true, subtree: true });
      const automated = comicLoadingRequired();
      localStorage.setItem('suien_loading_comics', 'wait');
      const waitMode = comicLoadingRequired();
      await withLoading(async () => {}, { host, comics, fixed: true });
      const waitShown = shown;
      localStorage.setItem('suien_loading_comics', 'always');
      shown = false;
      const calls = [];
      const first = withLoading(async () => 'done', { host, comics, fixed: true,
        onRead: comic => calls.push('read:' + comic.id), onProceed: () => calls.push('proceed') });
      await ready();
      const holding = !!host.querySelector('.loading-panels img') && calls.length === 0;
      host.querySelector('.loading-gate').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const value = await first;
      // A fixed point right after a read comic (a LOAD that reloads and resumes) does not stack a second one.
      shown = false;
      await withLoading(async () => {}, { host, comics, fixed: true });
      const stacked = shown;
      await new Promise(resolve => setTimeout(resolve, 2100));
      const again = withLoading(async () => {}, { host, comics, fixed: true });
      await ready();
      const againShown = shown;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await again;
      observer.disconnect();
      return { automated, waitMode, waitShown, holding, value, calls: calls.join(), stacked, againShown };
    });
    assert.deepEqual(result, { automated: false, waitMode: false, waitShown: false, holding: true, value: 'done',
      calls: 'proceed,read:fixed-a', stacked: false, againShown: true });
  });
  await check("shown-gate-waits-for-its-comic", async page => {
    await page.route('**/late-fixed-*.svg', async route => {
      await new Promise(resolve => setTimeout(resolve, 600));
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"/>' });
    });
    const result = await page.evaluate(async () => {
      const { withLoading } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const comic = n => [{ id: 'late-' + n, title: 'late', minChapter: 1, panels: ['a', 'b'].map(side =>
        ({ src: new URL(`late-fixed-${n}${side}.svg`, location.href).href, alt: side })) }];
      const run = async (mode, n) => {
        localStorage.setItem('suien_loading_comics', mode);
        let ready = false;
        const observer = new MutationObserver(() => {
          const gate = host.querySelector('.loading-gate.is-ready');
          if (gate && !ready) { ready = true; gate.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }
        });
        observer.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
        const started = performance.now();
        await withLoading(() => new Promise(resolve => setTimeout(resolve, 100)), { host, delayMs: 0, comics: comic(n) });
        observer.disconnect();
        return { ready, ms: Math.round(performance.now() - started) };
      };
      return { wait: await run('wait', 1), always: await run('always', 2) };
    });
    assert.equal(result.wait.ready, false, 'Automated default: preparation that ends before the art closes the plain gate');
    assert.equal(result.always.ready, true, 'A shown gate waits for its comic and holds for reading');
    assert(result.always.ms >= 1250, `The hold starts after the late art (600 ms) plus the reading guard, got ${result.always.ms} ms`);
  });
  // The comic is a must for players: a comic whose art cannot be fetched gives way to the comic read last
  // (already in the cache), and art handed over from the boot screen is used as it is (no second download).
  await check("comic-always-shows", async page => {
    const result = await page.evaluate(async () => {
      const { withLoading, primeLoadingArt } = await import('./js/core/loading.js');
      localStorage.setItem('suien_loading_comics', 'always');
      const host = document.querySelector('#loading-demo');
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"/>';
      const ok = id => ({ id, title: id, minChapter: 1, panels: [{ src, alt: 'one' }, { src, alt: 'two' }] });
      const broken = { id: 'broken', title: 'broken', minChapter: 1, panels: [{ src, alt: 'one' }, { src: 'data:image/png,invalid', alt: 'two' }] };
      const readGate = async comics => {
        const reads = [];
        const gate = withLoading(async () => {}, { host, comics, fixed: true, onRead: comic => reads.push(comic.id) });
        await new Promise(resolve => { const poll = () => host.querySelector('.loading-gate.is-ready') ? resolve() : setTimeout(poll, 20); poll(); });
        const title = host.querySelector('.loading-comic-title')?.textContent;
        const images = [...host.querySelectorAll('.loading-panels img')];
        host.querySelector('.loading-gate').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await gate;
        return { title, reads: reads.join(), images };
      };
      const first = await readGate([ok('first')]);
      await new Promise(resolve => setTimeout(resolve, 2100)); // past the continuing gap
      const fallback = await readGate([broken]);
      await new Promise(resolve => setTimeout(resolve, 2100));
      const primed = [new Image(), new Image()];
      primed.forEach(img => { img.src = src; });
      await Promise.all(primed.map(img => img.decode()));
      primeLoadingArt('boot-comic', primed);
      const reused = await readGate([{ ...ok('boot-comic'), panels: [{ src: src + '#a', alt: 'one' }, { src: src + '#b', alt: 'two' }] }]);
      // The gate that goes on right after a read (continuing) shows the same decoded images at once: no blink.
      let carried = null;
      await withLoading(async () => {
        const images = [...host.querySelectorAll('.loading-panels img')];
        carried = !host.querySelector('.loading-card.is-waiting') && images.length === 2 && images.every((img, i) => img === reused.images[i]);
      }, { host, comics: [ok('other')], delayMs: 0 });
      return { first: first.title, fallback: fallback.title, fallbackRead: fallback.reads,
        sameElements: reused.images.length === 2 && reused.images.every((img, i) => img === primed[i]), carried };
    });
    assert.deepEqual(result, { first: 'first', fallback: 'first', fallbackRead: 'first', sameElements: true, carried: true });
  });
  await check("next-comic-is-fetched-ahead", async page => {
    const result = await page.evaluate(async () => {
      const { warmNextLoadingComic, selectLoadingComic } = await import('./js/core/loading.js');
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"/>';
      const comics = ['p', 'q', 'r', 's'].map(id => ({ id, title: id, minChapter: 1, panels: [{ src, alt: 'one' }, { src, alt: 'two' }] }));
      const rounds = [];
      for (let i = 0; i < 8; i++) {
        const warmed = warmNextLoadingComic(comics, { isRead: id => id === 'p' });
        rounds.push(warmed.id !== 'p' && selectLoadingComic(comics, { isRead: id => id === 'p' }).id === warmed.id);
      }
      // A warmed comic that is no longer a fair pick (read since) is not forced.
      const warmed = warmNextLoadingComic(comics, {});
      const later = selectLoadingComic(comics, { isRead: id => id === warmed.id });
      return { rounds: rounds.every(Boolean), skipped: later.id !== warmed.id };
    });
    assert.deepEqual(result, { rounds: true, skipped: true });
  });
  await check("slow-comic-does-not-delay", async page => {
    await page.route('**/slow-panel.svg', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>' });
    });
    const result = await page.evaluate(async () => {
      const { withLoading } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const src = new URL('slow-panel.svg', location.href).href;
      let imagesReceived = false;
      const observer = new MutationObserver(() => { if (host.querySelector('.loading-panels img')) imagesReceived = true; });
      observer.observe(host, { childList: true, subtree: true });
      await withLoading(() => new Promise(resolve => setTimeout(resolve, 300)), { host, delayMs: 0,
        comics: [{ id: 'slow', title: 'slow', minChapter: 1, panels: [{ src, alt: 'one' }, { src, alt: 'two' }] }] });
      observer.disconnect();
      return { imagesReceived, closed: !host.querySelector('.loading-gate') };
    });
    assert.deepEqual(result, { imagesReceived: false, closed: true });
    // Let the deliberately slow successful response finish before closing the context.
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.loading-gate').count(), 0, 'Late images must not recreate a closed gate');
  });
  await check("failures-lifecycle", async page => {
    const result = await page.evaluate(async () => {
      const { withLoading, selectLoadingComic } = await import('./js/core/loading.js');
      const host = document.querySelector('#loading-demo');
      const original = host.firstElementChild;
      original.inert = true;
      host.setAttribute('aria-busy', 'false');
      let release, started;
      const preparationStarted = new Promise(resolve => { started = resolve; });
      const controller = new AbortController();
      const pending = withLoading(() => new Promise(resolve => { release = resolve; started(); }), { host, delayMs: 0, signal: controller.signal });
      const duplicate = await withLoading(async () => {}, { host }).then(() => false, () => true);
      await preparationStarted;
      controller.abort();
      const aborted = await pending.then(() => false, error => error.name === 'AbortError');
      release?.();
      const restored = original.inert && host.getAttribute('aria-busy') === 'false' && !host.querySelector('.loading-gate');
      original.inert = false;
      // Use valid SVG responses for successful images and an invalid data URL for a missing panel.
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>';
      const invalid = [{ id: 'broken', title: 'broken', minChapter: 1, panels: [{ src, alt: 'one' }, { src: 'data:image/png,invalid', alt: 'two' }] }];
      await withLoading(() => new Promise(resolve => setTimeout(resolve, 300)), { host, delayMs: 0, comics: invalid });
      const recovered = !host.querySelector('.loading-gate');
      const spoiler = selectLoadingComic([{ ...invalid[0], minChapter: 3 }], { chapter: 1 }) === null;
      const wrongContext = selectLoadingComic([{ ...invalid[0], contexts: ['craft'] }], { context: 'travel' }) === null;
      const malformed = selectLoadingComic([{ ...invalid[0], panels: [] }]) === null;
      const valid = ["a", "b"].map(id => ({ ...invalid[0], id }));
      const random = Math.random;
      Math.random = () => { throw new Error('Loading consumed gameplay random'); };
      let first, next;
      try { first = selectLoadingComic(valid); next = selectLoadingComic(valid); }
      finally { Math.random = random; }
      const fresh = first.id !== next.id;
      return { duplicate, aborted, restored, recovered, spoiler, wrongContext, malformed, fresh };
    });
    assert(Object.values(result).every(Boolean), JSON.stringify(result));
  });
}, { entry: new URL('loading-preview.html', baseURL).href, readySelector: '[data-demo="plain"]', readLoadingComics: false });
