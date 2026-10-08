// 配置・動きの比較専用。本編からは読み込まない。
(() => {
  const base = new URL('.', document.currentScript.src);
  const css = document.createElement('link'); css.rel = 'stylesheet';
  css.href = new URL('placement.css', base); document.head.append(css);
  const assets = { pair: new URL('comic-pair.png', base).href, face: new URL('comic-face.png', base).href };
  const ready = Promise.all([new Promise((ok, fail) => { css.onload = ok; css.onerror = fail; }),
    ...Object.values(assets).map(src => { const i = new Image(); i.src = src; return i.decode(); })]);
  const variants = {
    pair: { name: 'A：左枠の下に2コマ', duration: 740 },
    peek: { name: 'B：左端から顔だけ', duration: 620 },
    window: { name: 'C：左枠を漫画に切替', duration: 960 },
    full: { name: 'D：全画面＋時間停止', duration: 1100 },
  };
  function create(host, { scene = host.closest('.bench') || host, onPause, onResume } = {}) {
    let root = null, timer = 0, observer = null, animations = [], guard = null;
    const view = host.ownerDocument.defaultView;
    const blocked = () => !!scene.querySelector('.bench-guide[open], .bench-condition[open]');
    function hide() {
      view.clearTimeout(timer); observer?.disconnect(); observer = null;
      if (!root) return;
      const wasFull = root.dataset.variant === 'full';
      root.remove(); root = null;
      guard?.abort(); guard = null;
      for (const [animation, wasRunning] of animations) if (wasRunning && animation.playState === 'paused') animation.play();
      animations = [];
      if (wasFull) onResume?.();
    }
    function show(variant, { hold = false } = {}) {
      if (!variants[variant] || !host.isConnected || !scene.isConnected || blocked()) return false;
      hide();
      const full = variant === 'full';
      root = document.createElement('div'); root.className = 'craft-cutin-preview';
      root.dataset.variant = variant; root.setAttribute('aria-hidden', 'true');
      const visual = document.createElement('div'); visual.className = 'cc-visual';
      const art = document.createElement('img'); art.className = 'cc-art'; art.alt = ''; art.draggable = false;
      art.src = variant === 'peek' ? assets.face : assets.pair;
      const label = document.createElement('span'); label.className = 'cc-label'; label.textContent = 'EXCELLENT';
      visual.append(art, label); root.append(visual);
      if (full) {
        onPause?.();
        animations = scene.getAnimations({ subtree: true }).map(a => [a, a.playState === 'running']);
        for (const [animation, wasRunning] of animations) if (wasRunning) animation.pause();
        // 既に押していたキーやパッドは、離す操作だけ届く。新しい操作を演出中に受け付けない。
        guard = new view.AbortController();
        for (const type of ['keydown', 'pointerdown', 'pointermove']) view.addEventListener(type, e => {
          e.preventDefault(); e.stopImmediatePropagation();
        }, { capture: true, signal: guard.signal, passive: false });
      }
      (full ? scene : host).append(root);
      observer = new view.MutationObserver(() => { if (blocked() || !host.isConnected || !scene.isConnected) hide(); });
      observer.observe(scene, { subtree: true, attributes: true, attributeFilter: ['open'] });
      if (!hold) {
        const reduced = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
        visual.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }, { opacity: 1 }, { opacity: 0 }] : [
          { opacity: 0, translate: full ? '-30px 0' : '-14px 0', scale: full ? '1.12' : '.97' },
          { opacity: 1, translate: '0 0', scale: '1', offset: .15 },
          { opacity: 1, translate: '0 0', scale: '1', offset: .82 },
          { opacity: 0, translate: '5px 0', scale: '1' },
        ], { duration: variants[variant].duration, easing: 'ease-out', fill: 'both' });
        timer = view.setTimeout(hide, variants[variant].duration);
      }
      return true;
    }
    return { show, hide, destroy: hide, get active() { return root?.dataset.variant || null; } };
  }
  // performance.now()とRAFに同じゲーム時刻を渡す。演出時間を再開時に加算しない。
  // 比較用iframe／検証ページにだけ入れる。セーブ・採点・本編ソースは変更しない。
  function installClock(view) {
    const raw = view.performance.now.bind(view.performance);
    const nativeRaf = view.requestAnimationFrame.bind(view);
    let offset = 0, frozen = null, pauseStarted = 0;
    const now = () => frozen === null ? raw() - offset : frozen;
    Object.defineProperty(view.performance, 'now', { configurable: true, value: now });
    view.requestAnimationFrame = callback => nativeRaf(() => callback(now()));
    return {
      now, raw,
      pause() { if (frozen !== null) return; pauseStarted = raw(); frozen = pauseStarted - offset; },
      resume() { if (frozen === null) return; offset += raw() - pauseStarted; frozen = null; },
      get paused() { return frozen !== null; },
      get excludedMs() { return offset + (frozen === null ? 0 : raw() - pauseStarted); },
    };
  }
  window.CraftCutinPreview = { ready, create, installClock, variants };
})();
