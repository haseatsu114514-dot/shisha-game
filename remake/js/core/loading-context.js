// ゲームの中のロード画面（作業台に入る・ミニゲームの前・章の始め・セーブからの再開・起動）で漫画を選ぶ共通の決まり。
// 作業台の登録（contexts: ["craft"]）から、出てくるキャラ全員と会った話だけを、明かす章（minChapter）から出す。
// まだ読んでいない話を先に出し、読み終えて自分で先へ進めた話を記録する（core/loading-comic-log.js）。
import { KNOWN_AT_START } from "./state.js";
import { comicLoadingRequired } from "./loading.js";
import { hasMetCharacter } from "./title-art-unlock.js";
import { hasReadLoadingComic, recordLoadingComicRead } from "./loading-comic-log.js";

// 続きのセーブがない起動（はじめて遊ぶ人）は、新しいゲームの開始時に会っている相手の話だけにする。
const FRESH_GAME = Object.freeze({ met: Object.fromEntries(KNOWN_AT_START.map(id => [id, true])), flags: {}, contacts: ["sumi"], story: {} });

/**
 * save: いまのゲーム（state）か、起動時に見つけた続きのセーブ。record: false なら読んだ記録を書かない（確認用ページ）。
 * 読んだ記録は、漫画を毎回出すプレイヤーの既定（core/loading.js comicLoadingRequired）のときだけ書く。自動操作のブラウザ
 * （既存の検査）は従来どおり何も書かない（遊んでも保存領域が変わらないことを見る検査がある）。
 */
export function gameLoadingOptions(save, { chapter, record = true } = {}) {
  const game = save && typeof save === "object" ? save : FRESH_GAME;
  const saved = Number.isInteger(game.chapter) && game.chapter > 0 ? game.chapter : 1;
  return {
    context: "craft",
    chapter: Number.isInteger(chapter) && chapter > 0 ? chapter : saved,
    isMet: id => hasMetCharacter(game, id),
    isRead: hasReadLoadingComic,
    onRead: record && comicLoadingRequired() ? comic => recordLoadingComicRead(comic.id) : null,
  };
}
