// #509: 実際の施設訪問・会話・セーブ・マップ操作で、開示順と報酬の境界を検証。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite, assertFits } from "./support.mjs";

const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const shots = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser/spot-encounters");
fs.mkdirSync(shots, { recursive: true });

async function setup(page, { load = false } = {}) {
  await page.evaluate(async load => {
    window.E = {
      core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
      stats: await import("./js/core/stats.js"), vn: await import("./js/vn/engine.js"),
      spots: await import("./js/daily/spots.js"), weather: await import("./js/daily/weather.js"),
      chapter: await import("./js/chapters/ch1.js"), intro: await import("./js/vn/intro.js"),
      encounters: await import("./js/daily/spot-encounters.js"), calendar: await import("./js/daily/calendar.js"),
    };
    E.chapter.setupHooks(); E.vn.vnTest.turbo = true; E.core.config.textSpeed = 4;
    E.fresh = (over = {}) => {
      const s = E.core.newGame();
      Object.assign(s, { phase: "daily", day: 8, slot: 0, stamina: 70,
        affinity: { naru: 20, adam: 20, minto: 30 }, romance: { minto: 1 },
        story: { naru: 6, adam: 6, minto: 6 }, contacts: [], ...over });
      for (const id of ["naru", "adam", "minto", "sumi"]) {
        E.core.markMet(id); E.intro.markIntroSeen(id);
      }
      Object.assign(s.flags, { _gym_member: true, _morning_8: true, _lime_tut: true,
        _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
        _hiyori_meeting_done: true, _hiyori_message_delivered: true });
      E.sunny(); E.clear(); E.vn.vnTest.choose = null;
      return s;
    };
    E.sunny = () => { for (let seed = 0; seed < 100; seed++) {
      E.core.state.weatherSeed = seed; if (!E.weather.isRainy()) break;
    } };
    E.rain = () => { for (let seed = 0; seed < 100; seed++) {
      E.core.state.weatherSeed = seed; if (E.weather.isRainy()) break;
    } };
    E.relationship = () => {
      const s = E.core.state;
      return JSON.stringify([s.affinity, s.affinityCarry, s.romance, s.romanceChoices,
        s.lovers, s.loveLevel, s.lovePts, s.loveCarry, s.finales, s.relationshipMemories, s.story, s.visits, s.contacts,
        Object.fromEntries(Object.entries(s.flags).filter(([key]) => /_affinity_|_friend_|_romance_|_confession_/.test(key)))]);
    };
    E.clear = () => { E.vn.backlog().length = 0; E.trace = []; };
    E.lines = () => E.vn.backlog().map(line => line.text);
    const previous = E.vn.hooks.onLine;
    E.vn.hooks.onLine = (id, line) => {
      previous?.(id, line); if (E.trace.at(-1) !== id) E.trace.push(id);
    };
    E.facility = id => {
      const spot = E.spots.spotById(id);
      return E.stats.paidAction(() => E.spots.visitSpot(spot), {
        ...(["kannon", "choizap"].includes(id) ? { budget: 1, points: 2, primary: spot.stat } : {}),
        consumed: () => true,
      });
    };
    if (load) { E.core.load(); E.clear(); } else E.fresh();
  }, load);
}

await suite("spot-encounters", async check => {
  const selected = process.env.TEST_CASES?.split(",");
  const run = (label, body, options = {}) => !selected || selected.includes(label)
    ? check(label, body, { reducedMotion: "reduce", ...options }) : Promise.resolve();

  await run("cafe-cadence-and-new-person-introduction", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const before = E.relationship(), rows = [];
      for (let n = 1; n <= 8; n++) {
        E.clear(); const money = E.core.state.money; await E.facility("cafe");
        rows.push({ trace: E.trace, lines: E.lines(), cost: money - E.core.state.money });
      }
      return { rows, unchanged: before === E.relationship(), met: E.core.state.met.maezono,
        seen: E.core.state.flags._spot_seen_cafe_maezono_break };
    });
    assert(r.unchanged && r.met && r.seen);
    assert.equal(r.rows[0].trace[0], "ch1_cafe_visit");
    assert.equal(r.rows[1].trace[0], "cafe_naru_break");
    assert.equal(r.rows[3].trace[0], "cafe_maezono_break");
    assert.equal(r.rows[5].trace[0], "cafe_master_quiz");
    assert(r.rows[3].lines.some(t => t.includes("HOOKAH PRESSというサイト")));
    for (const n of [2, 4, 6, 7]) assert(!/naru|maezono|master/.test(r.rows[n].trace[0]));
    assert(r.rows.every(row => row.cost === 800));
  });

  await run("kannon-rain-defers-and-legacy-visits-do-not-fake-seen", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const s = E.core.state; s.spotVisits = { kannon: 20 };
      const before = E.relationship(); E.rain(); await E.facility("kannon");
      const rain = { trace: E.trace, seen: !!s.flags._spot_seen_kannon_adam, last: s.flags._spot_last_kannon };
      E.sunny(); E.clear(); await E.facility("kannon"); const adam = E.trace;
      E.clear(); await E.facility("kannon"); const quiet = E.trace;
      E.clear(); await E.facility("kannon"); const resident = E.trace;
      E.clear(); await E.facility("kannon"); const after = E.trace;
      return { rain, adam, quiet, resident, after, unchanged: before === E.relationship(),
        money: s.money, visits: s.spotVisits.kannon };
    });
    assert.deepEqual(r.rain, { trace: ["kannon_rain"], seen: false, last: undefined });
    assert.deepEqual(r.adam, ["kannon_adam"]); assert.deepEqual(r.resident, ["kannon_oldman"]);
    assert(!/adam|oldman/.test(r.quiet[0]) && !/adam|oldman/.test(r.after[0]));
    assert(r.unchanged); assert.equal(r.money, 30000); assert.equal(r.visits, 25);
  });

  await run("gym-waits-for-actual-identity-and-preserves-private-name", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const s = E.core.state, before = E.relationship(), rows = [];
      for (let n = 1; n <= 5; n++) {
        E.clear(); await E.facility("choizap"); rows.push(E.trace);
      }
      const unrevealed = !E.lines().some(t => /栞|みんと|お姉さん/.test(t)) && !s.flags._spot_seen_choizap_minto;
      s.flags._minto_identity_revealed = true;
      E.clear(); await E.facility("choizap");
      const revealed = { trace: E.trace, names: E.vn.backlog().filter(l => l.name === "みんと" || l.name === "栞").map(l => l.name), lines: E.lines() };
      E.clear(); await E.facility("choizap");
      return { rows, unrevealed, revealed, after: E.trace, unchanged: before === E.relationship() };
    });
    assert.equal(r.rows[1][0], "choizap_naru"); assert.equal(r.rows[3][0], "choizap_oldman");
    assert(r.rows.every(row => !row.includes("choizap_minto"))); assert(r.unrevealed && r.unchanged);
    assert.deepEqual(r.revealed.trace, ["choizap_minto"]);
    assert(r.revealed.names.length && r.revealed.names.every(name => name === "みんと"));
    assert(!r.revealed.lines.some(t => t.includes("栞"))); assert(!r.after.includes("choizap_minto"));
  });

  await run("direct-gym-dialogue-cannot-reveal-from-name-or-affinity", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      E.core.state.flags._minto_name_known = true; E.core.state.affinity.minto = 66;
      const before = E.relationship(); await E.vn.play("choizap_minto");
      return { lines: E.lines(), names: E.vn.backlog().map(l => l.name),
        seen: !!E.core.state.flags._spot_seen_choizap_minto, unchanged: before === E.relationship(),
        followup: E.encounters.spotFollowupDue("minto", E.core.state, E.data.DB.dialogues) };
    });
    assert(r.unchanged && !r.seen); assert.equal(r.followup, null);
    assert(!r.lines.some(t => /栞|みんと|お姉さん/.test(t)));
    assert(!r.names.some(t => /栞|みんと|お姉さん/.test(t || "")));
  });

  await run("gym-entry-still-requires-membership", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const s = E.core.state; s.flags._gym_member = false; s.flags._minto_identity_revealed = true;
      s.spotVisits = { choizap: 4 }; E.vn.vnTest.choose = () => 1;
      const before = E.relationship(); await E.facility("choizap");
      const declined = { trace: E.trace, money: s.money, member: s.flags._gym_member, seen: !!s.flags._spot_seen_choizap_minto };
      E.clear(); E.vn.vnTest.choose = () => 0; await E.facility("choizap");
      const registered = { trace: E.trace, money: s.money, member: s.flags._gym_member, seen: !!s.flags._spot_seen_choizap_minto };
      E.clear(); await E.facility("choizap");
      return { declined, registered, next: E.trace, unchanged: before === E.relationship() };
    });
    assert.deepEqual(r.declined, { trace: ["ch1_choizap_first"], money: 30000, member: false, seen: false });
    assert.deepEqual(r.registered, { trace: ["ch1_choizap_first"], money: 26000, member: true, seen: false });
    assert.deepEqual(r.next, ["choizap_minto"]); assert(r.unchanged);
  });

  const examples = [
    { spot: "cafe", char: "naru", source: "cafe_naru_break", follow: "cafe_naru_followup", positive: "_spot_choice_naru_cafe_share", reply: ["結局俺の方", "まだ食べてない"] },
    { spot: "kannon", char: "adam", source: "kannon_adam", follow: "kannon_adam_followup", positive: "_spot_choice_adam_pray", reply: ["お願いした甲斐", "代わりがきかない"] },
    { spot: "choizap", char: "minto", source: "choizap_minto", follow: "choizap_minto_followup", positive: "_spot_choice_minto_extra_minute", reply: ["今日は一回", "一緒に休んで"] },
  ];
  for (const ex of examples) for (const answer of [0, 1]) {
    await run(`${ex.spot}-answer-${answer}-saved-and-one-store-followup`, async page => {
      await setup(page);
      const r = await page.evaluate(async ({ ex, answer }) => {
        const s = E.core.state; s.spotVisits = { [ex.spot]: 1 };
        s.flags._minto_identity_revealed = s.flags._minto_name_known = true;
        E.vn.vnTest.choose = () => answer;
        const before = E.relationship(); await E.facility(ex.spot);
        const facilityUnchanged = before === E.relationship();
        E.core.saveToSlot("suien_remake_slot1"); E.core.newGame(); E.core.loadFromSlot("suien_remake_slot1");
        const source = JSON.stringify(E.core.state), chosen = !!E.core.state.flags[ex.positive];
        E.clear(); await E.stats.paidAction(() => E.spots.visitRival(E.spots.spotById(ex.char)));
        const withFollow = { trace: E.trace, lines: E.lines(), relationship: E.relationship(),
          money: E.core.state.money, stamina: E.core.state.stamina, stats: { ...E.core.state.stats },
          names: E.vn.backlog().filter(l => l.name === "みんと" || l.name === "栞").map(l => l.name) };
        E.core.save(); E.core.newGame(); E.core.load(); E.clear();
        await E.spots.visitChar(ex.char); const replayed = E.trace.includes(ex.follow);
        E.core.newGame(); Object.assign(E.core.state, JSON.parse(source));
        delete E.core.state.flags[`_spot_seen_${ex.source}`];
        E.clear(); await E.stats.paidAction(() => E.spots.visitRival(E.spots.spotById(ex.char)));
        const withoutFollow = { relationship: E.relationship(), money: E.core.state.money,
          stamina: E.core.state.stamina, stats: E.core.state.stats, trace: E.trace };
        return { facilityUnchanged, chosen, withFollow, withoutFollow, replayed };
      }, { ex, answer });
      assert(r.facilityUnchanged); assert.equal(r.chosen, answer === 0);
      assert.equal(r.withFollow.trace[0], ex.follow); assert(!r.withoutFollow.trace.includes(ex.follow));
      assert(r.withFollow.lines.some(t => t.includes(ex.reply[answer]))); assert(!r.replayed);
      for (const key of ["relationship", "money", "stamina", "stats"]) assert.deepEqual(r.withFollow[key], r.withoutFollow[key], key);
      if (ex.char === "minto") assert(r.withFollow.names.length && r.withFollow.names.every(name => name === "みんと"));
    });
  }

  for (const point of ["before-choice", "after-choice"]) {
    await run(`interrupted-${point}-keeps-only-real-progress`, async page => {
      await setup(page);
      await page.evaluate(() => {
        E.core.state.spotVisits = { cafe: 1 }; E.vn.vnTest.turbo = false;
        E.pending = E.facility("cafe");
      });
      await page.locator("#vn.active").waitFor();
      await page.locator('[data-test="vn-skip"]').click();
      await page.locator(".vn-choices.show").waitFor();
      await page.locator('[data-test="vn-skip"]').click();
      if (point === "after-choice") await page.locator('[data-test="choice-1"]').click();
      const interrupted = await page.evaluate(() => {
        E.core.save(); return { done: !!E.core.state.flags.spot_cafe_naru_done,
          seen: !!E.core.state.flags._spot_seen_cafe_naru_break,
          callback: E.encounters.spotFollowupDue("naru", E.core.state, E.data.DB.dialogues) };
      });
      assert.equal(interrupted.done, point === "after-choice");
      assert(!interrupted.seen); assert.equal(interrupted.callback, null);
      await page.reload({ waitUntil: "load" }); await page.locator("#boot").waitFor({ state: "detached" });
      await setup(page, { load: true });
      const resumed = await page.evaluate(async () => {
        E.vn.vnTest.choose = () => 0; const before = E.relationship(); await E.facility("cafe");
        return { unchanged: before === E.relationship(), lines: E.lines(),
          chosen: !!E.core.state.flags._spot_choice_naru_cafe_share,
          seen: !!E.core.state.flags._spot_seen_cafe_naru_break,
          choices: E.vn.backlog().filter(l => l.name === "▶").length };
      });
      assert(resumed.unchanged && resumed.seen);
      assert.equal(resumed.chosen, point === "before-choice");
      assert.equal(resumed.choices, point === "before-choice" ? 1 : 0);
      assert(resumed.lines.some(t => t.includes(point === "before-choice" ? "ひと口分は俺に" : "ケーキ頼んで感想")));
    });
  }

  await run("eden-delivery-menu-regulars-and-recipe-memory", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      E.core.state.flags._delivery_adam = true; await E.vn.play("ch1_adam_first"); const first = E.lines();
      E.clear(); await E.vn.play("ch1_adam_second"); const second = E.lines();
      E.clear(); await E.vn.play("ch1_adam_group_soutoku");
      return { first, second, regulars: E.lines(), memories: E.core.state.relationshipMemories,
        recipe: E.core.state.flags._note_recipe_hint_apple_pie };
    });
    assert(r.first.some(t => t.includes("この袋、どこで")));
    assert(r.first.some(t => t.includes("在庫切れ")) && r.first.some(t => t.includes("さっぱりしたい")));
    assert(r.first.some(t => t.includes("メニューを見ず")));
    assert(r.second.some(t => t.includes("今は十種類")) && r.second.some(t => t.includes("熱の入り方")));
    assert(r.second.some(t => t.includes("ミントなど、数種類")));
    assert(r.regulars.some(t => t.includes("変わり種")) && r.regulars.some(t => t.includes("そこは変わらない")));
    assert(r.recipe && r.memories.includes("adam_origin") && r.memories.includes("adam_blend"));
  });

  // UI経由の通常自由行動も確認。SKIPは選択で止まり、実際にタップした返事を保存する。
  for (const [platform, options] of [["pc", {}], ["touch", touch]]) for (const ex of examples) {
    await run(`${platform}-${ex.spot}-map-choice-and-normal-reward`, async page => {
      await setup(page);
      await page.evaluate(spot => {
        E.core.state.spotVisits = { [spot]: 1 };
        E.core.state.flags._minto_identity_revealed = E.core.state.flags._minto_name_known = true;
        E.before = { relationship: E.relationship(), money: E.core.state.money, stamina: E.core.state.stamina,
          stats: { ...E.core.state.stats } };
        E.vn.vnTest.turbo = false;
        E.calendar.runDaily({ nightEvents: {}, onQuit: () => {} }).catch(error => { E.error = error.stack; });
      }, ex.spot);
      await page.locator(`.map:not(.done) [data-spot="${ex.spot}"]`).click();
      await page.locator('[data-test="map-go"]').click();
      await page.locator("#vn.active").waitFor();
      await page.locator('[data-test="vn-skip"]').click();
      await page.locator(".vn-choices.show").waitFor();
      await page.locator(".vn-choice").evaluateAll(async buttons => {
        await Promise.all(buttons.flatMap(button => button.getAnimations().map(animation => animation.finished.catch(() => {}))));
      });
      await assertFits(page, ".vn-choice");
      const selected = await page.evaluate(() => ({ trace: E.trace, text: E.lines(),
        name: document.querySelector(".vn-name").textContent }));
      assert.equal(selected.trace[0], ex.source);
      if (ex.char === "minto") { assert.equal(selected.name, "栞"); assert(selected.text.some(t => t.includes("栞さんだ"))); }
      await page.screenshot({ path: path.join(shots, `spot-${platform}-${ex.spot}-choices.png`) });
      // 実際のSKIPでは、選択肢を自動選択しない。
      assert.equal(await page.locator(".vn-choice").count(), 2);
      await page.locator(`[data-test="choice-${platform === "pc" ? 0 : 1}"]`).click();
      await page.waitForFunction(() => E.core.state.slot === 1 && document.querySelector(".map:not(.done)"));
      const r = await page.evaluate(({ ex }) => ({ error: E.error, unchanged: E.before.relationship === E.relationship(),
        cost: E.before.money - E.core.state.money, stamina: E.core.state.stamina - E.before.stamina,
        gain: E.core.state.stats[E.spots.spotById(ex.spot).stat] - E.before.stats[E.spots.spotById(ex.spot).stat],
        chosen: !!E.core.state.flags[ex.positive], seen: !!E.core.state.flags[`_spot_seen_${ex.source}`],
        visits: E.core.state.spotVisits[ex.spot], visitedToday: E.core.state.visitedDay[ex.spot] }), { ex });
      assert.equal(r.error, undefined); assert(r.unchanged && r.seen);
      assert.equal(r.cost, ex.spot === "cafe" ? 800 : 0);
      assert.equal(r.stamina, ex.spot === "choizap" ? -8 : 12);
      assert.equal(r.gain, ex.spot === "cafe" ? 1 : 2);
      assert.equal(r.chosen, platform === "pc"); assert.equal(r.visits, 2); assert.equal(r.visitedToday, 8);
    }, options);
  }
});
