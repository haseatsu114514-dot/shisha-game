// 卓の演出（TRF08〜10）。見た目だけ: 進行・判定・保存には触れず、操作も塞がない（pointer-events: none）。
// どれも舞台（.trpg-root）の上に重ねて、終わったら自分で片付ける。返り値の cancel() で途中でも片付く。
// 本番のDOM以外（単体テストの簡易DOMなど）では何もしない。動きを減らす設定では、短く見せて消すだけ。
import { el } from "../core/util.js";

const IDLE = Object.freeze({ finished: Promise.resolve(), cancel() {}, playing: false });
const EASE = { out: "cubic-bezier(.16,1,.3,1)", in: "cubic-bezier(.55,0,.85,.35)", back: "cubic-bezier(.2,1.4,.4,1)" };
const live = root => typeof document?.createElement === "function" && typeof root?.animate === "function" && root.isConnected !== false;
const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 演出を載せる層。舞台と同じ大きさで、はみ出しを切る（overflow: hidden）。
 * 舞台（.trpg-root）へ直接置くと、帯や札が舞台の外へ出た分だけ舞台の横スクロール幅が増えて、
 * ボタンを押した拍子に舞台ごと横へずれることがあった（相談ボタンが画面の外へ出た）。
 */
function layerOf(root) {
  let layer = [...root.children].find(node => node.classList?.contains("trpg-fx-layer"));
  if (!layer) { layer = el("div.trpg-fx-layer", { "aria-hidden": "true" }); root.append(layer); }
  return layer;
}

/** One overlay with its own animations and timers; everything stops and leaves together. */
function overlay(root, node, onCleanup = null) {
  const animations = [], timers = [];
  let done = false, resolveFinished;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  const handle = {
    finished, playing: true,
    animate(target, frames, options) {
      if (!target || typeof target.animate !== "function") return null;
      const animation = target.animate(frames, { fill: "both", ...options });
      animations.push(animation);
      return animation;
    },
    at(ms, fn) { timers.push(setTimeout(() => { if (!done) fn(); }, ms)); },
    cancel() {
      if (done) return;
      done = true; handle.playing = false;
      for (const timer of timers) clearTimeout(timer);
      for (const animation of animations) { try { animation.cancel(); } catch { /* already gone */ } }
      node.remove();
      onCleanup?.();
      resolveFinished();
    },
  };
  layerOf(root).append(node);
  return handle;
}

/**
 * 転生（TRF08）: キャラ作りが終わって物語が始まる瞬間。卓の顔ぶれの札が一枚ずつ裏返り、本人から役の姿へ変わる。
 * 最後に全員の役姿と舞台の名前を一緒に見せる。
 * cards: [{ real: { name, face: Node }, role: { name, title, figure: Node } }]
 */
export function playIncarnation(root, { cards = [], kicker = "物語の中へ", place = "", teller = "", onFlip = () => {}, onArrive = () => {} } = {}) {
  if (!live(root) || !cards.length) return IDLE;
  const cardNodes = cards.map(card => el("div.trpg-incarnate-card", [
    el("div.trpg-incarnate-face.front", [el("span.trpg-incarnate-portrait", card.real.face), el("strong", { text: card.real.name })]),
    el("div.trpg-incarnate-face.back", [el("span.trpg-incarnate-figure", card.role.figure),
      el("small", { text: card.role.title || "" }), el("strong", { text: card.role.name })]),
  ]));
  const veil = el("div.trpg-incarnate-veil"), head = el("p.trpg-incarnate-kicker", { text: kicker });
  const row = el("div.trpg-incarnate-cards", cardNodes);
  const placeNode = el("div.trpg-incarnate-place", [el("small", { text: "物語の舞台" }), el("strong", { text: place }),
    teller ? el("span", { text: teller }) : null].filter(Boolean));
  const node = el("div.trpg-incarnate", { "aria-hidden": "true" }, [veil, head, row, placeNode]);
  // 操作ボタンは読み上げ対象外の演出層の外。下の台詞の送りとは独立して閉じる。
  const skip = el("button.trpg-button.trpg-incarnate-skip", { type: "button", text: "変身をスキップ",
    dataset: { test: "trpg-incarnate-skip" }, onclick: () => fx.cancel() });
  const fx = overlay(root, node, () => {
    if (document.activeElement === skip) root.querySelector('[data-test="trpg-next"]')?.focus({ preventScroll: true });
    skip.remove();
    document.removeEventListener("visibilitychange", hide);
  });
  function hide() { if (document.hidden) fx.cancel(); }
  document.addEventListener("visibilitychange", hide);
  root.append(skip);

  const still = calm() || document.body?.classList.contains("reduce-shake");
  const firstTurn = still ? 440 : 600, step = still ? 0 : 165, turnMs = still ? 0 : 430;
  const arrived = firstTurn + (cardNodes.length - 1) * step + turnMs;
  const end = arrived + (still ? 790 : 990);
  node.dataset.calm = String(!!still);
  cardNodes.forEach((card, i) => {
    const at = firstTurn + i * step;
    fx.at(at + turnMs / 2, () => {
      card.dataset.side = "back";
      if (!still) onFlip(i);
    });
    if (still) return;
    // 札を少し浮かせて、縁が見える瞬間に役を切り替える。光は札の縁だけ。
    const options = { duration: turnMs, delay: at, easing: "ease-in-out" };
    fx.animate(card.querySelector(".front"), [{ transform: "rotateY(0)" }, { transform: "rotateY(180deg)" }], options);
    fx.animate(card.querySelector(".back"), [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0)" }], options);
    fx.animate(card, [{ transform: "translateY(0)" }, { transform: "translateY(-9px)", offset: .5 }, { transform: "translateY(0)" }], options);
  });
  fx.at(arrived, () => { node.dataset.arrived = "true"; onArrive(); });
  if (!still) {
    fx.animate(node, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: "none" });
    fx.animate(node, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: end - 220, fill: "forwards" });
  }
  fx.at(end, fx.cancel);
  return fx;
}

/** 場面の題の札（TRF10）: 場面が切り替わった時に、真鍮の帯が横から入って抜ける。tone "alert" は思わぬ展開。 */
export function playSceneCard(root, { kicker = "", title = "", tone = "" } = {}) {
  if (!live(root) || !title) return IDLE;
  const node = el("div.trpg-scene-card", { "aria-hidden": "true", dataset: { tone } }, [
    el("i.trpg-scene-card-band"), el("small", { text: kicker }), el("strong", { text: title }),
  ]);
  const fx = overlay(root, node);
  const ms = calm() ? 900 : 1350;
  if (calm()) {
    fx.animate(node, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: ms, easing: "linear" });
  } else {
    fx.animate(node.querySelector(".trpg-scene-card-band"), [{ transform: "scaleX(0)", easing: EASE.out }, { transform: "scaleX(1)", offset: .2 },
      { transform: "scaleX(1)", offset: .78, easing: EASE.in }, { transform: "scaleX(0)", transformOrigin: "right center" }], { duration: ms, easing: "linear" });
    for (const [selector, delay] of [["small", 90], ["strong", 150]]) {
      fx.animate(node.querySelector(selector), [{ opacity: 0, transform: "translateX(-34px)", easing: EASE.out }, { opacity: 1, transform: "translateX(0)", offset: .22 },
        { opacity: 1, transform: "translateX(6px)", offset: .74, easing: "ease-in" }, { opacity: 0, transform: "translateX(40px)" }], { duration: ms - delay, delay, easing: "linear" });
    }
  }
  fx.at(ms + 40, fx.cancel);
  return fx;
}

/** 手がかりの札（TRF10）: 新しい手がかり・聞いた話を見つけた時、紙の札が上から置かれる。 */
export function playClueCard(root, { kicker = "手がかり", title = "" } = {}) {
  if (!live(root) || !title) return IDLE;
  const node = el("div.trpg-clue-card", { "aria-hidden": "true" }, [el("small", { text: kicker }), el("strong", { text: title })]);
  const fx = overlay(root, node);
  const ms = calm() ? 1400 : 2100;
  if (calm()) {
    fx.animate(node, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .8 }, { opacity: 0 }], { duration: ms, easing: "linear" });
  } else {
    fx.animate(node, [{ opacity: 0, transform: "translate(-50%, -46px) rotate(-7deg) scale(1.12)", easing: EASE.back },
      { opacity: 1, transform: "translate(-50%, 0) rotate(-2deg) scale(1)", offset: .16 },
      { opacity: 1, transform: "translate(-50%, 0) rotate(-2deg) scale(1)", offset: .82, easing: "ease-in" },
      { opacity: 0, transform: "translate(-50%, -14px) rotate(-2deg) scale(.98)" }], { duration: ms, easing: "linear" });
  }
  fx.at(ms + 40, fx.cancel);
  return fx;
}

/** 判定の結果のカットイン（TRF09）: 動いた役の姿と結果が、帯になって場面を横切る。 */
export function playResultCut(root, { figure = null, who = "", how = "", label = "", grade = "mixed", special = "" } = {}) {
  if (!live(root) || !label) return IDLE;
  const node = el("div.trpg-cutin", { "aria-hidden": "true", dataset: { grade, special } }, [
    el("i.trpg-cutin-band"),
    // 役衣装の絵がある役は、札ではなく人物として立たせる（TRF19）。絵の無い役（顔の丸）は札のまま。
    figure ? el("span.trpg-cutin-figure", { dataset: { cutout: String(!!figure.classList?.contains("trpg-costume")) } }, figure) : null,
    el("span.trpg-cutin-copy", [el("small", { text: [who, how].filter(Boolean).join(" · ") }), el("strong", { text: label })]),
  ].filter(Boolean));
  if (root?.dataset) root.dataset.cutin = "true";
  const fx = overlay(root, node, () => {
    const layer = [...(root.children || [])].find(child => child.classList?.contains?.("trpg-fx-layer"));
    const stillActive = [...(layer?.children || [])].some(child => child.classList?.contains?.("trpg-cutin"));
    if (!stillActive && root?.dataset) delete root.dataset.cutin;
  });
  const ms = calm() ? 900 : special === "critical" ? 1500 : 1250;
  if (calm()) {
    fx.animate(node, [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .75 }, { opacity: 0 }], { duration: ms, easing: "linear" });
  } else {
    fx.animate(node.querySelector(".trpg-cutin-band"), [{ transform: "skewX(-12deg) scaleX(0)", easing: EASE.out }, { transform: "skewX(-12deg) scaleX(1)", offset: .16 },
      { transform: "skewX(-12deg) scaleX(1)", offset: .82, easing: EASE.in }, { transform: "skewX(-12deg) scaleX(0)", transformOrigin: "right center" }], { duration: ms, easing: "linear" });
    fx.animate(node.querySelector(".trpg-cutin-figure"), [{ opacity: 0, transform: "translateX(-90px)", easing: EASE.out }, { opacity: 1, transform: "translateX(0)", offset: .2 },
      { opacity: 1, transform: "translateX(14px)", offset: .8, easing: "ease-in" }, { opacity: 0, transform: "translateX(70px)" }], { duration: ms, easing: "linear" });
    fx.animate(node.querySelector(".trpg-cutin-copy"), [{ opacity: 0, transform: "translateX(70px)", easing: EASE.out }, { opacity: 1, transform: "translateX(0)", offset: .22 },
      { opacity: 1, transform: "translateX(-10px)", offset: .8, easing: "ease-in" }, { opacity: 0, transform: "translateX(-60px)" }], { duration: ms, easing: "linear" });
    fx.animate(node.querySelector("strong"), [{ transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: 300, delay: ms * .16, easing: EASE.back });
  }
  fx.at(ms + 40, fx.cancel);
  return fx;
}

/** 画面の衝撃（TRF09・TRF10）: 部屋の絵の揺れ・光。kind = twist（思わぬ展開）／critical／fumble／arrive（物語に入った瞬間）。 */
export function impact(root, kind) {
  if (!live(root)) return IDLE;
  const node = el("div.trpg-impact", { "aria-hidden": "true", dataset: { kind } });
  const fx = overlay(root, node);
  const tint = { twist: "#ffb36b", critical: "#ffe08a", fumble: "#8ea2c4", arrive: "#fff6dc" }[kind] || "#ffffff";
  node.style.setProperty("--impact", tint);
  const ms = kind === "critical" ? 900 : 700;
  fx.animate(node, [{ opacity: 0 }, { opacity: kind === "fumble" ? .5 : .62, offset: .14 }, { opacity: 0 }], { duration: ms, easing: "ease-out" });
  if (!calm() && (kind === "twist" || kind === "critical" || kind === "fumble")) {
    const amp = kind === "fumble" ? 5 : 9;
    // 揺らすのは部屋の絵だけ（枠 .trpg-room が切り抜く）。舞台の中身ごと揺らすと、揺れた分だけ舞台の横スクロール幅が増え、
    // 押せる所も一緒に動く。translate で動かすので、物語の層の寄り（transform: scale）とは重ならない。
    const scene = root.querySelector(".trpg-room > img");
    if (scene) fx.animate(scene, [0, 1, -1, .7, -.5, .3, 0].map((k, i, all) => ({ translate: `${k * amp}px ${(i % 2 ? -1 : 1) * Math.abs(k) * amp * .45}px`, offset: i / (all.length - 1) })),
      { duration: 460, easing: "linear", fill: "none" });
  }
  fx.at(ms + 40, fx.cancel);
  return fx;
}
