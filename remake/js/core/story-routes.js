// 第3章以降の台本を接続するための純粋な選択関数。canReadOptionalStory と selectStoryEvening は第3章（ch3-story-wiring.js）
// から、selectStoryEvening は第4章の前夜（ch4-story-wiring.js）からも接続済み。selectStoryEnding と selectPostEndingConflict は未接続。
// 正式名簿・場面IDは data/story_routes.json。所在と約束は章runnerが明示して渡す。
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
  const local = lovers.filter(id => present.has(id)
    && Number(state.chapter) >= routes.romance[id].date_min_chapter);
  if (local.length >= routes.conflict.minimum_present_lovers) {
    const near = routes.near_conflict;
    if (Number(state.chapter) === near.chapter && present.has(near.interrupter)) {
      return {
        kind: "near_conflict", participants: local,
        scenes: [near.open, ...local.map(id => routes.romance[id].near_conflict), near.close],
        deferred: local,
      };
    }
    // 本格的な話し合いはエンディング後。別会場にスティーブを出現させない。
    return {
      kind: "overlap", participants: local, scenes: [near.overlap],
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
  const middle = pending ? routes.ending.normal
    : reunion ? routes.romance[id].epilogue : routes.ending.normal;
  return [routes.ending.start, middle, routes.ending.daily];
}

// ending_daily_smoke とスタッフロールの後に呼ぶ。前夜の茶化しとは別の場面。
export function selectPostEndingConflict(routes, state, context = {}) {
  const lovers = [...new Set(state.lovers || [])].filter(id => routes.heroine_ids.includes(id));
  const local = lovers.filter(id => (context.present || []).includes(id));
  if (local.length >= routes.conflict.minimum_present_lovers) {
    return {
      kind: "conflict", participants: local,
      scenes: [routes.conflict.open, ...local.map(id => routes.romance[id].conflict),
        routes.conflict.close, routes.conflict.pending_ending],
      unresolved: [...new Set([...(context.unresolved || []), ...local])],
    };
  }
  const pending = lovers.length > 1 || (context.unresolved || []).length > 0
    || !!state.flags?._story_shuraba_unresolved;
  return pending
    ? {kind: "pending", participants: [], scenes: [routes.conflict.pending_ending]}
    : {kind: "none", participants: [], scenes: []};
}
