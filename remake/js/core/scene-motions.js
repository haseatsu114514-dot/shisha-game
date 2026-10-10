// 場面ごとの一度きりのモーショングラフィックス（CI107）。
// チェキ（PEPPERMINT）／占いのタロット／締めくくりの贈り物／バイトの終わり／サメちゃんとの出会い／つむぎのスケッチ。
// 画像を使わず図形で描く（チェキの写真・ハガル・背景だけ既存の絵を使う）。SKIP中と動きを減らす設定では省く。
import { el, sleep, nextFrame } from "./util.js";
import { SE } from "./audio.js";
import { state } from "./state.js";
import { DB, displayName, faceIconUrl, makingUrl } from "./data.js";
import { W, H, EASE, svg, stageSvg, move, holdKeys, reducedMotion } from "./transition-kit.js";
import { holdCover } from "./transitions.js";

const BACK = "cubic-bezier(.34,1.56,.64,1)"; // 少し行きすぎて戻る
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

/** 4つの尖った星（きらめき）を pos の周りに散らす */
function sparkles(node, cx, cy, { n = 8, spread = 220, color = "#ffe9a8" } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const d = spread * (0.6 + Math.random() * 0.5);
    const s = el("i.mo-spark", { style: { left: `${cx}px`, top: `${cy}px`, background: color } });
    node.append(s);
    move(s, [{ transform: "translate(-50%,-50%) scale(0) rotate(0deg)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1) rotate(90deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.15}px), calc(-50% + ${Math.sin(a) * d * 1.15}px)) scale(0) rotate(160deg)`, opacity: 0 }],
    700 + Math.random() * 300, { easing: EASE.out, delay: Math.random() * 120 });
  }
}

// ---------------------------------------------------------------- チェキ: ファインダー → シャッター → フラッシュ → フィルムが出てきて現像される

/** 会話のCGレイヤーと同じ位置・大きさ（vn.css の縦型チェキ: 高さ 100%-230px、上から18px） */
function chekiBox(img) {
  const h = H - 230;
  const w = Math.round(h * (img.naturalWidth / img.naturalHeight || 0.75));
  return { left: (W - w) / 2, top: 18, width: w, height: h };
}

/** placeCg(): 現像し終えた瞬間に、会話のCGを同じ位置へ置く（重ねたフィルムを外す前に呼ぶ） */
export async function chekiShot(url, placeCg = null) {
  if (skipMotion() || !url) return;
  const img = new Image();
  img.src = url;
  await img.decode().catch(() => {});
  await stagePlay("cheki", async (node) => {
    const box = chekiBox(img);
    const back = el("div.mo-cheki-back");
    const frame = el("div.mo-finder", [el("i"), el("i"), el("i"), el("i"), el("b.mo-finder-focus")]);
    // 6枚の羽根。内側の縁が中心から760px（画面の外）にあり、中心まで滑り込んで閉じる
    const blades = stageSvg([...Array(6)].map((_, i) => svg("g", { transform: `rotate(${i * 60 + 18} ${W / 2} ${H / 2})` }, [
      svg("rect", { x: W / 2 - 1000, y: H / 2 - 760 - 1100, width: 2000, height: 1100, fill: i % 2 ? "#1b1720" : "#141118", stroke: "#2c2633", "stroke-width": 4, class: "mo-blade" }),
    ])));
    blades.classList.add("mo-iris");
    const flashEl = el("div.mo-flash");
    const film = el("img.mo-film", { src: url, alt: "", style: { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, opacity: "0" } });
    node.append(back, frame, blades, flashEl, film);
    // ファインダーの四隅が寄る
    await move(frame, [{ transform: "scale(1.5)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], 260, { easing: BACK });
    await sleep(380);
    // シャッターの羽根が閉じる
    SE.punch();
    const close = [...blades.querySelectorAll(".mo-blade")].map((b) => move(b, [{ transform: "translate(0,0)" }, { transform: "translate(0, 770px)" }], 150, { easing: EASE.in }));
    await Promise.all(close);
    back.style.opacity = "1";
    frame.remove();
    move(flashEl, [{ opacity: 1 }, { opacity: 0 }], 380, { easing: EASE.out });
    await move(blades, [{ opacity: 1 }, { opacity: 0 }], 120);
    blades.remove();
    // フィルムが下から出てきて、白いところから現像されていく
    SE.pour();
    film.style.opacity = "";
    await move(film, [{ transform: "translateY(110%) rotate(-5deg)" }, { transform: "translateY(0) rotate(-2deg)" }], 620, { easing: BACK });
    await move(film, [
      { transform: "rotate(-2deg)", filter: "brightness(2.1) saturate(0) contrast(0.25)" },
      { transform: "rotate(0deg)", filter: "brightness(1.4) saturate(0.4) contrast(0.6)", offset: 0.45 },
      { transform: "rotate(0deg)", filter: "none" }], 1500, { easing: "ease-out" });
    placeCg?.();
  });
}

// ---------------------------------------------------------------- 占い: 3枚の札が並び、真ん中が裏返って相手との縁を示す

function tarotCard(i) {
  return el("div.mo-tarot-card", { style: { "--i": String(i) } }, [el("div.mo-tarot-flip", [
    el("div.mo-tarot-back", [el("i.mo-tarot-moon"), el("b.mo-tarot-star"), el("b.mo-tarot-star.s2"), el("b.mo-tarot-star.s3")]),
  ])]);
}

export async function tarotFlip(charId = state?.fortune?.char) {
  if (skipMotion()) return;
  await stagePlay("tarot", async (node) => {
    const dim = el("div.mo-dim");
    const cards = [0, 1, 2].map(tarotCard);
    const face = faceIconUrl(charId, state);
    const front = el("div.mo-tarot-front", [
      el("small", { text: "THREAD OF FATE" }),
      el("div.mo-tarot-face", [face ? el("img", { src: face, alt: "" }) : el("b", { text: "？" })]),
      el("b.mo-tarot-name", { text: charId ? displayName(charId, state) : "その人" }),
      el("small", { text: "縁" }),
    ]);
    cards[1].firstChild.append(front);
    const rays = el("div.mo-rays");
    node.append(dim, rays, ...cards);
    move(dim, [{ opacity: 0 }, { opacity: 1 }], 220);
    const xs = [-230, 0, 230], rot = [-9, 0, 9];
    await Promise.all(cards.map((c, i) => move(c, [
      { transform: `translate(-50%, 380px) rotate(${rot[i] * 3}deg)`, opacity: 0 },
      { transform: `translate(calc(-50% + ${xs[i]}px), 0) rotate(${rot[i]}deg)`, opacity: 1 }], 460, { easing: BACK, delay: i * 90 })));
    SE.tick();
    await sleep(420);
    move(cards[0], [{ transform: `translate(calc(-50% - 230px), 0) rotate(-9deg)`, opacity: 1 }, { transform: `translate(calc(-50% - 420px), 30px) rotate(-20deg)`, opacity: 0 }], 300, { easing: EASE.in });
    move(cards[2], [{ transform: `translate(calc(-50% + 230px), 0) rotate(9deg)`, opacity: 1 }, { transform: `translate(calc(-50% + 420px), 30px) rotate(20deg)`, opacity: 0 }], 300, { easing: EASE.in });
    await move(cards[1], [{ transform: "translate(-50%, 0) scale(1)" }, { transform: "translate(-50%, -10px) scale(1.18)" }], 260, { easing: EASE.out });
    // くるっと裏返す
    await move(cards[1].firstChild, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], 460, { easing: EASE.snap });
    SE.just();
    move(rays, [{ opacity: 0, transform: "translate(-50%,-50%) scale(0.4) rotate(0deg)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(25deg)" }], 600, { easing: EASE.out });
    sparkles(node, W / 2, H / 2 - 20, { n: 10, spread: 260 });
    await sleep(1100);
    move(rays, [{ opacity: 1 }, { opacity: 0 }], 300);
    move(dim, [{ opacity: 1 }, { opacity: 0 }], 380, { delay: 120 });
    await move(cards[1], [{ transform: "translate(-50%, -10px) scale(1.18)", opacity: 1 }, { transform: "translate(-50%, -60px) scale(0.9)", opacity: 0 }], 380, { easing: EASE.in });
  });
}

// ---------------------------------------------------------------- 贈り物: 箱が落ちてきて、リボンがほどけ、光の中から専用ハガル

export async function giftOpen(giftId) {
  const gear = DB.equipById?.[giftId];
  if (skipMotion() || !gear) return;
  const from = gear.gift?.from;
  const color = DB.manifest?.introArt?.[from]?.color || "#f06aae";
  const art = makingUrl("bowl_empty_clay.png");
  await stagePlay("gift", async (node) => {
    const dim = el("div.mo-dim.warm");
    const rays = el("div.mo-rays");
    const hagar = art ? el("img.mo-gift-item", { src: art, alt: "" }) : el("b.mo-gift-item");
    const lid = el("div.mo-gift-lid", { style: { "--c": color } }, [el("i.mo-gift-band")]);
    const loops = [el("i.mo-gift-loop.l", { style: { "--c": color } }), el("i.mo-gift-loop.r", { style: { "--c": color } })];
    const box = el("div.mo-gift-box", { style: { "--c": color } }, [el("i.mo-gift-band")]);
    const name = el("div.mo-gift-name", [el("small", { text: `${displayName(from, state)}から` }), el("b", { text: gear.name })]);
    const pack = el("div.mo-gift-pack", [rays, hagar, box, lid, ...loops]);
    node.append(dim, pack, name);
    move(dim, [{ opacity: 0 }, { opacity: 1 }], 260);
    // 上から落ちて、着地でつぶれる
    await move(pack, [{ transform: "translate(-50%, -620px)" }, { transform: "translate(-50%, 0)" }], 460, { easing: EASE.in });
    SE.pugo();
    await move(pack, [{ transform: "translate(-50%, 0) scale(1.12, 0.86)" }, { transform: "translate(-50%, 0) scale(0.96, 1.05)" }, { transform: "translate(-50%, 0) scale(1)" }], 300, { easing: "ease-out" });
    await sleep(240);
    // リボンがほどけて飛ぶ
    move(loops[0], [{ transform: "rotate(-30deg)", opacity: 1 }, { transform: "translate(-180px,-120px) rotate(-200deg) scale(0.6)", opacity: 0 }], 420, { easing: EASE.out });
    move(loops[1], [{ transform: "rotate(30deg)", opacity: 1 }, { transform: "translate(180px,-120px) rotate(200deg) scale(0.6)", opacity: 0 }], 420, { easing: EASE.out });
    pack.querySelectorAll(".mo-gift-band").forEach((b) => move(b, [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], 260, { easing: EASE.in, delay: 120 }));
    await sleep(300);
    // ふたが跳ね上がり、光の中からハガル
    SE.puka();
    move(lid, [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 }, { transform: "translate(150px,-260px) rotate(28deg)", opacity: 0 }], 520, { easing: EASE.out });
    move(rays, [{ opacity: 0, transform: "translate(-50%,-50%) scale(0.3)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1) rotate(30deg)" }], 700, { easing: EASE.out });
    await move(hagar, [{ transform: "translate(-50%, 40px) scale(0.3)", opacity: 0 }, { transform: "translate(-50%, -150px) scale(1)", opacity: 1 }], 560, { easing: BACK });
    sparkles(node, W / 2, H / 2 - 60, { n: 12, spread: 240, color: "#fff4cf" });
    await move(name, [{ opacity: 0, transform: "translate(-50%, 16px)" }, { opacity: 1, transform: "translate(-50%, 0)" }], 320, { easing: EASE.out });
    await sleep(1300);
    move(dim, [{ opacity: 1 }, { opacity: 0 }], 420, { delay: 100 });
    move(name, [{ opacity: 1 }, { opacity: 0 }], 300);
    await move(pack, [{ opacity: 1 }, { opacity: 0 }], 420);
  });
}

// ---------------------------------------------------------------- バイトの終わり: OPEN の札が CLOSED に裏返り、時計が早回り

export async function shiftClose() {
  if (skipMotion()) return;
  await stagePlay("shift", async (node) => {
    const dim = el("div.mo-dim.evening");
    const minute = el("i.mo-clock-hand.m"), hour = el("i.mo-clock-hand.h");
    const clock = el("div.mo-clock", [...[...Array(12)].map((_, i) => el("b.mo-clock-tick", { style: { transform: `rotate(${i * 30}deg)` } })), hour, minute, el("i.mo-clock-pin")]);
    const sign = el("div.mo-sign", [el("i.mo-sign-string"), el("div.mo-sign-card", [
      el("div.mo-sign-face.open", [el("small", { text: "tonari" }), el("b", { text: "OPEN" })]),
      el("div.mo-sign-face.closed", [el("small", { text: "tonari" }), el("b", { text: "CLOSED" })]),
    ])]);
    node.append(dim, clock, sign);
    move(dim, [{ opacity: 0 }, { opacity: 1 }], 260);
    move(clock, [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], 380, { easing: BACK, delay: 120 });
    await move(sign, [{ transform: "translate(-50%, -520px)" }, { transform: "translate(-50%, 0)" }], 420, { easing: BACK });
    const swing = sign.animate([{ transform: "translate(-50%,0) rotate(0deg)" }, { transform: "translate(-50%,0) rotate(6deg)" }, { transform: "translate(-50%,0) rotate(-4deg)" }, { transform: "translate(-50%,0) rotate(2deg)" }, { transform: "translate(-50%,0) rotate(0deg)" }], { duration: 900, easing: "ease-out" });
    // 時計が早回りして、閉店の時刻へ
    for (let i = 0; i < 6; i++) setTimeout(() => SE.tick(), i * 150);
    move(minute, [{ transform: "rotate(0deg)" }, { transform: "rotate(2160deg)" }], 1000, { easing: "cubic-bezier(.45,0,.3,1)" });
    await move(hour, [{ transform: "rotate(60deg)" }, { transform: "rotate(240deg)" }], 1000, { easing: "cubic-bezier(.45,0,.3,1)" });
    swing.cancel();
    const card = sign.querySelector(".mo-sign-card");
    SE.select();
    await move(card, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], 420, { easing: BACK });
    await sleep(650);
    move(clock, [{ opacity: 1 }, { opacity: 0, transform: "scale(0.6)" }], 260);
    move(dim, [{ opacity: 1 }, { opacity: 0 }], 380, { delay: 100 });
    await move(sign, [{ transform: "translate(-50%, 0)" }, { transform: "translate(-50%, -560px)" }], 380, { easing: EASE.in });
  });
}

// ---------------------------------------------------------------- サメちゃん: 水が満ちて、サメが横切り、泡がはじけて次の場面

function sharkShape() {
  const tail = svg("path", { d: "M -150 0 L -230 -62 Q -214 0 -230 62 Z", fill: "#0b2d45" });
  const body = svg("path", { d: "M 170 6 C 120 -46, 10 -62, -90 -34 C -130 -22, -150 -8, -158 0 C -150 8, -128 22, -90 30 C 10 52, 120 44, 170 6 Z", fill: "#0b2d45" });
  const fin = svg("path", { d: "M -10 -52 L 34 -120 L 46 -46 Z", fill: "#0b2d45" });
  const flip = svg("path", { d: "M 30 30 L 0 82 L 70 34 Z", fill: "#0b2d45" });
  const eye = svg("circle", { cx: 128, cy: -6, r: 5, fill: "#dff7f7" });
  const g = svg("g", {}, [tail, flip, body, fin, eye]);
  return { g, tail };
}

export async function sharkSwim(mid) {
  if (skipMotion()) { await mid?.(); return; }
  await stagePlay("shark", async (node) => {
    const wave = (y) => {
      let d = `M -60 ${y} `;
      for (let x = -60; x < W + 120; x += 160) d += `q 40 -26 80 0 t 80 0 `;
      return d + `L ${W + 120} ${H + 900} L -60 ${H + 900} Z`;
    };
    const waterBack = svg("path", { d: wave(0), fill: "#5fd0d8", opacity: 0.9 });
    const waterFront = svg("path", { d: wave(16), fill: "url(#mo-sea)" });
    const water = svg("g", {}, [waterBack, waterFront]);
    water.style.transform = `translateY(${H + 40}px)`;
    const { g: shark, tail } = sharkShape();
    const sharkPos = svg("g", { transform: `translate(-300 ${H / 2})` }, [shark]);
    const bubbles = svg("g");
    const art = stageSvg([
      svg("defs", {}, [svg("linearGradient", { id: "mo-sea", x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg("stop", { offset: "0", "stop-color": "#1aa6b7" }), svg("stop", { offset: "0.55", "stop-color": "#0c6680" }), svg("stop", { offset: "1", "stop-color": "#08394f" }),
      ])]),
      water, bubbles, sharkPos,
    ]);
    const rays = el("div.mo-sea-rays");
    node.append(art, rays);
    const waveSway = waterBack.animate([{ transform: "translateX(0)" }, { transform: "translateX(-160px)" }], { duration: 900, iterations: Infinity });
    SE.bubbling();
    await move(water, [{ transform: `translateY(${H + 40}px)` }, { transform: "translateY(-40px)" }], 520, { easing: EASE.in });
    move(rays, [{ opacity: 0 }, { opacity: 1 }], 300);
    if (mid) await mid();
    // 泡
    for (let i = 0; i < 26; i++) {
      const r = 4 + Math.random() * 14;
      const b = svg("circle", { cx: Math.random() * W, cy: H + 20, r, fill: "none", stroke: "#dff7f7", "stroke-width": 2.5, opacity: 0.8 });
      bubbles.append(b);
      b.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-(H * (0.7 + Math.random() * 0.6))}px)` }], { duration: 1200 + Math.random() * 600, delay: Math.random() * 600, easing: "ease-out", fill: "both" });
    }
    // サメが横切る（尾を振りながら）
    tail.style.transformBox = "fill-box";
    tail.style.transformOrigin = "right center";
    const tailWag = tail.animate([{ transform: "rotate(-14deg)" }, { transform: "rotate(14deg)" }], { duration: 220, iterations: Infinity, direction: "alternate" });
    await move(sharkPos, [{ transform: `translate(-300px, ${H / 2 + 20}px)` }, { transform: `translate(${W / 2}px, ${H / 2 - 10}px)`, offset: 0.55 }, { transform: `translate(${W + 320}px, ${H / 2 + 10}px)` }], 1150, { easing: "cubic-bezier(.3,.1,.6,1)" });
    tailWag.cancel();
    SE.bubbling();
    move(rays, [{ opacity: 1 }, { opacity: 0 }], 300);
    await move(water, [{ transform: "translateY(-40px)" }, { transform: `translateY(${H + 60}px)` }], 520, { easing: EASE.in });
    waveSway.cancel();
  }, { cover: true });
}

// ---------------------------------------------------------------- スケッチ: 紙の上に鉛筆の線で場面が描かれ、色が乗る

let sketchFilterSerial = 0;
function sketchFilter() {
  const id = `mo-sketch-${++sketchFilterSerial}`;
  const defs = stageSvg([svg("defs", {}, [svg("filter", { id, "color-interpolation-filters": "sRGB" }, [
    svg("feColorMatrix", { type: "saturate", values: "0" }),
    svg("feConvolveMatrix", { order: "3", kernelMatrix: "-1 -1 -1 -1 8 -1 -1 -1 -1", preserveAlpha: "true" }),
    svg("feComponentTransfer", {}, ["R", "G", "B"].map((c) => svg(`feFunc${c}`, { type: "linear", slope: "-3.2", intercept: "1" }))),
    svg("feColorMatrix", { type: "matrix", values: "0.85 0 0 0 0.05  0 0.85 0 0 0.06  0 0 0.9 0 0.09  0 0 0 1 0" }),
  ])])]);
  defs.classList.add("mo-defs");
  return { defs, id };
}

/** mid() で背景を差し替える。bgUrl はその背景の絵（線画の元） */
export async function sketchIn(mid, bgUrl) {
  if (skipMotion() || !bgUrl) { await mid?.(); return; }
  const img = new Image();
  img.src = bgUrl;
  await img.decode().catch(() => {});
  await stagePlay("sketch", async (node) => {
    const paper = el("div.mo-paper");
    const { defs, id } = sketchFilter();
    const lines = el("img.mo-sketch-lines", { src: bgUrl, alt: "", style: { filter: `url(#${id})` } });
    const pencil = el("div.mo-pencil", [el("i.mo-pencil-tip"), el("i.mo-pencil-body"), el("i.mo-pencil-end")]);
    node.append(defs, paper, lines, pencil);
    lines.style.clipPath = "inset(0 100% 0 0)";
    await move(paper, [{ opacity: 0, transform: "scale(1.04)" }, { opacity: 1, transform: "scale(1)" }], 320, { easing: EASE.out });
    if (mid) await mid();
    // 鉛筆が左から右へ、上下に走りながら線を描いていく
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
    move(pencil, [{ opacity: 1 }, { opacity: 0 }], 200);
    await sleep(260);
    // 色が乗る（紙と線画が透けていく）
    move(lines, [{ opacity: 1 }, { opacity: 0 }], 760, { easing: "ease-in-out" });
    await move(paper, [{ opacity: 1 }, { opacity: 0 }], 760, { easing: "ease-in-out", delay: 60 });
  }, { cover: true });
}
