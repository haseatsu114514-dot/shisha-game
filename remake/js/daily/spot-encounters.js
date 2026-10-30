// 施設の寄り道会話。会った事実と小さな選択だけを保存し、好感度や店の進行は扱わない。
const ENCOUNTERS = {
  cafe: [
    { id: "cafe_naru_break", met: "naru" },
    { id: "cafe_maezono_break" },
    { id: "cafe_master_quiz" },
  ],
  kannon: [
    { id: "kannon_adam", met: "adam", slot: 0 },
    { id: "kannon_oldman", slot: 0 },
    // パッキーのアプリ導入後: 観音堂で設定が変わることをアダムが匂わせる（#621）
    { id: "kannon_adam_pakki", met: "adam", flag: "pakki_app_installed", slot: 0 },
  ],
  choizap: [
    { id: "choizap_minto", met: "minto", flag: "_minto_identity_revealed" },
    { id: "choizap_naru", met: "naru" },
    { id: "choizap_oldman" },
  ],
  c_station: [
    // 博士の二面性をそれとなく見せる一度きりの回（#1696）。面識は登録時の顔合わせか大会でできる。
    { id: "cs_kemuri_sample", met: "dr_kemuri" },
  ],
};

const FOLLOWUPS = {
  naru: { source: "cafe_naru_break", id: "cafe_naru_followup" },
  adam: { source: "kannon_adam", id: "kannon_adam_followup" },
  minto: { source: "choizap_minto", id: "choizap_minto_followup", flag: "_minto_identity_revealed" },
};

const seenKey = (id) => `_spot_seen_${id}`;

/** 初回は場所の紹介。再訪から未読を一つずつ、必ず一回以上の静かな訪問を挟む。 */
export function spotEncounterDue(spotId, visit, save, dialogues) {
  if (visit < 2 || spotId === "choizap" && !save.flags._gym_member) return null;
  const last = Number(save.flags[`_spot_last_${spotId}`]) || 0;
  if (last && visit - last < 2) return null;
  return ENCOUNTERS[spotId]?.find(({ id, met, flag, slot }) => dialogues[id] && (slot === undefined || (save.slot ?? 0) === slot)
    && !save.flags[seenKey(id)] && (!met || save.met[met]) && (!flag || save.flags[flag]))?.id || null;
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
  const event = FOLLOWUPS[charId];
  return event && dialogues[event.id] && save.flags[seenKey(event.source)]
    && !save.flags[`_spot_follow_${charId}`] && (!event.flag || save.flags[event.flag]) ? event.id : null;
}
