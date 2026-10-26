// 香りの系統と、加熱後に感じる強さを分けるゲーム用モデル。
// 数値は調整値。実物の温度・糖度や、メーカー共通の性質を表すものではない。
import { DB } from "../core/data.js";
import { temperatureBands } from "./temperature-model.js";

const KEYS = ["sweetness", "cooling", "body", "naturalAroma", "confection", "sourness", "spiciness", "floral", "assertiveness"];
const AXES = [
  { key: "sweetness", label: "甘い印象" },
  { key: "cooling", label: "清涼感" },
  { key: "body", label: "煙の厚み" },
];
const clamp = (n, min = 0, max = 10) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const stat = (f, key) => clamp(f?.stats?.[key]);
const expressionOf = f => f?.thermal_expression?.quality === "range" ? f.thermal_expression : null;

// temperatureBands と同じく最大gで割り、極端な旧データでも有限値を保つ。
function entriesOf(cs, catalog) {
  const entries = Object.entries(cs?.mix ?? {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  const largest = entries.reduce((max, [, g]) => Math.max(max, g), 0);
  const total = entries.reduce((sum, [, g]) => sum + g / largest, 0);
  return entries.map(([id, g]) => ({ id, weight: g / largest / total, flavor: catalog?.[id] }));
}

function baseValues(flavor) {
  const naturalAroma = stat(flavor, "sweet_natural"), confection = stat(flavor, "sweet_confection");
  return {
    // 甘い香りと菓子香を手がかりにする初期推定。品質点には足さない。
    sweetness: Number.isFinite(flavor?.perceived_sweetness)
      ? clamp(flavor.perceived_sweetness) : clamp(naturalAroma * .65 + confection * .45),
    naturalAroma, confection,
    cooling: stat(flavor, "cooling"), body: stat(flavor, "smoke_body"),
    sourness: stat(flavor, "sourness"), spiciness: stat(flavor, "spiciness"),
    floral: stat(flavor, "floral"), assertiveness: stat(flavor, "assertiveness"),
  };
}

function atPosition(flavor, position) {
  const base = baseValues(flavor), expression = expressionOf(flavor);
  if (!expression) return base;
  const from = position <= .5 ? expression.low : expression.middle;
  const to = position <= .5 ? expression.middle : expression.high;
  const fraction = position <= .5 ? position * 2 : (position - .5) * 2;
  return Object.fromEntries(KEYS.map(key => {
    const a = Number.isFinite(from?.[key]) ? clamp(from[key]) : base[key];
    const b = Number.isFinite(to?.[key]) ? clamp(to[key]) : base[key];
    return [key, a + (b - a) * fraction];
  }));
}

function strengthLabel(values) {
  const candidates = [
    [values.cooling, "清涼感が主役"], [values.sweetness, "甘い印象が主役"],
    [values.sourness, "酸味くっきり"], [values.spiciness, "スパイスの香り"],
    [values.floral, "花の香り"],
  ].sort((a, b) => b[0] - a[0]);
  return candidates[0][0] >= 4 ? candidates[0][1] : "穏やかな香り";
}

function profileLabel(entries, position, values) {
  const dominant = entries.filter(entry => expressionOf(entry.flavor))
    .sort((a, b) => b.weight - a.weight)[0];
  // 少量の表情対応葉の説明を、配合全体の味だと言い切らない。
  if (dominant?.weight >= .5) {
    const expression = expressionOf(dominant.flavor);
    const label = position < .35 ? expression.low_label
      : position > .65 ? expression.high_label : expression.middle_label;
    if (typeof label === "string" && label.trim()) return label;
  }
  return strengthLabel(values);
}

/** 商品の素材特性。強さは品質の高さではなく、熱による仕上がり予想とも別。 */
export function flavorFeatures(flavor) {
  const tags = [
    [stat(flavor, "sweet_natural") >= 6, "甘い香り"],
    [stat(flavor, "sweet_confection") >= 6, "お菓子感"],
    [stat(flavor, "cooling") >= 6, "清涼"],
    [stat(flavor, "spiciness") >= 5, "スパイス"],
    [stat(flavor, "sourness") >= 6, "酸味"],
    [stat(flavor, "floral") >= 5, "花の香り"],
  ].filter(([show]) => show).map(([, label]) => label).slice(0, 2);
  const tolerance = Number.isFinite(flavor?.heat_tolerance) && flavor.heat_tolerance > 0 ? flavor.heat_tolerance : 1;
  const expression = expressionOf(flavor);
  const low = expression?.low_label, high = expression?.high_label;
  return {
    tags,
    axes: [
      { key: "assertiveness", label: "香りの主張", value: stat(flavor, "assertiveness") },
      { key: "cooling", label: "清涼感", value: stat(flavor, "cooling") },
      { key: "sourness", label: "酸味", value: stat(flavor, "sourness") },
    ],
    heatNote: tolerance >= 1.15 ? "熱はしっかりめが目安" : tolerance <= .88 ? "控えめな熱から合わせる" : "標準の熱から合わせる",
    thermalNote: typeof low === "string" && typeof high === "string" ? `帯の低め：${low}／高め：${high}` : "",
  };
}

/**
 * 現在の配合と温度から感じる仕上がりを返す。熟練によって実物の味は変えない。
 * 表情データは配合の良好帯内を低め→中央→高めに補間。未定義の葉は素材推定を維持する。
 * 熱が帯外へ外れたときは表情を外挿せず、香りの出不足・損失として扱う。
 */
export function mixExpression(cs, temp, { catalog = DB.flavorById } = {}) {
  const entries = entriesOf(cs, catalog), bands = temperatureBands(cs, catalog);
  const at = Number.isFinite(temp) ? temp : bands.center;
  const width = bands.ideal[1] - bands.ideal[0];
  const position = clamp((at - bands.ideal[0]) / width, 0, 1);
  const outside = Math.max(0, bands.ideal[0] - at, at - bands.ideal[1]);
  const aromaScale = clamp(1 - outside * 3, 0, 1);
  const values = Object.fromEntries(KEYS.map(key => [key, 0]));
  for (const entry of entries) {
    const leaf = atPosition(entry.flavor, position);
    for (const key of KEYS) values[key] += leaf[key] * entry.weight;
  }
  // 清涼・酸味・スパイスで甘い印象の目立ち方が変わる。甘い香りの系統値は変えない。
  values.sweetness = clamp(values.sweetness - .08 * values.cooling - .10 * values.sourness - .05 * values.spiciness);
  for (const key of KEYS) values[key] = clamp(values[key] * aromaScale);
  const zone = at < bands.ideal[0] ? "cold" : at > bands.ideal[1] ? "hot"
    : position < .35 ? "low" : position > .65 ? "high" : "middle";
  return {
    values, zone,
    label: !entries.length ? "未選択" : zone === "cold" ? "熱が足りず、香りが弱い"
      : zone === "hot" ? "熱が強く、香りが崩れ気味" : profileLabel(entries, position, values),
    expressive: entries.some(entry => expressionOf(entry.flavor)),
  };
}

/** 熟練は予測の誤差だけを狭める。低め〜高めで生まれる味の幅は残す。 */
export function forecastExpression(cs, { precision = 0, catalog = DB.flavorById } = {}) {
  const selected = entriesOf(cs, catalog).length > 0;
  const bands = temperatureBands(cs, catalog);
  const samples = [0, .25, .5, .75, 1].map(position => mixExpression(cs,
    position === 1 ? bands.ideal[1] : bands.ideal[0] + (bands.ideal[1] - bands.ideal[0]) * position, { catalog }));
  const margin = .25 + 1.25 * (1 - clamp(precision, 0, 1));
  return {
    selected,
    axes: AXES.map(axis => ({
      ...axis,
      low: selected ? Math.floor(clamp(Math.min(...samples.map(s => s.values[axis.key])) - margin) * 10) / 10 : 0,
      high: selected ? Math.ceil(clamp(Math.max(...samples.map(s => s.values[axis.key])) + margin) * 10) / 10 : 0,
    })),
    lowLabel: selected ? samples[0].label : "",
    highLabel: selected ? samples.at(-1).label : "",
    note: selected ? "適温に仕上げた場合の目安" : "葉を選ぶと仕上がりの目安を表示",
    expressive: samples[0].expressive,
  };
}
