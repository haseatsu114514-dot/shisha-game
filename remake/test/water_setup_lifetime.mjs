// node remake/test/water_setup_lifetime.mjs
import assert from "node:assert/strict";
import { confirmWaterSetup } from "./browser/water_setup.mjs";

for (const touch of [false, true]) {
  const calls = [];
  const page = {
    async waitForSelector(selector, options) {
      assert.equal(selector, '[data-test="water-confirm"]');
      assert.deepEqual(options, { state: "visible" }); calls.push("visible");
      return {
        async scrollIntoViewIfNeeded() { calls.push("scroll"); },
        async click() { calls.push("click"); }, async tap() { calls.push("tap"); },
        async dispose() { calls.push("dispose"); },
      };
    },
    locator() { assert.fail("must not re-query another view after visible wait"); },
  };
  await confirmWaterSetup(page, { touch });
  assert.deepEqual(calls, ["visible", "scroll", touch ? "tap" : "click", "dispose"]);
}
let clicks = 0, disposed = 0;
const detached = new Error("old view detached");
await assert.rejects(confirmWaterSetup({
  async waitForSelector() { return {
    async scrollIntoViewIfNeeded() { throw detached; },
    async click() { clicks++; }, async tap() { clicks++; }, async dispose() { disposed++; },
  }; },
  locator() { assert.fail("cancelled view must not resolve a replacement locator"); },
}), error => error === detached);
assert.equal(clicks, 0); assert.equal(disposed, 1);
const missing = new Error("visible wait failed");
await assert.rejects(confirmWaterSetup({ async waitForSelector() { throw missing; } }), error => error === missing);
console.log("PASS 4 new water helper lifetime cases: mouse/touch pinned input, detached failure cleanup, missing wait propagation");
