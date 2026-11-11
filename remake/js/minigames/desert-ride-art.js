// DESERT RIDE の絵（Codex 生成・PR #2306・#2333 のコメントで受け渡し）。原画・採否・加工の手順は asset_sources/desert-ride-2306/（build.py・adoption.json）。
// 寸法と基準点は adoption.json と同じ値（remake/test/desert_ride.mjs が照合する）。
// 読み込みは非同期で、届くまで・失敗した時は desert-ride.js が Canvas の図形で描く（遊びは止めない）。
import { imgFileUrl } from "../core/img-file.js";

export const DESERT_ART = Object.freeze({
  // 遠景（Codex B）。空と陸を分け、沈む太陽を陸の後ろに描く。horizon は平らな砂が始まる行、duneTop は稜線のいちばん上
  sky: Object.freeze({ file: "ui/desert_ride/backdrop_day_sky.webp", size: Object.freeze([1800, 412]) }),
  land: Object.freeze({ file: "ui/desert_ride/backdrop_day_land.webp", size: Object.freeze([1800, 451]), top: 269 }),
  backdrop: Object.freeze({ width: 1800, height: 720, horizon: 404, duneTop: 281 }),
  // 同じ構図の夕方（第4弾）。ゴールへ近づくほど昼の上に重ねる。陸の透明度は昼と同じ
  duskSky: Object.freeze({ file: "ui/desert_ride/backdrop_dusk_sky.webp", size: Object.freeze([1800, 412]) }),
  duskLand: Object.freeze({ file: "ui/desert_ride/backdrop_dusk_land.webp", size: Object.freeze([1800, 451]), top: 269 }),
  // 主人公の背面（Codex B）。anchor は板の重心（足元の基準点・画像に対する比率）
  rider: Object.freeze({ file: "ui/desert_ride/rider_ride.webp", size: Object.freeze([489, 768]), anchor: Object.freeze({ x: 0.6125, y: 0.833 }) }),
  // 背面の差分（第4弾）。背面Bと同じ縮尺（大きさは rider の高さ 768 に対する比で描く）。左右は画面の左右。
  // anchor は板の重心、転倒だけは板が離れるので体の中心と下端
  riderLeft: Object.freeze({ file: "ui/desert_ride/rider_lean_left.webp", size: Object.freeze([536, 724]), anchor: Object.freeze({ x: 0.6294, y: 0.8209 }) }),
  riderRight: Object.freeze({ file: "ui/desert_ride/rider_lean_right.webp", size: Object.freeze([542, 771]), anchor: Object.freeze({ x: 0.5103, y: 0.8261 }) }),
  riderJump: Object.freeze({ file: "ui/desert_ride/rider_jump.webp", size: Object.freeze([537, 670]), anchor: Object.freeze({ x: 0.5761, y: 0.8388 }) }),
  riderBrace: Object.freeze({ file: "ui/desert_ride/rider_brace.webp", size: Object.freeze([561, 644]), anchor: Object.freeze({ x: 0.558, y: 0.8198 }) }),
  riderFall: Object.freeze({ file: "ui/desert_ride/rider_fall.webp", size: Object.freeze([554, 655]), anchor: Object.freeze({ x: 0.5256, y: 0.9569 }) }),
  // ヌールの背面6ポーズ。既存 rider_* と同じキャンバス寸法と板の基準点を使う。
  noorRider: Object.freeze({ file: "ui/desert_ride/rider_noor_ride.webp", size: Object.freeze([489, 768]), anchor: Object.freeze({ x: 0.6125, y: 0.833 }) }),
  noorRiderLeft: Object.freeze({ file: "ui/desert_ride/rider_noor_lean_left.webp", size: Object.freeze([536, 724]), anchor: Object.freeze({ x: 0.6294, y: 0.8209 }) }),
  noorRiderRight: Object.freeze({ file: "ui/desert_ride/rider_noor_lean_right.webp", size: Object.freeze([542, 771]), anchor: Object.freeze({ x: 0.5103, y: 0.8261 }) }),
  noorRiderJump: Object.freeze({ file: "ui/desert_ride/rider_noor_jump.webp", size: Object.freeze([537, 670]), anchor: Object.freeze({ x: 0.5761, y: 0.8388 }) }),
  noorRiderBrace: Object.freeze({ file: "ui/desert_ride/rider_noor_brace.webp", size: Object.freeze([561, 644]), anchor: Object.freeze({ x: 0.558, y: 0.8198 }) }),
  noorRiderFall: Object.freeze({ file: "ui/desert_ride/rider_noor_fall.webp", size: Object.freeze([554, 655]), anchor: Object.freeze({ x: 0.5256, y: 0.9569 }) }),
  // なる（裏ボス）の背面6ポーズ（Issue #3222・Codex。2026-11-11 新バージョンの服装に描き直し #3306・PR #3309）。主人公の背面と同じ縮尺に作り直し、基準点は板の中心（転倒は主人公と同じ位置関係）。
  // 寸法・基準点は asset_sources/desert-ride-naru-3222/adoption.json（build.py が書き出す）と同じ値。身長の差は描く時に掛ける（desert-ride.js の RIVAL_ART_SCALE）
  naruRider: Object.freeze({ file: "ui/desert_ride/rider_naru_ride.webp", size: Object.freeze([503, 774]), anchor: Object.freeze({ x: 0.5692, y: 0.8226 }) }),
  naruRiderLeft: Object.freeze({ file: "ui/desert_ride/rider_naru_lean_left.webp", size: Object.freeze([544, 725]), anchor: Object.freeze({ x: 0.5868, y: 0.8137 }) }),
  naruRiderRight: Object.freeze({ file: "ui/desert_ride/rider_naru_lean_right.webp", size: Object.freeze([567, 773]), anchor: Object.freeze({ x: 0.4855, y: 0.8134 }) }),
  naruRiderJump: Object.freeze({ file: "ui/desert_ride/rider_naru_jump.webp", size: Object.freeze([534, 673]), anchor: Object.freeze({ x: 0.5564, y: 0.828 }) }),
  naruRiderBrace: Object.freeze({ file: "ui/desert_ride/rider_naru_brace.webp", size: Object.freeze([647, 640]), anchor: Object.freeze({ x: 0.489, y: 0.8224 }) }),
  naruRiderFall: Object.freeze({ file: "ui/desert_ride/rider_naru_fall.webp", size: Object.freeze([656, 652]), anchor: Object.freeze({ x: 0.5266, y: 0.9582 }) }),
  rockLarge: Object.freeze({ file: "ui/desert_ride/rock_large.webp", size: Object.freeze([512, 280]) }),
  rockSmall: Object.freeze({ file: "ui/desert_ride/rock_small.webp", size: Object.freeze([384, 211]) }),
  // 旗竿（Codex A）。foot は竿の足（画像に対する比率）
  flag: Object.freeze({ file: "ui/desert_ride/flag_pole.webp", size: Object.freeze([110, 512]), foot: Object.freeze({ x: 0.0591, y: 1 }) }),
  goal: Object.freeze({ file: "ui/desert_ride/goal_banner.webp", size: Object.freeze([1024, 132]) }),
  puff: Object.freeze({ file: "ui/desert_ride/sand_puff.webp", size: Object.freeze([256, 141]) }),
  curveLeft: Object.freeze({ file: "ui/desert_ride_controls/curve_left.webp", size: Object.freeze([512, 560]) }),
  curveRight: Object.freeze({ file: "ui/desert_ride_controls/curve_right.webp", size: Object.freeze([512, 560]) }),
});
// Issue #3175 でオーナーが A 系を採用。画像の読み込みが終わるまでは操作名を表示する。
export const DESERT_CONTROL_ART = Object.freeze({
  left: "ui/desert_ride_controls/steer_left.webp",
  right: "ui/desert_ride_controls/steer_right.webp",
  boost: "ui/desert_ride_controls/boost.webp",
  jump: "ui/desert_ride_controls/jump.webp",
  land: "ui/desert_ride_controls/land.webp",
  stickBase: "ui/desert_ride_controls/stick_base.webp",
  stickKnob: "ui/desert_ride_controls/stick_knob.webp",
});
// 会話の背景（Codex C を 1280×720 に）と、同じ構図の夕方（夕日の場面）
export const DESERT_BG = "bg_dubai_dunes_day";
export const DESERT_DUSK_BG = "bg_dubai_dunes_dusk";

/**
 * 今の姿勢の絵の名前。転倒の間（起き上がる直前まで）は転倒、空中は着地の構え（押した後）かジャンプ（大ジャンプ・ホップ）、
 * 起伏で小さく跳ねた時と地上はふだんの背面。地上で横へ速く動いている間は左右の傾き（入る 0.32・戻る 0.2 の幅で切り替え、ちらつかせない）。
 * 着地の直後 0.18 秒は着地の構えを残す。
 */
export function riderPose(game, previous = "rider") {
  if (game.fallT > 0.3) return "riderFall";
  if (game.air > 0) {
    if (game.airKind === "bounce") return "rider";
    return game.landingPress !== null ? "riderBrace" : "riderJump";
  }
  if (game.landedAt != null && game.t - game.landedAt < 0.18) return "riderBrace";
  const vx = game.vx;
  if (previous === "riderRight" ? vx > 0.2 : vx > 0.32) return "riderRight";
  if (previous === "riderLeft" ? vx < -0.2 : vx < -0.32) return "riderLeft";
  return "rider";
}

let images = null;
/** 絵を読み始め、{ get(name) } を返す。get は読み終えた画像か null。何度呼んでも同じものを使い回す。 */
export function loadDesertArt() {
  if (!images) {
    images = new Map();
    if (typeof Image !== "undefined") {
      for (const [name, def] of Object.entries(DESERT_ART)) {
        if (!def.file) continue;
        const image = new Image();
        image.decoding = "async";
        const entry = { image, ready: false };
        image.onload = () => { (image.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(() => { entry.ready = true; }); };
        image.onerror = () => { entry.ready = false; };
        image.src = imgFileUrl(def.file);
        images.set(name, entry);
      }
    }
  }
  return { get: name => { const entry = images.get(name); return entry?.ready ? entry.image : null; } };
}
