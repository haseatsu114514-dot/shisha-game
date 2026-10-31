// 登場カットインのグラフィック絵柄（2026-10-31 オーナー試作）。
// 目を髪で隠した平面ポスター調の人物絵と、それに合わせて描き直した背景。
// 設定「登場カットインの絵柄」で旧（立ち絵）へいつでも戻せる。素材と指示文: asset_sources/character-intros/graphic-20261031/
const ROOT = "img/ui/character_intros/graphic/";
const PORTRAITS = new Set([
  "adam", "ageha", "dr_kemuri", "hajime", "hiyori", "kumicho", "kuze", "maezono", "maki", "mashiro", "minto", "nagumo",
  "naru", "oneesan", "pakki", "rei", "rin", "sai", "samechan", "steve", "sumi", "tsumugi", "uranaishi", "volk",
]);
// 背景を描き直した人物。それ以外は旧背景をそのまま使う
const BACKGROUNDS = new Set(["steve", "mashiro", "nagumo", "maki"]);
// 正方形の原画を左半分に置く。原画の上端を画面の上端にそろえ、上に隙間を作らない
export const GRAPHIC_FRAME = { width: 720, left: -88, top: 0 };

/** 新しい絵柄で出す素材。旧絵柄の設定か、素材の無い人物は null */
export function graphicIntro(id, style) {
  if (style === "classic" || !PORTRAITS.has(id)) return null;
  return { portrait: `${ROOT}${id}.webp`, background: BACKGROUNDS.has(id) ? `${ROOT}bg_${id}.webp` : null };
}
