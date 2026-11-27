// 縦画面「煙の舞台」: 心得の盤（試作 VPM04・VPM15: 盤は一画面に全部は出さず大きく見せ、十字キーで隣のマスへ動いて丸ボタンで灯す）。
// 本編の盤の画面（daily/growth-board-screen.js の .gboard）を、そのまま縦の外枠の中へ移して見せる。規則・仮置き・決定・保存・
// はじめての火種と案内・見方・組み直しは本編の盤のまま動く（移すのは要素の置き場所だけ。閉じると本編の盤が自分で片付ける）。
// 盤の要素は横の舞台（1280×720）向けの寸法なので、縦長の論理の大きさ（幅 720）の箱に入れて画面の幅に縮め、並べ方だけを
// css/look-vertical.css で縦向き（上に題とタブ、真ん中に盤、下に選んだマスの札と火種・決定）に組み直す。
// 十字キー: 選んでいるマスから、その向きのいちばん近いマスへ（盤もついていく）。丸ボタン: 選んでいるマスでできること
// （今灯せる＝灯す。そうでなければ選ぶ）。補助ボタン: 見方・全体・決定（仮置きがある時）/閉じる。
// 盤の上に出る確かめ（決定しますか？）・見方の小窓は、シートの写し（looks/retro/sheet.js）で盤の上に重ねる。
import { el } from "../../core/util.js";
import { createSheetScene as createRetroSheet } from "../retro/sheet.js";
import { textOf } from "./frame.js";

// 縦長の論理の幅。スマホの幅 390 で約 0.89 倍（盤の字 17px が実寸 15px ほど）
const LOGICAL_W = 440;

/** 本編の盤が開いているか（本編の演出の層にあるか、この外枠へ移した後か）。 */
export const boardOpen = () => !!document.querySelector(".gboard");

/** 縦の外枠を止める時に、移した盤を本編の演出の層へ戻す。 */
export function returnBoard() {
  const board = document.querySelector(".vt-board-frame > .gboard");
  const fx = document.getElementById("fx");
  if (board && fx) fx.append(board);
}

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function createBoardScene(frame) {
  const boardFrame = el("div.vt-board-frame");
  const host = el("div.vt-board-host", { dataset: { test: "vt-board" } }, [boardFrame]);
  // 盤の上に出る小窓（確かめ・見方）の写し
  const modalHost = el("div.retro-shell.vt-sheet-host.vt-board-modal", { hidden: true, dataset: { paint: "hd", scene: "sheet" } });
  const modalTop = el("div.vt-sheet-top"), modalBottom = el("div.vt-sheet-bottom");
  modalHost.append(modalTop, modalBottom);
  let modalKeys = [];
  const modal = createRetroSheet({ top: modalTop, bottom: modalBottom, setStatus() {}, setKeys(items) { modalKeys = items; }, setCaption() {} }, { paintCover: () => false });
  modalBottom.append(modal.pane);
  let modalOn = false;

  const board = () => boardFrame.querySelector(":scope > .gboard");
  const viewport = () => board()?.querySelector(".gb-board");
  const nodes = () => [...(board()?.querySelectorAll(".gb-nodes > .gb-node") || [])];
  const selectedNode = () => board()?.querySelector(".gb-nodes > .gb-node.selected") || null;
  const posOf = (node) => ({ x: parseFloat(node.style.left) || 0, y: parseFloat(node.style.top) || 0 });

  /** 縦長の論理の箱を、外枠の上（パッドより上）いっぱいに合わせる。 */
  function fit() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    const scale = w / LOGICAL_W;
    boardFrame.style.width = `${LOGICAL_W}px`;
    boardFrame.style.height = `${Math.round(h / scale)}px`;
    boardFrame.style.transform = `scale(${scale})`;
  }

  /** 盤の見える所の真ん中へ、そのマスを運ぶ。 */
  function reveal(node) {
    const vp = viewport();
    if (!vp || !node) return;
    const zoom = parseFloat(vp.dataset.zoom) || 1, p = posOf(node);
    vp.scrollTo({ left: p.x * zoom - vp.clientWidth / 2, top: p.y * zoom - vp.clientHeight * 0.45, behavior: "smooth" });
  }

  /** 十字キー: その向きの、いちばん近いマス（斜め60度まで）。 */
  function move(dir) {
    const list = nodes();
    if (!list.length) return;
    const from = selectedNode();
    if (!from) {
      // まだ選んでいない時は、見えている所の真ん中に近いマス
      const vp = viewport(), zoom = parseFloat(vp?.dataset.zoom) || 1;
      const cx = vp ? (vp.scrollLeft + vp.clientWidth / 2) / zoom : 0, cy = vp ? (vp.scrollTop + vp.clientHeight / 2) / zoom : 0;
      const near = list.reduce((best, node) => {
        const p = posOf(node), d = Math.hypot(p.x - cx, p.y - cy);
        return !best || d < best.d ? { node, d } : best;
      }, null);
      near?.node.click();
      reveal(near?.node);
      return;
    }
    const [dx, dy] = DIRS[dir], a = posOf(from);
    let best = null;
    for (const node of list) {
      if (node === from) continue;
      const p = posOf(node), vx = p.x - a.x, vy = p.y - a.y, dist = Math.hypot(vx, vy);
      if (!dist) continue;
      const cos = (vx * dx + vy * dy) / dist;
      if (cos < 0.5) continue; // 斜め60度まで
      const score = dist * (2 - cos); // 向きに沿うほど近いと見なす
      if (!best || score < best.score) best = { node, score };
    }
    if (!best) return;
    best.node.click();
    reveal(best.node);
  }

  /** はじめての盤の案内（growth-board-tutorial.js の吹き出し）が出ているか。出ている間は丸ボタンで「次へ」、補助ボタンで「説明を閉じる」。 */
  const tutorial = () => board()?.querySelector(".gb-tutorial-bubble");
  const tutorialButton = (primary) => [...(tutorial()?.querySelectorAll("button") || [])].find((button) => button.classList.contains("primary") === primary);

  /** 丸ボタン: 選んでいるマスで今できること（灯す・はめる・教わる）。無ければマスを押す（選ぶ・2度目で灯す）。 */
  function act() {
    const next = tutorialButton(true);
    if (next) { next.click(); return; }
    const light = board()?.querySelector('[data-test="board-light"]');
    if (light && !light.disabled) { light.click(); return; }
    const node = selectedNode();
    if (node) { node.click(); return; }
    // まだ選んでいない時は、今灯せるマス（はじめての案内が光らせるマス）を選ぶ
    const ready = board()?.querySelector(".gb-nodes > .gb-node.s-available");
    if (ready) { ready.click(); reveal(ready); } else move("up");
  }

  function sync(state) {
    const live = document.querySelector("#fx > .gboard");
    if (live && live.parentElement !== boardFrame) {
      boardFrame.replaceChildren(live); // 本編の盤の要素を、そのまま縦の外枠へ移す
      requestAnimationFrame(fit);
    }
    fit();
    const root = board();
    // 盤の上の小窓（確かめ・見方）
    const dialog = document.querySelector("#modal.show");
    if (!!dialog !== modalOn) {
      modalOn = !!dialog;
      modalHost.hidden = !modalOn;
      if (modalOn) { modal.pane.hidden = false; modal.enter(); } else { modal.leave(); modal.pane.hidden = true; modalKeys = []; }
    }
    if (modalOn) {
      modal.sync(state);
      frame.setChips(modalKeys.filter((key) => key.id !== "close").map((key) => ({ id: `m:${key.id}`, icon: "dots", label: key.label })));
      const close = modalKeys.find((key) => key.id === "close");
      frame.setPad({ dirs: ["up", "down"], a: close ? { face: "close" } : null });
      frame.setHud("none");
      return;
    }
    if (!root) return;
    const lightButton = root.querySelector('[data-test="board-light"]');
    const decide = root.querySelector('[data-test="board-decide"]');
    const help = root.querySelector('[data-test="board-help"]');
    const fitButton = root.querySelector('[data-test="board-zoom-fit"]');
    const tutorialNext = tutorialButton(true), tutorialSkip = tutorialButton(false);
    if (tutorialNext) {
      frame.setChips(tutorialSkip ? [{ id: "tutorial-skip", icon: "close", label: textOf(tutorialSkip) || "説明を閉じる" }] : []);
      frame.setPad({ dirs: [], a: tutorialNext ? { face: "next", label: textOf(tutorialNext) } : null });
      frame.setHud("none");
      frame.setAccent("#f1d79a");
      return;
    }
    frame.setChips([
      tutorialSkip ? { id: "tutorial-skip", icon: "close", label: "説明を閉じる" } : null,
      help && !tutorialSkip ? { id: "help", icon: "help", label: "見方" } : null,
      fitButton ? { id: "fit", icon: "wide", label: "全体", disabled: fitButton.disabled } : null,
      root.querySelector('[data-test="board-reset"]') ? { id: "reset", icon: "back", label: "取り消す" } : null,
      decide ? { id: "decide", icon: textOf(decide) === "閉じる" ? "close" : "flame", label: textOf(decide).replace(/（\d+）/, "") || "決定", badge: /（(\d+)）/.exec(textOf(decide))?.[1] || "" } : null,
    ].filter(Boolean));
    frame.setPad({
      dirs: ["up", "down", "left", "right"],
      a: lightButton && !lightButton.disabled
        ? { face: "ok", text: textOf(lightButton).startsWith("はめる") ? "はめる" : textOf(lightButton).startsWith("教わる") ? "教わる" : "灯す", label: textOf(lightButton), hot: true }
        : { face: "ok", text: "選ぶ", label: "マスを選ぶ" },
    });
    frame.setHud("none");
    frame.setAccent("#f1d79a");
  }

  return {
    name: "board",
    enter() {
      frame.picture.dataset.kind = "board";
      frame.root.append(host, modalHost);
      modalOn = false; modalHost.hidden = true;
    },
    leave() {
      returnBoard();
      host.remove(); modalHost.remove();
      if (modalOn) { modal.leave(); modalOn = false; }
    },
    sync,
    relayout: fit,
    dir(dir) {
      if (modalOn) {
        const body = modalHost.querySelector(".rs-body");
        body?.scrollBy({ top: (dir === "up" ? -1 : 1) * body.clientHeight * 0.6, behavior: "smooth" });
        return;
      }
      move(dir);
    },
    a() {
      if (modalOn) { modalKeys.find((key) => key.id === "close")?.run?.(); return; }
      act();
    },
    chip(id) {
      if (id.startsWith("m:")) { modalKeys.find((key) => key.id === id.slice(2))?.run?.(); return; }
      if (id === "tutorial-skip") { tutorialButton(false)?.click(); return; }
      const test = { help: "board-help", fit: "board-zoom-fit", reset: "board-reset", decide: "board-decide" }[id];
      board()?.querySelector(`[data-test="${test}"]`)?.click();
    },
    tap() {},
  };
}
