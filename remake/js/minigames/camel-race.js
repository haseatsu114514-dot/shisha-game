// CAMEL RACE の画面（Canvas 描写・操作・チュートリアル・リザルト）。計算は camel-race-model.js。
// 本編の #stage（1280×720）か、独立ページの host に重ねて開く。本編の保存・進行・体力はここでは触らない
// （結果を返すだけ。記録と報酬は chapters/ch4-camel-race.js が確定する）。
//
// 操作: Space＝声をかける（輪が重なる瞬間）／X＝補助の合図（ロボット騎手の腕）。スマホは下の2つの大きなボタン。
// ラクダ・ロボット騎手・SUV・車輪は Codex の絵（assets/ui/camel_race・2026-11-02 採用。原画は asset_sources/ch4-camel-race）。
// 絵が読めない環境では Canvas の描画に戻す。砂漠・柵・砂煙・合図の輪・HUD は Canvas で描く。
import { el } from "../core/util.js";
import { SE } from "../core/audio.js";
import { imgFileUrl } from "../core/img-file.js";
import { RACE, CUE, PLAYER, createRace, stepRace, pressVoice, pressSignal, activeCue, inSpurt, standings, scoreRace,
  POLICIES, PLAYER_CAMEL, RIVAL_PROFILES } from "./camel-race-model.js";

export const CAMEL_RACE_TITLE = "CAMEL RACE";
const W = 1280, H = 720;
const PX_PER_M = 18;              // 1m＝18px（画面に約70mが入る）
const PLAYER_SCREEN_X = 420;      // 自分のラクダはこの位置に固定し、世界が流れる
const HORIZON = 330;
// 奥から手前へ: ライバル3（先行）・ライバル2（追い込み）・自分・ライバル1（安定）。奥ほど小さく高い位置。
const LANES = [
  { id: "front", y: 440, scale: 0.78 },
  { id: "closer", y: 482, scale: 0.86 },
  { id: "player", y: 528, scale: 0.95 },
  { id: "steady", y: 578, scale: 1.04 },
];
const TUTORIAL = [
  { title: "ラクダは、自分で走る", body: "進路は操縦しない。背中の小さなロボット騎手に、横を走る車からリモコンで合図を送るだけ。あとはラクダの足にまかせる。" },
  { title: "声をかける ── Space／左のボタン", body: "ラクダの頭の上に金色の輪が出て、縮んでいく。内側の輪と重なった瞬間に押すと PERFECT。外せば無駄な声でスタミナが減り、連打はもっと減る。" },
  { title: "合図 ── X／右のボタン", body: "ロボット騎手の腕を振る。スタミナを使って一気に加速し、残り250mの LAST SPURT でいちばん伸びる。息が切れていると空ぶかし。終盤に残しておこう。" },
];
const sfx = name => { try { SE[name]?.(); } catch { /* 音は無くても遊べる */ } };

// ---- 絵（Codex・2026-11-02 採用）。寸法は絵の画素で、asset_sources/ch4-camel-race/README.md で測った値。
// ラクダは4コマ（512×384・右向き）。背の線は4コマとも1px以内で、ground の線に足元をそろえる。
// 騎手（160×160）はコブの頂点（x=260）の45px後ろの背に、鞍の底を合わせて座らせる。
// SUV（720×360）の車輪の上に、回転用の車輪（160×160・直径約140px）を 137/160 倍で重ねる。
const ART_FILES = Object.freeze({
  camel: [1, 2, 3, 4].map(i => `ui/camel_race/camel_${i}.webp`),
  jockey: "ui/camel_race/jockey.webp", suv: "ui/camel_race/suv.webp", wheel: "ui/camel_race/wheel.webp",
});
const CAMEL_ART = Object.freeze({ scale: 0.3, centerX: 256, ground: 342, seatX: 215, seatY: 131, stride: 4.5 });
const JOCKEY_ART = Object.freeze({ cx: 94, bottom: 133, scale: 0.9 });
const SUV_ART = Object.freeze({ scale: 0.3, centerX: 360, ground: 331, wheels: [[167, 259], [581, 259]], wheel: 137 / 160, radius: 60 });
// AI のラクダの毛色の違い（ctx.filter が無い端末では同じ色のまま。名札の色で見分ける）。
const RIVAL_TINT = Object.freeze({ front: "sepia(0.25) saturate(1.25) brightness(0.95)", closer: "brightness(1.12) saturate(0.85)", steady: "brightness(0.82) saturate(1.05)" });
let artTask = null;
/** 絵をすべて読み終えたら { camel: [..4], jockey, suv, wheel }。1枚でも読めなければ null（Canvas の描画に戻す）。 */
export function loadCamelArt() {
  if (typeof Image === "undefined") return Promise.resolve(null);
  const load = rel => { const image = new Image(); image.decoding = "async"; image.src = imgFileUrl(rel); return image.decode().then(() => image); };
  artTask ||= Promise.all([Promise.all(ART_FILES.camel.map(load)), load(ART_FILES.jockey), load(ART_FILES.suv), load(ART_FILES.wheel)])
    .then(([camel, jockey, suv, wheel]) => ({ camel, jockey, suv, wheel }))
    .catch(() => null);
  return artTask;
}
if (typeof Image !== "undefined" && typeof document !== "undefined") void loadCamelArt();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtTime = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, "0")}`;
const active = new WeakMap();

/**
 * @param host 重ねる要素（既定: #stage）
 * @param tutorial 開始前のチュートリアルを出すか
 * @param pilot テスト・デモ用の自動操作（"perfect"／"good"／"none"／"spam"／関数）
 * @param timeScale テスト用の早回し
 * @param best 以前の自己ベスト（リザルトで更新を知らせる）
 * 戻り値: { completed, cancelled, runs: [採点…], best: 最高の採点, last: 最後の採点 }
 */
export function runCamelRace({ host = document.getElementById("stage"), signal = null, seed = null, tutorial = true, allowRetry = true,
  pilot = null, timeScale = 1, best = null, reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const runs = [];
  const summary = completed => {
    const bestRun = runs.reduce((top, run) => !top || run.total > top.total ? run : top, null);
    return { completed, cancelled: !completed, runs: runs.map(run => ({ ...run })), best: bestRun ? { ...bestRun } : null, last: runs.length ? { ...runs.at(-1) } : null };
  };
  if (signal?.aborted) return Promise.resolve(summary(false));
  let finish;
  const promise = new Promise(resolve => { finish = resolve; });
  active.set(host, promise);

  const previousFocus = document.activeElement;
  const canvas = el("canvas.camel-canvas", { width: W, height: H, "aria-hidden": "true" });
  const ctx = canvas.getContext("2d");
  const feedback = el("div.camel-feedback", { "aria-hidden": "true" });
  const banner = el("div.camel-banner", { "aria-hidden": "true" });
  const countdownNode = el("div.camel-countdown", { "aria-hidden": "true" });
  const live = el("p.camel-live", { role: "status", "aria-live": "polite" });
  const standingsNode = el("ol.camel-standings", { "aria-label": "順位" });
  const stageNode = el("div.camel-stage", [canvas, feedback, banner, countdownNode]);
  const voiceButton = el("button.camel-control.camel-voice", { type: "button", dataset: { test: "camel-voice" } }, [
    el("strong", { text: "声をかける" }), el("span", { text: "Space" })]);
  const signalButton = el("button.camel-control.camel-signal", { type: "button", dataset: { test: "camel-signal" } }, [
    el("strong", { text: "合図" }), el("span", { text: "X" })]);
  const controls = el("div.camel-controls", [voiceButton, signalButton]);
  const closeButton = el("button.camel-close", { type: "button", text: "やめる", dataset: { test: "camel-close" } });
  const header = el("header.camel-header", [
    el("div", [el("h1", { text: CAMEL_RACE_TITLE }), el("p", { text: `練習レース ${RACE.length.toLocaleString("ja-JP")}m ── ${RIVAL_PROFILES.length + 1}頭` })]),
    standingsNode, closeButton,
  ]);
  const sheet = el("div.camel-sheet", { hidden: true });
  const root = el("section.camel-game", { role: "dialog", "aria-modal": "true", "aria-label": CAMEL_RACE_TITLE, tabindex: "-1",
    dataset: { test: "camel-game", phase: "loading", reducedMotion: String(reducedMotion) } }, [header, stageNode, controls, live, sheet]);
  host.append(root);

  let art = null;
  void loadCamelArt().then(value => { art = value; if (!done) root.dataset.art = value ? "sprites" : "canvas"; });
  let race = null, phase = "loading", raf = 0, last = null, goalAt = 0, feedbackTimer = 0, bannerTimer = 0, countdownLeft = 0, countdownShown = -1;
  let standingsStamp = 0, whip = 0, done = false, spurtShown = false, settleTimer = 0;
  const dust = [], confetti = [];
  const rivalSeed = () => (seed ?? crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;
  const pilotPolicy = typeof pilot === "function" ? pilot : pilot ? POLICIES[pilot] : null;
  if (pilot && !pilotPolicy) { active.delete(host); root.remove(); return Promise.reject(new RangeError(`Unknown pilot: ${pilot}`)); }

  const setPhase = next => { phase = next; root.dataset.phase = next; controls.hidden = next !== "race" && next !== "countdown"; };
  const announce = text => { live.textContent = text; };
  const showFeedback = (text, kind) => {
    feedback.textContent = text; feedback.dataset.kind = kind; feedback.classList.remove("show");
    void feedback.offsetWidth; feedback.classList.add("show"); feedbackTimer = 0.7;
  };
  const showBanner = (text, kind, seconds = 1.6) => { banner.textContent = text; banner.dataset.kind = kind; banner.classList.add("show"); bannerTimer = seconds; };

  // ---- 入力 -----------------------------------------------------------------------------------------
  const onVoice = () => {
    if (phase !== "race" || !race) return;
    const result = pressVoice(race);
    if (!result) return;
    if (result.type === "perfect") { sfx("perfect"); showFeedback("PERFECT", "perfect"); }
    else if (result.type === "good") { sfx("good"); showFeedback(result.dt > 0 ? "GOOD（遅め）" : "GOOD（早め）", "good"); }
    else { sfx("miss"); showFeedback(result.spam ? "連打はダメ" : "無駄な声", "miss"); }
  };
  const onSignal = () => {
    if (phase !== "race" || !race) return;
    const result = pressSignal(race);
    if (!result || result.type === "cooldown") return;
    whip = 1;
    sfx("whoosh");
    if (result.type === "spent") showFeedback("空ぶかし……", "miss");
    else if (result.type === "spurt") showFeedback("スパート！", "spurt");
    else if (result.early) showFeedback("早すぎ？", "early");
    else showFeedback("加速", "boost");
  };
  const press = (button, handler) => {
    button.addEventListener("pointerdown", event => { event.preventDefault(); handler(); });
    button.addEventListener("keydown", event => { if (event.key === " " || event.key === "Enter") event.preventDefault(); });
  };
  press(voiceButton, onVoice); press(signalButton, onSignal);
  const onKey = event => {
    if (event.repeat || sheet.hidden === false) return;
    if (event.code === "Space" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onVoice(); }
    else if (event.key === "x" || event.key === "X" || event.code === "KeyX") { event.preventDefault(); event.stopPropagation(); onSignal(); }
  };
  root.addEventListener("keydown", onKey);
  // 本編の会話エンジンがウィンドウのキーを拾わないよう、レース中はここで止める。
  const windowKey = event => { if (root.contains(document.activeElement) || phase === "race") { if (event.code === "Space" || event.code === "KeyX") event.stopImmediatePropagation(); } };
  window.addEventListener("keydown", windowKey, true);

  // ---- 終了 -----------------------------------------------------------------------------------------
  const cleanup = completed => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", windowKey, true);
    signal?.removeEventListener("abort", abort);
    root.remove();
    active.delete(host);
    try { previousFocus?.focus?.(); } catch { /* 元の要素が無い */ }
    finish(summary(completed));
  };
  const abort = () => cleanup(runs.length > 0);
  signal?.addEventListener("abort", abort, { once: true });
  closeButton.addEventListener("click", () => cleanup(runs.length > 0));

  // ---- 進行 -----------------------------------------------------------------------------------------
  function openTutorial(page = 0) {
    setPhase("tutorial");
    const step = TUTORIAL[page];
    const next = el("button.btn.primary", { type: "button", text: page === TUTORIAL.length - 1 ? "スタート" : "次へ", dataset: { test: "camel-tutorial-next" },
      onclick: () => page === TUTORIAL.length - 1 ? startRace() : openTutorial(page + 1) });
    const skip = el("button.btn.ghost", { type: "button", text: "とばしてスタート", dataset: { test: "camel-tutorial-skip" }, onclick: () => startRace() });
    sheet.replaceChildren(el("div.camel-card", { dataset: { test: "camel-tutorial", page: String(page) } }, [
      el("p.camel-eyebrow", { text: `遊び方 ${page + 1}／${TUTORIAL.length}` }),
      el("h2", { text: step.title }), el("p", { text: step.body }),
      el("div.camel-card-actions", page === TUTORIAL.length - 1 ? [next] : [next, skip]),
    ]));
    sheet.hidden = false;
    next.focus();
  }
  function startRace() {
    sheet.hidden = true; sheet.replaceChildren();
    race = createRace({ seed: rivalSeed() });
    dust.length = 0; confetti.length = 0; whip = 0; spurtShown = false; goalAt = 0; settleTimer = 0;
    countdownLeft = RACE.countdown; countdownShown = -1; last = null;
    setPhase("countdown");
    announce("スタートまで3秒。");
    root.focus({ preventScroll: true });
    renderStandings(true);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    if (done) return;
    raf = requestAnimationFrame(frame);
    if (last === null) last = now;
    let dt = Math.min(0.1, (now - last) / 1000) * timeScale;
    last = now;
    if (phase === "countdown") {
      countdownLeft -= dt;
      const shown = Math.ceil(countdownLeft);
      if (shown !== countdownShown) {
        countdownShown = shown;
        if (shown > 0) { countdownNode.textContent = String(shown); countdownNode.classList.add("show"); sfx("count"); }
        else { countdownNode.textContent = "GO!"; sfx("count"); setPhase("race"); announce("スタート。輪が重なったら声をかける。"); setTimeout(() => countdownNode.classList.remove("show"), 500); }
      }
    } else if (phase === "race") {
      let acc = dt;
      while (acc > 0 && !race.finished) {
        // 自動操作（テスト・デモ）は早回しでも輪を逃さないよう、モデルの1歩ごとに判断する。
        if (pilotPolicy) {
          const action = pilotPolicy(race) || {};
          if (action.voice) onVoice();
          if (action.signal) onSignal();
        }
        const step = Math.min(acc, 1 / 60); stepRace(race, step); acc -= step;
      }
      consumeEvents();
      if (race.finished) {
        setPhase("goal");
        goalAt = 0;
        showBanner("GOAL!", "goal", 2.2);
        sfx(race.rank === 1 ? "fanfare" : "crowd");
        if (!reducedMotion) for (let i = 0; i < 70; i++) confetti.push({ x: W / 2 + (Math.random() - 0.5) * 500, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160, rot: Math.random() * 6, hue: Math.floor(Math.random() * 360) });
      }
    } else if (phase === "goal") {
      goalAt += dt;
      if (goalAt > 2.1) openResult();
    }
    animate(dt);
    draw();
  }
  function consumeEvents() {
    for (const event of race.events) {
      if (event.kind === "voice" && event.type === "lost") showFeedback("見送った……", "lost");
      else if (event.kind === "spurt" && !spurtShown) { spurtShown = true; showBanner("LAST SPURT", "spurt"); announce("ラストスパート。合図を出すなら今。"); }
      else if (event.kind === "stamina" && event.type === "exhausted") showBanner("息が切れた", "tired", 1.2);
    }
    race.events.length = 0;
  }
  function animate(dt) {
    if (feedbackTimer > 0 && (feedbackTimer -= dt) <= 0) feedback.classList.remove("show");
    if (bannerTimer > 0 && (bannerTimer -= dt) <= 0) banner.classList.remove("show");
    whip = Math.max(0, whip - dt * 2.4);
    if (race && (phase === "race" || phase === "goal")) {
      standingsStamp += dt;
      if (standingsStamp > 0.25) { standingsStamp = 0; renderStandings(); }
      if (!reducedMotion) {
        for (const camel of [race.player, ...race.rivals]) {
          if (camel.finishedAt !== null && camel.id !== "player") continue;
          const lane = laneOf(camel.id);
          const sx = PLAYER_SCREEN_X + (camel.distance - race.player.distance) * PX_PER_M;
          if (sx < -80 || sx > W + 80) continue;
          dust.push({ x: sx - 30 * lane.scale, y: lane.y + 8, r: 6 + Math.random() * 8, a: 0.42, vx: -(40 + Math.random() * 40), vy: -(14 + Math.random() * 18), s: lane.scale });
        }
        const suv = suvPosition();
        dust.push({ x: suv.x - 70, y: suv.y + 26, r: 10 + Math.random() * 12, a: 0.32, vx: -(90 + Math.random() * 60), vy: -(10 + Math.random() * 20), s: 1 });
      }
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const puff = dust[i];
      puff.x += puff.vx * dt; puff.y += puff.vy * dt; puff.r += 22 * dt; puff.a -= 0.55 * dt;
      if (puff.a <= 0) dust.splice(i, 1);
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const piece = confetti[i];
      piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.rot += dt * 4;
      if (piece.y > H + 20) confetti.splice(i, 1);
    }
  }
  const laneOf = id => LANES.find(lane => lane.id === id);
  const suvPosition = () => ({ x: PLAYER_SCREEN_X - 150 + Math.sin((race?.t || 0) * 1.3) * 6, y: 640 + Math.sin((race?.t || 0) * 9) * 1.5 });

  // ---- 描写 -----------------------------------------------------------------------------------------
  function draw() {
    const t = race?.t || 0;
    const camX = race ? race.player.distance : 0;
    ctx.clearRect(0, 0, W, H);
    // 空と太陽（朝のレース）。
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, "#1f3a66"); sky.addColorStop(0.55, "#6f9ad0"); sky.addColorStop(1, "#f3d9a7");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON + 2);
    ctx.fillStyle = "rgba(255, 236, 190, 0.95)"; ctx.beginPath(); ctx.arc(1040, 150, 46, 0, Math.PI * 2); ctx.fill();
    // 遠い砂丘（2層。流れる速さが違う）。
    drawDunes(camX * 0.08, HORIZON - 40, 90, "#c9a56a", 0.9);
    drawDunes(camX * 0.22 + 400, HORIZON - 6, 60, "#dbb77c", 1);
    // 砂漠の地面〜コース。
    const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
    ground.addColorStop(0, "#e2c48c"); ground.addColorStop(0.45, "#d9b67a"); ground.addColorStop(1, "#c79d5f");
    ctx.fillStyle = ground; ctx.fillRect(0, HORIZON, W, H - HORIZON);
    // コース帯（走路）とレーンの帯。
    ctx.fillStyle = "#cfa86a"; ctx.fillRect(0, 400, W, 200);
    for (const lane of LANES) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(0, lane.y - 2, W, 3); }
    // 柵（奥と手前）と100mごとの表示板。
    drawFence(camX, 396, 0.7); drawFence(camX, 604, 1);
    drawMarkers(camX);
    drawGates(camX);
    // SUV が走る道（手前）。
    ctx.fillStyle = "#a88a5c"; ctx.fillRect(0, 612, W, 76);
    ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, 648, W, 2);
    // 砂煙（奥）。
    drawDust(0.6);
    // ラクダ（奥から手前）。
    if (race) {
      const order = LANES.map(lane => lane.id === "player" ? race.player : race.rivals.find(r => r.id === lane.id)).filter(Boolean);
      for (const camel of order) {
        const lane = laneOf(camel.id);
        const sx = PLAYER_SCREEN_X + (camel.distance - race.player.distance) * PX_PER_M;
        drawCamel(sx, lane.y, lane.scale, camel, t);
      }
      drawOffscreen();
      drawSuv();
      drawDust(1);
      drawCue();
      drawHud();
      drawConfetti();
    } else { drawSuv(); }
  }
  function drawDunes(offset, baseY, amp, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, HORIZON + 4);
    for (let x = 0; x <= W; x += 16) {
      const wx = x + offset;
      const y = baseY - Math.abs(Math.sin(wx / 260)) * amp - Math.sin(wx / 73) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, HORIZON + 4); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawFence(camX, y, scale) {
    const spacing = 5 * PX_PER_M;
    const start = -((camX * PX_PER_M - PLAYER_SCREEN_X) % spacing) - spacing;
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 2 * scale;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.fillStyle = "#f2efe6";
    for (let x = start; x < W + spacing; x += spacing) ctx.fillRect(x, y - 16 * scale, 3 * scale, 18 * scale);
  }
  function drawMarkers(camX) {
    ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
    for (let m = 100; m < race?.length || 0; m += 100) {
      const sx = PLAYER_SCREEN_X + (m - camX) * PX_PER_M;
      if (sx < -40 || sx > W + 40) continue;
      ctx.fillStyle = "#3b2e22"; ctx.fillRect(sx - 1, 352, 3, 44);
      ctx.fillStyle = "#fff7e6"; ctx.fillRect(sx - 20, 344, 40, 20);
      ctx.fillStyle = "#3b2e22"; ctx.fillText(String(m), sx, 359);
    }
  }
  function drawGates(camX) {
    for (const [m, label, color] of [[0, "START", "#8ee6a8"], [race?.length || RACE.length, "FINISH", "#ffb347"]]) {
      const sx = PLAYER_SCREEN_X + (m - camX) * PX_PER_M;
      if (sx < -120 || sx > W + 120) continue;
      ctx.fillStyle = "#3b2e22"; ctx.fillRect(sx - 4, 280, 8, 330); ctx.fillRect(sx - 4, 280, 8, 10);
      ctx.fillStyle = color; ctx.fillRect(sx - 78, 262, 156, 34);
      ctx.fillStyle = "#1a120c"; ctx.font = "900 20px sans-serif"; ctx.textAlign = "center"; ctx.fillText(label, sx, 287);
      // 観客席のテント（ゴール側）。
      if (m > 0) { ctx.fillStyle = "rgba(255,255,255,0.85)"; for (let i = 0; i < 3; i++) { const tx = sx + 90 + i * 70; ctx.beginPath(); ctx.moveTo(tx, 300); ctx.lineTo(tx + 60, 300); ctx.lineTo(tx + 30, 262); ctx.closePath(); ctx.fill(); } }
    }
  }
  /** 絵のラクダ（4コマ）とロボット騎手。足元を ground の線に、騎手をコブの後ろにそろえる。 */
  function drawCamelSprite(x, y, s, camel, t) {
    const k = s * CAMEL_ART.scale;
    const frame = camel.speed > 1 ? Math.floor((camel.distance / CAMEL_ART.stride) * 4) % 4 : 0;
    const image = art.camel[(frame + 4) % 4];
    const dx = x - CAMEL_ART.centerX * k, dy = y + 30 * s - CAMEL_ART.ground * k;
    ctx.save();
    ctx.fillStyle = "rgba(60,40,20,0.22)"; ctx.beginPath(); ctx.ellipse(x, y + 30 * s, 52 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (camel.id !== "player" && RIVAL_TINT[camel.id]) ctx.filter = RIVAL_TINT[camel.id];
    ctx.drawImage(image, dx, dy, image.width * k, image.height * k);
    ctx.filter = "none";
    // 騎手: 鞍の底を背に合わせ、合図の間だけ前後に揺らす（自分のラクダ）。
    const jk = k * JOCKEY_ART.scale;
    const sx = dx + CAMEL_ART.seatX * k, sy = dy + CAMEL_ART.seatY * k;
    const swing = camel.id === "player" ? Math.sin(whip * Math.PI * 3) * whip * 0.28 : Math.sin(t * 6 + x) * 0.04;
    ctx.translate(sx, sy); ctx.rotate(-swing);
    ctx.drawImage(art.jockey, -JOCKEY_ART.cx * jk, -JOCKEY_ART.bottom * jk, art.jockey.width * jk, art.jockey.height * jk);
    ctx.restore();
    // 名札（AI は毛色に加えて名札の色で見分ける）。
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = "rgba(20,14,10,0.62)"; ctx.fillRect(-34, 34, 68, 16);
    ctx.fillStyle = camel.color; ctx.fillRect(-34, 34, 4, 16);
    ctx.fillStyle = "#fff6e5"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(camel.id === "player" ? `★ ${camel.name}` : camel.name, 2, 46);
    ctx.restore();
  }
  function drawCamel(x, y, s, camel, t) {
    if (art) { drawCamelSprite(x, y, s, camel, t); return; }
    const gait = camel.speed > 1 ? (camel.distance / 3.4) * Math.PI * 2 : 0; // 歩幅に合わせた足の位相
    const bob = Math.sin(gait * 2) * 3 * s;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    const body = camel.color, dark = shade(body, -60), light = shade(body, 28);
    // 影。
    ctx.fillStyle = "rgba(60,40,20,0.22)"; ctx.beginPath(); ctx.ellipse(0, 30 - bob / s, 50, 7, 0, 0, Math.PI * 2); ctx.fill();
    // 足（4本。長く、膝で折れる。前後で位相をずらしたギャロップ）。
    ctx.strokeStyle = dark; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const legs = [[-30, 0, -1], [-22, Math.PI * 0.85, 1], [20, Math.PI * 1.15, -1], [28, Math.PI * 0.3, 1]];
    for (const [lx, phase, side] of legs) {
      const swing = Math.sin(gait + phase) * 18, lift = Math.max(0, Math.cos(gait + phase)) * 10;
      ctx.strokeStyle = side > 0 ? dark : shade(body, -90);
      ctx.beginPath(); ctx.moveTo(lx, 2); ctx.lineTo(lx + swing * 0.45, 16 - lift * 0.4); ctx.lineTo(lx + swing, 30 - lift); ctx.stroke();
    }
    // 胴（やや前上がり）とこぶ（背中の上にひとつ、高く）。
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, -2, 42, 15, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2, -20, 20, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(6, -24, 10, 6, -0.3, 0, Math.PI * 2); ctx.fill();
    // 首（前から高く持ち上げて S 字に）と頭（前を向き、少し下げる）。
    ctx.strokeStyle = body; ctx.lineWidth = 13; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(34, -6); ctx.quadraticCurveTo(50, -8, 58, -34); ctx.quadraticCurveTo(62, -48, 66, -52); ctx.stroke();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(72, -54, 13, 7, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(82, -51, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill(); // 鼻先
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(66, -60, 3, 5, -0.4, 0, Math.PI * 2); ctx.fill(); // 耳
    ctx.fillStyle = "#1a120c"; ctx.beginPath(); ctx.arc(74, -57, 1.8, 0, Math.PI * 2); ctx.fill();
    // 尾。
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-42, -4); ctx.quadraticCurveTo(-54, 2 + Math.sin(gait) * 4, -52, 14); ctx.stroke();
    // 鞍とロボット騎手（こぶの後ろに座る小さな箱型。アンテナ・点滅する灯・振る腕）。
    ctx.fillStyle = "#7a1f2a"; ctx.fillRect(-32, -22, 26, 8);
    ctx.fillStyle = "#3a2a1a"; ctx.fillRect(-30, -14, 22, 3);
    ctx.fillStyle = "#e9eef3"; ctx.fillRect(-30, -40, 18, 18);
    ctx.fillStyle = "#34404a"; ctx.fillRect(-30, -40, 18, 4);
    ctx.fillStyle = "#7fd3ff"; ctx.fillRect(-26, -34, 10, 4); // バイザー
    ctx.fillStyle = "#c9d2da"; ctx.beginPath(); ctx.arc(-21, -42, 5, Math.PI, 0); ctx.fill(); // 丸い頭
    ctx.strokeStyle = "#34404a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-17, -42); ctx.lineTo(-15, -58); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 8 + x) > 0 ? "#ff5a5a" : "#5a1a1a"; ctx.beginPath(); ctx.arc(-15, -59, 2.4, 0, Math.PI * 2); ctx.fill();
    // 腕（合図で振る）。自分のラクダだけ whip が動く。
    const swing = camel.id === "player" ? Math.sin(whip * Math.PI * 3) * whip : Math.sin(t * 3 + x) * 0.1;
    ctx.save(); ctx.translate(-30, -32); ctx.rotate(-0.6 - swing * 1.4);
    ctx.strokeStyle = "#34404a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-18, 0); ctx.stroke();
    ctx.strokeStyle = "#f0c060"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-30, 2); ctx.stroke();
    ctx.restore();
    // 名前札。
    ctx.fillStyle = "rgba(20,14,10,0.6)"; ctx.fillRect(-32, 34, 64, 16);
    ctx.fillStyle = "#fff6e5"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(camel.id === "player" ? `★ ${camel.name}` : camel.name, 0, 46);
    ctx.restore();
  }
  function drawOffscreen() {
    for (const rival of race.rivals) {
      const sx = PLAYER_SCREEN_X + (rival.distance - race.player.distance) * PX_PER_M;
      if (sx >= -40 && sx <= W + 40) continue;
      const lane = laneOf(rival.id), right = sx > W;
      ctx.fillStyle = rival.color; ctx.beginPath();
      const ax = right ? W - 22 : 22;
      ctx.moveTo(ax + (right ? 12 : -12), lane.y); ctx.lineTo(ax, lane.y - 10); ctx.lineTo(ax, lane.y + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff6e5"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = right ? "right" : "left";
      ctx.fillText(`${rival.name} ${right ? "+" : "-"}${Math.abs(Math.round(rival.distance - race.player.distance))}m`, right ? W - 40 : 40, lane.y + 4);
    }
  }
  /** 絵の SUV。車体の車輪の上に回転用の車輪を重ね、地面を流れる速さで回す。 */
  function drawSuvSprite(x, y) {
    const k = SUV_ART.scale;
    const dx = x - SUV_ART.centerX * k, dy = y + 41 - SUV_ART.ground * k;
    ctx.save();
    ctx.fillStyle = "rgba(40,25,10,0.28)"; ctx.beginPath(); ctx.ellipse(x, y + 40, 94, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(art.suv, dx, dy, art.suv.width * k, art.suv.height * k);
    const size = art.wheel.width * SUV_ART.wheel * k;
    const angle = ((race?.player.distance || 0) * PX_PER_M) / (SUV_ART.radius * k);
    for (const [wx, wy] of SUV_ART.wheels) {
      ctx.save(); ctx.translate(dx + wx * k, dy + wy * k); ctx.rotate(reducedMotion ? 0 : angle);
      ctx.drawImage(art.wheel, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  }
  function drawSuv() {
    const { x, y } = suvPosition();
    if (art) { drawSuvSprite(x, y); return; }
    const t = race?.t || 0;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(40,25,10,0.28)"; ctx.beginPath(); ctx.ellipse(0, 30, 92, 9, 0, 0, Math.PI * 2); ctx.fill();
    // 車体（白いSUV）。
    ctx.fillStyle = "#f3f1ea"; roundRect(-86, -14, 172, 38, 8);
    ctx.fillStyle = "#e4e0d4"; roundRect(-56, -40, 112, 30, 10);
    ctx.fillStyle = "#39506a"; roundRect(-50, -36, 44, 22, 4); roundRect(2, -36, 46, 22, 4);
    // 窓から出たリモコンのアンテナと、覗く調教師。
    ctx.fillStyle = "#3b2e22"; ctx.beginPath(); ctx.arc(28, -24, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#1a120c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(44, -28); ctx.lineTo(60, -62); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 10) > 0 ? "#8ee6a8" : "#2f6b44"; ctx.beginPath(); ctx.arc(60, -63, 3, 0, Math.PI * 2); ctx.fill();
    // 車輪。
    for (const wx of [-52, 54]) {
      ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(wx, 26, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9a9a9a"; ctx.beginPath(); ctx.arc(wx, 26, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx, 26); ctx.lineTo(wx + Math.cos(t * 18) * 7, 26 + Math.sin(t * 18) * 7); ctx.stroke();
    }
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function drawDust(layer) {
    for (const puff of dust) {
      if ((layer < 1) !== (puff.s < 0.9)) continue;
      ctx.fillStyle = `rgba(226, 203, 160, ${Math.max(0, puff.a)})`; ctx.beginPath(); ctx.arc(puff.x, puff.y, puff.r * puff.s, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawCue() {
    if (phase !== "race") return;
    const cue = activeCue(race);
    const lane = laneOf("player");
    const cx = PLAYER_SCREEN_X + 20, cy = lane.y - 118;
    // 内側の目標の輪。
    ctx.lineWidth = 3; ctx.strokeStyle = cue ? "rgba(255,245,220,0.95)" : "rgba(255,245,220,0.35)";
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
    if (!cue) return;
    const progress = clamp(cue.progress, 0, 1.3);
    const radius = 20 + (1 - Math.min(progress, 1)) * 44;
    const late = cue.dt > 0;
    ctx.lineWidth = 5; ctx.strokeStyle = late ? `rgba(255,120,120,${clamp(1 - cue.dt / CUE.good, 0, 1)})` : "rgba(255, 210, 110, 0.95)";
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    if (Math.abs(cue.dt) <= CUE.perfect) { ctx.fillStyle = "rgba(255,230,160,0.35)"; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#fff6e5"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("声", cx, cy + 4);
  }
  function drawHud() {
    // 距離ゲージ（4頭の位置）とスタミナ。
    const left = 80, right = W - 80, y = 32;
    ctx.fillStyle = "rgba(20,14,10,0.55)"; roundRect(left - 14, y - 16, right - left + 28, 34, 10);
    ctx.strokeStyle = "rgba(255,246,229,0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    const spurtX = left + (right - left) * RACE.spurtFrom;
    ctx.strokeStyle = "rgba(255,179,71,0.9)"; ctx.beginPath(); ctx.moveTo(spurtX, y - 9); ctx.lineTo(spurtX, y + 9); ctx.stroke();
    ctx.fillStyle = "#ffb347"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText("SPURT", spurtX, y - 12);
    for (const camel of [...race.rivals, race.player]) {
      const px = left + (right - left) * clamp(camel.distance / race.length, 0, 1);
      ctx.fillStyle = camel.color; ctx.beginPath(); ctx.arc(px, y, camel.id === "player" ? 8 : 5, 0, Math.PI * 2); ctx.fill();
      if (camel.id === "player") { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke(); }
    }
    // スタミナ（画面右下。合図の間は点滅）。
    const sw = 300, sx = W - sw - 40, sy = H - 46;
    const st = race.player.stamina;
    ctx.fillStyle = "rgba(20,14,10,0.6)"; roundRect(sx - 12, sy - 26, sw + 24, 48, 10);
    ctx.fillStyle = "#fff6e5"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left"; ctx.fillText(`スタミナ ${Math.round(st)}`, sx, sy - 10);
    ctx.fillStyle = "rgba(255,255,255,0.15)"; roundRect(sx, sy, sw, 12, 6);
    ctx.fillStyle = st < PLAYER.spent ? "#ff6b6b" : st < PLAYER.tired ? "#f0a64a" : "#8ee6a8"; roundRect(sx, sy, sw * (st / 100), 12, 6);
    const cooling = race.t < race.player.cooldownUntil;
    ctx.textAlign = "right"; ctx.fillStyle = cooling ? "rgba(255,246,229,0.5)" : "#ffe2a6";
    ctx.fillText(cooling ? `合図 あと${Math.ceil(race.player.cooldownUntil - race.t)}秒` : inSpurt(race) ? "合図OK ── スパート区間" : "合図OK", sx + sw, sy - 10);
    // 時計と調子。
    ctx.textAlign = "left"; ctx.fillStyle = "#fff6e5"; ctx.font = "bold 16px sans-serif";
    ctx.fillText(fmtTime(race.t), 40, H - 30);
    ctx.font = "bold 12px sans-serif"; ctx.fillStyle = "rgba(255,246,229,0.8)";
    ctx.fillText(`調子 ${"●".repeat(Math.round(race.player.rhythm * 5))}${"○".repeat(5 - Math.round(race.player.rhythm * 5))}`, 40, H - 52);
  }
  function drawConfetti() {
    for (const piece of confetti) {
      ctx.save(); ctx.translate(piece.x, piece.y); ctx.rotate(piece.rot); ctx.fillStyle = `hsl(${piece.hue} 85% 65%)`; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
    }
  }
  function renderStandings(reset = false) {
    const rows = standings(race);
    standingsNode.replaceChildren(...rows.map(row => el("li", { dataset: { who: row.id, test: row.id === "player" ? "camel-standing-player" : null }, style: { "--camel-color": row.color } }, [
      el("b", { text: `${row.position}` }), el("span", { text: row.name }),
      el("small", { text: row.finishedAt !== null ? "GOAL" : reset ? "" : `${Math.round(row.distance)}m` }),
    ])));
  }
  function openResult() {
    const score = scoreRace(race);
    const run = { ...score, seed: race.seed };
    runs.push(run);
    setPhase("result");
    const previousBest = Math.max(best?.total ?? -1, ...runs.slice(0, -1).map(item => item.total));
    const isBest = score.total > previousBest;
    announce(`${score.rank}位でゴール。スコア${score.total}、評価${score.grade}。`);
    const bar = (label, value, max) => el("div.camel-score-row", [
      el("span", { text: label }), el("div.camel-score-bar", [el("i", { style: { width: `${(value / max) * 100}%` } })]),
      el("b", { text: `${value}／${max}` })]);
    const again = el("button.btn.primary", { type: "button", text: "もう一度", dataset: { test: "camel-retry" }, onclick: () => startRace() });
    const leave = el("button.btn", { type: "button", text: "終える", dataset: { test: "camel-finish" }, onclick: () => cleanup(true) });
    sheet.replaceChildren(el("div.camel-card.camel-result", { dataset: { test: "camel-result", rank: String(score.rank), grade: score.grade, total: String(score.total) } }, [
      el("p.camel-eyebrow", { text: "RESULT" }),
      el("div.camel-result-head", [
        el("div.camel-rank", [el("strong", { text: String(score.rank) }), el("span", { text: "位" })]),
        el("div", [el("p.camel-time", { text: `タイム ${fmtTime(score.time)}` }),
          el("p.camel-grade", [el("span", { text: "SCORE " }), el("strong", { text: String(score.total) }), el("span", { text: "  評価 " }), el("strong.camel-grade-letter", { text: score.grade, dataset: { grade: score.grade } })])]),
      ]),
      bar("順位", score.parts.rank, 40), bar("声かけ", score.parts.timing, 35), bar("スタミナ", score.parts.stamina, 25),
      el("p.camel-stats", { text: `PERFECT ${score.stats.perfect} ／ GOOD ${score.stats.good} ／ 見送り ${score.stats.lost} ／ 無駄な声 ${score.stats.miss} ／ 連打 ${score.stats.spam} ／ 合図 ${score.stats.signals}（スパート ${score.stats.spurtSignals}）` }),
      isBest && (best !== null || runs.length > 1) ? el("p.camel-best", { text: "自己ベスト更新！", dataset: { test: "camel-new-best" } }) : null,
      el("div.camel-card-actions", allowRetry ? [again, leave] : [leave]),
    ]));
    sheet.hidden = false;
    (allowRetry ? again : leave).focus();
  }

  // ---- 開始 -----------------------------------------------------------------------------------------
  draw();
  if (tutorial) openTutorial(0); else startRace();
  return promise;
}

/** 色を少し暗く／明るくする（#rrggbb）。 */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => clamp(v + amount, 0, 255);
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
}

export { PLAYER_CAMEL, RIVAL_PROFILES };
