// 路上占いの結果（remake_fortune_result の {"type":"motion","id":"tarot"}）。charId は占った相手（state.fortune.char）。
// 相手の名前は直後の会話で出すので、絵には顔も名前も出さない（札の絵柄と札の名前だけ）。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, twinkle, kinetic, playKinetic } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// ---------------------------------------------------------------- 札の絵（表は 224x368 の枠の中に描く）

const CW = 224, CH = 368;
const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** 4つの尖りのきらめき（札の飾り・動かさない） */
function spark(x, y, s, fill) {
  return svg("path", { d: `M ${x} ${y - s} L ${x + s * 0.3} ${y - s * 0.3} L ${x + s} ${y} L ${x + s * 0.3} ${y + s * 0.3} L ${x} ${y + s} L ${x - s * 0.3} ${y + s * 0.3} L ${x - s} ${y} L ${x - s * 0.3} ${y - s * 0.3} Z`, fill, class: "tr-scale" });
}
/** n 本の尖りの星形 */
function starPath(x, y, ro, ri, n = 8, turn = -Math.PI / 2) {
  const pts = [...Array(n * 2)].map((_, i) => {
    const r = i % 2 ? ri : ro, a = turn + (i / (n * 2)) * Math.PI * 2;
    return `${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`;
  });
  return `M ${pts.join(" L ")} Z`;
}
const trim = (attrs) => ({ pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1, fill: "none", "stroke-linecap": "round", ...attrs });

/** 札の表の枠・番号・名前。art は絵の窓（x20〜204, y52〜274）に入れる絵 */
function cardFace(P, { num, en, ja }, art) {
  const dia = (x) => svg("path", { d: `M ${x} 29 l 4 5 l -4 5 l -4 -5 Z`, fill: P.mid });
  return svg("svg", { viewBox: `0 0 ${CW} ${CH}`, class: "mo-tarot-art" }, [
    svg("rect", { x: 8, y: 8, width: CW - 16, height: CH - 16, rx: 8, fill: "none", stroke: P.main, "stroke-width": 2 }),
    svg("rect", { x: 13, y: 13, width: CW - 26, height: CH - 26, rx: 6, fill: "none", stroke: P.main, "stroke-width": 0.8, opacity: 0.5 }),
    dia(CW / 2 - 30), dia(CW / 2 + 30),
    svg("text", { x: CW / 2, y: 41, "text-anchor": "middle", "font-size": 19, "font-weight": 900, fill: P.main, "letter-spacing": 1 }, [num]),
    svg("rect", { x: 20, y: 52, width: 184, height: 222, rx: 5, fill: P.deep }),
    svg("circle", { cx: CW / 2, cy: 150, r: 88, fill: P.main, opacity: 0.55 }),
    art,
    svg("rect", { x: 20, y: 52, width: 184, height: 222, rx: 5, fill: "none", stroke: P.main, "stroke-width": 2 }),
    svg("text", { x: CW / 2 + 1, y: 300, "text-anchor": "middle", "font-size": 12.5, "font-weight": 700, fill: P.main, "letter-spacing": 2.4 }, [en]),
    svg("line", { x1: CW / 2 - 46, y1: 311, x2: CW / 2 + 46, y2: 311, stroke: P.mid, "stroke-width": 1.5 }),
    svg("text", { x: CW / 2 + 2, y: 343, "text-anchor": "middle", "font-size": 27, "font-weight": 900, fill: P.deep, "letter-spacing": 4 }, [ja]),
  ]);
}

/** X 運命の輪: 輪と、両端で分かれて真ん中で撚り合わさる2本の糸（縁が撚りどき） */
function wheelArt(P) {
  const cx = CW / 2, cy = 146;
  const wheel = svg("g", { class: "tr-scale" }, [
    svg("circle", { cx, cy, r: 64, fill: "none", stroke: P.light, "stroke-width": 5 }),
    svg("circle", { cx, cy, r: 53, fill: "none", stroke: P.light, "stroke-width": 1.5 }),
    ...[...Array(8)].map((_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return svg("line", { x1: cx + Math.cos(a) * 10, y1: cy + Math.sin(a) * 10, x2: cx + Math.cos(a) * 53, y2: cy + Math.sin(a) * 53, stroke: P.light, "stroke-width": 3, "stroke-linecap": "round" });
    }),
    ...[...Array(8)].map((_, i) => {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      return svg("circle", { cx: cx + Math.cos(a) * 58.5, cy: cy + Math.sin(a) * 58.5, r: 2.2, fill: P.light });
    }),
    svg("circle", { cx, cy, r: 11, fill: P.light }),
    svg("circle", { cx, cy, r: 4, fill: P.deep }),
  ]);
  // 撚り糸: 交差ごとに前後を入れ替える（後ろの糸→前の糸の縁取り→前の糸）
  const x0 = 30, x1 = 194, y = 242, turns = 7;
  const at = (t, s) => {
    const env = 5.5 + 10 * (1 - smooth(t / 0.22)) + 10 * smooth((t - 0.78) / 0.22);
    return [x0 + (x1 - x0) * t, y + s * env * Math.sin(Math.PI / 2 + turns * Math.PI * t)];
  };
  const bounds = [0, ...[...Array(turns)].map((_, m) => (m + 0.5) / turns), 1];
  const cord = [];
  for (let j = 0; j < bounds.length - 1; j++) {
    const [t0, t1] = [bounds[j], bounds[j + 1]];
    const d = (s) => "M " + [...Array(13)].map((_, k) => at(t0 + ((t1 - t0) * k) / 12, s).map((v) => v.toFixed(1)).join(" ")).join(" L ");
    const front = j % 2 ? -1 : 1;
    const seg = { t0, t1, paths: [
      svg("path", trim({ d: d(-front), stroke: front > 0 ? P.thread : P.light, "stroke-width": 5 })),
      svg("path", trim({ d: d(front), stroke: P.deep, "stroke-width": 10 })),
      svg("path", trim({ d: d(front), stroke: front > 0 ? P.light : P.thread, "stroke-width": 5 })),
    ] };
    cord.push(seg);
  }
  const stars = [[44, 74, 6], [182, 80, 4.5], [40, 196, 3.5], [186, 192, 5], [150, 66, 3]].map(([x, yy, s]) => spark(x, yy, s, P.white));
  const g = svg("g", {}, [...stars, wheel, ...cord.flatMap((s) => s.paths)]);
  return { g, wheel, cord, stars };
}

/** XVII 星: 大きな八芒星と小さな星、地平線と水面に映る光 */
function starArt(P) {
  const cx = CW / 2, cy = 124;
  const big = svg("g", { class: "tr-scale" }, [
    svg("path", { d: starPath(cx, cy, 46, 11), fill: P.light }),
    svg("path", { d: starPath(cx, cy, 24, 8, 8, -Math.PI / 2 + Math.PI / 8), fill: P.white }),
  ]);
  const small = [[46, 78, 7], [180, 84, 6], [54, 148, 5], [172, 156, 6], [82, 194, 3.5], [146, 192, 4], [112, 60, 3]].map(([x, y, s]) => spark(x, y, s, P.white));
  const horizon = svg("line", trim({ x1: 30, y1: 214, x2: 194, y2: 214, stroke: P.mid, "stroke-width": 2 }));
  const wave = (x0, y, n) => `M ${x0} ${y} q 12 -5 24 0` + " t 24 0".repeat(n - 1);
  const waves = [[34, 230, 7], [46, 244, 6], [58, 258, 5]].map(([x0, y, n]) => svg("path", trim({ d: wave(x0, y, n), stroke: P.mid, "stroke-width": 2.5, opacity: 0.75 })));
  const glints = [[222, 30], [232, 20], [243, 26], [254, 14], [264, 8]].map(([y, w]) => svg("line", trim({ x1: cx - w / 2, y1: y, x2: cx + w / 2, y2: y, stroke: P.light, "stroke-width": 3 })));
  const g = svg("g", {}, [...small, big, horizon, ...waves, ...glints]);
  return { g, big, small, lines: [horizon, ...waves, ...glints] };
}

/** b の札の裏: 菱形と、光の輪を持つ星の紋 */
function backArt(P) {
  const cx = CW / 2, cy = CH / 2;
  return svg("svg", { viewBox: `0 0 ${CW} ${CH}`, class: "mo-tarot-art" }, [
    svg("rect", { x: 9, y: 9, width: CW - 18, height: CH - 18, rx: 7, fill: "none", stroke: P.light, "stroke-width": 2, opacity: 0.85 }),
    svg("rect", { x: 15, y: 15, width: CW - 30, height: CH - 30, rx: 5, fill: "none", stroke: P.light, "stroke-width": 1, opacity: 0.4 }),
    svg("path", { d: `M ${cx} 40 L ${CW - 30} ${cy} L ${cx} ${CH - 40} L 30 ${cy} Z`, fill: "none", stroke: P.light, "stroke-width": 1.5, opacity: 0.5 }),
    svg("circle", { cx, cy, r: 36, fill: "none", stroke: P.light, "stroke-width": 3 }),
    ...[...Array(12)].map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return svg("line", { x1: cx + Math.cos(a) * 45, y1: cy + Math.sin(a) * 45, x2: cx + Math.cos(a) * 56, y2: cy + Math.sin(a) * 56, stroke: P.light, "stroke-width": 3, "stroke-linecap": "round" });
    }),
    svg("path", { d: starPath(cx, cy, 22, 7), fill: P.light }),
    ...[[cx, 58], [cx, CH - 58], [44, cy], [CW - 44, cy]].map(([x, y]) => svg("circle", { cx: x, cy: y, r: 3, fill: P.light })),
  ]);
}

/** 撚り糸を左から右へ、1本の線のようにつないで描く */
function drawCord(cord, ms, delay = 0) {
  cord.forEach(({ t0, t1, paths }) => paths.forEach((p) => move(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], Math.max(1, (t1 - t0) * ms), { easing: "linear", delay: delay + t0 * ms })));
}

// ---------------------------------------------------------------- a: 占い: 星図の輪が描かれ、3枚の札が飛んできて、真ん中が裏返る（X 運命の輪）

const TAROT = { bg: "#101a3a", deep: "#080e22", main: "#24356e", mid: "#4a5fb4", light: "#f2c14e", white: "#fff6dc", thread: "#9cc4ff" };
const MONO_THREAD = "#9a82d8"; // 紫1色の2本目の糸（輪より濃い紫）

function tarotCard(P, i) {
  return el("div.mo-tarot-card", { style: { "--i": String(i) } }, [el("div.mo-tarot-flip", [
    el("div.mo-tarot-back", { style: { background: P.main, borderColor: P.light, "--l": P.light } }, [el("i.mo-tarot-moon"), el("b.mo-tarot-star"), el("b.mo-tarot-star.s2"), el("b.mo-tarot-star.s3")]),
  ])]);
}

/** 占った相手（charId）は直後の会話で名前を出すので、ここでは使わない */
export async function a() {
  const P = pick(TAROT, { thread: MONO_THREAD });
  await stagePlay("tarot", async (node) => {
    const back = backdrop(P.bg);
    const art = stageSvg();
    const cx = W / 2, cy = 330;
    const dial = [
      svg("circle", { cx, cy, r: 250, fill: "none", stroke: P.mid, "stroke-width": 2, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }),
      svg("circle", { cx, cy, r: 300, fill: "none", stroke: P.light, "stroke-width": 2, "stroke-dasharray": "3 12", opacity: 0.7, class: "tr-scale" }),
      svg("circle", { cx, cy, r: 205, fill: "none", stroke: P.mid, "stroke-width": 1.5, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }),
    ];
    const ticks = svg("g", {}, [...Array(12)].map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return svg("line", { x1: cx + Math.cos(a) * 258, y1: cy + Math.sin(a) * 258, x2: cx + Math.cos(a) * 280, y2: cy + Math.sin(a) * 280, stroke: P.light, "stroke-width": 3, "stroke-linecap": "round", opacity: 0 });
    }));
    const rule = [-1, 1].map((s) => svg("line", { x1: cx + s * 18, y1: 664, x2: cx + s * 190, y2: 664, stroke: P.light, "stroke-width": 2, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }));
    art.append(...dial, ticks, ...rule);
    const cards = [0, 1, 2].map((i) => tarotCard(P, i));
    const wheel = wheelArt(P);
    const gloss = el("i.mo-gloss");
    cards[1].firstChild.append(el("div.mo-tarot-front", { style: { background: P.white, borderColor: P.light } }, [
      cardFace(P, { num: "X", en: "WHEEL OF FORTUNE", ja: "運命の輪" }, wheel.g),
      gloss,
    ]));
    const title = kinetic("運命の輪　正位置", "mo-tarot-title");
    title.style.color = P.white;
    node.append(back, art, ...cards, title);
    // 1. 星図の輪が描かれる
    move(back, [{ opacity: 0 }, { opacity: 1 }], 240);
    move(dial[0], [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 700, { easing: E.out });
    move(dial[2], [{ strokeDashoffset: -1 }, { strokeDashoffset: 0 }], 700, { easing: E.out, delay: 80 });
    dial[1].animate([{ transform: "rotate(0deg) scale(0.8)", opacity: 0 }, { transform: "rotate(40deg) scale(1)", opacity: 0.7 }], { duration: 2600, easing: E.out, fill: "both" });
    [...ticks.children].forEach((t, i) => move(t, [{ opacity: 0 }, { opacity: 1 }], 160, { delay: 200 + i * 30 }));
    for (let i = 0; i < 7; i++) twinkle(art, 160 + Math.random() * 960, 60 + Math.random() * 560, { color: P.light, size: 8 + Math.random() * 10, delay: 200 + i * 180, dur: 900 });
    // 2. 3枚が回りながら飛んできて扇に並ぶ
    const xs = [-230, 0, 230], rot = [-10, 0, 10];
    await Promise.all(cards.map((c, i) => move(c, [
      { transform: `translate(-50%, 520px) rotate(${rot[i] * 5}deg) scale(0.8, 1.2)` },
      { transform: `translate(calc(-50% + ${xs[i]}px), 0) rotate(${rot[i]}deg) scale(1)` }], 520, { easing: E.back, delay: 120 + i * 90 })));
    SE.tick();
    await sleep(380);
    // 3. 両端が抜けて、真ん中が持ち上がる
    move(cards[0], [{ transform: "translate(calc(-50% - 230px), 0) rotate(-10deg)", opacity: 1 }, { transform: "translate(calc(-50% - 620px), 40px) rotate(-30deg)", opacity: 0 }], 360, { easing: E.in });
    move(cards[2], [{ transform: "translate(calc(-50% + 230px), 0) rotate(10deg)", opacity: 1 }, { transform: "translate(calc(-50% + 620px), 40px) rotate(30deg)", opacity: 0 }], 360, { easing: E.in });
    await move(cards[1], [{ transform: "translate(-50%, 0) scale(1)" }, { transform: "translate(-50%, -16px) scale(1.16)" }], 300, { easing: E.out });
    // 4. くるっと裏返り、光が走る。表が見えたところで輪が回り、2本の糸が撚り合わさりながら描かれる
    const flip = move(cards[1].firstChild, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], 520, { easing: E.inOut });
    move(wheel.wheel, [{ transform: "rotate(-140deg)" }, { transform: "rotate(0deg)" }], 1100, { easing: E.out, delay: 240 });
    drawCord(wheel.cord, 620, 300);
    wheel.stars.forEach((s, i) => move(s, [{ transform: "scale(0) rotate(-90deg)" }, { transform: "scale(1) rotate(0deg)" }], 420, { easing: E.back, delay: 420 + i * 70 }));
    await flip;
    SE.just();
    ring(art, cx, cy, { r: 260, color: P.light, width: 8 });
    burst(art, cx, cy, { n: 14, r0: 230, r1: 330, color: P.light, width: 5 });
    move(gloss, [{ transform: "translateX(-140%) skewX(-20deg)" }, { transform: "translateX(240%) skewX(-20deg)" }], 520, { easing: E.inOut });
    rule.forEach((r) => move(r, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 520, { easing: E.out, delay: 160 }));
    await playKinetic(title, { delay: 120, step: 40 });
    await sleep(820);
    // 5. 退場
    move(title, [{ opacity: 1 }, { opacity: 0 }], 240);
    move(art, [{ opacity: 1 }, { opacity: 0 }], 360);
    move(back, [{ opacity: 1 }, { opacity: 0 }], 420, { delay: 160 });
    await move(cards[1], [{ transform: "translate(-50%, -16px) scale(1.16) rotate(0deg)", opacity: 1 }, { transform: "translate(-50%, -40px) scale(0.6) rotate(12deg)", opacity: 0 }], 420, { easing: E.in });
  });
}

// ---------------------------------------------------------------- b: 占い: 布の魔法陣に山札が置かれ、切って3枚を配り、真ん中の1枚が起き上がって裏返る（XVII 星）

const TAROT_B = { bg: "#3a1420", deep: "#200a12", main: "#6e2236", mid: "#b5475f", light: "#efc77e", white: "#fbf4e2" };

const TILT = 58; // 布の傾き（度）
const DECK_Y = -236; // 山札の位置（布の奥）
const LIE = 0.62; // 布に置いた札の縮尺
/** 布の上の札の姿勢。関数の並びを揃えて、角度をそのまま補間させる */
const pose = (x, y, z, rz = 0, rx = 0, ry = 0, s = LIE) => ({ transform: `translate3d(${x}px, ${y}px, ${z}px) rotateZ(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg) scale(${s})` });

function tableCard(P, front = null) {
  const face = (cls, kids, style) => el(`div.mo-tb-face.${cls}`, { style }, kids);
  return el("div.mo-tb-card", [
    face("back", [backArt(P)], { background: P.main, borderColor: P.light }),
    front ? face("front", front, { background: P.white, borderColor: P.light }) : null,
  ]);
}

/** 布の魔法陣（布の面の座標で、中心が原点） */
function clothArt(P) {
  const R = 420;
  const sq = (turn) => {
    const pts = [0, 1, 2, 3].map((k) => { const a = turn + (k / 4) * Math.PI * 2; return `${(Math.cos(a) * 330).toFixed(1)} ${(Math.sin(a) * 330).toFixed(1)}`; });
    return `M ${pts.join(" L ")} Z`;
  };
  const lines = [
    svg("circle", trim({ cx: 0, cy: 0, r: 372, stroke: P.light, "stroke-width": 3, opacity: 0.85 })),
    svg("circle", trim({ cx: 0, cy: 0, r: 352, stroke: P.light, "stroke-width": 1.5, opacity: 0.6 })),
    svg("path", trim({ d: sq(0), stroke: P.mid, "stroke-width": 2.5, "stroke-linejoin": "round" })),
    svg("path", trim({ d: sq(Math.PI / 4), stroke: P.mid, "stroke-width": 2.5, "stroke-linejoin": "round" })),
    svg("circle", trim({ cx: 0, cy: 0, r: 150, stroke: P.mid, "stroke-width": 2 })),
  ];
  const dots = svg("g", {}, [...Array(16)].map((_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return svg("circle", { cx: Math.cos(a) * 362, cy: Math.sin(a) * 362, r: i % 2 ? 2.5 : 5, fill: P.light });
  }));
  dots.style.opacity = "0";
  const cloth = svg("svg", { viewBox: `${-R} ${-R} ${R * 2} ${R * 2}`, class: "mo-tb-cloth" }, [
    svg("circle", { cx: 0, cy: 0, r: R, fill: P.deep }),
    ...lines, dots,
  ]);
  return { cloth, lines, dots };
}

export async function b() {
  const P = pick(TAROT_B);
  await stagePlay("tarot", async (node) => {
    const back = backdrop(P.bg);
    const halo = el("i.mo-tb-halo", { style: { background: P.main } });
    const table = el("div.mo-tb-table");
    const scene = el("div.mo-tb-scene", [table]);
    const { cloth, lines, dots } = clothArt(P);
    const trails = svg("svg", { viewBox: "-420 -420 840 840", class: "mo-tb-cloth" });
    const star = starArt(P);
    const gloss = el("i.mo-gloss");
    const deck = [...Array(8)].map((_, i) => tableCard(P, i === 3 ? [cardFace(P, { num: "XVII", en: "THE STAR", ja: "星" }, star.g), gloss] : null));
    table.append(cloth, trails, ...deck);
    const fx = stageSvg();
    const rule = [-1, 1].map((s) => svg("line", { x1: W / 2 + s * 18, y1: 664, x2: W / 2 + s * 160, y2: 664, stroke: P.light, "stroke-width": 2, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }));
    fx.append(...rule);
    const title = kinetic("星　正位置", "mo-tarot-title");
    title.style.color = P.white;
    node.append(back, halo, scene, fx, title);
    const faces = (c) => [...c.children];
    // 1. 布が広がり、魔法陣が線で描かれる
    move(back, [{ opacity: 0 }, { opacity: 1 }], 160);
    move(halo, [{ transform: "translate(-50%, -50%) scale(0.2)", opacity: 0 }, { transform: "translate(-50%, -50%) scale(0.96)", opacity: 0.5 }], 900, { easing: E.out });
    move(table, [{ transform: `translateY(150px) rotateX(${TILT + 14}deg) scale(0.7)` }, { transform: `translateY(90px) rotateX(${TILT}deg) scale(1)` }], 900, { easing: E.out, delay: 100 });
    move(cloth, [{ transform: "rotate(-30deg)", opacity: 0 }, { opacity: 1, offset: 0.16 }, { transform: "rotate(0deg)", opacity: 1 }], 1600, { easing: E.out, delay: 100 });
    lines.forEach((l, i) => move(l, [{ strokeDashoffset: i % 2 ? -1 : 1 }, { strokeDashoffset: 0 }], 760, { easing: E.out, delay: 160 + i * 70 }));
    move(dots, [{ opacity: 0 }, { opacity: 1 }], 300, { delay: 600 });
    // 2. 上から山札が落ちてきて、布の奥に重なる
    const zOf = (k) => k * 1.6;
    await Promise.all(deck.map((c, i) => move(c, [pose(0, DECK_Y - 80, 620 + i * 30, -40 + i * 3), pose(0, DECK_Y, zOf(i), (i % 3) - 1)], 460, { easing: E.out, delay: 140 + i * 22 })));
    SE.tick();
    // 3. 左右に割って、交互に落として切り混ぜる（リフル）
    const half = (i) => (i < 4 ? -1 : 1);
    await Promise.all(deck.map((c, i) => move(c, [pose(0, DECK_Y, zOf(i), (i % 3) - 1), pose(half(i) * 150, DECK_Y + 16, zOf(i % 4), half(i) * 14)], 220, { easing: E.out })));
    SE.crackle();
    const order = [0, 4, 1, 5, 2, 6, 3, 7]; // 切ったあと下から何番目か
    await Promise.all(order.map((ci, k) => move(deck[ci], [
      pose(half(ci) * 150, DECK_Y + 16, zOf(ci % 4), half(ci) * 14),
      { ...pose(half(ci) * 40, DECK_Y - 10, 46 + k * 2, half(ci) * 6), offset: 0.55 },
      pose(0, DECK_Y, zOf(k), 0)], 250, { easing: E.inOut, delay: k * 24 })));
    // 4. 上から3枚を、左・真ん中・右へ滑らせて配る（布に軌跡の線が走る）
    const xs = [-236, 0, 236], rzs = [-5, 0, 5];
    const dealt = [order[7], order[6], order[5]];
    dealt.forEach((ci, n) => {
      const path = svg("line", { x1: 0, y1: DECK_Y, x2: xs[n], y2: 40, stroke: P.light, "stroke-width": 5, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1, opacity: 0.8 });
      trails.append(path);
      move(path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.5 }, { strokeDashoffset: -1 }], 480, { easing: E.out, delay: n * 120 });
      setTimeout(() => SE.tick(), n * 120 + 180);
      move(deck[ci], [pose(0, DECK_Y, zOf(7 - n), 0), { ...pose(xs[n] * 0.7, 0, 18, rzs[n] * 6 + (n - 1) * 20), offset: 0.55 }, pose(xs[n], 40, 0, rzs[n])], 420, { easing: E.out, delay: n * 120 });
    });
    await sleep(2 * 120 + 300);
    // 残りの山札は奥へ下げる
    deck.forEach((c, i) => {
      if (dealt.includes(i)) return;
      const k = order.indexOf(i);
      move(c, [pose(0, DECK_Y, zOf(k), 0), pose(0, DECK_Y - 260, zOf(k), 0)], 380, { easing: E.in });
      faces(c).forEach((f) => move(f, [{ opacity: 1 }, { opacity: 0 }], 300, { delay: 80 }));
    });
    // 5. 長い沈黙: 3枚が左から順に小さく浮いて沈む
    for (let n = 0; n < 3; n++) {
      move(deck[dealt[n]], [pose(xs[n], 40, 0, rzs[n]), { ...pose(xs[n], 40, 22, rzs[n]), offset: 0.4 }, pose(xs[n], 40, 0, rzs[n])], 260, { easing: E.inOut, delay: n * 90 });
      setTimeout(() => SE.tick(), n * 90);
    }
    await sleep(2 * 90 + 200);
    // 6. 真ん中の札が起き上がり、こちらを向きながら裏返る。ほかは布ごと引いていく
    SE.whoosh();
    const pick1 = deck[dealt[1]];
    [0, 2].forEach((n) => {
      move(deck[dealt[n]], [pose(xs[n], 40, 0, rzs[n]), pose(xs[n] * 1.9, 80, 0, rzs[n] * 4)], 440, { easing: E.in });
      faces(deck[dealt[n]]).forEach((f) => move(f, [{ opacity: 1 }, { opacity: 0 }], 300, { delay: 120 }));
    });
    move(cloth, [{ opacity: 1, transform: "rotate(0deg)" }, { opacity: 0, transform: "rotate(24deg)" }], 620, { easing: E.in, delay: 80 });
    move(halo, [{ transform: "translate(-50%, -50%) scale(0.96)", opacity: 0.5 }, { transform: "translate(-50%, -50%) scale(1)", opacity: 0.9 }], 900, { easing: E.out });
    move(pick1, [pose(0, 40, 0, 0), { ...pose(0, 34, 70, 0, -22, 30, 0.72), offset: 0.35 }, pose(0, -6, 124, 0, -TILT, 180, 1.04)], 760, { easing: E.inOut });
    // 表の絵: 大きな星が弾んで開き、小さな星と水面の線が後を追う
    move(star.big, [{ transform: "scale(0.2) rotate(-90deg)" }, { transform: "scale(1) rotate(0deg)" }], 620, { easing: E.back, delay: 460 });
    star.small.forEach((s, i) => move(s, [{ transform: "scale(0) rotate(-90deg)" }, { transform: "scale(1) rotate(0deg)" }], 380, { easing: E.back, delay: 560 + i * 55 }));
    star.lines.forEach((l, i) => move(l, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 420, { easing: E.out, delay: 520 + i * 50 }));
    await sleep(760);
    SE.just();
    const cy = 330;
    ring(fx, W / 2, cy, { r: 300, color: P.light, width: 8 });
    ring(fx, W / 2, cy, { r: 220, color: P.white, width: 4, delay: 90 });
    burst(fx, W / 2, cy, { n: 16, r0: 250, r1: 340, color: P.light, width: 5 });
    [[430, 170], [860, 200], [400, 470], [880, 480]].forEach(([x, y], i) => twinkle(fx, x, y, { color: P.light, size: 12 + (i % 2) * 6, delay: 80 + i * 70, dur: 760 }));
    move(gloss, [{ transform: "translateX(-140%) skewX(-20deg)" }, { transform: "translateX(240%) skewX(-20deg)" }], 560, { easing: E.inOut });
    rule.forEach((r) => move(r, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 520, { easing: E.out, delay: 160 }));
    playKinetic(title, { delay: 80, step: 44 });
    await sleep(840);
    // 7. 札の中心へ、丸く窓が閉じて会話へ戻る
    move(title, [{ opacity: 1 }, { opacity: 0 }], 200);
    await move(node, [{ clipPath: `circle(820px at ${W / 2}px ${cy}px)` }, { clipPath: `circle(0px at ${W / 2}px ${cy}px)` }], 480, { easing: E.in });
  });
}
