// 約束・デート・告白の夜の入り「ゆっくり開口」（#2688 A11・#2736）。開口＝人に会う。
// 葉の窓が約1.2秒かけて閉じてつなぎの一行を読ませ、相手のテーマ色の窓で開く（約2.2秒）。
// 覆っている間に前の場面の絵を片付け（clear）、次の場面の背景が出たところで開く（来なければ1.5秒で開く）。
// 好感度・面識・時系列の判定には触れない。呼ぶ側（daily/calendar.js の beat）が場面と相手を決める。
// SKIP中は短く、動きを減らす設定ではフェードだけ。外すときは calendar.js の meetBeat 呼び出しを beat に戻す。
import { el, nextFrame, sleep } from "../core/util.js";
import { COLOR, EASE, reducedMotion, leafWindow, move } from "../core/transition-kit.js";
import { holdCover } from "../core/transitions.js";
import { DB } from "../core/data.js";

const OPEN = "scale(1.2)", SHUT = "scale(0)";

/** 相手のテーマ色（登場カットインの色）。緑寄りの色・読めない色は紫に置き換える（緑は使わない） */
export function meetColor(id) {
  const hex = String(DB.manifest?.introArt?.[id]?.color || "");
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return COLOR.purple;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return COLOR.purple; // ほぼ灰色
  const hue = max === r ? ((g - b) / d + 6) % 6 * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return hue >= 65 && hue <= 185 ? COLOR.purple : `#${m[1]}`;
}

/** 次の背景が背景レイヤーに置かれるまで待つ（ms で打ち切り） */
function nextBackdrop(ms) {
  const bg = document.getElementById("bg");
  if (!bg) return sleep(ms);
  return new Promise((resolve) => {
    const done = () => { observer.disconnect(); clearTimeout(timer); resolve(); };
    const observer = new MutationObserver((records) => {
      if (records.some((r) => [...r.addedNodes].some((n) => n.classList?.contains("bg-img") && !n.classList.contains("black")))) done();
    });
    observer.observe(bg, { childList: true });
    const timer = setTimeout(done, ms);
  });
}

/**
 * host に幕を置き、一行 text を読ませる。clear() は覆い終えた瞬間に呼ぶ（前の場面の絵を消す）。
 * 一行の要素は従来のつなぎと同じ .beat（テストや読み上げが同じ要素で拾える）。
 */
export async function meetLeaf(host, text, { who = null, clear = null } = {}) {
  const reduced = reducedMotion();
  const fast = document.body?.classList.contains("vn-skip") || !!window.__remake?.vnTest?.turbo;
  const unhold = holdCover();
  const node = el("div.meet-leaf", { "aria-hidden": "true", dataset: { transition: reduced ? "fade" : "meet-leaf", test: "meet-leaf" },
    style: { position: "absolute", inset: "0", zIndex: "100", overflow: "hidden", pointerEvents: "auto" } });
  const line = el("div.beat.meet-beat", { text, style: { zIndex: "2" } });
  host.append(node);
  let win = null;
  const done = () => { node.remove(); unhold(); };
  try {
    if (reduced) {
      const veil = el("div", { style: { position: "absolute", inset: "0", background: COLOR.deep, opacity: "0" } });
      node.append(veil, line);
      await nextFrame();
      await move(veil, [{ opacity: 0 }, { opacity: 1 }], 300, { easing: "ease" });
    } else {
      win = leafWindow(COLOR.purple, COLOR.lav);
      win.hole.style.transform = win.ring.style.transform = OPEN;
      node.append(win.art, line);
      await nextFrame();
      const ms = fast ? 320 : 1200;
      // ゆっくり閉じ、閉じきる少し前から一行が浮かぶ
      setTimeout(() => line.classList.add("show"), Math.round(ms * 0.55));
      move(win.ring, [{ transform: OPEN, opacity: 0 }, { transform: SHUT, opacity: 1 }], ms, { easing: "cubic-bezier(.45,0,.25,1)" });
      await move(win.hole, [{ transform: OPEN }, { transform: SHUT }], ms, { easing: "cubic-bezier(.45,0,.25,1)" });
    }
    line.classList.add("show");
    await clear?.();
    await sleep(fast ? 250 : reduced ? 1100 : 600);
    line.classList.remove("show");
    await sleep(fast ? 80 : 200);
  } catch (e) { done(); throw e; }
  // 覆ったまま呼び出し側へ戻り、次の場面の背景が置かれたら相手のテーマ色の窓で開く（覆っている間の setBg は幕を重ねない）
  void (async () => {
    try {
      await nextBackdrop(fast ? 600 : 1500);
      await nextFrame(); await nextFrame();
      if (reduced) { await move(node, [{ opacity: 1 }, { opacity: 0 }], 300, { easing: "ease" }); return; }
      const tint = leafWindow(meetColor(who), COLOR.lav);
      tint.hole.style.transform = tint.ring.style.transform = SHUT;
      win.art.replaceWith(tint.art);
      const ms = fast ? 220 : 520;
      move(tint.ring, [{ transform: SHUT, opacity: 1 }, { transform: OPEN, opacity: 0 }], ms + 40, { easing: EASE.out });
      await move(tint.hole, [{ transform: SHUT }, { transform: OPEN }], ms, { easing: EASE.out });
    } catch (e) { console.error(e); }
    finally { done(); }
  })();
}
