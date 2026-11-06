// 機窓と車窓（#2688 A4）。第4章の日本⇄ドバイ・第5章の飛行機の往復は飛行機の丸い窓、
// 第5章の東京への配送便は車の横長の窓。第2章の電車（train.js）・第3章の新幹線（shinkansen.js）と並ぶ「移動」の演出。
// 客室の壁が右から入って画面を覆い、窓の外の空が時差の色へ移り、着く土地が下から見えたところで窓が広がって次の場面になる。
// 覆っている間に mid() で次の背景へ替える。画像は使わず、CSS と SVG の図形だけで描く（顔・機体は描かない）。
import { el, sleep } from "../core/util.js";
import { W, H, COLOR, EASE, svg, stageSvg, move } from "../core/transition-kit.js";
import { holdCover } from "../core/transitions.js";

// 窓の外の色。from（出た土地の空）→ to（着く土地の空）。ground は窓の下から見えてくる土地
const SKIES = {
  dubai: { from: ["#1a1238", "#34246a"], to: ["#f3b9d6", "#f6dcaf"], ground: "dunes", label: "ドバイへ" },
  home: { from: ["#f6dcaf", "#f3b9d6"], to: ["#1a1238", "#3b2a74"], ground: "city", label: "日本へ" },
  tokyo: { from: ["#2a1d57", "#3b2a74"], to: ["#120c26", "#241845"], ground: "road", label: "東京へ" },
  town: { from: ["#241845", "#34246a"], to: ["#120c26", "#241845"], ground: "road", label: "地元へ" },
};

/** 窓の穴を開けた客室の壁。hole を広げると窓の外（＝次の場面）が画面いっぱいになる */
function cabinWall(win) {
  const id = `mo-plane-hole-${Math.random().toString(36).slice(2, 8)}`;
  const hole = svg("rect", { ...win, fill: "#000", class: "tr-scale" });
  const frame = svg("rect", { ...win, fill: "none", stroke: COLOR.lav, "stroke-width": 10, "vector-effect": "non-scaling-stroke", class: "tr-scale" });
  const inner = svg("rect", { x: win.x - 22, y: win.y - 22, width: win.width + 44, height: win.height + 44, rx: win.rx + 22, fill: "none", stroke: "#4b3690", "stroke-width": 26, class: "tr-scale" });
  const art = stageSvg([
    svg("defs", {}, [svg("mask", { id, maskUnits: "userSpaceOnUse", x: -200, y: -200, width: W + 400, height: H + 400 }, [
      svg("rect", { x: -200, y: -200, width: W + 400, height: H + 400, fill: "#fff" }), hole,
    ])]),
    svg("rect", { x: -200, y: -200, width: W + 400, height: H + 400, fill: COLOR.shadow, mask: `url(#${id})` }),
    inner, frame,
  ]);
  return { art, hole, frame, inner };
}

/** 窓の外の土地: 砂丘（ドバイ）・街の灯（日本）・夜の道路の灯（配送便） */
function ground(kind) {
  if (kind === "dunes") {
    return stageSvg([
      svg("path", { d: `M 0 560 C 220 500, 380 540, 560 520 S 900 470, 1280 520 L 1280 720 L 0 720 Z`, fill: "#e0b77d" }),
      svg("path", { d: `M 0 620 C 260 570, 520 610, 760 585 S 1100 560, 1280 600 L 1280 720 L 0 720 Z`, fill: "#c9955d" }),
    ]);
  }
  if (kind === "city") {
    const lights = [];
    let seed = 11;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 70; i++) lights.push(svg("circle", { cx: Math.round(rand() * W), cy: Math.round(560 + rand() * 150), r: 1.6 + rand() * 2.2, fill: rand() < 0.3 ? COLOR.warm : "#f6dcaf", opacity: 0.5 + rand() * 0.5 }));
    return stageSvg([svg("rect", { x: 0, y: 540, width: W, height: 180, fill: "#150f26" }), ...lights]);
  }
  return null;
}

/** 車窓の外を流れる道路の灯（配送便）。横に長い光の筋を左へ流し続ける */
function roadLights(host) {
  const stop = [];
  for (let i = 0; i < 16; i++) {
    const streak = el("i.mo-plane-streak", { style: { top: `${36 + (i % 8) * 6.5}%`, width: `${80 + (i * 53) % 160}px`, background: i % 3 ? "#f6dcaf" : COLOR.lav } });
    host.append(streak);
    const run = streak.animate([{ transform: "translateX(1400px)" }, { transform: "translateX(-300px)" }], { duration: 520 + (i * 97) % 380, delay: (i * 137) % 600, iterations: Infinity, easing: "linear" });
    stop.push(() => run.cancel());
  }
  return () => stop.forEach((fn) => fn());
}

/** 窓の外を流れる雲。iterations は無限、片付けるときに止める */
function clouds(host) {
  const stop = [];
  for (let i = 0; i < 7; i++) {
    const c = el("i.mo-plane-cloud", { style: { top: `${18 + (i * 11) % 52}%`, width: `${220 + (i * 70) % 260}px` } });
    host.append(c);
    const run = c.animate([{ transform: "translateX(1500px)" }, { transform: "translateX(-600px)" }], { duration: 1500 + (i * 260) % 900, delay: -((i * 430) % 1500), iterations: Infinity, easing: "linear" });
    stop.push(() => run.cancel());
  }
  return () => stop.forEach((fn) => fn());
}

/**
 * 乗り物の窓から次の土地へ。kind: "plane"（丸い機窓）| "van"（車の横長の窓）。to: "dubai" | "home" | "tokyo" | "town"
 * mid(): 壁が画面を覆っている間に次の背景へ替える。
 */
export async function windowRide(mid, { kind = "plane", to = "dubai" } = {}) {
  const host = document.getElementById("fx");
  if (!host) { await mid?.(); return; }
  const sky = SKIES[to] || SKIES.dubai;
  const plane = kind !== "van";
  const win = plane ? { x: 470, y: 150, width: 340, height: 420, rx: 150 } : { x: 260, y: 190, width: 760, height: 300, rx: 46 };
  const release = holdCover();
  const node = el(`div.mo-plane.${plane ? "is-plane" : "is-van"}`, { "aria-hidden": "true", dataset: { motion: plane ? "plane" : "van", to } });
  const skyFrom = el("div.mo-plane-sky", { style: { background: `linear-gradient(${sky.from[0]}, ${sky.from[1]})` } });
  const skyTo = el("div.mo-plane-sky", { style: { background: `linear-gradient(${sky.to[0]}, ${sky.to[1]})`, opacity: "0" } });
  const outside = el("div.mo-plane-outside", [skyFrom, skyTo]);
  const land = ground(sky.ground);
  if (land) { land.classList.add("mo-plane-ground"); land.style.transform = "translateY(40%)"; outside.append(land); }
  const wall = cabinWall(win);
  const label = el("div.mo-plane-label", { text: sky.label });
  node.append(outside, wall.art, label);
  host.append(node);
  const stopFlow = plane ? clouds(outside) : roadLights(outside);
  try {
    // 客室の壁が右から入って画面を覆う
    await move(node, [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0%)" }], 320, { easing: EASE.in });
    await mid?.();
    move(label, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], 300, { easing: EASE.out });
    const cross = plane ? 1200 : 700;
    move(skyTo, [{ opacity: 0 }, { opacity: 1 }], cross, { easing: "ease-in-out" });
    if (land) move(land, [{ transform: "translateY(40%)" }, { transform: "translateY(0%)" }], cross, { easing: EASE.out, delay: plane ? 500 : 200 });
    await sleep(plane ? 1500 : 850);
    // 窓が広がって、窓の外がそのまま次の場面になる
    move(label, [{ opacity: 1 }, { opacity: 0 }], 200);
    const grow = [{ transform: "scale(1)" }, { transform: `scale(${plane ? 6.5 : 4.2})` }];
    move(wall.frame, grow, 520, { easing: EASE.in });
    move(wall.inner, grow, 520, { easing: EASE.in });
    move(outside, [{ opacity: 1 }, { opacity: 0 }], 520, { easing: "ease-in", delay: 140 });
    await move(wall.hole, grow, 520, { easing: EASE.in });
  } finally {
    stopFlow();
    node.remove();
    release();
  }
}

export const a = windowRide;
