// ひよりの居合わせを、地図・来店と同じ抽選と休業判定で確かめる。
import assert from "node:assert/strict";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const { newGame } = await import("../js/core/state.js");
const { roamerPlan } = await import("../js/daily/roamers.js");
const { isClosed, spotById } = await import("../js/daily/spots.js");

const state = newGame();
Object.assign(state, { chapter: 2, day: 12, slot: 0, phase: "daily" });
state.met.hiyori = true;
state.flags._ch2_night_11_done = true;
const naru = spotById("naru");
function plans() {
  const found = [];
  for (let seed = 0; seed < 128; seed++) {
    state.seed = seed;
    const plan = roamerPlan();
    if (plan) found.push(plan);
  }
  return found;
}
assert(isClosed(naru));
const before = plans();
assert(before.length && before.every(plan => plan.spotId !== "naru"), "決裂後、休業中の店には居合わせない");

state.chapter = 5;
state.flags._hiyori_tonari_return_done = true;
assert(!isClosed(naru));
assert(plans().some(plan => plan.id === "hiyori" && plan.spotId === "naru"), "再開した店にひよりが居合わせる");
state.day = 17; // KEMURIYAの定休日
assert(isClosed(naru));
assert(plans().every(plan => plan.spotId !== "naru"));
console.log("[roamers] PASS: KEMURIYA before and after reopening, and on its day off");
