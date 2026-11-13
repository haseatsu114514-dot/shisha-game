// LIMEのアカウント名（data/characters.json の lime_name・台帳 LNM）。本人が付けた名前で、LIMEの画面にだけ出る。
// 2026-11-13 オーナー「リアルな世界にいたらラインにどんな名前にするか。脈絡ないのはダメ、誰かわからなくなるのもダメ」
// 「絵文字が多いのでワンパターンにならないように」「ひよりは顔文字で」「アダムは🍏🍎」「フルネームでやってるキャラも欲しい」
// 「サメちゃんは🦈の絵文字だけ」「あげははもっとギャル文字に」。名乗る前（表示名が「？？？」の間）は隠す。
// node remake/test/lime_names.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { DB, limeAccountName, displayName } from "../js/core/data.js";

const root = new URL("../../", import.meta.url);
const characters = JSON.parse(fs.readFileSync(new URL("data/characters.json", root), "utf8"));
DB.characters = Object.fromEntries(characters.filter(c => c?.id).map(c => [c.id, c]));
const names = Object.fromEntries(characters.filter(c => c?.lime_name).map(c => [c.id, c.lime_name]));
const EMOJI = /\p{Extended_Pictographic}/u;
const width = text => [...text].reduce((sum, ch) => sum + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);

// 誰か分かる名前で、枠に収まる長さ（トーク一覧・トーク画面の見出しは全角12字ぶん）
for (const [id, name] of Object.entries(names)) {
  assert.equal(name, name.trim(), `${id}: no stray spaces`);
  assert.ok(width(name) <= 12, `${id}: ${name} fits the header`);
}
// 絵文字は少数の人だけ（ワンパターンにしない）
assert.deepEqual(Object.keys(names).filter(id => EMOJI.test(names[id])).sort(), ["adam", "samechan"]);
assert.equal(names.samechan, "🦈", "Samechan is the shark emoji and nothing else");
assert.ok(names.adam.endsWith("🍏🍎"), "Adam: double apple, green and red");
assert.match(names.hiyori, /^ひより\(.+\)/, "Hiyori uses a kaomoji, not an emoji");
assert.ok(!names.hiyori.includes("白昼夢"), "The old self-styled name is retired");
assert.match(names.ageha, /[ぁ-ぉ]/, "Ageha writes in gyaru-moji (small kana)");
assert.match(names.ageha, /[｡-ﾟ]/, "…with half-width kana pieces");
// フルネームの人もいる（本名を隠していない人だけ）
for (const id of ["naru", "tsumugi", "mukai_master"]) {
  const real = String(DB.characters[id].name).replace(/（.*?）/g, "").split(" / ").at(-1).replace(/\s/g, "");
  assert.equal(names[id], real, `${id}: full name`);
}
// 本名を隠している人・源氏名の人は、LIMEでも本名を出さない
for (const id of ["minto", "rei", "ageha", "samechan"]) {
  for (const secret of ["木成頼", "栞", "田中", "健太", "夜長", "千代子", "暑海", "なぎさ"]) {
    assert.ok(!names[id].includes(secret), `${id}: ${secret} stays hidden`);
  }
}
// 名乗る前は「？？？」のまま（アカウント名でも正体を明かさない）。名乗った後はアカウント名
const unmet = { met: {}, flags: {}, contacts: [] };
for (const id of ["volk", "ageha", "samechan", "rio", "noor"]) assert.equal(limeAccountName(id, unmet), "？？？", `${id} before introductions`);
const known = { met: Object.fromEntries(Object.keys(names).map(id => [id, true])), flags: { _samechan_nickname_known: true }, contacts: ["samechan"] };
for (const [id, name] of Object.entries(names)) assert.equal(limeAccountName(id, known), name);
assert.equal(limeAccountName("mashiro", known), displayName("mashiro", known, { context: "private" }), "No account name: the usual name");

console.log(`lime names: PASS (${Object.keys(names).length} account names, emoji only for Adam and Samechan, hidden before introductions)`);
