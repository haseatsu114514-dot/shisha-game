// DS風の上画面の共通部品: 現行ステージ（固定 1280×720）の DOM を読む・会話の窓を決める。
// 描き方（ドット絵の retro/painter.js と高解像度の retro/painter-hd.js）の両方がここを使う。DOM は読むだけで書き換えない。

export const STAGE_W = 1280, STAGE_H = 720;
export const ZOOM_IN = 1.35;    // 一人の場面で人物へ寄る倍率

// ---------------------------------------------------------------- 現行の DOM の読み取り

export const round = (n, digits = 1) => { const p = 10 ** digits; return Math.round(n * p) / p; };
export const cssUrl = (value) => {
  const m = /url\((['"]?)(.*?)\1\)/.exec(value || "");
  return m ? new URL(m[2], document.baseURI).href : "";
};
/** filter の brightness（無ければ 1）。 */
export const brightnessOf = (filter) => {
  const m = /brightness\(([\d.]+)(%?)\)/.exec(filter || "");
  return m ? round(Math.min(1, parseFloat(m[1]) / (m[2] ? 100 : 1)), 2) : 1;
};

export function stageMetrics() {
  const stage = document.getElementById("stage");
  const rect = stage.getBoundingClientRect();
  return { rect, k: rect.width / (stage.offsetWidth || STAGE_W) || 1 };
}
/** 要素の矩形を、ステージの座標（1280×720）へ直す。 */
export function stageBox(node, metrics) {
  const b = node.getBoundingClientRect();
  return { x: round((b.left - metrics.rect.left) / metrics.k), y: round((b.top - metrics.rect.top) / metrics.k), w: round(b.width / metrics.k), h: round(b.height / metrics.k) };
}

/** background-size / background-position（計算済みの値）から、箱の中で絵を置く矩形を求める。 */
export function backgroundRect(box, iw, ih, sizeValue, posValue) {
  const length = (token, total) => token.endsWith("%") ? total * parseFloat(token) / 100 : parseFloat(token);
  let w, h;
  const sizes = (sizeValue || "cover").split(/\s+/);
  if (sizes[0] === "cover" || sizes[0] === "contain") {
    const scale = sizes[0] === "cover" ? Math.max(box.w / iw, box.h / ih) : Math.min(box.w / iw, box.h / ih);
    w = iw * scale; h = ih * scale;
  } else {
    const [sw, sh = "auto"] = sizes;
    if (sw === "auto" && sh === "auto") { w = iw; h = ih; }
    else if (sw === "auto") { h = length(sh, box.h); w = h * iw / ih; }
    else if (sh === "auto") { w = length(sw, box.w); h = w * ih / iw; }
    else { w = length(sw, box.w); h = length(sh, box.h); }
  }
  const [px = "50%", py = "50%"] = (posValue || "50% 50%").split(/\s+/);
  const place = (token, room) => token.endsWith("%") ? room * parseFloat(token) / 100 : parseFloat(token) || 0;
  return { x: box.x + place(px, box.w - w), y: box.y + place(py, box.h - h), w, h };
}

/** 背景の層（#bg の .bg-img）。絵1枚か、店の台を重ねた SVG（core/scene-art.js）。 */
export function readBackgrounds(metrics) {
  const out = [];
  const lift = document.body.classList.contains("vn-lift-props");
  for (const node of document.querySelectorAll("#bg > .bg-img")) {
    const cs = getComputedStyle(node);
    const opacity = round(parseFloat(cs.opacity) || 0, 2);
    if (opacity <= 0.01) continue;
    const layer = { opacity, tint: node.dataset.tint || "", black: node.classList.contains("black"), bright: brightnessOf(cs.filter), parts: [] };
    const art = node.querySelector(":scope > svg.scene-art");
    if (art) {
      for (const child of art.children) {
        const num = (name) => parseFloat(child.getAttribute(name)) || 0;
        const bright = brightnessOf(child.style?.filter);
        const dy = lift && child.dataset?.homeRig ? -78 : 0;
        if (child.localName === "image") {
          layer.parts.push({ type: "image", url: new URL(child.getAttribute("href"), document.baseURI).href, x: num("x"), y: num("y") + dy, w: num("width"), h: num("height"), bright });
        } else if (child.localName === "ellipse") {
          layer.parts.push({ type: "ellipse", cx: num("cx"), cy: num("cy") + dy, rx: num("rx"), ry: num("ry") });
        } else if (child.localName === "svg") {
          const inner = child.querySelector("image");
          const crop = (child.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
          if (!inner || crop.length !== 4) continue;
          layer.parts.push({ type: "crop", url: new URL(inner.getAttribute("href"), document.baseURI).href, x: num("x"), y: num("y") + dy, w: num("width"), h: num("height"), crop,
            full: [parseFloat(inner.getAttribute("width")) || 0, parseFloat(inner.getAttribute("height")) || 0], bright });
        }
      }
    } else {
      const url = cssUrl(cs.backgroundImage);
      if (url) layer.parts.push({ type: "cover", url, box: stageBox(node, metrics), size: cs.backgroundSize, pos: cs.backgroundPosition });
    }
    out.push(layer);
  }
  return out;
}

// 立ち絵の立ち位置（vn.css の .portrait[data-pos]）。窓を寄せる先は、動いている途中の位置ではなくこの「行き先」で決める。
export const POSITION = { center: 0.5, left: 0.3, right: 0.7 };

/** 会話の立ち絵（位置・不透明度・話していない人の暗さ）と、窓を寄せる目安（focus: 立ち位置の中心と頭の高さ）。 */
export function readPortraits(metrics) {
  const vn = document.getElementById("vn");
  const holder = vn?.querySelector(".vn-portraits");
  if (!holder) return { sprites: [], focus: [] };
  const group = (parseFloat(getComputedStyle(vn).opacity) || 0) * (parseFloat(getComputedStyle(holder).opacity) || 0);
  const area = stageBox(holder, metrics);
  const sprites = [], focus = [];
  for (const img of holder.querySelectorAll("img.portrait")) {
    if (!img.complete || !img.naturalWidth) continue;
    const cs = getComputedStyle(img);
    const box = stageBox(img, metrics);
    focus.push({ cx: Math.round(area.x + area.w * (POSITION[img.dataset.pos] ?? 0.5)), top: box.y });
    const opacity = round(group * (parseFloat(cs.opacity) || 0), 2);
    if (opacity <= 0.02) continue;
    const m = /matrix\(([-\d.e]+)/.exec(cs.transform || "");
    sprites.push({ url: img.currentSrc || img.src, ...box, opacity, bright: brightnessOf(cs.filter), flip: !!m && parseFloat(m[1]) < 0 });
  }
  return { sprites, focus };
}

/** 会話の一枚絵（.vn-cg）。 */
export function readCg(metrics) {
  const cg = document.querySelector("#vn .vn-cg");
  if (!cg) return null;
  const cs = getComputedStyle(cg);
  const opacity = round((parseFloat(cs.opacity) || 0) * (parseFloat(getComputedStyle(cg.parentElement).opacity) || 0), 2);
  const url = cssUrl(cs.backgroundImage);
  if (opacity <= 0.01 || !url) return null;
  return { url, opacity, box: stageBox(cg, metrics), size: cs.backgroundSize, pos: cs.backgroundPosition, color: cs.backgroundColor };
}

// ---------------------------------------------------------------- 窓（ステージ座標）

export const WIDE = Object.freeze({ x: round((STAGE_W - 640 * 4 / 3) / 2), y: 0, w: round(640 * 4 / 3), h: 640 });
export const viewKey = (view) => `${view.x},${view.y},${view.w}`;
export const sameView = (a, b) => !!a && !!b && viewKey(a) === viewKey(b);
export const mixView = (a, b, t) => {
  const w = round(a.w + (b.w - a.w) * t);
  return { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t), w, h: w * 3 / 4 };
};
/**
 * 会話の窓。基本はステージの「横中央の幅 853・上から高さ 640」。立ち絵が寄った窓（1.35 倍）に収まる時は、
 * 上端をそろえたまま立ち位置の中心へ寄る（ステージの外へは出さない）。一枚絵の間・背の低い相手（猫など）・
 * 並んで収まらない時は広い窓のまま。
 */
export function conversationView(focus, cg) {
  if (cg || !focus.length || focus.some((f) => f.top > 150)) return WIDE;
  const w = round(WIDE.w / ZOOM_IN), half = 150; // half: 体の幅の半分の目安（ステージ px）
  const min = Math.min(...focus.map((f) => f.cx)), max = Math.max(...focus.map((f) => f.cx));
  if (max - min + half * 2 > w) return WIDE;
  return { x: Math.round(Math.max(0, Math.min(STAGE_W - w, (min + max) / 2 - w / 2))), y: 0, w, h: w * 3 / 4 };
}
