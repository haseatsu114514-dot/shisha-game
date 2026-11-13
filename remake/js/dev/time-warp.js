// デバッグ用の「何倍速」（2026-11-02 オーナー「デバッグ用に役立つ機能入れたい。何倍速とか。リリースするときは消す」）。
// ゲームが使う時計（setTimeout・setInterval・requestAnimationFrame・performance.now・Date.now）と、
// CSS・Web Animations の再生速度をまとめて rate 倍にする。音（BGM・効果音）の高さと長さは変えない。
// ?debug=1 の時だけ debug-panel.js から読み込まれる。リリース前に remake/js/dev/ ごと消す。

const real = {
  setTimeout: window.setTimeout.bind(window),
  setInterval: window.setInterval.bind(window),
  raf: window.requestAnimationFrame.bind(window),
  now: performance.now.bind(performance),
  dateNow: Date.now.bind(Date),
};
/** 速さの影響を受けない本物の時計（パネルの表示の更新などに使う）。 */
export const realTime = Object.freeze({ setTimeout: real.setTimeout, setInterval: real.setInterval, now: real.now });

export const SPEEDS = Object.freeze([1, 2, 4, 8]);
let rate = 1;
let realBase = real.now(), virtualBase = realBase;
const virtualNow = () => virtualBase + (real.now() - realBase) * rate;
const dateOffset = real.dateNow() - real.now();
let installed = false;

function applyAnimations(list = document.getAnimations()) {
  for (const animation of list) if (animation.playbackRate !== rate) animation.playbackRate = rate;
}

/** 時計を差し替える（一度だけ）。 */
export function installTimeWarp() {
  if (installed) return;
  installed = true;
  performance.now = virtualNow;
  Date.now = () => Math.round(virtualNow() + dateOffset);
  window.setTimeout = (fn, ms = 0, ...args) => real.setTimeout(fn, Math.max(0, Number(ms) || 0) / rate, ...args);
  window.setInterval = (fn, ms = 0, ...args) => real.setInterval(fn, Math.max(1, (Number(ms) || 0) / rate), ...args);
  window.requestAnimationFrame = callback => real.raf(() => callback(virtualNow()));
  // スクリプトで作るアニメーションにも、生成直後に同じ速さを当てる
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    const animation = animate.apply(this, args);
    if (rate !== 1) animation.playbackRate = rate;
    return animation;
  };
  // 新しく始まった CSS のアニメーション・トランジションにも、すぐ同じ速さを当てる
  const fresh = event => applyAnimations(event.target?.getAnimations?.() || []);
  for (const type of ["animationstart", "transitionrun"]) document.addEventListener(type, fresh, true);
  real.setInterval(() => { if (rate !== 1) applyAnimations(); }, 150);
}

export const getSpeed = () => rate;
/** 速さを変える。今の仮の時刻はそのまま続く（巻き戻らない）。 */
export function setSpeed(next) {
  const value = SPEEDS.includes(Number(next)) ? Number(next) : 1;
  virtualBase = virtualNow();
  realBase = real.now();
  rate = value;
  if (installed) applyAnimations();
  return rate;
}
