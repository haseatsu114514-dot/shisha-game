// DESERT RIDE の絵（人物・岩・旗などは Codex 生成・PR #2306・#2333。原画・採否は asset_sources/desert-ride-2306/）。
// 遠景の空と陸は Issue #3713 の坂の絵（asset_sources/desert-ride-slope-3686）に差し替え。寸法と基準点は desert-ride-2306/adoption.json と同じ値（remake/test/desert_ride.mjs が照合する）。
// 読み込みは非同期で、届くまで・失敗した時は desert-ride.js が Canvas の図形で描く（遊びは止めない）。
import { imgFileUrl } from "../core/img-file.js";
import { prepareImage } from "../core/loading-prefetch.js";

export const DESERT_ART = Object.freeze({
  // 遠景（#3713 の坂の絵）。空と陸を分け、沈む太陽を陸の後ろに描く。horizon は斜面の縁（lip）の行、duneTop は稜線のいちばん上
  sky: Object.freeze({ file: "ui/desert_ride/backdrop_day_sky.webp", size: Object.freeze([1800, 416]) }),
  land: Object.freeze({ file: "ui/desert_ride/backdrop_day_land.webp", size: Object.freeze([1800, 500]), top: 220 }),
  backdrop: Object.freeze({ width: 1800, height: 720, horizon: 405, duneTop: 232 }),
  // 同じ構図の夕方。ゴールへ近づくほど昼の上に重ねる。陸の寸法・基準点は昼と同じ
  duskSky: Object.freeze({ file: "ui/desert_ride/backdrop_dusk_sky.webp", size: Object.freeze([1800, 416]) }),
  duskLand: Object.freeze({ file: "ui/desert_ride/backdrop_dusk_land.webp", size: Object.freeze([1800, 500]), top: 220 }),
  // 主人公の背面（Codex B）。anchor は板の重心（足元の基準点・画像に対する比率）
  rider: Object.freeze({ file: "ui/desert_ride/rider_ride.webp", size: Object.freeze([489, 768]), anchor: Object.freeze({ x: 0.6125, y: 0.833 }) }),
  // 背面の差分（第4弾）。背面Bと同じ縮尺（大きさは rider の高さ 768 に対する比で描く）。左右は画面の左右。
  // anchor は板の重心、転倒だけは板が離れるので体の中心と下端
  riderLeft: Object.freeze({ file: "ui/desert_ride/rider_lean_left.webp", size: Object.freeze([536, 724]), anchor: Object.freeze({ x: 0.6294, y: 0.8209 }) }),
  riderRight: Object.freeze({ file: "ui/desert_ride/rider_lean_right.webp", size: Object.freeze([542, 771]), anchor: Object.freeze({ x: 0.5103, y: 0.8261 }) }),
  riderJump: Object.freeze({ file: "ui/desert_ride/rider_jump.webp", size: Object.freeze([537, 670]), anchor: Object.freeze({ x: 0.5761, y: 0.8388 }) }),
  riderBrace: Object.freeze({ file: "ui/desert_ride/rider_brace.webp", size: Object.freeze([561, 644]), anchor: Object.freeze({ x: 0.558, y: 0.8198 }) }),
  riderFall: Object.freeze({ file: "ui/desert_ride/rider_fall.webp", size: Object.freeze([554, 655]), anchor: Object.freeze({ x: 0.5256, y: 0.9569 }) }),
  // 回転姿（Issue #3563・はじめ。Codex 生成→後処理で検品済み）。寸法・基準点は asset_sources/desert-ride-spin/adoption.json と同じ値（build.py が書き出す）。
  // 人物の実寸は riderJump と同じにそろえてあり、anchor は各絵の板の重心。225〜315° は 135・90・45 の左右反転で使う。
  hajimeSpin045: Object.freeze({ file: "ui/desert_ride/spin_hajime_045.webp", size: Object.freeze([657, 821]), anchor: Object.freeze({ x: 0.5104, y: 0.779 }) }),
  hajimeSpin090: Object.freeze({ file: "ui/desert_ride/spin_hajime_090.webp", size: Object.freeze([811, 1014]), anchor: Object.freeze({ x: 0.4872, y: 0.7795 }) }),
  hajimeSpin135: Object.freeze({ file: "ui/desert_ride/spin_hajime_135.webp", size: Object.freeze([572, 825]), anchor: Object.freeze({ x: 0.5241, y: 0.7638 }) }),
  hajimeSpin180: Object.freeze({ file: "ui/desert_ride/spin_hajime_180.webp", size: Object.freeze([670, 768]), anchor: Object.freeze({ x: 0.4898, y: 0.808 }) }),
  // ヌールの背面6ポーズ。既存 rider_* と同じキャンバス寸法と板の基準点を使う。
  noorRider: Object.freeze({ file: "ui/desert_ride/rider_noor_ride.webp", size: Object.freeze([489, 768]), anchor: Object.freeze({ x: 0.6125, y: 0.833 }) }),
  noorRiderLeft: Object.freeze({ file: "ui/desert_ride/rider_noor_lean_left.webp", size: Object.freeze([536, 724]), anchor: Object.freeze({ x: 0.6294, y: 0.8209 }) }),
  noorRiderRight: Object.freeze({ file: "ui/desert_ride/rider_noor_lean_right.webp", size: Object.freeze([542, 771]), anchor: Object.freeze({ x: 0.5103, y: 0.8261 }) }),
  noorRiderJump: Object.freeze({ file: "ui/desert_ride/rider_noor_jump.webp", size: Object.freeze([537, 670]), anchor: Object.freeze({ x: 0.5761, y: 0.8388 }) }),
  noorRiderBrace: Object.freeze({ file: "ui/desert_ride/rider_noor_brace.webp", size: Object.freeze([561, 644]), anchor: Object.freeze({ x: 0.558, y: 0.8198 }) }),
  noorRiderFall: Object.freeze({ file: "ui/desert_ride/rider_noor_fall.webp", size: Object.freeze([554, 655]), anchor: Object.freeze({ x: 0.5256, y: 0.9569 }) }),
  // 回転姿（Issue #3563・ヌール）。寸法・基準点は asset_sources/desert-ride-spin/adoption.json と同じ値（build.py が書き出す）
  noorSpin045: Object.freeze({ file: "ui/desert_ride/spin_noor_045.webp", size: Object.freeze([588, 805]), anchor: Object.freeze({ x: 0.501, y: 0.802 }) }),
  noorSpin090: Object.freeze({ file: "ui/desert_ride/spin_noor_090.webp", size: Object.freeze([672, 919]), anchor: Object.freeze({ x: 0.5216, y: 0.842 }) }),
  noorSpin135: Object.freeze({ file: "ui/desert_ride/spin_noor_135.webp", size: Object.freeze([595, 815]), anchor: Object.freeze({ x: 0.463, y: 0.7921 }) }),
  noorSpin180: Object.freeze({ file: "ui/desert_ride/spin_noor_180.webp", size: Object.freeze([591, 809]), anchor: Object.freeze({ x: 0.4865, y: 0.8268 }) }),
  // なる（好敵手）の背面6ポーズ（Issue #3222・Codex。2026-11-11 新バージョンの服装に描き直し #3306・PR #3309）。主人公の背面と同じ縮尺に作り直し、基準点は板の中心（転倒は主人公と同じ位置関係）。
  // 寸法・基準点は asset_sources/desert-ride-naru-3222/adoption.json（build.py が書き出す）と同じ値。身長の差は描く時に掛ける（desert-ride.js の RIVAL_ART_SCALE）
  naruRider: Object.freeze({ file: "ui/desert_ride/rider_naru_ride.webp", size: Object.freeze([503, 774]), anchor: Object.freeze({ x: 0.5692, y: 0.8226 }) }),
  naruRiderLeft: Object.freeze({ file: "ui/desert_ride/rider_naru_lean_left.webp", size: Object.freeze([544, 725]), anchor: Object.freeze({ x: 0.5868, y: 0.8137 }) }),
  naruRiderRight: Object.freeze({ file: "ui/desert_ride/rider_naru_lean_right.webp", size: Object.freeze([567, 773]), anchor: Object.freeze({ x: 0.4855, y: 0.8134 }) }),
  naruRiderJump: Object.freeze({ file: "ui/desert_ride/rider_naru_jump.webp", size: Object.freeze([534, 673]), anchor: Object.freeze({ x: 0.5564, y: 0.828 }) }),
  naruRiderBrace: Object.freeze({ file: "ui/desert_ride/rider_naru_brace.webp", size: Object.freeze([647, 640]), anchor: Object.freeze({ x: 0.489, y: 0.8224 }) }),
  naruRiderFall: Object.freeze({ file: "ui/desert_ride/rider_naru_fall.webp", size: Object.freeze([656, 652]), anchor: Object.freeze({ x: 0.5266, y: 0.9582 }) }),
  // 回転姿（Issue #3563・なる）。寸法・基準点は asset_sources/desert-ride-spin/adoption.json と同じ値（build.py が書き出す）
  naruSpin045: Object.freeze({ file: "ui/desert_ride/spin_naru_045.webp", size: Object.freeze([597, 817]), anchor: Object.freeze({ x: 0.525, y: 0.7812 }) }),
  naruSpin090: Object.freeze({ file: "ui/desert_ride/spin_naru_090.webp", size: Object.freeze([714, 977]), anchor: Object.freeze({ x: 0.5038, y: 0.7778 }) }),
  naruSpin135: Object.freeze({ file: "ui/desert_ride/spin_naru_135.webp", size: Object.freeze([596, 816]), anchor: Object.freeze({ x: 0.5186, y: 0.7831 }) }),
  naruSpin180: Object.freeze({ file: "ui/desert_ride/spin_naru_180.webp", size: Object.freeze([717, 895]), anchor: Object.freeze({ x: 0.4988, y: 0.785 }) }),
  rockLarge: Object.freeze({ file: "ui/desert_ride/rock_large.webp", size: Object.freeze([512, 280]) }),
  rockSmall: Object.freeze({ file: "ui/desert_ride/rock_small.webp", size: Object.freeze([384, 211]) }),
  // 旗竿（Codex A）。foot は竿の足（画像に対する比率）
  flag: Object.freeze({ file: "ui/desert_ride/flag_pole.webp", size: Object.freeze([110, 512]), foot: Object.freeze({ x: 0.0591, y: 1 }) }),
  goal: Object.freeze({ file: "ui/desert_ride/goal_banner.webp", size: Object.freeze([1024, 132]) }),
  puff: Object.freeze({ file: "ui/desert_ride/sand_puff.webp", size: Object.freeze([256, 141]) }),
  // 派手なアクションの絵（DSR100・2026-11-27 オーナー「見本の派手な見た目を本編にも」）。遊び方の図解と同じ画風で生成した（gpt-image-2.6-sunburst。
  // 原画・プロンプト・検品は asset_sources/ui/minigame-visuals-20261127/desert/）。origin は砂が出る点（絵に対する比率）。左へ飛ばす時は左右を反転して描く。
  fxPlume: Object.freeze({ file: "ui/desert_ride/fx_plume.webp", size: Object.freeze([512, 505]), origin: Object.freeze({ x: 0.49, y: 0.97 }) }), // 踏み切り: 真上へ扇に噴き上がる砂
  fxWake: Object.freeze({ file: "ui/desert_ride/fx_wake.webp", size: Object.freeze([640, 242]), origin: Object.freeze({ x: 0.02, y: 0.94 }) }),   // ブースト・着地・鋭く切った時: 右へ低く広がる砂
  fxWave: Object.freeze({ file: "ui/desert_ride/fx_wave.webp", size: Object.freeze([640, 433]), origin: Object.freeze({ x: 0.06, y: 0.93 }) }),   // カーブ: 右へ巻き上がる砂の波
  fxBolts: Object.freeze({ file: "ui/desert_ride/fx_bolts.webp", size: Object.freeze([512, 507]), origin: Object.freeze({ x: 0.5, y: 0.5 }) }),   // ブースト: 体のまわりの稲妻（中央は空いている）
  curveLeft: Object.freeze({ file: "ui/desert_ride_controls/curve_left.webp", size: Object.freeze([512, 560]) }),
  curveRight: Object.freeze({ file: "ui/desert_ride_controls/curve_right.webp", size: Object.freeze([512, 560]) }),
});
// Issue #3175 でオーナーが A 系を採用。画像の読み込みが終わるまでは操作名を表示する。スティックは 2026-11-11 に外した（画像は asset_sources に残す）。
export const DESERT_CONTROL_ART = Object.freeze({
  left: "ui/desert_ride_controls/steer_left.webp",
  right: "ui/desert_ride_controls/steer_right.webp",
  boost: "ui/desert_ride_controls/boost.webp",
  jump: "ui/desert_ride_controls/jump.webp",
  land: "ui/desert_ride_controls/land.webp",
});
// desert-ride.css が滑走中の立て直しと結果カードに使う絵。
const RECOVER_UI_ART = "ui/desert_ride_hud/recover-badge.webp";
// メダルはランクごとの絵（DSR106。字は絵に入っている）。ランクの名前は革の名札、自己ベスト更新は漆の札の絵
const RESULT_UI_ART = ["board", "ribbon_win", "ribbon_lose", "rank_s", "rank_a", "rank_b", "rank_c", "plate_rank", "stamp_best", "button_primary", "button_secondary"]
  .map(name => `ui/desert_ride_result/${name}.webp`);
const warmedUiImages = new Map();
function warmUiImage(file) {
  if (!warmedUiImages.has(file)) {
    const image = prepareImage(imgFileUrl(file)).catch(() => { warmedUiImages.delete(file); });
    warmedUiImages.set(file, image);
  }
  return warmedUiImages.get(file);
}

export function preloadHudArt() {
  for (const name of ["panel", "bolt", "gauge-frame", "course-plate", "speedo-dial"]) {
    void warmUiImage(`ui/desert_ride_hud/${name}.webp`);
  }
}

/** 滑り始めてから空き時間に1枚ずつ先読みし、CSS から使う画像を保持する。 */
export async function warmDesertUi(practice, isCurrent) {
  if (typeof Image === "undefined") return;
  const files = practice ? [RECOVER_UI_ART] : [RECOVER_UI_ART, ...RESULT_UI_ART];
  for (const file of files) {
    if (!isCurrent()) return;
    if (!warmedUiImages.has(file)) {
      await new Promise(resolve => {
        if (typeof requestIdleCallback === "function") requestIdleCallback(resolve, { timeout: 1000 });
        else setTimeout(resolve, 100);
      });
      if (!isCurrent()) return;
    }
    await warmUiImage(file);
  }
}

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

/**
 * 回転の角度（rot は回転数）から、今と次の回転姿と、間の寄せ具合を返す（Issue #3563）。
 * 並びは 45°ごとで、225〜315° は 135・90・45° の絵を左右反転（flip）して使う。
 * who は人物（"hajime" | "noor" | "naru"）。先頭の絵はその人物のジャンプ姿。
 * 絵が無い人物・読み込み前は呼び出し側が従来の「縮めて裏返す」描き方に倒す。
 */
const SPIN_ORDERS = Object.freeze({
  hajime: Object.freeze(["riderJump", "hajimeSpin045", "hajimeSpin090", "hajimeSpin135", "hajimeSpin180", "hajimeSpin135", "hajimeSpin090", "hajimeSpin045"]),
  noor: Object.freeze(["noorRiderJump", "noorSpin045", "noorSpin090", "noorSpin135", "noorSpin180", "noorSpin135", "noorSpin090", "noorSpin045"]),
  naru: Object.freeze(["naruRiderJump", "naruSpin045", "naruSpin090", "naruSpin135", "naruSpin180", "naruSpin135", "naruSpin090", "naruSpin045"]),
});
export function spinFrames(rot, who = "hajime") {
  const order = SPIN_ORDERS[who] || SPIN_ORDERS.hajime;
  const pos = (((rot % 1) + 1) % 1) * 8;
  const i = Math.floor(pos) % 8;
  const at = k => ({ name: order[k], flip: k >= 5 });
  return { from: at(i), to: at((i + 1) % 8), fade: pos - Math.floor(pos) };
}

let images = null;
/**
 * 共通画像と選んだ相手だけを準備する。rivals省略時は従来どおり全画像。
 * Mapは共有し、後から相手を替えても取得・decodeを重複させない。
 */
/**
 * 下り坂の遠景（2026-11-27。縦のために作り、同日に横にも当てた。gpt-image-2.6-sunburst 生成・記録は asset_sources/ui/minigame-visuals-20261127/desert/）。
 * 高い所から見下ろした坂の下の谷。上の空は透明（空は sky を使い、沈む太陽を谷の稜線の後ろに描ける）。horizon は遠くの稜線の足元（目の高さ）の行。
 * 下り坂の見え方を外した時（downhill: false）は使わないので DESERT_ART とは分け、下り坂の時だけ読む（loadDesertArt の valley）。夕方は同じ構図・同じ寸法。
 */
export const DESERT_VALLEY_ART = Object.freeze({
  valley: Object.freeze({ file: "ui/desert_ride/valley_day.webp", size: Object.freeze([1536, 652]), horizon: 38 }),
  duskValley: Object.freeze({ file: "ui/desert_ride/valley_dusk.webp", size: Object.freeze([1536, 652]), horizon: 38 }),
});

export function loadDesertArt({ rivals = null, valley = false } = {}) {
  images ||= new Map();
  const names = Object.entries(DESERT_ART).filter(([name, def]) => def.file
    && (rivals === null || !/^(noor|naru)(Rider|Spin)/.test(name) || rivals.some(who => name.startsWith(who + "Rider") || name.startsWith(who + "Spin")))).map(([name]) => name);
  if (valley) names.push(...Object.keys(DESERT_VALLEY_ART));
  if (typeof Image !== "undefined") {
    for (const name of names) {
      if (images.has(name)) continue;
      const image = new Image();
      image.decoding = "async";
      const entry = { image, ready: false, pending: true };
      entry.done = new Promise(resolve => {
        image.onload = () => { (image.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(() => {
          entry.ready = true; entry.pending = false; resolve();
        }); };
        image.onerror = () => { entry.ready = false; entry.pending = false; resolve(); };
      });
      images.set(name, entry);
      image.src = imgFileUrl((DESERT_ART[name] || DESERT_VALLEY_ART[name]).file);
    }
  }
  const entries = names.map(name => images.get(name)).filter(Boolean);
  return {
    get: name => { const entry = images.get(name); return entry?.ready ? entry.image : null; },
    whenReady: () => Promise.all(entries.map(entry => entry.done)),
    pending: () => entries.some(entry => entry.pending),
  };
}
