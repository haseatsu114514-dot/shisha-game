// 実際の成長・セーブ・スロットを使う。五章の物語が実装済みというテストではない。
// node --experimental-vm-modules remake/test/stat_growth_balance.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../js/", import.meta.url);
let rng = () => .5;
const math = Object.create(Math); math.random = () => rng();
const storage = new Map();
const context = vm.createContext({ Math: math, Map, Set, console, setTimeout: () => 0, clearTimeout() {},
  localStorage: { setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k) || null } });
const noop = () => {};
const mocks = {
  "core/util.js": { clamp: (v,a,b) => Math.max(a,Math.min(b,v)), el: noop, sleep: noop },
  "core/ui.js": { layers: {}, gainCard: noop, toast: noop },
  "core/data.js": { DB: {}, faceIconUrl: noop },
  "core/audio.js": { SE: {} },
};
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const path = url.href.slice(root.href.length), values = mocks[path];
  // 同じ依存を並行リンクしても二重に状態モジュールを作らない。
  const source = values ? "" : fs.readFileSync(url, "utf8");
  const mod = values ? new vm.SyntheticModule(Object.keys(values), function() {
    for (const [k,v] of Object.entries(values)) this.setExport(k,v);
  }, { context, identifier: url.href }) : new vm.SourceTextModule(source, { context, identifier: url.href });
  modules.set(url.href,mod); await mod.link(s => load(new URL(s,url))); return mod;
}
const statsModule = await load(new URL("core/stats.js", root)); await statsModule.evaluate();
const stats = statsModule.namespace;
const core = modules.get(new URL("core/state.js",root).href).namespace;
core.newGame(); core.state.chapter = 5;

// 案A 10段換算表。各段の端点と旧P値の切り上げを固定する。
const stepTables = modules.get(new URL("core/stat-step-tables.js", root).href).namespace;
const heartModule = await load(new URL("craft/steam-heart.js", root)); await heartModule.evaluate();
const heart = heartModule.namespace;
const expectedStamina = [0, 5, 10, 18, 25, 32, 40, 48, 54, 60];
const expectedRefresh = [90, 120, 150, 185, 220, 265, 310, 360, 420, Infinity];
const expectedCharm = [0, 250, 500, 850, 1200, 1600, 2000, 2400, 2700, 3000];
assert.deepEqual(Array.from(stepTables.GUTS_STAMINA_BONUS), expectedStamina);
assert.deepEqual(Array.from(stepTables.REFRESH_RADII), expectedRefresh);
assert.deepEqual(Array.from(stepTables.CHARM_BONUS), expectedCharm);
assert.deepEqual(Array.from(stepTables.REFRESH_LABELS), ["小さな範囲", "小さな範囲", "少し広い範囲", "少し広い範囲", "広い範囲", "広い範囲", "かなり広い範囲", "かなり広い範囲", "とても広い範囲", "画面全体"]);
for (let level = 1; level <= 10; level++) {
  const t = (level - 1) / 9;
  for (const key of core.STAT_KEYS) {
    core.state.stats[key] = level * 10;
    assert.equal(stats.step(key), level);
    assert.equal(stats.tier01(key), t);
    assert.equal(stats.rankLabel(key), stats.RANK_LABELS[key][Math.floor((level - 1) / 2)]);
  }
  const at = level - 1;
  const fixed = (value, digits) => Number(value.toFixed(digits));
  assert.equal(fixed(1 + .18 * t, 2), [1, 1.02, 1.04, 1.06, 1.08, 1.10, 1.12, 1.14, 1.16, 1.18][at]);
  assert.equal(fixed(1 + .45 * t, 2), [1, 1.05, 1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40, 1.45][at]);
  assert.equal(fixed(1 - .25 * t, 3), [1, .972, .944, .917, .889, .861, .833, .806, .778, .750][at]);
  assert.equal(fixed(4 * (1 - .2 * t), 2), [4, 3.91, 3.82, 3.73, 3.64, 3.56, 3.47, 3.38, 3.29, 3.20][at]);
  assert.equal(fixed(1 + .2 * t, 3), [1, 1.022, 1.044, 1.067, 1.089, 1.111, 1.133, 1.156, 1.178, 1.200][at]);
  assert.equal(fixed(1 + .25 * t, 3), [1, 1.028, 1.056, 1.083, 1.111, 1.139, 1.167, 1.194, 1.222, 1.250][at]);
  assert.equal(Math.round(.6 * t * 100), [0, 7, 13, 20, 27, 33, 40, 47, 53, 60][at]);
  assert.equal(stats.maxStamina(), 100 + expectedStamina[level - 1]);
  assert.equal(stepTables.refreshRestoresMental(level), level >= 5);
  assert.equal(stepTables.canSeeMixHint(level), level >= 3);
  assert.equal(stepTables.canSeeGoldenShort(level), level >= 5);
  assert(Math.abs(heart.heartHitRadius(t) - 4 * (1 - .2 * t)) < 1e-12);
}
for (const [value, expected] of [[0,1],[10,1],[11,2],[20,2],[21,3],[48,5],[50,5],[51,6],[100,10],[101,10]]) {
  core.state.stats.technique = value;
  assert.equal(stats.step("technique"), expected, `step(${value})`);
}

console.log("[stat steps] PASS: 10-step conversion, effects and discrete tables");
