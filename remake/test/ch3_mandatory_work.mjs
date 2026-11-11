// 必須の仕事: 選んだこと・完了した調整・読了を分け、古い保存へ体験を足さない。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { CH3_INTRO_SCENES } from "../js/chapters/ch3-scenes.js";
import { CH3_SERVICE_IDS, chapterThreeWork, chapterThreeService, chapterThreeServiceDue,
  chapterThreeWorkDialogue, recordChapterThreeWorkChoice, recordChapterThreeServiceCare,
  runChapterThreeService } from "../js/chapters/ch3-work-progress.js";
import { craftContext } from "../js/craft/context.js";

const index = CH3_INTRO_SCENES.findIndex(scene => scene.id === CH3_SERVICE_IDS[0]);
const seed = () => ({ chapter: 3, day: 40, slot: 1, phase: "daily", money: 0, stamina: 1,
  stats: { technique: 10 }, affinity: { mashiro: 0, saku: 0 }, inventory: {},
  flags: { _ch3_intro: { routeVersion: 3, startDay: 32, stage: index, titleSeen: true } } });
const preserved = value => { const copy = structuredClone(value); delete copy.flags._ch3_intro.work; return copy; };
const care = (score = 85, extra = {}) => ({ careHistory: [{ score, coals: 2, over: false, under: false }],
  careCoals: { place: "outer" }, ...extra });
const all = {};
for (const file of ["ch3_double_apple", "ch3_main", "ch3_rivals"])
  for (const d of JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${file}.json`, import.meta.url))).dialogues)
    all[d.dialogue_id] = d;
const text = dialogue => dialogue.lines.map(line => line.text || "").join("\n");

// 既定の制作風景はそのまま、店仕事の場所だけを指定できる。
{
  const source = fs.readFileSync(new URL("../js/craft/worker.js", import.meta.url), "utf8");
  const helper = name => vm.runInNewContext(source.match(new RegExp(`^export const ${name} = (.+);$`, "m"))[1]);
  const bg = helper("benchBgRef"), tag = helper("benchPlaceTag");
  assert.equal(bg({ venueBg: "bg_mukai_shop" }), "bg_mukai_shop");
  assert.equal(tag({ venueLabel: "MUKAI" }), "MUKAI");
  assert.equal(bg({ mode: "tournament" }), "bg_tournament_stage");
  assert.equal(bg({ venue: "home" }), "bg_home");
  assert.equal(bg({ mode: "tutorial" }), "bg_tonari_inside");
  assert.equal(tag({ mode: "tutorial" }), "TONARI");
}

// 古い保存を読むだけでは空の記録さえ生やさない。未体験の注文・試作・休息を思い出さない。
{
  const value = seed(), before = structuredClone(value);
  assert.equal(chapterThreeWork(value), null);
  for (const id of ["ch3_daily_cup_1", "ch3_work_without_taste", "ch3_strategy", "ch3_national_craft"])
    assert.deepEqual(chapterThreeWorkDialogue(value, all[id]).lines, all[id].lines);
  assert.deepEqual(value, before);
  assert.equal(recordChapterThreeWorkChoice(value, "ch3_rest_before_recovery", { ch3_rest_choice: "bogus" }), false);
  assert.deepEqual(value, before);
  assert.equal(recordChapterThreeServiceCare(value, care()), false);
  assert.deepEqual(value, before);
}

// DAY4の二つの過ごし方は正誤や報酬なし。翌日へ、読了した回答だけが返る。
for (const rest of ["tea", "sit"]) {
  const value = seed(), before = preserved(value);
  assert(recordChapterThreeWorkChoice(value, "ch3_rest_before_recovery", { ch3_rest_choice: rest }));
  assert.equal(chapterThreeWork(value).rest, rest);
  const echo = rest === "tea" ? /お茶だけにした/ : /吸わずに座っていた/;
  assert.match(text(chapterThreeWorkDialogue(value, all.ch3_work_without_taste)), echo);
  for (const shift of ["heat", "taste"])
    assert(recordChapterThreeWorkChoice(value, "ch3_work_without_taste", { ch3_work_role: shift }));
  assert.match(text(chapterThreeWorkDialogue(value, all.ch3_naru_contact_before_tournament)), /味が戻った報告ではない/);
  assert.deepEqual(preserved(value), before);
}

// DAY9: 注文の聞き方×出来の全分岐。金欠・低体力・在庫なしでも予定と成績は動かさない。
for (const order of ["gentle", "pace"]) for (const [score, failed, result] of [[85, false, "good"], [35, false, "rough"], [0, true, "failed"]]) {
  const value = seed(), before = preserved(value), reads = [];
  let adjusted = 0, saved = 0;
  assert(await runChapterThreeService(value, {
    read: async id => { reads.push(id); if (id === CH3_SERVICE_IDS[0])
      recordChapterThreeWorkChoice(value, id, { ch3_service_order: order }); return true; },
    adjust: async actualOrder => { assert.equal(actualOrder, order); adjusted++; return care(score, { failed }); },
    save: () => saved++,
  }));
  assert.deepEqual(reads, CH3_SERVICE_IDS);
  assert.equal(adjusted, 1); assert.equal(saved, 3);
  assert.equal(chapterThreeService(value).result, result);
  assert.equal(chapterThreeService(value).feedbackRead, true);
  assert.equal(recordChapterThreeServiceCare(value, care(99)), false);
  assert(await runChapterThreeService(value, { read: () => assert.fail("Replay"), adjust: () => assert.fail("Rebuild"), save: () => assert.fail("Resave") }));
  assert.deepEqual(preserved(value), before);
  const feedback = text(chapterThreeWorkDialogue(value, all[CH3_SERVICE_IDS[1]]));
  assert.match(feedback, result === "failed" ? /作り直す間/ : result === "rough" ? /少し眉を上げ/ : /今は吸いやすい/);
  if (failed) assert.doesNotMatch(feedback, /ノートに、交換した炭/);
  const notes = text(chapterThreeWorkDialogue(value, all.ch3_strategy));
  assert.match(notes, order === "gentle" ? /軽さの希望から聞いた/ : /吸う時間から聞いた/);
  assert.match(notes, result === "failed" ? /作り直しを頼んだ/ : result === "rough" ? /戻したあとも整わなかった/ : /吸いやすいって言って/);
}

// 作り終えたあと、反応の途中でSAVE/LOAD。注文も調整もやり直さず、反応から再開する。
{
  let value = seed(); let saves = 0;
  assert.equal(await runChapterThreeService(value, {
    read: async id => { if (id === CH3_SERVICE_IDS[0]) { recordChapterThreeWorkChoice(value, id, { ch3_service_order: "pace" }); return true; } return false; },
    adjust: async () => care(20), save: () => saves++,
  }), false);
  assert.equal(saves, 2); assert.equal(chapterThreeService(value).careDone, true);
  assert.equal(chapterThreeService(value).feedbackRead, undefined);
  value = JSON.parse(JSON.stringify(value));
  const reads = [];
  assert(await runChapterThreeService(value, { read: async id => { reads.push(id); return true; },
    adjust: () => assert.fail("Completed adjustment repeated after LOAD"), save: () => {} }));
  assert.deepEqual(reads, [CH3_SERVICE_IDS[1]]);
}

// 注文中断は注文の既読にせず、調整中断は出来を捏造しない。別保存のLOAD後には確定しない。
{
  const value = seed();
  assert.equal(await runChapterThreeService(value, { read: async () => false, adjust: () => assert.fail("Too early"), save: () => assert.fail("Unfinished order") }), false);
  assert.equal(chapterThreeService(value).introRead, undefined);
  assert.equal(await runChapterThreeService(value, {
    read: async id => { recordChapterThreeWorkChoice(value, id, { ch3_service_order: "gentle" }); return true; },
    adjust: async () => null, save: () => {},
  }), false);
  assert.equal(chapterThreeService(value).careDone, undefined);
  let live = true;
  assert.equal(await runChapterThreeService(value, { read: () => assert.fail("Order repeated"),
    adjust: async () => { live = false; return care(); }, save: () => assert.fail("Stale care saved"), isCurrent: () => live }), false);
  assert.equal(chapterThreeService(value).careDone, undefined);
}

// 章が済んだ旧保存・DAY9より後の保存・DAY9自体のない旧行程を戻さない。
for (const change of [value => value.flags._ch3_intro.stage++, value => value.flags._ch3_intro.stage = CH3_INTRO_SCENES.length,
  value => value.chapter = 4, value => delete value.flags._ch3_intro.routeVersion]) {
  const value = seed(); change(value); const before = structuredClone(value);
  assert.equal(chapterThreeServiceDue(value), false);
  assert.equal(await runChapterThreeService(value, { read: () => assert.fail("Old save replay"), adjust: () => assert.fail("Old save rebuilt"), save: () => assert.fail("Old save saved") }), false);
  assert.deepEqual(value, before);
}

// 自分で試した任意制作だけをノートへ載せ、良い・粗い・失敗を混ぜない。
for (const id of ["saku", "steve"]) for (const result of ["good", "rough", "failed"]) {
  const value = seed(); value.flags[`_ch3_trial_${id}`] = { practiceDone: true, result };
  const dialogue = chapterThreeWorkDialogue(value, all.ch3_strategy);
  const expected = all.ch3_strategy.branches[`trial_${id}_${result}`][0].text;
  assert(text(dialogue).includes(expected));
  assert.equal(dialogue.lines.filter(line => /試したページ|試した時のページ|試して傷めた/.test(line.text)).length, 1);
}
for (const focus of ["aroma", "light", "sweet"]) {
  const value = seed(); value.flags._ch3_strategy = focus;
  const before = structuredClone(value);
  const dialogue = chapterThreeWorkDialogue(value, all.ch3_national_craft);
  assert.equal(dialogue.lines[0].text, all.ch3_national_craft.branches[`strategy_${focus}`][0].text);
  assert.deepEqual(value, before);
}

// 強制の調整は、共有の熱管理UIを一回だけ使い、店の機材を使う。スミさんや架空の採点は出さない。
{
  const context = vm.createContext({ DOMException });
  const value = seed(), before = structuredClone(value); let calls = 0, retired = 0, captured;
  const exports = {
    "../core/state.js": { state: value },
    "../craft/session.js": { newSession: mode => ({ mode, equip: { bowl: "own" } }), openBench: cs => { captured = cs; }, waitBenchReady: async () => {} },
    "../craft/steps.js": { evaluateMix: cs => ({ total: Object.values(cs.mix).reduce((n, g) => n + g, 0) }) },
    "../craft/pull.js": { runCare: async (cs, { round }) => { calls++; assert.equal(round, 1); cs.careHistory = [{ score: 75 }]; } },
    "../craft/conditions.js": { temperatureAfterSteam: () => .54 },
    "../craft/flavor-life.js": { ensureFlavorLife: () => {} },
    "../core/ui.js": { retireScreen: () => retired++ },
  };
  const source = fs.readFileSync(new URL("../js/chapters/ch3-service.js", import.meta.url), "utf8");
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(async id => {
    const data = exports[id]; assert(data, `Unexpected dependency: ${id}`);
    return new vm.SyntheticModule(Object.keys(data), function () { for (const [key, val] of Object.entries(data)) this.setExport(key, val); }, { context });
  });
  await mod.evaluate();
  assert(await mod.namespace.adjustChapterThreeService());
  assert.equal(calls, 1); assert.equal(retired, 1);
  assert.equal(captured.mode, "tutorial");
  assert.equal(captured.venueBg, "bg_mukai_shop");
  assert.equal(captured.venueLabel, "MUKAI");
  assert.deepEqual([...captured.audienceIds], []);
  assert.doesNotMatch(captured.lessonHelp.care.detail, /スミ/);
  assert.equal(captured.equip.bowl, "silicone_bowl");
  assert.equal(captured.mixInfo.total, 12);
  const display = craftContext(captured);
  assert.equal(display.recipient, "綾取さん"); assert.doesNotMatch(display.summary, /スミさん|審査員/);
  assert.deepEqual(value, before, "Mandatory adjustment charged resources or granted a reward");
}

for (const id of ["ch3_rest_before_recovery", "ch3_daily_cup_1", "ch3_work_without_taste", ...CH3_SERVICE_IDS, "ch3_strategy"])
  for (const line of [...all[id].lines, ...Object.values(all[id].branches || {}).flat()])
    assert(!["apply", "set_flag", "remember"].includes(line.type), `${id}: unconditional reward or invented memory`);
console.log("ch3 mandatory work: ok");
