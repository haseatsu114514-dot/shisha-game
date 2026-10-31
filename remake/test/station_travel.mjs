// node --experimental-vm-modules remake/test/station_travel.mjs
// 実map/model/stateを使用。描画・音・素材通信は代替し、実ブラウザ検証とは区別する。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
const rootPath = path.resolve(new URL("../js/", import.meta.url).pathname);
class Element {
  constructor(spec = "div", attrs = {}, children = []) {
    if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
    this.tagName = spec.split(".")[0]; this.classes = new Set(spec.split(".").slice(1));
    this.dataset = {}; this.children = []; this.attributes = {}; this.style = { setProperty() {} };
    this.classList = { add: (...a) => a.forEach(x => this.classes.add(x)), remove: (...a) => a.forEach(x => this.classes.delete(x)),
      contains: x => this.classes.has(x), toggle: (x, on) => on ? this.classes.add(x) : this.classes.delete(x) };
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "dataset") Object.assign(this.dataset, v);
      else if (k === "text") this.textContent = v;
      else this[k] = v;
    }
    this.append(...children);
  }
  get isConnected() { return this === screen || !!this.parent?.isConnected; }
  append(...children) { for (const c of children.filter(x => x != null)) { this.children.push(c); if (typeof c === "object") c.parent = this; } }
  replaceChildren(...children) { this.children.forEach(c => { if (typeof c === "object") c.parent = null; }); this.children = []; this.textContent = ""; this.append(...children); }
  setAttribute(k, v) { this.attributes[k] = v; }
  querySelectorAll(sel) {
    const match = n => sel.startsWith(".") ? n.classes.has(sel.slice(1))
      : sel.startsWith("[data-test=") ? n.dataset.test === sel.slice(11, -1).replaceAll('"', "") : false;
    return this.children.flatMap(c => typeof c === "object" ? [...(match(c) ? [c] : []), ...c.querySelectorAll(sel)] : []);
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  click() { if (!this.disabled) return this.onclick?.(); }
}
const screen = new Element(), storage = new Map();
const noop = () => {}, yes = () => true;
let backgrounds = 0, transitionRelease = null;
let rides = 0, lastRide = null;
const toasts = [];
const document = { hidden: false, body: new Element("body"), querySelector: s => screen.querySelector(s), getElementById: () => null };
const context = vm.createContext({ console, document, setTimeout, clearTimeout, localStorage: {
  getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v),
  removeItem: () => { throw Error("existing saves must not be deleted"); },
} });
const mocks = {
  "core/growth.js": { growthEnabled: () => false, hidaneTotal: () => 0 },
  "core/scene-motions.js": { trainRide: async (mid, opts) => { rides++; lastRide = opts; await mid(); } },
  "core/util.js": { el: (...a) => new Element(...a), yen: n => `${n}円` },
  "core/data.js": { bgUrl: x => x, sceneBg: () => ({}), faceIconUrl: noop, displayName: noop },
  "core/ui.js": { showScreen: (_, node) => screen.replaceChildren(node), setBg: async () => { backgrounds++; if (transitionRelease) await transitionRelease.promise; },
    retire: n => n.classList.add("done"), uiArtReady: noop, storeLogosReady: noop, imageReady: yes, layers: { fx: new Element() }, toast: t => toasts.push(t) },
  "core/transitions.js": { cueTransition: noop }, "core/scene-art.js": { renderSceneArt: noop, sceneArtUrls: () => [] },
  "core/audio.js": { SE: { click: noop, select: noop } }, "core/stats.js": { AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], setStoryAffinityCap() {}, releaseStoryAffinity: () => 0, affinityGateWaiting: () => false, STAMINA_LOW: 20 },
  "daily/spots.js": { allSpots: () => [], SPOT_PREVIEW: {}, isUnlocked: yes, hasNewEvent: noop, spotDetailLabel: s => s.label },
  "daily/hud.js": { updateHud: noop }, "daily/home-rig.js": { homeRig: noop }, "daily/reel.js": { mountReel: noop },
  "daily/weather.js": { isRainy: noop }, "daily/fortune.js": { fortuneToday: noop },
  "daily/spot-access.js": { spotVisible: yes, spotAvailability: () => ({ ok: true }), freeGuide: noop },
  "daily/spot-hours.js": { spotTimeNote: noop }, "daily/street.js": { openStreet: noop, canWalkStreet: noop, WALK_STREET: Symbol(), BACK_TO_MAP: Symbol() },
  "daily/spot-people.js": { spotPeople: () => [] }, "core/store-logos.js": { hasStoreLogo: noop, storeLogo: noop },
  "daily/map-reveals.js": { newlyRevealedSpots: () => [], startSpotReveal: noop, spotRevealNotice: noop },
  "daily/facility-icons.js": { createMapFacilityIcon: noop, hasFacilityIcon: noop, FACILITY_SHEET: "fixture" },
};
const modules = new Map();
async function moduleAt(id) {
  if (modules.has(id)) return modules.get(id);
  let m;
  if (mocks[id]) m = new vm.SyntheticModule(Object.keys(mocks[id]), function () {
    for (const [k, v] of Object.entries(mocks[id])) this.setExport(k, v);
  }, { context, identifier: id });
  else m = new vm.SourceTextModule(await fs.readFile(path.join(rootPath, id), "utf8"), { context, identifier: id });
  modules.set(id, m);
  await m.link((spec, parent) => moduleAt(path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier), spec))));
  return m;
}
async function load(id) { const m = await moduleAt(id); if (m.status !== "evaluated") await m.evaluate(); return m.namespace; }
const core = await load("core/state.js"), travel = await load("daily/station-travel.js"), map = await load("daily/map.js");
const regions = [{ id: "home", label: "地元・大須／栄", spots: [] }, { id: "widehanga", label: "隣町・柚ヶ谷", spots: [] }];
const fresh = (money = 1000) => {
  const s = core.newState(); Object.assign(s, { chapter: 2, day: 17, slot: 0, money });
  Object.assign(s.flags, { _ch2_region: "home", _ch2_preparation_started: true }); core.setState(s); return s;
};
const test = async (name, fn) => { await fn(); console.log(`PASS ${name}`); };
const button = name => screen.querySelector(`[data-test=${name}]`);
const open = async () => {
  const pending = map.chooseSpot({ regionId: core.state.flags._ch2_region, regions });
  for (let i = 0; i < 20 && !button("station-open"); i++) await new Promise(r => setTimeout(r, 0));
  assert.ok(button("station-open")); return { pending };
};
const choose = () => { button("station-open").click(); button("station-destination-widehanga").click(); };
await test("chapter1, first-day and unreleased cities blocked", () => {
  const s = fresh(); s.chapter = 1; assert.equal(travel.stationDestinations(s, regions).length, 0);
  s.chapter = 2; delete s.flags._ch2_preparation_started; assert.equal(travel.prepareStationTrip(s, regions, "widehanga"), null);
  s.flags._ch2_preparation_started = true;
  assert.equal(travel.prepareStationTrip(s, regions, "home"), null);
  assert.equal(travel.prepareStationTrip(s, [...regions, { id: "invented" }], "invented"), null);
  assert.equal(travel.prepareStationTrip(s, [regions[0], { ...regions[1], unlocked: false }], "widehanga"), null);
});
await test("cancel and insufficient funds do not charge; outbound reserves the return fare", () => {
  let s = fresh(199), t = travel.prepareStationTrip(s, regions, "widehanga");
  assert.equal(t.commit(s), false); assert.equal(s.money, 199);
  s.money = 200; t.cancel(); assert.equal(t.commit(s), false); assert.equal(s.money, 200);
  t = travel.prepareStationTrip(s, regions, "widehanga"); assert.equal(t.commit(s), false);
  s.money = 400; assert.equal(t.commit(s), true); assert.equal(s.money, 200);
  assert.equal(t.commit(s), false); assert.equal(s.flags._ch2_region, "widehanga");
  const back = travel.prepareStationTrip(s, regions, "home");
  assert.equal(back.commit(s), true); assert.equal(s.money, 0); assert.equal(s.flags._ch2_region, "home");
});
await test("fresh SAVE/LOAD keeps money and location together; slots preserved", () => {
  const s = fresh(); const untouched = "existing-slot-preserved"; storage.set("suien_remake_slot3", untouched);
  const t = travel.prepareStationTrip(s, regions, "widehanga"); assert.equal(t.commit(s, { persist: core.save }), true);
  const raw = JSON.parse(storage.get(core.SAVE_KEY)); assert.equal(raw.money, 800); assert.equal(raw.flags._ch2_region, "widehanga");
  core.saveToSlot("suien_remake_slot1"); core.load(); assert.equal(core.state.money, 800); assert.equal(core.state.flags._ch2_region, "widehanga");
  assert.equal(t.commit(core.state), false); core.state.money = 7; core.loadFromSlot("suien_remake_slot1"); assert.equal(core.state.money, 800);
  assert.equal(core.state.flags._ch2_region, "widehanga"); assert.equal(storage.get("suien_remake_slot3"), untouched);
  assert.deepEqual([core.state.day, core.state.slot, core.state.stamina], [17, 0, s.stamina]);
});
await test("stale state, date, slot and interrupted screen rejected", () => {
  for (const change of [s => core.setState({ ...s }), s => s.day++, s => s.slot++, s => s.chapter++]) {
    const s = fresh(), t = travel.prepareStationTrip(s, regions, "widehanga"); change(s);
    assert.equal(t.commit(core.state), false); assert.equal(core.state.money, 1000);
  }
  const s = fresh(), t = travel.prepareStationTrip(s, regions, "widehanga"); assert.equal(t.commit(s, { active: false }), false);
});
await test("map destination selection, fare confirmation, cancel and funds guard", async () => {
  fresh(); await open(); assert.equal(button("map-region-widehanga"), null); choose();
  assert.match(button("station-confirm").textContent, /200円/); button("station-cancel").click(); assert.equal(core.state.money, 1000);
  choose(); const beforeRides = rides; await button("station-confirm").click();
  assert.equal(rides, beforeRides + 1); assert.equal(core.state.money, 800); assert.equal(screen.children[0].dataset.region, "widehanga");
  assert.deepEqual(JSON.parse(JSON.stringify(lastRide)), { from: "home", to: "widehanga" });
  button("station-open").click(); button("station-destination-home").click(); await button("station-confirm").click();
  assert.deepEqual(JSON.parse(JSON.stringify(lastRide)), { from: "widehanga", to: "home" });
  assert.equal(core.state.money, 600); assert.equal(core.state.flags._ch2_region, "home");
  map.interruptMap("__lime__"); screen.replaceChildren(); fresh(199); await open(); choose();
  assert.equal(button("station-confirm").disabled, true); button("station-confirm").click(); assert.equal(core.state.money, 199);
  map.interruptMap("__lime__"); screen.replaceChildren();
});
await test("double click during transition and interruption after payment never recharge", async () => {
  fresh(); await open(); choose();
  let release; transitionRelease = { promise: new Promise(r => { release = r; }) };
  const old = button("station-confirm"), once = old.click(); await old.onclick();
  assert.equal(core.state.money, 800); assert.equal(core.peekSave().flags._ch2_region, "widehanga");
  map.interruptMap("__lime__"); release(); transitionRelease = null; await once; await old.onclick(); assert.equal(core.state.money, 800);
  screen.replaceChildren(); core.load(); await open(); button("station-open").click();
  assert.ok(button("station-destination-home")); assert.equal(button("station-destination-widehanga"), null);
  map.interruptMap("__lime__"); screen.replaceChildren();
});
await test("interruption and LOAD before confirmation cancel without charge", async () => {
  fresh(); await open(); choose(); const old = button("station-confirm"); map.interruptMap("__lime__"); await old.onclick(); assert.equal(core.state.money, 1000);
  screen.replaceChildren(); fresh(); core.save(); await open(); choose(); const stale = button("station-confirm"); core.load(); await stale.onclick();
  assert.equal(core.state.money, 1000); assert.equal(core.state.flags._ch2_region, "home"); map.interruptMap("__lime__"); screen.replaceChildren();
});
await test("chapter1 map hides the station and blocks travel", async () => {
  fresh().chapter = 1; const pending = map.chooseSpot({ regions, regionId: "home" });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(button("station-open"), null);
  assert.equal(travel.prepareStationTrip(core.state, regions, "widehanga"), null);
  map.interruptMap("done"); await pending; screen.replaceChildren();
});
console.log(`PASS 8 station travel acceptance groups; backgrounds=${backgrounds}. Browser layout remains separately unverified.`);

// #951: 帰りの運賃が足りなければ、体力を使って歩いて地元へ帰れる。お金は増えない・使わない。
await test("walk home: only home-bound and short of fare; stamina clamps at 0; one-shot", () => {
  const away = (money, stamina) => { const s = fresh(money); s.flags._ch2_region = "widehanga"; s.stamina = stamina; return s; };
  for (const [money, stamina, after] of [[0, 90, 50], [199, 40, 0], [0, 1, 0], [0, 0, 0], [199, 39, 0]]) {
    const s = away(money, stamina), t = travel.prepareStationTrip(s, regions, "home");
    assert.equal(t.walkable(), true);
    assert.equal(t.commit(s, { walk: true }), true);
    assert.deepEqual([s.money, s.stamina, s.flags._ch2_region], [money, after, "home"]);
    assert.equal(t.commit(s, { walk: true }), false, "Second callback must not walk again");
    assert.equal(s.stamina, after);
  }
  const rich = away(200, 90), t = travel.prepareStationTrip(rich, regions, "home");
  assert.equal(t.walkable(), false); assert.equal(t.commit(rich, { walk: true }), false);
  assert.deepEqual([rich.money, rich.stamina, rich.flags._ch2_region], [200, 90, "widehanga"]);
  const out = fresh(0), outbound = travel.prepareStationTrip(out, regions, "widehanga");
  assert.equal(outbound.walkable(), false, "Walking is only the way back home");
  assert.equal(outbound.commit(out, { walk: true }), false);
  const cancelled = away(0, 80), c = travel.prepareStationTrip(cancelled, regions, "home"); c.cancel();
  assert.equal(c.commit(cancelled, { walk: true }), false); assert.equal(cancelled.stamina, 80);
  const stale = away(0, 80), st = travel.prepareStationTrip(stale, regions, "home"); stale.slot++;
  assert.equal(st.commit(stale, { walk: true }), false); assert.equal(stale.stamina, 80);
  const ch1 = away(0, 80); ch1.chapter = 1; assert.equal(travel.prepareStationTrip(ch1, regions, "home"), null);
});
await test("walk home on the map: saved with location, no train ride, no money", async () => {
  const s = fresh(150); s.flags._ch2_region = "widehanga"; s.stamina = 70; core.save();
  await open(); button("station-open").click(); button("station-destination-home").click();
  assert.equal(button("station-confirm"), null, "The disabled train button is replaced by walking");
  assert.match(button("station-walk").textContent, /かなり疲れる/);
  const beforeRides = rides; await button("station-walk").click();
  assert.equal(rides, beforeRides, "Walking does not play the train");
  assert.deepEqual([core.state.money, core.state.stamina, core.state.flags._ch2_region], [150, 30, "home"]);
  const raw = core.peekSave(); assert.deepEqual([raw.money, raw.stamina, raw.flags._ch2_region], [150, 30, "home"]);
  assert.match(toasts.at(-1), /歩いて/);
  await button("station-walk")?.onclick?.(); assert.equal(core.state.stamina, 30);
  map.interruptMap("__lime__"); screen.replaceChildren();
  const rich = fresh(500); rich.flags._ch2_region = "widehanga"; await open();
  button("station-open").click(); button("station-destination-home").click();
  assert.equal(button("station-walk"), null); assert.equal(button("station-confirm").disabled, false);
  map.interruptMap("__lime__"); screen.replaceChildren();
});
console.log("[station] PASS: walking home when the fare is short");
