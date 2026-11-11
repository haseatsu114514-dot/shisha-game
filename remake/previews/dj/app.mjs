import { DJAudio } from './audio.mjs';
import { beatAt, lowCutDb, LOW_CUT_DB, LOCK_PCT, PHRASE, FOLLOW_BAND, REQUESTS, phaseError, bpmDiffPct, pitchOf, mod, gains, toward, keyMatch, energyMatch, quality, followHint, moodOf, MOODS, GRADE_FLOOR, RANK_FLOOR, PICK_FLOOR } from './model.mjs';
import { peakAt, TRACKS, SETS } from './tracks.mjs';
// View of the DJ set (2026-11-11 renewal, DJS20〜). Three things the screen always answers:
//   1. いま何をするか — the navi line + the gold arrow on the control to touch (▶ / PITCH / SYNC / 横フェーダー).
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
const tell = message => { try { if (embedded) window.parent.postMessage(message, location.origin); } catch { /* host optional */ } };
const reduced = matchMedia('(prefers-reduced-motion: reduce)'), coarse = matchMedia('(pointer: coarse)');
const THUMB = document.documentElement.dataset.density === 'phone' ? 72 : 54; // crossfader cap width (style.css)
const sideOf = id => id ? '右' : '左', deckOf = id => id ? 'B' : 'A';
const pickOne = list => list[Math.floor(Math.random() * list.length)];
let audio, disposed = false, frame = 0, view = { mode: 'idle' }, message = '', subMessage = '', toastUntil = 0, judgeUntil = 0, shownPlay = null, lastCount = '', shownTracks = [null, null], shownSelect = null;
let moodShown = null, helpManual = null, missStreak = 0, awaySince = 0, awaySaid = false, clashSince = 0, clashSaid = false, comboSaid = 0, shown = {}, particles = [], hands = [];
const status = text => { $('status').textContent = text; };
/** Write text only when it changes (the render loop runs every frame; an unchanged write would still dirty the layout). */
const put = (id, text) => { const el = $(id); if (el.textContent !== text) el.textContent = text; };
function create() {
  audio = new DJAudio(undefined, { setIndex, allowance: ALLOWANCE_MS });
  if (embedded) { audio.muted = gameMuted; if (Number.isFinite(gameVolume)) audio.volume = Math.max(0, Math.min(.36, .18 * gameVolume / .5)); }
  audio.onInterrupted = () => status('音声が中断されました。▶で再開します。');
  shownTracks = [undefined, undefined]; shownSelect = null; $('pick').hidden = true;
  $('set-name').textContent = SETS[setIndex].name; $('set-gear').textContent = phones ? `ヘッドホン：▶の判定が${ALLOWANCE_MS}ms広い` : ''; $('score-result').innerHTML = ''; $('judge').textContent = ''; $('judge-sub').textContent = ''; $('toast').innerHTML = '';
  // SET 1 arrives already in tempo: PITCH and SYNC are dimmed so the eye goes to ▶ and the crossfader.
  $('dj-stage').dataset.pitch = SETS[setIndex].detune === 'match' ? 'off' : 'on';
  $('voices').replaceChildren(); $('heat-delta').className = 'heat-delta'; $('crossfader').value = '0';
  view = { mode: 'idle' }; shownPlay = null; judgeUntil = 0; toastUntil = 0; moodShown = null; helpManual = null; missStreak = 0; awaySince = 0; awaySaid = false; clashSince = 0; clashSaid = false; comboSaid = 0; particles = []; hands = makeHands();
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
    $('pitch-' + key).value = '0';
  });
}
create();
export function snapshot() {
  const now = audio.now, m = audio.mix;
  return { set: setIndex, phase: m.phase, mode: view.mode, clock: now, state: audio.context?.state || 'not-started', running: m.running,
    tracks: m.decks.map(d => d.track), bpms: m.decks.map(d => d.bpm), pitches: m.decks.map(d => Math.round(pitchOf(d) * 100) / 100),
    beats: m.decks.map(d => beatAt(d, now)), playing: m.decks.map(d => d.playing), phase_error: phaseError(...m.decks, now),
    mix: m.mix, master: m.master, cue: m.cue ? { ...m.cue } : null, lastPlay: m.lastPlay, floor: m.floor, fader: m.fader ? { reached: m.fader.reached, checks: m.fader.checks, hits: m.fader.hits, combo: m.fader.combo } : null,
    select: m.select ? { ...m.select, options: [...m.select.options] } : null, played: [...m.played], count: m.count, guide: view.guide, follow: view.follow,
    transitions: m.transitions.map(t => ({ to: t.to, grade: t.grade, parts: t.parts, total: t.total, rank: t.rank, pick: t.pick, combo: t.combo, follow: t.follow })), result: m.result,
    allowance: m.allowance, voices: audio.voices.filter(Boolean).length, rms: audio.level(), reduced: reduced.matches, embedded, muted: audio.muted, volume: audio.volume, remaining: view.remaining, progress: view.progress,
    // what the screen is telling the player (DJS20): crowd mood, step lamp, navi lines, gold arrows, fader hint
    mood: moodOf(m.floor), step: shown.step, navi: message, sub: subMessage, points: shown.points, hint: shown.hint, away: shown.away };
}
async function pause() { try { await audio.pause(); status('停止中。▶で再開します。'); } catch (e) { status(`停止処理: ${e.message}`); } }
for (const id of [0, 1]) {
  const key = id ? 'b' : 'a';
  $('pitch-' + key).addEventListener('input', e => audio.pitch(id, Number(e.target.value)));
  $('play-' + key).addEventListener('click', async () => {
    if (audio.mix.decks[id].playing) return; // ▶ only starts: a deck leaves the air when its transition ends
    // after an interruption (tab hidden, audio session lost) any ▶ brings back every deck that was playing, in step
    const m = audio.mix, resume = !m.running && m.phase !== 'idle' && m.resumeDecks.length > 0;
    try { if (await (resume ? audio.start() : audio.play(id))) { helpManual = null; if (document.hidden) { await pause(); return; } status(resume ? '再開' : `${key.toUpperCase()} ON AIR`); } }
    catch (e) { status(`${e.message}。▶から再試行できます。`); }
  });
}
$('sync').addEventListener('click', () => { if (audio.sync()) status('SYNC：次の曲のBPMを合わせました'); });
// ── お客さんの反応: 声の吹き出し・熱の増減の札・気分の言葉 ──────────────────────────────
const VOICES = {
  PERFECT: ['きたー！', '今の入り、最高！', 'ぴったり！'], GOOD: ['いい入り！', 'お、いいね'], OK: ['うん、入った', 'わるくない'],
  EARLY: ['あれ、早くない？', 'つんのめった…'], LATE: ['ん、遅れた？', 'ちょっとズレた…'],
  combo8: ['気持ちいい…', 'なめらか！'], combo16: ['このつなぎ、好き！', 'ずっと踊れる！'], combo24: ['うますぎ！', '止まらない！'], combo32: ['完璧！！'],
  clash: ['音がごちゃついてる…', 'なんか、ぶつかってない？'], quiet: ['音、小さくない？', 'あれ、止まった？'],
  S: ['最高のつなぎ！', 'フゥー！！'], A: ['いいね！', 'ノれる！'], B: ['まあまあかな'], C: ['うーん…', '踊りづらい…'],
  '◎': ['これ待ってた！', 'わかってる！'], '○': ['お、いいじゃん'], '△': ['今それじゃない…', 'えー…'],
  cold: ['なんか冷めてきた…', '帰ろっかな…'], peak: ['最高潮！！'],
};
const COLD = new Set(['EARLY', 'LATE', 'clash', 'quiet', 'C', '△', 'cold']);
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
      say(picked.rating); bump(PICK_FLOOR[picked.rating], { '◎': '待ってた曲！', '○': '悪くない選曲', '△': '今ほしい曲と違う' }[picked.rating]);
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
// Jog outer rim = fine pitch (12° of rim travel = 0.01 BPM). Inside the rim does nothing; QUANTIZE keeps the phase.
const JOG_STEP_DEG = 12, JOG_INNER = .62;
function finePitch(id, steps) { const bpm = audio.mix.decks[id].bpm, next = Math.round((bpm + steps * .01) * 100) / 100; audio.tempo(id, next); return audio.mix.decks[id].bpm !== bpm; }
for (const id of [0, 1]) {
  const jog = $('platter-' + (id ? 'b' : 'a')); let drag = null, spin = 0;
  const angle = (e, r) => Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  jog.addEventListener('pointerdown', e => { const r = jog.getBoundingClientRect(), dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 2);
    if (dist > 1.05 || dist < JOG_INNER) return; e.preventDefault(); jog.setPointerCapture(e.pointerId); drag = { last: angle(e, r), acc: 0 }; jog.classList.add('touching'); });
  jog.addEventListener('pointermove', e => { if (!drag) return; const r = jog.getBoundingClientRect(), a = angle(e, r); let d = a - drag.last; if (d > 180) d -= 360; if (d < -180) d += 360; drag.last = a; drag.acc += d; spin += d;
    jog.style.setProperty('--spin', `${spin}deg`); const steps = Math.trunc(drag.acc / JOG_STEP_DEG); if (steps) { drag.acc -= steps * JOG_STEP_DEG; if (finePitch(id, steps)) { jog.classList.add('tick'); setTimeout(() => jog.classList.remove('tick'), 90); if (coarse.matches) navigator.vibrate?.(3); } } });
  const end = () => { drag = null; jog.classList.remove('touching'); }; jog.addEventListener('pointerup', end); jog.addEventListener('pointercancel', end);
  jog.addEventListener('keydown', e => { const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!k) return; e.preventDefault(); if (finePitch(id, k)) { spin += k * JOG_STEP_DEG; jog.style.setProperty('--spin', `${spin}deg`); } });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', event => { if (event.persisted) { pause(); return; } disposed = true; cancelAnimationFrame(frame); audio.dispose().catch(() => {}); });

// ── 曲の流れ（上 A・下 B の実波形）。金の線が「いま」、金の旗が次の入り ──────────────────
let laneWidth = 0, laneChecked = -1e9;
function wave(canvas, id, now) {
  const t0 = performance.now();
  if (t0 - laneChecked > 500) { laneChecked = t0; laneWidth = Math.max(320, Math.round(canvas.clientWidth * 2)); } // read the layout twice a second, not every frame
  if (canvas.width !== laneWidth) canvas.width = laneWidth;
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, x0 = Math.round(w * .3), scale = w / 7;
  c.clearRect(0, 0, w, h); c.fillStyle = '#0a0714cc'; c.fillRect(0, 0, w, h);
  const m = audio.mix, cue = m.cue, t = audio.tracks[id], d = m.decks[id];
  // where the next entry is on the screen: measured on the playing deck, so the flag sits at the same x on both lanes
  const from = cue ? m.decks[cue.from] : null, fb = from ? beatAt(from, now) : 0, xOf = beat => x0 + (beat - fb) * 60 / from.bpm * scale;
  if (cue) { // the 8 bars of the mix
    const xs = Math.max(0, xOf(cue.start)), xe = Math.min(w, xOf(cue.end));
    if (xe > xs) { c.fillStyle = m.phase === 'mix' ? '#ffc85724' : '#ffc85712'; c.fillRect(xs, 0, xe - xs, h); }
  }
  if (t) {
    const b = beatAt(d, now);
    c.fillStyle = id ? '#7fe3ff' : '#c39bff';
    for (let x = 0; x < w; x += 2) {
      const beat = b + ((x - x0) / scale) * d.bpm / 60;
      const peak = peakAt(t, t.firstBeat + mod(b, t.beats) * 60 / t.nativeBpm + (beat - b) * 60 / t.nativeBpm);
      const size = peak * (h - 8); c.globalAlpha = beat < 0 ? .22 : d.playing ? .85 : .5; c.fillRect(x, h / 2 - size / 2, 2, Math.max(1, size));
    }
    c.globalAlpha = 1;
    const first = Math.floor(b - x0 / scale * d.bpm / 60);
    for (let n = first; n < b + (w - x0) / scale * d.bpm / 60; n++) {
      if (mod(n, 4) !== 0) continue;
      const x = x0 + (n - b) * 60 / d.bpm * scale, head = mod(n, PHRASE) === 0;
      c.fillStyle = head ? '#ffffffcc' : '#ffffff40'; c.fillRect(x, 0, head ? 2 : 1, h);
    }
  }
  if (cue && !cue.pressed) {
    const x = xOf(cue.start);
    if (x >= -40 && x < w + 40) { // the entry flag; pulses on every beat in the last bar
      const left = cue.start - fb, pulse = left <= 4 && left > 0 && !reduced.matches ? 1 - mod(fb, 1) : .4, glow = c.createLinearGradient(x - 34, 0, x + 34, 0);
      glow.addColorStop(0, 'transparent'); glow.addColorStop(.5, `rgba(255,200,87,${.2 + pulse * .5})`); glow.addColorStop(1, 'transparent');
      c.fillStyle = glow; c.fillRect(x - 34, 0, 68, h);
      c.fillStyle = '#ffc857'; c.fillRect(x - 2, 0, 4, h);
      if (cue.to === id) { c.font = '900 30px sans-serif'; c.textBaseline = 'middle'; c.fillStyle = '#2a1840'; c.fillRect(x + 2, h / 2 - 20, 86, 40); c.fillStyle = '#ffc857'; c.fillText(`▶ ${deckOf(id)}`, x + 10, h / 2 + 2); }
    }
  }
  c.fillStyle = '#ffc857'; c.fillRect(x0 - 1, 0, 3, h); // いま
  c.beginPath(); c.moveTo(x0 - 9, 0); c.lineTo(x0 + 10, 0); c.lineTo(x0 + .5, 12); c.closePath(); c.fill();
}
// ── フロアの絵の上に重ねる光・手・音符（#crowd）。絵そのものは CSS（.floor-art）が気分で切り替える ──────
function makeHands() {
  let seed = 23 + setIndex; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // each hand goes up once the floor passes its own threshold: nobody below 40, almost everybody near 100
  return Array.from({ length: 15 }, (_, i) => ({ x: (i + .15 + rnd() * .7) / 15, th: .42 + rnd() * .52, size: .8 + rnd() * .55, lean: (rnd() - .5) * .42, phase: rnd(), fist: rnd() < .34, up: 0 }));
}
/** A raised hand in front of the booth: a dark silhouette against the lit haze, with a thin backlight on its edge. */
function drawHand(c, x, base, h, len, bob) {
  const w = 11 * h.size;
  c.save(); c.translate(x, base); c.rotate(h.lean); c.translate(0, -bob);
  c.beginPath(); c.moveTo(-w * 1.35, 40); c.quadraticCurveTo(-w * .7, -len * .5, -w * .62, -len + 2); c.lineTo(w * .62, -len + 2); c.quadraticCurveTo(w * .7, -len * .5, w * 1.35, 40); c.closePath(); // forearm, narrow at the wrist
  if (h.fist) c.roundRect(-w * 1.15, -len - w * 1.75, w * 2.3, w * 2, w * .8);
  else { // open hand: palm, four fingers and a thumb
    c.roundRect(-w * 1.05, -len - w * 1.5, w * 2.1, w * 1.8, w * .6);
    for (const f of [-1.5, -.5, .5, 1.5]) { const fl = w * (1.75 - Math.abs(f) * .24); c.save(); c.translate(f * w * .53, -len - w * 1.3); c.rotate(f * .12); c.roundRect(-w * .22, -fl, w * .44, fl + 4, w * .22); c.restore(); }
    c.save(); c.translate(-w * 1.0, -len - w * .55); c.rotate(-.95); c.roundRect(-w * .22, -w * 1.15, w * .46, w * 1.3, w * .22); c.restore();
  }
  c.fillStyle = '#06030c'; c.fill('nonzero');
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,170,225,.28)'; c.stroke();
  c.restore();
}
function drawFloor(beat, floor, running) {
  const canvas = $('crowd'), W = $('dj-stage').offsetWidth || 1280, H = 288;
  if (canvas.width !== W) canvas.width = W;
  const c = canvas.getContext('2d'); c.clearRect(0, 0, W, H);
  const still = reduced.matches || !running, mood = moodOf(floor), kick = still ? 0 : (1 - mod(beat, 1)) ** 2;
  // beams from the truss: wider and brighter as the room heats up
  const sweep = still ? 0 : Math.sin(beat / 8 * Math.PI * 2);
  c.globalCompositeOperation = 'lighter';
  for (const [at, dir, col] of [[.16, 1, '180,92,240'], [.38, -1, '63,208,232'], [.62, 1, '255,95,168'], [.84, -1, '180,92,240']]) {
    const x = at * W, tip = x + dir * sweep * 150 + (at - .5) * 200, spread = 50 + floor * 70, alpha = (.04 + floor * .2) * (mood >= 4 ? 1 + kick * .5 : 1);
    const g = c.createLinearGradient(x, 0, tip, H); g.addColorStop(0, `rgba(${col},${alpha * 1.6})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 6, 0); c.lineTo(x + 6, 0); c.lineTo(tip + spread, H); c.lineTo(tip - spread, H); c.closePath(); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  // hands in front of the booth
  for (const h of hands) {
    h.up += ((floor >= h.th ? 1 : 0) - h.up) * (reduced.matches ? 1 : .08);
    if (h.up < .02) continue;
    const len = h.up * (50 + h.size * 42), bob = kick * (6 + floor * 18) * (.6 + h.phase * .6) + (still ? 0 : Math.sin((beat / 2 + h.phase) * Math.PI * 2) * 3);
    drawHand(c, h.x * W, H + 8, h, len, bob);
  }
  // notes rising from the crowd while the fader rides the line
  if (!reduced.matches) {
    particles = particles.filter(p => p.life > 0);
    c.font = '900 30px sans-serif'; c.textAlign = 'center';
    for (const p of particles) { p.y -= p.vy; p.x += Math.sin(p.life * 6) * .6; p.life -= .014; c.globalAlpha = Math.min(1, p.life * 2); c.shadowColor = p.color; c.shadowBlur = 12; c.fillStyle = p.color; c.fillText(p.char, p.x * W, p.y); }
    c.globalAlpha = 1; c.shadowBlur = 0;
  }
  const bob = still || mood <= 1 ? 0 : Math.round(-kick * (1 + mood * 1.3) * 2) / 2; // the painted crowd dips on the beat
  if (bob !== shown.bob) { shown.bob = bob; canvas.previousElementSibling.style.transform = bob ? `translateY(${bob}px)` : ''; }
}
const note = () => { if (particles.length < 24) particles.push({ x: .08 + Math.random() * .84, y: 230 + Math.random() * 30, vy: 1 + Math.random() * 1.2, life: 1, char: pickOne(['♪', '♫', '♪']), color: pickOne(['#ffc857', '#ff8fc4', '#aee7d5', '#c39bff']) }); };

// ── 横フェーダーの案内: 光る枠と、そこへ向かう金の矢印 ─────────────────────────────
let comboShown = -1;
/** away: the fader has left the playing deck's side while nothing is being mixed (the sound is fading out). */
function faderGuide(m, away) {
  const band = $('guide'), arrows = $('fader-arrows'), fader = $('crossfader'), x0 = fader.offsetLeft + THUMB / 2, track = fader.offsetWidth - THUMB;
  const mixing = m.phase === 'mix' && view.guide != null && m.fader;
  band.hidden = !mixing;
  let hint = '', target = null, ok = false;
  if (mixing) {
    const g = m.cue.to === 1 ? view.guide : 1 - view.guide, side = followHint(m, view.guide);
    band.style.left = `${x0 + (g - FOLLOW_BAND) * track}px`; band.style.width = `${FOLLOW_BAND * 2 * track}px`;
    band.classList.toggle('in', Math.abs(toward(m) - view.guide) <= FOLLOW_BAND);
    if (view.follow) {
      band.classList.remove('hit', 'miss'); void band.offsetWidth; band.classList.add(view.follow.hit ? 'hit' : 'miss');
      if (view.follow.hit && view.follow.combo >= 4) { note(); if (view.follow.combo >= 16) note(); }
      if (view.follow.combo >= 8 && view.follow.hit) { const f = $('floor'); f.classList.remove('hype'); void f.offsetWidth; f.classList.add('hype'); }
    }
    const on = m.cue.to === 1 ? '右' : '左', back = m.cue.to === 1 ? '左' : '右', done = toward(m) >= .9 && view.guide >= .9;
    if (side === 0 || done) { hint = done ? 'そのまま！' : 'いい感じ、そのまま'; ok = true; }
    else if (side > 0) { hint = m.cue.to === 1 ? `もっと${on}へ →` : `← もっと${on}へ`; target = g; }
    else { hint = m.cue.to === 1 ? `← 行きすぎ、少し${back}へ` : `行きすぎ、少し${back}へ →`; target = g; }
  } else if (away) { target = m.master === 0 ? 0 : 1; hint = m.master === 0 ? '← 左へ戻す' : '右へ戻す →'; }
  arrows.hidden = target == null;
  if (target != null) { // chevrons run from the cap's leading edge toward the target: 1〜3 of them, as many as fit
    const right = target > m.mix, cap = x0 + m.mix * track, n = Math.max(1, Math.min(3, Math.floor((Math.abs(target - m.mix) * track + 20) / 29))), width = n * 29;
    arrows.style.left = `${right ? cap + THUMB / 2 - 6 : cap - THUMB / 2 + 6 - width}px`; arrows.style.width = `${width}px`;
    arrows.classList.toggle('left', !right); [...arrows.children].forEach((el, i) => { el.hidden = i >= n; });
  }
  const label = $('fader-hint'); if (label.textContent !== hint) label.textContent = hint; label.classList.toggle('ok', ok);
  $('xfade').classList.toggle('go', !!mixing || away);
  if (!mixing) { if (comboShown !== -1) { $('combo').textContent = ''; comboShown = -1; } }
  else if (m.fader.combo !== comboShown) { comboShown = m.fader.combo; $('combo').textContent = comboShown > 1 ? `COMBO ${comboShown}` : ''; $('combo').classList.toggle('hot', comboShown >= 8); }
  return hint;
}
function toast(html, ms = 2600) { $('toast').innerHTML = html; toastUntil = performance.now() + ms; }
const RANK_LABEL = { S: 'かんぺきなつなぎ！', A: 'いいつなぎ！', B: 'まずまずのつなぎ', C: 'つなぎが荒れた…' };
function showTransition(t) {
  toast(`<span class="medal r-${t.rank}">${t.rank}</span><span><span class="toast-label">${RANK_LABEL[t.rank]}</span><span class="toast-parts">テンポ <b>${t.parts[0]}</b>・入り <b>${t.parts[1]}</b>・フェーダー <b>${t.parts[2]}</b><span class="best">（最大 ${t.combo} コンボ）</span></span></span>`);
  say(t.rank, { big: t.rank === 'S' }); bump(RANK_FLOOR[t.rank], RANK_LABEL[t.rank].replace(/[！…]/g, ''));
}
/** One line on what to work on next: the weakest of the three parts across the set. */
function advice(r) {
  const avg = [0, 1, 2].map(i => r.transitions.reduce((s, t) => s + t.parts[i], 0) / r.transitions.length), weak = avg.indexOf(Math.min(...avg));
  if (avg[weak] >= 85) return { S: 'フロアが沸いた。完璧なセット！', A: 'いいセット。フロアはずっと踊っていた', B: 'あと少し。入りとフェーダーをていねいに', C: '金色の矢印を追えば、次はもっとつながる' }[r.rank];
  return ['次はテンポ合わせ：PITCH を動かして LOCK を点けるか、SYNC を押そう', '次は入りのタイミング：カウントが 0 になる瞬間に ▶', '次は横フェーダー：光る枠から離れないよう、ゆっくり動かそう'][weak];
}
function showResult(r) {
  const rows = r.transitions.map((t, i) => `<tr><th>${i + 1}</th><td>${TRACKS[t.from].title} → ${TRACKS[t.to].title}</td><td>${t.pick || '—'}</td><td>${t.grade}</td><td>${t.parts.join(' / ')}</td><td>${t.combo}</td><td class="rank r-${t.rank}">${t.rank}</td></tr>`).join('');
  const mood = MOODS[moodOf(r.floor / 100)];
  $('score-result').innerHTML = `<div class="result-card"><div class="result-head"><span class="medal r-${r.rank}">${r.rank}</span><div><small>${r.set} RESULT</small><div class="result-total">${r.total}点</div><div class="result-mood">フロアの熱 ${r.floor}：${mood}${r.bonus ? `（${r.bonus > 0 ? 'ボーナス +' : ''}${r.bonus}点）` : ''}</div></div></div>`
    + `<table><thead><tr><th>#</th><th>つなぎ</th><th>選曲</th><th>入り</th><th>テンポ / 入り / フェーダー</th><th>コンボ</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
    + `<p class="advice">${advice(r)}</p><div class="result-actions"><button id="again" type="button" class="gold">もう一度</button>${embedded ? '<button id="leave" type="button">戻る</button>' : ''}</div></div>`;
  $('again').addEventListener('click', () => $('restart').click());
  $('leave')?.addEventListener('click', () => $('exit').click());
  tell({ type: 'dj-result', set: setIndex + 1, rank: r.rank, total: r.total, floor: r.floor });
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
    if (view.progress >= 1) return { ...out, step: 3, main: `最後まで${sideOf(to)}へ動かしきろう`, sub: `フェーダーが${sideOf(to)}の端に着くと、${deckOf(to)} に乗り換わる`, points: ['fader'] };
    return { ...out, step: 3, main: `横フェーダーを${sideOf(to)}へ。光る枠を追いかけよう`, sub: `8小節かけて ${deckOf(to)} へ乗り換える（${bar}／8）。拍ごとに枠の中かを見る`, points: ['fader'] };
  }
  // cue: waiting for the phrase head, then ▶ on the incoming deck
  const to = cue.to, key = to ? 'b' : 'a', from = m.decks[cue.from], inc = m.decks[to], late = beatAt(from, now) - cue.start;
  const untilHead = late <= 0 ? -late : cue.end - beatAt(from, now), bars = Math.ceil(untilHead / 4), count = untilHead <= 4 && untilHead > 0 ? String(Math.ceil(untilHead)) : '';
  // 「いま！」 only while a press still lands inside the OK window (120 ms + headphones); after that the navi sends the player to the next head
  if (late > 0 && late * 60 / from.bpm * 1000 <= 120 + (m.allowance || 0)) return { ...out, step: 2, untilHead: 0, count: '▶', main: `いま！ ${sideOf(to)}の ▶`, sub: '0 の瞬間に近いほど、フロアが沸く', points: [`play-${key}`] };
  if (bpmDiffPct(from, inc) > LOCK_PCT && untilHead > 4) {
    const up = inc.bpm < from.bpm;
    return { ...out, step: 2, untilHead, main: `テンポ合わせ：${sideOf(to)}の PITCH を${up ? '上' : '下'}へ`, sub: `LOCK が点けば OK。むずかしければ SYNC を押す（あと ${bars} 小節）`, points: [`pitch-${key}-${up ? 'up' : 'down'}`, 'sync'] };
  }
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
      const pitch = $('point-pitch-' + key), dir = n.points.includes(`pitch-${key}-up`) ? 'up' : n.points.includes(`pitch-${key}-down`) ? 'down' : '';
      pitch.hidden = !dir; pitch.classList.toggle('up', dir === 'up'); pitch.classList.toggle('down', dir === 'down');
    }
    $('point-sync').hidden = !n.points.includes('sync');
  }
  shown.step = n.step; shown.pointsKey = points; shown.points = [...n.points];
  if (n.count !== lastCount) { const el = $('count'); el.textContent = n.count; el.classList.remove('beat'); if (n.count) { void el.offsetWidth; el.classList.add('beat'); } lastCount = n.count; }
}
function render() {
  if (disposed) return; const now = audio.now, m = audio.mix;
  view = audio.update();
  if (view.transition) { showTransition(view.transition); missStreak = 0; comboSaid = 0; clashSaid = false; }
  if (view.finished) showResult(view.finished);
  showDecks();
  if (m.phase === 'select' && m.select && shownSelect !== m.select) renderPick(m.select);
  if (m.phase !== 'select' && !$('pick').hidden) { $('pick').hidden = true; shownSelect = null; }
  if (m.lastPlay && m.lastPlay !== shownPlay) {
    shownPlay = m.lastPlay; const grade = shownPlay.grade; judgeUntil = performance.now() + 1800;
    $('judge').textContent = grade; $('judge').dataset.grade = grade; $('judge').classList.remove('pop'); void $('judge').offsetWidth; $('judge').classList.add('pop');
    $('judge-sub').textContent = { PERFECT: 'ぴったり！', GOOD: 'いい入り！', OK: 'まずまず', EARLY: '早すぎた…', LATE: '遅れた…' }[grade];
    // DROP: the incoming track hits the floor (flash on PERFECT/GOOD, a small one on OK, a stumble on EARLY/LATE)
    const drop = $('drop'); drop.className = 'drop'; void drop.offsetWidth;
    drop.className = `drop ${grade === 'PERFECT' || grade === 'GOOD' ? 'big' : grade === 'OK' ? 'small' : 'miss'}`;
    drop.textContent = grade === 'PERFECT' || grade === 'GOOD' ? 'DROP!' : '';
    say(grade, { big: grade === 'PERFECT' }); bump(GRADE_FLOOR[grade], { PERFECT: 'ぴったり入った', GOOD: 'いい入り', EARLY: '入りが早かった', LATE: '入りが遅れた' }[grade] || '');
  }
  if (judgeUntil && performance.now() > judgeUntil) { $('judge').textContent = ''; $('judge-sub').textContent = ''; judgeUntil = 0; }
  if (toastUntil && performance.now() > toastUntil) { $('toast').innerHTML = ''; toastUntil = 0; }
  // the guests react to the fader beat by beat: a voice at 8 / 16 / 24 / 32 in a row, a complaint after four misses in a row
  if (view.follow) {
    if (view.follow.hit) { missStreak = 0; const c = view.follow.combo; if (c % 8 === 0 && c > comboSaid && c <= 32) { comboSaid = c; say(`combo${c}`); } }
    else if (++missStreak === 4) { say('clash'); bump(-.03, 'フェーダーが枠から外れている'); }
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
    const key = id ? 'b' : 'a', d = m.decks[id], play = $('play-' + key), other = m.decks[1 - id];
    put('bpm-' + key, d.track ? d.bpm.toFixed(2) : '--');
    const pitch = pitchOf(d); if (document.activeElement !== $('pitch-' + key)) $('pitch-' + key).value = pitch.toFixed(2);
    put('pitch-value-' + key, `${pitch >= 0 ? '+' : ''}${pitch.toFixed(2)}%`);
    const locked = d.track && other.track && bpmDiffPct(other, d) <= LOCK_PCT; $('lock-' + key).classList.toggle('on', !!locked);
    const beat = mod(beatAt(d, now), PHRASE);
    put('beat-' + key, d.playing ? `再生・${Math.floor(beat / 4) + 1}小節 ${Math.floor(beat % 4) + 1}拍` : '停止中');
    play.setAttribute('aria-pressed', String(d.playing)); play.disabled = audio.busy || !d.track || d.playing;
    const mine = !!(cue && cue.to === id && !cue.pressed && m.phase === 'cue' && m.running), soon = mine && n.untilHead != null && n.untilHead <= 4 && n.untilHead > 0;
    play.classList.toggle('cue-open', mine && n.untilHead === 0);
    play.classList.toggle('cue-soon', soon);
    play.classList.toggle('first', m.phase === 'idle' && id === 0);
    // approach ring: shrinks from twice the button onto the button exactly on the phrase head
    play.style.setProperty('--ap', soon ? (1 + n.untilHead / 4).toFixed(3) : '1');
    $('deck-' + key).dataset.playing = String(d.playing);
    $('deck-' + key).dataset.role = !d.track ? 'empty' : d.playing && m.master === id ? 'master' : d.playing ? 'incoming' : 'next';
    put('indicator-' + key, !d.track ? 'EMPTY' : d.playing ? 'ON AIR' : 'STANDBY');
    $('platter-' + key).style.setProperty('--rotation', `${reduced.matches || !d.playing ? 0 : mod(beatAt(d, now), 4) * 90}deg`);
    if ($('platter-' + key).getAttribute('aria-valuenow') !== d.bpm.toFixed(2)) $('platter-' + key).setAttribute('aria-valuenow', d.bpm.toFixed(2));
    $('side-' + key).classList.toggle('goal', !!cue && cue.to === id && m.running);
    wave($('wave-' + key), id, now);
  }
  $('sync').disabled = !cue || !m.running;
  $('sync').classList.toggle('needed', !!(cue && m.running && bpmDiffPct(m.decks[cue.from], m.decks[cue.to]) > LOCK_PCT));
  put('mix-value', `A ${Math.round((1 - m.mix) * 100)} / B ${Math.round(m.mix * 100)}%`);
  const heat = m.floor.toFixed(3); if (heat !== shown.heat) { shown.heat = heat; $('floor-fill').style.setProperty('--f', heat); put('floor-value', String(Math.round(m.floor * 100))); }
  showMood(m);
  put('set-progress', `${m.phase === 'done' ? m.count : Math.min(m.count, m.transitions.length + 1 + (m.phase === 'mix' ? 1 : 0))} / ${m.count}`);
  put('set-next', cue ? `NEXT ▶ ${cue.to ? 'B' : 'A'}` : m.phase === 'select' ? '選曲' : m.phase === 'done' ? 'LAST TRACK' : '');
  shown.hint = faderGuide(m, away); shown.away = away;
  showNavi(n, m);
  const help = helpManual ?? (m.phase === 'idle');
  if ($('howto').hidden === help) { $('howto').hidden = !help; $('help').setAttribute('aria-pressed', String(help)); }
  controllerLeds();
  drawFloor(beatAt(master, now), m.floor, m.running);
  frame = requestAnimationFrame(render);
}
render();
// Controller LEDs only (no input/scoring effect): channel meters and the EQ knobs showing the automatic EQ.
function controllerLeds() {
  const m = audio.mix, level = Math.min(1, audio.level() * 6), g = gains(m.mix), cut = lowCutDb(m.mix);
  for (const id of ['meter-m', 'meter-m2']) $(id).style.setProperty('--lvl', m.running ? Math.min(1, level * (id === 'meter-m' ? 1 : .92)).toFixed(3) : '0');
  for (const id of [0, 1]) {
    const key = id ? 'b' : 'a', on = m.decks[id].playing && m.running, c = cut[id] / LOW_CUT_DB;
    $('meter-' + key).style.setProperty('--lvl', on ? (level * g[id]).toFixed(3) : '0');
    const low = $('eq-low-' + key); low.style.setProperty('--k', `${-135 * c}deg`); low.parentElement.style.setProperty('--cut', c.toFixed(2));
    $('eq-hi-' + key).style.setProperty('--k', `${-40 * c}deg`); $('eq-mid-' + key).style.setProperty('--k', `${-20 * c}deg`);
  }
  const cutting = cut.findIndex(v => v < -1);
  $('led-autoeq').classList.toggle('on', cutting >= 0);
  put('auto-low', cutting < 0 ? 'EQは横フェーダーに合わせて自動' : `AUTO EQ：${cutting ? 'B' : 'A'} の低音 ${Math.round(cut[cutting])}dB`);
}
