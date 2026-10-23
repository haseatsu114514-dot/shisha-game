// 章内日で記す。保存日時・夜の予定表へ渡すときだけ通算日に変換する。
// あげは（#626）: 3日目（なるの祝福のあと）の偵察返し・9日目の試飲会・10日目のスランプ来店を強制の夜にする。
// 2日目と8日目の夜は、TRPGなど自由に使える夜として空けておく（#639）。
// room は会話の前に出す店内（.webp の店内画は metadata.bg で指定できないため）。contact はその夜に連絡先も交換する。
export const CH2_NIGHTS = [
  { day: 3, pin: "naru", label: "なるの祝福", doneFlag: "_ch2_naru_warm_done", steps: [
    { id: "ch2_naru_warm", file: "ch2_isolation" },
    { id: "remake_ch2_ageha_scout", file: "ch2_ageha_story", contact: "ageha" },
  ] },
  { day: 4, pin: "tonari", label: "焦げたソファ", steps: [
    { id: "ch2_sofa_burn", file: "ch2_main" },
    { id: "ch2_abyss_baito", file: "ch2_main" },
  ] },
  { day: 5, pin: "tonari", label: "遠くなった味", steps: [
    { id: "ch2_slump_taste", file: "ch2_main", flag: "_ch2_taste_distant" },
  ] },
  { day: 6, pin: "tonari", label: "残る匂い", prerequisites: ["_ch2_read_ch2_sofa_burn"], steps: [
    { id: "ch2_lingering_smell", file: "ch2_main" },
  ] },
  { day: 7, pin: "adam", label: "アダムとの距離", steps: [
    { id: "ch2_adam_distance", file: "ch2_isolation" },
  ] },
  { day: 9, pin: "ch2_ageha", label: "店長同士の試飲会", steps: [
    { id: "remake_ch2_ageha_tasting", file: "ch2_ageha_story", room: "ageha" },
  ] },
  { day: 10, pin: "tonari", label: "スミさんの沈黙", steps: [
    { id: "ch2_sumi_silence", file: "ch2_main" },
    { id: "remake_ch2_ageha_slump", file: "ch2_ageha_story" },
  ] },
  { day: 11, pin: "naru", label: "なるの言葉", steps: [
    { id: "ch2_naru_confrontation", file: "ch2_isolation" },
  ] },
  { day: 12, pin: "minto", label: "みんとの心配", steps: [
    { id: "ch2_minto_warning", file: "ch2_isolation" },
  ] },
  { day: 13, pin: "tonari", label: "大会前夜", steps: [
    { id: "ch2_tsumugi_color", file: "ch2_isolation" },
    { id: "remake_ch2_eve_arrival", file: "remake_ch2" },
    { id: "remake_ch2_eve_choices", file: "ch2_choice_echoes", when: ({ flags }) =>
      !flags._ch2_read_ch2_pre_tournament_realisation && !flags._ch2_eve_done
      && !!(flags._ch2_rest_taken || flags._ch2_naru_listened || flags._ch2_naru_hurt) },
    { id: "ch2_pre_tournament_realisation", file: "ch2_main", flag: "_ch2_eve_done" },
  ] },
];

// あげはの店に通う回（初回・続編のあと、この順に一度ずつ）。7日目以降は先に「ダメな日」を挟む。
export const AGEHA_VISITS = ["remake_ch2_ageha_gyaru", "remake_ch2_ageha_newcomer", "remake_ch2_ageha_magazine"];
export const AGEHA_BADDAY = { id: "remake_ch2_ageha_badday", fromDay: 7 };
const VIBES = ["scout", "gyaru", "newcomer", "magazine"];

/** バイブスの答え合わせで2回以上当てたら、試飲会であげはが不安を少し話す */
export function syncAgehaVibes(flags) {
  const hits = VIBES.filter((id) => flags[`_ch2_vibes_hit_${id}`]).length;
  if (hits >= 2) flags._ch2_vibes_understood = true;
  return hits;
}

/** あげはの店の3回目以降に読む場面（なければ null＝いつもの会話）。章内日 day が7以上なら「ダメな日」を先に */
export function agehaStoryScene(save, day, dialogues) {
  const unread = (id) => !!dialogues[id]?.lines?.length && !save.flags?.[`_ch2_read_${id}`];
  if (day >= AGEHA_BADDAY.fromDay && unread(AGEHA_BADDAY.id)) return AGEHA_BADDAY.id;
  return AGEHA_VISITS.find(unread) || null;
}
