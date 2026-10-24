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
