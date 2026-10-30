// #1696: C.STATIONで博士の二面性をそれとなく見せる一度きりの回（cs_kemuri_sample）。
// 面識・来店回数・間隔・既読で一度だけ出ること、台本が大会前後の両方を持つことを検査する。
// node remake/test/spot_encounter_doctor.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { spotEncounterDue, quietSpotPool, recordSpotEncounter } from "../js/daily/spot-encounters.js";

const ID = "cs_kemuri_sample";
const SEEN = `_spot_seen_${ID}`;
const read = (url) => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), "utf8"));
const dialogues = Object.fromEntries(read("../../data/dialogue/ch1_spots.json").dialogues.map((d) => [d.dialogue_id, d]));
const faces = new Set(fs.readdirSync(new URL("../../assets/sprites/characters/dr_kemuri/", import.meta.url))
  .map((f) => /^chr_dr_kemuri_(\w+)\.png$/.exec(f)?.[1]).filter(Boolean));
const save = (over = {}) => ({ slot: 0, chapter: 1, met: {}, flags: {}, ...over });

let count = 0;
function check(name, run) {
  try { run(); count++; console.log(`PASS ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; }
}

check("script exists, branches both ways on the chapter 1 tournament and marks itself seen at the end", () => {
  const dlg = dialogues[ID];
  assert(dlg?.lines?.length, "cs_kemuri_sample must be in ch1_spots.json");
  const cond = dlg.lines.find((l) => l.type === "condition");
  assert.equal(cond.condition_type, "tournament_finished");
  assert.equal(cond.tournament_chapter, 1);
  assert(dlg.branches[cond.next_true]?.length && dlg.branches[cond.next_false]?.length);
  assert.deepEqual(dlg.lines.at(-1), { type: "set_flag", flag: SEEN });
  // 大会前は名前を呼ばず、大会後だけ「はじめくん」と呼ぶ（cs_kemuri_solo と同じ面識の段階）。
  const text = (branch) => dlg.branches[branch].map((l) => l.text || "").join("");
  assert(!text(cond.next_false).includes("はじめくん"));
  assert(text(cond.next_true).includes("はじめくん"));
});

check("lines use only real speakers and doctor faces, keep text rules, and reveal nothing about chapter 5", () => {
  const dlg = dialogues[ID];
  const all = [...dlg.lines, ...Object.values(dlg.branches).flat()].filter((l) => !l.type);
  for (const l of all) {
    assert(["", "hajime", "dr_kemuri", "staff_choizap"].includes(l.speaker), l.text);
    if (l.speaker === "dr_kemuri") assert(faces.has(l.face), `face ${l.face}`);
    if (l.speaker) assert(!l.text.endsWith("。"), l.text);
    assert(!l.text.includes("\n"), l.text);
    assert(l.text.length <= 48, `${l.text.length}: ${l.text}`);
  }
  const whole = all.map((l) => l.text).join("");
  for (const word of ["9000", "SHISHA", "裏ボス", "人体実験", "砂", "味覚", "不調"]) assert(!whole.includes(word), word);
});

check("plays once at C.STATION after the first visit, only with the doctor met, then never again", () => {
  assert.equal(spotEncounterDue("c_station", 2, save(), dialogues), null, "unmet doctor");
  const s = save({ met: { dr_kemuri: true } });
  assert.equal(spotEncounterDue("c_station", 1, s, dialogues), null, "first visit is the introduction");
  assert.equal(spotEncounterDue("c_station", 2, s, dialogues), ID);
  s.slot = 1;
  assert.equal(spotEncounterDue("c_station", 2, s, dialogues), ID, "night visits qualify too");
  // SKIP等で末尾に届かなければ既読にならず、次の来店で読み直す。
  recordSpotEncounter("c_station", ID, 2, s);
  assert.equal(s.flags._spot_last_c_station, undefined);
  assert.equal(spotEncounterDue("c_station", 3, s, dialogues), ID);
  s.flags[SEEN] = true;
  recordSpotEncounter("c_station", ID, 3, s);
  assert.equal(s.flags._spot_last_c_station, 3);
  for (let n = 4; n < 12; n++) assert.equal(spotEncounterDue("c_station", n, s, dialogues), null, `visit ${n}`);
  // 第2章の保存や大会後（ch1 aftermath）でも面識があれば同じ一度性で出る。
  const later = save({ chapter: 2, met: { dr_kemuri: true } });
  assert.equal(spotEncounterDue("c_station", 2, later, dialogues), ID);
});

check("the one-shot stays out of the quiet C.STATION pool", () => {
  const spot = { id: "c_station", pool: ["cs_staff_greeting", "cs_kemuri_solo", ID] };
  assert(!quietSpotPool(spot, 0).includes(ID));
  assert(quietSpotPool(spot, 0).includes("cs_kemuri_solo"));
});

console.log(`${count} checks passed`);
