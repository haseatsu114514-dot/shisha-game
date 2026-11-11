// 新幹線の乗車（Issue #1059）。東京編の往路（地元→東京・ch3_train_arrival の直前）と
// 復路（東京→地元・ch3_home_customer の直前）で共通の車窓を使う。新しい素材は使わず、
// 既存のモーション基盤（transition-kit / mg-kit / stage）だけで組む。
import { SE } from "../core/audio.js";
import { svg, stageSvg, move, EASE } from "../core/transition-kit.js";
import { el, sleep } from "../core/util.js";
import { smokeOut } from "../core/transitions.js";
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

// ---------------------------------------------------------------- c: 作り直し（TMG58・見本 remake/previews/motion-direction/ の6）
// 紫の線画の車内をやめ、最初から本物の車内の絵（第3章の新幹線の背景）を使う。窓の中だけ景色の筋が流れ続け、
// 減速して止まると、止まった景色（絵そのもの）が見える。前の場面は煙のにじみでほどけて車内になる。
// 往路（→東京）は着いた先がこの車内の場面なのでそのまま渡し、復路（→地元）は最後に車内が煙のにじみでほどけて地元の場面になる。

const CAR_ART = new URL("../../img/backgrounds/bg_ch3_train_arrival.webp", import.meta.url).href;
// 絵の窓の輪郭（絵に対する %）。左の縁は上から下へ、そこから窓の下の縁が右下へ下がる
const CAR_WINDOW = [[33.4, 0], [100, 0], [100, 83], [86, 75.5], [72, 68], [58, 60.6], [46, 54.4], [39, 50.6], [35.6, 47.6], [34.2, 43], [33.6, 30]];
const WINDOW_CLIP = `polygon(${CAR_WINDOW.map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
/** 高さ y%（0〜83）での窓の左の縁（%） */
function windowLeft(y) {
  const edge = [[0, 33.4], [30, 33.6], [43, 34.2], [47.6, 35.6], [50.6, 39], [54.4, 46], [60.6, 58], [68, 72], [75.5, 86], [83, 100]];
  for (let i = 1; i < edge.length; i++) {
    const [y0, x0] = edge[i - 1], [y1, x1] = edge[i];
    if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
  }
  return 100;
}

/** 車窓の「流れ」の絵: 行ごとに窓の中の景色を横に縮めて色だけにし、横へ引き伸ばす（左右対称にして継ぎ目なく繰り返す） */
async function streakTexture(img) {
  if (!img.naturalWidth || typeof document === "undefined") return null;
  const OW = 512, OH = 360, NW = 12;
  const small = document.createElement("canvas");
  small.width = NW * 2; small.height = OH;
  const sc = small.getContext("2d");
  sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = "high";
  for (let row = 0; row < OH; row++) {
    const y = Math.min(82, ((row + 0.5) / OH) * 100);
    const sx = Math.floor((Math.min(97, windowLeft(y) + 2.5) / 100) * img.naturalWidth);
    const sy = Math.floor((y / 100) * img.naturalHeight);
    sc.drawImage(img, sx, sy, img.naturalWidth - sx, 1, 0, row, NW, 1);
    sc.save(); sc.scale(-1, 1); sc.drawImage(img, sx, sy, img.naturalWidth - sx, 1, -NW * 2, row, NW, 1); sc.restore();
  }
  const c = document.createElement("canvas");
  c.width = OW; c.height = OH;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, OW, OH);
  // 細い光と影の筋（速さの手がかり）。乱数の種は固定
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 90; i++) {
    const y = rand() * OH, x = rand() * OW, len = 40 + rand() * 220;
    ctx.fillStyle = rand() < 0.5 ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.08)";
    ctx.fillRect(x, y, len, 1 + rand() * 2);
    if (x + len > OW) ctx.fillRect(x - OW, y, len, 1 + rand() * 2);
  }
  const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.85));
  return blob ? URL.createObjectURL(blob) : null;
}

/** 今見えている背景の写し（#bg のいちばん上の絵）。無ければ null */
function sceneCopy() {
  const host = document.getElementById("bg");
  const top = host ? [...host.children].filter((n) => n.classList?.contains("bg-img")).at(-1) : null;
  if (!top?.cloneNode) return null;
  const copy = top.cloneNode(true);
  copy.className = "mo-shn-from";
  copy.style.transition = "none";
  copy.style.opacity = "1";
  return copy;
}

export async function c(mid, opts = {}) {
  const img = new Image();
  img.src = CAR_ART;
  await Promise.race([img.decode().catch(() => {}), sleep(1500)]);
  const streak = await streakTexture(img).catch(() => null);
  const outbound = opts.to !== "home"; // 往路は車内の場面に着く
  const RUN = 3400, slowing = "cubic-bezier(.2,.55,.3,1)";
  try {
    await stagePlay("shinkansen", async (node) => {
      node.dataset.ride = outbound ? "outbound" : "inbound";
      const lane = (cls) => el(`div.mo-shn-win.${cls}`, { style: { clipPath: WINDOW_CLIP } }, [el("i.mo-shn-run", streak ? { style: { backgroundImage: `url("${streak}")` } } : {})]);
      const far = lane("far"), near = lane("near");
      const pole = el("i.mo-shn-pole");
      const poles = el("div.mo-shn-win.poles", { style: { clipPath: WINDOW_CLIP } }, [pole]);
      const flick = el("div.mo-shn-flick");
      const car = el("div.mo-shn-car", { style: { backgroundImage: `url("${CAR_ART}")` } });
      const train = el("div.mo-shn-train", [car, far, near, poles, flick]);
      const title = el("div.mo-ride-title.shn", { dataset: { test: "ride-title" } }, [el("small", { text: "新幹線 のぞみ" }), el("b", { text: DEST_LABEL[opts.to] ? `${DEST_LABEL[opts.to]}へ` : "のぞみ" }), el("i")]);
      const from = sceneCopy();
      node.append(train, title, ...(from ? [from] : []));
      // 1. 走っている車内へ。前の場面は煙のにじみでほどける（車内が覆っている間に裏で次の場面へ替える）
      SE.shinkansen?.(RUN / 1000);
      move(near.firstChild, [{ transform: "translateX(0)" }, { transform: "translateX(72%)" }], RUN, { easing: slowing });
      move(far.firstChild, [{ transform: "translateX(0)" }, { transform: "translateX(26%)" }], RUN, { easing: slowing });
      move(near, [{ opacity: 1 }, { opacity: 1, offset: 0.66 }, { opacity: 0 }], RUN, { easing: "linear" });
      move(far, [{ opacity: 0.75 }, { opacity: 0.75, offset: 0.6 }, { opacity: 0 }], RUN, { easing: "linear" });
      // 架線の柱が窓を横切る影（だんだん間が空いて、遅くなる）
      [[150, 150], [640, 170], [1220, 210], [1940, 300]].forEach(([at, ms]) => pole.animate([{ opacity: 0.34, transform: "translateX(358px) skewX(4deg)" }, { opacity: 0.34, transform: "translateX(1331px) skewX(4deg)" }], { duration: ms, delay: at, easing: "linear" }));
      flick.animate([{ opacity: 0, transform: "translateX(-70%)" }, { opacity: 1, offset: 0.5 }, { opacity: 0, transform: "translateX(60%)" }], { duration: 560, iterations: 4, easing: "linear" });
      car.animate([{ transform: "translateY(0)" }, { transform: "translateY(-1.5px)" }, { transform: "translateY(1.2px)" }, { transform: "translateY(0)" }], { duration: 260, iterations: 9, easing: "linear" });
      const swapped = Promise.resolve().then(() => mid?.());
      swapped.catch(() => {}); // 失敗は下で待つときに投げ直す（待つまでの間に未処理の拒否として出さない）
      if (from) smokeOut(from, 760).then(() => from.remove());
      await sleep(380);
      // 2. 行き先の題字
      move(title.lastChild, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 700, { delay: 140, easing: EASE.out });
      move(title, [{ opacity: 0, transform: "translateX(-20px)" }, { opacity: 1, transform: "none" }], 520, { easing: EASE.out });
      await Promise.all([swapped, sleep(2400)]);
      // 3. 止まる。往路は止まった車内がそのまま次の場面、復路は車内がほどけて地元の場面になる
      const out = move(title, [{ opacity: 1 }, { opacity: 0 }], 420, { easing: "ease" });
      if (outbound) await Promise.all([out, sleep(Math.max(0, RUN - 2780))]);
      else await Promise.all([out, smokeOut(train, 780)]);
    }, { cover: true });
  } finally {
    if (streak) URL.revokeObjectURL(streak);
  }
}
