// バイトのシフト終了（tonari.js・remake_baito_end の前）。OPEN の札が裏返って CLOSED。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, kinetic, playKinetic } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";

// ---------------------------------------------------------------- a: バイトの終わり: 吊り札が下りて揺れ、くるっと回って CLOSED

const SHIFT = { bg: "#18243f", deep: "#0d1528", main: "#e0702a", mid: "#e5484d", light: "#fff3d6", white: "#ffffff" };
const MONO_CLOSED = "#4f3596"; // 紫1色の CLOSED の面（OPEN より濃い紫）

export async function a() {
  const P = pick(SHIFT, { mid: MONO_CLOSED });
  await stagePlay("shift", async (node) => {
    const back = backdrop(`${P.bg}d9`);
    const fxArt = stageSvg();
    const face = (cls, label, bg, fg, border) => el(`div.mo-sign-face.${cls}`, { style: { background: bg, color: fg, borderColor: border } }, [el("small", { text: "tonari" }), el("b", { text: label })]);
    const flip = el("div.mo-sign-flip", [face("open", "OPEN", P.light, P.main, P.main), face("closed", "CLOSED", P.mid, P.light, P.light)]);
    const pop = el("div.mo-sign-pop", [flip]);
    const sign = el("div.mo-sign", { style: { "--s": P.light } }, [el("i.mo-sign-string"), pop]);
    node.append(back, sign, fxArt);
    move(back, [{ opacity: 0 }, { opacity: 1 }], 240);
    // 1. 吊り札が下りて、揺れながら止まる
    await move(sign, [{ transform: "translate(-50%, -560px) rotate(0deg)" }, { transform: "translate(-50%, 0) rotate(0deg)" }], 520, { easing: E.back });
    await move(sign, [{ transform: "translate(-50%, 0) rotate(0deg)" }, { transform: "translate(-50%, 0) rotate(7deg)" }, { transform: "translate(-50%, 0) rotate(-4deg)" }, { transform: "translate(-50%, 0) rotate(2deg)" }, { transform: "translate(-50%, 0) rotate(0deg)" }], 760, { easing: "ease-out" });
    // 2. くるっと1回半まわって裏の CLOSED へ
    SE.whoosh();
    await move(flip, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(540deg)" }], 900, { easing: E.inOut });
    SE.select();
    ring(fxArt, W / 2, 350, { r: 260, color: P.light, width: 8 });
    burst(fxArt, W / 2, 350, { n: 12, r0: 230, r1: 320, color: P.light, width: 6 });
    await move(pop, [{ transform: "scale(1.12)" }, { transform: "scale(1)" }], 360, { easing: E.back });
    await sleep(650);
    // 3. 退場
    move(back, [{ opacity: 1 }, { opacity: 0 }], 380, { delay: 120 });
    await move(sign, [{ transform: "translate(-50%, 0)" }, { transform: "translate(-50%, -580px)" }], 420, { easing: E.in });
  });
}

// ---------------------------------------------------------------- b: バイトの終わり: 丸い札がコインのように弾かれて回り、CLOSED で着地して転がっていく

let coinSerial = 0;

/** 丸い札の片面（直径300）。label は OPEN／CLOSED、size はその文字の大きさ */
function coinFace(cls, label, bg, fg, size) {
  return el(`div.mo-coin-face.${cls}`, { style: { background: bg, "--rim": fg } }, [svg("svg", { viewBox: "-150 -150 300 300", class: "mo-coin-art" }, [
    svg("circle", { r: 127, fill: "none", stroke: fg, "stroke-width": 3, "stroke-dasharray": "0.1 10", "stroke-linecap": "round" }),
    svg("circle", { r: 116, fill: "none", stroke: fg, "stroke-width": 1.5, opacity: 0.45 }),
    svg("text", { y: -44, "text-anchor": "middle", "font-size": 21, "font-weight": 700, "letter-spacing": 6, dx: 3, fill: fg }, ["tonari"]),
    svg("text", { y: size * 0.36, "text-anchor": "middle", "font-size": size, "font-weight": 900, "letter-spacing": 1, fill: fg }, [label]),
    svg("path", { d: "M -27 60 q 6.75 -8 13.5 0 t 13.5 0 t 13.5 0 t 13.5 0", fill: "none", stroke: fg, "stroke-width": 4, "stroke-linecap": "round" }),
  ])]);
}
// b の動きの曲線。複数キーフレームの動きは、全体に強い曲線を掛けず、キーフレームごとに指定する
const SOFT = "cubic-bezier(.22,1,.36,1)"; // 描く・出る（quint-out。長めの動きでも尻すぼみにならない）
const SETTLE = "cubic-bezier(.37,0,.63,1)"; // 行き過ぎからの落ち着き（なだらかな往復）
const ROLL_IN = "cubic-bezier(.32,0,.67,0)"; // 去る（cubic-in。指数カーブだと最初の4割がほぼ止まって見える）
/** コインの姿勢（関数の並びを揃えて補間させる） */
const at = (x, y, r, sx, sy = sx) => ({ transform: `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sx}, ${sy})` });

export async function b() {
  const P = pick(SHIFT, { mid: MONO_CLOSED });
  await stagePlay("shift", async (node) => {
    const cx = W / 2, cy = 320, R = 206;
    const id = `mo-coin-${++coinSerial}`;
    // 背景・円盤・回る文字の輪（退場で左から拭き取る）
    const back = backdrop(`${P.bg}e6`);
    const art = stageSvg();
    const disc = svg("circle", { cx, cy, r: 252, fill: P.main, opacity: 0.32, class: "tr-scale" });
    const rim = svg("circle", { cx, cy, r: 176, fill: "none", stroke: P.light, "stroke-width": 3, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1, transform: `rotate(-90 ${cx} ${cy})` });
    const wipe = svg("circle", { cx, cy, r: R, fill: "none", stroke: "#fff", "stroke-width": 46, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1, transform: `rotate(-90 ${cx} ${cy})` });
    const words = svg("g", { class: "tr-scale" }, [svg("text", { "font-size": 17, "font-weight": 700, "letter-spacing": 3, fill: P.light }, [
      svg("textPath", { href: `#${id}-path`, textLength: Math.round(Math.PI * 2 * R - 8), lengthAdjust: "spacing" }, ["tonari ・ THANK YOU FOR TODAY ・ tonari ・ THANK YOU FOR TODAY ・"]),
    ])]);
    art.append(
      svg("defs", {}, [
        svg("path", { id: `${id}-path`, d: `M ${cx} ${cy - R} a ${R} ${R} 0 1 1 0 ${R * 2} a ${R} ${R} 0 1 1 0 ${-R * 2}` }),
        svg("mask", { id: `${id}-mask`, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: W, height: 720 }, [wipe]),
      ]),
      disc, rim, svg("g", { mask: `url(#${id}-mask)` }, [words]),
    );
    const plate = el("div.mo-coin-plate", [back, art]);
    const bar = el("i.mo-coin-bar", { style: { background: P.light } }); // 拭き取りの縁の細い帯
    // コイン: 表 OPEN／裏 CLOSED、真横を向いたときだけ見える縁
    const spin = el("div.mo-coin-spin", [
      coinFace("open", "OPEN", P.light, P.main, 80),
      el("i.mo-coin-edge", { style: { background: P.deep } }),
      coinFace("closed", "CLOSED", P.mid, P.light, 52),
    ]);
    const coin = el("div.mo-coin", [spin]);
    const trail = stageSvg(); // 速度線はコインの後ろ
    const fx = stageSvg();
    const word = kinetic("おつかれさま", "mo-coin-word");
    word.style.color = P.light;
    node.append(plate, bar, trail, el("div.mo-coin-stage", [coin]), fx, word);
    /** コインの通り道に残る縦の速度線（線が伸びてから根元から消える） */
    const streaks = (y0, y1, delay) => [-84, -42, 0, 42, 84].forEach((dx, i) => {
      const k = 1 - Math.abs(dx) / 140;
      const line = svg("line", { x1: cx + dx, y1: y0, x2: cx + dx, y2: y0 + (y1 - y0) * k, stroke: P.light, "stroke-width": 5, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1, opacity: 0.8 });
      trail.append(line);
      move(line, [{ strokeDashoffset: 1, easing: E.out }, { strokeDashoffset: 0, offset: 0.35, easing: SETTLE }, { strokeDashoffset: -1 }], 420, { easing: "linear", delay: delay + i * 18 });
    });
    // 1. 円盤が広がり、輪が描かれ、文字の輪が回りながら現れる
    move(back, [{ opacity: 0 }, { opacity: 1 }], 220);
    move(disc, [{ transform: "scale(0)" }, { transform: "scale(1)" }], 640, { easing: SOFT });
    move(rim, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 700, { easing: SOFT, delay: 100 });
    move(wipe, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 820, { easing: SOFT, delay: 160 });
    words.animate([{ transform: "rotate(-30deg)" }, { transform: "rotate(50deg)" }], { duration: 3400, easing: "cubic-bezier(.2,.6,.5,1)", fill: "both" });
    // 2. OPEN の札が弾んで出てくる
    // 出て（大きめに行き過ぎ）→ 落ち着く。全体に指数カーブを掛けると途中のキーフレームが一瞬で過ぎてしまう
    await move(coin, [{ ...at(0, 0, -30, 0), easing: E.out }, { ...at(0, 0, 3, 1.05), offset: 0.55, easing: SETTLE }, at(0, 0, 0, 1)], 520, { easing: "linear", delay: 120 });
    // 3. 指で弾く前に沈む（ため）
    await move(coin, [at(0, 0, 0, 1), at(0, 20, 0, 1.08, 0.88)], 200, { easing: E.out });
    // 4. 弾かれて縦にくるくる回りながら上がり、落ちてくる
    SE.whoosh();
    move(coin, [{ ...at(0, 20, 0, 1.08, 0.88), easing: "cubic-bezier(.2,.7,.4,1)" }, { ...at(0, -120, 0, 1.04, 1.04), offset: 0.48, easing: "cubic-bezier(.6,0,.85,.4)" }, at(0, 0, 0, 1, 1)], 820, { easing: "linear" });
    streaks(cy + 70, cy + 250, 40);
    streaks(cy - 300, cy - 150, 470);
    await move(spin, [{ transform: "rotateX(0deg)" }, { transform: "rotateX(900deg)" }], 820, { easing: "cubic-bezier(.3,.5,.6,1)" }); // 落ちる速さに合わせ、着地の直前まで回り続けてから止まる
    // 5. CLOSED で着地: つぶれて伸びて止まり、衝撃の輪
    SE.stamp();
    ring(fx, cx, cy, { r: 250, color: P.light, width: 8 });
    burst(fx, cx, cy, { n: 12, r0: 214, r1: 300, color: P.light, width: 6 });
    move(rim, [{ strokeWidth: 9 }, { strokeWidth: 3 }], 420, { easing: E.out });
    // つぶれた瞬間が衝撃のコマ。そこから跳ね返って伸び、落ち着く
    await move(coin, [{ ...at(0, 0, 0, 1.16, 0.84), easing: "cubic-bezier(.2,.7,.4,1)" }, { ...at(0, -10, 0, 0.95, 1.06), offset: 0.4, easing: SETTLE }, at(0, 0, 0, 1, 1)], 380, { easing: "linear" });
    // 6. 「おつかれさま」
    await playKinetic(word, { step: 42 });
    await sleep(380);
    // 7. 右へ転がって去り、背景はそのあとを追って拭き取られる
    move(word, [{ opacity: 1 }, { opacity: 0 }], 220);
    move(plate, [{ clipPath: "inset(0 0 0 0px)" }, { clipPath: "inset(0 0 0 1440px)" }], 640, { easing: ROLL_IN });
    move(bar, [{ transform: "translateX(-8px)" }, { transform: "translateX(1440px)" }], 640, { easing: ROLL_IN });
    await move(coin, [at(0, 0, 0, 1), at(1000, 0, 382, 1)], 640, { easing: ROLL_IN });
  });
}
