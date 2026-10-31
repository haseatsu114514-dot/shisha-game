// Tactile feedback for the DJ controller. Visual/haptic only: never calls audio, model or scoring.
const STAGE_W = 1280, STAGE_H = 720;
const stage = document.getElementById('dj-stage');
function fit() { stage.style.setProperty('--s', String(Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H))); }
fit(); addEventListener('resize', fit);
const coarse = matchMedia('(pointer: coarse)');
const buzz = ms => { if (coarse.matches && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* unsupported */ } };
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (b && !b.disabled) { b.classList.add('hit'); buzz(8); setTimeout(() => b.classList.remove('hit'), 140); }
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
