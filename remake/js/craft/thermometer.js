// 蒸らし・吸い出し・熱管理で同じ温度の目盛り・適温帯を使う。
// 管は一本のグラデーション（クリーム→黄→適温のミント→橙→赤→深紅）。薄い横目盛りを重ね、現在地より上だけ少し暗くする。
// 文字の目盛りは置かず、管の中の印で示す: 適温の両端に刻み、真ん中に虹の最適温（適温／最適温／適温のサンド）、
// 一番上の焦げる帯に炎、熱管理の冷え切り帯に雪の結晶（TH32〜TH35）。
import { el } from "../core/util.js";
import { IDEAL, OPTIMAL, DANGER_TEMP, isOptimalTemperature } from "./conditions.js";
import { makingUrl } from "../core/data.js";
import { artImg } from "./art.js";

const FLAME = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.2 1c.6 2.6 3.8 4.1 3.8 7.6A4 4 0 0 1 4 8.9c0-1.7.8-2.9 1.9-3.8-.1 1.6.6 2.6 1.6 2.8C7 6 7.3 3.3 8.2 1Z"/></svg>`;
const SNOW = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M6.3 2.6 8 4.2l1.7-1.6M6.3 13.4 8 11.8l1.7 1.6" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const POINTER = `<svg viewBox="0 0 30 30"><path d="M2.5 15 27 3.5 21.5 15 27 26.5Z" stroke="#120a10" stroke-width="3" stroke-linejoin="round"/></svg>`;
const pct = (f) => `${f * 100}%`;

export function buildThermometer({ compact = false, unsteady = false, coldLimit = null, height = 440, width = 76 } = {}) {
  const mark = el("i.thermo-mark"), dim = el("i.thermo-dim");
  // 管の外から今の温度を指す、目立つ矢印（TH30）。黒い縁取りで金枠・背景に埋もれさせない（TH85）。
  const pointer = el("i.thermo-pointer", { "aria-hidden": "true", dataset: { test: "thermo-pointer" }, html: POINTER });
  const projected = el("i.thermo-projected", { hidden: true, "aria-hidden": "true" });
  const range = el("i.thermo-range", { hidden: true, "aria-hidden": "true", dataset: { test: "steam-forecast-range" } });
  const rangeNote = el("span.thermo-range-note", { hidden: true, text: "目安", "aria-hidden": "true" });
  const projectedLabel = el("span.thermo-projected-label", { hidden: true, text: "点線：止めたらここ", dataset: { test: "pull-projection" } });
  const tube = el("div.thermo-tube", [
    el("div.thermo-scale"),
    el("div.thermo-heat", { style: { bottom: pct(IDEAL[1]) } }),
    dim,
    el("div.thermo-danger", { style: { bottom: pct(DANGER_TEMP) }, title: "焦げる", dataset: { test: "thermo-danger" } }, [el("i.thermo-icon.flame", { html: FLAME })]),
    coldLimit ? el("div.thermo-cold", { style: { height: pct(coldLimit) }, title: "冷え切り", dataset: { test: "thermo-cold" } }, [el("i.thermo-icon.snow", { html: SNOW })]) : null,
    el("div.thermo-zone", { style: { bottom: pct(IDEAL[0]), height: pct(IDEAL[1] - IDEAL[0]) }, title: "適温" }),
    el("div.thermo-optimal", { style: { bottom: pct(OPTIMAL[0]), height: pct(OPTIMAL[1] - OPTIMAL[0]) }, title: "最適温", dataset: { test: compact ? "steam-optimal" : "pull-optimal" } }),
    projected, range, mark,
  ]);
  const framed = !!makingUrl("ui_temperature_frame.png");
  const frameWidth = width;
  const housing = framed ? el("div.thermo-housing", { style: { "--thermo-width": `${frameWidth}px` } }, [
    tube, artImg("ui_temperature_frame.png", frameWidth, "thermo-skin", { h: height }),
  ]) : tube;
  const root = el(`div.thermo${compact ? ".steam-temperature" : ""}${unsteady ? ".unsteady" : ""}`, {
    role: "meter", "aria-label": "煙の温度", "aria-valuemin": "0", "aria-valuemax": "1", dataset: { test: compact ? "steam-temperature" : "pull-temperature" },
    style: { "--thermo-inset": framed ? "10%" : "0%", "--thermo-span": framed ? `${frameWidth}px` : "44px" },
  }, [
    housing,
    pointer,
    projectedLabel,
    rangeNote,
  ]);
  let last = 0;
  return { root, update(temp) {
    last = temp;
    mark.style.bottom = pct(temp);
    dim.style.bottom = pct(temp);
    pointer.style.bottom = `calc(var(--thermo-inset) + ${temp} * (100% - 2 * var(--thermo-inset)) - 15px)`;
    root.classList.toggle("ok", temp >= IDEAL[0] && temp <= IDEAL[1]);
    root.classList.toggle("optimal", isOptimalTemperature(temp));
    root.classList.toggle("danger", temp >= DANGER_TEMP);
    root.classList.toggle("hot", temp > IDEAL[1] && temp < DANGER_TEMP);
    root.classList.toggle("cool", temp < IDEAL[0]);
    root.classList.toggle("freezing", !!coldLimit && temp <= coldLimit + 0.06);
    root.setAttribute("aria-valuenow", temp.toFixed(4));
    root.setAttribute("aria-valuetext", temp >= DANGER_TEMP ? "焦げる寸前" : isOptimalTemperature(temp) ? "最適温" : temp > IDEAL[1] ? "熱い" : temp >= IDEAL[0] ? "適温" : "ぬるい");
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
