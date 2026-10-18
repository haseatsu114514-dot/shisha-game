// 第3章以降の台本を接続するための純粋な選択関数。現行の章進行には未接続。
// 正式名簿・場面IDは data/story_routes.json。所在と約束は将来の章runnerが明示して渡す。
// 既存セーブの lovers を使い、好感度や不明な所在から恋人・到着を推測しない。
export function canReadOptionalStory(routes, state, sceneId, context = {}) {
  const optional = Object.values(routes.chapters).flatMap(chapter => chapter.optional || []);
  if (!optional.includes(sceneId)) return false;
  const required = routes.optional_requirements?.[sceneId] || {};
  return (required.contacts || []).every(id => (state.contacts || []).includes(id))
    && (required.seen || []).every(id => (context.completedScenes || []).includes(id));
}

export function selectStoryEvening(routes, state, context = {}) {
  const lovers = [...new Set(state.lovers || [])].filter(id => routes.heroine_ids.includes(id));
  const present = new Set(context.present || []);
  const local = lovers.filter(id => present.has(id));
  if (local.length >= routes.conflict.minimum_present_lovers) {
    return {
      kind: "conflict", participants: local,
      scenes: [routes.conflict.open, ...local.map(id => routes.romance[id].conflict), routes.conflict.close],
      unresolved: [...new Set([...(context.unresolved || []), ...local])],
    };
  }
  const id = context.selected;
  const eligible = id && local.includes(id) && (context.accepted || []).includes(id)
    && Number(state.chapter) >= routes.romance[id].date_min_chapter
    && !(context.unresolved || []).includes(id)
    && !state.flags?._story_shuraba_unresolved;
  return eligible
    ? { kind: "date", participants: [id], scenes: [routes.romance[id].date] }
    : { kind: "rest", participants: [], scenes: [] };
}

export function selectStoryEnding(routes, state, context = {}) {
  const lovers = [...new Set(state.lovers || [])].filter(id => routes.heroine_ids.includes(id));
  const pending = lovers.length > 1 || (context.unresolved || []).length > 0
    || !!state.flags?._story_shuraba_unresolved;
  const id = lovers[0];
  const reunion = lovers.length === 1 && (context.present || []).includes(id)
    && (context.accepted || []).includes(id);
  const middle = pending ? routes.conflict.pending_ending
    : reunion ? routes.romance[id].epilogue : routes.ending.normal;
  return [routes.ending.start, middle, routes.ending.daily];
}
