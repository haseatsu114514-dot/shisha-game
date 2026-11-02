// 第4章ドバイ・砂丘のサンドボード（DESERT RIDE）の進み具合と記録。純粋関数だけ（UI・保存は ch4-desert.js）。
// 進み具合は flags._ch4_desert（店で読んだ段階の数・雑談の数・最後に寄った日・外出回数・最後に出かけた日）、記録は state.desert。
// 2026-11-02 オーナー「ヌールはシーシャ屋もしつつガイドもしてる。シーシャの方へ行くと交流が深まり、好感度3ぐらいでサンドボードに誘われる。
// 最初は無料、その後は相場」（DSR21）: 宿の隣のカフェ・サーリム（ヌールの父の店。表にツアーデスク）で一台頼んで話すと好感度が上がる。
// 段階の会話は♥0・1・2・3で読み、♥3の誘いで砂丘へ。2回目以降の砂丘は 6,000円（相場: ガイド付きのサンドボード単体 約150ディルハム）。
import { readResult, rankAtLeast, RANK_ORDER } from "../minigames/desert-ride-model.js";
import { spendableMoney } from "../core/travel-budget.js";

export const DESERT_FLAG = "_ch4_desert";
export const DESERT_GUIDE = "noor";
export const DESERT_TALKS = Object.freeze(["ch4_noor_meet", "ch4_noor_talk2", "ch4_noor_cafe_3", "ch4_noor_invite"]);
/** 段階の会話を読むのに要る♥（DESERT_TALKS と同じ順）。前の段階を読み、この♥に届いていれば読める。 */
export const DESERT_TALK_HEARTS = Object.freeze([0, 1, 2, 3]);
/** 段階の会話が無い日の、店での雑談（順に巡回）。 */
export const DESERT_CAFE_CHATS = Object.freeze(["ch4_noor_cafe_chat_a", "ch4_noor_cafe_chat_b", "ch4_noor_cafe_chat_c"]);
export const DESERT_CAFE_PRICE = 3000; // ドバイのカフェの一台（ch4-dubai-daily.js の中心地・路地裏のカフェと同じ）
export const DESERT_RIDE_PRICE = 6000; // 2回目以降のサンドボード（2026-11-02 オーナー「6,000円」）
// 好感度の段階の境目（core/stats.js の AFFINITY_RANK_PTS と同じ。このファイルは単体で読み込めるよう import しない）
const HEART_PTS = Object.freeze([0, 9, 20, 33, 48, 66]);
export const DESERT_SCENES = Object.freeze({ arrive: "ch4_desert_arrive", again: "ch4_desert_again", sunsetFirst: "ch4_desert_sunset_first", sunsetAgain: "ch4_desert_sunset_again",
  raceFirstWin: "ch4_desert_race_first_win", naruArrive: "ch4_desert_naru_arrive", naruFirstWin: "ch4_desert_naru_first_win" });
/** 競走でヌールに勝った完走のひとこと（ランクのひとことの代わり）。 */
export const DESERT_RACE_WIN_LINE = "venue_noor_race_win";
/** なる（裏の相手）との競走のひとこと。 */
export const DESERT_NARU_LINES = Object.freeze({ win: "venue_naru_race_win", lose: "venue_naru_race_lose" });
export const DESERT_DIALOGUE_IDS = Object.freeze([...DESERT_TALKS, ...DESERT_CAFE_CHATS, ...Object.values(DESERT_SCENES), ...RANK_ORDER.map(rank => `venue_noor_result_${rank}`), DESERT_RACE_WIN_LINE,
  ...Object.values(DESERT_NARU_LINES)]);
export const DESERT_DIALOGUE_FILE = "ch4_desert";
// 地図の位置（百分率）。ドバイの地図で HUD・案内の枠・ほかの行き先と重ならない所（デスクは宿・FESTA・店の間、砂丘は左下＝街の外）。
export const DESERT_PLACES = Object.freeze({
  tour_desk: Object.freeze({ id: "tour_desk", label: "カフェ・サーリム", x: 34, y: 30 }),
  dunes: Object.freeze({ id: "dunes", label: "砂丘", x: 13, y: 92 }),
});

const integer = (value, min = 0) => Number.isInteger(value) && value >= min ? value : null;

/** ヌールの好感度の段階（恋人なら5）。value.affinity.noor のポイントから。 */
export function noorHeart(value) {
  if ((value?.lovers || []).includes(DESERT_GUIDE)) return 5;
  const pts = Number(value?.affinity?.[DESERT_GUIDE]) || 0;
  let heart = 0;
  for (let i = 1; i < HEART_PTS.length; i++) if (pts >= HEART_PTS[i]) heart = i;
  return heart;
}

/** 進み具合を読める形にそろえる（読むだけ。state は変えない）。 */
export function desertProgress(value) {
  const raw = value?.flags?.[DESERT_FLAG];
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  let talks = integer(record.talks) ?? 0;
  // 以前の保存（デスクの会話3つ: 名乗り・地図・誘い）で誘いまで読んだ人は、誘われたまま（店の3つ目は飛ばす）
  if (record.v !== 2 && talks >= 3) talks = DESERT_TALKS.length;
  return {
    talks: Math.min(DESERT_TALKS.length, talks),
    chats: integer(record.chats) ?? 0,
    lastTalkDay: integer(record.lastTalkDay, 1),
    outings: integer(record.outings) ?? 0,
    lastOutingDay: integer(record.lastOutingDay, 1),
  };
}
const write = (value, progress) => { value.flags[DESERT_FLAG] = { v: 2, ...progress }; return progress; };

export const desertInvited = value => desertProgress(value).talks >= DESERT_TALKS.length;

// 旧カードの地図（版2より前の5日の保存）は日数が少ないので、以前と同じ3つ（名乗り・地図・誘い）で誘う。店の3つ目は飛ばす
const LEGACY_SKIP = "ch4_noor_cafe_3";

/**
 * 今日店で読める段階の会話。1日1つ。次の段階の♥に届いていなければ null。heart を省くと♥を問わない。
 * legacy（旧カードの地図）では店の3つ目を飛ばす。
 */
export function desertTalkScene(value, day, heart = Infinity, { legacy = false } = {}) {
  const progress = desertProgress(value);
  let index = progress.talks;
  if (legacy && DESERT_TALKS[index] === LEGACY_SKIP) index += 1;
  if (index >= DESERT_TALKS.length) return null;
  if (progress.lastTalkDay !== null && progress.lastTalkDay >= day) return null;
  if (heart < DESERT_TALK_HEARTS[index]) return null;
  return DESERT_TALKS[index];
}

/** 読了を確定する。次の場面以外・同じ日の2回目は受け付けない。 */
export function completeDesertTalk(value, id, day, heart = Infinity, { legacy = false } = {}) {
  if (!value?.flags || desertTalkScene(value, day, heart, { legacy }) !== id) return false;
  const progress = desertProgress(value);
  write(value, { ...progress, talks: DESERT_TALKS.indexOf(id) + 1, lastTalkDay: day });
  return true;
}

/**
 * 今日カフェ・サーリムへ寄った時の会話: { id, kind: "story"（段階の会話）|"talk"（雑談） } か、今日はもう寄ったなら null。
 * 段階の会話が♥待ちの日・全部読んだ後は、雑談を順に読む。
 */
export function desertCafeVisit(value, day, { legacy = false } = {}) {
  const progress = desertProgress(value);
  if (progress.lastTalkDay !== null && progress.lastTalkDay >= day) return null;
  const story = desertTalkScene(value, day, legacy ? Infinity : noorHeart(value), { legacy });
  if (story) return { id: story, kind: "story" };
  if (progress.talks === 0) return null; // 名乗りの前に雑談はしない（名乗りは♥0で読める）
  return { id: DESERT_CAFE_CHATS[progress.chats % DESERT_CAFE_CHATS.length], kind: "talk" };
}

/** カフェの会話の読了を確定する（段階なら進み、雑談なら数える）。 */
export function completeDesertCafeVisit(value, visit, day, { legacy = false } = {}) {
  const expected = desertCafeVisit(value, day, { legacy });
  if (!value?.flags || !visit || !expected || expected.id !== visit.id) return false;
  if (visit.kind === "story") return completeDesertTalk(value, visit.id, day, legacy ? Infinity : noorHeart(value), { legacy });
  const progress = desertProgress(value);
  write(value, { ...progress, chats: progress.chats + 1, lastTalkDay: day });
  return true;
}

/** 砂丘へ行けるか。誘われていて、今日まだ行っていない昼だけ。 */
/** 昼か（value.slot が 0）。ラクダレース（ch4-camel-progress.js の isDaytime）と同じ判定で、昼の行動を分け合う。 */
export const desertDaytime = value => (value?.slot ?? 0) === 0;

/** 砂丘へ行けるか。誘われていて、今日まだ行っていない昼だけ。2回目からはツアー代（DESERT_RIDE_PRICE）が要る。 */
export function desertOutingStatus(value, day) {
  const progress = desertProgress(value);
  const first = progress.outings === 0, price = first ? 0 : DESERT_RIDE_PRICE;
  if (progress.talks < DESERT_TALKS.length) return { ok: false, why: "まだ誘われていない", first, price };
  if (progress.lastOutingDay !== null && progress.lastOutingDay >= day) return { ok: false, why: "今日はもう砂丘へ行った", first: false, price };
  if (!desertDaytime(value)) return { ok: false, why: "今日の昼はもう別の予定に使った", first, price };
  if (price > spendableMoney(value)) return { ok: false, why: `お金が足りない（${price.toLocaleString("ja-JP")}円）`, first, price };
  return { ok: true, why: "", first, price };
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
  return { runs: integer(raw.runs) ?? 0, best, bestRank: best?.rank ?? null, firstClear, rewarded: raw.rewarded === true, wins: integer(raw.wins) ?? 0,
    naruMet: raw.naruMet === true, naruWins: integer(raw.naruWins) ?? 0 };
}

/** 本番で競える相手。ヌールに一度勝つと、なる（裏の相手）が砂丘に来る。 */
export const desertRivals = value => desertRecords(value).wins >= 1 ? ["noor", "naru"] : ["noor"];
/** なるが初めて砂丘に来た場面を読んだ印。 */
export function markNaruMet(value) {
  if (!value || typeof value !== "object" || !value.desert || typeof value.desert !== "object") return false;
  if (value.desert.naruMet === true) return false;
  value.desert.naruMet = true;
  return true;
}

/**
 * 完走を記録する。自己ベストは点数で比べる。初めての完走だけ awardExp（growth.js の awardActionExp）を呼ぶ。二度目以降は呼ばない。
 * 競走でヌールに勝った回数（wins）も数える。
 * なる（裏の相手）に勝った回数は naruWins。
 * 戻り値: { entry, newBest, firstClear, exp, won, firstWin, who, firstNaruWin } か、形の合わない結果なら null。
 */
export function recordDesertResult(value, data, { awardExp = null } = {}) {
  const result = readResult(data);
  if (!value || typeof value !== "object" || !result) return null;
  const before = desertRecords(value);
  const newBest = !before.best || result.score > before.best.score;
  const firstClear = !before.firstClear;
  const who = result.race?.who === "naru" ? "naru" : "noor", won = result.race?.won === true;
  const firstWin = won && who === "noor" && before.wins === 0, firstNaruWin = won && who === "naru" && before.naruWins === 0;
  const desert = { runs: before.runs + 1, best: newBest ? result : before.best,
    firstClear: before.firstClear || { chapter: Number.isInteger(value.chapter) ? value.chapter : null, day: Number.isInteger(value.day) ? value.day : 0 },
    rewarded: before.rewarded, wins: before.wins + (won && who === "noor" ? 1 : 0), naruMet: before.naruMet, naruWins: before.naruWins + (won && who === "naru" ? 1 : 0) };
  let exp = 0;
  if (!before.rewarded) {
    desert.rewarded = true;
    exp = awardExp ? awardExp({ key: "desert_ride", place: "dubai_dunes", person: DESERT_GUIDE }) : 0;
  }
  desert.bestRank = desert.best.rank;
  value.desert = desert;
  return { entry: result, newBest, firstClear, exp, won, firstWin, who, firstNaruWin };
}

/** 遊びのご褒美の判定（growth.js が読む）: 自己ベストが need 以上か。 */
export const desertRankAtLeast = (value, need) => { const rank = desertRecords(value).bestRank; return !!rank && rankAtLeast(rank, need); };

/**
 * 第4章の自由行動の地図（版2より前の5日の保存）に足す行き先。誘われるまではカフェ・サーリム（時間は使わない）、誘われたら砂丘。
 * ほかの行き先と同じ形（id/label/x/y/scenes/purpose/kind/ok/why/unreadCount/consumes）。
 */
export function desertDestinations(value, day) {
  const progress = desertProgress(value);
  if (progress.talks < DESERT_TALKS.length) {
    const visit = desertCafeVisit(value, day, { legacy: true });
    const first = progress.talks === 0;
    return [{ ...DESERT_PLACES.tour_desk, kind: "desert_talk", legacy: true, scenes: visit ? [visit.id] : [], consumes: false, ok: !!visit,
      label: first ? "宿の隣のカフェに入る" : "カフェ・サーリムでヌールと話す", visited: !first, background: "bg_dubai_inn_day",
      description: "宿の隣のシーシャカフェ。表に砂漠ツアーのデスクがある。", unreadCount: visit?.kind === "story" ? 1 : 0,
      why: visit ? "" : "今日はもう寄った",
      purpose: visit ? (first ? "表のツアーデスクの写真が気になる。中で一台頼んでみる。" : "一台吸いながら、ヌールと話す。")
        : "今日はもう寄った。また別の日に。" }];
  }
  const status = desertOutingStatus(value, day);
  const records = desertRecords(value);
  return [{ ...DESERT_PLACES.dunes, kind: "desert", scenes: [], consumes: true, ok: status.ok, why: status.why,
    label: "ヌールと砂丘へ（サンドボード）", visited: progress.outings > 0, background: "bg_dubai_inn_day",
    description: "街の外の砂丘。ヌールの車で出かける。", unreadCount: progress.outings === 0 ? 1 : 0,
    purpose: !status.ok ? `${status.why}。宿に戻って日を終えると、また行ける。`
      : status.first ? "約束の砂漠。サンドボードを教わる（初回は無料）。昼の行動を1つ使う（滑り直しは何度でも）。"
        : `もう一度砂丘を滑る（ツアー代 ${status.price.toLocaleString("ja-JP")}円）。自己ベスト ${records.best ? `${records.best.score.toLocaleString("ja-JP")}点／${records.best.rank}` : "なし"}。昼の行動を1つ使う。` }];
}

// ---- 日常ループ（版2・14日のドバイ: chapters/ch4-dubai-daily.js）の地図の行き先 ----------------------------
// カフェ・サーリムはいつも地図にあり、一台頼んで（3,000円・行動を1つ使う）ヌールと話す。誘われた後は砂丘も出る。
// 砂丘は昼だけ・同じ日は一度。出かけると beginDesertOuting が slot を使うので、日常ループには追加の消費をさせない。
export const DESERT_SPOT_IDS = Object.freeze({ desk: "ch4_dubai_tour_desk", dunes: "ch4_dubai_dunes" });
const dailySpot = fields => Object.freeze({ region: "dubai", kind: "ch4_desert", ...fields });

// 日常の地図（ドバイ14日）での位置。アイコン（MPI07）は文字の盾より大きいので、
// カフェは下の Dr.fookah ドバイ店に、砂丘は画面の下端に重ならない位置へ（旧カードの地図は DESERT_PLACES のまま）。
const DAILY_AT = Object.freeze({ tour_desk: Object.freeze([34, 26]), dunes: Object.freeze([12, 80]) });

/**
 * 今の時点で日常ループの地図に出す行き先（カフェ、誘われた後は砂丘も）。day はドバイの章内日。
 * 行けない時も地図に残し、理由を出す（unavailable。ラクダレースの行き先と同じ見せ方）。
 */
export function desertDailySpots(value, day) {
  const progress = desertProgress(value);
  const visit = desertCafeVisit(value, day), first = progress.talks === 0;
  const poor = DESERT_CAFE_PRICE > spendableMoney(value);
  const cafeWhy = !visit ? "今日はもう寄った。また明日" : poor ? `お金が足りない（${DESERT_CAFE_PRICE.toLocaleString("ja-JP")}円）` : "";
  const spots = [dailySpot({ id: DESERT_SPOT_IDS.desk, place: "tour_desk", label: first ? "宿の隣のカフェ" : "カフェ・サーリム", area: "宿の隣",
    x: DAILY_AT.tour_desk[0], y: DAILY_AT.tour_desk[1], theme: "store", glyph: "茶", preview: "bg_dubai_inn_day", cost: DESERT_CAFE_PRICE,
    desc: first ? "宿の隣のシーシャカフェ。表に砂漠ツアーのデスクがある。一台3,000円（約70ディルハム）。"
      : "ヌールの父の店。一台頼んで、ヌールと話す。一台3,000円（約70ディルハム）。",
    unavailable: cafeWhy, unavailableTag: !visit ? "また明日" : poor ? "お金が足りない" : "",
    hasNew: () => visit?.kind === "story" && !poor })];
  if (progress.talks < DESERT_TALKS.length) return spots;
  const status = desertOutingStatus(value, day);
  const best = desertRecords(value).best;
  const tag = status.ok ? "" : status.why === "今日はもう砂丘へ行った" ? "今日はもう行った" : status.why.startsWith("お金") ? "お金が足りない" : "砂丘は昼だけ";
  spots.push(dailySpot({ id: DESERT_SPOT_IDS.dunes, place: "dunes", label: "ヌールと砂丘へ", area: "街の外の砂丘",
    x: DAILY_AT.dunes[0], y: DAILY_AT.dunes[1], theme: "park", glyph: "砂", preview: "bg_dubai_dunes_day",
    desc: status.first ? "サンドボードを教わる（初回は無料）。昼の行動を使う（滑り直しは何度でも）。"
      : `もう一度砂丘を滑る（ツアー代 6,000円・約140ディルハム）。昼の行動を使う。${best ? `自己ベスト ${best.score.toLocaleString("ja-JP")}点／${best.rank}。` : ""}`,
    unavailable: status.ok ? "" : status.why === "今日はもう砂丘へ行った" ? "今日はもう砂丘へ行った。また明日" : status.why.startsWith("お金") ? status.why : "砂丘へは昼に出かける",
    unavailableTag: tag, hasNew: () => status.ok && status.first }));
  return spots;
}

/** 地図で選んだ行き先を、今行ける時だけ返す（行けない行き先は処理しない）。 */
export const desertDailySpotById = (value, day, id) => desertDailySpots(value, day).find(entry => entry.id === id && !entry.unavailable) || null;
