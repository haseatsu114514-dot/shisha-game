// tonari フロア営業のルール。時間は刻み（tick）で進み、操作は刻みを使わない。
// 本編の状態・給与・在庫から独立した純粋な関数だけを置く（同じ種と同じ操作なら同じ一晩になる）。
// 画面（tonari-floor-view.js）が実時間で floorTick を呼び、伝票を開いている間は呼ばない。
import { PRICE, STAY, MIXES, WISHES, FAMILIES, GUESTS, CALLS, NIGHTS, RANKS, SERVE_LINES, CALL_MISS, CALL_DISTURBED, byTime } from "./tonari-floor-data.js";

export const FLOOR_TABLE_COUNT = 5;
/** 1刻みの実時間（ミリ秒）。画面の時計と検査で同じ値を使う。 */
export const FLOOR_TICK_MS = 500;

// 待てる長さ（刻み）。grace を過ぎると満足が少しずつ下がる。
const T = Object.freeze({
  queue: 56, orderGrace: 18, waitGrace: 44, billGrace: 16, quickSeat: 10,
  prep: 14, topPrep: 10, shelf: 2, call: 28, consult: 30, chill: 28, register: 6, topStay: 26,
});
const MOOD = Object.freeze({
  start: 50, quickSeat: 5, best: 22, near: 8, off: -14, redoBest: 16, redoNear: 6,
  care: 8, careMiss: -8, careLate: -10, top: 6, waive: 6, decay: 0.5, chill: 0.6, unserved: 40,
});
const CHILL = Object.freeze({ full: 100, best: 18, near: 8, care: 10, seat: 4, star3: 8, star2: 4, clean: 2 });
const PLAN_EFFECT = Object.freeze({
  prep: { prep: 9 }, coal: { call: 1.6 }, register: { register: true },
});
const STARS = [[80, 3], [58, 2], [0, 1]];
const starsOf = (mood) => STARS.find(([min]) => mood >= min)[1];
const clampMood = (v) => Math.max(0, Math.min(100, v));

function rng(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** これまでフロアを回した回数と天気から、今日の営業の種類を決める（勤務札の予報と本番で同じ答え）。 */
export function pickNight(level = 0, seed = 0, { rainy = false, daytime = false } = {}) {
  let def;
  if (level <= 0) def = NIGHTS.first;
  else if (level === 1) def = NIGHTS.usual;
  else if (rainy) def = NIGHTS.rain;
  else {
    const pool = level >= 5 ? ["friday", "newcomers", "usual", "full"] : ["friday", "newcomers", "usual"];
    def = NIGHTS[pool[((Number(seed) >>> 0) ^ (level * 7)) % pool.length]];
  }
  return { ...def, title: byTime(def.title, daytime), forecast: byTime(def.forecast, daytime) };
}

/** 合図の出し方。最初の夜は3種だけ、2回目から「聞きたそう」「夢中」、3回目からトップ替えの希望。 */
function callsFor(kind, level) {
  const allowed = level <= 0 ? ["thin", "harsh", "glass"] : level === 1 ? ["thin", "harsh", "glass", "ask", "focus"]
    : ["thin", "harsh", "glass", "ask", "focus", "top"];
  const limit = kind.stay === "short" ? 1 : 2;
  const list = kind.calls.filter((type) => allowed.includes(type)).slice(0, limit);
  if (!list.length) list.push(kind.stay === "short" ? "harsh" : "thin");
  return list;
}

/**
 * 一晩を作る。
 * @param opts.level これまでフロアを回した回数（夜の種類・合図の出し方）
 * @param opts.anchor 「今日の注文」の客 { family, index }。その客が受け取った一台を既存の反応へ渡す
 * @param opts.plan 今夜の段取り（"prep" / "coal" / "register"）
 */
export function createFloorNight({ seed = 0, level = 0, chapter = 1, anchor = null, plan = null, rainy = false, daytime = false, night = null } = {}) {
  const def = night ? NIGHTS[night] || NIGHTS.usual : pickNight(level, seed, { rainy, daytime });
  const random = rng((Number(seed) >>> 0) ^ 0x51ed27);
  const families = FAMILIES[chapter] || FAMILIES[1];
  const pool = WISHES.filter((w) => families.includes(MIXES[w.best].family));
  const anchorAt = Math.min(1, def.cast.length - 1);
  const anchorBest = anchor && MIXES[`${anchor.family}:${anchor.index}`] ? `${anchor.family}:${anchor.index}` : null;
  const guests = {};
  let last = null;
  def.cast.forEach((kindId, i) => {
    const kind = GUESTS[kindId];
    let candidates = i === anchorAt && anchorBest ? pool.filter((w) => w.best === anchorBest) : pool.filter((w) => w.best !== last);
    if (!candidates.length) candidates = pool;
    const wish = candidates[Math.floor(random() * candidates.length)];
    last = wish.best;
    const best = MIXES[wish.best];
    const options = [wish.best, `${best.family}:${1 - best.index}`, wish.off];
    for (let n = options.length - 1; n > 0; n--) {
      const k = Math.floor(random() * (n + 1));
      [options[n], options[k]] = [options[k], options[n]];
    }
    const id = `g${i + 1}`;
    guests[id] = {
      id, kind: kindId, name: byTime(kind.name, daytime), party: kind.party, stay: kind.stay, look: [...kind.look],
      arrive: def.arrive[i], quote: wish.quote, best: wish.best, options, calls: callsFor(kind, level),
      anchor: i === anchorAt && !!anchorBest,
    };
  });
  const order = Object.keys(guests);
  return {
    seed: Number(seed) >>> 0, level, chapter, night: def.id, title: byTime(def.title, daytime), daytime: !!daytime,
    plan: PLAN_EFFECT[plan] ? plan : null,
    hint: level >= 3 ? "sight" : "said",
    t: 0, length: def.length, done: false, closing: null,
    guests, upcoming: order, queue: [],
    tables: Array.from({ length: FLOOR_TABLE_COUNT }, (_, i) => emptyTable(i + 1)),
    bench: null, line: [], shelf: [],
    chill: 0, chillLeft: 0, chillCount: 0,
    sales: 0, results: [],
    counts: { best: 0, near: 0, off: 0, care: 0, careMiss: 0, late: 0, missed: 0, cleaned: 0, top: 0, refill: 0, quick: 0 },
    anchor: anchorBest ? { family: anchor.family, guestId: order[anchorAt], index: null } : null,
    log: [],
  };
}

function emptyTable(id) {
  return { id, phase: "empty", guestId: null, mood: 0, since: 0, mixId: null, accepted: null, served: false,
    stayEnd: 0, call: null, callsLeft: [], delivery: null, refills: 0, top: null, redoUsed: false, line: "" };
}

const tableOf = (s, id) => s.tables[id - 1] || null;
const guestAt = (s, table) => table?.guestId ? s.guests[table.guestId] : null;
const planOf = (s) => PLAN_EFFECT[s.plan] || {};
const note = (s, event) => { s.log.push(event); };
const lineFor = (s, list, salt) => list[(s.seed + salt) % list.length];

function gain(s, amount) {
  if (s.chillLeft > 0) return; // チルタイム中は溜まらない
  const before = s.chill;
  s.chill = Math.min(CHILL.full, s.chill + amount);
  if (before < CHILL.full && s.chill >= CHILL.full) note(s, { type: "chillFull" });
}

function feedBench(s) {
  if (s.bench || !s.line.length) return;
  const job = s.line.shift();
  const base = job.kind === "top" ? T.topPrep : (planOf(s).prep || T.prep);
  s.bench = { ...job, left: base, total: base };
}

function settleBench(s) {
  if (!s.bench || s.bench.left > 0 || s.shelf.length >= T.shelf) return;
  const job = s.bench;
  s.bench = null;
  s.shelf.push({ tableId: job.tableId, mixId: job.mixId, kind: job.kind });
  const table = tableOf(s, job.tableId);
  if (table?.delivery) table.delivery.ready = true;
  note(s, { type: "ready", tableId: job.tableId });
}

function dropJobs(s, tableId) {
  s.line = s.line.filter((job) => job.tableId !== tableId);
  s.shelf = s.shelf.filter((job) => job.tableId !== tableId);
  if (s.bench?.tableId === tableId) s.bench = null;
}

function totalFor(guest, table) {
  const seat = PRICE.seat * guest.party;
  const drink = PRICE.drink * guest.party;
  const shisha = table.accepted ? PRICE.shisha[guest.stay] : 0;
  const refill = PRICE.refill * table.refills;
  const top = table.top === "served" ? PRICE.top : 0;
  return { seat, drink, shisha, refill, top, total: seat + drink + shisha + refill + top };
}

function settle(s, table, by) {
  const guest = guestAt(s, table);
  if (table.accepted == null) table.accepted = false; // 相談に応えられなかった一台は、台代をいただかない
  const bill = totalFor(guest, table);
  const mood = Math.round(clampMood(table.mood));
  const stars = starsOf(mood);
  s.sales += bill.total;
  s.results.push({ guestId: guest.id, tableId: table.id, name: guest.name, party: guest.party, mood, stars, ...bill, by });
  if (s.anchor?.guestId === guest.id && table.accepted && MIXES[table.mixId]?.family === s.anchor.family) {
    s.anchor.index = MIXES[table.mixId].index;
  }
  dropJobs(s, table.id);
  Object.assign(table, { phase: "dirty", since: s.t, call: null, callsLeft: [], delivery: null, line: "" });
  return { total: bill.total, stars, mood };
}

function close(s, why) {
  if (s.done) return;
  for (const entry of s.queue) {
    const guest = s.guests[entry.id];
    s.results.push({ guestId: guest.id, tableId: null, name: guest.name, party: guest.party, mood: 0, stars: 0, total: 0, missed: true });
    s.counts.missed += 1;
  }
  s.queue = [];
  s.upcoming = [];
  for (const table of s.tables) {
    if (!table.guestId || table.phase === "dirty") continue;
    const guest = guestAt(s, table);
    if (table.served) settle(s, table, "sumi");
    else {
      // 提供前の卓はスミさんが引き継ぐ。お代は付けず、評価だけ「途中」で数える。
      s.results.push({ guestId: guest.id, tableId: table.id, name: guest.name, party: guest.party,
        mood: Math.round(Math.min(MOOD.unserved, clampMood(table.mood))), stars: 1, total: 0, unserved: true });
      dropJobs(s, table.id);
      Object.assign(table, { phase: "dirty", since: s.t, call: null, callsLeft: [], delivery: null });
    }
  }
  s.bench = null; s.line = []; s.shelf = [];
  s.chillLeft = 0;
  s.done = true;
  s.closing = why;
  note(s, { type: "close", why });
}

function openCall(s, table, type, length) {
  table.call = { type, since: s.t, until: s.t + Math.round(length * (planOf(s).call || 1)) };
  note(s, { type: "call", tableId: table.id, call: type });
}

function tickOnce(s) {
  if (s.done) return;
  s.t += 1;
  const chill = s.chillLeft > 0;
  while (s.upcoming.length && s.guests[s.upcoming[0]].arrive <= s.t) {
    const id = s.upcoming.shift();
    s.queue.push({ id, since: s.t });
    note(s, { type: "arrive", guestId: id });
  }
  s.queue = s.queue.filter((entry) => {
    if (chill) { entry.since += 1; return true; } // チルタイム中は入口の客も急がない
    if (s.t - entry.since < T.queue) return true;
    const guest = s.guests[entry.id];
    s.results.push({ guestId: guest.id, tableId: null, name: guest.name, party: guest.party, mood: 0, stars: 0, total: 0, missed: true });
    s.counts.missed += 1;
    note(s, { type: "left", guestId: entry.id });
    return false;
  });
  if (s.bench && s.bench.left > 0) s.bench.left -= 1;
  settleBench(s);
  feedBench(s);
  for (const table of s.tables) {
    if (table.phase === "order" || table.phase === "wait" || table.phase === "bill") {
      if (chill) { table.since += 1; continue; }
      if (table.phase === "bill" && planOf(s).register) {
        if (s.t - table.since >= T.register) {
          const paid = settle(s, table, "sumi");
          gain(s, paid.stars === 3 ? CHILL.star3 : paid.stars === 2 ? CHILL.star2 : 0);
          note(s, { type: "bill", tableId: table.id, ...paid, by: "sumi" });
        }
        continue;
      }
      const grace = table.phase === "order" ? T.orderGrace : table.phase === "wait" ? T.waitGrace : T.billGrace;
      if (s.t - table.since > grace) table.mood = clampMood(table.mood - MOOD.decay);
      continue;
    }
    if (table.phase !== "enjoy") continue;
    if (chill) {
      // いい空気の間は、合図も帰り支度も止まる。満足だけがゆっくり上がる。
      table.mood = clampMood(table.mood + MOOD.chill);
      table.stayEnd += 1;
      if (table.call) table.call.until += 1;
      for (const next of table.callsLeft) next.at += 1;
      continue;
    }
    if (table.call) {
      if (s.t >= table.call.until) {
        const type = table.call.type;
        table.call = null;
        if (!CALLS[type]?.quiet && type !== "top") {
          table.mood = clampMood(table.mood + MOOD.careLate);
          s.counts.late += 1;
        }
        note(s, { type: "callLate", tableId: table.id, call: type });
      }
    } else if (!table.delivery && table.callsLeft.length && s.t >= table.callsLeft[0].at) {
      const next = table.callsLeft.shift();
      // トップ替えは、帰りが近い卓・営業の終わり際には頼まれない。
      if (next.type !== "top" || (table.stayEnd - s.t >= 8 && s.length - s.t >= 40)) {
        openCall(s, table, next.type, next.type === "consult" ? T.consult : T.call);
      }
    }
    if (!table.call && !table.delivery && s.t >= table.stayEnd) {
      Object.assign(table, { phase: "bill", since: s.t, line: "お会計、お願いします" });
      note(s, { type: "billReady", tableId: table.id });
    }
  }
  if (s.chillLeft > 0) {
    s.chillLeft -= 1;
    if (!s.chillLeft) note(s, { type: "chillEnd" });
  }
  if (s.t >= s.length) close(s, "time");
  else if (!s.upcoming.length && !s.queue.length && s.tables.every((table) => table.phase === "empty")) close(s, "clear");
}

/** 店内の時間を n 刻み進める。直前の出来事（log）は進めた分だけ入れ直す。 */
export function floorTick(state, n = 1) {
  if (state.done || n <= 0) return state;
  const s = structuredClone(state);
  s.log = [];
  for (let i = 0; i < n && !s.done; i++) tickOnce(s);
  return s;
}

/** 卓を押した時に起きること。画面とボットで同じ判断を使う。 */
export function floorTap(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table || s.done) return "none";
  switch (table.phase) {
    case "empty": return s.queue.length ? "seat" : "none";
    case "order": return "order";
    case "wait": return table.delivery?.ready ? "serve" : "info";
    case "enjoy":
      if (table.delivery?.ready) return "serve";
      if (table.call) return table.call.type === "top" ? "top" : table.call.type === "consult" ? "consult" : "care";
      return "info";
    case "bill": return "bill";
    case "dirty": return "clean";
    default: return "none";
  }
}

function serve(s, table) {
  const guest = guestAt(s, table);
  const job = table.delivery;
  s.shelf = s.shelf.filter((item) => item.tableId !== table.id);
  table.delivery = null;
  settleBench(s);
  feedBench(s);
  if (job.kind === "top") {
    table.top = "served";
    table.mood = clampMood(table.mood + MOOD.top);
    table.stayEnd = Math.max(table.stayEnd, s.t + T.topStay);
    table.line = lineFor(s, SERVE_LINES.top, table.id);
    s.counts.top += 1;
    note(s, { type: "serve", tableId: table.id, grade: "top", line: table.line });
    return;
  }
  const grade = job.mixId === guest.best ? "best" : MIXES[job.mixId].family === MIXES[guest.best].family ? "near" : "off";
  table.mixId = job.mixId;
  const stay = STAY[guest.stay];
  if (job.kind === "redo") {
    table.accepted = grade !== "off";
    table.mood = clampMood(table.mood + (grade === "best" ? MOOD.redoBest : grade === "near" ? MOOD.redoNear : 0));
    table.line = grade === "off" ? lineFor(s, SERVE_LINES.off, table.id) : lineFor(s, SERVE_LINES.redo, table.id);
    table.stayEnd = s.t + Math.round(stay * 0.6);
    scheduleCalls(s, table, guest, 0.6);
    if (grade === "best") gain(s, CHILL.near);
    note(s, { type: "serve", tableId: table.id, grade: grade === "off" ? "off" : "redo", line: table.line });
    return;
  }
  Object.assign(table, { phase: "enjoy", served: true, since: s.t, stayEnd: s.t + stay });
  table.mood = clampMood(table.mood + MOOD[grade]);
  table.line = lineFor(s, SERVE_LINES[grade], table.id + s.t);
  s.counts[grade] += 1;
  if (grade === "off") {
    table.accepted = null;
    table.callsLeft = [{ type: "consult", at: s.t + 3 }];
  } else {
    table.accepted = true;
    gain(s, CHILL[grade]);
    scheduleCalls(s, table, guest, 1);
  }
  note(s, { type: "serve", tableId: table.id, grade, line: table.line });
}

function scheduleCalls(s, table, guest, scale) {
  const stay = STAY[guest.stay] * scale;
  const marks = guest.calls.length > 1 ? [0.26, 0.6] : [0.42];
  table.callsLeft = guest.calls.map((type, i) => ({ type, at: s.t + Math.round(stay * marks[i]) }));
}

/**
 * 操作を一つ確定する。できない操作は同じ state を返す（画面は何も進めない）。
 * action: { type: "seat" | "order" | "serve" | "care" | "top" | "consult" | "bill" | "clean" | "rush" | "chill" | "finish", tableId, mixId, verb, accept }
 */
export function floorAct(state, action) {
  if (!action || state.done) return state;
  const s = structuredClone(state);
  s.log = [];
  const table = action.tableId ? tableOf(s, action.tableId) : null;
  const guest = guestAt(s, table);
  const can = (kind) => table && floorTap(s, table.id) === kind;
  switch (action.type) {
    case "seat": {
      if (!can("seat")) return state;
      const entry = s.queue.shift();
      const quick = s.t - entry.since <= T.quickSeat;
      Object.assign(table, emptyTable(table.id), { phase: "order", guestId: entry.id, since: s.t,
        mood: MOOD.start + (quick ? MOOD.quickSeat : 0), line: s.guests[entry.id].quote });
      if (quick) { s.counts.quick += 1; gain(s, CHILL.seat); }
      note(s, { type: "seat", tableId: table.id, quick });
      break;
    }
    case "order": {
      if (!can("order") || !guest.options.includes(action.mixId)) return state;
      Object.assign(table, { phase: "wait", since: s.t, delivery: { kind: "base", mixId: action.mixId, ready: false }, line: "" });
      s.line.push({ tableId: table.id, mixId: action.mixId, kind: "base" });
      feedBench(s);
      note(s, { type: "order", tableId: table.id });
      break;
    }
    case "rush": {
      const at = s.line.findIndex((job) => job.tableId === action.tableId);
      if (at <= 0) return state;
      s.line.unshift(...s.line.splice(at, 1));
      note(s, { type: "rush", tableId: action.tableId });
      break;
    }
    case "serve":
      if (!can("serve")) return state;
      serve(s, table);
      break;
    case "care": {
      if (!can("care")) return state;
      const call = CALLS[table.call.type];
      const ok = action.verb === call.verb;
      table.call = null;
      if (ok) {
        table.mood = clampMood(table.mood + MOOD.care);
        s.counts.care += 1;
        if (call.refill) { table.refills += 1; s.counts.refill += 1; }
        gain(s, CHILL.care);
        table.line = call.good;
      } else {
        table.mood = clampMood(table.mood + MOOD.careMiss);
        s.counts.careMiss += 1;
        table.line = call.quiet ? CALL_DISTURBED : CALL_MISS;
      }
      note(s, { type: "care", tableId: table.id, ok, line: table.line, refill: ok && !!call.refill });
      break;
    }
    case "top": {
      if (!can("top")) return state;
      table.call = null;
      if (action.accept) {
        const best = MIXES[guest.best];
        const mixId = `${best.family}:${1 - best.index}`;
        table.top = "ordered";
        table.delivery = { kind: "top", mixId, ready: false };
        s.line.push({ tableId: table.id, mixId, kind: "top" });
        feedBench(s);
      }
      table.line = action.accept ? "じゃあ、お願いします" : "また今度にしますね";
      note(s, { type: "top", tableId: table.id, accept: !!action.accept });
      break;
    }
    case "consult": {
      if (!can("consult")) return state;
      const redo = action.mixId && guest.options.includes(action.mixId) && action.mixId !== table.mixId && !table.redoUsed;
      table.call = null;
      if (redo) {
        table.redoUsed = true;
        table.delivery = { kind: "redo", mixId: action.mixId, ready: false };
        s.line.unshift({ tableId: table.id, mixId: action.mixId, kind: "redo" }); // 作り直しは先に作る
        feedBench(s);
        table.line = "すみません、お願いします";
      } else {
        table.accepted = false;
        table.mood = clampMood(table.mood + MOOD.waive);
        table.line = "いえ、こちらこそ。飲み物はおいしいです";
        scheduleCalls(s, table, guest, 0.5);
      }
      note(s, { type: "consult", tableId: table.id, redo: !!redo });
      break;
    }
    case "bill": {
      if (!can("bill")) return state;
      const paid = settle(s, table, "hajime");
      gain(s, paid.stars === 3 ? CHILL.star3 : paid.stars === 2 ? CHILL.star2 : 0);
      note(s, { type: "bill", tableId: table.id, ...paid, by: "hajime" });
      break;
    }
    case "clean":
      if (!can("clean")) return state;
      s.tables[table.id - 1] = emptyTable(table.id);
      s.counts.cleaned += 1;
      gain(s, CHILL.clean);
      note(s, { type: "clean", tableId: table.id });
      break;
    case "chill":
      if (s.chill < CHILL.full || s.chillLeft > 0) return state;
      s.chill = 0;
      s.chillLeft = T.chill;
      s.chillCount += 1;
      note(s, { type: "chillStart" });
      break;
    case "finish":
      close(s, "handoff");
      break;
    default:
      return state;
  }
  if (!s.done && !s.upcoming.length && !s.queue.length && s.tables.every((t) => t.phase === "empty")) close(s, "clear");
  return s;
}

/** 卓の待ち具合（0〜1。1に近いほど急ぎ）。吹き出しの輪と、スミさんの一言の順番に使う。 */
export function floorUrgency(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table) return 0;
  const ratio = (elapsed, span) => Math.max(0, Math.min(1, elapsed / span));
  if (table.call) return ratio(s.t - table.call.since, table.call.until - table.call.since);
  if (table.phase === "order") return ratio(s.t - table.since, T.orderGrace);
  if (table.phase === "wait") return ratio(s.t - table.since, T.waitGrace);
  if (table.phase === "bill") return planOf(s).register ? 0 : ratio(s.t - table.since, T.billGrace);
  return 0;
}
export const floorQueueUrgency = (s, entry) => Math.max(0, Math.min(1, (s.t - entry.since) / T.queue));

/** スミさんの一言（今いちばん先に見るところ）。台詞なので句点で終えない。 */
export function floorAdvice(s) {
  if (s.done) return { kind: "done", tableId: null, text: "お疲れさん" };
  if (s.chillLeft > 0) return { kind: "chill", tableId: null, text: "……いい煙だ。今のうちに、手を進めておけ" };
  const tables = s.tables;
  const enjoying = tables.filter((t) => t.phase === "enjoy").length;
  if (s.chill >= CHILL.full && enjoying >= 2) return { kind: "chillReady", tableId: null, text: "店がいい空気だ。チルタイム、いけるぞ" };
  const urgent = (list) => list.sort((a, b) => floorUrgency(s, b.id) - floorUrgency(s, a.id))[0];
  const empty = tables.find((t) => t.phase === "empty");
  if (s.queue.length && empty) return { kind: "seat", tableId: empty.id, text: "入口でお客さんが待ってる。空いた卓へ通せ" };
  const calling = urgent(tables.filter((t) => t.call));
  if (calling && floorUrgency(s, calling.id) > 0.5) return { kind: "call", tableId: calling.id, text: `${calling.id}卓が呼んでる。様子を見てこい` };
  const ready = tables.find((t) => t.delivery?.ready);
  if (ready) return { kind: "serve", tableId: ready.id, text: `${ready.id}卓の一台、上がったぞ。運んでくれ` };
  if (calling) return { kind: "call", tableId: calling.id, text: `${calling.id}卓が呼んでる。様子を見てこい` };
  const ordering = urgent(tables.filter((t) => t.phase === "order"));
  if (ordering) return { kind: "order", tableId: ordering.id, text: `${ordering.id}卓、注文を聞いてこい` };
  const billing = urgent(tables.filter((t) => t.phase === "bill"));
  if (billing && !planOf(s).register) return { kind: "bill", tableId: billing.id, text: `${billing.id}卓がお会計だ` };
  const dirty = tables.find((t) => t.phase === "dirty");
  if (dirty) return { kind: "clean", tableId: dirty.id, text: s.queue.length ? `${dirty.id}卓を片付ければ、次を通せる` : `${dirty.id}卓、手が空いたら片付けだ` };
  if (s.chill >= CHILL.full) return { kind: "chillReady", tableId: null, text: "チルタイムは、卓が埋まった時に使え" };
  return { kind: "idle", tableId: null, text: enjoying ? "いい調子だ。卓の様子を見ておけ" : "次のお客さんまで、少し間がある" };
}

/** 店内の時計（夜は18:00〜22:00、昼は12:00〜16:00）。 */
export function floorClock(s) {
  const minutes = Math.min(240, Math.floor((s.t / s.length) * 240 / 5) * 5);
  return `${(s.daytime ? 12 : 18) + Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 営業の結果。score＝全組の満足の平均（入れなかった組は0）。 */
export function floorResult(s) {
  const groups = s.results.map((row) => ({ ...row }));
  const expected = Object.keys(s.guests).length;
  const score = groups.length ? Math.round(groups.reduce((sum, row) => sum + row.mood, 0) / Math.max(expected, groups.length)) : 0;
  const lost = groups.filter((row) => row.missed || row.unserved).length;
  // 「大入り」は、来た組を全員迎えて送り出した夜だけ。
  const rank = RANKS.find((r) => score >= r.min && !(r.id === "S" && lost)) || RANKS[RANKS.length - 1];
  return {
    night: s.night, title: s.title, sales: s.sales, score, rank: rank.id, stamp: rank.stamp, bonus: rank.bonus, comment: rank.line,
    groups, served: groups.filter((row) => !row.missed && !row.unserved).length, expected, lost,
    counts: { ...s.counts }, chillCount: s.chillCount, closing: s.closing,
    anchorIndex: s.anchor?.index ?? null, anchorFamily: s.anchor?.family ?? null,
  };
}

export const floorChillFull = CHILL.full;
export const floorChillLength = T.chill;
