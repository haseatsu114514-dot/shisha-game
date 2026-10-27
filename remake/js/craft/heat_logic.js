// 炭焼きの判定・性能・タイミング表示。判定と誤差を同じ取り出し時刻から求める。
// 炭は「かなり焼けた状態」から始め（見た目はもう赤い）、黒い面が消えて全面が赤くなり
// 薄い白い灰をまとう“取り頃”でタップして取る。早取り＝黒い面が残る（焼けムラ・えぐみ）で重め、
// 遅取り＝炭が小さく減り熱が落ちるだけなので軽め（現実でも焼きすぎで香りが飛ぶわけではない）。

/** 炭焼きの調整値はここに集約（数値は仮。オーナーが実プレイで調整する前提）。 */
export const HEAT_TUNING = {
  startBurn: 0.55,          // 開始時の焼け具合（見た目。0=真っ黒, 1=全面が赤い）。かなり焼けた状態から始める
  windowBase: 0.5,          // 取り出し窓（ジャスト帯）の基準の広さ（秒）。能力・体調・チュートリアルで変わる
  superiorTongBonus: 0.05,  // 上物トング（くじ景品）所持で窓へ加える秒。「取り頃が少し長くなる」効果
  earlyPenalty: { raw: 15, early: 45 }, // 早取りの得点（黒い面が残る＝重め）
  latePenalty: { hot: 80, over: 68 },   // 遅取りの得点（炭が減る・熱が落ちるだけ＝軽め）
};

export const HEAT_GRADES = {
  raw: { label: "生焼け", stamp: "黒い面だらけ", kind: "bad", score: HEAT_TUNING.earlyPenalty.raw, hp: -35, hs: -20, su: -30, br: -15, ar: 0 },
  early: { label: "焼けムラ", stamp: "黒い面残り", kind: "miss", score: HEAT_TUNING.earlyPenalty.early, hp: -20, hs: -10, su: -20, br: -15, ar: 10 },
  pre: { label: "焼け上がり前", stamp: "ほぼ全面赤", kind: "good", score: 78, hp: 0, hs: 12, su: -5, br: -8, ar: 14 },
  just: { label: "ジャスト", stamp: "全面が赤い", kind: "just", score: 100, hp: 20, hs: 30, su: 15, br: 0, ar: 15 },
  hot: { label: "ひと息遅れ", stamp: "灰をまとう", kind: "good", score: HEAT_TUNING.latePenalty.hot, hp: 10, hs: 6, su: 4, br: 8, ar: 0 },
  over: { label: "待ちすぎ", stamp: "炭が減る", kind: "bad", score: HEAT_TUNING.latePenalty.over, hp: -10, hs: -8, su: -10, br: 4, ar: -2 },
};

/** 旧goodsの正式名も保持。複数所持で重複せず、通常幅への加算は倍率計算後に1回だけ。 */
export function coalJustSeconds(windowMultiplier, tutorial = false, goods = []) {
  const superior = goods.some(good => good?.name === "ステンレストング（上物）");
  return HEAT_TUNING.windowBase * windowMultiplier * (tutorial ? 1.5 : 1) + (superior ? HEAT_TUNING.superiorTongBonus : 0);
}

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
