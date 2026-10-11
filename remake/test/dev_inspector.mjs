import assert from "node:assert/strict";
import { createDevInspector } from "../js/core/dev-inspector.js";

const source = { day: 4, flags: { seen: true }, stats: { charm: 12 }, lovers: ["mashiro"] };
const scenes = { ch1_start: { lines: [{ text: "hello" }], branches: { yes: [] }, metadata: { bg: "test" } }, ch2_end: { lines: [] } };
const inspector = createDevInspector(() => source, () => scenes);
assert.deepEqual(inspector.events("CH1"), ["ch1_start"]);
assert.deepEqual(inspector.events("", 1), ["ch1_start"]);
assert.deepEqual(inspector.eventInfo("ch1_start"), { id: "ch1_start", lines: 1, branches: ["yes"], metadata: { bg: "test" } });
assert.equal(inspector.eventInfo("missing"), null);
const copy = inspector.snapshot();
copy.flags.seen = false;
copy.lovers.push("rin");
assert.equal(source.flags.seen, true);
assert.deepEqual(source.lovers, ["mashiro"]);
assert.equal(JSON.parse(inspector.exportSnapshot()).day, 4);
assert.equal(createDevInspector(() => null, () => scenes).snapshot(), null);
console.log("OK: read-only dev inspector");
