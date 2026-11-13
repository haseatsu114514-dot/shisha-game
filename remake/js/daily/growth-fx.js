// 心得の盤・レベルアップの演出の部品（2026-11-11 オーナー「見た目や演出など全面的にパワーアップさせて」SBD102〜104）。
// - 規則・保存・火種の数には触れない。画面の上に光を足すだけで、終わったら自分で消える。
// - 「動きを減らす」設定（prefers-reduced-motion）では何も出さず、待ち時間も作らない。
// - Web Animations API が無い環境（検査用の小さな DOM など）でも落ちない。
import { el } from "../core/util.js";

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const canAnimate = (node) => typeof node?.animate === "function";
const ART_DIR = "img/ui/growth_board/";
/** 火種の色（盤の色と同じ。CSS の --stat-* と合わせる） */
export const HIDANE_COLOR = { any: "#fff1d0", body: "#ef8a5e", sense: "#58a6ff", wisdom: "#7bd36d" };

/**
 * 火種の粒（盤の絵と同じ hidane_<色>.webp）。絵が読めない時は CSS の形（.hidane-icon.k-*）のまま。
 * 白火＝白金の丸い熾き、紅火＝炎、蒼火＝しずく、翠火＝角（SBD62）。
 */
export function hidaneIcon(kind = "any", extra = "") {
  const key = HIDANE_COLOR[kind] ? kind : "any";
  const icon = el(`i.hidane-icon.k-${key}${extra}`, { "aria-hidden": "true" });
  const img = el("img", { src: `${ART_DIR}hidane_${key}.webp`, alt: "", draggable: "false" });
  img.addEventListener("load", () => icon.classList.add("has-img"));
  img.addEventListener("error", () => img.remove());
  icon.append(img);
  return icon;
}

/** 動きを一つ流して、終わったら消す。animate が無ければその場で消す。 */
function play(node, frames, options) {
  if (!canAnimate(node)) { node.remove(); return Promise.resolve(); }
  return node.animate(frames, { fill: "both", ...options }).finished.catch(() => {}).finally(() => node.remove());
}

/** 火の粉が散る（layer の中の座標）。 */
export function sparkBurst(layer, x, y, { color = "#ffd38a", count = 10, spread = 46, size = 5, duration = 620 } = {}) {
  if (reducedMotion() || !layer?.isConnected) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.6, d = spread * (0.5 + Math.random() * 0.7);
    const spark = el("i.gfx-spark", { "aria-hidden": "true", style: { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, "--c": color } });
    layer.append(spark);
    play(spark, [
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${(Math.cos(a) * d).toFixed(1)}px), calc(-50% + ${(Math.sin(a) * d - 12).toFixed(1)}px)) scale(0.2)`, opacity: 0 },
    ], { duration: duration * (0.7 + Math.random() * 0.5), easing: "cubic-bezier(.2, .7, .3, 1)" });
  }
}

/** 光の輪が広がる（layer の中の座標）。 */
export function ringPulse(layer, x, y, { color = "#ffd38a", size = 90, duration = 520, delay = 0 } = {}) {
  if (reducedMotion() || !layer?.isConnected) return;
  const ring = el("i.gfx-ring", { "aria-hidden": "true", style: { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, "--c": color } });
  layer.append(ring);
  play(ring, [
    { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.95 },
    { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
  ], { duration, delay, easing: "cubic-bezier(.2, .7, .3, 1)" });
}

/** マスに火が入った時の光（輪＋火の粉）。 */
export function igniteAt(layer, x, y, { color, big = false } = {}) {
  ringPulse(layer, x, y, { color, size: big ? 150 : 96 });
  if (big) ringPulse(layer, x, y, { color: "#fff6dc", size: 220, duration: 700, delay: 90 });
  sparkBurst(layer, x, y, { color, count: big ? 16 : 9, spread: big ? 70 : 44 });
}

/**
 * 道の管を光が走る（SVG の中。from → to）。一度きりで、終わったら線ごと消す。
 * 灯した道そのもの（.gb-path.lit）は描き直しで出るので、ここは走る光だけ。
 */
export function runAlongPath(svgRoot, from, to, { color = "#fff6dc", duration = 300 } = {}) {
  if (reducedMotion() || !svgRoot?.isConnected || typeof document?.createElementNS !== "function") return;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  for (const [k, v] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, class: "gfx-run", stroke: color,
    "stroke-dasharray": `${(length * 0.45).toFixed(1)} ${(length * 2).toFixed(1)}` })) line.setAttribute(k, v);
  svgRoot.append(line);
  play(line, [{ strokeDashoffset: length * 0.45, opacity: 1 }, { strokeDashoffset: -length, opacity: 0.2 }], { duration, easing: "ease-out" });
}

/** 画面（host）の中での要素の真ん中。ゲーム全体の拡縮（transform）を割り戻す。 */
function centerIn(host, node) {
  const h = host.getBoundingClientRect(), r = node.getBoundingClientRect();
  const k = h.width && host.offsetWidth ? h.width / host.offsetWidth : 1;
  return { x: (r.left + r.width / 2 - h.left) / k, y: (r.top + r.height / 2 - h.top) / k, shown: r.width > 0 && r.height > 0 };
}

/**
 * 火種の粒が from（財布の粒）から to（マス）へ飛ぶ。届いたら resolve（動きを減らす設定・見えない時はすぐ）。
 * host は両方を含む画面（盤の全体）。
 */
export function flyHidane(host, from, to, { kind = "any", delay = 0, duration = 340 } = {}) {
  if (reducedMotion() || !host?.isConnected || !from?.isConnected || !to?.isConnected || typeof host.getBoundingClientRect !== "function") return Promise.resolve();
  const a = centerIn(host, from), b = centerIn(host, to);
  if (!a.shown || !b.shown) return Promise.resolve();
  const dot = hidaneIcon(kind, ".gfx-fly");
  host.append(dot);
  const lift = Math.min(70, Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
  return play(dot, [
    { transform: `translate(${a.x}px, ${a.y}px) translate(-50%, -50%) scale(1)`, opacity: 0.2 },
    { transform: `translate(${(a.x + b.x) / 2}px, ${Math.min(a.y, b.y) - lift}px) translate(-50%, -50%) scale(1.5)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${b.x}px, ${b.y}px) translate(-50%, -50%) scale(0.8)`, opacity: 1 },
  ], { duration, delay, easing: "cubic-bezier(.3, .1, .3, 1)" });
}

/** 要素の真ん中で火を弾けさせる（host の中の座標へ直す）。 */
export function igniteOn(host, node, options = {}) {
  if (reducedMotion() || !host?.isConnected || !node?.isConnected || typeof host.getBoundingClientRect !== "function") return;
  const c = centerIn(host, node);
  if (c.shown) igniteAt(host, c.x, c.y, options);
}

/** 数字が変わった時に一度だけ弾ませる。 */
export function bump(node) {
  if (reducedMotion() || !canAnimate(node)) return;
  node.animate([{ transform: "scale(1)" }, { transform: "scale(1.45)", offset: 0.35 }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
}

/**
 * 盤の決定のカットイン（スキル・✦・色の台座・極み・要のマス）。host の真ん中に出し、押すか時間で消える。
 * items: [{ tone, head, name, text, icon（画像のURL）, glyph }]。戻り値＝全部消えた時に resolve。
 */
export function commitCutIn(host, items, { hold = 1150 } = {}) {
  if (reducedMotion() || !host?.isConnected || !items?.length) return Promise.resolve();
  return new Promise((resolve) => {
    let index = 0, timer = null, card = null, done = false;
    const veil = el("div.gfx-cutin-veil", { role: "status", dataset: { test: "board-cutin" } });
    const finish = () => {
      if (done) return;
      done = true; clearTimeout(timer); veil.remove(); resolve();
    };
    const show = () => {
      card?.remove();
      const item = items[index];
      if (!item) { finish(); return; }
      const iconBox = el("span.gfx-cutin-icon", { "aria-hidden": "true" }, [el("b", { text: item.glyph || "" })]);
      if (item.icon) {
        const img = el("img", { src: item.icon, alt: "", draggable: "false" });
        img.addEventListener("load", () => iconBox.classList.add("has-img"));
        img.addEventListener("error", () => img.remove());
        iconBox.append(img);
      }
      card = el(`div.gfx-cutin.t-${item.tone || "skill"}${item.board ? `.b-${item.board}` : ""}`, [
        el("i.gfx-cutin-streak", { "aria-hidden": "true" }),
        iconBox,
        el("div.gfx-cutin-text", [
          el("small", { text: item.head }),
          el("strong", { text: item.name }),
          item.text ? el("span", { text: item.text }) : null,
        ]),
        items.length > 1 ? el("em.gfx-cutin-count", { text: `${index + 1}/${items.length}`, "aria-hidden": "true" }) : null,
      ]);
      veil.append(card);
      timer = setTimeout(() => { index++; show(); }, hold);
    };
    // 押したら次へ（最後なら閉じる）。盤の操作は決定の後なので塞いでよい
    veil.addEventListener("pointerdown", (e) => { e.preventDefault?.(); clearTimeout(timer); index++; show(); });
    host.append(veil);
    show();
  });
}

/** 盤の上をゆっくり昇る火の粉（飾り）。level 0〜3 で数が増える。CSS だけで動く。 */
export function emberField(count = 14) {
  return el("div.gfx-embers", { "aria-hidden": "true" }, Array.from({ length: count }, (_, i) => el("i", {
    style: { "--x": `${(7 + (i * 61) % 86)}%`, "--d": `${(5.5 + (i * 37) % 50 / 10).toFixed(1)}s`, "--w": `${(-(i * 23) % 60 / 10).toFixed(1)}s`, "--s": `${3 + (i * 7) % 4}px`, "--sway": `${-18 + (i * 29) % 36}px` },
  })));
}
