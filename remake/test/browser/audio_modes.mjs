// Real production VN/phone UI in isolated PC/touch contexts; fixtures stay in page memory.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const first = '今日は音を確かめます。', second = '次の言葉も続けます。';
try {
  for (const touch of [false, true]) for (const mode of ['normal', 'auto', 'skip']) {
    const context = await browser.newContext({ viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 }, hasTouch: touch, isMobile: touch });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const press = async selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-test="title-new"]').waitFor();
    await page.evaluate(async () => {
      window.A = { core: await import('./js/core/state.js'), vn: await import('./js/vn/engine.js'),
        phone: await import('./js/daily/phone.js'), audio: await import('./js/core/audio.js'), events: [] };
      const s = A.core.newGame(); s.flags._intro_sumi = true; s.met.sumi = true;
      Object.assign(A.core.config, { textSpeed: 2, voiceBlip: true, seVolume: .8, bgmVolume: 0 });
      A.audio.stopBgm(0); A.audio.applyVolumes();
      for (const id of ['click', 'blip', 'phoneReceive', 'phoneSend', 'doorbell']) {
        const native = A.audio.SE[id]; A.audio.SE[id] = (...args) => {
          A.events.push({ id, time: performance.now(), mode: document.body.className }); return native(...args);
        };
      }
      const unlock = document.createElement('button'); unlock.id = 'qa-audio-unlock'; unlock.textContent = 'Audio QA';
      Object.assign(unlock.style, { position: 'fixed', top: '0', left: '0', zIndex: 99999 });
      unlock.onclick = () => { A.audio.unlockAudio(); unlock.remove(); }; document.body.append(unlock);
    });
    await press('#qa-audio-unlock'); await page.evaluate(() => A.audio.preloadSe());
    await page.evaluate(({ first, second }) => {
      A.events.length = 0;
      A.run = A.vn.play({ dialogue_id: 'audio573_page_fixture', lines: [
        { speaker: 'sumi', portrait: false, text: first }, { speaker: 'sumi', portrait: false, text: second } ] });
    }, { first, second });
    await page.locator('.vn-box').waitFor({ state: 'visible' });
    if (mode === 'normal') {
      for (const text of [first, second]) {
        await page.waitForFunction(text => document.querySelector('.vn-text')?.textContent === text && document.querySelector('.vn-next')?.classList.contains('show'), text);
        await press('.vn-box');
      }
    } else {
      await press(`[data-test="vn-${mode}"]`);
      if (mode === 'skip') await page.evaluate(() => { A.events.length = 0; });
    }
    await page.waitForFunction(() => !A.vn.isPlaying(), null, { timeout: 15000 });
    const events = await page.evaluate(() => A.events);
    const clicks = events.filter(e => e.id === 'click').length, blips = events.filter(e => e.id === 'blip').length;
    assert.equal(clicks, mode === 'skip' ? 0 : 2, `${touch}/${mode} actual advance clicks`);
    if (mode === 'skip') assert.equal(blips, 0, 'SKIP emits no later typing blips'); else assert(blips > 0, `${mode} actual typing blips`);
    assert(!events.some(e => e.id === 'doorbell'), 'dialogue advancing is not entry');
    if (mode === 'normal') {
      await page.evaluate(() => {
        const s = A.core.newGame(); Object.assign(s, { phase: 'daily', day: 4, slot: 0 });
        Object.assign(s.flags, { _lime_opened: true, _lime_tut: 1, _intro_sumi: true }); s.met.sumi = true;
        if (!s.contacts.includes('sumi')) s.contacts.push('sumi');
        s.inbox.push({ id: 'audio573_lime_fixture', originId: 'audio573_lime_fixture', day: 4, chapter: 1,
          msg: { id: 'audio573_lime_fixture', sender: 'sumi', type: 'chat', messages: ['音を確認します。'],
            replies: [{ text: '了解です。', response: 'ありがとう。', affinity: 0 }] },
          read: false, done: false, replyState: 'waiting', log: [] });
        A.events.length = 0; A.phoneRun = A.phone.openLime({ sender: 'sumi' });
      });
      await page.locator('[data-test="reply-0"]').waitFor(); await press('[data-test="reply-0"]');
      await page.locator('[data-test="phone-next"]').waitFor();
      const count = () => page.evaluate(() => ({ receive: A.events.filter(e => e.id === 'phoneReceive').length, send: A.events.filter(e => e.id === 'phoneSend').length }));
      const spoken = await count(); assert.deepEqual(spoken, { receive: 2, send: 1 });
      await press('[data-test="phone-next"]'); await press('[data-test="lime-chat-sumi"]');
      await page.locator('[data-test="phone-next"]').waitFor(); assert.deepEqual(await count(), spoken, 'history reopen is silent');
      await press('[data-test="phone-next"]'); await press('[data-test="phone-close"]'); await page.evaluate(() => A.phoneRun);
      console.log(JSON.stringify({ touch, phone: spoken, historyReplaySounds: 0 }));
      const legacy = await page.evaluate(async () => {
        const core = A.core;
        // Existing save_load.mjs representative pre-schema-6 format; no new fields.
        const old = { schema: 5, chapter: 1, phase: 'daily', day: 15, slot: 1, money: 1000000, stamina: 60,
          seed: 1234, weatherSeed: 4,
          stats: { technique: 10, sense: 30, guts: 50, charm: 70, insight: 90 },
          statXp: { technique: .5, sense: .75, guts: 1, charm: 1.5, insight: 2 },
          flags: { _confession_due: 'mashiro', _confession_wait: 'mashiro', _qa_preserved: true },
          story: { minto: 6, adam: 5 }, flavors: ['double_apple', 'lemon'],
          lovers: ['mashiro'], lovePts: { mashiro: 4 }, loveLevel: { mashiro: 2 },
          tournament: { attempts: 2, lastRank: null },
          reel: { seed: 4321, count: 3, pending: [], introDone: true } };
        const raw = JSON.stringify(old); localStorage.setItem(core.SAVE_KEY, raw);
        A.events.length = 0; const restored = core.load();
        const ui = await import('./js/core/ui.js');
        await ui.setBg('../assets/backgrounds/bg_home.png', { instant: true });
        return { schema: restored.schema, expectedSchema: core.SCHEMA, day: restored.day, money: restored.money,
          marker: restored.flags._qa_preserved, originalPreserved: localStorage.getItem(core.SAVE_KEY) === raw,
          sounds: A.events.filter(e => ['doorbell', 'phoneReceive', 'phoneSend'].includes(e.id)).length };
      });
      assert.equal(legacy.schema, legacy.expectedSchema); assert.equal(legacy.day, 14);
      assert.equal(legacy.money, 999999); assert(legacy.marker && legacy.originalPreserved);
      assert.equal(legacy.sounds, 0, 'legacy load plus cue-free resume background is silent');
      console.log(JSON.stringify({ touch, legacySchema5Resume: 'PASS', replayedEntryOrPhoneSounds: 0 }));
      await page.evaluate(async () => {
        const s = A.core.newGame(); Object.assign(s, { phase: 'daily', day: 4, slot: 0, money: 30000, stamina: 100 });
        Object.assign(s.flags, { _morning_4: true, _lime_tut: 1, _lime_opened: true,
          _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true });
        A.map = await import('./js/daily/map.js'); A.tonari = await import('./js/daily/tonari.js');
        A.events.length = 0;
        A.mapRun = A.map.chooseSpot({}).then(id => { A.chosenSpot = id; if (id === 'tonari') A.tonariRun = A.tonari.tonariMenu(); });
      });
      await page.locator('[data-test="pin-tonari"]').waitFor(); await press('[data-test="pin-tonari"]');
      await press('[data-test="map-go"]'); await page.locator('[data-test="tonari-customer"]').waitFor();
      await page.waitForFunction(() => A.events.filter(e => e.id === 'doorbell').length === 1);
      assert.equal(await page.evaluate(() => A.chosenSpot), 'tonari');
      await press('[data-test="sub-back"]'); await page.evaluate(() => A.tonariRun);
      assert.equal(await page.evaluate(() => A.events.filter(e => e.id === 'doorbell').length), 1);
      console.log(JSON.stringify({ touch, actualMapToTonariMenu: 'PASS', entryBells: 1 }));
    }
    assert.deepEqual(errors, [], 'no production page errors');
    console.log(JSON.stringify({ touch, mode, clicks, blips, status: 'PASS', fixture: 'page-memory production VN/phone; not a full chapter run' }));
    await context.close();
  }
} finally { await browser.close(); }
