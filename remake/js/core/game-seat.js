// ミニゲームの入口と出口（#2688 F13）。卓へ座るように葉の形の窓がすぼまってゲーム名の判子が押され、
// 窓が開くとゲームの画面。終わったら同じ窓が一度すぼまって開き、元の場所へ戻る。
// 斧投げ・ラクダレース・砂丘・DJ で共通。保存・結果・入力には触れず、覆っている間だけキーを止める。
import { el, sleep, nextFrame } from "./util.js";
import { COLOR, EASE, move, reducedMotion, holdKeys, leafWindow } from "./transition-kit.js";

const skipSeat = () => reducedMotion() || !!(window.__remake?.craftTest?.auto || window.__remake?.vnTest?.turbo);

async function closeLeaf(node, win) {
  move(win.ring, [{ transform: "scale(1.2)", opacity: 0 }, { transform: "scale(0)", opacity: 1 }], 300, { easing: EASE.in });
  await move(win.hole, [{ transform: "scale(1.2)" }, { transform: "scale(0)" }], 300, { easing: EASE.in });
}
async function openLeafWindow(win) {
  move(win.ring, [{ transform: "scale(0)", opacity: 1 }, { transform: "scale(1.2)", opacity: 0 }], 380, { easing: EASE.out });
  await move(win.hole, [{ transform: "scale(0)" }, { transform: "scale(1.2)" }], 360, { easing: EASE.out });
}

/** 窓がすぼまる → 判子（label） → mid() → 窓が開く */
async function seatCurtain(label, mid) {
  const host = document.getElementById("fx");
  if (!host || skipSeat()) return mid?.();
  const unhold = holdKeys();
  const node = el("div.game-seat", { "aria-hidden": "true", dataset: { transition: "seat" } });
  const win = leafWindow(COLOR.purple, COLOR.lav);
  win.hole.style.transform = win.ring.style.transform = "scale(1.2)";
  node.append(win.art);
  host.append(node);
  try {
    await nextFrame();
    await closeLeaf(node, win);
    if (label) {
      const stamp = el("div.game-seat-stamp", { text: label });
      node.append(stamp);
      await move(stamp, [{ opacity: 0, transform: "translate(-50%, -50%) rotate(-6deg) scale(1.8)" }, { opacity: 1, transform: "translate(-50%, -50%) rotate(-6deg) scale(1)" }], 220, { easing: EASE.out });
      await sleep(320);
      move(stamp, [{ opacity: 1 }, { opacity: 0 }], 160);
    }
    const result = await mid?.();
    await nextFrame(); await nextFrame();
    await openLeafWindow(win);
    return result;
  } finally { node.remove(); unhold(); }
}

/**
 * ミニゲームを「卓に座って」始め、終えたら立つ。run() はゲームの画面を出して結果で終わる関数（runAxeThrow などの本体）。
 * 入口: 窓がすぼまり判子 → 覆っている間にゲームの画面を組み立て → 窓が開く。出口: 画面が片付いたあと、窓が一度すぼまって開く。
 */
export async function seated(label, run, { enter = true, exit = true } = {}) {
  if (typeof document === "undefined" || typeof window === "undefined" || skipSeat() || !document.getElementById("fx")) return run();
  let running;
  if (enter) await seatCurtain(label, async () => { running = run(); await nextFrame(); });
  else running = run();
  const result = await running;
  if (exit) await seatCurtain("", null);
  return result;
}
