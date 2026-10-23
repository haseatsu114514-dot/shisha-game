// 喫茶こはくのおまけ（#621 オーナー依頼）: くつろいでいると、たまに配合を思いつく。
// ライバルから聞いた話を思い出す「想起」を先に、なければ自分のひらめき（会った相手・雨の日で変わる）。
// 思いついた配合は「試したい配合」としてメモし、配合の画面で「ひらめき」に出る。説明はシステムの通知で短く。
// 台詞は data/recipes.json の recall / idea.lines（全角48字以内・手動改行なし）。

export const IDEA_CHANCE = 0.4; // 2回目以降の来店でこの確率。外れが2回続いたら次は必ず
const IDEA_PITY = 2;

const INTROS = [
  "ラテを片手に、ぼんやり窓の外を眺める。",
  "焼き菓子の甘い匂い。肩の力が、ふっと抜けた。",
  "カップの湯気を眺めていたら、ふと頭に浮かんだ。",
];

export const recallFlag = (r) => `_cafe_recall_${r.id}`;
export const ideaFlag = (r) => `_note_idea_${r.id}`;

/** 配合の画面で「ひらめき」に出してよいか（こはくで思いついた・思い出したものは洞察に関係なく出す） */
export function cafeNoted(save, r) {
  return !!(save.flags?.[ideaFlag(r)] || save.flags?.[recallFlag(r)]);
}

/** 次に思いつく配合（なければ null）。作ったことのある配合・思いついた配合は出さない */
export function pickCafeIdea(save, recipes, { rainy = false } = {}) {
  const made = (r) => !!save.recipes?.[r.id];
  const recall = recipes.find((r) => r.recall && r.hint_note && save.flags?.[`_note_${r.hint_note}`] && !made(r) && !save.flags[recallFlag(r)]);
  if (recall) return { kind: "recall", recipe: recall };
  const open = recipes.filter((r) => r.idea && !made(r) && !save.flags?.[ideaFlag(r)]
    && (!r.idea.met || save.met?.[r.idea.met]) && (!r.idea.rain || rainy));
  const idea = (rainy && open.find((r) => r.idea.rain)) || open[0];
  return idea ? { kind: "idea", recipe: idea } : null;
}

/** 今回の来店で思いつくか（2回目以降・たまに・外れが続いたら必ず） */
export function cafeIdeaDue(save, visit, random = Math.random) {
  if (visit < 2) return false;
  const wait = Number(save.flags._cafe_idea_wait) || 0;
  if (wait >= IDEA_PITY || random() < IDEA_CHANCE) { save.flags._cafe_idea_wait = 0; return true; }
  save.flags._cafe_idea_wait = wait + 1;
  return false;
}

/** ひらめきの短い場面（地の文＋はじめの心の声） */
export function ideaDialogue(pick, random = Math.random) {
  const lines = pick.kind === "recall" ? pick.recipe.recall : pick.recipe.idea.lines;
  return {
    dialogue_id: `cafe_idea_${pick.recipe.id}`,
    lines: [
      { speaker: "", face: "", text: INTROS[Math.floor(random() * INTROS.length)] },
      ...lines.map((text) => ({ speaker: "hajime", face: "normal", text })),
    ],
  };
}

/** 思いついた配合をメモする。戻り値は通知に使う葉の並び（例: メロン＋バニラ） */
export function markCafeIdea(save, pick, flavors = []) {
  save.flags[pick.kind === "recall" ? recallFlag(pick.recipe) : ideaFlag(pick.recipe)] = true;
  return comboName(pick.recipe, flavors);
}

export function comboName(recipe, flavors = []) {
  return recipe.flavors.map((id) => {
    const f = flavors.find((x) => x.id === id);
    return String(f?.short_name || f?.name || id).split(" ").pop(); // 「dobaj メロン」→「メロン」
  }).join("＋");
}

/** ステータス画面の「試したい配合」: こはくでメモした・ライバルから聞いた配合のうち、まだ作っていないもの */
export function triedLater(save, recipes) {
  return recipes.filter((r) => !save.recipes?.[r.id]
    && (cafeNoted(save, r) || (r.hint_note && save.flags?.[`_note_${r.hint_note}`])));
}
