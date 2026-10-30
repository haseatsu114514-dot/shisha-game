// 心得の盤の規則（SPEC 第2版 2.2〜2.6・3.1・1.9）。データは core/growth-board-data.js、画面は daily/growth-board-screen.js。
// まだ GROWTH_BOARD の裏の試作: 盤の解放は state.stats に書き戻さない（能力の効き目の付け替えは C5）。
import { state } from "./state.js";
import { affinityLevel } from "./stats.js";
import { ensureGrowth, HIDANE_KEYS, noteLit, BOARD_TOTAL } from "./growth.js";
import {
  BOARD_KEYS, BOARD_JA, BOARD_PREFIX, STAT_SQUARES, BOARD_SHAPES,
  SKILLS, LESSONS, LESSON_MIN_STEP, RANKS, PEAK_CELL, SQUARE_PERKS, PERK_TIERS,
} from "./growth-board-data.js";

export * from "./growth-board-data.js";

const cellKey = (x, y) => `${x},${y}`;
export const HUB = "HUB";

// ---------------------------------------------------------------- 盤の型（2.2・v9）

/** 紋（0,0。盤の下の端）の隣: 左・右・上の3つ */
const isHubSide = (x, y) => Math.abs(x) + Math.abs(y) === 1 && y <= 0;

/** 盤ごとの型: マス（座標・種類・章・恩恵・紋からの道のり・帯）と線 */
function buildLayout(board) {
  const shape = BOARD_SHAPES[board];
  const cells = new Map(shape.cells.map(([key, kind, ring, perk]) => {
    const [x, y] = key.split(",").map(Number);
    return [key, { key, x, y, kind, ring, perk }];
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
    Object.assign(n, { gx: c.x, gy: c.y, ring: c.ring, band: c.band, ...(n.kind === "stat" && c.perk ? { perk: c.perk } : {}) });
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

const fmtNum = (v) => String(Math.round(v * 10) / 10);
/** 普通のマスの恩恵（SBD59・SBD62）。能力のマスでなければ null。極みは基礎。強さは帯の倍率（近く×1・中ほど×2・関門の先×3） */
export function perkOf(node) {
  if (node?.kind !== "stat") return null;
  const def = SQUARE_PERKS[node.board];
  const perk = (!node.peak && def.perks[node.perk]) || def.base;
  const tier = PERK_TIERS[node.band] || PERK_TIERS[1];
  return { ...perk, tier: node.band, tierName: tier.name, text: perk.text.replace(/\{([\d.]+)\}/g, (_, v) => fmtNum(Number(v) * tier.mult)) };
}

export const nodeLabel = (node) => node.kind === "stat"
  ? `${BOARD_JA[node.board]}のマス${node.peak ? "（極み）" : ""}` : node.kind === "gate" ? `${BOARD_JA[node.board]}の関門`
  : node.kind === "lesson" ? `授業「${node.name}」` : `スキル「${node.name}」`;
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
  return Math.min(STAT_SQUARES[board], n);
}
/** 段 s＝1＋（9×能力のマス÷その盤の能力のマスの数 の切り捨て）。全部で10段（3.1。v3 は1段が約5マス） */
export const stepForCount = (board, n) => Math.min(10, 1 + Math.floor((9 * n) / STAT_SQUARES[board]));
export const stepOf = (board, unlocked) => stepForCount(board, statCount(board, unlocked));
/** 次の段まであと何マスか（10段なら0） */
export function squaresToNextStep(board, unlocked) {
  const n = statCount(board, unlocked), step = stepForCount(board, n);
  if (step >= 10) return 0;
  return Math.ceil((step * STAT_SQUARES[board]) / 9) - n;
}
/** 連続して効くものの割合 t（0〜1） */
export const statRatio = (board, unlocked) => statCount(board, unlocked) / STAT_SQUARES[board];

/** 線でつながった隣が灯っている（か、紋の隣） */
export const connected = (node, unlocked) => node.links.some((id) => id === HUB || unlocked.has(id));

/** 授業の相手に会っているか（スミさんは最初から） */
export function hasMet(who, s = state) {
  if (who === "sumi") return true;
  return !!(s?.met?.[who] || s?.flags?.[`_met_${who}`] || (s?.affinity?.[who] || 0) > 0 || (s?.story?.[who] || 0) > 0);
}
const heartOf = (who, s) => s === state ? affinityLevel(who) : 0;

/**
 * 授業とその小道が盤に出ているか。その人に会った時に現れる（シェイクは正体が明かされてから）。
 * 一度灯したものは出たまま。
 */
export function lessonShown(node, g, s = state) {
  const lesson = node.kind === "lesson" ? node : node.trail ? NODE_BY_ID[node.trail] : null;
  if (!lesson) return true;
  if (g?.nodes?.includes(node.id) || g?.nodes?.includes(lesson.id)) return true;
  if (lesson.revealFlag && !s?.flags?.[lesson.revealFlag]) return false;
  return hasMet(lesson.who, s);
}

/** 授業の錠。開いていれば null、閉じていれば足りないものの内訳 */
export function lessonLock(node, unlocked, s = state) {
  if (node.kind !== "lesson") return null;
  const step = stepOf(node.board, unlocked), heart = node.need ? heartOf(node.who, s) : 0;
  const lack = { step: step < LESSON_MIN_STEP, heart: !!node.need && heart < node.need, met: hasMet(node.who, s) };
  return lack.step || lack.heart ? { ...lack, stepNow: step, heartNow: heart } : null;
}

/**
 * 払い方（1.9。2026-10-30 #1801 の引継ぎ B「色の火種で詰まらない」）。払えなければ null。
 * - 能力のマス・スキルは **万能を先に** 使う。足りない分だけ、その盤の色を使う。ただし、まだ越えていない
 *   関門の数（ctx.reserve）ぶんの色は残す（色を普通のマスに使い切って関門を越えられなくならないように）。
 * - 関門は色つきの火種1つ。その盤の色を先に、無ければほかの色でもよい。受け取りが上限に届いて
 *   もう色が来ない時（ctx.capped）だけ、万能1つでも越えられる（総量は増やさない）。
 */
export function paymentFor(node, hidane, ctx = {}) {
  if (!node.cost) return {};
  if (node.kind === "gate") {
    const color = [node.board, ...BOARD_KEYS.filter((b) => b !== node.board)].find((b) => (hidane[b] || 0) >= node.cost);
    if (color) return { [color]: node.cost };
    return ctx.capped && (hidane.any || 0) >= node.cost ? { any: node.cost } : null;
  }
  const pay = {};
  let left = node.cost;
  const any = Math.min(left, hidane.any || 0);
  if (any) { pay.any = any; left -= any; }
  const colored = BOARD_KEYS.reduce((n, b) => n + (hidane[b] || 0), 0);
  const spare = Math.max(0, colored - (ctx.reserve || 0));
  let free = spare;
  const own = Math.min(left, hidane[node.board] || 0, free);
  if (own) { pay[node.board] = own; left -= own; free -= own; }
  // もう火種が来ない時だけ、ほかの盤の色でも払える（色の行き違いで最後のマスが取れなくならないように）
  if (ctx.capped) for (const b of BOARD_KEYS) {
    if (b === node.board || left <= 0) continue;
    const n = Math.min(left, hidane[b] || 0, free);
    if (n) { pay[b] = n; left -= n; free -= n; }
  }
  return left > 0 ? null : pay;
}
/** 払い方の前提: まだ越えていない関門の数と、受け取りが上限に届いたか */
export function payContext(g, unlocked) {
  const reserve = NODES.filter((n) => n.kind === "gate" && !unlocked.has(n.id)).length;
  return { reserve, capped: (g.earned || 0) >= BOARD_TOTAL };
}
const spend = (hidane, pay) => { for (const [k, n] of Object.entries(pay)) hidane[k] -= n; };

/** そのマスが今の積み方で取れるか（火種は見ない） */
function reachable(node, unlocked, s, g) {
  return node.ring <= ringsOpen(s) && lessonShown(node, g, s) && !lessonLock(node, unlocked, s) && connected(node, unlocked);
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
      if (!reachable(node, unlocked, s, g)) continue;
      const pay = paymentFor(node, hidane, payContext(g, unlocked));
      if (!pay) continue;
      spend(hidane, pay);
      unlocked.add(id);
      kept.push(id);
      pays[id] = pay;
      progress = true;
    }
    rest = rest.filter((id) => !unlocked.has(id));
  }
  return { pending: kept, unlocked, hidane, pays, ctx: payContext(g, unlocked) };
}

/**
 * マスの状態（6.2）: unlocked | pending | available | short | far（まだつながっていない）
 * | locked（章で開く）| sealed（授業の錠）| hidden（まだ会っていない人の授業と小道。盤に出さない）
 */
export function nodeStatus(node, g, view, s = state) {
  if (g.nodes.includes(node.id)) return "unlocked";
  if (!lessonShown(node, g, s)) return "hidden";
  if (view.pending.includes(node.id)) return "pending";
  if (node.ring > ringsOpen(s)) return "locked";
  if (lessonLock(node, view.unlocked, s)) return "sealed";
  if (!connected(node, view.unlocked)) return "far";
  return paymentFor(node, view.hidane, view.ctx) ? "available" : "short";
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

/**
 * 今の盤でできることがあるか（内省に入れる・未使用の印の条件。REPORT R6）。
 * 火種で灯せるマスに加えて、火種いらずの授業が受けられる時も true（2026-10-30 オーナー
 * 「火種が隣接してる授業は章的に開放されてたら無料で受けられる」。#1801 引継ぎ A）。
 */
export function hasUsableHidane(g, s = state) {
  const view = replay(g, [], s);
  return NODES.some((node) => nodeStatus(node, g, view, s) === "available");
}

/** その盤で今取れるマスの数（札の印） */
export function availableCount(board, g, view, s = state) {
  return boardNodes(board).filter((n) => nodeStatus(n, g, view, s) === "available").length;
}
