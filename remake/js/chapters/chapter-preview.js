// 章末の次回予告の共通プレイヤー。単体再生はセーブ/本編状態を変更しない。
// 予告ごとの差分（台本・素材・文言・曲の作り）は登録表 PREVIEWS に集める（DESIGN 7-1）。
import { el } from "../core/util.js";
import { layers, imageReady } from "../core/ui.js";
import { config } from "../core/state.js";
import { stopBgm } from "../core/audio.js";
import { createPreviewScore } from "./preview-score.js";
import { composeCueNotes } from "./preview-cue.js";
import { createChapterSample } from "./chapter-preview-samples.js";

// キーは「予告が映す次章」の番号で、台本ファイル名・素材フォルダと揃える。
// seenFlag だけは「終わった章の番号」方式の既存命名を引き継ぐ（DESIGN 7-2）。
// フラグの保存は呼び出し側（各章の完了画面）が行い、プレイヤーは触らない。
export const PREVIEWS = {
  ch2: {
    scriptUrl: "../data/chapter_previews/ch2.json",
    assetDir: "../assets/cgs/ch2_preview/",
    seenFlag: "_ch1_preview_seen",
    labels: {
      aria: "第1章の終わりと第2章の次回予告",
      counter: "次回予告",
      prologueCounter: "一台の、そのあと。",
      loading: "次回予告を準備しています……",
    },
    // A/B/C の比較案（chapter-preview-samples）は第2章予告だけの仕組み。
    samples: true,
    // score.kind: "legacy"=第1章の47.8秒固定の専用曲のまま、"cue"=preview-cue.js の
    // 共通スコア（arrangement に air/bell/titleChord/level の章別パラメータを書く）。
    score: { kind: "legacy" },
  },
  // 予告1（第2章末→第3章『嘘つきたちの夜』）。曲は cue 駆動で、調を第1章より少し上げる。
  ch3: {
    scriptUrl: "../data/chapter_previews/ch3.json",
    assetDir: "../assets/cgs/ch3_preview/",
    seenFlag: "_ch2_preview_seen",
    labels: {
      aria: "第2章の終わりと第3章の次回予告",
      counter: "次回予告",
      prologueCounter: "トロフィーの、そのあと。",
      loading: "次回予告を準備しています……",
    },
    score: { kind: "cue", arrangement: { air: 47, bell: 79, titleChord: [59, 62, 66, 71], level: 1 } },
  },
  // 予告2（第3章末→第4章『継承の煙』）。cue 駆動で、調を予告1より少し下げる。
  ch4: {
    scriptUrl: "../data/chapter_previews/ch4.json",
    assetDir: "../assets/cgs/ch4_preview/",
    seenFlag: "_ch3_preview_seen",
    labels: {
      aria: "第3章の終わりと第4章の次回予告",
      counter: "次回予告",
      prologueCounter: "約束の、そのあと。",
      loading: "次回予告を準備しています……",
    },
    score: { kind: "cue", arrangement: { air: 43, bell: 74, titleChord: [55, 59, 62, 65], level: 1 } },
  },
  // 予告3（第4章末→第5章『機械仕掛けの神』）。cue 駆動。予告はここまでで、第5章の終わりには置かない。
  ch5: {
    scriptUrl: "../data/chapter_previews/ch5.json",
    assetDir: "../assets/cgs/ch5_preview/",
    seenFlag: "_ch4_preview_seen",
    labels: {
      aria: "第4章の終わりと第5章の次回予告",
      counter: "次回予告",
      prologueCounter: "帰郷の、そのあと。",
      loading: "次回予告を準備しています……",
    },
    score: { kind: "cue", arrangement: { air: 45, bell: 83, titleChord: [57, 60, 64, 71], level: 1 } },
  },
};

let active = null;
const scriptPromises = new Map();

function loadScript(entry) {
  let promise = scriptPromises.get(entry.scriptUrl);
  if (!promise) {
    promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(entry.scriptUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`Preview HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.frames) || !data.frames.length || data.frames.some(f => !(f.duration > 0))) {
          throw new Error("Invalid chapter preview");
        }
        return data;
      } finally { clearTimeout(timeout); }
    })();
    promise.catch(() => { scriptPromises.delete(entry.scriptUrl); });
    scriptPromises.set(entry.scriptUrl, promise);
  }
  return promise;
}

/** 初回/再視聴/確認ページで同じ演出。完走・スキップのみ呼び出し側で既読を保存する。 */
export function playChapterPreview(key, { signal, sample } = {}) {
  const entry = PREVIEWS[key];
  if (!entry) throw new RangeError(`Unknown chapter preview: ${key}`);
  if (active) return active;
  if (signal?.aborted) return Promise.resolve("aborted");
  active = new Promise(resolve => {
    const previousFocus = document.activeElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const screen = el("div.preview-screen", { dataset: { test: "preview-screen" }, "aria-live": "polite", "aria-atomic": "true" });
    const skip = el("button.preview-control", { type: "button", text: "予告をスキップ", dataset: { test: "preview-skip" } });
    const pause = el("button.preview-control", { type: "button", text: "一時停止", disabled: true, dataset: { test: "preview-pause" }, "aria-pressed": "false" });
    const sound = el("button.preview-control", { type: "button", text: "音を切る", dataset: { test: "preview-sound" }, "aria-pressed": "false" });
    const counter = el("span.preview-counter", { text: entry.labels.counter, "aria-hidden": "true" });
    const progress = el("i");
    const root = el(`div.chapter-preview${reduced ? ".reduced" : ""}`, {
      role: "dialog", tabindex: "-1", "aria-modal": "true", "aria-label": entry.labels.aria,
      dataset: { test: "chapter-preview", phase: "loading", elapsed: "0" },
    }, [screen, el("div.preview-controls", [counter, sound, pause, skip]), el("div.preview-progress", { "aria-hidden": "true" }, [progress])]);
    let done = false, mounted = false, data = null, score = null;
    let time = 0, last = 0, frame = -1, raf = null, generation = 0;
    let userPaused = false, soundOff = !!(config.mute || config.muted) || !(config.bgmVolume > 0);
    const musicWasDisabled = soundOff;
    const host = layers.fx || document.getElementById("fx");

    function finish(result) {
      if (done) return;
      done = true; generation++;
      cancelAnimationFrame(raf);
      score?.stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      root.removeEventListener("keydown", key);
      window.removeEventListener("pagehide", abort);
      signal?.removeEventListener("abort", abort);
      root.remove();
      if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
      active = null;
      resolve(result);
    }
    const abort = () => finish("aborted");
    const observer = new MutationObserver(() => { if (mounted && !root.isConnected) abort(); });

    function soundLabel() {
      sound.textContent = musicWasDisabled ? "音量設定：消音" : soundOff ? "音を入れる" : "音を切る";
      sound.setAttribute("aria-pressed", String(soundOff));
      sound.disabled = musicWasDisabled;
    }

    function synchronizePause() {
      if (!data || !score || done || root.dataset.phase === "unavailable") return;
      const paused = userPaused || document.hidden;
      root.dataset.phase = paused ? "paused" : "playing";
      root.classList.toggle("paused", paused);
      pause.textContent = userPaused ? "再生する" : "一時停止";
      pause.setAttribute("aria-pressed", String(userPaused));
      last = performance.now();
      if (paused) score.pause();
      else score.resume();
    }
    const visibility = () => synchronizePause();

    function key(event) {
      if (event.key === "Escape") { event.preventDefault(); finish("skipped"); }
      // 字送りの連打は予告を飛ばさない。Spaceの一時停止はボタン上では通常の操作を使う。
      if (event.key === " " && !event.repeat && event.target.tagName !== "BUTTON") {
        event.preventDefault(); userPaused = !userPaused; synchronizePause();
      }
      if (event.key === "Tab") {
        const buttons = [...root.querySelectorAll("button:not(:disabled)")];
        const first = buttons[0], lastButton = buttons.at(-1);
        if (document.activeElement === root) { event.preventDefault(); (event.shiftKey ? lastButton : first)?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); lastButton?.focus(); }
        else if (!event.shiftKey && document.activeElement === lastButton) { event.preventDefault(); first?.focus(); }
      }
    }

    function draw(index) {
      frame = index;
      const cut = data.frames[index];
      root.dataset.cut = cut.id;
      screen.dataset.kind = cut.kind;
      screen.dataset.tone = cut.tone || "";
      const parts = [];
      if (cut.art) parts.push(el(`img.preview-art.motion-${cut.move || "still"}`, {
        src: `${entry.assetDir}${cut.art}.webp`, alt: "", style: { "--duration": `${cut.duration}ms` },
      }));
      parts.push(el("div.preview-grain", { "aria-hidden": "true" }));
      if (cut.kind === "slate") {
        parts.push(el("div.preview-slate", [el("small", { text: cut.kicker }), el("strong", { text: cut.text }), el("span", { text: "NEXT EPISODE" })]));
      } else if (cut.kind === "title") {
        parts.push(el("div.preview-chapter-title", [
          el("small", { text: cut.kicker }), el("strong", { text: data.title }),
          el("span", { text: `${data.read} / ${data.english}` }), el("b", { text: data.sub }),
        ]));
      } else {
        if (cut.kicker) parts.push(el("div.preview-kicker", { text: cut.kicker }));
        parts.push(el("div.preview-caption", { dataset: { test: "preview-caption" } }, [
          cut.speaker ? el("small", { text: cut.speaker }) : null, el("p", { text: cut.text }),
        ]));
      }
      parts.push(el("span.preview-bug", { text: "水煙前線", "aria-hidden": "true" }));
      screen.replaceChildren(...parts);
    }

    function tick(now) {
      if (done) return;
      if (!userPaused && !document.hidden && root.dataset.phase === "playing") {
        // A stalled rendering frame must not consume an unseen subtitle.
        time += Math.min(Math.max(0, now - last), 250);
      }
      last = now;
      root.dataset.elapsed = String(Math.round(time));
      progress.style.width = `${Math.min(100, time / data.duration * 100)}%`;
      const remaining = Math.max(0, Math.ceil((data.duration - time) / 1000));
      counter.textContent = frame < 2 ? entry.labels.prologueCounter : `${entry.labels.counter}　${remaining}秒`;
      let start = 0, index = data.frames.length - 1;
      for (let i = 0; i < data.frames.length; i++) {
        if (time < start + data.frames[i].duration) { index = i; break; }
        start += data.frames[i].duration;
      }
      if (index !== frame) { draw(index); score.seek(time / 1000); if (userPaused || document.hidden) score.pause(); }
      if (time >= data.duration) { finish("completed"); return; }
      raf = requestAnimationFrame(tick);
    }

    async function prepare() {
      const attempt = ++generation;
      root.dataset.phase = "loading";
      screen.replaceChildren(el("div.preview-loading", { role: "status", text: entry.labels.loading }));
      try {
        const next = await loadScript(entry);
        const arts = [...new Set(next.frames.map(f => f.art).filter(Boolean))];
        const fontReady = new Promise(resolve => {
          const timeout = setTimeout(resolve, 4000);
          document.fonts.load('400 30px "Chapter Preview Dot"', "水煙前線次回予告みんと")
            .catch(() => {}).finally(() => { clearTimeout(timeout); resolve(); });
        });
        const [loaded] = await Promise.all([
          Promise.all(arts.map(name => imageReady(`${entry.assetDir}${name}.webp`, 15000))),
          fontReady,
        ]);
        if (done || generation !== attempt) return;
        if (loaded.some(ok => !ok)) throw new Error("Preview image unavailable");
        data = entry.samples ? createChapterSample(next, sample ?? next.presentation) : next;
        if (data.sample) root.classList.add(`sample-${data.sample}`);
        root.dataset.sample = data.sample || "production";
        stopBgm(0.15);
        score = entry.score?.kind === "cue"
          ? createPreviewScore({ timeline: data.frames, events: composeCueNotes(data.frames, entry.score.arrangement) })
          : createPreviewScore(data.sample === "rush"
            ? { timeline: data.frames, originalTimeline: next.frames }
            : data.sample === "quiet" ? { timeline: data.frames, quiet: true } : {});
        score.setMuted(soundOff);
        time = 0; last = performance.now();
        pause.disabled = false;
        root.dataset.phase = "playing";
        draw(0); score.seek(0); synchronizePause();
        raf = requestAnimationFrame(tick);
      } catch {
        if (done || generation !== attempt) return;
        root.dataset.phase = "unavailable";
        screen.replaceChildren(el("div.preview-loading", [
          el("p", { text: "予告の画像を読み込めませんでした。" }),
          el("p", { text: "ここまでの章の進行は保持されています。" }),
          el("button.preview-control", { type: "button", text: "もう一度読み込む", dataset: { test: "preview-retry" }, onclick: prepare }),
        ]));
      }
    }

    skip.addEventListener("click", () => finish("skipped"));
    pause.addEventListener("click", () => { userPaused = !userPaused; synchronizePause(); });
    sound.addEventListener("click", () => { soundOff = !soundOff; score?.setMuted(soundOff); soundLabel(); });
    root.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", abort);
    signal?.addEventListener("abort", abort, { once: true });
    soundLabel();
    if (!host) { finish("aborted"); return; }
    host.append(root); mounted = true;
    observer.observe(document.documentElement, { childList: true, subtree: true });
    root.focus({ preventScroll: true });
    prepare();
  });
  return active;
}
