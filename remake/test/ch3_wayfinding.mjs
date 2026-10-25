// Portable regression for the read-only guide; DOM is controlled, not a browser.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const root = new URL("../js/chapters/", import.meta.url);
const context = vm.createContext({});
const node = (spec, attrs = {}, children = []) => Array.isArray(attrs)
  ? { spec, children: attrs } : { spec, ...attrs, children };
const util = new vm.SyntheticModule(["el"], function () { this.setExport("el", node); }, { context });
const progress = new vm.SourceTextModule(fs.readFileSync(new URL("ch3-progress.js", root), "utf8"), { context });
await progress.link(() => { throw Error("Unexpected progress dependency"); }); await progress.evaluate();
const view = new vm.SourceTextModule(fs.readFileSync(new URL("ch3-wayfinding.js", root), "utf8"), { context });
await view.link(spec => { assert.equal(spec, "../core/util.js"); return util; }); await view.evaluate();
const { CH3_INTRO_SCENES: scenes, advanceToChapterThree, completeChapterThreeScene } = progress.namespace;
const { chapterThreeWayfinding: model, createChapterThreeWayfinding: render } = view.namespace;
const clone = value => JSON.parse(JSON.stringify(value));
const value = { chapter: 2, day: 28, slot: 1, phase: "cleared", stats: { technique: 30 },
  flags: { _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" } } };
assert(advanceToChapterThree(value));
const first = clone(value); assert.equal(model(value, scenes).target.id, scenes[0].id);
assert.equal(model(value, scenes).previous, null); assert.deepEqual(clone(value), first);
assert(completeChapterThreeScene(value, scenes[0].id));
assert(completeChapterThreeScene(value, scenes[1].id));
const saved = clone(value); const result = model(saved, scenes);
assert.equal(result.target.id, scenes[2].id); assert.equal(result.previous.id, scenes[1].id);
assert.deepEqual(saved, clone(value));
const freeze = v => { Object.freeze(v); for (const item of Object.values(v)) if (item && typeof item === "object") freeze(item); return v; };
const frozen = freeze(clone(saved)); assert(model(frozen, scenes));
assert.equal(render(frozen, scenes, "different-card"), null);
for (const stage of [-1, 0.25, scenes.length, scenes.length + 1]) {
  const invalid = freeze({ chapter: 3, flags: { _ch3_intro: { stage } } });
  assert.equal(model(invalid, scenes), null);
}
const missing = freeze({ chapter: 3, flags: {} }); assert.equal(model(missing, scenes), null);
const guide = render(frozen, scenes, scenes[2].id);
const walk = n => [n, ...(n.children || []).filter(Boolean).flatMap(walk)];
assert.equal(guide["aria-label"], "東京の行程");
for (const n of walk(guide)) {
  assert(!/^(button|a|input|select)(?:[.#]|$)/.test(n.spec), "Guide must not add an action");
  assert(!n.onclick, "Guide must not register a progress callback");
}
const strings = walk(guide).map(n => n.text || "").join(" ");
assert(strings.includes(scenes[2].label)); assert(!strings.includes(scenes[15].label), "No future-scene spoiler");
console.log("ch3-wayfinding: checkpoint projection, serialized resume, invalid-state and passive DOM contracts PASS (no browser/disk LOAD)");
