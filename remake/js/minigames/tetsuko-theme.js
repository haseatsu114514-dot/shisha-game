// 「てつこといっしょ」の専用テーマ「茶トラと段ボール」（#2717）の飾り。見た目は css/tetsuko-theme.css。
// 日常の紙×ラベンダーとは別の画面だと入った瞬間に分かるように、次の3つを足す（遊び・保存・確定には触らない）:
// - 全画面の外枠: 段ボールを切り抜いた窓から裏口をのぞく形（SVG。切り口の波の段も描く）
// - 左上の題: 折れ耳の付いた札「てつこといっしょ / TETSUKO TIME」（日常の HUD はこの画面では隠す）
// - 入った時の演出: 閉じた箱のテープがはがれ、ふたが手前へ開き、真ん中の題が左上の札へ収まる（約1.2秒）
// 演出は操作を止めない（pointer-events なし・開いてすぐ触れる）。動きを減らす設定では演出を出さない。
// 基本画面は必要なUIだけ（ミニゲーム共通の方針）: 今日の様子の吹き出しは入った時だけ見せ、少しで消す（data-memo="off"。「？」でも読める）。
// DOM の部品は呼び出し側の el（core/util.js）で作る。top-level は DOM 非依存（Node のテストから import できる）。

const W = 1280, H = 720;
/** 外枠の寸法（1280×720 の px）。窓は inset の位置で角を丸めて切り抜き、切り口の厚みの分だけ内側から裏口が見える。 */
export const FRAME = Object.freeze({ inset: 14, radius: 22, edge: 6 });
/** 演出の長さ。CSS の animation（1.2s）より少し長く、終わったら演出の層を外す。 */
export const INTRO_MS = 1400;
const INTRO_FALLBACK_MS = 4000;
/** 今日の様子の吹き出しを見せておく長さ（入った時から）。 */
export const MEMO_MS = 6000;
const TAPE_SE_MS = 260;

// 角を丸めた長方形（inset i・半径 r）のパス
const rounded = (i, r) => `M${i + r} ${i}H${W - i - r}A${r} ${r} 0 0 1 ${W - i} ${i + r}V${H - i - r}A${r} ${r} 0 0 1 ${W - i - r} ${H - i}`
  + `H${i + r}A${r} ${r} 0 0 1 ${i} ${H - i - r}V${i + r}A${r} ${r} 0 0 1 ${i + r} ${i}Z`;

function frameSvg() {
  const { inset: i, radius: r, edge: e } = FRAME;
  const mid = i + e / 2;
  return `<svg class="tt-frame-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="tt-frame-kraft" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dcab6d"/>`
    + `<stop offset=".55" stop-color="#c9955a"/><stop offset="1" stop-color="#b8824d"/></linearGradient>`
    + `<pattern id="tt-frame-fiber" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">`
    + `<path d="M0 4.5H9" stroke="#7a4c25" stroke-opacity=".13" stroke-width="1"/></pattern></defs>`
    // 段ボールの面（外の四角から、角を丸めた窓を抜く）
    + `<path fill-rule="evenodd" fill="url(#tt-frame-kraft)" d="M0 0H${W}V${H}H0Z${rounded(i, r)}"/>`
    + `<path fill-rule="evenodd" fill="url(#tt-frame-fiber)" d="M0 0H${W}V${H}H0Z${rounded(i, r)}"/>`
    + `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="#efcf98" stroke-opacity=".55" stroke-width="2"/>`
    // 切り口: 表と裏の紙（明るい線）と、間の波の段（点線）。いちばん内側に濃い線
    + `<path d="${rounded(mid, r - e / 2)}" fill="none" stroke="#ebca93" stroke-width="${e}"/>`
    + `<path d="${rounded(mid, r - e / 2)}" fill="none" stroke="#99672f" stroke-width="3.2" stroke-dasharray="2.4 2.2"/>`
    + `<path d="${rounded(i, r)}" fill="none" stroke="#7a4c25" stroke-width="1.5"/>`
    + `<path d="${rounded(i + e, r - e)}" fill="none" stroke="#4a2d17" stroke-width="2"/>`
    + `</svg>`;
}

/**
 * テーマの飾りを作る。返した nodes を画面（.tetsuko-time）の子に足し、attrs を画面の dataset に足す。
 * 画面を出した後に start(host)、閉じる時に stop() を呼ぶ。
 * @param {object} p
 * @param {Function} p.el core/util.js の el
 * @param {string} p.title 題（てつこといっしょ）
 * @param {string} p.roman 英字の題（TETSUKO TIME）
 * @param {boolean} [p.reduced] 動きを減らす設定（演出を出さない）
 * @param {object} [p.SE] 効果音（audio.js の SE。テープの音は pour。始まりの曲は画面の専用 BGM（bgm_tetsuko_time）に任せ、ジングルは重ねない）
 */
export function tetsukoTheme({ el, title, roman, reduced = false, SE = {} }) {
  const plate = (extra = "") => el(`div.tt-logo${extra}`, { "aria-hidden": "true" }, [
    el("i.tt-logo-ear.l"), el("i.tt-logo-ear.r"), el("i.tt-logo-paw"),
    el("b.tt-logo-title", { text: title }), el("small.tt-logo-roman", { text: roman }),
  ]);
  const logo = plate();
  const frame = el("div.tt-frame", { "aria-hidden": "true", html: frameSvg() });
  const card = reduced ? null : el("div.tt-intro-card", [plate(".tt-logo-card")]);
  const intro = reduced ? null : el("div.tt-intro", { "aria-hidden": "true", dataset: { test: "tetsuko-intro" } }, [
    el("i.tt-intro-flap.l"), el("i.tt-intro-flap.r"), el("i.tt-intro-tape"), card,
  ]);
  let timers = [], host = null, ended = !intro;

  // 演出を外す（終わった時・閉じた時・LOAD で差し替わった時）。2回呼んでもよい。
  function end() {
    if (ended) return;
    ended = true;
    if (host) host.dataset.intro = "";
    intro.remove();
  }
  // 真ん中の題が、左上の札の位置へ収まる（札の位置は字の幅で変わるので、出した後に測る）。
  function aim() {
    if (!host || !card) return;
    const box = host.getBoundingClientRect(), at = logo.getBoundingClientRect();
    const k = box.width / W;
    if (!k || !at.width) return;
    const cx = (at.left - box.left + at.width / 2) / k, cy = (at.top - box.top + at.height / 2) / k;
    card.style.setProperty("--tt-to-x", `${Math.round(cx - W / 2)}px`);
    card.style.setProperty("--tt-to-y", `${Math.round(cy - H * 0.46)}px`);
  }
  return {
    nodes: [logo, frame, intro].filter(Boolean),
    attrs: { intro: intro ? "1" : "", memo: "" },
    start(screen) {
      host = screen;
      timers.push(setTimeout(() => { host.dataset.memo = "off"; }, MEMO_MS));
      if (ended) return;
      aim();
      // 箱の音は演出が実際に始まってから（幕の後ろで待たされた時に先に鳴らない）。
      card.addEventListener("animationstart", () => {
        aim();
        timers.push(setTimeout(() => SE.pour?.(), TAPE_SE_MS), setTimeout(end, INTRO_MS));
      }, { once: true });
      card.addEventListener("animationend", end, { once: true });
      timers.push(setTimeout(end, INTRO_FALLBACK_MS));
    },
    stop() {
      timers.forEach(clearTimeout);
      timers = [];
      end();
    },
  };
}
