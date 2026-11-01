// 配合と完成した一台の記録。答えの黄金比は参照せず、プレイヤーが作った配合を保存する。
import { growthEnabled, ensureGrowth } from "./growth.js";
import { growthSkill } from "./growth-effects.js";

const object = value => value && typeof value === "object" && !Array.isArray(value);
const owners = new WeakMap();
export const noteGrowthCraftOwner = (cs, s) => owners.set(cs, s);
export const cleanRememberedMix = mix => Object.fromEntries(Object.entries(object(mix) ? mix : {})
  .filter(([id, grams]) => id && Number.isFinite(grams) && grams > 0 && grams <= 100));

function memory(s) {
  const g = ensureGrowth(s);
  if (!object(g.memory)) g.memory = {};
  if (!object(g.memory.crafts)) g.memory.crafts = {};
  return g.memory;
}

/** 配合を実際に確定した時だけ。教材と、古い画面からの呼び出しはcallerで除外する。 */
export function rememberGrowthMix(s, mix) {
  if (!growthEnabled() || !s) return;
  const clean = cleanRememberedMix(mix);
  if (Object.keys(clean).length) memory(s).lastMix = clean;
}

/** 全工程を終えた一台だけ。再finalizeで前回との差を0へ書き換えない。 */
export function rememberGrowthCraft(s, cs) {
  if (!growthSkill(s, "K24") || !cs?.pullDone || cs.failed || cs.mode === "tutorial"
    || owners.has(cs) && owners.get(cs) !== s || cs.careHistory?.length !== 2 || !Number.isFinite(cs.total) || cs.growthMemoRecorded) return false;
  const mix = cleanRememberedMix(cs.mix);
  if (!Object.keys(mix).length) return false;
  const m = memory(s), id = cs.mixInfo?.recipe?.id || "_free";
  const previous = Object.hasOwn(m.crafts, id) ? m.crafts[id] : null;
  Object.defineProperty(m.crafts, id, { configurable: true, enumerable: true, writable: true,
    value: { mix, total: cs.total, previousTotal: Number.isFinite(previous?.total) ? previous.total : null,
      chapter: s.chapter, day: s.day } });
  cs.growthMemoRecorded = true;
  return true;
}

export function growthCraftMemo(s, id) {
  if (!growthSkill(s, "K24") || !object(s?.growth?.memory?.crafts)
    || !Object.hasOwn(s.growth.memory.crafts, id)) return null;
  const record = s.growth.memory.crafts[id];
  if (!object(record) || !Number.isFinite(record.total)) return null;
  const mix = cleanRememberedMix(record.mix);
  return Object.keys(mix).length ? { ...record, mix } : null;
}

/** 既知のレシピだけ。記録が無ければ通常の2:1:1…で、goldenの値を読まない。 */
export function growthRecallOptions(s, recipes, flavors, allowed) {
  if (!growthSkill(s, "K02")) return [];
  const available = mix => Object.keys(mix).length && Object.keys(mix).every(id => allowed.includes(id));
  const last = cleanRememberedMix(s.growth?.memory?.lastMix), options = [];
  if (available(last)) options.push({ id: "last", name: "前回の配合", mix: last });
  for (const recipe of recipes) {
    if (!s.recipes?.[recipe.id]) continue;
    const saved = object(s.growth?.memory?.crafts) && Object.hasOwn(s.growth.memory.crafts, recipe.id)
      ? cleanRememberedMix(s.growth.memory.crafts[recipe.id]?.mix) : {};
    let mix = saved;
    if (!available(mix)) {
      const ids = recipe.flavors.map(family => allowed.find(id => id === family || flavors[id]?.family === family));
      if (ids.some(id => !id) || !ids.length) continue;
      const weights = ids.map((_, i) => i === 0 ? 2 : 1), total = weights.reduce((a,b) => a+b,0);
      const grams = weights.map(weight => Math.floor(12 * weight / total));
      for (let i=0,left=12-grams.reduce((a,b)=>a+b,0);left>0;left--,i++) grams[i%grams.length]++;
      mix = Object.fromEntries(ids.map((id,i) => [id,grams[i]]));
    }
    options.push({ id: recipe.id, name: recipe.name, mix });
  }
  return options;
}
