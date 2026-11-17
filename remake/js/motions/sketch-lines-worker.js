// スケッチの線画をメインスレッドの外で作る（#3653・sketch-lines.js）。
// 受け取る: { w, h, pixels: Uint8ClampedArray（canvas の getImageData）, ink: [r, g, b], clear, gray }
// 返す: { blob }（PNG）か { error }
import { sketchLinesPixels } from "./sketch-lines.js";

self.onmessage = async ({ data }) => {
  try {
    const { w, h, pixels, ink, clear, gray } = data;
    const out = sketchLinesPixels(pixels, w, h, ink, clear, !!gray);
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    self.postMessage({ blob });
  } catch (e) {
    self.postMessage({ error: String(e?.message || e) });
  }
};
