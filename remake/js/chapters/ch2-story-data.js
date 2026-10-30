import { AGEHA_AFFINITY_VISITS } from "../core/affinity-stages.js";
import { CITY_BACKGROUNDS, CH2_SCENE_BACKGROUNDS } from "../core/city-locations.js";
// 章内日で記す。保存日時・夜の予定表へ渡すときだけ通算日に変換する。
// あげは（#626）: 3日目（なるの祝福のあと）の偵察返し・9日目の試煙会・10日目のスランプ来店を強制の夜にする。
// 9日目はC.STATION柚ヶ谷店の客席で開くアフサール新作の先行試煙会（#929）。旧IDと読了フラグは保存互換のため維持。
// 2日目と8日目の夜は、TRPGなど自由に使える夜として空けておく（#639）。
// #1652: 事故・決裂・試煙会・前夜など前後すると成立しない転機は固定。DAY6の残る匂い・DAY7のアダム・DAY12のみんとは
// 訪問・会話なので preparation にし、休養や夜の約束で後送りできる。deadline（章内日）までに必ず読み、大会後へ持ち越さない。
// 後送りした夜は CH2_FREE_NIGHTS（DAY2・8）に入れない（期限の救済を除く）。
export const CH2_FREE_NIGHTS = [2, 8];
// room は会話の前に出す店内（.webp の店内画は metadata.bg で指定できないため）。bg は店内以外の場所の背景。contact はその夜に連絡先も交換する。
// #921の柚ヶ谷店の客席を夜景にした背景。県大会ホールや地元店と区別する。
export const C_STATION_TASTING_BG = CITY_BACKGROUNDS.c_station_night;
export const CH2_NIGHTS = [
  { day: 3, pin: "naru", label: "なるの祝福", beat: "夜。なるの話を聞きに、KEMURIKUSAへ──", doneFlag: "_ch2_naru_warm_done", steps: [
    { id: "ch2_naru_warm", file: "ch2_isolation" },
    { id: "remake_ch2_ageha_scout", file: "ch2_ageha_story", contact: "ageha" },
  ] },
  { day: 4, pin: "tonari", label: "焦げたソファ", beat: "夜。預けていたノートを取りに、閉店前のtonariへ──", steps: [
    { id: "ch2_sofa_burn", file: "ch2_main" },
    { id: "ch2_abyss_baito", file: "ch2_main" },
  ] },
  { day: 5, pin: "tonari", label: "遠くなった味", beat: "夜。閉店間際のtonariへ──", steps: [
    // #929: 閉店前に神崎が挨拶に来て、前夜の事故を聞く。味の不調を先に読んだ保存では順序を戻さない
    { id: "ch2_kumicho_greeting", file: "ch2_main", when: ({ flags }) => !flags._ch2_read_ch2_slump_taste },
    { id: "ch2_slump_taste", file: "ch2_main", flag: "_ch2_taste_distant" },
  ] },
  { day: 6, schedule: "preparation", deadline: 7, pin: "tonari", label: "残る匂い", beat: "夜。残る匂いのことが気になって、tonariへ──", prerequisites: ["_ch2_read_ch2_sofa_burn"], steps: [
    { id: "ch2_lingering_smell", file: "ch2_main" },
  ] },
  { day: 7, schedule: "preparation", deadline: 12, pin: "adam", label: "アダムとの距離", beat: "夜。アダムの試作を味わいに、EDENへ──", steps: [
    { id: "ch2_adam_distance", file: "ch2_isolation" },
  ] },
  { day: 9, pin: "ch2_c_station", label: "アフサール新作の試煙会", beat: "夜。C.STATIONの試煙会へ──", steps: [
    { id: "remake_ch2_ageha_tasting", file: "ch2_ageha_story", bg: C_STATION_TASTING_BG },
  ] },
  { day: 10, pin: "tonari", label: "スミさんの沈黙", beat: "夜。配合ノートを受け取りに、tonariへ──", steps: [
    // #1733: ノートを受け取りに寄った閉店間際にあげはが来る→駅まで送って店へ戻り、半分灯りの落ちた店でスミさんの話を聞く
    { id: "remake_ch2_ageha_slump", file: "ch2_ageha_story" },
    { id: "ch2_sumi_silence", file: "ch2_main" },
  ] },
  { day: 11, pin: "naru", label: "なるの言葉", beat: "夜。試作の話をしに、KEMURIKUSAへ──", steps: [
    { id: "ch2_naru_confrontation", file: "ch2_isolation" },
  ] },
  { day: 12, schedule: "preparation", deadline: 13, pin: "minto", label: "みんとの心配", beat: "夜。みんとの様子を見に、PEPPERMINTへ──", steps: [
    { id: "ch2_minto_warning", file: "ch2_isolation" },
    // #929: 帰り道のケムリクサ。DAY11の選択の記録がある時だけ、距離の違いを見せる
    { id: "ch2_naru_window", file: "ch2_isolation", bg: CH2_SCENE_BACKGROUNDS.naruWindow, when: ({ flags }) =>
      !flags._ch2_read_ch2_tsumugi_color && !!(flags._ch2_naru_listened || flags._ch2_naru_hurt) },
  ] },
  { day: 13, pin: "tonari", label: "大会前夜", beat: "夜。大会前夜のtonariへ──", steps: [
    { id: "ch2_tsumugi_color", file: "ch2_isolation" },
    { id: "remake_ch2_eve_arrival", file: "remake_ch2", bg: CH2_SCENE_BACKGROUNDS.venueBench },
    // #929: あげはが搬入の確認へ行った間に、REIと一曲。前夜を読み終えた保存には足さない
    { id: "remake_ch2_eve_rei", file: "remake_ch2", bg: CH2_SCENE_BACKGROUNDS.venueBench, when: ({ flags }) =>
      !flags._ch2_read_ch2_pre_tournament_realisation && !flags._ch2_eve_done },
    { id: "remake_ch2_eve_choices", file: "ch2_choice_echoes", when: ({ flags }) =>
      !flags._ch2_read_ch2_pre_tournament_realisation && !flags._ch2_eve_done
      && !!(flags._ch2_rest_taken || flags._ch2_naru_listened || flags._ch2_naru_hurt) },
    { id: "ch2_pre_tournament_realisation", file: "ch2_main", bg: CH2_SCENE_BACKGROUNDS.venueBench, flag: "_ch2_eve_done" },
  ] },
];

// あげはの店に通う回（初回・続編のあと、この順に一度ずつ）。7日目以降は先に「ダメな日」を挟む。
export const AGEHA_VISITS = AGEHA_AFFINITY_VISITS;
export const AGEHA_BADDAY = { id: "remake_ch2_ageha_badday", fromDay: 7 };
const VIBES = ["scout", "gyaru", "newcomer", "magazine"];

/** バイブスの答え合わせで2回以上当てたら、試煙会であげはが不安を少し話す */
export function syncAgehaVibes(flags) {
  const hits = VIBES.filter((id) => flags[`_ch2_vibes_hit_${id}`]).length;
  if (hits >= 2) flags._ch2_vibes_understood = true;
  return hits;
}

/** あげはの店の3回目以降に読む場面（なければ null＝いつもの会話）。章内日 day が7以上なら「ダメな日」を先に */
export function agehaStoryScene(save, day, dialogues) {
  const unread = (id) => !!dialogues[id]?.lines?.length && !save.flags?.[`_ch2_read_${id}`];
  if (day >= AGEHA_BADDAY.fromDay && unread(AGEHA_BADDAY.id)) return AGEHA_BADDAY.id;
  const next = AGEHA_VISITS.find(id => !save.flags?.[`_ch2_read_${id}`]);
  const required = AGEHA_VISITS.indexOf(next) + 2;
  // 次の実会話の♥を満たすまで、いつもの会話。欠落原稿を飛ばして後段へ進めない。
  const threshold = [0, 9, 20, 33, 48, 66][required];
  return next && unread(next) && (save.affinity?.ageha || 0) >= threshold ? next : null;
}
