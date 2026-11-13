import { el } from "./util.js";
import { buildVersioned } from "./asset-version.js";
import { prepareImage } from "./loading-prefetch.js";
import { LOADING_COMICS, eligibleLoadingComics } from "./loading-comics.js";

let active = null, previousComic = null, upcomingComic = null, lastReadAt = -Infinity, lastComic = null;
// Reading hold: a tap or key is accepted only after the art has been on screen this long and this long
// after preparation finished, so taps left over from the previous screen cannot skip an unread comic.
const READ_GUARD_SHOWN_MS = 700, READ_GUARD_READY_MS = 250;
// Right after a comic was read (a LOAD that reloads the page and resumes, a chapter whose script loads after
// its module), the loading goes on as one screen: within this gap a fixed point waits only when needed, and
// a gate that shows carries the comic just read, without a second hold.
const FIXED_GAP_MS = 2000;
// Comic art is given this long. Missing or slower art leaves the plain gate, which never holds.
// For players the comic is a must (comicLoadingRequired): a slow line gets much longer, and a comic whose
// art cannot be fetched gives way to the comic read last (its art is already in the browser's cache).
const COMIC_ART_TIMEOUT_MS = 4000, REQUIRED_ART_TIMEOUT_MS = 15000;
const LOADING_COMICS_MODE_KEY = "suien_loading_comics";
// The next comic's art is fetched this long after a gate closes, behind the scene that just opened.
const WARM_DELAY_MS = 1500;

/**
 * 決まった場面（作業台に入る・ミニゲームの前・章の始め・セーブからの再開・起動）で、待ちがなくても漫画のロード画面を毎回出すか
 * （2026-11-12 オーナー「漫画はマストで出して欲しい」「決まった場面は毎回出す」）。出したロード画面には必ず漫画を載せる。
 * 自動操作のブラウザ（navigator.webdriver。既存のブラウザ検査）は従来どおり、待ちが長いときだけ出す（core/look.js・side-area.js と同じ扱い）。
 * 検査は localStorage の suien_loading_comics に "always"（毎回）／"wait"（待ちのときだけ）を入れて切り替える。
 */
export function comicLoadingRequired() {
  try {
    const mode = localStorage.getItem(LOADING_COMICS_MODE_KEY);
    if (mode === "always") return true;
    if (mode === "wait") return false;
  } catch { /* 保存を読めない環境はプレイヤーの既定で動く */ }
  return !(typeof navigator !== "undefined" && navigator.webdriver === true);
}
let stylesheet;
function loadStyle() {
  if (!stylesheet) stylesheet = new Promise((resolve, reject) => {
    const link = el("link", { rel: "stylesheet", href: buildVersioned(new URL("../../css/loading.css", import.meta.url).href) });
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

function comicPool(comics, { context = "default", chapter = 1, isMet = null, isRead = null } = {}) {
  // isMet(id): the player has met that character. Comics list their cast; one is shown only after
  // meeting everyone in it (loading-comics.js). Without isMet (previews) the cast is not checked.
  // isRead(id): the player has already read that comic. Unread ones come first, so every episode is
  // seen once before any repeats; with everything read (or no isRead) the draw is over all of them.
  const eligible = eligibleLoadingComics(comics, { context, chapter, isMet }).filter(comic => comic.panels.every(validPanel));
  const unread = isRead ? eligible.filter(comic => !isRead(comic.id)) : [];
  const candidates = unread.length ? unread : eligible;
  const fresh = candidates.filter(comic => comic.id !== previousComic);
  return fresh.length ? fresh : candidates;
}
// Presentation uses its own entropy; do not consume gameplay Math.random().
const draw = pool => pool.length ? pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length] : null;

export function selectLoadingComic(comics, options = {}) {
  const pool = comicPool(comics, options);
  // The comic whose art was fetched in advance (warmNextLoadingComic) is used while it is still a fair pick.
  const chosen = pool.find(comic => comic.id === upcomingComic) || draw(pool);
  upcomingComic = null;
  if (chosen) previousComic = chosen.id;
  return chosen;
}

/** 次のロード画面で、出せる話ならこの話を出す（起動直後の画面に先に出した漫画を、同じ話のまま続ける。index.html）。 */
export function preferLoadingComic(id) {
  upcomingComic = typeof id === "string" && id ? id : upcomingComic;
}

// carriedArt: the comic last painted and its decoded <img>s. A gate showing that same comic again (continuing,
// or the read-last fallback) moves them in instead of fetching: the art never blinks between gates.
let primedArt = null, carriedArt = null;
/**
 * その話の2コマに、もう読み込んだ画像（起動画面の <img>）をそのまま使う。取り直さないので、遅い回線でも
 * 起動画面と同じ漫画がすぐ出る（ロード画面が開いた時点で届いていなければ、その読み込みを待つ）。
 */
export function primeLoadingArt(id, images) {
  primedArt = typeof id === "string" && id && Array.isArray(images) && images.length === 2 ? { id, images } : null;
}

/** 漫画を読んだすぐ後で、次のロード画面がその続き（同じ漫画のまま・読む待ちなし）になるか。 */
export function loadingContinues() {
  return comicLoadingRequired() && !!lastComic && performance.now() - lastReadAt <= FIXED_GAP_MS;
}

/**
 * 次に出す漫画を先に決めて、2コマの絵を裏で取得しておく（デコードした絵は持たない。取得だけなので軽い）。
 * 決まった場面のロード画面は待ちがなくても出るので、絵が先に届いていれば、出た瞬間から漫画が読める。
 */
export function warmNextLoadingComic(comics = LOADING_COMICS, options = {}) {
  const comic = draw(comicPool(comics, options));
  upcomingComic = comic?.id ?? null;
  for (const panel of comic?.panels || []) {
    try { const img = new Image(); img.decoding = "async"; img.src = panel.src; } catch { /* 先読みだけ。失敗してもよい */ }
  }
  return comic;
}

/**
 * prepare({ signal, report }) must finish necessary work before resolving.
 * report(done, total) counts actual preparation units, never elapsed time.
 * Start gameplay/timers only AFTER awaiting this gate. No forced task timeout.
 */
export async function withLoading(prepare, {
  host = document.querySelector("#stage"), label = "場面を準備しています…",
  delayMs = 220, context = "default", chapter = 1, comics = LOADING_COMICS, isMet = null,
  isRead = null, onRead = null, onProceed = null, fixed = false, soft = false, signal,
} = {}) {
  if (!host) throw new Error("Loading host is missing");
  // soft: a short wait inside a scene (a conversation's art, a module). It never competes with another gate:
  // while one is open it only waits for its preparation, and a gate that needs the screen waits for it to close.
  while (active) {
    if (soft) {
      signal?.throwIfAborted();
      return await prepare({ signal: signal || new AbortController().signal, report() {} });
    }
    if (!active.soft) throw new Error("A loading gate is already active");
    await active.closed;
  }
  signal?.throwIfAborted();
  let closeGate;
  active = { soft, closed: new Promise(resolve => { closeGate = resolve; }) };
  // required: a shown gate always carries its comic (it waits for the art, then holds for reading).
  // forced: a fixed point shows the gate at once even when nothing needs loading.
  // continuing: a comic was read a moment ago, so this gate goes on with it (no second hold, no record).
  const required = comicLoadingRequired();
  const continuing = required && !!lastComic && performance.now() - lastReadAt <= FIXED_GAP_MS;
  const forced = fixed && required && !continuing;
  if (forced) delayMs = 0;
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
  const statusText = el("span", { text: "LOADING…" });
  status.append(emblem, statusText);
  const logo = el("div.loading-logo", { "aria-hidden": "true" });
  const bar = el("div.loading-bar", { "aria-hidden": "true" }, [el("div.loading-bar-fill")]);
  // The gauge wrapper only carries the decorative smoke flourishes at both ends (css/loading.css).
  const gauge = el("div.loading-gauge", { "aria-hidden": "true" }, [bar]);
  // The prompt names only what this device can do (a touch screen has no click or Enter key to offer).
  const touchFirst = !!window.matchMedia?.("(pointer: coarse)").matches;
  const proceed = el("p.loading-proceed", { "aria-hidden": "true", text: touchFirst ? "タップで進む" : "クリック・Enter で進む" });
  const content = el("div.loading-comic");
  overlay.classList.add("has-logo");
  const card = el("div.loading-card", [content]);
  overlay.append(logo, card, gauge, status, proceed);
  let settled = false, comicShown = false, comicShownAt = 0, guardTimer = null, awaitingProceed = false, resolveProceed;
  const proceeded = new Promise(resolve => { resolveProceed = resolve; });
  // Runs inside the tap or key event itself, so it may start sound that needs a user gesture (boot).
  const proceedNow = () => {
    if (!awaitingProceed) return;
    awaitingProceed = false;
    try { onProceed?.(); } catch { /* Display only. */ }
    resolveProceed();
  };
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  // Block gameplay input even before the overlay becomes visible. Once preparation is done and a
  // comic is on screen, Enter/Space advance past the reading hold (pointer handled below).
  const guard = event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (awaitingProceed && event.type === "keydown" && (event.key === "Enter" || event.key === " " || event.key === "Spacebar")) proceedNow();
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
      if (awaitingProceed && type === "pointerdown") proceedNow();
    });
  }
  let comic = continuing ? lastComic : selectLoadingComic(comics, { context, chapter, isMet, isRead });
  // The sheet (title, two 3:2 frames, note) is laid out as soon as a comic is chosen and kept hidden
  // (.is-waiting) until the art is decoded: the logo and gauge then never jump when the panels arrive.
  let frames = [];
  const layout = shown => {
    frames = shown.panels.map(() => el("div.loading-panel-art"));
    card.classList.add("is-waiting");
    content.setAttribute("role", "group");
    content.setAttribute("aria-label", shown.title);
    content.replaceChildren(el("h2.loading-comic-title", { text: shown.title }), el("div.loading-panels", frames.map(art => el("figure", [art]))));
    if (shown.caption) content.append(el("p.loading-comic-caption", { text: shown.caption }));
  };
  const artTimeout = required ? REQUIRED_ART_TIMEOUT_MS : COMIC_ART_TIMEOUT_MS;
  const loadArt = shown => {
    let images = null;
    if (carriedArt?.comic === shown) images = carriedArt.images;
    else if (primedArt?.id === shown.id && primedArt.images.length === shown.panels.length) { images = primedArt.images; primedArt = null; }
    if (images) return Promise.all(images.map(img => (img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode()).then(() => img)));
    return Promise.all(shown.panels.map(panel => prepareImage(panel.src, { timeoutMs: artTimeout, signal: controller.signal })));
  };
  if (comic) layout(comic);
  const comicReady = comic ? loadArt(comic).catch(error => {
    // A comic is a must for players: when this one's art cannot be fetched, show the comic read last.
    const backup = required && lastComic && lastComic !== comic && !settled && !controller.signal.aborted ? lastComic : null;
    if (!backup) throw error;
    comic = backup;
    layout(backup);
    return loadArt(backup);
  }).then(images => {
    if (settled || controller.signal.aborted) return;
    images.forEach((img, i) => {
      const panel = comic.panels[i], region = panel.region, art = frames[i];
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
      art.append(crop);
      // Live text bubbles: shape is drawn in the art, words are DOM text so typos can be fixed.
      for (const bubble of panel.bubbles || []) {
        const node = el("p.loading-bubble", { text: bubble.text });
        node.style.left = `${bubble.x}%`; node.style.top = `${bubble.y}%`;
        if (bubble.width != null) node.style.width = `${bubble.width}%`;
        if (bubble.fontSize != null) node.style.fontSize = `${bubble.fontSize}cqw`;
        art.append(node);
      }
    });
    card.classList.remove("is-waiting");
    comicShown = true; comicShownAt = performance.now();
    // A gate that goes on with this comic (continuing) moves these decoded images in: the art never blinks.
    carriedArt = { comic, images };
  }).catch(() => {
    // Missing art: fall back to the plain gate (no sheet, no reading hold).
    card.classList.remove("is-waiting");
    content.replaceChildren(); content.removeAttribute("role"); content.removeAttribute("aria-label");
  }) : Promise.resolve();
  // A quick task never flashes a loading screen. Styles are loaded only on use.
  const styleReady = loadStyle();
  styleReady.catch(error => controller.abort(error));
  // Portrait phones/tablets scale #stage down so far that comic text is unreadable. There, show the
  // overlay at true viewport scale (outside the scaled stage) and stack the panels large instead.
  // A phone held sideways (a short landscape screen) leaves the stage too: the 16:9 stage is letterboxed
  // on a wider screen, and the sheet can use that width and real-pixel text sizes (css/loading.css).
  const viewportMqs = ["(orientation: portrait)", "(orientation: landscape) and (max-height: 500px)"]
    .map(query => window.matchMedia?.(query)).filter(Boolean);
  const atViewportScale = () => viewportMqs.some(mq => mq.matches);
  const placeOverlay = () => {
    const viewport = atViewportScale();
    overlay.classList.toggle("is-viewport", viewport);
    const parent = viewport ? document.body : host;
    if (overlay.parentNode !== parent) parent.append(overlay);
  };
  const onOrient = () => { if (overlay.isConnected) { placeOverlay(); overlay.focus(); } };
  for (const mq of viewportMqs) mq.addEventListener?.("change", onOrient);
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
    // A shown gate always carries its comic: when preparation ends before the art arrives, wait for it
    // (players: at most REQUIRED_ART_TIMEOUT_MS, then the comic read last; with no art at all the plain gate
    // closes without holding).
    if (required && overlay.isConnected && !controller.signal.aborted) await Promise.race([comicReady, aborted]);
    // Only when a comic is actually on screen, hold for the reader: advance on tap/click/key.
    // No comic / failure / instant task returns immediately, exactly like before.
    if (comicShown && !continuing && overlay.isConnected && !controller.signal.aborted) {
      bar.classList.add("is-determinate");
      overlay.style.setProperty("--loading-progress", "1");
      // Input is accepted only after the reading guard. The ready look (準備完了 and the prompt) appears
      // at that same moment, so what the screen says always matches what a tap does.
      const wait = Math.max(READ_GUARD_READY_MS, comicShownAt + READ_GUARD_SHOWN_MS - performance.now());
      await Promise.race([new Promise(resolve => { guardTimer = setTimeout(resolve, wait); }), aborted]);
      overlay.classList.add("is-ready");
      statusText.textContent = "準備完了";
      status.setAttribute("aria-label", "準備完了");
      proceed.setAttribute("aria-hidden", "false");
      awaitingProceed = true;
      await Promise.race([proceeded, aborted]);
      lastReadAt = performance.now(); lastComic = comic;
      // The reader moved on by their own tap or key: that comic counts as read (record keeping only).
      try { onRead?.(comic); } catch { /* A failed record must not break the game. */ }
    }
    return result;
  } finally {
    settled = true; clearTimeout(timer); clearTimeout(guardTimer); controller.abort();
    void comicReady;
    for (const mq of viewportMqs) mq.removeEventListener?.("change", onOrient);
    leaveLoading(overlay, { cancelled: !!signal?.aborted });
    signal?.removeEventListener("abort", abort);
    window.removeEventListener("keydown", guard, true);
    window.removeEventListener("keyup", guard, true);
    host.removeEventListener("focusin", focusGuard);
    for (const [node, inert] of locked) node.inert = inert;
    if (wasBusy === null) host.removeAttribute("aria-busy"); else host.setAttribute("aria-busy", wasBusy);
    active = null; closeGate();
    if (focus?.isConnected) focus.focus();
    // The next fixed point shows its comic at once: fetch that comic's art while the scene settles.
    if (required && comic && !continuing) setTimeout(() => warmNextLoadingComic(comics, { context, chapter, isMet, isRead }), WARM_DELAY_MS);
  }
}

/**
 * ロード画面の出口（#2688 A14）。本物はすぐ外し、同じ色の霞の面（背景の絵つき）を残して、もやが晴れるように上へ薄れさせる。
 * 表示していなかった・中断された・動きを減らす設定では、今までどおりそのまま外す。
 */
function leaveLoading(overlay, { cancelled = false } = {}) {
  const parent = overlay.parentNode;
  const visible = !!parent && !cancelled && typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!visible) { overlay.remove(); return; }
  const haze = el("div.loading-exit-haze", { "aria-hidden": "true" });
  if (overlay.classList.contains("is-viewport")) haze.classList.add("is-viewport");
  overlay.replaceWith(haze);
  haze.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-3%)" }],
    { duration: 300, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).finished.catch(() => {}).finally(() => haze.remove());
}
