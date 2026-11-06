// 制作の工程が替わるとき、操作欄だけを細い一筆の帯が横切る（#2688 A17）。0.35 秒・入力は止めない。
// 3・2・1 の前に終わる長さ。SKIP／自動では短く、動きを減らす設定ではその場で薄く光るだけ。
// 外すときは craft/session.js の stepPanel の呼び出しを消す。
import { el } from "../core/util.js";
import { reducedMotion } from "../core/transition-kit.js";

const skipping = () => Boolean(window.__remake?.craftTest?.auto || document.body?.classList.contains("vn-skip"));

/** host（作業台の操作欄）を細い帯が横切る。初めの工程では呼ばない */
export function stepStroke(host) {
  if (!host?.isConnected) return null;
  // 操作欄が位置を持たない画面配置では、帯が作業台全体に広がるので出さない。
  if (getComputedStyle(host).position === "static") return null;
  host.querySelector(":scope > .tm-stroke-clip")?.remove();
  const calm = reducedMotion();
  const stroke = el("i.tm-stroke", { dataset: { calm: String(calm) } });
  const clip = el("div.tm-stroke-clip", { "aria-hidden": "true" }, [stroke]);
  host.append(clip);
  const frames = calm
    ? [{ opacity: 0 }, { opacity: 0.5 }, { opacity: 0 }]
    : [{ transform: "translateX(-110%) skewX(-18deg)" }, { transform: "translateX(110%) skewX(-18deg)" }];
  stroke.animate(frames, { duration: skipping() ? 160 : 350, easing: "cubic-bezier(.7,0,.2,1)", fill: "both" })
    .finished.catch(() => {}).then(() => clip.remove());
  return stroke;
}
