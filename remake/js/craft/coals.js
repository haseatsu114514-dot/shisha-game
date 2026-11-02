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
// 炭1個あたりの性能。gentle はフラット系（序盤の穏やかな3個置きの対象）。表に無いIDはフラット扱い。
const COAL_SPECS = {
  flat_charcoal: { gentle: true, power: 1, response: 1.00, width: 1.04, burnRisk: 0, smoke: 0, cool: 1.00 },
  cube_charcoal: { gentle: false, power: 1.13, response: 1.12, width: 0.94, burnRisk: 3.5, smoke: 2, cool: 0.92 },
  // 高密度フラット炭（第2章〜）: 火力・反応はフラットと同じで、適温帯だけ少し広い。
  dense_flat_charcoal: { gentle: true, power: 1, response: 1.00, width: 1.06, burnRisk: 0, smoke: 0, cool: 1.00 },
};
const coalSpec = (type) => COAL_SPECS[type] || COAL_SPECS.flat_charcoal;
export function coalTypes(cs, count = coalCount(cs)) {
  const base = Object.hasOwn(COAL_SPECS, cs.equip?.charcoal ?? "") ? cs.equip.charcoal : "flat_charcoal";
  return Array.from({ length: count }, (_, i) => cs.coalTypes?.[i] || base);
}
export function availableCoalLayouts(flags = {}) {
  return ["triangle", ...(flags[COAL_UNLOCK.four] ? ["four"] : [])];
}
export function coalWarmth(cs) {
  const specs = coalTypes(cs).map(coalSpec);
  const n = specs.length || 3;
  const flatThree = n === 3 && specs.every(spec => spec.gentle);
  // 序盤のflat3だけを穏やかにする。4点・混合・cubeの既存性能は保持。
  const power = specs.reduce((sum, spec) => sum + spec.power, 0) / 3 * (flatThree ? .90 : 1);
  const response = specs.reduce((sum, spec) => sum + spec.response, 0) / n;
  const widthFactor = specs.reduce((sum, spec) => sum + spec.width, 0) / n;
  const burnRisk = specs.reduce((sum, spec) => sum + spec.burnRisk, 0);
  const smokeBonus = specs.reduce((sum, spec) => sum + spec.smoke, 0);
  const coolFactor = specs.reduce((sum, spec) => sum + spec.cool, 0) / n;
  return { power, count: n, response, pullResponse: flatThree ? .94 : 1, widthFactor, burnRisk, smokeBonus, coolFactor };
}
