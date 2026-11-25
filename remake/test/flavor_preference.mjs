// 好みの判定（#3909 第1段）: 帯・ほぼ合う・温度帯の外・記録なしの境界と、判定が一台を書き換えないこと。
// node remake/test/flavor_preference.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { DB } from "../js/core/data.js";
import { preferenceFit, SWEET_AIM, NEAR_MARGIN, PREFERENCE_AXES } from "../js/craft/flavor-preference.js";
import { mixExpression } from "../js/craft/flavor-profile.js";
import { temperatureBands } from "../js/craft/temperature-model.js";

const flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(flavors.map(flavor => [flavor.id, flavor]));

/** 適温帯の中の位置（0＝低め・1＝高め）か、帯の外（"cold"／"hot"）で提供した一台。 */
function served(mix, at = .5) {
  const cs = { mix, pullDone: true };
  const { ideal } = temperatureBands(cs);
  const width = ideal[1] - ideal[0];
  const temp = at === "cold" ? ideal[0] - width : at === "hot" ? ideal[1] + width : ideal[0] + width * at;
  cs.pull = { temp };
  return cs;
}
const fitOf = (mix, preference, at) => preferenceFit(served(mix, at), preference)?.fit;

// 煙の量は使わない（完成品の「煙」と別の値）。
assert.deepEqual(PREFERENCE_AXES, ["sweetness", "cooling"]);
assert.equal(NEAR_MARGIN, .5);

// 甘めの狙い: チョコ単体・桃＋茶は届く、チョコ＋ミント半々はあと一歩、茶が主役は届かない。
assert.equal(fitOf({ chocolate: 12 }, SWEET_AIM), "match");
assert.equal(fitOf({ peach: 8, black_tea: 4 }, SWEET_AIM), "match");
assert.equal(fitOf({ chocolate: 6, mint: 6 }, SWEET_AIM), "near");
const tea = preferenceFit(served({ peach: 2, black_tea: 10 }), SWEET_AIM);
assert.equal(tea.fit, "off");
assert.deepEqual(tea.misses.map(({ axis, side }) => [axis, side]), [["sweetness", "low"]]);

// 甘さ一択にならない: 同じ配合でも、甘さ控えめの好みなら外れる。
const LESS_SWEET = { sweetness: [null, 3.5] };
assert.equal(fitOf({ chocolate: 12 }, LESS_SWEET), "off");
assert.equal(preferenceFit(served({ chocolate: 12 }), LESS_SWEET).misses[0].side, "high");
assert.equal(fitOf({ lemon: 9, mint: 3 }, LESS_SWEET), "match");

// 表情のある葉は、適温帯のどこで出すかで好みに届く（帯の中なら温度の品質はどこでも同じ）。
const COOL = { cooling: [5, null] };
assert.equal(fitOf({ melon: 6, mint: 6 }, COOL, 1), "match");
assert.notEqual(fitOf({ melon: 6, mint: 6 }, COOL, 0), "match");
const apple = [0, 1].map(at => preferenceFit(served({ double_apple: 12 }, at), SWEET_AIM).values.sweetness);
assert(apple[0] > apple[1], "ダブルアップルは低めの方が甘い");

// 温度帯の外は判定しない。香りが弱まって甘さが下がっても、甘さ控えめに「合う」にしない。
for (const at of ["cold", "hot"]) {
  const result = preferenceFit(served({ chocolate: 12 }, at), LESS_SWEET);
  assert.equal(result.fit, "outside");
  assert.equal(result.zone, at);
  assert.deepEqual(result.misses, []);
}

// 記録が無い時は判定しない（旧セーブ・未提供・吸い出しの失敗・一台の失敗・配合なし）。
assert.equal(preferenceFit(null, SWEET_AIM), null);
assert.equal(preferenceFit({ mix: { chocolate: 12 }, careHistory: [] }, SWEET_AIM), null);
assert.equal(preferenceFit({ ...served({ chocolate: 12 }), pullDone: false }, SWEET_AIM), null);
assert.equal(preferenceFit({ ...served({ chocolate: 12 }), pull: { temp: .5, failed: true } }, SWEET_AIM), null);
assert.equal(preferenceFit({ ...served({ chocolate: 12 }), failed: "burnt" }, SWEET_AIM), null);
assert.equal(preferenceFit({ ...served({ chocolate: 12 }), mix: {} }, SWEET_AIM), null);
assert.equal(preferenceFit({ ...served({ chocolate: 12 }), pull: {} }, SWEET_AIM), null);

// 好みを指定しない時は、外れようがないので合う。
assert.equal(fitOf({ black_tea: 12 }, {}), "match");
assert.equal(fitOf({ black_tea: 12 }, undefined), "match");

// 画面の棒と同じく0.1で丸めて比べる。帯の端ちょうどは合う、端から0.5まではあと一歩、それより先は外れ。
{
  const cs = served({ peach: 6, black_tea: 6 });
  const raw = mixExpression(cs, cs.pull.temp).values.sweetness;
  const shown = Math.round(raw * 10) / 10;
  assert.equal(preferenceFit(cs, { sweetness: [shown, null] }).fit, "match");
  assert.equal(preferenceFit(cs, { sweetness: [shown + .5, null] }).fit, "near");
  assert.equal(preferenceFit(cs, { sweetness: [shown + .6, null] }).fit, "off");
  assert.equal(preferenceFit(cs, { sweetness: [null, shown - .5] }).fit, "near");
}

// 判定は一台を書き換えない（保存・採点に入らない）。
{
  const cs = served({ chocolate: 8, mint: 4 });
  const before = JSON.stringify(cs);
  preferenceFit(cs, SWEET_AIM);
  assert.equal(JSON.stringify(cs), before);
}
console.log("flavor_preference ok");
