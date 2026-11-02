// VOL13: 第2章の大会準備で、実際に一台作る場面（chapters/ch2-craft-prep.js）。
// 基礎の確認（DAY2〜4・店の葉・調整なし）と最後の通し（DAY11〜12・本番と同じ一台／工程を選んだ練習）を、
// tonari を選んだ時に任意で受けられる。中断・LOADでは何も残さず、能力値は付けない。
// node --experimental-vm-modules remake/test/ch2_craft_prep.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const all = Object.fromEntries(JSON.parse(read("data/dialogue/ch2_home.json")).dialogues.map(d => [d.dialogue_id, d]));
const DB = { dialogues: all };
const START = 15, abs = day => START + day - 1;
const plain = v => JSON.parse(JSON.stringify(v));
let state, played, picks, practice, drills, stamina, guard = true, playMode = "ok";
const context = vm.createContext({ console });
const exportsOf = {
  "../core/state.js": { state: undefined },
  "../core/data.js": { DB },
  "../core/stats.js": { addStamina: n => { stamina.push(n); state.stamina += n; } },
  "../core/ui.js": { modal: async ({ options }) => { const pick = picks.shift(); assert(options.some(o => o.value === pick), `option ${pick}`); return pick; } },
  "../vn/engine.js": { play: async id => { played.push(id); return playMode === "cancel" && id.endsWith("_intro") ? { cancelled: true } : { id }; } },
  "../daily/tonari.js": { chooseDrill: async opts => { drills.push(opts); return picks.shift(); } },
};
const dynamic = {
  "../craft/practice.js": { runFullPractice: async opts => { practice.push(opts); return practiceResult; } },
  "../craft/session.js": { runDrill: async kind => 3 },
  "../craft/score.js": { computeShisha: cs => ({ craftQuality: cs.quality }) },
};
let practiceResult;
const synthetic = new Map();
const synth = (spec, values) => {
  if (synthetic.has(spec)) return synthetic.get(spec);
  const m = new vm.SyntheticModule(Object.keys(values), function () { for (const [k, v] of Object.entries(values)) this.setExport(k, v); }, { context, identifier: spec });
  synthetic.set(spec, m); return m;
};
const mod = new vm.SourceTextModule(read("remake/js/chapters/ch2-craft-prep.js"), { context, identifier: "ch2-craft-prep.js",
  importModuleDynamically: async spec => { const m = synth(spec, dynamic[spec]); if (m.status === "unlinked") await m.link(() => {}); if (m.status === "linked") await m.evaluate(); return m; } });
await mod.link(spec => synth(spec, exportsOf[spec]));
await mod.evaluate();
const prep = mod.namespace;
function setup(day, flags = {}) {
  state = { chapter: 2, phase: "daily", day: abs(day), slot: 0, stamina: 100, best: {}, visitedDay: {}, flags: { _ch2_day1: { startDay: START }, ...flags } };
  synthetic.get("../core/state.js").setExport("state", state);
  played = []; picks = []; practice = []; drills = []; stamina = []; playMode = "ok"; guard = true;
}
const offer = () => prep.offerCraftPrep(prep.craftPrepDue(state), { staminaGuard: async () => guard, bg: "tonari" });

// 期間: 基礎の確認はDAY2〜4、最後の通しはDAY11〜12。第2章の準備期間だけ
for (const [day, id] of [[1, null], [2, "basics"], [4, "basics"], [5, null], [10, null], [11, "rehearsal"], [12, "rehearsal"], [13, null]]) {
  setup(day); assert.equal(prep.craftPrepDue(state)?.id ?? null, id, `DAY${day}`);
}
setup(2); state.chapter = 3; assert.equal(prep.craftPrepDue(state), null);
setup(2); state.phase = "tournament"; assert.equal(prep.craftPrepDue(state), null);
setup(2, { _ch2_prep_basics_done: true }); assert.equal(prep.craftPrepDue(state), null, "once");
for (const id of prep.CH2_CRAFT_PREP_IDS) assert(all[id]?.lines?.length, `${id} exists`);

// 基礎の確認: 店の葉（まかない）で一台、調整なし。提供まで終えたら完了。体力16、能力値は付けない
setup(3); picks = ["full"]; practiceResult = { pullDone: true };
let result = await offer();
assert.deepEqual(plain(result), { used: true, exerted: true, exp: { key: "tonari_practice", place: "tonari_practice" } });
assert.deepEqual(played, ["ch2_prep_basics_intro", "ch2_prep_basics_end"]);
assert.deepEqual(plain(practice[0]).adjustments, false); assert.equal(practice[0].staffPractice, true); assert.equal(practice[0].kind, "early");
assert.deepEqual(stamina, [-16]); assert.equal(state.flags._ch2_prep_basics_done, true); assert.equal(state.visitedDay.tonari_practice, abs(3));
// 崩れた一台は別の講評
setup(3); picks = ["full"]; practiceResult = { pullDone: true, failed: "burnt" };
await offer(); assert.equal(played.at(-1), "ch2_prep_basics_failed");
// 「いつものtonari」は通常メニューへ（null）。やめる・体力の確認で戻るは行動にしない
setup(3); picks = ["usual"]; assert.equal(await offer(), null); assert.deepEqual(played, []);
setup(3); picks = ["cancel"]; assert.deepEqual(plain(await offer()), { used: false, exerted: false });
setup(3); picks = ["full"]; guard = false; assert.deepEqual(plain(await offer()), { used: false, exerted: false }); assert.deepEqual(practice, []);
// 導入の途中で中断・LOADしたら、練習も既読も体力も残さない
setup(3); picks = ["full"]; playMode = "cancel";
let before = plain(state); assert.equal((await offer()).used, false); assert.deepEqual(plain(state), before);

// 最後の通し: 本番と同じ一台（課題の苺・主催支給は作業台の規則・調整2回）。第1章のリハーサルと同じ物差しで講評
const grades = [[{ pullDone: true, holes: { score: 90 }, heat: { score: 90 }, quality: 90, careHistory: [{ score: 90 }, { score: 90 }] }, "great"],
  [{ pullDone: true, holes: { score: 70 }, heat: { score: 70 }, quality: 70, careHistory: [{ score: 70 }, { score: 70 }] }, "good"],
  [{ pullDone: true, holes: { score: 40 }, heat: { score: 40 }, quality: 40, careHistory: [{ score: 40 }, { score: 40 }] }, "rough"],
  [{ pullDone: true, failed: "burnt" }, "burnt"]];
for (const [cs, grade] of grades) {
  setup(11); picks = ["full"]; practiceResult = cs;
  assert.equal((await offer()).used, true);
  assert.deepEqual(played, ["ch2_prep_rehearsal_intro", `ch2_prep_rehearsal_${grade}`]);
  assert.equal(practice[0].adjustments, true); assert.equal(practice[0].staffPractice, false); assert.equal(practice[0].kind, "rehearsal");
  assert.equal(state.flags._ch2_prep_rehearsal_result, grade); assert.equal(state.flags._ch2_prep_rehearsal_done, true);
}
// 工程を選んだ練習（第1章の前夜の部分練習と同じ runDrill）。自己ベストを記録する。戻れば何もしない
setup(12); picks = ["drill", "heat"];
assert.equal((await offer()).used, true);
assert.deepEqual(played, ["ch2_prep_rehearsal_drill"]); assert.equal(state.best.heat, 3); assert.deepEqual(practice, []);
setup(12); picks = ["drill", null];
assert.deepEqual(plain(await offer()), { used: false, exerted: false }); assert.deepEqual(stamina, []);

// 台本: 苺は当日に主催が出す（基礎の確認ではまだ使わない）。最後の通しは課題どおり。点の話へ逃げる「はじめ」を映す
const text = id => [...all[id].lines, ...Object.values(all[id].branches || {}).flat()].map(l => l.text || "").join("\n");
assert(/主催が出す/.test(text("ch2_prep_basics_intro")));
assert(/苺は4g以上/.test(text("ch2_prep_rehearsal_intro")));
assert(/点のこと/.test(text("ch2_prep_rehearsal_rough")));
assert(!/が(少し|かなり|大きく)?上がった/.test(prep.CH2_CRAFT_PREP_IDS.map(text).join("\n")), "practice gives no ability");
console.log("PASS ch2 craft prep: basics DAY2-4 and last rehearsal DAY11-12 at tonari, full/drill/usual/cancel, grading, no ability, cancel/LOAD keeps nothing");
