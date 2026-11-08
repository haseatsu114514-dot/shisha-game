// 巻頭ポエム（序詩＋第1〜5章）の台本と接続点の検査。ブラウザ不要。
//  1) data/dialogue/chapter_poems.json の形（1行 = 詩の1行・連の切れ目 gap）・短さ（本家の巻頭詩の中央値に合わせる）・縦書きの1列に収まる長さ・ふりがな記法・使ってはいけない語
//  2) brand/chant_poems.md の詩と台本が（空白を除いて）一致している＝文書と本編がずれない
//  3) 各章の章タイトルの直前に詩が置かれ、データローダ・スタイルシートに登録されている
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const squash = (text) => text.replace(/\s+/g, "");
const RUBY = /([\p{Script=Han}々]+)《([^》]+)》/gu;
const plain = (text) => text.replace(RUBY, "$1");

const EXPECTED = [
  ["poem_ch1", "### 序詩・第1章「煙がつなぐ街」"],
  ["poem_ch2", "### 第2章「才能の壁」"],
  ["poem_ch3", "### 第3章「嘘つきたちの夜」"],
  ["poem_ch4", "### 第4章「継承の煙」"],
  ["poem_ch5", "### 第5章「機械仕掛けの神」"],
];
// 縦書きの1列（高さ720pxの画面の78%・30px・字間.16em）に入る字数。空白（拍）は半角で0.5字。
const MAX_COLUMN = 16;
// 長さ: 本家の巻頭詩は1行の言い切りから約200字の独白まで幅がある（中央値は空白を除いて約40〜50字。brand/chant_poems.md §2）。
// 章ごとに長短を散らすが、読ませる画面で間延びしないよう上限を置く。
const MAX_CHARS = 110;
const LINES = [3, 12];
const MAX_LINES_PER_PAGE = 7; // 縦書きの1場面に並べる列の数
// 場面（連）の数。第4章だけ短い1場面（brand/chant_poems.md §4）。
const PAGES = { poem_ch1: 2, poem_ch2: 2, poem_ch3: 2, poem_ch4: 1, poem_ch5: 2 };

// 1) 台本の形 --------------------------------------------------------------
const data = JSON.parse(read("data/dialogue/chapter_poems.json"));
assert.deepEqual(data.dialogues.map((d) => d.dialogue_id), EXPECTED.map(([id]) => id), "台詞IDと順序");

// 原作の固有語・詠唱の語句を混ぜない（brand/chant_poems.md §3）。本文は自作であること。
const FROM_ORIGINAL = ["万象", "灰燼", "君臨者", "卍解", "斬魄", "鬼道", "破道", "縛道", "解号"];
// 第5章専用の一文（結論の独白）と、第5章まで作中で説明しない「-EN:CODE-」の語は詩に入れない。
const RESERVED = ["混ざったままで", "EN:CODE", "ENCODE"];

for (const dialogue of data.dialogues) {
  const id = dialogue.dialogue_id;
  assert.ok(dialogue.lines.length >= LINES[0] && dialogue.lines.length <= LINES[1], `${id}: 行数 ${dialogue.lines.length}（${LINES[0]}〜${LINES[1]}行。長くしない）`);
  const chars = dialogue.lines.reduce((n, line) => n + [...plain(line.text).replaceAll(" ", "")].length, 0);
  assert.ok(chars <= MAX_CHARS, `${id}: ${chars}字は長い（空白を除いて${MAX_CHARS}字以内）`);
  assert.equal(dialogue.lines[0].gap, undefined, `${id}: 最初の行に gap は付けない`);
  const pageCount = dialogue.lines.filter((line) => line.gap === true).length + 1;
  assert.equal(pageCount, PAGES[id], `${id}: 場面（連）は${PAGES[id]}つ（${pageCount}）`);
  let run = 0;
  for (const line of dialogue.lines) {
    run = line.gap ? 1 : run + 1;
    assert.ok(run <= MAX_LINES_PER_PAGE, `${id}: 1場面に${run}列は多い（${MAX_LINES_PER_PAGE}列まで）`);
  }
  for (const [index, line] of dialogue.lines.entries()) {
    const where = `${id}[${index}]`;
    assert.equal(line.speaker, "", `${where}: 地の文（話者なし）`);
    assert.ok(line.text.trim() && line.text === line.text.trim(), `${where}: 空・前後の空白`);
    assert.ok(!line.text.includes("\n"), `${where}: 行の中に改行を入れない（1行 = 1要素）`);
    assert.ok(!/。$/.test(line.text), `${where}: 詩は句点で終えない`);
    assert.ok(line.gap === undefined || line.gap === true, `${where}: gap は true だけ`);
    // ふりがな記法は「漢字《よみ》」だけ。壊れた《》を残さない。
    assert.equal((line.text.match(/《/g) || []).length, [...line.text.matchAll(RUBY)].length, `${where}: ふりがな記法が壊れている`);
    assert.ok(!/[｜》]/.test(plain(line.text)) && !/《/.test(plain(line.text)), `${where}: 記法の取り残し`);
    const width = [...plain(line.text)].reduce((n, ch) => n + (ch === " " ? 0.5 : 1), 0);
    assert.ok(width <= MAX_COLUMN, `${where}: 縦書きの1列に収まらない（${width}字）: ${line.text}`);
    for (const word of [...FROM_ORIGINAL, ...RESERVED]) assert.ok(!line.text.includes(word), `${where}: 使わない語「${word}」`);
  }
}

// 1b) 詩の上のコマ絵（横長16:3）。絵のファイルがあり、読み上げ用の説明がある。
for (const dialogue of data.dialogues) {
  const { panel, panel_alt: alt } = dialogue.metadata || {};
  assert.ok(panel && /^[\w-]+\.(svg|webp)$/.test(panel), `${dialogue.dialogue_id}: metadata.panel（ファイル名）がない`);
  assert.ok(alt && alt.length >= 6, `${dialogue.dialogue_id}: metadata.panel_alt（絵の説明）がない`);
  const file = path.join(root, "remake/img/ui/poems", panel);
  assert.ok(fs.existsSync(file), `${dialogue.dialogue_id}: 絵のファイルがない: ${panel}`);
  if (panel.endsWith(".svg")) {
    const svg = fs.readFileSync(file, "utf8");
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    assert.ok(box, `${panel}: viewBox がない`);
    assert.ok(Math.abs(box[1] / box[2] - 16 / 3) < 0.01, `${panel}: 横長16:3ではない（${box[1]}x${box[2]}）`);
    assert.ok(!/<text[\s>]/.test(svg), `${panel}: 絵に文字を焼き込まない`);
  }
}

// 2) 文書（brand/chant_poems.md）との一致 ----------------------------------
const doc = read("brand/chant_poems.md");
for (const [id, heading] of EXPECTED) {
  const at = doc.indexOf(heading);
  assert.ok(at >= 0, `文書に見出しがない: ${heading}`);
  const block = /```\n([\s\S]*?)\n```/.exec(doc.slice(at));
  assert.ok(block, `文書に詩のブロックがない: ${heading}`);
  const dialogue = data.dialogues.find((d) => d.dialogue_id === id);
  assert.equal(squash(dialogue.lines.map((l) => l.text).join("")), squash(block[1]), `${id}: 台本と文書の詩がずれている`);
  // 連の切れ目も文書の空行と一致
  const gaps = block[1].split("\n\n").length - 1;
  assert.equal(dialogue.lines.filter((l) => l.gap).length, gaps, `${id}: 連の切れ目が文書の空行とずれている`);
}
// 技型（煙道・起動句）は削除済み。巻頭ポエムに一本化（ミューズ判断 2026-11-08）
for (const word of ["## 5. 煙道", "## 6. 起動句"]) assert.ok(!doc.includes(word), `文書に技型が残っている: ${word}`);
const narrationAt = doc.indexOf("## 5. 一行ナレーション集");
assert.ok(narrationAt > 0, "一行ナレーション10本は残す");
const narration = doc.slice(narrationAt, doc.indexOf("\n## ", narrationAt + 1));
assert.equal((narration.match(/^\d+\. /gm) || []).length, 10, "一行ナレーションは10本");

// 3) 接続点 ----------------------------------------------------------------
assert.match(read("remake/js/core/data.js"), /DIALOGUE_FILES = \[[\s\S]*"chapter_poems"[\s\S]*?\];/, "データローダに chapter_poems がない");
assert.match(read("remake/index.html"), /<link rel="stylesheet" href="css\/motions\/chapter-poem\.css">/, "index.html にスタイルシートがない");
assert.ok(fs.existsSync(path.join(root, "remake/css/motions/chapter-poem.css")), "スタイルシートがない");
const module = read("remake/js/scenes/chapter-poem.js");
for (const [id] of EXPECTED) assert.ok(module.includes(`"${id}"`), `chapter-poem.js に ${id} がない`);
assert.match(module, /vnTest\.turbo/, "テストの自動送り（vnTest.turbo）に従う");
assert.match(module, /reducedMotion\(\)/, "動き軽減に従う");
assert.match(module, /export function poemPages/, "連ごとに場面を分ける");
assert.match(module, /panelUrl/, "コマ絵の読み込みがある");
assert.match(read("remake/css/motions/chapter-poem.css"), /\.cp-panel/, "コマ絵のスタイルがある");
assert.match(read("remake/css/motions/chapter-poem.css"), /\.cp-page\.now/, "場面の切り替えのスタイルがある");

function indexesOf(source, needle) {
  const found = [];
  for (let at = source.indexOf(needle); at >= 0; at = source.indexOf(needle, at + 1)) found.push(at);
  return found;
}
// [ファイル, 章タイトル呼び出し, 詩の呼び出し, 期待する個数]
const WIRING = [
  ["remake/js/chapters/ch1.js", "playCh1Title()", 'playChapterPoem(1)', 1],
  ["remake/js/chapters/ch2.js", "chapterTitle(chapterTitleEntry(2))", "playChapterPoem(2, { owner, current })", 1],
  ["remake/js/chapters/ch3.js", "chapterTitle(chapterTitleEntry(3))", "playChapterPoem(3, { owner, current })", 3],
  ["remake/js/chapters/ch4.js", "chapterTitle(CHAPTER_TITLE_ART.find(entry => entry.chapter === 4))", "playChapterPoem(4, { owner, current })", 1],
  ["remake/js/chapters/ch5.js", "chapterTitle(CHAPTER_TITLE_ART.find(entry => entry.chapter === 5))", "playChapterPoem(5, { owner, current })", 1],
];
for (const [file, titleCall, poemCall, count] of WIRING) {
  const source = read(file);
  assert.match(source, /import \{ playChapterPoem \} from "\.\.\/scenes\/chapter-poem\.js";/, `${file}: import がない`);
  const titles = indexesOf(source, titleCall);
  const poems = indexesOf(source, poemCall);
  assert.equal(titles.length, count, `${file}: 章タイトルの呼び出し数`);
  assert.equal(poems.length, count, `${file}: 詩の呼び出し数`);
  // 詩は、対応する章タイトルの直前（前の章タイトルより後）に置き、titleSeen を立てる前に読み終える（再開時に繰り返さない）
  for (const [i, title] of titles.entries()) {
    assert.ok(poems[i] < title, `${file}: 詩は章タイトルの前（${i + 1}つ目）`);
    assert.ok(i === 0 || poems[i] > titles[i - 1], `${file}: 詩は前の章タイトルより後（${i + 1}つ目）`);
    const seen = source.indexOf("titleSeen = true", title);
    assert.ok(seen < 0 || poems[i] < seen, `${file}: 詩は titleSeen を立てる前（${i + 1}つ目）`);
  }
}
// 第1章: コールドオープン → 第1章の詩（序詩を兼ねる・オーナー確認「統合で合ってる」）→ 章タイトル。序詩は独立させない。
const ch1 = read("remake/js/chapters/ch1.js");
assert.ok(!ch1.includes('playChapterPoem("prologue")'), "序詩は第1章の詩に統合した");
assert.ok(!module.includes("poem_prologue") && !data.dialogues.some((d) => d.dialogue_id === "poem_prologue"), "poem_prologue は無い");
const order = ["mountColdOpen()", "playChapterPoem(1)", "playCh1Title()"].map((needle) => ch1.indexOf(needle));
assert.ok(order.every((at) => at > 0) && order.every((at, i) => i === 0 || at > order[i - 1]), `第1章の順序が違う: ${order}`);

console.log("chapter_poems OK: %d本 / %d 行", data.dialogues.length, data.dialogues.reduce((n, d) => n + d.lines.length, 0));
