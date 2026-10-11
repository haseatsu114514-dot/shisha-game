// 完成品の性能と総合評価。
//   穴あけ・炭焼き・配合・蒸らし・吸い出し・熱管理 → 完成品ステータス（shishaStats）
//   総合スコア = 穴あけ20% + 炭焼き20% + 完成品20% + 調整1回目20% + 調整2回目20%
import { clamp } from "../core/util.js";
import { DB } from "../core/data.js";
import { state } from "../core/state.js";
import { gradeOf } from "./common.js";
import { steamSecondsOf, steamOpening, steamBurnRisk } from "./steam-time.js";
import { foilHeatProfile } from "./holes_logic.js";

export const WEIGHTS = { holes: .2, heat: .2, shisha: .2, care1: .2, care2: .2 };
/** 南雲が持ち点を動かす基準（これ未満なら南雲票は入らず、普通に負ける） */
export const NAGUMO_BAR = 72;

/**
 * 贈られた専用ハガル（equipment.json の gift）の効き。この一台の機材（cs.equip）で所持していて、
 * 染み付いた香りのフレーバーを min_grams 以上詰めたときだけ、香りが少し開き総合に小さく乗る。
 * 対象外の配合・未所持・装備していない一台には何もしない（一律の強化にしない）
 */
export function giftBowlEffect(cs) {
  const bowl = DB.equipById[cs?.equip?.bowl];
  const gift = bowl?.gift;
  if (!gift || !state.owned.includes(bowl.id)) return null;
  if ((cs.mix?.[gift.flavor] || 0) < (gift.min_grams || 1)) return null;
  return { aroma: gift.aroma || 0, bonus: gift.bonus || 0, note: `${bowl.name}に染みた香り` };
}

export function computeShisha(cs) {
  const h = cs.holes || { total: 22, evenness: 0.6, outerEven: 0.6, innerExcess: 0, score: 60 };
  const c = cs.heat || { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 };
  const m = cs.mixInfo || { score: 60, intensity: 5, total: 12 };
  const p = cs.pull || { score: 60, temp: 0.54, pulls: 3 };
  const st = cs.steam || { min: 5, hits: 2, score: 70 };
  const care = cs.careHistory?.length ? { score: cs.careHistory.reduce((sum, item) => sum + item.score, 0) / cs.careHistory.length } : cs.care || { score: 60 };
  const grams = m.total || 12;
  const packDraw = { fluffy: 12, normal: 0, firm: -12 }[cs.pack] || 0;
  const four = cs.place === "four";
  const hms = { lotos_hagal: 2, tanukish_lid: 5, amaburst_hms: 0 }[cs.equip?.hms] || 0;
  const steamSeconds = steamSecondsOf(cs);
  const opening = steamOpening(steamSeconds);

  // 最低1周を満たせば、少ない穴数を煙量や総合点の直接の減点にしない。
  const holeDraw = h.minimumComplete ? 36 : (h.total - 14) * 3 + (h.inner >= 3 ? 6 : 0);
  const draw = clamp(42 + holeDraw + packDraw, 0, 100);
  const smoke = clamp(draw * 0.45 + c.heatPower * 0.35 + (four ? 14 : 0) + opening * 6 + (cs.equip?.charcoal === "cube_charcoal" ? 5 : 0), 0, 100);
  const heatStability = clamp(h.outerEven * 45 + c.heatStability * 0.38 + care.score * 0.12 + hms + foilHeatProfile(h).stability, 0, 100);
  const burnRisk = clamp(8 + h.innerExcess * 9 + c.burnRisk * 0.55 + (four ? 16 : 0) + steamBurnRisk(steamSeconds) + (p.over ? 12 : 0) + (cs.pack === "fluffy" ? 5 : 0) + Math.max(0, (p.pulls || 3) - 3) * 5, 0, 100);
  const gift = giftBowlEffect(cs);
  const aroma = clamp(m.score * 0.38 + c.aromaRetention * 0.28 + p.score * 0.22 + st.score * 0.12 - burnRisk * 0.2 + 10 + (gift?.aroma || 0), 0, 100);
  const taste = clamp(38 + (grams - 12) * 4 + (cs.pack === "firm" ? 14 : cs.pack === "fluffy" ? -6 : 0) + opening * 8 + (m.intensity - 5) * 3, 0, 100);
  const duration = clamp(heatStability * 0.55 + (grams - 12) * 3 + (cs.pack === "firm" ? 10 : 0) + care.score * 0.25, 0, 100);
  const craftQuality = Math.round(clamp(aroma * 0.3 + heatStability * 0.2 + (100 - burnRisk) * 0.2 + m.score * 0.15 + p.score * 0.15, 0, 100));
  return {
    draw: Math.round(draw), smoke: Math.round(smoke), heatStability: Math.round(heatStability), burnRisk: Math.round(burnRisk),
    aroma: Math.round(aroma), taste: Math.round(taste), duration: Math.round(duration), craftQuality,
  };
}

/** 章のボーナス（前日リハーサル・前夜の過ごし方・機材・贈られたハガル） */
export function bonusOf(cs = null) {
  let b = 0;
  const notes = [];
  if (state.rehearsal === "great") { b += 3; notes.push("前日リハーサルの手応え"); }
  else if (state.rehearsal === "good") { b += 1.5; notes.push("前日リハーサルの手応え"); }
  if (state.flags._last_night === "practice") { b += 2; notes.push("前夜の最終調整"); }
  if (state.equip.bowl === "hagal_80beat") b += 1;
  const gift = cs && giftBowlEffect(cs);
  if (gift?.bonus) { b += gift.bonus; notes.push(gift.note); }
  return { bonus: b, notes };
}

export function finalize(cs) {
  cs.stats = cs.stats || computeShisha(cs);
  const { bonus, notes } = bonusOf(cs);
  const parts = {
    holes: cs.holes?.score ?? 0,
    heat: cs.heat?.score ?? 0,
    shisha: cs.stats.craftQuality,
    care1: cs.careHistory?.[0]?.score ?? 0,
    care2: cs.careHistory?.[1]?.score ?? 0,
  };
  const total = clamp(Object.entries(WEIGHTS).reduce((s, [k, w]) => s + parts[k] * w, 0) + bonus, 0, 100);
  cs.total = Math.round(total * 10) / 10;
  cs.rank = gradeOf(cs.total);
  cs.parts = parts;
  cs.bonusNotes = notes;
  return cs;
}

export const flavorName = (id) => DB.flavorById[id]?.short_name?.replace(/^AF /, "") || id;
