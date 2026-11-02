// 第4章ドバイ・砂丘のサンドボード（DESERT RIDE）の進み具合と記録。純粋関数だけ（UI・保存は ch4-desert.js）。
// 進み具合は flags._ch4_desert（デスクで話した回数・最後に話した日・外出回数・最後に出かけた日）、記録は state.desert。
import { readResult, rankAtLeast, RANK_ORDER } from "../minigames/desert-ride-model.js";

export const DESERT_FLAG = "_ch4_desert";
export const DESERT_GUIDE = "noor";
export const DESERT_TALKS = Object.freeze(["ch4_noor_meet", "ch4_noor_talk2", "ch4_noor_invite"]);
export const DESERT_SCENES = Object.freeze({ arrive: "ch4_desert_arrive", again: "ch4_desert_again", sunsetFirst: "ch4_desert_sunset_first", sunsetAgain: "ch4_desert_sunset_again" });
export const DESERT_DIALOGUE_IDS = Object.freeze([...DESERT_TALKS, ...Object.values(DESERT_SCENES), ...RANK_ORDER.map(rank => `venue_noor_result_${rank}`)]);
export const DESERT_DIALOGUE_FILE = "ch4_desert";
// 地図の位置（百分率）。宿（12,24）の隣と、街の外の砂丘。
export const DESERT_PLACES = Object.freeze({
  tour_desk: Object.freeze({ id: "tour_desk", label: "砂漠ツアーのデスク", x: 20, y: 18 }),
  dunes: Object.freeze({ id: "dunes", label: "砂丘", x: 92, y: 86 }),
});

const integer = (value, min = 0) => Number.isInteger(value) && value >= min ? value : null;

/** 進み具合を読める形にそろえる（読むだけ。state は変えない）。 */
export function desertProgress(value) {
  const raw = value?.flags?.[DESERT_FLAG];
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    talks: Math.min(DESERT_TALKS.length, integer(record.talks) ?? 0),
    lastTalkDay: integer(record.lastTalkDay, 1),
    outings: integer(record.outings) ?? 0,
    lastOutingDay: integer(record.lastOutingDay, 1),
  };
}
const write = (value, progress) => { value.flags[DESERT_FLAG] = progress; return progress; };

export const desertInvited = value => desertProgress(value).talks >= DESERT_TALKS.length;

/** 今日デスクで読める場面。1日1つ。誘いまで読み終えたら null（デスクは地図から消え、砂丘に替わる）。 */
export function desertTalkScene(value, day) {
  const progress = desertProgress(value);
  if (progress.talks >= DESERT_TALKS.length) return null;
  if (progress.lastTalkDay !== null && progress.lastTalkDay >= day) return null;
  return DESERT_TALKS[progress.talks];
}

/** 読了を確定する。次の場面以外・同じ日の2回目は受け付けない。 */
export function completeDesertTalk(value, id, day) {
  if (!value?.flags || desertTalkScene(value, day) !== id) return false;
  const progress = desertProgress(value);
  write(value, { ...progress, talks: progress.talks + 1, lastTalkDay: day });
  return true;
}

/** 砂丘へ行けるか。誘われていて、今日まだ行っていない昼だけ。 */
/** 昼か（value.slot が 0）。ラクダレース（ch4-camel-progress.js の isDaytime）と同じ判定で、昼の行動を分け合う。 */
export const desertDaytime = value => (value?.slot ?? 0) === 0;

export function desertOutingStatus(value, day) {
  const progress = desertProgress(value);
  const first = progress.outings === 0;
  if (progress.talks < DESERT_TALKS.length) return { ok: false, why: "まだ誘われていない", first };
  if (progress.lastOutingDay !== null && progress.lastOutingDay >= day) return { ok: false, why: "今日はもう砂丘へ行った", first: false };
  if (!desertDaytime(value)) return { ok: false, why: "今日の昼はもう別の予定に使った", first };
  return { ok: true, why: "", first };
}

/**
 * 外出を確定する。昼の行動を1つ使う（今の章では slot を 1 にする。ラクダレースと同じ。14日化の runDaily では calendar が同じ slot を進める）。
 * この外出の中の再挑戦はもう消費しない。
 */
export function beginDesertOuting(value, day) {
  if (!value?.flags || !desertOutingStatus(value, day).ok) return false;
  const progress = desertProgress(value);
  write(value, { ...progress, outings: progress.outings + 1, lastOutingDay: day });
  value.slot = 1;
  return true;
}

/** 保存済みの記録（state.desert）。形の合わない保存は空扱い。 */
export function desertRecords(value) {
  const raw = value?.desert && typeof value.desert === "object" && !Array.isArray(value.desert) ? value.desert : {};
  const best = readResult(raw.best);
  const firstClear = raw.firstClear && Number.isInteger(raw.firstClear.day) ? { chapter: raw.firstClear.chapter ?? null, day: raw.firstClear.day } : null;
  return { runs: integer(raw.runs) ?? 0, best, bestRank: best?.rank ?? null, firstClear, rewarded: raw.rewarded === true };
}

/**
 * 完走を記録する。自己ベストは点数で比べる。初めての完走だけ awardExp（growth.js の awardActionExp）を呼ぶ。二度目以降は呼ばない。
 * 戻り値: { entry, newBest, firstClear, exp } か、形の合わない結果なら null。
 */
export function recordDesertResult(value, data, { awardExp = null } = {}) {
  const result = readResult(data);
  if (!value || typeof value !== "object" || !result) return null;
  const before = desertRecords(value);
  const newBest = !before.best || result.score > before.best.score;
  const firstClear = !before.firstClear;
  const desert = { runs: before.runs + 1, best: newBest ? result : before.best,
    firstClear: before.firstClear || { chapter: Number.isInteger(value.chapter) ? value.chapter : null, day: Number.isInteger(value.day) ? value.day : 0 },
    rewarded: before.rewarded };
  let exp = 0;
  if (!before.rewarded) {
    desert.rewarded = true;
    exp = awardExp ? awardExp({ key: "desert_ride", place: "dubai_dunes", person: DESERT_GUIDE }) : 0;
  }
  desert.bestRank = desert.best.rank;
  value.desert = desert;
  return { entry: result, newBest, firstClear, exp };
}

/** 遊びのご褒美の判定（growth.js が読む）: 自己ベストが need 以上か。 */
export const desertRankAtLeast = (value, need) => { const rank = desertRecords(value).bestRank; return !!rank && rankAtLeast(rank, need); };

/**
 * 第4章の自由行動の地図に足す行き先（昼）。誘われるまではデスク、誘われたら砂丘。
 * ほかの行き先と同じ形（id/label/x/y/scenes/purpose/kind/ok/why/unreadCount/consumes）。
 */
export function desertDestinations(value, day) {
  const progress = desertProgress(value);
  if (progress.talks < DESERT_TALKS.length) {
    const scene = desertTalkScene(value, day);
    const first = progress.talks === 0;
    return [{ ...DESERT_PLACES.tour_desk, kind: "desert_talk", scenes: scene ? [scene] : [], consumes: false, ok: !!scene,
      label: first ? "宿の隣のツアーデスクをのぞく" : "ヌールと話す", visited: !first, background: "bg_dubai_inn_day",
      description: "宿の隣。砂丘を走る車の写真が貼ってある。", unreadCount: scene ? 1 : 0,
      why: scene ? "" : "今日はもう話した",
      purpose: scene ? (first ? "壁の写真が気になる。隣のデスクの人と話してみる。" : "また日本語を教えがてら、砂漠の話を聞く。")
        : "今日はもう話した。また別の日に。" }];
  }
  const status = desertOutingStatus(value, day);
  const records = desertRecords(value);
  return [{ ...DESERT_PLACES.dunes, kind: "desert", scenes: [], consumes: true, ok: status.ok, why: status.why,
    label: "ヌールと砂丘へ（サンドボード）", visited: progress.outings > 0, background: "bg_dubai_inn_day",
    description: "街の外の砂丘。ヌールの車で出かける。", unreadCount: progress.outings === 0 ? 1 : 0,
    purpose: !status.ok ? `${status.why}。宿に戻って日を終えると、また行ける。`
      : status.first ? "約束の砂漠。サンドボードを教わる。昼の行動を1つ使う（滑り直しは何度でも）。"
        : `もう一度砂丘を滑る。自己ベスト ${records.best.score.toLocaleString("ja-JP")}点／${records.best.rank}。昼の行動を1つ使う。` }];
}
