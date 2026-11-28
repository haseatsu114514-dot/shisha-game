// よその店に居合わせる人（daily/roamers.js）: 保存の種で決まる居場所・地図の顔・来店後の会話・一日一度・LOAD。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

// 第1章の5日目の昼。会える人を全員そろえ、指定の人が居合わせる種を探す。
// hidden: 地図に顔を出さない回（ゲリラ）を探す。reason: 店を持つ人の理由（"closed"／"early"）を指定する。
async function prepare(page, { id, chapter = 1, day = 5, slot = 0, met = true, hidden = false, reason = null, identity = false } = {}) {
  return page.evaluate(async ({ id, chapter, day, slot, met, hidden, reason, identity }) => {
    const core = await import("./js/core/state.js"), roamers = await import("./js/daily/roamers.js");
    const spots = await import("./js/daily/spots.js"), people = await import("./js/daily/spot-people.js");
    const engine = await import("./js/vn/engine.js"), data = await import("./js/core/data.js");
    const value = core.newGame();
    Object.assign(value, { chapter, phase: "daily", day, slot, money: 20000, stamina: 90 });
    for (const who of ["naru", "adam", "minto", "rio", "samechan"]) value.met[who] = true;
    // 初回の固有会話は読んだ後（店に「！」が残っていると、早じまいしない）
    for (const who of ["naru", "adam", "minto"]) value.story[who] = 1;
    if (met) for (const who of ["uezono", "dr_charcoal", "sensu"]) value.met[who] = true;
    value.flags._met_tsumugi = true;
    value.flags._cafe_introduced = true;
    if (identity) value.flags._minto_identity_revealed = true;
    let plan = null;
    for (let seed = 1; seed < 20000 && !plan; seed++) {
      value.seed = seed;
      const found = roamers.roamerPlan(value);
      if (found?.id === id && !!found.hidden === hidden && (!reason || found.reason === reason)) plan = found;
    }
    window.R = { core, roamers, spots, people, engine, data, trace: [] };
    engine.vnTest.turbo = true;
    engine.hooks.onLine = (scene, line) => R.trace.push({ scene, speaker: line.speaker, text: line.text });
    core.save();
    return plan;
  }, { id, chapter, day, slot, met, hidden, reason, identity });
}

await suite("roamers", async check => {
  await check("plan-is-stable-shown-on-map-and-read-only", async page => {
    const plan = await prepare(page, { id: "uezono", met: false });
    assert(plan, "上園さんが居合わせる種が見つからない");
    const result = await page.evaluate(() => {
      const spot = R.spots.spotById(R.roamers.roamerPlan().spotId);
      const before = JSON.stringify(R.core.state);
      const people = R.people.spotPeople(spot);
      const again = R.roamers.roamerPlan();
      const unchanged = before === JSON.stringify(R.core.state);
      R.core.save(); R.core.newGame(); R.core.load();
      return { people, again, unchanged, afterLoad: R.roamers.roamerPlan() };
    });
    assert.deepEqual(result.again, plan);
    assert.deepEqual(result.afterLoad, plan);
    assert(result.unchanged, "地図の表示で保存を変えない");
    const guest = result.people.find(person => person.id === "uezono");
    assert(guest, "地図の店に顔を出す");
    assert.equal(guest.known, false);
    assert.equal(guest.name, "見知らぬ客");
  });

  await check("first-then-repeat-once-a-day-without-resources", async page => {
    await prepare(page, { id: "dr_charcoal", met: false });
    const result = await page.evaluate(async () => {
      const resources = () => JSON.stringify([R.core.state.money, R.core.state.stamina, R.core.state.slot, R.core.state.stats, R.core.state.affinity]);
      const plan = R.roamers.roamerPlan(), spot = R.spots.spotById(plan.spotId), before = resources();
      const first = await R.roamers.meetRoamer(spot, plan);
      const firstScenes = [...new Set(R.trace.map(x => x.scene))];
      const saved = R.core.peekSave();
      const again = await R.roamers.meetRoamer(spot, plan);
      // 同じ日の残りの時間帯には、もう出ない
      const sameDay = [];
      for (let slot = 0; slot <= 1; slot++) for (let seed = 1; seed < 400; seed++) {
        Object.assign(R.core.state, { slot, seed });
        if (R.roamers.roamerPlan()) sameDay.push(seed);
      }
      // 次の日、もう一度
      Object.assign(R.core.state, { day: 6, slot: 0 });
      for (let seed = 1; seed < 20000; seed++) { R.core.state.seed = seed; if (R.roamers.roamerPlan()?.id === "dr_charcoal") break; }
      const next = R.roamers.roamerPlan();
      R.trace = [];
      const repeat = await R.roamers.meetRoamer(R.spots.spotById(next.spotId), next);
      return { first, again, firstScenes, sameDay: sameDay.length, unchanged: before === resources(),
        seen: saved.flags._roam_seen_dr_charcoal, day: saved.flags._roam_day?.dr_charcoal, repeat,
        repeatScenes: [...new Set(R.trace.map(x => x.scene))], count: R.core.state.flags._roam_seen_dr_charcoal };
    });
    assert.equal(result.first, true);
    assert.deepEqual(result.firstScenes, ["roam_dr_charcoal_first"]);
    assert.equal(result.again, false, "同じ日にもう一度は読まない");
    assert.equal(result.sameDay, 0, "よその店で誰かと話した日は、もう誰も居合わせない");
    assert(result.unchanged, "代金・体力・時間・能力・好感度は変えない（審査員）");
    assert.equal(result.seen, 1);
    assert.equal(result.day, "1:5");
    assert.equal(result.repeat, true);
    assert.deepEqual(result.repeatScenes, ["roam_dr_charcoal_a"]);
    assert.equal(result.count, 2);
  });

  await check("friends-only-after-meeting-and-gain-affinity", async page => {
    await prepare(page, { id: "rio" });
    const result = await page.evaluate(async () => {
      const plan = R.roamers.roamerPlan(), spot = R.spots.spotById(plan.spotId);
      const before = R.core.state.affinity.rio || 0;
      const ok = await R.roamers.meetRoamer(spot, plan);
      const after = R.core.state.affinity.rio || 0;
      // 会っていない人は出ない
      const value = R.core.state;
      value.met.rio = false; value.met.adam = false; delete value.flags._met_tsumugi;
      const seen = new Set();
      for (let day = 4; day < 14; day++) for (let slot = 0; slot <= 1; slot++) for (let seed = 1; seed < 60; seed++) {
        Object.assign(value, { day, slot, seed });
        const found = R.roamers.roamerPlan();
        if (found) seen.add(found.id);
      }
      return { ok, gained: after - before, seen: [...seen].sort() };
    });
    assert.equal(result.ok, true);
    assert(result.gained > 0, "友人・ライバルは好感度が少し上がる");
    for (const id of ["rio", "adam", "tsumugi"]) assert(!result.seen.includes(id), `${id} は会う前には居合わせない`);
  });

  await check("never-at-busy-own-or-closed-shops-and-everyone-appears", async page => {
    await prepare(page, { id: "adam" });
    const result = await page.evaluate(async () => {
      const value = R.core.state, hiyori = await import("./js/daily/hiyori.js");
      const counts = {}, bad = [];
      let slots = 0, out = 0;
      for (const chapter of [1, 2]) for (let day = 4; day < 30; day++) for (let slot = 0; slot <= 1; slot++) for (let seed = 1; seed < 12; seed++) {
        Object.assign(value, { chapter, day, slot, seed });
        slots += 1;
        const plan = R.roamers.roamerPlan();
        if (!plan) continue;
        out += 1;
        counts[plan.id] = (counts[plan.id] || 0) + 1;
        const spot = R.spots.spotById(plan.spotId) || { id: plan.spotId };
        if (plan.spotId === "tonari" || plan.spotId === hiyori.hiyoriShopLocation()) bad.push(["busy", plan]);
        if (plan.id === "adam" && plan.spotId === "adam") bad.push(["own", plan]);
        // 店を持つライバルは、自分の店が休みの日か早じまいの夜だけ（2026-11-28 オーナー）
        if (plan.reason === "closed" && !R.spots.isClosedBase(R.spots.spotById(plan.id))) bad.push(["shop-open", plan]);
        if (plan.reason === "early" && (slot !== 1 || !R.spots.isEarlyClosed(R.spots.spotById(plan.shopId)))) bad.push(["early", plan]);
        if (plan.id === "sensu" && plan.spotId === "c_station") bad.push(["chain", plan]);
        if (R.spots.isClosed(spot)) bad.push(["closed", plan]);
      }
      return { counts, bad, rate: out / slots };
    });
    assert.deepEqual(result.bad, []);
    assert(result.rate > 0.15 && result.rate < 0.35, `居合わせる割合（4回に1回ほど） ${result.rate}`);
    for (const id of ["uezono", "dr_charcoal", "sensu", "adam", "naru", "rio", "tsumugi"]) assert(result.counts[id] > 0, `${id} が一度も出ない`);
  });

  await check("owner-not-double-listed-while-roaming-away-2444", async page => {
    // #2444: 店主がよその店へ居合わせに出ている間、地図で自分の店とよその店の両方に「在店」表示される二重在店を防ぐ。
    // DAY4 はEDEN（アダムの店）が開いている（定休は day%7===5）。アダムが早じまいして居合わせに出た夜は、EDENを閉める。
    await prepare(page, { id: "adam", day: 4, slot: 1 });
    const result = await page.evaluate(() => {
      const value = R.core.state, eden = R.spots.spotById("adam");
      const plan = R.roamers.roamerPlan(); // prepare が選んだ、アダムが居合わせに出る種
      const roaming = { id: plan.id, spotId: plan.spotId,
        roamed: R.people.spotPeople(R.spots.spotById(plan.spotId)).map(p => p.id),
        eden: R.people.spotPeople(eden).map(p => p.id), reason: plan.reason, edenEarly: R.spots.isEarlyClosed(eden) };
      // 誰も居合わせない種では、アダムは自分の店（EDEN）に出る
      let baseline = null;
      for (let seed = 1; seed < 20000 && !baseline; seed++) { value.seed = seed; if (!R.roamers.roamerPlan()) baseline = R.people.spotPeople(eden).map(p => p.id); }
      return { roaming, baseline, edenOpen: value.day % 7 !== 5 };
    });
    assert.equal(result.roaming.id, "adam");
    assert(result.roaming.spotId !== "adam", "アダムは自分の店には居合わせない");
    assert(result.edenOpen, "DAY4 はEDENが開いている");
    assert(result.roaming.roamed.includes("adam"), "居合わせ先にはアダムが出る");
    assert.equal(result.roaming.reason, "early", "定休日でない日は、早じまいした夜にだけ出る");
    assert(result.roaming.edenEarly, "早じまいの夜は、EDENを閉める");
    assert(!result.roaming.eden.includes("adam"), "よそへ出ている間は自分の店（EDEN）に出さない（#2444 二重在店の防止）");
    assert(result.baseline?.includes("adam"), "誰も居合わせない時は、EDENにアダムが出る");
  });

  await check("no-one-else-on-a-day-with-another-shop-guest", async page => {
    await prepare(page, { id: "uezono" });
    const result = await page.evaluate(() => {
      const value = R.core.state, stamp = `${value.chapter}:${value.day}`;
      const count = () => { let n = 0; for (let slot = 0; slot <= 1; slot++) for (let seed = 1; seed < 400; seed++) {
        Object.assign(value, { slot, seed }); if (R.roamers.roamerPlan()) n += 1; } return n; };
      const before = count();
      value.flags._hiyori_encounter_day = stamp;
      const hiyori = count();
      delete value.flags._hiyori_encounter_day;
      value.flags._city_guest_day = stamp;
      const city = count();
      return { before, hiyori, city };
    });
    assert(result.before > 0);
    assert.equal(result.hiyori, 0, "ひよりと話した日は出ない");
    assert.equal(result.city, 0, "隣町からの客と話した日は出ない");
  });

  await check("judges-speak-by-name-only-after-meeting", async page => {
    await prepare(page, { id: "sensu", met: true });
    const known = await page.evaluate(async () => {
      const plan = R.roamers.roamerPlan();
      await R.roamers.meetRoamer(R.spots.spotById(plan.spotId), plan);
      return R.trace.filter(x => x.speaker === "sensu").length;
    });
    assert(known > 0, "会った後は会長本人が話す");
  });

  await check("load-during-the-talk-leaves-no-record", async page => {
    await prepare(page, { id: "tsumugi" });
    await page.evaluate(() => {
      R.engine.vnTest.turbo = false; R.result = null;
      const plan = R.roamers.roamerPlan();
      R.owner = R.core.state;
      R.pending = R.roamers.meetRoamer(R.spots.spotById(plan.spotId), plan).then(value => { R.result = value; });
    });
    await page.waitForFunction(() => R.engine.isPlaying());
    await page.evaluate(() => R.core.setState(R.core.newState()));
    await page.waitForFunction(() => R.result === false);
    assert.deepEqual(await page.evaluate(() => ({ old: R.owner.flags._roam_seen_tsumugi, now: R.core.state.flags._roam_seen_tsumugi,
      playing: R.engine.isPlaying() })), { old: undefined, now: undefined, playing: false });
  });

  await check("tokyo-trio-only-at-tokyo-shops", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), roamers = await import("./js/daily/roamers.js");
      const tokyo = await import("./js/chapters/ch3-tokyo-daily.js");
      // 東京の店を全部登録する（実際の地図は物語の進みで店が増える。ここでは人ごとの居場所の決まりを見る）
      roamers.addRoamerSpots(() => tokyo.CH3_TOKYO_SPOTS);
      const value = core.newGame();
      Object.assign(value, { chapter: 3, phase: "daily", day: 3 });
      for (const who of ["ayatori", "steve", "volk", "mashiro", "mukai_master"]) value.met[who] = true;
      const places = Object.fromEntries(tokyo.CH3_TOKYO_SPOTS.map(entry => [entry.id, entry.place]));
      const counts = {}, bad = [];
      for (let day = 3; day < 16; day++) for (let slot = 0; slot <= 1; slot++) for (let seed = 1; seed < 120; seed++) {
        Object.assign(value, { day, slot, seed });
        const plan = roamers.roamerPlan();
        if (!plan) continue;
        counts[plan.id] = (counts[plan.id] || 0) + 1;
        const place = places[plan.spotId];
        if (!["mukai", "enmaku", "steve", "volk"].includes(place)) bad.push(["not-a-tokyo-shop", plan]);
        const own = { volk: "volk", ayatori: "enmaku", steve: "steve" }[plan.id];
        if (own && place === own) bad.push(["own-shop", plan]);
        if (plan.id === "mashiro" && place === "mukai") bad.push(["workplace", plan]);
        if (!["volk", "ayatori", "steve", "mashiro", "emil"].includes(plan.id)) bad.push(["home-person-in-tokyo", plan]);
        // 東京のライバルも、自分の店の定休日か早じまいの夜だけ（2026-11-28 オーナー「東京やドバイの店にも定休日を作って」）
        if (own) {
          const shop = tokyo.CH3_TOKYO_SPOTS.find(entry => entry.place === own);
          if (plan.reason === "closed" && day % 7 !== shop.closedOn) bad.push(["not-day-off", plan, day]);
          if (plan.reason === "early" && (slot !== 1 || plan.shopId !== shop.id)) bad.push(["early", plan, day, slot]);
          if (!["closed", "early"].includes(plan.reason)) bad.push(["no-reason", plan]);
          counts[`${plan.id}:${plan.reason}`] = (counts[`${plan.id}:${plan.reason}`] || 0) + 1;
        }
      }
      return { counts, bad };
    });
    assert.deepEqual(result.bad, []);
    for (const id of ["volk", "ayatori", "steve", "mashiro", "emil"]) assert(result.counts[id] > 0, `${id} が東京で一度も出ない`);
    for (const id of ["volk", "ayatori", "steve"]) for (const reason of ["closed", "early"]) assert(result.counts[`${id}:${reason}`] > 0, `${id}:${reason} が一度も出ない`);
  });

  // 2026-11-28 オーナー「東京やドバイの店にも定休日を作って」。働いている店（mukai）・シフトと約束のあるドバイのカフェは休まない
  await check("tokyo-and-dubai-rival-shops-take-a-day-off", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), spots = await import("./js/daily/spots.js");
      const tokyo = await import("./js/chapters/ch3-tokyo-daily.js"), dubai = await import("./js/chapters/ch4-dubai-daily.js");
      const progress = await import("./js/chapters/ch4-progress.js");
      const value = core.newGame();
      const offDays = list => Object.fromEntries(list.map(entry => [entry.place,
        Array.from({ length: 7 }, (_, day) => day).filter(day => spots.isClosedDay(entry, { ...value, day }))]));
      const tokyoDays = offDays(tokyo.CH3_TOKYO_SPOTS);
      const before = offDays(dubai.CH4_DUBAI_SPOTS); // 第4章の記録の無い保存（初めて会う前）
      Object.assign(value, { chapter: 4, day: 30 });
      value.flags._ch4 = { startDay: 30, day: 1, stage: 0, part: "prologue", titleSeen: false,
        read: { ch4_festa: true }, firstDay: null, resolution: 0, attempts: 0, routeVersion: 2 };
      if (!progress.chapterFourProgress(value).read.ch4_festa) throw new Error("第4章の記録を作れない");
      value.met.master_hookah = true;
      const after = offDays(dubai.CH4_DUBAI_SPOTS);
      return { tokyoDays, before, after };
    });
    for (const place of ["enmaku", "steve", "volk"]) assert.equal(result.tokyoDays[place].length, 1, `${place} は週に一日休む`);
    assert.equal(new Set(["enmaku", "steve", "volk"].map(place => result.tokyoDays[place][0])).size, 3, "東京の店の休みは別々の日");
    assert.deepEqual(result.tokyoDays.mukai, [], "mukai は休まない");
    assert.deepEqual([result.before.festa, result.before.longlong], [[], []], "初めて会う前は休まない（FESTA は期限の夜の場面がある）");
    assert.equal(result.after.festa.length, 1); assert.equal(result.after.longlong.length, 1);
    assert.notEqual(result.after.festa[0], result.after.longlong[0]);
    assert.deepEqual([result.after.center_cafe, result.after.alley_cafe], [[], []], "シフトと約束のあるカフェは休まない");
  });

  await check("emil-is-a-stranger-until-the-national-tournament", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), roamers = await import("./js/daily/roamers.js");
      const engine = await import("./js/vn/engine.js"), tokyo = await import("./js/chapters/ch3-tokyo-daily.js");
      roamers.addRoamerSpots(() => tokyo.CH3_TOKYO_SPOTS);
      const value = core.newGame();
      Object.assign(value, { chapter: 3, phase: "daily", day: 4, slot: 0 });
      let plan = null;
      for (let seed = 1; seed < 20000 && !plan; seed++) { value.seed = seed; const found = roamers.roamerPlan(); if (found?.id === "emil") plan = found; }
      const spot = tokyo.CH3_TOKYO_SPOTS.find(entry => entry.id === plan.spotId);
      const lines = [];
      engine.vnTest.turbo = true;
      engine.hooks.onLine = (scene, line) => lines.push(line.text || "");
      const ok = await roamers.meetRoamer(spot, plan);
      return { ok, named: lines.some(text => /エミル/.test(text)), murmur: lines.some(text => /Nefis/.test(text)) };
    });
    assert.deepEqual(result, { ok: true, named: false, murmur: true });
  });

  await check("tetsuko-warms-up-and-is-seen-around-tokyo", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), roamers = await import("./js/daily/roamers.js");
      const tokyo = await import("./js/chapters/ch3-tokyo-daily.js"), outings = await import("./js/chapters/ch3-outing-progress.js");
      const people = await import("./js/daily/spot-people.js");
      roamers.addRoamerSpots(() => tokyo.CH3_TOKYO_SPOTS);
      const cat = outings.TOKYO_OUTINGS.find(outing => outing.id === "tetsuko");
      const value = core.newGame();
      Object.assign(value, { chapter: 3, phase: "daily", day: 4, slot: 0 });
      // 裏口のお世話の順番（素っ気ない→ブラシ→待っている→寄ってくる→懐いた後を巡回）
      const order = [];
      for (let n = 0; n < 8; n++) { value.flags._ch3_outings = { tetsuko: n }; order.push(outings.outingDialogueId(value, cat)); }
      // 一度も構っていない間は、外で見かけない
      value.flags._ch3_outings = {};
      const seenBefore = [];
      for (let day = 4; day < 14; day++) for (let seed = 1; seed < 80; seed++) {
        Object.assign(value, { day, seed }); const plan = roamers.roamerPlan(); if (plan?.id === "tetsuko") seenBefore.push(plan);
      }
      value.flags._ch3_outings = { tetsuko: 1 };
      const places = new Set(), places2 = Object.fromEntries(tokyo.CH3_TOKYO_SPOTS.map(entry => [entry.id, entry.place]));
      let face = null;
      for (let day = 4; day < 14; day++) for (let seed = 1; seed < 80; seed++) {
        Object.assign(value, { day, seed });
        const plan = roamers.roamerPlan();
        if (plan?.id !== "tetsuko") continue;
        places.add(places2[plan.spotId]);
        face ||= people.spotPeople(tokyo.CH3_TOKYO_SPOTS.find(entry => entry.id === plan.spotId)).find(person => person.id === "tetsuko");
      }
      return { order, seenBefore: seenBefore.length, places: [...places].sort(), face };
    });
    assert.deepEqual(result.order, ["ch3_outing_tetsuko", "ch3_outing_tetsuko_brush", "ch3_outing_tetsuko_wait", "ch3_outing_tetsuko_trust",
      "ch3_outing_tetsuko_lap", "ch3_outing_tetsuko_belly", "ch3_outing_tetsuko_door", "ch3_outing_tetsuko_box"]); // #3097: 巡回は6本
    assert.equal(result.seenBefore, 0, "裏口で構う前は、外で見かけない");
    assert(result.places.length > 0 && result.places.every(place => ["park", "enmaku", "steve", "volk"].includes(place)), result.places.join(","));
    assert(result.face?.known && result.face.name === "てつこ", "地図には名前と顔で出る");
  });

  await check("doctor-remembers-the-shop-records-in-chapter-five", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), engine = await import("./js/vn/engine.js");
      const data = await import("./js/core/data.js"), files = await import("./js/core/chapter-data.js");
      Object.assign(data.DB.dialogues, await files.readDialogues("ch5_main", ["ch5_opening"]));
      const trace = [];
      engine.vnTest.turbo = true;
      engine.hooks.onLine = (scene, line) => trace.push(line.text);
      const run = async seen => {
        trace.length = 0;
        const value = core.newGame();
        Object.assign(value, { chapter: 5, phase: "daily" });
        if (seen) value.flags._roam_seen_dr_charcoal = 2;
        await engine.play("ch5_opening");
        return trace.some(text => /街の店で/.test(text || ""));
      };
      return { seen: await run(true), unseen: await run(false) };
    });
    assert.deepEqual(result, { seen: true, unseen: false });
  });

  // 2026-11-28 オーナー「ライバルは定休日とか早じまいした日に、よその店でエンカウントする」「最初からいるのわかるケースもあるしゲリラもあるし」
  await check("rivals-roam-only-on-days-off-or-after-closing-early", async page => {
    await prepare(page, { id: "naru", day: 4, slot: 1, reason: "early", identity: true });
    const result = await page.evaluate(() => {
      const value = R.core.state, bad = [], seen = {};
      for (let day = 4; day < 25; day++) for (let slot = 0; slot <= 1; slot++) for (let seed = 1; seed < 80; seed++) {
        Object.assign(value, { day, slot, seed });
        const plan = R.roamers.roamerPlan();
        if (!plan || !["naru", "adam", "minto"].includes(plan.id)) continue;
        const own = R.spots.spotById(plan.id);
        seen[`${plan.id}:${plan.reason}`] = (seen[`${plan.id}:${plan.reason}`] || 0) + 1;
        if (plan.reason === "closed" && !R.spots.isClosedBase(own)) bad.push(["open-on-day-off", plan, day, slot]);
        if (plan.reason === "early" && (slot !== 1 || R.spots.isClosedBase(own) || !R.spots.isEarlyClosed(own) || plan.shopId !== own.id)) bad.push(["early", plan, day, slot]);
        if (!["closed", "early"].includes(plan.reason)) bad.push(["no-reason", plan]);
        if (plan.id === "minto" && !plan.hidden) bad.push(["minto-shown", plan]);
        if (plan.spotId === plan.id) bad.push(["own", plan]);
      }
      // 正体を知る前のみんと（私服のお忍び）は出ない
      delete value.flags._minto_identity_revealed;
      let mintoBefore = 0;
      for (let day = 4; day < 25; day++) for (let slot = 0; slot <= 1; slot++) for (let seed = 1; seed < 80; seed++) {
        Object.assign(value, { day, slot, seed }); if (R.roamers.roamerPlan()?.id === "minto") mintoBefore += 1;
      }
      return { bad, seen, mintoBefore };
    });
    assert.deepEqual(result.bad, []);
    for (const key of ["naru:closed", "naru:early", "adam:closed", "adam:early", "minto:closed", "minto:early"]) assert(result.seen[key] > 0, `${key} が一度も出ない`);
    assert.equal(result.mintoBefore, 0, "正体がつながる前のみんとは、私服で居合わせない");
  });

  await check("early-closing-shows-on-the-map-and-the-talk-tells-why", async page => {
    const plan = await prepare(page, { id: "naru", day: 4, slot: 1, reason: "early" });
    assert(plan, "なるが早じまいして居合わせる種が見つからない");
    const result = await page.evaluate(async () => {
      const access = await import("./js/daily/spot-access.js");
      const plan = R.roamers.roamerPlan(), kemuriya = R.spots.spotById("naru");
      const tag = access.spotAvailability(kemuriya).tag;
      const ok = await R.roamers.meetRoamer(R.spots.spotById(plan.spotId), plan);
      const scene = R.data.DB.dialogues.roam_naru_first;
      const texts = new Set(R.trace.map(x => x.text));
      const early = (scene?.branches?.early || []).filter(line => line.text).every(line => texts.has(line.text));
      const closed = (scene?.branches?.closed || []).some(line => line.text && texts.has(line.text));
      return { tag, ok, early, closed, after: R.spots.isClosed(kemuriya), plan: R.roamers.roamerPlan() };
    });
    assert.equal(result.tag, "今夜は早じまい", "地図の札は「今夜は早じまい」");
    assert.equal(result.ok, true);
    assert(result.early && !result.closed, "会話で早じまいの理由を後から話す");
    assert.equal(result.plan, null, "会った後は、その日はもう誰も居合わせない");
    assert(result.after, "会った後も、その夜の店は閉めたまま");
  });

  await check("guerrilla-is-off-the-map-but-met-after-the-visit", async page => {
    const plan = await prepare(page, { id: "uezono", hidden: true });
    assert(plan?.hidden, "地図に出ない回の種が見つからない");
    const result = await page.evaluate(async () => {
      const plan = R.roamers.roamerPlan(), spot = R.spots.spotById(plan.spotId);
      const shown = R.people.spotPeople(spot).some(person => person.id === "uezono");
      const at = R.roamers.roamerAt(spot);
      const ok = await R.roamers.meetRoamer(spot, at);
      return { shown, at: at?.id, ok, read: R.trace.some(x => x.scene === "roam_uezono_first") };
    });
    assert.deepEqual(result, { shown: false, at: "uezono", ok: true, read: true });
  });

  await check("photo-booth-can-take-the-person-met-in-the-shop", async page => {
    await prepare(page, { id: "rio" });
    const ids = await page.evaluate(async () => {
      const purikura = await import("./js/chapters/ch2-purikura.js");
      const spot = { id: "ch2_ageha", kind: "rival", charId: "ageha", region: "widehanga" };
      return [purikura.purikuraGuests(spot).map(p => p.id), purikura.purikuraGuests(spot, ["naru"]).map(p => p.id)];
    });
    assert(!ids[0].includes("naru") && ids[1].includes("naru"), "先に話した居合わせの人は、会った後もプリクラの相手に出る");
  });

  // あげはの店（夜）: 居合わせた人と先に話して理由を聞き、その後でプリクラを撮るか選ぶ（その人とも撮れる）
  await check("at-ageha-the-roamer-talk-comes-before-the-photo-booth", async page => {
    const plan = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), value = core.newGame();
      Object.assign(value, { chapter: 2, phase: "daily", day: 18, slot: 1, money: 30000, stamina: 80 });
      value.met = { hajime: true, ageha: true, naru: true, adam: true };
      value.story.naru = 1; value.story.adam = 1;
      Object.assign(value.flags, { _ch2_day1: { startDay: 15 }, _ageha_first_purikura: true, _ch2_talks: { ageha: 3 } });
      const city = await import("./js/chapters/ch2-city-data.js");
      await city.loadChapterTwoDialogues(); await city.loadPreparationDialogues();
      const roamers = await import("./js/daily/roamers.js"), prep = await import("./js/chapters/ch2-preparation.js");
      roamers.addRoamerSpots(() => prep.PREPARATION_SPOTS);
      let plan = null;
      for (let seed = 1; seed < 40000 && !plan; seed++) {
        value.seed = seed;
        const found = roamers.roamerPlan(value);
        if (found?.spotId === "ch2_ageha" && ["naru", "adam"].includes(found.id)) plan = found;
      }
      core.save();
      const engine = await import("./js/vn/engine.js");
      engine.vnTest.turbo = true;
      window.R = { trace: [], done: null };
      engine.hooks.onLine = scene => R.trace.push(scene);
      const spot = prep.PREPARATION_SPOTS.find(entry => entry.id === "ch2_ageha");
      prep.visitPreparationSpot(spot, { staminaGuard: async () => true, roamer: plan,
        meetRoamerNow: () => roamers.meetRoamer(spot, plan, { deferSave: true }) }).then(result => { R.done = result; });
      return plan;
    });
    assert(plan, "MELTY PUFF に、店の休み・早じまいのライバルが居合わせる種が見つからない");
    await page.locator('[data-test="purikura-shoot"]').click();
    await page.locator(`[data-test="purikura-with-${plan.id}"]`).click();
    await page.locator('[data-test="purikura-receive"]').click();
    await page.waitForFunction(() => R.done);
    const result = await page.evaluate(() => ({ scenes: [...new Set(R.trace)], done: R.done,
      photo: __remake.state.flags._ageha_purikura_history?.at(-1)?.people, met: __remake.state.flags._roam_day }));
    const talk = result.scenes.indexOf(`roam_${plan.id}_first`), booth = result.scenes.indexOf("remake_ch2_purikura_match");
    assert(talk >= 0 && booth > talk, `居合わせの会話の後でプリクラ: ${result.scenes.join(",")}`);
    assert.equal(result.done.used, true);
    assert.deepEqual(result.photo, ["hajime", plan.id], "居合わせた人と撮れる");
    assert.equal(result.met?.[plan.id], "2:18");
  });
}, { roamers: true });
