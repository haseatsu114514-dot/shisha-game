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
  await check("scene-notice-comic-lifecycle", async page => {
    await page.addStyleTag({ url: new URL('css/vn.css', baseURL).href });
    const setup = await page.evaluate(async () => {
      const { withLoadingNotice } = await import('./js/core/module-loading.js');
      const { attachLoadingComic } = await import('./js/core/loading-comic-notice.js');
      const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"/>';
      const comic = { id: 'scene-test', title: 'Scene comic', minChapter: 1, contexts: ['scene'],
        cast: ['sumi'], panels: [{ src, alt: 'first' }, { src, alt: 'second' }] };
      const run = (duration, comics = [comic], chapter = 1) => {
        const notice = document.createElement('div');
        notice.className = 'vn-loading';
        notice.textContent = '場面を準備しています…';
        let hide;
        return withLoadingNotice(new Promise(resolve => setTimeout(resolve, duration)), {
          delayMs: 500,
          onShow() { document.body.append(notice); hide = attachLoadingComic(notice, {
            comics, chapter, isMet: id => id === 'sumi',
          }); },
          onHide() { hide?.(); },
        });
      };
      const seen = [];
      new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) {
        if (node.matches?.('.vn-loading')) seen.push('notice');
        if (node.matches?.('.vn-loading-comic')) seen.push('comic');
      } }).observe(document.body, { subtree: true, childList: true });
      await run(50);
      const fast = seen.length === 0;
      // The notice shows after 500 ms; a comic joins it only 700 ms later. A wait that ends in between
      // keeps the plain notice, so no comic flashes for a moment and disappears unread.
      await run(950);
      const brief = seen.join();
      seen.length = 0;
      window.__finishSceneNotice = run(2400);
      return { fast, brief };
    });
    assert.equal(setup.fast, true, 'A short wait must not show a notice or comic');
    assert.equal(setup.brief, 'notice', 'A wait that ends soon after the notice shows no comic');
    await page.locator('.vn-loading-comic-panels img').first().waitFor();
    assert.equal(await page.locator('.vn-loading-comic-panels img').count(), 2);
    await page.evaluate(() => window.__finishSceneNotice);
    assert.equal(await page.locator('.vn-loading').count(), 0, 'The comic closes as soon as preparation ends');
    const fallback = await page.evaluate(async () => {
      const { attachLoadingComic } = await import('./js/core/loading-comic-notice.js');
      const { LOADING_COMICS } = await import('./js/core/loading-comics.js');
      const notice = document.createElement('div');
      document.body.append(notice);
      const hide = attachLoadingComic(notice, { comics: LOADING_COMICS, context: 'boot', chapter: 9, isMet: null });
      await new Promise(resolve => setTimeout(resolve, 1000));
      const plain = notice.isConnected && !notice.querySelector('.vn-loading-comic');
      hide();
      return plain;
    });
    assert.equal(fallback, true, 'A context without registered comics keeps the plain notice');
    // Registered comics are offered to scene waits: unread ones first, and showing one here is not a read.
    const registered = await page.evaluate(async () => {
      const { attachLoadingComic, NOTICE_COMIC_CONTEXTS } = await import('./js/core/loading-comic-notice.js');
      const { LOADING_COMICS } = await import('./js/core/loading-comics.js');
      const { LOADING_COMICS_READ_KEY } = await import('./js/core/loading-comic-log.js');
      const met = id => id === 'sumi';
      const own = LOADING_COMICS.filter(comic => comic.minChapter <= 1 && comic.cast.every(met));
      const before = localStorage.getItem(LOADING_COMICS_READ_KEY);
      const titles = [];
      for (let round = 0; round < 3; round++) {
        const notice = document.createElement('div');
        notice.className = 'vn-loading';
        document.body.append(notice);
        const hide = attachLoadingComic(notice, { chapter: 1, isMet: met, isRead: id => id !== own[1].id });
        await new Promise(resolve => {
          const started = performance.now();
          const poll = () => notice.querySelector('.vn-loading-comic h2') || performance.now() - started > 6000 ? resolve() : setTimeout(poll, 50);
          poll();
        });
        titles.push(notice.querySelector('.vn-loading-comic h2')?.textContent ?? null);
        hide();
      }
      return { titles, expected: own[1].title, candidates: own.length, contexts: NOTICE_COMIC_CONTEXTS.join(),
        unchanged: localStorage.getItem(LOADING_COMICS_READ_KEY) === before };
    });
    assert(registered.candidates >= 2, 'The check needs two registered comics for a fresh game');
    assert.equal(registered.contexts, 'scene,craft', 'Scene waits offer the scene comics and the bench comics');
    assert.deepEqual(registered.titles, Array(3).fill(registered.expected), 'Scene waits show a registered comic, the unread one first');
    assert.equal(registered.unchanged, true, 'A comic shown in a scene notice is not recorded as read');
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
