// シーシャくじのガラガラ（福引きの回転抽選器）。八角の胴がハンドルごと回り、受け口から玉が転がり出て、
// 受け皿で弾んで止まる。玉の色が賞を表す（S＝金・A＝赤・B＝青・C＝白）。終わると kuji.js が賞のカードを出す。
// 胴と台の配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。玉の色は意味を持つので配色によらず固定。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { svg, stageSvg, move, reducedMotion } from "../core/transition-kit.js";
import { pick, burst, ring, confetti, twinkle } from "../core/mg-kit.js";

const DRUM = { bg: "#2a1a12", deep: "#3b2316", main: "#c0392b", mid: "#e8a33d", light: "#ffe2a6", white: "#fff8ec", wood: "#8a5a35", wood2: "#6b4226" };
const MONO_DRUM = { wood: "#4f3596", wood2: "#3d2a78" };
export const BALL = { S: "#f4c542", A: "#e5484d", B: "#3b82f6", C: "#f4f1ea", LAST: "#c9a7ff" };
const BALL_EDGE = { S: "#b8861b", A: "#a8262b", B: "#1f4fa8", C: "#c9c2b4", LAST: "#7d5bc7" };

// 位置（ステージ座標）。胴の中心・半径、受け口、受け皿
const CX = 560, CY = 318, R = 150;
const SPOUT = { x: CX + 112, y: CY + 128 };
const TRAY = { x: 812, y: 556 };

// 区間ごとの緩急（強い曲線を全体に掛けず、区間ごとに付ける）
const OUT = "cubic-bezier(.22,1,.36,1)";
const IN = "cubic-bezier(.55,0,.85,.3)";
const INOUT = "cubic-bezier(.65,0,.35,1)";
const SINE = "cubic-bezier(.37,0,.63,1)";

const octagon = (r) => [...Array(8)].map((_, i) => {
  const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
  return `${(CX + Math.cos(a) * r).toFixed(1)},${(CY + Math.sin(a) * r).toFixed(1)}`;
}).join(" ");

/** 胴（八角・板目・帯）と、胴と一緒に回るハンドル */
function drumArt(P) {
  const spokes = [...Array(8)].map((_, i) => {
    const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
    return svg("line", { x1: CX, y1: CY, x2: CX + Math.cos(a) * R, y2: CY + Math.sin(a) * R, stroke: P.wood2, "stroke-width": 4, opacity: 0.55 });
  });
  const body = svg("g", {}, [
    svg("polygon", { points: octagon(R), fill: P.wood, stroke: P.light, "stroke-width": 6, "stroke-linejoin": "round" }),
    ...spokes,
    svg("polygon", { points: octagon(R * 0.62), fill: "none", stroke: P.light, "stroke-width": 3, opacity: 0.6 }),
    svg("circle", { cx: CX, cy: CY, r: 30, fill: P.main, stroke: P.light, "stroke-width": 5 }),
    svg("circle", { cx: CX, cy: CY, r: 9, fill: P.light }),
  ]);
  // ハンドル: 軸から伸びる腕と握り（胴と同じ中心で回る）
  const handle = svg("g", {}, [
    svg("line", { x1: CX, y1: CY, x2: CX - 128, y2: CY - 60, stroke: P.light, "stroke-width": 12, "stroke-linecap": "round" }),
    svg("rect", { x: CX - 150, y: CY - 92, width: 26, height: 56, rx: 13, fill: P.main, stroke: P.light, "stroke-width": 4 }),
  ]);
  const rot = svg("g", {}, [body, handle]);
  rot.style.transformBox = "view-box";
  rot.style.transformOrigin = `${CX}px ${CY}px`;
  return rot;
}

/** 台（脚と土台）と、玉が出る受け口、受け皿 */
function standArt(P) {
  return svg("g", {}, [
    svg("path", { d: `M ${CX - 96} ${CY + 40} L ${CX - 140} 590 L ${CX - 104} 590 L ${CX - 62} ${CY + 40} Z`, fill: P.wood2 }),
    svg("path", { d: `M ${CX + 96} ${CY + 40} L ${CX + 140} 590 L ${CX + 104} 590 L ${CX + 62} ${CY + 40} Z`, fill: P.wood2 }),
    svg("rect", { x: CX - 210, y: 586, width: 420, height: 26, rx: 8, fill: P.wood, stroke: P.light, "stroke-width": 4 }),
    // 受け口（胴の右下から斜めに出る短い樋）
    svg("path", { d: `M ${SPOUT.x - 26} ${SPOUT.y - 22} L ${SPOUT.x + 34} ${SPOUT.y + 6} L ${SPOUT.x + 26} ${SPOUT.y + 30} L ${SPOUT.x - 34} ${SPOUT.y + 2} Z`, fill: P.main, stroke: P.light, "stroke-width": 4, "stroke-linejoin": "round" }),
    // 受け皿
    svg("path", { d: `M ${TRAY.x - 86} ${TRAY.y + 8} Q ${TRAY.x} ${TRAY.y + 58} ${TRAY.x + 86} ${TRAY.y + 8}`, fill: "none", stroke: P.light, "stroke-width": 8, "stroke-linecap": "round" }),
    svg("ellipse", { cx: TRAY.x, cy: TRAY.y + 40, rx: 70, ry: 10, fill: P.deep, opacity: 0.6 }),
  ]);
}

/** 玉（色・ハイライト・影）。g は位置、body は弾むときの伸び縮み */
function ballArt(rank) {
  const fill = BALL[rank] || BALL.C, edge = BALL_EDGE[rank] || BALL_EDGE.C;
  const body = svg("g", { class: "tr-scale" }, [
    svg("circle", { cx: 0, cy: 0, r: 22, fill, stroke: edge, "stroke-width": 4 }),
    svg("ellipse", { cx: -7, cy: -8, rx: 7, ry: 5, fill: "#ffffff", opacity: 0.75 }),
  ]);
  const shadow = svg("ellipse", { cx: TRAY.x, cy: TRAY.y + 34, rx: 20, ry: 5, fill: "#000", opacity: 0, class: "tr-scale" });
  const g = svg("g", { transform: `translate(${SPOUT.x + 30} ${SPOUT.y + 18})` }, [body]);
  return { g, body, shadow, fill };
}

/** 玉の位置を毎フレーム動かす（放物線や弾みは位置の式で書き、伸び縮みは WAAPI） */
function path(g, ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      const [x, y] = fn(k);
      g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      if (k < 1) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/**
 * host に全面の層を置いてガラガラを回し、rank の玉を出す。終わると層を外す。
 * 動きを減らす設定では玉が出るところだけ短く見せる。
 */
export async function garagara(host, rank = "C") {
  const P = pick(DRUM, MONO_DRUM);
  const reduced = reducedMotion();
  const node = el("div.mo-garagara", { dataset: { motion: "garagara" } });
  const drum = drumArt(P);
  const stand = standArt(P);
  const ball = ballArt(rank);
  const fx = svg("g");
  const art = stageSvg([stand, ball.shadow, drum, ball.g, fx]);
  const top = rank === "S" || rank === "LAST";
  node.append(el("div.mo-garagara-back", { style: { background: `radial-gradient(circle at 50% 45%, ${P.deep}, ${P.bg} 70%)` } }), art);
  host.append(node);
  ball.body.style.transform = "scale(0)";
  try {
    if (reduced) {
      ball.g.setAttribute("transform", `translate(${TRAY.x} ${TRAY.y + 14})`);
      ball.body.style.transform = "scale(1)";
      await sleep(700);
      return;
    }
    // 1. 台が下から、胴が少し遅れて弾んで出る
    move(stand, [{ transform: "translateY(60px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], 380, { easing: OUT });
    await move(drum, [
      { transform: "translateY(-80px) rotate(0deg) scale(0.9)", opacity: 0, easing: OUT },
      { transform: "translateY(6px) rotate(0deg) scale(1)", opacity: 1, offset: 0.7, easing: SINE },
      { transform: "translateY(0) rotate(0deg) scale(1)", opacity: 1 },
    ], 440, { easing: "linear", delay: 80 });
    // 2. ハンドルをぐっと引いてから（ため）、勢いよく1回転半。回るあいだ中の玉の音と台の揺れ
    SE.whoosh();
    const spin = move(drum, [
      { transform: "rotate(0deg)", easing: SINE },
      { transform: "rotate(-14deg)", offset: 0.14, easing: "cubic-bezier(.45,0,.2,1)" },
      { transform: "rotate(560deg)", offset: 0.88, easing: SINE },
      { transform: "rotate(540deg)" },
    ], 1300, { easing: "linear" });
    const rattle = setInterval(() => SE.tick(), 85);
    const shake = stand.animate([{ transform: "translateX(0)" }, { transform: "translateX(-2px)" }, { transform: "translateX(2px)" }, { transform: "translateX(0)" }], { duration: 120, iterations: 8, delay: 230 });
    await spin;
    clearInterval(rattle);
    shake.cancel();
    // 3. 受け口から玉がころんと出て、放物線で受け皿へ。2回弾んで止まる
    SE.puka();
    move(ball.body, [{ transform: "scale(0)" }, { transform: "scale(1.15)", offset: 0.6 }, { transform: "scale(1)" }], 220, { easing: OUT });
    const sx = SPOUT.x + 30, sy = SPOUT.y + 18, ex = TRAY.x, ey = TRAY.y + 14;
    await path(ball.g, 420, (k) => [sx + (ex - sx) * k, sy + (ey - sy) * k * k - 70 * Math.sin(Math.PI * k) * (1 - k)]);
    const hop = async (h, ms) => {
      SE.click();
      move(ball.body, [{ transform: "scale(1.25, 0.75)", easing: OUT }, { transform: "scale(0.92, 1.08)", offset: 0.4, easing: SINE }, { transform: "scale(1)" }], Math.min(260, ms), { easing: "linear" });
      move(ball.shadow, [{ transform: "scale(1)", opacity: 0.35 }, { transform: "scale(0.6)", opacity: 0.15, offset: 0.5 }, { transform: "scale(1)", opacity: 0.35 }], ms, { easing: "linear" });
      await path(ball.g, ms, (k) => [ex + 18 * k, ey - h * 4 * k * (1 - k)]);
    };
    await hop(46, 300);
    await hop(14, 200);
    move(ball.body, [{ transform: "scale(1.12, 0.9)" }, { transform: "scale(1)" }], 160, { easing: OUT });
    // 4. 玉が光る。上位の賞は放射線と紙吹雪を大きく
    await sleep(160);
    const bx = ex + 18, by = ey;
    SE.select();
    ring(fx, bx, by, { r: top ? 220 : 120, color: ball.fill, width: top ? 10 : 7 });
    burst(fx, bx, by, { n: top ? 16 : 10, r0: 40, r1: top ? 170 : 100, color: ball.fill, width: 6 });
    if (top) {
      confetti(fx, bx, by - 20, { n: 26, colors: [BALL.S, P.light, P.white, P.main], spread: 360 });
      [[-120, -90], [110, -120], [-60, -170], [150, -40]].forEach(([dx, dy], i) => twinkle(fx, bx + dx, by + dy, { color: P.light, size: 18, delay: i * 90 }));
    }
    move(ball.body, [{ transform: "scale(1)" }, { transform: "scale(1.5)", offset: 0.45, easing: SINE }, { transform: "scale(1.3)" }], 520, { easing: OUT });
    await sleep(top ? 800 : 560);
    // 5. 退場（このあと賞のカードが出る）
    await move(node, [{ opacity: 1 }, { opacity: 0 }], 220, { easing: IN });
  } finally {
    node.remove();
  }
}

