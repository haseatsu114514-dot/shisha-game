// 締めくくりの贈り物（bonds.playFinale・専用ハガルを受け取る前）。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
// どちらも生成したハガルの絵（making/bowl_empty_clay）を大きく見せる。シーシャの道具をベクターで描き足さない。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { DB, displayName, makingUrl } from "../core/data.js";
import { W, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick, burst, ring, confetti, twinkle, kinetic, playKinetic } from "../core/mg-kit.js";
import { flavorColor, bowlArtFiles } from "../craft/art.js";
import { stagePlay, backdrop } from "./stage.js";

// イージング。指数の曲線は短い動き用なので、長めの動きは quint／cubic のやわらかい曲線にする
const OUT_SOFT = "cubic-bezier(.33,1,.68,1)"; // 放り出す・立ち上げる動き（cubic-out）
const IN_SOFT = "cubic-bezier(.32,0,.67,0)"; // 抜けていく・しぼむ動き（cubic-in）
const GRAVITY = "cubic-bezier(.55,.085,.68,.53)"; // 落下（quad-in）
const BACK_SOFT = "cubic-bezier(.34,1.3,.64,1)"; // 大きな物の弾み（行き過ぎは約5%）

// ---------------------------------------------------------------- 共通: ハガルの絵・光の帯・香りの煙・文字

const BOWL = "bowl_empty_clay.png";
const BOWL_BOX = [0.0757, 0.1166, 0.9243, 0.8927, 1.3685]; // 絵の中身の範囲（manifest が読めないとき）
const BOWL_W = 546; // 中身の幅。元の絵のちょうど半分なので、ドットが均等に残る

/** 場面ごとの色では、リボン・布を贈り主の色にする（登場カットインと同じ配色）。紫1色では null */
function giverColor(from) {
  return pick({ ribbon: DB.manifest?.introArt?.[from]?.color || "" }).ribbon || null;
}

/** ハガルの絵を中身の幅 w px で置く。sheen は絵の形で切り抜いた光の帯 */
const bowlFile = gear => gear?.art ? bowlArtFiles({ equip: { bowl: gear.id } })[0] : BOWL;
function bowlArt(w = BOWL_W, gear = null) {
  const file = bowlFile(gear), url = makingUrl(file);
  const [l, t, r, b, aspect] = DB.manifest?.makingBox?.[file] || BOWL_BOX;
  // 背の高い専用ハガルも、縦横比を保って文字より上へ収める。
  w = Math.min(w, 440 * (r - l) * aspect / (b - t));
  const fullW = w / (r - l), fullH = fullW / aspect;
  const h = Math.round(fullH * (b - t));
  const size = `${fullW}px ${fullH}px`, pos = `${-l * fullW}px ${-t * fullH}px`;
  const sheen = el("i.mo-gift-sheen");
  const cut = { maskImage: `url("${url}")`, maskSize: size, maskPosition: pos, maskRepeat: "no-repeat", WebkitMaskImage: `url("${url}")`, WebkitMaskSize: size, WebkitMaskPosition: pos, WebkitMaskRepeat: "no-repeat" };
  const node = el("div.mo-gift-bowl", { style: { width: `${w}px`, height: `${h}px`, marginLeft: `${-w / 2}px`, marginTop: `${-h / 2}px`, backgroundImage: url ? `url("${url}")` : "none", backgroundSize: size, backgroundPosition: pos } }, [
    url ? el("div.mo-gift-glint", { style: cut }, [sheen]) : null,
  ]);
  return { node, sheen, w, h };
}

/** 絵を先に読んでおく（出てくる瞬間に欠けないように）。読めなくても長くは待たない */
async function loadBowl(gear) {
  const url = makingUrl(bowlFile(gear));
  if (!url) return;
  const img = new Image();
  img.src = url;
  await Promise.race([img.decode().catch(() => {}), sleep(1500)]);
}

/** 光の帯がハガルの上を斜めに一度走る */
const glint = (sheen, delay = 0) => move(sheen, [{ transform: "translateX(-160%) skewX(-20deg)" }, { transform: "translateX(420%) skewX(-20deg)" }], 820, { easing: "cubic-bezier(.45,0,.25,1)", delay });

/** 香りの煙: 口から細い線が揺れながら上り、根元から消える（トリムパス） */
function aroma(root, x, y, color, { n = 3, delay = 0, spread = 150, h = 1 } = {}) {
  for (let i = 0; i < n; i++) {
    const sx = x + (i - (n - 1) / 2) * (spread / Math.max(1, n - 1)) + (Math.random() - 0.5) * 20;
    const s = i % 2 ? 1 : -1;
    const d = `M ${sx} ${y} c ${18 * s} ${-40 * h}, ${-28 * s} ${-62 * h}, ${-4 * s} ${-104 * h} s ${30 * s} ${-58 * h}, ${4 * s} ${-112 * h} s ${-22 * s} ${-40 * h}, ${-6 * s} ${-70 * h}`;
    const wisp = svg("path", { d, fill: "none", stroke: color, "stroke-width": 6, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": "0.42 1", "stroke-dashoffset": 0.42, opacity: 0.9 });
    root.append(wisp);
    move(wisp, [
      { strokeDashoffset: 0.42, transform: "translateY(0px)", opacity: 0.9 },
      { strokeDashoffset: -0.3, transform: "translateY(-10px)", opacity: 0.9, offset: 0.6 },
      { strokeDashoffset: -1, transform: "translateY(-30px)", opacity: 0 },
    ], 1500, { easing: "cubic-bezier(.3,.4,.5,1)", delay: delay + i * 170 }).then(() => wisp.remove());
  }
}

/** 贈り主の名前（両脇に線）と品名（1文字ずつ） */
function caption(gear, cls, sub, main) {
  const from = gear.gift?.from;
  const lines = ["l", "r"].map((s) => el(`i.mo-gift-rule.${s}`, { style: { background: sub } }));
  const giver = el("small.mo-gift-from", { style: { color: sub } }, [lines[0], el("span", { text: `${displayName(from, state)}から` }), lines[1]]);
  const title = kinetic(gear.name, "mo-gift-title");
  title.style.color = main;
  const box = el(`div.mo-gift-name.${cls}`, [giver, title]);
  async function show(delay = 0) {
    await sleep(delay);
    move(giver, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], 360, { easing: E.out });
    lines.forEach((l, i) => move(l, [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], 420, { easing: E.out, delay: 80 + i * 40 }));
    await playKinetic(title, { delay: 100, step: 18 });
  }
  /** 文字が上へ抜けて消える */
  function hide() {
    move(giver, [{ opacity: 1 }, { opacity: 0 }], 200);
    return Promise.all([...title.querySelectorAll(".mg-char")].map((c, i) => move(c, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-110%)", opacity: 0 }], 300, { easing: E.in, delay: i * 10 })));
  }
  return { box, show, hide };
}

/** 最後: ハガルが一度ふくらんでから点に縮み（持ち物へ）、背景が真ん中から丸く開く */
async function finish(iris, hero, fx, cx, cy, P) {
  // ふくらみとしぼみを別の曲線に（全体に強い加速をかけると、ふくらみが長く居座って最後の一瞬で消える）
  move(hero, [{ transform: "translate(0,0) scale(1)", opacity: 1, easing: OUT_SOFT }, { transform: "translate(0,-8px) scale(1.05)", opacity: 1, offset: 0.3, easing: IN_SOFT }, { transform: "translate(0,0) scale(0)", opacity: 1 }], 420, { easing: "linear" });
  await sleep(410); // ハガルが点になる瞬間に合わせる
  SE.select();
  ring(fx, cx, cy, { r: 120, color: P.white, width: 6, dur: 420 });
  // 最後の遅延分も丸い幕の520msに収める。
  [[-70, -40], [80, -24], [-20, 60], [52, 52]].forEach(([dx, dy], i) => twinkle(fx, cx + dx, cy + dy, { color: P.light, size: 12, delay: i * 40, dur: 400 }));
  await move(iris, [{ "--mo-hole": "0%" }, { "--mo-hole": "100%" }], 520, { easing: IN_SOFT });
}

// ---------------------------------------------------------------- a: 箱: 落ちて弾み、リボンがほどけ、光の柱からハガルが上がる。箱は下へ抜ける

const GIFT = { bg: "#1b2440", deep: "#0e1428", main: "#f08a4b", mid: "#5a6fb8", light: "#ffd27a", white: "#fff8ec" };

/** gear: data/equipment.json の贈り物の1件（gift.from が贈り主） */
export async function a(gear) {
  const P = pick(GIFT);
  const ribbon = giverColor(gear.gift?.from) || P.main;
  const smoke = pick({ c: flavorColor(gear.gift?.flavor) }, { c: P.light }).c;
  const cx = W / 2, cy = 300; // ハガルの中心
  await loadBowl(gear);
  await stagePlay("gift", async (node) => {
    // 背景・光・箱・ハガル・前面のはじけ・文字の順に重ねる
    const back = backdrop(P.bg);
    const glow = el("i.mo-gift-glow", { style: { background: `radial-gradient(circle, ${P.mid}, transparent 64%)` } });
    const rays = el("div.mo-gift-rays", { style: { "--c": `${P.light}40` } });
    const cone = el("i.mo-gift-cone", { style: { background: `linear-gradient(${P.white}38, ${P.white}00 92%)` } });
    const iris = el("div.mo-gift-iris", [back, glow, rays, cone]);
    const shadow = el("i.mo-gift-shadow");
    const bowl = bowlArt(BOWL_W, gear);
    const hero = el("div.mo-gift-hero", [shadow, bowl.node]);
    const column = el("i.mo-gift-column", { style: { background: `linear-gradient(${P.light}00, ${P.light}cc)` } });
    const band = (k) => el(`i.mo-gift-band.${k}`, { style: { background: ribbon } });
    const lid = el("div.mo-gift-lid", { style: { background: P.white } }, [band("v")]);
    const loops = ["l", "r"].map((s) => el(`i.mo-gift-loop.${s}`, { style: { borderColor: ribbon } }));
    const knot = el("i.mo-gift-knot", { style: { background: ribbon } });
    const box = el("div.mo-gift-box", { style: { background: P.white } }, [band("v"), band("h")]);
    const pack = el("div.mo-gift-pack", [box, lid, ...loops, knot]);
    const fx = stageSvg();
    const smokeArt = stageSvg();
    const cap = caption(gear, "at-a", P.light, P.white);
    node.append(iris, hero, column, pack, smokeArt, fx, cap.box);
    move(back, [{ opacity: 0 }, { opacity: 1 }], 260);
    move(glow, [{ transform: "translate(-50%,-50%) scale(0.3)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0.55 }], 700, { easing: OUT_SOFT });
    // 1. 箱が伸びながら落ちて、着地でつぶれる
    await move(pack, [{ transform: "translate(-50%, -720px) scale(0.88, 1.2)" }, { transform: "translate(-50%, 0) scale(1, 1)" }], 440, { easing: GRAVITY });
    SE.pugo();
    burst(fx, cx - 160, 556, { n: 3, r0: 12, r1: 54, color: P.light, width: 5, turn: Math.PI * 0.8 });
    burst(fx, cx + 160, 556, { n: 3, r0: 12, r1: 54, color: P.light, width: 5, turn: -Math.PI * 0.15 });
    await move(pack, [{ transform: "translate(-50%, 0) scale(1.16, 0.84)", easing: "ease-out" }, { transform: "translate(-50%, 0) scale(0.95, 1.06)", easing: "ease-in-out" }, { transform: "translate(-50%, 0) scale(1)" }], 340, { easing: "linear" });
    // 2. リボンが揺れて、輪が飛び、帯が縮んでほどける
    // 揺れは区間ごとに緩急（全体に強い曲線をかけると中の区間が不揃いになる）
    await Promise.all([...loops, knot].map((l, i) => move(l, [{ rotate: "0deg", easing: "ease-in-out" }, { rotate: `${[-12, 12, 0][i]}deg`, scale: "1.15", easing: "ease-in-out" }, { rotate: `${[6, -6, 0][i]}deg`, easing: "ease-in-out" }, { rotate: "0deg" }], 280, { easing: "linear" })));
    loops.forEach((l, i) => {
      move(l, [{ translate: "0 0", rotate: "0deg", scale: "1" }, { translate: `${i ? 240 : -240}px -170px`, rotate: `${i ? 260 : -260}deg`, scale: "0.4" }], 480, { easing: OUT_SOFT });
      move(l, [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], 480, { easing: "linear" }); // 飛んでいる間は見えて、後半で消える
    });
    move(knot, [{ scale: "1" }, { scale: "0" }], 200, { easing: IN_SOFT });
    pack.querySelectorAll(".mo-gift-band.v").forEach((b) => move(b, [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], 260, { easing: IN_SOFT, delay: 100 }));
    pack.querySelectorAll(".mo-gift-band.h").forEach((b) => move(b, [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], 260, { easing: IN_SOFT, delay: 140 }));
    await sleep(200);
    // 3. ふたが跳ね、光の柱が立ち、ハガルが上がる。箱は下へ抜けて、ハガルに重ならない
    SE.puka();
    move(lid, [{ transform: "translate(0,0) rotate(0deg)" }, { transform: "translate(210px,-330px) rotate(38deg)" }], 560, { easing: OUT_SOFT });
    move(lid, [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], 560, { easing: "linear" }); // 飛んでいる間は見えて、後半で消える
    // 柱は立ち上がりと消え方を別の曲線に（全体に強い減速をかけると、一瞬で立って長く薄れるだけになる）
    move(column, [{ transform: "scaleY(0)", opacity: 1, easing: OUT_SOFT }, { transform: "scaleY(1)", opacity: 1, offset: 0.42, easing: "cubic-bezier(.2,.7,.4,1)" }, { transform: "scaleY(1.1)", opacity: 0 }], 620, { easing: "linear" }); // ハガルが大きくなる頃には薄れて、上に重ならない
    confetti(fx, cx, 390, { n: 20, colors: [ribbon, P.light, P.white, P.main], spread: 340 });
    burst(fx, cx, cy, { n: 14, r0: 290, r1: 380, color: P.light, width: 6, delay: 120 });
    ring(fx, cx, cy, { r: 340, color: P.white, width: 8, delay: 100 });
    // 光線: 現れる区間は減速、そのあとは一定の速さで回り続ける（退場はその角度から続ける）
    move(rays, [{ opacity: 0, transform: "translate(-50%,-50%) scale(0.3) rotate(0deg)", easing: OUT_SOFT }, { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(6deg)", offset: 0.14, easing: "linear" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(46deg)" }], 3200, { easing: "linear" });
    // 箱: ひと呼吸の持ち上げ（上へ減速）から、下へ落ちて抜ける（加速）。区間ごとに曲線を分ける
    move(pack, [{ transform: "translate(-50%, 0) rotate(0deg)", easing: OUT_SOFT }, { transform: "translate(-50%, -18px) rotate(0deg)", offset: 0.25, easing: GRAVITY }, { transform: "translate(-50%, 460px) rotate(5deg)" }], 520, { easing: "linear", delay: 40 });
    await move(hero, [{ transform: "translate(0,190px) scale(0.34)", opacity: 1 }, { transform: "translate(0,0) scale(1)", opacity: 1 }], 640, { easing: BACK_SOFT, delay: 90 });
    // 4. 見せ場: スポットライト・影・光の帯・香りの煙・きらめき・文字
    move(cone, [{ opacity: 0, transform: "translateX(-50%) scaleY(0.6)" }, { opacity: 1, transform: "translateX(-50%) scaleY(1)" }], 520, { easing: E.out });
    move(shadow, [{ opacity: 0, transform: "scale(0.4)" }, { opacity: 1, transform: "scale(1)" }], 360, { easing: E.out });
    glint(bowl.sheen, 120);
    aroma(smokeArt, cx, cy - 90, smoke, { n: 3, delay: 80, spread: 170 });
    aroma(smokeArt, cx + 20, cy - 96, smoke, { n: 2, delay: 900, spread: 120 });
    [[-268, -70, 18], [262, -96, 14], [-170, -170, 12], [210, 30, 12]].forEach(([dx, dy, s], i) => twinkle(fx, cx + dx, cy + dy, { color: P.light, size: s, delay: 200 + i * 160 }));
    await cap.show(0);
    await sleep(720);
    // 5. 退場: 文字が抜け、光がしぼみ、ハガルが点になって背景が開く
    cap.hide();
    move(smokeArt, [{ opacity: 1 }, { opacity: 0 }], 300);
    move(cone, [{ opacity: 1 }, { opacity: 0 }], 240);
    const turn = raysAngle(rays); // 今の角度から続けて、回転が飛ばないようにする
    move(rays, [{ opacity: 1, transform: `translate(-50%,-50%) scale(1) rotate(${turn}deg)` }, { opacity: 0, transform: `translate(-50%,-50%) scale(0.5) rotate(${turn + 8}deg)` }], 420, { easing: IN_SOFT });
    await finish(iris, hero, fx, cx, cy, P);
  });
}

/** 光線の今の回転角（度）。計算後のスタイルから読む */
function raysAngle(node) {
  try {
    const m = new DOMMatrix(getComputedStyle(node).transform);
    return Math.round(Math.atan2(m.b, m.a) * 1800 / Math.PI) / 10;
  } catch { return 44; }
}

// ---------------------------------------------------------------- b: 風呂敷: 結び目がほどけ、四隅が手前へめくれて開き、布が床に寝てハガルが立ち上がる

const FUROSHIKI = { bg: "#f4ead9", deep: "#2c2433", main: "#c9884f", mid: "#e8d8bf", light: "#f2b84b", white: "#ffffff", ink: "#2c2433", ray: "#e9d6b6" };
const MONO_INK = "#150e30";
/** 明るい背景の配色か（文字を濃い色にする） */
const motionIsLight = (P) => parseInt(P.bg.slice(1, 3), 16) > 160;

/** 布の色を明るく／暗く（#rrggbb を白か黒へ k だけ寄せる） */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const to = k > 0 ? 255 : 0, a = Math.abs(k);
  const c = [16, 8, 0].map((s) => Math.round(((n >> s) & 255) * (1 - a) + to * a));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const R = 300; // 布の中心から角まで（開くと幅600のひし形）

/** 開いた布の1枚の三角（top／right／bottom／left）。表（内側）と裏（外側）の2面を持ち、折り目を軸に回る */
function flap(side, inner, outer) {
  const vertical = side === "top" || side === "bottom";
  const box = { top: [-R / 2, -R, R, R / 2], bottom: [-R / 2, R / 2, R, R / 2], left: [-R, -R / 2, R / 2, R], right: [R / 2, -R / 2, R / 2, R] }[side];
  const tri = { top: "50% 0, 0 100%, 100% 100%", bottom: "0 0, 100% 0, 50% 100%", left: "0 50%, 100% 0, 100% 100%", right: "0 0, 100% 50%, 0 100%" };
  const flipTri = { top: "bottom", bottom: "top", left: "right", right: "left" }[side]; // 裏面は自分の向きで裏返すので、三角も逆向きにしておく
  const origin = { top: "50% 100%", bottom: "50% 0", left: "100% 50%", right: "0 50%" }[side];
  const face = (bg, poly, flip) => el("i.mo-fu-face", { style: { background: bg, clipPath: `polygon(${poly})`, transform: flip ? (vertical ? "rotateX(180deg)" : "rotateY(180deg)") : "none" } });
  const node = el("div.mo-fu-flap", { style: { left: `${box[0]}px`, top: `${box[1]}px`, width: `${box[2]}px`, height: `${box[3]}px`, transformOrigin: origin } }, [face(inner, tri[side]), face(outer, tri[flipTri], true)]);
  // 閉じた向き（布の中心へ折り返す）。手前を通って開くように符号を選ぶ
  const shut = { top: "rotateX(-178deg)", bottom: "rotateX(178deg)", left: "rotateY(178deg)", right: "rotateY(-178deg)" }[side];
  const half = { top: "rotateX(-90deg)", bottom: "rotateX(90deg)", left: "rotateY(90deg)", right: "rotateY(-90deg)" }[side];
  node.style.transform = shut;
  return { node, shut, half, open: vertical ? "rotateX(0deg)" : "rotateY(0deg)" };
}

export async function b(gear) {
  const cloth = giverColor(gear.gift?.from);
  const P = pick({ ...FUROSHIKI, cloth: cloth || "#b07acc" }, { ink: MONO_INK, ray: "#9a82d855", cloth: "#6b4fb0" });
  const smoke = pick({ c: flavorColor(gear.gift?.flavor) }, { c: P.light }).c;
  const dark = motionIsLight(P) ? P.ink : P.white;
  const cx = W / 2, cy = 320; // ハガルの中心
  await loadBowl(gear);
  const inner = `radial-gradient(circle, ${shade(P.cloth, 0.62)} 22%, transparent 24%) 0 0 / 26px 26px, ${shade(P.cloth, 0.42)}`;
  const outer = `radial-gradient(circle, ${shade(P.cloth, 0.3)} 20%, transparent 22%) 0 0 / 26px 26px, radial-gradient(circle, ${shade(P.cloth, 0.3)} 20%, transparent 22%) 13px 13px / 26px 26px, ${P.cloth}`;
  await stagePlay("gift", async (node) => {
    const back = backdrop(P.bg);
    const rays = el("div.mo-gift-rays.at-b", { style: { "--c": `${P.ray}` } });
    const iris = el("div.mo-gift-iris.at-b", [back, rays]);
    // 布: 中央の四角（内側）と4枚の三角。全体を寝かせて床にする
    const base = el("i.mo-fu-base", { style: { background: inner } });
    const flaps = ["top", "right", "bottom", "left"].map((s) => flap(s, inner, outer));
    const mat = el("div.mo-fu-cloth", [base, ...flaps.map((f) => f.node)]);
    const ears = ["l", "r"].map((s) => el(`i.mo-fu-ear.${s}`, { style: { background: shade(P.cloth, -0.12) } }));
    const knot = el("div.mo-fu-knot", [...ears, el("i.mo-fu-tie", { style: { background: shade(P.cloth, -0.2) } })]);
    const tilt = el("div.mo-fu-tilt", [mat, knot]);
    const scene = el("div.mo-fu-scene", [tilt]);
    const shadow = el("i.mo-gift-shadow.at-b");
    const bowl = bowlArt(500, gear);
    const hero = el("div.mo-gift-hero.at-b", [shadow, bowl.node]);
    const fx = stageSvg();
    const smokeArt = stageSvg();
    const cap = caption(gear, "at-b", shade(P.cloth, motionIsLight(P) ? -0.25 : 0.45), dark);
    node.append(iris, scene, hero, smokeArt, fx, cap.box);
    move(back, [{ opacity: 0 }, { opacity: 1 }], 260);
    // 1. 包みが回りながら飛び込んで止まる
    await move(tilt, [{ transform: "translateY(60px) scale(0.2) rotate(-140deg)" }, { transform: "translateY(0) scale(1) rotate(0deg)" }], 480, { easing: E.back });
    SE.pugo();
    ring(fx, cx, 360, { r: 260, color: P.light, width: 6, dur: 520 });
    // 2. 結び目の耳が引っぱられて左右へ抜け、結び目がはじける
    await Promise.all(ears.map((e, i) => move(e, [{ scale: "1 1" }, { scale: "1.25 0.8" }, { scale: "1 1" }], 220, { easing: "ease-out" })));
    SE.puka();
    ears.forEach((e, i) => move(e, [{ translate: "0 0", rotate: "0deg", opacity: 1 }, { translate: `${i ? 220 : -220}px -120px`, rotate: `${i ? 200 : -200}deg`, opacity: 0, scale: "0.5" }], 460, { easing: E.out }));
    move(knot.querySelector(".mo-fu-tie"), [{ scale: "1" }, { scale: "1.4", offset: 0.3 }, { scale: "0" }], 280, { easing: E.in });
    burst(fx, cx, 360, { n: 8, r0: 40, r1: 110, color: P.light, width: 5, delay: 60 });
    await sleep(110);
    // 3. 四隅が一枚ずつ手前へめくれて開く（2.5D）
    SE.whoosh();
    await Promise.all(flaps.map((f, i) => move(f.node, [{ transform: f.shut }, { transform: f.half, offset: 0.45 }, { transform: f.open }], 460, { easing: "cubic-bezier(.3,.1,.3,1)", delay: i * 70 })));
    // 4. 布が奥へ倒れて床になり、真ん中からハガルが立ち上がる
    move(tilt, [{ transform: "translateY(0) rotateX(0deg) scale(1)" }, { transform: "translateY(178px) rotateX(64deg) scale(1.16)" }], 640, { easing: E.inOut });
    await sleep(300);
    SE.select();
    burst(fx, cx, cy, { n: 12, r0: 270, r1: 350, color: P.light, width: 6, delay: 80 });
    ring(fx, cx, cy, { r: 320, color: dark, width: 6, delay: 60 });
    move(rays, [{ opacity: 0, transform: "translate(-50%,-50%) scale(0.3) rotate(0deg)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(12deg)", offset: 0.25 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(40deg)" }], 3000, { easing: "cubic-bezier(.2,.6,.4,1)" });
    move(shadow, [{ opacity: 0, transform: "scale(0.2)" }, { opacity: 1, transform: "scale(1)" }], 500, { easing: E.out, delay: 120 });
    const rise = move(hero, [{ transform: "translate(0,200px) scale(0) rotate(-8deg)", opacity: 1 }, { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 }], 620, { easing: E.back });
    const named = cap.show(320); // 文字はハガルが立ちきる前から出し始める
    await rise;
    // 5. 見せ場: 光の帯・香りの煙（上の文字に届かない低さ）・きらめき・文字（上に置いて、ハガルに重ねない）
    glint(bowl.sheen, 60);
    aroma(smokeArt, cx, cy - 86, smoke, { n: 3, delay: 0, spread: 150, h: 0.5 });
    aroma(smokeArt, cx - 16, cy - 92, smoke, { n: 2, delay: 820, spread: 110, h: 0.5 });
    [[-250, -60, 16], [236, -90, 13], [-150, -150, 11], [190, 40, 12]].forEach(([dx, dy, s], i) => twinkle(fx, cx + dx, cy + dy, { color: P.light, size: s, delay: 140 + i * 150 }));
    await named;
    await sleep(700);
    // 6. 退場: 文字が抜け、布が奥へ倒れきり、ハガルが点になって背景が開く
    cap.hide();
    move(smokeArt, [{ opacity: 1 }, { opacity: 0 }], 300);
    move(tilt, [{ transform: "translateY(178px) rotateX(64deg) scale(1.16)", opacity: 1 }, { transform: "translateY(240px) rotateX(90deg) scale(1.16)", opacity: 0 }], 420, { easing: E.in });
    move(rays, [{ opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(40deg)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(0.5) rotate(56deg)" }], 420, { easing: E.in });
    await finish(iris, hero, fx, cx, cy, { ...P, white: dark });
  });
}
