// 第2章のあげは（#626）: 強制の夜・店に通う回の順番・ダメな日・答え合わせ・試飲会の配合・LIME・控室の分岐。
import assert from "node:assert/strict";
import fs from "node:fs";
import { CH2_NIGHTS, AGEHA_VISITS, AGEHA_BADDAY, agehaStoryScene, syncAgehaVibes } from "../js/chapters/ch2-story-data.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const story = Object.fromEntries(read("data/dialogue/ch2_ageha_story.json").dialogues.map((d) => [d.dialogue_id, d]));

// 強制の夜: 3日目（なるの祝福のあと）の偵察返し・9日目の試飲会・10日目のスランプ来店。
// 2日目と8日目（サメのTRPG）は自由に使える夜として空けたまま（#639）
const night = (day) => CH2_NIGHTS.find((n) => n.day === day);
assert.deepEqual(night(3).steps.map((s) => s.id), ["ch2_naru_warm", "remake_ch2_ageha_scout"]);
assert.equal(night(3).steps[1].contact, "ageha", "会っていなくても連絡先を交換する");
assert(!night(2), "2日目は自由な夜");
assert.deepEqual(night(9).steps.map((s) => s.id), ["remake_ch2_ageha_tasting"]);
assert.equal(night(9).steps[0].room, "ageha");
assert.deepEqual(night(10).steps.map((s) => s.id), ["ch2_sumi_silence", "remake_ch2_ageha_slump"]);
assert(!night(8), "8日目はサメのTRPG参加日");
for (const step of CH2_NIGHTS.flatMap((n) => n.steps).filter((s) => s.file === "ch2_ageha_story")) assert(story[step.id], step.id);

// 店に通う回: 7日目より前はギャル友→初めての客→雑誌取材の順、7日目以降はダメな日が先。全部読んだら null
const save = { flags: {} };
assert.equal(agehaStoryScene(save, 3, story), AGEHA_VISITS[0]);
assert.equal(agehaStoryScene(save, 7, story), AGEHA_BADDAY.id);
for (const id of [AGEHA_BADDAY.id, ...AGEHA_VISITS]) {
  assert.equal(agehaStoryScene(save, 9, story), id);
  save.flags[`_ch2_read_${id}`] = true;
}
assert.equal(agehaStoryScene(save, 9, story), null);
assert.equal(agehaStoryScene({ flags: {} }, 9, {}), null, "台本が無ければいつもの会話");

// 答え合わせ: 2回当てたら試飲会で不安を話す
const flags = { _ch2_vibes_hit_scout: true };
assert.equal(syncAgehaVibes(flags), 1); assert(!flags._ch2_vibes_understood);
flags._ch2_vibes_hit_magazine = true;
assert.equal(syncAgehaVibes(flags), 2); assert(flags._ch2_vibes_understood);

// 各回の答え合わせ: 選択肢の行き先がそろい、当たりの枝だけが当たりの印を付ける
for (const id of ["remake_ch2_ageha_scout", ...AGEHA_VISITS]) {
  const d = story[id];
  const choice = d.lines.find((l) => l.type === "choice");
  for (const c of choice.choices) assert(d.branches[c.next], `${id}: ${c.next}`);
  const marks = Object.entries(d.branches).filter(([, lines]) => lines.some((l) => l.type === "set_flag" && l.flag.startsWith("_ch2_vibes_hit_")));
  assert.deepEqual(marks.map(([k]) => k), ["hit"], id);
}
// ダメな日で秘密を知る。試飲会・スランプ・控室はそれで分岐する
assert(story[AGEHA_BADDAY.id].lines.some((l) => l.type === "set_flag" && l.flag === "_ch2_ageha_secret"));
for (const id of ["remake_ch2_ageha_tasting", "remake_ch2_ageha_slump"]) {
  assert(story[id].lines.some((l) => l.type === "condition" && l.flag === "_ch2_ageha_secret" && story[id].branches.secret), id);
}
const lobby = read("data/dialogue/ch2_tournament.json").dialogues.find((d) => d.dialogue_id === "ch2_tournament_lobby");
assert(lobby.lines.some((l) => l.flag === "_ch2_ageha_secret") && lobby.branches.secret.length);

// 試飲会の配合: こはくのひらめきと同じ印で「試したい配合」に入る
const note = story.remake_ch2_ageha_tasting.lines.find((l) => l.type === "note");
const recipe = read("data/recipes.json").recipes.find((r) => `idea_${r.id}` === note.note_id);
assert.deepEqual(recipe?.flavors, ["mango", "peach", "mint"]);

// 朝のLIME: 第2章の章内日で届く（4日目は感覚ある日、7日目はダメな日）。返信は19字まで
const lime = read("data/lime_messages.json").messages;
for (const [id, day] of [["lime_ageha_ch2_goodday", 4], ["lime_ageha_ch2_badday", 7]]) {
  const m = lime.find((x) => x.id === id);
  assert.equal(m.chapter, 2, id); assert.equal(m.trigger_day, day, id);
  for (const r of m.replies || []) assert([...r.text].reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .5 : 1), 0) <= 19, r.text);
}
console.log("[ch2 ageha] PASS: forced nights, visit order, bad day, vibes, secret branches, tasting recipe, LIME");
