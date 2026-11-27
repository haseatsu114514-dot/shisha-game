// MELTY PUFF のプリクラの写真（PFC18・#3941）。画面を持たない定義だけを置く（撮影・ギャラリーが共通で読む）。
// 撮るたびに、撮った相手の写真のうち、まだ撮っていないものから1枚（そろった後は同じ相手の写真からもう一度）。
// with: "solo"（一人）／"ageha"（あげはと撮る）／居合わせた相手の id。
// trio: 組長と撮る時に、あげはが入って3人で撮る一枚（専用の台本）。slot: その時間帯にだけ撮れる（1＝夜。ひよりの会社帰り）。
// 絵の元は asset_sources/photo-frames-3941/gen-20261127/ の候補（オーナー選定 2026-11-27）。
const photo = (cg, partner, label, extra = {}) => Object.freeze({ cg: `cg_purikura_${cg}`, with: partner, label, ...extra });

export const PURIKURA_PHOTOS = Object.freeze([
  photo("solo_first", "solo", "ソロぷり初挑戦"),
  photo("ageha_gyarupi", "ageha", "あげはとギャルピ伝授"),
  photo("ageha_half_heart", "ageha", "あげはと半分こハート"),
  photo("ageha_mori", "ageha", "あげはと盛れ顔"),
  photo("ageha_henkao", "ageha", "あげはと変顔対決"),
  photo("kumicho_kinen", "kumicho", "神崎と記念の一枚"),
  photo("kumicho_trio", "kumicho", "あげはと神崎と3人で", { trio: true }),
  photo("tsumugi_nigaoe", "tsumugi", "つむぎの似顔絵"),
  photo("tsumugi_neko", "tsumugi", "つむぎの落書きでネコ化"),
  photo("rio_tamaniwa", "rio", "凛想とたまには"),
  photo("rio_record", "rio", "凛想と記録更新"),
  photo("hiyori_naisho", "hiyori", "ひよりとないしょの一枚"),
  photo("hiyori_otsukare", "hiyori", "ひよりと会社帰り", { slot: 1 }),
]);

/** ギャラリーの人物の札（core/gallery-catalog.js の CHAR_LABELS にある人だけ。ほかは「その他」） */
export const PURIKURA_CHAR = Object.freeze({ ageha: "ageha", tsumugi: "tsumugi", rio: "rio" });
