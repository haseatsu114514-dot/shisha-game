// 蒸らしと吸い出しで同じ温度の目盛り・適温帯を使う。
import { el } from "../core/util.js";
import { IDEAL, EDGE_WIDTH, isTemperatureEdge } from "./conditions.js";

export function buildThermometer({ compact = false, unsteady = false } = {}) {
  const fill = el("b"), mark = el("i.thermo-mark");
  const root = el(`div.thermo${compact ? ".steam-temperature" : ""}${unsteady ? ".unsteady" : ""}`, {
    role: "meter", "aria-label": "煙の温度", "aria-valuemin": "0", "aria-valuemax": "1", dataset: { test: compact ? "steam-temperature" : "pull-temperature" },
  }, [
    el("div.thermo-tube", [
      el("div.thermo-zone", { style: { bottom: `${IDEAL[0] * 100}%`, height: `${(IDEAL[1] - IDEAL[0]) * 100}%` } }),
      ...[IDEAL[0], IDEAL[1] - EDGE_WIDTH].map((from) => el("div.thermo-edge", { style: { bottom: `${from * 100}%`, height: `${EDGE_WIDTH * 100}%` }, dataset: { test: compact ? "steam-edge" : "pull-edge" } })),
      fill, mark,
    ]),
    el("div.thermo-labels", [el("span", { text: "熱い" }), el("span", { text: "適温" }), el("span", { text: "ぬるい" })]),
  ]);
  return { root, update(temp) {
    fill.style.height = `${temp * 100}%`;
    mark.style.bottom = `${temp * 100}%`;
    root.classList.toggle("ok", temp >= IDEAL[0] && temp <= IDEAL[1]);
    root.classList.toggle("edge", isTemperatureEdge(temp, IDEAL));
    root.setAttribute("aria-valuenow", temp.toFixed(4));
    root.setAttribute("aria-valuetext", temp > IDEAL[1] ? "熱い" : temp >= IDEAL[0] ? "適温" : "ぬるい");
  } };
}
