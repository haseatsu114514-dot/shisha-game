// DESERT RIDE（第4章ドバイ・サンドボード）の規則。コースの生成・1フレームの物理・採点だけを持ち、DOM に触れない。
// 画面と入力は desert-ride.js、本編との接続（行動枠・報酬・保存）は chapters/ch4-desert.js。
// 座標: z はコースに沿った距離（m）、x はコース中央からの横位置（-1〜1 がコース幅、|x|>EDGE は端の深い砂）。
// 2026-11-02 オーナー「もっとスピード感・ゲーム性を」: 空中トリック（大ジャンプ中に ← → で回転）、ブースト（ゲージ満タンで超加速・岩を砕く）、
// ヌールとの競走（同じコースを自動で滑るヌールより先にゴールすれば勝ち）を足した。
// 2026-11-20 オーナー「各ミニゲームに三段階の難易度を追加」（#3779）: ヌールとの勝負に初級・中級・上級（TIER_TUNING）。中級は前と同じ。
import { TIERS } from "../core/play-tiers.js";

// 2026-11-13 オーナー「もっとコースを複雑にしたり少し長くしたい」で 1,700 → 2,000m（1本 約50秒 → 約55〜58秒）。
// 練習は 2026-11-25 に、壁の後へカーブ（切り込み）と砂流れの段を足して 800 → 1,100m、同日カーブを長くして（切り込みを3段で説明）1,250m。
export const COURSE = Object.freeze({ length: 2000, practiceLength: 1460, laneHalf: 1 });
// コースの山と平地（2026-11-13 オーナー「手応えレビューの内容を実装して、より面白く」。docs/spec/desert_ride.md「山と平地」）:
// firstBump: 最初の要素は岩の無い起伏（走り出して約5秒で最初の「跳ぶ」）。start: 乱数の配置が始まる距離。
// gapFrom→gapTo: 要素の間隔（進むほど詰まる）。
// chainFrom: この進み具合を過ぎた最初の所に、岩の無い起伏を chainCount 個・chainGap m おきに並べる（稼ぎ場＝平地）。
// chainGap は「大ジャンプの飛距離（通常の最高速で約50m）＋次を押す間（約0.6秒）」。landing は起伏の先の、岩を置かない距離。
// 連続起伏の先（置けない短いコースでは lastStretch から先）は終盤の山: 間隔は gapLast、岩の無い起伏だけが出る割合を bumpOnly → bumpOnlyLast に下げて岩を増やす。
// 門: 4つの位置のうち3つに小岩（1つだけ空く）。スラローム: 小岩 count 個を gap m おきに、左右 ±x で互い違いに。
export const GATE = Object.freeze({ slots: Object.freeze([-0.66, -0.22, 0.22, 0.66]) });
export const SLALOM = Object.freeze({ count: 4, gap: 36, x: 0.2 });
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
// 2026-11-25 オーナー「カービングに演出を入れたい」: 刻みを 0.8秒・30点 → 0.4秒・15点に細かくした（得点の速さは同じ）。切り込みは内へ寄りすぎないよう
// 押したり離したりするので、1つのカーブで切り込んでいるのは合わせて1秒前後。0.8秒刻みでは1回も刻まずに終わることが多く、刻みごとの音・輪・「+15」が出なかった
export const CARVE = Object.freeze({ minCurve: 0.4, gaugePerSec: 0.1, tickSec: 0.4, points: 15 });
// 砂流れ（2026-11-25 オーナー「サンドボードで通ると加速するゾーンをたまに入れたい。砂流れみたいな見た目にしつつ」）:
// 斜面を砂が川のように流れ落ちている細い帯（course.flows）。地上で帯の上にいる間は、通常の最高速（SPEED.max）を超えて cap まで accel で加速する
// （ブーストより遅く、ゲージも使わない）。出ると、ブーストの後と同じ overDecay で通常の最高速へ戻る。空中・転倒中・端の深い砂では効かない。
// 置き方（placeFlows）: 1本 length m・幅 ±half レーン。コースを count 等分した区間に1本ずつ（「たまに」）、岩の無い帯が取れる所だけに置く:
// 帯の手前 before m・先 after m の間にある岩は、帯の縁から板の半分＋rockMargin より外。起伏は帯の手前 bumpBefore m から帯の終わりまでに無い（大ジャンプの着地の後に入る）。
// 帯の中心は |x| <= maxX。from m より先、ゴールの endRoom m 手前まで。岩の段（#3779）が変わっても同じ所（上級の足す岩は帯を避ける）。
// 帯で速くなった分では岩を砕かない（flowLift。砕けるのはブーストとその勢いだけ）。
export const FLOW = Object.freeze({ length: 70, half: 0.18, cap: 41, accel: 12, count: 3, from: 200, endRoom: 150, before: 15, after: 30, rockMargin: 0.04,
  bumpBefore: 60, maxX: 0.5, scanStep: 10, xStep: 0.05 });
export const SCORE = Object.freeze({ finish: 1200, timePar: 85, // 時間ボーナスの基準（秒）。コースを長くした分だけ延ばした（1,700m の時は 72）
  timeBonusPerSec: 30, perfect: 250, good: 120, comboStep: 0.15, comboMax: 3,
  smash: 100, raceWin: 600, raceWinNaru: 1500 });
// かすめ（2026-11-13 段階制に。それまでは幅の中ならどこでも 60点・ゲージ 0.12 で、2つ岩の真ん中＝いちばん安全な線で2回もらえた）:
// 岩の当たり判定のすぐ外側 width（レーン）の帯。当たる寸前ほど大きく、帯の外寄りほど小さい（closeness 1→0 で max→min）。
// 2つ岩の真ん中（余白 0.15）は 1つ 約49点・ゲージ 約0.07。跳び越えた岩は横の危険を取っていないので真ん中の値（airCloseness）。
export const NEAR = Object.freeze({ width: 0.22, minPoints: 30, maxPoints: 90, minGauge: 0.04, maxGauge: 0.14, airCloseness: 0.5 });
// 競走の相手。ヌールは着地が少し遅い滑り（ブーストは使う）。なる（ヌールに勝った後に来る強敵）は 720 まで回って着地も完璧、ブーストも使う。
// startSpeed: スタートの速さ。ヌールは当初「砂丘のガイドなので出だしが少しだけうまい（+0.6）」だったが、
// 2026-11-14 オーナー判断で撤廃（S評価の滑りでも勝てないことがある体感への対応）。主人公と同速スタートにする。
// なるは 2026-11-13 オーナー「なるが弱かった」で強くした（それまでは 360 止まり・出だしは主人公と同じで、理想の滑りに 0.6〜2.2秒差で負けていた）:
// 720 まで回る（主人公の理想の滑りと同じ腕前）。出だしだけ少し遅く（startSpeed −1.5）、回って着地も決める理想の滑りでやっと勝てる差にした。
// easeOff: 大きく離した時の手加減（RUBBER）。なるは手加減しない（追いつかれたら追い返すのは同じ）。
export const RIVALS = Object.freeze({
// charge・boostAt（2026-11-13 オーナー「ライバルももっとブースト使って接戦っぽくしたい」）: 貯まる量の倍率と、使い始めるゲージの量。
// 満タンまで待たず小刻みに使うので、ブーストの回数が増えて目に入る。
// ヌールの charge は当初 1.15 だったが、2026-11-14 オーナー判断で 1 に戻した（素のゴールタイムは全コース 59.1〜59.4 秒で、
// 着地を決めてブーストを使う滑り（A評価の目安）に 1.3〜2.3 秒差、着地の甘い滑り（B評価の目安）とは互角になる）。boostAt 0.3 は据え置き。
// 2026-11-25 オーナー「砂の流れがなくても結構簡単にクリアできちゃったから、もう少し成績と敵の強さ上げたい」（DSR89）:
// ヌール（中級）を一段強くした。着地が少し遅い滑り（skill "rival"）→ 着地を決める滑り（"perfect"）、溜まり 1 → 1.03。
// 着地を決める滑り（回らない）で勝てるのは約半分（それまでは必ず勝てた）、回れば勝てる。なるは前のまま（理想の滑りに 0.3〜0.8 秒差で負ける所が、もう上限）。
  noor: Object.freeze({ skill: "perfect", startX: -0.42, only360: false, startSpeed: SPEED.start, charge: 1.03, boostAt: 0.3 }),
  naru: Object.freeze({ skill: "expert", startX: 0.42, only360: false, startSpeed: SPEED.start - 2.6, easeOff: false, charge: 1, boostAt: 0.3 }),
});
// 空中トリック: 大ジャンプ中に ← か → を押している間だけ回る（rate 回転/秒）。離すと次の半回転まで finishRate で回り切る。
// 着地の瞬間に半回転の区切りから tolerance（回転）以上ずれていると転倒。points は半回転の数ごとの得点（180, 360, 540 …）。
// 跳んだ瞬間から押していた向きは、一度離すまで回転に使わない（よけながら跳んだだけで回り出さないように）。
export const SPIN = Object.freeze({ rate: 1.7, finishRate: 3.2, tolerance: 0.1, points: Object.freeze([0, 150, 400, 700, 1100, 1500, 2000, 2600, 3300]) });
// ブースト: かすめ・大ジャンプの着地・トリックでゲージ（0〜1）が貯まり、minGauge 以上で残量に比例した時間だけ発動できる。duration 秒のあいだ速度の上限が SPEED.boost になり、
// 当たった岩は砕ける（転倒しない）。転倒するとゲージが fallLoss 減るが、転倒前の半分は残す（空のゲージは増やさない）。岩に当たった直後（recoverWindow 秒）にゲージがあれば、ブーストで立て直せる（転倒を取り消して加速する）。
// いい勝負（2026-11-11 オーナー「ライバルとの距離が離れすぎたらついてきたり、逆に離れすぎたら少し手加減してくれたり、いい勝負してる感を出したい」）:
// 相手は記録した滑り（rivalRun）を、差に応じた速さで再生する（game.rivalClock）。差が gap メートルを超えると、
// 離した時は最大 catchUp 倍まで速く（追いつく）、離された時は最低 easeOff 倍まで遅く（手加減）。span メートルで最大に届く。
// ずれ（rivalClock − t）の上限は進み具合で変える: 追いついた分は lead 秒まで。holdUntil（6割）を過ぎたら、ゴールの少し手前（settleAt）で
// 0 になるまで返す（終盤に相手がバテて引き離せる。勝ちは腕前のまま奪わない）。手加減は lag 秒まで、終盤（lastStretch）から keep 秒まで戻す（大きく離された時だけ少し勝ちやすい）。
// 上限を超えた分は settle 秒/秒までの速さで戻す。
// 2026-11-13 オーナー「接戦っぽくしたい」で gap 20 → 12・span 50 → 40（近くで競り合う時間を長く）。
export const RUBBER = Object.freeze({ gap: 12, span: 40, catchUp: 1.25, easeOff: 0.75, lead: 3, lag: 3, keep: 0.5, holdUntil: 0.6, settleAt: 0.95, lastStretch: 0.3, settle: 0.3, ease: 6 });
// 三段階（#3779・core/play-tiers.js）: ヌールとの勝負（「滑る」）だけに効く。なるとの勝負と練習は段の外（中級のコース・なるの値のまま）。
// 中級は今の遊びと同じ（上書きなし）。ここが段ごとの調整値の一か所で、前と違うのは書いた値だけ（コースの4本・カーブ・得点・評価の境目は同じ）。
// - rocks: 岩の多さ。中級の同じコース（起伏・カーブ・長さは同じ）から作る。
//   thin: 岩の列（同じ距離に並ぶ岩）を、この数ごとに1つだけ残す（初級は2つに1つ。本番の4本で岩 31/23/18/36 → 17/12/8/21）。
//   fill: 岩の無い長い区間に岩を1つ足す（上級。同 → 35/30/22/40）。前の岩から before m・起伏の後は afterBump m（大ジャンプの着地から曲がる間。
//   64 では上級のヌールが着地の先の岩をかすめて転ぶコースがあった）・次の岩や起伏まで after m を空ける。
// - noor: ヌールの滑り（RIVALS.noor の上書き）。charge＝ゲージの溜まり（ブーストの回数）、boostAt＝使い始める量、startSpeed＝出だしの速さ、
//   skill＝着地の腕（"perfect" は着地を決める。中級のヌールは "rival"＝着地が少し遅い）。
// - rubber: いい勝負の手加減（RUBBER の上書き）。easeOff が小さいほど・lag／keep が長いほど、大きく離された時に待ってくれる。
// 目安（2026-11-20 に remake/test/desert_ride.mjs のボットで照合。本番の4本×滑る位置10通り）: 初級は着地の甘い滑り（B評価の目安）で 100%。
// 中級は前と同じ（同じ滑りで 10%・着地を決めると 100%）。上級は着地を決める滑り（A評価の目安）で 33%、回って決める滑り（S）なら 100%。
// 上級のヌールのゴールは 57〜58 秒で、なる（53〜56 秒）よりは遅い。初級のヌールは 62 秒前後。
// 上級の charge は 1 にすると、ブーストで岩へ突っ込んで転ぶコースが出た（0.95 と出だし +0.2 で同じくらいの速さにした）。
// 2026-11-25（DSR89）に三段とも一段強くした（上の目安は 2026-11-20 の値）: 初級は着地の甘い滑りで 75%・着地を決めれば 100%。
// 中級は着地の甘い滑りで 0%・回らず着地を決める滑りで 45%・回れば 100%。上級は回らないと 0%・360 だけで 58%・720 まで回れば 100%。
// 上級のヌールは 360 を回るので、なるとの差は 0.1〜2 秒に縮んだ（コースDがいちばん近い。溜まりを 0.97 より上げると、なるより速くなるコースが出る）。
export const TIER_TUNING = Object.freeze({
  easy: Object.freeze({
    rocks: Object.freeze({ thin: 2 }),
    // 2026-11-25（DSR89）: 出だし −2・溜まり 0.55・使い始め 0.45 → 着地の遅い滑りのまま、出だし −0.5・溜まり 0.85・使い始め 0.4（前の中級に近い）
    noor: Object.freeze({ skill: "rival", startSpeed: SPEED.start - 0.5, charge: 0.85, boostAt: 0.4 }),
    rubber: Object.freeze({ easeOff: 0.6, lag: 4, keep: 1 }),
  }),
  normal: Object.freeze({ rocks: Object.freeze({}), noor: Object.freeze({}), rubber: Object.freeze({}) }),
  hard: Object.freeze({
    rocks: Object.freeze({ fill: Object.freeze({ before: 32, afterBump: 84, after: 32 }) }),
    // 2026-11-25（DSR89）: 着地を決める滑り → 360 を回って着地も決める滑り（only360）。溜まり 0.97・出だし −0.3（なるより少し遅い所）
    noor: Object.freeze({ skill: "expert", only360: true, charge: 0.97, startSpeed: SPEED.start - 0.3 }),
    rubber: Object.freeze({ easeOff: 0.88, lag: 2, keep: 0.25 }),
  }),
});
/** 段の名前をそろえる（知らない値・段なしは中級＝段ができる前の遊び）。 */
export const tierOf = tier => TIERS.includes(tier) ? tier : "normal";
// ブーストの代償（2026-11-13。それまでは純粋な得で、突っ込むほど良かった）: 岩を砕くたびに残り時間が smashCost 秒減る
// （smashFloor 秒までは残す＝砕いた直後に切れて次の岩で転ばない）。端の深い砂（|x|>EDGE）に入ると、その場でブーストが切れる。
// practiceRecoverWindow: 練習の立て直しの猶予（初めてでも間に合う長さ）。
// 溜まり方（2026-11-13 オーナー「ブーストの溜まり具合をもう少しだけゆるやかに全体で」）: かすめ・着地・トリック・カービングで貯まる量に
// CHARGE を一律に掛ける（0.85＝それまでの約15%ゆるやか）。練習の説明が渡す量（chargeBoost の直呼び）には掛けない。
// 使わないと減る（同「ブーストは使わないとじわじわ減ってく仕様も欲しい」）: 最後に貯まってから decayDelay 秒たつと、毎秒 decay ずつ減る
// （満タンから空まで約30秒。ブースト中・ゴール後は減らない）。
export const CHARGE = 0.85;
export const BOOST = Object.freeze({ minGauge: 0.25, duration: 3, land: 0.05, perfect: 0.22, good: 0.1, trickPerHalf: 0.1, fallLoss: 0.3, recoverWindow: 0.45, practiceRecoverWindow: 0.9,
  smashCost: 0.35, smashFloor: 0.2, decay: 0.033, decayDelay: 2.5 });
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
  // B・C: 大きく左（右）へ回り込んでから、S字で切り返す。D: 細かい切り返しが続く（2026-11-13 に 2,000m へ延ばしてS字を足した）
  Object.freeze({ id: "left-bowl", name: "コースB", seed: 19, curves: Object.freeze([
    { z: 0, c: 0 }, { z: 220, c: 0 }, { z: 420, c: -0.9 }, { z: 700, c: -1 }, { z: 880, c: -0.2 }, { z: 1040, c: 0.85 }, { z: 1220, c: 0.6 },
    { z: 1400, c: -0.75 }, { z: 1580, c: -1 }, { z: 1760, c: 0.4 },
  ]) }),
  Object.freeze({ id: "right-crest", name: "コースC", seed: 23, curves: Object.freeze([
    { z: 0, c: 0 }, { z: 220, c: 0 }, { z: 420, c: 0.9 }, { z: 700, c: 1 }, { z: 880, c: 0.2 }, { z: 1040, c: -0.85 }, { z: 1220, c: -0.6 },
    { z: 1400, c: 0.75 }, { z: 1580, c: 1 }, { z: 1760, c: -0.4 },
  ]) }),
  Object.freeze({ id: "switchback", name: "コースD", seed: 11, curves: Object.freeze([
    { z: 0, c: 0 }, { z: 180, c: 0 }, { z: 340, c: 0.95 }, { z: 500, c: -0.6 }, { z: 680, c: -1 }, { z: 840, c: 0.2 }, { z: 1000, c: 1 },
    { z: 1160, c: -0.3 }, { z: 1340, c: -0.95 }, { z: 1520, c: 0.6 }, { z: 1700, c: 0.9 },
  ]) }),
]);
// 2026-11-13 にコースを 2,000m へ延ばした分、境目も同じ割合で上げた（1,700m の時は S 12,000・A 6,000・B 3,500）。どの腕前がどの評価かは変わらない
// 2026-11-17 オーナー「ランクの判定を全体的にもう一回り難しくしたい」（転倒1回・ヌールに負けて 14,199点が S だった）で、境目を約2割上げた
// （S 14,000 → 17,000・A 7,000 → 8,000・B 4,000 → 5,000）。A は、回らない理想の滑りが4コースすべてで A に残る所まで（コースDが 8,441。8,500 にすると B に落ち、本編の検査「回らないが着地を決める＝A」が崩れた）。点の付け方は同じなので RULES_VERSION は変えない（保存済みの最高評価はそのまま残る）。
// コースAのボット: 回る理想 約30,900＝S、360だけ 約17,500＝S、回らない理想 約9,000＝A、着地が「良い」止まり 約6,900＝B、跳ばない 約3,600＝C
// 2026-11-25 オーナー「もう少し成績…上げたい」（DSR89）で、もう一段上げた: S 17,000 → 22,000・A 8,000 → 10,000・B 5,000 → 6,000。
// 本番の4本×滑る位置10通りのボット（中級のヌールと競走）で: 720 まで回る滑り＝いつも S、360 だけ＝S が約4割・残りは A、
// 回らず着地を決める＝B（約2割は A）、着地が遅い＝B と C が約2:1、跳ばない＝C。点の付け方は同じなので RULES_VERSION は変えない
export const RANKS = Object.freeze([["S", 22000], ["A", 10000], ["B", 6000], ["C", 0]]);
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
    } else if (roll < 0.46) {
      features.push(rock(z, side())); // 終盤の山では、起伏だけの分もここ（岩1つ）になる
    } else if (roll < 0.58) {
      // 2つの岩の間を抜ける。間隔は必ず板の幅の3倍以上
      const center = (random() - 0.5) * 0.7;
      features.push(rock(z, center - 0.42), rock(z, center + 0.42));
    } else if (roll < 0.7 && progress > 0.25) {
      // ジグザグの小岩3つ。ひとつずつ見える距離を置く
      const dir = random() < 0.5 ? -1 : 1;
      features.push(rock(z, dir * 0.4, "small"), rock(z + 34, -dir * 0.3, "small"), rock(z + 68, dir * 0.15, "small"));
      z += 68;
    } else if (roll < 0.8 && progress > 0.2) {
      // 門（2026-11-13）: 横に4つ並ぶ所の1つだけが空いた小岩の列。空いた所を抜けるか、跳ぶか（ホップで越えられる）、
      // 端の深い砂へ回り込む（遅くなる）か。空きの幅は板の2倍強
      const open = Math.floor(random() * GATE.slots.length);
      for (const [i, x] of GATE.slots.entries()) if (i !== open) features.push(rock(z, x, "small"));
    } else if (roll < 0.9 && progress > 0.35) {
      // スラローム（2026-11-13）: 小岩が左右互い違いに並ぶ。まっすぐでも抜けられるが、寄せて縫うほど「かすめ」が稼げる
      const dir = random() < 0.5 ? -1 : 1;
      for (let i = 0; i < SLALOM.count; i++) features.push(rock(z + SLALOM.gap * i, dir * (i % 2 ? -1 : 1) * SLALOM.x, "small"));
      z += SLALOM.gap * (SLALOM.count - 1);
    } else if (progress > 0.3) {
      // 起伏の先に岩: 着地してから曲がる時間（64m 以上）を取る
      features.push(bump(z), rock(z + 64, side()));
      z += 64;
    } else {
      features.push(rock(z, side(), "small"));
    }
    z += minGap(progress) + random() * 26;
  }
  // カーブ（2026-11-13 S字を多く）: 130〜270m おきに要所。前と逆向きへ切り返す（S字）ことが多く、たまにまっすぐ
  const curves = [{ z: 0, c: 0 }];
  let lastC = 0;
  for (let at = 200; at < length - 120; at += 130 + random() * 140) {
    const size = [0.6, 0.85, 1][Math.floor(random() * 3)];
    const turn = random() < 0.15 ? 0 : lastC !== 0 && random() < 0.6 ? -Math.sign(lastC) : (random() < 0.5 ? -1 : 1);
    lastC = turn * size;
    curves.push({ z: at, c: lastC });
  }
  curves.push({ z: length - 60, c: 0 }, { z: length + 400, c: 0 });
  features.sort((a, b) => a.z - b.z);
  return decorateCourse({ seed, length, features, curves, flows: placeFlows(features, length), practice: false, id: packId(seed), name: packName(seed) });
}

/** 砂流れの帯 flow の上か（横位置 x、距離 z）。帯の縁は板の中心で見る。 */
export const onFlow = (flow, z, x) => z >= flow.z && z < flow.z + flow.length && Math.abs(x - flow.x) <= flow.half;
/** 地点 (z, x) の砂流れ（無ければ null）。 */
export function flowAt(course, z, x) {
  for (const flow of course.flows || []) if (onFlow(flow, z, x)) return flow;
  return null;
}
/** 帯の中心 x・始まり z に置いた時、岩と起伏から離れているか（FLOW の置き方の条件）。 */
function flowClear(features, z, x) {
  const F = FLOW, end = z + F.length;
  for (const f of features) {
    if (f.kind === "bump") { if (f.z > z - F.bumpBefore && f.z < end) return false; continue; }
    if (f.z < z - F.before || f.z > end + F.after) continue;
    if (Math.abs(f.x - x) <= f.w + F.half + PLAYER.half + F.rockMargin) return false;
  }
  return true;
}
/**
 * 砂流れの帯を置く（決定的・乱数なし。features は変えない）。コースを FLOW.count 等分し、各区間で置ける所のうち
 * 通れる幅がいちばん広い所（同じなら手前）に1本。置ける所が無い区間は置かない。帯の中心は、その所で岩の無い横の範囲の真ん中。
 */
export function placeFlows(features, length) {
  const F = FLOW, flows = [];
  const span = (length - F.endRoom - F.length - F.from) / F.count;
  for (let i = 0; i < F.count; i++) {
    const from = F.from + span * i, to = from + span;
    let best = null;
    for (let z = Math.ceil(from / F.scanStep) * F.scanStep; z < to; z += F.scanStep) {
      if (flows.length && z < flows[flows.length - 1].z + F.length + F.after) continue;
      // 置ける x の範囲（xStep 刻み）のうち、いちばん広い連なり
      let run = null, widest = null;
      for (let k = Math.round(-F.maxX / F.xStep); k <= Math.round(F.maxX / F.xStep); k++) {
        const x = Math.round(k * F.xStep * 100) / 100;
        if (flowClear(features, z, x)) { run = run ? { from: run.from, to: x } : { from: x, to: x }; if (!widest || run.to - run.from > widest.to - widest.from) widest = run; }
        else run = null;
      }
      if (widest && (!best || widest.to - widest.from > best.width + 1e-9)) best = { z, x: Math.round((widest.from + widest.to) / 2 * 100) / 100, width: widest.to - widest.from };
    }
    if (best) flows.push(Object.freeze({ kind: "flow", z: best.z, x: best.x, half: F.half, length: F.length }));
  }
  return Object.freeze(flows);
}

/**
 * 練習コース: まっすぐ → 岩1つ → 起伏（跳ぶ・着地）→ 岩 → 起伏（空中で回る）→ 岩2つ（ブーストで砕く）→ 岩の壁（わざと当たって立て直す）
 * → 左カーブ（切り込む）→ 砂流れ（乗ってみる）。2026-11-25 にカーブと砂流れを足した（本番で「切り込め」の文字を出さなくなったので、練習で教える）。
 * 説明の順番が固定なので乱数は使わない。壁（PRACTICE_WALL）は4つ並びで、コースの中（端の深い砂の内側）ではよけられない（立て直しを一度やってみる所）。
 * カーブ（PRACTICE_CURVE）は岩の無い左曲がり。砂流れ（PRACTICE_FLOW）はその先の真ん中。どちらも、ヌールの説明を読んでから入れる距離を空ける。
 */
// 説明から実践まで、最高速でも2秒以上の岩の無い助走を取る（物理・本番配置は共通のまま）。
export const PRACTICE_LESSONS = Object.freeze({ rock: 90, firstRock: 200, bump: 220, firstBump: 340,
  secondRock: 440, trick: 460, trickBump: 580, boost: 645, smash: 750, smash2: 800, recover: 820 });
export const PRACTICE_WALL = 930;
// カーブは約6秒（ヌールの説明3つを読める長さ。押したり離したりで切り込むと「+15」が2〜4回）。
// 2026-11-25 オーナー「カービングに演出を入れたい。チュートリアルでも触れて欲しい」で 80m → 200m
export const PRACTICE_CURVE = Object.freeze({ from: 1030, to: 1230, c: -0.85 });
export const PRACTICE_FLOW = 1310;
const PRACTICE_WALL_X = Object.freeze([-0.66, -0.22, 0.22, 0.66]);
export function practiceCourse() {
  const length = COURSE.practiceLength;
  const L = PRACTICE_LESSONS;
  const features = [rock(L.firstRock, 0.35), bump(L.firstBump), rock(L.secondRock, -0.3), bump(L.trickBump), rock(L.smash, 0), rock(L.smash2, 0.05),
    ...PRACTICE_WALL_X.map(x => rock(PRACTICE_WALL, x))];
  const C = PRACTICE_CURVE;
  const curves = [{ z: 0, c: 0 }, { z: C.from - 20, c: 0 }, { z: C.from + 10, c: C.c }, { z: C.to - 10, c: C.c }, { z: C.to + 20, c: 0 }, { z: length + 400, c: 0 }];
  const flows = Object.freeze([Object.freeze({ kind: "flow", z: PRACTICE_FLOW, x: 0, half: FLOW.half, length: FLOW.length })]);
  return decorateCourse({ seed: 0, length, features, curves, flows, practice: true, id: "practice", name: "練習" });
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

/**
 * 段の岩（#3779・TIER_TUNING の rocks）。中級のコースの features から作り、起伏は動かさない（跳ぶ所・稼ぎ場は同じ）。
 * 初級は岩の列を間引くだけ（減らすので、抜けられる幅・岩どうしの間隔は中級以上）。
 * 上級は岩の無い長い区間の真ん中に岩を1つ足す（前後の岩・起伏の着地から十分に離す。位置は seed で決まる）。
 */
function tierFeatures(features, tier, seed, length, flows = []) {
  const { thin = 1, fill = null } = TIER_TUNING[tierOf(tier)].rocks;
  let list = features;
  if (thin > 1) {
    const rows = [...new Set(list.filter(f => f.kind === "rock").map(f => f.z))].sort((a, b) => a - b);
    const keep = new Set(rows.filter((z, i) => i % thin === 0));
    list = list.filter(f => f.kind !== "rock" || keep.has(f.z));
  }
  if (fill) {
    const random = rng((seed * 7919 + 13) >>> 0), added = [];
    const spots = [...list.map(f => ({ z: f.z, kind: f.kind })), { z: length - 140, kind: "end" }].sort((a, b) => a.z - b.z);
    let free = LAYOUT.start;
    for (const spot of spots) {
      const latest = spot.z - fill.after;
      if (latest >= free) {
        // 足す岩は砂流れの帯を避ける（帯に掛かるなら左右を入れ替え、それでも掛かるなら足さない）
        const at = Math.round((free + latest) / 2), x = (random() < 0.5 ? -1 : 1) * (0.25 + random() * 0.55);
        const clear = cx => flows.every(flow => flowClear([rock(at, cx)], flow.z, flow.x));
        const place = clear(x) ? x : clear(-x) ? -x : null;
        if (place !== null) added.push(rock(at, place));
      }
      free = Math.max(free, spot.z + (spot.kind === "bump" ? fill.afterBump : fill.before));
    }
    list = [...list, ...added].sort((a, b) => a.z - b.z);
  }
  return list;
}

/**
 * コース定義（id か seed）から本番の1本を作る。同じ引数なら同じコース。
 * tier（#3779）: 初級・上級は岩の多さだけを変える（tierFeatures）。起伏・カーブ・長さ・名前は中級の同じコースのまま。中級・段なしは前と同じ。
 */
export function buildCourse({ id, seed, tier } = {}) {
  const pack = (id && packById(id)) || (seed != null && packBySeed(seed)) || null;
  const level = tierOf(tier);
  const course = generateCourse(pack ? pack.seed : seed ?? DEFAULT_SEED);
  const tiered = level === "normal" ? null : { features: tierFeatures(course.features, level, course.seed, course.length, course.flows), tier: level };
  if (!pack) return tiered ? decorateCourse({ ...course, ...tiered }) : course;
  return decorateCourse({ ...course, ...tiered, id: pack.id, name: pack.name, curves: pack.curves ? closeCurves(pack.curves, course.length) : course.curves });
}

/** runSeed から COURSE_PACKS の1本を決めて作る（決定的）。段（tier）が違っても、同じ runSeed なら同じ名前のコース。 */
export function pickCourse(runSeed, tier) {
  const index = Math.floor(rng(runSeed)() * COURSE_PACKS.length);
  return buildCourse({ id: COURSE_PACKS[index].id, tier });
}

/**
 * rival: rivalRun() の結果（本番のヌール）。あれば、ゴールの順を競い、先着で加点する。
 * tier: ヌールとの勝負の段（#3779。結果に残す）。なるとの勝負・練習・検査は null（段の外）。
 */
export function createGame(course, { rival = null, charge = 1, tier = null } = {}) {
  return {
    course, rival, tier: TIERS.includes(tier) ? tier : null, chargeRate: charge, t: 0, z: 0, x: 0, vx: 0, speed: SPEED.start, rivalClock: 0, rivalRate: 1, rivalFinishT: null,
    air: 0, airTotal: 0, airPeak: 0, airKind: null, landingPress: null, lastJumpT: -9,
    rot: 0, spinDir: 0, spinHold: false, spinArmed: null, lastTrick: null,
    gauge: 0, chargedAt: -9, boostT: 0, carving: false, carveT: 0, inFlow: null, flowLift: false,
    fallT: 0, fallAt: -9, fallReason: null, preFallSpeed: SPEED.start, preFallCombo: 0, preFallGauge: 0,
    falls: 0, combo: 0, maxCombo: 0, score: 0,
    stats: { bigJumps: 0, hops: 0, perfect: 0, good: 0, plain: 0, nearMiss: 0, edgeTime: 0, bounces: 0, airTime: 0,
      tricks: 0, bestTrick: 0, spinFalls: 0, boosts: 0, boostsLost: 0, smashed: 0, recoveries: 0, carves: 0, carveTime: 0, flows: 0, flowTime: 0 },
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

/** ブーストのゲージを貯める（0〜1）。満タンになった瞬間に gaugeFull を知らせる。練習の説明でも使う（その時は CHARGE を掛けない）。 */
export function chargeBoost(game, amount) {
  if (game.finished || !(amount > 0)) return game.gauge;
  const before = game.gauge;
  game.gauge = Math.min(1, before + amount);
  game.chargedAt = game.t;
  if (before < 1 && game.gauge >= 1) game.events.push({ kind: "gaugeFull", t: game.t });
  return game.gauge;
}

/** 立て直しの猶予（秒）。練習では長い。 */
export const recoverWindow = game => game.course?.practice ? BOOST.practiceRecoverWindow : BOOST.recoverWindow;
/** 滑りの中で貯まる分（かすめ・着地・トリック・カービング）。CHARGE を掛ける。 */
const earn = (game, amount) => chargeBoost(game, amount * CHARGE * (game.chargeRate ?? 1));

/** 転倒からブーストで立て直せるか（岩に当たった直後の短い間だけで、ゲージが必要）。 */
export function canRecover(game) {
  return !game.finished && (game.preFallGauge ?? 0) > 0 && game.fallT > 0 && game.fallReason === "rock"
    && game.t - game.fallAt <= recoverWindow(game) + 1e-9;
}

/** ブースト（↓ ／ BOOST ボタン）。残量を使い切り、その割合だけ加速時間を得る。転倒直後なら立て直す。 */
export function boost(game) {
  return applyBoost(game, BOOST.minGauge);
}

function applyBoost(game, minGauge) {
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
  if (game.gauge < minGauge) return null;
  game.boostT = Math.min(BOOST.duration, game.boostT + BOOST.duration * game.gauge);
  game.gauge = 0;
  game.stats.boosts += 1;
  game.events.push({ kind: "boost", t: game.t });
  return "boost";
}

// rivalRun の同期シミュレーションでは配置が変わらず、通過済みの要素は先頭に連続する。
// 外から配置・passed を編集できるゲームや、未整列のコースには通常の走査を使う。
const sortedRivalGames = new WeakSet();
const pendingStart = game => sortedRivalGames.has(game) ? game.passed.size : 0;

/** 次の起伏（まだ越えていない）までの距離。無ければ Infinity。 */
export function nextBumpDistance(game) {
  const features = game.course.features;
  for (let i = pendingStart(game); i < features.length; i++) {
    const feature = features[i];
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
      earn(game, BOOST.trickPerHalf * half);
    }
  }
  // 平地のホップは回避用。連打で得点・コンボ・加速・回復を稼がせない。
  if (kind === "hop") {
    game.landingPress = null;
    game.events.push({ kind: "land", grade: "hop", t: game.t });
    return;
  }
  earn(game, BOOST.land); // 離陸ではなく、転ばず大ジャンプを着地した時だけ回復
  const remaining = game.landingPress;
  let grade = "plain";
  if (remaining !== null && remaining <= JUMP.landingWindow) grade = "perfect";
  else if (remaining !== null && remaining <= JUMP.goodWindow) grade = "good";
  if (grade === "perfect") {
    game.stats.perfect += 1;
    game.speed = Math.max(game.speed, Math.min(speedCap(game), game.speed + SPEED.landingBoost));
    earn(game, BOOST.perfect);
    award(game, "land", SCORE.perfect, { at: { grade, gaugeGained: game.gauge - gaugeBefore } });
  } else if (grade === "good") {
    game.stats.good += 1;
    earn(game, BOOST.good);
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
/** 岩を砕けるか: ブースト中と、終わった直後のまだ最高速を大きく超えている間（終わった瞬間に目の前の岩で転ばないように）。
 * 砂流れで速くなった分（flowLift）では砕かない。 */
export const smashing = game => game.boostT > 0 || (game.speed > SPEED.max + 3 && !game.flowLift);

/** 1フレーム進める。dt は秒（50ms で頭打ち）。入力は { left, right }。 */
export function step(game, input, dt) {
  if (game.finished) return game;
  dt = Math.min(0.05, Math.max(0, dt));
  game.t += dt;
  const falling = game.fallT > 0;
  // 砂流れ: 地上（ホップの低い所も含めない）で、コースの中の帯の上
  const flow = !falling && game.air <= 0 && Math.abs(game.x) <= EDGE ? flowAt(game.course, game.z, game.x) : null;
  if (flow && flow !== game.inFlow) { game.stats.flows += 1; game.events.push({ kind: "flow", t: game.t, x: flow.x, z: flow.z }); }
  else if (!flow && game.inFlow) game.events.push({ kind: "flowEnd", t: game.t });
  game.inFlow = flow;
  if (flow) game.stats.flowTime += dt;
  if (falling) {
    game.fallT = Math.max(0, game.fallT - dt);
  } else if (game.boostT > 0) {
    game.flowLift = false; // ブーストの勢いは砕ける
    game.speed = Math.min(SPEED.boost, game.speed + SPEED.boostAccel * dt);
  } else {
    const top = flow ? FLOW.cap : SPEED.max;
    if (game.speed > top) game.speed = Math.max(top, game.speed - SPEED.overDecay * dt); // ブースト・砂流れの後は少しずつ戻る
    else if (flow) {
      game.speed = Math.min(top, game.speed + FLOW.accel * dt);
      if (game.speed > SPEED.max) game.flowLift = true;
    } else game.speed = Math.min(top, game.speed + SPEED.accel * dt);
  }
  if (game.flowLift && game.speed <= SPEED.max + 3) game.flowLift = false;
  if (game.boostT > 0) {
    game.boostT = Math.max(0, game.boostT - dt);
    if (game.boostT === 0) game.events.push({ kind: "boostEnd", t: game.t });
  } else if (game.gauge > 0 && game.t - game.chargedAt > BOOST.decayDelay) {
    game.gauge = Math.max(0, game.gauge - BOOST.decay * dt); // 使わないと、じわじわ減る
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
    earn(game, CARVE.gaugePerSec * carve * dt);
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
  const features = game.course.features;
  for (let i = pendingStart(game); i < features.length; i++) {
    const feature = features[i];
    if (feature.z > game.z) {
      if (sortedRivalGames.has(game)) break;
      continue;
    }
    if (game.passed.has(feature)) continue;
    if (feature.z <= z0) { game.passed.add(feature); continue; }
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
      earn(game, near.gauge);
    }
  }
  if (game.rival) stepRival(game, dt);
  if (game.z >= game.course.length) finish(game);
  return game;
}

/** 相手の再生を進める（RUBBER）。差が開くと追いつく／手加減する。追いついた分はゴール手前までに返す。 */
export function rubberCaps(progress, rubber = RUBBER) {
  const R = rubber, p = Math.max(0, Math.min(1, progress));
  return { lead: R.lead * Math.max(0, Math.min(1, (R.settleAt - p) / (R.settleAt - R.holdUntil))), lag: R.keep + (R.lag - R.keep) * Math.min(1, (1 - p) / R.lastStretch) };
}
function stepRival(game, dt) {
  const rival = game.rival, R = rival.rubber || RUBBER; // 段ごとの手加減（rivalRun が持たせる。無ければ中級）
  const rivalZ = rivalAt(rival, game.rivalClock).z;
  const lead = game.z - rivalZ, dev = game.rivalClock - game.t;
  const caps = rubberCaps(Math.max(game.z, rivalZ) / game.course.length, R);
  let target = 1;
  if (lead > R.gap) target = 1 + (R.catchUp - 1) * Math.min(1, (lead - R.gap) / R.span);
  else if (lead < -R.gap && rival.easeOff !== false) target = 1 - (1 - R.easeOff) * Math.min(1, (-lead - R.gap) / R.span);
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
  // オーナー指示（2026-11-25）: S はライバルに勝った時だけ。負けたら、スコアが S の境目を越えていても A まで
  const scored = game.finished ? rankOf(score) : null;
  const rank = scored === "S" && game.race && !game.race.won ? "A" : scored;
  return {
    rulesVersion: RULES_VERSION, finished: game.finished, score, rank, time,
    maxCombo: game.maxCombo, falls: game.falls, bigJumps: game.stats.bigJumps, perfect: game.stats.perfect,
    good: game.stats.good, nearMiss: game.stats.nearMiss, seed: game.course.seed,
    tricks: game.stats.tricks, bestTrick: game.stats.bestTrick, boosts: game.stats.boosts, smashed: game.stats.smashed,
    recoveries: game.stats.recoveries, carves: game.stats.carves, courseId: game.course.id ?? null, courseName: game.course.name ?? null,
    race: game.race ? { ...game.race } : null, ...(game.tier ? { tier: game.tier } : {}),
  };
}

/** 結果の段（#3779）。段の無い結果（段ができる前の保存・なるとの勝負）は中級＝今の遊びとして扱う。 */
export const resultTier = value => tierOf(value?.tier);

/** 自己ベスト表示の区分。報酬と段の判定は従来どおり resultTier を使う。 */
export const desertBestKey = result => result.race?.who === "naru" ? "naru" : resultTier(result);
export function desertDisplayBests({ best, easyBest, bests } = {}) {
  const records = {};
  // 本編の総合ベストには対戦相手と段が残る。旧試遊ページの総合ベストは区分できない。
  const knownKey = best?.finished ? desertBestKey(best) : null;
  for (const key of [...TIERS, "naru"]) {
    const top = bests?.[key] ?? (key === "easy" ? easyBest : key === knownKey ? best : null);
    if (top?.rulesVersion === RULES_VERSION && Number.isFinite(top.score) && RANK_ORDER.includes(top.rank)) {
      records[key] = { score: top.score, rank: top.rank, rulesVersion: top.rulesVersion };
    }
  }
  return records;
}

/** 保存する記録の形を検査して整える（形が合わなければ null）。段（tier）は知っている値だけ残す（無ければ resultTier で中級）。 */
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
    tricks: Math.round(n(value.tricks) ?? 0), bestTrick: Math.round(n(value.bestTrick) ?? 0), boosts: Math.round(n(value.boosts) ?? 0), race,
    ...(TIERS.includes(value.tier) ? { tier: value.tier } : {}) };
}

// 自動操作がブーストを使い始めるゲージの量。2026-11-13 にゲージが「使わないと減る」ようになったので、満タンまで待たずに使う（減る前に使い切る）
const BOT_BOOST_AT = 0.35;
// 自動操作の継ぎ足し・ゴール前の既定の最低量。評価照合とライバルの滑りは従来の30%を基準にする。
const BOT_MIN_GAUGE = 0.3;
// ライバルはゴール前にこの量から使い切る。
const RIVAL_FINISH_BOOST_AT = 0.15;
const BOT_PLANS = Object.freeze([[0, 0], ...[-1, 1].flatMap(dir => [0.2, 0.45, 0.8, 1.4].map(hold => [dir, hold]))]);
const BOT_LOOK = Object.freeze({ horizon: 2.2, dt: 1 / 20, every: 3, commit: 0.35 });
// 砂流れに乗る見返り（帯の上にいる1秒あたり。自分の位置へ戻る重み 1.2/レーン より強いので、届く帯には乗りに行く）。
// 2026-11-25: ヌール・なる・検査のボットとも本番の4本の帯をすべて通る値。2.25 以上では、帯へ寄る分だけ上級のヌールとなるの差が縮んだ（検査の境目 1 秒を割る）
const BOT_FLOW_PULL = 1.75;
// botSteer は同期処理。各候補に共通する予測表を呼び出し間で再利用する。
const LOOK_STEPS = Math.round(BOT_LOOK.horizon / BOT_LOOK.dt);
const steerTable = {
  drift: new Float64Array(LOOK_STEPS), side: new Int8Array(LOOK_STEPS), grip: new Uint8Array(LOOK_STEPS),
  hits: Array.from({ length: LOOK_STEPS }, () => []), flowOn: new Array(LOOK_STEPS),
};
/**
 * 自動操作の舵。2.2秒先まで横の動き（慣性・カーブで外へ流される力）を試算し、岩に当たらず端にも出ない押し方を選ぶ。
 * 「何もしない／左右どちらかを 0.2〜1.4 秒押して離す」の中から、いちばん安全で自分の位置（lane）へ戻れるものを選び直す（every 歩ごと）。
 */
function botSteer(game, skill, memo) {
  memo.steerTick = (memo.steerTick ?? -1) + 1;
  if (memo.steerDir != null && memo.steerTick % BOT_LOOK.every !== 0) return { left: memo.steerDir < 0, right: memo.steerDir > 0 };
  const course = game.course, speed = Math.max(SPEED.min, game.speed), { horizon, dt } = BOT_LOOK, lane = memo.lane ?? 0;
  const steps = LOOK_STEPS, reach = game.z + speed * horizon + 4;
  // 空中の区間（今の大ジャンプと、これから跳ぶ起伏）。大ジャンプ中は岩を越え、← → は回転に使うので横へは動かさない
  // 飛ぶ距離は短めに見積もる（ブーストが切れると速さが落ちる）。着地のすぐ先の岩は、跳ぶ前から位置をずらしてよける
  const spans = [], glide = time => (game.boostT >= time ? speed : Math.min(speed, SPEED.max)) * time * 0.95;
  if (game.air > 0 && game.airKind === "big") spans.push([game.z, game.z + glide(game.air)]);
  const rocks = [];
  for (let i = pendingStart(game); i < course.features.length; i++) {
    const f = course.features[i];
    if (f.z > reach && sortedRivalGames.has(game)) break;
    if (f.z <= game.z || f.z > reach || game.passed.has(f)) continue;
    if (f.kind === "rock") rocks.push(f);
    else if (skill !== "none") spans.push([f.z, f.z + glide(JUMP.bigAir * (0.85 + 0.3 * Math.min(1, speed / SPEED.max)))]);
  }
  const inAir = z => spans.some(([from, to]) => z >= from && z < to);
  // 各歩の地面の状態は、どの押し方でも同じ（前へ進む速さは変わらない）
  const { drift, side, grip, hits, flowOn } = steerTable;
  const flows = (course.flows || []).filter(flow => flow.z + flow.length > game.z && flow.z < reach);
  for (let k = 0; k < steps; k++) {
    const z = game.z + speed * dt * k, curve = curveAt(course, z);
    drift[k] = curve * STEER.curveDrift * (speed / SPEED.max) * dt; side[k] = Math.sign(curve); grip[k] = inAir(z) ? 0 : 1;
    hits[k].length = 0;
    for (const rock of rocks) {
      if (rock.z > z && rock.z <= z + speed * dt && !inAir(rock.z)) hits[k].push(rock);
    }
    flowOn[k] = grip[k] ? flows.find(flow => z >= flow.z && z < flow.z + flow.length) : null;
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
      if (flowOn[k] && Math.abs(x - flowOn[k].x) <= flowOn[k].half - 0.03) cost -= BOT_FLOW_PULL * dt; // 砂流れに乗る
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
    const finishBoostAt = memo.finishBoostAt ?? BOT_MIN_GAUGE;
    if (game.boostT <= 0 ? game.gauge >= (memo.boostAt ?? BOT_BOOST_AT) || (game.gauge >= finishBoostAt && remaining <= SPEED.boost * BOOST.duration * game.gauge + 20)
      : game.gauge >= BOT_MIN_GAUGE && game.gauge <= room) action = "boost";
  }
  return { input, action };
}

/** 自動操作の一歩（press／boost を実行してから進める）。ヌールの走りと検査で使う。 */
export function botStep(game, skill, memo, dt) {
  const { input, action } = botControl(game, skill, memo);
  if (action === "press") press(game);
  else if (action === "boost") applyBoost(game, memo.finishBoostAt ?? BOT_MIN_GAUGE);
  step(game, input, dt);
  return game;
}

const RIVAL_SAMPLE = 1 / 30;
/**
 * 本番の競走相手（who: "noor"／"naru"、`RIVALS`）の滑り。同じコースを自動操作で最後まで滑り、ゴールの時刻と、1/30 秒ごとの位置・姿勢を返す。
 * 同じコースなら毎回同じ（決定的）。人物とは当たらない（並んで滑るだけ）。
 * tier（#3779）: ヌールの段（TIER_TUNING の noor・rubber を重ねる）。なるは段の外（いつも同じ）。
 */
export function rivalRun(course, { who = "noor", maxTime = 200, tier } = {}) {
  const tuned = who === "noor" || !RIVALS[who] ? TIER_TUNING[tierOf(tier)] : null;
  const { skill, startX, only360, startSpeed, easeOff = true, charge = 1, boostAt = 1 } = { ...(RIVALS[who] || RIVALS.noor), ...tuned?.noor };
  const rubber = tuned && Object.keys(tuned.rubber).length ? Object.freeze({ ...RUBBER, ...tuned.rubber }) : RUBBER;
  const game = createGame(course, { charge }), memo = { lane: startX, only360, boostAt, finishBoostAt: RIVAL_FINISH_BOOST_AT }, samples = [];
  if (course.features.every((feature, i, list) => i === 0 || list[i - 1].z <= feature.z)) sortedRivalGames.add(game);
  game.x = startX; game.speed = startSpeed;
  const snap = () => samples.push({ t: game.t, z: game.z, x: game.x, vx: game.vx, air: game.air, airTotal: game.airTotal, airPeak: game.airPeak, airKind: game.airKind,
    landingPress: game.landingPress, fallT: game.fallT, landedAt: game.landedAt, rot: game.rot, boostT: game.boostT, flow: game.inFlow ? 1 : 0 });
  snap();
  let next = RIVAL_SAMPLE;
  while (!game.finished && game.t < maxTime) {
    botStep(game, skill, memo, 1 / 60);
    if (game.t >= next - 1e-9 || game.finished) { snap(); next += RIVAL_SAMPLE; }
  }
  return Object.freeze({ who: RIVALS[who] ? who : "noor", finishTime: game.finishTime ?? game.t, samples, falls: game.falls, easeOff, rubber,
    ...(tuned ? { tier: tierOf(tier) } : {}) });
}

/**
 * ゴールした相手の滑り抜け（2026-11-13 オーナー「ライバルとの時差も距離に対してリアリティがない」）: ゴールの速さのまま、coast 秒かけて
 * 一定の割合で減速して止まる（それまでは約13m 先ですぐ止まり、後から来た主人公が線の手前で追いつくように見えていた）。
 * 止まりながらコースの脇（side）へ寄せ、後から来る主人公の前をふさがない。
 */
export const RIVAL_COAST = Object.freeze({ coast: 4, side: 0.75 });
/** 時刻 t のヌール（rivalRun の結果）。ゴールの後は減速しながら脇へ抜ける（RIVAL_COAST）。 */
export function rivalAt(rival, t) {
  const s = rival.samples;
  if (!s.length) return null;
  if (t >= rival.finishTime) {
    // ゴールの速さは、最後の1つ手前の2つの記録から（最後の記録は位置をゴールの線にそろえてあるので、速さが小さく出る）
    const last = s[s.length - 1], prev = s[Math.max(0, s.length - 2)], prev2 = s[Math.max(0, s.length - 3)], after = t - rival.finishTime, T = RIVAL_COAST.coast;
    const v0 = prev.t > prev2.t ? Math.max(0, (prev.z - prev2.z) / (prev.t - prev2.t)) : SPEED.max;
    const a = Math.min(after, T), ease = Math.min(1, after / (T * 0.6)), side = (Math.sign(last.x) || 1) * RIVAL_COAST.side;
    return { ...last, z: last.z + v0 * a - v0 * a * a / (2 * T), x: last.x + (side - last.x) * ease * ease * (3 - 2 * ease), vx: 0,
      air: 0, airKind: null, fallT: 0, boostT: 0, rot: 0, finished: true, t };
  }
  const i = Math.min(s.length - 1, Math.max(1, Math.ceil(t / RIVAL_SAMPLE)));
  const a = s[i - 1], b = s[i];
  const k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
  return { ...a, z: a.z + (b.z - a.z) * k, x: a.x + (b.x - a.x) * k, rot: a.rot + (b.rot - a.rot) * k, t, finished: false };
}


