// DESERT RIDE（第4章ドバイ・サンドボード）の画面。後方視点の疑似3Dを Canvas に描き、入力・HUD・練習・リザルトを持つ。
// 規則と採点は desert-ride-model.js。本編との接続（行動枠・報酬・保存）は chapters/ch4-desert.js で、ここは保存を読まない。
// 絵（遠景・主人公の背面・岩・旗・ゴール・砂煙）は Codex 生成の採用画像（desert-ride-art.js）。読み込み前・失敗時は Canvas の図形で描く。
// 起伏・路面・太陽・夕方の色は Canvas で描く。左右・ジャンプ・着地・転倒の姿勢は第4弾の差分の絵（riderPose）。
// 2026-11-02 オーナー「もっとスピード感やエフェクトを派手に」: 速さで広がる視界（人物の大きさは保つ）・傾くカメラ・強いスピード線・砂しぶき・
// 着地の輪・得点の浮き出し・トリックのスロー・ブーストの残像。動き軽減ではカメラの動き・揺れ・スロー・閃光・速度線を止める。
// 本番はスタートの合図のあと、ヌール（rivalRun）が横で滑る。
import { el } from "../core/util.js";
import { SE, unlockAudio, createDesertRideSe, currentBgm, playBgm } from "../core/audio.js";
import { EDGE, SPEED, COURSE_PACKS, generateCourse, practiceCourse, pickCourse, buildCourse, createGame, step, press, boost, chargeBoost, canRecover, summary, curveAt, headingAt, lateralAt, upcomingCurve, botControl,
  rivalRun, rivalAt, RULES_VERSION, jumpHeight } from "./desert-ride-model.js";
import { DESERT_ART, loadDesertArt, riderPose } from "./desert-ride-art.js";

// ブーストは周辺の速度線・視野・短い残像で表し、走路を覆う炎の画像は読み込まない。
const BOT_STEP = 1 / 60; // 自動操縦の判断と物理の刻み（モデルの検査と同じ）

const W = 1280, H = 720;
const HORIZON = 262;             // 地平線の高さ
const CAM = { depth: 1.5, height: 2.0, back: 4.5, meterPerLane: 1.6 }; // 疑似3Dのカメラ（人物の4.5m後ろ・高さ2m。lane 1 = 1.6m）
const COUNTDOWN = 2.4;           // 本番のスタートの合図（3・2・1・GO）の秒数
const SPEED_FULL = SPEED.boost;  // 演出の「最速」（ブースト）
const RIVAL_NAMES = Object.freeze({ noor: "ヌール", naru: "なる" });
// 画像が読み込めない場合の競走相手の図形色。ヌール: 青緑の板・オリーブのシャツ・ベージュのスカーフ・束ねた黒髪・頭のサングラス。
// なる: クリーム色の板・白い袖の黒いボンバー・黒いカーゴ・白いスニーカー・銀灰色の短い髪
const RIVAL_LOOKS = Object.freeze({
  noor: { board: [[34, 168, 156], [44, 140, 132]], pants: [[168, 146, 108], [160, 124, 98]], shoes: "#3a2c22", shirt: [[110, 118, 62], [116, 100, 66]],
    sleeve: null, skin: [[176, 122, 84], [176, 110, 80]], hair: "#1b161d", ponytail: true, scarf: true, glasses: true, tag: "rgba(60,70,30,0.82)" },
  naru: { board: [[242, 220, 166], [236, 196, 140]], pants: [[34, 32, 36], [40, 32, 34]], shoes: "#f2f0ea", shirt: [[26, 26, 30], [34, 28, 30]],
    sleeve: [[236, 234, 228], [236, 214, 196]], skin: [[236, 200, 170], [232, 182, 150]], hair: "#b9b6b4", ponytail: false, scarf: false, glasses: false, tag: "rgba(40,36,40,0.85)" },
});
const SEG = 6;                   // 描く路面の1区間（m）
const DRAW_DIST = 380;           // 前方に描く距離（m）
const active = new WeakMap();
const RIDE_BGM = Object.freeze({ practice: "bgm_ethnic12", noor: "bgm_ethnic08", naru: "bgm_ethnic05" });

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
  brace: "着地の直前にもう一度 Space ── 姿勢を整える",
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
  brace: "着地の直前にもう一度「ジャンプ」── 姿勢を整える",
  trick: "次は、跳んだら空中で「左へ」か「右へ」を押し続けて回ろう",
  boost: "溜まったゲージで「BOOST」を押すと超加速 ── 岩も砕ける",
};
const touchUi = () => typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;
const tutorialText = key => (touchUi() && TUTORIAL_TOUCH[key]) || TUTORIAL[key];
// 遊び方（メニューの「？」で開いた時だけ見せる。常時は出さない）
const HOWTO = {
  keys: [
    "← → で左右。砂の上なので、少し遅れてついてくる",
    "起伏の手前で Space で大ジャンプ。着地でブースト回復、直前にもう一度押すと加速",
    "空中で ← → を押し続けると回転。回りかけで着地すると転ぶ",
    "ゲージが満タンで ↓（BOOST）。超加速して、岩も砕く",
    "岩に当たった直後にブーストを押すと、ゲージを使って立て直せる",
  ],
  touch: [
    "「左へ」「右へ」で左右。砂の上なので、少し遅れてついてくる",
    "起伏の手前で「ジャンプ」で大ジャンプ。着地でブースト回復、直前にもう一度押すと加速",
    "空中で「左へ」「右へ」を押し続けると回転。回りかけで着地すると転ぶ",
    "ゲージが溜まったら「BOOST」。超加速して、岩も砕く",
    "岩に当たった直後に「BOOST」を押すと、ゲージを使って立て直せる",
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
  const art = loadDesertArt();
  const promise = new Promise(resolve => {
    const rideSe = createDesertRideSe();
    const results = [];
    let practiced = false, done = false, frame = 0, runId = 0, currentBest = best?.rulesVersion === RULES_VERSION ? best : null;
    const oldBest = legacyBest || (best && best.rulesVersion !== RULES_VERSION ? best : null);
    const root = el("section.desert-ride", { dataset: { test: "desert-ride", phase: "menu", reducedMotion: String(!!reducedMotion) }, tabindex: "-1", "aria-label": "DESERT RIDE" });
    const canvas = el("canvas.dr-canvas", { width: W, height: H, "aria-hidden": "true" });
    const ctx = canvas.getContext("2d");
    const hud = el("div.dr-hud", { "aria-hidden": "true" });
    const caption = el("p.dr-caption", { role: "status", dataset: { test: "desert-caption" } });
    const pop = el("div.dr-pop", { "aria-hidden": "true" });
    // 判定は左上のスコア欄に固定し、走路と人物を覆わない。開始合図だけ中央。
    const cutin = el("div.dr-cutin", { "aria-hidden": "true", dataset: { test: "desert-cutin" } });
    const startPop = el("div.dr-start-pop", { "aria-hidden": "true" });
    const feedback = el("div.dr-feedback", { dataset: { test: "desert-feedback" } }, [cutin, pop]);
    const panel = el("div.dr-panel");
    const controls = el("div.dr-controls", { hidden: true });
    const quit = el("button.dr-quit", { type: "button", text: "✕", title: "やめる", "aria-label": "やめる", dataset: { test: "desert-quit" }, hidden: true });
    root.append(canvas, hud, startPop, caption, controls, quit, panel);
    host.append(root);
    root.focus({ preventScroll: true });

    const input = { left: false, right: false };
    let pose = "rider";
    let paused = false;
    let game = null, mode = null, bot = null, botMemo = {}, botLag = 0, last = 0, world = null, particles = [], shakeT = 0, flashT = 0, popT = 0, popText = "", popKind = "";
    let rival = null, raceWith = "noor", countdown = 0, countShown = "", slowT = 0, rings = [], floaters = [], halfShown = 0;
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
    const holdButton = (label, cls, test, on, off) => {
      const button = el(`button.dr-touch.${cls}`, { type: "button", dataset: { test }, "aria-label": label }, [el("span", { text: label })]);
      const pointers = new Set();
      const down = event => { event.preventDefault(); unlockAudio(); pointers.add(event.pointerId); button.setPointerCapture?.(event.pointerId); button.classList.add("on"); on(); };
      const up = event => { pointers.delete(event.pointerId); if (!pointers.size) { button.classList.remove("on"); off(); } };
      button.addEventListener("pointerdown", down);
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, up);
      button.addEventListener("contextmenu", event => event.preventDefault());
      return button;
    };
    controls.append(
      el("div.dr-touch-pair", [
        holdButton("左へ", "dr-left", "desert-left", () => { input.left = true; }, () => { input.left = false; }),
        holdButton("右へ", "dr-right", "desert-right", () => { input.right = true; }, () => { input.right = false; }),
      ]),
      el("div.dr-touch-pair", [
        holdButton("BOOST", "dr-boost", "desert-boost", doBoost, () => {}),
        holdButton("ジャンプ／着地", "dr-jump", "desert-jump", act, () => {}),
      ]),
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
      mode = null; game = null; tut = null; bot = null;
      controls.hidden = true; quit.hidden = true; caption.textContent = ""; hud.replaceChildren();
      startPop.classList.remove("show");
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
        rideSe.play("boost", 0.7); showPop("リカバリー", "recover"); burst(28, 1.8); floater("リカバリー", "recover");
        rings.push({ age: 0, life: 0.7, power: 1.35, burst: true });
        if (!reducedMotion) { shakeT = Math.max(shakeT, 0.28); flashT = Math.max(flashT, 0.12); view.kick = Math.max(view.kick, 1.2); }
      } else if (kind === "boost") {
        rideSe.play("boost", 0.6); showPop("BOOST!!", "boost"); burst(10, 0.8);
        rings.push({ age: 0, life: 0.62, power: 1.2, burst: true });
        if (!reducedMotion) { shakeT = 0.1; view.kick = 0.7; }
      }
    }
    function startRun(kind, who = raceWith) {
      const thisRun = ++runId;
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
      world = { sky: 0, yaw: 0, sunPulse: 0 };
      particles = []; rings = []; floaters = []; clearTimeout(cutinTimer); cutin.classList.remove("show"); cutin.replaceChildren(); shakeT = 0; flashT = 0; popT = 0; slowT = 0; halfShown = 0; bot = null; botMemo = {}; botLag = 0;
      Object.assign(view, { depth: CAM.depth, back: CAM.back, roll: 0, kick: 0, boost: 0 });
      shownKmh = SPEED.start * 3.6;
      countdown = kind === "practice" ? 0 : COUNTDOWN; countShown = "";
      root.dataset.countdown = countdown > 0 ? "on" : "";
      root.dataset.rival = rival ? raceWith : "";
      tut = kind === "practice" ? { step: "move", moved: false, bumpTries: 0, said: new Set() } : null;
      pop.classList.remove("show"); startPop.classList.remove("show");
      controls.hidden = false; quit.hidden = false;
      setPhase(kind);
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
    function stopRun() { ++runId; cancelAnimationFrame(frame); mode = null; rideSe.stop(); }
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

    // ---- HUD ---------------------------------------------------------------------------
    let hudNodes = null, shownKmh = SPEED.start * 3.6;
    const SPEEDO_ARC = Math.PI * 46; // SVG の半円（r=46）と同じ長さ
    const SPEEDO_MAX = SPEED.boost * 3.6; // 表示の上限（ブースト最高速＝約166 km/h）
    function makeSpeedoArc() {
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", "dr-speedo-arc");
      svg.setAttribute("viewBox", "0 0 120 72");
      svg.setAttribute("aria-hidden", "true");
      const track = document.createElementNS(ns, "path");
      track.setAttribute("class", "dr-speedo-track");
      track.setAttribute("d", "M14 62 A 46 46 0 0 1 106 62");
      track.setAttribute("fill", "none");
      const fill = document.createElementNS(ns, "path");
      fill.setAttribute("class", "dr-speedo-fill");
      fill.setAttribute("d", "M14 62 A 46 46 0 0 1 106 62");
      fill.setAttribute("fill", "none");
      fill.setAttribute("stroke-dasharray", String(SPEEDO_ARC));
      fill.setAttribute("stroke-dashoffset", String(SPEEDO_ARC));
      svg.append(track, fill);
      return { svg, fill };
    }
    function buildHud() {
      const arc = makeSpeedoArc();
      hudNodes = {
        score: el("strong.dr-score", { text: "0" }), combo: el("span.dr-combo", { text: "" }),
        time: el("span.dr-time", { text: "0.0" }), kmh: el("strong.dr-kmh", { text: "0", dataset: { test: "desert-kmh" } }), gauge: el("i"), gaugeBox: null, progress: el("i"),
        you: el("b.dr-mark.dr-mark-you", { title: "あなた" }), noor: el(`b.dr-mark.dr-mark-${raceWith}`, { title: RIVAL_NAMES[raceWith] }), race: el("span.dr-race", { dataset: { test: "desert-race-gap" } }),
        course: el("span.dr-course", { dataset: { test: "desert-course" } }), hint: el("span.dr-curve-hint", { dataset: { test: "desert-curve-hint" } }),
        speedo: el("div.dr-speedo", { dataset: { test: "desert-speedo" } }), speedFill: arc.fill,
      };
      // BOOST は ⚡ とゲージだけ（% の文字は出さない。#2838）
      hudNodes.gaugeBox = el("div.dr-gauge", { dataset: { test: "desert-gauge" }, title: "BOOST" }, [hudNodes.gauge]);
      hudNodes.speedo.append(arc.svg, el("div.dr-speedo-read", [hudNodes.kmh, el("small", { text: "km/h" })]));
      hud.replaceChildren(
        el("div.dr-hud-left", [el("small", { text: mode === "practice" ? "PRACTICE" : "SCORE" }), hudNodes.score, hudNodes.combo, feedback]),
        el("div.dr-hud-center", [
          el("div.dr-progress", [hudNodes.progress, el("b.dr-progress-sun"), rival ? hudNodes.noor : null, hudNodes.you]),
          rival ? hudNodes.race : null,
          hudNodes.course,
          hudNodes.hint,
        ]),
        el("div.dr-hud-right", [
          hudNodes.speedo,
          el("div.dr-boost-meter", [el("b.dr-bolt", { "aria-hidden": "true" }), hudNodes.gaugeBox]),
          el("div.dr-clock", [el("small", { text: "TIME" }), hudNodes.time]),
        ]),
      );
    }
    function updateHud() {
      if (!hudNodes || !game) return;
      hudNodes.score.textContent = mode === "practice" ? "練習" : Math.max(0, Math.round(game.score)).toLocaleString("ja-JP");
      hudNodes.combo.textContent = game.combo >= 2 ? `${game.combo} COMBO ×${(Math.min(3, 1 + 0.15 * game.combo)).toFixed(2).replace(/0$/, "")}` : "";
      hudNodes.combo.dataset.hot = game.combo >= 10 ? "2" : game.combo >= 5 ? "1" : "";
      hudNodes.time.textContent = game.t.toFixed(1);
      const targetKmh = game.speed * 3.6;
      shownKmh += (targetKmh - shownKmh) * (countdown > 0 ? 1 : 0.22);
      hudNodes.kmh.textContent = String(Math.round(shownKmh));
      const boosting = game.boostT > 0;
      hudNodes.kmh.dataset.fast = boosting ? "boost" : shownKmh > SPEED.max * 3.6 * 0.85 ? "fast" : "";
      hudNodes.speedo.dataset.fast = hudNodes.kmh.dataset.fast;
      if (hudNodes.speedFill) {
        const t = Math.max(0, Math.min(1, shownKmh / SPEEDO_MAX));
        hudNodes.speedFill.setAttribute("stroke-dashoffset", String(SPEEDO_ARC * (1 - t)));
      }
      const ready = game.gauge > 0;
      hudNodes.gauge.style.width = `${Math.round(100 * (boosting ? game.boostT / 3 : game.gauge))}%`;
      hudNodes.gaugeBox.dataset.state = boosting ? "boost" : ready ? "full" : "";
      root.dataset.gauge = boosting ? "boost" : ready ? "full" : "";
      root.dataset.boost = boosting ? "on" : "";
      root.dataset.recover = canRecover(game) ? "ready" : "";
      if (hudNodes.course) {
        hudNodes.course.textContent = mode === "practice" ? "" : (game.course.name || "");
        hudNodes.course.hidden = mode === "practice" || !game.course.name;
      }
      if (hudNodes.hint) {
        const hint = upcomingCurve(game.course, game.z);
        hudNodes.hint.textContent = hint < 0 ? "↩ カーブ" : hint > 0 ? "カーブ ↪" : "";
        hudNodes.hint.hidden = !hint;
      }
      const progress = z => `${(100 * Math.min(1, z / game.course.length)).toFixed(1)}%`;
      hudNodes.progress.style.width = progress(game.z);
      hudNodes.you.style.left = progress(game.z);
      if (rival) {
        const noor = rivalAt(rival, game.t);
        hudNodes.noor.style.left = progress(noor.z);
        const gap = Math.round(game.z - Math.min(noor.z, game.course.length));
        const name = RIVAL_NAMES[raceWith];
        hudNodes.race.textContent = countdown > 0 ? `VS ${name}` : Math.abs(gap) < 3 ? `${name}と並走` : gap > 0 ? `${name}に ${gap}m 差` : `${name}まで ${-gap}m`;
        hudNodes.race.dataset.lead = countdown > 0 || Math.abs(gap) < 3 ? "" : gap > 0 ? "you" : "noor";
      }
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
          if (shown === "GO!") { showPop("GO!", "go"); root.dataset.countdown = ""; if (!reducedMotion) view.kick = 1; }
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
        for (let i = 0; i < steps && !game.finished; i++) step(game, input, dt / steps);
      }
      const events = game.events.slice(before);
      react(events);
      rideSe.motion({ speed: (game.speed / SPEED.max) * (game.boostT > 0 ? 1.35 : 1), carve: Math.abs(game.vx), grounded: game.air <= 0 && game.fallT <= 0 });
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
        else if (event.kind === "gaugeFull") { rideSe.play("gaugeFull", 0.55); floater(touchUi() ? "BOOST OK" : "BOOST OK ↓", "gauge"); }
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
        const carve = Math.abs(game.vx);
        if (carve > 0.25) {
          const side = game.vx > 0 ? -1 : 1, spray = (reducedMotion ? 8 : 34) * Math.min(1.6, carve) * k;
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
      // カメラの向き: コースの向きに少し遅れてついていく（遠くの砂丘が横へ流れる）
      const curve = curveAt(game.course, game.z);
      const head = headingAt(game.course, game.z);
      world.yaw += (head - world.yaw) * Math.min(1, dt * 3.2);
      // 速いほど視界が広がる（遠くが小さく流れる）。カメラの距離も同じ割合で縮め、人物の大きさは変えない。
      // GO とブーストの瞬間は一度ぐっと広がる。ブースト中はさらに少し引く。動き軽減では固定
      const fast = Math.min(1, Math.max(0, (game.speed - SPEED.min) / (SPEED_FULL - SPEED.min)));
      const feel = view.boost || 0;
      const targetDepth = reducedMotion ? CAM.depth : CAM.depth * (1 - 0.24 * fast - 0.12 * Math.min(1, view.kick) - 0.16 * feel);
      view.depth += (targetDepth - view.depth) * Math.min(1, dt * 4);
      view.back = CAM.back * view.depth / CAM.depth;
      const targetRoll = reducedMotion || countdown > 0 ? 0 : Math.max(-0.07, Math.min(0.07, -game.vx * 0.04 - curve * 0.045 - head * 0.02));
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
    const BACKDROP_SCALE = 0.95;
    function drawBackdrop(dusk, progress) {
      const sky = art.get("sky"), land = art.get("land");
      if (!sky || !land) return false;
      const B = DESERT_ART.backdrop, k = BACKDROP_SCALE, dw = B.width * k, baseX = (W - dw) / 2;
      // 空はゆっくり、陸は速く横へ流れる（カーブに合わせたパララックス）。絵の地平線の行を HORIZON に合わせる
      const yawPx = world.yaw * 160 * (1 + 0.55 * (view.boost || 0));
      ctx.drawImage(sky, baseX - yawPx * 0.55, HORIZON - B.horizon * k, dw, sky.naturalHeight * k);
      const duskSky = art.get("duskSky"), duskLand = art.get("duskLand");
      if (dusk > 0 && duskSky && duskLand) {
        // 同じ構図の夕方の絵を、ゴールへ近づくほど濃く重ねる
        ctx.globalAlpha = dusk;
        ctx.drawImage(duskSky, baseX - yawPx * 0.55, HORIZON - B.horizon * k, dw, duskSky.naturalHeight * k);
        ctx.globalAlpha = 1;
      } else if (dusk > 0) {
        const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 10);
        g.addColorStop(0, `rgba(120,72,110,${dusk * 0.85})`); g.addColorStop(0.62, `rgba(245,150,84,${dusk * 0.8})`); g.addColorStop(1, `rgba(255,208,140,${dusk * 0.7})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 10);
      }
      // 太陽: 進むほど大きく低く。ゴールの手前では砂丘の稜線の後ろへ沈みかける
      const sunX = W * 0.5 - world.yaw * 180 * (1 + 0.4 * (view.boost || 0)) + 180 * (1 - progress), sunY = lerp(70, HORIZON - 34, Math.min(1, progress * 1.05)), r = lerp(30, 72, progress);
      const glow = ctx.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 3.2);
      glow.addColorStop(0, `rgba(255,230,170,${0.55 + 0.3 * dusk})`); glow.addColorStop(1, "rgba(255,200,120,0)");
      ctx.fillStyle = glow; ctx.fillRect(sunX - r * 3.2, sunY - r * 3.2, r * 6.4, r * 6.4);
      ctx.fillStyle = mixColor([255, 248, 220], [255, 170, 90], dusk);
      ctx.beginPath(); ctx.arc(sunX, sunY, r, 0, Math.PI * 2); ctx.fill();
      // 陸: 稜線〜地平線は空と同じ倍率、地平線より下（平らな砂）は画面の下端まで伸ばす
      const landX = baseX - yawPx, above = B.horizon - DESERT_ART.land.top, below = B.height - B.horizon;
      const smear = !reducedMotion && (view.boost || 0) > 0.2 ? yawPx * 0.04 * (view.boost || 0) : 0;
      for (const [image, alpha] of [[land, 1], [dusk > 0 ? duskLand : null, dusk]]) {
        if (!image) continue;
        ctx.globalAlpha = alpha;
        ctx.drawImage(image, 0, 0, B.width, above, landX, HORIZON - above * k, dw, above * k);
        ctx.drawImage(image, 0, above, B.width, below, landX, HORIZON, dw, H - HORIZON);
        if (smear) {
          ctx.globalAlpha = alpha * 0.28;
          ctx.drawImage(image, 0, 0, B.width, above, landX + smear, HORIZON - above * k, dw, above * k);
          ctx.drawImage(image, 0, above, B.width, below, landX + smear, HORIZON, dw, H - HORIZON);
          ctx.drawImage(image, 0, 0, B.width, above, landX - smear, HORIZON - above * k, dw, above * k);
          ctx.drawImage(image, 0, above, B.width, below, landX - smear, HORIZON, dw, H - HORIZON);
        }
      }
      ctx.globalAlpha = 1;
      return true;
    }
    function drawSky(dusk, progress) {
      const top = mixColor([92, 158, 226], [120, 72, 110], dusk), mid = mixColor([176, 212, 240], [245, 150, 84], dusk), bottom = mixColor([236, 226, 206], [255, 208, 140], dusk);
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 20);
      sky.addColorStop(0, top); sky.addColorStop(0.62, mid); sky.addColorStop(1, bottom);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON + 20);
      // 太陽: 進むほど大きく低く。ゴールの手前では地平線に触れる
      const sunX = W * 0.5 - world.yaw * 200 * (1 + 0.4 * (view.boost || 0)) + 180 * (1 - progress), sunY = lerp(70, HORIZON - 14, Math.min(1, progress * 1.05)), r = lerp(30, 72, progress);
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
        const shift = world.yaw * 280 * (i + 1) * (1 + 0.5 * (view.boost || 0)) + game.z * layer.speed * 6 * (1 + 0.7 * (view.boost || 0));
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
        ctx.fillRect(0, HORIZON, W, H - HORIZON);
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
      for (let y = H - rowH; y > HORIZON + 1; y -= rowH) {
        const dz = k / (y + rowH / 2 - HORIZON);
        if (dz > DRAW_DIST) break;
        const alpha = Math.min(1, Math.max(0, 1.15 - dz / 120));
        if (alpha <= 0.02) break;
        const z = camZ + dz;
        while (seg < points.length - 1 && points[seg].z < z) seg++;
        const a = points[seg - 1], b = points[seg];
        const roadX = a.x + (b.x - a.x) * Math.min(1, Math.max(0, (z - a.z) / Math.max(0.001, b.z - a.z)));
        const metersAcross = 2 * dz / view.depth; // 画面の横幅に見える砂の幅（m）
        let level = levels[levels.length - 1];
        for (const l of levels) if (metersAcross * l.density <= Math.min(1500, l.maxWidth)) { level = l; break; }
        const leftM = -dz / view.depth + (camX - roadX) * CAM.meterPerLane; // 画面の左端（コースの中心から m）
        const u = ((leftM * level.density) % level.size + level.size) % level.size;
        const v = Math.floor(((z * level.density) % level.size + level.size) % level.size);
        const sw = Math.min(level.maxWidth, metersAcross * level.density);
        ctx.globalAlpha = alpha;
        ctx.drawImage(level.canvas, u, v, sw, 1, 0, y, W, rowH);
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
      const noor = rival ? rivalAt(rival, game.t) : null;
      if (noor && noor.z > camZ + 1.2 && noor.z < camZ + DRAW_DIST) drawables.push({ z: noor.z, kind: "noor", noor });
      if (game.course.length >= camZ && game.course.length < camZ + DRAW_DIST) drawables.push({ z: game.course.length, kind: "goal" });
      drawables.sort((a, b) => b.z - a.z);
      let playerDrawn = false;
      const drawPlayerIfBehind = z => { if (!playerDrawn && z < game.z) { drawPlayer(dusk); playerDrawn = true; } };
      for (const d of drawables) {
        drawPlayerIfBehind(d.z);
        if (d.kind === "bump") drawBump(d.f, dusk);
        else if (d.kind === "rock") drawRock(d.f, dusk);
        else if (d.kind === "noor") drawRival(d.noor, dusk);
        else drawGoal(dusk);
      }
      if (!playerDrawn) drawPlayer(dusk);
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
    function drawPlayer(dusk) {
      const p = placeAt(game.z, game.x);
      if (!p) return;
      const airT = game.air > 0 ? 1 - game.air / game.airTotal : 0;
      const height = jumpHeight(game);
      const bob = game.air <= 0 && game.fallT <= 0 ? Math.sin(game.t * 14) * 2 * (game.speed / SPEED.max) : 0;
      const unit = p.scale * (H / 2); // 1m の高さに相当する画素
      const groundY = p.y, cx = p.x;
      // 影（空中では小さく薄く）
      softShadow(cx, groundY, unit * 0.62 * (1 - height * 0.2), unit * 0.16, 0.42 - height * 0.12);
      const baseY = groundY - height * unit * 0.9 + bob;
      const lean = Math.max(-0.5, Math.min(0.5, game.vx * 0.35));
      // 姿勢の絵（第4弾の差分）があれば、それを板の重心で立たせる。傾きは絵がもう描いているので少しだけ
      pose = riderPose(game, pose);
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
        const sprite = (alpha, dy, grow) => {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(cx, baseY + dy);
          if (game.fallT > 0) ctx.rotate((game.x > 0 ? 1 : -1) * 0.25 * (game.fallT / 1.1));
          else {
            ctx.rotate(lean * (pose === "rider" ? 0.45 : 0.12));
            if (game.air > 0) ctx.translate(0, -Math.sin(airT * Math.PI) * unit * 0.1);
          }
          ctx.scale(spinX * grow, grow);
          ctx.drawImage(poseArt, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh);
          ctx.restore();
        };
        // 短く薄い残像だけを手前に置き、人物や前方の岩を隠さない。
        if (game.boostT > 0 && !reducedMotion) for (let i = 2; i >= 1; i--) sprite(0.12 - i * 0.03, unit * 0.16 * i, 1 + 0.025 * i);
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
      const colors = { trick: "#ffe27a", perfect: "#fff1a8", good: "#c6f0ff", near: "#ffd4a8", smash: "#ffb07a", gauge: "#ffcf5a", race: "#ffe27a", jump: "#ffffff", recover: "#9dffb0" };
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
      ctx.save();
      ctx.translate(p.x, p.y - height * unit * 0.9 + bob);
      const noorPose = raceWith === "noor" ? `noor${riderPose(noor).replace(/^rider/, "Rider")}` : null;
      const noorArt = noorPose && art.get(noorPose);
      if (noorArt) {
        const def = DESERT_ART[noorPose];
        const dh = unit * 2.45 * 0.86 * noorArt.naturalHeight / DESERT_ART.noorRider.size[1];
        const dw = dh * noorArt.naturalWidth / noorArt.naturalHeight;
        if (noor.fallT > 0) ctx.rotate((noor.x > 0 ? 1 : -1) * 0.25 * (noor.fallT / 1.1));
        else ctx.rotate(lean * (noorPose === "noorRider" ? 0.45 : 0.12));
        ctx.drawImage(noorArt, -def.anchor.x * dw, -def.anchor.y * dh, dw, dh);
        ctx.restore();
        ctx.restore();
        if (p.dz < 70) drawRivalName(name, look, p, height, unit);
        return;
      }
      if (noor.fallT > 0) ctx.rotate((noor.x > 0 ? 1 : -1) * 1.1 * (noor.fallT / 1.1));
      else ctx.rotate(lean * 0.8);
      ctx.scale(0.86, 0.86); // 主人公の背面の絵と同じくらいの背丈に
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
      skipCountdown() { countdown = 0; root.dataset.countdown = ""; countShown = "GO!"; startPop.classList.remove("show"); },
      advance(seconds, input = {}) {
        if (!game || game.finished) return;
        const dt = 1 / 60, n = Math.max(1, Math.round(Math.max(0, seconds) / dt));
        for (let i = 0; i < n && !game.finished; i++) step(game, input, dt);
      },
      start(kind = "run", who = "noor") { if (!mode) startRun(kind, who); }, leave: finish,
      pause(value) { paused = !!value; if (!paused) { last = performance.now(); } },
      redraw() { if (game) { updateHud(); simulateParticles(0); draw(1 / 60); } },
      rawBoost() { return boost(game); },
    };
    showMenu();
    if (tutorial) startRun("practice");
  });
  active.set(host, promise);
  promise.finally(() => active.delete(host));
  return promise;
}


