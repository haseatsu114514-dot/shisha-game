import assert from "node:assert/strict";
import test from "node:test";
import { catchesCold } from "../js/core/illness.js";
import { nextPlanAction } from "./playthrough-plan.mjs";

// The recorded DAY11 shift/drill ends at 24/100 stamina. Real calendar advanceDay
// gives a healthy DAY12 slot0, or first-illness recovery at DAY12 slot1.
// This models the remaining free-action budget, without changing the live game.
function finishDailyPlan(ill, selector = nextPlanAction) {
  let day = 12, slot = ill ? 1 : 0, planIdx = 16, lemonPurchased = false;
  const decisions = [];
  while (day < 14) {
    const action = selector({ planIdx, phase: "daily", midcheckDone: true, lemonPurchased });
    decisions.push({ day, slot, planIdx, ...action });
    if (action.item === "shop:lemon") {
      lemonPurchased = true;
      if (!action.requiredPurchase) planIdx++;
    } else {
      planIdx++;
      if (++slot === 2) { day++; slot = 0; }
    }
    assert(decisions.length < 20, "a free purchase must not repeat forever");
  }
  return { day, planIdx, lemonPurchased, decisions };
}

test("healthy DAY12 schedules required shopping before the DAY14 deadline", () => {
  const result = finishDailyPlan(catchesCold(.24, () => .99));
  assert(result.lemonPurchased);
  assert.equal(result.decisions.filter(x => x.item === "shop:lemon").length, 1);
});

test("first illness cannot push required shopping past the tournament", () => {
  assert(catchesCold(.24, () => 0));
  const result = finishDailyPlan(true);
  assert(result.lemonPurchased, JSON.stringify(result));
  const purchase = result.decisions.find(x => x.item === "shop:lemon");
  assert.deepEqual([purchase.day, purchase.slot, purchase.planIdx], [12, 1, 16]);
  assert.equal(purchase.requiredPurchase, true);
  assert.equal(result.planIdx, 19, "free shopping preserves every time-consuming action");
});

test("preparation chooses its leaf before required lemon shopping", () => {
  assert.deepEqual(nextPlanAction({ planIdx: 16, phase: "daily", midcheckDone: false, lemonPurchased: false }),
    { item: "rest", requiredPurchase: false });
});

test("confirmed shopping does not repeat or consume the next ordinary action", () => {
  assert.deepEqual(nextPlanAction({ planIdx: 16, phase: "daily", midcheckDone: true, lemonPurchased: true }),
    { item: "rest", requiredPurchase: false });
});

test("required shopping remains due even if the ordinary plan is exhausted", () => {
  assert.deepEqual(nextPlanAction({ planIdx: 100, phase: "daily", midcheckDone: true, lemonPurchased: false }),
    { item: "shop:lemon", requiredPurchase: true });
});

test("required shopping does not intrude into the tournament", () => {
  assert.deepEqual(nextPlanAction({ planIdx: 16, phase: "tournament", midcheckDone: true, lemonPurchased: false }),
    { item: "rest", requiredPurchase: false });
});
