import { syncTokyoVisits } from "../core/tokyo-visits.js";
// 全国大会の勝利後だけ進む第3章の後日談。大会の順位・報酬はここでは変更しない。
export const CH3_AFTERMATH_SCENES = Object.freeze([
  // 優勝の夜は滞在先のmukaiの奥の部屋（#1485・#1899）。奥の部屋専用の背景は無いので店内の既存背景を使う。
  { id: "ch3_abyss_hotel", dayAfterWin: 0, slot: 1, label: "優勝の夜", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_mashiro_recovery", dayAfterWin: 1, slot: 0, label: "いつもの席", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_naru_reconcile", dayAfterWin: 1, slot: 1, label: "自分からの報告", location: "東京", bg: "bg_mukai_shop" },
  { id: "ch3_enmaku_cleanup", dayAfterWin: 2, slot: 0, label: "煙幕の片づけ", location: "煙幕", bg: "bg_yohaku_shop" },
  // 帰郷した夜は三場面（STK23・全体講評C5）。新幹線を降りた足でMELTY PUFF、tonariでつむぎの絵、最後に帰郷の客。
  // 章の最後の画を「客の返事を待つ」にする。homecoming=新幹線の車窓を見せる最初の地元の場面。
  { id: "ch3_ageha_reunion", dayAfterWin: 2, slot: 1, label: "続いていた約束", location: "MELTY PUFF", bg: "bg_ageha_shop", homecoming: true },
  { id: "ch3_tsumugi_result", dayAfterWin: 2, slot: 1, label: "つむぎの絵", location: "tonari", bg: "bg_tonari_inside_night" },
  { id: "ch3_home_customer", dayAfterWin: 2, slot: 1, label: "帰郷した夜", location: "tonari", bg: "bg_tonari_inside_night" },
]);
/** 版3の並び（帰郷の客→つむぎ→翌日のあげは）。版3の保存を版4へ読み替える時だけ使う。 */
const V3_SCENE_IDS = Object.freeze(["ch3_abyss_hotel", "ch3_mashiro_recovery", "ch3_naru_reconcile", "ch3_enmaku_cleanup",
  "ch3_home_customer", "ch3_tsumugi_result", "ch3_ageha_reunion"]);

/**
 * 大会後の寄り道（#2028 残件3・#1658 ⑥）。優勝の翌日から煙幕の片づけまで、東京にいる間の場面カードから一度ずつ読める。
 * 読んでも stage・日時は進めない。既読は大会前の寄り道と同じ _ch3_read_<id>（ch3-story-wiring.js の optionalReadFlag）。
 * file=台詞ファイル、met=面識がある人物だけ、after=この寄り道を読んでから（順に読む）。
 */
export const CH3_AFTERMATH_DETOURS = Object.freeze([
  { id: "ch3_mukai_after_tournament", file: "ch3_mukai", label: "閉店前のカウンター", location: "mukai", bg: "bg_mukai_shop" },
  // 大会前に客席の噂を聞いた保存だけ。任意場面と同じ既読フラグで LOAD・再訪時の再生を防ぐ。
  { id: "ch3_cigarman_trace", file: "ch3_mukai", label: "大会後の客席", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_cigarman_rumor"] },
  // エミルは大会当日に名乗る審査員。体験会の台本は大会前の寄り道にもあるが、面識の条件で大会後にしか開かない。
  { id: "ch3_emil_workshop", file: "ch3_rivals", label: "エミルの体験会", location: "東京", bg: "bg_street_day", met: ["emil"] },
  // 鉄の煙の再訪（IR23）。初来店（DAY12夜）から大会までは行動が一つしかないので、大会前に読めなかった分を大会後にも順に読める。
  // 台本は大会に触れない店の話なので、大会の前後どちらで読んでも通る。好感度は台本の報酬（任意の場面だけ。必須の初来店には付けない）。
  { id: "ch3_volk_second", file: "ch3_volk", label: "鉄の煙の二度目", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"] },
  { id: "ch3_volk_third", file: "ch3_volk", label: "七年分の記録", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"], after: ["ch3_volk_second"] },
  { id: "ch3_volk_fourth", file: "ch3_volk", label: "頷く順番", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"], after: ["ch3_volk_third"] },
  { id: "ch3_volk_after_ch3", file: "ch3_volk", label: "大会のあとの記録", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"] },
  // ヴォルクとLIMEを交換する（#2028）。大会前の寄り道と同じく、四度目の来店の後・♥2で（ヴォルクの締めくくりの条件）。
  { id: "ch3_volk_lime", file: "ch3_volk", label: "持ってきたメモ", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"],
    after: ["ch3_volk_fourth"], heart: { volk: 2 } },
  { id: "ch3_volk_fifth", file: "ch3_volk", label: "残る理由", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"],
    after: ["ch3_volk_lime"], heart: { volk: 4 } },
  { id: "ch3_volk_revisit", file: "ch3_volk", label: "残した一項", location: "鉄の煙", bg: "bg_volk_shop", met: ["volk"],
    after: ["ch3_volk_fifth"], heart: { volk: 4 } },
  // 好感度補充。大会前に読めなかった煙幕・Smoke & Glory の段階を、帰郷前に順に読める。
  { id: "ch3_saku_missed", file: "ch3_rivals", label: "外れた予想", location: "煙幕", bg: "bg_yohaku_shop",
    after: ["ch3_saku_lime"], heart: { saku: 2 } },
  { id: "ch3_saku_cleanup", file: "ch3_rivals", label: "消すのを遅くする", location: "煙幕", bg: "bg_yohaku_shop",
    after: ["ch3_saku_missed"], heart: { saku: 3 } },
  { id: "ch3_saku_liar", file: "ch3_rivals", label: "嘘つきの欄", location: "煙幕", bg: "bg_yohaku_shop",
    after: ["ch3_saku_cleanup"], heart: { saku: 4 } },
  { id: "ch3_saku_first_reply", file: "ch3_rivals", label: "最初の返事", location: "煙幕", bg: "bg_yohaku_shop",
    after: ["ch3_saku_liar"], heart: { saku: 4 } },
  { id: "ch3_steve_two_timers", file: "ch3_rivals", label: "二つのタイマー", location: "Smoke & Glory", bg: "bg_steve_shop",
    met: ["steve"], heart: { steve: 1 } },
  { id: "ch3_steve_empty_seat", file: "ch3_rivals", label: "空の席の秒数", location: "Smoke & Glory", bg: "bg_steve_shop",
    met: ["steve"], after: ["ch3_steve_two_timers"], heart: { steve: 3 } },
  { id: "ch3_steve_tongs", file: "ch3_rivals", label: "トングの手前", location: "Smoke & Glory", bg: "bg_steve_shop",
    met: ["steve"], after: ["ch3_steve_empty_seat"], heart: { steve: 4 } },
  { id: "ch3_steve_watch", file: "ch3_rivals", label: "伏せたタイマー", location: "Smoke & Glory", bg: "bg_steve_shop",
    met: ["steve"], after: ["ch3_steve_tongs"], heart: { steve: 4 } },
  // #3081。大会前に読めなかったましろの段階の続き。台本は大会に触れないので、前後どちらの読了でも同じ。
  // 既読は大会前の寄り道と同じ _ch3_read_<id>。続く2本は glass_cloth の次へつなぐ。
  { id: "ch3_mashiro_timer_side", file: "ch3_mashiro", label: "タイマーの隣", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_mashiro_play_3", "ch3_mashiro_practice", "ch3_mashiro_black_tea"] },
  { id: "ch3_mashiro_cup_warm", file: "ch3_mashiro", label: "カップの底", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_mashiro_timer_side"] },
  { id: "ch3_mashiro_glass_cloth", file: "ch3_mashiro", label: "布巾のまま", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_mashiro_cup_warm"] },
  // #3081。大会前に読めなかった分を、優勝の翌日から同じ順で。台本は大会に触れない。
  { id: "ch3_mashiro_leaf_rest", file: "ch3_mashiro", label: "ふわって置く", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_mashiro_glass_cloth"] },
  { id: "ch3_mashiro_bench_tea", file: "ch3_mashiro", label: "裏口のベンチ", location: "mukai", bg: "bg_mukai_shop",
    after: ["ch3_mashiro_leaf_rest"] },
  // #3468 G案。ムカイさん×ヨルの開店前の曲順。大会前に読めなかった時だけ、同じ既読で。台本は大会に触れない。好感度は動かさない。
  { id: "ch3_mukai_yoru_playlist", file: "ch3_mukai", label: "昼の曲順", location: "mukai", bg: "bg_mukai_shop", met: ["yoru"] },
]);
/**
 * 好感度の段階（♥）の下限。core/stats.js の AFFINITY_RANK_PTS の写し（vm で読む試験の依存を増やさない。ch3_aftermath.mjs で照合）。
 * heart=その人物の通常好感度がこの段階以上の時だけ出す（大会前の寄り道 ch3-story-wiring.js の heart と同じ）。
 */
export const AFTERMATH_HEART_PTS = Object.freeze([0, 9, 20, 33, 48, 66]);
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
    && (scene.after || []).every(id => value.flags[detourReadFlag(id)])
    && Object.entries(scene.heart || {}).every(([who, level]) => (value.affinity?.[who] || 0) >= AFTERMATH_HEART_PTS[level]));
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
 * （台本は大会の前後で分かれる）。窓はそれぞれの授業と同じく、綾取・スティーブは煙幕の片づけ（店を畳む朝・その夜に
 * 地元へ帰る）の前まで、ヴォルクは片づけの朝まで。窓の終わりは daily/bonds.js の *_LAST_AFTERMATH_STAGE に写してある
 * （ch3_aftermath.mjs で照合）。
 * due(who) は daily/bonds.js の finaleDue（♥5・前提の場面・既読）。寄り道と同じく stage・日時は進めず、保存は変更しない。
 */
export const CH3_AFTERMATH_FINALES = Object.freeze([
  { who: "saku", file: "ch3_rivals", dialogue: "ch3_saku_bond_finale", label: "綾取に呼ばれる", place: "煙幕", bg: "bg_yohaku_shop",
    from: "ch3_mashiro_recovery", to: "ch3_naru_reconcile" },
  { who: "steve", file: "ch3_rivals", dialogue: "ch3_steve_bond_finale", label: "スティーブに呼ばれる", place: "Smoke & Glory",
    bg: "bg_steve_shop", from: "ch3_mashiro_recovery", to: "ch3_naru_reconcile" },
  // ヴォルク（#2028）の窓は、鉄の煙の寄り道・授業と同じく煙幕の片づけの朝まで（daily/bonds.js の VOLK_LAST_AFTERMATH_STAGE）。
  // after＝先に読む寄り道。大会後に初めて鉄の煙へ寄る場面（「大会、お疲れ様でした」）より先に締めくくりを出さない。
  { who: "volk", file: "ch3_volk", dialogue: "ch3_volk_bond_finale", label: "ヴォルクに呼ばれる", place: "鉄の煙",
    bg: "bg_volk_shop", from: "ch3_mashiro_recovery", to: "ch3_enmaku_cleanup", after: ["ch3_volk_after_ch3"] },
]);
export function availableAftermathFinales(value, due) {
  if (!canRunChapterThreeAftermath(value) || value.flags._ch3_cleared) return [];
  const stage = value.flags._ch3_aftermath?.stage;
  if (!Number.isInteger(stage)) return [];
  return CH3_AFTERMATH_FINALES.filter(entry => stage >= sceneIndex(entry.from) && stage <= sceneIndex(entry.to)
    && (entry.after || []).every(id => value.flags[detourReadFlag(id)]) && !!due(entry.who));
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
  const progress = value.flags._ch3_aftermath = { version: 4, winDay: value.day, stage: 0 };
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
  // 帰郷した夜を並べ替えた（版4・STK23）。帰郷の夜を読みかけの保存は、まだ読んでいないあげはの再会から読み、
  // 読み終えた場面は skip に残して二度読ませない。日時は戻さない。
  if (progress?.version === 3 && Number.isInteger(progress.stage) && progress.stage >= 0 && progress.stage <= V3_SCENE_IDS.length) {
    const home = V3_SCENE_IDS.indexOf("ch3_home_customer");
    if (progress.stage > home && progress.stage < V3_SCENE_IDS.length) {
      progress.skip = V3_SCENE_IDS.slice(home, progress.stage);
      progress.stage = CH3_AFTERMATH_SCENES.findIndex(scene => scene.homecoming);
    }
    progress.version = 4;
  }
  if (!progress || progress.version !== 4 || !Number.isInteger(progress.winDay) || progress.winDay < 1
    || !Number.isInteger(progress.stage) || progress.stage < 0 || progress.stage > CH3_AFTERMATH_SCENES.length
    || (progress.skip !== undefined && !(Array.isArray(progress.skip)
      && progress.skip.every(id => CH3_AFTERMATH_SCENES.some(scene => scene.id === id))))
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
  while (progress.skip?.includes(CH3_AFTERMATH_SCENES[progress.stage]?.id)) progress.stage += 1;
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
