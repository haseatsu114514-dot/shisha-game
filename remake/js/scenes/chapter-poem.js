// 巻頭ポエム（序詩と第1〜5章の章頭詩）。会話ウインドウではなく、専用の「読ませる」画面で出す。
// 詩の本文と意図は brand/chant_poems.md、台本は data/dialogue/chapter_poems.json（1行 = 詩の1行。gap:true は連の切れ目）。
// 置き場所: 各章の詩＝その章の章タイトルの直前（第1章の詩は序詩を兼ねる。コールドオープンの後）。
// 見せ方: 詩の上に、横長の漫画風のコマ絵（metadata.panel。img/ui/poems/）を細い枠つきで出す（必ず出す。届くまで待つ）。
//        絵の指定が無い・壊れていて読めない詩だけは、詩だけを全面に出す。
//        詩を連ごとの「場面」に分け、1場面ずつ読ませる。暗い面に縦書きの明朝で、右の行から1行ずつ、ぼかしが晴れて浮かぶ。
//        読み終えた場面は消え、次の連が浮かぶ。最後の連を読み終えたら全体が暗く閉じ、続けて章タイトルが出る。
//        漢字には「漢字《よみ》」のふりがな。タップ／Enter／Space で、読んでいる途中なら その場面の残りを出し、読み終えていれば次の場面へ。
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

/** 詩の行を連（gap:true の行から次の連）ごとの場面に分ける */
export function poemPages(lines = []) {
  const pages = [];
  for (const line of lines) {
    if (line.gap || !pages.length) pages.push([]);
    pages.at(-1).push(line);
  }
  return pages;
}

// 時間の決まり（ms）。短い詩を、急かさずに読ませる。
// 2026-11-13 オーナー「詩のスピードが早くて読みづらかった」で全体を約1.5倍ゆっくりに（1章ぶん 約10〜12秒→約15〜19秒・OSP21）。
// 行の出方・場面の分け方・タップで先へ進めることは変えていない。
const FADE_IN = 700;         // 暗い面が現れる
const FADE_OUT = 900;        // 最後の場面のあと、全体が暗く閉じる（続けて章タイトル）
const PANEL_BEAT = 1200;     // コマ絵が浮かんでから、詩の最初の行が出るまで
const TURN = 900;            // 場面から場面へ（消えて、次が浮かぶ）
const LINE_BASE = 760;       // 1行ぶんの間（基本）
const LINE_PER_CHAR = 42;    // 字数に応じた読みの間
const LINE_MIN = 1050, LINE_MAX = 1900; // 1行ぶんの間の下限・上限
const HOLD_MID = 1800;       // 読み終えてから次の場面へ進むまで（基本）
const HOLD_LAST = 3200;      // 最後の場面は長めに余韻を置く
const HOLD_PER_CHAR = 65;
const GUARD = 280;           // 段の切り替え直後の誤タップで飛ばさない

const charsOf = (line) => [...plainPoemLine(line.text).replaceAll(" ", "")].length;
const lineDelay = (line) => Math.min(LINE_MAX, Math.max(LINE_MIN, LINE_BASE + LINE_PER_CHAR * charsOf(line)));
const holdFor = (group, last) => (last ? HOLD_LAST : HOLD_MID) + HOLD_PER_CHAR * group.reduce((sum, line) => sum + charsOf(line), 0);

/**
 * 詩を読ませる。最後まで読ませたら true、章が破棄された・中断された場合は false。
 * - owner を渡すと owner.controller に載せ、章の離脱（pagehide 等）で止められる（ch2〜ch5 の会話と同じ）。
 * - current(owner) が false になった場合は読了扱いにせず false。呼び出し元は titleSeen を立てずに戻る。
 * 読了の保存は呼び出し元が行う（章タイトルと同じ titleSeen の判定に乗せ、再開時に繰り返さない）。
 */
export async function playChapterPoem(key, options = {}) {
  const releaseBgm = silenceBgm();
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
