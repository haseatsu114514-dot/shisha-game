// その日の天気（晴れ・くもり・雨）の小さなアイコンと札（CI109）。朝のDAYカード（ui.dayCard）が使う。
// 天気は daily/weather.js の weatherOf（くもりは見た目だけ）。
// 就寝→翌朝の夜明け（core/transitions.js の nightToMorning）は 2026-11-11（TMG47）から図形を使わず、
// 窓の光・青み・窓の雨で天気を伝える（ここにあった夜明け用の雲・朝日の図形 dawnWeather は外した）。
import { el } from "../core/util.js";
import { svg } from "../core/transition-kit.js";
import { WEATHER_LABEL } from "../daily/weather.js";

const LAV = "#dcd1f4";
const SUN = "#ffe2a6"; // 朝日の淡い金

/** 雲の形（平らな底に丸いこぶ）。x, y は底の左端、w は幅（高さは幅の約半分） */
function cloud(x, y, w, fill) {
  const h = w * 0.2;
  return svg("g", { fill }, [
    svg("rect", { x, y: y - h, width: w, height: h, rx: h / 2 }),
    svg("circle", { cx: x + w * 0.28, cy: y - h, r: w * 0.17 }),
    svg("circle", { cx: x + w * 0.52, cy: y - h * 1.2, r: w * 0.24 }),
    svg("circle", { cx: x + w * 0.76, cy: y - h * 0.9, r: w * 0.14 }),
  ]);
}

/** 天気の小さなアイコン（48四方の SVG）。parts は動かす部品。tint を渡すと全体をその1色にする */
function icon(weather, tint = null) {
  const parts = {};
  const sunC = tint || SUN, lav = tint || LAV;
  let kids;
  if (weather === "sun") {
    // 晴れ: 丸と8本の光
    parts.rays = svg("g", { class: "tr-scale", stroke: sunC, "stroke-width": 3.4, "stroke-linecap": "round" }, Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return svg("line", { x1: Math.cos(a) * 13.5, y1: Math.sin(a) * 13.5, x2: Math.cos(a) * 19.5, y2: Math.sin(a) * 19.5, pathLength: 1 });
    }));
    parts.core = svg("circle", { r: 8.5, fill: sunC, class: "tr-scale" });
    kids = [parts.rays, parts.core];
  } else if (weather === "cloud") {
    // くもり: 奥の小さな雲と手前の雲
    parts.back = svg("g", { class: "tr-scale", opacity: tint ? 0.55 : 1 }, [cloud(-4, 1, 26, tint || "#a796dc")]);
    parts.front = svg("g", { class: "tr-scale" }, [cloud(-21, 13, 40, lav)]);
    kids = [parts.back, parts.front];
  } else {
    // 雨: 傘（閉じた形から開く）
    parts.canopy = svg("path", { d: "M -19 2 A 19 17 0 0 1 19 2 A 6.33 5 0 0 0 6.33 2 A 6.33 5 0 0 0 -6.33 2 A 6.33 5 0 0 0 -19 2 Z", fill: lav, class: "tr-scale" });
    parts.shaft = svg("path", { d: "M 0 -15 V -19 M 0 2 V 15 a 3.5 3.5 0 0 1 -7 0", fill: "none", stroke: lav, "stroke-width": 3, "stroke-linecap": "round" });
    kids = [parts.shaft, parts.canopy];
  }
  return { node: svg("svg", { viewBox: "-24 -24 48 48", class: "tr-dawn-icon" }, kids), parts };
}

/** 天気の札（アイコン＋「晴れ」など）。cls は札の見た目（夜明けの幕／朝のDAYカード）、tint はアイコンの1色 */
export function weatherBadge(weather, cls = "tr-dawn-weather", tint = null) {
  if (!WEATHER_LABEL[weather]) return null;
  const ic = icon(weather, tint);
  const badge = el(`div.${cls}`, { dataset: { weather } }, [ic.node, el("span", { text: WEATHER_LABEL[weather] })]);
  return { badge, parts: ic.parts };
}
