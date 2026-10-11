// Data-level regression test for all six romance dates.
// Run: node remake/test/lover_dates.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(new URL("../data/lover.json", import.meta.url), "utf8"));
const ids = ["tsumugi", "minto", "rin", "ageha", "hiyori", "mashiro"];
const allowedStats = new Set(["sense", "charm", "insight", "technique", "guts"]);
for (const id of ids) {
  const scene = data.dates?.[id];
  assert.ok(scene, `Missing date for ${id}`);
  for (const field of ["arrive", "mid", "close"]) {
    assert.ok(scene[field]?.face && scene[field]?.text, `${id}: missing ${field}`);
  }
  assert.ok(scene.choiceQ, `${id}: missing choice prompt`);
  for (const field of ["optA", "optB"]) {
    const choice = scene[field];
    assert.ok(choice?.text && choice?.line, `${id}: incomplete ${field}`);
    assert.ok(allowedStats.has(choice.stat), `${id}: invalid stat ${choice.stat}`);
    assert.ok([...choice.text].length <= 26, `${id}: choice exceeds 26 characters`);
  }
  assert.ok(data.inviteLines?.[id], `${id}: no invitation messages`);
}
const mashiro = data.dates.mashiro;
const dialogue = [mashiro.arrive.text, mashiro.mid.text, mashiro.optA.line, mashiro.optB.line, mashiro.close.text].join("\n");
assert.ok(dialogue.includes("はじめくん"));
assert.ok(dialogue.includes("僕"));
assert.doesNotMatch(dialogue, /わたし|私|はじめさん|蒸野くん/);
console.log("OK: all six romance dates have complete data and Mashiro's voice is consistent");
