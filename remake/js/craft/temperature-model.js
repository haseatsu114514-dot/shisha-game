// #401: ゲーム内の温度帯。実測温度ではなく、既存 heat_tolerance だけを使う。
import { DB } from "../core/data.js";

// 基準帯は互換用の読み取り専用定数。一台の配合で上書きしない。
export const IDEAL = Object.freeze([0.42, 0.66]);
export const OPTIMAL = Object.freeze([0.49, 0.59]);
export const DANGER_TEMP = 0.90;
export const BURST_TEMP = 1;
export const COLD_OUT = 0.06;

/** 正の有限なgだけを重みにする。未知の葉・未定義/不正な耐熱性はその葉の倍率1。 */
export function temperatureBands(cs, flavorById = DB.flavorById) {
  const entries = Object.entries(cs?.mix ?? {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  // 重みを正規化して、旧/不正データの極端なgでも合計や積をオーバーフローさせない。
  const largest = entries.reduce((max, [, g]) => Math.max(max, g), 0);
  const weight = entries.reduce((sum, [, g]) => sum + g / largest, 0);
  let t = entries.reduce((sum, [id, g]) => {
    const value = flavorById?.[id]?.heat_tolerance;
    const tolerance = Number.isFinite(value) && value > 0 ? value : 1;
    return sum + tolerance * (g / largest / weight);
  }, 0);
  const validBand = (base) => Number.isFinite(base[1] * t) && base[0] * t > 0 && base[1] * t > base[0] * t;
  if (!Number.isFinite(t) || t <= 0 || !validBand(IDEAL) || !validBand(OPTIMAL)) t = 1;
  return Object.freeze({
    t,
    ideal: Object.freeze(IDEAL.map(value => value * t)),
    optimal: Object.freeze(OPTIMAL.map(value => value * t)),
    center: ((OPTIMAL[0] + OPTIMAL[1]) / 2) * t,
  });
}

export const isIdealTemperature = (temp, bands = temperatureBands()) => temp >= bands.ideal[0] && temp <= bands.ideal[1];
export const isOptimalTemperature = (temp, bands = temperatureBands()) => temp >= bands.optimal[0] && temp <= bands.optimal[1];

/** 基準の演出位置を一台の帯へ移す。緑より上は危険.90までの相対位置、危険以降は絶対値。 */
export function visualTemperature(at, bands = temperatureBands()) {
  if (at <= IDEAL[1]) return at * bands.t;
  if (at >= DANGER_TEMP) return at;
  return bands.ideal[1] + (DANGER_TEMP - bands.ideal[1]) * ((at - IDEAL[1]) / (DANGER_TEMP - IDEAL[1]));
}

// ---------------------------------------------------------------- メーカー5社プロファイル・混合帯幅モデル

export const MAKER_SPECS = Object.freeze({
  af: Object.freeze({
    id: "af", label: "アルファーヘブン", widthFactor: 1.00,
    bonuses: Object.freeze({ aroma: 4, heatStability: 4, taste: 4, smoke: 3, duration: 2, draw: 2 }),
  }),
  dobaj: Object.freeze({
    id: "dobaj", label: "ドバジ", widthFactor: 1.15,
    bonuses: Object.freeze({ aroma: 4, heatStability: 4, taste: 2, smoke: 5, duration: 2, draw: 2 }),
  }),
  afsahr: Object.freeze({
    id: "afsahr", label: "アフサール", widthFactor: 0.92,
    bonuses: Object.freeze({ aroma: 5, heatStability: 2, taste: 6, smoke: 2, duration: 3, draw: 0 }),
  }),
  forcefect: Object.freeze({
    id: "forcefect", label: "フォースフェクト", widthFactor: 0.72,
    bonuses: Object.freeze({ aroma: 8, heatStability: 0, taste: 3, smoke: 1, duration: 0, draw: 2 }),
  }),
  nightside: Object.freeze({
    id: "nightside", label: "ナイトサイド", widthFactor: 0.75,
    bonuses: Object.freeze({ aroma: 4, heatStability: 0, taste: 7, smoke: 5, duration: 6, draw: 0 }),
  }),
});

export const EQUIP_WIDTH_FACTORS = Object.freeze({
  bowl: Object.freeze({
    silicone_bowl: 1.00, hagal_80beat: 1.08, nightside_premier_hagal: 1.12,
    suyaki_hagal: 0.90, suyaki_minto: 0.90, suyaki_adam: 0.90, suyaki_naru: 0.90,
    suyaki_sumi: 0.90, suyaki_tsumugi: 0.90, suyaki_rin: 0.90, suyaki_hiyori: 0.90, suyaki_samechan: 0.90,
  }),
  hms: Object.freeze({
    lotos_hagal: 1.00, tanukish_lid: 1.08, winkwink_hagal: 1.05, amaburst_hms: 0.88,
  }),
  charcoal: Object.freeze({
    flat_charcoal: 1.04, cube_charcoal: 0.94,
  }),
});

const MAKER_WIDTH_PENALTY = [1.00, 1.00, 0.95, 0.88, 0.80];
const MAKER_SYNERGY_SCALE = [1.00, 1.00, 0.90, 0.78, 0.65];

/**
 * グラム重み付きのメーカー混合プロファイル（適温帯幅倍率・複数社ペナルティ・ステータス天井統一加算）。
 * 単一メーカー時どの社でも craftQuality 寄与がちょうど +2.50 になるよう設計されている。
 */
export function makerOfFlavor(id, flavorById = DB.flavorById) {
  const explicit = flavorById?.[id]?.maker;
  if (explicit && MAKER_SPECS[explicit]) return explicit;
  const s = String(id || "");
  if (s.startsWith("forcefect_")) return "forcefect";
  if (s.startsWith("nightside_")) return "nightside";
  if (s.startsWith("dobaj_")) return "dobaj";
  if (s.startsWith("absal_") || s.startsWith("afsahr_")) return "afsahr";
  return "af";
}

export function makerMixProfile(cs, flavorById = DB.flavorById) {
  const entries = Object.entries(cs?.mix ?? {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  const totalGrams = entries.reduce((sum, [, g]) => sum + g, 0);
  const baseBands = temperatureBands(cs, flavorById);
  const makerWeights = {};
  if (totalGrams > 0) {
    for (const [id, g] of entries) {
      const key = makerOfFlavor(id, flavorById);
      makerWeights[key] = (makerWeights[key] || 0) + g / totalGrams;
    }
  } else {
    makerWeights.af = 1;
  }
  const makers = Object.keys(makerWeights);
  const makerCount = makers.length || 1;
  const makerWidth = makers.reduce((sum, m) => sum + makerWeights[m] * MAKER_SPECS[m].widthFactor, 0);
  const widthPenalty = MAKER_WIDTH_PENALTY[Math.min(4, makerCount)];
  const synergyScale = MAKER_SYNERGY_SCALE[Math.min(4, makerCount)];
  const bowlFactor = EQUIP_WIDTH_FACTORS.bowl[cs?.equip?.bowl] || 1.00;
  const hmsFactor = EQUIP_WIDTH_FACTORS.hms[cs?.equip?.hms] || 1.00;
  const coalFactor = EQUIP_WIDTH_FACTORS.charcoal[cs?.equip?.charcoal] || 1.04;
  const equipWidth = bowlFactor * hmsFactor * coalFactor;
  const totalWidthScale = makerWidth * widthPenalty * equipWidth;
  const halfIdeal = 0.12 * baseBands.t * totalWidthScale;
  const halfOptimal = 0.05 * baseBands.t * totalWidthScale;
  const bonuses = { aroma: 0, heatStability: 0, taste: 0, smoke: 0, duration: 0, draw: 0 };
  for (const m of makers) {
    const w = makerWeights[m] * synergyScale;
    const b = MAKER_SPECS[m].bonuses;
    for (const k of Object.keys(bonuses)) bonuses[k] += w * b[k];
  }
  const qualityCeilingDelta =
    bonuses.aroma * 0.25 + bonuses.heatStability * 0.15 + bonuses.taste * 0.10
    + bonuses.smoke * 0.10 + bonuses.duration * 0.05 + bonuses.draw * 0.05;
  return Object.freeze({
    t: baseBands.t,
    center: baseBands.center,
    makerCount,
    makerWeights: Object.freeze(makerWeights),
    makerWidth,
    widthPenalty,
    synergyScale,
    equipWidth,
    totalWidthScale,
    ideal: Object.freeze([baseBands.center - halfIdeal, baseBands.center + halfIdeal]),
    optimal: Object.freeze([baseBands.center - halfOptimal, baseBands.center + halfOptimal]),
    bonuses: Object.freeze(bonuses),
    qualityCeilingDelta: Math.round(qualityCeilingDelta * 1000) / 1000,
  });
}

