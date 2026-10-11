// 路上占いの結果（remake_fortune_result の {"type":"motion","id":"tarot"}）。charId は占った相手（state.fortune.char）。
// 相手の名前は直後の会話で出すので、絵には顔も名前も出さない。札も何の札かは見せず、表は光だけ（CI122）。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, twinkle } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// ---------------------------------------------------------------- 札の絵（表は 224x368 の枠の中に描く）

const CW = 224, CH = 368;

/** n 本の尖りの星形 */
function starPath(x, y, ro, ri, n = 8, turn = -Math.PI / 2) {
  const pts = [...Array(n * 2)].map((_, i) => {
    const r = i % 2 ? ri : ro, a = turn + (i / (n * 2)) * Math.PI * 2;
    return `${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}`;
  });
  return `M ${pts.join(" L ")} Z`;
}
const trim = (attrs) => ({ pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1, fill: "none", "stroke-linecap": "round", ...attrs });


// ---------------------------------------------------------------- a: 占い: 星図の輪が描かれ、3枚の札が飛んできて、真ん中が裏返る。
// 何の札かは見せず、表は光だけ。裏返った瞬間に画面ごと「ピカーン」と光る（札の名前や絵柄で占いの中身を決めつけない）

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


// a の動きの曲線。長めの動きは指数カーブだと最初に済んで尻すぼみになるので、やわらかい曲線にする
const SOFT = "cubic-bezier(.22,1,.36,1)"; // 描く・出る（quint-out）
const LAND = "cubic-bezier(.28,1.4,.5,1)"; // 札の着地。行き過ぎは5%ほど
const LEAVE = "cubic-bezier(.5,0,.75,0)"; // 抜ける・退場（quart-in）
const TURN = "cubic-bezier(.65,0,.35,1)"; // 札の裏返し・光の走り（左右対称のなだらか）

const TAROT = { bg: "#101a3a", deep: "#080e22", main: "#24356e", mid: "#4a5fb4", light: "#f2c14e", white: "#fff6dc" };

function tarotCard(P, i) {
  return el("div.mo-tarot-card", { style: { "--i": String(i) } }, [el("div.mo-tarot-flip", [
    el("div.mo-tarot-back", { style: { background: P.main, borderColor: P.light, "--l": P.light } }, [el("i.mo-tarot-moon"), el("b.mo-tarot-star"), el("b.mo-tarot-star.s2"), el("b.mo-tarot-star.s3")]),
  ])]);
}

/** 占った相手（charId）は直後の会話で名前を出すので、ここでは使わない */
export async function a() {
  const P = pick(TAROT);
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
    art.append(...dial, ticks);
    const cards = [0, 1, 2].map((i) => tarotCard(P, i));
    const gloss = el("i.mo-gloss");
    // 表は光だけ（中心が白く、縁へ金色）。札の種類は分からない
    const front = el("div.mo-tarot-front.glow", { style: { background: `radial-gradient(circle at 50% 46%, #ffffff 0 22%, ${P.white} 40%, ${P.light} 100%)`, borderColor: P.light } }, [gloss]);
    cards[1].firstChild.append(front);
    const flash = el("div.mo-tarot-flash", { style: { background: `radial-gradient(circle at 50% 46%, #ffffff 0 18%, ${P.white} 38%, transparent 72%)` } });
    const flare = [0, 90].map((deg) => el("i.mo-tarot-flare", { style: { background: `linear-gradient(90deg, transparent, #ffffff, transparent)`, "--r": `${deg}deg` } }));
    node.append(back, art, ...cards, ...flare, flash);
    // 1. 星図の輪が描かれる
    move(back, [{ opacity: 0 }, { opacity: 1 }], 240);
    move(dial[0], [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 700, { easing: SOFT });
    move(dial[2], [{ strokeDashoffset: -1 }, { strokeDashoffset: 0 }], 700, { easing: SOFT, delay: 80 });
    // 点線の輪: 現れるのは最初だけ、回転はずっと一定の速さ（以前は最初の0.5秒で回りきって止まっていた）
    move(dial[1], [{ transform: "scale(0.8)", opacity: 0 }, { transform: "scale(1)", opacity: 0.7 }], 800, { easing: SOFT });
    dial[1].animate([{ transform: "rotate(0deg)" }, { transform: "rotate(40deg)" }], { duration: 3600, easing: "linear", fill: "both", composite: "add" });
    [...ticks.children].forEach((t, i) => move(t, [{ opacity: 0 }, { opacity: 1 }], 160, { delay: 200 + i * 30 }));
    for (let i = 0; i < 7; i++) twinkle(art, 160 + Math.random() * 960, 60 + Math.random() * 560, { color: P.light, size: 8 + Math.random() * 10, delay: 200 + i * 180, dur: 900 });
    // 2. 3枚が回りながら飛んできて扇に並ぶ
    const xs = [-230, 0, 230], rot = [-10, 0, 10];
    await Promise.all(cards.map((c, i) => move(c, [
      { transform: `translate(-50%, 520px) rotate(${rot[i] * 5}deg) scale(0.8, 1.2)` },
      { transform: `translate(calc(-50% + ${xs[i]}px), 0) rotate(${rot[i]}deg) scale(1)` }], 520, { easing: LAND, delay: 120 + i * 90 })));
    SE.tick();
    await sleep(380);
    // 3. 両端が抜けて、真ん中が持ち上がる
    move(cards[0], [{ transform: "translate(calc(-50% - 230px), 0) rotate(-10deg)", opacity: 1 }, { transform: "translate(calc(-50% - 620px), 40px) rotate(-30deg)", opacity: 0 }], 360, { easing: LEAVE });
    move(cards[2], [{ transform: "translate(calc(-50% + 230px), 0) rotate(10deg)", opacity: 1 }, { transform: "translate(calc(-50% + 620px), 40px) rotate(30deg)", opacity: 0 }], 360, { easing: LEAVE });
    await move(cards[1], [{ transform: "translate(-50%, 0) scale(1)" }, { transform: "translate(-50%, -16px) scale(1.16)" }], 300, { easing: E.out });
    // 4. くるっと裏返った瞬間、ピカーン。画面が白く光り、十字の光と長い放射線が伸びて、札が脈打つ
    // 表が向いた（90°を少し越えた）瞬間に光る。裏返しが止まるのを待つと、表が見えてから光るまで間が空く
    const turn = move(cards[1].firstChild, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], 520, { easing: TURN });
    await sleep(280);
    SE.just();
    // 光は一瞬で立ち上がり、そこから尾を引いて消える（キーフレームごとに曲線を指定）
    move(flash, [{ opacity: 0, transform: "scale(0.4)", easing: E.out }, { opacity: 1, transform: "scale(1.15)", offset: 0.1, easing: SOFT }, { opacity: 0, transform: "scale(1.6)" }], 900, { easing: "linear" });
    flare.forEach((f, i) => move(f, [{ transform: `translate(-50%, -50%) rotate(var(--r)) scaleX(0)`, opacity: 1, easing: E.out }, { transform: `translate(-50%, -50%) rotate(var(--r)) scaleX(1)`, opacity: 1, offset: 0.1, easing: SOFT }, { transform: `translate(-50%, -50%) rotate(var(--r)) scaleX(1.3)`, opacity: 0 }], 900, { easing: "linear", delay: i * 40 }));
    ring(art, cx, cy, { r: 260, color: P.white, width: 10 });
    ring(art, cx, cy, { r: 380, color: P.light, width: 6, delay: 120 });
    burst(art, cx, cy, { n: 18, r0: 220, r1: 420, color: P.light, width: 5, dur: 620 });
    burst(art, cx, cy, { n: 18, r0: 260, r1: 360, color: P.white, width: 3, dur: 520, delay: 90, turn: Math.PI / 18 });
    move(front, [{ boxShadow: `0 0 0 0 ${P.light}`, easing: E.out }, { boxShadow: `0 0 80px 30px ${P.light}`, offset: 0.12, easing: SOFT }, { boxShadow: `0 0 36px 8px ${P.light}` }], 900, { easing: "linear" });
    move(gloss, [{ transform: "translateX(-140%) skewX(-20deg)" }, { transform: "translateX(240%) skewX(-20deg)" }], 520, { easing: TURN, delay: 200 });
    for (let i = 0; i < 6; i++) twinkle(art, cx + Math.cos(i) * (160 + i * 18), cy + Math.sin(i * 1.7) * 150, { color: P.white, size: 14 + (i % 3) * 6, delay: 160 + i * 70 });
    await turn;
    await sleep(960); // 光ってからの余韻は従来どおり約1.2秒
    // 5. 退場
    move(art, [{ opacity: 1 }, { opacity: 0 }], 360);
    move(back, [{ opacity: 1 }, { opacity: 0 }], 380, { delay: 40 }); // 札が消えるのと同時に背景も消え切る（後から残って急に消えない）
    await move(cards[1], [{ transform: "translate(-50%, -16px) scale(1.16) rotate(0deg)", opacity: 1 }, { transform: "translate(-50%, -40px) scale(0.6) rotate(12deg)", opacity: 0 }], 420, { easing: LEAVE });
  });
}

// ---------------------------------------------------------------- b: 占い: 布の魔法陣に山札が置かれ、切って3枚を配り、真ん中の1枚が起き上がって裏返る。
// a と同じく何の札かは見せず、表は光だけ。裏返った瞬間に「ピカーン」

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
    const gloss = el("i.mo-gloss");
    const deck = [...Array(8)].map((_, i) => tableCard(P, i === 3 ? [gloss] : null));
    const glowFace = deck[3].querySelector(".mo-tb-face.front");
    glowFace.classList.add("glow");
    glowFace.style.background = `radial-gradient(circle at 50% 46%, #ffffff 0 22%, ${P.white} 40%, ${P.light} 100%)`;
    table.append(cloth, trails, ...deck);
    const fx = stageSvg();
    const flash = el("div.mo-tarot-flash", { style: { background: `radial-gradient(circle at 50% 46%, #ffffff 0 18%, ${P.white} 38%, transparent 72%)` } });
    const flare = [0, 90].map((deg) => el("i.mo-tarot-flare", { style: { background: "linear-gradient(90deg, transparent, #ffffff, transparent)", "--r": `${deg}deg` } }));
    node.append(back, halo, scene, fx, ...flare, flash);
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
    await sleep(760);
    // 表が向いた瞬間、ピカーン。画面が白く光り、十字の光と長い放射線
    SE.just();
    const cy = 330;
    move(flash, [{ opacity: 0, transform: "scale(0.4)" }, { opacity: 1, transform: "scale(1.15)", offset: 0.18 }, { opacity: 0, transform: "scale(1.6)" }], 900, { easing: E.out });
    flare.forEach((f, i) => move(f, [{ transform: "translate(-50%, -50%) rotate(var(--r)) scaleX(0)", opacity: 1 }, { transform: "translate(-50%, -50%) rotate(var(--r)) scaleX(1)", opacity: 1, offset: 0.35 }, { transform: "translate(-50%, -50%) rotate(var(--r)) scaleX(1.3)", opacity: 0 }], 900, { easing: E.out, delay: i * 40 }));
    ring(fx, W / 2, cy, { r: 300, color: P.white, width: 10 });
    ring(fx, W / 2, cy, { r: 400, color: P.light, width: 6, delay: 120 });
    burst(fx, W / 2, cy, { n: 18, r0: 230, r1: 430, color: P.light, width: 5, dur: 620 });
    burst(fx, W / 2, cy, { n: 18, r0: 270, r1: 370, color: P.white, width: 3, dur: 520, delay: 90, turn: Math.PI / 18 });
    move(glowFace, [{ boxShadow: `0 0 0 0 ${P.light}` }, { boxShadow: `0 0 80px 30px ${P.light}`, offset: 0.3 }, { boxShadow: `0 0 36px 8px ${P.light}` }], 900, { easing: E.out });
    [[430, 170], [860, 200], [400, 470], [880, 480]].forEach(([x, y], i) => twinkle(fx, x, y, { color: P.white, size: 12 + (i % 2) * 6, delay: 120 + i * 70, dur: 760 }));
    move(gloss, [{ transform: "translateX(-140%) skewX(-20deg)" }, { transform: "translateX(240%) skewX(-20deg)" }], 560, { easing: E.inOut, delay: 200 });
    await sleep(1100);
    // 7. 札の中心へ、丸く窓が閉じて会話へ戻る
    await move(node, [{ clipPath: `circle(820px at ${W / 2}px ${cy}px)` }, { clipPath: `circle(0px at ${W / 2}px ${cy}px)` }], 480, { easing: E.in });
  });
}
