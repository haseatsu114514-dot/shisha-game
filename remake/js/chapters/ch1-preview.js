// 廃止済みの予告の保管用API。本編・確認ページからは呼び出さない。
// 過去の台本・素材・再生コードを削除せず残す。
import { playChapterPreview as playRegisteredPreview } from "./chapter-preview.js";

export function playChapterPreview(options = {}) {
  return playRegisteredPreview("ch2", options);
}
