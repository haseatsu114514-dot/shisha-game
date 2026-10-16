// 実穴の座標を手元のアルミへ映す。入力・判定・ゲームの時計は穴あけ側に置く。
import { el } from "../core/util.js";
import { makingUrl } from "../core/data.js";
import { readyWorkerImage } from "./worker-scenes.js";

// 1536×1024の同じ画角で生成した、穴のないハガルと右手3枚の位置合わせ。
export const FOIL_VIEW = Object.freeze({ width: 1536, height: 1024, cx: 660, cy: 426, rx: 216, ry: 125, tipX: 824, tipY: 365 });
const HAND_FRAMES = {
  hover: { file: "hajime_craft_holes_hover.png", tip: [822, 326], lift: 30 },
  contact: { file: "hajime_craft_holes_contact.png", tip: [824, 365], lift: 0 },
  release: { file: "hajime_craft_holes_release.png", tip: [824, 335], lift: 60 },
};
const SVG_NS = "http://www.w3.org/2000/svg";

export function buildWorkerHoles() {
  const frames = Object.entries(HAND_FRAMES).map(([pose, frame]) => ({
    pose, ...frame, img: el("img.worker-punch-hand", { alt: "", hidden: true, draggable: false, dataset: { pose } }),
  }));
  const dots = document.createElementNS(SVG_NS, "svg");
  dots.classList.add("worker-punch-dots");
  dots.setAttribute("viewBox", `0 0 ${FOIL_VIEW.width} ${FOIL_VIEW.height}`);
  dots.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const hands = el("div.worker-punch-hands", frames.map(frame => frame.img));
  const root = el("div.worker-punch", { hidden: true, "aria-hidden": "true", dataset: { test: "worker-punch", pose: "hover" } }, [dots, hands]);
  let available = false, target = [0.75, -0.5], timers = [];
  let pending;
  const prepare = () => pending ??= Promise.all(frames.map(frame => readyWorkerImage(frame.img, makingUrl(frame.file))))
    .then(results => { available = results.every(Boolean); });
  const ready = Promise.resolve();
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const positionHand = () => {
    const scale = Math.min(root.clientWidth / FOIL_VIEW.width, root.clientHeight / FOIL_VIEW.height);
    const x = FOIL_VIEW.cx + target[0] * FOIL_VIEW.rx - FOIL_VIEW.tipX;
    const y = FOIL_VIEW.cy + target[1] * FOIL_VIEW.ry - FOIL_VIEW.tipY;
    hands.style.transform = `translate(${x * scale}px, ${y * scale}px)`;
    // 生成絵の数pxの位置差は画像を再加工せず、表示時の位置合わせで補正。
    frames.forEach(frame => {
      const dx = FOIL_VIEW.tipX - frame.tip[0];
      const dy = FOIL_VIEW.tipY - frame.lift - frame.tip[1];
      frame.img.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    });
  };
  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(positionHand) : null;
  const pose = name => {
    root.dataset.pose = name;
    frames.forEach(frame => { frame.img.hidden = frame.pose !== name; });
  };
  const reset = () => {
    clearTimers(); dots.replaceChildren(); target = [0.75, -0.5]; pose("hover"); positionHand();
  };
  const later = (name, ms) => timers.push(setTimeout(() => {
    if (!root.isConnected || root.hidden) { clearTimers(); return; }
    pose(name);
  }, ms));
  reset();
  return { root, ready, prepare, get available() { return available; }, reset,
    show(visible) {
      root.hidden = !visible || !available;
      if (root.hidden) { clearTimers(); resize?.disconnect(); }
      else { positionHand(); resize?.observe(root); }
    },
    punch(event) {
      if (root.hidden || !root.isConnected) return;
      clearTimers(); target = event.target;
      // MISS/TOO CLOSEも実際に開いた穴。同じ座標・実穴数をそのまま表示する。
      dots.replaceChildren(...event.dots.map(([x, y]) => {
        const dot = document.createElementNS(SVG_NS, "ellipse");
        for (const [key, value] of Object.entries({ cx: FOIL_VIEW.cx + x * FOIL_VIEW.rx, cy: FOIL_VIEW.cy + y * FOIL_VIEW.ry, rx: 5, ry: 3.2 })) dot.setAttribute(key, value);
        dot.dataset.x = String(x); dot.dataset.y = String(y);
        return dot;
      }));
      positionHand();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { pose("hover"); return; }
      pose("contact"); later("release", 90); later("hover", 180);
    },
  };
}
