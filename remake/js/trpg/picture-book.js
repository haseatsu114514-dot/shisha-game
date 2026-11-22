import { el } from "../core/util.js";

const TURN_GUARD = 280;
const IMAGE_WAIT = 5000;

export function hasPictureBook(scenario) {
  return Array.isArray(scenario.pictureBook?.pages) && scenario.pictureBook.pages.length > 0;
}

function loadImage(page, signal) {
  if (!page.image || signal.aborted) return Promise.resolve(null);
  const image = el("img.trpg-picturebook-image", { alt: page.alt || "", draggable: "false" });
  return new Promise(resolve => {
    const finish = result => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      signal.removeEventListener("abort", failed);
      resolve(result);
    };
    const failed = () => finish(null);
    const loaded = () => finish(image);
    const timer = setTimeout(failed, IMAGE_WAIT);
    signal.addEventListener("abort", failed, { once: true });
    image.onerror = failed;
    try {
      if (typeof image.decode !== "function") image.onload = loaded;
      image.src = new URL(page.image, import.meta.url).href;
      image.decode?.().then(loaded, failed);
    } catch { failed(); }
  });
}

/** Cover prologue or shelf reading. The caller owns the game and the sound. */
export function playPictureBook(root, { scenario, signal, readOnly = false }) {
  if (!hasPictureBook(scenario) || signal?.aborted) return Promise.resolve(false);
  const pages = scenario.pictureBook.pages, last = pages.length - 1;
  const images = new Map(), loads = new AbortController();
  const previousFocus = document.activeElement;
  const underlying = [...root.children].filter(child => !child.inert);
  let resolveFinished, finished = false, requested = 0, ready = false, shownAt = 0, art = null;
  const completion = new Promise(resolve => { resolveFinished = resolve; });
  const control = (kind, label, action, attrs = {}) => el(`button.trpg-button.trpg-picturebook-${kind}`, {
    type: "button", text: label, dataset: { test: `trpg-picturebook-${kind}` }, onclick: action, ...attrs,
  });
  const back = control("back", "もどる", () => turn(-1));
  const next = control("next", "次へ", () => turn(1), { class: "primary" });
  const skip = control("skip", "とばす", () => { if (requested !== last) void show(last); });
  const close = readOnly ? control("close", "×", () => finish(true), { "aria-label": "絵本を閉じる" }) : null;
  const number = el("span.trpg-picturebook-number", { dataset: { test: "trpg-picturebook-number" } });
  const text = el("p.trpg-picturebook-text", { "aria-live": "polite", dataset: { test: "trpg-picturebook-page" } });
  const title = `${scenario.title}の絵本`;
  const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const book = el("section.trpg-picturebook", {
    role: "dialog", "aria-modal": "true", "aria-label": title, tabindex: "-1",
    dataset: { test: "trpg-picturebook", phase: "picturebook", ready: "false", motion: calm ? "reduce" : "full" },
    style: { background: scenario.presentation?.backdrop }, onclick: pageClick, onkeydown: keys,
  }, [
    el("header.trpg-picturebook-header", [el("strong.trpg-picturebook-title", { text: scenario.title }), number,
      el("div.trpg-picturebook-tools", [skip, close])]),
    el("div.trpg-picturebook-caption", [text, el("div.trpg-picturebook-nav", [back, next])]),
  ]);

  function picture(index) {
    if (!images.has(index)) images.set(index, loadImage(pages[index], loads.signal));
    return images.get(index);
  }
  async function show(index) {
    requested = index;
    ready = false;
    book.focus({ preventScroll: true });
    book.dataset.ready = "false";
    back.disabled = next.disabled = true;
    skip.disabled = index === last;

    const image = await picture(index);
    if (finished || requested !== index) return;
    art?.remove();
    art = image;
    if (art) book.prepend(art);
    book.dataset.page = String(index + 1);
    number.textContent = `${index + 1}/${pages.length}`;
    text.textContent = pages[index].text;
    next.textContent = index !== last ? "次へ" : readOnly ? "本棚に戻る" : "物語へ入る";
    back.disabled = index === 0;
    next.disabled = false;
    book.dataset.ready = "true";
    shownAt = performance.now();
    ready = true;
    if (index < last) void picture(index + 1);
  }
  function turn(direction) {
    if (!ready) return;
    if (direction === 1 && requested === last) finish(true);
    else if (requested + direction >= 0) void show(requested + direction);
  }
  function pageClick(event) {
    event.stopPropagation();
    if (!ready || event.target.closest("button") || performance.now() - shownAt < TURN_GUARD) return;
    const bounds = book.getBoundingClientRect();
    turn(event.clientX < bounds.left + bounds.width * 0.12 ? -1 : 1);
  }
  function keys(event) {
    const controls = [skip, close, back, next].filter(button => button && !button.disabled);
    if (event.key === "Tab") {
      const index = controls.indexOf(event.target);
      if (index === -1 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
        event.preventDefault();
        (controls[event.shiftKey ? controls.length - 1 : 0] || book).focus();
      }
    } else if (event.key === "Escape" && close) {
      event.preventDefault();
      event.stopPropagation();
      finish(true);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (controls.includes(event.target)) event.target.click();
      else if (performance.now() - shownAt >= TURN_GUARD) turn(1);
    }
  }
  const cancel = () => finish(false);
  function finish(result) {
    if (finished) return;
    finished = true;
    loads.abort();
    signal?.removeEventListener("abort", cancel);
    book.remove();
    for (const child of underlying) child.inert = false;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    resolveFinished(result);
  }

  signal?.addEventListener("abort", cancel, { once: true });
  for (const child of underlying) child.inert = true;
  root.append(book);
  void show(0);
  return completion;
}
