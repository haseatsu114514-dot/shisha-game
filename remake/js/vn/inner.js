// ひより専用の、プレイヤーだけに見える本心。発話・報酬・主人公の知識には使わない。
import { autoWrap, paginate, WRAP_LIMIT } from "./text.js";

export function playerInner(line) {
  if (line?.speaker !== "hiyori" || line.type || typeof line.inner !== "string") return "";
  const value = line.inner.trim();
  if (!value) return "";
  return value.startsWith("（") && value.endsWith("）") ? value : `（${value}）`;
}

/** 心の声は本文と同じ大きさで1行に収める（#3099/#3100）。実測では全件（最長30字）が1行に収まる。
 * 測って1行に収まらない本心だけ、従来どおり折り返して送る（各ページで括弧を閉じる）。 */
export function paginateInner(text, layout = {}) {
  if (!layout.measure || !layout.maxWidth || layout.measure(text) <= layout.maxWidth) return [text];
  const content = text.slice(1, -1);
  const innerLayout = { ...layout, measure: (value) => layout.measure(`（${value}）`) };
  return paginate(autoWrap(content, WRAP_LIMIT - 2, innerLayout), innerLayout).map((page) => `（${page}）`);
}
