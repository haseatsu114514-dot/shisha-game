import assert from "node:assert/strict";
import fs from "node:fs";
import { newState, setState, saveToSlot, loadFromSlot } from "../js/core/state.js";
import { DB } from "../js/core/data.js";
import { advanceToChapterFour, CH4_PROLOGUE, completeChapterFourScene, chapterFourTournamentOutcome,
  chapterFourAfterDefeat, CH4_PRIZE } from "../js/chapters/ch4-progress.js";
import { chapterFourMatch, startChapterFourCraft, beginChapterFourStep, finishChapterFourStep,
  recoverChapterFourStep, CH4_JUDGES, CH4_CONTESTANTS } from "../js/chapters/ch4-tournament-state.js";
// Shared score/served-eval imports browser audio; only its visibility observer runs at module load.
globalThis.document = { addEventListener() {} };
const { finalize, computeShisha } = await import("../js/craft/score.js");
const { regulationFor } = await import("../js/craft/steps.js");
const { chapterFourReviewLines, chapterFourCraftAdvice, chapterFourFinalDialogue, chapterFourDefeatDialogue, chapterFourCustomerLines } = await import("../js/chapters/ch4-verdict.js");
delete globalThis.document;
const read = file => JSON.parse(fs.readFileSync(new URL(`../../data/${file}.json`, import.meta.url)));
DB.flavorById = Object.fromEntries(read("flavors").flavors.map(row => [row.id, row]));
DB.equipById = Object.fromEntries(read("equipment").equipment.map(row => [row.id, row]));
const finalScene = read("dialogue/ch4_main").dialogues.find(row => row.dialogue_id === "ch4_final");
function entry() {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "cleared", day: 45 });
  value.flags._ch3_cleared = true;
  advanceToChapterFour(value);
  Object.assign(value.flags._ch4, { part: "tournament", day: 5, stage: CH4_PROLOGUE.length });
  value.phase = "tournament";
  value.flags._ch4_strategy = "sakura";
  completeChapterFourScene(value, "ch4_tournament_start");
  setState(value);
  return value;
}
const craft = (score = 96) => ({ chapter: 4, mode: "tournament", mix: { sakura: 12 }, equip: {},
  mixInfo: { total: 12, score, intensity: 5 }, pack: "normal", place: "triangle", steamSeconds: 480,
  holes: { score, outerEven: 1, total: 24, minimumComplete: true, innerExcess: 0 },
  heat: { score, heatPower: 85, heatStability: 100, burnRisk: 0, aromaRetention: 100 },
  steam: { score }, pull: { score, temp: .54, pulls: 2 }, pullDone: true,
  careHistory: [{ score, temp: .54, coals: 1 }, { score, temp: .54, coals: 2 }],
  stats: { craftQuality: score }, servedQuality: score, total: 0 });
function drive(value, cs, { failAt = -1, failureKind = "burnt" } = {}) {
  startChapterFourCraft(value, cs);
  for (let step = chapterFourMatch(value).step; step < 11; step++) {
    beginChapterFourStep(value);
    const c = structuredClone(cs);
    if (step === failAt) c.failed = failureKind;
    if (step === 10 && !c.failed) finalize(c);
    finishChapterFourStep(value, c);
    if (c.failed) break;
  }
  return chapterFourMatch(value);
}
// No fixed victory or prize from the opening; a complete real-scored run wins and pays only once.
{
  const value = entry(), money = value.money;
  assert.equal(chapterFourTournamentOutcome(value), null);
  assert.equal(completeChapterFourScene(value, "ch4_final"), false);
  const p = drive(value, craft());
  assert.equal(p.result.win, true);
  assert.equal(p.result.total, 96);
  assert.equal(p.voted, 4);
  assert.equal(p.result.careHistory.length, 2);
  for (const judge of CH4_JUDGES) assert.equal(CH4_CONTESTANTS.reduce((sum, id) => sum + p.votes[judge][id], 0), 10);
  assert.equal(chapterFourTournamentOutcome(value), "win");
  assert.equal(completeChapterFourScene(value, "ch4_defeat"), false);
  assert.equal(completeChapterFourScene(value, "ch4_final"), true);
  assert.equal(value.money, money + CH4_PRIZE);
  assert.equal(completeChapterFourScene(value, "ch4_final"), false);
  assert.equal(value.money, money + CH4_PRIZE);
  assert.equal(chapterFourAfterDefeat(value), false);
  assert.deepEqual(chapterFourMatch(JSON.parse(JSON.stringify(value))).result, p.result);
}
// #2031: 旧保存の内部名 wang は master_hookah として読み込み、結果・票・順位は変わらない。
{
  const value = entry();
  const p = drive(value, craft());
  const legacy = JSON.parse(JSON.stringify(value).replaceAll('"master_hookah"', '"wang"'));
  assert.ok(JSON.stringify(legacy.flags._ch4.match).includes('"wang"'));
  const migrated = chapterFourMatch(legacy);
  assert.ok(!JSON.stringify(migrated).includes('"wang"'), "No legacy id remains after loading");
  assert.deepEqual(migrated.votes, p.votes);
  assert.deepEqual(migrated.result, p.result);
  assert.deepEqual(migrated.quality, p.quality);
  assert.equal(chapterFourTournamentOutcome(legacy), "win");
}
// Poor complete craft loses; burnt/cold/leaf failure cannot be promoted to a completed victory.
for (const [failAt, failureKind] of [[-1, null], [8, "burnt"], [9, "cold"], [10, "leaf"]]) {
  const value = entry(), money = value.money, stock = structuredClone(value.flavorStock);
  const initial = structuredClone({ stamina: value.stamina, equip: value.equip, stats: value.stats, recipes: value.recipes });
  const p = drive(value, craft(failAt < 0 ? 45 : 96), { failAt, failureKind });
  assert.equal(p.result.win, false);
  assert.equal(chapterFourTournamentOutcome(value), "loss");
  assert.equal(completeChapterFourScene(value, "ch4_final"), false);
  assert.equal(completeChapterFourScene(value, "ch4_defeat"), true);
  Object.assign(value, { stamina: 1, flavorStock: {}, equip: {}, stats: {}, recipes: {} });
  assert.equal(chapterFourAfterDefeat(value), true);
  assert.deepEqual(value.flavorStock, stock);
  for (const [key, data] of Object.entries(initial)) assert.deepEqual(value[key], data);
  assert.equal(p.result, null);
  assert.equal(p.step, 0);
  assert.equal(value.money, money);
  assert.equal(value.flags._ch4.attempts, 1);
  assert.equal(p.history.length, 1);
  assert.equal(value.flags._ch4.read.ch4_tournament_start, undefined);
  completeChapterFourScene(value, "ch4_tournament_start");
  assert.equal(drive(value, craft()).result.win, true);
  assert.equal(p.history.length, 2);
}
// Mid-step SAVE/LOAD rolls back only uncommitted consumption, keeps the completed craft and votes.
{
  let value = entry();
  startChapterFourCraft(value, craft());
  assert.equal(startChapterFourCraft(value, { fake: true }).craft.fake, undefined, "No replacement on double start");
  for (let i = 0; i < 8; i++) { beginChapterFourStep(value); finishChapterFourStep(value, craft()); }
  const before = structuredClone({ stock: value.flavorStock, stamina: value.stamina, match: value.flags._ch4.match });
  beginChapterFourStep(value);
  value.flavorStock = {}; value.stamina -= 9;
  value = JSON.parse(JSON.stringify(value));
  recoverChapterFourStep(value);
  assert.deepEqual(value.flavorStock, before.stock);
  assert.equal(value.stamina, before.stamina);
  assert.deepEqual(chapterFourMatch(value), before.match);
  recoverChapterFourStep(value);
  assert.deepEqual(chapterFourMatch(value), before.match, "Recovery is idempotent");
  assert.equal(drive(value, craft()).result.win, true);
  assert.throws(() => finishChapterFourStep(value, craft()), /確定/);
}
// Use the actual manual SAVE/LOAD+migration path, not only a JSON clone of the match.
{
  const items = new Map();
  globalThis.localStorage = { getItem: key => items.get(key) || null, setItem: (key, raw) => items.set(key, raw) };
  const value = entry();
  const result = drive(value, craft()).result;
  assert.equal(saveToSlot("suien_remake_slot1"), true);
  const restored = loadFromSlot("suien_remake_slot1");
  assert(restored);
  assert.deepEqual(chapterFourMatch(restored).result, result);
  assert.equal(chapterFourTournamentOutcome(restored), "win");
  assert.equal(completeChapterFourScene(restored, "ch4_final"), true);
  const money = restored.money;
  saveToSlot("suien_remake_slot1");
  const paid = loadFromSlot("suien_remake_slot1");
  assert.equal(paid.money, money);
  assert.equal(completeChapterFourScene(paid, "ch4_final"), false);
  assert.equal(paid.money, money);
  delete globalThis.localStorage;
}
// Incomplete adjustments cannot yield a win, even with high scores.
{
  const value = entry(), cs = craft();
  cs.careHistory.pop();
  assert.throws(() => drive(value, cs), /不足|未完了/);
  assert.equal(chapterFourTournamentOutcome(value), null);
}
// Real shared scoring is used, and a different second adjustment changes the total independently.
{
  const value = entry(), a = craft(), b = craft();
  a.stats = computeShisha(a); b.stats = computeShisha(b);
  b.careHistory[1].score = 10;
  finalize(a); finalize(b);
  assert.equal(Math.round((a.total - b.total) * 10) / 10, 17.2);
  assert.deepEqual(Object.keys(a.parts), ["holes", "heat", "shisha", "care1", "care2"]);
  assert.equal(drive(value, a).result.parts.care2, 96);
}
// Supply and feedback follow all three saved plans; using none or a token amount is reported honestly.
for (const [plan, leaf] of [["sakura", "sakura"], ["peach", "peach"], ["tea", "black_tea"]]) {
  const value = entry(); value.flags._ch4_strategy = plan;
  const reg = regulationFor({ mode: "tournament", chapter: 4 });
  assert.equal(reg.flavor, leaf); assert.equal(reg.min, 0); assert.equal(reg.free, true);
  const cs = craft(); cs.mix = { [leaf]: 1, mint: 11 };
  const text = c => chapterFourReviewLines(value, c).map(row => row.text).join("\n");
  assert.match(text(cs), /1g、配合の8%/);
  assert.match(text({ ...cs, mix: { mint: 12 } }), /本番では使わず/);
  assert.match(chapterFourCraftAdvice(value, 1).join("\n"), /出発前の方針/);
}
// Local learning is a cue for actual heat/serving decisions, with no automatic success or invented bonus.
{
  const value = entry(), cs = craft();
  assert.equal(chapterFourCraftAdvice(value, 9).length, 0);
  value.flags._ch4.read.ch4_stranger_second = true;
  value.flags._ch4.read.ch4_stranger_third = true;
  value.flags._ch4.read.ch4_dubai_souq = true;
  assert.match(chapterFourCraftAdvice(value, 9).join("\n"), /換気/);
  assert.match(chapterFourCraftAdvice(value, 1).join("\n"), /スーク/);
  cs.careHistory[1].score = 10;
  const saved = JSON.stringify({ value, cs });
  const lines = chapterFourReviewLines(value, cs).map(row => row.text).join("\n");
  assert.match(lines, /◎ → △/);
  assert.match(lines, /熱が暴れてる/);
  assert.equal(JSON.stringify({ value, cs }), saved);
  assert.notDeepEqual(chapterFourCustomerLines(cs, 1), chapterFourCustomerLines({ ...cs, pull: { temp: .1 } }, 1));
  const final = chapterFourFinalDialogue(finalScene, value, cs);
  const finalText = final.lines.map(row => row.text).join("\n");
  assert(!final.lines.some(row => /普通のブロンドをほぐす|急がせず、炭を一つ離した|少し休んだら、また吸いたい/.test(row.text)));
  // 味の1行＋熱の1行だけを差し込み、配合%・調整マーク・太陽の講評（結果モーダルの役目）は繰り返さない。
  assert.match(finalText, /桜の香りが、まっすぐ立つ/);
  assert.match(finalText, /熱は落ち着いている/);
  assert.doesNotMatch(finalText, /配合の\d+%|調整\d回目：|熱が暴れてる/);
  const scripted = finalScene.lines.length - final.lines.length;
  assert.equal(scripted, 10 - 2, "Only the ten fixed own-craft lines are replaced by two served lines");
  // 操作に左右されない視線の一行と、対戦相手の場面・締めは台本のまま残る。
  const glance = final.lines.findIndex(row => row.text.startsWith("ふと視線を感じた。"));
  assert(glance > 0 && /熱は落ち着いている/.test(final.lines[glance - 1].text));
  assert(final.lines.some(row => row.text.startsWith("シェイクも火を直す。")));
  const failedPull = chapterFourFinalDialogue(finalScene, value, { ...cs, pull: { failed: "burnt" } });
  assert(!failedPull.lines.some(row => /まっすぐ立つ|熱は落ち着いている/.test(row.text)), "No invented taste for a failed pull");
  const defeatScene = read("dialogue/ch4_main").dialogues.find(row => row.dialogue_id === "ch4_defeat");
  const burnt = { ...cs, failed: "burnt", pull: { failed: "burnt" }, careHistory: [] };
  const defeat = chapterFourDefeatDialogue(defeatScene, value, burnt);
  const defeatText = defeat.lines.map(row => row.text).join("\n");
  assert.doesNotMatch(defeatText, /最後まで吸いたくなる|最後の票|今日は、この香りで出す/);
  assert.match(defeatText, /葉が焦げた/);
}
console.log("PASS: Chapter 4 real scores, votes, failure/retry, resource rollback, plans and local-learning feedback");
