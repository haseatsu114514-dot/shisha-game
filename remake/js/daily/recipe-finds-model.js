// 第3章以降の「新しい一台を発見する」連鎖（#2020 G・2026-11-11 オーナー「推奨で全部進めて」）の判定。DOM を持たない。
// ヒントを聞く→自分で試す→名前のある発見になる→相手に返す:
//   - ヒント: 章の行き先で一服を終えた後、その店の人が配合を短く教える（台本の type:"note" でメモ。第1章のヒントと同じ印）
//   - 試す・発見: 自分の葉で作り、配合が data/recipes.json と一致するとレシピ帳に載る（今までの仕組みのまま）
//   - 返す: レシピ帳に載った後、同じ人の店で一服を終えると、名前を付けた一台を返す会話を一度だけ読む
// 定義は data/recipes.json の find（person・chapters・at・hint_at・heart）。再生は daily/recipe-finds.js。
// 周回（NG+）: レシピ帳は持ち越すが、メモ（_note_*）と返した印は持ち越さない（core/carry.js）。
// 前の周回で載せた配合は、ヒントを聞いた次の来店で返せる。

/** 名前を付けた一台を、教えてくれた人に返した印（周回では持ち越さない・core/carry.js）。 */
export const returnFlag = recipe => `_recipe_return_${recipe.id}`;
/** ヒントを聞いた印（台本の note 行が立てる。第1章のヒントと同じ名前）。 */
export const hintFlag = recipe => `_note_${recipe.hint_note}`;
export const hintSceneId = recipe => `recipe_find_${recipe.id}_hint`;
export const returnSceneId = recipe => `recipe_find_${recipe.id}_return`;

/** 連鎖のあるレシピ（find と hint_note の両方を持つもの）。 */
export const findRecipes = (recipes = []) => (Array.isArray(recipes) ? recipes : []).filter(recipe => recipe?.find?.person && recipe.hint_note);

/** 連鎖の台本の一覧（読み込み用）。 */
export const recipeFindScenes = recipes => findRecipes(recipes).flatMap(recipe => [hintSceneId(recipe), returnSceneId(recipe)]);

const inChapter = (find, value) => !Array.isArray(find.chapters) || find.chapters.includes(value?.chapter);
const returnSpots = find => Array.isArray(find.at) ? find.at : [];
const hintSpots = find => Array.isArray(find.hint_at) ? find.hint_at : returnSpots(find);

/**
 * この行き先で一服を終えた後に読む一本。{ kind: "return" | "hint", recipe, sceneId } か null。保存は変えない。
 * 返す方を先に見る（一回の来店で一本だけ）。heartOf(人物ID) はその人の好感度の段（core/stats.js の affinityLevel）。
 * - 返す: その章で返せる店・ヒントを聞いた・レシピ帳に載っている・まだ返していない
 * - ヒント: その章でヒントを聞ける店・その人と会っている・好感度が足りる・まだ聞いていない
 */
export function recipeFindAt(value, spotId, recipes, heartOf = () => 0) {
  if (!value?.flags || typeof spotId !== "string" || !spotId) return null;
  const chain = findRecipes(recipes).filter(recipe => inChapter(recipe.find, value));
  const back = chain.find(recipe => returnSpots(recipe.find).includes(spotId)
    && !!value.flags[hintFlag(recipe)] && !!value.recipes?.[recipe.id] && !value.flags[returnFlag(recipe)]);
  if (back) return { kind: "return", recipe: back, sceneId: returnSceneId(back) };
  const hint = chain.find(recipe => hintSpots(recipe.find).includes(spotId)
    && !!value.met?.[recipe.find.person] && !value.flags[hintFlag(recipe)]
    && (Number(heartOf(recipe.find.person)) || 0) >= (Number(recipe.find.heart) || 0));
  return hint ? { kind: "hint", recipe: hint, sceneId: hintSceneId(hint) } : null;
}

/**
 * 読み終えた一本を確定する（中断・LOADでは呼ばない）。ヒントは台本の note 行がすでに印を立てているが、
 * 台本の作りに頼らず同じ印を立てる（同じ値なので二重にならない）。返したら印を立てる。
 */
export function settleRecipeFind(value, pick) {
  if (!value?.flags || !pick?.recipe) return false;
  if (pick.kind === "hint") value.flags[hintFlag(pick.recipe)] = true;
  else if (pick.kind === "return") value.flags[returnFlag(pick.recipe)] = true;
  else return false;
  return true;
}
