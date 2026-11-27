import { openMinigamePause } from "./minigame-pause.js";
// DESERT RIDE（第4章ドバイ・サンドボード）の画面。後方視点の疑似3Dを Canvas に描き、入力・HUD・練習・リザルトを持つ。
// 規則と採点は desert-ride-model.js。本編との接続（行動枠・報酬・保存）は chapters/ch4-desert.js で、ここは保存を読まない。
// 絵（遠景・主人公の背面・岩・旗・ゴール・砂煙）は採用画像（desert-ride-art.js。遠景の坂は #3713、ほかは #2306/#2333）。読み込み前・失敗時は Canvas の図形で描く。
// 起伏・路面・太陽・夕方の色は Canvas で描く。左右・ジャンプ・着地・転倒の姿勢は第4弾の差分の絵（riderPose）。
// 2026-11-02 オーナー「もっとスピード感やエフェクトを派手に」: 速さで広がる視界（人物の大きさは保つ）・傾くカメラ・強いスピード線・砂しぶき・
// 着地の輪・得点の浮き出し・トリックのスロー・ブーストの残像。動き軽減ではカメラの動き・揺れ・スロー・閃光・速度線を止める。
// 本番はスタートの合図のあと、ヌール（rivalRun）が横で滑る。
import { withMinigameStyles } from "./minigame-styles.js";
import { el } from "../core/util.js";
import { SE, unlockAudio, createDesertRideSe, desertZapGap, currentBgm, playBgm, preloadBgm, resetBgmTempo } from "../core/audio.js";
import { BOOST, CARVE, EDGE, SPEED, COURSE_PACKS, generateCourse, practiceCourse, pickCourse, buildCourse, createGame, step, press, boost, chargeBoost, canRecover, summary, curveAt, headingAt, lateralAt, botControl,
  rivalRun, rivalAt, desertBestKey, desertDisplayBests, RULES_VERSION, DISPLAY, toKmh, toMeters, JUMP, SCORE, RANKS, PLAYER, NEAR, PRACTICE_LESSONS, PRACTICE_WALL, PRACTICE_CURVE, PRACTICE_FLOW, FLOW } from "./desert-ride-model.js";
import { createReturnGuide } from "./desert-ride-guide.js";
import { TIERS, TIER_LABEL } from "../core/play-tiers.js";
import { DESERT_ART, DESERT_VALLEY_ART, DESERT_CONTROL_ART, loadDesertArt, riderPose, spinFrames, preloadHudArt, warmDesertUi } from "./desert-ride-art.js";
import { imgFileUrl } from "../core/img-file.js";
import { faceIconUrl } from "../core/data.js";
import { installRotateGuard, rotateGuarded } from "../core/rotate-guard.js";
import { warmInBackground } from "../core/loading-prefetch.js";
import { withMinigameLoading } from "./minigame-loading.js";

// ブーストは人物を包む炎のオーラ・砂煙・周辺の速度線と効果音で伝える。曲のテンポは変えない。
const BOT_STEP = 1 / 60; // 自動操縦の判断と物理の刻み（モデルの検査と同じ）
const UPDATE_STEP = 0.05; // 演出と進行判定は従来の1フレーム上限を刻み幅にする
const MAX_FRAME_ELAPSED = 1; // 非表示・回転は別途停止。極端に長い停止からの復帰だけ追いつく量を制限する
// オーラの色（内側・外側・火の粉）。2026-11-13 オーナー「ヌールとなるとはじめでオーラの色は変えたい」で、ひと目で分かる3色にした
// （それまではヌールが夕日の金で、はじめの炎と見分けにくかった）: はじめ＝炎の橙、ヌール＝板と同じ青緑、なる＝紫
// カービングの金の残像の色（内側・外側）
const CARVE_GOLD = Object.freeze({ mid: [255, 214, 96], rim: [255, 150, 40] });
const AURAS = Object.freeze({
  player: Object.freeze({ core: [255, 250, 190], mid: [255, 176, 48], rim: [255, 92, 20] }),
  noor: Object.freeze({ core: [226, 255, 248], mid: [64, 222, 196], rim: [14, 140, 150] }),
  naru: Object.freeze({ core: [246, 236, 255], mid: [196, 128, 255], rim: [118, 56, 228] }),
});
// カーブで遠景が横へ流れる量（向き 1 あたりの画素）。空は陸の半分。絵の端は左右反転でつなぐので、どこまで曲がっても途切れない
const YAW_PX = 600;
// スタートの合図の間に出す名乗りの小さな文字（2026-11-13 オーナー「裏ボスなる　とかシステム的な書き方はしないで」で「裏ボス」から改めた。
// なるは、はじめの地元最強格の好敵手）
const RIVAL_TITLES = Object.freeze({ naru: "好敵手" });
// 相手の滑る絵の倍率。絵は主人公の背面と同じ縮尺で描かれているので、身長の比（主人公172cm）だけを掛ける
// （data/characters.json の spriteScale と同じ値。ヌール168cm・なる176cm）。図形で描く時は従来の 0.86
const RIVAL_ART_SCALE = Object.freeze({ noor: 0.977, naru: 1.02 });

const W = 1280, H = 720;
// ゴールの竿の高さ（m）。2026-11-13 オーナー「ゴールの旗が低すぎる」で 2.6 → 5.2、同「まだ低い」で 9（人物の約3.5倍。遠くからも門だと分かる）
const GOAL_POLE = 9;
const HORIZON = 262;             // 地平線の高さ（路面＝斜面の消失線。斜面はここで向こうへ落ち込む）
/**
 * 坂の見え方（2026-11-17 #3686・#3713）。見た目だけの値で、規則・物理は変えない。
 * 採用した坂の絵（desert-ride-slope-3686）は、見下ろした谷と斜面の縁（lip）が描いてある。絵の horizon を画面の HORIZON に合わせるので、
 * 遠くの砂丘を下げて隠す回避（かつての edgePx 54）は使わない。runout は互換のため残す（edgePx が 0 なら縁の深さは常に 0）。
 */
const SLOPE = Object.freeze({ edgePx: 0, runout: 260 });
const CAM = { depth: 1.5, height: 2.0, back: 4.5, meterPerLane: 1.6 }; // 疑似3Dのカメラ（人物の4.5m後ろ・高さ2m。lane 1 = 1.6m）
/**
 * 下り坂の見え方（縦画面。2026-11-27 オーナー「サンドボードは縦画面のやつでもレース中にも坂をくだってる立体感がわかりやすくしたい」）。
 * 見た目だけの値で、判定・規則・採点・手応えの数値は変えない。横（既定）は使わない（startDesertRide の downhill で切り替える）。
 * 横の作りでは路面の消失線＝遠くの砂丘の足元（HORIZON）なので、路面が平らな台地のまま砂丘へ届いて見えた。
 * 下り坂では、目の高さ（eye: 空と遠くの稜線の境）より下に路面の消失線（ground）を置く。路面は目の高さより下へ続き、
 * その間に坂の下の谷（遠景の絵の谷の部分。縦に広げる）が見える＝見下ろしながら坂を下っている見え方。
 * height は斜面から測ったカメラの高さ（m。横の 2m より高いほど見下ろす）。valleyWidth は谷の絵（DESERT_VALLEY_ART）を描く幅（px。縦横同じ倍率）。
 * valleyHaze は谷にかける空気の濃さ [目の高さ, 斜面の端]（遠いほど白く霞み、低く遠い所にあると分かる）。
 * posts はコースの両端の杭とロープ（every m ごと、reach m 先まで）。坂の下へ細く集まる2本の線で、コースの向きと奥行きを見せる。
 */
const DOWNHILL = Object.freeze({ eye: 190, ground: 300, height: 2.6, valleyWidth: 520, valleyHaze: Object.freeze([0.5, 0.12]), posts: Object.freeze({ every: 6, reach: 170, height: 0.85 }) });
const COUNTDOWN = 2.4;           // 本番のスタートの合図（3・2・1・GO）の秒数（その相手との最初の一本）
/**
 * 手応え（演出）の数値（2026-11-13 オーナー「手応えレビューの内容を実装して、より面白く」）。規則（desert-ride-model.js）と違い凍結しない:
 * ブラウザのコンソールで `__desertRide.feel.stopFall = 0.2` のように書き換えると、止めずにその場で変わる（調整用・保存はされない）。
 * 動き軽減では、止め・スロー・揺れ・閃光・潰し伸ばし・落下の速い軌道を使わない。
 */
const FEEL = {
  // 止め（ヒットストップ・秒）。止めの間は規則の時計を進めない（砂煙・輪・文字は動かし続ける）
  stopFall: 0.12, stopSmash: 0.05, stopPerfect: 0.06, stopRecover: 0.08, stopGoal: 0.1,
  // トリック（360 以上）を決めた後のスロー（秒・速さの倍率）
  slowTrick: 0.5, slowRate: 0.35,
  // 画面の揺れ [横px, 縦px, 秒]。大きさだけでなく揺れ方を変える（小＝縦だけ、中＝横も、大＝大きく長く）。最初が強く、二乗で収まる
  shake: { land: [0, 6, 0.12], landPerfect: [0, 9, 0.16], boost: [4, 3, 0.12], smash: [10, 4, 0.2], recover: [8, 6, 0.24], fall: [14, 10, 0.4], goal: [6, 4, 0.22] },
  // 閃光 [秒, 最初の濃さ]。転倒は最初の flashFallDark[0] 秒だけ暗く落としてから白（明るい砂の上では白だけだと目立たない）
  flash: { fall: [0.18, 0.3], recover: [0.12, 0.19], perfect: [0.08, 0.2], goal: [0.16, 0.45] }, flashFallDark: [0.034, 0.55],
  // 視界: 速さ・GO／ブーストの瞬間・ブースト中に広がる割合、カメラの傾き（横の速さ・カーブ・上限）
  fovSpeed: 0.24, fovKick: 0.12, fovBoost: 0.16, rollSteer: 0.035, rollCurve: 0.075, rollMax: 0.1,
  // 滑走中の体の上下（1秒あたりの速さ・画素）
  bobRate: 14, bobPx: 2,
  // ジャンプの見た目: 頂点の位置（滞空の何割で頂点か。0.5 より後ろ＝落ちる方が速い）。当たり判定は規則の軌道のまま
  jumpApex: 0.58,
  // 潰し・伸ばし [横, 縦, 秒]（板の重心が軸。1 へまっすぐ戻る）
  stretchJump: [0.92, 1.12, 0.08], stretchHop: [0.95, 1.08, 0.07], squashLand: [1.18, 0.8, 0.12], squashPerfect: [1.24, 0.74, 0.14], squashHop: [1.08, 0.92, 0.09],
  // 左右を押した瞬間に見せる傾き（姿勢の絵が切り替わる横の速さ 0.32 を越える量）と、体の回転（rad）
  leanNow: 0.4, rollNow: 0.1,
  // 2本目からのスタートの合図（秒）、ゴールの余韻（秒）と、押して飛ばせるようになるまで（秒）、余韻の減速（1秒あたりの割合）
  countdownRetry: 1.2, goalAfter: 1.0, goalSkipAfter: 0.3, goalBrake: 3,
  // ブースト中のオーラ（2026-11-13 オーナー「ブースト中のオーラのせいで画面見づらい」）: 発進の瞬間（auraBurst 秒）だけ強く、その後は auraHold の強さに落ち着く。
  // auraLength: 炎の筋の長さの倍率（それまで 1）。頭の上（走路の先）には筋を出さない。残像は auraTrail 枚
  auraBurst: 0.4, auraHold: 0.5, auraLength: 0.6, auraTrail: 2,
  // ゲージへ飛ぶ光の粒（2026-11-13）: ゲージがこれだけ貯まるごとに粒を1つ
  orbEach: 0.012,
  // 回転（2026-11-13）: 体のひねり（rad）、残像の枚数と1枚ごとの遅れ（回転）、横向きの瞬間の最小の横幅
  spinTilt: 0.14, spinGhosts: 3, spinGhostStep: 0.045, spinMinWidth: 0.3,
  // 砂流れ（2026-11-25）: 帯の砂が流れて見える速さ（地面に対して m/秒。動き軽減では flowCalm 倍）、乗った瞬間の視界の広がり、乗っている間の砂しぶきの量
  flowRun: 16, flowCalm: 0.3, flowKick: 0.55, flowSpray: 30,
  // カービング（2026-11-25 オーナー「カービングに演出を入れたい」）: カーブの間、切り込むほど高まる熱（0〜1）。
  // 切り込みは内へ寄りすぎないよう押したり離したりするので（押している割合は2〜3割）、同じカーブの中で離している間はゆっくり冷め（carveHold/秒）、
  // カーブを抜けると速く冷める（carveFade/秒）。carveBuild は切り込んでいる間に満ちる秒。刻みの数（音の高さ）は、カーブを抜けて carveChainGap 秒で数え直す。
  // carveWall: 外側の砂の壁の量の倍率（熱が満ちた時）、carveSparks: きらめく砂粒の数（1秒あたり）、rollCarve: カメラが内へ倒れる量（rad）
  carveBuild: 0.6, carveHold: 0.25, carveFade: 2.5, carveChainGap: 0.5, carveWall: 1.8, carveSparks: 26, rollCarve: 0.035,
  // 同日「カービングの演出もっとかっこよくして」: 金の残像の枚数（熱がこれを超えたら出す）、刻みごとの斬り込みの光の秒、外へ飛ぶ砂の筋の数（1秒あたり）、
  // 画面の外側の縁から流れる金の風の線の数、熱が満ちた瞬間（MAX）の視界の広がり
  carveGhosts: 3, carveGhostFrom: 0.35, carveStreaks: 60, carveEdgeLines: 8, carveMaxKick: 0.5,
  // 同日「輪なのがなんか違う」: 輪・楕円（足元の金の輪・板のまわりの三日月・板の下の弧）をやめ、板の外の縁がきらっと光る十字の光（carveGlint 秒）と、
  // 刻んだ線を板から後ろへ走る光（carveRun 秒）、外へ扇に散る砂の筋（carveBurst 本）にした
  carveGlint: 0.22, carveRun: 0.35, carveBurst: 16,
  // 派手なアクション（2026-11-27 オーナー「見本みたいな派手なアクションをちゃんと実際できるようにしたい」・DSR99）。見本＝遊び方の図解の絵。
  // 大ジャンプ: 人物は跳んだ高さの airLift 倍だけ持ち上げて描き（それまで 0.9）、跳んだ高さの airRise 倍だけカメラも上がる（上限 airRiseMax m。
  // 地面が下へ遠ざかり、高く跳んで見える。当たり判定は規則の軌道のまま）。踏み切りで板が砂を扇に跳ね上げ
  // （takeoffSand 粒・takeoffStreaks 筋）、視界が一瞬広がる（takeoffKick）。上っている間は板から砂がこぼれ落ちる（airTrail／秒）。空に風の線（airLines）。
  // スピン: 回っている間、板の先から砂の筋が横へ飛ぶ（spinSpray／秒）。半回転ごとに金のきらめき（spinSparks 粒）。
  // ブースト: 板の左右へ低く広がる砂の波（boostWake／秒。走路の先と人物は隠さない高さ）。発進の瞬間は砂を大きく蹴る（boostKickSand 粒）。
  // 鋭く切った時: 外へ飛ぶ砂の筋（steerRoost／秒）。どれも動き軽減では出さないか、ごく少なくする。
  airLift: 1.15, airRise: 0.5, airRiseMax: 1.6, takeoffSand: 34, takeoffStreaks: 44, takeoffKick: 0.45, airTrail: 30, airLines: 0.45,
  spinSpray: 44, spinSparks: 12, boostWake: 80, boostKickSand: 30, steerRoost: 46,
  // 絵で見せる砂と稲妻（DSR100・2026-11-27 オーナー「今操作の見本で結構派手な見た目になってるけどそれをサンドボード本編にも適応したい」）。
  // 大きさは人物の足元の 1m を 1 とした幅（m）。plume*: 踏み切りの砂の柱（出始め → 消える時の幅・秒）。landWake: 着地で左右へ広がる砂（完璧は landWakePerfect 倍）。
  // boostWake*: ブースト中、板の左右に出し続ける砂の波の幅と濃さ。boostBolts*: 体のまわりの稲妻の幅と、発進の瞬間・その後の濃さ。
  // carveWave*: カーブの外へ巻き上がる砂の波（熱 0 → 1 の幅）。steerWake*: 鋭く切った時の砂（横の速さ 0.5 → 1.5 の幅）。flicker: 絵を揺らす速さ（1秒あたりのコマ）
  plumeFrom: 2.2, plumeTo: 4.4, plumeLife: 0.7, landWake: 2.6, landWakePerfect: 1.3, landWakeLife: 0.42,
  boostWakeWide: 3.0, boostWakeAlpha: 0.95, boostBoltsWide: 3.0, boostBoltsStart: 1, boostBoltsHold: 0.5,
  // carveWave: 2026-11-27 オーナー「カーブは派手すぎる」（DSR102）で、幅 1.5→3.9 を 0.8→1.8 に、濃さ最大 1 を 0.6 に、高さを 0.7 倍（低く）にした
  carveWaveFrom: 0.8, carveWaveTo: 1.8, carveWaveAlpha: 0.6, carveWaveSquash: 0.7, steerWakeFrom: 1.3, steerWakeTo: 2.7, flicker: 14,
};
/** 効果音の音量は、勝敗・得点への影響が大きい出来事ほど大きく（滑走・風のループはこれより小さい）。 */
const SE_GAIN = Object.freeze({ fall: 0.7, goal: 0.7, leadChange: 0.6, perfect: 0.6, smash: 0.55, recover: 0.55, countdown: 0.55, boost: 0.5, thunder: 0.5,
  bigJump: 0.45, good: 0.45, near: 0.4, flow: 0.38, land: 0.36, carveTick: 0.32, spinHalf: 0.3, hop: 0.28, rivalBoost: 0.24, bounce: 0.22 });
const SPEED_FULL = SPEED.boost;  // 演出の「最速」（ブースト）
const RIVAL_NAMES = Object.freeze({ noor: "ヌール", naru: "なる" });
// 画像が読み込めない場合の競走相手の図形色。ヌール: 青緑の板・オリーブのシャツ・ベージュのスカーフ・束ねた黒髪・頭のサングラス。
// なる（新バージョンの服装・2026-11-11 オーナー「新バージョンのファッションにする」）: クリーム色の板・焦げ茶とクリーム色のボンバー・
// 灰色のワイドカーゴ・茶とクリーム色のスニーカー・日焼けした肌・銀灰色の短い髪
const RIVAL_LOOKS = Object.freeze({
  noor: { board: [[34, 168, 156], [44, 140, 132]], pants: [[168, 146, 108], [160, 124, 98]], shoes: "#3a2c22", shirt: [[110, 118, 62], [116, 100, 66]],
    sleeve: null, skin: [[176, 122, 84], [176, 110, 80]], hair: "#1b161d", ponytail: true, scarf: true, glasses: true, tag: "rgba(60,70,30,0.82)" },
  naru: { board: [[242, 220, 166], [236, 196, 140]], pants: [[104, 106, 112], [110, 98, 98]], shoes: "#7a5440", shirt: [[84, 54, 42], [92, 54, 44]],
    sleeve: [[226, 206, 176], [232, 192, 156]], skin: [[196, 146, 108], [196, 132, 100]], hair: "#b9b6b4", ponytail: false, scarf: false, glasses: false, tag: "rgba(72,46,34,0.85)" },
});
const GROUND_BLEED = 110;        // 傾いたカメラの角を埋めるため、砂を画面の外まで描く幅（px）
const SEG = 6;                   // 描く路面の1区間（m）
const DRAW_DIST = 380;           // 前方に描く距離（m）
const ROAD_SIDES = [-1, 1];
const SAND_SHOULDERS = [[1.0, 1.12, 0.05], [1.12, 1.3, 0.09], [1.3, 3.2, 0.13]];
const BOARD_TRACKS = [{ lane: -0.32, wob: 0.07, k: 0.021 }, { lane: 0.18, wob: 0.05, k: 0.017 }, { lane: 0.5, wob: 0.09, k: 0.013 }];
const active = new WeakMap();
// 固定パックの走行だけを保存する。ヌールはコースの段ごとに配置も走り方も異なる。
const rivalRunCache = new Map();
const isFixedCourse = course => COURSE_PACKS.some(pack => pack.id === course.id && pack.seed === course.seed);
function getRivalRun(course, who, tier) {
  if (!isFixedCourse(course)) {
    return rivalRun(course, { who, tier });
  }
  const key = `${course.id}/${who}/${tier ?? ""}`;
  if (!rivalRunCache.has(key)) rivalRunCache.set(key, rivalRun(course, { who, tier }));
  return rivalRunCache.get(key);
}
const RIDE_BGM = Object.freeze({ practice: "bgm_ethnic12", noor: "bgm_ethnic08", naru: "bgm_ethnic05" });

/**
 * 曲がりが十分に強くなる少し手前へ、左右で違う看板を置く。連続する同方向の曲がりには重ねない。
 * 曲がっている間は、外側の縁に同じ絵の小さな矢印板を並べる（row）。板の列が曲がって見えるので、カーブの向きと長さが分かる。
 */
function curveSignsFor(course) {
  if (course.practice) return [];
  const signs = [];
  let lastDirection = 0, lastAt = -200;
  for (let z = 32; z < course.length - 40; z += 8) {
    const curve = curveAt(course, z);
    const direction = Math.abs(curve) >= 0.45 ? Math.sign(curve) : 0;
    if (direction && direction !== lastDirection && z - lastAt > 96) {
      signs.push({ z: Math.max(28, z - 55), direction });
      lastAt = z;
      lastDirection = direction;
    } else if (Math.abs(curve) < 0.12) lastDirection = 0;
    if (direction && z % 32 === 0) signs.push({ z, direction, row: true });
  }
  return signs;
}

// ---- 砂の地面（2026-11-02 オーナー「砂漠をリアルに。今なんか見た目安っぽい」）--------------------------
// 風紋のある砂の模様を一度だけ作り、1行ずつ遠近をつけて貼る（奥ほど細かく流れ、速さが足元から伝わる）。
// 模様は周期的に作ってあるので継ぎ目が出ない。遠いほど縮小した模様（ミップ）を使い、ちらつきを抑える。
const SAND = { tile: 512, meters: 8 }; // 512px の模様が 8m 四方
const SAND_IS_LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const SAND_BUF_W = 640, SAND_ROW_H = 4, SAND_BUF_H = Math.ceil((H + GROUND_BLEED - HORIZON) / SAND_ROW_H) + 2;
let sandLevels = null;
function sandTexture() {
  if (sandLevels !== null) return sandLevels;
  sandLevels = [];
  if (typeof document === "undefined") return sandLevels;
  const N = SAND.tile, px = new Uint8ClampedArray(N * N * 4);
  // 周期的な値ノイズ（格子を端で折り返す。cells は 2 の累乗）
  let seed = 1234567;
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const grid = (cells) => {
    const v = new Float32Array(cells * cells), mask = cells - 1, scale = cells / N;
    for (let i = 0; i < v.length; i++) v[i] = rand();
    return (x, y) => {
      const fx = x * scale, fy = y * scale, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const y0 = (iy & mask) * cells, y1 = ((iy + 1) & mask) * cells, x0 = ix & mask, x1 = (ix + 1) & mask;
      return (v[y0 + x0] * (1 - sx) + v[y0 + x1] * sx) * (1 - sy) + (v[y1 + x0] * (1 - sx) + v[y1 + x1] * sx) * sy;
    };
  };
  const low = grid(4), mid = grid(16), warp = grid(8);
  // 風紋の非対称カーブ（Math.pow を 26 万回呼ばず 1024 点 LUT で引く）
  const RIPPLE_N = 1024, rippleLut = new Float32Array(RIPPLE_N);
  for (let i = 0; i < RIPPLE_N; i++) {
    const s = Math.sin((i / RIPPLE_N) * Math.PI * 2);
    rippleLut[i] = s > 0 ? Math.pow(s, 0.6) * 0.8 : -Math.pow(-s, 2.6) * 1.2;
  }
  const inv2Pi = RIPPLE_N / (2 * Math.PI);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // 風紋: 進む向きを横切る細い波（少し斜め・揺らぎあり）。風上側はなだらかに明るく、風下側は急に暗い
      const phase = 2 * Math.PI * (30 * y / N + 4 * x / N) + (warp(x, y) - 0.5) * 9;
      const li = Math.floor(phase * inv2Pi) & (RIPPLE_N - 1);
      const ripple = rippleLut[li];
      const tone = (low(x, y) - 0.5) * 0.2 + (mid(x, y) - 0.5) * 0.06; // 大きな明暗のむら
      const grain = (rand() - 0.5) * 0.06 + (rand() < 0.008 ? -0.1 : 0); // 砂粒と小さな影
      const k = 1 + tone + ripple * 0.07 * (0.6 + low(y, x) * 0.8) + grain;
      const i = (y * N + x) * 4;
      px[i] = Math.min(255, 232 * k); px[i + 1] = Math.min(255, 192 * k); px[i + 2] = Math.min(255, 138 * k); px[i + 3] = 255;
    }
  }
  // ミップ: 64 → 2 px/m。各段を Uint32Array（RGBA）で保持し、1行ごとの drawImage 100回超を単一バッファ転送にまとめる。
  // 起伏の粒模様（sandPattern）で使う 128px の段だけ canvas を1枚持つ。
  let cur = px;
  for (let size = N; size >= 16; size >>= 1) {
    const rgb = new Uint32Array(cur.buffer);
    let tile = null;
    if (size === 128) {
      tile = document.createElement("canvas");
      tile.width = tile.height = size;
      const tg = tile.getContext("2d"), tImg = tg.createImageData(size, size);
      tImg.data.set(cur);
      tg.putImageData(tImg, 0, 0);
    }
    sandLevels.push({ canvas: tile, rgb, size, mask: size - 1, density: size / SAND.meters });
    if (size > 16) {
      const nextSize = size >> 1, next = new Uint8ClampedArray(nextSize * nextSize * 4);
      for (let y = 0; y < nextSize; y++) {
        const y0 = (y << 1) * size, y1 = y0 + size;
        for (let x = 0; x < nextSize; x++) {
          const x0 = x << 1, a = (y0 + x0) << 2, b = (y0 + x0 + 1) << 2, c = (y1 + x0) << 2, d = (y1 + x0 + 1) << 2;
          const o = (y * nextSize + x) << 2;
          next[o] = (cur[a] + cur[b] + cur[c] + cur[d] + 2) >> 2;
          next[o + 1] = (cur[a + 1] + cur[b + 1] + cur[c + 1] + cur[d + 1] + 2) >> 2;
          next[o + 2] = (cur[a + 2] + cur[b + 2] + cur[c + 2] + cur[d + 2] + 2) >> 2;
          next[o + 3] = 255;
        }
      }
      cur = next;
    }
  }
  return sandLevels;
}

const RANK_WORDS = { S: "最高の一本", A: "見事な滑り", B: "いい滑り", C: "完走" };
const BOOST_MIN_PERCENT = BOOST.minGauge * 100;
// 練習の説明は、砂丘のガイドのヌールが話す（2026-11-25 オーナー「チュートリアルもあってもいいかも。ヌールが説明してくれる感じの」）。
// 顔のアイコンと名前の吹き出しで出す。ヌールは普通の日本語で、はじめを「ハジメ」と呼ぶ（語録は混ぜない）。台詞の末尾に「。」を付けない。
// 本番では通常の操作説明を出さない（低速でコース外に留まる時だけ復帰案内を出す）。従来方針（同「体勢崩した時とかブーストで立て直すとか文字が出るのは無くしたい。チュートリアルとかで文字で説明はいいけど」）。
const TUTORIAL = {
  move: "ハジメ、まずは「左へ」「右へ」で動いてみて",
  rock: "先を見て、岩は早めによけてね",
  fallRock: "大丈夫、次は早めによけてね",
  bump: "砂の山の手前で「ジャンプ」、大きく跳べるよ",
  brace: "輪が重なったら「LAND」を押して",
  retryBump: "次の山で、もう一回跳んでみよう",
  landPerfect: "完璧な着地、その調子",
  landGood: "もうちょっと遅く押すと完璧",
  landPlain: "着地の直前に押すと、体勢が整うよ",
  trick: "空中で「左へ」か「右へ」を押し続けて",
  trickLetGo: "早めに離して、着地を合わせてね",
  trickDone: "回転を決めると点もゲージも伸びるの",
  trickFall: "もう少し早く離して、着地を合わせてね",
  boost: "ゲージが目印まで溜まったら「BOOST」で加速",
  boostGo: "岩を砕くたびにブーストが短くなるよ",
  recover: "岩の壁に当たったら、すぐ「BOOST」で立て直して",
  recoverNow: "すぐ「BOOST」で立て直して",
  recoverDone: "立て直したら、そのまま加速",
  recoverLate: "当たった直後に押せば、立て直せるよ",
  recoverSmash: "ブーストがないときは、当たった直後に「BOOST」",
  recoverDodge: "当たっちゃった時は、直後に「BOOST」",
  curve: "矢印の向きに合わせて「左へ」を押して、切り込んで",
  carveOn: "切り込むほど熱が高まるよ",
  carveGauge: "内側に寄りすぎたら、少し離してまた押して",
  carveLong: "熱が高まると、金の残像も出るの",
  carveLate: "曲がる向きへ押し続けると、切り込めるよ",
  carveMiss: "カーブでは曲がる向きへ押し続けてみて",
  flow: "砂が流れてる所に乗ってみて",
  flowGo: "砂が運んでくれるの",
  flowMiss: "本番でも、流れる砂を見つけたら乗ってみて",
  finish: "あとは、ゴールまで滑るだけ",
};
// キーの名前（Space／← →／↓）は出さず、どの端末でも画面のボタンの名前で言う（2026-11-27 オーナー「PC版のスペースとかの表示を全てのゲームから無くす。スマホゲーにするから」）。
/** 練習でヌールが話す全部の台詞（検査で、吹き出しに収まるかを確かめる）。 */
export const TUTORIAL_LINES = Object.freeze(Object.values(TUTORIAL));
// カーブの合図（2026-11-13 オーナー「カービングとかすると何が起こるのかの説明が長い。文字で説明するよりエフェクトで」）:
// 切り込んでいない間だけ人物の横に切り込む向きの矢印（≫）を出す。2026-11-25 に矢印の横の一言「切り込め」もやめた（本番は文字を出さない。
// 切り込みの説明は練習のヌールが話す）。切り込むと、板の下に光る弧・「+30」・ゲージへ飛ぶ光の粒で、何が起きたかを見せる。
// 一度切り込めたら、その日は出さない。切り込まないままでも、合わせて CURVE_CUE_SECONDS 秒まで
const CURVE_CUE_SECONDS = 10;
const tutorialText = key => TUTORIAL[key];
// 遊び方（メニューの「？」で開いた時だけ見せる。常時は出さない）
// 遊び方の図解（2026-11-27 オーナー「文字で説明しすぎず、UIやボタンで視覚的に分かるように」「まだ文字が多い」）:
// 開いた時は6枚の絵札だけ（一枚絵・押す画面のボタンの絵・短い見出しと一言。キーの名前は出さない）。文章の説明（HOWTO）は「くわしく」を押した時だけ出す。
// 絵は gpt-image-2.6-sunburst で生成した場面（asset_sources/ui/minigame-visuals-20261127/desert/。滑走の絵を参照に渡して人物と砂丘をそろえた）
const HOWTO_CARDS = Object.freeze([
  { id: "dodge", title: "よける", note: "岩は左右でかわす", keys: ["left", "right"] },
  { id: "jump", title: "大ジャンプ", note: "起伏で押す → 輪で着地", keys: ["jump", "land"] },
  { id: "spin", title: "スピン", note: "空中で左右ボタンを長押し", keys: ["left", "right"], tags: ["360°", "720°"] }, // 押している間だけ回る（連打ではない）。2026-11-27 オーナー「押しっぱなしって何を？」で、押すものを書いた
  { id: "boost", title: "ブースト", note: "目印をこえたら発動", keys: ["boost"] },
  { id: "carve", title: "カーブ", note: "矢印の向きへ切り込む", keys: ["left"] },
  { id: "flow", title: "砂流れ", note: "明るい帯に乗ると加速", keys: [] }, // 入口の金の旗は 2026-11-26 に外してある（それまでの一言「金の旗の帯で加速」は古かった）
]);
// 絵は、実際の滑走の画面のスクショ（DSR101。撮り方は asset_sources/ui/minigame-visuals-20261127/desert/howto-screenshots/capture.mjs）
const howtoArt = id => `ui/desert_ride_howto/how_${id}.webp`;
// 遊び方の一行ごとの見出しの札（HOWTO の並びと同じ順）
const HOWTO_TOPICS = Object.freeze(["左右", "岩", "大ジャンプ", "回転", "回転", "着地", "ブースト", "立て直し", "カーブ", "砂流れ", "S評価"]);
// 文章の説明（「くわしく」で出す）。キーの名前は出さず、画面のボタンの名前で言う
const HOWTO = [
    "「左へ」「右へ」で左右。砂の上なので、少し遅れてついてくる",
    "岩は「左へ」「右へ」でよけるか、平らな所で「ジャンプ」して跳び越える（大きい岩は跳んだ高い所で越える）",
    "起伏の手前で「ジャンプ」で大ジャンプ。空中ではボタンが「LAND」に変わり、輪が重なった時に押すと着地が決まる（加速・ブースト回復）",
    "空中で「左へ」か「右へ」を押し続けると、360°、720°…と回り続ける。回転を決めると点とブーストゲージが伸びる",
    "大ジャンプで回り始めたら横には動かせない。離すと次の半回転まで回る",
    "回りかけで着地すると転ぶ。早めに離して半回転（180°）ごとの区切りに着地を合わせる。岩はぎりぎりでかすめるほど、点もブーストも大きい",
    `ゲージが目印（${BOOST_MIN_PERCENT}%）まで溜まったら「BOOST」。一気に加速し、ブースト中は岩にぶつかっても大丈夫。ただし岩はよけよう（砕くたびに短くなり、深い砂で切れる）`,
    "岩に当たった直後は、ゲージが少しでもあれば「BOOST」で立て直せる",
    "カーブでは外へ流される。曲がる向きへ切り込むほど熱が高まり、金の残像と砂しぶきが出る。刻むたびにブーストが溜まる",
    "砂が流れている明るい帯に乗ると、ゲージを使わずに速くなる（ブーストより遅く、岩は砕けない）",
    "ライバル戦のS評価は、Sラインの得点に加えてライバルに勝つ必要がある",
  ];

/**
 * 砂丘を滑る。host（本編は #stage）の上に全画面で重ね、「砂丘を下りる」か signal の中断で閉じる。
 * 完走するたびに onResult(result) を呼ぶ（何度でも）。戻り値 { results, practiced }。
 * @param opts.tutorial 最初に練習（ガイドの説明）から始める
 * @param opts.startRival メニューを通さず、この相手との本番からすぐ始める（rivals にある時だけ。デバッグの「なると勝負」用・2026-11-25）
 * @param opts.best 表示する自己ベスト { score, rank }（保存は呼び出し側）
 * @param opts.reducedMotion 揺れ・閃光・速度線を止める
 * @param opts.guide 練習と結果のひとことを言う人の名前（既定はヌール。練習の説明はヌールの顔と吹き出しで出す）
 * @param opts.rivals 本番で競える相手（"noor"、なるが開いていれば "naru" も。本編は上級クリアで開く・DSR107）
 * @param opts.naruSlot 入口の段の札の4枚目に、なるの札を置くか（既定 true。開くまでは「？？？」と鍵。第5章のように、なるが来ない日は false で札ごと出さない）
 * 三段階（#3779・core/play-tiers.js）: ヌールとの勝負（「滑る」）の段。なるとの勝負と練習は段の外。ゲームは保存を読まず、段の解放は呼び出し側が渡す。
 * @param opts.tiers 選べる段（既定は3段とも。本編は openTiers）。閉じた段は札に「〜クリアで開く」と出して押せない
 * @param opts.tier 最初に選んでおく段（本編は defaultTier。開いていなければ、開いている中でいちばん上）
 * @param opts.cleared クリア済みの段（札に「クリア済み」）。opts.tierNotes は開いた段の札の一言の差し替え（例: 上級の白火）
 * @param opts.easyBest 初級の自己ベスト { score, rank }（初級は自己ベストを別に持つ）
 * @param opts.bests 段別・なる戦の自己ベスト
 * @param opts.onTier 段を選んだ時に呼ぶ（本編は rememberTier と保存）
 * onResult は { tiers, cleared, note } を返してよい（記録した後の開いた段・クリア済みの段・結果のカードの一言。本編は tierUnlockNote）
 */
export function runDesertRide(options = {}) {
  return withMinigameStyles("desert-ride", options.signal, () => startDesertRide(options));
}

function startDesertRide({ host = document.getElementById("stage"), signal = null, tutorial = false, startRival = null, best = null, legacyBest = null, seed, courseId, rivals = ["noor"],
  tiers = TIERS, tier = "normal", cleared = [], tierNotes = null, easyBest = null, bests = null, onTier = null,
  reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, onResult = null, guide = "ヌール", speedUp = 1, layout = "landscape",
  naruSlot = true, downhill = null } = {}) {
  // layout: "portrait" は縦画面の試作（remake/previews/portrait-stage/frame/desert.html）だけが渡す。画面の並べ方は data-layout を見るCSSが決め、
  // 規則・採点・描く中身は横と同じ。縦では横向きの案内（回転ガード）を見張らない。既定（横）の動きは変えない。
  const portrait = layout === "portrait";
  // 下り坂の見え方（DOWNHILL）は縦だけ。downhill: true/false で明示すると横でも切り替えられる（横に当てた時の見え方の確認用）
  const sloped = downhill ?? portrait;
  const EYE_Y = sloped ? DOWNHILL.eye : HORIZON;       // 目の高さの地平線（空と遠くの稜線の境。遠景の絵を合わせる）
  const GROUND_Y = sloped ? DOWNHILL.ground : HORIZON; // 路面の消失線（坂の下の端）。EYE_Y より下にあるほど急な下りに見える
  const CAM_H = sloped ? DOWNHILL.height : CAM.height; // 斜面から測ったカメラの高さ（m）
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  if (signal?.aborted) return Promise.resolve({ results: [], practiced: false });
  if (!portrait) installRotateGuard(); // 本編では起動時、単体試遊ではここで回転案内を見張る。
  const bgmBefore = currentBgm();
  let rideBgm = null;
  const restoreBgm = () => { if (rideBgm && currentBgm() === rideBgm) playBgm(bgmBefore); };
  const art = loadDesertArt({ rivals: [], valley: sloped });
  // 対戦相手の絵も、メニューで選んでいる間に読み始めておく（走る前の門で待ち直さない）。
  const menuArt = rivals.length ? loadDesertArt({ rivals }) : art;
  preloadHudArt();
  const promise = new Promise(resolve => {
    const rideSe = createDesertRideSe();
    // 効果音もメニューの間に読み始めておく（同上）。
    void rideSe.ready().catch(() => {});
    const results = [];
    let practiced = false, done = false, frame = 0, runId = 0;
    const displayBests = desertDisplayBests({ best, easyBest, bests });
    const oldBest = legacyBest || (best && best.rulesVersion !== RULES_VERSION ? best : null);
    // 段（#3779）: 開いている段・選んでいる段・クリア済みの段・この場で新しく開いた段
    let openTiers = TIERS.filter(t => Array.isArray(tiers) && tiers.includes(t));
    if (!openTiers.length) openTiers = ["easy"];
    let chosenTier = openTiers.includes(tier) ? tier : openTiers[openTiers.length - 1];
    const clearedTiers = new Set(Array.isArray(cleared) ? cleared.filter(t => TIERS.includes(t)) : []);
    const freshTiers = new Set();
    // なるの札（DSR107・2026-11-27 オーナー「なると勝負は上級まで全部やると級みたいに解放される」「なるは？？？にしといて開放までは」）:
    // 段の札の4枚目。選んでいるか（chosenNaru）と、この場で新しく開いたか（freshNaru）。なるとの勝負は段の外なので、chosenTier とは別に持つ
    let chosenNaru = false, freshNaru = false;
    const root = el("section.desert-ride", { dataset: { test: "desert-ride", phase: "menu", reducedMotion: String(!!reducedMotion), ...(portrait ? { layout: "portrait" } : {}) }, tabindex: "-1", "aria-label": "DESERT RIDE" });
    const canvas = el("canvas.dr-canvas", { width: W, height: H, "aria-hidden": "true" });
    const ctx = canvas.getContext("2d");
    // HUD の上に重ねる面: ゲージへ飛ぶ光の粒（2026-11-13）。画面の砂・人物は下の canvas
    const fxCanvas = el("canvas.dr-fx", { width: W, height: H, "aria-hidden": "true" });
    const fxCtx = fxCanvas.getContext("2d");
    const hud = el("div.dr-hud");
    const caption = el("p.dr-caption", { role: "status", dataset: { test: "desert-caption" } });
    // 練習の説明: ヌールの顔・名前・吹き出し（2026-11-25）。顔のアイコンは設定の画風に合わせ、目録の読み込み前は現行の絵。読めなければ名前だけ
    const guideFace = el("img.dr-guide-face", { src: faceIconUrl("noor") || imgFileUrl("ui/face_icons/face_noor.webp"), alt: "", onerror: event => { event.currentTarget.hidden = true; } });
    const guideBox = el("div.dr-guide", { hidden: true, dataset: { test: "desert-guide" } }, [guideFace, el("div.dr-guide-body", [el("b.dr-guide-name", { text: guide || "ヌール" }), caption])]);
    /** 練習の説明を出す（空なら吹き出しごと隠す）。 */
    const tell = (text = "") => {
      caption.replaceChildren(...text.split(/(「(?:左へ|右へ|ジャンプ|LAND|BOOST)」)/g)
        .map((part, i) => i % 2 ? el("kbd", { text: part }) : part));
      guideBox.hidden = !text;
      if (tut && game) tut.toldAt = game.t;
    };
    /** 今の説明を出してから seconds 秒たったか（続けて話す時、前の一言を読む間を空ける）。 */
    const toldFor = seconds => !tut || game.t - (tut.toldAt ?? -9) >= seconds;
    const pop = el("div.dr-pop", { "aria-hidden": "true" });
    // 判定は左上のスコア欄に固定し、走路と人物を覆わない。開始合図だけ中央。
    const cutin = el("div.dr-cutin", { "aria-hidden": "true", dataset: { test: "desert-cutin" } });
    const startPop = el("div.dr-start-pop", { "aria-hidden": "true" });
    const versus = el("div.dr-versus", { "aria-hidden": "true", dataset: { test: "desert-versus" } });
    const feedback = el("div.dr-feedback", { dataset: { test: "desert-feedback" } }, [cutin, pop]);
    const panel = el("div.dr-panel");
    const controls = el("div.dr-controls", { hidden: true });
    const quit = el("button.dr-quit", { type: "button", text: "✕", title: "やめる", "aria-label": "やめる", dataset: { test: "desert-quit" }, hidden: true });
    const returnGuide = createReturnGuide();
    const returnCue = el("div.dr-return-cue", { hidden: true, role: "status", dataset: { test: "desert-return-cue" } });
    const actionKey = el("kbd"), actionRole = el("span");
    const actionCue = el("div.dr-action-cue", { hidden: true, dataset: { test: "desert-action-cue" } }, [actionKey, actionRole]);
    root.append(canvas, hud, fxCanvas, startPop, versus, guideBox, returnCue, actionCue, controls, panel);
    host.append(root);
    root.focus({ preventScroll: true });

    const input = { left: false, right: false };
    const releaseButtons = [];
    const resetInput = () => {
      input.left = input.right = false;
      for (const release of releaseButtons) release();
    };
    const isInterrupted = () => document.hidden || (!portrait && rotateGuarded());
    let pose = "rider";
    let paused = false, pauseDialog = null;
    const isPaused = () => paused || pauseDialog?.open;
    let game = null, mode = null, bot = null, botMemo = {}, botLag = 0, last = 0, world = null, particles = [], popT = 0, popText = "", popKind = "";
    let rival = null, raceWith = "noor", countdown = 0, countdownTotal = COUNTDOWN, countShown = "", slowT = 0, rings = [], floaters = [], halfShown = 0, curveSigns = [];
    // 手応え: 止め（規則の時計を止める残り秒）・揺れ・閃光・最後の着地の出来（潰しの大きさ）・
    // 止めの間だけ白く残す砕いた岩と、止めが明けたら飛ばすかけら・ゴールの余韻（{ t }。結果は確定済みで、絵だけ進める）
    let hitStopT = 0, shake = { t: 0, life: 1, ax: 0, ay: 0 }, flash = { t: 0, life: 1, peak: 0 }, flashDarkT = 0, lastLand = null;
    let pendingChips = [], goal = null, pendingResult = null, auraStartT = -1;
    // ゲージへ飛ぶ光の粒（orbs）と、まだ粒にしていない貯まった量（orbBank）、前のコマのゲージ。ゲージの光り（gaugePulseT）
    // 相手の板の演出（砂煙・着地の輪）は相手の足元を基準に、1m＝1 の大きさで持つ（遠くても近くても同じ見た目）
    let orbs = [], orbBank = 0, lastGauge = 0, gaugePulseT = 0;
    let rivalFx = { dust: [], rings: [], last: null, boostStartT: -9 };
    const smashFlash = new Set(), raced = new Set();
    const stop = seconds => { if (!reducedMotion && seconds > 0) hitStopT = Math.max(hitStopT, seconds); };
    const setShake = kind => {
      if (reducedMotion) return;
      const [ax, ay, life] = FEEL.shake[kind], left = shake.t > 0 ? (shake.t / shake.life) ** 2 : 0;
      if (ax + ay >= (shake.ax + shake.ay) * left) shake = { t: life, life, ax, ay }; // 残っている揺れより弱いものでは上書きしない
    };
    const setFlash = kind => {
      if (reducedMotion) return;
      const [life, peak] = FEEL.flash[kind];
      if (peak >= flash.peak * (flash.t > 0 ? flash.t / flash.life : 0)) flash = { t: life, life, peak };
      if (kind === "fall") flashDarkT = FEEL.flashFallDark[0];
    };
    let curveCueLeft = CURVE_CUE_SECONDS, curveCueOn = false, carved = false, lead = 0; // カーブの合図の残り時間と、相手との前後
    // カービングの演出（2026-11-25）: 熱（切り込み続けるほど 0→1）、続けて刻んだ数、切り込みをやめてからの秒
    // show: 切り込んでいる間 1 へ、離すと 0 へなめらかに（押したり離したりで砂の幕がぱっと消えないように）
    let carveFx = { heat: 0, chain: 0, off: 9, maxed: false, glints: [], runs: [], show: 0 };
    const view = { depth: CAM.depth, back: CAM.back, roll: 0, kick: 0, rise: 0 };
    // 縦では、横長の絵の左右を切って真ん中だけを見せる（css の側）。見えている幅の半分（絵の画素）を持ち、人物の横の字をその内側に置く。横は絵の幅いっぱい
    let safeHalf = W / 2;
    if (portrait && typeof ResizeObserver !== "undefined") {
      const watch = new ResizeObserver(() => { const shown = canvas.clientWidth; safeHalf = shown > 0 ? W / 2 * Math.min(1, root.clientWidth / shown) : W / 2; });
      watch.observe(root); watch.observe(canvas);
    }
    let fxShots = [];                       // 一度きりの絵の演出（踏み切りの砂の柱・着地の砂）。人物の足元の点に置く
    const riderPx = { unit: 120, lift: 0 }; // 人物の 1m の画素と、地面から持ち上げて描いている量（drawPlayerBody が毎コマ更新）
    let fxDt = 1 / 60;                      // 砂を出す量の計算に使う、直前のコマの長さ // 速さで広がる視界。back を depth に比例させ、人物の大きさは変えない
    const streaks = Array.from({ length: 80 }, (_, i) => ({ angle: (i / 80) * Math.PI * 2 + Math.random() * 0.1, phase: Math.random(), len: 0.6 + Math.random() * 0.8, w: 1 + Math.random() * 2 }));
    let tut = null, preloadRunId = -1;
    let cancelMenuWarm = () => {};
    const finish = () => {
      if (done) return;
      done = true;
      cancelMenuWarm();
      cancelAnimationFrame(frame);
      clearTimeout(cutinTimer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      document.removeEventListener("rotateguardchange", onInterruption);
      document.removeEventListener("visibilitychange", onInterruption);
      window.removeEventListener("blur", resetInput);
      signal?.removeEventListener("abort", finish);
      rideSe.dispose();
      resetBgmTempo();
      root.remove();
      delete window.__desertRide;
      restoreBgm();
      resolve({ results, practiced });
    };
    signal?.addEventListener("abort", finish, { once: true });

    // ---- 入力 -------------------------------------------------------------------------
    const skipGoal = () => { if (goal && goal.t >= FEEL.goalSkipAfter) goal.t = Math.max(goal.t, FEEL.goalAfter); };
    const act = () => {
      // 入力を止めるのは確認ダイアログ表示中と中断時だけ。paused（時計停止）中は
      // 検証用APIの手動駆動（pause + press + advance）を受け付ける従来の契約を保つ。
      if (pauseDialog?.open || isInterrupted()) return;
      if (goal) { skipGoal(); return; } // ゴールの余韻は押して飛ばせる
      if (game && !game.finished && mode && countdown <= 0) { const kind = press(game); if (kind) onPress(kind); }
    };
    let boostButtonFeedback;
    const doBoost = () => {
      if (pauseDialog?.open || isInterrupted() || !game || game.finished || !mode || countdown > 0) return;
      const kind = boost(game);
      if (kind) { onBoostEvent(kind); return; }
      rideSe.cue("boostShort");
      hudNodes.gaugeFeedback?.cancel();
      const highlight = { outline: "2px solid #fff2c4", outlineOffset: "2px" };
      const calm = reducedMotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const frames = calm
        ? [highlight, { outlineColor: "transparent" }]
        : [{ ...highlight, translate: "-4px" }, { ...highlight, translate: "4px" }, { outlineColor: "transparent", translate: "0" }];
      const timing = { duration: 260, easing: "ease-out" };
      boostButtonFeedback?.cancel();
      hudNodes.gaugeFeedback = hudNodes.gaugeBox.animate(frames, timing);
      boostButtonFeedback = boostButton.animate(frames, timing);
    };
    const onKey = event => {
      if (!root.isConnected || isInterrupted() || pauseDialog?.open) return;
      if (event.key === "Escape" && mode) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat) quit.click();
        return;
      }
      if (!mode || isPaused()) {
        if (event.key === "Escape" && panel.querySelector(".dr-help:not([hidden])")) {
          event.preventDefault(); event.stopImmediatePropagation();
          panel.querySelector(".dr-help-close").click();
        }
        return;
      }
      if (["ArrowLeft", "a", "A"].includes(event.key)) { if (!event.repeat) input.left = true; event.preventDefault(); }
      else if (["ArrowRight", "d", "D"].includes(event.key)) { if (!event.repeat) input.right = true; event.preventDefault(); }
      else if ([" ", "ArrowUp", "w", "W"].includes(event.key)) { if (!event.repeat) act(); event.preventDefault(); }
      else if (["ArrowDown", "Shift", "s", "S", "b", "B"].includes(event.key)) { if (!event.repeat) doBoost(); event.preventDefault(); }
    };
    const onKeyUp = event => {
      if (["ArrowLeft", "a", "A"].includes(event.key)) input.left = false;
      if (["ArrowRight", "d", "D"].includes(event.key)) input.right = false;
    };
    // 縦持ちやタブ切替の間は滑らない。持ち越されたキー・押しっぱなしも解除する。
    const onInterruption = () => {
      last = performance.now();
      if (isInterrupted()) { resetInput(); rideSe.stop(); }
    };
    document.addEventListener("rotateguardchange", onInterruption);
    document.addEventListener("visibilitychange", onInterruption);
    window.addEventListener("blur", resetInput);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    const holdButton = (label, cls, test, on, off, artKey) => {
      const button = el(`button.dr-touch.${cls}`, { type: "button", dataset: { test }, "aria-label": label }, [el("span", { text: label })]);
      const files = artKey === "jump" ? [DESERT_CONTROL_ART.jump, DESERT_CONTROL_ART.land] : [DESERT_CONTROL_ART[artKey]];
      let loaded = 0;
      for (const [index, file] of files.entries()) {
        const image = el(`img.dr-control-image${artKey === "jump" ? index ? ".dr-image-land" : ".dr-image-jump" : ""}`, { alt: "", draggable: false, decoding: "async" });
        image.addEventListener("load", async () => {
          await image.decode?.().catch(() => {});
          if (++loaded === files.length) button.classList.add("art-ready");
        });
        image.addEventListener("error", () => button.classList.remove("art-ready"));
        button.prepend(image);
        image.src = imgFileUrl(file);
      }
      const pointers = new Set();
      const down = event => { if (isInterrupted()) return; event.preventDefault(); unlockAudio({ warm: false }); pointers.add(event.pointerId); button.setPointerCapture?.(event.pointerId); button.classList.add("on"); on(); };
      const up = event => { pointers.delete(event.pointerId); if (!pointers.size) { button.classList.remove("on"); off(); } };
      releaseButtons.push(() => { pointers.clear(); button.classList.remove("on"); });
      button.addEventListener("pointerdown", down);
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, up);
      button.addEventListener("contextmenu", event => event.preventDefault());
      return button;
    };
    // ブーストの放電の稲妻: 形を描き直す間隔（秒）と、ボタン・ゲージそれぞれの最大本数（下の updateZaps）
    const ZAP_EVERY = 1 / 15;
    const ZAP_SLOTS = 7;
    let zapAt = 0, zapClock = 0.35, zapBurstT = 0, zapBurstShown = false;
    const jumpButton = holdButton("ジャンプ／着地", "dr-jump", "desert-jump", act, () => {}, "jump");
    const boostButton = holdButton("BOOST", "dr-boost", "desert-boost", doBoost, () => {}, "boost");
    // ブーストの放電（2026-11-11 オーナー「ブーストは溜まるとどんどん放電みたいな演出つけたい」）: ボタンの縁から稲妻
    const buttonZap = makeZap("dr-zap dr-zap-button", "0 0 208 208");
    boostButton.append(buttonZap.svg);
    // 空中（大ジャンプ）では着地のボタンに変わったと一目で分かるように: 青く光り、外から縮んでくる輪が
    // ボタンに重なった時（残り JUMP.landingWindow 秒）が押し時。上に「重なったら押す」→「今！」→「構えた！」の札。
    const landRing = el("i.dr-land-ring", { "aria-hidden": "true" });
    const landTag = el("b.dr-land-tag", { "aria-hidden": "true", dataset: { test: "desert-land-tag" } });
    jumpButton.append(landRing, landTag);
    controls.append(
      el("div.dr-touch-pair.dr-steer-pair", [
        holdButton("左へ", "dr-left", "desert-left", () => { input.left = true; }, () => { input.left = false; }, "left"),
        holdButton("右へ", "dr-right", "desert-right", () => { input.right = true; }, () => { input.right = false; }, "right"),
      ]),
      el("div.dr-touch-pair", [boostButton, jumpButton]),
    );
    root.append(el("span.dr-recover-hint", { text: "立て直せる！" }));
    // 画面の上の方をタップしてもジャンプ（ボタンの外に指が出ても続けられる）
    canvas.addEventListener("pointerdown", event => { if (mode) { event.preventDefault(); unlockAudio({ warm: false }); act(); } });
    quit.addEventListener("click", () => {
      if (!mode || pauseDialog?.open) return;
      if (goal) { goal.t = FEEL.goalAfter; return; } // ゴール後は結果へ（記録済み）
      resetInput();
      rideSe.stop();
      resetBgmTempo();
      root.dataset.paused = "true";
      pauseDialog = openMinigamePause(root, { id: "desert",
        onResume: () => { last = performance.now(); delete root.dataset.paused; },
        onQuit: () => {
          const message = mode === "practice" ? "練習をやめた。" : "途中でやめた。記録は残らない。";
          delete root.dataset.paused;
          stopRun();
          showMenu(message);
        },
      });
    });
    panel.addEventListener("click", event => { if (event.target.closest("button")) rideSe.play("decide", 0.35); });
    panel.addEventListener("focusin", event => { if (event.target.matches("button")) rideSe.play("cursor", 0.25); });

    // ---- 進行 -------------------------------------------------------------------------
    function setPhase(name) {
      root.dataset.phase = name;
      returnGuide(null); returnCue.hidden = true; actionCue.hidden = true;
    }
    /** 入口・練習のおわりの左の絵: 砂丘を跳ぶはじめと、並んで滑るヌール（滑走で使う背面の絵）。飾りなので読み上げない。 */
    function menuHero() {
      const art = (cls, file) => el(`img.${cls}`, { src: imgFileUrl(file), alt: "", decoding: "async", onerror: event => { event.currentTarget.hidden = true; } });
      return el("div.dr-menu-hero", { "aria-hidden": "true" }, [
        el("i.dr-menu-sun"),
        art("dr-menu-rival", DESERT_ART.noorRider.file),
        el("i.dr-menu-dust"),
        art("dr-menu-rider", DESERT_ART.riderJump.file),
      ]);
    }
    /** 遊び方の図解の1枚: 一枚絵（札いっぱい）の裾に、見出し・押す画面のボタンの絵・一言を重ねる。 */
    function howCard(card) {
      const art = (cls, file) => el(`img.${cls}`, { src: imgFileUrl(file), alt: "", decoding: "async", onerror: event => { event.currentTarget.hidden = true; } });
      return el("li.dr-how-card", { dataset: { how: card.id, test: "desert-help-card" } }, [
        el("div.dr-how-scene", { "aria-hidden": "true" }, [
          art("dr-how-art", howtoArt(card.id)),
          ...(card.tags || []).map((text, index) => el("em.how-tag", { text, style: { "--i": String(index) } })),
        ]),
        el("div.dr-how-caption", [
          el("div.dr-how-head", [
            el("b.dr-how-title", { text: card.title }),
            el("div.dr-how-keys", { "aria-hidden": "true" }, card.keys.map(name => art("dr-how-key", DESERT_CONTROL_ART[name]))),
          ]),
          el("span.dr-how-note", { text: card.note }),
        ]),
      ]);
    }
    function showMenu(message = "") {
      rideSe.stop();
      resetBgmTempo();
      mode = null; game = null; tut = null; bot = null; goal = null; pendingResult = null; hitStopT = 0; orbs = []; clearOrbCanvas();
      controls.hidden = true; quit.hidden = true; tell(); delete caption.dataset.kind; hud.replaceChildren();
      startPop.classList.remove("show"); versus.classList.remove("show");
      setPhase("menu");
      // ボタンは頭に印（▶・VS・旗・出口）を付け、名前は短く（「なると勝負」「練習」。読み上げは前の名前のまま）
      // 「滑る」は選んでいる札の相手と滑る（なるの札を選んでいれば、なるとの勝負。DSR107 で別のボタン「なると勝負」は入口から外した）
      const start = el("button.btn.primary.dr-button.dr-act-start", { type: "button", text: results.length ? "もう一度滑る" : "滑る", dataset: { test: "desert-start" },
        onclick: () => prepareAndStart("run", chosenNaru && rivals.includes("naru") ? "naru" : "noor") });
      const practice = el("button.btn.ghost.dr-button.dr-act-practice", { type: "button", text: "練習", "aria-label": practiced || results.length ? "練習をもう一度" : "練習から始める", dataset: { test: "desert-practice" }, onclick: () => prepareAndStart("practice") });
      const leave = el("button.btn.ghost.dr-button.dr-act-leave", { type: "button", text: "砂丘を下りる", dataset: { test: "desert-leave" }, onclick: finish });
      // 遊び方は「？」を開いた時だけ（#2838・ミニゲーム共通の方針）。練習は「練習から始める」が説明を兼ねる。
      // 遊び方: 開いた時は図解の6枚だけ。文章の説明は「くわしく」で出し入れする（行ごとに何の話かの札。文面は前と同じ）
      // 絵札の絵は、初めて開いた時に読む（入口を出した時や滑り出しに、使わない絵の読み込みを重ねない）
      const howCards = el("ul.dr-how-cards", { dataset: { test: "desert-help-cards" } });
      const howDetail = el("ul.dr-howto", { hidden: true, dataset: { test: "desert-help-detail" } },
        HOWTO.map((text, index) => el("li", { text, dataset: { topic: HOWTO_TOPICS[index] || "" } })));
      const showDetail = open => {
        howDetail.hidden = !open; howCards.hidden = open; howDetail.scrollTop = 0;
        more.textContent = open ? "図解にもどる" : "くわしく"; more.setAttribute("aria-expanded", String(open));
      };
      const more = el("button.btn.ghost.dr-button.dr-help-more", { type: "button", text: "くわしく", "aria-expanded": "false", dataset: { test: "desert-help-more" }, onclick: () => showDetail(howDetail.hidden) });
      const help = el("div.dr-help", { hidden: true, role: "dialog", "aria-label": "遊び方", dataset: { test: "desert-help-panel" } }, [
        el("p.dr-help-title", { text: "遊び方" }),
        howCards, howDetail,
        el("div.dr-help-actions", [
          more,
          el("button.btn.ghost.dr-button.dr-help-close", { type: "button", text: "閉じる", dataset: { test: "desert-help-close" }, onclick: () => { help.hidden = true; delete help.parentElement.dataset.help; helpButton.focus(); } }),
        ]),
      ]);
      const helpButton = el("button.dr-help-btn", { type: "button", text: "？", title: "遊び方", "aria-label": "遊び方", dataset: { test: "desert-help" },
        onclick: () => {
          if (!howCards.childElementCount) howCards.replaceChildren(...HOWTO_CARDS.map(howCard));
          showDetail(false); help.hidden = false; help.parentElement.dataset.help = "open"; help.querySelector(".dr-help-close").focus({ preventScroll: true });
        } });
      // 入口の画面（2026-11-27 オーナー「仮のCSSを、市販ゲームのような見た目に」）: 左に題字と滑る二人の絵、右の板に段・記録・ボタン。
      // 絵は滑走と結果で使っているもの（砂丘の背景・背面の人物・結果のボタン）。文言と data-test は前と同じ
      panel.replaceChildren(el("div.dr-card.dr-menu", { dataset: { test: "desert-menu", kind: "title" } }, [
        menuHero(),
        el("div.dr-menu-head", [
          el("p.dr-kicker", { text: "DUBAI · SAND DUNES" }),
          el("h2.dr-title", { text: "DESERT RIDE" }),
        ]),
        help, helpButton,
        el("div.dr-menu-board", [
          // 前置きの一文は出さない（題字と絵で分かる）。やめた時などの知らせがある時だけ、板のいちばん上に一行
          message ? el("p.dr-lead", { text: message }) : null,
          tierRow,
          bestSlot,
          oldBest ? el("p.dr-legacy-best", { text: `旧ルールの記録 ${oldBest.score.toLocaleString("ja-JP")}点 ／ ${oldBest.rank}（別記録）`, dataset: { test: "desert-legacy-best" } }) : null,
          el("div.dr-actions", [start, practice, leave]),
        ]),
      ]));
      syncTierRow();
      (tutorial && !practiced ? practice : start).focus();
    }
    // ---- 段（#3779）: メニューの「初級／中級／上級」の札。選んだ段は「滑る」「もう一度滑る」に効く（なるとの勝負・練習は段の外） ----
    const TIER_WORD = Object.freeze({ easy: "やさしい", normal: "ふつう", hard: "手ごわい" });
    const tierRow = el("div.dr-tiers", { role: "radiogroup", "aria-label": "勝負の難しさと相手", dataset: { test: "desert-tiers" } });
    const bestSlot = el("div.dr-best-slot");
    const bestLabel = key => key === "naru" ? "なる戦" : TIER_LABEL[key];
    const formatBest = top => `${top.score.toLocaleString("ja-JP")}点 ／ ${top.rank}`;
    const easyExclusions = "評価報酬の対象外";
    /** 段の札の下の一言: 閉じていれば開く条件、クリア済み、呼び出し側の案内（本編は上級に白火）、この場で開いた、ほかは段の手触り。 */
    function tierSub(t) {
      if (!openTiers.includes(t)) return `${TIER_LABEL[TIERS[TIERS.indexOf(t) - 1]]}クリアで開く`;
      if (t === "easy") return clearedTiers.has(t) ? `クリア済み · ${easyExclusions}` : easyExclusions;
      if (clearedTiers.has(t)) return "クリア済み";
      if (tierNotes && typeof tierNotes[t] === "string" && tierNotes[t]) return tierNotes[t];
      return freshTiers.has(t) ? "開いた！" : TIER_WORD[t];
    }
    /** 札の下の一言を、区切り（・）ごとのまとまりに分ける。狭い札で折れる時に、語の途中で切れないようにする（文面は同じ）。 */
    function phraseSpans(text) {
      const parts = [];
      let rest = String(text);
      for (;;) {
        const cut = rest.search(/[・·]/);
        if (cut < 0 || cut === rest.length - 1) break;
        const end = rest[cut + 1] === " " ? cut + 2 : cut + 1;
        parts.push(rest.slice(0, end)); rest = rest.slice(end);
      }
      parts.push(rest);
      return parts.map(part => el("span", { text: part }));
    }
    /** 札の下の一言の種類。word（段の手触り）・cleared・fresh は印（星・CLEAR・NEW）で見せるので字は出さず、locked・note・easy は字で見せる。 */
    function tierSubKind(t) {
      if (!openTiers.includes(t)) return "locked";
      if (t === "easy") return "easy";
      if (clearedTiers.has(t)) return "cleared";
      if (tierNotes && typeof tierNotes[t] === "string" && tierNotes[t]) return "note";
      return freshTiers.has(t) ? "fresh" : "word";
    }
    /** なるの札（4枚目）。開くまでは「？？？」と鍵で、名前も顔も開き方も出さない。開いたら名前と顔（星の代わり）。 */
    function naruCard() {
      const open = rivals.includes("naru"), chosen = open && chosenNaru;
      const hide = event => { event.currentTarget.hidden = true; };
      return el(`button.btn.dr-tier.dr-tier-naru${chosen ? ".primary" : ""}`, { type: "button", role: "radio", "aria-checked": String(chosen), disabled: !open,
        "aria-label": open ? `${RIVAL_NAMES.naru}と勝負` : "まだ会っていない相手",
        dataset: { test: "desert-tier-naru", tier: "naru", state: !open ? "locked" : chosen ? "chosen" : "open", ...(freshNaru ? { fresh: "true" } : {}) },
        onclick: () => chooseTier("naru") }, open
        ? [el("b", { text: RIVAL_NAMES.naru }), el("img.dr-tier-face", { src: faceIconUrl("naru") || imgFileUrl("ui/face_icons/face_naru.webp"), alt: "", "aria-hidden": "true", onerror: hide }),
          el("small", { dataset: { kind: freshNaru ? "fresh" : "word" }, text: freshNaru ? "開いた！" : RIVAL_TITLES.naru })]
        : [el("b", { text: "？？？" })]); // 錠の印は閉じた段と同じ（名前の左。CSS）
    }
    function syncTierRow() {
      const naruChosen = chosenNaru && rivals.includes("naru");
      tierRow.replaceChildren(...TIERS.map(t => {
        const open = openTiers.includes(t), chosen = !naruChosen && t === chosenTier;
        return el(`button.btn.dr-tier${chosen ? ".primary" : ""}`, { type: "button", role: "radio", "aria-checked": String(chosen), disabled: !open,
          dataset: { test: "desert-tier", tier: t, state: !open ? "locked" : chosen ? "chosen" : "open", ...(freshTiers.has(t) ? { fresh: "true" } : {}), ...(clearedTiers.has(t) ? { cleared: "true" } : {}) },
          onclick: () => chooseTier(t) }, [el("b", { text: TIER_LABEL[t] }), el("i.dr-tier-stars", { "aria-hidden": "true" }),
            el("small", { dataset: { kind: tierSubKind(t) } }, phraseSpans(tierSub(t))),
            t === "easy" && open ? el("em.dr-tier-flag", { "aria-hidden": "true", text: "報酬対象外" }) : null]);
      }), ...(naruSlot ? [naruCard()] : []));
      tierRow.dataset.slots = String(TIERS.length + (naruSlot ? 1 : 0));
      // 自己ベスト: 評価のメダルと点だけを見せる（「◯級の自己ベスト」「点 ／」は読み上げ用に残す）
      // 選んでいる札の自己ベストだけ（なるの札なら、なる戦の自己ベスト）
      bestSlot.replaceChildren(...[naruChosen ? "naru" : chosenTier].filter(key => displayBests[key])
        .map(key => el("p.dr-best", { dataset: { test: "desert-best", bestKey: key, rank: displayBests[key].rank } }, [
          el("span.dr-quiet", { text: `${bestLabel(key)}の自己ベスト ` }),
          el("b.dr-best-score", { text: displayBests[key].score.toLocaleString("ja-JP") }),
          el("span.dr-quiet", { text: "点 ／ " }),
          el("i.dr-best-rank", { text: displayBests[key].rank }),
        ])));
    }
    function chooseTier(t) {
      if (t === "naru") { // なるの札: 段の外。onTier（段の記憶）は呼ばない
        if (!naruSlot || !rivals.includes("naru")) return;
        chosenNaru = true;
        syncTierRow();
        tierRow.querySelector('[data-tier="naru"]')?.focus();
        return;
      }
      if (!openTiers.includes(t)) return;
      const changed = t !== chosenTier || chosenNaru;
      chosenTier = t; chosenNaru = false;
      syncTierRow();
      tierRow.querySelector(`[data-tier="${t}"]`)?.focus();
      if (changed) { try { onTier?.(t); } catch (error) { console.error(error); } }
    }
    /** 記録の後に呼び出し側が返した段の様子（開いた段・クリア済み）と、新しい対戦相手を受け取る。 */
    function takeTierReply(reply) {
      if (!reply || typeof reply !== "object") return null;
      if (Array.isArray(reply.tiers)) {
        const next = TIERS.filter(t => openTiers.includes(t) || reply.tiers.includes(t));
        for (const t of next) if (!openTiers.includes(t)) freshTiers.add(t);
        openTiers = next;
      }
      if (Array.isArray(reply.cleared)) for (const t of reply.cleared) if (TIERS.includes(t)) clearedTiers.add(t);
      if (Array.isArray(reply.rivals)) {
        const added = ["noor", "naru"].filter(who => reply.rivals.includes(who) && !rivals.includes(who));
        if (added.length) {
          rivals = [...rivals, ...added];
          if (added.includes("naru")) freshNaru = true; // 入口のなるの札が「？？？」から開く
          void loadDesertArt({ rivals: added }).whenReady().catch(() => {});
        }
      }
      return typeof reply.note === "string" && reply.note ? reply.note : null;
    }
    let queuedCourse = null;
    function pickRunCourse(tier) {
      if (courseId) return buildCourse({ id: courseId, tier });
      if (seed != null && Number.isFinite(Number(seed))) {
        const n = Number(seed);
        return COURSE_PACKS.some(p => p.seed === n) || tier ? buildCourse({ seed: n, tier }) : generateCourse(n);
      }
      return pickCourse((Math.random() * 0xFFFFFFFF) >>> 0, tier);
    }
    function onBoostEvent(kind) {
      if (kind === "recover") {
        if (game) auraStartT = game.t;
        // 2026-11-25: 立て直しは文字を出さない（オーナー「体勢崩した時とかブーストで立て直すとか文字が出るのは無くしたい」）。音・砂・輪・揺れ・閃光で見せる
        rideSe.play("boost", SE_GAIN.recover); burst(28, 1.8);
        rings.push({ age: 0, life: 0.7, power: 1.35, burst: true });
        setShake("recover"); setFlash("recover");
        hitStopT = 0; flashDarkT = 0; stop(FEEL.stopRecover); // 転倒の止めの残りは捨てて、立て直しの短い止めに替える（押したらすぐ走り出す）
        if (!reducedMotion) view.kick = Math.max(view.kick, 1.2);
      } else if (kind === "boost") {
        if (game) auraStartT = game.t;
        rideSe.play("boost", SE_GAIN.boost); showPop("BOOST!!", "boost"); burst(reducedMotion ? 10 : FEEL.boostKickSand, 1.3);
        if (!reducedMotion) fxShots.push({ name: "fxPlume", age: 0, life: 0.45, from: 1.2, to: 2.8, dx: 0, flip: Math.random() < 0.5, squash: 0.7 });
        // 発進の瞬間: 板の左右へ砂の筋が鋭く飛ぶ（DSR99）
        if (!reducedMotion) for (let i = 0; i < 28; i++) { const side = i % 2 ? 1 : -1; particles.push({ grain: true, x: side * (14 + Math.random() * 26), y: -4 - Math.random() * 8,
          vx: side * (420 + Math.random() * 620), vy: -(60 + Math.random() * 240), r: 2 + Math.random() * 2.5, life: 0.3 + Math.random() * 0.25, age: 0 }); }
        rings.push({ age: 0, life: 0.62, power: 1.2, burst: true });
        setShake("boost");
        if (!reducedMotion) view.kick = 0.7;
      }
    }
    /**
     * 走る前の準備（2026-11-11 オーナー「加速すると処理重い。ゲーム開始前に漫画付きロードとか挟んでもいい」）:
     * 絵・効果音を読み終えるまで待ち、ブーストの残像に使う色付きの絵を先に作っておく（走っている途中に作ると引っかかる）。
     * 準備済みならすぐ始め、長い読み込みだけ案内する（minigame-loading.js）。
     */
    let preparing = false;
    async function prepareAndStart(kind, who = raceWith) {
      if (preparing) return;
      preparing = true;
      cancelMenuWarm();
      try {
        unlockAudio({ warm: false });
        const tintWho = kind === "practice" ? null : rivals.includes(who) ? who : "noor";
        // 練習か対戦相手が決まったら、最初に鳴らす曲だけを絵・効果音の準備中に先読みする。
        const readyBgm = preloadBgm(RIDE_BGM[tintWho ?? "practice"]);
        const runArt = loadDesertArt({ rivals: kind === "practice" ? [] : [who], valley: sloped });
        const warm = () => {
          if (done) return;
          prewarmCanvas();
          prewarmTints(tintWho);
        };
        if (runArt.pending() || !rideSe.isReady()) {
          // 色付きの絵の先作りも門の中（漫画を読んでいる間）に済ませ、門が開いた直後の固まりをなくす。
          await withMinigameLoading(() => Promise.all([runArt.whenReady(), rideSe.ready()]).then(warm), { host, label: "砂丘へ向かっています…" }).catch(() => {});
        } else {
          warm();
        }
        if (!done) startRun(kind, who, readyBgm);
      } finally { preparing = false; }
    }
    function startRun(kind, who = raceWith, readyBgm) {
      const thisRun = ++runId;
      resetInput();
      unlockAudio({ warm: false });
      rideSe.stop();
      raceWith = rivals.includes(who) ? who : "noor";
      if (kind === "run") chosenNaru = raceWith === "naru";
      rideBgm = RIDE_BGM[kind === "practice" ? "practice" : raceWith];
      const ready = readyBgm ?? preloadBgm(rideBgm);
      playBgm(rideBgm);
      // 再生要求を出した曲の準備ができてから、空き時間に残りを1曲ずつ読む。
      const otherBgm = Object.values(RIDE_BGM).filter(key => key !== rideBgm);
      void ready.then(loaded => {
        if (loaded) return warmInBackground(otherBgm.map(key => () => preloadBgm(key)), {
          isCurrent: () => !done && !preparing && runId === thisRun,
        });
      });
      mode = kind;
      panel.replaceChildren();
      // 段はヌールとの勝負だけ（なるとの勝負・練習は段の外）
      const runTier = kind === "practice" || raceWith !== "noor" ? null : chosenTier;
      const course = kind === "practice" ? practiceCourse() :
        (queuedCourse?.tier === runTier ? queuedCourse.course : pickRunCourse(runTier));
      queuedCourse = null;
      rival = kind === "practice" ? null : getRivalRun(course, raceWith, runTier);
      game = createGame(course, { rival, tier: runTier });
      curveSigns = curveSignsFor(course);
      world = { sky: 0, yaw: 0, sunPulse: 0, slope: null, trail: [], flowPhase: 0 };
      resetBgmTempo();
      lead = 0; curveCueOn = false; carveFx = { heat: 0, chain: 0, off: 9, maxed: false, glints: [], runs: [], show: 0 };
      particles = []; fxShots = []; rings = []; floaters = []; clearTimeout(cutinTimer); cutin.classList.remove("show"); cutin.replaceChildren(); popT = 0; slowT = 0; halfShown = 0; bot = null; botMemo = {}; botLag = 0; zapClock = 0.35; zapBurstT = 0; zapBurstShown = false;
      hitStopT = 0; shake = { t: 0, life: 1, ax: 0, ay: 0 }; flash = { t: 0, life: 1, peak: 0 }; flashDarkT = 0; lastLand = null; auraStartT = -1; pendingChips = []; orbs = []; orbBank = 0; lastGauge = 0; gaugePulseT = 0; rivalFx = { dust: [], rings: [], last: null, boostStartT: -9 }; clearOrbCanvas(); smashFlash.clear(); goal = null; pendingResult = null;
      Object.assign(view, { depth: CAM.depth, back: CAM.back, roll: 0, kick: 0, boost: 0, rise: 0 });
      shownKmh = 0; // スタートの合図の間は止まっている（2026-11-13 オーナー「スタートのカウントのときも30キロあるのおかしい」）
      // スタートの合図: その相手との最初の一本は 3・2・1・GO を COUNTDOWN 秒で。2本目からは同じ合図を短く（すぐ滑り直せる）
      countdownTotal = kind === "practice" ? 0 : raced.has(raceWith) ? Math.min(COUNTDOWN, Math.max(0.3, FEEL.countdownRetry)) : COUNTDOWN;
      if (kind !== "practice") raced.add(raceWith);
      countdown = countdownTotal; countShown = "";
      root.dataset.countdown = countdown > 0 ? "on" : "";
      root.dataset.rival = rival ? raceWith : "";
      root.dataset.carve = "";
      // なるとの勝負は、スタートの合図の間に名乗りを出す
      versus.replaceChildren(...(rival && RIVAL_TITLES[raceWith] ? [el("small", { text: RIVAL_TITLES[raceWith] }), el("b", { text: `VS ${RIVAL_NAMES[raceWith]}` })] : []));
      versus.classList.toggle("show", versus.childElementCount > 0);
      tut = kind === "practice" ? { step: "move", moved: false, bumpTries: 0, said: new Set() } : null;
      pop.classList.remove("show"); startPop.classList.remove("show");
      controls.hidden = false; quit.hidden = false;
      setPhase(kind);
      delete caption.dataset.kind;
      tell(kind === "practice" ? tutorialText("move") : "");
      buildHud();
      updateHud(); // 開始直後から相手名・速度・BOOSTを表示する。最初の描画フレームを待たない。
      cancelAnimationFrame(frame);
      rideSe.ready().then(() => {
        if (done || mode !== kind || runId !== thisRun) return;
        if (countdown > 0 && !isPaused() && !isInterrupted()) rideSe.play("countdown", SE_GAIN.countdown, COUNTDOWN / countdownTotal); // 短い合図は、同じ音を速く
        last = performance.now();
        frame = requestAnimationFrame(tick);
      });
    }
    function preloadRideUi() {
      const thisRun = runId;
      preloadRunId = thisRun;
      void warmDesertUi(mode === "practice", () => !done && mode !== null && runId === thisRun);
    }
    function stopRun() { ++runId; cancelAnimationFrame(frame); mode = null; rideSe.stop(); resetBgmTempo(); versus.classList.remove("show"); }
    /** 何個出すか: 1秒あたりの量×経過。端数は確率で1個にする（どのフレームレートでも同じ量）。 */
    const emitCount = perSecond => { const n = perSecond * fxDt; return Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); };
    /** 踏み切りの砂（DSR99）: 板が砂丘の肩を蹴って、砂を後ろへ扇に跳ね上げる。視界も一瞬広がる。 */
    function takeoffSand() {
      const n = reducedMotion ? 8 : FEEL.takeoffSand;
      for (let i = 0; i < n; i++) particles.push({ x: (Math.random() - 0.5) * 90, y: -4, vx: (Math.random() - 0.5) * 420, vy: -(160 + Math.random() * 300), r: 8 + Math.random() * 16, life: 0.7 + Math.random() * 0.5, age: 0 });
      if (reducedMotion) return;
      for (let i = 0; i < FEEL.takeoffStreaks; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.1, v = 380 + Math.random() * 640;
        particles.push({ grain: true, x: (Math.random() - 0.5) * 70, y: -6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2.2 + Math.random() * 3, life: 0.4 + Math.random() * 0.35, age: 0 });
      }
      view.kick = Math.max(view.kick, FEEL.takeoffKick);
      // 砂の柱の絵（DSR100）: 踏み切った点から扇に噴き上がり、広がりながら消える
      fxShots.push({ name: "fxPlume", age: 0, life: FEEL.plumeLife, from: FEEL.plumeFrom, to: FEEL.plumeTo, dx: 0, flip: Math.random() < 0.5 });
    }
    function onPress(kind) {
      if (kind === "big") { rideSe.play("jump", SE_GAIN.bigJump); showPop("JUMP!", "jump"); takeoffSand(); }
      else if (kind === "hop") rideSe.play("jump", SE_GAIN.hop);
    }
    let font = null;
    const fontFamily = () => (font ??= getComputedStyle(root).fontFamily || "sans-serif");
    let cutinTimer = 0;
    /** 360 以上の着地結果。最新の一件だけをスコア欄に表示する。 */
    function showCutin(trick, grade) {
      const sub = grade === "perfect" ? "PERFECT" : grade === "good" ? "GOOD" : "LANDED";
      cutin.replaceChildren(el("div.dr-cutin-band", { dataset: { grade, dir: trick.dir > 0 ? "right" : "left" } }, [
        el("div.dr-cutin-words", [el("b", { text: `${trick.degrees}°` }), el("span", { text: sub })]),
      ]));
      pop.classList.remove("show"); // 回転中の角度を着地結果で置き換える
      cutin.classList.remove("show"); void cutin.offsetWidth; cutin.classList.add("show");
      cutin.dataset.degrees = String(trick.degrees);
      clearTimeout(cutinTimer);
      cutinTimer = setTimeout(() => { cutin.classList.remove("show"); cutin.replaceChildren(); }, reducedMotion ? 900 : 1000);
    }
    /** 得点の浮き出し（人物の頭の上から上がっていく）。 */
    function floater(text, kind = "") { floaters.push({ text, kind, age: 0, life: 0.95, dx: (Math.random() - 0.5) * 60 }); if (floaters.length > 8) floaters.shift(); }
    function showPop(text, kind = "") {
      popText = text; popKind = kind; popT = 1;
      // 着地直後の自動ブースト等で角度が一瞬で消えない。転倒は優先して知らせる。
      if (cutin.classList.contains("show") && ["boost", "combo", "jump"].includes(kind)) return;
      const node = kind === "count" || kind === "go" ? startPop : pop;
      if (node === pop) { clearTimeout(cutinTimer); cutin.classList.remove("show"); cutin.replaceChildren(); }
      node.textContent = text; node.dataset.kind = kind; node.classList.remove("show");
      void node.offsetWidth; node.classList.add("show");
    }

    // ---- ブーストの放電（2026-11-11 オーナー「ブーストは溜まるとどんどん放電みたいな演出つけたい」）-----------------
    // ゲージが溜まるほど、BOOST ボタンの縁とゲージから稲妻が多く・長く・頻繁に走る（満タンで最大）。人物の板の周りにも走る（drawCharge）。
    // 形は ZAP_EVERY 秒ごとに描き直してちらつかせる。ブースト中は放電しきって止まる。動き軽減では稲妻を出さず、満タンの光だけ。
    function makeZap(cls, viewBox) {
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", cls); svg.setAttribute("viewBox", viewBox); svg.setAttribute("aria-hidden", "true");
      if (cls.includes("gauge")) svg.setAttribute("preserveAspectRatio", "none");
      // 光は CSS の drop-shadow（描き直すたびにぼかし直す・重い）ではなく、同じ形の太く薄い線（glow）を下に敷いて出す
      const line = cls => { const path = document.createElementNS(ns, "path"); path.setAttribute("class", cls); path.setAttribute("fill", "none"); path.setAttribute("vector-effect", "non-scaling-stroke"); return path; };
      const glows = Array.from({ length: ZAP_SLOTS }, () => line("glow"));
      const paths = Array.from({ length: ZAP_SLOTS }, () => line("core"));
      svg.append(...glows, ...paths);
      return { svg, paths, glows };
    }
    /** ぎざぎざの稲妻（x0,y0 → x1,y1 を parts 個に折り、横へ最大 jitter ずらす）の SVG の path。 */
    function zapBolt(x0, y0, x1, y1, parts, jitter) {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
      for (let i = 1; i < parts; i++) {
        const t = i / parts, off = (Math.random() * 2 - 1) * jitter;
        d += ` L${(x0 + dx * t + nx * off).toFixed(1)} ${(y0 + dy * t + ny * off).toFixed(1)}`;
      }
      return `${d} L${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    /** 溜まり具合 charge（0〜1）に応じて、ボタンとゲージの稲妻を描き直す。 */
    /** 稲妻の光の線（glow）を、芯の線（core）と同じ形にそろえる。 */
    function syncZapGlows(zap) {
      if (!zap) return;
      zap.paths.forEach((path, i) => { const d = path.getAttribute("d"); if (d) zap.glows[i].setAttribute("d", d); else zap.glows[i].removeAttribute("d"); });
    }
    function updateZaps(charge, gaugeZap) {
      const before = zapAt;
      drawZaps(charge, gaugeZap);
      if (zapAt !== before) { syncZapGlows(buttonZap); syncZapGlows(gaugeZap); }
    }
    function drawZaps(charge, gaugeZap) {
      const now = performance.now() / 1000;
      const burst = zapBurstT > 0 && !reducedMotion;
      const zapState = burst ? "burst" : "";
      if (root.dataset.zap !== zapState) root.dataset.zap = zapState;
      // 「ビリッ」が鳴った瞬間は間隔を待たずに描き直す（音と光を合わせる）
      if (now - zapAt < ZAP_EVERY && !(burst && !zapBurstShown)) return;
      zapAt = now; zapBurstShown = burst;
      const zaps = [buttonZap, gaugeZap].filter(Boolean);
      if (reducedMotion || charge <= 0.08) { for (const zap of zaps) for (const path of zap.paths) path.removeAttribute("d"); return; }
      const full = charge >= 0.999 || burst; // 鳴った瞬間は満タンと同じだけ走らせる
      const shown = burst ? () => 0 : Math.random; // 1本ずつ、溜まるほど高い割合で光る（ちらつき）。鳴った瞬間は全部
      // ボタン（160×160 を 24 の余白で囲む）: 縁の一点から外へ跳ぶ稲妻と、縁を這う稲妻
      const buttonCount = full ? ZAP_SLOTS : Math.round(1 + charge * 4);
      buttonZap.paths.forEach((path, i) => {
        if (i >= buttonCount || shown() > 0.45 + 0.55 * charge) { path.removeAttribute("d"); return; }
        const side = Math.floor(Math.random() * 4), u = 0.12 + Math.random() * 0.76;
        const along = [[24 + 160 * u, 26], [182, 24 + 160 * u], [24 + 160 * u, 182], [26, 24 + 160 * u]][side];
        const out = [[0, -1], [1, 0], [0, 1], [-1, 0]][side], tan = [out[1], -out[0]];
        const reach = (14 + Math.random() * 18) * (0.6 + 0.6 * charge) * (burst ? 1.4 : 1);
        const crawl = Math.random() < 0.4;
        const end = crawl
          ? [along[0] + tan[0] * (24 + Math.random() * 30) + out[0] * 6, along[1] + tan[1] * (24 + Math.random() * 30) + out[1] * 6]
          : [along[0] + out[0] * reach + tan[0] * (Math.random() * 2 - 1) * 12, along[1] + out[1] * reach + tan[1] * (Math.random() * 2 - 1) * 12];
        path.setAttribute("d", zapBolt(along[0], along[1], end[0], end[1], crawl ? 6 : 4, crawl ? 5 : 4));
        path.dataset.core = burst || i % 3 === 0 ? "thick" : "";
      });
      if (!gaugeZap) return;
      // ゲージ（横 200・縦 40 に引き伸ばす。棒は真ん中の 10〜30）: 溜まった所から上下へ跳ぶ稲妻、満タンでは棒に沿って走る
      const gaugeCount = full ? ZAP_SLOTS : Math.round(1 + charge * 3);
      gaugeZap.paths.forEach((path, i) => {
        if (i >= gaugeCount || shown() > 0.4 + 0.6 * charge) { path.removeAttribute("d"); return; }
        const x = Math.random() * 200 * Math.min(1, charge);
        if (full && i % 2 === 1) {
          const x0 = Math.random() * 140;
          path.setAttribute("d", zapBolt(x0, 20, x0 + 30 + Math.random() * 30, 20, 7, 9));
        } else {
          const up = Math.random() < 0.5 ? -1 : 1;
          path.setAttribute("d", zapBolt(x, 20 + up * 4, x + (Math.random() * 2 - 1) * 16, 20 + up * (16 + Math.random() * 4), 4, 6));
        }
      });
    }

    // ---- HUD ---------------------------------------------------------------------------
    /**
     * 着地のボタンの合図（大ジャンプの空中だけ）。state: wait（まだ）→ soon（良い）→ now（完璧）、押した後は set。
     * ring: 輪の大きさ 1→0（0 でボタンに重なる＝残り JUMP.landingWindow 秒）。ホップ・跳ね返りでは出さない（着地の採点が無い）。
     */
    const noLandingCue = { state: "", ring: 1, tag: "" };
    function landingCue(g) {
      if (!(g.air > 0) || g.airKind !== "big" || g.fallT > 0) return noLandingCue;
      const ring = Math.max(0, Math.min(1, (g.air - JUMP.landingWindow) / Math.max(0.01, g.airTotal - JUMP.landingWindow)));
      if (g.landingPress !== null && g.landingPress <= JUMP.goodWindow) return { state: "set", ring: 0, tag: "構えた！" };
      if (g.air <= JUMP.landingWindow) return { state: "now", ring: 0, tag: "今！" };
      return { state: g.air <= JUMP.goodWindow ? "soon" : "wait", ring, tag: "重なったら押す" };
    }
    let hudNodes = null, shownKmh = toKmh(SPEED.start);
    // 速度メーター（2026-11-11 作り直し）: 左に針の文字盤、右に大きな数字。数字は文字盤の外に置き、針・弧と重ねない。
    // 文字盤は 0〜100 km/h を左下から右下まで 240° で回る。70 から上は赤い帯（ブーストでだけ届く）。
    const DIAL = Object.freeze({ c: 60, r: 41, from: 150, sweep: 240 });
    const SPEEDO_ARC = DIAL.r * DIAL.sweep * Math.PI / 180; // 弧の長さ（描く弧と同じ半径）
    const dialAngle = kmh => DIAL.from + DIAL.sweep * Math.max(0, Math.min(1, kmh / DISPLAY.dialMax));
    const dialPoint = (r, kmh) => {
      const a = dialAngle(kmh) * Math.PI / 180;
      return [+(DIAL.c + r * Math.cos(a)).toFixed(2), +(DIAL.c + r * Math.sin(a)).toFixed(2)];
    };
    const dialArc = (r, from, to) => {
      const [x0, y0] = dialPoint(r, from), [x1, y1] = dialPoint(r, to);
      const large = (to - from) / DISPLAY.dialMax * DIAL.sweep > 180 ? 1 : 0;
      return `M${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
    };
    function makeSpeedoDial() {
      const ns = "http://www.w3.org/2000/svg";
      const node = (tag, attrs = {}, kids = []) => {
        const n = document.createElementNS(ns, tag);
        for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
        n.append(...kids);
        return n;
      };
      const stops = list => list.map(([offset, color]) => node("stop", { offset, "stop-color": color }));
      const fill = node("path", { class: "dr-speedo-fill", d: dialArc(DIAL.r, 0, DISPLAY.dialMax), fill: "none", stroke: "url(#dr-speedo-heat)",
        "stroke-dasharray": SPEEDO_ARC.toFixed(2), "stroke-dashoffset": SPEEDO_ARC.toFixed(2) });
      const needle = node("g", { class: "dr-speedo-needle", transform: `rotate(${dialAngle(0)} ${DIAL.c} ${DIAL.c})` }, [
        node("path", { d: `M${DIAL.c - 9} ${DIAL.c} L${DIAL.c} ${DIAL.c - 2.6} L${DIAL.c + 46} ${DIAL.c} L${DIAL.c} ${DIAL.c + 2.6} Z` }),
      ]);
      const ticks = [];
      for (let kmh = 0; kmh <= DISPLAY.dialMax; kmh += 10) {
        const major = kmh % 20 === 0;
        const [x0, y0] = dialPoint(major ? 28 : 31, kmh), [x1, y1] = dialPoint(35, kmh);
        ticks.push(node("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: `dr-speedo-tick${major ? " major" : ""}${kmh >= DISPLAY.redFrom ? " red" : ""}` }));
      }
      const svg = node("svg", { class: "dr-speedo-gauge", viewBox: "0 0 120 120", "aria-hidden": "true" }, [
        node("defs", {}, [
          node("linearGradient", { id: "dr-speedo-heat", gradientUnits: "userSpaceOnUse", x1: 18, y1: 0, x2: 102, y2: 0 }, stops([[0, "#f6cf5a"], [0.55, "#f28a2a"], [1, "#e0381a"]])),
          node("radialGradient", { id: "dr-speedo-hub", cx: 0.38, cy: 0.34, r: 0.75 }, stops([[0, "#fff4cf"], [0.5, "#d49a3c"], [1, "#6e4212"]])),
        ]),
        node("path", { class: "dr-speedo-track", d: dialArc(DIAL.r, 0, DISPLAY.dialMax), fill: "none" }),
        node("path", { class: "dr-speedo-red", d: dialArc(DIAL.r + 5.5, DISPLAY.redFrom, DISPLAY.dialMax), fill: "none" }),
        fill, ...ticks, needle,
        node("circle", { class: "dr-speedo-hub", cx: DIAL.c, cy: DIAL.c, r: 6.5, fill: "url(#dr-speedo-hub)" }),
      ]);
      return { svg, fill, needle };
    }
    function buildHud() {
      const dial = makeSpeedoDial();
      const courseName = mode === "practice" ? "" : game.course.name;
      const courseText = courseName && game.tier ? `${courseName} · ${TIER_LABEL[game.tier]}` : courseName;
      hudNodes = {
        score: el("strong.dr-score", { text: mode === "practice" ? "練習" : "0" }), combo: el("span.dr-combo", { text: "" }),
        scoreValue: null, comboValue: null,
        time: el("span.dr-time", { text: "0.0" }), kmh: el("strong.dr-kmh", { text: "0", dataset: { test: "desert-kmh" } }), gauge: el("i"), gaugeBox: null, progress: el("i"),
        you: el("b.dr-mark.dr-mark-you", { title: "あなた" }), noor: el(`b.dr-mark.dr-mark-${raceWith}`, { title: RIVAL_NAMES[raceWith] }), race: el("span.dr-race", { dataset: { test: "desert-race-gap" } }),
        course: el("span.dr-course", { text: courseText, hidden: !courseName, dataset: { test: "desert-course" } }),
        speedo: el("div.dr-speedo", { dataset: { test: "desert-speedo" } }), speedFill: dial.fill, needle: dial.needle,
      };
      // BOOST は ⚡ とゲージだけ（% の文字は出さない。#2838）
      hudNodes.gaugeZap = makeZap("dr-zap dr-zap-gauge", "0 0 200 40");
      // 本編と単独ページで同じ目印を描き、尺はモデルの最低量から取る。
      hudNodes.gaugeMark = el("b.dr-gauge-min", {
        "aria-hidden": "true",
        style: {
          position: "absolute", left: `${BOOST_MIN_PERCENT}%`, top: "0", bottom: "0",
          width: "3px", marginLeft: "-1.5px", zIndex: "2", pointerEvents: "none",
          backgroundColor: "#fff3d0", borderRadius: "2px", boxShadow: "0 0 0 1px #482600",
        },
      });
      hudNodes.gaugeBox = el("div.dr-gauge", { dataset: { test: "desert-gauge" }, title: `BOOST · 目印（${BOOST_MIN_PERCENT}%）から使える` },
        [hudNodes.gauge, hudNodes.gaugeMark, hudNodes.gaugeZap.svg]);
      hudNodes.speedo.append(el("div.dr-speedo-dial", [dial.svg]), el("div.dr-speedo-read", [hudNodes.kmh, el("small", { text: "km/h" })]));
      hud.replaceChildren(
        el("div.dr-hud-left", [el("small", { text: mode === "practice" ? "PRACTICE" : "SCORE" }), hudNodes.score, hudNodes.combo, feedback]),
        el("div.dr-hud-center", [
          el("div.dr-progress", [hudNodes.progress, el("b.dr-progress-sun"), rival ? hudNodes.noor : null, hudNodes.you]),
          rival ? hudNodes.race : null,
          hudNodes.course,
        ]),
        el("div.dr-hud-right", [
          hudNodes.speedo,
          el("div.dr-boost-meter", [el("b.dr-bolt", { "aria-hidden": "true" }), hudNodes.gaugeBox]),
          el("div.dr-clock", [el("small", { text: "TIME" }), hudNodes.time]),
          quit,
        ]),
      );
    }
    // DOM への書き込みは「値が変わった時だけ」にする（2026-11-14 軽量化）。特に root の dataset は
    // 属性セレクタ経由でサブツリー全体のスタイル再計算を誘発するため、同値の毎フレーム代入を避ける。
    const setText = (node, v) => { if (node.textContent !== v) node.textContent = v; };
    const setData = (node, name, v) => { if (node.dataset[name] !== v) node.dataset[name] = v; };
    const setStyle = (node, prop, v) => { if (node.style[prop] !== v) node.style[prop] = v; };
    const setAttr = (node, name, v) => { if (node.getAttribute(name) !== v) node.setAttribute(name, v); };
    // CSSOM は整数の割合を「12%」と返す。末尾の .0 も揃え、同じ幅や位置の再代入を避ける。
    const progressPercent = z => `${Number((100 * Math.min(1, z / game.course.length)).toFixed(1))}%`;
    let lastLandRing = "";
    function updateHud() {
      const running = game && !game.finished && countdown <= 0 && (mode === "run" || mode === "practice");
      const direction = returnGuide(running ? game : null);
      returnCue.hidden = !direction;
      if (direction) setText(returnCue, direction === "right" ? "→ 右へ戻ろう" : "← 左へ戻ろう");
      const airborne = game?.air > 0;
      actionCue.hidden = !running || mode !== "practice" || game.fallT > 0 || (airborne && game.airKind === "bounce");
      if (!actionCue.hidden) {
        setText(actionKey, airborne ? "LAND" : "ジャンプ");
        setText(actionRole, airborne ? "着地" : "跳ぶ");
      }

      if (!hudNodes || !game) return;
      if (mode !== "practice") {
        const score = Math.max(0, Math.round(game.score));
        if (score !== hudNodes.scoreValue) {
          hudNodes.scoreValue = score;
          setText(hudNodes.score, score.toLocaleString("ja-JP"));
        }
      }
      const combo = game.combo;
      if (combo !== hudNodes.comboValue) {
        hudNodes.comboValue = combo;
        setText(hudNodes.combo, combo >= 2 ? `${combo} COMBO ×${(Math.min(3, 1 + 0.15 * combo)).toFixed(2).replace(/0$/, "")}` : "");
        setData(hudNodes.combo, "hot", combo >= 10 ? "2" : combo >= 5 ? "1" : "");
      }
      setText(hudNodes.time, (game.finishTime ?? game.t).toFixed(1)); // ゴールの余韻の間も、止まった時計を出す
      // 合図の間は 0 km/h。GO で針が跳ね上がる（板はその瞬間に滑り出す）
      const targetKmh = countdown > 0 ? 0 : toKmh(game.speed);
      shownKmh += (targetKmh - shownKmh) * (countdown > 0 ? 1 : 0.22);
      setText(hudNodes.kmh, String(Math.round(shownKmh)));
      const boosting = game.boostT > 0;
      const fastState = boosting ? "boost" : shownKmh > toKmh(SPEED.max) * 0.85 ? "fast" : "";
      setData(hudNodes.kmh, "fast", fastState);
      setData(hudNodes.speedo, "fast", fastState);
      const t = Math.max(0, Math.min(1, shownKmh / DISPLAY.dialMax));
      setAttr(hudNodes.speedFill, "stroke-dashoffset", (SPEEDO_ARC * (1 - t)).toFixed(2));
      setAttr(hudNodes.needle, "transform", `rotate(${dialAngle(shownKmh).toFixed(1)} ${DIAL.c} ${DIAL.c})`);
      const ready = !game.finished && game.gauge >= BOOST.minGauge;
      setStyle(hudNodes.gauge, "width", `${Math.floor(100 * (boosting ? game.boostT / BOOST.duration : game.gauge))}%`);
      setStyle(hudNodes.gaugeMark, "visibility", boosting ? "hidden" : "visible");
      setData(hudNodes.gaugeBox, "state", boosting ? "boost" : ready ? "full" : "");
      setData(root, "gauge", boosting ? "boost" : ready ? "full" : "");
      setData(root, "boost", boosting ? "on" : "");
      setData(root, "recover", canRecover(game) ? "ready" : "");
      const charge = boosting ? 0 : Math.max(0, Math.min(1, game.gauge));
      setData(root, "charge", charge >= 0.999 ? "max" : charge >= 0.5 ? "mid" : charge > 0 ? "low" : "");
      updateZaps(charge, hudNodes.gaugeZap);
      const canBrace = game.air > 0 && game.airKind !== "bounce";
      setData(jumpButton, "air", canBrace ? "true" : "");
      const aria = canBrace ? "着地" : "ジャンプ";
      if (jumpButton.getAttribute("aria-label") !== aria) jumpButton.setAttribute("aria-label", aria);
      const landing = landingCue(game);
      setData(jumpButton, "land", landing.state);
      const ring = landing.ring.toFixed(2); // 着地リングは 0.01 刻みで十分滑らか
      if (ring !== lastLandRing) { lastLandRing = ring; jumpButton.style.setProperty("--land", ring); }
      setText(landTag, landing.tag);
      // 走り出して4秒で消す（跳んだ人物の頭にかぶらないように。コース名は結果のカードにも出る）
      setData(hudNodes.course, "fade", countdown <= 0 && game.t > 4 ? "out" : "");
      const progress = progressPercent(game.z);
      setStyle(hudNodes.progress, "width", progress);
      setStyle(hudNodes.you, "left", progress);
      if (rival) {
        const noor = rivalAt(rival, game.rivalClock);
        setStyle(hudNodes.noor, "left", progressPercent(noor.z));
        const gap = game.z - Math.min(noor.z, game.course.length);
        const side = Math.abs(gap) < 3, shownGap = Math.max(1, Math.round(toMeters(Math.abs(gap)))); // 差は画面の縮尺の m で出す
        const name = RIVAL_NAMES[raceWith];
        // どちらかがゴールしたら、差は距離ではなく時間で出す（2026-11-13 オーナー「ライバルとの時差も距離に対してリアリティがない」。
        // それまでは相手がゴールの先ですぐ止まるので、後から来ると距離が縮んで見え、結果の秒差と合わなかった）
        const raceDone = game.race, rivalDone = game.rivalFinishT !== null;
        setText(hudNodes.race, countdown > 0 ? `VS ${name}`
          : raceDone ? (raceDone.won ? `${name}に ${raceDone.gap.toFixed(1)}秒差` : `${name}の勝ち +${raceDone.gap.toFixed(1)}秒`)
          : rivalDone ? `${name} ゴール +${Math.max(0, game.t - game.rivalFinishT).toFixed(1)}秒`
          : side ? `${name}と並走` : gap > 0 ? `${name}に ${shownGap}m 差` : `${name}まで ${shownGap}m`);
        setData(hudNodes.race, "lead", countdown > 0 ? "" : raceDone ? (raceDone.won ? "you" : "noor") : rivalDone ? "noor" : side ? "" : gap > 0 ? "you" : "noor");
        // 前後が入れ替わった瞬間（内部の距離で3以上の差がついた時）に一言。スタート直後の並びは数えない
        const now = countdown > 0 || game.finished || side ? lead : Math.sign(gap);
        if (now !== lead) {
          if (lead !== 0 || game.t > 4) { floater(now > 0 ? `${name}を抜いた！` : `${name}に抜かれた…`, now > 0 ? "race" : "behind"); rideSe.cue(now > 0 ? "overtake" : "overtaken", { gain: SE_GAIN.leadChange }); }
          lead = now;
        }
      }
      setData(root, "carve", game.carving ? "on" : "");
    }

    // ---- 練習の説明 ------------------------------------------------------------------
    function say(key) { if (tut.said.has(key + tut.step)) return; tut.said.add(key + tut.step); tell(tutorialText(key)); }
    function updateTutorial(events) {
      if (!tut) return;
      // 岩をよける段で転んだら、ヌールが声をかける（本番は転倒の文字を出さない）
      if (["move", "rock", "rock2"].includes(tut.step) && events.some(e => e.kind === "fall" && e.reason === "rock")) tell(tutorialText("fallRock"));
      if (tut.step === "move") {
        if (Math.abs(game.x) > 0.25) tut.moved = true;
        if (tut.moved && game.z > 60) { tut.step = "rock"; say("rock"); }
        else if (game.z > PRACTICE_LESSONS.rock) { tut.step = "rock"; say("rock"); }
      } else if (tut.step === "rock") {
        if (game.z > PRACTICE_LESSONS.bump) { tut.step = "bump"; say("bump"); }
      } else if (tut.step === "bump") {
        if (game.air > 0 && game.airKind === "big") { tut.step = "brace"; say("brace"); }
        else if (events.some(e => e.kind === "land" && e.grade === "bounce")) { tut.bumpTries += 1; tut.step = "bumpAgain"; say("retryBump"); }
      } else if (tut.step === "bumpAgain") {
        if (game.air > 0 && game.airKind === "big") { tut.step = "brace"; say("brace"); }
        else if (game.z > PRACTICE_LESSONS.secondRock) { tut.step = "rock2"; tell(tutorialText("rock")); }
      } else if (tut.step === "brace") {
        const landed = events.find(e => e.kind === "land" && e.grade !== "bounce");
        if (landed) { tut.step = game.z < PRACTICE_LESSONS.secondRock ? "rock2" : "finish"; tell(tutorialText(landed.grade === "perfect" ? "landPerfect" : landed.grade === "good" ? "landGood" : "landPlain")); }
      } else if (tut.step === "rock2") {
        if (game.z > PRACTICE_LESSONS.trick) { tut.step = "trick"; say("trick"); }
      } else if (tut.step === "trick") {
        if (game.spinDir !== 0 && game.spinHold) { tut.step = "trickLetGo"; say("trickLetGo"); }
        if (events.some(e => e.kind === "trick")) { tut.step = "boostWait"; tell(tutorialText("trickDone")); }
        else if (events.some(e => e.kind === "fall" && e.reason === "spin")) { tut.step = "boostWait"; tell(tutorialText("trickFall")); }
        else if (game.z > PRACTICE_LESSONS.boost - 5) tut.step = "boostWait";
      } else if (tut.step === "trickLetGo") {
        if (events.some(e => e.kind === "trick")) { tut.step = "boostWait"; tell(tutorialText("trickDone")); }
        else if (events.some(e => e.kind === "fall" && e.reason === "spin")) { tut.step = "boostWait"; tell(tutorialText("trickFall")); }
        else if (game.z > PRACTICE_LESSONS.boost - 5) tut.step = "boostWait";
      } else if (tut.step === "boostWait") {
        if (game.z > PRACTICE_LESSONS.boost && game.air <= 0) { tut.step = "boost"; chargeBoost(game, 1); say("boost"); }
      } else if (tut.step === "boost" || tut.step === "boostGo") {
        if (tut.step === "boost" && game.boostT > 0) { tut.step = "boostGo"; say("boostGo"); }
        // 岩の壁にわざと当たって、立て直しを一度やってみる（練習は猶予が長い）
        if (game.z > PRACTICE_LESSONS.recover) { tut.step = "recover"; say("recover"); }
      } else if (tut.step === "recover") {
        // 立て直しに使うゲージは、壁の直前で渡す（早く渡すと、当たる前のブーストで使い切って壁を砕いてしまう）
        if (!tut.wallGauge && game.z > PRACTICE_WALL - 14) { tut.wallGauge = true; chargeBoost(game, Math.max(0, 0.6 - game.gauge)); }
        if (events.some(e => e.kind === "recover")) { tut.step = "done"; tell(tutorialText("recoverDone")); }
        else if (events.some(e => e.kind === "fall" && e.reason === "rock")) { tut.step = "recoverNow"; tell(tutorialText("recoverNow")); }
        else if (events.some(e => e.kind === "smash")) { tut.step = "done"; tell(tutorialText("recoverSmash")); }
        else if (game.z > PRACTICE_WALL + 6) { tut.step = "done"; tell(tutorialText("recoverDodge")); }
      } else if (tut.step === "recoverNow") {
        if (game.stats.recoveries > 0) { tut.step = "done"; tell(tutorialText("recoverDone")); }
        else if (!canRecover(game)) { tut.step = "done"; tell(tutorialText("recoverLate")); }
      } else if (tut.step === "done") {
        // 2026-11-25: カーブ（切り込み）と砂流れ。本番では文字で教えないので、ここでヌールが話す
        if (game.z > PRACTICE_CURVE.from - 30) { tut.step = "curve"; say("curve"); }
      } else if (tut.step === "curve") {
        // 切り込み（カービング）は3段で話す: 切り込めた（熱と砂しぶき）→ 1回刻んだ（ブーストが溜まる・押したり離したり）→ 熱が高まった（金の残像と高い砂しぶき）
        if (game.carving) { tut.step = "carveOn"; tell(tutorialText("carveOn")); }
        else if (game.z > PRACTICE_CURVE.to) { tut.step = "flowWait"; tell(tutorialText("carveMiss")); }
      } else if (tut.step === "carveOn") {
        // 前の一言を読む間（1.6秒）を空けてから次へ
        if (game.stats.carves >= 1 && toldFor(1.6)) { tut.step = "carveGauge"; tell(tutorialText("carveGauge")); }
        else if (game.z > PRACTICE_CURVE.to) { tut.step = "flowWait"; tell(tutorialText(game.stats.carves ? "carveGauge" : "carveLate")); }
      } else if (tut.step === "carveGauge") {
        if ((game.stats.carves >= 2 || carveFx.heat >= 0.6) && toldFor(2)) { tut.step = "flowWait"; tell(tutorialText("carveLong")); }
        else if (game.z > PRACTICE_CURVE.to) tut.step = "flowWait";
      } else if (tut.step === "flowWait") {
        if (game.z > PRACTICE_FLOW - 40) { tut.step = "flow"; say("flow"); }
      } else if (tut.step === "flow") {
        if (events.some(e => e.kind === "flow")) { tut.step = "flowDone"; tell(tutorialText("flowGo")); }
        else if (game.z > PRACTICE_FLOW + FLOW.length) { tut.step = "flowDone"; tell(tutorialText("flowMiss")); }
      }
      if (game.z > game.course.length - 30 && tut.step !== "end") { tut.step = "end"; tell(tutorialText("finish")); }
    }

    /** カーブの合図（矢印）を出すか。本番と練習のカーブ（|c|≥0.4）の地上で、まだ一度も切り込めていない間だけ。合わせて CURVE_CUE_SECONDS 秒まで。 */
    function updateCurveTip(dt) {
      curveCueOn = false;
      if (!(mode === "run" || mode === "practice") || !game || game.finished) return;
      if (game.stats.carves > 0 || game.carving) carved = true;
      if (carved || curveCueLeft <= 0 || game.air > 0 || game.fallT > 0 || countdown > 0) return;
      if (Math.abs(game.x) > EDGE || Math.abs(curveAt(game.course, game.z)) < 0.4) return;
      curveCueOn = true;
      curveCueLeft -= dt;
    }

    // ---- ループ -------------------------------------------------------------------------
    function tick(now) {
      if (done || !mode) return;
      if (paused || pauseDialog?.open || isInterrupted()) { last = now; frame = requestAnimationFrame(tick); return; }
      const elapsed = Math.min(MAX_FRAME_ELAPSED, Math.max(0, now - last) / 1000);
      last = now;
      // 処理落ちで延びた分も、小さな更新に分けて同じ判定を通す。HUD・描画は表示するフレームに一度だけ。
      const updates = Math.max(1, Math.ceil(elapsed / UPDATE_STEP));
      const real = elapsed / updates * speedUp;
      let fxDt = 0, drawDt = 0;
      for (let i = 0; i < updates; i++) {
        fxDt = goal ? advanceGoal(real) : advanceRun(real);
        drawDt += fxDt;
        if (i === updates - 1 || (goal ? goal.t >= FEEL.goalAfter : game.finished)) break;
        simulateParticles(fxDt);
      }
      if (countdown <= 0 && !game.finished && preloadRunId !== runId) preloadRideUi();
      if (countdown <= 0) updateRideMotion();
      updateHud();
      simulateParticles(fxDt);
      draw(drawDt);
      if (goal) {
        if (goal.t >= FEEL.goalAfter) { goal = null; showResult(); return; }
      } else if (game.finished) {
        if (mode === "practice") { onFinished(); return; }
        beginGoal();
        if (!goal) return;
      }
      frame = requestAnimationFrame(tick);
    }
    function advanceRun(real) {
      if (countdown > 0) {
        // スタートの合図（3・2・1・GO）。合図の間は時計を進めない。数字は合図の長さを3等分して出す（短い合図でも同じ並び）
        countdown = Math.max(0, countdown - real);
        const third = countdownTotal / 3;
        const shown = countdown > third * 2 ? "3" : countdown > third ? "2" : countdown > 0 ? "1" : "GO!";
        if (shown !== countShown) {
          countShown = shown;
          if (shown === "GO!") { showPop("GO!", "go"); root.dataset.countdown = ""; versus.classList.remove("show"); if (!reducedMotion) view.kick = 1; }
          else showPop(shown, "count");
        }
        if (countdown > 0) return real;
      }
      // 止め（ヒットストップ）: 転倒・粉砕・完璧な着地・立て直しの瞬間、規則の時計だけを一瞬止める。砂煙・輪・文字・揺れは実時間で動かし続ける。
      // 止めの間に押したジャンプ・BOOST は受け付ける（立て直しは、止めの分だけ押しやすくなる）。動き軽減では止めない
      hitStopT = Math.max(0, hitStopT - real);
      const stopped = hitStopT > 0;
      if (!stopped) {
        // 止めが明けた瞬間に、白く残していた岩を消してかけらを飛ばす
        if (pendingChips.length) { for (const size of pendingChips) chips(size); pendingChips = []; }
        smashFlash.clear();
        slowT = Math.max(0, slowT - real); // 決めた瞬間のスロー（動き軽減では使わない）
      }
      const dt = stopped ? 0 : real * (slowT > 0 ? FEEL.slowRate : 1), fxDt = stopped ? real : dt;
      const before = game.events.length;
      if (stopped) {
        // 規則は進めない
      } else if (bot) {
        // 自動操縦（検査の pilot）は 1/60 秒ごとに判断して進める。画面の更新間隔に左右されず、
        // モデルの検査（remake/test/desert_ride.mjs）と同じ滑りになる。人の操作は従来どおり。
        botLag += dt;
        while (botLag >= BOT_STEP - 1e-9 && !game.finished) {
          const { input: botInput, action } = botControl(game, bot, botMemo);
          Object.assign(input, botInput);
          if (action === "press") { const kind = press(game); if (kind) onPress(kind); }
          else if (action === "boost") boost(game);
          step(game, input, BOT_STEP);
          botLag -= BOT_STEP;
        }
      } else {
        const steps = Math.max(1, Math.ceil(dt / BOT_STEP));
        const stepDt = dt / steps;
        // 左右のボタン・キーは最大舵角（2026-11-11 オーナー「スティックはいらない」でスティックを外した）
        for (let i = 0; i < steps && !game.finished; i++) step(game, input, stepDt);
      }
      const events = game.events.slice(before);
      react(events);
      spawnOrbs();
      // ブーストの放電: 溜まるほど「ビリッ」の間隔が詰まる。鳴った瞬間はボタン・ゲージ・板の稲妻を強く光らせて音と合わせる
      const charge = game.boostT > 0 || game.finished ? 0 : game.gauge;
      zapBurstT = Math.max(0, zapBurstT - real);
      if (charge >= 0.1) {
        zapClock -= real;
        if (zapClock <= 0) { rideSe.zap(charge); zapBurstT = 0.14; zapClock = desertZapGap(charge); }
      } else zapClock = 0.35; // 溜まり始めたら少しして最初の1発
      updateCurveTip(real);
      updateTutorial(events);
      return fxDt;
    }
    function updateRideMotion() {
      const boosting = !goal && game.boostT > 0;
      rideSe.motion({
        speed: (game.speed / SPEED.max) * (boosting ? 1.35 : 1),
        carve: goal ? 0 : Math.max(Math.abs(game.vx), game.carving ? 0.9 : 0, game.inFlow ? 1 : 0), // 砂流れの上は、砂のこすれる音が続く
        grounded: game.air <= 0 && game.fallT <= 0,
        // ブースト中の風切り（終わりの0.5秒で消える）
        boost: boosting && !game.finished ? Math.min(1, game.boostT / 0.5) : 0,
      });
    }
    /**
     * ゴールの余韻（FEEL.goalAfter 秒）: 結果のカードをすぐ重ねず、幕をくぐって滑り抜けるところを見せる（止め・閃光・紙吹雪・勝利の加点）。
     * 結果はゴールした瞬間に確定して呼び出し側へ渡してある（途中で閉じても記録は残る）。ここから先の game は絵のためだけに進める
     * （位置・速さ・時計・空中／転倒／ブーストの残り・相手の再生）。ジャンプのボタン・画面のタップ・Esc で飛ばせる。
     */
    function beginGoal() {
      const thisRun = runId;
      const completed = commitResult();
      if (done || !mode || runId !== thisRun) return;
      pendingResult = completed;
      goal = { t: 0 };
      tell(); delete caption.dataset.kind;
      controls.hidden = true; quit.hidden = true;
      resetBgmTempo();
      showPop("GOAL!", "go");
      const won = game.race?.won;
      if (!reducedMotion) { stop(FEEL.stopGoal); setFlash("goal"); setShake("goal"); confetti(won ? 90 : 54); }
    }
    function advanceGoal(real) {
      hitStopT = Math.max(0, hitStopT - real);
      if (hitStopT <= 0) {
        goal.t += real;
        game.t += real;
        game.speed *= Math.exp(-FEEL.goalBrake * real); // 1コマが長くても（早送り・処理落ち）同じ距離を滑る
        game.z += game.speed * real;
        game.rivalClock += real; // 相手も止めない（後から来た相手は、そのまま滑り込む）
        if (game.air > 0) { game.air = Math.max(0, game.air - real); if (game.air === 0) { game.airKind = null; game.landedAt = game.t; game.rot = 0; game.spinDir = 0; } }
        game.fallT = Math.max(0, game.fallT - real);
        game.boostT = Math.max(0, game.boostT - real * 3);
        game.carving = false;
      }
      return real;
    }
    /** ゲージが増えた分だけ、人物の板からゲージへ光の粒を飛ばす（かすめ・着地・トリック・カービング、どれで貯まっても）。 */
    function spawnOrbs() {
      const gained = game.gauge - lastGauge;
      lastGauge = game.gauge;
      if (!(gained > 0)) return;
      if (reducedMotion) { gaugePulseT = 0.25; return; } // 動き軽減: 粒は飛ばさず、ゲージが光るだけ
      orbBank += gained;
      const p = placeAt(game.z, game.x);
      if (!p) return;
      const unit = p.scale * (H / 2), baseY = p.y - riderLift(shownHeight(game), unit, p.y);
      let n = Math.floor(orbBank / FEEL.orbEach);
      orbBank -= n * FEEL.orbEach;
      n = Math.min(n, 6);
      for (let i = 0; i < n && orbs.length < 48; i++) {
        orbs.push({ x0: p.x + (Math.random() - 0.5) * unit * 0.8, y0: baseY - unit * (0.15 + Math.random() * 0.5), age: -i * 0.04, life: 0.42 + Math.random() * 0.16,
          bend: (Math.random() - 0.5) * 160, lift: 80 + Math.random() * 90, trail: [] });
      }
    }
    function react(events) {
      const trick = events.find(e => e.kind === "trick");
      for (const event of events) {
        if (event.kind === "land") {
          const big = event.grade !== "bounce" && event.grade !== "hop";
          rideSe.play("land", SE_GAIN[event.grade === "perfect" || event.grade === "good" || event.grade === "hop" || event.grade === "bounce" ? event.grade : "land"]);
          lastLand = event.grade;
          const big360 = trick && trick.half >= 2; // 360 以上は角度と着地を一つの結果にまとめる
          if (big360) showCutin(trick, event.grade);
          if (event.grade === "perfect") { SE.perfect(); if (!big360) showPop(trick ? `${trick.degrees}° PERFECT!` : "PERFECT", trick ? "trick" : "perfect"); burst(30, 1.5); }
          else if (event.grade === "good") { SE.good(); if (!big360) showPop(trick ? `${trick.degrees}°! GOOD` : "GOOD", trick ? "trick" : "good"); burst(18, 1.1); }
          else if (event.grade === "plain") { if (trick && !big360) showPop(`${trick.degrees}°!`, "trick"); burst(12, 0.9); }
          else burst(6, 0.6);
          if (event.gaugeGained > 0) floater(`BOOST +${Math.round(event.gaugeGained * 100)}%`, "gauge");
          else if (event.points) floater(`+${event.points}`, event.grade);
          if (big && !reducedMotion) {
            // 着地の砂の絵（DSR100）: 板の左右へ、砂が低く広がる。完璧な着地ほど大きい
            const wide = FEEL.landWake * (event.grade === "perfect" ? FEEL.landWakePerfect : event.grade === "good" ? 1.12 : 1);
            for (const side of [-1, 1]) fxShots.push({ name: "fxWake", age: 0, life: FEEL.landWakeLife, from: wide * 0.55, to: wide, dx: side * 0.22, flip: side < 0 });
          }
          if (big) {
            // 輪は着地の出来で色が変わる（完璧＝金の二重、良い＝白、ふつう＝薄い砂色）。完璧は一瞬止めて、白く光る
            rings.push({ age: 0, life: 0.55, power: event.grade === "perfect" ? 1.3 : 1, grade: event.grade });
            setShake(event.grade === "perfect" ? "landPerfect" : "land");
            if (event.grade === "perfect") { stop(FEEL.stopPerfect); setFlash("perfect"); }
          }
        } else if (event.kind === "trick") {
          SE.reelWin(); // 角度は HUD の一か所だけ。人物の横に重複表示しない。
          if (event.half >= 2) { SE.just(); if (!reducedMotion) slowT = FEEL.slowTrick; } // カットインの間はゆっくり
        } else if (event.kind === "fall") {
          // 転倒も文字を出さない（2026-11-25・同上）。音・砂・暗い閃光・揺れ・止めで見せる（練習ではヌールが話す）
          rideSe.play("fall", SE_GAIN.fall); burst(34, 1.6);
          setShake("fall"); setFlash("fall"); stop(FEEL.stopFall);
        } else if (event.kind === "near") {
          // 近いほど高い音・大きい点。当たる寸前は「ギリギリ！」
          const close = event.closeness ?? 0.5;
          rideSe.play("near", SE_GAIN.near, 1 + 0.3 * close);
          floater(`${close >= 0.8 ? "ギリギリ！" : "かすめ"} +${event.points}`, "near");
          if (game.combo >= 2) showPop(`${game.combo} COMBO`, "combo");
        } else if (event.kind === "smash") {
          rideSe.play("smash", SE_GAIN.smash); floater(`粉砕 +${event.points}`, "smash"); setShake("smash");
          if (reducedMotion || !(FEEL.stopSmash > 0)) chips(event.size);
          else {
            // 砕いた岩は、止めの間だけ白く残す。止めが明けた瞬間に消して、かけらを飛ばす
            stop(FEEL.stopSmash); pendingChips.push(event.size);
            for (const rock of game.smashedRocks) if (rock.z > game.z - 4) smashFlash.add(rock);
          }
        }
        else if (event.kind === "carve") {
          floater(`+${event.points}`, "carve"); // 文字より点数（光の粒がゲージへ飛ぶのは spawnOrbs）
          // 刻みごと（2026-11-25）: 続けて切り込むほど高くなる音。板の外の縁がきらっと光り、刻んだ線を光が後ろへ走り、砂の筋が外へ扇に散る（輪は出さない）
          carveFx.chain += 1;
          rideSe.cue("carve", { n: carveFx.chain, gain: SE_GAIN.carveTick });
          carveCut(event.dir || Math.sign(curveAt(game.course, game.z)) || 1, false);
        }
        else if (event.kind === "flow") {
          // 砂流れに乗った: 文字は出さず、砂の音・足元の砂しぶき・視界の広がりで知らせる
          rideSe.play("carve", SE_GAIN.flow, 1.2); burst(14, 0.9);
          rings.push({ age: 0, life: 0.45, power: 0.9, grade: "flow" });
          if (!reducedMotion) view.kick = Math.max(view.kick, FEEL.flowKick);
        }
        else if (event.kind === "gaugeFull") { rideSe.play("thunder", SE_GAIN.thunder); zapBurstT = 0.35; zapClock = 0.6; floater("BOOST OK", "gauge"); } // 満タンは雷の一発だけ
        else if (event.kind === "boost") onBoostEvent("boost");
        else if (event.kind === "recover") onBoostEvent("recover");
        else if (event.kind === "boostEnd") { if (event.reason === "edge") floater("深い砂でブースト切れ…", "behind"); }
        else if (event.kind === "race") {
          const name = RIVAL_NAMES[event.who] || "ヌール";
          if (event.won) floater(`${name}に勝利 +${event.points}`, "race");
          else if (event.gap > 0) floater(`${name}まで あと ${event.gap.toFixed(1)}秒`, "behind");
        } else if (event.kind === "finish") { rideSe.play("goal", SE_GAIN.goal); }
      }
      // 回転中は半回転ごとに角度を見せる（180 → 360 → …）。区切りの音は回るほど高い
      const half = game.spinDir !== 0 ? Math.floor(Math.abs(game.rot) * 2 + 1e-6) : 0;
      if (half > halfShown && half > 0) {
        rideSe.cue("spin", { n: half, gain: SE_GAIN.spinHalf }); showPop(`${half * 180}°`, "spin");
        // 半回転ごとに、体のまわりへ金のきらめきが散る（DSR99。輪は出さない）
        if (!reducedMotion) for (let i = 0; i < FEEL.spinSparks; i++) particles.push({ spark: true, x: (Math.random() - 0.5) * 170, y: -riderPx.lift - Math.random() * riderPx.unit * 1.5,
          vx: (Math.random() - 0.5) * 380, vy: -(60 + Math.random() * 220), r: 1.8 + Math.random() * 2.4, life: 0.45 + Math.random() * 0.3, age: 0 });
      }
      halfShown = half;
    }
    function onFinished() {
      rideSe.stop();
      resetBgmTempo();
      tell(); delete caption.dataset.kind;
      controls.hidden = true; quit.hidden = true;
      if (mode === "practice") {
        practiced = true;
        mode = null;
        tell();
        setPhase("practiced");
        panel.replaceChildren(el("div.dr-card.dr-menu", { dataset: { test: "desert-practiced", kind: "practiced" } }, [
          menuHero(),
          el("div.dr-menu-head", [
            el("p.dr-kicker", { text: "PRACTICE DONE" }),
            el("h2.dr-title", { text: "練習おわり" }),
          ]),
          el("div.dr-menu-board", [
            el("p.dr-lead", { text: guide ? `${guide}「もう一度練習してもいいし、本番へ進んでもいいよ」` : "もう一度練習するか、本番へ進もう。操作は「？」でも確認できる。" }),
            el("div.dr-actions", [
              el("button.btn.primary.dr-button.dr-act-start", { type: "button", text: "本番を滑る", dataset: { test: "desert-start" }, onclick: () => prepareAndStart("run", "noor") }),
              el("button.btn.ghost.dr-button.dr-act-practice", { type: "button", text: "もう一度練習", dataset: { test: "desert-practice" }, onclick: () => prepareAndStart("practice") }),
              el("button.btn.ghost.dr-button.dr-act-leave", { type: "button", text: "砂丘を下りる", dataset: { test: "desert-leave" }, onclick: finish }),
            ]),
          ]),
        ]));
        panel.querySelector("button")?.focus();
        return;
      }
      showResult(commitResult());
    }
    /** ゴールした瞬間に結果を確定して、呼び出し側へ渡す（余韻の途中で閉じても記録が残る）。 */
    function commitResult() {
      const result = summary(game);
      results.push(result);
      const key = desertBestKey(result), top = displayBests[key];
      const newBest = !top || result.score > top.score;
      if (newBest) displayBests[key] = result;
      let note = null;
      try { note = takeTierReply(onResult?.(result)); } catch (error) { console.error(error); }
      return { result, newBest, note };
    }
    /** 次の評価までの点と、今回の滑りでいちばん伸びる所のひとこと（結果のカード）。 */
    function nextGoal(result) {
      const next = [...RANKS].reverse().find(([, min]) => min > result.score);
      const tip = result.rank === "A" && !next && result.race && !result.race.won ? "S評価にはライバルに勝つ必要がある"
        : result.tricks === 0 ? "空中で「左へ」か「右へ」を押し続けると回転。点がいちばん伸びる"
        : result.perfect === 0 ? "着地は、輪がボタンに重なった時に押すと完璧"
        : result.boosts === 0 ? "ゲージが目印まで溜まったら「BOOST」で超加速"
        : result.falls > 0 && !result.recoveries ? "岩に当たった直後に「BOOST」で立て直せる"
        : next && result.bestTrick < 720 ? "長く回るほど点が大きい（360° → 540° → 720°）"
        : next && result.nearMiss < 3 ? "岩はぎりぎりでかすめるほど、点もブーストも大きい" : "";
      return { next: next ? { rank: next[0], points: next[1] - result.score } : null, tip };
    }
    function showResult({ result, newBest, note = null } = pendingResult) {
      pendingResult = null;
      rideSe.stop();
      controls.hidden = true; quit.hidden = true;
      startPop.classList.remove("show");
      mode = null;
      setPhase("result");
      const row = (label, value, test) => el("div.dr-row", { dataset: { test } }, [el("span", { text: label }), el("strong", { text: value })]);
      const race = result.race;
      const racePoints = race?.won ? (race.who === "naru" ? SCORE.raceWinNaru : SCORE.raceWin) : 0;
      const { next, tip } = nextGoal(result);
      // 2026-11-17 オーナー「リザルト画面がなんか CSS 感強い」→ #3713 の絵を敷く: 左に評価のメダル（文字はコード）と合計、
      // 右に記録の板（9-slice）とボタンの絵（ラベルはコード）。中身・文言・data-test は前と同じ
      let rowIndex = 0;
      const statRow = (label, value, test) => { const node = row(label, value, test); node.style.setProperty("--i", rowIndex++); return node; };
      panel.replaceChildren(el("div.dr-card.dr-result", { dataset: { test: "desert-result", rank: result.rank } }, [
        el("div.dr-result-hero", [
          el("p.dr-kicker", { text: "RESULT" }),
          race ? el("p.dr-race-result", { dataset: { test: "desert-race", won: String(race.won), who: race.who } }, [
            el("b", { text: race.won ? `${RIVAL_NAMES[race.who]}に勝った！` : `${RIVAL_NAMES[race.who]}の勝ち` }),
            el("span", { text: race.won ? `${race.gap.toFixed(1)}秒差` : race.gap > 0 ? `あと ${race.gap.toFixed(1)}秒` : "同時…わずかに届かず" }),
            race.won ? el("em", { text: `+${racePoints.toLocaleString("ja-JP")}点`, dataset: { test: "desert-race-points" } }) : null,
          ]) : null,
          el("div.dr-rank", { dataset: { test: "desert-rank" } }, [el("i.dr-rank-rays"), el("b", { text: result.rank }), el("span", { text: RANK_WORDS[result.rank] })]),
          el("p.dr-total", { dataset: { test: "desert-total" } }, [el("small", { text: "TOTAL" }), el("strong", { text: result.score.toLocaleString("ja-JP") }), el("small", { text: "点" }),
            // 目標を目の前に: 次の評価までの点（合計のすぐ下）と、今回いちばん伸びる所のひとこと
            next ? el("b.dr-next-rank", { text: `次の評価 ${next.rank} まで あと ${next.points.toLocaleString("ja-JP")}点`, dataset: { test: "desert-next-rank" } }) : null]),
          tip ? el("p.dr-next", { text: tip, dataset: { test: "desert-tip" } }) : null,
          el("p.dr-best", { text: `${bestLabel(desertBestKey(result))}の${newBest ? "自己ベスト更新！" : `自己ベスト ${formatBest(displayBests[desertBestKey(result)])}`}`,
            dataset: { test: "desert-best", new: String(!!newBest) } }),
        ]),
        el("div.dr-result-side", [
          // 段（#3779）: 記録の板の上に、どの段の滑りかの札（なるとの勝負は段の外なので出さない）
          result.tier ? el("p.dr-result-tags", [
            el("b.dr-result-tier", { text: TIER_LABEL[result.tier], dataset: { test: "desert-result-tier", tier: result.tier } }),
            result.tier === "easy" ? el("small", { text: easyExclusions }) : null,
          ]) : null,
          el("div.dr-rows", [
            statRow("滑走時間", `${result.time.toFixed(1)} 秒`, "desert-time"),
            statRow("最高コンボ", `${result.maxCombo}`, "desert-combo"),
            statRow("転倒", `${result.falls} 回`, "desert-falls"),
            statRow("大ジャンプ", `${result.bigJumps} 回`, "desert-jumps"),
            statRow("着地", `完璧 ${result.perfect} ／ 良い ${result.good}`, "desert-landings"),
            statRow("岩をかすめた", `${result.nearMiss} 回`, "desert-near"),
            statRow("トリック", result.tricks ? `${result.tricks} 回（最高 ${result.bestTrick}°）` : "0 回", "desert-tricks"),
            statRow("ブースト", `${result.boosts} 回${result.smashed ? `（岩を ${result.smashed} 個粉砕）` : ""}`, "desert-boosts"),
            result.recoveries ? statRow("立て直し", `${result.recoveries} 回`, "desert-recoveries") : null,
            result.carves ? statRow("カービング", `${result.carves} 回`, "desert-carves") : null,
            result.courseName ? statRow("コース", result.courseName, "desert-result-course") : null,
          ].filter(Boolean)),
          // 初めてクリアした段の一言（「初級をクリア。中級が開いた。」など。呼び出し側の tierUnlockNote）
          note ? el("p.dr-tier-note", { text: note, dataset: { test: "desert-tier-note" } }) : null,
          el("div.dr-actions", [
            el("button.btn.primary.dr-button", { type: "button", text: "もう一度滑る", dataset: { test: "desert-retry" }, onclick: () => prepareAndStart("run", raceWith) }),
            rivals.includes("naru") ? el("button.btn.dr-button", { type: "button", text: raceWith === "naru" ? "ヌールと競走" : "なると勝負",
              dataset: { test: raceWith === "naru" ? "desert-start-noor" : "desert-start-naru" }, onclick: () => prepareAndStart("run", raceWith === "naru" ? "noor" : "naru") }) : null,
            // 段を替えるのはメニューで（再挑戦は同じ段）
            el("button.btn.ghost.dr-button", { type: "button", text: "段を選ぶ", dataset: { test: "desert-choose-tier" }, onclick: () => showMenu() }),
            el("button.btn.ghost.dr-button", { type: "button", text: "砂丘を下りる", dataset: { test: "desert-leave" }, onclick: finish }),
          ]),
        ]),
      ]));
      panel.querySelector("button")?.focus();
    }

    // ---- 砂煙 ---------------------------------------------------------------------------
    function burst(n, power) {
      if (reducedMotion) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) particles.push({ x: (Math.random() - 0.5) * 60, y: 0, vx: (Math.random() - 0.5) * 220 * power, vy: -(60 + Math.random() * 160) * power, r: 6 + Math.random() * 14, life: 0.6 + Math.random() * 0.5, age: 0 });
    }
    /** 砕いた岩のかけら（濃い色の小片）。 */
    function chips(size = "big") {
      const n = reducedMotion ? 6 : size === "small" ? 14 : 24;
      for (let i = 0; i < n; i++) particles.push({ chip: true, x: (Math.random() - 0.5) * 80, y: -30 - Math.random() * 40, vx: (Math.random() - 0.5) * 520, vy: -(160 + Math.random() * 320), r: 4 + Math.random() * 8, spin: Math.random() * 6, life: 0.7 + Math.random() * 0.4, age: 0 });
    }
    /**
     * 相手の板の演出（2026-11-13 オーナー「ライバルもはじめ同様にボードの演出にしたい。今はじめだけ砂の演出あって他しょぼい」）:
     * 板の後ろの砂煙（速いほど・ブースト中ほど多い）、曲がると外へ飛ぶ砂しぶき、着地の砂と輪、転んだ時の砂、ブースト発進の輪と音。
     * 大きさは相手の足元の 1m を 1 とした値で持ち、描く時に相手の大きさを掛ける（drawRival）。主人公の砂煙の画素を 1m＝120px で割った値。
     */
    function simulateRivalFx(dt) {
      if (!rival || !game) { rivalFx.dust.length = 0; return; }
      const r = rivalAt(rival, game.rivalClock), prev = rivalFx.last;
      rivalFx.last = { z: r.z, air: r.air, airKind: r.airKind, boostT: r.boostT, fallT: r.fallT, vx: r.vx };
      const running = (mode && countdown <= 0) || goal;
      const dust = rivalFx.dust, push = d => { if (dust.length < 220) dust.push(d); };
      const burst = (n, power) => { for (let i = 0; i < (reducedMotion ? Math.ceil(n / 3) : n); i++) push({ x: (Math.random() - 0.5) * 0.5, y: 0, vx: (Math.random() - 0.5) * 1.8 * power, vy: -(0.5 + Math.random() * 1.3) * power, r: 0.05 + Math.random() * 0.12, life: 0.6 + Math.random() * 0.5, age: 0 }); };
      if (prev && running && dt > 0) {
        const speed = Math.max(0, (r.z - prev.z) / dt), k = Math.min(1.4, speed / SPEED.max), surge = rivalSurge();
        const boosting = r.boostT > 0 || surge > 0.2;
        if (r.air <= 0 && r.fallT <= 0) {
          const rate = (reducedMotion ? 6 : 26) * k * (boosting ? 1.6 : 1);
          for (let i = 0; i < rate * dt * 4; i++) push({ x: (Math.random() - 0.5) * 0.42 + (r.vx || 0) * 0.25, y: 0, vx: (Math.random() - 0.5) * 0.66 - (r.vx || 0) * 0.5, vy: -(0.17 + Math.random() * (0.6 + (boosting ? 0.25 : 0))), r: 0.033 + Math.random() * (0.075 + (boosting ? 0.025 : 0)), life: 0.4 + Math.random() * 0.45, age: 0 });
          const turn = Math.abs(r.vx || 0);
          if (turn > 0.25) {
            const side = r.vx > 0 ? -1 : 1, spray = (reducedMotion ? 8 : 34) * Math.min(1.6, turn) * k;
            for (let i = 0; i < spray * dt * 4; i++) push({ x: side * (0.17 + Math.random() * 0.25), y: -0.05, vx: side * (1 + Math.random() * 2.2) * Math.min(1.5, turn), vy: -(0.75 + Math.random() * 1.6), r: 0.025 + Math.random() * 0.066, life: 0.45 + Math.random() * 0.35, age: 0 });
          }
        }
        // 着地: 砂と輪（大ジャンプは大きく）。転んだ瞬間: 大きく砂。ブーストの発進: 輪と音（近くにいる時だけ鳴らす）
        if (prev.air > 0 && r.air <= 0 && prev.airKind && prev.airKind !== "bounce") {
          burst(prev.airKind === "big" ? 16 : 6, prev.airKind === "big" ? 1.2 : 0.7);
          if (prev.airKind === "big") rivalFx.rings.push({ age: 0, life: 0.55, power: 1 });
        }
        if (prev.fallT <= 0 && r.fallT > 0) burst(24, 1.4);
        if (prev.boostT <= 0 && r.boostT > 0) {
          rivalFx.boostStartT = game.t;
          rivalFx.rings.push({ age: 0, life: 0.6, power: 1.2, boost: true });
          if (Math.abs(r.z - game.z) < 70) rideSe.play("boost", SE_GAIN.rivalBoost);
        }
      }
      for (const d of dust) { d.age += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 0.75 * dt; d.r += 0.15 * dt; }
      discardExpired(dust);
      for (const ring of rivalFx.rings) ring.age += dt;
      discardExpired(rivalFx.rings);
    }
    /** 相手が追い上げている強さ（0〜1）。差が開いて再生を速めている間（RUBBER）は、ブーストで追い上げているように見せる。 */
    function rivalSurge() {
      if (!rival || !game) return 0;
      return Math.max(0, Math.min(1, (game.rivalRate - 1.04) / 0.14));
    }
    /** ゴールの紙吹雪（旗の橙・白・金）。両側のゴールの竿の上から、内へ外へ舞う。位置は人物からの画素。 */
    function confetti(n) {
      const p = placeAt(game.z, game.x), goalAt = placeAt(game.course.length, 0);
      if (!p || !goalAt) return;
      const poleH = goalAt.scale * GOAL_POLE * (H / 2), colors = ["#e9532b", "#fff8ee", "#f0b443", "#ff9a3c"];
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        particles.push({ confetti: true, color: colors[i % colors.length], x: goalAt.x + side * goalAt.w * 1.02 - p.x + (Math.random() - 0.5) * 30, y: -poleH * (0.75 + Math.random() * 0.3),
          vx: -side * (Math.random() * 420 - 90), vy: -(80 + Math.random() * 380), r: 5 + Math.random() * 6, spin: 4 + Math.random() * 10, sway: Math.random() * 6.28, life: 1.1 + Math.random() * 0.7, age: 0 });
      }
    }
    // 描画順を保ったまま寿命切れの要素を詰める。更新ごとの配列生成を避ける。
    function discardExpired(effects) {
      let alive = 0;
      for (const effect of effects) {
        if (effect.age < effect.life) effects[alive++] = effect;
      }
      effects.length = alive;
    }
    function simulateParticles(dt) {
      if (!game) return;
      const running = mode && countdown <= 0;
      fxDt = dt;
      if (running && !reducedMotion && game.fallT <= 0) {
        if (game.air > 0) {
          const airT = 1 - game.air / game.airTotal;
          // 大ジャンプの上り: 板に乗った砂が、こぼれ落ちながら後ろへ尾を引く
          if (game.airKind === "big" && airT < 0.55) for (let i = emitCount(FEEL.airTrail * (1 - airT)); i > 0; i--) particles.push({ grain: true, x: (Math.random() - 0.5) * 64, y: -riderPx.lift + 4,
            vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 120, r: 1.6 + Math.random() * 2, life: 0.4 + Math.random() * 0.3, age: 0 });
          // スピン: 回る板の先から、砂の筋が横へ飛ぶ（板が横を向いた側へ）
          if (game.spinDir !== 0) {
            const side = Math.cos(game.rot * Math.PI * 2) >= 0 ? game.spinDir : -game.spinDir;
            for (let i = emitCount(FEEL.spinSpray); i > 0; i--) particles.push({ grain: true, x: side * (34 + Math.random() * 30), y: -riderPx.lift - Math.random() * 10,
              vx: side * (260 + Math.random() * 420), vy: -(30 + Math.random() * 170), r: 1.8 + Math.random() * 2.2, life: 0.28 + Math.random() * 0.22, age: 0 });
          }
        } else if (game.boostT > 0) {
          // ブースト: 板の左右へ、砂の波が低く広がる。発進の直後ほど多い（走路の先と人物は隠さない高さ）
          const kick = 0.65 + 0.35 * Math.min(1, Math.max(0, 1 - (game.t - auraStartT) / 0.6));
          for (let i = emitCount(FEEL.boostWake * kick); i > 0; i--) {
            const side = Math.random() < 0.5 ? -1 : 1, fast = Math.random() < 0.35;
            particles.push(fast ? { grain: true, x: side * (20 + Math.random() * 30), y: -4 - Math.random() * 8, vx: side * (380 + Math.random() * 480), vy: -(40 + Math.random() * 150), r: 2 + Math.random() * 2.4, life: 0.26 + Math.random() * 0.22, age: 0 }
              : { x: side * (26 + Math.random() * 34), y: -2, vx: side * (200 + Math.random() * 360), vy: -(20 + Math.random() * 110), r: 7 + Math.random() * 12, life: 0.38 + Math.random() * 0.32, age: 0 });
          }
        } else if (!game.carving && Math.abs(game.vx) > 0.55) {
          // 鋭く切った時（よける・寄せる）: 板の外の縁から、砂の筋が外へ飛ぶ
          const side = game.vx > 0 ? -1 : 1, k = game.speed / SPEED.max;
          for (let i = emitCount(FEEL.steerRoost * Math.min(1.5, Math.abs(game.vx)) * k); i > 0; i--) particles.push({ grain: true, x: side * (16 + Math.random() * 26), y: -4 - Math.random() * 8,
            vx: side * (300 + Math.random() * 460), vy: -(90 + Math.random() * 220), r: 1.8 + Math.random() * 2.2, life: 0.28 + Math.random() * 0.24, age: 0 });
        }
      }
      // 滑走中は板の後ろから細かな砂が舞う。速いほど多く、端の深い砂ではさらに多く。ブースト中も砂の尾は控えめ
      if (running && game.air <= 0 && game.fallT <= 0) {
        const k = game.speed / SPEED.max, boosting = game.boostT > 0;
        const feel = view.boost || 0;
        const rate = (reducedMotion ? 6 : 26) * k * (Math.abs(game.x) > EDGE ? 2.2 : 1) * (1 + 0.6 * feel);
        for (let i = 0; i < rate * dt * 4; i++) particles.push({ x: (Math.random() - 0.5) * 50 + game.vx * 30, y: 0, vx: (Math.random() - 0.5) * 80 - game.vx * 60, vy: -(20 + Math.random() * (70 + 30 * feel)), r: 4 + Math.random() * (9 + 3 * feel), life: 0.4 + Math.random() * (0.4 + 0.08 * feel), age: 0, trail: feel > 0.4 && Math.random() < 0.35 });
        // 曲がると板の外側へ砂しぶき（曲がる向きと反対へ高く飛ぶ）
        // カービング中（カーブへ切り込んでいる間）は、横へ動いていなくてもカーブの外側へ砂が飛ぶ
        const carving = game.carving ? Math.sign(curveAt(game.course, game.z)) : 0;
        const carve = Math.max(Math.abs(game.vx), carving ? 0.95 : 0);
        if (carve > 0.25) {
          // カービング中は、切り込み続けるほど（熱）外側の砂しぶきが壁のように高く・多くなる（2026-11-25）
          const heat = carving ? carveFx.heat : 0, wall = 1 + (FEEL.carveWall - 1) * heat;
          const side = carving ? -carving : game.vx > 0 ? -1 : 1, spray = (reducedMotion ? 8 : 34) * Math.min(1.6, carve) * k * wall;
          for (let i = 0; i < spray * dt * 4; i++) particles.push({ x: side * (20 + Math.random() * 30), y: -6, vx: side * (120 + Math.random() * 260) * Math.min(1.5, carve), vy: -(90 + Math.random() * 200) * (1 + 0.5 * heat), r: 3 + Math.random() * (8 + 6 * heat), life: 0.45 + Math.random() * (0.35 + 0.2 * heat), age: 0 });
          // 外へ鋭く飛ぶ砂の筋（動きのぶれで線に見える）。熱が高いほど多く速い
          if (heat > 0.1 && !reducedMotion) {
            for (let i = 0; i < FEEL.carveStreaks * heat * dt * 4; i++) particles.push({ streak: true, x: side * (16 + Math.random() * 24), y: -4 - Math.random() * 10, vx: side * (360 + Math.random() * 520) * (0.7 + 0.5 * heat), vy: -(120 + Math.random() * 360) * (0.6 + 0.6 * heat), r: 1.2 + Math.random() * 2.2, life: 0.22 + Math.random() * 0.2, age: 0 });
          }
          // 夕日を受けてきらめく砂粒（金の点）
          if (heat > 0.15 && !reducedMotion) {
            for (let i = 0; i < FEEL.carveSparks * heat * dt * 4; i++) particles.push({ spark: true, x: side * (18 + Math.random() * 40), y: -8, vx: side * (160 + Math.random() * 300), vy: -(140 + Math.random() * 260), r: 1.5 + Math.random() * 2.2, life: 0.35 + Math.random() * 0.3, age: 0 });
          }
        }
        // 砂流れの上: 板の両側から、流れる砂が低く後ろへ跳ねる
        if (game.inFlow) {
          const spray = (reducedMotion ? 6 : FEEL.flowSpray) * k;
          for (let i = 0; i < spray * dt * 4; i++) {
            const side = Math.random() < 0.5 ? -1 : 1;
            particles.push({ x: side * (18 + Math.random() * 26), y: -2, vx: side * (60 + Math.random() * 140), vy: -(30 + Math.random() * 90), r: 3 + Math.random() * 6, life: 0.35 + Math.random() * 0.3, age: 0 });
          }
        }
      }
      // カービングの熱: 切り込んでいる間 carveBuild 秒で満ちる。同じカーブの中ではゆっくり、カーブを抜ける・転ぶと速く冷める。
      // カーブを抜けて carveChainGap 秒たつと、刻みの数を数え直す
      const carvingNow = running && game.carving && game.air <= 0 && game.fallT <= 0;
      const inBend = running && game.fallT <= 0 && Math.abs(curveAt(game.course, game.z)) >= CARVE.minCurve;
      carveFx.heat = carvingNow ? Math.min(1, carveFx.heat + dt / FEEL.carveBuild) : Math.max(0, carveFx.heat - dt * (inBend ? FEEL.carveHold : FEEL.carveFade));
      carveFx.off = inBend ? 0 : carveFx.off + dt;
      carveFx.show += ((carvingNow ? 1 : 0) - carveFx.show) * Math.min(1, dt * (carvingNow ? 10 : 3));
      if (carveFx.off > FEEL.carveChainGap) { carveFx.chain = 0; carveFx.maxed = false; }
      // 熱が満ちた瞬間（そのカーブで一度）: 金の砂が大きく散り、大きな十字の光と高い音、視界が一瞬広がる
      if (carvingNow && carveFx.heat >= 1 && !carveFx.maxed) {
        carveFx.maxed = true;
        rideSe.cue("carve", { n: 6, gain: SE_GAIN.carveTick * 1.4 });
        carveCut(Math.sign(curveAt(game.course, game.z)) || 1, true);
        if (!reducedMotion) {
          view.kick = Math.max(view.kick, FEEL.carveMaxKick);
          const side = -(Math.sign(curveAt(game.course, game.z)) || 1);
          for (let i = 0; i < 34; i++) particles.push({ spark: true, x: side * (10 + Math.random() * 40), y: -10, vx: side * (120 + Math.random() * 420) + (Math.random() - 0.5) * 200, vy: -(200 + Math.random() * 380), r: 1.8 + Math.random() * 2.6, life: 0.5 + Math.random() * 0.4, age: 0 });
        }
      }
      for (const list of [carveFx.glints, carveFx.runs]) { for (const fx of list) fx.age += dt; discardExpired(list); }
      for (const p of particles) {
        p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.confetti) { p.vy += 520 * dt; p.vx *= Math.max(0, 1 - 1.6 * dt); p.vy = Math.min(p.vy, 260); continue; } // 紙は、すぐ失速してひらひら落ちる
        p.vy += (p.chip ? 900 : p.spark ? 520 : p.streak || p.grain ? 700 : 90) * dt; if (!p.chip && !p.spark && !p.streak && !p.grain) p.r += 18 * dt;
      }
      discardExpired(particles);
      if (particles.length > 360) particles.splice(0, particles.length - 360);
      for (const shot of fxShots) shot.age += dt;
      discardExpired(fxShots);
      for (const r of rings) r.age += dt;
      discardExpired(rings);
      for (const o of orbs) o.age += dt;
      discardExpired(orbs);
      gaugePulseT = Math.max(0, gaugePulseT - dt);
      simulateRivalFx(dt);
      for (const f of floaters) f.age += dt;
      discardExpired(floaters);
      shake.t = Math.max(0, shake.t - dt); flash.t = Math.max(0, flash.t - dt); flashDarkT = Math.max(0, flashDarkT - dt); popT = Math.max(0, popT - dt * 1.4);
      view.kick = Math.max(0, view.kick - dt * 1.6);
      const boostTarget = game.boostT > 0.28 ? 1 : game.boostT > 0 ? game.boostT / 0.28 : 0;
      view.boost += (boostTarget - (view.boost || 0)) * Math.min(1, dt * 6);
    }

    // ---- 描画 ---------------------------------------------------------------------------
    const project = (xLane, y, dz) => {
      const scale = view.depth / dz;
      // view.rise: 大ジャンプの間、カメラも一緒に上がる（地面が下へ遠ざかる。DSR99）
      return { x: W / 2 + scale * xLane * CAM.meterPerLane * (W / 2), y: GROUND_Y + scale * (CAM_H + view.rise - y) * (H / 2), scale, w: scale * CAM.meterPerLane * (W / 2) };
    };
    const lerp = (a, b, t) => a + (b - a) * t;
    const mixColor = (a, b, t) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
    function draw(dt) {
      const progress = Math.min(1, game.z / game.course.length);
      const dusk = mode === "practice" ? 0.1 : progress * progress; // ゴールへ近づくほど夕方
      // 進入前から次の曲がりへ視線を向け、遠景にも路面と同じ向きの流れを作る。
      const curve = curveAt(game.course, game.z);
      const head = headingAt(game.course, game.z);
      const lookAhead = headingAt(game.course, Math.min(game.course.length, game.z + 110));
      world.yaw += (head + (lookAhead - head) * 0.45 - world.yaw) * Math.min(1, dt * 3.2);
      // 坂（見た目だけ）: 遠くの砂丘の足元を斜面の縁に隠す深さ。下るほど浅く、ふもとで 0
      const slopeTarget = slopeEdgeAt(game.z);
      world.slope = world.slope == null ? slopeTarget : world.slope + (slopeTarget - world.slope) * Math.min(1, dt * 2.5);
      // 速いほど視界が広がる（遠くが小さく流れる）。カメラの距離も同じ割合で縮め、人物の大きさは変えない。
      // GO とブーストの瞬間は一度ぐっと広がる。ブースト中はさらに少し引く。動き軽減では固定
      const fast = Math.min(1, Math.max(0, (game.speed - SPEED.min) / (SPEED_FULL - SPEED.min)));
      const feel = view.boost || 0;
      const targetDepth = reducedMotion ? CAM.depth : CAM.depth * (1 - FEEL.fovSpeed * fast - FEEL.fovKick * Math.min(1, view.kick) - FEEL.fovBoost * feel);
      view.depth += (targetDepth - view.depth) * Math.min(1, dt * 4);
      view.back = CAM.back * view.depth / CAM.depth;
      // 大ジャンプ: カメラも一緒に上がる。上りは速く追い、着地の手前で地面へ戻る（動き軽減では上げない）
      const riseTarget = reducedMotion || game.fallT > 0 ? 0 : Math.min(FEEL.airRiseMax, shownHeight(game) * FEEL.airRise);
      view.rise += (riseTarget - view.rise) * Math.min(1, dt * 14);
      if (!riseTarget && view.rise < 1e-3) view.rise = 0;
      // 切り込んでいる間は、熱に合わせてもう少し内へ倒れる（カービングの演出）
      const rollLimit = FEEL.rollMax + FEEL.rollCarve * carveFx.heat;
      const targetRoll = reducedMotion || countdown > 0 ? 0 : Math.max(-rollLimit, Math.min(rollLimit, -game.vx * FEEL.rollSteer - curve * FEEL.rollCurve - Math.sign(curve) * FEEL.rollCarve * carveFx.heat));
      view.roll += (targetRoll - view.roll) * Math.min(1, dt * 5);
      if (!targetRoll && Math.abs(view.roll) < 1e-4) view.roll = 0;
      ctx.save();
      if (view.roll) { ctx.translate(W / 2, H * 0.62); ctx.rotate(view.roll); ctx.scale(1.06, 1.06); ctx.translate(-W / 2, -H * 0.62); }
      if (shake.t > 0) {
        // 揺れは出来事ごとに形が違う（FEEL.shake）。最初が強く、二乗で収まる
        const k = (shake.t / shake.life) ** 2;
        ctx.translate((Math.random() * 2 - 1) * shake.ax * k, (Math.random() * 2 - 1) * shake.ay * k);
      }
      const painted = drawBackdrop(dusk, progress);
      if (!painted) { drawSky(dusk, progress); drawDunes(dusk); }
      drawGround(dusk, painted);
      world.flowPhase += dt * FEEL.flowRun * (reducedMotion ? FEEL.flowCalm : 1);
      drawFlows(dusk);
      drawBoardTrail(dusk);
      drawFeaturesAndPlayer(dusk);
      drawParticles();
      if (painted && dusk > 0.02) {
        // 夕方: 絵の砂・岩・人物に同じ暖色をかける（Canvas の図形は色の中で夕方にしている）。夕方の遠景があれば薄く
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = `rgba(255,168,118,${dusk * (art.get("duskLand") ? 0.2 : 0.42)})`; ctx.fillRect(-20, -20, W + 40, H + 40);
        ctx.globalCompositeOperation = "source-over";
      }
      drawRings();
      drawFloaters();
      ctx.restore();
      drawSpeedLines();
      drawCarveEdgeLines();
      drawOrbs();
      drawVignette(fast);
      // 閃光。転倒は最初の2コマほど暗く落としてから白へ（明るい砂の上では、白だけ重ねても目立たない）
      if (flashDarkT > 0) { ctx.fillStyle = `rgba(40,20,10,${FEEL.flashFallDark[1]})`; ctx.fillRect(0, 0, W, H); }
      else if (flash.t > 0) { const a = flash.peak * (flash.t / flash.life); ctx.fillStyle = game.boostT > 0 ? `rgba(255,190,110,${a})` : `rgba(255,240,220,${a})`; ctx.fillRect(0, 0, W, H); }
      drawRecoverHint();
    }
    /**
     * 岩に当たった直後、BOOST で立て直せることをキャンバス上に出す（DOM の重ねが環境によって描画されない場合がある）。
     * 目は転んだ人物にあるので、その頭の上に大きく出す（2026-11-13。それまでは右下の小さな札だけで、気づかれにくかった）。押すボタンも緑に光る（CSS）。
     * 2026-11-25 オーナー「体勢崩した時とかブーストで立て直すとか文字が出るのは無くしたい。チュートリアルとかで文字で説明はいいけど」で、
     * 文字は練習の間だけにした。本番は BOOST のボタンが緑に光るだけ（data-recover="ready"）。
     */
    function drawRecoverHint() {
      if (mode !== "practice" || !game || !canRecover(game)) return;
      const text = "BOOST で立て直せ！";
      const p = placeAt(game.z, game.x), unit = p ? p.scale * (H / 2) : 0;
      const pulse = reducedMotion ? 1 : 1 + 0.06 * Math.sin(performance.now() / 45);
      ctx.save();
      ctx.font = `900 30px ${fontFamily()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const w = ctx.measureText(text).width + 44, h = 52, r = h / 2;
      const x = Math.max(w / 2 + 16, Math.min(W - w / 2 - 16, p ? p.x : W / 2)), y = Math.max(210, p ? p.y - unit * 2.2 : H * 0.5);
      ctx.translate(x, y); ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
      ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
      ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
      ctx.closePath();
      ctx.fillStyle = "rgba(18, 74, 38, 0.94)";
      ctx.fill();
      ctx.strokeStyle = "rgba(170, 255, 190, 0.95)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#f2fff4";
      ctx.fillText(text, 0, 1);
      ctx.restore();
    }
    /** 斜面の縁の深さ（px）。採用した坂の絵では edgePx=0（絵の lip が HORIZON）。正の値は旧い下げ回避用に残してある。 */
    function slopeEdgeAt(z) {
      const s = Math.min(1, Math.max(0, z / Math.max(1, game.course.length - SLOPE.runout)));
      return SLOPE.edgePx * (1 - s) ** 0.8;
    }
    /** 絵の遠景（空・太陽・陸）。絵がまだ無ければ false（図形の空と砂丘で描く）。 */
    const BACKDROP_SCALE = 0.95, BACKDROP_MARGIN = 60; // 余白は、傾き・揺れで見える画面の外
    // 遠景は傾けない別の面に整数の位置で並べてから、傾いた画面へ1枚で貼る（並べた絵の継ぎ目に線が出ないように）
    let backdropLayer = null, backdropKey = "";
    const backdropStrips = new WeakMap();
    /** 遠景の1枚を最終描画サイズへ一度だけ縮小して保持する（更新のたびに大判WebPを再拡縮・再デコードしない）。 */
    function backdropStrip(image, sx, sy, sw, sh, dw, dh) {
      const w = Math.max(1, Math.round(dw)), h = Math.max(1, Math.round(dh));
      let byKey = backdropStrips.get(image);
      if (!byKey) backdropStrips.set(image, byKey = new Map());
      const key = `${sx},${sy},${sw},${sh},${w},${h}`;
      let c = byKey.get(key);
      if (!c) {
        c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, w, h);
        byKey.set(key, c);
      }
      return c;
    }
    /**
     * 遠景の絵の置き方。横: 絵の縁（lip）の行を HORIZON に合わせる（空・稜線は同じ倍率、縁より下は画面の下端まで伸ばす）。
     * 下り坂（DOWNHILL）: 空は画面の上から目の高さ EYE_Y の少し下まで。その上に谷の絵（DESERT_VALLEY_ART）を、遠くの稜線の足元が EYE_Y に乗るように縦横同じ倍率で置き、
     * 路面の消失線 GROUND_Y から下は手前の斜面の砂（陸の絵の縁より下）。谷の絵の下の方は斜面の向こう側に隠れる（坂の上から見えない所）。
     * 谷の絵がまだ無い時は、陸の絵の稜線を GROUND_Y に乗せる（横と同じ倍率）。
     */
    function backdropFit(valleyArt) {
      const B = DESERT_ART.backdrop, above = B.horizon - DESERT_ART.land.top, below = B.height - B.horizon;
      if (!sloped) {
        const k = BACKDROP_SCALE, w = Math.round(B.width * k);
        return { skySrc: DESERT_ART.sky.size[1], skyW: w, skyY: HORIZON - B.horizon * k, skyH: DESERT_ART.sky.size[1] * k, landW: w, landY: HORIZON - above * k, landH: above * k, above, below };
      }
      // 空: 空の絵の稜線より上（空だけの行）を、上端は傾き・揺れでも角が空かないよう 40px 上から、下端は目の高さの 30px 下まで
      const skySrc = B.duneTop - 4, skyK = (EYE_Y + 70) / skySrc, skyW = Math.round(B.width * skyK);
      if (!valleyArt) {
        const k = BACKDROP_SCALE;
        return { skySrc, skyW, skyY: -40, skyH: skySrc * skyK, landW: Math.round(B.width * k), landY: GROUND_Y - above * k, landH: above * k, above, below };
      }
      const V = DESERT_VALLEY_ART.valley, [vw, vh] = V.size;
      // 谷の絵の下端が斜面の消失線より上で切れないよう、必要なら大きくする
      const kv = Math.max(DOWNHILL.valleyWidth / vw, (GROUND_Y - EYE_Y + 6) / (vh - V.horizon));
      return { skySrc, skyW, skyY: -40, skyH: skySrc * skyK, landW: Math.round(vw * kv), landY: EYE_Y - V.horizon * kv, landH: vh * kv, above, below, valley: true };
    }
    function drawBackdrop(dusk, progress, present = true) {
      const sky = art.get("sky"), land = art.get("land");
      if (!sky || !land) return false;
      if (!backdropLayer) { backdropLayer = document.createElement("canvas"); backdropLayer.width = W + BACKDROP_MARGIN * 2; backdropLayer.height = H; }
      // 遠景の変化は yaw・夕方・進み具合・ブーストの滲みだけ。量子化した鍵が同じなら前回の面をそのまま貼る（2026-11-14 軽量化: 毎フレームの大判 blit 10〜15枚を 1 枚に）
      const yaw = world?.yaw ?? 0;
      const yawPx = yaw * YAW_PX * (reducedMotion ? 0.5 : 1);
      const smearKey = !reducedMotion && (view.boost || 0) > 0.2 ? Math.round((view.boost || 0) * 5) : 0;
      const edge = Math.round(world?.slope || 0);
      // 太陽の移動幅は約180pxのため、progress*180 で1px精度を保ちつつ再描画回数を抑える
      const valleyReady = sloped && !!art.get("valley"); // 下り坂の谷の絵が届いたら描き直す
      const key = `${Math.round(yawPx / 4)}|${Math.round(dusk * 40)}|${Math.round(progress * 180)}|${smearKey}|${edge}|${valleyReady}`;
      if (key !== backdropKey) {
        backdropKey = key;
      const g = backdropLayer.getContext("2d");
      g.setTransform(1, 0, 0, 1, BACKDROP_MARGIN, 0);
      const B = DESERT_ART.backdrop, valleyArt = sloped ? art.get("valley") : null, fit = backdropFit(valleyArt);
      // 空はゆっくり、陸は速く横へ流れる（カーブに合わせたパララックス）。絵の地平線の行を HORIZON に合わせる（下り坂は backdropFit）。
      // 曲がっている間は遠くの砂丘が横へ流れ続ける（2026-11-11 オーナー「カーブがほんとにしてるのか分かりづらい」）
      const skyX = (W - fit.skyW) / 2 - yawPx * 0.5;
      wrapImage(g, sky, 0, 0, B.width, fit.skySrc, skyX, fit.skyY, fit.skyW, fit.skyH);
      const duskVisible = dusk >= 0.01;
      const duskSky = art.get("duskSky"), duskLand = art.get("duskLand");
      if (duskVisible && duskSky && duskLand) {
        // 同じ構図の夕方の絵を、ゴールへ近づくほど濃く重ねる（0.01 未満は視認不可のため合成を省く）
        g.globalAlpha = dusk;
        wrapImage(g, duskSky, 0, 0, B.width, fit.skySrc, skyX, fit.skyY, fit.skyW, fit.skyH);
        g.globalAlpha = 1;
      } else if (duskVisible) {
        const tint = g.createLinearGradient(0, 0, 0, EYE_Y + 10);
        tint.addColorStop(0, `rgba(120,72,110,${dusk * 0.85})`); tint.addColorStop(0.62, `rgba(245,150,84,${dusk * 0.8})`); tint.addColorStop(1, `rgba(255,208,140,${dusk * 0.7})`);
        g.fillStyle = tint; g.fillRect(-BACKDROP_MARGIN, 0, W + BACKDROP_MARGIN * 2, EYE_Y + 10);
      }
      // 太陽: 進むほど大きく低く。ゴールの手前では砂丘の稜線の後ろへ沈みかける。
      // 曲がり始めに横へ動き、その先は画面に残る（ゴールの夕日を見失わない）
      const sunX = W * 0.5 - Math.tanh(yaw * 0.8) * 300 + 180 * (1 - progress), sunY = lerp(70, EYE_Y - 34 + edge, Math.min(1, progress * 1.05)), r = lerp(30, 72, progress);
      const glow = g.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 3.2);
      glow.addColorStop(0, `rgba(255,230,170,${0.55 + 0.3 * dusk})`); glow.addColorStop(1, "rgba(255,200,120,0)");
      g.fillStyle = glow; g.fillRect(sunX - r * 3.2, sunY - r * 3.2, r * 6.4, r * 6.4);
      g.fillStyle = mixColor([255, 248, 220], [255, 170, 90], dusk);
      g.beginPath(); g.arc(sunX, sunY, r, 0, Math.PI * 2); g.fill();
      // 陸: 稜線〜縁（lip）は空と同じ倍率、縁より下（手前の斜面の砂）は画面の下端まで伸ばす
      const landX = (W - fit.landW) / 2 - yawPx, { above, below } = fit;
      const groundW = Math.round(B.width * BACKDROP_SCALE), groundX = (W - groundW) / 2 - yawPx;
      const duskValley = fit.valley && duskVisible ? art.get("duskValley") : null;
      // ブースト中は遠景を左右に少しずらして重ね、流れているように見せる
      const smear = !reducedMotion && (view.boost || 0) > 0.2 ? 14 * (view.boost || 0) : 0;
      for (const [image, alpha, valleyImage] of [[land, 1, fit.valley ? valleyArt : null], [duskVisible ? duskLand : null, dusk, duskValley]]) {
        if (!image) continue;
        for (const [shift, a] of smear ? [[0, alpha], [smear, alpha * 0.28], [-smear, alpha * 0.28]] : [[0, alpha]]) {
          g.globalAlpha = a;
          // 砂丘は edge だけ下げる（採用した坂の絵では edgePx=0 なので、縁は HORIZON に乗る）。縁より下は手前の斜面の砂
          // 下り坂: 稜線〜谷は谷の絵（目の高さに稜線の足元）。夕方の谷の絵が無ければ、昼の谷の上に陸の夕方を重ねない（谷は全体の暖色で夕方になる）
          if (fit.valley) { if (valleyImage) wrapImage(g, valleyImage, 0, 0, valleyImage.naturalWidth, valleyImage.naturalHeight, landX + shift, fit.landY, fit.landW, fit.landH); }
          else wrapImage(g, image, 0, 0, B.width, above, landX + shift, fit.landY + edge, fit.landW, fit.landH);
          wrapImage(g, image, 0, above, B.width, below, (fit.valley ? groundX : landX) + shift, GROUND_Y, fit.valley ? groundW : fit.landW, H - GROUND_Y);
        }
      }
      g.globalAlpha = 1;
      if (fit.valley) {
        // 谷の空気: 稜線の足元（目の高さ）ほど白く、斜面の端へ薄く。谷が下の遠い所にあると分かる（見本の絵の霞んだ谷）
        const air = mixColor([248, 234, 210], [255, 204, 166], dusk).slice(4, -1), [far, near] = DOWNHILL.valleyHaze;
        const haze = g.createLinearGradient(0, EYE_Y - 8, 0, GROUND_Y);
        haze.addColorStop(0, `rgba(${air},0)`); haze.addColorStop(0.06, `rgba(${air},${far})`); haze.addColorStop(1, `rgba(${air},${near})`);
        g.fillStyle = haze; g.fillRect(-BACKDROP_MARGIN, EYE_Y - 8, W + BACKDROP_MARGIN * 2, GROUND_Y - EYE_Y + 8);
      }
      if (edge > 1) drawSlopeEdge(g, edge, dusk);
      }
      if (present) ctx.drawImage(backdropLayer, -BACKDROP_MARGIN, 0);
      return true;
    }
    /**
     * 斜面の縁（#3686）。縁の向こう（下げた砂丘の足元側）は谷の空気で霞ませ、遠く低い所にあることを見せる。
     * 縁には日の当たった細い明るい線、そのすぐ手前の斜面は少しだけ明るく（向こうへ落ち込む肩）。
     */
    function drawSlopeEdge(g, edge, dusk) {
      const t = Math.min(1, edge / SLOPE.edgePx), x0 = -BACKDROP_MARGIN, wAll = W + BACKDROP_MARGIN * 2;
      const haze = mixColor([248, 230, 204], [255, 198, 154], dusk).slice(4, -1), rim = mixColor([255, 246, 220], [255, 218, 172], dusk).slice(4, -1);
      // 霞は縁のすぐ上の細い帯だけ、薄く。広く濃くかけると、霞んだ砂丘の下半分が「うっすら重なったもう1枚」に見えた（2026-11-17 オーナー）
      const top = GROUND_Y - 12;
      const air = g.createLinearGradient(0, top, 0, GROUND_Y);
      air.addColorStop(0, `rgba(${haze},0)`); air.addColorStop(1, `rgba(${haze},${0.22 * t})`);
      g.fillStyle = air; g.fillRect(x0, top, wAll, GROUND_Y - top);
      const shoulder = g.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 14);
      shoulder.addColorStop(0, `rgba(${rim},${0.5 * t})`); shoulder.addColorStop(1, `rgba(${rim},0)`);
      g.fillStyle = shoulder; g.fillRect(x0, GROUND_Y, wAll, 14);
      g.fillStyle = `rgba(${rim},${0.85 * t})`; g.fillRect(x0, GROUND_Y - 1, wAll, 2);
    }
    /** 横へ流れる遠景を、面を覆うまで並べて描く。隣は左右反転した同じ絵なので絵柄がつながり、整数の位置に置くので隙間も重なりも出ない。 */
    function wrapImage(g, image, sx, sy, sw, sh, x, y, dw, dh) {
      const strip = backdropStrip(image, sx, sy, sw, sh, dw, dh);
      const start = Math.round(x), y0 = Math.round(y), swPx = strip.width;
      let index = Math.floor((-BACKDROP_MARGIN - start) / swPx);
      for (let left = start + index * swPx; left < W + BACKDROP_MARGIN; left += swPx, index++) {
        if (index % 2 === 0) { g.drawImage(strip, left, y0); continue; }
        g.save(); g.translate(left + swPx, y0); g.scale(-1, 1);
        g.drawImage(strip, 0, 0);
        g.restore();
      }
    }
    function drawSky(dusk, progress) {
      const top = mixColor([92, 158, 226], [120, 72, 110], dusk), mid = mixColor([176, 212, 240], [245, 150, 84], dusk), bottom = mixColor([236, 226, 206], [255, 208, 140], dusk);
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 20);
      sky.addColorStop(0, top); sky.addColorStop(0.62, mid); sky.addColorStop(1, bottom);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GROUND_Y + 20);
      // 太陽: 進むほど大きく低く。ゴールの手前では地平線に触れる
      const sunX = W * 0.5 - Math.tanh(world.yaw * 0.8) * 300 + 180 * (1 - progress), sunY = lerp(70, EYE_Y - 14 + (world.slope || 0), Math.min(1, progress * 1.05)), r = lerp(30, 72, progress);
      const glow = ctx.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 3.2);
      glow.addColorStop(0, `rgba(255,230,170,${0.55 + 0.3 * dusk})`); glow.addColorStop(1, "rgba(255,200,120,0)");
      ctx.fillStyle = glow; ctx.fillRect(sunX - r * 3.2, sunY - r * 3.2, r * 6.4, r * 6.4);
      ctx.fillStyle = mixColor([255, 248, 220], [255, 170, 90], dusk);
      ctx.beginPath(); ctx.arc(sunX, sunY, r, 0, Math.PI * 2); ctx.fill();
    }
    function drawDunes(dusk) {
      // 遠景の砂丘は3層。横へは向きに合わせ、奥ほどゆっくり流れる（パララックス）
      // 斜面の縁の深さだけ下げる（足元は drawGround の砂が隠す）
      const FAR = GROUND_Y + (world.slope || 0);
      const layers = [
        { amp: 26, freq: 0.0032, speed: 0.08, base: FAR - 36, color: mixColor([226, 196, 150], [214, 136, 104], dusk) },
        { amp: 40, freq: 0.0046, speed: 0.17, base: FAR - 14, color: mixColor([232, 206, 158], [226, 150, 108], dusk) },
        { amp: 54, freq: 0.0068, speed: 0.3, base: FAR + 10, color: mixColor([240, 216, 168], [236, 168, 118], dusk) },
      ];
      for (const [i, layer] of layers.entries()) {
        const shift = world.yaw * YAW_PX * 0.5 * (i + 1) + game.z * layer.speed * 6 * (1 + 0.7 * (view.boost || 0));
        ctx.fillStyle = layer.color;
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 16) {
          const u = (x + shift) * layer.freq;
          const y = layer.base - Math.abs(Math.sin(u) * layer.amp) - Math.sin(u * 2.7 + i) * layer.amp * 0.25;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      }
    }
    // 路面: 手前から奥へ、カーブで横にずれながら区間を描く。描いた区間の位置を覚えて、岩と人物の配置に使う
    let segmentsDrawn = [];
    let hazeGradient, hazeColor, hazeStart;
    function* groundBands(points, minDepth, maxDepth, count, minNear) {
      const bandWidth = (maxDepth - minDepth) / count;
      let far = points.length - 1;
      while (far > 0 && points[far].dz > maxDepth) far--;
      while (far > 0 && points[far].dz > minDepth && points[far - 1].dz >= minNear) {
        const band = Math.ceil((points[far].dz - minDepth) / bandWidth) - 1;
        const lower = minDepth + band * bandWidth;
        let near = far - 1;
        while (near > 0 && points[near].dz > lower && points[near - 1].dz >= minNear) near--;
        yield [near, far];
        far = near;
      }
    }
    function drawGround(dusk, painted = false) {
      const camZ = game.z - view.back;
      // カメラは人物の横位置の6割だけ追う（端へ行くと画面も少し寄る）。縦は見える幅が狭いので、人物が端で切れないよう多めに追う
      const camX = game.x * (portrait ? 0.75 : 0.6);
      if (!painted) {
        ctx.fillStyle = mixColor([238, 210, 160], [238, 170, 112], dusk);
        ctx.fillRect(-GROUND_BLEED, GROUND_Y, W + GROUND_BLEED * 2, H - GROUND_Y + GROUND_BLEED);
      }
      const flagArt = art.get("flag");
      // 区間の境目を手前から並べる。最初の点は画面の下端のすぐ外（dz 0.5m）に置く
      const points = [];
      const zRef = game.z, firstZ = Math.floor(camZ / SEG) * SEG;
      const x0 = lateralAt(game.course, camZ + 0.5, zRef);
      points.push({ z: camZ + 0.5, dz: 0.5, x: x0, p: project(x0 - camX, 0, 0.5) });
      for (let z = firstZ + SEG; z < camZ + DRAW_DIST; z += SEG) {
        const dz = z - camZ;
        if (dz <= 0.5) continue;
        const x = lateralAt(game.course, z, zRef);
        points.push({ z, dz, x, p: project(x - camX, 0, dz) });
      }
      segmentsDrawn = points;
      ground = { camZ, camX };
      drawSandRows(points, camZ, camX);
      // コースの外の深い砂: 端からなだらかに濃くする（縁をくっきり描かない）。距離帯ごとにまとめて描いて fill 回数を抑える
      const OUTER_BANDS = 6;
      for (const [i0, i1] of groundBands(points, 0, 220, OUTER_BANDS, 0)) {
        const fade = 1 - Math.min(1, (points[i0].dz + points[i1].dz) * 0.5 / 220);
        if (fade <= 0.005) continue;
        for (const [from, to, alpha] of SAND_SHOULDERS) {
          ctx.fillStyle = `rgba(120,70,30,${(alpha * fade).toFixed(4)})`;
          for (const side of ROAD_SIDES) {
            ctx.beginPath();
            ctx.moveTo(points[i0].p.x + side * points[i0].p.w * from, points[i0].p.y);
            for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(points[i].p.x + side * points[i].p.w * from, points[i].p.y);
            for (let i = i1; i >= i0; i--) ctx.lineTo(points[i].p.x + side * points[i].p.w * to, points[i].p.y);
            ctx.closePath(); ctx.fill();
          }
        }
      }
      // 先に滑った人の板の跡（コースの目安）。少し揺れながら奥へ続く（距離帯ごとに折れ線でまとめて stroke 回数を抑える）
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      const trackBands = [...groundBands(points, 2, 160, 6, 2)];
      for (const track of BOARD_TRACKS) {
        for (const [i0, i1] of trackBands) {
          const midPt = points[(i0 + i1) >> 1], fade = Math.max(0, 1 - midPt.dz / 160);
          ctx.strokeStyle = `rgba(150,96,46,${(0.2 * fade).toFixed(4)})`;
          ctx.lineWidth = Math.max(0.6, Math.min(10, midPt.p.w * 0.012));
          ctx.beginPath();
          for (let i = i0; i <= i1; i++) {
            const pt = points[i], lane = track.lane + Math.sin(pt.z * track.k) * track.wob;
            if (i === i0) ctx.moveTo(pt.p.x + lane * pt.p.w, pt.p.y); else ctx.lineTo(pt.p.x + lane * pt.p.w, pt.p.y);
          }
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,240,205,${(0.16 * fade).toFixed(4)})`;
          ctx.lineWidth = Math.max(0.5, Math.min(5, midPt.p.w * 0.006));
          ctx.beginPath();
          for (let i = i0; i <= i1; i++) {
            const pt = points[i], lane = track.lane + Math.sin(pt.z * track.k) * track.wob + 0.025;
            if (i === i0) ctx.moveTo(pt.p.x + lane * pt.p.w, pt.p.y); else ctx.lineTo(pt.p.x + lane * pt.p.w, pt.p.y);
          }
          ctx.stroke();
        }
      }
      // 地平線のかすみ（遠くの砂を空の色へ溶かす）
      // 縁が開いている間は、縁より上（下げた砂丘）を霞ませない（砂丘がくっきり1組に見えるように）。ふもとでは元の地平線の霞
      // 下り坂では、坂の下の端（GROUND_Y）に谷の空気をかける（谷が低く遠い所にあると分かるように）
      const hazeTop = GROUND_Y - (sloped ? 44 : 30 * (1 - Math.min(1, (world.slope || 0) / 12)));
      const red = Math.round(lerp(250, 255, dusk)), green = Math.round(lerp(232, 190, dusk)), blue = Math.round(lerp(200, 140, dusk));
      const rgb = (red << 16) | (green << 8) | blue;
      if (hazeColor !== rgb || hazeStart !== hazeTop) {
        const hazeRgb = `${red},${green},${blue}`;
        hazeColor = rgb;
        hazeStart = hazeTop;
        hazeGradient = ctx.createLinearGradient(0, hazeTop, 0, GROUND_Y + 120);
        hazeGradient.addColorStop(0, `rgba(${hazeRgb},0)`);
        hazeGradient.addColorStop(0.25, `rgba(${hazeRgb},0.5)`);
        hazeGradient.addColorStop(1, `rgba(${hazeRgb},0)`);
      }
      ctx.fillStyle = hazeGradient; ctx.fillRect(0, hazeTop, W, GROUND_Y + 120 - hazeTop);
      // 明暗の二重線で走路の縁を追えるようにする。線幅が変わる手前（dz<48）は1区間ずつ描き、線幅が下限で一定になる奥（dz>=48）だけ距離帯ごとにまとめる。
      const EDGE_SPLIT = 48;
      const edgeBands = [...groundBands(points, EDGE_SPLIT, 250, 5, 2)];
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (const side of ROAD_SIDES) {
        for (const [i0, i1] of edgeBands) {
          const midPt = points[(i0 + i1) >> 1], fade = Math.max(0, 1 - midPt.dz / 290);
          ctx.strokeStyle = `rgba(103,62,31,${(0.55 * fade).toFixed(4)})`;
          ctx.lineWidth = Math.max(1.3, Math.min(20, midPt.p.w * 0.035));
          ctx.beginPath();
          for (let i = i0; i <= i1; i++) {
            const pt = points[i], x = pt.p.x + side * pt.p.w * 0.94;
            if (i === i0) ctx.moveTo(x, pt.p.y); else ctx.lineTo(x, pt.p.y);
          }
          ctx.stroke();
          const lw = Math.max(1, Math.min(8, midPt.p.w * 0.014));
          ctx.strokeStyle = `rgba(255,237,183,${(0.8 * fade).toFixed(4)})`;
          ctx.lineWidth = lw;
          ctx.beginPath();
          for (let i = i0; i <= i1; i++) {
            const pt = points[i], x = pt.p.x + side * pt.p.w * 0.94 - side * lw * 0.6;
            if (i === i0) ctx.moveTo(x, pt.p.y); else ctx.lineTo(x, pt.p.y);
          }
          ctx.stroke();
        }
        for (let i = points.length - 1; i > 0; i--) {
          const far = points[i], near = points[i - 1];
          if (far.dz > EDGE_SPLIT || near.dz < 2) continue;
          const fade = Math.max(0, 1 - far.dz / 290);
          const x1 = near.p.x + side * near.p.w * 0.94, x2 = far.p.x + side * far.p.w * 0.94;
          ctx.strokeStyle = `rgba(103,62,31,${0.55 * fade})`;
          ctx.lineWidth = Math.max(1.3, Math.min(20, near.p.w * 0.035));
          ctx.beginPath(); ctx.moveTo(x1, near.p.y); ctx.lineTo(x2, far.p.y); ctx.stroke();
          ctx.strokeStyle = `rgba(255,237,183,${0.8 * fade})`;
          ctx.lineWidth = Math.max(1, Math.min(8, near.p.w * 0.014));
          ctx.beginPath(); ctx.moveTo(x1 - side * ctx.lineWidth * 0.6, near.p.y); ctx.lineTo(x2 - side * ctx.lineWidth * 0.6, far.p.y); ctx.stroke();
        }
      }
      if (sloped) drawRopePosts(points, dusk);
      // コースの端の目印（細い旗竿）: 24m ごと
      for (let i = points.length - 1; i > 0; i--) {
        const far = points[i], near = points[i - 1];
        if (Math.floor(far.z / 24) === Math.floor(near.z / 24)) continue;
        const t = Math.min(1, far.dz / DRAW_DIST), poleH = far.p.scale * 1.2 * (H / 2);
        for (const side of ROAD_SIDES) {
          const px = far.p.x + side * far.p.w * 1.02;
          if (flagArt) {
            const fh = poleH * 1.1, fw = fh * flagArt.naturalWidth / flagArt.naturalHeight;
            ctx.globalAlpha = 1 - t * 0.6;
            ctx.drawImage(flagArt, px - DESERT_ART.flag.foot.x * fw, far.p.y - fh, fw, fh);
            ctx.globalAlpha = 1;
            continue;
          }
          ctx.fillStyle = `rgba(90,70,60,${0.9 - t * 0.5})`; ctx.fillRect(px - 1.5, far.p.y - poleH, 3, poleH);
          ctx.fillStyle = "#e9532b"; ctx.fillRect(px - 1.5, far.p.y - poleH, Math.max(4, far.p.scale * 26), Math.max(3, far.p.scale * 14));
        }
      }
    }
    /**
     * コースの両端の杭とロープ（下り坂。見本の絵の、坂の下へ細く集まっていくロープと杭）。区間の点（6m ごと）に杭を立て、杭の頭をたるんだロープでつなぐ。
     * 路面と同じ投影なので、カーブでも走路の縁に沿う。遠くほど細く薄く、DOWNHILL.posts.reach m で消える。
     * 軽さ: 杭・ロープを1本ずつ stroke せず、距離帯ごとに1本の道にまとめる（帯は手前を細かく、奥を粗く。1コマ 20 回ほど）。
     */
    function drawRopePosts(points, dusk) {
      const P = DOWNHILL.posts, LANE = 1.1;
      const post = mixColor([86, 56, 34], [80, 46, 36], dusk).slice(4, -1), lit = mixColor([255, 232, 188], [255, 206, 160], dusk).slice(4, -1);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // 奥の帯から手前へ（手前の杭が奥のロープに重なる）。帯の境の点は奥の帯の端なので、各帯は (i0, i1] だけ描く
      const bands = [...groundBands(points, 36, P.reach, 4, 2), ...groundBands(points, 2, 36, 6, 2)];
      for (const [i0, i1] of bands) {
        const mid = points[(i0 + i1) >> 1], fade = Math.max(0, 1 - mid.dz / P.reach);
        if (fade <= 0.02) continue;
        const unit = mid.p.scale * (H / 2), width = Math.max(1, Math.min(9, unit * 0.07));
        // ロープ: 杭の頭から次の杭の頭へ、少したるませる（中ほどが杭の高さの約2割下がる）
        ctx.strokeStyle = `rgba(${post},${(0.75 * fade).toFixed(3)})`; ctx.lineWidth = Math.max(0.8, width * 0.42);
        ctx.beginPath();
        for (const side of ROAD_SIDES) {
          for (let i = i0 + 1; i <= i1; i++) {
            const a = points[i - 1], b = points[i];
            const ax = a.p.x + side * a.p.w * LANE, ay = a.p.y - a.p.scale * P.height * (H / 2);
            const bx = b.p.x + side * b.p.w * LANE, by = b.p.y - b.p.scale * P.height * (H / 2);
            const sag = (a.p.scale + b.p.scale) * 0.5 * P.height * 0.42 * (H / 2);
            ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag, bx, by);
          }
        }
        ctx.stroke();
        // 杭: 濃い木の棒に、日の当たる側の細い明るい線
        ctx.strokeStyle = `rgba(${post},${(0.95 * fade).toFixed(3)})`; ctx.lineWidth = width;
        ctx.beginPath();
        for (const side of ROAD_SIDES) {
          for (let i = i0 + 1; i <= i1; i++) {
            const pt = points[i], x = pt.p.x + side * pt.p.w * LANE;
            ctx.moveTo(x, pt.p.y); ctx.lineTo(x, pt.p.y - pt.p.scale * P.height * (H / 2));
          }
        }
        ctx.stroke();
        if (width < 2.5) continue;
        ctx.strokeStyle = `rgba(${lit},${(0.6 * fade).toFixed(3)})`; ctx.lineWidth = width * 0.3;
        ctx.beginPath();
        for (const side of ROAD_SIDES) {
          for (let i = i0 + 1; i <= i1; i++) {
            const pt = points[i], x = pt.p.x + side * pt.p.w * LANE - width * 0.25;
            ctx.moveTo(x, pt.p.y - 1); ctx.lineTo(x, pt.p.y - pt.p.scale * P.height * (H / 2) + 1);
          }
        }
        ctx.stroke();
      }
    }
    /** 砂の模様を1枚のオフスクリーン面へ走査線合成し、1回の drawImage で貼る（回転時の 100 回超 drawImage を1回に集約）。 */
    let sandBuf = null;
    function ensureSandBuf() {
      if (!sandBuf && typeof document !== "undefined") {
        const c = document.createElement("canvas");
        c.width = SAND_BUF_W; c.height = SAND_BUF_H;
        const cCtx = c.getContext("2d"), cImg = cCtx.createImageData(SAND_BUF_W, SAND_BUF_H);
        sandBuf = { canvas: c, ctx: cCtx, img: cImg, u32: new Uint32Array(cImg.data.buffer) };
      }
      return sandBuf;
    }
    function drawSandRows(points, camZ, camX) {
      const levels = sandTexture(), buf = ensureSandBuf();
      if (!levels.length || !buf) return;
      const rowH = SAND_ROW_H, k = view.depth * (CAM_H + view.rise) * (H / 2);
      // カメラが傾いていない・揺れていない間は画面外の余白行を描かない（直進・カウントダウン中の無駄な画面外描画を省く）
      const bleed = view.roll || shake.t > 0 ? GROUND_BLEED : 0;
      const { b, d, f } = ctx.getTransform();
      const topOffset = f + Math.min(-b * bleed, b * (W + bleed)) + Math.min(0, d * rowH);
      let bottomY = H + bleed;
      while (topOffset + d * (bottomY - rowH) >= H + 1) bottomY -= rowH;
      const spanRatio = 1 + bleed * 2 / W, destW = W + bleed * 2;
      const rgbMask = SAND_IS_LE ? 0x00ffffff : 0xffffff00;
      const dst = buf.u32, maxTexels = SAND_BUF_W * 1.25;
      let seg = 1, count = 0;
      for (let y = bottomY - rowH; y > GROUND_Y + 1 && count < SAND_BUF_H; y -= rowH) {
        const dz = k / (y + rowH / 2 - GROUND_Y);
        if (dz > DRAW_DIST) break;
        const alpha = Math.min(1, Math.max(0, 1.15 - dz / 120));
        if (alpha <= 0.02) break;
        const z = camZ + dz;
        while (seg < points.length - 1 && points[seg].z < z) seg++;
        const a = points[seg - 1], b = points[seg];
        const roadX = a.x + (b.x - a.x) * Math.min(1, Math.max(0, (z - a.z) / Math.max(0.001, b.z - a.z)));
        const metersAcross = 2 * dz / view.depth * spanRatio; // 描く横幅（必要な余白を含む）に見える砂の幅（m）
        let level = levels[levels.length - 1];
        for (let li = 0; li < levels.length; li++) if (metersAcross * levels[li].density <= maxTexels) { level = levels[li]; break; }
        const leftM = -dz / view.depth * spanRatio + (camX - roadX) * CAM.meterPerLane; // 描く左端（コースの中心から m）
        const u0 = ((leftM * level.density) % level.size + level.size) % level.size;
        const v = ((Math.floor(z * level.density) % level.size) + level.size) & level.mask;
        const rowOff = v * level.size, src = level.rgb, mask = level.mask;
        let uFp = (u0 * 65536) | 0;
        const duFp = Math.round((metersAcross * level.density / SAND_BUF_W) * 65536);
        const aByte = Math.round(alpha * 255), aMask = SAND_IS_LE ? (aByte << 24) : aByte;
        const dstOff = (SAND_BUF_H - 1 - count) * SAND_BUF_W;
        for (let x = 0; x < SAND_BUF_W; x++) {
          dst[dstOff + x] = (src[rowOff + ((uFp >> 16) & mask)] & rgbMask) | aMask;
          uFp += duFp;
        }
        count++;
      }
      if (count > 0) {
        const firstRow = SAND_BUF_H - count;
        const topY = bottomY - count * rowH;
        buf.ctx.putImageData(buf.img, 0, 0, 0, firstRow, SAND_BUF_W, count);
        ctx.drawImage(buf.canvas, 0, firstRow, SAND_BUF_W, count, -bleed, topY, destW, count * rowH);
      }
    }
    let ground = { camZ: 0, camX: 0 };
    /**
     * 砂流れ（2026-11-25 オーナー「通ると加速するゾーンをたまに入れたい。砂流れみたいな見た目にしつつ」）: 斜面を川のように流れ落ちる明るい砂の帯。
     * 浅い溝（縁の影と明るい土手）の中を、前へ反った波紋（進む向きを指す山形）と細い筋が坂の下へ流れていく。文字は出さない。
     * 帯の入口は細く絞って溶かし、出口は少し広げて消す。遠くほど薄い。見た目だけで、規則は読まない（乗ったかどうかは game.inFlow）。
     */
    function drawFlows(dusk) {
      const flows = game.course.flows;
      if (!flows?.length) return;
      const camZ = ground.camZ, phase = world.flowPhase;
      const body = mixColor([255, 230, 172], [255, 204, 150], dusk).slice(4, -1), core = mixColor([255, 246, 220], [255, 226, 190], dusk).slice(4, -1);
      const dark = mixColor([150, 92, 44], [150, 78, 50], dusk).slice(4, -1);
      for (const flow of flows) {
        const z0 = Math.max(flow.z, camZ + 0.6), z1 = Math.min(flow.z + flow.length, camZ + DRAW_DIST);
        if (z1 <= z0) continue;
        // 帯の幅の倍率: 入口 6m で 0.55 → 1、出口 8m で 1 → 1.18
        const widen = z => { const a = (z - flow.z) / 6, b = (flow.z + flow.length - z) / 8; return a < 1 ? 0.55 + 0.45 * Math.max(0, a) : b < 1 ? 1.18 - 0.18 * Math.max(0, b) : 1; };
        // 濃さ: 入口と出口で溶かし、遠くほど薄く（240m から先は消える）
        const alphaAt = z => { const dz = z - camZ, ends = Math.min(1, (z - flow.z) / 5, (flow.z + flow.length - z) / 9); return Math.max(0, Math.min(1, ends) * Math.min(1, (240 - dz) / 90)); };
        const step = 2, rows = [];
        for (let z = z0; z <= z1 + 1e-6; z += step) {
          const zz = Math.min(z, z1), half = flow.half * widen(zz);
          const l = placeAt(zz, flow.x - half), r = placeAt(zz, flow.x + half);
          if (l && r) rows.push({ z: zz, l, r, a: alphaAt(zz) });
          if (zz >= z1) break;
        }
        if (rows.length < 2) continue;
        // 遠くからも見える淡い照り（帯より広く）→ 浅い溝の影 → 流れる砂の地 → 中ほどの明るい筋
        for (const [k, color, alpha] of [[1.9, core, 0.16], [1.3, dark, 0.22], [1, body, 0.8], [0.5, core, 0.5]]) {
          for (let i = 1; i < rows.length; i++) {
            const n = rows[i - 1], f = rows[i], a = alpha * (n.a + f.a) / 2;
            if (a <= 0.01) continue;
            const nc = (n.l.x + n.r.x) / 2, fc = (f.l.x + f.r.x) / 2, nw = (n.r.x - n.l.x) / 2 * k, fw = (f.r.x - f.l.x) / 2 * k;
            ctx.fillStyle = `rgba(${color},${a})`;
            quad(nc - nw, n.l.y, fc - fw, f.l.y, fc + fw, f.r.y, nc + nw, n.r.y);
          }
        }
        // 土手: 両縁の暗い線と、その内側の明るい縁
        ctx.lineCap = "round";
        for (let i = 1; i < rows.length; i++) {
          const n = rows[i - 1], f = rows[i], a = (n.a + f.a) / 2;
          if (a <= 0.01) continue;
          const width = Math.max(1, Math.min(9, n.l.w * 0.016));
          for (const side of [-1, 1]) {
            const nx = side < 0 ? n.l.x : n.r.x, fx = side < 0 ? f.l.x : f.r.x;
            ctx.strokeStyle = `rgba(${dark},${0.4 * a})`; ctx.lineWidth = width;
            ctx.beginPath(); ctx.moveTo(nx, n.l.y); ctx.lineTo(fx, f.l.y); ctx.stroke();
            ctx.strokeStyle = `rgba(255,248,226,${0.5 * a})`; ctx.lineWidth = Math.max(0.8, width * 0.5);
            ctx.beginPath(); ctx.moveTo(nx - side * width, n.l.y); ctx.lineTo(fx - side * width, f.l.y); ctx.stroke();
          }
        }
        // 流れの筋: 帯の中の5本の線に沿って、短い光の筋が坂の下へ流れる
        for (const [lane, offset] of [[-0.62, 0.1], [-0.3, 0.55], [0, 0.3], [0.32, 0.8], [0.64, 0.45]]) {
          const gap = 11, len = 4.5;
          for (let zz = flow.z + ((phase * 1.25 + offset * gap) % gap) - gap; zz < flow.z + flow.length; zz += gap) {
            const a0 = Math.max(zz, z0), a1 = Math.min(zz + len, z1);
            if (a1 - a0 < 0.4) continue;
            const pa = placeAt(a0, flow.x + lane * flow.half * widen(a0)), pb = placeAt(a1, flow.x + lane * flow.half * widen(a1));
            const a = alphaAt((a0 + a1) / 2);
            if (!pa || !pb || a <= 0.01) continue;
            ctx.strokeStyle = `rgba(255,252,240,${0.6 * a})`; ctx.lineWidth = Math.max(0.8, Math.min(6, pa.w * 0.012));
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
          }
        }
        // 舞い上がる砂: 帯の上に低い砂けむり（重ねた薄い幕）と、きらめく砂粒。遠くでは帯が細くつぶれるので、背の高さで手前から見つけられる
        for (let i = 1; i < rows.length; i++) {
          const n = rows[i - 1], f = rows[i], a = (n.a + f.a) / 2;
          if (a <= 0.01) continue;
          const nc = (n.l.x + n.r.x) / 2, fc = (f.l.x + f.r.x) / 2, nw = (n.r.x - n.l.x) / 2 * 1.15, fw = (f.r.x - f.l.x) / 2 * 1.15;
          for (const [height, alpha] of [[0.3, 0.3], [0.7, 0.18], [1.2, 0.1]]) {
            const nh = n.l.scale * height * (H / 2), fh = f.l.scale * height * (H / 2);
            ctx.fillStyle = `rgba(${core},${alpha * a})`;
            quad(nc - nw, n.l.y, fc - fw, f.l.y - fh, fc + fw, f.l.y - fh, nc + nw, n.r.y - nh);
          }
        }
        for (let i = 0; i < 40; i++) {
          // 砂粒ごとに決まった横位置・高さの癖（乱数は使わない）。坂の下へ流れながら、ふわっと上がって消える
          const h1 = Math.abs(Math.sin(i * 12.9898 + flow.z) * 43758.5453) % 1, h2 = Math.abs(Math.sin(i * 78.233 + flow.x * 10) * 12345.678) % 1;
          const u = (h1 + phase * (0.9 + h2 * 0.6) / flow.length) % 1, zz = flow.z + u * flow.length;
          if (zz < z0 || zz > z1) continue;
          const p = placeAt(zz, flow.x + (h2 * 2 - 1) * flow.half * widen(zz));
          const a = alphaAt(zz);
          if (!p || a <= 0.01) continue;
          const rise = ((h2 * 3 + u * 4) % 1), size = Math.max(1.8, Math.min(4, p.scale * (H / 2) * 0.045)); // 手前で大きな玉に見えないよう上限
          ctx.fillStyle = `rgba(255,250,228,${0.85 * a * Math.sin(rise * Math.PI)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y - rise * p.scale * 1.1 * (H / 2), size, 0, Math.PI * 2); ctx.fill();
        }
        // 波紋: 進む向きへ反った山形が流れていく（影と光の二重線で、砂の盛り上がりに見せる）
        const ripple = 8, bow = 2.6;
        for (let zz = flow.z + (phase % ripple) - ripple; zz < flow.z + flow.length; zz += ripple) {
          if (zz < z0 || zz + bow > z1) continue;
          const half = flow.half * widen(zz) * 0.86;
          const pl = placeAt(zz, flow.x - half), pr = placeAt(zz, flow.x + half), pc = placeAt(zz + bow, flow.x);
          const a = alphaAt(zz);
          if (!pl || !pr || !pc || a <= 0.01) continue;
          const cx = 2 * pc.x - (pl.x + pr.x) / 2, cy = 2 * pc.y - (pl.y + pr.y) / 2, width = Math.max(1, Math.min(12, pc.w * 0.022));
          ctx.strokeStyle = `rgba(${dark},${0.34 * a})`; ctx.lineWidth = width;
          ctx.beginPath(); ctx.moveTo(pl.x, pl.y + width * 0.6); ctx.quadraticCurveTo(cx, cy + width * 0.6, pr.x, pr.y + width * 0.6); ctx.stroke();
          ctx.strokeStyle = `rgba(255,250,232,${0.62 * a})`; ctx.lineWidth = Math.max(0.8, width * 0.6);
          ctx.beginPath(); ctx.moveTo(pl.x, pl.y); ctx.quadraticCurveTo(cx, cy, pr.x, pr.y); ctx.stroke();
        }
      }
    }
    /**
     * 板が砂に刻んだ跡（#3686）。坂を滑り下りてきた線が、人物から手前（坂の上）へ伸びる。空中の間は途切れる。
     * 覚えるのは画面に入る手前の数 m だけ。見た目だけで、規則は読まない。
     */
    function drawBoardTrail(dusk) {
      const trail = world.trail, grounded = game.air <= 0 && game.fallT <= 0, last = trail[trail.length - 1];
      if (!last || game.z - last.z > 0.35 || grounded !== last.on) trail.push({ z: game.z, x: game.x, on: grounded, heat: grounded && game.carving ? carveFx.heat : 0 });
      while (trail.length && trail[0].z < ground.camZ - 2) trail.shift();
      const dark = mixColor([150, 98, 52], [140, 78, 52], dusk).slice(4, -1), light = mixColor([255, 240, 208], [255, 214, 170], dusk).slice(4, -1);
      ctx.lineCap = "round";
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        if (!a.on || !b.on) continue;
        const pa = placeAt(Math.max(a.z, ground.camZ + 0.6), a.x), pb = placeAt(b.z, b.x);
        if (!pa || !pb) continue;
        // 人物の足元で濃く、手前（画面の下端）へ薄く
        const k = Math.min(1, Math.max(0, (pb.dz - 0.6) / (view.back - 0.6)));
        const width = Math.min(46, pb.w * 0.11);
        ctx.strokeStyle = `rgba(${dark},${0.3 * k})`; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        // 跡の両縁に、押しのけた砂の明るい盛り上がり
        ctx.strokeStyle = `rgba(${light},${0.34 * k})`; ctx.lineWidth = Math.max(1, width * 0.16);
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(pa.x + side * Math.min(46, pa.w * 0.11) * 0.56, pa.y); ctx.lineTo(pb.x + side * width * 0.56, pb.y); ctx.stroke();
        }
        // カービングで刻んだ所は、金色に光る線（2026-11-25）。切り込み続けるほど太く明るい。
        // 刻みごとに、光が板から後ろ（手前）へ線をなぞって走る（carveFx.runs。「輪なのがなんか違う」で輪の代わりに）
        const heat = Math.min(a.heat || 0, b.heat || 0);
        let run = 0;
        for (const r of carveFx.runs) {
          const at = (r.age / r.life) * (view.back + 1), d = game.z - b.z; // 板からの距離（m）を光が進む
          run = Math.max(run, Math.exp(-(((d - at) / 0.9) ** 2)) * (1 - r.age / r.life) * (r.big ? 1.3 : 1));
        }
        if (heat > 0.02 || run > 0.02) {
          const glow = Math.min(1.3, heat + run);
          ctx.strokeStyle = `rgba(255,186,64,${0.32 * glow * k})`; ctx.lineWidth = width * (1.1 + 0.6 * glow);
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
          ctx.strokeStyle = `rgba(255,248,214,${Math.min(1, 0.85 * glow) * k})`; ctx.lineWidth = Math.max(1.5, width * (0.18 + 0.14 * glow));
          ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        }
      }
    }
    function quad(x1, y1, x2, y2, x3, y3, x4, y4) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
    }
    /** z にある物の画面位置。路面の横ずれだけを区間から補間し、奥行きは直接投影する（画面座標の線形補間は遠近が狂う）。 */
    function placeAt(z, xLane) {
      const pts = segmentsDrawn;
      if (pts.length < 2 || z < pts[0].z || z > pts[pts.length - 1].z) return null;
      let i = 1;
      while (i < pts.length - 1 && pts[i].z < z) i++;
      const a = pts[i - 1], b = pts[i];
      const t = Math.min(1, Math.max(0, (z - a.z) / Math.max(0.001, b.z - a.z)));
      const dz = z - ground.camZ;
      if (dz < 0.5) return null;
      const p = project(lerp(a.x, b.x, t) - ground.camX + xLane, 0, dz);
      return { x: p.x, y: p.y, scale: p.scale, w: p.w, dz };
    }
    function drawFeaturesAndPlayer(dusk) {
      const camZ = game.z - view.back;
      const drawables = [];
      for (const f of game.course.features) {
        if (f.z < camZ + 0.8 || f.z > camZ + DRAW_DIST) continue;
        // 砕いた岩は消える。ただし止め（ヒットストップ）の間だけ、白く光らせて残す
        const flashed = f.kind === "rock" && smashFlash.has(f) && hitStopT > 0;
        if (f.kind === "rock" && game.smashedRocks.has(f) && !flashed) continue;
        drawables.push({ z: f.z, kind: f.kind, f, flashed });
      }
      for (const sign of curveSigns) if (sign.z > camZ + 0.8 && sign.z < camZ + DRAW_DIST) drawables.push({ z: sign.z, kind: "curveSign", sign });
      const noor = rival ? rivalAt(rival, game.rivalClock) : null; // 差に応じて速さを変えた再生（RUBBER）
      if (noor && noor.z > camZ + 1.2 && noor.z < camZ + DRAW_DIST) drawables.push({ z: noor.z, kind: "noor", noor });
      if (game.course.length >= camZ && game.course.length < camZ + DRAW_DIST) drawables.push({ z: game.course.length, kind: "goal" });
      drawables.sort((a, b) => b.z - a.z);
      let playerDrawn = false;
      const drawPlayerIfBehind = z => { if (!playerDrawn && z < game.z) { drawPlayer(dusk); playerDrawn = true; } };
      for (const d of drawables) {
        drawPlayerIfBehind(d.z);
        if (d.kind === "bump") drawBump(d.f, dusk);
        else if (d.kind === "rock") drawRock(d.f, dusk, d.flashed);
        else if (d.kind === "curveSign") drawCurveSign(d.sign);
        else if (d.kind === "noor") drawRival(d.noor, dusk);
        else drawGoal(dusk);
      }
      if (!playerDrawn) drawPlayer(dusk);
    }
    function drawCurveSign(sign) {
      const image = art.get(sign.direction < 0 ? "curveLeft" : "curveRight");
      // 手前の大きな看板はカーブの予告。曲がっている間の小さな板は、外側の縁に並ぶ
      const p = placeAt(sign.z, -sign.direction * (sign.row ? 1.55 : 2.05));
      if (!p || !image) return;
      const height = p.scale * (sign.row ? 2.6 : 4.8) * (H / 2);
      const width = height * image.naturalWidth / image.naturalHeight;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (DRAW_DIST - p.dz) / 85));
      softShadow(p.x, p.y, width * 0.36, Math.max(2, height * 0.035), 0.3);
      ctx.drawImage(image, p.x - width / 2, p.y - height, width, height);
      ctx.restore();
    }
    /** 起伏: 砂から盛り上がる丸い砂山。根元は砂に溶かし、手前の斜面は明るく、両側と稜線の向こうは影。両肩に小さな旗（ここで跳ぶ）。 */
    function drawBump(f, dusk) {
      const near = placeAt(f.z - 6, 0), crest = placeAt(f.z + 1.5, 0), far = placeAt(f.z + 9, 0);
      if (!near || !far || !crest) return;
      // 近づいて乗る頃には描かない（手前いっぱいの平らな板に見えないように）。遠くから少しずつ消す
      const fadeIn = Math.min(1, Math.max(0, (crest.dz - 7) / 9));
      if (fadeIn <= 0) return;
      ctx.save(); ctx.globalAlpha = fadeIn;
      const lift = crest.scale * 1.5 * (H / 2), top = crest.y - lift;
      const L = { x: near.x - near.w * 1.3, y: near.y }, R = { x: near.x + near.w * 1.3, y: near.y };
      const CL = { x: crest.x - crest.w * 0.9, y: top + lift * 0.12 }, CR = { x: crest.x + crest.w * 0.9, y: top + lift * 0.12 };
      const outline = () => {
        ctx.beginPath(); ctx.moveTo(L.x, L.y);
        ctx.bezierCurveTo(L.x + (CL.x - L.x) * 0.55, L.y - (L.y - CL.y) * 0.15, CL.x - crest.w * 0.25, CL.y, CL.x, CL.y);
        ctx.quadraticCurveTo(crest.x, top - lift * 0.06, CR.x, CR.y);
        ctx.bezierCurveTo(CR.x + crest.w * 0.25, CR.y, R.x - (R.x - CR.x) * 0.55, R.y - (R.y - CR.y) * 0.15, R.x, R.y);
        ctx.closePath();
      };
      // 稜線の向こうに落ちる影（砂の上）
      ctx.fillStyle = "rgba(110,62,26,0.16)";
      ctx.beginPath(); ctx.ellipse(crest.x + crest.w * 0.25, Math.min(far.y, top) + 2, crest.w * 1.1, Math.max(2, lift * 0.12), 0, 0, Math.PI * 2); ctx.fill();
      // 斜面: 根元は砂に溶かし、稜線へ向かって明るく
      const sand = mixColor([236, 200, 146], [236, 168, 116], dusk), lit = mixColor([250, 224, 176], [252, 196, 140], dusk), peak = mixColor([255, 240, 206], [255, 214, 168], dusk);
      const face = ctx.createLinearGradient(0, near.y, 0, top);
      face.addColorStop(0, sand.replace("rgb", "rgba").replace(")", ",0)"));
      face.addColorStop(0.3, sand.replace("rgb", "rgba").replace(")", ",0.85)"));
      face.addColorStop(0.85, lit); face.addColorStop(1, peak);
      ctx.fillStyle = face; outline(); ctx.fill();
      // 砂の粒（地面と同じ模様を薄く重ねる）
      const grain = sandPattern();
      if (grain) { ctx.save(); ctx.globalCompositeOperation = "soft-light"; ctx.globalAlpha = 0.7 * fadeIn; ctx.fillStyle = grain; outline(); ctx.fill(); ctx.restore(); }
      // 両側を暗く（丸みを出す）
      const sides = ctx.createLinearGradient(L.x, 0, R.x, 0);
      sides.addColorStop(0, "rgba(120,70,30,0.32)"); sides.addColorStop(0.3, "rgba(120,70,30,0)"); sides.addColorStop(0.7, "rgba(120,70,30,0)"); sides.addColorStop(1, "rgba(120,70,30,0.38)");
      ctx.save(); outline(); ctx.clip();
      ctx.fillStyle = sides; ctx.fillRect(L.x, top - 4, R.x - L.x, near.y - top + 4);
      // 斜面の風紋（稜線に沿った細い弧）
      ctx.strokeStyle = "rgba(160,104,52,0.18)"; ctx.lineWidth = Math.max(1, crest.scale * 5);
      for (const k of [0.3, 0.5, 0.7]) {
        const y = top + (near.y - top) * k, w = crest.w * (0.9 + k * 0.35);
        ctx.beginPath(); ctx.moveTo(crest.x - w, y + lift * 0.05); ctx.quadraticCurveTo(crest.x, y - lift * 0.08, crest.x + w, y + lift * 0.05); ctx.stroke();
      }
      ctx.restore();
      // 稜線の光
      ctx.strokeStyle = "rgba(255,250,232,0.7)"; ctx.lineWidth = Math.max(1.2, crest.scale * 6);
      ctx.beginPath(); ctx.moveTo(CL.x, CL.y); ctx.quadraticCurveTo(crest.x, top - lift * 0.06, CR.x, CR.y); ctx.stroke();
      // ここで跳ぶ: 両肩に小さな橙の旗と、砂に薄い山形
      const mark = placeAt(f.z - 2, 0);
      if (mark) {
        ctx.strokeStyle = "rgba(233,83,43,0.42)"; ctx.lineWidth = Math.max(1.5, mark.scale * 9); ctx.lineJoin = "round";
        ctx.beginPath();
        for (const k of [-0.4, 0, 0.4]) { const cxm = mark.x + k * mark.w; ctx.moveTo(cxm - mark.w * 0.1, mark.y - lift * 0.18); ctx.lineTo(cxm, mark.y - lift * 0.45); ctx.lineTo(cxm + mark.w * 0.1, mark.y - lift * 0.18); }
        ctx.stroke();
      }
      const flagArt = art.get("flag");
      if (flagArt) {
        const fh = crest.scale * 1.3 * (H / 2), fw = fh * flagArt.naturalWidth / flagArt.naturalHeight;
        for (const side of [-1, 1]) ctx.drawImage(flagArt, crest.x + side * crest.w * 1.08 - DESERT_ART.flag.foot.x * fw, CL.y + lift * 0.25 - fh, fw, fh);
      }
      ctx.restore();
    }
    let grainPattern;
    const sandPattern = () => {
      if (grainPattern === undefined) { const level = sandTexture()[2]; grainPattern = level ? ctx.createPattern(level.canvas, "repeat") : null; }
      return grainPattern;
    };
    /** ぼかした楕円の影（中心が濃く、縁は砂に溶ける）。毎回グラデーションを作らず、焼いた影スプライトを使い回す（2026-11-14 軽量化）。 */
    let shadowSprite = null;
    function ensureShadowSprite() {
      if (!shadowSprite) {
        shadowSprite = document.createElement("canvas"); shadowSprite.width = shadowSprite.height = 128;
        const sg = shadowSprite.getContext("2d"), g = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, "rgba(80,44,18,1)"); g.addColorStop(0.6, "rgba(80,44,18,0.6)"); g.addColorStop(1, "rgba(80,44,18,0)");
        sg.fillStyle = g; sg.fillRect(0, 0, 128, 128);
      }
      return shadowSprite;
    }
    function softShadow(x, y, rx, ry, alpha) {
      if (rx <= 0 || ry <= 0 || alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(ensureShadowSprite(), x - rx, y - ry, rx * 2, ry * 2);
      ctx.restore();
    }
    function drawRock(f, dusk, flashed = false) {
      const p = placeAt(f.z, f.x);
      if (!p) return;
      const size = f.size === "small" ? 0.55 : 0.95;
      const rw = p.scale * CAM.meterPerLane * (W / 2) * f.w * 1.15, rh = p.scale * size * 0.62 * (H / 2);
      // かすめの帯（2026-11-13）: 岩のまわりの、風で削れた砂の輪。板の中心がこの輪の内側を通れば「かすめ」（内側ほど大きい）。
      // どこまで寄れるかを地面で見せる。近づいてから見えればよいので、遠くでは描かない
      const near = Math.min(1, Math.max(0, (170 - p.dz) / 70));
      if (near > 0 && !flashed) {
        const rx = p.w * (f.w + PLAYER.half + NEAR.width), ry = Math.max(1.5, rx * 0.17);
        ctx.save();
        ctx.fillStyle = `rgba(122,74,34,${0.1 * near})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,243,212,${0.5 * near})`; ctx.lineWidth = Math.max(1, Math.min(4, p.scale * 26));
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      // 影（太陽の向きへ少し伸びる、ぼかした影）
      softShadow(p.x + rw * 0.45, p.y + rh * 0.04, rw * 1.35, rh * 0.3, 0.4);
      const rockArt = art.get(f.size === "small" ? "rockSmall" : "rockLarge");
      if (rockArt) {
        // 絵の岩は当たり判定（f.w）より少しだけ広く描く（見た目より判定が大きくならないように）。下端の数%は砂に埋める
        const dw = rw * 2.15, dh = dw * rockArt.naturalHeight / rockArt.naturalWidth;
        ctx.drawImage(flashed ? tintedArt(rockArt, [255, 255, 255]) : rockArt, p.x - dw / 2, p.y - dh * 0.93, dw, dh);
        return;
      }
      if (flashed) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.moveTo(p.x - rw, p.y); ctx.lineTo(p.x - rw * 0.75, p.y - rh * 0.7); ctx.lineTo(p.x - rw * 0.2, p.y - rh); ctx.lineTo(p.x + rw * 0.45, p.y - rh * 0.85); ctx.lineTo(p.x + rw, p.y - rh * 0.3); ctx.lineTo(p.x + rw * 0.9, p.y); ctx.closePath(); ctx.fill();
        return;
      }
      const body = ctx.createLinearGradient(p.x - rw, p.y - rh, p.x + rw, p.y);
      body.addColorStop(0, mixColor([150, 118, 96], [140, 96, 86], dusk)); body.addColorStop(1, mixColor([92, 70, 58], [86, 58, 54], dusk));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(p.x - rw, p.y); ctx.lineTo(p.x - rw * 0.75, p.y - rh * 0.7); ctx.lineTo(p.x - rw * 0.2, p.y - rh); ctx.lineTo(p.x + rw * 0.45, p.y - rh * 0.85); ctx.lineTo(p.x + rw, p.y - rh * 0.3); ctx.lineTo(p.x + rw * 0.9, p.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,240,220,0.22)";
      ctx.beginPath(); ctx.moveTo(p.x - rw * 0.6, p.y - rh * 0.62); ctx.lineTo(p.x - rw * 0.2, p.y - rh * 0.92); ctx.lineTo(p.x + rw * 0.3, p.y - rh * 0.8); ctx.lineTo(p.x - rw * 0.1, p.y - rh * 0.55); ctx.closePath(); ctx.fill();
    }
    function drawGoal(dusk) {
      const p = placeAt(game.course.length, 0);
      if (!p) return;
      const poleH = p.scale * GOAL_POLE * (H / 2);
      const flagArt = art.get("flag"), goalArt = art.get("goal");
      if (flagArt && goalArt) {
        const fw = poleH * flagArt.naturalWidth / flagArt.naturalHeight;
        for (const side of [-1, 1]) ctx.drawImage(flagArt, p.x + side * p.w * 1.02 - DESERT_ART.flag.foot.x * fw, p.y - poleH, fw, poleH);
        const bw = p.w * 2.2, bh = bw * goalArt.naturalHeight / goalArt.naturalWidth;
        ctx.drawImage(goalArt, p.x - bw / 2, p.y - poleH * 0.94, bw, bh); // 幕は竿の上の方に掛ける
        return;
      }
      for (const side of [-1, 1]) {
        const px = p.x + side * p.w * 1.02;
        ctx.fillStyle = "#4a3a30"; ctx.fillRect(px - 2, p.y - poleH, 4, poleH);
        ctx.fillStyle = side < 0 ? "#f0b443" : "#e9532b";
        ctx.beginPath(); ctx.moveTo(px, p.y - poleH); ctx.lineTo(px + side * p.w * 0.35, p.y - poleH + poleH * 0.14); ctx.lineTo(px, p.y - poleH + poleH * 0.28); ctx.closePath(); ctx.fill();
      }
      // ゴールの砂の上にゆらめく旗布（横断幕）
      ctx.fillStyle = `rgba(255,255,255,${0.75})`;
      ctx.fillRect(p.x - p.w * 1.02, p.y - poleH, p.w * 2.04, Math.max(2, poleH * 0.06));
    }
    /**
     * ブーストのオーラ（2026-11-11 オーナー「今なんか光ってるだけ。早そうな感じにして。見づらいのは良くないけど、ちょっと大袈裟でいい」）。
     * 前へ突っ込む向き（消失点）の反対＝画面の手前・外側へ、炎と風が流れる形にする。すべて人物の絵の後ろに描き、人物と走路の先は隠さない。
     * ① 板から手前へ広がる炎の航跡（明るい切れ目が手前へ速く流れる） ② 体の縁から後ろへなびく炎の筋 ③ 体の横を流れ過ぎる風の線。
     * 炎色の残像は人物の絵を使うので drawPlayer／drawRival が描く（boostAfterimages）。頭上の弧は輪・ドームに見えるので入れない。
     * strength 0〜1 で立ち上がり・消え際をなめらかに。動き軽減では流れを止める（形だけ残す）。
     */
    /** オーラの強さ（0〜1）。ブーストの残り boostT（発進時は最大 BOOST 3秒）と、立ち上がり・消え際の feel から。発進から auraBurst 秒だけ強い。 */
    function auraStrength(boostT, feel) {
      if (!(boostT > 0) && feel <= 0.02) return 0;
      const sinceStart = auraStartT >= 0 && game ? game.t - auraStartT : Infinity;
      const burst = sinceStart < FEEL.auraBurst ? 1 - sinceStart / FEEL.auraBurst : 0;
      return Math.min(1, feel * (FEEL.auraHold + (1 - FEEL.auraHold) * burst));
    }
    function drawBoostAura(cx, baseY, unit, { palette = AURAS.player, strength = 1, time = 0, seed = 0 } = {}) {
      if (strength <= 0.02 || unit <= 0) return;
      const t = reducedMotion ? 0 : time, s = strength, midY = baseY - unit * 1.1;
      const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
      const hash = i => { const v = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
      const back = (x, y) => boostBack(x, y);
      ctx.save();
      ctx.lineCap = "round";
      // ① 炎の航跡: 板の左右から画面の手前・外側へ。根元は細く明るく、手前ほど太く薄い
      for (const side of [-1, 1]) {
        const x0 = cx + side * unit * 0.3, y0 = baseY + unit * 0.02, x1 = cx + side * unit * 2.4, y1 = baseY + unit * 2.7;
        const len = Math.hypot(x1 - x0, y1 - y0), ux = -(y1 - y0) / len, uy = (x1 - x0) / len, w0 = unit * 0.07, w1 = unit * 0.6;
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, rgba(palette.core, 0.85 * s)); g.addColorStop(0.3, rgba(palette.mid, 0.6 * s)); g.addColorStop(1, rgba(palette.rim, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x0 + ux * w0, y0 + uy * w0); ctx.lineTo(x1 + ux * w1, y1 + uy * w1); ctx.lineTo(x1 - ux * w1, y1 - uy * w1); ctx.lineTo(x0 - ux * w0, y0 - uy * w0); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 5; k++) {
          const f = (t * 3.4 + k / 5 + hash(k + side * 7)) % 1, x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f, dl = unit * (0.18 + 0.5 * f);
          ctx.strokeStyle = rgba(palette.core, 0.95 * (1 - f) * s); ctx.lineWidth = Math.max(1.5, unit * (0.05 + 0.12 * f));
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x1 - x0) / len * dl, y + (y1 - y0) / len * dl); ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }
      // ② 後ろへなびく炎の筋: 体の縁（上半分と両脇）から、外向きと「後ろ」の間の向きへ、細く長く曲がって流れる。
      //    1本ごとに太く薄い外側と細く明るい芯を重ね、縁をやわらげる（重い blur は使わない）
      const streak = (i, scale, alphaK, colors, widthK) => {
        const a = -Math.PI - 0.6 + (i / 21) * (Math.PI + 1.2);
        const x0 = cx + Math.cos(a) * unit * 0.42, y0 = midY + Math.sin(a) * unit * 0.98;
        let nx = Math.cos(a) / 0.42, ny = Math.sin(a) / 0.98; const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
        const [bx, by] = back(x0, y0);
        let dx = nx * 0.55 + bx * 0.9, dy = ny * 0.55 + by * 0.9; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
        // 頭の上（走路の先）には出さない。両脇ほど長く後ろへ流す（長さは FEEL.auraLength）
        const side = Math.abs(Math.cos(a));
        if (side < 0.5 && Math.sin(a) < 0) return;
        const L = unit * (1.0 + 1.0 * hash(i)) * (0.78 + 0.26 * Math.sin(t * 27 + i * 2.3)) * (0.55 + 0.45 * s) * scale * (0.4 + 0.6 * side) * FEEL.auraLength;
        const w0 = unit * (0.07 + 0.05 * hash(i + 9)) * widthK, px = -dy, py = dx;
        const bend = unit * 0.22 * Math.sin(t * 19 + i * 1.7) * scale;      // 先へ行くほど揺れて曲がる
        const mx = x0 + dx * L * 0.5 + px * bend * 0.5, my = y0 + dy * L * 0.5 + py * bend * 0.5;
        const tx = x0 + dx * L + px * bend, ty = y0 + dy * L + py * bend;
        const g = ctx.createLinearGradient(x0, y0, tx, ty);
        g.addColorStop(0, rgba(colors[0], alphaK * s)); g.addColorStop(0.4, rgba(colors[1], 0.75 * alphaK * s)); g.addColorStop(1, rgba(colors[2], 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x0 + px * w0, y0 + py * w0);
        ctx.quadraticCurveTo(mx + px * w0 * 0.7, my + py * w0 * 0.7, tx, ty);
        ctx.quadraticCurveTo(mx - px * w0 * 0.7, my - py * w0 * 0.7, x0 - px * w0, y0 - py * w0);
        ctx.closePath(); ctx.fill();
      };
      // 体を包む薄い炎（筋の根元をつなぐ）
      const body = ctx.createRadialGradient(cx, midY + unit * 0.2, unit * 0.2, cx, midY, unit * 1.45);
      body.addColorStop(0, rgba(palette.mid, 0.3 * s)); body.addColorStop(0.7, rgba(palette.rim, 0.16 * s)); body.addColorStop(1, rgba(palette.rim, 0));
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(cx, midY + unit * 0.1, unit * 0.7, unit * 1.28, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 22; i++) streak(i, 1, 0.2, [palette.rim, palette.rim, palette.rim], 1.8);    // 太く薄い外側
      for (let i = 0; i < 22; i++) streak(i, 0.96, 0.6, [palette.mid, palette.rim, palette.rim], 0.85); // 炎の色
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 22; i += 2) streak(i, 0.7, 0.7, [palette.core, palette.mid, palette.mid], 0.55); // 明るい芯
      // ③ 体の横を流れ過ぎる風の線（人物の左右だけ。真ん中には引かない）
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1, f = (t * (3.2 + 1.8 * hash(i + 40)) + hash(i + 30)) % 1;
        const x = cx + side * unit * (0.8 + 1.3 * hash(i + 20)) * (0.85 + 0.5 * f), y = midY - unit * 1.5 + f * unit * 3.4;
        const [bx, by] = back(x, y), len = unit * (0.45 + 0.7 * hash(i + 50)) * (0.6 + f);
        ctx.strokeStyle = `rgba(255,252,240,${Math.max(0, Math.sin(f * Math.PI) * 0.8 * s)})`; ctx.lineWidth = Math.max(1.4, unit * 0.035 * (0.6 + f));
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + bx * len, y + by * len); ctx.stroke();
      }
      ctx.restore();
    }
    /** ブーストで「後ろ」へ流れる向き（消失点から、その点を通って手前・外側へ）。 */
    function boostBack(x, y) {
      const dx = x - W / 2, dy = y - GROUND_Y + 60, l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    }
    // 炎色の残像に使う、人物の絵を一色に塗った小さな複製（絵と色ごとに一度だけ作る）
    const tintCache = new WeakMap();
    /** ブーストの残像に使う色付きの絵を、走る前に作っておく（主人公の姿勢5つ×2色）。 */
    function prewarmTints(who = null) {
      for (const pose of ["rider", "riderLeft", "riderRight", "riderJump", "riderBrace"]) {
        const image = art.get(pose);
        if (image) for (const color of [AURAS.player.mid, AURAS.player.rim]) tintedArt(image, color);
        // 相手の残像（相手のオーラの色）
        if (image) for (const color of [CARVE_GOLD.mid, CARVE_GOLD.rim]) tintedArt(image, color); // カービングの金の残像
        const rivalImage = who ? art.get(`${who}${pose.replace(/^rider/, "Rider")}`) : null;
        if (rivalImage) for (const color of [AURAS[who].mid, AURAS[who].rim]) tintedArt(rivalImage, color);
      }
      // 砕いた岩を止めの間だけ白く見せる絵も、先に作っておく
      for (const name of ["rockSmall", "rockLarge"]) { const image = art.get(name); if (image) tintedArt(image, [255, 255, 255]); }
    }
    /** 砂テクスチャ・影・ビネット・遠景面を走る前に作っておき、1コマ目および序盤の重い初期化を前倒しする。 */
    function prewarmCanvas() {
      sandTexture();
      ensureSandBuf();
      sandPattern();
      ensureShadowSprite();
      vignetteLayer(0);
      vignetteLayer(1);
      const sky = art.get("sky"), land = art.get("land");
      if (sky && land) {
        const B = DESERT_ART.backdrop, valleyArt = sloped ? art.get("valley") : null, fit = backdropFit(valleyArt), { skySrc, skyW, skyH, landW, landH, above, below } = fit;
        const groundW = fit.valley ? Math.round(B.width * BACKDROP_SCALE) : landW;
        backdropStrip(sky, 0, 0, B.width, skySrc, skyW, skyH);
        if (fit.valley) backdropStrip(valleyArt, 0, 0, valleyArt.naturalWidth, valleyArt.naturalHeight, landW, landH);
        else backdropStrip(land, 0, 0, B.width, above, landW, landH);
        backdropStrip(land, 0, above, B.width, below, groundW, H - GROUND_Y);
        const duskSky = art.get("duskSky"), duskLand = art.get("duskLand"), duskValley = fit.valley ? art.get("duskValley") : null;
        if (duskSky) backdropStrip(duskSky, 0, 0, B.width, skySrc, skyW, skyH);
        if (duskValley) backdropStrip(duskValley, 0, 0, duskValley.naturalWidth, duskValley.naturalHeight, landW, landH);
        if (duskLand) {
          if (!fit.valley) backdropStrip(duskLand, 0, 0, B.width, above, landW, landH);
          backdropStrip(duskLand, 0, above, B.width, below, groundW, H - GROUND_Y);
        }
        if (!backdropLayer) {
          drawBackdrop(0, 0, false);
        }
      }
    }
    function tintedArt(image, color) {
      let byColor = tintCache.get(image);
      if (!byColor) tintCache.set(image, byColor = new Map());
      const key = color.join(",");
      let canvas = byColor.get(key);
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth / 2)); canvas.height = Math.max(1, Math.round(image.naturalHeight / 2));
        const g = canvas.getContext("2d");
        g.drawImage(image, 0, 0, canvas.width, canvas.height);
        g.globalCompositeOperation = "source-in"; g.fillStyle = `rgb(${key})`; g.fillRect(0, 0, canvas.width, canvas.height);
        byColor.set(key, canvas);
      }
      return canvas;
    }
    /**
     * ブースト中の炎色の残像。draw(image, alpha, dx, dy, grow) で絵を描く関数を受け取り、
     * 後ろ（手前・外側）へずらして、少し大きく・薄くした一色の複製を3枚、遠い順に重ねる。動き軽減では出さない。
     */
    function boostAfterimages(image, x, y, unit, strength, palette, draw) {
      if (reducedMotion || strength <= 0.05 || !image) return;
      const [bx, by] = boostBack(x, y);
      for (let k = Math.max(0, Math.round(FEEL.auraTrail)); k >= 1; k--) {
        const color = k === 1 ? palette.mid : palette.rim;
        draw(tintedArt(image, color), strength * (0.36 - 0.1 * k), bx * unit * 0.3 * k, by * unit * 0.3 * k, 1 + 0.06 * k);
      }
    }
    /** 絵の演出を1枚描く（DSR100）。x・y は砂が出る点（絵の origin を合わせる）。幅は画素。絵がまだ届いていなければ false。 */
    function drawFx(name, x, y, wide, { flip = false, alpha = 1, rotate = 0, squash = 1 } = {}) {
      const image = art.get(name);
      if (!image || !(alpha > 0.01) || !(wide > 1)) return false;
      const def = DESERT_ART[name], tall = wide * image.naturalHeight / image.naturalWidth * squash;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, alpha);
      ctx.translate(x, y);
      if (rotate) ctx.rotate(rotate);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(image, -def.origin.x * wide, -def.origin.y * tall, wide, tall);
      ctx.restore();
      return true;
    }
    /** 絵を小さく揺らす倍率（1コマごとに決まった順で変わる。動き軽減では 1）。 */
    const fxPulse = (amount, seed) => reducedMotion ? 1 : 1 + amount * (((Math.floor(game.t * FEEL.flicker) * (3 + seed * 2) + seed) % 5) / 2 - 1);
    /**
     * 足元の砂の絵（DSR100）: ブースト中は板の左右へ砂の波、鋭く切った時は外側へ砂、踏み切り・着地の一度きりの砂。人物の後ろに描く。
     * 走路の先（人物より上）へは伸ばさない: 砂は板の高さから横と手前へ広がる。carving の間は、カーブの波に任せて切った時の砂は出さない。
     */
    function drawGroundFx(cx, groundY, unit, carving) {
      const grounded = game.air <= 0 && game.fallT <= 0;
      const feel = view.boost || 0;
      if (grounded && feel > 0.03) {
        const start = Math.min(1, Math.max(0, 1 - (game.t - auraStartT) / 0.5));
        for (const side of [-1, 1]) {
          const wide = unit * FEEL.boostWakeWide * (0.85 + 0.25 * start) * fxPulse(0.08, side > 0 ? 1 : 3);
          drawFx("fxWake", cx + side * unit * 0.2, groundY + unit * 0.06, wide, { flip: side < 0, alpha: FEEL.boostWakeAlpha * Math.min(1, feel * 1.6) * (reducedMotion ? 0.6 : 1), squash: fxPulse(0.1, side > 0 ? 2 : 4) });
        }
      } else if (grounded && !carving && countdown <= 0 && !game.finished) {
        const turn = Math.abs(game.vx);
        if (turn > 0.5) {
          const k = Math.min(1, turn - 0.5), side = game.vx > 0 ? -1 : 1; // 砂は、曲がる向きと反対（板の外の縁）へ飛ぶ
          const wide = unit * (FEEL.steerWakeFrom + (FEEL.steerWakeTo - FEEL.steerWakeFrom) * k) * fxPulse(0.07, 2);
          drawFx("fxWake", cx + side * unit * 0.2, groundY + unit * 0.05, wide, { flip: side < 0, alpha: Math.min(1, 0.3 + 1.2 * k) * Math.min(1, game.speed / SPEED.max + 0.35), squash: fxPulse(0.1, 1) });
        }
      }
      // 一度きりの砂: 出始めは小さく濃く、広がりながら薄くなる
      for (const shot of fxShots) {
        const t = shot.age / shot.life, ease = 1 - (1 - t) * (1 - t);
        drawFx(shot.name, cx + (shot.dx || 0) * unit, groundY + unit * 0.05, unit * (shot.from + (shot.to - shot.from) * ease), { flip: shot.flip, alpha: Math.min(1, (1 - t) * 1.8), squash: (shot.squash || 1) * (0.9 + 0.2 * ease) });
      }
    }
    function drawPlayer(dusk) {
      drawPlayerBody(dusk);
      drawCharge();
    }
    /**
     * 見た目の高さ（m）。規則の軌道（左右対称。岩を越える判定に使う）と同じ頂点・同じ滞空のまま、頂点を後ろへ寄せる（FEEL.jumpApex）。
     * 上りは伸びやかに、落ちる方が速くなり、着地が叩きつける手応えになる。主人公も相手も同じ式。動き軽減では対称のまま。
     */
    function shownHeight(g) {
      if (!(g.air > 0) || !(g.airTotal > 0)) return 0;
      const t = Math.min(1, Math.max(0, 1 - g.air / g.airTotal)), apex = reducedMotion ? 0.5 : Math.min(0.8, Math.max(0.2, FEEL.jumpApex));
      const eased = t < apex ? t / (2 * apex) : 0.5 + (t - apex) / (2 * (1 - apex));
      return Math.sin(eased * Math.PI) * g.airPeak;
    }
    /**
     * 潰し・伸ばし [横, 縦]。跳んだ瞬間は縦に伸び、着地の瞬間は横に潰れて、すぐ戻る（板の重心が軸なので足元は動かない）。
     * 状態（滞空の経過・着地からの時間）から決めるので、相手にも同じ形で付く。止め（ヒットストップ）の間は潰れたまま止まる。
     */
    function squashOf(g, landed = null) {
      if (reducedMotion) return [1, 1];
      const blend = ([sx, sy, life], age) => { const k = Math.max(0, 1 - age / life); return [1 + (sx - 1) * k, 1 + (sy - 1) * k]; };
      if (g.fallT > 0) return [1, 1];
      if (g.air > 0) return g.airKind === "bounce" ? [1, 1] : blend(g.airKind === "big" ? FEEL.stretchJump : FEEL.stretchHop, g.airTotal - g.air);
      if (g.landedAt == null) return [1, 1];
      return blend(landed === "hop" ? FEEL.squashHop : landed === "perfect" ? FEEL.squashPerfect : FEEL.squashLand, g.t - g.landedAt);
    }
    /**
     * 跳んだ人物を地面から持ち上げて描く量（画素）。ふつうは高さ×FEEL.airLift（動き軽減では 0.9）m 分。ブーストの大ジャンプの頂上では
     * 頭が上の進み具合の線・相手との差の札（上 100px）より上へ出ないよう抑える（2026-11-11。それまでは頭が画面の上で切れていた）。
     */
    function riderLift(height, unit, groundY) {
      const lift = height * unit * (reducedMotion ? 0.9 : FEEL.airLift);
      const headroom = groundY - unit * 2.45 * 0.86 - 100; // 板の基準点から頭までは絵の約86%。頭は上の進み具合・相手との差の札より下
      return Math.max(0, Math.min(lift, headroom));
    }
    /**
     * ブーストの放電（人物）: ゲージが半分を超えると板の周りに小さな稲妻、満タンでは数が増え、体を這い上がる。
     * 形は 1/15 秒ごとに変わる（時刻から決まる乱数）。ブースト中・転倒中・動き軽減では出さない。人物の絵は隠さない細い線。
     */
    function drawCharge() {
      const charge = game.boostT > 0 || game.fallT > 0 ? 0 : game.gauge;
      const burst = zapBurstT > 0 && charge >= 0.1; // 「ビリッ」が鳴った瞬間は、半分に満たなくても走る
      if (reducedMotion || (charge < 0.5 && !burst)) return;
      const p = placeAt(game.z, game.x);
      if (!p) return;
      const unit = p.scale * (H / 2), cx = p.x, baseY = p.y - riderLift(shownHeight(game), unit, p.y);
      const full = charge >= 0.999, tick = Math.floor(game.t * 15);
      let n = 0;
      const rand = () => { const v = Math.sin(++n * 91.7 + tick * 12.9898) * 43758.5453; return v - Math.floor(v); };
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (full) {
        // 明るい砂の上でも白く飛ばないよう、足し算の合成は使わず青を薄く重ねる
        const glow = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, unit * 0.8);
        glow.addColorStop(0, `rgba(80,180,255,${0.2 + 0.07 * Math.sin(game.t * 20)})`); glow.addColorStop(1, "rgba(80,180,255,0)");
        ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(cx, baseY, unit * 0.8, unit * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      }
      const count = full ? 5 : burst ? 3 : charge >= 0.75 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        if (!burst && rand() > 0.3 + 0.6 * charge) continue;
        const side = rand() < 0.5 ? -1 : 1;
        const x0 = cx + side * unit * (0.2 + rand() * 0.4), y0 = baseY - unit * 0.05 + (rand() - 0.5) * unit * 0.12;
        const climb = full && i >= 3; // 満タンでは体を這い上がる
        const x1 = climb ? cx + side * unit * (0.1 + rand() * 0.25) : x0 + side * unit * (0.25 + rand() * 0.35);
        const y1 = climb ? baseY - unit * (0.45 + rand() * 0.5) : y0 - unit * rand() * 0.4;
        const parts = 5, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
        const pts = [[x0, y0]];
        for (let k = 1; k < parts; k++) { const off = (rand() * 2 - 1) * unit * 0.09; pts.push([x0 + dx * k / parts - dy / len * off, y0 + dy * k / parts + dx / len * off]); }
        pts.push([x1, y1]);
        // 光はぼかし（shadowBlur・重い）ではなく、太く薄い線を下に重ねて出す
        for (const [width, color] of [[Math.max(6, unit * 0.11), "rgba(70,180,255,0.28)"], [Math.max(2.5, unit * 0.045), "rgba(50,150,255,0.9)"], [Math.max(1, unit * 0.016), "#f2fdff"]]) {
          ctx.lineWidth = width; ctx.strokeStyle = color;
          ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        }
      }
      ctx.restore();
    }
    function drawPlayerBody(dusk) {
      const p = placeAt(game.z, game.x);
      if (!p) return;
      const airT = game.air > 0 ? 1 - game.air / game.airTotal : 0;
      const height = shownHeight(game), squash = squashOf(game, lastLand);
      const bob = game.air <= 0 && game.fallT <= 0 ? Math.sin(game.t * FEEL.bobRate) * FEEL.bobPx * (game.speed / SPEED.max) : 0;
      const unit = p.scale * (H / 2); // 1m の高さに相当する画素
      const groundY = p.y, cx = p.x;
      // 影（空中では小さく、少し薄く）。高く跳んでも地面に影を残す（高さの手がかり。DSR99: それまでは 2.5m で濃さ 0.12 まで薄れていた）
      softShadow(cx, groundY, unit * 0.62 * Math.max(0.5, 1 - height * 0.14), unit * 0.16, Math.max(0.26, 0.42 - height * 0.05));
      // カービング（2026-11-25）: 砂の壁は、押したり離したりの間もなめらかに（carveFx.show）。熱に合わせて大きく。
      // 板の下の弧（輪の形）は「輪なのがなんか違う」でやめた。切り込みは、金に光る切り込み線（drawBoardTrail）と、板の外の縁のきらめき（drawCarveGlints）で見せる
      const bendSide = Math.sign(curveAt(game.course, game.z)), wallK = carveFx.show * carveFx.heat;
      // 砂の波の絵（DSR100）があれば、それをカーブの外へ巻き上げる。絵がまだ届いていない時は、図形の砂の壁
      if (game.air <= 0 && game.fallT <= 0 && bendSide && wallK > 0.05) {
        const wide = unit * (FEEL.carveWaveFrom + (FEEL.carveWaveTo - FEEL.carveWaveFrom) * wallK) * fxPulse(0.06, 1);
        if (!drawFx("fxWave", cx - bendSide * unit * 0.26, groundY + unit * 0.05, wide, { flip: bendSide > 0, alpha: FEEL.carveWaveAlpha * Math.min(1, 0.4 + 0.6 * wallK), squash: FEEL.carveWaveSquash * fxPulse(0.05, 2) }))
          drawCarveWall(cx, groundY, unit, bendSide, wallK);
      }
      drawGroundFx(cx, groundY, unit, bendSide && wallK > 0.05);
      drawCarveGlints(cx, groundY, unit);
      if (curveCueOn) drawCurveCue(cx, groundY - unit * 1.1, unit, Math.sign(curveAt(game.course, game.z)));
      const baseY = groundY - riderLift(height, unit, groundY) + bob;
      riderPx.unit = unit; riderPx.lift = groundY - baseY; // 空中の砂・きらめきの出どころ（地面からの高さ・画素）
      // カーブへ切り込んでいる間（カービング）は、横へ動いていなくても体が内側へ倒れる
      const carveDir = game.carving ? Math.sign(curveAt(game.course, game.z)) : 0;
      // 左右を押した最初のコマから体を傾ける（横の速さが付くのを待つと約5コマ遅れる）。押している間、姿勢の絵は押した向き
      const steerLean = game.air <= 0 && game.fallT <= 0 && countdown <= 0 && !game.finished ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
      const lean = Math.max(-0.5, Math.min(0.5, game.vx * 0.35 + carveDir * 0.22 + steerLean * FEEL.rollNow));
      // 発進の瞬間だけ強く、その後は控えめに（走路の先と人物を見やすく）
      const boostFeel = auraStrength(game.boostT, view.boost || 0);
      drawBoostAura(cx, baseY, unit, { strength: boostFeel, time: game.t });
      // 稲妻の絵（DSR100）: 腰のあたりを中心に体のまわり（中央は空いている。走路の先＝頭の上へは広げない）。発進の瞬間は濃く、その後は少し抑える。
      // 1コマごとに向きを変えて、ばちばち走らせる
      if (boostFeel > 0.02 && !reducedMotion) {
        const tick = Math.floor(game.t * FEEL.flicker), start = Math.min(1, Math.max(0, 1 - (game.t - auraStartT) / FEEL.auraBurst));
        const alpha = Math.min(1, boostFeel * 2) * (FEEL.boostBoltsHold + (FEEL.boostBoltsStart - FEEL.boostBoltsHold) * start) * (0.8 + 0.2 * ((tick * 7) % 3) / 2);
        drawFx("fxBolts", cx, baseY - unit * 0.7, unit * FEEL.boostBoltsWide * (0.94 + 0.12 * ((tick * 5) % 4) / 3), { flip: tick % 2 === 1, rotate: (tick % 4) * Math.PI / 2, alpha });
      }
      // 姿勢の絵（第4弾の差分）があれば、それを板の重心で立たせる。傾きは絵がもう描いているので少しだけ
      const shownVx = steerLean ? steerLean * Math.max(FEEL.leanNow, Math.abs(game.vx)) : game.vx + carveDir * 0.4;
      pose = riderPose({ fallT: game.fallT, air: game.air, airKind: game.airKind, landingPress: game.landingPress, landedAt: game.landedAt, t: game.t, vx: shownVx }, pose);
      const poseArt = art.get(pose), baseArt = art.get("rider");
      // 空中トリック: 縦の軸で回る（絵を横に縮めて裏返す）。2026-11-13 オーナー「左右に向くだけであんまり回ってる感がない」で、
      // 体を巻くつむじ風の輪（奥の半分は人物の後ろ、手前の半分は前）、少し前の向きの残像、回転に合わせた体のひねりを足した
      const spinning = game.spinDir !== 0 || Math.abs(game.rot) > 0.001;
      const spinX = spinScaleX(game.rot, spinning);
      const spinTilt = spinning && !reducedMotion ? Math.sin(game.rot * Math.PI * 2) * FEEL.spinTilt * (game.spinDir || 1) : 0;
      if (spinning) drawSpinWhirl(cx, baseY, unit, game.rot, game.spinDir || Math.sign(game.rot) || 1, "back");
      if (poseArt && baseArt) {
        // 回転姿（Issue #3563・はじめ）: 空中トリックの間は角度ごとの絵をクロスフェードで切り替える。
        // 必要な絵がまだ届いていない時は、このまま下の「縮めて裏返す」描き方に倒れる。
        if (spinning && pose === "riderJump" && game.spinDir !== 0) {
          const cur = spinFrames(game.rot);
          const fromImg = art.get(cur.from.name), toImg = art.get(cur.to.name);
          if (fromImg && toImg) {
            const drawSpin = (frame, image, alpha) => {
              const d = DESERT_ART[frame.name];
              const h = unit * 2.45 * image.naturalHeight / baseArt.naturalHeight, w = h * image.naturalWidth / image.naturalHeight;
              ctx.save();
              ctx.globalAlpha = alpha;
              ctx.translate(cx, baseY);
              ctx.rotate(lean * 0.12 + spinTilt);
              if (game.air > 0) ctx.translate(0, -Math.sin(airT * Math.PI) * unit * 0.1);
              ctx.scale((frame.flip ? -1 : 1) * squash[0], squash[1]);
              const ax = frame.flip ? 1 - d.anchor.x : d.anchor.x;
              ctx.drawImage(image, -ax * w, -d.anchor.y * h, w, h);
              ctx.restore();
            };
            if (!reducedMotion) {
              for (let k = FEEL.spinGhosts; k >= 1; k--) {
                const g = spinFrames(game.rot - Math.sign(game.rot || game.spinDir) * FEEL.spinGhostStep * k).from;
                const gImg = art.get(g.name);
                if (gImg) drawSpin(g, gImg, 0.32 - 0.08 * k);
              }
            }
            drawSpin(cur.from, fromImg, 1);
            if (cur.fade > 0) drawSpin(cur.to, toImg, cur.fade);
            drawSpinWhirl(cx, baseY, unit, game.rot, game.spinDir || Math.sign(game.rot) || 1, "front");
            return;
          }
        }
        const def = DESERT_ART[pose];
        // 大きさは背面Bの高さ（unit×2.45）に対する比。どの姿勢も同じ縮尺で描かれている
        const dh = unit * 2.45 * poseArt.naturalHeight / baseArt.naturalHeight, dw = dh * poseArt.naturalWidth / poseArt.naturalHeight;
        const sprite = (alpha, dy, grow, image = poseArt, dx = 0) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx + dx, baseY + dy);
          if (game.fallT > 0) ctx.rotate((game.x > 0 ? 1 : -1) * 0.25 * (game.fallT / 1.1));
          else {
            ctx.rotate(lean * (pose === "rider" ? 0.45 : 0.12) + spinTilt);
            if (game.air > 0) ctx.translate(0, -Math.sin(airT * Math.PI) * unit * 0.1);
          }
          ctx.scale((spinXOverride ?? spinX) * grow * squash[0], grow * squash[1]);
          ctx.drawImage(image, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh);
          ctx.restore();
        };
        let spinXOverride = null;
        // カービングの金の残像（2026-11-25「もっとかっこよく」）: 熱が高まると、カーブの外・後ろへずれた金色の写しが尾を引く。動き軽減では出さない
        const ghostDir = Math.sign(curveAt(game.course, game.z));
        if (ghostDir && carveFx.heat > FEEL.carveGhostFrom && carveFx.off === 0 && !reducedMotion && game.air <= 0 && game.fallT <= 0) {
          const h = (carveFx.heat - FEEL.carveGhostFrom) / (1 - FEEL.carveGhostFrom);
          ctx.save(); ctx.globalCompositeOperation = "lighter"; // 金の写しは光として重ねる
          for (let k = FEEL.carveGhosts; k >= 1; k--) {
            sprite(h * (0.38 - 0.1 * k), unit * 0.08 * k, 1 + 0.02 * k, tintedArt(poseArt, k === 1 ? CARVE_GOLD.mid : CARVE_GOLD.rim), -ghostDir * unit * 0.32 * k);
          }
          ctx.restore();
        }
        // 炎色の残像（手前・外側へずれて大きく薄く）。動き軽減では出さない
        boostAfterimages(poseArt, cx, baseY, unit, boostFeel, AURAS.player, (image, alpha, dx, dy, grow) => sprite(alpha, dy, grow, image, dx));
        // 回転の残像: 少し前の向きの絵を薄く重ねる（回転のぶれ）
        if (spinning && !reducedMotion && game.spinDir !== 0) {
          for (let k = FEEL.spinGhosts; k >= 1; k--) {
            spinXOverride = spinScaleX(game.rot - Math.sign(game.rot || game.spinDir) * FEEL.spinGhostStep * k, true);
            sprite(0.32 - 0.08 * k, 0, 1);
          }
          spinXOverride = null;
        }
        sprite(1, 0, 1);
        if (spinning) drawSpinWhirl(cx, baseY, unit, game.rot, game.spinDir || Math.sign(game.rot) || 1, "front");
        return;
      }
      ctx.save();
      ctx.translate(cx, baseY);
      ctx.scale(spinX * squash[0], squash[1]);
      if (game.fallT > 0) {
        // 転倒: 砂の上に転がって、起き上がる
        const k = 1 - game.fallT / 1.1;
        ctx.rotate((1 - k) * (game.x > 0 ? 1 : -1) * 1.2 + Math.sin(k * Math.PI) * 0.3);
        ctx.translate(0, (1 - k) * unit * 0.3);
      } else {
        ctx.rotate(lean * 0.9);
        if (game.air > 0) ctx.translate(0, -Math.sin(airT * Math.PI) * unit * 0.1);
      }
      const crouch = game.air > 0 && game.landingPress !== null ? 0.86 : game.air > 0 ? 0.94 : 1;
      const riderArt = art.get("rider");
      if (riderArt) {
        // 背面の1枚を、板の重心を軸に傾け・縮めて、左右・空中・着地の構え・転倒を表す
        if (game.fallT <= 0) ctx.rotate(-lean * 0.35); // 絵は回転を少なめに（図形の 0.9 と合わせて約 0.55）
        ctx.scale(1, crouch);
        const dh = unit * 2.45, dw = dh * riderArt.naturalWidth / riderArt.naturalHeight, { x: ax, y: ay } = DESERT_ART.rider.anchor;
        ctx.drawImage(riderArt, -ax * dw, -ay * dh, dw, dh);
        ctx.restore();
        return;
      }
      // 板
      ctx.fillStyle = mixColor([246, 120, 60], [226, 100, 60], dusk);
      ctx.beginPath(); ctx.ellipse(0, -unit * 0.05, unit * 0.62, unit * 0.11, lean * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.ellipse(0, -unit * 0.07, unit * 0.5, unit * 0.045, lean * 0.4, 0, Math.PI * 2); ctx.fill();
      // 脚（左右に開いて板に乗る）
      ctx.fillStyle = "#3a3340";
      ctx.fillRect(-unit * 0.26, -unit * 0.72 * crouch, unit * 0.16, unit * 0.68 * crouch);
      ctx.fillRect(unit * 0.1, -unit * 0.72 * crouch, unit * 0.16, unit * 0.68 * crouch);
      // 胴（背中）
      const torsoH = unit * 0.78 * crouch;
      ctx.fillStyle = mixColor([246, 240, 226], [240, 212, 190], dusk);
      ctx.beginPath(); ctx.moveTo(-unit * 0.32, -unit * 0.7 * crouch); ctx.lineTo(-unit * 0.36, -unit * 0.7 * crouch - torsoH); ctx.lineTo(unit * 0.36, -unit * 0.7 * crouch - torsoH); ctx.lineTo(unit * 0.32, -unit * 0.7 * crouch); ctx.closePath(); ctx.fill();
      // 腕（バランスを取って外へ）
      ctx.strokeStyle = mixColor([236, 200, 170], [224, 176, 150], dusk); ctx.lineWidth = Math.max(2, unit * 0.11); ctx.lineCap = "round";
      const armY = -unit * 0.7 * crouch - torsoH * 0.9, spread = game.air > 0 ? 1.15 : 0.8 + Math.abs(lean);
      ctx.beginPath(); ctx.moveTo(-unit * 0.34, armY); ctx.lineTo(-unit * 0.34 - unit * 0.42 * spread, armY + unit * (game.air > 0 ? -0.1 : 0.22)); ctx.moveTo(unit * 0.34, armY); ctx.lineTo(unit * 0.34 + unit * 0.42 * spread, armY + unit * (game.air > 0 ? -0.1 : 0.22)); ctx.stroke();
      // 頭（黒髪・後頭部）
      ctx.fillStyle = "#2a2430";
      ctx.beginPath(); ctx.arc(0, -unit * 0.7 * crouch - torsoH - unit * 0.26, unit * 0.27, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawParticles() {
      const p = placeAt(game.z, game.x);
      if (!p) return;
      for (const s of particles) {
        if (!s.confetti) continue;
        // 紙吹雪: ひらひら裏返りながら（縦に潰れて見える）落ちる
        ctx.save(); ctx.translate(p.x + s.x + Math.sin(s.age * 7 + s.sway) * 10, p.y + s.y); ctx.rotate(s.age * s.spin * 0.4 + s.sway);
        ctx.globalAlpha = Math.min(1, 2.2 * (1 - s.age / s.life));
        ctx.fillStyle = s.color; ctx.fillRect(-s.r, -s.r * 0.5 * Math.cos(s.age * s.spin), s.r * 2, s.r * Math.cos(s.age * s.spin));
        ctx.restore();
      }
      for (const s of particles) {
        if (!s.chip) continue;
        ctx.save(); ctx.translate(p.x + s.x, p.y + s.y); ctx.rotate(s.age * s.spin);
        ctx.globalAlpha = Math.min(1, 1.4 * (1 - s.age / s.life));
        ctx.fillStyle = "#6b4a36"; ctx.fillRect(-s.r, -s.r * 0.7, s.r * 2, s.r * 1.4);
        ctx.fillStyle = "#a07a58"; ctx.fillRect(-s.r, -s.r * 0.7, s.r, s.r * 0.6);
        ctx.restore();
      }
      // カービングの砂の筋（速さの向きに伸びる線）
      ctx.lineCap = "round";
      for (const s of particles) {
        if (!s.streak) continue;
        const k = 1 - s.age / s.life, x = p.x + s.x, y = p.y + s.y;
        ctx.strokeStyle = `rgba(255,236,190,${0.75 * k})`; ctx.lineWidth = s.r;
        ctx.beginPath(); ctx.moveTo(x - s.vx * 0.045, y - s.vy * 0.045); ctx.lineTo(x, y); ctx.stroke();
      }
      // 跳ね上げた砂つぶ（DSR99）: 濃い砂色の短い線。明るい砂の上でも空の前でも見えるよう、影の色の芯に明るい縁を重ねる
      for (const [color, widthK, back] of [["184,128,66", 1.25, 0.034], ["248,220,160", 0.6, 0.022]]) {
        for (const s of particles) {
          if (!s.grain) continue;
          const k = 1 - s.age / s.life, x = p.x + s.x, y = p.y + s.y;
          ctx.strokeStyle = `rgba(${color},${Math.min(1, 1.5 * k)})`; ctx.lineWidth = s.r * widthK;
          ctx.beginPath(); ctx.moveTo(x - s.vx * back, y - s.vy * back); ctx.lineTo(x, y); ctx.stroke();
        }
      }
      // カービングのきらめく砂粒（金の点）
      for (const s of particles) {
        if (!s.spark) continue;
        ctx.fillStyle = `rgba(255,${200 + Math.round(48 * (1 - s.age / s.life))},120,${Math.min(1, 1.6 * (1 - s.age / s.life))})`;
        ctx.beginPath(); ctx.arc(p.x + s.x, p.y + s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      const puff = art.get("puff");
      if (puff) {
        const aspect = puff.naturalHeight / puff.naturalWidth;
        for (const s of particles) {
          if (s.chip || s.confetti || s.spark || s.streak || s.grain) continue;
          const w = s.r * 2.8, h = w * aspect;
          ctx.globalAlpha = Math.min(1, 0.75 * (1 - s.age / s.life));
          ctx.drawImage(puff, p.x + s.x - w / 2, p.y + s.y - h / 2, w, h);
        }
        ctx.globalAlpha = 1;
        return;
      }
      for (const s of particles) {
        if (s.chip || s.confetti || s.spark || s.streak || s.grain) continue;
        const a = 0.55 * (1 - s.age / s.life);
        ctx.fillStyle = `rgba(242,220,178,${a})`;
        ctx.beginPath(); ctx.arc(p.x + s.x, p.y + s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    /** スピード線: 消失点から外へ流れる白い線。速いほど多く長く、ブースト中も白い風の線。中央（コースと人物）は常に空ける。 */
    function drawSpeedLines() {
      if (reducedMotion || !game || countdown > 0) return;
      const k = Math.min(1, Math.max(0, (game.speed - SPEED.min) / (SPEED_FULL - SPEED.min)));
      const feel = view.boost || 0;
      // 大ジャンプの間は、遅くても風の線が流れる（頂点で最も多い。DSR99）
      const airK = game.air > 0 && game.airKind === "big" && game.airTotal > 0 ? Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - game.air / game.airTotal))) : 0;
      if (k < 0.3 && feel < 0.05 && airK < 0.05) return;
      const amount = Math.min(1.15, (k < 0.3 ? 0 : (k - 0.3) / 0.7) + 0.85 * feel + FEEL.airLines * airK);
      const n = Math.min(streaks.length, Math.round(14 + 48 * amount)), cx = W / 2, cy = GROUND_Y + 40, reach = Math.hypot(W, H) * 0.66;
      ctx.save();
      // 横幅の中央56%には速度線を描かず、先の岩と着地点を見せる。
      const clipLeft = W * 0.22, clipRight = W * 0.78;
      ctx.beginPath(); ctx.rect(0, 0, clipLeft, H); ctx.rect(clipRight, 0, clipLeft, H); ctx.clip();
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const s = streaks[i];
        const travel = (s.phase + game.t * (0.9 + 1.6 * k + 1.8 * feel)) % 1;
        const r0 = (feel > 0.3 ? 160 : 240) + travel * reach, r1 = r0 + (60 + 220 * amount + 80 * feel) * s.len * (0.4 + travel);
        const ca = Math.cos(s.angle), sa = Math.sin(s.angle) * 0.62;
        const x0 = cx + ca * r0, x1 = cx + ca * r1, y0 = cy + sa * r0, y1 = cy + sa * r1;
        const width = s.w * (0.6 + travel * 1.6 + feel), pad = width / 2 + 1;
        // 丸い線端と補間の 1px を含めても、クリップから完全に外れた線だけ省く。
        const minX = Math.min(x0, x1) - pad, maxX = Math.max(x0, x1) + pad;
        if (maxX <= 0 || minX >= W || (minX >= clipLeft && maxX <= clipRight)) continue;
        if (Math.max(y0, y1) + pad <= 0 || Math.min(y0, y1) - pad >= H) continue;
        const alpha = (0.3 + 0.1 * feel) * amount * Math.sin(travel * Math.PI);
        ctx.strokeStyle = `rgba(240,250,255,${alpha})`; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      // 画面端からの流れ（ブースト中だけ。中央の走路は空けたまま）
      if (feel > 0.12) {
        for (let i = 0; i < 10; i++) {
          const side = i < 5 ? -1 : 1, u = ((game.t * (2.4 + feel) + i * 0.17) % 1);
          const y = 80 + (H - 100) * ((i % 5) / 4);
          const len = 70 + 160 * feel * (0.4 + u);
          const x0 = side < 0 ? 0 : W;
          ctx.strokeStyle = `rgba(240,250,255,${0.18 * feel * (1 - u)})`;
          ctx.lineWidth = 2 + 3 * feel;
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 - side * len, y + (y - H * 0.55) * 0.08); ctx.stroke();
        }
      }
      ctx.restore();
    }
    /** 速いほど画面の縁を少し暗く。ブーストでも炎色にしない。
     * グラデーションは強さの段階ごとに焼いて使い回し、毎フレームは不透明度つきで貼るだけ（2026-11-14 軽量化）。 */
    const vignetteCache = new Map();
    function vignetteLayer(bucket) {
      let layer = vignetteCache.get(bucket);
      if (!layer) {
        const vw = W / 4, vh = H / 4;
        layer = document.createElement("canvas"); layer.width = vw; layer.height = vh;
        const g = layer.getContext("2d"), grad = g.createRadialGradient(vw / 2, vh * 0.55, vh * (0.42 - 0.08 * bucket * 0.5), vw / 2, vh * 0.55, vh * 1.05);
        grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(40,30,25,1)");
        g.fillStyle = grad; g.fillRect(0, 0, vw, vh);
        vignetteCache.set(bucket, layer);
      }
      return layer;
    }
    function drawVignette(fast) {
      const feel = view.boost || 0;
      const a = (reducedMotion ? 0.12 : 0.34) * fast + 0.06 * feel;
      if (a < 0.02) return;
      const bucket = feel >= 0.5 ? 1 : 0; // 内側の半径はブースト量で 2 段階だけ（見た目の差はほぼ無い）
      ctx.save(); ctx.globalAlpha = a; ctx.drawImage(vignetteLayer(bucket), 0, 0, W, H); ctx.restore();
    }
    /** 着地の衝撃の輪（砂の上に広がる楕円）。 */
    function drawRings() {
      const p = placeAt(game.z, game.x);
      if (!p || !rings.length) return;
      const unit = p.scale * (H / 2);
      for (const r of rings) {
        // 着地の出来は足元の輪の色でも分かる: 完璧＝金の二重、良い＝白、ふつう＝薄い砂色（細い）。ブースト・立て直しの輪は白
        // 砂流れに乗った輪は、流れる砂と同じ明るい砂色
        const k = r.age / r.life, tone = r.grade === "perfect" ? "255,206,72" : r.grade === "plain" ? "236,214,170" : r.grade === "flow" ? "255,232,170" : "255,248,230";
        const weight = r.grade === "plain" ? 0.6 : 1;
        ctx.strokeStyle = `rgba(${tone},${(r.grade === "perfect" ? 0.95 : 0.8) * weight * (1 - k)})`;
        ctx.lineWidth = Math.max(2, unit * 0.12 * (1 - k)) * r.power * weight;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, unit * (0.5 + 2.4 * k) * r.power, unit * (0.12 + 0.5 * k) * r.power, 0, 0, Math.PI * 2); ctx.stroke();
        if (r.grade === "perfect") {
          ctx.strokeStyle = `rgba(255,246,206,${0.9 * (1 - k)})`; ctx.lineWidth = Math.max(1.5, unit * 0.06 * (1 - k));
          ctx.beginPath(); ctx.ellipse(p.x, p.y, unit * (0.3 + 1.5 * k) * r.power, unit * (0.07 + 0.31 * k) * r.power, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
    /** 得点の浮き出し。人物の頭の上から少しずつ上がって消える。 */
    function drawFloaters() {
      const p = placeAt(game.z, game.x);
      if (!p || !floaters.length) return;
      const unit = p.scale * (H / 2);
      ctx.save();
      ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      const colors = { trick: "#ffe27a", perfect: "#fff1a8", good: "#c6f0ff", near: "#ffd4a8", smash: "#ffb07a", gauge: "#ffcf5a", race: "#ffe27a", jump: "#ffffff", recover: "#9dffb0", carve: "#ffd75a", behind: "#d6dcf0" };
      // 人物の右上に、新しいものほど下へ積む（真ん中の大きな文字と HUD に重ねない）
      // 縦は横に字を置く幅が無いので、人物と反対の側の、見えている端に寄せて出す（端で切れない）
      const left = portrait ? p.x > W / 2 : p.x > W * 0.62;
      const edge = portrait ? W / 2 + (left ? -1 : 1) * (safeHalf - 30) : null;
      ctx.textAlign = portrait ? (left ? "left" : "right") : left ? "right" : "left";
      floaters.forEach((f, i) => {
        const k = f.age / f.life, size = f.kind === "trick" || f.kind === "race" || f.kind === "carve" ? 32 : 24;
        ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
        ctx.font = `900 ${size}px ${fontFamily()}`;
        const row = floaters.length - 1 - i;
        const x = edge ?? p.x + (left ? -1 : 1) * unit * 0.9, y = Math.max(190, p.y - unit * 1.2 - row * 34 - k * 40);
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(70,34,20,0.75)"; ctx.strokeText(f.text, x, y);
        ctx.fillStyle = colors[f.kind] || "#fff"; ctx.fillText(f.text, x, y);
      });
      ctx.restore();
    }
    /** 本番の競走相手。ヌールは専用画像、なると画像未読込時は図形を使う。 */
    /** 回転中の横幅の倍率（cos）。横向きの瞬間でも細い線にならないよう FEEL.spinMinWidth で止める。 */
    function spinScaleX(rot, spinning) {
      if (!spinning) return 1;
      const c = Math.cos(rot * Math.PI * 2), min = FEEL.spinMinWidth;
      return Math.abs(c) < min ? (c < 0 ? -min : min) : c;
    }
    /**
     * 回転のつむじ風: 腰と胸の高さで体を巻く2本の輪。輪の上を明るい弧が回転の向きへ走る。
     * half="back" は奥の半分（人物の後ろ）、"front" は手前の半分（人物の前）を描き、輪が人物を巻いて見える。動き軽減では細い輪だけ。
     */
    function drawSpinWhirl(cx, baseY, unit, rot, dir, half) {
      const front = half === "front", turn = rot * Math.PI * 2;
      ctx.save();
      ctx.lineCap = "round";
      for (const [h, rx, ry, w] of [[0.75, 0.95, 0.24, 0.09], [1.35, 0.8, 0.2, 0.07]]) {
        const y = baseY - unit * h;
        // 輪の芯（薄く）
        ctx.strokeStyle = `rgba(255,255,255,${front ? 0.22 : 0.14})`; ctx.lineWidth = Math.max(1.5, unit * w * 0.5);
        ctx.beginPath(); ctx.ellipse(cx, y, unit * rx, unit * ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); ctx.stroke();
        if (reducedMotion) continue;
        // 回転の向きへ走る明るい弧（3本）。手前の半分と奥の半分で、見えている所だけ描く
        for (let i = 0; i < 3; i++) {
          const a0 = (dir * turn * 1.6 + i * (Math.PI * 2 / 3) + h) % (Math.PI * 2), len = 1.1;
          for (const [width, color] of [[w * 1.8, "rgba(255,255,255,0.22)"], [w, "rgba(255,255,255,0.85)"]]) {
            ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, unit * width);
            const from = a0, to = a0 + len * dir;
            const lo = Math.min(from, to), hi = Math.max(from, to);
            // 画面の下側（sin>0）が手前、上側が奥
            const steps = 10; let open = false;
            ctx.beginPath();
            for (let k = 0; k <= steps; k++) {
              const a = lo + (hi - lo) * k / steps, isFront = Math.sin(a) >= 0;
              if (isFront === front) { const px = cx + Math.cos(a) * unit * rx, py = y + Math.sin(a) * unit * ry; if (!open) { ctx.moveTo(px, py); open = true; } else ctx.lineTo(px, py); }
              else open = false;
            }
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    /** カーブの合図: 人物の横に、切り込む向き（カーブの内側）の矢印3つと短い一言。矢印は内側へ流れる。 */
    /**
     * カービングの砂の壁（2026-11-25 オーナー「カービングに演出を入れたい」）: 板の外側の縁から、カーブの外へ向けて弧を描いて噴き上がる砂の幕。
     * 切り込み続けるほど（heat）高く長く濃くなり、幕の中を砂の筋が外へ流れる。動き軽減では筋を止める。人物の後ろに描く。
     */
    function drawCarveWall(cx, groundY, unit, side, heat) {
      const out = -side, t = reducedMotion ? 0 : game.t;
      const x0 = cx + out * unit * 0.3, len = unit * (0.9 + 1.4 * heat), rise = unit * (0.5 + 1.3 * heat);
      const tipX = x0 + out * len, tipY = groundY - rise, endX = x0 + out * len * 1.25, endY = groundY - rise * 0.15;
      ctx.save();
      const sheet = ctx.createLinearGradient(x0, groundY, tipX, tipY);
      // 日に照らされた砂は地面より明るい（地面と同じ色だと溶けて見えない）。下の縁に薄い影を付けて厚みを出す
      sheet.addColorStop(0, `rgba(255,236,196,${0.72 * heat})`); sheet.addColorStop(0.5, `rgba(255,244,214,${0.48 * heat})`); sheet.addColorStop(1, "rgba(255,248,226,0)");
      const outline = () => {
        ctx.beginPath();
        ctx.moveTo(x0, groundY);
        ctx.quadraticCurveTo(x0 + out * len * 0.35, groundY - rise * 0.95, tipX, tipY);
        ctx.quadraticCurveTo(x0 + out * len * 1.15, tipY + rise * 0.25, endX, endY);
        ctx.quadraticCurveTo(x0 + out * len * 0.6, groundY - rise * 0.12, x0, groundY);
      };
      // 幕は大きさを少しずつ変えて3枚重ね、縁をぼかす（1枚だと縁が硬く図形に見える）
      for (const [grow, alpha] of [[1.12, 0.35], [1, 0.6], [0.86, 0.8]]) {
        ctx.save(); ctx.translate(x0, groundY); ctx.scale(grow, grow); ctx.translate(-x0, -groundY);
        ctx.globalAlpha = alpha; ctx.fillStyle = sheet; outline(); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = `rgba(150,96,48,${0.22 * heat})`; ctx.lineWidth = Math.max(1.5, unit * 0.04);
      ctx.beginPath(); ctx.moveTo(x0, groundY); ctx.quadraticCurveTo(x0 + out * len * 0.6, groundY - rise * 0.12, endX, endY); ctx.stroke();
      // 幕の中を外へ流れる砂の筋（3本・夕日で金に光る縁）
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const u = (t * 2.4 + i / 3) % 1, a = Math.sin(u * Math.PI) * heat;
        const bx = x0 + out * len * (0.15 + 0.8 * u), by = groundY - rise * (0.2 + 0.7 * Math.sin(u * Math.PI * 0.9));
        ctx.strokeStyle = `rgba(255,236,170,${0.7 * a})`; ctx.lineWidth = Math.max(1.5, unit * 0.035);
        ctx.beginPath(); ctx.moveTo(bx - out * unit * 0.22, by + rise * 0.1); ctx.lineTo(bx + out * unit * 0.12, by - rise * 0.06); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(255,224,140,${0.55 * heat})`; ctx.lineWidth = Math.max(1.2, unit * 0.025);
      ctx.beginPath(); ctx.moveTo(x0 + out * len * 0.25, groundY - rise * 0.62); ctx.quadraticCurveTo(x0 + out * len * 0.55, groundY - rise * 1.02, tipX, tipY); ctx.stroke();
      ctx.restore();
    }
    /** 刻みの演出を起こす: 板の外の縁のきらめき・刻んだ線を走る光・外へ扇に散る砂の筋（big は熱が満ちた瞬間）。 */
    function carveCut(dir, big) {
      carveFx.glints.push({ age: 0, life: FEEL.carveGlint * (big ? 1.6 : 1), dir, big });
      carveFx.runs.push({ age: 0, life: FEEL.carveRun * (big ? 1.4 : 1), big });
      const out = -dir, n = reducedMotion ? 0 : Math.round(FEEL.carveBurst * (big ? 2 : 1)); // 動き軽減では砂の筋を飛ばさない
      for (let i = 0; i < n; i++) {
        // 扇: 外へ低く鋭く。上へは少しだけ（砂を切って横へ飛ばす）
        const a = (Math.random() * 0.7 + 0.1) * Math.PI / 2, v = 420 + Math.random() * 520;
        particles.push({ streak: true, x: out * (18 + Math.random() * 16), y: -4, vx: out * Math.cos(a) * v, vy: -Math.sin(a) * v, r: 1.4 + Math.random() * 2.4, life: 0.2 + Math.random() * 0.18, age: 0 });
      }
    }
    /**
     * 刻みのきらめき（2026-11-25「輪なのがなんか違う」で、輪・楕円の光から替えた）: 板の外の縁（砂を噛む所）が一瞬、
     * 横に長い十字の光でキラッと光る。加算で光らせる。熱が満ちた瞬間は大きく長い。動き軽減でも出す（短い一瞬の光）。
     */
    function drawCarveGlints(cx, groundY, unit) {
      if (!carveFx.glints.length) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (const glint of carveFx.glints) {
        const k = glint.age / glint.life, size = glint.big ? 1.7 : 1;
        const fade = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75;
        const x = cx - glint.dir * unit * 0.34, y = groundY - unit * 0.06;
        const long = unit * (0.42 + 0.25 * k) * size, short = unit * 0.22 * size;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, unit * 0.32 * size);
        glow.addColorStop(0, `rgba(255,240,190,${0.9 * fade})`); glow.addColorStop(1, "rgba(255,170,60,0)");
        ctx.fillStyle = glow; ctx.fillRect(x - unit * 0.4 * size, y - unit * 0.4 * size, unit * 0.8 * size, unit * 0.8 * size);
        // 細く尖った光の筋（横に長く、縦に短く）。外の色は金、芯は白
        for (const [w, color] of [[unit * 0.05 * size, `rgba(255,176,60,${0.7 * fade})`], [unit * 0.018 * size, `rgba(255,252,236,${fade})`]]) {
          ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, w * fade);
          ctx.beginPath(); ctx.moveTo(x - long, y); ctx.lineTo(x + long, y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, y - short); ctx.lineTo(x, y + short * 0.6); ctx.stroke();
        }
      }
      ctx.restore();
    }
    /** カーブの外側の画面の縁から、金の風の線が流れ込む（切り込みの熱が高い間）。中央の走路は空けたまま。動き軽減では出さない。 */
    function drawCarveEdgeLines() {
      const heat = carveFx.heat;
      if (reducedMotion || !game || heat < 0.3 || !game.carving) return;
      const out = -(Math.sign(curveAt(game.course, game.z)) || 1), n = Math.round(FEEL.carveEdgeLines * heat);
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const u = (game.t * (2.2 + 0.4 * (i % 3)) + i * 0.37) % 1, y = 150 + (H - 260) * ((i * 0.618) % 1);
        const x0 = out > 0 ? W - u * W * 0.2 : u * W * 0.2, len = (80 + 160 * heat) * (1 - u);
        ctx.strokeStyle = `rgba(255,206,110,${0.32 * heat * Math.sin(u * Math.PI)})`; ctx.lineWidth = 2 + 3 * heat;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + out * len, y + 10); ctx.stroke();
      }
      ctx.restore();
    }
    function drawCurveCue(cx, cy, unit, dir) {
      if (!dir) return;
      const t = reducedMotion ? 0 : performance.now() / 1000, size = Math.max(14, Math.min(34, unit * 0.22));
      ctx.save();
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (let i = 0; i < 3; i++) {
        const phase = ((t * 1.6 + i / 3) % 1), x = cx + dir * (unit * 0.7 + phase * unit * 0.9), a = Math.sin(phase * Math.PI);
        ctx.strokeStyle = `rgba(80,40,10,${0.5 * a})`; ctx.lineWidth = size * 0.42;
        ctx.beginPath(); ctx.moveTo(x - dir * size * 0.45, cy - size * 0.6); ctx.lineTo(x + dir * size * 0.25, cy); ctx.lineTo(x - dir * size * 0.45, cy + size * 0.6); ctx.stroke();
        ctx.strokeStyle = `rgba(255,226,120,${0.95 * a})`; ctx.lineWidth = size * 0.22;
        ctx.beginPath(); ctx.moveTo(x - dir * size * 0.45, cy - size * 0.6); ctx.lineTo(x + dir * size * 0.25, cy); ctx.lineTo(x - dir * size * 0.45, cy + size * 0.6); ctx.stroke();
      }
      ctx.restore();
    }
    /** HUD の上の面に、ゲージへ飛ぶ光の粒を描く。行き先は、ゲージの今の端。
     * 矩形は ResizeObserver で保持し、毎フレーム getBoundingClientRect を読まない（書いた直後に読むと強制同期レイアウトになる。2026-11-14 軽量化）。 */
    let orbRects = null, orbRectsDirty = true, orbCanvasDirty = false;
    function clearOrbCanvas() {
      if (!orbCanvasDirty) return;
      fxCtx.clearRect(0, 0, W, H);
      orbCanvasDirty = false;
    }
    function drawOrbs() {
      clearOrbCanvas();
      if (hudNodes?.gaugeBox) { const gain = gaugePulseT > 0 ? "on" : ""; if (hudNodes.gaugeBox.dataset.gain !== gain) hudNodes.gaugeBox.dataset.gain = gain; }
      if (!orbs.length || !hudNodes?.gaugeBox) return;
      if (orbRectsDirty || !orbRects) {
        const cr = canvas.getBoundingClientRect(), gr = hudNodes.gaugeBox.getBoundingClientRect();
        orbRects = { cr: { left: cr.left, top: cr.top, width: cr.width, height: cr.height }, gr: { left: gr.left, top: gr.top, width: gr.width, height: gr.height } };
        orbRectsDirty = false;
        if (typeof ResizeObserver !== "undefined" && !drawOrbs._ro) { drawOrbs._ro = new ResizeObserver(() => { orbRectsDirty = true; }); drawOrbs._ro.observe(canvas); drawOrbs._ro.observe(hudNodes.gaugeBox); }
      }
      const { cr, gr } = orbRects;
      if (!cr.width || !gr.width) return;
      const sx = W / cr.width, sy = H / cr.height;
      const fill = Math.max(0.04, Math.min(1, game.boostT > 0 ? game.boostT / 3 : game.gauge));
      const tx = (gr.left + gr.width * fill - cr.left) * sx, ty = (gr.top + gr.height / 2 - cr.top) * sy;
      fxCtx.save();
      fxCtx.lineCap = "round"; fxCtx.lineJoin = "round";
      for (const o of orbs) {
        if (o.age < 0) continue;
        orbCanvasDirty = true;
        const k = Math.min(1, o.age / o.life), e = k * k; // 加速しながらゲージへ吸い込まれる
        const cx = (o.x0 + tx) / 2 + o.bend, cy = Math.min(o.y0, ty) - o.lift;
        const x = (1 - e) * (1 - e) * o.x0 + 2 * (1 - e) * e * cx + e * e * tx, y = (1 - e) * (1 - e) * o.y0 + 2 * (1 - e) * e * cy + e * e * ty;
        // 尾（直前の数コマの位置）: 濃い縁の上に金の線。明るい砂・空の上でも見える
        o.trail.push([x, y]); if (o.trail.length > 6) o.trail.shift();
        if (o.trail.length > 1) {
          for (const [w, color] of [[9, "rgba(120,52,8,0.35)"], [5, "rgba(255,186,60,0.85)"]]) {
            fxCtx.strokeStyle = color; fxCtx.lineWidth = w * (1 - 0.3 * k);
            fxCtx.beginPath(); o.trail.forEach(([px, py], i) => (i ? fxCtx.lineTo(px, py) : fxCtx.moveTo(px, py))); fxCtx.stroke();
          }
        }
        const r = 11 * (1 - 0.3 * k), glow = fxCtx.createRadialGradient(x, y, 0, x, y, r * 2.4);
        glow.addColorStop(0, "rgba(255,255,235,1)"); glow.addColorStop(0.3, "rgba(255,206,80,0.9)"); glow.addColorStop(1, "rgba(255,140,30,0)");
        fxCtx.fillStyle = glow; fxCtx.beginPath(); fxCtx.arc(x, y, r * 2.4, 0, Math.PI * 2); fxCtx.fill();
        fxCtx.strokeStyle = "rgba(130,60,10,0.6)"; fxCtx.lineWidth = 2;
        fxCtx.fillStyle = "#fffbe6"; fxCtx.beginPath(); fxCtx.arc(x, y, r * 0.55, 0, Math.PI * 2); fxCtx.fill(); fxCtx.stroke();
        if (k >= 0.96) gaugePulseT = 0.18; // 届いた瞬間、ゲージが光る
      }
      fxCtx.restore();
    }
    function drawRival(noor, dusk) {
      const look = RIVAL_LOOKS[raceWith] || RIVAL_LOOKS.noor, name = RIVAL_NAMES[raceWith];
      const p = placeAt(noor.z, noor.x);
      if (!p) return;
      const unit = p.scale * (H / 2);
      const height = shownHeight(noor), squash = squashOf(noor);
      const player = placeAt(game.z, game.x);
      const playerUnit = player?.scale * (H / 2);
      const playerHeight = shownHeight(game);
      const rivalBaseY = p.y - height * unit * 0.9;
      const playerBaseY = player?.y - playerHeight * playerUnit * 0.9;
      const overlapsPlayer = player && Math.abs(p.x - player.x) < (unit + playerUnit) * 0.7
        && rivalBaseY > playerBaseY - playerUnit * 2.45 && playerBaseY > rivalBaseY - unit * 2.45;
      ctx.save();
      if (overlapsPlayer) ctx.globalAlpha = 0.5;
      softShadow(p.x, p.y, unit * 0.56, unit * 0.15, 0.36 - height * 0.1);
      drawRivalBoardFx(p, unit);
      const lean = Math.max(-0.5, Math.min(0.5, noor.vx * 0.35));
      const bob = noor.air <= 0 && noor.fallT <= 0 ? Math.sin(noor.t * 13 + 1) * unit * 0.02 : 0;
      // 相手のブーストにもオーラ（ヌールは青緑、なるは紫）。追い抜かれる時に「加速している」と分かる
      const noorPose = `${raceWith}${riderPose(noor).replace(/^rider/, "Rider")}`;
      const noorArt = DESERT_ART[noorPose] ? art.get(noorPose) : null;
      const artScale = noorArt ? RIVAL_ART_SCALE[raceWith] ?? 1 : 0.86, palette = AURAS[raceWith] || AURAS.noor;
      // オーラ: 発進の瞬間（auraBurst 秒）だけ強く、その後は auraHold。追い上げ中（rivalSurge）も同じ強さで包む
      const sinceBoost = game.t - rivalFx.boostStartT, rivalBurst = sinceBoost < FEEL.auraBurst ? 1 - sinceBoost / FEEL.auraBurst : 0;
      const rivalBoost = Math.max(noor.boostT > 0 ? Math.min(1, noor.boostT / 0.3) * (FEEL.auraHold + (1 - FEEL.auraHold) * rivalBurst) : 0,
        !noor.finished ? rivalSurge() * FEEL.auraHold : 0), rivalY = p.y - height * unit * 0.9 + bob;
      if (rivalBoost > 0) drawBoostAura(p.x, rivalY, unit * artScale, { palette, strength: rivalBoost, time: noor.t, seed: 2.1 });
      ctx.save();
      ctx.translate(p.x, rivalY);
      // 空中の回転（なるの 720）は、主人公と同じく絵を横に縮めて裏返し、つむじ風の輪と残像を付ける
      const rivalSpinning = Math.abs(noor.rot || 0) > 0.001;
      const spinX = spinScaleX(noor.rot || 0, rivalSpinning);
      // 滑る姿の絵は `<相手>Rider…`（DESERT_ART）にあれば使う。読み込み前・失敗した時は下の図形で描く。
      // 絵は主人公の背面と同じ縮尺（rider の高さ768に対する比）で、身長の差は RIVAL_ART_SCALE で付ける
      if (noorArt) {
        // 回転姿（Issue #3563）: 空中トリックの間は、主人公と同じく角度ごとの絵をクロスフェードで切り替える。
        // 必要な絵がまだ届いていない時は、このまま下の「縮めて裏返す」描き方に倒れる。
        const spinBaseName = `${raceWith}RiderJump`;
        const spin = rivalSpinning && !reducedMotion && noorPose === spinBaseName && DESERT_ART[`${raceWith}Spin045`]
          ? spinFrames(noor.rot || 0, raceWith) : null;
        const spinBaseImg = spin ? art.get(spinBaseName) : null;
        const spinFromImg = spin ? art.get(spin.from.name) : null;
        const spinToImg = spin ? art.get(spin.to.name) : null;
        if (spin && spinBaseImg && spinFromImg && spinToImg) {
          const baseDef = DESERT_ART[spinBaseName];
          const baseDh = unit * 2.45 * artScale * spinBaseImg.naturalHeight / DESERT_ART.rider.size[1];
          const spinDir = Math.sign(noor.rot || 0) || 1;
          const drawSpinFrame = (f, alpha) => {
            const img = art.get(f.name), fdef = DESERT_ART[f.name];
            if (!img) return;
            const fdh = baseDh * fdef.size[1] / baseDef.size[1], fdw = fdh * img.naturalWidth / img.naturalHeight;
            ctx.save(); ctx.globalAlpha *= alpha;
            if (f.flip) ctx.scale(-1, 1);
            ctx.drawImage(img, -fdef.anchor.x * fdw, -fdef.anchor.y * fdh, fdw, fdh);
            ctx.restore();
          };
          ctx.save(); ctx.translate(-p.x, -rivalY); drawSpinWhirl(p.x, rivalY, unit * artScale, noor.rot, spinDir, "back"); ctx.restore();
          ctx.rotate(Math.sin(noor.rot * Math.PI * 2) * FEEL.spinTilt * spinDir);
          ctx.scale(squash[0], squash[1]);
          if (!reducedMotion) {
            for (let k = FEEL.spinGhosts; k >= 1; k--) {
              drawSpinFrame(spinFrames(noor.rot - spinDir * FEEL.spinGhostStep * k, raceWith).from, 0.32 - 0.08 * k);
            }
          }
          drawSpinFrame(spin.from, 1);
          if (spin.fade > 0) drawSpinFrame(spin.to, spin.fade);
          ctx.restore();
          drawSpinWhirl(p.x, rivalY, unit * artScale, noor.rot, spinDir, "front");
          ctx.restore();
          if (p.dz < 70) drawRivalName(name, look, p, height, unit);
          return;
        }
        const def = DESERT_ART[noorPose];
        const dh = unit * 2.45 * artScale * noorArt.naturalHeight / DESERT_ART.rider.size[1];
        const dw = dh * noorArt.naturalWidth / noorArt.naturalHeight;
        const rivalDir = Math.sign(noor.rot || 0) || 1, rivalTilt = rivalSpinning && !reducedMotion ? Math.sin(noor.rot * Math.PI * 2) * FEEL.spinTilt * rivalDir : 0;
        if (rivalSpinning) { ctx.save(); ctx.translate(-p.x, -rivalY); drawSpinWhirl(p.x, rivalY, unit * artScale, noor.rot, rivalDir, "back"); ctx.restore(); }
        if (noor.fallT > 0) ctx.rotate((noor.x > 0 ? 1 : -1) * 0.25 * (noor.fallT / 1.1));
        else ctx.rotate(lean * (noorPose.endsWith("Rider") ? 0.45 : 0.12) + rivalTilt);
        if (rivalSpinning && !reducedMotion) {
          for (let k = FEEL.spinGhosts; k >= 1; k--) {
            ctx.save(); ctx.globalAlpha *= 0.32 - 0.08 * k;
            ctx.scale(spinScaleX(noor.rot - rivalDir * FEEL.spinGhostStep * k, true) * squash[0], squash[1]);
            ctx.drawImage(noorArt, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh); ctx.restore();
          }
        }
        ctx.scale(spinX * squash[0], squash[1]);
        boostAfterimages(noorArt, p.x, rivalY, unit * artScale, rivalBoost, palette, (image, alpha, dx, dy, grow) => {
          ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(dx, dy); ctx.scale(grow, grow);
          ctx.drawImage(image, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh); ctx.restore();
        });
        ctx.drawImage(noorArt, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh);
        ctx.restore();
        if (rivalSpinning) drawSpinWhirl(p.x, rivalY, unit * artScale, noor.rot, rivalDir, "front");
        ctx.restore();
        if (p.dz < 70) drawRivalName(name, look, p, height, unit);
        return;
      }
      if (noor.fallT > 0) ctx.rotate((noor.x > 0 ? 1 : -1) * 1.1 * (noor.fallT / 1.1));
      else ctx.rotate(lean * 0.8);
      ctx.scale(0.86 * spinX * squash[0], 0.86 * squash[1]); // 主人公の背面の絵と同じくらいの背丈に。回転中は横に縮めて裏返す
      const c = noor.air > 0 && noor.landingPress != null ? 0.86 : noor.air > 0 ? 0.94 : 1; // 構えると低く
      const u = unit, line = (w, color, pts) => { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, w * u); ctx.beginPath(); ctx.moveTo(pts[0] * u, pts[1] * u); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * u, pts[i + 1] * u); ctx.stroke(); };
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // 板（青緑）: 斜めに置き、上面に明るい筋
      ctx.save(); ctx.rotate(-0.42 + lean * 0.3);
      ctx.fillStyle = mixColor(...look.board, dusk);
      ctx.beginPath(); ctx.ellipse(0, -u * 0.04, u * 0.66, u * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.ellipse(-u * 0.05, -u * 0.07, u * 0.5, u * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 脚（ベージュのパンツ）: 膝を外へ曲げて板に乗る
      const pants = mixColor(...look.pants, dusk), hipY = -0.9 * c;
      line(0.19, pants, [-0.3, -0.16, -0.42, -0.5 * c, -0.14, hipY]);
      line(0.19, pants, [0.26, 0.06, 0.4, -0.38 * c, 0.14, hipY]);
      ctx.fillStyle = look.shoes; // 靴
      ctx.beginPath(); ctx.ellipse(-0.3 * u, -0.12 * u, 0.13 * u, 0.07 * u, -0.4, 0, Math.PI * 2); ctx.ellipse(0.26 * u, 0.08 * u, 0.13 * u, 0.07 * u, -0.4, 0, Math.PI * 2); ctx.fill();
      // 胴（オリーブのシャツ）: 腰から肩へ広がる。片側を少し暗く
      const shoulderY = hipY - 0.82 * c, shirt = mixColor(...look.shirt, dusk), sleeve = look.sleeve ? mixColor(...look.sleeve, dusk) : shirt;
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.moveTo(-0.26 * u, hipY * u); ctx.quadraticCurveTo(-0.4 * u, (hipY - 0.45) * u, -0.38 * u, shoulderY * u);
      ctx.quadraticCurveTo(0, (shoulderY - 0.1) * u, 0.38 * u, shoulderY * u); ctx.quadraticCurveTo(0.4 * u, (hipY - 0.45) * u, 0.26 * u, hipY * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(40,40,10,0.22)"; ctx.fillRect(0.1 * u, shoulderY * u, 0.26 * u, (hipY - shoulderY) * u);
      ctx.fillStyle = "#2b2a20"; ctx.fillRect(-0.27 * u, (hipY - 0.06) * u, 0.54 * u, 0.08 * u); // ベルト
      // 腕: 肩から外へ、肘を曲げて釣り合いを取る（空中では高く）
      const skin = mixColor(...look.skin, dusk), up = noor.air > 0 ? -0.25 : 0.15, reach = 0.75 + Math.abs(lean) * 0.3;
      const fore = look.sleeve ? sleeve : skin; // なるは長袖（白い袖）
      line(0.12, sleeve, [-0.34, shoulderY + 0.06, -0.62, shoulderY + 0.3 + up * 0.5]);
      line(0.1, fore, [-0.62, shoulderY + 0.3 + up * 0.5, -0.34 - reach * 0.6, shoulderY + 0.12 + up]);
      line(0.12, sleeve, [0.34, shoulderY + 0.06, 0.62, shoulderY + 0.3 + up * 0.5]);
      line(0.1, fore, [0.62, shoulderY + 0.3 + up * 0.5, 0.34 + reach * 0.6, shoulderY + 0.12 + up]);
      if (look.sleeve) { // 白い肩の切り替え
        ctx.fillStyle = sleeve;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 0.3 * u, (shoulderY + 0.05) * u, 0.11 * u, 0.07 * u, 0, 0, Math.PI * 2); ctx.fill(); }
      }
      // 首とスカーフ（ベージュ）。スカーフの端が風でなびく
      ctx.fillStyle = skin; ctx.fillRect(-0.07 * u, (shoulderY - 0.16) * u, 0.14 * u, 0.18 * u);
      if (look.scarf) {
        const scarf = mixColor([234, 220, 184], [236, 200, 160], dusk), flutter = Math.sin(noor.t * 11) * 0.06;
        ctx.fillStyle = scarf; ctx.beginPath(); ctx.ellipse(0, (shoulderY + 0.02) * u, 0.24 * u, 0.09 * u, 0, 0, Math.PI * 2); ctx.fill();
        line(0.08, scarf, [0.14, shoulderY + 0.04, 0.32, shoulderY + 0.2 + flutter, 0.46, shoulderY + 0.16 - flutter]);
      }
      // 頭（後ろ姿の黒髪）と、後ろで束ねて揺れる髪
      const headY = shoulderY - 0.36;
      ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(0, headY * u, 0.21 * u, 0.24 * u, 0, 0, Math.PI * 2); ctx.fill();
      if (look.ponytail) {
        const sway = Math.sin(noor.t * 8.5) * 0.05;
        ctx.beginPath(); ctx.moveTo(-0.07 * u, (headY + 0.08) * u); ctx.quadraticCurveTo((0.02 + sway) * u, (headY + 0.42) * u, (0.06 + sway * 1.6) * u, (headY + 0.5) * u);
        ctx.quadraticCurveTo((0.1 + sway) * u, (headY + 0.3) * u, 0.07 * u, (headY + 0.08) * u); ctx.closePath(); ctx.fill();
      } else {
        // 短く跳ねた髪: 頭の下半分の縁から、毛先が横と下へ少し跳ねる（風で揺れる）
        const flick = Math.sin(noor.t * 10) * 0.08;
        ctx.beginPath();
        for (const ang of [0.15, 0.6, 1.1, 1.57, 2.05, 2.55, 3.0]) {
          const bx = Math.cos(ang) * 0.2, by = headY + Math.sin(ang) * 0.22, tip = ang + 0.35 + flick;
          ctx.moveTo((bx - Math.sin(ang) * 0.05) * u, (by + Math.cos(ang) * 0.05) * u);
          ctx.lineTo((bx + Math.cos(tip) * 0.09) * u, (by + Math.sin(tip) * 0.09) * u);
          ctx.lineTo((bx + Math.sin(ang) * 0.05) * u, (by - Math.cos(ang) * 0.05) * u);
        }
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.ellipse(-0.07 * u, (headY - 0.08) * u, 0.07 * u, 0.12 * u, 0.4, 0, Math.PI * 2); ctx.fill();
      if (look.glasses) { // 頭に乗せたサングラス（黄色の縁）
        ctx.fillStyle = "#2a2430"; ctx.strokeStyle = "#e3b23c"; ctx.lineWidth = Math.max(1, 0.03 * u);
        for (const sx of [-0.09, 0.09]) { ctx.beginPath(); ctx.ellipse(sx * u, (headY - 0.17) * u, 0.075 * u, 0.045 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
      ctx.restore();
      ctx.restore();
      if (p.dz < 70) drawRivalName(name, look, p, height, unit);
    }
    /** 相手の板の砂煙と輪（simulateRivalFx が進める）。相手の絵の後ろに描く。 */
    function drawRivalBoardFx(p, unit) {
      const puff = art.get("puff");
      for (const ring of rivalFx.rings) {
        const k = ring.age / ring.life, palette = AURAS[raceWith] || AURAS.noor;
        ctx.strokeStyle = ring.boost ? `rgba(${palette.mid.join(",")},${0.8 * (1 - k)})` : `rgba(255,248,230,${0.75 * (1 - k)})`;
        ctx.lineWidth = Math.max(1.5, unit * 0.1 * (1 - k)) * ring.power;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, unit * (0.5 + 2.2 * k) * ring.power, unit * (0.12 + 0.45 * k) * ring.power, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (!rivalFx.dust.length) return;
      const alpha = ctx.globalAlpha;
      for (const d of rivalFx.dust) {
        const a = Math.min(1, 0.75 * (1 - d.age / d.life)) * alpha;
        if (puff) {
          const w = d.r * unit * 2.8, h = w * puff.naturalHeight / puff.naturalWidth;
          ctx.globalAlpha = a; ctx.drawImage(puff, p.x + d.x * unit - w / 2, p.y + d.y * unit - h / 2, w, h);
        } else {
          ctx.globalAlpha = 1; ctx.fillStyle = `rgba(242,220,178,${0.55 * a})`;
          ctx.beginPath(); ctx.arc(p.x + d.x * unit, p.y + d.y * unit, d.r * unit, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = alpha;
    }
    function drawRivalName(name, look, p, height, unit) {
      const tagY = Math.max(150, p.y - height * unit * 0.9 - unit * 2.45);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (70 - p.dz) / 25);
      ctx.font = `800 ${Math.round(Math.max(16, Math.min(24, unit * 0.32)))}px ${fontFamily()}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(name).width + 20;
      ctx.fillStyle = look.tag; ctx.beginPath(); ctx.roundRect?.(p.x - w / 2, tagY - 15, w, 30, 15); ctx.fill();
      ctx.fillStyle = "#f6ecd2"; ctx.fillText(name, p.x, tagY);
      ctx.restore();
    }

    // 検証・デモ用の手がかり（保存に触れない）
    window.__desertRide = {
      get game() { return game; }, get mode() { return mode; }, get results() { return results; }, get course() { return game?.course ?? null; },
      press: act, setInput(left, right) { input.left = !!left; input.right = !!right; },
      autoplay(skill = "expert") { bot = skill; }, boost: doBoost, get rival() { return rival; }, get countdown() { return countdown; }, get raceWith() { return raceWith; },
      setSpeedUp(value) { speedUp = Math.max(1, Number(value) || 1); },
      skipCountdown() { countdown = 0; root.dataset.countdown = ""; countShown = "GO!"; startPop.classList.remove("show"); versus.classList.remove("show"); },
      advance(seconds, input = {}) {
        if (!game || game.finished) return;
        const dt = 1 / 60, n = Math.max(1, Math.round(Math.max(0, seconds) / dt));
        for (let i = 0; i < n && !game.finished; i++) step(game, input, dt);
      },
      start(kind = "run", who = "noor") { if (!mode) startRun(kind, who); }, leave: finish,
      // 段（#3779）: 選んでいる段・開いている段。chooseTier は札を押したのと同じ（閉じた段は選べない）
      get tier() { return chosenTier; }, get tiers() { return [...openTiers]; }, chooseTier, get naruChosen() { return chosenNaru && rivals.includes("naru"); }, get rivals() { return [...rivals]; },
      // 検査用: 次の本番からコースを固定する（無い id は外す）。普段のコースは毎回ランダム
      setCourse(id) { queuedCourse = null; courseId = COURSE_PACKS.some(pack => pack.id === id) ? id : undefined; },
      pause(value) { paused = !!value; if (!paused) { last = performance.now(); } },
      redraw() { if (game) { updateHud(); simulateParticles(0); draw(1 / 60); } },
      rawBoost() { return boost(game); },
      soundLevels() { return rideSe.loopLevels(); },
      // 手応えの数値（FEEL）。コンソールから書き換えると、その場で変わる
      feel: FEEL,
      endHitStop() { hitStopT = 0; },
      get fx() { return { hitStop: hitStopT, slow: slowT, shake: { ...shake }, flash: { ...flash }, flashDark: flashDarkT, goal: goal ? goal.t : null, countdownTotal, pose, lastLand, rings: rings.map(r => r.grade || "burst"),
        confetti: particles.filter(p => p.confetti).length, aura: game ? auraStrength(game.boostT, view.boost || 0) : 0, rise: view.rise, grains: particles.filter(p => p.grain).length, shots: fxShots.map(shot => shot.name), puffs: particles.filter(p => !p.streak && !p.grain && !p.spark && !p.chip && !p.confetti).length,
        orbs: orbs.length, curveCue: curveCueOn, carveHeat: carveFx.heat, carveChain: carveFx.chain, carveShow: carveFx.show, carveGlints: carveFx.glints.length, carveRuns: carveFx.runs.length, sparks: particles.filter(p => p.spark).length, rivalDust: rivalFx.dust.length, rivalRings: rivalFx.rings.length, rivalSurge: rivalSurge(), smashFlash: smashFlash.size, squash: game ? squashOf(game, lastLand) : [1, 1], shownHeight: game ? shownHeight(game) : 0 }; },
    };
    // メニューの空き時間に一仕事ずつ進める。待たずに開始した場合は準備ゲートで残りを作る。
    function scheduleMenuWarm(task) {
      if (done || preparing || mode || runId !== 0) return;
      const idle = typeof requestIdleCallback === "function";
      const run = () => {
        cancelMenuWarm = () => {};
        if (!done && !preparing && !mode && runId === 0) task();
      };
      const id = idle ? requestIdleCallback(run, { timeout: 600 }) : setTimeout(run, 80);
      cancelMenuWarm = () => idle ? cancelIdleCallback(id) : clearTimeout(id);
    }
    function warmFirstRace() {
      if (rivals.includes("noor")) {
        const course = pickRunCourse(chosenTier);
        if (isFixedCourse(course)) {
          queuedCourse = { course, tier: chosenTier };
          getRivalRun(course, "noor", chosenTier);
        }
      }
      void menuArt.whenReady().then(() => scheduleMenuWarm(() => {
        prewarmCanvas();
        scheduleMenuWarm(() => prewarmTints(rivals[0] || null));
      }));
    }
    showMenu();
    if (tutorial) prepareAndStart("practice");
    else if (startRival && rivals.includes(startRival)) prepareAndStart("run", startRival);
    else scheduleMenuWarm(() => { sandTexture(); scheduleMenuWarm(warmFirstRace); });
  });
  active.set(host, promise);
  promise.finally(() => active.delete(host));
  return promise;
}


