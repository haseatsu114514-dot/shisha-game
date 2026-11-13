import { growthEnabled } from "../core/growth-mode.js";
import { naruFinishBonus } from "../core/naru-finish.js";
import { mixMasteryProfile } from "../core/flavor-mastery.js";
// 完成品の性能と総合評価。
//   穴あけ・炭焼き・配合・蒸らし・吸い出し・熱管理 → 完成品ステータス（shishaStats）
//   通常の総合スコア = 穴あけ20% + 炭焼き20% + 完成品20% + 調整1回目20% + 調整2回目20%
import { clamp } from "../core/util.js";
import { DB } from "../core/data.js";
import { state } from "../core/state.js";
import { growthPerks, growthSkill, growthLesson, floralLayers, grapeReceptionBonus, LESSON_TUNING, SKILL_TUNING } from "../core/growth-effects.js";
import { rememberGrowthCraft } from "../core/growth-memory.js";
import { refreshBench } from "./session.js";
import { gradeOf } from "./common.js";
import { steamSecondsOf, steamOpening, steamBurnRisk } from "./steam-time.js";
import { foilHeatProfile } from "./holes_logic.js";
import { temperatureBands, makerMixProfile, equipSpecOf } from "./temperature-model.js";
import { coalWarmth } from "./coals.js";
import { waterComfort } from "./water.js";

const WATER_TASTE_FACTOR = .5;

/**
 * 攻めた構成の見返りと代償（CRN・P7）。完成品の計算と、選ぶ画面の札の両方がこの表を読む（二重管理しない）。
 * 値は完成品ステータス（0〜100）へ足す量。
 */
export const CONFIG_EFFECTS = Object.freeze({
  place: Object.freeze({ four: Object.freeze({ smoke: 14, burnRisk: 16 }) }),
  pack: Object.freeze({
    fluffy: Object.freeze({ draw: 12, taste: -6, burnRisk: 5 }),
    normal: Object.freeze({}),
    firm: Object.freeze({ draw: -12, taste: 14, duration: 10 }),
  }),
});
const EFFECT_WORDS = { smoke: "煙", burnRisk: "焦げやすさ", draw: "吸い心地の軽さ", taste: "味の濃さ", duration: "持ち" };
/** 選ぶ画面の札の文字（例: 「煙＋14・焦げやすさ＋16」） */
export function configEffectLabel(group, value) {
  const fx = CONFIG_EFFECTS[group]?.[value];
  if (!fx) return "";
  return Object.entries(fx).map(([key, n]) => `${EFFECT_WORDS[key] || key}${n >= 0 ? "＋" : "−"}${Math.abs(n)}`).join("・");
}

export const WEIGHTS = { holes: .2, heat: .2, shisha: .2, care1: .2, care2: .2 };
/** 千須が持ち点を動かす基準（これ未満なら千須票は入らず、普通に負ける） */
export const SUI_BAR = 90.8; // MEASURE.md: 第1章・mid 初回突破率 74.2%（742/1000）。

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
  const packFx = CONFIG_EFFECTS.pack[cs.pack] || {};
  const packDraw = packFx.draw || 0;
  const four = cs.place === "four";
  const fourFx = four ? CONFIG_EFFECTS.place.four : {};
  // HMDの熱安定は性能表（equipSpecOf の stabilityBonus）を正とする。表示と採点で値をずらさない。
  const hms = equipSpecOf(cs.equip?.hms)?.stabilityBonus || 0;
  const steamSeconds = steamSecondsOf(cs);
  const opening = steamOpening(steamSeconds);

  // 最低1周を満たせば、少ない穴数を煙量や総合点の直接の減点にしない。
  const holeDraw = h.minimumComplete ? 36 : (h.total - 14) * 3 + (h.inner >= 3 ? 6 : 0);
  const baseDraw = 42 + holeDraw + packDraw;
  const { drawW } = waterComfort(cs.water);
  const draw = clamp(baseDraw + maker.bonuses.draw + drawW, 0, 100);
  const smoke = clamp(baseDraw * 0.45 + c.heatPower * 0.35 + (fourFx.smoke || 0) + opening * 6 + coal.smokeBonus + maker.bonuses.smoke, 0, 100);
  const baseHeatStability = h.outerEven * 45 + c.heatStability * 0.38 + care.score * 0.12 + hms + foilHeatProfile(h).stability;
  const heatStability = clamp(baseHeatStability + maker.bonuses.heatStability, 0, 100);
  const safePulls = 3 + (maker.safePullsBonus || 0);
  const extraPulls = Math.max(0, (p.pulls || 3) - safePulls);
  const overheatedRisk = overheated ? Math.round(12 * (1 - 0.5 * (maker.makerWeights?.dobaj || 0))) : 0;
  const burnRisk = clamp(8 + h.innerExcess * 9 + c.burnRisk * 0.55 + (fourFx.burnRisk || 0) + steamBurnRisk(steamSeconds) + overheatedRisk + (packFx.burnRisk || 0) + extraPulls * 5 + coal.burnRisk, 0, 100);
  const gift = giftBowlEffect(cs);
  const mastery = mixMasteryProfile(cs.masteryAtStart ? { flavorMastery: cs.masteryAtStart } : state, cs.mix, DB.flavorById);
  // 慣れた葉ほど香りを再現しやすい。甘さ・清涼感などの強さを品質点にしない。
  const aroma = clamp(m.score * 0.38 + c.aromaRetention * 0.28 + p.score * 0.22 + st.score * 0.12 - burnRisk * 0.2 + 10 + (gift?.aroma || 0) + maker.bonuses.aroma + mastery.aromaBonus, 0, 100);
  const taste = clamp(38 + (grams - 12) * 4 + (packFx.taste || 0) + opening * 8 + (m.intensity - 5) * 3 + maker.bonuses.taste + WATER_TASTE_FACTOR * drawW, 0, 100);
  const duration = clamp(baseHeatStability * 0.55 + (grams - 12) * 3 + (packFx.duration || 0) + care.score * 0.25 + maker.bonuses.duration, 0, 100);
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
  const naru = growthEnabled() ? naruFinishBonus(cs) : 0;
  if (naru) { b += naru; notes.push(`焼き際の見極め +${naru.toFixed(1)}`); }
  const grape = grapeReceptionBonus(state, cs, DB.flavorById);
  if (grape) { b += grape; notes.push(`グレープの王道・受け止め +${grape.toFixed(1)}`); }
  if (cs?.mode === "tournament" && !cs.failed && cs.pullDone && cs.pull?.smokeRings > 0 && growthSkill(state,"K21")) { b += SKILL_TUNING.smokeRing; notes.push("スモークリングの余韻"); }
  if(cs&&cs.mode!=="tutorial"&&!cs.failed){
    if(floralLayers(state,cs,DB.flavorById).length){
      const layers=(cs.careHistory||[]).slice(0,2).filter(c=>!c.failed&&Number.isFinite(c.score)).length;
      if(layers){b+=layers*LESSON_TUNING.flowerLayer;notes.push(`花を重ねる・調整で${layers}層の香りが立った`);}
    }
    if(cs.mode==="tournament"&&cs.pullDone&&cs.blindService&&growthLesson(state,"M-B3")&&Number.isFinite(cs.blindVariance)){
      const swing=Math.min(LESSON_TUNING.blindSwing,Math.max(-LESSON_TUNING.blindSwing,cs.blindVariance));
      b+=swing;notes.push(`白紙の味カード ${swing>=0?"+":""}${swing.toFixed(1)}`);
    }
  }
  const impression = cs?.mode === "tournament" ? growthPerks(state)?.stage || 0 : 0;
  if (impression > 0) { b += impression; notes.push(`盤の第一印象 +${impression.toFixed(1)}`); }
  // この2記録は第1章の準備。後章の旧セーブに残っていても、その章の加点にはしない。
  if ((cs?.chapter ?? state?.chapter) === 1) {
    if (state?.rehearsal === "great") { b += 3; notes.push("前日リハーサルの手応え"); }
    else if (state?.rehearsal === "good") { b += 1.5; notes.push("前日リハーサルの手応え"); }
    if (state?.flags?._last_night === "practice") { b += 2; notes.push("前夜の最終調整"); }
    // 前夜に苦手工程を反復し、★1つ以上で終えた（#2091）。記録の無い旧セーブは加点しない。
    if (state?.flags?._last_night === "drill" && (state?.flags?._ch1_eve?.drillTier ?? 0) >= 1) { b += 1; notes.push("前夜の反復"); }
  }
  const gift = cs && giftBowlEffect(cs);
  if (gift?.bonus) { b += gift.bonus; notes.push(gift.note); }
  const mastery = cs && cs.mode === "tournament"
    ? mixMasteryProfile(cs.masteryAtStart ? { flavorMastery: cs.masteryAtStart } : state, cs.mix, DB.flavorById).bonus : 0;
  if (mastery > 0) { b += mastery; notes.push(`フレーバーの熟練度 +${mastery.toFixed(1)}`); }
  return { bonus: b, notes };
}

/** 最終採点と暫定表示で同じ重みを使う。 */
export function scoreWeights(cs) {
  // アルミ穴あけを飛ばした一台は穴あけの重みを外す。第1章大会だけ完成品を40%にする。
  const foilSkipped = !!cs.holes?.skipped;
  const weights = { ...WEIGHTS };
  if (foilSkipped) {
    delete weights.holes;
    if ((cs?.chapter ?? state?.chapter) === 1 && cs.mode === "tournament") {
      Object.assign(weights, { heat: .2, shisha: .4, care1: .2, care2: .2 });
    }
  }
  return weights;
}

/** 確定した項目だけの暫定平均。未実施項目と完成時のボーナスは含めない。状態は変更しない。 */
export function provisionalCraftScore(cs) {
  const parts = {
    holes: cs.holes?.skipped ? undefined : cs.holes?.score,
    heat: cs.heat?.score,
    shisha: cs.pullDone ? (cs.stats || computeShisha(cs)).craftQuality : undefined,
    care1: cs.careHistory?.[0]?.score,
    care2: cs.careHistory?.[1]?.score,
  };
  const entries = Object.entries(scoreWeights(cs)).filter(([key]) => Number.isFinite(parts[key]));
  const weight = entries.reduce((sum, [, w]) => sum + w, 0);
  return weight ? clamp(entries.reduce((sum, [key, w]) => sum + parts[key] * (w / weight), 0), 0, 100) : null;
}

/**
 * 制作中のランク（CRN01・CRN12）。作業台を開いた時はDで、工程を終えるたびに1段ずつ上がっていく。
 * 表示の点 = min(採点に入る工程の平均, 進み具合の上限)。進み具合は 穴・炭・蒸らし・提供・調整1・調整2 の6つ（その台で行う分だけ）。
 * 上限は進み具合に合わせて D→C→B→A→S→SS と1段ずつ開き、全部終えると外れて最終の総合（ボーナス前）と一致する（最後に SSS へ届く）。
 * 蒸らし（雑念よけ）は採点の平均には入らないが、進み具合には入る。蒸らしの最中は、雑念に当たっていない時間の分だけ
 * 進み具合がじわじわ増える（cs.steamLive.progress、0〜1）。出来の悪い工程があれば平均の方で抑えられる。
 * steps はその作業台で行う工程（openBench の steps の id）。調整なしの台は、その分を数えない。
 */
export function climbingCraftScore(cs, steps = null, thresholds = [0, 50, 65, 80, 90, 93, 96]) {
  const parts = {
    holes: cs.holes?.skipped ? undefined : cs.holes?.score,
    heat: cs.heat?.score,
    shisha: cs.pullDone ? (cs.stats || computeShisha(cs)).craftQuality : undefined,
    care1: cs.careHistory?.[0]?.score,
    care2: cs.careHistory?.[1]?.score,
  };
  const planned = Array.isArray(steps) && steps.length ? new Set(steps) : null;
  const stepOf = { holes: "holes", heat: "heat", shisha: "pull", care1: "care1", care2: "care2" };
  const entries = Object.entries(scoreWeights(cs)).filter(([key]) => !planned || planned.has(stepOf[key]));
  const steamPlanned = !planned || planned.has("steam");
  const units = entries.length + (steamPlanned ? 1 : 0);
  if (!entries.length) return null;
  const done = entries.filter(([key]) => Number.isFinite(parts[key]));
  const steamDone = !steamPlanned ? 0 : cs.steam ? 1 : clamp(Number(cs.steamLive?.progress) || 0, 0, 1);
  if (!done.length) return 0;
  const weight = done.reduce((sum, [, w]) => sum + w, 0);
  const average = clamp(done.reduce((sum, [key, w]) => sum + parts[key] * (w / weight), 0), 0, 100);
  const fraction = (done.length + steamDone) / units;
  if (fraction >= 1) return average;
  // 進み具合 → 上限の点。ランクの境目の間を、進み具合に比例して1段ずつ開ける
  const top = thresholds.length - 1, g = fraction * top, i = Math.floor(g);
  const cap = thresholds[i] + (g - i) * ((thresholds[i + 1] ?? 100) - thresholds[i]);
  return Math.min(average, cap);
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
  const weights = scoreWeights(cs);
  const foilSkipped = !!cs.holes?.skipped;
  const wsum = Object.values(weights).reduce((sum, w) => sum + w, 0) || 1;
  const total = clamp(Object.entries(weights).reduce((s, [k, w]) => s + parts[k] * (w / wsum), 0) + bonus, 0, 100);
  cs.total = Math.round(total * 10) / 10;
  cs.rank = gradeOf(cs.total);
  cs.parts = parts;
  cs.foilSkipped = foilSkipped;
  cs.bonusNotes = notes;
  rememberGrowthCraft(state, cs);
  refreshBench();
  return cs;
}
