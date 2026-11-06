// TRPGに入った瞬間の開幕（#2719）。深緑のフェルトの幕に真鍮の札とダイスが置かれ、幕が上下に開いて卓が見える。
// 見た目だけ: 操作は塞がず（pointer-events: none）、進行・判定・保存には触れない。
// full = ボドゲカフェの本棚・試遊の本棚に入った時（約1.5秒）。open = 本棚から卓を始めた時の短い開き（約0.7秒）。
// 動きを減らす設定では、動かさずに札だけを短く見せて消す。
const D20 = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><polygon points="50,2 95,26 95,74 50,98 5,74 5,26"/>'
  + '<path d="M50 2 25 68 75 68 50 2M5 26 25 68 5 74M95 26 75 68 95 74M50 98 25 68M50 98 75 68M5 26 50 2 95 26"/></svg>';
const MS = { full: 1500, open: 720, calm: 700 };
const EASE = { in: "cubic-bezier(.55,0,.85,.35)", out: "cubic-bezier(.16,1,.3,1)", open: "cubic-bezier(.7,0,.25,1)" };
const IDLE = Object.freeze({ finished: Promise.resolve(), cancel() {} });
let showing = null;

/** 開幕を舞台の演出層に重ねる。返り値の cancel() で途中でも片付ける。 */
export function playTrpgEntrance(host, { variant = "full", kicker = "TABLETOP RPG", title = "小さな卓の冒険", foot = "" } = {}) {
  // 本番のDOM以外（単体テストの簡易DOMなど）では何もしない。
  if (typeof document?.createElement !== "function" || typeof host?.closest !== "function" || !host.isConnected) return IDLE;
  // 本棚の開幕が出ている間に卓を始めたら、短い開きは重ねない。
  if (variant === "open" && showing?.isConnected) return IDLE;
  const layer = document.getElementById("fx") || host.closest("#stage") || host;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const full = variant !== "open";
  const node = document.createElement("div");
  node.className = "trpg-entrance";
  node.dataset.variant = full ? "full" : "open";
  node.setAttribute("aria-hidden", "true");
  const part = (cls, parent = node) => { const n = document.createElement("div"); n.className = cls; parent.append(n); return n; };
  const top = part("trpg-entrance-felt top"), bottom = part("trpg-entrance-felt bottom");
  const seam = part("trpg-entrance-seam");
  let plate = null, die = null;
  if (full) {
    plate = part("trpg-entrance-plate");
    for (const [cls, text] of [["trpg-entrance-kicker", kicker], ["trpg-entrance-title", title], ["trpg-entrance-foot", foot]]) {
      if (!text) continue;
      const line = document.createElement("span"); line.className = cls; line.textContent = text; plate.append(line);
    }
    die = part("trpg-entrance-die");
    die.innerHTML = D20 + "<b>20</b>";
  }
  layer.append(node);
  if (full) { showing?.remove(); showing = node; }
  let done = false, resolveFinished;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  const animations = [];
  const animate = (target, frames, options) => {
    if (!target || typeof target.animate !== "function") return;
    animations.push(target.animate(frames, { fill: "both", ...options }));
  };
  const cancel = () => {
    if (done) return;
    done = true;
    for (const animation of animations) animation.cancel();
    node.remove();
    if (showing === node) showing = null;
    resolveFinished();
  };
  if (reduced || typeof node.animate !== "function") {
    // 動きを減らす: 開かずに、全体を短く淡く消すだけ。
    animate(node, [{ opacity: 1 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: MS.calm, easing: "ease" });
  } else if (full) {
    animate(plate, [
      { opacity: 0, transform: "translate(-50%, -50%) scale(.86)" },
      { opacity: 1, transform: "translate(-50%, -50%) scale(1.03)", offset: .16 },
      { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: .24 },
      { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: .56 },
      { opacity: 0, transform: "translate(-50%, -58%) scale(.98)", offset: .64 },
      { opacity: 0, transform: "translate(-50%, -58%) scale(.98)" },
    ], { duration: MS.full, easing: "ease-out" });
    // 右から転がってきて、札の脇で二度はねて止まる。
    animate(die, [
      { opacity: 0, transform: "translate(420px, -150px) rotate(-320deg) scale(1.15)" },
      { opacity: 1, transform: "translate(120px, 18px) rotate(-90deg) scale(1)", offset: .2 },
      { transform: "translate(40px, -22px) rotate(-24deg)", offset: .29 },
      { transform: "translate(0, 0) rotate(0deg)", offset: .37 },
      { transform: "translate(0, -6px) rotate(3deg)", offset: .42 },
      { opacity: 1, transform: "translate(0, 0) rotate(0deg)", offset: .47 },
      { opacity: 1, transform: "translate(0, 0) rotate(0deg)", offset: .56 },
      { opacity: 0, transform: "translate(0, -30px) rotate(0deg)", offset: .64 },
      { opacity: 0, transform: "translate(0, -30px) rotate(0deg)" },
    ], { duration: MS.full, easing: "linear" });
    openTable(MS.full, .58);
  } else {
    openTable(MS.open, .18);
  }
  function openTable(duration, from) {
    // 幕は最初から閉じていて、from の時点から上下に開く。真鍮の継ぎ目は開き始めに一度光る。
    animate(top, [{ transform: "translateY(0)" }, { transform: "translateY(0)", offset: from }, { transform: "translateY(-101%)" }], { duration, easing: EASE.open });
    animate(bottom, [{ transform: "translateY(0)" }, { transform: "translateY(0)", offset: from }, { transform: "translateY(101%)" }], { duration, easing: EASE.open });
    animate(seam, [
      { opacity: 1, transform: "scaleX(1)" },
      { opacity: 1, transform: "scaleX(1)", filter: "brightness(1.5)", offset: from },
      { opacity: 0, transform: "scaleX(1.06)", offset: Math.min(1, from + .16) },
      { opacity: 0, transform: "scaleX(1.06)" },
    ], { duration, easing: "ease-out" });
  }
  Promise.all(animations.map(animation => animation.finished)).then(cancel, cancel);
  if (!animations.length) cancel();
  return { finished, cancel };
}
