import { ADVICE_PARTS, weakestPart } from "../craft/advice.js";

const REASONS = {
  burnt: ["……熱が入りすぎたな", "次は『下げ吸い』で逃がすぞ", "次は上げる前に、煙の色と舌を確かめよう"],
  cold: ["……冷え切っちまったか", "次は冷える前に、炭を替えよう", "炭を替えるタイミングを早めよう"],
  leaf: ["……香りが抜けちまったな", "次は吸う前に、葉の残りを見ろ", "次は吸い直す前に、葉を見よう"],
  rank: ["……届かなかったか", "なら、次は一つだけ変えてみよう", "変えるのは一つでいい。比べてみよう"],
};
const TIPS = {
  holes: "次は、目印に合わせて穴を開けよう", heat: "次は、炭の全面が赤くなる頃合いを見ろ",
  shisha: "次は、配合と提供時の温度を見よう", care1: "次は、一度目の交換数を見直すぞ",
  care2: "次は、二度目まで葉を残そう",
};
const ordinal = n => Number.isInteger(n) && n > 0 ? n : 1;
export function normalizeContinueContext(context = {}) {
  context ||= {};
  const reason = Object.hasOwn(REASONS, context.reason) ? context.reason : "rank";
  const completedParts = ADVICE_PARTS.filter(key => Array.isArray(context.completedParts) && context.completedParts.includes(key)
    && Number.isFinite(context.parts?.[key]));
  return Object.freeze({ chapter: context.chapter, reason,
    rank: Number.isInteger(context.rank) && context.rank > 0 && context.rank <= 4 ? context.rank : null,
    phase: typeof context.phase === "string" ? context.phase : null,
    parts: Object.freeze(Object.fromEntries(completedParts.map(key => [key, context.parts[key]]))),
    completedParts: Object.freeze(completedParts), lossOrdinal: ordinal(context.lossOrdinal),
    sameReasonOrdinal: ordinal(context.sameReasonOrdinal) });
}

/** 読取用の値だけを渡す。工程途中のfinalizeは欠けた得点を0にするので呼ばない。 */
export function craftContinueContext(cs, extra = {}) {
  const parts = {};
  if (Number.isFinite(cs?.holes?.score)) parts.holes = cs.holes.score;
  if (Number.isFinite(cs?.heat?.score)) parts.heat = cs.heat.score;
  if (cs?.pull && Number.isFinite(cs?.parts?.shisha)) parts.shisha = cs.parts.shisha;
  for (let i = 0; i < 2; i++) if (Number.isFinite(cs?.careHistory?.[i]?.score)) parts[`care${i + 1}`] = cs.careHistory[i].score;
  return normalizeContinueContext({ ...extra, parts, completedParts: Object.keys(parts) });
}

// セッション専用。state＋大会で区切り、同じ試行の再描画やLOAD後の新ownerで数え直さない。
const histories = new WeakMap();
export function recordContinueContext(owner, checkpoint, attempt, context) {
  let matches = histories.get(owner);
  if (!matches) histories.set(owner, matches = new Map());
  let history = matches.get(checkpoint);
  if (!history) matches.set(checkpoint, history = { count: 0, reasons: {}, attempt: null, context: null });
  if (history.context && history.attempt === attempt) return history.context;
  const reason = normalizeContinueContext(context).reason;
  history.attempt = attempt;
  history.context = normalizeContinueContext({ ...context, lossOrdinal: ++history.count,
    sameReasonOrdinal: history.reasons[reason] = (history.reasons[reason] || 0) + 1 });
  return history.context;
}
export function clearContinueHistory(owner) { histories.delete(owner); }

export function prepareContinueScript(script, context) {
  let cues = script.cues.map(cue => ({ ...cue }));
  if (!script.speaker) {
    const lines = REASONS[context.reason];
    cues[0].text = context.reason === "rank" && context.rank ? `……${context.rank}位か。悔しいな` : lines[0];
    cues[1].text = context.sameReasonOrdinal >= 2 ? lines[2]
      : context.reason === "rank" ? TIPS[weakestPart(context.parts, context.completedParts)] || lines[1] : lines[1];
  }
  if (context.lossOrdinal >= 2) cues = (script.speaker ? [0, 2, 5, 6] : [0, 1, 5, 6])
    .map((index, i) => ({ ...cues[index], at: [0, 2.2, 4.6, 7][i] }));
  return { ...script, cues };
}
