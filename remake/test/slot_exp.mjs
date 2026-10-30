// パッキースロット: 図柄が揃ったら経験値（#1281 オーナー指示 2026-10-30）。経験値のしくみが無効なら従来の能力P。
// node --experimental-vm-modules remake/test/slot_exp.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../js/", import.meta.url);
const storage = new Map();
const cards = [];
const context = vm.createContext({ Math, Map, Set, JSON, console, setTimeout: () => 0, clearTimeout() {},
  localStorage: { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) } });
const noop = () => {};
const mocks = {
  "core/util.js": { clamp: (v, a, b) => Math.max(a, Math.min(b, v)), el: noop, sleep: noop },
  "core/ui.js": { layers: {}, gainCard: (o) => cards.push(o), toast: noop },
  "core/data.js": { DB: {}, faceIconUrl: noop },
  "core/audio.js": { SE: {} },
};
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const path = url.href.slice(root.href.length), values = mocks[path];
  const mod = values ? new vm.SyntheticModule(Object.keys(values), function () {
    for (const [k, v] of Object.entries(values)) this.setExport(k, v);
  }, { context, identifier: url.href }) : new vm.SourceTextModule(fs.readFileSync(url, "utf8"), { context, identifier: url.href });
  modules.set(url.href, mod); await mod.link((s) => load(new URL(s, url))); return mod;
}
const reelModule = await load(new URL("daily/reel.js", root)); await reelModule.evaluate();
const reel = reelModule.namespace;
const ns = (p) => modules.get(new URL(p, root).href).namespace;
const core = ns("core/state.js"), growth = ns("core/growth.js"), stats = ns("core/stats.js");
const plain = (v) => JSON.parse(JSON.stringify(v));

function fresh() {
  core.newGame();
  Object.assign(core.state, { phase: "daily", chapter: 1, day: 3 });
  Object.assign(core.state.reel, { installed: true, introDone: true, seed: 12345 });
}
// 同じシードで回したときの役の列（報酬のしくみに関係なく同じであること）
function rolls(n) {
  fresh();
  for (let i = 0; i < n; i++) reel.onAction({ spent: 1 });
  return { roles: core.state.reel.pending.map((r) => `${r.role}:${r.overlap || ""}:${r.stops.join(",")}`), note: plain(core.state.reel.note) };
}

// 1) 経験値のしくみが無効: 今までどおり能力P、経験値は作らない
assert.equal(growth.growthEnabled(), false);
const offRun = rolls(60);
const offStats = plain(core.state.stats);
assert.equal(core.state.growth, undefined, "無効なら growth を作らない");
assert.ok(core.state.reel.pending.some((r) => r.got > 0), "無効なら能力Pが入る");

// 2) 有効: 役・出目・ノートは同じ、能力は伸びず、揃った役の分だけ経験値
growth.setGrowthPreview(true);
assert.equal(growth.growthEnabled(), true);
fresh();
const base = plain(core.state.stats);
const onRun = rolls(60);
assert.deepEqual(onRun.roles, offRun.roles, "役・出目は報酬のしくみで変わらない");
assert.deepEqual(onRun.note, offRun.note, "ノートの記録も同じ");
assert.deepEqual(plain(core.state.stats), base, "有効なら能力Pは足さない");
assert.notDeepEqual(offStats, base, "（比較）無効のときは伸びていた");
const pending = core.state.reel.pending;
let sum = 0;
for (const r of pending) {
  const role = r.overlap || r.role;
  assert.equal(r.got, 0);
  const want = r.quiet ? 0 : (growth.SLOT_EXP[role] || 0); // 第1章は章倍率1
  assert.equal(r.xp, want, `${role} の経験値`);
  sum += r.xp;
}
assert.ok(sum > 0, "当たりがあれば経験値が入る");
assert.equal(core.state.growth.xp, sum, "経験値は抽選の時点で一度だけ入る");
assert.equal(core.state.growth.today.learned.pakki_slot, sum, "今日学んだことにスロットとして載る");
assert.equal(growth.SLOT_EXP.miss, undefined);
assert.equal(growth.SLOT_EXP.replay, undefined);

// 3) 章倍率は他の経験値と同じに掛かる
core.newGame();
Object.assign(core.state, { phase: "daily", chapter: 3, day: 3 });
assert.equal(growth.awardSlotExp("big"), Math.round(130 * growth.CHAPTER_MULT[3]));
assert.equal(growth.awardSlotExp("miss"), 0);

// 4) 平均の量（1章30回転で約510、SPEC 1.4 のスロット分 約2割）
let total = 0;
for (let seed = 1; seed <= 200; seed++) {
  core.newGame(); Object.assign(core.state, { phase: "daily", chapter: 1, day: 3 });
  Object.assign(core.state.reel, { installed: true, introDone: true, seed: seed * 7919 });
  for (let i = 0; i < 30; i++) reel.onAction({ spent: 1 });
  total += core.state.growth.xp;
}
const avg = total / 200;
assert.ok(avg > 400 && avg < 650, `1章30回転の平均 ${avg}`);

console.log(`[slot exp] PASS: flag off keeps stat P, same rolls/note when on, no stat P when on, EXP per matched role, chapter mult, avg ${Math.round(avg)}/30 spins`);
