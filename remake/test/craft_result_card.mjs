import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";

const source = await readFile(new URL("../js/craft/result-card.js", import.meta.url), "utf8");
const module = new vm.SourceTextModule(source);
await module.link(() => { throw new Error("Unexpected dependency"); });
await module.evaluate();
const { buildResultCardData, layoutResultCard, renderResultCard, resultCardFilename } = module.namespace;

test("card copies only the recorded positive mix and existing review", () => {
  const input = { mix: { mint: 2.5, apple: 9.5, empty: 0, bad: NaN, negative: -1 },
    flavors: { mint: { name: "ミント" }, apple: { name: "ダブルアップル" } }, grade: "○ 良い",
    advice: ["今回よかったこと：適温に整えて提供できた。", "", null, "次の練習：配合を確かめよう。"] };
  const before = structuredClone(input);
  const data = buildResultCardData(input);
  assert.deepEqual(input, before);
  assert.deepEqual(Array.from(data.mix), ["ミント　2.5g", "ダブルアップル　9.5g"]);
  assert.equal(data.grade, "○ 良い");
  assert.equal(data.advice.length, 2);
  assert.equal(data.title, "水煙前線 -EN:CODE-");
  assert.equal(buildResultCardData().mix.length, 0);
  assert.match(buildResultCardData({ mix: { unknown: 1 } }).mix[0], /unknown/);
});

test("long recipes and advice fit without truncation or overlapping rows", () => {
  const text = "長いフレーバー名".repeat(20);
  const data = buildResultCardData({ mix: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i, 1])),
    flavors: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i, { name: text }])), advice: [text, text] });
  const measure = (text, size) => Array.from(text).length * size;
  const layout = layoutResultCard(data, measure);
  assert(layout.height > 720);
  for (const [index, line] of layout.lines.entries()) {
    assert(measure(line.text, line.size) <= layout.width - 128);
    assert(line.y + line.size <= layout.height - 64);
    if (index) assert(line.y >= layout.lines[index - 1].y + layout.lines[index - 1].size);
  }
  assert.equal(layout.lines.map(line => line.text).join(""),
    data.title + "あなたの一台総合　配合" + data.mix.join("") + data.advice.join(""));
});

test("renderer paints the background, optional smoke and all text, then exports PNG", () => {
  const calls = [];
  const ctx = { measureText: text => ({ width: text.length * 28 }),
    fillRect: (...args) => calls.push(["background", ...args]),
    drawImage: (...args) => calls.push(["smoke", ...args]), fillText: text => calls.push(["text", text]) };
  const canvas = { getContext: () => ctx, toDataURL: type => { assert.equal(type, "image/png"); return "data:image/png;base64,test"; } };
  assert.equal(renderResultCard(canvas, buildResultCardData(), {}), "data:image/png;base64,test");
  assert.equal(calls[0][0], "background");
  assert.equal(calls[1][0], "smoke");
  calls.length = 0;
  renderResultCard(canvas, buildResultCardData());
  assert(!calls.some(call => call[0] === "smoke"));
  assert.throws(() => renderResultCard({ getContext: () => null }, {}));
});

test("filename uses local date and zero-padded time", () => {
  assert.equal(resultCardFilename(new Date(2026, 10, 4, 9, 5)), "shisha-result-20261104-0905.png");
});
