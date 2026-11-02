// 盤の形とノードID。状態・UIに依存しない共通の正本。
import { BOARD_KEYS, BOARD_PREFIX, BOARD_SHAPES, STAT_SQUARES, SKILLS, STAT_UPGRADES, LESSONS, PEAK_CELL, FEATURES, NOTABLES } from "./growth-board-data.js";

export const HUB = "HUB";

// ---------------------------------------------------------------- 盤の型（2.2・v9）

/** 紋（0,0。盤の下の端）の隣: 左・右・上の3つ */
const isHubSide = (x, y) => Math.abs(x) + Math.abs(y) === 1 && y <= 0;

/** 盤ごとの型: マス（座標・種類・章・恩恵・紋からの道のり・帯）と線 */
function buildLayout(board) {
  const shape = BOARD_SHAPES[board];
  const cells = new Map(shape.cells.map(([key, kind, ring, perk, feature, notable]) => {
    const [x, y] = key.split(",").map(Number);
    return [key, { key, x, y, kind, ring, perk, feature, notable }];
  }));
  const adj = {};
  for (const [a, b] of shape.edges) {
    if (!cells.has(a) || !cells.has(b)) throw new Error(`${board} の線 ${a}-${b} が盤に無いマスを指す`);
    (adj[a] ??= []).push(b); (adj[b] ??= []).push(a);
  }
  const dist = {}, queue = [];
  for (const c of cells.values()) if (isHubSide(c.x, c.y)) { dist[c.key] = 1; queue.push(c.key); }
  while (queue.length) { const u = queue.shift(); for (const v of adj[u] || []) if (dist[v] == null) { dist[v] = dist[u] + 1; queue.push(v); } }
  for (const c of cells.values()) c.dist = dist[c.key];
  // 帯（SBD62）: 関門を通らずに届くか。届く中で第1章なら「近く」、それ以外は「中ほど」、関門を通るなら「関門の先」
  const free = new Set(), q2 = [];
  for (const c of cells.values()) if (isHubSide(c.x, c.y) && c.kind !== "gate") { free.add(c.key); q2.push(c.key); }
  while (q2.length) { const u = q2.shift(); for (const v of adj[u] || []) if (!free.has(v) && cells.get(v).kind !== "gate") { free.add(v); q2.push(v); } }
  for (const c of cells.values()) c.band = c.kind === "gate" ? 2 : !free.has(c.key) ? 3 : c.ring === 1 ? 1 : 2;
  return { cells: [...cells.values()], edges: shape.edges, adj };
}
export const LAYOUTS = Object.freeze(Object.fromEntries(BOARD_KEYS.map((b) => [b, Object.freeze(buildLayout(b))])));

/**
 * 盤ごとのマス。能力のマス（B1…）は章の早い順・紋に近い順に番号を振る。関門は BG1…。
 * スキル・授業・極みはデータの要所（cell）に置き、使わない要所は盤に出さない。
 */
function buildNodes() {
  const nodes = [];
  for (const board of BOARD_KEYS) {
    const layout = LAYOUTS[board], byKey = Object.fromEntries(layout.cells.map((c) => [c.key, c]));
    const order = (a, b) => a.ring - b.ring || a.dist - b.dist || Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x);
    const statCells = layout.cells.filter((c) => c.kind === "stat").sort(order);
    const stats = statCells.map((c, i) => ({ id: `${BOARD_PREFIX[board]}${i + 1}`, kind: "stat", board, cost: 1, index: i + 1, cell: c.key }));
    const peak = byKey[PEAK_CELL[board]];
    stats.push({ id: `${BOARD_PREFIX[board]}${stats.length + 1}`, kind: "stat", board, cost: 1, index: stats.length + 1, cell: peak.key, peak: true });
    if (stats.length !== STAT_SQUARES[board]) throw new Error(`${board} の能力のマスの数が合わない`);
    const gates = layout.cells.filter((c) => c.kind === "gate").sort(order)
      .map((c, i) => ({ id: `${BOARD_PREFIX[board]}G${i + 1}`, kind: "gate", board, cost: 1, cell: c.key }));
    const spots = [
      ...SKILLS.filter((s) => s.board === board).map((s) => ({ ...s, kind: "skill" })),
      ...STAT_UPGRADES.filter(s=>s.board===board).map(s=>({...s,kind:"stat"})),
      ...LESSONS.filter((l) => l.board === board).map((l) => ({ ring: 1, ...l, kind: "lesson", cost: 0 })),
    ];
    for (const spot of spots) {
      const c = byKey[spot.cell];
      if (!c || c.kind !== "spot") throw new Error(`${spot.id} のマス ${spot.cell} が要所でない`);
      if (c.ring > spot.ring) throw new Error(`${spot.id} は第${spot.ring}章に届けたいが、要所が第${c.ring}章`);
    }
    nodes.push(...stats, ...gates, ...spots);
  }
  const at = {};
  for (const n of nodes) {
    const c = LAYOUTS[n.board].cells.find((x) => x.key === n.cell);
    if (at[`${n.board}:${n.cell}`]) throw new Error(`${n.id} と ${at[`${n.board}:${n.cell}`]} が同じマス`);
    Object.assign(n, { gx: c.x, gy: c.y, ring: c.ring, band: c.band, ...((n.kind === "stat" || n.kind === "gate") && c.perk ? { perk: c.perk } : {}),
      ...(n.kind === "stat" && c.feature ? { feature: c.feature } : {}), ...(n.kind === "stat" && c.notable ? { notable: c.notable } : {}) });
    if (n.feature && FEATURES[n.feature]?.board !== n.board) throw new Error(`${n.id} の✦ ${n.feature} が盤に合わない`);
    if (n.notable && NOTABLES[n.notable]?.board !== n.board) throw new Error(`${n.id} の要 ${n.notable} が盤に合わない`);
    at[`${n.board}:${n.cell}`] = n.id;
  }
  for (const n of nodes) {
    n.links = (LAYOUTS[n.board].adj[n.cell] || []).map((k) => at[`${n.board}:${k}`]).filter(Boolean);
    if (isHubSide(n.gx, n.gy)) n.links.push(HUB);
    Object.freeze(n.links);
  }
  // 授業の小道: 授業のマスにつながる能力のマスは、その人に会うまで盤に出さない（2026-10-30 オーナー採用）
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  for (const lesson of nodes.filter((n) => n.kind === "lesson")) {
    // 授業にしかつながらない能力のマスだけが小道（一周の道の角のように、ほかへも続くマスは小道にしない）
    for (const id of lesson.links) {
      const n = byId[id];
      if (n?.kind === "stat" && n.links.filter((l) => l !== lesson.id).length <= 1 && !n.links.includes(HUB)) Object.assign(n, { trail: lesson.id });
    }
  }
  return nodes.map(Object.freeze);
}

export const NODES = Object.freeze(buildNodes());
export const NODE_BY_ID = Object.freeze(Object.fromEntries(NODES.map((n) => [n.id, n])));
export const BOARD_TOTAL_COST = NODES.reduce((n, node) => n + node.cost, 0);
export const boardNodes = (board) => NODES.filter((n) => n.board === board);

