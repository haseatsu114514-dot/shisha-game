// 新版の「場所の光」（BGU01）: 背景の平均色から、立ち絵へ乗算で重ねる色を決める規則。
// 画面での重なり・背景の切り替えへの追従は browser/look_neo.mjs で確かめる。
import assert from "node:assert/strict";
import { ambientColor, ambientCss, AMBIENT_FLOOR, AMBIENT_CAST } from "../js/looks/neo/ambient.js";

const WHITE = [255, 255, 255];
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// 1. 明るい場所では人物を変えない（白を乗算＝そのまま）。
assert.deepEqual(ambientColor([200, 200, 200]), WHITE, "明るい無彩色の場所");
assert.deepEqual(ambientColor([128, 128, 128]), WHITE, "ちょうど境目の明るさ");
assert.deepEqual(ambientColor([255, 255, 255]), WHITE);

// 2. 暗い場所では暗くするが、下限（FLOOR）より暗くしない。色の無い場所では色を付けない。
const floor = Math.round(255 * AMBIENT_FLOOR);
assert.deepEqual(ambientColor([0, 0, 0]), [floor, floor, floor], "真っ暗でも人物は下限の明るさ");
const dim = ambientColor([70, 70, 70]);
assert(dim[0] === dim[1] && dim[1] === dim[2], `無彩色の場所は無彩色のまま ${dim}`);
assert(dim[0] < 255 && dim[0] > floor, `薄暗い場所は少しだけ暗い ${dim}`);

// 3. 色の付いた暗い場所（暖色の店内）では、その色へ寄る。寄せるのは CAST まで。
const eden = ambientColor([92, 56, 30]);
assert(eden[0] > eden[1] && eden[1] > eden[2], `暖色の店では赤＞緑＞青 ${eden}`);
const lowest = 255 * AMBIENT_FLOOR * (1 - AMBIENT_CAST);
for (const mean of [[255, 0, 0], [0, 0, 255], [10, 60, 140], [200, 20, 120], [40, 0, 0]]) {
  const color = ambientColor(mean);
  assert(Math.min(...color) >= Math.floor(lowest), `どんな色の場所でも、色の成分は下限より落とさない ${mean} → ${color}`);
  assert(Math.max(...color) <= 255);
}
const blue = ambientColor([10, 60, 140]);
assert(blue[2] > blue[1] && blue[1] > blue[0], `青い場所（水族館）では青＞緑＞赤 ${blue}`);

// 4. 明るい場所ほど人物も明るい（無彩色は真っ暗から、色のある場所は色味を信じられる明るさから単調）。
for (const [from, tone] of [[0, [1, 1, 1]], [40, [1, 0.8, 0.6]], [40, [0.5, 0.7, 1]]]) {
  let before = -1;
  for (let level = from; level <= 200; level += 10) {
    const now = luma(ambientColor(tone.map((k) => level * k)));
    assert(now >= before, `色味 ${tone} の明るさ ${level} で暗くならない`);
    before = now;
  }
}
// ほぼ真っ黒な場所は色味が当てにならないので、強い色を付けない（わずかに赤いだけの黒で人物を赤くしない）。
const nearBlack = ambientColor([3, 0, 0]);
assert(nearBlack[0] - nearBlack[2] <= 8, `ほぼ真っ黒な場所はほぼ無彩色 ${nearBlack}`);

// 5. 夜の色調補正（昼の絵を夜に見せる）と暗転は、同じ絵でもさらに暗い側へ寄せる。夜は紺へ寄る。
const day = [150, 140, 120];
const night = ambientColor(day, "night");
assert(luma(night) < luma(ambientColor(day)), `夜の補正は昼より暗い ${night}`);
assert(night[2] >= night[0], `夜の補正は紺へ寄る ${night}`);
assert(luma(ambientColor(day, "dim")) < luma(ambientColor(day)), "暗転の補正は暗い");
assert.deepEqual(ambientColor(day, "unknown"), ambientColor(day), "知らない補正は無視する");

// 6. 壊れた値でも色として返す。
for (const mean of [[NaN, 10, 10], [-5, 300, 10], ["a", null, undefined]]) {
  const color = ambientColor(mean);
  assert(color.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `${mean} → ${color}`);
}

assert.equal(ambientCss([204, 180, 163]), "rgb(204, 180, 163)");
console.log("neo ambient ok");
