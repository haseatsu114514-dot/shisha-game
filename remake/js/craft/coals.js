// 初期はフラット／キューブの三角配置。上級配置は交流などの解放フラグで追加する。
export const COAL_UNLOCK = { four: "_coal_four_unlocked", mixed: "_coal_mix_unlocked" };
export const coalCount = (cs) => cs.place === "four" ? 4 : 3;
export function coalTypes(cs, count = coalCount(cs)) {
  const base = cs.equip?.charcoal === "cube_charcoal" ? "cube_charcoal" : "flat_charcoal";
  return Array.from({ length: count }, (_, i) => cs.coalTypes?.[i] || base);
}
export function availableCoalLayouts(flags = {}) {
  return ["triangle", ...(flags[COAL_UNLOCK.four] ? ["four"] : [])];
}
export function coalWarmth(cs) {
  const types = coalTypes(cs);
  const power = types.reduce((sum, type) => sum + (type === "cube_charcoal" ? 1.13 : 1), 0) / 3;
  return { power, count: types.length };
}
