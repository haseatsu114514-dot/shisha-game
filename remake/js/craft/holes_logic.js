// 穴開けの純粋な計算。穴の数は採点の直減点に使わず、後工程へ渡す密度にする。
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const RINGS = [
  { id: "outer", label: "外周", r: 0.8, targets: 12, period: 6.4, weight: 0.5, role: "熱の広がり・安定感" },
  { id: "middle", label: "中周", r: 0.54, targets: 8, period: 5.2, weight: 0.3, role: "ドロー・煙量" },
  { id: "inner", label: "内周", r: 0.28, targets: 4, period: 3.8, weight: 0.2, role: "抜け感（開けすぎ注意）" },
];
export const normalizeAngle = (angle) => ((angle % TAU) + TAU) % TAU;
export function circularAngleDistance(a, b) {
  const difference = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(difference, TAU - difference);
}
export const minimumRingComplete = (rings) => {
  const outer = rings.find((ring) => ring.id === "outer");
  return !!outer && outer.taken.length >= 12 && outer.taken.slice(0, 12).every(Boolean);
};
/** 外周だけの12穴は1.35倍、全24穴は1倍。途中の密度は連続的に変わる */
export const timingToleranceFor = (count) => 1 + clamp((24 - count) / 12, 0, 1) * 0.35;
export function foilDensityProfile(rings) {
  const countOf = (id) => rings.find((ring) => ring.id === id)?.holes.length || 0;
  const count = rings.reduce((sum, ring) => sum + ring.holes.length, 0);
  const density = clamp(count / 24, 0, 1);
  return { count, density, sparse: 1 - density, outer: countOf("outer"), middle: countOf("middle"), inner: countOf("inner") };
}

/** 均等度50 / タイミング精度30 / 穴サイズ15 / 手際5。未着手リングや空き目印は減点しない */
export function evaluateFoil(rings, tally, timeRatio, goodWin) {
  const profile = foilDensityProfile(rings);
  const tolerance = timingToleranceFor(profile.count);
  const timingWindow = goodWin * tolerance;
  const per = rings.map((ring) => {
    const angles = ring.holes.map((hole) => normalizeAngle(hole.a)).sort((a, b) => a - b);
    const count = angles.length;
    let even = 0;
    if (count > 0) {
      const gaps = angles.map((angle, i) => i === count - 1 ? angles[0] + TAU - angle : angles[i + 1] - angle);
      const ideal = TAU / count;
      const deviation = Math.sqrt(gaps.reduce((sum, gap) => sum + (gap - ideal) ** 2, 0) / count) / ideal;
      even = clamp(1 - deviation * 1.1, 0, 1);
    }
    const precision = count ? ring.holes.reduce((sum, hole) => sum + clamp(1 - hole.d / timingWindow, 0, 1), 0) / count : 0;
    return { id: ring.id, count, even, precision, taken: ring.taken.filter(Boolean).length, targets: ring.targets, weight: ring.weight };
  });
  // 開けたリングだけで重みを正規化。内側を開けない選択を品質不足にしない。
  const activeWeight = per.filter((ring) => ring.count > 0).reduce((sum, ring) => sum + ring.weight, 0);
  const evenness = activeWeight ? per.reduce((sum, ring) => sum + ring.even * ring.weight, 0) / activeWeight : 0;
  const precision = activeWeight ? per.reduce((sum, ring) => sum + ring.precision * ring.weight, 0) / activeWeight : 0;
  const completion = per.reduce((sum, ring) => sum + ring.taken, 0) / per.reduce((sum, ring) => sum + ring.targets, 0);
  const sizeStab = clamp(0.92 - (tally.tooClose || 0) * 0.08 - (tally.miss || 0) * 0.03, 0.4, 1);
  const score = profile.count ? Math.round(100 * (evenness * 0.5 + precision * 0.3 + sizeStab * 0.15 + clamp(timeRatio * 2.5, 0, 1) * 0.05)) : 0;
  const ringOf = (id) => per.find((ring) => ring.id === id);
  const dots = rings.flatMap((ring) => ring.holes.map((hole) => [Math.cos(hole.a) * ring.r, Math.sin(hole.a) * ring.r * 0.34]));
  return {
    score, evenness, precision, completion, sizeStab, timeRatio,
    outer: profile.outer, middle: profile.middle, inner: profile.inner, total: profile.count,
    innerExcess: Math.max(0, profile.inner - 4), outerEven: ringOf("outer")?.even || 0,
    tally: { ...tally }, dots, minimumComplete: minimumRingComplete(rings), densityProfile: profile, timingTolerance: tolerance,
  };
}
