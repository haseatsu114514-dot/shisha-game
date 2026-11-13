// VOL07（#2273・#1904）: ミニゲームの自分の道具。一度だけ買えて、SAVE/LOADで二重購入・二重効果にならない。
// 効き目は小さく、何が変わるかは数値で決まっている（斧の揺れ×0.9・DJの▶判定+10ms・TRPGの盛り上がり1から）。
// node --experimental-vm-modules remake/test/hobby_gear.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const core = await import("../js/core/state.js");
const gear = await import("../js/core/hobby-gear.js");
const { swayAt, releaseAimAt, SWAY } = await import("../js/minigames/axe-model.js");
const dj = await import("../previews/dj/model.mjs");
const { djUrl } = await import("../js/minigames/dj.js");
const { TrpgSession, HEAT } = await import("../js/trpg/session.js");
const { SETS } = await import("../previews/dj/tracks.mjs");
const { buildCarryPackage } = await import("../js/core/carry.js");

// 1. 品目: どの店で・何章から・いくら・何が変わるか。
const { HOBBY_GEAR } = gear;
assert.deepEqual(Object.keys(HOBBY_GEAR).sort(), ["gear_dice", "gear_hatchet", "gear_hatchet_balanced", "gear_hatchet_precision", "gear_headphones"]);
const expect = { gear_hatchet: ["axe_bar", 1, 5000], gear_hatchet_balanced: ["axe_bar", 1, 9000], gear_hatchet_precision: ["axe_bar", 1, 15000], gear_dice: ["trpg_bar", 2, 3800], gear_headphones: ["club", 3, 22000] };
for (const [id, [venue, chapter, price]] of Object.entries(expect)) {
  const g = HOBBY_GEAR[id];
  assert.deepEqual([g.venue, g.chapterMin, g.price], [venue, chapter, price], id);
  assert(g.name && g.short && g.effect && g.description, `${id} の表示文`);
}
const equipment = JSON.parse(fs.readFileSync(new URL("../../data/equipment.json", import.meta.url), "utf8")).equipment;
for (const id of Object.keys(HOBBY_GEAR)) assert(!equipment.some(e => e.id === id), `${id} はシーシャの機材一覧・売却に混ざらない`);

// 2. 購入: 章が早い・お金が足りないと買えない。一度だけ。SAVE/LOADで1つのまま。
let s = core.newGame();
Object.assign(s, { chapter: 1, money: 20000 });
assert.equal(gear.gearStatus(s, "gear_dice").reason, "chapter", "ダイスは第2章のボドゲカフェから");
assert.equal(gear.buyGear(s, "gear_dice"), false);
assert.equal(gear.buyGear(s, "gear_hatchet"), true);
assert.equal(s.money, 15000);
assert.equal(gear.buyGear(s, "gear_hatchet"), false, "二度目は買えない");
assert.equal(s.money, 15000, "二度目でお金は減らない");
assert.equal(gear.gearStatus(s, "gear_hatchet").reason, "owned");
core.save(); s = core.load(); core.setState(s);
assert.equal(s.owned.filter(id => id === "gear_hatchet").length, 1);
assert.equal(gear.ownsGear(s, "gear_hatchet"), true);
assert.equal(gear.buyGear(s, "gear_hatchet"), false, "LOAD後も買い直せない");
// 柚ヶ谷では帰りの電車賃を残す（Dr.fookah と同じ spendableMoney）。
s = core.newGame();
Object.assign(s, { chapter: 2, money: 3900, flags: { _ch2_region: "widehanga", _ch2_preparation_started: true } });
assert.equal(gear.gearStatus(s, "gear_dice").reason, "money", "帰りの200円を残すと3,800円に届かない");
s.money = 4000;
assert.equal(gear.buyGear(s, "gear_dice"), true);
assert.equal(s.money, 200);
// 機材ではないので、Dr.fookah の機材一覧や制作の選択肢には出ない（DB.equipById に無い）。周回では購入品として引き継ぐ。
const carried = buildCarryPackage(s);
assert(carried.owned.includes("gear_dice"), "周回でも購入品として残る");

// 上位斧も同じ購入処理・SAVE/LOAD・周回の購入品経路。旧マイ斧は交換・返金しない。
for (const id of ["gear_hatchet_balanced", "gear_hatchet_precision"]) {
  s = core.newGame();
  Object.assign(s, { chapter: 1, money: HOBBY_GEAR[id].price - 1 });
  s.owned.push("gear_hatchet");
  assert.equal(gear.buyGear(s, id), false, "不足時は購入しない");
  s.money++;
  assert.equal(gear.buyGear(s, id), true);
  assert.equal(s.money, 0);
  assert(s.owned.includes("gear_hatchet"), "旧購入品は交換しない");
  core.save(); s = core.load(); core.setState(s);
  assert.equal(s.owned.filter(item => item === id).length, 1);
  assert.equal(gear.buyGear(s, id), false);
  assert.equal(s.money, 0, "旧購入者への未承認の返金をしない");
  assert(buildCarryPackage(s).owned.includes(id));
}

// 3. 斧: 構えの揺れだけを×0.9。点の付け方・刺さる力の帯は変えない。
assert.equal(gear.AXE_STEADY, 0.9);
for (const [ms, power, index, focused] of [[0, .62, 0, false], [4000, .5, 3, false], [9000, .8, 9, true]]) {
  const house = swayAt(ms, power, index, focused), mine = swayAt(ms, power, index, focused, gear.AXE_STEADY);
  assert(Math.abs(mine.amplitude - house.amplitude * .9) < 1e-12);
  assert(Math.abs(mine.x - house.x * .9) < 1e-12 && Math.abs(mine.y - house.y * .9) < 1e-12);
  assert.equal(mine.fatigue, house.fatigue, "疲れの進み方は同じ");
}
assert.deepEqual(releaseAimAt({ x: .1, y: -.2 }, 3000, .6, 1, false), releaseAimAt({ x: .1, y: -.2 }, 3000, .6, 1, false, 1), "店の斧は従来どおり");
assert.throws(() => swayAt(0, .62, 0, false, .2), RangeError, "極端な補正は受け付けない");
assert.equal(SWAY.max, .17, "揺れの上限そのものは変えない");

// 4. DJ: ▶の判定の窓だけが前後10ms広い。音程・フェーダーの採点は同じ。
assert.equal(gear.DJ_ALLOWANCE_MS, 10);
assert.equal(dj.gradeOf(35), "GOOD");
assert.equal(dj.gradeOf(35, 10), "PERFECT");
assert.equal(dj.gradeOf(-125), "EARLY");
assert.equal(dj.gradeOf(-125, 10), "OK");
assert.equal(dj.gradeOf(200, 10), "LATE");
const base = { pitchErrPct: .1, synced: false, playMs: 65, reached: 4, follow: .8 };
const plain = dj.scoreTransition(base), phones = dj.scoreTransition({ ...base, allowance: 10 });
assert.deepEqual([plain.parts[0], plain.parts[2]], [phones.parts[0], phones.parts[2]], "音程・フェーダーの点は同じ");
assert.deepEqual([plain.parts[1], phones.parts[1]], [60, 85], "65msの入りが GOOD 相当に");
assert.equal(dj.scoreTransition({ ...base, playMs: 20 }).total, dj.scoreTransition({ ...base, playMs: 20, allowance: 10 }).total, "ぴったりの入りは同じ点");
assert.equal(dj.createSet(SETS[0]).allowance, 0);
assert.equal(dj.createSet(SETS[0], () => 1, Math.random, { allowance: 10 }).allowance, 10);
assert.equal(dj.createSet(SETS[0], () => 1, Math.random, { allowance: 999 }).allowance, 30, "上限30ms");
assert.equal(new URL(djUrl(1, { phones: true })).searchParams.get("phones"), "1");
assert.equal(new URL(djUrl(1)).searchParams.get("phones"), null, "持っていなければ付けない");

// 5. TRPG: マイダイスは盛り上がり1から。ダイスは振らないので、同じseedの出目は変わらない。
const scenario = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/trpg_ordinary.json", import.meta.url), "utf8"));
const plainTable = new TrpgSession(scenario, { seed: 42 }), diceTable = new TrpgSession(scenario, { seed: 42, warmStart: true });
plainTable.start(); diceTable.start();
assert.equal(plainTable.snapshot().heat, 0);
assert.equal(diceTable.snapshot().heat, 1);
assert.deepEqual(diceTable.snapshot().heatLog.at(-1), { amount: 1, reason: "マイダイスを卓に並べた", heat: 1, tier: 0 });
assert(1 < HEAT.tiers[0], "1では勢い（判定+4）はまだ付かない");
assert.equal(diceTable.snapshot().momentum, 0);
assert.deepEqual(Array.from({ length: 6 }, () => diceTable.die()), Array.from({ length: 6 }, () => plainTable.die()), "出目の並びは同じ");
assert.equal(new TrpgSession(scenario, { seed: 42, warmStart: "yes" }).warmStart, false, "true のときだけ");

console.log("PASS hobby gear: venues, one purchase across save/load, hatchet sway ×0.9, headphones ±10ms, dice start the table warm");
