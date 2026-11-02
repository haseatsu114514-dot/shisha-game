import { DJAudio } from './audio.mjs';
import { beatAt, lowCutDb, LOW_CUT_DB, LOCK_PCT, PHRASE, FOLLOW_BAND, REQUESTS, phaseError, bpmDiffPct, pitchOf, mod, gains, toward, keyMatch } from './model.mjs';
import { peakAt, TRACKS, SETS } from './tracks.mjs';
const $ = id => document.getElementById(id);
// The host (main game) picks the set with ?set=1..3 (?stage= is the old name); default SET 1.
const params = new URLSearchParams(location.search);
const setParam = Number(params.get('set') || params.get('stage')) - 1;
const setIndex = SETS[setParam] ? setParam : 0;
// ?embed=1: opened by the main game (remake/js/minigames/dj.js). Shows ← 戻る and follows the game's mute / BGM volume (?mute=1, ?vol=0..1).
const embedded = params.get('embed') === '1' && window.parent !== window;
const gameVolume = Number(params.get('vol')), gameMuted = params.get('mute') === '1';
const tell = message => { try { if (embedded) window.parent.postMessage(message, location.origin); } catch { /* host optional */ } };
const reduced = matchMedia('(prefers-reduced-motion: reduce)'), coarse = matchMedia('(pointer: coarse)');
let audio, disposed = false, frame = 0, view = { mode: 'idle' }, message = '', toastUntil = 0, judgeUntil = 0, shownPlay = null, lastCount = '', crowd = null, shownTracks = [null, null], shownSelect = null;
const status = text => { $('status').textContent = text; };
function create() {
  audio = new DJAudio(undefined, { setIndex });
  if (embedded) { audio.muted = gameMuted; if (Number.isFinite(gameVolume)) audio.volume = Math.max(0, Math.min(.36, .18 * gameVolume / .5)); }
  audio.onInterrupted = () => status('音声が中断されました。▶で再開します。');
  shownTracks = [undefined, undefined]; shownSelect = null; $('pick').hidden = true;
  $('set-name').textContent = SETS[setIndex].name; $('score-result').innerHTML = ''; $('judge').textContent = ''; $('toast').textContent = '';
  crowd = makeCrowd(); view = { mode: 'idle' }; shownPlay = null; judgeUntil = 0; toastUntil = 0;
  showDecks();
}
/** Deck titles and artwork follow the decks (a deck is empty while the next track is being picked). */
function showDecks() {
  audio.mix.decks.forEach((d, id) => {
    const shown = d.track ?? (audio.mix.phase === 'done' ? 'done' : null);
    if (shownTracks[id] === shown) return;
    shownTracks[id] = shown; const key = id ? 'b' : 'a', t = TRACKS[d.track];
    $('track-' + key).textContent = t ? t.title : shown === 'done' ? '—' : '— 選曲中 —';
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
    voices: audio.voices.filter(Boolean).length, rms: audio.level(), reduced: reduced.matches, embedded, muted: audio.muted, volume: audio.volume, remaining: view.remaining, progress: view.progress };
}
async function pause() { try { await audio.pause(); status('停止中。▶で再開します。'); } catch (e) { status(`停止処理: ${e.message}`); } }
for (const id of [0, 1]) {
  const key = id ? 'b' : 'a';
  $('pitch-' + key).addEventListener('input', e => audio.pitch(id, Number(e.target.value)));
  $('play-' + key).addEventListener('click', async () => {
    if (audio.mix.decks[id].playing) return; // ▶ only starts: a deck leaves the air when its transition ends
    try { if (await audio.play(id)) { if (document.hidden) { await pause(); return; } status(`${key.toUpperCase()} ON AIR`); } }
    catch (e) { status(`${e.message}。▶から再試行できます。`); }
  });
}
$('sync').addEventListener('click', () => { if (audio.sync()) status('SYNC：次の曲のBPMを合わせました'); });
// 選曲: two candidate cards over the empty deck. The floor's request and the key decide how well the pick lands.
function renderPick(select) {
  const m = audio.mix, now = m.decks[m.master], left = select.deck === 0;
  $('pick').dataset.side = left ? 'a' : 'b'; $('request').textContent = `フロアの声：「${REQUESTS[select.request]}」`;
  $('pick-cards').replaceChildren(...select.options.map((key, index) => {
    const t = TRACKS[key], ok = keyMatch(now.track, key), arrow = t.energy > TRACKS[now.track].energy ? '↑' : t.energy < TRACKS[now.track].energy ? '↓' : '→';
    const button = document.createElement('button'); button.type = 'button'; button.id = `pick-${index}`; button.className = 'pick-card';
    button.style.setProperty('--art', `url('../../img/ui/dj/art-${key}.webp')`);
    button.innerHTML = `<b>${t.title}</b><span class="pick-meta">${t.bpm} BPM${m.set.detune === 'match' && t.bpm !== now.bpm ? ` → ${now.bpm.toFixed(0)}（自動）` : ''} ・ キー ${t.camelot} <em class="${ok ? 'ok' : 'ng'}">${ok ? '相性◯' : '相性✕'}</em></span><span class="energy" aria-label="盛り上がり ${t.energy}">${'▮'.repeat(t.energy)}${'▯'.repeat(5 - t.energy)} <small>${arrow}</small></span>`;
    button.addEventListener('click', () => {
      const picked = audio.choose(index); if (!picked) return;
      $('pick').hidden = true; shownSelect = null; showDecks();
      toast(`<strong class="rank pick-${picked.rating === '◎' ? 'great' : picked.rating === '○' ? 'good' : 'bad'}">${picked.rating}</strong><span class="toast-label">${{ '◎': 'フロアが沸いた', '○': '悪くない選曲', '△': 'フロアが少し冷めた' }[picked.rating]}</span><span class="toast-parts">${TRACKS[picked.key].title}</span>`, 2200);
      status(`選曲：${TRACKS[picked.key].title}（${picked.rating}）`);
    });
    return button;
  }));
  $('pick').hidden = false; shownSelect = select;
}
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

function wave(canvas, id, now) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, x0 = Math.round(w * .32), scale = w / 7;
  c.clearRect(0, 0, w, h); const t = audio.tracks[id]; if (!t) return;
  const d = audio.mix.decks[id], b = beatAt(d, now), m = audio.mix, cue = m.cue;
  // mix window shading on the master's lane
  if (cue && cue.from === id) {
    const xs = x0 + (cue.start - b) * 60 / d.bpm * scale, xe = x0 + (cue.end - b) * 60 / d.bpm * scale;
    c.fillStyle = m.phase === 'mix' ? '#b45cf022' : '#aee7d51a'; c.fillRect(Math.max(0, xs), 0, Math.min(w, xe) - Math.max(0, xs), h);
  }
  c.fillStyle = id ? '#7fe3ff' : '#c39bff';
  for (let x = 0; x < w; x += 2) {
    const beat = b + ((x - x0) / scale) * d.bpm / 60;
    const peak = peakAt(t, t.firstBeat + mod(b, t.beats) * 60 / t.nativeBpm + (beat - b) * 60 / t.nativeBpm);
    const size = peak * (h - 6); c.globalAlpha = beat < 0 ? .25 : .8; c.fillRect(x, h / 2 - size / 2, 2, Math.max(1, size));
  }
  c.globalAlpha = 1;
  const first = Math.floor(b - x0 / scale * d.bpm / 60);
  for (let n = first; n < b + (w - x0) / scale * d.bpm / 60; n++) {
    const x = x0 + (n - b) * 60 / d.bpm * scale;
    c.fillStyle = mod(n, PHRASE) === 0 ? '#aee7d5' : mod(n, 4) === 0 ? '#e7d8dd' : '#60545e'; c.fillRect(x, 0, mod(n, PHRASE) === 0 ? 2 : 1, h);
    if (mod(n, 4) === 0) { c.font = '10px monospace'; c.fillText(`${Math.floor(mod(n, PHRASE) / 4) + 1}`, x + 3, 11); }
  }
  if (cue && cue.from === id && !cue.pressed) {
    const x = x0 + (cue.start - b) * 60 / d.bpm * scale;
    if (x >= -30 && x < w + 30) {
      // glowing entry point; pulses on every beat in the last bar
      const left = cue.start - b, pulse = left <= 4 && !reduced.matches ? 1 - mod(b, 1) : .35, glow = c.createLinearGradient(x - 28, 0, x + 28, 0);
      glow.addColorStop(0, 'transparent'); glow.addColorStop(.5, `rgba(174,231,213,${.25 + pulse * .45})`); glow.addColorStop(1, 'transparent');
      c.fillStyle = glow; c.fillRect(x - 28, 0, 56, h);
      c.fillStyle = '#aee7d5'; c.fillRect(x - 1, 0, 3, h); c.font = 'bold 12px monospace'; c.fillText('IN ▶', Math.min(w - 36, x + 6), h - 5);
    }
  }
  c.fillStyle = '#fff'; c.fillRect(x0, 0, 2, h);
}
// Pixel crowd on the floor strip: more hands go up as the floor meter rises; everyone bobs on the master's beat.
function makeCrowd() {
  let seed = 11 + setIndex; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const people = [];
  // The painted crowd (img/ui/dj/floor-crowd.webp, DJS15) is the room now: the canvas only sweeps light on the beat,
  // and the FLOOR meter brightens the painting (style.css .floor:before). Pixel people are no longer drawn.
  void rnd;
  return people;
}
function drawCrowd(beat, floor, running) {
  const c = $('crowd').getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 313, 28);
  const still = reduced.matches || !running;
  // sweeping light beams behind the crowd, brighter as the floor fills
  const sweep = still ? 0 : Math.sin(beat / 8 * Math.PI * 2);
  for (const [cx, col] of [[60 + sweep * 40, '#b45cf0'], [250 - sweep * 40, '#3fd0e8']]) {
    const g = c.createLinearGradient(cx - 50, 0, cx + 50, 0); g.addColorStop(0, 'transparent'); g.addColorStop(.5, col); g.addColorStop(1, 'transparent');
    c.globalAlpha = .12 + floor * .2; c.fillStyle = g; c.fillRect(cx - 50, 0, 100, 28);
  }
  c.globalAlpha = 1;
  for (const p of crowd) {
    const ph = mod(beat + p.phase * 4, 4) / 4 * Math.PI * 2, bob = still ? 0 : Math.round((1 - Math.cos(ph * 2)) * p.size * .6);
    const up = p.hands < floor, s = p.size, x = Math.round(p.x), y = p.y - bob, w = Math.round(2 * s);
    const shade = '#07040d';
    c.fillStyle = shade;
    c.fillRect(x, y, w, w); // head
    c.fillRect(x - Math.round(s * .5), y + w, Math.round(3 * s), 28 - y); // body
    const arm = 1 + Math.round(s * .4);
    if (up) { const sway = still ? 0 : Math.round(Math.sin(ph) * s * p.lean); c.fillRect(x - Math.round(s) + sway, y - Math.round(2.5 * s), arm, Math.round(3 * s)); c.fillRect(x + w + sway, y - Math.round(2.5 * s), arm, Math.round(3 * s)); }
    else { c.fillRect(x - Math.round(s), y + Math.round(2.5 * s), arm, Math.round(2 * s)); c.fillRect(x + w, y + Math.round(2.5 * s), arm, Math.round(2 * s)); }
    // backlit rim on the head and shoulders
    c.fillStyle = '#c39bff80'; c.fillRect(x, y, w, 1); c.fillRect(x - Math.round(s * .5), y + w, Math.round(3 * s), 1);
  }
}
// Guide band on the crossfader groove during the 8 bars: ride it, one check per beat, combo.
let comboShown = -1;
function guideBand(m) {
  const band = $('guide'), on = m.phase === 'mix' && view.guide != null && m.fader;
  band.hidden = !on;
  if (!on) { if (comboShown !== -1) { $('combo').textContent = ''; comboShown = -1; } return; }
  const fader = $('crossfader'), W = fader.offsetWidth, thumb = 46, track = W - thumb;
  const g = m.cue.to === 1 ? view.guide : 1 - view.guide;
  band.style.left = `${thumb / 2 + (g - FOLLOW_BAND) * track}px`; band.style.width = `${FOLLOW_BAND * 2 * track}px`;
  band.classList.toggle('in', Math.abs(toward(m) - view.guide) <= FOLLOW_BAND);
  if (view.follow) {
    band.classList.remove('hit', 'miss'); void band.offsetWidth; band.classList.add(view.follow.hit ? 'hit' : 'miss');
    if (view.follow.combo >= 8 && view.follow.hit) { const f = document.querySelector('.floor'); f.classList.remove('hype'); void f.offsetWidth; f.classList.add('hype'); }
  }
  if (m.fader.combo !== comboShown) { comboShown = m.fader.combo; $('combo').textContent = comboShown > 1 ? `COMBO ${comboShown}` : ''; $('combo').classList.toggle('hot', comboShown >= 8); }
}
function toast(html, ms = 2600) { $('toast').innerHTML = html; toastUntil = performance.now() + ms; }
function showTransition(t) {
  const label = { S: 'EXCELLENT MIX', A: 'NICE MIX', B: 'OK MIX', C: 'ROUGH MIX' }[t.rank];
  toast(`<strong class="rank r-${t.rank}">${t.rank}</strong><span class="toast-label">${label}</span><span class="toast-parts">BPM ${t.parts[0]} ・ 入り ${t.parts[1]} ・ フェーダー ${t.parts[2]}（最大 ${t.combo} コンボ）</span>`);
}
function showResult(r) {
  const rows = r.transitions.map((t, i) => `<tr><th>${i + 1}</th><td>${TRACKS[t.from].title} → ${TRACKS[t.to].title}</td><td>${t.pick || '—'}</td><td>${t.grade}</td><td>${t.parts.join(' / ')}</td><td>${t.combo}</td><td class="r-${t.rank}">${t.rank}</td></tr>`).join('');
  $('score-result').innerHTML = `<div class="result-card"><div class="result-head"><small>${r.set} RESULT</small><strong class="rank r-${r.rank}">${r.rank}</strong><span class="result-total">${r.total}点 ・ FLOOR ${r.floor}%${r.bonus ? `（${r.bonus > 0 ? '+' : ''}${r.bonus}）` : ''}</span></div><table><thead><tr><th>#</th><th>つなぎ</th><th>選曲</th><th>入り</th><th>BPM / 入り / フェーダー</th><th>コンボ</th><th></th></tr></thead><tbody>${rows}</tbody></table><p>${{ S: 'フロアが沸いた。完璧なセット！', A: 'いいセット。フロアはずっと踊っていた', B: 'つなぎが少し荒い。フェーダーはゆっくり、入りは拍の頭で', C: '次はBPMを合わせてから、カウントの0で▶' }[r.rank]}</p><div class="result-actions"><button id="again" type="button">もう一度</button>${embedded ? '<button id="leave" type="button">戻る</button>' : ''}</div></div>`;
  $('again').addEventListener('click', () => $('restart').click());
  $('leave')?.addEventListener('click', () => $('exit').click());
  tell({ type: 'dj-result', set: setIndex + 1, rank: r.rank, total: r.total, floor: r.floor });
}
function render() {
  if (disposed) return; const now = audio.now, m = audio.mix;
  view = audio.update();
  if (view.transition) showTransition(view.transition);
  if (view.finished) showResult(view.finished);
  showDecks();
  if (m.phase === 'select' && m.select && shownSelect !== m.select) renderPick(m.select);
  if (m.phase !== 'select' && !$('pick').hidden) { $('pick').hidden = true; shownSelect = null; }
  if (m.lastPlay && m.lastPlay !== shownPlay) {
    shownPlay = m.lastPlay; judgeUntil = performance.now() + 1800; $('judge').textContent = shownPlay.grade; $('judge').dataset.grade = shownPlay.grade; $('judge').classList.remove('pop'); void $('judge').offsetWidth; $('judge').classList.add('pop');
    // DROP: the incoming track hits the floor (flash on PERFECT/GOOD, a small one on OK, a stumble on EARLY/LATE)
    const drop = $('drop'); drop.className = 'drop'; void drop.offsetWidth;
    drop.className = `drop ${shownPlay.grade === 'PERFECT' || shownPlay.grade === 'GOOD' ? 'big' : shownPlay.grade === 'OK' ? 'small' : 'miss'}`;
    drop.textContent = shownPlay.grade === 'PERFECT' || shownPlay.grade === 'GOOD' ? 'DROP!' : '';
  }
  if (judgeUntil && performance.now() > judgeUntil) { $('judge').textContent = ''; judgeUntil = 0; }
  if (toastUntil && performance.now() > toastUntil) { $('toast').innerHTML = ''; toastUntil = 0; }
  const cue = m.cue, master = m.decks[m.master];
  for (const id of [0, 1]) {
    const key = id ? 'b' : 'a', d = m.decks[id], play = $('play-' + key), other = m.decks[1 - id];
    $('bpm-' + key).value = d.track ? d.bpm.toFixed(2) : '--';
    const pitch = pitchOf(d); if (document.activeElement !== $('pitch-' + key)) $('pitch-' + key).value = pitch.toFixed(2);
    $('pitch-value-' + key).textContent = `${pitch >= 0 ? '+' : ''}${pitch.toFixed(2)}%`;
    const locked = d.track && other.track && bpmDiffPct(other, d) <= LOCK_PCT; $('lock-' + key).classList.toggle('on', !!locked);
    const beat = mod(beatAt(d, now), PHRASE);
    $('beat-' + key).textContent = d.playing ? `再生・${Math.floor(beat / 4) + 1}小節 ${Math.floor(beat % 4) + 1}拍` : '停止中';
    play.setAttribute('aria-pressed', String(d.playing)); play.disabled = audio.busy || !d.track || d.playing;
    play.classList.toggle('cue-open', !!(cue && cue.to === id && !cue.pressed && view.open));
    const approaching = !!(cue && cue.to === id && !cue.pressed && !view.open && view.remaining <= 4);
    play.classList.toggle('cue-soon', approaching);
    // approach ring: shrinks from twice the button to the button exactly on the phrase head
    play.style.setProperty('--ap', approaching ? (1 + view.remaining / 4).toFixed(3) : '1');
    $('deck-' + key).dataset.playing = String(d.playing);
    $('deck-' + key).dataset.role = !d.track ? 'empty' : d.playing && m.master === id ? 'master' : d.playing ? 'incoming' : 'next';
    $('indicator-' + key).textContent = !d.track ? 'EMPTY' : d.playing ? 'ON AIR' : 'STANDBY';
    $('platter-' + key).style.setProperty('--rotation', `${reduced.matches || !d.playing ? 0 : mod(beatAt(d, now), 4) * 90}deg`);
    $('platter-' + key).setAttribute('aria-valuenow', d.bpm.toFixed(2));
    wave($('wave-' + key), id, now);
  }
  $('sync').disabled = !cue || !m.running;
  $('sync').classList.toggle('needed', !!(cue && m.running && bpmDiffPct(m.decks[cue.from], m.decks[cue.to]) > LOCK_PCT));
  $('mix-value').textContent = `A ${Math.round((1 - m.mix) * 100)} / B ${Math.round(m.mix * 100)}%`;
  $('phrase').value = m.phase === 'mix' ? view.progress : 0;
  $('floor-fill').style.setProperty('--f', m.floor.toFixed(3)); document.querySelector('.floor').style.setProperty('--f', m.floor.toFixed(3)); $('floor-value').value = String(Math.round(m.floor * 100));
  $('set-progress').textContent = `${m.phase === 'done' ? m.count : Math.min(m.count, m.transitions.length + 1 + (m.phase === 'mix' ? 1 : 0))} / ${m.count}`;
  $('set-next').textContent = cue ? `NEXT ▶ ${cue.to ? 'B' : 'A'}` : m.phase === 'select' ? '選曲' : m.phase === 'done' ? 'LAST TRACK' : '';
  guideBand(m);
  const target = cue ? (cue.to ? 'B' : 'A') : '';
  let text;
  if (m.phase === 'idle') text = 'Aの ▶ でセットを始める';
  else if (m.phase === 'cue') text = view.open ? `今！ ${target} の ▶` : view.remaining <= 4 ? `${target} の入りまで ${Math.ceil(view.remaining)} 拍` : `次の入りまで ${Math.ceil(view.remaining / 4)} 小節${bpmDiffPct(m.decks[cue.from], m.decks[cue.to]) > LOCK_PCT ? `：${target} のBPMを PITCH で合わせる` : '：BPMは合っている'}`;
  else if (m.phase === 'mix') text = `8小節MIX ${Math.min(8, Math.floor(view.progress * 8) + 1)}/8：光の帯に合わせて横フェーダーを ${target} へ`;
  else if (m.phase === 'select' && m.select) text = `次の曲を選ぶ：フロアは「${REQUESTS[m.select.request]}」。キーの相性も見て`;
  else text = 'セット終了。最後の曲が流れている';
  if (text !== message) { $('coaching').textContent = text; message = text; }
  const count = m.phase === 'cue' && view.remaining <= 4 && view.remaining > 0 ? String(Math.ceil(view.remaining)) : m.phase === 'cue' && view.open ? '▶' : '';
  if (count !== lastCount) { $('count').textContent = count; lastCount = count; }
  controllerLeds();
  drawCrowd(beatAt(master, now), m.floor, m.running);
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
  $('auto-low').textContent = cutting < 0 ? 'EQは横フェーダーに合わせて自動' : `AUTO EQ：${cutting ? 'B' : 'A'} の低音 ${Math.round(cut[cutting])}dB`;
}
