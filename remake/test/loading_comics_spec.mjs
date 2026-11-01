import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LOADING_COMICS } from '../js/core/loading-comics.js';

// Registration guard: every comic offered to the loading screen must fit the fixed
// display frame (3:2, css/loading.css --loading-panel-ratio; authoring spec:
// asset_sources/loading-comics/README.md, cut tool: tools/loading_comic_cut.py). Panels are letterboxed
// without distortion or cropping, so a region whose ratio strays too far from the frame
// shows as a small picture floating in a large beige field. The band below keeps the
// letterbox occupancy at >= 80% of the frame width (ratio < 3:2) or >= 75% of the
// frame height (ratio > 3:2). Adopted precedents: episode 25 = 1.583 / 1.840,
// Batch 1 "炭の耳" = 1.278 / 1.303. A near-portrait episode at 0.70 was rejected by the
// owner on 2026-10-29; this guard makes that frame/spec mismatch fail at registration.
const FRAME_RATIO = 3 / 2;
const MIN_RATIO = 1.2;
const MAX_RATIO = 2.0;
// Whole-image panels (the 1-panel-1-file standard since 2026-11-01) must be delivered at 3:2 exactly
// (±1%) and no larger than 1440x960, as tools/loading_comic_cut.py emits them.
const WHOLE_TOLERANCE = 0.01;
const MAX_WHOLE = { width: 1440, height: 960 };

// Image size from the file header (WebP VP8 / VP8L / VP8X, PNG). No decoder needed in CI quick.
function imageSize(file) {
  const b = readFileSync(file);
  if (b.length >= 24 && b.toString('ascii', 0, 4) === '\x89PNG') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X') return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  throw new Error(`${file}: unsupported image header`);
}

assert(Array.isArray(LOADING_COMICS) && LOADING_COMICS.length > 0,
  'At least one loading comic must be registered');

for (const comic of LOADING_COMICS) {
  assert(comic.id && comic.title, 'Every comic needs an id and a title');
  assert(Number.isInteger(comic.minChapter) && comic.minChapter >= 1,
    `${comic.id}: minChapter must be a positive integer`);
  assert(Array.isArray(comic.panels) && comic.panels.length === 2,
    `${comic.id}: the loading screen shows exactly 2 panels`);

  comic.panels.forEach((panel, index) => {
    const where = `${comic.id} panel ${index + 1}`;
    assert(panel.src && panel.alt, `${where}: src and alt are required`);
    const region = panel.region;
    if (!region) {
      // No region: the whole image is the panel. Read its size from the file header and
      // require the delivery spec (3:2 within 1%, at most 1440x960).
      const file = panel.src.startsWith('file:') ? fileURLToPath(panel.src) : panel.src;
      const { width, height } = imageSize(file);
      const ratio = width / height;
      assert(Math.abs(ratio - FRAME_RATIO) <= WHOLE_TOLERANCE * FRAME_RATIO,
        `${where}: whole-image panel is ${width}x${height} (${ratio.toFixed(3)}); deliver it at 3:2 via tools/loading_comic_cut.py`);
      assert(width <= MAX_WHOLE.width && height <= MAX_WHOLE.height,
        `${where}: ${width}x${height} exceeds the 1440x960 delivery cap`);
      return;
    }
    const fields = [region.x, region.y, region.width, region.height, region.sourceWidth, region.sourceHeight];
    assert(fields.every(Number.isFinite), `${where}: region fields must be finite numbers`);
    assert(region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0,
      `${where}: region origin and size must be positive`);
    assert(region.x + region.width <= region.sourceWidth && region.y + region.height <= region.sourceHeight,
      `${where}: region must stay inside the source sheet`);
    const ratio = region.width / region.height;
    assert(ratio >= MIN_RATIO && ratio <= MAX_RATIO,
      `${where}: region ratio ${ratio.toFixed(3)} is outside [${MIN_RATIO}, ${MAX_RATIO}] ` +
      `(frame is ${FRAME_RATIO.toFixed(2)}; the panel would letterbox to a small centre strip)`);
  });
}

console.log(`loading comics spec: PASS (${LOADING_COMICS.length} comics fit the 3:2 frame band)`);
