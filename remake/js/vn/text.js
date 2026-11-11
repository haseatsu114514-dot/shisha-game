// 台詞の組版: 全角24字と実際の表示幅を上限に折り、最大2行で改ページする。
// データの改行と装飾を保ち、ブラウザの再折り返しで行数が増えないようにする。
import { model as PHRASE_MODEL_DATA } from "./budoux_ja.js";

export const WRAP_LIMIT = 24;
export const MAX_PAGE_LINES = 2;
// 折る位置の良さ（小さいほど良い）: 文末 ＜ 読点など ＜ 文節の頭。
const BREAK_COST = { sentence: 0, pause: 1, phrase: 2, other: 3 };
// 2行の釣り合い: 短い方が長い方のこの割合より短くなるほど「切れ端」として強く避ける（2行目だけ短い、など）。
const BALANCE_MIN = 0.4;
const SHAPE_COST = 3;
// 釣り合いが取れている案どうしなら、1行目が長い方を選ぶ。
const FILL_COST = 0.2;
// 1行に収まる「」『』（）の中と、閉じ括弧＋「の」の直後では、なるべく折らない。
const QUOTE_COST = 1.5;
// ページの切れ目は行の切れ目より重く見て、文末に合わせる。最後のページに残る短い1行（上限に対する割合）も避ける。
const PAGE_BREAK_COST = 3;
const LONE_PAGE = 0.4, LONE_PAGE_COST = 6;
const BREAK_AFTER = "、。，．！？…‥」』）】〉》♡♪☆★─―—";
const NO_LINE_START = "、。，．！？…‥ー〜ぁぃぅぇぉっゃゅょんゎ々ァィゥェォッャュョ」』）】〉》・";
const OPENERS = "「『（【〈《";
const CLOSERS = "」』）】〉》";
const DASHES = "─―—";
const SENTENCE_END = "。！？";
const LEADERS = "…‥";
const SPACES = " 　"; // 行頭に来た区切りの空白は表示しない
const HIRAGANA = /^[\u3041-\u309f]$/;
// [pause] は閉じタグの無い印（文中で一拍止まる。#2828）。幅0で、ページをまたいで開き直さない。
const TAG_PATTERN = /^\[(?:\/?(imp|warn|hint|red|blue|sub|shiver)|(pause))\]/;
const graphemes = typeof Intl?.Segmenter === "function"
  ? new Intl.Segmenter("ja", { granularity: "grapheme" }) : null;

function tokensOf(raw) {
  const indexed = graphemes
    ? new Map([...graphemes.segment(raw)].map((s) => [s.index, s.segment])) : null;
  const tokens = [];
  for (let i = 0; i < raw.length;) {
    const tag = TAG_PATTERN.exec(raw.slice(i));
    const value = tag ? tag[0] : indexed?.get(i) || String.fromCodePoint(raw.codePointAt(i));
    tokens.push({ value, tag: tag?.[1] || tag?.[2] || "", width: tag ? 0 : value.codePointAt(0) <= 0xff ? 0.5 : 1 });
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
/**
 * 開き括弧の直後・行頭禁則の直前・「──」の間では折らない。
 * 文末（。！？）の直後に始まる「……」は次の文の頭なので、行頭に置いてよい（「〜だって。／……僕、」）。
 */
function safeBoundary(tokens, end) {
  const before = tokens[previousVisible(tokens, end)]?.value || "\0";
  const after = tokens[nextVisible(tokens, end)]?.value || "\0";
  const sentenceLeader = LEADERS.includes(after) && SENTENCE_END.includes(before);
  return !OPENERS.includes(before) && (!NO_LINE_START.includes(after) || sentenceLeader) &&
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
  // 「#みんと色」のようなハッシュタグは一語として扱う
  const hashtags = [...plain.matchAll(/[#＃][^\s　、。！？]+/g)].map(m => [m.index, m.index + m[0].length]);
  const fits = value => widthOf(value) <= limit &&
    !(layout.measure && layout.maxWidth > 0 && layout.measure(value) > layout.maxWidth);
  const ranges = [...wordRanges, ...hashtags].map(r => [...r, "inside-word"]).concat(chunks.map(r => [...r, "connected-chunk"]));
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
      const selected = !prior || wholeFits || !prior.fits ? { reason, fits: wholeFits } : prior;
      protectedAt.set(k, { ...selected,
        wordFits: !!prior?.wordFits || (reason === "inside-word" && wholeFits),
        insideWord: !!prior?.insideWord || reason === "inside-word" });
    }
  }
  // 1行に収まる括弧の内側（開き括弧の次〜閉じ括弧の手前）の位置。全文を包む心の声の（）は収まらないので対象外。
  const quoted = new Set(), open = [];
  tokens.forEach((token, k) => {
    if (token.tag) return;
    if (OPENERS.includes(token.value)) open.push(k);
    else if (CLOSERS.includes(token.value) && open.length) {
      const from = open.pop();
      if (fits(tokens.slice(from, k + 1).map(t => t.tag ? "" : t.value).join(""))) for (let at = from + 1; at <= k; at++) quoted.add(at);
    }
  });
  return { fits, protectedAt, quoted, phrases: phraseStarts(tokens) };
}

/** 折る位置そのものの減点（区切りの種類とは別）。括弧の内側と、『原点』の｜味 のような閉じ括弧＋「の」の直後。 */
function breakCost(tokens, k, info) {
  const before = previousVisible(tokens, k);
  const closerNo = tokens[before]?.value === "の" && CLOSERS.includes(tokens[previousVisible(tokens, before)]?.value || "\0");
  return info.quoted.has(nextVisible(tokens, k)) || closerNo ? QUOTE_COST : 0;
}

function boundaryPenalty(tokens, k, info) {
  if (k === tokens.length) return 0;
  if (!safeBoundary(tokens, k)) return Infinity;
  const protectedPart = info.protectedAt.get(nextVisible(tokens, k));
  if (protectedPart?.fits) return Infinity;
  if (protectedPart?.insideWord) return 2;
  const before = tokens[previousVisible(tokens, k)]?.value || "";
  const after = tokens[nextVisible(tokens, k)]?.value || "";
  if (CLOSERS.includes(before) && HIRAGANA.test(after)) return 1;
  // 日本語の文に入れた空白は書き手の区切り。英単語どうしの間の空白だけは弱い区切りのまま（「GRAND SMOKE」）
  if (SPACES.includes(tokens[k]?.value || "\0") && !(ASCII_WORD.test(before) && ASCII_WORD.test(after))) return 0;
  if (BREAK_AFTER.includes(before) || info.phrases.strong.has(nextVisible(tokens, k))) return 0;
  return info.phrases.weak.has(nextVisible(tokens, k)) ? 1 : 2;
}

/** 折る位置の種類。文末（。！？、「♡ 」のような記号＋空白）、読点など（、……」♡──・区切りの空白）、文節の頭、それ以外。 */
function breakKind(tokens, k, info) {
  const before = tokens[previousVisible(tokens, k)]?.value || "";
  const space = SPACES.includes(tokens[k]?.value || "\0");
  if (SENTENCE_END.includes(before) || (space && BREAK_AFTER.includes(before))) return "sentence";
  if (BREAK_AFTER.includes(before) || space) return "pause";
  return info.phrases.strong.has(nextVisible(tokens, k)) ? "phrase" : "other";
}

/**
 * 最後の2行の見栄えの点（小さいほど良い）。first・last は全角換算の幅、kind は2行の間の区切りの種類。
 * 区切りの種類が一番効き、次に2行の釣り合い。1行目だけ短い形は、文末で折る時（「うん。」）は軽く、
 * 読点や文節で折る時（「最後に、」）は重く見る。
 */
function pairCost(first, last, kind, limit) {
  const ratio = Math.min(first, last) / Math.max(first, last);
  let shape = ratio >= BALANCE_MIN ? 0 : SHAPE_COST * (1 - ratio / BALANCE_MIN) ** 2;
  if (first < last) shape *= kind === "sentence" ? 0.5 : 2;
  return BREAK_COST[kind] + shape + FILL_COST * (1 - first / limit);
}

/** 各位置から始まる1行の候補（行末の位置・幅・その折り方の評価）。幅に収まる範囲を一度だけ測る。 */
function lineCandidates(tokens, info, limit, layout) {
  const n = tokens.length, all = new Array(n);
  for (let start = 0; start < n; start++) {
    let visible = "", units = 0, visibleCount = 0;
    const list = all[start] = [];
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
      const line = { end, next, units, kinsoku: 0, words: 0, chunks: 0, penalty: 0, kind: "", extra: 0 };
      if (end < n) {
        const penalty = boundaryPenalty(tokens, end, info), part = info.protectedAt.get(nextVisible(tokens, end));
        line.kinsoku = safeBoundary(tokens, end) ? 0 : 1;
        line.words = part?.wordFits ? 1 : 0;
        line.chunks = part?.fits ? 1 : 0;
        line.penalty = Number.isFinite(penalty) ? penalty : 0;
        line.kind = breakKind(tokens, end, info);
        line.extra = breakCost(tokens, end, info);
      }
      list.push(line);
      if (!fits) break;
    }
  }
  return all;
}

// 全経路で禁則を最優先。両立不能なら接続句、次に単語の保護を緩める。
// 後続行の違反も比較するので、局所的に安全でも句点を次行へ追い出す案を避ける。
// 区切りの弱さと行数（ページ数）が同じ案の中では、見栄えの点で選ぶ。小数の和なので、誤差ぶんの差は同点として扱う。
const compareLayouts = (a, b) => a.kinsoku - b.kinsoku || a.words - b.words || a.chunks - b.chunks ||
  a.penalty - b.penalty || a.count - b.count || (Math.abs(a.cost - b.cost) > 1e-9 ? a.cost - b.cost : 0) || b.end - a.end;
const EMPTY_LAYOUT = { kinsoku: 0, words: 0, chunks: 0, penalty: 0, count: 0, cost: 0, units: 0 };

/** 行ごとの最良の折り方。最後の2行は pairCost、その前の行は区切りの種類と行の埋まり方で選ぶ。 */
function bestLines(tokens, candidates, limit) {
  const n = tokens.length, best = new Array(n + 1);
  best[n] = EMPTY_LAYOUT;
  // 後続行の最良結果を保存する反復DP。再帰・組合せの全列挙はしない。
  for (let start = n - 1; start >= 0; start--) {
    let pick = null;
    for (const line of candidates[start]) {
      const tail = best[line.next];
      if (!tail) continue;
      const choice = { lines: [line], end: line.end, next: line.next, units: line.units,
        kinsoku: tail.kinsoku + line.kinsoku, words: tail.words + line.words, chunks: tail.chunks + line.chunks,
        penalty: tail.penalty + line.penalty, count: 1 + tail.count,
        cost: line.end === n ? 0 : line.extra + (tail.count === 1 ? pairCost(line.units, tail.units, line.kind, limit)
          : tail.cost + BREAK_COST[line.kind] + (1 - line.units / limit) ** 2) };
      if (!pick || compareLayouts(choice, pick) < 0) pick = choice;
    }
    best[start] = pick;
  }
  return best;
}

/**
 * 2行ずつのページごとの最良の折り方（3行以上になる長い台詞だけに使う）。ページ数を最少にした上で、
 * ページの切れ目を文末に合わせ、ページの中の2行は pairCost で折る。最後のページに短い1行だけが残る形は避ける。
 */
function bestPages(tokens, candidates, limit) {
  const n = tokens.length, best = new Array(n + 1);
  best[n] = EMPTY_LAYOUT;
  for (let start = n - 1; start >= 0; start--) {
    let pick = null;
    const consider = (first, second) => {
      const last = second || first, tail = best[last.next];
      if (!tail) return;
      const units = first.units + (second?.units || 0);
      let cost = tail.cost + (second ? first.extra + pairCost(first.units, second.units, first.kind, limit) : 0);
      if (last.end < n) cost += last.extra + PAGE_BREAK_COST * BREAK_COST[last.kind] + (1 - units / (limit * 2)) ** 2;
      else if (start > 0 && !second) cost += LONE_PAGE_COST * Math.max(0, 1 - units / (limit * LONE_PAGE));
      const choice = { lines: second ? [first, second] : [first], end: last.end, next: last.next,
        kinsoku: tail.kinsoku + first.kinsoku + (second?.kinsoku || 0), words: tail.words + first.words + (second?.words || 0),
        chunks: tail.chunks + first.chunks + (second?.chunks || 0), penalty: tail.penalty + first.penalty + (second?.penalty || 0),
        count: 1 + tail.count, cost };
      if (!pick || compareLayouts(choice, pick) < 0) pick = choice;
    };
    for (const first of candidates[start]) {
      consider(first, null);
      if (first.end < n) for (const second of candidates[first.next] || []) consider(first, second);
    }
    best[start] = pick;
  }
  return best;
}

/**
 * 1つの段落を折り、ページ（行の配列）の並びで返す。pageLines が 2 で3行以上になる時だけページ単位で折り直し、
 * それ以外は1ページにすべての行を入れて返す（ページ分けは呼び出し側）。
 */
function layoutSegment(segment, limit, layout, pageLines = 0) {
  const tokens = tokensOf(segment), n = tokens.length;
  if (!n) return [];
  const text = (from, to) => tokens.slice(from, to).map(t => t.value).join("");
  const candidates = lineCandidates(tokens, boundaryInfo(tokens, limit, layout), limit, layout);
  const follow = (best) => {
    const pages = [];
    for (let start = 0; start < n;) {
      const step = best[start];
      if (!step) { pages.push([text(start, n)]); break; } // タグのみの末尾
      let from = start;
      pages.push(step.lines.map(line => { const row = text(from, line.end); from = line.next; return row; }));
      start = step.next;
    }
    return pages;
  };
  const lines = follow(bestLines(tokens, candidates, limit)).flat();
  return pageLines === 2 && lines.length > 2 ? follow(bestPages(tokens, candidates, limit)) : [lines];
}
const naturalWrap = (segment, limit, layout, pageLines) => layoutSegment(segment, limit, layout, pageLines).flat();

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
    const rows = naturalWrap(segment, limit, layout, layout.maxLines);
    let at = 0;
    rows.forEach((line, row) => {
      at += tokensOf(line).length;
      if (!info.fits(stripTags(line))) diagnostics.push({ paragraph, row, reason: "width-overflow", line });
      if (at < tokens.length) {
        const part = info.protectedAt.get(nextVisible(tokens, at));
        const penalty = boundaryPenalty(tokens, at, info);
        const safe = safeBoundary(tokens, at);
        if (part || penalty > 0) diagnostics.push({ paragraph, row,
          reason: !safe ? "kinsoku" : part?.insideWord ? "inside-word" : part?.reason || "weak-boundary",
          line, next: rows[row + 1], forced: !!part || !safe, protectionRelaxed: !!part?.fits });
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
      if (!token.tag || token.tag === "pause") continue;
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
  const maxLines = layout.maxLines ?? MAX_PAGE_LINES;
  // 手動改行の無い台詞（データの台詞はすべて）は、ページの切れ目まで含めて折る。
  const paged = String(raw).includes("\n") ? null : layoutSegment(String(raw), WRAP_LIMIT, layout, maxLines);
  if (paged?.length > 1) return balancePages(paged.map(rows => rows.join("\n")));
  const lines = paged ? paged[0] || [""] : autoWrap(raw, WRAP_LIMIT, layout).split("\n");
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
const TAGS = ["imp", "warn", "hint", "red", "blue", "sub", "shiver"];
// 震え文字は行ごとの箱で揺らす（inline-block）。改行をまたぐ区間は行の境目で閉じて開き直す。
const shiverRows = (s) => s.replace(/\[shiver\]([\s\S]*?)(\[\/shiver\]|$)/g,
  (_, body, close) => `[shiver]${body.replaceAll("\n", "[/shiver]\n[shiver]")}${close}`);

/** [imp]…[/imp] 等を span に。改行は <br>。[pause] は文字送りの側で扱い、表示には出さない */
export function formatHtml(raw) {
  let t = escapeHtml(shiverRows(String(raw)).replaceAll("[pause]", ""));
  for (const tag of TAGS) t = t.replaceAll(`[${tag}]`, `<span class="tx-${tag}">`).replaceAll(`[/${tag}]`, "</span>");
  return t.replace(/\n/g, "<br>");
}

/** [pause] の位置（formatHtml 後の見える文字数）。文字送りがここで一拍止まる（#2828） */
export function pausePoints(raw) {
  const parts = String(raw).split("[pause]");
  const points = [];
  let at = 0;
  for (const part of parts.slice(0, -1)) points.push(at += visibleLength(formatHtml(part)));
  return points;
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
