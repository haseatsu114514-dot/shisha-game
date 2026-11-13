// Shared by the actual bench entry and its in-game preview.
import { withLoading } from "../core/loading.js";
import { state } from "../core/state.js";
import { gameLoadingOptions } from "../core/loading-context.js";
// Entering the bench is a fixed point: the comic loading screen shows every time, even when nothing needs
// loading (core/loading.js comicLoadingRequired). preview: the bench preview page waits only when needed
// and writes nothing (it only reads the existing reading record).
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
    label: "作業台を準備しています…", fixed: !preview,
    // Comics unlock per character: only those whose whole cast the player has met (loading-comics.js).
    ...gameLoadingOptions(state, { chapter: chapter || 1, record: !preview }),
  });
  // Downstream step preparation still waits for the actual assets separately.
  return Object.assign(ready, { assetsReady: preparation.assetsReady || preparation });
}
