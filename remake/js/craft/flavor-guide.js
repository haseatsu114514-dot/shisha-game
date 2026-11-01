// 選択画面の基本情報は熟練度に関係なく開示。強さと品質、素材と仕上がりを分ける。
import { state } from "../core/state.js";
import { DB } from "../core/data.js";
import { floralLayers } from "../core/growth-effects.js";
import { el, clamp } from "../core/util.js";
import { flavorFeatures, forecastExpression, mixExpression } from "./flavor-profile.js";
import { compareEquipment, equipSpecOf, flavorThermalGuide } from "./temperature-model.js";
import { coalWarmth } from "./coals.js";

const strength = value => value < 3 ? "控えめ" : value < 6 ? "中ほど" : "強め";
const format = value => String(Math.round(clamp(value, 0, 10) * 10) / 10);

/** 葉の特徴は一本、予想は区間。数値と文字でも読めるため色に依存しない。 */
export function flavorAxes(axes, { forecast = false } = {}) {
  return el(`div.flavor-axes${forecast ? ".is-forecast" : ""}`, axes.map(axis => {
    const low = clamp(forecast ? axis.low : axis.value, 0, 10);
    const high = clamp(forecast ? axis.high : axis.value, low, 10);
    const range = forecast ? `${format(low)}〜${format(high)}` : format(high);
    const description = `${axis.label}：${range} / 10${forecast ? "（予想）" : `・${strength(high)}`}`;
    return el("div.flavor-axis", { dataset: { axis: axis.key } }, [
      el("span.flavor-axis-label", { text: axis.label }),
      el("span.flavor-axis-track", {
        role: "meter", "aria-label": axis.label, "aria-valuemin": 0, "aria-valuemax": 10,
        "aria-valuenow": (low + high) / 2, "aria-valuetext": description,
        style: { "--axis-low": `${low * 10}%`, "--axis-high": `${high * 10}%` },
      }, [el("i", { "aria-hidden": "true" })]),
      el("span.flavor-axis-value", { text: range, "aria-hidden": "true" }),
    ]);
  }));
}

export function flavorTags(flavor) {
  return flavorFeatures(flavor).tags.slice(0, 2).join("・");
}

/** 予想の区間と区別し、実際に提供した温度から読む一本の棒。品質点にはしない。 */
export function actualExpressionCard(cs, temp) {
  const expression = mixExpression(cs, temp);
  const layers=floralLayers(state,cs,DB.flavorById),round=Math.min(2,Math.max(0,cs.careRound||0));
  return el("section.flavor-actual", { dataset: { test: "actual-flavor", zone: expression.zone } }, [
    el("b", { text: `今回の仕上がり · ${expression.label}` }),
    layers.length?el("p.flavor-guide-caption",{dataset:{test:"floral-layer"},text:round===2?"重なった花の余韻が立つ":`${layers[round%layers.length].name}の層が立つ`}):null,
    flavorAxes([["sweetness", "甘い印象"], ["cooling", "清涼感"], ["body", "煙の厚み"]].map(([key, label]) =>
      ({ key, label, value: expression.values[key] }))),
    el("small.flavor-guide-caption", { text: "提供時の味の傾向。強さと品質は別です。" }),
  ]);
}

export function flavorFeatureCard(flavor, { description = "", makerLabel = "" } = {}) {
  const feature = flavorFeatures(flavor), thermal = flavorThermalGuide(flavor);
  return el("section.flavor-feature-card", { dataset: { test: "flavor-feature-card" } }, [
    el("div.flavor-guide-tags", feature.tags.map(text => el("span", { text }))),
    flavorAxes(feature.axes),
    el("p.flavor-guide-note", { text: feature.thermalNote || feature.heatNote }),
    el("small.flavor-guide-caption", { text: "葉の特徴。棒は強さの目安で、品質点ではありません。" }),
    el("details.flavor-guide-more", [
      el("summary", { text: "香り・メーカーの特徴" }),
      description ? el("p", { text: description }) : null,
      el("p", { text: "甘い香り・お菓子感は香りの系統。感じる甘さは配合と加熱で変わります。" }),
      thermal ? el("p", { dataset: { test: "shop-flavor-guide" }, text: `${makerLabel || thermal.makerLabel} ／ 適温幅：${thermal.widthLabel}` }) : null,
      thermal?.traitLabel ? el("p", { text: thermal.traitLabel }) : null,
    ]),
  ]);
}

export function mixForecastCard(cs, { precision = 0, mastery, aroma, compact = false } = {}) {
  const forecast = forecastExpression(cs, { precision });
  // 配合の加重平均は表示時だけ切り捨て、次の段階やMAXを先取りしない。
  // 全葉MAXの平均が5未満になるような、整数境界の浮動小数誤差だけを補う。
  const level = mastery ? Math.floor(clamp(mastery.level + Number.EPSILON * 5, 1, 5)) : 1;
  const stars = `${"★".repeat(level)}${"☆".repeat(5 - level)}${level === 5 ? " MAX" : ""}`;
  const title = el("b", { text: aroma?.headline || "仕上がりの目安" });
  if (!forecast.selected) return el("div.flavor-forecast", [title,
    el("p.flavor-guide-note", { text: "葉を足すと、仕上がりの予想を表示します。" })]);
  const rangeLabel = precision < .35 ? "広い" : precision < .7 ? "ほどほど" : "絞れる";
  const content = [
    el("small.flavor-guide-caption", { text: `仕上がりの目安 · 予想幅：${rangeLabel}` }),
    flavorAxes(forecast.axes, { forecast: true }),
    forecast.expressive ? el("div.flavor-heat-choices", [
      el("span", [el("b", { text: "低め" }), ` ${forecast.lowLabel}`]),
      el("span", [el("b", { text: "高め" }), ` ${forecast.highLabel}`]),
    ]) : null,
    el("details.flavor-guide-more", [
      el("summary", { dataset: { test: "mix-mastery-summary" }, text: mastery
        ? `熟練 ${stars} · ${cs.mode === "tournament" ? `大会 +${mastery.bonus.toFixed(1)}` : "香りと予想に効く"}`
        : "予想の読み方" }),
      aroma?.detail ? el("p", { text: aroma.detail }) : null,
      el("p", { text: `${forecast.note}。実際の仕上がりは加熱で変わります。` }),
      el("p", { text: "棒が長いほど強い傾向。品質の高さではありません。使い慣れた葉ほど予想幅が絞れます。" }),
      mastery ? el("p", { text: "熟練は使った量の比率で、香りの再現・予測・大会点に効きます。葉の基本情報は最初から見られます。" }) : null,
    ]),
  ];
  return el(`div.flavor-forecast${compact ? ".is-compact" : ""}`, { dataset: { test: "mix-forecast", precision: format(precision), expressive: String(forecast.expressive) } },
    compact ? [el("details.flavor-forecast-compact", [el("summary", { text: `仕上がりの目安 · ${aroma?.headline || "予想を見る"}` }), ...content])]
      : [title, ...content]);
}

// 文言は現行の計算に効く性能に限る。HMDの未接続の温まり方・蓄熱は説明しない。
const EQUIPMENT_USE = {
  silicone_bowl: ["12gの葉を使う基本の器", "容量を増やしたい時は別の器へ"],
  hagal_80beat: ["最大15g。葉を増やして厚みを出す", "多く詰めるほど蒸らしは長め"],
  nightside_premier_hagal: ["最大15g。温度を合わせやすい器", "多く詰めるほど蒸らしは長め"],
  suyaki_hagal: ["最大20g。量を使って厚い味へ", "適温幅は狭め。温度合わせが要る"],
  lotos_hagal: ["全サイズ対応の基本HMD", "熱の合わせ方を覚える基準に"],
  tanukish_lid: ["適温幅が広く、温度を合わせやすい", "20gの素焼きには装着できない"],
  winkwink_hagal: ["大きい器にも対応。適温幅が広め", "容量はハガル側で決まる"],
  amaburst_hms: ["全サイズ対応。繊細な温度合わせに", "適温幅が狭いので温度を見よう"],
  flat_charcoal: ["低めの熱へ細かく合わせやすい", "大容量・デンスは立ち上げ長め"],
  cube_charcoal: ["大容量・デンスにも熱を入れやすい", "温度の上がりすぎに注意"],
};

export function equipmentUse(item) {
  const [use, caution] = EQUIPMENT_USE[item?.id] || (String(item?.id || "").startsWith("suyaki_")
    ? ["大容量。使い込んだ香りを活かす", "葉の系統を合わせ、温度は丁寧に"]
    : [item?.description || "", ""]);
  return { use, caution };
}

export function equipmentGuide(item, currentId) {
  const guide = equipmentUse(item), comparison = compareEquipment(item.id, currentId);
  const target = equipSpecOf(item.id), current = equipSpecOf(currentId) || target;
  const rows = comparison ? [comparison.rows[0]] : [];
  if (target?.type === "bowl") rows.push({ label: "容量", value: `${current.capacity}g → ${target.capacity}g。葉を増やす時は蒸らしも長めに` });
  if (target?.type === "hms") rows.push(
    { label: "熱の安定", value: `仕上がり補正 +${current.stabilityBonus} → +${target.stabilityBonus}` },
    { label: "対応する器", value: target.fitNote });
  if (target?.type === "charcoal") {
    const heat = id => coalWarmth({ equip: { charcoal: id }, place: "triangle" });
    const before = heat(current.id), after = heat(target.id);
    rows.push({ label: "3個の加熱", value: `×${before.power.toFixed(2)} → ×${after.power.toFixed(2)}` },
      { label: "熱を入れる吸いの反応", value: `×${before.pullResponse.toFixed(2)} → ×${after.pullResponse.toFixed(2)}。大きいほど1口で熱が入る` });
  }
  return el("div.equipment-guide", [
    el("p", [el("b", { text: "得意 " }), guide.use]),
    guide.caution ? el("p", [el("b", { text: "注意 " }), guide.caution]) : null,
    comparison ? el("details.flavor-guide-more", [
      el("summary", { text: "装備との詳しい比較" }),
      el("dl.equipment-guide-rows", { dataset: { test: "shop-equip-compare" } }, rows.flatMap(row => [
        el("dt", { text: row.label }), el("dd", { text: row.value }),
      ])),
    ]) : null,
  ]);
}
