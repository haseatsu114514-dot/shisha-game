// #1081 J08: 第2章の雨演出（背景分類・窓座標・3層雨粒・水紋・色調判定・天候抽選不変）の単体検証
// node --experimental-vm-modules remake/test/ch2_rain_j08.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { newGame, state } from "../js/core/state.js";
import {
  isRainy,
  weatherOf,
  rainScene,
  weatherSkyTone,
  weatherViewKind,
  renderWeatherLayer,
} from "../js/daily/weather.js";
import { MAP, STATION, ROOMS } from "../js/chapters/ch2-city-data.js";
import { CH2_SCENE_BACKGROUNDS, CITY_BACKGROUNDS } from "../js/core/city-locations.js";

function mockEl(spec, attrs = {}, children = []) {
  if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
  const [tag, ...classes] = spec.split(".");
  const node = {
    tag: tag || "div",
    classList: new Set(classes.filter(Boolean)),
    dataset: { ...(attrs.dataset || {}) },
    style: { ...(attrs.style || {}) },
    attrs: { ...attrs },
    children: [],
    hidden: false,
    replaceChildren(...next) { this.children = next.flat().filter(Boolean); },
    append(...next) { this.children.push(...next.flat().filter(Boolean)); },
  };
  if (attrs.class) attrs.class.split(/\s+/).filter(Boolean).forEach((c) => node.classList.add(c));
  node.append(children);
  return node;
}

// 1. 雨判定・天候確率・日程は既存仕様のまま変わらない
newGame();
state.chapter = 2;
state.phase = "daily";
state.weatherSeed = 4;
state.day = 1;
assert.equal(isRainy(1), false, "DAY1は常に晴れ");
assert.equal(weatherOf(1), "sun");

// 既存の代表シード（ch2_daily.mjs で使われる day=16: weatherSeed=4 は雨、weatherSeed=0 は晴れ）
state.day = 16;
state.weatherSeed = 4;
assert.equal(isRainy(), true, "weatherSeed=4, day=16 は雨");
assert.equal(weatherOf(), "rain");
state.weatherSeed = 0;
assert.equal(isRainy(), false, "weatherSeed=0, day=16 は晴れ（雨ではない）");
assert.equal(weatherOf(), "sun");

state.weatherSeed = 4;
state.phase = "tournament";
assert.equal(isRainy(), false, "大会中は雨にならない");
assert.equal(weatherOf(), null);
state.phase = "daily";

// 2. 第2章の屋外背景（街マップ昼夜・駅前・会場外ベンチ・ケムリクサ外）が outdoor として判定される
for (const bg of [
  MAP.day,
  MAP.night,
  STATION,
  CH2_SCENE_BACKGROUNDS.venueBench,
  CH2_SCENE_BACKGROUNDS.naruWindow,
  "img/backgrounds/bg_ch2_venue_bench_night.webp",
  "img/backgrounds/bg_kemurikusa_outside_night.webp",
]) {
  const scene = rainScene(bg, "ch2-city");
  assert.deepEqual(scene, { mode: "outdoor", windows: [] }, `屋外背景が outdoor になっていない: ${bg}`);
}

// 3. 第2章の窓なし室内（MELTY PUFF・神崎煙草店奥・零-ZERO-・閉店後あげは店・TRPGカフェ・神崎煙草店店先）は部屋の中に雨を降らせない
for (const bg of [
  ROOMS.ageha,
  ROOMS.kumicho,
  ROOMS.rei,
  CH2_SCENE_BACKGROUNDS.agehaClosed,
  CITY_BACKGROUNDS.trpg,
  "img/backgrounds/bg_ageha_shop.webp",
  "img/backgrounds/bg_ryuji_shop.webp",
]) {
  const scene = rainScene(bg, "vn");
  assert.deepEqual(scene, { mode: "indoor", windows: [] }, `窓なし室内に雨が漏れている: ${bg}`);
}

// 4. 第2章の窓あり室内（C.STATION柚ヶ谷昼夜・Dr.fookah柚ヶ谷・都市型水族館・銭湯・鉄の煙）は窓ガラス領域だけに雨を出す
const windowedCh2 = [
  [CITY_BACKGROUNDS.c_station, 5],
  [CITY_BACKGROUNDS.c_station_night, 5],
  [CITY_BACKGROUNDS.shop, 3],
  [CITY_BACKGROUNDS.aquarium, 4],
  [CITY_BACKGROUNDS.sento, 4],
  ["img/backgrounds/bg_volk_shop.webp", 4],
];
for (const [bg, expectedPanes] of windowedCh2) {
  const scene = rainScene(bg, "vn");
  assert.equal(scene?.mode, "indoor", `窓あり室内が indoor ではない: ${bg}`);
  assert.equal(scene?.windows.length, expectedPanes, `窓数が想定と異なる: ${bg}`);
  for (const [x, y, w, h] of scene.windows) {
    assert(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1280 && y + h <= 720,
      `窓座標が 1280x720 ステージ外に出ている (${bg}): [${x},${y},${w},${h}]`);
    if (bg === CITY_BACKGROUNDS.aquarium) {
      assert(x + w <= 460, `水族館の外窓雨が右側の水槽領域に重なっている: x+w=${x + w}`);
    }
  }
}

// 5. 色調とビュー区分の判定（曇天差分のない第2章昼背景・夜tint・曇天差分済み背景）
assert.equal(weatherSkyTone(MAP.day, ""), "day");
assert.equal(weatherSkyTone(MAP.day, "night"), "night");
assert.equal(weatherSkyTone(MAP.night, ""), "night");
assert.equal(weatherSkyTone(STATION, ""), "day");
assert.equal(weatherSkyTone("img/backgrounds/bg_street_overcast_day.webp", ""), "overcast");

assert.equal(weatherViewKind(MAP.day, rainScene(MAP.day, "map")), "map");
assert.equal(weatherViewKind(STATION, rainScene(STATION, "ch2-city")), "station");
assert.equal(weatherViewKind(CH2_SCENE_BACKGROUNDS.venueBench, rainScene(CH2_SCENE_BACKGROUNDS.venueBench, "vn")), "street");
assert.equal(weatherViewKind(CITY_BACKGROUNDS.c_station, rainScene(CITY_BACKGROUNDS.c_station, "vn")), "indoor");

// 6. DOM 構築（屋外3層 far/mid/near + 霧 + 水紋、室内は1窓5粒の契約維持）
const host = mockEl("div#weather");
renderWeatherLayer(host, rainScene(MAP.day, "map"), { sky: "day", view: "map", el: mockEl });
assert.equal(host.hidden, false);
assert.equal(host.dataset.mode, "outdoor");
assert.equal(host.dataset.sky, "day");
assert.equal(host.dataset.view, "map");
assert.equal(host.children.length, 1);
const outdoorSheet = host.children[0];
const outdoorDrops = outdoorSheet.children.filter((c) => c.classList.has("weather-drop"));
const outdoorMist = outdoorSheet.children.filter((c) => c.classList.has("weather-mist"));
const outdoorRipples = outdoorSheet.children.filter((c) => c.classList.has("weather-ripple"));
assert.equal(outdoorDrops.length, 54);
assert.equal(outdoorMist.length, 1);
assert.equal(outdoorRipples.length, 8);
const depths = new Set(outdoorDrops.map((d) => d.dataset.depth));
assert.deepEqual(depths, new Set(["far", "mid", "near"]), "遠・中・近の3層雨粒が揃っている");

// 室内窓の構築（ch1_facility_art 互換の 1窓5粒 = windows.length * 5）
const indoorScene = rainScene(CITY_BACKGROUNDS.c_station, "vn");
renderWeatherLayer(host, indoorScene, { sky: "day", view: "indoor", el: mockEl });
assert.equal(host.dataset.mode, "indoor");
assert.equal(host.children.length, indoorScene.windows.length);
const totalWindowDrops = host.children.reduce(
  (sum, sheet) => sum + sheet.children.filter((c) => c.classList.has("weather-drop")).length,
  0,
);
assert.equal(totalWindowDrops, indoorScene.windows.length * 5);

// 7. CSS の軽量化・reduced-motion 対応確認（map-weather の background-position アニメ廃止）
const baseCss = fs.readFileSync(new URL("../css/base.css", import.meta.url), "utf8");
const dailyCss = fs.readFileSync(new URL("../css/daily.css", import.meta.url), "utf8");
assert.match(baseCss, /\.weather-drop\[data-depth="far"\]/);
assert.match(baseCss, /\.weather-drop\[data-depth="mid"\]/);
assert.match(baseCss, /\.weather-drop\[data-depth="near"\]/);
assert.match(baseCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.weather-drop,\s*\.weather-ripple\s*\{\s*animation:\s*none;\s*display:\s*none;\s*\}/);
assert.doesNotMatch(dailyCss, /animation:\s*map-rainfall/, "map-weather の重い background-position アニメーションは廃止済み");

console.log("[ch2 rain J08] outdoor/indoor classification, window bounds, 3-tier depth drops, ripples, CSS load & reduced-motion: PASS");
