// タイトルアートの解放判定と専用キービジュアル対応表（#1243）。
// セーブオブジェクトだけを見る純粋関数群と、差し替え可能な対応表をここに集約する。

/**
 * 表示対象の母集合 = 好感度の仕組みがあるキャラ全員。ゲーム内の既存ロスターの union:
 * - core/stats.js の ROMANCEABLE: tsumugi, minto, rin, ageha, hiyori, samechan
 * - daily/bonds.js の BOND_FINALES（好感度MAXの締めくくり）: sumi, naru, adam, tsumugi, minto, rin, samechan, hiyori
 * - data/story_routes.json の heroine_ids: tsumugi, minto, rin, ageha, mashiro, samechan, hiyori
 * 並びは manifest の titleArts のキャラ順に合わせ、アート未採用の sumi, naru, adam を後ろに置く。
 */
export const TITLE_ART_CHARACTERS = [
  "ageha", "hiyori", "samechan", "mashiro", "minto", "rin", "tsumugi",
  "sumi", "naru", "adam",
];

/**
 * 専用キービジュアル対応表（キャラ -> 採用アート1枚）。
 * 採用アートが決まったら、この表のファイル名だけを差し替える（#1243 の素材生成単元と連動）。
 * null は未採用で表示対象外。仮置きは既存タイトル原画の代表1枚（ファイル名は manifest の表記に合わせる）。
 */
export const TITLE_KEY_VISUALS = {
  ageha: "title_art_ageha_01_professional_taste.png",
  hiyori: "title_art_hiyori_01_twilight_walk.png",
  samechan: "title_art_samechan_01_shishark_test_run.png",
  mashiro: "title_art_mashiro_01_heavy_smoke.png",
  minto: "title_art_minto_01_cafe_welcome.png",
  rin: "title_art_rin_01_night_tasting.png",
  tsumugi: "title_art_tsumugi_01_smoke_colors.png",
  sumi: null,
  naru: null,
  adam: null,
};

// state.met のほか、既存コードが「出会った」と等価に扱う補助シグナルだけを認める。
const EXTRA_MET_SIGNALS = {
  hiyori: (s) => !!s.flags?._hiyori_meeting_done, // core/axe-bar-discovery.js の等価扱い
  samechan: (s) => !!(s.contacts?.includes?.("samechan") || s.flags?._samechan_nickname_known || s.flags?._lime_contact_samechan), // core/data.js displayName の分岐
  tsumugi: (s) => (s.story?.tsumugi || 0) > 0, // chapters/tsumugi-story.js の等価扱い
  // スミさんは勤務開始時から LIME 交換済みの上司で、名乗り記録（met）の対象外
  // （core/state.js の初期 contacts と core/data.js の ALWAYS_KNOWN が根拠）。連絡先にある＝すでに知っている相手として扱う。
  sumi: (s) => !!s.contacts?.includes?.("sumi"),
};

/** 純粋関数。save が無ければ characterIds の全員、あればそのセーブで出会ったキャラだけ（0人なら空配列） */
export function titleArtCharacters(save, characterIds) {
  if (!save) return [...characterIds];
  return characterIds.filter((id) => !!save.met?.[id] || !!EXTRA_MET_SIGNALS[id]?.(save));
}

/** 純粋関数。解放済みのうち、専用キービジュアルが割り当てられているキャラだけ（実際に表示できる面々） */
export function titleArtDisplayCharacters(save, characterIds = TITLE_ART_CHARACTERS, keyVisuals = TITLE_KEY_VISUALS) {
  return titleArtCharacters(save, characterIds).filter((id) => !!keyVisuals[id]);
}
