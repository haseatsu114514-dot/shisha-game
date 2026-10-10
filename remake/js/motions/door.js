// マップ→場所の「扉」の移動（?move=door）。a／b の2パターン（?movar=b）、配色は紫1色／場面ごとの色（?mopal=free）。
// 戻り値は transition-kit の curtain()（covered／release）。地図の上でピン（x, y）から始まる。
import { sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move, curtain } from "../core/transition-kit.js";
import { MG_EASE as MG, pick, burst, ring } from "../core/mg-kit.js";

let doorSerial = 0;

// ---------------------------------------------------------------- a: シンプルな四角い扉のモーショングラフィックス（CI108）
// ピンから輪が弾けて2色の円が重なって広がり、床と枠が線で描かれ、扉の板が下から立ち上がる。
// 開くと光と放射線が出て、戸口が画面いっぱいに広がる。配色は紫1色か場面ごとの色（mg-kit の pick）

const DOOR = { bg: "#14213d", deep: "#0b1426", main: "#ff6b5a", mid: "#ffb4a2", light: "#ffd166", white: "#fff8ec" };

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

// ---------------------------------------------------------------- b: 引き戸。平らな2枚の戸が両脇から滑ってきて閉まり、光のすき間から左右へ開く
// ピンから角の丸い四角が2色で広がり、柱・鴨居・敷居が線で描かれる。戸は戸口の中だけに見え、脇の壁の裏へ出入りする。
// 開くと床に光が差し、カメラが戸口へ寄って（枠が壁より速く近づく）次の場面

const SLIDE = { bg: "#1e3a34", deep: "#0f211d", main: "#e0a458", mid: "#5fb3a1", light: "#f4d58d", white: "#fffaf0", edge: "#c4863d" };
const MONO_EDGE = "#55409a"; // 紫1色の戸の内枠（戸より少し濃い紫）

export function b(host, { x = W / 2, y = H / 2 } = {}) {
  const P = pick(SLIDE, { edge: MONO_EDGE });
  const dw = 360, dh = 470, dx = (W - dw) / 2, dy = 118, cx = W / 2, cy = dy + dh / 2;
  const half = dw / 2;
  let p;
  return curtain(host, "door", async (node) => {
    // 1. ピンで菱形が回って四角になり、2色の角丸の四角が少しずれて画面いっぱいに広がる
    const rw = 2 * Math.max(x, W - x) + 80, rh = 2 * Math.max(y, H - y) + 80;
    const plate = (fill) => svg("rect", { x: x - rw / 2, y: y - rh / 2, width: rw, height: rh, rx: 60, fill, class: "tr-scale" });
    const c1 = plate(P.mid), c2 = plate(P.bg);
    const seed = svg("rect", { x: x - 22, y: y - 22, width: 44, height: 44, rx: 8, fill: "none", stroke: P.light, "stroke-width": 6, class: "tr-scale" });
    c1.style.transform = c2.style.transform = "scale(0)";
    const intro = stageSvg([c1, c2, seed]);
    node.append(intro);
    move(seed, [{ transform: "rotate(45deg) scale(0.3)", opacity: 1 }, { transform: "rotate(0deg) scale(1.4)", opacity: 1, offset: 0.6 }, { transform: "rotate(0deg) scale(2.2)", opacity: 0 }], 420, { easing: MG.out });
    const grow = [{ transform: "scale(0)" }, { transform: "scale(1)" }];
    move(c1, grow, 320, { easing: MG.in });
    await move(c2, grow, 330, { easing: MG.in, delay: 70 });
    // 2. 壁と戸口。柱・鴨居・敷居が中心から外へ線で描かれ、戸が両脇から滑ってきて真ん中で閉まる
    const id = `tr-door-${++doorSerial}`;
    const box = { x: -300, y: -300, width: W + 600, height: H + 600 };
    const hole = svg("rect", { x: dx, y: dy, width: dw, height: dh, fill: "#000" });
    const room = svg("rect", { x: dx, y: dy, width: dw, height: dh, fill: P.deep });
    const light = svg("rect", { x: dx, y: dy, width: dw, height: dh, fill: P.white, opacity: 0 });
    const spill = svg("path", { d: `M ${dx} ${dy + dh} H ${dx + dw} L ${dx + dw + 150} ${H} H ${dx - 150} Z`, fill: `url(#${id}-g)`, opacity: 0 });
    spill.style.transformOrigin = `${cx}px ${dy + dh}px`;
    const trim = (d, w, color) => svg("path", { d, fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
    const rails = [
      trim(`M ${cx} ${dy - 8} H ${dx - 40}`, 14, P.light), trim(`M ${cx} ${dy - 8} H ${dx + dw + 40}`, 14, P.light), // 鴨居
      trim(`M ${cx} ${dy + dh + 6} H -20`, 6, P.mid), trim(`M ${cx} ${dy + dh + 6} H ${W + 20}`, 6, P.mid), // 敷居から床の線
      trim(`M ${dx - 10} ${dy + dh} V ${dy - 8}`, 10, P.light), trim(`M ${dx + dw + 10} ${dy + dh} V ${dy - 8}`, 10, P.light), // 柱
    ];
    // 戸1枚: 平らな板・上の明かり窓・合わせ目側の引手。戸口の形で切り抜くので、脇の壁の裏から出入りして見える
    const leaf = (side) => {
      const lx = side < 0 ? dx : cx;
      const px = side < 0 ? lx + 18 : lx + 44, pw = half - 62, ph = 250;
      const hx = side < 0 ? lx + half - 28 : lx + 18;
      // 明かり窓は障子のような組子（縦2本・横3本）、引手は丸く彫り込んだ形にして洋風の両開きに見せない
      const kumiko = [1, 2].map((k) => svg("line", { x1: px + (pw * k) / 3, y1: dy + 22, x2: px + (pw * k) / 3, y2: dy + 22 + ph, stroke: P.edge, "stroke-width": 3 }))
        .concat([1, 2, 3].map((k) => svg("line", { x1: px, y1: dy + 22 + (ph * k) / 4, x2: px + pw, y2: dy + 22 + (ph * k) / 4, stroke: P.edge, "stroke-width": 3 })));
      const g = svg("g", {}, [
        svg("rect", { x: lx, y: dy, width: half, height: dh, fill: P.main }),
        svg("rect", { x: px, y: dy + 22, width: pw, height: ph, fill: P.light, "fill-opacity": 0.42, stroke: P.edge, "stroke-width": 4 }),
        ...kumiko,
        svg("line", { x1: px, y1: dy + ph + 60, x2: px + pw, y2: dy + ph + 60, stroke: P.edge, "stroke-width": 4 }),
        svg("circle", { cx: hx + 5, cy, r: 11, fill: "none", stroke: P.deep, "stroke-width": 4 }),
        svg("circle", { cx: hx + 5, cy, r: 6, fill: P.deep, "fill-opacity": 0.55 }),
      ]);
      g.style.transform = `translateX(${side * (half + 8)}px)`;
      return g;
    };
    const leaves = [leaf(-1), leaf(1)];
    const seam = svg("line", { x1: cx, y1: dy, x2: cx, y2: dy + dh, stroke: P.white, "stroke-width": 4, "stroke-linecap": "round", class: "tr-scale" });
    seam.style.transform = "scaleY(0)";
    const wall = svg("g", {}, [
      svg("rect", { ...box, fill: P.bg, mask: `url(#${id}-m)` }),
      room, light,
      svg("g", { "clip-path": `url(#${id}-c)` }, leaves),
      seam,
    ]);
    const frame = svg("g", {}, rails);
    const fx = svg("g");
    for (const g of [wall, frame]) g.style.transformOrigin = `${cx}px ${cy}px`;
    const art = stageSvg([
      svg("defs", {}, [
        svg("mask", { id: `${id}-m`, maskUnits: "userSpaceOnUse", ...box }, [svg("rect", { ...box, fill: "#fff" }), hole]),
        svg("clipPath", { id: `${id}-c` }, [svg("rect", { x: dx, y: dy, width: dw, height: dh })]),
        svg("linearGradient", { id: `${id}-g`, x1: 0, y1: 0, x2: 0, y2: 1 }, [svg("stop", { offset: 0, "stop-color": P.white, "stop-opacity": 0.9 }), svg("stop", { offset: 1, "stop-color": P.white, "stop-opacity": 0 })]),
      ]),
      wall, spill, frame, fx,
    ]);
    node.replaceChildren(art);
    p = { wall, frame, room, light, spill, leaves, seam, fx };
    rails.forEach((r, i) => move(r, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 300, { easing: MG.out, delay: [0, 0, 40, 40, 90, 90][i] }));
    SE.whoosh();
    await Promise.all(leaves.map((g, i) => {
      const s = i ? 1 : -1;
      return move(g, [{ transform: `translateX(${s * (half + 8)}px)` }, { transform: `translateX(${-s * 5}px)`, offset: 0.72 }, { transform: "translateX(0px)" }], 400, { easing: MG.out, delay: 60 + i * 30 });
    }));
    // 閉まった音の代わりに、合わせ目の上下で小さくはじける
    burst(fx, cx, dy + 4, { n: 5, r0: 14, r1: 44, color: P.light, width: 5, turn: -Math.PI * 0.9, dur: 380 });
    burst(fx, cx, dy + dh - 4, { n: 5, r0: 14, r1: 44, color: P.light, width: 5, turn: Math.PI * 0.1, dur: 380 });
  }, async () => {
    await sleep(110);
    SE.doorbell();
    // 3. 合わせ目に光の線が走り、戸が少しためてから左右の壁の裏へ滑って開く。床に光が差す
    p.room.remove();
    p.light.setAttribute("opacity", 1);
    await move(p.seam, [{ transform: "scaleY(0)", opacity: 1 }, { transform: "scaleY(1)", opacity: 1 }], 160, { easing: MG.out });
    p.leaves.forEach((g, i) => {
      const s = i ? 1 : -1;
      move(g, [{ transform: "translateX(0px)" }, { transform: `translateX(${-s * 4}px)`, offset: 0.18 }, { transform: `translateX(${s * (half + 8)}px)` }], 420, { easing: MG.inOut });
    });
    move(p.seam, [{ opacity: 1, strokeWidth: 4 }, { opacity: 0, strokeWidth: 40 }], 300, { easing: MG.out, delay: 120 });
    move(p.spill, [{ transform: "scaleY(0)", opacity: 0 }, { transform: "scaleY(1)", opacity: 0.5 }], 360, { easing: MG.out, delay: 200 });
    await sleep(300);
    burst(p.fx, cx, cy, { n: 12, r0: 250, r1: 350, color: P.light, width: 6, turn: Math.PI / 12 });
    ring(p.fx, cx, cy, { r: 320, color: P.white, width: 7 });
    await sleep(140);
    // 4. 戸口へ寄る。手前の枠は壁より速く大きくなり、光が晴れて次の場面
    move(p.spill, [{ opacity: 0.5 }, { opacity: 0 }], 200);
    move(p.light, [{ opacity: 1 }, { opacity: 0 }], 300, { easing: MG.out, delay: 100 });
    move(p.frame, [{ transform: "scale(1)" }, { transform: "scale(9)" }], 420, { easing: MG.in });
    await move(p.wall, [{ transform: "scale(1)" }, { transform: "scale(6.5)" }], 460, { easing: MG.in });
  });
}
