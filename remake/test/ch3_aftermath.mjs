import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { chapterDay } from "../js/core/chapter-clock.js";
import { playerRegion } from "../js/core/tokyo-visits.js";
import { CH3_AFTERMATH_SCENES, CH3_AFTERMATH_DETOURS, canRunChapterThreeAftermath, beginChapterThreeAftermath,
  chapterThreeAftermathProgress, completeChapterThreeAftermathScene, availableAftermathDetours,
  completeAftermathDetour, CH3_AFTERMATH_LESSONS, availableAftermathLessons, CH3_AFTERMATH_FINALES,
  availableAftermathFinales, AFTERMATH_HEART_PTS } from "../js/chapters/ch3-aftermath-progress.js";
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
assert.equal(characters.saku.favorite_flavor, "アフサール アールグレイ");
assert.match(characters.saku.specialty_flavor, /アールグレイ/);
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
assert.match(text("ch3_saku_first"), /柑橘とアールグレイ/);
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
    _ch3_tournament: { stage: "complete", result: { rank: 1, win: true, votes: { sui: { hajime: 10 } } } },
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
assert.deepEqual(availableAftermathDetours(value), [], "no detours once chapter 3 is cleared");

// #2028 残件3: 大会後の寄り道（ムカイさん・エミルの体験会・ヴォルクの後日談）。東京にいる間だけ、一度ずつ。
// IR23: 大会前に読めなかった鉄の煙の再訪（二度目→七年分→頷く順番）も、大会後に順に読める。
const VOLK_VISITS = ["ch3_volk_second", "ch3_volk_third", "ch3_volk_fourth"];
const detourIds = ["ch3_mukai_after_tournament", "ch3_cigarman_trace", "ch3_emil_workshop", ...VOLK_VISITS, "ch3_volk_after_ch3",
  "ch3_volk_lime"];
const openFirst = ["ch3_mukai_after_tournament", "ch3_emil_workshop", "ch3_volk_second", "ch3_volk_after_ch3"];
assert.deepEqual(CH3_AFTERMATH_DETOURS.map(scene => scene.id), detourIds);
for (const scene of CH3_AFTERMATH_DETOURS) {
  const row = readData(`dialogue/${scene.file}`).dialogues.find(dialogue => dialogue.dialogue_id === scene.id);
  assert(row?.lines?.length, `missing detour script ${scene.id}`);
}
const mukaiAfter = readData("dialogue/ch3_mukai").dialogues.find(dialogue => dialogue.dialogue_id === "ch3_mukai_after_tournament");
assert(mukaiAfter.lines.some(line => line.speaker === "mukai_master"));
assert(!mukaiAfter.lines.some(line => /屋根裏|鍵/.test(line.text || "")), "the attic/key offer belongs to chapter 5");
// #2658: 噂を読んだ優勝保存だけが大会後のmukaiで追跡を一度読む。読了後の既読は SAVE/LOAD を越える。
{
  const trace = winningSave();
  trace.flags._ch3_read_ch3_cigarman_rumor = true;
  assert.deepEqual(availableAftermathDetours(trace), [], "no detours before the aftermath checkpoint");
  const beforeWin = structuredClone(trace);
  beforeWin.flags._ch3_tournament_won = false;
  assert.deepEqual(availableAftermathDetours(beforeWin), [], "the pre-win save cannot offer the trace");
  const lost = structuredClone(trace);
  lost.flags._ch3_tournament.result = { rank: 4, win: false };
  assert.deepEqual(availableAftermathDetours(lost), [], "a loss cannot offer the trace");
  beginChapterThreeAftermath(trace);
  assert(!availableAftermathDetours(trace).some(scene => scene.id === "ch3_cigarman_trace"), "victory night has no detours");
  completeChapterThreeAftermathScene(trace, "ch3_abyss_hotel");
  assert(availableAftermathDetours(trace).some(scene => scene.id === "ch3_cigarman_trace"));
  const lostAfterLoad = structuredClone(trace);
  lostAfterLoad.flags._ch3_tournament.result = { rank: 4, win: false };
  assert(!availableAftermathDetours(lostAfterLoad).some(scene => scene.id === "ch3_cigarman_trace"), "a lost save with a stale checkpoint stays closed");
  const unreadRumor = structuredClone(trace);
  delete unreadRumor.flags._ch3_read_ch3_cigarman_rumor;
  assert(!availableAftermathDetours(unreadRumor).some(scene => scene.id === "ch3_cigarman_trace"), "the rumor is required");
  const checkpoint = structuredClone(trace.flags._ch3_aftermath);
  assert.equal(completeAftermathDetour(trace, "ch3_cigarman_trace"), true);
  assert.equal(trace.flags._ch3_read_ch3_cigarman_trace, true);
  assert.deepEqual(trace.flags._ch3_aftermath, checkpoint, "the detour cannot advance the chapter");
  assert.equal(completeAftermathDetour(trace, "ch3_cigarman_trace"), false, "a read scene cannot replay");
  const loaded = JSON.parse(JSON.stringify(trace));
  assert(!availableAftermathDetours(loaded).some(scene => scene.id === "ch3_cigarman_trace"), "LOAD retains the read flag");
}
{
  const detour = winningSave();
  detour.met = { ...detour.met, emil: true, volk: true };
  beginChapterThreeAftermath(detour);
  assert.deepEqual(availableAftermathDetours(detour), [], "the victory night has no detours");
  assert.equal(completeAftermathDetour(detour, "ch3_mukai_after_tournament"), false);
  assert.equal(completeChapterThreeAftermathScene(detour, "ch3_abyss_hotel"), true);
  assert.deepEqual(availableAftermathDetours(detour).map(scene => scene.id), openFirst, "the day after the win opens the first of each");
  const progress = structuredClone(detour.flags._ch3_aftermath), date = [detour.day, detour.slot];
  assert.equal(completeAftermathDetour(detour, "ch3_volk_after_ch3"), true);
  assert.equal(completeAftermathDetour(detour, "ch3_volk_after_ch3"), false, "a detour is read once");
  assert.deepEqual(detour.flags._ch3_aftermath, progress, "a detour does not advance the aftermath");
  assert.deepEqual([detour.day, detour.slot], date, "a detour does not spend time");
  const reloaded = JSON.parse(JSON.stringify(detour));
  assert.deepEqual(availableAftermathDetours(reloaded).map(scene => scene.id), ["ch3_mukai_after_tournament", "ch3_emil_workshop", "ch3_volk_second"]);
  // 帰郷の日の朝（煙幕の片づけ）まで東京で読める。帰郷の夜からは出さない。
  for (const id of ["ch3_mashiro_recovery", "ch3_naru_reconcile"]) assert.equal(completeChapterThreeAftermathScene(detour, id), true);
  assert.equal(availableAftermathDetours(detour).length, 3, "still open on the morning of the cleanup");
  assert.equal(completeChapterThreeAftermathScene(detour, "ch3_enmaku_cleanup"), true);
  assert.equal(playerRegion(detour), "home");
  assert.deepEqual(availableAftermathDetours(detour), [], "no Tokyo detours after going home");
  // 面識が無い人物の寄り道は出さない（エミルは大会当日、ヴォルクは配達で会う）。
  const stranger = winningSave();
  stranger.met = {};
  beginChapterThreeAftermath(stranger);
  completeChapterThreeAftermathScene(stranger, "ch3_abyss_hotel");
  assert.deepEqual(availableAftermathDetours(stranger).map(scene => scene.id), ["ch3_mukai_after_tournament"]);
  assert.equal(completeAftermathDetour(stranger, "ch3_emil_workshop"), false);
  // 大会前に体験会を読んだ保存（同じ既読フラグ）は、大会後にもう一度出さない。
  const readBefore = winningSave();
  readBefore.met = { emil: true, volk: true };
  readBefore.flags._ch3_read_ch3_emil_workshop = true;
  beginChapterThreeAftermath(readBefore);
  completeChapterThreeAftermathScene(readBefore, "ch3_abyss_hotel");
  assert(!availableAftermathDetours(readBefore).some(scene => scene.id === "ch3_emil_workshop"));
}
// IR23: 鉄の煙の再訪は大会後も順に一つずつ。大会前に読んだ分（同じ既読フラグ）は飛ばす。好感度は任意の場面の台本の報酬だけ。
{
  const volkScripts = Object.fromEntries(readData("dialogue/ch3_volk").dialogues.map(row => [row.dialogue_id, row]));
  for (const id of [...VOLK_VISITS, "ch3_volk_after_ch3"]) {
    const rewards = volkScripts[id].lines.filter(line => line.type === "apply" && line.affinity);
    assert.deepEqual(rewards.map(line => line.affinity), [{ volk: 2 }], `${id}: one Volk affinity reward like the other visits`);
  }
  assert(!JSON.stringify(volkScripts.ch3_volk_first).includes('"affinity"'), "the mandatory first visit carries no affinity (2026-10-26)");
  // 大会の前後どちらで読んでも通る（大会前を前提にした言い回しが無い）
  for (const id of VOLK_VISITS) assert(!JSON.stringify(volkScripts[id]).match(/大会|本番|明日の/), `${id}: no pre-tournament wording`);
  const order = winningSave();
  order.met = { ...order.met, volk: true };
  order.flags._ch3_read_ch3_volk_second = true; // 大会前の最後の自由時間（DAY13夜）に一本だけ読んだ保存
  beginChapterThreeAftermath(order);
  completeChapterThreeAftermathScene(order, "ch3_abyss_hotel");
  const volkOpen = () => availableAftermathDetours(order).map(scene => scene.id).filter(id => id.startsWith("ch3_volk"));
  assert.deepEqual(volkOpen(), ["ch3_volk_third", "ch3_volk_after_ch3"], "the second visit read before the tournament is skipped");
  assert.equal(completeAftermathDetour(order, "ch3_volk_fourth"), false, "the visits keep their order");
  assert.equal(completeAftermathDetour(order, "ch3_volk_third"), true);
  assert.deepEqual(volkOpen(), ["ch3_volk_fourth", "ch3_volk_after_ch3"]);
  assert.equal(completeAftermathDetour(order, "ch3_volk_fourth"), true);
  assert.deepEqual(volkOpen(), ["ch3_volk_after_ch3"]);
}
console.log("PASS: Chapter 3 aftermath reopens Volk's unread visits in order, each with the same optional-scene affinity");
// IR22: 綾取の締めくくり（♥5）は、大会前の来店で読めなかった時だけ大会後の寄り道から。煙幕の片づけの前まで。
{
  assert.deepEqual(CH3_AFTERMATH_FINALES.map(entry => [entry.who, entry.dialogue]),
    [["saku", "ch3_saku_bond_finale"], ["steve", "ch3_steve_bond_finale"], ["volk", "ch3_volk_bond_finale"]]);
  const finale = scenes.ch3_saku_bond_finale;
  const branch = finale.lines.find(line => line.type === "condition");
  assert.deepEqual([branch.condition_type, branch.tournament_chapter, branch.next_true, branch.next_false],
    ["tournament_finished", 3, "after_tournament", "before_tournament"], "the finale reads after the tournament too");
  assert(!JSON.stringify(finale.branches.after_tournament).match(/勝負の話は|明日|本番/), "no pre-tournament wording after the tournament");
  const window = winningSave(), due = new Set(["saku"]);
  const open = (value, ready = who => due.has(who)) => {
    const before = structuredClone(value);
    const found = availableAftermathFinales(value, ready).map(entry => entry.who);
    assert.deepEqual(value, before, "reading the finale list never changes the save");
    return found;
  };
  beginChapterThreeAftermath(window);
  assert.deepEqual(open(window), [], "the victory night has no finale");
  completeChapterThreeAftermathScene(window, "ch3_abyss_hotel");
  assert.deepEqual(open(window), ["saku"], "the day after the win");
  assert.deepEqual(open(window, () => false), [], "only when daily/bonds.js says it is due (♥5, the LIME detour and the answer)");
  completeChapterThreeAftermathScene(window, "ch3_mashiro_recovery");
  assert.deepEqual(open(window), ["saku"]);
  completeChapterThreeAftermathScene(window, "ch3_naru_reconcile");
  assert.deepEqual(open(window), [], "the cleanup morning: Ayatori is packing the shop");
  const loser = winningSave(); loser.flags._ch3_tournament.result.rank = 4;
  assert.deepEqual(open(loser), [], "a non-winning save has no aftermath finale");
}
console.log("PASS: Chapter 3 aftermath offers Ayatori's ♥5 finale until the cleanup morning, read-only");
// #2028: スティーブの締めくくり（♥5）も、大会前に Smoke & Glory で読めなかった時だけ大会後の寄り道から。窓は綾取と同じ。
{
  const entry = CH3_AFTERMATH_FINALES.find(item => item.who === "steve");
  assert.deepEqual([entry.file, entry.place, entry.bg, entry.label], ["ch3_rivals", "Smoke & Glory", "bg_steve_shop", "スティーブに呼ばれる"]);
  // daily/bonds.js は vm で読む試験の依存を増やさないよう、窓の終わり（場面の段階）を写して持つ。写しがずれたら止める。
  const bonds = readFileSync(new URL("../js/daily/bonds.js", import.meta.url), "utf8");
  assert.equal(Number(bonds.match(/STEVE_LAST_AFTERMATH_STAGE = (\d+);/)?.[1]), ids.indexOf(entry.to),
    "bonds.js STEVE_LAST_AFTERMATH_STAGE matches the aftermath window");
  const finale = scenes.ch3_steve_bond_finale;
  assert.equal(finale.metadata.bond_finale, "steve");
  const branch = finale.lines.find(line => line.type === "condition");
  assert.deepEqual([branch.condition_type, branch.tournament_chapter, branch.next_true, branch.next_false],
    ["tournament_finished", 3, "after_tournament", "before_tournament"], "the finale reads after the tournament too");
  assert(!JSON.stringify(finale.branches.after_tournament).match(/偵察|明日|本番/), "no pre-tournament wording after the tournament");
  assert(!JSON.stringify(finale.branches.before_tournament).match(/大会の日から|大会の相手/), "no after-tournament wording before it");
  const window = winningSave(), open = value => availableAftermathFinales(value, who => who === "steve").map(item => item.who);
  beginChapterThreeAftermath(window);
  assert.deepEqual(open(window), [], "the victory night has no finale");
  completeChapterThreeAftermathScene(window, "ch3_abyss_hotel");
  assert.deepEqual(open(window), ["steve"], "the day after the win");
  completeChapterThreeAftermathScene(window, "ch3_mashiro_recovery");
  assert.deepEqual(open(window), ["steve"]);
  completeChapterThreeAftermathScene(window, "ch3_naru_reconcile");
  assert.deepEqual(open(window), [], "the cleanup morning: packing to go home that night");
}
console.log("PASS: Chapter 3 aftermath offers Steve's ♥5 finale with the same window, read-only");
// #2028: ヴォルクのLIME交換は、鉄の煙の四度目の後・♥2で大会後の寄り道にも出る（大会前の寄り道と同じ条件）。
// 締めくくり（♥5）の窓は、鉄の煙の寄り道・授業と同じく煙幕の片づけの朝まで。
{
  assert.deepEqual(AFTERMATH_HEART_PTS, AFFINITY_RANK_PTS, "the aftermath copy of the ♥ table follows core/stats.js");
  const bonds = readFileSync(new URL("../js/daily/bonds.js", import.meta.url), "utf8");
  const copied = name => Number(bonds.match(new RegExp(`${name} = (\\d+);`))?.[1]);
  for (const [name, who] of [["SAKU_LAST_AFTERMATH_STAGE", "saku"], ["STEVE_LAST_AFTERMATH_STAGE", "steve"], ["VOLK_LAST_AFTERMATH_STAGE", "volk"]])
    assert.equal(copied(name), ids.indexOf(CH3_AFTERMATH_FINALES.find(item => item.who === who).to), `bonds.js ${name} matches the aftermath window`);
  assert.equal(copied("NARU_RECONCILE_STAGE"), ids.indexOf("ch3_naru_reconcile"), "bonds.js NARU_RECONCILE_STAGE (the party night)");
  const volkScripts = Object.fromEntries(readData("dialogue/ch3_volk").dialogues.map(row => [row.dialogue_id, row]));
  const lime = volkScripts.ch3_volk_lime;
  assert(lime.lines.some(line => line.type === "set_flag" && line.flag === "_lime_contact_volk"), "the exchange effect shows");
  assert.deepEqual(lime.lines.filter(line => line.type === "apply").map(line => line.affinity), [{ volk: 2 }]);
  assert(!JSON.stringify(lime.lines).match(/大会|本番|明日/), "the LIME scene reads before or after the tournament");
  const save = winningSave();
  save.met = { ...save.met, volk: true };
  Object.assign(save.flags, { _ch3_read_ch3_volk_second: true, _ch3_read_ch3_volk_third: true });
  save.affinity.volk = AFFINITY_RANK_PTS[3];
  beginChapterThreeAftermath(save);
  completeChapterThreeAftermathScene(save, "ch3_abyss_hotel");
  const volkOpen = () => availableAftermathDetours(save).map(scene => scene.id).filter(id => id.startsWith("ch3_volk"));
  assert.deepEqual(volkOpen(), ["ch3_volk_fourth", "ch3_volk_after_ch3"], "the LIME scene waits for the fourth visit");
  assert.equal(completeAftermathDetour(save, "ch3_volk_lime"), false);
  assert.equal(completeAftermathDetour(save, "ch3_volk_fourth"), true);
  assert.deepEqual(volkOpen(), ["ch3_volk_after_ch3", "ch3_volk_lime"], "after the fourth visit, at ♥2");
  save.affinity.volk = AFFINITY_RANK_PTS[2] - 1;
  assert.deepEqual(volkOpen(), ["ch3_volk_after_ch3"], "below ♥2 it stays closed");
  save.affinity.volk = AFFINITY_RANK_PTS[2];
  assert.equal(completeAftermathDetour(save, "ch3_volk_lime"), true);
  assert.equal(save.flags._ch3_read_ch3_volk_lime, true, "the same read flag as the pre-tournament detour");
  assert.deepEqual(volkOpen(), ["ch3_volk_after_ch3"], "read once");
  const entry = CH3_AFTERMATH_FINALES.find(item => item.who === "volk");
  assert.deepEqual([entry.file, entry.place, entry.bg, entry.label], ["ch3_volk", "鉄の煙", "bg_volk_shop", "ヴォルクに呼ばれる"]);
  const finale = volkScripts.ch3_volk_bond_finale;
  assert.equal(finale.metadata.bond_finale, "volk");
  assert(!finale.metadata.bg, "the caller's day/night background is used");
  const branch = finale.lines.find(line => line.type === "condition");
  assert.deepEqual([branch.condition_type, branch.tournament_chapter, branch.next_true, branch.next_false],
    ["tournament_finished", 3, "after_tournament", "before_tournament"], "the finale reads after the tournament too");
  assert(!JSON.stringify(finale.branches.before_tournament).match(/大会/), "no after-tournament wording before it");
  assert(!JSON.stringify(finale.lines).match(/大会|本番|明日/), "the shared lines assume no tournament result");
  // 第5章（ch5_tokyo_volk「測る。それから、客に聞く。順番は変えない」）と同じ順番。大会後も計器を先に見る
  assert(!JSON.stringify(finale).match(/計器より先/), "Volk never puts the customer before the gauges (characters.json, ch5)");
  assert.match(JSON.stringify(finale.branches.after_tournament), /計器は、今も先に見る/);
  assert.deepEqual(entry.after, ["ch3_volk_after_ch3"], "after the first post-tournament visit to Iron Smoke");
  const window = winningSave(), open = value => availableAftermathFinales(value, who => who === "volk").map(item => item.who);
  beginChapterThreeAftermath(window);
  assert.deepEqual(open(window), [], "the victory night has no finale");
  completeChapterThreeAftermathScene(window, "ch3_abyss_hotel");
  assert.deepEqual(open(window), [], "not before 大会のあとの記録 (ch3_volk_after_ch3) is read");
  window.met = { ...window.met, volk: true };
  const before = structuredClone(window);
  open(window);
  assert.deepEqual(window, before, "reading the finale list never changes the save");
  assert.equal(completeAftermathDetour(window, "ch3_volk_after_ch3"), true);
  assert.deepEqual(open(window), ["volk"], "then it opens in the same sitting");
  for (const id of ["ch3_mashiro_recovery", "ch3_naru_reconcile"]) {
    completeChapterThreeAftermathScene(window, id);
    assert.deepEqual(open(window), ["volk"], `open after ${id}`);
  }
  completeChapterThreeAftermathScene(window, "ch3_enmaku_cleanup");
  assert.deepEqual(open(window), [], "back home from the night of the cleanup");
}
console.log("PASS: Chapter 3 aftermath offers Volk's LIME (after the fourth visit, ♥2) and ♥5 finale until the cleanup morning");
// 大会後の東京で、灯した授業を相談できる（SPEC 2.6・SBD61）。窓は場面idで決まり、保存は変更しない。
{
  assert.deepEqual(CH3_AFTERMATH_LESSONS.map(entry => entry.who), ["saku", "steve", "volk", "mashiro"]);
  for (const entry of CH3_AFTERMATH_LESSONS) for (const id of [entry.from, entry.to])
    assert(ids.includes(id), `${entry.who}: window scene ${id} exists`);
  const everyone = () => [{ id: "lit" }];
  const who = (value, ready = everyone) => {
    const before = structuredClone(value);
    const found = availableAftermathLessons(value, ready).map(entry => entry.who);
    assert.deepEqual(value, before, "reading the lesson list never changes the save");
    return found;
  };
  const lessonSave = winningSave();
  assert.deepEqual(who(lessonSave), [], "before the aftermath begins");
  beginChapterThreeAftermath(lessonSave);
  assert.deepEqual(who(lessonSave), [], "the victory night has no lessons");
  completeChapterThreeAftermathScene(lessonSave, "ch3_abyss_hotel");
  assert.deepEqual(who(lessonSave), ["saku", "steve", "volk"], "day after the win (noon): mashiro is not yet at the after-hours counter");
  const [saku] = availableAftermathLessons(lessonSave, everyone);
  assert.deepEqual(saku.lessons, [{ id: "lit" }]);
  assert.equal(saku.place, "煙幕");
  completeChapterThreeAftermathScene(lessonSave, "ch3_mashiro_recovery");
  assert.deepEqual(who(lessonSave), ["saku", "steve", "volk", "mashiro"], "the night of the day after: all four");
  const partyNight = structuredClone(lessonSave);
  partyNight.flags._ch3_naru_party_ready = true;
  assert.deepEqual(who(partyNight), ["saku", "volk", "mashiro"], "Steve's lesson is the party itself: hidden once the party night opens");
  assert.deepEqual(who(lessonSave, name => name === "volk" ? [{ id: "M-W5" }] : []), ["volk"], "only people with a ready lesson");
  assert.deepEqual(who(lessonSave, () => []), [], "nothing lit, nothing listed");
  assert.deepEqual(who(lessonSave, () => undefined), [], "a missing growth list is treated as empty");
  completeChapterThreeAftermathScene(lessonSave, "ch3_naru_reconcile");
  assert.deepEqual(who(lessonSave), ["volk"], "the cleanup morning: Ayatori is packing the shop, only Volk is left");
  // 寄り道を全部読んでも、授業だけで寄り道の入口が開く（ch3-aftermath.js は寄り道と授業の合計で入口を出す）
  lessonSave.met = { ...lessonSave.met, emil: true, volk: true };
  lessonSave.flags._ch3_read_ch3_cigarman_rumor = true;
  lessonSave.affinity.volk = AFFINITY_RANK_PTS[2]; // ヴォルクのLIME交換は♥2から
  for (const id of detourIds) assert.equal(completeAftermathDetour(lessonSave, id), true, id);
  assert.deepEqual(availableAftermathDetours(lessonSave), []);
  assert.deepEqual(who(lessonSave), ["volk"], "lessons stay open after every detour is read");
  for (const id of ["ch3_enmaku_cleanup", "ch3_home_customer", "ch3_tsumugi_result"]) {
    completeChapterThreeAftermathScene(lessonSave, id);
    assert.deepEqual(who(lessonSave), [], `no Tokyo lessons after ${id}`);
  }
  completeChapterThreeAftermathScene(lessonSave, "ch3_ageha_reunion");
  assert.equal(lessonSave.flags._ch3_cleared, true);
  assert.deepEqual(who(lessonSave), [], "no lessons once chapter 3 is cleared");
  const loser = winningSave(); loser.flags._ch3_tournament.result.rank = 4;
  assert.deepEqual(who(loser), [], "a non-winning save has no aftermath lessons");
}
console.log("PASS: Chapter 3 aftermath lessons open by scene window, hide Steve on the party night, and never change the save");
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

// ピザの夜は帰郷前の読了地点だけ。古い保存・約束・現在地を変更して開催可能にしない。
{
  globalThis.localStorage = { getItem: key => key === "suien_growth_preview" ? "1" : null };
  const party = await import("../js/chapters/ch3-party-progress.js");
  const s = winningSave(); beginChapterThreeAftermath(s);
  completeChapterThreeAftermathScene(s, ids[0]); completeChapterThreeAftermathScene(s, ids[1]);
  s.growth = { nodes: ["M-S5"], learned: ["M-S5"] };
  s.met = { mashiro: true, saku: true, volk: true, minto: true };
  assert.equal(party.chapterThreePartyWindow(s), false, "Naru must be read first");
  s.flags._ch3_naru_party_ready = true;
  assert.deepEqual(party.chapterThreePartyGuests(s), ["mashiro", "saku", "volk"], "home guests cannot teleport");
  const withHost = structuredClone(s); withHost.met.mukai_master = true;
  assert.deepEqual(party.chapterThreePartyGuests(withHost), ["mashiro", "saku", "volk", "mukai_master"]);
  const invalid = [[], ["mashiro"], ["mashiro", "mashiro"], ["mashiro", "minto"], ["mashiro", "saku", "volk", "minto"]];
  for (const guests of invalid) {
    const before = structuredClone(s);
    assert.equal(party.completeChapterThreeParty(s, guests, () => assert.fail("invalid award")), false);
    assert.deepEqual(s, before);
  }
  s.pendingInvite = { day: s.day, slot: s.slot };
  assert.deepEqual(party.chapterThreePartyGuests(s), []);
  delete s.pendingInvite;
  s.growth.partyLast = ["mashiro"];
  assert.deepEqual(party.chapterThreePartyGuests(s), ["saku", "volk"]);
  const before = structuredClone(s), awards = [];
  assert.equal(party.completeChapterThreeParty(s, ["saku", "volk"], (...a) => awards.push(a)), true);
  assert.deepEqual(awards, [["saku", 10], ["volk", 10]]);
  for (const key of ["day", "slot", "stamina", "money", "stats", "flavorStock", "tokyoVisits", "tournament"])
    assert.deepEqual(s[key], before[key], key);
  const restored = JSON.parse(JSON.stringify(s));
  const { buildCarryPackage, flagVerdict } = await import("../js/core/carry.js");
  const carry = buildCarryPackage(restored);
  assert.deepEqual(carry.growth.partyLast, ["saku", "volk"], "consecutive invitations stay blocked across NG+");
  assert.equal(flagVerdict("_ch3_pizza_party"), "reset");
  assert.equal(flagVerdict("_ch3_naru_party_ready"), "reset");
  assert(!carry.flags._ch3_pizza_party && !carry.flags._ch3_naru_party_ready);
  assert.equal(party.completeChapterThreeParty(restored, ["mashiro", "saku"], () => assert.fail("duplicate award")), false);
  assert.equal(completeChapterThreeAftermathScene(restored, ids[2]), true);
  assert.deepEqual([restored.day, restored.slot], [44, 0]);
  assert.equal(party.chapterThreePartyWindow(restored), false);
  const visitor = structuredClone(before);
  visitor.tokyoVisits.plans = [{ characterId: "minto", met: true, status: "staying", arrivalDay: 42, returnDay: 44 }];
  assert(party.chapterThreePartyGuests(visitor).includes("minto"));
  visitor.tokyoVisits.plans[0].returnDay = 43;
  assert(!party.chapterThreePartyGuests(visitor).includes("minto"));
  visitor.growth.learned = [];
  assert.equal(party.chapterThreePartyWindow(visitor), false, "lit but unlearned is unavailable");
}
console.log("PASS: post-tournament party preserves dates, reservations and old checkpoints; guests, award and reload are guarded");
