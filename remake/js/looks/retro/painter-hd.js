// 上画面の高解像度の描き方（新版の縦持ち・LK11）。DS風の外枠のまま、上画面だけを新版と同じ絵で描く。
// 操作（paintVn・paintMap・paintTitle・paintCover・drawIcon・enter・refresh・stats・version・dispose）は retro/painter.js と同じ。
// 現行ステージの読み取りと会話の窓は retro/stage-read.js を共有する（DS風と同じ場面の写し方）。
//
// canvas の裏画面は「CSS の大きさ × devicePixelRatio」（retro/shell.js が決める）。減色・網点・2値化はしない。
// 重い処理（背景の暗さ・ぼかし、立ち絵の柔らかい影）は絵ごと・大きさごとに一度だけ作って覚え、
// 毎回は覚えた絵を今の窓の位置へ重ねるだけにする。描き直すのは入力が変わった時と動きの途中だけ（30fps まで）。
// 寄り・引きは滑らかに（280ms）、場面の切り替えはクロスフェード（200ms）。動きを減らす設定では即時。
import {
  STAGE_W, STAGE_H, ZOOM_IN, round, stageMetrics, backgroundRect, readBackgrounds, readPortraits, readCg,
  WIDE, viewKey, sameView, conversationView,
} from "./stage-read.js";
import { SCREEN_W as W, SCREEN_H as H } from "./shell.js";

const SOURCE_MAX = 8;    // 覚えておく元の絵の数（iPhone の canvas の容量を考えて少なめ）
const TILE_MAX = 8;      // 作った絵（背景・立ち絵）の数
const FRAME_MS = 33;     // 描き直しは 30fps まで
const ZOOM_MS = 280, FADE_MS = 200;
const BUDGET_MS = 14;    // 1 フレームで絵を作るのに使う時間の目安
const WAIT_MS = 900;     // 絵の読み込みを待って前の絵のままにしておく上限
const VN_ROWS = 640;     // 会話の窓が写すステージの高さ（どの窓も上から 640 まで）
const BASE = "#0b0812";

const reduced = () => (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  || document.body.classList.contains("reduce-shake");
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const sizeOf = (source) => [source.naturalWidth || source.width, source.naturalHeight || source.height];
const canvasOf = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
};
const smooth = (ctx) => { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; return ctx; };

// ---------------------------------------------------------------- 元の絵（読み込み・縮小の段）

const sources = new Map(); // url → { url, ready, failed, dropped, levels: [絵, 半分, 1/4, …], alpha }
let version = 0;

/** 展開（decode）は fetch → createImageBitmap で裏のスレッドに任せる。使えない環境では <img> で読む。 */
async function loadSource(url) {
  if (typeof createImageBitmap === "function" && typeof fetch === "function") {
    try {
      const response = await fetch(url);
      if (response.ok) return await createImageBitmap(await response.blob());
    } catch { /* 下の <img> で読み直す */ }
  }
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

let probe = null;
/** 透明な所のある絵（切り抜きの絵）かどうか。小さく縮めた絵の不透明度で見る。 */
function hasAlpha(source) {
  probe ||= canvasOf(16, 16);
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, 16, 16);
  ctx.drawImage(source, 0, 0, 16, 16);
  const data = ctx.getImageData(0, 0, 16, 16).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

function sourceFor(url) {
  let entry = sources.get(url);
  if (entry) { sources.delete(url); sources.set(url, entry); return entry; }
  entry = { url, ready: false, failed: false, dropped: false, levels: null, alpha: false };
  loadSource(url).then((source) => {
    if (entry.dropped) { source.close?.(); return; }
    entry.levels = [source];
    entry.alpha = hasAlpha(source);
    entry.ready = true;
    version++;
  }, () => { entry.failed = true; version++; });
  sources.set(url, entry);
  while (sources.size > SOURCE_MAX) {
    const [oldUrl, old] = sources.entries().next().value;
    old.dropped = true;
    old.levels?.[0]?.close?.();
    old.levels = null;
    sources.delete(oldUrl);
  }
  return entry;
}

/** 縮小率 scale（描く幅 ÷ 元の幅）に合う段。半分より小さく縮める時は、半分ずつ縮めた段から描く（高品質の縮小）。 */
function levelFor(entry, scale) {
  let wanted = 0;
  for (let s = scale; s <= 0.5 && wanted < 5; s *= 2) wanted++;
  while (entry.levels.length <= wanted) {
    const prev = entry.levels[entry.levels.length - 1];
    const [pw, ph] = sizeOf(prev);
    if (pw <= 4 || ph <= 4) break;
    const next = canvasOf(pw / 2, ph / 2);
    smooth(next.getContext("2d")).drawImage(prev, 0, 0, next.width, next.height);
    entry.levels.push(next);
  }
  return entry.levels[Math.min(wanted, entry.levels.length - 1)];
}

/** 元の絵の一部（元の px）を、ctx の今の座標系の矩形へ描く。pixel は ctx の座標 1 が何画素か。 */
function drawPart(ctx, entry, sx, sy, sw, sh, dx, dy, dw, dh, pixel = 1) {
  if (!entry?.ready || !(sw > 0) || !(sh > 0) || !(dw > 0) || !(dh > 0)) return false;
  const [w0, h0] = sizeOf(entry.levels[0]);
  const level = levelFor(entry, Math.abs(dw * pixel) / sw);
  const [lw, lh] = sizeOf(level);
  const fx = lw / w0, fy = lh / h0;
  ctx.drawImage(level, sx * fx, sy * fy, sw * fx, sh * fy, dx, dy, dw, dh);
  return true;
}
const drawWhole = (ctx, entry, dx, dy, dw, dh, pixel = 1) => {
  if (!entry?.ready) return false;
  const [w0, h0] = sizeOf(entry.levels[0]);
  return drawPart(ctx, entry, 0, 0, w0, h0, dx, dy, dw, dh, pixel);
};

// ---------------------------------------------------------------- 作った絵（背景の層・立ち絵の影つき）

const tiles = new Map();
function remember(key, value) {
  tiles.delete(key);
  tiles.set(key, value);
  while (tiles.size > TILE_MAX) tiles.delete(tiles.keys().next().value);
  return value;
}

let blurWorks = null;
/** canvas の filter（blur）が効く環境か。効かない環境（古い Safari など）は縮めて戻すぼかしで代える。 */
function canFilter() {
  if (blurWorks !== null) return blurWorks;
  try {
    const ctx = canvasOf(1, 1).getContext("2d");
    ctx.filter = "blur(1px)";
    blurWorks = ctx.filter === "blur(1px)";
  } catch { blurWorks = false; }
  return blurWorks;
}

/**
 * 背景の色調（人物が立つように、少し暗く・わずかにぼかす）。夜・暗がり・雨は DS風と同じ考え方で控えめに。
 * filter は使わず、重ね塗り（暗さ・彩度・夜の藍）とぼかしで作る（どの環境でも同じ見た目にするため）。
 */
function lookOf(layer, person, rainy) {
  const night = layer.tint === "night", dim = layer.tint === "dim";
  const bright = dim ? 0.45 : night ? (person ? 0.6 : 0.7) : rainy ? (person ? 0.7 : 0.84) : person ? 0.74 : 0.96;
  // blur は CSS の px（実機の画素では × devicePixelRatio。iPhone の 3 倍で実機 2 画素ほど＝仮組みと同じ）
  return { bright, mute: night ? 0.28 : rainy ? 0.3 : person ? 0.12 : 0, night, blur: person || dim ? 0.7 : 0 };
}
function applyLook(canvas, look, pixel) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  if (look.blur) {
    const radius = look.blur * pixel;
    if (canFilter()) {
      const copy = canvasOf(w, h);
      copy.getContext("2d").drawImage(canvas, 0, 0);
      ctx.save();
      ctx.filter = `blur(${radius.toFixed(2)}px)`;
      ctx.drawImage(copy, 0, 0);
      ctx.restore();
    } else {
      const factor = Math.max(1.5, radius * 1.2);
      const small = canvasOf(w / factor, h / factor);
      smooth(small.getContext("2d")).drawImage(canvas, 0, 0, small.width, small.height);
      smooth(ctx).drawImage(small, 0, 0, w, h);
    }
  }
  ctx.save();
  if (look.mute > 0) {
    ctx.globalCompositeOperation = "saturation";
    ctx.globalAlpha = look.mute;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = "source-over";
  if (look.bright < 1) { ctx.globalAlpha = 1 - look.bright; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); }
  if (look.night) { ctx.globalAlpha = 0.32; ctx.fillStyle = "rgb(12,14,48)"; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}

/** 切り抜きの絵（店の台など）を、暗さ bright で ctx へ描く。暗さは絵の上だけに乗せる。 */
let scratch = null;
function scratchOf(w, h) {
  scratch ||= canvasOf(w, h);
  if (scratch.width < w || scratch.height < h) { scratch.width = Math.max(scratch.width, Math.ceil(w)); scratch.height = Math.max(scratch.height, Math.ceil(h)); }
  const ctx = scratch.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, scratch.width, scratch.height);
  return smooth(ctx);
}
/** 画像（または canvas）を暗くして描く。暗くするのは絵のある所だけ（透明な周りへ黒を塗らない）。 */
function drawDarkened(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh, bright) {
  if (bright >= 0.995) { ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh); return; }
  const w = Math.ceil(sw), h = Math.ceil(sh);
  const s = scratchOf(w, h);
  s.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  s.globalCompositeOperation = "source-atop";
  s.globalAlpha = 1 - bright;
  s.fillStyle = "#000";
  s.fillRect(0, 0, w, h);
  ctx.drawImage(scratch, 0, 0, sw, sh, dx, dy, dw, dh);
}

/**
 * 背景の層を、ステージの上 640（会話の窓が写す範囲）だけ scale 倍で1枚の絵にする（台・影・色調・ぼかし込み）。
 * 鍵が同じなら作り直さない。寄っても引いてもこの1枚を拡大縮小して重ねる。
 */
function buildLayerTile(layer, look, scale, pixel) {
  const canvas = canvasOf(STAGE_W * scale, VN_ROWS * scale);
  const ctx = smooth(canvas.getContext("2d"));
  ctx.fillStyle = layer.black ? "#07050b" : BASE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const [index, part] of layer.parts.entries()) {
    if (part.type === "ellipse") {
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.beginPath();
      ctx.ellipse(part.cx, part.cy, part.rx, part.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const entry = sourceFor(part.url);
    if (!entry.ready) continue;
    const [iw, ih] = sizeOf(entry.levels[0]);
    if (part.type === "cover") {
      const r = backgroundRect(part.box, iw, ih, part.size, part.pos);
      drawWhole(ctx, entry, r.x, r.y, r.w, r.h, scale);
    } else if (part.type === "image" && index === 0) {
      drawWhole(ctx, entry, part.x, part.y, part.w, part.h, scale);
    } else {
      // 店の台（切り抜きの絵）。夜の店内では台だけ暗くしている（brightness）。
      const [sx, sy, sw, sh] = part.type === "crop"
        ? (() => { const fx = iw / (part.full[0] || iw), fy = ih / (part.full[1] || ih); return [part.crop[0] * fx, part.crop[1] * fy, part.crop[2] * fx, part.crop[3] * fy]; })()
        : [0, 0, iw, ih];
      const level = levelFor(entry, part.w * scale / sw);
      const [lw] = sizeOf(level), f = lw / iw;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawDarkened(ctx, level, sx * f, sy * f, sw * f, sh * f, part.x * scale, part.y * scale, part.w * scale, part.h * scale, part.bright);
      ctx.restore();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  applyLook(canvas, look, pixel);
  return { canvas, scale };
}

/**
 * 立ち絵（切り抜きの絵）に柔らかい影を付けた絵。大きさ（ステージ上の w×h）と、写る行の範囲ごとに一度だけ作る。
 * rows: 絵の中で写る行（絵の上端から）の範囲 [r0, r1]（ステージ px）。scale: 1 ステージ px の画素数。
 */
function buildSpriteTile(entry, { w, h, r0, r1, flip }, scale, blur) {
  const pad = Math.ceil(blur * 1.6);
  const canvas = canvasOf(w * scale + pad * 2, (r1 - r0) * scale + pad * 2);
  const ctx = smooth(canvas.getContext("2d"));
  const [iw, ih] = sizeOf(entry.levels[0]);
  const sy = r0 / h * ih, sh = (r1 - r0) / h * ih;
  const level = levelFor(entry, w * scale / iw);
  const [lw] = sizeOf(level), f = lw / iw;
  if (flip) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.shadowColor = "rgba(16, 6, 26, 0.55)";
  ctx.shadowBlur = blur;
  ctx.drawImage(level, 0, sy * f, iw * f, sh * f, pad, pad, w * scale, (r1 - r0) * scale);
  return { canvas, scale, pad, r0 };
}

// ---------------------------------------------------------------- 描く

export function createHdPainter(canvas, { dotScale = () => 1 } = {}) {
  const stats = { jobs: 0, ms: 0, slowest: 0, frames: 0 };
  let ctx = smooth(canvas.getContext("2d"));
  let shownSig = "", lastPaint = -Infinity, presented = false, waitingSince = 0, budgetLeft = BUDGET_MS;
  // 寄り・引き: from → to を ZOOM_MS かけて動かす
  let view = null, zoomFrom = null, zoomTo = null, zoomAt = 0;
  // 場面の切り替え: 前の絵（fade）を FADE_MS かけて薄くする
  const fade = { canvas: null, at: 0, on: false };
  let bgLookKey = "";

  const deviceRatio = () => window.devicePixelRatio || 1;

  /** いまの canvas の絵を、クロスフェードの元として写しておく。 */
  function startFade(now, keep) {
    if (reduced()) { fade.on = false; return; }
    fade.canvas ||= canvasOf(canvas.width, canvas.height);
    if (fade.canvas.width !== canvas.width || fade.canvas.height !== canvas.height) { fade.canvas.width = canvas.width; fade.canvas.height = canvas.height; }
    const f = fade.canvas.getContext("2d");
    f.globalAlpha = 1;
    f.fillStyle = BASE;
    f.fillRect(0, 0, fade.canvas.width, fade.canvas.height);
    if (keep && presented) f.drawImage(canvas, 0, 0);
    fade.at = now; fade.on = true;
  }
  const fadeLevel = (now) => (fade.on ? Math.min(1, (now - fade.at) / FADE_MS) : 1);

  /** 作る物を、時間の目安の中で作る。作れなかったら null（次のフレームで続ける）。 */
  function tileFor(key, make) {
    const hit = tiles.get(key);
    if (hit) { tiles.delete(key); tiles.set(key, hit); return hit; }
    if (budgetLeft <= 0) return null;
    const began = performance.now();
    let tile = null;
    try { tile = make(); } catch (error) { console.warn("[retro-hd] 絵を作れませんでした", key, error); }
    const took = performance.now() - began;
    budgetLeft -= took;
    stats.jobs++; stats.ms += took; stats.slowest = Math.max(stats.slowest, took);
    return tile ? remember(key, tile) : null;
  }

  /** 1 フレームを描くか決める。sig が同じで動きも無ければ描かない。描いたら true。 */
  function frame(now, sig, animating, draw) {
    if (sig === shownSig && !animating) return false;
    if (now - lastPaint < FRAME_MS) return false;
    budgetLeft = BUDGET_MS;
    if (canvas.width !== ctx.canvas.width) ctx = smooth(canvas.getContext("2d"));
    // 絵がそろうまでは前の絵のままにしておく（立ち絵が一瞬消えて見えないように）。待ちすぎたら、そろった分だけで描く
    const plan = draw(false);
    if (!plan.ready && presented && (!waitingSince || now - waitingSince < WAIT_MS)) {
      waitingSince ||= now;
      return false;
    }
    waitingSince = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = BASE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    smooth(ctx);
    plan.paint(ctx);
    if (fade.on) {
      const t = fadeLevel(now);
      if (t < 1) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1 - ease(t);
        ctx.drawImage(fade.canvas, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      } else fade.on = false;
    }
    lastPaint = now;
    shownSig = plan.complete ? sig : "";
    presented = true;
    stats.frames++;
    return true;
  }

  /** 窓 at（ステージ座標）を canvas へ写す変換の倍率。 */
  const zoomOf = (at) => canvas.width / at.w;

  /** 背景の層を描く準備。会話（vn=true）は人物の有無で暗さ・ぼかしを変え、作った1枚を窓へ重ねる。 */
  function backgroundPlan(layers, at, { person = false, rainy = false, vn = true } = {}) {
    const steps = [];
    let ready = true, complete = true;
    const z = zoomOf(at);
    // 会話の背景の絵は、引いた窓（WIDE）で 1:1 になる大きさで作る（寄った時はぼかしているので拡大で足りる）
    const scale = canvas.width / WIDE.w;
    const keys = [];
    for (const layer of layers) {
      const opacity = Math.round(layer.opacity * 50) / 50;
      if (opacity <= 0) continue;
      const urls = layer.parts.filter((part) => part.url).map((part) => part.url);
      const entries = urls.map(sourceFor);
      if (!entries.every((entry) => entry.ready || entry.failed)) { ready = false; complete = false; continue; }
      if (!vn) {
        // 地図・行動選び: 絵そのままを窓へ描く（暗くもぼかしもしない）
        steps.push((c) => {
          c.save();
          c.globalAlpha = opacity;
          if (layer.black) { c.fillStyle = "#07050b"; c.fillRect(0, 0, canvas.width, canvas.height); }
          c.setTransform(z, 0, 0, z, -at.x * z, -at.y * z);
          for (const [index, part] of layer.parts.entries()) {
            const entry = part.url ? sourceFor(part.url) : null;
            if (part.type === "ellipse" || !entry?.ready) continue;
            const [iw, ih] = sizeOf(entry.levels[0]);
            if (part.type === "cover") { const r = backgroundRect(part.box, iw, ih, part.size, part.pos); drawWhole(c, entry, r.x, r.y, r.w, r.h, z); }
            else if (part.type === "image" && index === 0) drawWhole(c, entry, part.x, part.y, part.w, part.h, z);
            else if (part.type === "image") drawWhole(c, entry, part.x, part.y, part.w, part.h, z);
            else { const fx = iw / (part.full[0] || iw), fy = ih / (part.full[1] || ih); drawPart(c, entry, part.crop[0] * fx, part.crop[1] * fy, part.crop[2] * fx, part.crop[3] * fy, part.x, part.y, part.w, part.h, z); }
          }
          if (rainy) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.18 * opacity; c.fillStyle = "rgb(40,52,72)"; c.fillRect(0, 0, canvas.width, canvas.height); }
          c.restore();
        });
        keys.push(`${JSON.stringify(layer.parts)}|${layer.black}|${opacity}`);
        continue;
      }
      const look = lookOf(layer, person, rainy);
      const key = `layer|${JSON.stringify([layer.parts, layer.black, layer.tint])}|${JSON.stringify(look)}|${round(scale, 3)}`;
      // 作る絵の 1 画素 ≒ 実機の 1 画素（引いた窓の時）なので、ぼかしは CSS の px × devicePixelRatio
      const tile = tileFor(key, () => buildLayerTile(layer, look, scale, deviceRatio()));
      if (!tile) { ready = false; complete = false; continue; }
      keys.push(`${key}|${opacity}`);
      steps.push((c) => {
        c.save();
        c.globalAlpha = opacity;
        const k = z / tile.scale;
        c.setTransform(k, 0, 0, k, -at.x * z, -at.y * z);
        c.drawImage(tile.canvas, 0, 0);
        c.restore();
      });
    }
    return { steps, ready, complete, keys };
  }

  /** 立ち絵を描く準備。影つきの絵は「寄った時の大きさ」で一度作り、引いた時は縮めて重ねる。 */
  function spritePlan(sprites, at) {
    const steps = [], keys = [];
    let ready = true;
    const z = zoomOf(at);
    const scale = canvas.width / WIDE.w * ZOOM_IN; // 寄った時の 1 ステージ px の画素数（作る絵の 1 画素 ≒ 寄った時の実機の 1 画素）
    const blur = 14 * deviceRatio(); // 柔らかい影の広がり（CSS の 14px ぶん。仮組みと同じ）
    for (const sprite of sprites) {
      const entry = sourceFor(sprite.url);
      if (!entry.ready) { ready &&= entry.failed; continue; }
      const w = Math.round(sprite.w), h = Math.round(sprite.h);
      // 写る行（ステージの上から 640 まで）だけを作る。少しの上下の動きでは作り直さないよう 64 刻みで余白を取る
      const r0 = Math.max(0, Math.floor((-sprite.y - 48) / 64) * 64);
      const r1 = Math.min(h, Math.ceil((VN_ROWS - sprite.y + 48) / 64) * 64);
      if (r1 <= r0) continue;
      const spec = { w, h, r0, r1, flip: !!sprite.flip };
      const key = `sprite|${sprite.url}|${w}x${h}|${r0}-${r1}|${spec.flip ? 1 : 0}|${round(scale, 3)}`;
      const tile = tileFor(key, () => buildSpriteTile(entry, spec, scale, blur));
      if (!tile) { ready = false; continue; }
      const opacity = Math.round(sprite.opacity * 50) / 50, bright = Math.round(sprite.bright * 50) / 50;
      keys.push(`${key}@${round(sprite.x, 1)},${round(sprite.y, 1)}|${opacity}|${bright}`);
      steps.push((c) => {
        const k = z / tile.scale;
        const dx = (sprite.x - at.x) * z - tile.pad * k, dy = (sprite.y + tile.r0 - at.y) * z - tile.pad * k;
        c.save();
        c.globalAlpha = opacity;
        drawDarkened(c, tile.canvas, 0, 0, tile.canvas.width, tile.canvas.height, dx, dy, tile.canvas.width * k, tile.canvas.height * k, bright);
        c.restore();
      });
    }
    return { steps, ready, keys };
  }

  function cgPlan(cg, at) {
    if (!cg) return { steps: [], ready: true, keys: [] };
    const entry = sourceFor(cg.url);
    if (!entry.ready) return { steps: [], ready: entry.failed, keys: [] };
    const z = zoomOf(at), opacity = Math.round(cg.opacity * 50) / 50;
    const [iw, ih] = sizeOf(entry.levels[0]);
    const r = backgroundRect(cg.box, iw, ih, cg.size, cg.pos);
    return {
      ready: true, keys: [`cg|${cg.url}|${JSON.stringify([cg.box, cg.size, cg.pos])}|${opacity}`],
      steps: [(c) => {
        c.save();
        c.globalAlpha = opacity;
        c.setTransform(z, 0, 0, z, -at.x * z, -at.y * z);
        c.fillStyle = cg.color && cg.color !== "rgba(0, 0, 0, 0)" ? cg.color : "#000";
        c.fillRect(cg.box.x, cg.box.y, cg.box.w, cg.box.h);
        c.beginPath(); c.rect(cg.box.x, cg.box.y, cg.box.w, cg.box.h); c.clip();
        drawWhole(c, entry, r.x, r.y, r.w, r.h, z);
        c.restore();
      }],
    };
  }

  /**
   * 窓がステージ（絵）の外まで広がる時（行き先が左右に広く散らばった地図）の余白。現行の画面の余白（#backdrop）と同じく、
   * 同じ絵を大きくぼかして暗くした面で埋める（黒い帯にしない）。
   */
  let blurry = null;
  function backdrop(c, layers, at) {
    if (at.x >= -0.5 && at.y >= -0.5 && at.x + at.w <= STAGE_W + 0.5 && at.y + at.h <= STAGE_H + 0.5) return;
    const part = layers.find((layer) => layer.opacity > 0.5)?.parts.find((p) => p.url && (p.type === "cover" || p.type === "image"));
    const entry = part ? sourceFor(part.url) : null;
    if (!entry?.ready) return;
    blurry ||= canvasOf(48, 36);
    const b = smooth(blurry.getContext("2d"));
    const [iw, ih] = sizeOf(entry.levels[0]);
    const s = Math.max(blurry.width / iw, blurry.height / ih);
    b.clearRect(0, 0, blurry.width, blurry.height);
    drawWhole(b, entry, (blurry.width - iw * s) / 2, (blurry.height - ih * s) / 2, iw * s, ih * s, 1);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    smooth(c).drawImage(blurry, 0, 0, canvas.width, canvas.height);
    c.globalAlpha = 0.5;
    c.fillStyle = "#0a0612";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.restore();
  }

  /** 回想（白黒）・セピア。重ね終えた絵の上に、彩度と色の重ね塗りで掛ける。 */
  function tone(c, mode) {
    if (!mode) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "saturation";
    c.fillStyle = "#808080";
    c.fillRect(0, 0, canvas.width, canvas.height);
    if (mode === "sepia") {
      c.globalCompositeOperation = "color";
      c.globalAlpha = 0.6;
      c.fillStyle = "rgb(150,110,70)";
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    c.restore();
  }

  /** 会話の上画面の下端を少し沈める（下画面との境目をなじませる・仮組みと同じ）。 */
  function settle(c) {
    const g = c.createLinearGradient(0, canvas.height * 0.74, 0, canvas.height);
    g.addColorStop(0, "rgba(19,12,32,0)");
    g.addColorStop(1, "rgba(19,12,32,0.42)");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.fillStyle = g;
    c.fillRect(0, canvas.height * 0.74, canvas.width, canvas.height * 0.26);
  }

  /** 会話の窓: 目的の窓が変わったら、今の窓から滑らかに動かす（動きを減らす設定では即時）。 */
  function viewFor(now, target) {
    if (!view || reduced()) { view = target; zoomFrom = zoomTo = target; return { at: target, moving: false }; }
    if (!sameView(target, zoomTo)) { zoomFrom = currentView(now); zoomTo = target; zoomAt = now; }
    return { at: (view = currentView(now)), moving: !sameView(view, zoomTo) };
  }
  function currentView(now) {
    if (!zoomFrom || !zoomTo) return view;
    const t = Math.min(1, (now - zoomAt) / ZOOM_MS);
    if (t >= 1) return zoomTo;
    const e = ease(t);
    const w = zoomFrom.w + (zoomTo.w - zoomFrom.w) * e;
    return { x: zoomFrom.x + (zoomTo.x - zoomFrom.x) * e, y: zoomFrom.y + (zoomTo.y - zoomFrom.y) * e, w, h: w * 3 / 4 };
  }

  return {
    /** 会話: 背景（人物がいれば暗く・ぼかす）・立ち絵（柔らかい影）・一枚絵。一人の場面は人物へ寄る。 */
    paintVn(now) {
      const metrics = stageMetrics();
      const { sprites, focus } = readPortraits(metrics);
      const vn = document.getElementById("vn");
      const mode = vn?.classList.contains("flashback") ? "gray" : vn?.classList.contains("sepia") ? "sepia" : "";
      const layers = readBackgrounds(metrics);
      const cg = readCg(metrics);
      const target = conversationView(focus, cg);
      const { at, moving } = viewFor(now, target);
      canvas.dataset.zoom = String(round(WIDE.w / zoomTo.w, 2));
      const person = sprites.length > 0;
      const rainy = document.body.dataset.weather === "outdoor" && document.body.dataset.weatherSky === "day";
      // 人物が出入りして背景の暗さ・ぼかしが変わる時は、前の絵からクロスフェードでつなぐ
      const lookKey = `${person}|${rainy}`;
      if (bgLookKey && lookKey !== bgLookKey && presented) startFade(now, true);
      bgLookKey = lookKey;
      const fading = fade.on; // 薄くし終えた最後の1枚（前の絵が残らない絵）を描くまで続ける
      const sig = `vn|${canvas.width}x${canvas.height}|${viewKey({ x: round(at.x, 1), y: round(at.y, 1), w: round(at.w, 1) })}|${mode}|${version}|${JSON.stringify([layers.map((l) => [l.parts, l.opacity, l.tint, l.black]), sprites, cg])}`;
      const painted = frame(now, sig, moving || fading, () => {
        const bg = backgroundPlan(layers, at, { person, rainy });
        const sp = spritePlan(sprites, at);
        const art = cgPlan(cg, at);
        return {
          ready: bg.ready && sp.ready && art.ready,
          complete: bg.complete && sp.ready && art.ready,
          paint: (c) => {
            for (const step of [...bg.steps, ...sp.steps, ...art.steps]) step(c);
            tone(c, mode);
            settle(c);
          },
        };
      });
      return painted;
    },

    /** 地図・行動選び: 窓 at（ステージ座標）の絵をそのまま高解像度で写す。雨の日は少し青く沈める。 */
    paintMap(now, at, rainy) {
      const layers = readBackgrounds(stageMetrics());
      const fading = fade.on; // 薄くし終えた最後の1枚（前の絵が残らない絵）を描くまで続ける
      const sig = `map|${canvas.width}x${canvas.height}|${viewKey(at)}|${rainy}|${version}|${JSON.stringify(layers.map((l) => [l.parts, l.opacity, l.black]))}`;
      return frame(now, sig, fading, () => {
        const bg = backgroundPlan(layers, at, { rainy: !!rainy, vn: false });
        return { ready: bg.ready, complete: bg.complete, paint: (c) => { backdrop(c, layers, at); for (const step of bg.steps) step(c); } };
      });
    },

    /** タイトル: キャラクターの絵を上画面いっぱいに（cover・上寄り）、ロゴの画像を左上へ。 */
    paintTitle(now, { art, logo }) {
      const layers = readBackgrounds(stageMetrics());
      const fading = fade.on; // 薄くし終えた最後の1枚（前の絵が残らない絵）を描くまで続ける
      const sig = `title|${canvas.width}x${canvas.height}|${version}|${JSON.stringify([art, logo, layers.map((l) => [l.parts, l.opacity])])}`;
      return frame(now, sig, fading, () => {
        const artEntry = art?.url ? sourceFor(art.url) : null;
        const logoEntry = logo?.url ? sourceFor(logo.url) : null;
        const bg = backgroundPlan(layers, { x: 0, y: 0, w: STAGE_H * 4 / 3, h: STAGE_H }, { vn: false });
        const pixel = canvas.width / W;
        let logoTile = null;
        if (logoEntry?.ready) {
          const [iw, ih] = sizeOf(logoEntry.levels[0]);
          const lw = Math.round(112 * pixel), lh = Math.round(lw * ih / iw);
          logoTile = tileFor(`logo|${logo.url}|${lw}`, () => {
            const blur = 5 * pixel, pad = Math.ceil(blur * 1.6);
            const c = canvasOf(lw + pad * 2, lh + pad * 2);
            const x = smooth(c.getContext("2d"));
            x.shadowColor = "rgba(10, 4, 20, 0.85)";
            x.shadowBlur = blur;
            x.shadowOffsetY = pixel;
            drawWhole(x, logoEntry, pad, pad, lw, lh);
            return { canvas: c, pad };
          });
        }
        const ready = bg.ready && (!artEntry || artEntry.ready || artEntry.failed) && (!logoEntry || logoEntry.failed || !!logoTile);
        return {
          ready, complete: ready,
          paint: (c) => {
            if (artEntry?.ready) {
              const [iw, ih] = sizeOf(artEntry.levels[0]);
              const s = Math.max(canvas.width / iw, canvas.height / ih);
              c.globalAlpha = art.opacity;
              // 縦長の絵を 4:3 に入れるので上下が切れる。顔がロゴの下に来るよう、上寄り（上から 1 割）で切る
              drawWhole(c, artEntry, (canvas.width - iw * s) / 2, (canvas.height - ih * s) * 0.1, iw * s, ih * s);
              c.globalAlpha = 1;
            } else for (const step of bg.steps) step(c);
            if (logoTile) {
              // ロゴの後ろだけ、左上から少し暗くして読みやすくする
              const g = c.createLinearGradient(0, 0, canvas.width * 0.6, canvas.height * 0.45);
              g.addColorStop(0, "rgba(10,4,20,0.5)");
              g.addColorStop(1, "rgba(10,4,20,0)");
              c.fillStyle = g;
              c.fillRect(0, 0, canvas.width, canvas.height);
              c.drawImage(logoTile.canvas, Math.round(8 * pixel) - logoTile.pad, Math.round(7 * pixel) - logoTile.pad);
            }
          },
        };
      });
    },

    /**
     * 覆い（場面転換・日付の札・章タイトル・詩・登場カットイン）: 暗い画面に、覆いの中に見えている絵だけを高解像度で写す。
     * 切り抜きの絵（人物）があればそれを中心にした 4:3、無ければステージ全体（上下に帯）を写す（DS風と同じ窓）。
     */
    paintCover(now, images) {
      const fading = fade.on; // 薄くし終えた最後の1枚（前の絵が残らない絵）を描くまで続ける
      const ready = [];
      let complete = true, focus = null;
      for (const image of images) {
        const entry = sourceFor(image.url);
        if (!entry.ready) { complete &&= entry.failed; continue; }
        ready.push([image, entry]);
        if (entry.alpha) focus ??= image.x + image.w / 2;
      }
      const at = focus === null ? { x: 0, y: -120, w: STAGE_W, h: STAGE_W * 3 / 4 }
        : { x: Math.round(Math.max(0, Math.min(STAGE_W - 960, focus - 480))), y: 0, w: 960, h: STAGE_H };
      const sig = `cover|${canvas.width}x${canvas.height}|${version}|${JSON.stringify(images)}`;
      return frame(now, sig, fading, () => ({
        ready: complete, complete,
        paint: (c) => {
          const z = zoomOf(at);
          for (const [image, entry] of ready) {
            if (image.opacity <= 0.02) continue;
            c.save();
            c.setTransform(z, 0, 0, z, -at.x * z, -at.y * z);
            c.globalAlpha = Math.min(1, image.opacity);
            if (image.clip) { c.beginPath(); c.rect(image.clip.x, image.clip.y, image.clip.w, image.clip.h); c.clip(); }
            if (image.backing) {
              const b = image.backing, color = b.color >>> 0;
              c.fillStyle = `rgb(${color & 255},${(color >> 8) & 255},${(color >> 16) & 255})`;
              c.fillRect(b.x, b.y, b.w, b.h);
            }
            const [iw, ih] = sizeOf(entry.levels[0]);
            if (!entry.alpha && (image.fit === "cover" || image.fit === "contain")) {
              const r = backgroundRect({ x: image.x, y: image.y, w: image.w, h: image.h }, iw, ih, image.fit, image.pos);
              c.beginPath(); c.rect(image.x, image.y, image.w, image.h); c.clip();
              drawWhole(c, entry, r.x, r.y, r.w, r.h, z);
            } else drawWhole(c, entry, image.x, image.y, image.w, image.h, z);
            c.restore();
          }
        },
      }));
    },

    /** 顔アイコンなど: 実機の画素に合わせた大きさの canvas へ、高品質に縮めて描く。読めたら true。 */
    drawIcon(target, url) {
      const entry = sourceFor(url);
      if (!entry.ready) return false;
      const dots = Number(target.dataset.dots || target.width) || 24;
      target.dataset.dots = String(dots);
      const size = Math.max(1, Math.round(dots * dotScale()));
      if (target.width !== size) { target.width = size; target.height = size; }
      const c = smooth(target.getContext("2d"));
      c.clearRect(0, 0, size, size);
      return drawWhole(c, entry, 0, 0, size, size);
    },

    /**
     * 場面が切り替わった時に呼ぶ。keep=true なら今の絵から、false なら暗い画面からクロスフェードで次の絵へつなぐ
     * （外枠を出し直した時は、前の場面の絵を一瞬見せない）。
     */
    enter(keep = false) {
      const now = performance.now();
      startFade(now, keep);
      if (!keep) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.fillStyle = BASE;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        presented = false;
      }
      shownSig = "";
      view = null; zoomFrom = zoomTo = null;
      bgLookKey = "";
      delete canvas.dataset.zoom;
    },
    /** canvas の大きさを変えた直後に呼ぶ（次の機会に描き直す）。 */
    refresh() {
      shownSig = "";
      fade.on = false;
      ctx = smooth(canvas.getContext("2d"));
    },
    stats,
    get version() { return version; },
    dispose() {
      for (const entry of sources.values()) { entry.dropped = true; entry.levels?.[0]?.close?.(); entry.levels = null; }
      sources.clear();
      tiles.clear();
      scratch = null;
      probe = null;
      fade.canvas = null;
    },
  };
}
