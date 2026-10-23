// 喫茶こはくのひらめき（#621）: 想起が先・会った相手と雨で変わる・作った配合は出さない・たまに必ず・台詞の長さ。
import assert from "node:assert/strict";
import fs from "node:fs";
import { pickCafeIdea, cafeIdeaDue, ideaDialogue, markCafeIdea, triedLater, cafeNoted, comboName } from "../js/daily/cafe-ideas.js";

const recipes = JSON.parse(fs.readFileSync(new URL("../../data/recipes.json", import.meta.url), "utf8")).recipes;
const flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url), "utf8")).flavors;
const fresh = () => ({ flags: {}, met: {}, recipes: {} });

// 聞いた話がなければ自分のひらめき。会っていない相手・晴れの日の雨ネタは出ない
let save = fresh();
let pick = pickCafeIdea(save, recipes);
assert.equal(pick.kind, "idea");
assert(!pick.recipe.idea.met && !pick.recipe.idea.rain);
assert.equal(pickCafeIdea(save, recipes, { rainy: true }).recipe.id, "yudachi_suika", "雨の日は雨のひらめきを先に");

// ライバルから聞いた話（ノート）があれば、まず思い出す。作った配合は思い出さない
save.flags._note_recipe_hint_apple_pie = true;
pick = pickCafeIdea(save, recipes);
assert.deepEqual([pick.kind, pick.recipe.id], ["recall", "apple_pie"]);
save.recipes.apple_pie = { day: 3 };
assert.equal(pickCafeIdea(save, recipes).kind, "idea");

// メモしたら同じものは出ない。全部メモしたら null
save = fresh();
save.met = { naru: true, tsumugi: true };
const seen = new Set();
for (let i = 0; i < 20; i++) {
  const p = pickCafeIdea(save, recipes, { rainy: true });
  if (!p) break;
  assert(!seen.has(p.recipe.id)); seen.add(p.recipe.id);
  markCafeIdea(save, p, flavors);
  assert(cafeNoted(save, p.recipe));
}
assert.equal(seen.size, recipes.filter((r) => r.idea).length);
assert.equal(pickCafeIdea(save, recipes, { rainy: true }), null);
assert.equal(triedLater(save, recipes).length, seen.size, "ステータスの試したい配合に並ぶ");
assert.equal(comboName(recipes.find((r) => r.id === "cream_soda"), flavors), "メロン＋バニラ");

// 初来店は出ない。外れが2回続いたら次は必ず
save = fresh();
assert.equal(cafeIdeaDue(save, 1, () => 0), false);
assert.equal(cafeIdeaDue(save, 2, () => .99), false);
assert.equal(cafeIdeaDue(save, 3, () => .99), false);
assert.equal(cafeIdeaDue(save, 4, () => .99), true);
assert.equal(save.flags._cafe_idea_wait, 0);

// 台詞: 全角48字以内・手動改行なし・心の声は（）で閉じる
const width = (t) => [...t].reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .5 : 1), 0);
for (const r of recipes) {
  for (const text of [...(r.recall || []), ...(r.idea?.lines || [])]) {
    assert(width(text) <= 48 && !text.includes("\n") && text.startsWith("（") && text.endsWith("）"), `${r.id}: ${text}`);
  }
}
const dlg = ideaDialogue({ kind: "idea", recipe: recipes.find((r) => r.id === "cream_soda") }, () => 0);
assert.equal(dlg.lines[0].speaker, "");
assert(dlg.lines.slice(1).every((l) => l.speaker === "hajime"));
console.log("[cafe ideas] PASS: recall first, met/rain conditions, no repeats, status list, pity, line width");
