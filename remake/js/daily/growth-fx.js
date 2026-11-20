// 心得の盤・レベルアップの演出の部品（2026-11-11 オーナー「見た目や演出など全面的にパワーアップさせて」SBD102〜104）。
// - 規則・保存・火種の数には触れない。画面の上に光を足すだけで、終わったら自分で消える。
// - 「動きを減らす」設定（prefers-reduced-motion）では何も出さず、待ち時間も作らない。
// - Web Animations API が無い環境（検査用の小さな DOM など）でも落ちない。
import { el } from "../core/util.js";

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** 設定「揺れ・閃光を減らす」（config.reduceShake → body.reduce-shake）。火の粉と数字は残し、閃光・揺れ・止めだけ省く */
export const calmFx = () => typeof document !== "undefined" && !!document.body?.classList?.contains("reduce-shake");
const canAnimate = (node) => typeof node?.animate === "function";
/**
 * 手応えの調整値（SBD132。数字はここだけ。規則・保存には関わらない）。
 * 飛ぶ時間は「押してから火が入るまで」の待ちなので短く、火が入った瞬間だけ一拍ためる。
 */
export const FX = {
  flyMs: 300,        // 財布の火種がマスへ届くまで
  trail: 4,          // 飛ぶ火種の尾の数
  chainGapMs: 70,    // 「目標まで灯す」で次のマスへ移る間
  hitStopMs: 70,     // 大きいマスに火が入った瞬間の止め
  popMs: 1050,       // マスから昇る「＋8」の表示時間
  commitStepMs: [70, 130], // 決定で火が走る間（多い時ほど詰める）
  bannerMs: 1700,    // 決定のまとめの札が出ている時間（押すと先へ）
};
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

/** 閃光（塗りの丸が一瞬ふくらむ）。芯は白、外は色。「揺れ・閃光を減らす」では出さない。 */
export function flashAt(layer, x, y, { color = "#ffd38a", size = 80, duration = 260 } = {}) {
  if (reducedMotion() || calmFx() || !layer?.isConnected) return;
  const flash = el("i.gfx-flash", { "aria-hidden": "true", style: { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px`, "--c": color } });
  layer.append(flash);
  play(flash, [
    { transform: "translate(-50%, -50%) scale(0.3)", opacity: 1 },
    { transform: "translate(-50%, -50%) scale(1)", opacity: 0.85, offset: 0.3 },
    { transform: "translate(-50%, -50%) scale(1.25)", opacity: 0 },
  ], { duration, easing: "ease-out" });
}

/** 火が立つ（炎の舌が上へ伸びて消える）。火の粉より大きく、数は少なく。 */
export function flameBurst(layer, x, y, { color = "#ffd38a", count = 5, rise = 44, duration = 560 } = {}) {
  if (reducedMotion() || !layer?.isConnected) return;
  for (let i = 0; i < count; i++) {
    const dx = (i - (count - 1) / 2) * 9 + (Math.random() - 0.5) * 6, h = rise * (0.65 + Math.random() * 0.6), w = 9 + Math.random() * 6;
    const flame = el("i.gfx-flame", { "aria-hidden": "true", style: { left: `${x + dx}px`, top: `${y}px`, width: `${w}px`, height: `${w * 1.5}px`, "--c": color } });
    layer.append(flame);
    play(flame, [
      { transform: "translate(-50%, -60%) scale(0.5, 0.4)", opacity: 0.95 },
      { transform: `translate(calc(-50% + ${(dx * 0.25).toFixed(1)}px), calc(-60% - ${(h * 0.6).toFixed(1)}px)) scale(1, 1.25)`, opacity: 0.9, offset: 0.4 },
      { transform: `translate(calc(-50% + ${(dx * 0.5).toFixed(1)}px), calc(-60% - ${h.toFixed(1)}px)) scale(0.3, 0.6)`, opacity: 0 },
    ], { duration: duration * (0.75 + Math.random() * 0.5), delay: i * 18, easing: "cubic-bezier(.25, .6, .35, 1)" });
  }
}

/**
 * マスに火が入った時の光（SBD132）: 閃光 → 光の輪 → 火の粉 → 立つ炎 の順に重ねる。
 * big はスキル・授業・色の台座・✦・要のマス（輪を二重にして、炎と火の粉を増やす）。
 */
export function igniteAt(layer, x, y, { color, big = false } = {}) {
  flashAt(layer, x, y, { color, size: big ? 130 : 78 });
  ringPulse(layer, x, y, { color, size: big ? 160 : 104 });
  if (big) ringPulse(layer, x, y, { color: "#fff6dc", size: 240, duration: 720, delay: 90 });
  sparkBurst(layer, x, y, { color, count: big ? 18 : 10, spread: big ? 78 : 48 });
  flameBurst(layer, x, y, { color, count: big ? 7 : 4, rise: big ? 62 : 40 });
}

/** マスから昇る獲得の表示（「＋8」と能力の絵）。押せない飾りで、自分で消える。big は名前つき（スキルなど）。 */
export function popGain(layer, x, y, { text = "", icon = null, color = "#ffe9b8", big = false, delay = 0 } = {}) {
  if (reducedMotion() || !layer?.isConnected || !text) return;
  const pop = el(`span.gfx-pop${big ? ".big" : ""}`, { "aria-hidden": "true", style: { left: `${x}px`, top: `${y}px`, "--c": color } });
  if (icon) {
    const img = el("img", { src: icon, alt: "", draggable: "false" });
    img.addEventListener("error", () => img.remove());
    pop.append(img);
  }
  pop.append(el("b", { text }));
  layer.append(pop);
  play(pop, [
    { transform: "translate(-50%, -30%) scale(0.4)", opacity: 0 },
    { transform: "translate(-50%, -135%) scale(1.25)", opacity: 1, offset: 0.16 },
    { transform: "translate(-50%, -150%) scale(1)", opacity: 1, offset: 0.3 },
    { transform: "translate(-50%, -170%) scale(1)", opacity: 1, offset: 0.78 },
    { transform: "translate(-50%, -205%) scale(0.96)", opacity: 0 },
  ], { duration: FX.popMs * (big ? 1.25 : 1), delay, easing: "ease-out" });
}

/** 要素のそばに昇る短い札（財布の「−1」）。host の中の座標へ直す。 */
export function popOn(host, node, options = {}) {
  if (reducedMotion() || !host?.isConnected || !node?.isConnected || typeof host.getBoundingClientRect !== "function") return;
  const c = centerIn(host, node);
  if (c.shown) popGain(host, c.x, c.y + (options.dy || 0), options);
}

/** 盤を一度だけ小さく揺らす（大きいマス・決定の締め）。大→小に収束。「揺れ・閃光を減らす」では揺らさない。 */
export function kick(node, { power = 3, duration = 240 } = {}) {
  if (reducedMotion() || calmFx() || !canAnimate(node)) return;
  node.animate([
    { translate: "0 0" }, { translate: `0 ${power}px`, offset: 0.18 }, { translate: `0 ${-power * 0.6}px`, offset: 0.42 },
    { translate: `0 ${power * 0.3}px`, offset: 0.68 }, { translate: "0 0" },
  ], { duration, easing: "ease-out" });
}

/** 画面の縁から色の光が一度さす（決定の締め）。明るい所と暗い所の両方で見えるよう、縁だけを光らせる。 */
export function edgeFlash(host, { color = "#ffd38a", duration = 620 } = {}) {
  if (reducedMotion() || calmFx() || !host?.isConnected) return;
  const veil = el("i.gfx-edge", { "aria-hidden": "true", style: { "--c": color } });
  host.append(veil);
  play(veil, [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }], { duration, easing: "ease-out" });
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
export function flyHidane(host, from, to, { kind = "any", delay = 0, duration = FX.flyMs } = {}) {
  if (reducedMotion() || !host?.isConnected || !from?.isConnected || !to?.isConnected || typeof host.getBoundingClientRect !== "function") return Promise.resolve();
  const a = centerIn(host, from), b = centerIn(host, to);
  if (!a.shown || !b.shown) return Promise.resolve();
  const lift = Math.min(90, Math.hypot(b.x - a.x, b.y - a.y) * 0.28);
  const frames = (scale) => [
    { transform: `translate(${a.x}px, ${a.y}px) translate(-50%, -50%) scale(${scale})`, opacity: 0.2 },
    { transform: `translate(${(a.x + b.x) / 2}px, ${Math.min(a.y, b.y) - lift}px) translate(-50%, -50%) scale(${scale * 1.6})`, opacity: 1, offset: 0.45 },
    { transform: `translate(${b.x}px, ${b.y}px) translate(-50%, -50%) scale(${scale * 0.9})`, opacity: 1 },
  ];
  // 尾: 同じ道すじを少し遅れて追う光の粒（後ろほど小さく薄い）。頭は火種の絵
  for (let i = 1; i <= FX.trail; i++) {
    const tail = el("i.gfx-fly-tail", { "aria-hidden": "true", style: { "--c": HIDANE_COLOR[kind] || HIDANE_COLOR.any, opacity: String(0.7 - i * 0.13) } });
    host.append(tail);
    play(tail, frames(1 - i * 0.16), { duration, delay: delay + i * 26, easing: "cubic-bezier(.3, .1, .3, 1)" });
  }
  const dot = hidaneIcon(kind, ".gfx-fly");
  host.append(dot);
  return play(dot, frames(1), { duration, delay, easing: "cubic-bezier(.3, .1, .3, 1)" });
}

/** 要素の真ん中で火を弾けさせる（host の中の座標へ直す）。 */
export function igniteOn(host, node, options = {}) {
  if (reducedMotion() || !host?.isConnected || !node?.isConnected || typeof host.getBoundingClientRect !== "function") return;
  const c = centerIn(host, node);
  if (c.shown) igniteAt(host, c.x, c.y, options);
}

/** 並んだ部品が順に弾んで出る（盤を開いた時の財布の火種）。状態は変えず、終わったら元の姿のまま。 */
export function popIn(nodes, { gap = 70, duration = 480 } = {}) {
  if (reducedMotion()) return;
  [...(nodes || [])].forEach((node, i) => {
    if (!canAnimate(node)) return;
    node.animate([{ scale: "0.2", opacity: 0, translate: "0 10px" }, { scale: "1", opacity: 1, translate: "0 0" }],
      { duration, delay: i * gap, easing: "cubic-bezier(.2, 1.6, .4, 1)", fill: "backwards" });
  });
}

/** 数字が変わった時に一度だけ弾ませる。 */
export function bump(node) {
  if (reducedMotion() || !canAnimate(node)) return;
  node.animate([{ transform: "scale(1)" }, { transform: "scale(1.6)", offset: 0.3 }, { transform: "scale(0.94)", offset: 0.65 }, { transform: "scale(1)" }], { duration: 340, easing: "ease-out" });
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
      // 飾り（SBD142）: 後ろの光の筋・昇る火の粉・スキルの漫画のコマ。枠の内側で切り抜く箱に入れる（はみ出しの検査に掛からない）
      const deco = el("span.gfx-cutin-deco", { "aria-hidden": "true" }, [
        el("i.gfx-cutin-rays"),
        ...Array.from({ length: 9 }, (_, i) => el("i.gfx-cutin-ember", { style: { "--x": `${6 + (i * 37) % 90}%`, "--d": `${(1.3 + (i * 7) % 9 / 10).toFixed(1)}s`, "--w": `${(-(i * 13) % 14 / 10).toFixed(1)}s`, "--s": `${4 + (i * 5) % 5}px` } })),
      ]);
      if (item.art) {
        const art = el("img.gfx-cutin-art", { src: item.art, alt: "", draggable: "false" });
        art.addEventListener("load", () => deco.classList.add("has-art"));
        art.addEventListener("error", () => art.remove());
        deco.prepend(art);
      }
      card = el(`div.gfx-cutin.t-${item.tone || "skill"}${item.board ? `.b-${item.board}` : ""}`, [
        deco,
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

/**
 * 決定のまとめの札（SBD132）: 「火を N つ灯した」と、増えた能力を絵と数で。host の真ん中に出し、押すか時間で消える。
 * rows: [{ icon（画像のURL）, glyph, name, value（「＋16」） }]。戻り値＝消えた時に resolve。
 */
export function commitBanner(host, { count = 0, board = null, rows = [], hold = FX.bannerMs } = {}) {
  if (reducedMotion() || !host?.isConnected || !count) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false, timer = null;
    const finish = () => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (canAnimate(veil)) veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: "both" }).finished.catch(() => {}).finally(() => { veil.remove(); resolve(); });
      else { veil.remove(); resolve(); }
    };
    const veil = el("div.gfx-banner-veil", { role: "status", dataset: { test: "board-commit-banner" } }, [
      el(`div.gfx-banner${board ? `.b-${board}` : ""}`, [
        el("i.gfx-banner-rays", { "aria-hidden": "true" }, Array.from({ length: 12 }, (_, i) => el("i.gfx-banner-ember", {
          style: { "--x": `${4 + (i * 41) % 92}%`, "--d": `${(1.2 + (i * 7) % 10 / 10).toFixed(1)}s`, "--w": `${(-(i * 11) % 15 / 10).toFixed(1)}s`, "--s": `${4 + (i * 5) % 5}px` } }))),
        el("small", { text: "LIGHT UP" }),
        el("strong", [el("span", { text: "火を" }), el("b", { text: String(count) }), el("span", { text: "つ灯した" })]),
        rows.length ? el("div.gfx-banner-rows", rows.slice(0, 8).map((row, i) => {
          const iconBox = el("span.gfx-banner-icon", { "aria-hidden": "true" }, [el("b", { text: row.glyph || "" })]);
          if (row.icon) {
            const img = el("img", { src: row.icon, alt: "", draggable: "false" });
            img.addEventListener("load", () => iconBox.classList.add("has-img"));
            img.addEventListener("error", () => img.remove());
            iconBox.append(img);
          }
          return el("span.gfx-banner-row", { style: { "--i": String(i) } }, [iconBox, el("em", { text: row.name }), el("b", { text: row.value })]);
        })) : null,
      ]),
    ]);
    veil.addEventListener("pointerdown", (e) => { e.preventDefault?.(); finish(); });
    host.append(veil);
    timer = setTimeout(finish, hold);
  });
}

/** 盤の上をゆっくり昇る火の粉（飾り）。level 0〜3 で数が増える。CSS だけで動く。 */
export function emberField(count = 14) {
  return el("div.gfx-embers", { "aria-hidden": "true" }, Array.from({ length: count }, (_, i) => el("i", {
    style: { "--x": `${(7 + (i * 61) % 86)}%`, "--d": `${(5.5 + (i * 37) % 50 / 10).toFixed(1)}s`, "--w": `${(-(i * 23) % 60 / 10).toFixed(1)}s`, "--s": `${3 + (i * 7) % 4}px`, "--sway": `${-18 + (i * 29) % 36}px` },
  })));
}
