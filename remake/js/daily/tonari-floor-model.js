// tonari フロア営業のルール（ワンオペ・ミックスを一覧から選ぶ形）。時間は刻み（tick）で進み、操作は刻みを使わない。
// 本編の状態・給与・在庫から独立した純粋な関数だけを置く（同じ種と同じ操作なら同じ一晩になる）。
// 画面（tonari-floor-view.js）が実時間で floorTick を呼び、ミックスやケアを選んでいる間は呼ばない（時間停止）。
//
// 卓の流れ: empty →（来店・自動で着席）→ order（注文待ち。約9秒で怒って帰る）→ prep（仕込み。同時に2台まで）
//   →（自動で提供）→ enjoy（滞在。炭の調整・客からの頼み・追加ドリンク）→ bill（お会計待ち）→ cool（片付け）→ empty
//   客は気分（フルーティ／スイート／リフレッシュ／リラックス）を言うだけ。並んでいるミックス（手札）から、合う一台を選んで出す。
//   炭は、頼まれなくても自分から調整に行く（炭の残りが少なくなったら）。放っておくと、客から頼まれる。
//   滞在が終わる時、居心地の良い客は自分からおかわり（トップ替え）を頼むことがある。
import {
  PRICE, FLAVORS, MIXES, WISHES, HAND_SIZE, VISITORS, STAY, GUESTS, CALLS, NIGHTS, RANKS, MOODS,
  SERVE_LINES, SEND_LINES, CALL_MISS, byTime,
} from "./tonari-floor-data.js";

export const FLOOR_TABLE_COUNT = 5;
/** 1刻みの実時間（ミリ秒）。画面の時計と検査で同じ値を使う。 */
export const FLOOR_TICK_MS = 500;

// 長さはどれも刻み。
const T = Object.freeze({
  order: 18, orderFirst: 30, // 注文を待ってくれる長さ（約9秒。はじめての営業だけ約15秒）。過ぎると怒って帰る
  make: Object.freeze([0, 10, 14, 18]), // 仕込み・立ち上げ（材料の数ごと）
  slots: 2, // 同時に仕込める台数
  call: 22, callCap: 2, callGap: 16, // 頼みを待ってくれる長さ・店全体で同時に出る上限・同じ卓の間隔
  coal: 34, coalPerLast: 5, // 炭の調整の間隔（持続性の高いミックスほど長い）
  drink: 44, // 追加ドリンクを判定する間隔
  top: 30, // おかわり（トップ替え）で延びる滞在
  billGrace: 16, cool: 6, // 会計を待ってくれる長さ・会計のあと次の客が入れるまで
  lastCall: 40, // 閉店までこの刻みを切ったら、新しい客は来ない
  fever: 32, feverDrink: 10,
  shuffle: 8, // シャッフルしてから、次にシャッフルできるまで
});
/** 炭の残りがこの割合を切ったら、調整どき（自分から行ける）。 */
const TEND_FROM = 0.35;
// decay＝くつろいでいる間に炭が進んで少しずつ下がる分（持続性の高いミックスほどゆるやか）。feverAfter＝フィーバーが明けた後に残る上乗せ
const MOOD = Object.freeze({ start: 40, care: 5, careMiss: -8, careLate: -10, tend: 6, tendMiss: -4, billDecay: 0.4,
  decay: 0.07, decayPerLast: 0.2, feverAfter: 10 });
// 気分との合い方ごとの、提供した時の満足。こだわりの客は、◎でないと少し辛い
const RATE_MOOD = Object.freeze({ best: 90, good: 72, weak: 52, none: 30 });
const KEEN_CUT = Object.freeze({ best: 0, good: 6, weak: 6, none: 4 });
const RATE_GRADE = Object.freeze({ best: "best", good: "good", weak: "ok", none: "off" });
const FEVER = Object.freeze({ level: 100, max: 300, care: 10, tend: 8, best: 14, good: 7, send: 4, targets: Object.freeze([0, 2, 4, FLOOR_TABLE_COUNT]) });
const FANS = Object.freeze({ max: 3, good: 2, ok: 1, low: 0, mad: -2, left: -3 });
const DRINK_CHANCE = Object.freeze({ max: 0.7, good: 0.4, ok: 0.1, low: 0, mad: 0 });
const EXTEND_CHANCE = Object.freeze({ max: 0.35, good: 0.1, ok: 0, low: 0, mad: 0 });
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function rng(seed) {
  let a = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 営業中の抽選（追加ドリンク・おかわり・シャッフル）。state の rolls を進めて、同じ操作なら同じ結果にする。 */
function roll(s) {
  s.rolls += 1;
  return rng((s.seed ^ Math.imul(s.rolls, 0x9e3779b1)) >>> 0)();
}

// ---- ミックス ----
/** ミックスの名前（材料の名前をつなげる。決まった名前があればそれ）。 */
export const mixName = (id) => MIXES[id]?.name || (MIXES[id]?.flavors || []).map((f) => FLAVORS[f].label).join("");
/** 系統への寄り（0〜1）から、合い方の段（◎ best / ○ good / △ weak / × none）。 */
export const aptitude = (weight) => (weight >= 0.75 ? "best" : weight >= 0.5 ? "good" : weight >= 0.25 ? "weak" : "none");
/** ミックスと、4つの気分との合い方。材料の系統（also は半分）の平均で決まる。 */
export function mixRatings(id) {
  const list = (MIXES[id]?.flavors || []).map((f) => FLAVORS[f]);
  if (!list.length) return null;
  return Object.fromEntries(WISHES.map((w) =>
    [w.id, aptitude(list.reduce((sum, f) => sum + (f.family === w.id ? 1 : f.also.includes(w.id) ? 0.5 : 0), 0) / list.length)]));
}
const mixLast = (id) => { const list = MIXES[id].flavors.map((f) => FLAVORS[f]); return list.reduce((sum, f) => sum + f.traits[3], 0) / list.length; };
const mixTime = (id) => T.make[MIXES[id].flavors.length];

/**
 * 一台を、客の気分に当てた時の評価。mood＝提供した時の満足（0〜100）、rating＝合い方（best ◎ / good ○ / weak △ / none ×）、
 * grade＝手応え（best / good / ok / off）。
 */
export function evaluateMix(id, order, rank = "plain") {
  const ratings = mixRatings(id);
  if (!ratings || !order) return null;
  const rating = ratings[order.wish];
  return { mood: RATE_MOOD[rating] - (rank === "keen" ? KEEN_CUT[rating] : 0), rating, grade: RATE_GRADE[rating] };
}

/** 満足（居心地）の段。 */
export const floorStage = (mood) => MOODS.find((m) => mood >= m.min) || MOODS[MOODS.length - 1];
/** 顔の印（tonari-floor-art.js の記号の名前）。 */
export const floorFace = (mood) => floorStage(mood).face;

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

// 注文は、気分を一つ言うだけ（「フルーツ系が吸いたいな」）。フレーバーを名指ししない。
function makeOrder(random) {
  const wish = WISHES[Math.floor(random() * WISHES.length)];
  return { wish: wish.id, quote: wish.say[Math.floor(random() * wish.say.length)] };
}
function shuffled(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/**
 * 一晩の営業を作る。
 * @param opts.seed 同じ種なら同じ客・同じ注文・同じミックスの並び
 * @param opts.level これまでフロアを回した回数（夜の種類・ケアの見せ方）
 * @param opts.visitor たまに遊びに来る本編の人物（VISITORS の id。来る条件は呼び出し側が決める）
 */
export function createFloorNight({ seed = 0, level = 0, chapter = 1, rainy = false, daytime = false, night = null, visitor = null } = {}) {
  const def = night ? NIGHTS[night] || NIGHTS.usual : pickNight(level, seed, { rainy, daytime });
  const random = rng((Number(seed) >>> 0) ^ 0x51ed27);
  const guests = {};
  def.cast.forEach((kindId, i) => {
    const kind = GUESTS[kindId];
    const id = `g${i + 1}`;
    guests[id] = {
      id, kind: kindId, name: byTime(kind.name, daytime), party: kind.party, stay: kind.stay, rank: kind.rank, trait: kind.trait,
      drinksMax: kind.drinks, look: [...kind.look], arrive: def.arrive[i], order: makeOrder(random),
    };
  });
  // たまに遊びに来る本編の人物。三組目の客と入れ替わる
  const who = VISITORS[visitor];
  if (who && guests.g3) {
    guests.g3 = { ...guests.g3, kind: `visitor-${who.id}`, charId: who.id, name: who.name, party: 1, stay: who.stay, rank: who.rank, trait: null,
      drinksMax: who.drinks, look: ["bob"], order: { wish: who.wish, quote: who.quote } };
  }
  const deck = shuffled(Object.keys(MIXES), random);
  return {
    seed: Number(seed) >>> 0, level, chapter, night: def.id, title: byTime(def.title, daytime), daytime: !!daytime,
    visitor: who && guests.g3?.charId ? who.id : null,
    hint: level >= 3 ? "sight" : "said",
    t: 0, length: def.length, done: false, closing: null, rolls: 0,
    guests, upcoming: Object.keys(guests), came: 0,
    tables: Array.from({ length: FLOOR_TABLE_COUNT }, (_, i) => emptyTable(i + 1)),
    hand: deck.slice(0, HAND_SIZE), deck: deck.slice(HAND_SIZE), shuffleAt: 0, shuffles: 0,
    fever: 0, feverLeft: 0, feverLevel: 0, fevers: 0,
    sales: 0, fans: 0, results: [], mixes: {},
    counts: { best: 0, good: 0, ok: 0, off: 0, care: 0, careMiss: 0, late: 0, left: 0, drink: 0, extend: 0, tend: 0, tendLate: 0 },
    log: [],
  };
}

function emptyTable(id) {
  return { id, phase: "empty", guestId: null, mood: 0, since: 0, mix: null, grade: null, rating: null, make: null,
    stayEnd: 0, call: null, wants: [], coalAt: 0, coalSpan: 1, nextCall: 0, drinkAt: 0, drinks: 0, extra: 0, extended: false, fever: false, feverBase: 0, wear: 1,
    bill: null, line: "" };
}

const tableOf = (s, id) => s.tables[id - 1] || null;
const guestAt = (s, table) => (table?.guestId ? s.guests[table.guestId] : null);
const note = (s, event) => { s.log.push(event); };
const lineFor = (s, list, salt) => (Array.isArray(list) ? list[(s.seed + salt) % list.length] : list);
const orderWait = (s) => (s.level <= 0 ? T.orderFirst : T.order);
const billTotal = (bill) => (bill ? bill.charge + bill.shisha + bill.drink + bill.top : 0);

function gain(s, amount) {
  const before = Math.floor(s.fever / FEVER.level);
  s.fever = Math.min(FEVER.max, s.fever + amount);
  const after = Math.floor(s.fever / FEVER.level);
  if (after > before) note(s, { type: "feverReady", level: after });
}
function earn(s, table, key, amount) {
  table.bill[key] += amount;
  s.sales += amount;
}
/** 炭を整えた（調整・炭に関わる頼み・おかわり）。次の調整までの間隔を数え直す。 */
function resetCoal(s, table, scale = 1) {
  table.coalSpan = Math.max(8, Math.round((T.coal + T.coalPerLast * mixLast(table.mix)) * scale));
  table.coalAt = s.t + table.coalSpan;
}
const coalLeft = (s, table) => clamp((table.coalAt - s.t) / table.coalSpan, 0, 1);
/** 調整どき（炭の残りが少ない。頼まれる前に自分から行ける）。フィーバーの掛かった卓・頼まれている卓は除く。 */
const tendDue = (s, table) => table.phase === "enjoy" && !table.call && !(table.fever && s.feverLeft > 0) && coalLeft(s, table) <= TEND_FROM;

/** 卓の客を送り出して、結果に残す。 */
function settle(s, table, { by = "hajime", left = false } = {}) {
  const guest = guestAt(s, table);
  const mood = Math.round(clamp(table.mood));
  const stage = floorStage(mood);
  const fans = left ? FANS.left : FANS[stage.id];
  s.fans += fans;
  const bill = table.bill || { charge: 0, shisha: 0, drink: 0, top: 0 };
  s.results.push({ guestId: guest.id, tableId: table.id, name: guest.name, party: guest.party, mood: left ? 0 : mood, stage: left ? "mad" : stage.id,
    ...bill, total: billTotal(bill), mix: table.mix, grade: table.grade, fans, left, by, charId: guest.charId || null });
  if (table.mix && table.grade && !left) {
    const entry = s.mixes[table.mix] || (s.mixes[table.mix] = { id: table.mix, n: 0, sum: 0 });
    entry.n += 1;
    entry.sum += mood;
  }
  Object.assign(table, emptyTable(table.id), { phase: "cool", since: s.t });
  return { mood, stage: stage.id, fans, total: billTotal(bill) };
}

function close(s, why) {
  if (s.done) return;
  s.upcoming = [];
  for (const table of s.tables) {
    if (!table.guestId) continue;
    if (table.phase === "order") { Object.assign(table, emptyTable(table.id)); continue; } // 注文前の客は、閉店で帰る（数えない）
    settle(s, table, { by: "close" });
  }
  s.feverLeft = 0;
  s.done = true;
  s.closing = why;
  note(s, { type: "close", why });
}

function openCall(s, table, type, { coal = false } = {}) {
  table.call = { type, since: s.t, until: s.t + T.call, coal };
  note(s, { type: "call", tableId: table.id, call: type, coal });
}

/** 仕込みが終わった一台を出す（自動）。ここで評価が決まる。 */
function serve(s, table) {
  const guest = guestAt(s, table);
  const result = evaluateMix(table.mix, guest.order, guest.rank);
  const stay = STAY[guest.stay];
  Object.assign(table, { phase: "enjoy", since: s.t, make: null, mood: result.mood, grade: result.grade, rating: result.rating, stayEnd: s.t + stay,
    nextCall: s.t + 10, drinkAt: s.t + T.drink, wear: Math.max(0.3, 1 - MOOD.decayPerLast * mixLast(table.mix)) });
  resetCoal(s, table);
  // 客ごとの頼み: 初めての客はむせやすい、話し好きは声をかけてほしい、ほかは喉。はじめての営業は吸い方の案内だけ
  const wants = [];
  if (guest.trait === "beginner") wants.push({ type: "cough", at: s.t + Math.round(stay * 0.2) });
  if (s.level > 0) {
    if (guest.trait === "talker") wants.push({ type: "chatty", at: s.t + Math.round(stay * 0.45) });
    if (guest.stay === "long" || guest.trait === null) wants.push({ type: "thirsty", at: s.t + Math.round(stay * 0.7) });
  }
  table.wants = wants;
  earn(s, table, "shisha", PRICE.shisha);
  s.counts[result.grade] += 1;
  const own = VISITORS[guest.charId]?.lines; // 本編の人物は、その人の言葉で返す
  table.line = own ? own[result.grade === "best" ? "best" : result.grade === "off" ? "off" : "good"] : lineFor(s, SERVE_LINES[result.grade], table.id + s.t);
  if (result.grade === "best") gain(s, FEVER.best); else if (result.grade === "good") gain(s, FEVER.good);
  note(s, { type: "serve", tableId: table.id, grade: result.grade, rating: result.rating, line: table.line, mood: result.mood });
}

function addDrink(s, table, why) {
  table.extra += 1;
  table.drinks += 1;
  s.counts.drink += 1;
  earn(s, table, "drink", PRICE.drink);
  note(s, { type: "drink", tableId: table.id, why });
}

function tickOnce(s) {
  if (s.done) return;
  s.t += 1;
  const feverOn = s.feverLeft > 0;
  // 来店: 卓が空いていれば、そのまま座る（ワンオペなので案内はしない）。閉店が近づいたら新しい客は来ない
  if (s.length - s.t < T.lastCall) s.upcoming = [];
  while (s.upcoming.length && s.guests[s.upcoming[0]].arrive <= s.t) {
    const table = s.tables.find((x) => x.phase === "empty");
    if (!table) break;
    const id = s.upcoming.shift();
    Object.assign(table, emptyTable(table.id), { phase: "order", guestId: id, since: s.t, mood: MOOD.start, line: s.guests[id].order.quote });
    s.came += 1;
    note(s, { type: "arrive", guestId: id, tableId: table.id, rare: !!s.guests[id].charId, wish: s.guests[id].order.wish, line: s.guests[id].order.quote });
  }
  // 仕込み・立ち上げ: 先に受けた注文から、同時に slots 台まで進む
  const making = s.tables.filter((x) => x.phase === "prep").sort((a, b) => a.since - b.since || a.id - b.id);
  making.forEach((table, i) => {
    table.make.active = i < T.slots;
    if (!table.make.active) return;
    table.make.left -= 1;
    if (table.make.left <= 0) serve(s, table);
  });
  let calling = s.tables.filter((x) => x.call).length;
  for (const table of s.tables) {
    const guest = guestAt(s, table);
    if (table.phase === "order") {
      if (s.t - table.since >= orderWait(s)) {
        // 注文を聞いてもらえなかった客は、怒って帰る
        table.bill = { charge: 0, shisha: 0, drink: 0, top: 0 };
        s.counts.left += 1;
        note(s, { type: "left", tableId: table.id, guestId: guest.id, line: SEND_LINES.mad });
        settle(s, table, { left: true });
      }
      continue;
    }
    if (table.phase === "bill") {
      if (s.t - table.since > T.billGrace) table.mood = clamp(table.mood - MOOD.billDecay);
      continue;
    }
    if (table.phase === "cool") {
      if (s.t - table.since >= T.cool) Object.assign(table, emptyTable(table.id));
      continue;
    }
    if (table.phase !== "enjoy") continue;
    if (table.fever && feverOn) {
      // フィーバー中の卓: 炭も滞在も止まり、居心地は最高のまま。追加ドリンクが続けて入る
      table.mood = 100;
      table.stayEnd += 1; table.coalAt += 1; table.drinkAt += 1; table.nextCall += 1;
      for (const want of table.wants) want.at += 1;
      if (s.feverLeft % T.feverDrink === 0 && table.extra < guest.drinksMax + 2) addDrink(s, table, "fever");
      continue;
    }
    table.mood = clamp(table.mood - MOOD.decay * table.wear);
    if (table.call) {
      if (s.t >= table.call.until) {
        const { coal } = table.call;
        table.call = null;
        calling -= 1;
        table.mood = clamp(table.mood + MOOD.careLate);
        table.nextCall = s.t + T.callGap;
        if (coal) resetCoal(s, table, 0.6); // 放っておくと、味が落ちるのも早い
        s.counts.late += 1;
        note(s, { type: "callLate", tableId: table.id });
      }
    } else if (calling < T.callCap && s.t >= table.nextCall && s.t < table.stayEnd - 6) {
      // 同時に頼まれるのは店全体で2卓まで（ワンオペで全部の卓が同時にあふれないようにする）
      if (s.t >= table.coalAt) {
        // 炭の調整に行かなかった: 客のほうから頼まれる（煙が薄い／熱を下げてほしい）
        table.mood = clamp(table.mood + MOOD.tendMiss);
        s.counts.tendLate += 1;
        openCall(s, table, (s.seed + table.id + s.t) % 2 ? "harsh" : "thin", { coal: true });
        calling += 1;
      } else if (table.wants.length && s.t >= table.wants[0].at) {
        openCall(s, table, table.wants.shift().type);
        calling += 1;
      }
    }
    // 追加ドリンク: 居心地が良いほど頼みやすい（客ごとの上限まで）
    if (s.t >= table.drinkAt) {
      table.drinkAt = s.t + T.drink;
      if (table.extra < guest.drinksMax && roll(s) < DRINK_CHANCE[floorStage(table.mood).id]) addDrink(s, table, "time");
    }
    if (!table.call && s.t >= table.stayEnd) {
      // 居心地の良い客は、自分からおかわり（トップ替え）を頼むことがある。一卓に一度まで
      if (!table.extended && s.length - s.t >= T.top + 10 && roll(s) < EXTEND_CHANCE[floorStage(table.mood).id]) {
        table.extended = true;
        table.stayEnd = s.t + T.top;
        resetCoal(s, table);
        earn(s, table, "top", PRICE.top);
        s.counts.extend += 1;
        table.line = lineFor(s, SEND_LINES.extend, table.id);
        note(s, { type: "extend", tableId: table.id, line: table.line });
        if (table.extra < guest.drinksMax && roll(s) < 0.5) addDrink(s, table, "extend");
      } else {
        Object.assign(table, { phase: "bill", since: s.t, line: "お会計、お願いします" });
        note(s, { type: "billReady", tableId: table.id });
      }
    }
  }
  if (s.feverLeft > 0) {
    s.feverLeft -= 1;
    if (!s.feverLeft) {
      for (const table of s.tables) {
        if (table.fever && table.phase === "enjoy") table.mood = clamp(table.feverBase + MOOD.feverAfter);
        table.fever = false;
      }
      s.feverLevel = 0;
      note(s, { type: "feverEnd" });
    }
  }
  if (s.t >= s.length) close(s, "time");
  else if (!s.upcoming.length && s.came > 0 && s.tables.every((x) => x.phase === "empty" || x.phase === "cool")) close(s, "clear");
}

/** 時間を n 刻み進める（操作はしない）。 */
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
    case "order": return "order";
    case "enjoy": return table.call && !(table.fever && s.feverLeft > 0) ? "care" : tendDue(s, table) ? "tend" : "info";
    case "bill": return "bill";
    case "prep": return "info";
    default: return "none";
  }
}

/**
 * 操作を一つ確定する。できない操作は同じ state を返す（画面は何も進めない）。
 * action: { type: "order", tableId, mix: ミックスID（並んでいる中から） } / { type: "shuffle" } / { type: "tend", tableId }
 *   / { type: "care", tableId, verb } / { type: "bill", tableId } / { type: "fever" } / { type: "finish" }
 */
export function floorAct(state, action) {
  if (!action || state.done) return state;
  const s = structuredClone(state);
  s.log = [];
  const table = action.tableId ? tableOf(s, action.tableId) : null;
  const guest = guestAt(s, table);
  const can = (kind) => table && floorTap(s, table.id) === kind;
  switch (action.type) {
    case "order": {
      const slot = s.hand.indexOf(action.mix);
      if (!can("order") || slot < 0) return state;
      const time = mixTime(action.mix);
      const active = s.tables.filter((x) => x.phase === "prep").length < T.slots; // 仕込みの枠が空いていれば、すぐ作りはじめる
      Object.assign(table, { phase: "prep", since: s.t, mix: action.mix, make: { left: time, total: time, active },
        bill: { charge: 0, shisha: 0, drink: 0, top: 0 }, drinks: guest.party, line: "" });
      // 出したミックスは一覧から抜けて、次の一つが入る（山が尽きたら、出ていない物から組み直す）
      if (!s.deck.length) s.deck = shuffled(Object.keys(MIXES).filter((id) => !s.hand.includes(id)), () => roll(s));
      s.hand[slot] = s.deck.shift();
      // チャージと、初回のドリンク（ひとり1杯。必ず注文する）
      earn(s, table, "charge", PRICE.charge * guest.party);
      earn(s, table, "drink", PRICE.drink * guest.party);
      note(s, { type: "order", tableId: table.id, mix: action.mix, rating: mixRatings(action.mix)[guest.order.wish] });
      break;
    }
    case "shuffle": {
      // 並んでいるミックスを全部入れ替える。続けては出来ない（選んでいる間は時間が止まるので、一度の注文で一回）
      if (s.t < s.shuffleAt) return state;
      const rest = shuffled([...s.deck, ...s.hand], () => roll(s));
      // 同じ並びに戻らないよう、いま出ている物は後ろへ回す
      const fresh = rest.filter((id) => !s.hand.includes(id));
      const next = [...fresh, ...rest.filter((id) => s.hand.includes(id))];
      s.hand = next.slice(0, HAND_SIZE);
      s.deck = next.slice(HAND_SIZE);
      s.shuffleAt = s.t + T.shuffle;
      s.shuffles += 1;
      note(s, { type: "shuffle" });
      return s; // 開店前でも出来る（閉店の判定はしない）
    }
    case "tend": {
      // 頼まれる前に、自分から炭を整える
      if (!can("tend")) return state;
      table.mood = clamp(table.mood + MOOD.tend);
      resetCoal(s, table);
      s.counts.tend += 1;
      gain(s, FEVER.tend);
      note(s, { type: "tend", tableId: table.id });
      break;
    }
    case "care": {
      if (!can("care")) return state;
      const call = CALLS[table.call.type];
      const { type, coal } = table.call;
      const ok = action.verb === call.verb;
      table.call = null;
      table.nextCall = s.t + T.callGap;
      if (coal) resetCoal(s, table, ok ? 1 : 0.6);
      if (ok) {
        table.mood = clamp(table.mood + MOOD.care);
        table.line = call.good;
        s.counts.care += 1;
        gain(s, FEVER.care);
      } else {
        table.mood = clamp(table.mood + MOOD.careMiss);
        table.line = CALL_MISS;
        s.counts.careMiss += 1;
      }
      note(s, { type: "care", tableId: table.id, call: type, ok, line: table.line });
      // 雑談がはずむと、もう一杯頼みたくなる
      if (ok && type === "chatty" && table.extra < guest.drinksMax && roll(s) < 0.6) addDrink(s, table, "chat");
      break;
    }
    case "bill": {
      if (!can("bill")) return state;
      const low = table.mood < 40;
      const line = low ? SEND_LINES.byeLow : VISITORS[guest.charId]?.lines.bye || lineFor(s, SEND_LINES.bye, table.id);
      const paid = settle(s, table);
      if (paid.mood >= 65) gain(s, FEVER.send);
      note(s, { type: "bill", tableId: table.id, ...paid, line });
      break;
    }
    case "fever": {
      const level = Math.min(3, Math.floor(s.fever / FEVER.level));
      if (level < 1 || s.feverLeft > 0) return state;
      // 対象は、くつろいでいる卓のうち滞在の残りが長い順（Lv1＝2卓・Lv2＝4卓・Lv3＝全卓）
      const targets = s.tables.filter((x) => x.phase === "enjoy").sort((a, b) => b.stayEnd - a.stayEnd || a.id - b.id).slice(0, FEVER.targets[level]);
      if (!targets.length) return state;
      for (const x of targets) { x.fever = true; x.feverBase = x.mood; x.mood = 100; x.call = null; }
      s.fever -= level * FEVER.level;
      s.feverLeft = T.fever;
      s.feverLevel = level;
      s.fevers += 1;
      note(s, { type: "feverStart", level, tables: targets.map((x) => x.id) });
      break;
    }
    case "finish":
      close(s, "early");
      break;
    default:
      return state;
  }
  if (!s.done && !s.upcoming.length && s.came > 0 && s.tables.every((x) => x.phase === "empty" || x.phase === "cool")) close(s, "clear");
  return s;
}

/** 卓の待ち具合（0〜1。1に近いほど急ぎ）。 */
export function floorUrgency(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table) return 0;
  const ratio = (elapsed, span) => clamp(elapsed / span, 0, 1);
  if (table.call) return ratio(s.t - table.call.since, table.call.until - table.call.since);
  if (table.phase === "order") return ratio(s.t - table.since, orderWait(s));
  if (table.phase === "bill") return ratio(s.t - table.since, T.billGrace);
  return 0;
}

/**
 * 待たせている卓の、残りの猶予（刻み）。注文は怒って帰るまで、頼みは消えるまで、会計は満足が下がり始めるまで。
 * 待たせていない卓は null。
 */
export function floorWaitLeft(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table || s.done) return null;
  if (table.call) return Math.max(0, table.call.until - s.t);
  if (table.phase === "order") return Math.max(0, orderWait(s) - (s.t - table.since));
  if (table.phase === "bill") return Math.max(0, T.billGrace - (s.t - table.since));
  return null;
}

/** くつろいでいる卓の、滞在の残り（1→0）。 */
export function floorStayLeft(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table || table.phase !== "enjoy") return 0;
  const span = STAY[guestAt(s, table).stay] + (table.extended ? T.top : 0);
  return clamp((table.stayEnd - s.t) / span, 0, 1);
}

/** くつろいでいる卓の、炭の残り（1→0）。0.35 を切ったら調整どき。 */
export function floorCoalLeft(s, tableId) {
  const table = tableOf(s, tableId);
  return table && table.phase === "enjoy" ? coalLeft(s, table) : 0;
}
/** 調整どきの卓か（頼まれる前に、自分から炭を整えに行ける）。 */
export const floorTendDue = (s, tableId) => { const table = tableOf(s, tableId); return !!table && tendDue(s, table); };

/** 仕込み中の一台（先に受けた順）。active＝いま手が動いている（同時に2台まで）。 */
export function floorMaking(s) {
  return s.tables.filter((x) => x.phase === "prep").sort((a, b) => a.since - b.since || a.id - b.id)
    .map((x, i) => ({ tableId: x.id, label: mixName(x.mix), left: x.make.left, total: x.make.total, active: i < T.slots }));
}

/** 並んでいるミックス（一覧）。wish を渡すと、その気分との合い方 rating も付く。 */
export function floorHand(s, wish = null) {
  return s.hand.map((id) => { const ratings = mixRatings(id); return { id, name: mixName(id), flavors: [...MIXES[id].flavors], ratings, rating: wish ? ratings[wish] : null }; });
}
/** 次にシャッフルできるまでの刻み（0 なら今できる）。 */
export const floorShuffleLeft = (s) => Math.max(0, s.shuffleAt - s.t);

/** その卓の、いままでのお代（チャージ・シーシャ・ドリンク・トップ替え）。客がいない卓は null。 */
export function floorBill(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table?.guestId) return null;
  const bill = table.bill || { charge: 0, shisha: 0, drink: 0, top: 0 };
  return { ...bill, total: billTotal(bill) };
}

/** 営業の残り時間（"2:31"。1刻み＝0.5秒）。 */
export function floorTimeLeft(s) {
  const seconds = Math.max(0, Math.ceil((s.length - s.t) * FLOOR_TICK_MS / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** フィーバーの溜まり（いま使える段。0〜3）。 */
export const floorFeverLevel = (s) => Math.min(3, Math.floor(s.fever / FEVER.level));

/** はじめの心の声（今いちばん先に見るところ）。 */
export function floorHint(s) {
  if (s.done) return { kind: "done", tableId: null, text: "（終わった……）" };
  if (s.feverLeft > 0) return { kind: "fever", tableId: null, text: "（店じゅうが、いい空気だ。今のうちに回ろう）" };
  const urgent = (list) => list.sort((a, b) => floorUrgency(s, b.id) - floorUrgency(s, a.id))[0];
  const ordering = urgent(s.tables.filter((x) => x.phase === "order"));
  if (ordering) return { kind: "order", tableId: ordering.id, text: `（${ordering.id}卓、注文を聞かないと）` };
  const calling = urgent(s.tables.filter((x) => x.call));
  if (calling) return { kind: "call", tableId: calling.id, text: `（${calling.id}卓の様子を見にいこう）` };
  const billing = urgent(s.tables.filter((x) => x.phase === "bill"));
  if (billing) return { kind: "bill", tableId: billing.id, text: `（${billing.id}卓のお会計だ）` };
  const tending = s.tables.filter((x) => tendDue(s, x)).sort((a, b) => coalLeft(s, a) - coalLeft(s, b))[0];
  if (tending) return { kind: "tend", tableId: tending.id, text: `（${tending.id}卓、そろそろ炭を見にいこう）` };
  if (floorFeverLevel(s) >= 1 && s.tables.filter((x) => x.phase === "enjoy").length >= 2) return { kind: "feverReady", tableId: null, text: "（いい空気だ。フィーバー、いける）" };
  if (s.tables.some((x) => x.phase === "prep")) return { kind: "idle", tableId: null, text: "（いま仕込んでる。その間に卓を見ておこう）" };
  return { kind: "idle", tableId: null, text: s.tables.some((x) => x.phase === "enjoy") ? "（いい調子だ。卓の様子を見ておこう）" : "（次のお客さんまで、少し間がある）" };
}

/** 店内の時計（夜は18:00〜22:00、昼は12:00〜16:00）。 */
export function floorClock(s) {
  const minutes = Math.min(240, Math.floor((s.t / s.length) * 240 / 5) * 5);
  return `${(s.daytime ? 12 : 18) + Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * 営業の結果。score＝迎えた組の満足の平均（怒って帰った組は0）。
 * 原価・利益は扱わない（満足と売上だけ）。mixes＝好評だったミックス（平均の満足が高い順）。visitor＝遊びに来た本編の人物（いなければ null）。
 */
export function floorResult(s) {
  const groups = s.results.map((row) => ({ ...row }));
  const score = groups.length ? Math.round(groups.reduce((sum, row) => sum + row.mood, 0) / groups.length) : 0;
  const left = groups.filter((row) => row.left).length;
  // 「大入り」は、怒って帰った組がいない夜だけ。
  const rank = RANKS.find((r) => score >= r.min && !(r.id === "S" && (left || !groups.length))) || RANKS[RANKS.length - 1];
  const sum = (key) => groups.reduce((total, row) => total + (row[key] || 0), 0);
  const mixes = Object.values(s.mixes).map((m) => ({ id: m.id, label: mixName(m.id), n: m.n, avg: Math.round(m.sum / m.n) }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 3);
  return {
    night: s.night, title: s.title, sales: s.sales, visitor: s.visitor,
    items: { charge: sum("charge"), shisha: sum("shisha"), drink: sum("drink"), top: sum("top") },
    fans: s.fans, score, rank: rank.id, stamp: rank.stamp, bonus: rank.bonus, comment: rank.line,
    groups, served: groups.filter((row) => !row.left).length, came: groups.length, left,
    stages: Object.fromEntries(MOODS.map((m) => [m.id, groups.filter((row) => row.stage === m.id).length])),
    counts: { ...s.counts }, fevers: s.fevers, shuffles: s.shuffles, closing: s.closing, mixes,
  };
}

export const floorOrderWait = orderWait;
export const floorFeverLength = T.fever;
export const floorSlots = T.slots;
