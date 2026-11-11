// 心得の盤のはじめての案内（2026-11-02 オーナー「チュートリアルは誰の解説とかでもなく説明したい。ちょっと複雑な機能なので
// わかりやすく説明したい。あと最初は少し多めにもらえて振っていく体験もさせてあげたい」）。
// - キャラの台詞ではなく、盤の画面の部品を一つずつ光らせて短い文で説明する。
// - はじめて盤で灯せる時に、最初の火種（白火 STARTER_HIDANE）を渡し、実際に1マス選んで「灯す」まで手を動かしてもらう。
// - 「説明を閉じる」でいつでも飛ばせる。済んだら二度と出さない（くわしい決まりは「？」の見方）。
// 盤の画面（growth-board-screen.js）は data-test と部品のクラスで見るだけで、中の処理には触れない。

import { giveColored } from "../core/growth.js";
import { STARTER_HIDANE, STARTER_FLAG } from "../core/growth-starter.js";
export { STARTER_HIDANE, STARTER_FLAG } from "../core/growth-starter.js";
export const TUTORIAL_FLAG = "_board_tutorial_done";

// 検査用: 盤を開く他の検査で火種の数と操作を変えないよう、browser の support.mjs が既定で "off" にする。
// 案内そのものの検査（board_tutorial.mjs）だけが外す。遊ぶ時は使わない。
const SWITCH_KEY = "suien_board_tutorial";
const switchedOff = () => { try { return globalThis.localStorage?.getItem(SWITCH_KEY) === "off"; } catch { return false; } };

/** 最初の火種をまだ渡していないか（観音堂などで、火種が0でも初回だけは盤を開ける）。 */
export const starterPending = (s) => !switchedOff() && !!s?.flags && !s.flags[STARTER_FLAG];

/** 最初の火種を一度だけ渡す。戻り値＝渡した数（渡し済みなら0）。 */
export function grantStarterHidane(s, growth) {
  if (!starterPending(s) || !growth?.hidane) return 0;
  const given = giveColored(growth, "any", STARTER_HIDANE).n;
  growth.starterAccounted = true;
  s.flags[STARTER_FLAG] = true;
  return given;
}
export const tutorialPending = (s) => !switchedOff() && !!s?.flags && !s.flags[TUTORIAL_FLAG];

/**
 * 案内の手順。target は光らせる部品（無ければ盤の全体）、wait は「次へ」の代わりに待つ操作（満たすと自動で次へ）、
 * place: "above" は吹き出しを部品の上に出す（下にある紋などを隠さないため）。文は1行ずつ、全角24字前後まで。
 */
export const TUTORIAL_STEPS = Object.freeze([
  { id: "intro", title: "心得の盤", target: '[data-test="board-viewport"]',
    text: ["経験を積んでレベルが上がると、「火種」がたまる。", "火種を盤のマスに灯すと、そのぶん力が伸びていく。"] },
  // 財布は粒の絵と数だけ（SBD116）。どの粒が何かをここで伝える
  { id: "wallet", title: "火種", target: '[data-test="board-wallet"]',
    text: ["持っている火種はここ。白い粒が「白火」。", `はじめての今回は、白火を${STARTER_HIDANE}つ渡しておく。`, "白火は、どの盤のマスにも使える。", "色のついた粒は、ひし形の台座にはめる鍵。"] },
  { id: "tabs", title: "3枚の盤", target: ".gb-tabs",
    text: ["盤は「才能」「感覚」「理論」の3枚。", "ここで切り替える。どの盤から灯してもいい。"] },
  { id: "kinds", title: "マスの形", target: '[data-test="board-viewport"]', place: "above",
    text: ["丸いマスは力が伸びる。六角はスキル。", "金の札は授業（火種いらず。その人に会って習う）。", "ひし形は色の台座。色の火をはめると先が開く。"] },
  { id: "pick", title: "灯せるマス", target: ".gb-node.s-available", wait: "selected", place: "above",
    text: ["光って、上に小さな火があるのが、今灯せるマス。", "下の紋から、線でつながった隣が光る。", "押してみよう。"] },
  { id: "light", title: "灯す", target: ".gb-light", wait: "pending",
    text: ["右に、そのマスで伸びるものが出る。", "「灯す」を押そう。"] },
  { id: "more", title: "続けて灯す", target: '[data-test="board-viewport"]',
    text: ["灯したマスの隣が、新しく光る。", "残りの火種も、好きな道へ灯してみよう。"] },
  { id: "side", title: "右のパネル", target: '[data-test="board-preview"]',
    text: ["マスを選ぶと、ここに中身が出る。", "選んでいない時は、盤の伸びと「近い目的地」。", "伸びのアイコンは、押すと名前が出る。", "欲しいマスは「目標にする」で印をつけておける。"] },
  { id: "decide", title: "決定", target: '[data-test="board-decide"]',
    text: ["灯したマスは、まだ仮置き。", "最後に「決定」を押すと確定する。", "決める前なら「取り消す」で全部戻せる。"] },
  { id: "help", title: "絵つきの見方", target: '[data-test="board-help"]',
    text: ["マスの形や印、火種のもらい方は、", "「？」の絵つきの見方でいつでも確かめられる。", "火種を灯せるのは、静かな場所で振り返った時だけ。"] },
]);

const STYLE_ID = "gb-tutorial-style";
const STYLE = `
.gb-tutorial{position:absolute;inset:0;z-index:40;pointer-events:none}
.gb-tutorial-spot{position:absolute;border-radius:12px;box-shadow:0 0 0 9999px rgba(8,6,16,.55),0 0 0 3px var(--gold-hi,#ffe2a6),0 0 18px 4px rgba(255,226,166,.55);transition:all .25s ease;pointer-events:none}
.gb-tutorial-bubble{position:absolute;max-width:min(420px,calc(100% - 32px));background:var(--panel,rgba(16,12,28,.94));color:var(--text,#f4ede0);border:1px solid var(--panel-edge,rgba(232,194,122,.5));border-radius:12px;padding:14px 16px 12px;box-shadow:0 8px 28px rgba(0,0,0,.45);pointer-events:auto;font-size:15px;line-height:1.6}
.gb-tutorial-bubble h3{margin:0 0 6px;font-size:16px;color:var(--gold,#e8c27a)}
.gb-tutorial-bubble p{margin:0;word-break:auto-phrase;text-wrap:pretty}
.gb-tutorial-bubble .gb-tutorial-row{display:flex;align-items:center;gap:8px;margin-top:10px}
.gb-tutorial-bubble .gb-tutorial-count{margin-right:auto;font-size:12px;color:var(--text-dim,#b6aa96)}
.gb-tutorial-bubble .gb-tutorial-wait{font-size:13px;color:var(--gold-hi,#ffe2a6)}
@media (prefers-reduced-motion:reduce){.gb-tutorial-spot{transition:none}}
`;

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  doc.head.append(style);
}

/**
 * 盤の画面（root）に案内を重ねる。onDone は完了・飛ばした時に一度だけ呼ばれる（済んだ印を立てる）。
 * 戻り値＝止める関数（盤を閉じた時に呼ぶ）。
 */
export function startBoardTutorial(root, { onDone = () => {}, starterAmount = STARTER_HIDANE } = {}) {
  const doc = root.ownerDocument;
  ensureStyle(doc);
  const layer = doc.createElement("div");
  layer.className = "gb-tutorial";
  layer.dataset.test = "board-tutorial";
  const spot = doc.createElement("div");
  spot.className = "gb-tutorial-spot";
  const bubble = doc.createElement("div");
  bubble.className = "gb-tutorial-bubble";
  bubble.setAttribute("role", "dialog");
  layer.append(spot, bubble);
  root.append(layer);

  let index = 0, finished = false;
  // 上限到達後に初めて開いた場合、火種を使う操作はできないので説明だけにする。
  const steps = starterAmount === 0
    ? TUTORIAL_STEPS.filter((s) => !["pick", "light", "more", "decide"].includes(s.id))
    : TUTORIAL_STEPS;
  const step = () => steps[index];
  const targetOf = (s) => root.querySelector(s.target) || root.querySelector('[data-test="board-viewport"]');
  const satisfied = (s) => s.wait === "selected" ? !!root.querySelector(".gb-light")
    : s.wait === "pending" ? !!root.querySelector('[data-status="pending"]') : false;

  function place() {
    if (finished) return;
    const s = step();
    const box = root.getBoundingClientRect(), target = targetOf(s)?.getBoundingClientRect();
    // ゲーム全体の拡縮（transform）を割り戻して、盤の画面の座標に直す
    const scale = root.offsetWidth ? box.width / root.offsetWidth : 1;
    if (target) {
      const pad = 6;
      Object.assign(spot.style, {
        left: `${(target.left - box.left) / scale - pad}px`, top: `${(target.top - box.top) / scale - pad}px`,
        width: `${target.width / scale + pad * 2}px`, height: `${target.height / scale + pad * 2}px`,
      });
      // 吹き出しは光らせた部品の下（place:"above" なら上）、入らなければ反対側。どちらも入らない大きな部品（盤の全体など）は部品の中の下寄せ。
      // 横・縦とも画面からはみ出さない所に収める
      const w = root.offsetWidth, h = root.offsetHeight, bw = Math.min(420, w - 32), bh = bubble.offsetHeight || 150;
      const top = (target.top - box.top) / scale, bottom = (target.bottom - box.top) / scale;
      const left = Math.max(16, Math.min(w - bw - 16, (target.left - box.left) / scale));
      const below = bottom + 14, above = top - 14 - bh;
      const fitsBelow = below + bh <= h - 16, fitsAbove = above >= 16;
      const y = s.place === "above" && fitsAbove ? above : fitsBelow ? below : fitsAbove ? above
        : Math.max(16, Math.min(h - bh - 16, bottom - bh - 24));
      bubble.style.left = `${left}px`;
      bubble.style.top = `${y}px`;
      bubble.style.bottom = "";
    }
  }

  function draw() {
    if (finished) return;
    const s = step();
    bubble.replaceChildren();
    const title = doc.createElement("h3");
    title.textContent = s.title;
    const lines = s.id === "wallet" && starterAmount !== STARTER_HIDANE
      ? [s.text[0], starterAmount > 0 ? `はじめての今回は、白火を${starterAmount}つ渡しておく。` : "火種の獲得は上限に届いている。", s.text[2], s.text[3]]
      : s.text;
    bubble.append(title, ...lines.map((line) => { const p = doc.createElement("p"); p.textContent = line; return p; }));
    const row = doc.createElement("div");
    row.className = "gb-tutorial-row";
    const count = doc.createElement("span");
    count.className = "gb-tutorial-count";
    count.textContent = `${index + 1} / ${steps.length}`;
    row.append(count);
    const skip = button("説明を閉じる", "board-tutorial-skip", () => finish());
    if (s.wait) {
      const hint = doc.createElement("span");
      hint.className = "gb-tutorial-wait";
      hint.textContent = s.wait === "selected" ? "光っているマスを押す" : "「灯す」を押す";
      row.append(skip, hint);
    } else {
      const last = index === steps.length - 1;
      row.append(skip, button(last ? "灯しはじめる" : "次へ", last ? "board-tutorial-done" : "board-tutorial-next", () => next(), true));
    }
    bubble.append(row);
    place();
  }
  function button(text, test, onclick, primary = false) {
    const b = doc.createElement("button");
    b.className = `btn small${primary ? " primary" : ""}`;
    b.textContent = text;
    b.dataset.test = test;
    b.addEventListener("click", (event) => { event.stopPropagation(); onclick(); });
    return b;
  }
  function next() {
    if (index >= steps.length - 1) return finish();
    index += 1;
    draw();
  }
  function finish() {
    if (finished) return;
    finished = true;
    observer.disconnect();
    window.removeEventListener("resize", place);
    layer.remove();
    onDone();
  }
  // 盤の画面は操作のたびに描き直すので、部品の位置と「待つ操作」を見張る
  const observer = new MutationObserver((records) => {
    // 案内そのものの描き直しには反応しない（位置を直すたびに見張りが動いて止まらなくなる）
    if (finished || records.every((record) => layer.contains(record.target))) return;
    if (step().wait && satisfied(step())) { next(); return; }
    place();
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-status", "style"] });
  window.addEventListener("resize", place);
  draw();
  return () => { if (!finished) { finished = true; observer.disconnect(); window.removeEventListener("resize", place); layer.remove(); } };
}
