// DESERT RIDE（第4章ドバイ・サンドボード）の画面。後方視点の疑似3Dを Canvas に描き、入力・HUD・練習・リザルトを持つ。
// 規則と採点は desert-ride-model.js。本編との接続（行動枠・報酬・保存）は chapters/ch4-desert.js で、ここは保存を読まない。
// 絵（遠景・主人公の背面・岩・旗・ゴール・砂煙）は Codex 生成の採用画像（desert-ride-art.js）。読み込み前・失敗時は Canvas の図形で描く。
// 起伏・路面・太陽・夕方の色は Canvas で描く。左右・ジャンプ・着地・転倒の姿勢は第4弾の差分の絵（riderPose）。
// 2026-11-02 オーナー「もっとスピード感やエフェクトを派手に」: 速さで広がる視界（人物の大きさは保つ）・傾くカメラ・強いスピード線・砂しぶき・
// 着地の輪・得点の浮き出し・トリックのスロー・ブーストの残像。動き軽減ではカメラの動き・揺れ・スロー・閃光・速度線を止める。
// 本番はスタートの合図のあと、ヌール（rivalRun）が横で滑る。ヌールの滑る絵はまだ無いので図形で描く（Codex に依頼）。
import { el } from "../core/util.js";
import { SE, unlockAudio } from "../core/audio.js";
import { COURSE, EDGE, SPEED, SPIN, DEFAULT_SEED, generateCourse, practiceCourse, createGame, step, press, boost, chargeBoost, summary, curveAt, botControl,
  rivalRun, rivalAt } from "./desert-ride-model.js";
import { DESERT_ART, loadDesertArt, riderPose } from "./desert-ride-art.js";

const BOT_STEP = 1 / 60; // 自動操縦の判断と物理の刻み（モデルの検査と同じ）

const W = 1280, H = 720;
const HORIZON = 262;             // 地平線の高さ
const CAM = { depth: 1.5, height: 2.0, back: 4.5, meterPerLane: 1.6 }; // 疑似3Dのカメラ（人物の4.5m後ろ・高さ2m。lane 1 = 1.6m）
const COUNTDOWN = 2.4;           // 本番のスタートの合図（3・2・1・GO）の秒数
const SPEED_FULL = SPEED.boost;  // 演出の「最速」（ブースト）
const SEG = 6;                   // 描く路面の1区間（m）
const DRAW_DIST = 380;           // 前方に描く距離（m）
const active = new WeakMap();

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
  boost: "ゲージが満タン。↓（BOOST）で超加速 ── 岩も砕ける",
  boostGo: "そのまま、岩へ突っ込め！",
  finish: "いい感じ。あとは、滑るだけ",
};

/**
 * 砂丘を滑る。host（本編は #stage）の上に全画面で重ね、「砂丘を下りる」か signal の中断で閉じる。
 * 完走するたびに onResult(result) を呼ぶ（何度でも）。戻り値 { results, practiced }。
 * @param opts.tutorial 最初に練習（ガイドの説明）から始める
 * @param opts.best 表示する自己ベスト { score, rank }（保存は呼び出し側）
 * @param opts.reducedMotion 揺れ・閃光・速度線を止める
 * @param opts.guide 練習と結果のひとことを言う人の名前（無ければ地の文）
 */
export function runDesertRide({ host = document.getElementById("stage"), signal = null, tutorial = false, best = null, seed = DEFAULT_SEED,
  reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, onResult = null, guide = null, speedUp = 1 } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const art = loadDesertArt();
  const promise = new Promise(resolve => {
    const results = [];
    let practiced = false, done = false, frame = 0, currentBest = best;
    const root = el("section.desert-ride", { dataset: { test: "desert-ride", phase: "menu", reducedMotion: String(!!reducedMotion) }, tabindex: "-1", "aria-label": "DESERT RIDE" });
    const canvas = el("canvas.dr-canvas", { width: W, height: H, "aria-hidden": "true" });
    const ctx = canvas.getContext("2d");
    const hud = el("div.dr-hud", { "aria-hidden": "true" });
    const caption = el("p.dr-caption", { role: "status", dataset: { test: "desert-caption" } });
    const pop = el("div.dr-pop", { "aria-hidden": "true" });
    const panel = el("div.dr-panel");
    const controls = el("div.dr-controls", { hidden: true });
    const quit = el("button.dr-quit", { type: "button", text: "やめる", dataset: { test: "desert-quit" }, hidden: true });
    root.append(canvas, hud, pop, caption, controls, quit, panel);
    host.append(root);
    root.focus({ preventScroll: true });

    const input = { left: false, right: false };
    let pose = "rider";
    let game = null, mode = null, bot = null, botMemo = {}, botLag = 0, last = 0, world = null, particles = [], shakeT = 0, flashT = 0, popT = 0, popText = "", popKind = "";
    let rival = null, countdown = 0, countShown = "", slowT = 0, rings = [], floaters = [], halfShown = 0;
    const view = { depth: CAM.depth, back: CAM.back, roll: 0, kick: 0 }; // 速さで広がる視界。back を depth に比例させ、人物の大きさは変えない
    const streaks = Array.from({ length: 56 }, (_, i) => ({ angle: (i / 56) * Math.PI * 2 + Math.random() * 0.1, phase: Math.random(), len: 0.6 + Math.random() * 0.8, w: 1 + Math.random() * 2 }));
    let tut = null;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
      signal?.removeEventListener("abort", finish);
      root.remove();
      delete window.__desertRide;
      resolve({ results, practiced });
    };
    if (signal?.aborted) { finish(); return; }
    signal?.addEventListener("abort", finish, { once: true });

    // ---- 入力 -------------------------------------------------------------------------
    const act = () => { if (game && !game.finished && mode && countdown <= 0) { const kind = press(game); if (kind) onPress(kind); } };
    const doBoost = () => { if (game && !game.finished && mode && countdown <= 0) boost(game); };
    const onKey = event => {
      if (!root.isConnected) return;
      if (["ArrowLeft", "a", "A"].includes(event.key)) { input.left = true; event.preventDefault(); }
      else if (["ArrowRight", "d", "D"].includes(event.key)) { input.right = true; event.preventDefault(); }
      else if ([" ", "ArrowUp", "w", "W"].includes(event.key) && mode) { if (!event.repeat) act(); event.preventDefault(); }
      else if (["ArrowDown", "Shift", "s", "S", "b", "B"].includes(event.key) && mode) { if (!event.repeat) doBoost(); event.preventDefault(); }
      else if (event.key === "Escape" && mode) { event.preventDefault(); quit.click(); }
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
    // 画面の上の方をタップしてもジャンプ（ボタンの外に指が出ても続けられる）
    canvas.addEventListener("pointerdown", event => { if (mode) { event.preventDefault(); unlockAudio(); act(); } });
    quit.addEventListener("click", () => { if (!mode) return; stopRun(); showMenu(mode === "practice" ? "練習をやめた。" : "途中でやめた。記録は残らない。"); });

    // ---- 進行 -------------------------------------------------------------------------
    function setPhase(name) { root.dataset.phase = name; }
    function showMenu(message = "") {
      mode = null; game = null; tut = null; bot = null;
      controls.hidden = true; quit.hidden = true; caption.textContent = ""; hud.replaceChildren();
      setPhase("menu");
      const start = el("button.btn.primary.dr-button", { type: "button", text: results.length ? "もう一度滑る" : "滑る", dataset: { test: "desert-start" }, onclick: () => startRun("run") });
      const practice = el("button.btn.ghost.dr-button", { type: "button", text: practiced || results.length ? "練習をもう一度" : "練習から始める", dataset: { test: "desert-practice" }, onclick: () => startRun("practice") });
      const leave = el("button.btn.ghost.dr-button", { type: "button", text: "砂丘を下りる", dataset: { test: "desert-leave" }, onclick: finish });
      panel.replaceChildren(el("div.dr-card.dr-menu", { dataset: { test: "desert-menu" } }, [
        el("p.dr-kicker", { text: "DUBAI · SAND DUNES" }),
        el("h2.dr-title", { text: "DESERT RIDE" }),
        el("p.dr-lead", { text: message || "砂丘を一気に滑り下りる。ヌールより先に、ゴールの旗へ。" }),
        el("ul.dr-howto", [
          el("li", { text: "← → で左右。砂の上なので、少し遅れてついてくる" }),
          el("li", { text: "起伏の手前で Space で大ジャンプ。着地の直前にもう一度押すと加速" }),
          el("li", { text: "空中で ← → を押し続けると回転。回りかけで着地すると転ぶ" }),
          el("li", { text: "ゲージが満タンで ↓（BOOST）。超加速して、岩も砕く" }),
        ]),
        currentBest ? el("p.dr-best", { text: `自己ベスト ${currentBest.score.toLocaleString("ja-JP")}点 ／ ${currentBest.rank}`, dataset: { test: "desert-best" } }) : null,
        el("div.dr-actions", [start, practice, leave]),
      ]));
      (tutorial && !practiced ? practice : start).focus();
    }
    function startRun(kind) {
      mode = kind;
      panel.replaceChildren();
      const course = kind === "practice" ? practiceCourse() : generateCourse(seed);
      rival = kind === "practice" ? null : rivalRun(course);
      game = createGame(course, { rival });
      world = { sky: 0, yaw: 0, sunPulse: 0 };
      particles = []; rings = []; floaters = []; shakeT = 0; flashT = 0; popT = 0; slowT = 0; halfShown = 0; bot = null; botMemo = {}; botLag = 0;
      Object.assign(view, { depth: CAM.depth, back: CAM.back, roll: 0, kick: 0 });
      countdown = kind === "practice" ? 0 : COUNTDOWN; countShown = "";
      root.dataset.countdown = countdown > 0 ? "on" : "";
      tut = kind === "practice" ? { step: "move", moved: false, bumpTries: 0, said: new Set() } : null;
      controls.hidden = false; quit.hidden = false;
      setPhase(kind);
      caption.textContent = kind === "practice" ? TUTORIAL.move : "";
      buildHud();
      last = performance.now();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    }
    function stopRun() { cancelAnimationFrame(frame); mode = null; }
    function onPress(kind) {
      if (kind === "big") { SE.whoosh(); showPop("JUMP!", "jump"); }
      else if (kind === "hop") SE.click();
    }
    let font = null;
    const fontFamily = () => (font ??= getComputedStyle(root).fontFamily || "sans-serif");
    /** 得点の浮き出し（人物の頭の上から上がっていく）。 */
    function floater(text, kind = "") { floaters.push({ text, kind, age: 0, life: 0.95, dx: (Math.random() - 0.5) * 60 }); if (floaters.length > 8) floaters.shift(); }
    function showPop(text, kind = "") {
      popText = text; popKind = kind; popT = 1;
      pop.textContent = text; pop.dataset.kind = kind; pop.classList.remove("show");
      void pop.offsetWidth; pop.classList.add("show");
    }

    // ---- HUD ---------------------------------------------------------------------------
    let hudNodes = null;
    function buildHud() {
      hudNodes = {
        score: el("strong.dr-score", { text: "0" }), combo: el("span.dr-combo", { text: "" }),
        time: el("span.dr-time", { text: "0.0" }), kmh: el("strong.dr-kmh", { text: "0" }), gauge: el("i"), gaugeBox: null, progress: el("i"),
        you: el("b.dr-mark.dr-mark-you", { title: "あなた" }), noor: el("b.dr-mark.dr-mark-noor", { title: "ヌール" }), race: el("span.dr-race", { dataset: { test: "desert-race-gap" } }),
      };
      hudNodes.gaugeBox = el("div.dr-gauge", { dataset: { test: "desert-gauge" } }, [hudNodes.gauge, el("span", { text: "BOOST" })]);
      hud.replaceChildren(
        el("div.dr-hud-left", [el("small", { text: mode === "practice" ? "PRACTICE" : "SCORE" }), hudNodes.score, hudNodes.combo]),
        el("div.dr-hud-center", [
          el("div.dr-progress", [hudNodes.progress, el("b.dr-progress-sun"), rival ? hudNodes.noor : null, hudNodes.you]),
          rival ? hudNodes.race : null,
        ]),
        el("div.dr-hud-right", [
          el("div.dr-speedo", [hudNodes.kmh, el("small", { text: "km/h" })]),
          hudNodes.gaugeBox,
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
      hudNodes.kmh.textContent = String(Math.round(game.speed * 3.6));
      hudNodes.kmh.dataset.fast = game.boostT > 0 ? "boost" : game.speed > SPEED.max * 0.85 ? "fast" : "";
      const full = game.gauge >= 1, boosting = game.boostT > 0;
      hudNodes.gauge.style.width = `${Math.round(100 * (boosting ? game.boostT / 3 : game.gauge))}%`;
      hudNodes.gaugeBox.dataset.state = boosting ? "boost" : full ? "full" : "";
      root.dataset.gauge = boosting ? "boost" : full ? "full" : "";
      const progress = z => `${(100 * Math.min(1, z / game.course.length)).toFixed(1)}%`;
      hudNodes.progress.style.width = progress(game.z);
      hudNodes.you.style.left = progress(game.z);
      if (rival) {
        const noor = rivalAt(rival, game.t);
        hudNodes.noor.style.left = progress(noor.z);
        const gap = Math.round(game.z - Math.min(noor.z, game.course.length));
        hudNodes.race.textContent = countdown > 0 ? "VS ヌール" : Math.abs(gap) < 3 ? "ヌールと並走" : gap > 0 ? `ヌールに ${gap}m 差` : `ヌールまで ${-gap}m`;
        hudNodes.race.dataset.lead = countdown > 0 || Math.abs(gap) < 3 ? "" : gap > 0 ? "you" : "noor";
      }
    }

    // ---- 練習の説明 ------------------------------------------------------------------
    function say(key) { if (tut.said.has(key + tut.step)) return; tut.said.add(key + tut.step); caption.textContent = TUTORIAL[key]; }
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
      const real = Math.min(0.05, (now - last) / 1000) * speedUp;
      last = now;
      if (countdown > 0) {
        // スタートの合図（3・2・1・GO）。合図の間は時計を進めない
        countdown = Math.max(0, countdown - real);
        const shown = countdown > 1.6 ? "3" : countdown > 0.8 ? "2" : countdown > 0 ? "1" : "GO!";
        if (shown !== countShown) {
          countShown = shown;
          if (shown === "GO!") { SE.whoosh(); showPop("GO!", "go"); root.dataset.countdown = ""; if (!reducedMotion) view.kick = 1; }
          else { SE.count(); showPop(shown, "count"); }
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
          const big = event.grade !== "bounce";
          if (event.grade === "perfect") { SE.perfect(); showPop(trick ? `${trick.degrees} PERFECT!` : "PERFECT", trick ? "trick" : "perfect"); burst(30, 1.5); }
          else if (event.grade === "good") { SE.good(); showPop(trick ? `${trick.degrees}! GOOD` : "GOOD", trick ? "trick" : "good"); burst(18, 1.1); }
          else if (event.grade === "plain") { if (trick) showPop(`${trick.degrees}!`, "trick"); burst(12, 0.9); }
          else burst(6, 0.6);
          if (event.points) floater(`+${event.points}`, event.grade);
          if (big) { rings.push({ age: 0, life: 0.55, power: event.grade === "perfect" ? 1.3 : 1 }); if (!reducedMotion) shakeT = Math.max(shakeT, event.grade === "perfect" ? 0.2 : 0.12); }
        } else if (event.kind === "trick") {
          SE.reelWin(); floater(`${event.degrees} +${event.points}`, "trick");
          if (!reducedMotion && event.half >= 2) slowT = 0.32;
        } else if (event.kind === "jump") floater(`+${event.points}`, "jump");
        else if (event.kind === "fall") {
          SE.hit(); showPop(event.reason === "spin" ? "回り切れず…" : "転倒…", "fall"); burst(34, 1.6);
          if (!reducedMotion) { shakeT = 0.45; flashT = 0.18; }
        } else if (event.kind === "near") { SE.tick(); floater(`かすめ +${event.points}`, "near"); if (game.combo >= 2) showPop(`${game.combo} COMBO`, "combo"); }
        else if (event.kind === "smash") { SE.crack(); floater(`粉砕 +${event.points}`, "smash"); chips(event.size); if (!reducedMotion) shakeT = Math.max(shakeT, 0.22); }
        else if (event.kind === "gaugeFull") { SE.slotBonus(); floater("BOOST OK ↓", "gauge"); }
        else if (event.kind === "boost") {
          SE.whoosh(); SE.jingle(); showPop("BOOST!!", "boost"); burst(24, 1.6);
          if (!reducedMotion) { shakeT = 0.3; flashT = 0.1; view.kick = 1.4; }
        } else if (event.kind === "race") {
          if (event.won) { floater(`ヌールに勝利 +${event.points}`, "race"); }
        } else if (event.kind === "finish") { SE.just(); if (game.race?.won) SE.fanfare(); }
      }
      // 回転中は半回転ごとに角度を見せる（180 → 360 → …）
      const half = game.spinDir !== 0 ? Math.floor(Math.abs(game.rot) * 2 + 1e-6) : 0;
      if (half > halfShown && half > 0) { SE.tick(); showPop(String(half * 180), "spin"); }
      halfShown = half;
    }
    function onFinished() {
      controls.hidden = true; quit.hidden = true;
      if (mode === "practice") {
        practiced = true;
        mode = null;
        caption.textContent = "";
        setPhase("practiced");
        panel.replaceChildren(el("div.dr-card.dr-menu", { dataset: { test: "desert-practiced" } }, [
          el("p.dr-kicker", { text: "PRACTICE DONE" }),
          el("h2.dr-title", { text: "練習おわり" }),
          el("p.dr-lead", { text: guide ? `${guide}「上手！ じゃあ本番、上から一本いこ！」` : "体が動きを覚えた。上から一本、滑る。" }),
          el("div.dr-actions", [
            el("button.btn.primary.dr-button", { type: "button", text: "本番を滑る", dataset: { test: "desert-start" }, onclick: () => startRun("run") }),
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
        race ? el("p.dr-race-result", { dataset: { test: "desert-race", won: String(race.won) } }, [
          el("b", { text: race.won ? "ヌールに勝った！" : "ヌールの勝ち" }),
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
        ]),
        el("p.dr-best", { text: newBest ? "自己ベスト更新！" : `自己ベスト ${currentBest.score.toLocaleString("ja-JP")}点 ／ ${currentBest.rank}`, dataset: { test: "desert-best" } }),
        el("div.dr-actions", [
          el("button.btn.primary.dr-button", { type: "button", text: "もう一度滑る", dataset: { test: "desert-retry" }, onclick: () => startRun("run") }),
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
      // 滑走中は板の後ろから細かな砂が舞う。速いほど多く、端の深い砂ではさらに多く。ブースト中は太い砂の尾
      if (running && game.air <= 0 && game.fallT <= 0) {
        const k = game.speed / SPEED.max, boosting = game.boostT > 0;
        const rate = (reducedMotion ? 6 : 26) * k * (Math.abs(game.x) > EDGE ? 2.2 : 1) * (boosting ? 2.2 : 1);
        for (let i = 0; i < rate * dt * 4; i++) particles.push({ x: (Math.random() - 0.5) * 50 + game.vx * 30, y: 0, vx: (Math.random() - 0.5) * 80 - game.vx * 60, vy: -(20 + Math.random() * (boosting ? 140 : 70)), r: 4 + Math.random() * (boosting ? 16 : 9), life: 0.4 + Math.random() * 0.4, age: 0 });
        // 曲がると板の外側へ砂しぶき（曲がる向きと反対へ高く飛ぶ）
        const carve = Math.abs(game.vx);
        if (carve > 0.25) {
          const side = game.vx > 0 ? -1 : 1, spray = (reducedMotion ? 8 : 34) * Math.min(1.6, carve) * k;
          for (let i = 0; i < spray * dt * 4; i++) particles.push({ x: side * (20 + Math.random() * 30), y: -6, vx: side * (120 + Math.random() * 260) * Math.min(1.5, carve), vy: -(90 + Math.random() * 200), r: 3 + Math.random() * 8, life: 0.45 + Math.random() * 0.35, age: 0 });
        }
      }
      for (const p of particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.chip ? 900 : 90) * dt; if (!p.chip) p.r += 18 * dt; }
      particles = particles.filter(p => p.age < p.life);
      if (particles.length > 320) particles.splice(0, particles.length - 320);
      for (const r of rings) r.age += dt;
      rings = rings.filter(r => r.age < r.life);
      for (const f of floaters) f.age += dt;
      floaters = floaters.filter(f => f.age < f.life);
      shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt); popT = Math.max(0, popT - dt * 1.4);
      view.kick = Math.max(0, view.kick - dt * 1.6);
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
      // カメラの向き: 今のカーブに少し遅れてついていく（遠くの砂丘がゆっくり流れる）
      const curve = curveAt(game.course, game.z);
      world.yaw += (curve - world.yaw) * Math.min(1, dt * 2.5);
      // 速いほど視界が広がる（遠くが小さく流れる）。カメラの距離も同じ割合で縮め、人物の大きさは変えない。
      // GO とブーストの瞬間は一度ぐっと広がる。動き軽減では固定
      const fast = Math.min(1, Math.max(0, (game.speed - SPEED.min) / (SPEED_FULL - SPEED.min)));
      const targetDepth = reducedMotion ? CAM.depth : CAM.depth * (1 - 0.24 * fast - 0.12 * Math.min(1, view.kick));
      view.depth += (targetDepth - view.depth) * Math.min(1, dt * 4);
      view.back = CAM.back * view.depth / CAM.depth;
      const targetRoll = reducedMotion || countdown > 0 ? 0 : Math.max(-0.05, Math.min(0.05, -game.vx * 0.035 - curve * 0.02));
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
      if (flashT > 0) { ctx.fillStyle = game.boostT > 0 ? `rgba(255,190,110,${flashT * 2})` : `rgba(255,240,220,${flashT * 1.6})`; ctx.fillRect(0, 0, W, H); }
    }
    /** 絵の遠景（空・太陽・陸）。絵がまだ無ければ false（図形の空と砂丘で描く）。 */
    const BACKDROP_SCALE = 0.95;
    function drawBackdrop(dusk, progress) {
      const sky = art.get("sky"), land = art.get("land");
      if (!sky || !land) return false;
      const B = DESERT_ART.backdrop, k = BACKDROP_SCALE, dw = B.width * k, baseX = (W - dw) / 2;
      // 空はゆっくり、陸は速く横へ流れる（カーブに合わせたパララックス）。絵の地平線の行を HORIZON に合わせる
      ctx.drawImage(sky, baseX - world.yaw * 90, HORIZON - B.horizon * k, dw, sky.naturalHeight * k);
      const duskSky = art.get("duskSky"), duskLand = art.get("duskLand");
      if (dusk > 0 && duskSky && duskLand) {
        // 同じ構図の夕方の絵を、ゴールへ近づくほど濃く重ねる
        ctx.globalAlpha = dusk;
        ctx.drawImage(duskSky, baseX - world.yaw * 90, HORIZON - B.horizon * k, dw, duskSky.naturalHeight * k);
        ctx.globalAlpha = 1;
      } else if (dusk > 0) {
        const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 10);
        g.addColorStop(0, `rgba(120,72,110,${dusk * 0.85})`); g.addColorStop(0.62, `rgba(245,150,84,${dusk * 0.8})`); g.addColorStop(1, `rgba(255,208,140,${dusk * 0.7})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 10);
      }
      // 太陽: 進むほど大きく低く。ゴールの手前では砂丘の稜線の後ろへ沈みかける
      const sunX = W * 0.5 - world.yaw * 120 + 180 * (1 - progress), sunY = lerp(70, HORIZON - 34, Math.min(1, progress * 1.05)), r = lerp(30, 72, progress);
      const glow = ctx.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 3.2);
      glow.addColorStop(0, `rgba(255,230,170,${0.55 + 0.3 * dusk})`); glow.addColorStop(1, "rgba(255,200,120,0)");
      ctx.fillStyle = glow; ctx.fillRect(sunX - r * 3.2, sunY - r * 3.2, r * 6.4, r * 6.4);
      ctx.fillStyle = mixColor([255, 248, 220], [255, 170, 90], dusk);
      ctx.beginPath(); ctx.arc(sunX, sunY, r, 0, Math.PI * 2); ctx.fill();
      // 陸: 稜線〜地平線は空と同じ倍率、地平線より下（平らな砂）は画面の下端まで伸ばす
      const landX = baseX - world.yaw * 200, above = B.horizon - DESERT_ART.land.top, below = B.height - B.horizon;
      for (const [image, alpha] of [[land, 1], [dusk > 0 ? duskLand : null, dusk]]) {
        if (!image) continue;
        ctx.globalAlpha = alpha;
        ctx.drawImage(image, 0, 0, B.width, above, landX, HORIZON - above * k, dw, above * k);
        ctx.drawImage(image, 0, above, B.width, below, landX, HORIZON, dw, H - HORIZON);
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
      const sunX = W * 0.5 - world.yaw * 160 + 180 * (1 - progress), sunY = lerp(70, HORIZON - 14, Math.min(1, progress * 1.05)), r = lerp(30, 72, progress);
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
        const shift = world.yaw * 220 * (i + 1) + game.z * layer.speed * 6;
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
      let x = 0, dx = 0;
      const firstZ = Math.floor(camZ / SEG) * SEG;
      points.push({ z: camZ + 0.5, dz: 0.5, x: 0, p: project(-camX, 0, 0.5) });
      for (let z = firstZ + SEG; z < camZ + DRAW_DIST; z += SEG) {
        dx += curveAt(game.course, z) * 0.00042 * SEG * SEG;
        x += dx;
        const dz = z - camZ;
        if (dz <= 0.5) continue;
        points.push({ z, dz, x, p: project(x - camX, 0, dz) });
      }
      for (let i = points.length - 1; i > 0; i--) {
        const far = points[i], near = points[i - 1];
        const t = Math.min(1, far.dz / DRAW_DIST);
        const stripe = Math.floor(far.z / (SEG * 3)) % 2 === 0;
        // コース外の深い砂（少し濃く）。絵の砂の上では薄い影だけを重ね、絵の質感を残す
        ctx.fillStyle = painted ? `rgba(150,92,36,${stripe ? 0.12 : 0.08})` : mixColor(stripe ? [222, 190, 136] : [228, 198, 146], [222, 146, 96], dusk);
        quad(near.p.x - near.p.w * 1.9, near.p.y, far.p.x - far.p.w * 1.9, far.p.y, far.p.x + far.p.w * 1.9, far.p.y, near.p.x + near.p.w * 1.9, near.p.y);
        ctx.fillStyle = painted ? `rgba(255,240,200,${stripe ? 0.34 : 0.24})`
          : mixColor(stripe ? [240, 214, 166] : [236, 208, 158], stripe ? [240, 176, 118] : [234, 170, 112], dusk);
        ctx.globalAlpha = lerp(1, 0.55, t);
        quad(near.p.x - near.p.w, near.p.y, far.p.x - far.p.w, far.p.y, far.p.x + far.p.w, far.p.y, near.p.x + near.p.w, near.p.y);
        ctx.globalAlpha = 1;
        // 風紋: 細い波線を間引いて置く
        if (near.p.w > 160 && Math.floor(far.z / SEG) % 2 === 0) {
          ctx.strokeStyle = `rgba(190,150,100,${0.22 * (1 - t)})`; ctx.lineWidth = Math.max(1, near.p.scale * 6);
          ctx.beginPath();
          const sy = lerp(near.p.y, far.p.y, 0.5), mx = lerp(near.p.x, far.p.x, 0.5), mw = lerp(near.p.w, far.p.w, 0.5), r = near.p.scale * 54;
          for (let k = -0.9; k <= 0.9; k += 0.3) { const sx = mx + k * mw; ctx.moveTo(sx - r, sy); ctx.quadraticCurveTo(sx, sy - r * 0.33, sx + r, sy); }
          ctx.stroke();
        }
        // コースの端の目印（細い旗竿）: 24m ごと
        if (Math.floor(far.z / 24) !== Math.floor(near.z / 24)) {
          const poleH = far.p.scale * 1.2 * (H / 2);
          for (const side of [-1, 1]) {
            const px = far.p.x + side * far.p.w * 1.02;
            if (flagArt) {
              const fh = poleH * 1.1, fw = fh * flagArt.naturalWidth / flagArt.naturalHeight;
              ctx.globalAlpha = 1 - t * 0.4;
              ctx.drawImage(flagArt, px - DESERT_ART.flag.foot.x * fw, far.p.y - fh, fw, fh);
              ctx.globalAlpha = 1;
              continue;
            }
            ctx.fillStyle = `rgba(90,70,60,${0.9 - t * 0.5})`; ctx.fillRect(px - 1.5, far.p.y - poleH, 3, poleH);
            ctx.fillStyle = "#e9532b"; ctx.fillRect(px - 1.5, far.p.y - poleH, Math.max(4, far.p.scale * 26), Math.max(3, far.p.scale * 14));
          }
        }
      }
      segmentsDrawn = points;
      ground = { camZ, camX };
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
        else if (d.kind === "noor") drawNoor(d.noor, dusk);
        else drawGoal(dusk);
      }
      if (!playerDrawn) drawPlayer(dusk);
    }
    function drawBump(f, dusk) {
      const near = placeAt(f.z - 5, 0), far = placeAt(f.z + 9, 0), top = placeAt(f.z + 2, 0);
      if (!near || !far || !top) return;
      const lift = top.scale * 1.5 * (H / 2);
      // 手前の斜面（明るい）: 盛り上がりが分かるよう砂より白く
      ctx.fillStyle = mixColor([253, 238, 200], [253, 206, 150], dusk);
      ctx.beginPath(); ctx.moveTo(near.x - near.w, near.y); ctx.quadraticCurveTo(top.x, top.y - lift, far.x - far.w, far.y); ctx.lineTo(far.x + far.w, far.y); ctx.quadraticCurveTo(top.x, top.y - lift, near.x + near.w, near.y); ctx.closePath(); ctx.fill();
      // 向こう側の影（濃い）
      ctx.fillStyle = "rgba(130,86,46,0.42)";
      ctx.beginPath(); ctx.moveTo(far.x - far.w, far.y); ctx.quadraticCurveTo(top.x, top.y - lift * 0.62, far.x + far.w, far.y); ctx.lineTo(far.x + far.w, far.y + 3); ctx.quadraticCurveTo(top.x, top.y - lift * 0.3, far.x - far.w, far.y + 3); ctx.closePath(); ctx.fill();
      // 稜線
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = Math.max(1.5, top.scale * 8);
      ctx.beginPath(); ctx.moveTo(near.x - near.w, near.y); ctx.quadraticCurveTo(top.x, top.y - lift, near.x + near.w, near.y); ctx.stroke();
      // 「ここで跳ぶ」の山形の印（3つ）
      const mark = placeAt(f.z - 2, 0);
      if (mark) {
        ctx.strokeStyle = "rgba(233,83,43,0.85)"; ctx.lineWidth = Math.max(2, mark.scale * 12); ctx.lineJoin = "round";
        ctx.beginPath();
        for (const k of [-0.45, 0, 0.45]) { const cxm = mark.x + k * mark.w; ctx.moveTo(cxm - mark.w * 0.12, mark.y - lift * 0.12); ctx.lineTo(cxm, mark.y - lift * 0.5); ctx.lineTo(cxm + mark.w * 0.12, mark.y - lift * 0.12); }
        ctx.stroke();
      }
    }
    function drawRock(f, dusk) {
      const p = placeAt(f.z, f.x);
      if (!p) return;
      const size = f.size === "small" ? 0.55 : 0.95;
      const rw = p.scale * CAM.meterPerLane * (W / 2) * f.w * 1.15, rh = p.scale * size * 0.62 * (H / 2);
      // 影
      ctx.fillStyle = "rgba(90,60,40,0.28)";
      ctx.beginPath(); ctx.ellipse(p.x + rw * 0.25, p.y + rh * 0.05, rw * 1.1, rh * 0.28, 0, 0, Math.PI * 2); ctx.fill();
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
      const height = game.air > 0 ? Math.sin(airT * Math.PI) * (game.airKind === "big" ? 1.9 : game.airKind === "hop" ? 0.9 : 0.5) : 0;
      const bob = game.air <= 0 && game.fallT <= 0 ? Math.sin(game.t * 14) * 2 * (game.speed / SPEED.max) : 0;
      const unit = p.scale * (H / 2); // 1m の高さに相当する画素
      const groundY = p.y, cx = p.x;
      // 影（空中では小さく薄く）
      ctx.fillStyle = `rgba(70,45,30,${0.32 - height * 0.1})`;
      ctx.beginPath(); ctx.ellipse(cx, groundY, unit * 0.55 * (1 - height * 0.2), unit * 0.14, 0, 0, Math.PI * 2); ctx.fill();
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
        // ブースト中は手前に残像（動き軽減では出さない）
        if (game.boostT > 0 && !reducedMotion) for (let i = 3; i >= 1; i--) sprite(0.22 - i * 0.05, unit * 0.32 * i, 1 + 0.06 * i);
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
    /** スピード線: 消失点から外へ流れる白い線。速いほど多く長く、ブースト中は橙。中央（コースと人物）は空ける。 */
    function drawSpeedLines() {
      if (reducedMotion || !game || countdown > 0) return;
      const k = Math.min(1, Math.max(0, (game.speed - SPEED.min) / (SPEED_FULL - SPEED.min)));
      const boosting = game.boostT > 0;
      if (k < 0.3 && !boosting) return;
      const amount = boosting ? 1 : (k - 0.3) / 0.7;
      const n = Math.round(14 + 42 * amount), cx = W / 2, cy = HORIZON + 40, reach = Math.hypot(W, H) * 0.62;
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const s = streaks[i];
        const travel = (s.phase + game.t * (0.9 + 1.6 * k)) % 1;
        const r0 = 240 + travel * reach, r1 = r0 + (60 + 220 * amount) * s.len * (0.4 + travel);
        const alpha = (boosting ? 0.6 : 0.42) * amount * Math.sin(travel * Math.PI);
        ctx.strokeStyle = boosting ? `rgba(255,${190 + Math.round(50 * s.len) % 60},120,${alpha})` : `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = s.w * (0.6 + travel * 1.6);
        const ca = Math.cos(s.angle), sa = Math.sin(s.angle) * 0.62;
        ctx.beginPath(); ctx.moveTo(cx + ca * r0, cy + sa * r0); ctx.lineTo(cx + ca * r1, cy + sa * r1); ctx.stroke();
      }
      ctx.restore();
    }
    /** 速いほど画面の縁を暗く（ブースト中は暖色）。 */
    function drawVignette(fast) {
      const boosting = game.boostT > 0;
      const a = (reducedMotion ? 0.12 : 0.34) * fast + (boosting ? 0.2 : 0);
      if (a < 0.02) return;
      const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.42, W / 2, H * 0.55, H * 1.05);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, boosting ? `rgba(160,60,20,${a})` : `rgba(40,20,10,${a})`);
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
      const colors = { trick: "#ffe27a", perfect: "#fff1a8", good: "#c6f0ff", near: "#ffd4a8", smash: "#ffb07a", gauge: "#ffcf5a", race: "#ffe27a", jump: "#ffffff" };
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
    /**
     * ヌール（本番の競走相手）。滑る絵はまだ無いので、図形で描く: 青緑の板・オリーブのシャツ・ベージュのスカーフ・
     * 後ろで束ねた黒髪・頭のサングラス。近い時だけ名前の札を出す。
     */
    function drawNoor(noor, dusk) {
      const p = placeAt(noor.z, noor.x);
      if (!p) return;
      const unit = p.scale * (H / 2);
      const airT = noor.air > 0 && noor.airTotal ? 1 - noor.air / noor.airTotal : 0;
      const height = noor.air > 0 ? Math.sin(airT * Math.PI) * (noor.airKind === "big" ? 1.9 : noor.airKind === "hop" ? 0.9 : 0.5) : 0;
      ctx.fillStyle = `rgba(70,45,30,${0.3 - height * 0.1})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, unit * 0.5, unit * 0.13, 0, 0, Math.PI * 2); ctx.fill();
      const lean = Math.max(-0.5, Math.min(0.5, noor.vx * 0.35));
      const bob = noor.air <= 0 && noor.fallT <= 0 ? Math.sin(noor.t * 13 + 1) * unit * 0.02 : 0;
      ctx.save();
      ctx.translate(p.x, p.y - height * unit * 0.9 + bob);
      if (noor.fallT > 0) ctx.rotate((noor.x > 0 ? 1 : -1) * 1.1 * (noor.fallT / 1.1));
      else ctx.rotate(lean * 0.8);
      ctx.scale(0.86, 0.86); // 主人公の背面の絵と同じくらいの背丈に
      const c = noor.air > 0 && noor.landingPress != null ? 0.86 : noor.air > 0 ? 0.94 : 1; // 構えると低く
      const u = unit, line = (w, color, pts) => { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, w * u); ctx.beginPath(); ctx.moveTo(pts[0] * u, pts[1] * u); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i] * u, pts[i + 1] * u); ctx.stroke(); };
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // 板（青緑）: 斜めに置き、上面に明るい筋
      ctx.save(); ctx.rotate(-0.42 + lean * 0.3);
      ctx.fillStyle = mixColor([34, 168, 156], [44, 140, 132], dusk);
      ctx.beginPath(); ctx.ellipse(0, -u * 0.04, u * 0.66, u * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.beginPath(); ctx.ellipse(-u * 0.05, -u * 0.07, u * 0.5, u * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 脚（ベージュのパンツ）: 膝を外へ曲げて板に乗る
      const pants = mixColor([168, 146, 108], [160, 124, 98], dusk), hipY = -0.9 * c;
      line(0.19, pants, [-0.3, -0.16, -0.42, -0.5 * c, -0.14, hipY]);
      line(0.19, pants, [0.26, 0.06, 0.4, -0.38 * c, 0.14, hipY]);
      ctx.fillStyle = "#3a2c22"; // 靴
      ctx.beginPath(); ctx.ellipse(-0.3 * u, -0.12 * u, 0.13 * u, 0.07 * u, -0.4, 0, Math.PI * 2); ctx.ellipse(0.26 * u, 0.08 * u, 0.13 * u, 0.07 * u, -0.4, 0, Math.PI * 2); ctx.fill();
      // 胴（オリーブのシャツ）: 腰から肩へ広がる。片側を少し暗く
      const shoulderY = hipY - 0.82 * c, shirt = mixColor([110, 118, 62], [116, 100, 66], dusk);
      ctx.fillStyle = shirt;
      ctx.beginPath(); ctx.moveTo(-0.26 * u, hipY * u); ctx.quadraticCurveTo(-0.4 * u, (hipY - 0.45) * u, -0.38 * u, shoulderY * u);
      ctx.quadraticCurveTo(0, (shoulderY - 0.1) * u, 0.38 * u, shoulderY * u); ctx.quadraticCurveTo(0.4 * u, (hipY - 0.45) * u, 0.26 * u, hipY * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(40,40,10,0.22)"; ctx.fillRect(0.1 * u, shoulderY * u, 0.26 * u, (hipY - shoulderY) * u);
      ctx.fillStyle = "#2b2a20"; ctx.fillRect(-0.27 * u, (hipY - 0.06) * u, 0.54 * u, 0.08 * u); // ベルト
      // 腕: 肩から外へ、肘を曲げて釣り合いを取る（空中では高く）
      const skin = mixColor([176, 122, 84], [176, 110, 80], dusk), up = noor.air > 0 ? -0.25 : 0.15, reach = 0.75 + Math.abs(lean) * 0.3;
      line(0.12, shirt, [-0.34, shoulderY + 0.06, -0.62, shoulderY + 0.3 + up * 0.5]);
      line(0.1, skin, [-0.62, shoulderY + 0.3 + up * 0.5, -0.34 - reach * 0.6, shoulderY + 0.12 + up]);
      line(0.12, shirt, [0.34, shoulderY + 0.06, 0.62, shoulderY + 0.3 + up * 0.5]);
      line(0.1, skin, [0.62, shoulderY + 0.3 + up * 0.5, 0.34 + reach * 0.6, shoulderY + 0.12 + up]);
      // 首とスカーフ（ベージュ）。スカーフの端が風でなびく
      ctx.fillStyle = skin; ctx.fillRect(-0.07 * u, (shoulderY - 0.16) * u, 0.14 * u, 0.18 * u);
      const scarf = mixColor([234, 220, 184], [236, 200, 160], dusk), flutter = Math.sin(noor.t * 11) * 0.06;
      ctx.fillStyle = scarf; ctx.beginPath(); ctx.ellipse(0, (shoulderY + 0.02) * u, 0.24 * u, 0.09 * u, 0, 0, Math.PI * 2); ctx.fill();
      line(0.08, scarf, [0.14, shoulderY + 0.04, 0.32, shoulderY + 0.2 + flutter, 0.46, shoulderY + 0.16 - flutter]);
      // 頭（後ろ姿の黒髪）と、後ろで束ねて揺れる髪
      const headY = shoulderY - 0.36;
      ctx.fillStyle = "#1b161d"; ctx.beginPath(); ctx.ellipse(0, headY * u, 0.21 * u, 0.24 * u, 0, 0, Math.PI * 2); ctx.fill();
      const sway = Math.sin(noor.t * 8.5) * 0.05;
      ctx.beginPath(); ctx.moveTo(-0.07 * u, (headY + 0.08) * u); ctx.quadraticCurveTo((0.02 + sway) * u, (headY + 0.42) * u, (0.06 + sway * 1.6) * u, (headY + 0.5) * u);
      ctx.quadraticCurveTo((0.1 + sway) * u, (headY + 0.3) * u, 0.07 * u, (headY + 0.08) * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.ellipse(-0.07 * u, (headY - 0.08) * u, 0.07 * u, 0.12 * u, 0.4, 0, Math.PI * 2); ctx.fill();
      // 頭に乗せたサングラス（黄色の縁）
      ctx.fillStyle = "#2a2430"; ctx.strokeStyle = "#e3b23c"; ctx.lineWidth = Math.max(1, 0.03 * u);
      for (const sx of [-0.09, 0.09]) { ctx.beginPath(); ctx.ellipse(sx * u, (headY - 0.17) * u, 0.075 * u, 0.045 * u, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      if (p.dz < 70) {
        const tagY = Math.max(150, p.y - height * unit * 0.9 - unit * 2.45);
        ctx.save();
        ctx.globalAlpha = Math.min(1, (70 - p.dz) / 25);
        ctx.font = `800 ${Math.round(Math.max(16, Math.min(24, unit * 0.32)))}px ${fontFamily()}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const w = ctx.measureText("ヌール").width + 20;
        ctx.fillStyle = "rgba(60,70,30,0.82)"; ctx.beginPath(); ctx.roundRect?.(p.x - w / 2, tagY - 15, w, 30, 15); ctx.fill();
        ctx.fillStyle = "#f6ecd2"; ctx.fillText("ヌール", p.x, tagY);
        ctx.restore();
      }
    }

    // 検証・デモ用の手がかり（保存に触れない）
    window.__desertRide = {
      get game() { return game; }, get mode() { return mode; }, get results() { return results; },
      press: act, setInput(left, right) { input.left = !!left; input.right = !!right; },
      autoplay(skill = "expert") { bot = skill; }, boost: doBoost, get rival() { return rival; }, get countdown() { return countdown; },
      setSpeedUp(value) { speedUp = Math.max(1, Number(value) || 1); },
      start(kind = "run") { if (!mode) startRun(kind); }, leave: finish,
    };
    showMenu();
    if (tutorial) startRun("practice");
  });
  active.set(host, promise);
  promise.finally(() => active.delete(host));
  return promise;
}
