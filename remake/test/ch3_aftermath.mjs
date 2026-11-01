import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { chapterDay } from "../js/core/chapter-clock.js";
import { playerRegion } from "../js/core/tokyo-visits.js";
import { CH3_AFTERMATH_SCENES, canRunChapterThreeAftermath, beginChapterThreeAftermath,
  chapterThreeAftermathProgress, completeChapterThreeAftermathScene } from "../js/chapters/ch3-aftermath-progress.js";
import { agehaConfessionDue, beginAgehaConfessionDay, AGEHA_CONFESSION_DAY_AFTER_WIN, AGEHA_HEART_MAX_PTS } from "../js/chapters/ch3-romance-entry.js";
import { AFFINITY_RANK_PTS } from "../js/core/stats.js";
assert.equal(AGEHA_HEART_MAX_PTS, AFFINITY_RANK_PTS[5], "ageha's ♥5 threshold must follow the shared affinity table");

const ids = ["ch3_abyss_hotel", "ch3_mashiro_recovery", "ch3_naru_reconcile", "ch3_enmaku_cleanup", "ch3_home_customer", "ch3_tsumugi_result", "ch3_ageha_reunion"];
assert.deepEqual(CH3_AFTERMATH_SCENES.map(scene => scene.id), ids);
const dialogues = JSON.parse(readFileSync(new URL("../../data/dialogue/ch3_main.json", import.meta.url))).dialogues;
for (const id of ids) assert(dialogues.some(dialogue => dialogue.dialogue_id === id && dialogue.lines?.length), id);
const tsumugiResult = dialogues.find(dialogue => dialogue.dialogue_id === "ch3_tsumugi_result");
assert(tsumugiResult.lines.some(line => line.text?.includes("入選しました")));
assert(tsumugiResult.lines.some(line => line.cg_id === "cg_ch1_tsumugi_heart_art"));
assert(tsumugiResult.lines.some(line => line.condition_type === "flag" && line.flag === "_tsumugi_contest_eve"));
assert(!tsumugiResult.metadata?.add_affinity && !tsumugiResult.lines.some(line => line.affinity || line.type === "apply"));

// #1052 §3/§4: preferences and recovery must agree with the shared runtime data.
const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url)));
const characters = Object.fromEntries(readData("characters").map(row => [row.id, row]));
assert.equal(characters.kuze.favorite_flavor, "アフサール アールグレイ");
assert.match(characters.kuze.specialty_flavor, /アールグレイ/);
assert.equal(characters.mashiro.favorite_flavor, "ブラックティー");
assert.match(characters.mashiro.specialty_flavor, /ブラックティー/);
assert.match(characters.mashiro.description, /ダークリーフやシガーリーフ/);
const flavors = Object.fromEntries(readData("flavors").flavors.map(row => [row.id, row]));
assert.equal(flavors.black_tea.name, "アフサール ブラックティー");
assert.equal(flavors.black_tea.leaf, "blond");
assert.equal(flavors.dark_earlgrey.leaf, "dark");
assert.equal(flavors.dark_earlgrey.name, "アルファーヘブン ダーク アールグレイ");
const scenes = Object.fromEntries([
  ...dialogues, ...readData("dialogue/ch3_double_apple").dialogues,
  ...readData("dialogue/ch3_mashiro").dialogues, ...readData("dialogue/ch3_rivals").dialogues,
].map(row => [row.dialogue_id, row]));
const text = id => scenes[id].lines.map(line => line.text || "").join("\n");
assert.match(text("ch3_kuze_first"), /柑橘とアールグレイ/);
assert.match(text("ch3_work_without_taste"), /ブラックティーが得意/);
assert.match(text("ch3_mashiro_play_1"), /自分用のダーク/);
assert.match(text("ch3_double_apple_incident"), /分からない」と言ったら、終わる気がした/);
assert.doesNotMatch(text("ch3_double_apple_incident"), /味がしない/);
assert.match(text("ch3_abyss_recovery"), /十分な味.*薄く思え.*炭を足し/);
assert.match(text("ch3_abyss_recovery"), /焦げた苦さは分かる/);
assert.match(text("ch3_abyss_recovery"), /ノート.*ましろの感想/);
assert.match(text("ch3_abyss_recovery"), /受診/);
assert.match(text("ch3_work_without_taste"), /次の受診日/);
assert.match(text("ch3_taste_return"), /明日また迷っても/);
assert.match(scenes.ch3_abyss_hotel.comment, /優勝で完治させない/);

function winningSave() {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "tournament", day: 42, slot: 0, money: 23456,
    stamina: 41, flavorStock: { mint: 8.5, double_apple: 4 } });
  value.flags = {
    _ch3_intro: { startDay: 29, stage: 18, titleSeen: true },
    _ch3_tournament: { stage: "complete", result: { rank: 1, win: true, votes: { nagumo: { hajime: 10 } } } },
    _ch3_tournament_won: true,
  };
  value.lovers = ["minto"];
  value.relationshipMemories = ["volk_measure"];
  return value;
}

for (const change of [
  value => { value.chapter = 2; },
  value => { delete value.flags._ch3_tournament_won; },
  value => { value.flags._ch3_tournament_won = false; },
  value => { value.flags._ch3_tournament.result.rank = 4; },
  value => { value.flags._ch3_tournament.result.win = false; },
  value => { value.flags._ch3_tournament.stage = "victory"; },
]) {
  const invalid = winningSave(); change(invalid);
  const prior = structuredClone(invalid);
  assert.equal(canRunChapterThreeAftermath(invalid), false);
  assert.equal(beginChapterThreeAftermath(invalid), false);
  assert.deepEqual(invalid, prior, "A non-winning save entered the aftermath");
}

const value = winningSave(), before = structuredClone(value);
assert.equal(canRunChapterThreeAftermath(value), true);
assert.deepEqual(beginChapterThreeAftermath(value), { version: 3, winDay: 42, stage: 0 });
assert.equal(value.phase, "aftermath");
assert.equal(value.slot, 1);
assert.equal(value.day, 42);
assert.equal(chapterDay(value), 14);
assert(!value.flags._ch3_cleared);
for (const key of ["money", "stamina", "stats", "statXp", "flavorStock", "owned", "equip",
  "lovers", "loverSince", "relationshipMemories", "contacts", "inbox", "tournament"])
  assert.deepEqual(value[key], before[key], `Aftermath changed ${key}`);
assert.deepEqual(value.flags._ch3_tournament, before.flags._ch3_tournament);

const dates = [[42, 1], [43, 0], [43, 1], [44, 0], [44, 1], [44, 1], [45, 0]];
for (let index = 0; index < ids.length; index++) {
  assert.deepEqual([value.day, value.slot], dates[index], `Wrong date before ${ids[index]}`);
  assert.equal(chapterThreeAftermathProgress(value).stage, index);
  assert.equal(playerRegion(value), index <= 3 ? "tokyo" : "home", `Wrong region before ${ids[index]}`);
  const wrong = structuredClone(value);
  assert.equal(completeChapterThreeAftermathScene(value, "ch3_national_result"), false);
  assert.deepEqual(value, wrong, "The victory announcement advanced the aftermath");
  assert.equal(completeChapterThreeAftermathScene(value, ids[index]), true);
  const checkpoint = structuredClone(value);
  assert.equal(completeChapterThreeAftermathScene(value, ids[index]), false);
  assert.deepEqual(value, checkpoint, "A scene committed twice");
  // A JSON save/load round trip keeps the exact next scene and elapsed date.
  const reloaded = JSON.parse(JSON.stringify(value));
  assert.deepEqual(beginChapterThreeAftermath(reloaded), reloaded.flags._ch3_aftermath);
  assert.deepEqual(reloaded, value, "Reopening the aftermath reset its checkpoint");
}
assert.equal(value.flags._ch3_aftermath.stage, ids.length);
assert.equal(value.flags._ch3_cleared, true);
assert.equal(value.phase, "cleared");
assert.equal(value.chapter, 3);
assert.equal(value.day, 45);
assert.equal(chapterDay(value), 17);
assert.equal(value.flags._ch3_tournament_won, true);
assert.deepEqual(value.flags._ch3_tournament, before.flags._ch3_tournament);
assert(!value.flags._ch4_intro);
// #1988: 再会のままでは告白は出ず、第3章完へ。恋愛ルート（♥3で恋愛寄り・♥5）だけ、再会の翌日に告白の日へ進む。
assert.equal(agehaConfessionDue(value), false, "no ♥3 answer: the reunion ends the chapter");
assert.equal(beginAgehaConfessionDay(value), false);
assert.equal(value.day, 45);
{
  const route = structuredClone(value);
  route.romanceChoices = { bond_q1_ageha: { char: "ageha", value: 1, day: 20 } };
  route.affinity.ageha = 66;
  assert.equal(agehaConfessionDue(route), true);
  assert.equal(beginAgehaConfessionDay(route), true);
  assert.equal(route.day, 42 + AGEHA_CONFESSION_DAY_AFTER_WIN);
  assert.equal(route.day, value.day + 1, "the confession is the day after the reunion");
  assert.equal(route.slot, 0);
  assert.equal(playerRegion(route), "home");
  assert.equal(route.flags._ch3_cleared, true);
  assert.equal(chapterThreeAftermathProgress(route).stage, ids.length, "the aftermath checkpoint is untouched");
  const again = structuredClone(route);
  assert.equal(beginAgehaConfessionDay(again), false);
  assert.deepEqual(again, route);
}
assert.throws(() => chapterThreeAftermathProgress({ ...value, flags: { ...value.flags, _ch3_aftermath: { ...value.flags._ch3_aftermath, stage: 4 } } }));
for (const [oldStage, expectedStage] of [[0, 0], [2, 2], [3, 4], [4, 6], [5, 7]]) {
  const legacy = winningSave();
  legacy.flags._ch3_aftermath = { version: 1, winDay: 42, stage: oldStage };
  legacy.flags._ch3_cleared = oldStage === 5;
  assert.equal(chapterThreeAftermathProgress(legacy).stage, expectedStage);
  assert.equal(legacy.flags._ch3_aftermath.version, 3);
  assert.equal(!!legacy.flags._ch3_cleared, oldStage === 5);
}
// 煙幕の片づけを足す前の版2。片づけ前なら読み、帰郷の夜以降の保存は日時を戻さず先へ進む。
for (const [oldStage, expectedStage] of [[0, 0], [2, 2], [3, 4], [5, 6], [6, 7]]) {
  const legacy = winningSave();
  legacy.flags._ch3_aftermath = { version: 2, winDay: 42, stage: oldStage };
  legacy.flags._ch3_cleared = oldStage === 6;
  assert.equal(chapterThreeAftermathProgress(legacy).stage, expectedStage);
  assert.equal(legacy.flags._ch3_aftermath.version, 3);
  assert.equal(!!legacy.flags._ch3_cleared, oldStage === 6);
  assert.equal(playerRegion(legacy), oldStage >= 3 ? "home" : "tokyo", "A home-night save went back to Tokyo");
}
console.log("PASS: Chapter 3 victory aftermath saves seven scenes once, crosses Tokyo and home dates, preserves completed old saves, and never repeats the tournament");
