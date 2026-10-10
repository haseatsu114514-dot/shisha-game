// 就寝→翌朝の夜明けの幕（core/transitions.js の nightToMorning）に出す、その日の天気（CI109）。
// 晴れ・くもり・雨の3つ。天気は daily/weather.js の weatherOf（くもりは見た目だけ）。
// 幕の紫（#34246a）と淡いラベンダー（#dcd1f4）に合わせ、晴れだけ朝日の暖かい色を少し足す。
import { el } from "../core/util.js";
import { svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E } from "../core/mg-kit.js";
import { WEATHER_LABEL } from "../daily/weather.js";

const LAV = "#dcd1f4";
const SUN = "#ffe2a6"; // 朝日（夜明けの終わりの光 #fff3d6 に寄せた淡い金）
const SUN_CORE = "#fff3d6";
const CLOUDS = ["#41337c", "#514296", "#6655ae"]; // 遠い→近い雲（幕の紫より少しずつ明るい）

// イージング。指数の曲線は短い動き用なので、1秒前後の動きは cubic／quint のやわらかい減速にする
const OUT_LONG = "cubic-bezier(.33,1,.68,1)"; // 朝日・雲・光の輪（長め）
const OUT_QUINT = "cubic-bezier(.22,1,.36,1)"; // 光の線を描く（短め）

let serial = 0;

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

/**
 * node: 幕の器（.tr-dawn）。天気の演出をここに足す。weather: "sun" | "cloud" | "rain" | null。
 * 戻り値の badge は DAYカードの下に並べる天気の札（null なら出さない）。
 * fadeOut(ms) は地平線が昇るあいだに演出を薄める。stop() は幕を外すときの後片付け。
 */
export function dawnWeather(node, weather, { reduced = false } = {}) {
  const made = weather ? weatherBadge(weather) : null;
  if (!made) return { badge: null, fadeOut: async () => {}, stop() {} };
  const { badge, parts } = made;
  if (reduced) return { badge, fadeOut: async () => {}, stop() {} };
  const anims = [];
  const run = (target, frames, ms, opt = {}) => {
    const a = target.animate(frames, { duration: ms, easing: E.out, fill: "both", ...opt });
    anims.push(a);
    return a;
  };
  const loop = (target, frames, ms, opt = {}) => run(target, frames, ms, { easing: "linear", iterations: Infinity, fill: "none", ...opt });
  const fx = el("div.tr-dawn-fx");
  const art = stageSvg();
  fx.append(art);

  // 1. 札は DAYカードより少し遅れて弾んで出る
  run(badge, [{ transform: "translateY(10px) scale(.7)", opacity: 0 }, { transform: "none", opacity: 1 }], 520, { easing: E.back, delay: 220 });

  if (weather === "sun") {
    // 2. 晴れ: 下から朝日が昇り、光の線が描かれて、ゆっくり回る
    const id = `tr-dawn-sun-${++serial}`;
    const cx = 640, cy = 770;
    const rays = svg("g", { class: "tr-scale", stroke: SUN, "stroke-linecap": "round" }, Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      const long = i % 2 === 0;
      const r0 = 186, r1 = long ? 246 : 222;
      return svg("line", { x1: cx + Math.cos(a) * r0, y1: cy + Math.sin(a) * r0, x2: cx + Math.cos(a) * r1, y2: cy + Math.sin(a) * r1, "stroke-width": long ? 7 : 5, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
    }));
    const halo = svg("circle", { cx, cy, r: 166, fill: "none", stroke: SUN_CORE, "stroke-width": 3, opacity: 0.6, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1, transform: `rotate(-90 ${cx} ${cy})` });
    const sun = svg("g", {}, [
      svg("defs", {}, [svg("radialGradient", { id }, [svg("stop", { offset: "0", "stop-color": SUN, "stop-opacity": 0.42 }), svg("stop", { offset: "1", "stop-color": SUN, "stop-opacity": 0 })])]),
      svg("circle", { cx, cy, r: 560, fill: `url(#${id})` }),
      rays, halo,
      svg("circle", { cx, cy, r: 146, fill: SUN }),
      svg("circle", { cx, cy, r: 112, fill: SUN_CORE, opacity: 0.55 }),
    ]);
    art.append(sun);
    run(sun, [{ transform: "translateY(300px)" }, { transform: "translateY(0)" }], 1100, { easing: OUT_LONG, delay: 120 });
    [...rays.children].forEach((ray, i) => run(ray, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 520, { easing: OUT_QUINT, delay: 520 + (i % 10) * 40 }));
    run(halo, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 900, { easing: OUT_LONG, delay: 420 });
    loop(rays, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], 40000);
    // 札のアイコンも光が描かれて回る
    [...parts.rays.children].forEach((ray, i) => { ray.setAttribute("stroke-dasharray", 1); run(ray, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 360, { easing: OUT_QUINT, delay: 480 + i * 40 }); });
    run(parts.core, [{ transform: "scale(0)" }, { transform: "scale(1)" }], 460, { easing: E.back, delay: 360 });
    loop(parts.rays, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], 9000);
  } else if (weather === "cloud") {
    // 2. くもり: 遠い雲ほどゆっくり、3層の雲が横から流れ込み、そのまま流れ続ける（パララックス）
    const layers = [
      { fill: CLOUDS[0], from: -140, speed: 14, clouds: [[-60, 150, 420], [520, 118, 340], [990, 170, 380], [250, 704, 420], [880, 700, 420]] },
      { fill: CLOUDS[1], from: 220, speed: 30, clouds: [[120, 205, 300], [760, 190, 260], [-40, 724, 360], [560, 736, 340], [1060, 728, 300]] },
      { fill: CLOUDS[2], from: -360, speed: 54, clouds: [[330, 236, 210], [1010, 250, 230], [160, 752, 260], [820, 760, 280]] },
    ];
    layers.forEach((L, i) => {
      const drift = svg("g", {}, L.clouds.map(([x, y, w]) => cloud(x, y, w, L.fill)));
      const slide = svg("g", {}, [drift]);
      art.append(slide);
      run(slide, [{ transform: `translateX(${L.from}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], 1100, { easing: OUT_LONG, delay: 60 + i * 90 });
      run(drift, [{ transform: "translateX(0)" }, { transform: `translateX(${L.speed * 6}px)` }], 6000, { easing: "linear" });
    });
    // 札の雲は2つがすれ違うように揺れる
    loop(parts.back, [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }], 2600, { easing: "ease-in-out" });
    loop(parts.front, [{ transform: "translateX(0)" }, { transform: "translateX(2.5px)" }, { transform: "translateX(0)" }], 2600, { easing: "ease-in-out" });
  } else {
    // 2. 雨: 斜めの雨筋（前のまま）と、足もとに広がる小さな波紋。札の傘がぱっと開く
    const rain = el("div.tr-dawn-rain");
    for (let i = 0; i < 26; i++) {
      const drop = el("i", { style: { left: `${Math.random() * 115 - 10}%`, height: `${14 + Math.random() * 12}%` } });
      rain.append(drop);
      loop(drop, [{ translate: "0 0" }, { translate: "-150px 1150px" }], 560 + Math.random() * 240, { delay: Math.random() * 600, fill: "backwards" });
    }
    fx.prepend(rain);
    for (let i = 0; i < 16; i++) {
      const x = 50 + ((i * 263) % 1180) + Math.random() * 40;
      const y = 540 + ((i * 47) % 170);
      const s = 0.75 + (y - 540) / 260; // 手前ほど大きい
      const ripple = svg("g", { class: "tr-scale", opacity: 0 }, [
        svg("ellipse", { cx: x, cy: y, rx: 52 * s, ry: 11 * s, fill: "none", stroke: LAV, "stroke-width": 2.5 }),
        svg("ellipse", { cx: x, cy: y, rx: 28 * s, ry: 6 * s, fill: "none", stroke: LAV, "stroke-width": 2 }),
      ]);
      art.append(ripple);
      // 広がり（減速）と濃さ（すっと出て、まっすぐ薄れる）は別の動きに。1本の強い曲線だと、一瞬光って残りは見えない
      const dur = 1000 + Math.random() * 300, delay = 200 + Math.random() * 1000;
      loop(ripple, [{ transform: "scale(.15)" }, { transform: "scale(1)" }], dur, { easing: OUT_LONG, delay, fill: "backwards" });
      loop(ripple, [{ opacity: 0, easing: "ease-out" }, { opacity: 0.9, offset: 0.12, easing: "linear" }, { opacity: 0 }], dur, { easing: "linear", delay, fill: "backwards" });
    }
    // 開く区間（減速）と戻る区間（ゆるやか）を別の曲線に。行き過ぎは小さな札なので約12%
    run(parts.canopy, [
      { transform: "scaleX(.16) scaleY(1.1) rotate(0deg)", easing: "cubic-bezier(.3,.8,.4,1)" },
      { transform: "scaleX(1.12) scaleY(.95) rotate(-6deg)", offset: 0.5, easing: "ease-in-out" },
      { transform: "scaleX(1) scaleY(1) rotate(0deg)" },
    ], 560, { easing: "linear", delay: 520 });
    run(parts.shaft, [{ transform: "translateY(4px)" }, { transform: "none" }], 420, { easing: E.back, delay: 520 });
  }
  node.append(fx);
  return {
    badge,
    // 地平線に合わせて下から拭き取る（幕の紫と同じ速さ）
    fadeOut: (ms) => move(fx, [{ clipPath: "inset(0 0 0% 0)", opacity: 1 }, { clipPath: "inset(0 0 100% 0)", opacity: 0.5 }], ms),
    stop() {
      anims.forEach((a) => a.cancel());
      fx.remove();
    },
  };
}
