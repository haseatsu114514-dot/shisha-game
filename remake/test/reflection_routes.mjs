// #1788 / #1801 C11: 実際の盤規則・save/loadを使い、VNと盤のDOMだけを差し替える。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../js/", import.meta.url);
const storage = new Map();
const context = vm.createContext({ console, Math, Map, Set, JSON, Date, structuredClone,
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
});
let core, growth, board, mode = "cancel", afterScene = null;
const scenes = [], opened = [];
const mocks = {
  "core/stats.js": { affinityLevel: () => 0, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], maxStamina: () => 100, setExpHooks() {} },
  "vn/engine.js": { play: async id => { scenes.push(id); afterScene?.(); } },
  // ためた分のレベルアップのフル演出（SBD108）は画面なので差し替える。経路・見学時間・保存だけを見る
  "daily/levelup.js": { presentStockedGrowth: async () => null },
  "daily/growth-board-screen.js": { openBoard: async options => {
    opened.push(options.place);
    if (mode === "cancel") return [];
    const node = board.NODES.find(n => n.kind === "stat" && n.links.includes(board.HUB)
      && !core.state.growth.nodes.includes(n.id));
    return board.commitPending([node.id]);
  } },
};
const modules = new Map();
async function load(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const mock = mocks[url.href.slice(root.href.length)];
  const mod = mock ? new vm.SyntheticModule(Object.keys(mock), function () {
    for (const [key, value] of Object.entries(mock)) this.setExport(key, value);
  }, { context, identifier: url.href }) : new vm.SourceTextModule(fs.readFileSync(url, "utf8"), {
    context, identifier: url.href,
    importModuleDynamically: async (specifier, parent) => {
      const child = await load(new URL(specifier, parent.identifier));
      if (child.status === "linked") await child.evaluate();
      return child;
    },
  });
  modules.set(url.href, mod);
  await mod.link((specifier, parent) => load(new URL(specifier, parent.identifier)));
  return mod;
}
async function namespace(path) {
  const mod = await load(new URL(path, root));
  if (mod.status === "linked") await mod.evaluate();
  return mod.namespace;
}
core = await namespace("core/state.js");
growth = await namespace("core/growth.js");
board = await namespace("core/growth-board.js");
const reflection = await namespace("daily/reflection.js");
const hours = await namespace("daily/spot-hours.js");
const ch3 = await namespace("chapters/ch3-progress.js");
const tokyo = await namespace("chapters/ch3-map-model.js");
const ch4 = await namespace("chapters/ch4-progress.js");
const dubai = await namespace("chapters/ch4-map-model.js");
const copy = value => JSON.parse(JSON.stringify(value));
const gameplay = value => { const result = copy(value); delete result.savedAt; return result; };
function seed(chapter, { day = 46, slot = 0, hidane = 2 } = {}) {
  const s = core.newState();
  Object.assign(s, { chapter, day, slot, phase: "opening", stamina: 73 });
  if (chapter === 3) s.flags._ch3_intro = { stage: 4, startDay: 29, routeVersion: 2 };
  else s.flags._ch4 = { startDay: day, day: 1, stage: ch4.CH4_PROLOGUE.length,
    part: "free", titleSeen: true, read: {}, firstDay: null, resolution: 0, attempts: 0 };
  core.setState(s);
  growth.ensureGrowth(s).hidane.any = hidane;
  growth.setGrowthPreview(true);
  scenes.length = opened.length = 0;
  afterScene = null;
  return s;
}
const resources = s => ({ day: s.day, slot: s.slot, stamina: s.stamina, money: s.money,
  stats: s.stats, flags: s.flags, visitedDay: s.visitedDay, spotVisits: s.spotVisits, tokyoVisits: s.tokyoVisits,
  xp: s.growth.xp, level: s.growth.level, today: s.growth.today });

// 既存スポットへの営業時間の互換性と、案内枠/金曜/夜の境界。
assert.equal(hours.openingStatus({}, { day: 5, slot: 1 }).ok, true);
assert.equal(hours.openingStatus({ openSlots: [1] }, { day: 1, slot: 0 }).ok, false);
for (let day = 1; day <= 14; day++) for (const slot of [0, 1]) {
  assert.equal(hours.openingStatus(hours.MOSQUE_VISITING_HOURS, { day, slot }).ok, slot === 0 && day % 7 !== 5);
}
for (const chapter of [3, 4]) for (const hidane of [0, 2]) for (const slot of [0, 1]) {
  const s = seed(chapter, { hidane, slot });
  const before = copy(s);
  const available = reflection.canReflect(s);
  if (chapter === 3) {
    const actions = available ? [{ id: "reflect", place: "shrine", ok: true, consumes: false }] : [];
    const model = tokyo.chapterThreeMapModel(s, ch3.chapterThreeScenes(s), { freeTime: true, actions });
    assert.equal(model.pins.some(pin => pin.id === "shrine"), hidane > 0);
    if (available) assert.equal(model.pins.find(pin => pin.id === "shrine").actions[0].consumes, false);
    assert.equal(hours.openingStatus(reflection.REFLECT_PLACES.tokyo_shrine, s).ok, true, "東京は昼夜開場");
  } else {
    const destination = dubai.chapterFourMapModel(s, { canReflect: available }).destinations.find(d => d.id === "mosque");
    assert.equal(!!destination, hidane > 0);
    if (destination) {
      assert.equal(destination.ok, slot === 0);
      assert.equal(destination.kind, "reflect");
      assert.equal(destination.consumes, false);
      assert.deepEqual(copy(destination.scenes), []);
    }
  }
  assert.deepEqual(copy(s), before, "入口の計算は保存状態を変更しない");
  mode = "cancel";
  await reflection.reflectAt(chapter === 3 ? "tokyo_shrine" : "dubai_mosque");
  assert.equal(opened.length, hidane > 0 && (chapter === 3 || slot === 0) ? 1 : 0);
  assert.deepEqual(gameplay(s), before, "閉場・火種なし・取消では報酬も行動消費もない（保存時刻のみ除く）");
}
for (const chapter of [3, 4]) {
  const s = seed(chapter);
  const place = chapter === 3 ? "tokyo_shrine" : "dubai_mosque";
  const before = copy(resources(s));
  mode = "light";
  const lit = await reflection.reflectAt(place);
  assert.equal(lit.length, 1);
  assert.equal(s.growth.nodes.length, 1);
  assert.equal(s.growth.hidane.any, 1);
  assert.deepEqual(copy(resources(s)), before, "内省で行動・体力・経験値を二重加算/消費しない");
  const saved = copy(s.growth);
  const loaded = core.load();
  assert(loaded);
  assert.deepEqual(copy(core.state.growth), saved, "本番save/loadで灯した盤と残り火種を保持");
  assert.deepEqual(copy(resources(core.state)), before);
  if (chapter === 4) assert(dubai.chapterFourMapModel(core.state, { canReflect: reflection.canReflect() }).destinations.some(d => d.id === "mosque"));
  // ロード後の再訪・取消で重複付与しない。
  mode = "cancel";
  await reflection.reflectAt(place);
  assert.deepEqual(copy(core.state.growth), saved);
}
seed(4, { day: 47 }); // day % 7 = 5（金曜）
assert.equal(dubai.chapterFourMapModel(core.state, { canReflect: true }).destinations.find(d => d.id === "mosque").ok, false);
await reflection.reflectAt("dubai_mosque");
assert.equal(scenes.length, 0, "金曜は見学の場面にも入らない");
seed(4);
afterScene = () => { core.state.slot = 1; };
await reflection.reflectAt("dubai_mosque");
assert.equal(opened.length, 0, "場面の後でも閉場を再確認");
seed(3);
afterScene = () => core.setState(core.newState());
await reflection.reflectAt("tokyo_shrine");
assert.equal(opened.length, 0, "別セーブへ移ったら旧内省を続行しない");
for (const chapter of [3, 4]) {
  seed(chapter);
  growth.setGrowthPreview(false);
  assert.equal(reflection.canReflect(), false);
  await reflection.reflectAt(chapter === 3 ? "tokyo_shrine" : "dubai_mosque");
  assert.equal(opened.length, 0, "公開フラグは先行ONしない");
}
// IR26（SBD98）: 東京の内省の場所は、仮置きの「路地裏の神社」から公園の池に浮かぶ弁天堂へ。昼の地図（bg_tokyo_map_day）の右下の池の
// 岸にピンの先を置き（お堂は案内パネルの裏になるため）、第3章・第5章とも同じ地点。ほかの行き先・路上占いの出る場所と重ならない。
// id（tokyo_shrine など）は互換のため変えない。
{
  globalThis.document ||= { addEventListener() {} };
  globalThis.window ||= {};
  globalThis.localStorage ||= { getItem: () => null, setItem() {}, removeItem() {} };
  const { CH3_TOKYO_SPOTS } = await import("../js/chapters/ch3-tokyo-daily.js");
  const { TOKYO_SPOTS } = await import("../js/chapters/ch5-tokyo.js");
  const { PLACE_JA } = await import("../js/daily/growth-board-screen.js");
  const fortune = await import("../js/daily/fortune-schedule.js");
  const benten = [CH3_TOKYO_SPOTS.find(s => s.id === "ch3_tokyo_shrine"), TOKYO_SPOTS.find(s => s.id === "ch5_tokyo_shrine")];
  for (const spot of benten) {
    assert.deepEqual([spot.label, spot.area, spot.x, spot.y, spot.preview], ["池の弁天堂", "公園の池", 91, 73, "bg_tokyo_park"], spot.id);
  }
  assert.deepEqual([tokyo.TOKYO_MAP_PLACES.shrine.label, tokyo.TOKYO_MAP_PLACES.shrine.x, tokyo.TOKYO_MAP_PLACES.shrine.y], ["池の弁天堂", 91, 73]);
  assert.equal(reflection.REFLECT_PLACES.tokyo_shrine.label, "池の弁天堂");
  assert.equal(PLACE_JA.tokyo_shrine, "池の弁天堂");
  // 背景は届くまで同じ公園の池の絵（昼夜で切り替わる）
  assert.equal(reflection.REFLECT_PLACES.tokyo_shrine.bg, "bg_tokyo_park");
  const manifest = JSON.parse(fs.readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8"));
  for (const name of ["bg_tokyo_park_day.png", "bg_tokyo_park_night.png"]) assert(manifest.backgrounds.includes(name), name);
  const scene = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/growth_reflection.json", import.meta.url), "utf8"))
    .dialogues.find(d => d.dialogue_id === reflection.REFLECT_PLACES.tokyo_shrine.scene).lines.map(line => line.text).join("");
  assert.match(scene, /池/); assert.match(scene, /お堂/); assert.match(scene, /願い事はしない/); assert.doesNotMatch(scene, /神社|鳥居|路地/);
  // 路上占いの東京の出る場所（種を変えて全部集める）
  const fortuneSpots = new Map();
  for (let seed = 1; seed <= 60; seed++) for (const chapter of [3, 5]) {
    const save = { seed, chapter, day: 40, slot: 0, flags: {} };
    if (!fortune.placeFortuneNow(save, "tokyo")) continue;
    const at = fortune.fortunePosition(save);
    fortuneSpots.set(`${at.x},${at.y}`, { id: `fortune:${at.area}`, ...at });
  }
  assert(fortuneSpots.size >= 2, "路上占いの東京の場所を集められる");
  const others = [...CH3_TOKYO_SPOTS, ...TOKYO_SPOTS, ...Object.values(tokyo.TOKYO_MAP_PLACES), ...tokyo.TOKYO_MAP_LANDMARKS, ...fortuneSpots.values()]
    .filter(place => !["ch3_tokyo_shrine", "ch5_tokyo_shrine", "shrine", "pond"].includes(place.id));
  for (const place of others) {
    assert(Math.abs(place.x - 91) >= 6 || Math.abs(place.y - 73) >= 10, `池の弁天堂と ${place.id}（${place.x},${place.y}）が近すぎる`);
  }
}
console.log("reflection-routes: Tokyo/Dubai entrances, visiting hours, cancel/light, no action/EXP cost, real save/load and stale owner PASS");
