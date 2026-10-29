import assert from 'node:assert/strict';
import { LOADING_COMICS } from '../js/core/loading-comics.js';

// Registration guard: every comic offered to the loading screen must fit the fixed
// display frame (3:2, css/loading.css --loading-panel-ratio; see the authoring spec in
// remake/README.md and work/loading-comic-ref/REFERENCE.md §2). Panels are letterboxed
// without distortion or cropping, so a region whose ratio strays too far from the frame
// shows as a small picture floating in a large beige field. The band below keeps the
// letterbox occupancy at >= 80% of the frame width (ratio < 3:2) or >= 75% of the
// frame height (ratio > 3:2). Adopted precedents: episode 25 = 1.583 / 1.840,
// Batch 1 "炭の耳" = 1.278 / 1.303. A near-portrait episode at 0.70 was rejected by the
// owner on 2026-10-29; this guard makes that frame/spec mismatch fail at registration.
const FRAME_RATIO = 3 / 2;
const MIN_RATIO = 1.2;
const MAX_RATIO = 2.0;

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
      // No region: the whole image is the panel. Its own ratio is only known at decode
      // time, so ratio enforcement applies to region-based registrations (the sheet
      // method used by every adopted episode); whole-image panels must be authored at
      // 3:2 per the README spec.
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
