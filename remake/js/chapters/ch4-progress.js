// 第4章（ドバイ）の進行。読了した場面と章内日だけを確定する純粋関数（UIは ch4.js）。
// flags._ch4.day はドバイ到着日を 1 とする章内カウンター。通算の value.day は同じ幅だけ進める。
//
// 日数表（骨格。Q11「訪問ごとの日数消費」が決まったら、日が進む呼び出し箇所だけが変わる）:
//   DAY1 到着日   : プロローグ4場面 → 自由行動（スーク・FESTA・カフェ）→ 宿で終える
//   DAY2〜3       : 自由行動。宿で終える（stranger_second は first を読んだ日 +2日以降に解放）
//   DAY4 前夜     : 自由行動 → 宿で終える = 前夜シーケンス（未読の必須場面を story_routes 順に強制消化）
//   DAY5 大会当日 : tournament_start → 勝敗 →（勝ち）final → 後日談の本線 → 完了
// マップ訪問では日は進まない。進むのは endChapterFourDay（宿でその日を終える）と前夜の終了だけ。

import { MAX_MONEY } from "../core/rules.js";
import { resetChapterFourCraft } from "./ch4-tournament-state.js";

// 大会賞金（2026-10-30 決定の階段式: 第1章30,000円／第2章50,000円／第3章100,000円／第4章200,000円／第5章は賞金なし）。
export const CH4_PRIZE = 200000;

// ---- 背景の対応表（1か所に集約）----------------------------------------------------
// 第4章の場所と場面の背景対応。
export const CH4_PLACE_BG = Object.freeze({
  mosque: "bg_dubai_map_dusk", // 内省の現行代替背景を維持（#1788 の画像選別は別作業）
  map: "bg_dubai_map",            // #1177 選定マップ（ch4_dubai_10・真昼）
  mapDusk: "bg_dubai_map_dusk",   // #1177 候補4（ch4_dubai_04・夕景）。前夜日（DAY4）の自由行動マップに使う
  souq: "bg_street_day",          // 仮置き bg（#1177 でドバイ素材に差し替え）
  festa: "bg_dubai_festa",
  center_cafe: "bg_cafe_day",     // 仮置き bg（#1177 でドバイ素材に差し替え）
  alley_cafe: "bg_dubai_alley_cafe_night",
  inn: "bg_ch3_hotel_night",      // 仮置き bg（#1177 でドバイ素材に差し替え）
  venue: "bg_dubai_grand_smoke_stage",
});

export const CH4_SCENE_BG = Object.freeze({
  ch4_sumi_training: "bg_tonari_inside",          // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_strategy: "bg_tonari_inside",               // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_opening: "bg_street_day",                   // 空港。仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_arrival_inn: "bg_ch3_hotel_night",          // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_dubai_souq: "bg_street_day",                // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_dubai_souq_revisit: "bg_street_day",        // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_stranger_first: "bg_street_day",            // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_stranger_first_forced_in: "bg_street_day",  // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_festa: "bg_dubai_festa",
  ch4_festa_revisit: "bg_dubai_festa",
  ch4_dubai_cafe: "bg_cafe_day",                  // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_dubai_cafe_revisit: "bg_cafe_day",          // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_stranger_second: "bg_dubai_alley_cafe_night",
  ch4_alley_cafe_quiet: "bg_dubai_alley_cafe_night",
  ch4_inn_tool_care: "bg_ch3_hotel_night",        // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_wang_reception_forced_in: "bg_ch3_hotel_night", // 仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_wang_reception: "bg_dubai_grand_smoke_stage",
  ch4_stranger_third: "bg_dubai_alley_cafe_night",
  ch4_tournament_start: "bg_dubai_grand_smoke_stage",
  ch4_final: "bg_dubai_grand_smoke_stage",
  ch4_defeat: "bg_dubai_grand_smoke_stage",
  ch4_result: "bg_dubai_grand_smoke_stage",
  ch4_nagumo_old_rival: "bg_dubai_grand_smoke_stage",
  ch4_ending: "bg_dubai_sheikh_residence",
  ch4_sumi_return: "bg_tonari_inside_night",      // 帰国後のtonari。仮置き bg（#1177 でドバイ素材に差し替え）
  ch4_two_tables: "bg_tonari_inside_night",       // 仮置き bg（#1177 でドバイ素材に差し替え）
});

// ---- BGM の対応表（演出の山だけ切り替える。無い場面は tonari）-------------------------
// ドバイ専用曲が無いので既存曲の流用。#1177 / 専用曲が入ったらこの表だけ直す。
export const CH4_DEFAULT_BGM = "tonari";
export const CH4_SCENE_BGM = Object.freeze({
  ch4_tournament_start: "bgm_tournament_wait",
  ch4_final: "bgm_tournament_craft",
  ch4_defeat: "bgm_aftermath",
  ch4_result: "bgm_judging",
  ch4_nagumo_old_rival: "bgm_aftermath",
  ch4_ending: "bgm_aftermath",
});

// ---- 日数・解放条件 -----------------------------------------------------------------
export const CH4_EVE_DAY = 4;
export const CH4_TOURNAMENT_DAY = 5;
// 仮置き（DRAFT §4）: stranger_second は stranger_first を読んだ日 +2日以降に解放。
export const CH4_SECOND_GAP_DAYS = 2;

// ---- 場面表 -------------------------------------------------------------------------
// プロローグ。並びは data/story_routes.json の before_eve 先頭（出発前2場面→到着）＋宿。
// 章切り替え形式（Q2: 回想化A案／出発前先行B案）が決まったら、入口の見せ方の差し替えは
// advanceToChapterFour とこの表の並びだけ。Q2 未決のため新しい地の文・台詞は足さない。
export const CH4_PROLOGUE = Object.freeze([
  { id: "ch4_sumi_training", label: "出発前のtonari", location: "tonari" },
  { id: "ch4_strategy", label: "持っていく配合", location: "tonari" },
  { id: "ch4_opening", label: "ドバイ到着", location: "空港" },
  { id: "ch4_arrival_inn", label: "宿へ", location: "宿" },
].map(scene => Object.freeze(scene)));

// 前夜までの必須4場面（story_routes の順）。lead は強制発生用の繋ぎ場面。
export const CH4_MANDATORY = Object.freeze([
  { id: "ch4_stranger_first", lead: "ch4_stranger_first_forced_in" },
  { id: "ch4_stranger_second", lead: null },
  { id: "ch4_wang_reception", lead: "ch4_wang_reception_forced_in" },
  { id: "ch4_stranger_third", lead: null },
].map(entry => Object.freeze(entry)));

// 勝ち側の本線。story_routes の on_win は result → ending → nagumo_old_rival → sumi_return → two_tables だが、
// CH4-CONNECTION-DESIGN 要点3「南雲は屋敷・帰国より前」に従い nagumo_old_rival を ending の前に置く。
// （story_routes.json は編集しない。食い違いは PR 報告に明記）
export const CH4_RESOLUTION = Object.freeze([
  { id: "ch4_result", label: "結果発表", location: "大会会場" },
  { id: "ch4_nagumo_old_rival", label: "審査席から", location: "大会会場" },
  { id: "ch4_ending", label: "大会のあと", location: "屋敷" },
  { id: "ch4_sumi_return", label: "帰国後", location: "tonari" },
  { id: "ch4_two_tables", label: "翌週の閉店後", location: "tonari" },
].map(scene => Object.freeze(scene)));

export const CH4_TOURNAMENT_SCENES = Object.freeze({
  start: "ch4_tournament_start", win: "ch4_final", loss: "ch4_defeat",
});

// 自由行動で再生する場面（接続する全ID）。ch4_return（空場面）・恋人線の dubai_evening 系は接続しない。
const FREE_SCENES = Object.freeze({
  souq: "ch4_dubai_souq", souqRevisit: "ch4_dubai_souq_revisit",
  festa: "ch4_festa", festaRevisit: "ch4_festa_revisit",
  cafe: "ch4_dubai_cafe", cafeRevisit: "ch4_dubai_cafe_revisit",
  first: "ch4_stranger_first", second: "ch4_stranger_second", alleyQuiet: "ch4_alley_cafe_quiet",
  toolCare: "ch4_inn_tool_care",
});
export const CH4_FREE_SCENE_IDS = Object.freeze(Object.values(FREE_SCENES));

// 台本の読み込み対象（ch4.js が FILES に使う）。
export const CH4_SCENE_FILES = Object.freeze({
  ch4_main: Object.freeze([
    ...CH4_PROLOGUE.map(scene => scene.id),
    ...CH4_FREE_SCENE_IDS.filter(id => id !== "ch4_dubai_souq" && id !== "ch4_dubai_cafe"),
    ...CH4_MANDATORY.flatMap(entry => [entry.lead, entry.id]).filter(Boolean),
    ...Object.values(CH4_TOURNAMENT_SCENES),
    ...CH4_RESOLUTION.map(scene => scene.id),
  ].filter((id, index, all) => all.indexOf(id) === index)),
  ch4_spots: Object.freeze(["ch4_dubai_souq", "ch4_dubai_cafe"]),
});

// ヒロイン来訪の台本（読込登録だけ）。到着・約束の再生条件は #516 で決めるため、ここでは再生しない。
export const CH4_VISITOR_SCENE_FILES = Object.freeze({
  ch4_mashiro_dubai: Object.freeze(["ch4_mashiro_dubai_friend", "ch4_mashiro_dubai_girlfriend"]),
  ch4_visitors: Object.freeze(["ch4_samechan_dubai_girlfriend", "ch4_hiyori_dubai_girlfriend"]),
  ch4_tsumugi_dubai: Object.freeze(["ch4_tsumugi_dubai_girlfriend"]),
  ch4_minto_dubai: Object.freeze(["ch4_minto_dubai_girlfriend"]),
  ch4_rin_dubai: Object.freeze(["ch4_rin_dubai_girlfriend"]),
  ch4_ageha_dubai: Object.freeze(["ch4_ageha_dubai_girlfriend"]),
});

const PARTS = Object.freeze(["prologue", "free", "eve", "tournament", "resolution", "cleared"]);
const STRATEGY_BRANCHES = Object.freeze(["sakura", "peach", "tea"]);

// ---- 章の入口 -----------------------------------------------------------------------
/** 第3章の後日談まで終えた保存だけ、ドバイの初日へ進める。 */
export function canAdvanceToChapterFour(value) {
  return !!value && value.chapter === 3 && value.phase === "cleared"
    && value.flags?._ch3_cleared === true;
}

/** 第3章→第4章の状態遷移はこの関数だけが行う。 */
export function advanceToChapterFour(value) {
  if (!canAdvanceToChapterFour(value)) return false;
  value.chapter = 4;
  value.day += 1;
  value.slot = 0;
  value.phase = "opening";
  value.statsAtChapterStart = { ...value.stats };
  value.flags._ch4 = { startDay: value.day, day: 1, stage: 0, part: "prologue", titleSeen: false,
    read: {}, firstDay: null, resolution: 0, attempts: 0 };
  // シェイクの正体は ch4_tournament_start で明かされる（DRAFT §3）。それまで表示側は固有名を出さない。
  value.flags._ch4_sheikh_revealed = false;
  return true;
}

/** 保存の形と、part と日付の整合を確認する。不正な保存は throw（状態は変更しない）。 */
export function chapterFourProgress(value) {
  if (value?.chapter !== 4) throw new Error("第4章の保存ではありません");
  const progress = value.flags?._ch4;
  const integer = (number, min, max) => Number.isInteger(number) && number >= min && number <= max;
  const valid = !!progress && integer(progress.startDay, 1, Infinity)
    && integer(progress.day, 1, CH4_TOURNAMENT_DAY)
    && PARTS.includes(progress.part)
    && integer(progress.stage, 0, CH4_PROLOGUE.length)
    && typeof progress.titleSeen === "boolean"
    && !!progress.read && typeof progress.read === "object" && !Array.isArray(progress.read)
    && (progress.firstDay === null || integer(progress.firstDay, 1, progress.day))
    && integer(progress.resolution, 0, CH4_RESOLUTION.length)
    && integer(progress.attempts, 0, Infinity)
    && (progress.part === "prologue"
      ? progress.day === 1 && progress.stage < CH4_PROLOGUE.length
      : progress.stage === CH4_PROLOGUE.length)
    && (progress.part !== "free" || progress.day < CH4_TOURNAMENT_DAY)
    && (progress.part !== "eve" || progress.day === CH4_EVE_DAY)
    && (!["tournament", "resolution", "cleared"].includes(progress.part) || progress.day === CH4_TOURNAMENT_DAY)
    && (progress.part !== "resolution" || progress.resolution < CH4_RESOLUTION.length)
    && ((progress.part === "cleared") === (progress.resolution === CH4_RESOLUTION.length
      && value.flags._ch4_cleared === true));
  if (!valid) throw new Error("第4章の保存地点を確認できません");
  return progress;
}

export const chapterFourRead = (value, id) => chapterFourProgress(value).read[id] === true;

// ---- 秘匿 ---------------------------------------------------------------------------
/** シェイクの固有名を出してよいか。表示切替の条件はこのフラグ1つ。
 *  Q8（再挑戦時の演出短縮）の差し替え点: 再挑戦で冒頭の秘匿演出を飛ばすならここを読む側で分岐する。 */
export const chapterFourSheikhRevealed = value => value?.flags?._ch4_sheikh_revealed === true;

/** ch4_tournament_start を読み始める時点で呼ぶ。 */
export function revealChapterFourSheikh(value) {
  chapterFourProgress(value);
  value.flags._ch4_sheikh_revealed = true;
}

// ---- 自由行動と日 -------------------------------------------------------------------
/** stranger_second を今読めるか。first を読んだ日 +2日以降（仮置き）。first の日付は firstDay。 */
export function chapterFourSecondAvailable(value) {
  const progress = chapterFourProgress(value);
  return progress.part === "free" && progress.read[FREE_SCENES.first] === true
    && progress.read[FREE_SCENES.second] !== true && progress.firstDay !== null
    && progress.day >= progress.firstDay + CH4_SECOND_GAP_DAYS;
}

/** 前夜までに未読の必須場面。story_routes 順。lead は繋ぎ場面（再生済み・不要なら null）。 */
export function chapterFourMandatory(value) {
  const { read } = chapterFourProgress(value);
  return CH4_MANDATORY.filter(entry => read[entry.id] !== true).map(entry => ({
    id: entry.id,
    // first の繋ぎは「スークを一度も選ばずに期限日を迎えた場合だけ」（繋ぎ場面コメントの想定）。
    lead: entry.lead && read[entry.lead] !== true
      && !(entry.id === FREE_SCENES.first && read[FREE_SCENES.souq] === true) ? entry.lead : null,
  }));
}

/** 読了を確定する唯一の入口。今のpartで再生してよい場面だけ受け付ける。 */
export function completeChapterFourScene(value, id) {
  const progress = chapterFourProgress(value);
  const { part } = progress;
  if (part === "prologue") {
    if (CH4_PROLOGUE[progress.stage]?.id !== id) return false;
    progress.read[id] = true;
    progress.stage += 1;
    if (progress.stage === CH4_PROLOGUE.length) {
      progress.part = "free";
      value.phase = "daily";
    }
    return true;
  }
  if (part === "free") {
    const allowed = CH4_FREE_SCENE_IDS.includes(id)
      && (id !== FREE_SCENES.second || chapterFourSecondAvailable(value))
      && (id !== FREE_SCENES.alleyQuiet || progress.read[FREE_SCENES.second] === true)
      && (id !== FREE_SCENES.toolCare || progress.day >= 2);
    if (!allowed) return false;
    progress.read[id] = true;
    if (id === FREE_SCENES.first && progress.firstDay === null) progress.firstDay = progress.day;
    return true;
  }
  if (part === "eve") {
    // story_routes 順の強制消化: 先頭の未読（繋ぎがあれば繋ぎ）だけを確定できる。
    const [target] = chapterFourMandatory(value);
    if (!target || id !== (target.lead || target.id)) return false;
    progress.read[id] = true;
    if (id === FREE_SCENES.first && progress.firstDay === null) progress.firstDay = progress.day;
    return true;
  }
  if (part === "tournament") {
    if (![CH4_TOURNAMENT_SCENES.start, CH4_TOURNAMENT_SCENES.win, CH4_TOURNAMENT_SCENES.loss].includes(id)) return false;
    if (id !== CH4_TOURNAMENT_SCENES.start && progress.read[CH4_TOURNAMENT_SCENES.start] !== true) return false;
    if (id === CH4_TOURNAMENT_SCENES.win && chapterFourTournamentOutcome(value) !== "win") return false;
    if (id === CH4_TOURNAMENT_SCENES.loss && chapterFourTournamentOutcome(value) !== "loss") return false;
    progress.read[id] = true;
    if (id === CH4_TOURNAMENT_SCENES.win) {
      // 賞金は勝利の確定と同じ更新で一度だけ渡す（再読・LOADで二重に付けない）。
      if (!progress.prizePaid) {
        progress.prizePaid = true;
        value.money = Math.min(MAX_MONEY, Math.max(0, Math.round((value.money || 0) + CH4_PRIZE)));
      }
      progress.part = "resolution";
      progress.resolution = 0;
      value.phase = "aftermath";
    }
    return true;
  }
  if (part === "resolution") {
    if (CH4_RESOLUTION[progress.resolution]?.id !== id) return false;
    progress.read[id] = true;
    progress.resolution += 1;
    if (progress.resolution === CH4_RESOLUTION.length) {
      progress.part = "cleared";
      value.flags._ch4_cleared = true;
      value.phase = "cleared";
    }
    return true;
  }
  return false;
}

/** 日を進める処理はここ1か所。Q11（移動の日数消費）が決まったら、この関数の呼び出し箇所だけが変わる。 */
function advanceChapterFourDay(value, progress) {
  progress.day += 1;
  value.day += 1;
  value.slot = 0;
}

/** 宿でその日を終える。DAY1〜3は翌日へ、DAY4は前夜シーケンスへ。マップ訪問では呼ばない。 */
export function endChapterFourDay(value) {
  const progress = chapterFourProgress(value);
  if (progress.part !== "free") return null;
  if (progress.day < CH4_EVE_DAY) {
    advanceChapterFourDay(value, progress);
    return "next_day";
  }
  progress.part = "eve";
  value.slot = 1;
  return "eve";
}

/** 必須場面を読み終えた前夜を閉じ、大会日へ。日を進めるのは advanceChapterFourDay だけ。 */
export function finishChapterFourEve(value) {
  const progress = chapterFourProgress(value);
  if (progress.part !== "eve" || chapterFourMandatory(value).length) return false;
  advanceChapterFourDay(value, progress);
  progress.part = "tournament";
  value.phase = "tournament";
  return true;
}

// ---- 大会 ---------------------------------------------------------------------------
/** 未制作・中断は未確定。実制作の確定結果だけを読む。 */
export function chapterFourTournamentOutcome(value) {
  const result = chapterFourProgress(value).match?.result;
  return result ? result.win === true ? "win" : "loss" : null;
}

/**
 * 敗北（ch4_defeat を読んだ後）に必ず通る1関数。
 * ※仮置き（Q5・Q7 未決）: data/story_routes.json の progression_contract.loss
 * 「第3・4章の敗北はその競技から再挑戦」に沿う暫定形で、大会の最初に戻すだけ。
 * 再開位置と理屈は Q7 で差し替える。Q5 の B案・C案は実装しない。
 * シェイクの秘匿フラグは戻さない（Q8: 再挑戦時の演出短縮の差し替え点）。
 */
export function chapterFourAfterDefeat(value) {
  const progress = chapterFourProgress(value);
  if (progress.part !== "tournament" || progress.read[CH4_TOURNAMENT_SCENES.loss] !== true) return false;
  if (!resetChapterFourCraft(value)) return false;
  for (const id of Object.values(CH4_TOURNAMENT_SCENES)) delete progress.read[id];
  progress.attempts += 1;
  return true;
}

// ---- 方針の選択 ---------------------------------------------------------------------
/** ch4_strategy の選択（桜・桃・茶）。制作の支給葉と実配合の講評に使う。 */
export function recordChapterFourStrategy(value, branch) {
  chapterFourProgress(value);
  if (!STRATEGY_BRANCHES.includes(branch)) return false;
  value.flags._ch4_strategy = branch;
  return true;
}
