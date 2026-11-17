// 端末に保存できない（容量いっぱい・保存を禁止した設定など）ときに、黙って進めず一度だけ知らせる（#3726 B-7）。
// 遊びは止めない。保存できるようになったら次の失敗でまた知らせる（state.js の "save-failed" / "save-recovered"）。
import { on } from "./bus.js";
import { toast } from "./ui.js";

// 文言はオーナー確認待ちの候補1（/workspace/save-fail-notice-candidates.md）。
export const SAVE_FAILED_TEXT = "この端末に保存できていません。空き容量やブラウザの設定を確かめてください";
export const SAVE_FAILED_MS = 7000;

let installed = false;
export function installSaveFailedNotice() {
  if (installed) return;
  installed = true;
  on("save-failed", () => toast(SAVE_FAILED_TEXT, { kind: "warn", ms: SAVE_FAILED_MS }));
}
