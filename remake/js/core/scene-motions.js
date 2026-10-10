// 場面ごとの一度きりのモーショングラフィックス（CI107・CI108）。
// チェキ（PEPPERMINT）／占いのタロット／締めくくりの贈り物／バイトの終わり／サメちゃんとの出会い／つむぎのスケッチ。
// 平らな色面・線を描いて引っ込める放射線・広がる輪・強い緩急（core/mg-kit.js）。配色は紫1色と場面ごとの色の2系統。
// チェキの写真・ハガル・背景以外は図形で描く。SKIP中と動きを減らす設定では省く。
import { el, sleep, nextFrame } from "./util.js";
import { SE } from "./audio.js";
import { state } from "./state.js";
import { DB, displayName, faceIconUrl, makingUrl } from "./data.js";
import { W, H, svg, stageSvg, move, holdKeys, reducedMotion } from "./transition-kit.js";
import { holdCover } from "./transitions.js";
import { MG_EASE as E, pick, burst, ring, confetti, twinkle, kinetic, playKinetic } from "./mg-kit.js";

const skipMotion = () => reducedMotion() || document.body.classList.contains("vn-skip");
const fxHost = () => document.getElementById("fx");

/** 画面いっぱいの器を #fx に置き、終わったら片付ける */
async function stagePlay(name, run, { cover = false } = {}) {
  const node = el(`div.mo.mo-${name}`, { "aria-hidden": "true", dataset: { motion: name } });
  const release = cover ? holdCover() : holdKeys();
  fxHost().append(node);
  try {
    await nextFrame();
    await run(node);
  } finally {
    node.remove();
    release();
  }
}
const backdrop = (color) => el("div.mo-back", { style: { backgroundColor: color } });

// ---------------------------------------------------------------- チェキ: ファインダー → シャッター → フィルム → 写真だけ現像 → 落書きを書いていく

const CHEKI = { bg: "#2a2238", deep: "#17111f", main: "#ff7aa8", mid: "#6ee7c8", light: "#fff6e5", white: "#ffffff" };
const PHOTO = "inset(8.08% 10.47% 22.22% 10.57%)"; // 写真の範囲（元画像の実測）
// 余白の落書き。書いていく順に [始まりの切り抜き, 書き終えた切り抜き]
const DOODLES = [
  ["inset(16% 89.4% 84% 3.5%)", "inset(16% 89.4% 21% 3.5%)"], // 左の余白（上から下へ）
  ["inset(16% 3.5% 84% 89.4%)", "inset(16% 3.5% 21% 89.4%)"], // 右の余白
  ["inset(77.6% 95% 13.4% 4%)", "inset(77.6% 4% 13.4% 4%)"], // 1行目（左から右へ）
  ["inset(86.6% 95% 2.5% 4%)", "inset(86.6% 4% 2.5% 4%)"], // 2行目と名前
];

/** 会話のCGレイヤーと同じ位置・大きさ（vn.css の縦型チェキ: 高さ 100%-230px、上から18px） */
function chekiBox(img) {
  const h = H - 230;
  const w = Math.round(h * (img.naturalWidth / img.naturalHeight || 0.63));
  return { left: (W - w) / 2, top: 18, width: w, height: h };
}

/** placeCg(): 書き終えた瞬間に会話のCGを同じ位置へ置く（重ねたフィルムを外す前に呼ぶ） */
export async function chekiShot(url, placeCg = null) {
  if (skipMotion() || !url) return;
  const P = pick(CHEKI);
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => {});
  await stagePlay("cheki", async (node) => {
    const box = chekiBox(img);
    const back = backdrop(P.bg);
    back.style.opacity = "0";
    const stripes = el("div.mo-stripes", { style: { "--c": P.main } });
    const art = stageSvg();
    // ファインダー: 四隅のカギと、合焦する小さな枠
    const fx = 400, fy = 40, fw = 480, fh = 470, k = 70;
    const corners = [[fx, fy + k, fx, fy, fx + k, fy], [fx + fw - k, fy, fx + fw, fy, fx + fw, fy + k], [fx, fy + fh - k, fx, fy + fh, fx + k, fy + fh], [fx + fw - k, fy + fh, fx + fw, fy + fh, fx + fw, fy + fh - k]]
      .map(([x1, y1, x2, y2, x3, y3]) => svg("path", { d: `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`, fill: "none", stroke: P.white, "stroke-width": 7, "stroke-linecap": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }));
    const focus = svg("rect", { x: 610, y: 200, width: 64, height: 46, fill: "none", stroke: P.white, "stroke-width": 4, class: "tr-scale" });
    art.append(...corners, focus);
    const blades = stageSvg([...Array(6)].map((_, i) => svg("g", { transform: `rotate(${i * 60 + 18} ${W / 2} ${H / 2})` }, [
      svg("rect", { x: W / 2 - 1000, y: H / 2 - 760 - 1100, width: 2000, height: 1100, fill: i % 2 ? P.deep : P.bg, stroke: P.main, "stroke-width": 3, class: "mo-blade" }),
    ])));
    const flash = el("div.mo-flash");
    // フィルム: 白い台紙（写真の形で切り抜き）→ 写真だけ現像 → 落書きを書く
    const film = el("div.mo-film", { style: { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` } });
    const card = el("i.mo-film-card", { style: { "-webkit-mask-image": `url("${url}")`, maskImage: `url("${url}")` } });
    const photo = el("img.mo-film-layer", { src: url, alt: "", style: { clipPath: PHOTO } });
    const inks = DOODLES.map(([from]) => el("img.mo-film-layer", { src: url, alt: "", style: { clipPath: from } }));
    const full = el("img.mo-film-layer", { src: url, alt: "", style: { opacity: "0" } });
    const pen = el("i.mo-pen", { style: { background: P.main } });
    film.append(card, photo, ...inks, full, pen);
    film.style.opacity = "0";
    node.append(back, stripes, art, blades, flash, film);
    // 1. ファインダーの四隅が描かれ、枠が迷ってから合う
    corners.forEach((c, i) => move(c, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 300, { easing: E.out, delay: i * 40 }));
    await move(focus, [{ transform: "scale(1.6)", opacity: 0 }, { transform: "scale(0.85)", opacity: 1, offset: 0.5 }, { transform: "scale(1.1)", offset: 0.75 }, { transform: "scale(1)" }], 620, { easing: E.out });
    focus.setAttribute("stroke", P.mid);
    ring(art, 642, 223, { r: 70, color: P.mid, width: 5, dur: 420 });
    await sleep(220);
    // 2. シャッターの羽根が閉じてフラッシュ
    SE.punch();
    await Promise.all([...blades.querySelectorAll(".mo-blade")].map((b) => move(b, [{ transform: "translate(0,0)" }, { transform: "translate(0, 770px)" }], 150, { easing: E.in })));
    back.style.opacity = "1";
    art.replaceChildren();
    move(flash, [{ opacity: 1 }, { opacity: 0 }], 420, { easing: E.out });
    move(blades, [{ opacity: 1 }, { opacity: 0 }], 160);
    move(stripes, [{ opacity: 0 }, { opacity: 1 }], 500);
    // 3. フィルムが下から伸びて出てくる
    SE.pour();
    film.style.opacity = "";
    await move(film, [{ transform: "translateY(118%) rotate(-7deg) scaleY(1.12)" }, { transform: "translateY(0) rotate(-2deg) scaleY(1)" }], 680, { easing: E.out });
    burst(art, W / 2, box.top + box.height + 6, { n: 6, r0: 30, r1: 90, color: P.light, width: 5, turn: Math.PI / 6 });
    // 4. 写真だけが白っぽいところから現像される（台紙の余白はまだ白いまま）
    move(photo, [{ filter: "brightness(2.3) saturate(0) contrast(0.22)" }, { filter: "brightness(1.4) saturate(0.4) contrast(0.6)", offset: 0.45 }, { filter: "none" }], 1300, { easing: "ease-out" });
    [[-40, 120], [box.width + 40, 260], [-30, 380]].forEach(([dx, dy], i) => twinkle(art, box.left + dx, box.top + dy, { color: P.light, size: 14, delay: 300 + i * 260 }));
    await sleep(1350);
    // 5. 余白に落書きが書かれていく（ペン先が先頭を走る）
    for (const [i, [from, to]] of DOODLES.entries()) {
      const vertical = i < 2;
      const dur = vertical ? 300 : 440;
      const x0 = i === 1 ? 93 : 7, y0 = vertical ? 16 : i === 2 ? 82 : 91;
      pen.style.opacity = "1";
      move(pen, vertical
        ? [{ left: `${x0}%`, top: `${y0}%` }, { left: `${x0}%`, top: "79%" }]
        : [{ left: "4%", top: `${y0}%` }, { left: "96%", top: `${y0}%` }], dur, { easing: "ease-in-out" });
      SE.tick();
      await move(inks[i], [{ clipPath: from }, { clipPath: to }], dur, { easing: "ease-in-out" });
    }
    pen.style.opacity = "0";
    full.style.opacity = "1";
    twinkle(art, box.left + box.width - 30, box.top + box.height - 70, { color: P.main, size: 22 });
    twinkle(art, box.left + 26, box.top + box.height - 40, { color: P.mid, size: 16, delay: 90 });
    await move(film, [{ transform: "rotate(-2deg)" }, { transform: "rotate(0deg)" }], 320, { easing: E.back });
    // 6. 背景を会話のCGと同じ黒へ戻し、同じ位置にCGを置く
    move(stripes, [{ opacity: 1 }, { opacity: 0 }], 300);
    await move(back, [{ backgroundColor: P.bg }, { backgroundColor: "#0b0812" }], 320);
    placeCg?.();
  });
}

// ---------------------------------------------------------------- 占い: 星図の輪が描かれ、3枚の札が飛んできて、真ん中が裏返る

const TAROT = { bg: "#101a3a", deep: "#080e22", main: "#24356e", mid: "#4a5fb4", light: "#f2c14e", white: "#fff6dc" };

function tarotCard(P, i) {
  return el("div.mo-tarot-card", { style: { "--i": String(i) } }, [el("div.mo-tarot-flip", [
    el("div.mo-tarot-back", { style: { background: P.main, borderColor: P.light, "--l": P.light } }, [el("i.mo-tarot-moon"), el("b.mo-tarot-star"), el("b.mo-tarot-star.s2"), el("b.mo-tarot-star.s3")]),
  ])]);
}

export async function tarotFlip(charId = state?.fortune?.char) {
  if (skipMotion()) return;
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
    const face = faceIconUrl(charId, state);
    const name = charId ? displayName(charId, state) : "その人";
    const gloss = el("i.mo-gloss");
    cards[1].firstChild.append(el("div.mo-tarot-front", { style: { background: P.white, borderColor: P.light } }, [
      el("small", { text: "THREAD OF FATE", style: { color: P.mid } }),
      el("div.mo-tarot-face", { style: { borderColor: P.light, background: P.main } }, [face ? el("img", { src: face, alt: "" }) : el("b", { text: "？" })]),
      el("b.mo-tarot-name", { text: name, style: { color: P.deep } }),
      el("small.en", { text: "縁", style: { color: P.main } }),
      gloss,
    ]));
    const title = kinetic(`${name}との縁`, "mo-tarot-title");
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
    // 4. くるっと裏返り、光が走る
    await move(cards[1].firstChild, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], 520, { easing: E.inOut });
    SE.just();
    ring(art, cx, cy, { r: 260, color: P.light, width: 8 });
    burst(art, cx, cy, { n: 14, r0: 230, r1: 330, color: P.light, width: 5 });
    move(gloss, [{ transform: "translateX(-140%) skewX(-20deg)" }, { transform: "translateX(240%) skewX(-20deg)" }], 520, { easing: E.inOut });
    await playKinetic(title, { delay: 120 });
    await sleep(900);
    // 5. 退場
    move(title, [{ opacity: 1 }, { opacity: 0 }], 240);
    move(art, [{ opacity: 1 }, { opacity: 0 }], 360);
    move(back, [{ opacity: 1 }, { opacity: 0 }], 420, { delay: 160 });
    await move(cards[1], [{ transform: "translate(-50%, -16px) scale(1.16) rotate(0deg)", opacity: 1 }, { transform: "translate(-50%, -40px) scale(0.6) rotate(12deg)", opacity: 0 }], 420, { easing: E.in });
  });
}

// ---------------------------------------------------------------- 贈り物: 箱が落ちて弾み、リボンがほどけ、紙吹雪の中からハガル

const GIFT = { bg: "#4e1420", deep: "#270a10", main: "#e2403c", mid: "#ffd6a5", light: "#ffd166", white: "#fffaf0" };

/** 場面ごとの色では、リボンを贈り主の色にする（登場カットインと同じ配色）。紫1色では null */
function pickRibbon(from) {
  return pick({ ribbon: DB.manifest?.introArt?.[from]?.color || "" }).ribbon || null;
}

export async function giftOpen(giftId) {
  const gear = DB.equipById?.[giftId];
  if (skipMotion() || !gear) return;
  const from = gear.gift?.from;
  const P = pick(GIFT);
  const ribbon = pickRibbon(from) || P.main;
  const art = makingUrl("bowl_empty_clay.png");
  await stagePlay("gift", async (node) => {
    const back = backdrop(P.bg);
    const spot = el("i.mo-spot", { style: { background: `radial-gradient(circle, ${P.mid}55, transparent 62%)` } });
    const fxArt = stageSvg();
    const rays = el("div.mo-rays", { style: { "--c": `${P.light}55` } });
    const hagar = art ? el("img.mo-gift-item", { src: art, alt: "" }) : el("b.mo-gift-item");
    const lid = el("div.mo-gift-lid", { style: { background: P.white } }, [el("i.mo-gift-band", { style: { background: ribbon } })]);
    const loops = ["l", "r"].map((s) => el(`i.mo-gift-loop.${s}`, { style: { borderColor: ribbon } }));
    const box = el("div.mo-gift-box", { style: { background: P.white } }, [el("i.mo-gift-band", { style: { background: ribbon } })]);
    const pack = el("div.mo-gift-pack", [rays, hagar, box, lid, ...loops]);
    const giver = el("small.mo-gift-from", { text: `${displayName(from, state)}から`, style: { color: P.mid } });
    const title = kinetic(gear.name, "mo-gift-title");
    title.style.color = P.white;
    const caption = el("div.mo-gift-name", [giver, title]);
    node.append(back, spot, pack, fxArt, caption);
    move(back, [{ opacity: 0 }, { opacity: 1 }], 260);
    move(spot, [{ transform: "translate(-50%,-50%) scale(0.3)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], 700, { easing: E.out });
    // 1. 伸びながら落ちて、着地でつぶれる
    await move(pack, [{ transform: "translate(-50%, -680px) scale(0.9, 1.18)" }, { transform: "translate(-50%, 0) scale(1, 1)" }], 440, { easing: E.in });
    SE.pugo();
    burst(fxArt, W / 2 - 140, 548, { n: 3, r0: 10, r1: 50, color: P.light, width: 5, turn: Math.PI * 0.8 });
    burst(fxArt, W / 2 + 140, 548, { n: 3, r0: 10, r1: 50, color: P.light, width: 5, turn: -Math.PI * 0.15 });
    await move(pack, [{ transform: "translate(-50%, 0) scale(1.16, 0.84)" }, { transform: "translate(-50%, 0) scale(0.95, 1.06)" }, { transform: "translate(-50%, 0) scale(1)" }], 340, { easing: "ease-out" });
    // 2. リボンが揺れてほどける
    await Promise.all(loops.map((l, i) => move(l, [{ transform: `rotate(${i ? 30 : -30}deg)` }, { transform: `rotate(${i ? 40 : -40}deg)` }, { transform: `rotate(${i ? 26 : -26}deg)` }, { transform: `rotate(${i ? 30 : -30}deg)` }], 300)));
    loops.forEach((l, i) => move(l, [{ transform: `rotate(${i ? 30 : -30}deg)`, opacity: 1 }, { transform: `translate(${i ? 220 : -220}px, -160px) rotate(${i ? 260 : -260}deg) scale(0.4)`, opacity: 0 }], 480, { easing: E.out }));
    pack.querySelectorAll(".mo-gift-band").forEach((b) => move(b, [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], 260, { easing: E.in, delay: 120 }));
    await sleep(320);
    // 3. ふたが跳ね、紙吹雪と光の中からハガル
    SE.puka();
    move(lid, [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 }, { transform: "translate(170px,-300px) rotate(34deg)", opacity: 0 }], 560, { easing: E.out });
    confetti(fxArt, W / 2, 380, { n: 22, colors: [ribbon, P.light, P.white, P.mid], spread: 330 });
    burst(fxArt, W / 2, 330, { n: 12, r0: 120, r1: 230, color: P.light, width: 6, delay: 60 });
    ring(fxArt, W / 2, 330, { r: 240, color: P.white, width: 8, delay: 40 });
    move(rays, [{ opacity: 0, transform: "translate(-50%,-50%) scale(0.3) rotate(0deg)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(40deg)" }], 900, { easing: E.out });
    await move(hagar, [{ transform: "translate(-50%, 40px) scale(0.3)", opacity: 0 }, { transform: "translate(-50%, -150px) scale(1)", opacity: 1 }], 600, { easing: E.back });
    [[-170, -30], [170, -60], [-120, -210], [150, -230]].forEach(([dx, dy], i) => twinkle(fxArt, W / 2 + dx, 380 + dy, { color: P.light, size: 16, delay: i * 120 }));
    move(giver, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], 300, { easing: E.out });
    await playKinetic(title, { step: 22 });
    await sleep(1100);
    // 4. 退場
    move(caption, [{ opacity: 1 }, { opacity: 0 }], 280);
    move(back, [{ opacity: 1 }, { opacity: 0 }], 420, { delay: 120 });
    move(spot, [{ opacity: 1 }, { opacity: 0 }], 360);
    await move(pack, [{ transform: "translate(-50%, 0) scale(1)", opacity: 1 }, { transform: "translate(-50%, 30px) scale(0.85)", opacity: 0 }], 420, { easing: E.in });
  });
}

// ---------------------------------------------------------------- バイトの終わり: 吊り札が下りて揺れ、くるっと回って CLOSED

const SHIFT = { bg: "#173326", deep: "#0c1c14", main: "#2f9e6b", mid: "#e5484d", light: "#fff3d6", white: "#ffffff" };
const MONO_CLOSED = "#4f3596"; // 紫1色の CLOSED の面（OPEN より濃い紫）

export async function shiftClose() {
  if (skipMotion()) return;
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

// ---------------------------------------------------------------- サメちゃん: 3枚の波が重なって満ち、サメが横切り、波が引いて次の場面

const SHARK = { bg: "#0b3c5d", deep: "#062437", main: "#22b8cf", mid: "#7fe3f0", light: "#e8fbff", white: "#ffffff", fish: "#0a2233" };

function sharkShape(color) {
  const tail = svg("path", { d: "M -150 0 L -230 -62 Q -214 0 -230 62 Z", fill: color });
  const body = svg("path", { d: "M 170 6 C 120 -46, 10 -62, -90 -34 C -130 -22, -150 -8, -158 0 C -150 8, -128 22, -90 30 C 10 52, 120 44, 170 6 Z", fill: color });
  const fin = svg("path", { d: "M -10 -52 L 34 -120 L 46 -46 Z", fill: color });
  const flip = svg("path", { d: "M 30 30 L 0 82 L 70 34 Z", fill: color });
  const eye = svg("circle", { cx: 128, cy: -6, r: 5, fill: "#ffffff" });
  return { g: svg("g", {}, [tail, flip, body, fin, eye]), tail };
}

export async function sharkSwim(mid) {
  if (skipMotion()) { await mid?.(); return; }
  const P = pick(SHARK, { fish: "#120a2a" });
  await stagePlay("shark", async (node) => {
    const wave = (amp) => {
      let d = `M -80 0 `;
      for (let x = -80; x < W + 160; x += 160) d += `q 40 ${-amp} 80 0 t 80 0 `;
      return d + `L ${W + 160} ${H + 1000} L -80 ${H + 1000} Z`;
    };
    const layers = [[P.mid, 26], [P.main, 20], [P.bg, 16]].map(([fill, amp]) => {
      const g = svg("g", {}, [svg("path", { d: wave(amp), fill })]);
      g.style.transform = `translateY(${H + 60}px)`;
      return g;
    });
    const bubbles = svg("g");
    const fx = svg("g");
    const { g: shark, tail } = sharkShape(P.fish);
    const sharkPos = svg("g", { transform: `translate(-320 ${H / 2})` }, [shark]);
    const trail = svg("g", { stroke: P.light, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.8 });
    const art = stageSvg([...layers, bubbles, trail, sharkPos, fx]);
    const caustics = el("div.mo-caustics", { style: { "--c": P.light } });
    node.append(art, caustics);
    const sway = layers.map((g, i) => g.firstChild.animate([{ transform: "translateX(0)" }, { transform: "translateX(-160px)" }], { duration: 800 + i * 260, iterations: Infinity }));
    // 1. 3枚の波が少しずつずれて満ちる
    SE.bubbling();
    await Promise.all(layers.map((g, i) => move(g, [{ transform: `translateY(${H + 60}px)` }, { transform: "translateY(-40px)" }], 560, { easing: E.in, delay: i * 90 })));
    move(caustics, [{ opacity: 0 }, { opacity: 1 }], 300);
    if (mid) await mid();
    for (let i = 0; i < 24; i++) {
      const r = 4 + Math.random() * 13;
      const b = svg("circle", { cx: Math.random() * W, cy: H + 20, r, fill: "none", stroke: P.light, "stroke-width": 2.5, opacity: 0.85 });
      bubbles.append(b);
      b.animate([{ transform: "translate(0,0)" }, { transform: `translate(${(Math.random() - 0.5) * 60}px, ${-(H * (0.7 + Math.random() * 0.6))}px)` }], { duration: 1200 + Math.random() * 600, delay: Math.random() * 500, easing: "ease-out", fill: "both" });
    }
    // 2. サメが尾を振って横切る（後ろに流れる線）
    tail.style.transformBox = "fill-box";
    tail.style.transformOrigin = "right center";
    const wag = tail.animate([{ transform: "rotate(-15deg)" }, { transform: "rotate(15deg)" }], { duration: 200, iterations: Infinity, direction: "alternate" });
    const swim = move(sharkPos, [{ transform: `translate(-320px, ${H / 2 + 24}px)` }, { transform: `translate(${W / 2}px, ${H / 2 - 12}px)`, offset: 0.55 }, { transform: `translate(${W + 340}px, ${H / 2 + 10}px)` }], 1150, { easing: "cubic-bezier(.3,.1,.6,1)" });
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const x = 200 + i * 260, y = H / 2 - 30 + (i % 2) * 60;
        const line = svg("line", { x1: x, y1: y, x2: x - 180, y2: y, pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 });
        trail.append(line);
        move(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0, offset: 0.4 }, { strokeDashoffset: -1 }], 420, { easing: E.out }).then(() => line.remove());
      }, 120 + i * 200);
    }
    setTimeout(() => ring(fx, W / 2 + 120, H / 2 - 10, { r: 120, color: P.light, width: 6 }), 640);
    await swim;
    wag.cancel();
    // 3. 波が手前から順に引き、しぶきが上がる
    SE.bubbling();
    move(caustics, [{ opacity: 1 }, { opacity: 0 }], 260);
    [180, 520, 860, 1120].forEach((x) => confetti(fx, x, 40, { n: 5, colors: [P.light, P.mid], spread: 140 }));
    await Promise.all([...layers].reverse().map((g, i) => move(g, [{ transform: "translateY(-40px)" }, { transform: `translateY(${H + 80}px)` }], 520, { easing: E.in, delay: i * 90 })));
    sway.forEach((a) => a.cancel());
  }, { cover: true });
}

// ---------------------------------------------------------------- スケッチ: 紙が置かれ、鉛筆が店を線画で描き、真ん中から色が広がる

const SKETCH = { bg: "#f6f1e7", deep: "#3a3a44", main: "#f2b544", mid: "#e7dfcf", light: "#ffffff" };

let sketchFilterSerial = 0;
/** 背景の絵から輪郭を取り出し、線の色 ink で紙に描いたような線画にするSVGフィルタ */
function sketchFilter(ink) {
  const id = `mo-sketch-${++sketchFilterSerial}`;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16) / 255);
  const defs = stageSvg([svg("defs", {}, [svg("filter", { id, "color-interpolation-filters": "sRGB" }, [
    svg("feColorMatrix", { type: "saturate", values: "0" }),
    svg("feConvolveMatrix", { order: "3", kernelMatrix: "-1 -1 -1 -1 8 -1 -1 -1 -1", preserveAlpha: "true" }),
    svg("feComponentTransfer", {}, ["R", "G", "B"].map((c) => svg(`feFunc${c}`, { type: "linear", slope: "-3.2", intercept: "1" }))),
    svg("feColorMatrix", { type: "matrix", values: `${1 - r} 0 0 0 ${r}  ${1 - g} 0 0 0 ${g}  ${1 - b} 0 0 0 ${b}  0 0 0 1 0` }),
  ])])]);
  defs.classList.add("mo-defs");
  return { defs, id };
}

/** mid() で背景を差し替える。bgUrl はその背景の絵（線画の元） */
export async function sketchIn(mid, bgUrl) {
  if (skipMotion() || !bgUrl) { await mid?.(); return; }
  const P = pick(SKETCH, { bg: "#efe9fb", deep: "#3d2a78", main: "#8f74d1", mid: "#ddd3f3" });
  const img = new Image();
  img.src = bgUrl;
  await img.decode().catch(() => {});
  await stagePlay("sketch", async (node) => {
    const sheet = el("div.mo-sheet");
    const paper = el("div.mo-paper", { style: { backgroundColor: P.bg, "--grid": P.mid } });
    const { defs, id } = sketchFilter(P.deep);
    const lines = el("img.mo-sketch-lines", { src: bgUrl, alt: "", style: { filter: `url(#${id})` } });
    const pencil = el("div.mo-pencil", { style: { "--p": P.main } }, [el("i.mo-pencil-tip"), el("i.mo-pencil-body"), el("i.mo-pencil-end")]);
    const doodles = stageSvg();
    sheet.append(paper, lines);
    node.append(defs, sheet, doodles, pencil);
    lines.style.clipPath = "inset(0 100% 0 0)";
    // 1. 紙が少し傾いて滑り込み、置かれる
    await move(sheet, [{ transform: "translateY(105%) rotate(5deg)" }, { transform: "translateY(0) rotate(0deg)" }], 520, { easing: E.out });
    if (mid) await mid();
    // 2. 鉛筆が左から右へ、上下に走りながら線を描いていく
    const draw = 1300;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / draw);
        const e = 1 - (1 - k) ** 2;
        lines.style.clipPath = `inset(0 ${100 - e * 100}% 0 0)`;
        pencil.style.transform = `translate(${e * W}px, ${H / 2 + Math.sin(k * Math.PI * 9) * 230}px) rotate(-30deg)`;
        if (k < 1) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    move(pencil, [{ opacity: 1, transform: pencil.style.transform }, { opacity: 0, transform: `translate(${W + 60}px, ${H / 2 - 120}px) rotate(-50deg)` }], 260, { easing: E.in });
    // 3. 四隅に小さな落書きの星が描かれる
    [[90, 90], [W - 90, 110], [110, H - 100]].forEach(([x, y], i) => {
      const star = svg("path", { d: `M ${x} ${y - 22} L ${x + 6} ${y - 6} L ${x + 22} ${y} L ${x + 6} ${y + 6} L ${x} ${y + 22} L ${x - 6} ${y + 6} L ${x - 22} ${y} L ${x - 6} ${y - 6} Z`, fill: "none", stroke: P.main, "stroke-width": 4, "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
      doodles.append(star);
      move(star, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 360, { easing: E.out, delay: i * 90 });
    });
    await sleep(520);
    // 4. 真ん中から色が広がる（紙と線画に穴が開いていく）
    move(doodles, [{ opacity: 1 }, { opacity: 0 }], 300);
    await move(sheet, [{ "--mo-hole": "0%", opacity: 1 }, { "--mo-hole": "80%", opacity: 1, offset: 0.85 }, { "--mo-hole": "120%", opacity: 0 }], 900, { easing: E.in });
  }, { cover: true });
}
