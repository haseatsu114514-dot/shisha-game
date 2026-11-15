import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState, setState, saveToSlot, loadFromSlot, SAVE_KEY } from "../js/core/state.js";
import { advanceToChapterFour } from "../js/chapters/ch4-progress.js";
import { OVERSEAS_HEROINES, overseasCompanion, overseasCompanionCandidates, overseasSupportVisitors, overseasMaxFriend,
  canChooseOverseasCompanion, chooseOverseasCompanion, isSeparateFlightSupport } from "../js/core/overseas-companion.js";

const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) };
const storyRoutes = JSON.parse(readFileSync(new URL("../../data/story_routes.json", import.meta.url)));
// 渡航できるのは日本に住むヒロインだけ（ドバイに住むヌールは resident・DSR20）
const heroineIds = storyRoutes.heroine_ids.filter(id => !storyRoutes.romance[id].resident);
assert.deepEqual([...OVERSEAS_HEROINES], heroineIds);
assert.deepEqual(storyRoutes.heroine_ids.filter(id => storyRoutes.romance[id].resident), ["noor"]);

function atDeparture(lovers) {
  const value = newState();
  Object.assign(value, { chapter: 3, day: 40, phase: "cleared", lovers, contacts: ["sumi", ...lovers] });
  value.flags = { _ch3_cleared: true };
  assert(advanceToChapterFour(value));
  delete value.flags._ch4.routeVersion; // 旧行程（ドバイ5日）
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
// 同行0人：恋人0でも「同行なし」で進める。いつも来るつむぎ（tonariの常連・SPC17）とましろ（第3章クリア）だけが別便応援。
{
  const value = atDeparture([]), before = kept(value);
  assert.deepEqual(overseasCompanionCandidates(value), []);
  assert(!chooseOverseasCompanion(value, "tsumugi"), "非恋人は同行不可");
  assert(chooseOverseasCompanion(value, null));
  assert.deepEqual(overseasCompanion(value), { decided: true, companion: null, supports: ["tsumugi", "mashiro"] });
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
// 友人ルートの締めくくり（♥5）を済ませた友人は、別便の応援に来る（SPC17）。同行はできない。
// 締めくくり前の友人・告白を待つ恋愛ルートの相手は来ない。好感度の数値だけでは来ない。
{
  const value = atDeparture(["minto"]);
  value.affinity = { ...value.affinity, rio: 999, ageha: 999 }; // 好感度の数値だけでは来ない
  value.finales = {
    samechan: { day: 20, chapter: 2, route: "friend" },     // 友情の着地
    hiyori: { day: 21, chapter: 2, route: "romance" },      // 告白で「友達のまま」
    rio: { day: 9, chapter: 1, route: "romance" },          // 告白を待つ恋愛ルート（まだ友人ではない）
  };
  value.flags._friend_hiyori = true;
  const keptNow = kept(value);
  for (const id of ["samechan", "hiyori"]) assert(overseasMaxFriend(value, id), id);
  for (const id of ["rio", "ageha", "minto", "tsumugi", "mashiro"]) assert(!overseasMaxFriend(value, id), id);
  assert(!overseasCompanionCandidates(value).includes("samechan"), "友人は同行不可");
  assert(chooseOverseasCompanion(value, "minto"));
  assert.deepEqual(overseasCompanion(value).supports, ["tsumugi", "mashiro", "samechan", "hiyori"]);
  assert.deepEqual(kept(value), keptNow, "好感度・恋人は変えない");
}
// 恋人のつむぎを同行者にすると、つむぎは別便には入らない（同行者と重ならない）。
{
  const value = atDeparture(["tsumugi"]);
  assert(chooseOverseasCompanion(value, "tsumugi"));
  assert.deepEqual(overseasCompanion(value), { decided: true, companion: "tsumugi", supports: ["mashiro"] });
}
// 第3章を終えていない保存でも、つむぎは来る（ましろは第3章クリアが条件のまま）。
{
  const value = atDeparture([]);
  value.flags._ch3_cleared = false;
  assert.deepEqual(overseasSupportVisitors(value), ["tsumugi"]);
}
// 通常訪問の予約競合：出発時に未了の予約は渡航のため終了。好感度・申し出は触れない。
{
  const value = atDeparture(["tsumugi", "minto"]);
  value.tokyoVisits.plans.push({ id: "tokyo.minto.41", characterId: "minto", arrivalDay: 41, returnDay: 44, status: "booked",
    meetup: { id: "m", day: 41, slot: 0 }, date: { id: "d", day: 42, slot: 0 }, met: false, dateDone: false });
  value.tokyoVisits.offers.rio = { day: 41 };
  const before = kept(value), offers = structuredClone(value.tokyoVisits.offers);
  assert(chooseOverseasCompanion(value, "tsumugi"));
  assert(value.tokyoVisits.plans.every(plan => plan.status === "returned"));
  assert.equal(value.tokyoVisits.plans[0].returnReason, "overseas_departure");
  assert.deepEqual(value.tokyoVisits.offers, offers);
  assert.deepEqual(kept(value), before);
}
// 壊れた保存値は未選択に戻る（同行者が応援に重複・不正IDなど）。
for (const raw of [{ decided: true, companion: "x", supports: [] }, { decided: true, companion: "rio", supports: ["rio"] },
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
