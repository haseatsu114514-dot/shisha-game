// 巻頭ポエム（序詩と第1〜5章の章頭詩）。会話ウインドウではなく、専用の「読ませる」画面で出す。
// 詩の本文と意図は brand/chant_poems.md、台本は data/dialogue/chapter_poems.json（1行 = 詩の1行。gap:true は連の切れ目）。
// 置き場所: 序詩＝タイトルから「はじめから」を選んだ直後、各章の詩＝その章の章タイトルの直前。
// 見せ方: 詩の上に、横長の漫画風のコマ絵（metadata.panel。img/ui/poems/）を細い枠つきで出す。絵が無い・読めない詩は、詩だけを全面に出す。
//        詩を連ごとの「場面」に分け、1場面ずつ読ませる。暗い面に縦書きの明朝で、右の行から1行ずつ、ぼかしが晴れて浮かぶ。
//        読み終えた場面は消え、次の連が浮かぶ。最後の連を読み終えたら全体が暗く閉じ、続けて章タイトルが出る。
//        漢字には「漢字《よみ》」のふりがな。タップ／Enter／Space で、読んでいる途中なら その場面の残りを出し、読み終えていれば次の場面へ。
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

/** 詩の上に出す横長のコマ絵（img/ui/poems/）。本物の絵に差し替えるときは、台本の metadata.panel のファイル名を替える */
const panelUrl = (name) => new URL(`../../img/ui/poems/${name}`, import.meta.url).href;

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

/** 詩の行を連（gap:true の行から次の連）ごとの場面に分ける */
export function poemPages(lines = []) {
  const pages = [];
  for (const line of lines) {
    if (line.gap || !pages.length) pages.push([]);
    pages.at(-1).push(line);
  }
  return pages;
}

// 時間の決まり（ms）。短い詩を、急かさず・長引かせずに読ませる。
const FADE_IN = 700;         // 暗い面が現れる
const FADE_OUT = 900;        // 最後の場面のあと、全体が暗く閉じる（続けて章タイトル）
const PANEL_BEAT = 800;      // コマ絵が浮かんでから、詩の最初の行が出るまで
const TURN = 650;            // 場面から場面へ（消えて、次が浮かぶ）
const LINE_BASE = 460;       // 1行ぶんの間（基本）
const LINE_PER_CHAR = 26;    // 字数に応じた読みの間
const HOLD_MID = 1100;       // 読み終えてから次の場面へ進むまで（基本）
const HOLD_LAST = 2000;      // 最後の場面は長めに余韻を置く
const HOLD_PER_CHAR = 40;
const GUARD = 280;           // 段の切り替え直後の誤タップで飛ばさない

const charsOf = (line) => [...plainPoemLine(line.text).replaceAll(" ", "")].length;
const lineDelay = (line) => Math.min(1200, Math.max(650, LINE_BASE + LINE_PER_CHAR * charsOf(line)));
const holdFor = (group, last) => (last ? HOLD_LAST : HOLD_MID) + HOLD_PER_CHAR * group.reduce((sum, line) => sum + charsOf(line), 0);

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
  // コマ絵: 読み込んで・デコードし終えたものだけを出す。読めなければ（失敗・時間切れ）詩だけを全面に出す。
  let panel = null;
  if (poem.metadata?.panel) {
    const url = panelUrl(poem.metadata.panel);
    if (await imageReady(url, 2500) && !signal.aborted) {
      panel = el("figure.cp-panel", { "data-test": "chapter-poem-panel" }, [
        el("img", { src: url, alt: poem.metadata.panel_alt || "", draggable: false }),
      ]);
    }
  }
  if (signal.aborted || (owner && !current(owner))) {
    if (owner && owner.controller === controller) owner.controller = null;
    return false;
  }
  const groups = poemPages(lines);
  const pages = groups.map((group, index) => el(`div.cp-page${index === groups.length - 1 ? ".last" : ""}`, [
    el("div.cp-body", group.map((line) => el("p.cp-line", poemLineNodes(line.text)))),
  ]));
  const next = el("div.cp-next", { "aria-hidden": "true", text: "▼" });
  const card = el(`div.chapter-poem${panel ? ".has-panel" : ""}`, {
    dataset: { test: "chapter-poem", poem: id, phase: "revealing", page: "0", pages: String(pages.length) },
    role: "document", "aria-label": lines.map((line) => plainPoemLine(line.text)).join(" "),
  }, [el("div.cp-mist", { "aria-hidden": "true" }), panel, el("div.cp-stage", pages), next]);
  poemTest.shown.push({ id, lines: lines.map((line) => plainPoemLine(line.text)), pages: groups.length, panel: !!panel, at: Date.now() });

  let phaseAt = performance.now();
  let phase = "revealing"; // 場面ごとに revealing → holding → turning、最後に out
  let pageIndex = 0;
  const setPhase = (name) => { phase = name; phaseAt = performance.now(); card.dataset.phase = name; };
  let skipReveal = () => {}, turnPage = () => {}, fastNow = () => {};
  let fast = false;
  const fastSignal = new Promise((resolve) => { fastNow = resolve; });
  const aborted = new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  const linesOf = (page) => [...page.querySelectorAll(".cp-line")];
  const showAllIn = (page) => linesOf(page).forEach((node) => node.classList.add("on"));
  // 読んでいる途中ならその場面の残りの行を出し、読み終えていれば次の場面へ（直後の誤タップは無視）。
  const advance = () => {
    if (performance.now() - phaseAt < GUARD) return;
    if (phase === "revealing") { showAllIn(pages[pageIndex]); skipReveal(); } else if (phase === "holding") turnPage();
  };
  const skipAll = () => { fast = true; showAllIn(pages[pageIndex]); skipReveal(); turnPage(); fastNow(); };
  const onKey = (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); advance(); }
    else if (event.key === "Control") { event.preventDefault(); event.stopPropagation(); skipAll(); }
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
  try {
    layers.fx.append(card);
    void card.offsetWidth;
    if (vnTest.turbo) {
      // テスト・自動送り: 演出を飛ばし、最後の場面を全行出してすぐ閉じる。
      pages.forEach(showAllIn);
      pageIndex = pages.length - 1; card.dataset.page = String(pageIndex);
      pages.at(-1).classList.add("now"); card.classList.add("show", "turbo");
      panel?.classList.add("on");
      await nextFrame();
    } else {
      await nextFrame();
      card.classList.add("show");
      await wait(FADE_IN);
      const calm = reducedMotion();
      if (panel) { panel.classList.add("on"); await wait(calm ? 0 : PANEL_BEAT); }
      for (const [index, page] of pages.entries()) {
        if (signal.aborted || fast) break;
        pageIndex = index; card.dataset.page = String(index);
        const revealed = new Promise((resolve) => { skipReveal = resolve; });
        const turned = new Promise((resolve) => { turnPage = resolve; });
        setPhase("revealing");
        page.classList.add("now");
        if (calm) showAllIn(page);
        else {
          for (const [i, node] of linesOf(page).entries()) {
            if (signal.aborted || fast) break;
            node.classList.add("on");
            await wait(lineDelay(groups[index][i]), revealed);
          }
          showAllIn(page);
        }
        if (signal.aborted || fast) break;
        setPhase("holding");
        const last = index === pages.length - 1;
        await wait(holdFor(groups[index], last), turned);
        if (signal.aborted || fast) break;
        if (!last) {
          setPhase("turning");
          page.classList.remove("now");
          await wait(TURN);
        }
      }
    }
    if (!signal.aborted) {
      setPhase("out");
      card.classList.add("out");
      await Promise.race([sleep(vnTest.turbo || fast ? 0 : FADE_OUT), aborted]);
    }
  } finally {
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("keyup", onKeyUp, true);
    card.remove();
    if (owner && owner.controller === controller) owner.controller = null;
  }
  return !signal.aborted && (!owner || current(owner));
}
