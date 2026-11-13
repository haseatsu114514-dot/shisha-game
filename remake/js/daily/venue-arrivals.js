// 遊び場へ入った時の、店の人との短いやり取り（VAR・2026-11-12 オーナー「スポットに入ったらすぐUIみたいなのが今多いから
// 店員と会話とかして自然な流れで」「日常の一部としての感を強めたくて」）。
// メニューやゲームの画面を開く前に一本だけ読む。料金・体力・行動・好感度・面識・店の記録は変えない。
// - 同じ時間帯に入り直した時は読まない（メニューから地図へ戻って入り直す・遊んだ後にもう一度入る）。
// - 前の来店の結果を受ける回 → 一度きりの回（雨の日・自分の道具を買った後など）→ 巡回の束、の順に一本選ぶ。
// - 束は読んだ本数で次を決め、同じ文に戻らない。条件付きの回は、条件が合わない日は飛ばす。
// - 束を読み終えた後は、顔なじみの短いやり取り（2〜3行）を巡回する。通うほど挨拶が短くなる。
// - 読み終えた時だけ記録する。中断・LOAD では残らず、次に入った時に同じ回を読む。
// 台本は data/dialogue/venue_arrivals.json（クラブの2本は ch3_club.json、レース場の1本は ch4_camel_race.json にある場面）。
// 回を足す時は台本を書いて、下の束に ID を足す。章・大会の前後・味の調子に触れない文にする（どの章のいつでも読むため）。
import { state } from "../core/state.js";
import { DB, loadVenueArrivals } from "../core/data.js";
import { ownsGear } from "../core/hobby-gear.js";
import { bestOwnedAxe } from "../minigames/axe-equipment.js";
import { isRainy } from "./weather.js";

const owns = gear => save => ownsGear(save, gear);
const rainy = (save, ctx) => !!ctx.rainy;
const axeRecorded = save => Object.keys(save.flags?._axe_bar_records || {}).some(key => key !== "career");
const clubMembers = save => Object.keys(save.trpg?.club?.members || {}).length > 0;
// ボドゲカフェは昼と夜で別の束を巡回し、一度きりの回は共有する（既読は場面ごと）
const TRPG_ONCE = [
  { id: "trpg_arrival_first_member", when: clubMembers },
  { id: "trpg_arrival_own_dice", when: owns("gear_dice") },
  { id: "trpg_arrival_rain", when: rainy },
];

/**
 * 店ごとの束。
 * notes: 前の来店が残した一言メモ（leaveArrivalNote）を受ける回。回ごとに一度だけ。
 * once:  条件が合う来店で一度だけ（上から順）。
 * idle:  遊べない来店（ctx.idle）で読む回。巡回は進めない。
 * pool:  順番に一本ずつ読む束。{ id, when } の回は、条件が合う時だけ読む。
 * regular: 束を読み終えた後に巡回する、顔なじみの短いやり取り。無い束は、束そのものをもう一度巡回する。
 */
export const VENUE_ARRIVALS = Object.freeze({
  // 斧投げBar（斧崎マキ）。メモは投げ終えた時の「自己ベスト」「一本も刺さらなかった」
  axe_bar: {
    notes: { record: ["axe_arrival_after_record", "axe_arrival_after_record_b"], miss: ["axe_arrival_after_miss"] },
    once: [
      // 自分の斧（三種のどれか）を買った後の最初の来店
      { id: "axe_arrival_own_axe", when: save => bestOwnedAxe(save).id !== "house" },
      // 第1章の大会を勝った後の最初の来店（第2章の間だけ）
      { id: "axe_arrival_champion", when: save => save.chapter === 2 },
      { id: "axe_arrival_rain", when: rainy },
    ],
    idle: ["axe_arrival_look"],
    pool: ["axe_arrival_whetstone", "axe_arrival_regulars", "axe_arrival_shoulders",
      { id: "axe_arrival_chalk", when: axeRecorded },
      "axe_arrival_board", "axe_arrival_grip", "axe_arrival_quiet", "axe_arrival_first_timers"],
    regular: ["axe_regular_a", "axe_regular_b", "axe_regular_c"],
  },
  // 投げ終えた後の、いつもの締め（自己ベスト・一本も刺さらなかった日は専用の場面）
  axe_bar_finish: { pool: ["axe_finish_a", "axe_finish_b", "axe_finish_c"] },
  // ボドゲカフェ（六角サイ）
  trpg_day: {
    once: TRPG_ONCE,
    pool: ["trpg_day_shelf", "trpg_day_dice", "trpg_day_family", "trpg_day_bands"],
    regular: ["trpg_day_regular_a", "trpg_day_regular_b"],
  },
  trpg_night: {
    once: TRPG_ONCE,
    idle: ["trpg_night_idle"],
    pool: ["trpg_night_lamp", "trpg_night_map", "trpg_night_tea", "trpg_night_chairs", "trpg_night_sheet", "trpg_night_other_table"],
    regular: ["trpg_night_regular_a", "trpg_night_regular_b", "trpg_night_regular_c"],
  },
  // クラブSEAM（針間ヨル）
  club_seam: {
    once: [
      { id: "club_arrival_headphones", when: owns("gear_headphones") },
      { id: "club_arrival_rain", when: rainy },
    ],
    pool: ["club_arrival_stairs", "ch3_club_floor_edge", "club_arrival_tea", "club_arrival_first_dancer",
      "ch3_club_low_corner", "club_arrival_records", "club_arrival_soundcheck", "club_arrival_request"],
    regular: ["club_regular_a", "club_regular_b", "club_regular_c"],
  },
  // ラクダレース場（ファーリスとハリール）。練習レースに通う朝
  camel_track: {
    pool: ["ch4_camel_replay", "camel_arrival_water", "camel_arrival_sand", "camel_arrival_ears"],
    regular: ["camel_regular_a", "camel_regular_b"],
  },
});

export const arrivalAtKey = venue => `_venue_arrival_at_${venue}`;
export const arrivalTurnKey = venue => `_venue_arrival_turn_${venue}`;
export const arrivalSeenKey = id => `_venue_arrival_seen_${id}`;
export const arrivalNoteKey = venue => `_venue_arrival_note_${venue}`;
const stampOf = save => `${save.chapter || 1}:${save.day}:${save.slot}`;
const entryOf = entry => typeof entry === "string" ? { id: entry } : entry;

/**
 * ブラウザテストの既定（remake/test/browser/support.mjs が "suien_roamers" を "off" にする）では、来店のやり取りと
 * 投げ終えた後の締めの会話を止める（店へ入る検査の流れを変えないため。daily/recipe-finds.js と同じ流儀）。
 * この仕組みの検査だけ "suien_venue_arrivals" を "on" にして外す。初めての来店の場面は止めない。遊ぶ時は使わない。
 */
export const arrivalsOff = () => {
  try {
    const store = globalThis.localStorage;
    return store?.getItem("suien_venue_arrivals") !== "on" && store?.getItem("suien_roamers") === "off";
  } catch { return false; }
};

/** この時間帯に、もうこの店で話したか（入り直しでは繰り返さない。メニューの一言の出し分けにも使う）。 */
export const arrivalGreeted = (venue, save = state) => !!save && save.flags[arrivalAtKey(venue)] === stampOf(save);

/** 初めての来店など、束の外の会話を読み終えた時に呼ぶ。同じ時間帯に来店のやり取りを重ねない。 */
export function markArrival(venue, save = state) {
  if (save) save.flags[arrivalAtKey(venue)] = stampOf(save);
}

/** 次の来店で受ける一言メモを残す。null なら消す。 */
export function leaveArrivalNote(venue, note, save = state) {
  if (!save) return;
  if (note) save.flags[arrivalNoteKey(venue)] = note;
  else delete save.flags[arrivalNoteKey(venue)];
}

/**
 * 束の次の一本。状態は変えない。
 * 一巡目は束の順に、台本があり条件が合う最初の回（条件が合わない回は飛ばして戻らない）。
 * 読み終えた後は、顔なじみの短いやり取り（regular）を巡回する。regular の無い束は、束をもう一度巡回する。
 */
function nextInPool(venue, save, dialogues, ctx) {
  const def = VENUE_ARRIVALS[venue] || {};
  const ok = entry => !!dialogues[entry.id]?.lines?.length && (!entry.when || entry.when(save, ctx));
  const pool = (def.pool || []).map(entryOf);
  const count = Math.max(0, Math.floor(Number(save.flags[arrivalTurnKey(venue)]) || 0));
  for (let at = count; at < pool.length; at++) if (ok(pool[at])) return { id: pool[at].id, turn: at + 1 };
  const regular = (def.regular || []).map(entryOf).filter(ok);
  const loop = regular.length ? regular : pool.filter(ok);
  if (!loop.length) return null;
  const past = Math.max(0, count - pool.length);
  return { id: loop[past % loop.length].id, turn: Math.max(count, pool.length) + 1 };
}

/**
 * 今の来店で読む一本を選ぶ。状態は変えない。読まない時は null。
 * @param ctx.rainy 雨の日か  @param ctx.idle 今は遊べない来店か（お金・体力・顔ぶれが足りない）
 */
export function pickArrival(venue, save = state, dialogues = DB.dialogues, ctx = {}) {
  const def = VENUE_ARRIVALS[venue];
  if (!def || !save || arrivalsOff() || arrivalGreeted(venue, save)) return null;
  const has = id => !!dialogues[id]?.lines?.length;
  const unseen = id => has(id) && !save.flags[arrivalSeenKey(id)];
  if (ctx.idle) {
    const id = (def.idle || []).find(has);
    return id ? { id, kind: "idle" } : null;
  }
  const noted = (def.notes?.[save.flags[arrivalNoteKey(venue)]] || []).find(unseen);
  if (noted) return { id: noted, kind: "note" };
  const once = (def.once || []).find(entry => unseen(entry.id) && entry.when(save, ctx));
  if (once) return { id: once.id, kind: "once" };
  const next = nextInPool(venue, save, dialogues, ctx);
  return next ? { ...next, kind: "pool" } : null;
}

/** 読み終えた一本を記録する（その時間帯の印・巡回の本数・一度きりの既読。メモは受けても受けなくても消す）。 */
export function commitArrival(venue, picked, save = state) {
  if (!picked || !save) return;
  markArrival(venue, save);
  if (picked.kind === "pool") save.flags[arrivalTurnKey(venue)] = picked.turn;
  if (picked.kind === "once" || picked.kind === "note") save.flags[arrivalSeenKey(picked.id)] = true;
  delete save.flags[arrivalNoteKey(venue)];
}

/** 台本の読み込みを待つ。失敗しても店には入れる（やり取りを出さないだけ）。 */
export async function readyArrivals() {
  try { await loadVenueArrivals(); return true; } catch { return false; }
}

/**
 * 来店のやり取りを一本読む。
 * @param read (id) => Promise<boolean>。場面を再生し、読み終えたら true（中断は false）。背景・中断の扱いは店ごとに違うので呼び出し側が渡す。
 * @returns 読み終えた場面の ID。読まなかった・中断した時は null（呼び出し側は自分の current() で続行を決める）。
 */
export async function playArrival(venue, { read, ctx = {}, save = state } = {}) {
  if (!save || arrivalsOff() || arrivalGreeted(venue, save) || !await readyArrivals() || state !== save) return null;
  const picked = pickArrival(venue, save, DB.dialogues, { rainy: isRainy(), ...ctx });
  if (!picked) return null;
  if (!await read(picked.id) || state !== save) return null;
  commitArrival(venue, picked, save);
  return picked.id;
}

/**
 * 束を巡回するだけの場面（投げ終えた後の締めなど）。時間帯の印は付けない。
 * @returns 読み終えた場面の ID。読まなかった・中断した時は null。
 */
export async function playVenueTurn(venue, { read, save = state } = {}) {
  if (!save || !await readyArrivals() || state !== save) return null;
  const next = nextInPool(venue, save, DB.dialogues, {});
  if (!next || !await read(next.id) || state !== save) return null;
  save.flags[arrivalTurnKey(venue)] = next.turn;
  return next.id;
}
