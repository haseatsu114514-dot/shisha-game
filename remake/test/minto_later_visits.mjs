// みんとの残り物語系2本（#3081）。固有会話のあと、タイマーを預ける → 上げないチェキ、の順に一度。
// #3093 の端の席とは別の旗。中断では既読にしない。締めくくりと送り出しが先。
// node --experimental-vm-modules remake/test/minto_later_visits.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const file = JSON.parse(read("data/dialogue/ch1_minto.json"));
const timer = file.dialogues.find(d => d.dialogue_id === "ch1_minto_timer_hand");
const cheki = file.dialogues.find(d => d.dialogue_id === "ch1_minto_cheki_keep");
const textOf = scene => (scene.lines || []).map(line => line.text || "").join("\n");

for (const scene of [timer, cheki]) {
  assert(scene?.lines?.length >= 8, scene?.dialogue_id);
  assert(!scene.branches && !scene.lines.some(line => line.type === "choice"));
  assert(!/大会|本番|予選|優勝|ドバイ|東京|精肉|自己破産|木成頼|栞/.test(textOf(scene)));
  for (const line of scene.lines) {
    if (!line.text) continue;
    assert(!line.text.endsWith("。"), line.text);
    assert(!line.text.includes("\n"));
    assert(["", "minto", "hajime"].includes(line.speaker));
  }
}
assert(/タイマー/.test(textOf(timer)) && /触らない/.test(textOf(timer)));
assert(/上げない/.test(textOf(cheki)) && /戻さない/.test(textOf(cheki)));

function namedImports(src) {
  const map = new Map();
  for (const m of src.matchAll(/(?:import|export)\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const set = map.get(m[2]) || new Set();
    for (const part of m[1].split(",").map(s => s.trim()).filter(Boolean)) set.add(part.split(/\s+as\s+/)[0].trim());
    map.set(m[2], set);
  }
  return map;
}
async function loadWithStubs(filePath, overrides) {
  const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
  const src = read(filePath);
  const mod = new vm.SourceTextModule(src, { context, identifier: filePath });
  const imports = namedImports(src);
  const synthetic = new Map();
  await mod.link(spec => {
    const names = [...(imports.get(spec) || [])];
    const values = overrides[spec] || {};
    const stub = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, name in values ? values[name] : (() => undefined));
    }, { context, identifier: spec });
    synthetic.set(spec, stub);
    return stub;
  });
  await mod.evaluate();
  return { ns: mod.namespace, set: (spec, name, value) => synthetic.get(spec).setExport(name, value) };
}

let state, played, affinity, playMode = "ok", finaleOpen = false;
const DB = { dialogues: {}, manifest: {} };
const spotsModule = await loadWithStubs("remake/js/daily/spots.js", {
  "../core/state.js": { markMet: id => { state.met[id] = true; } },
  "../core/data.js": { DB },
  "../core/stats.js": {
    gainAffinity: (id, n) => affinity.push([id, n]),
    visitAffinity: kind => kind === "story" ? 16 : 8,
    affinityLevel: () => 5,
    releaseAffinity: () => 0,
    AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66],
    earnStat: () => {}, addStamina: () => {}, addMoney: () => {}, ensureAffinityLevel: () => {},
  },
  "../vn/engine.js": { play: async scene => {
    played.push(typeof scene === "string" ? scene : scene.dialogue_id);
    return playMode === "cancel" ? { cancelled: true } : { id: scene };
  } },
  "../core/affinity-stages.js": { VISIT_SEQ: { minto: ["ch1_minto_first", "ch1_minto_second", "ch1_minto_third", "ch1_minto_group_regulars", "ch1_minto_fourth", "ch1_minto_phantom_smell"] }, visitStorySkipped: () => false },
  "./weather.js": { isRainy: () => false, RAIN_SPOT_TEXTS: {} },
  "./bonds.js": {
    questionVisitDue: () => false,
    finaleAtVisit: () => finaleOpen,
    playFinale: async () => { played.push("finale"); return true; },
    afterStory: async () => true,
  },
  "./spot-encounters.js": { spotFollowupDue: () => null },
});
const spots = spotsModule.ns;
function save(patch = {}) {
  const value = {
    chapter: 1, phase: "daily", day: 8, slot: 0,
    story: { minto: 6 }, visits: { minto: 0 }, met: { minto: true }, contacts: ["minto"],
    affinity: { minto: 70 }, lovers: [], visitedDay: {},
    flags: { _minto_identity_revealed: true },
    ...patch,
  };
  spotsModule.set("../core/state.js", "state", value);
  return value;
}

state = save({ story: { minto: 5 } });
DB.dialogues = { ch1_minto_timer_hand: timer, ch1_minto_cheki_keep: cheki, remake_repeat_minto_0: { dialogue_id: "remake_repeat_minto_0", lines: [{ speaker: "minto", text: "repeat" }] } };
assert.equal(spots.mintoTimerHandDue(), false);
state = save({ flags: {} });
assert.equal(spots.mintoTimerHandDue(), false);
state = save();
assert.equal(spots.mintoTimerHandDue(), true);
assert.equal(spots.mintoChekiKeepDue(), false);
assert.equal(spots.hasNewStory("minto"), true);

played = []; affinity = [];
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played, ["ch1_minto_timer_hand"]);
assert.equal(state.flags._minto_timer_hand_done, true);
assert.equal(state.story.minto, 6);
assert.deepEqual(affinity, [["minto", 16]]);

played = []; affinity = [];
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played, ["ch1_minto_cheki_keep"]);
assert.equal(state.flags._minto_cheki_keep_done, true);
assert.equal(spots.hasNewStory("minto"), false);

played = []; affinity = [];
assert.equal(await spots.visitChar("minto"), true);
assert.match(played[0], /^remake_repeat_minto_/);
assert.deepEqual(affinity, [["minto", 8]]);

state = save(); played = []; playMode = "cancel";
assert.equal(await spots.visitChar("minto"), false);
assert.equal(state.flags._minto_timer_hand_done, undefined);
playMode = "ok";

state = save(); finaleOpen = true; played = [];
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played, ["finale"]);
assert.equal(state.flags._minto_timer_hand_done, undefined);
finaleOpen = false;

DB.dialogues.ch3_prep_minto = { dialogue_id: "ch3_prep_minto", lines: [{ speaker: "minto", text: "送り出し" }] };
state = save({ chapter: 3, flags: { _minto_identity_revealed: true, _ch3_prep: { startDay: 29, days: 3, step: 4, departed: false } } });
played = [];
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played, ["ch3_prep_minto"]);
assert.equal(state.flags._minto_timer_hand_done, undefined);

console.log("OK: minto timer hand then unposted cheki, once each");
