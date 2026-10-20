// 台詞の組版: 全角24字と実際の表示幅を上限に折り、最大2行で改ページする。
// データの改行と装飾を保ち、ブラウザの再折り返しで行数が増えないようにする。
import { model as PHRASE_MODEL_DATA } from "./budoux_ja.js";

export const WRAP_LIMIT = 24;
export const MAX_PAGE_LINES = 2;
// 句読点が無い行は、語の途中で折るより手前の文節の頭で早めに折る。ただし行がこれより短くなるなら上限で折る
const PHRASE_MIN = 0.4;
const BREAK_AFTER = "、。，．！？…‥」』）】〉》♡♪☆★─―—";
const NO_LINE_START = "、。，．！？…‥ー〜ぁぃぅぇぉっゃゅょんゎ々ァィゥェォッャュョ」』）】〉》・";
const OPENERS = "「『（【〈《";
const CLOSERS = "」』）】〉》";
const DASHES = "─―—";
const SPACES = " 　"; // 行頭に来た区切りの空白は表示しない
const HIRAGANA = /^[\u3041-\u309f]$/;
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
/** 装飾・改行を除く全角換算の目安。実際の組版には表示要素の測定値も使う。 */
export const textWidth = (raw) => widthOf(String(raw).replaceAll("\n", ""));
function previousVisible(tokens, end) {
  while (--end >= 0) if (!tokens[end].tag) return end;
  return -1;
}
function nextVisible(tokens, start) {
  while (start < tokens.length && (tokens[start].tag || SPACES.includes(tokens[start].value))) start++;
  return start;
}
/** 開き括弧の直後・行頭禁則の直前・「──」の間では折らない。 */
function safeBoundary(tokens, end) {
  const before = tokens[previousVisible(tokens, end)]?.value || "\0";
  const after = tokens[nextVisible(tokens, end)]?.value || "\0";
  return !OPENERS.includes(before) && !NO_LINE_START.includes(after) &&
    !(DASHES.includes(before) && DASHES.includes(after));
}

// 文節の頭の推定は BudouX（Apache-2.0）の Parser.parseBoundaries と同じ計算。
const PHRASE_MODEL = new Map(Object.entries(PHRASE_MODEL_DATA).map(([k, v]) => [k, new Map(Object.entries(v))]));
const PHRASE_BASE = -0.5 * [...PHRASE_MODEL.values()]
  .flatMap((group) => [...group.values()]).reduce((sum, score) => sum + score, 0);
const PHRASE_FEATURES = [["UW1", -3, -2], ["UW2", -2, -1], ["UW3", -1, 0], ["UW4", 0, 1], ["UW5", 1, 2],
  ["UW6", 2, 3], ["BW1", -2, 0], ["BW2", -1, 1], ["BW3", 0, 2], ["TW1", -3, 0], ["TW2", -2, 1],
  ["TW3", -1, 2], ["TW4", 0, 3]];
// ひらがな同士の間は「えへ｜へ」「ほぐ｜して」のような誤りが多いので、強い区切りだけを使う
const HIRAGANA_PAIR_MIN_SCORE = 500;
const KANJI = /^[\u3400-\u4dbf\u4e00-\u9fff々〆]$/;
const ASCII_WORD = /^[0-9A-Za-z]$/;
const words = typeof Intl?.Segmenter === "function"
  ? new Intl.Segmenter("ja", { granularity: "word" }) : null;
function phraseScore(plain, i) {
  let score = PHRASE_BASE;
  for (const [key, from, to] of PHRASE_FEATURES) {
    score += PHRASE_MODEL.get(key)?.get(plain.substring(i + from, i + to)) || 0;
  }
  return score;
}
/**
 * 装飾タグを除いた本文で文節の頭を求め、その直前で改行できるトークン位置を返す。
 * strong は普段使う区切り、weak は他に折れる所が無いときだけ使う弱い区切り（漢字同士の間を含む）。
 */
function phraseStarts(tokens) {
  const offsets = [], strong = new Set(), weak = new Set();
  let plain = "";
  for (const token of tokens) {
    offsets.push(plain.length);
    if (!token.tag) plain += token.value;
  }
  // 辞書で一語とみなされる「ありがたい」「一人ひとり」などの内側では折らない
  const wordStarts = words ? new Set([...words.segment(plain)].map((s) => s.index)) : null;
  tokens.forEach((token, k) => {
    const at = offsets[k];
    if (token.tag || at === 0 || SPACES.includes(token.value)) return;
    if (SPACES.includes(tokens[k - 1]?.value || "")) weak.add(k); // 英文の単語の切れ目
    if (wordStarts && !wordStarts.has(at)) return;
    const before = tokens[previousVisible(tokens, k)]?.value || "", after = token.value;
    if (before === after || (ASCII_WORD.test(before) && ASCII_WORD.test(after))) return;
    const score = phraseScore(plain, at);
    if (score <= 0) return;
    weak.add(k);
    if (KANJI.test(before) && KANJI.test(after)) return;
    if (score > (HIRAGANA.test(before) && HIRAGANA.test(after) ? HIRAGANA_PAIR_MIN_SCORE : 0)) strong.add(k);
  });
  return { strong, weak };
}

/**
 * 1つの段落を折る。禁則は上限の内側で処理し、句読点まで先読みして行を延ばさない。
 * sentenceFirst なら手前の文末（。！？）を優先し、そうでなければ読点などの直後か文節の頭のうち
 * 一番後ろで折る。どちらも語の途中は避けて少しだけ早める。
 */
function legacyWrapSegment(segment, limit, layout, sentenceFirst) {
  const tokens = tokensOf(segment), lines = [];
  const phrases = phraseStarts(tokens);
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
      const widthTo = (k) => tokens.slice(start, k).reduce((n, t) => n + t.width, 0);
      const after = (k, set) => !tokens[k - 1].tag && set.includes(tokens[k - 1].value);
      let preferred = -1;
      for (let k = end; sentenceFirst && k > start && preferred < 0; k--) {
        if (after(k, "。！？") && safeBoundary(tokens, k) && widthTo(k) >= limit * 0.3) preferred = k;
      }
      for (let k = end; k > start && preferred < 0; k--) {
        if (!safeBoundary(tokens, k)) continue;
        // 「』が」「」と」のように助詞が続く閉じ括弧は文節の途中なので折らない
        const closerWithParticle = after(k, CLOSERS) && HIRAGANA.test(tokens[nextVisible(tokens, k)]?.value || "");
        if (after(k, BREAK_AFTER) && !closerWithParticle && widthTo(k) >= limit * 0.3) preferred = k;
        else if (phrases.strong.has(k) && widthTo(k) >= limit * PHRASE_MIN) preferred = k;
      }
      for (let k = end; k > start && preferred < 0; k--) {
        if (phrases.weak.has(k) && safeBoundary(tokens, k) && widthTo(k) >= limit * PHRASE_MIN) preferred = k;
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
    while (start < tokens.length && SPACES.includes(tokens[start].value)) start++;
  }
  return lines;
}

// 接続規則は語句辞書ではない。Intlは品詞を返さないので、意味の保証ではなく保守的な推定。
// 「語＋の＋語」の連鎖を一まとまりにする。句読点・空白・手動改行は越えない。
function boundaryInfo(tokens, limit, layout) {
  let plain = "";
  const offsets = tokens.map(t => { const at = plain.length; if (!t.tag) plain += t.value; return at; });
  const segments = words ? [...words.segment(plain)] : [];
  const wordRanges = segments.filter(s => s.isWordLike).map(s => [s.index, s.index + s.segment.length]);
  const chunks = [];
  for (let i = 1; i + 1 < segments.length; i++) {
    if (segments[i].segment !== "の" || !segments[i - 1].isWordLike || !segments[i + 1].isWordLike) continue;
    const range = [segments[i - 1].index, segments[i + 1].index + segments[i + 1].segment.length];
    if (chunks.length && chunks.at(-1)[1] >= range[0]) chunks.at(-1)[1] = range[1];
    else chunks.push(range);
  }
  const fits = value => widthOf(value) <= limit &&
    !(layout.measure && layout.maxWidth > 0 && layout.measure(value) > layout.maxWidth);
  const ranges = [...wordRanges.map(r => [...r, "inside-word"]), ...chunks.map(r => [...r, "connected-chunk"])];
  const protectedAt = new Map();
  // 一度だけ測定。各境界から全文や全範囲を再走査しない。
  const byOffset = new Map();
  offsets.forEach((at, k) => { if (!tokens[k].tag) byOffset.set(at, k); });
  for (const [from, to, reason] of ranges) {
    const wholeFits = fits(plain.slice(from, to));
    for (let at = from + 1; at < to; at++) {
      const k = byOffset.get(at);
      if (k === undefined) continue;
      const prior = protectedAt.get(k);
      if (!prior || wholeFits || !prior.fits) protectedAt.set(k, { reason, fits: wholeFits });
    }
  }
  return { fits, protectedAt, phrases: phraseStarts(tokens) };
}

function boundaryPenalty(tokens, k, info) {
  if (k === tokens.length) return 0;
  if (!safeBoundary(tokens, k)) return Infinity;
  const protectedPart = info.protectedAt.get(nextVisible(tokens, k));
  if (protectedPart?.fits) return Infinity;
  if (protectedPart?.reason === "inside-word") return 2;
  const before = tokens[previousVisible(tokens, k)]?.value || "";
  const after = tokens[nextVisible(tokens, k)]?.value || "";
  if (CLOSERS.includes(before) && HIRAGANA.test(after)) return 1;
  if (BREAK_AFTER.includes(before) || info.phrases.strong.has(nextVisible(tokens, k))) return 0;
  return info.phrases.weak.has(nextVisible(tokens, k)) ? 1 : 2;
}

function naturalWrap(segment, limit, layout) {
  const tokens = tokensOf(segment);
  if (!tokens.length) return [];
  const info = boundaryInfo(tokens, limit, layout), n = tokens.length;
  const best = new Array(n + 1);
  best[n] = { penalty: 0, count: 0, cost: 0 };
  // 後続行の最良結果を保存する反復DP。再帰・組合せの全列挙はしない。
  for (let start = n - 1; start >= 0; start--) {
    let visible = "", units = 0, visibleCount = 0;
    const choices = [];
    for (let end = start + 1; end <= n; end++) {
      const t = tokens[end - 1];
      if (!t.tag) { visible += t.value; units += t.width; visibleCount++; }
      if (!units) continue;
      const fits = units <= limit && !(layout.measure && layout.maxWidth > 0 && layout.measure(visible) > layout.maxWidth);
      // 単一書記素も収まらない幅では、その1字だけを出して必ず前進。
      if (!fits && visibleCount > 1) break;
      if (end < n && tokens[end].tag) continue;
      let next = end;
      while (next < n && SPACES.includes(tokens[next].value)) next++;
      const tail = best[next];
      if (!tail) continue;
      const penalty = boundaryPenalty(tokens, end, info);
      const before = tokens[previousVisible(tokens, end)]?.value || "";
      choices.push({ end, next, penalty: penalty + tail.penalty, count: 1 + tail.count,
        cost: tail.cost + (end === n ? 0 : (BREAK_AFTER.includes(before) ? 0 : 1) + (1 - units / limit) ** 2) });
      if (!fits) break;
    }
    const compare = (a, b) => a.penalty - b.penalty || a.count - b.count || a.cost - b.cost || b.end - a.end;
    const valid = choices.filter(c => Number.isFinite(c.penalty));
    // 禁則と幅が両立しない極小幅だけ、最も先へ進む境界を使う（診断対象）。
    best[start] = valid.reduce((best, c) => !best || compare(c, best) < 0 ? c : best, null) || choices.at(-1);
    if (best[start] && !Number.isFinite(best[start].penalty)) best[start].penalty = 100 + best[best[start].next].penalty;
  }
  const lines = [];
  for (let start = 0; start < n;) {
    const step = best[start];
    if (!step) { lines.push(tokens.slice(start).map(t => t.value).join("")); break; } // タグのみの末尾
    lines.push(tokens.slice(start, step.end).map(t => t.value).join(""));
    start = step.next;
  }
  // 同じページ数で自然な既存の文末優先案は維持する。
  const legacy = legacyWrapSegment(segment, limit, layout, true);
  const pages = rows => Math.ceil(rows.length / (layout.maxLines ?? MAX_PAGE_LINES));
  let at = 0, legacyPenalty = 0;
  for (const line of legacy) {
    at += tokensOf(line).length;
    legacyPenalty += boundaryPenalty(tokens, at, info);
    while (at < n && SPACES.includes(tokens[at].value)) at++;
  }
  return legacyPenalty === 0 && pages(legacy) <= pages(lines) ? legacy : lines;
}

/** 手動改行は固定。単語・接続を保ち、前後両行を評価する。 */
export function autoWrap(raw, limit = WRAP_LIMIT, layout = {}) {
  if (!Number.isFinite(limit) || limit <= 0) throw new RangeError("wrap limit must be positive");
  return String(raw).split("\n").map(segment => naturalWrap(segment, limit, layout).join("\n")).join("\n");
}

/** 共有組版の境界情報による診断。検査側に別の語句辞書・折返し器を持たせない。 */
export function wrapDiagnostics(raw, limit = WRAP_LIMIT, layout = {}) {
  const diagnostics = [];
  String(raw).split("\n").forEach((segment, paragraph) => {
    const tokens = tokensOf(segment), info = boundaryInfo(tokens, limit, layout);
    const rows = naturalWrap(segment, limit, layout);
    let at = 0;
    rows.forEach((line, row) => {
      at += tokensOf(line).length;
      if (!info.fits(stripTags(line))) diagnostics.push({ paragraph, row, reason: "width-overflow", line });
      if (at < tokens.length) {
        const part = info.protectedAt.get(nextVisible(tokens, at));
        const penalty = boundaryPenalty(tokens, at, info);
        if (part || penalty > 0) diagnostics.push({ paragraph, row, reason: part?.reason ||
          (safeBoundary(tokens, at) ? "weak-boundary" : "kinsoku"), line, next: rows[row + 1], forced: !part?.fits });
      }
      while (at < tokens.length && SPACES.includes(tokens[at].value)) at++;
    });
  });
  return diagnostics;
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
  const maxLines = layout.maxLines ?? MAX_PAGE_LINES;
  const pages = [];
  let start = 0;
  if (maxLines > 1 && lines.length > maxLines && lines.length % maxLines === 1 &&
      widthOf(lines.at(-1)) <= WRAP_LIMIT * 0.4) {
    pages.push(lines[0]); start = 1;
  }
  for (let k = start; k < lines.length; k += maxLines) pages.push(lines.slice(k, k + maxLines).join("\n"));
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
