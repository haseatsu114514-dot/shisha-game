// 就寝→翌朝の夜明けの幕（core/transitions.js の nightToMorning）に出す、その日の天気（CI109）。
// 晴れ・くもり・雨の3つ。天気は daily/weather.js の weatherOf（くもりは見た目だけ）。
import { el } from "../core/util.js";
import { move } from "../core/transition-kit.js";
import { WEATHER_LABEL } from "../daily/weather.js";

/**
 * node: 幕の器（.tr-dawn）。天気の演出をここに足す。weather: "sun" | "cloud" | "rain" | null。
 * 戻り値の badge は DAYカードの下に並べる天気の札（null なら出さない）。
 * fadeOut(ms) は地平線が昇るあいだに演出を薄める。stop() は幕を外すときの後片付け。
 */
export function dawnWeather(node, weather, { reduced = false } = {}) {
  if (!weather) return { badge: null, fadeOut: async () => {}, stop() {} };
  const badge = el("div.tr-dawn-weather", { dataset: { weather } }, [el("span", { text: WEATHER_LABEL[weather] })]);
  let fx = null;
  if (weather === "rain" && !reduced) {
    fx = el("div.tr-dawn-rain");
    for (let i = 0; i < 26; i++) {
      const drop = el("i", { style: { left: `${Math.random() * 115 - 10}%`, height: `${14 + Math.random() * 12}%` } });
      fx.append(drop);
      drop.animate([{ translate: "0 0" }, { translate: "-150px 1150px" }], { duration: 560 + Math.random() * 240, delay: Math.random() * 600, iterations: Infinity, easing: "linear" });
    }
    node.append(fx);
  }
  return {
    badge,
    fadeOut: (ms) => (fx ? move(fx, [{ opacity: 1 }, { opacity: 0.4 }], ms) : Promise.resolve()),
    stop() { fx?.remove(); },
  };
}
