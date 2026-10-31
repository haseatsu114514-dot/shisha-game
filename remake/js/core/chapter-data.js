// 第2〜5章の場面カード式の章が使う、台本と物語の経路データの読み込み（#2035: 章のファイルから core へ移した）。
// パスは配信ページ（remake/index.html）からの相対。保存・DB への登録は呼び出し側が行う。

/** data/dialogue/<name>.json を読み、required の場面がすべて本文を持つことを確かめて id→場面 で返す。 */
export async function readDialogues(name, required) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`../data/dialogue/${name}.json`, { cache: "no-cache", signal: controller.signal });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.dialogues)) throw new Error(`${name}: 台本の形式を確認してください`);
    const dialogues = Object.fromEntries(data.dialogues.map((dialogue) => [dialogue.dialogue_id, dialogue]));
    for (const id of required) {
      if (!dialogues[id]?.lines?.length) throw new Error(`${name}: 台本が不足しています ${id}`);
    }
    return dialogues;
  } finally { clearTimeout(timer); }
}

let routesTask = null;

/** data/story_routes.json を一度だけ読む（失敗したら次の呼び出しで読み直す）。 */
export function loadStoryRoutes() {
  routesTask ||= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("../data/story_routes.json", { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error(`story_routes: HTTP ${response.status}`);
      const routes = await response.json();
      if (!Array.isArray(routes.heroine_ids) || !Array.isArray(routes.chapters?.["3"]?.optional)
        || !routes.romance || !routes.near_conflict) throw new Error("story_routes: 形式を確認してください");
      return routes;
    } finally { clearTimeout(timer); }
  })().catch(error => { routesTask = null; throw error; });
  return routesTask;
}
