// 見た目の様式（core/look.js・LK01）: 既定は現行、新版とDS風は対応済みの章だけ、知らない値は現行。
import assert from "node:assert/strict";
import { LOOKS, DEFAULT_LOOK, LOOK_CHAPTERS, normalizeLook, effectiveLook } from "../js/core/look.js";

assert.deepEqual(LOOKS.map((look) => look.id), ["classic", "neo", "retro"]);
assert.equal(DEFAULT_LOOK, "classic", "既定は現行のまま");
assert.deepEqual([...LOOK_CHAPTERS], [1], "試作は第1章だけ");

for (const bad of [undefined, null, "", "ds", "NEO", 1, {}]) assert.equal(normalizeLook(bad), "classic", `知らない値は現行: ${String(bad)}`);
for (const { id } of LOOKS) assert.equal(normalizeLook(id), id);

// 現行はどの章でも現行
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("classic", chapter), "classic");
// 新版・DS風は第1章（と、章が分からないタイトル）だけ
for (const look of ["neo", "retro"]) {
  assert.equal(effectiveLook(look, 1), look);
  assert.equal(effectiveLook(look, undefined), look, "タイトルなど章が分からない場面は第1章として扱う");
  for (const chapter of [2, 3, 4, 5]) assert.equal(effectiveLook(look, chapter), "classic", `第${chapter}章では現行で表示する`);
}
console.log("look: ok");
