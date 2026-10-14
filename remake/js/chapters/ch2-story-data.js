// 章内日で記す。保存日時・夜の予定表へ渡すときだけ通算日に変換する。
export const CH2_NIGHTS = [
  { day: 3, pin: "naru", label: "なるの祝福", doneFlag: "_ch2_naru_warm_done", steps: [
    { id: "ch2_naru_warm", file: "ch2_isolation" },
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
  { day: 10, pin: "tonari", label: "スミさんの沈黙", steps: [
    { id: "ch2_sumi_silence", file: "ch2_main" },
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
    { id: "ch2_pre_tournament_realisation", file: "ch2_main", flag: "_ch2_eve_done" },
  ] },
];
