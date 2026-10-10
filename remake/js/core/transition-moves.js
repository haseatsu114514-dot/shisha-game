// マップで行き先を選んだあとの「移動」の型（CI103）。比較のため複数パターンを持ち、
// 既定は従来の pin。?move=walk などのURL、または __remake.dev.moveStyle("walk") で切り替える。
import { el, nextFrame, sleep } from "./util.js";
import { SE } from "./audio.js";
import { W, H, COLOR, EASE, svg, stageSvg, move, holdKeys, openLeaf, stepIntoBg, walker, everyFrame } from "./transition-kit.js";
import { MG_EASE as MG, pick, burst, ring } from "./mg-kit.js";

export const MOVE_STYLES = ["pin", "steps", "walk", "door", "noren", "walkdoor"];
const STORE_KEY = "suien_move_style";

export function moveStyle() {
  const q = new URLSearchParams(location.search).get("move");
  if (MOVE_STYLES.includes(q)) return q;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (MOVE_STYLES.includes(saved)) return saved;
  } catch { /* 保存できない環境では既定 */ }
  return "pin";
}
export function setMoveStyle(style) {
  try { localStorage.setItem(STORE_KEY, style); } catch { /* 保存できない環境 */ }
}

/** 幕の器。curtain の covered／release 約束（ui.setBg）に合わせ、覆う・開くの2段で書く */
function curtain(host, style, cover, reveal) {
  const node = el("div.scene-curtain.move", { "aria-hidden": "true", dataset: { transition: `move-${style}` } });
  const unhold = holdKeys();
  host.append(node);
  const covered = (async () => { await nextFrame(); await cover(node); })();
  let released = false;
  return { covered, async release() {
    if (released) return;
    released = true;
    await covered;
    await nextFrame(); await nextFrame();
    try { await reveal(node); } finally { node.remove(); unhold(); }
  } };
}

export function moveCurtain(host, style, opts = {}) {
  const make = { pin: pinMove, steps: stepsMove, walk: walkMove, door: doorMove, noren: norenMove, walkdoor: walkDoorMove }[style] || pinMove;
  return make(host, opts);
}

// ---------------------------------------------------------------- pin: 押したピンから円が広がり、中央の窓が開く

function circleCover(node, x, y, edgeColor = COLOR.lav, fillColor = COLOR.purple) {
  const r = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 30;
  const edge = svg("circle", { cx: x, cy: y, r, fill: edgeColor, class: "tr-scale" });
  const fill = svg("circle", { cx: x, cy: y, r, fill: fillColor, class: "tr-scale" });
  edge.style.transform = fill.style.transform = "scale(0)";
  node.append(stageSvg([edge, fill]));
  const grow = [{ transform: "scale(0)" }, { transform: "scale(1)" }];
  move(edge, grow, 290, { easing: EASE.in });
  return move(fill, grow, 290, { easing: EASE.in, delay: 60 });
}

function pinMove(host, { x = W / 2, y = H / 2 } = {}) {
  return curtain(host, "pin", (node) => circleCover(node, x, y), openLeaf);
}

// ---------------------------------------------------------------- steps: 手前からピンまで足あとが続き、ピンから開く

/** 足あと1つ。外側の g で位置と向き、内側の sole をふわっと押す */
function footprint(x, y, angle, left) {
  const sole = svg("g", { class: "tr-scale tr-foot" }, [
    svg("path", { d: "M -9 -4 C -12 -18, -6 -26, 2 -25 C 10 -24, 12 -14, 8 -2 C 6 4, -7 4, -9 -4 Z", fill: COLOR.lav }), // つま先側
    svg("ellipse", { cx: 0, cy: 14, rx: 7, ry: 8, fill: COLOR.lav }), // かかと
  ]);
  return { g: svg("g", { transform: `translate(${x} ${y}) rotate(${angle}) scale(${left ? -1.25 : 1.25} 1.25)` }, [sole]), sole };
}

function stepsMove(host, { x = W / 2, y = H / 2 } = {}) {
  return curtain(host, "steps", async (node) => {
    const art = stageSvg();
    node.append(art);
    const sx = W / 2, sy = H + 30;
    const dist = Math.hypot(x - sx, y - sy);
    const count = Math.max(5, Math.min(10, Math.round(dist / 70)));
    const angle = (Math.atan2(y - sy, x - sx) * 180) / Math.PI + 90;
    const nx = -(y - sy) / dist, ny = (x - sx) / dist; // 進む向きに直角（左右の足をずらす）
    for (let i = 1; i <= count; i++) {
      const k = i / (count + 0.6);
      const side = i % 2 ? 1 : -1;
      const fp = footprint(sx + (x - sx) * k + nx * 16 * side, sy + (y - sy) * k + ny * 16 * side, angle, side < 0);
      art.append(fp.g);
      move(fp.sole, [{ opacity: 0, transform: "scale(1.7)" }, { opacity: 1, transform: "scale(1)" }], 150, { easing: EASE.out });
      SE.tick();
      await sleep(64);
    }
    await sleep(80);
    await circleCover(node, x, y);
  }, openLeaf);
}

// ---------------------------------------------------------------- walk: 人影が夜の街を歩いて向かう（横スクロール）

/** 遠景のビルの並び（窓の灯り付き）。幅 width のぶんを左から敷く */
function skyline(width, base, color, lit) {
  const g = svg("g");
  let x = 0;
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  while (x < width) {
    const w = 60 + rand() * 90, h = 90 + rand() * 210;
    g.append(svg("rect", { x, y: base - h, width: w, height: h, fill: color }));
    for (let wy = base - h + 16; wy < base - 16; wy += 26) {
      for (let wx = x + 10; wx < x + w - 14; wx += 20) if (rand() < 0.28) g.append(svg("rect", { x: wx, y: wy, width: 7, height: 10, fill: lit, opacity: 0.7 }));
    }
    x += w + 6;
  }
  return g;
}

function placeLabel({ label = "", area = "" } = {}) {
  return el("div.tr-move-label", [el("small", { text: area ? `${area} へ` : "移動中" }), el("b", { text: label })]);
}

function streetScene(opts) {
  const ground = 560;
  const far = skyline(W * 3, ground, "#4b3690", COLOR.lav);
  const near = svg("g");
  for (let i = 0; i < 9; i++) {
    const x = i * 340 + 120;
    near.append(svg("rect", { x, y: ground - 250, width: 10, height: 250, fill: "#241845" }), svg("path", { d: `M ${x + 5} ${ground - 250} q 30 -6 46 14`, stroke: "#241845", "stroke-width": 8, fill: "none" }),
      svg("circle", { cx: x + 52, cy: ground - 230, r: 9, fill: COLOR.warm, opacity: 0.85 }));
  }
  const fig = walker();
  const figPos = svg("g", { transform: `translate(380 ${ground})` }, [fig.g]);
  const art = stageSvg([
    svg("defs", {}, [svg("linearGradient", { id: "tr-walk-sky", x1: 0, y1: 0, x2: 0, y2: 1 }, [
      svg("stop", { offset: "0", "stop-color": "#2a1d57" }), svg("stop", { offset: "1", "stop-color": COLOR.purple }),
    ])]),
    svg("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#tr-walk-sky)" }),
    far,
    svg("rect", { x: 0, y: ground, width: W, height: H - ground, fill: "#241845" }),
    svg("rect", { x: 0, y: ground, width: W, height: 4, fill: COLOR.lav, opacity: 0.8 }),
    near,
    figPos,
  ]);
  return { art, far, near, fig, figPos, ground, label: placeLabel(opts) };
}

function walkMove(host, opts = {}) {
  let scene = null, stop = null, shownAt = 0;
  return curtain(host, "walk", async (node) => {
    scene = streetScene(opts);
    const field = el("div.tr-move-field", [scene.art, scene.label]);
    node.append(field);
    stop = everyFrame((t) => {
      scene.fig.pose(t);
      scene.far.setAttribute("transform", `translate(${-40 * t} 0)`);
      scene.near.setAttribute("transform", `translate(${-150 * t} 0)`);
      scene.figPos.setAttribute("transform", `translate(${380 + 120 * t} ${scene.ground})`);
    });
    await move(field, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }], 320, { easing: EASE.in });
    move(scene.label, [{ opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "none" }], 300, { easing: EASE.out });
    shownAt = performance.now();
  }, async (node) => {
    const field = node.firstChild;
    const wait = 1050 - (performance.now() - shownAt); // 歩く姿を見せ切る
    if (wait > 0) await sleep(wait);
    await move(field, [{ clipPath: "inset(0 0 0 0%)" }, { clipPath: "inset(0 0 0 100%)" }], 380, { easing: EASE.in });
    stop?.();
  });
}

// ---------------------------------------------------------------- door: シンプルな四角い扉のモーショングラフィックス（CI108）
// ピンから輪が弾けて2色の円が重なって広がり、床と枠が線で描かれ、扉の板が下から立ち上がる。
// 開くと光と放射線が出て、戸口が画面いっぱいに広がる。配色は紫1色か場面ごとの色（mg-kit の pick）

const DOOR = { bg: "#14213d", deep: "#0b1426", main: "#ff6b5a", mid: "#ffb4a2", light: "#ffd166", white: "#fff8ec" };

function doorMove(host, { x = W / 2, y = H / 2 } = {}) {
  const P = pick(DOOR);
  const dw = 280, dh = 470, dx = (W - dw) / 2, dy = 125;
  let p;
  return curtain(host, "door", async (node) => {
    // 1. ピンから輪が弾け、2色の円が少しずれて広がる
    const r = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 30;
    const c1 = svg("circle", { cx: x, cy: y, r, fill: P.mid, class: "tr-scale" });
    const c2 = svg("circle", { cx: x, cy: y, r, fill: P.bg, class: "tr-scale" });
    c1.style.transform = c2.style.transform = "scale(0)";
    const intro = stageSvg([c1, c2]);
    node.append(intro);
    ring(intro, x, y, { r: 110, color: P.light, width: 8, dur: 420 });
    const grow = [{ transform: "scale(0)" }, { transform: "scale(1)" }];
    move(c1, grow, 320, { easing: MG.in });
    await move(c2, grow, 330, { easing: MG.in, delay: 80 });
    // 2. 床と枠が線で描かれ、扉の板が下から立ち上がる
    const id = `tr-door-${++doorSerial}`;
    const box = { x: -300, y: -300, width: W + 600, height: H + 600 };
    const hole = svg("rect", { x: dx, y: dy, width: dw, height: dh, fill: "#000", class: "tr-scale" });
    const light = svg("rect", { x: dx, y: dy, width: dw, height: dh, fill: P.white, class: "tr-scale" });
    const frame = svg("rect", { x: dx - 14, y: dy - 14, width: dw + 28, height: dh + 28, fill: "none", stroke: P.light, "stroke-width": 7, "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1, class: "tr-scale" });
    const floor = svg("line", { x1: 0, y1: dy + dh + 14, x2: W, y2: dy + dh + 14, stroke: P.mid, "stroke-width": 4, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
    const panel = svg("g", { class: "tr-scale" }, [
      svg("rect", { x: dx, y: dy, width: dw, height: dh, fill: P.main }),
      svg("rect", { x: dx + dw - 46, y: dy + dh * 0.44, width: 10, height: 74, rx: 5, fill: P.white }),
    ]);
    panel.style.transform = "scaleY(0)";
    panel.style.transformOrigin = "center bottom";
    const fx = svg("g");
    const art = stageSvg([
      svg("defs", {}, [svg("mask", { id, maskUnits: "userSpaceOnUse", ...box }, [svg("rect", { ...box, fill: "#fff" }), hole])]),
      svg("rect", { ...box, fill: P.bg, mask: `url(#${id})` }),
      floor, light, frame, panel, fx,
    ]);
    node.replaceChildren(art);
    p = { hole, light, frame, floor, panel, fx };
    move(floor, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 300, { easing: MG.out });
    move(frame, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 380, { easing: MG.out, delay: 60 });
    await move(panel, [{ transform: "scaleY(0)" }, { transform: "scaleY(1.04)", offset: 0.7 }, { transform: "scaleY(1)" }], 400, { easing: MG.out, delay: 140 });
    burst(fx, dx - 14, dy - 14, { n: 3, r0: 18, r1: 56, color: P.light, width: 5, turn: Math.PI * 1.1 });
    burst(fx, dx + dw + 14, dy - 14, { n: 3, r0: 18, r1: 56, color: P.light, width: 5, turn: -Math.PI * 0.43 });
  }, async () => {
    await sleep(120);
    SE.doorbell();
    // 3. 扉が蝶番側へたたまれて開き、光と放射線が出る
    move(p.floor, [{ opacity: 1 }, { opacity: 0 }], 200);
    p.panel.style.transformOrigin = "left center";
    move(p.panel, [{ transform: "scaleX(1) skewY(0deg)" }, { transform: "scaleX(0) skewY(-14deg)" }], 300, { easing: MG.in });
    await sleep(170);
    burst(p.fx, W / 2, dy + dh / 2, { n: 12, r0: 260, r1: 360, color: P.light, width: 6 });
    ring(p.fx, W / 2, dy + dh / 2, { r: 330, color: P.white, width: 8 });
    await sleep(120);
    // 4. 戸口が画面いっぱいに広がり、光が晴れて次の場面
    const grow = [{ transform: "scale(1)" }, { transform: "scale(6.5)" }];
    move(p.light, [{ opacity: 1 }, { opacity: 0 }], 280, { easing: MG.out, delay: 80 });
    move(p.frame, grow, 440, { easing: MG.in });
    await move(p.hole, grow, 440, { easing: MG.in });
  });
}
let doorSerial = 0;

// ---------------------------------------------------------------- noren: 暖簾が下りてきて、手でよけるように左右へ割れる

function norenMove(host, opts = {}) {
  let panels = [], crest;
  return curtain(host, "noren", async (node) => {
    const back = el("div.tr-noren-back");
    panels = [0, 1, 2, 3].map((i) => el(`div.tr-noren-panel`, { style: { left: `${i * 25}%` } }));
    crest = el("div.tr-noren-crest", [el("b", { text: opts.glyph || [...(opts.label || "・")][0] }), el("small", { text: opts.label || "" })]);
    node.append(back, ...panels, crest);
    move(back, [{ opacity: 0 }, { opacity: 1 }], 300, { easing: EASE.in });
    await Promise.all(panels.map((p, i) => move(p, [{ transform: "translateY(-104%)" }, { transform: "translateY(0)" }], 340, { easing: EASE.out, delay: i * 35 })));
    panels.forEach((p, i) => p.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${i < 2 ? 0.8 : -0.8}deg)` }, { transform: "rotate(0deg)" }], { duration: 900, easing: "ease-in-out", iterations: Infinity }));
    await move(crest, [{ opacity: 0, transform: "translate(-50%, -50%) scale(1.2)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1)" }], 220, { easing: EASE.out });
  }, async (node) => {
    await sleep(300);
    stepIntoBg(760);
    move(crest, [{ opacity: 1 }, { opacity: 0 }], 200);
    move(node.querySelector(".tr-noren-back"), [{ opacity: 1 }, { opacity: 0 }], 300, { easing: EASE.in, delay: 60 });
    await Promise.all(panels.map((p, i) => {
      p.getAnimations().forEach((a) => a.cancel());
      const dir = i < 2 ? -1 : 1, far = i === 0 || i === 3 ? 0.6 : 1;
      return move(p, [{ transform: "translateX(0) rotate(0deg)", opacity: 1 }, { transform: `translateX(${dir * 60 * far}%) rotate(${dir * -16 * far}deg)`, opacity: 0 }], 480, { easing: EASE.in, delay: (i === 1 || i === 2 ? 0 : 50) });
    }));
  });
}

// ---------------------------------------------------------------- walkdoor: 人影が扉まで歩き、開いた光の中へ入る

function walkDoorMove(host, opts = {}) {
  let stop = null, fig, figPos, doorFill, light, shownAt = 0;
  const ground = 580, doorX = 860, doorW = 150, doorH = 290;
  return curtain(host, "walkdoor", async (node) => {
    fig = walker();
    figPos = svg("g", { transform: `translate(160 ${ground})` }, [fig.g]);
    light = svg("rect", { x: doorX, y: ground - doorH, width: doorW, height: doorH, fill: COLOR.warm, opacity: 0 });
    doorFill = svg("rect", { x: doorX, y: ground - doorH, width: doorW, height: doorH, fill: "#241845", class: "tr-walkdoor-leaf" });
    const art = stageSvg([
      svg("rect", { x: 0, y: 0, width: W, height: H, fill: COLOR.deep }),
      svg("rect", { x: 0, y: ground, width: W, height: H - ground, fill: "#241845" }),
      svg("rect", { x: 0, y: ground, width: W, height: 4, fill: COLOR.lav, opacity: 0.8 }),
      light, doorFill,
      svg("rect", { x: doorX - 10, y: ground - doorH - 10, width: doorW + 20, height: doorH + 10, fill: "none", stroke: COLOR.lav, "stroke-width": 6 }),
      svg("circle", { cx: doorX + doorW - 22, cy: ground - doorH / 2, r: 6, fill: COLOR.lav }),
      figPos,
    ]);
    const label = el("div.tr-move-label.at-door", [el("small", { text: opts.area || "" }), el("b", { text: opts.label || "" })]);
    const field = el("div.tr-move-field", [art, label]);
    node.append(field);
    stop = everyFrame((t) => {
      fig.pose(t);
      figPos.setAttribute("transform", `translate(${Math.min(160 + 470 * t, doorX + 40)} ${ground})`);
    });
    await move(field, [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }], 300, { easing: EASE.in });
    move(label, [{ opacity: 0 }, { opacity: 1 }], 260);
    shownAt = performance.now();
  }, async (node) => {
    const wait = 900 - (performance.now() - shownAt); // 扉の前まで歩く
    if (wait > 0) await sleep(wait);
    SE.doorbell();
    light.setAttribute("opacity", "1");
    await move(doorFill, [{ transform: "scaleX(1)" }, { transform: "scaleX(0.08)" }], 300, { easing: EASE.out });
    await move(figPos, [{ opacity: 1 }, { opacity: 0 }], 240);
    stop?.();
    const flood = el("div.tr-walkdoor-flood");
    node.append(flood);
    await move(flood, [{ clipPath: `inset(${(ground - doorH) / H * 100}% ${100 - (doorX + doorW) / W * 100}% ${100 - ground / H * 100}% ${doorX / W * 100}%)` }, { clipPath: "inset(0% 0% 0% 0%)" }], 360, { easing: EASE.in });
    node.firstChild.remove();
    stepIntoBg(800);
    await move(flood, [{ opacity: 1 }, { opacity: 0 }], 520, { easing: EASE.out });
  });
}
