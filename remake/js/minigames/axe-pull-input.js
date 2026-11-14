// Input only: callers own scoring, stance time and equipment assistance.
// 投げ方（2026-11-12 オーナー「フリップで弾いて前に弾く」「タッチで狙う場所固定してそこからフリップ」）:
// - 的に触れると、そこが狙い。指を離さずにそのまま上（前）へ素早く弾いて離すと投げる。触れて離すだけなら狙いを決めるだけ。
// - 右の取っ手（handle）からも弾ける（狙いを動かさずに投げたい時）。
// - 強さは離す直前の上向きの速さ、左右のぶれは弾いた向きの傾き（axe-pull-model.js の flickPower）。時刻は event.timeStamp。
// - キーボード: 矢印で狙い、Space を押している長さで強さ、離すと投げる（今までどおり）。
import { flickPower, flickRead } from './axe-pull-model.js';

// prepare: 的に触れた時、狙う前に呼ぶ（結果の表示中に的へ触れたら、次の投へ進めてそのまま狙う。2026-11-13 指摘8）。
// aimOnTouch: false なら、的に触れても狙いは動かさず、投げられる時（canPull）だけそこから弾ける（狙いはゲージで決める。2026-11-13）。
export function attachAxePullInput({ root, board, handle, signal, canAim, canPull, onAim, onPower, onRelease, onCancel, prepare = () => {}, aimOnTouch = true, target = { x: 330, y: 245, radius: 164 } }) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const lifetime = new AbortController(), options = { signal: lifetime.signal };
  const listen = (node, type, fn, extra = {}) => node.addEventListener(type, fn, { ...options, ...extra });
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  let aim = { x: 0, y: 0 }, flick = null, power = 0, dead = false;
  const pointers = new Set();
  const focused = () => { if (!dead && !doc.hidden && (canAim() || canPull())) board.focus({ preventScroll: true }); };
  function releaseCapture(previous) {
    if (!previous || previous.id === 'keyboard') return;
    for (const node of [handle, board]) if (node.hasPointerCapture?.(previous.id)) node.releasePointerCapture(previous.id);
  }
  /** 投げずに終える（触れて離しただけ＝狙いを決めただけ、も同じ。強さの表示を元に戻す）。
   *  reason は弾き損ねの理由（"shallow"・"lean"・"down"・"hold"）。理由なし（null）は黙って取り消す（2026-11-13 指摘3） */
  function cancel(reason = null) {
    const previous = flick;
    flick = null; power = 0;
    if (!previous) return false;
    releaseCapture(previous);
    onPower(0); onCancel(reason);
    return true;
  }
  function available() { return !dead && !doc.hidden && canPull(); }
  function geometry() {
    const rect = root.getBoundingClientRect();
    return [win.innerWidth, win.innerHeight, rect.x, rect.y, rect.width, rect.height];
  }
  function unchangedGeometry() {
    const now = geometry();
    return flick && now.every((value, index) => value === flick.geometry[index]);
  }
  const height = () => root.getBoundingClientRect().height;
  function begin(id, sample, fromBoard = false) {
    if (flick || !available()) return false;
    flick = { id, fromBoard, samples: sample ? [sample] : [], elapsed: 0, geometry: geometry() };
    power = 0; onPower(0); return true;
  }
  const sampleOf = e => ({ t: e.timeStamp, x: e.clientX, y: e.clientY });
  function track(e) {
    if (!flick || flick.id !== e.pointerId) return false;
    // 勢いよく弾くと指・マウスは画面の上へ抜けることがあるので、画面の外でも追う（捕まえた pointer の離す所まで）
    if (!available() || !unchangedGeometry() || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) { cancel(); return false; }
    flick.samples.push(sampleOf(e));
    // 弾いている間の目安: 今の速さでの強さを見せる（投げるのは離した時の速さ）
    const now = flickPower(flick.samples, height());
    power = now ? now.raw : 0; onPower(power); return true;
  }
  function finish(e) {
    if (!flick || flick.id !== e.pointerId) return;
    e.preventDefault(); e.stopPropagation(); pointers.delete(e.pointerId);
    if (!track(e)) return;
    const read = flickRead(flick.samples, height());
    if (!read.throw) { cancel(read.miss); return; }
    throwNow(read.throw.raw, read.throw.lean);
  }
  function throwNow(raw, lean = 0) {
    if (!flick) return;
    if (!available() || !unchangedGeometry()) { cancel(); return; }
    const previous = flick; flick = null; power = raw;
    releaseCapture(previous);
    onPower(raw);
    // Re-check after callbacks/capture changes before committing a throw.
    if (!available()) { power = 0; onPower(0); onCancel(); return; }
    onRelease(lean); focused();
  }
  function aimAt(next) {
    if (dead || flick || !canAim()) return false;
    aim = { x: clamp(next.x, -1.2, 1.2), y: clamp(next.y, -1.2, 1.2) };
    onAim({ ...aim }); focused(); return true;
  }
  listen(board, 'pointerdown', e => {
    if (e.button !== 0 || !e.isPrimary || pointers.size > 1 || dead) return;
    if (!aimOnTouch) {
      if (!available() || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      e.preventDefault();
      if (begin(e.pointerId, sampleOf(e), true)) board.setPointerCapture?.(e.pointerId);
      return;
    }
    if (!canAim()) prepare();
    if (!canAim()) return;
    const ctm = board.getScreenCTM();
    if (!ctm) return;
    let p;
    try { p = new win.DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()); } catch { return; }
    const next = { x: (p.x - target.x) / target.radius, y: (p.y - target.y) / target.radius };
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || Math.abs(next.x) > 1.2 || Math.abs(next.y) > 1.2) return;
    e.preventDefault();
    if (!aimAt(next)) return;
    // 触れた所から、そのまま弾ける
    if (begin(e.pointerId, sampleOf(e), true)) board.setPointerCapture?.(e.pointerId);
  });
  listen(board, 'pointermove', track);
  listen(board, 'pointerup', finish);
  listen(board, 'lostpointercapture', e => { if (flick?.id === e.pointerId) cancel(); });
  listen(win, 'pointerdown', e => { pointers.add(e.pointerId); if (pointers.size > 1) cancel(); }, { capture: true });
  listen(win, 'pointerup', e => pointers.delete(e.pointerId), { capture: true });
  listen(win, 'pointercancel', e => { pointers.delete(e.pointerId); cancel(); }, { capture: true });
  listen(handle, 'pointerdown', e => {
    // Never allow a native button click/Space activation to become a second throw.
    e.preventDefault(); e.stopPropagation();
    if (e.button !== 0 || !e.isPrimary || pointers.size > 1 || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    if (begin(e.pointerId, sampleOf(e))) handle.setPointerCapture(e.pointerId);
  });
  listen(handle, 'pointermove', track);
  listen(handle, 'pointerup', finish);
  listen(handle, 'lostpointercapture', e => { if (flick?.id === e.pointerId) cancel(); });
  listen(handle, 'click', e => { e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true });
  function editing(e) { return e.target !== handle && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target?.tagName) || e.target?.isContentEditable); }
  listen(root, 'keydown', e => {
    if (e.code === 'Tab') { cancel(); return; }
    if (e.code === 'Escape') { if (cancel()) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (dead || editing(e)) return;
    if (e.code === 'Space') {
      if (!flick && !available()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat && !flick) begin('keyboard', null);
      return;
    }
    const d = { ArrowLeft: [-.025, 0], ArrowRight: [.025, 0], ArrowUp: [0, -.025], ArrowDown: [0, .025] }[e.code];
    if (d && canAim()) { e.preventDefault(); e.stopImmediatePropagation(); aimAt({ x: aim.x + d[0], y: aim.y + d[1] }); }
  }, { capture: true });
  listen(root, 'keyup', e => {
    if (e.code !== 'Space' || flick?.id !== 'keyboard') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (power < .06) { cancel("hold"); return; }
    throwNow(power, 0);
  }, { capture: true });
  const suspend = () => { pointers.clear(); cancel(); };
  listen(win, 'blur', suspend); listen(win, 'resize', suspend); listen(doc, 'visibilitychange', suspend);
  function dispose() { if (dead) return; dead = true; suspend(); lifetime.abort(); signal?.removeEventListener('abort', dispose); }
  if (signal?.aborted) dispose(); else signal?.addEventListener('abort', dispose, { once: true });
  return {
    cancel,
    // Synchronize a runtime reset between turns; no callbacks or focus changes.
    setAim(next) {
      if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y)) throw new RangeError('Invalid input aim');
      if (flick) return false;
      aim = { x: clamp(next.x, -1.2, 1.2), y: clamp(next.y, -1.2, 1.2) };
      return true;
    },
    tick(delta) {
      if (!Number.isFinite(delta) || delta < 0) throw new RangeError('Invalid active input time');
      if (!flick) return;
      if (!available() || !unchangedGeometry()) { cancel(); return; }
      if (flick.id === 'keyboard') { flick.elapsed += delta; power = clamp(flick.elapsed / 1200, 0, 1); onPower(power); }
    },
    get pulling() { return flick !== null; },
    get rawPower() { return power; },
  };
}
