// 「てつこといっしょ」の絵の差し替え表（#2454・TKT01）。Codex に頼んだ素材（asset_sources/tetsuko-care/README.md）が
// 届いて採用したら、ここの ART_READY に名前を書く。書いた素材だけが CSS の絵から差し替わる。
// 書いていない素材は読みに行かない（404 を出さない・届く前のテストを壊さない）。
//
// 置き場所: 背景は assets/backgrounds/bg_mukai_backdoor_{day,night}.png（data.js の sceneBg が昼夜を選ぶ）、
// 猫・小物・UI は assets/ui/tetsuko/*.png と実行時の remake/img/ui/tetsuko/*.webp。
// 猫のしぐさは 1024×768 の透明な画面に、既存の立ち絵と同じ縮尺（顔の幅約150px）・体が地面に触れる線 y=736・中心 x=512 で置く。
import { imgFileUrl } from "../core/img-file.js";

export const ART_READY = Object.freeze({
  background: false,          // bg_mukai_backdoor_day / _night
  poses: Object.freeze([]),   // "loaf","crouch","reach","hug","groom","yawn","belly","rub","walk_a","walk_b","lookback","stretch"
  props: Object.freeze([]),   // "box","ball","cushion","scratcher","tunnel","bed","plate","teaser","brush","lap"
  ui: Object.freeze([]),      // "icons","notebook","photo_frame","tape","memo","paw_stamp","caption","toolbox","button"
});

/** しぐさの絵（1024×768）の基準: 画面の上の大きさと足元。CSS の .tt-cat と同じ縮尺で重ねる。 */
export const POSE_CANVAS = Object.freeze({ w: 1024, h: 768, ax: 512, ay: 736 });

export const hasPose = name => !!name && ART_READY.poses.includes(name);
export const hasProp = id => ART_READY.props.includes(id);
export const hasUi = name => ART_READY.ui.includes(name);
export const poseUrl = name => hasPose(name) ? imgFileUrl(`ui/tetsuko/cat_${name}.webp`) : null;
export const propUrl = (id, part = "") => hasProp(id) ? imgFileUrl(`ui/tetsuko/prop_${id}${part ? `_${part}` : ""}.webp`) : null;
export const uiUrl = name => hasUi(name) ? imgFileUrl(`ui/tetsuko/ui_${name}.webp`) : null;
/** 画面の data 属性に並べる（CSS の [data-art-props~="box"] などで、届いた素材の時だけ絵を使う）。 */
export const artAttrs = () => ({ artBg: String(ART_READY.background), artProps: ART_READY.props.join(" "), artUi: ART_READY.ui.join(" ") });
