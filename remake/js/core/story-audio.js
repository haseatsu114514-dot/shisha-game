// 本編（会話・メニュー・UI・場面転換）の仮BGM／SE対応表。
// あとで差し替えるときは、ここのキーと assets/audio の同名ファイルだけを変えればよい。
// ラクダレース（PC側）と DJ（#2456）の音はこの表に含めない。

/** 役割 → 再生キー（bgmUrl が assets/audio/bgm/<key>.mp3|.bgm を探す） */
export const STORY_BGM = Object.freeze({
  title: "title",
  staffRoll: "title",
  shopHome: "tonari",
  dailyCity: "kansetsu_shomei_to_black_coffee",
  // 第2章の街・柚ヶ谷（2026-11-12 仮。CC0 の「Mocha Frapp」。J04 の曲ができたら、このキーのファイルだけ差し替える）。
  yuzugaya: "bgm_yuzugaya",
  // 実ファイルあり（未使用）。第1・3章の街・地図は dailyCity のまま。
  map: "bgm_map",
  rivalShop: "bgm_rival_shop",
  tournamentWait: "bgm_tournament_wait",
  tournamentOpen: "bgm_tournament_edm",
  tournamentCraft: "bgm_tournament_craft",
  judging: "bgm_judging",
  aftermath: "bgm_aftermath",
  resultWin: "bgm_result_emotional",
  dubai: "bgm_dubai",
  worldStage: "bgm_world_stage",
  smokeLab: "bgm_smoke_lab",
  ch5Duel: "bgm_ch5_duel",
  ending: "bgm_ending",
  samechan: "sweets_or_sweets",
  tasteDistant: "bgm_taste_distant",
});

/** 役割名から本編BGMキーを返す。未知の役割は店の曲へ逃がす。 */
export function storyBgm(role) {
  return STORY_BGM[role] || STORY_BGM.shopHome;
}

/**
 * 章の地図・朝のハブで鳴らす曲。
 * 第1・3章は既存の街の曲（kansetsu）。第2章は柚ヶ谷、第4章はドバイ、第5章は店の曲。
 */
export function chapterHubBgm(chapter) {
  if (Number(chapter) === 2) return STORY_BGM.yuzugaya;
  if (Number(chapter) === 4) return STORY_BGM.dubai;
  if (Number(chapter) === 5) return STORY_BGM.shopHome;
  return STORY_BGM.dailyCity;
}

/** 店や施設から街へ戻った時に鳴らす曲。第2章は柚ヶ谷の曲、ほかの章は今までどおり日常の曲。 */
export function cityBgm(chapter) {
  return Number(chapter) === 2 ? STORY_BGM.yuzugaya : STORY_BGM.dailyCity;
}

/** UI／転換の役割 → SE 識別子（audio.js の SE / RECORDED_SE） */
export const STORY_SE = Object.freeze({
  click: "click",
  select: "select",
  cancel: "cancel",
  transition: "whoosh",
  title: "jingle",
  card: "card",
});
