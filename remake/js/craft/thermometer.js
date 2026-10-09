// 蒸らし・吸い出し・熱管理で同じ温度の目盛り・適温帯を使う。
// 管は黒く抜かず、冷たい青→虹の適温→橙→赤の色を全体に置き、今の温度より上だけを少し暗くする。
// 適温を超えると管の中で炎が立ち、焦げる寸前（危険帯）と、熱管理の冷え切り帯は縞で一目で分かるようにする（TH23）。
import { el } from "../core/util.js";
import { IDEAL, OPTIMAL, DANGER_TEMP, isOptimalTemperature } from "./conditions.js";
import { makingUrl } from "../core/data.js";
import { artImg } from "./art.js";

const pct = (f) => `${f * 100}%`;

export function buildThermometer({ compact = false, unsteady = false, coldLimit = null } = {}) {
  const fill = el("b"), mark = el("i.thermo-mark"), dim = el("i.thermo-dim");
  const projected = el("i.thermo-projected", { hidden: true, "aria-hidden": "true" });
  const projectedLabel = el("span.thermo-projected-label", { hidden: true, text: "点線：止めたらここ", dataset: { test: "pull-projection" } });
  const tube = el("div.thermo-tube", [
    el("div.thermo-scale"),
    el("div.thermo-heat", { style: { bottom: pct(IDEAL[1]) } }),
    el("div.thermo-danger", { style: { bottom: pct(DANGER_TEMP) }, dataset: { test: "thermo-danger" } }),
    coldLimit ? el("div.thermo-cold", { style: { height: pct(coldLimit) }, dataset: { test: "thermo-cold" } }) : null,
    el("div.thermo-zone", { style: { bottom: pct(IDEAL[0]), height: pct(IDEAL[1] - IDEAL[0]) } }),
    el("div.thermo-optimal", { style: { bottom: pct(OPTIMAL[0]), height: pct(OPTIMAL[1] - OPTIMAL[0]) }, dataset: { test: compact ? "steam-optimal" : "pull-optimal" } }),
    dim, fill, projected, mark,
  ]);
  const framed = !!makingUrl("ui_temperature_frame.png");
  const housing = framed ? el("div.thermo-housing", { style: { "--thermo-width": compact ? "54px" : "76px" } }, [
    tube, artImg("ui_temperature_frame.png", compact ? 54 : 76, "thermo-skin", { h: compact ? 300 : 440 }),
  ]) : tube;
  // 目盛りの文字を管の中の位置へ合わせる（額縁つきは上下10%が枠）。
  const at = (f) => ({ bottom: `calc(var(--thermo-inset) + ${f} * (100% - 2 * var(--thermo-inset)))` });
  const root = el(`div.thermo${compact ? ".steam-temperature" : ""}${unsteady ? ".unsteady" : ""}`, {
    role: "meter", "aria-label": "煙の温度", "aria-valuemin": "0", "aria-valuemax": "1", dataset: { test: compact ? "steam-temperature" : "pull-temperature" },
    style: { "--thermo-inset": framed ? "10%" : "0%" },
  }, [
    housing,
    projectedLabel,
    el("div.thermo-labels", [
      el("span.thermo-danger-label", { text: "焦げる", style: at(DANGER_TEMP + 0.02) }),
      el("span.thermo-ideal-label", { text: "適温", style: at(IDEAL[1]) }),
      el("span.thermo-optimal-label", { text: "最適温", style: at(0.5) }),
      coldLimit ? el("span.thermo-cold-label", { text: "冷え切り", style: at(0.01) }) : el("span.thermo-cool-label", { text: "ぬるい", style: at(0.01) }),
    ]),
  ]);
  return { root, update(temp) {
    fill.style.height = pct(temp);
    mark.style.bottom = pct(temp);
    dim.style.bottom = pct(temp);
    root.classList.toggle("ok", temp >= IDEAL[0] && temp <= IDEAL[1]);
    root.classList.toggle("optimal", isOptimalTemperature(temp));
    root.classList.toggle("danger", temp >= DANGER_TEMP);
    root.classList.toggle("freezing", !!coldLimit && temp <= coldLimit + 0.06);
    root.setAttribute("aria-valuenow", temp.toFixed(4));
    root.setAttribute("aria-valuetext", temp >= DANGER_TEMP ? "焦げる寸前" : isOptimalTemperature(temp) ? "最適温" : temp > IDEAL[1] ? "熱い" : temp >= IDEAL[0] ? "適温" : "ぬるい");
  }, preview(temp) {
    projected.hidden = projectedLabel.hidden = compact || temp == null;
    if (temp == null) return;
    projected.style.bottom = pct(temp);
    projectedLabel.dataset.temperature = temp.toFixed(4);
  } };
}
