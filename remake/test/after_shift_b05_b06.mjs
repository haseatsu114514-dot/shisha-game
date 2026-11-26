import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

// #1081 B05/B06 の分岐検証。
// B05: シフト上がりのスミ会話は必須。固有会話がある日は visitChar("sumi")、
//      無い日は定型の一言（remake_sumi_after_shift）。メニューに選択肢は残らない。
// B06: 斧投げの露出は _axe_throw_unlocked のみで決まる。フラグは「ひより前提
//      （axe_reveal の時間・費用を除く前提）を満たした後の最初のバイト上がり」で立つ。
// 実 tonari.js / hiyori-axe.js / hiyori-route.js / spot-encounters.js と実ルート定義を使い、
// 周辺モジュールだけを差し替える。

const root = new URL("../../", import.meta.url);
const read = (path) => fs.readFile(new URL(path, root), "utf8");

const hiyoriData = JSON.parse(await read("data/dialogue/hiyori.json"));

let state = {};
const db = {
  dialogues: Object.fromEntries((hiyoriData.dialogues || []).map((s) => [s.dialogue_id, s])),
  hiyori: hiyoriData,
  flavorById: {},
};

const plays = [], visitCalls = [], screens = [];
let storyReady = false, menuPick = "after-none";
let hudListener, loadAt, cancelAt, floorOutcome;
function loadSave() {
  state = { flags: {}, visitedDay: {} };
  stateModule.setExport("state", state);
  hudListener();
}

function el(tag, props = {}, children = []) {
  if (Array.isArray(props)) { children = props; props = {}; }
  const [name, ...classes] = String(tag).split(".");
  const node = { tag: name, classes, children: [], dataset: {}, text: "" };
  for (const [key, value] of Object.entries(props || {})) {
    if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "text") node.text = String(value);
    else node[key] = value;
  }
  node.children = (Array.isArray(children) ? children : [children]).flat(9)
    .filter((child) => child !== null && child !== undefined && child !== false);
  return node;
}
function find(node, test) {
  if (!node || typeof node !== "object") return null;
  if (node.dataset?.test === test) return node;
  for (const child of node.children || []) { const hit = find(child, test); if (hit) return hit; }
  return null;
}
function texts(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.text) out.push(node.text);
  for (const child of node.children || []) texts(child, out);
  return out;
}
// 本物の stats.js と同じ閾値（AFFINITY_RANK_PTS = [0, 9, 20, 33, 48, 66]）
const affinityLevel = (id) => {
  if ((state.lovers || []).includes(id)) return 5;
  const pts = state.affinity?.[id] || 0;
  let lv = 0;
  for (let i = 1; i < 6; i++) if (pts >= [0, 9, 20, 33, 48, 66][i]) lv = i;
  return lv;
};

const instances = new Map();
function synthetic(name, exportsObj) {
  const keys = Object.keys(exportsObj);
  const mod = new vm.SyntheticModule(keys, function () {
    for (const key of keys) this.setExport(key, exportsObj[key]);
  }, { identifier: name });
  instances.set(name, mod);
  return mod;
}
// 遅延 import（まかない練習の runner など）も同じ差し替え表から返す。
async function dynamicModule(spec) {
  const mod = instances.get(spec.split("/").pop());
  if (!mod) throw new Error(`Unexpected dynamic import: ${spec}`);
  if (mod.status === "unlinked") await mod.link(() => { throw new Error(`Unexpected import in ${spec}`); });
  if (mod.status === "linked") await mod.evaluate();
  return mod;
}
async function realModule(name, path) {
  if (instances.has(name)) return instances.get(name);
  const mod = new vm.SourceTextModule(await read(path), { identifier: name, importModuleDynamically: dynamicModule });
  instances.set(name, mod);
  await mod.link((spec) => instances.get(spec.split("/").pop()));
  await mod.evaluate();
  return mod;
}

await realModule("travel-budget.js", "remake/js/core/travel-budget.js");
await realModule("shift-pay.js", "remake/js/core/shift-pay.js");
await realModule("stat-step-tables.js", "remake/js/core/stat-step-tables.js");
await realModule("chapter-features.js", "remake/js/core/chapter-features.js");

synthetic("util.js", { el, pick: (list) => list[0] });
synthetic("data.js", { DB: db, bgUrl: (id) => id });
const stateModule = synthetic("state.js", { state, config: { statEffectColors: true }, timeOfDay: () => "day" });
synthetic("stats.js", {
  addMoney: (amount) => { state.money += amount; }, addStamina() {}, applyStats() {}, step: () => 1,
  currentCondition: () => ({ bonusRate: 1.15, shiftBonus: 1000, health: "green" }), affinityLevel,
});
synthetic("ui.js", {
  showScreen: (name, node) => {
    screens.push({ name, node });
    queueMicrotask(() => {
      if (loadAt === "menu") loadSave();
      else find(node, menuPick)?.onclick?.();
    });
    node.remove = () => { node.removed = true; };
    return node;
  },
  setBg() {}, toast() {}, retire() {},
});
synthetic("audio.js", { SE: new Proxy({}, { get: () => () => {} }), playBgm() {}, currentBgm: () => null });
synthetic("bus.js", { on: (_, fn) => { hudListener = fn; return () => { hudListener = null; }; } });
synthetic("axe.js", { runAxeThrow: async () => {} });
synthetic("engine.js", {
  play: async (scene, { signal } = {}) => {
    const id = typeof scene === "string" ? scene : scene?.dialogue_id || scene?.id;
    plays.push(id);
    if (id === loadAt) { assert(signal); loadSave(); assert(signal.aborted); }
    if (id === cancelAt) return { cancelled: true };
    return { id, visited: [] };
  },
  dialogueSequence: async (fn) => fn(),
});
synthetic("spots.js", {
  visitChar: async (id) => { visitCalls.push(id); return true; },
  hasNewStory: () => storyReady,
});
synthetic("fortune-rumor.js", { hearFortuneRumor: async () => false });
synthetic("session.js", { DRILLS: {} });
synthetic("weather.js", { isRainy: () => false });
// 店番（フロア営業・TFL62）の画面は差し替える。チュートリアルはすぐ済み、営業は floorOutcome を返す（null＝途中で LOAD・中断）
synthetic("tonari-floor-view.js", {
  runTonariFloor: async (opts) => (opts.tutorial ? { tutorial: true, skipped: false } : floorOutcome),
  FLOOR_VISITORS: {},
});
synthetic("scene-motions.js", { shiftClose: async () => {} });
synthetic("hiyori.js", { meetHiyoriAtTonari: async () => {} });
synthetic("attack-lesson.js", { canStudyAttack: () => false, studyAttack: async () => {} });
synthetic("coal-lesson.js", { canStudyCubeCoals: () => false, studyCubeCoals: async () => {} });
synthetic("growth.js", { readyLessons: () => [], consultLessons: async () => [] });
synthetic("growth-effects.js", { growthPerks: () => null, callingSalesBonus: () => 0, growthSkill: () => false, SKILL_TUNING: { baitoPay: .1 } }); // 盤のスキル（仕事が早い）は無しで検査する
synthetic("tsumugi-schedule.js", { tsumugiAtTonari: () => false });
synthetic("flavor-mastery.js", { staffFlavors: () => [], staffStock: () => 0 });
synthetic("axe-bar-discovery.js", { hiyoriFirstMeetingReady: () => false });
const practiceRuns = [];
synthetic("practice.js", { runFullPractice: async (opts) => {
  practiceRuns.push(opts);
  if (loadAt === "practice") {
    queueMicrotask(loadSave);
    return new Promise(() => {});
  }
  return { masteryGained: true };
} });

// ♥5の締めくくりの後の会話（#3693）は実 bond-after.js。台本の読み込みだけ差し替える（読めない日を作れる）
let bondAfterLoadFails = false;
synthetic("chapter-data.js", { readDialogues: async (name, ids) => {
  if (bondAfterLoadFails) throw new Error("offline");
  return Object.fromEntries(ids.map((id) => [id, { dialogue_id: id, lines: [{ speaker: "sumi", face: "normal", text: id }] }]));
} });
await realModule("bond-after.js", "remake/js/core/bond-after.js");
await realModule("spot-encounters.js", "remake/js/daily/spot-encounters.js");
await realModule("hiyori-route.js", "remake/js/core/hiyori-route.js");
const axe = (await realModule("hiyori-axe.js", "remake/js/daily/hiyori-axe.js")).namespace;
const tonari = (await realModule("tonari.js", "remake/js/daily/tonari.js")).namespace;

const AXE_PREREQ_FLAGS = {
  _hiyori_cracks_done: true, _hiyori_tonari_return_done: true,
  _hiyori_tonari_followup_done: true, _hiyori_tonari_afterwork_done: true,
};
const PREREQ_STATE = { met: { hiyori: true }, affinity: { hiyori: 40 }, flags: { ...AXE_PREREQ_FLAGS } };

function reset(overrides = {}) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, {
    chapter: 1, day: 2, slot: 1, stamina: 74, money: 5000,
    flags: {}, met: {}, story: {}, affinity: {},
    usedBaito: [], baitoRecent: [], baitoCount: 0, best: {},
    visits: {}, contacts: [], visitedDay: {}, lovers: [], loveLevel: {}, finales: {}, spotVisits: {},
  }, structuredClone(overrides));
  plays.length = 0; visitCalls.length = 0; screens.length = 0;
  storyReady = false; menuPick = "after-none";
  loadAt = null; cancelAt = null; floorOutcome = { rank: "B", stamp: "まずまず", fans: 1, sales: 12000 };
}

// --- B05: 固有会話がある日は visitChar、無い日は定型の一言 ---
reset(); storyReady = true;
await tonari.doBaito();
assert.deepEqual(visitCalls, ["sumi"], "固有会話がある日は visitChar(\"sumi\") が必須で流れる");
assert(!plays.includes("remake_sumi_after_shift"), "固有会話がある日は定型の一言にしない");

reset(); storyReady = false;
await tonari.doBaito();
assert.deepEqual(visitCalls, [], "固有会話が無い日は visitChar を呼ばない（二重再生なし）");
assert.equal(plays.filter((id) => id === "remake_sumi_after_shift").length, 1, "定型の一言が1回だけ流れる");
const afterMenuTexts = texts(screens.at(-1).node);
assert(!afterMenuTexts.includes("スミさんと話す"), "シフト上がりメニューにスミ会話の選択肢は無い");
assert(afterMenuTexts.includes("まっすぐ上がる"), "特訓・授業以外の締めの選択肢は残る");
assert(afterMenuTexts.some((text) => text.includes("1つだけ")));

// --- #3693: スミさんの締めくくりを友人として迎えた後は、定型の一言の代わりに♥5後の場面を一度ずつ。読み終えたら短い汎用 ---
{
  const friend = { finales: { sumi: { day: 9, chapter: 1, route: "friend" } } };
  reset(friend);
  await tonari.doBaito();
  assert.deepEqual(plays.filter((id) => /sumi_after_shift|bond_after_sumi/.test(id)), ["bond_after_sumi_2"],
    "素焼きを持っていなければ一本目（素焼きの回収）を飛ばし、定型の一言は出さない");
  assert.deepEqual(state.flags._bond_after.sumi, ["bond_after_sumi_2"], "読み終えた場面を記録する");
  reset({ ...friend, owned: ["suyaki_sumi"], flags: { _bond_after: { sumi: ["bond_after_sumi_2"] } } });
  await tonari.doBaito();
  assert(plays.includes("bond_after_sumi_1"), "素焼きを持っていれば一本目を読む");
  reset({ ...friend, owned: ["suyaki_sumi"], flags: { _bond_after: { sumi: [1, 2, 3, 4, 5].map((n) => `bond_after_sumi_${n}`) } } });
  await tonari.doBaito();
  assert(plays.includes("bond_after_sumi_short_a") && !plays.includes("remake_sumi_after_shift"), "5本の後は短い汎用");
  assert.equal(state.flags._bond_after.sumi_short, 1);
  reset(friend); storyReady = true;
  await tonari.doBaito();
  assert.deepEqual(visitCalls, ["sumi"], "固有会話がある日はそちらが先（♥5後の場面は次の上がりへ）");
  assert.equal(state.flags._bond_after, undefined);
  for (const id of Object.keys(db.dialogues)) if (id.startsWith("bond_after_")) delete db.dialogues[id];
  reset(friend); bondAfterLoadFails = true;
  await tonari.doBaito();
  bondAfterLoadFails = false;
  assert(plays.includes("remake_sumi_after_shift"), "台本を読めない日は定型の一言");
  assert.equal(state.flags._bond_after, undefined, "読めなかった場面は既読にしない");
  reset({ finales: { sumi: { day: 9, chapter: 1, route: "romance" } }, lovers: ["sumi"] });
  await tonari.doBaito();
  assert(plays.includes("remake_sumi_after_shift"), "友人ルート以外は定型の一言のまま");
}

// --- #2213 B04: まかない練習はシフト上がりで選んだ日だけ。選ばなければ練習しない ---
assert(afterMenuTexts.includes("まかないで練習"), "シフト上がりでまかない練習を選べる");
assert.equal(practiceRuns.length, 0, "選ばなかった日は練習しない");
assert.equal(state.visitedDay.tonari_practice, undefined);
reset(); menuPick = "after-makanai";
await tonari.doBaito();
assert.equal(practiceRuns.length, 1, "選んだ日は一台だけ作る");
assert.equal(practiceRuns[0].staffPractice, true, "旧・独立コマンドと同じまかないの runner で熟練度を育てる");
assert.equal(practiceRuns[0].kind, "self");
assert.equal(plays.filter((id) => id === "remake_staff_practice").length, 1);
assert.equal(state.visitedDay.tonari_practice, 2, "同じ日の苺・まかないとの重複判定に使う記録");
menuPick = "after-none";
const screenCount = screens.length;
await tonari.doBaito();
assert.equal(screens.length, screenCount, "まっすぐ上がる以外に選択肢がなければメニューを出さない");
assert.equal(practiceRuns.length, 1);
practiceRuns.length = 0;

// --- B06: 前提を満たすまでは露出しない ---
reset({ ...PREREQ_STATE, flags: {} });
assert.equal(axe.hiyoriAxePrereqsMet(), false, "requires 未達では前提を満たさない");
await tonari.doBaito();
assert(!state.flags._axe_throw_unlocked, "前提未達のバイト上がりでは露出フラグは立たない");
assert(!plays.includes("remake_sumi_axe_hint"), "前提未達では露出ヒントは流れない");

// --- B06: 前提を満たした後の最初のバイト上がりで一度だけ露出 ---
reset(PREREQ_STATE);
assert.equal(axe.hiyoriAxePrereqsMet(), true, "実ルート定義で前提充足を判定できる");
assert.equal(axe.hiyoriAxeReady(), true, "夜スロットでは従来どおり ready");
await tonari.doBaito();
assert.equal(plays.filter((id) => id === "remake_sumi_axe_hint").length, 1, "最初のバイト上がりで露出ヒントが流れる");
assert.equal(state.flags._axe_throw_unlocked, true, "露出フラグが立つ");
assert.equal(axe.axeThrowExposed(), true);
plays.length = 0;
await tonari.doBaito();
assert(!plays.includes("remake_sumi_axe_hint"), "露出ヒントは一度だけ（次のバイト上がりでは流れない）");

// pack14 B-04/B-05: LOAD で旧シフトを閉じ、同一セーブでの会話・注文中断も続行しない。
for (const scene of ["ch1_ageha_encounter", "remake_sumi_after_shift", "remake_sumi_axe_hint", "menu", "remake_staff_practice"]) {
  reset({ ...PREREQ_STATE, day: 4 });
  db.dialogues.ch1_ageha_encounter = { lines: [] };
  loadAt = scene;
  menuPick = "after-makanai";
  assert.equal(await tonari.doBaito(), false, scene);
  assert.deepEqual(state.flags, {}, scene);
  assert.deepEqual(state.visitedDay, {}, scene);
  assert.equal(practiceRuns.length, 0, scene);
  if (scene === "menu") assert(screens.at(-1).node.removed);
}
reset();
loadAt = "practice";
menuPick = "after-makanai";
assert.equal(await tonari.doBaito(), false, "作業台が入力待ちでも LOAD でシフトは解ける");
assert.equal(practiceRuns.at(-1).isCurrent(), false);
assert.deepEqual(state.visitedDay, {});
for (const [scene, flag, flags] of [
  ["ch1_kuraudo_cameo", "_ev_kuraudo_cameo", {}],
  ["ch1_reviewer_cameo", "_ev_reviewer_cameo", { _ev_kuraudo_cameo: true }],
  ["ch1_uezono_cameo", "_ev_uezono_cameo", { _ev_kuraudo_cameo: true, _ev_reviewer_cameo: true }],
]) {
  reset({ day: 6, baitoCount: 3, flags });
  cancelAt = scene;
  assert.equal(await tonari.doBaito(), false);
  assert(plays.includes(scene));
  assert.equal(state.flags[flag], undefined);
}
reset({ slot: 0 });
floorOutcome = null; // 店番の途中で止まった
assert.equal(await tonari.doBaito(), false);
assert(!plays.includes("remake_baito_end"));
assert.equal(state.slot, 0, "止まったシフトは、出勤前の時間帯（昼）のまま");
assert.equal(state.money, 5000, "中断では支給しない");
// 店番は昼から夜まで（TFL62）: 済んだら、上がりの場面からは夜。はじめての店番は、スミさんの前振りとチュートリアルの後
reset({ slot: 0 });
assert.equal(await tonari.doBaito(), true);
assert.equal(state.slot, 1, "上がりは夜の店");
assert.equal(state.money, 15200, "基本給8,000円＋歩合1,200円＋好調1,000円を入金する");
assert.equal(state.flags._tonari_floor_tutorial, true);
assert.deepEqual(state.flags._tonari_floor, { nights: 1, best: "B", fans: 1, top: 12000 });
assert(plays.indexOf("tonari_floor_first") > plays.indexOf("remake_baito_start") && plays.indexOf("remake_baito_end") > plays.indexOf("tonari_floor_first"));

// --- B06: 露出判定はスロットに依存しない（昼のバイト上がりでも露出する） ---
reset({ ...PREREQ_STATE, slot: 0 });
assert.equal(axe.hiyoriAxeReady(), false, "昼は時間条件で ready にならない");
assert.equal(axe.hiyoriAxePrereqsMet(), true, "前提そのものはスロット非依存で満たしている");
await tonari.doBaito();
assert.equal(state.flags._axe_throw_unlocked, true, "昼のシフト上がりでも露出する");

// --- B06: 前提マトリクス（前提チェーン自体は現状維持） ---
reset(PREREQ_STATE);
assert.equal(axe.hiyoriAxePrereqsMet(), true);
reset({ ...PREREQ_STATE, flags: { ...AXE_PREREQ_FLAGS, _hiyori_tonari_afterwork_done: undefined } });
assert.equal(axe.hiyoriAxePrereqsMet(), false, "requires が1つ欠けると前提を満たさない");
reset({ ...PREREQ_STATE, affinity: { hiyori: 20 } });
assert.equal(axe.hiyoriAxePrereqsMet(), false, "好感度Lv2（20pt）では minAffinity 3 に届かない");
reset({ ...PREREQ_STATE, met: {} });
assert.equal(axe.hiyoriAxePrereqsMet(), false, "未面識では前提を満たさない");
reset({ ...PREREQ_STATE, flags: { ...AXE_PREREQ_FLAGS, _hiyori_real_self_known: true } });
assert.equal(axe.hiyoriAxePrereqsMet(), false, "斧イベント既読後は前提判定の対象外");
reset({ ...PREREQ_STATE, chapter: 3 });
assert.equal(axe.hiyoriAxePrereqsMet(), false, "対象章（1・2章）外では前提を満たさない");

// --- B06: tonari メニューの露出はフラグでのみ決まる ---
async function menuOptionTexts() {
  menuPick = "sub-back";
  const pending = tonari.tonariMenu();
  const node = screens.at(-1).node;
  await pending;
  menuPick = "after-none";
  return texts(node);
}
reset({ ...PREREQ_STATE, slot: 1 });
assert.equal(axe.hiyoriAxeReady(), true);
assert(!(await menuOptionTexts()).includes("ひよりと斧投げへ"), "ready でも未露出ならメニューに出ない");
state.flags._axe_throw_unlocked = true;
assert((await menuOptionTexts()).includes("ひよりと斧投げへ"), "露出フラグが立てばメニューに出る");

state.chapter = 2;
state.flags._ch2_region = "widehanga";
state.flags._ch2_preparation_started = true;
const axeFee = hiyoriData.route.events.find(event => event.id === "axe_reveal").cost;
for (const reserve of [199, 200]) {
  state.money = axeFee + reserve;
  await menuOptionTexts();
  assert.equal(find(screens.at(-1).node, "tonari-hiyori-axe").disabled, reserve < 200);
  assert.equal(axe.hiyoriAxeAffordable(), reserve >= 200);
}

console.log("[after-shift B05/B06] mandatory Sumi talk branch, one-line fallback, axe exposure timing/menu gating: PASS");

