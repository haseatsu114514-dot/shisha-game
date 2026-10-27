import { DJAudio } from './audio.mjs';
import { beatAt, updateMix, phaseError, mod, dancerPose } from './model.mjs';
import { peakAt } from './synth.mjs';
const $ = id => document.getElementById(id), audio = new DJAudio();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let message = '', disposed = false, frame = 0, inMix = false, frameView = { mode: 'idle' };
// Read-only acceptance snapshot. No clock override, source replacement or saved game access.
export function snapshot() {
  return { clock: audio.now, state: audio.context?.state || 'not-started', running: audio.mix.running,
    bpms: audio.mix.decks.map(d => d.bpm), beats: audio.mix.decks.map(d => beatAt(d,audio.now)),
    phase: phaseError(...audio.mix.decks,audio.now), mix: audio.mix.mix, master: audio.mix.master,
    visualMaster: audio.mix.visualMaster, mode: frameView.mode, last: audio.mix.last ? { ...audio.mix.last } : null,
    voices: audio.voices.filter(Boolean).length, retiring: audio.retiring.size,
    rms: audio.level(), reduced: reduced.matches };
}
const status = text => { $('status').textContent = text; };
audio.onInterrupted = () => { $('start').textContent = '音を再開'; $('pause').disabled = true; status('音声が中断されました。開始ボタンから再開してください。'); };
async function pause() {
  try { await audio.pause(); status('停止中。再開ボタンで同じ位置から続けられます。'); }
  catch (error) { status(`停止処理: ${error.message}。音声nodeは切断済みです。`); }
  $('start').textContent = '音を再開'; $('pause').disabled = true;
}
$('start').addEventListener('click', async () => {
  $('start').disabled = true;
  try { if (await audio.start()) {
    if (document.hidden) { await pause(); return; }
    $('start').textContent = '再生中'; $('pause').disabled = false;
    status('合成試験音を再生中。赤黒ドットは仮デザインです。本編セーブは使用しません。');
  } } catch (error) { status(`${error.message}。開始ボタンから再試行できます。`); }
  finally { $('start').disabled = false; }
});
$('pause').addEventListener('click', pause);
$('mute').addEventListener('click', () => {
  audio.muted = !audio.muted; audio.setVolume(audio.volume);
  $('mute').textContent = `ミュート ${audio.muted ? 'ON' : 'OFF'}`; $('mute').setAttribute('aria-pressed', String(audio.muted));
});
$('volume').addEventListener('input', e => audio.setVolume(e.target.value));
$('crossfader').addEventListener('input', e => audio.setMix(e.target.value));
$('assist').addEventListener('change', e => { audio.mix.assist = e.target.checked; status('補助設定は次回の予約から適用します。手動テンポ変更はそのまま音へ反映します。'); });
for (const id of [0, 1]) $('tempo-' + (id ? 'b' : 'a')).addEventListener('input', e => audio.tempo(id, Number(e.target.value)));
document.querySelectorAll('[data-nudge]').forEach(button => button.addEventListener('click', () => {
  const [id, beats] = button.dataset.nudge.split(',').map(Number); audio.nudge(id, beats);
}));
document.querySelectorAll('[data-sync]').forEach(button => button.addEventListener('click', () => audio.sync(Number(button.dataset.sync))));
$('offset').addEventListener('click', () => { audio.nudge(1, .5); status('Bを実際に半拍進めました。上下の波形と拍線を比べて補正できます。'); });
function tap() {
  if (!audio.mix.running || inMix) return;
  const b = beatAt(audio.mix.decks[audio.mix.visualMaster], audio.now);
  $('tap-result').textContent = Math.min(mod(b, 1), 1 - mod(b, 1)) < .16 ? '拍に近い！' : '次の拍を聴いてみよう';
}
$('tap').addEventListener('click', tap);
document.addEventListener('keydown', e => { if (e.code === 'KeyJ' && !e.repeat && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) tap(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', event => {
  if (event.persisted) { pause(); return; } // 戻る/進むキャッシュでは無音・手動再開を維持。
  disposed = true; cancelAnimationFrame(frame); audio.dispose().catch(() => {});
});

function wave(canvas, id, now) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, x0 = Math.round(w * .32), scale = w / 7;
  c.clearRect(0, 0, w, h); if (!audio.tracks) return;
  const d = audio.mix.decks[id], b = beatAt(d, now), t = audio.tracks[id];
  c.fillStyle = id ? '#edb775' : '#ed7e88';
  for (let x = 0; x < w; x += 2) {
    const beat = b + ((x - x0) / scale) * d.bpm / 60;
    const peak = peakAt(t, mod(beat, 32) * 60 / t.nativeBpm);
    const size = peak * (h - 8); c.globalAlpha = .75; c.fillRect(x, h / 2 - size / 2, 2, Math.max(1, size));
  }
  c.globalAlpha = 1;
  const first = Math.floor(b - x0 / scale * d.bpm / 60);
  for (let n = first; n < b + (w - x0) / scale * d.bpm / 60; n++) {
    const x = x0 + (n - b) * 60 / d.bpm * scale;
    c.fillStyle = mod(n, 4) === 0 ? '#e7d8dd' : '#60545e'; c.fillRect(x, 0, 1, h);
    if (mod(n, 4) === 0) { c.font = '10px monospace'; c.fillText(`${Math.floor(mod(n, 32) / 4) + 1}`, x + 3, 11); }
  }
  c.fillStyle = '#fff'; c.fillRect(x0, 0, 2, h);
}
function drawVJ(beat, energy) {
  const canvas = $('vj'), c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  c.fillStyle = '#170d13'; c.fillRect(0, 0, 640, 144);
  const pulse = reduced.matches ? .06 : .07 + Math.min(.09, energy * .4);
  c.fillStyle = `rgba(190,42,69,${pulse})`;
  for (let i = 0; i < 8; i++) { const x = 25 + i * 88; c.fillRect(x, 55, 32, 74); }
  const pose = dancerPose(beat, reduced.matches), u = 3, cx = 320 + Math.round(pose.hip) * u, cy = 54 + Math.round(pose.bob) * u;
  const block = (x,y,w,h,color) => { c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h); };
  const limb = (x,y,xx,yy,color,width=6) => { const steps=Math.max(Math.abs(xx-x),Math.abs(yy-y))/3;for(let i=0;i<=steps;i++)block(x+(xx-x)*i/steps,y+(yy-y)*i/steps,width,width,color); };
  block(cx-9,cy-21,18,18,'#efb8a0'); block(cx-12,cy-24,24,9,'#211926'); // face/hair
  block(cx-12,cy,24,27,'#cd435c'); block(cx-3,cy+3,6,21,'#f68687'); // jacket
  limb(cx-12,cy+3,cx-27,cy+18+Math.round(pose.arm)*u,'#dc6975');
  limb(cx+9,cy+3,cx+24,cy+18-Math.round(pose.arm)*u,'#dc6975');
  const leftX=299-Math.round(pose.left)*u,rightX=329+Math.round(pose.right)*u;
  const leftY=126-Math.round(pose.left)*u,rightY=126-Math.round(pose.right)*u;
  limb(cx-9,cy+27,leftX+6,leftY-3,'#413449');
  limb(cx+6,cy+27,rightX+3,rightY-3,'#413449');
  block(leftX,leftY,15,6,'#e4c9ca');block(rightX,rightY,15,6,'#e4c9ca');
  c.fillStyle='#b96a7d';c.fillRect(0,132,640,1);
  // 控えめな自動カットイン。VJ専用領域内で、波形や操作へ重ねない。
  if (inMix) {
    c.fillStyle='#672637';c.fillRect(420,103,195,22);c.fillStyle='#f2c5cb';c.font='11px monospace';
    c.fillText(`8 BAR TRANSFER ${audio.mix.transition?.from ? 'B > A' : 'A > B'}`,430,118);
  }
}
function render() {
  if (disposed) return;
  const now = audio.now, oldTransition = audio.mix.transition;
  const view = updateMix(audio.mix, now);
  frameView = view;
  if (oldTransition !== audio.mix.transition && audio.mix.transition) audio.reconcile(audio.mix.transition.to);
  inMix = view.mode === 'mix'; $('tap').disabled = inMix || !audio.mix.running;
  for (const id of [0,1]) {
    const key = id ? 'b' : 'a', deck = audio.mix.decks[id], beat = mod(beatAt(deck,now),32);
    $('bpm-'+key).value = deck.bpm.toFixed(1); $('tempo-'+key).value = String(deck.bpm);
    $('beat-'+key).textContent = `${Math.floor(beat/4)+1}小節・${Math.floor(beat%4)+1}拍`;
    wave($('wave-'+key),id,now);
  }
  $('mix-value').textContent = `A ${Math.round((1-audio.mix.mix)*100)}% / B ${Math.round(audio.mix.mix*100)}%（位置）`;
  $('phase').textContent = `共通7秒スケール / B−A 拍位相 ${phaseError(...audio.mix.decks,now).toFixed(3)}拍 / テンポ差 ${(audio.mix.decks[1].bpm-audio.mix.decks[0].bpm).toFixed(1)} BPM`;
  $('master').textContent = `音・VJ基準 ${audio.mix.visualMaster ? 'B' : 'A'}`;
  $('phrase').value = view.mode === 'mix' ? view.progress : 0;
  const next = audio.mix.transition;
  const text = !audio.mix.running ? '停止中。開始/再開は本人操作のみ。' : view.mode === 'mix'
    ? `8小節で交代中 ${Math.floor(view.progress*8)+1}/8：${next?.to ? '右B' : '左A'}へゆっくり移動。拍押しは休止。`
    : view.mode === 'finished' ? `${view.reached ? '交代完了' : 'ミックスを維持しました'}。次の区間を自動予約。罰・採点なし。`
    : `${audio.mix.last ? (audio.mix.last.reached ? '前回の交代完了。' : '前回のミックスを維持。') : ''}次の8小節境界まで ${Math.ceil(view.remaining || 0)}拍。通常区間は聴いて待てばOK。`;
  if (message !== text) { $('coaching').textContent=text;message=text; }
  drawVJ(beatAt(audio.mix.decks[audio.mix.visualMaster],now),audio.level());
  frame=requestAnimationFrame(render);
}
render();
