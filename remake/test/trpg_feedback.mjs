import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sessionSource = await readFile(new URL("../js/trpg/session.js", import.meta.url), "utf8");
const sessionURL = "data:text/javascript;base64," + Buffer.from(sessionSource).toString("base64");
const { TrpgSession } = await import(sessionURL);
const source = (await readFile(new URL("../js/trpg/feedback.js", import.meta.url), "utf8")).replace('"./session.js"', JSON.stringify(sessionURL));
const { rollOdds, checkForecast, rerollOdds } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const ordinary = JSON.parse(await readFile(new URL("../../data/dialogue/trpg_ordinary.json", import.meta.url), "utf8"));
const shark = JSON.parse(await readFile(new URL("../../data/dialogue/trpg_shark.json", import.meta.url), "utf8"));

test("2d20 forecasts match all 400 real checks at base, aided and momentum bonuses", () => {
  const expected = [
    { success: 26, mixed: 48, trouble: 26 },
    { success: 43, mixed: 44, trouble: 14 },
    { success: 57, mixed: 36, trouble: 7 },
    { success: 74, mixed: 25, trouble: 2 },
  ];
  for (const [row, bonus] of [3, 7, 10, 14].entries()) {
    const counts = { success: 0, mixed: 0, trouble: 0 };
    for (let first = 1; first <= 20; first++) for (let second = 1; second <= 20; second++) {
      const session = new TrpgSession(ordinary, { seed: 1 });
      session.state.pending = { dice: [first, second], bonus };
      counts[session.checkResult().grade]++;
    }
    assert.deepEqual(rollOdds(bonus), expected[row]);
    for (const grade of Object.keys(counts)) {
      assert.equal(rollOdds(bonus)[grade], Math.round(counts[grade] * 100 / 400));
    }
  }
  assert.deepEqual(rollOdds(-40), { success: 0, mixed: 0, trouble: 100 });
  assert.deepEqual(rollOdds(30), { success: 100, mixed: 0, trouble: 0 });
});

test("forecast cannot reveal whether a hypothesis matches the hidden profile", () => {
  const correct = { hypothesis: "scent", profileId: "scent" };
  const incorrect = { hypothesis: "scent", profileId: "light" };
  const before = structuredClone({ correct, incorrect, shark });
  for (const support of [false, true]) {
    const a = checkForecast(shark, correct, "prepare", { support });
    assert.deepEqual(a, checkForecast(shark, incorrect, "prepare", { support }));
    assert.equal(a.baseBonus, support ? 10 : 3);
    assert.equal(a.potentialBonus, 4);
    assert.deepEqual(a.odds, rollOdds(a.baseBonus));
    assert.deepEqual(a.bestOdds, rollOdds(a.baseBonus + 4));
  }
  assert.deepEqual({ correct, incorrect, shark }, before);
  const hiddenState = { hypothesis: "scent", get profileId() { throw new Error("Hidden profile was read"); } };
  const publicScenario = { rules: shark.rules, get profiles() { throw new Error("Hidden profiles were read"); } };
  assert.equal(checkForecast(publicScenario, hiddenState, "prepare").potentialBonus, 4);
});

test("unconfirmed hypotheses and other phases have no conditional bonus; support adds seven", () => {
  for (const hypothesis of [null, undefined, ""]) {
    const forecast = checkForecast(shark, { hypothesis }, "prepare");
    assert.equal(forecast.potentialBonus, 0);
    assert.deepEqual(forecast.odds, forecast.bestOdds);
  }
  for (const kind of ["listen", "prepare", "serve"]) for (const support of [false, true]) {
    const forecast = checkForecast(ordinary, { hypothesis: "quiet" }, kind, { support });
    // Without a declared approach the forecast reads the player's own character, the first approach.
    const lead = ordinary.checks[kind].approaches[0];
    const base = ordinary.cast.find(c => c.id === lead.actor).sheet.stats[lead.stat];
    assert.equal(forecast.base, base);
    assert.equal(forecast.baseBonus, base + (support ? 7 : 0));
    assert.equal(forecast.potentialBonus, 0);
    assert.deepEqual(forecast.bestOdds, rollOdds(base + (support ? 7 : 0)));
    if (kind !== "prepare") assert.equal(checkForecast(shark, { hypothesis: "scent" }, kind, { support }).potentialBonus, 0);
  }
  assert.equal(checkForecast({}, { hypothesis: "scent" }, "prepare").potentialBonus, 0);
});

test("reroll forecasts enumerate all twenty outcomes of the selected die and preserve inputs", () => {
  assert.deepEqual(rerollOdds([1, 20], 3, 0), { success: 70, mixed: 30, trouble: 0 });
  assert.deepEqual(rerollOdds([1, 20], 3, 1), { success: 0, mixed: 30, trouble: 70 });
  for (const bonus of [3, 7, 10, 14]) for (let first = 1; first <= 20; first++) {
    for (let second = 1; second <= 20; second++) for (const index of [0, 1]) {
      const dice = Object.freeze([first, second]);
      const counts = { success: 0, mixed: 0, trouble: 0 };
      for (let face = 1; face <= 20; face++) {
        const session = new TrpgSession(ordinary, { seed: 1 });
        session.state.pending = { dice: [...dice], bonus, rerolled: false };
        session.die = () => face;
        counts[session.reroll(index).grade]++;
      }
      const forecast = rerollOdds(dice, bonus, index);
      for (const grade of Object.keys(counts)) assert.equal(forecast[grade], Math.round(counts[grade] * 100 / 20));
      assert.deepEqual(dice, [first, second]);
    }
  }
});

test("returned forecasts are independent and malformed roll inputs are rejected", () => {
  const forecast = checkForecast(shark, { hypothesis: "scent" }, "prepare");
  forecast.odds.success = 0;
  forecast.bestOdds.trouble = 99;
  assert.deepEqual(checkForecast(shark, { hypothesis: "scent" }, "prepare").odds, rollOdds(3));
  assert.deepEqual(checkForecast(shark, { hypothesis: "scent" }, "prepare").bestOdds, rollOdds(7));
  for (const bonus of [undefined, NaN, Infinity, "1"]) assert.throws(() => rollOdds(bonus), TypeError);
  for (const dice of [[0, 20], [1, 21], [1.5, 2], [1], null]) assert.throws(() => rerollOdds(dice, 1, 0), RangeError);
  assert.throws(() => rerollOdds([1, 6], 1, 2), RangeError);
});

test("table momentum is part of the public forecast", () => {
  const forecast = checkForecast(ordinary, { hypothesis: null, momentum: 2 }, "listen");
  assert.equal(forecast.momentum, 2); assert.equal(forecast.baseBonus, forecast.base + 8);
  assert.deepEqual(forecast.odds, rollOdds(forecast.base + 8));
});


test("a declared approach forecasts with that character's stat; unknown approaches are rejected", () => {
  const watch = checkForecast(ordinary, { hypothesis: null }, "listen", { approach: "listen_watch" });
  assert.equal(watch.base, ordinary.cast.find(c => c.id === "tsumugi").sheet.stats.eye);
  assert.equal(watch.baseBonus, watch.base);
  assert.deepEqual(watch.odds, rollOdds(watch.base));
  assert.notEqual(watch.baseBonus, checkForecast(ordinary, { hypothesis: null }, "listen").baseBonus);
  assert.throws(() => checkForecast(ordinary, { hypothesis: null }, "listen", { approach: "missing" }));
  // The hidden profile is never read for an approach forecast either.
  const hidden = { hypothesis: "scent", get profileId() { throw new Error("Hidden profile was read"); } };
  assert.equal(checkForecast(shark, hidden, "prepare", { approach: "prepare_kit" }).potentialBonus, 4);
});
