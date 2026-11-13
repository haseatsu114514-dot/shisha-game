import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const context = vm.createContext({});
const values = {
  state: { chapter: 2, flags: {}, owned: [] }, DB: { equipById: {}, flavorById: {} },
  clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
};
async function load(source, deps = {}) {
  const module = new vm.SourceTextModule(source, { context });
  await module.link(spec => {
    if (deps[spec]) return deps[spec];
    const match = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].find(m => m[2] === spec);
    const names = match[1].split(',').map(n => n.trim());
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name] ?? (() => 0));
    }, { context });
  });
  await module.evaluate();
  return module;
}
const read = file => readFileSync(new URL(`../js/craft/${file}.js`, import.meta.url), 'utf8');
const common = await load(read('common'));
const rank = await load(read('rank-hud'));
const score = (await load(read('score'), { './common.js': common })).namespace;
// Independent reference of the pre-wiring final formula, including skipped foil.
function previousTotal(cs) {
  const w = cs.holes.skipped
    ? (cs.chapter === 1 && cs.mode === 'tournament' ? [0, .2, .4, .2, .2] : [0, .2, .2, .2, .2])
    : [.2, .2, .2, .2, .2];
  const parts = [cs.holes.score, cs.heat.score, cs.stats.craftQuality, cs.careHistory[0].score, cs.careHistory[1].score];
  const sum = w.reduce((a, b) => a + b, 0);
  return Math.round(parts.reduce((total, part, i) => total + part * (w[i] / sum), 0) * 10) / 10;
}
const { gradeOf, CRAFT_RANK_THRESHOLDS: floors } = common.namespace;
const snapshot = n => rank.namespace.craftRankProgress(n, floors);
const oldGrade = s => s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 65 ? 'B' : s >= 50 ? 'C' : 'D';

test('seven provisional floors preserve all legacy grade boundaries', () => {
  assert.deepEqual(Array.from(floors), [0, 50, 65, 80, 90, 95, 98]);
  assert(Object.isFrozen(floors));
  for (let i = 1; i < floors.length; i++) assert(floors[i] > floors[i - 1]);
  for (const n of [NaN, -Infinity, Infinity, ...Array.from({ length: 12001 }, (_, i) => i / 100 - 10), 49.9, 50, 64.9, 65, 79.9, 80, 89.9, 90, 94.9, 95, 97.9, 98, 100]) {
    assert.equal(gradeOf(n), oldGrade(n), String(n));
    if (Number.isFinite(n)) assert.equal(snapshot(n).grade.replace(/^SS+$/, 'S'), gradeOf(n));
  }
  assert.equal(snapshot(92.5).progress, .5);
  assert.equal(snapshot(98).progress, 1);
});

test('live average includes only completed items and never mutates the session', () => {
  assert.equal(score.provisionalCraftScore({}), null);
  assert.equal(score.provisionalCraftScore({ total: 0, mixInfo: { score: 99 } }), null);
  assert.equal(score.provisionalCraftScore({ holes: { score: 0 } }), 0);
  const cs = { holes: { score: 80 }, heat: { score: 40 }, stats: { craftQuality: 100 }, careHistory: [{ score: 90 }] };
  assert.equal(score.provisionalCraftScore(cs), 70);
  cs.pullDone = true;
  const before = JSON.stringify(cs);
  assert.equal(score.provisionalCraftScore(cs), 77.5);
  assert.equal(JSON.stringify(cs), before);
  const skipped = { ...cs, holes: { skipped: true, score: 0 }, mode: 'tournament', chapter: 1 };
  assert.equal(score.provisionalCraftScore(skipped), 82.5);
  assert.equal(score.provisionalCraftScore({ holes: { score: NaN }, heat: { score: Infinity } }), null);
});

test('climbing rank starts at D and opens one grade per finished step (CRN01)', () => {
  const steps = ['setup', 'mix', 'pack', 'holes', 'place', 'heat', 'steam', 'pull', 'care1', 'care2'];
  const grade = cs => snapshot(score.climbingCraftScore(cs, steps)).grade;
  assert.equal(score.climbingCraftScore({}, steps), 0);
  assert.equal(grade({}), 'D');
  // 全部満点の一台は、工程ごとに D→C→B→A→S→SSS と1段ずつ上がる
  const cs = {};
  const seen = [grade(cs)];
  cs.holes = { score: 100 }; seen.push(grade(cs));
  cs.heat = { score: 100 }; seen.push(grade(cs));
  cs.stats = { craftQuality: 100 }; cs.pullDone = true; seen.push(grade(cs));
  const before = JSON.stringify(cs);
  cs.careHistory = [{ score: 100 }]; seen.push(grade(cs));
  assert.equal(JSON.stringify({ ...cs, careHistory: undefined }), JSON.stringify({ ...JSON.parse(before), careHistory: undefined }));
  cs.careHistory.push({ score: 100 }); seen.push(grade(cs));
  assert.deepEqual(seen, ['D', 'C', 'B', 'A', 'S', 'SSS']);
  // 出来が平均70の一台は、Bで止まる（上限ではなく平均で抑えられる）
  assert.equal(grade({ holes: { score: 70 }, heat: { score: 70 }, pullDone: true, stats: { craftQuality: 70 } }), 'B');
  // 全工程を終えたら、最終の総合（ボーナス前）と一致する
  const full = { holes: { score: 90 }, heat: { score: 80 }, pullDone: true, stats: { craftQuality: 100 }, careHistory: [{ score: 70 }, { score: 60 }] };
  assert.equal(score.climbingCraftScore(full, steps), score.finalize(structuredClone({ ...full, chapter: 2, mode: 'rehearsal' })).total);
  // 調整なしの台は、提供で全工程が終わる
  const noCare = steps.filter(id => !id.startsWith('care'));
  assert.equal(score.climbingCraftScore({ holes: { score: 90 }, heat: { score: 90 }, pullDone: true, stats: { craftQuality: 90 } }, noCare), 90);
  assert.equal(score.climbingCraftScore({ heat: { score: NaN } }, steps), 0);
});

test('final totals, parts, bonus and D–S ranks match the unchanged scoring formula', () => {
  for (const chapter of [1, 2]) for (const mode of ['tournament', 'rehearsal']) for (const skipped of [false, true]) for (const n of [0, 49.9, 65, 90, 95, 98, 100]) {
    const cs = { chapter, mode, holes: { score: n, skipped }, heat: { score: 80 }, stats: { craftQuality: 96 }, careHistory: [{ score: 70 }, { score: 100 }] };
    const next = score.finalize(structuredClone(cs));
    assert.equal(next.total, previousTotal(cs));
    assert.equal(next.rank, oldGrade(next.total));
    assert.deepEqual(JSON.parse(JSON.stringify(next.parts)), {
      ...(skipped ? {} : { holes: n }), heat: 80, shisha: 96, care1: 70, care2: 100,
    });
    assert.equal(next.bonusNotes.length, 0);
  }
});

test('final bonus and cap stay separate from the provisional average', () => {
  values.state.rehearsal = 'great';
  values.state.flags._last_night = 'practice';
  const cs = { chapter: 1, mode: 'rehearsal', pullDone: true, holes: { score: 98 }, heat: { score: 98 }, stats: { craftQuality: 98 }, careHistory: [{ score: 98 }, { score: 98 }] };
  assert.equal(score.provisionalCraftScore(cs), 98);
  assert.equal(score.finalize(cs).total, 100);
  assert.equal(cs.rank, 'S');
  assert.equal(snapshot(cs.total).grade, 'SSS');
  assert.equal(cs.bonusNotes.length, 2);
  delete values.state.rehearsal;
  delete values.state.flags._last_night;
});
