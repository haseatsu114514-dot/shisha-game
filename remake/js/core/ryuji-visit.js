// 実際の挨拶回と、その来店枠だけの在店。面識・好感度から既読を推測しない。
export const visitStamp = value => `${value.chapter}:${value.day}:${value.slot}`;
export function ryujiGreetingDue(value) {
  const start = value.flags._ch2_day1?.startDay;
  return value.chapter === 2 && Number.isInteger(start) && value.day > start && value.day < start + 13
    && !!value.flags._ageha_first_purikura && !!value.met.ageha && !!value.met.kumicho && !value.flags._ryuji_melty_greeting;
}
export function ryujiAtMeltyPuff(value) {
  return ryujiGreetingDue(value) || value.chapter === 2 && value.flags._ryuji_melty_visit === visitStamp(value);
}
// クラウドの挨拶回（#3468 A案）。組長の挨拶と同じ窓で、組長の挨拶と同じ日には重ねない。場面の中で撮り終えて帰る。
export function reiGreetingDue(value) {
  const start = value.flags._ch2_day1?.startDay;
  return value.chapter === 2 && Number.isInteger(start) && value.day > start && value.day < start + 13
    && !!value.flags._ageha_first_purikura && !!value.met.ageha && !!value.met.rei && !value.flags._rei_melty_greeting
    && !ryujiGreetingDue(value) && !String(value.flags._ryuji_melty_visit || "").startsWith(`${value.chapter}:${value.day}:`);
}
/** 挨拶回を読んだ日より後の零-ZERO-の来店で、シールの後日の一言をまだ読んでいない。 */
export const reiStickerDue = value => Number.isInteger(value.flags._rei_melty_greeting)
  && value.day > value.flags._rei_melty_greeting && !value.flags._rei_purikura_after;
