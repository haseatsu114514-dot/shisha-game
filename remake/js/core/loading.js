import { el } from "./util.js";
import { prepareImage } from "./loading-prefetch.js";
import { LOADING_COMICS } from "./loading-comics.js";

let active = false, previousComic = null;
let stylesheet;
function loadStyle() {
  if (!stylesheet) stylesheet = new Promise((resolve, reject) => {
    const link = el("link", { rel: "stylesheet", href: new URL("../../css/loading.css", import.meta.url).href });
    link.onload = resolve;
    link.onerror = () => { link.remove(); stylesheet = null; reject(new Error("Loading stylesheet failed")); };
    document.head.append(link);
  });
  return stylesheet;
}

function validPanel(panel) {
  if (!panel.src || !panel.alt) return false;
  const r = panel.region;
  return !r || [r.x, r.y, r.width, r.height, r.sourceWidth, r.sourceHeight].every(Number.isFinite) &&
    r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 &&
    r.x + r.width <= r.sourceWidth && r.y + r.height <= r.sourceHeight;
}

export function selectLoadingComic(comics, { context = "default", chapter = 1 } = {}) {
  const eligible = comics.filter(comic => comic.id && comic.title &&
    Number.isInteger(comic.minChapter) && comic.minChapter <= chapter &&
    (!comic.contexts || comic.contexts.includes(context)) &&
    comic.panels?.length === 2 && comic.panels.every(validPanel));
  const fresh = eligible.filter(comic => comic.id !== previousComic);
  const pool = fresh.length ? fresh : eligible;
  // Presentation uses its own entropy; do not consume gameplay Math.random().
  const chosen = pool.length ? pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length] : null;
  if (chosen) previousComic = chosen.id;
  return chosen;
}

/**
 * prepare({ signal, report }) must finish necessary work before resolving.
 * report(done, total) counts actual preparation units, never elapsed time.
 * Start gameplay/timers only AFTER awaiting this gate. No forced task timeout.
 */
export async function withLoading(prepare, {
  host = document.querySelector("#stage"), label = "場面を準備しています…",
  delayMs = 220, context = "default", chapter = 1, comics = LOADING_COMICS,
  signal,
} = {}) {
  if (!host) throw new Error("Loading host is missing");
  if (active) throw new Error("A loading gate is already active");
  signal?.throwIfAborted();
  active = true;
  const controller = new AbortController();
  const focus = document.activeElement;
  const locked = [...host.children].map(node => [node, node.inert]);
  const wasBusy = host.getAttribute("aria-busy");
  const overlay = el("section.loading-gate", { role: "dialog", "aria-modal": "true", "aria-label": "読み込み", tabindex: "-1" });
  const status = el("p.loading-status", { role: "status", "aria-label": label });
  const emblem = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  emblem.setAttribute("class", "loading-emblem");
  emblem.setAttribute("viewBox", "0 0 36 52");
  emblem.setAttribute("aria-hidden", "true");
  // A small shisha in the correct stack (docs/shisha_reference.md §4.1): base → stem (side hose port) →
  // tray → bowl on a thin leg → lidded HMD. One hose from the port, sagging to a rigid handle and tip.
  // Smoke never comes out of the hardware (only from a mouth), so the "loading" motion is the coal heat
  // breathing as a warm glow over the HMD. The glow is first (painted behind, and animated).
  for (const [cls, d] of [
    ["emblem-glow", "M16 6.4c3.9 0 7 1.5 7 3.3S19.9 13 16 13s-7-1.5-7-3.3 3.1-3.3 7-3.3z"],
    ["emblem-body", "M15 6h2v1.5h-2z M11 7.5h10l.5 1.2V12h-11V8.7z M10.8 12.4h10.4c0 2.7-1.7 4.6-3.4 5.4h-3.6c-1.7-.8-3.4-2.7-3.4-5.4z M15.2 17.8h1.6v2.8h-1.6z M4 20.6h24c-.6 1.4-3.6 2.1-12 2.1s-11.4-.7-12-2.1z M15.15 22.7h1.7V47h-1.7z M16.85 31h2.7v1.4h-2.7z M14.2 37H17.8V38.8C21.6 40 23.8 42.4 23.8 45.6C23.8 48 22.6 50 21.4 51H10.6C9.4 50 8.2 48 8.2 45.6C8.2 42.4 10.4 40 14.2 38.8Z M15.3 39.6C11.6 40.8 9.4 42.9 9.4 45.6C9.4 47.6 10.3 49.1 11.1 49.8H20.9C21.7 49.1 22.6 47.6 22.6 45.6C22.6 42.9 20.4 40.8 16.7 39.6Z M9.7 45.4H22.3C22.2 47.4 21.5 48.9 20.9 49.8H11.1C10.5 48.9 9.8 47.4 9.7 45.4Z M28.6 40.57l1.8.86 2.8-5.79-1.8-.87z M31.8 34.96l1 .48.8-1.7-1-.48z"],
    ["emblem-hose", "M19.5 31.7C24.5 32 26 42.6 29.5 41"],
  ]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", cls); path.setAttribute("d", d); emblem.append(path);
  }
  status.append(emblem, el("span", { text: "LOADING…" }));
  const logo = el("div.loading-logo", { "aria-hidden": "true" });
  const bar = el("div.loading-bar", { "aria-hidden": "true" }, [el("div.loading-bar-fill")]);
  // The gauge wrapper only carries the decorative smoke flourishes at both ends (css/loading.css).
  const gauge = el("div.loading-gauge", { "aria-hidden": "true" }, [bar]);
  const proceed = el("p.loading-proceed", { "aria-hidden": "true", text: "タップ・クリック・キーで進む" });
  const content = el("div.loading-comic");
  overlay.classList.add("has-logo");
  overlay.append(logo, el("div.loading-card", [content]), gauge, status, proceed);
  let settled = false, comicShown = false, awaitingProceed = false, resolveProceed;
  const proceeded = new Promise(resolve => { resolveProceed = resolve; });
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  // Block gameplay input even before the overlay becomes visible. Once preparation is done and a
  // comic is on screen, Enter/Space advance past the reading hold (pointer handled below).
  const guard = event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (awaitingProceed && event.type === "keydown" && (event.key === "Enter" || event.key === " " || event.key === "Spacebar")) resolveProceed();
  };
  const focusGuard = event => { if (!overlay.contains(event.target)) overlay.focus(); };
  window.addEventListener("keydown", guard, true);
  window.addEventListener("keyup", guard, true);
  host.addEventListener("focusin", focusGuard);
  for (const [node] of locked) node.inert = true;
  host.setAttribute("aria-busy", "true");
  for (const type of ["pointerdown", "pointerup", "click"]) {
    overlay.addEventListener(type, event => {
      event.stopPropagation();
      if (awaitingProceed && type === "pointerdown") resolveProceed();
    });
  }
  const comic = selectLoadingComic(comics, { context, chapter });
  const comicReady = comic ? Promise.all(comic.panels.map(panel => prepareImage(panel.src, {
    timeoutMs: 4000, signal: controller.signal,
  }))).then(images => {
    if (settled || controller.signal.aborted) return;
    const panels = el("div.loading-panels", images.map((img, i) => {
      const panel = comic.panels[i], region = panel.region;
      img.alt = panel.alt;
      const crop = el("div.loading-panel-crop", [img]);
      if (region) {
        // The crop box keeps the region's own ratio; the 3:2 frame letterboxes it without distortion.
        const ratio = region.width / region.height;
        crop.style.aspectRatio = `${region.width} / ${region.height}`;
        crop.style.width = `min(100%, ${ratio} * 100cqh)`;
        Object.assign(img.style, {
          position: "absolute", width: `${region.sourceWidth / region.width * 100}%`,
          height: `${region.sourceHeight / region.height * 100}%`, maxWidth: "none",
          left: `${-region.x / region.width * 100}%`, top: `${-region.y / region.height * 100}%`,
        });
      } else {
        crop.style.width = "100%"; crop.style.height = "100%";
      }
      const art = el("div.loading-panel-art", [crop]);
      // Live text bubbles: shape is drawn in the art, words are DOM text so typos can be fixed.
      for (const bubble of panel.bubbles || []) {
        const node = el("p.loading-bubble", { text: bubble.text });
        node.style.left = `${bubble.x}%`; node.style.top = `${bubble.y}%`;
        if (bubble.width != null) node.style.width = `${bubble.width}%`;
        if (bubble.fontSize != null) node.style.fontSize = `${bubble.fontSize}cqw`;
        art.append(node);
      }
      return el("figure", [art]);
    }));
    content.setAttribute("role", "group");
    content.setAttribute("aria-label", comic.title);
    content.append(el("h2.loading-comic-title", { text: comic.title }), panels);
    if (comic.caption) content.append(el("p.loading-comic-caption", { text: comic.caption }));
    comicShown = true;
  }).catch(() => {}) : Promise.resolve();
  // A quick task never flashes a loading screen. Styles are loaded only on use.
  const styleReady = loadStyle();
  styleReady.catch(error => controller.abort(error));
  // Portrait phones/tablets scale #stage down so far that comic text is unreadable. There, show the
  // overlay at true viewport scale (outside the scaled stage) and stack the panels large instead.
  const portraitMq = window.matchMedia?.("(orientation: portrait)");
  const portraitHost = () => (portraitMq?.matches ? document.body : host);
  const placeOverlay = () => {
    overlay.classList.toggle("is-viewport", !!portraitMq?.matches);
    const parent = portraitHost();
    if (overlay.parentNode !== parent) parent.append(overlay);
  };
  const onOrient = () => { if (overlay.isConnected) { placeOverlay(); overlay.focus(); } };
  portraitMq?.addEventListener?.("change", onOrient);
  const show = async () => {
    try { await styleReady; } catch { return; }
    if (settled || controller.signal.aborted) return;
    placeOverlay(); overlay.focus();
  };
  const timer = delayMs > 0 ? setTimeout(show, delayMs) : null;
  const aborted = new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true }));
  try {
    if (delayMs <= 0) {
      await Promise.race([show(), aborted]);
      await Promise.race([new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))), aborted]);
      controller.signal.throwIfAborted();
    }
    // Preparation must yield or use a Worker for expensive CPU work.
    const result = await Promise.race([
      Promise.resolve().then(() => prepare({ signal: controller.signal, report(done, total) {
        if (settled || controller.signal.aborted || !Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return;
        // The bar is indeterminate until this first real count arrives; only then does it
        // switch to showing the reported fraction (see .loading-bar in css/loading.css).
        bar.classList.add("is-determinate");
        const value = Math.max(0, Math.min(done, total));
        status.setAttribute("aria-label", `${label} ${value} / ${total}`);
        overlay.style.setProperty("--loading-progress", value / total);
      } })),
      aborted,
    ]);
    host.setAttribute("aria-busy", "false");
    // Only when a comic is actually on screen, hold for the reader: advance on tap/click/key.
    // No comic / failure / instant task returns immediately, exactly like before.
    if (comicShown && overlay.isConnected && !controller.signal.aborted) {
      overlay.style.setProperty("--loading-progress", "1");
      overlay.classList.add("is-ready");
      proceed.setAttribute("aria-hidden", "false");
      awaitingProceed = true;
      await Promise.race([proceeded, aborted]);
    }
    return result;
  } finally {
    settled = true; clearTimeout(timer); controller.abort();
    void comicReady;
    portraitMq?.removeEventListener?.("change", onOrient);
    overlay.remove();
    signal?.removeEventListener("abort", abort);
    window.removeEventListener("keydown", guard, true);
    window.removeEventListener("keyup", guard, true);
    host.removeEventListener("focusin", focusGuard);
    for (const [node, inert] of locked) node.inert = inert;
    if (wasBusy === null) host.removeAttribute("aria-busy"); else host.setAttribute("aria-busy", wasBusy);
    active = false;
    if (focus?.isConnected) focus.focus();
  }
}
