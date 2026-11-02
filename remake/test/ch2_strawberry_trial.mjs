// 第2章の苺の試作（#1650）: 試煙会の帰りに試供品→tonariで熱だけを試す→スミさんの感想。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { CH2_NIGHTS, STRAWBERRY_TRIAL_IDS, strawberryTrialReady } from "../js/chapters/ch2-story-data.js";
import { gainFlavorExperience, masteryDay } from "../js/core/flavor-mastery.js";

const root = new URL("../../", import.meta.url);
const main = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("data/dialogue/ch2_main.json", root), "utf8")).dialogues.map(d => [d.dialogue_id, d]));
const text = id => main[id].lines.map(l => l.text || "").join("\n");

// DAY9の試煙会の直後に、試供品を受け取る場面を読む
const day9 = CH2_NIGHTS.find(n => n.day === 9).steps;
assert.deepEqual(day9.map(s => s.id), ["remake_ch2_ageha_tasting", "ch2_strawberry_sample"]);
assert.equal(day9[1].file, "ch2_main");
assert.equal(day9[1].sample, true);
assert.match(text("ch2_strawberry_sample"), /熱だけ/);
assert.match(text("ch2_strawberry_sample"), /まかない練習/, "次に何をすればいいかを渡す");

// 台本: 確かめる点は熱の一つ。結果はスミさんの感想で返す。一人称は俺。
for (const id of STRAWBERRY_TRIAL_IDS) {
  assert(main[id]?.lines?.length, id);
  assert(main[id].lines.every(l => typeof l.speaker === "string" && typeof l.face === "string" && l.text), id);
  assert.doesNotMatch(text(id), /僕|ボク|私は/, `${id}: はじめの一人称`);
}
for (const id of STRAWBERRY_TRIAL_IDS.filter(id => id !== "ch2_strawberry_trial_intro")) {
  assert(main[id].lines.some(l => l.speaker === "sumi"), `${id}: 相手の感想`);
}
assert.match(text("ch2_strawberry_trial_intro"), /熱だけ/);

// 出す条件: 第2章・試煙会の後・未完了・台本あり
const tasted = { chapter: 2, flags: { _ch2_read_remake_ch2_ageha_tasting: true } };
assert.equal(strawberryTrialReady(tasted, main), true);
assert.equal(strawberryTrialReady({ chapter: 2, flags: {} }, main), false, "試煙会の前は出さない");
assert.equal(strawberryTrialReady({ ...tasted, chapter: 3 }, main), false);
assert.equal(strawberryTrialReady({ chapter: 2, flags: { ...tasted.flags, _ch2_strawberry_trial: "hot" } }, main), false, "一度だけ");
assert.equal(strawberryTrialReady(tasted, {}), false, "台本が読めない時は出さない");

// 試作の流れ（制作と会話は差し替え）
const state = { chapter: 2, flags: {} };
let stock, played, practice, simulateMastery = false, practiceRuns = 0;
const context = vm.createContext({});
const mocks = {
  "../core/state.js": { state, save: () => {} },
  "../vn/engine.js": { play: async id => { played.push(id); return {}; } },
  "../daily/shop.js": {
    addFlavorStock: (id, g) => { stock[id] = Math.max(0, (stock[id] || 0) + g); },
    flavorStock: id => stock[id] || 0,
  },
  "../craft/score.js": { flavorFamilyGrams: (mix, family) => Object.entries(mix || {}).reduce((a, [id, g]) => a + (id.includes(family) ? g : 0), 0) },
  "./ch2-story-data.js": { STRAWBERRY_TRIAL_IDS, strawberryTrialReady },
  "../craft/practice.js": { runFullPractice: async () => {
    practiceRuns++;
    if (!simulateMastery) return practice;
    const cs = { ...practice, masteryGained: false };
    const key = `_mastery_practice_${masteryDay(state)}_self`;
    if (cs.mix.afsahr_strawberry) stock.afsahr_strawberry -= cs.mix.afsahr_strawberry;
    if (!state.flags[key]) {
      const before = { ...state.flavorMastery };
      const gains = gainFlavorExperience(state, cs.mix, 2, { afsahr_strawberry: { family: "strawberry" } });
      cs.masteryGained = gains.some(({ id }) => state.flavorMastery[id] > (before[id] || 0));
      state.flags[key] = true;
    }
    return cs;
  } },
};
const mod = new vm.SourceTextModule(fs.readFileSync(new URL("remake/js/chapters/ch2-strawberry-trial.js", root), "utf8"), {
  context, importModuleDynamically: async spec => { const m = await link(spec); await m.evaluate?.(); return m; },
});
const link = async spec => {
  const exports = mocks[spec]; assert(exports, spec);
  return new vm.SyntheticModule(Object.keys(exports), function () { for (const k of Object.keys(exports)) this.setExport(k, exports[k]); }, { context });
};
await mod.link(link);
await mod.evaluate();
const { runStrawberryTrial, strawberryTrialResult, grantStrawberrySample } = mod.namespace;

assert.equal(strawberryTrialResult({ mix: { double_apple: 12 } }), "no_berry");
assert.equal(strawberryTrialResult({ mix: { afsahr_strawberry: 6 }, burnt: true, pull: { over: true } }), "hot");
assert.equal(strawberryTrialResult({ mix: { afsahr_strawberry: 6 }, pull: { under: true } }), "thin");
assert.equal(strawberryTrialResult({ mix: { afsahr_strawberry: 6 }, pull: { inZone: true } }), "gentle");

state.flags = { ...tasted.flags }; stock = {}; played = [];
assert.equal(grantStrawberrySample(state), true);
assert.equal(grantStrawberrySample(state), false, "試供品は一度だけ");
assert.equal(stock.afsahr_strawberry, 12);

// 苺を入れ忘れたら完了にせず、次のまかないでもう一度
stock.afsahr_strawberry = 0;
practice = { mix: { double_apple: 12 }, pull: { inZone: true } };
assert.equal((await runStrawberryTrial({ bg: "tonari" })).result, "no_berry");
assert.equal(stock.afsahr_strawberry, 12, "使い切っていても一台分は残す");
assert.deepEqual(played, ["ch2_strawberry_trial_intro", "ch2_strawberry_trial_no_berry"]);
assert.equal(state.flags._ch2_strawberry_trial, undefined);

played = [];
practice = { mix: { afsahr_strawberry: 8, double_apple: 4 }, pull: { over: true } };
assert.equal((await runStrawberryTrial({ bg: "tonari" })).result, "hot");
assert.deepEqual(played, ["ch2_strawberry_trial_intro", "ch2_strawberry_trial_hot"]);
assert.equal(state.flags._ch2_strawberry_trial, "hot");
assert.equal(strawberryTrialReady(state, main), false);

// 実calendarと実苺イベントを結合。制作の操作だけ、完了済みの一台へ置き換える。
const notices = [];
let selection = "practice";
const calendarPorts = {
  state, DB: { flavorById: {} }, openingStatus: () => ({ ok: true }),
  hiyoriShopLocation: () => null, cityGuestAtShop: () => null,
  tonariMenu: async () => selection, coldRisk: () => false,
  staminaAfter: cost => state.stamina + cost, maxStamina: () => 100,
  addStamina: cost => { state.stamina += cost; },
  toast: message => { notices.push(message); },
  visitHiyoriAtShop: async () => {}, visitCityGuestAtShop: async () => {},
};
// 名前つき import を ports から返す（無いものは何もしない関数）。
const portLinker = (source, ports) => async spec => {
  const names = [...new Set([...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
    .filter(match => match[2] === spec).flatMap(match => match[1].split(",").map(name => name.trim().split(/\s+as\s+/)[0])))];
  return new vm.SyntheticModule(names, function () {
    for (const name of names) this.setExport(name, ports[name] ?? (() => {}));
  }, { context });
};

// #2213 B04: 通常のまかないは「シフトに入る」→シフト上がりのメニュー（after-makanai）で選ぶ。
// 実tonari.jsのシフト→上がり→まかないを通し、画面だけを選択肢の記録と自動選択に置き換える。
let afterPick = "after-none", afterChoices = [];
const el = (tag, props = {}, children = []) => {
  if (Array.isArray(props)) { children = props; props = {}; }
  return { ...props, dataset: props.dataset || {}, children: [children].flat(9).filter(child => child && typeof child === "object") };
};
const buttons = node => [node?.dataset?.test ? node : null, ...(node?.children || []).flatMap(buttons)].filter(Boolean);
const tonariPorts = {
  ...calendarPorts, el, DB: { dialogues: {}, baito: [], flavorById: {} }, config: {},
  SE: { select() {}, cancel() {} }, CHARM_BONUS: [0], step: () => 1,
  currentCondition: () => ({ bonusRate: 1, shiftBonus: 0, health: "green" }),
  play: async () => ({}), dialogueSequence: run => run(), readyLessons: () => [],
  staffFlavors: () => [], staffStock: () => 0,
  showScreen: (_, node) => {
    const found = buttons(node);
    afterChoices = found.map(button => button.dataset.test);
    const button = found.find(b => b.dataset.test === afterPick) || found.find(b => b.dataset.test === "after-none");
    queueMicrotask(() => button.onclick());
    return node;
  },
};
const tonariSource = fs.readFileSync(new URL("remake/js/daily/tonari.js", root), "utf8");
const tonariModule = new vm.SourceTextModule(tonariSource, {
  context, importModuleDynamically: async spec => { const m = await link(spec); await m.evaluate(); return m; },
});
await tonariModule.link(portLinker(tonariSource, tonariPorts));
await tonariModule.evaluate();
calendarPorts.doBaito = tonariModule.namespace.doBaito;

const calendarSource = fs.readFileSync(new URL("remake/js/daily/calendar.js", root), "utf8");
const calendarModule = new vm.SourceTextModule(`${calendarSource}\nexport { performSpotAction }; export const configureTest = () => { chapterDef = {}; };`, {
  context, importModuleDynamically: async spec => {
    if (spec === "../chapters/ch2-strawberry-trial.js") return mod;
    const dependency = await link(spec);
    await dependency.evaluate();
    return dependency;
  },
});
await calendarModule.link(portLinker(calendarSource, calendarPorts));
await calendarModule.evaluate();
const calendar = calendarModule.namespace;
calendar.configureTest();
const tonari = { id: "tonari", kind: "tonari" };
const resetDay = () => {
  state.chapter = 2; state.day = 25; state.slot = 0; state.stamina = 100;
  state.flags = { ...tasted.flags, _ch2_strawberry_sample_given: true };
  state.visitedDay = {}; state.flavorMastery = {};
  stock = { afsahr_strawberry: 12 }; played = []; notices.length = 0;
  simulateMastery = true;
};
// "makanai" は「シフトに入る」→シフト上がりで「まかないで練習」を選ぶ（出ていなければ「まっすぐ上がる」）。
const visit = async (choice, mix) => {
  selection = choice === "makanai" ? "baito" : choice;
  afterPick = choice === "makanai" ? "after-makanai" : "after-none";
  afterChoices = [];
  practice = { mix, pullDone: true, pull: { inZone: true } };
  return calendar.performSpotAction(tonari);
};
const makanaiOffered = () => afterChoices.includes("after-makanai");
const learned = () => notices.filter(message => message.includes("熟練度が育った")).length;
resetDay();
const regularVisit = await visit("makanai", { grape: 6, mint: 6 });
assert.equal(regularVisit.used, true);
assert.equal(makanaiOffered(), true, "通常のまかないはシフト上がりで選べる");
assert.deepEqual({ ...regularVisit.exp }, { key: "tonari_shift", place: "tonari_shift" }, "行動の学びはシフトの分だけ");
assert.equal(state.visitedDay.tonari_practice, state.day, "苺との同日判定に使う記録");
assert.equal(state.flavorMastery.grape, 1);
assert.equal(state.flavorMastery.mint, 1);
assert.equal(learned(), 1);
const beforeRejected = { stock: stock.afsahr_strawberry, stamina: state.stamina, notices: learned(), runs: practiceRuns };
assert.equal((await visit("strawberry", { afsahr_strawberry: 12 })).used, false);
assert.deepEqual({ stock: stock.afsahr_strawberry, stamina: state.stamina, notices: learned(), runs: practiceRuns }, beforeRejected);
assert.equal(state.flags._ch2_strawberry_trial, undefined);
assert.match(notices.at(-1), /今日はもうまかないで練習した/);
state.day++;
const strawberryVisit = await visit("strawberry", { afsahr_strawberry: 12 });
assert.equal(strawberryVisit.used, true);
assert.deepEqual({ ...strawberryVisit.exp }, { key: "tonari_practice", place: "tonari_practice" }, "苺はまかない練習として学ぶ");
assert.equal(stock.afsahr_strawberry, 0);
assert.equal(state.flavorMastery.strawberry, 2);
assert.equal(state.flags._ch2_strawberry_trial, "gentle");
assert.equal(learned(), 2);
// 苺を試した日は、シフトには入れてもシフト上がりにまかないを出さない
resetDay();
assert.equal((await visit("strawberry", { afsahr_strawberry: 12 })).used, true);
let runsBefore = practiceRuns;
assert.equal((await visit("makanai", { grape: 6, mint: 6 })).used, true, "シフト自体は入れる");
assert.equal(makanaiOffered(), false, "苺の日はまかないを出さない");
assert.equal(practiceRuns, runsBefore);
assert.equal(state.flavorMastery.grape, undefined);
resetDay();
state.visitedDay.tonari_strawberry = state.day; // 旧セーブの利用記録
runsBefore = practiceRuns;
assert.equal((await visit("makanai", { grape: 6, mint: 6 })).used, true);
assert.equal(makanaiOffered(), false, "旧セーブの苺記録の日もまかないを出さない");
assert.equal(practiceRuns, runsBefore);
assert.equal(state.flavorMastery.grape, undefined);
assert.equal(state.visitedDay.tonari_practice, undefined);
resetDay();
state.flags[`_mastery_practice_${masteryDay(state)}_self`] = true;
assert.equal((await visit("makanai", { grape: 6, mint: 6 })).used, true);
assert.equal(makanaiOffered(), true);
assert.equal(learned(), 0, "報酬がない時は成長通知を出さない");

console.log("[ch2 strawberry trial] PASS: tasting sample, feedback, shared makanai day (after-shift makanai), both orders, legacy visit, reward notice");
