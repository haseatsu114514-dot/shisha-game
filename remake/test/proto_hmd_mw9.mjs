// M-W9「博士の試作HMD」（#1801 残件・SBD92）: 授業の習得で機材が渡り、装備すると適温帯と傷み耐性が実際に効くことを確かめる。
// node remake/test/proto_hmd_mw9.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const { DB } = await import("../js/core/data.js");
const read = name => JSON.parse(fs.readFileSync(new URL(`../../data/${name}.json`, import.meta.url), "utf8"));
DB.flavors = read("flavors").flavors;
DB.flavorById = Object.fromEntries(DB.flavors.map(f => [f.id, f]));
DB.equipment = read("equipment").equipment;
DB.equipById = Object.fromEntries(DB.equipment.map(e => [e.id, e]));
DB.dialogues = {};

const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const { LESSONS } = await import("../js/core/growth-board-data.js");
const { growthLesson } = await import("../js/core/growth-effects.js");
const { forSale, sellable, sellEquipment } = await import("../js/daily/shop.js");
const temp = await import("../js/craft/temperature-model.js");
const { computeShisha } = await import("../js/craft/score.js");
const { equipmentUse } = await import("../js/craft/flavor-guide.js");

const ID = "dr_kemuri_proto_hmd";
const near = (a, b, label) => assert(Math.abs(a - b) < 1e-9, `${label}: ${a} != ${b}`);

// 1. 機材データ: 非売品・売却不可・絵なし（#2922 仕様案の AI仮判断どおり art を書かない）
const item = DB.equipById[ID];
assert(item, "博士の試作HMD が equipment.json にある");
assert.equal(item.type, "hms");
assert.equal(item.chapter_min, 99);
assert(item.not_for_sale && item.unsellable, "非売品・売却不可");
assert(!("art" in item), "絵は流用せず art を書かない");
assert.equal(forSale(item, 99), false, "どの店にも並ばない");
assert.equal(sellable(item), false, "売れない");

// 2. 授業定義と入手経路: 灯して相談を終えた時だけ渡り、二重には渡らない
const lesson = LESSONS.find(l => l.id === "M-W9");
assert(lesson && lesson.scene === "lesson_dr_kemuri_hmd", "M-W9 の場面は既存の lesson_dr_kemuri_hmd");
assert.deepEqual(lesson.grants, [ID]);
core.newGame(); growth.setGrowthPreview(true);
assert(!core.state.owned.includes(ID), "習得前は持っていない");
assert.equal(growth.learnLesson("M-W9"), false, "盤で灯す前は習得できない");
growth.ensureGrowth().nodes.push("M-W9");
assert.equal(growthLesson(core.state, "M-W9"), false, "灯しただけでは発動しない（相談が必要）");
assert.equal(growth.learnLesson("M-W9"), true);
assert(growthLesson(core.state, "M-W9"));
assert.equal(core.state.owned.filter(id => id === ID).length, 1, "習得で試作HMDが1台渡る");
assert.equal(growth.learnLesson("M-W9"), false, "二重に習得しない");
assert.equal(core.state.owned.filter(id => id === ID).length, 1);
assert.equal(sellEquipment(ID), false, "渡された試作HMDは売れない");
assert(core.state.owned.includes(ID));
// SAVE/LOAD で所持と習得を保つ
core.save(); const loaded = core.load(); core.setState(loaded);
assert.equal(core.state.owned.filter(id => id === ID).length, 1, "LOAD後も1台のまま");

// 3. 旧セーブ互換: 接続前に習得していたセーブは LOAD で渡され、未習得のセーブには渡らない
core.newGame(); growth.setGrowthPreview(true);
const g = growth.ensureGrowth(); g.nodes.push("M-W9"); g.learned.push("M-W9");
core.state.owned = core.state.owned.filter(id => id !== ID);
core.save(); core.setState(core.load());
assert(core.state.owned.includes(ID), "習得済みの旧セーブは LOAD で試作HMDを受け取る");
core.newGame(); growth.setGrowthPreview(true);
core.save(); core.setState(core.load());
assert(!core.state.owned.includes(ID), "未習得のセーブには渡らない");
// 周回の引き継ぎ等で所持だけ落ちても、心得の同期で戻る
core.newGame(); growth.setGrowthPreview(true);
const g2 = growth.ensureGrowth(); g2.nodes.push("M-W9");
assert.equal(growth.learnLesson("M-W9"), true);
core.state.owned = core.state.owned.filter(id => id !== ID);
growth.ensureGrowth();
assert(core.state.owned.includes(ID), "習得済みなら同期で所持へ戻る");

// 4. 性能表の一致: 幅は EQUIP_WIDTH_FACTORS と EQUIP_THERMAL_SPECS で同じ値、比較・説明が引ける
const spec = temp.equipSpecOf(ID);
assert(spec, "equipSpecOf で試作HMDの性能が引ける");
assert.equal(spec.type, "hms");
near(spec.widthFactor, 1.06, "適温幅はやや広い ×1.06");
near(temp.EQUIP_WIDTH_FACTORS.hms[ID], spec.widthFactor, "幅の表が一致");
assert.equal(spec.stabilityBonus, 4);
assert.equal(temp.compareEquipment(ID, "lotos_hagal").summary, spec.summary);
assert.match(equipmentUse(item).use, /適温幅がやや広く/);

// 5. 適温帯: 装備すると帯が ×1.06 広がり、葉が傷んでも帯が狭まりにくい（縮み幅が半分）
const base = { mix: { lemon: 12 }, equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" } };
const proto = { mix: { lemon: 12 }, equip: { bowl: "silicone_bowl", hms: ID, charcoal: "flat_charcoal" } };
const width = cs => { const b = temp.temperatureBands(cs); return b.ideal[1] - b.ideal[0]; };
near(width(proto) / width(base), 1.06, "無傷では適温帯が ×1.06");
near(temp.temperatureBands(base).damageScale, 1);
near(temp.temperatureBands(proto).damageScale, 1);
const damaged = { dmg: 13, hp: 1, burn: 0, steps: 10 }; // leafDamageRatio = 1（満身創痍）
near(temp.temperatureBands({ ...base, leaf: damaged }).damageScale, 0.7, "通常HMDは最大30%狭まる");
near(temp.temperatureBands({ ...proto, leaf: damaged }).damageScale, 0.85, "試作HMDは縮みが半分（15%）");
assert(width({ ...proto, leaf: damaged }) > width({ ...base, leaf: damaged }), "傷んだ葉でも試作HMDの帯が広い");
near(temp.temperatureBands(proto).center, temp.temperatureBands(base).center, "中心は動かない");

// 6. 採点の熱安定: 表示（stabilityBonus）と採点が同じ値を使う
function craftWith(hms) {
  return {
    mode: "practice", equip: { bowl: "silicone_bowl", hms, charcoal: "flat_charcoal" }, mix: { lemon: 12 },
    pack: "normal", place: "triangle",
    holes: { score: 88, outerEven: .88, innerExcess: 0, total: 22, minimumComplete: true },
    heat: { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 },
    steam: { score: 86, hits: 1, seconds: 360 }, environment: { rainy: false },
    pull: { score: 90, temp: .54, pulls: 3 }, careHistory: [{ score: 85 }, { score: 86 }],
  };
}
assert.equal(computeShisha(craftWith(ID)).heatStability - computeShisha(craftWith("lotos_hagal")).heatStability, 2,
  "熱安定の仕上がり補正はロートス 2 → 試作HMD 4 の差どおり +2");

console.log("PASS proto HMD M-W9: lesson grant, legacy save grant, no sale, width x1.06, damage narrowing halved, stability +4 in score");
