import { DJAudio } from './audio.mjs';
import { beatAt, lowCutDb, LOW_CUT_DB, LOCK_PCT, PHRASE, phaseError, bpmDiffPct, pitchOf, mod, gains } from './model.mjs';
import { peakAt, TRACKS, SETS } from './tracks.mjs';
const $ = id => document.getElementById(id);
// The host (main game) picks the set with ?set=1..3 (?stage= is the old name); default SET 1.
const params = new URLSearchParams(location.search);
const setParam = Number(params.get('set') || params.get('stage')) - 1;
const setIndex = SETS[setParam] ? setParam : 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)'), coarse = matchMedia('(pointer: coarse)');
let audio, disposed = false, frame = 0, view = { mode: 'idle' }, message = '', toastUntil = 0, judgeUntil = 0, shownPlay = null, lastCount = '', crowd = null;
const status = text => { $('status').textContent = text; };
function create() {
  audio = new DJAudio(undefined, { setIndex });
  audio.onInterrupted = () => status('音声が中断されました。▶で再開します。');
  const d = audio.mix.decks;
  for (const id of [0, 1]) { const key = id ? 'b' : 'a', t = TRACKS[d[id].track]; $('track-' + key).textContent = t.title; $('platter-' + key).style.setProperty('--art', `url('../../img/ui/dj/art-${d[id].track}.webp')`); }
  $('set-name').textContent = SETS[setIndex].name; $('score-result').innerHTML = ''; $('judge').textContent = ''; $('toast').textContent = '';
  crowd = makeCrowd(); view = { mode: 'idle' }; shownPlay = null; judgeUntil = 0; toastUntil = 0;
}
create();
export function snapshot() {
  const now = audio.now, m = audio.mix;
  return { set: setIndex, phase: m.phase, mode: view.mode, clock: now, state: audio.context?.state || 'not-started', running: m.running,
    tracks: m.decks.map(d => d.track), bpms: m.decks.map(d => d.bpm), pitches: m.decks.map(d => Math.round(pitchOf(d) * 100) / 100),
    beats: m.decks.map(d => beatAt(d, now)), playing: m.decks.map(d => d.playing), phase_error: phaseError(...m.decks, now),
    mix: m.mix, master: m.master, cue: m.cue ? { ...m.cue } : null, lastPlay: m.lastPlay, floor: m.floor, fader: m.fader ? { maxJump: m.fader.maxJump, reached: m.fader.reached } : null,
    transitions: m.transitions.map(t => ({ to: t.to, grade: t.grade, parts: t.parts, total: t.total, rank: t.rank })), result: m.result,
    voices: audio.voices.filter(Boolean).length, rms: audio.level(), reduced: reduced.matches, remaining: view.remaining, progress: view.progress };
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
  if (cue && cue.from === id && !cue.pressed) { const x = x0 + (cue.start - b) * 60 / d.bpm * scale; if (x >= 0 && x < w) { c.fillStyle = '#aee7d5'; c.fillRect(x, 0, 3, h); c.font = 'bold 11px monospace'; c.fillText('IN', Math.min(w - 20, x + 5), h - 5); } }
  c.fillStyle = '#fff'; c.fillRect(x0, 0, 2, h);
}
// Pixel crowd on the floor strip: more hands go up as the floor meter rises; everyone bobs on the master's beat.
function makeCrowd() {
  let seed = 11 + setIndex; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const people = [];
  for (const [row, count, y, size] of [[0, 46, 9, 1], [1, 34, 15, 1.4], [2, 24, 22, 1.9]]) for (let i = 0; i < count; i++) people.push({ row, x: 2 + (i + rnd() * .8) * (309 / count), y, size, phase: rnd(), hands: rnd(), lean: rnd() < .5 ? -1 : 1 });
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
    const shade = p.row === 0 ? '#2b1f46' : p.row === 1 ? '#1c1333' : '#0e0919';
    c.fillStyle = shade;
    c.fillRect(x, y, w, w); // head
    c.fillRect(x - Math.round(s * .5), y + w, Math.round(3 * s), 28 - y); // body
    const arm = 1 + Math.round(s * .4);
    if (up) { const sway = still ? 0 : Math.round(Math.sin(ph) * s * p.lean); c.fillRect(x - Math.round(s) + sway, y - Math.round(2.5 * s), arm, Math.round(3 * s)); c.fillRect(x + w + sway, y - Math.round(2.5 * s), arm, Math.round(3 * s)); }
    else { c.fillRect(x - Math.round(s), y + Math.round(2.5 * s), arm, Math.round(2 * s)); c.fillRect(x + w, y + Math.round(2.5 * s), arm, Math.round(2 * s)); }
    // backlit rim on the head and shoulders
    c.fillStyle = p.row === 2 ? '#c39bffb0' : p.row === 1 ? '#b45cf070' : '#b45cf040'; c.fillRect(x, y, w, 1); c.fillRect(x - Math.round(s * .5), y + w, Math.round(3 * s), 1);
  }
}
function toast(html, ms = 2600) { $('toast').innerHTML = html; toastUntil = performance.now() + ms; }
function showTransition(t) {
  const label = { S: 'EXCELLENT MIX', A: 'NICE MIX', B: 'OK MIX', C: 'ROUGH MIX' }[t.rank];
  toast(`<strong class="rank r-${t.rank}">${t.rank}</strong><span class="toast-label">${label}</span><span class="toast-parts">BPM ${t.parts[0]} ・ 入り ${t.parts[1]} ・ フェーダー ${t.parts[2]}</span>`);
}
function showResult(r) {
  const rows = r.transitions.map((t, i) => `<tr><th>${i + 1}</th><td>${TRACKS[t.from].title} → ${TRACKS[t.to].title}</td><td>${t.grade}</td><td>${t.parts.join(' / ')}</td><td class="r-${t.rank}">${t.rank}</td></tr>`).join('');
  $('score-result').innerHTML = `<div class="result-card"><div class="result-head"><small>${r.set} RESULT</small><strong class="rank r-${r.rank}">${r.rank}</strong><span class="result-total">${r.total}点 ・ FLOOR ${r.floor}%</span></div><table><thead><tr><th>#</th><th>つなぎ</th><th>入り</th><th>BPM / 入り / フェーダー</th><th></th></tr></thead><tbody>${rows}</tbody></table><p>${{ S: 'フロアが沸いた。完璧なセット！', A: 'いいセット。フロアはずっと踊っていた', B: 'つなぎが少し荒い。フェーダーはゆっくり、入りは拍の頭で', C: '次はBPMを合わせてから、カウントの0で▶' }[r.rank]}</p><button id="again" type="button">もう一度</button></div>`;
  $('again').addEventListener('click', () => $('restart').click());
  try { if (window.parent !== window) window.parent.postMessage({ type: 'dj-result', set: setIndex + 1, rank: r.rank, total: r.total, floor: r.floor }, location.origin); } catch { /* host optional */ }
}
function render() {
  if (disposed) return; const now = audio.now, m = audio.mix;
  view = audio.update();
  if (view.transition) showTransition(view.transition);
  if (view.finished) showResult(view.finished);
  if (view.loaded) { const key = view.loaded.id ? 'b' : 'a'; $('track-' + key).textContent = TRACKS[view.loaded.key].title; $('platter-' + key).style.setProperty('--art', `url('../../img/ui/dj/art-${view.loaded.key}.webp')`); $('pitch-' + key).value = '0'; }
  if (m.lastPlay && m.lastPlay !== shownPlay) { shownPlay = m.lastPlay; judgeUntil = performance.now() + 1800; $('judge').textContent = shownPlay.grade; $('judge').dataset.grade = shownPlay.grade; $('judge').classList.remove('pop'); void $('judge').offsetWidth; $('judge').classList.add('pop'); }
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
    play.classList.toggle('cue-soon', !!(cue && cue.to === id && !cue.pressed && !view.open && view.remaining <= 4));
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
  $('floor-fill').style.setProperty('--f', m.floor.toFixed(3)); $('floor-value').value = String(Math.round(m.floor * 100));
  $('set-progress').textContent = `${m.phase === 'done' ? m.queue.length : m.position - 1} / ${m.queue.length}`;
  $('set-next').textContent = cue ? `NEXT ▶ ${cue.to ? 'B' : 'A'}` : m.phase === 'done' ? 'LAST TRACK' : '';
  const target = cue ? (cue.to ? 'B' : 'A') : '';
  let text;
  if (m.phase === 'idle') text = 'Aの ▶ でセットを始める';
  else if (m.phase === 'cue') text = view.open ? `今！ ${target} の ▶` : view.remaining <= 4 ? `${target} の入りまで ${Math.ceil(view.remaining)} 拍` : `次の入りまで ${Math.ceil(view.remaining / 4)} 小節${bpmDiffPct(m.decks[cue.from], m.decks[cue.to]) > LOCK_PCT ? `：${target} のBPMを PITCH で合わせる` : '：BPMは合っている'}`;
  else if (m.phase === 'mix') text = `8小節MIX ${Math.min(8, Math.floor(view.progress * 8) + 1)}/8：横フェーダーを ${target} へゆっくり`;
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
