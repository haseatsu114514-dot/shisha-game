// 大会の救済の難易度（WIN13）。3敗でイージー、6敗でベリーイージーも選べる。ライバルの強さは変えない。
// 画面（retry-assist.js）と作業台の判定（common.js・holes.js・pull.js）が同じ段を読む。DOM に触れない。

export const RETRY_ASSIST_LOSSES_PER_LEVEL = 3;
/** 0: ノーマル（救済なし）/ 1: イージー / 2: ベリーイージー */
export const RETRY_ASSIST_MAX_LEVEL = 2;
export const RETRY_ASSIST_NAMES = Object.freeze(["ノーマル", "イージー", "ベリーイージー"]);

// 段ごとの倍率。イージーは導入時（#590）の値のまま。
// slow: 針の遅さ（温度のぶれも割る） / window: 炭・吸い出しの判定の広さ / holesGood: 穴あけの「良」の広さ / cool: 調整中の冷え方
export const RETRY_ASSIST_EFFECTS = Object.freeze([
  Object.freeze({ slow: 1, window: 1, holesGood: 1, cool: 1 }),
  Object.freeze({ slow: 1.35, window: 1.5, holesGood: 1.35, cool: .55 }),
  Object.freeze({ slow: 3.2, window: 4, holesGood: 3.2, cool: .2 }),
]);

/** 負けた回数から、選べるいちばんやさしい段（3敗でイージー・6敗以上でベリーイージー）。 */
export function retryAssistLevelFor(losses) {
  const count = Number.isFinite(losses) ? Math.max(0, Math.floor(losses)) : 0;
  return Math.min(RETRY_ASSIST_MAX_LEVEL, Math.floor(count / RETRY_ASSIST_LOSSES_PER_LEVEL));
}

const clampLevel = level => Math.min(RETRY_ASSIST_MAX_LEVEL, Math.max(1, level));

/** その一台の救済の段。救済なしは0。段を持たない旧保存の救済はイージーとして扱う。 */
export function assistLevelOf(cs) {
  if (cs?.retryAssist !== true) return 0;
  const level = cs.retryAssistLevel;
  return Number.isInteger(level) ? clampLevel(level) : 1;
}

/** その一台にかかる救済の倍率。 */
export const assistEffect = cs => RETRY_ASSIST_EFFECTS[assistLevelOf(cs)];

/** 作業台の上の札。 */
export const assistBenchNote = cs => `今回のみ${RETRY_ASSIST_NAMES[assistLevelOf(cs)]}`;

/** 難易度を下げると選んだ挑戦の段。選んでいなければ0。段を持たない旧保存（イージーしか無かった頃）はイージー。 */
export function chosenAssistLevel(tournament) {
  if (tournament?.retryAssist !== true) return 0;
  const chosen = tournament.retryAssistLevel;
  return Number.isInteger(chosen) && chosen > 0 ? clampLevel(chosen) : 1;
}
