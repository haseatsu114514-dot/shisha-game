// 台詞テキストの組版: 自動改行（全角24字・禁則つき）→ 最大2行で改ページ、装飾タグ、トークン置換。
// 改行はコード側で決める（CLAUDE.md「改行はautoWrapに一本化」）。データの手動 \n は尊重する。

export const WRAP_LIMIT = 24;
export const MAX_PAGE_LINES = 2;
const BREAK_AFTER = "、。，．！？…‥」』）】〉》";
// 行頭禁則。「ん」と小書きカタカナも巻き取り、「なるさ｜ん」のように呼び名が割れるのを防ぐ
const NO_LINE_START = "、。，．！？…‥ー〜ぁぃぅぇぉっゃゅょんゎ々ァィゥェォッャュョ」』）】〉》・";
const OPENERS = "「『（【〈《";

const w = (ch) => (ch.charCodeAt(0) <= 0xff ? 0.5 : 1);
const widthOf = (s) => { let n = 0; for (const ch of s) n += w(ch); return n; };

/** 装飾タグ（[imp] 等）は幅0。句読点・文末を優先して折る */
export function autoWrap(raw, limit = WRAP_LIMIT) {
  return String(raw).split("\n").map((seg) => {
    let out = "";
    let line = 0;
    let i = 0;
    while (i < seg.length) {
      if (seg[i] === "[") {
        const close = seg.indexOf("]", i);
        if (close !== -1) { out += seg.slice(i, close + 1); i = close + 1; continue; }
      }
      out += seg[i];
      line += w(seg[i]);
      i++;
      if (line < limit || i >= seg.length) continue;
      // いまの行の中で、文末（。！？）→句読点の順に一番後ろの折り目を探す
      const lineStart = out.lastIndexOf("\n") + 1;
      let back = -1;
      for (const set of ["。！？", BREAK_AFTER]) {
        for (let k = out.length - 1; k >= lineStart && back < 0; k--) {
          if (!set.includes(out[k])) continue;
          let c = k + 1;
          while (c < out.length && NO_LINE_START.includes(out[c])) c++;
          if (widthOf(out.slice(lineStart, c)) >= limit * 0.3) back = c;
        }
        if (back >= 0) break;
      }
      if (back >= 0 && back < out.length) {
        const tail = out.slice(back);
        out = out.slice(0, back) + "\n" + tail;
        line = widthOf(tail);
        continue;
      }
      // 少し先に句読点があれば、そこまで引っ張ってから折る
      for (let k = 0; k < 8 && i + k < seg.length; k++) {
        if (BREAK_AFTER.includes(seg[i + k])) { out += seg.slice(i, i + k + 1); i += k + 1; break; }
      }
      while (i < seg.length && NO_LINE_START.includes(seg[i])) out += seg[i++];
      if (i < seg.length && OPENERS.includes(out[out.length - 1])) {
        const open = out[out.length - 1];
        out = out.slice(0, -1) + "\n" + open;
        line = 1;
        continue;
      }
      // 残りが2文字以下なら折らない（末尾1文字の孤立を防ぐ）
      if (i < seg.length && widthOf(seg.slice(i)) > 2) { out += "\n"; line = 0; }
    }
    return out;
  }).join("\n");
}

/** 自動改行した行を MAX_PAGE_LINES ずつのページに分ける（孤立ページは前へ寄せる） */
export function paginate(raw) {
  const lines = autoWrap(raw).split("\n");
  const pages = [];
  let start = 0;
  if (lines.length > MAX_PAGE_LINES && lines.length % MAX_PAGE_LINES === 1 &&
      widthOf(lines[lines.length - 1]) <= WRAP_LIMIT * 0.4) {
    pages.push(lines[0]);
    start = 1;
  }
  for (let k = start; k < lines.length; k += MAX_PAGE_LINES) pages.push(lines.slice(k, k + MAX_PAGE_LINES).join("\n"));
  return pages.length ? pages : [""];
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
