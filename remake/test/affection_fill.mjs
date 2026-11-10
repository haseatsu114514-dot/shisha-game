// 好感度補充（A01–A14）: 新しい段階会話の台本・寄り道の配線・締めくくりの前提。
// node remake/test/affection_fill.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CH3_OPTIONAL_SCENES, optionalReadFlag } from "../js/chapters/ch3-story-wiring.js";
import { CH3_AFTERMATH_DETOURS } from "../js/chapters/ch3-aftermath-progress.js";
import { LONGLONG_FINALE } from "../js/chapters/ch4-longlong.js";
import { classifyFlag } from "../js/core/carry.js";

const read = rel => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const text = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const dialogues = name => read(`../../data/dialogue/${name}.json`).dialogues;
const byId = (name) => Object.fromEntries(dialogues(name).map(d => [d.dialogue_id, d]));
const routes = read("../../data/story_routes.json");

const NEW = {
  ch3_saku_missed: { file: "ch3_rivals", who: "saku", heart: 2 },
  ch3_saku_cleanup: { file: "ch3_rivals", who: "saku", heart: 3 },
  ch3_saku_liar: { file: "ch3_rivals", who: "saku", heart: 4 },
  ch3_steve_two_timers: { file: "ch3_rivals", who: "steve", heart: 1 },
  ch3_steve_empty_seat: { file: "ch3_rivals", who: "steve", heart: 3 },
  ch3_steve_tongs: { file: "ch3_rivals", who: "steve", heart: 4 },
  ch3_volk_fifth: { file: "ch3_volk", who: "volk", heart: 4 },
};

for (const [id, info] of Object.entries(NEW)) {
  const place = CH3_OPTIONAL_SCENES[id];
  assert(place, id);
  assert.equal(place.file, info.file, id);
  assert.equal(place.heart[info.who], info.heart, id);
  assert(routes.chapters["3"].optional.includes(id), `${id} is in story_routes optional`);
  const row = byId(info.file)[id];
  assert(row?.lines?.length, `missing script ${id}`);
  assert(row.lines.some(line => line.type === "apply" && line.affinity?.[info.who] > 0), `${id} raises affinity`);
  assert.equal(classifyFlag(optionalReadFlag(id)), "progression", id);
  assert(CH3_AFTERMATH_DETOURS.some(scene => scene.id === id), `${id} is offered after the tournament`);
}

const hiyori = read("../../data/dialogue/hiyori.json");
assert.deepEqual(hiyori.route.storyEvents, ["meeting", "cracks", "clockout", "axe_reveal", "work_talk", "peach_talk", "promise"]);
const clockout = hiyori.route.events.find(e => e.id === "clockout");
assert.deepEqual([clockout.dialogue, clockout.flag, clockout.minAffinity, clockout.lateAdded],
  ["hiyori_clockout", "_hiyori_clockout_done", 2, true]);
assert.deepEqual(clockout.requires, ["_hiyori_cracks_done"]);
assert(clockout.skipIf.includes("_hiyori_tonari_return_done"));
assert(byId("hiyori").hiyori_clockout.lines.length > 0);
assert.equal(classifyFlag("_hiyori_clockout_done"), "person");

const bonds = text("../js/daily/bonds.js");
assert.match(bonds, /master_hookah: \{ dialogue: "ch4_longlong_bond_finale", gift: "suyaki_master_hookah" \}/);
assert.match(bonds, /id === "master_hookah" \? longlongStoriesDone\(state\)/);
assert.equal(LONGLONG_FINALE, "ch4_longlong_bond_finale");
const gift = read("../../data/equipment.json").equipment.find(e => e.id === "suyaki_master_hookah");
assert.equal(gift.gift.from, "master_hookah");
assert.equal(gift.gift.flavor, "black_tea");
assert(gift.unsellable && gift.not_for_sale);
const finale = byId("ch4_longlong")[LONGLONG_FINALE];
assert.equal(finale.metadata.bond_finale, "master_hookah");
const spoken = [...finale.lines, ...Object.values(finale.branches || {}).flat()].map(line => line.text || "").join("");
assert(!spoken.includes("ライチ") && !spoken.includes("煙楼先生") && !spoken.includes("ジャスミン"));

console.log("PASS affection fill: A01–A14 scripts, wiring, gifts, and late-added flags");
