// 本編用の遠近通りのPC/タッチ、共通制限、ゼロ消費、HUDと旧セーブの境界。
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
        s.flags._spot_guide_naru = s.flags._spot_guide_minto = true;
        if (kind === 'locked') { delete s.met.naru; delete s.flags._spot_guide_naru; }
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
      const { w, h } = await frame.evaluate(() => __street.layout().view);
      const sx = box.x + x / w * box.width, sy = box.y + y / h * box.height;
      if (touch) await page.touchscreen.tap(sx, sy); else await page.mouse.click(sx, sy);
    };
    await reset(); let frame = await walk();
    assert.equal((await frame.evaluate(() => __street.layout())).kind, 'arcade');
    assert.equal((await frame.evaluate(() => __street.state())).character, 'hajime');
    assert.equal((await frame.evaluate(() => __street.state())).frames, 4);
    assert.equal((await frame.evaluate(() => __street.state())).alwaysRun, false);
    // 入口ボタンのクリックだけでキーが届く。テスト側からframeをfocusしない。
    const initial = await frame.evaluate(() => __street.state());
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(800); await page.keyboard.up('ArrowRight');
    assert((await frame.evaluate(() => __street.state())).worldX > initial.worldX + 20);
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(800); await page.keyboard.up('ArrowUp');
    const deeper = await frame.evaluate(() => __street.state());
    assert(deeper.z > initial.z && deeper.cameraZoom > initial.cameraZoom && deeper.renderHeight >= 90,
      'camera must follow depth while character stays readable');
    assert(Math.hypot(deeper.vanishing.x-initial.vanishing.x,deeper.vanishing.y-initial.vanishing.y)<1e-9,
      'following camera must keep the arcade horizon fixed');
    assert(deeper.walked>initial.walked,'gait must advance with ground travel');
    await page.waitForTimeout(350);
    assert.equal((await frame.evaluate(()=>__street.state())).walked,deeper.walked,'idle character must not keep stepping');
    await tap(frame, 800, 615); await page.waitForTimeout(600);
    const tapped = await frame.evaluate(() => __street.state());
    assert(Math.hypot(tapped.worldX-deeper.worldX,tapped.worldY-deeper.worldY)>15);
    // 全8方向を実キーで歩く。停止/4姿勢/斜めの速度も毎回確認する。
    const distances=[];
    for(const [dir,keys] of [['down',['ArrowDown']],['down_right',['ArrowDown','ArrowRight']],
      ['right',['ArrowRight']],['up_right',['ArrowUp','ArrowRight']],['up',['ArrowUp']],
      ['up_left',['ArrowUp','ArrowLeft']],['left',['ArrowLeft']],['down_left',['ArrowDown','ArrowLeft']]]) {
      const startY=dir.startsWith('down')?419.47:515;
      await frame.evaluate(y=>__street.place(640,y,'up'),startY);await frame.locator('#view').focus();
      for(const key of keys)await page.keyboard.down(key);
      const seen=new Set(),began=Date.now();
      while(Date.now()-began<850){const s=await frame.evaluate(()=>__street.state());if(s.moving&&s.dir===dir)seen.add(s.gaitFrame);await page.waitForTimeout(20);}
      assert.equal((await frame.evaluate(()=>__street.state())).dir,dir);
      for(const key of keys)await page.keyboard.up(key);
      await page.waitForTimeout(100);
      const s=await frame.evaluate(()=>__street.state());
      assert.equal(seen.size,4,`${dir}: all gait poses must appear`);
      assert.equal(s.moving,false,`${dir}: key release must stop`);
      assert(s.strideDistance>320&&s.strideDistance<460,`${dir}: speed relative to actor outside expected range: ${s.strideDistance}`);
      distances.push(s.strideDistance);
    }
    assert(Math.max(...distances)/Math.min(...distances)<1.12,`8-direction apparent-speed spread: ${JSON.stringify(distances)}`);
    await frame.evaluate(() => __street.place(640, 620, 'up'));
    await frame.locator('#view').focus(); await page.keyboard.press('KeyZ');
    await frame.waitForFunction(() => !!__street.state().msg);
    const talkingX = (await frame.evaluate(() => __street.state())).worldX;
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(200);
    await page.keyboard.press('KeyZ');
    await frame.waitForFunction(() => !__street.state().msg); await page.waitForTimeout(100);
    assert.equal((await frame.evaluate(() => __street.state())).worldX, talkingX, 'inspect dialogue left a held movement key');
    await page.keyboard.up('ArrowRight');
    await unchanged();
    await page.locator('[data-test="street-back"]').click(); await page.waitForSelector('.map:not(.done)');
    assert.equal(await page.evaluate(() => T.result), 'pending'); await unchanged();
    pass(`${label}: arcade/Hajime, fixed horizon/readable size, all 8 actual key directions/4 poses/equal speed/stop, ${touch ? 'touch' : 'pointer'}, cost zero`);

    for (const [kind, id, door, why] of [
      ['locked', 'cafe', 'cafe', 'まだ知らない場所'], ['closed', 'naru', 'kemurikusa', '本日定休日'],
      ['temporary', 'naru', 'kemurikusa', '本日臨時休業'], ['visited', 'naru', 'kemurikusa', '今日はもう行った'],
      ['poor', 'naru', 'kemurikusa', 'お金が足りない（3,000円）'],
      ['', 'cafe', 'cafe', '今はスミさんの頼みが先'],
    ]) {
      const opts = why.includes('頼み') ? { guide: { pin: 'naru', text: '偵察' } } : {};
      await reset(kind, opts);
      if (kind === 'locked') {
        assert.equal(await page.locator(`[data-test="pin-${id}"]`).count(), 0);
      } else {
        await page.locator(`[data-test="pin-${id}"]`).click();
        assert.equal(await page.locator('[data-test="map-go"]').count(), 0);
      }
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
    for (const [door,id,x,y] of [['cafe','cafe',300,600],['peppermint','minto',1000,600],['kemurikusa','naru',640,450]]) {
      await reset(); frame = await walk();
      await frame.evaluate(([x,y]) => __street.place(x,y,'up'),[x,y]);
      const doorRect = await frame.evaluate(id => __street.layout().doors.find(d => d.id === id).rect,door);
      await tap(frame, doorRect[0] + doorRect[2]/2, doorRect[1] + doorRect[3]/2);
      await page.waitForFunction(id => T.result === id,id); await unchanged();
    }
    pass(`${label}: ${touch ? 'real touch' : 'pointer'} hits all 3 doors through camera, walks there and resolves main IDs`);

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
    const expectedX = await frame.evaluate(() => __street.layout().doors.find(d=>d.id==='kemurikusa').foot[0]);
    assert(Math.abs((await frame.evaluate(() => __street.state())).x-expectedX)<.01);
    assert.equal(await page.evaluate(() => T.result), 'pending');
    await frame.evaluate(() => __street.place(640, 679, 'down'));
    if(touch) await tap(frame,640,705);
    else { await frame.locator('#view').focus(); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(300); await page.keyboard.up('ArrowDown'); }
    await page.waitForSelector('.map:not(.done)'); assert.equal(await page.evaluate(() => T.result), 'pending');
    assert.equal(await page.evaluate(() => localStorage.getItem('shisha_proto_street_v1')), await page.evaluate(() => T.protoBefore));
    pass(`${label}: old prototype visit/dash storage ignored; near exit keeps chooseSpot pending`);

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
    const x = (await frame.evaluate(() => __street.state())).worldX; await page.waitForTimeout(350);
    assert.equal((await frame.evaluate(() => __street.state())).worldX, x);
    await page.keyboard.up('ArrowRight'); await page.locator('[data-test="phone-close"]').click();
    await frame.waitForFunction(() => !__street.state().paused); await page.waitForTimeout(250);
    assert.equal((await frame.evaluate(() => __street.state())).worldX, x);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150); await page.keyboard.up('ArrowLeft');
    assert((await frame.evaluate(() => __street.state())).worldX < x, 'keyboard focus was not restored after LIME');
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
    await frame.evaluate(() => __street.place(720, 570, 'up'));
    await page.waitForTimeout(100);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-day.png` });
    pass(`${label}: actual HUD LIME/menu/save pause held input and resume without movement`);

    await page.locator('[data-test="hud-menu"]').click(); await page.locator('[data-test="menu-load"]').click();
    await page.locator('[data-test="slot-1"]').click(); await page.locator('[data-test="confirm-load"]').click();
    await page.waitForSelector('.map:not(.done)', { timeout: 30000 });
    assert.deepEqual(await page.evaluate(() => ({ day: __remake.state.day, slot: __remake.state.slot, money: __remake.state.money })), { day: 4, slot: 0, money: saved.money });
    frame = await walk(); assert.equal((await frame.evaluate(() => __street.state())).x, 640);
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
    assert((await frame.evaluate(() => __street.state())).night); assert.equal((await frame.evaluate(() => __street.state())).x, 640);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-night.png` });
    pass(`${label}: schema11 old save, night sample, safe spawn, no new schema required`);

    await page.locator('[data-test="street-back"]').click();
    // 行動で確定した結果を歩行画面へ移す。演出による報酬の二重適用をしない。
    await page.evaluate(() => {
      const s = T.core.state; s.reel.installed = s.reel.introDone = true;
      T.reel.onAction({ spent: 10 }); T.rewardBefore = { stats: { ...s.stats }, count: s.reel.count };
    });
    const pending=await page.evaluate(()=>JSON.parse(JSON.stringify(T.core.state.reel.pending)));
    assert(pending.length>0);
    frame = await walk(); await page.waitForTimeout(700);
    assert.equal(await page.locator('.street-selection .reel-widget').count(),0);
    assert.deepEqual(await page.evaluate(()=>T.core.state.reel.pending),pending,'street must not start pending slot presentation');
    assert.deepEqual(await page.evaluate(() => ({ stats: __remake.state.stats, count: __remake.state.reel.count })), await page.evaluate(() => T.rewardBefore));
    const safeUi = await frame.evaluate(() => {
      const pad = document.querySelector('#pad').getBoundingClientRect(); const stage = document.querySelector('#stage').getBoundingClientRect();
      return (pad.bottom - stage.top) / stage.height * 720 < 260;
    });
    assert(safeUi, 'controls cover entry labels or sidewalk');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-slot-sealed.png` });
    await page.locator('[data-test="street-back"]').click();
    await page.waitForFunction(()=>T.core.state.reel.pending.length===0);
    assert(await page.locator('.map:not(.done) .reel-widget').count());
    assert.deepEqual(await page.evaluate(() => ({ stats: T.core.state.stats, count: T.core.state.reel.count })), await page.evaluate(() => T.rewardBefore));
    pass(`${label}: slot sealed on street, pending results preserved and presented on pin map without duplicate rewards`);
    assert.deepEqual(errors, []); await context.close();
  }
  // 画像欠落時も本編IDを返せる。入口選択は生成画像の完成に依存しない。
  const page = await browser.newPage(); await page.route(/(assets\/street_walk|remake\/img\/street)\//, r => r.fulfill({ status: 404, body: '' }));
  await page.goto(BASE); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => { const c = await import('./js/core/state.js'); const m = await import('./js/daily/map.js'); c.newGame(); c.state.phase='daily'; c.state.met.naru=true; c.state.flags._spot_guide_naru=true; window.selected='pending'; m.chooseSpot().then(v=>selected=v); });
  const navigating = page.waitForEvent('framenavigated', f => f.url().includes('embed=1'));
  await page.locator('[data-test="map-walk"]').click();
  const frame = await navigating; await frame.waitForFunction(()=>window.__street?.state().ready&&!window.__street.state().paused);
  assert.equal((await frame.evaluate(()=>__street.layout())).setSource,'placeholder');
  await frame.evaluate(()=>__street.warp('cafe')); await frame.locator('#view').focus(); await page.keyboard.press('KeyZ');
  await page.waitForFunction(()=>selected==='cafe'); pass('missing images: placeholder still selects main cafe');
  console.log(`[street] ${checks} checks PASS`);
} finally { await browser.close(); }
