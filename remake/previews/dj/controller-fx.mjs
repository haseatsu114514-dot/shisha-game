// Tactile feedback for the DJ controller. Visual/haptic only: never calls audio, model or scoring.
const STAGE_W = 1280, STAGE_MAX_W = 1600, STAGE_H = 720;
const stage = document.getElementById('dj-stage');
// 本編のワイドステージ（#2861・remake/js/main.js の fitStage）と同じく、横長の画面では板を最大1600まで横に広げる（高さは720のまま）。
// 左右のデッキの列は幅に追従し（.console の minmax(0,1fr)）、ミキサーは中央の幅のまま。iPhone 横持ちで左右が黒い帯にならない。
function fit() {
  const width = Math.min(STAGE_MAX_W, Math.max(STAGE_W, Math.floor(innerWidth / innerHeight * STAGE_H)));
  stage.style.width = `${width}px`;
  // 2026-11-13 DJG「皿を大きく」: PITCH の列が無くなった分、デッキの列を広げて皿を大きくする（1280 で 356px、広い画面で 366px まで。以前は 308px）。
  // 皿は外側の上、▶ は内側の下の角、曲名は皿の下。▶ の丸が皿の丸に重ならない大きさにしてある（列の幅 362 → 皿 356、378 → 366）。
  const deck = Math.max(362, Math.min(378, Math.floor((width - 72 - 484) / 2)));
  stage.style.setProperty('--deck-w', `${deck}px`); stage.style.setProperty('--jog', `${Math.min(366, 356 + Math.floor((deck - 362) * .625))}px`);
  stage.style.setProperty('--s', String(Math.min(innerWidth / width, innerHeight / STAGE_H)));
}
fit(); addEventListener('resize', fit);
const coarse = matchMedia('(pointer: coarse)');
const buzz = ms => { if (coarse.matches && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* unsupported */ } };
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (b && !b.disabled) { b.classList.add('hit'); buzz(8); setTimeout(() => b.classList.remove('hit'), 140); }
  // 押しても何も起きないボタンを作らない（DJG08）: いまは押せない ▶（もう鳴っている・曲が載っていない）も、首を振って鈍い音で返す
  else if (b && b.classList.contains('deck-play')) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); buzz(14); document.dispatchEvent(new CustomEvent('dj-nope', { detail: b.id })); }
  const r = e.target.closest('input[type=range]');
  if (r) { r.classList.add('dragging'); buzz(5); }
});
const release = () => document.querySelectorAll('input.dragging').forEach(r => r.classList.remove('dragging'));
addEventListener('pointerup', release); addEventListener('pointercancel', release);
const detent = new WeakMap();
function led(r) {
  const v = (Number(r.value) - Number(r.min)) / (Number(r.max) - Number(r.min));
  r.style.setProperty('--v', v.toFixed(4));
  const step = r.id === 'crossfader' ? Math.round(v * 2) : Math.round(v * 10);   // centre / 10% marks
  if (detent.has(r) && detent.get(r) !== step && r.classList.contains('dragging')) buzz(4);
  detent.set(r, step);
}
const ranges = [...document.querySelectorAll('input[type=range]')];
ranges.forEach(r => { r.addEventListener('input', () => led(r)); led(r); });
// app.mjs writes tempo values every frame; keep the LED fill in sync without touching them.
(function tick() { ranges.forEach(r => { if (r.style.getPropertyValue('--last') !== r.value) { r.style.setProperty('--last', r.value); led(r); } }); requestAnimationFrame(tick); })();
