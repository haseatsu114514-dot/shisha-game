// 第1章だけの採用済み01。原画の同じ6領域を順に表示し、他章の共通章題は変更しない。
import { el } from "../core/util.js";
import { layers } from "../core/ui.js";
import { CHAPTER_TITLE_ART } from "../core/chapter-title-art.js";
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { on } from "../core/bus.js";

export const CH1_TITLE_TIMING = Object.freeze({
  duration: 4800, initial: 60, interval: 300, personFade: 640,
  titleStart: 2420, titleFade: 680, fullAt: 3100, hold: 1700, imageTimeout: 15000,
});
const PEOPLE = [[24, 256, 178, 400], [208, 256, 226, 400], [436, 256, 222, 400],
  [660, 256, 172, 400], [834, 256, 222, 400], [1058, 256, 202, 400]];
const title = CHAPTER_TITLE_ART.find(entry => entry.chapter === 1);
const ease = value => { const p = Math.max(0, Math.min(1, value)); return p * p * (3 - 2 * p); };
let active = null;

/** 章開幕の装飾層。煙（テーマ）・人物をなでる一筋の光・周辺減光。canvasの画素には触れない。 */
function buildTitleFx() {
  const fx = el("div.ch1-title-fx", { "aria-hidden": "true" });
  // 各人の足元から立ちのぼる煙。右から順に少し遅れて上がり、集まってくる気配を出す。
  for (const [x, delay] of [[9, 0], [24, 520], [41, 260], [59, 820], [73, 420], [90, 680]]) {
    fx.append(el("div.ch1-title-fx-smoke", { style: { left: `${x}%`, animationDelay: `${delay}ms` } }));
  }
  fx.append(el("div.ch1-title-fx-sweep"));     // 黒い服と題字にだけ走る光（白地には出ない）
  fx.append(el("div.ch1-title-fx-vignette"));  // 四隅をわずかに締めて中央へ寄せる
  return fx;
}

/** 採用プレビューと同じ原画座標。終端は一枚絵を直接描いて全画素を保つ。 */
export function drawCh1Title(context, image, elapsed) {
  if (elapsed >= CH1_TITLE_TIMING.fullAt) { context.drawImage(image, 0, 0); return; }
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 1280, 720);
  context.drawImage(image, 0, 655, 1280, 65, 0, 655, 1280, 65);
  const crop = ([x, y, w, h], alpha, rise = 0) => {
    context.save(); context.globalAlpha = alpha;
    context.drawImage(image, x, y, w, h, x, y + rise, w, h); context.restore();
  };
  // 6人は右から順に、少し沈んだ所から歩み寄るように浮かび上がる（fullAtより前に定位置へ収まる）。
  PEOPLE.forEach((box, i) => {
    const a = ease((elapsed - CH1_TITLE_TIMING.initial - (5 - i) * CH1_TITLE_TIMING.interval) / CH1_TITLE_TIMING.personFade);
    crop(box, a, (1 - a) * 9);
  });
  crop([0, 0, 1280, 255], ease((elapsed - CH1_TITLE_TIMING.titleStart) / CH1_TITLE_TIMING.titleFade));
}

/** 読込・表示中は従来の章題と同じ送り入力ガード。Control keyupだけはSKIP解除へ通す。 */
export function playCh1Title({ signal } = {}) {
  if (signal?.aborted) return Promise.resolve({ cancelled: true });
  active?.cancel();
  const owner = state, host = layers.fx;
  const swallow = event => { event.preventDefault(); event.stopPropagation(); };
  const blockKey = event => { if (["Enter", " ", "Control"].includes(event.key)) swallow(event); };
  const blockRelease = event => { if (event.key !== "Control") blockKey(event); };
  const shield = el("div.ch1-title-motion", { dataset: { test: "ch1-title-motion", phase: "loading" },
    style: { position: "absolute", inset: "0", pointerEvents: "auto" },
    onpointerdown: swallow, onpointerup: swallow, onclick: swallow });
  const image = new Image(), media = matchMedia("(prefers-reduced-motion: reduce)");
  let phase = "loading", frame = 0, timer = 0, imageTimer = 0, context = null, started = 0, endAt = 0, fx = null;
  let removeState = () => {}, observer;
  return new Promise(resolve => {
    const finish = (cancelled = false) => {
      if (phase === "done") return;
      const art = shield.dataset.art || "none";
      phase = "done"; cancelAnimationFrame(frame); clearTimeout(timer); clearTimeout(imageTimer);
      image.onload = image.onerror = null;
      observer?.disconnect(); removeState();
      window.removeEventListener("keydown", blockKey, true);
      window.removeEventListener("keyup", blockRelease, true);
      window.removeEventListener("pagehide", cancel);
      signal?.removeEventListener("abort", cancel);
      media.removeEventListener("change", reduce);
      shield.remove();
      if (active === task) active = null;
      // ジングルの音源は止めない。短縮・中断時も既に鳴ったSEを切断しない。
      resolve({ cancelled, art });
    };
    const cancel = () => finish(true);
    const task = { cancel }; active = task;
    const isCurrent = () => state === owner && shield.isConnected && !signal?.aborted;
    const full = () => { if (context) drawCh1Title(context, image, CH1_TITLE_TIMING.fullAt); };
    const scheduleEnd = ms => {
      clearTimeout(timer); endAt = performance.now() + ms;
      timer = setTimeout(() => { full(); finish(!isCurrent()); }, ms);
    };
    const reduce = () => {
      if (phase !== "playing" || !media.matches) return;
      cancelAnimationFrame(frame); fx?.remove(); fx = null; full();
      scheduleEnd(Math.min(Math.max(0, endAt - performance.now()), CH1_TITLE_TIMING.hold));
    };
    const tick = now => {
      if (phase !== "playing") return;
      if (!isCurrent()) { cancel(); return; }
      const elapsed = Math.max(0, now - started);
      drawCh1Title(context, image, elapsed);
      shield.dataset.elapsed = String(Math.round(elapsed));
      frame = requestAnimationFrame(tick);
    };
    const begin = ready => {
      if (phase !== "loading") return;
      if (!isCurrent()) { cancel(); return; }
      clearTimeout(imageTimer); image.onload = image.onerror = null;
      phase = "playing"; shield.dataset.phase = phase;
      shield.dataset.art = ready ? "ready" : "text";
      const card = el("div.ch1-title-picture", { role: "img", "aria-label": [title.no, title.name, title.read, title.sub].filter(Boolean).join("　"),
        style: { position: "absolute", inset: "0", background: "#0b0812", display: "flex", alignItems: "center", justifyContent: "center" } });
      if (ready) {
        const canvas = el("canvas", { width: 1280, height: 720, "aria-hidden": "true",
          style: { width: "100%", height: "100%", objectFit: "contain" } });
        context = canvas.getContext("2d"); card.append(canvas);
        if (context) drawCh1Title(context, image, media.matches ? CH1_TITLE_TIMING.fullAt : 0);
        // 動きを出すときだけ、装飾の演出層を絵の上へ重ねる。画素検査はcanvasだけを見るので影響しない。
        if (context && !media.matches) { fx = buildTitleFx(); card.append(fx); }
      }
      if (!context) {
        shield.dataset.art = "text";
        card.replaceChildren(el("div", { style: { textAlign: "center", color: "#fff", maxWidth: "95%" } }, [
          el("div", { text: title.no, style: { fontSize: "24px" } }),
          el("div", { text: title.name, style: { fontSize: "72px", margin: "18px 0" } }),
          el("div", { text: title.read, style: { fontSize: "20px" } }),
          el("div", { text: title.sub, style: { fontSize: "18px", marginTop: "18px" } }),
        ]));
      }
      shield.append(card); started = performance.now();
      SE.jingle(); // 従来と同じ正規SEを画像準備後に一度だけ。
      scheduleEnd(context && !media.matches ? CH1_TITLE_TIMING.duration : CH1_TITLE_TIMING.hold);
      if (context && !media.matches) frame = requestAnimationFrame(tick);
    };
    host.append(shield);
    window.addEventListener("keydown", blockKey, true);
    window.addEventListener("keyup", blockRelease, true);
    window.addEventListener("pagehide", cancel);
    signal?.addEventListener("abort", cancel, { once: true });
    media.addEventListener("change", reduce);
    removeState = on("hud", () => { if (state !== owner) cancel(); });
    observer = new MutationObserver(() => { if (!shield.isConnected) cancel(); });
    observer.observe(host, { childList: true });
    imageTimer = setTimeout(() => begin(false), CH1_TITLE_TIMING.imageTimeout);
    image.onload = () => {
      (image.decode ? image.decode() : Promise.resolve()).then(
        () => begin(image.naturalWidth === 1280 && image.naturalHeight === 720), () => begin(false));
    };
    image.onerror = () => begin(false);
    image.src = title.url;
  });
}
