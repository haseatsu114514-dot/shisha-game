import { finishTournamentStep } from "./tournament-finish-step.js";
import { tournamentResources, restoreTournamentResources, recoverTournamentResources } from "./tournament-resource-snapshot.js";
import { ChapterSaveError } from "../core/chapter-save.js";
import { tournamentStandings } from "./tournament-standings.js";
import { initialBaseVotes } from "./tournament-base-votes.js";
import { liftRivalScore, observeRivalScore } from "../core/ngplus-difficulty.js";
// 第2章の保存境界と持ち点。第1章のstate.tournament/固定逆転票には触れない。
import { payTournamentPrize } from "./tournament-prize.js";

// 新規優勝のみ: 第1章50,000円／第2章100,000円／第3章200,000円／第4章500,000円／第5章は賞金なし。
export const CH2_PRIZE = 100000;
export const CONTESTANTS = ["hajime", "ageha", "kumicho", "kuraudo"];
export const JUDGES = ["uezono", "dr_charcoal", "sensu"];
export const SPEND = [2, 3, 2, 3];
// 章2の比較用の出来であり、キャラクターの能力値ではない。
// あげは83は上園の好み補正(+4)で87となり、神崎86・クラウド85（+1）を上回る（#1649）。上園の票には毎回あげはが強く出る。
// はじめが全審査員で1位を取る境目はチャコール博士の89（神崎86+3）。
// 2026-11-20（#3916・WIN10）: ふつうの腕前の優勝率を約6割にするため、3人とも77/80/78から+6した
// （`node remake/tools/balance/measure.mjs --chapter 2 --n 300 --seed 1`）。
export const RIVAL_QUALITY = { ageha: 83, kumicho: 86, kuraudo: 84 };

// 審査員の品質比重・好み比重の正本定義（qualityWeight + prefWeight = 1.0）。
// maxPrefDelta は設定パラメータではなく、BASE_PREF_SCALE * prefWeight から一意に導出する。
export const BASE_PREF_SCALE = 20;
export const JUDGE_PROFILES = Object.freeze({
  sensu: Object.freeze({ id: "sensu", label: "千須", qualityWeight: 0.90, prefWeight: 0.10 }),
  dr_charcoal: Object.freeze({ id: "dr_charcoal", label: "チャコール博士", qualityWeight: 0.85, prefWeight: 0.15 }),
  uezono: Object.freeze({ id: "uezono", label: "上園", qualityWeight: 0.78, prefWeight: 0.22 }),
});

const copy = value => JSON.parse(JSON.stringify(value));
const bounded = value => Math.max(0, Math.min(100, Number(value) || 0));
const boundedPref = value => Math.max(-1, Math.min(1, Number(value) || 0));

/** 審査員 j の最大好み振れ幅（派生値: BASE_PREF_SCALE * prefWeight） */
export function judgeMaxPrefDelta(judgeId, profiles = JUDGE_PROFILES) {
  const prof = profiles[judgeId] || JUDGE_PROFILES.sensu;
  return Math.round(BASE_PREF_SCALE * prof.prefWeight * 1000) / 1000;
}

/**
 * 審査員の最終評価点 S_j（正本式・1本化）。
 *   S_j = clamp(qualityWeight_j * Q + prefWeight_j * clamp(Q + BASE_PREF_SCALE * P_norm, 0, 100), 0, 100)
 * 0〜100 の内点では S_j = Q + (BASE_PREF_SCALE * prefWeight_j) * P_norm = Q + maxPrefDelta_j * P_norm に一致し、
 * 二重乗算や未使用パラメータを生まない。
 */
export function evaluateJudgeScore(judgeId, quality, prefNorm = 0, profiles = JUDGE_PROFILES) {
  const prof = profiles[judgeId] || JUDGE_PROFILES.sensu;
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
  const invalid = field => { throw new ChapterSaveError(2, "県大会の保存地点を確認できません", "_ch2_tournament." + field); };
  if (p.version !== 1) invalid("version");
  if (!Number.isInteger(p.step) || p.step < 0 || p.step > 11) invalid("step");
  if (!Array.isArray(p.history)) invalid("history");
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
    baseVotes: initialBaseVotes(CONTESTANTS), voted: 0, lastVotes: null, roundVotes: [], result: null, failure: null });
  value.phase = "tournament";
  return p;
}
export function recoverStep(value) {
  const p = tournamentProgress(value);
  return recoverTournamentResources(value, p);
}
export function beginStep(value) {
  const p = tournamentProgress(value);
  p.rollback = resources(value);
  return copy(p.craft);
}
export function finishStep(value, craft) {
  const p = tournamentProgress(value);
  return finishTournamentStep(p, craft);
}

/** 1回投入した点は保存後も戻らない。各審査員の累計を常に10以内にする。 */
export function castVotes(p, round, performance, prefByJudge = null, carryP = 0) {
  if (round !== p.voted || round < 0 || round >= SPEND.length) return false;
  const quality = Object.fromEntries(Object.entries(RIVAL_QUALITY).map(([id, base]) => {
    const lifted = liftRivalScore(base, carryP, 2);
    observeRivalScore(base, carryP, 2, lifted);
    return [id, lifted];
  }));
  quality.hajime = bounded(performance);
  const lastVotes = {};
  for (const judge of JUDGES) {
    const bias = judge === "uezono" ? { ageha: 4, kuraudo: 1 }
      : judge === "dr_charcoal" ? { kumicho: 3 } : { kuraudo: 3 };
    const hajimeScore = prefByJudge && judge in prefByJudge
      ? evaluateJudgeScore(judge, quality.hajime, prefByJudge[judge])
      : quality.hajime;
    const scoreOf = (c) => (c === "hajime" ? hajimeScore : quality[c]) + (bias[c] || 0);
    const order = CONTESTANTS.slice().sort((a, b) =>
      scoreOf(b) - scoreOf(a) || a.localeCompare(b));
    const amount = SPEND[round], row = p.votes?.[judge];
    if (!row) throw new ChapterSaveError(2, "審査員の持ち点が不足しています", "_ch2_tournament.votes." + judge);
    const available = 10 - Object.values(row).reduce((sum, n) => sum + n, 0);
    if (available < amount) throw new ChapterSaveError(2, "審査員の持ち点が不足しています", "_ch2_tournament.votes." + judge);
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
  (p.roundVotes ||= [])[round] = lastVotes;
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
  if (p.voted !== 4 || p.craft?.careHistory?.length !== 2)
    throw new ChapterSaveError(2, "提供と2回の調整が未完了です", "_ch2_tournament.voted / craft.careHistory");
  const rows = standings(p);
  p.result = { attempt: p.attempts, total, rank: rows.find(row => row.id === "hajime").rank,
    rows, votes: copy(p.votes), baseVotes: copy(p.baseVotes || {}), careHistory: copy(p.craft.careHistory) };
  // 賞金は優勝の確定と同じ更新で一度だけ渡す（再挑戦・LOADで二重に付けない）。
  payTournamentPrize(value, p, p.result.rank, CH2_PRIZE);
  p.history.push(copy(p.result));
  return p.result;
}

