import assert from "node:assert/strict";
import { chapterThreeMapModel } from "../js/chapters/ch3-map-model.js";
import { chapterThreeScenes, CH3_INTRO_SCENES } from "../js/chapters/ch3-progress.js";

const freeze = value => { Object.freeze(value); for (const item of Object.values(value)) if (item && typeof item === "object") freeze(item); return value; };
const saved = (stage, extra = {}) => ({ chapter: 3, day: 29, slot: 0, money: 20000, stats: { charm: 20 },
  flags: { _ch3_intro: { stage, startDay: 29, routeVersion: 2 }, ...extra } });
const pins = model => model.pins.map(pin => pin.id);
const initial = freeze(saved(0));
const before = JSON.stringify(initial);
const first = chapterThreeMapModel(initial, CH3_INTRO_SCENES);
assert.deepEqual(pins(first), ["arrival", "gym"]);
assert.equal(first.pins[0].label, "東京駅から");
assert(first.pins[0].current); assert(!first.canTrain);
assert.equal(JSON.stringify(initial), before, "Projecting a map must not normalize or save state");
assert.deepEqual(first.landmarks.map(item => item.id), ["park", "zoo", "pond", "livehouse", "tower", "station"]);
assert(!JSON.stringify(first).includes("久世")); assert(!JSON.stringify(first).includes("煙幕"));
assert(!JSON.stringify(first).includes("鉄の煙")); assert(!JSON.stringify(first).includes("Smoke & Glory"));

const find = id => CH3_INTRO_SCENES.findIndex(scene => scene.id === id);
const currentMukai = chapterThreeMapModel(freeze(saved(find("ch3_double_apple_incident"))), CH3_INTRO_SCENES);
assert(currentMukai.pins.find(pin => pin.id === "mukai").current);
assert.equal(pins(currentMukai).filter(id => id === "mukai").length, 1);
assert(!pins(currentMukai).includes("enmaku"));
const kuze = chapterThreeMapModel(freeze(saved(find("ch3_kuze_first"))), CH3_INTRO_SCENES);
assert(kuze.pins.find(pin => pin.id === "enmaku").current);
assert(!kuze.pins.find(pin => pin.id === "enmaku").visited);
assert(!pins(kuze).includes("steve")); assert(!pins(kuze).includes("volk"));
const beforeKuzeFree = chapterThreeMapModel(freeze(saved(find("ch3_kuze_first"))), CH3_INTRO_SCENES, { freeTime: true });
assert(!pins(beforeKuzeFree).includes("enmaku"), "Free time must not label the next story destination as the current place");
assert(!beforeKuzeFree.pins.some(pin => pin.current));
assert.match(beforeKuzeFree.note, /自由時間/); assert(beforeKuzeFree.freeTime);
const afterKuze = chapterThreeMapModel(freeze(saved(find("ch3_kuze_mukai_visit"))), CH3_INTRO_SCENES);
assert(afterKuze.pins.find(pin => pin.id === "enmaku").visited);
const cutaway = chapterThreeMapModel(freeze(saved(find("ch3_naru_work"))), CH3_INTRO_SCENES);
assert.match(cutaway.note, /別会場/); assert(!cutaway.pins.some(pin => pin.current));

for (const version of [undefined, 2]) {
  const value = saved(0, { _gym_member: true });
  if (version === undefined) delete value.flags._ch3_intro.routeVersion;
  const scenes = chapterThreeScenes(value);
  value.flags._ch3_intro.stage = scenes.findIndex(scene => scene.id === "ch3_taste_return");
  value.slot = 1;
  const snapshot = JSON.stringify(value);
  const model = chapterThreeMapModel(freeze(value), scenes, { allowGym: true });
  assert(model.member && model.canTrain); assert.equal(model.mode, "night");
  assert.equal(model.background, "bg_tokyo_map_night");
  assert.equal(JSON.stringify(value), snapshot);
  assert(!chapterThreeMapModel(value, scenes).canTrain, "Ordinary cards cannot start gym activities");
}
assert(!chapterThreeMapModel(saved(0), CH3_INTRO_SCENES, { allowGym: true }).canTrain);
assert.equal(chapterThreeMapModel(initial, CH3_INTRO_SCENES, { sceneId: "not-current" }), null);
const finished = chapterThreeMapModel(freeze(saved(CH3_INTRO_SCENES.length)), CH3_INTRO_SCENES);
assert(pins(finished).includes("volk")); assert(!finished.pins.some(pin => pin.current));
for (const stage of [-1, .5, CH3_INTRO_SCENES.length + 1, undefined]) {
  assert.equal(chapterThreeMapModel(saved(stage), CH3_INTRO_SCENES), null);
}
assert.equal(chapterThreeMapModel({ chapter: 2, flags: {} }, CH3_INTRO_SCENES), null);
assert.equal(chapterThreeMapModel({ chapter: 3, flags: {} }, CH3_INTRO_SCENES), null);
console.log("ch3-map: current/visited places, spoilers, public landmarks, membership, old/new saves and immutability PASS");

// #2034: 東京の4店のロゴが地点 id と対応し、実ファイルがある。
{
  const { STORE_LOGOS, hasStoreLogo } = await import("../js/core/store-logos.js");
  const { TOKYO_MAP_PLACES: CH3_MAP_PLACES } = await import("../js/chapters/ch3-map-model.js");
  const fsx = await import("node:fs");
  for (const id of ["enmaku", "steve", "volk", "mukai"]) {
    if (CH3_MAP_PLACES) assert.ok(CH3_MAP_PLACES[id], `地点 ${id} が無い`);
    assert.ok(hasStoreLogo(`ch3_${id}`));
    const file = new URL(`../../assets/ui/store_logos/${STORE_LOGOS[`ch3_${id}`].file}.webp`, import.meta.url);
    assert.ok(fsx.statSync(file).size > 1000);
  }
  console.log("ch3 store logos: ok");
}
