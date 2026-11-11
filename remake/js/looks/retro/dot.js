// DS風の「ドット絵らしさ」を作る画素の処理（DOM に触れない純粋な関数だけ）。
// 滑らかに縮めただけの絵は低解像度の写真に見えるので、色数を絞り、にじみの中間色をなくす。
//   背景: 面積平均で縮小 → コントラスト少し上げる → 弱い輪郭強調 → Bayer 4×4 の網点 → その絵の 64 色へ減色
//   立ち絵: 不透明度を掛けて面積平均で縮小 → 弱い輪郭強調 → 原寸の絵から作った 48 色の一番近い色へ寄せる → 透明度は 50% で2値
// 色は canvas の ImageData と同じ並び（Uint32 で 0xAABBGGRR。リトルエンディアン前提）で持つ。0 は透明。

export const BAYER4 = Uint8Array.of(0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);

/**
 * 2倍の大きさで描いた RGBA（幅 2w・高さ 2h）を 2×2 の平均で w×h へ縮める（面積平均の仕上げ）。
 * 透明な画素の色は混ぜない（不透明度で重み付けする）。戻り値: rgb（Float32・w*h*3）と alpha（Float32・0〜255）。
 */
export function halve(src, w, h) {
  const rgb = new Float32Array(w * h * 3), alpha = new Float32Array(w * h);
  const stride = w * 8;
  for (let y = 0, o = 0; y < h; y++) {
    let i = y * 2 * stride;
    for (let x = 0; x < w; x++, o++, i += 8) {
      const j = i + stride;
      const a0 = src[i + 3], a1 = src[i + 7], a2 = src[j + 3], a3 = src[j + 7];
      const a = a0 + a1 + a2 + a3;
      if (a > 0) {
        const p = o * 3;
        rgb[p] = (src[i] * a0 + src[i + 4] * a1 + src[j] * a2 + src[j + 4] * a3) / a;
        rgb[p + 1] = (src[i + 1] * a0 + src[i + 5] * a1 + src[j + 1] * a2 + src[j + 5] * a3) / a;
        rgb[p + 2] = (src[i + 2] * a0 + src[i + 6] * a1 + src[j + 2] * a2 + src[j + 6] * a3) / a;
      }
      alpha[o] = a / 4;
    }
  }
  return { rgb, alpha };
}

/** コントラストを絵の平均の明るさを軸に factor 倍する。 */
export function contrast(rgb, factor) {
  let sum = 0;
  const n = rgb.length / 3;
  for (let p = 0; p < rgb.length; p += 3) sum += rgb[p] * 0.299 + rgb[p + 1] * 0.587 + rgb[p + 2] * 0.114;
  const mean = n ? sum / n : 128;
  for (let p = 0; p < rgb.length; p++) rgb[p] = mean + (rgb[p] - mean) * factor;
}

/**
 * 弱い輪郭強調（アンシャープ）。半径1相当のぼかし（1-4-6-4-1）との差を amount 倍して足す。差が threshold 未満の所は触らない。
 * alpha を渡すと、不透明（128 以上）の画素だけでぼかしを作る（透明な周りの色を輪郭へ混ぜない）。
 */
export function unsharp(rgb, w, h, amount, threshold = 2, alpha = null) {
  const n = w * h;
  // 横のぼかし（重み付きの和）。tmp は rgb の和、weight は重みの和（透明を除く）。
  const tmp = new Float32Array(n * 3), weight = new Float32Array(n);
  const mask = new Uint8Array(n);
  if (alpha) for (let q = 0; q < n; q++) mask[q] = alpha[q] >= 128 ? 1 : 0;
  else mask.fill(1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const q0 = row + (x > 1 ? x - 2 : 0), q1 = row + (x > 0 ? x - 1 : 0), q2 = row + x;
      const q3 = row + (x < w - 1 ? x + 1 : x), q4 = row + (x < w - 2 ? x + 2 : w - 1);
      const m0 = mask[q0], m1 = mask[q1] * 4, m2 = mask[q2] * 6, m3 = mask[q3] * 4, m4 = mask[q4];
      const o = q2 * 3, p0 = q0 * 3, p1 = q1 * 3, p3 = q3 * 3, p4 = q4 * 3;
      tmp[o] = rgb[p0] * m0 + rgb[p1] * m1 + rgb[o] * m2 + rgb[p3] * m3 + rgb[p4] * m4;
      tmp[o + 1] = rgb[p0 + 1] * m0 + rgb[p1 + 1] * m1 + rgb[o + 1] * m2 + rgb[p3 + 1] * m3 + rgb[p4 + 1] * m4;
      tmp[o + 2] = rgb[p0 + 2] * m0 + rgb[p1 + 2] * m1 + rgb[o + 2] * m2 + rgb[p3 + 2] * m3 + rgb[p4 + 2] * m4;
      weight[q2] = m0 + m1 + m2 + m3 + m4;
    }
  }
  // 縦のぼかしと、差の足し戻し（不透明な画素だけ）
  const out = new Float32Array(rgb.length);
  for (let y = 0; y < h; y++) {
    const r0 = (y > 1 ? y - 2 : 0) * w, r1 = (y > 0 ? y - 1 : 0) * w, r2 = y * w;
    const r3 = (y < h - 1 ? y + 1 : y) * w, r4 = (y < h - 2 ? y + 2 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const q = r2 + x, o = q * 3;
      if (!mask[q]) continue;
      const total = weight[r0 + x] + weight[r1 + x] * 4 + weight[q] * 6 + weight[r3 + x] * 4 + weight[r4 + x];
      if (!(total > 0)) { out[o] = rgb[o]; out[o + 1] = rgb[o + 1]; out[o + 2] = rgb[o + 2]; continue; }
      const p0 = (r0 + x) * 3, p1 = (r1 + x) * 3, p3 = (r3 + x) * 3, p4 = (r4 + x) * 3;
      for (let c = 0; c < 3; c++) {
        const value = rgb[o + c];
        const diff = value - (tmp[p0 + c] + tmp[p1 + c] * 4 + tmp[o + c] * 6 + tmp[p3 + c] * 4 + tmp[p4 + c]) / total;
        out[o + c] = diff >= threshold || diff <= -threshold ? value + diff * amount : value;
      }
    }
  }
  rgb.set(out);
}

/**
 * メディアンカットで、samples（Uint32・0x00RRGGBB。中身は並べ替える）から最大 count 色を作る。
 * 画素の多い箱から、いちばん幅のある色の軸を中央値で割っていく。戻り値は Uint8Array（色数×3）。
 */
export function medianCut(samples, count) {
  const n = samples.length;
  if (!n) return new Uint8Array(0);
  const SHIFT = [16, 8, 0];
  const measure = (lo, hi) => {
    const min = [255, 255, 255], max = [0, 0, 0];
    for (let i = lo; i < hi; i++) {
      const v = samples[i];
      for (let c = 0; c < 3; c++) {
        const channel = (v >> SHIFT[c]) & 255;
        if (channel < min[c]) min[c] = channel;
        if (channel > max[c]) max[c] = channel;
      }
    }
    const range = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const axis = range[0] >= range[1] && range[0] >= range[2] ? 0 : range[1] >= range[2] ? 1 : 2;
    return { lo, hi, axis, range: range[axis] };
  };
  // 軸の色を最上位へ回してから数として並べ替え、元へ戻す（TypedArray の sort はネイティブで速い）
  const sortBy = (lo, hi, axis) => {
    const part = samples.subarray(lo, hi);
    if (axis === 1) for (let i = 0; i < part.length; i++) { const v = part[i]; part[i] = ((v & 0xffff) << 8) | (v >> 16); }
    else if (axis === 2) for (let i = 0; i < part.length; i++) { const v = part[i]; part[i] = ((v & 0xff) << 16) | (v >> 8); }
    part.sort();
    if (axis === 1) for (let i = 0; i < part.length; i++) { const v = part[i]; part[i] = ((v & 0xff) << 16) | (v >> 8); }
    else if (axis === 2) for (let i = 0; i < part.length; i++) { const v = part[i]; part[i] = ((v & 0xffff) << 8) | (v >> 16); }
  };
  const boxes = [measure(0, n)];
  while (boxes.length < count) {
    let pick = -1;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.range > 0 && (pick < 0 || box.hi - box.lo > boxes[pick].hi - boxes[pick].lo)) pick = i;
    }
    if (pick < 0) break;
    const box = boxes[pick];
    sortBy(box.lo, box.hi, box.axis);
    const shift = SHIFT[box.axis];
    let mid = (box.lo + box.hi) >> 1;
    // 同じ値の途中では割らない（近い方の境目へ寄せる）
    const value = (samples[mid] >> shift) & 255;
    let up = mid, down = mid;
    while (up < box.hi && ((samples[up] >> shift) & 255) === value) up++;
    while (down > box.lo && ((samples[down - 1] >> shift) & 255) === value) down--;
    mid = down > box.lo && (mid - down <= up - mid || up >= box.hi) ? down : up;
    if (mid <= box.lo || mid >= box.hi) { box.range = 0; continue; }
    boxes.splice(pick, 1, measure(box.lo, mid), measure(mid, box.hi));
  }
  const colors = new Uint8Array(boxes.length * 3);
  boxes.forEach((box, index) => {
    let r = 0, g = 0, b = 0;
    for (let i = box.lo; i < box.hi; i++) { const v = samples[i]; r += v >> 16; g += (v >> 8) & 255; b += v & 255; }
    const size = box.hi - box.lo;
    colors[index * 3] = Math.round(r / size); colors[index * 3 + 1] = Math.round(g / size); colors[index * 3 + 2] = Math.round(b / size);
  });
  return colors;
}

/**
 * 色の組。table は 15bit 色（各5bit）→ 一番近い色の番号の表で、初めて出た色だけ探して覚える（-1 は未計算）。
 * packed は canvas の画素と同じ並びの色。
 */
export function makePalette(colors) {
  const n = colors.length / 3;
  const packed = new Uint32Array(n);
  for (let i = 0; i < n; i++) packed[i] = (0xff000000 | (colors[i * 3 + 2] << 16) | (colors[i * 3 + 1] << 8) | colors[i * 3]) >>> 0;
  const table = new Int16Array(32768).fill(-1);
  /** key（15bit 色）に一番近い色を探して表に書く。 */
  function resolve(key) {
    const cr = ((key >> 10) << 3) | 4, cg = (((key >> 5) & 31) << 3) | 4, cb = ((key & 31) << 3) | 4;
    let best = Infinity, found = 0;
    for (let i = 0; i < n; i++) {
      const dr = colors[i * 3] - cr, dg = colors[i * 3 + 1] - cg, db = colors[i * 3 + 2] - cb;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < best) { best = distance; found = i; }
    }
    table[key] = found;
    return found;
  }
  return { size: n, colors, packed, table, resolve };
}

/** 背景: 網点（Bayer 4×4・振幅 amplitude）を足してから色の組へ寄せる。不透明の絵（Uint32・w*h）を返す。 */
export function ditherSnap(rgb, w, h, palette, amplitude = 16) {
  const px = new Uint32Array(w * h);
  const { table, packed } = palette;
  for (let y = 0, q = 0; y < h; y++) {
    for (let x = 0; x < w; x++, q++) {
      const d = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * amplitude;
      let r = rgb[q * 3] + d, g = rgb[q * 3 + 1] + d, b = rgb[q * 3 + 2] + d;
      r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const index = table[key];
      px[q] = packed[index < 0 ? palette.resolve(key) : index];
    }
  }
  return px;
}

/** 立ち絵: 網点なしで色の組へ寄せ、透明度は 50% で2値にする（透明は 0）。 */
export function snap(rgb, alpha, w, h, palette) {
  const px = new Uint32Array(w * h);
  const { table, packed } = palette;
  for (let q = 0; q < px.length; q++) {
    if (alpha[q] < 128) continue;
    let r = rgb[q * 3], g = rgb[q * 3 + 1], b = rgb[q * 3 + 2];
    r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const index = table[key];
    px[q] = packed[index < 0 ? palette.resolve(key) : index];
  }
  return px;
}

/** RGBA の画素を等間隔に最大 limit 点ほど見て、不透明な所の色を抜き取る（色の組を作る元）。 */
export function sampleColors(data, limit = 20000, minAlpha = 200) {
  const total = data.length / 4;
  const step = Math.max(1, Math.round(total / limit));
  const out = new Uint32Array(Math.ceil(total / step));
  let n = 0;
  for (let i = 0; i < total; i += step) {
    if (data[i * 4 + 3] < minAlpha) continue;
    out[n++] = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
  }
  return out.subarray(0, n);
}

/** 暗くした色（話していない人・夜の店の台）。bright は 0〜1。 */
export function darken(color, bright) {
  const r = ((color & 255) * bright) | 0, g = (((color >> 8) & 255) * bright) | 0, b = (((color >> 16) & 255) * bright) | 0;
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}
