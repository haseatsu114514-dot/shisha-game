// 「／」は、幅が足りない時にだけ使う台詞の切れ目。かぎ括弧も隣の文節と一緒に運ぶ。
import { el } from "../../core/util.js";

export function introQuote(line) {
  const parts = `「${line ?? ""}」`.split(line?.includes("／") ? "／" : /(?<=、)/u);
  const quote = el("p.vt-cv-quote");
  // 2つの文節は長い方が1行に収まるサイズまで。区切りのない台詞は大きい字で均等に折る。
  if (parts.length > 1) quote.style.setProperty("--quote-columns", Math.max(...parts.map(part => [...part].length)));
  for (const [i, part] of parts.entries()) {
    if (i) quote.append(/[！？♪]$/.test(parts[i - 1]) ? " " : el("wbr"));
    quote.append(el("span.vt-cv-phrase", { text: part }));
  }
  return quote;
}
