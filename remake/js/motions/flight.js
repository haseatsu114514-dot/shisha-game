// 飛行機の機窓（#2688 A4・Issue #2733）。第4章の日本→ドバイの出発と、第5章のドバイへの往復で使う。
// 電車（第2章 #891 train.js）・新幹線（第3章 #1059 shinkansen.js）と並ぶ「移動の三部作」の三つ目。
// 新しい素材は使わず、既存のモーション基盤（transition-kit / mg-kit / stage）だけで組む。緑は使わない。
// 紫の機内に丸い窓。雲の帯が流れ、窓の外が夜 → 朝焼け（時差）→ 地平線（ドバイ行きは砂、帰りは海）へ移る。約2.8秒。
// SKIP中は短い版（約1.1秒）、動きを減らす設定では動かない窓をフェードで見せるだけにする（scene-motions.js flightRide）。
import { SE } from "../core/audio.js";
import { svg, stageSvg, move } from "../core/transition-kit.js";
import { MONO } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

/** 色: bg 機内の暗がり・wall 窓の周りの壁・rim 窓枠・night/dawn/day 窓の外の空・glow 朝焼けの帯・
 * cloud 流れる雲・sand 砂の地平線（ピンク寄り）・sea 帰りの海・star 星・sign 行先表示 */
const P = { bg: MONO.deep, wall: "#2c2160", wallDark: "#1e1544", rim: MONO.light, ink: "#0b0718",
  night: "#120c2c", nightHigh: "#241a4a", dawn: "#6b4fb0", dawnHigh: "#34246a", glow: "#f06aae",
  day: "#dcd1f4", dayHigh: "#9a82d8", cloud: MONO.white, sand: "#e9a3c4", sandDark: "#b46f9a",
  sea: "#8f86d6", seaDark: "#5c4fa8", star: MONO.white, sign: "#140d30", signText: MONO.light };

const W_ = 1280, H_ = 720;
// 窓（角の丸い縦長の窓）。full は画面の中央に大きく、brief（SKIP）は同じ窓のまま。
const WIN = { x: 430, y: 110, w: 420, h: 520, r: 190 };
const TIMING = {
  full: { fadeIn: 280, ride: 2200, fadeOut: 320 }, // 約2.8秒
  brief: { fadeIn: 160, ride: 760, fadeOut: 200 }, // SKIP中の短い版（約1.1秒）
  still: { fadeIn: 220, ride: 420, fadeOut: 300 }, // 動きを減らす設定: 動かない窓のフェードだけ
};

const DEST_LABEL = { home: "地元", dubai: "ドバイ" };

/** 行先表示の文字列。opts.to が未知のときは何も断定しない。 */
export function destinationLabel(opts = {}) {
  const label = DEST_LABEL[opts.to];
  return label ? `FLIGHT ▶ ${label}` : "FLIGHT";
}

const grad = (id, top, bottom) => svg("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, [
  svg("stop", { offset: 0, "stop-color": top }),
  svg("stop", { offset: 1, "stop-color": bottom }),
]);

/** 窓の外。夜・朝焼け・昼の空を重ね、時間に合わせて上の層を透かしていく。 */
function outside(id, to) {
  const clipId = `${id}-win`;
  const shape = { x: WIN.x, y: WIN.y, width: WIN.w, height: WIN.h, rx: WIN.r, ry: WIN.r };
  const defs = svg("defs", {}, [
    svg("clipPath", { id: clipId }, [svg("rect", shape)]),
    grad(`${id}-night`, P.night, P.nightHigh),
    grad(`${id}-dawn`, P.dawnHigh, P.glow),
    grad(`${id}-day`, P.dayHigh, P.day),
  ]);
  const box = { x: WIN.x - 20, y: WIN.y - 20, width: WIN.w + 40, height: WIN.h + 40 };
  const night = svg("rect", { ...box, fill: `url(#${id}-night)` });
  const dawn = svg("rect", { ...box, fill: `url(#${id}-dawn)`, opacity: 0 });
  const day = svg("rect", { ...box, fill: `url(#${id}-day)`, opacity: 0 });
  const stars = svg("g");
  for (let i = 0; i < 14; i++) {
    stars.append(svg("circle", { cx: WIN.x + 30 + ((i * 97) % (WIN.w - 60)), cy: WIN.y + 40 + ((i * 53) % 260),
      r: i % 4 === 0 ? 3 : 1.8, fill: P.star, opacity: i % 3 === 0 ? 0.9 : 0.55 }));
  }
  // 地平線: ドバイ行きは砂丘のうねり（ピンク）、帰りは平らな海。下から少しずつ昇ってくる。
  const groundY = WIN.y + WIN.h - 150;
  const ground = to === "home"
    ? svg("g", {}, [
      svg("rect", { x: WIN.x - 20, y: groundY + 20, width: WIN.w + 40, height: 200, fill: P.sea }),
      svg("rect", { x: WIN.x - 20, y: groundY + 70, width: WIN.w + 40, height: 160, fill: P.seaDark }),
      svg("rect", { x: WIN.x - 20, y: groundY + 18, width: WIN.w + 40, height: 4, fill: P.day, opacity: 0.8 }),
    ])
    : svg("g", {}, [
      svg("path", { d: `M ${WIN.x - 20} ${groundY + 40} Q ${WIN.x + 120} ${groundY - 10} ${WIN.x + 240} ${groundY + 30} T ${WIN.x + WIN.w + 20} ${groundY + 20} L ${WIN.x + WIN.w + 20} ${WIN.y + WIN.h + 20} L ${WIN.x - 20} ${WIN.y + WIN.h + 20} Z`, fill: P.sand }),
      svg("path", { d: `M ${WIN.x - 20} ${groundY + 100} Q ${WIN.x + 160} ${groundY + 60} ${WIN.x + 300} ${groundY + 96} T ${WIN.x + WIN.w + 20} ${groundY + 90} L ${WIN.x + WIN.w + 20} ${WIN.y + WIN.h + 20} L ${WIN.x - 20} ${WIN.y + WIN.h + 20} Z`, fill: P.sandDark }),
    ]);
  ground.setAttribute("opacity", "0");
  // 雲の帯: 右から左へ流れる（機体は右へ進む）。窓の外で止まったままにならないよう周期で回す。
  const clouds = [];
  const cloudLayer = svg("g");
  const track = WIN.w + 520;
  for (let i = 0; i < 6; i++) {
    const len = 180 + (i % 3) * 90;
    const y = WIN.y + 150 + i * 58;
    const node = svg("rect", { x: WIN.x + WIN.w, y, width: len, height: i % 2 ? 22 : 34, rx: 17,
      fill: P.cloud, opacity: i % 2 ? 0.22 : 0.34 });
    cloudLayer.append(node);
    clouds.push({ node, len, phase: (i / 6) * track, speed: 260 + (i % 3) * 120 });
  }
  const scenery = svg("g", { "clip-path": `url(#${clipId})` }, [night, dawn, day, stars, ground, cloudLayer]);
  return { g: svg("g", {}, [defs, scenery]), night, dawn, day, stars, ground, clouds, track };
}

/** 窓の周りの壁と窓枠（内側の枠・日よけの縁）。顔や人物は描かない。 */
function cabin() {
  const g = svg("g");
  // 窓の穴を抜いた壁（evenodd で丸い窓の形を抜く）
  const r = WIN.r, x = WIN.x, y = WIN.y, w = WIN.w, h = WIN.h;
  const hole = `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  g.append(svg("path", { d: `M -40 -40 H ${W_ + 40} V ${H_ + 40} H -40 Z ${hole}`, fill: P.wall, "fill-rule": "evenodd" }));
  // 内側の厚い枠と、上に少し下ろした日よけ
  g.append(svg("rect", { x: x - 34, y: y - 34, width: w + 68, height: h + 68, rx: r + 34, ry: r + 34,
    fill: "none", stroke: P.wallDark, "stroke-width": 40 }));
  g.append(svg("rect", { x: x - 6, y: y - 6, width: w + 12, height: h + 12, rx: r + 6, ry: r + 6,
    fill: "none", stroke: P.rim, "stroke-width": 6, opacity: 0.6 }));
  g.append(svg("rect", { x: x + 40, y: y - 20, width: w - 80, height: 26, rx: 12, fill: P.wallDark, stroke: P.ink, "stroke-width": 3 }));
  // 窓の下の肘掛けの影
  g.append(svg("rect", { x: -40, y: H_ - 56, width: W_ + 80, height: 100, fill: P.wallDark }));
  return g;
}

/** 行先表示の板（新幹線と同じ形）。往路/復路で文字だけが変わる。 */
function sign(label) {
  const plate = svg("rect", { x: W_ / 2 - 150, y: 26, width: 300, height: 54, rx: 10, fill: P.sign, stroke: P.rim, "stroke-width": 2, opacity: 0 });
  const text = svg("text", { x: W_ / 2, y: 60, "text-anchor": "middle", "font-size": 24, "font-weight": 700, "letter-spacing": 2, fill: P.signText, opacity: 0 }, [label]);
  return { plate, text };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const span = (p, a, b) => clamp01((p - a) / (b - a));

/** 進み具合 p（0〜1）で空を移す: 夜 → 朝焼け → 地平線。 */
function paint(view, p) {
  view.stars.setAttribute("opacity", (1 - span(p, 0.15, 0.4)).toFixed(3));
  view.dawn.setAttribute("opacity", span(p, 0.18, 0.45).toFixed(3));
  view.day.setAttribute("opacity", span(p, 0.52, 0.78).toFixed(3));
  const rise = span(p, 0.5, 0.85);
  view.ground.setAttribute("opacity", rise.toFixed(3));
  view.ground.setAttribute("transform", `translate(0 ${((1 - rise) * 60).toFixed(1)})`);
}

let serial = 0;
/** mode: "full"（約2.8秒）| "brief"（SKIP中）| "still"（動きを減らす設定。窓は動かずフェードだけ） */
export async function a(mid, opts = {}) {
  const mode = TIMING[opts.mode] ? opts.mode : "full";
  const { fadeIn, ride, fadeOut } = TIMING[mode];
  const id = `mo-flight-${++serial}`;
  await stagePlay("flight", async (node) => {
    node.style.opacity = "0";
    node.dataset.mode = mode;
    const view = outside(id, opts.to);
    const plane = svg("g", {}, [view.g, cabin()]);
    const { plate, text } = sign(destinationLabel(opts));
    const art = stageSvg([plane, plate, text]);
    art.setAttribute("preserveAspectRatio", "xMidYMid slice");
    node.append(backdrop(P.bg), art);
    let frameId = 0;
    if (mode === "still") {
      paint(view, 1); // 着いた後の地平線を、動かさずに見せる
      plate.setAttribute("opacity", "0.92");
      text.setAttribute("opacity", "1");
    } else {
      const t0 = performance.now();
      const total = fadeIn + ride;
      const frame = () => {
        const ms = performance.now() - t0;
        const t = ms / 1000;
        paint(view, clamp01((ms - fadeIn * 0.5) / total));
        // ゆっくりした機体の揺れ（新幹線より大きく遅い）
        plane.setAttribute("transform", `translate(0 ${(3 * Math.sin(t * Math.PI * 0.9)).toFixed(2)})`);
        for (const c of view.clouds) {
          const x = (WIN.x + WIN.w + 20) - ((t * c.speed * (mode === "brief" ? 2 : 1) + c.phase) % view.track);
          c.node.setAttribute("x", x.toFixed(1));
        }
        frameId = requestAnimationFrame(frame);
      };
      frame();
    }
    try {
      if (mode !== "still") SE.flight?.((fadeIn + ride + fadeOut) / 1000);
      await move(node, [{ opacity: 0 }, { opacity: 1 }], fadeIn, { easing: "ease-out" });
      if (mode !== "still") {
        move(plate, [{ opacity: 0 }, { opacity: 0.92 }], 220, { easing: "ease-out", delay: 60, fill: "forwards" });
        move(text, [{ opacity: 0 }, { opacity: 1 }], 220, { easing: "ease-out", delay: 60, fill: "forwards" });
      }
      try {
        await Promise.all([new Promise(r => setTimeout(r, ride)), Promise.resolve().then(() => mid?.())]);
      } finally {
        await move(node, [{ opacity: 1 }, { opacity: 0 }], fadeOut, { easing: "ease-in-out" });
      }
    } finally {
      cancelAnimationFrame(frameId);
    }
  }, { cover: true });
}

export const b = a;
