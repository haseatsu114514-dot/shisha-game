import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState, setState, saveToSlot, loadFromSlot, SAVE_KEY } from "../js/core/state.js";
import { advanceToChapterFour } from "../js/chapters/ch4-progress.js";
import { OVERSEAS_HEROINES, overseasCompanion, overseasCompanionCandidates, overseasSupportVisitors,
  canChooseOverseasCompanion, chooseOverseasCompanion, isSeparateFlightSupport } from "../js/core/overseas-companion.js";

const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) };
const heroineIds = JSON.parse(readFileSync(new URL("../../data/story_routes.json", import.meta.url))).heroine_ids;
assert.deepEqual([...OVERSEAS_HEROINES], heroineIds);

function atDeparture(lovers) {
  const value = newState();
  Object.assign(value, { chapter: 3, day: 40, phase: "cleared", lovers, contacts: ["sumi", ...lovers] });
  value.flags = { _ch3_cleared: true };
  assert(advanceToChapterFour(value));
  return value;
}
const keptKeys = ["lovers", "contacts", "loverSince", "loveLevel", "lovePts", "affinity", "guilt", "money", "stamina"];
const kept = value => Object.fromEntries(keptKeys.map(key => [key, structuredClone(value[key])]));

// 旧セーブ（キー無し）は未選択＝同行なし、選択画面を出す。
{
  const value = atDeparture(["tsumugi"]);
  assert.deepEqual(overseasCompanion(value), { decided: false, companion: null, supports: [] });
  assert(canChooseOverseasCompanion(value));
}
// 同行0人：恋人0でも「同行なし」で進める。ましろだけが別便応援。
{
  const value = atDeparture([]), before = kept(value);
  assert.deepEqual(overseasCompanionCandidates(value), []);
  assert(!chooseOverseasCompanion(value, "tsumugi"), "非恋人は同行不可");
  assert(chooseOverseasCompanion(value, null));
  assert.deepEqual(overseasCompanion(value), { decided: true, companion: null, supports: ["mashiro"] });
  assert.deepEqual(kept(value), before);
  assert(!canChooseOverseasCompanion(value) && !chooseOverseasCompanion(value, null), "決定後は変更不可");
}
// 同行1人＋複数交際：他の恋人は別便応援、同行者とは重ならない。好感度は不変。
{
  const value = atDeparture(["tsumugi", "minto", "samechan"]), before = kept(value);
  assert(chooseOverseasCompanion(value, "samechan"));
  const choice = overseasCompanion(value);
  assert.equal(choice.companion, "samechan");
  assert.deepEqual(choice.supports, ["tsumugi", "minto", "mashiro"]);
  assert(!choice.supports.includes(choice.companion));
  assert(isSeparateFlightSupport(value, "minto") && !isSeparateFlightSupport(value, "samechan"));
  assert.deepEqual(kept(value), before);
}
// サメちゃんは友人なら同行不可。別便にも来ない（恋人ではない）。
{
  const value = atDeparture(["tsumugi"]);
  assert(!overseasCompanionCandidates(value).includes("samechan"));
  assert(!chooseOverseasCompanion(value, "samechan"));
  assert(!overseasCompanion(value).decided);
  assert(chooseOverseasCompanion(value, "tsumugi"));
  assert(!overseasCompanion(value).supports.includes("samechan"));
}
// 通常訪問の予約競合：出発時に未了の予約は渡航のため終了。好感度・申し出は触れない。
{
  const value = atDeparture(["tsumugi", "minto"]);
  value.tokyoVisits.plans.push({ id: "tokyo.minto.41", characterId: "minto", arrivalDay: 41, returnDay: 44, status: "booked",
    meetup: { id: "m", day: 41, slot: 0 }, date: { id: "d", day: 42, slot: 0 }, met: false, dateDone: false });
  value.tokyoVisits.offers.rin = { day: 41 };
  const before = kept(value), offers = structuredClone(value.tokyoVisits.offers);
  assert(chooseOverseasCompanion(value, "tsumugi"));
  assert(value.tokyoVisits.plans.every(plan => plan.status === "returned"));
  assert.equal(value.tokyoVisits.plans[0].returnReason, "overseas_departure");
  assert.deepEqual(value.tokyoVisits.offers, offers);
  assert.deepEqual(kept(value), before);
}
// 壊れた保存値は未選択に戻る（同行者が応援に重複・不正IDなど）。
for (const raw of [{ decided: true, companion: "x", supports: [] }, { decided: true, companion: "rin", supports: ["rin"] },
  { decided: true, companion: null, supports: "mashiro" }, "bad", null]) {
  const value = atDeparture([]);
  value.flags._overseas_companion = raw;
  assert.equal(overseasCompanion(value).decided, false);
}
// SAVE/LOAD：4つのセーブ枠で選択が残る。
{
  const value = atDeparture(["tsumugi", "minto"]);
  assert(chooseOverseasCompanion(value, "minto"));
  setState(value);
  for (const key of [SAVE_KEY, "suien_remake_slot1", "suien_remake_slot2", "suien_remake_slot3"]) {
    assert(saveToSlot(key));
    assert.deepEqual(overseasCompanion(loadFromSlot(key)), overseasCompanion(value));
  }
}
console.log("overseas_companion OK");
