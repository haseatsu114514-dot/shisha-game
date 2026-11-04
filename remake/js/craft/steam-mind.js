// 蒸らし弾幕の心の状態（#2519）。舞台の重圧・直前の炭・救済・被弾・斬った言葉から緊張を出す。
// 演出（心拍線・色・視界・表情・結果の一行）だけに使い、採点・温度・当たり判定へは渡さない。

/** 落ち着いている順。無心は導入前の3段（平静／ざわつく／動揺）の上に足した段。 */
export const MIND_LEVELS = Object.freeze(["clear", "steady", "unsteady", "shaken"]);
export const MIND_LABELS = Object.freeze({ clear: "無心", steady: "平静", unsteady: "ざわつく", shaken: "動揺" });
// unsteady・shaken・shock・residue は導入前の心拍線と同じ値。重圧・無心・斬りの値は試行値。
export const MIND_TUNING = Object.freeze({
  unsteady: .25, shaken: .65, shockSeconds: 4, hitResidue: .025, residueCap: .2,
  settleSeconds: 10, pressureCap: .35, goodHeat: 85, badHeat: 60, goodHeatCalm: .05, badHeatStrain: .1, assistCalm: .05,
  clear: .05, clearAfter: 6, cutCalmSeconds: .3,
});

/** 舞台の重圧に、直前の炭の手応えと救済を足す。保存値を増やさず、その一台の値だけから決める。 */
export function mindPressure({ stagePressure = 0, heatScore = null, retryAssist = false } = {}) {
  const T = MIND_TUNING;
  let pressure = Number.isFinite(stagePressure) ? stagePressure : 0;
  if (Number.isFinite(heatScore)) pressure += heatScore >= T.goodHeat ? -T.goodHeatCalm : heatScore < T.badHeat ? T.badHeatStrain : 0;
  if (retryAssist) pressure -= T.assistCalm;
  return Math.max(0, Math.min(T.pressureCap, Math.round(pressure * 1000) / 1000));
}

export function mindLevelOf(tension, calmFor = 0) {
  const T = MIND_TUNING;
  return tension > T.shaken ? "shaken" : tension > T.unsteady ? "unsteady"
    : tension < T.clear && calmFor >= T.clearAfter ? "clear" : "steady";
}

/**
 * 一回の蒸らしの心。時刻はゲーム内の秒。
 * 重圧は被弾しない時間で薄れ、被弾するとよみがえる。重圧0なら導入前の心拍と同じ値になる。
 */
export function createMind(pressure = 0) {
  const T = MIND_TUNING;
  let calmSince = 0, lastHit = -Infinity, hits = 0;
  const tension = (time, shift = 0) => {
    const fade = Math.max(0, 1 - (time - calmSince + shift) / T.settleSeconds);
    // 被弾の衝撃＋残りは導入前の式のまま。残りも衝撃が引いたあと時間で消える（被弾前は0）。
    const struck = Math.max(0, 1 - (time - lastHit + shift) / T.shockSeconds + Math.min(T.residueCap, hits * T.hitResidue));
    return Math.max(0, Math.min(1, pressure * fade + struck));
  };
  const level = time => mindLevelOf(tension(time), time - calmSince);
  const calm = seconds => { if (seconds > 0) { calmSince -= seconds; lastHit -= seconds; } };
  return {
    get pressure() { return pressure; },
    get hits() { return hits; },
    tension, level, calm,
    hit(time) { hits++; calmSince = lastHit = time; return level(time); },
    /** 言葉を斬った数だけ落ち着く。 */
    cut(time, words) { calm(Math.max(0, words) * T.cutCalmSeconds); return level(time); },
    /** 根性のリフレッシュ回復。動揺→ざわつく、ざわつく→平静の、ちょうど1段だけ戻す。 */
    recoverStep(time) {
      const now = level(time);
      if (now !== "shaken" && now !== "unsteady") return now;
      const target = now === "shaken" ? .6 : .2;
      let lo = 0, hi = T.settleSeconds + T.shockSeconds;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (tension(time, mid) <= target) hi = mid; else lo = mid; }
      calm(hi);
      return level(time);
    },
  };
}
