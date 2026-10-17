// Issue #638: 家シーシャ（寝る前の一服）。行動の枠を使わないちょい足し・一番低い能力・台による伸び・葉12g・体力 −6。
// node remake/test/home_shisha.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const { DB } = await import("../js/core/data.js");
const { newGame, STAT_KEYS, SCHEMA, SAVE_KEY, save: saveGame, load: loadGame, loadFromSlot } = await import("../js/core/state.js");
const { mixPercents } = await import("../js/craft/mix-ratio.js");
let state;
const home = await import("../js/daily/home-shisha.js");
const rig = await import("../js/daily/home-rig.js");

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const flavors = read("../../data/flavors.json").flavors;
const equipment = read("../../data/equipment.json").equipment;
DB.flavors = flavors;
DB.flavorById = Object.fromEntries(flavors.map((f) => [f.id, f]));
DB.equipment = equipment;
DB.equipById = Object.fromEntries(equipment.map((e) => [e.id, e]));
DB.recipes = read("../../data/recipes.json").recipes;
DB.ngMixes = read("../../data/ng_mixes.json").ng_mixes;
DB.dialogues = {};

// データ: スミさんの卓上台（ミャア）と、くじの大会公式モデルの台。どちらも非売品・売れない
const sumiRig = DB.equipById[rig.SUMI_RIG], proRig = DB.equipById[rig.PRO_RIG];
assert.equal(sumiRig.name, "ミャア 卓上台");
assert.equal(proRig.name, "大会公式モデルの台");
for (const e of [sumiRig, proRig]) { assert.equal(e.chapter_min, 1); assert(e.unsellable && e.not_for_sale, e.id); }
assert.equal(sumiRig.home_growth, 0.5);
assert.equal(proRig.home_growth, 0.75);
const kuji = read("../../data/kuji.json").grades.g1000;
assert.equal(kuji.chapterMin, 1, "台が当たるくじは第1章から");
assert.equal(kuji.prizes.find((p) => p.rank === "S").equipId, rig.PRO_RIG);
const sumiScene = read("../../data/dialogue/ch1_sumi.json").dialogues.find((d) => d.dialogue_id === rig.RIG_SCENE);
assert(sumiScene?.lines.some((l) => l.text?.includes("ミャア")), "スミさんがミャアの卓上台を譲る場面");
assert.equal(sumiScene.lines.find((l) => l.speaker === "sumi").text, "これやる", "スミさんの最初の一言は「これやる」");
// 中盤の修行（DAY7 の中間準備）の最後に渡す
const ch1Source = fs.readFileSync(new URL("../js/chapters/ch1.js", import.meta.url), "utf8");
const midPrep = ch1Source.slice(ch1Source.indexOf("async function midPreparation"), ch1Source.indexOf("async function rehearsal"));
assert(midPrep.includes("giveSumiRig("), "中間準備の最後にスミさんが台を渡す");

// 比率の表示: 整数%で合計がちょうど100（表示用）
assert.deepEqual(mixPercents({ lemon: 9, mint: 3 }), { lemon: 75, mint: 25 });
assert.deepEqual(mixPercents({ a: 4, b: 4, c: 4 }), { a: 34, b: 33, c: 33 });
assert.deepEqual(mixPercents({ a: 7, b: 5 }), { a: 58, b: 42 });
assert.deepEqual(mixPercents({ a: 0, b: 5 }), { a: 0, b: 100 });
const stepsSource = fs.readFileSync(new URL("../js/craft/steps.js", import.meta.url), "utf8");
assert(stepsSource.includes("mixPercents(cs.mix)") && stepsSource.includes("fr-ratio"), "大会・練習の配合画面にも比率を出す");

// 練習は家へ（tonari ではやらない）。地図の家に「家で練習する」、メニューは「特に練習したいところ」
const src = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const tonariSrc = src("../js/daily/tonari.js");
for (const id of ["tonari-practice", "after-full", "after-drill"]) assert(!tonariSrc.includes(id), `tonari から練習を外す: ${id}`);
assert(src("../js/daily/map.js").includes("map-home-practice"), "地図の家に「家で練習する」");
const practiceSrc = src("../js/daily/home-practice.js");
assert(practiceSrc.includes("特に練習したいところ") && practiceSrc.includes('venue: "home"'), "家の練習メニューと家の作業台");
const { HOME_PRACTICE_STAMINA } = await import("../js/daily/home-practice.js");
assert.deepEqual(HOME_PRACTICE_STAMINA, { full: -12, drill: -10 });
const { benchBgRef, benchPlaceTag } = await import("../js/craft/worker.js");
assert.deepEqual([benchBgRef({ mode: "rehearsal", venue: "home" }), benchPlaceTag({ mode: "drill", venue: "home" })], ["bg_home", "HOME"]);
assert.deepEqual([benchBgRef({ mode: "rehearsal" }), benchPlaceTag({ mode: "rehearsal" })], ["bg_tonari_inside", "TONARI"]);

// 旧セーブ: 中間準備を終えていれば読み込み時に卓上台を渡す。終えていなければ渡さない（スミさんの会話の数では決めない）
const loadWith = (patch) => { const s = newGame(); Object.assign(s, patch); saveGame(); return loadGame(); };
assert(loadWith({ flags: { _ev_midcheck: true } }).owned.includes(rig.SUMI_RIG), "中間準備を終えた旧セーブ");
assert(loadWith({ chapter: 2, flags: {} }).owned.includes(rig.SUMI_RIG), "第2章の旧セーブ");
assert(!loadWith({ story: { sumi: 6 }, flags: {} }).owned.includes(rig.SUMI_RIG), "中間準備の前は渡さない");

// オート／手動の実LOADを通す。差分は承認済みの卓上台1個とschema更新だけ。
// 所持品・能力・端数・在庫・所持金・装備・進行・関係を丸ごと比べ、再読込で二重付与しない。
for (const schema of [14, SCHEMA]) for (const [label, patch, grant] of [
  ["before training", { day: 7, flags: { _ch1_mid: { practiceDone: true } } }, false],
  ["story count alone", { day: 14, story: { sumi: 6 } }, false],
  ["completed training", { day: 7, flags: { _ev_midcheck: true } }, true],
  ["feedback read", { day: 7, flags: { _ch1_mid: { feedbackRead: true } } }, true],
  ["chapter two", { chapter: 2, day: 16 }, true],
  ["later chapter", { chapter: 3, day: 30 }, true],
  ["tabletop already owned", { chapter: 2, day: 16, extra: [rig.SUMI_RIG] }, true],
  ["pro already owned", { chapter: 2, day: 16, extra: [rig.PRO_RIG] }, true],
]) for (const key of [SAVE_KEY, "suien_remake_slot1"]) {
  const s = newGame();
  const { extra = [], ...fields } = patch;
  Object.assign(s, { schema, money: 45678, stamina: 67, ...fields });
  s.owned.push("glass_bowl", ...extra);
  s.stats = { technique: 36, sense: 27, guts: 25, charm: 28, insight: 32 };
  s.statXp = { technique: .25, sense: .6, guts: .75 };
  s.flavorStock = { double_apple: 12.5, mint: 22 };
  s.affinity = { tsumugi: 31 }; s.affinityCarry = { tsumugi: .25 };
  const original = JSON.stringify(s);
  store.set(key, original);
  const expected = JSON.parse(original);
  expected.schema = SCHEMA;
  if (grant && !expected.owned.includes(rig.SUMI_RIG)) expected.owned.push(rig.SUMI_RIG);
  const loaded = key === SAVE_KEY ? loadGame() : loadFromSlot(key);
  // 手動LOADのみ自動保存日時を更新する。元の手動枠は変更しない。
  const resources = v => { const copy = JSON.parse(JSON.stringify(v)); delete copy.savedAt; return copy; };
  assert.deepEqual(resources(loaded), resources(expected), `${label}: ${schema}/${key}`);
  if (key !== SAVE_KEY) assert.equal(store.get(key), original, "Manual source slot is preserved byte for byte");
  saveGame();
  assert.deepEqual(resources(loadGame()), resources(expected), `${label}: saved migrated state reload`);
  assert.deepEqual(resources(loadGame()), resources(expected), `${label}: repeated reload`);
  assert.equal(loaded.owned.filter(id => id === rig.SUMI_RIG).length, grant ? 1 : 0);
}

// 台: 持っていなければ null、両方あれば伸びのいい大会公式モデル
state = newGame();
state.stats = { technique: 20, sense: 12, guts: 30, charm: 12, insight: 25 };
assert.equal(rig.homeRig(), null);
state.owned.push(rig.SUMI_RIG);
assert.deepEqual([rig.homeRig().id, rig.homeRig().growth], [rig.SUMI_RIG, 0.5]);
state.owned.push(rig.PRO_RIG);
assert.deepEqual([rig.homeRig().id, rig.homeRig().growth], [rig.PRO_RIG, 0.75]);
state.owned = state.owned.filter((id) => id !== rig.PRO_RIG);

// 一番低い能力（同じ値なら並び順、上限の能力は除く）
assert.equal(home.lowestStat({ technique: 20, sense: 12, guts: 30, charm: 12, insight: 25 }, 48), "sense");
assert.equal(home.lowestStat({ technique: 48, sense: 48, guts: 48, charm: 48, insight: 40 }, 48), "insight");
assert.equal(home.lowestStat({ technique: 48, sense: 48, guts: 48, charm: 48, insight: 48 }, 48), null);

// 聞くかどうか: 葉12g未満・今日もう吸った・大会前夜・台なしでは聞かない
state.flavorStock = { lemon: 6, mint: 5 };
state.stamina = 80;
assert.equal(home.homeShishaOffer(), null, "葉が12g未満");
state.flavorStock = { lemon: 9, mint: 3, double_apple: 0 };
assert.equal(home.homeShishaOffer()?.id, rig.SUMI_RIG);
assert.equal(home.homeShishaOffer(state, { eve: true }), null, "大会前夜は聞かない");

// レシピ帳から作る: 黄金比があればそれで（氷レモネード 12g → レモン8・ミント4）、なければ主役2:1
const lemonade = DB.recipes.find((r) => r.id === "ice_lemonade");
state.flavorStock = { lemon: 20, mint: 20, double_apple: 20, cinnamon: 20 };
assert.deepEqual(home.recipeMix(lemonade), { mint: 4, lemon: 8 });
assert.deepEqual(home.recipeMix(DB.recipes.find((r) => r.id === "apple_pie")), { double_apple: 8, cinnamon: 4 });
state.flavorStock = { lemon: 3, mint: 20 };
assert.equal(home.recipeMix(lemonade), null, "在庫が足りなければ作れない");

// 味の手応え: 単体も完成した一台。知らないレシピや種類数だけでは失敗にしない。
const { evaluateMix } = await import("../js/craft/steps.js");
for (const flavor of flavors) for (const mode of ["home", "drill", "rehearsal", "tournament"]) {
  const info = evaluateMix({ mode, mix: { [flavor.id]: 12 }, equip: { bowl: "silicone_bowl" } });
  assert(info.score >= 80, `${mode}/${flavor.id}: 単体を種類数だけで減点しない`);
  assert.equal(home.tasteOf(info), "great", `${flavor.id}: 単体の完成した香り`);
  assert(!info.notes.some(note => note.includes("他の香りが隠れている")));
  if (mode === "tournament") assert.equal(info.regOk, (flavor.family || flavor.id) === "mint", "課題フレーバー条件は維持");
}
state = newGame(); state.owned.push(rig.SUMI_RIG); state.flavorStock = { mint: 50 }; state.stamina = 80;
const single = home.applyHomeShisha({ mint: 12 }, rig.homeRig());
assert.equal(single.taste, "great");
assert.equal(state.flavorStock.mint, 38);
assert.equal(single.found, null, "単体を架空レシピとして登録しない");
assert(!home.homeShishaDialogue(single, rig.homeRig()).lines.some(l => /イマイチ|もう一歩/.test(l.text)));
assert.equal(home.tasteOf({ recipe: lemonade, score: 100 }), "great");
assert.equal(home.tasteOf({ recipe: null, score: 88 }), "fine");
assert.equal(home.tasteOf({ recipe: null, score: 68 }), "meh");

// 一服: 葉12g減る・体力 −6・行動の枠は変わらない・レシピ帳へ（センスのおまけなし）・一番低い能力が卓上台で0.5P
state = newGame();
state.stats = { technique: 20, sense: 12, guts: 30, charm: 14, insight: 25 };
state.statXp = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
state.owned.push(rig.SUMI_RIG);
state.flavorStock = { lemon: 20, mint: 20 };
state.stamina = 80;
const slotBefore = state.slot;
const r1 = home.applyHomeShisha({ lemon: 9, mint: 3 }, rig.homeRig());
assert.deepEqual(state.flavorStock, { lemon: 11, mint: 17 });
assert.equal(state.stamina, 74);
assert.equal(state.slot, slotBefore, "行動の枠は使わない");
assert.equal(r1.taste, "great");
assert.equal(r1.info.golden, "hit");
assert.equal(r1.found?.id, "ice_lemonade");
assert(state.recipes.ice_lemonade?.home);
assert.equal(r1.stat, "sense");
assert.equal(home.homeShishaOffer(), null, "同じ日に二度は聞かない");
assert.equal(home.growHomeStat(r1.stat, rig.homeRig()), 0, "0.5Pは次の1Pまでの進みとして持ち越す");
assert.equal(state.statXp.sense, 0.5);
assert.equal(home.growHomeStat("sense", rig.homeRig()), 1, "2晩で1P");
assert.equal(state.stats.sense, 13);
// 大会公式モデルの台は0.75P
state.owned.push(rig.PRO_RIG);
home.growHomeStat("charm", rig.homeRig());
assert.equal(state.statXp.charm, 0.75);

// 場面の台本: 全角48字以内・手動改行なし・心の声は（）で閉じる
const width = (t) => [...t].reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .5 : 1), 0);
for (const taste of ["great", "fine", "meh"]) for (const id of [rig.SUMI_RIG, rig.PRO_RIG]) for (const pick of [0, .5, .99]) {
  const d = home.homeShishaDialogue({ taste, stat: "insight" }, { id }, () => pick);
  for (const l of d.lines) {
    assert(width(l.text) <= 48 && !l.text.includes("\n"), l.text);
    if (l.speaker === "hajime") assert(l.text.startsWith("（") && l.text.endsWith("）"), l.text);
  }
}

console.log("[home shisha] PASS: rigs, kuji from ch1, lowest stat, offer rules, recipe mix, taste, 12g/-6/no slot, 0.5P vs 0.75P, lines");
