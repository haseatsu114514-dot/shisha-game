import assert from "node:assert/strict";
import { fitStage, initStageFit } from "../js/core/stage-fit.js";

const listeners = new Map();
const visualListeners = new Map();
const timers = new Map();
const originalWindow = globalThis.window;
const originalDocument = globalThis.document;
const originalSetTimeout = globalThis.setTimeout;
const root = { dataset: {} };
const properties = new Map();
const stage = {
  dataset: {},
  style: {
    setProperty: (key, value) => properties.set(key, value),
    removeProperty: (key) => properties.delete(key),
  },
};
const visualViewport = {
  width: 844, height: 360, scale: 1,
  addEventListener: (name, callback) => visualListeners.set(name, callback),
};

try {
  globalThis.window = {
    innerWidth: 1000, innerHeight: 500, visualViewport,
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  globalThis.document = { documentElement: root };
  globalThis.setTimeout = (callback, delay) => { timers.set(delay, callback); return delay; };

  const k = initStageFit(stage);
  assert.equal(typeof k, "function");
  assert.equal(Number(properties.get("--k")), 0.5); // URL bar visible: 360 / 720
  assert.deepEqual([...timers.keys()], [100, 500, 1000]);

  visualViewport.height = 390;
  timers.get(100)(); // URL bar hidden after initial layout
  assert.equal(Number(properties.get("--k")), 390 / 720);

  visualViewport.width = 390;
  visualViewport.height = 844;
  listeners.get("orientationchange")();
  assert.equal([...timers.keys()].includes(200), true);
  timers.get(200)(); // just after rotation
  assert.equal(Number(properties.get("--k")), 390 / 1280);

  visualViewport.width = 844;
  visualViewport.height = 390;
  visualListeners.get("resize")();
  assert.equal(Number(properties.get("--k")), 390 / 720);
  visualViewport.height = 360;
  visualListeners.get("scroll")();
  assert.equal(Number(properties.get("--k")), 0.5);
  visualViewport.height = 390;
  listeners.get("resize")();
  assert.equal(Number(properties.get("--k")), 390 / 720);

  // Safari 相当: visualViewport と inner size が同じなら従来の倍率。
  window.innerWidth = 1280;
  window.innerHeight = 720;
  visualViewport.width = 1280;
  visualViewport.height = 720;
  assert.equal(fitStage(stage), 1);
  visualViewport.width = 844;
  visualViewport.height = 390;
  assert.equal(fitStage(stage), 390 / 720);

  // ブラウザ拡大時も見えている CSS pixel の寸法をそのまま採用する。
  visualViewport.width = 422;
  visualViewport.height = 195;
  visualViewport.scale = 2;
  assert.equal(fitStage(stage), 195 / 720);

  // visualViewport が未提供・初期寸法未確定なら inner size に戻す。
  window.innerWidth = 1000;
  window.innerHeight = 500;
  window.visualViewport = undefined;
  assert.equal(fitStage(stage), 500 / 720);
  window.visualViewport = { width: 0, height: 0 };
  assert.equal(fitStage(stage), 500 / 720);

  // 試遊ページはナビの下の領域を優先する。
  assert.equal(fitStage(stage, { clientWidth: 800, clientHeight: 360 }), 0.5);
  console.log("stage_fit_3173: PASS");
} finally {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
  globalThis.setTimeout = originalSetTimeout;
}
