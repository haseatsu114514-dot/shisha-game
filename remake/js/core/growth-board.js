// 心得の盤の規則（SPEC 第2版 2.2〜2.6・3.1・1.9）。データは core/growth-board-data.js、画面は daily/growth-board-screen.js。
// まだ GROWTH_BOARD の裏の試作: 盤の解放は state.stats に書き戻さない（能力の効き目の付け替えは C5）。
import { state } from "./state.js";
import { affinityLevel } from "./stats.js";
import { ensureGrowth, HIDANE_KEYS, noteLit } from "./growth.js";
import {
  BOARD_KEYS, BOARD_JA, BOARD_PREFIX, SQUARES_PER_STEP, STAT_SQUARES, STAT_RING_COUNTS, HALF_LAYOUT,
  SKILLS, LESSONS, LESSON_MIN_STEP, RANKS, PEAK_CELL,
} from "./growth-board-data.js";

export * from "./growth-board-data.js";

const cellKey = (x, y) => `${x},${y}`;
export const HUB = "HUB";

// ---------------------------------------------------------------- 盤の型（2.2）

/** 半分の道を180度回して、36マス・線・要所を作る */
function buildLayout() {
  const cells = new Map(), edges = [];
  for (const rot of [1, -1]) {
    for (const path of HALF_LAYOUT.paths) {
      const pts = path.map(([x, y]) => [x * rot, y * rot]);
      for (const [x, y] of pts) if (!cells.has(cellKey(x, y))) cells.set(cellKey(x, y), { x, y, special: false });
      for (let i = 1; i < pts.length; i++) edges.push([cellKey(...pts[i - 1]), cellKey(...pts[i])]);
    }
    for (const [x, y] of HALF_LAYOUT.special) cells.get(cellKey(x * rot, y * rot)).special = true;
  }
  const adj = {};
  for (const [a, b] of edges) { (adj[a] ??= []).push(b); (adj[b] ??= []).push(a); }
  // 紋からの近さ（道を歩いた数）。紋の上下左右の隣が1
  const dist = {}, queue = [];
  for (const c of cells.values()) if (Math.abs(c.x) + Math.abs(c.y) === 1) { dist[cellKey(c.x, c.y)] = 1; queue.push(cellKey(c.x, c.y)); }
  while (queue.length) {
    const u = queue.shift();
    for (const v of adj[u] || []) if (dist[v] == null) { dist[v] = dist[u] + 1; queue.push(v); }
  }
  for (const c of cells.values()) c.dist = dist[cellKey(c.x, c.y)];
  return { cells: [...cells.values()], edges, adj };
}
export const LAYOUT = Object.freeze(buildLayout());

const ringOfStatIndex = (i) => { // i は 0 始まり
  let left = i;
  for (let r = 0; r < STAT_RING_COUNTS.length; r++) { if (left < STAT_RING_COUNTS[r]) return r + 1; left -= STAT_RING_COUNTS[r]; }
  return STAT_RING_COUNTS.length;
};

/**
 * 盤ごとのマス。スキル・授業・極みはデータの要所（cell）に置き、使わない要所は盤に出さない。
 * 能力のマスは、その章の要所へ届く道のマスほど早い章に入れ、残りは紋に近い順（章の数は 12・6・3・3・3）。
 */
function buildNodes() {
  // 紋から各マスへの道（木なので一通り）
  const prev = {}, queue = [];
  for (const c of LAYOUT.cells) if (Math.abs(c.x) + Math.abs(c.y) === 1) { prev[cellKey(c.x, c.y)] = null; queue.push(cellKey(c.x, c.y)); }
  while (queue.length) { const u = queue.shift(); for (const v of LAYOUT.adj[u] || []) if (!(v in prev)) { prev[v] = u; queue.push(v); } }
  const route = (cell) => { const out = []; for (let c = prev[cell]; c; c = prev[c]) out.push(c); return out; };
  const byCell = Object.fromEntries(LAYOUT.cells.map((c) => [cellKey(c.x, c.y), c]));
  const nodes = [];
  for (const board of BOARD_KEYS) {
    const spots = [
      ...SKILLS.filter((s) => s.board === board).map((s) => ({ ...s, kind: "skill" })),
      ...LESSONS.filter((l) => l.board === board).map((l) => ({ ring: 1, ...l, kind: "lesson", cost: 0 })),
    ];
    const peakCell = PEAK_CELL[board];
    // 道のマスが要る章（一番早い章）
    const need = {};
    for (const spot of [...spots, { cell: peakCell, ring: 5 }]) {
      for (const c of route(spot.cell)) need[c] = Math.min(need[c] ?? 9, spot.ring);
    }
    const regular = LAYOUT.cells.filter((c) => !c.special).map((c) => cellKey(c.x, c.y))
      .sort((a, b) => (need[a] ?? 9) - (need[b] ?? 9) || byCell[a].dist - byCell[b].dist
        || Math.abs(byCell[a].y) - Math.abs(byCell[b].y) || Math.atan2(byCell[a].y, byCell[a].x) - Math.atan2(byCell[b].y, byCell[b].x));
    const stats = Array.from({ length: STAT_SQUARES }, (_, i) => ({
      id: `${BOARD_PREFIX[board]}${i + 1}`, kind: "stat", board, ring: ringOfStatIndex(i), cost: 1, index: i + 1,
      cell: i === STAT_SQUARES - 1 ? peakCell : regular[i], peak: i === STAT_SQUARES - 1 || undefined,
    }));
    nodes.push(...stats, ...spots);
  }
  const at = {};
  for (const n of nodes) {
    const c = byCell[n.cell];
    if (!c) throw new Error(`${n.id} のマス ${n.cell} が盤に無い`);
    if (at[`${n.board}:${n.cell}`]) throw new Error(`${n.id} と ${at[`${n.board}:${n.cell}`]} が同じマス`);
    Object.assign(n, { gx: c.x, gy: c.y });
    at[`${n.board}:${n.cell}`] = n.id;
  }
  for (const n of nodes) {
    n.links = (LAYOUT.adj[n.cell] || []).map((k) => at[`${n.board}:${k}`]).filter(Boolean);
    if (Math.abs(n.gx) + Math.abs(n.gy) === 1) n.links.push(HUB);
    Object.freeze(n.links);
  }
  return nodes.map(Object.freeze);
}

export const NODES = Object.freeze(buildNodes());
export const NODE_BY_ID = Object.freeze(Object.fromEntries(NODES.map((n) => [n.id, n])));
export const BOARD_TOTAL_COST = NODES.reduce((n, node) => n + node.cost, 0);
export const boardNodes = (board) => NODES.filter((n) => n.board === board);

export const nodeLabel = (node) => node.kind === "stat"
  ? `${BOARD_JA[node.board]}のマス${node.peak ? "（極み）" : ""}` : node.kind === "lesson" ? `授業「${node.name}」` : `スキル「${node.name}」`;
export const rankOfStep = (board, step) => RANKS[board][Math.min(4, Math.floor((step - 1) / 2))];

// ---------------------------------------------------------------- 規則（2.3）

/** 開いている章の範囲。第N章で第N輪（周回の引き継ぎは growth.ringsOpen） */
export function ringsOpen(s = state) {
  return Math.min(5, Math.max(1, Number(s?.chapter) || 1, Number(s?.growth?.ringsOpen) || 1));
}

/** 灯した能力のマスの数（能力が伸びる授業は bonus 分を足す。2.6） */
export function statCount(board, unlocked) {
  let n = 0;
  for (const id of unlocked) {
    const node = NODE_BY_ID[id];
    if (node?.board !== board) continue;
    if (node.kind === "stat") n++;
    else if (node.kind === "lesson" && node.reward === "stat") n += node.bonus || 0;
  }
  return Math.min(STAT_SQUARES, n);
}
/** 段 s＝1＋（能力のマス÷3 の切り捨て）。10段まで（3.1） */
export const stepOf = (board, unlocked) => Math.min(10, 1 + Math.floor(statCount(board, unlocked) / SQUARES_PER_STEP));
/** 連続して効くものの割合 t（0〜1） */
export const statRatio = (board, unlocked) => statCount(board, unlocked) / STAT_SQUARES;

/** 線でつながった隣が灯っている（か、紋の隣） */
export const connected = (node, unlocked) => node.links.some((id) => id === HUB || unlocked.has(id));

/** 授業の相手に会っているか（スミさんは最初から） */
export function hasMet(who, s = state) {
  if (who === "sumi") return true;
  return !!(s?.met?.[who] || s?.flags?.[`_met_${who}`] || (s?.affinity?.[who] || 0) > 0 || (s?.story?.[who] || 0) > 0);
}
const heartOf = (who, s) => s === state ? affinityLevel(who) : 0;

/** 授業の錠。開いていれば null、閉じていれば足りないものの内訳 */
export function lessonLock(node, unlocked, s = state) {
  if (node.kind !== "lesson") return null;
  const step = stepOf(node.board, unlocked), heart = node.need ? heartOf(node.who, s) : 0;
  const lack = { step: step < LESSON_MIN_STEP, heart: !!node.need && heart < node.need, met: hasMet(node.who, s) };
  return lack.step || lack.heart ? { ...lack, stepNow: step, heartNow: heart } : null;
}

/** 払い方。その盤の色の火種を先に使い、足りない分を万能で（1.9）。払えなければ null */
export function paymentFor(node, hidane) {
  if (!node.cost) return {};
  const pay = {};
  let left = node.cost;
  const own = Math.min(left, hidane[node.board] || 0);
  if (own) { pay[node.board] = own; left -= own; }
  const any = Math.min(left, hidane.any || 0);
  if (any) { pay.any = any; left -= any; }
  return left > 0 ? null : pay;
}
const spend = (hidane, pay) => { for (const [k, n] of Object.entries(pay)) hidane[k] -= n; };

/** そのマスが今の積み方で取れるか（火種は見ない） */
function reachable(node, unlocked, s) {
  return node.ring <= ringsOpen(s) && !lessonLock(node, unlocked, s) && connected(node, unlocked);
}

/**
 * 仮置きを順に積み直す。払えない・つながらない・錠が閉じた仮置きは外す。
 * 戻り値: { pending: [ids], unlocked: Set（確定＋仮置き）, hidane: 残り, pays: id -> 払い方 }
 */
export function replay(g, pendingIds, s = state) {
  const unlocked = new Set(g.nodes);
  const hidane = Object.fromEntries(HIDANE_KEYS.map((k) => [k, g.hidane[k] || 0]));
  const kept = [], pays = {};
  let rest = pendingIds.filter((id) => NODE_BY_ID[id] && !unlocked.has(id));
  // 仮置きの順に関係なく、つながった順に積む（途中を外すと先が外れる）
  for (let progress = true; progress && rest.length;) {
    progress = false;
    for (const id of rest) {
      const node = NODE_BY_ID[id];
      if (!reachable(node, unlocked, s)) continue;
      const pay = paymentFor(node, hidane);
      if (!pay) continue;
      spend(hidane, pay);
      unlocked.add(id);
      kept.push(id);
      pays[id] = pay;
      progress = true;
    }
    rest = rest.filter((id) => !unlocked.has(id));
  }
  return { pending: kept, unlocked, hidane, pays };
}

/**
 * マスの状態（6.2）: unlocked | pending | available | short | far（まだつながっていない）
 * | locked（章で開く）| sealed（授業の錠）
 */
export function nodeStatus(node, g, view, s = state) {
  if (g.nodes.includes(node.id)) return "unlocked";
  if (view.pending.includes(node.id)) return "pending";
  if (node.ring > ringsOpen(s)) return "locked";
  if (lessonLock(node, view.unlocked, s)) return "sealed";
  if (!connected(node, view.unlocked)) return "far";
  return paymentFor(node, view.hidane) ? "available" : "short";
}

/** 仮置きを確定する。払った種類を記録し（組み直しで同じ種類に戻すため）、確定したマスを返す */
export function commitPending(pendingIds, s = state) {
  const g = ensureGrowth(s);
  const view = replay(g, pendingIds, s);
  for (const id of view.pending) {
    const node = NODE_BY_ID[id];
    g.nodes.push(id);
    g.paid[id] = view.pays[id];
    spend(g.hidane, view.pays[id]);
    noteLit(g, node.board, node.cost);
  }
  if (view.pending.includes(g.target)) g.target = null;
  return view.pending.map((id) => NODE_BY_ID[id]);
}

// ---------------------------------------------------------------- 目標（2.4）

/** 目標までの一番安い道（灯した所は0、未解放はその火種）。章や錠は見ない。戻り値 { cost, path: 未解放のID（紋に近い順） } */
export function pathTo(id, unlocked) {
  const goal = NODE_BY_ID[id];
  if (!goal) return { cost: 0, path: [] };
  const nodes = boardNodes(goal.board);
  const dist = { [HUB]: 0 }, prev = {}, done = new Set(), queue = [HUB];
  const linksOf = (u) => u === HUB ? nodes.filter((n) => n.links.includes(HUB)).map((n) => n.id) : NODE_BY_ID[u].links;
  while (queue.length) {
    queue.sort((a, b) => dist[a] - dist[b]);
    const u = queue.shift();
    if (done.has(u)) continue;
    done.add(u);
    for (const v of linksOf(u)) {
      if (v === HUB) continue;
      const w = unlocked.has(v) ? 0 : NODE_BY_ID[v].cost;
      if (dist[u] + w < (dist[v] ?? Infinity)) { dist[v] = dist[u] + w; prev[v] = u; queue.push(v); }
    }
  }
  const path = [];
  for (let c = id; c && c !== HUB; c = prev[c]) if (!unlocked.has(c)) path.unshift(c);
  return { cost: dist[id] ?? 0, path };
}

/** 「目標まで灯す」: 道の手前から、火種と章と錠が許すところまで仮置きに足す */
export function pendingTowards(g, pending, id, s = state) {
  const view = replay(g, pending, s);
  const next = [...view.pending];
  for (const step of pathTo(id, view.unlocked).path) {
    const trial = replay(g, [...next, step], s);
    if (!trial.pending.includes(step)) break;
    next.push(step);
  }
  return next;
}

// ---------------------------------------------------------------- 集計

/** 章の範囲ごとの火種（灯した分／全部） */
export function ringFill(g, ring) {
  let got = 0, total = 0;
  for (const node of NODES) if (node.ring === ring) { total += node.cost; if (g.nodes.includes(node.id)) got += node.cost; }
  return { got, total };
}

/** 今の盤で使い道のある火種があるか（未使用の印を出す条件。REPORT R6） */
export function hasUsableHidane(g, s = state) {
  const view = replay(g, [], s);
  return NODES.some((node) => node.cost > 0 && nodeStatus(node, g, view, s) === "available");
}

/** その盤で今取れるマスの数（札の印） */
export function availableCount(board, g, view, s = state) {
  return boardNodes(board).filter((n) => nodeStatus(n, g, view, s) === "available").length;
}
