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
    bonuses: Object.freeze({ aroma: 2, heatStability: 1, taste: 1, smoke: 0, duration: 1, draw: 0 }),
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
 * グラム重み付きのメーカー混合プロファイル（適温帯幅倍率・複数社ペナルティ・ステータス天井加算）。
 * 単一メーカー時は主要4社で craftQuality 寄与が +2.50、初心者安定枠のドバジで +0.80 になるよう設計されている。
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

// ---------------------------------------------------------------- 機材性能比較・初心者向けリアル用語ガイド

export const EQUIP_CATEGORY_GUIDE = Object.freeze({
  bowl: "ボウル（ハガル）：フレーバー（葉）を詰める器。容量と材質で「適温の広さ・味の濃さ・温まる速さ」が変わる。",
  hms: "HMD（ヒートマネジメント）：ボウルの上に載せて炭を入れる金属製の蓋。熱の当たり方と安定感が変わる。",
  charcoal: "炭（チャコール）：熱源の形状。フラット（平型）は熱が穏やかで扱いやすく、キューブ（角型）は高火力で煙が厚くなる。",
});

export const EQUIP_THERMAL_SPECS = Object.freeze({
  silicone_bowl: Object.freeze({
    id: "silicone_bowl", type: "bowl", capacity: 12, widthFactor: 1.00,
    warmup: "標準（12g）", hold: "標準（基準）",
    summary: "熱が均一に回り焦げにくい初期ボウル。まずはこれで適温帯の感覚を掴みやすい。",
  }),
  hagal_80beat: Object.freeze({
    id: "hagal_80beat", type: "bowl", capacity: 15, widthFactor: 1.08,
    warmup: "やや穏やか（15g）", hold: "高め（味+12・持続+9）",
    summary: "中央1穴のファンネル構造。シロップが落ちず適温帯が+8%広がり、味の厚みと持ちも伸びる。",
  }),
  nightside_premier_hagal: Object.freeze({
    id: "nightside_premier_hagal", type: "bowl", capacity: 15, widthFactor: 1.12,
    warmup: "やや穏やか（15g）", hold: "高め（味+12・持続+9）",
    summary: "適温帯が+12%広がる精密ファンネルボウル。繊細なミックスでも温度を保ちやすい。",
  }),
  suyaki_hagal: Object.freeze({
    id: "suyaki_hagal", type: "bowl", capacity: 20, widthFactor: 0.90,
    warmup: "ゆっくり（大容量20g）", hold: "最大（味+32・持続+24）",
    fitNote: "タヌキッシュリッド装着不可（ロートスHMD／アマバースト等を使用）",
    summary: "伝統的な素焼き（クレイトップ）。適温帯は-10%狭まり温まりも遅いが、芯まで温まると圧倒的な味の深みが出る。",
  }),
  lotos_hagal: Object.freeze({
    id: "lotos_hagal", type: "hms", widthFactor: 1.00, stabilityBonus: 2,
    warmup: "早い（標準）", response: "素直（基準）", fitNote: "全ボウル対応",
    summary: "立ち上がりと熱安定のバランスが良い標準HMD。練習でも大会でも再現性が高い。",
  }),
  tanukish_lid: Object.freeze({
    id: "tanukish_lid", type: "hms", widthFactor: 1.08, stabilityBonus: 5,
    warmup: "穏やか", response: "マイルド（熱が上がりすぎない）", fitNote: "12g/15gボウル専用（素焼き20g非対応）",
    summary: "熱当たりが柔らかく、適温帯が+8%・熱安定が+3伸びる。吸い出しで通り過ぎにくく初心者にも扱いやすい。",
  }),
  winkwink_hagal: Object.freeze({
    id: "winkwink_hagal", type: "hms", widthFactor: 1.05, stabilityBonus: 4,
    warmup: "ややゆっくり", response: "マイルド（蓄熱重視）", fitNote: "素焼き20g含む全ボウル対応",
    summary: "素焼きの大口径にも載る大型タヌキッシュ。適温帯+5%・高い蓄熱性で大容量ボウルを安定させる。",
  }),
  amaburst_hms: Object.freeze({
    id: "amaburst_hms", type: "hms", widthFactor: 0.88, stabilityBonus: 0,
    warmup: "非常に早い（高火力）", response: "鋭い（1口で強く上がる）", fitNote: "素焼き20g含む全ボウル対応",
    summary: "直炭に近い高火力HMD。適温帯は-12%狭まるが、温まりにくい素焼き20gや高耐熱ミックスを一気に立ち上げられる。",
  }),
  flat_charcoal: Object.freeze({
    id: "flat_charcoal", type: "charcoal", widthFactor: 1.04, power: 1.00, response: 1.00, burnRisk: 0, smokeBonus: 0,
    warmup: "穏やか・安定（火力×1.00）", responseLabel: "標準（1口ずつ微調整しやすい）",
    summary: "平型のココナッツ炭。適温帯が広く（×1.04）、追加の焦げリスクが0。香りを守り、低温〜標準帯の葉を丁寧に仕上げるのに向く。",
  }),
  cube_charcoal: Object.freeze({
    id: "cube_charcoal", type: "charcoal", widthFactor: 0.94, power: 1.13, response: 1.12, burnRisk: 10.5, smokeBonus: 6,
    warmup: "強い（火力×1.13・煙量+6）", responseLabel: "強め（吸引で熱が上がりやすい）",
    summary: "角型の高火力炭。煙の厚み（+6）と立ち上がりに優れる反面、適温帯が狭まり（×0.94）焦げリスク（+10.5）も上がるため温度管理が重要。",
  }),
});

export function equipSpecOf(id) {
  if (EQUIP_THERMAL_SPECS[id]) return EQUIP_THERMAL_SPECS[id];
  if (String(id || "").startsWith("suyaki_")) {
    return {
      ...EQUIP_THERMAL_SPECS.suyaki_hagal,
      id,
      summary: "使い込まれた専用の素焼きハガル。対応する系統の葉を3g以上詰めると、染み込んだ香りが立ち上がる。",
    };
  }
  return null;
}

function formatRatioDelta(targetVal, currentVal, { widerIsEasier = true } = {}) {
  const diffPct = Math.round(((targetVal / currentVal) - 1) * 100);
  if (diffPct === 0) return `変化なし（×${targetVal.toFixed(2)}）`;
  const sign = diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`;
  const note = widerIsEasier
    ? (diffPct > 0 ? "適温に収めやすくなる" : "繊細な温度合わせが必要")
    : (diffPct > 0 ? "熱が強く入る（煙量↑・過熱注意）" : "熱が穏やかになる（焦げにくい）");
  return `×${currentVal.toFixed(2)} → ×${targetVal.toFixed(2)}（${sign}・${note}）`;
}

/**
 * ショップ・準備画面用の装備比較データ生成。
 * 強く動くことが常に有利とは限らないため、単なる緑の上昇表示ではなくトレードオフを明記する。
 */
export function compareEquipment(targetId, currentId) {
  const target = equipSpecOf(targetId);
  const current = equipSpecOf(currentId) || target;
  if (!target) return null;
  const same = target.id === current?.id;
  const rows = [];
  rows.push({
    label: "適温帯の広さ",
    value: same
      ? `×${target.widthFactor.toFixed(2)}（現在の基準）`
      : formatRatioDelta(target.widthFactor, current.widthFactor, { widerIsEasier: true }),
    tone: same ? "neutral" : target.widthFactor > current.widthFactor ? "easy" : target.widthFactor < current.widthFactor ? "technical" : "neutral",
  });
  if (target.type === "bowl") {
    const capDiff = target.capacity - (current?.capacity || 12);
    rows.push({
      label: "容量・味の持ち",
      value: same || capDiff === 0
        ? `${target.capacity}g（${target.hold}）`
        : `${current.capacity}g → ${target.capacity}g（${capDiff > 0 ? "味と持続が伸びるが、蒸らしは長めが目安" : "少ない葉で素早く温まる"}）`,
      tone: "neutral",
    });
    rows.push({ label: "温まり方", value: target.warmup, tone: "neutral" });
  } else if (target.type === "hms") {
    const stabDiff = target.stabilityBonus - (current?.stabilityBonus || 0);
    rows.push({
      label: "熱安定・反応",
      value: same
        ? `${target.response}（熱安定 +${target.stabilityBonus}）`
        : `${current.response} → ${target.response}（熱安定 ${stabDiff >= 0 ? `+${stabDiff}` : stabDiff}）`,
      tone: stabDiff > 0 ? "easy" : stabDiff < 0 ? "technical" : "neutral",
    });
    rows.push({ label: "対応ボウル", value: target.fitNote, tone: "neutral" });
  } else if (target.type === "charcoal") {
    rows.push({
      label: "火力・吸引反応",
      value: same
        ? `${target.warmup} ／ ${target.responseLabel}`
        : formatRatioDelta(target.power, current.power, { widerIsEasier: false }),
      tone: target.power > current.power ? "technical" : "easy",
    });
    const riskDiff = target.burnRisk - (current?.burnRisk || 0);
    const smokeDiff = target.smokeBonus - (current?.smokeBonus || 0);
    rows.push({
      label: "煙の厚み・焦げリスク",
      value: same
        ? `煙量補正 +${target.smokeBonus} ／ 焦げリスク +${target.burnRisk}`
        : `煙量 ${smokeDiff >= 0 ? `+${smokeDiff}` : smokeDiff} ／ 焦げリスク ${riskDiff >= 0 ? `+${riskDiff}` : riskDiff}（${riskDiff > 0 ? "太い煙が出るが過熱に注意" : "焦げにくく香りを保ちやすい"}）`,
      tone: riskDiff > 0 ? "technical" : "easy",
    });
  }
  return {
    same,
    categoryGuide: EQUIP_CATEGORY_GUIDE[target.type] || "",
    summary: target.summary,
    fitNote: target.fitNote || null,
    rows,
  };
}

/** フレーバーの耐熱性・メーカー特性を初心者にも分かりやすく説明するガイド */
export function flavorThermalGuide(flavor) {
  if (!flavor) return null;
  const makerKey = makerOfFlavor(flavor.id, { [flavor.id]: flavor });
  const maker = MAKER_SPECS[makerKey] || MAKER_SPECS.af;
  const t = Number(flavor.heat_tolerance) || 1.0;
  const tempBandLabel = t >= 1.15
    ? `高温向き（耐熱 ${t.toFixed(2)}）：熱に強く、しっかり温めると本領を発揮する`
    : t <= 0.88
      ? `低温・繊細（耐熱 ${t.toFixed(2)}）：熱が入りすぎると焦げやすいため、フラット炭や優しい火力が向く`
      : `標準温度帯（耐熱 ${t.toFixed(2)}）：クセが少なく、他の葉とも温度帯を合わせやすい`;
  const widthLabel = maker.widthFactor >= 1.10
    ? `広め（×${maker.widthFactor.toFixed(2)}・初心者でも適温に収めやすい）`
    : maker.widthFactor <= 0.80
      ? `狭め（×${maker.widthFactor.toFixed(2)}・ピンポイントの温度合わせで香りが跳ねる上級者向け）`
      : `標準（×${maker.widthFactor.toFixed(2)}）`;
  return {
    makerLabel: maker.label,
    tempBandLabel,
    widthLabel,
  };
}


