// ひより専用の、プレイヤーだけに見える本心。発話・報酬・主人公の知識には使わない。
import { autoWrap, paginate, WRAP_LIMIT } from "./text.js";

export function playerInner(line) {
  if (line?.speaker !== "hiyori" || line.type || typeof line.inner !== "string") return "";
  const value = line.inner.trim();
  if (!value) return "";
  return value.startsWith("（") && value.endsWith("）") ? value : `（${value}）`;
}

/** 長い本心も2行ごとに送り、各ページで括弧を閉じる。括弧の2字ぶんも確保する。 */
export function paginateInner(text, layout = {}) {
  const content = text.slice(1, -1);
  const innerLayout = layout.measure ? { ...layout, measure: (value) => layout.measure(`（${value}）`) } : layout;
  return paginate(autoWrap(content, WRAP_LIMIT - 2, innerLayout), innerLayout).map((page) => `（${page}）`);
}
