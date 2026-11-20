// Public map and actual action functions, with presentation/other shops replaced by ports.
// node remake/test/ch4_longlong_free.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/chapters/ch4-dubai-daily.js", import.meta.url), "utf8");
const spotSource = source.slice(source.indexOf("const spotNow ="), source.indexOf("/** 今の時間・物語の時点で地図に出す行き先。 */"));
const actionSource = source.slice(source.indexOf("async function performDubaiSpot("), source.indexOf("/**\n * ラクダレース。"));
assert(spotSource && actionSource, "read actual production functions");
const entry = Object.freeze({ id: "ch4_dubai_longlong", region: "dubai", place: "longlong", kind: "ch4_dubai", cost: 6000, stamina: -12, stat: "insight" });
let due = true, cancel = false, switchOnBg = false, night = null, bondAfter = null, bondAfterLoad = true, bondAfterMarked = [];
let payments = [], stamina = [], learned = [], played = [], guards = [];
const state = money => ({ money, flags: {}, finales: {}, stamina: 100 });
const context = vm.createContext({
  CH4_DUBAI_SPOTS: [entry],
  state: state(0), DUBAI: "dubai", LONGLONG_CHAR: "master_hookah", LONGLONG_BG: "bg_longlong_shop",
  unused: { used: false, exerted: false },
  dubaiSpotAt: e => ({ ...e }),
  finaleAtVisit: () => due && !context.state.finales.master_hookah,
  syncChapterFourDay: () => {}, spendableMoney: s => s.money,
  toast: () => {}, priceText: n => String(n), nightVisit: () => night,
  readNight: async () => true, bgUrl: x => x,
  setBg: async () => { if (switchOnBg) context.state = state(99); },
  playFinale: async () => { played.push("finale"); if (cancel) return false; context.state.finales.master_hookah = { route: "friend" }; return true; },
  addMoney: n => { payments.push(n); context.state.money += n; },
  addStamina: n => { stamina.push(n); context.state.stamina += n; },
  earnStat: (...v) => learned.push(v),
  affinityLevel: () => 5, nextLonglongVisit: () => ({ id: "ordinary", kind: "talk" }),
  readPlain: async id => { played.push(id); return true; },
  recordLonglongVisit: s => { s.flags.talks = (s.flags.talks || 0) + 1; },
  recordNightVisit: () => {}, gainAffinity: () => {}, visitAffinity: () => 8,
  STALL_PLACE: "souq", consultLessons: () => {},
  // ♥5後の会話（#3693）: 対象外なら null。読めた場面の記録を見る
  DB: { dialogues: {} }, bondAfterNext: (s, id) => id === "master_hookah" ? bondAfter : null,
  loadBondAfterScenes: async () => { if (!bondAfterLoad) throw new Error("offline"); },
  markBondAfterRead: (s, id, next) => { if (next) bondAfterMarked.push([id, next.scene]); },
  // 通いの続き（#4010）はこの検査では開かない（龍龍水煙所での再生は visit_chains_wiring.mjs）
  chainVisitDue: async () => null, playChainStage: async () => false,
});
vm.runInContext(`${spotSource}\n${actionSource}\nthis.mapSpot = spotNow; this.perform = performDubaiSpot;`, context);
const reset = money => {
  context.state = state(money); due = true; cancel = false; switchOnBg = false; night = null;
  payments = []; stamina = []; learned = []; played = []; guards = []; bondAfter = null; bondAfterLoad = true; bondAfterMarked = [];
};
const run = e => context.perform(e, {}, { staminaGuard: async n => { guards.push(n); return true; } });
for (const money of [0, 5999, 6000]) {
  reset(money);
  const mapped = context.mapSpot(entry);
  assert.equal(mapped.cost, 0, "free finale is reachable through the map affordability gate");
  assert.equal(entry.cost, 6000, "catalog definition remains paid");
  assert.equal((await run(entry)).used, true, "stale paid map entry is re-evaluated at execution");
  assert.equal(context.state.money, money);
  assert.deepEqual(payments, []);
  assert.deepEqual(stamina, [-12]); assert.deepEqual(guards, [-12]);
  assert.equal(played.filter(id => id === "finale").length, 1);
  assert.equal(context.mapSpot(entry).cost, 6000, "read finale does not make future drinks free");
  // SAVE/LOAD shape preserves the consumed finale, without a new schema or marker.
  context.state = JSON.parse(JSON.stringify(context.state));
  if (money < 6000) {
    assert.equal((await run(mapped)).used, false, "stale free entry must not bypass the ordinary price after reload");
    assert.equal(context.state.money, money);
  } else {
    assert.equal((await run(mapped)).used, true);
    assert.deepEqual(payments, [-6000]); assert.equal(context.state.money, 0);
    assert.equal(played.filter(id => id === "finale").length, 1);
  }
}
for (const money of [0, 5999, 6000]) {
  reset(money); due = false;
  assert.equal(context.mapSpot(entry).cost, 6000);
  assert.equal((await run(entry)).used, money >= 6000);
  assert.equal(context.state.money, money >= 6000 ? money - 6000 : money);
}
reset(0); cancel = true;
assert.equal((await run(entry)).used, false);
assert.equal(context.state.money, 0); assert.deepEqual(payments, []); assert.deepEqual(stamina, []);
assert.equal(context.mapSpot(entry).cost, 0, "cancel leaves free finale available");
reset(0); switchOnBg = true;
assert.equal((await run(entry)).used, false);
assert.equal(context.state.money, 99); assert.deepEqual(payments, []); assert.deepEqual(stamina, []);
// #3693: 締めくくりの後は、小会話の代わりに♥5後の場面。代金・体力は小会話と同じで、小会話の巡回は進めない
reset(6000); due = false; bondAfter = { kind: "story", scene: "bond_after_master_hookah_2" };
assert.equal((await run(entry)).used, true);
assert.deepEqual(played, ["bond_after_master_hookah_2"]); assert.deepEqual(payments, [-6000]);
assert.deepEqual(bondAfterMarked, [["master_hookah", "bond_after_master_hookah_2"]]); assert.equal(context.state.flags.talks, undefined);
reset(6000); due = false; bondAfter = { kind: "short", scene: "bond_after_master_hookah_short_a" }; bondAfterLoad = false;
assert.equal((await run(entry)).used, true);
assert.deepEqual(played, ["ordinary"], "unreadable bond-after scripts fall back to the ordinary talk");
assert.deepEqual(bondAfterMarked, []); assert.equal(context.state.flags.talks, 1);
console.log("longlong free finale: map, execution, 0/5999/6000 yen, stale entry, read record roundtrip, normal visit, cancel and state switch, bond-after talk passed");
