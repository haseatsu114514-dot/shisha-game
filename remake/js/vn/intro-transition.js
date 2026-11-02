// CIG07: four-person review prototype. Uses existing portraits as CSS masks only.
import { config, state } from "../core/state.js";

export const INTRO_MOTION_PILOT = new Set(["naru", "rin", "nagumo", "pakki"]);
const FULL = "polygon(-10% -10%,110% -10%,110% 110%,-10% 110%)";
const collapsedAt = x => `polygon(${x + 3}% -10%,${x + 3}% -10%,${x - 3}% 110%,${x - 3}% 110%)`;
const AWAY = "polygon(110% -10%,110% -10%,104% 110%,104% 110%)";

/** Own every temporary node, timer, animation and input listener for one playback. */
export function graphicMotion(host, parent, id, art, motion, { signal } = {}) {
  const reduced = config.reduceShake || matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.classList.add("ci-motion-entering");
  const initialState = state;
  const vn = document.querySelector("#vn.active");
  const source = [...document.querySelectorAll('.vn-portraits img.portrait')]
    .find(node => node.dataset.speaker === id && node.complete && node.naturalWidth && node.getBoundingClientRect().width);
  const animations = [], waits = new Set();
  let overlay = null, disposed = false;
  const resize = new ResizeObserver(() => {
    const shadow = overlay?.querySelector(".ci-silhouette");
    if (shadow) positionShadow(shadow);
  });
  resize.observe(parent);
  if (source) resize.observe(source);
  const swallow = event => {
    if (event.type === "keydown" && !["Enter", " ", "Control"].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  };
  const events = ["keydown", "pointerdown", "pointerup", "click"];
  const cancel = () => dispose();
  const observer = new MutationObserver(() => {
    if (!parent.isConnected || !host.isConnected || (vn && !vn.classList.contains("active"))) dispose();
  });
  const timer = setInterval(() => { if (state !== initialState) dispose(); }, 32);
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(timer); observer.disconnect(); resize.disconnect();
    signal?.removeEventListener("abort", cancel);
    events.forEach(type => window.removeEventListener(type, swallow, true));
    animations.forEach(animation => animation.cancel());
    waits.forEach(finish => finish(false)); waits.clear();
    overlay?.remove(); overlay = null;
    host.classList.remove("ci-motion-entering");
  }
  const wait = ms => new Promise(resolve => {
    if (disposed) return resolve(false);
    const finish = value => { clearTimeout(t); waits.delete(finish); resolve(value); };
    const t = setTimeout(() => finish(true), ms);
    waits.add(finish);
  });
  const animate = (node, frames, options = {}) => {
    if (node && !disposed) animations.push(node.animate(frames, { fill: "both", easing: "cubic-bezier(.2,.8,.2,1)", ...options }));
  };
  function positionShadow(shadow) {
    const rect = source.getBoundingClientRect(), bounds = parent.getBoundingClientRect();
    const sx = parent.clientWidth / bounds.width, sy = parent.clientHeight / bounds.height;
    Object.assign(shadow.style, { left: `${(rect.left - bounds.left) * sx}px`, top: `${(rect.top - bounds.top) * sy}px`,
      width: `${rect.width * sx}px`, height: `${rect.height * sy}px` });
  }
  function makeOverlay() {
    overlay?.remove();
    overlay = document.createElement("div");
    overlay.className = "ci-transition";
    overlay.dataset.motion = motion;
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.setProperty("--accent", art.color);
    overlay.style.setProperty("--secondary", art.secondary);
    const bounds = parent.getBoundingClientRect(), sourceBounds = source?.isConnected ? source.getBoundingClientRect() : null;
    const origin = sourceBounds ? Math.max(0, Math.min(100, ((sourceBounds.left + sourceBounds.width / 2 - bounds.left) / bounds.width) * 100)) : 26;
    const closed = collapsedAt(origin);
    const shadow = document.createElement("div");
    shadow.className = "ci-silhouette";
    const wipe = document.createElement("div");
    wipe.className = "ci-wipe";
    const edge = document.createElement("div"); edge.className = "ci-wipe-edge"; edge.style.transform = "translateX(3px)";
    wipe.style.clipPath = edge.style.clipPath = closed;
    overlay.append(edge, wipe);
    if (source?.isConnected) {
      shadow.style.maskImage = `url(${JSON.stringify(source.currentSrc || source.src)})`;
      positionShadow(shadow);
      overlay.prepend(shadow);
    }
    parent.append(overlay);
    return { shadow: shadow.isConnected ? shadow : null, wipe, edge, closed, origin };
  }
  events.forEach(type => window.addEventListener(type, swallow, { capture: true, passive: false }));
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) dispose();
  return {
    reduced, wait, dispose, get active() { return !disposed; },
    async enter() {
      if (disposed) return false;
      if (reduced) {
        host.classList.remove("ci-motion-entering");
        host.classList.add("in");
        animate(host, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
        return wait(200);
      }
      const { shadow, wipe, edge, closed, origin } = makeOverlay();
      const duration = motion === "soft" ? 600 : 480;
      const easing = motion === "still" ? "steps(2,end)" : motion === "bounce" ? "cubic-bezier(.2,.9,.3,1.15)" : "cubic-bezier(.2,.8,.2,1)";
      animate(shadow, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      const startClip = motion === "bounce" ? `circle(0% at ${origin}% 50%)` : closed;
      const full = motion === "bounce" ? `circle(150% at ${origin}% 50%)` : FULL;
      animate(wipe, [{ clipPath: startClip }, { clipPath: full }], { delay: 120, duration: 220, easing });
      animate(edge, [{ clipPath: startClip }, { clipPath: full }], { delay: 120, duration: 220, easing });
      if (!await wait(300)) return false;
      host.classList.add("in");
      animate(wipe, [{ clipPath: full }, { clipPath: motion === "bounce" ? "circle(0% at 110% 50%)" : AWAY }], { duration: duration - 300, easing });
      animate(edge, [{ clipPath: full }, { clipPath: motion === "bounce" ? "circle(0% at 110% 50%)" : AWAY }], { duration: duration - 300, easing });
      animate(shadow, [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
      if (!await wait(duration - 300)) return false;
      overlay.remove(); overlay = null;
      host.classList.remove("ci-motion-entering");
      return true;
    },
    hold(duration) {
      if (reduced || disposed) return;
      const direction = motion === "soft" ? -1 : 1;
      const distance = motion === "still" ? 1 : 5;
      animate(host.querySelector(".ci-art-background"), [
        { transform: `scale(1.03) translateX(${-direction * 1.25}%)` },
        { transform: `scale(1.03) translateX(${direction * 1.25}%)` },
      ], { duration, easing: "linear" });
      animate(host.querySelector(".ci-portrait"), [
        { transform: "translateX(0) scale(1)" },
        { transform: `translateX(${-direction * distance}px) scale(1.03)` },
      ], { duration, easing: "linear" });
      const light = document.createElement("div"); light.className = "ci-motion-light";
      const dots = document.createElement("div"); dots.className = "ci-motion-dots";
      const edge = document.createElement("div"); edge.className = "ci-motion-edge";
      host.append(light, dots); host.querySelector(".ci-ribbon").append(edge);
      animate(light, [{ opacity: 0, transform: "translateX(-100%)" }, { opacity: .18, offset: .5 }, { opacity: 0, transform: "translateX(100%)" }], { duration: 1600, delay: 500 });
      animate(dots, [{ opacity: 0 }, { opacity: .16 }, { opacity: 0 }], { duration: 1700, delay: 650 });
      animate(edge, [{ opacity: 0, transform: "translateX(-100%)" }, { opacity: .8, offset: .5 }, { opacity: 0, transform: "translateX(100%)" }], { duration: 900, delay: 800 });
    },
    async exit() {
      if (disposed) return false;
      if (reduced) { animate(host, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 }); return wait(200); }
      const { shadow, wipe, edge, closed, origin } = makeOverlay();
      wipe.style.clipPath = FULL;
      edge.style.opacity = "0";
      animate(wipe, [{ opacity: 0 }, { opacity: 1 }], { duration: 80 });
      animate(shadow, [{ opacity: 1 }, { opacity: 1 }], { duration: 220 });
      if (!await wait(80)) return false;
      host.style.opacity = "0";
      animate(wipe, [{ clipPath: FULL }, { clipPath: closed }], { duration: 140, easing: motion === "still" ? "steps(2,end)" : "ease-in-out" });
      if (!await wait(140)) return false;
      animate(shadow, [{ opacity: 1 }, { opacity: 0 }], { duration: 80 });
      return wait(80);
    },
  };
}
