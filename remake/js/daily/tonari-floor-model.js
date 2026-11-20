// tonari フロア営業のルール（ワンオペ＆フレーバー調合型）。時間は刻み（tick）で進み、操作は刻みを使わない。
// 本編の状態・給与・在庫から独立した純粋な関数だけを置く（同じ種と同じ操作なら同じ一晩になる）。
// 画面（tonari-floor-view.js）が実時間で floorTick を呼び、調合・ケア・会計を選んでいる間は呼ばない（時間停止）。
//
// 卓の流れ: empty →（来店・自動で着席）→ order（注文待ち。約9秒で怒って帰る）→ prep（作成・立ち上げ。同時に2台まで）
//   →（自動で提供）→ enjoy（滞在。定期の温度調整・接客ケア・追加ドリンク）→ bill（お会計待ち）→ cool（片付け）→ empty
//   滞在が終わる時、居心地の良い客は自分から延長（トップ替え＝おかわり）を頼むことがある。
import {
  PRICE, COST, TRAIT_IDS, FLAVORS, SYNERGIES, NG, ORDER_WORDS, STAY, GUESTS, DEMAND, CALLS, NIGHTS, RANKS, MOODS,
  SERVE_LINES, SEND_LINES, CALL_MISS, PRESET_MAX, STARTER_PRESETS, byTime,
} from "./tonari-floor-data.js";

export const FLOOR_TABLE_COUNT = 5;
/** 1刻みの実時間（ミリ秒）。画面の時計と検査で同じ値を使う。 */
export const FLOOR_TICK_MS = 500;

// 長さはどれも刻み。
const T = Object.freeze({
  order: 18, orderFirst: 30, // 注文を待ってくれる長さ（約9秒。はじめての営業だけ約15秒）。過ぎると怒って帰る
  make: Object.freeze([0, 10, 14, 18]), preset: 2, // 作成・立ち上げ（フレーバーの数ごと）。定番は手が覚えているぶん早い
  slots: 2, // 同時に作れる台数
  call: 22, callCap: 2, callGap: 16, // ケアを待ってくれる長さ・店全体で同時に出る上限・同じ卓の間隔
  coal: 34, coalPerLast: 5, // 定期の温度調整の周期（ミックスの持続性が高いほど長い）
  drink: 44, // 追加ドリンクを判定する間隔
  top: 30, // トップ替え（おかわり）で延びる滞在
  billGrace: 16, cool: 6, // 会計を待ってくれる長さ・会計のあと次の客が入れるまで
  lastCall: 40, // 閉店までこの刻みを切ったら、新しい客は来ない
  fever: 32, feverDrink: 10,
});
// decay＝くつろいでいる間に炭が進んで少しずつ下がる分（持続性の高いミックスほどゆるやか）。feverAfter＝フィーバーが明けた後に残る上乗せ
const MOOD = Object.freeze({ start: 40, base: 24, care: 5, careMiss: -8, careLate: -10, ngHit: -12, must: 10, mustMiss: -15, billDecay: 0.4,
  decay: 0.07, decayPerLast: 0.2, feverAfter: 10 });
const FAM_COEF = Object.freeze({ best: 1.5, good: 1.2, weak: 0.8, none: 0.4 });
const STEP_UP = Object.freeze({ best: "best", good: "best", weak: "good", none: "weak" });
const FEVER = Object.freeze({ level: 100, max: 300, care: 10, best: 14, good: 7, send: 4, targets: Object.freeze([0, 2, 4, FLOOR_TABLE_COUNT]) });
const FANS = Object.freeze({ max: 3, good: 2, ok: 1, low: 0, mad: -2, card: 2, left: -3 });
const DRINK_CHANCE = Object.freeze({ max: 0.7, good: 0.4, ok: 0.1, low: 0, mad: 0 });
const EXTEND_CHANCE = Object.freeze({ max: 0.35, good: 0.1, ok: 0, low: 0, mad: 0 });
const NG_FOR = Object.freeze({ fruit: ["citrus", "sweet", "mint"], fresh: ["mint", "citrus"], sweet: ["heavy", "mint"], deep: ["heavy", "sweet"] });
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
/** 営業中の抽選（追加ドリンク・延長）。state の rolls を進めて、同じ操作なら同じ結果にする。 */
function roll(s) {
  s.rolls += 1;
  return rng((s.seed ^ Math.imul(s.rolls, 0x9e3779b1)) >>> 0)();
}

// ---- 調合 ----
const validMix = (ids) => Array.isArray(ids) && ids.length >= 1 && ids.length <= 3 && new Set(ids).size === ids.length && ids.every((id) => FLAVORS[id]);
/** ミックスの同一性（定番の登録・好評ランキングの集計に使う）。入れた順は区別しない。 */
export const mixKey = (ids) => [...ids].sort().join("+");
export const mixLabel = (ids) => ids.map((id) => FLAVORS[id].label).join("＋");
/** 系統への寄り（0〜1）から、適性の段（◎ best / ○ good / △ weak / × none）。 */
export const aptitude = (weight) => (weight >= 0.8 ? "best" : weight >= 0.5 ? "good" : weight >= 0.25 ? "weak" : "none");

/**
 * 1〜3種のフレーバーを混ぜた一台の中身。traits＝4特性の平均、family＝系統ごとの寄り、synergies＝成立した相性（タグの組）、
 * cost＝原価（フレーバー＋炭）、time＝作成・立ち上げの刻み。
 */
export function mixInfo(ids, { preset = false } = {}) {
  if (!validMix(ids)) return null;
  const list = ids.map((id) => FLAVORS[id]);
  const traits = Object.fromEntries(TRAIT_IDS.map((key, i) => [key, list.reduce((sum, f) => sum + f.traits[i], 0) / list.length]));
  const family = Object.fromEntries(["fruit", "fresh", "sweet", "deep"].map((key) =>
    [key, list.reduce((sum, f) => sum + (f.family === key ? 1 : f.also.includes(key) ? 0.5 : 0), 0) / list.length]));
  const synergies = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const pair = SYNERGIES.find(([x, y]) => (list[i].tags.includes(x) && list[j].tags.includes(y)) || (list[i].tags.includes(y) && list[j].tags.includes(x)));
    if (pair) synergies.push([pair[0], pair[1]]);
  }
  return {
    ids: [...ids], key: mixKey(ids), label: mixLabel(ids), traits, family, synergies,
    tags: [...new Set(list.flatMap((f) => f.tags))],
    cost: list.reduce((sum, f) => sum + f.cost, 0) + COST.coal,
    time: Math.max(4, T.make[list.length] - (preset ? T.preset : 0)),
  };
}

/**
 * 一台を注文に当てた時の評価。mood＝提供した時の満足（0〜100）、grade＝手応え（best / good / ok / off / ng）、
 * family＝系統の適性（おまかせは null）、ratio＝求める吸い心地への到達度、ngHit＝NGのタグを混ぜた、mustOk＝指定フレーバーを入れた。
 */
export function evaluateMix(ids, order, rank = "plain") {
  const info = mixInfo(ids);
  if (!info || !order) return null;
  const ratio = clamp(info.traits[order.trait] / (DEMAND[rank] || DEMAND.plain), 0.5, 1.25);
  let family = order.family ? aptitude(info.family[order.family]) : null;
  if (family && order.type === "pin") family = STEP_UP[family]; // 指定フレーバーを入れるぶん、仕上げの向きは一段甘く見る
  const coef = family ? FAM_COEF[family] : FAM_COEF.good;
  const synergy = 1 + (order.type === "omakase" ? 0.2 : 0.1) * info.synergies.length;
  const ngHit = !!order.ng && info.tags.some((tag) => NG[order.ng].tags.includes(tag));
  const mustOk = !order.must || ids.includes(order.must);
  let mood = MOOD.start + MOOD.base * coef * synergy * ratio * (ngHit ? 0.5 : 1);
  if (ngHit) mood += MOOD.ngHit;
  if (order.must) mood += mustOk ? MOOD.must : MOOD.mustMiss;
  mood = clamp(mood);
  const grade = ngHit ? "ng" : !mustOk ? "off" : mood >= 85 ? "best" : mood >= 65 ? "good" : mood >= 50 ? "ok" : "off";
  return { mood, grade, family, ratio, synergies: info.synergies, ngHit, mustOk, info };
}

/** 満足（居心地）の段。 */
export const floorStage = (mood) => MOODS.find((m) => mood >= m.min) || MOODS[MOODS.length - 1];
/** 顔の記号（smile / flat / frown）。 */
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

// 注文の種類は、回した回数で増える: はじめは「系統＋吸い心地」だけ、2回目から NG つき、3回目から おまかせ・指定フレーバー。
function makeOrder(random, level) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  const types = level <= 0 ? ["normal"] : level === 1 ? ["normal", "normal", "ng"] : ["normal", "ng", "omakase", "pin"];
  const type = pick(types);
  const family = pick(["fruit", "fresh", "sweet", "deep"]);
  const trait = pick(TRAIT_IDS);
  const W = ORDER_WORDS;
  if (type === "omakase") return { type, family: null, trait, ng: null, must: null, quote: W.omakase[trait] };
  if (type === "pin") {
    const must = pick(Object.keys(FLAVORS));
    return { type, family, trait: "taste", ng: null, must, quote: `${FLAVORS[must].label}を入れて、${W.finish[family]}お願いします` };
  }
  if (type === "ng") {
    const ng = pick(NG_FOR[family]);
    return { type, family, trait, ng, must: null, quote: `${W.family[family]}で、${W.trait[trait]}。${NG[ng].said}お願いします` };
  }
  return { type, family, trait, ng: null, must: null, quote: `${W.family[family]}で、${W.trait[trait]}がいいな` };
}

const cleanPresets = (list) => {
  const seen = new Set();
  const out = [];
  for (const ids of Array.isArray(list) ? list : []) {
    if (!validMix(ids) || seen.has(mixKey(ids))) continue;
    seen.add(mixKey(ids));
    out.push([...ids]);
    if (out.length >= PRESET_MAX) break;
  }
  return out;
};
/** 保存してある定番（無ければ、はじめが覚えている4つ）。 */
export const floorPresets = (saved) => { const list = cleanPresets(saved); return list.length ? list : STARTER_PRESETS.map((m) => [...m]); };

/**
 * 一晩を作る。
 * @param opts.level これまでフロアを回した回数（夜の種類・注文の種類・ケアの見せ方）
 * @param opts.presets 店の定番ミックス（保存してあるもの）
 */
export function createFloorNight({ seed = 0, level = 0, chapter = 1, presets = null, rainy = false, daytime = false, night = null } = {}) {
  const def = night ? NIGHTS[night] || NIGHTS.usual : pickNight(level, seed, { rainy, daytime });
  const random = rng((Number(seed) >>> 0) ^ 0x51ed27);
  const guests = {};
  def.cast.forEach((kindId, i) => {
    const kind = GUESTS[kindId];
    const id = `g${i + 1}`;
    guests[id] = {
      id, kind: kindId, name: byTime(kind.name, daytime), party: kind.party, stay: kind.stay, rank: kind.rank, trait: kind.trait,
      drinksMax: kind.drinks, look: [...kind.look], arrive: def.arrive[i], order: makeOrder(random, level),
    };
  });
  return {
    seed: Number(seed) >>> 0, level, chapter, night: def.id, title: byTime(def.title, daytime), daytime: !!daytime,
    hint: level >= 3 ? "sight" : "said",
    t: 0, length: def.length, done: false, closing: null, rolls: 0,
    guests, upcoming: Object.keys(guests), came: 0,
    tables: Array.from({ length: FLOOR_TABLE_COUNT }, (_, i) => emptyTable(i + 1)),
    presets: floorPresets(presets),
    fever: 0, feverLeft: 0, feverLevel: 0, fevers: 0,
    sales: 0, cost: 0, service: 0, fans: 0, results: [], mixes: {},
    counts: { best: 0, good: 0, ok: 0, off: 0, ng: 0, care: 0, careMiss: 0, late: 0, left: 0, drink: 0, extend: 0, card: 0 },
    log: [],
  };
}

function emptyTable(id) {
  return { id, phase: "empty", guestId: null, mood: 0, since: 0, mix: null, preset: false, grade: null, make: null,
    stayEnd: 0, call: null, wants: [], coalAt: 0, nextCall: 0, drinkAt: 0, drinks: 0, extra: 0, extended: false, fever: false, feverBase: 0, wear: 1,
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

/** 卓の客を送り出して、結果に残す。 */
function settle(s, table, { card = false, by = "hajime", left = false } = {}) {
  const guest = guestAt(s, table);
  const mood = Math.round(clamp(table.mood));
  const stage = floorStage(mood);
  let fans = left ? FANS.left : FANS[stage.id];
  if (card) { s.service += COST.card; s.counts.card += 1; if (mood >= 40) fans += FANS.card; }
  s.fans += fans;
  const bill = table.bill || { charge: 0, shisha: 0, drink: 0, top: 0 };
  s.results.push({ guestId: guest.id, tableId: table.id, name: guest.name, party: guest.party, mood: left ? 0 : mood, stage: left ? "mad" : stage.id,
    ...bill, total: billTotal(bill), mix: table.mix ? [...table.mix] : null, grade: table.grade, card, fans, left, by });
  if (table.mix && table.grade && !left) {
    const key = mixKey(table.mix);
    const entry = s.mixes[key] || (s.mixes[key] = { ids: [...table.mix], n: 0, sum: 0 });
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

function openCall(s, table, type) {
  table.call = { type, since: s.t, until: s.t + T.call };
  note(s, { type: "call", tableId: table.id, call: type });
}
const coalPeriod = (table) => T.coal + Math.round(T.coalPerLast * (mixInfo(table.mix)?.traits.last || 0));

/** 作成が終わった一台を出す（自動）。ここで評価が決まる。 */
function serve(s, table) {
  const guest = guestAt(s, table);
  const result = evaluateMix(table.mix, guest.order, guest.rank);
  const stay = STAY[guest.stay];
  Object.assign(table, { phase: "enjoy", since: s.t, make: null, mood: result.mood, grade: result.grade, stayEnd: s.t + stay,
    coalAt: s.t + coalPeriod(table), nextCall: s.t + 10, drinkAt: s.t + T.drink,
    wear: Math.max(0.3, 1 - MOOD.decayPerLast * result.info.traits.last) });
  // 客ごとのケア: 初心者はむせやすい、話し好きは声をかけてほしい、ほかは煙・喉。はじめての営業は温度調整と案内だけ
  const wants = [];
  if (guest.trait === "beginner") wants.push({ type: "cough", at: s.t + Math.round(stay * 0.2) });
  if (s.level > 0) {
    if (guest.trait === "talker") wants.push({ type: "chatty", at: s.t + Math.round(stay * 0.45) });
    else if (guest.trait !== "beginner") wants.push({ type: ["thin", "harsh", "thirsty"][(s.seed + table.id + s.t) % 3], at: s.t + Math.round(stay * 0.5) });
    if (guest.stay === "long") wants.push({ type: "thirsty", at: s.t + Math.round(stay * 0.75) });
  }
  table.wants = wants;
  earn(s, table, "shisha", PRICE.shisha);
  s.cost += result.info.cost;
  s.counts[result.grade] += 1;
  table.line = lineFor(s, SERVE_LINES[result.grade], table.id + s.t);
  if (result.grade === "best") gain(s, FEVER.best); else if (result.grade === "good") gain(s, FEVER.good);
  note(s, { type: "serve", tableId: table.id, grade: result.grade, line: table.line, mood: result.mood });
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
    note(s, { type: "arrive", guestId: id, tableId: table.id });
  }
  // 作成・立ち上げ: 先に受けた注文から、同時に slots 台まで進む
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
        const type = table.call.type;
        table.call = null;
        calling -= 1;
        table.mood = clamp(table.mood + MOOD.careLate);
        table.nextCall = s.t + T.callGap;
        if (type === "coal") table.coalAt = s.t + Math.round(coalPeriod(table) * 0.6); // 放っておくと、味が落ちるのも早い
        s.counts.late += 1;
        note(s, { type: "callLate", tableId: table.id, call: type });
      }
    } else if (calling < T.callCap && s.t >= table.nextCall && s.t < table.stayEnd - 6) {
      // 同時に呼ばれるのは店全体で2卓まで（ワンオペで全部の卓が同時にあふれないようにする）
      const want = table.wants.length && s.t >= table.wants[0].at ? table.wants.shift().type : s.t >= table.coalAt ? "coal" : null;
      if (want) { openCall(s, table, want); calling += 1; }
    }
    // 追加ドリンク: 居心地が良いほど頼みやすい（客ごとの上限まで）
    if (s.t >= table.drinkAt) {
      table.drinkAt = s.t + T.drink;
      if (table.extra < guest.drinksMax && roll(s) < DRINK_CHANCE[floorStage(table.mood).id]) addDrink(s, table, "time");
    }
    if (!table.call && s.t >= table.stayEnd) {
      // 居心地の良い客は、自分から延長（トップ替え＝おかわり）を頼むことがある。一卓に一度まで
      if (!table.extended && s.length - s.t >= T.top + 10 && roll(s) < EXTEND_CHANCE[floorStage(table.mood).id]) {
        table.extended = true;
        table.stayEnd = s.t + T.top;
        table.coalAt = s.t + coalPeriod(table);
        earn(s, table, "top", PRICE.top);
        s.cost += mixInfo(table.mix).cost;
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
    case "order": return "order";
    case "enjoy": return table.call && !(table.fever && s.feverLeft > 0) ? "care" : "info";
    case "bill": return "bill";
    case "prep": return "info";
    default: return "none";
  }
}

/**
 * 操作を一つ確定する。できない操作は同じ state を返す（画面は何も進めない）。
 * action: { type: "order", tableId, mix: [フレーバーID…], preset } / { type: "care", tableId, verb } / { type: "bill", tableId, card }
 *   / { type: "fever" } / { type: "preset", op: "add" | "remove", mix } / { type: "finish" }
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
      if (!can("order") || !validMix(action.mix)) return state;
      const preset = s.presets.some((ids) => mixKey(ids) === mixKey(action.mix));
      const info = mixInfo(action.mix, { preset });
      const active = s.tables.filter((x) => x.phase === "prep").length < T.slots; // 作成枠が空いていれば、すぐ作りはじめる
      Object.assign(table, { phase: "prep", since: s.t, mix: [...action.mix], preset, make: { left: info.time, total: info.time, active },
        bill: { charge: 0, shisha: 0, drink: 0, top: 0 }, drinks: guest.party, line: "" });
      // チャージと、初回のドリンク（ひとり1杯。必ず注文する）
      earn(s, table, "charge", PRICE.charge * guest.party);
      earn(s, table, "drink", PRICE.drink * guest.party);
      note(s, { type: "order", tableId: table.id, mix: [...action.mix], preset });
      break;
    }
    case "care": {
      if (!can("care")) return state;
      const call = CALLS[table.call.type];
      const type = table.call.type;
      const ok = action.verb === call.verb;
      table.call = null;
      table.nextCall = s.t + T.callGap;
      if (type === "coal") table.coalAt = s.t + coalPeriod(table);
      if (ok) {
        table.mood = clamp(table.mood + MOOD.care);
        s.counts.care += 1;
        gain(s, FEVER.care);
        table.line = call.good;
      } else {
        table.mood = clamp(table.mood + MOOD.careMiss);
        s.counts.careMiss += 1;
        table.line = CALL_MISS;
      }
      note(s, { type: "care", tableId: table.id, call: type, ok, line: table.line });
      // 雑談がはずむと、もう一杯頼みたくなる
      if (ok && type === "chatty" && table.extra < guest.drinksMax && roll(s) < 0.6) addDrink(s, table, "chat");
      break;
    }
    case "bill": {
      if (!can("bill")) return state;
      const card = !!action.card;
      const low = table.mood < 40;
      const line = card ? (low ? SEND_LINES.cardLow : SEND_LINES.card) : low ? SEND_LINES.byeLow : lineFor(s, SEND_LINES.bye, table.id);
      const paid = settle(s, table, { card });
      if (paid.mood >= 65) gain(s, FEVER.send);
      note(s, { type: "bill", tableId: table.id, ...paid, card, line });
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
    case "preset": {
      if (!validMix(action.mix)) return state;
      const key = mixKey(action.mix);
      const at = s.presets.findIndex((ids) => mixKey(ids) === key);
      if (action.op === "remove") {
        if (at < 0 || s.presets.length <= 1) return state;
        s.presets.splice(at, 1);
      } else {
        if (at >= 0 || s.presets.length >= PRESET_MAX) return state;
        s.presets.push([...action.mix]);
      }
      note(s, { type: "preset", op: action.op === "remove" ? "remove" : "add", mix: [...action.mix] });
      return s; // 定番の編成は、営業の前後でも出来る（閉店の判定はしない）
    }
    case "finish":
      close(s, "early");
      break;
    default:
      return state;
  }
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
 * 待たせている卓の、残りの猶予（刻み）。注文は怒って帰るまで、ケアは消えるまで、会計は満足が下がり始めるまで。
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
  const guest = guestAt(s, table);
  if (!guest || table.phase !== "enjoy") return 0;
  return clamp((table.stayEnd - s.t) / STAY[guest.stay], 0, 1);
}

/** 炭の残り（1→0）。次の温度調整までの目安。 */
export function floorCoalLeft(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table || table.phase !== "enjoy" || !table.mix) return 0;
  return clamp((table.coalAt - s.t) / coalPeriod(table), 0, 1);
}

/** 作成中の一台（上の帯に出す）。active＝いま進んでいる（同時作成の枠の中）。 */
export function floorMaking(s) {
  return s.tables.filter((x) => x.phase === "prep").sort((a, b) => a.since - b.since || a.id - b.id)
    .map((x, i) => ({ tableId: x.id, label: mixLabel(x.mix), left: x.make.left, total: x.make.total, active: i < T.slots }));
}

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
  if (floorFeverLevel(s) >= 1 && s.tables.filter((x) => x.phase === "enjoy").length >= 2) return { kind: "feverReady", tableId: null, text: "（いい空気だ。フィーバー、いける）" };
  if (s.tables.some((x) => x.phase === "prep")) return { kind: "idle", tableId: null, text: "（いま作ってる。その間に卓を見ておこう）" };
  return { kind: "idle", tableId: null, text: s.tables.some((x) => x.phase === "enjoy") ? "（いい調子だ。卓の様子を見ておこう）" : "（次のお客さんまで、少し間がある）" };
}

/** 店内の時計（夜は18:00〜22:00、昼は12:00〜16:00）。 */
export function floorClock(s) {
  const minutes = Math.min(240, Math.floor((s.t / s.length) * 240 / 5) * 5);
  return `${(s.daytime ? 12 : 18) + Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * 営業の結果。score＝迎えた組の満足の平均（怒って帰った組は0）。
 * profit＝売上 − 原価（フレーバー・炭）− サービス費（ショップカード）。mixes＝好評だったミックス（平均の満足が高い順）。
 */
export function floorResult(s) {
  const groups = s.results.map((row) => ({ ...row }));
  const score = groups.length ? Math.round(groups.reduce((sum, row) => sum + row.mood, 0) / groups.length) : 0;
  const left = groups.filter((row) => row.left).length;
  // 「大入り」は、怒って帰った組がいない夜だけ。
  const rank = RANKS.find((r) => score >= r.min && !(r.id === "S" && (left || !groups.length))) || RANKS[RANKS.length - 1];
  const sum = (key) => groups.reduce((total, row) => total + (row[key] || 0), 0);
  const presetKeys = new Set(s.presets.map(mixKey));
  const mixes = Object.values(s.mixes).map((m) => ({ ids: m.ids, label: mixLabel(m.ids), n: m.n, avg: Math.round(m.sum / m.n), preset: presetKeys.has(mixKey(m.ids)) }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 3);
  return {
    night: s.night, title: s.title, sales: s.sales, cost: s.cost, service: s.service, profit: s.sales - s.cost - s.service,
    items: { charge: sum("charge"), shisha: sum("shisha"), drink: sum("drink"), top: sum("top") },
    fans: s.fans, score, rank: rank.id, stamp: rank.stamp, bonus: rank.bonus, comment: rank.line,
    groups, served: groups.filter((row) => !row.left).length, came: groups.length, left,
    stages: Object.fromEntries(MOODS.map((m) => [m.id, groups.filter((row) => row.stage === m.id).length])),
    counts: { ...s.counts }, fevers: s.fevers, closing: s.closing, mixes, presets: s.presets.map((ids) => [...ids]),
  };
}

export const floorOrderWait = orderWait;
export const floorFeverLength = T.fever;
export const floorSlots = T.slots;
