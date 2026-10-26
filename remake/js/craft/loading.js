// Shared by the actual bench entry and its in-game preview.
import { withLoading } from "../core/loading.js";
export function prepareBenchEntry(preparation, chapter) {
  const ready = withLoading(() => preparation, {
    context: "craft", chapter: chapter || 1, label: "作業台を準備しています…",
  });
  // Downstream step preparation still waits for the actual assets separately.
  return Object.assign(ready, { assetsReady: preparation.assetsReady || preparation });
}
