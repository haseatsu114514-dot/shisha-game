// 第1章の新規試合。票は各工程の確定時に一度だけ記録し、結果表にも同じ記録を使う。
import { initialBaseVotes, baseVoteOf } from "../chapters/tournament-base-votes.js";
export const CH1_VOTE_VERSION = 2;
export const CH1_CONTESTANTS = ["naru", "adam", "minto", "hajime"];
export const CH1_JUDGES = ["maezono", "dr_kemuri", "sui"];
export const CH1_RIVALS = Object.freeze({
  naru: Object.freeze([84, 78, 93, 88, 87]),
  adam: Object.freeze([90, 92, 84, 80, 79]),
  minto: Object.freeze([76, 74, 80, 85, 86]),
});
export const CH1_WEIGHTS = Object.freeze({
  maezono: Object.freeze([15, 15, 30, 20, 20]),
  dr_kemuri: Object.freeze([20, 30, 10, 20, 20]),
  sui: Object.freeze([20, 20, 20, 20, 20]),
});
const SPEND = [2, 3, 2, 3];
const emptyVotes = () => Object.fromEntries(CH1_JUDGES.map(j => [j,
  Object.fromEntries(CH1_CONTESTANTS.map(id => [id, 0]))]));
const byId = (a, b) => CH1_CONTESTANTS.indexOf(a) - CH1_CONTESTANTS.indexOf(b);
export function beginCh1Votes(attempt) {
  if (attempt.voteAttempt) return attempt.voteAttempt;
  return attempt.voteAttempt = { rulesVersion: CH1_VOTE_VERSION, voted: 0, votes: emptyVotes(),
    baseVotes: initialBaseVotes(CH1_CONTESTANTS), finalVotes: null, result: null };
}
export function ch1Parts(cs, round) {
  const parts = [cs.holes?.skipped ? null : cs.holes?.score, cs.heat?.score,
    cs.stats?.craftQuality ?? cs.parts?.shisha, cs.careHistory?.[0]?.score, cs.careHistory?.[1]?.score];
  const limit = [2, 3, 4, 5][round];
  if (parts.slice(1, limit).some(n => !Number.isFinite(n))) throw new Error("第1章の工程成績が不足しています");
  if (parts[0] !== null && !Number.isFinite(parts[0])) throw new Error("第1章の穴あけ成績が不足しています");
  return parts;
}
function evaluated(parts, weights, limit) {
  let total = 0, weight = 0;
  for (let i = 0; i < limit; i++) if (Number.isFinite(parts[i])) {
    total += parts[i] * weights[i]; weight += weights[i];
  }
  return total / weight;
}
export function castCh1Votes(attempt, round, cs) {
  const p = beginCh1Votes(attempt);
  if (p.result || p.voted !== round || round < 0 || round > 3) return false;
  const mine = ch1Parts(cs, round), limit = [2, 3, 4, 5][round];
  for (const judge of CH1_JUDGES) {
    const expected = SPEND.slice(0, round).reduce((a, b) => a + b, 0) - (judge === "sui" && round > 3 ? 1 : 0);
    const spent = Object.values(p.votes[judge]).reduce((a, b) => a + b, 0);
    if (spent !== expected || spent + SPEND[round] - (judge === "sui" && round === 3 ? 1 : 0) > 10)
      throw new Error("第1章の持ち点が一致しません");
  }
  p.finalVotes = round === 3 ? emptyVotes() : null;
  for (const judge of CH1_JUDGES) {
    const weights = CH1_WEIGHTS[judge];
    const scores = Object.fromEntries(CH1_CONTESTANTS.map(id => [id,
      evaluated(id === "hajime" ? mine : CH1_RIVALS[id], weights, limit)]));
    const [first, second] = CH1_CONTESTANTS.slice().sort((a, b) => scores[b] - scores[a] || byId(a, b));
    const amount = SPEND[round] - (judge === "sui" && round === 3 ? 1 : 0);
    p.votes[judge][first] += amount - 1;
    p.votes[judge][second]++;
    if (round === 3) {
      p.finalVotes[judge][first] += amount - 1;
      p.finalVotes[judge][second]++;
    }
  }
  p.voted++;
  if (round === 3) {
    const last = CH1_CONTESTANTS.slice().sort((a, b) =>
      (b === "hajime" ? mine[4] : CH1_RIVALS[b][4]) - (a === "hajime" ? mine[4] : CH1_RIVALS[a][4]) || byId(a, b))[0];
    p.lastPoint = last;
    p.beforeLast = structuredClone(p.votes);
    p.votes.sui[last]++;
    p.finalVotes.sui[last]++;
    p.result = ch1Standings(p, cs.total);
  }
  return true;
}
export function ch1Standings(p, mineTotal) {
  const quality = Object.fromEntries(CH1_CONTESTANTS.map(id => [id, id === "hajime" ? mineTotal
    : CH1_RIVALS[id].reduce((a, b) => a + b, 0) / 5]));
  const points = id => baseVoteOf(p, id) + CH1_JUDGES.reduce((n, j) => n + p.votes[j][id], 0);
  const last = id => CH1_JUDGES.reduce((n, j) => n + (p.finalVotes?.[j]?.[id] || 0), 0);
  const rows = CH1_CONTESTANTS.slice().sort((a, b) => points(b) - points(a)
    || quality[b] - quality[a] || last(b) - last(a) || byId(a, b))
    .map((id, index) => ({ id, rank: index + 1, points: points(id) }));
  return { rank: rows.find(row => row.id === "hajime").rank, rows, votes: structuredClone(p.votes),
    baseVotes: structuredClone(p.baseVotes || {}), lastPoint: p.lastPoint };
}
