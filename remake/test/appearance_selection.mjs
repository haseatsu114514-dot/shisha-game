// node --experimental-vm-modules remake/test/appearance_selection.mjs
// Production selection/save modules, minimal DOM and Storage fixtures; no images.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const catalogPath = "asset_sources/shisha-hardware-reference/skin-candidates-issue374/candidates.json";
const document = JSON.parse(fs.readFileSync(path.join(root, catalogPath)));
const equipment = JSON.parse(fs.readFileSync(path.join(root, "data/equipment.json"))).equipment;
const files = ["appearance/model.js", "appearance/select.js", "core/state.js", "core/util.js", "core/rules.js", "core/bus.js", "core/gallery-progress.js",
  "craft/steps.js", "craft/coals.js", "craft/temperature-model.js"];
const texts = new Map(files.map(file => ["/remake/js/" + file, fs.readFileSync(path.join(root, "remake/js", file), "utf8")]));

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.handlers = {}; this.value = "";
    this.style = { setProperty() {} }; this.classList = { add() {}, remove() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  setAttribute(key, value) { this.attrs[key] = value; }
  click() { if (!("disabled" in this.attrs)) this.handlers.click?.(); }
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const copy = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const cases = [];
async function check(label, body) { await body(); cases.push(label); console.log(`PASS: ${label}`); }

async function fixture() {
  const storage = new Map(); let failWrites = false, auto = false, fetchError = null;
  let panel = new Element("section"); const requests = [], notices = [];
  const context = vm.createContext({ console, URL, AbortController, setTimeout, clearTimeout,
    Node: Element,
    document: { createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element("#text"), { textContent: text }) },
    localStorage: { getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key),
      setItem: (key, value) => { if (failWrites) throw new Error("quota"); storage.set(key, String(value)); } },
    fetch: async url => {
      requests.push(String(url)); if (fetchError) throw fetchError;
      return { ok: true, json: async () => copy(document) };
    },
  });
  const stubs = new Map([
    ["/remake/js/core/data.js", { DB: { equipById: Object.fromEntries(equipment.map(item => [item.id, item])) } }],
    ["/remake/js/core/ui.js", { toast: message => notices.push(message) }],
    ["/remake/js/core/audio.js", { SE: { select() {} } }],
    ["/remake/js/craft/common.js", { autoSkill: () => auto }],
    ["/remake/js/craft/flavor-guide.js", { equipmentUse: () => ({ use: "fixture" }), equipmentGuide: () => new Element("section") }],
    ["/remake/js/craft/session.js", { stepPanel: () => (panel = new Element("section")), waitBenchReady: async () => {}, refreshBench() {} }],
  ]);
  // Fail on unexpected dependency calls; unused gameplay/rendering is not simulated.
  for (const [url, text] of texts) for (const match of text.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const target = path.posix.resolve(path.posix.dirname(url), match[2]);
    if (texts.has(target)) continue;
    if (!stubs.has(target)) stubs.set(target, {});
    for (const name of match[1].split(",").map(name => name.trim())) if (!(name in stubs.get(target))) {
      stubs.get(target)[name] = () => { throw new Error(`Unexpected dependency ${target}:${name}`); };
    }
  }
  const modules = new Map();
  const moduleFor = url => {
    if (!modules.has(url)) {
      if (texts.has(url)) modules.set(url, new vm.SourceTextModule(texts.get(url), { context, identifier: url,
        initializeImportMeta: meta => { meta.url = pathToFileURL(path.join(root, url)).href; } }));
      else {
        const values = stubs.get(url); assert(values, `Unknown module ${url}`);
        modules.set(url, new vm.SyntheticModule(Object.keys(values), function () {
          for (const [key, value] of Object.entries(values)) this.setExport(key, value);
        }, { context, identifier: url }));
      }
    }
    return modules.get(url);
  };
  const entry = new vm.SourceTextModule(`import * as model from '/remake/js/appearance/model.js';
    import * as select from '/remake/js/appearance/select.js';import * as core from '/remake/js/core/state.js';
    import * as steps from '/remake/js/craft/steps.js';export {model,select,core,steps};`, { context });
  await entry.link((specifier, parent) => moduleFor(path.posix.resolve(path.posix.dirname(parent.identifier), specifier)));
  await entry.evaluate();
  return { ...entry.namespace, requests, notices, storage,
    get panel() { return panel; },
    newPanel: () => (panel = new Element("section")),
    failWrites: value => { failWrites = value; }, auto: value => { auto = value; }, failFetch: value => { fetchError = value; },
    control: id => { const node = descendants(panel).find(node => node.dataset.test === id); assert(node, id); return node; },
  };
}

await check("catalog is the source of four approved IDs and names; hold and wrong approval are excluded", async () => {
  const { model } = await fixture(); const options = model.appearanceOptions(document);
  assert.deepEqual(copy(options), {
    handle: document.items.filter(item => item.category === "handle").map(({ id, name }) => ({ id, name })),
    mouthpiece: document.items.filter(item => item.category === "mouthpiece").map(({ id, name }) => ({ id, name })),
  });
  const altered = copy(document);
  altered.items.push({ ...altered.items[0], id: "hold", approved: false }, { ...altered.items[0], id: "pending", status: "hold" });
  assert.deepEqual(copy(model.appearanceOptions(altered)), copy(options));
  altered.items.push(copy(altered.items[0])); assert.throws(() => model.appearanceOptions(altered), /Invalid approved/);
  for (const invalid of [null, {}, { items: [] }]) assert.throws(() => model.appearanceOptions(invalid));
});

await check("unselected, malformed, unknown and category-swapped IDs normalize to null without mutation", async () => {
  const { model } = await fixture(), options = model.appearanceOptions(document);
  for (const value of [undefined, null, true, [], "handle", { handle: true, mouthpiece: {} },
    { handle: "unknown", mouthpiece: options.handle[0].id }]) {
    assert.deepEqual(copy(model.normalizeAppearance(value, options)), { handle: null, mouthpiece: null });
  }
  const input = { handle: options.handle[0].id, mouthpiece: "unknown", equip: "silicone_bowl" };
  assert.deepEqual(copy(model.normalizeAppearance(input, options)), { handle: input.handle, mouthpiece: null });
  assert.equal(input.mouthpiece, "unknown");
});

await check("all four handle/mouthpiece combinations and each category cleared independently", async () => {
  const { model } = await fixture(), options = model.appearanceOptions(document);
  for (const h of options.handle) for (const m of options.mouthpiece) {
    const value = { handle: h.id, mouthpiece: m.id };
    assert.deepEqual(copy(model.normalizeAppearance(value, options)), value);
    for (const key of ["handle", "mouthpiece"]) assert.deepEqual(copy(model.normalizeAppearance({ ...value, [key]: null }, options)), { ...value, [key]: null });
  }
});

await check("standalone chooser confirms only appearance, cancellation preserves state and reentry restores selection", async () => {
  const f = await fixture(); const options = f.model.appearanceOptions(document); f.core.newGame();
  const before = copy(f.core.state);
  let pending = f.select.configureAppearance(f.core.state, f.newPanel); await flush();
  const h = f.control("appearance-handle"), m = f.control("appearance-mouthpiece");
  assert.equal(h.value, ""); h.value = options.handle[0].id; h.handlers.change(); m.value = options.mouthpiece[1].id; m.handlers.change();
  f.control("appearance-confirm").click(); await pending;
  const selected = { handle: h.value, mouthpiece: m.value };
  assert.deepEqual(copy(f.core.state), { ...before, appearance: selected });
  pending = f.select.configureAppearance(f.core.state, f.newPanel); await flush();
  assert.equal(f.control("appearance-handle").value, selected.handle);
  f.control("appearance-handle").value = ""; f.control("appearance-handle").handlers.change();
  f.control("appearance-cancel").click(); await pending;
  assert.deepEqual(copy(f.core.state.appearance), selected);
  pending = f.select.configureAppearance(f.core.state, f.newPanel); await flush();
  assert.equal(f.control("appearance-handle").value, selected.handle);
  for (const key of ["handle", "mouthpiece"]) { const select = f.control("appearance-" + key); select.value = ""; select.handlers.change(); }
  f.control("appearance-confirm").click(); await pending;
  assert.deepEqual(copy(f.core.state.appearance), { handle: null, mouthpiece: null });
  assert(f.requests.every(url => url.endsWith(catalogPath)), "only source JSON requested, no images");
});

await check("new selection survives autosave and all manual slot loads; save/load failures preserve progress", async () => {
  const f = await fixture(), options = f.model.appearanceOptions(document); f.core.newGame();
  let pending = f.select.configureAppearance(f.core.state, f.newPanel); await flush();
  for (const [key, id] of [["handle", options.handle[1].id], ["mouthpiece", options.mouthpiece[0].id]]) {
    const select = f.control("appearance-" + key); select.value = id; select.handlers.change();
  }
  f.control("appearance-confirm").click(); await pending;
  const selected = copy(f.core.state.appearance), invariant = copy({ owned: f.core.state.owned, equip: f.core.state.equip, stats: f.core.state.stats, money: f.core.state.money });
  f.core.save(); for (const slot of f.core.SAVE_SLOTS) if (!slot.auto) assert.equal(f.core.saveToSlot(slot.key), true);
  for (const slot of f.core.SAVE_SLOTS) {
    f.core.newGame(); assert.deepEqual(copy(f.model.normalizeAppearance(f.core.state.appearance, options)), { handle: null, mouthpiece: null });
    const loaded = slot.auto ? f.core.load() : f.core.loadFromSlot(slot.key);
    assert.deepEqual(copy(loaded.appearance), selected);
    assert.deepEqual(copy({ owned: loaded.owned, equip: loaded.equip, stats: loaded.stats, money: loaded.money }), invariant);
  }
  const before = new Map(f.storage); f.failWrites(true); assert.equal(f.core.saveToSlot("suien_remake_slot1"), false);
  assert.deepEqual(f.storage, before); assert.deepEqual(copy(f.core.state.appearance), selected); f.failWrites(false);
  for (const invalid of ["{broken", "null"]) { f.storage.set("suien_remake_slot2", invalid); assert.equal(f.core.loadFromSlot("suien_remake_slot2"), null); assert.deepEqual(copy(f.core.state.appearance), selected); }
  pending = f.select.configureAppearance(f.core.state, f.newPanel); await flush();
  for (const key of ["handle", "mouthpiece"]) { const select = f.control("appearance-" + key); select.value = ""; select.handlers.change(); }
  f.control("appearance-confirm").click(); await pending;
  f.core.save(); f.core.newGame(); f.core.load();
  assert.deepEqual(copy(f.core.state.appearance), { handle: null, mouthpiece: null });
  assert.deepEqual(copy({ owned: f.core.state.owned, equip: f.core.state.equip, stats: f.core.state.stats, money: f.core.state.money }), invariant);
});

await check("catalog failure preserves state; manual and auto setup never request the catalog", async () => {
  const f = await fixture(); f.core.newGame();
  f.core.state.appearance = { handle: "saved-handle", mouthpiece: "saved-mouthpiece" };
  const before = copy(f.core.state);
  f.failFetch(new Error("offline"));
  await assert.rejects(f.select.configureAppearance(f.core.state, f.newPanel), /offline/);
  assert.deepEqual(copy(f.core.state), before);
  const requests = f.requests.length;
  for (const auto of [false, true]) for (const mode of ["practice", "tournament", "rehearsal", "tutorial"]) {
    f.auto(auto);
    await f.steps.stepSetup({ mode, equip: { ...f.core.state.equip } });
    assert.equal(f.requests.length, requests);
    assert.deepEqual(copy(f.core.state), before);
    assert.equal(f.notices.length, 0);
  }
});

await check("#1927 sold Lotos: incompatible bowls stay disabled and pending setup preserves saved equipment", async () => {
  for (const auto of [false, true]) {
    const f = await fixture(); f.core.newGame(); f.auto(auto);
    f.core.state.owned = ["silicone_bowl", "suyaki_hagal", "tanukish_lid", "flat_charcoal"];
    f.core.state.equip.hms = "tanukish_lid";
    const before = copy(f.core.state), cs = { mode: "practice", equip: { ...before.equip } };
    const pending = f.steps.stepSetup(cs); await flush();
    assert.equal(f.control("opt-suyaki_hagal").attrs.disabled, "");
    f.control("opt-suyaki_hagal").click(); await flush();
    assert.deepEqual(copy(f.core.state), before, "blocked/pending input must not commit equipment");
    if (!auto) f.control("opt-silicone_bowl").click();
    await pending;
    assert.equal(cs.equip.hms, "tanukish_lid");
    for (const id of Object.values(cs.equip)) assert(f.core.state.owned.includes(id), id);
    assert.deepEqual(copy(f.core.state.owned), before.owned);
  }
});

await check("#1927 owned Lotos remains selectable; empty HMD inventory cannot generate equipment", async () => {
  const f = await fixture(); f.core.newGame();
  f.core.state.owned.push("suyaki_hagal");
  const cs = { mode: "tutorial", equip: { ...f.core.state.equip } };
  let pending = f.steps.stepSetup(cs); await flush();
  f.control("opt-suyaki_hagal").click(); await pending;
  assert.equal(cs.equip.bowl, "suyaki_hagal"); assert.equal(cs.equip.hms, "lotos_hagal");
  f.core.state.owned = f.core.state.owned.filter(id => id !== "lotos_hagal");
  const before = copy(f.core.state);
  await assert.rejects(f.steps.stepSetup({ mode: "practice", equip: { ...before.equip } }), /対応する所持機材/);
  assert.deepEqual(copy(f.core.state), before);
});

console.log(`appearance selection: ${cases.length} cases passed (DOM/Storage fixture; no renderer or physical-fit QA)`);
