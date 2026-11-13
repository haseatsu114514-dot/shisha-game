// ミニゲームを始める前のロード画面（2026-11-11 オーナー「加速すると処理重い。ゲーム開始前に漫画付きロードとか挟んでもいい」）。
// 作業台と同じロード画面（core/loading.js）で、絵・音を読み終えるまで待つ。
// 漫画は作業台と同じ決まりで選ぶ: 出てくるキャラ全員と会った話だけ、ネタバレの話は明かす章（minChapter）から（core/loading-context.js）。
// ゲームの中では「決まった場面」（2026-11-12 オーナー「決まった場面は毎回出す」）: 1回の訪問の最初の1回は、待ちがなくても漫画を出す
// （minigameLoadingFixed）。やり直しの2回目からは、従来どおり待ちがあるときだけ出す。
// 試遊ページ（セーブを読まない・state が null）では、作業台の確認ページと同じく会ったかどうかは見ず、第1章から出せる話だけにし、
// 待ちがあるときだけ出して、読んだ記録も書かない。
import { withLoading, comicLoadingRequired } from "../core/loading.js";
import { state } from "../core/state.js";
import { gameLoadingOptions } from "../core/loading-context.js";

export function minigameLoadingOptions(save = state) {
  // 作業台の登録をそのまま使う。漫画追加のたびに別の場面名を足す必要をなくし、
  // 後から追加された話も同じ章・面識の条件でミニゲームの前に出せるようにする。
  if (save) return gameLoadingOptions(save);
  return { context: "craft", chapter: 1, isMet: null };
}

/** この訪問で最初に始めるときは、絵が揃っていてもロード画面（漫画）を出す。呼び出し側は true のとき必ず withMinigameLoading を通す。 */
export function minigameLoadingFixed(first, save = state) {
  return !!first && !!save && comicLoadingRequired();
}

export function withMinigameLoading(prepare, { host, label, fixed = false }) {
  return withLoading(prepare, { host, label, fixed: fixed && !!state, ...minigameLoadingOptions() });
}
