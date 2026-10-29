// 第1章の余韻と、第2章の予告。実体は共通プレイヤー chapter-preview.js（登録表の "ch2"）。
// 既存の呼び出し元（ch1.js・確認ページ）とテストのために、この入口を残す。
import { playChapterPreview as playRegisteredPreview } from "./chapter-preview.js";

export function playChapterPreview(options = {}) {
  return playRegisteredPreview("ch2", options);
}
