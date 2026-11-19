import { el } from "../core/util.js";

// Alpha mass gives a thin staff less influence than shoulders or a cloak. The
// median across four rows is insensitive to a sleeve crossing just one row.
export function silhouette(pixels, width, height, frame) {
  const { cx, eye_y: eyes, w, figtop = 0 } = frame.face;
  const [sw, sh] = frame.src, centers = [];
  const solid = (x, y) => pixels[4 * (y * width + x) + 3] >= 128;
  for (const depth of [1.1, 1.5, 1.9, 2.3]) {
    const y = Math.min(height - 1, Math.round((eyes + depth * w) * height / sh));
    const row = [];
    for (let x = 0; x < width; x++) if (solid(x, y)) row.push(x);
    if (row.length && row.length < width) centers.push((row[row.length >> 1] + 0.5) * sw / width);
  }
  if (!centers.length) return { center: cx, left: cx, right: cx };
  centers.sort((a, b) => a - b);
  const middle = (centers[Math.floor((centers.length - 1) / 2)] + centers[Math.floor(centers.length / 2)]) / 2;
  const center = cx + 0.76 * Math.max(-0.46 * w, Math.min(0.46 * w, middle - cx));
  // Bound the connected crown/brim above the eyes. Detached accessories beside
  // a head do not determine its size. Pixel edges are in original art units.
  let left = cx, right = cx;
  const axis = Math.min(width - 1, Math.floor(cx * width / sw));
  for (let y = Math.max(0, Math.floor(figtop * height / sh)); y < eyes * height / sh; y++) {
    if (!solid(axis, y)) continue;
    let lo = axis, hi = axis;
    while (lo && solid(lo - 1, y)) lo--;
    while (hi + 1 < width && solid(hi + 1, y)) hi++;
    left = Math.min(left, lo * sw / width);
    right = Math.max(right, (hi + 1) * sw / width);
  }
  return { center, left, right };
}

const anchors = new Map();
function anchorFor(img, frame) {
  if (!anchors.has(img.src)) {
    const cx = frame.face.cx;
    let anchor = { center: cx, left: cx, right: cx };
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 112;
      canvas.height = Math.round(canvas.width * frame.src[1] / frame.src[0]);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      anchor = silhouette(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, frame);
    } catch { /* Opaque or unavailable pixel data keeps the authored face anchor. */ }
    anchors.set(img.src, anchor);
  }
  return anchors.get(img.src);
}

export function incarnationPortrait(url, frame, cheekWidth) {
  const [sw, sh] = frame.src;
  const { cx, eye_y: eyes, figtop } = frame.face;
  const above = Math.max(1, eyes - (figtop ?? 0));
  const faceFraction = frame.character === "kuraudo" ? 0.295 : 0.245;
  const width = faceFraction * sw / cheekWidth;
  // Guard the crown even on shallow cards. Only the lower body may run off the bottom.

  const translate = x => `translate(-${100 * x / sw}%, -${100 * eyes / sh}%)`;
  const style = ({ center, left, right }) => {
    const zoom = Math.min(width, sw / Math.max(1, right - left));
    const half = sw / (2 * zoom);
    const x = Math.max(right - half, Math.min(left + half, center));
    const renderWidth = `min(${100 * zoom}cqw, ${48 * sw / above}cqh)`;
    return { width: renderWidth, height: "auto", transform: translate(x),
      top: `max(35cqh, calc(4cqh + ${renderWidth} * ${above / sw}))` };
  };
  const img = el("img", { alt: "", onload: event => {
    const image = event.currentTarget;
    Object.assign(image.style, style(anchorFor(image, frame)));
  }, src: url, style: style({ center: cx, left: cx, right: cx }) });
  return el("span.trpg-costume", { dataset: { shape: "bust" }, style: { containerType: "size" } }, img);
}
