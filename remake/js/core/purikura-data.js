// MELTY PUFF のプリクラの写真（PFC18・#3941）。画面を持たない定義だけを置く（撮影・ギャラリーが共通で読む）。
// 撮るたびに、撮った相手の写真のうち、まだ撮っていないものから1枚（そろった後は同じ相手の写真からもう一度）。
// with: "solo"（一人）／"ageha"（あげはと撮る）／居合わせた相手の id。
// trio: 組長と撮る時に、あげはが入って3人で撮る一枚（専用の台本）。slot: その時間帯にだけ撮れる（1＝夜。ひよりの会社帰り）。
// lover: 恋人の距離感の一枚（その相手が恋人の時だけ出す。恋人の時は友達の写真は出さない・PFC19/20）。
// first: その相手と初めて撮る時に必ず出す一枚（ソロの「一人で初挑戦！」）。
// 絵の元は asset_sources/photo-frames-3941/gen-20261127/ の候補（オーナー選定 2026-11-27）。
const photo = (cg, partner, label, extra = {}) => Object.freeze({ cg: `cg_purikura_${cg}`, with: partner, label, ...extra });

export const PURIKURA_PHOTOS = Object.freeze([
  photo("solo_first", "solo", "ソロぷり初挑戦", { first: true }),
  photo("solo_kimegao", "solo", "ソロぷり・キメ顔練習"),
  photo("solo_morisugi", "solo", "ソロぷり・盛れすぎ注意"),
  photo("solo_yubiheart", "solo", "ソロぷり・指ハート習得"),
  photo("solo_ageha_kanshu", "solo", "ソロぷり・あげは監修"),
  photo("solo_kiai", "solo", "ソロぷり・大会前の気合い"),
  photo("ageha_gyarupi", "ageha", "あげはとギャルピ伝授"),
  photo("ageha_half_heart", "ageha", "あげはと半分こハート"),
  photo("ageha_mori", "ageha", "あげはと盛れ顔"),
  photo("ageha_henkao", "ageha", "あげはと変顔対決"),
  photo("ageha_kumamimi", "ageha", "あげはとクマ耳おそろ"),
  photo("ageha_senaka", "ageha", "あげはと背中合わせ"),
  photo("ageha_bikkuri", "ageha", "あげはとびっくり顔"),
  photo("ageha_peace_takasa", "ageha", "あげはとピースの高さ対決"),
  photo("ageha_lover_heart", "ageha", "恋人のあげはと半分こハート", { lover: true }),
  photo("ageha_lover_backhug", "ageha", "恋人のあげはとバックハグ", { lover: true }),
  photo("ageha_lover_odeko", "ageha", "恋人のあげはと、ずっといっしょ", { lover: true }),
  photo("ageha_lover_chu", "ageha", "恋人のあげはと、ちゅー未遂", { lover: true }),
  photo("kumicho_kinen", "kumicho", "神崎と記念の一枚"),
  photo("kumicho_trio", "kumicho", "あげはと神崎と3人で", { trio: true }),
  photo("tsumugi_nigaoe", "tsumugi", "つむぎの似顔絵"),
  photo("tsumugi_neko", "tsumugi", "つむぎの落書きでネコ化"),
  photo("tsumugi_lover_kata", "tsumugi", "恋人のつむぎと肩よせ", { lover: true }),
  photo("tsumugi_lover_te", "tsumugi", "恋人のつむぎと手つなぎ", { lover: true }),
  photo("rio_tamaniwa", "rio", "凛想とたまには"),
  photo("rio_record", "rio", "凛想と記録更新"),
  photo("rio_lover_yorikakari", "rio", "恋人の凛想と寄りかかり", { lover: true }),
  photo("rio_lover_hoho", "rio", "恋人の凛想と頬よせ", { lover: true }),
  photo("hiyori_naisho", "hiyori", "ひよりとないしょの一枚"),
  photo("hiyori_otsukare", "hiyori", "ひよりと会社帰り", { slot: 1 }),
  photo("hiyori_lover_ude", "hiyori", "恋人のひよりと腕組み", { lover: true }),
  photo("hiyori_lover_heart", "hiyori", "恋人のひよりとハート", { lover: true }),
]);

/** ギャラリーの人物の札（core/gallery-catalog.js の CHAR_LABELS にある人だけ。ほかは「その他」） */
export const PURIKURA_CHAR = Object.freeze({ ageha: "ageha", tsumugi: "tsumugi", rio: "rio" });
