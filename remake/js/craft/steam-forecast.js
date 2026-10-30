// タイマー設定・蒸らしで共通の温度計。予測は現在地の矢印と別の、幅のある点線で示す。
import { el } from "../core/util.js";
import { temperatureBands, isIdealTemperature, isOptimalTemperature, DANGER_TEMP, temperatureAfterSteam, steamTemperatureRange } from "./conditions.js";
import { steamClimate } from "./steam-climate.js";
import { buildThermometer } from "./thermometer.js";
import { effectBadge } from "./effect-visual.js";

const weatherIcon = (rainy) => rainy
  ? '<svg viewBox="0 0 24 24"><path d="M6 15a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9H6M7 18l-1 3m7-3-1 3m7-3-1 3"/></svg>'
  : '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></svg>';

export function buildSteamWeather(cs) {
  const { rainy, ambientC } = steamClimate(cs.environment);
  return el("div.steam-weather", { dataset: { test: "steam-weather" } }, [
    el("i", { html: weatherIcon(rainy), "aria-hidden": "true" }),
    el("span", { text: rainy ? "雨" : "晴れ" }),
    el("span", { text: `気温 ${ambientC}℃` }),
  ]);
}

export function buildSteamTemperature(cs) {
  const thermometer = buildThermometer({ cs, compact: true, width: 64, height: 360 });
  const state = el("span.pull-state");
  const read = el("div.pull-read.steam-temperature-read", [state]);
  thermometer.root.append(read);
  return { ...thermometer, update(temp) {
    thermometer.update(temp);
    const bands = temperatureBands(cs);
    const expressive = bands.expressionWeight >= .999;
    state.textContent = expressive && isIdealTemperature(temp, bands) ? "適温" : thermometer.root.getAttribute("aria-valuetext");
    read.dataset.tone = temp >= DANGER_TEMP ? "danger" : !expressive && isOptimalTemperature(temp, bands) ? "optimal" : isIdealTemperature(temp, bands) ? "ok" : temp > bands.ideal[1] ? "hot" : "cool";
  } };
}

const temperatureName = (temp, bands) => isIdealTemperature(temp, bands)
  ? bands.expressionWeight >= .999 ? "適温" : isOptimalTemperature(temp, bands) ? "最適温" : "適温"
  : temp > bands.ideal[1] ? "熱い" : temp < .2 * bands.t ? "低温" : "ぬるい";

export function buildSteamForecast(cs, thermometer) {
  const rangeText = el("b.steam-forecast-value", { dataset: { test: "steam-forecast-text" } });
  const note = el("span.steam-forecast-note");
  const root = el("div.steam-forecast", { dataset: { test: "steam-forecast" } }, [
    el("div.steam-forecast-heading", [effectBadge("insight", "察"), el("span", { text: "蒸らし後の温度の目安" }), rangeText]),
    buildSteamWeather(cs), note,
  ]);
  return { root, update(seconds) {
    const bounds = steamTemperatureRange(cs, seconds);
    thermometer.update(temperatureAfterSteam({ ...cs, steamSeconds: Math.max(10, seconds) }, 0, cs.steamVariation ?? 0));
    thermometer.range(bounds);
    if (!bounds) {
      delete root.dataset.low; delete root.dataset.high;
      rangeText.textContent = "—";
      note.textContent = "";
      return;
    }
    const bands = temperatureBands(cs);
    const low = temperatureName(bounds.low, bands), high = temperatureName(bounds.high, bands);
    rangeText.textContent = low === high ? `${low}のあたり` : `${low}〜${high}`;
    root.dataset.low = String(bounds.low); root.dataset.high = String(bounds.high);
    note.textContent = steamClimate(cs.environment).rainy
      ? "雨で熱が入りにくい日。目安から前後する"
      : "気温や炭の状態で、目安から前後する";
  } };
}
