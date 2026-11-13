import { DJAudio } from './audio.mjs';
import { beatAt, lowCutDb, PHRASE, FOLLOW_BAND, REQUESTS, phaseError, SNAP_BAND, SYNC_FLOOR, mod, gains, toward, keyMatch, energyMatch, quality, followHint, moodOf, MOODS, GRADE_FLOOR, RANK_FLOOR, PICK_FLOOR, RANK_LINES, quickEntry } from './model.mjs';
import { FEEL, applyFeelOverrides } from './feel.mjs';
import { DJSfx } from './sfx.mjs';
import { TRACKS, SETS } from './tracks.mjs';
// View of the DJ set (2026-11-11 renewal, DJS20〜). Three things the screen always answers:
//   1. いま何をするか — the navi line + the gold arrow on the control to touch (▶ / 横フェーダー / ズレた時の皿).
//   2. お客さんがどう感じたか — the floor: heat meter with a mood word, the crowd getting brighter and raising hands, voices in speech bubbles.
//   3. どこまで進んだか — the four step lamps (かける → 入れる → つなぐ → えらぶ).
// Rules and scoring live in model.mjs; nothing here changes them.
const $ = id => document.getElementById(id);
// The host (main game) picks the set with ?set=1..3 (?stage= is the old name); default SET 1.
const params = new URLSearchParams(location.search);
const setParam = Number(params.get('set') || params.get('stage')) - 1;
const setIndex = SETS[setParam] ? setParam : 0;
// ?embed=1: opened by the main game (remake/js/minigames/dj.js). Shows ← 戻る and follows the game's mute / BGM volume (?mute=1, ?vol=0..1).
const embedded = params.get('embed') === '1' && window.parent !== window;
// ?phone=1: the main game's phone density (html[data-density=phone]). Display only: bigger text / parts, fewer labels (style.css).
if (params.get('phone') === '1') document.documentElement.dataset.density = 'phone';
const gameVolume = Number(params.get('vol')), gameMuted = params.get('mute') === '1';
// ?phones=1: the player's own monitor headphones (main game VOL07). Every ▶ timing window is 10 ms wider; shown in the set info.
const phones = params.get('phones') === '1', ALLOWANCE_MS = phones ? 10 : 0;
// ?best=0..100: the player's best total for this set so far (main game). The result card says how far the new total is from it.
const bestParam = Number(params.get('best'));
let best = params.has('best') && Number.isFinite(bestParam) && bestParam >= 0 && bestParam <= 100 ? Math.round(bestParam) : null;
applyFeelOverrides(params.get('feel')); // ?feel=hold.PERFECT:140,… (feel.mjs)
const tell = message => { try { if (embedded) window.parent.postMessage(message, location.origin); } catch { /* host optional */ } };
const reduced = matchMedia('(prefers-reduced-motion: reduce)'), coarse = matchMedia('(pointer: coarse)');
const THUMB = document.documentElement.dataset.density === 'phone' ? 72 : 54; // crossfader cap width (style.css)
const sideOf = id => id ? '右' : '左', deckOf = id => id ? 'B' : 'A';
const pickOne = list => list[Math.floor(Math.random() * list.length)];
let audio, disposed = false, frame = 0, view = { mode: 'idle' }, message = '', subMessage = '', toastUntil = 0, judgeUntil = 0, shownPlay = null, lastCount = '', shownTracks = [null, null], shownSelect = null;
let moodShown = null, helpManual = null, missStreak = 0, awaySince = 0, awaySaid = false, clashSince = 0, clashSaid = false, comboSaid = 0, shown = {}, particles = [];
const SHAKES = ['shake-drop', 'shake-sway', 'shake-big', 'shake-stumble'];
const STRIPS = 7, STRIP_OVERLAP = 3; // the guests' band: 7 strips, each overlapping its neighbours by 3 % of the width (see buildBand)
let strips = [], flash = 0, sfx = null;
// 手応え（2026-11-13 DJF）: 止め・跳ね・揺れ・余韻のいまの状態。数値は feel.mjs の FEEL。コンソールの __dj.feel / __dj.fx で読み書きできる。
const fx = { fixes: 0, nopes: 0, pending: null, holdUntil: 0, holdBeat: 0, holds: 0, burst: 1, burstBeat: 0, shakes: 0, lastShake: '', ticks: new Set(), tickCount: 0, combo: 0, brokenUntil: 0, result: null, count: null, played: false };
globalThis.__dj = { feel: FEEL, fx,
  /** 調整用: つなぎの最中に、いますぐズレを起こす（拍。+ = 入れた曲が先へ走る）。例: __dj.slip(-0.2) */
  slip(beats = .15) { const m = audio.mix; if (m.phase !== 'mix' || !m.fader || !Number.isFinite(beats) || !beats) return false; m.fader.drifts.push({ at: beatAt(m.decks[m.cue.from], audio.now) - m.cue.start, size: beats, started: false, ended: false }); return true; } };
document.addEventListener('dj-nope', () => { sfx?.play('nope'); fx.nopes++; });
const buzz = pattern => { if (pattern && coarse.matches && navigator.vibrate) try { navigator.vibrate(pattern); } catch { /* unsupported */ } };
const status = text => { $('status').textContent = text; };
/** Write text only when it changes (the render loop runs every frame; an unchanged write would still dirty the layout). */
const put = (id, text) => { const el = $(id); if (el.textContent !== text) el.textContent = text; };
// DJS33 (「処理重そう」): per-frame style writes only when the value changes, and the layout is read at most twice a second.
// Reading offsetWidth after the frame's style writes forced a full style + layout pass on every frame.
const written = new Map();
const setVar = (el, name, value) => { const k = `${el.id}|${name}`; if (written.get(k) !== value) { written.set(k, value); el.style.setProperty(name, value); } };
const setAttr = (el, name, value) => { const k = `${el.id}@${name}`; if (written.get(k) !== value) { written.set(k, value); el.setAttribute(name, value); } };
const setStyle = (el, prop, value) => { const k = `${el.id}.${prop}`; if (written.get(k) !== value) { written.set(k, value); el.style[prop] = value; } };
const geo = { at: -1e9, stageW: 1280, faderLeft: 0, faderW: 400, laneW: 960, laneH: 80 };
function measure(t) {
  if (t - geo.at < 500) return;
  geo.at = t; const fader = $('crossfader'), lane = $('wave-a');
  geo.stageW = $('dj-stage').offsetWidth || 1280; geo.faderLeft = fader.offsetLeft; geo.faderW = fader.offsetWidth;
  geo.laneW = Math.max(320, Math.round(lane.clientWidth * 2)); geo.laneH = Math.max(40, Math.round(lane.clientHeight * 2)); // 2 canvas px per CSS px
}
addEventListener('resize', () => { geo.at = -1e9; });
function create() {
  audio = new DJAudio(undefined, { setIndex, allowance: ALLOWANCE_MS, entry: quickEntry(SETS[setIndex]) }); sfx = new DJSfx(audio);
  if (embedded) { audio.muted = gameMuted; if (Number.isFinite(gameVolume)) audio.volume = Math.max(0, Math.min(.36, .18 * gameVolume / .5)); }
  audio.onInterrupted = () => status('音声が中断されました。▶で再開します。');
  shownTracks = [undefined, undefined]; shownSelect = null; $('pick').hidden = true;
  $('set-name').textContent = SETS[setIndex].name; $('set-gear').textContent = phones ? `ヘッドホン：▶の判定が${ALLOWANCE_MS}ms広い` : ''; $('score-result').innerHTML = ''; $('judge').textContent = ''; $('judge-sub').textContent = ''; $('toast').innerHTML = '';
  $('voices').replaceChildren(); $('heat-delta').className = 'heat-delta'; $('crossfader').value = '0';
  view = { mode: 'idle' }; shownPlay = null; judgeUntil = 0; toastUntil = 0; moodShown = null; missStreak = 0; awaySince = 0; awaySaid = false; clashSince = 0; clashSaid = false; comboSaid = 0; particles = []; flash = 0;
  helpManual = fx.played ? false : null; // DJF08: the how-to board only before the very first set; a retry goes straight back to the decks
  Object.assign(fx, { pending: null, holdUntil: 0, burst: 1, combo: 0, brokenUntil: 0, result: null, count: null }); fx.ticks.clear();
  $('floor-art').classList.remove('hold', ...SHAKES); $('drop').className = 'drop'; $('drop').textContent = ''; $('combo').classList.remove('broken', 'pop');
  shown = {}; message = ''; subMessage = ''; lastCount = ''; $('count').textContent = '';
  showDecks();
}
/** Deck titles and artwork follow the decks (a deck is empty while the next track is being picked). */
function showDecks() {
  audio.mix.decks.forEach((d, id) => {
    const state = d.track ?? (audio.mix.phase === 'done' ? 'done' : null);
    if (shownTracks[id] === state) return;
    shownTracks[id] = state; const key = id ? 'b' : 'a', t = TRACKS[d.track];
    $('track-' + key).textContent = t ? t.title : state === 'done' ? '—' : '— 選曲中 —';
    $('platter-' + key).style.setProperty('--art', t ? `url('../../img/ui/dj/art-${d.track}.webp')` : 'none');
  });
}
buildBand();
create();
export function snapshot() {
  const now = audio.now, m = audio.mix;
  return { set: setIndex, phase: m.phase, mode: view.mode, clock: now, state: audio.context?.state || 'not-started', running: m.running,
    tracks: m.decks.map(d => d.track), bpms: m.decks.map(d => d.bpm), sync: view.sync ? { ...view.sync } : null, jog: shown.jog || '',
    beats: m.decks.map(d => beatAt(d, now)), playing: m.decks.map(d => d.playing), phase_error: phaseError(...m.decks, now),
    mix: m.mix, master: m.master, cue: m.cue ? { ...m.cue } : null, lastPlay: m.lastPlay, floor: m.floor, fader: m.fader ? { reached: m.fader.reached, checks: m.fader.checks, hits: m.fader.hits, combo: m.fader.combo, inTime: m.fader.inTime, off: m.fader.off, fixes: m.fader.fixes, drifts: m.fader.drifts.map(d => ({ ...d })) } : null,
    select: m.select ? { ...m.select, options: [...m.select.options] } : null, played: [...m.played], count: m.count, guide: view.guide, follow: view.follow,
    transitions: m.transitions.map(t => ({ to: t.to, grade: t.grade, parts: t.parts, total: t.total, rank: t.rank, pick: t.pick, combo: t.combo, follow: t.follow, sync: t.sync, drifts: t.drifts, fixes: t.fixes })), result: m.result,
    allowance: m.allowance, voices: audio.voices.filter(Boolean).length, rms: audio.level(), reduced: reduced.matches, embedded, muted: audio.muted, volume: audio.volume, remaining: view.remaining, progress: view.progress,
    // what the screen is telling the player (DJS20): crowd mood, step lamp, navi lines, gold arrows, fader hint
    grid: m.grid, best, fx: { fixes: fx.fixes, nopes: fx.nopes, holds: fx.holds, held: !!fx.pending, shakes: fx.shakes, lastShake: fx.lastShake, ticks: fx.tickCount, sfx: sfx.count, lastSfx: sfx.last, afterglow: !!fx.result && !fx.result.shown, counting: !!fx.count, result: !!fx.result?.shown },
    mood: moodOf(m.floor), step: shown.step, navi: message, sub: subMessage, points: shown.points, hint: shown.hint, away: shown.away, arrows: !$('fader-arrows').hidden };
}
async function pause() { try { await audio.pause(); status('停止中。▶で再開します。'); } catch (e) { status(`停止処理: ${e.message}`); } }
for (const id of [0, 1]) {
  const key = id ? 'b' : 'a';
  $('play-' + key).addEventListener('click', () => startDeck(id));
}
async function startDeck(id) {
  const key = id ? 'b' : 'a';
  if (audio.mix.decks[id].playing) return; // ▶ only starts: a deck leaves the air when its transition ends
  // after an interruption (tab hidden, audio session lost) any ▶ brings back every deck that was playing, in step
  const m = audio.mix, resume = !m.running && m.phase !== 'idle' && m.resumeDecks.length > 0;
  try { if (await (resume ? audio.start() : audio.play(id))) { helpManual = null; fx.played = true; if (document.hidden) { await pause(); return; } status(resume ? '再開' : `${key.toUpperCase()} ON AIR`); } }
  catch (e) { status(`${e.message}。▶から再試行できます。`); }
}
// ── お客さんの反応: 声の吹き出し・熱の増減の札・気分の言葉 ──────────────────────────────
const VOICES = {
  PERFECT: ['きたー！', '今の入り、最高！', 'ぴったり！'], GOOD: ['いい入り！', 'お、いいね'], OK: ['うん、入った', 'わるくない'],
  EARLY: ['あれ、早くない？', 'つんのめった…'], LATE: ['ん、遅れた？', 'ちょっとズレた…'],
  combo8: ['気持ちいい…', 'なめらか！'], combo16: ['このつなぎ、好き！', 'ずっと踊れる！'], combo24: ['うますぎ！', '止まらない！'], combo32: ['完璧！！'],
  clash: ['音がごちゃついてる…', 'なんか、ぶつかってない？'], quiet: ['音、小さくない？', 'あれ、止まった？'],
  S: ['最高のつなぎ！', 'フゥー！！'], A: ['いいね！', 'ノれる！'], B: ['まあまあかな'], C: ['うーん…', '踊りづらい…'],
  '◎': ['これ待ってた！', 'わかってる！'], '○': ['お、いいじゃん'], '△': ['今それじゃない…', 'えー…'],
  cold: ['なんか冷めてきた…', '帰ろっかな…'], peak: ['最高潮！！'], skip: ['あれ、まだかな？', '次の曲、まだ？'],
  slip: ['ん、ズレてきた？', '拍がバラけてる…'], fix: ['お、戻った！', 'ぴたっと来た！'],
};
const COLD = new Set(['EARLY', 'LATE', 'clash', 'quiet', 'C', '△', 'cold', 'slip']);
let voiceSlot = 0;
/** One guest speaks: a bubble over the crowd (three places, taken in turn). */
function say(kind, { big = false, text = null, slot = null } = {}) {
  const box = $('voices'), at = slot ?? (voiceSlot = (voiceSlot + 1) % 3);
  for (const old of [...box.children]) if (old.dataset.slot === String(at)) old.remove();
  const p = document.createElement('p'); p.className = `voice${COLD.has(kind) ? ' cold' : ''}${big ? ' big' : ''}`; p.dataset.slot = String(at); p.dataset.kind = kind;
  p.textContent = text ?? pickOne(VOICES[kind]); p.addEventListener('animationend', () => p.remove()); box.append(p);
}
/** A step of the heat meter with its reason, next to the meter. */
function bump(delta, label) {
  if (!delta) return;
  const el = $('heat-delta'); el.textContent = `${delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta * 100))}　${label}`;
  el.className = `heat-delta ${delta > 0 ? 'up' : 'down'}`; void el.offsetWidth; el.classList.add('show');
}
function showMood(m) {
  const mood = moodOf(m.floor);
  if (mood === moodShown) return;
  $('floor').dataset.mood = String(mood); const word = $('mood'); word.textContent = MOODS[mood]; word.classList.remove('pop'); void word.offsetWidth; word.classList.add('pop');
  if (moodShown != null && m.running) { if (mood === 4 && mood > moodShown) say('peak', { big: true, slot: 1 }); else if (mood <= 1 && mood < moodShown) say('cold'); }
  moodShown = mood;
}
// 選曲: two candidate cards. The guests' request (ノリ) and the key (つながり) decide how well the pick lands.
function renderPick(select) {
  const m = audio.mix, now = m.decks[m.master];
  $('pick').dataset.side = select.deck === 0 ? 'a' : 'b'; $('request').innerHTML = `<small>お客さんの声</small>「${REQUESTS[select.request]}」`;
  $('pick-cards').replaceChildren(...select.options.map((key, index) => {
    const t = TRACKS[key], keyOk = keyMatch(now.track, key), askOk = energyMatch(select.request, now.track, key), d = t.energy - TRACKS[now.track].energy;
    const button = document.createElement('button'); button.type = 'button'; button.id = `pick-${index}`; button.className = 'pick-card';
    const flames = Array.from({ length: 5 }, (_, i) => `<i${i < t.energy ? '' : ' class="off"'}></i>`).join('');
    button.innerHTML = `<span class="pick-art" style="--art:url('../../img/ui/dj/art-${key}.webp')"></span><b>${t.title}</b>`
      + `<span class="pick-row"><small>ノリ</small><span class="energy" aria-label="盛り上がり ${t.energy}／5">${flames}</span><span>${d > 0 ? '今より上がる ↑' : d < 0 ? '今より落ち着く ↓' : '今と同じくらい →'}</span></span>`
      + `<span class="pick-row marks"><em class="${askOk ? 'ok' : 'ng'}">${askOk ? '✓ 声に合う' : '✕ 声と違う'}</em><em class="${keyOk ? 'ok' : 'ng'}">${keyOk ? '✓ なめらかにつながる' : '✕ 音がぶつかる'}</em></span>`
      + `<span class="pick-meta">キー ${t.camelot}・${t.bpm} BPM${m.set.detune === 'match' && t.bpm !== now.bpm ? ` → ${now.bpm.toFixed(0)}（自動）` : ''}</span>`;
    button.addEventListener('click', () => {
      const picked = audio.choose(index); if (!picked) return;
      $('pick').hidden = true; shownSelect = null; showDecks();
      const tone = picked.rating === '◎' ? 'great' : picked.rating === '○' ? 'good' : 'bad';
      toast(`<span class="medal pick-${tone}">${picked.rating}</span><span><span class="toast-label">${{ '◎': 'フロアが沸いた！', '○': '悪くない選曲', '△': 'フロアが少し冷めた…' }[picked.rating]}</span><span class="toast-parts">${TRACKS[picked.key].title}</span></span>`, 2200);
      say(picked.rating); sfx.play('pick', { rating: picked.rating }); buzz(picked.rating === '◎' ? FEEL.buzz.GOOD : null); bump(PICK_FLOOR[picked.rating], { '◎': '待ってた曲！', '○': '悪くない選曲', '△': '今ほしい曲と違う' }[picked.rating]);
      status(`選曲：${TRACKS[picked.key].title}（${picked.rating}）`);
    });
    return button;
  }));
  $('pick').hidden = false; shownSelect = select;
}
$('help').addEventListener('click', () => { helpManual = $('howto').hidden; });
$('exit').hidden = !embedded;
$('exit').addEventListener('click', async () => { if (!embedded) return; await audio.pause().catch(() => {}); tell({ type: 'dj-exit' }); });
$('restart').addEventListener('click', async () => { const old = audio; create(); await old.dispose().catch(() => {}); status('最初から'); });
$('crossfader').addEventListener('input', e => audio.setMix(e.target.value));
// 皿（2026-11-13 DJG）: 入れた曲の拍がズレた時、その皿を回して戻す。時計回りで曲を先へ送り、反時計回りで戻す（1回転 = FEEL.jog.beatsPerTurn 拍）。
// 回した分は jog.pending に貯め、描画のたびに（FEEL.jog.flushMs おきに）まとめて送る。合っている時・相手の皿は、絵が指について回るだけ。
const jogs = [0, 1].map(id => ({ id, el: $('platter-' + (id ? 'b' : 'a')), drag: null, spin: 0, pending: 0, flushed: 0 }));
for (const jog of jogs) {
  const el = jog.el, angle = (e, r) => Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  const turn = degrees => { jog.spin += degrees; el.style.setProperty('--spin', `${jog.spin.toFixed(1)}deg`); jog.pending += degrees / 360 * FEEL.jog.beatsPerTurn; };
  el.addEventListener('pointerdown', e => { const r = el.getBoundingClientRect(); if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) > r.width / 2 * 1.05) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId); jog.drag = { last: angle(e, r) }; el.classList.add('touching'); buzz(6); });
  el.addEventListener('pointermove', e => { if (!jog.drag) return; const a = angle(e, el.getBoundingClientRect()); let d = a - jog.drag.last; if (d > 180) d -= 360; if (d < -180) d += 360; jog.drag.last = a; turn(d); });
  const end = () => { jog.drag = null; el.classList.remove('touching'); }; el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', e => { const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!k) return; e.preventDefault(); turn(k * FEEL.jog.keyStep / FEEL.jog.beatsPerTurn * 360); });
}
/** Send what the platters were turned since the last time. A turn that brings the track back in time is the moment (lamp, sound, the room). */
function flushJogs(perf) {
  for (const jog of jogs) {
    if (!jog.pending || perf - jog.flushed < FEEL.jog.flushMs) continue;
    const moved = audio.nudge(jog.id, jog.pending); jog.pending = 0; jog.flushed = perf;
    if (!moved) continue;
    jog.el.classList.add('tick'); setTimeout(() => jog.el.classList.remove('tick'), 90);
    if (moved.fixed) { fx.fixes++; say('fix'); bump(SYNC_FLOOR, 'ズレを直した'); sfx.play('fix'); buzz(FEEL.buzz.fix); impact('fix', beatAt(audio.mix.decks[audio.mix.master], audio.now)); const lamp = $('beat'); lamp.classList.remove('snap'); void lamp.offsetWidth; lamp.classList.add('snap'); }
    else buzz(4);
  }
}
/** ビートメーター: 金の点が真ん中の枠にあれば拍は合っている。ズレると点が左右へ出る（右 = 入れた曲が先へ走っている）。皿の上の矢印は回す向き。 */
function beatMeter(m) {
  const sync = m.phase === 'mix' && m.running ? view.sync : null, off = !!sync?.off, state = !sync ? 'idle' : off ? 'off' : 'lock';
  if (state !== shown.beat) { shown.beat = state; setAttr($('beat'), 'data-state', state); put('beat-label', state === 'off' ? 'ズレ！ 皿で直す' : state === 'lock' ? '拍 ぴったり' : '拍'); }
  setVar($('beat-dot'), '--x', (sync ? Math.max(-1, Math.min(1, sync.error / FEEL.jog.meterSpan)) : 0).toFixed(3));
  const jog = off ? `${sync.deck ? 'b' : 'a'}-${sync.error > 0 ? 'ccw' : 'cw'}` : '';
  if (jog !== shown.jog) {
    shown.jog = jog;
    for (const [id, key] of ['a', 'b'].entries()) { const mine = off && sync.deck === id, arrows = $('jog-arrows-' + key); arrows.hidden = !mine; arrows.classList.toggle('ccw', mine && sync.error > 0); $('platter-' + key).classList.toggle('off', mine); }
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', event => { if (event.persisted) { pause(); return; } disposed = true; cancelAnimationFrame(frame); audio.dispose().catch(() => {}); });

// ── 曲の流れ（上 A・下 B の実波形）。金の線が「いま」、金の旗が次の入り ──────────────────
const PHONE = document.documentElement.dataset.density === 'phone';
/** The waveform as BINS bars per beat (the loudest moment in each), worked out once per track. Each frame only places the bars at their
 *  (fractional) x, so the shape scrolls smoothly instead of being re-sampled and shimmering every frame (DJS33). */
const BINS = 16;
function binsOf(t) {
  if (t.bins) return t.bins;
  const n = t.beats * BINS, out = new Float32Array(n), per = 60 / t.nativeBpm / BINS, k = t.peaks.length / t.duration;
  for (let i = 0; i < n; i++) {
    const a = Math.floor((t.firstBeat + i * per) * k), b = Math.max(a + 1, Math.floor((t.firstBeat + (i + 1) * per) * k));
    let v = 0; for (let j = Math.max(0, a); j < b && j < t.peaks.length; j++) if (t.peaks[j] > v) v = t.peaks[j];
    out[i] = v;
  }
  return (t.bins = out);
}
function wave(canvas, id, now) {
  if (canvas.width !== geo.laneW) canvas.width = geo.laneW; // 2 canvas px per CSS px both ways, so the bar numbers and the flag keep their shape
  if (canvas.height !== geo.laneH) canvas.height = geo.laneH;
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, x0 = Math.round(w * .3), scale = w / 7;
  c.clearRect(0, 0, w, h); c.fillStyle = '#0a0714cc'; c.fillRect(0, 0, w, h);
  const m = audio.mix, cue = m.cue, t = audio.tracks[id], d = m.decks[id];
  // One clock for both lanes (DJS29): the deck on air (during a cue, the one being mixed out of). The bar grid, the 8 bars of the mix and the
  // entry flag are all placed on it, so the two lanes line up bar for bar.
  const clock = cue ? m.decks[cue.from] : m.decks[m.master], cb = beatAt(clock, now), xOf = beat => x0 + (beat - cb) * 60 / clock.bpm * scale;
  if (cue) { // the 8 bars of the mix
    const xs = Math.max(0, xOf(cue.start)), xe = Math.min(w, xOf(cue.end));
    if (xe > xs) { c.fillStyle = m.phase === 'mix' ? '#ffc85724' : '#ffc85712'; c.fillRect(xs, 0, xe - xs, h); }
  }
  // the grid: a line on every bar with its number in the 8-bar phrase (1 = the phrase head, where tracks come in), small ticks on the beats
  const origin = cue ? cue.start : 0; // DJF03: bar 1 is the entry line (entries open every 4 bars, so it is not always a multiple of 8 bars)
  const perPx = clock.bpm / 60 / scale, from = Math.floor(cb - x0 * perPx) - 1, to = Math.ceil(cb + (w - x0) * perPx) + 1;
  c.font = `800 ${PHONE ? 40 : 24}px sans-serif`; c.textBaseline = 'top'; // 12px on the 1280 stage; 20px in the phone density (#2729)
  for (let n = from; n <= to; n++) {
    const x = Math.round(xOf(n));
    if (mod(n, 4)) { const tick = Math.round(h * .1); c.fillStyle = '#ffffff38'; c.fillRect(x, 0, 2, tick); c.fillRect(x, h - tick, 2, tick); continue; }
    const head = mod(n - origin, PHRASE) === 0, bar = Math.floor(mod(n - origin, PHRASE) / 4) + 1;
    c.fillStyle = head ? '#ffffffb0' : '#ffffff5c'; c.fillRect(x - (head ? 1 : 0), 0, head ? 4 : 2, h);
    c.fillStyle = head ? '#ffffff' : '#ffffffb8'; c.fillText(String(bar), x + 6, 4);
  }
  if (t) {
    // A deck on air follows its own beat. The incoming deck that has not started yet is drawn where it will come in: its first beat on the entry flag.
    const waiting = cue && cue.to === id && !d.playing, b = waiting ? (cb - cue.start) * d.bpm / clock.bpm : beatAt(d, now);
    const bins = binsOf(t), n = bins.length, ppb = scale * 60 / d.bpm, bw = Math.max(1, ppb / BINS * .7);
    const from = Math.max(0, Math.floor((b - x0 / ppb) * BINS)), to = Math.ceil((b + (w - x0) / ppb) * BINS); // nothing before beat 0: the track has not started
    c.fillStyle = id ? '#7fe3ff' : '#c39bff'; c.globalAlpha = d.playing ? .85 : .55;
    for (let i = from; i <= to; i++) { const size = Math.max(1, bins[i % n] * (h - 16)); c.fillRect(x0 + (i / BINS - b) * ppb, (h - size) / 2, bw, size); }
    c.globalAlpha = 1;
  }
  if (cue && !cue.pressed) {
    const x = xOf(cue.start);
    if (x >= -40 && x < w + 40) { // the entry flag; pulses on every beat in the last bar
      const left = cue.start - cb, pulse = left <= 4 && left > 0 && !reduced.matches ? 1 - mod(cb, 1) : .4, glow = c.createLinearGradient(x - 34, 0, x + 34, 0);
      glow.addColorStop(0, 'transparent'); glow.addColorStop(.5, `rgba(255,200,87,${.2 + pulse * .5})`); glow.addColorStop(1, 'transparent');
      c.fillStyle = glow; c.fillRect(x - 34, 0, 68, h);
      c.fillStyle = '#ffc857'; c.fillRect(x - 2, 0, 4, h);
      if (cue.to === id) { const size = PHONE ? 40 : 30; c.font = `900 ${size}px sans-serif`; c.textBaseline = 'middle'; c.fillStyle = '#2a1840'; c.fillRect(x + 4, h / 2 - size * .68, size * 2.9, size * 1.36); c.fillStyle = '#ffc857'; c.fillText(`▶ ${deckOf(id)}`, x + 4 + size * .27, h / 2 + 2); }
    }
  }
  c.fillStyle = '#ffc857'; c.fillRect(x0 - 1, 0, 3, h); // いま
  c.beginPath(); c.moveTo(x0 - 9, 0); c.lineTo(x0 + 10, 0); c.lineTo(x0 + .5, 12); c.closePath(); c.fill();
}
// ── フロアの絵の上に重ねる光・音符（#crowd）。絵そのもの（シルエットの客）は CSS（.floor-art）が気分で切り替える ──────
// DJS32: 客が絵の側でシルエットになったので、コードで描いていた手前の手のシルエットはやめた。
// The guests are one painted band cut into 7 soft-edged vertical strips over a base copy: each strip bounces a little out of step with its
// neighbours, so the room moves like people and not like one sheet. How much depends on the mood: still when cold, a slow sway while they
// watch, a bounce on every beat once they dance, a jump at the peak.
function buildBand() {
  const band = $('band'), size = 100 / STRIPS + STRIP_OVERLAP * 2;
  strips = Array.from({ length: STRIPS }, (_, k) => {
    const left = k * 100 / STRIPS - STRIP_OVERLAP, el = document.createElement('i'), inner = document.createElement('b');
    el.className = 'strip'; el.style.left = `${left}%`; el.style.width = `${size}%`;
    inner.style.width = `${100 / size * 100}%`; inner.style.left = `${-left / size * 100}%`; el.append(inner); band.append(el);
    return { el, phase: [.0, .11, -.06, .15, -.1, .07, -.03][k], gain: [1, .8, 1.15, .9, 1.1, .85, 1.05][k], y: null, x: null };
  });
  strips.push({ el: band.querySelector('.base'), phase: 0, gain: .55, y: null, x: null });
}
function moveCrowd(beat, mood, still, held) {
  // amp: how high they bounce (px); every: bounce on every beat (1) or every second beat (2); sway: sideways drift (px)
  let [amp, every, sway] = still ? [0, 1, 0] : [[0, 1, 0], [0, 1, 0], [2.5, 2, 2], [8, 1, 3], [15, 1, 4]][mood];
  // DJF01: after a hit lands the room jumps higher for a moment (even a cold room answers a great entry); while the picture is held they crouch
  const lift = still || fx.burst <= 1 ? 0 : Math.max(0, 1 - (beat - fx.burstBeat) / Math.max(.25, FEEL.burst.beats));
  if (lift > 0) { amp = Math.max(amp, 5) * (1 + (fx.burst - 1) * lift); every = 1; } else if (fx.burst > 1 && !held) fx.burst = 1;
  for (const [k, strip] of strips.entries()) {
    const t = beat / every + strip.phase, y = held && !still ? Math.round(3 * strip.gain * 2) / 2 : amp ? -Math.round(Math.abs(Math.sin(t * Math.PI)) ** .7 * amp * strip.gain * 2) / 2 : 0;
    const x = sway ? Math.round(Math.sin((beat / 8 + k * .13) * Math.PI * 2) * sway * 2) / 2 : 0;
    if (y !== strip.y || x !== strip.x) { strip.y = y; strip.x = x; strip.el.style.transform = x || y ? `translate(${x}px,${y}px)` : ''; }
  }
}
/** The whole floor jolts once. The type says what happened (FEEL.shake): drop = an entry lands, sway = the fader locked in, big = an S transition / the set, stumble = a miss. */
function shake(type = 'drop') { fx.shakes++; fx.lastShake = type; if (reduced.matches) return; const art = $('floor-art'); art.classList.remove(...SHAKES); void art.offsetWidth; art.classList.add(`shake-${type}`); }
/** 決まった瞬間の手応え（DJF01）: フロアの絵だけを一瞬止めて暗く落とし、明けた瞬間に揺れ・閃光・客の跳ね・音符。曲は止めない（拍が狂う）。 */
function impact(kind, beat) {
  if (fx.pending) release(fx.pending, beat);
  const ms = reduced.matches ? 0 : FEEL.hold[kind] || 0;
  if (ms <= 0) { release(kind, beat); return; }
  fx.pending = kind; fx.holdUntil = performance.now() + ms; fx.holdBeat = beat; fx.holds++;
  const art = $('floor-art'); art.style.setProperty('--hold-dim', String(FEEL.holdDim)); art.classList.add('hold');
}
function release(kind, beat) {
  fx.pending = null; $('floor-art').classList.remove('hold');
  const group = kind.startsWith('combo') ? 'combo' : kind, type = FEEL.shake[kind];
  if (type) shake(type);
  if (kind === 'PERFECT' || kind === 'GOOD') dropText('big', 'DROP!');
  if (reduced.matches) return;
  flash = Math.max(flash, FEEL.flash[group] || 0);
  if (FEEL.burst[group] > 1) { fx.burst = FEEL.burst[group]; fx.burstBeat = beat; }
  for (let i = FEEL.notes[group] || 0; i > 0; i--) note();
}
function dropText(kind, text) { const drop = $('drop'); drop.className = 'drop'; void drop.offsetWidth; drop.className = `drop ${kind}`; drop.textContent = text; }
/** ▶ を押したその場所に返す反応（DJF10）: ボタンから判定の色の輪が広がり、皿が一度だけ弾む。 */
function pressBurst(id, grade) {
  const key = id ? 'b' : 'a', ring = $('burst-' + key), jog = $('platter-' + key);
  ring.className = 'burst'; jog.classList.remove('kick'); void ring.offsetWidth; ring.className = `burst go ${grade.toLowerCase()}`; if (grade === 'PERFECT' || grade === 'GOOD') jog.classList.add('kick');
}
function drawFloor(beat, floor, running, held = false) {
  // The light layer is drawn at half resolution (it is all soft light) and not redrawn while nothing on it moves (DJS33).
  const canvas = $('crowd'), W = geo.stageW, H = 288, still = reduced.matches || !running, mood = moodOf(floor), kick = still ? 0 : (1 - mod(beat, 1)) ** 2;
  moveCrowd(beat, mood, still, held);
  const idle = still && !particles.length && flash <= .02 ? `${W}|${floor.toFixed(3)}` : null;
  if (idle && idle === shown.floorKey) return;
  shown.floorKey = idle;
  if (canvas.width !== W / 2) { canvas.width = W / 2; canvas.height = H / 2; }
  const c = canvas.getContext('2d'); c.setTransform(.5, 0, 0, .5, 0, 0); c.clearRect(0, 0, W, H);
  // beams from the truss over the booth, pointing out into the room: wider and brighter as it heats up
  const sweep = still ? 0 : Math.sin(beat / 8 * Math.PI * 2);
  c.globalCompositeOperation = 'lighter';
  for (const [at, dir, col] of [[.16, 1, '180,92,240'], [.38, -1, '63,208,232'], [.62, 1, '255,95,168'], [.84, -1, '180,92,240']]) {
    const x = at * W, tip = x + dir * sweep * 150 + (at - .5) * 200, spread = 50 + floor * 70, alpha = (.04 + floor * .2) * (mood >= 4 ? 1 + kick * .5 : 1);
    // DJS32: the painted crowd already stands in its own beams, so these only sweep through the haze over the heads and are gone by mid-height
    const g = c.createLinearGradient(x, 0, tip, H); g.addColorStop(0, `rgba(${col},${alpha * .9})`); g.addColorStop(.5, `rgba(${col},0)`);
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 6, 0); c.lineTo(x + 6, 0); c.lineTo(tip + spread, H); c.lineTo(tip - spread, H); c.closePath(); c.fill();
  }
  if (!still && mood >= 3) { // thin lasers fanning over the heads; more of them, and a strobe on the beat, at the peak
    const n = mood >= 4 ? 6 : 3; c.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const a = Math.sin(beat / 4 * Math.PI + i * 1.7) * .9 + (i - (n - 1) / 2) * .22, x0 = W * (i % 2 ? .47 : .53), x1 = x0 + Math.tan(a) * 210;
      c.strokeStyle = `rgba(${i % 2 ? '120,235,255' : '255,120,200'},${mood >= 4 ? .4 : .22})`; c.beginPath(); c.moveTo(x0, -4); c.lineTo(x1, 206); c.stroke();
    }
    if (mood >= 4) { c.fillStyle = `rgba(255,235,255,${(kick * .1).toFixed(3)})`; c.fillRect(0, 0, W, H); }
  }
  if (flash > .02) { c.fillStyle = `rgba(255,240,255,${(flash * .28).toFixed(3)})`; c.fillRect(0, 0, W, H); flash *= .86; } else flash = 0;
  c.globalCompositeOperation = 'source-over';
  // notes rising from the crowd while the fader rides the line
  if (!reduced.matches) {
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) { p.y -= p.vy; p.x += Math.sin(p.life * 6) * .6; p.life -= .014; }
    c.textAlign = 'center'; // a soft halo (a bigger faint note) instead of shadowBlur, which is slow on phones
    for (const [font, alpha] of [['900 44px sans-serif', .3], ['900 30px sans-serif', 1]]) {
      c.font = font;
      for (const p of particles) { c.globalAlpha = Math.min(1, p.life * 2) * alpha; c.fillStyle = p.color; c.fillText(p.char, p.x * W, p.y + (alpha < 1 ? 5 : 0)); }
    }
    c.globalAlpha = 1;
  }
}
const note = () => { if (particles.length < 24) particles.push({ x: .08 + Math.random() * .84, y: 230 + Math.random() * 30, vy: 1 + Math.random() * 1.2, life: 1, char: pickOne(['♪', '♫', '♪']), color: pickOne(['#ffc857', '#ff8fc4', '#aee7d5', '#c39bff']) }); };

// ── 横フェーダーの案内: 光る枠と、そこへ向かう金の矢印 ─────────────────────────────
let comboShown = -1;
/** away: the fader has left the playing deck's side while nothing is being mixed (the sound is fading out). */
function faderGuide(m, away) {
  const band = $('guide'), arrows = $('fader-arrows'), fader = $('crossfader'), x0 = geo.faderLeft + THUMB / 2, track = geo.faderW - THUMB;
  const mixing = m.phase === 'mix' && view.guide != null && m.fader;
  band.hidden = !mixing;
  let hint = '', target = null, ok = false;
  if (mixing) {
    const g = m.cue.to === 1 ? view.guide : 1 - view.guide, side = followHint(m, view.guide);
    setStyle(band, 'transform', `translateX(${(x0 + (g - FOLLOW_BAND) * track).toFixed(1)}px)`); setStyle(band, 'width', `${Math.round(FOLLOW_BAND * 2 * track)}px`); // moved with transform: no layout
    band.classList.toggle('in', Math.abs(toward(m) - view.guide) <= FOLLOW_BAND);
    if (view.follow) {
      band.classList.remove('hit', 'miss'); void band.offsetWidth; band.classList.add(view.follow.hit ? 'hit' : 'miss');
      if (view.follow.hit && view.follow.combo >= 4) { note(); if (view.follow.combo >= 16) note(); }
      if (view.follow.hit && view.follow.combo >= 8) { // DJF04: every 8 beats in a row is a bigger moment than the last (sway → drop → the whole room)
        if (view.follow.combo % 8 === 0) { const c = Math.min(32, view.follow.combo); impact(`combo${c}`, beatAt(m.decks[m.master], audio.now)); buzz(FEEL.buzz.combo); sfx.play('combo', { combo: c }); }
        else flash = Math.max(flash, FEEL.flash.combo);
      }
    }
    const on = m.cue.to === 1 ? '右' : '左', back = m.cue.to === 1 ? '左' : '右', done = toward(m) >= .9 && view.guide >= .9;
    if (side === 0 || done) { hint = done ? 'そのまま！' : 'いい感じ、そのまま'; ok = true; }
    else if (side > 0) { hint = m.cue.to === 1 ? `もっと${on}へ →` : `← もっと${on}へ`; target = g; }
    else { hint = m.cue.to === 1 ? `← 行きすぎ、少し${back}へ` : `行きすぎ、少し${back}へ →`; target = g; }
  } else if (away) { target = m.master === 0 ? 0 : 1; hint = m.master === 0 ? '← 左へ戻す' : '右へ戻す →'; }
  arrows.hidden = target == null;
  if (target != null) { // chevrons run from the cap's leading edge toward the target: 1〜3 of them, as many as fit
    const right = target > m.mix, cap = x0 + m.mix * track, n = Math.max(1, Math.min(3, Math.floor((Math.abs(target - m.mix) * track + 20) / 29))), width = n * 29;
    setStyle(arrows, 'transform', `translateX(${(right ? cap + THUMB / 2 - 6 : cap - THUMB / 2 + 6 - width).toFixed(1)}px)`); setStyle(arrows, 'width', `${width}px`);
    arrows.classList.toggle('left', !right); [...arrows.children].forEach((el, i) => { el.hidden = i >= n; });
  }
  const label = $('fader-hint'); if (label.textContent !== hint) label.textContent = hint; label.classList.toggle('ok', ok);
  $('xfade').classList.toggle('go', !!mixing || away);
  // DJF04: the counter pops on every beat that lands, grows at 8 / 16 / 24, and a broken run of 4 or more falls away instead of just vanishing
  const counter = $('combo'), perf = performance.now();
  if (fx.brokenUntil && perf > fx.brokenUntil) { fx.brokenUntil = 0; counter.classList.remove('broken'); if (comboShown <= 1) counter.textContent = ''; }
  if (!mixing) { if (comboShown !== -1) { if (!fx.brokenUntil) counter.textContent = ''; comboShown = -1; } }
  else if (m.fader.combo !== comboShown) {
    const before = comboShown; comboShown = m.fader.combo;
    if (comboShown > 1) {
      const tier = Math.min(3, Math.floor(comboShown / 8)); fx.brokenUntil = 0;
      counter.textContent = `COMBO ${comboShown}`; counter.dataset.tier = String(tier); counter.style.fontSize = `${PHONE ? 20 + tier : FEEL.comboSize[tier]}px`;
      counter.classList.remove('broken', 'pop'); void counter.offsetWidth; counter.classList.add('pop');
    } else if (before >= 4) { counter.textContent = `COMBO ${before}`; counter.classList.remove('pop'); counter.classList.add('broken'); fx.brokenUntil = perf + 520; }
    else if (!fx.brokenUntil) counter.textContent = '';
    counter.classList.toggle('hot', comboShown >= 8);
  }
  return hint;
}
function toast(html, ms = 2600) { $('toast').innerHTML = html; toastUntil = performance.now() + ms; }
const RANK_LABEL = { S: 'かんぺきなつなぎ！', A: 'いいつなぎ！', B: 'まずまずのつなぎ', C: 'つなぎが荒れた…' };
function showTransition(t, last = false) {
  // DJF05: the moment the track changes over. The medal is stamped on, the room answers by rank (the last one is answered by the set's own finish)
  if (!last) { impact(t.rank, beatAt(audio.mix.decks[audio.mix.master], audio.now)); buzz(FEEL.buzz[t.rank]); sfx.play('transition', { rank: t.rank }); }
  if (!last) toast(`<span class="medal stamp r-${t.rank}">${t.rank}</span><span><span class="toast-label">${RANK_LABEL[t.rank]}</span><span class="toast-parts">ビート <b>${t.parts[0]}</b>・入り <b>${t.parts[1]}</b>・フェーダー <b>${t.parts[2]}</b><span class="best">（最大 ${t.combo} コンボ）</span></span></span>`);
  if (!last) say(t.rank, { big: t.rank === 'S' });
  bump(RANK_FLOOR[t.rank], RANK_LABEL[t.rank].replace(/[！…]/g, ''));
}
/** One line on what to work on next: the weakest of the three parts across the set. */
function advice(r) {
  const avg = [0, 1, 2].map(i => r.transitions.reduce((s, t) => s + t.parts[i], 0) / r.transitions.length), weak = avg.indexOf(Math.min(...avg));
  if (avg[weak] >= 85) return { S: 'フロアが沸いた。完璧なセット！', A: 'いいセット。フロアはずっと踊っていた', B: 'あと少し。入りとフェーダーをていねいに', C: '金色の矢印を追えば、次はもっとつながる' }[r.rank];
  return ['次はズレ直し：金の点が枠から出たら、すぐ皿を回して戻そう', '次は入りのタイミング：カウントが 0 になる瞬間に ▶', '次は横フェーダー：光る枠から離れないよう、ゆっくり動かそう'][weak];
}
const NEXT_RANK = { C: 'B', B: 'A', A: 'S' };
/** DJF07: what to aim for next: the points to the next rank, and how far the player's own best is. */
function goalLine(r, previous) {
  const next = NEXT_RANK[r.rank], rank = next ? `次のランク ${next} まで あと <b>${RANK_LINES[next] - r.total}</b>点` : '最高ランク S に届いた！';
  const mine = previous == null ? '' : r.total > previous ? `自己ベスト更新！（これまで ${previous}点）` : r.total === previous ? `自己ベストに並んだ（${previous}点）` : `自己ベスト ${previous}点 まで あと <b>${previous - r.total}</b>点`;
  return mine ? `${rank}<i>・</i>${mine}` : rank;
}
/** DJF06: the last track is on. The record is fixed right now (leaving during the afterglow keeps it); the result card waits while the room cheers. */
function finishSet(r) {
  const previous = best, perf = performance.now(); if (best == null || r.total > best) best = r.total;
  tell({ type: 'dj-result', set: setIndex + 1, rank: r.rank, total: r.total, floor: r.floor });
  fx.result = { r, previous, at: perf, until: perf + Math.max(0, reduced.matches ? FEEL.afterglow.reducedMs : FEEL.afterglow.ms), shown: false };
  impact('finish', beatAt(audio.mix.decks[audio.mix.master], audio.now)); buzz(FEEL.buzz.finish); sfx.play('finish', { rank: r.rank });
  $('voices').replaceChildren(); dropText('finish', 'SET COMPLETE!'); // the banner has the floor to itself (the cheer is the sound)
}
function showResult() {
  const state = fx.result, r = state.r; state.shown = true; $('drop').className = 'drop'; $('drop').textContent = '';
  const rows = r.transitions.map((t, i) => `<tr><th>${i + 1}</th><td>${TRACKS[t.from].title} → ${TRACKS[t.to].title}</td><td>${t.pick || '—'}</td><td>${t.grade}</td><td>${t.parts.join(' / ')}</td><td>${t.combo}</td><td class="rank r-${t.rank}">${t.rank}</td></tr>`).join('');
  const mood = MOODS[moodOf(r.floor / 100)];
  $('score-result').innerHTML = `<div class="result-card" id="result-card"><div class="result-head"><span class="medal wait r-${r.rank}" id="result-medal">${r.rank}</span><div><small>${r.set} RESULT</small><div class="result-total"><b id="result-num">0</b>点</div><div class="result-mood">フロアの熱 ${r.floor}：${mood}${r.bonus ? `（${r.bonus > 0 ? 'ボーナス +' : ''}${r.bonus}点）` : ''}</div><div class="result-goal" id="result-goal">${goalLine(r, state.previous)}</div></div></div>`
    + `<table><thead><tr><th>#</th><th>つなぎ</th><th>選曲</th><th>入り</th><th>ビート / 入り / フェーダー</th><th>コンボ</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    + `<p class="advice">${advice(r)}</p><div class="result-actions"><button id="again" type="button" class="gold">もう一度</button>${embedded ? '<button id="leave" type="button">戻る</button>' : ''}</div></div>`;
  // DJF08: 「もう一度」 puts the first track straight back on (no how-to board, no extra ▶)
  $('again').addEventListener('click', () => { $('restart').click(); startDeck(0); });
  $('leave')?.addEventListener('click', () => $('exit').click());
  // the total counts up, then the rank is stamped on; the buttons work from the start (a tap anywhere else settles it at once)
  if (reduced.matches || !(FEEL.afterglow.countUp > 0)) settleResult(); else fx.count = { at: performance.now(), total: r.total, value: 0 };
}
function settleResult() {
  const state = fx.result; fx.count = null; if (!state?.shown || !$('result-card')) return;
  $('result-num').textContent = String(state.r.total); $('result-medal').classList.replace('wait', 'stamp'); $('result-card').classList.add('settled');
  sfx.play('stamp'); buzz(FEEL.buzz.GOOD);
}
function countUp(perf) {
  const c = fx.count; if (!c) return;
  const t = (perf - c.at) / FEEL.afterglow.countUp;
  if (!(t < 1)) { settleResult(); return; }
  const value = Math.round(c.total * (1 - (1 - Math.max(0, t)) ** 3)); if (value !== c.value) { c.value = value; $('result-num').textContent = String(value); }
}
// The afterglow and the count-up never hold the player: a tap / click, Enter, Space or Esc moves on (not in the first 0.3 s, so the hand still on the fader does not skip it).
function skipAhead(event) {
  const state = fx.result; if (!state) return;
  if (!state.shown) { if (performance.now() - state.at > 300) state.until = 0; }
  else if (fx.count && !event.target?.closest?.('button')) fx.count.at = -1e9;
}
addEventListener('pointerdown', skipAhead);
addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') skipAhead(event); });
/** DJF02: the count-in. A small click on each of the last beats before the entry, scheduled on the audio clock (the last one a little higher). */
function countTicks(m, now) {
  const c = m.cue, n = Math.min(4, Math.floor(FEEL.countTicks) || 0);
  if (!n || !c || c.pressed || m.phase !== 'cue' || !m.running) return;
  const from = m.decks[c.from];
  for (let k = n; k >= 1; k--) {
    const at = from.at + (c.start - k - from.beat) * 60 / from.bpm, key = `${c.start}:${k}`;
    if (at - now < .1 && at - now > -.03 && !fx.ticks.has(key)) { fx.ticks.add(key); if (sfx.play('tick', { at, last: k === 1 })) fx.tickCount++; }
  }
}
/** What to do now: step lamp (1 かける / 2 入れる / 3 つなぐ / 4 えらぶ), the two navi lines and the controls the gold arrows point at. */
function navi(m, now, away) {
  const cue = m.cue, out = { step: 0, main: '', sub: '', warn: false, points: [], count: '', untilHead: null };
  if (m.phase === 'done') return { ...out, step: 5, main: 'セット終了！ おつかれさま', sub: '最後の曲が流れている' };
  if (!m.running) {
    if (m.phase === 'idle') return { ...out, step: 1, main: '左の ▶ を押して、1曲目をかけよう', sub: '曲をつないでフロアを盛り上げよう。低音は機材が自動で整える', points: ['play-a'] };
    const live = m.resumeDecks.length ? m.resumeDecks : [m.master];
    return { ...out, step: m.phase === 'mix' ? 3 : m.phase === 'select' ? 4 : 2, main: `一時停止中。${sideOf(live[0])}の ▶ で続きから`, sub: '止まったところから、流れていた曲がそのまま戻る', points: [`play-${live[0] ? 'b' : 'a'}`] };
  }
  if (away) return { ...out, step: m.phase === 'select' ? 4 : 2, warn: true, main: `音が消える！ 横フェーダーを${sideOf(m.master)}へ戻そう`, sub: `次の曲を入れるまで、フェーダーは${sideOf(m.master)}（${deckOf(m.master)}）に置いておく`, points: ['fader'] };
  if (m.phase === 'select') return { ...out, step: 4, main: 'お客さんの声を聞いて、次の曲をえらぼう', sub: '声に合うノリで、つながりも良い曲ならフロアが沸く', points: ['pick'] };
  if (m.phase === 'mix') {
    const to = cue.to, bar = Math.min(8, Math.floor(view.progress * 8) + 1);
    // DJG: the incoming track has slipped out of time. Turn its platter the way the arrows run (ahead → back, behind → on) until the gold dot is in the frame.
    if (view.sync?.off) return { ...out, step: 3, warn: true, main: `ズレた！ ${sideOf(to)}の皿を${view.sync.error > 0 ? '左回り' : '右回り'}に回そう`, sub: '金の点が枠に入れば戻る。フェーダーはそのまま', points: ['fader', `jog-${to ? 'b' : 'a'}`] };
    if (view.progress >= 1) return { ...out, step: 3, main: `最後まで${sideOf(to)}へ動かしきろう`, sub: `フェーダーが${sideOf(to)}の端に着くと、${deckOf(to)} に乗り換わる`, points: ['fader'] };
    return { ...out, step: 3, main: `横フェーダーを${sideOf(to)}へ。光る枠を追いかけよう`, sub: `8小節かけて ${deckOf(to)} へ乗り換える（${bar}／8）。拍ごとに枠の中かを見る`, points: ['fader'] };
  }
  // cue: waiting for the phrase head, then ▶ on the incoming deck
  const to = cue.to, key = to ? 'b' : 'a', from = m.decks[cue.from], late = beatAt(from, now) - cue.start;
  const untilHead = late <= 0 ? -late : cue.start + m.grid - beatAt(from, now), bars = Math.ceil(untilHead / 4), count = untilHead <= 4 && untilHead > 0 ? String(Math.ceil(untilHead)) : '';
  // 「いま！」 only while a press still lands inside the OK window (120 ms + headphones); after that the navi sends the player to the next head
  if (late > 0 && late * 60 / from.bpm * 1000 <= 120 + (m.allowance || 0)) return { ...out, step: 2, untilHead: 0, count: '▶', main: `いま！ ${sideOf(to)}の ▶`, sub: '0 の瞬間に近いほど、フロアが沸く', points: [`play-${key}`] };
  if (untilHead <= 4) return { ...out, step: 2, untilHead, count, main: `カウント 0 で、${sideOf(to)}の ▶ ！`, sub: '光の輪がボタンに重なる瞬間に押す', points: [`play-${key}`] };
  if (late > 0) return { ...out, step: 2, untilHead, main: '入りを逃した。次の頭を待とう', sub: `あと ${bars} 小節。カウントが出たら、0 で${sideOf(to)}の ▶`, points: [] };
  return { ...out, step: 2, untilHead, main: `次は${sideOf(to)}の ▶。カウントが出るまで待とう`, sub: `入りまで あと ${bars} 小節。金の旗が金の線に重なる瞬間が入り`, points: [] };
}
function showNavi(n, m) {
  if (n.main !== message) { $('coaching').textContent = n.main; message = n.main; }
  if (n.sub !== subMessage) { $('coach-sub').textContent = n.sub; subMessage = n.sub; }
  $('coaching').classList.toggle('warn', n.warn);
  if (n.step !== shown.step) for (const li of $('steps').children) { const s = Number(li.dataset.step); li.classList.toggle('now', s === n.step); li.classList.toggle('done', s < n.step || (s === 1 && m.phase !== 'idle')); }
  const points = n.points.join(' ');
  if (points !== shown.pointsKey) {
    for (const key of ['a', 'b']) {
      $('point-play-' + key).hidden = !n.points.includes(`play-${key}`);
    }
  }
  shown.step = n.step; shown.pointsKey = points; shown.points = [...n.points];
  if (n.count !== lastCount) { const el = $('count'); el.textContent = n.count; el.classList.remove('beat'); if (n.count) { void el.offsetWidth; el.classList.add('beat'); } lastCount = n.count; }
}
function render() {
  if (disposed) return; measure(performance.now()); const now = audio.now, m = audio.mix; // measure first: the layout is still clean at the top of the frame
  view = audio.update();
  if (fx.pending && performance.now() >= fx.holdUntil) release(fx.pending, beatAt(m.decks[m.master], now)); // the held picture lets go
  if (view.transition) { showTransition(view.transition, !!view.finished); missStreak = 0; comboSaid = 0; clashSaid = false; }
  if (view.finished) finishSet(view.finished);
  if (fx.result && !fx.result.shown && performance.now() >= fx.result.until) showResult();
  countUp(performance.now());
  flushJogs(performance.now());
  if (view.slipped) { say('slip'); sfx.play('slip'); buzz(FEEL.buzz.slip); shake('stumble'); } // the incoming track just went out of time
  if (view.rolled) say('skip'); // the entry line went by without a ▶: the next one is 4 bars on
  showDecks();
  if (m.phase === 'select' && m.select && shownSelect !== m.select) renderPick(m.select);
  if (m.phase !== 'select' && !$('pick').hidden) { $('pick').hidden = true; shownSelect = null; }
  if (m.lastPlay && m.lastPlay !== shownPlay) {
    shownPlay = m.lastPlay; const grade = shownPlay.grade; judgeUntil = performance.now() + 1800;
    $('judge').textContent = grade; $('judge').dataset.grade = grade; $('judge').classList.remove('pop'); void $('judge').offsetWidth; $('judge').classList.add('pop');
    $('judge-sub').textContent = { PERFECT: 'ぴったり！', GOOD: 'いい入り！', OK: 'まずまず', EARLY: '早すぎた…', LATE: '遅れた…' }[grade];
    // DJF01/02/10: the press answers at once where it was made (ring on the button, sound, vibration, the word). On PERFECT / GOOD the floor is held
    // for a moment and then lets go with DROP! (flash, the room jumps); OK is a small pulse, EARLY / LATE a stumble.
    if (grade !== 'PERFECT' && grade !== 'GOOD') dropText(grade === 'OK' ? 'small' : 'miss', '');
    pressBurst(shownPlay.id, grade); buzz(FEEL.buzz[grade]); sfx.play('entry', { grade }); impact(grade, beatAt(m.decks[m.master], now));
    say(grade, { big: grade === 'PERFECT' }); bump(GRADE_FLOOR[grade], { PERFECT: 'ぴったり入った', GOOD: 'いい入り', EARLY: '入りが早かった', LATE: '入りが遅れた' }[grade] || '');
  }
  if (judgeUntil && performance.now() > judgeUntil) { $('judge').textContent = ''; $('judge-sub').textContent = ''; judgeUntil = 0; }
  if (toastUntil && performance.now() > toastUntil) { $('toast').innerHTML = ''; toastUntil = 0; }
  // the guests react to the fader beat by beat: a voice at 8 / 16 / 24 / 32 in a row, a complaint after four misses in a row
  if (view.follow) {
    if (view.follow.hit) { missStreak = 0; const c = view.follow.combo; if (c % 8 === 0 && c > comboSaid && c <= 32 && !fx.result) { comboSaid = c; say(`combo${c}`); } }
    else {
      if (fx.combo >= 8) { sfx.play('broken'); buzz(FEEL.buzz.broken); } // a long run breaks: a dull thud (a short one just ends)
      if (++missStreak === 4) { say('clash'); bump(-.03, 'フェーダーが枠から外れている'); }
    }
    fx.combo = view.follow.combo;
  }
  const cue = m.cue, master = m.decks[m.master], perf = performance.now();
  // the fader left the playing deck's side although nothing is being mixed: the sound is fading out
  const away = m.running && m.phase !== 'mix' && m.phase !== 'done' && (m.master === 0 ? m.mix : 1 - m.mix) > .25;
  if (!away) { awaySince = 0; awaySaid = false; } else if (!awaySince) awaySince = perf; else if (!awaySaid && perf - awaySince > 1200) { awaySaid = true; say('quiet'); }
  // two decks audible but their beats rub (tempo not matched): the guests notice after a moment
  const rub = m.running && m.phase === 'mix' && m.decks.every(d => d.playing) && quality(m, now) < .5;
  if (!rub) clashSince = 0; else if (!clashSince) clashSince = perf; else if (!clashSaid && perf - clashSince > 1500) { clashSaid = true; say('clash'); }
  const n = navi(m, now, away);
  for (const id of [0, 1]) {
    const key = id ? 'b' : 'a', d = m.decks[id], play = $('play-' + key);
    put('bpm-' + key, d.track ? d.bpm.toFixed(2) : '--');
    const beat = mod(beatAt(d, now), PHRASE);
    put('beat-' + key, d.playing ? `再生・${Math.floor(beat / 4) + 1}小節 ${Math.floor(beat % 4) + 1}拍` : '停止中');
    setAttr(play, 'aria-pressed', String(d.playing)); play.disabled = audio.busy || !d.track || d.playing;
    const mine = !!(cue && cue.to === id && !cue.pressed && m.phase === 'cue' && m.running), soon = mine && n.untilHead != null && n.untilHead <= 4 && n.untilHead > 0;
    play.classList.toggle('cue-open', mine && n.untilHead === 0);
    play.classList.toggle('cue-soon', soon);
    play.classList.toggle('first', m.phase === 'idle' && id === 0);
    // approach ring: shrinks from 1.55× the button onto the button exactly on the phrase head
    setVar(play, '--ap', soon ? (1 + n.untilHead / 4 * .55).toFixed(3) : '1');
    setAttr($('deck-' + key), 'data-playing', String(d.playing));
    setAttr($('deck-' + key), 'data-role', !d.track ? 'empty' : d.playing && m.master === id ? 'master' : d.playing ? 'incoming' : 'next');
    put('indicator-' + key, !d.track ? 'EMPTY' : d.playing ? 'ON AIR' : 'STANDBY');
    if (!fx.pending) setVar($('platter-' + key), '--rotation', `${reduced.matches || !d.playing ? 0 : (mod(beatAt(d, now), 4) * 90).toFixed(1)}deg`); // held with the floor (DJF01)
    setAttr($('platter-' + key), 'aria-valuenow', String(view.sync && view.sync.deck === id ? Math.round(view.sync.error * 100) : 0)); // how far out of time, in hundredths of a beat
    $('side-' + key).classList.toggle('goal', !!cue && cue.to === id && m.running);
    wave($('wave-' + key), id, now);
  }
  put('mix-value', `A ${Math.round((1 - m.mix) * 100)} / B ${Math.round(m.mix * 100)}%`);
  const heat = m.floor.toFixed(3); if (heat !== shown.heat) { shown.heat = heat; $('floor-fill').style.setProperty('--f', heat); put('floor-value', String(Math.round(m.floor * 100))); }
  showMood(m);
  put('set-progress', `${m.phase === 'done' ? m.count : Math.min(m.count, m.transitions.length + 1 + (m.phase === 'mix' ? 1 : 0))} / ${m.count}`);
  put('set-next', cue ? `NEXT ▶ ${cue.to ? 'B' : 'A'}` : m.phase === 'select' ? '選曲' : m.phase === 'done' ? 'LAST TRACK' : '');
  shown.hint = faderGuide(m, away); shown.away = away;
  showNavi(n, m);
  beatMeter(m);
  countTicks(m, now);
  const help = helpManual ?? (m.phase === 'idle');
  if ($('howto').hidden === help) { $('howto').hidden = !help; $('help').setAttribute('aria-pressed', String(help)); }
  controllerLeds();
  drawFloor(fx.pending ? fx.holdBeat : beatAt(master, now), m.floor, m.running, !!fx.pending);
  frame = requestAnimationFrame(render);
}
render();
// Controller LEDs only (no input/scoring effect): channel meters and the AUTO EQ lamp (the bass swap itself is in audio.mjs).
function controllerLeds() {
  const m = audio.mix, level = Math.min(1, audio.level() * 6), g = gains(m.mix), cut = lowCutDb(m.mix);
  for (const id of [0, 1]) {
    const on = m.decks[id].playing && m.running;
    setVar($('meter-' + (id ? 'b' : 'a')), '--lvl', on ? (level * g[id]).toFixed(2) : '0');
  }
  const cutting = cut.findIndex(v => v < -1);
  $('led-autoeq').classList.toggle('on', cutting >= 0);
  put('auto-low', cutting < 0 ? 'EQは横フェーダーに合わせて自動' : `AUTO EQ：${cutting ? 'B' : 'A'} の低音 ${Math.round(cut[cutting])}dB`);
}
