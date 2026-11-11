// ドバイの仕事: 実選択・作業完了・読了と、旧保存・中断・資源を境界ごとに確認する。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as progress from "../js/chapters/ch4-staff-work-progress.js";
import { craftContext } from "../js/craft/context.js";
import { paginate } from "../js/vn/text.js";
const { CH4_STAFF_IDS: ids, chapterFourStaffWork: work, chapterFourStaffNight: due,
  chapterFourStaffSceneAllowed: allowed, completeChapterFourStaffScene: complete,
  recordChapterFourStaffChoice: choose, recordChapterFourStaffCare: recordCare,
  runChapterFourStaffNight: run, chapterFourStaffDialogue: dialogue } = progress;
const seed = (day = 3) => ({ chapter: 4, day: 60 + day - 1, slot: 1, phase: "daily", money: 0, stamina: 1,
  stats: { technique: 10 }, affinity: { naru: 0, noor: 0 }, inventory: {}, growth: { exp: 0 },
  flags: { _ch4: { startDay: 60, day, part: "free", routeVersion: 2, read: {} }, _ch4_strategy: "peach" } });
const date = (value, day) => { value.day = 60 + day - 1; value.flags._ch4.day = day; };
const saved = value => JSON.parse(JSON.stringify(value));
const preserved = value => { const result = saved(value); delete result.flags._ch4.staffWork;
  for (const id of Object.values(ids)) delete result.flags._ch4.read[id]; return result; };
const all = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch4_staff_work.json", import.meta.url))).dialogues.map(d => [d.dialogue_id, d]));
const text = d => d.lines.map(row => row.text || "").join("\n");
const care = (score = 85, { coals = 2, place = "outer", failed = false } = {}) => ({ careHistory: [{ score, coals, over: false, under: false }], careCoals: { count: coals, place }, failed });
function notice() { const value = seed(); assert(complete(value, ids.notice)); date(value, 4); return value; }
function prepared(choice = "tools") { const value = notice(); assert(choose(value, ids.preparation, "ch4_staff_prep_choice", choice));
  for (const id of [ids.preparation, ids.prepared, ids.notebook]) assert(complete(value, id)); date(value, 9); return value; }
async function serve(value, { order = "sweetness", result = care(), stop } = {}) {
  return run(value, { read: async id => {
    if (id === ids.order && !work(value)?.service?.choice) choose(value, id, "ch4_staff_order_choice", order);
    return id !== stop;
  }, adjust: async () => result, save: () => {} });
}

// 読むだけで記録を生やさず、無効な選択・早い確定・未完了の調整を採用しない。
{
  const value = seed(), before = saved(value);
  assert.equal(work(value), null); assert.equal(due(value).id, "notice");
  for (const id of Object.values(ids)) dialogue(value, all[id]);
  assert.equal(choose(value, ids.preparation, "ch4_staff_prep_choice", "tools"), false);
  assert.equal(complete(value, ids.prepared), false); assert.equal(recordCare(value, care()), false);
  assert.deepEqual(value, before);
  const reads = [];
  assert(await run(value, { read: async id => { reads.push(id); return true; }, save: () => {} }));
  assert.deepEqual(reads, [ids.notice]); assert.equal(due(value), null);
  assert.equal(work(value)?.preparation, undefined);
}

// DAY4の選択は正誤・報酬なし。実作業・ノートの読了は独立し、DAY9に選んだ段取りだけが返る。
for (const choice of ["tools", "seats"]) {
  const value = notice(), before = preserved(value); let saves = 0;
  assert(choose(value, ids.preparation, "ch4_staff_prep_choice", choice));
  assert.equal(work(value).preparation.introRead, undefined); assert.equal(work(value).preparation.workDone, undefined);
  assert.equal(choose(value, ids.preparation, "ch4_staff_prep_choice", choice === "tools" ? "seats" : "tools"), false);
  const restored = dialogue(value, all[ids.preparation]);
  assert(!restored.lines.some(line => line.type === "choice"));
  assert.match(text(restored), choice === "tools" ? /器具の番号を見る/ : /俺は席と水を見る/);
  assert(await run(value, { read: async id => {
    if (id === ids.prepared) { assert(work(value).preparation.introRead); assert.equal(work(value).preparation.workDone, undefined); }
    if (id === ids.notebook) { assert(work(value).preparation.workDone); assert.equal(work(value).preparation.read, undefined); }
    return true;
  }, save: () => saves++ }));
  assert.equal(saves, 3); assert(work(value).preparation.read); assert.equal(due(value), null);
  assert.deepEqual(preserved(value), before);
  date(value, 9);
  const order = text(dialogue(value, all[ids.order]));
  assert.match(order, choice === "tools" ? /番号を揃えてくれた組/ : /椅子をずらした角の席/);
  assert.doesNotMatch(order, choice === "tools" ? /椅子をずらした角の席/ : /番号を揃えてくれた組/);
}

// DAY4の作業後、ノートの途中で中断。LOADでは済んだ仕事を繰り返さない。
{
  let value = notice();
  assert.equal(await run(value, { read: async id => {
    if (id === ids.preparation) choose(value, id, "ch4_staff_prep_choice", "seats");
    return id !== ids.notebook;
  }, save: () => {} }), false);
  assert(work(value).preparation.workDone); assert.equal(work(value).preparation.read, undefined);
  value = saved(value); const reads = [];
  assert(await run(value, { read: async id => { reads.push(id); return true; }, save: () => {} }));
  assert.deepEqual(reads, [ids.notebook]);
}

// 注文の二択×実際の炭操作×良い・粗い・失敗。金欠・低体力・在庫なしでも完了できる。
for (const prep of ["tools", "seats"]) for (const order of ["sweetness", "strength"])
  for (const [score, failed, expected] of [[85, false, "good"], [30, false, "rough"], [0, "cold", "failed"]])
    for (const [coals, place] of [[0, null], [1, "outer"], [2, "std"], [3, "inner"]]) {
      const value = prepared(prep), before = preserved(value); let adjusted = 0, saves = 0;
      assert(await run(value, { read: async id => {
        if (id === ids.order) assert(choose(value, id, "ch4_staff_order_choice", order));
        return true;
      }, adjust: async actual => { assert.equal(actual, order); adjusted++; return care(score, { failed, coals, place }); }, save: () => saves++ }));
      assert.equal(adjusted, 1); assert.equal(saves, 3);
      const service = work(value).service;
      assert.equal(service.choice, order); assert(service.introRead); assert(service.careDone); assert(service.read);
      assert.equal(service.result, expected); assert.equal(service.adjustment.coals, coals); assert.equal(service.adjustment.place, place);
      assert.equal(recordCare(value, care()), false); assert.equal(due(value), null);
      assert.deepEqual(preserved(value), before);
      const feedback = text(dialogue(value, all[ids.returned]));
      assert.match(feedback, expected === "good" ? /今は、香りが分かります/ : expected === "rough" ? /まだ少し吸いづらい/ : /作り直す間の水/);
      date(value, 14); value.flags._ch4.part = "tournament";
      const echo = text(dialogue(value, all[ids.echo]));
      assert.match(echo, order === "sweetness" ? /先に甘さの好み/ : /先に吸い心地の強さ/);
      assert.match(echo, coals ? new RegExp(`炭を${coals}個`) : /炭を替えず/);
      if (coals) assert(echo.includes({ outer: "外寄り", std: "いつもの位置", inner: "内寄り" }[place]));
      assert.doesNotMatch(echo, /\{coals\}|\{coalPlace\}|リハーサルでも/);
      assert(allowed(value, ids.echo)); assert(complete(value, ids.echo)); assert(!allowed(value, ids.echo));
      assert(!allowed(value, ids.cleanup));
      value.flags._ch4.match = { result: { rank: 4 } };
      assert(allowed(value, ids.cleanup));
      const cleaned = text(dialogue(value, all[ids.cleanup]));
      assert.match(cleaned, prep === "tools" ? /使った組が分かる/ : /椅子は、あの幅/);
      assert(complete(value, ids.cleanup)); assert(!allowed(value, ids.cleanup));
    }

// 注文を選んだ直後の中断は、選択を保って再開するが、読了・調整済みにはしない。
{
  let value = prepared();
  assert.equal(await run(value, { read: async id => { assert(choose(value, id, "ch4_staff_order_choice", "strength")); return false; },
    adjust: () => assert.fail("Started before order finished"), save: () => assert.fail("Unfinished order marked read") }), false);
  assert.equal(work(value).service.choice, "strength"); assert.equal(work(value).service.introRead, undefined);
  value = saved(value);
  const source = dialogue(value, all[ids.order]); assert(!source.lines.some(row => row.type === "choice"));
  assert.match(text(source), /強い吸い心地と、軽い吸い心地/);
  assert(await serve(value)); assert.equal(work(value).service.choice, "strength");
}

// 作り終えた直後・反応の途中でLOADしても、注文と調整を繰り返さない。
{
  let value = prepared();
  assert.equal(await serve(value, { stop: ids.returned, result: care(20) }), false);
  assert(work(value).service.careDone); assert.equal(work(value).service.read, undefined);
  value = saved(value); const reads = [];
  assert(await run(value, { read: async id => { reads.push(id); return true; }, adjust: () => assert.fail("Completed care repeated"), save: () => {} }));
  assert.deepEqual(reads, [ids.returned]);
}

// 調整中断と別保存へのLOADは結果を確定しない。未完了の調整だけを再開する。
{
  const value = prepared(); assert.equal(await serve(value, { result: null }), false);
  assert(work(value).service.introRead); assert.equal(work(value).service.careDone, undefined);
  let live = true;
  assert.equal(await run(value, { read: () => assert.fail("Order repeated"), adjust: async () => { live = false; return care(); },
    isCurrent: () => live, save: () => assert.fail("Stale result saved") }), false);
  assert.equal(work(value).service.careDone, undefined);
  for (const bad of [null, { cancelled: true }, { careHistory: [{ score: 80 }] }, care(85, { coals: -1 }), care(85, { coals: 2, place: "bogus" })])
    assert.equal(recordCare(value, bad), false);
}

// 過ぎた未着手の場面を救済として差し込まず、旧行程・完了済み・別章へ面識や体験を足さない。
for (const today of [1, 2, 4, 5, 8, 9, 10, 12, 13, 14]) {
  const value = seed(today), before = saved(value);
  assert.equal(due(value), null);
  assert.equal(await run(value, { read: () => assert.fail("Past-date replay"), save: () => assert.fail("Old save altered") }), false);
  assert.deepEqual(value, before);
}
for (const mutate of [value => delete value.flags._ch4.routeVersion, value => value.chapter = 5,
  value => value.flags._ch4.part = "cleared", value => value.flags._ch4.part = "resolution", value => value.phase = "cleared"]) {
  const value = seed(); mutate(value); const before = saved(value);
  assert.equal(due(value), null); assert.equal(complete(value, ids.notice), false); assert.deepEqual(value, before);
}
{
  const value = prepared(); await serve(value); date(value, 14); value.flags._ch4.part = "tournament";
  value.flags._ch4_rehearsal = { feedbackRead: false }; assert.doesNotMatch(text(dialogue(value, all[ids.echo])), /リハーサルでも/);
  value.flags._ch4_rehearsal.result = "rough"; assert.match(text(dialogue(value, all[ids.echo])), /リハーサルでも/);
}

// 表示アダプタが共有careを一度だけ使い、実選択を即保存、hookを必ず復元することも確認する。
{
  const context = vm.createContext({ AbortController, DOMException });
  const value = notice(), initial = preserved(value), hooks = { onChoice: null }; let captured, careCalls = 0, saves = 0, retires = 0, playCancel = false, fetches = 0;
  const window = { addEventListener() {}, removeEventListener() {} };
  let active = true;
  const exports = {
    "../core/state.js": { state: value, save: () => saves++ },
    "../core/chapter-clock.js": { atChapterFinalDay: () => false },
    "../core/data.js": { DB: { dialogues: all }, bgUrl: id => id, CHAPTER_DIALOGUE_FILES: { ch4Staff: "ch4_staff_work" } },
    "../core/chapter-data.js": { readDialogues: async (name, required) => {
      fetches++; assert.equal(name, "ch4_staff_work"); assert.deepEqual([...required], Object.values(ids)); return all;
    } },
    "../core/ui.js": { setBg: async () => {}, showScreen: () => {}, retireScreen: () => retires++ },
    "../vn/engine.js": { hooks, play: async source => {
      const selected = source.dialogue_id === ids.preparation ? ["ch4_staff_prep_choice", "tools"]
        : source.dialogue_id === ids.order ? ["ch4_staff_order_choice", "strength"] : null;
      if (selected && source.lines.some(row => row.type === "choice")) hooks.onChoice?.(source.dialogue_id, ...selected);
      return { cancelled: playCancel };
    } },
    "../craft/session.js": { newSession: mode => ({ mode, equip: { bowl: "own" } }), openBench: cs => { captured = cs; },
      waitBenchReady: async () => {}, benchRoot: () => null },
    "../craft/steps.js": { evaluateMix: cs => ({ total: Object.values(cs.mix).reduce((a, b) => a + b, 0) }) },
    "../craft/pull.js": { runCare: async (cs, { round }) => { careCalls++; assert.equal(round, 1); Object.assign(cs, care()); } },
    "../craft/conditions.js": { temperatureAfterSteam: () => .54 },
    "../craft/flavor-life.js": { ensureFlavorLife: () => {} },
    "./ch4-staff-work-progress.js": progress,
  };
  context.window = window;
  const mod = new vm.SourceTextModule(fs.readFileSync(new URL("../js/chapters/ch4-staff-work.js", import.meta.url), "utf8"), { context });
  await mod.link(async id => { const data = exports[id]; assert(data, `Unexpected dependency: ${id}`);
    return new vm.SyntheticModule(Object.keys(data), function () { for (const [key, val] of Object.entries(data)) this.setExport(key, val); }, { context }); });
  await mod.evaluate();
  const api = mod.namespace, previous = () => {}; hooks.onChoice = previous;
  const event = api.chapterFourStaffNightEvent({ isCurrent: () => active });
  assert.equal(event.schedule, "fixed"); assert(!event.done());
  const night = new vm.SourceTextModule(fs.readFileSync(new URL("../js/daily/night-events.js", import.meta.url), "utf8"), { context });
  await night.link(async id => {
    const data = exports[id]; assert(data, `Unexpected night dependency: ${id}`);
    return new vm.SyntheticModule(Object.keys(data), function () { for (const [key, val] of Object.entries(data)) this.setExport(key, val); }, { context });
  });
  await night.evaluate();
  playCancel = true;
  const dayBefore = value.day;
  await assert.rejects(() => night.namespace.runNightPlan({ [value.day]: event }), error => error.name === "AbortError");
  assert.equal(value.day, dayBefore);
  assert.equal(value.flags._night_event_day, undefined, "Cancelled fixed night was marked complete");
  assert.equal(due(value)?.id, "preparation", "Cancelled night lost its only due date");
  assert.equal(work(value).preparation.choice, "tools"); assert.equal(work(value).preparation.introRead, undefined);
  assert.equal(saves, 1); assert.equal(hooks.onChoice, previous);
  playCancel = false; assert(await event.run()); assert(event.done()); assert.equal(hooks.onChoice, previous);
  assert.deepEqual(preserved(value), initial);
  date(value, 9); const before = preserved(value);
  assert(await api.chapterFourStaffNightEvent({ isCurrent: () => active }).run());
  assert.equal(careCalls, 1); assert.equal(retires, 1); assert.equal(captured.mode, "tutorial");
  assert.deepEqual([...captured.audienceIds], []); assert.equal(captured.mixInfo.total, 12);
  assert.equal(captured.mix.peach, 4); assert.equal(captured.equip.bowl, "silicone_bowl");
  assert.equal(captured.venueBg, progress.CH4_STAFF_BG); assert.equal(captured.venueLabel, "共用ブース");
  assert.doesNotMatch(captured.lessonHelp.care.detail, /スミ|審査員/);
  assert.equal(craftContext(captured).recipient, "共用ブースのお客さん"); assert.deepEqual(preserved(value), before);
  date(value, 14); value.flags._ch4.part = "tournament";
  assert(await api.readChapterFourStaffCheckpoint(ids.echo, { isCurrent: () => active }));
  const once = saves; assert(await api.readChapterFourStaffCheckpoint(ids.echo)); assert.equal(saves, once);
  assert.equal(hooks.onChoice, previous);
  active = false; assert.equal(await api.adjustChapterFourStaffService("strength", { isCurrent: () => active }), null);
  assert.equal(fetches, 0, "Already loaded dialogue was fetched again");
  exports["../core/data.js"].DB.dialogues = {};
  await api.loadChapterFourStaffDialogues();
  assert.equal(fetches, 1, "The registered lazy dialogue file was not loaded");
}

// 本筋の追加に、能力・好感度・経験値・在庫・投票の暗黙の報酬や未体験の記憶を紛れ込ませない。
for (const source of Object.values(all)) for (const line of [...source.lines, ...Object.values(source.branches || {}).flat()]) {
  assert(!["apply", "set_flag", "remember", "flavor_lesson"].includes(line.type), source.dialogue_id);
  assert(!/好感度|審査員|シェイク|王族/.test(line.text || ""), `${source.dialogue_id}: unrelated reveal/reward`);
  if (line.text) {
    const actual = line.text.replaceAll("{coals}", "4").replaceAll("{coalPlace}", "いつもの位置");
    assert.equal(paginate(actual).length, 1, `${source.dialogue_id}: dialogue split mid-sentence: ${actual}`);
  }
}
assert.deepEqual(Object.values(ids), progress.CH4_STAFF_SCENE_FILES.ch4_staff_work);
console.log("ch4 staff work: all order/adjustment/result branches, save interruptions, legacy saves, isolated UI and resources passed");
