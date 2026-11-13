// DESERT RIDE（第4章ドバイ・サンドボード）の規則。コースの生成・1フレームの物理・採点だけを持ち、DOM に触れない。
// 画面と入力は desert-ride.js、本編との接続（行動枠・報酬・保存）は chapters/ch4-desert.js。
// 座標: z はコースに沿った距離（m）、x はコース中央からの横位置（-1〜1 がコース幅、|x|>EDGE は端の深い砂）。
// 2026-11-02 オーナー「もっとスピード感・ゲーム性を」: 空中トリック（大ジャンプ中に ← → で回転）、ブースト（ゲージ満タンで超加速・岩を砕く）、
// ヌールとの競走（同じコースを自動で滑るヌールより先にゴールすれば勝ち）を足した。

export const COURSE = Object.freeze({ length: 1700, practiceLength: 800, laneHalf: 1 });
// コースの山と平地（2026-11-13 オーナー「手応えレビューの内容を実装して、より面白く」。docs/spec/desert_ride.md「山と平地」）:
// firstBump: 最初の要素は岩の無い起伏（走り出して約5秒で最初の「跳ぶ」）。start: 乱数の配置が始まる距離。
// gapFrom→gapTo: 要素の間隔（進むほど詰まる）。
// chainFrom: この進み具合を過ぎた最初の所に、岩の無い起伏を chainCount 個・chainGap m おきに並べる（稼ぎ場＝平地）。
// chainGap は「大ジャンプの飛距離（通常の最高速で約50m）＋次を押す間（約0.6秒）」。landing は起伏の先の、岩を置かない距離。
// 連続起伏の先（置けない短いコースでは lastStretch から先）は終盤の山: 間隔は gapLast、岩の無い起伏だけが出る割合を bumpOnly → bumpOnlyLast に下げて岩を増やす。
export const LAYOUT = Object.freeze({ firstBump: 90, start: 160, gapFrom: 60, gapTo: 38, gapLast: 34, lastStretch: 0.88, chainFrom: 0.45, chainCount: 3, chainGap: 72, landing: 52,
  bumpOnly: 0.34, bumpOnlyLast: 0.12 });
export const PLAYER = Object.freeze({ half: 0.1 });
export const EDGE = 0.86;
export const SPEED = Object.freeze({ start: 15, min: 8, max: 34, boost: 46, boostAccel: 26, overDecay: 12, accel: 1.5, fallFactor: 0.42, edgeDrag: 7, landingBoost: 3.5, plainLanding: 0.94, bounceLoss: 0.9 });
// 画面に出す速さ・距離の縮尺（2026-11-11 オーナー「実際にサンドボードってこんな速度出るの？やや盛ってもいいけど現実離れはしたくない」）。
// 内部の速さ（SPEED）は手触りのまま変えず、表示だけ現実に寄せる。出だし 約30・通常の最高速 約67・ブースト 約91 km/h。
// 実物: 上手な人で約64 km/h（National Geographic）、サンドボードのギネス記録 82 km/h、砂のスキーの記録 127 km/h（2026年）。
export const DISPLAY = Object.freeze({ scale: 0.55, dialMax: 100, redFrom: 70 });
/** 内部の速さ（m/s 相当）→ 画面の km/h。 */
export const toKmh = speed => speed * 3.6 * DISPLAY.scale;
/** 内部の距離 → 画面の m（相手との差など）。速さと同じ縮尺にして、数字どうしの釣り合いを保つ。 */
export const toMeters = units => units * DISPLAY.scale;
// 2026-11-11 オーナー「ブースト溜まってない時のジャンプが弱すぎて難しい。少し強化して」: 大ジャンプの高さの土台 1.7→2.0（速さの上乗せ 1.3→1.0。
// ブーストの最高速での高さは 3.0m のまま＝画面の上で頭が切れない。出だしの速さでは 2.1→2.3m、通常最高速では 2.66→2.74m）、
// ホップは滞空 0.56→0.66 秒・高さ 0.85→1.05 にし、跳んだ高い所（hopClearsBig m 以上）なら大きい岩も越えられる（小さい岩は今までどおり）。
// 大ジャンプの滞空は、遅い時も伸びるよう下限を上げた（airFloor 0.85→0.92。通常最高速での長さ airFloor＋airGain は 1.15 のまま）。
export const JUMP = Object.freeze({ bigAir: 1.27, hopAir: 0.66, bounceAir: 0.26, landingWindow: 0.3, goodWindow: 0.6, bumpWindow: 0.36, bumpGrace: 0.14, steerInAir: 0.55, bigHeight: 2.0, speedHeight: 1.0, hopHeight: 1.05, hopSpeedHeight: 0.45, hopClearsBig: 0.8, airFloor: 0.92, airGain: 0.23 });
export const FALL = Object.freeze({ recover: 1.1, points: -150 });
// curveDrift: カーブの外へ流す力（c=1・通常最高速で、何もしないと毎秒 約0.25 レーン外へ流れる）。曲がる向きへ切っている間は流されない。
export const STEER = Object.freeze({ accel: 4.6, damping: 4.0, curveDrift: 1 });
// カービング: カーブ（|c| >= minCurve）の地上で、曲がる向きへ切り込んでいる間だけブーストのゲージが貯まり、tickSec ごとに少し得点。
// 端の深い砂・空中・転倒中は貯まらない。押し込みの強さ（スティックの倒し量）に比例する。
export const CARVE = Object.freeze({ minCurve: 0.4, gaugePerSec: 0.1, tickSec: 0.8, points: 30 });
export const SCORE = Object.freeze({ finish: 1200, timePar: 72, timeBonusPerSec: 30, perfect: 250, good: 120, comboStep: 0.15, comboMax: 3,
  smash: 100, raceWin: 600, raceWinNaru: 1500 });
// かすめ（2026-11-13 段階制に。それまでは幅の中ならどこでも 60点・ゲージ 0.12 で、2つ岩の真ん中＝いちばん安全な線で2回もらえた）:
// 岩の当たり判定のすぐ外側 width（レーン）の帯。当たる寸前ほど大きく、帯の外寄りほど小さい（closeness 1→0 で max→min）。
// 2つ岩の真ん中（余白 0.15）は 1つ 約49点・ゲージ 約0.07。跳び越えた岩は横の危険を取っていないので真ん中の値（airCloseness）。
export const NEAR = Object.freeze({ width: 0.22, minPoints: 30, maxPoints: 90, minGauge: 0.04, maxGauge: 0.14, airCloseness: 0.5 });
// 競走の相手。ヌールは着地が少し遅い滑り（ブーストは使う）。なる（裏の相手・ヌールに勝った後）は 360 を決めて着地も完璧、ブーストも使う。
// startSpeed: スタートの速さ。ヌールは砂丘のガイドなので、出だしが少しだけうまい（同じ滑りでは並べない）。
export const RIVALS = Object.freeze({
  noor: Object.freeze({ skill: "rival", startX: -0.42, only360: false, startSpeed: SPEED.start + 0.6 }),
  naru: Object.freeze({ skill: "expert", startX: 0.42, only360: true, startSpeed: SPEED.start }),
});
// 空中トリック: 大ジャンプ中に ← か → を押している間だけ回る（rate 回転/秒）。離すと次の半回転まで finishRate で回り切る。
// 着地の瞬間に半回転の区切りから tolerance（回転）以上ずれていると転倒。points は半回転の数ごとの得点（180, 360, 540 …）。
// 跳んだ瞬間から押していた向きは、一度離すまで回転に使わない（よけながら跳んだだけで回り出さないように）。
export const SPIN = Object.freeze({ rate: 1.7, finishRate: 3.2, tolerance: 0.1, points: Object.freeze([0, 150, 400, 700, 1100, 1500, 2000, 2600, 3300]) });
// ブースト: かすめ・大ジャンプの着地・トリックでゲージ（0〜1）が貯まり、残量に比例した時間だけ発動できる。duration 秒のあいだ速度の上限が SPEED.boost になり、
// 当たった岩は砕ける（転倒しない）。転倒するとゲージが fallLoss 減るが、転倒前の半分は残す（空のゲージは増やさない）。岩に当たった直後（recoverWindow 秒）にゲージがあれば、ブーストで立て直せる（転倒を取り消して加速する）。
// いい勝負（2026-11-11 オーナー「ライバルとの距離が離れすぎたらついてきたり、逆に離れすぎたら少し手加減してくれたり、いい勝負してる感を出したい」）:
// 相手は記録した滑り（rivalRun）を、差に応じた速さで再生する（game.rivalClock）。差が gap メートルを超えると、
// 離した時は最大 catchUp 倍まで速く（追いつく）、離された時は最低 easeOff 倍まで遅く（手加減）。span メートルで最大に届く。
// ずれ（rivalClock − t）の上限は進み具合で変える: 追いついた分は lead 秒まで。holdUntil（6割）を過ぎたら、ゴールの少し手前（settleAt）で
// 0 になるまで返す（終盤に相手がバテて引き離せる。勝ちは腕前のまま奪わない）。手加減は lag 秒まで、終盤（lastStretch）から keep 秒まで戻す（大きく離された時だけ少し勝ちやすい）。
// 上限を超えた分は settle 秒/秒までの速さで戻す。
export const RUBBER = Object.freeze({ gap: 20, span: 50, catchUp: 1.25, easeOff: 0.75, lead: 3, lag: 3, keep: 0.5, holdUntil: 0.6, settleAt: 0.95, lastStretch: 0.3, settle: 0.3, ease: 6 });
// ブーストの代償（2026-11-13。それまでは純粋な得で、突っ込むほど良かった）: 岩を砕くたびに残り時間が smashCost 秒減る
// （smashFloor 秒までは残す＝砕いた直後に切れて次の岩で転ばない）。端の深い砂（|x|>EDGE）に入ると、その場でブーストが切れる。
// practiceRecoverWindow: 練習の立て直しの猶予（初めてでも間に合う長さ）。
export const BOOST = Object.freeze({ duration: 3, land: 0.05, perfect: 0.22, good: 0.1, trickPerHalf: 0.1, fallLoss: 0.3, recoverWindow: 0.45, practiceRecoverWindow: 0.9,
  smashCost: 0.35, smashFloor: 0.2 });
// 評価の境目は DEFAULT_SEED（コース「稜線」）で合わせた: 空中で回って着地も決める＝S、回らないが着地を決めてブーストも使う＝A、
// 着地が「良い」止まり＝B、ジャンプを使わず避けるだけ＝C（remake/test/desert_ride.mjs のボットで照合）。
// 本番は COURSE_PACKS から1本を選ぶ（同じ長さ・難易度帯で、カーブと配置だけが違う）。
export const RULES_VERSION = 2; // 離陸加点なし・着地回復。旧記録とは点数を比較しない
export const DEFAULT_SEED = 7;
export const CURVE_STEP = 2; // heading/offset の焼きテーブル間隔（m）
export const CURVE_SCALE = 0.0045; // c=1 のとき、1m あたりの向きの変化（レーン単位）。見た目の曲がりだけに使う（横へ流す力は STEER.curveDrift）
// 本番のコース。seed は配置、curves があればカーブだけ差し替える（コースA＝ridge は従来の seed 7 のまま）。
export const COURSE_PACKS = Object.freeze([
  Object.freeze({ id: "ridge", name: "コースA", seed: 7 }),
  Object.freeze({ id: "left-bowl", name: "コースB", seed: 19, curves: Object.freeze([
    { z: 0, c: 0 }, { z: 240, c: 0 }, { z: 480, c: -0.9 }, { z: 820, c: -1 }, { z: 1100, c: -0.35 }, { z: 1380, c: 0.45 },
  ]) }),
  Object.freeze({ id: "right-crest", name: "コースC", seed: 23, curves: Object.freeze([
    { z: 0, c: 0 }, { z: 240, c: 0 }, { z: 480, c: 0.9 }, { z: 820, c: 1 }, { z: 1100, c: 0.35 }, { z: 1380, c: -0.45 },
  ]) }),
  Object.freeze({ id: "switchback", name: "コースD", seed: 11, curves: Object.freeze([
    { z: 0, c: 0 }, { z: 200, c: 0 }, { z: 400, c: 0.95 }, { z: 620, c: 0 }, { z: 900, c: -0.95 }, { z: 1120, c: 0 }, { z: 1360, c: 0.85 },
  ]) }),
]);
export const RANKS = Object.freeze([["S", 12000], ["A", 6000], ["B", 3500], ["C", 0]]);
export const RANK_ORDER = Object.freeze(["C", "B", "A", "S"]);

/** 決定的な乱数（mulberry32）。同じ seed なら同じコース。 */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rock = (z, x, size = "big") => ({ kind: "rock", z, x, w: size === "small" ? 0.11 : 0.17, size });
const bump = z => ({ kind: "bump", z, x: 0, w: 1 });

/**
 * コースを作る。features は z の昇順。岩は手前から見えるよう十分な間隔を空け、起伏の着地帯には岩を置かない。
 * curves はカーブの要所（z, c∈[-1,1]）。描画と横流れに使う。
 */
export function generateCourse(seed = 1, { length = COURSE.length } = {}) {
  const random = rng(seed);
  const L = LAYOUT;
  const features = [bump(L.firstBump)]; // 最初の体験は「跳ぶ」。岩は start から
  let z = L.start, chained = false;
  // 進むほど密に（60 → 38）。終盤の山は、もう一段詰める
  const mountain = progress => chained || progress > L.lastStretch;
  const minGap = progress => mountain(progress) ? L.gapLast : L.gapFrom - (L.gapFrom - L.gapTo) * progress;
  while (z < length - 140) {
    const progress = Math.min(1, z / length);
    const chainSpan = L.chainGap * (L.chainCount - 1);
    if (!chained && progress >= L.chainFrom && z + chainSpan + L.landing < length - 140) {
      // 連続起伏: 岩の無い稼ぎ場（回転とコンボ）。この先の密な区間が山になる
      for (let i = 0; i < L.chainCount; i++) features.push(bump(z + L.chainGap * i));
      z += chainSpan + L.landing + minGap(progress) + random() * 26;
      chained = true;
      continue;
    }
    const roll = random();
    const side = () => (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.55);
    if (roll < (mountain(progress) ? L.bumpOnlyLast : L.bumpOnly)) {
      // 起伏: ジャンプの見せ場。着地帯（52m）に岩を置かない
      features.push(bump(z));
      z += L.landing;
    } else if (roll < 0.52) {
      features.push(rock(z, side())); // 終盤の山では、起伏だけの分もここ（岩1つ）になる
    } else if (roll < 0.66) {
      // 2つの岩の間を抜ける。間隔は必ず板の幅の3倍以上
      const center = (random() - 0.5) * 0.7;
      features.push(rock(z, center - 0.42), rock(z, center + 0.42));
    } else if (roll < 0.82 && progress > 0.25) {
      // ジグザグの小岩3つ。ひとつずつ見える距離を置く
      const dir = random() < 0.5 ? -1 : 1;
      features.push(rock(z, dir * 0.4, "small"), rock(z + 34, -dir * 0.3, "small"), rock(z + 68, dir * 0.15, "small"));
      z += 68;
    } else if (progress > 0.3) {
      // 起伏の先に岩: 着地してから曲がる時間（64m 以上）を取る
      features.push(bump(z), rock(z + 64, side()));
      z += 64;
    } else {
      features.push(rock(z, side(), "small"));
    }
    z += minGap(progress) + random() * 26;
  }
  const curves = [{ z: 0, c: 0 }];
  for (let at = 220; at < length - 120; at += 170 + random() * 150) {
    const c = [-1, -0.6, 0, 0.6, 1][Math.floor(random() * 5)];
    curves.push({ z: at, c });
  }
  curves.push({ z: length - 60, c: 0 }, { z: length + 400, c: 0 });
  features.sort((a, b) => a.z - b.z);
  return decorateCourse({ seed, length, features, curves, practice: false, id: packId(seed), name: packName(seed) });
}

/**
 * 練習コース: まっすぐ → 岩1つ → 起伏（跳ぶ・着地）→ 岩 → 起伏（空中で回る）→ 岩2つ（ブーストで砕く）→ 岩の壁（わざと当たって立て直す）。
 * 説明の順番が固定なので乱数は使わない。最後の壁（PRACTICE_WALL）は4つ並びで、コースの中（端の深い砂の内側）ではよけられない（立て直しを一度やってみる所）。
 */
export const PRACTICE_WALL = 720;
const PRACTICE_WALL_X = Object.freeze([-0.66, -0.22, 0.22, 0.66]);
export function practiceCourse() {
  const length = COURSE.practiceLength;
  const features = [rock(150, 0.35), bump(240), rock(330, -0.3), bump(410), rock(540, 0), rock(590, 0.05),
    ...PRACTICE_WALL_X.map(x => rock(PRACTICE_WALL, x))];
  const curves = [{ z: 0, c: 0 }, { z: length + 400, c: 0 }];
  return decorateCourse({ seed: 0, length, features, curves, practice: true, id: "practice", name: "練習" });
}

/** z でのカーブ（-1〜1）。要所の間は滑らかにつなぐ。 */
export function curveAt(course, z) {
  const points = course.curves;
  if (z <= points[0].z) return points[0].c;
  for (let i = 1; i < points.length; i++) {
    if (z <= points[i].z) {
      const a = points[i - 1], b = points[i];
      const t = (z - a.z) / Math.max(1, b.z - a.z);
      const s = t * t * (3 - 2 * t);
      return a.c + (b.c - a.c) * s;
    }
  }
  return points[points.length - 1].c;
}

function packById(id) { return COURSE_PACKS.find(p => p.id === id) || null; }
function packBySeed(seed) { return COURSE_PACKS.find(p => p.seed === seed) || null; }
function packId(seed) { return packBySeed(seed)?.id ?? `seed-${seed}`; }
function packName(seed) { return packBySeed(seed)?.name ?? "砂丘"; }

function closeCurves(points, length) {
  const list = points.map(p => ({ z: p.z, c: p.c })).sort((a, b) => a.z - b.z);
  if (!list.length || list[0].z !== 0) list.unshift({ z: 0, c: 0 });
  if (list[0].c !== 0) list[0] = { z: 0, c: 0 };
  const end = length - 60;
  if (list[list.length - 1].z < end) list.push({ z: end, c: 0 });
  list.push({ z: length + 400, c: 0 });
  return Object.freeze(list);
}

/** カーブの向きと横ずれを等間隔で焼いておく（描画と検査で同じ値を使う）。 */
function bakeCurve(course) {
  const maxZ = course.length + 400;
  const n = Math.floor(maxZ / CURVE_STEP) + 1;
  const heading = new Float64Array(n), offset = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const c = curveAt(course, (i - 0.5) * CURVE_STEP);
    heading[i] = heading[i - 1] + c * CURVE_SCALE * CURVE_STEP;
    offset[i] = offset[i - 1] + 0.5 * (heading[i] + heading[i - 1]) * CURVE_STEP;
  }
  return { heading, offset };
}

function decorateCourse(course) {
  const baked = bakeCurve(course);
  return Object.freeze({ ...course, curves: Object.freeze(course.curves.map(p => Object.freeze({ ...p }))), heading: baked.heading, offset: baked.offset });
}

function sampleBake(table, z) {
  if (!table?.length) return 0;
  const i = z / CURVE_STEP;
  if (i <= 0) return table[0];
  if (i >= table.length - 1) return table[table.length - 1];
  const lo = Math.floor(i), t = i - lo;
  return table[lo] + (table[lo + 1] - table[lo]) * t;
}

/** z での向き（レーン単位）。z=0 は 0。 */
export function headingAt(course, z) { return sampleBake(course.heading, z); }
/** z での横ずれ（レーン単位、コース原点から）。 */
export function offsetAt(course, z) { return sampleBake(course.offset, z); }
/** 基準位置 zRef から見た、地点 z の横ずれ（カメラ相対。同じ地点なら 0）。 */
export function lateralAt(course, z, zRef) {
  return offsetAt(course, z) - offsetAt(course, zRef) - headingAt(course, zRef) * (z - zRef);
}

/** 先のカーブの向き（-1〜1）。もうすぐ曲がるときだけ値を返し、すでに曲がっている／まっすぐなら 0。 */
export function upcomingCurve(course, z, lookAhead = 110) {
  const now = curveAt(course, z);
  let best = 0;
  for (let ahead = 24; ahead <= lookAhead; ahead += 8) {
    const c = curveAt(course, z + ahead);
    if (Math.abs(c) > Math.abs(best)) best = c;
  }
  if (Math.abs(best) < 0.35 || Math.abs(best) <= Math.abs(now) + 0.15) return 0;
  return best;
}

/** コース定義（id か seed）から本番の1本を作る。同じ引数なら同じコース。 */
export function buildCourse({ id, seed } = {}) {
  const pack = (id && packById(id)) || (seed != null && packBySeed(seed)) || null;
  if (!pack) return generateCourse(seed ?? DEFAULT_SEED);
  const course = generateCourse(pack.seed);
  if (!pack.curves) return decorateCourse({ ...course, id: pack.id, name: pack.name, curves: course.curves });
  return decorateCourse({ ...course, id: pack.id, name: pack.name, curves: closeCurves(pack.curves, course.length) });
}

/** runSeed から COURSE_PACKS の1本を決めて作る（決定的）。 */
export function pickCourse(runSeed) {
  const index = Math.floor(rng(runSeed)() * COURSE_PACKS.length);
  return buildCourse({ id: COURSE_PACKS[index].id });
}

/** rival: rivalRun() の結果（本番のヌール）。あれば、ゴールの順を競い、先着で加点する。 */
export function createGame(course, { rival = null } = {}) {
  return {
    course, rival, t: 0, z: 0, x: 0, vx: 0, speed: SPEED.start, rivalClock: 0, rivalRate: 1, rivalFinishT: null,
    air: 0, airTotal: 0, airPeak: 0, airKind: null, landingPress: null, lastJumpT: -9,
    rot: 0, spinDir: 0, spinHold: false, spinArmed: null, lastTrick: null,
    gauge: 0, boostT: 0, carving: false, carveT: 0,
    fallT: 0, fallAt: -9, fallReason: null, preFallSpeed: SPEED.start, preFallCombo: 0, preFallGauge: 0,
    falls: 0, combo: 0, maxCombo: 0, score: 0,
    stats: { bigJumps: 0, hops: 0, perfect: 0, good: 0, plain: 0, nearMiss: 0, edgeTime: 0, bounces: 0, airTime: 0,
      tricks: 0, bestTrick: 0, spinFalls: 0, boosts: 0, boostsLost: 0, smashed: 0, recoveries: 0, carves: 0, carveTime: 0 },
    passed: new Set(), smashedRocks: new Set(), lastBump: null, finished: false, finishTime: null, race: null, events: [], landedAt: null,
  };
}

/** かすめの見返り。closeness は 1（当たる寸前）〜 0（帯の外の縁）。 */
export function nearReward(closeness) {
  const k = Math.max(0, Math.min(1, closeness));
  return { points: Math.round(NEAR.minPoints + (NEAR.maxPoints - NEAR.minPoints) * k), gauge: NEAR.minGauge + (NEAR.maxGauge - NEAR.minGauge) * k };
}

export const comboMultiplier = combo => Math.min(SCORE.comboMax, 1 + SCORE.comboStep * combo);

function award(game, kind, base, { combo = true, at = {} } = {}) {
  const points = Math.round(base * comboMultiplier(game.combo));
  game.score += points;
  if (combo) { game.combo += 1; game.maxCombo = Math.max(game.maxCombo, game.combo); }
  game.events.push({ kind, points, t: game.t, combo: game.combo, ...at });
  return points;
}

/** ブーストのゲージを貯める（0〜1）。満タンになった瞬間に gaugeFull を知らせる。練習の説明でも使う。 */
export function chargeBoost(game, amount) {
  if (game.finished || !(amount > 0)) return game.gauge;
  const before = game.gauge;
  game.gauge = Math.min(1, before + amount);
  if (before < 1 && game.gauge >= 1) game.events.push({ kind: "gaugeFull", t: game.t });
  return game.gauge;
}

/** 立て直しの猶予（秒）。練習では長い。 */
export const recoverWindow = game => game.course?.practice ? BOOST.practiceRecoverWindow : BOOST.recoverWindow;
/** 転倒からブーストで立て直せるか（岩に当たった直後の短い間だけで、ゲージが必要）。 */
export function canRecover(game) {
  return !game.finished && (game.preFallGauge ?? 0) > 0 && game.fallT > 0 && game.fallReason === "rock"
    && game.t - game.fallAt <= recoverWindow(game) + 1e-9;
}

/** ブースト（↓ ／ BOOST ボタン）。残量を使い切り、その割合だけ加速時間を得る。転倒直後なら立て直す。 */
export function boost(game) {
  if (game.finished) return null;
  if (canRecover(game)) {
    game.gauge = game.preFallGauge;
    game.score -= FALL.points;
    game.falls = Math.max(0, game.falls - 1);
    game.combo = game.preFallCombo;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.fallT = 0;
    game.fallReason = null;
    game.speed = Math.max(game.speed, game.preFallSpeed);
    game.stats.recoveries += 1;
    game.boostT = Math.min(BOOST.duration, game.boostT + BOOST.duration * game.gauge);
    game.gauge = 0;
    game.preFallGauge = 0;
    game.stats.boosts += 1;
    game.events.push({ kind: "recover", t: game.t });
    return "recover";
  }
  if (game.gauge <= 0) return null;
  game.boostT = Math.min(BOOST.duration, game.boostT + BOOST.duration * game.gauge);
  game.gauge = 0;
  game.stats.boosts += 1;
  game.events.push({ kind: "boost", t: game.t });
  return "boost";
}

/** 次の起伏（まだ越えていない）までの距離。無ければ Infinity。 */
export function nextBumpDistance(game) {
  for (const feature of game.course.features) {
    if (feature.kind !== "bump" || game.passed.has(feature)) continue;
    if (feature.z >= game.z) return feature.z - game.z;
  }
  return Infinity;
}

/** ジャンプ／着地ボタン。空中なら着地の構え、起伏の直前なら大ジャンプ、それ以外は小さなホップ。 */
export function press(game) {
  if (game.finished) return null;
  if (game.air > 0) {
    if (game.airKind === "bounce") return null;
    game.landingPress = game.air;
    game.events.push({ kind: "brace", t: game.t, remaining: game.air });
    return "brace";
  }
  if (game.fallT > 0) return null;
  const ahead = nextBumpDistance(game);
  const inWindow = ahead <= game.speed * JUMP.bumpWindow;
  const justPassed = game.lastBump && game.t - game.lastBump.t <= JUMP.bumpGrace && !game.lastBump.used;
  if (inWindow || justPassed) {
    if (justPassed) game.lastBump.used = true;
    else game.pendingBump = true; // 起伏に着いたら大ジャンプ（手前で押しても同じ）
    startAir(game, "big");
    return "big";
  }
  startAir(game, "hop");
  return "hop";
}

/** 離陸時の速さで高さを固定。空中のブースト開始・終了では軌道を飛ばさない。
 * 滞空と高さを少し伸ばし、岩越えの手応えを強める。着地判定の幅は変えない。 */
export function jumpPeak(speed, kind = "big") {
  const fast = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed / SPEED.boost : 0));
  return kind === "big" ? JUMP.bigHeight + JUMP.speedHeight * fast : kind === "hop" ? JUMP.hopHeight + JUMP.hopSpeedHeight * fast : 0.5;
}

/** 現在の地面からの高さ。描画・相手の走行サンプルで共通の軌道を使う。 */
export function jumpHeight(game) {
  if (!(game.air > 0) || !(game.airTotal > 0)) return 0;
  const progress = Math.min(1, Math.max(0, 1 - game.air / game.airTotal));
  return Math.sin(progress * Math.PI) * game.airPeak;
}

function startAir(game, kind) {
  const scale = JUMP.airFloor + JUMP.airGain * Math.min(1, game.speed / SPEED.max); // 滞空時間は通常最高速で頭打ち（ブーストの高さは airPeak で伸ばす）
  game.air = game.airTotal = kind === "big" ? JUMP.bigAir * scale : kind === "hop" ? JUMP.hopAir : JUMP.bounceAir;
  game.airKind = kind;
  game.airPeak = jumpPeak(game.speed, kind);
  game.landingPress = null;
  game.lastJumpT = game.t;
  game.rot = 0; game.spinDir = 0; game.spinHold = false; game.spinArmed = null;
  if (kind === "big") {
    game.stats.bigJumps += 1;
    game.events.push({ kind: "jump", t: game.t, airTotal: game.airTotal });
  } else if (kind === "hop") game.stats.hops += 1;
  else game.stats.bounces += 1;
}

function land(game) {
  const kind = game.airKind;
  game.air = 0; game.airKind = null;
  if (kind === "bounce") { game.events.push({ kind: "land", grade: "bounce", t: game.t }); return; }
  game.landedAt = game.t; // 画面が着地の構えを少し残すため（採点には使わない）
  const gaugeBefore = game.gauge;
  if (kind === "big" && game.spinDir !== 0) {
    // トリック: 半回転の区切りで着地できたか。回りかけなら転倒
    const turns = Math.abs(game.rot), half = Math.round(turns * 2);
    const spun = { half, degrees: half * 180, dir: game.spinDir };
    game.rot = 0; game.spinDir = 0; game.spinHold = false;
    if (Math.abs(turns - half / 2) > SPIN.tolerance) {
      game.stats.spinFalls += 1;
      game.landingPress = null;
      fall(game, null, "spin");
      return;
    }
    if (half >= 1) {
      game.stats.tricks += 1;
      game.stats.bestTrick = Math.max(game.stats.bestTrick, spun.degrees);
      game.lastTrick = { ...spun, t: game.t };
      award(game, "trick", SPIN.points[Math.min(half, SPIN.points.length - 1)], { at: spun });
      chargeBoost(game, BOOST.trickPerHalf * half);
    }
  }
  // 平地のホップは回避用。連打で得点・コンボ・加速・回復を稼がせない。
  if (kind === "hop") {
    game.landingPress = null;
    game.events.push({ kind: "land", grade: "hop", t: game.t });
    return;
  }
  chargeBoost(game, BOOST.land); // 離陸ではなく、転ばず大ジャンプを着地した時だけ回復
  const remaining = game.landingPress;
  let grade = "plain";
  if (remaining !== null && remaining <= JUMP.landingWindow) grade = "perfect";
  else if (remaining !== null && remaining <= JUMP.goodWindow) grade = "good";
  if (grade === "perfect") {
    game.stats.perfect += 1;
    game.speed = Math.max(game.speed, Math.min(speedCap(game), game.speed + SPEED.landingBoost));
    chargeBoost(game, BOOST.perfect);
    award(game, "land", SCORE.perfect, { at: { grade, gaugeGained: game.gauge - gaugeBefore } });
  } else if (grade === "good") {
    game.stats.good += 1;
    chargeBoost(game, BOOST.good);
    award(game, "land", SCORE.good, { at: { grade, gaugeGained: game.gauge - gaugeBefore } });
  } else {
    game.stats.plain += 1;
    game.speed = Math.max(SPEED.min, game.speed * SPEED.plainLanding);
    game.events.push({ kind: "land", grade, gaugeGained: game.gauge - gaugeBefore, t: game.t });
  }
  game.landingPress = null;
}

function fall(game, feature, reason = "rock") {
  game.preFallSpeed = game.speed;
  game.preFallCombo = game.combo;
  game.preFallGauge = game.gauge;
  game.fallAt = game.t;
  game.fallReason = reason;
  game.fallT = FALL.recover;
  game.falls += 1;
  game.combo = 0;
  game.speed = Math.max(SPEED.min, game.speed * SPEED.fallFactor);
  game.vx = 0;
  game.score += FALL.points;
  game.air = 0; game.airKind = null;
  game.rot = 0; game.spinDir = 0; game.spinHold = false;
  game.boostT = 0;
  game.gauge = Math.max(game.gauge * 0.5, game.gauge - BOOST.fallLoss);
  game.events.push({ kind: "fall", points: FALL.points, t: game.t, x: feature?.x ?? game.x, reason });
}

/** 今の速度の上限（ブースト中は高い）。 */
const speedCap = game => game.boostT > 0 ? SPEED.boost : SPEED.max;
/** 岩を砕けるか: ブースト中と、終わった直後のまだ最高速を大きく超えている間（終わった瞬間に目の前の岩で転ばないように）。 */
export const smashing = game => game.boostT > 0 || game.speed > SPEED.max + 3;

/** 1フレーム進める。dt は秒（50ms で頭打ち）。入力は { left, right }。 */
export function step(game, input, dt) {
  if (game.finished) return game;
  dt = Math.min(0.05, Math.max(0, dt));
  game.t += dt;
  const falling = game.fallT > 0;
  if (falling) {
    game.fallT = Math.max(0, game.fallT - dt);
  } else if (game.boostT > 0) {
    game.speed = Math.min(SPEED.boost, game.speed + SPEED.boostAccel * dt);
  } else if (game.speed > SPEED.max) {
    game.speed = Math.max(SPEED.max, game.speed - SPEED.overDecay * dt); // ブーストの後は少しずつ戻る
  } else {
    game.speed = Math.min(SPEED.max, game.speed + SPEED.accel * dt);
  }
  if (game.boostT > 0) {
    game.boostT = Math.max(0, game.boostT - dt);
    if (game.boostT === 0) game.events.push({ kind: "boostEnd", t: game.t });
  }
  if (Math.abs(game.x) > EDGE && (game.air <= 0 || game.airKind === "hop")) {
    game.speed = Math.max(SPEED.min, game.speed - SPEED.edgeDrag * dt);
    game.stats.edgeTime += dt;
    // 深い砂に入るとブーストが切れる（速いほどカーブで外へ流される＝ブースト中こそ切り込む）
    if (game.boostT > 0) { game.boostT = 0; game.stats.boostsLost += 1; game.events.push({ kind: "boostEnd", t: game.t, reason: "edge" }); }
  }
  // 横移動: 入力で加速、砂の抵抗で減衰。空中は効きが弱い。カーブでは外へ流れる。
  // タッチスティックは倒し量をそのまま使う。鍵盤・ボタン・ボットの二値入力も従来どおり受ける。
  const steer = falling ? 0 : Number.isFinite(input?.steer)
    ? Math.max(-1, Math.min(1, input.steer))
    : ((input?.right ? 1 : 0) - (input?.left ? 1 : 0));
  let grip = game.air > 0 ? JUMP.steerInAir : 1;
  if (game.air > 0 && game.airKind === "big") {
    spinStep(game, Math.sign(steer), dt);
    if (game.spinDir !== 0) grip = 0; // 回っている間は横へ動かない
  }
  game.vx += steer * STEER.accel * grip * dt;
  const curve = curveAt(game.course, game.z);
  // 外へ流す力。曲がる向きへ切っている間は板が砂を噛んで流されない（よける力は直線と同じ）。何もしない・外へ切ると流される
  const bite = Math.max(0, Math.min(1, steer * Math.sign(curve))) * grip;
  game.vx -= curve * STEER.curveDrift * (game.speed / SPEED.max) * (1 - bite) * dt;
  // カービング: カーブの地上で、曲がる向きへ切り込んでいる間（外へ流されるのに耐えている間）
  const carve = !falling && game.air <= 0 && Math.abs(curve) >= CARVE.minCurve && steer * curve > 0 && Math.abs(game.x) <= EDGE
    ? Math.abs(steer) * Math.min(1, Math.abs(curve)) : 0;
  game.carving = carve > 0;
  if (carve > 0) {
    game.stats.carveTime += dt;
    chargeBoost(game, CARVE.gaugePerSec * carve * dt);
    game.carveT += carve * dt;
    if (game.carveT >= CARVE.tickSec) {
      game.carveT -= CARVE.tickSec;
      game.stats.carves += 1;
      award(game, "carve", CARVE.points, { combo: false, at: { dir: Math.sign(curve) } });
    }
  }
  game.vx *= Math.max(0, 1 - STEER.damping * dt);
  game.x += game.vx * dt;
  if (game.x > 1.05) { game.x = 1.05; game.vx = Math.min(0, game.vx); }
  if (game.x < -1.05) { game.x = -1.05; game.vx = Math.max(0, game.vx); }
  const z0 = game.z;
  game.z += game.speed * dt;
  if (game.air > 0) {
    game.stats.airTime += dt;
    game.air -= dt;
    if (game.air <= 0) land(game);
  }
  // 越えた要素を順に判定する
  for (const feature of game.course.features) {
    if (game.passed.has(feature) || feature.z > game.z) continue;
    if (feature.z <= z0 && !game.passed.has(feature)) { game.passed.add(feature); continue; }
    game.passed.add(feature);
    if (feature.kind === "bump") {
      game.lastBump = { t: game.t, used: false };
      if (game.pendingBump) { game.pendingBump = false; game.lastBump.used = true; continue; }
      if (game.air > 0) { game.lastBump.used = true; continue; } // 空中で越えた
      if (falling) continue;
      // ボタンを押さずに起伏に乗った: 小さく跳ねて少し遅くなる（転倒ではない）
      game.speed = Math.max(SPEED.min, game.speed * SPEED.bounceLoss);
      startAir(game, "bounce");
      continue;
    }
    const dx = Math.abs(game.x - feature.x);
    // 大ジャンプはどの岩も越える。ホップは小さい岩ならいつでも、大きい岩は跳んだ高い所で（JUMP.hopClearsBig）
    const cleared = game.air > 0 && game.airKind !== "bounce"
      && (game.airKind === "big" || feature.size === "small" || jumpHeight(game) >= JUMP.hopClearsBig);
    if (dx < feature.w + PLAYER.half && !cleared) {
      if (smashing(game) && !falling) {
        // ブースト中（と、その勢いが残る間）は岩を砕いて進む
        game.stats.smashed += 1;
        game.smashedRocks.add(feature);
        // 砕くたびにブーストの残りが減る（よけて進むほど長く速い）。残り smashFloor 秒までは削らない
        const boostBefore = game.boostT;
        if (boostBefore > 0) game.boostT = Math.max(Math.min(boostBefore, BOOST.smashFloor), boostBefore - BOOST.smashCost);
        award(game, "smash", SCORE.smash, { at: { x: feature.x, size: feature.size, boostLost: boostBefore - game.boostT } });
        continue;
      }
      if (!falling) fall(game, feature);
      continue;
    }
    const margin = dx - (feature.w + PLAYER.half); // 当たり判定からの余白（跳び越えた時は負になりうる）
    if (margin < NEAR.width && !falling) {
      const closeness = cleared ? NEAR.airCloseness : 1 - Math.max(0, margin) / NEAR.width;
      const near = nearReward(closeness);
      game.stats.nearMiss += 1;
      award(game, "near", near.points, { at: { dx, closeness } });
      chargeBoost(game, near.gauge);
    }
  }
  if (game.rival) stepRival(game, dt);
  if (game.z >= game.course.length) finish(game);
  return game;
}

/** 相手の再生を進める（RUBBER）。差が開くと追いつく／手加減する。追いついた分はゴール手前までに返す。 */
export function rubberCaps(progress) {
  const R = RUBBER, p = Math.max(0, Math.min(1, progress));
  return { lead: R.lead * Math.max(0, Math.min(1, (R.settleAt - p) / (R.settleAt - R.holdUntil))), lag: R.keep + (R.lag - R.keep) * Math.min(1, (1 - p) / R.lastStretch) };
}
function stepRival(game, dt) {
  const rival = game.rival, R = RUBBER;
  const rivalZ = rivalAt(rival, game.rivalClock).z;
  const lead = game.z - rivalZ, dev = game.rivalClock - game.t;
  const caps = rubberCaps(Math.max(game.z, rivalZ) / game.course.length);
  let target = 1;
  if (lead > R.gap) target = 1 + (R.catchUp - 1) * Math.min(1, (lead - R.gap) / R.span);
  else if (lead < -R.gap) target = 1 - (1 - R.easeOff) * Math.min(1, (-lead - R.gap) / R.span);
  // 前後が入れ替わったら、追い上げ（dev > 0）・手加減（dev < 0）の分はすぐ返す（記録より先へ逃げない・抜いた後まで手加減しない）
  if (lead < 0 && dev > 0) target = Math.min(target, 1 - Math.min(R.settle, dev * 2));
  else if (lead > 0 && dev < 0) target = Math.max(target, 1 + Math.min(R.settle, -dev * 2));
  // 上限を超えないように（超えていれば戻す）
  else if (dev > caps.lead) target = Math.min(target, 1 - Math.min(R.settle, (dev - caps.lead) * 2));
  else if (dev < -caps.lag) target = Math.max(target, 1 + Math.min(R.settle, (-caps.lag - dev) * 2));
  else if (target > 1) target = Math.min(target, 1 + (caps.lead - dev) * 2);
  else if (target < 1) target = Math.max(target, 1 - (dev + caps.lag) * 2);
  game.rivalRate += (target - game.rivalRate) * Math.min(1, dt * R.ease);
  game.rivalClock += dt * game.rivalRate;
  if (game.rivalFinishT === null && game.rivalClock >= rival.finishTime) game.rivalFinishT = game.t;
}

/** 大ジャンプ中の回転。steer は -1／0／1（画面の左／なし／右）。 */
function spinStep(game, steer, dt) {
  if (game.spinArmed === null) game.spinArmed = steer === 0; // 跳んだ瞬間に押していた向きは、一度離すまで使わない
  else if (steer === 0) game.spinArmed = true;
  game.spinHold = game.spinArmed && steer !== 0 && (game.spinDir === 0 || steer === game.spinDir);
  if (game.spinHold) game.spinDir = steer;
  if (game.spinDir === 0) return;
  const turns = Math.abs(game.rot);
  if (game.spinHold) game.rot = game.spinDir * (turns + SPIN.rate * dt);
  else {
    const target = Math.ceil(turns * 2 - 1e-9) / 2; // 次の半回転まで回り切る
    game.rot = game.spinDir * Math.min(target, turns + SPIN.finishRate * dt);
  }
}

function finish(game) {
  game.finished = true;
  game.finishTime = game.t;
  game.z = game.course.length;
  if (game.course.practice) return;
  game.score += SCORE.finish;
  const bonus = Math.max(0, Math.round((SCORE.timePar - game.t) * SCORE.timeBonusPerSec));
  game.score += bonus;
  if (game.rival) {
    // 相手がゴールした時刻（再生の速さを変えているので、記録の finishTime ではなく実際の時刻）。まだなら残りの再生時間から見積もる
    const who = game.rival.who || "noor", rivalT = game.rivalFinishT ?? game.t + Math.max(0, game.rival.finishTime - game.rivalClock);
    const won = game.rivalFinishT === null;
    const bonus = won ? (who === "naru" ? SCORE.raceWinNaru : SCORE.raceWin) : 0;
    game.race = { won, gap: Math.round(Math.abs(rivalT - game.t) * 10) / 10, rivalTime: Math.round(rivalT * 10) / 10, who };
    game.score += bonus;
    game.events.push({ kind: "race", t: game.t, ...game.race, points: bonus });
  }
  game.score = Math.max(0, Math.round(game.score));
  game.events.push({ kind: "finish", t: game.t, bonus });
}

export const rankOf = score => RANKS.find(([, min]) => score >= min)[0];
export const rankAtLeast = (rank, need) => RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf(need);

/** 結果（リザルト画面・保存用）。完走していなければ finished:false・rank:null。 */
export function summary(game) {
  const time = Math.round((game.finishTime ?? game.t) * 10) / 10;
  const score = game.course.practice ? 0 : Math.max(0, Math.round(game.score)); // 練習は採点しない
  return {
    rulesVersion: RULES_VERSION, finished: game.finished, score, rank: game.finished ? rankOf(score) : null, time,
    maxCombo: game.maxCombo, falls: game.falls, bigJumps: game.stats.bigJumps, perfect: game.stats.perfect,
    good: game.stats.good, nearMiss: game.stats.nearMiss, seed: game.course.seed,
    tricks: game.stats.tricks, bestTrick: game.stats.bestTrick, boosts: game.stats.boosts, smashed: game.stats.smashed,
    recoveries: game.stats.recoveries, carves: game.stats.carves, courseId: game.course.id ?? null, courseName: game.course.name ?? null,
    race: game.race ? { ...game.race } : null,
  };
}

/** 保存する記録の形を検査して整える（形が合わなければ null）。 */
export function readResult(value) {
  if (!value || typeof value !== "object" || value.finished !== true) return null;
  if (value.rulesVersion != null && value.rulesVersion !== 1 && value.rulesVersion !== RULES_VERSION) return null;
  const n = (v, lo = 0) => Number.isFinite(v) && v >= lo ? v : null;
  const score = n(value.score), time = n(value.time), maxCombo = n(value.maxCombo), falls = n(value.falls);
  if (score === null || time === null || maxCombo === null || falls === null || !RANK_ORDER.includes(value.rank)) return null;
  const race = value.race && typeof value.race === "object" && typeof value.race.won === "boolean" && n(value.race.gap) !== null
    ? { won: value.race.won, gap: Math.round(value.race.gap * 10) / 10, who: value.race.who === "naru" ? "naru" : "noor" } : null;
  return { ...(value.rulesVersion === RULES_VERSION ? { rulesVersion: RULES_VERSION } : {}), finished: true, score: Math.round(score), rank: value.rank, time: Math.round(time * 10) / 10, maxCombo: Math.round(maxCombo), falls: Math.round(falls),
    bigJumps: Math.round(n(value.bigJumps) ?? 0), perfect: Math.round(n(value.perfect) ?? 0), good: Math.round(n(value.good) ?? 0), nearMiss: Math.round(n(value.nearMiss) ?? 0),
    tricks: Math.round(n(value.tricks) ?? 0), bestTrick: Math.round(n(value.bestTrick) ?? 0), boosts: Math.round(n(value.boosts) ?? 0), race };
}

const BOT_PLANS = Object.freeze([[0, 0], ...[-1, 1].flatMap(dir => [0.2, 0.45, 0.8, 1.4].map(hold => [dir, hold]))]);
const BOT_LOOK = Object.freeze({ horizon: 2.2, dt: 1 / 20, every: 3, commit: 0.35 });
/**
 * 自動操作の舵。2.2秒先まで横の動き（慣性・カーブで外へ流される力）を試算し、岩に当たらず端にも出ない押し方を選ぶ。
 * 「何もしない／左右どちらかを 0.2〜1.4 秒押して離す」の中から、いちばん安全で自分の位置（lane）へ戻れるものを選び直す（every 歩ごと）。
 */
function botSteer(game, skill, memo) {
  memo.steerTick = (memo.steerTick ?? -1) + 1;
  if (memo.steerDir != null && memo.steerTick % BOT_LOOK.every !== 0) return { left: memo.steerDir < 0, right: memo.steerDir > 0 };
  const course = game.course, speed = Math.max(SPEED.min, game.speed), { horizon, dt } = BOT_LOOK, lane = memo.lane ?? 0;
  const steps = Math.round(horizon / dt), reach = game.z + speed * horizon + 4;
  // 空中の区間（今の大ジャンプと、これから跳ぶ起伏）。大ジャンプ中は岩を越え、← → は回転に使うので横へは動かさない
  // 飛ぶ距離は短めに見積もる（ブーストが切れると速さが落ちる）。着地のすぐ先の岩は、跳ぶ前から位置をずらしてよける
  const spans = [], glide = time => (game.boostT >= time ? speed : Math.min(speed, SPEED.max)) * time * 0.95;
  if (game.air > 0 && game.airKind === "big") spans.push([game.z, game.z + glide(game.air)]);
  const rocks = [];
  for (const f of course.features) {
    if (f.z <= game.z || f.z > reach || game.passed.has(f)) continue;
    if (f.kind === "rock") rocks.push(f);
    else if (skill !== "none") spans.push([f.z, f.z + glide(JUMP.bigAir * (0.85 + 0.3 * Math.min(1, speed / SPEED.max)))]);
  }
  const inAir = z => spans.some(([from, to]) => z >= from && z < to);
  // 各歩の地面の状態は、どの押し方でも同じ（前へ進む速さは変わらない）
  const drift = new Float64Array(steps), side = new Int8Array(steps), grip = new Uint8Array(steps), hits = [];
  for (let k = 0; k < steps; k++) {
    const z = game.z + speed * dt * k, curve = curveAt(course, z);
    drift[k] = curve * STEER.curveDrift * (speed / SPEED.max) * dt; side[k] = Math.sign(curve); grip[k] = inAir(z) ? 0 : 1;
    hits.push(rocks.filter(rock => rock.z > z && rock.z <= z + speed * dt && !inAir(rock.z)));
  }
  const damp = Math.max(0, 1 - STEER.damping * dt);
  let best = null;
  for (const [dir, hold] of BOT_PLANS) {
    // 無駄に切らない。前と同じ向きを少し優先して、岩の正面で左右に迷わない
    let x = game.x, vx = game.vx, cost = (dir === 0 ? 0 : 0.04 + hold * 0.02) + (memo.steerDir && dir !== memo.steerDir ? BOT_LOOK.commit : 0);
    for (let k = 0; k < steps; k++) {
      const steer = k * dt < hold ? dir * grip[k] : 0;
      vx = (vx + steer * STEER.accel * dt - drift[k] * (1 - Math.max(0, steer * side[k]))) * damp;
      x = Math.max(-1.05, Math.min(1.05, x + vx * dt));
      for (const rock of hits[k]) {
        const gap = Math.abs(x - rock.x) - rock.w - PLAYER.half;
        cost += gap < 0.05 ? 1000 * (1 + horizon - k * dt) : Math.max(0, 0.5 - gap) * 3; // 当たるのは論外。空いていれば余裕を取る
      }
      if (Math.abs(x) > EDGE - 0.06) cost += 40 * dt; // 端の深い砂
    }
    cost += Math.abs(x - lane) * 1.2;
    if (!best || cost < best.cost - 1e-9) best = { dir, cost };
  }
  memo.steerDir = best.dir;
  return { left: best.dir < 0, right: best.dir > 0 };
}

/**
 * 検証・デモ・ヌール用の自動操作。skill:
 * "expert"（全部よけて起伏で跳び、空中で 360〜720 回って着地を決め、ゲージが満ちたらブースト）／"perfect"（回らないが着地を決め、ブーストも使う）／
 * "good"（着地が少し遅い。ブーストは使う）／"rival"（ヌール。good と同じ滑り）／
 * "none"（跳ばずによけるだけ）／"lazy"（反応が遅くよく転ぶ）。
 * 戻り値は { input, action } で、action は押すべき時に "press"（ジャンプ・着地の構え）か "boost"。乱数を使わないので同じコースなら同じ結果になる。
 */
export function botControl(game, skill = "perfect", memo = {}) {
  let input;
  if (skill === "lazy") {
    // 反応が遅い人: すぐ手前の岩だけを見て大きくよけ、時々手が止まる
    const ahead = game.course.features.filter(f => f.kind === "rock" && !game.passed.has(f) && f.z > game.z && f.z - game.z < 22);
    let target = memo.lane ?? 0;
    if (ahead.length) {
      const first = ahead[0], row = ahead.filter(r => Math.abs(r.z - first.z) < 1);
      let best = null;
      for (let x = -0.8; x <= 0.8001; x += 0.05) {
        const d = Math.min(...row.map(r => Math.abs(x - r.x) - r.w - PLAYER.half));
        const cost = -Math.min(d, 0.6) * 3 + Math.abs(x - game.x) * 0.6;
        if (!best || cost < best.cost) best = { x, cost };
      }
      target = best.x;
    }
    const slow = Math.floor(game.t * 4) % 3 === 0; // 時々手が止まる
    input = slow ? { left: false, right: false } : { left: game.x > target + 0.03, right: game.x < target - 0.03 };
  } else input = botSteer(game, skill, memo);
  let action = null;
  const jumps = ["expert", "perfect", "good", "rival"].includes(skill);
  const braceAt = skill === "expert" || skill === "perfect" ? 0.2 : 0.45;
  if (game.air > 0 && game.airKind === "big" && skill !== "expert") input = { left: false, right: false }; // 大ジャンプ中の ← → は回転なので、回らない人は触らない
  if (game.air > 0 && game.airKind === "big" && skill === "expert") {
    // 空中トリック: 一度手を離してから右（跳ぶたびに左右を替える）を押し続け、目標の手前で離す（離すと次の半回転まで回り切る）
    if (memo.spinJump !== game.lastJumpT) { memo.spinJump = game.lastJumpT; memo.spinSide = memo.spinSide === "right" ? "left" : "right"; memo.spinGoal = game.airTotal > 1.2 && !memo.only360 ? 1.55 : 0.55; }
    input = { left: false, right: false };
    if (game.spinArmed && Math.abs(game.rot) < memo.spinGoal) input[memo.spinSide] = true;
  }
  if (jumps && game.air <= 0 && nextBumpDistance(game) <= game.speed * JUMP.bumpWindow * 0.8) { action = "press"; memo.braced = false; }
  else if (game.air > 0 && game.airKind === "big" && !memo.braced && game.air <= braceAt) { action = "press"; memo.braced = true; }
  else if (jumps && game.fallT <= 0) {
    // ゲージを無駄にしない使い方: 満タンで使う／加速中は、あふれない分だけ継ぎ足す／ゴールが近づいたら残りを使い切る
    const remaining = game.course.length - game.z, room = 1 - game.boostT / BOOST.duration;
    if (game.boostT <= 0 ? game.gauge >= 1 || (game.gauge >= 0.15 && remaining <= SPEED.boost * BOOST.duration * game.gauge + 20)
      : game.gauge >= 0.3 && game.gauge <= room) action = "boost";
  }
  return { input, action };
}

/** 自動操作の一歩（press／boost を実行してから進める）。ヌールの走りと検査で使う。 */
export function botStep(game, skill, memo, dt) {
  const { input, action } = botControl(game, skill, memo);
  if (action === "press") press(game);
  else if (action === "boost") boost(game);
  step(game, input, dt);
  return game;
}

const RIVAL_SAMPLE = 1 / 30;
/**
 * 本番の競走相手（who: "noor"／"naru"、`RIVALS`）の滑り。同じコースを自動操作で最後まで滑り、ゴールの時刻と、1/30 秒ごとの位置・姿勢を返す。
 * 同じコースなら毎回同じ（決定的）。人物とは当たらない（並んで滑るだけ）。
 */
export function rivalRun(course, { who = "noor", maxTime = 200 } = {}) {
  const { skill, startX, only360, startSpeed } = RIVALS[who] || RIVALS.noor;
  const game = createGame(course), memo = { lane: startX, only360 }, samples = [];
  game.x = startX; game.speed = startSpeed;
  const snap = () => samples.push({ t: game.t, z: game.z, x: game.x, vx: game.vx, air: game.air, airTotal: game.airTotal, airPeak: game.airPeak, airKind: game.airKind,
    landingPress: game.landingPress, fallT: game.fallT, landedAt: game.landedAt, rot: game.rot, boostT: game.boostT });
  snap();
  let next = RIVAL_SAMPLE;
  while (!game.finished && game.t < maxTime) {
    botStep(game, skill, memo, 1 / 60);
    if (game.t >= next - 1e-9 || game.finished) { snap(); next += RIVAL_SAMPLE; }
  }
  return Object.freeze({ who: RIVALS[who] ? who : "noor", finishTime: game.finishTime ?? game.t, samples, falls: game.falls });
}

/** 時刻 t のヌール（rivalRun の結果）。ゴールの後は旗の先で止まる。 */
export function rivalAt(rival, t) {
  const s = rival.samples;
  if (!s.length) return null;
  if (t >= rival.finishTime) {
    const last = s[s.length - 1], after = t - rival.finishTime;
    return { ...last, z: last.z + Math.min(24, after * 14 - after * after * 2.5 * Math.min(1, after / 2.8)), air: 0, airKind: null, fallT: 0, finished: true, t };
  }
  const i = Math.min(s.length - 1, Math.max(1, Math.ceil(t / RIVAL_SAMPLE)));
  const a = s[i - 1], b = s[i];
  const k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
  return { ...a, z: a.z + (b.z - a.z) * k, x: a.x + (b.x - a.x) * k, rot: a.rot + (b.rot - a.rot) * k, t, finished: false };
}


