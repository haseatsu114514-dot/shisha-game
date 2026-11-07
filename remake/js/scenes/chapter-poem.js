// 巻頭ポエム（序詩と第1〜5章の章頭詩）。会話ウインドウではなく、専用の「読ませる」画面で出す。
// 詩の本文と意図は brand/chant_poems.md、台本は data/dialogue/chapter_poems.json（1行 = 詩の1行。gap:true は連の切れ目）。
// 置き場所: 序詩＝タイトルから「はじめから」を選んだ直後、各章の詩＝その章の章タイトルの直前。
// 見せ方: 暗い面に縦書きの明朝。右の行から1行ずつ、ぼかしが晴れて浮かぶ。連の切れ目で一拍おく。
//        漢字には「漢字《よみ》」のふりがな。タップ／Enter／Space で、読み終えていなければ全行を出し、読み終えていれば閉じる。
import { DB } from "../core/data.js";
import { el, nextFrame, sleep } from "../core/util.js";
import { layers, clearScreen, imageReady } from "../core/ui.js";
import { reducedMotion } from "../core/transition-kit.js";
import { chapterTitleEntry } from "../core/chapter-title-art.js";
import { vnTest } from "../vn/engine.js";

/** 詩の指定 → 台詞ID。章は番号（1〜5）、序詩は "prologue" */
export const CHAPTER_POEM_IDS = Object.freeze({
  prologue: "poem_prologue",
  1: "poem_ch1", 2: "poem_ch2", 3: "poem_ch3", 4: "poem_ch4", 5: "poem_ch5",
});

/** テスト用: 出した詩の記録（id・全行・出した時刻） */
export const poemTest = { shown: [] };

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

// 時間の決まり（ms）。短い詩を、急かさず・長引かせずに読ませる。
const FADE_IN = 700;
const FADE_OUT = 900;
const LINE_BASE = 460;       // 1行ぶんの間（基本）
const LINE_PER_CHAR = 26;    // 字数に応じた読みの間
const STANZA_PAUSE = 750;    // 連の切れ目の一拍
const HOLD_BASE = 2400;      // 読み終えてから自動で閉じるまで
const HOLD_PER_CHAR = 30;
const GUARD = 280;           // 段の切り替え直後の誤タップで閉じない

const lineDelay = (line) => {
  const chars = [...plainPoemLine(line.text).replaceAll(" ", "")].length;
  return Math.min(1200, Math.max(650, LINE_BASE + LINE_PER_CHAR * chars));
};

/**
 * 詩を読ませる。最後まで読ませたら true、章が破棄された・中断された場合は false。
 * - owner を渡すと owner.controller に載せ、章の離脱（pagehide 等）で止められる（ch2〜ch5 の会話と同じ）。
 * - current(owner) が false になった場合は読了扱いにせず false。呼び出し元は titleSeen を立てずに戻る。
 * 読了の保存は呼び出し元が行う（章タイトルと同じ titleSeen の判定に乗せ、再開時に繰り返さない）。
 */
export async function playChapterPoem(key, { owner = null, current = () => true } = {}) {
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
  const lines = poem.lines;
  const nodes = lines.map((line) => el(`p.cp-line${line.gap ? ".gap" : ""}`, poemLineNodes(line.text)));
  const next = el("div.cp-next", { "aria-hidden": "true", text: "▼" });
  const card = el("div.chapter-poem", {
    dataset: { test: "chapter-poem", poem: id, phase: "revealing" },
    role: "document", "aria-label": lines.map((line) => plainPoemLine(line.text)).join(" "),
  }, [el("div.cp-mist", { "aria-hidden": "true" }), el("div.cp-body", nodes), next]);
  poemTest.shown.push({ id, lines: lines.map((line) => plainPoemLine(line.text)), at: Date.now() });

  let phaseAt = performance.now();
  let phase = "revealing"; // revealing → holding → out
  const setPhase = (name) => { phase = name; phaseAt = performance.now(); card.dataset.phase = name; };
  let skipReveal, closeNow;
  const revealSkipped = new Promise((resolve) => { skipReveal = resolve; });
  const closed = new Promise((resolve) => { closeNow = resolve; });
  const aborted = new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  const showAll = () => nodes.forEach((node) => node.classList.add("on"));
  // 読み終えていなければ全行を出す。読み終えていれば閉じる（直後の誤タップは無視）。
  const advance = () => {
    if (performance.now() - phaseAt < GUARD) return;
    if (phase === "revealing") { showAll(); skipReveal(); } else if (phase === "holding") closeNow();
  };
  const onKey = (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); advance(); }
    else if (event.key === "Control") { event.preventDefault(); event.stopPropagation(); showAll(); skipReveal(); closeNow(); }
  };
  const swallow = (event) => { event.preventDefault(); event.stopPropagation(); };
  card.addEventListener("pointerdown", (event) => { swallow(event); advance(); });
  card.addEventListener("pointerup", swallow);
  card.addEventListener("click", swallow);
  window.addEventListener("keydown", onKey, true);
  // Controlのkeyupは既存SKIP解除へ通す。押しっぱなし状態を次の会話へ残さない。
  const onKeyUp = (event) => { if (event.key === " " || event.key === "Enter") swallow(event); };
  window.addEventListener("keyup", onKeyUp, true);

  const wait = (ms, ...others) => Promise.race([sleep(ms), aborted, ...others]);
  try {
    layers.fx.append(card);
    void card.offsetWidth;
    if (vnTest.turbo) {
      // テスト・自動送り: 演出を飛ばして全行を出し、すぐ閉じる。
      showAll(); card.classList.add("show", "turbo");
      await nextFrame();
    } else {
      await nextFrame();
      card.classList.add("show");
      await wait(FADE_IN);
      const calm = reducedMotion();
      if (calm) showAll();
      for (const [index, node] of nodes.entries()) {
        if (signal.aborted || phase !== "revealing" || calm) break;
        if (lines[index].gap) await wait(STANZA_PAUSE, revealSkipped);
        if (signal.aborted || phase !== "revealing") break;
        node.classList.add("on");
        await wait(lineDelay(lines[index]), revealSkipped);
      }
      showAll();
      if (!signal.aborted) {
        setPhase("holding");
        const chars = lines.reduce((sum, line) => sum + [...plainPoemLine(line.text)].length, 0);
        await wait(HOLD_BASE + HOLD_PER_CHAR * chars, closed);
      }
    }
    if (!signal.aborted) {
      setPhase("out");
      card.classList.add("out");
      await Promise.race([sleep(vnTest.turbo ? 0 : FADE_OUT), aborted]);
    }
  } finally {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keyup", onKeyUp, true);
    card.remove();
    if (owner && owner.controller === controller) owner.controller = null;
  }
  return !signal.aborted && (!owner || current(owner));
}
