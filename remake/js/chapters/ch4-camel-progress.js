import { CAMEL_CUPS, camelCupQualified, camelMastered, camelExpert } from "../minigames/camel-race-model.js";
// 第4章ドバイ編・任意イベント「ラクダレース」の進み具合・行き先・記録（純粋関数。DOM・保存・音を持たない）。
// 画面と訪問の流れは ch4-camel-race.js、遊びの本体は minigames/camel-race.js。
//
// 設計（#2273 の14日化と整合させるための独立モジュール）:
// - 進み具合は flags._ch4_camel に持つ。日付は通算の value.day で相対に比べる（章内 DAY の決め打ちをしない）。
//   stage 0: Dr.fookah ドバイ店の店先でサイフと知り合う（時間を使わない会話）
//   stage 1: 翌日以降、店でまた話して、ラクダレースに誘われる（時間を使わない会話）
//   stage 2: その翌日以降の昼、レース場で本番を見てから練習レースのリモコンを借りる（昼の行動を使う）
//   stage 3: 以後、昼に練習レースへ通える（昼の行動を使う・1日1回・自己ベストを保存）
// - 「昼の行動を使う」は value.slot で判定・確定する（0＝昼）。今の5日構成では slot を 1 にするだけで、
//   14日化で runDaily に乗るときは camelRaceDestination()/visitCamelRace() をそのまま行き先と performSpot に渡せる。
// - 育成の報酬は現行の仕様に合わせる: 初回完走だけ paidAction の経験値（core/growth.js の自由行動1回分）と、
//   心得の盤の「遊びのご褒美」（growth-board-data.js PLAY_REWARDS camel-finish・寝る前の精算で火種1つ）。
//   能力値を直接足す旧方式（技術+1 等）は使わない。再プレイは記録（自己ベスト）だけで報酬は増えない。
// - 大会（シェイクの正体・勝敗）には触れない。失敗しても進行に影響しない。

export const CAMEL_FLAG = "_ch4_camel";
export const CAMEL_SCENES = Object.freeze({
  meet: "ch4_camel_meet", invite: "ch4_camel_invite", watch: "ch4_camel_watch",
  win: "ch4_camel_result_win", place: "ch4_camel_result_place", last: "ch4_camel_result_last",
  replay: "ch4_camel_replay", replayBest: "ch4_camel_replay_best", replayUsual: "ch4_camel_replay_usual",
});
export const CH4_CAMEL_SCENE_FILES = Object.freeze({ ch4_camel_race: Object.freeze(Object.values(CAMEL_SCENES)) });
// 砂漠のレース場の朝（Codex CR-BG01 の A 案・2026-11-02 採用）。見学・結果・再挑戦の会話の背景。
export const CAMEL_TRACK_BG = "bg_dubai_camel_track_morning";
export const CAMEL_SHOP_BG = "bg_shop"; // Dr.fookah ドバイ店（NF03 と同じ流用）
export const camelSceneBg = id => id === CAMEL_SCENES.meet || id === CAMEL_SCENES.invite ? CAMEL_SHOP_BG
  : Object.values(CAMEL_SCENES).includes(id) ? CAMEL_TRACK_BG : null;
export const CAMEL_PLACE = Object.freeze({ id: "camel", x: 66, y: 84 });
export const CAMEL_STAGES = Object.freeze({ unknown: 0, met: 1, invited: 2, unlocked: 3 });

const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const integer = (value, fallback = null) => Number.isInteger(value) ? value : fallback;

/** 保存済みの進み具合を読める形にそろえる（読むだけ。value は変えない）。 */
export function camelRaceRecord(value) {
  const raw = record(value?.flags?.[CAMEL_FLAG]);
  const honors = record(value?.flags?._camel_cups) || record(raw?.cups);
  const best = record(raw?.best);
  return {
    stage: Math.min(CAMEL_STAGES.unlocked, Math.max(0, integer(raw?.stage, 0))),
    meetDay: integer(raw?.meetDay), inviteDay: integer(raw?.inviteDay),
    watched: raw?.watched === true,
    plays: Math.max(0, integer(raw?.plays, 0)),
    lastPlayDay: integer(raw?.lastPlayDay),
    cups: Object.fromEntries(CAMEL_CUPS.slice(1).map(cup => {
      const saved = record(honors?.[cup.id]);
      return [cup.id, { qualified: saved?.qualified === true, mastered: saved?.mastered === true,
        best: record(saved?.best) && Number.isFinite(saved.best.total) ? { ...saved.best } : null }];
    })),
    best: best && Number.isFinite(best.total) ? { total: Math.round(best.total), rank: integer(best.rank, 4), grade: typeof best.grade === "string" ? best.grade : "C",
      time: Number.isFinite(best.time) ? best.time : null, chapter: integer(best.chapter), day: integer(best.day) } : null,
  };
}
export function availableCamelCups(value) {
  const { cups } = camelRaceRecord(value);
  return CAMEL_CUPS.filter(cup => cup.id === "practice" || cup.id === "rookie"
    || cup.id === "standard" && cups.rookie.qualified || cup.id === "expert" && cups.standard.mastered).map(cup => cup.id);
}
function ensureRecord(value) {
  const current = camelRaceRecord(value);
  value.flags[CAMEL_FLAG] = { ...current };
  value.flags._camel_cups = current.cups;
  return value.flags[CAMEL_FLAG];
}

/** 第4章ドバイの自由行動の最中か。14日化後も「ドバイ滞在中の daily」であれば同じ条件で開く。 */
export const camelRaceOpen = value => value?.chapter === 4 && value.phase === "daily"
  && (value.flags?._ch4?.part === undefined || value.flags._ch4.part === "free");
export const isDaytime = value => (value?.slot ?? 0) === 0;

/**
 * 地図の行き先（第4章の自由行動の一覧に足す1件）。出さないときは null。
 * ok:false の行き先は押せない（理由は why）。consumes は「昼の行動を使う」。
 */
export function camelRaceDestination(value) {
  if (!camelRaceOpen(value)) return null;
  const camel = camelRaceRecord(value);
  const day = value.day;
  const base = { ...CAMEL_PLACE, scenes: [], unreadCount: 0, kind: "camel", visited: camel.stage > 0, background: camelSceneBg(CAMEL_SCENES.meet), ok: true, why: "" };
  if (camel.stage === CAMEL_STAGES.unknown) {
    return { ...base, label: "Dr.fookah ドバイ店の店先で、店員と話す", description: "店の前で日本語の挨拶をされた。", consumes: false,
      purpose: "日本語で声をかけてきた店員と話してみる。時間は使わない。" };
  }
  if (camel.stage === CAMEL_STAGES.met) {
    const ready = camel.meetDay === null || day > camel.meetDay;
    return { ...base, label: "Dr.fookah ドバイ店で、サイフとまた話す", description: "昼に見せたいものがあると言っていた。", consumes: false,
      ok: ready, why: ready ? "" : "今日はもう話した。また明日、店に顔を出そう",
      purpose: ready ? "「昼に見せたいもの」の続きを聞く。時間は使わない。" : "今日はもう話した。また明日、店に顔を出そう。" };
  }
  const track = { ...base, background: CAMEL_TRACK_BG, consumes: true };
  if (camel.stage === CAMEL_STAGES.invited) {
    const tomorrow = camel.inviteDay !== null && day <= camel.inviteDay;
    const ok = !tomorrow && isDaytime(value);
    return { ...track, label: "ラクダレース場へ（サイフと）", description: "朝のレースを見に行く約束。",
      ok, why: tomorrow ? "レースは明日の朝。宿の前で迎えに来てくれる" : ok ? "" : "レースは朝。明日の昼に行こう",
      purpose: ok ? "朝のレースを見てから、練習レースのリモコンを借りる。昼の行動を使う。" : tomorrow ? "レースは明日の朝。宿の前で迎えに来てくれる。" : "レースは朝。明日の昼に行こう。" };
  }
  const played = camel.lastPlayDay !== null && camel.lastPlayDay === day;
  const ok = !played && isDaytime(value);
  const best = camel.best ? `自己ベスト ${camel.best.total}（${camel.best.grade}・${camel.best.rank}位）。` : "";
  return { ...track, label: "ラクダレース場で練習レース", description: "ラシードの練習レースに、もう一度。",
    ok, why: played ? "今日はもう走った。ハビーバを休ませよう" : ok ? "" : "レースは朝。明日の昼に行こう",
    purpose: ok ? `ハビーバにもう一度声をかける。昼の行動を使う。${best}` : `${played ? "今日はもう走った。ハビーバを休ませよう。" : "レースは朝。明日の昼に行こう。"}${best}` };
}

export const CAMEL_DAILY_SPOT_ID = "ch4_dubai_camel";

/**
 * ドバイ14日の日常ループ（ch4-dubai-daily.js の runDaily の地図）に出す行き先。出さないときは null。
 * fields は章の側の値（region・kind）。段階で場所が変わる: 誘われるまでは Dr.fookah の店先、誘われたらレース場。
 * 押せない理由は daily/spot-access.js の unavailable／unavailableTag で地図に出る。
 */
export function camelDailySpot(value, fields = {}) {
  const destination = camelRaceDestination(value);
  if (!destination) return null;
  const camel = camelRaceRecord(value);
  const race = camel.stage >= CAMEL_STAGES.invited;
  const played = camel.lastPlayDay !== null && camel.lastPlayDay === value.day;
  const tag = destination.ok !== false ? ""
    : camel.stage === CAMEL_STAGES.met ? "また明日"
    : camel.stage === CAMEL_STAGES.invited && camel.inviteDay !== null && value.day <= camel.inviteDay ? "レースは明日の朝"
    : played ? "今日はもう走った" : "レースは昼だけ";
  return Object.freeze({
    ...fields, id: CAMEL_DAILY_SPOT_ID, place: "camel",
    label: race ? "ラクダレース場" : "Dr.fookah の店先",
    area: race ? "郊外の砂漠" : "街の中心",
    // レース場はアイコン（MPI07）が入るので、右下の案内の札に重ならない位置へ（84,76 → 86,62）。
    x: race ? 86 : 46, y: race ? 62 : 42,
    ...(race ? {} : { facilityIcon: false }), // 店先の段階は会話の場所。レース場の絵を出さない
    theme: race ? "park" : "shop", glyph: race ? "駱" : "話",
    preview: race ? CAMEL_TRACK_BG : CAMEL_SHOP_BG,
    desc: destination.purpose,
    unavailable: destination.ok === false ? destination.why : "", unavailableTag: tag,
    hasNew: () => destination.ok !== false && camel.stage < CAMEL_STAGES.unlocked,
  });
}

/** 練習レースの結果を記録する。戻り値 { firstClear, newBest, plays }。形の合わない結果は null。 */
export function recordCamelRaceResult(value, run, runs = 1) {
  if (!value || !record(run) || !Number.isFinite(run.total)) return null;
  const cup = run.cup || "practice";
  if (!availableCamelCups(value).includes(cup)) return null;
  const camel = ensureRecord(value);
  const firstClear = camel.plays === 0;
  const entry = { total: Math.round(run.total), rank: integer(run.rank, 4), grade: typeof run.grade === "string" ? run.grade : "C",
    time: Number.isFinite(run.time) ? Math.round(run.time * 100) / 100 : null, chapter: integer(value.chapter), day: integer(value.day) };
  if (cup !== "practice") {
    const saved = camel.cups[cup];
    if (!saved.best || entry.total > saved.best.total) saved.best = { ...entry };
    saved.qualified ||= camelCupQualified(run);
    saved.mastered ||= camelMastered(run) || camelExpert(run);
  }
  const newBest = !camel.best || entry.total > camel.best.total;
  camel.plays += Math.max(1, integer(runs, 1));
  if (newBest) camel.best = entry;
  camel.lastPlayDay = value.day;
  if (camel.stage < CAMEL_STAGES.unlocked) camel.stage = CAMEL_STAGES.unlocked;
  return { firstClear, newBest, plays: camel.plays };
}

/** 昼の行動を使う（今の章では slot を 1 にするだけ。14日化の runDaily では calendar が同じ slot を進める）。 */
export function consumeCamelRaceDaytime(value) {
  if (!value || !isDaytime(value)) return false;
  value.slot = 1;
  return true;
}

/** 読了した段階を確定する（会話だけの段階）。戻り値は進んだか。 */
export function advanceCamelRaceStage(value, sceneId) {
  const camel = ensureRecord(value);
  if (sceneId === CAMEL_SCENES.meet && camel.stage === CAMEL_STAGES.unknown) { camel.stage = CAMEL_STAGES.met; camel.meetDay = value.day; return true; }
  if (sceneId === CAMEL_SCENES.invite && camel.stage === CAMEL_STAGES.met) { camel.stage = CAMEL_STAGES.invited; camel.inviteDay = value.day; return true; }
  if (sceneId === CAMEL_SCENES.watch && camel.stage === CAMEL_STAGES.invited) { camel.watched = true; return true; }
  return false;
}

export const resultSceneFor = rank => rank === 1 ? CAMEL_SCENES.win : rank >= 4 ? CAMEL_SCENES.last : CAMEL_SCENES.place;

