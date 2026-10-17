import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

await suite("map-guests", async check => {
  for (const [device, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["narrow", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    await check(`${device}-silhouette-schedule-save`, async page => {
      if (device === "narrow") await page.evaluate(() => { localStorage.setItem("suien_title_layout", "ds"); window.dispatchEvent(new Event("display-layout-change")); });
      await page.evaluate(async () => {
        window.G = { core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
          map: await import("./js/daily/map.js"), people: await import("./js/daily/spot-people.js"),
          spots: await import("./js/daily/spots.js"), hiyori: await import("./js/daily/hiyori.js") };
        const s = G.core.newGame(); Object.assign(s, { phase: "daily", day: 4, slot: 0, seed: 131, money: 90000 });
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
        const s = core.newGame(); Object.assign(s, { phase: "daily", day: 8, slot: 1, money: 90000 });
        s.met.tsumugi = s.met.hiyori = true;
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
      await assertFits(page, '.pin-people');
      await page.locator('[data-test="pin-tonari"]').click();
      await page.locator('[data-test="map-go"]').scrollIntoViewIfNeeded();
      await assertFits(page, '[data-test="map-go"]');
    }, options);
  }
});
