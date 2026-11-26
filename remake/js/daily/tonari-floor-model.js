// tonari フロア営業のルール（ワンオペ・ミックスを一覧から選ぶ形）。時間は刻み（tick）で進み、操作は刻みを使わない。
// 本編の状態・在庫から独立した純粋な関数だけを置く（同じ種と同じ操作なら同じ一晩になる）。
// 画面（tonari-floor-view.js）が実時間で floorTick を呼び、ミックスやケアを選んでいる間は呼ばない（時間停止）。
//
// 卓の流れ: empty →（来店・自動で着席）→ order（注文待ち。約9秒で怒って帰る）→ prep（仕込み。同時に2台まで）
//   →（自動で提供）→ enjoy（滞在。炭の調整・客からの頼み・追加ドリンク）→ bill（お会計待ち）→ cool（片付け）→ empty
//   客は気分（フルーティ／スイート／刺激系／リラックス）を言うだけ。並んでいるミックス（手札）から、合う一台を選んで出す。
//   炭は、頼まれなくても自分から調整に行く（炭の残りが少なくなったら）。放っておくと、汎用の客から頼まれる。
//   滞在が終わる時、居心地の良い客は自分からおかわり（トップ替え）を頼むことがある。おかわりも、客が吸いたい気分を言い、並んだミックスから選んで出す。
import {
  FLAVORS, AROMATIC_SPICES, MIXES, WISHES, STAY, GUESTS, CALLS, MOODS, mixIdsFor,
  CALL_MISS, byTime,
} from "./tonari-floor-data.js";
import { floorVenue, floorVenueShiftPay, resolveVenueVisitor, TONARI_RULES } from "./floor-venues.js";

export const FLOOR_TABLE_COUNT = TONARI_RULES.tableCount;
/** 1刻みの実時間（ミリ秒）。画面の時計と検査で同じ値を使う。 */
export const FLOOR_TICK_MS = 500;

// 既定（tonari）の長さ・係数。実際の営業中は state の店舗定義（FLOOR_VENUES[s.venue].rules）を読む。
const T = TONARI_RULES;
const RATE_GRADE = Object.freeze({ best: "best", good: "good", none: "off" });
const FEVER = Object.freeze({ cost: 100, max: 300, care: 10, tend: 8, best: 14, good: 7, send: 4,
  // 流れ（◎を続けて出した数）: 2連続めから、◎で溜まるゲージが＋3ずつ増える（＋9まで）。◎以外を出すか、客が帰ると切れる
  streakStep: 3, streakCap: 3 });
const FANS = Object.freeze({ max: 3, good: 2, ok: 1, low: 0, mad: -2, left: -3 });
const DRINK_CHANCE = Object.freeze({ max: 0.7, good: 0.4, ok: 0.1, low: 0, mad: 0 });
const EXTEND_CHANCE = Object.freeze({ max: 0.35, good: 0.1, ok: 0, low: 0, mad: 0 });
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const venueOf = (s) => (s?.venueOverride ? floorVenue(s.venueOverride) : floorVenue(s?.venue));
const rulesOf = (s) => venueOf(s).rules;

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
/** ミックスの名前を、折ってよい切れ目で分けたもの（決まった名前は「｜」で分ける。無ければ材料ごと）。 */
export const mixNameParts = (id) => {
  const mix = MIXES[id];
  if (!mix) return [];
  if (mix.name) return mix.name.split("｜");
  // 1種の物はミックスではない。名前は「本編のフレーバー名＋単」（ダブルアップル単・コットンキャンディ単。TFL47）
  if (mix.flavors.length === 1) { const parts = [...FLAVORS[mix.flavors[0]].fullParts]; parts[parts.length - 1] += "単"; return parts; }
  return mix.flavors.map((f) => FLAVORS[f].label);
};
/** フレーバー1種の物か（ミックスではない。名前がそのまま中身なので、（）は付けない）。 */
export const mixIsSingle = (id) => (MIXES[id]?.flavors.length || 0) === 1;
/** ミックスの名前（材料の名前をつなげる。決まった名前があればそれ）。 */
export const mixName = (id) => mixNameParts(id).join("");
/** ミックスに使ったフレーバーの名前（本編の名前。グラム数は出さない）。 */
export const mixFlavorNames = (id) => (MIXES[id]?.flavors || []).map((f) => FLAVORS[f].full);
/** 同じ名前を、狭い札で折ってよい切れ目ごとに分けた形（フレーバーごとに、語の配列）。 */
export const mixFlavorParts = (id) => (MIXES[id]?.flavors || []).map((f) => [...FLAVORS[f].fullParts]);
/** 名前のあとに、使ったフレーバーを（）で添えた書き方。例: カフェモカ（コーヒー・チョコレート）。1種の物は名前だけ（ダブルアップル単）。 */
export const mixFullName = (id) => (mixIsSingle(id) ? mixName(id) : `${mixName(id)}（${mixFlavorNames(id).join("・")}）`);
/**
 * その注文との合い方（best ◎ / good ○ / none ×）。ふつうの客は気分だけ（メインの属性＝◎・サブの属性＝○）。
 * 本編の人物の注文（pref つき・TFL66）は、好きなフレーバー（pref.has）の入った一台が◎、気分がメインの一台が○、ほかは×。
 */
export function rateMix(id, order) {
  const mix = MIXES[id];
  if (!mix || !order) return null;
  if (order.pref) return mix.flavors.some((f) => order.pref.has.includes(f)) ? "best" : mix.main === order.wish ? "good" : "none";
  return mixRatings(id)[order.wish];
}
/** ミックスと、4つの気分との合い方。メインの属性＝◎（best）、サブの属性＝○（good）、ほか＝×（none）。 */
export function mixRatings(id) {
  const mix = MIXES[id];
  if (!mix) return null;
  return Object.fromEntries(WISHES.map((w) => [w.id, w.id === mix.main ? "best" : w.id === mix.sub ? "good" : "none"]));
}
// 持続性（1〜3。炭の調整の間隔と、くつろいでいる間の下がり方に効く）: 清涼系は軽く、茶葉・スパイス・花は長い
const LAST = Object.freeze({ fresh: 1, fruit: 2, sweet: 2, deep: 3 });
const mixLast = (id) => {
  const list = MIXES[id].flavors.map((f) => FLAVORS[f]);
  return list.reduce((sum, f) => sum + (AROMATIC_SPICES.includes(f.id) ? LAST.deep : LAST[f.family]), 0) / list.length;
};
const mixTime = (id, r = TONARI_RULES) => r.make[MIXES[id].flavors.length];

/**
 * 一台を、客の気分に当てた時の評価。mood＝提供した時の満足（0〜100）、rating＝合い方（best ◎ / good ○ / none ×）、
 * grade＝手応え（best / good / off）。第3引数は "plain"/"keen" または客オブジェクト（wantRich 対応）。
 */
export function evaluateMix(id, order, rankOrGuest = "plain", rules = null) {
  const rating = rateMix(id, order);
  if (!rating) return null;
  const r = rules || TONARI_RULES;
  const rank = typeof rankOrGuest === "string" ? rankOrGuest : rankOrGuest?.rank || "plain";
  const wantRich = typeof rankOrGuest === "object" && !!rankOrGuest?.wantRich;
  const flavorCount = MIXES[id].flavors.length;
  // 3種のミックスは、仕込みが長い（約9秒。2種は7秒、1種は5秒）ぶん、合った時（◎・○）の満足が少し高い（TFL47）。
  // ドバイのVIP・語らい組（wantRich）は3種が合うとさらに加点、単品だと減点。
  const rich = flavorCount >= 3 && rating !== "none" ? r.richMood + (wantRich ? r.richWantBonus : 0) : 0;
  const thinCut = wantRich && flavorCount === 1 ? r.richSingleCut : 0;
  return { mood: clamp(r.rateMood[rating] + rich - thinCut - (rank === "keen" ? r.keenCut[rating] : 0)), rating, grade: RATE_GRADE[rating] };
}

/** 満足（居心地）の段。 */
export const floorStage = (mood) => MOODS.find((m) => mood >= m.min) || MOODS[MOODS.length - 1];
/** 顔の印（tonari-floor-art.js の記号の名前）。 */
export const floorFace = (mood) => floorStage(mood).face;

/** これまでフロアを回した回数と天気から、今日の営業の種類を決める（勤務札の予報と本番で同じ答え）。 */
export function pickNight(level = 0, seed = 0, { rainy = false, daytime = false, venue = "tonari" } = {}) {
  const v = floorVenue(venue);
  const nights = v.nights;
  const np = v.nightPool;
  let def;
  if (level <= 0) def = nights[np.first];
  else if (level === 1) def = nights[np.second];
  else if (rainy && np.rain && nights[np.rain]) def = nights[np.rain];
  else {
    const pool = level >= np.lateAt ? np.late : np.early;
    const draw = (Number(seed) ^ (level * 7)) >>> 0;
    def = nights[pool[draw % pool.length]];
  }
  return { ...def, title: byTime(def.title, daytime), forecast: byTime(def.forecast, daytime) };
}

// 注文は、ふつうの客は気分を一つ言うだけ（「フルーツ系が吸いたいな」）。
// 店舗固有のこだわり常連（prefPool を持つ客）だけは、好きな系統を名指しする。
function makeOrder(random, guest = null) {
  if (guest?.prefPool?.length) {
    const pick = guest.prefPool[Math.floor(random() * guest.prefPool.length)];
    return { wish: pick.wish, quote: pick.quote, pref: { label: pick.label, has: [...pick.has] } };
  }
  const wish = WISHES[Math.floor(random() * WISHES.length)];
  return { wish: wish.id, quote: wish.say[Math.floor(random() * wish.say.length)] };
}
function shuffled(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** 本編の人物の注文（その人の好きなフレーバーを名指しする。TFL66）。保存できる形（関数を持たない）。 */
const personalOrder = (o) => ({ wish: o.wish, quote: o.quote, pref: { label: o.label, has: [...o.has] } });

/**
 * 一晩の営業を作る。
 * @param opts.venue 店舗ID（"tonari" / "mukai" / "dubai"）またはカスタム店舗オブジェクト
 * @param opts.seed 同じ種なら同じ客・同じ注文・同じミックスの並び
 * @param opts.level これまでフロアを回した回数（夜の種類・ケアの見せ方）
 * @param opts.visitor たまに遊びに来る本編の人物（店舗の visitors / companionVisitors の id。来る条件は呼び出し側が決める）
 * @param opts.dusk 昼から夜まで通しの店番（2026-11-25 オーナー「昼から始めて2コマ使う」・TFL62）。営業の半ばで日が暮れ、
 *   そこから来る客は夜の呼び名になる（画面は店内の絵を夜へ替える）。daytime と一緒に使う
 */
export function createFloorNight({ venue = "tonari", seed = 0, level = 0, chapter = 1, rainy = false, daytime = false, night = null, visitor = null, visitorName = null, dusk = false, floorPerks = null } = {}) {
  const v = floorVenue(venue);
  const r = v.rules;
  const def = night ? v.nights[night] || v.nights.usual : pickNight(level, seed, { rainy, daytime, venue: v });
  const random = rng((Number(seed) >>> 0) ^ 0x51ed27);
  const duskAt = dusk && daytime ? Math.round(def.length / 2) : null; // 日が暮れる刻み
  // 客は一人ずつ（一卓に一人。TFL51）。二人連れは同じ刻みに来る二人の客になり、空いている卓へ一人ずつ座る。
  // art＝その人の絵のID（一人で来る客は種類ID、二人連れは「種類ID-a」「種類ID-b」）、pair＝連れの客のID
  const guests = {};
  let n = 0;
  def.cast.forEach((kindId, i) => {
    const kind = v.guests[kindId];
    const ids = Array.from({ length: kind.party }, () => `g${++n}`);
    ids.forEach((id, j) => {
      guests[id] = {
        id, kind: kindId, art: kind.party > 1 ? `${kindId}-${"ab"[j]}` : kindId, pair: kind.party > 1 ? ids[1 - j] : null,
        name: byTime(kind.name, daytime && !(duskAt !== null && def.arrive[i] >= duskAt)), party: 1, stay: kind.stay, rank: kind.rank, trait: kind.trait,
        drinksMax: kind.drinks, look: [kind.look[j] || kind.look[0]], arrive: def.arrive[i], order: makeOrder(random, kind),
        ...(kind.prefPool ? { prefPool: kind.prefPool.map((p) => ({ ...p, has: [...p.has] })) } : {}),
        ...(kind.wantRich ? { wantRich: true } : {}),
        ...(kind.callsPerStay ? { callsPerStay: kind.callsPerStay } : {}),
        ...(kind.fastThirsty ? { fastThirsty: true } : {}),
      };
    });
  });
  // たまに遊びに来る本編の人物。三人目の客と入れ替わる（二人連れの一人なら、連れは一人で来る）
  const who = resolveVenueVisitor(v, visitor);
  const visitorAllowed = !!who && (v.visitors?.[visitor] ? who.chapters.includes(chapter) : !!v.companionVisitors?.[visitor]);
  if (visitorAllowed && guests.g3) {
    if (guests.g3.pair) guests[guests.g3.pair].pair = null;
    guests.g3 = { ...guests.g3, kind: `visitor-${who.id}`, art: null, pair: null, charId: who.id, name: visitorName || who.name, party: 1, stay: who.stay, rank: who.rank, trait: null,
      drinksMax: who.drinks, look: ["bob"], order: personalOrder(who.order) };
    delete guests.g3.prefPool;
    delete guests.g3.wantRich;
    delete guests.g3.callsPerStay;
    delete guests.g3.fastThirsty;
  }
  const deck = shuffled(mixIdsFor(chapter), random); // その章の店で出せるミックス
  const handSize = r.handSize || 5;
  return {
    venue: v.id,
    ...(typeof venue === "object" && venue ? { venueOverride: structuredClone(venue) } : {}),
    seed: Number(seed) >>> 0, level, chapter, night: def.id, title: byTime(def.title, daytime), daytime: !!daytime, dusk: duskAt,
    floorPerks: { floorMatch: floorPerks?.floorMatch || 0, floorTop: floorPerks?.floorTop || 0 },
    visitor: visitorAllowed && guests.g3?.charId ? who.id : null,
    hint: level >= r.sightAt ? "sight" : "said",
    t: 0, length: def.length, done: false, closing: null, rolls: 0,
    guests, upcoming: Object.keys(guests), came: 0,
    tables: Array.from({ length: r.tableCount }, (_, i) => emptyTable(i + 1)),
    hand: deck.slice(0, handSize), deck: deck.slice(handSize), shuffleAt: 0, shuffles: 0, stock: null,
    fever: 0, feverLeft: 0, feverResume: 0, fevers: 0, streak: 0, bestStreak: 0,
    sales: 0, fans: 0, results: [], mixes: {},
    counts: { best: 0, good: 0, off: 0, care: 0, careMiss: 0, late: 0, left: 0, drink: 0, extend: 0, tend: 0, tendLate: 0 },
    log: [],
  };
}

function emptyTable(id) {
  return { id, phase: "empty", guestId: null, mood: 0, since: 0, mix: null, grade: null, rating: null, make: null,
    stayEnd: 0, call: null, wants: [], coalAt: 0, coalSpan: 1, nextCall: 0, drinkAt: 0, drinks: 0, extra: 0, extended: false, refill: false,
    fever: false, feverBase: 0, feverTicks: 0, wear: 1,
    bill: null, line: "" };
}

const tableOf = (s, id) => s.tables[id - 1] || null;
const guestAt = (s, table) => (table?.guestId ? s.guests[table.guestId] : null);
const note = (s, event) => { s.log.push(event); };
const lineFor = (s, list, salt) => (Array.isArray(list) ? list[(s.seed + salt) % list.length] : list);
/** 営業中は出した順にずらして、同じ種類の言葉が続けて重ならないようにする。 */
function nextCallLineIndex(s, key, length) {
  const turns = (s.callLineTurns ??= {});
  const turn = turns[key] ?? 0;
  turns[key] = turn + 1;
  return (s.seed + turn) % length;
}
/** 本編の人物の言葉（TFL65）。ふつうの客は undefined（呼び出し側の共通の言葉を使う）。 */
const ownLine = (s, guest, key) => resolveVenueVisitor(venueOf(s), guest?.charId)?.lines[key];
/**
 * 本編の人物や名指し注文に合う一台が並んでいなければ、山のいちばん上に一つ取り置く（次に一覧へ入る一台・シャッフルした時の最初の一台）。
 * 名指しの注文でも、シャッフル一回で応えられる。ふつうの客には何もしない。
 */
function reserveFor(s, order) {
  if (!order?.pref || s.hand.some((id) => rateMix(id, order) === "best")) return;
  const pool = [...s.deck, ...mixIdsFor(s.chapter).filter((id) => !s.hand.includes(id) && !s.deck.includes(id))];
  const pick = pool.find((id) => rateMix(id, order) === "best");
  if (!pick) return;
  s.deck = [pick, ...s.deck.filter((id) => id !== pick)];
  s.stock = pick;
}
const stockDrawn = (s) => { if (s.stock && s.hand.includes(s.stock)) s.stock = null; };
/** 右の一覧から提供する卓。選択した注文待ちの卓を優先し、それ以外は最も長く待つ卓。 */
export function floorOrderTarget(s, selectedId) {
  const waiting = s.tables.filter((t) => t.phase === "order");
  return waiting.find((t) => t.id === selectedId) || waiting.sort((a, b) => a.since - b.since)[0] || null;
}

function shuffleHand(s, selectedId) {
  const r = rulesOf(s);
  const handSize = r.handSize || 5;
  // 提供済みの一台も再抽選の対象。チュートリアルだけは手順に合わせた山を使う。
  const deck = s.tutorial ? [...s.deck, ...s.hand] : shuffled(mixIdsFor(s.chapter), () => roll(s));
  const fresh = deck.filter((id) => !s.hand.includes(id));
  const target = guestAt(s, floorOrderTarget(s, selectedId))?.order;
  let hand = fresh.slice(0, handSize);
  if (target && !s.tutorial) {
    const reserved = [];
    // 別の卓を選んでいても、注文待ちのレア客の好物は一枠確保する。
    const rareTable = s.tables.find((t) => t.phase === "order" && guestAt(s, t).charId && guestAt(s, t).order.pref);
    if (rareTable) {
      const rareOrder = guestAt(s, rareTable).order;
      const favorite = (id) => rateMix(id, rareOrder) === "best";
      const pick = [s.stock, ...fresh, ...s.hand].find(favorite);
      if (pick) reserved.push(pick);
    }
    let candidates = fresh;
    if (target.pref) {
      const favorite = (id) => rateMix(id, target) === "best";
      if (!reserved.some(favorite)) {
        const pick = [s.stock, ...fresh, ...s.hand].find(favorite);
        if (pick) reserved.push(pick);
      }
    } else {
      const best = (id) => MIXES[id].main === target.wish;
      if (roll(s) * 100 < r.shuffleMatchPercent + s.floorPerks.floorMatch) {
        const pick = fresh.find(best);
        if (pick && !reserved.some(best)) reserved.push(pick);
      } else {
        candidates = fresh.filter((id) => !best(id));
      }
    }
    hand = [...new Set([...reserved, ...candidates])].slice(0, handSize);
    hand = shuffled(hand, () => roll(s));
  }
  s.hand = hand;
  s.deck = deck.filter((id) => !hand.includes(id));
  s.stock = null;
}

const orderWait = (s) => { const r = rulesOf(s); return s.level <= 0 ? r.orderFirst : r.order; }; // チュートリアルでは、待ち時間そのものが進まない（tickOnce）
const billTotal = (bill) => (bill ? bill.charge + bill.shisha + bill.drink + bill.top : 0);

function gain(s, amount) {
  const wasReady = floorFeverReady(s);
  s.fever = Math.min(FEVER.max, s.fever + amount);
  if (!s.feverLeft && !wasReady && floorFeverReady(s)) note(s, { type: "feverReady" });
}
function earn(s, table, key, amount) {
  table.bill[key] += amount;
  s.sales += amount;
}
/** 炭を整えた（調整・炭に関わる頼み・おかわり）。次の調整までの間隔を数え直す。 */
function resetCoal(s, table, scale = 1) {
  const r = rulesOf(s);
  table.coalSpan = Math.max(8, Math.round((r.coal + r.coalPerLast * mixLast(table.mix)) * scale));
  table.coalAt = s.t + table.coalSpan;
}
const coalLeft = (s, table) => clamp((table.coalAt - s.t) / table.coalSpan, 0, 1);
/** 調整どき（炭の残りが少ない。頼まれる前に自分から行ける）。フィーバーの掛かった卓・頼まれている卓は除く。 */
const tendDue = (s, table) => table.phase === "enjoy" && !table.call && !(table.fever && s.feverLeft > 0) && coalLeft(s, table) <= rulesOf(s).tendFrom;

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

// 使った刻みの分だけ、終わった後の居心地に上乗せする。途中で切り上げたら、止めていた頼みも再開する。
function endFever(s, { resume = false } = {}) {
  const r = rulesOf(s);
  const used = (s.feverResume || r.fever) - s.feverLeft;
  for (const table of s.tables) {
    if (!table.fever) continue;
    table.mood = clamp(table.feverBase + r.mood.feverAfter * used / r.fever);
    if (used === r.fever) table.call = null;
    table.fever = false;
  }
  s.feverResume = resume ? s.feverLeft : 0;
  s.feverLeft = 0;
  if (!used) s.fevers -= 1;
  note(s, { type: "feverEnd" });
}

function close(s, why) {
  if (s.done) return;
  if (s.feverLeft) endFever(s);
  s.feverResume = 0;
  s.upcoming = [];
  for (const table of s.tables) {
    if (!table.guestId) continue;
    if (table.phase === "order" && !table.refill) { Object.assign(table, emptyTable(table.id)); continue; } // 注文前の客は、閉店で帰る（数えない）
    settle(s, table, { by: "close" });
  }
  s.done = true;
  s.closing = why;
  note(s, { type: "close", why });
}

function openCall(s, table, type, { coal = false } = {}) {
  const r = rulesOf(s);
  const variant = nextCallLineIndex(s, type, CALLS[type].lines.length);
  table.call = { type, since: s.t, until: s.t + r.call, coal, variant };
  note(s, { type: "call", tableId: table.id, call: type, coal });
}

/** 仕込みが終わった一台を出す（自動）。ここで評価が決まる。 */
function serve(s, table) {
  const v = venueOf(s);
  const r = v.rules;
  const guest = guestAt(s, table);
  const result = evaluateMix(table.mix, guest.order, guest, r);
  const refill = table.refill;
  const stay = refill ? r.top : STAY[guest.stay];
  // 注文を待たせた分だけ、最初の満足が下がる
  const grace = orderWait(s) / 3;
  const late = Math.round(r.mood.wait * clamp((table.waited - grace) / (orderWait(s) - grace), 0, 1));
  result.mood -= late;
  Object.assign(table, { phase: "enjoy", refill: false, since: s.t, make: null, mood: result.mood, grade: result.grade, rating: result.rating, stayEnd: s.t + stay,
    nextCall: s.t + 10, drinkAt: s.t + r.drink, wear: Math.max(0.3, 1 - r.mood.decayPerLast * mixLast(table.mix)) });
  resetCoal(s, table);
  // 客ごとの頼み: 初めての客はむせやすい、話し好きは声をかけてほしい、ほかは喉。はじめての営業は吸い方の案内だけ
  const wants = [];
  if (guest.trait === "beginner") wants.push({ type: "cough", at: s.t + Math.round(stay * 0.2) });
  if (s.level > 0) {
    if (guest.trait === "talker") wants.push({ type: "chatty", at: s.t + Math.round(stay * 0.45) });
    if (guest.fastThirsty) wants.push({ type: "thirsty", at: s.t + Math.round(stay * 0.35) });
    else if (guest.stay === "long" || guest.trait === null) wants.push({ type: "thirsty", at: s.t + Math.round(stay * 0.7) });
    if ((guest.callsPerStay || 1) >= 2 && wants.length < 2) {
      const extraType = guest.trait === "talker" ? "thirsty" : "chatty";
      const extraAt = s.t + Math.round(stay * (extraType === "chatty" ? 0.4 : 0.72));
      if (!wants.some((w) => w.type === extraType)) wants.push({ type: extraType, at: extraAt });
    }
  }
  if (wants.length > 1) wants.sort((a, b) => a.at - b.at);
  table.wants = refill ? [] : wants; // おかわりの一台は短いので、雑談・吸い方・水の頼みは初回だけ
  if (!refill) earn(s, table, "shisha", v.price.shisha);
  else if (table.extra < guest.drinksMax && roll(s) < 0.5) addDrink(s, table, "extend");
  s.counts[result.grade] += 1;
  const own = resolveVenueVisitor(v, guest.charId)?.lines; // 本編の人物は、その人の言葉で返す
  table.line = own ? own[result.grade === "best" ? "best" : result.grade === "off" ? "off" : "good"] : lineFor(s, v.serveLines[result.grade], table.id + s.t);
  // 流れ: ◎を続けて出すほど、ゲージが早く溜まる。○や×を出すと切れる（合う一台を待ってシャッフルするか、いまある一台で繋ぐか）
  s.streak = result.rating === "best" ? s.streak + 1 : 0;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  if (result.grade === "best") gain(s, FEVER.best + FEVER.streakStep * Math.min(FEVER.streakCap, s.streak - 1)); else if (result.grade === "good") gain(s, FEVER.good);
  note(s, { type: "serve", tableId: table.id, grade: result.grade, rating: result.rating, line: table.line, mood: result.mood, late, streak: s.streak, refill });
}

function addDrink(s, table, why) {
  table.extra += 1;
  table.drinks += 1;
  s.counts.drink += 1;
  earn(s, table, "drink", venueOf(s).price.drink);
  note(s, { type: "drink", tableId: table.id, why });
}

function tickOnce(s) {
  if (s.done) return;
  const v = venueOf(s);
  const r = v.rules;
  s.t += 1;
  if (s.shuffleAt && s.t === s.shuffleAt) note(s, { type: "shuffleDone" }); // 入れ替えが済んで、新しいミックスが並んだ
  const feverOn = s.feverLeft > 0;
  if (feverOn) {
    // 端数は累計で丸め、途中で止めても過剰に残らず、最後まで使えばちょうど1回分を消費する。
    const costAt = (ticks) => Math.ceil(FEVER.cost * ticks / r.fever);
    const used = r.fever - s.feverLeft;
    s.fever -= costAt(used + 1) - costAt(used);
  }
  // 来店: 卓が空いていれば、そのまま座る（ワンオペなので案内はしない）。閉店が近づいたら新しい客は来ない
  if (s.length - s.t < r.lastCall) s.upcoming = [];
  while (s.upcoming.length && s.guests[s.upcoming[0]].arrive <= s.t) {
    const table = s.tables.find((x) => x.phase === "empty");
    if (!table) break;
    const id = s.upcoming.shift();
    Object.assign(table, emptyTable(table.id), { phase: "order", guestId: id, since: s.t, mood: r.mood.start, line: s.guests[id].order.quote });
    s.came += 1;
    note(s, { type: "arrive", guestId: id, tableId: table.id, rare: !!s.guests[id].charId, wish: s.guests[id].order.wish, line: s.guests[id].order.quote });
    reserveFor(s, s.guests[id].order);
  }
  // 仕込み・立ち上げ: 先に受けた注文から、同時に slots 台まで進む
  const making = s.tables.filter((x) => x.phase === "prep").sort((a, b) => a.since - b.since || a.id - b.id);
  making.forEach((table, i) => {
    table.make.active = i < r.slots;
    if (!table.make.active) return;
    table.make.left -= 1;
    if (table.make.left <= 0) serve(s, table);
  });
  let calling = s.tables.filter((x) => x.call).length;
  for (const table of s.tables) {
    const guest = guestAt(s, table);
    if (s.tutorial && ["order", "bill"].includes(table.phase)) { if (table.since < s.t) table.since += 1; continue; } // チュートリアル: 待たせても減らない
    if (table.phase === "order") {
      if (table.refill && s.t - table.since >= orderWait(s)) {
        // おかわりを聞いてもらえなかった客は、あきらめて会計にする（怒って帰りはしないが、居心地は下がる）
        Object.assign(table, { phase: "bill", refill: false, since: s.t, mood: clamp(table.mood + r.mood.careLate), line: ownLine(s, guest, "skip") || "……やっぱり、お会計で" });
        note(s, { type: "refillMissed", tableId: table.id });
        note(s, { type: "billReady", tableId: table.id });
        continue;
      }
      if (s.t - table.since >= orderWait(s)) {
        // 注文を聞いてもらえなかった客は、怒って帰る
        table.bill = { charge: 0, shisha: 0, drink: 0, top: 0 };
        s.counts.left += 1;
        s.streak = 0; // 帰らせてしまうと、流れも切れる
        note(s, { type: "left", tableId: table.id, guestId: guest.id, line: ownLine(s, guest, "mad") || v.sendLines.mad });
        settle(s, table, { left: true });
      }
      continue;
    }
    if (table.phase === "bill") {
      if (s.t - table.since > r.billGrace) table.mood = clamp(table.mood - r.mood.billDecay);
      continue;
    }
    if (table.phase === "cool") {
      if (s.t - table.since >= r.cool) Object.assign(table, emptyTable(table.id));
      continue;
    }
    if (table.phase !== "enjoy") continue;
    if (table.fever && feverOn) {
      // フィーバー中の卓: 炭も滞在も止まり、居心地は最高のまま。追加ドリンクが続けて入る
      table.mood = 100;
      table.stayEnd += 1; table.coalAt += 1; table.drinkAt += 1; table.nextCall += 1;
      for (const want of table.wants) want.at += 1;
      if (table.call) { table.call.since += 1; table.call.until += 1; }
      table.feverTicks += 1;
      if (table.feverTicks % r.feverDrink === r.feverFirstDrink && table.extra < guest.drinksMax + 2) addDrink(s, table, "fever");
      continue;
    }
    if (s.tutorial) {
      // チュートリアル: 炭・滞在・頼みは、スミさんの段取り（floorTutorialCue）でだけ動く
      table.coalAt += 1; table.stayEnd += 1; table.drinkAt += 1; table.nextCall += 1;
      if (table.call) { table.call.since += 1; table.call.until += 1; }
      continue;
    }
    table.mood = clamp(table.mood - r.mood.decay * table.wear);
    if (table.call) {
      if (s.t >= table.call.until) {
        const { coal } = table.call;
        table.call = null;
        calling -= 1;
        table.mood = clamp(table.mood + r.mood.careLate);
        table.nextCall = s.t + r.callGap;
        if (coal) resetCoal(s, table, 0.6); // 放っておくと、味が落ちるのも早い
        s.counts.late += 1;
        note(s, { type: "callLate", tableId: table.id });
      }
    } else if (calling < r.callCap && s.t >= table.nextCall && s.t < table.stayEnd - 6) {
      // 同時に頼まれるのは店全体で callCap 卓まで（ワンオペで全部の卓が同時にあふれないようにする）
      if (!guest.charId && s.t >= table.coalAt) {
        // 炭の調整に行かなかった: 汎用の客のほうから頼まれる（煙が薄い／熱を下げてほしい）
        table.mood = clamp(table.mood + r.mood.tendMiss);
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
      table.drinkAt = s.t + r.drink;
      if (table.extra < guest.drinksMax && roll(s) < DRINK_CHANCE[floorStage(table.mood).id]) addDrink(s, table, "time");
    }
    if (!table.call && s.t >= table.stayEnd) {
      // 居心地の良い客は、自分からおかわり（トップ替え）を頼むことがある。一卓に一度まで
      // おかわりも、客が吸いたい気分を言い、並んだミックスから選んで出す（2026-11-25 オーナー指示）。閉店で聞きそびれた分は、それまでの会計で帰る
      const baseChance = EXTEND_CHANCE[floorStage(table.mood).id];
      const chance = baseChance > 0 ? baseChance + s.floorPerks.floorTop / 100 : 0;
      if (!table.extended && s.length - s.t >= r.top + 10 && roll(s) < chance) {
        const who = resolveVenueVisitor(v, guest.charId);
        guest.order = who ? personalOrder(who.refill) : makeOrder(() => roll(s), guest); // 本編の人物は、その人のおかわり（TFL66）
        Object.assign(table, { phase: "order", refill: true, extended: true, since: s.t, call: null, wants: [] });
        s.counts.extend += 1;
        table.line = who ? guest.order.quote : `${lineFor(s, v.sendLines.extend, table.id)}${guest.order.quote}`;
        reserveFor(s, guest.order);
        note(s, { type: "extend", tableId: table.id, line: table.line, wish: guest.order.wish });
      } else {
        Object.assign(table, { phase: "bill", since: s.t, line: ownLine(s, guest, "check") || "お会計、お願いします" });
        note(s, { type: "billReady", tableId: table.id });
      }
    }
  }
  if (feverOn) {
    s.feverLeft -= 1;
    if (!s.feverLeft) endFever(s);
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
 * action: { type: "order", tableId, mix: ミックスID（並んでいる中から） } / { type: "shuffle", tableId?: 選択中の卓 } / { type: "tend", tableId }
 *   / { type: "care", tableId, verb } / { type: "bill", tableId } / { type: "fever" } / { type: "feverStop" } / { type: "finish" }
 */
export function floorAct(state, action) {
  if (!action || state.done) return state;
  const s = structuredClone(state);
  const v = venueOf(s);
  const r = v.rules;
  s.log = [];
  const table = action.tableId ? tableOf(s, action.tableId) : null;
  const guest = guestAt(s, table);
  const can = (kind) => table && floorTap(s, table.id) === kind;
  switch (action.type) {
    case "order": {
      const slot = s.hand.indexOf(action.mix);
      if (!can("order") || slot < 0 || s.t < s.shuffleAt) return state; // 入れ替えの最中は、出せない
      const time = mixTime(action.mix, r);
      const active = s.tables.filter((x) => x.phase === "prep").length < r.slots; // 仕込みの枠が空いていれば、すぐ作りはじめる
      const refill = table.refill;
      Object.assign(table, { phase: "prep", waited: s.t - table.since, since: s.t, mix: action.mix, make: { left: time, total: time, active }, line: "" },
        refill ? {} : { bill: { charge: 0, shisha: 0, drink: 0, top: 0 }, drinks: guest.party });
      // 出したミックスは一覧から抜けて、次の一つが入る（山が尽きたら、出ていない物から組み直す）
      if (!s.deck.length) s.deck = shuffled(mixIdsFor(s.chapter).filter((id) => !s.hand.includes(id)), () => roll(s));
      s.hand[slot] = s.deck.shift();
      stockDrawn(s);
      if (refill) earn(s, table, "top", v.price.top); // おかわりはトップ替えの料金だけ（チャージと初回のドリンクは済んでいる）
      else {
        // チャージと、初回のドリンク（ひとり1杯。必ず注文する）
        earn(s, table, "charge", v.price.charge * guest.party);
        earn(s, table, "drink", v.price.drink * guest.party);
      }
      note(s, { type: "order", tableId: table.id, mix: action.mix, rating: rateMix(action.mix, guest.order), refill });
      break;
    }
    case "shuffle": {
      // 並んでいるミックスを全部入れ替える。入れ替えには時間がかかり（r.shuffle）、その間はミックスを出せない（ほかの卓は見られる）。
      // 合う一台が出るまで何度でも回せるが、そのぶん客を待たせる
      if (s.t < s.shuffleAt) return state;
      shuffleHand(s, action.tableId);
      s.shuffleAt = s.t + r.shuffle;
      s.shuffles += 1;
      note(s, { type: "shuffle", ticks: r.shuffle });
      return s; // 開店前でも出来る（閉店の判定はしない）
    }
    case "tend": {
      // 頼まれる前に、自分から炭を整える
      if (!can("tend")) return state;
      table.mood = clamp(table.mood + r.mood.tend);
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
      table.nextCall = s.t + r.callGap;
      if (coal) resetCoal(s, table, ok ? 1 : 0.6);
      if (ok) {
        table.mood = clamp(table.mood + r.mood.care);
        table.line = ownLine(s, guest, "calls")?.[type]?.good
          || call.lines[nextCallLineIndex(s, `good:${type}`, call.lines.length)].good;
        s.counts.care += 1;
        gain(s, FEVER.care);
      } else {
        table.mood = clamp(table.mood + r.mood.careMiss);
        table.line = ownLine(s, guest, "miss") || CALL_MISS[nextCallLineIndex(s, "miss", CALL_MISS.length)];
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
      const line = low ? ownLine(s, guest, "byeLow") || v.sendLines.byeLow : ownLine(s, guest, "bye") || lineFor(s, v.sendLines.bye, table.id);
      const paid = settle(s, table);
      if (paid.mood >= 65) gain(s, FEVER.send);
      note(s, { type: "bill", tableId: table.id, ...paid, line });
      break;
    }
    case "fever": {
      if (!floorFeverReady(s) || s.feverLeft > 0) return state;
      // まだフィーバーがあまり届いていない卓から。あとは滞在の残りが長い順。
      const targets = s.tables.filter((x) => x.phase === "enjoy")
        .sort((a, b) => a.feverTicks - b.feverTicks || b.stayEnd - a.stayEnd || a.id - b.id).slice(0, r.feverTargets);
      if (!targets.length) return state;
      for (const target of targets) {
        target.fever = true;
        target.feverBase = target.mood;
        target.mood = 100;
      }
      s.feverLeft = s.feverResume || r.fever;
      s.fevers += 1;
      note(s, { type: "feverStart", tables: targets.map((x) => x.id) });
      break;
    }
    case "feverStop":
      if (!s.feverLeft) return state;
      endFever(s, { resume: true });
      break;
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
  if (!table || table.fever) return 0;
  const r = rulesOf(s);
  const ratio = (elapsed, span) => clamp(elapsed / span, 0, 1);
  if (table.call) return ratio(s.t - table.call.since, table.call.until - table.call.since);
  if (table.phase === "order") return ratio(s.t - table.since, orderWait(s));
  if (table.phase === "bill") return ratio(s.t - table.since, r.billGrace);
  return 0;
}

/**
 * 待たせている卓の、残りの猶予（刻み）。注文は怒って帰るまで、頼みは消えるまで、会計は満足が下がり始めるまで。
 * 待たせていない卓は null。
 */
export function floorWaitLeft(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table || table.fever || s.done) return null;
  const r = rulesOf(s);
  if (table.call) return Math.max(0, table.call.until - s.t);
  if (table.phase === "order") return Math.max(0, orderWait(s) - (s.t - table.since));
  if (table.phase === "bill") return Math.max(0, r.billGrace - (s.t - table.since));
  return null;
}

/** くつろいでいる卓の、滞在の残り（1→0）。 */
export function floorStayLeft(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table || table.phase !== "enjoy") return 0;
  const span = table.extended ? rulesOf(s).top : STAY[guestAt(s, table).stay]; // おかわりの一台は、出した時から top
  return clamp((table.stayEnd - s.t) / span, 0, 1);
}

/** くつろいでいる卓の、炭の残り（1→0）。tendFrom を切ったら調整どき。 */
export function floorCoalLeft(s, tableId) {
  const table = tableOf(s, tableId);
  return table && table.phase === "enjoy" ? coalLeft(s, table) : 0;
}
/** 調整どきの卓か（頼まれる前に、自分から炭を整えに行ける）。 */
export const floorTendDue = (s, tableId) => { const table = tableOf(s, tableId); return !!table && tendDue(s, table); };

/** 仕込み中の一台（先に受けた順）。active＝いま手が動いている（同時に slots 台まで）。 */
export function floorMaking(s) {
  const slots = rulesOf(s).slots;
  return s.tables.filter((x) => x.phase === "prep").sort((a, b) => a.since - b.since || a.id - b.id)
    .map((x, i) => ({ tableId: x.id, mix: x.mix, label: mixName(x.mix), left: x.make.left, total: x.make.total, active: i < slots }));
}

/** いまの営業の種類（題と予報）。 */
export function floorPlan(s) {
  const nights = venueOf(s).nights;
  const def = nights[s.night] || nights.usual;
  return { id: def.id, title: byTime(def.title, s.daytime), forecast: byTime(def.forecast, s.daytime) };
}
/** 並んでいるミックス（一覧）。注文（客の order。気分の id だけでもよい）を渡すと、その注文との合い方 rating も付く。 */
export function floorHand(s, order = null) {
  const o = typeof order === "string" ? { wish: order } : order;
  return s.hand.map((id) => { const ratings = mixRatings(id); return { id, name: mixName(id), full: mixFullName(id), single: mixIsSingle(id), flavors: [...MIXES[id].flavors], recipe: mixFlavorNames(id), main: MIXES[id].main, sub: MIXES[id].sub, ratings, rating: o ? rateMix(id, o) : null }; });
}
/** 入れ替えが済むまでの刻み（0 なら並んでいる。0 より大きい間は、ミックスを出せず、シャッフルも重ねられない）。 */
export const floorShuffleLeft = (s) => Math.max(0, s.shuffleAt - s.t);
/** シャッフルにかかる長さ（刻み）。 */
export const floorShuffleTime = T.shuffle;

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

/** 残っている分を再開できるか、1回分のゲージがあるか。 */
export const floorFeverReady = (s) => s.feverResume > 0 || s.fever >= FEVER.cost;

/** はじめの心の声（今いちばん先に見るところ）。 */
export function floorHint(s) {
  if (s.done) return { kind: "done", tableId: null, text: "（終わった……）" };
  if (s.feverLeft > 0) return { kind: "fever", tableId: null, text: "（店じゅうが、いい空気だ。今のうちに回ろう）" };
  const urgent = (list) => list.sort((a, b) => floorUrgency(s, b.id) - floorUrgency(s, a.id))[0];
  const ordering = urgent(s.tables.filter((x) => x.phase === "order"));
  // 入れ替えの最中は、ミックスを出せない。その間に、ほかの用件へ回る
  if (ordering && s.t >= s.shuffleAt) return { kind: "order", tableId: ordering.id, text: `（${ordering.id}卓、注文を聞かないと）` };
  const calling = urgent(s.tables.filter((x) => x.call));
  if (calling) return { kind: "call", tableId: calling.id, text: `（${calling.id}卓の様子を見にいこう）` };
  const billing = urgent(s.tables.filter((x) => x.phase === "bill"));
  if (billing) return { kind: "bill", tableId: billing.id, text: `（${billing.id}卓のお会計だ）` };
  const tending = s.tables.filter((x) => tendDue(s, x)).sort((a, b) => coalLeft(s, a) - coalLeft(s, b))[0];
  if (tending) return { kind: "tend", tableId: tending.id, text: `（${tending.id}卓、そろそろ炭を見にいこう）` };
  if (ordering) return { kind: "shuffle", tableId: null, text: "（入れ替え中だ。ほかの卓を見よう）" };
  if (floorFeverReady(s) && s.tables.filter((x) => x.phase === "enjoy").length >= 2) return { kind: "feverReady", tableId: null, text: "（いい空気だ。フィーバー、いける）" };
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
const rankOf = (ranks, score, left, groups) => ranks.find((r) => score >= r.min && !(r.id === "S" && (left || !groups))) || ranks[ranks.length - 1];
/**
 * いまの調子（いま締めたら、どの評価か）。見送った組の満足と、いま一台が出ている卓の満足の平均で見る。
 * まだ一台も出していない間は null。next＝一つ上の評価と、そこまでに足りない満足。
 */
export function floorOutlook(s) {
  const moods = [...s.results.map((row) => row.mood), ...s.tables.filter((t) => t.phase === "enjoy" || t.phase === "bill").map((t) => t.mood)];
  if (!moods.length) return null;
  const ranks = venueOf(s).ranks;
  const score = Math.round(moods.reduce((sum, mood) => sum + mood, 0) / moods.length);
  const left = s.results.filter((row) => row.left).length;
  const rank = rankOf(ranks, score, left, moods.length);
  const upper = ranks[ranks.findIndex((r) => r.id === rank.id) - 1] || null;
  return { score, rank: rank.id, stamp: rank.stamp, left, next: upper ? { rank: upper.id, stamp: upper.stamp, need: Math.max(0, upper.min - score), blocked: upper.id === "S" && left > 0 } : null };
}

export function floorResult(s, allowances = 0) {
  const v = venueOf(s);
  const groups = s.results.map((row) => ({ ...row }));
  const score = groups.length ? Math.round(groups.reduce((sum, row) => sum + row.mood, 0) / groups.length) : 0;
  const left = groups.filter((row) => row.left).length;
  // 「大入り」は、怒って帰った組がいない夜だけ。
  const rank = rankOf(v.ranks, score, left, groups.length);
  const sum = (key) => groups.reduce((total, row) => total + (row[key] || 0), 0);
  const mixes = Object.values(s.mixes).map((m) => ({ id: m.id, label: mixName(m.id), n: m.n, avg: Math.round(m.sum / m.n) }))
    .sort((a, b) => b.avg - a.avg || b.n - a.n).slice(0, 3);
  return {
    venue: v.id, night: s.night, title: s.title, sales: s.sales, visitor: s.visitor,
    items: { charge: sum("charge"), shisha: sum("shisha"), drink: sum("drink"), top: sum("top") },
    fans: s.fans, score, rank: rank.id, stamp: rank.stamp, comment: rank.line,
    pay: floorVenueShiftPay(v, s.chapter, s.sales, allowances),
    groups, served: groups.filter((row) => !row.left).length, came: groups.length, left,
    stages: Object.fromEntries(MOODS.map((m) => [m.id, groups.filter((row) => row.stage === m.id).length])),
    counts: { ...s.counts }, fevers: s.fevers, shuffles: s.shuffles, streak: s.bestStreak, closing: s.closing, mixes,
  };
}

/** 頼みの言葉（卓の札の短い言葉・言葉で伝わる夜の一言・様子を読む夜の一文）。本編の人物は、その人の口調で頼む（TFL65）。頼みが無い卓は null。 */
export function floorCallLine(s, tableId) {
  const table = tableOf(s, tableId);
  if (!table?.call) return null;
  const call = CALLS[table.call.type];
  const { said, sight } = call.lines[table.call.variant ?? 0];
  const own = ownLine(s, guestAt(s, table), "calls")?.[table.call.type];
  return { label: call.label, said: own?.said || said, sight };
}

/** 日が暮れたか（昼から夜まで通しの店番の後半。TFL62）。 */
export const floorDusk = (s) => s.dusk !== null && s.dusk !== undefined && s.t >= s.dusk;

// ---- チュートリアル（TFL64）: はじめての店番の前に、スミさんが一通りやらせる。客・並ぶミックス・山の順は決めてある ----
// 1卓のフルーティの客には◎が一つ（○も一つ）。2卓のリラックスの客には合う一台が無く、シャッフルすると◎と○が並ぶ。
const TUTORIAL_HAND = Object.freeze(["peachmango", "chocovanilla", "lemonmint", "caramelnuts", "colamint"]);
const TUTORIAL_DECK = Object.freeze(["grapemint", "watermelonmint", "rosejasmine", "peachlychee", "chocobanana", "honeylemon"]);
/** チュートリアルの営業（時間切れ・帰ってしまう客・勝手に出る頼みが無い）。 */
export function createFloorTutorial({ chapter = 1, daytime = true } = {}) {
  const s = createFloorNight({ seed: 1, level: 0, chapter, daytime, night: "first" });
  const guest = (id, kindId, wish, say, arrive) => {
    const kind = GUESTS[kindId];
    return { id, kind: kindId, art: kindId, pair: null, name: byTime(kind.name, daytime), party: 1, stay: kind.stay, rank: "plain", trait: kind.trait,
      drinksMax: kind.drinks, look: [kind.look[0]], arrive, order: { wish, quote: WISHES.find((w) => w.id === wish).say[say] } };
  };
  const rest = mixIdsFor(chapter).filter((id) => !TUTORIAL_HAND.includes(id) && !TUTORIAL_DECK.includes(id));
  return Object.assign(s, {
    tutorial: true, title: "段取りのおさらい", length: 9999, visitor: null,
    guests: { g1: guest("g1", "first", "fruit", 0, 2), g2: guest("g2", "reader", "deep", 1, 6) }, upcoming: ["g1", "g2"],
    hand: [...TUTORIAL_HAND], deck: [...TUTORIAL_DECK, ...rest],
  });
}
/**
 * チュートリアルの段取り（スミさんが、その段で起きることを起こす）。cough＝むせる（頼み）／coal＝炭が減る（調整どき）／
 * bill＝会計を頼まれる／fever＝フィーバーの灯りが溜まる。チュートリアルでなければ何もしない。
 */
export function floorTutorialCue(state, cue, tableId = null) {
  if (!state.tutorial || state.done) return state;
  const s = structuredClone(state);
  s.log = [];
  const table = tableId ? tableOf(s, tableId) : null;
  if (cue === "cough" && table?.phase === "enjoy" && !table.call) openCall(s, table, "cough");
  else if (cue === "coal" && table?.phase === "enjoy") table.coalAt = s.t + Math.floor(table.coalSpan * 0.3);
  else if (cue === "bill" && table?.phase === "enjoy") {
    Object.assign(table, { phase: "bill", since: s.t, call: null, line: "お会計、お願いします" });
    note(s, { type: "billReady", tableId: table.id });
  } else if (cue === "fever" && !floorFeverReady(s)) {
    s.fever = FEVER.cost;
    note(s, { type: "feverReady" });
  }
  return s;
}

export const floorOrderWait = orderWait;
export const floorFeverLength = T.fever;
export const floorFeverMax = FEVER.max;
export const floorFeverCost = FEVER.cost;
/** 閉店までこの刻みを切ったら、新しい客は来ない（ラストオーダー）。 */
export const floorLastCall = T.lastCall;
export const floorSlots = T.slots;
export const floorVenueTableCount = (s) => rulesOf(s).tableCount;
export const floorVenueSlots = (s) => rulesOf(s).slots;
export const floorVenueShuffleTime = (s) => rulesOf(s).shuffle;
export const floorVenueFeverLength = (s) => rulesOf(s).fever;
export const floorVenueLastCall = (s) => rulesOf(s).lastCall;
export const floorVenuePrice = (s) => venueOf(s).price;
