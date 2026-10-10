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

// ---------------------------------------------------------------- b: （CI109 で作る別パターン。できるまでは a と同じ）

export function b(host, opts = {}) {
  return a(host, opts);
}
