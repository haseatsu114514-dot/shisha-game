// #2031: 入場カットインの共有部品が第1〜4章の出場者と一致し、各章の大会から呼ばれる。
import assert from "node:assert/strict";
import fs from "node:fs";
import { CONTESTANTS as CH2 } from "../js/chapters/ch2-tournament-state.js";
import { CONTESTANTS as CH3 } from "../js/chapters/ch3-tournament-state.js";
import { CH4_CONTESTANTS as CH4 } from "../js/chapters/ch4-tournament-state.js";

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), "utf8");
const src = read("../js/chapters/tournament-entrance.js");
const block = src.slice(src.indexOf("ENTRANCE_CARDS"), src.indexOf("});"));
const idsOf = chapter => {
  const part = block.split(new RegExp(`\\n  ${chapter}: \\[`))[1].split("\n  ],")[0];
  return [...part.matchAll(/\{ id: "([a-z_]+)"/g)].map(m => m[1]);
};
const sorted = list => [...list].sort();
assert.deepEqual(idsOf(1), ["naru", "adam", "minto", "hajime"]);
for (const [chapter, roster] of [[2, CH2], [3, CH3], [4, CH4]]) {
  const ids = idsOf(chapter);
  assert.deepEqual(sorted(ids), sorted(roster), `第${chapter}章の入場カードが出場者と一致しない`);
  assert.equal(ids.at(-1), "hajime", `第${chapter}章は主人公が最後に入場する`);
}
assert.ok(!/ワイドハンガ/.test(src));
assert.match(read("../js/chapters/ch1.js"), /playEntrance\(1\)/);
assert.match(read("../js/chapters/ch2-tournament.js"), /playEntrance\(2\)/);
assert.match(read("../js/chapters/ch3-tournament.js"), /playEntrance\(3\)/);
assert.match(read("../js/chapters/ch4.js"), /playEntrance\(4\)/);
console.log("tournament_entrance: ok");
