// 機窓と車窓（#2688 A4）。第4章の日本⇄ドバイ・第5章の飛行機の往復は飛行機の丸い窓、
// 第5章の東京への配送便は車の横長の窓。第2章の電車（train.js）・第3章の新幹線（shinkansen.js）と並ぶ「移動」の演出。
// 客室の壁が右から入って画面を覆い、窓の外の空が時差の色へ移り、着く土地が下から見えたところで窓が広がって次の場面になる。
// 覆っている間に mid() で次の背景へ替える。画像は使わず、CSS と SVG の図形だけで描く（顔・機体は描かない）。
import { el, sleep } from "../core/util.js";
import { W, H, COLOR, EASE, svg, stageSvg, move, holdKeys } from "../core/transition-kit.js";
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

// ---------------------------------------------------------------- c: 作り直し（TMG57・見本の表「飛行機」「配送便」）
// 飛行機: 図形の客室の壁と丸い窓をやめ、#3254 で届いた機内の窓の席の絵で作る。窓の外は雲海の絵（夜・夜明け）が流れ、
// 出た土地の時間から着く土地の時間の色へ移る。行き先は題字で出し、最後は窓へ寄って、窓の外がそのまま次の場面になる。
// 配送便: 車窓の演出はやめ、ふつうの切り替え（ui.setBg の煙のにじみ）と題字だけにする。

const FLY_ART = {
  cabin: new URL("../../img/ui/transitions/plane/cabin.webp", import.meta.url).href,
  night: new URL("../../img/ui/transitions/plane/cloudsea-night.webp", import.meta.url).href,
  dawn: new URL("../../img/ui/transitions/plane/cloudsea-dawn.webp", import.meta.url).href,
};
const CABIN_W = 1672, CABIN_H = 941; // 機内の絵の大きさ
// 機内の絵の窓（外が単色で描かれた所）の輪郭。絵の座標。窓の中心は (1267.5, 378.5)
const CABIN_WINDOW = "1440,378.5 1440.3,393.6 1440.3,409 1440.9,425 1440.9,441.6 1439.2,458.6 1439.4,477.8 1438.3,498.1 1437.2,520.9 1433.3,544.3 1427.2,568.9 1416.9,591.9 1401.8,611 1383.5,627.3 1361.4,636.4 1338,641.7 1313.8,641 1290.2,638 1267.5,636 1245.1,634 1223,631.1 1200.3,629.2 1178.4,623.3 1157.8,613.7 1139.2,600.6 1123.8,583.7 1112.9,562.7 1104.5,541.5 1099.4,519.6 1096.7,498.1 1095.6,477.8 1095.8,458.6 1096,440.9 1094.1,425 1094.7,409 1094.7,393.6 1094,378.5 1094.7,363.4 1094.7,348 1094.1,332 1096,316.1 1095.8,298.4 1096.5,279.8 1098.3,260.1 1100.9,238.7 1106.6,217.6 1114.8,196.6 1126.1,176.6 1140.8,159 1158.3,144.2 1178.7,134.6 1200.9,129.8 1223.3,127.9 1245.4,126 1267.5,124 1289.9,122 1313.3,119 1337.8,116.3 1360.7,122.4 1381.8,133.3 1400.2,148.6 1415.2,167.6 1425.9,189.7 1433.3,212.7 1437.2,236.1 1439.1,258.3 1440.3,278.8 1440.2,298 1440.9,315.4 1440.9,332 1440.3,348 1440.3,363.4";
const WIN_AT = [1267.5 / CABIN_W, 378.5 / CABIN_H]; // 窓の中心（絵に対する割合）
const WIN_ZOOM = 6.6; // 窓が場面いっぱいを覆う寄り
/** 行き先ごとの窓の外（出る時間 → 着く時間）と題字 */
const FLIGHTS = {
  dubai: { from: "night", to: "dawn", label: "ドバイへ", sub: "日本 → ドバイ" },
  home: { from: "dawn", to: "night", label: "日本へ", sub: "ドバイ → 日本" },
};
const ROADS = { tokyo: { label: "東京へ", sub: "配送便" }, town: { label: "地元へ", sub: "配送便" } };

/** 絵を先に読む（窓の外や機内が遅れて出ないように）。読めなくても ms で先へ進む */
function preload(urls, ms = 1200) {
  let timer;
  const all = Promise.all(urls.map((u) => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); }));
  return Promise.race([all, new Promise((r) => { timer = setTimeout(r, ms); })]).finally(() => clearTimeout(timer));
}

/** 行き先の題字（左上。機内の絵の静かな所）。sub は小さな上の行 */
const rideTitle = (cls, { label, sub }) => el(`div.mo-ride-title.${cls}`, { dataset: { test: "ride-title" } }, [el("small", { text: sub }), el("b", { text: label }), el("i")]);
async function titleIn(title) {
  move(title.lastChild, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 640, { delay: 140, easing: EASE.out });
  await move(title, [{ opacity: 0, transform: "translateX(-18px)" }, { opacity: 1, transform: "none" }], 460, { easing: EASE.out });
}
const titleOut = (title, ms = 320) => move(title, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px)" }], ms, { easing: EASE.in });

/** 配送便: ふつうの切り替えで着いた場面へ替え、題字だけを見せる（覆わない。読み終えるまで先へ進ませない） */
async function van(mid, { to = "tokyo" } = {}) {
  const host = document.getElementById("fx");
  if (!host) { await mid?.(); return; }
  const unhold = holdKeys();
  const title = rideTitle("van", ROADS[to] || ROADS.tokyo);
  title.dataset.motion = "van";
  try {
    await mid?.();
    host.append(title);
    await titleIn(title);
    await sleep(900);
    await titleOut(title);
  } finally {
    title.remove();
    unhold();
  }
}

export async function c(mid, { kind = "plane", to = "dubai" } = {}) {
  if (kind === "van") return van(mid, { to });
  const host = document.getElementById("fx");
  if (!host) { await mid?.(); return; }
  const flight = FLIGHTS[to] || FLIGHTS.dubai;
  await preload([FLY_ART.cabin, FLY_ART[flight.from], FLY_ART[flight.to]]);
  const release = holdCover();
  const node = el("div.mo-plane.mo-fly", { "aria-hidden": "true", dataset: { motion: "plane", to } });
  const skyFrom = el("div.mo-fly-sky", { style: { backgroundImage: `url("${FLY_ART[flight.from]}")` } });
  const skyTo = el("div.mo-fly-sky", { style: { backgroundImage: `url("${FLY_ART[flight.to]}")`, opacity: "0" } });
  const outside = el("div.mo-fly-outside", [skyFrom, skyTo]);
  const id = `mo-fly-${Math.random().toString(36).slice(2, 8)}`;
  const cabin = svg("svg", { viewBox: `0 0 ${CABIN_W} ${CABIN_H}`, preserveAspectRatio: "xMidYMid slice", class: "mo-fly-cabin" }, [
    svg("defs", {}, [svg("mask", { id, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: CABIN_W, height: CABIN_H }, [
      svg("rect", { x: 0, y: 0, width: CABIN_W, height: CABIN_H, fill: "#fff" }),
      svg("polygon", { points: CABIN_WINDOW, fill: "#000" }),
    ])]),
    svg("image", { href: FLY_ART.cabin, x: 0, y: 0, width: CABIN_W, height: CABIN_H, mask: `url(#${id})` }),
  ]);
  cabin.style.transformOrigin = `${(WIN_AT[0] * 100).toFixed(2)}% ${(WIN_AT[1] * 100).toFixed(2)}%`;
  const title = rideTitle("fly", flight);
  node.append(outside, cabin, title);
  host.append(node);
  try {
    // 1. 場面の上に機内がにじんで入る（少し寄った所から落ち着く）。窓の外の雲は流れ続ける
    move(outside, [{ transform: "translateX(0)" }, { transform: "translateX(-14%)" }], 3600, { easing: "linear" });
    move(cabin, [{ transform: "scale(1.05)" }, { transform: "scale(1)" }], 1500, { easing: EASE.out });
    await move(node, [{ opacity: 0 }, { opacity: 1 }], 420, { easing: "ease-out" });
    node.getAnimations().forEach((a) => a.finish()); // 覆いきってから場面を替える
    await mid?.();
    // 2. 窓の外が着く土地の時間の色へ移る。行き先の題字
    move(skyTo, [{ opacity: 0 }, { opacity: 1 }], 1500, { easing: "ease-in-out", delay: 200 });
    await titleIn(title);
    await sleep(1150);
    // 3. 窓へ寄って、窓の外がそのまま次の場面になる
    titleOut(title, 260);
    const tx = (50 - WIN_AT[0] * 100).toFixed(2), ty = (50 - WIN_AT[1] * 100).toFixed(2);
    move(outside, [{ opacity: 1 }, { opacity: 0 }], 460, { delay: 280, easing: "ease-in" });
    await move(cabin, [{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${tx}%, ${ty}%) scale(${WIN_ZOOM})` }], 760, { easing: EASE.in });
  } finally {
    node.remove();
    release();
  }
}
