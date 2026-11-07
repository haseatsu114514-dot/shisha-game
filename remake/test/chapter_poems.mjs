// 巻頭ポエム（序詩＋第1〜5章）の台本と接続点の検査。ブラウザ不要。
//  1) data/dialogue/chapter_poems.json の形・組版（1ページ1視覚行）・使ってはいけない記法と語
//  2) brand/chant_poems.md の詩と台本が（空白を除いて）一致している＝文書と本編がずれない
//  3) 各章の章タイトルの直後に詩が置かれ、データローダに登録されている
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { autoWrap, paginate } from "../js/vn/text.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const squash = (text) => text.replace(/\s+/g, "");

const EXPECTED = [
  ["poem_prologue", "### 序詩「煙前口上」"],
  ["poem_ch1", "### 第1章「煙がつなぐ街」"],
  ["poem_ch2", "### 第2章「才能の壁」"],
  ["poem_ch3", "### 第3章「嘘つきたちの夜」"],
  ["poem_ch4", "### 第4章「継承の煙」"],
  ["poem_ch5", "### 第5章「機械仕掛けの神」"],
];

// 1) 台本の形と組版 --------------------------------------------------------
const data = JSON.parse(read("data/dialogue/chapter_poems.json"));
assert.deepEqual(data.dialogues.map((d) => d.dialogue_id), EXPECTED.map(([id]) => id), "台詞IDと順序");

// 原作の固有語・詠唱の語句を混ぜない（brand/chant_poems.md §3）。本文は自作であること。
const FROM_ORIGINAL = ["万象", "灰燼", "君臨者", "卍解", "斬魄", "鬼道", "破道", "縛道", "解号"];
// 第5章専用の一文（結論の独白）と、第5章まで作中で説明しない「-EN:CODE-」の語は詩に入れない。
const RESERVED = ["混ざったままで", "EN:CODE", "ENCODE"];

for (const dialogue of data.dialogues) {
  assert.ok(dialogue.lines.length >= 6 && dialogue.lines.length <= 14, `${dialogue.dialogue_id}: ページ数 ${dialogue.lines.length}`);
  for (const [index, line] of dialogue.lines.entries()) {
    const where = `${dialogue.dialogue_id}[${index}]`;
    assert.equal(line.speaker, "", `${where}: 地の文（話者なし）`);
    assert.ok(line.text.trim() && line.text === line.text.trim(), `${where}: 空・前後の空白`);
    assert.ok(!line.text.includes("\n"), `${where}: 手動改行を入れない`);
    assert.ok(!/[《》｜]/.test(line.text), `${where}: ふりがな記法は台詞では描画されない`);
    assert.ok(!/[。]$/.test(line.text), `${where}: 詩は句点で終えない`);
    assert.equal(paginate(line.text).length, 1, `${where}: 1ページに収める`);
    assert.ok(!autoWrap(line.text).includes("\n"), `${where}: 1行に収める（折れると語の途中で割れる）: ${line.text}`);
    for (const word of [...FROM_ORIGINAL, ...RESERVED]) assert.ok(!line.text.includes(word), `${where}: 使わない語「${word}」`);
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
}
// 技型（煙道・起動句）は削除済み。巻頭ポエムに一本化（ミューズ判断 2026-11-08）
for (const word of ["## 5. 煙道", "## 6. 起動句"]) assert.ok(!doc.includes(word), `文書に技型が残っている: ${word}`);
const narrationAt = doc.indexOf("## 5. 一行ナレーション集");
assert.ok(narrationAt > 0, "一行ナレーション10本は残す");
const narration = doc.slice(narrationAt, doc.indexOf("\n## ", narrationAt + 1));
assert.equal((narration.match(/^\d+\. /gm) || []).length, 10, "一行ナレーションは10本");

// 3) 接続点 ----------------------------------------------------------------
assert.match(read("remake/js/core/data.js"), /DIALOGUE_FILES = \[[\s\S]*"chapter_poems"[\s\S]*?\];/, "データローダに chapter_poems がない");

const ids = fs.readFileSync(path.join(root, "remake/js/scenes/chapter-poem.js"), "utf8");
for (const [id] of EXPECTED) assert.ok(ids.includes(`"${id}"`), `chapter-poem.js に ${id} がない`);

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
  // 詩は、その直前にある章タイトルより後で、次の titleSeen / 進行保存より前に置く（再開時に繰り返さない）
  for (const [i, title] of titles.entries()) {
    assert.ok(poems[i] > title, `${file}: 詩は章タイトルの後（${i + 1}つ目）`);
    const seen = source.indexOf("titleSeen = true", title);
    assert.ok(seen < 0 || poems[i] < seen, `${file}: 詩は titleSeen を立てる前（${i + 1}つ目）`);
  }
}
// 序詩は第1章のコールドオープンの前、章タイトルの前
const ch1 = read("remake/js/chapters/ch1.js");
const prologue = ch1.indexOf('playChapterPoem("prologue")');
assert.ok(prologue > 0 && prologue < ch1.indexOf("mountColdOpen()") && prologue < ch1.indexOf("playCh1Title()"), "序詩はコールドオープンの前");

console.log("chapter_poems OK: 6本 / %d ページ", data.dialogues.reduce((n, d) => n + d.lines.length, 0));
