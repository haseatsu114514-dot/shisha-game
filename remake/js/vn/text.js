// 台詞の組版: 全角24字と実際の表示幅を上限に折り、最大2行で改ページする。
// データの改行と装飾を保ち、ブラウザの再折り返しで行数が増えないようにする。
export const WRAP_LIMIT = 24;
export const MAX_PAGE_LINES = 2;
const BREAK_AFTER = "、。，．！？…‥」』）】〉》";
const NO_LINE_START = "、。，．！？…‥ー〜ぁぃぅぇぉっゃゅょんゎ々ァィゥェォッャュョ」』）】〉》・";
const OPENERS = "「『（【〈《";
const TAG_PATTERN = /^\[\/?(imp|warn|hint|red|blue|sub)\]/;
const graphemes = typeof Intl?.Segmenter === "function"
  ? new Intl.Segmenter("ja", { granularity: "grapheme" }) : null;

function tokensOf(raw) {
  const indexed = graphemes
    ? new Map([...graphemes.segment(raw)].map((s) => [s.index, s.segment])) : null;
  const tokens = [];
  for (let i = 0; i < raw.length;) {
    const tag = TAG_PATTERN.exec(raw.slice(i));
    const value = tag ? tag[0] : indexed?.get(i) || String.fromCodePoint(raw.codePointAt(i));
    tokens.push({ value, tag: tag?.[1] || "", width: tag ? 0 : value.codePointAt(0) <= 0xff ? 0.5 : 1 });
    i += value.length;
  }
  return tokens;
}
const widthOf = (raw) => tokensOf(raw).reduce((n, t) => n + t.width, 0);
function previousVisible(tokens, end) {
  while (--end >= 0) if (!tokens[end].tag) return end;
  return -1;
}
function nextVisible(tokens, start) {
  while (start < tokens.length && tokens[start].tag) start++;
  return start;
}
function safeBoundary(tokens, end) {
  const previous = previousVisible(tokens, end), next = nextVisible(tokens, end);
  return !OPENERS.includes(tokens[previous]?.value || "\0") &&
    !NO_LINE_START.includes(tokens[next]?.value || "\0");
}

/** 文末優先・禁則は上限の内側で処理する。句読点まで先読みして行を延ばさない。 */
export function autoWrap(raw, limit = WRAP_LIMIT, layout = {}) {
  return String(raw).split("\n").map((segment) => {
    const tokens = tokensOf(segment), lines = [];
    let start = 0;
    while (start < tokens.length) {
      let end = start, units = 0, text = "";
      while (end < tokens.length) {
        const token = tokens[end];
        const nextText = text + (token.tag ? "" : token.value);
        const tooWide = layout.measure && layout.maxWidth > 0 && layout.measure(nextText) > layout.maxWidth;
        if (!token.tag && units > 0 && (units + token.width > limit || tooWide)) break;
        units += token.width;
        text = nextText;
        end++;
      }
      let cut = end;
      if (end < tokens.length) {
        let preferred = -1;
        for (const punctuation of ["。！？", BREAK_AFTER]) {
          for (let k = end - 1; k >= start; k--) {
            if (tokens[k].tag || !punctuation.includes(tokens[k].value) || !safeBoundary(tokens, k + 1)) continue;
            if (tokens.slice(start, k + 1).reduce((n, t) => n + t.width, 0) >= limit * 0.3) {
              preferred = k + 1; break;
            }
          }
          if (preferred >= 0) break;
        }
        if (preferred >= 0) cut = preferred;
        else {
          while (!safeBoundary(tokens, cut)) {
            const earlier = previousVisible(tokens, cut);
            if (earlier <= start || !tokens.slice(start, earlier).some((t) => !t.tag)) break;
            cut = earlier;
          }
        }
      }
      lines.push(tokens.slice(start, cut).map((t) => t.value).join(""));
      start = cut;
    }
    return lines.join("\n");
  }).join("\n");
}

/** 各ページ内で装飾を閉じ、続くページでは同じ装飾を開き直す。 */
function balancePages(pages) {
  const active = [];
  return pages.map((page) => {
    const prefix = active.map((tag) => `[${tag}]`).join("");
    for (const token of tokensOf(page)) {
      if (!token.tag) continue;
      if (token.value.startsWith("[/")) {
        const at = active.lastIndexOf(token.tag);
        if (at >= 0) active.splice(at, 1);
      } else active.push(token.tag);
    }
    return prefix + page + [...active].reverse().map((tag) => `[/${tag}]`).join("");
  });
}

/** 短い末尾だけのページは避けつつ、常にMAX_PAGE_LINES以内に収める。 */
export function paginate(raw, layout = {}) {
  const lines = autoWrap(raw, WRAP_LIMIT, layout).split("\n");
  const pages = [];
  let start = 0;
  if (lines.length > MAX_PAGE_LINES && lines.length % MAX_PAGE_LINES === 1 &&
      widthOf(lines.at(-1)) <= WRAP_LIMIT * 0.4) {
    pages.push(lines[0]); start = 1;
  }
  for (let k = start; k < lines.length; k += MAX_PAGE_LINES) pages.push(lines.slice(k, k + MAX_PAGE_LINES).join("\n"));
  return balancePages(pages.length ? pages : [""]);
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TAGS = ["imp", "warn", "hint", "red", "blue", "sub"];

/** [imp]…[/imp] 等を span に。改行は <br> */
export function formatHtml(raw) {
  let t = escapeHtml(String(raw));
  for (const tag of TAGS) t = t.replaceAll(`[${tag}]`, `<span class="tx-${tag}">`).replaceAll(`[/${tag}]`, "</span>");
  return t.replace(/\n/g, "<br>");
}

export const stripTags = (raw) => String(raw).replace(/\[\/?[a-z]+\]/g, "");

/**
 * タイプ表示用: HTML を「見える文字 n 文字ぶん」だけ切り出す（タグは閉じたまま保つ）。
 * 装飾タグ入りの行でも一文字ずつ出せる。
 */
export function sliceHtml(html, n) {
  let out = "";
  let shown = 0;
  let i = 0;
  const open = [];
  while (i < html.length && shown < n) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i);
      const tag = html.slice(i, close + 1);
      out += tag;
      if (tag.startsWith("</")) open.pop();
      else if (!tag.endsWith("/>") && !tag.startsWith("<br")) open.push(tag);
      i = close + 1;
      continue;
    }
    if (html[i] === "&") {
      const semi = html.indexOf(";", i);
      out += html.slice(i, semi + 1);
      i = semi + 1;
    } else {
      out += html[i++];
    }
    shown++;
  }
  return out + open.map(() => "</span>").join("");
}

export const visibleLength = (html) => html.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "_").length;
