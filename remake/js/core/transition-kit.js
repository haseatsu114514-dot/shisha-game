// トランジションの共通部品（座標・色・SVG・アニメーション・入力の抑止）。
// 型そのものは transitions.js（夜明け・標準の幕）と transition-moves.js（マップ→場所）。
import { el, nextFrame } from "./util.js";

export const W = 1280;
export const H = 720;
export const NS = "http://www.w3.org/2000/svg";
export const COLOR = { purple: "#6b4fb0", deep: "#34246a", lav: "#dcd1f4", pink: "#f06aae", ink: "#0b0814", shadow: "#150f26", warm: "#fff1d2" };
export const EASE = { in: "cubic-bezier(.55,0,.85,.35)", out: "cubic-bezier(.16,1,.3,1)", snap: "cubic-bezier(.7,0,.2,1)" };
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function svg(tag, attrs = {}, kids = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const kid of kids) if (kid) node.append(kid);
  return node;
}
export const stageSvg = (kids = []) => svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "tr-svg" }, kids);

export function move(node, frames, ms, opt = {}) {
  return node.animate(frames, { duration: ms, easing: EASE.snap, fill: "both", ...opt }).finished.catch(() => {});
}

// 画面を覆っているあいだは Enter・Space で下の会話や画面が進まないようにする
const blockKey = (e) => {
  if (["Enter", " "].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); }
};
export function holdKeys() {
  window.addEventListener("keydown", blockKey, true);
  return () => window.removeEventListener("keydown", blockKey, true);
}

/** 幕の器。ui.setBg の covered／release 約束に合わせ、覆う・開くの2段で書く */
export function curtain(host, style, cover, reveal) {
  const node = el("div.scene-curtain.move", { "aria-hidden": "true", dataset: { transition: `move-${style}` } });
  const unhold = holdKeys();
  host.append(node);
  const covered = (async () => { await nextFrame(); await cover(node); })();
  let released = false;
  return { covered, async release() {
    if (released) return;
    released = true;
    await covered;
    await nextFrame(); await nextFrame();
    try { await reveal(node); } finally { node.remove(); unhold(); }
  } };
}

let maskSerial = 0;
/** 葉の形の窓。scale(0)で閉じ、scale(1.2)で画面の四隅の外まで開く */
export function leafWindow(color, edge) {
  const id = `tr-leaf-${++maskSerial}`;
  const d = "M -560 360 C 160 -460, 1120 -460, 1840 360 C 1120 1180, 160 1180, -560 360 Z";
  const turn = `rotate(-18 ${W / 2} ${H / 2})`;
  const hole = svg("path", { d, fill: "#000", class: "tr-scale" });
  const ring = svg("path", { d, fill: "none", stroke: edge, "stroke-width": 6, "vector-effect": "non-scaling-stroke", class: "tr-scale" });
  hole.style.transform = ring.style.transform = "scale(0)";
  const box = { x: -300, y: -300, width: W + 600, height: H + 600 };
  const art = stageSvg([
    svg("defs", {}, [svg("mask", { id, maskUnits: "userSpaceOnUse", ...box }, [
      svg("rect", { ...box, fill: "#fff" }),
      svg("g", { transform: turn }, [hole]),
    ])]),
    svg("rect", { ...box, fill: color, mask: `url(#${id})` }),
    svg("g", { transform: turn }, [ring]),
  ]);
  return { art, hole, ring };
}

/** 中央の窓が開いて次の場面を見せる（開口の型の後半） */
export async function openLeaf(node) {
  const win = leafWindow(COLOR.purple, COLOR.lav);
  node.replaceChildren(win.art);
  move(win.ring, [{ transform: "scale(0)", opacity: 1 }, { transform: "scale(1.2)", opacity: 0 }], 400, { easing: EASE.out });
  await move(win.hole, [{ transform: "scale(0)" }, { transform: "scale(1.2)" }], 380, { easing: EASE.out });
}

/** 新しい背景へ一歩踏み込む寄り（扉・暖簾をくぐった直後） */
export function stepIntoBg(ms = 700) {
  const bg = document.getElementById("bg");
  if (bg) bg.animate([{ transform: "scale(1.07)" }, { transform: "scale(1)" }], { duration: ms, easing: EASE.out });
}

/** 経過時間 t 秒の歩く姿勢を毎フレーム描き直す、横向きの人影（右へ歩く・キャップ付き） */
export function walker(color = COLOR.shadow) {
  const limb = (w) => ({ stroke: color, "stroke-width": w, "stroke-linecap": "round", fill: "none" });
  const joint = () => svg("g");
  const legs = [0, 1].map(() => {
    const knee = joint();
    knee.append(svg("line", { x1: 0, y1: 64, x2: 0, y2: 128, ...limb(20) }), svg("path", { d: "M -6 122 h 26 a 8 8 0 0 1 0 14 h -26 z", fill: color }));
    const hip = joint();
    hip.append(svg("line", { x1: 0, y1: 0, x2: 0, y2: 64, ...limb(24) }), knee);
    return { hip, knee };
  });
  const arms = [0, 1].map(() => {
    const elbow = joint();
    elbow.append(svg("line", { x1: 0, y1: 50, x2: 0, y2: 96, ...limb(15) }));
    const shoulder = joint();
    shoulder.append(svg("line", { x1: 0, y1: 0, x2: 0, y2: 50, ...limb(17) }), elbow);
    return { shoulder, elbow };
  });
  const torso = svg("path", { d: "M -24 -4 C -26 -60, -20 -92, 2 -96 C 26 -96, 30 -60, 24 -4 Z", fill: color });
  const head = svg("g", {}, [
    svg("circle", { cx: 8, cy: -122, r: 24, fill: color }),
    svg("path", { d: "M -16 -128 C -16 -154, 30 -158, 34 -130 L 56 -126 C 58 -120, 50 -118, 34 -120 L -16 -120 Z", fill: color }),
  ]);
  const body = svg("g", {}, [arms[1].shoulder, legs[1].hip, torso, head, legs[0].hip, arms[0].shoulder]);
  const far = 0.78; // 奥の手足は少し暗くして前後を分ける
  arms[1].shoulder.style.opacity = legs[1].hip.style.opacity = String(far);
  const g = svg("g", {}, [body]);
  function pose(t) {
    const phase = (t / 0.62) * Math.PI * 2;
    legs.forEach((leg, i) => {
      const p = phase + i * Math.PI;
      leg.hip.setAttribute("transform", `translate(0 0) rotate(${-26 * Math.sin(p)})`);
      leg.knee.setAttribute("transform", `rotate(${6 + 42 * Math.max(0, Math.cos(p))} 0 64)`);
    });
    arms.forEach((arm, i) => {
      const p = phase + i * Math.PI;
      arm.shoulder.setAttribute("transform", `translate(4 -88) rotate(${22 * Math.sin(p)})`);
      arm.elbow.setAttribute("transform", `rotate(${-18 - 14 * Math.max(0, Math.sin(p))} 0 50)`);
    });
    body.setAttribute("transform", `translate(0 ${-130 - 5 * Math.cos(phase * 2)}) rotate(5)`);
  }
  pose(0);
  return { g, pose };
}

/** requestAnimationFrame で cb(経過秒) を呼び続け、止める関数を返す */
export function everyFrame(cb) {
  let id = 0;
  const t0 = performance.now();
  const tick = (now) => { cb((now - t0) / 1000); id = requestAnimationFrame(tick); };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
