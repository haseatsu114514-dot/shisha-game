// #872 水入れミニゲーム（試遊）の計算：水量⇔水位、傾けたときにこぼれる量、目安線との判定。
import assert from "node:assert/strict";
import {
  POUR, interior, capacityArea, areaBelow, rotatedInterior, surfaceY, holdable, volumeAtLevel,
  levelErrorMm, gradePour, formatError, pickTarget, toMl,
} from "../js/craft/water-pour.js";

const DEG = Math.PI / 180;

// ガラス内側の輪郭：上から下へ、左右が入れ替わらない。
for (let i = 0; i < interior.length / 2; i++) {
  const [x, y] = interior[i], [rx, ry] = interior[interior.length - 1 - i];
  assert.equal(y, ry);
  assert.ok(x < rx, `row ${y}: inner left must stay left of right`);
}
assert.ok(capacityArea > 300000 && capacityArea < 450000);
assert.equal(Math.round(toMl(capacityArea)), POUR.totalMl);

// 水位⇔水量は往復で一致し、水を足すほど水面は上がる（yが小さくなる）。
let previous = Infinity;
for (let y = 150; y <= 940; y += 35) {
  const v = volumeAtLevel(y);
  assert.ok(Math.abs(surfaceY(v, 0) - y) < .05, `level ${y}`);
  assert.ok(v < previous || y === 150);
  previous = v;
}
assert.equal(surfaceY(0, 0), Math.max(...interior.map(p => p[1])));
assert.equal(surfaceY(capacityArea * 2, 0), Math.min(...interior.map(p => p[1])));

// 首は細いので、同じ量を足しても胴より水位が速く上がる。
const rise = (y, add) => y - surfaceY(volumeAtLevel(y) + add, 0);
assert.ok(rise(300, 8000) > rise(650, 8000) * 2);

// 傾けても水の量は変わらない（面積が保存される）。
for (const deg of [0, 30, 60, 90]) {
  const points = rotatedInterior(deg * DEG), v = volumeAtLevel(630);
  assert.ok(Math.abs(areaBelow(points, surfaceY(v, deg * DEG, points)) - v) < 30, `tilt ${deg}`);
}

// 立てたままではこぼれず、倒すほど入っていられる量が減る。
assert.ok(Math.abs(holdable(0) - capacityArea) / capacityArea < .02);
let last = Infinity;
for (let deg = 0; deg <= 105; deg += 5) {
  const hold = holdable(deg * DEG);
  assert.ok(hold <= last + 1, `holdable must not grow at ${deg}deg`);
  last = hold;
}
// 目安線あたりの水は、少し傾けただけではこぼれず、しっかり倒すとこぼれる。
for (const y of POUR.targetRange) {
  const v = volumeAtLevel(y);
  assert.ok(holdable(40 * DEG) > v, `no spill at 40deg for line ${y}`);
  assert.ok(holdable(100 * DEG) < v, `spills at 100deg for line ${y}`);
}

// 判定は実水量だけ。正＝入れすぎ、負＝足りない。
const target = 630;
assert.ok(Math.abs(levelErrorMm(volumeAtLevel(target), target)) < .02);
assert.ok(levelErrorMm(volumeAtLevel(target - 2 * POUR.pxPerMm), target) > 1.9);
assert.ok(levelErrorMm(volumeAtLevel(target + 2 * POUR.pxPerMm), target) < -1.9);
assert.equal(gradePour(0).kind, "perfect");
assert.equal(gradePour(-1).kind, "perfect");
assert.equal(gradePour(1.01).kind, "great");
assert.equal(gradePour(-2.5).kind, "great");
assert.equal(gradePour(4.9).kind, "good");
assert.deepEqual([gradePour(5.1).kind, gradePour(5.1).label], ["miss", "入れすぎ"]);
assert.deepEqual([gradePour(-7).kind, gradePour(-7).label], ["miss", "足りない"]);
assert.equal(formatError(0.01), "±0.0mm");
assert.equal(formatError(1.24), "+1.2mm");
assert.equal(formatError(-3.06), "−3.1mm");

// 目安線は胴の上側の範囲から選ぶ。
assert.equal(pickTarget(() => 0), POUR.targetRange[0]);
assert.equal(pickTarget(() => .999999), POUR.targetRange[1]);
for (let i = 0; i < 50; i++) {
  const y = pickTarget();
  assert.ok(y >= POUR.targetRange[0] && y <= POUR.targetRange[1]);
}

console.log("water_pour: ok");
