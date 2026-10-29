// 第5章（機械仕掛けの神）の進行。読了した場面と日程・勝敗だけを確定する純粋関数（UIは ch5.js）。
// 第4章からの帰郷後、大須・tonari で SHISHA-9000 との勝負に至る流れを場面単位で管理する。
//
// 流れ（骨格）:
//   prologue   : 橋渡し → 帰郷 → 自由行動へ
//   free       : tonari の自由場面（任意）→「博士に連絡する」で日程の場面へ
//     prep     : 「閉店後の練習」のあと、試作→スミさんの返答→再調整の選択（#1666。結果は試合と後日談に返る）
//     decide   : 日程が決まる → scheduled へ（自由行動の日は挟まない。Q15）
//     defer    : ch5_timeout を読んで free に戻る（日程は未定のまま）
//   scheduled  : 「会場へ行く」の確認でだけ試合へ。取り消しは ch5_timeout を読んで free へ戻る
//   match      : 会場入り → 一杯目 → 二杯目の前 → 二本目の制作（recordChapterFiveSecondCup）
//                → 観客の挙手の合計で勝敗 →（勝ち）余韻／（負け・同数）そのまま後日談へ
//   aftermath  : 博士の後日談 → tonari へ戻る
//   finale     : ending の3場面（開始 → 中間 → 日常）→ cleared
//
// 触らないもの（オーナー判断待ち）:
//   Q13 会場の固有名・Q14 客席の台詞は台本側が空白のまま。表示名は「会場」で固定する。
//   Q17 reflection は既存エンジンが処理するので、ここでは場面の順序だけを持つ。
//   Q20 スタッフロール後段（selectPostEndingConflict）は接続しない。
//   ch5_dream_in / ch5_dream_out は挿入位置が未決のため接続しない（対象外）。
//   ch5_reflection_placeholder はテスト専用なので接続しない。

// ---- 背景の対応表（1か所に集約）----------------------------------------------------
// 第5章専用の背景が無いので、全て既存 bg の流用。素材が届いたらこの表だけ直す。
export const CH5_SCENE_BG = Object.freeze({
  ch5_bridge_after_return: "bg_tonari_inside_night", // 仮置き bg
  ch5_opening: "bg_osu_map_finale",                  // #1177 選定マップ（ch5_osu_07・夜／帰郷場面）
  ch5_free: "bg_osu_map_finale",                     // #1177 選定マップ（ch5_osu_07・夜／自由行動カード画面）
  ch5_unrecorded_day: "bg_tonari_inside_day",        // 仮置き bg
  ch5_free_mashiro_visit: "bg_tonari_inside_day",    // 仮置き bg（台本コメント: tonari・昼）
  ch5_free_first_visitor: "bg_tonari_inside",        // 仮置き bg（台本コメント: tonari・夕）
  ch5_free_tonari_practice: "bg_tonari_inside_night", // 仮置き bg（台本コメント: tonari・夜）
  ch5_prep_trial_heat: "bg_tonari_inside_night",     // 仮置き bg（閉店後の試作。以下 ch5_prep_* も同じ）
  ch5_prep_trial_pack: "bg_tonari_inside_night",
  ch5_prep_trial_aroma: "bg_tonari_inside_night",
  ch5_prep_adjust_heat: "bg_tonari_inside_night",
  ch5_prep_adjust_pack: "bg_tonari_inside_night",
  ch5_prep_adjust_aroma: "bg_tonari_inside_night",
  ch5_prep_keep: "bg_tonari_inside_night",
  ch5_schedule_contact: "bg_tonari_inside_night",    // 仮置き bg（閉店後の場面）
  ch5_timeout: "bg_tonari_inside_night",             // 仮置き bg
  ch5_match_day_arrival: "bg_tonari_inside_day",      // 休業日の朝の店から始まる場面なので tonari・昼（Q13: 会場の固有名は出さない）
  ch5_copy_first_cup: "bg_tournament_stage",         // 仮置き bg
  ch5_relationship_before_second_cup: "bg_tournament_stage", // 仮置き bg
  ch5_second_cup_result: "bg_tournament_stage",      // 仮置き bg
  ch5_second_cup_result_afterglow: "bg_tournament_stage", // 仮置き bg
  ch5_second_cup_defeat: "bg_tournament_stage",      // 仮置き bg
  ch5_prep_recall_heat_adjusted: "bg_tournament_stage", // 二杯目の前の末尾に続く（表示は親場面の bg）
  ch5_prep_recall_heat_kept: "bg_tournament_stage",
  ch5_prep_recall_pack_adjusted: "bg_tournament_stage",
  ch5_prep_recall_pack_kept: "bg_tournament_stage",
  ch5_prep_recall_aroma_adjusted: "bg_tournament_stage",
  ch5_prep_recall_aroma_kept: "bg_tournament_stage",
  ch5_doctor_after_match: "bg_tournament_stage",     // 仮置き bg
  ch5_return_to_tonari: "bg_tonari_inside_night",    // 仮置き bg
  ch5_prep_answer_heat_adjusted: "bg_tonari_inside_night", // 帰店後の末尾に続く（表示は親場面の bg）
  ch5_prep_answer_heat_kept: "bg_tonari_inside_night",
  ch5_prep_answer_pack_adjusted: "bg_tonari_inside_night",
  ch5_prep_answer_pack_kept: "bg_tonari_inside_night",
  ch5_prep_answer_aroma_adjusted: "bg_tonari_inside_night",
  ch5_prep_answer_aroma_kept: "bg_tonari_inside_night",
  ending_start: "bg_tonari_inside_night",            // 仮置き bg
  ending_normal: "bg_tonari_inside_night",           // 仮置き bg
  epilogue_tsumugi: "bg_tonari_inside_night",        // 仮置き bg
  epilogue_minto: "bg_tonari_inside_night",          // 仮置き bg
  epilogue_rin: "bg_tonari_inside_night",            // 仮置き bg
  epilogue_ageha: "bg_tonari_inside_night",          // 仮置き bg
  epilogue_mashiro: "bg_tonari_inside_night",        // 仮置き bg
  epilogue_samechan: "bg_tonari_inside_night",       // 仮置き bg
  epilogue_hiyori: "bg_tonari_inside_night",         // 仮置き bg
  ending_daily_smoke: "bg_tonari_inside",            // 台本メタデータの指定（bg_tonari_inside）に一致
});

// ---- 場面表 -------------------------------------------------------------------------
// プロローグ。橋渡しの位置は※仮置き（CH4-CONNECTION-DESIGN。ch4_two_tables の後という説もある）。
// ch5_opening は data/story_routes.json の before_match[0] と一致させる。
export const CH5_PROLOGUE = Object.freeze([
  { id: "ch5_bridge_after_return", label: "ドバイのあと", location: "tonari" },
  { id: "ch5_opening", label: "帰郷", location: "大須" },
].map(scene => Object.freeze(scene)));

// 自由行動で再生する場面。昼→夕→夜の順に1回ずつ（台本コメントの時間帯に合わせる）。
export const CH5_FREE_SCENES = Object.freeze([
  { id: "ch5_free_mashiro_visit", label: "ましろの訪問", location: "tonari" },
  { id: "ch5_free_first_visitor", label: "初めての客", location: "tonari" },
  { id: "ch5_free_tonari_practice", label: "閉店後の練習", location: "tonari" },
].map(scene => Object.freeze(scene)));

// 閉店後の試作（#1666）。「閉店後の練習」を読んだあと、何を試すか→スミさんが吸って返す→
// 直すか、そのまま手に覚えさせるかを選ぶ。能力値・日・体力は動かさない（成長は自由行動のみ。
// 日数・体力の消費は Q11 のオーナー判断待ち）。選んだ内容は二杯目の前と帰店後の会話に返る。
const PREP_PRACTICE = "ch5_free_tonari_practice";
export const CH5_PREP_TRIALS = Object.freeze([
  { id: "heat", label: "炭を一つ減らして、温度を抑える", point: "柔らかいが、最初の三口が薄い。", adjust: "蒸らしを足して、もう一台" },
  { id: "pack", label: "詰めをふんわりにして、軽くする", point: "軽いが、炭を寄せたら一気に焦げる。", adjust: "炭を縁へ逃がして、もう一台" },
  { id: "aroma", label: "立ち上がりの香りを、強く出す", point: "派手だが、一時間吸う客には重い。", adjust: "炭を一つ離して、もう一台" },
].map(trial => Object.freeze(trial)));
const PREP_TRIAL_IDS = CH5_PREP_TRIALS.map(trial => trial.id);
const prepEchoId = (kind, prep) => `ch5_prep_${kind}_${prep.trial}_${prep.adjusted ? "adjusted" : "kept"}`;
const PREP_ECHO_IDS = ["recall", "answer"].flatMap(kind => PREP_TRIAL_IDS.flatMap(trial =>
  [true, false].map(adjusted => prepEchoId(kind, { trial, adjusted }))));
/** 試作の場面ID（試す／直す／そのまま）。 */
export const chapterFivePrepScene = (step, trial) => step === "keep" ? "ch5_prep_keep" : `ch5_prep_${step}_${trial}`;

// 試合当日の場面（story_routes の first_cup / second_cup / on_win / on_loss_or_tie に対応）。
export const CH5_MATCH_SCENES = Object.freeze({
  arrival: "ch5_match_day_arrival",
  firstCup: "ch5_copy_first_cup",
  beforeSecond: "ch5_relationship_before_second_cup",
  win: "ch5_second_cup_result",
  afterglow: "ch5_second_cup_result_afterglow",
  loss: "ch5_second_cup_defeat",
});

// 後日談（story_routes の after_match と同じ順）。
export const CH5_AFTERMATH = Object.freeze([
  { id: "ch5_doctor_after_match", label: "勝負のあと", location: "会場" },
  { id: "ch5_return_to_tonari", label: "tonariへ戻る", location: "tonari" },
].map(scene => Object.freeze(scene)));

// フィナーレで再生しうる ending の全場面。ending_relationship_pending は
// スタッフロール後段（Q20）側なので含めない。
export const CH5_ENDING_IDS = Object.freeze([
  "ending_start", "ending_normal",
  "epilogue_tsumugi", "epilogue_minto", "epilogue_rin", "epilogue_ageha",
  "epilogue_mashiro", "epilogue_samechan", "epilogue_hiyori",
  "ending_daily_smoke",
]);

// 台本の読み込み対象（ch5.js が FILES に使う）。夢の2場面とテスト専用場面は接続しない。
export const CH5_SCENE_FILES = Object.freeze({
  ch5_main: Object.freeze([
    ...CH5_PROLOGUE.map(scene => scene.id),
    "ch5_unrecorded_day",
    ...CH5_FREE_SCENES.map(scene => scene.id),
    ...PREP_TRIAL_IDS.flatMap(trial => [chapterFivePrepScene("trial", trial), chapterFivePrepScene("adjust", trial)]),
    chapterFivePrepScene("keep"), ...PREP_ECHO_IDS,
    "ch5_schedule_contact", "ch5_timeout",
    ...Object.values(CH5_MATCH_SCENES),
    ...CH5_AFTERMATH.map(scene => scene.id),
  ].filter((id, index, all) => all.indexOf(id) === index)),
  ending: CH5_ENDING_IDS,
});

const PARTS = Object.freeze(["prologue", "free", "scheduled", "match", "aftermath", "finale", "cleared"]);
const SCHEDULE_BRANCHES = Object.freeze(["decide", "defer"]);
const FINALE_LENGTH = 3;

/** フィナーレの3場面として正しい並びか（先頭は開始、末尾は日常、全て既知の場面）。 */
function isValidFinaleScenes(scenes) {
  return Array.isArray(scenes) && scenes.length === FINALE_LENGTH
    && scenes.every(id => CH5_ENDING_IDS.includes(id))
    && scenes[0] === "ending_start" && scenes[FINALE_LENGTH - 1] === "ending_daily_smoke";
}

// ---- 章の入口 -----------------------------------------------------------------------
/** 第4章の勝ち側の本線まで終えた保存だけ、帰郷後の初日へ進める。 */
export function canAdvanceToChapterFive(value) {
  return !!value && value.chapter === 4 && value.phase === "cleared"
    && value.flags?._ch4_cleared === true;
}

/** 第4章→第5章の状態遷移はこの関数だけが行う。 */
export function advanceToChapterFive(value) {
  if (!canAdvanceToChapterFive(value)) return false;
  value.chapter = 5;
  value.day += 1;
  value.slot = 0;
  value.phase = "opening";
  value.statsAtChapterStart = { ...value.stats };
  value.flags._ch5 = { startDay: value.day, stage: 0, part: "prologue", titleSeen: false,
    read: {}, scheduleDecision: null, aftermath: 0, finale: 0, finaleScenes: null, won: null,
    secondCup: null };
  // 台本コメントが名指しする日程フラグ。進行との対応は chapterFiveProgress が検証する。
  value.flags._ch5_match_scheduled = false;
  value.flags._ch5_match_started = false;
  return true;
}

/** 保存の形と、part と各種フラグの整合を確認する。不正な保存は throw（状態は変更しない）。 */
export function chapterFiveProgress(value) {
  if (value?.chapter !== 5) throw new Error("第5章の保存ではありません");
  const progress = value.flags?._ch5;
  const integer = (number, min, max) => Number.isInteger(number) && number >= min && number <= max;
  const valid = !!progress && integer(progress.startDay, 1, Infinity)
    && PARTS.includes(progress.part)
    && integer(progress.stage, 0, CH5_PROLOGUE.length)
    && (progress.part === "prologue" ? progress.stage < CH5_PROLOGUE.length
      : progress.stage === CH5_PROLOGUE.length)
    && typeof progress.titleSeen === "boolean"
    && !!progress.read && typeof progress.read === "object" && !Array.isArray(progress.read)
    && (progress.scheduleDecision === null || SCHEDULE_BRANCHES.includes(progress.scheduleDecision))
    && integer(progress.aftermath, 0, CH5_AFTERMATH.length)
    && (progress.part === "aftermath" ? progress.aftermath < CH5_AFTERMATH.length
      : !["finale", "cleared"].includes(progress.part) || progress.aftermath === CH5_AFTERMATH.length)
    && integer(progress.finale, 0, FINALE_LENGTH)
    && (progress.part !== "finale" || progress.finale < FINALE_LENGTH)
    && (progress.part !== "cleared" || progress.finale === FINALE_LENGTH)
    && (["prologue", "free", "scheduled", "match", "aftermath"].includes(progress.part)
      || progress.finaleScenes !== null || progress.finale === 0)
    && (progress.finaleScenes === null || isValidFinaleScenes(progress.finaleScenes))
    && (progress.part !== "finale" || progress.finaleScenes === null || isValidFinaleScenes(progress.finaleScenes))
    && (progress.part !== "cleared" || isValidFinaleScenes(progress.finaleScenes))
    && (progress.part !== "finale" || progress.finaleScenes !== null || progress.finale === 0)
    && (progress.won === null || progress.won === true || progress.won === false)
    // 二本目の記録より前の保存（勝ち固定だった頃）には secondCup が無い。無い／null は未制作として読む。
    && (progress.secondCup == null || isValidSecondCup(progress.secondCup))
    && (progress.secondCup == null || progress.won === null
      || progress.won === (secondCupOutcome(progress.secondCup) === "win"))
    && (!["aftermath", "finale", "cleared"].includes(progress.part) || progress.won !== null)
    && ((progress.part === "scheduled") === (value.flags._ch5_match_scheduled === true
      && value.flags._ch5_match_started !== true)
      || ["match", "aftermath", "finale", "cleared"].includes(progress.part))
    && (progress.part !== "scheduled" || value.flags._ch5_match_scheduled === true)
    && (!["match", "aftermath", "finale", "cleared"].includes(progress.part)
      || (value.flags._ch5_match_scheduled === true && value.flags._ch5_match_started === true))
    && (!["prologue", "free"].includes(progress.part)
      || (value.flags._ch5_match_scheduled !== true && value.flags._ch5_match_started !== true))
    && (progress.part !== "prologue" || progress.scheduleDecision === null)
    && ((progress.part === "cleared") === (value.flags._ch5_cleared === true))
    // 試作の記録は任意（旧保存には無い）。あるときは「閉店後の練習」の読了後に限る。
    && (progress.prep === undefined || (!!progress.prep && typeof progress.prep === "object"
      && PREP_TRIAL_IDS.includes(progress.prep.trial)
      && [null, true, false].includes(progress.prep.adjusted) && progress.read[PREP_PRACTICE] === true));
  if (!valid) throw new Error("第5章の保存地点を確認できません");
  return progress;
}

export const chapterFiveRead = (value, id) => chapterFiveProgress(value).read[id] === true;

// ---- 自由行動と日程 -----------------------------------------------------------------
/** free のあいだ未読の自由場面（昼→夕→夜の順）。free 以外では空。 */
export function chapterFiveFreeRemaining(value) {
  const progress = chapterFiveProgress(value);
  if (progress.part !== "free") return [];
  return CH5_FREE_SCENES.filter(scene => progress.read[scene.id] !== true);
}

// ---- 閉店後の試作（#1666）-------------------------------------------------------------
/** 試作の記録（{ trial, adjusted }）の写し。未着手なら null。決戦の判定（#1665）の受け口もここ。 */
export function chapterFivePreparation(value) {
  const { prep } = chapterFiveProgress(value);
  return prep ? { ...prep } : null;
}

/** 「閉店後の練習」を読んだが、試作か再調整の選択が済んでいない自由行動か。 */
export function chapterFivePrepPending(value) {
  const progress = chapterFiveProgress(value);
  return progress.part === "free" && progress.read[PREP_PRACTICE] === true
    && (progress.prep === undefined || progress.prep.adjusted === null);
}

/** 試作の場面を読み終えたら、何を試したかを保存する。 */
export function recordChapterFivePrepTrial(value, trial) {
  const progress = chapterFiveProgress(value);
  if (!chapterFivePrepPending(value) || progress.prep !== undefined || !PREP_TRIAL_IDS.includes(trial)) return false;
  progress.prep = { trial, adjusted: null };
  return true;
}

/** スミさんの返答を受けて、直したか（true）そのまま覚えたか（false）を保存する。 */
export function recordChapterFivePrepAdjustment(value, adjusted) {
  const progress = chapterFiveProgress(value);
  if (!chapterFivePrepPending(value) || progress.prep === undefined || typeof adjusted !== "boolean") return false;
  progress.prep.adjusted = adjusted;
  return true;
}

/**
 * 場面の末尾に続けて読む、試作の返り（二杯目の前の手応え／帰店後のスミさんの返答）。
 * 試作と再調整を終えた保存だけ。勝敗はここでは決めない（#1665）。
 */
export function chapterFivePrepEcho(value, id) {
  const { prep } = chapterFiveProgress(value);
  if (!prep || prep.adjusted === null) return [];
  if (id === CH5_MATCH_SCENES.beforeSecond) return [prepEchoId("recall", prep)];
  if (id === CH5_AFTERMATH[CH5_AFTERMATH.length - 1].id) return [prepEchoId("answer", prep)];
  return [];
}

/** 連絡で先送りを選んだ直後の保存か（復帰時に ch5_timeout を先に消化するための判定）。 */
export function chapterFiveTimeoutPending(value) {
  const progress = chapterFiveProgress(value);
  return progress.part === "free" && progress.scheduleDecision === "defer";
}

/**
 * ch5_schedule_contact の選択（日を決める／まだ決めない）。保存するだけで、場面の確定は
 * completeChapterFiveScene 側が行う（ch4 の recordChapterFourStrategy と同じ位置づけ）。
 */
export function recordChapterFiveScheduleDecision(value, branch) {
  const progress = chapterFiveProgress(value);
  if (progress.part !== "free" || !SCHEDULE_BRANCHES.includes(branch)) return false;
  progress.scheduleDecision = branch;
  return true;
}

/** 会場入りの確認で「向かう」が選ばれたときに runner が呼ぶ。状態遷移はここだけ。 */
export function beginChapterFiveMatch(value) {
  const progress = chapterFiveProgress(value);
  if (progress.part !== "scheduled") return false;
  progress.part = "match";
  value.flags._ch5_match_started = true;
  value.phase = "tournament";
  return true;
}

// ---- 試合 ---------------------------------------------------------------------------
// 正本（docs/setting_book/05_tournament.md）: 同じ観客が一本目・二本目の両方を吸い、それぞれ良かった方へ
// 挙手する。二本の合計票で勝敗を決める。審査員の採点や恋愛人数の加点は持ち込まない。
// 一本目は台本どおり 9000 が僅かに先取（固定）。二本目は、はじめが実際に作った一台の出来で挙手が動く。
export const CH5_AUDIENCE = 40;
export const CH5_FIRST_CUP_VOTES = Object.freeze({ hajime: 19, machine: 21 });
// 9000 も吸う速さに合わせて調整するので、どれだけ良い一台でも二本目の挙手は一方的にならない。
const SECOND_CUP_VOTES = Object.freeze({ min: 4, max: 26 });
const SECOND_CUP_CATEGORIES = Object.freeze(["steady", "recovered", "offband", "unknown", "failed"]);

/**
 * 二本目の出来（finalize の総合 0〜100）→ はじめへの挙手数。
 * 総合77前後で一本目の差を返し、合計で上回る（76前後は同数）。提供できなかった一台は最少。
 */
export function chapterFiveSecondCupVotes(total, failed = false) {
  if (failed || !Number.isFinite(total)) return SECOND_CUP_VOTES.min;
  const votes = Math.round((Math.max(0, Math.min(100, total)) - 50) / 2) + 8;
  return Math.max(SECOND_CUP_VOTES.min, Math.min(SECOND_CUP_VOTES.max, votes));
}

function isValidSecondCup(cup) {
  const count = number => Number.isInteger(number) && number >= 0 && number <= CH5_AUDIENCE;
  return !!cup && typeof cup === "object"
    && Number.isFinite(cup.total) && cup.total >= 0 && cup.total <= 100
    && SECOND_CUP_CATEGORIES.includes(cup.category)
    && count(cup.votes?.hajime) && count(cup.votes?.machine)
    && cup.votes.hajime + cup.votes.machine === CH5_AUDIENCE;
}

const secondCupTally = cup => ({
  hajime: CH5_FIRST_CUP_VOTES.hajime + cup.votes.hajime,
  machine: CH5_FIRST_CUP_VOTES.machine + cup.votes.machine,
});

function secondCupOutcome(cup) {
  const tally = secondCupTally(cup);
  return tally.hajime > tally.machine ? "win" : tally.hajime === tally.machine ? "tie" : "loss";
}

/** 二本の挙手（一本目・二本目・合計）。二本目が未制作なら null。 */
export function chapterFiveVoteTally(value) {
  const cup = chapterFiveProgress(value).secondCup;
  if (cup == null) return null;
  return { first: { ...CH5_FIRST_CUP_VOTES }, second: { ...cup.votes }, total: secondCupTally(cup) };
}

/**
 * 二本目を作り終えたときに runner が呼ぶ。二本目の前の場面を読み終え、まだ記録が無い試合だけ受け付ける。
 * total は finalize の総合、category は調整実績の区分（naruTastingCategory と同じ土台）か "failed"。
 */
export function recordChapterFiveSecondCup(value, { total, category, failed = false }) {
  const progress = chapterFiveProgress(value);
  if (progress.part !== "match" || progress.secondCup != null
    || progress.read[CH5_MATCH_SCENES.beforeSecond] !== true
    || progress.read[CH5_MATCH_SCENES.win] === true || progress.read[CH5_MATCH_SCENES.loss] === true) return false;
  const score = failed ? 0 : Math.round(Math.max(0, Math.min(100, Number(total))) * 10) / 10;
  const kind = failed ? "failed" : category;
  if (!Number.isFinite(score) || !SECOND_CUP_CATEGORIES.includes(kind)) return false;
  const hajime = chapterFiveSecondCupVotes(score, failed);
  progress.secondCup = { total: score, category: kind, votes: { hajime, machine: CH5_AUDIENCE - hajime } };
  return true;
}

/**
 * SHISHA-9000 との勝敗。"win" / "tie" / "loss"。二本目が未制作なら null。
 * 二本目の記録が無いまま勝ちの場面を読んだ旧保存（勝ち固定の頃）だけは "win" として続きを読ませる。
 */
export function chapterFiveMatchOutcome(value) {
  const progress = chapterFiveProgress(value);
  if (progress.secondCup != null) return secondCupOutcome(progress.secondCup);
  if (progress.read[CH5_MATCH_SCENES.win] === true) return "win";
  return null;
}

// ---- フィナーレ ---------------------------------------------------------------------
/**
 * エンディングの3場面を受け取り、finale の再生順として固定する。
 * ※仮置き（#517）: present/accepted の供給元が未整備のため、runner は捏造せず空で
 * selectStoryEnding を呼び、その結果をここへ渡す。供給元ができたら呼び出し側だけ差し替える。
 */
export function beginChapterFiveFinale(value, scenes) {
  const progress = chapterFiveProgress(value);
  if (progress.part !== "finale" || progress.finaleScenes !== null || progress.finale !== 0) return false;
  if (!isValidFinaleScenes(scenes)) return false;
  progress.finaleScenes = [...scenes];
  return true;
}

// ---- 読了の確定 ---------------------------------------------------------------------
/** 読了を確定する唯一の入口。今のpartで再生してよい場面だけ受け付ける。 */
export function completeChapterFiveScene(value, id) {
  const progress = chapterFiveProgress(value);
  const { part } = progress;
  if (part === "prologue") {
    if (CH5_PROLOGUE[progress.stage]?.id !== id) return false;
    progress.read[id] = true;
    progress.stage += 1;
    if (progress.stage === CH5_PROLOGUE.length) {
      progress.part = "free";
      value.phase = "daily";
    }
    return true;
  }
  if (part === "free") {
    if (CH5_FREE_SCENES.some(scene => scene.id === id)) {
      if (progress.read[id] === true) return false;
      progress.read[id] = true;
      return true;
    }
    if (id === "ch5_unrecorded_day") {
      if (progress.read[id] === true) return false;
      progress.read[id] = true;
      return true;
    }
    if (id === "ch5_schedule_contact") {
      // runner が先に recordChapterFiveScheduleDecision で選択を保存している場面だけ確定できる。
      if (progress.scheduleDecision === null) return false;
      progress.read[id] = true;
      if (progress.scheduleDecision === "decide") {
        progress.part = "scheduled";
        value.flags._ch5_match_scheduled = true;
        // phase は state.js の列挙（opening|daily|tournament|aftermath|cleared）に収め、
        // 日程が決まっただけでは進めない。試合開始（beginChapterFiveMatch）で tournament になる。
      }
      // defer のときは free のまま。ch5_timeout の確定で scheduleDecision を戻す。
      return true;
    }
    if (id === "ch5_timeout") {
      if (!chapterFiveTimeoutPending(value)) return false;
      progress.read[id] = true;
      progress.scheduleDecision = null;
      return true;
    }
    return false;
  }
  if (part === "scheduled") {
    // 「まだ行かない」の取り消し経路だけが free へ戻る。
    if (id !== "ch5_timeout") return false;
    progress.read[id] = true;
    progress.part = "free";
    value.flags._ch5_match_scheduled = false;
    progress.scheduleDecision = null;
    value.phase = "daily";
    return true;
  }
  if (part === "match") {
    const sequence = [CH5_MATCH_SCENES.arrival, CH5_MATCH_SCENES.firstCup, CH5_MATCH_SCENES.beforeSecond];
    const next = sequence.find(sceneId => progress.read[sceneId] !== true);
    if (next !== undefined) {
      if (id !== next) return false;
      progress.read[id] = true;
      return true;
    }
    if (id === CH5_MATCH_SCENES.win) {
      if (progress.read[CH5_MATCH_SCENES.win] === true
        || progress.read[CH5_MATCH_SCENES.loss] === true) return false;
      // 二本の合計で上回ったときだけ（台本コメント: 僅差一勝一敗を理由なく勝利にはしない）。
      if (chapterFiveMatchOutcome(value) !== "win") return false;
      progress.read[id] = true;
      return true;
    }
    if (id === CH5_MATCH_SCENES.afterglow) {
      // 余韻は勝ち側のみ（台本コメント）。result の後にだけ入り、確定で後日談へ。
      if (progress.read[CH5_MATCH_SCENES.win] !== true) return false;
      progress.read[id] = true;
      progress.won = true;
      progress.part = "aftermath";
      value.phase = "aftermath";
      return true;
    }
    if (id === CH5_MATCH_SCENES.loss) {
      // 負け/同数は勝利フラグなしで後日談へ続く（progression_contract.loss）。
      if (progress.read[CH5_MATCH_SCENES.win] === true
        || progress.read[CH5_MATCH_SCENES.loss] === true) return false;
      if (!["loss", "tie"].includes(chapterFiveMatchOutcome(value))) return false;
      progress.read[id] = true;
      progress.won = false;
      progress.part = "aftermath";
      value.phase = "aftermath";
      return true;
    }
    return false;
  }
  if (part === "aftermath") {
    if (CH5_AFTERMATH[progress.aftermath]?.id !== id) return false;
    progress.read[id] = true;
    progress.aftermath += 1;
    if (progress.aftermath === CH5_AFTERMATH.length) {
      progress.part = "finale";
      // phase は列挙に収め、フィナーレも aftermath のままにする（cleared で初めて変わる）。
    }
    return true;
  }
  if (part === "finale") {
    if (!progress.finaleScenes || progress.finaleScenes[progress.finale] !== id) return false;
    progress.read[id] = true;
    progress.finale += 1;
    if (progress.finale === FINALE_LENGTH) {
      progress.part = "cleared";
      value.flags._ch5_cleared = true;
      value.phase = "cleared";
    }
    return true;
  }
  return false;
}
