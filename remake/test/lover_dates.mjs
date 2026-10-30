// Data-level regression test for all seven romance dates.
// Run: node remake/test/lover_dates.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(new URL("../data/lover.json", import.meta.url), "utf8"));
const ids = ["tsumugi", "minto", "rin", "ageha", "hiyori", "mashiro", "samechan"];
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
for (const field of ["optA", "optB"]) {
  assert.match(mashiro[field].text, /ましろちゃん/, `Mashiro date ${field}: Hajime uses her established name`);
  assert.doesNotMatch(mashiro[field].text, /ましろ(?!ちゃん)/, `Mashiro date ${field}: no bare name in Hajime's speech`);
}
console.log("OK: all seven romance dates have complete data and Mashiro's voice is consistent");

// 恋人の節目は台詞中のキューも能力の加算元になる。入れ子の分岐を含めて残さない。
const milestones = JSON.parse(readFileSync(new URL("../../data/dialogue/lover_events.json", import.meta.url), "utf8")).dialogues;
assert.equal(milestones.length, 30);
for (const id of ["tsumugi", "minto", "rin", "ageha", "mashiro", "samechan"]) {
  for (let level = 1; level <= 5; level++) {
    const scene = milestones.find(scene => scene.dialogue_id === `lover_${id}_lv${level}`);
    assert.ok(scene?.lines.length, `${id} Lv${level}: missing milestone`);
  }
}
function checkMilestone(value, id) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!["stats", "add_stat", "growth_stats"].includes(key), `${id}: legacy ability reward ${key}`);
    if (key === "text") assert.doesNotMatch(child, /【(?:技術|センス|根性|魅力|洞察)】.*上が/, `${id}: ability cue`);
    checkMilestone(child, id);
  }
}
for (const scene of milestones) checkMilestone(scene, scene.dialogue_id);
console.log("OK: all 30 lover milestones contain no ability rewards or cues");
