// 炭焼きの判定・性能・タイミング表示。判定と誤差を同じ取り出し時刻から求める。
export const HEAT_GRADES = {
  raw: { label: "生焼け", stamp: "CORE BLACK", kind: "bad", score: 15, hp: -35, hs: -20, su: -30, br: -15, ar: 0 },
  early: { label: "早取り", stamp: "CORE BLACK", kind: "miss", score: 45, hp: -20, hs: -10, su: -20, br: -15, ar: 10 },
  pre: { label: "適温前", stamp: "赤熱一閃", kind: "good", score: 78, hp: 0, hs: 12, su: -5, br: -8, ar: 14 },
  just: { label: "ジャスト", stamp: "JUST IGNITION!!", kind: "just", score: 100, hp: 20, hs: 30, su: 15, br: 0, ar: 15 },
  hot: { label: "攻め焼き", stamp: "HOT!", kind: "good", score: 62, hp: 30, hs: 4, su: 22, br: 18, ar: -8 },
  over: { label: "焼きすぎ", stamp: "OVER HEAT", kind: "bad", score: 28, hp: 35, hs: -10, su: 25, br: 30, ar: -20 },
};

/** 経過比 p（1.0 でジャスト開始）と、ジャストの幅 jw から既存の状態を返す */
export function phaseOf(p, jw) {
  if (p < 0.35) return "raw";
  if (p < 0.7) return "early";
  if (p < 1) return "pre";
  if (p < 1 + jw) return "just";
  if (p < 1.3 + jw) return "hot";
  return "over";
}

/** 理想は既存のジャスト判定帯の中央。体調・能力・チュートリアルの幅も共通で使う。 */
export function evaluateCoalTiming(elapsedSeconds, justStartSeconds, justSeconds) {
  const phase = phaseOf(elapsedSeconds / justStartSeconds, justSeconds / justStartSeconds);
  const idealSeconds = justStartSeconds + justSeconds / 2;
  const grade = HEAT_GRADES[phase];
  return {
    phase, elapsedSeconds, idealSeconds, errorSeconds: elapsedSeconds - idealSeconds,
    rating: phase === "just" ? "PERFECT" : grade.kind === "good" ? "GOOD" : "MISS",
    label: grade.label, score: grade.score,
  };
}

export function formatTimingError(errorSeconds) {
  const seconds = Math.abs(errorSeconds).toFixed(2);
  if (seconds === "0.00") return "0.00秒（ほぼ一致）";
  return `${seconds}秒${errorSeconds < 0 ? "早い" : "遅い"}`;
}

/** 精度は従来の炭焼きスコアそのもの。表示専用の別の採点を作らない。 */
export function summarizeCoalTimings(timings) {
  return {
    accuracy: Math.round(timings.reduce((sum, timing) => sum + timing.score, 0) / timings.length),
    meanAbsoluteError: timings.reduce((sum, timing) => sum + Math.abs(timing.errorSeconds), 0) / timings.length,
  };
}
