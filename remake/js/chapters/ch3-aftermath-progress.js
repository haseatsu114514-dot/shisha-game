import { syncTokyoVisits } from "../core/tokyo-visits.js";
// 全国大会の勝利後だけ進む第3章の後日談。大会の順位・報酬はここでは変更しない。
export const CH3_AFTERMATH_SCENES = Object.freeze([
  { id: "ch3_abyss_hotel", dayAfterWin: 0, slot: 1, label: "優勝の夜", location: "mukaiの奥の部屋", bg: "bg_mukai_shop" },
  { id: "ch3_mashiro_recovery", dayAfterWin: 1, slot: 0, label: "いつもの席", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_naru_reconcile", dayAfterWin: 1, slot: 1, label: "自分からの報告", location: "東京", bg: "bg_mukai_shop" },
  { id: "ch3_enmaku_cleanup", dayAfterWin: 2, slot: 0, label: "煙幕の片づけ", location: "煙幕", bg: "bg_yohaku_shop" },
  { id: "ch3_home_customer", dayAfterWin: 2, slot: 1, label: "帰郷した夜", location: "tonari", bg: "bg_tonari_inside_night" },
  { id: "ch3_tsumugi_result", dayAfterWin: 2, slot: 1, label: "つむぎの絵", location: "tonari", bg: "bg_tonari_inside_night" },
  { id: "ch3_ageha_reunion", dayAfterWin: 3, slot: 0, label: "続いていた約束", location: "MELTY PUFF", bg: "bg_ageha_shop" },
]);

export const canRunChapterThreeAftermath = value => !!value && value.chapter === 3
  && value.flags?._ch3_tournament_won === true
  && value.flags?._ch3_tournament?.stage === "complete"
  && value.flags._ch3_tournament.result?.rank === 1
  && value.flags._ch3_tournament.result.win === true;

/** 全国優勝が確定した保存から一度だけ後日談を始める。 */
export function beginChapterThreeAftermath(value) {
  if (!canRunChapterThreeAftermath(value)) return false;
  if (value.flags._ch3_aftermath) return chapterThreeAftermathProgress(value);
  if (value.flags._ch3_cleared) throw new Error("第3章クリア記録に後日談の保存地点がありません");
  const progress = value.flags._ch3_aftermath = { version: 3, winDay: value.day, stage: 0 };
  value.phase = "aftermath";
  value.slot = 1;
  return progress;
}

export function chapterThreeAftermathProgress(value) {
  if (!canRunChapterThreeAftermath(value)) throw new Error("全国大会の勝利記録がありません");
  const progress = value.flags._ch3_aftermath;
  // 旧版で帰郷の夜を越えた保存は日時を巻き戻さず、残るあげはの場面へ進む。
  if (progress?.version === 1 && Number.isInteger(progress.stage) && progress.stage >= 0 && progress.stage <= 5) {
    if (progress.stage >= 4) progress.stage += 1;
    progress.version = 2;
  }
  // 煙幕の片づけ（帰郷の日の朝）を後から足した。まだ片づけ前の保存だけが読み、帰郷の夜以降は日時を戻さない。
  if (progress?.version === 2 && Number.isInteger(progress.stage) && progress.stage >= 0 && progress.stage <= 6) {
    if (progress.stage >= 3) progress.stage += 1;
    progress.version = 3;
  }
  if (!progress || progress.version !== 3 || !Number.isInteger(progress.winDay) || progress.winDay < 1
    || !Number.isInteger(progress.stage) || progress.stage < 0 || progress.stage > CH3_AFTERMATH_SCENES.length
    || (value.flags._ch3_cleared === true) !== (progress.stage === CH3_AFTERMATH_SCENES.length)) {
    throw new Error("第3章後日談の保存地点を確認できません");
  }
  return progress;
}

/** 現在の一場面を最後まで読んだ時だけ、次の日時へ進める。 */
export function completeChapterThreeAftermathScene(value, sceneId) {
  const progress = chapterThreeAftermathProgress(value);
  if (CH3_AFTERMATH_SCENES[progress.stage]?.id !== sceneId) return false;
  progress.stage += 1;
  const next = CH3_AFTERMATH_SCENES[progress.stage];
  if (next) {
    value.day = Math.max(value.day, progress.winDay + next.dayAfterWin);
    value.slot = next.slot;
    value.phase = "aftermath";
  } else {
    value.flags._ch3_cleared = true;
    value.phase = "cleared";
  }
  syncTokyoVisits(value);
  return true;
}
