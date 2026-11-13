// Shared by the actual bench entry and its in-game preview.
import { withLoading } from "../core/loading.js";
import { state } from "../core/state.js";
import { hasMetCharacter } from "../core/title-art-unlock.js";
import { hasReadLoadingComic, recordLoadingComicRead } from "../core/loading-comic-log.js";
// preview: the bench preview page must not write anything (it only reads the existing record).
export function prepareBenchEntry(preparation, chapter, steps = [], { preview = false } = {}) {
  const ready = withLoading(({ report }) => {
    if (steps.length) {
      let done = 0;
      const completed = () => {
        // Progress reporting must never change the result of the actual preparation.
        try { report(++done, steps.length); } catch { /* Display only. */ }
      };
      for (const step of steps) void Promise.resolve(step).then(completed, completed);
    }
    return preparation;
  }, {
    context: "craft", chapter: chapter || 1, label: "作業台を準備しています…",
    // Comics unlock per character: only those whose whole cast the player has met (loading-comics.js).
    isMet: (id) => hasMetCharacter(state, id),
    // Unread comics first; a comic the player tapped past is remembered outside the save slots.
    isRead: hasReadLoadingComic,
    onRead: preview ? null : (comic) => recordLoadingComicRead(comic.id),
  });
  // Downstream step preparation still waits for the actual assets separately.
  return Object.assign(ready, { assetsReady: preparation.assetsReady || preparation });
}
