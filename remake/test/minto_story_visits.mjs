// みんとの物語系2本（#3081）。固有会話を読み終え、店で正体がつながったあと、
// 端の席 → 小さい声のあいさつ、の順に一度ずつ。中断では既読にしない。締めくくりと送り出しが先。
// node --experimental-vm-modules remake/test/minto_story_visits.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const file = JSON.parse(read("data/dialogue/ch1_minto.json"));
const side = file.dialogues.find(d => d.dialogue_id === "ch1_minto_side_seat");
const quiet = file.dialogues.find(d => d.dialogue_id === "ch1_minto_quiet_hello");
const textOf = scene => (scene.lines || []).map(line => line.text || "").join("\n");

for (const scene of [side, quiet]) {
  assert(scene?.lines?.length >= 8, `${scene?.dialogue_id}: a story scene`);
  assert(!scene.branches && !scene.lines.some(line => line.type === "choice"), `${scene.dialogue_id}: no choices`);
  assert(!/大会|本番|予選|優勝|ドバイ|東京/.test(textOf(scene)), `${scene.dialogue_id}: no tournament`);
  assert(!/精肉|自己破産|木成頼|栞/.test(textOf(scene)), `${scene.dialogue_id}: no new or repeated secret`);
  for (const line of scene.lines) {
    if (!line.text) continue;
    assert(!line.text.endsWith("。"), `${scene.dialogue_id}: ${line.text}`);
    assert(!line.text.includes("\n"), `${scene.dialogue_id}: no manual break`);
    assert(["", "minto", "hajime"].includes(line.speaker), line.speaker);
    if (line.speaker === "hajime") assert(/俺/.test(line.text) || !/私|僕/.test(line.text));
    if (line.speaker === "minto" && line.face?.startsWith("ura_")) assert.fail("shop scene stays in work clothes");
  }
}
assert(/端の席/.test(textOf(side)) && /戻さない/.test(textOf(side)));
assert(/私の声/.test(textOf(quiet)) && /この席だけ/.test(textOf(quiet)));
assert(!/みんとの声/.test(textOf(quiet).split("私の声")[0] || ""), "the quiet line is hers, not the shop name");

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

let state, played, affinity, kinds, playMode = "ok", finaleOpen = false;
const DB = { dialogues: {}, manifest: {} };
const spotsModule = await loadWithStubs("remake/js/daily/spots.js", {
  "../core/state.js": { markMet: id => { state.met[id] = true; } },
  "../core/data.js": { DB },
  "../core/stats.js": {
    gainAffinity: (id, n) => affinity.push([id, n]),
    visitAffinity: kind => { kinds.push(kind); return kind === "story" ? 16 : 8; },
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
const prep = { startDay: 29, days: 3, step: 4, departed: false };
function save(patch = {}) {
  const value = {
    chapter: 1, phase: "daily", day: 8, slot: 0,
    story: { minto: 6 }, visits: { minto: 8 }, met: { minto: true }, contacts: ["minto"],
    affinity: { minto: 70 }, lovers: [], visitedDay: {},
    flags: { _minto_identity_revealed: true },
    ...patch,
  };
  spotsModule.set("../core/state.js", "state", value);
  return value;
}

state = save({ story: { minto: 5 }, flags: { _minto_identity_revealed: true } });
DB.dialogues = { ch1_minto_side_seat: side, ch1_minto_quiet_hello: quiet };
assert.equal(spots.mintoSideSeatDue(), false, "the night story is still unread");
state = save({ flags: {} });
assert.equal(spots.mintoSideSeatDue(), false, "identity comes first");
state = save();
DB.dialogues = {};
assert.equal(spots.mintoSideSeatDue(), false, "missing script stays on the usual visit");
DB.dialogues = { ch1_minto_side_seat: side, ch1_minto_quiet_hello: quiet, remake_repeat_minto_0: { dialogue_id: "remake_repeat_minto_0", lines: [{ speaker: "minto", face: "smile", text: "repeat" }] } };
assert.equal(spots.mintoSideSeatDue(), true);
assert.equal(spots.mintoQuietHelloDue(), false, "the quiet hello waits for the seat");
assert.equal(spots.hasNewStory("minto"), true);

played = []; affinity = []; kinds = [];
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played, ["ch1_minto_side_seat"]);
assert.equal(state.flags._minto_side_seat_done, true);
assert.equal(state.flags._minto_quiet_hello_done, undefined);
assert.equal(state.story.minto, 6, "the extra scene does not advance the visit sequence");
assert.deepEqual(affinity, [["minto", 16]]);
assert.deepEqual(kinds, ["story"]);

played = []; affinity = []; kinds = [];
assert.equal(spots.mintoQuietHelloDue(), true);
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played, ["ch1_minto_quiet_hello"]);
assert.equal(state.flags._minto_quiet_hello_done, true);
assert.deepEqual(affinity, [["minto", 16]]);
assert.equal(spots.hasNewStory("minto"), false, "after both, the pin goes back to ordinary visits");

played = []; affinity = []; kinds = [];
assert.equal(await spots.visitChar("minto"), true);
assert.match(played[0], /^remake_repeat_minto_/);
assert.deepEqual(affinity, [["minto", 8]], "the repeat stays a talk, not another story");

state = save(); played = []; affinity = []; kinds = []; playMode = "cancel";
assert.equal(await spots.visitChar("minto"), false);
assert.equal(state.flags._minto_side_seat_done, undefined, "cancel leaves it unread");
assert.equal(state.visits.minto, 8);
playMode = "ok";

state = save(); finaleOpen = true; played = [];
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played, ["finale"], "the finale still comes before the new seat");
assert.equal(state.flags._minto_side_seat_done, undefined);
finaleOpen = false;

DB.dialogues.ch3_prep_minto = { dialogue_id: "ch3_prep_minto", lines: [{ speaker: "minto", face: "smile", text: "送り出し" }] };
state = save({ chapter: 3, flags: { _minto_identity_revealed: true, _ch3_prep: { ...prep } } });
played = [];
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played, ["ch3_prep_minto"], "a chapter send-off stays ahead of the seat");
assert.equal(state.flags._minto_side_seat_done, undefined);
assert.equal(state.flags._talk_seen_ch3_prep_minto, true);

console.log("OK: minto side seat then quiet hello, once each, after the visit sequence");
