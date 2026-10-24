import assert from 'node:assert/strict';
import { STATION_FARE } from '../../js/daily/station-travel.js';

const fares = new WeakMap();
export const stationFares = page => fares.get(page) || 0;

// Use the actual station UI; keep the fare separate from each venue's own cost.
export async function travelToCity(page, destination, { touch } = {}) {
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
  const snapshot = () => page.evaluate(async () => structuredClone((await import('./js/core/state.js')).state));
  const before = await snapshot(), from = before.flags._ch2_region;
  const fare = from === destination ? 0 : STATION_FARE;
  const hit = async id => {
    const button = page.locator(`[data-test="${id}"]`);
    if (touch ?? await page.evaluate(() => matchMedia('(pointer:coarse)').matches)) await button.tap();
    else await button.click();
  };
  if (fare) {
    await hit('station-open');
    const label = (await page.locator(`[data-test="station-destination-${destination}"]`).textContent()).split(' ／ ')[0];
    await hit('station-destination-' + destination);
    assert.deepEqual(await snapshot(), before, 'Selecting a city does not charge before confirmation');
    await hit('station-confirm');
    // The region flag commits before the arrival transition; wait for the new map to be rendered too.
    await page.waitForFunction(label => document.querySelector('.map:not(.done) [data-test="station-open"]')?.textContent
      === `駅・街移動（${label}）`, label);
  }
  await page.locator(`.map:not(.done)[data-region="${destination}"]`).waitFor();
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
  const after = await snapshot();
  if (fare) {
    assert(Number.isFinite(after.savedAt) && after.savedAt >= before.savedAt, 'A confirmed trip records its autosave');
    assert.deepEqual(await page.evaluate(async () => {
      const { SAVE_KEY } = await import('./js/core/state.js');
      return JSON.parse(localStorage.getItem(SAVE_KEY));
    }), after, 'The autosave contains the paid fare and destination together');
  }
  assert.deepEqual(after, { ...before, money: before.money - fare,
    savedAt: fare ? after.savedAt : before.savedAt,
    flags: { ...before.flags, _ch2_region: destination } },
  'A confirmed trip changes only the city and one fare, preserving actions and progress');
  fares.set(page, stationFares(page) + fare);
}

// 夜を柚ヶ谷で終えた時の、実際の帰宅切符も費用集計へ含める。
export function recordReturnFare(page, before, after) {
  if (before.flags._ch2_region === 'widehanga' && after.day > before.day) {
    assert.equal(after.flags._ch2_region, 'home', 'Every morning starts at home');
    fares.set(page, stationFares(page) + STATION_FARE);
  }
}
