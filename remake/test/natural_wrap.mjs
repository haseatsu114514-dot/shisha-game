import assert from "node:assert/strict";
import { autoWrap, paginate, stripTags, textWidth, wrapDiagnostics } from "../js/vn/text.js";
import { paginateInner } from "../js/vn/inner.js";
const target = "それと、すみません。研修中の身なので、念のため年齢確認をさせてください";
const expected = "それと、すみません。研修中の身なので、\n念のため年齢確認をさせてください";
assert.equal(textWidth(target), 35);
assert.equal(autoWrap(target), expected);
assert.equal(autoWrap(target, 24, { maxWidth: 24, measure: textWidth }), expected);
assert.deepEqual(wrapDiagnostics(target), []);
for (const text of ["今日は準備をします。お客様のため丁寧に道具を選びます", "静かな店内で、私の大切な時間をゆっくり過ごします"]) {
  const rows = autoWrap(text, 12).split("\n");
  assert(rows.some(row => row.includes(text.includes("お客様") ? "お客様のため" : "私の大切")), rows.join("｜"));
}
// P2: fit-sized words/chunks must yield to kinsoku when punctuation needs room.
for (const [text, limit] of [
  ["こんにちは。今日は晴れです。", 5],
  ["私の友達の仕事の仲間の家族の会社の車の鍵の持ち主。次です", 24],
]) {
  const layouts = [[limit, {}], [limit, {maxWidth:limit, measure:textWidth}]];
  if (limit < 24) layouts.push([24, {maxWidth:limit, measure:textWidth}]);
  for (const [unitLimit, layout] of layouts) {
    const rows = autoWrap(text, unitLimit, layout).split("\n");
    assert.equal(rows.join(""), text);
    assert(rows.every(row => textWidth(row) <= limit));
    assert(!rows.slice(1).some(row => /^[、。！？』）]/u.test(row)), rows.join("｜"));
    const diagnostics = wrapDiagnostics(text, unitLimit, layout);
    assert(!diagnostics.some(d => d.reason === "kinsoku"));
    assert(diagnostics.some(d => d.protectionRelaxed && d.forced), JSON.stringify(diagnostics));
  }
}
// At one unit there is genuinely no safe boundary for a following fullwidth stop.
assert.equal(autoWrap("あ。", 1), "あ\n。");
assert(wrapDiagnostics("あ。", 1).some(d => d.reason === "kinsoku" && d.forced));
for (const text of ["ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", "あいうえおかきくけこさしすせそ", "👩‍🍳が👩‍🍳が"] ) {
  for (const limit of [0.5, 1, 3, 8]) {
    const rows = autoWrap(text, limit).split("\n");
    assert.equal(rows.join(""), text);
    assert(rows.length <= [...text].length);
    for (const row of rows) assert(textWidth(row) <= limit || [...new Intl.Segmenter("ja", {granularity:"grapheme"}).segment(row)].length === 1);
  }
}
assert(wrapDiagnostics("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 3).some(d => d.reason === "inside-word"));
assert(wrapDiagnostics("あ", 24, {maxWidth:1, measure:()=>10}).some(d => d.reason === "width-overflow"));
const tagged = "[imp]" + target + "[/imp]";
const pages = paginate(tagged, {maxLines:1});
assert(pages.every(p => p.startsWith("[imp]") && p.endsWith("[/imp]") && !p.includes("\n")));
assert.equal(pages.map(stripTags).join(""), target);
assert.equal(autoWrap("シー\nシャを作る\n\n終わり"), "シー\nシャを作る\n\n終わり");
for (const text of ["長い言葉を並べてから『原点』を大切にする話です", "見えない所で──ずっと前から積み上げたもの"]) {
  const rows = autoWrap(text, 12).split("\n");
  assert(!rows.some(row => /^[、。』）─]/u.test(stripTags(row))));
  assert(!rows.some(row => /[『（]$/u.test(stripTags(row))));
}
const thoughts = paginateInner("（" + target + "）");
assert(thoughts.every(p => p.startsWith("（") && p.endsWith("）") && p.split("\n").length <= 2));
assert.equal(thoughts.map(p => stripTags(p).slice(1,-1).replaceAll("\n", "")).join(""), target);
assert.throws(() => autoWrap("あ", 0), RangeError);
// A long paragraph must not enumerate combinations or recurse once per line.
const long = target.repeat(32);
let measurements = 0;
const longRows = autoWrap(long, 24, {maxWidth:24, measure(value) { measurements++; return textWidth(value); }}).split("\n");
assert.equal(longRows.join(""), long);
assert(longRows.every(row => textWidth(row) <= 24));
assert(measurements < textWidth(long) * 100, `Unbounded measurement calls: ${measurements}`);
console.log(`natural_wrap OK: long paragraph ${measurements} measurements`);
