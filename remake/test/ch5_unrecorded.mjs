import assert from "node:assert/strict";
import fs from "node:fs";
import { chapterFiveUnrecordedDialogue } from "../js/chapters/ch5-unrecorded.js";
const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch5_main.json", import.meta.url)));
const source = data.dialogues.find(scene => scene.dialogue_id === "ch5_unrecorded_day");
const text = d => d.lines.map(line => line.text || "").join("\n");

// 章の初日から連絡できる。未読の任意体験はひとつも前提にせず、読むだけでは保存を変えない。
for (const value of [{ chapter: 5, day: 1, flags: {} }, { chapter: 5, day: 300, flags: { _ch5: { read: {} } } }]) {
  const before = structuredClone(value);
  assert.deepEqual(chapterFiveUnrecordedDialogue(value, source).lines, source.lines);
  assert.deepEqual(value, before);
}
for (const [id, branch] of [["ch5_free_mashiro_visit", "mashiro_seen"], ["ch5_free_first_visitor", "visitor_seen"], ["ch5_free_tonari_practice", "practice_seen"]]) {
  const value = { chapter: 5, flags: { _ch5: { read: { [id]: true }, prep: { trial: "heat", adjusted: false } } } };
  const before = structuredClone(value), actual = text(chapterFiveUnrecordedDialogue(value, source));
  for (const line of source.branches[branch]) assert(actual.includes(line.text));
  for (const other of ["mashiro_seen", "visitor_seen", "practice_seen"].filter(x => x !== branch))
    for (const line of source.branches[other]) assert(!actual.includes(line.text));
  assert.deepEqual(value, before);
}
// 試作の入口だけ読み、分担・再調整が未完の保存では、試作を終えた体験にしない。
for (const prep of [undefined, { trial: "heat", adjusted: null }]) {
  const value = { chapter: 5, flags: { _ch5: { read: { ch5_free_tonari_practice: true }, prep } } };
  assert.deepEqual(chapterFiveUnrecordedDialogue(value, source).lines, source.lines);
}
const choice = source.lines.find(line => line.type === "choice");
assert.equal(choice.id, "ch5_unrecorded_task");
assert.deepEqual(choice.choices.map(item => item.next), ["water_first", "order_first"]);
for (const selected of choice.choices) {
  const lines = source.lines.flatMap(line => line === choice ? source.branches[selected.next] : [line]);
  assert(lines.some(line => /水/.test(line.text)));
  assert(lines.some(line => /注文/.test(line.text)));
  assert(lines.some(line => /日を決めるかどうかは、まだこれから/.test(line.text)));
}
for (const line of [...source.lines, ...Object.values(source.branches).flat()]) {
  assert(!["apply", "set_flag", "remember"].includes(line.type), "Ordinary work must not grant rewards or complete an optional scene");
  assert(!/病気|不調の原因|診断|無能|空っぽ/.test(line.text || ""), "Doctor's later reveal or a forced answer leaked early");
}
assert.equal(chapterFiveUnrecordedDialogue({}, undefined), undefined);
const other = data.dialogues.find(scene => scene !== source);
assert.equal(chapterFiveUnrecordedDialogue({}, other), other);
console.log("ch5 unrecorded ordinary work: ok");
