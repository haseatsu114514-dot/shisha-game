// 蒸らしの温度が途中で頭打ちにならないこと、天候・粗い目安・一台の揺らぎと集中の独立性。
// node remake/test/steam_temperature.mjs（ブラウザ不要）
import assert from 'node:assert/strict';
import { temperatureAfterSteam, steamTemperatureRange, pullFocusFromSteam, STEAM_LIMIT, OPTIMAL } from '../js/craft/conditions.js';
import { steamEnvironment, steamForecastProfile } from '../js/craft/steam-climate.js';

const dry = { rainy: false, ambientC: 23 };
const wet = { rainy: true, ambientC: 23 };
const base = { heat: { heatPower: 50 }, holes: { total: 24, minimumComplete: true }, place: 'three', pack: 'normal', steamSeconds: 480, environment: dry };
const finish = (cs, variation = 0) => temperatureAfterSteam(cs, cs.steamSeconds, variation);
const variations = [{ offset: -.065, transfer: .9 }, { offset: 0, transfer: 1 }, { offset: .065, transfer: 1.1 }];

assert.deepEqual(steamEnvironment(true, 3, 2026), steamEnvironment(true, 3, 2026));
const day = steamEnvironment(false, 3, 2026), night = steamEnvironment(false, 3, 2026, 'night');
assert.equal(day.ambientC - night.ambientC, 2);
// #1129（2026-10-30 オーナー決定）: 湿度は気候から外し、表示にも計算にも使わない。
assert(!('humidityPercent' in steamEnvironment(true, 3, 2026)) && !('humidityPercent' in day), 'Climate still carries humidity');
assert(finish({ ...base, environment: wet }) < finish(base), 'Rain did not slow warming');
assert(finish({ ...base, environment: { ...dry, ambientC: 10 } }) < finish({ ...base, environment: { ...dry, ambientC: 30 } }), 'Ambient temperature had no effect');
assert.equal(finish({ ...base, environment: { ...dry, humidityPercent: 90 } }), finish(base), 'Legacy humidity still changed warming');
assert.equal(finish({ ...base, environment: { ...wet, humidityPercent: 20 } }), finish({ ...base, environment: wet }), 'Legacy humidity still changed rainy warming');
console.log('[steam temperature] PASS: stable daily climate, cooler nights, slower warming in rain and cold air, humidity ignored');

let cases = 0;
for (const seconds of [10, 60, 180, 300, 390, 480, 600])
  for (const heatPower of [0, 50, 100])
    for (const place of ['three', 'four'])
      for (const pack of ['normal', 'fluffy', 'firm'])
        for (const environment of [dry, wet, { rainy: false, ambientC: 38 }])
          for (const total of [12, 24])
            for (const variation of variations) {
              const cs = { ...base, steamSeconds: seconds, heat: { heatPower }, place, pack, environment, holes: { total, minimumComplete: true } };
              let previous = 0;
              for (const progress of [0, .25, .5, .75, 1]) {
                const temp = temperatureAfterSteam(cs, seconds * progress, variation);
                assert(Number.isFinite(temp) && temp >= previous - 1e-12 && temp <= STEAM_LIMIT + 1e-12, JSON.stringify({ cs, variation, progress, temp, previous }));
                previous = temp; cases++;
              }
            }
assert(finish({ ...base, heat: { heatPower: 100 }, place: 'four', pack: 'fluffy', steamSeconds: 600 }, variations[2]) > OPTIMAL[1]);
assert.equal(temperatureAfterSteam(base, 480, .02), temperatureAfterSteam(base, 480, { offset: .02 }));
assert(Number.isFinite(finish({ ...base, environment: undefined })), 'Legacy session without climate failed');
console.log(`[steam temperature] PASS: ${cases} warm-up samples stay monotonic without early clipping, including ten minutes, four coals and strongest heat`);

assert.equal(steamTemperatureRange(base, 0), null);
const range = steamTemperatureRange(base, 420);
assert(range.high - range.low >= .1, 'Forecast was too precise');
assert(range.high < OPTIMAL[0]);
assert.deepEqual(steamTemperatureRange(base, 390), steamTemperatureRange({ ...base, steam: { hits: 20, score: 0, temp: .9 } }, 390));
assert(finish({ ...base, steamSeconds: 420 }, { offset: .2, transfer: 1.4 }) > range.high, 'Actual variation was forced inside the predicted range');
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

// 10分設定でも5分時点を同じにし、終盤の上昇・個数と形状の差を検証する。
for (const place of ['triangle', 'four']) for (const charcoal of ['flat_charcoal', 'cube_charcoal']) {
  const cs = { ...base, heat: { heatPower: 70 }, place, equip: { charcoal }, steamSeconds: 600 };
  assert.equal(temperatureAfterSteam(cs, 300), temperatureAfterSteam({ ...cs, steamSeconds: 300 }, 300));
  assert(temperatureAfterSteam(cs, 600) - temperatureAfterSteam(cs, 540) > .01, 'Ten-minute heat stopped rising in the last minute');
  assert(temperatureAfterSteam(cs, 600) > temperatureAfterSteam(cs, 480) + .03);
}
assert(finish({ ...base, place: 'four' }) > finish({ ...base, place: 'triangle' }));
assert(finish({ ...base, equip: { charcoal: 'cube_charcoal' } }) > finish({ ...base, equip: { charcoal: 'flat_charcoal' } }));
console.log('[steam temperature] PASS: unchanged elapsed-time curve, late warming and meaningful coal count/shape balance');
