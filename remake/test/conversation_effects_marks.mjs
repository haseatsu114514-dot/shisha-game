// 会話演出（#2828）の印: [pause]／[shiver] の組版と、台本に付けた印の書式を確かめる。ブラウザ不要。
// 文字送り・音・揺れの実際の挙動は remake/test/browser/conversation_effects_2828.mjs が見る。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paginate, formatHtml, pausePoints, stripTags, textWidth, visibleLength } from "../js/vn/text.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// 1) 印は幅0。autoWrap の折り位置と字数目安を変えない
const plain = "店の煙だ。大会の煙ではない。そう書いてあった。細いペンの字で、もう一行だけ。";
const marked = "店の煙だ。[pause]大会の煙ではない。[shiver]そう書いてあった。[/shiver]細いペンの字で、もう一行だけ。";
assert.equal(textWidth(marked), textWidth(plain));
assert.deepEqual(paginate(marked).map(stripTags), paginate(plain));
assert.equal(stripTags("a[pause]b[shiver]c[/shiver]"), "abc", "ログには印を残さない");

// 2) [pause] は表示に出ず、止まる位置は見える文字数で数える
assert.equal(formatHtml("レモンは[pause]2グラム、です。"), "レモンは2グラム、です。");
assert.deepEqual(pausePoints("レモンは[pause]2グラム、[pause]です。"), [4, 9]);
assert.deepEqual(pausePoints("[imp]A&B[/imp]は[pause]C"), [4], "装飾タグは数えず、& は1字");
assert.deepEqual(pausePoints("止まらない。"), []);

// 3) 改ページ: [pause] は次のページで開き直さない。[shiver] は開き直して各ページで閉じる
const long = "[shiver]さ、さむい……路地の風、冷たいね。手がかじかんで、うまく炭がつかめない。[/shiver]でも、[pause]もう少しだけ。";
const pages = paginate(long);
assert.ok(pages.length >= 2, "改ページが起きる長さ");
for (const page of pages) {
  assert.equal((page.match(/\[shiver\]/g) || []).length, (page.match(/\[\/shiver\]/g) || []).length, `各ページで閉じる: ${page}`);
}
assert.equal(pages.join("").split("[pause]").length - 1, 1, "[pause] は増えない");

// 4) 震え文字は行ごとの箱（inline-block）で揺らすので、改行をまたぐ区間は行の境目で閉じて開き直す
assert.equal(formatHtml("[shiver]さ、さむい[/shiver]\n路地"), '<span class="tx-shiver">さ、さむい</span><br>路地');
assert.equal(formatHtml("[shiver]さむい\nこわい[/shiver]"),
  '<span class="tx-shiver">さむい</span><br><span class="tx-shiver">こわい</span>');
assert.equal(visibleLength(formatHtml("[shiver]さむい\nこわい[/shiver]")), 6);

// 5) 台本の印の書式（付けた数は決めない。付け方の誤りだけを止める）
const marks = { beat: 0, duck: 0, pause: 0, shiver: 0 };
for (const file of fs.readdirSync(path.join(root, "data/dialogue")).filter((f) => f.endsWith(".json"))) {
  const visit = (node, at) => {
    if (Array.isArray(node)) return node.forEach((child, i) => visit(child, `${at}/${i}`));
    if (!node || typeof node !== "object") return;
    const where = `${file}${at}`;
    if ("beat" in node) {
      marks.beat++;
      assert.ok(node.beat === true || (Number.isInteger(node.beat) && node.beat >= 300 && node.beat <= 800), `${where}: beat は true か 300〜800（ms）`);
      assert.ok(typeof node.text === "string" && !node.type, `${where}: beat は台詞行に付ける`);
    }
    if ("duck" in node) {
      marks.duck++;
      assert.equal(node.duck, true, `${where}: duck は true`);
      assert.ok(typeof node.text === "string" && !node.type, `${where}: duck は台詞行に付ける`);
    }
    if (typeof node.text === "string" && !node.type) {
      const text = node.text;
      const pauses = text.split("[pause]").length - 1;
      marks.pause += pauses;
      if (pauses) assert.ok(!/^(\[[a-z/]+\])*\[pause\]|\[pause\](\[[a-z/]+\])*$/.test(text), `${where}: [pause] は文の途中に置く`);
      const opens = (text.match(/\[shiver\]/g) || []).length;
      marks.shiver += opens;
      assert.equal(opens, (text.match(/\[\/shiver\]/g) || []).length, `${where}: [shiver] を閉じる`);
      assert.ok(!/\[shiver\][^[]*\[shiver\]/.test(text), `${where}: [shiver] を入れ子にしない`);
    }
    for (const [key, child] of Object.entries(node)) if (child && typeof child === "object") visit(child, `${at}/${key}`);
  };
  visit(JSON.parse(fs.readFileSync(path.join(root, "data/dialogue", file), "utf8")), "");
}
console.log(`conversation_effects_marks OK: beat ${marks.beat} / duck ${marks.duck} / pause ${marks.pause} / shiver ${marks.shiver}`);
