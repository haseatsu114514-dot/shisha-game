// 第2章の本筋の補充（SPC28）: 2-2 耳鼻科の受診（DAY6の朝）・2-4 なるの店で昼（DAY8の朝）・2-5 A 吸い方講座（DAY9の夜）・
// B 縮んだエプロン（県大会の控室）。出す時・台本・正本との食い違いが無いこと。
// node remake/test/ch2_story_extra.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CH2_NIGHTS, CH2_DAY_SCENES, chapterTwoDaySceneDue } from "../js/chapters/ch2-story-data.js";

const read = name => JSON.parse(readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url), "utf8"));
const rows = read("ch2_story_extra").dialogues;
const dialogues = Object.fromEntries(rows.map(row => [row.dialogue_id, row]));
const text = id => [...dialogues[id].lines, ...Object.values(dialogues[id].branches || {}).flat()].map(line => line.text || "").join("\n");
const night = day => CH2_NIGHTS.find(entry => entry.day === day);

// ---- 台本: ファイルの場面は、夜の本編か昼の本筋のどちらかから必ず読まれる
{
  const used = [...CH2_NIGHTS.flatMap(entry => entry.steps).filter(step => step.file === "ch2_story_extra").map(step => step.id),
    ...CH2_DAY_SCENES.map(scene => scene.id)];
  assert.deepEqual([...used].sort(), Object.keys(dialogues).sort(), "every scene is wired");
  for (const scene of CH2_DAY_SCENES) assert.equal(scene.file, "ch2_story_extra", scene.id);
  for (const row of rows) assert(row.lines.length > 0, row.dialogue_id);
}

// ---- 出す時: その章内日の朝（昼の行動の前）だけ。読んだら出さない。前提が無ければ出さない。後の日には持ち越さない
{
  const save = (day, flags = {}, slot = 0) => ({ chapter: 2, slot, flags: { ...flags }, day: 14 + day });
  const due = (day, flags, slot) => chapterTwoDaySceneDue(save(day, flags, slot), day, dialogues)?.id || null;
  assert.equal(due(6, { _ch2_taste_distant: true }), "ch2_ent_clinic");
  assert.equal(due(6, {}), null, "only after the taste went distant (DAY5)");
  assert.equal(due(6, { _ch2_taste_distant: true }, 1), null, "not once the daytime action is gone");
  assert.equal(due(6, { _ch2_taste_distant: true, _ch2_read_ch2_ent_clinic: true }), null, "once");
  assert.equal(due(7, { _ch2_taste_distant: true }), null, "not carried to a later day");
  assert.equal(due(8, {}), "ch2_naru_lunch");
  assert.equal(due(8, { _ch2_read_ch2_naru_lunch: true }), null);
  for (const day of [2, 3, 4, 5, 9, 10, 11, 12, 13]) assert.equal(due(day, { _ch2_taste_distant: true }), null, `DAY${day}`);
  assert.equal(chapterTwoDaySceneDue({ chapter: 3, slot: 0, flags: { _ch2_taste_distant: true } }, 6, dialogues), null, "chapter 2 only");
  assert.equal(chapterTwoDaySceneDue(save(6, { _ch2_taste_distant: true }), 6, {}), null, "not without the script");
  // 夜の本編: 吸い方講座は試煙会の後・苺の前。読み終えた保存には足さない
  const ids = day => night(day).steps.map(step => step.id);
  // C（盛りすぎた写真）は 2026-11-15 オーナー指示で外した（SPC29）
  assert.deepEqual(ids(3).slice(0, 2), ["ch2_naru_warm", "remake_ch2_ageha_scout"]);
  assert.deepEqual(ids(9).slice(1, 4), ["remake_ch2_ageha_tasting", "ch2_ageha_lesson", "ch2_strawberry_sample"]);
  const step = (day, id) => night(day).steps.find(entry => entry.id === id);
  assert(step(9, "ch2_ageha_lesson").when({ flags: {} }));
  assert(!step(9, "ch2_ageha_lesson").when({ flags: { _ch2_read_ch2_strawberry_sample: true } }));
  // 夜の数は増やさない（DAY2・8 は空けたまま）
  assert.deepEqual(CH2_NIGHTS.map(entry => entry.day), [3, 4, 5, 6, 7, 9, 10, 11, 12, 13]);
}

// ---- 正本との食い違い（brand/story_and_structure.md「味の不調と受診」・STK22）
{
  const clinic = text("ch2_ent_clinic");
  assert.match(clinic, /経過を見/); assert.match(clinic, /眠り/); assert.match(clinic, /食事/); assert.match(clinic, /また来て/);
  assert.match(clinic, /吸い続けるのは、やめて/, "stop smoking to check the taste");
  assert.doesNotMatch(clinic, /心因|ストレス|気のせい|治りました|治る/, "no psychogenic verdict and no cure");
  assert.match(clinic, /スミさんに話そう/, "leads into the night's ch2_lingering_smell");
  const smell = read("ch2_main").dialogues.find(row => row.dialogue_id === "ch2_lingering_smell").lines.map(line => line.text || "").join("\n");
  assert.doesNotMatch(smell, /今日の昼、耳鼻科/, "the night can be postponed to DAY7, so it does not say 'today'");
  assert.match(smell, /耳鼻科で受けた味と匂いの検査/);
  const lunch = text("ch2_naru_lunch");
  assert.doesNotMatch(lunch, /ストロベリー|課題/, "the tournament flavour is announced at the DAY9 tasting");
  assert.doesNotMatch(lunch, /寝ろ|食えよ|ちゃんと食/, "no lecture on food and sleep (STK22)");
  assert.match(lunch, /常連の親子/); assert.match(lunch, /苺/, "the request Naru fulfils on DAY11");
  const spoken = id => [...dialogues[id].lines, ...Object.values(dialogues[id].branches || {}).flat()].filter(line => !line.type);
  assert.deepEqual([...new Set(spoken("ch2_naru_lunch").map(line => line.speaker))].sort(), ["", "hajime", "naru"]);
  // #3922: 常連の親子は、DAY3の祝いで「次はどんなお客さんに？」を選んだ保存だけ「こないだ話した」。選ばなかった保存は、ここで初めて聞く
  const lunchRows = dialogues.ch2_naru_lunch.lines, gate = lunchRows.find(line => line.type === "condition");
  assert.equal(gate.flag, "_ch2_naru_warm_customers");
  const branchText = (id, key) => dialogues[id].branches[key].map(line => line.text).join("\n");
  assert.match(branchText("ch2_naru_lunch", gate.next_true), /こないだ話した常連の親子/);
  assert.match(branchText("ch2_naru_lunch", gate.next_false), /常連に親子/);
  assert.doesNotMatch(branchText("ch2_naru_lunch", gate.next_false), /こないだ|前に話した/, "not heard on DAY3");
  assert.match(lunchRows[lunchRows.indexOf(gate) + 1].text, /苺の一台/, "both lead into the strawberry request");
  // #3922: 翌日の試煙会は、昼を読んだ保存では依頼を「昨日言ったろ」と受ける。昼が飛んだ保存（病気の朝）は試煙会が初出のまま
  const tasting = read("ch2_ageha_story").dialogues.find(row => row.dialogue_id === "remake_ch2_ageha_tasting");
  const lunchGates = tasting.lines.filter(line => line.type === "condition" && line.flag === "_ch2_read_ch2_naru_lunch");
  assert.equal(lunchGates.length, 2);
  const tastingBranch = key => tasting.branches[key].map(line => line.text).join("\n");
  const [order, smile] = lunchGates;
  assert.match(tastingBranch(order.next_true), /昨日言ったろ/);
  assert.match(tastingBranch(order.next_false), /常連の娘さんに頼まれて/);
  assert.match(tastingBranch(smile.next_true), /昨日の昼より/);
  assert.match(tastingBranch(smile.next_false), /いつもより少しだけ、短い/);
  assert(tasting.lines.indexOf(order) < tasting.lines.indexOf(smile));
  assert.deepEqual([...new Set(dialogues.ch2_ageha_lesson.lines.filter(line => typeof line.text === "string").map(line => line.speaker))].sort(), ["", "ageha", "hajime"]);
  assert.match(text("ch2_ageha_lesson"), /太くて長いのを、奥まで、ゆっくり/);
  // B: 控室の冒頭。あげはの「手を隠した日」の枝はそのまま残す
  const lobby = read("ch2_tournament").dialogues.find(row => row.dialogue_id === "ch2_tournament_lobby");
  const lobbyText = [...lobby.lines, ...Object.values(lobby.branches).flat()].map(line => line.text || "").join("\n");
  assert.match(lobbyText, /エプロン/); assert.match(lobbyText, /カシャ/);
  assert(lobby.lines.some(line => line.flag === "_ch2_ageha_secret") && lobby.branches.secret.length);
  assert(lobby.branches.known.some(line => line.text === "撮った。県大会の記念。今日は、同じ舞台だ"));
}

// ---- VOL17（#3097 計画 2-10）: 本筋の間の場面3本。自由な行動・夜を使わず、本筋の順・選択・報酬を変えない
{
  const ids = day => night(day).steps.map(step => step.id);
  const step = (day, id) => night(day).steps.find(entry => entry.id === id);
  // DAY4: 満席の閉店前の手伝い → 炭の事故。事故を読んだ保存（途中保存）には足さない
  assert.deepEqual(ids(4), ["ch2_full_house_help", "ch2_sofa_burn", "ch2_abyss_baito"]);
  assert(step(4, "ch2_full_house_help").when({ flags: {} }));
  assert(!step(4, "ch2_full_house_help").when({ flags: { _ch2_read_ch2_sofa_burn: true } }), "not inserted after the accident");
  // DAY10: あげは → スミさんの沈黙 → 帰り道の採点表（DAY11の「開いたままの採点表」の前）
  assert.deepEqual(ids(10), ["remake_ch2_ageha_slump", "ch2_sumi_silence", "ch2_phone_score_sheet"]);
  // DAY7の朝: 行動を使わない家の場面。耳鼻科を読んだ保存だけ、その朝だけ、一度だけ
  const notes = CH2_DAY_SCENES.find(scene => scene.id === "ch2_morning_notes");
  assert.equal(notes.day, 7); assert.equal(notes.keepsAction, true);
  assert.deepEqual(CH2_DAY_SCENES.filter(scene => scene.keepsAction).map(scene => scene.id), ["ch2_morning_notes"],
    "the clinic and Naru's lunch still use the daytime action");
  const save = (day, flags = {}, slot = 0) => ({ chapter: 2, slot, flags: { ...flags }, day: 14 + day });
  const home = (day, flags, slot) => chapterTwoDaySceneDue(save(day, flags, slot), day, dialogues, { keepsAction: true })?.id || null;
  const clinicRead = { _ch2_taste_distant: true, _ch2_read_ch2_ent_clinic: true };
  assert.equal(home(7, clinicRead), "ch2_morning_notes");
  assert.equal(home(7, { _ch2_taste_distant: true }), null, "only after the clinic");
  assert.equal(home(7, clinicRead, 1), null, "not on a sick morning / once the morning is gone");
  assert.equal(home(7, { ...clinicRead, _ch2_read_ch2_morning_notes: true }), null, "once");
  for (const day of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13]) assert.equal(home(day, clinicRead), null, `DAY${day}`);
  assert.equal(chapterTwoDaySceneDue(save(7, clinicRead), 7, dialogues), null, "the daytime query keeps its meaning (no errand notice on DAY7)");
  assert.equal(chapterTwoDaySceneDue({ chapter: 3, slot: 0, flags: clinicRead }, 7, dialogues, { keepsAction: true }), null, "chapter 2 only");
  // 夜を増やさない・自由な夜（DAY2・8）を塞がない
  assert.deepEqual(CH2_NIGHTS.map(entry => entry.day), [3, 4, 5, 6, 7, 9, 10, 11, 12, 13]);
  // 報酬・選択・面識の操作を持たない
  for (const id of ["ch2_full_house_help", "ch2_morning_notes", "ch2_phone_score_sheet"]) {
    const all = [...dialogues[id].lines, ...Object.values(dialogues[id].branches || {}).flat()];
    assert(!all.some(line => ["apply", "note", "choice", "set_flag", "show_cg"].includes(line.type)), `${id}: no reward, choice or flag`);
    assert.doesNotMatch(text(id), /【|上がった|♥|好感度/, `${id}: no reward cue`);
    assert.deepEqual([...new Set(all.filter(line => typeof line.text === "string").map(line => line.speaker))].filter(Boolean).sort(),
      id === "ch2_full_house_help" ? ["hajime", "sumi"] : ["hajime"], `${id}: speakers`);
  }
  // 正本との食い違い: 店の匂いは残る匂いの場面の一度だけ・スミさんは顔色や食事を言わない（STK22）・心因と断定しない
  const help = text("ch2_full_house_help"), morning = text("ch2_morning_notes"), sheet = text("ch2_phone_score_sheet");
  assert.match(help, /エプロン/, "the apron that shrinks before the tournament lobby");
  assert.match(help, /預けていたノート/, "the DAY4 beat: picking up the notebook");
  assert.doesNotMatch(help, /焦げ|匂い|鉄仮面|顔色|眠れ|寝て/);
  assert.doesNotMatch(morning, /心因|ストレス|気のせい|治っ|スミさん|夕飯|台を組/);
  assert.match(morning, /書き留め/); assert.match(morning, /吸って確かめない/);
  assert.match(sheet, /練習の採点表/, "the sheet that is open on DAY11");
  assert.doesNotMatch(sheet, /なるさん|KEMURIKUSA|持ち点|審査/, "no foreshadowed split, no tournament scoring");
  const confrontation = read("ch2_isolation").dialogues.find(row => row.dialogue_id === "ch2_naru_confrontation");
  assert(confrontation.lines.some(line => /練習の採点表/.test(line.text || "")), "DAY11 still shows the open practice sheet");
  // 採点表のメモ: 受診を読んだ保存だけ耳鼻科のメモ、朝のメモを読んだ保存だけ「吸って確かめない」
  const sheetRows = dialogues.ch2_phone_score_sheet;
  const clinicGate = sheetRows.lines.find(line => line.type === "condition");
  assert.equal(clinicGate.flag, "_ch2_read_ch2_ent_clinic"); assert(!clinicGate.next_false);
  const notesGate = sheetRows.branches[clinicGate.next_true].find(line => line.type === "condition");
  assert.equal(notesGate.flag, "_ch2_read_ch2_morning_notes");
  assert.match(sheetRows.branches[notesGate.next_true].map(line => line.text).join(""), /吸って確かめない/);
  assert.doesNotMatch(sheetRows.branches[notesGate.next_false].map(line => line.text).join(""), /吸って確かめない|朝/);
  assert.doesNotMatch(sheetRows.lines.map(line => line.text || "").join(""), /耳鼻科|吸って確かめない/, "the clinic memo only on the gated branch");
}
console.log("ch2_story_extra OK");
