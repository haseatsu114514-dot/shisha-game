// 雑念弾幕の難度表（#2519）。舞台の格から表を選び、予告つきの波は表の重みで抽選する。
// DOM・保存状態に触れない純関数だけを置く。数値の根拠は docs/spec/steam_mind_and_patterns.md。

/** 舞台の格。rank は難度表の段、pressure は心の重圧（steam-mind.js）。 */
export const STEAM_STAGES = Object.freeze({
  practice: { rank: 0, pressure: 0 },
  local: { rank: 0, pressure: .05 },
  prefectural: { rank: 1, pressure: .1 },
  national: { rank: 2, pressure: .15 },
  world: { rank: 3, pressure: .2 },
  exhibition: { rank: 4, pressure: .25 },
});
const CHAPTER_STAGES = ["local", "local", "prefectural", "national", "world", "exhibition"];

/** cs.stage を明示すれば優先する（共通の大会runnerが設定で渡す口）。未指定の大会は章で決める。 */
export function steamStageOf(cs) {
  if (Object.hasOwn(STEAM_STAGES, cs?.stage ?? "")) return cs.stage;
  if (cs?.mode !== "tournament") return "practice";
  const chapter = Number(cs.chapter);
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= 5 ? CHAPTER_STAGES[chapter] : "local";
}

// calm は導入前の定数そのまま。練習と第1章の大会はこの表で、通常プレイの手触りを変えない。
// eased は救済（retryAssist）とチュートリアル。calm の eased も導入前の緩い値と一致させる。
export const STEAM_TABLES = Object.freeze([
  { id: "calm", rank: 0, spawnEvery: .46, speedScale: 1, objects: 2, waveEvery: 2.8, waveSpeed: 205, warn: .75,
    eased: { spawnEvery: .85, speedScale: .7, objects: 1, waveEvery: 4, waveSpeed: 140, warn: .75 },
    waves: { sweep: 1 } },
  { id: "stir", rank: 1, spawnEvery: .44, speedScale: 1.04, objects: 2, waveEvery: 2.7, waveSpeed: 210, warn: .75,
    eased: { spawnEvery: .83, speedScale: .7 * 1.04, objects: 1, waveEvery: 3.9, waveSpeed: 143, warn: .75 },
    waves: { sweep: 3, fan: 1 } },
  { id: "swell", rank: 2, spawnEvery: .42, speedScale: 1.08, objects: 2, waveEvery: 2.6, waveSpeed: 215, warn: .72,
    eased: { spawnEvery: .81, speedScale: .7 * 1.08, objects: 1, waveEvery: 3.8, waveSpeed: 146, warn: .75 },
    waves: { sweep: 2, fan: 1, pincer: 1 } },
  { id: "whirl", rank: 3, spawnEvery: .4, speedScale: 1.12, objects: 2, waveEvery: 2.5, waveSpeed: 220, warn: .7,
    eased: { spawnEvery: .79, speedScale: .7 * 1.12, objects: 1, waveEvery: 3.7, waveSpeed: 149, warn: .75 },
    waves: { sweep: 2, fan: 1, pincer: 1, ring: 1 } },
  { id: "storm", rank: 4, spawnEvery: .38, speedScale: 1.16, objects: 2, waveEvery: 2.4, waveSpeed: 225, warn: .68,
    eased: { spawnEvery: .77, speedScale: .7 * 1.16, objects: 1, waveEvery: 3.6, waveSpeed: 152, warn: .75 },
    waves: { sweep: 1, fan: 1, pincer: 1, ring: 1, rain: 1 } },
].map(table => Object.freeze({ ...table, eased: Object.freeze(table.eased), waves: Object.freeze(table.waves) })));

/** 舞台の格からその回の表を選ぶ。緩和は表の段を変えず、同じ表の eased 値で行う。 */
export function steamTableFor(stage) {
  const rank = (Object.hasOwn(STEAM_STAGES, stage) ? STEAM_STAGES[stage] : STEAM_STAGES.practice).rank;
  return STEAM_TABLES.find(table => table.rank === rank);
}

/** 一回の蒸らしで使う値。eased のときは表の eased を重ね、波の候補は同じ表のまま。 */
export function steamPace(table, eased = false) {
  const base = eased ? table.eased : table;
  return { spawnEvery: base.spawnEvery, speedScale: base.speedScale, objects: base.objects,
    waveEvery: base.waveEvery, waveSpeed: base.waveSpeed, warn: base.warn };
}

/** 波の種類を表の重みで引く。候補が一つなら乱数を引かない（calm は導入前と同じ乱数列になる）。 */
export function pickWave(table, random = Math.random) {
  const entries = Object.entries(table.waves).filter(([, weight]) => weight > 0);
  if (entries.length === 1) return entries[0][0];
  let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of entries) if ((roll -= weight) < 0) return kind;
  return entries.at(-1)[0];
}

export const SWEEP_LANES = 9, RAIN_LANES = 12;
const FAN_SPREAD = .2, RING_COUNT = 12;
const between = (random, lo, hi) => lo + random() * (hi - lo);
const clampTo = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

/**
 * 予告の中身を決める。弾はまだ出さない。
 * sweep の乱数の順序（左右→隙間）は導入前の横なぎと同じ。
 */
export function planWave(kind, { width, height, hx, hy, random = Math.random }) {
  if (kind === "pincer") {
    const gap = Math.floor(between(random, 2, 7));
    const shift = random() < .5 ? -1 : 1;
    const other = clampTo(gap + shift, 2, 6) === gap ? gap - shift : clampTo(gap + shift, 2, 6);
    return { kind, side: "both", gap, otherGap: other };
  }
  if (kind === "rain") {
    const lane = hx / (width / RAIN_LANES) - .5;
    return { kind, side: "top", gap: clampTo(Math.round(lane + between(random, -2, 2)), 1, RAIN_LANES - 2) };
  }
  if (kind === "fan") {
    const edge = Math.floor(between(random, 0, 4));
    let x = edge === 0 ? -24 : edge === 1 ? width + 24 : between(random, 20, width - 20);
    let y = edge === 2 ? -24 : edge === 3 ? height + 24 : between(random, 20, height - 20);
    // 心の目の前から撃たない。近すぎる辺なら向かいの辺へ移す。
    if (Math.hypot(hx - x, hy - y) < 200) { if (edge < 2) x = width - x; else y = height - y; }
    return { kind, side: "point", x, y, angle: Math.atan2(hy - y, hx - x) };
  }
  if (kind === "ring") {
    let x = between(random, 60, width - 60), y = between(random, 50, height - 50);
    if (Math.hypot(hx - x, hy - y) < 220) { x = width - x; y = height - y; }
    if (Math.hypot(hx - x, hy - y) < 220) { x = hx < width / 2 ? width - 70 : 70; y = hy < height / 2 ? height - 60 : 60; }
    return { kind, side: "point", x, y, turn: random() * Math.PI * 2 / RING_COUNT };
  }
  return { kind: "sweep", side: Math.round(between(random, 0, 1)), gap: Math.floor(between(random, 2, 7)) };
}

const sweepLanes = (gap, left, speed, width, height) => {
  const bullets = [];
  for (let i = 0; i < SWEEP_LANES; i++) {
    if (Math.abs(i - gap) <= 1) continue; // 予告を見て移動できる広さの安全な通り道
    bullets.push({ type: i % 2 ? "word" : "orb", x: left ? -20 : width + 20, y: (i + .5) * height / SWEEP_LANES, angle: left ? 0 : Math.PI, speed });
  }
  return bullets;
};

/** 予告どおりの弾を返す。位置は弾の中心。言葉は横に長いので、縦に並ぶ雨には使わない。 */
export function waveBullets(plan, { width, height, speed }) {
  if (plan.kind === "pincer") {
    return [...sweepLanes(plan.gap, true, speed * .85, width, height), ...sweepLanes(plan.otherGap, false, speed * .85, width, height)];
  }
  if (plan.kind === "rain") {
    const bullets = [];
    for (let i = 0; i < RAIN_LANES; i++) {
      if (Math.abs(i - plan.gap) <= 1) continue;
      bullets.push({ type: "orb", x: (i + .5) * width / RAIN_LANES, y: -20, angle: Math.PI / 2, speed: speed * .8 });
    }
    return bullets;
  }
  if (plan.kind === "fan") {
    return [-2, -1, 0, 1, 2].map(i => ({ type: i === 0 ? "word" : "orb", x: plan.x, y: plan.y, angle: plan.angle + i * FAN_SPREAD, speed: speed * (i === 0 ? .72 : .9) }));
  }
  if (plan.kind === "ring") {
    return Array.from({ length: RING_COUNT }, (_, i) => ({ type: "orb", x: plan.x, y: plan.y, angle: plan.turn + i * Math.PI * 2 / RING_COUNT, speed: speed * .75 }));
  }
  return sweepLanes(plan.gap, !plan.side, speed, width, height);
}
