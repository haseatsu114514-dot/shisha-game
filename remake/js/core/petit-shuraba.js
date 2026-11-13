// プチ修羅場の決まり（純粋。DOM・保存・再生に触れない）。2026-11-11 オーナー「プチ修羅場みたいなのも導入したい」→「全部入れよう」（SRB10〜）。
// 恋人が2人以上いる間に起きる、バレかける小さな場面。どれも一度きりで、行動・体力・能力の報酬は無い。
// 途中では謝罪・和解・破局を決めない（本格的な修羅場は第5章の打ち上げかスタッフロールの後）。
// 読んだ場面は数えておき、最後の修羅場で一行ずつ返る（台本 ch5_party_shuraba_open・shuraba_open の条件行が _petit_seen_* を読む）。
// 再生と差し込み口は daily/petit-shuraba.js、台本は data/dialogue/petit_shuraba.json。
import { relationshipElapsedDay } from "./chapter-clock.js";

export const PETIT_COUNT_FLAG = "_petit_count";   // 読んだ数
export const PETIT_LAST_FLAG = "_petit_last_day"; // 最後に読んだ通算日（続けて起こさない）
export const PETIT_GAP_DAYS = 2;                  // 前のプチ修羅場から空ける日数
/** 「気づきかけ」のある恋人（data/story_routes.json の heroine_ids と同じ8人。petit_shuraba.mjs が一致を確かめる） */
export const PETIT_NOTICE_IDS = Object.freeze(["tsumugi", "minto", "rio", "ageha", "mashiro", "samechan", "hiyori", "noor"]);
export const PETIT_KEYS = Object.freeze(["date_call", "lime_misfire", "cross", "sumi", "cinema", "naru",
  ...PETIT_NOTICE_IDS.map(id => `notice_${id}`)]);
export const petitSeenFlag = key => `_petit_seen_${key}`;
export const PETIT_NOTICE_FLAG = "_petit_seen_notice"; // 「気づきかけ」を一つでも読んだ

// 地元の街で会える恋人（東京のましろ・ドバイのヌールは、地元の店や映画館には居合わせない）
const LOCALS = Object.freeze(["tsumugi", "minto", "rio", "ageha", "samechan", "hiyori"]);
/** デート中の着信で、相手ごとの一言がある人（petit_date_call_<ID>） */
export const PETIT_CALL_PARTNERS = Object.freeze(["tsumugi", "minto", "rio", "ageha", "samechan", "hiyori", "mashiro"]);
/** 居合わせ: 自分の店で迎える恋人（petit_cross_host_<ID>）と、客として来る恋人（petit_cross_guest_<ID>） */
export const PETIT_CROSS_HOSTS = Object.freeze(["minto", "rio", "ageha", "samechan"]);
export const PETIT_CROSS_GUESTS = LOCALS;

/** 台本（data/dialogue/petit_shuraba.json）の場面。再生する側が、使う時にまとめて読む。 */
export const PETIT_SCENES = Object.freeze([
  ...PETIT_NOTICE_IDS.map(id => `petit_notice_${id}`),
  "petit_date_call", ...PETIT_CALL_PARTNERS.map(id => `petit_date_call_${id}`), "petit_date_call_close",
  "petit_lime_misfire_open", "petit_lime_misfire_close",
  "petit_cross_open", ...PETIT_CROSS_HOSTS.map(id => `petit_cross_host_${id}`),
  ...PETIT_CROSS_GUESTS.map(id => `petit_cross_guest_${id}`), "petit_cross_close",
  "petit_sumi_reservation", "petit_cinema_row", "petit_naru_warning",
]);

/** いくつかの台本を、一つの会話につなぐ（選択肢の枝は、それを持つ台本のものをそのまま使う）。足りなければ null。 */
export function joinPetitScenes(dialogues, ids) {
  const parts = ids.map(id => dialogues[id]);
  if (parts.some(part => !part?.lines?.length)) return null;
  return { dialogue_id: ids[0], lines: parts.flatMap(part => part.lines), branches: Object.assign({}, ...parts.map(part => part.branches || {})) };
}

const loversOf = value => [...new Set(value?.lovers || [])];
const localLovers = value => loversOf(value).filter(id => LOCALS.includes(id));
/** 通算の日付（章をまたいで数える）。 */
export const petitToday = value => relationshipElapsedDay(value);

/** プチ修羅場が起きうる保存か: 恋人が2人以上いて、まだ表に出ていない（修羅場が済んだ後は起きない）。 */
export const petitActive = value => loversOf(value).length >= 2 && !value?.flags?._story_shuraba_unresolved;

/** この場面を今読めるか: 未読で、前のプチ修羅場から PETIT_GAP_DAYS 日以上空いている。 */
export function petitOpen(value, key, today = petitToday(value)) {
  if (!PETIT_KEYS.includes(key) || !petitActive(value) || value.flags[petitSeenFlag(key)]) return false;
  const last = value.flags[PETIT_LAST_FLAG];
  return !Number.isFinite(last) || !Number.isFinite(today) || today - last >= PETIT_GAP_DAYS;
}

export const petitCount = value => Number(value?.flags?.[PETIT_COUNT_FLAG]) || 0;

/** 読み終えた場面を記録する（一度きり）。記録したら true。 */
export function markPetit(value, key, today = petitToday(value)) {
  if (!PETIT_KEYS.includes(key) || !value?.flags || value.flags[petitSeenFlag(key)]) return false;
  value.flags[petitSeenFlag(key)] = true;
  if (key.startsWith("notice_")) value.flags[PETIT_NOTICE_FLAG] = true; // 誰かの「気づきかけ」を読んだ（最後の修羅場の一行）
  value.flags[PETIT_COUNT_FLAG] = petitCount(value) + 1;
  if (Number.isFinite(today)) value.flags[PETIT_LAST_FLAG] = today;
  return true;
}

/**
 * 恋人 id と過ごした時間（デート・mukai でましろと過ごす）の終わりに読む場面を一つ選ぶ。無ければ null。
 * 順番: デート中の着信 → その人の「気づきかけ」→ 帰り道のLIMEの誤爆 → ドバイのヌールからのテレビ電話。
 */
export function petitAfterDatePick(value, id, today = petitToday(value)) {
  const lovers = loversOf(value);
  const others = lovers.filter(other => other !== id);
  if (!lovers.includes(id) || !others.length) return null;
  if (PETIT_CALL_PARTNERS.includes(id) && petitOpen(value, "date_call", today)) return { key: "date_call", kind: "call", partner: id };
  if (PETIT_NOTICE_IDS.includes(id) && petitOpen(value, `notice_${id}`, today)) return { key: `notice_${id}`, kind: "notice", who: id };
  if (petitOpen(value, "lime_misfire", today)) return { key: "lime_misfire", kind: "misfire", to: others[0] };
  if (id !== "noor" && others.includes("noor") && petitOpen(value, "notice_noor", today)) return { key: "notice_noor", kind: "notice", who: "noor" };
  return null;
}

/**
 * 店や施設の訪問の後に読む場面を一つ選ぶ。無ければ null。
 * place: { kind: "tonari" } / { kind: "cinema" } / { kind: "shop", who: 店の人のID }
 * スミさんの予約表・映画館・なるの釘は、地元で会える恋人が2人以上いる時だけ（同じ街で見られる・同じ店に来る話なので）。
 */
export function petitAfterVisitPick(value, place, today = petitToday(value)) {
  if (!place || !petitActive(value)) return null;
  const locals = localLovers(value);
  const scene = (key, id) => petitOpen(value, key, today) ? { key, kind: "scene", scene: id } : null;
  // tonari の予約: 第5章のつむぎは tonari で働いているので、予約を入れる側には数えない
  const bookers = locals.filter(id => !(id === "tsumugi" && (value.chapter || 1) >= 5));
  if (place.kind === "tonari") return bookers.length >= 2 ? scene("sumi", "petit_sumi_reservation") : null;
  if (place.kind === "cinema") return locals.length >= 2 ? scene("cinema", "petit_cinema_row") : null;
  if (place.who === "naru") return locals.length >= 2 ? scene("naru", "petit_naru_warning") : null;
  if (PETIT_CROSS_HOSTS.includes(place.who) && loversOf(value).includes(place.who) && petitOpen(value, "cross", today)) {
    const guest = locals.find(id => id !== place.who);
    if (guest) return { key: "cross", kind: "cross", host: place.who, guest };
  }
  return null;
}
