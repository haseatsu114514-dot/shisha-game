// DESERT RIDE（第4章ドバイ・サンドボード）の画面。後方視点の疑似3Dを Canvas に描き、入力・HUD・練習・リザルトを持つ。
// 規則と採点は desert-ride-model.js。本編との接続（行動枠・報酬・保存）は chapters/ch4-desert.js で、ここは保存を読まない。
// 画像素材が届くまで、人物・岩・砂煙は Canvas の図形で描く（素材の依頼は docs/spec/desert_ride.md）。
import { el } from "../core/util.js";
import { SE, unlockAudio } from "../core/audio.js";
import { COURSE, EDGE, SPEED, DEFAULT_SEED, generateCourse, practiceCourse, createGame, step, press, summary, curveAt, botControl } from "./desert-ride-model.js";

const W = 1280, H = 720;
const HORIZON = 262;             // 地平線の高さ
const CAM = { depth: 1.5, height: 2.0, back: 4.5, meterPerLane: 1.6 }; // 疑似3Dのカメラ（人物の4.5m後ろ・高さ2m。lane 1 = 1.6m）
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
    let game = null, mode = null, bot = null, botMemo = {}, last = 0, world = null, particles = [], shakeT = 0, flashT = 0, popT = 0, popText = "", popKind = "";
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
    const act = () => { if (game && !game.finished && mode) { const kind = press(game); if (kind) onPress(kind); } };
    const onKey = event => {
      if (!root.isConnected) return;
      if (["ArrowLeft", "a", "A"].includes(event.key)) { input.left = true; event.preventDefault(); }
      else if (["ArrowRight", "d", "D"].includes(event.key)) { input.right = true; event.preventDefault(); }
      else if ([" ", "ArrowUp", "w", "W"].includes(event.key) && mode) { if (!event.repeat) act(); event.preventDefault(); }
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
      holdButton("ジャンプ／着地", "dr-jump", "desert-jump", act, () => {}),
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
        el("p.dr-lead", { text: message || "砂丘を一気に滑り下りる。岩をよけ、起伏で跳んで、きれいに着地しよう。" }),
        el("ul.dr-howto", [
          el("li", { text: "← →（スマホは左右ボタン）で左右に動く。砂の上なので、少し遅れてついてくる" }),
          el("li", { text: "起伏の手前で Space（ジャンプ）── 大きく跳べる" }),
          el("li", { text: "着地の直前にもう一度 Space ── 姿勢を整えると加速" }),
          el("li", { text: "岩に当たると転ぶ。すぐ起き上がれるが、速度とコンボが落ちる" }),
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
      game = createGame(course);
      world = { sky: 0, yaw: 0, sunPulse: 0 };
      particles = []; shakeT = 0; flashT = 0; popT = 0; bot = null; botMemo = {};
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
        time: el("span.dr-time", { text: "0.0" }), speed: el("i"), progress: el("i"),
      };
      hud.replaceChildren(
        el("div.dr-hud-left", [el("small", { text: mode === "practice" ? "PRACTICE" : "SCORE" }), hudNodes.score, hudNodes.combo]),
        el("div.dr-hud-center", [el("div.dr-progress", [hudNodes.progress, el("b.dr-progress-sun")])]),
        el("div.dr-hud-right", [el("small", { text: "TIME" }), hudNodes.time, el("div.dr-speed", [hudNodes.speed])]),
      );
    }
    function updateHud() {
      if (!hudNodes || !game) return;
      hudNodes.score.textContent = mode === "practice" ? "練習" : Math.max(0, Math.round(game.score)).toLocaleString("ja-JP");
      hudNodes.combo.textContent = game.combo >= 2 ? `${game.combo} COMBO` : "";
      hudNodes.time.textContent = game.t.toFixed(1);
      hudNodes.speed.style.width = `${Math.round(100 * (game.speed - SPEED.min) / (SPEED.max - SPEED.min))}%`;
      hudNodes.progress.style.width = `${Math.round(100 * Math.min(1, game.z / game.course.length))}%`;
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
        if (game.z > 360) { tut.step = "bump"; say("bump"); }
      }
      if (game.z > game.course.length - 50) caption.textContent = TUTORIAL.finish;
    }

    // ---- ループ -------------------------------------------------------------------------
    function tick(now) {
      if (done || !mode) return;
      const dt = Math.min(0.05, (now - last) / 1000) * speedUp;
      last = now;
      const before = game.events.length;
      if (bot) { const { input: botInput, action } = botControl(game, bot, botMemo); Object.assign(input, botInput); if (action) { const kind = press(game); if (kind) onPress(kind); } }
      const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
      for (let i = 0; i < steps && !game.finished; i++) step(game, input, dt / steps);
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
      for (const event of events) {
        if (event.kind === "land") {
          if (event.grade === "perfect") { SE.perfect(); showPop("PERFECT", "perfect"); burst(26, 1.4); }
          else if (event.grade === "good") { SE.good(); showPop("GOOD", "good"); burst(16, 1); }
          else if (event.grade === "plain") { burst(10, 0.8); }
          else burst(6, 0.6);
        } else if (event.kind === "fall") { SE.hit(); showPop("転倒…", "fall"); burst(34, 1.6); if (!reducedMotion) { shakeT = 0.45; flashT = 0.18; } }
        else if (event.kind === "near") { SE.tick(); if (game.combo >= 2) showPop(`${game.combo} COMBO`, "combo"); }
        else if (event.kind === "finish") { SE.just(); }
      }
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
          el("p.dr-lead", { text: guide ? `${guide}「いいね。じゃあ、上から一本いこう」` : "体が動きを覚えた。上から一本、滑る。" }),
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
      panel.replaceChildren(el("div.dr-card.dr-result", { dataset: { test: "desert-result", rank: result.rank } }, [
        el("p.dr-kicker", { text: "RESULT" }),
        el("div.dr-rank", { dataset: { test: "desert-rank" } }, [el("b", { text: result.rank }), el("span", { text: RANK_WORDS[result.rank] })]),
        el("p.dr-total", { dataset: { test: "desert-total" } }, [el("small", { text: "TOTAL" }), el("strong", { text: result.score.toLocaleString("ja-JP") }), el("small", { text: "点" })]),
        el("div.dr-rows", [
          row("滑走時間", `${result.time.toFixed(1)} 秒`, "desert-time"),
          row("最高コンボ", `${result.maxCombo}`, "desert-combo"),
          row("転倒", `${result.falls} 回`, "desert-falls"),
          row("大ジャンプ", `${result.bigJumps} 回`, "desert-jumps"),
          row("着地", `完璧 ${result.perfect} ／ 良い ${result.good}`, "desert-landings"),
          row("岩をかすめた", `${result.nearMiss} 回`, "desert-near"),
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
    function simulateParticles(dt) {
      if (!game) return;
      // 滑走中は板の後ろから細かな砂が舞う。速いほど多く、端の深い砂ではさらに多く
      if (game.air <= 0 && game.fallT <= 0 && mode) {
        const rate = (reducedMotion ? 6 : 26) * (game.speed / SPEED.max) * (Math.abs(game.x) > EDGE ? 2.2 : 1);
        for (let i = 0; i < rate * dt * 4; i++) particles.push({ x: (Math.random() - 0.5) * 50 + game.vx * 30, y: 0, vx: (Math.random() - 0.5) * 80 - game.vx * 60, vy: -(20 + Math.random() * 70), r: 4 + Math.random() * 9, life: 0.4 + Math.random() * 0.4, age: 0 });
      }
      for (const p of particles) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.r += 18 * dt; }
      particles = particles.filter(p => p.age < p.life);
      if (particles.length > 260) particles.splice(0, particles.length - 260);
      shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt); popT = Math.max(0, popT - dt * 1.4);
    }

    // ---- 描画 ---------------------------------------------------------------------------
    const project = (xLane, y, dz) => {
      const scale = CAM.depth / dz;
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
      ctx.save();
      if (shakeT > 0) ctx.translate((Math.random() - 0.5) * 16 * shakeT, (Math.random() - 0.5) * 12 * shakeT);
      drawSky(dusk, progress);
      drawDunes(dusk);
      drawGround(dusk);
      drawFeaturesAndPlayer(dusk);
      drawParticles();
      drawSpeedLines();
      ctx.restore();
      if (flashT > 0) { ctx.fillStyle = `rgba(255,240,220,${flashT * 1.6})`; ctx.fillRect(0, 0, W, H); }
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
    function drawGround(dusk) {
      const camZ = game.z - CAM.back;
      const camX = game.x * 0.6; // カメラは人物の横位置の6割だけ追う（端へ行くと画面も少し寄る）
      ctx.fillStyle = mixColor([238, 210, 160], [238, 170, 112], dusk);
      ctx.fillRect(0, HORIZON, W, H - HORIZON);
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
        // コース外の深い砂（少し濃く）
        ctx.fillStyle = mixColor(stripe ? [222, 190, 136] : [228, 198, 146], [222, 146, 96], dusk);
        quad(near.p.x - near.p.w * 1.9, near.p.y, far.p.x - far.p.w * 1.9, far.p.y, far.p.x + far.p.w * 1.9, far.p.y, near.p.x + near.p.w * 1.9, near.p.y);
        ctx.fillStyle = mixColor(stripe ? [240, 214, 166] : [236, 208, 158], stripe ? [240, 176, 118] : [234, 170, 112], dusk);
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
      const camZ = game.z - CAM.back;
      const drawables = [];
      for (const f of game.course.features) {
        if (f.z < camZ + 0.8 || f.z > camZ + DRAW_DIST) continue;
        drawables.push({ z: f.z, kind: f.kind, f });
      }
      if (game.course.length >= camZ && game.course.length < camZ + DRAW_DIST) drawables.push({ z: game.course.length, kind: "goal" });
      drawables.sort((a, b) => b.z - a.z);
      let playerDrawn = false;
      const drawPlayerIfBehind = z => { if (!playerDrawn && z < game.z) { drawPlayer(dusk); playerDrawn = true; } };
      for (const d of drawables) {
        drawPlayerIfBehind(d.z);
        if (d.kind === "bump") drawBump(d.f, dusk);
        else if (d.kind === "rock") drawRock(d.f, dusk);
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
      ctx.save();
      ctx.translate(cx, baseY);
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
        const a = 0.55 * (1 - s.age / s.life);
        ctx.fillStyle = `rgba(242,220,178,${a})`;
        ctx.beginPath(); ctx.arc(p.x + s.x, p.y + s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    function drawSpeedLines() {
      if (reducedMotion || !game) return;
      const k = (game.speed - SPEED.min) / (SPEED.max - SPEED.min);
      if (k < 0.55) return;
      ctx.strokeStyle = `rgba(255,255,255,${(k - 0.55) * 0.5})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + game.t * 0.7;
        const r0 = 330 + ((game.t * 900 + i * 97) % 160), r1 = r0 + 60 + k * 90;
        ctx.moveTo(W / 2 + Math.cos(angle) * r0, H * 0.55 + Math.sin(angle) * r0 * 0.6); ctx.lineTo(W / 2 + Math.cos(angle) * r1, H * 0.55 + Math.sin(angle) * r1 * 0.6);
      }
      ctx.stroke();
    }

    // 検証・デモ用の手がかり（保存に触れない）
    window.__desertRide = {
      get game() { return game; }, get mode() { return mode; }, get results() { return results; },
      press: act, setInput(left, right) { input.left = !!left; input.right = !!right; },
      autoplay(skill = "perfect") { bot = skill; },
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

const backdrops = new Map();
/**
 * 会話の背景に使う砂丘の一枚（画像素材が届くまでの代替）。dusk 0=昼、1=夕方。同じ値は使い回す。
 * 戻り値は data URL（core/ui.js の setBg にそのまま渡せる）。Canvas が無い環境では "" を返す。
 */
export function desertBackdrop({ dusk = 0 } = {}) {
  const key = Math.round(dusk * 10) / 10;
  if (backdrops.has(key)) return backdrops.get(key);
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  const sky = c.createLinearGradient(0, 0, 0, HORIZON + 40);
  sky.addColorStop(0, mix([92, 158, 226], [120, 72, 110], key)); sky.addColorStop(0.62, mix([176, 212, 240], [245, 150, 84], key)); sky.addColorStop(1, mix([236, 226, 206], [255, 208, 140], key));
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  const sunX = W * 0.62, sunY = lerp(96, HORIZON - 6, key), r = lerp(34, 70, key);
  const glow = c.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 3.4);
  glow.addColorStop(0, `rgba(255,230,170,${0.55 + 0.3 * key})`); glow.addColorStop(1, "rgba(255,200,120,0)");
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  c.fillStyle = mix([255, 248, 220], [255, 170, 90], key); c.beginPath(); c.arc(sunX, sunY, r, 0, Math.PI * 2); c.fill();
  const layers = [
    { amp: 30, freq: 0.0032, base: HORIZON - 30, color: mix([226, 196, 150], [214, 136, 104], key) },
    { amp: 46, freq: 0.0046, base: HORIZON - 4, color: mix([232, 206, 158], [226, 150, 108], key) },
    { amp: 60, freq: 0.0068, base: HORIZON + 30, color: mix([240, 216, 168], [236, 168, 118], key) },
  ];
  for (const [i, layer] of layers.entries()) {
    c.fillStyle = layer.color; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) { const u = (x + 300 * i) * layer.freq; c.lineTo(x, layer.base - Math.abs(Math.sin(u) * layer.amp) - Math.sin(u * 2.7 + i) * layer.amp * 0.25); }
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  const ground = c.createLinearGradient(0, HORIZON + 40, 0, H);
  ground.addColorStop(0, mix([240, 214, 166], [240, 176, 118], key)); ground.addColorStop(1, mix([232, 200, 150], [226, 150, 100], key));
  c.fillStyle = ground; c.fillRect(0, HORIZON + 60, W, H);
  c.strokeStyle = `rgba(190,150,100,0.28)`; c.lineWidth = 2;
  for (let y = HORIZON + 90; y < H; y += 26 + (y - HORIZON) * 0.08) {
    c.beginPath();
    for (let x = -40; x < W + 40; x += 18) { const wave = Math.sin(x * 0.02 + y * 0.05) * 5; if (x < 0) c.moveTo(x, y + wave); else c.lineTo(x, y + wave); }
    c.stroke();
  }
  const url = canvas.toDataURL("image/png");
  backdrops.set(key, url);
  return url;
}
