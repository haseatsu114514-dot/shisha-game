import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const hudEvents = ["hud", "money", "exp-gain", "level-up", "hidane-gift"];
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const context = vm.createContext({
  clearTimeout() {},
  document: { body: {} },
  window: { addEventListener() {} },
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
});

// 実際の bus を使い、テスト内だけで購読件数を読めるようにする。
const bus = new vm.SourceTextModule(await read("../js/core/bus.js") + `
export const listenerCount = (event) => handlers.get(event)?.size ?? 0;
`, { context });
const count = (event) => bus.namespace.listenerCount(event);
const beforeRebind = [];
const dependencies = {
  "../core/city-locations.js": { HOME_CITY_EN: "Yuzugaya", currentCity: undefined },
  "../core/util.js": { el: () => ({ append() {} }), yen: undefined, sleep: undefined },
  "../core/ui.js": {
    layers: { hud: { replaceChildren: () => beforeRebind.push(hudEvents.map(count)) } },
    toast: undefined, gainCard: undefined,
  },
  "../core/audio.js": { SE: undefined },
  "../core/state.js": { state: undefined },
  "../core/stats.js": { staminaRatio: undefined, currentCondition: undefined, maxStamina: undefined },
  "../core/condition.js": { conditionForRatio: undefined },
  "./weather.js": { isRainy: undefined },
  "../core/chapter-clock.js": {
    chapterDay: undefined, chapterDaysLeft: undefined, chapterFinalDay: undefined,
    chapterGoalLabel: undefined, departurePrep: undefined,
  },
  "../core/growth.js": { growthEnabled: undefined, growthView: undefined, gaugeInfo: undefined, hidaneTotal: undefined },
  "../core/growth-board.js": { NODE_BY_ID: {}, pathTo: undefined },
  "../core/growth-effects.js": { boardPerks: () => ({ stamina: 0 }), LESSON_TUNING: { stamina: 0 } },
};
const hud = new vm.SourceTextModule(await read("../js/daily/hud.js"), { context });
await hud.link((specifier) => {
  if (specifier === "../core/bus.js") return bus;
  const exports = dependencies[specifier];
  assert.ok(exports, `Unexpected HUD dependency: ${specifier}`);
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  }, { context });
});
await hud.evaluate();

let otherMoneyCalls = 0;
bus.namespace.on("money", () => { otherMoneyCalls++; });
const otherListeners = hudEvents.map((event) => event === "money" ? 1 : 0);
const withHud = otherListeners.map((count) => count + 1);
for (let init = 1; init <= 3; init++) {
  hud.namespace.initHud({});
  assert.deepEqual(hudEvents.map(count), withHud, `one listener per HUD event after initHud ${init}: ${hudEvents.join(", ")}`);
  assert.deepEqual(beforeRebind.at(-1), otherListeners, `previous HUD listeners released before rebind ${init}`);
  assert.equal(count("stamina-change"), 1, `module-lifetime subscription after initHud ${init}`);
}
bus.namespace.emit("money", { delta: 0 });
assert.equal(otherMoneyCalls, 1, "initHud must preserve the other money listener");

console.log("[HUD] PASS: three initializations each replace one set of HUD bus subscriptions");
