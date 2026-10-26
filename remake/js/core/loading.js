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
  signal, waitForReader = true,
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
  const status = el("p.loading-status", { role: "status", text: label });
  const progress = el("progress", { "aria-label": "読み込み進捗" });
  const content = el("div.loading-comic");
  const proceed = el("button.loading-proceed", { text: "進む", hidden: true });
  overlay.append(el("div.loading-card", [el("p.loading-eyebrow", { text: "水煙前線 / LOADING" }), content, status, progress, proceed]));
  let shown = false, settled = false, hasComic = false, close;
  const continued = new Promise(resolve => { close = resolve; });
  const abort = () => { controller.abort(signal.reason); close(); };
  signal?.addEventListener("abort", abort, { once: true });
  // Capture gameplay hotkeys while loading; let Tab and the gate's button work.
  const guard = event => {
    if (!shown || !overlay.contains(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation();
    } else if (event.key === "Tab") {
      event.preventDefault(); (proceed.hidden ? overlay : proceed).focus();
    } else event.stopPropagation();
  };
  const focusGuard = event => { if (!overlay.contains(event.target)) overlay.focus(); };
  window.addEventListener("keydown", guard, true);
  window.addEventListener("keyup", guard, true);
  host.addEventListener("focusin", focusGuard);
  for (const [node] of locked) node.inert = true;
  host.setAttribute("aria-busy", "true");
  for (const type of ["pointerdown", "pointerup", "click"]) {
    overlay.addEventListener(type, event => event.stopPropagation());
  }
  proceed.onclick = () => close();
  const comic = selectLoadingComic(comics, { context, chapter });
  const comicReady = comic ? Promise.all(comic.panels.map(panel => prepareImage(panel.src, {
    timeoutMs: 4000, signal: controller.signal,
  }))).then(images => {
    if (settled || controller.signal.aborted) return;
    const panels = el("div.loading-panels", images.map((img, i) => {
      const panel = comic.panels[i], region = panel.region;
      img.alt = panel.alt;
      const art = el("div.loading-panel-art", [img]);
      if (region) {
        art.style.aspectRatio = `${region.width} / ${region.height}`;
        Object.assign(img.style, {
          position: "absolute", width: `${region.sourceWidth / region.width * 100}%`,
          height: `${region.sourceHeight / region.height * 100}%`, maxWidth: "none",
          left: `${-region.x / region.width * 100}%`, top: `${-region.y / region.height * 100}%`,
        });
      }
      return el("figure", [art, el("figcaption", { text: `${i + 1} / 2` })]);
    }));
    if (comic.panels.every(panel => panel.region)) {
      panels.style.gridTemplateColumns = comic.panels.map(panel => `${panel.region.width}fr`).join(" ");
    }
    content.append(el("h2", { text: comic.title }), panels);
    if (comic.note) content.append(el("p.loading-comic-note", { text: comic.note }));
    hasComic = true;
  }).catch(() => {}) : Promise.resolve();
  // A quick task never flashes a loading screen. Styles are loaded only on use.
  const styleReady = loadStyle();
  styleReady.catch(error => { controller.abort(error); close(); });
  const show = async () => {
    try { await styleReady; } catch { return; }
    if (settled || controller.signal.aborted) return;
    shown = true; host.append(overlay); overlay.focus();
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
        progress.max = total; progress.value = Math.max(0, Math.min(done, total));
      } })),
      aborted,
    ]);
    host.setAttribute("aria-busy", "false");
    // Never wait for comic downloads after the actual preparation is finished.
    if (shown && hasComic && waitForReader) {
      status.textContent = "準備ができました。読み終えたら進めます。";
      progress.hidden = true; proceed.hidden = false; proceed.focus();
      await continued;
      controller.signal.throwIfAborted();
    }
    return result;
  } finally {
    settled = true; clearTimeout(timer); controller.abort();
    void comicReady;
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
