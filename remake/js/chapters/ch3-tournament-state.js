import { MAX_MONEY } from "../core/rules.js";
import { liftRivalScore, observeRivalScore } from "../core/ngplus-difficulty.js";

// 大会賞金（2026-10-30 決定の階段式: 第1章30,000円／第2章50,000円／第3章100,000円／第4章200,000円／第5章は賞金なし）。
export const CH3_PRIZE = 100000;

// HAZE: NATIONAL TOKYO。県大会とは別の一試合・一台・四人同時の保存状態。
export const CONTESTANTS = Object.freeze(["hajime", "kuze", "steve", "volk"]);
export const JUDGES = Object.freeze(["emil", "dr_kemuri", "nagumo"]);
export const SPEND = Object.freeze([2, 3, 2, 3]);
// 第2章より高い全国出場者の基準値。はじめの値は実際の制作成績で上書きする。
export const RIVAL_QUALITY = Object.freeze({ kuze: 82, steve: 80, volk: 84 });

// 柑橘への好みと、直後の一口との比較は別。南雲は台本どおり水を飲む。
export const JUDGE_PROFILES = Object.freeze({
  emil: Object.freeze({ prefWeight: 0.20, citrus: -1, contrast: -2, waterChance: 0.25 }),
  dr_kemuri: Object.freeze({ prefWeight: 0.15, citrus: 2, contrast: 2, waterChance: 0.50 }),
  nagumo: Object.freeze({ prefWeight: 0.10, citrus: 0, contrast: -1, waterChance: 1 }),
});

const copy = value => JSON.parse(JSON.stringify(value));
const bounded = value => Math.max(0, Math.min(100, Number(value) || 0));
const boundedPref = value => Math.max(-1, Math.min(1, Number(value) || 0));
const initialVotes = () => Object.fromEntries(JUDGES.map(judge =>
  [judge, Object.fromEntries(CONTESTANTS.map(id => [id, 0]))]));

function rngFrom(seed) {
  let value = (seed >>> 0) || 0x9e3779b9;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x100000000;
  };
}

/** 挑戦ごとに一度だけ決めて保存する試喫順。久世は先を狙うが確定はしない。 */
export function buildTastingPlan(seed) {
  const random = rngFrom(seed);
  return SPEND.map(() => Object.fromEntries(JUDGES.map(judge => {
    const order = [...CONTESTANTS];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order[0] !== "kuze" && random() < 0.4) {
      const index = order.indexOf("kuze");
      [order[0], order[index]] = [order[index], order[0]];
    }
    const waterAfterKuze = random() < JUDGE_PROFILES[judge].waterChance;
    return [judge, { order, waterAfterKuze }];
  })));
}

/** メニュー・中断読込・再戦で同じ県大会や第1章の記録へ触れない。 */
export function tournamentProgress(value) {
  if (value?.chapter !== 3) throw new Error("第3章の保存ではありません");
  const p = value.flags._ch3_tournament ||= {
    version: 1, stage: "entry", attempts: 0, step: 0, craft: null, rollback: null,
    votes: {}, voted: 0, result: null, history: [], entry: null, prizePaid: false,
    tastingSeed: null, tastingPlan: null,
  };
  if (p.version !== 1 || !Number.isInteger(p.step) || p.step < 0 || p.step > 11
    || !Number.isInteger(p.voted) || p.voted < 0 || p.voted > SPEND.length
    || !Array.isArray(p.history)) throw new Error("全国大会の保存地点を確認できません");
  return p;
}

export function resources(value) {
  return copy({ flavorStock: value.flavorStock, stamina: value.stamina,
    equip: value.equip, recipes: value.recipes, stats: value.stats });
}

export function restoreResources(value, snapshot) {
  for (const [key, data] of Object.entries(copy(snapshot))) value[key] = data;
}

/** 開始資源を一度捕まえ、失敗した一台の消費だけを戻す。 */
export function startAttempt(value, craft) {
  const p = tournamentProgress(value);
  if (p.stage === "craft") return p; // 二度押しで一台を作り直さない
  if (!["entry", "ready", "defeat"].includes(p.stage)) throw new Error("現在の保存地点から再挑戦できません");
  if (!p.entry) p.entry = resources(value);
  restoreResources(value, p.entry);
  p.attempts++;
  const seed = ((Number(value.weatherSeed) >>> 0) ^ Math.imul(Number(value.day) || 1, 0x9e3779b1)
    ^ Math.imul(p.attempts, 0x85ebca6b)) >>> 0;
  Object.assign(p, {
    stage: "craft", step: 0, craft: copy(craft), rollback: null,
    votes: initialVotes(), voted: 0, lastVotes: null, result: null, failure: null, defeatRead: false,
    tastingSeed: seed, tastingPlan: buildTastingPlan(seed),
  });
  value.phase = "tournament";
  return p;
}

/** 工程の途中で保存された消費だけ巻き戻す。確定済み工程はそのまま。 */
export function recoverStep(value) {
  const p = tournamentProgress(value);
  if (p.rollback) { restoreResources(value, p.rollback); p.rollback = null; }
  return p;
}

export function beginStep(value) {
  const p = tournamentProgress(value);
  if (p.stage !== "craft" || p.step >= 11) throw new Error("制作工程の保存地点を確認できません");
  p.rollback ||= resources(value);
  return copy(p.craft);
}

export function finishStep(value, craft) {
  const p = tournamentProgress(value);
  if (p.stage !== "craft" || p.step >= 11) throw new Error("制作工程の保存地点を確認できません");
  p.craft = copy(craft);
  p.rollback = null;
  if (craft.failed) { p.stage = "defeat"; p.failure = craft.failed; }
  else p.step++;
  return p;
}

/** 久世の直後の一口だけが、無給水なら比較される。相手と符号は審査員ごとに違う。 */
export function tastingEffect(plan, judge) {
  const order = plan?.order;
  const profile = JUDGE_PROFILES[judge];
  if (!profile || !Array.isArray(order) || order.length !== CONTESTANTS.length
    || new Set(order).size !== CONTESTANTS.length || order.some(id => !CONTESTANTS.includes(id))) {
    throw new Error("試喫順を確認できません");
  }
  const next = order[order.indexOf("kuze") + 1] || null;
  const affected = next && plan.waterAfterKuze !== true ? next : null;
  return { order: [...order], waterAfterKuze: plan.waterAfterKuze === true,
    affected, delta: affected ? profile.contrast : 0 };
}

/** 各審査員の一回分をまとめて確定し、持ち点の二重投入を防ぐ。 */
export function castVotes(p, round, performance, prefByJudge = null, carryP = 0) {
  if (!p || p.result || round !== p.voted || round < 0 || round >= SPEND.length) return false;
  const plan = p.tastingPlan?.[round];
  if (!plan) throw new Error("試喫順を確認できません");
  const quality = Object.fromEntries(Object.entries(RIVAL_QUALITY).map(([id, rival]) => {
    const lifted = liftRivalScore(rival, carryP, 3);
    observeRivalScore(rival, carryP, 3, lifted);
    return [id, lifted];
  }));
  quality.hajime = bounded(performance);
  const additions = {};
  for (const judge of JUDGES) {
    const profile = JUDGE_PROFILES[judge], row = p.votes?.[judge];
    if (!row || CONTESTANTS.some(id => !Number.isInteger(row[id]) || row[id] < 0)
      || CONTESTANTS.reduce((sum, id) => sum + row[id], 0) + SPEND[round] > 10) {
      throw new Error("審査員の持ち点が不足しています");
    }
    // 最初の票は吸い出し・提供前の手元評価。残り香は一口目以降だけ効く。
    const tactic = round === 0 ? null : tastingEffect(plan[judge], judge);
    const scoreOf = id => {
      const pref = id === "hajime" ? boundedPref(prefByJudge?.[judge]) : 0;
      const citrus = id === "kuze" ? profile.citrus : 0;
      const contrast = id === tactic?.affected ? tactic.delta : 0;
      return bounded(quality[id] + 20 * profile.prefWeight * pref + citrus + contrast);
    };
    const order = [...CONTESTANTS].sort((a, b) => scoreOf(b) - scoreOf(a) || a.localeCompare(b));
    const [first, second] = order;
    additions[judge] = { first, second, points: { [first]: SPEND[round] - 1, [second]: 1 }, tactic };
  }
  for (const judge of JUDGES) {
    const { points } = additions[judge];
    for (const [id, amount] of Object.entries(points)) p.votes[judge][id] += amount;
  }
  p.lastVotes = additions;
  p.voted++;
  p.quality = quality;
  return true;
}

export function standings(p) {
  const points = Object.fromEntries(CONTESTANTS.map(id => [id,
    JUDGES.reduce((sum, judge) => sum + (p.votes[judge]?.[id] || 0), 0)]));
  return [...CONTESTANTS].sort((a, b) => points[b] - points[a]
    || (p.quality?.[b] || 0) - (p.quality?.[a] || 0) || a.localeCompare(b))
    .map((id, index) => ({ id, rank: index + 1, points: points[id] }));
}

/** 実際の制作・二度の調整と全投票が揃うまで結果を確定しない。 */
export function recordResult(value, total) {
  const p = tournamentProgress(value);
  if (p.result) return p.result;
  if (p.voted !== SPEND.length || p.step !== 11 || p.craft?.careHistory?.length !== 2
    || p.craft.failed) throw new Error("提供と2回の調整が未完了です");
  const rows = standings(p), rank = rows.find(row => row.id === "hajime").rank;
  p.result = { attempt: p.attempts, total, rank, win: rank === 1,
    rows, votes: copy(p.votes), careHistory: copy(p.craft.careHistory),
    tastingPlan: copy(p.tastingPlan) };
  // 賞金は優勝の確定と同じ更新で一度だけ渡す（再挑戦・LOADで二重に付けない）。
  if (rank === 1 && !p.prizePaid) {
    p.prizePaid = true;
    value.money = Math.min(MAX_MONEY, Math.max(0, Math.round((value.money || 0) + CH3_PRIZE)));
  }
  p.history.push(copy(p.result));
  return p.result;
}
