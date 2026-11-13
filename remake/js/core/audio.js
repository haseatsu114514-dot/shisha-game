// 音。BGM は実ファイル（assets/audio/bgm）を優先し、まだ無い曲（大会など）は
// WebAudio で代用する。手元・UIのSEは録音を優先し、未読込・取得失敗時は合成で補う。
import { config } from "./state.js";
import { bgmUrl } from "./data.js";

let ctx = null;
let master = null;
let seBus = null;
let bgmBus = null;
let audioUnlocked = false;
let lastPhoneReceiveAt = -Infinity;
let rainMode = null;
let rainLoop = null;
let rainBuffer = null;
let noiseBuffer = null;
let bgmDuck = 1;
let bgmPaused = false;
let bgmSilences = 0;
const seBuffers = new Map();
const seLoads = new Map();
const seRetryAt = new Map();
const seVoices = new Set();
const activePulls = new Set();
const lastVariant = new Map();
const SE_ROOT = "../assets/audio/se/";
const RECORDED_SE = {
  click: { files: ["ui_click.wav"], gain: .3 },
  select: { files: ["ui_select.wav"], gain: .3 },
  cancel: { files: ["ui_back.wav"], gain: .3 },
  whoosh: { files: ["ui_whoosh.wav"], gain: .35 },
  jingle: { files: ["ui_jingle.wav"], gain: .4 },
  card: { files: ["ui_card.wav"], gain: .35 },
  phone: { files: ["lime_glass.wav"], gain: .4 },
  doorbell: { files: ["shop_bell.wav"], gain: 1 },
  coalSnip: { files: ["coal_grab_01.wav", "coal_grab_02.wav"], gain: 1 },
  coalPlace: { files: ["hms_knock_01.wav", "hms_knock_02.wav"], gain: 1 },
  foilPunch: { files: ["foil_puncture.wav"], gain: 1 },
  bubbling: { files: ["water_draw.wav"], gain: 1 },
  // 2026-11-11 本編の効果音 第1弾（CC0・OpenGameArt）。出典・切り出し・再生成は asset_sources/music/main-se-20261111/。
  // 耳での確認はオーナーの試聴待ち（remake/audio-preview.html で前の合成音と聴き比べられる）。合わない音はこの行を消せば合成音へ戻る。
  // fit: 呼び出しの秒数（SE.crowd(1.6) など）に合わせ、その後 fit 秒で消す。
  // minGap: この秒数のうちに続けて呼ばれた分は鳴らさない（所持金の増減と店の売り買いが同時にコインを呼んでも1回）。
  crowd: { files: ["crowd_applause_01.mp3", "crowd_applause_02.mp3"], gain: 1, fit: .7 },
  money: { files: ["coin_01.wav", "coin_02.wav"], gain: 1, minGap: .25 },
  parin: { files: ["glass_break.wav"], gain: 1 },
  shutter: { files: ["camera_shutter.wav"], gain: 1 },
  mew: { files: ["cat_mew_01.wav", "cat_mew_02.wav"], gain: 1 },
  crackle: { files: ["fire_crackle_01.wav", "fire_crackle_02.wav", "fire_crackle_03.wav"], gain: 1 },
  affinity: { files: ["heart_bell.wav"], gain: 1 },
  save: { files: ["ui_save.wav"], gain: 1 },
  // 2026-11-13 第2弾（同じ台帳）。扉＝地図から店へ入る時、get＝手に入れた通知、birds＝晴れた朝、page＝レシピ帳・メモ（TRPGのページめくりと同じ録音）。
  door: { files: ["door_open.wav"], gain: 1 },
  get: { files: ["item_get.wav"], gain: 1, minGap: .25 },
  birds: { files: ["morning_birds.mp3"], gain: 1 },
  page: { files: ["trpg/page_flip_01.wav", "trpg/page_flip_02.wav"], gain: 1, minGap: .25 },
};
const WATER_LOOP = "water_loop.wav", WATER_END = "water_end.wav";

const seEnabled = () => audioUnlocked && ctx?.state === "running" && !document.hidden
  && !config.mute && !config.muted && Number(config.seVolume) > 0;

function loadSeBuffer(file) {
  if (seBuffers.has(file)) return Promise.resolve(seBuffers.get(file));
  if (!ctx?.decodeAudioData || typeof fetch !== "function" || Date.now() < (seRetryAt.get(file) || 0)) return Promise.resolve(null);
  if (!seLoads.has(file)) {
    const load = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const url = SE_ROOT + file;
        const response = await fetch(file.endsWith(".bgm") ? await bgmSource(url) : url, { signal: controller.signal });
        if (!response.ok) throw new Error(`SE HTTP ${response.status}`);
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        seBuffers.set(file, buffer);
        return buffer;
      } catch {
        seRetryAt.set(file, Date.now() + 30000);
        return null;
      } finally {
        clearTimeout(timer);
        seLoads.delete(file);
      }
    })();
    seLoads.set(file, load);
  }
  return seLoads.get(file);
}

const allSeFiles = () => [...new Set([...Object.values(RECORDED_SE).flatMap(s => s.files), WATER_LOOP, WATER_END])];
// 最初の操作の直後に要る画面操作の音（タイトル・メニュー・保存）。残りは1本ずつ読む（#3500 D-1）。
const FIRST_SE = ["click", "select", "cancel", "whoosh", "jingle", "card", "save"];
let seWarm = null;

/** 録音SEを全部、今すぐ読む（音の確認ページ・検査用）。全部読めたら true。 */
export function preloadSe() {
  if (!audioUnlocked) return Promise.resolve(false);
  return Promise.all(allSeFiles().map(loadSeBuffer)).then(buffers => buffers.every(Boolean));
}

/**
 * 最初の操作で先読み。ゲーム進行は待たせず、最初の未読込SEは合成で補う。
 * 29本を一度に取りに行くと、同じ時に始まる BGM・場面の素材と回線とデコードを取り合う（遅い回線では5秒の打ち切りで半分ほどが落ちていた）。
 * 画面操作の数本を先に読み、残りは手の空いた時に1本ずつ読む。読み終わる前に鳴らした音は、今までどおりその場で読みに行く。
 */
function warmSe() {
  if (!audioUnlocked || seWarm) return;
  const first = FIRST_SE.flatMap(id => RECORDED_SE[id].files);
  const rest = allSeFiles().filter(file => !first.includes(file));
  const idle = () => typeof requestIdleCallback === "function" ? new Promise(resolve => requestIdleCallback(resolve, { timeout: 1000 })) : null;
  seWarm = Promise.all(first.map(loadSeBuffer)).then(async () => {
    for (const file of rest) {
      if (seBuffers.has(file)) continue;
      await idle();
      await loadSeBuffer(file);
    }
  }).finally(() => { seWarm = null; });
}

function recordedVoice(file, { gain = 1, rate = 1, loop = false, delay = 0 } = {}) {
  if (!seEnabled() || !seBuffers.has(file)) return null;
  const source = ctx.createBufferSource(), output = ctx.createGain();
  source.buffer = seBuffers.get(file);
  source.loop = loop;
  source.playbackRate.value = rate;
  output.gain.setValueAtTime(loop ? 0 : gain, ctx.currentTime);
  if (loop) output.gain.linearRampToValueAtTime(gain, ctx.currentTime + .04);
  source.connect(output).connect(seBus);
  const voice = { source, output, stop(fade = 0) {
    if (!seVoices.has(voice)) return;
    output.gain.cancelScheduledValues(ctx.currentTime);
    output.gain.setValueAtTime(fade ? output.gain.value : 0, ctx.currentTime);
    if (fade) output.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    try { source.stop(ctx.currentTime + fade); } catch { /* 終了済み */ }
  } };
  seVoices.add(voice);
  source.onended = () => { seVoices.delete(voice); source.disconnect(); output.disconnect(); };
  source.start(delay > 0 ? ctx.currentTime + delay : 0);
  return voice;
}

function recordedSe(id, sec) {
  if (!seEnabled()) return true; // ミュートや非表示中に代用音へ回さない。
  const { files, gain, fit } = RECORDED_SE[id];
  const ready = files.filter(file => seBuffers.has(file));
  if (!ready.length) { files.forEach(loadSeBuffer); return false; }
  const choices = ready.filter(file => file !== lastVariant.get(id));
  const file = (choices.length ? choices : ready)[Math.floor(Math.random() * (choices.length || ready.length))];
  lastVariant.set(id, file);
  const voice = recordedVoice(file, { gain });
  // 長さの指定がある呼び出し（歓声など）は、その秒数まで鳴らしてから fit 秒で消す。録音より長い指定は録音の終わりまで。
  if (voice && fit && sec > 0 && sec + fit < voice.source.buffer.duration) {
    const end = ctx.currentTime + sec;
    voice.output.gain.setValueAtTime(gain, end);
    voice.output.gain.linearRampToValueAtTime(0, end + fit);
    voice.source.stop(end + fit + .02);
  }
  return true;
}

// 砂漠ライド専用の採用音。共通の SE 音量・ミュート・表示状態を使い、画面を閉じたらループを止める。
// 拡張子の無い名前は .bgm（梱包した音）、.wav は自作の合成音をそのまま読む。
// 2026-11-11 オーナー「ビリビリなる効果音とか欲しい、ブースト溜まると」「ブースト時も効果音欲しい、早そうな」:
// ブーストの発進を boost_whoosh（短いシュッ）から boost_rush（ドンッ＋キュイーン＋シュゴーッ）へ替え、ブースト中の風切り boost_loop と、
// 溜まるほど間隔が詰まる放電の「ビリッ」zap_1〜3、満タンの雷 thunder_full を足した（asset_sources/music/desert-ride-boost-sfx/）。
// 同日「ビリビリはなんかバグみたいに聞こえる。わかりやすい雷みたいなビリビリがいい」で、不規則に点滅させたループをやめ、1発ずつの音にした。
const DESERT_SE = Object.freeze({
  slide: "slide_sand", wind: "wind_ambience", jump: "jump_videogame",
  land: "drop_soft", boost: "boost_rush.wav", carve: "carve_sand",
  countdown: "countdown_bleeps", goal: "goal_fanfare", fall: "drop_soft",
  decide: "ui_confirm", cursor: "ui_pluck",
  smash: "smash_pot", near: "ui_pluck", gaugeFull: "gauge_powerup",
  boostLoop: "boost_loop.wav", thunder: "thunder_full.wav",
  zap1: "zap_1.wav", zap2: "zap_2.wav", zap3: "zap_3.wav",
});
const DESERT_ZAPS = Object.freeze(["zap1", "zap2", "zap3"]);
const DESERT_CUES = Object.freeze(["spin", "overtake", "overtaken"]);
/**
 * 放電の「ビリッ」の次までの秒数。ゲージが1割を超えると鳴り始め、溜まるほど間隔が詰まる（1割で約1.6秒、満タンで約0.35秒）。
 * 毎回少しずらす（rand は 0〜1）。1割に満たない間は鳴らさない（Infinity）。
 */
export function desertZapGap(charge, rand = Math.random()) {
  if (!(charge >= 0.1)) return Infinity;
  return (1.7 - 1.35 * Math.min(1, charge)) * (0.75 + 0.5 * rand);
}
/** ループの音量（0〜1 の入力から）。boost（ブースト中 1、終わり際に 0 へ）はブースト中の風切り。 */
export function desertLoopLevels({ speed = 0, carve = 0, grounded = false, boost = 0 } = {}) {
  const moving = grounded && speed > 0.1;
  const b = Math.max(0, Math.min(1, boost));
  return {
    slide: { gain: moving ? 0.34 * speed : 0, rate: 0.82 + 0.25 * speed },
    wind: { gain: speed > 0.1 ? 0.14 * Math.max(0, (speed - 0.35) / 0.65) : 0, rate: 0.9 + 0.2 * speed },
    carve: { gain: moving ? 0.18 * Math.min(1, carve) : 0, rate: 1 },
    boostLoop: { gain: 0.2 * b, rate: 1 + 0.08 * b },
  };
}
export function createDesertRideSe() {
  let alive = true;
  const loops = new Map();
  const file = id => `desert_ride/${DESERT_SE[id]}${DESERT_SE[id].includes(".") ? "" : ".bgm"}`;
  const ready = () => Promise.all(Object.keys(DESERT_SE).map(id => loadSeBuffer(file(id))));
  /** 効果音を全部読み終えているか（音を出せない間は読みに行かないので、待つ必要もない）。 */
  const isReady = () => !ctx || Object.keys(DESERT_SE).every(id => seBuffers.has(file(id)));
  let levels = desertLoopLevels();
  let zaps = 0, lastZap = "";
  const cues = [];
  /** rate: 再生の速さ（高さも変わる）。再挑戦の短い合図、かすめの近さ（近いほど高い）に使う。 */
  function play(id, gain = 0.65, rate = 1) {
    if (!alive || !DESERT_SE[id]) return;
    const name = file(id);
    if (seBuffers.has(name)) recordedVoice(name, { gain, rate });
  }
  /**
   * 録音の無い短い合図（合成）。ほかの出来事と同じ音を使い回さない（2026-11-13。それまで、かすめ・半回転・抜いた が同じ音だった）。
   * spin: 空中の半回転の区切り（n 回目ほど高い＝180・360・540 を耳で数えられる）／overtake: 相手を抜いた（上がる2音）／overtaken: 抜かれた（下がる2音）。
   */
  function cue(kind, { n = 1, gain = 0.3 } = {}) {
    if (!alive || !DESERT_CUES.includes(kind)) return;
    cues.push(kind); if (cues.length > 32) cues.shift();
    if (!seEnabled()) return;
    const vol = Math.max(0, Math.min(1, gain)) * 0.5;
    if (kind === "spin") {
      const freq = 640 * (1 + 0.12 * Math.max(1, n));
      tone({ freq, to: freq * 1.3, type: "triangle", dur: 0.07, vol });
    } else if (kind === "overtake") {
      tone({ freq: 660, type: "triangle", dur: 0.09, vol }); tone({ freq: 990, type: "triangle", dur: 0.16, vol: vol * 0.9, delay: 0.08 });
    } else {
      tone({ freq: 520, type: "sine", dur: 0.11, vol }); tone({ freq: 390, type: "sine", dur: 0.2, vol: vol * 0.9, delay: 0.1 });
    }
  }
  function loop(id, gain, rate = 1) {
    const voice = loops.get(id);
    if (!alive || !seEnabled() || gain <= 0.005) {
      voice?.stop(0.12);
      loops.delete(id);
      return;
    }
    if (!voice || !seVoices.has(voice)) {
      if (!seBuffers.has(file(id))) return;
      loops.set(id, recordedVoice(file(id), { loop: true, gain, rate }));
    } else {
      voice.source.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.12);
      voice.output.gain.setTargetAtTime(gain, ctx.currentTime, 0.12);
    }
  }
  function motion(state = {}) {
    levels = desertLoopLevels(state);
    for (const [id, { gain, rate }] of Object.entries(levels)) loop(id, gain, rate);
  }
  function stop() { for (const voice of loops.values()) voice?.stop(0.12); loops.clear(); levels = desertLoopLevels(); }
  function dispose() { alive = false; stop(); }
  /** 放電の「ビリッ」を1発（3つから前と違うものを選び、高さを少し揺らす）。溜まっているほど大きい。 */
  function zap(charge) {
    if (!alive) return;
    const choices = DESERT_ZAPS.filter(id => id !== lastZap);
    const id = choices[Math.floor(Math.random() * choices.length)];
    lastZap = id; zaps += 1;
    if (seBuffers.has(file(id))) recordedVoice(file(id), { gain: 0.22 + 0.33 * Math.max(0, Math.min(1, charge)), rate: 0.94 + 0.12 * Math.random() });
  }
  /** 今のループの音量と、鳴らした「ビリッ」の数（検査用。音が出せない環境でも、鳴らすつもりの音が分かる）。 */
  const loopLevels = () => ({ ...Object.fromEntries(Object.entries(levels).map(([id, { gain }]) => [id, gain])), zaps, cues: [...cues] });
  return { ready, isReady, play, cue, motion, zap, stop, dispose, loopLevels };
}

// ---------------------------------------------------------------- ミニゲームの仮SE
// 2026-11-10 オーナー依頼「ミニゲーム全般に合う効果音を探して一旦入れて」の仮置き（grok/minigame-audio）。
// 出典・ライセンス（すべてCC0）・加工は asset_sources/music/minigame-se/。差し替えはこの表のファイル名だけ変える。
// 共通のSE音量・ミュート・非表示停止（recordedVoice）に乗せ、未読込・取得失敗の間は既存の合成SE（fallback）で鳴らす。
// 斧投げの実プレイは playAxeSe（AXE_SE・2026-11-11 作り直し）を使い、ここの歓声・勝ち負けの録音と刺さる音の芯（axe_thunk）もそこで使う。以下の録音キューは出典台帳付きの既存素材として保持する。
// TRPGの音（grok/trpg-audio）とは別の表にしてある。
export const MINIGAME_SE = Object.freeze({
  axeThrow: { files: ["minigame/axe_throw.wav"], gain: .7, fallback: "whoosh" },
  axeThunk: { files: ["minigame/axe_thunk_01.wav", "minigame/axe_thunk_02.wav", "minigame/axe_thunk_03.wav"], gain: .85, fallback: "hit" },
  axeDrop: { files: ["minigame/axe_drop.wav"], gain: .75, fallback: null }, // 失敗音は呼び出し側が別に鳴らす
  axeCheer: { files: ["minigame/axe_cheer.wav"], gain: .8, fallback: "perfect" },
  axeWin: { files: ["minigame/axe_win.wav"], gain: .7, fallback: "fanfare" },
  axeLose: { files: ["minigame/axe_lose.wav"], gain: .7, fallback: "miss" },
});
/** あるミニゲームの仮SEを先に読み込む（prefix は "axe" など）。初回操作の後に呼ぶ。 */
export function preloadMinigameSe(prefix = "") {
  if (!audioUnlocked) return Promise.resolve(false);
  const files = Object.entries(MINIGAME_SE).filter(([id]) => id.startsWith(prefix)).flatMap(([, cue]) => cue.files);
  return Promise.all(files.map(loadSeBuffer)).then(buffers => buffers.every(Boolean));
}
/** ミニゲームの仮SEを1回鳴らす。録音が未読込なら読み込みを始め、今回は合成の代用音を鳴らす。 */
export function playMinigameSe(id) {
  const cue = MINIGAME_SE[id];
  if (!cue || !seEnabled()) return;
  const ready = cue.files.filter(file => seBuffers.has(file));
  if (!ready.length) { cue.files.forEach(loadSeBuffer); if (cue.fallback) SE[cue.fallback]?.(); return; }
  const choices = ready.filter(file => file !== lastVariant.get(id));
  const file = (choices.length ? choices : ready)[Math.floor(Math.random() * (choices.length || ready.length))];
  lastVariant.set(id, file);
  recordedVoice(file, { gain: cue.gain });
}

// ラクダレースの採用SE（grok/minigame-sfx-swap）。既存の sfx("hoof") 等の ID は維持し、スロットなど他場面の合成SEは変えない。
// 出典は asset_sources/music/minigame-sfx-swap/。未読込・取得失敗時は従来の合成へ戻す。斧投げの MINIGAME_SE とは別表。
export const CAMEL_RACE_SE = Object.freeze({
  count: { files: ["camel_race/count_bleep.bgm"], gain: .5, fallback: "count" },
  reelLever: { files: ["camel_race/start_cracker.wav"], gain: .7, fallback: "reelLever" },
  hoof: { files: ["camel_race/hoof_gallop.wav"], gain: .5, fallback: "hoof" },
  whoosh: { files: ["camel_race/whip_complete.wav"], gain: .62, fallback: "whoosh" },
  perfect: { files: ["camel_race/perfect_confirm.wav"], gain: .5, fallback: "perfect" },
  good: { files: ["camel_race/good_confirm.wav"], gain: .42, fallback: "good" },
  miss: { files: ["camel_race/miss_error.wav"], gain: .5, fallback: "miss" },
  slotBonus: { files: ["camel_race/spurt_horn.wav"], gain: .55, fallback: "slotBonus" },
  reelWin: { files: ["camel_race/overtake_whoosh.wav"], gain: .55, fallback: "reelWin" },
  fanfare: { files: ["camel_race/fanfare_trumpet.bgm"], gain: .55, fallback: "fanfare" },
  jingle: { files: ["camel_race/place_jingle.wav"], gain: .5, fallback: "jingle" },
  crowd: { files: ["camel_race/crowd_applause.wav"], gain: .5, fallback: "crowd" },
  stamp: { files: ["camel_race/stamp_drop.wav"], gain: .6, fallback: "stamp" },
  grunt: { files: ["camel_race/grunt_camel.wav"], gain: .45, fallback: null },
});
export function preloadCamelRaceSe() {
  if (!audioUnlocked) return Promise.resolve(false);
  const files = Object.values(CAMEL_RACE_SE).flatMap(cue => cue.files);
  return Promise.all(files.map(loadSeBuffer)).then(buffers => buffers.every(Boolean));
}
export function playCamelRaceSe(id) {
  const cue = CAMEL_RACE_SE[id];
  if (!cue || !seEnabled()) return;
  const ready = cue.files.filter(file => seBuffers.has(file));
  if (!ready.length) { cue.files.forEach(loadSeBuffer); if (cue.fallback) SE[cue.fallback]?.(); return; }
  const choices = ready.filter(file => file !== lastVariant.get("camel:" + id));
  const file = (choices.length ? choices : ready)[Math.floor(Math.random() * (choices.length || ready.length))];
  lastVariant.set("camel:" + id, file);
  recordedVoice(file, { gain: cue.gain });
}

function syncPulls() { activePulls.forEach(pull => pull.sync()); }
function stopRecordedVoices() { seVoices.forEach(voice => voice.stop()); }
document.addEventListener?.("visibilitychange", () => {
  syncPulls();
  if (document.hidden) stopRecordedVoices();
  syncRain();
});
// 縦持ちの回転ガード中（#2941・core/rotate-guard.js が <html data-rotate-guard> と "rotateguardchange" で知らせる）は、
// 制作の時計と同じく音も止める。効果音・合成BGM・雨は大元の音量を0に、曲のファイルは一時停止し、横に戻すと同じ所から続ける。
let rotateHeld = false;
document.addEventListener?.("rotateguardchange", () => {
  rotateHeld = document.documentElement?.dataset?.rotateGuard === "true";
  if (master) master.gain.value = rotateHeld ? 0 : 1;
  if (rotateHeld) { stopRecordedVoices(); currentEl?.pause(); resetBgmTempo(); }
  else if (currentEl && !bgmPaused) currentEl.play().catch(() => {});
});

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  ctx.addEventListener?.("statechange", syncPulls);
  master = ctx.createGain();
  master.gain.value = rotateHeld ? 0 : 1;
  master.connect(ctx.destination);
  seBus = ctx.createGain();
  seBus.gain.value = config.mute || config.muted ? 0 : config.seVolume;
  seBus.connect(master);
  bgmBus = ctx.createGain();
  bgmBus.gain.value = config.mute || config.muted || bgmPaused || bgmSilences ? 0 : config.bgmVolume * bgmDuck;
  bgmBus.connect(master);
  return ctx;
}

/** ユーザー操作で音を解禁し、OSによる中断から同じ曲・位置へ復帰する。 */
export function unlockAudio() {
  audioUnlocked = true;
  const c = ensureCtx();
  const ready = () => {
    if (c?.state !== "running") return;
    syncRain(); syncPulls();
    // resume() is asynchronous. Read the latest request only after it succeeds;
    // stop/scene changes during unlock must not revive an old title request.
    if (pendingBgm) {
      const k = pendingBgm; pendingBgm = null;
      if (k === currentKey && currentEl) {
        // play() の拒否は読み込み失敗ではない。次の操作でも同じ曲・位置を使う。
        const a = currentEl;
        if (!bgmPaused && !rotateHeld && !document.hidden) a.play().catch(() => {
          if (currentEl === a && currentKey === k) pendingBgm = k;
        });
      } else playBgm(k);
    }
    else if (currentEl?.paused && currentEl.src && currentEl.readyState >= 2
      && !bgmPaused && !rotateHeld && !document.hidden) {
      // iOSの割込などで要素だけ止まることがある。同じキーのplayBgmは重複を
      // 防ぐため再生し直さないので、次の操作でこの要素をその位置から再開する。
      currentEl.play().catch(() => {});
    }
  };
  if (c && (c.state === "suspended" || c.state === "interrupted")) c.resume().then(ready, () => {});
  else ready();
  warmSe();
}

export function applyVolumes() {
  const muted = config.mute || config.muted;
  if (seBus) seBus.gain.value = muted ? 0 : config.seVolume;
  bgmBus?.gain.cancelScheduledValues?.(ctx.currentTime);
  if (bgmBus) bgmBus.gain.value = muted || bgmPaused || bgmSilences ? 0 : config.bgmVolume * bgmDuck;
  if (currentEl) currentEl.volume = bgmLevel(currentKey);
  // 曲の切替後もフェード中の旧曲は鳴っている。無音設定を即座に反映し、
  // 予約済みのフレームが音量を戻さないようフェードごと終了する。
  if (muted || !(Number(config.bgmVolume) > 0)) {
    for (const a of retiringBgm) {
      elFades.get(a)?.(false);
      a.volume = 0;
      a.pause();
      releasePacked(a.src);
      retiringBgm.delete(a);
    }
  }
  syncPulls();
  if (muted || !(Number(config.seVolume) > 0)) stopRecordedVoices();
  syncRain();
}

// 雨はユーザー操作で解放された既存の AudioContext / 効果音バスだけを使う。
export function setRainAmbience(mode = null) {
  rainMode = mode === "outdoor" || mode === "indoor" ? mode : null;
  syncRain();
}

function stopRain() {
  if (!rainLoop) return;
  rainLoop.gain.gain.setValueAtTime(0, ctx.currentTime);
  rainLoop.source.stop();
  rainLoop.source.disconnect();
  rainLoop.filter.disconnect();
  rainLoop.gain.disconnect();
  rainLoop = null;
}

function syncRain() {
  if (!rainMode || !audioUnlocked || !ctx || ctx.state !== "running"
    || !(Number(config.seVolume) > 0) || config.mute || config.muted || document.hidden) {
    stopRain();
    return;
  }
  if (!rainLoop) {
    if (!rainBuffer) {
      rainBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
      const samples = rainBuffer.getChannelData(0);
      let low = 0;
      for (let i = 0; i < samples.length; i++) {
        const white = Math.random() * 2 - 1;
        low = (low + white * 0.025) / 1.025;
        samples[i] = white * 0.22 + low * 2.4;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = rainBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.35;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(seBus);
    source.start();
    rainLoop = { source, filter, gain };
  }
  const outside = rainMode === "outdoor";
  rainLoop.filter.frequency.setTargetAtTime(outside ? 1800 : 650, ctx.currentTime, 0.18);
  rainLoop.gain.gain.setTargetAtTime(outside ? 0.055 : 0.018, ctx.currentTime, 0.2);
}

// ---------------------------------------------------------------- SE（録音未読込時・演出用の合成）

function tone({ freq = 440, to = null, type = "sine", dur = 0.12, vol = 0.25, delay = 0, attack = 0.005 }) {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(seBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.3, vol = 0.2, delay = 0, filter = 1200, q = 0.8, type = "bandpass", sweepTo = null }) {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  let buf, offset = 0;
  if (dur <= 3) {
    if (!noiseBuffer) {
      noiseBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 3), c.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    buf = noiseBuffer;
    offset = Math.random() * Math.max(0, buf.duration - dur);
  } else {
    buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(filter, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.04, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(seBus);
  src.start(t, offset, dur);
}

/** 一口の間だけ録音ループ。止め際は最後の一泡。非表示/消音中は止め、同じ一口だけ再開。 */
export function startBubbling({ strength = 1 } = {}) {
  let stopped = false, voice = null, timer = null;
  const force = Math.max(.3, Math.min(1, Number(strength) || 1));
  const bubble = () => {
    if (stopped || !seEnabled()) return;
    const freq = 95 + Math.random() * 95;
    tone({ freq, to: Math.max(35, freq * .42), dur: .075 + Math.random() * .045, vol: .09 * force });
    noise({ dur: .055, filter: 350 + Math.random() * 300, q: 1.4, vol: .025 * force });
  };
  const silenceFallback = () => { if (timer !== null) clearInterval(timer); timer = null; };
  const pull = { sync() {
    if (stopped) return;
    if (!seEnabled()) { voice?.stop(); voice = null; silenceFallback(); return; }
    if (voice || timer !== null) return;
    if (seBuffers.has(WATER_LOOP)) {
      voice = recordedVoice(WATER_LOOP, { loop: true, gain: force, rate: .88 + .12 * force });
    } else {
      bubble(); timer = setInterval(bubble, 85);
      loadSeBuffer(WATER_LOOP).then(buffer => {
        if (!buffer || stopped) return;
        silenceFallback(); pull.sync();
      });
    }
  } };
  activePulls.add(pull);
  pull.sync();
  return () => {
    if (stopped) return;
    stopped = true; activePulls.delete(pull); silenceFallback();
    if (voice) {
      voice.stop(seEnabled() ? .06 : 0);
      if (seEnabled()) recordedVoice(WATER_END, { gain: force * .65 });
      voice = null;
    }
  };
}

// キャラ別の文字送りボイス（低い=スミさん、高い=みんと 等）
const BLIP = {
  hajime: 440, sumi: 300, naru: 420, adam: 330, minto: 1350, oneesan: 980, tsumugi: 1100, rio: 760,
  pakki: 900, sui: 280, maezono: 380, dr_kemuri: 520, salaryman: 360, ageha: 1200,
  mashiro: 880, samechan: 1250,
};

export const SE = {
  click: () => tone({ freq: 1200, to: 900, type: "triangle", dur: 0.05, vol: 0.12 }),
  select: () => { tone({ freq: 660, type: "triangle", dur: 0.08, vol: 0.18 }); tone({ freq: 990, type: "triangle", dur: 0.1, vol: 0.14, delay: 0.05 }); },
  cancel: () => tone({ freq: 500, to: 300, type: "triangle", dur: 0.12, vol: 0.15 }),
  error: () => { tone({ freq: 180, type: "square", dur: 0.12, vol: 0.1 }); tone({ freq: 150, type: "square", dur: 0.14, vol: 0.1, delay: 0.1 }); },
  blip: (speaker) => {
    if (!config.voiceBlip || !speaker) return tone({ freq: 1800, type: "sine", dur: 0.02, vol: 0.03 });
    const f = BLIP[speaker] || 600;
    tone({ freq: f * (0.95 + Math.random() * 0.1), type: speaker === "pakki" ? "square" : "triangle", dur: 0.045, vol: speaker === "sumi" ? 0.09 : 0.06 });
  },
  pour: () => noise({ dur: 0.18, vol: 0.12, filter: 3000, q: 0.5, sweepTo: 1200 }),
  punch: () => { tone({ freq: 2400, to: 1400, type: "square", dur: 0.03, vol: 0.08 }); noise({ dur: 0.05, vol: 0.12, filter: 5000, type: "highpass" }); },
  perfect: () => { tone({ freq: 1320, type: "triangle", dur: 0.09, vol: 0.18 }); tone({ freq: 1760, type: "triangle", dur: 0.14, vol: 0.16, delay: 0.06 }); },
  good: () => tone({ freq: 990, type: "triangle", dur: 0.1, vol: 0.14 }),
  miss: () => tone({ freq: 220, to: 160, type: "sawtooth", dur: 0.16, vol: 0.08 }),
  just: () => { tone({ freq: 1568, type: "sine", dur: 0.3, vol: 0.2 }); tone({ freq: 2093, type: "sine", dur: 0.4, vol: 0.14, delay: 0.04 }); noise({ dur: 0.25, vol: 0.08, filter: 8000, type: "highpass" }); },
  crackle: () => { for (let i = 0; i < 4; i++) noise({ dur: 0.03, vol: 0.1, filter: 2500 + Math.random() * 3000, delay: Math.random() * 0.25, q: 2 }); },
  bubbling: () => { for (let i = 0; i < 6; i++) tone({ freq: 180 + Math.random() * 120, to: 90, type: "sine", dur: 0.09, vol: 0.12, delay: i * 0.09 + Math.random() * 0.04 }); },
  whoosh: () => noise({ dur: 0.7, vol: 0.14, filter: 400, q: 0.6, sweepTo: 2600 }),
  // ラクダレース: 自分のラクダの一完歩ごとの蹄（低く短く。速く走るほど詰まって聞こえる）。
  hoof: () => { tone({ freq: 96, to: 52, type: "sine", dur: 0.08, vol: 0.11 }); noise({ dur: 0.04, vol: 0.04, filter: 600 }); },
  hit: () => { tone({ freq: 140, to: 60, type: "sine", dur: 0.2, vol: 0.3 }); noise({ dur: 0.12, vol: 0.12, filter: 900 }); },
  heartbeat: () => { tone({ freq: 70, to: 45, type: "sine", dur: 0.14, vol: 0.4 }); tone({ freq: 70, to: 45, type: "sine", dur: 0.12, vol: 0.3, delay: 0.2 }); },
  tick: () => tone({ freq: 2000, type: "square", dur: 0.02, vol: 0.05 }),
  count: () => { tone({ freq: 880, type: "square", dur: 0.08, vol: 0.12 }); tone({ freq: 440, type: "sine", dur: 0.25, vol: 0.12 }); },
  stamp: () => { tone({ freq: 90, to: 50, type: "sine", dur: 0.18, vol: 0.35 }); noise({ dur: 0.08, vol: 0.18, filter: 1200 }); },
  crowd: (sec = 2.2) => { noise({ dur: sec, vol: 0.16, filter: 700, q: 0.4 }); noise({ dur: sec * 0.8, vol: 0.08, filter: 1800, q: 0.6, delay: 0.2 }); },
  drumroll: (sec = 2) => { const n = Math.floor(sec * 22); for (let i = 0; i < n; i++) noise({ dur: 0.05, vol: 0.05 + (i / n) * 0.12, filter: 900, delay: i / 22 }); },
  // 1位確定の「プチュン」（ブラウン管が落ちる音）
  puchun: () => { tone({ freq: 4200, to: 60, type: "sine", dur: 0.35, vol: 0.28 }); noise({ dur: 0.1, vol: 0.2, filter: 6000, type: "highpass" }); },
  // 敗北の「パリン」
  parin: () => {
    for (let i = 0; i < 9; i++) tone({ freq: 2500 + Math.random() * 3500, type: "triangle", dur: 0.12 + Math.random() * 0.2, vol: 0.08, delay: Math.random() * 0.12 });
    noise({ dur: 0.35, vol: 0.2, filter: 6000, type: "highpass" });
  },
  crack: () => { noise({ dur: 0.08, vol: 0.25, filter: 3000 }); tone({ freq: 300, to: 80, type: "square", dur: 0.12, vol: 0.12 }); },
  jingle: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, vol: 0.14, delay: i * 0.09 })),
  fanfare: () => {
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.56], [1047, 0.68]].forEach(([f, d]) => tone({ freq: f, type: "square", dur: 0.2, vol: 0.09, delay: d }));
    tone({ freq: 1047, type: "triangle", dur: 1.2, vol: 0.12, delay: 0.8 });
  },
  money: () => { tone({ freq: 1500, type: "triangle", dur: 0.06, vol: 0.1 }); tone({ freq: 2000, type: "triangle", dur: 0.12, vol: 0.1, delay: 0.06 }); },
  phone: () => { tone({ freq: 1320, type: "sine", dur: 0.08, vol: 0.14 }); tone({ freq: 1760, type: "sine", dur: 0.12, vol: 0.14, delay: 0.1 }); },
  // LIME専用の短いオリジナル合成音。録音phone互換IDはそのまま残す。
  phoneReceive: () => {
    if (!seEnabled() || ctx.currentTime - lastPhoneReceiveAt < .2) return;
    lastPhoneReceiveAt = ctx.currentTime; // 同時の通知・初回案内で受信音を重ねない。
    tone({ freq: 880, dur: .07, vol: .1 });
    tone({ freq: 1320, dur: .1, vol: .1, delay: .08 });
  },
  phoneSend: () => {
    if (!seEnabled()) return;
    tone({ freq: 660, to: 990, type: "triangle", dur: .09, vol: .09 });
  },
  doorbell: () => { tone({ freq: 1568, type: "sine", dur: 0.6, vol: 0.12 }); tone({ freq: 1245, type: "sine", dur: 0.8, vol: 0.1, delay: 0.25 }); },
  coalSnip: () => { noise({ dur: 0.04, vol: 0.02, filter: 4000 }); tone({ freq: 700, to: 200, type: "triangle", dur: 0.05, vol: 0.005 }); },
  coalPlace: () => tone({ freq: 280, to: 160, type: "triangle", dur: .08, vol: .025 }),
  foilPunch: () => noise({ dur: .06, vol: .02, filter: 4200, q: .6 }),
  // MOKUMOKUパッキー（日常スロット）
  reelLever: () => { noise({ dur: 0.05, vol: 0.18, filter: 1800 }); tone({ freq: 220, to: 120, type: "square", dur: 0.06, vol: 0.06 }); },
  reelStop: () => { tone({ freq: 520, to: 300, type: "square", dur: 0.04, vol: 0.07 }); noise({ dur: 0.03, vol: 0.1, filter: 2600 }); },
  reelWin: () => { tone({ freq: 1175, type: "triangle", dur: 0.08, vol: 0.12 }); tone({ freq: 1568, type: "triangle", dur: 0.12, vol: 0.1, delay: 0.07 }); },
  // 能力ボーナスの通知に合わせた短い上昇音。通常の通知音より控えめにする。
  slotBonus: () => [784, 1175, 1568].forEach((freq, i) => tone({ freq, type: "triangle", dur: i === 2 ? 0.18 : 0.1, vol: 0.08, delay: i * 0.07 })),
  // 心得の盤: 仮置きは短い火の音、確定は柔らかい和音。いずれもオリジナル合成音。
  boardLight: () => {
    if (!seEnabled()) return;
    [659, 988].forEach((freq, i) => tone({ freq, type: "sine", dur: .18, vol: .09, delay: i * .045 }));
  },
  boardCommit: () => {
    if (!seEnabled()) return;
    [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, type: "sine", dur: .32, vol: .07, delay: i * .065 }));
  },
  puka: () => { tone({ freq: 880, to: 1760, type: "sine", dur: 0.16, vol: 0.2 }); tone({ freq: 1760, type: "sine", dur: 0.28, vol: 0.12, delay: 0.14 }); },
  pugo: () => { tone({ freq: 140, to: 70, type: "sine", dur: 0.22, vol: 0.3 }); noise({ dur: 0.08, vol: 0.12, filter: 500 }); },
  glitch: () => { for (let i = 0; i < 8; i++) tone({ freq: 200 + Math.random() * 2400, type: "square", dur: 0.03, vol: 0.05, delay: i * 0.05 }); },
  // 温度計の一番上で一台が爆発して焦げる（TH06）。低い破裂と崩れる火の粉。
  burst: () => { tone({ freq: 90, to: 26, type: "sine", dur: 1.1, vol: 0.45 }); noise({ dur: 1, vol: 0.3, filter: 1800, sweepTo: 220 }); noise({ dur: 0.22, vol: 0.2, filter: 6000, type: "highpass" }); for (let i = 0; i < 6; i++) noise({ dur: 0.04, vol: 0.12, filter: 2000 + Math.random() * 3000, delay: 0.25 + Math.random() * 0.6, q: 2 }); },
  // 電車（motions/train.js）: 低いうなりの上に「ガタン・ゴトン」と継ぎ目の音が2回
  train: (sec = 2.6) => {
    noise({ dur: sec, vol: 0.1, filter: 220, q: 0.7 });
    [0.15, 0.27, 1.05, 1.17].forEach((t, i) => { tone({ freq: i % 2 ? 72 : 96, to: 48, type: "sine", dur: 0.12, vol: 0.22, delay: t }); noise({ dur: 0.05, vol: 0.08, filter: 1400, delay: t }); });
  },
  // 新幹線（motions/shinkansen.js, Issue #1059）: 継ぎ目のない高速走行の連続音。在来線の「ガタン・ゴトン」は鳴らさない。
  shinkansen: (sec = 1.7) => {
    noise({ dur: sec, vol: 0.09, filter: 900, q: 0.5, sweepTo: 1500 });
    tone({ freq: 150, to: 105, type: "sine", dur: sec, vol: 0.07 });
  },
  freezeBoom: () => { tone({ freq: 60, to: 30, type: "sine", dur: 0.6, vol: 0.4 }); noise({ dur: 0.5, vol: 0.2, filter: 700, sweepTo: 3000 }); },
  // てつこといっしょ（#2454）: 喉を鳴らす低いゴロゴロ（約1.2秒。録音なし・合成）と、写真のシャッター。
  purr: () => { for (let i = 0; i < 26; i++) noise({ dur: 0.04, vol: 0.05 * Math.min(1, (i + 1) / 4, (26 - i) / 4), filter: 160 + Math.random() * 50, q: 1.1, type: "lowpass", delay: i * 0.046 }); },
  shutter: () => { noise({ dur: 0.04, vol: 0.12, filter: 3200 }); tone({ freq: 1800, to: 900, type: "square", dur: 0.03, vol: 0.03, delay: 0.01 }); noise({ dur: 0.05, vol: 0.09, filter: 2200, delay: 0.09 }); },
  // てつこといっしょ（§10・手応えの改善）: 短い鳴き声／飛びつく風切り／空振り／ぽん（ハートが増える）／とっておきのきらきら。どれも合成。
  mew: () => { tone({ freq: 640, to: 1010, type: "triangle", dur: 0.09, vol: 0.1 }); tone({ freq: 1010, to: 720, type: "triangle", dur: 0.17, vol: 0.085, delay: 0.085 }); },
  swish: () => noise({ dur: 0.16, vol: 0.1, filter: 900, sweepTo: 3600, q: 0.7 }),
  boing: () => { tone({ freq: 430, to: 170, type: "sine", dur: 0.24, vol: 0.12 }); tone({ freq: 215, to: 120, type: "triangle", dur: 0.18, vol: 0.05, delay: 0.05 }); },
  pon: () => tone({ freq: 880, to: 1320, type: "sine", dur: 0.07, vol: 0.085 }),
  twinkle: () => { [1047, 1319, 1568, 2093].forEach((freq, i) => tone({ freq, type: "sine", dur: 0.22, vol: 0.11, delay: i * 0.07 })); noise({ dur: 0.3, vol: 0.04, filter: 7000, type: "highpass", delay: 0.1 }); },
  // 日付カードなど短いUI音（録音が無ければ短いクリック）。
  card: () => tone({ freq: 880, to: 660, type: "triangle", dur: 0.08, vol: 0.1 }),
  // 好感度が上がった時のベル（録音が無ければ短い一音）と、セーブ完了（同じく短い二音）。
  affinity: () => tone({ freq: 1319, type: "sine", dur: 0.3, vol: 0.1 }),
  save: () => { tone({ freq: 784, type: "triangle", dur: 0.08, vol: 0.1 }); tone({ freq: 1175, type: "triangle", dur: 0.14, vol: 0.1, delay: 0.07 }); },
  // 第2弾の音の、録音が読めない時の代わり（扉の低い一打・入手の二音・小鳥の短い三声・紙のこすれ）。
  door: () => { tone({ freq: 180, to: 90, type: "triangle", dur: 0.16, vol: 0.12 }); noise({ dur: 0.1, vol: 0.06, filter: 900 }); },
  get: () => { tone({ freq: 1568, type: "sine", dur: 0.12, vol: 0.1 }); tone({ freq: 2093, type: "sine", dur: 0.3, vol: 0.09, delay: 0.09 }); },
  birds: () => [0, .28, .5].forEach((delay, i) => tone({ freq: 2600 + i * 300, to: 3400 + i * 200, type: "sine", dur: 0.09, vol: 0.04, delay })),
  page: () => noise({ dur: 0.16, vol: 0.07, filter: 2400, sweepTo: 5200, q: 0.7 }),
  // シーシャくじのガラガラ（motions/garagara.js）と賞の札（daily/kuji-reveal.js）
  kujiCharge: (sec = 1.4) => { tone({ freq: 196, to: 740, type: "triangle", dur: sec, vol: 0.05, attack: sec * 0.5 }); noise({ dur: sec, vol: 0.05, filter: 500, q: 0.7, sweepTo: 4200 }); },
  kujiShimmer: (n = 8) => { for (let i = 0; i < n; i++) tone({ freq: 2100 + Math.random() * 2600, type: "sine", dur: 0.2, vol: 0.045, delay: i * 0.05 + Math.random() * 0.03 }); },
  kujiImpact: () => { tone({ freq: 130, to: 42, type: "sine", dur: 0.5, vol: 0.4 }); noise({ dur: 0.32, vol: 0.18, filter: 1500, sweepTo: 220 }); },
  kujiRare: () => [784, 988, 1175, 1568, 1976].forEach((freq, i) => tone({ freq, type: "triangle", dur: 0.32, vol: 0.11, delay: i * 0.06 })),
  kujiNote: (i = 0) => { const scale = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093]; tone({ freq: scale[Math.min(i, scale.length - 1)], type: "triangle", dur: 0.14, vol: 0.13 }); },
  kujiFlip: () => { noise({ dur: 0.07, vol: 0.09, filter: 2600, q: 0.9 }); tone({ freq: 700, to: 1100, type: "triangle", dur: 0.07, vol: 0.07 }); },
};

// 斧投げの効果音（2026-11-11 作り直し。オーナー「斧投げ……なんか効果音しょぼかったり」）。
// assets/audio/se/axe_throw/ の .wav（作り方: asset_sources/music/axe-throw-sfx/build.py。刺さる音の芯は録音 axe_thunk_01〜03・CC0）と、
// 歓声・勝ち負けの録音（下の MINIGAME_SE と同じ CC0 のファイル）。斧投げを始める時に preloadAxeSe で先に読み、
// 読み込み前・取得失敗の間は、その場で作る合成音（axeSynth）で鳴らす。音量は、一番大きい0.15秒の大きさを測ってそろえた
// （刺さる音 約-16dB・投げる音 約-21dB・ゲージを止める音 約-30dB。歓声とファンファーレは元の録音が小さいので 1 より上げる）。
export const AXE_SE = Object.freeze({
  throw: { files: ["axe_throw/throw.wav"], gain: .9 },
  stick: { files: ["axe_throw/hit_1.wav", "axe_throw/hit_2.wav", "axe_throw/hit_3.wav"], gain: .8 },
  killshot: { files: ["axe_throw/killshot.wav"], gain: .85 },
  bounce: { files: ["axe_throw/bounce.wav"], gain: .9 },
  drop: { files: ["axe_throw/drop.wav"], gain: .9 },
  stop: { files: ["axe_throw/stop.wav"], gain: .7 },
  call: { files: ["axe_throw/call.wav"], gain: .75 },
  cueDrum: { files: ["axe_throw/cue_drum.wav"], gain: .55 },
  cueClear: { files: ["axe_throw/cue_clear.wav"], gain: .65 },
  cheer: { files: ["minigame/axe_cheer.wav"], gain: 1.8 },
  win: { files: ["minigame/axe_win.wav", "minigame/axe_cheer.wav"], gain: 1.6, together: true },
  lose: { files: ["minigame/axe_lose.wav"], gain: .7 },
});
const axePlayed = {};
/** 斧投げの音を先に読む（最初の操作の後に呼ぶ）。全部読めたら true。 */
export function preloadAxeSe() {
  if (!audioUnlocked) return Promise.resolve(false);
  const files = [...new Set(Object.values(AXE_SE).flatMap(cue => cue.files))];
  return Promise.all(files.map(loadSeBuffer)).then(buffers => buffers.every(Boolean));
}
/** 検査用: 鳴らした音の数（id → { recorded, synth }）。音が出せない環境でも、鳴らすつもりの音が分かる。 */
export const axeSePlayed = () => JSON.parse(JSON.stringify(axePlayed));
// rate: 録音の再生の速さ（斧ごとの刺さり音の高さ。2026-11-13 斧投げ手応えレビュー指摘11）。合成音では使わない。
export function playAxeSe(id, { scored = true, rate = 1 } = {}) {
  if (!seEnabled()) return;
  const cue = AXE_SE[id], weight = id === "stick" && !scored ? .75 : 1;
  const ready = cue?.files.filter(file => seBuffers.has(file)) || [];
  const count = axePlayed[id] ||= { recorded: 0, synth: 0 };
  if (cue && ready.length === (cue.together ? cue.files.length : ready.length) && ready.length) {
    if (cue.together) ready.forEach(file => recordedVoice(file, { gain: cue.gain * (file.endsWith("axe_cheer.wav") ? .7 : 1) }));
    else {
      const choices = ready.filter(file => file !== lastVariant.get("axe:" + id));
      const file = (choices.length ? choices : ready)[Math.floor(Math.random() * (choices.length || ready.length))];
      lastVariant.set("axe:" + id, file);
      recordedVoice(file, { gain: cue.gain * weight, rate: Number.isFinite(rate) && rate > 0 ? rate : 1 });
    }
    count.recorded++;
    return;
  }
  cue?.files.forEach(loadSeBuffer);
  count.synth++;
  axeSynth(id, { scored });
}

// 斧投げの合成音（録音が読めるまでの代わり）。共通の音量・ミュート・非表示停止を通す。
// 風切り→木への衝突→割れ・軋みを別の帯域にする。
function axeSynth(id, { scored = true } = {}) {
  if (id === "killshot") { axeSynth("stick"); SE.perfect(); return; }
  if (id === "bounce") { tone({ freq: 240, to: 150, type: "triangle", dur: .08, vol: .12 }); noise({ dur: .03, vol: .08, filter: 2600 }); return; }
  if (id === "stop") { SE.select(); return; }
  if (id === "call" || id === "cueDrum" || id === "cueClear") { SE.good(); return; }
  if (id === "throw") {
    noise({ dur: .43, vol: .19, filter: 380, sweepTo: 3100, q: .55 });
    noise({ dur: .19, vol: .07, delay: .13, filter: 4200, sweepTo: 1800, q: .6 });
    tone({ freq: 155, to: 82, type: "triangle", dur: .27, vol: .12 });
  } else if (id === "stick") {
    const weight = scored ? 1 : .72;
    tone({ freq: 118, to: 44, dur: .32, vol: .36 * weight });
    noise({ dur: .18, vol: .21 * weight, filter: 620, q: .5, type: "lowpass" });
    noise({ dur: .09, vol: .14 * weight, filter: 2900, q: 1.2, delay: .014 });
    // A few separated splinters and a falling wooden creak follow the initial hit.
    [0.07, 0.12, 0.19].forEach((delay, i) => noise({ dur: .035 + i * .012, vol: .065 * weight,
      filter: 3400 - i * 650, q: 1.5, delay }));
    tone({ freq: 360, to: 125, type: "sawtooth", dur: .31, vol: .035 * weight, delay: .08 });
  } else if (id === "drop") {
    tone({ freq: 102, to: 47, dur: .18, vol: .22, delay: .035 });
    noise({ dur: .13, vol: .13, filter: 950, type: "lowpass", delay: .035 });
    noise({ dur: .1, vol: .11, filter: 3700, delay: .1 });
    tone({ freq: 430, to: 180, type: "triangle", dur: .13, vol: .06, delay: .13 });
  } else if (id === "miss") {
    tone({ freq: 205, to: 105, type: "triangle", dur: .25, vol: .11, delay: .12 });
  } else if (id === "cheer") {
    noise({ dur: .7, vol: .11, filter: 850, q: .45 });
    noise({ dur: .54, vol: .065, filter: 1900, q: .6, delay: .1 });
    [523, 659, 784].forEach((freq, i) => tone({ freq, type: "triangle", dur: .2, vol: .065, delay: i * .075 }));
  } else if (id === "win") {
    SE.fanfare(); SE.crowd(1.2);
  } else if (id === "lose") {
    noise({ dur: .4, vol: .075, filter: 560, q: .5 });
    [260, 205, 155].forEach((freq, i) => tone({ freq, to: freq * .7, type: "triangle", dur: .22, vol: .08, delay: i * .13 }));
  }
}

/** 録音に差し替える前の合成音（試聴ページの聴き比べ用。ゲーム本編は SE を使う）。 */
export const SYNTH_SE = {};
/** 録音のある効果音のIDと、そのファイル（試聴ページ用）。 */
export const recordedSeFiles = () => Object.fromEntries(Object.entries(RECORDED_SE).map(([id, cue]) => [id, [...cue.files]]));
const lastPlayedAt = new Map();
for (const id of Object.keys(RECORDED_SE)) {
  const fallback = SYNTH_SE[id] = SE[id];
  const { minGap } = RECORDED_SE[id];
  SE[id] = (...args) => {
    if (minGap) {
      const now = Date.now();
      if (now - (lastPlayedAt.get(id) ?? -Infinity) < minGap * 1000) return;
      lastPlayedAt.set(id, now);
    }
    if (!recordedSe(id, Number(args[0]))) fallback(...args);
  };
}
// 好感度の段階が上がった時・恋人になった時: 同じベルを高さを変えて2回（1回目→完全5度上）。
SE.affinityUp = () => {
  if (!seEnabled()) return;
  const [file] = RECORDED_SE.affinity.files, { gain } = RECORDED_SE.affinity;
  if (!seBuffers.has(file)) {
    loadSeBuffer(file);
    tone({ freq: 1319, type: "sine", dur: 0.22, vol: 0.1 }); tone({ freq: 1976, type: "sine", dur: 0.36, vol: 0.1, delay: 0.13 });
    return;
  }
  recordedVoice(file, { gain });
  recordedVoice(file, { gain, rate: 1.5, delay: .13 });
};

export function playSe(id, ...args) {
  const key = String(id || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  (SE[key] || SE[id] || (() => {}))(...args);
}

/** CONTINUE専用SE。既存AudioContext/設定を共有し、離脱時は予約済みの音も止める。 */
export function createContinueAudio({ enabled = true } = {}) {
  let alive = true, paused = false, output = null, restore = 0, holdMix = 1;
  const voices = new Set();
  const ownsMusic = () => currentKey === "bgm_continue_urgent" || pendingBgm === "bgm_continue_urgent";
  function instrument() {
    const c = ensureCtx();
    if (!alive || paused || !enabled || !c || c.state !== "running" || document.hidden
      || config.mute || config.muted || !(config.seVolume > 0)) return null;
    if (!output) { output = c.createGain(); output.connect(seBus); }
    return c;
  }
  function track(source, gain, filter = null) {
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); filter?.disconnect(); };
  }
  function note(freq, { to = freq, dur = .09, vol = .15, delay = 0, type = "sine" } = {}) {
    const c = instrument();
    if (!c) return;
    const t = c.currentTime + delay, source = c.createOscillator(), gain = c.createGain();
    source.type = type;
    source.frequency.setValueAtTime(freq, t);
    source.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, t + dur);
    source.connect(gain).connect(output); track(source, gain);
    source.start(t); source.stop(t + dur + .015);
  }
  function air(dur = .2, vol = .05, frequency = 800) {
    const c = instrument();
    if (!c) return;
    const source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    source.buffer = buffer; filter.type = "bandpass"; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
    source.connect(filter).connect(gain).connect(output); track(source, gain, filter);
    source.start(); source.stop(c.currentTime + dur);
  }
  function mix(level, ms = 80) {
    if (!alive || !ownsMusic()) return;
    bgmDuck = level;
    if (currentEl) fadeEl(currentEl, () => bgmLevel("bgm_continue_urgent"), ms);
    if (bgmBus) {
      bgmBus.gain.cancelScheduledValues?.(ctx.currentTime);
      const target = config.mute || config.muted || bgmPaused || bgmSilences ? 0 : config.bgmVolume * level;
      if (bgmBus.gain.setTargetAtTime) bgmBus.gain.setTargetAtTime(target, ctx.currentTime, Math.max(.01, ms / 3000));
      else bgmBus.gain.value = target;
    }
  }
  function pulse(fn) {
    if (!alive || paused || !enabled || document.hidden || config.mute || config.muted || !(config.seVolume > 0)) return;
    if (!instrument()) return;
    fn(); mix(.8);
    clearTimeout(restore);
    restore = window.setTimeout(() => mix(holdMix, 140), 210);
  }
  function silence() {
    for (const source of voices) { try { source.stop(); } catch { /* 終了済み */ } }
    voices.clear();
  }
  return {
    start() { if (!alive) return; playBgm("bgm_continue_urgent"); pulse(() => { note(85, { to: 32, dur: .28, vol: .32 }); air(.26, .06, 650); }); },
    title() { pulse(() => { note(830, { to: 380, dur: .12, type: "triangle", vol: .09 }); note(1220, { dur: .07, vol: .035 }); }); },
    beat() { pulse(() => note(105, { to: 65, dur: .08, vol: .15 })); },
    // 日常の会話と同じ文字送りの声。BGMは下げず、離脱時は他のSEと一緒に止める。
    voice(speaker) {
      if (!instrument()) return;
      if (!config.voiceBlip) return note(1800, { dur: .02, vol: .03 });
      const f = (BLIP[speaker] || 600) * (.95 + Math.random() * .1);
      note(f, { dur: .045, vol: speaker === "sumi" ? .09 : .06, type: "triangle" });
    },
    // 通常の刻みは毎秒BGMをduckせず、他の予約SEと同じvoicesで停止する。
    tick() { note(1000, { dur: .04, vol: .045, type: "triangle" }); },
    count(remaining) {
      pulse(() => remaining === 0 ? note(70, { to: 45, dur: .2, vol: .22 })
        : note([990, 870, 780, 700, 620][remaining - 1], { dur: .07, vol: .13, type: "triangle" }));
    },
    quiet() { holdMix = Math.SQRT1_2; clearTimeout(restore); mix(holdMix, 160); },
    choose(choice, effect) {
      holdMix = .5;
      clearTimeout(restore); silence(); mix(holdMix, 120);
      if (choice === "retry") [523, 659, 784, 1047].forEach((f, i) => note(f, { dur: .15, delay: i * .075, type: "triangle", vol: .1 }));
      else { note(440, { dur: .15, vol: .08, type: "triangle" }); note(330, { dur: .2, delay: .13, vol: .07, type: "triangle" }); }
      if (effect === "pencil" || effect === "canvas") air(.18, .025, 2600);
      if (effect === "scan") note(choice === "retry" ? 600 : 800, { to: choice === "retry" ? 1500 : 250, dur: .3, vol: .025 });
      if (effect === "shark") note(220, { to: 440, dur: .12, vol: .045, delay: .2 });
    },
    expire() { holdMix = .1; clearTimeout(restore); mix(holdMix, 350); },
    setEnabled(value) { enabled = !!value; if (!enabled) { silence(); clearTimeout(restore); mix(holdMix); } },
    pause() {
      if (!alive) return;
      paused = true;
      silence(); clearTimeout(restore);
      if (!ownsMusic()) return;
      bgmPaused = true; currentEl?.pause(); resetBgmTempo(); mix(holdMix);
    },
    resume() {
      if (!alive) return;
      paused = false;
      if (!ownsMusic()) return;
      bgmPaused = false;
      if (currentEl && !rotateHeld) currentEl.play().catch(() => {});
      mix(holdMix);
    },
    cleanup() {
      if (!alive) return;
      clearTimeout(restore); silence(); output?.disconnect();
      if (ownsMusic()) stopBgm(.2);
      alive = false;
    },
  };
}

// ---------------------------------------------------------------- BGM

let currentKey = null;
let currentEl = null;
const retiringBgm = new Set();
let synthStop = null;
let pendingBgm = null;

// 実ファイルが無い曲の代用: key → 合成パターン
const SYNTH_FALLBACK = {
  bgm_growth_board: "board", // 静かな内省用。新しい音源の取得なしで鳴る専用ループ。
  bgm_tournament_edm: "battle",
  bgm_tournament_craft: "battle",
  bgm_tournament_wait: "tension",
  bgm_continue_urgent: "panic", // スミさんのコンティニュー: 原曲差替えまでは専用緊迫ループ
  bgm_result_emotional: "calm",
  bgm_map: "calm",
  bgm_rival_shop: "calm",
};

/** 今鳴っている曲のキー（自動再生待ちの間は null） */
export const currentBgm = () => currentKey;

/** 盤の間だけ曲を借りる。LOADや別場面の新しい曲を、閉じる処理で上書きしない。 */
export function createGrowthBoardAudio() {
  const previous = currentKey || pendingBgm;
  const previousDuck = bgmDuck;
  let alive = true;
  playBgm("bgm_growth_board");
  return (restore = true) => {
    if (!alive) return;
    alive = false;
    if ((currentKey || pendingBgm) !== "bgm_growth_board") return;
    if (restore && previous) {
      playBgm(previous);
      duckBgm(previousDuck, 0);
    } else stopBgm(.25);
  };
}
/** 今のBGMの寄せ（1＝そのまま。会話の duck 中は0.5）。テスト・診断用 */
export const bgmDuckLevel = () => bgmDuck;

// 新規大会曲は約 -14 LUFS にそろえる。設定変更・フェード中も曲ごとの倍率を保つ。
const BGM_GAIN = { sweets_or_sweets: 0.55, bgm_tournament_edm: 0.51, bgm_tournament_craft: 0.67, bgm_continue_urgent: 0.68, bgm_axe: 0.79 };
const bgmLevel = (key) => config.mute || config.muted || bgmPaused ? 0
  : config.bgmVolume * (BGM_GAIN[key] ?? 1) * bgmDuck;

// ラクダレース中はプレイヤー速度に、サンドボード中はブーストに合わせて、再生速度を緩やかに変える。
// PCでは音程を保ち、タッチ端末では音程補正の負荷を避ける。
let bgmTempo = 1, bgmTempoTarget = 1;
const TEMPO_EASE = 0.22;
const TEMPO_BGM = new Set(["bgm_camel_race", "bgm_ethnic05", "bgm_ethnic08", "bgm_ethnic12"]);

// 再生中の要素・src・currentTime は変えず、倍率だけ0.01刻みで反映する。
// タッチ端末は重い音程補正を使わず、音程も上がる再生で加速する。
const touchAudio = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const keepBgmPitch = key => !TEMPO_BGM.has(key) || !touchAudio();
function applyBgmPlaybackRate() {
  if (!currentEl || currentKey === "bgm_continue_urgent") return;
  const el = currentEl;
  const rate = TEMPO_BGM.has(currentKey) ? Math.round(bgmTempo * 100) / 100 : 1;
  const pitch = keepBgmPitch(currentKey);
  if (el.preservesPitch !== pitch) el.preservesPitch = pitch;
  if (Math.abs(el.playbackRate - rate) < 0.001) return;
  const wasPlaying = !el.paused;
  el.playbackRate = rate;
  if (wasPlaying) setTimeout(() => { if (currentEl === el && el.paused && !bgmPaused && !rotateHeld && !document.hidden) el.play().catch(() => {}); }, 150);
}

/** 今の曲の目標再生倍率。1.00〜1.25。immediate ならその場で反映。 */
export function setBgmPlaybackRate(rate, { immediate = false } = {}) {
  const next = Math.max(1, Math.min(1.25, Number(rate) || 1));
  bgmTempoTarget = next;
  if (immediate) {
    bgmTempo = next;
    applyBgmPlaybackRate();
  }
}

/** 再生倍率を 1.0 に戻す（レース終了・中断・退出、曲の切替）。 */
export function resetBgmTempo() {
  bgmTempo = 1;
  bgmTempoTarget = 1;
  applyBgmPlaybackRate();
}

/** 目標倍率へ時定数約0.22秒で寄せる。1フレームごとに dt（秒）を渡す。 */
export function tickBgmPlaybackRate(dt) {
  const t = Math.max(0, Number(dt) || 0);
  if (t > 0) {
    const k = 1 - Math.exp(-t / TEMPO_EASE);
    bgmTempo += (bgmTempoTarget - bgmTempo) * k;
    if (Math.abs(bgmTempo - bgmTempoTarget) < 0.001) bgmTempo = bgmTempoTarget;
  }
  applyBgmPlaybackRate();
  return bgmTempo;
}

export const bgmPlaybackRate = () => bgmTempo;

// 単体MP3の再配布を避けるゲーム専用形式（pack_bgm.py と対応）。HTTPS/localhostで復元する。
const PACKED_MAGIC = "SUIENBGM1";
const PACKED_KEY = "ac0152dff6217d519198cfba347e25d5dc5d853aaee8252f72da0bbdc626b8f2";
const packedSources = new Map();
// 復元済み Blob の保持は直近分だけに絞る（1曲2〜4.6MB、全10曲で約31MBが
// セッション中ずっと残り続けるのを防ぐ）。再生中・フェード中・復元したばかりの曲は破棄しない。
const PACKED_CACHE_MAX = 5;
const packedBlobs = new Map(); // url -> blobUrl（解決済みのみ。挿入順＝古い順）
const packedInUse = new Set(); // 要素へ割り当て済みの blobUrl（止まるまで解放しない）
let packedCryptoKey = null;

function evictPacked(keepUrl = null) {
  while (packedBlobs.size > PACKED_CACHE_MAX) {
    const victim = [...packedBlobs.keys()].find((u) => u !== keepUrl
      && !packedInUse.has(packedBlobs.get(u)) && packedBlobs.get(u) !== currentEl?.src);
    if (!victim) return; // 全候補が使用中なら一時的に上限を超えてよい
    const evicted = packedBlobs.get(victim);
    packedBlobs.delete(victim);
    packedSources.delete(victim); // 次に必要になったら取得・復元し直す
    if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(evicted);
  }
}

function retainPacked(url, blobUrl) {
  packedBlobs.delete(url);
  packedBlobs.set(url, blobUrl);
  evictPacked(url);
}

// 要素が止まったら使用中を外し、たまっていた破棄を進める。
function releasePacked(blobUrl) {
  if (blobUrl && packedInUse.delete(blobUrl)) evictPacked();
}

function bgmSource(url) {
  if (!url.endsWith(".bgm")) return Promise.resolve(url);
  if (!packedSources.has(url)) {
    const source = (async () => {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = globalThis.setTimeout?.(() => controller?.abort(), 8000);
      let response, raw;
      try {
        response = await fetch(url, controller ? { signal: controller.signal } : undefined);
        if (!response.ok) throw new Error(`BGM HTTP ${response.status}`);
        raw = await response.arrayBuffer();
      } finally { globalThis.clearTimeout?.(timer); }
      const bytes = new Uint8Array(raw);
      const header = bytes.subarray(0, PACKED_MAGIC.length);
      if (bytes.length < PACKED_MAGIC.length + 12 + 16 || new TextDecoder().decode(header) !== PACKED_MAGIC) {
        throw new Error("Invalid game BGM format");
      }
      packedCryptoKey ??= crypto.subtle.importKey("raw",
        Uint8Array.from(PACKED_KEY.match(/../g), (hex) => parseInt(hex, 16)), "AES-GCM", false, ["decrypt"]);
      const audio = await crypto.subtle.decrypt({ name: "AES-GCM",
        iv: bytes.subarray(PACKED_MAGIC.length, PACKED_MAGIC.length + 12), additionalData: header },
      await packedCryptoKey, bytes.subarray(PACKED_MAGIC.length + 12));
      return URL.createObjectURL(new Blob([audio], { type: "audio/mpeg" }));
    })();
    packedSources.set(url, source);
    source.then((blobUrl) => {
      try { retainPacked(url, blobUrl); } catch { /* 保持管理の失敗で再生を止めない */ }
    }, () => { packedSources.delete(url); }); // 一時的な取得失敗は次回に再試行できる。
  } else if (packedBlobs.has(url)) {
    const blobUrl = packedBlobs.get(url); // 使った曲は新しい側へ寄せ、破棄順を後ろにする
    packedBlobs.delete(url);
    packedBlobs.set(url, blobUrl);
  }
  return packedSources.get(url);
}

// 外部MP3のCONTINUE曲も、URLの解決だけでなく再生可能なところまで準備する。
// 演出開始時はこの要素を受け取り、遅い回線では専用の合成曲へ切り替える。
let preparedContinue = null;
function prepareContinueBgm(url) {
  if (preparedContinue?.url === url) return preparedContinue.ready;
  const audio = new Audio(url);
  audio.preload = "auto";
  const prepared = { url, audio, ready: null };
  prepared.ready = new Promise(resolve => {
    let timer;
    const finish = loaded => {
      clearTimeout(timer);
      audio.removeEventListener("canplay", loadedTrack);
      audio.removeEventListener("error", failedTrack);
      resolve(loaded);
    };
    const loadedTrack = () => finish(true), failedTrack = () => finish(false);
    audio.addEventListener("canplay", loadedTrack, { once: true });
    audio.addEventListener("error", failedTrack, { once: true });
    timer = setTimeout(failedTrack, 2000);
    audio.load();
    if (audio.readyState >= 3) loadedTrack();
  });
  preparedContinue = prepared;
  return prepared.ready;
}

// 圧縮音源のまま最大3曲を保持する。全曲のPCMデコードや一括取得はしない。
// canplay は再生開始可能の目安。iOSの自動再生許可を得たことにはしない。
const preparedBgm = new Map();
const BGM_PREPARE_MAX = 3;
function discardPrepared(entry) {
  entry.cancel?.();
  entry.audio.pause();
  releasePacked(entry.audio.src);
  entry.audio.removeAttribute("src");
  entry.audio.load();
}

/** 必要になった1曲だけ、取得・復号とAudio要素の再生準備まで待つ。失敗は次回再試行。 */
export function preloadBgm(key) {
  const url = bgmUrl(key);
  if (!url) return Promise.resolve(false);
  // HTMLMediaElementを持たない環境ではURLの復元まで。
  if (typeof Audio.prototype.load !== "function") return bgmSource(url).then(() => true, () => false);
  if (key === currentKey && currentEl) {
    const audio = currentEl;
    if (audio.readyState >= 3) return Promise.resolve(true);
    if (audio.error) return Promise.resolve(false);
    // 直前の呼び出しが既に再生要求した曲は、別のAudio要素を作らず同じ読込を待つ。
    if (typeof audio.removeEventListener !== "function") return Promise.resolve(false);
    return new Promise(resolve => {
      const finish = loaded => {
        clearTimeout(timer);
        audio.removeEventListener("canplay", loadedTrack);
        audio.removeEventListener("error", failedTrack);
        resolve(loaded);
      };
      const loadedTrack = () => finish(true), failedTrack = () => finish(false);
      audio.addEventListener("canplay", loadedTrack, { once: true });
      audio.addEventListener("error", failedTrack, { once: true });
      const timer = setTimeout(failedTrack, 8000);
    });
  }
  if (key === "bgm_continue_urgent" && !url.endsWith(".bgm")) return prepareContinueBgm(url);
  if (preparedBgm.has(url)) return preparedBgm.get(url).ready;
  while (preparedBgm.size >= BGM_PREPARE_MAX) {
    const [oldUrl, old] = preparedBgm.entries().next().value;
    preparedBgm.delete(oldUrl); discardPrepared(old);
  }
  const entry = { audio: new Audio(), loaded: false, ready: null };
  entry.audio.preload = "auto";
  entry.ready = new Promise(resolve => {
    let settled = false;
    const finish = loaded => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      entry.audio.removeEventListener("canplay", loadedTrack);
      entry.audio.removeEventListener("error", failedTrack);
      entry.cancel = null;
      entry.loaded = loaded;
      if (!loaded) {
        if (preparedBgm.get(url) === entry) preparedBgm.delete(url);
        discardPrepared(entry);
      }
      resolve(loaded);
    };
    const loadedTrack = () => finish(true), failedTrack = () => finish(false);
    entry.cancel = failedTrack;
    entry.audio.addEventListener("canplay", loadedTrack);
    entry.audio.addEventListener("error", failedTrack);
    const timer = setTimeout(failedTrack, 8000); // 通信・復号・メディア準備の合計上限
    bgmSource(url).then(source => {
      if (settled) return; // タイムアウト/破棄後の遅い完了を再生へ持ち越さない。
      packedInUse.add(source);
      entry.audio.src = source;
      entry.audio.load();
      if (entry.audio.readyState >= 3) loadedTrack();
    }, failedTrack);
  });
  preparedBgm.set(url, entry);
  return entry.ready;
}

export function playBgm(key) {
  // 取得・復号の失敗で要素を手放した曲は、同じキーでも次の要求で再試行する。
  if (key === currentKey && currentEl && !preparedBgm.has(bgmUrl(key))) return;
  stopBgm(0.6);
  currentKey = key;
  if (!key) return;
  const c = ensureCtx();
  if (!c || c.state === "suspended" || c.state === "interrupted") { pendingBgm = key; currentKey = null; return; }
  const url = bgmUrl(key);
  if (url) {
    const packed = url.endsWith(".bgm");
    const cached = preparedBgm.get(url);
    const prepared = key === "bgm_continue_urgent" && preparedContinue?.url === url ? preparedContinue
      : cached || null;
    if (cached) preparedBgm.delete(url);
    if (prepared && prepared === preparedContinue) preparedContinue = null;
    if (key === "bgm_continue_urgent" && prepared && prepared.audio.readyState < 3) {
      prepared.audio.removeAttribute("src"); prepared.audio.load();
      synthStop = startSynth(SYNTH_FALLBACK[key]);
      return; // 外部曲を待っている間に、20秒のカウントだけ進ませない。
    }
    const a = prepared?.audio || (packed ? new Audio() : new Audio(url));
    a.preload = "auto";
    a.muted = bgmSilences > 0;
    a.loop = true;
    a.volume = 0;
    resetBgmTempo();
    a.playbackRate = key === "bgm_continue_urgent" ? 1.08 : 1; // EMGコール(BPM115)を少しだけ高速化
    a.preservesPitch = keepBgmPitch(key);
    currentEl = a;
    const fallBackContinue = () => {
      if (currentEl !== a || key !== "bgm_continue_urgent") return false;
      currentEl = null;
      a.pause();
      releasePacked(a.src);
      if (SYNTH_FALLBACK[key]) synthStop = startSynth(SYNTH_FALLBACK[key]);
      return true;
    };
    const retryOnGesture = () => {
      if (currentEl !== a) return;
      currentEl = null;
      a.pause();
      releasePacked(a.src);
      pendingBgm = key;
    };
    a.addEventListener("error", () => { if (!fallBackContinue()) retryOnGesture(); }, { once: true });
    const start = () => {
      if (currentEl !== a) return; // 読み込み中に別曲へ移った場合、古い曲を鳴らさない。
      if (rotateHeld) { a.volume = bgmLevel(key); return; } // 回転ガード中に替わった曲は、横に戻した時に鳴らし始める
      a.play().catch(() => {
        if (!fallBackContinue() && currentEl === a) {
          pendingBgm = key;
        }
      });
      fadeEl(a, () => bgmLevel(key), key === "bgm_continue_urgent" ? 160 : 1200);
    };
    if (cached && !cached.loaded) {
      // 先読み中に再生要求が追いついても同じ要素を引き継ぐ。完了前に曲を替えたら破棄。
      cached.ready.then(ready => {
        if (currentEl !== a) { discardPrepared(cached); return; }
        if (ready) start();
        else {
          retryOnGesture();
          if (SYNTH_FALLBACK[key]) synthStop = startSynth(SYNTH_FALLBACK[key]);
        }
      });
    } else if (prepared) start();
    else if (packed) {
      bgmSource(url).then((source) => {
        if (currentEl !== a) return;
        packedInUse.add(source); // 止まるまで Blob を解放しない
        a.src = source;
        start();
      }, (error) => {
        if (currentEl !== a) return;
        retryOnGesture();
        if (SYNTH_FALLBACK[key]) synthStop = startSynth(SYNTH_FALLBACK[key]);
        console.warn("[BGM] Could not load game audio", key, error);
      });
    } else start();
  } else if (SYNTH_FALLBACK[key]) {
    synthStop = startSynth(SYNTH_FALLBACK[key]);
  }
}

/** 一時的に BGM だけを無音にする。曲切替や音声解禁をまたぎ、解除関数は一度だけ有効。 */
export function silenceBgm() {
  bgmSilences++;
  if (currentEl) currentEl.muted = true;
  for (const a of retiringBgm) a.muted = true;
  bgmBus?.gain.cancelScheduledValues?.(ctx.currentTime);
  if (bgmBus) bgmBus.gain.value = 0;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--bgmSilences) return;
    if (currentEl) currentEl.muted = false;
    for (const a of retiringBgm) a.muted = false;
    bgmBus?.gain.cancelScheduledValues?.(ctx.currentTime);
    if (bgmBus) bgmBus.gain.value = config.mute || config.muted || bgmPaused ? 0 : config.bgmVolume * bgmDuck;
  };
}

/**
 * 会話の「BGMの息継ぎ」（#2828）: 今の曲だけを level 倍へ ms かけて寄せる（0.5 ≒ −6dB、1 で戻す）。
 * 音量設定・曲ごとの補正は保ち、曲を替えると stopBgm が元の音量へ戻す。
 */
export function duckBgm(level = 1, ms = 150) {
  if (bgmDuck === level) return;
  bgmDuck = level;
  if (currentEl) fadeEl(currentEl, () => bgmLevel(currentKey), ms);
  if (bgmBus) {
    const target = config.mute || config.muted || bgmPaused || bgmSilences ? 0 : config.bgmVolume * level;
    bgmBus.gain.cancelScheduledValues?.(ctx.currentTime);
    if (bgmBus.gain.setTargetAtTime) bgmBus.gain.setTargetAtTime(target, ctx.currentTime, Math.max(.01, ms / 3000));
    else bgmBus.gain.value = target;
  }
}

export function stopBgm(fadeSec = 0.8) {
  currentKey = null;
  pendingBgm = null;
  if (currentEl) {
    const a = currentEl;
    currentEl = null;
    retiringBgm.add(a);
    fadeEl(a, 0, fadeSec * 1000).then((finished) => {
      if (finished) { a.pause(); releasePacked(a.src); }
      retiringBgm.delete(a);
    });
  }
  if (synthStop) { synthStop(fadeSec); synthStop = null; }
  bgmDuck = 1;
  bgmPaused = false;
  resetBgmTempo();
  bgmBus?.gain.cancelScheduledValues?.(ctx.currentTime);
  if (bgmBus) bgmBus.gain.value = config.mute || config.muted || bgmSilences ? 0 : config.bgmVolume;
}

const elFades = new WeakMap();
function fadeEl(a, to, ms) {
  return new Promise((res) => {
    elFades.get(a)?.(false); // 前のフェードを止め、切替途中の音量の再上昇を防ぐ。
    const finish = (completed) => {
      if (elFades.get(a) === finish) elFades.delete(a);
      res(completed);
    };
    elFades.set(a, finish);
    const from = a.volume;
    const t0 = performance.now();
    const step = () => {
      if (elFades.get(a) !== finish) return;
      const k = ms <= 0 ? 1 : Math.min(1, (performance.now() - t0) / ms);
      const target = typeof to === "function" ? to() : to;
      a.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) requestAnimationFrame(step); else finish(true);
    };
    step();
  });
}

// 合成BGM: 小さなステップシーケンサ。battle=四つ打ち＋ベースのアルペジオ（大会の熱）、
// tension=心音のようなキックとパッド（控室）、calm=柔らかいパッド
function startSynth(kind) {
  const c = ensureCtx();
  const out = c.createGain();
  out.gain.value = 0;
  out.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
  out.connect(bgmBus);
  const bpm = kind === "panic" ? 168 : kind === "battle" ? 124 : kind === "tension" ? 80 : 68;
  const stepDur = 60 / bpm / 4;
  const bass = kind === "battle" ? [45, 45, 57, 45, 48, 48, 60, 48, 43, 43, 55, 43, 41, 41, 53, 52] : [45, 0, 0, 0, 43, 0, 0, 0, 41, 0, 0, 0, 40, 0, 0, 0];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let step = 0;
  let next = c.currentTime + 0.05;
  const startAt = next;
  let alive = true;

  const voice = (freq, t, dur, type, vol) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const kick = (t, vol) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.3);
  };
  const hat = (t, vol) => {
    const len = Math.floor(c.sampleRate * 0.04);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(out);
    s.start(t);
  };

  const schedule = () => {
    if (!alive) return;
    if (bgmPaused) { next = c.currentTime + .05; setTimeout(schedule, 60); return; }
    while (next < c.currentTime + 0.25) {
      const s = step % 16;
      if (kind === "battle") {
        if (s % 4 === 0) kick(next, 0.5);
        if (s % 4 === 2) hat(next, 0.12);
        if (s % 2 === 1) hat(next, 0.05);
        const n = bass[s];
        if (n) voice(mtof(n), next, stepDur * 0.9, "sawtooth", 0.07);
        if (s === 0 && step % 64 === 0) [69, 72, 76].forEach((m) => voice(mtof(m), next, stepDur * 14, "triangle", 0.03));
      } else if (kind === "panic") {
        // 同期的な鼓動と追い立てる低音。短い台詞の可聴域を空けた軽い合成ループ。
        if (s === 0 || s === 7 || s === 10) kick(next, s === 0 ? 0.44 : 0.24);
        if (s % 2 === 1) hat(next, 0.035);
        if (s === 3 || s === 11) hat(next, 0.08);
        const n = [40,0,40,0,43,0,40,0,38,0,38,0,35,0,38,0][s];
        if (n) voice(mtof(n), next, stepDur * 1.6, "triangle", 0.042);
        if (s === 0 && step % 32 === 0) voice(mtof(52), next, stepDur * 26, "sine", 0.023);
      } else if (kind === "board") {
        // 4小節で戻る暖かなパッドと、火種を思わせる疎らな高音。打楽器は置かない。
        const chords = [[48, 55, 62, 64], [45, 52, 59, 60], [41, 48, 55, 57], [43, 50, 57, 59]];
        const chord = chords[Math.floor(step / 16) % chords.length];
        if (s === 0) chord.forEach(m => voice(mtof(m), next, stepDur * 18, "sine", .018));
        if (s === 4 || s === 12) voice(mtof(chord[s === 4 ? 2 : 3] + 12), next, stepDur * 5, "sine", .022);
      } else if (kind === "tension") {
        if (s === 0 || s === 3) kick(next, s === 0 ? 0.35 : 0.22);
        if (s === 0 && step % 32 === 0) [57, 60, 64].forEach((m) => voice(mtof(m), next, stepDur * 30, "sine", 0.025));
        if (s % 4 === 2) hat(next, 0.03);
      } else {
        if (s === 0 && step % 32 === 0) [bass[(step / 16) % 16] || 45, 57, 64, 67].forEach((m) => voice(mtof(m + 12), next, stepDur * 30, "sine", 0.02));
      }
      // コンティニュー専用: 前半168 BPM → 20秒後196 BPM。諦めさせない圧迫感。
      const panicBpm = 168 + Math.min(28, Math.max(0, next - startAt) * 1.4);
      next += kind === "panic" ? 60 / panicBpm / 4 : stepDur;
      step++;
    }
    setTimeout(schedule, 60);
  };
  schedule();
  return (fadeSec = 0.8) => {
    alive = false;
    out.gain.cancelScheduledValues(c.currentTime);
    out.gain.setValueAtTime(out.gain.value, c.currentTime);
    out.gain.linearRampToValueAtTime(0, c.currentTime + fadeSec);
    setTimeout(() => out.disconnect(), fadeSec * 1000 + 200);
  };
}




