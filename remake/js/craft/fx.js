// 制作パートの演出部品（ヒットストップ・火の粉・衝撃の輪）。各ミニゲームはここを呼ぶだけにして、
// 見た目の強さ・省略の条件を1か所で決める。
// ・ヒットストップ: 判定の瞬間、動いている絵（カーソル・炭の焼け色など）を短く止めて見せ、寄りと光で手応えを出す。
//   止めるのは見た目だけ。ゲーム内時間・判定・入力は一切止めない（リズムと公平さ、時刻を固定する自動テストを守る）。
//   各ミニゲームの描画ループは fxHolding() が true の間だけ、動く絵の更新を飛ばす。
// ・自動操作（テスト）と会話の早送り中は何もしない。
// ・「揺れ・閃光を減らす」または端末の「動きを減らす」では寄り（ズーム）と輪を省き、
//   「動きを減らす」では火の粉も省く。時間を止めるだけの部分は動きが無いので残す。
import { el, rand } from "../core/util.js";

/** 判定ごとの強さ。ms＝止める長さ、zoom＝寄りの倍率、sparks＝火の粉の数 */
export const IMPACT = Object.freeze({
  big: { ms: 110, zoom: 1.045, sparks: 18, ring: true },
  perfect: { ms: 80, zoom: 1.03, sparks: 12, ring: true },
  good: { ms: 0, zoom: 0, sparks: 5, ring: false },
});

/** 演出の出し方。"off"＝出さない／"calm"＝止めと粒だけ（揺れ・閃光なし）／"still"＝止めだけ／"full" */
export function fxMode() {
  const g = globalThis, remake = g.window?.__remake;
  // 自動操作（main.js が公開する craftTest）と会話の早送り中は出さない。session.js に依存しない（循環と単体テストの差し替えを避ける）
  if (remake?.craftTest?.auto || remake?.vnTest?.turbo) return "off";
  // DOM の無い環境（純ロジックのテスト）では何も出さない
  if (typeof g.matchMedia !== "function" || typeof g.getComputedStyle !== "function") return "off";
  if (g.matchMedia("(prefers-reduced-motion: reduce)").matches) return "still";
  // 設定「揺れ・閃光を減らす」（config.reduceShake → body.reduce-shake。transition-kit の calmFlash と同じ条件）
  if (g.document?.body?.classList.contains("reduce-shake")) return "calm";
  return "full";
}

/** 既定の色（炭火の橙）と、明るい面でも輪郭が読める暗い縁 */
export const HOT = "#ff8a1f";
const EDGE = "rgba(70, 24, 0, .55)";

/** "#abc"・"#aabbcc"・"rgb(r,g,b)" を "#rrggbb" にそろえる（末尾に透明度の2桁を足せるように） */
export function hex6(color) {
  const c = String(color || "").trim();
  const rgb = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return "#" + rgb.slice(1, 4).map((v) => Math.max(0, Math.min(255, +v)).toString(16).padStart(2, "0")).join("");
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + [...c.slice(1)].map((h) => h + h).join("");
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#d9d2e6";
}

const benchOf = (node) => node?.closest?.(".bench") || null;

/** 見た目を止めている最中か（描画ループが動く絵の更新を飛ばすのに使う） */
export function fxHolding(node) {
  const until = Number(benchOf(node)?.dataset.hitStopUntil || 0);
  return until > performance.now();
}

/**
 * ヒットストップ。動く絵を ms だけ止めて見せ、対象を一瞬寄せる。
 * 続けて呼ばれたら止める区間の終わりだけ延ばす（短くはしない）。
 */
export function hitStop(node, ms = IMPACT.perfect.ms, { zoom = IMPACT.perfect.zoom } = {}) {
  const mode = fxMode();
  if (mode === "off" || !(ms > 0)) return;
  const bench = benchOf(node);
  if (bench) {
    const until = Number(bench.dataset.hitStopUntil || 0);
    bench.dataset.hitStopUntil = String(Math.max(until, performance.now() + ms));
  }
  if (mode !== "full" || !zoom || typeof node?.animate !== "function") return;
  node.animate([
    { transform: `scale(${zoom})`, filter: "brightness(1.18)" },
    { transform: `scale(${zoom})`, filter: "brightness(1.18)", offset: Math.min(0.6, ms / (ms + 160)) },
    { transform: "scale(1)", filter: "brightness(1)" },
  ], { duration: ms + 160, easing: "cubic-bezier(.2,.8,.3,1)" });
}

/** 演出用の重ね層（host の上に1枚だけ作る） */
function layerOf(host) {
  let layer = host.querySelector(":scope > .fx-layer");
  if (!layer) {
    layer = el("div.fx-layer", { "aria-hidden": "true", style: { position: "absolute", inset: "0", pointerEvents: "none", overflow: "visible", zIndex: "30" } });
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.append(layer);
  }
  return layer;
}

/** 火の粉。x・y は host 基準の％か px 文字列。color は芯の色 */
export function sparks(host, { x = "50%", y = "50%", n = 10, color = HOT, spread = 90 } = {}) {
  const mode = fxMode();
  if (mode === "off" || mode === "still" || !host || !(n > 0)) return;
  const layer = layerOf(host);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), d = rand(spread * 0.45, spread), size = rand(8, 14);
    // 明るい箔の上でも読めるよう、白い芯＋色＋暗い縁の三層にする
    const p = el("i", { style: {
      position: "absolute", left: x, top: y, width: `${size}px`, height: `${size}px`, borderRadius: "50%",
      background: `radial-gradient(circle, #fff 0 28%, ${color} 52%, ${EDGE} 74%, transparent 78%)`,
      boxShadow: `0 0 10px 2px ${color}`,
    } });
    layer.append(p);
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d;
    const anim = p.animate([
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 22}px)) scale(.3)`, opacity: 0 },
    ], { duration: rand(420, 720), easing: "cubic-bezier(.15,.7,.4,1)" });
    anim.finished.then(() => p.remove(), () => p.remove());
  }
}

/** 衝撃の輪（中心から広がって消える） */
export function shockRing(host, { x = "50%", y = "50%", color = HOT, size = 160 } = {}) {
  if (fxMode() !== "full" || !host) return;
  const ring = el("i", { style: {
    position: "absolute", left: x, top: y, width: `${size}px`, height: `${size}px`, borderRadius: "50%",
    border: `5px solid ${color}`, boxShadow: `0 0 0 2px ${EDGE}, inset 0 0 0 2px ${EDGE}, 0 0 22px 4px ${color}`,
  } });
  layerOf(host).append(ring);
  const anim = ring.animate([
    { transform: "translate(-50%,-50%) scale(.2)", opacity: .95 },
    { transform: "translate(-50%,-50%) scale(1.15)", opacity: 0 },
  ], { duration: 460, easing: "cubic-bezier(.1,.7,.3,1)" });
  anim.finished.then(() => ring.remove(), () => ring.remove());
}

/** 当たった点の閃光（白→色→透明の円がふくらんで消える） */
export function burstFlash(host, { x = "50%", y = "50%", color = HOT, size = 120 } = {}) {
  if (fxMode() !== "full" || !host) return;
  const f = el("i", { style: {
    position: "absolute", left: x, top: y, width: `${size}px`, height: `${size}px`, borderRadius: "50%",
    background: `radial-gradient(circle, #fff 0 18%, ${color} 40%, transparent 70%)`,
  } });
  layerOf(host).append(f);
  const anim = f.animate([
    { transform: "translate(-50%,-50%) scale(.3)", opacity: 1 },
    { transform: "translate(-50%,-50%) scale(1)", opacity: .85, offset: .35 },
    { transform: "translate(-50%,-50%) scale(1.25)", opacity: 0 },
  ], { duration: 340, easing: "ease-out" });
  anim.finished.then(() => f.remove(), () => f.remove());
}

/**
 * 判定の手応えをまとめて出す。kind は "big"（リング完成など）/"perfect"/"good"。
 * それ以外（ミス等）は何もしない。zoomNode は寄せる対象（省略時は host）。
 * at に要素を渡すと、その要素の中心（host 基準）から出す。
 */
export function impact(host, kind, { x = "50%", y = "50%", color, zoomNode = host, at = null } = {}) {
  const spec = IMPACT[kind === "just" ? "perfect" : kind];
  if (!spec || !host) return;
  if (at?.getBoundingClientRect && host.getBoundingClientRect) {
    const h = host.getBoundingClientRect(), r = at.getBoundingClientRect();
    if (h.width && h.height) { x = `${r.left + r.width / 2 - h.left}px`; y = `${r.top + r.height / 2 - h.top}px`; }
  }
  if (spec.ms) hitStop(zoomNode, spec.ms, { zoom: spec.zoom });
  if (spec.ring) {
    burstFlash(host, { x, y, color, size: kind === "big" ? 170 : 110 });
    shockRing(host, { x, y, color, size: kind === "big" ? 240 : 150 });
  }
  sparks(host, { x, y, n: spec.sparks, color, spread: kind === "big" ? 160 : 110 });
}

/**
 * 吐いた煙が画面を満たして晴れる（CFX03・吸い出しの山場）。一人称なので、画面の下中央（口元）から
 * 柔らかい煙の塊が広がって上へ抜ける。grand（最適温・会心）は晴れ際に煙の輪が昇る。
 * 自動操作・「動きを減らす」では出さずにすぐ返す。戻り値は煙が晴れるまで待つ Promise。
 */
export function exhale(host, { color = "#d9d2e6", grand = false } = {}) {
  color = hex6(color);
  const mode = fxMode();
  if (mode === "off" || mode === "still" || !host) return Promise.resolve(false);
  // 大きな煙の塊は画面の外から立ちのぼるので、専用の層で切り抜く（はみ出しでページがスクロールしないように）
  const layer = el("div.fx-exhale", { "aria-hidden": "true", style: { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden", zIndex: "30" } });
  host.append(layer);
  const puffs = [];
  const COUNT = 10, DURATION = 1600;
  // 画面ぜんたいに薄くかかる息のもや（下から満ちて引く）
  const veil = el("i", { style: { position: "absolute", inset: "0",
    background: `radial-gradient(150% 110% at 50% 105%, ${color}d0, ${color}66 50%, transparent 82%)` } });
  layer.append(veil);
  const veilAnim = veil.animate([{ opacity: 0 }, { opacity: .8, offset: .35 }, { opacity: .55, offset: .6 }, { opacity: 0 }],
    { duration: DURATION, easing: "ease-in-out", fill: "both" });
  puffs.push(veilAnim.finished.then(() => veil.remove(), () => veil.remove()));
  for (let i = 0; i < COUNT; i++) {
    const size = rand(520, 860), dx = (i - (COUNT - 1) / 2) * rand(90, 140), rise = rand(300, 520);
    const p = el("i", { style: {
      position: "absolute", left: "50%", top: "100%", width: `${size}px`, height: `${size * .78}px`, borderRadius: "50%",
      background: `radial-gradient(closest-side, #fffdf8f5, #fffdf8b0 22%, ${color}aa 50%, ${color}44 72%, transparent)`, filter: "blur(18px)",
    } });
    layer.append(p);
    const delay = i * 55;
    const anim = p.animate([
      { transform: "translate(-50%,-50%) scale(.25)", opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * .6}px), calc(-50% - ${rise * .55}px)) scale(1)`, opacity: .95, offset: .4 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${rise}px)) scale(1.45)`, opacity: 0 },
    ], { duration: DURATION - delay, delay, easing: "cubic-bezier(.2,.65,.35,1)", fill: "both" });
    puffs.push(anim.finished.then(() => p.remove(), () => p.remove()));
  }
  if (grand) {
    const ring = el("i", { style: {
      position: "absolute", left: "50%", top: "62%", width: "120px", height: "120px", borderRadius: "50%",
      border: "14px solid #f4eff9", filter: "blur(3px)", boxShadow: `0 0 18px ${color}`,
    } });
    layer.append(ring);
    const anim = ring.animate([
      { transform: "translate(-50%,-50%) scale(.4)", opacity: 0 },
      { transform: "translate(-50%,-50%) scale(.9)", opacity: .9, offset: .3 },
      { transform: "translate(-50%, calc(-50% - 260px)) scale(1.9)", opacity: 0 },
    ], { duration: 1300, delay: 700, easing: "ease-out", fill: "both" });
    puffs.push(anim.finished.then(() => ring.remove(), () => ring.remove()));
  }
  // 万一アニメが終わらない環境でも先へ進める
  return Promise.race([Promise.all(puffs), new Promise((r) => setTimeout(r, DURATION + 1200))])
    .then(() => { layer.remove(); return true; });
}
