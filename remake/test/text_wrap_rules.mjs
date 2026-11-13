// 台詞の改行の規範（.claude/skills/text-style/SKILL.md「改行・改ページのルール」）を、本編の組版の結果で判定する。
// 本編と同じ paginate（remake/js/vn/text.js）を受け取り、ここでは折り返さない。
// 使う所: remake/test/text_wrap.mjs（CI。全台詞で error を 0 に保つ）と .claude/skills/text-style/check_wrap.mjs（書いた台詞の確認）。
//
// error（CI で止める。2026-11-11 オーナー「二行目だけ短いとか、変な位置の改行」TXW08）
//   short-second : 2行のページの2行目だけが全角5字以下（「長い文。／短い2文目」は規範どおりなので除く）
//   mid-sentence : 2ページ以上に分かれ、ページの切れ目が文の途中（一文を2つの吹き出しにまたがせない）
// warn（知らせるだけ）
//   manual-break : 手で改行している（演出で折る時だけ許す）
//   two-pages    : 2ページ以上に分かれる（全角48字以内が目安。文末で切れていれば読めるので止めない）
//   short-first  : 1行目だけが極端に短い（読点や文節で折った時）

const strip = (s) => s.replace(/\[\/?[a-z]+\]/g, "");
export const textWidth = (s) => [...strip(s)].reduce((n, ch) => n + (ch.codePointAt(0) <= 0xff ? 0.5 : 1), 0);
// ページの終わりとして自然な文字（文末・閉じ括弧・余韻）
const PAGE_END = /[。！？!?…‥」』）♡♪〜ー][\s　]*$/;
const SENTENCE_END = /[。！？!?♡♪][\s　]*$/;
const PHRASE_END = /[。！？!?…‥」』）♡♪][\s　]*$/;

/** text の改行の問題を返す。paginate は本編の vn/text.js のもの。 */
export function wrapProblems(text, paginate) {
  const problems = [], pages = paginate(text);
  const add = (level, code, message) => problems.push({ level, code, message });
  if (text.includes("\n")) add("warn", "manual-break", "手で改行している（改行はゲームに任せる。演出で折る時だけ、1行を全角24字以内に）");
  if (pages.length > 1) {
    add("warn", "two-pages", `${pages.length}ページに分かれる（全角48字以内に縮めるか、台詞を2つに分ける）`);
    pages.slice(0, -1).forEach((page, i) => {
      if (!PAGE_END.test(strip(page))) add("error", "mid-sentence", `${i + 1}ページ目が文の途中で切れる（文を2つに分けて「。」を入れるか、短くする）`);
    });
  }
  for (const page of pages) {
    const rows = page.split("\n").map(strip);
    if (rows.length !== 2) continue;
    const [a, b] = rows.map(textWidth);
    if (b <= 5 && !SENTENCE_END.test(rows[0])) add("error", "short-second", `2行目だけ短い（「${rows[1]}」。言い換えるか、読点の位置を変える）`);
    if (a <= 4 && b >= 16 && !PHRASE_END.test(rows[0])) add("warn", "short-first", `1行目だけ短い（「${rows[0]}」）`);
  }
  return { pages, problems };
}

/** 台詞 JSON から text を持つ行を集める（dialogue_id は親から引き継ぐ）。 */
export function dialogueTexts(json, file) {
  const out = [];
  (function walk(node, id) {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, id));
    if (!node || typeof node !== "object") return;
    const did = node.dialogue_id || id;
    if (typeof node.text === "string" && node.text.trim()) out.push({ file, id: did || "", speaker: node.speaker || "", text: node.text });
    for (const [k, v] of Object.entries(node)) if (k !== "text" && v && typeof v === "object") walk(v, did);
  })(json, "");
  return out;
}
