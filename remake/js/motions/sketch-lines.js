// スケッチの線画（sketch.js の sketchFilter と同じ計算）を、SVGフィルタを使わずに ImageData で行う（#3653）。
// canvas に url(#filter) を掛けると、1280×720 の輪郭計算がメインスレッドで数百ms止まる（中位スマホ相当）。
// 同じ式をワーカーで計算して、演出の直前の固まりをなくす。式は sketchFilter の4段:
//   1. feColorMatrix saturate 0（輝度）  2. feConvolveMatrix 3×3 のラプラシアン（preserveAlpha）
//   3. feComponentTransfer linear slope -3.2 intercept 1  4. feColorMatrix（線の色 ink。clear なら白を透明に）
// 各段の結果は 0〜1 に収める（SVG フィルタと同じ）。画像の外は透明として扱う（フィルタ領域の外と同じ）。

/** rgba（不透明な絵）→ 線画の rgba（ストレートアルファ）。ink: [r, g, b] 0〜255、clear: 線以外を透明に。
 * gray: src が canvas の filter "saturate(0)" で描いたもの（1. を済ませてある。SVG の saturate とビット一致する）。
 * gray でないとき（canvas の filter が使えない環境）は 1. をここで計算する（0.5 ちょうどの丸めで ±1 ずれることがある） */
export function sketchLinesPixels(src, w, h, ink, clear, gray = false) {
  const n = w * h;
  const lum = new Uint8Array(n);
  const alpha = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const a = src[p + 3];
    alpha[i] = a;
    // getImageData はストレートアルファ。SVG の saturate 0 は R/G/B すべてに同じ輝度を入れる
    const y = gray ? src[p] : 0.213 * src[p] + 0.715 * src[p + 1] + 0.072 * src[p + 2];
    lum[i] = Math.round(y > 255 ? 255 : y); // 各段は 8bit に丸められる（Skia のフィルタと同じ）
  }
  const out = new Uint8ClampedArray(n * 4);
  const [ir, ig, ib] = ink.map((v) => v / 255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let s = 8 * lum[i];
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) s -= lum[yy * w + xx];
        }
      }
      const c = s < 0 ? 0 : s > 255 ? 255 : s; // 2. 輪郭（0〜255 の整数）
      let t = Math.round(255 - 3.2 * c); // 3.
      t = (t < 0 ? 0 : t > 255 ? 255 : t) / 255;
      const p = i * 4;
      if (clear) {
        out[p] = ir * 255; out[p + 1] = ig * 255; out[p + 2] = ib * 255;
        out[p + 3] = (1 - t) * alpha[i];
      } else {
        out[p] = ((1 - ir) * t + ir) * 255; out[p + 1] = ((1 - ig) * t + ig) * 255; out[p + 2] = ((1 - ib) * t + ib) * 255;
        out[p + 3] = alpha[i];
      }
    }
  }
  return out;
}
