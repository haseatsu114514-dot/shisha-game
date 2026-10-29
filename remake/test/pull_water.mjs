// node remake/test/pull_water.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { waterComfort, STEM_TIP, WATER } from "../js/craft/water.js";
import { waterComfortLine } from "../js/craft/pull-water.js";

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
const cases = [
  [0, "none", 0, "吸い心地：スカスカで冷えない（ステムが水に届いていない）"],
  [STEM_TIP - 1e-9, "none", 0, "吸い心地：スカスカで冷えない（ステムが水に届いていない）"],
  [STEM_TIP, "shallow", .75, "吸い心地：喉に当たる（水が少ない）"],
  [WATER.low - 1e-9, "shallow", .75, "吸い心地：喉に当たる（水が少ない）"],
  [WATER.low, "ideal", 1, "吸い心地：すっきり（水ちょうど）"],
  [WATER.high, "ideal", 1, "吸い心地：すっきり（水ちょうど）"],
  [WATER.high + 1e-9, "deep", 1, "吸い心地：重い（水が多い）"],
  [1, "deep", 1, "吸い心地：重い（水が多い）"],
  [undefined, "ideal", 1, "吸い心地：すっきり（水ちょうど）"],
];

// 実際の doPull 内の開始処理を実行。音声入口を記録して、none の未開始と停止を確認する。
const source = fs.readFileSync(new URL("../js/craft/pull.js", import.meta.url), "utf8");
const start = source.match(/    const strength = [^\n]+;\n(?:    \/\/[^\n]*\n)*    stopBubbles = [^\n]+;/);
assert.ok(start, "doPull bubble start block exists");
for (const [water, band, bubble, line] of cases) {
  check(`${water}: ${band} coefficient and card text`, () => {
    assert.equal(waterComfort(water).band, band);
    assert.equal(waterComfort(water).bubble, bubble);
    assert.equal(waterComfortLine(water), line);
  });
  for (const id of ["down", "keep", "up"]) {
    check(`${water}: ${id} starts/stops only audible bubbles`, () => {
      const cs = { water }, before = structuredClone(cs), calls = [];
      let stops = 0;
      const context = { cs, z: { id }, waterComfort, startBubbling: options => {
        calls.push(options.strength); return () => { stops++; };
      } };
      vm.runInNewContext(`let stopBubbles; ${start[0]}\nstopBubbles();`, context);
      assert.deepEqual(calls, bubble ? [(id === "keep" ? .65 : 1) * bubble] : []);
      assert.equal(stops, bubble ? 1 : 0);
      assert.deepEqual(cs, before, "presentation does not mutate craft state");
    });
  }
}
check("all three result cards include the shared comfort line", () => {
  const cards = [...source.matchAll(/await resultCard\(panel, ([\s\S]*?)\);/g)];
  assert.equal(cards.length, 3);
  for (const [, card] of cards) assert.match(card, /lines:\s*\[[\s\S]*waterComfortLine\(cs\.water\)/);
});
console.log(`pull water: ${checks} passed, 0 failed`);
