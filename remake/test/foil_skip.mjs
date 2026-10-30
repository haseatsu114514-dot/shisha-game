// #1107 B2: ロートスHMDではアルミ穴あけを飛ばす。判定（usesFoil）と採点の割り直し（finalize）を検証。
// node remake/test/foil_skip.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, v), getItem: (k) => storage.get(k) ?? null };

const { usesFoil, skippedFoilResult, FOIL_FREE_HMS } = await import("../js/craft/holes_logic.js");
const { DB } = await import("../js/core/data.js");
const equipment = JSON.parse(fs.readFileSync(new URL("../../data/equipment.json", import.meta.url))).equipment;
DB.equipById = Object.fromEntries(equipment.map((e) => [e.id, e]));
DB.flavorById = {};
const { finalize, NAGUMO_BAR } = await import("../js/craft/score.js");
const { state, newGame } = await import("../js/core/state.js");
newGame();

// 1. usesFoil: ロートスは既定で飛ばし、レッスン・ドリル・任意トグル・他HMDでは行う
assert.deepEqual(FOIL_FREE_HMS, ["lotos_hagal"]);
const lotos = (mode, extra = {}) => ({ mode, equip: { hms: "lotos_hagal" }, ...extra });
assert.equal(usesFoil(lotos("tournament")), false, "ロートスの大会はアルミを飛ばす");
assert.equal(usesFoil(lotos("rehearsal")), false, "ロートスの練習（リハ）も飛ばす");
assert.equal(usesFoil(lotos("tutorial")), true, "レッスンは必ず穴あけを教える");
assert.equal(usesFoil(lotos("drill")), true, "穴あけドリルは必ず穴あけをする");
assert.equal(usesFoil(lotos("tournament", { foilOptIn: true })), true, "任意トグルでアルミを付けられる");
assert.equal(usesFoil({ mode: "tournament", equip: { hms: "tanukish_lid" } }), true, "アルミを使うHMDは今まで通り");
assert.equal(usesFoil({ mode: "tournament", equip: { hms: "amaburst" } }), true);
assert.equal(usesFoil({ mode: "tournament" }), true, "HMD未設定は従来通り穴あけ");
assert.equal(usesFoil(null), true);

// 2. skippedFoilResult: 評価項目から外せるよう score は付けず、中立な穴あけ相当値を残す
const skip = skippedFoilResult();
assert.equal(skip.skipped, true);
assert.equal(skip.score, null);
assert.equal(skip.minimumComplete, true);
assert(skip.innerExcess === 0 && skip.total === 24);

// 3. finalize: 飛ばした一台は穴あけの重みを外し、残り4工程で割り直す（損も得もしない）
const base = { heat: { score: 80 }, careHistory: [{ score: 70 }, { score: 90 }], stats: { craftQuality: 60 }, mode: "rehearsal", equip: { bowl: "silicone_bowl" } };
const foiled = finalize({ ...base, holes: { score: 100 } });
assert.equal(foiled.foilSkipped, false);
assert.equal(foiled.total, 80, "穴あけ100/炭80/完成60/調整70・90 → 各20% = 80");

const skipped = finalize({ ...base, holes: skippedFoilResult() });
assert.equal(skipped.foilSkipped, true);
assert.equal(skipped.total, 75, "穴あけを外し、炭80/完成60/調整70・90を各25%で割り直す = 75");
assert.equal(skipped.parts.holes, 0, "穴あけの点は0のまま重みだけ外す");
assert.equal(NAGUMO_BAR, 90.8);
const tournament = { ...base, mode: "tournament", chapter: 1 };
assert.equal(finalize({ ...tournament, holes: skippedFoilResult() }).total, 72,
  "第1章大会・省略時だけ炭20/完成40/調整各20");
assert.equal(finalize({ ...tournament, chapter: 2, holes: skippedFoilResult() }).total, 75);
assert.equal(finalize({ ...tournament, holes: { score: 100 } }).total, 80);

console.log("foil_skip: OK");
