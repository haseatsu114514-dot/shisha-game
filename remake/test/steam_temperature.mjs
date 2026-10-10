// 蒸らしで虹に届かないこと、天候・粗い目安・一台の揺らぎと集中の独立性。
// node remake/test/steam_temperature.mjs（ブラウザ不要）
import assert from 'node:assert/strict';
import { temperatureAfterSteam, steamTemperatureRange, pullFocusFromSteam, STEAM_LIMIT, OPTIMAL } from '../js/craft/conditions.js';
import { steamEnvironment, steamForecastProfile } from '../js/craft/steam-climate.js';

const dry = { rainy: false, ambientC: 23, humidityPercent: 52 };
const wet = { rainy: true, ambientC: 23, humidityPercent: 80 };
const base = { heat: { heatPower: 50 }, holes: { total: 24, minimumComplete: true }, place: 'three', pack: 'normal', steamSeconds: 480, environment: dry };
const finish = (cs, variation = 0) => temperatureAfterSteam(cs, cs.steamSeconds, variation);
const variations = [{ offset: -.065, transfer: .9 }, { offset: 0, transfer: 1 }, { offset: .065, transfer: 1.1 }];

assert.deepEqual(steamEnvironment(true, 3, 2026), steamEnvironment(true, 3, 2026));
const day = steamEnvironment(false, 3, 2026), night = steamEnvironment(false, 3, 2026, 'night');
assert.equal(day.ambientC - night.ambientC, 2);
assert(steamEnvironment(true, 3, 2026).humidityPercent > day.humidityPercent);
assert(finish({ ...base, environment: wet }) < finish(base), 'Rain/humidity did not slow warming');
assert(finish({ ...base, environment: { ...dry, ambientC: 10 } }) < finish({ ...base, environment: { ...dry, ambientC: 30 } }), 'Ambient temperature had no effect');
assert(finish({ ...base, environment: { ...dry, humidityPercent: 90 } }) < finish(base), 'Humidity had no effect');
console.log('[steam temperature] PASS: stable daily climate, cooler nights, slower warming in rain/high humidity and cold air');

let cases = 0;
for (const seconds of [10, 60, 180, 300, 390, 480, 600])
  for (const heatPower of [0, 50, 100])
    for (const place of ['three', 'four'])
      for (const pack of ['normal', 'fluffy', 'firm'])
        for (const environment of [dry, wet, { rainy: false, ambientC: 38, humidityPercent: 20 }])
          for (const total of [12, 24])
            for (const variation of variations) {
              const cs = { ...base, steamSeconds: seconds, heat: { heatPower }, place, pack, environment, holes: { total, minimumComplete: true } };
              let previous = 0;
              for (const progress of [0, .25, .5, .75, 1]) {
                const temp = temperatureAfterSteam(cs, seconds * progress, variation);
                assert(Number.isFinite(temp) && temp >= previous - 1e-12 && temp <= STEAM_LIMIT + 1e-12, JSON.stringify({ cs, variation, progress, temp, previous }));
                assert(temp < OPTIMAL[0], 'Steaming reached the rainbow band');
                previous = temp; cases++;
              }
            }
assert.equal(finish({ ...base, heat: { heatPower: 100 }, place: 'four', pack: 'fluffy', steamSeconds: 600 }, variations[2]), STEAM_LIMIT);
assert.equal(temperatureAfterSteam(base, 480, .02), temperatureAfterSteam(base, 480, { offset: .02 }));
assert(Number.isFinite(finish({ ...base, environment: undefined })), 'Legacy session without climate failed');
console.log(`[steam temperature] PASS: ${cases} warm-up samples stay monotonic and below rainbow, including ten minutes, four coals and strongest heat`);

assert.equal(steamTemperatureRange(base, 0), null);
const range = steamTemperatureRange(base, 420);
assert(range.high - range.low >= .1, 'Forecast was too precise');
assert(range.high < OPTIMAL[0]);
assert.deepEqual(steamTemperatureRange(base, 390), steamTemperatureRange({ ...base, steam: { hits: 20, score: 0, temp: .9 } }, 390));
assert(finish({ ...base, steamSeconds: 420 }, variations[2]) > range.high, 'Actual variation was forced inside the predicted range');
assert(finish(base, variations[0]) < finish(base, variations[2]), 'Per-session variation had no effect');
const calm = { ...base, steam: { hits: 0, score: 100 } }, distracted = { ...base, steam: { hits: 15, score: 0 } };
assert.equal(finish(calm, variations[0]), finish(distracted, variations[0]), 'A dodge miss changed physical temperature');
assert(pullFocusFromSteam(calm).slow > pullFocusFromSteam(distracted).slow);
assert(pullFocusFromSteam(calm).window > pullFocusFromSteam(distracted).window);
console.log('[steam temperature] PASS: coarse repeatable forecast permits drift; misses affect the next inhalation controls, not heat');

const actualVariation = variations[2], actual = finish({ ...base, steamSeconds: 390 }, actualVariation);
const novice = steamTemperatureRange({ ...base, steamPrediction: steamForecastProfile(0, actualVariation) }, 390);
const experienced = steamTemperatureRange({ ...base, steamPrediction: steamForecastProfile(1, actualVariation) }, 390);
assert(experienced.high - experienced.low < novice.high - novice.low, 'Insight failed to narrow the range');
assert(Math.abs((experienced.high + experienced.low) / 2 - actual) < Math.abs((novice.high + novice.low) / 2 - actual), 'Insight narrowed the band without improving the estimate');
assert(experienced.high - experienced.low >= .05, 'Maximum insight revealed an exact temperature');
assert.notEqual(steamForecastProfile(1, actualVariation).offset, actualVariation.offset, 'Maximum insight read all hidden variation');
const widths = [0, .25, .5, .75, 1].map(insight => {
  const bounds = steamTemperatureRange({ ...base, steamPrediction: steamForecastProfile(insight, actualVariation) }, 390);
  return bounds.high - bounds.low;
});
assert(widths.every((width, i) => i === 0 || width < widths[i - 1]), 'A higher insight star widened the forecast');
// 下限や蒸らし上限で帯が切れる場合も、成長で見える幅を逆に広げない。
for (const heatPower of [0, 25, 50, 75, 100])
  for (const seconds of [60, 180, 300, 390, 480, 600])
    for (const environment of [dry, wet])
      for (const variation of variations) {
        const widths = [0, .25, .5, .75, 1].map(insight => {
          const bounds = steamTemperatureRange({ ...base, heat: { heatPower }, environment, steamPrediction: steamForecastProfile(insight, variation) }, seconds);
          assert(bounds.low >= .08 - 1e-12 && bounds.high <= STEAM_LIMIT + 1e-12);
          return bounds.high - bounds.low;
        });
        assert(widths.every((width, i) => i === 0 || width < widths[i - 1]), JSON.stringify({ heatPower, seconds, environment, variation, widths }));
      }
console.log('[steam temperature] PASS: insight narrows the range and reads part of real coal behavior, while retaining uncertainty');
