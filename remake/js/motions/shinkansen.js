// 新幹線の乗車（Issue #1059）。東京編の往路（地元→東京・ch3_train_arrival の直前）と
// 復路（東京→地元・ch3_home_customer の直前）で共通の車窓を使う。新しい素材は使わず、
// 既存のモーション基盤（transition-kit / mg-kit / stage）だけで組む。
import { SE } from "../core/audio.js";
import { svg, stageSvg, move } from "../core/transition-kit.js";
import { MONO } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

/** 色: bg 車内の暗がり・seat 座席・win 窓の外の暗がり・sky 高速で流れる車窓・streak 流れる光・
 * sign 行先表示の板・signText 表示の文字・ink 輪郭・rim 縁の光 */
const P = { bg: MONO.deep, seat: "#3a2a6e", seatDark: "#1e1544", win: "#241a4a",
  sky: "#4c3c92", streak: MONO.light, glow: MONO.white, ink: "#0b0718", rim: MONO.white,
  sign: "#140d30", signText: MONO.light };

const W_ = 1280, H_ = 720;
const WIN_X = 520; // 窓の左端（この左側が座席の影）
const SLANT = 70; // 窓の進行方向の傾き
const FADE_IN = 240, RIDE = 1200, FADE_OUT = 300;
const TOTAL = FADE_IN + RIDE + FADE_OUT; // 約1.7秒。通常電車(#891)より少しだけ長い一度きりの場面。

const DEST_LABEL = { home: "地元", tokyo: "東京" };

/** 行先表示の文字列。opts.to が未知のときは何も断定しない。 */
function destinationLabel(opts = {}) {
  const label = DEST_LABEL[opts.to];
  return label ? `のぞみ ▶ ${label}` : "のぞみ";
}

/** 流れる車窓（速さで通常電車と差をつける。街の輪郭は抽象化し行き先の実在地名に固定しない） */
function window_(id) {
  const clipId = `${id}-win`, glowId = `${id}-glow`;
  const win = svg("polygon", { points: `${WIN_X + SLANT},70 ${W_ + 40},70 ${W_ + 40},${H_ - 40} ${WIN_X},${H_ - 40}` });
  const defs = svg("defs", {}, [
    svg("clipPath", { id: clipId }, [win.cloneNode()]),
    svg("linearGradient", { id: glowId, x1: 0, y1: 0, x2: 0, y2: 1 }, [
      svg("stop", { offset: 0, "stop-color": P.sky, "stop-opacity": 0.9 }),
      svg("stop", { offset: 1, "stop-color": P.win, "stop-opacity": 1 }),
    ]),
  ]);
  const scenery = svg("g", { "clip-path": `url(#${clipId})` }, [
    svg("rect", { x: WIN_X - 40, y: 60, width: W_ - WIN_X + 80, height: H_ - 90, fill: `url(#${glowId})` }),
  ]);
  // 横に長い帯（高速の流れ）。右端から現れて窓の左でまた現れる周期にし、窓の外で止まった
  // ままにならないようにする。幅と不透明度を散らして単調にしない。
  const RIGHT = W_ + 40;
  const streaks = [];
  for (let i = 0; i < 10; i++) {
    const y = 110 + i * 56 + (i % 2) * 18;
    const len = 260 + (i % 4) * 90;
    const track = RIGHT - (WIN_X - len); // 右端から窓の左外まで走る距離
    const streak = svg("rect", { x: RIGHT, y, width: len, height: i % 3 === 0 ? 10 : 5,
      rx: 4, fill: P.streak, opacity: i % 3 === 0 ? 0.28 : 0.16 });
    scenery.append(streak);
    streaks.push({ node: streak, y, len, track, phase: (i / 10) * track, speed: 900 + (i % 5) * 260 });
  }
  const rim = svg("polygon", { points: win.getAttribute("points"), fill: "none", stroke: P.rim, "stroke-width": 5, opacity: 0.5 });
  return { g: svg("g", {}, [defs, scenery, rim]), scenery, streaks };
}

/** 手前の座席（ヘッドレスト・テーブル）。行き先に関わらず同じ一人分の指定席。 */
function seat(id) {
  const g = svg("g");
  g.append(svg("rect", { x: -40, y: 0, width: WIN_X - 60, height: H_, fill: P.bg }));
  // ヘッドレスト
  g.append(svg("path", {
    d: `M -40 150 Q -20 70 140 70 Q 300 70 320 150 L 320 420 L -40 420 Z`,
    fill: P.seat, stroke: P.ink, "stroke-width": 4,
  }));
  g.append(svg("rect", { x: -40, y: 400, width: 360, height: H_ - 400, fill: P.seatDark }));
  // 読書灯の柔らかい光
  const glowId = `${id}-lamp`;
  g.append(svg("defs", {}, [svg("radialGradient", { id: glowId }, [
    svg("stop", { offset: 0, "stop-color": P.glow, "stop-opacity": 0.5 }),
    svg("stop", { offset: 1, "stop-color": P.glow, "stop-opacity": 0 }),
  ])]));
  g.append(svg("circle", { cx: 150, cy: 40, r: 120, fill: `url(#${glowId})` }));
  // 小さなテーブルの縁と案内状(既存背景 bg_ch3_train_arrival の机上と同じ小物を示す程度の輪郭)
  g.append(svg("rect", { x: 40, y: 470, width: 230, height: 18, rx: 6, fill: P.seatDark, stroke: P.ink, "stroke-width": 3 }));
  g.append(svg("rect", { x: 92, y: 440, width: 110, height: 70, rx: 4, fill: P.rim, opacity: 0.85 }));
  return g;
}

/** 行先表示の板。往路/復路で文字だけが変わる。 */
function sign(label) {
  const plate = svg("rect", { x: W_ / 2 - 150, y: 26, width: 300, height: 54, rx: 10, fill: P.sign, stroke: P.rim, "stroke-width": 2, opacity: 0 });
  const text = svg("text", { x: W_ / 2, y: 60, "text-anchor": "middle", "font-size": 24, "font-weight": 700, "letter-spacing": 2, fill: P.signText, opacity: 0 }, [label]);
  return { plate, text };
}

let serial = 0;
export async function a(mid, opts = {}) {
  const id = `mo-shinkansen-${++serial}`;
  await stagePlay("shinkansen", async (node) => {
    node.style.opacity = "0";
    const win = window_(id);
    const car = svg("g", {}, [seat(id), win.g]);
    const { plate, text } = sign(destinationLabel(opts));
    const art = stageSvg([car, plate, text]);
    art.setAttribute("preserveAspectRatio", "xMidYMid slice");
    node.append(backdrop(P.bg), art);
    const t0 = performance.now();
    let frameId = 0;
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      const sway = 2.2 * Math.sin(t * Math.PI * 1.6); // 高速走行の細かい縦揺れ
      car.setAttribute("transform", `translate(0 ${sway.toFixed(2)})`);
      for (const s of win.streaks) {
        const x = (W_ + 40) - ((t * s.speed + s.phase) % s.track);
        s.node.setAttribute("x", x.toFixed(1));
      }
      frameId = requestAnimationFrame(frame);
    };
    frame();
    try {
      SE.shinkansen?.(TOTAL / 1000);
      await move(node, [{ opacity: 0 }, { opacity: 1 }], FADE_IN, { easing: "ease-out" });
      move(plate, [{ opacity: 0 }, { opacity: 0.92 }], 220, { easing: "ease-out", delay: 60, fill: "forwards" });
      move(text, [{ opacity: 0 }, { opacity: 1 }], 220, { easing: "ease-out", delay: 60, fill: "forwards" });
      try {
        await Promise.all([new Promise(r => setTimeout(r, RIDE)), Promise.resolve().then(() => mid?.())]);
      } finally {
        await move(node, [{ opacity: 1 }, { opacity: 0 }], FADE_OUT, { easing: "ease-in-out" });
      }
    } finally {
      cancelAnimationFrame(frameId);
    }
  }, { cover: true });
}

export const b = a;
