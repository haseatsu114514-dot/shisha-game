// 第5章の最初の来店で一度だけ読む会話（N3・chapters/ch5-first-talks.js）の判定と台本。
// アダム（EDEN）・レヰ（零-ZERO-）・神崎（神崎煙草店。第2章の後日談 ch2_kumicho_after_ch2 を世界大会の後に書き直したもの）。
// 実際の来店（代金・好感度・既読の付け方）は remake/test/browser/ch5_home_talks.mjs が確かめる。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { classifyFlag, flagVerdict } from "../js/core/carry.js";
import { advanceToChapterFive, completeChapterFiveScene, recordChapterFiveScheduleDecision, beginChapterFiveMatch,
  CH5_PROLOGUE, CH5_FREE_SCENES } from "../js/chapters/ch5-progress.js";
import { CH5_FIRST_TALKS, chapterFiveFirstTalkDue, chapterFiveFirstTalkSeenFlag } from "../js/chapters/ch5-first-talks.js";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const scenesOf = file => Object.fromEntries(JSON.parse(read(`data/dialogue/${file}.json`)).dialogues.map(scene => [scene.dialogue_id, scene]));
const characters = JSON.parse(read("data/characters.json"));
const characterIds = new Set((Array.isArray(characters) ? characters : Object.values(characters.characters || characters)).map(c => c.id));

// ---- 判定 ----------------------------------------------------------------------------
function freeSave() {
  const value = newState();
  Object.assign(value, { chapter: 4, phase: "cleared", day: 60, slot: 0 });
  value.flags = { _ch4_cleared: true };
  assert.equal(advanceToChapterFive(value), true);
  for (const scene of CH5_PROLOGUE) assert.equal(completeChapterFiveScene(value, scene.id), true, scene.id);
  return value;
}
const due = (id, value) => chapterFiveFirstTalkDue(id, value)?.scene || null;

// 第5章の自由行動: レヰ・神崎は最初の来店で読む。アダムはEDENの任意場面（二つのダブルアップル）の後だけ。
{
  const value = freeSave();
  assert.equal(due("rei", value), "ch5_rei_shop");
  assert.equal(due("kumicho", value), "ch2_kumicho_after_ch2");
  assert.equal(due("adam", value), null, "Adam's first Chapter 5 visit is the EDEN free scene");
  assert.equal(completeChapterFiveScene(value, "ch5_free_eden_adam"), true);
  assert.equal(due("adam", value), "ch5_adam_shop", "Adam's talk follows the EDEN free scene");
  // 一度だけ: 読んだ印があれば出さない。
  for (const id of ["rei", "kumicho", "adam"]) {
    const copy = structuredClone(value);
    copy.flags[chapterFiveFirstTalkSeenFlag(CH5_FIRST_TALKS[id])] = true;
    assert.equal(due(id, copy), null, `${id}: read once`);
  }
  // 通い店・ほかの人には出さない（オブジェクトの組み込みの名前も）。
  for (const id of ["naru", "minto", "ageha", "samechan", "sumi", "steve", "toString", "__proto__", undefined])
    assert.equal(due(id, value), null, String(id));
}
// 読んだ印の名前: 神崎は未接続だった頃の台本末尾の set_flag と同じ。ほかは章の間だけの会話と同じ形。
assert.equal(chapterFiveFirstTalkSeenFlag(CH5_FIRST_TALKS.kumicho), "ch2_kumicho_after_ch2_done");
assert.equal(chapterFiveFirstTalkSeenFlag(CH5_FIRST_TALKS.rei), "_talk_seen_ch5_rei_shop");
assert.equal(chapterFiveFirstTalkSeenFlag(CH5_FIRST_TALKS.adam), "_talk_seen_ch5_adam_shop");
// 旧保存に神崎の後日談の既読（ch2_kumicho_after_ch2_done）があれば、読み直させない。
{
  const value = freeSave();
  value.flags.ch2_kumicho_after_ch2_done = true;
  assert.equal(due("kumicho", value), null);
}
// 周回（NG+）では人物の記録として引き継がない（core/carry.js）。
for (const talk of Object.values(CH5_FIRST_TALKS)) {
  const flag = chapterFiveFirstTalkSeenFlag(talk);
  assert.equal(classifyFlag(flag), "person", flag);
  assert.equal(flagVerdict(flag), "reset", flag);
}
// 日を決めた日（勝負の前）は読める。勝負が始まった後・ほかの章・第5章として読めない保存では出さない（例外も出さない）。
{
  const value = freeSave();
  assert.equal(completeChapterFiveScene(value, "ch5_unrecorded_day"), true);
  assert.equal(recordChapterFiveScheduleDecision(value, "decide"), true);
  assert.equal(completeChapterFiveScene(value, "ch5_schedule_contact"), true);
  assert.equal(value.flags._ch5.part, "scheduled");
  assert.equal(due("rei", value), "ch5_rei_shop", "the day the match is set is still before the match");
  assert.equal(beginChapterFiveMatch(value), true);
  for (const id of Object.keys(CH5_FIRST_TALKS)) assert.equal(due(id, value), null, `${id}: not after the match starts`);
}
for (const chapter of [1, 2, 3, 4]) {
  const value = freeSave();
  value.chapter = chapter;
  for (const id of Object.keys(CH5_FIRST_TALKS)) assert.equal(due(id, value), null, `${id}: chapter ${chapter}`);
}
for (const broken of [value => { delete value.flags._ch5; }, value => { value.flags._ch5.part = "nowhere"; }]) {
  const value = freeSave();
  broken(value);
  for (const id of Object.keys(CH5_FIRST_TALKS)) assert.equal(due(id, value), null, `${id}: unreadable Chapter 5 save`);
}
assert.equal(due("rei", null), null);
assert.equal(CH5_FREE_SCENES.some(scene => scene.id === CH5_FIRST_TALKS.adam.after), true, "Adam waits for a real free scene");

// ---- 台本 ----------------------------------------------------------------------------
const REWARD_TEXT = /【[^】]+】.*上がった/;
for (const [id, talk] of Object.entries(CH5_FIRST_TALKS)) {
  const scene = scenesOf(talk.file)[talk.scene];
  assert(scene?.lines?.length, `${talk.file}:${talk.scene}`);
  // 代金・能力・好感度・既読は来店の処理が付ける。台本に報酬・既読・分岐・背景の指定を置かない。
  assert.equal(scene.metadata?.bg, undefined, `${talk.scene}: the shop visit sets the background`);
  for (const line of scene.lines) {
    assert.equal(line.type, undefined, `${talk.scene}: plain lines only (${JSON.stringify(line)})`);
    assert.equal(typeof line.text, "string");
    assert.doesNotMatch(line.text, REWARD_TEXT, `${talk.scene}: no stat text`);
    assert.doesNotMatch(line.text, /\n/, `${talk.scene}: no manual line breaks`);
    assert(line.speaker === "" || characterIds.has(line.speaker) || line.speaker === "customer", `${talk.scene}: ${line.speaker}`);
  }
  const speakers = new Set(scene.lines.map(line => line.speaker));
  assert(speakers.has(id) && speakers.has("hajime"), `${talk.scene}: ${id} and Hajime talk`);
  // 第5章の勝負の前の会話: 世界大会の後で、博士との勝負をまだ終えていない。
  const text = scene.lines.map(line => line.text).join("\n");
  assert.doesNotMatch(text, /勝負(?:に|は)(?:勝|負)|勝負の後|引き分け/, `${talk.scene}: written before the match`);
}
// 神崎: 一人称は俺・はじめは「あんちゃん」。「〜しやす」は使わない（characters.json の voice）。素性は語らない。
{
  const lines = scenesOf("ch2_kumicho").ch2_kumicho_after_ch2.lines;
  const kanzaki = lines.filter(line => line.speaker === "kumicho").map(line => line.text).join("\n");
  assert.match(kanzaki, /あんちゃん/);
  assert.doesNotMatch(kanzaki, /しやす|しやし|小僧|僕|私/);
  assert.doesNotMatch(kanzaki, /組|カタギ|足を洗|極道/, "Kanzaki's past stays unconfirmed");
  const all = lines.map(line => line.text).join("\n");
  // 世界大会の後の場面（第2章の大会直後の「優勝おめでとう」の版ではない）。県大会の勝ちを見抜いていた。
  assert.match(all, /世界/);
  assert.match(all, /県大会/);
  assert.match(all, /持ち点の表/);
  assert.doesNotMatch(all, /大会が終わって、神崎煙草店に立ち寄った|五厘/, "the old post-Chapter-2 version is gone");
  // 旧ID（初対面版）は、同じ後日談へ進むだけ。
  const alias = scenesOf("ch2_kumicho").ch2_kumicho_after_ch2_firstshop;
  assert.deepEqual(alias.lines, [{ type: "jump", next_id: "ch2_kumicho_after_ch2" }]);
}
// はじめは店主たちに敬語で話す（レヰ 25歳・アダム 28歳・神崎 53歳。第2章までの場面と同じ）。
for (const [file, id] of [["ch5_shops", "ch5_rei_shop"], ["ch5_shops", "ch5_adam_shop"], ["ch2_kumicho", "ch2_kumicho_after_ch2"]]) {
  const hajime = scenesOf(file)[id].lines.filter(line => line.speaker === "hajime" && !/^（/.test(line.text)).map(line => line.text);
  assert(hajime.length >= 2, id);
  for (const text of hajime) assert.doesNotMatch(text, /(?:だよ|だね|じゃん|だよね|するよ|してたね)$/, `${id}: ${text}`);
}

// ---- 接続 ----------------------------------------------------------------------------
// 能力はいつもの来店と同じ（アダムは daily/spots.js の CHAR_STAT、神崎・レヰは ch2-preparation.js の通い訪問）。
assert.match(read("remake/js/daily/spots.js"), new RegExp(`CHAR_STAT = \\{[^}]*adam: "${CH5_FIRST_TALKS.adam.stat}"`));
assert.match(read("remake/js/chapters/ch2-preparation.js"),
  new RegExp(`const stat = \\{[^}]*kumicho: "${CH5_FIRST_TALKS.kumicho.stat}", rei: "${CH5_FIRST_TALKS.rei.stat}"`));
// 来店は ch5-shops.js の performChapterFiveShop が受け持つ（ch5-daily.js が全ての行き先で先に呼ぶ）。
const shops = read("remake/js/chapters/ch5-shops.js");
assert.match(shops, /import \{[^}]*chapterFiveFirstTalkDue[^}]*\} from "\.\/ch5-first-talks\.js";/);
// EDEN の任意場面より先に performChapterFiveShop が呼ばれるので、アダムは任意場面の既読で待つ（上の判定）。
const daily = read("remake/js/chapters/ch5-daily.js");
const shopCallAt = daily.indexOf("performChapterFiveShop(spot, options)");
const edenFreeAt = daily.indexOf('"ch5_free_eden_adam"');
assert(shopCallAt >= 0 && edenFreeAt >= 0, "ch5-daily.js: performChapterFiveShop の呼び出しと EDEN の任意場面が見つからない");
assert(shopCallAt < edenFreeAt);

console.log("PASS: Chapter 5 first talks (Adam, Rei, Kanzaki): gating, read once, carry and scripts");

// 日程を決める前の必須場面も、この quick 入口で検査する。
await import("./ch5_unrecorded.mjs");
