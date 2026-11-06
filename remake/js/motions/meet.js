// 人に会いに行く夜の入り（#2688 A11「ゆっくり開口」）。約束・デート・告白の場面の直前だけ。
// 葉の形の窓が1.2秒かけてすぼまり、紫の面に相手の呼び名の一行を読ませてから、相手のテーマ色の縁で開く（約2.2秒）。
// 開口＝人に会う、の意味をそろえる（地図→店のピン・ミニゲームの卓と同じ葉の窓）。
// 開く前に次の場面へ預け（parkCover）、背景を描いてから開く。好感度・面識・時系列・保存には触れない。
import { el, sleep, nextFrame } from "../core/util.js";
import { DB, callName } from "../core/data.js";
import { state } from "../core/state.js";
import { COLOR, EASE, move, reducedMotion, leafWindow } from "../core/transition-kit.js";
import { holdCover, parkCover, takeParkedCover } from "../core/transitions.js";

const CLOSE_MS = 1200, LINE_MS = 380, OPEN_MS = 480;
const skipMeet = () => !!(document.body?.classList.contains("vn-skip") || window.__remake?.vnTest?.turbo || window.__remake?.craftTest?.auto);

/** 相手のテーマ色（登場カットインの色）。無ければラベンダー */
export function meetColor(id) {
  const color = DB.manifest?.introArt?.[id]?.color;
  return typeof color === "string" && /^#[0-9a-f]{3,8}$/i.test(color) ? color : COLOR.lav;
}

/**
 * 相手 id に会いに行く夜の入り。label は一行の上の小さな見出し（「約束」など。省略可）。
 * private: 私的な場面の呼び名（栞さん など）。返るのは窓が閉じて一行を読ませ終えたとき（開くのは次の背景を描いてから）。
 */
export async function meetOpen(id, { label = "", private: privateScene = false } = {}) {
  const host = document.getElementById("fx");
  if (!host || !id || skipMeet()) return;
  const name = callName(id, state, privateScene ? { context: "private" } : {});
  if (!name) return;
  const color = meetColor(id);
  const reduced = reducedMotion();
  const unhold = holdCover();
  // 昼→夜の波などがすでに覆って預けていれば、閉じた窓から始めて、下で前の幕を抜けさせる
  const prior = takeParkedCover();
  const node = el("div.meet-open", { "aria-hidden": "true", dataset: { transition: "meet" }, style: { "--meet-color": color } });
  const win = reduced ? null : leafWindow(COLOR.deep, color);
  const line = el("div.meet-open-line", [label ? el("small", { text: label }) : null, el("strong", { text: name })]);
  let release = null;
  try {
    if (win) {
      const start = prior ? "scale(0)" : "scale(1.2)";
      win.hole.style.transform = win.ring.style.transform = start;
      node.append(win.art);
    } else node.classList.add("veil");
    host.append(node);
    await nextFrame();
    if (prior) void prior();
    if (win && !prior) {
      move(win.ring, [{ transform: "scale(1.2)", opacity: 0 }, { transform: "scale(0)", opacity: 1 }], CLOSE_MS, { easing: EASE.inOut });
      // 窓が閉じきる少し前から一行を読ませる
      const closing = move(win.hole, [{ transform: "scale(1.2)" }, { transform: "scale(0)" }], CLOSE_MS, { easing: EASE.inOut });
      await sleep(CLOSE_MS - 300);
      node.append(line);
      move(line, [{ opacity: 0, transform: "translate(-50%, -40%)" }, { opacity: 1, transform: "translate(-50%, -50%)" }], 300, { easing: EASE.out });
      await closing;
    } else {
      if (!win && !prior) await move(node, [{ opacity: 0 }, { opacity: 1 }], 200, { easing: "ease" });
      node.append(line);
      await move(line, [{ opacity: 0 }, { opacity: 1 }], 220, { easing: "ease" });
    }
    await sleep(reduced ? 700 : LINE_MS);
    await move(line, [{ opacity: 1 }, { opacity: 0 }], 160, { easing: EASE.in });
    line.remove();
    release = async () => {
      try {
        await nextFrame(); await nextFrame();
        if (win) {
          move(win.ring, [{ transform: "scale(0)", opacity: 1 }, { transform: "scale(1.2)", opacity: 0 }], OPEN_MS + 40, { easing: EASE.out });
          await move(win.hole, [{ transform: "scale(0)" }, { transform: "scale(1.2)" }], OPEN_MS, { easing: EASE.out });
        } else await move(node, [{ opacity: 1 }, { opacity: 0 }], 200, { easing: "ease" });
      } finally { node.remove(); unhold(); }
    };
    parkCover(release);
  } finally {
    // 途中で例外が出た場合だけ、ここで片付ける（通常は預けた幕が開くときに片付く）
    if (!release) { node.remove(); unhold(); }
  }
}
