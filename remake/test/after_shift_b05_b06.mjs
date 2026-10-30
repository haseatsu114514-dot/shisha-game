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
const baitoData = JSON.parse(await read("data/baito_events.json"));

const state = {};
const db = {
  dialogues: Object.fromEntries((hiyoriData.dialogues || []).map((s) => [s.dialogue_id, s])),
  baito: baitoData.events || [],
  hiyori: hiyoriData,
  flavorById: {},
};

const plays = [], visitCalls = [], screens = [];
let storyReady = false, menuPick = "after-none";

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
async function realModule(name, path) {
  if (instances.has(name)) return instances.get(name);
  const mod = new vm.SourceTextModule(await read(path), { identifier: name });
  instances.set(name, mod);
  await mod.link((spec) => instances.get(spec.split("/").pop()));
  await mod.evaluate();
  return mod;
}

await realModule("stat-step-tables.js", "remake/js/core/stat-step-tables.js");

synthetic("util.js", { el, pick: (list) => list[0] });
synthetic("data.js", { DB: db, bgUrl: (id) => id });
synthetic("state.js", { state, config: { statEffectColors: true }, timeOfDay: () => "day" });
synthetic("stats.js", {
  addMoney() {}, addStamina() {}, applyStats() {}, step: () => 1,
  currentCondition: () => ({}), affinityLevel,
});
synthetic("ui.js", {
  showScreen: (name, node) => {
    screens.push({ name, node });
    queueMicrotask(() => find(node, menuPick)?.onclick?.());
    return node;
  },
  setBg() {}, toast() {}, retire() {}, modal: async () => true,
});
synthetic("audio.js", { SE: new Proxy({}, { get: () => () => {} }), playBgm() {}, currentBgm: () => null });
synthetic("bus.js", { on: () => () => {} });
synthetic("axe.js", { runAxeThrow: async () => {} });
synthetic("engine.js", {
  play: async (scene) => {
    const id = typeof scene === "string" ? scene : scene?.dialogue_id || scene?.id;
    plays.push(id);
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
synthetic("weather.js", { isRainy: () => false, RAIN_BAITO: "remake_baito_rain", RAIN_BAITO_BONUS: 0 });
synthetic("scene-motions.js", { shiftClose: async () => {} });
synthetic("hiyori.js", { meetHiyoriAtTonari: async () => {} });
synthetic("attack-lesson.js", { canStudyAttack: () => false, studyAttack: async () => {} });
synthetic("coal-lesson.js", { canStudyCubeCoals: () => false, studyCubeCoals: async () => {} });
synthetic("growth.js", { readyLessons: () => [], consultLessons: async () => [] });
synthetic("tsumugi-schedule.js", { tsumugiAtTonari: () => false });
synthetic("flavor-mastery.js", { staffFlavors: () => [], staffStock: () => 0 });
synthetic("axe-bar-discovery.js", { hiyoriFirstMeetingReady: () => false });

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

console.log("[after-shift B05/B06] mandatory Sumi talk branch, one-line fallback, axe exposure timing/menu gating: PASS");
