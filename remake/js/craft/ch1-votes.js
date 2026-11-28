// 第1章の新規試合。票は各工程の確定時に一度だけ記録し、結果表にも同じ記録を使う。
// 方式は2つ（core/vote-style.js）: いままで（rulesVersion 2・各回はそこまでの全工程の平均）と、
// 桜井式（rulesVersion 3・試作。各回はその回に仕上げた工程・提供時の制作ボーナス・攻めの帯の上積み）。
import { tournamentBallot } from "../chapters/tournament-ballot.js";
import { initialBaseVotes, baseVoteOf } from "../chapters/tournament-base-votes.js";
import { liftRivalScore, observeRivalScore } from "../core/ngplus-difficulty.js";
import { ATTACK_BAND } from "./attack-band.js";
export const CH1_VOTE_VERSION = 2;
export const CH1_SAKURAI_VERSION = 3;
export const CH1_CONTESTANTS = ["naru", "adam", "minto", "hajime"];
export const CH1_JUDGES = ["uezono", "dr_charcoal", "sensu"];
export const CH1_RIVALS = Object.freeze({
  naru: Object.freeze([84, 78, 93, 88, 87]),
  adam: Object.freeze([90, 92, 84, 80, 79]),
  minto: Object.freeze([76, 74, 80, 85, 86]),
});
export const CH1_WEIGHTS = Object.freeze({
  uezono: Object.freeze([15, 15, 30, 20, 20]),
  dr_charcoal: Object.freeze([20, 30, 10, 20, 20]),
  sensu: Object.freeze([20, 20, 20, 20, 20]),
});
const SPEND = [2, 3, 2, 3];
const emptyVotes = () => Object.fromEntries(CH1_JUDGES.map(j => [j,
  Object.fromEntries(CH1_CONTESTANTS.map(id => [id, 0]))]));
const byId = (a, b) => CH1_CONTESTANTS.indexOf(a) - CH1_CONTESTANTS.indexOf(b);
// 同じ評価点なら、はじめを先に置く。ライバル同士は出場順。
const voteTie = (a, b) => (b === "hajime") - (a === "hajime") || byId(a, b);

function liftCh1Rival(base, carryP) {
  // 桜井式には99を超える評価もある。持ち込みでその評価を下げない。
  const lifted = Math.max(base, liftRivalScore(base, carryP, 1));
  observeRivalScore(base, carryP, 1, lifted);
  return lifted;
}

/** style: "sakurai" で桜井式の試合を始める。それ以外（省略を含む）はいままでの審査。始めた後は方式を変えない。 */
export function beginCh1Votes(attempt, { style = null } = {}) {
  if (attempt.voteAttempt) return attempt.voteAttempt;
  const sakurai = style === "sakurai";
  return attempt.voteAttempt = { rulesVersion: sakurai ? CH1_SAKURAI_VERSION : CH1_VOTE_VERSION,
    comparisonBallot: true, picks: [], ...(sakurai ? { style: "sakurai", views: [], attacks: [] } : {}),
    voted: 0, votes: emptyVotes(), baseVotes: initialBaseVotes(CH1_CONTESTANTS), finalVotes: null, result: null };
}
export const isSakuraiVotes = (p) => p?.style === "sakurai" && p?.rulesVersion === CH1_SAKURAI_VERSION;
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
function checkBudget(p, round) {
  for (const judge of CH1_JUDGES) {
    const expected = SPEND.slice(0, round).reduce((a, b) => a + b, 0) - (judge === "sensu" && round > 3 ? 1 : 0);
    const spent = Object.values(p.votes[judge]).reduce((a, b) => a + b, 0);
    if (spent !== expected || spent + SPEND[round] - (judge === "sensu" && round === 3 ? 1 : 0) > 10)
      throw new Error("第1章の持ち点が一致しません");
  }
}
/**
 * 千須の最後の1点の入れ先。2回目の調整の出来ではなく、会長がもう一口吸った台へ入れる。
 * 物語では、はじめの一台が昔のスミさんの煙と同じ香り方をしていた（第4章で明かす）。配合・調整の出来によらず、
 * この1点を含めた総得票で1位ならクリア（2026-11-20 オーナー指示・#3916）。
 */
export const CH1_LAST_POINT = "hajime";
/** その回に審査員が入れる点。千須だけ最後の回は1点を残し、最後の1点に回す。 */
export const ch1RoundPoints = (judge, round) => SPEND[round] - (judge === "sensu" && round === 3 ? 1 : 0);
export function castCh1Votes(attempt, round, cs, { carryP = 0, serveBonus = 0 } = {}) {
  const p = beginCh1Votes(attempt);
  if (p.result || p.voted !== round || round < 0 || round > 3) return false;
  if (isSakuraiVotes(p)) return castSakurai(p, round, cs, carryP, serveBonus);
  const mine = ch1Parts(cs, round), limit = [2, 3, 4, 5][round];
  const bonus = round === 1 ? serveBonus : 0;
  checkBudget(p, round);
  p.finalVotes = round === 3 ? emptyVotes() : null;
  const picks = {};
  for (const [judgeIndex, judge] of CH1_JUDGES.entries()) {
    const weights = CH1_WEIGHTS[judge];
    const scores = Object.fromEntries(CH1_CONTESTANTS.map(id => [id, id === "hajime"
      ? evaluated(mine, weights, limit) + bonus : liftCh1Rival(evaluated(CH1_RIVALS[id], weights, limit), carryP)]));
    const [first, second] = tournamentBallot(
      CH1_CONTESTANTS, judgeIndex, round, id => scores[id], voteTie,
      p.comparisonBallot,
    );
    const amount = ch1RoundPoints(judge, round);
    picks[judge] = { first, second, points: { [first]: amount - 1, [second]: 1 } };
    p.votes[judge][first] += amount - 1;
    p.votes[judge][second]++;
    if (round === 3) {
      p.finalVotes[judge][first] += amount - 1;
      p.finalVotes[judge][second]++;
    }
  }
  (p.picks ||= [])[round] = picks;
  p.voted++;
  if (round === 3) {
    const last = CH1_LAST_POINT;
    p.lastPoint = last;
    p.beforeLast = structuredClone(p.votes);
    p.votes.sensu[last]++;
    p.finalVotes.sensu[last]++;
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

/** 最後の1点だけを外した順位。出来栄え・最終回の票も本来の同点判定に従う。 */
export function ch1BeforeLastStandings(p, mineTotal) {
  const id = p?.lastPoint;
  if (!id || !p.beforeLast || !(p.finalVotes?.sensu?.[id] > 0)) return null;
  const finalVotes = { ...p.finalVotes, sensu: { ...p.finalVotes.sensu, [id]: p.finalVotes.sensu[id] - 1 } };
  return ch1Standings({ ...p, votes: p.beforeLast, finalVotes }, mineTotal).rows;
}

// ---------------------------------------------------------------- 桜井式（試作・rulesVersion 3）
// 2026-11-13 オーナー「桜井式も作ってみて　なお気に入らなかったら戻せるようにはしといて」（SKR04）。
// 案は docs/reports/sakurai_review_20261113.md の柱1〜4（1回ごとの勝負・審査員の見る所・攻めの帯・ライバルの票田）。
// 持ち点（各10点を 2・3・2・3 点）・基礎票・千須の最後の1点（はじめへ）は、いままでと同じ。
// 数値は試作値。根拠（remake/tools/balance/measure.mjs --votes sakurai）は docs/master_spec.md の 2026-11-13 の節。
export const SAKURAI = Object.freeze({
  /** 攻めの帯で提供・調整を終えた回の上積み（その回の、はじめへの全審査員の評価に足す） */
  attackBonus: ATTACK_BAND.bonus,
  rounds: Object.freeze([
    Object.freeze({ id: "prep", label: "準備", parts: "穴あけと炭焼き" }),
    Object.freeze({ id: "serve", label: "提供", parts: "提供した一台" }),
    Object.freeze({ id: "care1", label: "調整1回目", parts: "1回目の調整" }),
    Object.freeze({ id: "care2", label: "調整2回目", parts: "2回目の調整" }),
  ]),
  /** 審査員の見る所（提供の回）。準備の回は今までの工程の重み（博士は炭を重く見る）、調整の回は全員がその調整の出来を見る */
  focus: Object.freeze({
    uezono: Object.freeze({ label: "味", detail: "香りと味" }),
    dr_charcoal: Object.freeze({ label: "火", detail: "熱の安定と焦げにくさ" }),
    sensu: Object.freeze({ label: "煙", detail: "煙の量と吸い心地" }),
  }),
  /** 提供の回: 完成品の内訳（score.js の computeShisha）と、提供した一口（吸い出しの点）の重み。safety は 100−焦げやすさ */
  serve: Object.freeze({
    uezono: Object.freeze({ aroma: .35, taste: .35, pull: .30 }),
    dr_charcoal: Object.freeze({ heatStability: .35, safety: .35, pull: .30 }),
    sensu: Object.freeze({ draw: .35, smoke: .35, pull: .30 }),
  }),
  /** ライバルの評価。準備の回は CH1_RIVALS の穴あけ・炭焼き。なる＝味、アダム＝火、みんと＝煙が強い。最後の調整は、なるが崩れず（100）、みんとが攻めてくる（101）。
   * 2026-11-20（#3916）: ふつうの腕前の勝率を約7割にするため、みんとの提供を各+1、なるの調整2回目を98→100にした */
  rivals: Object.freeze({
    serve: Object.freeze({
      naru: Object.freeze({ uezono: 84, dr_charcoal: 79, sensu: 80 }),
      adam: Object.freeze({ uezono: 78, dr_charcoal: 85, sensu: 78 }),
      minto: Object.freeze({ uezono: 80, dr_charcoal: 77, sensu: 85 }),
    }),
    care1: Object.freeze({ naru: 98, adam: 93, minto: 96 }),
    care2: Object.freeze({ naru: 99, adam: 92, minto: 100 }),
  }),
});
/** 途中経過に出す、その回の審査員の見る所（一語）。 */
export function sakuraiFocusOf(judge, round) {
  if (round === 0) return judge === "dr_charcoal" ? "炭を重く見る" : "穴と炭";
  if (round === 1) return SAKURAI.focus[judge]?.detail || "";
  return "調整の出来";
}
const round2 = (n) => Math.round(n * 100) / 100;
const finite = (n, message) => { if (!Number.isFinite(n)) throw new Error(message); return n; };
function prepView(parts, weights) {
  const used = [[parts[0], weights[0]], [parts[1], weights[1]]].filter(([n]) => Number.isFinite(n));
  return used.reduce((sum, [n, w]) => sum + n * w, 0) / used.reduce((sum, [, w]) => sum + w, 0);
}
/** その回に攻めの帯で終えたか（提供＝cs.pull、調整＝cs.careHistory） */
export function sakuraiAttack(cs, round) {
  const record = round === 1 ? cs?.pull : round >= 2 ? cs?.careHistory?.[round - 2] : null;
  return record?.attack === true && !record.failed;
}
/** はじめへの審査員ごとの評価（その回の工程と、提供時の制作ボーナス）。 */
export function sakuraiMine(cs, round, serveBonus = 0) {
  const attack = sakuraiAttack(cs, round) ? SAKURAI.attackBonus : 0;
  if (round === 0) {
    const holes = cs.holes?.skipped ? null : cs.holes?.score;
    if (holes !== null && holes !== undefined && !Number.isFinite(holes)) throw new Error("第1章の穴あけ成績が不足しています");
    const parts = [holes, finite(cs.heat?.score, "第1章の工程成績が不足しています")];
    return Object.fromEntries(CH1_JUDGES.map(j => [j, round2(prepView(parts, CH1_WEIGHTS[j]))]));
  }
  if (round === 1) {
    const s = cs.stats || {};
    const facets = { aroma: s.aroma, taste: s.taste, heatStability: s.heatStability,
      safety: Number.isFinite(s.burnRisk) ? 100 - s.burnRisk : NaN, draw: s.draw, smoke: s.smoke,
      pull: cs.pull?.score };
    return Object.fromEntries(CH1_JUDGES.map(j => [j, round2(Object.entries(SAKURAI.serve[j])
      .reduce((sum, [key, w]) => sum + finite(facets[key], "第1章の提供の成績が不足しています") * w, 0) + attack + serveBonus)]));
  }
  const care = finite(cs.careHistory?.[round - 2]?.score, "第1章の工程成績が不足しています");
  return Object.fromEntries(CH1_JUDGES.map(j => [j, round2(care + attack)]));
}
/** ライバルへの審査員ごとの評価（固定値）。 */
export function sakuraiRival(id, judge, round) {
  if (round === 0) return round2(prepView(CH1_RIVALS[id].slice(0, 2), CH1_WEIGHTS[judge]));
  if (round === 1) return SAKURAI.rivals.serve[id][judge];
  return SAKURAI.rivals[round === 2 ? "care1" : "care2"][id];
}
function castSakurai(p, round, cs, carryP, serveBonus) {
  const mine = sakuraiMine(cs, round, serveBonus);
  checkBudget(p, round);
  p.finalVotes = round === 3 ? emptyVotes() : null;
  const views = {}, picks = {};
  for (const [judgeIndex, judge] of CH1_JUDGES.entries()) {
    const scores = Object.fromEntries(CH1_CONTESTANTS.map(id => [id, id === "hajime"
      ? mine[judge] : liftCh1Rival(sakuraiRival(id, judge, round), carryP)]));
    const [first, second] = tournamentBallot(
      CH1_CONTESTANTS, judgeIndex, round, id => scores[id], voteTie,
      p.comparisonBallot,
    );
    const amount = ch1RoundPoints(judge, round);
    p.votes[judge][first] += amount - 1;
    p.votes[judge][second]++;
    if (round === 3) {
      p.finalVotes[judge][first] += amount - 1;
      p.finalVotes[judge][second]++;
    }
    views[judge] = scores;
    picks[judge] = { first, second, points: { [first]: amount - 1, [second]: 1 } };
  }
  p.views[round] = views;
  p.picks[round] = picks;
  p.attacks[round] = sakuraiAttack(cs, round);
  p.voted++;
  if (round === 3) {
    // 千須の最後の1点は、いままでの審査と同じく、もう一口吸った台（はじめ）へ（CH1_LAST_POINT）。
    const last = CH1_LAST_POINT;
    p.lastPoint = last;
    p.beforeLast = structuredClone(p.votes);
    p.votes.sensu[last]++;
    p.finalVotes.sensu[last]++;
    p.result = ch1Standings(p, cs.total);
  }
  return true;
}
