// 施設の寄り道会話。会った事実と小さな選択だけを保存し、好感度や店の進行は扱わない。
// chapter はその章の間だけ読む回（第2章の地元・VOL13。台本は data/dialogue/ch2_home.json を第2章の準備期間に読み込む）。
// 章の回を先に並べ、その章の間は前の章の残りより先に読む。
// met は一人でも配列でもよい（街の人同士の絡みは、はじめが全員と面識のある時だけ）。
// rioIn は凛想が街にいる日だけ（出張の日は出さない）。相関の正本は brand/character_profiles.md「キャラ同士のつながり」。
// この部品は import を持たない（単体で読み込む検査が多い）ので、出張の曜日は core/rules.js の RIO_AWAY_DAY の写し。
// 一致は remake/test/town_ties.mjs が検査する。
export const RIO_AWAY_DAY_COPY = 2;

const ENCOUNTERS = {
  cafe: [
    { id: "cafe_ch2_commute", chapter: 2 },
    // 味の不調（第2章DAY5の夜から）を知っている時だけ
    { id: "cafe_ch2_taste", chapter: 2, flag: "_ch2_taste_distant" },
    { id: "cafe_naru_break", met: "naru", rift: true },
    // 仕入れ帰りのなると、持ち帰りのコーヒーを買いに来た凛想（REL01）
    { id: "cafe_naru_rio", met: ["naru", "rio"], rift: true, rioIn: true },
    { id: "cafe_maezono_break" },
    { id: "cafe_master_quiz" },
  ],
  kannon: [
    { id: "kannon_ch2_wish", chapter: 2, slot: 0 },
    { id: "kannon_adam", met: "adam", slot: 0 },
    // 荷が届いた話（EDENでの続き）を聞いた後。なるがアダムに昼飯を食べさせている（REL02）
    { id: "kannon_adam_lunch", met: ["adam", "naru"], flag: "_spot_follow_adam", slot: 0, rift: true },
    { id: "kannon_oldman", slot: 0 },
    // パッキーのアプリ導入後: アダムと携帯を置いて振り返る（既読ID・出現条件は維持）
    { id: "kannon_adam_pakki", met: "adam", flag: "pakki_app_installed", slot: 0 },
  ],
  choizap: [
    { id: "choizap_ch2_numbers", chapter: 2 },
    { id: "choizap_minto", met: "minto", flag: "_minto_identity_revealed" },
    { id: "choizap_naru", met: "naru", rift: true },
    { id: "choizap_oldman" },
  ],
  c_station: [
    // 県大会のポスターと課題の苺の噂（第2章）
    { id: "cs_ch2_haze", chapter: 2 },
    // 博士の二面性をそれとなく見せる一度きりの回（#1696）。面識は登録時の顔合わせか大会でできる。
    { id: "cs_kemuri_sample", met: "dr_kemuri" },
  ],
};

// 店での続き。source の回を読んだ後、その店主の店の来店の冒頭で一度だけ拾う（一来店に一本）。
// done は既読の旗（台本の末尾の set_flag と同じ名前。無ければ `_spot_follow_<店主>`）。
const FOLLOWUPS = {
  naru: [
    { source: "cafe_naru_break", id: "cafe_naru_followup" },
    { source: "cafe_naru_rio", id: "cafe_naru_rio_followup", done: "_spot_follow_naru_rio", rift: true },
  ],
  adam: [
    { source: "kannon_adam", id: "kannon_adam_followup" },
    { source: "kannon_adam_lunch", id: "kannon_adam_lunch_followup", done: "_spot_follow_adam_lunch", rift: true },
  ],
  minto: [
    { source: "choizap_minto", id: "choizap_minto_followup", flag: "_minto_identity_revealed" },
    // サメちゃんの店で開店祝いの鉢植えの話を聞いた後（REL03。source は daily/samechan.js の来店の話）
    { source: "samechan_shop_minto_gift", id: "samechan_minto_followup", done: "_spot_follow_minto_samechan" },
    // ひよりの相席で奥の席を勧めた夜の後（#3468 B案。source は daily/hiyori.js の相席）。ひよりが自分から同じ席にいる
    { source: "hiyori_shop_minto_seat", id: "hiyori_minto_seat_followup", done: "_spot_follow_minto_hiyori" },
  ],
  rio: [
    { source: "cafe_naru_rio", id: "cafe_naru_rio_followup_rio", done: "_spot_follow_rio_naru" },
  ],
};

const seenKey = (id) => `_spot_seen_${id}`;
// #2090: 第2章の対峙（決裂）以降、なるは店を閉めて修行に出ている。施設でもばったり会わない（rift の回）。
// daily/spots.js の naruRiftActive と同じ条件の写し（この部品は state を読まず、保存値だけで決める）。
const naruRift = (save) => (save?.chapter || 1) >= 2 && !!(save?.flags?._ch2_read_ch2_naru_confrontation
  || save?.flags?._ch2_night_11_done || save?.flags?._ch2_naru_listened || save?.flags?._ch2_naru_hurt);

/** 初回は場所の紹介。再訪から未読を一つずつ、必ず一回以上の静かな訪問を挟む。 */
export function spotEncounterDue(spotId, visit, save, dialogues, { wide = false } = {}) {
  if (visit < 2 || spotId === "choizap" && !save.flags._gym_member) return null;
  const last = Number(save.flags[`_spot_last_${spotId}`]) || 0;
  if (last && visit - last < (wide ? 1 : 2)) return null;
  return ENCOUNTERS[spotId]?.find(({ id, met, flag, slot, chapter, rift, rioIn }) => dialogues[id] && (slot === undefined || (save.slot ?? 0) === slot)
    && !(rift && naruRift(save))
    && !(rioIn && save.day % 7 === RIO_AWAY_DAY_COPY)
    && (chapter === undefined || (save.chapter || 1) === chapter)
    && !save.flags[seenKey(id)] && [met].flat().every((who) => !who || save.met[who]) && (!flag || save.flags[flag]))?.id || null;
}

/** 遭遇回を従来の循環から外す。未開示のみんとや読了済みの選択を再生しない。 */
export function quietSpotPool(spot, slot = 0) {
  const ids = new Set((ENCOUNTERS[spot.id] || []).map(({ id }) => id));
  return (slot === 1 && spot.nightPool || spot.pool || []).filter((id) => !ids.has(id));
}

/** 台本末尾へ実際に到達したときだけ間隔を記録。途中で閉じた回・雨で延期した回は残す。 */
export function recordSpotEncounter(spotId, id, visit, save) {
  if (ENCOUNTERS[spotId]?.some((event) => event.id === id) && save.flags[seenKey(id)]) {
    save.flags[`_spot_last_${spotId}`] = visit;
  }
}

/** 通常の来店の冒頭で一度だけ拾う。旧セーブの訪問回数から会った事実を作らない。 */
export function spotFollowupDue(charId, save, dialogues) {
  return FOLLOWUPS[charId]?.find((event) => dialogues[event.id] && save.flags[seenKey(event.source)]
    && !save.flags[event.done || `_spot_follow_${charId}`] && (!event.flag || save.flags[event.flag])
    && !(event.rift && naruRift(save)))?.id || null;
}
