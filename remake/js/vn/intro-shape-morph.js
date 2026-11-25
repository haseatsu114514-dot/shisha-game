// 立ち絵の影から、カットインの人物の影へ「形そのものが変わる」変形（2026-11-02 オーナー指摘
// 「そもそもポーズが変わるから、そこは変形とか変身みたいな自然な切り替わりができると良い」）。
//
// 2つの影（立ち絵を頭の位置でカットインに合わせたものと、カットインの人物）の符号付き距離場を作り、
// 時間に合わせて距離場を混ぜる。腕や髪は、片方にしか無い部分が縮み、もう片方の部分が伸びて、
// 一つの影がなめらかに次のポーズへ変わる。描画は低い解像度のキャンバスで行い、CSS で拡大する。
// 縁に明るい線を引くので、拡大のぼけは光の縁として見える。

const INF = 1e20;
const TANH_STEPS = 32;
const TANH_LIMIT = 10 * TANH_STEPS;
const TANH = Float32Array.from({ length: TANH_LIMIT * 2 + 1 }, (_, i) => Math.tanh((i - TANH_LIMIT) / TANH_STEPS));

/** 1次元の二乗距離変換（Felzenszwalb & Huttenlocher） */
function edt1d(f, n, d, v, z) {
  // 目印がない画素は下側包絡線の候補に入らない。
  let first = 0;
  while (first < n && f[first] >= INF) first++;
  if (first === n) { d.fill(INF, 0, n); return; }
  let k = 0;
  v[0] = first; z[0] = -INF; z[1] = INF;
  for (let q = first + 1; q < n; q++) {
    if (f[q] >= INF) continue;
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** 2次元の二乗距離変換。grid は「その画素が目印なら0、違えば INF」 */
function edt2d(grid, w, h) {
  const n = Math.max(w, h);
  const f = new Float32Array(n), d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  return grid;
}

/** 0〜255 の不透明度から、内側が正・外側が負の距離（画素単位） */
function signedDistance(alpha, w, h) {
  const inside = new Float32Array(w * h), outside = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const on = alpha[i] > 127;
    inside[i] = on ? INF : 0;   // 内側の画素から、いちばん近い外側までの距離
    outside[i] = on ? 0 : INF;  // 外側の画素から、いちばん近い内側までの距離
  }
  edt2d(inside, w, h); edt2d(outside, w, h);
  const sd = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    sd[i] = alpha[i] > 127 ? Math.sqrt(inside[i]) - 0.5 : 0.5 - Math.sqrt(outside[i]);
  }
  return sd;
}

/**
 * 距離場を描画解像度に双一次補間し、reach × tanh(d / reach) でなめらかに頭打ちにする。
 * 遠くにある細い部分も変形の途中で現れ、深い内側どうしが一斉に入れ替わるのを防ぐ。
 */
function softField(sd, w, h, W, H, factor, reach) {
  const out = new Float32Array(W * H);
  // tanh は表から線形補間する。reach=18 での補間誤差は描画面の 0.002px 未満。
  const distanceToSample = factor * TANH_STEPS / reach;
  // 列ごとの参照位置と重みは全行で同じなので、先に一度だけ計算する
  const xs = new Int32Array(W), txs = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const fx = Math.min(w - 1.001, Math.max(0, (x + .5) / factor - .5));
    xs[x] = fx | 0; txs[x] = fx - xs[x];
  }
  for (let y = 0, o = 0; y < H; y++) {
    const fy = Math.min(h - 1.001, Math.max(0, (y + .5) / factor - .5)), row = (fy | 0) * w, ty = fy - (fy | 0);
    for (let x = 0; x < W; x++, o++) {
      const i = row + xs[x], tx = txs[x];
      const a = sd[i], b = sd[i + 1], c = sd[i + w], d = sd[i + w + 1];
      const top = a + (b - a) * tx;
      const sample = (top + (c + (d - c) * tx - top) * ty) * distanceToSample + TANH_LIMIT;
      if (sample <= 0) out[o] = -reach;
      else if (sample >= TANH_LIMIT * 2) out[o] = reach;
      else {
        const at = sample | 0;
        const a = TANH[at];
        out[o] = reach * (a + (TANH[at + 1] - a) * (sample - at));
      }
    }
  }
  return out;
}

/** 絵の下端より下も、下端の行と同じ形が続いているものとして埋める（下端の水平な切れ目が変形に出ないように） */
function extendDown(alpha, w, h, row) {
  if (row < 0 || row >= h - 1) return alpha;
  for (let x = 0; x < w; x++) {
    const v = alpha[row * w + x];
    if (!v) continue;
    for (let y = row + 1; y < h; y++) alpha[y * w + x] = Math.max(alpha[y * w + x], v);
  }
  return alpha;
}

const hex = (c) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || "").trim());
  const n = m ? parseInt(m[1], 16) : 0xe8c27a;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * 変形の準備。座標はすべてカットインの 1280×720 の画面上の px。
 * @param from { img, left, top, width, height }  立ち絵を、頭がカットインの頭に重なる位置へ置いた矩形
 * @param to   { img, left, top, width }  カットインの人物（正方形）
 * @param colors { color, secondary }
 * @returns { canvas, draw(t, glow) } t=0 で立ち絵の影、t=1 でカットインの人物の影
 */
export function prepareShapeMorph(from, to, colors, { scale = 0.75, field = 1.5, reach = 18, soften = 1, region = { x: -360, y: -100, w: 1680, h: 1220 } } = {}) {
  // 描画解像度は保ち、距離変換の解像度だけを抑える。小さい画面では従来の解像度を使う。
  const W = Math.round(region.w * scale), H = Math.round(region.h * scale);
  const fieldScale = scale / field;
  const fs = Math.min(fieldScale, .3), w = Math.round(region.w * fs), h = Math.round(region.h * fs);
  const filterScale = fs / fieldScale;
  const bottomMargin = Math.max(1, Math.round(3 * filterScale));
  const work = document.createElement("canvas");
  work.width = w; work.height = h;
  const g = work.getContext("2d", { willReadFrequently: true });
  const toCanvas = (x, y) => [(x - region.x) * fs, (y - region.y) * fs];
  const alphaOf = (paint) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    // 指先や髪の先のような細かい部分は、変形の途中でちらつく小さな粒になるので、少しだけ丸める
    g.filter = soften ? `blur(${soften * filterScale}px)` : "none";
    paint();
    g.filter = "none";
    const px = g.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) a[i] = px[i * 4 + 3];
    return a;
  };
  const [ax, ay] = toCanvas(from.left, from.top);
  const alphaA = extendDown(alphaOf(() => g.drawImage(from.img, ax, ay, from.width * fs, from.height * fs)),
    w, h, Math.floor(ay + from.height * fs) - bottomMargin);
  // カットインの人物の影は、下の薄めや名前側の消し込みを入れない（入れると水平・垂直の切れ目が動いて見える）。
  // 絵の下端より下は体が続いているものとして伸ばす
  const [bx, by] = toCanvas(to.left, to.top), bs = to.width * fs;
  const alphaB = extendDown(alphaOf(() => g.drawImage(to.img, bx, by, bs, bs)), w, h, Math.floor(by + bs) - bottomMargin);
  const factor = scale / fs;
  const dA = softField(signedDistance(alphaA, w, h), w, h, W, H, factor, reach);
  const dB = softField(signedDistance(alphaB, w, h), w, h, W, H, factor, reach);
  // 毎フレーム全画素を回さないよう、どちらかの影がある範囲だけを描く
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (dA[i] > -4 || dB[i] > -4) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < x0) { x0 = 0; y0 = 0; x1 = W - 1; y1 = H - 1; }
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  canvas.className = "ci-tr-morph";
  canvas.style.cssText = `left:${region.x}px;top:${region.y}px;width:${region.w}px;height:${region.h}px`;
  const out = canvas.getContext("2d");
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const image = out.createImageData(bw, bh), data = image.data;
  const fill = hex(colors.color), line = hex(colors.secondary);
  return {
    canvas,
    /** t: 0〜1 の変形の進み。glow: 0〜1、影全体を白く光らせる割合（変身の光） */
    draw(t, glow = 0) {
      const fr = fill[0] + (255 - fill[0]) * glow, fg = fill[1] + (255 - fill[1]) * glow, fb = fill[2] + (255 - fill[2]) * glow;
      const lr = line[0] + (255 - line[0]) * Math.max(glow, .35), lg = line[1] + (255 - line[1]) * Math.max(glow, .35), lb = line[2] + (255 - line[2]) * Math.max(glow, .35);
      let o = 0;
      for (let y = y0; y <= y1; y++) {
        let i = y * W + x0;
        for (let x = x0; x <= x1; x++, i++, o += 4) {
          let d = dA[i] + (dB[i] - dA[i]) * t;
          // 混ぜた距離場は、古い縁と新しい縁がすれ違う所で傾きが小さくなり、縁が太くぼやける。
          // 縁の近くだけ傾きで割って本当の距離に直し、縁を常に細く保つ
          if (d < -3) { data[o + 3] = 0; continue; }
          if (d < 3) {
            // 輪郭付近だけ傾きを求め、全画素4枚の傾き配列を保持しない。
            let gx = 0, gy = 0;
            if (x > 0 && x < W - 1 && y > 0 && y < H - 1) {
              const ax = (dA[i + 1] - dA[i - 1]) * .5;
              const ay = (dA[i + W] - dA[i - W]) * .5;
              gx = ax + ((dB[i + 1] - dB[i - 1]) * .5 - ax) * t;
              gy = ay + ((dB[i + W] - dB[i - W]) * .5 - ay) * t;
            }
            d /= Math.max(.25, Math.sqrt(gx * gx + gy * gy));
            if (d < -1) { data[o + 3] = 0; continue; }
          }
          const a = d > 0 ? 1 : d + 1;            // 縁の1画素だけ半透明にして、ぎざぎざを消す
          const e = d > 1.8 ? 0 : 1 - Math.max(0, d) / 1.8; // 縁の明るい線
          data[o] = fr + (lr - fr) * e; data[o + 1] = fg + (lg - fg) * e; data[o + 2] = fb + (lb - fb) * e;
          data[o + 3] = a * 255;
        }
      }
      out.putImageData(image, x0, y0);
    },
  };
}
