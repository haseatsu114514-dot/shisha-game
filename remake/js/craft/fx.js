// 制作パートの演出部品（ヒットストップ・火の粉・衝撃の輪）。各ミニゲームはここを呼ぶだけにして、
// 見た目の強さ・省略の条件を1か所で決める。
// ・ヒットストップ: 判定の瞬間、動いている絵（カーソル・炭の焼け色など）を短く止めて見せ、寄りと光で手応えを出す。
//   止めるのは見た目だけ。ゲーム内時間・判定・入力は一切止めない（リズムと公平さ、時刻を固定する自動テストを守る）。
//   各ミニゲームの描画ループは fxHolding() が true の間だけ、動く絵の更新を飛ばす。
// ・自動操作（テスト）と会話の早送り中は何もしない。
// ・「揺れ・閃光を減らす」または端末の「動きを減らす」では寄り（ズーム）と輪を省き、
//   「動きを減らす」では火の粉も省く。時間を止めるだけの部分は動きが無いので残す。
import { el, rand } from "../core/util.js";
import { smokeLayer, smokeAllowed, smokeTint, firstPersonBreath, ringBreath } from "../core/smoke.js";

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
  // 独立した scale で寄せる。transform を置き換えると舞台側で指定した拡大率が消える。
  node.animate([
    { scale: String(zoom), filter: "brightness(1.18)" },
    { scale: String(zoom), filter: "brightness(1.18)", offset: Math.min(0.6, ms / (ms + 160)) },
    { scale: "1", filter: "brightness(1)" },
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
 * もこもこの煙（core/smoke.js）が満ちて上へ抜ける。色は配合の色をうっすら。
 * 煙の姿が出来を語る（KMR11）: quality "good"＝適温 ／ "thin"＝ぬるい（薄く小さい）／ "harsh"＝熱すぎ（ちぎれてすぐ消える）。
 * grand（最適温・会心）は大きくまとまって長く残り、晴れ際に煙の輪が昇る。
 * 自動操作・「動きを減らす」では出さずにすぐ返す。戻り値は煙が晴れるまで待つ Promise。
 */
export function exhale(host, { color = "#d9d2e6", grand = false, quality = "good" } = {}) {
  const mode = fxMode();
  if (mode === "off" || mode === "still" || !host || !smokeAllowed()) return Promise.resolve(false);
  // 煙は画面の外から立ちのぼるので、専用の層で切り抜く（下の結果の札は、この層の下で先に出ている）
  const layer = el("div.fx-exhale", { "aria-hidden": "true", dataset: { quality: grand ? "best" : quality, ...(grand ? { ring: "1" } : {}) },
    style: { position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden", zIndex: "30" } });
  host.append(layer);
  const colors = [smokeTint(hex6(color), .3)];
  const breaths = firstPersonBreath(grand ? "best" : quality, colors);
  // 輪は、煙が晴れてきたころに昇らせる（煙のかたまりの中だと埋もれて見えない）。煙より白く、はっきり見せる
  if (grand) breaths.push(...ringBreath({ x: .5, y: .66, radius: .11, size: .03, colors: [smokeTint(hex6(color), .08)], delay: 2.9, rise: .16, grow: .06, life: 2.3 }));
  // 万一アニメが終わらない環境でも先へ進める（いちばん長い「最適温＋輪」で6秒ほど）
  return Promise.race([smokeLayer(layer, { zIndex: 0 }).breathe(breaths), new Promise((r) => setTimeout(r, 9000))])
    .then(() => { layer.remove(); return true; });
}

/**
 * 煙の輪（スモークリング K21・龍の煙 M-S7）を、anchor（輪を出す位置に置いた要素）の中心から昇らせる。
 * 描けたら true。描けないとき（自動操作・「動きを減らす」）は false を返すので、呼び出し側は従来の輪を見せる。
 */
export function smokeRing(anchor, { color = "#e4dff0", big = false } = {}) {
  const host = anchor?.closest?.(".bench"), mode = fxMode();
  if (!host || mode === "off" || mode === "still" || !smokeAllowed()) return false;
  const a = anchor.getBoundingClientRect(), b = host.getBoundingClientRect();
  if (!b.width || !b.height) return false;
  const x = (a.left + a.width / 2 - b.left) / b.width, y = (a.top + a.height / 2 - b.top) / b.height;
  const colors = [smokeTint(hex6(color), big ? .5 : .2)];
  smokeLayer(host, { zIndex: 29 }).breathe(ringBreath(big ? { x, y, radius: .09, size: .028, rise: .15, grow: .06, life: 2.2, colors } : { x, y, radius: .045, size: .017, rise: .14, grow: .04, life: 1.4, colors }));
  return true;
}
