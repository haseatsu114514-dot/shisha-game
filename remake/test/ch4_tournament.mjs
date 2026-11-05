import assert from "node:assert/strict";
import fs from "node:fs";
import { newState, setState, saveToSlot, loadFromSlot } from "../js/core/state.js";
import { DB } from "../js/core/data.js";
import { advanceToChapterFour, CH4_PROLOGUE, completeChapterFourScene, chapterFourTournamentOutcome,
  chapterFourAfterDefeat, CH4_PRIZE } from "../js/chapters/ch4-progress.js";
import { chapterFourMatch, startChapterFourCraft, beginChapterFourStep, finishChapterFourStep,
  recoverChapterFourStep, resetChapterFourCraft, CH4_JUDGES, CH4_CONTESTANTS, CH4_RIVAL_CURVE, chapterFourStandings,
  CH4_RULES_VERSION, CH4_SPEND, CH4_LEGACY_SPEND, CH4_LEGACY_RIVAL_CURVE, chapterFourRetryContext } from "../js/chapters/ch4-tournament-state.js";
import { liftRivalScore, setRivalScoreObserver } from "../js/core/ngplus-difficulty.js";
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
  delete value.flags._ch4.routeVersion; // 旧行程（ドバイ5日）
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
// #2031: 制作中の掛け合いの既読は、工程ごとの複製と保存を通って残り、再挑戦で最初からに戻る。
{
  let value = entry();
  startChapterFourCraft(value, craft());
  chapterFourMatch(value).craft.tournamentStory = { seen: ["opening"] };
  for (let i = 0; i < 3; i++) {
    const cs = beginChapterFourStep(value);
    assert.deepEqual(cs.tournamentStory.seen, ["opening"], "The step clone carries the banter already read");
    finishChapterFourStep(value, cs);
  }
  chapterFourMatch(value).craft.tournamentStory.seen.push("packed");
  value = JSON.parse(JSON.stringify(value));
  recoverChapterFourStep(value);
  assert.deepEqual(chapterFourMatch(value).craft.tournamentStory.seen, ["opening", "packed"], "SAVE/LOAD keeps the banter already read");
  for (let step = chapterFourMatch(value).step; step < 11; step++) {
    const cs = beginChapterFourStep(value);
    if (step === 8) cs.failed = "burnt";
    finishChapterFourStep(value, cs);
    if (cs.failed) break;
  }
  assert.equal(chapterFourMatch(value).result.win, false);
  assert.deepEqual(chapterFourMatch(value).craft.tournamentStory.seen, ["opening", "packed"]);
  assert.equal(resetChapterFourCraft(value), true);
  assert.equal(chapterFourMatch(value).craft, null, "A retry replays the banter from the opening");
}
// 2026-11-02 オーナー決定「なるを強くする」: 相手の出来は投票の回ごと。なるは提供後・調整1回目で伸び、
// ふつうの出来のはじめなら途中で先頭に立つ。最後の票はシェイクが一番強く、はじめの勝ちの境目は変えない。
// 旧版の期待値を弱めず保持する互換回帰。以下だけは明示的に版1で走らせる。
{
  const startLegacy = (value, cs) => {
    startChapterFourCraft(value, cs);
    chapterFourMatch(value).rulesVersion = 1;
  };
  // 回ごとに、各人が得た票と直後の途中順位を残しながら最後まで通す。
  const byRound = (value, cs) => {
    startLegacy(value, cs);
    const rounds = [];
    let before = structuredClone(chapterFourMatch(value).votes);
    for (let step = chapterFourMatch(value).step; step < 11; step++) {
      beginChapterFourStep(value);
      const c = structuredClone(cs);
      if (step === 10) finalize(c);
      const p = finishChapterFourStep(value, c);
      if (p.voted === rounds.length) continue;
      const got = id => CH4_JUDGES.reduce((sum, judge) => sum + p.votes[judge][id] - before[judge][id], 0);
      const rows = chapterFourStandings(p);
      rounds.push({ got: Object.fromEntries(CH4_CONTESTANTS.map(id => [id, got(id)])), leader: rows[0].id,
        rank: rows.find(row => row.id === "hajime").rank, top: rows.slice(0, 2).map(row => `${row.id}:${row.points}`) });
      before = structuredClone(p.votes);
    }
    return { p: chapterFourMatch(value), rounds };
  };
  // 相手の並び: 途中（提供後・調整1回目）はなるが一番上、最後はシェイク＞なる＞王煙楼。王煙楼は終始同じ。
  assert.deepEqual(Object.keys(CH4_LEGACY_RIVAL_CURVE), ["naru", "master_hookah", "sheikh"]);
  for (const curve of Object.values(CH4_LEGACY_RIVAL_CURVE)) assert.equal(curve.length, 4);
  for (const round of [1, 2]) assert(CH4_LEGACY_RIVAL_CURVE.naru[round] > CH4_LEGACY_RIVAL_CURVE.sheikh[round]);
  assert(CH4_LEGACY_RIVAL_CURVE.sheikh[3] > CH4_LEGACY_RIVAL_CURVE.naru[3] && CH4_LEGACY_RIVAL_CURVE.naru[3] > CH4_LEGACY_RIVAL_CURVE.master_hookah[3]);
  assert.equal(new Set(CH4_LEGACY_RIVAL_CURVE.master_hookah).size, 1);
  // ふつうの出来（全工程89）: 提供後と調整1回目の票でなるが先頭に立ち、はじめは2位。最後の票で逆転し、なるが2位で終わる。
  const average = byRound(entry(), craft(89));
  assert.deepEqual(average.rounds.map(r => r.leader), ["hajime", "naru", "naru", "hajime"]);
  assert.deepEqual(average.rounds.map(r => r.rank), [1, 2, 2, 1]);
  assert.equal(average.rounds[1].got.naru, 6, "Naru takes the first-place votes after serving");
  assert(average.rounds[2].got.naru > 0);
  assert.equal(average.p.result.win, true);
  assert.equal(average.p.result.rows[1].id, "naru", "Naru competes to the end");
  // その先頭は、はじめと同じ持ち点（6対6、9対9）で、その回の出来の差で上に出ている（台本は「先頭に並んだ」と言う）。
  assert.deepEqual(average.rounds.slice(1, 3).map(r => r.top), [["naru:6", "hajime:6"], ["naru:9", "hajime:9"]]);
  // 制作後の票を逃し（王煙楼87に届かない）、提供後に2位まで上げた一台では、なるが持ち点でも単独の先頭になる。
  const late = byRound(entry(), { ...craft(89), holes: craft(86).holes, heat: craft(86).heat, servedQuality: 96 });
  assert.deepEqual(late.rounds[0].got, { hajime: 0, naru: 0, master_hookah: 3, sheikh: 3 });
  assert.deepEqual(late.rounds[1].top, ["naru:6", "hajime:3"]);
  // 最後の総合がシェイクに届かない一台（全工程87）: 最後の票の1位はシェイク、2位はなる。シェイクが勝つ。
  const short = byRound(entry(), craft(87));
  assert.equal(short.rounds[3].got.sheikh, 6);
  assert.equal(short.rounds[3].got.naru, 3);
  assert.equal(short.p.result.win, false);
  assert.equal(short.p.result.rows[0].id, "sheikh");
  // 強い一台（全工程96）: なるは途中の票を取る（2位）が、先頭はずっとはじめ。
  const strong = byRound(entry(), craft(96));
  assert.deepEqual(strong.rounds.map(r => r.leader), ["hajime", "hajime", "hajime", "hajime"]);
  assert.equal(strong.rounds[1].got.naru, 3);
  assert.equal(strong.rounds[2].got.naru, 3);
  assert.equal(strong.p.result.win, true);
  // 勝ちの境目は旧定数と同じ（全工程そろった一台なら最後の総合88で勝ち、87.9で負け）。
  assert.equal(byRound(entry(), craft(88)).p.result.win, true);
  assert.equal(byRound(entry(), craft(87.9)).p.result.win, false);
  // 提供後の票まで入った保存から再開しても、票は二重に入らず、通しと同じ結果になる。
  let value = entry();
  startLegacy(value, craft(89));
  for (let step = 0; step < 9; step++) { beginChapterFourStep(value); finishChapterFourStep(value, craft(89)); }
  beginChapterFourStep(value);
  value = JSON.parse(JSON.stringify(value));
  recoverChapterFourStep(value);
  assert.equal(chapterFourMatch(value).voted, 2);
  assert.equal(chapterFourStandings(chapterFourMatch(value))[0].id, "naru");
  const resumed = byRound(value, craft(89)).p.result;
  assert.deepEqual(resumed.rows, average.p.result.rows);
  assert.deepEqual(resumed.votes, average.p.result.votes);
  // 旧定数のころの保存（提供後の票まで: はじめ1位・シェイク2位）も、そのまま新しい回の値で最後まで進む。
  value = entry();
  startLegacy(value, craft(89));
  for (let step = 0; step < 9; step++) { beginChapterFourStep(value); finishChapterFourStep(value, craft(89)); }
  Object.assign(chapterFourMatch(value), { quality: { naru: 86, master_hookah: 87, sheikh: 88, hajime: 89 },
    votes: Object.fromEntries(CH4_JUDGES.map(judge => [judge, { hajime: 3, naru: 0, master_hookah: 0, sheikh: 2 }])) });
  value = JSON.parse(JSON.stringify(value));
  const legacy = byRound(value, craft(89)).p.result;
  assert.equal(legacy.win, true);
  for (const judge of CH4_JUDGES) assert.equal(CH4_CONTESTANTS.reduce((sum, id) => sum + legacy.votes[judge][id], 0), 10);
  // 周回の持ち込み（NG+）の底上げは、回ごとの値にそれぞれ掛かる。
  value = entry();
  value.cycle = 2;
  value.cycleStartStats = { technique: 100, sense: 100, guts: 100, charm: 100, insight: 100 };
  const seen = [];
  setRivalScoreObserver(row => seen.push(row));
  const lifted = byRound(value, craft(96)).p;
  setRivalScoreObserver(null);
  assert.equal(seen.length, 12);
  seen.forEach((row, index) => {
    const round = Math.floor(index / 3), id = Object.keys(CH4_LEGACY_RIVAL_CURVE)[index % 3];
    assert.equal(row.rival, CH4_LEGACY_RIVAL_CURVE[id][round], `round ${round} ${id} base`);
    assert.equal(row.p, 1);
    assert.equal(row.lifted, liftRivalScore(CH4_LEGACY_RIVAL_CURVE[id][round], 1, 4));
    assert(row.lifted > row.rival);
  });
  for (const id of Object.keys(CH4_LEGACY_RIVAL_CURVE)) assert.equal(lifted.quality[id], liftRivalScore(CH4_LEGACY_RIVAL_CURVE[id][3], 1, 4));
}
// 2026-11-03: 新しい一台は版2、途中/結果の旧保存は版1で完走し、再挑戦でだけ更新する。
{
  assert.equal(CH4_RULES_VERSION, 2);
  assert.deepEqual(CH4_SPEND, [2, 3, 2, 3]);
  assert.deepEqual(CH4_LEGACY_SPEND, [2, 3, 2, 3]);
  assert.deepEqual(CH4_RIVAL_CURVE, { naru: [87, 94, 94.5, 92.5],
    master_hookah: [87.5, 87.5, 87.5, 87.5], sheikh: [90, 88, 88.25, 94] });
  const run = (value, cs) => {
    setState(value);
    startChapterFourCraft(value, cs);
    const rounds = [];
    let previous = 0;
    for (let step = chapterFourMatch(value).step; step < 11; step++) {
      beginChapterFourStep(value);
      const c = structuredClone(cs);
      if (step === 10) finalize(c);
      const p = finishChapterFourStep(value, c);
      if (p.voted !== rounds.length) {
        const spent = Object.values(p.votes.sui).reduce((sum, n) => sum + n, 0);
        rounds.push({ spent: spent - previous, rows: chapterFourStandings(p) });
        previous = spent;
      }
    }
    return { p: chapterFourMatch(value), rounds };
  };
  const held = run(entry(), craft(96));
  assert.deepEqual(held.rounds.map(row => row.spent), [2, 3, 2, 3]);
  assert.equal(held.p.result.rulesVersion, 2);
  assert.equal(held.p.result.win, true);
  for (const judge of CH4_JUDGES) assert.equal(Object.values(held.p.votes[judge]).reduce((sum, n) => sum + n, 0), 10);
  // 3回すべて1位なら確保した支持で勝てる。30%の最終票だけで毎回ひっくり返さない。
  const collapsed = craft(96); collapsed.careHistory[1].score = 56;
  const swept = run(entry(), collapsed);
  assert.equal(swept.rounds[2].rows[0].id, "hajime");
  assert.equal(swept.p.result.win, true, "Sweeping all three earlier polls secures the title");
  // 途中が接戦なら、同じ支持と最後の調整だけの差で勝者が変わる。
  const contested = craft(96); contested.servedQuality = 89; contested.careHistory[0].score = 100;
  const maintained = run(entry(), contested);
  const slipped = structuredClone(contested); slipped.careHistory[1].score = 56;
  const lost = run(entry(), slipped);
  assert.equal(lost.rounds[2].rows[0].id, "hajime", "A contested lead can still be lost on the final poll");
  assert.equal(maintained.p.result.win, true);
  assert.equal(lost.p.result.win, false);
  assert.equal(lost.p.result.rows[0].id, "naru", "Naru remains a possible champion, not a fixed lower-ranked rival");
  const pressured = run(entry(), craft(90));
  assert.deepEqual(pressured.rounds.slice(1, 3).map(row => row.rows[0].id), ["naru", "naru"]);
  assert.equal(pressured.p.result.rows[0].id, "naru");
  const short = run(entry(), craft(85));
  assert.equal(short.p.result.rows[0].id, "sheikh", "Sheikh can take the title on the final poll");
  assert.equal(short.rounds[0].rows.find(row => row.id === "master_hookah").points, 3,
    "The steady master can receive early support; no rival is forced to zero votes");
  const comeback = craft(100);
  comeback.holes = craft(89).holes; comeback.heat = craft(89).heat; comeback.servedQuality = 96;
  const recovered = run(entry(), comeback);
  assert.notEqual(recovered.rounds[0].rows[0].id, "hajime");
  assert.equal(recovered.p.result.win, true, "A late recovery can win; the first poll is not a hard gate");

  let old = entry(), cs = craft(89);
  startChapterFourCraft(old, cs);
  delete chapterFourMatch(old).rulesVersion;
  for (let step = 0; step < 9; step++) { beginChapterFourStep(old); finishChapterFourStep(old, cs); }
  const committed = structuredClone(chapterFourMatch(old).votes);
  beginChapterFourStep(old);
  old = JSON.parse(JSON.stringify(old)); recoverChapterFourStep(old);
  const p = chapterFourMatch(old);
  assert.equal(p.rulesVersion, undefined);
  assert.deepEqual(p.votes, committed, "Loading a legacy match never withdraws or recalculates its committed votes");
  for (let step = p.step; step < 11; step++) {
    beginChapterFourStep(old); const c = structuredClone(cs); if (step === 10) finalize(c); finishChapterFourStep(old, c);
  }
  assert.equal(p.result.rulesVersion, 1); assert.equal(p.result.win, true);
  for (const judge of CH4_JUDGES) assert.equal(Object.values(p.votes[judge]).reduce((sum, n) => sum + n, 0), 10);
  const result = structuredClone(p.result), history = structuredClone(p.history);
  chapterFourMatch(old); assert.deepEqual(p.result, result); assert.deepEqual(p.history, history);

  // すべての投票境界と結果保存をJSON往復。旧規則を新規則で再採点せず、二重投票もしない。
  for (const version of [1, 2]) {
    const make = () => {
      const value = entry(); startChapterFourCraft(value, craft(89));
      if (version === 1) delete chapterFourMatch(value).rulesVersion;
      return value;
    };
    const advance = (value, until) => {
      setState(value);
      for (let step = chapterFourMatch(value).step; step < until; step++) {
        beginChapterFourStep(value); const c = craft(89); if (step === 10) finalize(c);
        finishChapterFourStep(value, c);
      }
    };
    const straight = make(); advance(straight, 11);
    const expected = structuredClone(chapterFourMatch(straight).result);
    for (const boundary of [7, 8, 9, 10, 11]) {
      let value = make(); advance(value, boundary);
      const votes = structuredClone(chapterFourMatch(value).votes);
      if (boundary < 11) beginChapterFourStep(value);
      value = JSON.parse(JSON.stringify(value)); setState(value); recoverChapterFourStep(value);
      assert.deepEqual(chapterFourMatch(value).votes, votes, `v${version} boundary ${boundary} keeps committed votes`);
      startChapterFourCraft(value, craft(100)); // 保存済みの一台は上書きしない。
      assert.equal(chapterFourMatch(value).rulesVersion, version === 1 ? undefined : 2);
      advance(value, 11);
      assert.deepEqual(chapterFourMatch(value).result, expected, `v${version} boundary ${boundary} matches uninterrupted result`);
    }
  }
  // 新基準にも既存NG+の底上げを各回適用。最高の一台は持ち込み最大でも通せる。
  const ng = entry(); ng.cycle = 2;
  ng.cycleStartStats = { technique: 100, sense: 100, guts: 100, charm: 100, insight: 100 };
  const observed = []; setRivalScoreObserver(row => observed.push(row));
  const ngMatch = run(ng, craft(100)).p; setRivalScoreObserver(null);
  assert.equal(ngMatch.result.win, true);
  assert.equal(observed.length, 12);
  observed.forEach((row, index) => {
    const round = Math.floor(index / 3), id = Object.keys(CH4_RIVAL_CURVE)[index % 3];
    assert.equal(row.rival, CH4_RIVAL_CURVE[id][round]);
    assert.equal(row.p, 1); assert.equal(row.lifted, liftRivalScore(row.rival, 1, 4));
  });

  const failed = entry(); startChapterFourCraft(failed, craft());
  const prior = chapterFourMatch(failed); delete prior.rulesVersion;
  beginChapterFourStep(failed); finishChapterFourStep(failed, { ...craft(), failed: "burnt" });
  assert.equal(prior.result.rulesVersion, 1);
  assert(resetChapterFourCraft(failed));
  assert.equal(prior.rulesVersion, 2); assert.equal(prior.result, null);
  assert.equal(prior.history[0].rulesVersion, 1, "Retry keeps the legacy result history");
  startChapterFourCraft(failed, craft()); assert.equal(prior.rulesVersion, 2);

  const mistakes = entry();
  const retry = chapterFourMatch(mistakes);
  mistakes.flags._ch4.attempts = 99;
  retry.history = [{ win: false }, { win: true }, {}, { win: false }, { win: false }];
  assert.equal(chapterFourRetryContext(mistakes).losses, 3);
  assert.equal(chapterFourRetryContext(mistakes).retryAssist, false);
  retry.history = [];
  assert.equal(chapterFourRetryContext(mistakes).losses, 0, "Old attempt counters do not invent known losses");
}
// 不正な採点・保存は工程や一部の票を進める前に拒否する。
{
  for (const invalid of [null, 0, 3, "2", NaN]) {
    const value = entry(); chapterFourMatch(value).rulesVersion = invalid;
    assert.throws(() => chapterFourMatch(value), /採点規則/);
  }
  for (const invalid of [NaN, Infinity, -Infinity, -1, 101, "90", null]) {
    const value = entry(), cs = craft(); startChapterFourCraft(value, cs);
    for (let i = 0; i < 7; i++) { beginChapterFourStep(value); finishChapterFourStep(value, cs); }
    beginChapterFourStep(value); cs.heat.score = invalid;
    const before = structuredClone(chapterFourMatch(value));
    assert.throws(() => finishChapterFourStep(value, cs), /工程成績/);
    assert.deepEqual(chapterFourMatch(value), before);
  }
  const value = entry(), cs = craft(); startChapterFourCraft(value, cs);
  for (let i = 0; i < 10; i++) { beginChapterFourStep(value); finishChapterFourStep(value, cs); }
  beginChapterFourStep(value); cs.total = Infinity;
  const before = structuredClone(chapterFourMatch(value));
  assert.throws(() => finishChapterFourStep(value, cs), /総合成績/);
  assert.deepEqual(chapterFourMatch(value), before, "Invalid final total cannot commit the final poll");
  cs.total = 96; chapterFourMatch(value).votes.emil.hajime += 1;
  const badVotes = structuredClone(chapterFourMatch(value));
  assert.throws(() => finishChapterFourStep(value, cs), /持ち点/);
  assert.deepEqual(chapterFourMatch(value), badVotes, "One malformed judge cannot partially commit the others");
}
console.log("PASS: Chapter 4 real scores, old/new rules, final recovery/collapse, votes, failure/retry, rollback and feedback");
