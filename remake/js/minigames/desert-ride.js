// DESERT RIDE（第4章ドバイ・サンドボード）の画面。後方視点の疑似3Dを Canvas に描き、入力・HUD・練習・リザルトを持つ。
// 規則と採点は desert-ride-model.js。本編との接続（行動枠・報酬・保存）は chapters/ch4-desert.js で、ここは保存を読まない。
// 絵（遠景・主人公の背面・岩・旗・ゴール・砂煙）は Codex 生成の採用画像（desert-ride-art.js）。読み込み前・失敗時は Canvas の図形で描く。
// 起伏・路面・太陽・夕方の色は Canvas で描く。左右・ジャンプ・着地・転倒の姿勢は第4弾の差分の絵（riderPose）。
// 2026-11-02 オーナー「もっとスピード感やエフェクトを派手に」: 速さで広がる視界（人物の大きさは保つ）・傾くカメラ・強いスピード線・砂しぶき・
// 着地の輪・得点の浮き出し・トリックのスロー・ブーストの残像。動き軽減ではカメラの動き・揺れ・スロー・閃光・速度線を止める。
// 本番はスタートの合図のあと、ヌール（rivalRun）が横で滑る。
import { el } from "../core/util.js";
import { SE, unlockAudio, createDesertRideSe, desertZapGap, currentBgm, playBgm, preloadBgm, setBgmPlaybackRate, resetBgmTempo, bgmPlaybackRate } from "../core/audio.js";
import { EDGE, SPEED, COURSE_PACKS, generateCourse, practiceCourse, pickCourse, buildCourse, createGame, step, press, boost, chargeBoost, canRecover, summary, curveAt, headingAt, lateralAt, botControl,
  rivalRun, rivalAt, RULES_VERSION, jumpHeight, DISPLAY, toKmh, toMeters, JUMP } from "./desert-ride-model.js";
import { DESERT_ART, DESERT_CONTROL_ART, loadDesertArt, riderPose } from "./desert-ride-art.js";
import { imgFileUrl } from "../core/img-file.js";

// ブーストは人物を包む炎のオーラ・砂煙・周辺の速度線と、曲のテンポで伝える（2026-11-11 オーナー「ブースト中は曲を早く、オーラを出す」）。
const BOT_STEP = 1 / 60; // 自動操縦の判断と物理の刻み（モデルの検査と同じ）
const BOOST_BGM_RATE = 1.18;     // ブースト中の曲の速さ（音程は保つ）
// オーラの色（内側・外側・火の粉）。主人公は炎、ヌールは砂丘の夕日の金、なるは冷たい銀紫
const AURAS = Object.freeze({
  player: Object.freeze({ core: [255, 250, 190], mid: [255, 176, 48], rim: [255, 92, 20] }),
  noor: Object.freeze({ core: [255, 252, 214], mid: [255, 214, 110], rim: [236, 150, 60] }),
  naru: Object.freeze({ core: [244, 240, 255], mid: [176, 160, 255], rim: [110, 84, 220] }),
});
// カーブで遠景が横へ流れる量（向き 1 あたりの画素）。空は陸の半分。絵の端は左右反転でつなぐので、どこまで曲がっても途切れない
const YAW_PX = 600;
const RIVAL_TITLES = Object.freeze({ naru: "裏ボス" });
// 相手の滑る絵の倍率。絵は主人公の背面と同じ縮尺で描かれているので、身長の比（主人公172cm）だけを掛ける
// （data/characters.json の spriteScale と同じ値。ヌール168cm・なる176cm）。図形で描く時は従来の 0.86
const RIVAL_ART_SCALE = Object.freeze({ noor: 0.977, naru: 1.02 });

const W = 1280, H = 720;
const HORIZON = 262;             // 地平線の高さ
const CAM = { depth: 1.5, height: 2.0, back: 4.5, meterPerLane: 1.6 }; // 疑似3Dのカメラ（人物の4.5m後ろ・高さ2m。lane 1 = 1.6m）
const COUNTDOWN = 2.4;           // 本番のスタートの合図（3・2・1・GO）の秒数
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
const active = new WeakMap();
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
let sandLevels = null;
function sandTexture() {
  if (sandLevels !== null) return sandLevels;
  sandLevels = [];
  if (typeof document === "undefined") return sandLevels;
  const N = SAND.tile, base = document.createElement("canvas");
  base.width = base.height = N;
  const g = base.getContext("2d"), img = g.createImageData(N, N), px = img.data;
  // 周期的な値ノイズ（格子を端で折り返す）
  let seed = 1234567;
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const grid = (cells) => { const v = Array.from({ length: cells * cells }, rand); return (x, y) => {
    const fx = x * cells / N, fy = y * cells / N, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const at = (a, b) => v[((b % cells + cells) % cells) * cells + ((a % cells + cells) % cells)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
  }; };
  const low = grid(4), mid = grid(16), warp = grid(8);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // 風紋: 進む向きを横切る細い波（少し斜め・揺らぎあり）。風上側はなだらかに明るく、風下側は急に暗い
      const phase = 2 * Math.PI * (30 * y / N + 4 * x / N) + (warp(x, y) - 0.5) * 9;
      const s = Math.sin(phase), ripple = s > 0 ? Math.pow(s, 0.6) * 0.8 : -Math.pow(-s, 2.6) * 1.2;
      const tone = (low(x, y) - 0.5) * 0.2 + (mid(x, y) - 0.5) * 0.06; // 大きな明暗のむら
      const grain = (rand() - 0.5) * 0.06 + (rand() < 0.008 ? -0.1 : 0); // 砂粒と小さな影
      const k = 1 + tone + ripple * 0.07 * (0.6 + low(y, x) * 0.8) + grain;
      const i = (y * N + x) * 4;
      px[i] = Math.min(255, 232 * k); px[i + 1] = Math.min(255, 192 * k); px[i + 2] = Math.min(255, 138 * k); px[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // ミップ: 64 → 2 px/m。それぞれ横に並べて、画面の幅より長い帯にしておく（1行を1回の drawImage で描ける）
  for (let size = N; size >= 16; size /= 2) {
    const tile = document.createElement("canvas");
    tile.width = tile.height = size;
    tile.getContext("2d").drawImage(base, 0, 0, size, size);
    const reps = Math.ceil(1800 / size) + 2, strip = document.createElement("canvas");
    strip.width = size * reps; strip.height = size;
    const sg = strip.getContext("2d");
    for (let r = 0; r < reps; r++) sg.drawImage(tile, r * size, 0);
    sandLevels.push({ canvas: strip, size, density: size / SAND.meters, maxWidth: size * (reps - 1) });
  }
  return sandLevels;
}

const RANK_WORDS = { S: "最高の一本", A: "見事な滑り", B: "いい滑り", C: "完走" };
const TUTORIAL = {
  move: "← → で左右に動こう",
  rock: "岩に当たると転ぶ。先を見て、早めによけよう",
  bump: "起伏の手前で Space ── 大きく跳べる",
  brace: "着地の直前、輪がボタンに重なったら Space ── 着地が決まる",
  retryBump: "惜しい。次の起伏で、もう一度跳んでみよう",
  trick: "次は、跳んだら空中で ← か → を押し続けて回ろう",
  trickLetGo: "離すと回り切る。着地より前に離そう",
  trickDone: "回った！ 回るほど点が大きい",
  trickFall: "回りかけで着地すると転ぶ。もう少し早く離そう",
  boost: "溜まったゲージで↓（BOOST）を押すと超加速 ── 岩も砕ける",
  boostGo: "そのまま、岩へ突っ込め！",
  finish: "いい感じ。あとは、滑るだけ",
};
// タッチ端末ではキーの名前（Space／← →／↓）を出さず、画面のボタンの名前で言う（#2838）。
const TUTORIAL_TOUCH = {
  move: "「左へ」「右へ」で動こう",
  bump: "起伏の手前で「ジャンプ」── 大きく跳べる",
  brace: "空中ではジャンプが「LAND」に変わる。輪が重なったら押そう",
  trick: "次は、跳んだら空中で「左へ」か「右へ」を押し続けて回ろう",
  boost: "溜まったゲージで「BOOST」を押すと超加速 ── 岩も砕ける",
};
// 本番で最初のカーブに入った時に一度だけ出す案内（切り込めば踏ん張れて、ゲージも貯まる）
const CURVE_TIP = "カーブ！ 曲がる向きへ切り込むと、ブーストが貯まる";
const touchUi = () => typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;
const tutorialText = key => (touchUi() && TUTORIAL_TOUCH[key]) || TUTORIAL[key];
// 遊び方（メニューの「？」で開いた時だけ見せる。常時は出さない）
const HOWTO = {
  keys: [
    "← → で左右。砂の上なので、少し遅れてついてくる",
    "岩は ← → でよけるか、平らな所で Space を押して跳び越える（大きい岩は跳んだ高い所で越える）",
    "起伏の手前で Space で大ジャンプ。空中ではボタンが LAND に変わり、輪が重なった時に Space で着地が決まる（加速・ブースト回復）",
    "空中で ← → を押し続けると回転。回りかけで着地すると転ぶ",
    "ゲージが満タンで ↓（BOOST）。超加速して、岩も砕く",
    "岩に当たった直後にブーストを押すと、ゲージを使って立て直せる",
    "カーブでは外へ流される。曲がる向きへ切り込むと踏ん張れて、ブーストも貯まる",
  ],
  touch: [
    "「左へ」「右へ」で左右。砂の上なので、少し遅れてついてくる",
    "岩は「左へ」「右へ」でよけるか、平らな所で「ジャンプ」して跳び越える（大きい岩は跳んだ高い所で越える）",
    "起伏の手前で「ジャンプ」で大ジャンプ。空中ではボタンが「LAND」に変わり、輪が重なった時に押すと着地が決まる（加速・ブースト回復）",
    "空中で「左へ」「右へ」を押し続けると回転。回りかけで着地すると転ぶ",
    "ゲージが溜まったら「BOOST」。超加速して、岩も砕く",
    "岩に当たった直後に「BOOST」を押すと、ゲージを使って立て直せる",
    "カーブでは外へ流される。曲がる向きへ切り込むと踏ん張れて、ブーストも貯まる",
  ],
};

/**
 * 砂丘を滑る。host（本編は #stage）の上に全画面で重ね、「砂丘を下りる」か signal の中断で閉じる。
 * 完走するたびに onResult(result) を呼ぶ（何度でも）。戻り値 { results, practiced }。
 * @param opts.tutorial 最初に練習（ガイドの説明）から始める
 * @param opts.best 表示する自己ベスト { score, rank }（保存は呼び出し側）
 * @param opts.reducedMotion 揺れ・閃光・速度線を止める
 * @param opts.guide 練習と結果のひとことを言う人の名前（無ければ地の文）
 * @param opts.rivals 本番で競える相手（"noor"、ヌールに勝った後は "naru" も）
 */
export function runDesertRide({ host = document.getElementById("stage"), signal = null, tutorial = false, best = null, legacyBest = null, seed, courseId, rivals = ["noor"],
  reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, onResult = null, guide = null, speedUp = 1 } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const bgmBefore = currentBgm();
  let rideBgm = null;
  const restoreBgm = () => { if (rideBgm && currentBgm() === rideBgm) playBgm(bgmBefore); };
  // メニューで選んでいる間にパック曲の取得・復号を済ませる。
  for (const key of Object.values(RIDE_BGM)) void preloadBgm(key);
  const art = loadDesertArt();
  const promise = new Promise(resolve => {
    const rideSe = createDesertRideSe();
    const results = [];
    let practiced = false, done = false, frame = 0, runId = 0, currentBest = best?.rulesVersion === RULES_VERSION ? best : null;
    const oldBest = legacyBest || (best && best.rulesVersion !== RULES_VERSION ? best : null);
    const root = el("section.desert-ride", { dataset: { test: "desert-ride", phase: "menu", reducedMotion: String(!!reducedMotion) }, tabindex: "-1", "aria-label": "DESERT RIDE" });
    const canvas = el("canvas.dr-canvas", { width: W, height: H, "aria-hidden": "true" });
    const ctx = canvas.getContext("2d");
    const hud = el("div.dr-hud");
    const caption = el("p.dr-caption", { role: "status", dataset: { test: "desert-caption" } });
    const pop = el("div.dr-pop", { "aria-hidden": "true" });
    // 判定は左上のスコア欄に固定し、走路と人物を覆わない。開始合図だけ中央。
    const cutin = el("div.dr-cutin", { "aria-hidden": "true", dataset: { test: "desert-cutin" } });
    const startPop = el("div.dr-start-pop", { "aria-hidden": "true" });
    const versus = el("div.dr-versus", { "aria-hidden": "true", dataset: { test: "desert-versus" } });
    const feedback = el("div.dr-feedback", { dataset: { test: "desert-feedback" } }, [cutin, pop]);
    const panel = el("div.dr-panel");
    const controls = el("div.dr-controls", { hidden: true });
    const quit = el("button.dr-quit", { type: "button", text: "✕", title: "やめる", "aria-label": "やめる", dataset: { test: "desert-quit" }, hidden: true });
    root.append(canvas, hud, startPop, versus, caption, controls, panel);
    host.append(root);
    root.focus({ preventScroll: true });

    const input = { left: false, right: false };
    const releaseButtons = [];
    const resetInput = () => {
      input.left = input.right = false;
      for (const release of releaseButtons) release();
    };
    let pose = "rider";
    let paused = false;
    let game = null, mode = null, bot = null, botMemo = {}, botLag = 0, last = 0, world = null, particles = [], shakeT = 0, flashT = 0, popT = 0, popText = "", popKind = "";
    let rival = null, raceWith = "noor", countdown = 0, countShown = "", slowT = 0, rings = [], floaters = [], halfShown = 0, curveSigns = [];
    let curveTip = "idle", curveTipT = 0, carved = false, lead = 0; // 最初のカーブの案内（一度だけ）と、相手との前後
    const view = { depth: CAM.depth, back: CAM.back, roll: 0, kick: 0 }; // 速さで広がる視界。back を depth に比例させ、人物の大きさは変えない
    const streaks = Array.from({ length: 80 }, (_, i) => ({ angle: (i / 80) * Math.PI * 2 + Math.random() * 0.1, phase: Math.random(), len: 0.6 + Math.random() * 0.8, w: 1 + Math.random() * 2 }));
    let tut = null;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      clearTimeout(cutinTimer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      signal?.removeEventListener("abort", finish);
      rideSe.dispose();
      resetBgmTempo();
      root.remove();
      delete window.__desertRide;
      restoreBgm();
      resolve({ results, practiced });
    };
    if (signal?.aborted) { finish(); return; }
    signal?.addEventListener("abort", finish, { once: true });

    // ---- 入力 -------------------------------------------------------------------------
    const act = () => { if (game && !game.finished && mode && countdown <= 0) { const kind = press(game); if (kind) onPress(kind); } };
    const doBoost = () => { if (game && !game.finished && mode && countdown <= 0) onBoostEvent(boost(game)); };
    const onKey = event => {
      if (!root.isConnected) return;
      if (["ArrowLeft", "a", "A"].includes(event.key)) { input.left = true; event.preventDefault(); }
      else if (["ArrowRight", "d", "D"].includes(event.key)) { input.right = true; event.preventDefault(); }
      else if ([" ", "ArrowUp", "w", "W"].includes(event.key) && mode) { if (!event.repeat) act(); event.preventDefault(); }
      else if (["ArrowDown", "Shift", "s", "S", "b", "B"].includes(event.key) && mode) { if (!event.repeat) doBoost(); event.preventDefault(); }
      else if (event.key === "Escape" && mode) { event.preventDefault(); quit.click(); }
      else if (event.key === "Escape" && panel.querySelector(".dr-help:not([hidden])")) { event.preventDefault(); panel.querySelector(".dr-help-close").click(); }
    };
    const onKeyUp = event => {
      if (["ArrowLeft", "a", "A"].includes(event.key)) input.left = false;
      if (["ArrowRight", "d", "D"].includes(event.key)) input.right = false;
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    const holdButton = (label, cls, test, on, off, artKey) => {
      const button = el(`button.dr-touch.${cls}`, { type: "button", dataset: { test }, "aria-label": label }, [el("span", { text: label })]);
      const files = artKey === "jump" ? [DESERT_CONTROL_ART.jump, DESERT_CONTROL_ART.land] : [DESERT_CONTROL_ART[artKey]];
      let loaded = 0;
      for (const [index, file] of files.entries()) {
        const image = el(`img.dr-control-image${artKey === "jump" ? index ? ".dr-image-land" : ".dr-image-jump" : ""}`, { alt: "", draggable: false });
        image.addEventListener("load", () => { if (++loaded === files.length) button.classList.add("art-ready"); });
        image.addEventListener("error", () => button.classList.remove("art-ready"));
        button.prepend(image);
        image.src = imgFileUrl(file);
      }
      const pointers = new Set();
      const down = event => { event.preventDefault(); unlockAudio(); pointers.add(event.pointerId); button.setPointerCapture?.(event.pointerId); button.classList.add("on"); on(); };
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
    canvas.addEventListener("pointerdown", event => { if (mode) { event.preventDefault(); unlockAudio(); act(); } });
    quit.addEventListener("click", () => { if (!mode) return; stopRun(); showMenu(mode === "practice" ? "練習をやめた。" : "途中でやめた。記録は残らない。"); });
    panel.addEventListener("click", event => { if (event.target.closest("button")) rideSe.play("decide", 0.35); });
    panel.addEventListener("focusin", event => { if (event.target.matches("button")) rideSe.play("cursor", 0.25); });

    // ---- 進行 -------------------------------------------------------------------------
    function setPhase(name) { root.dataset.phase = name; }
    function showMenu(message = "") {
      rideSe.stop();
      resetBgmTempo();
      mode = null; game = null; tut = null; bot = null;
      controls.hidden = true; quit.hidden = true; caption.textContent = ""; delete caption.dataset.kind; hud.replaceChildren();
      startPop.classList.remove("show"); versus.classList.remove("show");
      setPhase("menu");
      const start = el("button.btn.primary.dr-button", { type: "button", text: results.length ? "もう一度滑る" : "滑る", dataset: { test: "desert-start" }, onclick: () => startRun("run", "noor") });
      const naruButton = rivals.includes("naru") ? el("button.btn.dr-button", { type: "button", text: "★ なると勝負（裏）", dataset: { test: "desert-start-naru" }, onclick: () => startRun("run", "naru") }) : null;
      const practice = el("button.btn.ghost.dr-button", { type: "button", text: practiced || results.length ? "練習をもう一度" : "練習から始める", dataset: { test: "desert-practice" }, onclick: () => startRun("practice") });
      const leave = el("button.btn.ghost.dr-button", { type: "button", text: "砂丘を下りる", dataset: { test: "desert-leave" }, onclick: finish });
      // 遊び方は「？」を開いた時だけ（#2838・ミニゲーム共通の方針）。練習は「練習から始める」が説明を兼ねる。
      const help = el("div.dr-help", { hidden: true, role: "dialog", "aria-label": "遊び方", dataset: { test: "desert-help-panel" } }, [
        el("p.dr-help-title", { text: "遊び方" }),
        el("ul.dr-howto", HOWTO[touchUi() ? "touch" : "keys"].map(text => el("li", { text }))),
        el("button.btn.ghost.dr-button.dr-help-close", { type: "button", text: "閉じる", dataset: { test: "desert-help-close" }, onclick: () => { help.hidden = true; delete help.parentElement.dataset.help; helpButton.focus(); } }),
      ]);
      const helpButton = el("button.dr-help-btn", { type: "button", text: "？", title: "遊び方", "aria-label": "遊び方", dataset: { test: "desert-help" },
        onclick: () => { help.hidden = false; help.parentElement.dataset.help = "open"; help.querySelector("button").focus(); } });
      panel.replaceChildren(el("div.dr-card.dr-menu", { dataset: { test: "desert-menu" } }, [
        el("p.dr-kicker", { text: "DUBAI · SAND DUNES" }),
        el("h2.dr-title", { text: "DESERT RIDE" }),
        el("p.dr-lead", { text: message || "砂丘を一気に滑り下りる。ヌールより先に、ゴールの旗へ。" }),
        help, helpButton,
        oldBest ? el("p.dr-legacy-best", { text: `旧ルールの記録 ${oldBest.score.toLocaleString("ja-JP")}点 ／ ${oldBest.rank}（別記録）`, dataset: { test: "desert-legacy-best" } }) : null,
        currentBest ? el("p.dr-best", { text: `自己ベスト ${currentBest.score.toLocaleString("ja-JP")}点 ／ ${currentBest.rank}`, dataset: { test: "desert-best" } }) : null,
        el("div.dr-actions", [start, naruButton, practice, leave]),
      ]));
      (tutorial && !practiced ? practice : start).focus();
    }
    function pickRunCourse() {
      if (courseId) return buildCourse({ id: courseId });
      if (seed != null && Number.isFinite(Number(seed))) {
        const n = Number(seed);
        return COURSE_PACKS.some(p => p.seed === n) ? buildCourse({ seed: n }) : generateCourse(n);
      }
      return pickCourse((Math.random() * 0xFFFFFFFF) >>> 0);
    }
    function onBoostEvent(kind) {
      if (kind === "recover") {
        rideSe.play("boost", 0.55); showPop("リカバリー", "recover"); burst(28, 1.8); floater("リカバリー", "recover");
        rings.push({ age: 0, life: 0.7, power: 1.35, burst: true });
        if (!reducedMotion) { shakeT = Math.max(shakeT, 0.28); flashT = Math.max(flashT, 0.12); view.kick = Math.max(view.kick, 1.2); }
      } else if (kind === "boost") {
        rideSe.play("boost", 0.5); showPop("BOOST!!", "boost"); burst(10, 0.8);
        rings.push({ age: 0, life: 0.62, power: 1.2, burst: true });
        if (!reducedMotion) { shakeT = 0.1; view.kick = 0.7; }
      }
    }
    function startRun(kind, who = raceWith) {
      const thisRun = ++runId;
      resetInput();
      unlockAudio();
      rideSe.stop();
      raceWith = rivals.includes(who) ? who : "noor";
      rideBgm = RIDE_BGM[kind === "practice" ? "practice" : raceWith];
      playBgm(rideBgm);
      mode = kind;
      panel.replaceChildren();
      const course = kind === "practice" ? practiceCourse() : pickRunCourse();
      rival = kind === "practice" ? null : rivalRun(course, { who: raceWith });
      game = createGame(course, { rival });
      curveSigns = curveSignsFor(course);
      world = { sky: 0, yaw: 0, sunPulse: 0 };
      resetBgmTempo();
      lead = 0; curveTipT = 0; if (curveTip === "shown") curveTip = carved ? "done" : "idle";
      particles = []; rings = []; floaters = []; clearTimeout(cutinTimer); cutin.classList.remove("show"); cutin.replaceChildren(); shakeT = 0; flashT = 0; popT = 0; slowT = 0; halfShown = 0; bot = null; botMemo = {}; botLag = 0; zapClock = 0.35; zapBurstT = 0; zapBurstShown = false;
      Object.assign(view, { depth: CAM.depth, back: CAM.back, roll: 0, kick: 0, boost: 0 });
      shownKmh = toKmh(SPEED.start);
      countdown = kind === "practice" ? 0 : COUNTDOWN; countShown = "";
      root.dataset.countdown = countdown > 0 ? "on" : "";
      root.dataset.rival = rival ? raceWith : "";
      root.dataset.carve = "";
      // 裏の相手（なる）との勝負は、スタートの合図の間に名乗りを出す
      versus.replaceChildren(...(rival && RIVAL_TITLES[raceWith] ? [el("small", { text: RIVAL_TITLES[raceWith] }), el("b", { text: `VS ${RIVAL_NAMES[raceWith]}` })] : []));
      versus.classList.toggle("show", versus.childElementCount > 0);
      tut = kind === "practice" ? { step: "move", moved: false, bumpTries: 0, said: new Set() } : null;
      pop.classList.remove("show"); startPop.classList.remove("show");
      controls.hidden = false; quit.hidden = false;
      setPhase(kind);
      delete caption.dataset.kind;
      caption.textContent = kind === "practice" ? tutorialText("move") : "";
      buildHud();
      updateHud(); // 開始直後から相手名・速度・BOOSTを表示する。最初の描画フレームを待たない。
      cancelAnimationFrame(frame);
      rideSe.ready().then(() => {
        if (done || mode !== kind || runId !== thisRun) return;
        if (countdown > 0) rideSe.play("countdown", 0.55);
        last = performance.now();
        frame = requestAnimationFrame(tick);
      });
    }
    function stopRun() { ++runId; cancelAnimationFrame(frame); mode = null; rideSe.stop(); resetBgmTempo(); versus.classList.remove("show"); }
    function onPress(kind) {
      if (kind === "big") { rideSe.play("jump", 0.6); showPop("JUMP!", "jump"); }
      else if (kind === "hop") rideSe.play("jump", 0.38);
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
      const paths = Array.from({ length: ZAP_SLOTS }, () => {
        const path = document.createElementNS(ns, "path");
        path.setAttribute("fill", "none"); path.setAttribute("vector-effect", "non-scaling-stroke");
        svg.append(path);
        return path;
      });
      return { svg, paths };
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
    function updateZaps(charge, gaugeZap) {
      const now = performance.now() / 1000;
      const burst = zapBurstT > 0 && !reducedMotion;
      root.dataset.zap = burst ? "burst" : "";
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
    function landingCue(g) {
      if (!(g.air > 0) || g.airKind !== "big" || g.fallT > 0) return { state: "", ring: 1, tag: "" };
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
      hudNodes = {
        score: el("strong.dr-score", { text: "0" }), combo: el("span.dr-combo", { text: "" }),
        time: el("span.dr-time", { text: "0.0" }), kmh: el("strong.dr-kmh", { text: "0", dataset: { test: "desert-kmh" } }), gauge: el("i"), gaugeBox: null, progress: el("i"),
        you: el("b.dr-mark.dr-mark-you", { title: "あなた" }), noor: el(`b.dr-mark.dr-mark-${raceWith}`, { title: RIVAL_NAMES[raceWith] }), race: el("span.dr-race", { dataset: { test: "desert-race-gap" } }),
        course: el("span.dr-course", { dataset: { test: "desert-course" } }),
        speedo: el("div.dr-speedo", { dataset: { test: "desert-speedo" } }), speedFill: dial.fill, needle: dial.needle,
      };
      // BOOST は ⚡ とゲージだけ（% の文字は出さない。#2838）
      hudNodes.gaugeZap = makeZap("dr-zap dr-zap-gauge", "0 0 200 40");
      hudNodes.gaugeBox = el("div.dr-gauge", { dataset: { test: "desert-gauge" }, title: "BOOST" }, [hudNodes.gauge, hudNodes.gaugeZap.svg]);
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
    function updateHud() {
      if (!hudNodes || !game) return;
      hudNodes.score.textContent = mode === "practice" ? "練習" : Math.max(0, Math.round(game.score)).toLocaleString("ja-JP");
      hudNodes.combo.textContent = game.combo >= 2 ? `${game.combo} COMBO ×${(Math.min(3, 1 + 0.15 * game.combo)).toFixed(2).replace(/0$/, "")}` : "";
      hudNodes.combo.dataset.hot = game.combo >= 10 ? "2" : game.combo >= 5 ? "1" : "";
      hudNodes.time.textContent = game.t.toFixed(1);
      const targetKmh = toKmh(game.speed);
      shownKmh += (targetKmh - shownKmh) * (countdown > 0 ? 1 : 0.22);
      hudNodes.kmh.textContent = String(Math.round(shownKmh));
      const boosting = game.boostT > 0;
      hudNodes.kmh.dataset.fast = boosting ? "boost" : shownKmh > toKmh(SPEED.max) * 0.85 ? "fast" : "";
      hudNodes.speedo.dataset.fast = hudNodes.kmh.dataset.fast;
      const t = Math.max(0, Math.min(1, shownKmh / DISPLAY.dialMax));
      hudNodes.speedFill.setAttribute("stroke-dashoffset", (SPEEDO_ARC * (1 - t)).toFixed(2));
      hudNodes.needle.setAttribute("transform", `rotate(${dialAngle(shownKmh).toFixed(1)} ${DIAL.c} ${DIAL.c})`);
      const ready = game.gauge > 0;
      hudNodes.gauge.style.width = `${Math.round(100 * (boosting ? game.boostT / 3 : game.gauge))}%`;
      hudNodes.gaugeBox.dataset.state = boosting ? "boost" : ready ? "full" : "";
      root.dataset.gauge = boosting ? "boost" : ready ? "full" : "";
      root.dataset.boost = boosting ? "on" : "";
      root.dataset.recover = canRecover(game) ? "ready" : "";
      const charge = boosting ? 0 : Math.max(0, Math.min(1, game.gauge));
      root.dataset.charge = charge >= 0.999 ? "max" : charge >= 0.5 ? "mid" : charge > 0 ? "low" : "";
      updateZaps(charge, hudNodes.gaugeZap);
      const canBrace = game.air > 0 && game.airKind !== "bounce";
      jumpButton.dataset.air = canBrace ? "true" : "";
      jumpButton.setAttribute("aria-label", canBrace ? "着地" : "ジャンプ");
      const landing = landingCue(game);
      jumpButton.dataset.land = landing.state;
      jumpButton.style.setProperty("--land", landing.ring.toFixed(3));
      landTag.textContent = landing.tag;
      if (hudNodes.course) {
        hudNodes.course.textContent = mode === "practice" ? "" : (game.course.name || "");
        hudNodes.course.hidden = mode === "practice" || !game.course.name;
        // 走り出して4秒で消す（跳んだ人物の頭にかぶらないように。コース名は結果のカードにも出る）
        hudNodes.course.dataset.fade = countdown <= 0 && game.t > 4 ? "out" : "";
      }
      const progress = z => `${(100 * Math.min(1, z / game.course.length)).toFixed(1)}%`;
      hudNodes.progress.style.width = progress(game.z);
      hudNodes.you.style.left = progress(game.z);
      if (rival) {
        const noor = rivalAt(rival, game.rivalClock);
        hudNodes.noor.style.left = progress(noor.z);
        const gap = game.z - Math.min(noor.z, game.course.length);
        const side = Math.abs(gap) < 3, shownGap = Math.max(1, Math.round(toMeters(Math.abs(gap)))); // 差は画面の縮尺の m で出す
        const name = RIVAL_NAMES[raceWith];
        hudNodes.race.textContent = countdown > 0 ? `VS ${name}` : side ? `${name}と並走` : gap > 0 ? `${name}に ${shownGap}m 差` : `${name}まで ${shownGap}m`;
        hudNodes.race.dataset.lead = countdown > 0 || side ? "" : gap > 0 ? "you" : "noor";
        // 前後が入れ替わった瞬間（内部の距離で3以上の差がついた時）に一言。スタート直後の並びは数えない
        const now = countdown > 0 || game.finished || side ? lead : Math.sign(gap);
        if (now !== lead) {
          if (lead !== 0 || game.t > 4) { floater(now > 0 ? `${name}を抜いた！` : `${name}に抜かれた…`, now > 0 ? "race" : "behind"); if (now > 0) rideSe.play("near", 0.5); }
          lead = now;
        }
      }
      root.dataset.carve = game.carving ? "on" : "";
    }

    // ---- 練習の説明 ------------------------------------------------------------------
    function say(key) { if (tut.said.has(key + tut.step)) return; tut.said.add(key + tut.step); caption.textContent = tutorialText(key); }
    function updateTutorial(events) {
      if (!tut) return;
      if (tut.step === "move") {
        if (Math.abs(game.x) > 0.25) tut.moved = true;
        if (tut.moved && game.z > 60) { tut.step = "rock"; say("rock"); }
        else if (game.z > 90) { tut.step = "rock"; say("rock"); }
      } else if (tut.step === "rock") {
        if (game.z > 170) { tut.step = "bump"; say("bump"); }
      } else if (tut.step === "bump") {
        if (game.air > 0 && game.airKind === "big") { tut.step = "brace"; say("brace"); }
        else if (events.some(e => e.kind === "land" && e.grade === "bounce")) { tut.bumpTries += 1; tut.step = "bumpAgain"; say("retryBump"); }
      } else if (tut.step === "bumpAgain") {
        if (game.air > 0 && game.airKind === "big") { tut.step = "brace"; say("brace"); }
        else if (game.z > 330) { tut.step = "rock2"; caption.textContent = TUTORIAL.rock; }
      } else if (tut.step === "brace") {
        const landed = events.find(e => e.kind === "land" && e.grade !== "bounce");
        if (landed) { tut.step = game.z < 300 ? "rock2" : "finish"; caption.textContent = landed.grade === "perfect" ? "完璧な着地。その調子" : landed.grade === "good" ? "いい着地。もう少し遅く押すと完璧" : "着地の直前に押すと、姿勢が整う"; }
      } else if (tut.step === "rock2") {
        if (game.z > 345) { tut.step = "trick"; say("trick"); }
      } else if (tut.step === "trick") {
        if (game.spinDir !== 0 && game.spinHold) { tut.step = "trickLetGo"; say("trickLetGo"); }
        if (events.some(e => e.kind === "trick")) { tut.step = "boostWait"; caption.textContent = TUTORIAL.trickDone; }
        else if (events.some(e => e.kind === "fall" && e.reason === "spin")) { tut.step = "boostWait"; caption.textContent = TUTORIAL.trickFall; }
        else if (game.z > 470) tut.step = "boostWait";
      } else if (tut.step === "trickLetGo") {
        if (events.some(e => e.kind === "trick")) { tut.step = "boostWait"; caption.textContent = TUTORIAL.trickDone; }
        else if (events.some(e => e.kind === "fall" && e.reason === "spin")) { tut.step = "boostWait"; caption.textContent = TUTORIAL.trickFall; }
      } else if (tut.step === "boostWait") {
        if (game.z > 475 && game.air <= 0) { tut.step = "boost"; chargeBoost(game, 1); say("boost"); }
      } else if (tut.step === "boost") {
        if (game.boostT > 0) { tut.step = "boostGo"; say("boostGo"); }
      }
      if (game.z > game.course.length - 30) caption.textContent = TUTORIAL.finish;
    }

    /** 本番で最初のカーブに入った時、切り込み方を一度だけ案内する（切り込めたら、次の滑走からは出さない）。 */
    function updateCurveTip(dt) {
      if (mode !== "run") return;
      if (game.stats.carves > 0) carved = true;
      if (curveTip === "idle" && !carved && game.air <= 0 && Math.abs(curveAt(game.course, game.z)) >= 0.4) {
        curveTip = "shown"; curveTipT = 3.6;
        caption.dataset.kind = "tip"; caption.textContent = CURVE_TIP;
      } else if (curveTip === "shown" && curveTipT > 0) {
        curveTipT -= dt;
        if (curveTipT <= 0 || game.finished) { caption.textContent = ""; delete caption.dataset.kind; }
      }
    }

    // ---- ループ -------------------------------------------------------------------------
    function tick(now) {
      if (done || !mode) return;
      if (paused) { last = now; frame = requestAnimationFrame(tick); return; }
      const real = Math.min(0.05, (now - last) / 1000) * speedUp;
      last = now;
      if (countdown > 0) {
        // スタートの合図（3・2・1・GO）。合図の間は時計を進めない
        countdown = Math.max(0, countdown - real);
        const shown = countdown > 1.6 ? "3" : countdown > 0.8 ? "2" : countdown > 0 ? "1" : "GO!";
        if (shown !== countShown) {
          countShown = shown;
          if (shown === "GO!") { showPop("GO!", "go"); root.dataset.countdown = ""; versus.classList.remove("show"); if (!reducedMotion) view.kick = 1; }
          else showPop(shown, "count");
        }
        if (countdown > 0) { updateHud(); simulateParticles(real); draw(real); frame = requestAnimationFrame(tick); return; }
      }
      // 決めた瞬間のスロー（動き軽減では使わない）
      slowT = Math.max(0, slowT - real);
      const dt = real * (slowT > 0 ? 0.35 : 1);
      const before = game.events.length;
      if (bot) {
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
        const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
        // 左右のボタン・キーは最大舵角（2026-11-11 オーナー「スティックはいらない」でスティックを外した）
        const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        for (let i = 0; i < steps && !game.finished; i++) step(game, { ...input, steer }, dt / steps);
      }
      const events = game.events.slice(before);
      react(events);
      rideSe.motion({ speed: (game.speed / SPEED.max) * (game.boostT > 0 ? 1.35 : 1), carve: Math.max(Math.abs(game.vx), game.carving ? 0.9 : 0), grounded: game.air <= 0 && game.fallT <= 0,
        // ブースト中の風切り（終わりの0.5秒で消える）
        boost: game.boostT > 0 && !game.finished ? Math.min(1, game.boostT / 0.5) : 0 });
      // ブーストの放電: 溜まるほど「ビリッ」の間隔が詰まる。鳴った瞬間はボタン・ゲージ・板の稲妻を強く光らせて音と合わせる
      const charge = game.boostT > 0 || game.finished ? 0 : game.gauge;
      zapBurstT = Math.max(0, zapBurstT - real);
      if (charge >= 0.1) {
        zapClock -= real;
        if (zapClock <= 0) { rideSe.zap(charge); zapBurstT = 0.14; zapClock = desertZapGap(charge); }
      } else zapClock = 0.35; // 溜まり始めたら少しして最初の1発
      // ブースト中は曲が速くなる（音程は保ち、約0.2秒で滑らかに切り替わる）
      // ブーストの始まりと終わりに一度だけ切り替える（少しずつ変えると iPhone で曲が止まる。2026-11-11）
      const bgmRate = game.boostT > 0 && !game.finished ? BOOST_BGM_RATE : 1;
      if (bgmPlaybackRate() !== bgmRate) setBgmPlaybackRate(bgmRate, { immediate: true });
      updateCurveTip(real);
      updateTutorial(events);
      updateHud();
      simulateParticles(dt);
      draw(dt);
      if (game.finished) { onFinished(); return; }
      frame = requestAnimationFrame(tick);
    }
    function react(events) {
      const trick = events.find(e => e.kind === "trick");
      for (const event of events) {
        if (event.kind === "land") {
          rideSe.play("land", 0.55);
          const big = event.grade !== "bounce" && event.grade !== "hop";
          const big360 = trick && trick.half >= 2; // 360 以上は角度と着地を一つの結果にまとめる
          if (big360) showCutin(trick, event.grade);
          if (event.grade === "perfect") { SE.perfect(); if (!big360) showPop(trick ? `${trick.degrees} PERFECT!` : "PERFECT", trick ? "trick" : "perfect"); burst(30, 1.5); }
          else if (event.grade === "good") { SE.good(); if (!big360) showPop(trick ? `${trick.degrees}! GOOD` : "GOOD", trick ? "trick" : "good"); burst(18, 1.1); }
          else if (event.grade === "plain") { if (trick && !big360) showPop(`${trick.degrees}!`, "trick"); burst(12, 0.9); }
          else burst(6, 0.6);
          if (event.gaugeGained > 0) floater(`BOOST +${Math.round(event.gaugeGained * 100)}%`, "gauge");
          else if (event.points) floater(`+${event.points}`, event.grade);
          if (big) { rings.push({ age: 0, life: 0.55, power: event.grade === "perfect" ? 1.3 : 1 }); if (!reducedMotion) shakeT = Math.max(shakeT, event.grade === "perfect" ? 0.2 : 0.12); }
        } else if (event.kind === "trick") {
          SE.reelWin(); // 角度は HUD の一か所だけ。人物の横に重複表示しない。
          if (event.half >= 2) { SE.just(); if (!reducedMotion) slowT = 0.5; } // カットインの間はゆっくり
        } else if (event.kind === "fall") {
          rideSe.play("fall", 0.7); showPop(event.reason === "spin" ? "回り切れず…" : "転倒…", "fall"); burst(34, 1.6);
          if (!reducedMotion) { shakeT = 0.45; flashT = 0.18; }
        } else if (event.kind === "near") { rideSe.play("near", 0.45); floater(`かすめ +${event.points}`, "near"); if (game.combo >= 2) showPop(`${game.combo} COMBO`, "combo"); }
        else if (event.kind === "smash") { rideSe.play("smash", 0.6); floater(`粉砕 +${event.points}`, "smash"); chips(event.size); if (!reducedMotion) shakeT = Math.max(shakeT, 0.22); }
        else if (event.kind === "carve") floater(`カービング +${event.points}`, "carve");
        else if (event.kind === "gaugeFull") { rideSe.play("thunder", 0.55); rideSe.play("gaugeFull", 0.35); zapBurstT = 0.35; zapClock = 0.6; floater(touchUi() ? "BOOST OK" : "BOOST OK ↓", "gauge"); }
        else if (event.kind === "boost") onBoostEvent("boost");
        else if (event.kind === "recover") onBoostEvent("recover");
        else if (event.kind === "race") {
          if (event.won) { floater(`${RIVAL_NAMES[event.who] || "ヌール"}に勝利 +${event.points}`, "race"); }
        } else if (event.kind === "finish") { rideSe.play("goal", 0.7); }
      }
      // 回転中は半回転ごとに角度を見せる（180 → 360 → …）
      const half = game.spinDir !== 0 ? Math.floor(Math.abs(game.rot) * 2 + 1e-6) : 0;
      if (half > halfShown && half > 0) { rideSe.play("near", 0.35); showPop(`${half * 180}°`, "spin"); }
      halfShown = half;
    }
    function onFinished() {
      rideSe.stop();
      resetBgmTempo();
      caption.textContent = ""; delete caption.dataset.kind;
      controls.hidden = true; quit.hidden = true;
      if (mode === "practice") {
        practiced = true;
        mode = null;
        caption.textContent = "";
        setPhase("practiced");
        panel.replaceChildren(el("div.dr-card.dr-menu", { dataset: { test: "desert-practiced" } }, [
          el("p.dr-kicker", { text: "PRACTICE DONE" }),
          el("h2.dr-title", { text: "練習おわり" }),
          el("p.dr-lead", { text: guide ? `${guide}「もう一度練習してもいいし、本番へ進んでもいいよ」` : "もう一度練習するか、本番へ進もう。操作は「？」でも確認できる。" }),
          el("div.dr-actions", [
            el("button.btn.primary.dr-button", { type: "button", text: "本番を滑る", dataset: { test: "desert-start" }, onclick: () => startRun("run", "noor") }),
            el("button.btn.ghost.dr-button", { type: "button", text: "もう一度練習", dataset: { test: "desert-practice" }, onclick: () => startRun("practice") }),
            el("button.btn.ghost.dr-button", { type: "button", text: "砂丘を下りる", dataset: { test: "desert-leave" }, onclick: finish }),
          ]),
        ]));
        panel.querySelector("button")?.focus();
        return;
      }
      const result = summary(game);
      results.push(result);
      const newBest = !currentBest || result.score > currentBest.score;
      if (newBest) currentBest = { score: result.score, rank: result.rank };
      try { onResult?.(result); } catch (error) { console.error(error); }
      mode = null;
      setPhase("result");
      const row = (label, value, test) => el("div.dr-row", { dataset: { test } }, [el("span", { text: label }), el("strong", { text: value })]);
      const race = result.race;
      panel.replaceChildren(el("div.dr-card.dr-result", { dataset: { test: "desert-result", rank: result.rank } }, [
        el("p.dr-kicker", { text: "RESULT" }),
        race ? el("p.dr-race-result", { dataset: { test: "desert-race", won: String(race.won), who: race.who } }, [
          el("b", { text: race.won ? `${RIVAL_NAMES[race.who]}に勝った！` : `${RIVAL_NAMES[race.who]}の勝ち` }),
          el("span", { text: race.won ? `${race.gap.toFixed(1)}秒差` : race.gap > 0 ? `あと ${race.gap.toFixed(1)}秒` : "同時…わずかに届かず" }),
        ]) : null,
        el("div.dr-rank", { dataset: { test: "desert-rank" } }, [el("b", { text: result.rank }), el("span", { text: RANK_WORDS[result.rank] })]),
        el("p.dr-total", { dataset: { test: "desert-total" } }, [el("small", { text: "TOTAL" }), el("strong", { text: result.score.toLocaleString("ja-JP") }), el("small", { text: "点" })]),
        el("div.dr-rows", [
          row("滑走時間", `${result.time.toFixed(1)} 秒`, "desert-time"),
          row("最高コンボ", `${result.maxCombo}`, "desert-combo"),
          row("転倒", `${result.falls} 回`, "desert-falls"),
          row("大ジャンプ", `${result.bigJumps} 回`, "desert-jumps"),
          row("着地", `完璧 ${result.perfect} ／ 良い ${result.good}`, "desert-landings"),
          row("岩をかすめた", `${result.nearMiss} 回`, "desert-near"),
          row("トリック", result.tricks ? `${result.tricks} 回（最高 ${result.bestTrick}）` : "0 回", "desert-tricks"),
          row("ブースト", `${result.boosts} 回${result.smashed ? `（岩を ${result.smashed} 個粉砕）` : ""}`, "desert-boosts"),
          result.recoveries ? row("リカバリー", `${result.recoveries} 回`, "desert-recoveries") : null,
          result.carves ? row("カービング", `${result.carves} 回`, "desert-carves") : null,
          result.courseName ? row("コース", result.courseName, "desert-result-course") : null,
        ]),
        el("p.dr-best", { text: newBest ? "自己ベスト更新！" : `自己ベスト ${currentBest.score.toLocaleString("ja-JP")}点 ／ ${currentBest.rank}`, dataset: { test: "desert-best" } }),
        el("div.dr-actions", [
          el("button.btn.primary.dr-button", { type: "button", text: "もう一度滑る", dataset: { test: "desert-retry" }, onclick: () => startRun("run", raceWith) }),
          rivals.includes("naru") ? el("button.btn.dr-button", { type: "button", text: raceWith === "naru" ? "ヌールと競走" : "なると勝負",
            dataset: { test: raceWith === "naru" ? "desert-start-noor" : "desert-start-naru" }, onclick: () => startRun("run", raceWith === "naru" ? "noor" : "naru") }) : null,
          el("button.btn.ghost.dr-button", { type: "button", text: "砂丘を下りる", dataset: { test: "desert-leave" }, onclick: finish }),
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
    function simulateParticles(dt) {
      if (!game) return;
      const running = mode && countdown <= 0;
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
          const side = carving ? -carving : game.vx > 0 ? -1 : 1, spray = (reducedMotion ? 8 : 34) * Math.min(1.6, carve) * k;
          for (let i = 0; i < spray * dt * 4; i++) particles.push({ x: side * (20 + Math.random() * 30), y: -6, vx: side * (120 + Math.random() * 260) * Math.min(1.5, carve), vy: -(90 + Math.random() * 200), r: 3 + Math.random() * 8, life: 0.45 + Math.random() * 0.35, age: 0 });
        }
      }
      for (const p of particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.chip ? 900 : 90) * dt; if (!p.chip) p.r += 18 * dt; }
      particles = particles.filter(p => p.age < p.life);
      if (particles.length > 360) particles.splice(0, particles.length - 360);
      for (const r of rings) r.age += dt;
      rings = rings.filter(r => r.age < r.life);
      for (const f of floaters) f.age += dt;
      floaters = floaters.filter(f => f.age < f.life);
      shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt); popT = Math.max(0, popT - dt * 1.4);
      view.kick = Math.max(0, view.kick - dt * 1.6);
      const boostTarget = game.boostT > 0.28 ? 1 : game.boostT > 0 ? game.boostT / 0.28 : 0;
      view.boost += (boostTarget - (view.boost || 0)) * Math.min(1, dt * 6);
    }

    // ---- 描画 ---------------------------------------------------------------------------
    const project = (xLane, y, dz) => {
      const scale = view.depth / dz;
      return { x: W / 2 + scale * xLane * CAM.meterPerLane * (W / 2), y: HORIZON + scale * (CAM.height - y) * (H / 2), scale, w: scale * CAM.meterPerLane * (W / 2) };
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
      // 速いほど視界が広がる（遠くが小さく流れる）。カメラの距離も同じ割合で縮め、人物の大きさは変えない。
      // GO とブーストの瞬間は一度ぐっと広がる。ブースト中はさらに少し引く。動き軽減では固定
      const fast = Math.min(1, Math.max(0, (game.speed - SPEED.min) / (SPEED_FULL - SPEED.min)));
      const feel = view.boost || 0;
      const targetDepth = reducedMotion ? CAM.depth : CAM.depth * (1 - 0.24 * fast - 0.12 * Math.min(1, view.kick) - 0.16 * feel);
      view.depth += (targetDepth - view.depth) * Math.min(1, dt * 4);
      view.back = CAM.back * view.depth / CAM.depth;
      const targetRoll = reducedMotion || countdown > 0 ? 0 : Math.max(-0.1, Math.min(0.1, -game.vx * 0.035 - curve * 0.075));
      view.roll += (targetRoll - view.roll) * Math.min(1, dt * 5);
      ctx.save();
      if (view.roll) { ctx.translate(W / 2, H * 0.62); ctx.rotate(view.roll); ctx.scale(1.06, 1.06); ctx.translate(-W / 2, -H * 0.62); }
      if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 16 * shakeT, (Math.random() - 0.5) * 12 * shakeT);
      const painted = drawBackdrop(dusk, progress);
      if (!painted) { drawSky(dusk, progress); drawDunes(dusk); }
      drawGround(dusk, painted);
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
      drawVignette(fast);
      if (flashT > 0) { ctx.fillStyle = game.boostT > 0 ? `rgba(255,190,110,${flashT * 1.05})` : `rgba(255,240,220,${flashT * 1.6})`; ctx.fillRect(0, 0, W, H); }
      drawRecoverHint();
    }
    /** 岩に当たった直後、BOOST で立て直せることをキャンバス上に出す（DOM の重ねが環境によって描画されない場合がある）。 */
    function drawRecoverHint() {
      if (!game || !canRecover(game)) return;
      const text = "立て直せる！";
      ctx.save();
      ctx.font = `900 18px ${fontFamily()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const x = W - 310, y = H - 200, w = ctx.measureText(text).width + 32, h = 36, r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + r, y - h / 2);
      ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
      ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
      ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
      ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
      ctx.closePath();
      ctx.fillStyle = "rgba(40, 26, 18, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 230, 180, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#fff8ee";
      ctx.fillText(text, x, y);
      ctx.restore();
    }
    /** 絵の遠景（空・太陽・陸）。絵がまだ無ければ false（図形の空と砂丘で描く）。 */
    const BACKDROP_SCALE = 0.95, BACKDROP_MARGIN = 60; // 余白は、傾き・揺れで見える画面の外
    // 遠景は傾けない別の面に整数の位置で並べてから、傾いた画面へ1枚で貼る（並べた絵の継ぎ目に線が出ないように）
    let backdropLayer = null;
    function drawBackdrop(dusk, progress) {
      const sky = art.get("sky"), land = art.get("land");
      if (!sky || !land) return false;
      if (!backdropLayer) { backdropLayer = document.createElement("canvas"); backdropLayer.width = W + BACKDROP_MARGIN * 2; backdropLayer.height = H; }
      const g = backdropLayer.getContext("2d");
      g.setTransform(1, 0, 0, 1, BACKDROP_MARGIN, 0);
      const B = DESERT_ART.backdrop, k = BACKDROP_SCALE, dw = Math.round(B.width * k), baseX = (W - dw) / 2;
      // 空はゆっくり、陸は速く横へ流れる（カーブに合わせたパララックス）。絵の地平線の行を HORIZON に合わせる。
      // 曲がっている間は遠くの砂丘が横へ流れ続ける（2026-11-11 オーナー「カーブがほんとにしてるのか分かりづらい」）
      const yawPx = world.yaw * YAW_PX * (reducedMotion ? 0.5 : 1);
      wrapImage(g, sky, 0, 0, B.width, sky.naturalHeight, baseX - yawPx * 0.5, HORIZON - B.horizon * k, dw, sky.naturalHeight * k);
      const duskSky = art.get("duskSky"), duskLand = art.get("duskLand");
      if (dusk > 0 && duskSky && duskLand) {
        // 同じ構図の夕方の絵を、ゴールへ近づくほど濃く重ねる
        g.globalAlpha = dusk;
        wrapImage(g, duskSky, 0, 0, B.width, duskSky.naturalHeight, baseX - yawPx * 0.5, HORIZON - B.horizon * k, dw, duskSky.naturalHeight * k);
        g.globalAlpha = 1;
      } else if (dusk > 0) {
        const tint = g.createLinearGradient(0, 0, 0, HORIZON + 10);
        tint.addColorStop(0, `rgba(120,72,110,${dusk * 0.85})`); tint.addColorStop(0.62, `rgba(245,150,84,${dusk * 0.8})`); tint.addColorStop(1, `rgba(255,208,140,${dusk * 0.7})`);
        g.fillStyle = tint; g.fillRect(-BACKDROP_MARGIN, 0, W + BACKDROP_MARGIN * 2, HORIZON + 10);
      }
      // 太陽: 進むほど大きく低く。ゴールの手前では砂丘の稜線の後ろへ沈みかける。
      // 曲がり始めに横へ動き、その先は画面に残る（ゴールの夕日を見失わない）
      const sunX = W * 0.5 - Math.tanh(world.yaw * 0.8) * 300 + 180 * (1 - progress), sunY = lerp(70, HORIZON - 34, Math.min(1, progress * 1.05)), r = lerp(30, 72, progress);
      const glow = g.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 3.2);
      glow.addColorStop(0, `rgba(255,230,170,${0.55 + 0.3 * dusk})`); glow.addColorStop(1, "rgba(255,200,120,0)");
      g.fillStyle = glow; g.fillRect(sunX - r * 3.2, sunY - r * 3.2, r * 6.4, r * 6.4);
      g.fillStyle = mixColor([255, 248, 220], [255, 170, 90], dusk);
      g.beginPath(); g.arc(sunX, sunY, r, 0, Math.PI * 2); g.fill();
      // 陸: 稜線〜地平線は空と同じ倍率、地平線より下（平らな砂）は画面の下端まで伸ばす
      const landX = baseX - yawPx, above = B.horizon - DESERT_ART.land.top, below = B.height - B.horizon;
      // ブースト中は遠景を左右に少しずらして重ね、流れているように見せる
      const smear = !reducedMotion && (view.boost || 0) > 0.2 ? 14 * (view.boost || 0) : 0;
      for (const [image, alpha] of [[land, 1], [dusk > 0 ? duskLand : null, dusk]]) {
        if (!image) continue;
        for (const [shift, a] of smear ? [[0, alpha], [smear, alpha * 0.28], [-smear, alpha * 0.28]] : [[0, alpha]]) {
          g.globalAlpha = a;
          wrapImage(g, image, 0, 0, B.width, above, landX + shift, HORIZON - above * k, dw, above * k);
          wrapImage(g, image, 0, above, B.width, below, landX + shift, HORIZON, dw, H - HORIZON);
        }
      }
      g.globalAlpha = 1;
      ctx.drawImage(backdropLayer, -BACKDROP_MARGIN, 0);
      return true;
    }
    /** 横へ流れる遠景を、面を覆うまで並べて描く。隣は左右反転した同じ絵なので絵柄がつながり、整数の位置に置くので隙間も重なりも出ない。 */
    function wrapImage(g, image, sx, sy, sw, sh, x, y, dw, dh) {
      const start = Math.round(x);
      let index = Math.floor((-BACKDROP_MARGIN - start) / dw);
      for (let left = start + index * dw; left < W + BACKDROP_MARGIN; left += dw, index++) {
        if (index % 2 === 0) { g.drawImage(image, sx, sy, sw, sh, left, y, dw, dh); continue; }
        g.save(); g.translate(left + dw, y); g.scale(-1, 1);
        g.drawImage(image, sx, sy, sw, sh, 0, 0, dw, dh);
        g.restore();
      }
    }
    function drawSky(dusk, progress) {
      const top = mixColor([92, 158, 226], [120, 72, 110], dusk), mid = mixColor([176, 212, 240], [245, 150, 84], dusk), bottom = mixColor([236, 226, 206], [255, 208, 140], dusk);
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 20);
      sky.addColorStop(0, top); sky.addColorStop(0.62, mid); sky.addColorStop(1, bottom);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON + 20);
      // 太陽: 進むほど大きく低く。ゴールの手前では地平線に触れる
      const sunX = W * 0.5 - Math.tanh(world.yaw * 0.8) * 300 + 180 * (1 - progress), sunY = lerp(70, HORIZON - 14, Math.min(1, progress * 1.05)), r = lerp(30, 72, progress);
      const glow = ctx.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 3.2);
      glow.addColorStop(0, `rgba(255,230,170,${0.55 + 0.3 * dusk})`); glow.addColorStop(1, "rgba(255,200,120,0)");
      ctx.fillStyle = glow; ctx.fillRect(sunX - r * 3.2, sunY - r * 3.2, r * 6.4, r * 6.4);
      ctx.fillStyle = mixColor([255, 248, 220], [255, 170, 90], dusk);
      ctx.beginPath(); ctx.arc(sunX, sunY, r, 0, Math.PI * 2); ctx.fill();
    }
    function drawDunes(dusk) {
      // 遠景の砂丘は3層。横へは向きに合わせ、奥ほどゆっくり流れる（パララックス）
      const layers = [
        { amp: 26, freq: 0.0032, speed: 0.08, base: HORIZON - 36, color: mixColor([226, 196, 150], [214, 136, 104], dusk) },
        { amp: 40, freq: 0.0046, speed: 0.17, base: HORIZON - 14, color: mixColor([232, 206, 158], [226, 150, 108], dusk) },
        { amp: 54, freq: 0.0068, speed: 0.3, base: HORIZON + 10, color: mixColor([240, 216, 168], [236, 168, 118], dusk) },
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
    function drawGround(dusk, painted = false) {
      const camZ = game.z - view.back;
      const camX = game.x * 0.6; // カメラは人物の横位置の6割だけ追う（端へ行くと画面も少し寄る）
      if (!painted) {
        ctx.fillStyle = mixColor([238, 210, 160], [238, 170, 112], dusk);
        ctx.fillRect(-GROUND_BLEED, HORIZON, W + GROUND_BLEED * 2, H - HORIZON + GROUND_BLEED);
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
      // コースの外の深い砂: 端からなだらかに濃くする（縁をくっきり描かない）
      for (let i = points.length - 1; i > 0; i--) {
        const far = points[i], near = points[i - 1];
        const fade = 1 - Math.min(1, far.dz / 220);
        for (const [from, to, alpha] of [[1.0, 1.12, 0.05], [1.12, 1.3, 0.09], [1.3, 3.2, 0.13]]) {
          ctx.fillStyle = `rgba(120,70,30,${alpha * fade})`;
          for (const side of [-1, 1]) {
            quad(near.p.x + side * near.p.w * from, near.p.y, far.p.x + side * far.p.w * from, far.p.y,
              far.p.x + side * far.p.w * to, far.p.y, near.p.x + side * near.p.w * to, near.p.y);
          }
        }
      }
      // 先に滑った人の板の跡（コースの目安）。少し揺れながら奥へ続く
      ctx.lineCap = "round";
      for (const track of [{ lane: -0.32, wob: 0.07, k: 0.021 }, { lane: 0.18, wob: 0.05, k: 0.017 }, { lane: 0.5, wob: 0.09, k: 0.013 }]) {
        for (let i = points.length - 1; i > 0; i--) {
          const far = points[i], near = points[i - 1];
          if (far.dz > 160 || near.dz < 2) continue;
          const lf = track.lane + Math.sin(far.z * track.k) * track.wob, ln = track.lane + Math.sin(near.z * track.k) * track.wob;
          ctx.strokeStyle = `rgba(150,96,46,${0.2 * (1 - far.dz / 160)})`;
          ctx.lineWidth = Math.max(0.6, Math.min(10, near.p.w * 0.012));
          ctx.beginPath(); ctx.moveTo(near.p.x + ln * near.p.w, near.p.y); ctx.lineTo(far.p.x + lf * far.p.w, far.p.y); ctx.stroke();
          ctx.strokeStyle = `rgba(255,240,205,${0.16 * (1 - far.dz / 160)})`;
          ctx.lineWidth = Math.max(0.5, Math.min(5, near.p.w * 0.006));
          ctx.beginPath(); ctx.moveTo(near.p.x + (ln + 0.025) * near.p.w, near.p.y); ctx.lineTo(far.p.x + (lf + 0.025) * far.p.w, far.p.y); ctx.stroke();
        }
      }
      // 地平線のかすみ（遠くの砂を空の色へ溶かす）
      const haze = ctx.createLinearGradient(0, HORIZON - 30, 0, HORIZON + 120);
      haze.addColorStop(0, `rgba(${mixColor([250, 232, 200], [255, 190, 140], dusk).slice(4, -1)},0)`);
      haze.addColorStop(0.25, `rgba(${mixColor([250, 232, 200], [255, 190, 140], dusk).slice(4, -1)},0.5)`);
      haze.addColorStop(1, `rgba(${mixColor([250, 232, 200], [255, 190, 140], dusk).slice(4, -1)},0)`);
      ctx.fillStyle = haze; ctx.fillRect(0, HORIZON - 30, W, 150);
      // 明暗の二重線で走路の縁を追えるようにする。線幅は遠近で変え、カーブの曲率を路面に残す。
      for (const side of [-1, 1]) {
        for (let i = points.length - 1; i > 0; i--) {
          const far = points[i], near = points[i - 1];
          if (far.dz > 250 || near.dz < 2) continue;
          const fade = Math.max(0, 1 - far.dz / 290);
          const x1 = near.p.x + side * near.p.w * 0.94, x2 = far.p.x + side * far.p.w * 0.94;
          ctx.lineCap = "round";
          ctx.strokeStyle = `rgba(103,62,31,${0.55 * fade})`;
          ctx.lineWidth = Math.max(1.3, Math.min(20, near.p.w * 0.035));
          ctx.beginPath(); ctx.moveTo(x1, near.p.y); ctx.lineTo(x2, far.p.y); ctx.stroke();
          ctx.strokeStyle = `rgba(255,237,183,${0.8 * fade})`;
          ctx.lineWidth = Math.max(1, Math.min(8, near.p.w * 0.014));
          ctx.beginPath(); ctx.moveTo(x1 - side * ctx.lineWidth * 0.6, near.p.y); ctx.lineTo(x2 - side * ctx.lineWidth * 0.6, far.p.y); ctx.stroke();
        }
      }
      // コースの端の目印（細い旗竿）: 24m ごと
      for (let i = points.length - 1; i > 0; i--) {
        const far = points[i], near = points[i - 1];
        if (Math.floor(far.z / 24) === Math.floor(near.z / 24)) continue;
        const t = Math.min(1, far.dz / DRAW_DIST), poleH = far.p.scale * 1.2 * (H / 2);
        for (const side of [-1, 1]) {
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
    /** 砂の模様を1行ずつ遠近をつけて貼る。手前は不透明、遠くは絵の砂へ溶かす。 */
    function drawSandRows(points, camZ, camX) {
      const levels = sandTexture();
      if (!levels.length) return;
      const rowH = 2, k = view.depth * CAM.height * (H / 2);
      let seg = 1;
      // 画面の下端より少し下から描く（カーブでカメラが傾いた時に、下の角へ砂が足りなくならないように）
      for (let y = H + GROUND_BLEED - rowH; y > HORIZON + 1; y -= rowH) {
        const dz = k / (y + rowH / 2 - HORIZON);
        if (dz > DRAW_DIST) break;
        const alpha = Math.min(1, Math.max(0, 1.15 - dz / 120));
        if (alpha <= 0.02) break;
        const z = camZ + dz;
        while (seg < points.length - 1 && points[seg].z < z) seg++;
        const a = points[seg - 1], b = points[seg];
        const roadX = a.x + (b.x - a.x) * Math.min(1, Math.max(0, (z - a.z) / Math.max(0.001, b.z - a.z)));
        const metersAcross = 2 * dz / view.depth * (1 + GROUND_BLEED * 2 / W); // 描く横幅（画面の外の余白を含む）に見える砂の幅（m）
        let level = levels[levels.length - 1];
        for (const l of levels) if (metersAcross * l.density <= Math.min(1500, l.maxWidth)) { level = l; break; }
        const leftM = -dz / view.depth * (1 + GROUND_BLEED * 2 / W) + (camX - roadX) * CAM.meterPerLane; // 描く左端（コースの中心から m）
        const u = ((leftM * level.density) % level.size + level.size) % level.size;
        const v = Math.floor(((z * level.density) % level.size + level.size) % level.size);
        const sw = Math.min(level.maxWidth, metersAcross * level.density);
        ctx.globalAlpha = alpha;
        ctx.drawImage(level.canvas, u, v, sw, 1, -GROUND_BLEED, y, W + GROUND_BLEED * 2, rowH);
      }
      ctx.globalAlpha = 1;
    }
    let ground = { camZ: 0, camX: 0 };
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
        if (f.kind === "rock" && game.smashedRocks.has(f)) continue; // 砕いた岩は消える
        drawables.push({ z: f.z, kind: f.kind, f });
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
        else if (d.kind === "rock") drawRock(d.f, dusk);
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
    /** ぼかした楕円の影（中心が濃く、縁は砂に溶ける）。 */
    function softShadow(x, y, rx, ry, alpha) {
      if (rx <= 0 || ry <= 0 || alpha <= 0) return;
      ctx.save();
      ctx.translate(x, y); ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(80,44,18,${alpha})`); g.addColorStop(0.6, `rgba(80,44,18,${alpha * 0.6})`); g.addColorStop(1, "rgba(80,44,18,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function drawRock(f, dusk) {
      const p = placeAt(f.z, f.x);
      if (!p) return;
      const size = f.size === "small" ? 0.55 : 0.95;
      const rw = p.scale * CAM.meterPerLane * (W / 2) * f.w * 1.15, rh = p.scale * size * 0.62 * (H / 2);
      // 影（太陽の向きへ少し伸びる、ぼかした影）
      softShadow(p.x + rw * 0.45, p.y + rh * 0.04, rw * 1.35, rh * 0.3, 0.4);
      const rockArt = art.get(f.size === "small" ? "rockSmall" : "rockLarge");
      if (rockArt) {
        // 絵の岩は当たり判定（f.w）より少しだけ広く描く（見た目より判定が大きくならないように）。下端の数%は砂に埋める
        const dw = rw * 2.15, dh = dw * rockArt.naturalHeight / rockArt.naturalWidth;
        ctx.drawImage(rockArt, p.x - dw / 2, p.y - dh * 0.93, dw, dh);
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
      const poleH = p.scale * 2.6 * (H / 2);
      const flagArt = art.get("flag"), goalArt = art.get("goal");
      if (flagArt && goalArt) {
        const fw = poleH * flagArt.naturalWidth / flagArt.naturalHeight;
        for (const side of [-1, 1]) ctx.drawImage(flagArt, p.x + side * p.w * 1.02 - DESERT_ART.flag.foot.x * fw, p.y - poleH, fw, poleH);
        const bw = p.w * 2.2, bh = bw * goalArt.naturalHeight / goalArt.naturalWidth;
        ctx.drawImage(goalArt, p.x - bw / 2, p.y - poleH * 0.9, bw, bh);
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
        // 頭の真上の筋は短く（走路の先を隠さない）、両脇ほど長く後ろへ流す
        const L = unit * (1.0 + 1.0 * hash(i)) * (0.78 + 0.26 * Math.sin(t * 27 + i * 2.3)) * (0.55 + 0.45 * s) * scale * (0.4 + 0.6 * Math.abs(Math.cos(a)));
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
      body.addColorStop(0, rgba(palette.mid, 0.5 * s)); body.addColorStop(0.7, rgba(palette.rim, 0.28 * s)); body.addColorStop(1, rgba(palette.rim, 0));
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(cx, midY + unit * 0.1, unit * 0.7, unit * 1.28, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 22; i++) streak(i, 1, 0.38, [palette.rim, palette.rim, palette.rim], 2.4);   // 太く薄い外側
      for (let i = 0; i < 22; i++) streak(i, 0.96, 0.8, [palette.mid, palette.rim, palette.rim], 1);   // 炎の色
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
      const dx = x - W / 2, dy = y - HORIZON + 60, l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    }
    // 炎色の残像に使う、人物の絵を一色に塗った小さな複製（絵と色ごとに一度だけ作る）
    const tintCache = new WeakMap();
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
      for (let k = 3; k >= 1; k--) {
        const color = k === 1 ? palette.mid : palette.rim;
        draw(tintedArt(image, color), strength * (0.5 - 0.12 * k), bx * unit * 0.34 * k, by * unit * 0.34 * k, 1 + 0.08 * k);
      }
    }
    function drawPlayer(dusk) {
      drawPlayerBody(dusk);
      drawCharge();
    }
    /**
     * 跳んだ人物を地面から持ち上げて描く量（画素）。ふつうは高さ×0.9m 分。ブーストの大ジャンプの頂上では
     * 頭が上の進み具合の線・相手との差の札（上 100px）より上へ出ないよう抑える（2026-11-11。それまでは頭が画面の上で切れていた）。
     */
    function riderLift(height, unit, groundY) {
      const lift = height * unit * 0.9;
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
      const unit = p.scale * (H / 2), cx = p.x, baseY = p.y - riderLift(jumpHeight(game), unit, p.y);
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
        ctx.shadowColor = "rgba(70,180,255,0.95)"; ctx.shadowBlur = Math.max(4, unit * 0.12);
        for (const [width, color] of [[Math.max(2.5, unit * 0.045), "rgba(50,150,255,0.9)"], [Math.max(1, unit * 0.016), "#f2fdff"]]) {
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
      const height = jumpHeight(game);
      const bob = game.air <= 0 && game.fallT <= 0 ? Math.sin(game.t * 14) * 2 * (game.speed / SPEED.max) : 0;
      const unit = p.scale * (H / 2); // 1m の高さに相当する画素
      const groundY = p.y, cx = p.x;
      // 影（空中では小さく薄く）
      softShadow(cx, groundY, unit * 0.62 * (1 - height * 0.2), unit * 0.16, 0.42 - height * 0.12);
      const baseY = groundY - riderLift(height, unit, groundY) + bob;
      // カーブへ切り込んでいる間（カービング）は、横へ動いていなくても体が内側へ倒れる
      const carveDir = game.carving ? Math.sign(curveAt(game.course, game.z)) : 0;
      const lean = Math.max(-0.5, Math.min(0.5, game.vx * 0.35 + carveDir * 0.22));
      const boostFeel = Math.max(view.boost || 0, game.boostT > 0 ? 0.55 : 0);
      drawBoostAura(cx, baseY, unit, { strength: boostFeel, time: game.t });
      // 姿勢の絵（第4弾の差分）があれば、それを板の重心で立たせる。傾きは絵がもう描いているので少しだけ
      pose = riderPose(carveDir ? { ...game, vx: game.vx + carveDir * 0.4 } : game, pose);
      const poseArt = art.get(pose), baseArt = art.get("rider");
      // 空中トリック: 縦の軸で回る（絵を横に縮めて裏返す）。回っている間は周りに風の弧
      const spinning = game.spinDir !== 0 || Math.abs(game.rot) > 0.001;
      let spinX = spinning ? Math.cos(game.rot * Math.PI * 2) : 1;
      if (Math.abs(spinX) < 0.14) spinX = spinX < 0 ? -0.14 : 0.14;
      if (spinning && !reducedMotion) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineCap = "round";
        for (let i = 0; i < 3; i++) {
          const a0 = game.rot * Math.PI * 4 * game.spinDir + i * 2.1;
          ctx.lineWidth = Math.max(2, unit * (0.08 - i * 0.02));
          ctx.beginPath(); ctx.ellipse(cx, baseY - unit * (0.9 + i * 0.35), unit * (0.85 - i * 0.1), unit * 0.22, 0, a0, a0 + 1.5); ctx.stroke();
        }
        ctx.restore();
      }
      if (poseArt && baseArt) {
        const def = DESERT_ART[pose];
        // 大きさは背面Bの高さ（unit×2.45）に対する比。どの姿勢も同じ縮尺で描かれている
        const dh = unit * 2.45 * poseArt.naturalHeight / baseArt.naturalHeight, dw = dh * poseArt.naturalWidth / poseArt.naturalHeight;
        const sprite = (alpha, dy, grow, image = poseArt, dx = 0) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx + dx, baseY + dy);
          if (game.fallT > 0) ctx.rotate((game.x > 0 ? 1 : -1) * 0.25 * (game.fallT / 1.1));
          else {
            ctx.rotate(lean * (pose === "rider" ? 0.45 : 0.12));
            if (game.air > 0) ctx.translate(0, -Math.sin(airT * Math.PI) * unit * 0.1);
          }
          ctx.scale(spinX * grow, grow);
          ctx.drawImage(image, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh);
          ctx.restore();
        };
        // 炎色の残像（手前・外側へずれて大きく薄く）。動き軽減では出さない
        boostAfterimages(poseArt, cx, baseY, unit, boostFeel, AURAS.player, (image, alpha, dx, dy, grow) => sprite(alpha, dy, grow, image, dx));
        sprite(1, 0, 1);
        return;
      }
      ctx.save();
      ctx.translate(cx, baseY);
      ctx.scale(spinX, 1);
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
        if (!s.chip) continue;
        ctx.save(); ctx.translate(p.x + s.x, p.y + s.y); ctx.rotate(s.age * s.spin);
        ctx.globalAlpha = Math.min(1, 1.4 * (1 - s.age / s.life));
        ctx.fillStyle = "#6b4a36"; ctx.fillRect(-s.r, -s.r * 0.7, s.r * 2, s.r * 1.4);
        ctx.fillStyle = "#a07a58"; ctx.fillRect(-s.r, -s.r * 0.7, s.r, s.r * 0.6);
        ctx.restore();
      }
      const puff = art.get("puff");
      if (puff) {
        const aspect = puff.naturalHeight / puff.naturalWidth;
        for (const s of particles) {
          if (s.chip) continue;
          const w = s.r * 2.8, h = w * aspect;
          ctx.globalAlpha = Math.min(1, 0.75 * (1 - s.age / s.life));
          ctx.drawImage(puff, p.x + s.x - w / 2, p.y + s.y - h / 2, w, h);
        }
        ctx.globalAlpha = 1;
        return;
      }
      for (const s of particles) {
        if (s.chip) continue;
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
      if (k < 0.3 && feel < 0.05) return;
      const amount = Math.min(1.15, (k < 0.3 ? 0 : (k - 0.3) / 0.7) + 0.85 * feel);
      const n = Math.min(streaks.length, Math.round(14 + 48 * amount)), cx = W / 2, cy = HORIZON + 40, reach = Math.hypot(W, H) * 0.66;
      ctx.save();
      // 横幅の中央56%には速度線を描かず、先の岩と着地点を見せる。
      ctx.beginPath(); ctx.rect(0, 0, W * 0.22, H); ctx.rect(W * 0.78, 0, W * 0.22, H); ctx.clip();
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const s = streaks[i];
        const travel = (s.phase + game.t * (0.9 + 1.6 * k + 1.8 * feel)) % 1;
        const r0 = (feel > 0.3 ? 160 : 240) + travel * reach, r1 = r0 + (60 + 220 * amount + 80 * feel) * s.len * (0.4 + travel);
        const alpha = (0.3 + 0.1 * feel) * amount * Math.sin(travel * Math.PI);
        ctx.strokeStyle = `rgba(240,250,255,${alpha})`;
        ctx.lineWidth = s.w * (0.6 + travel * 1.6 + feel);
        const ca = Math.cos(s.angle), sa = Math.sin(s.angle) * 0.62;
        ctx.beginPath(); ctx.moveTo(cx + ca * r0, cy + sa * r0); ctx.lineTo(cx + ca * r1, cy + sa * r1); ctx.stroke();
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
    /** 速いほど画面の縁を少し暗く。ブーストでも炎色にしない。 */
    function drawVignette(fast) {
      const feel = view.boost || 0;
      const a = (reducedMotion ? 0.12 : 0.34) * fast + 0.06 * feel;
      if (a < 0.02) return;
      const g = ctx.createRadialGradient(W / 2, H * 0.55, H * (0.42 - 0.08 * feel), W / 2, H * 0.55, H * 1.05);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(40,30,25,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    /** 着地の衝撃の輪（砂の上に広がる楕円）。 */
    function drawRings() {
      const p = placeAt(game.z, game.x);
      if (!p || !rings.length) return;
      const unit = p.scale * (H / 2);
      for (const r of rings) {
        const k = r.age / r.life;
        ctx.strokeStyle = `rgba(255,248,230,${0.8 * (1 - k)})`;
        ctx.lineWidth = Math.max(2, unit * 0.12 * (1 - k)) * r.power;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, unit * (0.5 + 2.4 * k) * r.power, unit * (0.12 + 0.5 * k) * r.power, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    /** 得点の浮き出し。人物の頭の上から少しずつ上がって消える。 */
    function drawFloaters() {
      const p = placeAt(game.z, game.x);
      if (!p || !floaters.length) return;
      const unit = p.scale * (H / 2);
      ctx.save();
      ctx.textBaseline = "middle"; ctx.lineJoin = "round";
      const colors = { trick: "#ffe27a", perfect: "#fff1a8", good: "#c6f0ff", near: "#ffd4a8", smash: "#ffb07a", gauge: "#ffcf5a", race: "#ffe27a", jump: "#ffffff", recover: "#9dffb0", carve: "#ffe9b8", behind: "#d6dcf0" };
      // 人物の右上に、新しいものほど下へ積む（真ん中の大きな文字と HUD に重ねない）
      const left = p.x > W * 0.62;
      ctx.textAlign = left ? "right" : "left";
      floaters.forEach((f, i) => {
        const k = f.age / f.life, size = f.kind === "trick" || f.kind === "race" ? 32 : 24;
        ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
        ctx.font = `900 ${size}px ${fontFamily()}`;
        const row = floaters.length - 1 - i;
        const x = p.x + (left ? -1 : 1) * unit * 0.9, y = Math.max(190, p.y - unit * 1.2 - row * 34 - k * 40);
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(70,34,20,0.75)"; ctx.strokeText(f.text, x, y);
        ctx.fillStyle = colors[f.kind] || "#fff"; ctx.fillText(f.text, x, y);
      });
      ctx.restore();
    }
    /** 本番の競走相手。ヌールは専用画像、なると画像未読込時は図形を使う。 */
    function drawRival(noor, dusk) {
      const look = RIVAL_LOOKS[raceWith] || RIVAL_LOOKS.noor, name = RIVAL_NAMES[raceWith];
      const p = placeAt(noor.z, noor.x);
      if (!p) return;
      const unit = p.scale * (H / 2);
      const height = jumpHeight(noor);
      const player = placeAt(game.z, game.x);
      const playerUnit = player?.scale * (H / 2);
      const playerHeight = jumpHeight(game);
      const rivalBaseY = p.y - height * unit * 0.9;
      const playerBaseY = player?.y - playerHeight * playerUnit * 0.9;
      const overlapsPlayer = player && Math.abs(p.x - player.x) < (unit + playerUnit) * 0.7
        && rivalBaseY > playerBaseY - playerUnit * 2.45 && playerBaseY > rivalBaseY - unit * 2.45;
      ctx.save();
      if (overlapsPlayer) ctx.globalAlpha = 0.5;
      softShadow(p.x, p.y, unit * 0.56, unit * 0.15, 0.36 - height * 0.1);
      const lean = Math.max(-0.5, Math.min(0.5, noor.vx * 0.35));
      const bob = noor.air <= 0 && noor.fallT <= 0 ? Math.sin(noor.t * 13 + 1) * unit * 0.02 : 0;
      // 相手のブーストにもオーラ（なるは銀紫、ヌールは金）。追い抜かれる時に「加速している」と分かる
      const noorPose = `${raceWith}${riderPose(noor).replace(/^rider/, "Rider")}`;
      const noorArt = DESERT_ART[noorPose] ? art.get(noorPose) : null;
      const artScale = noorArt ? RIVAL_ART_SCALE[raceWith] ?? 1 : 0.86, palette = AURAS[raceWith] || AURAS.noor;
      const rivalBoost = noor.boostT > 0 ? Math.min(1, noor.boostT / 0.3) * 0.85 : 0, rivalY = p.y - height * unit * 0.9 + bob;
      if (rivalBoost > 0) drawBoostAura(p.x, rivalY, unit * artScale, { palette, strength: rivalBoost, time: noor.t, seed: 2.1 });
      ctx.save();
      ctx.translate(p.x, rivalY);
      // 空中の回転（なるの 360）は、主人公と同じく絵を横に縮めて裏返す
      let spinX = Math.abs(noor.rot || 0) > 0.001 ? Math.cos(noor.rot * Math.PI * 2) : 1;
      if (Math.abs(spinX) < 0.14) spinX = spinX < 0 ? -0.14 : 0.14;
      // 滑る姿の絵は `<相手>Rider…`（DESERT_ART）にあれば使う。読み込み前・失敗した時は下の図形で描く。
      // 絵は主人公の背面と同じ縮尺（rider の高さ768に対する比）で、身長の差は RIVAL_ART_SCALE で付ける
      if (noorArt) {
        const def = DESERT_ART[noorPose];
        const dh = unit * 2.45 * artScale * noorArt.naturalHeight / DESERT_ART.rider.size[1];
        const dw = dh * noorArt.naturalWidth / noorArt.naturalHeight;
        if (noor.fallT > 0) ctx.rotate((noor.x > 0 ? 1 : -1) * 0.25 * (noor.fallT / 1.1));
        else ctx.rotate(lean * (noorPose.endsWith("Rider") ? 0.45 : 0.12));
        ctx.scale(spinX, 1);
        boostAfterimages(noorArt, p.x, rivalY, unit * artScale, rivalBoost, palette, (image, alpha, dx, dy, grow) => {
          ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(dx, dy); ctx.scale(grow, grow);
          ctx.drawImage(image, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh); ctx.restore();
        });
        ctx.drawImage(noorArt, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh);
        ctx.restore();
        ctx.restore();
        if (p.dz < 70) drawRivalName(name, look, p, height, unit);
        return;
      }
      if (noor.fallT > 0) ctx.rotate((noor.x > 0 ? 1 : -1) * 1.1 * (noor.fallT / 1.1));
      else ctx.rotate(lean * 0.8);
      ctx.scale(0.86 * spinX, 0.86); // 主人公の背面の絵と同じくらいの背丈に。回転中は横に縮めて裏返す
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
      pause(value) { paused = !!value; if (!paused) { last = performance.now(); } },
      redraw() { if (game) { updateHud(); simulateParticles(0); draw(1 / 60); } },
      rawBoost() { return boost(game); },
      soundLevels() { return rideSe.loopLevels(); },
    };
    showMenu();
    if (tutorial) startRun("practice");
  });
  active.set(host, promise);
  promise.finally(() => active.delete(host));
  return promise;
}


