// 本編と台詞エディタが使う、表示要素の実幅・書体による組版経路。
import { paginate } from "./text.js";
import { paginateInner } from "./inner.js";

let measurementContext = null;
export function paginateForBox(text, target, split = paginate, maxLines = 2) {
  measurementContext ||= target.ownerDocument.createElement("canvas").getContext("2d");
  if (!measurementContext || !target.clientWidth) return split(text, { maxLines });
  const style = target.ownerDocument.defaultView.getComputedStyle(target);
  const normal = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const emphasis = `${style.fontStyle} 700 ${style.fontSize} ${style.fontFamily}`;
  const tracking = parseFloat(style.letterSpacing) || 0;
  return split(text, {
    maxLines,
    maxWidth: target.clientWidth - 4,
    measure(value) {
      measurementContext.font = normal;
      const regularWidth = measurementContext.measureText(value).width;
      measurementContext.font = emphasis;
      return Math.max(regularWidth, measurementContext.measureText(value).width) +
        Math.max(0, Array.from(value).length - 1) * tracking;
    },
  });
}

/** has-inner等のクラスを適用してから呼ぶ。本心は最後の発言に併記し、続きでは発言を残す。 */
export function dialoguePages(text, inner, textTarget, innerTarget) {
  const pages = paginateForBox(text, textTarget, paginate, inner ? 1 : 2)
    .map(value => ({ text: value, inner: "" }));
  if (inner) {
    innerTarget.hidden = false;
    const thoughts = paginateForBox(inner, innerTarget, paginateInner);
    const last = pages.at(-1);
    last.inner = thoughts[0];
    pages.push(...thoughts.slice(1).map(value => ({ text: last.text, inner: value, continuation: true })));
  }
  return pages;
}
