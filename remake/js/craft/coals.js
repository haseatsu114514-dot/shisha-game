// 初期はフラット／キューブの三角配置。上級配置は交流などの解放フラグで追加する。
export const COAL_UNLOCK = { cube: "_coal_cube_learned", four: "_coal_four_unlocked", mixed: "_coal_mix_unlocked" };
export const hasCoalTraining = (flags = {}) => flags[COAL_UNLOCK.cube] === true;

/** 所有品や旧授業から習得を推定しない。setupを通らない自主練も同じ初期条件。 */
export function applyCoalTraining(cs, flags = {}) {
  if (cs.mode === "tutorial" || !hasCoalTraining(flags)) {
    cs.equip = { ...cs.equip, charcoal: "flat_charcoal" };
    cs.place = "triangle";
    cs.coalTypes = Array(3).fill("flat_charcoal");
    return false;
  }
  return true;
}
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
  const n = types.length || 3;
  const flatThree = n === 3 && types.every(type => type === "flat_charcoal");
  // 序盤のflat3だけを穏やかにする。4点・混合・cubeの既存性能は保持。
  const power = types.reduce((sum, type) => sum + (type === "cube_charcoal" ? 1.13 : 1), 0) / 3 * (flatThree ? .90 : 1);
  const response = types.reduce((sum, type) => sum + (type === "cube_charcoal" ? 1.12 : 1.00), 0) / n;
  const widthFactor = types.reduce((sum, type) => sum + (type === "cube_charcoal" ? 0.94 : 1.04), 0) / n;
  const burnRisk = types.reduce((sum, type) => sum + (type === "cube_charcoal" ? 3.5 : 0), 0);
  const smokeBonus = types.reduce((sum, type) => sum + (type === "cube_charcoal" ? 2 : 0), 0);
  const coolFactor = types.reduce((sum, type) => sum + (type === "cube_charcoal" ? 0.92 : 1.00), 0) / n;
  return { power, count: n, response, pullResponse: flatThree ? .94 : 1, widthFactor, burnRisk, smokeBonus, coolFactor };
}
