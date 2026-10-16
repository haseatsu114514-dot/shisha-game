// マップ→場所の「扉」の移動（?move=door）。a／b の2パターン（?movar=b）、配色は紫1色／場面ごとの色（?mopal=free）。
// 戻り値は transition-kit の curtain()（covered／release）。地図の上でピン（x, y）から始まる。
import { sleep } from "../core/util.js";
import { W, H, svg, stageSvg, move, curtain } from "../core/transition-kit.js";
import { MG_EASE as MG, pick, burst, ring } from "../core/mg-kit.js";

let doorSerial = 0;

// ---------------------------------------------------------------- a: シンプルな四角い扉のモーショングラフィックス（CI108）
// ピンから輪が弾けて2色の円が重なって広がり、床と枠が線で描かれ、扉の板が下から立ち上がる。
// 開くと光と放射線が出て、戸口が画面いっぱいに広がる。配色は紫1色か場面ごとの色（mg-kit の pick）

const DOOR = { bg: "#14213d", deep: "#0b1426", main: "#ff6b5a", mid: "#ffb4a2", light: "#ffd166", white: "#fff8ec" };

// イージング（a専用）。指数の曲線は短い動き用なので、少し長い動きは quint／cubic のやわらかい曲線にする
const OUT = "cubic-bezier(.22,1,.36,1)"; // 立ち上がり・描画（減速して止まる）
const SPREAD = "cubic-bezier(.65,0,.35,1)"; // 円が地図を覆う（出だしと止まり際をなだらかに）
const SWING = "cubic-bezier(.55,0,.3,1)"; // 扉がたたまれる（光が出る瞬間と動きを合わせる）
const ZOOM_IN = "cubic-bezier(.32,0,.67,0)"; // 戸口へ踏み込む加速（cubic-in）

export function a(host, { x = W / 2, y = H / 2 } = {}) {
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
    ring(intro, x, y, { r: 110, color: P.light, width: 8, dur: 260 });
    const grow = [{ transform: "scale(0)" }, { transform: "scale(1)" }];
    move(c1, grow, 240, { easing: SPREAD });
    await move(c2, grow, 250, { easing: SPREAD, delay: 50 });
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
    move(floor, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 180, { easing: OUT });
    move(frame, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 240, { easing: OUT, delay: 40 });
    // 立ち上がりと戻りを別の曲線に（全体に強い減速をかけると、一瞬で立って残りがだらだら戻る）
    await move(panel, [{ transform: "scaleY(0)", easing: OUT }, { transform: "scaleY(1.04)", offset: 0.7, easing: "ease-in-out" }, { transform: "scaleY(1)" }], 280, { easing: "linear", delay: 80 });
    burst(fx, dx - 14, dy - 14, { n: 3, r0: 18, r1: 56, color: P.light, width: 5, turn: Math.PI * 1.1, dur: 300 });
    burst(fx, dx + dw + 14, dy - 14, { n: 3, r0: 18, r1: 56, color: P.light, width: 5, turn: -Math.PI * 0.43, dur: 300 });
  }, async () => {
    await sleep(60);
    // 3. 扉が蝶番側へたたまれて開き、光と放射線が出る
    move(p.floor, [{ opacity: 1 }, { opacity: 0 }], 130);
    p.panel.style.transformOrigin = "left center";
    move(p.panel, [{ transform: "scaleX(1) skewY(0deg)" }, { transform: "scaleX(0) skewY(-14deg)" }], 220, { easing: SWING });
    await sleep(100);
    burst(p.fx, W / 2, dy + dh / 2, { n: 12, r0: 260, r1: 360, color: P.light, width: 6, dur: 300 });
    ring(p.fx, W / 2, dy + dh / 2, { r: 330, color: P.white, width: 8, dur: 380 });
    await sleep(80);
    // 4. 戸口が画面いっぱいに広がり、光が晴れて次の場面
    const grow = [{ transform: "scale(1)" }, { transform: "scale(6.5)" }];
    move(p.light, [{ opacity: 1 }, { opacity: 0 }], 220, { easing: "cubic-bezier(.37,0,.63,1)", delay: 40 });
    move(p.frame, grow, 320, { easing: ZOOM_IN });
    await move(p.hole, grow, 320, { easing: ZOOM_IN });
  });
}

// ---------------------------------------------------------------- b: 抽象。扉の絵は描かず、図形だけで「開く」を見せる
// ピンで四角が回り、3色の角丸の面が少しずつずれて画面を覆う。真ん中に縦の線が引かれ、
// 線が左右に割れて縦長の窓になり（縁の色の帯が外へはじける）、窓が画面いっぱいに広がって次の場面

const SHAPE = { bg: "#22203f", deep: "#14122a", main: "#f2a33a", mid: "#f27a9c", light: "#ffe08a", white: "#fff8ec" };

export function b(host, { x = W / 2, y = H / 2 } = {}) {
  const P = pick(SHAPE);
  const cx = W / 2, cy = H / 2, ww = 300, wh = 440, wy = cy - wh / 2;
  let p;
  return curtain(host, "door", async (node) => {
    // 1. ピンで四角が回り、3色の面がずれて広がる
    const rw = 2 * Math.max(x, W - x) + 80, rh = 2 * Math.max(y, H - y) + 80;
    const plate = (fill) => svg("rect", { x: x - rw / 2, y: y - rh / 2, width: rw, height: rh, rx: 70, fill, class: "tr-scale" });
    const plates = [plate(P.mid), plate(P.main), plate(P.bg)];
    const seed = svg("rect", { x: x - 20, y: y - 20, width: 40, height: 40, rx: 6, fill: "none", stroke: P.light, "stroke-width": 6, class: "tr-scale" });
    plates.forEach((c) => { c.style.transform = "scale(0)"; });
    const intro = stageSvg([...plates, seed]);
    node.append(intro);
    move(seed, [{ transform: "rotate(45deg) scale(0.3)", opacity: 1 }, { transform: "rotate(-45deg) scale(1.5)", opacity: 1, offset: 0.6 }, { transform: "rotate(-90deg) scale(2.4)", opacity: 0 }], 440, { easing: MG.out });
    const grow = [{ transform: "scale(0)" }, { transform: "scale(1)" }];
    await Promise.all(plates.map((c, i) => move(c, grow, 300, { easing: MG.in, delay: i * 60 })));
    // 2. 真ん中に縦の線が上から引かれ、両端に点が付く
    const id = `tr-door-${++doorSerial}`;
    const box = { x: -300, y: -300, width: W + 600, height: H + 600 };
    const hole = svg("rect", { x: cx - ww / 2, y: wy, width: ww, height: wh, rx: 4, fill: "#000", class: "tr-scale" });
    hole.style.transform = "scaleX(0)";
    const glow = svg("rect", { x: cx - ww / 2, y: wy, width: ww, height: wh, rx: 4, fill: P.white, opacity: 0, class: "tr-scale" });
    glow.style.transform = "scaleX(0)";
    const line = svg("line", { x1: cx, y1: wy, x2: cx, y2: wy + wh, stroke: P.light, "stroke-width": 6, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
    const dots = [wy, wy + wh].map((dy) => {
      const d = svg("circle", { cx, cy: dy, r: 9, fill: P.light, class: "tr-scale" });
      d.style.transform = "scale(0)";
      return d;
    });
    const edges = [-1, 1].map(() => svg("rect", { x: cx - 7, y: wy, width: 14, height: wh, rx: 7, fill: P.main, opacity: 0 }));
    const field = svg("g", { class: "tr-scale" }, [svg("rect", { ...box, fill: P.bg, mask: `url(#${id})` })]);
    const fx = svg("g");
    node.replaceChildren(stageSvg([
      svg("defs", {}, [svg("mask", { id, maskUnits: "userSpaceOnUse", ...box }, [svg("rect", { ...box, fill: "#fff" }), hole])]),
      field, glow, ...edges, line, ...dots, fx,
    ]));
    p = { hole, glow, line, dots, edges, field, fx };
    await move(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 260, { easing: MG.out });
    dots.forEach((d, i) => move(d, [{ transform: "scale(0)" }, { transform: "scale(1)" }], 260, { easing: MG.back, delay: i * 50 }));
  }, async () => {
    await sleep(120);
    // 3. 線が左右に割れて縦長の窓が開き、縁の帯が外へはじける
    const open = [{ transform: "scaleX(0)" }, { transform: "scaleX(1.06)", offset: 0.75 }, { transform: "scaleX(1)" }];
    move(p.line, [{ opacity: 1 }, { opacity: 0 }], 120);
    p.dots.forEach((d) => move(d, [{ transform: "scale(1)" }, { transform: "scale(0)" }], 160, { easing: MG.in }));
    p.edges.forEach((e, i) => move(e, [{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${(i ? 1 : -1) * (ww / 2 + 22)}px)`, opacity: 1, offset: 0.6 }, { transform: `translateX(${(i ? 1 : -1) * (ww / 2 + 60)}px)`, opacity: 0 }], 420, { easing: MG.out }));
    move(p.glow, [{ transform: "scaleX(0)", opacity: 1 }, { transform: "scaleX(1)", opacity: 1, offset: 0.7 }, { transform: "scaleX(1)", opacity: 0 }], 520, { easing: MG.out });
    await move(p.hole, open, 340, { easing: MG.out });
    burst(p.fx, cx, cy, { n: 12, r0: 250, r1: 340, color: P.light, width: 6, turn: Math.PI / 12 });
    ring(p.fx, cx, cy, { r: 300, color: P.white, width: 7 });
    await sleep(160);
    // 4. 窓が画面いっぱいに広がって次の場面
    await move(p.hole, [{ transform: "scale(1)" }, { transform: "scale(5.5)" }], 420, { easing: MG.in });
  });
}
