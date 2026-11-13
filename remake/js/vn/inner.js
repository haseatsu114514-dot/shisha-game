// ひより専用の、プレイヤーだけに見える本心。発話・報酬・主人公の知識には使わない。
import { autoWrap, paginate, WRAP_LIMIT } from "./text.js";

export function playerInner(line) {
  if (line?.speaker !== "hiyori" || line.type || typeof line.inner !== "string") return "";
  const value = line.inner.trim();
  if (!value) return "";
  return value.startsWith("（") && value.endsWith("）") ? value : `（${value}）`;
}

/** 心の声は本文と同じ大きさで下に1行に収める（#3099/#3100）。実測で本文幅に収まる本心は
 * 折り返さず1ページで全文を出す（現行データは全82件・最長30字で全件が収まる）。
 * 幅を超える本心だけ layout.maxLines 行ごとに送り、各ページで括弧を閉じる。括弧の2字ぶんも確保する。 */
export function paginateInner(text, layout = {}) {
  if (!layout.measure || !layout.maxWidth || layout.measure(text) <= layout.maxWidth) return [text];
  const content = text.slice(1, -1);
  const innerLayout = { ...layout, measure: (value) => layout.measure(`（${value}）`) };
  return paginate(autoWrap(content, WRAP_LIMIT - 2, innerLayout), innerLayout).map((page) => `（${page}）`);
}
