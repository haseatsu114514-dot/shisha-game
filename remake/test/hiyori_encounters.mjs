// 正式な台本・店の行動・LIME・セーブ・表示を本番モジュールで通す。
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
const artifacts = path.resolve(fileURLToPath(new URL("../../", import.meta.url)), process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");
import { suite, assertFits } from "./browser/support.mjs";

async function setup(page) {
  await page.evaluate(async () => {
    window.H = {
      core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
      vn: await import("./js/vn/engine.js"), daily: await import("./js/daily/hiyori.js"),
      stats: await import("./js/core/stats.js"), route: await import("./js/core/hiyori-route.js"),
      spots: await import("./js/daily/spots.js"), tonari: await import("./js/daily/tonari.js"),
      phone: await import("./js/daily/phone.js"), calendar: await import("./js/daily/calendar.js"),
      ch1: await import("./js/chapters/ch1.js"), ui: await import("./js/core/ui.js"),
    };
    H.ch1.setupHooks();
    H.fresh = () => {
      const s = H.core.newGame();
      Object.assign(s, { phase: "daily", day: 4, slot: 0, money: 90000 });
      Object.assign(s.flags, { _errand_scout_done: true, _delivery_adam_done: true,
        _delivery_minto_done: true, _lime_tut: true, _morning_4: true });
      s.met.naru = s.met.adam = s.met.minto = s.met.rin = s.met.sumi = true;
      H.core.config.textSpeed = 4; H.vn.vnTest.turbo = true; H.vn.vnTest.choose = () => 0;
      return s;
    };
    H.visit = (id) => {
      const spot = H.spots.spotById(id);
      return H.daily.visitHiyoriAtShop(spot, { bg: H.spots.bgRef(spot.bg || H.spots.VISIT_BG[spot.charId] || "bg_fookah_showroom") });
    };
    H.ready = async () => {
      const s = H.fresh();
      await H.visit("naru");
      s.day++; await H.spots.visitChar("sumi");
      s.day++; await H.visit("minto");
      s.day++; await H.visit("adam");
      s.day++; await H.visit("c_station");
      s.contacts = ["sumi", "hiyori"]; s.lastBaitoDay = s.day;
      return s;
    };
    H.fresh();
  });
}

await suite("hiyori-encounters", async (check) => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  await check("all-shops-and-prerequisites", async (page) => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const shops = [];
      for (const id of ["naru", "adam", "minto", "shop", "c_station"]) {
        const s = H.fresh();
        const unknown = H.data.displayName("hiyori", s);
        const met = await H.visit(id);
        const points = s.affinity.hiyori;
        const duplicate = await H.visit(id);
        s.day++; const beforeSumi = await H.visit(id);
        shops.push({ id, unknown, met, duplicate, beforeSumi, unchanged: points === s.affinity.hiyori,
          shop: s.flags._hiyori_meeting_shop, contact: s.contacts.includes("hiyori") });
      }
      H.fresh();
      const excluded = ["tonari", "rest", "cafe", "kannon", "choizap", "fortune"].map((id) => H.daily.hiyoriShopEligible(H.spots.spotById(id)));
      H.core.state.chapter = 2;
      const futureShop = H.daily.hiyoriShopEligible(H.data.DB.kafuka.spot);
      return { shops, excluded, futureShop };
    });
    assert(result.shops.every((s) => s.unknown === "？？？" && s.met && s.contact && !s.duplicate && !s.beforeSumi && s.unchanged && s.shop === s.id));
    assert(result.excluded.every((v) => !v)); assert(result.futureShop);
  });

  await check("paid-map-action", async (page) => {
    await setup(page);
    await page.evaluate(() => { H.flow = H.calendar.runDaily({ nightEvents: {}, onQuit() {} }); });
    await page.locator('[data-test="pin-naru"]').click();
    await page.locator('[data-test="map-go"]').click();
    await page.waitForFunction(() => H.core.state.flags._hiyori_meeting_done);
    await page.waitForFunction(() => H.core.state.slot === 1);
    const s = await page.evaluate(() => ({ shop: H.core.state.flags._hiyori_meeting_shop, money: H.core.state.money, visited: H.core.state.visitedDay.naru }));
    assert.equal(s.shop, "naru"); assert.equal(s.money, 87000); assert.equal(s.visited, 4);
  });

  await check("sumi-at-work-and-customer-seat", async (page) => {
    await setup(page);
    for (const path of ["customer", "work"]) {
      await page.evaluate(async (which) => {
        H.fresh(); await H.visit("adam"); H.core.state.day++;
        H.contact = which === "work" ? H.tonari.doBaito() : H.tonari.tonariCustomer();
      }, path);
      if (path === "work") await page.locator('[data-test="after-none"]').click();
      await page.evaluate(() => H.contact);
      const result = await page.evaluate(() => ({ report: H.core.state.flags._hiyori_sumi_message_done,
        relay: H.core.state.flags._hiyori_message_delivered, known: H.core.state.flags._hiyori_real_self_known }));
      assert(result.report && !result.relay && !result.known);
    }
  });

  await check("lime-decline-retry-save-and-reunion", async (page) => {
    await setup(page);
    const initial = await page.evaluate(async () => {
      const s = await H.ready();
      return { level: H.stats.affinityLevel("hiyori"), relay: s.flags._hiyori_message_delivered,
        cracks: s.flags._hiyori_cracks_done, returnDone: s.flags._hiyori_tonari_return_done,
        early: H.route.hiyoriEventStatus("tonari_return"), messages: H.phone.morningMessages().map((m) => m.id) };
    });
    assert.equal(initial.level, 3); assert(initial.relay && initial.cracks && !initial.returnDone);
    assert.equal(initial.early, "ready"); assert(initial.messages.includes("hiyori_sumi_tonari_report"));
    await page.evaluate(() => { H.phone.deliverMorning(); H.thread = H.phone.openLime({ sender: "sumi" }); });
    await page.locator('[data-test="reply-1"]').click();
    await page.waitForFunction(() => H.core.state.inbox.some((i) => i.result === "declined" && i.needsResend));
    await page.locator('[data-test="phone-next"]').click();
    await page.locator('[data-test="phone-close"]').click(); await page.evaluate(() => H.thread);
    const again = await page.evaluate(() => {
      const s = H.core.state; s.day++; s.slot = 0; s.lastBaitoDay = s.day;
      H.phone.deliverMorning();
      return s.inbox.at(-1).msg.origin_id;
    });
    assert.equal(again, "hiyori_sumi_tonari_report");
    await page.evaluate(() => { H.thread = H.phone.openLime({ sender: "sumi" }); });
    await page.locator('[data-test="reply-0"]').click();
    await page.waitForFunction(() => H.core.state.pendingInvite?.event === "hiyori_tonari_return");
    await page.locator('[data-test="phone-next"]').click();
    await page.locator('[data-test="phone-close"]').click(); await page.evaluate(() => H.thread);
    await page.evaluate(() => {
      H.core.saveToSlot("suien_remake_slot2"); H.core.newGame();
      H.core.loadFromSlot("suien_remake_slot2");
      H.core.state.flags[`_morning_${H.core.state.day}`] = true;
      H.flow = H.calendar.runDaily({ nightEvents: {}, onQuit() {} });
    });
    await page.waitForFunction(() => H.core.state.flags._hiyori_tonari_return_done);
    await page.waitForFunction(() => H.core.state.slot === 1);
    const final = await page.evaluate(async () => {
      const s = H.core.state, points = s.affinity.hiyori;
      const replay = await H.daily.playHiyoriEvent("tonari_return");
      H.core.saveToSlot("suien_remake_slot2"); H.core.newGame(); H.core.loadFromSlot("suien_remake_slot2");
      return { replay, stable: H.core.state.affinity.hiyori === points,
        done: H.core.state.flags._hiyori_tonari_return_done, invite: H.core.state.pendingInvite,
        known: H.core.state.flags._hiyori_real_self_known };
    });
    assert(!final.replay && final.stable && final.done && !final.invite && !final.known);
    await page.evaluate(async () => { await H.spots.visitChar("sumi"); });
    assert(await page.evaluate(() => H.core.state.flags._hiyori_tonari_followup_done));
    const next = await page.evaluate(async () => {
      const s = H.core.state;
      const ready = H.route.hiyoriEventStatus("tonari_afterwork");
      const initialPoints = s.affinity.hiyori;
      s.day++; await H.spots.visitChar("sumi");
      const completed = s.flags._hiyori_tonari_afterwork_done;
      const stillHidden = !s.flags._hiyori_real_self_known && !s.flags._hiyori_work_talk_done;
      const seen = H.route.hiyoriEventStatus("tonari_afterwork");
      const afterPoints = s.affinity.hiyori;
      const repeat = await H.daily.playHiyoriEvent("tonari_afterwork");
      return { ready, completed, stillHidden, seen, repeat, initialPoints, afterPoints,
        stable: s.affinity.hiyori === afterPoints };
    });
    assert.equal(next.ready, "ready");
    assert(next.completed && next.stillHidden && next.seen === "seen" && !next.repeat && next.stable);
    assert(next.afterPoints > next.initialPoints);
  });

  await check("unread-expiry-and-no-affinity-inference", async (page) => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const old = H.fresh(); old.affinity.hiyori = 66;
      const gated = H.phone.morningMessages().some((m) => m.id === "hiyori_sumi_tonari_report");
      const s = await H.ready(); H.phone.deliverMorning(); s.day++; s.slot = 0; s.lastBaitoDay = s.day;
      H.phone.deliverMorning();
      const expired = s.inbox.some((i) => i.result === "expired");
      const retry = s.inbox.some((i) => i.msg.origin_id === "hiyori_sumi_tonari_report");
      s.affinity.hiyori = 20;
      return { gated, expired, retry, low: H.route.hiyoriEventStatus("tonari_return") };
    });
    assert(!result.gated && result.expired && result.retry); assert.equal(result.low, "prerequisites");
  });

  for (const [label, viewport] of [["desktop", { width: 1280, height: 720 }], ["mobile", { width: 844, height: 390 }]]) {
    await check(`${label}-lace-and-student`, async (page) => {
      await setup(page);
      await page.evaluate(() => {
        H.core.state.met.hiyori = true; H.vn.vnTest.turbo = false;
        H.visual = H.vn.play({ metadata: { bg: "res://assets/backgrounds/bg_tonari_inside.png" }, lines: [
          { speaker: "hiyori", face: "normal", text: "ここ、落ち着くね……" },
          { speaker: "hiyori", face: "sad", text: "今日は、少しだけ……" },
          { speaker: "hiyori", face: "smile", text: "ありがとう……" },
          { speaker: "hiyori", face: "surprise", text: "はじめくん……？" },
          { speaker: "hiyori", face: "tears", text: "また来ても、いいですか" },
          { speaker: "hiyori", face: "student_smile", text: "スミさん、おつかれさまです！" },
        ] });
      });
      await page.locator('#vn.active .vn-next.show').waitFor();
      await page.waitForTimeout(400);
      const frames = [];
      for (const face of ["normal", "sad", "smile", "surprise", "tears", "student_smile"]) {
        await page.waitForFunction((f) => document.querySelector('img[data-speaker="hiyori"]')?.src.includes(`_${f}.webp`), face);
        await assertFits(page, ".vn-box, .vn-text, .vn-controls");
        await page.waitForFunction(() => { const i = document.querySelector('img[data-speaker="hiyori"]'); return i.complete && i.naturalWidth > 0; });
        await page.screenshot({ path: path.join(artifacts, `${label}-${face}.png`) });
        frames.push(await page.locator('img[data-speaker="hiyori"]').evaluate((i) => ({ h: i.style.height, b: i.style.bottom, ax: i.style.getPropertyValue("--ax"), loaded: i.complete && i.naturalWidth > 0 })));
        await page.locator(".vn-box").click();
      }
      assert(frames.every((f) => f.loaded && f.h === frames[0].h && f.b === frames[0].b && f.ax === frames[0].ax));
      await page.evaluate(() => H.visual);
      await page.evaluate(() => { H.vn.vnTest.turbo = false; H.visual = H.vn.play("hiyori_tonari_return"); });
      await page.locator('#vn.active .vn-next.show').waitFor();
      await assertFits(page, ".vn-box, .vn-text, .vn-controls");
    }, { viewport });
  }
});
