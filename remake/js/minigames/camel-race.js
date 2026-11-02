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
import { RACE, CUE, PLAYER, SIGNAL, rng, createRace, stepRace, pressVoice, pressSignal, activeCue, inSpurt, standings, scoreRace,
  POLICIES, PLAYER_CAMEL, RIVAL_PROFILES } from "./camel-race-model.js";

export const CAMEL_RACE_TITLE = "CAMEL RACE";
const W = 1280, H = 720;
const PX_PER_M = 18;              // 1m＝18px（画面に約70mが入る）
const PLAYER_SCREEN_X = 420;      // 自分のラクダはこの位置に固定し、世界が流れる
const HORIZON = 330;
// 奥から手前の4列。自分のラクダは調教師の車（SUV）が並走する、いちばん手前の列で大きく見せる
// （2026-11-02 オーナー「どれが自分か分かりずらい」）。足元（y + 31×scale）はすべて手前の柵（y=604）より上。
// 手前の柵はラクダの後に描いて、脚の前を通す。
const LANES = [
  { id: "front", y: 426, scale: 0.74 },
  { id: "closer", y: 462, scale: 0.82 },
  { id: "steady", y: 502, scale: 0.92 },
  { id: "player", y: 548, scale: 1.06 },
];
// ゼッケン（鞍の下の布）。絵の画素で、コブの後ろの脇腹に掛ける四隅と番号の位置。色は順位の札・名札と同じ camel.color。
const CLOTH = Object.freeze({ corners: [[166, 150], [236, 126], [250, 198], [180, 210]], label: [209, 172] });
// 声かけの輪は自分のラクダの背のロボット騎手（声はその小さなスピーカーへ届く）を囲む。
// 奥の列のラクダと重なっても、どのラクダの輪か迷わない位置（列の y からの差）。
const CUE_AT = Object.freeze({ dx: -22, dy: -64 });
const SAIF_ICON = new URL("../../../assets/ui/face_icons/face_saif.png", import.meta.url).href;
// 助手席のサイフの声（実況の代わり）。一人称は俺、はじめは「ハジメ」。台詞の末尾に「。」を付けない（text-style）。
const CALLS = Object.freeze({
  intro: "ハジメ、手前の金のゼッケンがハビーバだ！",
  go: "出た！ 輪が出たら声だぞ！",
  lead: "先頭だ！ ハビーバ、いい顔してる！",
  pass: name => `${name}を抜いた！ その調子！`,
  passed: name => `${name}が来た！ 声、声！`,
  leader: name => `${name}が前に出た。まだ焦るなよ`,
  half: "半分！ 合図はまだ取っとけ",
  spurt: "ここからだ！ 合図、今！",
  last100: "あと100！ いけいけいけ！",
  tired: "ハビーバがバテてる……合図の使いすぎだ",
  combo: "その声だ、ハビーバが乗ってきた！",
  finish: ["勝った！ 1着だ、ハジメ！", "2着！ あと少しだった！", "3着か。次はもっといける", "最下位……でも、ちゃんと走りきった"],
});
const ICONS = Object.freeze({
  voice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9.2v5.6h3.8l5 4.2V5l-5 4.2z" fill="currentColor"/><path d="M15.6 8.6a4.8 4.8 0 0 1 0 6.8M18.2 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  signal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2 4.5 13.6h6.3L9.9 22l8.8-11.8h-6.4z" fill="currentColor"/></svg>',
  camel: '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M5 30l3-9c-2-1-3-3-3-6 0-4 3-7 7-7 2-4 6-6 10-3 3 2 5 2 7 0l4-6c2-1 5 0 6 2l2 4-4 1-4 7c-1 4-4 7-8 8l1 9h-3l-2-8h-6l-3 8H9l2-8-3-1-1 9z" fill="currentColor"/></svg>',
});
const TUTORIAL = [
  { icon: "camel", title: "ラクダは、自分で走る", body: "自分のラクダは、車のすぐ横（いちばん手前）を走る金のゼッケン（★）のハビーバ。進路は操縦しない。背中の小さなロボット騎手に、リモコンで合図を送るだけ。" },
  { icon: "voice", title: "声をかける ── Space／左のボタン", body: "ハビーバの背のロボット騎手のまわりに金色の輪が出て、縮んでいく。内側の輪と重なった瞬間に押すと PERFECT。外せば無駄な声でスタミナが減り、連打はもっと減る。" },
  { icon: "signal", title: "合図 ── X／右のボタン", body: "ロボット騎手の腕を振る。スタミナを使って一気に加速し、残り250mの LAST SPURT でいちばん伸びる。息が切れていると空ぶかし。終盤に残しておこう。" },
];
const sfx = name => { try { SE[name]?.(); } catch { /* 音は無くても遊べる */ } };

// ---- 絵（Codex・2026-11-02 採用）。寸法は絵の画素で、asset_sources/ch4-camel-race/README.md で測った値。
// ラクダは4コマ（512×384・右向き）。背の線は4コマとも1px以内で、ground の線に足元をそろえる。
// 騎手（160×160）はコブの頂点（x=260）の45px後ろの背に、鞍の底を合わせて座らせる。
// SUV（720×360）の車輪の上に、回転用の車輪（160×160・直径約140px）を 137/160 倍で重ねる。
const ART_FILES = Object.freeze({
  camel: [1, 2, 3, 4].map(i => `ui/camel_race/camel_${i}.webp`),
  jockey: "ui/camel_race/jockey.webp", suv: "ui/camel_race/suv.webp", wheel: "ui/camel_race/wheel.webp",
  track: "backgrounds/bg_dubai_camel_track_morning.webp",
});
// 奥の景色（レース場の朝の絵・1280×720）。1.25倍にして、絵の y=395（奥の柵の根元）を走路の奥の柵（y=398）にそろえ、
// レースの進み具合で 0→320px だけ横へ流す（遠景のゆっくりした流れ）。走路から手前はコードで描く砂地。
const BACKDROP = Object.freeze({ scale: 1.25, sourceGround: 395, ground: 398 });
const TRACK_TOP = 386, TRACK_BOTTOM = 612, ROAD_BOTTOM = 688, TILE_W = 640;
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
  artTask ||= Promise.all([Promise.all(ART_FILES.camel.map(load)), load(ART_FILES.jockey), load(ART_FILES.suv), load(ART_FILES.wheel), load(ART_FILES.track)])
    .then(([camel, jockey, suv, wheel, track]) => ({ camel, jockey, suv, wheel, track, ground: groundTiles() }))
    .catch(() => null);
  return artTask;
}
if (typeof Image !== "undefined" && typeof document !== "undefined") void loadCamelArt();

/** 走路の砂地と、SUV が走る道のタイル（横幅 TILE_W で左右がつながる）。蹄の跡・まだらの砂・轍を描き込む。 */
function groundTiles() {
  const random = rng(20261102);
  const tile = (height, top, bottom, paint) => {
    const canvas = document.createElement("canvas");
    canvas.width = TILE_W; canvas.height = height;
    const g = canvas.getContext("2d");
    const base = g.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, top); base.addColorStop(1, bottom);
    g.fillStyle = base; g.fillRect(0, 0, TILE_W, height);
    // 横にまたぐ描き込みは左右に2回描いて、つなぎ目を消す。
    const wrap = draw => { draw(0); draw(TILE_W); draw(-TILE_W); };
    paint(g, height, wrap);
    return canvas;
  };
  const sand = tile(TRACK_BOTTOM - TRACK_TOP, "#d9b47c", "#c2894f", (g, h, wrap) => {
    // ならした砂の筋（横）。
    for (let i = 0; i < 70; i++) {
      const y = random() * h, x = random() * TILE_W, w = 60 + random() * 220, light = random() < 0.5;
      g.fillStyle = light ? "rgba(255,236,200,0.10)" : "rgba(120,72,30,0.08)";
      wrap(o => g.fillRect(x + o, y, w, 1 + random() * 2));
    }
    // まだらの砂粒。手前ほど大きい。
    for (let i = 0; i < 2600; i++) {
      const y = random() * h, x = random() * TILE_W, r = 0.4 + (y / h) * 1.4 * random();
      g.fillStyle = random() < 0.5 ? `rgba(255,240,210,${0.18 + random() * 0.2})` : `rgba(110,64,26,${0.12 + random() * 0.18})`;
      wrap(o => { g.beginPath(); g.arc(x + o, y, r, 0, Math.PI * 2); g.fill(); });
    }
    // 蹄の跡（小さな三日月の影と縁の明るさ）。
    for (let i = 0; i < 130; i++) {
      const y = 8 + random() * (h - 12), x = random() * TILE_W, r = 1.6 + (y / h) * 3;
      wrap(o => {
        g.fillStyle = "rgba(96,54,20,0.20)"; g.beginPath(); g.ellipse(x + o, y, r * 1.5, r * 0.6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(255,232,190,0.18)"; g.beginPath(); g.ellipse(x + o + r * 0.6, y + r * 0.3, r * 1.2, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      });
    }
  });
  const road = tile(ROAD_BOTTOM - TRACK_BOTTOM, "#a98457", "#8f6b43", (g, h, wrap) => {
    for (let i = 0; i < 1400; i++) {
      const y = random() * h, x = random() * TILE_W;
      g.fillStyle = random() < 0.5 ? "rgba(255,230,190,0.16)" : "rgba(60,36,16,0.16)";
      wrap(o => g.fillRect(x + o, y, 1 + random() * 2, 1));
    }
    // 2本の轍（タイヤの跡）。
    for (const y of [h * 0.42, h * 0.78]) {
      g.fillStyle = "rgba(70,44,20,0.22)"; g.fillRect(0, y - 5, TILE_W, 10);
      for (let x = 0; x < TILE_W; x += 7) { g.fillStyle = "rgba(50,30,12,0.25)"; g.fillRect(x, y - 4, 3, 8); }
    }
  });
  return { sand, road };
}
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
  // コースの上に重ねる HUD（文字がにじまないよう HTML）。進み具合・時計と調子・スタミナと合図。
  const allCamels = [PLAYER_CAMEL, ...RIVAL_PROFILES];
  const dots = new Map(allCamels.map(camel => [camel.id, el("i.camel-dot", { dataset: { who: camel.id }, style: { "--camel-color": camel.color } })]));
  const progressNode = el("div.camel-progress", { "aria-hidden": "true" }, [el("div.camel-progress-track", [
    el("div.camel-progress-spurt", { style: { "--x": RACE.spurtFrom } }, [el("span", { text: "SPURT" })]),
    ...[0.25, 0.5].map(x => el("i.camel-progress-tick", { style: { "--x": x } })),
    el("i.camel-progress-flag"), ...dots.values(),
  ])]);
  // 画面いっぱいにコースを出し、見出し・時計・順位・ボタンはコースの上に重ねる（上下の帯でコースを狭めない）。
  // 左上: 題名と時計、上の中央: 進み具合、右上: やめる と順位（縦）、左下: 声（調子の棒つき）、右下: 合図（スタミナつき）。
  const clockTime = el("b.camel-clock-time", { text: "0:00.00" });
  const clockNode = el("div.camel-clock", { "aria-hidden": "true" }, [
    el("h1.camel-title", { text: CAMEL_RACE_TITLE }), clockTime,
    el("small.camel-clock-sub", { text: `練習 ${RACE.length.toLocaleString("ja-JP")}m・${RIVAL_PROFILES.length + 1}頭` })]);
  const rhythmBars = Array.from({ length: 5 }, () => el("i"));
  const staminaValue = el("b", { text: "100" });
  const staminaFill = el("i");
  const staminaNode = el("span.camel-stamina", { "aria-hidden": "true", dataset: { state: "ok" } }, [
    el("span.camel-stamina-bar", [staminaFill, el("span.camel-stamina-mark", { style: { "--x": PLAYER.tired / 100 } })]), staminaValue]);
  const hudNode = el("div.camel-hud", { hidden: true }, [progressNode, clockNode, standingsNode]);
  const signalCost = el("small.camel-signal-note", { text: `−${SIGNAL.cost}` });
  const voiceButton = el("button.camel-control.camel-voice", { type: "button", dataset: { test: "camel-voice", cue: "off" } }, [
    el("span.camel-control-icon", { html: ICONS.voice }),
    el("span.camel-control-text", [el("strong", { text: "声をかける" }),
      el("span.camel-rhythm", { "aria-hidden": "true" }, [el("small", { text: "調子" }), el("span.camel-rhythm-bars", rhythmBars)])]),
    el("kbd", { text: "Space" })]);
  const signalButton = el("button.camel-control.camel-signal", { type: "button", dataset: { test: "camel-signal", state: "ready" } }, [
    el("i.camel-control-cool", { "aria-hidden": "true" }),
    el("span.camel-control-icon", { html: ICONS.signal }),
    el("span.camel-control-text", [el("span.camel-signal-head", [el("strong", { text: "合図" }), signalCost]), staminaNode]),
    el("kbd", { text: "X" })]);
  const controls = el("div.camel-controls", [voiceButton, signalButton]);
  const closeButton = el("button.camel-close", { type: "button", text: "やめる", dataset: { test: "camel-close" } });
  // 助手席のサイフの声（上の中央、進み具合の下）。顔のアイコンが読めなければ名前だけ。
  const callText = el("span.camel-call-text");
  const callIcon = el("img.camel-call-icon", { src: SAIF_ICON, alt: "", onerror: event => { event.currentTarget.hidden = true; } });
  const callNode = el("div.camel-call", { "aria-hidden": "true", dataset: { test: "camel-call" } }, [callIcon, el("span.camel-call-body", [el("b", { text: "サイフ" }), callText])]);
  const flashNode = el("div.camel-flash", { "aria-hidden": "true" });
  const stageNode = el("div.camel-stage", [canvas, flashNode, hudNode, callNode, feedback, banner, countdownNode, controls, closeButton]);
  const sheet = el("div.camel-sheet", { hidden: true });
  const root = el("section.camel-game", { role: "dialog", "aria-modal": "true", "aria-label": CAMEL_RACE_TITLE, tabindex: "-1",
    dataset: { test: "camel-game", phase: "loading", reducedMotion: String(reducedMotion) } }, [stageNode, live, sheet]);
  host.append(root);

  let art = null;
  void loadCamelArt().then(value => {
    art = value;
    if (done) return;
    root.dataset.art = value ? "sprites" : "canvas";
    if (phase === "tutorial" || phase === "loading") draw();
  });
  let race = null, phase = "loading", raf = 0, last = null, goalAt = 0, feedbackTimer = 0, bannerTimer = 0, countdownLeft = 0, countdownShown = -1;
  let standingsStamp = 0, whip = 0, done = false, spurtShown = false, settleTimer = 0;
  // 演出: 画面の揺れ・ゴールのスロー・GO の柵・連続成功・サイフの声・抜いた／抜かれた。
  let shake = 0, slow = 0, goTime = -1, combo = 0, callTimer = 0, lastCallAt = -9, spurtTint = 0;
  let lastPosition = 0, leaderId = null, marks = new Set();
  // スマホではコース（1280×720）が半分ほどに縮むので、Canvas の名札・吹き出し・順位の文字だけ大きくする。
  let textScale = 1;
  const resizer = typeof ResizeObserver === "function" ? new ResizeObserver(([entry]) => {
    textScale = clamp(W / (entry.contentRect.width || W), 1, 1.6);
  }) : null;
  resizer?.observe(canvas);
  const dust = [], confetti = [], sparks = [], waves = [], floaters = [];
  const streaks = Array.from({ length: 26 }, (_, i) => ({ x: (i * 211) % W, y: 120 + ((i * 97) % 520), len: 60 + (i * 37) % 140, v: 0.7 + ((i * 13) % 10) / 12 }));
  const rivalSeed = () => (seed ?? crypto.getRandomValues(new Uint32Array(1))[0]) >>> 0;
  const pilotPolicy = typeof pilot === "function" ? pilot : pilot ? POLICIES[pilot] : null;
  if (pilot && !pilotPolicy) { active.delete(host); root.remove(); return Promise.reject(new RangeError(`Unknown pilot: ${pilot}`)); }

  const setPhase = next => {
    phase = next; root.dataset.phase = next;
    controls.hidden = next !== "race" && next !== "countdown";
    hudNode.hidden = !["countdown", "race", "goal"].includes(next);
  };
  const announce = text => { live.textContent = text; };
  const showFeedback = (text, kind, sub = "") => {
    feedback.replaceChildren(el("b", { text }), sub ? el("small", { text: sub }) : null);
    feedback.dataset.kind = kind; feedback.classList.remove("show");
    void feedback.offsetWidth; feedback.classList.add("show"); feedbackTimer = 0.75;
  };
  /** サイフの声。force でなければ前の声から少し空ける（大事な声が流れないように）。 */
  const say = (text, force = false) => {
    if (!race || (!force && race.t - lastCallAt < 2.2)) return;
    lastCallAt = race?.t ?? 0;
    callText.textContent = text;
    callNode.classList.remove("show"); void callNode.offsetWidth; callNode.classList.add("show");
    callTimer = 2.6;
  };
  const cuePoint = () => { const lane = laneOf("player"); return { x: PLAYER_SCREEN_X + CUE_AT.dx, y: lane.y + CUE_AT.dy }; };
  /** 声が当たった所から火花と波紋を飛ばす（PERFECT は金で多く、GOOD は水色で少なく、外れは灰の煙）。 */
  const burst = kind => {
    if (reducedMotion) return;
    const { x, y } = cuePoint();
    const count = kind === "perfect" ? 18 : kind === "good" ? 9 : 5;
    const color = kind === "perfect" ? [255, 214, 102] : kind === "good" ? [150, 230, 255] : [190, 170, 150];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3, v = (kind === "miss" ? 40 : 140) + Math.random() * 120;
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.55 + Math.random() * 0.25, age: 0, color, r: kind === "miss" ? 7 : 3 + Math.random() * 2.5, smoke: kind === "miss" });
    }
    if (kind !== "miss") waves.push({ x, y, r: 22, age: 0, life: kind === "perfect" ? 0.5 : 0.38, color, width: kind === "perfect" ? 6 : 4 });
  };
  const showBanner = (text, kind, seconds = 1.6) => { banner.textContent = text; banner.dataset.kind = kind; banner.classList.add("show"); bannerTimer = seconds; };

  // ---- 入力 -----------------------------------------------------------------------------------------
  const onVoice = () => {
    if (phase !== "race" || !race) return;
    const result = pressVoice(race);
    if (!result) return;
    flashButton(voiceButton, result.type);
    if (result.type === "perfect" || result.type === "good") {
      combo += 1;
      const sub = combo >= 2 ? `${combo} COMBO` : "";
      if (result.type === "perfect") { sfx("perfect"); showFeedback("PERFECT", "perfect", sub); }
      else { sfx("good"); showFeedback("GOOD", "good", sub || (result.dt > 0 ? "少し遅め" : "少し早め")); }
      burst(result.type);
      if (combo === 5 && !marks.has("combo")) { marks.add("combo"); say(CALLS.combo); }
    } else { combo = 0; sfx("miss"); showFeedback(result.spam ? "連打はダメ" : "無駄な声", "miss"); burst("miss"); }
  };
  const onSignal = () => {
    if (phase !== "race" || !race) return;
    const result = pressSignal(race);
    if (!result || result.type === "cooldown") return;
    whip = 1;
    flashButton(signalButton, result.type === "spent" ? "miss" : "boost");
    sfx("whoosh");
    if (result.type !== "spent" && !reducedMotion) {
      // 合図: 画面が揺れ、ラクダの後ろで砂が爆ぜる。
      shake = Math.max(shake, result.type === "spurt" ? 0.5 : 0.32);
      const lane = laneOf("player");
      for (let i = 0; i < 14; i++) dust.push({ x: PLAYER_SCREEN_X - 40 + Math.random() * 30, y: lane.y + 24, r: 10 + Math.random() * 14, a: 0.55, vx: -(120 + Math.random() * 160), vy: -(30 + Math.random() * 60), s: lane.scale });
    }
    if (result.type === "spent") showFeedback("空ぶかし……", "miss");
    else if (result.type === "spurt") showFeedback("スパート！", "spurt");
    else if (result.early) showFeedback("早すぎ？", "early");
    else showFeedback("加速", "boost");
  };
  const flashButton = (button, kind) => {
    button.dataset.hit = kind; button.classList.remove("hit"); void button.offsetWidth; button.classList.add("hit");
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
    resizer?.disconnect();
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
    sheet.replaceChildren(el("div.camel-card.camel-tutorial", { dataset: { test: "camel-tutorial", page: String(page) } }, [
      el("div.camel-tutorial-icon", { dataset: { kind: step.icon }, html: ICONS[step.icon] }),
      el("div.camel-tutorial-body", [
        el("p.camel-eyebrow", { text: `HOW TO PLAY  ${page + 1} / ${TUTORIAL.length}` }),
        el("h2", { text: step.title }), el("p", { text: step.body }),
        el("div.camel-steps", { "aria-hidden": "true" }, TUTORIAL.map((_, i) => el("i", { class: i === page ? "on" : null }))),
        el("div.camel-card-actions", page === TUTORIAL.length - 1 ? [next] : [next, skip]),
      ]),
    ]));
    sheet.hidden = false;
    next.focus();
  }
  function startRace() {
    sheet.hidden = true; sheet.replaceChildren();
    race = createRace({ seed: rivalSeed() });
    dust.length = 0; confetti.length = 0; sparks.length = 0; waves.length = 0; floaters.length = 0;
    whip = 0; spurtShown = false; goalAt = 0; settleTimer = 0;
    shake = 0; slow = 0; goTime = -1; combo = 0; spurtTint = 0; lastCallAt = -9; lastPosition = 0; leaderId = null; marks = new Set();
    countdownLeft = RACE.countdown; countdownShown = -1; last = null;
    setPhase("countdown");
    announce("スタートまで3秒。手前の金のゼッケンが自分のラクダ（ハビーバ）。");
    say(CALLS.intro, true);
    root.focus({ preventScroll: true });
    buildStandings();
    renderStandings();
    updateHud(true);
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
        else {
          countdownNode.textContent = "GO!"; sfx("count"); sfx("reelLever"); setPhase("race"); goTime = 0;
          announce("スタート。輪が重なったら声をかける。"); setTimeout(() => countdownNode.classList.remove("show"), 500);
          say(CALLS.go, true);
          if (!reducedMotion) {
            // 柵が上がって4頭が一斉に飛び出す: 足元から砂が爆ぜ、画面が揺れる。
            shake = 0.45;
            for (const lane of LANES) for (let i = 0; i < 10; i++) {
              dust.push({ x: PLAYER_SCREEN_X - 20 + Math.random() * 60, y: lane.y + 26 * lane.scale, r: 8 + Math.random() * 14, a: 0.6, vx: -(60 + Math.random() * 140), vy: -(20 + Math.random() * 50), s: lane.scale });
            }
          }
        }
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
      watchRace();
      if (race.finished) {
        setPhase("goal");
        goalAt = 0;
        const rank = race.rank;
        showBanner(rank === 1 ? "1着 GOAL!" : `${rank}着 GOAL`, rank === 1 ? "goal" : "goal-place", 2.6);
        sfx(rank === 1 ? "fanfare" : rank <= 3 ? "jingle" : "crowd");
        say(CALLS.finish[rank - 1] || CALLS.finish.at(-1), true);
        if (!reducedMotion) {
          // ゴールの瞬間: 白く光り、揺れ、少しのあいだスローで線を越える。
          slow = 1.1; shake = 0.4;
          flashNode.classList.remove("show"); void flashNode.offsetWidth; flashNode.classList.add("show");
          const pieces = rank === 1 ? 110 : rank <= 3 ? 60 : 0;
          const hues = rank === 1 ? [45, 50, 38, 0, 200] : [45, 30, 200, 120];
          for (let i = 0; i < pieces; i++) confetti.push({ x: W / 2 + (Math.random() - 0.5) * 900, y: -20 - Math.random() * 260, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 180, rot: Math.random() * 6, hue: hues[i % hues.length] });
        }
      }
    } else if (phase === "goal") {
      // ゴール後は見た目だけ走り続ける（モデルは止まる）。最初の約1秒はスロー。
      const rate = slow > 0 ? 0.32 : 1;
      if (slow > 0) slow -= dt;
      goalAt += dt * rate;
      if (goalAt > 2.3) openResult();
    }
    animate(dt);
    draw();
  }
  function consumeEvents() {
    for (const event of race.events) {
      if (event.kind === "voice" && event.type === "lost") { combo = 0; showFeedback("見送った……", "lost"); }
      else if (event.kind === "spurt" && !spurtShown) {
        spurtShown = true; showBanner("LAST SPURT", "spurt"); announce("ラストスパート。合図を出すなら今。");
        say(CALLS.spurt, true); sfx("slotBonus");
        if (!reducedMotion) { spurtTint = 1; shake = Math.max(shake, 0.25); }
      }
      else if (event.kind === "stamina" && event.type === "exhausted") { showBanner("息が切れた", "tired", 1.2); say(CALLS.tired, true); }
    }
    race.events.length = 0;
  }
  /** 順位の入れ替わり・先頭の交代・半分と残り100mを見て、サイフの声と「抜いた」の文字を出す。 */
  function watchRace() {
    const rows = standings(race);
    const me = rows.find(row => row.id === "player");
    // 出だしの3秒は4頭が団子なので数えない。並走で行ったり来たりしても、文字は0.8秒に1回まで。
    if (race.t < 3) { lastPosition = me.position; leaderId = rows[0].id; return; }
    // 変わった順位は、前の知らせから0.8秒たつまで持ち越す（並走の行ったり来たりをまとめる）。
    const quiet = (floaters.at(-1)?.at ?? -9) < race.t - 0.8;
    if (me.position !== lastPosition && quiet) {
      const up = me.position < lastPosition;
      const other = rows[up ? me.position : me.position - 2]; // 入れ替わった相手（自分の1つ後ろ／前）
      floaters.push({ text: up ? `${me.position}位 ▲` : `${me.position}位 ▼`, kind: up ? "up" : "down", age: 0, life: 1.3, at: race.t });
      if (up) { sfx("reelWin"); if (me.position === 1) say(CALLS.lead, true); else if (other) say(CALLS.pass(other.name)); }
      else if (other) say(CALLS.passed(other.name));
      lastPosition = me.position;
    }
    if (rows[0].id !== leaderId) {
      if (leaderId && rows[0].id !== "player") say(CALLS.leader(rows[0].name));
      leaderId = rows[0].id;
    }
    const left = race.length - race.player.distance;
    if (!marks.has("half") && race.player.distance >= race.length / 2) { marks.add("half"); say(CALLS.half); }
    if (!marks.has("last100") && left <= 100) { marks.add("last100"); say(CALLS.last100, true); }
  }
  function animate(dt) {
    if (feedbackTimer > 0 && (feedbackTimer -= dt) <= 0) feedback.classList.remove("show");
    if (bannerTimer > 0 && (bannerTimer -= dt) <= 0) banner.classList.remove("show");
    whip = Math.max(0, whip - dt * 2.4);
    shake = Math.max(0, shake - dt * 1.6);
    spurtTint = Math.max(0, spurtTint - dt * 0.8);
    if (goTime >= 0) goTime += dt;
    if (callTimer > 0 && (callTimer -= dt) <= 0) callNode.classList.remove("show");
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 1 - dt * 2;
      if (p.age >= p.life) sparks.splice(i, 1);
    }
    for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.age += dt; w.r += 220 * dt; if (w.age >= w.life) waves.splice(i, 1); }
    for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.age += dt; if (f.age >= f.life) floaters.splice(i, 1); }
    if (race && (phase === "race" || phase === "goal")) {
      standingsStamp += dt;
      if (standingsStamp > 0.25) { standingsStamp = 0; renderStandings(); }
      updateHud();
      if (!reducedMotion) {
        const boosting = race.t < race.player.boostUntil;
        for (const camel of [race.player, ...race.rivals]) {
          const lane = laneOf(camel.id);
          const sx = screenX(camel);
          if (sx < -80 || sx > W + 80) continue;
          const me = camel.id === "player", big = me && boosting ? 1.6 : 1;
          dust.push({ x: sx - 30 * lane.scale, y: lane.y + 8, r: (6 + Math.random() * 8) * big, a: 0.42, vx: -(40 + Math.random() * 40) * big, vy: -(14 + Math.random() * 18), s: lane.scale });
          // 調子がいい間（調子の棒4本以上）は、自分の足元から金の粒がこぼれる。
          if (me && phase === "race" && race.player.rhythm >= 0.75 && Math.random() < 0.6) {
            sparks.push({ x: sx - 10 + Math.random() * 40, y: lane.y + 20 + Math.random() * 12, vx: -(80 + Math.random() * 80), vy: -(20 + Math.random() * 40), life: 0.5, age: 0, color: [255, 214, 102], r: 2 + Math.random() * 1.5 });
          }
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
  // 見た目の位置（モデルはゴールで止まるが、画面では線を越えてからゆっくり速度を落として走り続ける）。
  const coast = (speed, since) => {
    if (!(since > 0)) return 0;
    const decel = 5, trot = 4, stop = Math.max(0, (speed - trot) / decel), a = Math.min(since, stop);
    return speed * a - 0.5 * decel * a * a + trot * Math.max(0, since - stop);
  };
  const afterGoal = () => (phase === "goal" || phase === "result") ? goalAt : 0;
  const viewDistance = camel => {
    if (!race) return 0;
    if (camel.finishedAt !== null) return camel.distance + coast(camel.speed, race.t + afterGoal() - camel.finishedAt);
    return camel.distance + camel.speed * afterGoal();
  };
  const screenX = camel => PLAYER_SCREEN_X + (viewDistance(camel) - viewDistance(race.player)) * PX_PER_M;
  // SUV は自分のラクダの少し前を並走する（左下・右下のボタンに隠れない画面の中央寄り）。
  const suvPosition = () => ({ x: PLAYER_SCREEN_X + 210 + Math.sin((race?.t || 0) * 1.3) * 6, y: 640 + Math.sin((race?.t || 0) * 9) * 1.5 });

  // ---- 描写 -----------------------------------------------------------------------------------------
  function draw() {
    const t = (race?.t || 0) + afterGoal();
    const camX = race ? viewDistance(race.player) : 0;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // 揺れ（GO・合図・ゴール）と、合図の間だけ自分のラクダへ少し寄る。
    if (!reducedMotion && race) {
      const amp = shake * shake * 14;
      ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
      // 揺れで画面の端が空かないよう、揺れの幅だけ少し拡大して覆う。
      const zoom = 1 + amp / 300 + whip * 0.035 + (phase === "goal" && slow > 0 ? 0.05 * Math.min(1, slow) : 0);
      if (zoom > 1) { const lane = laneOf("player"); ctx.translate(PLAYER_SCREEN_X, lane.y); ctx.scale(zoom, zoom); ctx.translate(-PLAYER_SCREEN_X, -lane.y); }
    }
    if (art) drawPaintedGround(camX);
    else drawPlainGround(camX);
    for (const lane of LANES) { ctx.fillStyle = "rgba(255,240,210,0.07)"; ctx.fillRect(0, lane.y - 2, W, 3); }
    // 柵（奥と手前）と100mごとの表示板。
    drawFence(camX, 396, 0.7);
    drawMarkers(camX);
    drawGates(camX);
    drawSpeedLines(0);
    // 砂煙（奥）。
    drawDust(0.6);
    // ラクダ（奥から手前）。
    if (race) {
      const order = LANES.map(lane => lane.id === "player" ? race.player : race.rivals.find(r => r.id === lane.id)).filter(Boolean);
      for (const camel of order) {
        const lane = laneOf(camel.id);
        const sx = screenX(camel);
        if (camel.id === "player") drawPlayerRing(sx, lane.y, lane.scale, t);
        drawCamel(sx, lane.y, lane.scale, camel, t);
      }
      drawStartBar(camX);
      drawFence(camX, 604, 1);
      drawOffscreen();
      drawSuv();
      for (const camel of order) {
        const lane = laneOf(camel.id);
        drawNameTag(screenX(camel), lane.y, lane.scale, camel);
      }
      drawDust(1);
      drawSpeedLines(1);
      drawLight();
      drawCue();
      drawEffects();
      drawConfetti();
    } else { drawFence(camX, 604, 1); drawSuv(); drawLight(); }
    ctx.restore();
  }
  /** 絵の背景: 奥の景色をゆっくり流し、走路・道・手前の砂地をタイルで速く流す。 */
  function drawPaintedGround(camX) {
    const progress = race ? clamp(camX / race.length, 0, 1) : 0;
    const width = W * BACKDROP.scale, height = H * BACKDROP.scale;
    const pan = -(width - W) * progress;
    const top = BACKDROP.ground - BACKDROP.sourceGround * BACKDROP.scale;
    ctx.drawImage(art.track, pan, top, width, height);
    const scroll = ((camX * PX_PER_M) % TILE_W + TILE_W) % TILE_W;
    const strip = (tile, y) => { for (let x = -scroll; x < W; x += TILE_W) ctx.drawImage(tile, x, y); };
    // 奥の柵の根元へ、走路の砂をぼかしてつなぐ。
    ctx.save();
    const fade = ctx.createLinearGradient(0, TRACK_TOP - 14, 0, TRACK_TOP + 12);
    fade.addColorStop(0, "rgba(217,180,124,0)"); fade.addColorStop(1, "rgba(217,180,124,1)");
    ctx.fillStyle = fade; ctx.fillRect(0, TRACK_TOP - 14, W, 26);
    ctx.restore();
    strip(art.ground.sand, TRACK_TOP);
    strip(art.ground.road, TRACK_BOTTOM);
    // 道より手前の砂（少し暗く、ぼかし気味）。
    strip(art.ground.sand, ROAD_BOTTOM);
    ctx.fillStyle = "rgba(90,52,22,0.28)"; ctx.fillRect(0, ROAD_BOTTOM, W, H - ROAD_BOTTOM);
    // 遠くの走路ほど薄い霞。
    const haze = ctx.createLinearGradient(0, TRACK_TOP, 0, TRACK_TOP + 90);
    haze.addColorStop(0, "rgba(255,226,170,0.35)"); haze.addColorStop(1, "rgba(255,226,170,0)");
    ctx.fillStyle = haze; ctx.fillRect(0, TRACK_TOP, W, 90);
  }
  /** 絵が読めないときの背景（空・砂丘・平らな地面）。 */
  function drawPlainGround(camX) {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, "#1f3a66"); sky.addColorStop(0.55, "#6f9ad0"); sky.addColorStop(1, "#f3d9a7");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON + 2);
    ctx.fillStyle = "rgba(255, 236, 190, 0.95)"; ctx.beginPath(); ctx.arc(1040, 150, 46, 0, Math.PI * 2); ctx.fill();
    drawDunes(camX * 0.08, HORIZON - 40, 90, "#c9a56a", 0.9);
    drawDunes(camX * 0.22 + 400, HORIZON - 6, 60, "#dbb77c", 1);
    const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
    ground.addColorStop(0, "#e2c48c"); ground.addColorStop(0.45, "#d9b67a"); ground.addColorStop(1, "#c79d5f");
    ctx.fillStyle = ground; ctx.fillRect(0, HORIZON, W, H - HORIZON);
    ctx.fillStyle = "#cfa86a"; ctx.fillRect(0, 400, W, 200);
    ctx.fillStyle = "#a88a5c"; ctx.fillRect(0, TRACK_BOTTOM, W, ROAD_BOTTOM - TRACK_BOTTOM);
    ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, 648, W, 2);
  }
  /** 朝の光: 左（太陽の側）から暖かい光、四隅を少し落とす。 */
  function drawLight() {
    ctx.save();
    const warm = ctx.createLinearGradient(0, 0, W, 0);
    warm.addColorStop(0, "rgba(255,170,80,0.16)"); warm.addColorStop(0.45, "rgba(255,190,110,0.04)"); warm.addColorStop(1, "rgba(80,60,120,0.06)");
    ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    const vignette = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.45, W / 2, H * 0.55, H * 0.95);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(30,14,4,0.32)");
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.restore();
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
  /** 白い管の柵。支柱は砂に右下へ影を落とし、手すりは上が明るく下が陰る。 */
  function drawFence(camX, y, scale) {
    const spacing = 5 * PX_PER_M;
    const start = -((camX * PX_PER_M - PLAYER_SCREEN_X) % spacing) - spacing;
    const postH = 22 * scale, postW = 4 * scale, top = y - postH;
    ctx.save();
    ctx.fillStyle = "rgba(70,40,15,0.22)";
    for (let x = start; x < W + spacing; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + postW, y); ctx.lineTo(x + postW + 16 * scale, y + 5 * scale); ctx.lineTo(x + 16 * scale, y + 5 * scale); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = "rgba(70,40,15,0.18)"; ctx.fillRect(0, y + 2, W, 3 * scale);
    for (let x = start; x < W + spacing; x += spacing) {
      const post = ctx.createLinearGradient(x, 0, x + postW, 0);
      post.addColorStop(0, "#fffaf0"); post.addColorStop(1, "#c9c0ae");
      ctx.fillStyle = post; ctx.fillRect(x, top, postW, postH);
    }
    const rail = ctx.createLinearGradient(0, top - 3 * scale, 0, top + 4 * scale);
    rail.addColorStop(0, "#fffdf6"); rail.addColorStop(0.55, "#efe8da"); rail.addColorStop(1, "#b9ae98");
    ctx.fillStyle = rail; ctx.fillRect(0, top - 3 * scale, W, 7 * scale);
    ctx.fillStyle = "rgba(255,190,110,0.35)"; ctx.fillRect(0, top - 3 * scale, W, 1);
    ctx.restore();
  }
  function drawMarkers(camX) {
    ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
    for (let m = 100; m < race?.length || 0; m += 100) {
      const sx = PLAYER_SCREEN_X + (m - camX) * PX_PER_M;
      if (sx < -40 || sx > W + 40) continue;
      ctx.fillStyle = "rgba(70,40,15,0.22)"; ctx.fillRect(sx + 1, 394, 14, 3);
      ctx.fillStyle = "#e9e3d6"; ctx.fillRect(sx - 1, 352, 3, 44);
      ctx.fillStyle = "#b8322c"; ctx.fillRect(sx - 22, 342, 44, 24);
      ctx.fillStyle = "#fffaf0"; ctx.fillRect(sx - 19, 345, 38, 18);
      ctx.fillStyle = "#2a1d14"; ctx.fillText(String(m), sx, 359);
    }
  }
  function drawGates(camX) {
    for (const [m, label, color] of [[0, "START", "#8ee6a8"], [race?.length || RACE.length, "FINISH", "#ffb347"]]) {
      const sx = PLAYER_SCREEN_X + (m - camX) * PX_PER_M;
      if (sx < -120 || sx > W + 120) continue;
      ctx.save();
      // 柱（奥と手前の2本）と影。
      ctx.fillStyle = "rgba(70,40,15,0.25)"; ctx.fillRect(sx - 4, 606, 34, 6);
      for (const [px, top, bottom] of [[sx - 10, 270, 398], [sx - 4, 270, 610]]) {
        const post = ctx.createLinearGradient(px, 0, px + 9, 0);
        post.addColorStop(0, "#fffaf0"); post.addColorStop(1, "#bdb3a0");
        ctx.fillStyle = post; ctx.fillRect(px, top, 9, bottom - top);
      }
      // 横断幕。ゴールは上下に市松の帯。
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(sx - 80, 260, 164, 42);
      ctx.fillStyle = color; ctx.fillRect(sx - 84, 254, 168, 40);
      if (m > 0) for (let i = 0; i < 21; i++) for (const row of [0, 1]) {
        ctx.fillStyle = (i + row) % 2 ? "#1a120c" : "#fffaf0"; ctx.fillRect(sx - 84 + i * 8, row ? 290 : 254, 8, 4);
      }
      ctx.fillStyle = "#1a120c"; ctx.font = "900 22px sans-serif"; ctx.textAlign = "center"; ctx.fillText(label, sx, 282);
      ctx.restore();
    }
  }
  /** 絵のラクダ（4コマ）とロボット騎手。足元を ground の線に、騎手をコブの後ろにそろえる。 */
  function drawCamelSprite(x, y, s, camel, t) {
    const k = s * CAMEL_ART.scale;
    const frame = camel.speed > 1 ? Math.floor((viewDistance(camel) / CAMEL_ART.stride) * 4) % 4 : 0;
    const image = art.camel[(frame + 4) % 4];
    const dx = x - CAMEL_ART.centerX * k, dy = y + 30 * s - CAMEL_ART.ground * k;
    const me = camel.id === "player";
    ctx.save();
    ctx.fillStyle = "rgba(70,38,12,0.28)"; ctx.beginPath(); ctx.ellipse(x + 22 * s, y + 31 * s, 66 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
    // 合図で加速している間は、自分のラクダの後ろに残像を2つ。
    if (me && !reducedMotion && race && race.t < race.player.boostUntil && phase === "race") {
      for (const [back, alpha] of [[46, 0.16], [24, 0.28]]) { ctx.globalAlpha = alpha; ctx.drawImage(image, dx - back * s, dy, image.width * k, image.height * k); }
      ctx.globalAlpha = 1;
    }
    if (!me && RIVAL_TINT[camel.id]) ctx.filter = RIVAL_TINT[camel.id];
    ctx.drawImage(image, dx, dy, image.width * k, image.height * k);
    ctx.filter = "none";
    drawCloth(dx, dy, k, camel);
    // 騎手: 鞍の底を背に合わせ、合図の間だけ前後に揺らす（自分のラクダ）。
    const jk = k * JOCKEY_ART.scale;
    const sx = dx + CAMEL_ART.seatX * k, sy = dy + CAMEL_ART.seatY * k;
    const swing = me ? Math.sin(whip * Math.PI * 3) * whip * 0.28 : Math.sin(t * 6 + x) * 0.04;
    ctx.translate(sx, sy); ctx.rotate(-swing);
    ctx.drawImage(art.jockey, -JOCKEY_ART.cx * jk, -JOCKEY_ART.bottom * jk, art.jockey.width * jk, art.jockey.height * jk);
    ctx.restore();
  }
  /** 名札。AI はゼッケンと同じ色の丸と名前を小さく、自分は金の札に今の順位を大きく（手前の柵より上に描く）。 */
  function drawNameTag(x, y, s, camel) {
    if (x < -80 || x > W + 80) return;
    const me = camel.id === "player";
    // 出だしは4頭が重なるので、AI の名札はゼッケンだけにする（自分の札は出す）。
    if (!me && (phase === "countdown" || (race && race.t < 2.5))) return;
    // スマホで大きくした分だけ札を上げ、下の「声をかける」ボタンに隠れないようにする。
    const zoom = Math.min(textScale, me ? 1.4 : 1.3);
    ctx.save(); ctx.translate(x, y + 36 * s - (me ? (zoom - 1) * 50 : 0)); ctx.scale(zoom, zoom); ctx.textBaseline = "middle";
    if (me) {
      const position = race ? standings(race).find(row => row.id === "player").position : 1;
      const name = `★ ${camel.name}`, rank = `${position}位`;
      ctx.font = "900 15px sans-serif"; const nameW = ctx.measureText(name).width;
      ctx.font = "900 17px sans-serif"; const rankW = ctx.measureText(rank).width;
      const w = nameW + rankW + 34, h = 26;
      ctx.fillStyle = "rgba(60,30,4,0.55)"; ctx.beginPath(); ctx.roundRect(-w / 2 + 2, 3, w, h, 13); ctx.fill();
      ctx.fillStyle = "#ffcf5a"; ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, h, 13); ctx.fill();
      ctx.strokeStyle = "#7a4a08"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#3a2006"; ctx.beginPath(); ctx.roundRect(w / 2 - rankW - 16, 3, rankW + 13, h - 6, 10); ctx.fill();
      ctx.font = "900 15px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#3a2006"; ctx.fillText(name, -w / 2 + 11, h / 2 + 1);
      ctx.font = "900 17px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#ffe27a"; ctx.fillText(rank, w / 2 - rankW / 2 - 9.5, h / 2 + 1);
    } else {
      ctx.globalAlpha = 0.85;
      ctx.font = "bold 12px sans-serif";
      const w = ctx.measureText(camel.name).width + 22, h = 18;
      ctx.fillStyle = "rgba(20,12,6,0.66)"; ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, h, 9); ctx.fill();
      ctx.fillStyle = camel.color; ctx.beginPath(); ctx.arc(-w / 2 + 9, h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff6e5"; ctx.textAlign = "center"; ctx.fillText(camel.name, 5, h / 2 + 0.5);
    }
    ctx.restore();
  }
  /** ゼッケン: 鞍の下の脇腹に掛けた布。色は順位の札と同じ。自分は金に★、AI は番号。 */
  function drawCloth(dx, dy, k, camel) {
    const me = camel.id === "player";
    const pts = CLOTH.corners.map(([px, py]) => [dx + px * k, dy + py * k]);
    ctx.save();
    ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath();
    ctx.fillStyle = camel.color; ctx.fill();
    ctx.lineWidth = Math.max(1.2, 9 * k); ctx.strokeStyle = me ? "#fff3c4" : "rgba(255,250,240,0.85)"; ctx.stroke();
    ctx.lineWidth = Math.max(0.8, 3 * k); ctx.strokeStyle = "rgba(40,20,6,0.6)"; ctx.stroke();
    // 布の下半分に影（2段）。
    ctx.clip(); ctx.fillStyle = "rgba(40,20,6,0.18)"; ctx.fillRect(dx + 150 * k, dy + 186 * k, 120 * k, 40 * k);
    ctx.restore();
    ctx.save();
    const [lx, ly] = [dx + CLOTH.label[0] * k, dy + CLOTH.label[1] * k];
    ctx.font = `900 ${Math.round(Math.max(10, 44 * k))}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, 8 * k); ctx.strokeStyle = me ? "#7a2a06" : "rgba(20,12,6,0.75)";
    const label = me ? "★" : String(camel.index + 1);
    ctx.strokeText(label, lx, ly); ctx.fillStyle = me ? "#fff6d8" : "#ffffff"; ctx.fillText(label, lx, ly);
    ctx.restore();
  }
  /** 自分のラクダの足元の金の輪（脈打つ）。いちばん先に描いて、ラクダの下に敷く。 */
  function drawPlayerRing(x, y, s, t) {
    const pulse = reducedMotion ? 0.5 : (Math.sin(t * 5) + 1) / 2;
    const cx = x + 22 * s, cy = y + 31 * s, rx = 84 * s, ry = 14 * s;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    glow.addColorStop(0, "rgba(255,214,102,0.34)"); glow.addColorStop(0.7, "rgba(255,190,70,0.16)"); glow.addColorStop(1, "rgba(255,190,70,0)");
    ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = (3 + pulse * 2) * (rx / ry) * 0.5; ctx.strokeStyle = `rgba(255,214,102,${0.65 + pulse * 0.3})`;
    ctx.beginPath(); ctx.arc(cx, cy, rx * (0.92 + pulse * 0.06), 0, Math.PI * 2); ctx.stroke();
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
    ctx.fillStyle = camel.color; ctx.fillRect(-32, -22, 26, 8);
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
    ctx.restore();
  }
  function drawOffscreen() {
    for (const rival of race.rivals) {
      const sx = screenX(rival);
      if (sx >= -40 && sx <= W + 40) continue;
      const lane = laneOf(rival.id), right = sx > W;
      ctx.fillStyle = rival.color; ctx.beginPath();
      const ax = right ? W - 22 : 22;
      ctx.moveTo(ax + (right ? 12 : -12), lane.y); ctx.lineTo(ax, lane.y - 10); ctx.lineTo(ax, lane.y + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff6e5"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = right ? "right" : "left";
      ctx.fillText(`${rival.name} ${right ? "+" : "-"}${Math.abs(Math.round(viewDistance(rival) - viewDistance(race.player)))}m`, right ? W - 40 : 40, lane.y + 4);
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
    const angle = ((race ? viewDistance(race.player) : 0) * PX_PER_M) / (SUV_ART.radius * k);
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
      const r = puff.r * puff.s, a = Math.max(0, puff.a);
      const glow = ctx.createRadialGradient(puff.x, puff.y, 0, puff.x, puff.y, r);
      glow.addColorStop(0, `rgba(238, 210, 160, ${a})`); glow.addColorStop(0.6, `rgba(222, 186, 132, ${a * 0.55})`); glow.addColorStop(1, "rgba(222, 186, 132, 0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(puff.x, puff.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  /** 自分のラクダの頭の上: 輪が出ていない間は金の▼（自分の目印）、輪が出たら声かけの輪。 */
  function drawCue() {
    if (phase !== "race" && phase !== "countdown") return;
    const cue = phase === "race" ? activeCue(race) : null;
    const { x: cx, y: cy } = cuePoint();
    const t = race?.t || 0;
    if (!cue) {
      const bob = reducedMotion ? 0 : Math.sin(t * 6) * 4;
      ctx.save(); ctx.translate(cx, cy - 44 + bob);
      ctx.fillStyle = "rgba(60,30,4,0.45)"; ctx.beginPath(); ctx.moveTo(-15, -9); ctx.lineTo(17, -9); ctx.lineTo(1, 13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffcf5a"; ctx.strokeStyle = "#7a4a08"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(16, -12); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      // スタート前と出だしは「これがあなたのラクダ」の吹き出し。
      if (phase === "countdown" || t < 1.5) {
        const text = "あなたのラクダ  ハビーバ";
        ctx.save(); ctx.translate(cx, cy - 64); ctx.scale(textScale, textScale);
        ctx.font = "900 18px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const w = ctx.measureText(text).width + 32, h = 34, by = -22;
        ctx.fillStyle = "#ffcf5a"; ctx.strokeStyle = "#7a4a08"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(-w / 2, by - h / 2, w, h, 17); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#3a2006"; ctx.fillText(text, 0, by + 1); ctx.restore();
      }
      return;
    }
    // 内側の目標の輪。
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,245,220,0.95)";
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
    const progress = clamp(cue.progress, 0, 1.3);
    const radius = 20 + (1 - Math.min(progress, 1)) * 44;
    const late = cue.dt > 0;
    ctx.lineWidth = 5; ctx.strokeStyle = late ? `rgba(255,120,120,${clamp(1 - cue.dt / CUE.good, 0, 1)})` : "rgba(255, 210, 110, 0.95)";
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    if (Math.abs(cue.dt) <= CUE.perfect) { ctx.fillStyle = "rgba(255,230,160,0.35)"; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill(); }
  }
  /** スタートの柵: 走路を横切る赤白の棒。GO で上へ跳ね上がる。 */
  function drawStartBar(camX) {
    const sx = PLAYER_SCREEN_X + (0 - camX) * PX_PER_M + 92;
    if (sx < -60 || sx > W + 60) return;
    const lift = goTime < 0 ? 0 : Math.min(1, goTime / 0.45);
    const rise = (1 - (1 - lift) ** 3) * 300;
    if (rise >= 300) return;
    ctx.save(); ctx.globalAlpha = 1 - lift * 0.6;
    const top = 398 - rise, bottom = 600 - rise, slant = 26;
    // 奥から手前へ少し傾けた棒（手前ほど右）。赤白の縞。
    const len = Math.hypot(slant, bottom - top), angle = Math.atan2(bottom - top, slant);
    ctx.translate(sx - slant / 2, top); ctx.rotate(angle);
    for (let i = 0; i < len; i += 22) { ctx.fillStyle = (i / 22) % 2 ? "#fffaf0" : "#c8302a"; ctx.fillRect(i, -5, Math.min(22, len - i), 10); }
    ctx.strokeStyle = "rgba(40,20,6,0.55)"; ctx.lineWidth = 1.5; ctx.strokeRect(0, -5, len, 10);
    ctx.restore();
  }
  /** 速さの線: 自分の速さ・合図・スパートで濃く、数を増やす。layer 0 は奥（空と柵の上）、1 は手前。 */
  function drawSpeedLines(layer) {
    if (reducedMotion || !race || phase !== "race") return;
    const boosting = race.t < race.player.boostUntil;
    const fast = clamp((race.player.speed - 17) / 5, 0, 1);
    const power = clamp(fast * 0.55 + (boosting ? 0.5 : 0) + (inSpurt(race) ? 0.3 : 0), 0, 1);
    if (power < 0.08) return;
    const move = viewDistance(race.player) * PX_PER_M;
    ctx.save();
    ctx.lineCap = "round";
    streaks.forEach((line, i) => {
      if ((i % 2) !== layer || i / streaks.length > 0.35 + power * 0.65) return;
      const y = layer ? 600 + (line.y % 110) : 140 + (line.y % 250);
      const x = W - ((line.x + move * line.v * 1.6) % (W + 300));
      const len = line.len * (0.6 + power);
      const g = ctx.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, "rgba(255,248,230,0)"); g.addColorStop(1, `rgba(255,248,230,${0.25 + power * 0.45})`);
      ctx.strokeStyle = g; ctx.lineWidth = layer ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
    });
    ctx.restore();
  }
  /** 火花・波紋・「抜いた」の文字・スパートの色。 */
  function drawEffects() {
    ctx.save();
    for (const w of waves) {
      const k = 1 - w.age / w.life;
      ctx.strokeStyle = `rgba(${w.color.join(",")},${k * 0.9})`; ctx.lineWidth = w.width * k + 1;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of sparks) {
      const k = 1 - p.age / p.life;
      ctx.fillStyle = p.smoke ? `rgba(${p.color.join(",")},${k * 0.45})` : `rgba(${p.color.join(",")},${k})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.smoke ? p.r * (1.5 - k) * 2 : p.r * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    const lane = laneOf("player");
    for (const f of floaters) {
      const k = f.age / f.life, up = f.kind === "up";
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      ctx.font = `900 ${Math.round(30 * textScale)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const y = lane.y - 60 - k * 40;
      ctx.lineWidth = 6; ctx.strokeStyle = up ? "#0c3a18" : "#4a0c0c"; ctx.strokeText(f.text, PLAYER_SCREEN_X + 150, y);
      ctx.fillStyle = up ? "#9dffb4" : "#ff9a9a"; ctx.fillText(f.text, PLAYER_SCREEN_X + 150, y);
    }
    ctx.globalAlpha = 1;
    if (spurtTint > 0 || (race && inSpurt(race) && phase === "race")) {
      // スパート区間は画面の縁を赤みの夕日色に。入った瞬間は強く。
      const strength = 0.24 + spurtTint * 0.28;
      const edge = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95);
      edge.addColorStop(0, "rgba(255,120,40,0)"); edge.addColorStop(1, `rgba(255,96,32,${strength})`);
      ctx.fillStyle = edge; ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();
  }
  function drawConfetti() {
    for (const piece of confetti) {
      ctx.save(); ctx.translate(piece.x, piece.y); ctx.rotate(piece.rot); ctx.fillStyle = `hsl(${piece.hue} 85% 65%)`; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
    }
  }
  const chips = new Map();
  /** 順位表の4枚の札を作る（以後は並び順だけ変えて、入れ替わりを滑らせる）。 */
  function buildStandings() {
    chips.clear();
    standingsNode.replaceChildren(...[race.player, ...race.rivals].map(camel => {
      const chip = el("li", { dataset: { who: camel.id, test: camel.id === "player" ? "camel-standing-player" : null }, style: { "--camel-color": camel.color } }, [
        el("b.camel-rank-badge"), el("span.camel-chip-name", { text: camel.id === "player" ? `★ ${camel.name}` : camel.name }), el("small.camel-chip-gap")]);
      chips.set(camel.id, chip);
      return chip;
    }));
  }
  function renderStandings() {
    const rows = standings(race);
    const leader = rows[0];
    for (const row of rows) {
      const chip = chips.get(row.id);
      if (!chip) continue;
      const before = Number(chip.dataset.pos || 0);
      chip.style.setProperty("--pos", String(row.position - 1));
      chip.dataset.pos = String(row.position);
      chip.querySelector(".camel-rank-badge").textContent = String(row.position);
      chip.querySelector(".camel-chip-gap").textContent = row.finishedAt !== null ? "GOAL"
        : row.position === 1 ? "TOP" : `−${Math.max(0, Math.round(leader.distance - row.distance))}m`;
      if (before && before !== row.position) {
        chip.dataset.move = row.position < before ? "up" : "down";
        clearTimeout(chip.moveTimer);
        chip.moveTimer = setTimeout(() => { delete chip.dataset.move; }, 900);
      }
    }
  }
  const hudCache = {};
  const setOnce = (key, value, apply) => { if (hudCache[key] !== value) { hudCache[key] = value; apply(value); } };
  /** HUD を今のレースに合わせる（変わった所だけ書き換える）。 */
  function updateHud(force = false) {
    if (!race) return;
    if (force) for (const key of Object.keys(hudCache)) delete hudCache[key];
    for (const camel of [race.player, ...race.rivals]) {
      setOnce(`dot-${camel.id}`, Math.round(clamp(camel.distance / race.length, 0, 1) * 1000) / 1000, x => dots.get(camel.id)?.style.setProperty("--x", String(x)));
    }
    setOnce("time", fmtTime(race.t), text => { clockTime.textContent = text; });
    const lit = Math.round(race.player.rhythm * 5);
    setOnce("rhythm", lit, n => rhythmBars.forEach((bar, i) => bar.classList.toggle("on", i < n)));
    const stamina = Math.round(race.player.stamina);
    setOnce("stamina", stamina, v => { staminaValue.textContent = String(v); staminaFill.style.setProperty("--v", String(v / 100)); });
    setOnce("staminaState", stamina < PLAYER.spent ? "spent" : stamina < PLAYER.tired ? "tired" : "ok", state => { staminaNode.dataset.state = state; signalButton.dataset.stamina = state; });
    const cooldown = Math.max(0, race.player.cooldownUntil - race.t);
    const spurt = inSpurt(race);
    const state = stamina < PLAYER.spent ? "spent" : cooldown > 0 ? "cooling" : spurt ? "spurt" : "ready";
    setOnce("signal", state, value => { signalButton.dataset.state = value; });
    setOnce("cool", Math.round((cooldown / SIGNAL.cooldown) * 50) / 50, v => signalButton.style.setProperty("--cool", String(v)));
    // 合図の横の小さな字: 使える時は消費（スパート区間は明記）、待ち時間、息切れ。
    setOnce("signalNote", state === "cooling" ? `あと${Math.ceil(cooldown)}秒` : state === "spent" ? "息切れ"
      : spurt ? `スパート −${SIGNAL.spurtCost}` : `−${SIGNAL.cost}`, text => { signalCost.textContent = text; });
    setOnce("cue", phase === "race" && activeCue(race) ? "on" : "off", v => { voiceButton.dataset.cue = v; });
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
    // 点数は0から数え上げ、評価の判子を押す（動きを減らす設定ではすぐ出す）。
    const totalNode = el("strong", { text: String(score.total) });
    if (!reducedMotion) {
      const started = performance.now(), shownRun = runs.length;
      totalNode.textContent = "0";
      const count = now => {
        if (done || runs.length !== shownRun || phase !== "result") return;
        const k = Math.min(1, (now - started - 300) / 900);
        totalNode.textContent = String(Math.round(Math.max(0, k) ** 0.6 * score.total));
        if (k < 1) requestAnimationFrame(count);
      };
      requestAnimationFrame(count);
      setTimeout(() => { if (!done && runs.length === shownRun && phase === "result") sfx("stamp"); }, 1050);
    }
    const again = el("button.btn.primary", { type: "button", text: "もう一度", dataset: { test: "camel-retry" }, onclick: () => startRace() });
    const leave = el("button.btn", { type: "button", text: "終える", dataset: { test: "camel-finish" }, onclick: () => cleanup(true) });
    sheet.replaceChildren(el("div.camel-card.camel-result", { dataset: { test: "camel-result", rank: String(score.rank), grade: score.grade, total: String(score.total) } }, [
      el("p.camel-eyebrow", { text: "RESULT" }),
      el("div.camel-result-head", [
        el("div.camel-medal", { dataset: { rank: String(score.rank) } }, [el("strong", { text: String(score.rank) }), el("span", { text: "位" })]),
        el("div.camel-result-score", [
          el("p.camel-time", { text: `TIME ${fmtTime(score.time)}` }),
          el("p.camel-total", [el("small", { text: "SCORE" }), totalNode, el("small", { text: "/ 100" })]),
        ]),
        el("div.camel-grade-letter", { dataset: { grade: score.grade } }, [el("small", { text: "評価" }), el("strong", { text: score.grade })]),
      ]),
      bar("順位", score.parts.rank, 40), bar("声かけ", score.parts.timing, 35), bar("スタミナ", score.parts.stamina, 25),
      el("ul.camel-stats", [["PERFECT", score.stats.perfect], ["GOOD", score.stats.good], ["見送り", score.stats.lost],
        ["無駄な声", score.stats.miss], ["連打", score.stats.spam], ["合図", `${score.stats.signals}（スパート${score.stats.spurtSignals}）`]]
        .map(([label, value]) => el("li", [el("small", { text: label }), el("b", { text: String(value) })]))),
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
