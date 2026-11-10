// 本編（会話・メニュー・UI・場面転換）の仮BGM／SE対応表。
// あとで差し替えるときは、ここのキーと assets/audio の同名ファイルだけを変えればよい。
// ラクダレース（PC側）と DJ（#2456）の音はこの表に含めない。

/** 役割 → 再生キー（bgmUrl が assets/audio/bgm/<key>.mp3|.bgm を探す） */
export const STORY_BGM = Object.freeze({
  title: "title",
  staffRoll: "title",
  shopHome: "tonari",
  dailyCity: "kansetsu_shomei_to_black_coffee",
  // 実ファイルあり。第1〜3章の街・地図は J04 と既存テストのため dailyCity のまま。
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
 * 第1〜3章は既存の街の曲（kansetsu）を維持する。第4章はドバイ、第5章は店の曲。
 */
export function chapterHubBgm(chapter) {
  if (Number(chapter) === 4) return STORY_BGM.dubai;
  if (Number(chapter) === 5) return STORY_BGM.shopHome;
  return STORY_BGM.dailyCity;
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
