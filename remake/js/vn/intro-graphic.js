// 登場カットインのグラフィック絵柄（2026-10-31 オーナー試作）。
// 目を髪で隠した平面ポスター調の人物絵と、それに合わせて描き直した背景。
// 設定「登場カットインの絵柄」で旧（立ち絵）へいつでも戻せる。素材と指示文: asset_sources/character-intros/graphic-20261031/
// 絵の差し替え: python3 tools/intro_graphic_import.py <id> <原画.png> [--background]（手順は同フォルダの README）
const ROOT = "img/ui/character_intros/graphic/";
// SHISHA-9000 は正式 normal の独立したシアン／紫の眼を優先し、専用人物絵へ差し替えない。
const PORTRAITS = new Set([
  "adam", "ageha", "dr_kemuri", "hajime", "hiyori", "kumicho", "saku", "maezono", "maki", "mashiro", "minto", "sui",
  "naru", "oneesan", "pakki", "rei", "rio", "sai", "samechan", "steve", "sumi", "tsumugi", "uranaishi", "volk", "yoru",
  "master_hookah", "sheikh", "da_silva", "emil", "mukai_master", "noor",
]);
// 背景も新しい絵柄に合わせて描き直した（2026-10-31 全24人）。無い人物は旧背景を使う
const BACKGROUNDS = new Set([...PORTRAITS]);
// 正方形の原画を左半分に置く。原画の上端を画面の上端にそろえ、上に隙間を作らない
export const GRAPHIC_FRAME = { width: 720, left: -88, top: 0 };

// 人物ごとの置き方。原画ごとに寄り・引きが違うので、頭の大きさがそろうよう tools/intro_graphic_frames.py が計算する。
// 測った頭の位置は asset_sources/character-intros/graphic-20261031/heads.json。fade=下を薄くする%、right=これより右を薄く消す%。
// FRAMES:BEGIN tools/intro_graphic_frames.py が heads.json から書き出す（手で直さない）
const FRAME_OVERRIDES = {
  adam: {width: 831, left: -110, top: -4, right: 90.2},
  ageha: {width: 691, left: -94, top: -11, fade: 14},
  da_silva: {width: 1147, left: -314, top: -113, right: 83.2},
  dr_kemuri: {width: 699, left: -38, top: 0, fade: 14, right: 96.9},
  emil: {width: 1024, left: -170, top: 11, right: 79.1},
  hajime: {width: 716, left: -135, top: -36, fade: 14},
  hiyori: {width: 686, left: 0, top: -6, fade: 14, right: 93.3},
  kumicho: {width: 708, left: -86, top: 0, fade: 14},
  saku: {width: 699, left: -93, top: -4, fade: 14},
  maezono: {width: 765, left: -102, top: -10, right: 97.1},
  maki: {width: 940, left: -217, top: -7, right: 91.1},
  mashiro: {width: 831, left: -135, top: 0, right: 93.2},
  master_hookah: {width: 910, left: -176, top: -36, right: 89.7},
  minto: {width: 755, left: -109, top: -2, right: 99.3},
  mukai_master: {width: 1024, left: -200, top: -108, right: 82.0},
  sui: {width: 972, left: -157, top: -12, right: 82.0},
  naru: {width: 831, left: -109, top: 0, right: 90.1},
  noor: {width: 688, left: -48, top: -5, fade: 14},
  oneesan: {width: 843, left: -127, top: 4, right: 91.0},
  rei: {width: 1024, left: -228, top: 6, right: 84.8},
  rio: {width: 808, left: -136, top: -4, right: 96.1},
  sai: {width: 819, left: -142, top: 4, right: 95.4},
  samechan: {width: 765, left: -126, top: -51, fade: 14},
  sheikh: {width: 1638, left: -540, top: -182, right: 72.0},
  shisha_9000: {width: 869, left: -180, top: -43, right: 94.4},
  steve: {width: 989, left: -273, top: -13, right: 92.3},
  sumi: {width: 808, left: -111, top: -16, right: 92.9},
  tsumugi: {width: 765, left: -114, top: 0, right: 98.7},
  uranaishi: {width: 1195, left: -292, top: -77, right: 78.0},
  volk: {width: 956, left: -240, top: -12, right: 92.0},
  yoru: {width: 925, left: -202, top: -123, right: 91.0},
};
// FRAMES:END

/** 頭の大きさをそろえた配置があるか（テスト用） */
export const hasScaledFrame = (id) => Object.hasOwn(FRAME_OVERRIDES, id);

/** 新しい絵柄で出す素材。旧絵柄の設定か、素材の無い人物は null */
export function graphicIntro(id, style) {
  if (style === "classic" || !PORTRAITS.has(id)) return null;
  return {
    portrait: `${ROOT}${id}.webp`,
    background: BACKGROUNDS.has(id) ? `${ROOT}bg_${id}.webp` : null,
    frame: { ...GRAPHIC_FRAME, ...FRAME_OVERRIDES[id] },
  };
}
