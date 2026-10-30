// パッキースロットの追い風（経験値ブースト、stat-design SPEC 1.8・4.3、#1281）。
// node --experimental-vm-modules remake/test/slot_tailwind.mjs
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

// 1) 経験値のしくみが無効: 今までどおり能力P、追い風は作らない
assert.equal(growth.growthEnabled(), false);
const offRun = rolls(60);
const offStats = plain(core.state.stats);
assert.equal(core.state.growth, undefined, "無効なら growth を作らない");
assert.ok(core.state.reel.pending.some((r) => r.got > 0), "無効なら能力Pが入る");

// 2) 有効: 役・出目・ノートは同じ、能力は伸びず、追い風が入る
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
assert.ok(pending.every((r) => r.got === 0));
for (const r of pending) {
  const role = r.overlap || r.role;
  if (growth.BOOST_TABLE[role] && !r.quiet) assert.ok(r.boost && r.boost.left >= 1 && r.boost.mult >= growth.BOOST_TABLE[role].mult, `${role} で追い風`);
  else assert.equal(r.boost, null, `${role} は追い風なし`);
}
const g = core.state.growth;
assert.ok(g.boost.left <= 10 && g.boost.mult <= 2, "上限 ×2.0・10回");

// 3) 重ねがけ: 倍率は高い方、回数は足す、上限10回
g.boost = { mult: 1, left: 0 };
assert.deepEqual(plain(growth.addBoost("bell")), { mult: 1.25, left: 2 });
assert.deepEqual(plain(growth.addBoost("reg")), { mult: 1.5, left: 5 });
assert.deepEqual(plain(growth.addBoost("cherry")), { mult: 1.5, left: 6 }, "低い倍率で下がらない");
assert.deepEqual(plain(growth.addBoost("freeze")), { mult: 2, left: 10 }, "回数は上限10");
assert.equal(growth.addBoost("miss"), null);
assert.equal(growth.addBoost("replay"), null);
assert.equal(growth.boostLabel({ mult: 1.5, left: 5 }), "追い風 ×1.5・あと5回");
assert.equal(growth.boostLabel({ mult: 2, left: 3 }), "大追い風 ×2・あと3回");

// 4) 経験値に掛かる: 体力を使った行動1回で1減り、行動中の経験値（X1〜X3）に倍率
core.newGame();
Object.assign(core.state, { phase: "daily", chapter: 1, day: 3 });
const gg = growth.ensureGrowth();
gg.boost = { mult: 1.5, left: 2 };
const visit = (target, run = async () => { stats.addStamina(-4); return true; }) => stats.paidAction(run, { exp: target });
await visit({ key: "naru", person: "naru" });
assert.equal(gg.xp, Math.round(30 * 1.5) + Math.round(40 * 1.5), "はじめての相手 (30+40)×1.5");
assert.deepEqual(plain(gg.boost), { mult: 1.5, left: 1 });
await visit({ key: "kannon", place: "kannon" }, async () => false);
assert.deepEqual(plain(gg.boost), { mult: 1.5, left: 1 }, "体力を使わない行動は減らさない");
const before = gg.xp;
await visit({ key: "naru", person: "naru" });
assert.equal(gg.xp - before, 45, "2回目 30×1.5");
assert.deepEqual(plain(gg.boost), { mult: 1, left: 0 }, "使い切ったら消える");
const after = gg.xp;
await visit({ key: "adam", person: "adam" });
assert.equal(gg.xp - after, 70, "追い風なしは満額のまま");
// 行動の外（開発用・大会など）は倍率なし
gg.boost = { mult: 2, left: 3 };
const outside = gg.xp;
growth.gainExp(100);
assert.equal(gg.xp - outside, 100, "行動の外の経験値には掛けない");
assert.equal(gg.boost.left, 3);

// 5) 壊れた値・旧セーブ
for (const bad of [undefined, null, "x", { mult: 9, left: 99 }, { mult: 0.5, left: 3 }, { mult: 1.5, left: -1 }]) {
  core.state.growth.boost = bad;
  const b = plain(growth.ensureGrowth().boost);
  assert.ok(b.left <= 10 && b.mult <= 2 && b.mult >= 1 && (b.left > 0 || b.mult === 1), JSON.stringify(bad));
}
delete core.state.growth.boost;
assert.deepEqual(plain(growth.ensureGrowth().boost), { mult: 1, left: 0 });

console.log("[slot tailwind] PASS: flag off keeps stat P, same rolls/note when on, no stat P when on, boost table/merge/cap, per-action spend, outside-action unboosted, legacy/bad saves");
