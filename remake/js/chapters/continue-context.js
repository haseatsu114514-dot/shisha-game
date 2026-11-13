import { ADVICE_PARTS } from "../craft/advice.js";

// 敗因・順位・工程の得点は、時間制限・短縮・連敗の記録（data-reason 等）にだけ使う。
// 2026-11-07 オーナー指示（#2524）: 台詞は敗因に絡めない。どの負け方でも台本の文をそのまま出す。
const REASON_KEYS = ["burnt", "cold", "leaf", "rank"];
const ordinal = n => Number.isInteger(n) && n > 0 ? n : 1;
export function normalizeContinueContext(context = {}) {
  context ||= {};
  const reason = REASON_KEYS.includes(context.reason) ? context.reason : "rank";
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
  // 2敗目以降は4行に短縮する。残す行は台本の short（スミさんは掛け合いの芯）、無ければ [0,2,5,6]。
  if (context.lossOrdinal >= 2) cues = (script.short || [0, 2, 5, 6])
    .map((index, i) => ({ ...cues[index], at: [0, 2.2, 4.6, 7][i] }));
  return { ...script, cues };
}
