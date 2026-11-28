// 「／」は、幅が足りない時にだけ使う台詞の切れ目。かぎ括弧も隣の文節と一緒に運ぶ。
import { el } from "../../core/util.js";

export function introQuote(tag, line, attrs = {}) {
  const parts = `「${line ?? ""}」`.split(line?.includes("／") ? "／" : /(?<=、)/u);
  const quote = el(tag, { ...attrs, dataset: { line: line ?? "" } });
  for (const [i, part] of parts.entries()) {
    if (i) quote.append(/[！？♪]$/.test(parts[i - 1]) ? " " : el("wbr"));
    quote.append(el("span.vt-cv-phrase", { text: part }));
  }
  return quote;
}
