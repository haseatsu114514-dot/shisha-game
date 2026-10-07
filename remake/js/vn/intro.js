// 初登場カットイン: キャラが名乗って名前が出たあと、最初に一度だけ「名前・二つ名・一言」を全画面で出す。
// 文言の正本は data/characters.json の intro_cutin（かふかは kafuka.json の profile）。
//   { title: 二つ名, line: 一言, face: 立ち絵の表情, color: 差し色, name: "alias"=本名を伏せて呼び名だけ }
// 見たかどうかはセーブの flags._intro_<id>（会話の途中で出す・同じセーブでは二度と出さない）
import { el, sleep } from "../core/util.js";
import { DB, displayName, portraitInfo } from "../core/data.js";
import { state } from "../core/state.js";
import { layers, imageReady } from "../core/ui.js";
import { SE } from "../core/audio.js";

const seenKey = (id) => `_intro_${id}`;
const introOf = (id) => DB.characters[id]?.intro_cutin || null;

/** このキャラのカットインを今出すべきか（データがあり・未見で・名前が「？？？」でない） */
export function needsIntro(id) {
  if (!id || !introOf(id) || state.flags[seenKey(id)]) return false;
  return displayName(id, state) !== "？？？";
}

/** 出さずに「見た」ことにする（テストの高速送り用） */
export function markIntroSeen(id) {
  if (introOf(id)) state.flags[seenKey(id)] = true;
}

/**
 * name の書式から本名・読み・呼び名を取り出す
 *   「呼び名 / 本名（読み）」「本名（読み / 呼び名）」「呼び名 / 本名」「本名」
 */
export function nameParts(id) {
  const c = DB.characters[id] || {};
  const raw = String(c.full_name || c.name || id);
  const paren = /（([^）]*)）/.exec(raw);
  const inner = paren ? paren[1].split(" / ").map((s) => s.trim()) : [];
  const outer = raw.replace(/（[^）]*）/g, "").split(" / ").map((s) => s.trim()).filter(Boolean);
  const full = outer.length > 1 ? outer[1] : outer[0];
  const alias = outer.length > 1 ? outer[0] : inner[1] || "";
  return { full, reading: inner[0] || "", alias };
}

/** カットインに出す名前（大きい名前・ふりがな・添える呼び名） */
function introName(id, intro) {
  const shown = displayName(id, state);
  if (intro.name === "alias") return { main: shown, reading: "", sub: "" };
  const { full, reading } = nameParts(id);
  const same = (a, b) => a.replace(/\s/g, "") === b.replace(/\s/g, "");
  return { main: full, reading, sub: same(shown, full) ? "" : shown };
}

/** 1行に収める字の大きさ（半角は約半分の幅で数える） */
function fitSize(text, width, max) {
  const em = [...text].reduce((n, ch) => n + (/[\x20-\x7e]/.test(ch) ? 0.55 : 1), 0) * 1.04;
  return Math.min(max, Math.floor(width / Math.max(1, em)));
}

/** 立ち絵を胸から上で大きく切り取る（manifest の本体の高さ h・下余白 b・足元の横位置 ax を使う） */
function framePortrait(img, p) {
  const show = p.folder === "pakki" ? 0.95 : 1.55; // 画面に収める本体の割合（パッキーは全身）
  const hPct = (show / p.h) * 100;
  img.style.height = `${hPct}%`;
  img.style.top = `${-(1 - p.b - p.h) * hPct + 6}%`;
  img.style.setProperty("--ax", `${-(p.ax * 100)}%`);
}

/**
 * カットインを再生する（クリック／Enter で閉じる。放っておいても数秒で閉じる）
 * @param opts.quick スキップ中など、短く見せる
 */
export async function playIntro(id, { quick = false } = {}) {
  const intro = introOf(id);
  if (!intro) return;
  markIntroSeen(id);
  const { main, reading, sub } = introName(id, intro);
  const p = portraitInfo(id, intro.face || "normal");
  const portrait = p ? el("img.ci-portrait", { src: p.src, alt: "", draggable: "false" }) : el("div.ci-portrait.none", { text: [...main][0] || "？" });
  if (p) {
    framePortrait(portrait, p);
    await imageReady(p.src, 1200);
  }
  const host = el("div.cutin", { dataset: { char: id }, style: `--ci: ${intro.color || "var(--gold)"}` }, [
    el("div.ci-band"),
    el("div.ci-band.b2"),
    el("div.ci-smoke"),
    el("div.ci-watermark", { text: String(nameParts(id).alias || main).toUpperCase() }),
    portrait,
    el("div.ci-meta", [
      el("div.ci-title", { text: intro.title || "" }),
      el("div.ci-name", { text: main, style: `font-size: ${fitSize(main, 570, 96)}px` }),
      reading ? el("div.ci-reading", { text: reading }) : null,
      sub ? el("div.ci-sub", { text: `「${sub}」` }) : null,
    ].filter(Boolean)),
    intro.line ? el("div.ci-line", { text: `「${intro.line}」`, style: `font-size: ${fitSize(`「${intro.line}」`, 640, 34)}px` }) : null,
  ].filter(Boolean));
  layers.fx.append(host);
  SE.select();
  await sleep(30);
  host.classList.add("in");
  const hold = quick ? 900 : 3600;
  await new Promise((resolve) => {
    const start = performance.now();
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
      host.removeEventListener("pointerup", onTap);
      resolve();
    };
    const early = () => performance.now() - start > 500; // 送りの連打で見逃さないよう、最初の0.5秒は閉じない
    const onTap = (e) => { e.stopPropagation(); if (early()) close(); };
    const onKey = (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault(); e.stopPropagation();
      if (early()) close();
    };
    const timer = setTimeout(close, hold);
    host.addEventListener("pointerup", onTap);
    window.addEventListener("keydown", onKey, true);
  });
  host.classList.add("out");
  await sleep(280);
  host.remove();
}
