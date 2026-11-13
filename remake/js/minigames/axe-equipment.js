// Three-tier personal hatchets: the venue and preview share one purchase catalog.
// Reuse the legacy item and return-fare budget; scoring geometry and points never depend on gear.
import { HOBBY_GEAR, AXE_STEADY, buyGear, gearStatus } from '../core/hobby-gear.js';
import { POWER } from './axe-model.js';
export const AXE_EQUIPMENT_VERSION = 1;
// handle・grip・head・blade は見た目だけ（一人称の手、飛ぶ斧、刺さった斧。2026-11-13 手応えレビュー指摘11）。head/blade が無い斧は店の斧の鋼の色。
export const HOUSE_AXE = Object.freeze({ id: 'house', name: '店の斧', tier: 0, price: 0, steady: 1, powerErrorScale: 1, handle: '#af7d45', grip: '#433f35' });
export const PERSONAL_AXES = Object.freeze([
  Object.freeze({ ...HOBBY_GEAR.gear_hatchet, tier: 1, steady: AXE_STEADY, powerErrorScale: 1, handle: '#af7d45', grip: '#775133' }),
  Object.freeze({ ...HOBBY_GEAR.gear_hatchet_balanced, tier: 2, steady: .8, powerErrorScale: .9, handle: '#8c5f38', grip: '#315c5a', head: '#5d7288', blade: '#cbd8e4', stickRate: .94 }),
  Object.freeze({ ...HOBBY_GEAR.gear_hatchet_precision, tier: 3, steady: .7, powerErrorScale: .8, handle: '#64462f', grip: '#303c48', head: '#3b434f', blade: '#eef3f7', stickRate: 1.08 }),
]);
export const AXE_EQUIPMENT = Object.freeze(Object.fromEntries([HOUSE_AXE, ...PERSONAL_AXES].map(g => [g.id, g])));
export const ownsAxe = (s, id) => id === 'house' || Object.hasOwn(AXE_EQUIPMENT, id) && Array.isArray(s?.owned) && s.owned.includes(id);
// No new persistent equipment flag: existing owned items survive save/load and NG+ unchanged.
export const bestOwnedAxe = s => [...PERSONAL_AXES].reverse().find(g => ownsAxe(s, g.id)) || HOUSE_AXE;
export function axePurchaseStatus(s, id) {
  const gear = PERSONAL_AXES.find(g => g.id === id);
  if (!gear || !s || !Array.isArray(s.owned) || !Number.isFinite(s.money) || s.money < 0 || !Number.isInteger(s.money)) return { ok: false, reason: 'invalid' };
  if (ownsAxe(s, id)) return { ok: false, reason: 'owned' };
  if (!Number.isInteger(s.chapter) || s.chapter < gear.chapterMin) return { ok: false, reason: 'chapter' };
  return gearStatus(s, id);
}
export function buyAxe(s, id) {
  if (!axePurchaseStatus(s, id).ok) return false;
  return buyGear(s, id); // Catalog is authoritative for every tier; ownership is never exchanged.
}
export function axePower(rawPower, id = 'house') {
  if (!Number.isFinite(rawPower) || rawPower < 0 || rawPower > 1 || !Object.hasOwn(AXE_EQUIPMENT, id)) throw new RangeError('Invalid axe power input');
  const factor = AXE_EQUIPMENT[id].powerErrorScale;
  return factor === 1 ? rawPower : POWER.ideal + (rawPower - POWER.ideal) * factor;
}
export function axeGreenBand(id = 'house') {
  if (!Object.hasOwn(AXE_EQUIPMENT, id)) throw new RangeError('Unknown axe');
  const f = AXE_EQUIPMENT[id].powerErrorScale;
  return { min: POWER.ideal + (POWER.sweetMin - POWER.ideal) / f, max: POWER.ideal + (POWER.sweetMax - POWER.ideal) / f };
}
export const axeEffect = gear => `手ぶれ ${Math.round((1 - gear.steady) * 100)}%減 / 回転のずれ ${Math.round((1 - gear.powerErrorScale) * 100)}%減`;
