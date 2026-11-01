import { tournamentResources, restoreTournamentResources } from "./tournament-resource-snapshot.js";
import { tournamentStandings } from "./tournament-standings.js";
// 第2章の保存境界と持ち点。第1章のstate.tournament/固定逆転票には触れない。
import { MAX_MONEY } from "../core/rules.js";

// 大会賞金（2026-10-30 決定の階段式: 第1章30,000円／第2章50,000円／第3章100,000円／第4章200,000円／第5章は賞金なし）。
export const CH2_PRIZE = 50000;
export const CONTESTANTS = ["hajime", "ageha", "kumicho", "rei"];
export const JUDGES = ["maezono", "dr_kemuri", "nagumo"];
export const SPEND = [2, 3, 2, 3];
// 初期調整値。章2の比較用の出来であり、キャラクターの能力値ではない。
// あげは77は上園の好み補正(+4)で81となり、神崎80・REI79を上回る（#1649）。はじめがどの出来でも
// 上園の上位2人に入り、毎回の票に強さが出る。はじめの全審査員1位の境目（チャコール博士の83）は変えない。
export const RIVAL_QUALITY = { ageha: 77, kumicho: 80, rei: 78 };

// 審査員の品質比重・好み比重の正本定義（qualityWeight + prefWeight = 1.0）。
// maxPrefDelta は設定パラメータではなく、BASE_PREF_SCALE * prefWeight から一意に導出する。
export const BASE_PREF_SCALE = 20;
export const JUDGE_PROFILES = Object.freeze({
  nagumo: Object.freeze({ id: "nagumo", label: "南雲", qualityWeight: 0.90, prefWeight: 0.10 }),
  dr_kemuri: Object.freeze({ id: "dr_kemuri", label: "チャコール博士", qualityWeight: 0.85, prefWeight: 0.15 }),
  maezono: Object.freeze({ id: "maezono", label: "上園", qualityWeight: 0.78, prefWeight: 0.22 }),
});

const copy = value => JSON.parse(JSON.stringify(value));
const bounded = value => Math.max(0, Math.min(100, Number(value) || 0));
const boundedPref = value => Math.max(-1, Math.min(1, Number(value) || 0));

/** 審査員 j の最大好み振れ幅（派生値: BASE_PREF_SCALE * prefWeight） */
export function judgeMaxPrefDelta(judgeId, profiles = JUDGE_PROFILES) {
  const prof = profiles[judgeId] || JUDGE_PROFILES.nagumo;
  return Math.round(BASE_PREF_SCALE * prof.prefWeight * 1000) / 1000;
}

/**
 * 審査員の最終評価点 S_j（正本式・1本化）。
 *   S_j = clamp(qualityWeight_j * Q + prefWeight_j * clamp(Q + BASE_PREF_SCALE * P_norm, 0, 100), 0, 100)
 * 0〜100 の内点では S_j = Q + (BASE_PREF_SCALE * prefWeight_j) * P_norm = Q + maxPrefDelta_j * P_norm に一致し、
 * 二重乗算や未使用パラメータを生まない。
 */
export function evaluateJudgeScore(judgeId, quality, prefNorm = 0, profiles = JUDGE_PROFILES) {
  const prof = profiles[judgeId] || JUDGE_PROFILES.nagumo;
  const q = bounded(quality);
  const p = boundedPref(prefNorm);
  const prefAdjusted = bounded(q + BASE_PREF_SCALE * p);
  const score = bounded(prof.qualityWeight * q + prof.prefWeight * prefAdjusted);
  return Math.round(score * 100) / 100;
}

export function tournamentProgress(value) {
  if (value.chapter !== 2) throw new Error("第2章の保存ではありません");
  const p = value.flags._ch2_tournament ||= {
    version: 1, stage: "entry", attempts: 0, step: 0, craft: null, rollback: null,
    votes: {}, voted: 0, result: null, history: [], entry: null, prizePaid: false,
  };
  if (p.version !== 1 || !Number.isInteger(p.step) || p.step < 0 || p.step > 11
    || !Array.isArray(p.history)) throw new Error("県大会の保存地点を確認できません");
  return p;
}

export function resources(value) {
  return tournamentResources(value);
}
export function restoreResources(value, snapshot) {
  restoreTournamentResources(value, snapshot);
}
export function startAttempt(value, craft) {
  const p = tournamentProgress(value);
  if (!p.entry) p.entry = resources(value);
  restoreResources(value, p.entry);
  p.attempts++;
  Object.assign(p, { stage: "craft", step: 0, craft: copy(craft), rollback: null,
    votes: Object.fromEntries(JUDGES.map(id => [id, Object.fromEntries(CONTESTANTS.map(c => [c, 0]))])),
    voted: 0, result: null, failure: null });
  value.phase = "tournament";
  return p;
}
export function recoverStep(value) {
  const p = tournamentProgress(value);
  if (p.rollback) { restoreResources(value, p.rollback); p.rollback = null; }
  return p;
}
export function beginStep(value) {
  const p = tournamentProgress(value);
  p.rollback = resources(value);
  return copy(p.craft);
}
export function finishStep(value, craft) {
  const p = tournamentProgress(value);
  p.craft = copy(craft);
  p.rollback = null;
  if (craft.failed) { p.stage = "defeat"; p.failure = craft.failed; }
  else p.step++;
  return p;
}

/** 1回投入した点は保存後も戻らない。各審査員の累計を常に10以内にする。 */
export function castVotes(p, round, performance, prefByJudge = null) {
  if (round !== p.voted || round < 0 || round >= SPEND.length) return false;
  const quality = { ...RIVAL_QUALITY, hajime: bounded(performance) };
  const lastVotes = {};
  for (const judge of JUDGES) {
    const bias = judge === "maezono" ? { ageha: 4, rei: 1 }
      : judge === "dr_kemuri" ? { kumicho: 3 } : { rei: 3 };
    const hajimeScore = prefByJudge && judge in prefByJudge
      ? evaluateJudgeScore(judge, quality.hajime, prefByJudge[judge])
      : quality.hajime;
    const scoreOf = (c) => (c === "hajime" ? hajimeScore : quality[c]) + (bias[c] || 0);
    const order = CONTESTANTS.slice().sort((a, b) =>
      scoreOf(b) - scoreOf(a) || a.localeCompare(b));
    const amount = SPEND[round], row = p.votes[judge];
    const available = 10 - Object.values(row).reduce((sum, n) => sum + n, 0);
    if (available < amount) throw new Error("審査員の持ち点が不足しています");
    // 表示専用（#909）。この回に誰へ何点入れたか。得点・順位の計算には使わない。
    lastVotes[judge] = { first: order[0], second: order[1], points: { [order[0]]: amount - 1, [order[1]]: 1 } };
  }
  // 全審査員の持ち点を確認できてから、この一回分をまとめて確定する。
  for (const judge of JUDGES) {
    const { first, second } = lastVotes[judge], row = p.votes[judge];
    row[first] += SPEND[round] - 1;
    row[second]++;
  }
  p.lastVotes = lastVotes;
  p.voted++;
  p.quality = quality;
  return true;
}
export function standings(p) {
  return tournamentStandings(p, CONTESTANTS, JUDGES);
}
export function recordResult(value, total) {
  const p = tournamentProgress(value);
  if (p.result) return p.result;
  if (p.voted !== 4 || p.craft?.careHistory?.length !== 2) throw new Error("提供と2回の調整が未完了です");
  const rows = standings(p);
  p.result = { attempt: p.attempts, total, rank: rows.find(row => row.id === "hajime").rank,
    rows, votes: copy(p.votes), careHistory: copy(p.craft.careHistory) };
  // 賞金は優勝の確定と同じ更新で一度だけ渡す（再挑戦・LOADで二重に付けない）。
  if (p.result.rank === 1 && !p.prizePaid) {
    p.prizePaid = true;
    value.money = Math.min(MAX_MONEY, Math.max(0, Math.round((value.money || 0) + CH2_PRIZE)));
  }
  p.history.push(copy(p.result));
  return p.result;
}
