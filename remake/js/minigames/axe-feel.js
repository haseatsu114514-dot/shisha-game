// 斧投げの「手応え」の数値を1か所に集める（桜井政博「パラメーターを外に出す」tech #011・2026-11-13 手応えレビュー指摘9）。
// ルールと得点（骨格）は axe-model.js。ここは筋肉: 間（ヒットストップ）・揺れ・演出の大きさ・テンポ。
// 数値を変えても記録される結果（shots）と得点は変わらない。
//
// 開発時の上書き（再読み込みは要るが、ソースの編集は要らない）:
//   URL の ?feel=hitstop.large:130,shake.small:3  または  localStorage.axeFeel に同じ書式の文字列。
//   ?feel=freeze:contact で、刺さった（板に当たった）瞬間に時計を止めたままにする（ヒットポーズと木片の位置合わせ用）。
//   名前は下の階層を「.」でつなぐ。知らない名前と数でない値は無視する。
export const AXE_FEEL = {
  flight: {
    travel: 600, // 【飛ぶ時間】ms。放してから板に届くまで
    fall: 300, // 【落ちる時間】ms。柄から当たる・回りすぎで床へ落ちるまで
    slowFrom: .6, // 【スローの開始】宣言した投は、飛ぶ道のりのこの割合から
    slowRate: .5, // 【スローの速さ】その後を何倍速で飛ぶか
  },
  path: {
    // 【放す位置】手の斧の刃先（振り抜いた構え）から出るように。投影すると的の中心から右へ約200・上へ約85
    startX: 246, startY: -68, startZ: 80,
    arc: 192, // 【山なりの高さ】放物線の高さ×4（真ん中で 48）
    fallDrop: 260, // 【落ちる距離】
    fallPitch: 75, // 【落ちる時の回転】度
  },
  hitstop: {
    // 【接触の止め時間】ms。刺さった瞬間に飛ぶ斧を止めて見せる（桜井 #003・#047: 攻撃力×係数で長さを決める）
    small: 60, // 1〜5点（約4F）
    medium: 80, // 6点
    large: 110, // 7・8点（キルショット。1.5倍の重み）
    wood: 50, // 0点でも木に刺さった時
    drop: 110, // 【落下時の止め時間】柄や回りすぎた刃が板に当たった姿を見せてから落とす（約7F）
    shake: 2, // 【止めの間の板の震え】px。1Fごとに左右へ反転（地上の物なので横だけ）
  },
  impact: {
    duration: 1150, // 【着弾演出の長さ】ms（得点した時）
    woodDuration: 520, // 【木だけの反応の長さ】ms（0点で刺さった時）
    strength: { small: 2.5, medium: 5, large: 7, wood: 1.5 }, // 【反動の強さ】
    specialScale: 1.6, // 【特別な投（ブル・キル）の反動の倍率】
    recoilMs: 260, // 【板の反動が収まる時間】
    punchMs: 200, punch: .014, specialPunch: .03, // 【板が手前へ寄る量】
    flashGrow: 130, flashFade: 150, specialFlashFade: 220, // 【閃光の広がり・消え】ms
    flashRadius: 35, specialFlashRadius: 55, // 【閃光の半径】
    darkFlashMs: 50, // 【暗い閃光】最初のこの時間は1Fごとに暗・明を入れ替える（明るい板でも沈まない。#016・#221）
    ringRadius: { small: 65, medium: 100, special: 130 }, // 【衝撃の輪の広がり】
    echoRadius: { small: 44, medium: 70 },
    dustSpread: 28, dustStep: 4, // 【塵の広がり】
    chipNear: 65, chipFar: 105, chipFall: 55, // 【木片の飛ぶ距離・落ち方】
    woodChips: 10, // 【0点で刺さった時の木片の数】
    burstRise: 38, burstTop: -32, // 【得点の飛び出し文字】
  },
  shake: {
    // 【画面の揺れ】大中小で揺れ方の型ごと変える（#103）。px と倍率
    small: { x: 2, y: 0, scale: 0 }, // 1〜5点・木だけ: 横だけ
    medium: { x: 5, y: 2, scale: 0 }, // 6点: 横＋少し縦
    large: { x: 6, y: 4, scale: .03 }, // 7・8点: 横縦＋手前へ
    speedX: .12, speedY: .15, // 【揺れの速さ】
  },
  quiver: { ms: 420, rotate: 2.6, scale: .06 }, // 【刺さった柄の震え】
  trail: {
    offsets: [160, 110, 60, 0], // 【風切りの線】何 ms 前の刃先を結ぶか
    opacity: .42, ghostStep: 40, ghostOpacity: [.3, .14], // 【残像】
    shadow: .42, // 【接地の影の濃さ】
  },
  hands: {
    follow: 220, // 【フォロースルーの表示時間】ms。放した後も手を見せてから消す（#077）
  },
  flick: {
    // 【帯の外の力み】緑の帯の外で弾くと、横のぶれがこの倍率になる（2026-11-13 指摘7）
    leanOutside: 1.5,
  },
  tempo: {
    guard: 250, // 【操作の取りこぼし防止】ms。押した直後の二度押しを無視する
    resultMin: 600, // 【結果の最短表示】ms。これより後なら、結果の間に的へ触れると次の投の狙いになる
    autoToOpponent: 1200, // 【自分の結果→相手の番】対戦で自動で進むまで ms（タップで即）
    opponentReady: 600, // 【相手の構え】ms
    autoToPlayer: 1500, // 【相手の結果→自分の番】ms（タップで即）
    cutin: 1500, // 【始まりの幕】ms
    countUp: 500, // 【集計の数字のカウントアップ】ms
  },
  cue: {
    declare: 950, half: 1300, last: 1300, sudden: 1400, goal: 1400, // 【札を出しておく時間】ms
    flick: 700, // 【弾き損ねの札】
  },
  debug: { freeze: "" }, // "contact" で接触の瞬間に止めたままにする
};

/** "a.b:1,c:2" を AXE_FEEL に重ねる。数の所には数だけ、freeze には文字だけを入れる。 */
export function applyFeel(text, target = AXE_FEEL) {
  if (typeof text !== "string" || !text) return 0;
  let applied = 0;
  for (const part of text.split(",")) {
    const [path, raw] = part.split(":").map(s => s?.trim());
    if (!path || raw === undefined) continue;
    const keys = path === "freeze" ? ["debug", "freeze"] : path.split(".");
    let node = target;
    for (const key of keys.slice(0, -1)) node = node && typeof node[key] === "object" ? node[key] : null;
    const last = keys.at(-1);
    if (!node || !Object.hasOwn(node, last)) continue;
    if (typeof node[last] === "string") { node[last] = raw; applied++; continue; }
    const value = Number(raw);
    if (typeof node[last] === "number" && Number.isFinite(value)) { node[last] = value; applied++; }
  }
  return applied;
}

// 起動時に一度だけ読む（ブラウザだけ。テストや node では何もしない）
try { applyFeel(globalThis.localStorage?.getItem("axeFeel") || ""); } catch { /* 保存領域が使えない環境 */ }
try { applyFeel(new URLSearchParams(globalThis.location?.search || "").get("feel") || ""); } catch { /* URL が無い環境 */ }
