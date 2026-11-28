// 巻頭ポエム（序詩と第1〜5章の章頭詩）。会話ウインドウではなく、専用の「読ませる」画面で出す。
// 詩の本文と意図は brand/chant_poems.md、台本は data/dialogue/chapter_poems.json（1行 = 詩の1行。gap:true は連の切れ目）。
// 置き場所: 各章の詩＝その章の章タイトルの直前（第1章の詩は序詩を兼ねる。コールドオープンの後）。
// 見せ方: 詩の上に、横長の漫画風のコマ絵（metadata.panel。img/ui/poems/）を細い枠つきで出す（必ず出す。届くまで待つ）。
//        絵の指定が無い・壊れていて読めない詩だけは、詩だけを全面に出す。
//        縦書きの全文を一画面で浮かべ、連の区切りは列の余白で示す。
//        全文が出たら、タップ／Enter／Space または時間経過で章タイトルへ進む。
import { silenceBgm } from "../core/audio.js";
import { DB } from "../core/data.js";
import { el, nextFrame, sleep } from "../core/util.js";
import { layers, clearScreen, imageReady, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { reducedMotion } from "../core/transition-kit.js";
import { chapterTitleEntry } from "../core/chapter-title-art.js";
import { vnTest } from "../vn/engine.js";

/** 詩の指定（章の番号 1〜5）→ 台詞ID。序詩は第1章の詩に統合した */
export const CHAPTER_POEM_IDS = Object.freeze({
  1: "poem_ch1", 2: "poem_ch2", 3: "poem_ch3", 4: "poem_ch4", 5: "poem_ch5",
});

/** テスト用: 出した詩の記録（id・全行・出した時刻） */
export const poemTest = { shown: [] };

/** 詩の上に出す横長のコマ絵（img/ui/poems/）。本物の絵に差し替えるときは、台本の metadata.panel のファイル名を替える */
const panelUrl = (name) => new URL(`../../img/ui/poems/${name}`, import.meta.url).href;
/**
 * コマ絵は必ず出す（2026-11-13 オーナー「ブリーチ風を大事にしてるから横長の漫画はマストで出したい」・OSP20）。
 * 以前は2.5秒で読めなければ詩だけにしていたため、回線が混んでいると絵が出なかった。
 * 今は届くまで待つ（0.5秒を超えたら、ほかの待ちと同じロード表示 loadingNotice。LDC40 でそろえた漫画つきの画面）。
 * 読めなかった（通信の失敗）ときは1回だけ読み直す。
 * それでも読めない（壊れた絵・つながらない）ときだけ、詩だけを全面に出す（ゲームを止めない）。
 */
const PANEL_WAITS = Object.freeze([30000, 60000]);
const poemPanelUrl = (key) => {
  const name = DB.dialogues[CHAPTER_POEM_IDS[key]]?.metadata?.panel;
  return name ? panelUrl(name) : null;
};

/** 詩のコマ絵を先に読み始める（取得とデコード）。詩を出す前の、余裕のあるところで呼ぶ。進行は変えない。 */
export function preparePoemPanel(key) {
  const url = poemPanelUrl(key);
  return url ? imageReady(url, PANEL_WAITS[0]) : Promise.resolve(false);
}

/** コマ絵が届くまで待つ（0.5秒を超えたら、ほかの待ちと同じロード表示）。読めたら true。 */
function waitPoemPanel(url, aborted) {
  const load = (async () => {
    for (const ms of PANEL_WAITS) {
      const loaded = await Promise.race([imageReady(url, ms), aborted.then(() => null)]);
      if (loaded !== false) return loaded === true;
    }
    return false;
  })();
  return withLoadingNotice(load, loadingNotice("詩を準備しています…"));
}

/** コマ絵の比率の範囲（横:縦）。範囲の内なら絵の比率のまま、外なら端の比率の枠に収める（tools/poem_panel_cut.py と同じ） */
export const PANEL_RATIO = Object.freeze({ min: 4, max: 5.6, fallback: 16 / 3 });

const RUBY = /([\p{Script=Han}々]+)《([^》]+)》/gu;
/** 「漢字《よみ》」を除いた本文（読み上げ・字数・テスト用） */
export const plainPoemLine = (text = "") => String(text).replace(RUBY, "$1");

/** 1行をふりがな付きの DOM にする。空白（拍）はそのまま残す */
export function poemLineNodes(text = "") {
  const nodes = [];
  let last = 0;
  for (const m of String(text).matchAll(RUBY)) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(el("ruby", [m[1], el("rp", { text: "（" }), el("rt", { text: m[2] }), el("rp", { text: "）" })]));
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// 時間の決まり（ms）。全文が出てから字数に応じた読書時間を確保する。
const FADE_IN = 700;
const FADE_OUT = 900;
const PANEL_BEAT = 1200;
const TEXT_FADE = 1300;
const HOLD_BASE = 6000;
const HOLD_PER_CHAR = 135;
const GUARD = 280;

const charsOf = (line) => [...plainPoemLine(line.text).replaceAll(" ", "")].length;
const holdFor = (lines) => HOLD_BASE + HOLD_PER_CHAR * lines.reduce((sum, line) => sum + charsOf(line), 0);

/**
 * 詩を読ませる。最後まで読ませたら true、章が破棄された・中断された場合は false。
 * - owner を渡すと owner.controller に載せ、章の離脱（pagehide 等）で止められる（ch2〜ch5 の会話と同じ）。
 * - current(owner) が false になった場合は読了扱いにせず false。呼び出し元は titleSeen を立てずに戻る。
 * 読了の保存は呼び出し元が行う（章タイトルと同じ titleSeen の判定に乗せ、再開時に繰り返さない）。
 */
export async function playChapterPoem(key, options = {}) {
  const releaseBgm = silenceBgm({ ui: true });
  try {
    return await showChapterPoem(key, options);
  } finally {
    releaseBgm();
  }
}

async function showChapterPoem(key, { owner = null, current = () => true } = {}) {
  const id = CHAPTER_POEM_IDS[key];
  if (!id) throw new Error(`巻頭ポエムの指定が不正です: ${key}`);
  const poem = DB.dialogues[id];
  if (!poem?.lines?.length) throw new Error(`台本がありません: ${id}`);
  if (owner && !current(owner)) return false;
  clearScreen();
  // このあとの章タイトルの絵を、詩を読んでいる間に先読みする（章タイトルの待ちを短くする）。
  const art = typeof key === "number" ? chapterTitleEntry(key)?.url : null;
  if (art) void imageReady(art, 15000);

  const controller = new AbortController();
  if (owner) owner.controller = controller;
  const { signal } = controller;
  const aborted = new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  const lines = poem.lines;
  // コマ絵: 届くまで待ち、デコードし終えたものを出す（必ず出す・OSP20）。読めない絵のときだけ詩だけを全面に出す。
  let panel = null;
  if (poem.metadata?.panel) {
    const url = panelUrl(poem.metadata.panel);
    if (await waitPoemPanel(url, aborted) && !signal.aborted) {
      const img = el("img", { src: url, alt: poem.metadata.panel_alt || "", draggable: false });
      await img.decode?.().catch(() => {});
      // 枠は絵の比率のまま（生成AIの絵は 16:3 から縦に少し伸びることがあり、切ると顔や小物が欠ける）
      const natural = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : PANEL_RATIO.fallback;
      const ratio = Math.min(PANEL_RATIO.max, Math.max(PANEL_RATIO.min, natural));
      panel = el("figure.cp-panel", { "data-test": "chapter-poem-panel", style: { aspectRatio: String(ratio) } }, [img]);
    }
  }
  // 次の章の詩の絵も、いまのうちにブラウザへ取っておく（次の章の始まりで待たせない）。
  if (typeof key === "number" && CHAPTER_POEM_IDS[key + 1]) void preparePoemPanel(key + 1);
  if (signal.aborted || (owner && !current(owner))) {
    if (owner && owner.controller === controller) owner.controller = null;
    return false;
  }
  const body = el("div.cp-body", lines.map((line) =>
    el(line.gap ? "p.cp-line.stanza-start" : "p.cp-line", poemLineNodes(line.text))));
  const next = el("div.cp-next", { "aria-hidden": "true", text: "▼" });
  const card = el(`div.chapter-poem${panel ? ".has-panel" : ""}`, {
    dataset: { test: "chapter-poem", poem: id, phase: "revealing" },
    role: "document", "aria-label": lines.map((line) => plainPoemLine(line.text)).join(" "),
  }, [el("div.cp-mist", { "aria-hidden": "true" }), panel, el("div.cp-stage", [el("div.cp-page", [body])]), next]);
  poemTest.shown.push({ id, lines: lines.map((line) => plainPoemLine(line.text)), panel: !!panel, at: Date.now() });

  let shownAt = 0;
  let finishReading, fastNow;
  const finished = new Promise((resolve) => { finishReading = resolve; });
  const fastSignal = new Promise((resolve) => { fastNow = resolve; });
  let fast = false;
  const advance = () => {
    if (card.dataset.phase === "holding" && performance.now() - shownAt >= GUARD) finishReading();
  };
  const onKey = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) advance();
    } else if (event.key === "Control") {
      event.preventDefault();
      event.stopPropagation();
      fast = true;
      fastNow();
    }
  };
  const swallow = (event) => { event.preventDefault(); event.stopPropagation(); };
  card.addEventListener("pointerdown", (event) => { swallow(event); advance(); });
  card.addEventListener("pointerup", swallow);
  card.addEventListener("click", swallow);
  window.addEventListener("keydown", onKey, true);
  // Controlのkeyupは既存SKIP解除へ通す。押しっぱなし状態を次の会話へ残さない。
  const onKeyUp = (event) => { if (event.key === " " || event.key === "Enter") swallow(event); };
  window.addEventListener("keyup", onKeyUp, true);

  const wait = (ms, ...others) => Promise.race([sleep(ms), aborted, fastSignal, ...others]);
  // 縦持ちでも同じ札を使う。top layer に載せると横用の舞台の縮尺を受けず、
  // 回転しても全文の表示状態と入力待ちを引き継げる。
  const root = document.documentElement;
  function fitOrientation() {
    if (!card.showPopover || !card.isConnected) return;
    if (root.dataset.vt === "on") {
      card.popover = "manual";
      if (!card.matches(":popover-open")) card.showPopover();
    } else if (card.hasAttribute("popover")) {
      card.hidePopover();
      card.removeAttribute("popover");
    }
  }
  const orientation = new MutationObserver(fitOrientation);
  try {
    layers.fx.append(card);
    orientation.observe(root, { attributes: true, attributeFilter: ["data-vt"] });
    fitOrientation();
    void card.offsetWidth;
    if (vnTest.turbo) {
      card.classList.add("show", "turbo");
      panel?.classList.add("on");
      body.classList.add("on");
      await nextFrame();
    } else {
      await nextFrame();
      card.classList.add("show");
      await wait(FADE_IN);
      if (panel && !signal.aborted && !fast) {
        panel.classList.add("on");
        await wait(PANEL_BEAT);
      }
      if (!signal.aborted && !fast) {
        body.classList.add("on");
        await wait(reducedMotion() ? 300 : TEXT_FADE);
      }
      if (!signal.aborted && !fast) {
        shownAt = performance.now();
        card.dataset.phase = "holding";
        await wait(holdFor(lines), finished);
      }
    }
    if (!signal.aborted) {
      card.dataset.phase = "out";
      card.classList.add("out");
      await Promise.race([sleep(vnTest.turbo || fast ? 0 : FADE_OUT), aborted]);
    }
  } finally {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keyup", onKeyUp, true);
    orientation.disconnect();
    card.remove();
    if (owner && owner.controller === controller) owner.controller = null;
  }
  return !signal.aborted && (!owner || current(owner));
}
