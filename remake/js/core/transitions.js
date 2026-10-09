// 背景の読み込みを覆う、夜の藍・琥珀・煙のモーショングラフィックス。
// 場面の意味ごとの型（CI102）: マップのピンから開く／就寝から翌朝／会場入り・ROUNDの交差。
// 型の一覧と残りの場面の案は asset_sources/transitions/scene-plan-20261009/README.md。
import { el, sleep, nextFrame } from "./util.js";
import { SE } from "./audio.js";

let serial = 0;
const STYLES = ["diagonal", "smoke", "iris"];
const W = 1280;
const H = 720;
const NS = "http://www.w3.org/2000/svg";
const COLOR = { purple: "#6b4fb0", deep: "#34246a", lav: "#dcd1f4", pink: "#f06aae", cyan: "#3fe6f2", teal: "#1fb7c4", ink: "#0b0814" };
const EASE = { in: "cubic-bezier(.55,0,.85,.35)", out: "cubic-bezier(.16,1,.3,1)", snap: "cubic-bezier(.7,0,.2,1)" };
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function svg(tag, attrs = {}, kids = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const kid of kids) node.append(kid);
  return node;
}
function move(node, frames, ms, opt = {}) {
  return node.animate(frames, { duration: ms, easing: EASE.snap, fill: "both", ...opt }).finished.catch(() => {});
}

// 画面を覆っているあいだは Enter・Space で下の会話や画面が進まないようにする
const blockKey = (e) => {
  if (["Enter", " "].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); }
};
function holdKeys() {
  window.addEventListener("keydown", blockKey, true);
  return () => window.removeEventListener("keydown", blockKey, true);
}

// 全面を覆う型の数。覆っている間の背景切り替えは、別の幕を出さずに差し替える（ui.setBg）
let covering = 0;
export const isCovering = () => covering > 0;
function holdCover() {
  covering++;
  const release = holdKeys();
  let done = false;
  return () => { if (done) return; done = true; covering--; release(); };
}

// 次の背景切り替えで使う型の予約。マップで押したピンの位置などを渡す。古い予約は使わない
let cue = null;
export function cueTransition(kind, opts = {}) {
  cue = { kind, opts, at: performance.now() };
}
function takeCue() {
  const c = cue;
  cue = null;
  return c && performance.now() - c.at < 3000 ? c : null;
}

export function createSceneCurtain(host, { fast = false } = {}) {
  const reduced = reducedMotion();
  const cued = takeCue();
  if (cued?.kind === "pin" && !fast && !reduced) return pinCurtain(host, cued.opts);
  const ms = fast || reduced ? 45 : 260;
  const variant = STYLES[serial++ % STYLES.length];
  const node = el(`div.scene-curtain.${variant}`, { "aria-hidden": "true", style: { "--st-ms": `${ms}ms` }, dataset: { transition: variant } }, [
    el("div.st-field"),
    el("div.st-lines", [el("b"), el("b"), el("b")]),
    el("div.st-orbit", [el("b"), el("b")]),
    el("div.st-sign", [el("span", { text: "水煙前線" }), el("small", { text: "SUIEN ZENSEN" })]),
  ]);
  const unhold = holdKeys();
  host.append(node);
  const covered = (async () => { await nextFrame(); node.classList.add("cover"); await sleep(ms); })();
  let released = false;
  return { covered, async release() {
    if (released) return;
    released = true;
    await covered;
    // 次の背景・画面・台詞を幕の内側で描いてから開く。
    await nextFrame(); await nextFrame();
    node.classList.add("reveal");
    await sleep(ms + 30);
    node.remove();
    unhold();
  } };
}

// ---------------------------------------------------------------- 開口: マップのピンから広がり、中央の窓が開く

let maskSerial = 0;
/** 葉の形の窓。scale(0)で閉じ、scale(1.2)で画面の四隅の外まで開く */
function leafWindow(color, edge) {
  const id = `tr-leaf-${++maskSerial}`;
  const d = "M -560 360 C 160 -460, 1120 -460, 1840 360 C 1120 1180, 160 1180, -560 360 Z";
  const turn = `rotate(-18 ${W / 2} ${H / 2})`;
  const hole = svg("path", { d, fill: "#000", class: "tr-scale" });
  const ring = svg("path", { d, fill: "none", stroke: edge, "stroke-width": 6, "vector-effect": "non-scaling-stroke", class: "tr-scale" });
  hole.style.transform = ring.style.transform = "scale(0)";
  const box = { x: -300, y: -300, width: W + 600, height: H + 600 };
  const art = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg" }, [
    svg("defs", {}, [svg("mask", { id, maskUnits: "userSpaceOnUse", ...box }, [
      svg("rect", { ...box, fill: "#fff" }),
      svg("g", { transform: turn }, [hole]),
    ])]),
    svg("rect", { ...box, fill: color, mask: `url(#${id})` }),
    svg("g", { transform: turn }, [ring]),
  ]);
  return { art, hole, ring };
}

function pinCurtain(host, { x = W / 2, y = H / 2 } = {}) {
  const r = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 30;
  const edge = svg("circle", { cx: x, cy: y, r, fill: COLOR.lav, class: "tr-scale" });
  const fill = svg("circle", { cx: x, cy: y, r, fill: COLOR.purple, class: "tr-scale" });
  edge.style.transform = fill.style.transform = "scale(0)";
  const node = el("div.scene-curtain.pin", { "aria-hidden": "true", dataset: { transition: "pin" } });
  node.append(svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg" }, [edge, fill]));
  const unhold = holdKeys();
  host.append(node);
  const grow = [{ transform: "scale(0)" }, { transform: "scale(1)" }];
  const covered = (async () => {
    await nextFrame();
    move(edge, grow, 290, { easing: EASE.in });
    await move(fill, grow, 290, { easing: EASE.in, delay: 60 });
  })();
  let released = false;
  return { covered, async release() {
    if (released) return;
    released = true;
    await covered;
    await nextFrame(); await nextFrame();
    const win = leafWindow(COLOR.purple, COLOR.lav);
    node.replaceChildren(win.art);
    move(win.ring, [{ transform: "scale(0)", opacity: 1 }, { transform: "scale(1.2)", opacity: 0 }], 400, { easing: EASE.out });
    await move(win.hole, [{ transform: "scale(0)" }, { transform: "scale(1.2)" }], 380, { easing: EASE.out });
    node.remove();
    unhold();
  } };
}

// ---------------------------------------------------------------- 波＋めくり: 就寝 → 翌朝

function flipNumber(from, to) {
  const span = el("span.tr-flip", [el("i", { text: String(from) }), el("i", { text: String(to) })]);
  span.lastChild.style.transform = "rotateX(-90deg)";
  span.lastChild.style.opacity = "0";
  return span;
}
async function flip(span) {
  const [before, after] = span.children;
  await move(before, [{ transform: "rotateX(0)", opacity: 1 }, { transform: "rotateX(90deg)", opacity: 0 }], 170, { easing: EASE.in });
  await move(after, [{ transform: "rotateX(-90deg)", opacity: 0 }, { transform: "rotateX(0)", opacity: 1 }], 230, { easing: EASE.out });
}

/** 下の縁が丸く波打つ夜の面（上から降りてくる） */
function nightPath() {
  const step = W / 5;
  let d = `M -40 -1200 L -40 0 `;
  for (let i = 0; i < 5; i++) {
    const x = -40 + i * (step + 16);
    d += `C ${x} 150, ${x + step + 16} 150, ${x + step + 16} 0 `;
  }
  return d + `L ${W + 60} -1200 Z`;
}

/**
 * 夜の紫が上から降りて眠りにつき、DAYと残り日数が1つめくれ、ラベンダーの地平線が下から昇って朝が出る。
 * mid() は覆っている間に日付を進め、{ fromDay, day, fromLeft, left, rain, sick } を返す。
 */
export async function nightToMorning(host, mid) {
  const reduced = reducedMotion();
  const unhold = holdCover();
  const node = el("div.tr-dawn", { "aria-hidden": "true", dataset: { transition: "dawn" } });
  host.append(node);
  try {
    const veil = el("div.tr-dawn-veil");
    if (reduced) {
      node.append(veil);
      await move(veil, [{ opacity: 0 }, { opacity: 1 }], 260, { easing: "ease" });
    } else {
      const fall = svg("g", {}, [svg("path", { d: nightPath(), fill: COLOR.lav, transform: "translate(0 34)" }), svg("path", { d: nightPath(), fill: COLOR.deep })]);
      fall.style.transform = "translateY(-200px)";
      const art = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg" }, [fall]);
      node.append(art);
      await nextFrame();
      await move(fall, [{ transform: "translateY(-200px)" }, { transform: "translateY(760px)" }], 540, { easing: EASE.in });
      node.replaceChildren(veil);
    }
    const info = await mid();
    if (!info) return;
    const dayFlip = flipNumber(info.fromDay, info.day);
    const leftFlip = flipNumber(info.fromLeft, info.left);
    const sub = info.sick
      ? el("div.tr-dawn-sub", [el("span", { text: "……熱っぽい" })])
      : el("div.tr-dawn-sub", [el("span", { text: "SMOKE CROWN CUP まで あと" }), leftFlip, el("span", { text: `日${info.rain ? "　☂ 雨" : ""}` })]);
    const card = el("div.tr-dawn-card", { dataset: { test: "dawn-card" } }, [el("div.tr-dawn-day", [el("small", { text: "DAY" }), dayFlip]), sub]);
    if (info.sick) node.classList.add("sick");
    if (info.rain && !reduced) {
      const rain = el("div.tr-dawn-rain");
      for (let i = 0; i < 26; i++) {
        const drop = el("i", { style: { left: `${Math.random() * 115 - 10}%`, height: `${14 + Math.random() * 12}%` } });
        rain.append(drop);
        drop.animate([{ translate: "0 0" }, { translate: "-150px 1150px" }], { duration: 560 + Math.random() * 240, delay: Math.random() * 600, iterations: Infinity, easing: "linear" });
      }
      node.append(rain);
    }
    node.append(card);
    if (reduced) {
      [dayFlip, leftFlip].forEach((s) => { s.firstChild.remove(); s.firstChild.style.transform = ""; s.firstChild.style.opacity = ""; });
      await move(card, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease" });
      await sleep(1300);
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 300, { easing: "ease" });
      return;
    }
    await move(card, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], 320, { easing: EASE.out });
    if (info.sick) {
      card.animate([
        { transform: "skewX(0deg) scale(1)", filter: "blur(0)" },
        { transform: "skewX(3deg) scale(1.02)", filter: "blur(1.2px)" },
        { transform: "skewX(-2deg) scale(.99)", filter: "blur(.4px)" },
        { transform: "skewX(0deg) scale(1)", filter: "blur(0)" },
      ], { duration: 900, iterations: Infinity, easing: "ease-in-out" });
    }
    await sleep(220);
    SE.tick();
    await Promise.all([flip(dayFlip), info.sick ? null : sleep(90).then(() => flip(leftFlip))]);
    await sleep(info.sick ? 1100 : 650);
    const horizon = el("div.tr-dawn-horizon");
    node.append(horizon);
    const up = 760;
    move(card, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-18px)" }], 300, { easing: EASE.in });
    const rain = node.querySelector(".tr-dawn-rain");
    if (rain) move(rain, [{ opacity: 1 }, { opacity: 0.4 }], up);
    move(horizon, [{ bottom: "0%", opacity: 1 }, { bottom: "100%", opacity: 0.5 }], up);
    await move(veil, [{ clipPath: "inset(0 0 0% 0)" }, { clipPath: "inset(0 0 100% 0)" }], up);
    const glow = el("div.tr-dawn-glow");
    node.append(glow);
    node.style.pointerEvents = "none";
    await move(glow, [{ opacity: 1 }, { opacity: 0 }], 560, { easing: EASE.out });
  } finally {
    node.remove();
    unhold();
  }
}

// ---------------------------------------------------------------- 交差: 会場入り・ROUND

const CROSS_PALETTE = {
  venue: { a: COLOR.purple, b: COLOR.pink, edge: COLOR.lav },
  1: { a: COLOR.purple, b: COLOR.lav, edge: COLOR.lav },
  2: { a: COLOR.pink, b: COLOR.lav, edge: "#ffd7eb" },
  3: { a: COLOR.teal, b: COLOR.purple, edge: COLOR.cyan },
};

/**
 * 逆向きの斜めのリボン2本が滑り込んで交差し、交点に見出しを打ち込む。
 * full: 画面を完全に覆い、覆っている間に mid()（背景・BGMの差し替え）を実行する
 */
export async function crossCut(host, { title, sub = "", palette = "venue", full = false, mid = null } = {}) {
  const reduced = reducedMotion();
  const c = CROSS_PALETTE[palette] || CROSS_PALETTE.venue;
  const unhold = full ? holdCover() : holdKeys();
  const back = svg("rect", { x: -100, y: -100, width: W + 200, height: H + 200, fill: COLOR.ink });
  back.style.opacity = "0";
  const ribbonA = svg("g", {}, [svg("rect", { x: -320, y: 180, width: W + 640, height: 200, fill: c.a }), svg("rect", { x: -320, y: 348, width: W + 640, height: 12, fill: c.edge })]);
  const ribbonB = svg("g", {}, [svg("rect", { x: -320, y: 330, width: W + 640, height: 184, fill: c.b }), svg("rect", { x: -320, y: 330, width: W + 640, height: 6, fill: "#ffffff", opacity: 0.7 })]);
  ribbonA.style.filter = `drop-shadow(0 0 16px ${c.a})`;
  ribbonB.style.filter = `drop-shadow(0 0 16px ${c.b})`;
  ribbonA.style.transform = "translateX(-1900px)";
  ribbonB.style.transform = "translateX(1900px)";
  const big = el("b", { text: title });
  const small = sub ? el("small", { text: sub }) : null;
  big.style.textShadow = `0 4px 0 #1d1236, 0 0 3px #1d1236, 0 0 26px ${c.edge}`;
  const label = el("div.tr-cross-title", [big, small]);
  label.style.opacity = "0";
  const node = el(`div.tr-cross${full ? ".full" : ""}`, { "aria-hidden": "true", dataset: { transition: "cross" } }, [
    svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg" }, [
      back,
      svg("g", { transform: `rotate(-13 ${W / 2} ${H / 2})` }, [ribbonA]),
      svg("g", { transform: `rotate(13 ${W / 2} ${H / 2})` }, [ribbonB]),
    ]),
    label,
  ]);
  host.append(node);
  const dim = full ? 1 : 0.82;
  try {
    await nextFrame();
    SE.whoosh();
    if (reduced) {
      ribbonA.style.transform = ribbonB.style.transform = "none";
      await move(back, [{ opacity: 0 }, { opacity: dim }], 240, { easing: "ease" });
      if (mid) await mid();
      await move(label, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease" });
      await sleep(1000);
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 300, { easing: "ease" });
      return;
    }
    move(back, [{ opacity: 0 }, { opacity: dim }], 340, { easing: EASE.out });
    move(ribbonA, [{ transform: "translateX(-1900px)" }, { transform: "translateX(0)" }], 360, { easing: EASE.out });
    await move(ribbonB, [{ transform: "translateX(1900px)" }, { transform: "translateX(0)" }], 360, { easing: EASE.out, delay: 70 });
    if (mid) await mid();
    label.style.opacity = "";
    move(big, [{ opacity: 0, transform: "scale(1.9)" }, { opacity: 1, transform: "scale(1)" }], 220, { easing: EASE.in });
    if (small) move(small, [{ opacity: 0, transform: "translateX(-70px)" }, { opacity: 1, transform: "none" }], 380, { easing: EASE.out, delay: 160 });
    await sleep(210);
    SE.stamp();
    node.animate([{ transform: "translate(0,0)" }, { transform: "translate(-6px,3px)" }, { transform: "translate(5px,-2px)" }, { transform: "translate(0,0)" }], { duration: 160, easing: "steps(3)" });
    await sleep(950);
    move(label, [{ opacity: 1 }, { opacity: 0 }], 220);
    move(ribbonA, [{ transform: "translateX(0)" }, { transform: "translateX(1900px)" }], 420, { easing: EASE.in });
    move(ribbonB, [{ transform: "translateX(0)" }, { transform: "translateX(-1900px)" }], 420, { easing: EASE.in, delay: 50 });
    node.style.pointerEvents = "none";
    await move(back, [{ opacity: dim }, { opacity: 0 }], 500, { easing: EASE.in, delay: 140 });
  } finally {
    node.remove();
    unhold();
  }
}
