// #2213: HMDの作り（工程・装着条件）は全HMD共通。ロートスも穴あけを飛ばさない。
// 旧仕様（#1107 B2）で穴あけを飛ばした記録は、採点の割り直し（finalize）で今まで通り扱う。
// node remake/test/hmd_unify.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, v), getItem: (k) => storage.get(k) ?? null };

const holesLogic = await import("../js/craft/holes_logic.js");
const { DB } = await import("../js/core/data.js");
const equipment = JSON.parse(fs.readFileSync(new URL("../../data/equipment.json", import.meta.url))).equipment;
DB.equipById = Object.fromEntries(equipment.map((e) => [e.id, e]));
DB.flavorById = {};
const { finalize, NAGUMO_BAR } = await import("../js/craft/score.js");
const { EQUIP_THERMAL_SPECS } = await import("../js/craft/temperature-model.js");
const { newGame } = await import("../js/core/state.js");
newGame();
const src = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

// 1. 工程の共通化: HMDで穴あけを分ける判定が無く、穴あけ工程はHMDを見ない
for (const name of ["usesFoil", "FOIL_FREE_HMS", "skippedFoilResult", "VENT_CLOSED_FACTOR"]) {
  assert.equal(Object.hasOwn(holesLogic, name), false, `${name} はHMDごとの工程分岐なので残さない`);
}
const runHoles = src("../js/craft/holes.js").match(/export async function runHoles[\s\S]*?\n}\n/)[0];
assert.doesNotMatch(runHoles, /equip|hms|skipped|stepVent/, "穴あけ工程はHMDで分岐しない");
assert.doesNotMatch(src("../js/craft/steps.js"), /foilOptIn|chooseFoilOption|stepVent/, "ロートスだけのアルミ選択・通気工程は無い");

// 2. 装着条件の共通化: HMD固有の装着制限（タヌキッシュは素焼き不可）が無い
const setup = src("../js/craft/steps.js").match(/export async function stepSetup[\s\S]*?\n}\n/)[0];
assert.doesNotMatch(setup, /tanukish|isSuyakiBowl|disabled/, "機材選びにHMD固有の装着制限が無い");
const hmds = equipment.filter((e) => e.type === "hms");
for (const e of hmds) {
  assert.doesNotMatch(e.description, /アルミ|素焼き.*(使えない|装着)/, `${e.id} の説明に旧仕様の作り・装着条件が残っている`);
  const spec = EQUIP_THERMAL_SPECS[e.id];
  if (spec) assert.equal(spec.fitNote, "全ボウル対応", `${e.id} は全ボウル対応`);
}

// 3. 数値の差は上位HMDの価値として残す
const widths = Object.fromEntries(hmds.map((e) => [e.id, EQUIP_THERMAL_SPECS[e.id]?.widthFactor]));
assert.deepEqual(widths, { lotos_hagal: 1, tanukish_lid: 1.08, winkwink_hagal: 1.05, amaburst_hms: 0.88, lotos_plus: 1.04 });

// 4. 旧記録: 飛ばした一台は穴あけの重みを外し、残り4工程で割り直す（損も得もしない）
const legacy = { skipped: true, total: 24, outer: 12, middle: 8, inner: 4, outerEven: .75, innerExcess: 0, minimumComplete: true, score: null };
const base = { heat: { score: 80 }, careHistory: [{ score: 70 }, { score: 90 }], stats: { craftQuality: 60 }, mode: "rehearsal", equip: { bowl: "silicone_bowl" } };
const foiled = finalize({ ...base, holes: { score: 100 } });
assert.equal(foiled.foilSkipped, false);
assert.equal(foiled.total, 80, "穴あけ100/炭80/完成60/調整70・90 → 各20% = 80");
const skipped = finalize({ ...base, holes: legacy });
assert.equal(skipped.foilSkipped, true);
assert.equal(skipped.total, 75, "穴あけを外し、炭80/完成60/調整70・90を各25%で割り直す = 75");
assert.equal(Object.hasOwn(skipped.parts, "holes"), false, "省略した穴あけは結果の工程一覧にも出さない");
assert.equal(NAGUMO_BAR, 90.8);
const tournament = { ...base, mode: "tournament", chapter: 1 };
assert.equal(finalize({ ...tournament, holes: legacy }).total, 72, "第1章大会・旧記録の省略時だけ炭20/完成40/調整各20");
assert.equal(finalize({ ...tournament, chapter: 2, holes: legacy }).total, 75);
assert.equal(finalize({ ...tournament, holes: { score: 100 } }).total, 80);

console.log("hmd_unify: OK");
