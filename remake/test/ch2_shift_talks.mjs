// #3097 第1弾: 第2章のtonariのシフト上がりの会話（daily/tonari.js の CH2_SHIFT_TALKS・data/dialogue/ch2_tonari_talks.json）
// ① 第2章だけ・未読を先頭から一本・一度だけ。条件（章内日・面識・本編の既読・つむぎの在店）を守る
// ② 台本は全部そろい、読み込み一覧（ch2-city-data.js の CH2_SHIFT_TALK_IDS）と同じ並び
// ③ 上がりの会話は♥5後の場面が無い日だけ。読み終えたら _talk_seen_<ID>、台本は報酬・恋愛の命令を持たない
// node remake/test/ch2_shift_talks.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const tonari = read("remake/js/daily/tonari.js");

// ---- 実 tonari.js の表と判定だけを取り出して評価する（画面・状態の部品は読み込まない） ----
const start = tonari.indexOf("const ch2DayOf");
const end = tonari.indexOf("\n}\n", tonari.indexOf("export function ch2ShiftTalkDue")) + 3;
assert(start > 0 && end > start, "CH2_SHIFT_TALKS block found in tonari.js");
const ctx = vm.createContext({});
vm.runInContext(`${tonari.slice(start, end).replace(/export /g, "")}\nthis.T = CH2_SHIFT_TALKS; this.due = ch2ShiftTalkDue;`, ctx);
const { T, due } = ctx;
const ids = Array.from(T, t => t.id);

// ② 台本と読み込み一覧
const file = JSON.parse(read("data/dialogue/ch2_tonari_talks.json"));
const dialogues = Object.fromEntries(file.dialogues.map(d => [d.dialogue_id, d]));
assert.deepEqual(Object.keys(dialogues).sort(), [...ids].sort(), "every shift talk has a script and no script is unreachable");
const cityData = read("remake/js/chapters/ch2-city-data.js");
const listed = [...cityData.match(/CH2_SHIFT_TALK_IDS = Object\.freeze\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
assert.deepEqual(listed, ids, "loader list matches CH2_SHIFT_TALKS order");
assert(/files\.ch2_tonari_talks = \[\.\.\.CH2_SHIFT_TALK_IDS\]/.test(cityData), "loaded in the chapter 2 preparation period");

// ① 判定
const save = (patch = {}) => ({ chapter: 2, day: 16, slot: 0, met: {}, flags: { _ch2_day1: { startDay: 15 } }, ...patch,
  flags: { _ch2_day1: { startDay: 15 }, ...(patch.flags || {}) } });
const seen = (...list) => Object.fromEntries(list.map(id => [`_talk_seen_${id}`, true]));
assert.equal(due(save(), dialogues), "ch2_shift_talk_fare", "DAY2: the fare talk first");
for (const chapter of [1, 3, 4, 5]) assert.equal(due(save({ chapter }), dialogues), null, `not in chapter ${chapter}`);
assert.equal(due(save(), {}), null, "scripts not loaded: nothing");
assert.equal(due(save({ day: 15 }), dialogues), null, "DAY1: no shift talk yet");
// 三軒の話は三人と面識がある時だけ
assert.equal(due(save({ flags: seen("ch2_shift_talk_fare") }), dialogues), "ch2_shift_talk_student", "DAY2 without the three shops");
assert.equal(due(save({ met: { ageha: true, kumicho: true, rei: true }, flags: seen("ch2_shift_talk_fare") }), dialogues), "ch2_shift_talk_three_shops");
assert.equal(due(save({ met: { ageha: true, kumicho: true }, flags: seen("ch2_shift_talk_fare") }), dialogues) === "ch2_shift_talk_three_shops", false);
// 夕飯の話は DAY6 の ch2_lingering_smell の後だけ
const early = seen("ch2_shift_talk_fare", "ch2_shift_talk_three_shops");
assert.notEqual(due(save({ day: 22, flags: early }), dialogues), "ch2_shift_talk_supper");
assert.equal(due(save({ day: 22, flags: { ...early, _ch2_read_ch2_lingering_smell: true } }), dialogues), "ch2_shift_talk_supper");
// レシートは DAY3 から
assert.notEqual(due(save({ day: 16, flags: early }), dialogues), "ch2_shift_talk_receipts");
assert.equal(due(save({ day: 17, flags: early }), dialogues), "ch2_shift_talk_receipts");
// つむぎ同席は、面識があって店にいる日、DAY13 以外
const beforeTsumugi = seen("ch2_shift_talk_fare", "ch2_shift_talk_three_shops", "ch2_shift_talk_supper", "ch2_shift_talk_receipts", "ch2_shift_talk_student");
const ts = (patch, here) => due(save({ day: 20, met: { tsumugi: true }, ...patch, flags: { ...beforeTsumugi, ...(patch.flags || {}) } }), dialogues, { tsumugiHere: here });
assert.equal(ts({}, true), "ch2_shift_talk_tsumugi_board");
assert.equal(ts({}, false), "ch2_shift_talk_one_hose", "Tsumugi not at tonari today");
assert.equal(ts({ met: {} }, true), "ch2_shift_talk_one_hose", "not met yet");
assert.equal(ts({ day: 27 }, true), "ch2_shift_talk_one_hose", "not on DAY13");
// 全部読んだら定型へ
assert.equal(due(save({ day: 20, met: { tsumugi: true }, flags: seen(...ids) }), dialogues, { tsumugiHere: true }), null, "each read once");

// ③ 接続と台本の中身
const fn = tonari.slice(tonari.indexOf("async function afterShiftSumiTalk"), tonari.indexOf("export function chooseDrill"));
assert(/const ch2Talk = after \? null : ch2ShiftTalkDue\(state, DB\.dialogues, \{ tsumugiHere: tsumugiAtTonari\(state\) \}\)/.test(fn), "only when no ♥5 after-scene");
assert(/after\?\.scene \|\| ch2Talk \|\| "remake_sumi_after_shift"/.test(fn), "falls back to the usual line");
assert(/if \(ch2Talk\) state\.flags\[`_talk_seen_\$\{ch2Talk\}`\] = true/.test(fn), "marked read only after finishing");
for (const d of file.dialogues) {
  for (const line of d.lines) {
    assert(!line.type, `${d.dialogue_id}: no commands (no affinity, flags or rewards from the script)`);
    assert.equal(typeof line.text, "string");
    if (line.speaker) assert(!line.text.endsWith("。"), `${d.dialogue_id}: no 句点 at the end of a spoken line`);
  }
  assert(!/(が(少し|かなり|大きく)?上がった|好感度|告白|恋人|付き合)/.test(JSON.stringify(d)), `${d.dialogue_id}: no growth cue or romance`);
}
console.log(`PASS ch2 shift talks: ${ids.length} talks, chapter 2 only, read once in order, gated by day/met/story/Tsumugi's presence`);
