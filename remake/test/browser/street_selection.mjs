// 実ハリボテ画面のPC/タッチ、共通制限、ゼロ消費、HUDと旧セーブの境界。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const SHOTS = process.env.SHOTS;
if (SHOTS) await fs.mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
let checks = 0;
const pass = (name) => { checks++; console.log(`[street] PASS ${name}`); };
try {
  for (const touch of [false, true]) {
    const label = touch ? 'touch' : 'pc';
    const context = await browser.newContext({ viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 }, hasTouch: touch });
    let page = await context.newPage(); const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE); await page.waitForSelector('[data-test="title-new"]');
    await page.evaluate(async () => {
      window.T = { core: await import('./js/core/state.js'), map: await import('./js/daily/map.js'),
        calendar: await import('./js/daily/calendar.js'), ui: await import('./js/core/ui.js'),
        spots: await import('./js/daily/spots.js'), reel: await import('./js/daily/reel.js'), access: await import('./js/daily/spot-access.js') };
      localStorage.setItem('shisha_proto_street_v1', JSON.stringify({ visited: { cafe: true, peppermint: true, kemurikusa: true }, alwaysRun: true }));
      T.protoBefore = localStorage.getItem('shisha_proto_street_v1');
    });
    const reset = async (kind = '', opts = {}) => {
      await page.evaluate(({ kind, opts }) => {
        const generation = T.generation = (T.generation || 0) + 1;
        T.map.interruptMap('__fixture__'); T.core.newGame(); const s = T.core.state;
        Object.assign(s, { phase: 'daily', day: 4 }); s.met.naru = s.met.minto = true;
        if (kind === 'locked') delete s.met.naru;
        if (kind === 'closed') s.day = 3;
        if (kind === 'temporary') s.flags._temporary_closed_naru = '1:4';
        if (kind === 'visited') s.visitedDay.naru = 4;
        if (kind === 'poor' || kind === 'delivery') s.money = 0;
        T.result = 'pending'; T.before = JSON.parse(JSON.stringify(s));
        T.map.chooseSpot(opts).then((v) => { if (T.generation === generation) T.result = v; });
      }, { kind, opts });
      await page.waitForSelector('.map:not(.done)');
      const overlaps = await page.evaluate(() => {
        const button = document.querySelector('[data-test="map-walk"]').getBoundingClientRect();
        return [...document.querySelectorAll('.spot-pin')].filter(pin => {
          const r = pin.getBoundingClientRect();
          return r.left < button.right && r.right > button.left && r.top < button.bottom && r.bottom > button.top;
        }).map(pin => pin.dataset.spot);
      });
      assert.deepEqual(overlaps, [], 'walk button covers an existing direct pin');
    };
    const walk = async () => {
      const navigating = page.waitForEvent('framenavigated', f => f.url().includes('embed=1'));
      await page.locator('[data-test="map-walk"]').click();
      const frame = await navigating;
      await frame.waitForFunction(() => window.__street?.state().ready && !window.__street.state().paused);
      return frame;
    };
    const unchanged = async () => assert.deepEqual(await page.evaluate(() => T.core.state), await page.evaluate(() => T.before));
    const pressDoor = async (frame, door) => {
      await frame.evaluate((id) => __street.warp(id), door); await frame.locator('#view').focus();
      await page.keyboard.press('KeyZ');
    };
    const tap = async (frame, x, y) => {
      const box = await frame.locator('#view').boundingBox();
      const sx = box.x + x / 640 * box.width, sy = box.y + y / 360 * box.height;
      if (touch) await page.touchscreen.tap(sx, sy); else await page.mouse.click(sx, sy);
    };
    await reset(); let frame = await walk();
    assert.equal((await frame.evaluate(() => __street.layout())).kind, 'set');
    assert.equal((await frame.evaluate(() => __street.state())).alwaysRun, false);
    await frame.locator('#view').focus(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(800); await page.keyboard.up('ArrowRight');
    assert((await frame.evaluate(() => __street.state())).x > 150);
    await tap(frame, 300, 310); await page.waitForTimeout(600);
    assert((await frame.evaluate(() => __street.state())).x > 200);
    await frame.evaluate(() => __street.place(716, 300, 'up'));
    await frame.locator('#view').focus(); await page.keyboard.press('KeyZ');
    await frame.waitForFunction(() => !!__street.state().msg);
    await unchanged();
    await page.locator('[data-test="street-back"]').click(); await page.waitForSelector('.map:not(.done)');
    assert.equal(await page.evaluate(() => T.result), 'pending'); await unchanged();
    pass(`${label}: existing set sample, keyboard, ${touch ? 'real touch' : 'pointer'} movement, inspect/back cost zero`);

    for (const [kind, id, door, why] of [
      ['locked', 'cafe', 'cafe', 'まだ知らない場所'], ['closed', 'naru', 'kemurikusa', '本日定休日'],
      ['temporary', 'naru', 'kemurikusa', '本日臨時休業'], ['visited', 'naru', 'kemurikusa', '今日はもう行った'],
      ['poor', 'naru', 'kemurikusa', 'お金が足りない（3,000円）'],
      ['', 'cafe', 'cafe', '今はスミさんの頼みが先'],
    ]) {
      const opts = why.includes('頼み') ? { guide: { pin: 'naru', text: '偵察' } } : {};
      await reset(kind, opts); await page.locator(`[data-test="pin-${id}"]`).click();
      assert.equal(await page.locator('[data-test="map-go"]').count(), 0);
      frame = await walk(); await pressDoor(frame, door);
      await frame.waitForFunction(() => !!__street.state().msg);
      assert.equal(await frame.evaluate(() => __street.state().msg), why);
      assert.equal(await page.evaluate(() => T.result), 'pending'); await unchanged();
      pass(`${label}: ${kind || 'guided'} uses pin restriction`);
    }
    for (const [id, door] of [['cafe','cafe'], ['minto','peppermint'], ['naru','kemurikusa']]) {
      await reset(); frame = await walk(); await pressDoor(frame, door);
      await page.waitForFunction(() => T.result !== 'pending');
      assert.equal(await page.evaluate(() => T.result), id); await unchanged();
      assert.equal(await page.locator('[data-test="street-frame"]').count(), 0);
    }
    pass(`${label}: 3 doors return only correct main IDs, no prototype interior or rewards`);
    await reset(); frame = await walk();
    await frame.evaluate(() => __street.place(460, 310, 'up'));
    const cam = (await frame.evaluate(() => __street.state())).camX;
    await tap(frame, 534 - cam, 200);
    await page.waitForFunction(() => T.result === 'cafe'); await unchanged();
    pass(`${label}: ${touch ? 'real touch' : 'pointer'} door hit walks to cafe and resolves main ID`);

    await reset('delivery', { guide: { pin: 'minto', free: '配達（代金なし）', text: '店先へ配達' } });
    frame = await walk(); await pressDoor(frame, 'peppermint');
    await page.waitForFunction(() => T.result === 'minto'); await unchanged();
    pass(`${label}: zero-money guided delivery selects minto without consuming first visit`);

    await reset(); frame = await walk(); await frame.locator('#btn-map').click();
    assert.equal((await frame.evaluate(() => __street.state())).travel.filter((t) => t.off).length, 3);
    await frame.locator('#btn-map').click();
    await page.evaluate(() => T.core.state.visits.naru = 1);
    await frame.locator('#btn-map').click();
    await frame.locator('#travel-list [data-door="kemurikusa"]').click();
    await frame.waitForFunction(() => !__street.state().busy);
    assert.equal((await frame.evaluate(() => __street.state())).x, 1778);
    assert.equal(await page.evaluate(() => T.result), 'pending');
    await frame.evaluate(() => __street.place(8, 292, 'left'));
    await frame.locator('#view').focus(); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');
    await page.waitForSelector('.map:not(.done)'); assert.equal(await page.evaluate(() => T.result), 'pending');
    assert.equal(await page.evaluate(() => localStorage.getItem('shisha_proto_street_v1')), await page.evaluate(() => T.protoBefore));
    pass(`${label}: old prototype visit/dash storage ignored; left exit keeps chooseSpot pending`);

    // 本物のrunDaily/HUDからLIMEとMENUを開く（fixtureの擬似HUDではない）。
    await page.evaluate(() => {
      T.map.interruptMap('__fixture__'); T.core.newGame(); const s = T.core.state;
      Object.assign(s, { phase: 'daily', day: 4 }); Object.assign(s.flags, { _morning_4: true, _tsumugi_contest_research: true, _tsumugi_contest_progress: true, _lime_tut: 1 }); s.met.naru = true;
      T.calendar.runDaily({ nightEvents: {} });
    });
    await page.waitForSelector('.map:not(.done)'); frame = await walk();
    await frame.locator('#view').focus(); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(200);
    await page.locator('[data-test="hud-phone"]').click(); await page.waitForSelector('.phone-overlay');
    await frame.waitForFunction(() => __street.state().paused);
    const x = (await frame.evaluate(() => __street.state())).x; await page.waitForTimeout(350);
    assert.equal((await frame.evaluate(() => __street.state())).x, x);
    await page.keyboard.up('ArrowRight'); await page.locator('[data-test="phone-close"]').click();
    await frame.waitForFunction(() => !__street.state().paused); await page.waitForTimeout(250);
    assert.equal((await frame.evaluate(() => __street.state())).x, x);
    await page.evaluate(() => {
      const s = T.core.state;
      const msg = { id: 'qa_street_invite', sender: 'sumi', type: 'invitation', time_slot: 'night',
        accept_event: '__sumi_baito__', messages: ['今夜のシフト、入れるか？'] };
      s.inbox.push({ id: msg.id, originId: msg.id, day: s.day, msg, read: false, done: false, replyState: 'waiting', log: [] });
      T.inviteBefore = { day: s.day, slot: s.slot, money: s.money, stamina: s.stamina };
    });
    await page.locator('[data-test="hud-phone"]').click();
    await page.locator('[data-test="lime-chat-sumi"]').click();
    await page.locator('[data-test="reply-0"]').click();
    await page.locator('[data-test="phone-next"]').click();
    await page.locator('[data-test="phone-close"]').click();
    await page.waitForSelector('[data-test="street-frame"]', { state: 'detached' });
    await page.waitForSelector('.map:not(.done)');
    assert.deepEqual(await page.evaluate(() => { const s = T.core.state; return { day: s.day, slot: s.slot, money: s.money, stamina: s.stamina }; }), await page.evaluate(() => T.inviteBefore));
    assert.equal(await page.evaluate(() => T.core.state.pendingInvite.slot), 1);
    frame = await walk();
    pass(`${label}: accepting real LIME invitation interrupts street and preserves existing future-slot contract`);
    await page.locator('[data-test="hud-menu"]').click(); await page.waitForSelector('.menu-modal');
    await frame.waitForFunction(() => __street.state().paused);
    await page.locator('[data-test="menu-save"]').click(); await page.locator('[data-test="slot-1"]').click();
    await page.waitForFunction(() => !document.querySelector('#modal.show'));
    const saved = await page.evaluate(() => T.core.readSlot('suien_remake_slot1'));
    assert.equal(saved.day, 4); assert.equal(saved.slot, 0); assert.equal(saved.visits.naru || 0, 0);
    await frame.waitForFunction(() => !__street.state().paused);
    await frame.evaluate(() => __street.place(880, 292, 'right'));
    await page.waitForTimeout(100);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-day.png` });
    pass(`${label}: actual HUD LIME/menu/save pause held input and resume without movement`);

    await page.locator('[data-test="hud-menu"]').click(); await page.locator('[data-test="menu-load"]').click();
    await page.locator('[data-test="slot-1"]').click(); await page.locator('[data-test="confirm-load"]').click();
    await page.waitForSelector('.map:not(.done)', { timeout: 30000 });
    assert.deepEqual(await page.evaluate(() => ({ day: __remake.state.day, slot: __remake.state.slot, money: __remake.state.money })), { day: 4, slot: 0, money: saved.money });
    frame = await walk(); assert.equal((await frame.evaluate(() => __street.state())).x, 60);
    pass(`${label}: real saved-slot boot/load resumes pin map and safe street spawn`);
    await page.locator('[data-test="street-back"]').click();
    await page.close(); page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE); await page.waitForSelector('[data-test="title-new"]');
    // 旧保存に歩行用の独自項目は不要。旧schemaを実loadで移行し、新規セーブとの訪問記録を分離。
    await page.evaluate(async () => {
      window.T = { core: await import('./js/core/state.js'), map: await import('./js/daily/map.js'), reel: await import('./js/daily/reel.js') };
      T.map.interruptMap('__fixture__'); const old = JSON.parse(localStorage.getItem('suien_remake_slot1'));
      old.schema = 11; old.visits = {}; old.spotVisits = {}; old.day = 4; old.slot = 1;
      localStorage.setItem('suien_remake_save', JSON.stringify(old)); T.core.newGame(); T.core.load();
      T.result = 'pending'; T.map.chooseSpot().then(v => T.result = v);
    });
    await page.waitForSelector('.map:not(.done)'); frame = await walk();
    assert((await frame.evaluate(() => __street.state())).night); assert.equal((await frame.evaluate(() => __street.state())).x, 60);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-night.png` });
    pass(`${label}: schema11 old save, night sample, safe spawn, no new schema required`);

    await page.locator('[data-test="street-back"]').click();
    // 行動で確定した結果を歩行画面へ移す。演出による報酬の二重適用をしない。
    await page.evaluate(() => {
      const s = T.core.state; s.reel.installed = s.reel.introDone = true;
      T.reel.onAction({ spent: 10 }); T.rewardBefore = { stats: { ...s.stats }, count: s.reel.count };
    });
    frame = await walk(); await page.waitForFunction(() => __remake.state.reel.pending.length === 0);
    assert(await page.locator('.street-selection .reel-widget').count());
    assert.deepEqual(await page.evaluate(() => ({ stats: __remake.state.stats, count: __remake.state.reel.count })), await page.evaluate(() => T.rewardBefore));
    const safeUi = await frame.evaluate(() => {
      const pad = document.querySelector('#pad').getBoundingClientRect(); const stage = document.querySelector('#stage').getBoundingClientRect();
      return (pad.bottom - stage.top) / stage.height * 720 < 260;
    });
    assert(safeUi, 'controls cover entry labels or sidewalk');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-slot.png` });
    pass(`${label}: pending slot shown once on street, reward/count unchanged, buttons above doors`);
    assert.deepEqual(errors, []); await context.close();
  }
  // 画像欠落時も本編IDを返せる。入口選択は生成画像の完成に依存しない。
  const page = await browser.newPage(); await page.route(/assets\/proto_(street_set|walk)\//, r => r.fulfill({ status: 404, body: '' }));
  await page.goto(BASE); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => { const c = await import('./js/core/state.js'); const m = await import('./js/daily/map.js'); c.newGame(); c.state.phase='daily'; c.state.met.naru=true; window.selected='pending'; m.chooseSpot().then(v=>selected=v); });
  const navigating = page.waitForEvent('framenavigated', f => f.url().includes('embed=1'));
  await page.locator('[data-test="map-walk"]').click();
  const frame = await navigating; await frame.waitForFunction(()=>__street.state().ready&&!__street.state().paused);
  assert.equal((await frame.evaluate(()=>__street.layout())).setSource,'placeholder');
  await frame.evaluate(()=>__street.warp('cafe')); await frame.locator('#view').focus(); await page.keyboard.press('KeyZ');
  await page.waitForFunction(()=>selected==='cafe'); pass('missing images: placeholder still selects main cafe');
  console.log(`[street] ${checks} checks PASS`);
} finally { await browser.close(); }
