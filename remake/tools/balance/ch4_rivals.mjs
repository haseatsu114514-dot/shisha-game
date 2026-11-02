/** 第4章（世界大会）の相手の出来の曲線を、はじめの出来の格子で測る。Run: `node remake/tools/balance/ch4_rivals.mjs`
 * 投票・途中順位・勝敗は本物の ch4-tournament-state.js で出す。比較の「旧」は同じモジュールの CH4_RIVAL_CURVE だけを
 * 旧定数（なる86・王煙楼87・シェイク88を全回）へメモリ上で読み替えたもの（ゲームのファイルは変えない）。
 * はじめの一台: 5工程（穴あけ・炭焼き・完成品・調整1・調整2）を平均 μ のまわりに −4/−2/0/+2/+4 で振った全組み合わせ
 * （3125台、乱数なし）。途中の票は工程の平均、最後の票は総合（5工程の平均＋加点 BONUS）で、本番の qualityAt と同じ。
 */
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const OLD = "naru: Object.freeze([86, 86, 86, 86]), master_hookah: Object.freeze([87, 87, 87, 87]), sheikh: Object.freeze([88, 88, 88, 88])";
registerHooks({ load(url, context, nextLoad) {
  const loaded = nextLoad(url, context);
  if (!url.endsWith("/chapters/ch4-tournament-state.js?baseline")) return loaded;
  const source = String(loaded.source);
  const table = /export const CH4_RIVAL_CURVE = Object\.freeze\(\{[^}]*\}\);/;
  assert.match(source, table, "CH4_RIVAL_CURVE changed shape: update the baseline loader");
  return { ...loaded, source: source.replace(table, `export const CH4_RIVAL_CURVE = Object.freeze({ ${OLD} });`) };
} });

const { newState } = await import("../../js/core/state.js");
const now = await import("../../js/chapters/ch4-tournament-state.js");
const old = await import("../../js/chapters/ch4-tournament-state.js?baseline");
assert.deepEqual(old.CH4_RIVAL_QUALITY, { naru: 86, master_hookah: 87, sheikh: 88 });

const BONUS = 1; // 熟練度などの加点（最後の総合だけに乗る）。
const OFFSETS = [-4, -2, 0, 2, 4];
const SPREAD = [0, 1, 2, 3, 4].reduce(rows => rows.flatMap(row => OFFSETS.map(x => [...row, x])), [[]]); // 5工程ぶん

/** 1台を最後まで通し、各回の票・先頭・勝敗を返す。 */
function play(mod, parts, bonus = BONUS) {
  const value = newState();
  value.chapter = 4;
  value.flags._ch4 = { part: "tournament", read: { ch4_tournament_start: true } };
  const [holes, heat, served, care1, care2] = parts;
  const cs = { holes: { score: holes }, heat: { score: heat }, servedQuality: served, pullDone: true,
    careHistory: [{ score: care1 }, { score: care2 }],
    total: Math.round(Math.min(100, parts.reduce((a, b) => a + b, 0) / 5 + bonus) * 10) / 10 };
  mod.startChapterFourCraft(value, cs);
  const rounds = [];
  let before = mod.chapterFourMatch(value).votes;
  for (let step = 0; step < 11; step++) {
    mod.beginChapterFourStep(value);
    const p = mod.finishChapterFourStep(value, cs);
    if (p.voted === rounds.length) continue;
    const got = id => mod.CH4_JUDGES.reduce((sum, judge) => sum + p.votes[judge][id] - before[judge][id], 0);
    rounds.push({ got: Object.fromEntries(mod.CH4_CONTESTANTS.map(id => [id, got(id)])), leader: mod.chapterFourStandings(p)[0].id });
    before = structuredClone(p.votes);
  }
  const p = mod.chapterFourMatch(value);
  assert.equal(rounds.length, 4);
  return { win: p.result.win, rounds, rows: p.result.rows };
}

function measure(mod, mu) {
  const runs = SPREAD.map(offsets => play(mod, offsets.map(x => Math.min(100, mu + x))));
  const rate = test => runs.filter(test).length / runs.length;
  return {
    win: rate(r => r.win),
    naruVotes: rate(r => r.rounds[1].got.naru > 0 || r.rounds[2].got.naru > 0),
    naruLead1: rate(r => r.rounds[1].leader === "naru"),
    naruLead2: rate(r => r.rounds[2].leader === "naru"),
    naruSecond: rate(r => r.win && r.rows[1].id === "naru"),
    sheikhLast: rate(r => r.rounds[3].got.sheikh === 6),
  };
}

/** 勝率が50%に届く平均 μ（二分探索、0.05刻み）。 */
function midpoint(mod) {
  let lo = 80, hi = 100;
  while (hi - lo > 0.05) { const mid = (lo + hi) / 2; if (measure(mod, mid).win >= 0.5) hi = mid; else lo = mid; }
  return Math.round(hi * 100) / 100;
}

/** 5工程とも同じ出来（加点なし）で勝てる最小の値（0.1刻み）。 */
function evenBar(mod) {
  for (let q = 800; q <= 1000; q++) if (play(mod, Array(5).fill(q / 10), 0).win) return q / 10;
  return null;
}

const pct = x => `${(x * 100).toFixed(1)}%`;
console.log(`相手の出来: 旧 ${JSON.stringify(old.CH4_RIVAL_CURVE)}`);
console.log(`           新 ${JSON.stringify(now.CH4_RIVAL_CURVE)}`);
console.log(`はじめ: 5工程を μ±4（${SPREAD.length}台）、最後の総合に加点 +${BONUS}\n`);
console.log("| はじめ | μ | 勝率 旧→新 | なるが途中（提供後・調整1）に票 | なるが先頭: 提供後 / 調整1の後 | 勝って2位がなる | 最後の票の1位がシェイク |");
console.log("|---|---:|---:|---:|---:|---:|---:|");
for (const [label, mu] of [["弱め", 85], ["ふつう", 88], ["良い", 91], ["とても良い", 94]]) {
  const a = measure(old, mu), b = measure(now, mu);
  console.log(`| ${label} | ${mu} | ${pct(a.win)} → ${pct(b.win)} | ${pct(a.naruVotes)} → ${pct(b.naruVotes)} | `
    + `${pct(b.naruLead1)} / ${pct(b.naruLead2)}（旧 ${pct(a.naruLead1)}） | ${pct(a.naruSecond)} → ${pct(b.naruSecond)} | ${pct(a.sheikhLast)} → ${pct(b.sheikhLast)} |`);
}
console.log(`\n勝率50%の平均 μ: 旧 ${midpoint(old)} → 新 ${midpoint(now)}`);
console.log(`5工程とも同じ出来で勝てる最小値: 旧 ${evenBar(old)} → 新 ${evenBar(now)}`);
