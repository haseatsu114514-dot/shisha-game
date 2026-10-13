// 蒸らし・吸い出し・熱管理で同じ温度の目盛り・適温帯を使う。
// 管は一本のグラデーション（クリーム→黄→適温のミント→橙→赤→深紅）。薄い横目盛りを重ね、現在地より上だけ少し暗くする。
// 文字の目盛りは置かず、管の中の印で示す: 適温の両端に刻み、真ん中に虹の最適温（適温／最適温／適温のサンド）、
// 一番上の焦げる帯に炎、熱管理の冷え切り帯に雪の結晶（TH32〜TH35）。
import { el } from "../core/util.js";
import { DANGER_TEMP, temperatureBands, isIdealTemperature, isOptimalTemperature, visualTemperature } from "./temperature-model.js";
import { makingUrl } from "../core/data.js";
import { artImg } from "./art.js";

const FLAME = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.2 1c.6 2.6 3.8 4.1 3.8 7.6A4 4 0 0 1 4 8.9c0-1.7.8-2.9 1.9-3.8-.1 1.6.6 2.6 1.6 2.8C7 6 7.3 3.3 8.2 1Z"/></svg>`;
const SNOW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M6.3 2.6 8 4.2l1.7-1.6M6.3 13.4 8 11.8l1.7 1.6" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const POINTER = `<svg viewBox="0 0 30 30"><path d="M2.5 15 27 3.5 21.5 15 27 26.5Z" stroke="#120a10" stroke-width="3" stroke-linejoin="round"/></svg>`;
const pct = (f) => `${f * 100}%`;
const SCALE_COLORS = [[0, "#fff4d2"], [.13, "#ffedb0"], [.26, "#ffe270"], [.37, "#ffd12a"], [.40, "#f6d559"], [.42, "#67d2a3"],
  [.44, "#4fcf98"], [.54, "#74e0b0"], [.64, "#4fcf98"], [.66, "#79d9a9"], [.71, "#ffb247"], [.76, "#ff8a2a"],
  [.83, "#ff3f17"], [.89, "#eb210d"], [.94, "#b0140a"], [1, "#650609"]];

export function buildThermometer({ cs, compact = false, bandPreview = false, unsteady = false, coldLimit = null, height = 440, width = 76 } = {}) {
  let bands;
  const mark = el("i.thermo-mark"), dim = el("i.thermo-dim");
  // 管の外から今の温度を指す、目立つ矢印（TH30）。黒い縁取りで金枠・背景に埋もれさせない（TH85）。
  const pointer = el("i.thermo-pointer", { "aria-hidden": "true", dataset: { test: "thermo-pointer" }, html: POINTER });
  const projected = el("i.thermo-projected", { hidden: true, "aria-hidden": "true" });
  const range = el("i.thermo-range", { hidden: true, "aria-hidden": "true", dataset: { test: "steam-forecast-range" } });
  const rangeNote = el("span.thermo-range-note", { hidden: true, text: "目安", "aria-hidden": "true" });
  const projectedLabel = el("span.thermo-projected-label", { hidden: true, text: "点線：止めたらここ", dataset: { test: "pull-projection" } });
  const tube = el("div.thermo-tube", [
    el("div.thermo-scale"),
    el("div.thermo-heat"),
    dim,
    el("div.thermo-danger", { style: { bottom: pct(DANGER_TEMP) }, title: "焦げる", dataset: { test: "thermo-danger" } }, [el("i.thermo-icon.flame", { html: FLAME })]),
    coldLimit ? el("div.thermo-cold", { style: { height: pct(coldLimit) }, title: "冷え切り", dataset: { test: "thermo-cold" } }, [el("i.thermo-icon.snow", { html: SNOW })]) : null,
    el("div.thermo-zone", { title: "適温" }),
    el("div.thermo-optimal", { title: "最適温", dataset: { test: bandPreview ? "mix-optimal" : compact ? "steam-optimal" : "pull-optimal" } }),
    projected, range, mark,
  ]);
  const framed = !!makingUrl("ui_temperature_frame.png");
  const frameWidth = width;
  const housing = framed ? el("div.thermo-housing", { style: { "--thermo-width": `${frameWidth}px` } }, [
    tube, artImg("ui_temperature_frame.png", frameWidth, "thermo-skin", { h: height }),
  ]) : tube;
  const root = el(`div.thermo${compact ? ".steam-temperature" : ""}${bandPreview ? ".mix-temperature" : ""}${unsteady ? ".unsteady" : ""}`, {
    role: bandPreview ? "img" : "meter", "aria-label": bandPreview ? "配合の適温・最適温" : "煙の温度",
    "aria-valuemin": bandPreview ? null : "0", "aria-valuemax": bandPreview ? null : "1", dataset: { test: bandPreview ? "mix-temperature" : compact ? "steam-temperature" : "pull-temperature" },
    style: { "--thermo-inset": framed ? "10%" : "0%", "--thermo-span": framed ? `${frameWidth}px` : "44px" },
  }, [
    housing,
    pointer,
    projectedLabel,
    rangeNote,
  ]);
  const zone = tube.querySelector(".thermo-zone"), optimal = tube.querySelector(".thermo-optimal"), heat = tube.querySelector(".thermo-heat");
  // プレビューは現在温度を持たず、実プレイと同じ管・緑・虹だけを見せる。
  if (bandPreview) { pointer.hidden = mark.hidden = dim.hidden = true; }
  const updateBands = () => {
    const next = temperatureBands(cs);
    if (bands?.t === next.t) return bands;
    bands = next;
    zone.style.bottom = pct(bands.ideal[0]); zone.style.height = pct(bands.ideal[1] - bands.ideal[0]);
    optimal.style.bottom = pct(bands.optimal[0]); optimal.style.height = pct(bands.optimal[1] - bands.optimal[0]);
    heat.style.bottom = pct(bands.ideal[1]);
    root.style.setProperty("--thermo-gradient", `linear-gradient(0deg, ${SCALE_COLORS.map(([at, color]) => `${color} ${pct(visualTemperature(at, bands))}`).join(", ")})`);
    Object.assign(root.dataset, { tolerance: bands.t, idealLow: bands.ideal[0], idealHigh: bands.ideal[1], optimalLow: bands.optimal[0], optimalHigh: bands.optimal[1] });
    if (bandPreview) root.setAttribute("aria-label", `配合の温度帯：緑の適温 ${formatTemperatureRange(bands.ideal)}、虹の最適温 ${formatTemperatureRange(bands.optimal)}`);
    return bands;
  };
  updateBands();
  let last = 0;
  return { root, updateBands, update(temp) {
    updateBands();
    last = temp;
    mark.style.bottom = pct(temp);
    dim.style.bottom = pct(temp);
    pointer.style.bottom = `calc(var(--thermo-inset) + ${temp} * (100% - 2 * var(--thermo-inset)) - 15px)`;
    root.classList.toggle("ok", isIdealTemperature(temp, bands));
    root.classList.toggle("optimal", isOptimalTemperature(temp, bands));
    root.classList.toggle("danger", temp >= DANGER_TEMP);
    root.classList.toggle("hot", temp > bands.ideal[1] && temp < DANGER_TEMP);
    root.classList.toggle("cool", temp < bands.ideal[0]);
    root.classList.toggle("freezing", !!coldLimit && temp <= coldLimit + 0.06);
    root.setAttribute("aria-valuenow", temp.toFixed(4));
    root.setAttribute("aria-valuetext", temp >= DANGER_TEMP ? "焦げる寸前" : isOptimalTemperature(temp, bands) ? "最適温" : temp > bands.ideal[1] ? "熱い" : isIdealTemperature(temp, bands) ? "適温" : "ぬるい");
  },
  /** 吸った直後、今の温度の横に ▲／＝／▼ の印を浮かべる（判定の文字の代わり TH36）。 */
  pop(text, dir = "keep") {
    const p = el(`i.thermo-pop.${dir}`, { text, "aria-hidden": "true", style: { bottom: `calc(var(--thermo-inset) + ${last} * (100% - 2 * var(--thermo-inset)))` } });
    root.append(p);
    setTimeout(() => p.remove(), 900);
  }, range(bounds) {
    range.hidden = rangeNote.hidden = !bounds;
    if (!bounds) { delete root.dataset.forecast; return; }
    root.dataset.forecast = "true";
    range.dataset.low = String(bounds.low); range.dataset.high = String(bounds.high);
    range.style.bottom = pct(bounds.low);
    range.style.height = pct(bounds.high - bounds.low);
    rangeNote.style.bottom = `calc(var(--thermo-inset) + ${(bounds.low + bounds.high) / 2} * (100% - 2 * var(--thermo-inset)) - 9px)`;
  }, preview(temp, label = "点線：止めたらここ") {
    projected.hidden = projectedLabel.hidden = compact || temp == null;
    if (temp == null) return;
    if (projectedLabel.textContent !== label) projectedLabel.textContent = label;
    projected.style.bottom = pct(temp);
    projectedLabel.dataset.temperature = temp.toFixed(4);
  } };
}

export const formatTemperatureRange = (band) => `${(band[0] * 100).toFixed(1)}〜${(band[1] * 100).toFixed(1)}%`;
