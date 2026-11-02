// よその店に居合わせる人（daily/roamers.js）: 保存の種で決まる居場所・地図の顔・来店後の会話・一日一度・LOAD。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

// 第1章の5日目の昼。会える人を全員そろえ、指定の人が居合わせる種を探す。
async function prepare(page, { id, chapter = 1, day = 5, met = true } = {}) {
  return page.evaluate(async ({ id, chapter, day, met }) => {
    const core = await import("./js/core/state.js"), roamers = await import("./js/daily/roamers.js");
    const spots = await import("./js/daily/spots.js"), people = await import("./js/daily/spot-people.js");
    const engine = await import("./js/vn/engine.js"), data = await import("./js/core/data.js");
    const value = core.newGame();
    Object.assign(value, { chapter, phase: "daily", day, slot: 0, money: 20000, stamina: 90 });
    for (const who of ["naru", "adam", "minto", "rin", "samechan"]) value.met[who] = true;
    if (met) for (const who of ["maezono", "dr_kemuri", "nagumo"]) value.met[who] = true;
    value.flags._met_tsumugi = true;
    value.flags._cafe_introduced = true;
    let plan = null;
    for (let seed = 1; seed < 20000 && !plan; seed++) {
      value.seed = seed;
      const found = roamers.roamerPlan(value);
      if (found?.id === id) plan = found;
    }
    window.R = { core, roamers, spots, people, engine, data, trace: [] };
    engine.vnTest.turbo = true;
    engine.hooks.onLine = (scene, line) => R.trace.push({ scene, speaker: line.speaker, text: line.text });
    core.save();
    return plan;
  }, { id, chapter, day, met });
}

await suite("roamers", async check => {
  await check("plan-is-stable-shown-on-map-and-read-only", async page => {
    const plan = await prepare(page, { id: "maezono", met: false });
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
    const guest = result.people.find(person => person.id === "maezono");
    assert(guest, "地図の店に顔を出す");
    assert.equal(guest.known, false);
    assert.equal(guest.name, "見知らぬ客");
  });

  await check("first-then-repeat-once-a-day-without-resources", async page => {
    await prepare(page, { id: "dr_kemuri", met: false });
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
      for (let seed = 1; seed < 20000; seed++) { R.core.state.seed = seed; if (R.roamers.roamerPlan()?.id === "dr_kemuri") break; }
      const next = R.roamers.roamerPlan();
      R.trace = [];
      const repeat = await R.roamers.meetRoamer(R.spots.spotById(next.spotId), next);
      return { first, again, firstScenes, sameDay: sameDay.length, unchanged: before === resources(),
        seen: saved.flags._roam_seen_dr_kemuri, day: saved.flags._roam_day?.dr_kemuri, repeat,
        repeatScenes: [...new Set(R.trace.map(x => x.scene))], count: R.core.state.flags._roam_seen_dr_kemuri };
    });
    assert.equal(result.first, true);
    assert.deepEqual(result.firstScenes, ["roam_dr_kemuri_first"]);
    assert.equal(result.again, false, "同じ日にもう一度は読まない");
    assert.equal(result.sameDay, 0, "よその店で誰かと話した日は、もう誰も居合わせない");
    assert(result.unchanged, "代金・体力・時間・能力・好感度は変えない（審査員）");
    assert.equal(result.seen, 1);
    assert.equal(result.day, "1:5");
    assert.equal(result.repeat, true);
    assert.deepEqual(result.repeatScenes, ["roam_dr_kemuri_a"]);
    assert.equal(result.count, 2);
  });

  await check("friends-only-after-meeting-and-gain-affinity", async page => {
    await prepare(page, { id: "rin" });
    const result = await page.evaluate(async () => {
      const plan = R.roamers.roamerPlan(), spot = R.spots.spotById(plan.spotId);
      const before = R.core.state.affinity.rin || 0;
      const ok = await R.roamers.meetRoamer(spot, plan);
      const after = R.core.state.affinity.rin || 0;
      // 会っていない人は出ない
      const value = R.core.state;
      value.met.rin = false; value.met.adam = false; delete value.flags._met_tsumugi;
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
    for (const id of ["rin", "adam", "tsumugi"]) assert(!result.seen.includes(id), `${id} は会う前には居合わせない`);
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
        if (plan.id === "nagumo" && plan.spotId === "c_station") bad.push(["chain", plan]);
        if (R.spots.isClosed(spot)) bad.push(["closed", plan]);
      }
      return { counts, bad, rate: out / slots };
    });
    assert.deepEqual(result.bad, []);
    assert(result.rate > 0.15 && result.rate < 0.35, `居合わせる割合（4回に1回ほど） ${result.rate}`);
    for (const id of ["maezono", "dr_kemuri", "nagumo", "adam", "rin", "tsumugi"]) assert(result.counts[id] > 0, `${id} が一度も出ない`);
  });

  await check("no-one-else-on-a-day-with-another-shop-guest", async page => {
    await prepare(page, { id: "maezono" });
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
    await prepare(page, { id: "nagumo", met: true });
    const known = await page.evaluate(async () => {
      const plan = R.roamers.roamerPlan();
      await R.roamers.meetRoamer(R.spots.spotById(plan.spotId), plan);
      return R.trace.filter(x => x.speaker === "nagumo").length;
    });
    assert(known > 0, "会った後は南雲さん本人が話す");
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
      for (const who of ["kuze", "steve", "volk", "mashiro", "mukai_master"]) value.met[who] = true;
      const places = Object.fromEntries(tokyo.CH3_TOKYO_SPOTS.map(entry => [entry.id, entry.place]));
      const counts = {}, bad = [];
      for (let day = 3; day < 16; day++) for (let slot = 0; slot <= 1; slot++) for (let seed = 1; seed < 40; seed++) {
        Object.assign(value, { day, slot, seed });
        const plan = roamers.roamerPlan();
        if (!plan) continue;
        counts[plan.id] = (counts[plan.id] || 0) + 1;
        const place = places[plan.spotId];
        if (!["mukai", "enmaku", "steve", "volk"].includes(place)) bad.push(["not-a-tokyo-shop", plan]);
        if (plan.id === "volk" && place === "volk") bad.push(["own-shop", plan]);
        if (plan.id === "mashiro" && place === "mukai") bad.push(["workplace", plan]);
        if (!["volk", "mashiro", "emil"].includes(plan.id)) bad.push(["home-person-in-tokyo", plan]);
      }
      return { counts, bad };
    });
    assert.deepEqual(result.bad, []);
    for (const id of ["volk", "mashiro", "emil"]) assert(result.counts[id] > 0, `${id} が東京で一度も出ない`);
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
        if (seen) value.flags._roam_seen_dr_kemuri = 2;
        await engine.play("ch5_opening");
        return trace.some(text => /街の店で/.test(text || ""));
      };
      return { seen: await run(true), unseen: await run(false) };
    });
    assert.deepEqual(result, { seen: true, unseen: false });
  });
}, { roamers: true });
