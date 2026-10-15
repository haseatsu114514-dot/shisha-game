import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../js/trpg/feedback.js", import.meta.url), "utf8");
const { rollOdds, checkForecast, rerollOdds } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const sessionSource = await readFile(new URL("../js/trpg/session.js", import.meta.url), "utf8");
const { TrpgSession } = await import("data:text/javascript;base64," + Buffer.from(sessionSource).toString("base64"));
const ordinary = JSON.parse(await readFile(new URL("../../data/dialogue/trpg_ordinary.json", import.meta.url), "utf8"));
const shark = JSON.parse(await readFile(new URL("../../data/dialogue/trpg_shark.json", import.meta.url), "utf8"));

test("2d6 forecasts match all 36 real checks at every supported bonus", () => {
  const expected = [
    { success: 28, mixed: 44, trouble: 28 },
    { success: 42, mixed: 42, trouble: 17 },
    { success: 58, mixed: 33, trouble: 8 },
    { success: 72, mixed: 25, trouble: 3 },
  ];
  for (let bonus = 1; bonus <= 4; bonus++) {
    const counts = { success: 0, mixed: 0, trouble: 0 };
    for (let first = 1; first <= 6; first++) for (let second = 1; second <= 6; second++) {
      const session = new TrpgSession(ordinary, { seed: 1 });
      session.state.pending = { dice: [first, second], bonus };
      counts[session.checkResult().grade]++;
    }
    assert.deepEqual(rollOdds(bonus), expected[bonus - 1]);
    for (const grade of Object.keys(counts)) {
      assert.equal(rollOdds(bonus)[grade], Math.round(counts[grade] * 100 / 36));
    }
  }
  assert.deepEqual(rollOdds(-12), { success: 0, mixed: 0, trouble: 100 });
  assert.deepEqual(rollOdds(8), { success: 100, mixed: 0, trouble: 0 });
});

test("forecast cannot reveal whether a hypothesis matches the hidden profile", () => {
  const correct = { hypothesis: "scent", profileId: "scent" };
  const incorrect = { hypothesis: "scent", profileId: "light" };
  const before = structuredClone({ correct, incorrect, shark });
  for (const support of [false, true]) {
    const a = checkForecast(shark, correct, "prepare", { support });
    assert.deepEqual(a, checkForecast(shark, incorrect, "prepare", { support }));
    assert.equal(a.baseBonus, support ? 3 : 1);
    assert.equal(a.potentialBonus, 1);
    assert.deepEqual(a.odds, rollOdds(a.baseBonus));
    assert.deepEqual(a.bestOdds, rollOdds(a.baseBonus + 1));
  }
  assert.deepEqual({ correct, incorrect, shark }, before);
  const hiddenState = { hypothesis: "scent", get profileId() { throw new Error("Hidden profile was read"); } };
  const publicScenario = { rules: shark.rules, get profiles() { throw new Error("Hidden profiles were read"); } };
  assert.equal(checkForecast(publicScenario, hiddenState, "prepare").potentialBonus, 1);
});

test("unconfirmed hypotheses and other phases have no conditional bonus; support adds two", () => {
  for (const hypothesis of [null, undefined, ""]) {
    const forecast = checkForecast(shark, { hypothesis }, "prepare");
    assert.equal(forecast.potentialBonus, 0);
    assert.deepEqual(forecast.odds, forecast.bestOdds);
  }
  for (const kind of ["listen", "prepare", "serve"]) for (const support of [false, true]) {
    const forecast = checkForecast(ordinary, { hypothesis: "quiet" }, kind, { support });
    assert.equal(forecast.baseBonus, support ? 3 : 1);
    assert.equal(forecast.potentialBonus, 0);
    assert.deepEqual(forecast.bestOdds, rollOdds(support ? 3 : 1));
    if (kind !== "prepare") assert.equal(checkForecast(shark, { hypothesis: "scent" }, kind, { support }).potentialBonus, 0);
  }
  assert.equal(checkForecast({}, { hypothesis: "scent" }, "prepare").potentialBonus, 0);
});

test("reroll forecasts enumerate all six outcomes of the selected die and preserve inputs", () => {
  assert.deepEqual(rerollOdds([1, 6], 1, 0), { success: 67, mixed: 33, trouble: 0 });
  assert.deepEqual(rerollOdds([1, 6], 1, 1), { success: 0, mixed: 33, trouble: 67 });
  for (let bonus = 1; bonus <= 4; bonus++) for (let first = 1; first <= 6; first++) {
    for (let second = 1; second <= 6; second++) for (const index of [0, 1]) {
      const dice = Object.freeze([first, second]);
      const counts = { success: 0, mixed: 0, trouble: 0 };
      for (let face = 1; face <= 6; face++) {
        const session = new TrpgSession(ordinary, { seed: 1 });
        session.state.pending = { dice: [...dice], bonus, rerolled: false };
        session.die = () => face;
        counts[session.reroll(index).grade]++;
      }
      const forecast = rerollOdds(dice, bonus, index);
      for (const grade of Object.keys(counts)) assert.equal(forecast[grade], Math.round(counts[grade] * 100 / 6));
      assert.deepEqual(dice, [first, second]);
    }
  }
});

test("returned forecasts are independent and malformed roll inputs are rejected", () => {
  const forecast = checkForecast(shark, { hypothesis: "scent" }, "prepare");
  forecast.odds.success = 0;
  forecast.bestOdds.trouble = 99;
  assert.deepEqual(checkForecast(shark, { hypothesis: "scent" }, "prepare").odds, rollOdds(1));
  assert.deepEqual(checkForecast(shark, { hypothesis: "scent" }, "prepare").bestOdds, rollOdds(2));
  for (const bonus of [undefined, NaN, Infinity, "1"]) assert.throws(() => rollOdds(bonus), TypeError);
  for (const dice of [[0, 6], [1, 7], [1.5, 2], [1], null]) assert.throws(() => rerollOdds(dice, 1, 0), RangeError);
  assert.throws(() => rerollOdds([1, 6], 1, 2), RangeError);
});
