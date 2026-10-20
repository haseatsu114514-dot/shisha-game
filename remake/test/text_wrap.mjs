// 台詞の組版（vn/text.js）を、実際の台詞データと代表例で確かめる。ブラウザ不要。
// 語の途中で折らず手前の区切りで早めに折ること、禁則・2行改ページ・第1章の文の途中の改ページを見る。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { autoWrap, paginate, WRAP_LIMIT, MAX_PAGE_LINES, textWidth } from "../js/vn/text.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const strip = (s) => s.replace(/\[\/?[a-z]+\]/g, "");
const width = (s) => [...strip(s)].reduce((n, ch) => n + (ch.codePointAt(0) <= 0xff ? 0.5 : 1), 0);
const lines = (text) => autoWrap(text).split("\n");

// エディタの字数目安も本編のトークン計算を使う（装飾・改行・結合文字）。
assert.equal(textWidth("[imp]👩‍🍳が[/imp]\nAB"), 3);

// 1) 以前は語の途中で折れていた第1章の台詞。守る語が2行に分かれない
const keepWhole = [
  ["蒸らしの間、店内には炭が静かに弾ける音だけが鳴っている。", ["鳴っている"]],
  ["ふわっと、今まで嗅いだことのない複雑な香りが広がった。", ["広がった"]],
  ["あ、でもパッキーは祈りが通じたの見たことないんですよね〜♪ ぷぷぷっ！", ["ぷぷぷっ", "ないんですよね"]],
  ["各テーブル、まずは出だしの煙の立ち上がりを審査員がチェックしていくぞ！", ["審査員が"]],
  ["なんか、ああいうの聞くと頑張れますよね、……えへへ", ["えへへ"]],
  ["（お客さんの方から好みを言ってくれた、……ありがたい）", ["ありがたい"]],
  ["今まで見たことのない、小さくて、でも確かな笑顔だった。", ["笑顔"]],
  ["アニスとリコリスのブレンドすら完全にコントロールできない者が、他の味を語るなど……笑止千万", ["笑止千万", "コントロール"]],
  ["外は雨。こういう日は客足がまばらな代わりに、一人ひとりが長い。追加注文が続いた。", ["一人ひとり"]],
  ["パッキーね、最初からうすうす気付いてたんですよ〜？", ["ですよ"]],
];
for (const [text, words] of keepWhole) {
  const joined = lines(text).join("｜");
  for (const word of words) assert.ok(joined.includes(word), `「${word}」が折れた: ${joined}`);
}

// 2) 「♡ 」の後ろで折ったら行頭の空白は出さない。閉じ括弧＋助詞・「──」の間では折らない
for (const text of [
  "えへへ、せっかくお店に来てくれたんだもん♡ みんなに楽しい気持ちで帰ってほしいの",
  "みんと特製のオススメ作っちゃうね♡ ゆっくり味わっていってねー♡ ……あ、お水も出すから、",
]) {
  for (const line of lines(text).slice(1)) assert.ok(!/^[ 　]/.test(line), `行頭に空白: ${line}`);
}
assert.ok(!lines("アダムさんって、どうしてそこまで『原点』を極めることにこだわるんですか？").some((l) => l.startsWith("を")));
assert.ok(!lines("見えない所で──ずっと前から、積み上げてきたものがあったんだと思う").some((l) => l.startsWith("─")));

// 3) 改ページが増えないときは文末を優先し、増えるときは後ろの区切りで折って1ページに収める
assert.equal(lines("今日は早めに店を開ける。お前は炭の準備と、ホースの洗浄を頼む")[0], "今日は早めに店を開ける。");
const compact = "炭が爆ぜた。オレンジ色の照明の中で、白い煙がゆっくりほどけて、天井へ昇っていく。";
assert.equal(paginate(compact).length, 1, paginate(compact).join(" ‖ "));

// 4) 全台詞の不変条件: 1行は上限以内、行頭禁則・行頭の空白なし、1ページは2行まで
const NO_LINE_START = "、。，．！？…‥ー〜ぁぃぅぇぉっゃゅょんゎ々ァィゥェォッャュョ」』）】〉》・";
const files = fs.readdirSync(path.join(root, "data/dialogue")).filter((f) => f.endsWith(".json"));
const texts = [];
function walk(node, file, id) {
  if (Array.isArray(node)) return node.forEach((x) => walk(x, file, id));
  if (!node || typeof node !== "object") return;
  const did = node.dialogue_id || id;
  if (typeof node.text === "string" && node.text.trim()) texts.push({ file, id: did, text: node.text });
  for (const [k, v] of Object.entries(node)) if (k !== "text" && typeof v === "object") walk(v, file, did);
}
for (const f of files) walk(JSON.parse(fs.readFileSync(path.join(root, "data/dialogue", f), "utf8")), f, "");
const problems = [];
for (const { file, id, text } of texts) {
  for (const segment of text.split("\n")) {
    autoWrap(segment).split("\n").forEach((line, i) => {
      if (width(line) > WRAP_LIMIT && [...strip(line)].length > 1) problems.push(`${file}:${id} 幅超過 ${line}`);
      if (i > 0 && (NO_LINE_START.includes([...strip(line)][0]) || /^[ 　]/.test(strip(line)))) {
        problems.push(`${file}:${id} 行頭禁則 ${line}`);
      }
    });
  }
  for (const page of paginate(text)) {
    if (page.split("\n").length > MAX_PAGE_LINES) problems.push(`${file}:${id} 3行のページ ${page}`);
  }
}
assert.deepEqual(problems, [], problems.slice(0, 20).join("\n"));

// 本心と同じ固定枠に収める発言は1行ずつ送る。装飾・全文を失わない。
const singleLineText = "[imp]今日は、会社からの通知を切って、ゆっくり煙の香りだけを楽しみたい。[/imp]";
const singleLinePages = paginate(singleLineText, { maxLines: 1 });
assert(singleLinePages.length > 1);
assert(singleLinePages.every(page => !page.includes("\n")));
assert.equal(singleLinePages.map(strip).join(""), strip(singleLineText));
assert(singleLinePages.every(page => page.startsWith("[imp]") && page.endsWith("[/imp]")));

console.log(`text_wrap OK: ${texts.length} texts`);
