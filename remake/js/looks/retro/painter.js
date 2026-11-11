// 上画面（256×192）の絵。現行ステージ（固定 1280×720）の背景・一枚絵・立ち絵を読み、ドット絵らしく作り直して写す。
// 画像は現行が読み込んだものと同じ URL（同一オリジン）を使う。新しい素材は作らない。
// 作り方（retro/dot.js）: 絵ごとに一度だけ「面積平均で縮小 → 輪郭強調 → 色数を絞る」を行って覚え（鍵は 画像URL＋大きさ＋窓）、
// 毎フレームは覚えた絵を整数ドットの位置へ重ねるだけにする。不透明度は網点（Bayer）の抜きで表し、中間色を作らない。
// 重い処理は 1 フレームあたりの時間を区切って進め、終わるまでは前の絵を出しておく（会話の進行を止めない）。
import { SCREEN_W as W, SCREEN_H as H } from "./shell.js";
import { BAYER4, halve, contrast, unsharp, medianCut, makePalette, ditherSnap, snap, sampleColors, darken } from "./dot.js";
import {
  STAGE_W, STAGE_H, round, stageMetrics, backgroundRect, readBackgrounds, readPortraits, readCg,
  WIDE, viewKey, sameView, mixView, conversationView,
} from "./stage-read.js";

const CACHE_MAX = 10;
const cache = new Map(); // url → { img, ready, failed, levels }
let version = 0;         // 画像が読めるたびに進める（描き直しの合図）
const SS = 2;            // 2倍の大きさで描いてから 2×2 の平均で縮める（面積平均）
const TILE_MAX = 72, PALETTE_MAX = 48;
const BG_COLORS = 64, SPRITE_COLORS = 48, PROP_COLORS = 24;
const BUDGET_MS = 9;     // 1 フレームで重い処理に使う時間の目安
const STEP_MS = 70;      // 窓の切り替え（寄り・引き）の 1 コマ
const BASE_COLOR = 0xff12080b; // #0b0812（ステージの地の色）

const size = (source) => [source.naturalWidth || source.width, source.naturalHeight || source.height];
const SOURCE_MAX = 1280; // 元の絵として覚えておく大きさの上限（長い辺）。上画面はこれより細かい所を使わない

/**
 * 画像を読む。展開（decode）は fetch → createImageBitmap で裏のスレッドに任せ、絵を作る処理へ待ちを持ち込まない
 * （<img> を canvas へ最初に描く時の展開は、1枚あたり数十ミリ秒かかる）。使えない環境では <img> で読む。
 */
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

/** 読めた絵を、画素を読みやすい canvas（CPU 側）へ写して覚える。大きすぎる絵は SOURCE_MAX まで縮めておく。 */
function sourceCanvas(source) {
  const [w, h] = size(source);
  const scale = Math.min(1, SOURCE_MAX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  return canvas;
}

/** 透明な所のある絵（切り抜きの絵）かどうか。小さく縮めた絵の不透明度で見る。 */
function hasAlpha(canvas) {
  const ctx = workContext(24, 24);
  ctx.drawImage(canvas, 0, 0, 24, 24);
  const data = ctx.getImageData(0, 0, 24, 24).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
}

function entryFor(url) {
  let entry = cache.get(url);
  if (entry) { cache.delete(url); cache.set(url, entry); return entry; }
  entry = { url, ready: false, failed: false, dropped: false, levels: null };
  loadSource(url).then((source) => {
    if (entry.dropped) { source.close?.(); return; }
    entry.levels = [sourceCanvas(source)];
    entry.alpha = hasAlpha(entry.levels[0]);
    entry.ready = true;
    version++;
  }, () => { entry.failed = true; version++; });
  cache.set(url, entry);
  while (cache.size > CACHE_MAX) {
    const [oldUrl, old] = cache.entries().next().value;
    old.dropped = true;
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
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

// ---------------------------------------------------------------- 絵を作る（重い処理。絵ごとに一度だけ）

let work = null; // 2倍で描いて画素を読むための作業用 canvas
function workContext(w, h) {
  work ||= document.createElement("canvas");
  if (work.width !== w || work.height !== h) { work.width = w; work.height = h; }
  const ctx = work.getContext("2d", { willReadFrequently: true });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

const tiles = new Map();    // 鍵 → { w, h, px(Uint32Array) }
const palettes = new Map(); // 鍵 → 色の組
const EMPTY = { w: 0, h: 0, px: new Uint32Array(0) };
function remember(map, key, value, max) {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) map.delete(map.keys().next().value);
  return value;
}
const paletteFor = (key, build) => palettes.get(key) || remember(palettes, key, makePalette(build()), PALETTE_MAX);

const PLAIN = Object.freeze({ bright: 1, tint: "", rainy: false });

/** 夜・暗がり・雨の色（base.css の .bg-img[data-tint] など）を、色数を絞る前の絵へ重ねる。 */
function applyTint(ctx, w, h, { bright = 1, tint = "", rainy = false }) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const shade = (color, alpha) => { if (alpha > 0) { ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; } };
  shade("#000", 1 - bright);
  if (tint === "night") shade("rgb(12,14,48)", 0.5);
  if (rainy) shade("rgb(40,52,72)", 0.28);
}

/** 絵まるごとの色から、背景用の色の組を作る（窓を寄せても同じ組を使うので、コマ送りの間に色が揺れない）。 */
function imagePalette(entry, look) {
  return paletteFor(`bg|${entry.url}|${look.bright}|${look.tint}|${look.rainy}`, () => {
    const [iw, ih] = size(entry.levels[0]);
    const scale = Math.min(1, 320 / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
    const ctx = workContext(w, h);
    drawWhole(ctx, entry, 0, 0, w, h, 1);
    applyTint(ctx, w, h, look);
    return medianCut(sampleColors(ctx.getImageData(0, 0, w, h).data, 16000, 1), BG_COLORS);
  });
}

/** 切り抜きの絵（立ち絵・店の台・ロゴ）の色の組。原寸に近い段の、輪郭を除いた不透明な所から作る。 */
function spritePalette(entry, colors) {
  return paletteFor(`sp|${entry.url}|${colors}`, () => {
    let level = entry.levels[0];
    for (let n = 1; n < 6; n++) {
      const [lw, lh] = size(level);
      if (lw * lh <= 300000) break;
      level = levelFor(entry, 1 / 2 ** n);
    }
    const [lw, lh] = size(level);
    const ctx = workContext(lw, lh);
    ctx.drawImage(level, 0, 0);
    return medianCut(sampleColors(ctx.getImageData(0, 0, lw, lh).data, 40000, 250), colors);
  });
}

/** 背景の処方: 面積平均（2倍で描いた絵の 2×2 平均）→ コントラスト → 輪郭強調 → 網点 → 色の組へ。 */
function finishBackground(ctx, w, h, palette) {
  const { rgb } = halve(ctx.getImageData(0, 0, w * SS, h * SS).data, w, h);
  contrast(rgb, 1.06);
  unsharp(rgb, w, h, 0.96, 2);
  return { w, h, px: ditherSnap(rgb, w, h, palette, 16) };
}

/** 背景1枚（絵・台の影・色調）を、窓 view で 256×192 の絵にする。 */
function buildBackgroundTile({ base, shadows, look, black }, view) {
  const entry = base ? entryFor(base.url) : null;
  // 色の組を作るのにも同じ作業用 canvas を使うので、絵を描く前に用意しておく
  const palette = entry?.ready ? imagePalette(entry, look) : makePalette(Uint8Array.of(11, 8, 18, 7, 5, 11));
  const ctx = workContext(W * SS, H * SS);
  ctx.fillStyle = black ? "#07050b" : "#0b0812";
  ctx.fillRect(0, 0, W * SS, H * SS);
  const zoom = W / view.w * SS;
  ctx.setTransform(zoom, 0, 0, zoom, -view.x * zoom, -view.y * zoom);
  if (entry?.ready) {
    const [iw, ih] = size(entry.levels[0]);
    const r = base.type === "cover" ? backgroundRect(base.box, iw, ih, base.size, base.pos) : base;
    drawWhole(ctx, entry, r.x, r.y, r.w, r.h, zoom);
  }
  ctx.fillStyle = "rgba(0,0,0,0.24)";
  for (const s of shadows) { ctx.beginPath(); ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2); ctx.fill(); }
  applyTint(ctx, W * SS, H * SS, look);
  return finishBackground(ctx, W, H, palette);
}

/** 一枚絵（.vn-cg）を、窓 view で 256×192 の絵にする。 */
function buildCgTile(cg, view) {
  const entry = entryFor(cg.url);
  const palette = entry.ready ? imagePalette(entry, PLAIN) : makePalette(Uint8Array.of(0, 0, 0, 11, 8, 18));
  const ctx = workContext(W * SS, H * SS);
  ctx.fillStyle = "#0b0812";
  ctx.fillRect(0, 0, W * SS, H * SS);
  const zoom = W / view.w * SS;
  ctx.setTransform(zoom, 0, 0, zoom, -view.x * zoom, -view.y * zoom);
  ctx.fillStyle = cg.color && cg.color !== "rgba(0, 0, 0, 0)" ? cg.color : "#000";
  ctx.fillRect(cg.box.x, cg.box.y, cg.box.w, cg.box.h);
  if (!entry.ready) return finishBackground(ctx, W, H, palette);
  const [iw, ih] = size(entry.levels[0]);
  const r = backgroundRect(cg.box, iw, ih, cg.size, cg.pos);
  ctx.save();
  ctx.beginPath(); ctx.rect(cg.box.x, cg.box.y, cg.box.w, cg.box.h); ctx.clip();
  drawWhole(ctx, entry, r.x, r.y, r.w, r.h, zoom);
  ctx.restore();
  return finishBackground(ctx, W, H, palette);
}

/** 枠 w×h へ cover（位置 px・py は 0〜1）で入れた絵を、背景の処方で作る（タイトルのキャラクターの絵）。 */
function buildCoverTile(url, w, h, px, py) {
  const entry = entryFor(url);
  if (!entry.ready) return EMPTY;
  const palette = imagePalette(entry, PLAIN);
  const ctx = workContext(w * SS, h * SS);
  const [iw, ih] = size(entry.levels[0]);
  const scale = Math.max(w / iw, h / ih);
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  drawWhole(ctx, entry, (w - iw * scale) * px, (h - ih * scale) * py, iw * scale, ih * scale, SS);
  return finishBackground(ctx, w, h, palette);
}

/** 枠 w×h へ object-fit（fill / cover / contain）で入れた不透明の絵を、背景の処方で作る（覆いの中の <img>）。 */
function buildBoxTile(url, w, h, fit, pos) {
  const entry = entryFor(url);
  if (!entry.ready) return EMPTY;
  const palette = imagePalette(entry, PLAIN);
  const ctx = workContext(w * SS, h * SS);
  ctx.fillStyle = "#0b0812";
  ctx.fillRect(0, 0, w * SS, h * SS);
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  const [iw, ih] = size(entry.levels[0]);
  if (fit === "cover" || fit === "contain") {
    const r = backgroundRect({ x: 0, y: 0, w, h }, iw, ih, fit, pos);
    drawWhole(ctx, entry, r.x, r.y, r.w, r.h, SS);
  } else drawWhole(ctx, entry, 0, 0, w, h, SS);
  return finishBackground(ctx, w, h, palette);
}

/**
 * 切り抜きの絵を dw×dh ドットへ縮め、row0 から rows 行ぶんを立ち絵の処方で作る。
 * crop（元画像の中の矩形）があればその範囲だけを使う。flip は左右反転。
 */
function buildSpriteTile({ url, dw, dh, row0 = 0, rows = dh, flip = false, crop = null, colors = SPRITE_COLORS }) {
  const entry = entryFor(url);
  if (!entry.ready || rows <= 0) return EMPTY;
  const ctx = workContext(dw * SS, rows * SS);
  ctx.setTransform(flip ? -SS : SS, 0, 0, SS, flip ? dw * SS : 0, -row0 * SS);
  if (crop) drawPart(ctx, entry, crop[0], crop[1], crop[2], crop[3], 0, 0, dw, dh, SS);
  else drawWhole(ctx, entry, 0, 0, dw, dh, SS);
  const { rgb, alpha } = halve(ctx.getImageData(0, 0, dw * SS, rows * SS).data, dw, rows);
  unsharp(rgb, dw, rows, 1.08, 2, alpha);
  return { w: dw, h: rows, px: snap(rgb, alpha, dw, rows, spritePalette(entry, colors)) };
}

// ---------------------------------------------------------------- 重ねる

// 不透明度は 16 段の網点の抜きで表す。ほぼ不透明（0.9 以上。タイトルの絵は 0.95）は抜かない。
const opacityLevel = (opacity) => (opacity >= 0.9 ? 16 : Math.max(0, Math.min(15, Math.round(opacity * 16))));
const brightStep = (bright) => Math.round(Math.max(0, Math.min(1, bright)) * 8) / 8;

export function createPainter(canvas) {
  const small = document.createElement("canvas");
  small.width = W; small.height = H;
  const smallCtx = small.getContext("2d");
  const frame = smallCtx.createImageData(W, H);
  const out = new Uint32Array(frame.data.buffer);
  let shownSig = "", wanted = [], fresh = true;
  // 場面の切り替えは網点のコマ送り: 新しい絵を 4/16 ずつ出していく。from は切り替え前の絵（無ければ暗い画面）
  let veil = null;
  const veilTag = (now) => {
    if (!veil) return "";
    if (now - veil.last >= STEP_MS) { veil.level = Math.min(16, veil.level + 4); veil.last = now; }
    return `|v${veil.level}`;
  };
  const stats = { jobs: 0, ms: 0, slowest: 0, frames: 0 }; // 重い処理の回数と時間（確認用）
  // 会話の窓: view＝いま出している窓、plan＝目的の窓までのコマ
  let view = null, plan = [], planTarget = null, lastStep = 0;

  function present() {
    smallCtx.putImageData(frame, 0, 0);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false; // 1ドット＝整数画素の裏画面へ、補間なしで拡大する
    ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  }

  /** 覚えた絵を返す。まだ無ければ「作る物」に積んで null を返す（request=false なら積まない）。 */
  function tileFor(key, urls, make, request = true) {
    const hit = tiles.get(key);
    if (hit) { tiles.delete(key); tiles.set(key, hit); return hit; }
    if (request) wanted.push({ key, urls, make });
    return null;
  }
  /** 積んだ物を、時間を区切って作る（元の画像が読めていない物は後回し）。 */
  function pump() {
    const started = performance.now();
    for (const job of wanted) {
      if (tiles.has(job.key)) continue;
      const entries = job.urls.map(entryFor);
      if (!entries.every((entry) => entry.ready || entry.failed)) continue;
      let tile = EMPTY;
      const began = performance.now();
      try { tile = job.make() || EMPTY; } catch (error) { console.warn("[retro] 絵を作れませんでした", job.key, error); }
      remember(tiles, job.key, tile, TILE_MAX);
      const took = performance.now() - began;
      stats.jobs++; stats.ms += took; stats.slowest = Math.max(stats.slowest, took);
      if (performance.now() - started > BUDGET_MS) break;
    }
    wanted = [];
  }

  function blit(tile, dx, dy, level, bright, solid, clip) {
    let x0 = Math.max(0, dx), y0 = Math.max(0, dy), x1 = Math.min(W, dx + tile.w), y1 = Math.min(H, dy + tile.h);
    if (clip) { x0 = Math.max(x0, clip[0]); y0 = Math.max(y0, clip[1]); x1 = Math.min(x1, clip[2]); y1 = Math.min(y1, clip[3]); }
    const px = tile.px;
    for (let y = y0; y < y1; y++) {
      let s = (y - dy) * tile.w + (x0 - dx), d = y * W + x0;
      const row = (y & 3) * 4;
      for (let x = x0; x < x1; x++, s++, d++) {
        const color = px[s];
        if (!color || (level < 16 && BAYER4[row + (x & 3)] >= level)) continue;
        out[d] = solid || (bright < 1 ? darken(color, bright) : color);
      }
    }
  }

  /** 回想（白黒）・セピアの場面は、重ね終えた 256×192 をまとめて変換する。 */
  function tone(mode) {
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      if (mode === "gray") { d[i] = d[i + 1] = d[i + 2] = y * 0.92 + 10; }
      else { d[i] = Math.min(255, y * 1.02 + 22); d[i + 1] = Math.min(255, y * 0.9 + 12); d[i + 2] = y * 0.7; }
    }
  }

  /** items を下から順に重ねて出す。sig が前と同じなら何もしない。 */
  function compose(items, sig, mode = "") {
    if (sig === shownSig) return false;
    shownSig = sig;
    out.fill(BASE_COLOR);
    for (const item of items) {
      if (item.rect) {
        const [x, y, w, h] = item.rect;
        for (let row = y; row < y + h; row++) out.fill(item.color, row * W + x, row * W + x + w);
      } else blit(item.tile, item.x, item.y, item.level ?? 16, item.bright ?? 1, item.solid || 0, item.clip);
    }
    if (mode) tone(mode);
    if (veil) {
      if (veil.level >= 16) veil = null;
      else for (let y = 0, q = 0; y < H; y++) {
        const row = (y & 3) * 4;
        for (let x = 0; x < W; x++, q++) if (BAYER4[row + (x & 3)] >= veil.level) out[q] = veil.from ? veil.from[q] : BASE_COLOR;
      }
    }
    present();
    fresh = false;
    stats.frames++;
    return true;
  }

  // ---- 絵の一覧を組む（どれも「鍵・位置・濃さ」だけ。絵そのものは tileFor が覚えている）

  function spriteItem(part, at, { level, bright = 1, colors = SPRITE_COLORS, crop = null }, request, list) {
    const zoom = W / at.w;
    const dw = Math.max(1, Math.round(part.w * zoom)), dh = Math.max(1, Math.round(part.h * zoom));
    const dx = Math.round((part.x - at.x) * zoom), dy = Math.round((part.y - at.y) * zoom);
    if (!level || dx >= W || dy >= H || dx + dw <= 0 || dy + dh <= 0) return true;
    // 画面に掛かる行だけを作る（少しの上下の動きでは作り直さないよう、32 行刻みで余白を取る）
    const row0 = Math.min(dh - 1, Math.max(0, Math.floor((-dy - 24) / 32) * 32)), rows = Math.min(dh - row0, H + 64);
    const key = `sp|${part.url}|${dw}x${dh}|${row0}+${rows}|${part.flip ? 1 : 0}|${crop ? crop.join(",") : ""}|${colors}`;
    const tile = tileFor(key, [part.url], () => buildSpriteTile({ url: part.url, dw, dh, row0, rows, flip: !!part.flip, crop, colors }), request);
    if (tile) list.push({ tile, key, x: dx, y: dy + row0, level, bright: brightStep(bright) });
    return !!tile;
  }

  function backgroundItems(layers, at, rainy, request, list) {
    let complete = true;
    for (const layer of layers) {
      const level = opacityLevel(layer.opacity);
      if (!level) continue;
      const base = layer.parts.find((part) => part.type === "cover") || (layer.parts[0]?.type === "image" ? layer.parts[0] : null);
      const shadows = layer.parts.filter((part) => part.type === "ellipse");
      const look = { bright: brightStep(layer.bright), tint: layer.tint, rainy };
      const spec = [base ? [base.url, base.type === "cover" ? [base.box, base.size, base.pos] : [base.x, base.y, base.w, base.h]] : null,
        layer.black, look, shadows.map((s) => [s.cx, s.cy, s.rx, s.ry])];
      const key = `bg|${JSON.stringify(spec)}|${viewKey(at)}`;
      const tile = tileFor(key, base ? [base.url] : [], () => buildBackgroundTile({ base, shadows, look, black: layer.black }, at), request);
      if (tile) list.push({ tile, key, x: 0, y: 0, level });
      else complete = false;
      // 店の台（切り抜きの絵）。夜の店内では台だけ暗くしている（brightness）。
      for (const part of layer.parts) {
        if (part === base || part.type === "ellipse") continue;
        let crop = null;
        if (part.type === "crop") {
          const entry = entryFor(part.url);
          if (!entry.ready) { complete &&= entry.failed; continue; }
          const [iw, ih] = size(entry.levels[0]);
          const fx = iw / (part.full[0] || iw), fy = ih / (part.full[1] || ih);
          crop = [part.crop[0] * fx, part.crop[1] * fy, part.crop[2] * fx, part.crop[3] * fy].map((n) => round(n));
        }
        complete = spriteItem(part, at, { level, bright: part.bright * look.bright, colors: PROP_COLORS, crop }, request, list) && complete;
      }
    }
    return complete;
  }

  function conversationItems(scene, at, request) {
    const list = [];
    let complete = backgroundItems(scene.bg, at, false, request, list);
    for (const sprite of scene.sprites) complete = spriteItem(sprite, at, { level: opacityLevel(sprite.opacity), bright: sprite.bright }, request, list) && complete;
    if (scene.cg) {
      const level = opacityLevel(scene.cg.opacity);
      const key = `cg|${JSON.stringify([scene.cg.url, scene.cg.box, scene.cg.size, scene.cg.pos, scene.cg.color])}|${viewKey(at)}`;
      const tile = level ? tileFor(key, [scene.cg.url], () => buildCgTile(scene.cg, at), request) : null;
      if (tile) list.push({ tile, key, x: 0, y: 0, level });
      else if (level) complete = false;
    }
    return { list, complete };
  }
  const signature = (list, extra = "") => `${list.map((item) => `${item.key || item.rect}@${item.x},${item.y},${item.level},${item.bright},${item.clip || ""}`).join(";")}#${extra}`;

  return {
    /**
     * 会話。窓は conversationView が決め、切り替えは 3 コマのコマ送り（滑らかには補間しない）。
     * 次のコマの絵がまだ作れていない間は、いまの窓のまま（覚えている絵だけで）出しておく。
     */
    paintVn(now) {
      const metrics = stageMetrics();
      const { sprites, focus } = readPortraits(metrics);
      const vn = document.getElementById("vn");
      const mode = vn?.classList.contains("flashback") ? "gray" : vn?.classList.contains("sepia") ? "sepia" : "";
      const scene = { bg: readBackgrounds(metrics), sprites, cg: readCg(metrics) };
      const target = conversationView(focus, scene.cg);
      if (!sameView(target, planTarget)) {
        planTarget = target;
        plan = !view || fresh ? [target] : sameView(view, target) ? [] : [mixView(view, target, 1 / 3), mixView(view, target, 2 / 3), target];
      }
      let painted = false, stepped = false;
      const stepping = plan.length > 0 && (!view || now - lastStep >= STEP_MS);
      if (stepping) {
        const next = conversationItems(scene, plan[0], true);
        if (next.complete) {
          view = plan.shift();
          lastStep = now;
          stepped = true;
          canvas.dataset.zoom = String(round(WIDE.w / view.w, 2));
          painted = compose(next.list, signature(next.list, mode + viewKey(view) + veilTag(now)), mode);
        }
      }
      if (!stepped && view) {
        // 次のコマを作っている間は、覚えている絵だけでいまの窓を出し直す（新しく作る物は積まない）
        const current = conversationItems(scene, view, !stepping);
        if (current.complete) painted = compose(current.list, signature(current.list, mode + viewKey(view) + veilTag(now)), mode);
      }
      pump();
      return painted;
    },

    /** 地図: view（全ピンが入る 4:3 の窓）で街の絵を写す。雨の日は少し青く沈める。 */
    paintMap(now, at, rainy) {
      const list = [];
      const spot = { x: Math.round(at.x), y: Math.round(at.y), w: round(at.w), h: at.h };
      const complete = backgroundItems(readBackgrounds(stageMetrics()), spot, !!rainy, true, list);
      const painted = complete && compose(list, signature(list, `map${veilTag(now)}`));
      pump();
      return painted;
    },

    /** タイトル: 4:3 に組み直す。左半分は背景とロゴ（画像）、右半分はキャラクターの絵（縦長 2:3 がちょうど入る）。 */
    paintTitle(now, { art, logo }) {
      const half = W / 2, list = [];
      // 背景は左寄り（ロゴの後ろの暗い側）を 4:3 に切る
      let complete = backgroundItems(readBackgrounds(stageMetrics()), { x: 0, y: 0, w: STAGE_H * 4 / 3, h: STAGE_H }, false, true, list);
      const artLevel = art?.url ? opacityLevel(art.opacity) : 0;
      let artShown = false;
      if (artLevel) {
        const key = `art|${art.url}|${half}x${H}`;
        const tile = tileFor(key, [art.url], () => buildCoverTile(art.url, half, H, 0.5, 0.2));
        if (tile?.w) {
          artShown = true;
          list.push({ tile, key, x: half, y: 0, level: artLevel });
          // 2枚の絵の境目はベタの線で仕切る
          list.push({ rect: [half - 3, 0, 1, H], color: 0xffe6a7c9 }, { rect: [half - 2, 0, 2, H], color: 0xff3a1d2a });
        } else if (!tile) complete = false;
      }
      if (logo?.url) {
        const entry = entryFor(logo.url);
        if (entry.ready) {
          const [iw, ih] = size(entry.levels[0]);
          const dw = artShown ? 118 : 168, dh = Math.max(1, Math.round(dw * ih / iw));
          const dx = artShown ? Math.round((half - 3 - dw) / 2) : Math.round((W - dw) / 2), dy = Math.round((H - dh) / 2) - 6;
          const key = `sp|${logo.url}|${dw}x${dh}|logo`;
          const tile = tileFor(key, [logo.url], () => buildSpriteTile({ url: logo.url, dw, dh }));
          if (tile) {
            // 1〜2ドットずらしたベタの影を敷いてから本体を重ねる
            list.push({ tile, key: `${key}|shadow`, x: dx + 1, y: dy + 2, solid: 0xff1e0a12 }, { tile, key, x: dx, y: dy });
          } else complete = false;
        } else complete &&= entry.failed;
      }
      const painted = complete && compose(list, signature(list, `title${veilTag(now)}`));
      pump();
      return painted;
    },

    /** 顔アイコンなどの小さな絵を、立ち絵と同じ処方で小さな canvas へ描く。読めたら true。 */
    drawIcon(target, url) {
      const entry = entryFor(url);
      if (!entry.ready) return false;
      const key = `icon|${url}|${target.width}x${target.height}`;
      const tile = tiles.get(key) || remember(tiles, key, buildSpriteTile({ url, dw: target.width, dh: target.height, colors: 32 }), TILE_MAX);
      if (!tile.w) return false;
      const ctx = target.getContext("2d");
      const data = ctx.createImageData(tile.w, tile.h);
      new Uint32Array(data.data.buffer).set(tile.px);
      ctx.putImageData(data, 0, 0);
      return true;
    },

    /**
     * 覆い（場面転換・日付の札・登場カットインなど）: 暗い画面に、覆いの中に見えている絵だけを写す。
     * 切り抜きの絵（人物）があればそれを中心にした 4:3、無ければステージ全体（上下に帯）を写す。
     * images: [{ url, x, y, w, h（ステージ座標）, opacity, fit, pos }]
     */
    paintCover(now, images) {
      const list = [];
      let complete = true, focus = null;
      const ready = [];
      for (const image of images) {
        const entry = entryFor(image.url);
        if (!entry.ready) { complete &&= entry.failed; continue; }
        ready.push([image, entry]);
        if (entry.alpha) focus ??= image.x + image.w / 2;
      }
      const at = focus === null ? { x: 0, y: -120, w: STAGE_W, h: STAGE_W * 3 / 4 }
        : { x: Math.round(Math.max(0, Math.min(STAGE_W - 960, focus - 480))), y: 0, w: 960, h: STAGE_H };
      const zoom = W / at.w;
      for (const [image, entry] of ready) {
        const level = opacityLevel(image.opacity);
        if (!level) continue;
        // 切り取って見せている絵（店のロゴなど）は、見えている範囲だけを写す
        const clip = image.clip ? [Math.round((image.clip.x - at.x) * zoom), Math.round((image.clip.y - at.y) * zoom),
          Math.round((image.clip.x + image.clip.w - at.x) * zoom), Math.round((image.clip.y + image.clip.h - at.y) * zoom)] : null;
        if (image.backing) {
          const b = image.backing;
          const x0 = Math.max(0, Math.round((b.x - at.x) * zoom)), y0 = Math.max(0, Math.round((b.y - at.y) * zoom));
          const x1 = Math.min(W, Math.round((b.x + b.w - at.x) * zoom)), y1 = Math.min(H, Math.round((b.y + b.h - at.y) * zoom));
          if (x1 > x0 && y1 > y0 && level >= 8) list.push({ rect: [x0, y0, x1 - x0, y1 - y0], color: b.color });
        }
        const before = list.length;
        if (entry.alpha) complete = spriteItem(image, at, { level }, true, list) && complete;
        else {
          const dw = Math.max(1, Math.round(image.w * zoom)), dh = Math.max(1, Math.round(image.h * zoom));
          const key = `box|${image.url}|${dw}x${dh}|${image.fit}|${image.pos}`;
          const tile = tileFor(key, [image.url], () => buildBoxTile(image.url, dw, dh, image.fit, image.pos));
          if (tile) list.push({ tile, key, x: Math.round((image.x - at.x) * zoom), y: Math.round((image.y - at.y) * zoom), level });
          else complete = false;
        }
        if (clip && list.length > before) list[list.length - 1].clip = clip;
      }
      const painted = complete && compose(list, signature(list, `cover${veilTag(now)}`));
      pump();
      return painted;
    },

    /**
     * 場面が切り替わった時に呼ぶ。次に描けた絵を、網点のコマ送りで出していく。
     * keep=true なら今の絵から、false なら暗い画面から（外枠を出し直した時。前の場面の絵を一瞬見せない）。
     */
    enter(keep = false) {
      veil = { level: 0, last: -Infinity, from: keep ? out.slice() : null };
      shownSig = "";
      fresh = true;
      view = null; plan = []; planTarget = null;
      delete canvas.dataset.zoom;
      if (!keep) { out.fill(BASE_COLOR); present(); }
    },
    /** いま出ている 256×192 の絵をもう一度出す（canvas の大きさを変えた直後）。 */
    refresh: present,
    stats,
    get version() { return version; },
    dispose() {
      for (const entry of cache.values()) { entry.dropped = true; entry.levels = null; }
      cache.clear();
      tiles.clear();
      palettes.clear();
      work = null;
    },
  };
}
