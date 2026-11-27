// mukai の昇給は、この周回で確定した大会の実績を使う。
// 保存する値は増やさない。旧セーブにも次の勤務から適用し、過去の日当は精算し直さない。
const recorded = value => value === true || value === 1;

export const SHIFT_ACHIEVEMENTS = Object.freeze([
  Object.freeze({ id: "local", label: "地元大会優勝", bonus: 1000 }),
  Object.freeze({ id: "prefectural", label: "県大会優勝", bonus: 2000 }),
  Object.freeze({ id: "asia", label: "全国大会優勝", bonus: 3000 }),
  Object.freeze({ id: "world", label: "世界大会優勝", bonus: 4000 }),
]);

/** 最上位の実績のみ。倍率・連勝・再読による積み重ねはない。 */
export function shiftAchievement(value) {
  const flags = value?.flags || {};
  // クリアは必ず勝利後。旧セーブの勝利場面読了・勝利確定も認める。
  if (recorded(flags._ch4_cleared) || recorded(flags._ch4?.read?.ch4_final)) return SHIFT_ACHIEVEMENTS[3];
  if (recorded(flags._ch3_cleared) || recorded(flags._ch3_tournament_won)) return SHIFT_ACHIEVEMENTS[2];
  if (recorded(flags._ch2_cleared) || value?.chapter === 2 && value?.phase === "cleared") return SHIFT_ACHIEVEMENTS[1];
  if (recorded(flags._ch1_cleared) || value?.chapter === 1 && value?.phase === "cleared") return SHIFT_ACHIEVEMENTS[0];
  return null;
}

export const shiftAchievementBonus = value => shiftAchievement(value)?.bonus || 0;
export const shiftBasePay = (value, base = 8000) => base + shiftAchievementBonus(value);
export function shiftPayNote(value, base = 8000) {
  const achievement = shiftAchievement(value);
  return `基本${shiftBasePay(value, base).toLocaleString("ja-JP")}円${achievement ? `（${achievement.label}を反映）` : ""}`;
}

// tonari の店番（昼と夜の2コマ・#4252）。章進行で基本給が上がる。
const FLOOR_SHIFT_BASE = Object.freeze([8000, 10000, 12000, 14000, 16000]);
export const FLOOR_COMMISSION_PERCENT = 10;
export const floorShiftBasePay = (chapter = 1) => FLOOR_SHIFT_BASE[Math.min(chapter, FLOOR_SHIFT_BASE.length) - 1] ?? FLOOR_SHIFT_BASE[0];

/** 歩合の率（%）。bonus＝心得の盤の「売り上手」（K28。SBD157）で足すポイント。 */
export const floorCommissionPercent = (bonus = 0) => FLOOR_COMMISSION_PERCENT + Math.max(0, Number(bonus) || 0);

export function floorShiftPay(chapter, sales, allowances = 0, bonus = 0) {
  const base = floorShiftBasePay(chapter);
  const commission = Math.floor(sales * floorCommissionPercent(bonus) / 100);
  return { base, commission, allowances, total: base + commission + allowances };
}
