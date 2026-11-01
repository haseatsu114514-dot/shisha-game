// 第3章の東京到着から全国大会前夜。読了した場面だけを確定する。
// day は章内の日付。通算の value.day は startDay から換算する。
const LEGACY_SCENES = Object.freeze([
  { id: "ch3_opening", day: 1, slot: 0, label: "東京へ", location: "東京駅", bg: "bg_street_day" },
  { id: "ch3_mukai_arrival", day: 1, slot: 1, label: "mukaiの扉", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_mukai_intro", day: 2, slot: 0, label: "新しい店の朝", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_individuality_doubt", day: 2, slot: 1, label: "肩に残る勝利", location: "東京", bg: "bg_street_night" },
  { id: "ch3_tokyo_shop_gap", day: 3, slot: 0, label: "違う店の手つき", location: "東京の店", bg: "bg_hideaway" },
  { id: "ch3_double_apple_incident", day: 3, slot: 1, label: "閉店後の一台", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_rest_before_recovery", day: 4, slot: 0, label: "作れない日の席", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_daily_cup_1", day: 4, slot: 1, label: "今日の一台", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_taste_return", day: 5, slot: 1, label: "ダブルアップルの輪郭", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_abyss_recovery", day: 6, slot: 0, label: "昨日とは違う今日", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_naru_contact_before_tournament", day: 7, slot: 1, label: "自分からの電話", location: "東京", bg: "bg_street_night" },
  { id: "ch3_naru_work", day: 7, slot: 1, label: "もう一つの予選", location: "東京", bg: "bg_street_night" },
  { id: "ch3_kuze_first", day: 8, slot: 0, label: "煙幕", location: "煙幕", bg: "bg_yohaku_shop" },
  { id: "ch3_kuze_advice", day: 11, slot: 0, label: "予想の外側", location: "煙幕", bg: "bg_yohaku_shop" },
  { id: "ch3_steve_low_heat", day: 11, slot: 1, label: "待つためのタイマー", location: "Smoke & Glory", bg: "bg_steve_shop" },
  { id: "ch3_volk_first", day: 12, slot: 1, label: "鉄の煙", location: "鉄の煙", bg: "bg_volk_shop" },
  { id: "ch3_strategy", day: 13, slot: 0, label: "残したいもの", location: "mukai", bg: "bg_mukai_shop" },
  { id: "ch3_tournament_eve", day: 13, slot: 1, label: "全国大会の前夜", location: "東京", bg: "bg_street_night" },
]);
// 既存の東京セーブは旧行程を続ける。新規開始だけ中盤の積み重ねを通る。
export const CH3_INTRO_SCENES = Object.freeze([
  ...LEGACY_SCENES.slice(0, 8),
  { id: "ch3_work_without_taste", day: 5, slot: 1, label: "分かることを伝える", location: "mukai", bg: "bg_mukai_shop" },
  ...LEGACY_SCENES.slice(10, 13),
  { id: "ch3_kuze_mukai_visit", day: 9, slot: 0, label: "客席の久世", location: "mukai", bg: "bg_mukai_shop" },
  { ...LEGACY_SCENES[8], day: 10, slot: 1 },
  { ...LEGACY_SCENES[9], day: 11, slot: 0 },
  ...LEGACY_SCENES.slice(13),
]);
export const chapterThreeScenes = value => value?.flags?._ch3_intro?.routeVersion === 2
  ? CH3_INTRO_SCENES : LEGACY_SCENES;
