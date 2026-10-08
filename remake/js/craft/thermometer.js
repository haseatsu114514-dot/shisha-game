// 蒸らしと吸い出しで同じ温度の目盛り・適温帯を使う。
import { el } from "../core/util.js";
import { IDEAL, OPTIMAL, isOptimalTemperature } from "./conditions.js";
import { makingUrl } from "../core/data.js";
import { artImg } from "./art.js";

export function buildThermometer({ compact = false, unsteady = false } = {}) {
  const fill = el("b"), mark = el("i.thermo-mark");
  const projected = el("i.thermo-projected", { hidden: true, "aria-hidden": "true" });
  const projectedLabel = el("span.thermo-projected-label", { hidden: true, text: "点線：止めたらここ", dataset: { test: "pull-projection" } });
  const tube = el("div.thermo-tube", [
    el("div.thermo-zone", { style: { bottom: `${IDEAL[0] * 100}%`, height: `${(IDEAL[1] - IDEAL[0]) * 100}%` } }),
    el("div.thermo-optimal", { style: { bottom: `${OPTIMAL[0] * 100}%`, height: `${(OPTIMAL[1] - OPTIMAL[0]) * 100}%` }, dataset: { test: compact ? "steam-optimal" : "pull-optimal" } }),
    fill, projected, mark,
  ]);
  const framed = !!makingUrl("ui_temperature_frame.png");
  const housing = framed ? el("div.thermo-housing", { style: { "--thermo-width": compact ? "54px" : "76px" } }, [
    tube, artImg("ui_temperature_frame.png", compact ? 54 : 76, "thermo-skin", { h: compact ? 300 : 440 }),
  ]) : tube;
  const root = el(`div.thermo${compact ? ".steam-temperature" : ""}${unsteady ? ".unsteady" : ""}`, {
    role: "meter", "aria-label": "煙の温度", "aria-valuemin": "0", "aria-valuemax": "1", dataset: { test: compact ? "steam-temperature" : "pull-temperature" },
  }, [
    housing,
    projectedLabel,
    el("div.thermo-labels", [el("span", { text: "熱い" }), el("span.thermo-ideal-label", { text: "適温" }), el("span.thermo-optimal-label", { text: "最適温" }), el("span", { text: "ぬるい" })]),
  ]);
  return { root, update(temp) {
    fill.style.height = `${temp * 100}%`;
    mark.style.bottom = `${temp * 100}%`;
    root.classList.toggle("ok", temp >= IDEAL[0] && temp <= IDEAL[1]);
    root.classList.toggle("optimal", isOptimalTemperature(temp));
    root.setAttribute("aria-valuenow", temp.toFixed(4));
    root.setAttribute("aria-valuetext", isOptimalTemperature(temp) ? "最適温" : temp > IDEAL[1] ? "熱い" : temp >= IDEAL[0] ? "適温" : "ぬるい");
  }, preview(temp) {
    projected.hidden = projectedLabel.hidden = compact || temp == null;
    if (temp == null) return;
    projected.style.bottom = `${temp * 100}%`;
    projectedLabel.dataset.temperature = temp.toFixed(4);
  } };
}
