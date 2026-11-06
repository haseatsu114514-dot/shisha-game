import { syncTokyoVisits } from "../core/tokyo-visits.js";
// 全国大会の勝利後だけ進む第3章の後日談。大会の順位・報酬はここでは変更しない。
export const CH3_AFTERMATH_SCENES = Object.freeze([
  // 優勝の夜は滞在先のmukaiの奥の部屋（#1485・#1899）。奥の部屋専用の背景は無いので店内の既存背景を使う。
  { id: "ch3_abyss_hotel", dayAfterWin: 0, slot: 1, label: "優勝の夜", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_mashiro_recovery", dayAfterWin: 1, slot: 0, label: "いつもの席", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_naru_reconcile", dayAfterWin: 1, slot: 1, label: "自分からの報告", location: "東京", bg: "bg_mukai_shop" },
  { id: "ch3_enmaku_cleanup", dayAfterWin: 2, slot: 0, label: "煙幕の片づけ", location: "煙幕", bg: "bg_yohaku_shop" },
  { id: "ch3_home_customer", dayAfterWin: 2, slot: 1, label: "帰郷した夜", location: "tonari", bg: "bg_tonari_inside_night" },
  { id: "ch3_tsumugi_result", dayAfterWin: 2, slot: 1, label: "つむぎの絵", location: "tonari", bg: "bg_tonari_inside_night" },
  { id: "ch3_ageha_reunion", dayAfterWin: 3, slot: 0, label: "続いていた約束", location: "MELTY PUFF", bg: "bg_ageha_shop" },
]);

/**
 * 大会後の寄り道（#2028 残件3・#1658 ⑥）。優勝の翌日から煙幕の片づけまで、東京にいる間の場面カードから一度ずつ読める。
 * 読んでも stage・日時は進めない。既読は大会前の寄り道と同じ _ch3_read_<id>（ch3-story-wiring.js の optionalReadFlag）。
 * file=台詞ファイル、met=面識がある人物だけ、after=この寄り道を読んでから（順に読む）。
 */
export const CH3_AFTERMATH_DETOURS = Object.freeze([
  { id: "ch3_mukai_after_tournament", file: "ch3_mukai", label: "閉店前のカウンター", location: "mukai", bg: "bg_mukai_shop" },
  // エミルは大会当日に名乗る審査員。体験会の台本は大会前の寄り道にもあるが、面識の条件で大会後にしか開かない。
  { id: "ch3_emil_workshop", file: "ch3_rivals", label: "エミルの体験会", location: "東京", bg: "bg_street_day", met: ["emil"] },
  // 鉄の煙の再訪（IR23）。初来店（DAY12夜）から大会までは行動が一つしかないので、大会前に読めなかった分を大会後にも順に読める。
  // 台本は大会に触れない店の話なので、大会の前後どちらで読んでも通る。好感度は台本の報酬（任意の場面だけ。必須の初来店には付けない）。
  { id: "ch3_volk_second", file: "ch3_volk", label: "鉄の煙の二度目", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"] },
  { id: "ch3_volk_third", file: "ch3_volk", label: "七年分の記録", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"], after: ["ch3_volk_second"] },
  { id: "ch3_volk_fourth", file: "ch3_volk", label: "頷く順番", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"], after: ["ch3_volk_third"] },
  { id: "ch3_volk_after_ch3", file: "ch3_volk", label: "大会のあとの記録", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"] },
]);
const DETOUR_FIRST = CH3_AFTERMATH_SCENES.findIndex(scene => scene.id === "ch3_mashiro_recovery");
const DETOUR_LAST = CH3_AFTERMATH_SCENES.findIndex(scene => scene.id === "ch3_enmaku_cleanup");
const detourReadFlag = id => `_ch3_read_${id}`;

/** いま読める大会後の寄り道。東京にいる間（翌日の昼〜帰郷の日の朝）だけ。 */
export function availableAftermathDetours(value) {
  if (!canRunChapterThreeAftermath(value) || value.flags._ch3_cleared) return [];
  const stage = value.flags._ch3_aftermath?.stage;
  if (!Number.isInteger(stage) || stage < DETOUR_FIRST || stage > DETOUR_LAST) return [];
  return CH3_AFTERMATH_DETOURS.filter(scene => !value.flags[detourReadFlag(scene.id)]
    && (scene.met || []).every(who => value.met?.[who])
    && (scene.after || []).every(id => value.flags[detourReadFlag(id)]));
}

/**
 * 大会後の東京で、心得の盤で灯した授業を相談できる人と場所（SPEC 2.6・SBD61「灯したら、会える所で相談できる」）。
 * from〜to は CH3_AFTERMATH_SCENES の場面id（その場面を読む前の間だけ開く）。寄り道と同じく stage・日時は進めない。
 * 綾取は煙幕の片づけ（店を畳む朝）の前まで、ましろは閉店後の mukai（翌日の夜）だけ。
 * スティーブの授業（ピザとシーシャの夜）はこの夜に開くので、なるへの報告を読んで開催の夜になったら出さない。
 */
export const CH3_AFTERMATH_LESSONS = Object.freeze([
  { who: "saku", place: "煙幕", bg: "bg_yohaku_shop", from: "ch3_mashiro_recovery", to: "ch3_naru_reconcile" },
  { who: "steve", place: "Smoke & Glory", bg: "bg_steve_shop", from: "ch3_mashiro_recovery", to: "ch3_naru_reconcile" },
  { who: "volk", place: "鉄の煙", bg: "bg_volk_shop", from: "ch3_mashiro_recovery", to: "ch3_enmaku_cleanup" },
  { who: "mashiro", place: "mukai", bg: "bg_mukai_shop", from: "ch3_naru_reconcile", to: "ch3_naru_reconcile" },
]);
const sceneIndex = id => CH3_AFTERMATH_SCENES.findIndex(scene => scene.id === id);

/**
 * いま相談できる大会後の授業。ready(who) はその人の相談できる授業（core/growth.js の readyLessons）。
 * 灯した授業は面識があってこそなので、面識の判定は ready に任せる。保存は変更しない。
 */
export function availableAftermathLessons(value, ready) {
  if (!canRunChapterThreeAftermath(value) || value.flags._ch3_cleared) return [];
  const stage = value.flags._ch3_aftermath?.stage;
  if (!Number.isInteger(stage)) return [];
  return CH3_AFTERMATH_LESSONS
    .filter(entry => stage >= sceneIndex(entry.from) && stage <= sceneIndex(entry.to))
    .filter(entry => !(entry.who === "steve" && value.flags._ch3_naru_party_ready))
    .map(entry => ({ ...entry, lessons: ready(entry.who) || [] }))
    .filter(entry => entry.lessons.length > 0);
}

/**
 * 大会後の東京で読める締めくくり（IR22・#2028）。♥5に届いた次の来店が大会の後になった時も、帰る前に一度だけ読める
 * （台本は大会の前後で分かれる）。窓は二人の授業と同じく、煙幕の片づけ（店を畳む朝・その夜に地元へ帰る）の前まで。
 * スティーブの窓の終わりは daily/bonds.js の STEVE_LAST_AFTERMATH_STAGE に写してある（ch3_aftermath.mjs で照合）。
 * due(who) は daily/bonds.js の finaleDue（♥5・前提の場面・既読）。寄り道と同じく stage・日時は進めず、保存は変更しない。
 */
export const CH3_AFTERMATH_FINALES = Object.freeze([
  { who: "saku", file: "ch3_rivals", dialogue: "ch3_saku_bond_finale", label: "綾取に呼ばれる", place: "煙幕", bg: "bg_yohaku_shop",
    from: "ch3_mashiro_recovery", to: "ch3_naru_reconcile" },
  { who: "steve", file: "ch3_rivals", dialogue: "ch3_steve_bond_finale", label: "スティーブに呼ばれる", place: "Smoke & Glory",
    bg: "bg_steve_shop", from: "ch3_mashiro_recovery", to: "ch3_naru_reconcile" },
]);
export function availableAftermathFinales(value, due) {
  if (!canRunChapterThreeAftermath(value) || value.flags._ch3_cleared) return [];
  const stage = value.flags._ch3_aftermath?.stage;
  if (!Number.isInteger(stage)) return [];
  return CH3_AFTERMATH_FINALES.filter(entry => stage >= sceneIndex(entry.from) && stage <= sceneIndex(entry.to) && !!due(entry.who));
}

/** 寄り道を最後まで読んだ時だけ既読にする。本筋の進行には触れない。 */
export function completeAftermathDetour(value, id) {
  if (!availableAftermathDetours(value).some(scene => scene.id === id)) return false;
  value.flags[detourReadFlag(id)] = true;
  return true;
}

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
