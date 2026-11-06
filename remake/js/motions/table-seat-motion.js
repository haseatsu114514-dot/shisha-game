// 「卓へ座る」の幕の中身（#2688 F13）。呼び出しは table-seat.js の seated() から。
// 紫の葉の窓（transition-kit.leafWindow）と、ラベンダーの線のゲーム名の判子。画像は使わない。
import { el, nextFrame, sleep } from "../core/util.js";
import { COLOR, EASE, reducedMotion, leafWindow, move } from "../core/transition-kit.js";
import { holdCover } from "../core/transitions.js";

const OPEN = "scale(1.2)", SHUT = "scale(0)";
const fastNow = () => !!document.body?.classList.contains("vn-skip");

/** 画面を覆う器。covered=true なら最初から覆った状態で置く（出口） */
function makeCover(stage, name, covered) {
  const reduced = reducedMotion();
  const node = el("div.table-seat", { "aria-hidden": "true", dataset: { transition: reduced ? "fade" : "table-seat", test: "table-seat" },
    style: { position: "absolute", inset: "0", zIndex: "140", overflow: "hidden", pointerEvents: "auto" } });
  const stamp = el("div.table-seat-stamp", { text: name, style: {
    position: "absolute", left: "50%", top: "50%", padding: "10px 28px", whiteSpace: "nowrap",
    border: `4px solid ${COLOR.lav}`, borderRadius: "10px", color: COLOR.lav, background: "rgba(52, 36, 106, .35)",
    font: "700 34px var(--font, sans-serif)", letterSpacing: ".16em", transform: "translate(-50%, -50%) rotate(-6deg)",
    boxShadow: `inset 0 0 0 2px rgba(220, 209, 244, .3)`, opacity: covered ? "1" : "0" } });
  let win = null, veil = null;
  if (reduced) {
    veil = el("div", { style: { position: "absolute", inset: "0", background: COLOR.deep, opacity: covered ? "1" : "0" } });
    node.append(veil, stamp);
  } else {
    win = leafWindow(COLOR.purple, COLOR.lav);
    win.hole.style.transform = win.ring.style.transform = covered ? SHUT : OPEN;
    node.append(win.art, stamp);
  }
  stage.append(node);
  const stopAll = () => node.querySelectorAll("*").forEach((n) => n.getAnimations?.().forEach((a) => a.cancel()));
  return {
    node, stamp,
    setName(text) { stamp.textContent = text; },
    /** 葉の窓が閉じて覆い、判子が押される */
    async close() {
      const ms = fastNow() ? 110 : 230;
      move(stamp, [{ opacity: 0, transform: "translate(-50%, -50%) rotate(-6deg) scale(1.3)" }, { opacity: 1, transform: "translate(-50%, -50%) rotate(-6deg) scale(1)" }],
        fastNow() ? 90 : 150, { delay: reduced ? 0 : ms - 70, easing: EASE.out });
      if (veil) return move(veil, [{ opacity: 0 }, { opacity: 1 }], 120, { easing: "ease" });
      move(win.ring, [{ transform: OPEN, opacity: 0 }, { transform: SHUT, opacity: 1 }], ms, { easing: EASE.in });
      await move(win.hole, [{ transform: OPEN }, { transform: SHUT }], ms, { easing: EASE.in });
    },
    /** 判子が薄れ、葉の窓が開いて内側を見せる */
    async open() {
      const ms = fastNow() ? 120 : 250;
      move(stamp, [{ opacity: 1 }, { opacity: 0 }], Math.round(ms * 0.6), { easing: "ease" });
      if (veil) return move(veil, [{ opacity: 1 }, { opacity: 0 }], 140, { easing: "ease" });
      move(win.ring, [{ transform: SHUT, opacity: 1 }, { transform: OPEN, opacity: 0 }], ms + 20, { easing: EASE.out });
      await move(win.hole, [{ transform: SHUT }, { transform: OPEN }], ms, { easing: EASE.out });
    },
    /** 出口の幕を次の入口が引き継ぐとき: 動きを止めて覆った状態に戻す */
    hold() {
      stopAll();
      stamp.style.opacity = "1";
      if (veil) veil.style.opacity = "1";
      else win.hole.style.transform = win.ring.style.transform = SHUT;
    },
  };
}

/** ゲームが画面を作るまで待つ（覆った内側で最初の画面を描いてから開く）。来なければ 400ms で開く */
function firstPaint(stage, node) {
  return new Promise((resolve) => {
    const done = () => { observer.disconnect(); clearTimeout(timer); resolve(); };
    const observer = new MutationObserver((records) => { if (records.some((r) => !node.contains(r.target) && r.target !== node)) done(); });
    observer.observe(stage, { childList: true, subtree: true });
    const timer = setTimeout(done, 400);
  }).then(() => nextFrame()).then(() => nextFrame());
}

/**
 * 入口。閉じ終えてから resolve し、release() でゲームの最初の画面が出たあとに開く。
 * prev は直前のゲームの出口の幕（まだ開き終えていなければ閉じ直さずに引き継ぐ）。
 */
export async function enterTable(stage, name, prev = null) {
  const taken = prev?.takeover?.() || null;
  const unhold = taken?.unhold || holdCover();
  const cover = taken?.cover || makeCover(stage, name, false);
  let opened = false;
  const release = async () => {
    if (opened) return;
    opened = true;
    try { await firstPaint(stage, cover.node); await cover.open(); }
    finally { cover.node.remove(); unhold(); }
  };
  try {
    if (taken) { cover.hold(); cover.setName(name); }
    else await cover.close();
  } catch (e) { cover.node.remove(); unhold(); throw e; }
  return { release };
}

/** 出口。ゲームの画面が片付いた同じ描画のうちに覆い、判子を残して開く。返り値の takeover() で次の入口へ渡せる */
export function leaveTable(stage, name, onDone) {
  const unhold = holdCover();
  const cover = makeCover(stage, name, true);
  let taken = false;
  (async () => {
    try {
      await nextFrame(); await nextFrame();
      await sleep(fastNow() ? 40 : 140);
      if (taken) return;
      await cover.open();
    } catch (e) { console.error(e); }
    if (taken) return;
    cover.node.remove();
    unhold();
    onDone?.();
  })();
  return { takeover() {
    if (taken || !cover.node.isConnected) return null;
    taken = true;
    return { cover, unhold };
  } };
}
