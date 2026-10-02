import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";


class FakeImage {
  complete = false;
  naturalWidth = 0;
  decoding = "auto";
  fetchPriority = "auto";
  onload = null;
  onerror = null;

  set src(value) {
    this._src = value;
    if (value.includes("stall")) return;
    queueMicrotask(() => {
      this.complete = true;
      if (value.includes("missing")) {
        if (this.onerror) this.onerror(new Error("missing"));
      } else {
        this.naturalWidth = 64;
        if (this.onload) this.onload();
      }
    });
  }

  get src() { return this._src || ""; }
  decode() { return Promise.resolve(); }
}


const windowObject = {
  GAME_DATA: { build: { commit: "abc1234" }, loading_tips: [] },
  ASSET_DATA: null,
  requestIdleCallback: null,
};
const context = vm.createContext({
  window: windowObject,
  navigator: {},
  Image: FakeImage,
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
});
windowObject.window = windowObject;
vm.runInContext(fs.readFileSync(new URL("../js/engine.js", import.meta.url), "utf8"), context);

const versioned = vm.runInContext('assetUrl("assets/ui/making/bench_base.png")', context);
assert.equal(versioned, "../assets/ui/making/bench_base.png?v=abc1234");

const shared = vm.runInContext(`(() => {
  const a = loadOneImage("ok.png", { timeoutMs: 50 });
  const b = loadOneImage("ok.png", { timeoutMs: 50 });
  return a === b;
})()`, context);
assert.equal(shared, true, "同じURLのロードPromiseが共有されること");

const ok = await vm.runInContext('loadOneImage("ready.png", { timeoutMs: 50 })', context);
assert.equal(ok.ok, true);

const missing = await vm.runInContext('loadOneImage(assetUrl("missing.png"), { timeoutMs: 50 })', context);
assert.equal(missing.ok, false);
assert.equal(vm.runInContext('assetLoadFailed("missing.png")', context), true);

const started = Date.now();
const stalled = await vm.runInContext('loadOneImage("stall.png", { timeoutMs: 25 })', context);
assert.equal(stalled.ok, false);
assert.ok(Date.now() - started < 250, "停止した画像でもタイムアウトで復帰すること");

console.log("[loading] versioning / shared promise / decode / error / timeout OK");
