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

// 自由行動の最初の案内: 店の「！」は今読める場面にだけ付き、遠出の行き先も残す。博士への連絡（勝負の日を決める電話）は、
// tonari の閉店後の練習と試作を終えてから出す（2026-11-20 オーナー「ある程度ストーリーが進んだら、好きなタイミングで挑める」）。
globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const core = await import("../js/core/state.js");
const progress = await import("../js/chapters/ch5-progress.js");
const { chapterFiveDailyDefinition, chapterFiveHomeSpots } = await import("../js/chapters/ch5-daily.js");
const fresh = core.newState();
Object.assign(fresh, { chapter: 4, phase: "cleared", day: 60, slot: 0 });
fresh.flags._ch4_cleared = true;
assert(progress.advanceToChapterFive(fresh));
for (const { id } of progress.CH5_PROLOGUE) assert(progress.completeChapterFiveScene(fresh, id));
core.setState(fresh);
const def = chapterFiveDailyDefinition({});
const home = () => def.mapOptions().regions.find(region => region.id === "home").spots();
const tonari = spots => spots.find(spot => spot.id === "tonari");
const before = structuredClone(fresh);
assert.equal(def.untilDay, Infinity);
assert.match(def.undatedNote, /まずは tonari へ。博士への連絡は、閉店後の練習を終えてから/);
assert.equal(progress.chapterFiveCallOpen(fresh), false);
assert.equal(tonari(home()).hasNew?.(), true, "Mashiro's visit is available on the first day");
assert.equal(tonari(chapterFiveHomeSpots()).hasNew, undefined, "The shared spot isn't mutated");
assert.equal(home().find(spot => spot.id === "ch5_call"), undefined, "The doctor can't be called on the first day");
assert.equal(def.mapOptions().regions.length, 4, "Other places remain accessible");
assert.deepEqual(fresh, before, "Showing the map must not consume time or create a visit");
fresh.slot = 1;
assert.equal(tonari(home()).hasNew, undefined, "Mashiro's scene waits until daytime");
fresh.slot = 0;
assert(progress.completeChapterFiveScene(fresh, "ch5_free_mashiro_visit"));
// つむぎ目線の新人編から入った保存には「初めての客」が無い（#4253）。次は夜の閉店後の練習
assert.equal(progress.completeChapterFiveScene(fresh, "ch5_free_first_visitor"), false);
assert.equal(tonari(home()).hasNew, undefined, "The workbench scene waits until night");
fresh.slot = 1;
assert.equal(tonari(home()).hasNew?.(), true);
assert.equal(home().find(spot => spot.id === "ch5_call"), undefined, "Still not before the workbench scene");
// 練習を読んで試作が途中（試す→返答→直すか）の間も、まだ出さない
assert(progress.completeChapterFiveScene(fresh, "ch5_free_tonari_practice"));
assert.equal(home().find(spot => spot.id === "ch5_call"), undefined, "Not while the prep is pending");
assert(progress.recordChapterFivePrepTrial(fresh, "heat"));
assert.equal(progress.chapterFiveCallOpen(fresh), false, "The trial alone is not the end of the prep");
const notYet = await def.performSpot({ id: "ch5_call", kind: "ch5_call" }, {});
assert.deepEqual(notYet, { used: false, exerted: false }, "A stale button does not call the doctor early");
assert.equal(fresh.flags._ch5.read.ch5_unrecorded_day, undefined, "Nothing is read by the stale button");
// 試作を終えたら出る。期限は無く、案内も急がせない
assert(progress.recordChapterFivePrepAdjustment(fresh, true));
assert.equal(progress.chapterFiveCallOpen(fresh), true);
assert.equal(home().find(spot => spot.id === "ch5_call")?.kind, "ch5_call", "The call opens after the prep");
assert.match(def.undatedNote, /準備ができたらいつでも。急がなくていい/);
assert.equal(def.untilDay, Infinity, "No deadline after the call opens");
fresh.day += 200;
assert.equal(home().find(spot => spot.id === "ch5_call")?.kind, "ch5_call", "Still open after a long preparation");
// 日を決めた後（勝負の前夜）は、もう一度は出さない。第5章以外の保存でも false
const scheduled = structuredClone(fresh);
assert(progress.completeChapterFiveScene(scheduled, "ch5_unrecorded_day"));
assert(progress.recordChapterFiveScheduleDecision(scheduled, "decide"));
assert(progress.completeChapterFiveScene(scheduled, "ch5_schedule_contact"));
assert.equal(progress.chapterFiveProgress(scheduled).part, "scheduled");
assert.equal(progress.chapterFiveCallOpen(scheduled), false);
assert.equal(progress.chapterFiveCallOpen({ chapter: 4, flags: {} }), false);
assert.equal(progress.chapterFiveCallOpen(undefined), false);
console.log("ch5 home map: local story timing, the doctor's call after the prep (no deadline) and free choice passed");
