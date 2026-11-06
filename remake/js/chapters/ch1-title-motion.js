// 第1章の採用画像1枚を表示する。読込・LOAD中断・入力ガードと表示時間は既存契約を保つ。
import { el } from "../core/util.js";
import { layers } from "../core/ui.js";
import { CHAPTER_TITLE_ART } from "../core/chapter-title-art.js";
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { on } from "../core/bus.js";

export const CH1_TITLE_TIMING = Object.freeze({ duration: 4800, hold: 1700, imageTimeout: 15000 });
const title = CHAPTER_TITLE_ART.find(entry => entry.chapter === 1);
let active = null;

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
  let phase = "loading", timer = 0, imageTimer = 0, endAt = 0;
  let removeState = () => {}, observer;
  return new Promise(resolve => {
    const finish = (cancelled = false) => {
      if (phase === "done") return;
      const art = shield.dataset.art || "none";
      phase = "done"; clearTimeout(timer); clearTimeout(imageTimer);
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
    const scheduleEnd = ms => {
      clearTimeout(timer); endAt = performance.now() + ms;
      timer = setTimeout(() => finish(!isCurrent()), ms);
    };
    const reduce = () => {
      if (phase !== "playing" || !media.matches) return;
      scheduleEnd(Math.min(Math.max(0, endAt - performance.now()), CH1_TITLE_TIMING.hold));
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
        // 最新方針: 人物の切り分けや装飾は使わず、採用済み画像をそのまま1枚表示する。
        image.alt = ""; image.setAttribute("aria-hidden", "true");
        Object.assign(image.style, { width: "100%", height: "100%", objectFit: "contain" });
        // 共通章題と同じ出現（.ct-reveal）。第1章の絵は白地なので、もやも白で重ねる。
        card.classList.add("ct-reveal"); card.dataset.tone = "light";
        card.append(image);
      } else {
        shield.dataset.art = "text";
        card.replaceChildren(el("div", { style: { textAlign: "center", color: "#fff", maxWidth: "95%" } }, [
          el("div", { text: title.no, style: { fontSize: "24px" } }),
          el("div", { text: title.name, style: { fontSize: "72px", margin: "18px 0" } }),
          el("div", { text: title.read, style: { fontSize: "20px" } }),
          el("div", { text: title.sub, style: { fontSize: "18px", marginTop: "18px" } }),
        ]));
      }
      shield.append(card);
      SE.jingle(); // 従来と同じ正規SEを画像準備後に一度だけ。
      scheduleEnd(ready && !media.matches ? CH1_TITLE_TIMING.duration : CH1_TITLE_TIMING.hold);
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
