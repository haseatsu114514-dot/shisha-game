// 大会の救済の段（WIN13）。3回負けるごとに一段ずつ、針が遅く・判定が広くなる。ライバルの強さは変えない。
// 画面（retry-assist.js）と作業台の判定（common.js・holes.js・pull.js）が同じ段を読む。DOM に触れない。

export const RETRY_ASSIST_LOSSES_PER_LEVEL = 3;
export const RETRY_ASSIST_MAX_LEVEL = 4;

// 段ごとの倍率。0段は救済なし、1段目は導入時（#590）の値のまま。
// slow: 針の遅さ（温度のぶれも割る） / window: 炭・吸い出しの判定の広さ / holesGood: 穴あけの「良」の広さ / cool: 調整中の冷え方
export const RETRY_ASSIST_EFFECTS = Object.freeze([
  Object.freeze({ slow: 1, window: 1, holesGood: 1, cool: 1 }),
  Object.freeze({ slow: 1.35, window: 1.5, holesGood: 1.35, cool: .55 }),
  Object.freeze({ slow: 1.8, window: 2.2, holesGood: 1.8, cool: .4 }),
  Object.freeze({ slow: 2.4, window: 3, holesGood: 2.4, cool: .3 }),
  Object.freeze({ slow: 3.2, window: 4, holesGood: 3.2, cool: .2 }),
]);

/** 負けた回数から、次に選べる救済の段（3敗で1段目・6敗で2段目・9敗で3段目・12敗以上で4段目）。 */
export function retryAssistLevelFor(losses) {
  const count = Number.isFinite(losses) ? Math.max(0, Math.floor(losses)) : 0;
  return Math.min(RETRY_ASSIST_MAX_LEVEL, Math.floor(count / RETRY_ASSIST_LOSSES_PER_LEVEL));
}

/** その一台の救済の段。救済なしは0。段を持たない旧保存の救済は1段目として扱う。 */
export function assistLevelOf(cs) {
  if (cs?.retryAssist !== true) return 0;
  const level = cs.retryAssistLevel;
  return Number.isInteger(level) ? Math.min(RETRY_ASSIST_MAX_LEVEL, Math.max(1, level)) : 1;
}

/** その一台にかかる救済の倍率。 */
export const assistEffect = cs => RETRY_ASSIST_EFFECTS[assistLevelOf(cs)];

/** 作業台の上の札。1段目は導入時の文言のまま、2段目からは段を添える。 */
export function assistBenchNote(cs) {
  const level = assistLevelOf(cs);
  return level > 1 ? `今回のみ操作補助（${level}段目）` : "今回のみ操作補助";
}

/** 「今回だけ下げる」を選んだ挑戦の段。選んでいなければ0。選んだのに負けの記録が足りない旧保存は1段目。 */
export function chosenAssistLevel(tournament) {
  return tournament?.retryAssist === true ? Math.max(1, retryAssistLevelFor(tournament.losses)) : 0;
}
