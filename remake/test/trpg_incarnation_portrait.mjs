import { test } from "node:test";
import assert from "node:assert/strict";
import { silhouette } from "../js/trpg/incarnation-portrait.js";

test("a cloak moves the card anchor while a detached narrow prop and transparent padding do not", () => {
  const width = 100, height = 120;
  const frame = { src: [width, height], face: { cx: 44, eye_y: 32, w: 14, figtop: 5 } };
  const pixels = new Uint8Array(width * height * 4);
  function ink(y, left, right) {
    for (let x = left; x < right; x++) pixels[4 * (y * width + x) + 3] = 255;
  }
  for (let y = 5; y < 32; y++) ink(y, 12, 82);
  for (let y = 32; y < 100; y++) { ink(y, 33, 71); ink(y, 90, 92); }
  const { center, left, right } = silhouette(pixels, width, height, frame);
  assert.ok(Math.abs(center - (44 + .76 * .46 * 14)) < .001);
  assert.deepEqual([left, right], [12, 82]);
  for (const alpha of [0, 255]) {
    pixels.fill(alpha);
    assert.deepEqual(silhouette(pixels, width, height, frame), { center: 44, left: 44, right: 44 });
  }
});
