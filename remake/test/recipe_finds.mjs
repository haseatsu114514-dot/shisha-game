// 第3章以降の「新しい一台を発見する」連鎖（#2020 G）。
// データの約束（data/recipes.json の find・data/dialogue/recipe_finds.json）と、ヒント→発見→返す の判定・周回の扱い。
// node remake/test/recipe_finds.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { findRecipes, recipeFindAt, recipeFindScenes, settleRecipeFind, hintFlag, returnFlag, hintSceneId, returnSceneId }
  from "../js/daily/recipe-finds-model.js";
import { classifyFlag, flagVerdict, buildCarryPackage } from "../js/core/carry.js";

const root = new URL("../../", import.meta.url);
const text = rel => fs.readFileSync(new URL(rel, root), "utf8");
const read = rel => JSON.parse(text(rel));
const recipes = read("data/recipes.json").recipes;
const flavors = read("data/flavors.json").flavors;
const flavorById = Object.fromEntries(flavors.map(f => [f.id, f]));
const characters = (() => { const raw = read("data/characters.json"); return Array.isArray(raw) ? raw : raw.characters || Object.values(raw); })();
const characterIds = new Set(characters.map(c => c?.id).filter(Boolean));
const scenes = Object.fromEntries(read("data/dialogue/recipe_finds.json").dialogues.map(d => [d.dialogue_id, d]));

// ---------------------------------------------------------------- A. データの約束
const chain = findRecipes(recipes);
assert.ok(chain.length >= 6, "第3・4・5章に数件ずつ");
for (const chapter of [3, 4, 5]) {
  assert.ok(chain.filter(r => r.find.chapters[0] === chapter).length >= 2, `第${chapter}章で聞けるヒントが2件以上`);
}
const familyKey = id => flavorById[id]?.family || id;
const setKey = list => [...new Set(list.map(familyKey))].sort().join("+");
const existingKeys = new Map();
for (const r of recipes) {
  const key = setKey(r.flavors);
  assert.ok(!existingKeys.has(key), `同じ組み合わせのレシピが二つある: ${r.id} / ${existingKeys.get(key)}`);
  existingKeys.set(key, r.id);
}

// 店の品ぞろえ（daily/shop.js・daily/shop-catalogs.js の配列をそのまま読む）
const listIn = (src, name) => {
  const m = src.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(m, `${name} が見つからない`);
  return [...m[1].replace(/\/\/[^\n]*/g, "").matchAll(/"([^"]+)"/g)].map(x => x[1]);
};
const shopSrc = text("remake/js/daily/shop.js"), catalogSrc = text("remake/js/daily/shop-catalogs.js");
const HOME = listIn(shopSrc, "SHOP_FLAVORS"), CITY = listIn(catalogSrc, "WIDEHANGA_FLAVORS"), TOKYO = listIn(catalogSrc, "TOKYO_FLAVORS");
const ALL = [...new Set([...HOME, ...CITY, ...TOKYO])]; // ドバイ店＝日本の各店の葉を全部
// その章で、ヒントを聞いた土地のうちに葉をそろえられる（第3章は東京の店だけ、第4章はドバイ、第5章は地元・柚ヶ谷・東京・ドバイ）
const SHELF = { 3: TOKYO, 4: ALL, 5: ALL };
// 大会の支給の葉（craft/steps.js の REGULATION）。同じ章の大会の課題で +14 の組み合わせを増やさない
const supply = Object.fromEntries([...text("remake/js/craft/steps.js").matchAll(/^\s*(\d):\s*\{\s*flavor:\s*"(\w+)"/gm)].map(m => [Number(m[1]), m[2]]));
assert.equal(supply[3], "chocolate");
assert.equal(supply[5], "double_apple");

const chapterSrc = fs.readdirSync(new URL("remake/js/chapters/", root)).map(f => text(`remake/js/chapters/${f}`)).join("\n");
const spotKnown = id => chapterSrc.includes(`id: "${id}"`) || chapterSrc.includes(`homeBase("${id}")`);
const width = t => [...t].reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .5 : 1), 0);

for (const r of chain) {
  const { find } = r;
  assert.ok(characterIds.has(find.person), `${r.id}: 人物 ${find.person}`);
  assert.ok(Array.isArray(find.chapters) && find.chapters.length && find.chapters.every(c => [3, 4, 5].includes(c)), `${r.id}: 第3章以降だけ`);
  assert.ok(Array.isArray(find.at) && find.at.length, `${r.id}: 返す店`);
  for (const id of [...find.at, ...(find.hint_at || [])]) assert.ok(spotKnown(id), `${r.id}: 行き先 ${id} が章の地図に無い`);
  for (const id of find.hint_at || []) assert.ok(find.at.includes(id), `${r.id}: ヒントを聞いた店でも返せる`);
  assert.ok(Number(find.heart) >= 1, `${r.id}: 初めての来店では聞かない（好感度の段）`);
  assert.equal(r.hint_note, `recipe_hint_${r.id}`);
  assert.ok(r.hint_text?.includes("「") && r.memo && !/キレ/.test(r.hint_text + r.memo), `${r.id}: ヒント文・メモ`);
  assert.ok(!/ミント|ストロベリー/.test(r.name), `${r.id}: 名前に課題判定の語を入れない`);
  assert.ok(!r.golden, `${r.id}: 黄金比はオーナー確定分だけ`);
  assert.ok(r.flavors.length >= 2 && r.flavors.every(id => flavorById[id] && familyKey(id) === id), `${r.id}: 葉は系統キー`);
  const hintChapter = find.chapters[0];
  for (const id of r.flavors) {
    assert.ok(SHELF[hintChapter].includes(id), `${r.id}: ${id} を第${hintChapter}章の店でそろえられない`);
    assert.ok((flavorById[id].chapter_min || 1) <= hintChapter, `${r.id}: ${id} は第${hintChapter}章で未発売`);
  }
  for (const c of find.chapters) assert.ok(!r.flavors.includes(supply[c]), `${r.id}: 第${c}章の大会の課題の葉を含めない`);
  for (const line of r.recall) assert.ok(width(line) <= 48 && line.startsWith("（") && line.endsWith("）"), `${r.id}: ${line}`);

  // 台詞: ヒントは note 行でメモ、話すのは本人とはじめだけ。全角48字以内・手動改行なし・話者付きの末尾に「。」を付けない
  const hint = scenes[hintSceneId(r)], back = scenes[returnSceneId(r)];
  assert.ok(hint?.lines?.length && back?.lines?.length, `${r.id}: 台本`);
  const notes = hint.lines.filter(l => l.type === "note");
  assert.deepEqual(notes.map(l => l.note_id), [r.hint_note], `${r.id}: ヒントの note 行`);
  assert.ok(!back.lines.some(l => l.type === "note"), `${r.id}: 返す会話でメモし直さない`);
  for (const line of [...hint.lines, ...back.lines].filter(l => typeof l.text === "string")) {
    assert.ok(["", "hajime", find.person].includes(line.speaker), `${r.id}: 話者 ${line.speaker}`);
    assert.ok(width(line.text) <= 48 && !line.text.includes("\n"), `${r.id}: ${line.text}`);
    if (line.speaker) assert.ok(!line.text.endsWith("。") && !line.text.endsWith("。）"), `${r.id}: ${line.text}`);
    // 大会の前後どちらでも読むので、大会・審査に触れない
    assert.ok(!/大会|審査|本番|決勝/.test(line.text), `${r.id}: ${line.text}`);
  }
  // 返す会話で、付けた名前を口にする
  assert.ok(back.lines.some(l => l.speaker === "hajime" && l.text.includes(`「${r.name}」`)), `${r.id}: 名前を返す`);
}
assert.deepEqual(recipeFindScenes(recipes).sort(), Object.keys(scenes).sort(), "台本と定義が一対一");

// ---------------------------------------------------------------- B. ヒント→発見→返す
const steve = recipes.find(r => r.id === "lime_second_puff");
const festa = recipes.find(r => r.id === "festa_punch");
const fresh = (chapter, extra = {}) => ({ chapter, flags: {}, met: {}, recipes: {}, ...extra });
const hearts = levels => id => levels[id] || 0;

{
  const s = fresh(3);
  // 会っていない人からは聞かない・好感度が足りなければ聞かない・ほかの店では聞かない・章が違えば聞かない
  assert.equal(recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 5 })), null, "会っていない");
  s.met.steve = true;
  assert.equal(recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 1 })), null, "♥1では聞かない");
  assert.equal(recipeFindAt(s, "ch3_tokyo_volk", recipes, hearts({ steve: 2 })), null);
  assert.equal(recipeFindAt(fresh(4, { met: { steve: true } }), "ch3_tokyo_steve", recipes, hearts({ steve: 2 })), null, "第4章の東京は無い");
  const pick = recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 2 }));
  assert.deepEqual([pick.kind, pick.recipe.id, pick.sceneId], ["hint", "lime_second_puff", "recipe_find_lime_second_puff_hint"]);
  // 読み終えたらメモ（台本の note 行と同じ印）。もう一度は聞かない。まだ作っていないので返さない
  assert.equal(settleRecipeFind(s, pick), true);
  assert.equal(s.flags[hintFlag(steve)], true);
  assert.equal(s.flags._note_recipe_hint_lime_second_puff, true);
  assert.equal(recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 5 })), null);
  // 作ってレシピ帳に載る（craft/steps.js・家シーシャが state.recipes に書く）→ 次の来店で返す
  s.recipes.lime_second_puff = { day: 9 };
  const back = recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 2 }));
  assert.deepEqual([back.kind, back.sceneId], ["return", "recipe_find_lime_second_puff_return"]);
  settleRecipeFind(s, back);
  assert.equal(s.flags[returnFlag(steve)], true);
  assert.equal(recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 5 })), null, "返すのは一度だけ");
  // 第5章の東京の Smoke & Glory でも、返した後は何も出ない
  s.chapter = 5;
  assert.equal(recipeFindAt(s, "ch5_tokyo_steve", recipes, hearts({ steve: 5 })), null);
}
{
  // 第3章で聞いて作らなかった → 第5章で作れば、第5章の東京で返せる
  const s = fresh(5, { met: { steve: true }, flags: { [hintFlag(steve)]: true }, recipes: { lime_second_puff: { day: 40 } } });
  assert.equal(recipeFindAt(s, "ch5_tokyo_steve", recipes, hearts({ steve: 3 }))?.kind, "return");
}
{
  // 綾取は第3章の後に福岡へ戻る（第5章の東京に煙幕は無い）: 第5章ではヒントも返す会話も出ない
  const s = fresh(5, { met: { saku: true }, recipes: { weekend_citron: { day: 40 } } });
  assert.equal(recipeFindAt(s, "ch3_tokyo_enmaku", recipes, hearts({ saku: 5 })), null);
  s.flags[hintFlag(recipes.find(r => r.id === "weekend_citron"))] = true;
  assert.equal(recipeFindAt(s, "ch3_tokyo_enmaku", recipes, hearts({ saku: 5 })), null);
}
{
  // 太陽: ヒントはFESTA（第4章）だけ。返すのは第4章のFESTAか第5章の屋敷の中庭
  const s = fresh(5, { met: { da_silva: true } });
  assert.equal(recipeFindAt(s, "ch5_dubai_taiyo", recipes, hearts({ da_silva: 5 })), null, "第5章の中庭ではヒントを出さない");
  s.flags[hintFlag(festa)] = true;
  s.recipes.festa_punch = { day: 30 };
  assert.equal(recipeFindAt(s, "ch5_dubai_taiyo", recipes, hearts({ da_silva: 0 }))?.recipe.id, "festa_punch");
  const four = fresh(4, { met: { da_silva: true } });
  assert.equal(recipeFindAt(four, "ch4_dubai_festa", recipes, hearts({ da_silva: 2 }))?.kind, "hint");
}
{
  // 聞く前に偶然作っていた（周回でレシピ帳を持ち越した場合も同じ）: ヒントは聞ける。返すのは次の来店
  const s = fresh(3, { met: { saku: true }, recipes: { weekend_citron: { day: 2 } } });
  const pick = recipeFindAt(s, "ch3_tokyo_enmaku", recipes, hearts({ saku: 2 }));
  assert.equal(pick?.kind, "hint", "返すのはヒントを聞いてから");
  settleRecipeFind(s, pick);
  assert.equal(recipeFindAt(s, "ch3_tokyo_enmaku", recipes, hearts({ saku: 2 }))?.kind, "return");
}
// 壊れた保存・知らない値
assert.equal(recipeFindAt(null, "ch3_tokyo_steve", recipes), null);
assert.equal(recipeFindAt({ chapter: 3 }, "ch3_tokyo_steve", recipes), null);
assert.equal(recipeFindAt(fresh(3), "", recipes), null);
assert.equal(settleRecipeFind(fresh(3), { kind: "other", recipe: steve }), false);
assert.equal(settleRecipeFind(fresh(3), null), false);

// ---------------------------------------------------------------- C. 周回（NG+）
assert.equal(classifyFlag(returnFlag(steve)), "person");
assert.equal(flagVerdict(returnFlag(steve)), "reset");
assert.equal(flagVerdict(hintFlag(steve)), "reset");
{
  const pkg = buildCarryPackage({ flags: { [hintFlag(steve)]: true, [returnFlag(steve)]: true }, recipes: { lime_second_puff: { day: 9 } } });
  assert.deepEqual(pkg.recipes, { lime_second_puff: { day: 9 } }, "レシピ帳は持ち越す");
  assert.ok(!(hintFlag(steve) in pkg.flags) && !(returnFlag(steve) in pkg.flags), "メモと返した印は持ち越さない");
  // 次の周回: ヒントをもう一度聞き、次の来店で返す（二重には出ない）
  const s = fresh(3, { met: { steve: true }, recipes: pkg.recipes, flags: pkg.flags });
  const hint = recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 2 }));
  assert.equal(hint?.kind, "hint");
  settleRecipeFind(s, hint);
  const back = recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 2 }));
  assert.equal(back?.kind, "return");
  settleRecipeFind(s, back);
  assert.equal(recipeFindAt(s, "ch3_tokyo_steve", recipes, hearts({ steve: 2 })), null);
}

console.log(`[recipe finds] PASS: ${chain.length} chains (data contract, hint→discovery→return, chapters/places, NG+ carry)`);
