// 第2章の苺の試作（#1650）: 試煙会の帰りに試供品→tonariで熱だけを試す→スミさんの感想。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { CH2_NIGHTS, STRAWBERRY_TRIAL_IDS, strawberryTrialReady } from "../js/chapters/ch2-story-data.js";

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
let stock, played, practice;
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
  "../craft/practice.js": { runFullPractice: async () => practice },
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
assert.equal(await runStrawberryTrial({ bg: "tonari" }), "no_berry");
assert.equal(stock.afsahr_strawberry, 12, "使い切っていても一台分は残す");
assert.deepEqual(played, ["ch2_strawberry_trial_intro", "ch2_strawberry_trial_no_berry"]);
assert.equal(state.flags._ch2_strawberry_trial, undefined);

played = [];
practice = { mix: { afsahr_strawberry: 8, double_apple: 4 }, pull: { over: true } };
assert.equal(await runStrawberryTrial({ bg: "tonari" }), "hot");
assert.deepEqual(played, ["ch2_strawberry_trial_intro", "ch2_strawberry_trial_hot"]);
assert.equal(state.flags._ch2_strawberry_trial, "hot");
assert.equal(strawberryTrialReady(state, main), false);

console.log("[ch2 strawberry trial] PASS: tasting sample, heat-only trial, Sumi's feedback branches, retry without strawberry, one-time menu");
