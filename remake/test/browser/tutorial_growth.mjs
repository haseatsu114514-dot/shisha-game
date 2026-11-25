import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const phone = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const button = (page, id) => page.locator(`[data-test="${id}"]`);
async function go(page, id, touch = false) {
  for (const target of [button(page, `pin-${id}`), button(page, "map-go")]) {
    if (touch) await target.tap();
    else await target.click();
  }
}

await suite("tutorial-growth", async check => {
  await check("scout-settlement-and-legacy-reload", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame(); s.phase = "daily";
      Object.assign(s.flags, { _morning_1: true, _errand_shop_done: true, _lemon_gift_read: true, _errand_scout_told: true });
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      // Inspect the first persisted receipt, before sleep resets growth.today and recovers stamina.
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === core.SAVE_KEY && !window.scoutReceipt) {
          const record = JSON.parse(value);
          if (record.flags._errand_naru_visited) window.scoutReceipt = record;
        }
        return write.call(this, key, value);
      };
      core.save();
      void (await import("./js/daily/calendar.js")).runDaily({ untilDay: 2, nightEvents: [] });
    });
    await go(page, "naru", true);
    await page.waitForFunction(() => window.scoutReceipt);
    const receipt = await page.evaluate(() => window.scoutReceipt);
    assert.equal(receipt.growth.today.learned.ch1_scout, 10);
    assert.deepEqual([receipt.money, receipt.stamina, receipt.visitedDay.naru], [24000, 84, 1]);
    assert(await page.locator("[data-test='hud-exp'] .hx-settled").evaluate(el => parseFloat(el.style.width) > 0));
    await page.reload();
    await button(page, "title-new").waitFor();
    await page.evaluate(async (record) => {
      const core = await import("./js/core/state.js");
      // An old day-one autosave might have charged and visited but not yet set the scout done flag.
      delete record.growth.today.learned.ch1_scout;
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(record));
      core.load();
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      void (await import("./js/daily/calendar.js")).runDaily({ untilDay: 2, nightEvents: [] });
    }, receipt);
    await page.waitForFunction(() => __remake.state.flags._errand_scout_done);
    const after = await page.evaluate(() => {
      const s = __remake.state;
      return [s.money, s.growth.xp, s.growth.today.learned.ch1_scout ?? 0];
    });
    assert.deepEqual(after, [24000, receipt.growth.xp, 0]);
  }, phone);

  // #3819: 登録のついで（slot 0）も帰り道（slot 2）も、案内は PEPPERMINT → EDEN の順
  for (const slot of [0, 2]) await check(slot === 0 ? "errand-delivery" : "guided-delivery", async page => {
    const names = ["minto", "adam"];
    await page.evaluate(async initialSlot => {
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      Object.assign(s, { phase: "daily", day: 2, slot: initialSlot });
      Object.assign(s.flags, { _morning_2: true, _errand_scout_done: true, _c_station_registered: true, _ch1_rules_read: true,
        _delivery_batch_started: true, _delivery_minto_told: true, _delivery_adam_told: true });
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      const write = Storage.prototype.setItem;
      window.deliveries = {};
      Storage.prototype.setItem = function(key, value) {
        if (key === core.SAVE_KEY) {
          const record = JSON.parse(value);
          for (const id of ["minto", "adam"]) {
            if (record.flags[`_delivery_${id}_done`]) window.deliveries[id] ||= record;
          }
        }
        return write.call(this, key, value);
      };
      core.save();
      void (await import("./js/daily/calendar.js")).runDaily({ untilDay: 3, nightEvents: [] });
    }, slot);
    for (const [index, id] of names.entries()) {
      await go(page, id, slot === 0);
      await page.waitForFunction(charId => window.deliveries[charId], id);
      const receipt = await page.evaluate(charId => window.deliveries[charId], id);
      assert.equal(receipt.growth.today.learned[`ch1_delivery_${id}`], 10);
      assert.deepEqual([receipt.money, receipt.stamina, receipt.slot], [29000 + index * 2000, 100, slot]);
      if (id === "minto") assert.equal(receipt.story.minto || 0, 0, "The handoff must not use the normal smoking visit");
    }
    // Loading the delivery receipt and revisiting the settlement function must not pay again.
    const settled = await page.evaluate(id => window.deliveries[id], names.at(-1));
    await page.reload();
    await button(page, "title-new").waitFor();
    const result = await page.evaluate(async record => {
      const core = await import("./js/core/state.js");
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(record));
      const s = core.load();
      const spots = await import("./js/daily/spots.js");
      const retries = [];
      for (const id of ["minto", "adam"]) retries.push(await spots.deliverToRival(spots.spotById(id)));
      return { retries, money: s.money, xp: s.growth.xp };
    }, settled);
    assert.deepEqual(result, { retries: [false, false], money: 31000, xp: settled.growth.xp });
  }, slot === 0 ? phone : {});

  await check("reload-during-handoff", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const spots = await import("./js/daily/spots.js");
      const s = core.newGame(); s.phase = "daily"; s.day = 2;
      s.flags._delivery_minto_told = true;
      core.save();
      void spots.deliverToRival(spots.spotById("minto"));
    });
    await page.locator("#vn.active .vn-text").waitFor();
    await page.reload();
    await button(page, "title-new").waitFor();
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.load();
      const { visitRival, spotById } = await import("./js/daily/spots.js");
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      const before = [s.money, s.growth?.xp ?? 0, !!s.flags._delivery_minto_done];
      const retry = await visitRival(spotById("minto"));
      const paid = s.growth.today.learned.ch1_delivery_minto, moneyAfterDelivery = s.money;
      const regular = await visitRival(spotById("minto"));
      return { before, retry, paid, moneyAfterDelivery, regular, xp: s.growth.today.learned.ch1_delivery_minto, spent: moneyAfterDelivery - s.money, stamina: s.stamina };
    });
    const { spent, ...checkpoints } = result;
    assert(spent >= 3000, "A regular visit still costs money");
    assert.deepEqual(checkpoints, { before: [27000, 0, false], retry: true, paid: 10, moneyAfterDelivery: 29000, regular: true, xp: 10, stamina: 84 });
  });

  await check("invalid-and-board-off-delivery", async page => {
    const result = await page.evaluate(async () => {
      localStorage.setItem("suien_growth_preview", "0");
      const core = await import("./js/core/state.js");
      const { DB } = await import("./js/core/data.js");
      const spots = await import("./js/daily/spots.js");
      const vn = await import("./js/vn/engine.js");
      vn.vnTest.turbo = true;
      const s = core.newGame(); s.phase = "daily"; s.day = 2;
      const minto = spots.spotById("minto");
      const direct = () => spots.deliverToRival(minto);
      const unrequested = await direct();
      s.flags._delivery_minto_told = true;
      s.day = 6; // Closed.
      const closed = await direct();
      s.day = 2;
      const line = DB.dialogues.remake_delivery_minto_handoff;
      delete DB.dialogues.remake_delivery_minto_handoff;
      const missing = await direct();
      DB.dialogues.remake_delivery_minto_handoff = line;
      const invalidSnapshot = [s.flags._delivery_minto_done ?? false, s.money, s.growth?.xp ?? 0];
      const simultaneous = await Promise.all([direct(), direct()]);
      const saved = core.load();
      return { unrequested, closed, missing, invalidSnapshot, simultaneous,
        saved: [saved.flags._delivery_minto_done, saved.money, saved.growth?.xp ?? 0, saved.slot, saved.stamina] };
    });
    assert.deepEqual(result, { unrequested: false, closed: false, missing: false, invalidSnapshot: [false, 27000, 0],
      simultaneous: [true, false], saved: [true, 29000, 0, 0, 100] });
  });

  await check("hud-capacity-save-and-legacy-mode", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const { addStamina, maxStamina, currentCondition } = await import("./js/core/stats.js");
      const { ensureGrowth } = await import("./js/core/growth.js");
      const { NODES, HUB, commitPending } = await import("./js/core/growth-board.js");
      const hud = await import("./js/daily/hud.js");
      const s = core.newGame(); s.phase = "daily";
      // Save with neither new board allocations nor a migration-created stamina cap.
      delete s.growth;
      hud.initHud({}); hud.showHud();
      const read = () => {
        hud.updateHud();
        const bar = document.querySelector(".hud-stamina .hud-bar"), exp = document.querySelector(".hud-exp .hx-bar");
        return {
          track: parseFloat(bar.style.width), fill: parseFloat(bar.querySelector("b").style.width),
          // DS風の帯（looks/retro）が読む枠の割合
          ratio: Number(bar.closest(".hud-stamina").dataset.track),
          max: maxStamina(), stamina: core.state.stamina, condition: currentCondition().label,
          equalHeight: getComputedStyle(bar).height === getComputedStyle(exp).height,
          hiddenExp: exp.closest(".hud-exp").hidden, hasGrowth: !!core.state.growth,
        };
      };
      const legacy = read();
      const g = ensureGrowth(s); g.hidane.any = 8;
      const starter = NODES.find(n => n.perk === "stamina" && n.ring === 1 && n.links.includes(HUB));
      const confirmed = commitPending([starter.id], s).map(n => n.id);
      const lit = read();
      const duplicate = commitPending([starter.id], s);
      core.save(); core.load();
      const loaded = read();
      addStamina(500);
      const filled = read();
      addStamina(-24);
      const spent = read();
      localStorage.setItem("suien_growth_preview", "0");
      core.save(); core.load();
      const off = read();
      localStorage.setItem("suien_growth_preview", "1");
      const restored = read();
      return { legacy, confirmed, lit, duplicate, loaded, filled, spent, off, restored };
    });
    assert.equal(result.legacy.hasGrowth, false);
    assert.deepEqual([result.legacy.track, result.legacy.max, result.legacy.fill, result.legacy.equalHeight], [60, 100, 100, true]);
    assert.equal(result.confirmed.length, 1);
    assert.deepEqual(result.duplicate, []);
    assert(result.lit.track > 60 && result.lit.track < 120);
    assert.deepEqual([result.lit.stamina, result.lit.max, result.lit.fill, result.lit.condition],
      [100, 108, 93, result.legacy.condition]);
    assert.deepEqual(result.lit, result.loaded);
    assert.deepEqual([result.filled.stamina, result.filled.fill, result.filled.track], [108, 100, result.lit.track]);
    assert.deepEqual([result.spent.stamina, result.spent.fill, result.spent.track], [84, 78, result.lit.track]);
    assert.deepEqual([result.off.track, result.off.max, result.off.hiddenExp], [120, 100, true]);
    // 枠の割合は HUD の全長 120px に対する長さ（盤の割り振り前 0.5・盤を無効にした旧方式 1）。DS風の帯が同じ割合で伸びる
    for (const key of ["legacy", "lit", "off"]) assert.equal(result[key].ratio, Math.round(result[key].track / 120 * 1000) / 1000, key);
    assert.deepEqual([result.legacy.ratio, result.off.ratio], [0.5, 1]);
    assert.deepEqual(result.restored, result.spent);
  }, phone);
});
