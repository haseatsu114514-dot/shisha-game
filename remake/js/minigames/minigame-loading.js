// ミニゲームを始める前のロード画面（2026-11-11 オーナー「加速すると処理重い。ゲーム開始前に漫画付きロードとか挟んでもいい」）。
// 作業台と同じロード画面（core/loading.js）で、絵・音を読み終えるまで待つ。
// 漫画は作業台と同じ決まりで選ぶ: 出てくるキャラ全員と会った話だけ、ネタバレの話は明かす章（minChapter）から（core/loading-context.js）。
// 本編は長い待ちだけ漫画を出す。試遊は従来の表示時間で、読書記録を書かない。
import { withLoading } from "../core/loading.js";
import { state } from "../core/state.js";
import { gameLoadingOptions } from "../core/loading-context.js";

export function minigameLoadingOptions(save = state) {
  // 作業台の登録をそのまま使う。漫画追加のたびに別の場面名を足す必要をなくし、
  // 後から追加された話も同じ章・面識の条件でミニゲームの前に出せるようにする。
  if (save) return gameLoadingOptions(save);
  return { context: "craft", chapter: 1, isMet: null };
}

export function withMinigameLoading(prepare, { host, label }) {
  return withLoading(prepare, { host, label, activity: !!state, ...minigameLoadingOptions() });
}
