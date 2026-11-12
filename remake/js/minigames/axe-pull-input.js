// Input only: callers own scoring, stance time and equipment assistance.
export function attachAxePullInput({ root, board, handle, signal, canAim, canPull, onAim, onPower, onRelease, onCancel, target = { x: 330, y: 245, radius: 164 } }) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const lifetime = new AbortController(), options = { signal: lifetime.signal };
  const listen = (node, type, fn, extra = {}) => node.addEventListener(type, fn, { ...options, ...extra });
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  let aim = { x: 0, y: 0 }, pull = null, power = 0, dead = false;
  const pointers = new Set();
  const focused = () => { if (!dead && !doc.hidden && (canAim() || canPull())) board.focus({ preventScroll: true }); };
  function cancel() {
    const previous = pull;
    pull = null; power = 0;
    if (!previous) return false;
    if (previous.id !== 'keyboard' && handle.hasPointerCapture(previous.id)) handle.releasePointerCapture(previous.id);
    onPower(0); onCancel();
    return true;
  }
  function available() { return !dead && !doc.hidden && canPull(); }
  function geometry() {
    const rect = root.getBoundingClientRect();
    return [win.innerWidth, win.innerHeight, rect.x, rect.y, rect.width, rect.height];
  }
  function unchangedGeometry() {
    const now = geometry();
    return pull && now.every((value, index) => value === pull.geometry[index]);
  }
  function begin(id, point) {
    if (pull || !available()) return false;
    pull = { id, start: point, elapsed: 0, geometry: geometry(), distance: clamp(root.getBoundingClientRect().height * .26, 80, 180) };
    power = 0; onPower(0); return true;
  }
  function move(e) {
    if (!pull || pull.id !== e.pointerId) return false;
    if (!available() || !unchangedGeometry() || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY) || e.clientX < 0 || e.clientY < 0 || e.clientX > win.innerWidth || e.clientY > win.innerHeight || Math.abs(e.clientX - pull.start.x) > pull.distance * 1.2) { cancel(); return false; }
    power = clamp((e.clientY - pull.start.y) / pull.distance, 0, 1);
    onPower(power); return true;
  }
  function release() {
    if (!pull) return;
    if (!available() || !unchangedGeometry() || power < .06) { cancel(); return; }
    const previous = pull; pull = null;
    if (previous.id !== 'keyboard' && handle.hasPointerCapture(previous.id)) handle.releasePointerCapture(previous.id);
    // Re-check after callbacks/capture changes before committing a throw.
    if (!available()) { power = 0; onPower(0); onCancel(); return; }
    onRelease(); focused();
  }
  function aimAt(next) {
    if (dead || pull || !canAim()) return;
    aim = { x: clamp(next.x, -1.2, 1.2), y: clamp(next.y, -1.2, 1.2) };
    onAim({ ...aim }); focused();
  }
  listen(board, 'pointerdown', e => {
    if (e.button !== 0 || !e.isPrimary || pointers.size > 1 || dead || !canAim()) return;
    const ctm = board.getScreenCTM();
    if (!ctm) return;
    let p;
    try { p = new win.DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()); } catch { return; }
    const next = { x: (p.x - target.x) / target.radius, y: (p.y - target.y) / target.radius };
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || Math.abs(next.x) > 1.2 || Math.abs(next.y) > 1.2) return;
    e.preventDefault(); aimAt(next);
  });
  listen(win, 'pointerdown', e => { pointers.add(e.pointerId); if (pointers.size > 1) cancel(); }, { capture: true });
  listen(win, 'pointerup', e => pointers.delete(e.pointerId), { capture: true });
  listen(win, 'pointercancel', e => { pointers.delete(e.pointerId); cancel(); }, { capture: true });
  listen(handle, 'pointerdown', e => {
    // Never allow a native button click/Space activation to become a second throw.
    e.preventDefault(); e.stopPropagation();
    if (e.button !== 0 || !e.isPrimary || pointers.size > 1 || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    if (begin(e.pointerId, { x: e.clientX, y: e.clientY })) handle.setPointerCapture(e.pointerId);
  });
  listen(handle, 'pointermove', move);
  listen(handle, 'pointerup', e => { if (pull?.id !== e.pointerId) return; e.preventDefault(); e.stopPropagation(); pointers.delete(e.pointerId); if (move(e)) release(); });
  listen(handle, 'lostpointercapture', e => { if (pull?.id === e.pointerId) cancel(); });
  listen(handle, 'click', e => { e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true });
  function editing(e) { return e.target !== handle && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target?.tagName) || e.target?.isContentEditable); }
  listen(root, 'keydown', e => {
    if (e.code === 'Tab') { cancel(); return; }
    if (e.code === 'Escape') { if (cancel()) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (dead || editing(e)) return;
    if (e.code === 'Space') {
      if (!pull && !available()) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat && !pull) begin('keyboard', null);
      return;
    }
    const d = { ArrowLeft: [-.025, 0], ArrowRight: [.025, 0], ArrowUp: [0, -.025], ArrowDown: [0, .025] }[e.code];
    if (d && canAim()) { e.preventDefault(); e.stopImmediatePropagation(); aimAt({ x: aim.x + d[0], y: aim.y + d[1] }); }
  }, { capture: true });
  listen(root, 'keyup', e => {
    if (e.code !== 'Space' || pull?.id !== 'keyboard') return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (pull?.id === 'keyboard') release();
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
      if (pull) return false;
      aim = { x: clamp(next.x, -1.2, 1.2), y: clamp(next.y, -1.2, 1.2) };
      return true;
    },
    tick(delta) {
      if (!Number.isFinite(delta) || delta < 0) throw new RangeError('Invalid active input time');
      if (!pull) return;
      if (!available() || !unchangedGeometry()) { cancel(); return; }
      if (pull.id === 'keyboard') { pull.elapsed += delta; power = clamp(pull.elapsed / 1200, 0, 1); onPower(power); }
    },
    get pulling() { return pull !== null; },
    get rawPower() { return power; },
  };
}
