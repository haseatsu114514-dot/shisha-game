import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";


const source = fs.readFileSync(new URL("../js/game.js", import.meta.url), "utf8");
const functionSource = source.match(/function circularAngleDistance\(a, b\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(functionSource, "circularAngleDistance が game.js にあること");

const circularAngleDistance = vm.runInNewContext(`(${functionSource})`);
assert.equal(circularAngleDistance(0, 0), 0);
assert.equal(circularAngleDistance(1, 359), 2, "0°境界を跨ぐ距離は2°");
assert.equal(circularAngleDistance(359, 1), 2, "角度差は対称");
assert.equal(circularAngleDistance(10, 200), 170);
assert.equal(circularAngleDistance(90, 270), 180);
assert.ok(circularAngleDistance(8, 355) < 14, "境界付近の穴は TOO CLOSE 対象");
assert.ok(circularAngleDistance(15, 0) >= 14, "14°以上は過密扱いしない");

console.log("[making] circular angle distance / wraparound OK");

const pullBandsSource = source.match(/function pullJustBandsForLevels\(baseHalfWidth, tighten, levels\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(pullBandsSource, "pullJustBandsForLevels が game.js にあること");
const pullJustBandsForLevels = vm.runInNewContext(`(${pullBandsSource})`);
const tighten = [2.6, 1.6, 1.0, 0.8];
const initial = pullJustBandsForLevels(0.02, tighten, { up: 0, keep: 0, down: 0 });
const afterUpJust = pullJustBandsForLevels(0.02, tighten, { up: 1, keep: 0, down: 0 });
const width = (band) => band[1] - band[0];
assert.ok(width(afterUpJust.up) < width(initial.up), "上げJUST後は上げ帯だけ狭くなる");
assert.equal(width(afterUpJust.keep), width(initial.keep), "キープ帯は初回幅のまま");
assert.equal(width(afterUpJust.down), width(initial.down), "下げ帯は初回幅のまま");
console.log("[making] pull just bands tighten independently OK");

const equipment = JSON.parse(fs.readFileSync(new URL("../../data/equipment.json", import.meta.url), "utf8")).equipment;
const iranBowl = equipment.find((item) => item.id === "iran_bowl");
assert.ok(iranBowl, "イランボウルが機材データにあること");
assert.equal(iranBowl.type, "bowl");
assert.equal(iranBowl.capacity, 18);

const bowlArtKindSource = source.match(/function bowlArtKind\(bowlId\) \{[\s\S]*?\n\}/)?.[0];
const bowlArtAssetSource = source.match(/function bowlArtAsset\(bowlId\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(bowlArtKindSource && bowlArtAssetSource, "ボウル画像マッピング関数があること");
const bowlArtContext = {};
vm.runInNewContext(`${bowlArtKindSource}\n${bowlArtAssetSource}`, bowlArtContext);
assert.equal(bowlArtContext.bowlArtAsset("silicone_bowl"), "bowl_empty_silicone.png");
assert.equal(bowlArtContext.bowlArtAsset("suyaki_hagal"), "bowl_empty_clay.png");
assert.equal(bowlArtContext.bowlArtAsset("hagal_80beat"), "bowl_empty_phunnel.png");
assert.equal(bowlArtContext.bowlArtAsset("iran_bowl"), "bowl_empty_iran.png");
assert.match(source, /"bowl_empty_iran\.png"/, "イランボウル画像が先読み対象にあること");
assert.match(source, /thumb\.classList\.add\("setup-equipment-thumb"\)/, "ボウル選択肢に実画像サムネイルがあること");
assert.doesNotMatch(source, /const usePackedAsset\s*=/, "工程途中で共通の詰め済みボウルへ切り替えないこと");
console.log("[making] four bowl assets / iran bowl equipment OK");
