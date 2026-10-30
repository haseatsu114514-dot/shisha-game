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
const reelModule = await load(new URL("daily/reel.js", root)); await reelModule.evaluate();
const reel = reelModule.namespace;
const core = modules.get(new URL("core/state.js",root).href).namespace;
const stats = modules.get(new URL("core/stats.js",root).href).namespace;
const snapshot = () => ({ ...core.state.stats });
function fresh(chapter = 5) {
  if (core.state) { core.state.phase = "cleared"; reel.onAction(); }
  const s = core.newGame(); s.phase = "daily"; s.chapter = chapter; s.reel.installed = true; return s;
}

for (const key of core.STAT_KEYS) for (const before of [0,10,20,21,40,60,80,99]) {
  const s = fresh(); s.stats[key] = before; s.statXp[key] = .42;
  const { spent } = await stats.paidAction(async () => {
    stats.applyStats({ [key]: 2 }); stats.applyStats({ [key]: 20 }); stats.earnStat(key, 4);
    stats.addStamina(-10);
  });
  assert(spent > 0); assert.equal(s.stats[key], before + 1, `${key}@${before} did not gain exactly 1P`);
  assert(Math.abs(s.statXp[key] - (before === 99 ? 0 : .42)) < 1e-9);
}
for (const run of [
  () => stats.applyStats({ technique: 20 }),
  () => stats.paidAction(async () => { stats.applyStats({ technique: 20 }); stats.addStamina(20); }),
  () => stats.paidAction(async () => { core.state.stamina = 0; stats.applyStats({ technique: 20 }); stats.addStamina(-20); }),
]) {
  fresh(); const before = snapshot(); await run();
  assert.deepEqual(snapshot(), before); reel.onAction({ spent: 0 }); assert.equal(core.state.reel.count, 0);
}
let s = fresh(4);
for (const key of core.STAT_KEYS) s.stats[key] = 90;
s.stats.sense = 88;
await stats.paidAction(async () => { stats.applyStats({ technique: 9, guts: 8 }); stats.addStamina(-10); });
assert.equal(s.stats.sense, 89, "Two capped candidates gave the remaining ability 2P in one normal action");
assert.equal(stats.gainStat("sense", 24, { silent: true }), 1, "Bonus must report the actual remaining capacity");
assert.equal(stats.gainStat("sense"), 0, "All abilities already reached the chapter cap");
assert.equal(stats.CYCLE_START_CAP_MARGIN, 10);
s = fresh(1);
for (const key of core.STAT_KEYS) assert.equal(stats.statCap(key), 48, "1周目は章キャップと一致");
delete s.cycleStartStats;
assert.equal(stats.statCap("technique"), 48, "旧セーブの欠損値は初期値として扱う");
s.cycleStartStats = Object.fromEntries(core.STAT_KEYS.map(key => [key, 10]));
s.cycleStartStats.technique = 80;
s.stats.technique = 80;
s.stats.sense = 48;
assert.equal(stats.statCap("technique"), 90);
assert.equal(stats.statCap("sense"), 48);
assert.equal(stats.gainStat("technique", 20, { silent: true }), 10);
assert.equal(stats.gainStat("sense", 1, { silent: true }), 1, "能力ごとの上限を使って振替先を探す");
assert.equal(s.stats.sense, 48);

// ★帯の重い旧経験値は、ロード後も「次の1Pへの進捗」として保持する。
const old = core.newState(); old.schema = 8; old.chapter = 4; old.money = 12345;
old.stats = { technique: 10, sense: 22, guts: 45, charm: 63, insight: 96 };
old.statXp = { technique: .4, sense: .75, guts: 1.2, charm: 2.4, insight: 3.2 };
old.reel.pending = [{ role: "big", target: "sense", got: 4, exp: 6 }];
storage.set(core.SAVE_KEY, JSON.stringify(old)); core.load();
assert.deepEqual(snapshot(), old.stats); assert.equal(core.state.money, 12345);
for (const [key,carry] of Object.entries({ technique: .4, sense: .5, guts: .6, charm: .8, insight: .8 })) {
  assert(Math.abs(core.state.statXp[key] - carry) < 1e-9);
}
assert.equal(core.state.reel.pending[0].got, 4, "Already committed slot rewards changed on migration");
core.state.chapter = 5;
await stats.paidAction(async () => { stats.earnStat("insight", 4); stats.addStamina(-10); });
assert.equal(core.state.stats.insight, 97, "Old carry inflated a normal 1P gain");
const migrated = JSON.stringify({ stats: core.state.stats, xp: core.state.statXp, pending: core.state.reel.pending });
core.save(); core.load();
assert.equal(JSON.stringify({ stats: core.state.stats, xp: core.state.statXp, pending: core.state.reel.pending }), migrated);

// 候補が複数ある誘いでも主な一能力だけに2P。通常との違いは倍率。
s = fresh();
await stats.paidAction(async () => {
  stats.applyStats({ sense: 9, charm: 2 }); stats.addStamina(-10);
}, { budget: 1, points: 2, primary: "charm" });
assert.deepEqual(snapshot(), { technique: 10, sense: 10, guts: 10, charm: 12, insight: 10 });
console.log("[growth] PASS: 1P per normal ability / single 2P invitation, no duplicate/free/zero-stamina growth, capped redirects, old saves");

const runs = Number(process.env.GROWTH_RUNS || 10000);
const q = (a,p) => [...a].sort((x,y) => x-y)[Math.floor((a.length-1)*p)];
const reports = [];
for (const mode of ["training", "mixed"]) {
  const endMeans = Array.from({ length: 5 }, () => []), ends = [], day5 = [], paid5 = [];
  for (let seed = 1; seed <= runs; seed++) {
    rng = reel.core.mulberry32(seed + 50000);
    const s = fresh(1); s.reel.seed = seed;
    let paid = 0, finish = null;
    for (let chapter = 1; chapter <= 5; chapter++) {
      s.chapter = chapter;
      for (let step = 0; step < 26; step++) {
        // 1章26枠。6枠は固定進行・休養などで育たない。残り20枠で育成する。
        if ([1,5,9,13,17,21].includes(step)) continue;
        const keys = [...core.STAT_KEYS].sort((a,b) => s.stats[a] - s.stats[b]);
        const { spent } = await stats.paidAction(async () => {
          stats.earnStat(keys[0], 4);
          // 育成を意識する経路は2能力、混在経路は1能力と2能力を交互に選ぶ。
          if (mode === "training" || paid % 2) stats.earnStat(keys[1], 2);
          s.stamina = 100; stats.addStamina(-10);
        });
        reel.onAction({ spent }); s.reel.pending = []; paid++;
        if (!finish && core.STAT_KEYS.every(k => s.stats[k] === 100)) finish = { chapter, step: step + 1, paid };
        if (chapter < 5) assert(core.STAT_KEYS.every(k => s.stats[k] < 100), "Reached full MAX before chapter 5");
      }
      endMeans[chapter-1].push(Object.values(s.stats).reduce((a,b) => a+b,0)/5);
    }
    ends.push(finish ? 1 : 0);
    if (finish) { day5.push(Math.ceil(finish.step / 2)); paid5.push(finish.paid - 80); }
  }
  const completion = ends.reduce((a,b) => a+b,0)/runs;
  const report = { mode, seeds: runs, paidActionsPerChapter: 20, nonGrowingSlotsPerChapter: 6,
    chapterEndMedian: endMeans.map(a => q(a,.5)), completion,
    chapter5Day: { p10: q(day5,.1), p50: q(day5,.5), p90: q(day5,.9) },
    chapter5PaidActions: { p10: q(paid5,.1), p50: q(paid5,.5), p90: q(paid5,.9) } };
  if (mode === "training") {
    assert(completion > .97, JSON.stringify(report));
    assert(report.chapter5Day.p50 >= 6 && report.chapter5Day.p50 <= 11, JSON.stringify(report));
    assert(report.chapterEndMedian[0] >= 25 && report.chapterEndMedian[0] < 40, "Chapter 1 growth was too slow or too rich");
  }
  reports.push(report); console.log("[growth balance]", JSON.stringify(report));
}
if (process.env.REPORT) fs.writeFileSync(process.env.REPORT, JSON.stringify(reports,null,2) + "\n");
console.log("[growth balance] PASS: real paid-action and slot commits; chapter 4 stays below MAX, deliberate growth completes during chapter 5");
