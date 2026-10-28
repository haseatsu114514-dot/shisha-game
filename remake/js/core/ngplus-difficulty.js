// U4: 保存状態から独立した持ち込み指数と案B。係数の確定はD1（オーナー判断）。
const STAT_KEYS = ["technique", "sense", "guts", "charm", "insight"];
const S0 = 50;
const SMAX = 500;
export const CARRY_GAMMA = 1; // D1で確定する仮置き（線形＝恒等）。
export const KB = 0; // U4設計指定: no-opを維持する。
export const RMAX = 99; // 未確定の仮置き（100未満）。KB=0なので挙動には無関係。

/** 能力スナップショットだけから算出する純関数。欠損能力は初期値とする。 */
export function carryIndex(stats) {
  const sum = STAT_KEYS.reduce((total, key) => total + (Number.isFinite(stats?.[key]) ? stats[key] : 10), 0);
  return Math.max(0, Math.min(1, (sum - S0) / (SMAX - S0))) ** CARRY_GAMMA;
}

/** U1/U3の接続口。周回・引き継ぎの確証がない既存セーブは必ずP=0。 */
export function difficultyForRun(value, { cycle = 1, carryStats = false } = {}) {
  // U3のcycleStartStats実装時に差し替える暫定入力。保存項目は追加しない。
  return cycle > 1 && carryStats === true ? carryIndex(value?.statsAtChapterStart) : 0;
}

export function chapterFactor(chapter) {
  return 1; // g(章)はD1待ち。全章1の仮置き。
}

/** 案Bの純関数。ゼロ係数・P=0では浮動小数点演算も行わない。 */
export function liftRivalScore(rival, p, chapter) {
  if (KB === 0 || p === 0) return rival;
  return rival + (RMAX - rival) * KB * p * chapterFactor(chapter);
}

let observer = null;
/** U5用。nullで解除。観測は保存せず、返り値・例外でゲーム計算を変えない。 */
export function setRivalScoreObserver(callback = null) {
  observer = typeof callback === "function" ? callback : null;
}

export function observeRivalScore(rival, p, chapter, lifted) {
  if (!observer) return;
  try { observer(Object.freeze({ rival, p, chapter, lifted })); } catch { /* 計測失敗は進行へ波及させない */ }
}
