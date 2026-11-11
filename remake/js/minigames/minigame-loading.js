// ミニゲームを始める前のロード画面（2026-11-11 オーナー「加速すると処理重い。ゲーム開始前に漫画付きロードとか挟んでもいい」）。
// 作業台と同じロード画面（core/loading.js）で、絵・音を読み終えるまで待つ。読み終わっていれば何も出さずに始まる。
// 漫画は作業台と同じ決まりで選ぶ: 出てくるキャラ全員と会った話だけ、ネタバレの話は明かす章（minChapter）から。
// 試遊ページ（セーブを読まない・state が null）では、作業台の確認ページと同じく会ったかどうかは見ず、第1章から出せる話だけにする。
import { withLoading } from "../core/loading.js";
import { state } from "../core/state.js";
import { hasMetCharacter } from "../core/title-art-unlock.js";

export function minigameLoadingOptions(save = state) {
  return {
    context: "minigame",
    chapter: Number.isInteger(save?.chapter) && save.chapter > 0 ? save.chapter : 1,
    isMet: save ? id => hasMetCharacter(save, id) : null,
  };
}

export function withMinigameLoading(prepare, { host, label }) {
  return withLoading(prepare, { host, label, ...minigameLoadingOptions() });
}
