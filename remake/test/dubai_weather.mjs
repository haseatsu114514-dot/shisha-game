// ドバイ（第4章・第5章）では雨を降らせない。地元・東京・柚ヶ谷の天気と日ごとの抽選は変えない（critic N6）。
// node remake/test/dubai_weather.mjs
import assert from "node:assert/strict";
globalThis.document = { addEventListener() {} }; globalThis.window = {};
const stored = new Map();
globalThis.localStorage = { getItem: k => stored.get(k) ?? null, setItem: (k, v) => stored.set(k, String(v)), removeItem: k => stored.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const { isRainy, weatherOf, tomorrowForecast, rainScene, WEATHER_LABEL } = await import("../js/daily/weather.js");

// 変更前と同じ抽選（種と日付だけで決まる）
const rolledRain = (seed, day) => (Math.imul(seed + day * 7919, 2654435761) >>> 0) % 100 < 30;
const rolledCloud = (seed, day) => (Math.imul(seed + day * 104729, 2246822519) >>> 0) % 100 < 30;
const legacyWeather = (seed, day) => day < 2 ? "sun" : rolledRain(seed, day) ? "rain" : rolledCloud(seed, day) ? "cloud" : "sun";

const SEEDS = [0, 4, 100, 4242, 99999];
const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const at = (chapter, region, seed, day) => {
  const state = core.state;
  state.chapter = chapter; state.phase = "daily"; state.flags._ch2_region = region; state.weatherSeed = seed; state.day = day;
  delete state.flags._ch4_prep; delete state.flags._ch4;
};

core.newGame();

// 1. ドバイ: 第4章・第5章とも雨にならない。雨の抽選が出た日は晴れ、それ以外の日は今までどおり
let dubaiRainRolls = 0;
for (const chapter of [4, 5]) for (const seed of SEEDS) for (const day of DAYS) {
  at(chapter, "dubai", seed, day);
  const label = `第${chapter}章 ドバイ seed=${seed} day=${day}`;
  assert.equal(isRainy(), false, `${label}: 雨になっている`);
  const legacy = legacyWeather(seed, day);
  if (legacy === "rain") dubaiRainRolls++;
  assert.equal(weatherOf(), legacy === "rain" ? "sun" : legacy, `${label}: 天気`);
  assert.equal(rainScene("img/backgrounds/bg_street_day.webp", "vn"), null, `${label}: 屋外に雨が出ている`);
  assert.equal(rainScene("img/backgrounds/bg_dubai_cafe_day.webp", "vn"), null, `${label}: 室内に雨音が出ている`);
}
assert(dubaiRainRolls > 20, "雨の抽選が出る日を含んで確かめる");

// 2. ドバイでも日ごとの種は今までどおり作る（ドバイで初めて天気を読んでも、帰国後の抽選が変わらない）
at(5, "dubai", 0, 6);
delete core.state.weatherSeed;
assert.equal(isRainy(), false);
assert(Number.isFinite(core.state.weatherSeed), "ドバイでも天気の種を保存する");

// 3. 地元・東京・柚ヶ谷は変えない（ドバイの印が残った第1〜3章も、HUD は地元なので今までどおり）
const unchanged = [[1, "home"], [2, "home"], [2, "widehanga"], [3, "home"], [3, "tokyo"], [3, "dubai"], [4, "home"], [4, "widehanga"], [5, "home"], [5, "tokyo"], [5, "widehanga"]];
let homeRain = 0;
for (const [chapter, region] of unchanged) for (const seed of SEEDS) for (const day of DAYS) {
  at(chapter, region, seed, day);
  const legacy = legacyWeather(seed, day);
  if (legacy === "rain") homeRain++;
  assert.equal(isRainy(), legacy === "rain", `第${chapter}章 ${region} seed=${seed} day=${day}: 雨の判定`);
  assert.equal(weatherOf(), legacy, `第${chapter}章 ${region} seed=${seed} day=${day}: 天気`);
}
assert(homeRain > 100, "地元側でも雨の日を含んで確かめる");

// 4. 大会中は今までどおり天気なし
at(4, "dubai", 4, 16); core.state.phase = "tournament";
assert.equal(isRainy(), false); assert.equal(weatherOf(), null);

// 5. 空模様（K05）は翌日の天気と同じ。ドバイでは「雨」と言わない
growth.setGrowthPreview(true);
growth.ensureGrowth().nodes = ["K05"];
for (const [chapter, region] of [[4, "dubai"], [5, "dubai"], [2, "home"], [5, "tokyo"]]) for (const seed of SEEDS) for (const day of DAYS) {
  at(chapter, region, seed, day);
  const forecast = tomorrowForecast();
  assert.equal(forecast, WEATHER_LABEL[weatherOf(day + 1)], `第${chapter}章 ${region} seed=${seed} day=${day}: 空模様`);
  if (region === "dubai") assert.notEqual(forecast, WEATHER_LABEL.rain);
}
growth.setGrowthPreview(false);

// 6. 第4章の出発: 準備の3日は地元の天気。出発の朝（ドバイDAY1）からは、街の札がまだ "home" の到着・宿の場面でも雨にしない。
//    出発前日の空模様は、明日（ドバイDAY1）をドバイの天気で出す。
const PREP_START = 10, PREP_DAYS = 3, DEPART = PREP_START + PREP_DAYS;
const ch4Prep = (seed, day, departed, part = "prologue", stage = departed ? 2 : 0) => {
  at(4, "home", seed, day);
  core.state.phase = departed ? "opening" : "daily";
  core.state.flags._ch4_prep = { startDay: PREP_START, days: PREP_DAYS, step: departed ? 1 : 0, departed };
  core.state.flags._ch4 = { part, stage };
};
let departRainRolls = 0;
for (const seed of SEEDS) {
  for (let day = PREP_START; day < DEPART; day++) {
    ch4Prep(seed, day, false);
    assert.equal(weatherOf(), legacyWeather(seed, day), `第4章 準備 seed=${seed} day=${day}: 地元の天気のまま`);
  }
  if (legacyWeather(seed, DEPART) === "rain") departRainRolls++;
  for (const departed of [false, true]) {
    ch4Prep(seed, DEPART, departed);
    const label = `第4章 出発の朝 seed=${seed} departed=${departed}`;
    assert.equal(isRainy(), false, `${label}: 雨になっている`);
    assert.equal(weatherOf(), legacyWeather(seed, DEPART) === "rain" ? "sun" : legacyWeather(seed, DEPART), `${label}: 天気`);
    for (const bg of ["bg_dubai_airport_day", "bg_dubai_inn_day"]) {
      assert.equal(rainScene(`img/backgrounds/${bg}.webp`, "vn"), null, `${label}: ${bg} に雨音が出ている`);
    }
  }
  // 出発前日の空模様 = 出発後のドバイDAY1の天気
  growth.setGrowthPreview(true);
  growth.ensureGrowth().nodes = ["K05"];
  ch4Prep(seed, DEPART - 1, false);
  const forecast = tomorrowForecast();
  ch4Prep(seed, DEPART, true);
  assert.equal(forecast, WEATHER_LABEL[weatherOf()], `第4章 出発前日 seed=${seed}: 空模様とドバイDAY1の天気`);
  assert.notEqual(forecast, WEATHER_LABEL.rain);
  growth.setGrowthPreview(false);
}
assert(departRainRolls > 0, "出発の朝に雨の抽選が出る種を含んで確かめる");

// 7. 準備期間の無い旧保存: 出発前のtonari2場面（プロローグの先頭2つ）までは地元、到着から先はドバイ
for (const seed of SEEDS) for (const day of DAYS) {
  const legacy = legacyWeather(seed, day);
  for (const [part, stage, abroad] of [["prologue", 0, false], ["prologue", 1, false], ["prologue", 2, true], ["prologue", 3, true], ["free", 4, true], ["eve", 4, true]]) {
    at(4, "home", seed, day);
    core.state.flags._ch4 = { part, stage };
    assert.equal(weatherOf(), abroad && legacy === "rain" ? "sun" : legacy, `第4章 旧保存 ${part}/${stage} seed=${seed} day=${day}`);
  }
}

// 8. ドバイの背景には、街の札が地元のままでも雨を重ねない（第5章でドバイへ発つ機内の場面）。地元の背景は今までどおり
const rainyDay = DAYS.find(day => legacyWeather(4, day) === "rain");
at(5, "home", 4, rainyDay);
assert.equal(isRainy(), true);
assert.equal(rainScene("img/backgrounds/bg_dubai_airport_day.webp", "vn"), null);
assert.deepEqual(rainScene("img/backgrounds/bg_street_day.webp", "vn"), { mode: "outdoor", windows: [] });

console.log("[dubai weather] no rain in Dubai (ch4/ch5, from the ch4 departure morning), home/Tokyo/Yuzugaya unchanged, forecast matches: PASS");
