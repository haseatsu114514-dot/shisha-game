// U5: NG+ バランス計測ハーネス（先行実装）。係数の確定はD1（オーナー判断）。
// 能力・熟練度・操作の巧拙によるスコア分布と飽和状況を、実計算を呼ぶアダプター越しに計測する。
// 計測は保存領域から隔離した複製データだけで行い、プレイ中の state・セーブ・メタ層を書き換えない。
import { difficultyForRun, setRivalScoreObserver } from "./ngplus-difficulty.js";
import { SPEND, castVotes, standings, startAttempt } from "../chapters/ch3-tournament-state.js";

/** 工程点の上限。実計算側の bounded（0〜100）と一致させる。 */
export const PROCESS_CAP = 100;

const OPERATIONS = Object.freeze(["poor", "mid", "perfect"]);

/**
 * シナリオの形を検証し、欠けた項目へ既定値を補った複製を返す。入力は変更しない。
 * cycleStartStats は「周回開始時の5能力」で、playStats（計測時の5能力）とは別に扱う。
 */
export function validateScenario(scenario) {
  if (!scenario || typeof scenario.id !== "string" || !scenario.id) {
    throw new TypeError("シナリオには id が必要です");
  }
  if (!Number.isInteger(scenario.chapter)) {
    throw new TypeError(`シナリオ ${scenario.id}: chapter が必要です`);
  }
  if (scenario.operation !== undefined && !OPERATIONS.includes(scenario.operation)) {
    throw new TypeError(`シナリオ ${scenario.id}: operation は ${OPERATIONS.join("/")} のいずれかです`);
  }
  return {
    cycle: 1, carryStats: false, mastery: 0, operation: "mid", bonuses: {},
    ...scenario,
    bonuses: { equip: false, rehearsal: false, ...(scenario.bonuses || {}) },
  };
}

/**
 * シナリオの持ち込み指数 P。
 * 周回開始時の cycleStartStats をそのまま難易度へ渡す。playStats は P に影響しない。
 */
export function carryPForScenario(scenario) {
  const s = validateScenario(scenario);
  return difficultyForRun(
    { cycleStartStats: s.cycleStartStats },
    { cycle: s.cycle, carryStats: s.carryStats === true },
  );
}

/** 上限へ到達した工程の位置（ラベル付きならラベル）を返す。 */
function saturatedOf(processScores) {
  if (!Array.isArray(processScores)) return null;
  const hit = [];
  processScores.forEach((entry, index) => {
    const score = typeof entry === "number" ? entry : entry?.score;
    if (Number.isFinite(score) && score >= PROCESS_CAP) {
      hit.push(typeof entry === "number" || entry?.label === undefined ? index : entry.label);
    }
  });
  return hit;
}

/**
 * シナリオ×シードの掃引を実行し、行データを返す。
 * evaluate(scenario, seed, { p }) は実際の工程・大会計算を呼ぶアダプターで、
 * { processScores, total, rank, votes } を返す（工程点の生成側はアダプターの責務）。
 * 相手スコアは observer 経由で収集し、終了時・例外時も必ず解除する。
 */
export function runMeasurement({ scenarios, seeds = [1], evaluate } = {}) {
  if (!Array.isArray(scenarios) || !scenarios.length) throw new TypeError("scenarios が必要です");
  if (!Array.isArray(seeds) || !seeds.length) throw new TypeError("seeds が必要です");
  if (typeof evaluate !== "function") throw new TypeError("evaluate（実計算アダプター）が必要です");
  const rows = [];
  for (const raw of scenarios) {
    const scenario = validateScenario(raw);
    const p = carryPForScenario(scenario);
    for (const seed of seeds) {
      const rivalSamples = [];
      setRivalScoreObserver(sample => rivalSamples.push({ ...sample }));
      let outcome;
      try {
        outcome = evaluate(scenario, seed, { p }) || {};
      } finally {
        setRivalScoreObserver(null);
      }
      rows.push({
        scenarioId: scenario.id, seed, chapter: scenario.chapter, p,
        processScores: outcome.processScores ?? null,
        total: outcome.total ?? null,
        rivalSamples,
        rank: outcome.rank ?? null,
        votes: outcome.votes ?? null,
        saturatedProcesses: saturatedOf(outcome.processScores),
      });
    }
  }
  return rows;
}

const sorted = values => [...values].sort((a, b) => a - b);
function quantile(values, q) {
  if (!values.length) return null;
  const list = sorted(values), pos = (list.length - 1) * q;
  const base = Math.floor(pos), rest = pos - base;
  return list[base + 1] === undefined ? list[base] : list[base] + rest * (list[base + 1] - list[base]);
}
const statsOf = values => values.length ? {
  mean: values.reduce((sum, v) => sum + v, 0) / values.length,
  min: Math.min(...values), max: Math.max(...values),
  q25: quantile(values, .25), median: quantile(values, .5), q75: quantile(values, .75),
} : { mean: null, min: null, max: null, q25: null, median: null, q75: null };

/** 行データをシナリオ単位へ集計する。平均・範囲・分位点・上限到達率・順位分布を出す。 */
export function summarizeRows(rows) {
  const byScenario = new Map();
  for (const row of rows) {
    if (!byScenario.has(row.scenarioId)) byScenario.set(row.scenarioId, []);
    byScenario.get(row.scenarioId).push(row);
  }
  const summary = [];
  for (const [scenarioId, group] of byScenario) {
    const totals = group.map(r => r.total).filter(Number.isFinite);
    const processCount = Math.max(0, ...group.map(r => r.processScores?.length || 0));
    const saturationRateByProcess = Array.from({ length: processCount }, (_, index) => {
      const scored = group.filter(r => Number.isFinite(r.processScores?.[index]?.score ?? r.processScores?.[index]));
      if (!scored.length) return null;
      const hit = scored.filter(r => (r.processScores[index]?.score ?? r.processScores[index]) >= PROCESS_CAP).length;
      return hit / scored.length;
    });
    const rankDistribution = {};
    for (const row of group) {
      if (Number.isInteger(row.rank)) rankDistribution[row.rank] = (rankDistribution[row.rank] || 0) + 1;
    }
    summary.push({ scenarioId, chapter: group[0].chapter, runs: group.length,
      total: statsOf(totals), saturationRateByProcess, rankDistribution });
  }
  return summary;
}

/**
 * 同じ group・同じシードで操作条件だけを変えた対応比較。
 * 各 group の先頭 operation を基準に、他 operation の total 平均差を返す。
 */
export function pairedOperationDeltas(rows, scenarios) {
  const byId = new Map(scenarios.map(s => [s.id, validateScenario(s)]));
  const groups = new Map();
  for (const row of rows) {
    const scenario = byId.get(row.scenarioId);
    if (!scenario?.group || !Number.isFinite(row.total)) continue;
    if (!groups.has(scenario.group)) groups.set(scenario.group, new Map());
    const byOperation = groups.get(scenario.group);
    if (!byOperation.has(scenario.operation)) byOperation.set(scenario.operation, new Map());
    byOperation.get(scenario.operation).set(row.seed, row.total);
  }
  const deltas = [];
  for (const [group, byOperation] of groups) {
    const operations = [...byOperation.keys()];
    const baseline = operations[0];
    for (const operation of operations.slice(1)) {
      const pairs = [...byOperation.get(baseline).keys()]
        .filter(seed => byOperation.get(operation).has(seed));
      if (!pairs.length) continue;
      const diffs = pairs.map(seed => byOperation.get(operation).get(seed) - byOperation.get(baseline).get(seed));
      deltas.push({ group, from: baseline, to: operation, runs: pairs.length,
        meanDelta: diffs.reduce((sum, v) => sum + v, 0) / diffs.length });
    }
  }
  return deltas;
}

const fmt = value => value === null || value === undefined ? "—" : Number(value).toFixed(2);

/** 集計結果を Markdown 表へ整形する。試行数と操作条件の定義を表に添える。 */
export function measurementMarkdown(summary, deltas = [], { seeds = [] } = {}) {
  const lines = [
    "| シナリオ | 試行 | 平均 | 最小 | 中央 | 最大 | 上限到達率（工程順） | 順位分布 |",
    "|---|---:|---:|---:|---:|---:|---|---|",
  ];
  for (const row of summary) {
    const saturation = row.saturationRateByProcess.length
      ? row.saturationRateByProcess.map(rate => rate === null ? "—" : `${Math.round(rate * 100)}%`).join(" / ")
      : "—";
    const ranks = Object.entries(row.rankDistribution)
      .sort(([a], [b]) => a - b).map(([rank, count]) => `${rank}位×${count}`).join(" ");
    lines.push(`| ${row.scenarioId} | ${row.runs} | ${fmt(row.total.mean)} | ${fmt(row.total.min)} | ${fmt(row.total.median)} | ${fmt(row.total.max)} | ${saturation} | ${ranks || "—"} |`);
  }
  for (const delta of deltas) {
    lines.push(`| ${delta.group}: ${delta.from}→${delta.to} の平均差 | ${delta.runs} | ${fmt(delta.meanDelta)} | | | | | |`);
  }
  lines.push("", `試行数: シナリオ×シード（シード ${seeds.join(", ") || "—"}）。操作条件はシナリオの operation（poor/mid/perfect）で定義し、対応比較は同じシード同士で取る。`);
  return lines.join("\n");
}

/**
 * 第3章の投票・順位計算を使うアダプター。
 * performanceOf(scenario, seed) がプレイヤーの出来を返す（数値、または
 * { rounds: [ラウンド別出来], processScores } ）。工程スコアの生成側はこの注入点へ
 * 実工程計算を接続する想定で、先行実装では未接続（呼び出し側が用意する）。
 * 試喫順・投票・同点処理は実物の buildTastingPlan 系／castVotes／standings を使う。
 */
export function createCh3TournamentEvaluate({ performanceOf } = {}) {
  if (typeof performanceOf !== "function") {
    throw new TypeError("第3章アダプターには performanceOf（工程スコア側の注入点）が必要です");
  }
  return (scenario, seed, { p }) => {
    const produced = performanceOf(scenario, seed);
    const quality = typeof produced === "number" ? produced : produced?.performance;
    const rounds = typeof produced === "object" && Array.isArray(produced?.rounds) ? produced.rounds : null;
    if (!Number.isFinite(quality) && !rounds) {
      throw new TypeError(`シナリオ ${scenario.id}: performanceOf が出来（数値）を返しませんでした`);
    }
    // 隔離した複製データ。プレイ中の state や保存領域には触れない。
    const value = { chapter: 3, day: 42, weatherSeed: seed >>> 0, flags: {} };
    const progress = startAttempt(value, { careHistory: [] });
    for (let round = 0; round < SPEND.length; round++) {
      const performance = rounds ? rounds[round] : quality;
      if (!castVotes(progress, round, performance, null, p)) {
        throw new Error(`シナリオ ${scenario.id}: 第${round + 1}ラウンドの投票が確定しませんでした`);
      }
    }
    const table = standings(progress);
    return {
      processScores: typeof produced === "object" ? produced?.processScores ?? null : null,
      total: rounds ? rounds[rounds.length - 1] : quality,
      rank: table.find(row => row.id === "hajime")?.rank ?? null,
      votes: Object.fromEntries(table.map(row => [row.id, row.points])),
    };
  };
}

const stats = n => Object.fromEntries(["technique", "sense", "guts", "charm", "insight"].map(key => [key, n]));

/**
 * 標準の掃引シナリオ。初期能力・途中段階・上限付近/最大・偏り、熟練度3段、
 * 操作3段の対応比較（group 指定）、装備/リハーサルの分離、周回・引き継ぎの比較を持つ。
 * 能力値そのものは計測条件の入力であり、引き継ぎ率や難易度係数の採用仕様ではない。
 */
export function defaultScenarios() {
  const scenarios = [];
  const profiles = [
    ["initial", stats(10)], ["mid", stats(55)], ["near-cap", stats(90)],
    ["max", stats(100)],
    ["skewed", { technique: 100, sense: 10, guts: 10, charm: 10, insight: 10 }],
  ];
  for (const [name, playStats] of profiles) {
    scenarios.push({ id: `ch3-stats-${name}`, chapter: 3, cycle: 1, carryStats: false,
      cycleStartStats: stats(10), playStats, mastery: .5, operation: "mid" });
  }
  for (const mastery of [0, .5, 1]) {
    scenarios.push({ id: `ch3-mastery-${mastery}`, chapter: 3, cycle: 1, carryStats: false,
      cycleStartStats: stats(10), playStats: stats(55), mastery, operation: "mid", group: "mastery" });
  }
  for (const operation of OPERATIONS) {
    scenarios.push({ id: `ch3-operation-${operation}`, chapter: 3, cycle: 1, carryStats: false,
      cycleStartStats: stats(10), playStats: stats(55), mastery: .5, operation, group: "operation" });
  }
  for (const [name, bonuses] of [["none", {}], ["equip", { equip: true }], ["rehearsal", { rehearsal: true }]]) {
    scenarios.push({ id: `ch3-bonus-${name}`, chapter: 3, cycle: 1, carryStats: false,
      cycleStartStats: stats(10), playStats: stats(55), mastery: .5, operation: "mid", bonuses, group: "bonus" });
  }
  for (const [name, cycle, carryStats] of [["cycle1", 1, false], ["cycle2-nocarry", 2, false],
    ["cycle2-carry", 2, true], ["cycle5-carry", 5, true]]) {
    scenarios.push({ id: `ch3-${name}`, chapter: 3, cycle, carryStats,
      cycleStartStats: stats(90), playStats: stats(90), mastery: .5, operation: "mid", group: "cycle" });
  }
  return scenarios;
}
