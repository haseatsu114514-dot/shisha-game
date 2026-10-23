// #577: 新規／旧保存の境界と、独立した発見・目撃・正式初対面を検査する。
import assert from "node:assert/strict";
import fs from "node:fs";
import { axeBarDiscovered, axeBarRumorDue, axeBarSightingDue, hiyoriFirstMeetingReady } from "../js/core/axe-bar-discovery.js";
import { newGame, state, SCHEMA, SAVE_KEY, save, load, saveToSlot, loadFromSlot } from "../js/core/state.js";

const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
const clean = s => { const v = structuredClone(s); delete v.savedAt; return v; };
let count = 0;
function check(label, run) { run(); count++; console.log(`[axe discovery] PASS ${label}`); }

check("new game needs the rumor and next-day actual sighting", () => {
  const s = newGame(); Object.assign(s, { phase: "daily", day: 5, slot: 1 });
  const before = JSON.stringify(s);
  assert.equal(axeBarDiscovered(s), false); assert.equal(axeBarRumorDue(s), true);
  assert.equal(axeBarSightingDue(s), false); assert.equal(hiyoriFirstMeetingReady(s), false);
  assert.equal(JSON.stringify(s), before, "判定は状態を更新しない");
  s.flags._axe_bar_rumor_done = true;
  assert(axeBarDiscovered(s) && axeBarSightingDue(s)); assert(!axeBarRumorDue(s)); assert(!hiyoriFirstMeetingReady(s));
  s.flags._axe_bar_sighting_done = true; s.flags._axe_bar_sighting_day = 5; s.flags._axe_bar_sighting_chapter = 1;
  assert(!axeBarSightingDue(s)); assert(!hiyoriFirstMeetingReady(s), "同日の正式初対面は禁止");
  s.day = 6; assert(hiyoriFirstMeetingReady(s));
  delete s.flags._axe_bar_sighting_day; assert(!hiyoriFirstMeetingReady(s), "日付を推測しない");
});

check("current new save stays locked after auto/manual re-save and reload", () => {
  const s = newGame(); Object.assign(s, { phase: "daily", day: 5 });
  save(); assert(load()); assert(!axeBarDiscovered(state)); assert(!hiyoriFirstMeetingReady(state));
  saveToSlot("suien_remake_slot1"); newGame(); loadFromSlot("suien_remake_slot1");
  assert.equal(state.schema, SCHEMA); assert(!state.flags._axe_bar_legacy_access);
  assert(!axeBarDiscovered(state)); assert(!hiyoriFirstMeetingReady(state));
});

for (const schema of [7, 13, 14, 15]) for (const met of [false, true]) for (const visited of [false, true]) {
  check(`legacy schema${schema} met=${met} visited=${visited}`, () => {
    const s = newGame(); Object.assign(s, { schema, phase: "daily", day: 6, slot: 1, money: 17200, stamina: 67 });
    if (met) { s.met.hiyori = true; s.flags._hiyori_meeting_done = true; s.affinity.hiyori = 28; s.contacts.push("hiyori"); }
    if (visited) s.visitedDay.axe_bar = 5;
    const before = clean(s); save(); load();
    assert(axeBarDiscovered(state)); assert(hiyoriFirstMeetingReady(state));
    assert.equal(state.flags._axe_bar_rumor_done, undefined); assert.equal(state.flags._axe_bar_sighting_done, undefined);
    assert.equal(axeBarRumorDue(state), false);
    assert.equal(axeBarSightingDue(state), !met, "対面済みには目撃を後付けしない");
    for (const key of ["money", "stamina", "slot", "met", "affinity", "story", "visitedDay", "contacts", "flavorStock", "owned"])
      assert.deepEqual(state[key], before[key], `${key}を移行で増減させない`);
    const migrated = clean(state);
    for (const key of [SAVE_KEY, "suien_remake_slot2"]) {
      saveToSlot(key); newGame(); loadFromSlot(key); save(); load();
      assert.deepEqual(clean(state), migrated, "再保存・再LOADでも互換を保持");
    }
  });
}

check("meeting and rumor/sighting script boundaries", () => {
  const doc = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/axe_bar_discovery.json", import.meta.url), "utf8"));
  const sighting = doc.dialogues.find(d => d.dialogue_id === "axe_bar_sighting");
  assert(sighting.lines.length >= 3);
  for (const scene of doc.dialogues) for (const line of scene.lines) {
    assert(!line.type && !line.stats && !line.affinity && !line.money, "制御・報酬行を混ぜない");
    assert.notEqual(line.speaker, "hiyori", "匿名目撃や噂で本人の名前・立ち絵を出さない");
  }
  const original = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/hiyori.json", import.meta.url), "utf8"));
  const meeting = original.dialogues.find(d => d.dialogue_id === "hiyori_meeting");
  const conditional = meeting.lines.find(l => l.type === "condition" && l.flag === "_axe_bar_sighting_done");
  assert(conditional); assert.match(meeting.branches[conditional.next_true][0].text, /どこかで見たような/);
  const flags = meeting.lines.filter(l => l.type === "set_flag").map(l => l.flag);
  assert.deepEqual(flags, ["_met_hiyori", "_lime_contact_hiyori"]);
});
check("legacy malformed flags still retain access after re-save", () => {
  for (const flags of [null, true, "old", []]) {
    const s = newGame(); s.schema = 15; s.flags = flags;
    storage.set(SAVE_KEY, JSON.stringify(s)); load();
    assert(axeBarDiscovered(state)); assert(hiyoriFirstMeetingReady(state));
    assert.equal(state.flags._axe_bar_sighting_done, undefined);
    save(); load(); assert(axeBarDiscovered(state));
  }
});
console.log(`[axe discovery] ${count}/${count} PASS`);
