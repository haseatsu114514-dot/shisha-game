import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function prepareCityGuest(page, id) {
  return page.evaluate(async id => {
    const core = await import("./js/core/state.js"), data = await import("./js/core/data.js");
    const guests = await import("./js/daily/city-guests.js"), spots = await import("./js/daily/spots.js");
    const people = await import("./js/daily/spot-people.js"), engine = await import("./js/vn/engine.js");
    const map = await import("./js/daily/map.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, phase: "daily", day: 17, slot: 0, money: 15000, stamina: 90 });
    value.met = Object.fromEntries(["ageha", "kumicho", "rei", "sumi", "adam", "minto"].map(id => [id, true]));
    for (const id of ["ageha", "kumicho", "rei"]) value.flags[`_intro_${id}`] = true;
    for (let seed = 0; seed < 10000; seed++) {
      value.weatherSeed = seed;
      if (guests.cityGuestVisit()?.id === id) break;
    }
    const visit = guests.cityGuestVisit(), spot = spots.spotById(visit.spotId);
    window.C = { core, data, guests, spots, people, engine, map, visit, spot, trace: [] };
    engine.vnTest.turbo = true;
    engine.hooks.onLine = (scene,line) => C.trace.push({ scene, speaker: line.speaker });
    core.save();
    return { id: visit.id, spot: spot.id };
  }, id);
}

await suite("map-guests", async check => {
  for (const id of ["ageha", "kumicho", "rei"]) {
    await check(`city-${id}-schedule-first-repeat`, async page => {
      const chosen = await prepareCityGuest(page, id);
      assert.equal(chosen.id, id);
      const result = await page.evaluate(async () => {
        const resources = () => JSON.stringify([C.core.state.money, C.core.state.stamina, C.core.state.slot, C.core.state.affinity]);
        const before = resources(), snapshot = JSON.stringify(C.core.state);
        const people = C.people.spotPeople(C.spot);
        const readOnly = snapshot === JSON.stringify(C.core.state);
        const first = await C.guests.visitCityGuestAtShop(C.spot, { scheduledVisit: C.visit });
        const firstTrace = C.trace.map(x => x.scene);
        const saved = C.core.peekSave();
        const sameDay = await C.guests.visitCityGuestAtShop(C.spot, { scheduledVisit: C.visit });
        const unchangedResources = before === resources();
        C.core.state.day = 18;
        for (let seed = 0; seed < 10000; seed++) {
          C.core.state.weatherSeed = seed;
          if (C.guests.cityGuestVisit()?.id === C.visit.id) break;
        }
        C.trace = [];
        const repeat = await C.guests.visitCityGuestAtShop(C.spot);
        return { people: people.map(p=>({id:p.id,role:p.role,known:p.known})), readOnly, first, sameDay, unchangedResources,
          firstTrace, repeat, repeatTrace:C.trace.map(x=>x.scene), savedDay:saved.flags._city_guest_day, savedSeen:saved.flags[`_city_guest_seen_${C.visit.id}`] };
      });
      assert(result.people.some(p=>p.id===id&&p.role==='guest'&&p.known));
      assert(result.readOnly&&result.first&&result.repeat&&result.unchangedResources);
      assert.equal(result.sameDay,false); assert.equal(result.savedDay,'2:17'); assert.equal(result.savedSeen,true);
      assert(result.firstTrace.includes(`ch2_city_guest_${id}_first`));
      assert(result.repeatTrace.includes(`ch2_city_guest_${id}_repeat`));
    });
  }
  await check('city-invalid-dialogue-retry',async page=>{
    await prepareCityGuest(page,'ageha');
    await page.route('**/data/dialogue/ch2_city_guests.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{}'}));
    assert.equal(await page.evaluate(()=>C.guests.visitCityGuestAtShop(C.spot)),false);
    assert.equal(await page.evaluate(()=>C.core.state.flags._city_guest_day),undefined);
    await page.unroute('**/data/dialogue/ch2_city_guests.json');
    assert.equal(await page.evaluate(()=>C.guests.visitCityGuestAtShop(C.spot)),true);
  });
  await check('city-load-cancels-unread',async page=>{
    await prepareCityGuest(page,'rei');
    await page.evaluate(()=>{
      C.engine.vnTest.turbo=false; C.result=null;
      C.pending=C.guests.visitCityGuestAtShop(C.spot).then(value=>C.result=value);
    });
    await page.waitForFunction(()=>C.engine.isPlaying());
    await page.evaluate(()=>C.core.setState(C.core.newState()));
    await page.waitForFunction(()=>C.result===false);
    assert.deepEqual(await page.evaluate(()=>({old:C.visit.owner.flags._city_guest_day,new:C.core.state.flags._city_guest_day,
      playing:C.engine.isPlaying()})),{old:undefined,new:undefined,playing:false});
  });
  for (const [device, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["narrow", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    await check(`${device}-silhouette-schedule-save`, async page => {
      if (device === "narrow") await page.evaluate(() => { localStorage.setItem("suien_title_layout", "ds"); window.dispatchEvent(new Event("display-layout-change")); });
      await page.evaluate(async () => {
        window.G = { core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
          map: await import("./js/daily/map.js"), people: await import("./js/daily/spot-people.js"),
          spots: await import("./js/daily/spots.js"), hiyori: await import("./js/daily/hiyori.js") };
        const s = G.core.newGame(); Object.assign(s, { phase: "daily", day: 4, slot: 0, seed: 131, money: 90000 });
        s.flags._axe_bar_legacy_access = true; // #577: 旧未対面保存の表示・予定一致を保つ
        // #782: つむぎは序盤の固定回を既読にした日だけ在店する（DAY4は昼）。
        Object.assign(s.flags, { _tsumugi_contest_research: true, _tsumugi_contest_progress: true });
        s.met.naru = s.met.adam = s.met.minto = true;
        window.flow = G.map.chooseSpot();
      });
      await page.locator('[data-test="pin-tonari"] .pin-people').waitFor();
      assert.equal(await page.locator('[data-test="pin-tonari"] .pin-person').count(), 2);
      assert.equal(await page.locator('[data-test="pin-tonari"] .pin-unknown').count(), 1);
      const location = await page.evaluate(() => G.hiyori.hiyoriShopLocation());
      assert(location);
      assert.equal(await page.locator(`[data-spot="${location}"] .pin-person`).count(), 2);
      assert.equal(await page.locator(`[data-spot="${location}"] .pin-unknown`).count(), 1);
      assert.equal(await page.locator('.map img[src*="hiyori"], .map img[src*="tsumugi"]').count(), 0);
      assert(!await page.locator('.map').evaluate(n => /ひより|つむぎ/.test(n.outerHTML)), "Unknown identities must not leak through labels or attributes");
      const snapshot = await page.evaluate(() => {
        const before = JSON.stringify(G.core.state);
        const one = G.spots.allSpots().filter(s => G.people.spotPeople(s).some(p => p.id === "hiyori")).map(s => s.id);
        const unchanged = before === JSON.stringify(G.core.state);
        G.core.save(); G.core.newGame(); G.core.load();
        return { one, unchanged, after: G.hiyori.hiyoriShopLocation() };
      });
      assert.deepEqual(snapshot.one, [location]); assert(snapshot.unchanged); assert.equal(snapshot.after, location);
      await page.locator(`[data-spot="${location}"]`).click();
      await page.locator('[data-test="map-go"]').waitFor();
      const anchored = await page.locator('.pin-people').evaluateAll(rows => document.body.classList.contains('game-ds') || rows.every(row => {
        const face = row.firstElementChild.getBoundingClientRect(), shield = row.parentElement.querySelector('.shield').getBoundingClientRect();
        return Math.abs(face.left - shield.left) <= 10 && Math.abs(face.bottom - shield.top) <= 14;
      }));
      assert(anchored, 'Faces must stay at the shield left edge regardless of caption width');
      await assertFits(page, '.pin-people');
      await page.locator('[data-test="map-go"]').scrollIntoViewIfNeeded();
      await assertFits(page, '[data-test="map-go"]');
      await page.locator('[data-test="map-go"]').click();
      assert.equal(await page.evaluate(() => window.flow), location);
    }, options);
    await check(`${device}-multiple-guests-closure`, async page => {
      if (device === "narrow") await page.evaluate(() => { localStorage.setItem("suien_title_layout", "ds"); window.dispatchEvent(new Event("display-layout-change")); });
      const result = await page.evaluate(async () => {
        const core = await import("./js/core/state.js"), map = await import("./js/daily/map.js"),
          people = await import("./js/daily/spot-people.js"), spots = await import("./js/daily/spots.js");
        // #782: DAY8はつむぎの在店が昼（slot0）。固定回の既読も立てる。
        const s = core.newGame(); Object.assign(s, { phase: "daily", day: 8, slot: 0, money: 90000 });
        s.met.tsumugi = s.met.hiyori = true;
        Object.assign(s.flags, { _tsumugi_contest_research: true, _tsumugi_contest_progress: true });
        Object.assign(s.flags, { _hiyori_meeting_done: true, _hiyori_sumi_message_done: true,
          _hiyori_message_delivered: true, _hiyori_cracks_done: true, _hiyori_tonari_return_done: true });
        const tonari = spots.spotById("tonari");
        const ids = people.spotPeople(tonari).map(p => p.id);
        const closed = people.spotPeople({ ...tonari, closedOn: s.day % 7 });
        const unavailable = people.spotPeople({ ...tonari, unavailable: "準備中" });
        const dedup = people.spotPeople({ ...tonari, face: "tsumugi" }).map(p => p.id);
        window.flow = map.chooseSpot();
        return { ids, closed, unavailable, dedup };
      });
      assert.deepEqual(result.ids, ["sumi", "tsumugi", "hiyori"]);
      assert.deepEqual(result.closed, []); assert.deepEqual(result.unavailable, []);
      assert.deepEqual(result.dedup, ["tsumugi", "hiyori"]);
      await page.locator('[data-test="pin-tonari"] .pin-person').first().waitFor();
      assert.equal(await page.locator('[data-test="pin-tonari"] .pin-person').count(), 3);
      assert.equal(await page.locator('img[alt="ひより"]').count(), 1);
      assert.deepEqual(await page.locator('[data-test="pin-tonari"] .pin-person').evaluateAll(ns=>ns.map(n=>n.dataset.personRole)), ["owner","guest","guest"]);
      const clear = await page.locator('[data-test="pin-tonari"]').evaluate(pin=>{
        const boxes=[...pin.querySelectorAll('.pin-person,.evt-badge')].map(n=>n.getBoundingClientRect());
        return boxes.every((a,i)=>boxes.slice(i+1).every(b=>Math.min(a.right,b.right)<=Math.max(a.left,b.left)+1 || Math.min(a.bottom,b.bottom)<=Math.max(a.top,b.top)+1));
      });
      assert(clear, "Guest faces and event badge must not overlap");
      const anchored = await page.locator('.pin-people').evaluateAll(rows => document.body.classList.contains('game-ds') || rows.every(row => {
        const face = row.firstElementChild.getBoundingClientRect(), shield = row.parentElement.querySelector('.shield').getBoundingClientRect();
        return Math.abs(face.left - shield.left) <= 10 && Math.abs(face.bottom - shield.top) <= 14;
      }));
      assert(anchored, 'Faces must stay at the shield left edge regardless of caption width');
      await assertFits(page, '.pin-people');
      await page.locator('[data-test="pin-tonari"]').click();
      await page.locator('[data-test="map-go"]').scrollIntoViewIfNeeded();
      await assertFits(page, '[data-test="map-go"]');
    }, options);
  }
});
