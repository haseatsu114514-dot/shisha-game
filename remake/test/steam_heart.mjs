import assert from 'node:assert/strict';
import { HEART_SIZE, heartHitRadius, heartTouchesBullet } from '../js/craft/steam-heart.js';
assert.equal(HEART_SIZE, 20); assert.equal(heartHitRadius(0), 4);
const b = (x, y, w = 2, h = 2) => ({ x, y, w, h });
assert(heartTouchesBullet(b(-1, -1), 0, 0, 4));
for (const bullet of [b(4, -1), b(-6, -1), b(-1, 4), b(-1, -6)]) {
  assert(!heartTouchesBullet(bullet, 0, 0, 4), 'Touching the white circle edge is safe');
}
assert(heartTouchesBullet(b(3.99, -1), 0, 0, 4));
assert(!heartTouchesBullet(b(8, -1), 0, 0, 4), 'The outer heart can overlap without a hit');
assert(!heartTouchesBullet(b(3, 3), 0, 0, 4), 'A rectangle corner outside the circle is safe');
assert(heartTouchesBullet(b(2.8, 2.8), 0, 0, 4));
assert(heartTouchesBullet(b(-100, -1, 101, 2), 0, 0, 4), 'Long word edges still hit');
for (const focus of [1.1, 1, .75]) {
  let previous = Infinity;
  for (const guts of [0, .25, .5, .75, 1]) {
    const radius = heartHitRadius(guts, focus);
    assert(radius > 0 && radius < previous); assert(radius * 2 < HEART_SIZE);
    assert(!heartTouchesBullet(b(radius + .01, -1), 0, 0, radius));
    assert(heartTouchesBullet(b(radius - .01, -1), 0, 0, radius));
    previous = radius;
  }
}
console.log('[steam heart] PASS: edges, corners, overlaps, long words, all guts and condition tiers');
