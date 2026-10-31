import { mixMasteryProfile } from "../core/flavor-mastery.js";
// 完成品の性能と総合評価。
//   穴あけ・炭焼き・配合・蒸らし・吸い出し・熱管理 → 完成品ステータス（shishaStats）
//   通常の総合スコア = 穴あけ20% + 炭焼き20% + 完成品20% + 調整1回目20% + 調整2回目20%
import { clamp } from "../core/util.js";
import { DB } from "../core/data.js";
import { state } from "../core/state.js";
import { gradeOf } from "./common.js";
import { steamSecondsOf, steamOpening, steamBurnRisk } from "./steam-time.js";
import { foilHeatProfile } from "./holes_logic.js";
import { temperatureBands, makerMixProfile } from "./temperature-model.js";
import { coalWarmth } from "./coals.js";
import { waterComfort } from "./water.js";

const WATER_TASTE_FACTOR = .5;

export const WEIGHTS = { holes: .2, heat: .2, shisha: .2, care1: .2, care2: .2 };
/** 南雲が持ち点を動かす基準（これ未満なら南雲票は入らず、普通に負ける） */
export const NAGUMO_BAR = 90.8; // MEASURE.md: 第1章・mid 初回突破率 74.2%（742/1000）。

/** 同系統フレーバー（AF/ドバジ/アフサールのミント・ダブルアップル等）の合計グラム数 */
export function flavorFamilyGrams(mix, family, flavorById = DB.flavorById) {
  if (!mix || !family) return 0;
  return Object.entries(mix).reduce((sum, [id, g]) => {
    if (!Number.isFinite(g) || g <= 0) return sum;
    const f = flavorById?.[id];
    return (id === family || f?.family === family) ? sum + g : sum;
  }, 0);
}

/**
 * 贈られた専用ハガル（equipment.json の gift）の効き。この一台の機材（cs.equip）で所持していて、
 * 染み付いた香りのフレーバーを min_grams 以上詰めたときだけ、香りが少し開き総合に小さく乗る。
 * 対象外の配合・未所持・装備していない一台には何もしない（一律の強化にしない）
 */
export function giftBowlEffect(cs) {
  const bowl = DB.equipById[cs?.equip?.bowl];
  const gift = bowl?.gift;
  if (!gift || !state?.owned?.includes(bowl.id)) return null;
  if (flavorFamilyGrams(cs?.mix, gift.flavor) < (gift.min_grams || 1)) return null;
  return { aroma: gift.aroma || 0, bonus: gift.bonus || 0, note: `${bowl.name}に染みた香り` };
}

export function computeShisha(cs) {
  const h = cs.holes || { total: 22, evenness: 0.6, outerEven: 0.6, innerExcess: 0, score: 60 };
  const c = cs.heat || { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 };
  const m = cs.mixInfo || { score: 60, intensity: 5, total: 12 };
  const bands = temperatureBands(cs);
  const maker = makerMixProfile(cs);
  const coal = coalWarmth(cs);
  const p = cs.pull || { score: 60, temp: bands.center, pulls: 3 };
  const overheated = Number.isFinite(p.temp) ? p.temp > bands.ideal[1] : !!p.over;
  const st = cs.steam || { min: 5, hits: 2, score: 70 };
  const care = cs.careHistory?.length ? { score: cs.careHistory.reduce((sum, item) => sum + item.score, 0) / cs.careHistory.length } : cs.care || { score: 60 };
  const grams = m.total || 12;
  const packDraw = { fluffy: 12, normal: 0, firm: -12 }[cs.pack] || 0;
  const four = cs.place === "four";
  const hms = { lotos_hagal: 2, tanukish_lid: 5, winkwink_hagal: 4, amaburst_hms: 0 }[cs.equip?.hms] || 0;
  const steamSeconds = steamSecondsOf(cs);
  const opening = steamOpening(steamSeconds);

  // 最低1周を満たせば、少ない穴数を煙量や総合点の直接の減点にしない。
  const holeDraw = h.minimumComplete ? 36 : (h.total - 14) * 3 + (h.inner >= 3 ? 6 : 0);
  const baseDraw = 42 + holeDraw + packDraw;
  const { drawW } = waterComfort(cs.water);
  const draw = clamp(baseDraw + maker.bonuses.draw + drawW, 0, 100);
  const smoke = clamp(baseDraw * 0.45 + c.heatPower * 0.35 + (four ? 14 : 0) + opening * 6 + coal.smokeBonus + maker.bonuses.smoke, 0, 100);
  const baseHeatStability = h.outerEven * 45 + c.heatStability * 0.38 + care.score * 0.12 + hms + foilHeatProfile(h).stability;
  const heatStability = clamp(baseHeatStability + maker.bonuses.heatStability, 0, 100);
  const safePulls = 3 + (maker.safePullsBonus || 0);
  const extraPulls = Math.max(0, (p.pulls || 3) - safePulls);
  const overheatedRisk = overheated ? Math.round(12 * (1 - 0.5 * (maker.makerWeights?.dobaj || 0))) : 0;
  const burnRisk = clamp(8 + h.innerExcess * 9 + c.burnRisk * 0.55 + (four ? 16 : 0) + steamBurnRisk(steamSeconds) + overheatedRisk + (cs.pack === "fluffy" ? 5 : 0) + extraPulls * 5 + coal.burnRisk, 0, 100);
  const gift = giftBowlEffect(cs);
  const mastery = mixMasteryProfile(cs.masteryAtStart ? { flavorMastery: cs.masteryAtStart } : state, cs.mix, DB.flavorById);
  // 慣れた葉ほど香りを再現しやすい。甘さ・清涼感などの強さを品質点にしない。
  const aroma = clamp(m.score * 0.38 + c.aromaRetention * 0.28 + p.score * 0.22 + st.score * 0.12 - burnRisk * 0.2 + 10 + (gift?.aroma || 0) + maker.bonuses.aroma + mastery.aromaBonus, 0, 100);
  const taste = clamp(38 + (grams - 12) * 4 + (cs.pack === "firm" ? 14 : cs.pack === "fluffy" ? -6 : 0) + opening * 8 + (m.intensity - 5) * 3 + maker.bonuses.taste + WATER_TASTE_FACTOR * drawW, 0, 100);
  const duration = clamp(baseHeatStability * 0.55 + (grams - 12) * 3 + (cs.pack === "firm" ? 10 : 0) + care.score * 0.25 + maker.bonuses.duration, 0, 100);
  const rawQuality = aroma * 0.25 + heatStability * 0.15 + (100 - burnRisk) * 0.15 + taste * 0.10 + smoke * 0.10
    + duration * 0.05 + draw * 0.05 + m.score * 0.08 + p.score * 0.07;
  const craftQuality = Math.round(clamp(rawQuality, 0, 100));
  return {
    draw: Math.round(draw), smoke: Math.round(smoke), heatStability: Math.round(heatStability), burnRisk: Math.round(burnRisk),
    aroma: Math.round(aroma), taste: Math.round(taste), duration: Math.round(duration),
    craftQuality,
    craftQualityRaw: Math.round(clamp(rawQuality, 0, 100) * 1000) / 1000,
  };
}

/** 章のボーナス（前日リハーサル・前夜の過ごし方・贈られたハガル） */
export function bonusOf(cs = null) {
  let b = 0;
  const notes = [];
  // この2記録は第1章の準備。後章の旧セーブに残っていても、その章の加点にはしない。
  if ((cs?.chapter ?? state?.chapter) === 1) {
    if (state?.rehearsal === "great") { b += 3; notes.push("前日リハーサルの手応え"); }
    else if (state?.rehearsal === "good") { b += 1.5; notes.push("前日リハーサルの手応え"); }
    if (state?.flags?._last_night === "practice") { b += 2; notes.push("前夜の最終調整"); }
  }
  const gift = cs && giftBowlEffect(cs);
  if (gift?.bonus) { b += gift.bonus; notes.push(gift.note); }
  const mastery = cs && cs.mode === "tournament"
    ? mixMasteryProfile(cs.masteryAtStart ? { flavorMastery: cs.masteryAtStart } : state, cs.mix, DB.flavorById).bonus : 0;
  if (mastery > 0) { b += mastery; notes.push(`フレーバーの熟練度 +${mastery.toFixed(1)}`); }
  return { bonus: b, notes };
}

export function finalize(cs) {
  cs.stats = cs.stats || computeShisha(cs);
  const { bonus, notes } = bonusOf(cs);
  const parts = {
    ...(cs.holes?.skipped ? {} : { holes: cs.holes?.score ?? 0 }),
    heat: cs.heat?.score ?? 0,
    shisha: cs.stats.craftQuality,
    care1: cs.careHistory?.[0]?.score ?? 0,
    care2: cs.careHistory?.[1]?.score ?? 0,
  };
  // アルミ穴あけを飛ばした一台は穴あけの重みを外す。第1章大会だけ完成品を40%にする。
  const foilSkipped = !!cs.holes?.skipped;
  const weights = { ...WEIGHTS };
  if (foilSkipped) {
    delete weights.holes;
    if ((cs?.chapter ?? state?.chapter) === 1 && cs.mode === "tournament") {
      Object.assign(weights, { heat: .2, shisha: .4, care1: .2, care2: .2 });
    }
  }
  const wsum = Object.values(weights).reduce((sum, w) => sum + w, 0) || 1;
  const total = clamp(Object.entries(weights).reduce((s, [k, w]) => s + parts[k] * (w / wsum), 0) + bonus, 0, 100);
  cs.total = Math.round(total * 10) / 10;
  cs.rank = gradeOf(cs.total);
  cs.parts = parts;
  cs.foilSkipped = foilSkipped;
  cs.bonusNotes = notes;
  return cs;
}
