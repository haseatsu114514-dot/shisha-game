// 上画面（256×192 の canvas）の絵。現行ステージ（固定 1280×720）の背景・一枚絵・立ち絵を読み、低い解像度へ写す。
// 画像は現行が読み込んだものと同じ URL（同一オリジン）を使う。新しい素材は作らない。
// 縮小の質: 元画像を半分ずつ縮めた段を URL ごとに覚え、目的の大きさに近い段から描く（1回の縮小は2倍未満になる）。
import { SCREEN_W as W, SCREEN_H as H } from "./shell.js";

const STAGE_W = 1280, STAGE_H = 720;
const CACHE_MAX = 20;
const cache = new Map(); // url → { img, ready, failed, levels }
let version = 0;         // 画像が読めるたびに進める（描き直しの合図）

const size = (source) => [source.naturalWidth || source.width, source.naturalHeight || source.height];

function entryFor(url) {
  let entry = cache.get(url);
  if (entry) { cache.delete(url); cache.set(url, entry); return entry; }
  const img = new Image();
  img.decoding = "async";
  entry = { img, ready: false, failed: false, levels: null };
  img.onload = () => { entry.ready = true; entry.levels = [img]; version++; };
  img.onerror = () => { entry.failed = true; version++; };
  img.src = url;
  cache.set(url, entry);
  while (cache.size > CACHE_MAX) {
    const [oldUrl, old] = cache.entries().next().value;
    old.img.onload = old.img.onerror = null;
    old.levels = null;
    cache.delete(oldUrl);
  }
  return entry;
}

/** 縮小率 scale（描く幅 ÷ 元の幅）に合う段。無ければ半分ずつ作る。 */
function levelFor(entry, scale) {
  let wanted = 0;
  for (let s = scale; s <= 0.5 && wanted < 6; s *= 2) wanted++;
  while (entry.levels.length <= wanted) {
    const prev = entry.levels[entry.levels.length - 1];
    const [pw, ph] = size(prev);
    if (pw <= 2 || ph <= 2) break;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(pw / 2));
    canvas.height = Math.max(1, Math.round(ph / 2));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(prev, 0, 0, canvas.width, canvas.height);
    entry.levels.push(canvas);
  }
  return entry.levels[Math.min(wanted, entry.levels.length - 1)];
}

/** 画像の一部（元画像の px）を、いまの座標系の矩形へ描く。zoom は座標系の倍率（canvas px ÷ 座標 1）。 */
function drawPart(ctx, entry, sx, sy, sw, sh, dx, dy, dw, dh, zoom) {
  if (!entry?.ready || !(sw > 0) || !(sh > 0) || !(dw > 0) || !(dh > 0)) return false;
  const [w0, h0] = size(entry.levels[0]);
  const level = levelFor(entry, (dw * zoom) / sw);
  const [lw, lh] = size(level);
  const fx = lw / w0, fy = lh / h0;
  ctx.drawImage(level, sx * fx, sy * fy, sw * fx, sh * fy, dx, dy, dw, dh);
  return true;
}
const drawWhole = (ctx, entry, dx, dy, dw, dh, zoom) => {
  if (!entry?.ready) return false;
  const [w0, h0] = size(entry.levels[0]);
  return drawPart(ctx, entry, 0, 0, w0, h0, dx, dy, dw, dh, zoom);
};

// ---------------------------------------------------------------- 現行の DOM の読み取り

const round = (n, digits = 1) => { const p = 10 ** digits; return Math.round(n * p) / p; };
const cssUrl = (value) => {
  const m = /url\((['"]?)(.*?)\1\)/.exec(value || "");
  return m ? new URL(m[2], document.baseURI).href : "";
};
/** filter の brightness（無ければ 1）。 */
const brightnessOf = (filter) => {
  const m = /brightness\(([\d.]+)(%?)\)/.exec(filter || "");
  return m ? round(Math.min(1, parseFloat(m[1]) / (m[2] ? 100 : 1)), 2) : 1;
};

function stageMetrics() {
  const stage = document.getElementById("stage");
  const rect = stage.getBoundingClientRect();
  return { rect, k: rect.width / (stage.offsetWidth || STAGE_W) || 1 };
}
/** 要素の矩形を、ステージの座標（1280×720）へ直す。 */
function stageBox(node, metrics) {
  const b = node.getBoundingClientRect();
  return { x: round((b.left - metrics.rect.left) / metrics.k), y: round((b.top - metrics.rect.top) / metrics.k), w: round(b.width / metrics.k), h: round(b.height / metrics.k) };
}

/** background-size / background-position（計算済みの値）から、箱の中で絵を置く矩形を求める。 */
function backgroundRect(box, iw, ih, sizeValue, posValue) {
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
function readBackgrounds(metrics) {
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

/** 会話の立ち絵（位置・不透明度・話していない人の暗さ）。 */
function readPortraits(metrics) {
  const vn = document.getElementById("vn");
  if (!vn) return [];
  const base = parseFloat(getComputedStyle(vn).opacity) || 0;
  const holder = vn.querySelector(".vn-portraits");
  if (!holder) return [];
  const group = base * (parseFloat(getComputedStyle(holder).opacity) || 0);
  const out = [];
  for (const img of holder.querySelectorAll("img.portrait")) {
    if (!img.complete || !img.naturalWidth) continue;
    const cs = getComputedStyle(img);
    const opacity = round(group * (parseFloat(cs.opacity) || 0), 2);
    if (opacity <= 0.02) continue;
    const m = /matrix\(([-\d.e]+)/.exec(cs.transform || "");
    out.push({ url: img.currentSrc || img.src, ...stageBox(img, metrics), opacity, bright: brightnessOf(cs.filter), flip: !!m && parseFloat(m[1]) < 0 });
  }
  return out;
}

/** 会話の一枚絵（.vn-cg）。 */
function readCg(metrics) {
  const cg = document.querySelector("#vn .vn-cg");
  if (!cg) return null;
  const cs = getComputedStyle(cg);
  const opacity = round((parseFloat(cs.opacity) || 0) * (parseFloat(getComputedStyle(cg.parentElement).opacity) || 0), 2);
  const url = cssUrl(cs.backgroundImage);
  if (opacity <= 0.01 || !url) return null;
  return { url, opacity, box: stageBox(cg, metrics), size: cs.backgroundSize, pos: cs.backgroundPosition, color: cs.backgroundColor };
}

// ---------------------------------------------------------------- 描画

let scratch = null; // 立ち絵を透明度2値化するための作業用 canvas（256×192）
function scratchContext() {
  if (!scratch) {
    scratch = document.createElement("canvas");
    scratch.width = W; scratch.height = H;
  }
  return scratch.getContext("2d", { willReadFrequently: true });
}

function useView(ctx, view) {
  const zoom = W / view.w;
  ctx.setTransform(zoom, 0, 0, zoom, -view.x * zoom, -view.y * zoom);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return zoom;
}
const resetView = (ctx) => ctx.setTransform(1, 0, 0, 1, 0, 0);

function shade(ctx, color, alpha) {
  if (alpha <= 0) return;
  resetView(ctx);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}

/**
 * 切り抜きの絵（立ち絵・店の台）を1枚、作業用 canvas に描いてから重ねる。
 * 透明度は2値化（128 以上を不透明）し、bright < 1 なら絵の上にだけ黒を重ねて暗くする。
 * box はステージ座標での絵の矩形、draw(work, zoom) が作業用 canvas へ描く。
 */
function paintCutout(ctx, view, box, { bright = 1, opacity = 1, flip = false }, draw) {
  const zoom = W / view.w;
  const left = Math.max(0, Math.floor((box.x - view.x) * zoom) - 1), top = Math.max(0, Math.floor((box.y - view.y) * zoom) - 1);
  const right = Math.min(W, Math.ceil((box.x + box.w - view.x) * zoom) + 1), bottom = Math.min(H, Math.ceil((box.y + box.h - view.y) * zoom) + 1);
  if (right <= left || bottom <= top) return;
  const work = scratchContext();
  resetView(work);
  work.globalCompositeOperation = "source-over";
  work.globalAlpha = 1;
  work.clearRect(0, 0, W, H);
  useView(work, view);
  if (flip) {
    work.translate(box.x * 2 + box.w, 0);
    work.scale(-1, 1);
  }
  draw(work, zoom);
  resetView(work);
  if (bright < 1) {
    work.globalCompositeOperation = "source-atop";
    work.globalAlpha = 1 - bright;
    work.fillStyle = "#000";
    work.fillRect(left, top, right - left, bottom - top);
    work.globalCompositeOperation = "source-over";
    work.globalAlpha = 1;
  }
  const pixels = work.getImageData(left, top, right - left, bottom - top);
  const data = pixels.data;
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] >= 128 ? 255 : 0;
  work.putImageData(pixels, left, top);
  resetView(ctx);
  ctx.globalAlpha = opacity;
  ctx.drawImage(scratch, left, top, right - left, bottom - top, left, top, right - left, bottom - top);
  ctx.globalAlpha = 1;
}

/** 背景の層を view（ステージ座標の窓）で描く。素材が読めていない層があれば false。 */
function paintBackgrounds(ctx, layers, view) {
  let complete = true;
  for (const layer of layers) {
    if (layer.black) shade(ctx, "#07050b", layer.opacity);
    for (const [index, part] of layer.parts.entries()) {
      const zoom = useView(ctx, view);
      ctx.globalAlpha = layer.opacity;
      if (part.type === "ellipse") {
        ctx.fillStyle = "rgba(0,0,0,0.24)";
        ctx.beginPath();
        ctx.ellipse(part.cx, part.cy, part.rx, part.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const entry = entryFor(part.url);
      if (!entry.ready) { complete &&= entry.failed; continue; }
      const [iw, ih] = size(entry.levels[0]);
      if (part.type === "cover") {
        const r = backgroundRect(part.box, iw, ih, part.size, part.pos);
        drawWhole(ctx, entry, r.x, r.y, r.w, r.h, zoom);
      } else if (part.type === "image" && index === 0) {
        drawWhole(ctx, entry, part.x, part.y, part.w, part.h, zoom); // SVG の1枚目は背景そのもの
      } else {
        // 店の台（切り抜きの絵）。夜の店内では台だけ暗くしている（brightness）。
        paintCutout(ctx, view, part, { bright: part.bright, opacity: layer.opacity }, (work, z) => {
          if (part.type === "image") return drawWhole(work, entry, part.x, part.y, part.w, part.h, z);
          const fx = iw / (part.full[0] || iw), fy = ih / (part.full[1] || ih);
          const [cx, cy, cw, ch] = part.crop;
          return drawPart(work, entry, cx * fx, cy * fy, cw * fx, ch * fy, part.x, part.y, part.w, part.h, z);
        });
      }
    }
    resetView(ctx);
    ctx.globalAlpha = 1;
    // 夜・暗がりの色調（base.css の .bg-img[data-tint]・雨天の減光）に近づける。
    if (layer.bright < 1) shade(ctx, "#000000", (1 - layer.bright) * layer.opacity);
    if (layer.tint === "night") shade(ctx, "rgb(12,14,48)", 0.5 * layer.opacity);
  }
  resetView(ctx);
  return complete;
}

/** 立ち絵1枚。 */
function paintSprite(ctx, sprite, view) {
  const entry = entryFor(sprite.url);
  if (!entry.ready) return entry.failed;
  paintCutout(ctx, view, sprite, sprite, (work, zoom) => drawWhole(work, entry, sprite.x, sprite.y, sprite.w, sprite.h, zoom));
  return true;
}

function paintCg(ctx, cg, view) {
  const entry = entryFor(cg.url);
  const zoom = useView(ctx, view);
  ctx.globalAlpha = cg.opacity;
  ctx.fillStyle = cg.color && cg.color !== "rgba(0, 0, 0, 0)" ? cg.color : "#000";
  ctx.fillRect(cg.box.x, cg.box.y, cg.box.w, cg.box.h);
  let done = entry.failed;
  if (entry.ready) {
    const [iw, ih] = size(entry.levels[0]);
    const r = backgroundRect(cg.box, iw, ih, cg.size, cg.pos);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cg.box.x, cg.box.y, cg.box.w, cg.box.h);
    ctx.clip();
    drawWhole(ctx, entry, r.x, r.y, r.w, r.h, zoom);
    ctx.restore();
    done = true;
  }
  ctx.globalAlpha = 1;
  resetView(ctx);
  return done;
}

/** 回想（白黒）・セピアの場面は、描き終えた 256×192 をまとめて変換する。 */
function tone(ctx, mode) {
  const pixels = ctx.getImageData(0, 0, W, H);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (mode === "gray") { d[i] = d[i + 1] = d[i + 2] = y * 0.92 + 10; }
    else { d[i] = Math.min(255, y * 1.02 + 22); d[i + 1] = Math.min(255, y * 0.9 + 12); d[i + 2] = y * 0.7; }
  }
  ctx.putImageData(pixels, 0, 0);
}

export function createPainter(canvas) {
  const ctx = canvas.getContext("2d");
  let lastSig = "", lastAt = 0;

  /** 同じ内容なら描かない。素材が後から読めた時は version が進むので、その時に描き直す。 */
  function commit(sig, draw, now) {
    const full = `${sig}#${version}`;
    if (full === lastSig) return false;
    if (now - lastAt < 36) return false; // 最大 約28回/秒
    lastAt = now;
    lastSig = full;
    resetView(ctx);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#0b0812";
    ctx.fillRect(0, 0, W, H);
    draw();
    return true;
  }

  return {
    /** 会話: ステージの「横中央の幅 853・上から高さ 640」（4:3）の窓を写す。 */
    paintVn(now) {
      const metrics = stageMetrics();
      const view = { x: (STAGE_W - 640 * 4 / 3) / 2, y: 0, w: 640 * 4 / 3, h: 640 };
      const vn = document.getElementById("vn");
      const mode = vn?.classList.contains("flashback") ? "gray" : vn?.classList.contains("sepia") ? "sepia" : "";
      const scene = { bg: readBackgrounds(metrics), sprites: readPortraits(metrics), cg: readCg(metrics), mode };
      return commit(`vn${JSON.stringify(scene)}`, () => {
        let ok = paintBackgrounds(ctx, scene.bg, view);
        for (const sprite of scene.sprites) ok = paintSprite(ctx, sprite, view) && ok;
        if (scene.cg) ok = paintCg(ctx, scene.cg, view) && ok;
        if (mode) tone(ctx, mode);
        return ok;
      }, now);
    },

    /** 地図: view（全ピンが入る 4:3 の窓）で街の絵を写す。雨の日は少し青く沈める。 */
    paintMap(now, view, rainy) {
      const metrics = stageMetrics();
      const scene = { bg: readBackgrounds(metrics), view: [round(view.x), round(view.y), round(view.w)], rainy };
      return commit(`map${JSON.stringify(scene)}`, () => {
        const ok = paintBackgrounds(ctx, scene.bg, view);
        if (rainy) shade(ctx, "rgb(40,52,72)", 0.28);
        return ok;
      }, now);
    },

    /** タイトル: 4:3 に組み直す。左半分は背景とロゴ（画像）、右半分はキャラクターの絵（縦長 2:3 がちょうど入る）。 */
    paintTitle(now, { art, logo }) {
      const metrics = stageMetrics();
      const scene = { bg: readBackgrounds(metrics), art, logo };
      return commit(`title${JSON.stringify(scene)}`, () => {
        const half = W / 2;
        // 背景は左寄り（ロゴの後ろの暗い側）を 4:3 に切る
        paintBackgrounds(ctx, scene.bg, { x: 0, y: 0, w: STAGE_H * 4 / 3, h: STAGE_H });
        resetView(ctx);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        const artEntry = art?.url ? entryFor(art.url) : null;
        if (artEntry?.ready) {
          const [iw, ih] = size(artEntry.levels[0]);
          const scale = Math.max(half / iw, H / ih);
          const dw = iw * scale, dh = ih * scale;
          ctx.save();
          ctx.beginPath(); ctx.rect(half, 0, half, H); ctx.clip();
          ctx.globalAlpha = art.opacity;
          drawWhole(ctx, artEntry, half + (half - dw) / 2, (H - dh) * 0.2, dw, dh, 1);
          ctx.restore();
          ctx.globalAlpha = 1;
          // 2枚の絵の境目はベタの線で仕切る
          ctx.fillStyle = "#2a1d3a"; ctx.fillRect(half - 2, 0, 2, H);
          ctx.fillStyle = "#c9a7e6"; ctx.fillRect(half - 3, 0, 1, H);
        }
        const logoEntry = logo?.url ? entryFor(logo.url) : null;
        if (logoEntry?.ready) {
          const [iw, ih] = size(logoEntry.levels[0]);
          const dw = artEntry?.ready ? 118 : 168, dh = dw * ih / iw;
          const dx = artEntry?.ready ? Math.round((half - 3 - dw) / 2) : Math.round((W - dw) / 2), dy = Math.round((H - dh) / 2) - 6;
          const work = scratchContext();
          resetView(work);
          work.globalCompositeOperation = "source-over";
          work.globalAlpha = 1;
          work.clearRect(0, 0, W, H);
          work.imageSmoothingEnabled = true;
          work.imageSmoothingQuality = "high";
          drawWhole(work, logoEntry, dx, dy, dw, dh, 1);
          const x0 = Math.max(0, dx), y0 = Math.max(0, dy), w = Math.min(W - x0, Math.ceil(dw) + 1), h = Math.min(H - y0, Math.ceil(dh) + 1);
          const pixels = work.getImageData(x0, y0, w, h);
          const d = pixels.data;
          for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
          work.putImageData(pixels, x0, y0);
          // 1〜2ドットずらしたベタの影を敷いてから本体を重ねる
          ctx.drawImage(shadowOf(scratch, x0, y0, w, h), x0 + 1, y0 + 2);
          ctx.drawImage(scratch, x0, y0, w, h, x0, y0, w, h);
        }
      }, now);
    },

    /** 顔アイコンなどの小さな絵を、同じ縮小のしかたで小さな canvas へ描く。読めたら true。 */
    drawIcon(target, url) {
      const entry = entryFor(url);
      if (!entry.ready) return false;
      const c = target.getContext("2d");
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, target.width, target.height);
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "high";
      return drawWhole(c, entry, 0, 0, target.width, target.height, 1);
    },

    /** 次の機会に必ず描き直す（場面が切り替わった時）。 */
    invalidate() { lastSig = ""; },
    get version() { return version; },
    dispose() {
      for (const entry of cache.values()) { entry.img.onload = entry.img.onerror = null; entry.levels = null; }
      cache.clear();
      scratch = null;
      shadow = null;
    },
  };
}

// ロゴの影（不透明な所だけを濃い紫で塗った絵）
let shadow = null;
function shadowOf(source, x, y, w, h) {
  if (!shadow) { shadow = document.createElement("canvas"); }
  shadow.width = w; shadow.height = h;
  const c = shadow.getContext("2d");
  c.drawImage(source, x, y, w, h, 0, 0, w, h);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = "#120a1e";
  c.fillRect(0, 0, w, h);
  return shadow;
}
