// 「てつこといっしょ / TETSUKO TIME」のモデル（#2454）。DOM を持たず、Node のテストからそのまま読める。
// 育つのは猫の姿ではなく「はじめとの距離」「一緒にできること」「裏口の居場所」「思い出」。
// 点数・ランク・制限時間・世話をしない日の悪化は持たない。関係は下がらない。
//
// 関係の段階は新しい数値を作らず、既存の「裏口のてつこ」の回数（flags._ch3_outings.tetsuko）から決める。
// 段階の会話（初回→ブラシ→待つ→すり寄る）は ch3-outing-progress.js の stages が正本。
//
// おやつと小物はスマホの通販で注文し、次の日に mukai へ届く（2026-11-06 オーナー「専門店とか今ないし」）。
// 小物は一度買えば無くならない。最初の荷物の段ボール箱も小物として使える。
import { seeded } from "../core/util.js";

export const TETSUKO_TIME_FLAG = "_tetsuko_time";
export const OUTING_COUNT_FLAG = "_ch3_outings";
/** 意味のあるふれあいを終えた時の回復（既存の「少し構っていく」と同じ内部値） */
export const TETSUKO_STAMINA = 12;
export const ALBUM_LIMIT = 12;
const STAGE_COUNT = 4;

export const SLOTS = Object.freeze([
  Object.freeze({ id: "bench", label: "ベンチ" }),
  Object.freeze({ id: "floor", label: "床" }),
  Object.freeze({ id: "bed", label: "寝床の角" }),
]);
const SLOT_IDS = SLOTS.map(slot => slot.id);
export const slotLabel = id => SLOTS.find(slot => slot.id === id)?.label || "";

/**
 * 小物。price が 0 の物は買わない（ball は最初から、box は最初の荷物の箱）。
 * 性能差は付けない。置いた物で「てつこが何をするか」が変わるだけ。
 */
export const PROPS = Object.freeze([
  { id: "ball", name: "古いボール", slots: ["floor"], price: 0, initial: true, desc: "店の隅に転がっていた、毛玉だらけのボール。" },
  { id: "box", name: "段ボール箱", slots: ["bench", "floor", "bed"], price: 0, packing: true, desc: "通販の荷物が入っていた箱。" },
  { id: "cushion", name: "猫用の座布団", slots: ["bench", "bed"], price: 1200, desc: "小さくて、ふかふかの座布団。" },
  { id: "scratcher", name: "段ボールの爪とぎ", slots: ["floor"], price: 800, desc: "平たい、段ボールの爪とぎ。" },
  { id: "tunnel", name: "猫用のトンネル", slots: ["floor"], price: 1800, desc: "くしゅくしゅと音のする、布のトンネル。" },
  { id: "bed", name: "猫ベッド", slots: ["bed"], price: 3200, desc: "ふちの高い、丸い猫ベッド。" },
].map(Object.freeze));
export const TREAT = Object.freeze({ id: "treat", name: "猫用のおやつ（6本入り）", price: 600, count: 6,
  desc: "ささみのスティック。あげるのは一日一本まで。" });
/** 通販の品書き（並び順もこのまま） */
export const CATALOG = Object.freeze([TREAT, ...PROPS.filter(prop => prop.price > 0)]);
const propById = id => PROPS.find(prop => prop.id === id) || null;
export const itemName = id => (id === TREAT.id ? TREAT : propById(id))?.name || "";

export const MOODS = Object.freeze([
  Object.freeze({ id: "calm", label: "今日は、のんびりしているみたいだ。" }),
  Object.freeze({ id: "sleepy", label: "今日は、少し眠そうだ。" }),
  Object.freeze({ id: "playful", label: "今日は、少し遊びたいみたいだ。" }),
  Object.freeze({ id: "clingy", label: "今日は、甘えたい気分らしい。", early: "今日は、こちらを気にしているみたいだ。" }),
]);

/** しぐさ図鑑（自動で記録する）。hint は未発見の時の緩い手がかり。 */
export const MOMENTS = Object.freeze([
  { id: "first_paw", name: "はじめて前足が出た", hint: "猫じゃらしを、何度か揺らしてみると……" },
  { id: "hug_toy", name: "じゃらしを抱えこむ", hint: "少し慣れてから、じゃらしを止めてみると……" },
  { id: "brush_bliss", name: "ブラシでうっとり", hint: "ブラシをかけられるようになったら……" },
  { id: "waiting", name: "こちらを待っていた", hint: "何度か通っていると……" },
  { id: "first_rub", name: "はじめてのすりすり", hint: "すっかり気を許してくれたら……" },
  { id: "box_peek", name: "箱から顔だけ", hint: "段ボール箱を置いておくと……" },
  { id: "ball_watch", name: "ボールを見送る", hint: "床にボールを置いておくと……" },
  { id: "paws_together", name: "前足をそろえる", hint: "そっと見守っていると……" },
  { id: "odd_sleep", name: "妙な寝相", hint: "眠そうな日か、柔らかい寝床があると……" },
  { id: "lap_nap", name: "膝で寝る", hint: "気を許してくれた日に、何度か見守ると……" },
  { id: "box_over_bed", name: "ベッドより箱", hint: "猫ベッドと段ボール箱を、両方置いてみると……" },
  { id: "see_off", name: "帰りの見送り", hint: "気を許してくれたら、帰りぎわに……" },
].map(Object.freeze));
const MOMENT_IDS = new Set(MOMENTS.map(moment => moment.id));
export const POSES = Object.freeze(["normal", "smile", "surprise", "serious", "sleep"]);
const POSE_CAPTIONS = { normal: "いつものてつこ", smile: "目を細めたてつこ", surprise: "きょとんとしたてつこ",
  serious: "何かを狙うてつこ", sleep: "眠るてつこ" };

// ---- 保存の読み方 ------------------------------------------------------------------------------
const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const count = value => Number.isInteger(value) && value > 0 ? value : 0;

/** 裏口でてつこに会った回数（「少し構っていく」と「てつこといっしょ」の共通の記録） */
export const tetsukoVisits = value => count(record(value?.flags?.[OUTING_COUNT_FLAG])?.tetsuko);
/** 次に会う時の段階（0=まだ様子見 1=顔なじみ 2=待ってくれる 3=気を許す）。段階の会話を読んだ回数そのもの。 */
export const tetsukoStage = value => Math.min(STAGE_COUNT - 1, tetsukoVisits(value));
/** 今日の気分。ゲーム内の通算日で決まり、開き直しても変わらない。 */
export const tetsukoMood = day => MOODS[Math.min(MOODS.length - 1, Math.floor(seeded(Number(day) || 1, 2454) * MOODS.length))];
export const moodLabel = (mood, stage) => stage < 2 && mood.early ? mood.early : mood.label;

/** 保存済みの記録を読める形にそろえる（読むだけ）。形の合わない値は既定に戻す。 */
export function tetsukoRecord(value) {
  const raw = record(value?.flags?.[TETSUKO_TIME_FLAG]) || {};
  const orders = Array.isArray(raw.orders) ? raw.orders.filter(order => record(order)
    && (order.id === TREAT.id || propById(order.id)?.price > 0) && Number.isInteger(order.day)).map(order => ({ id: order.id, day: order.day })) : [];
  const layout = record(raw.layout) ? Object.fromEntries(SLOT_IDS.map(slot => [slot, typeof raw.layout[slot] === "string" ? raw.layout[slot] : null]))
    : { bench: null, floor: "ball", bed: null };
  const found = Array.isArray(raw.found) ? [...new Set(raw.found.filter(id => MOMENT_IDS.has(id)))] : [];
  const album = Array.isArray(raw.album) ? raw.album.filter(entry => record(entry) && typeof entry.id === "string"
    && POSES.includes(entry.pose)).slice(0, ALBUM_LIMIT).map(entry => ({ id: entry.id, pose: entry.pose,
    caption: String(entry.caption || ""), label: String(entry.label || "") })) : [];
  return { v: 1, layout, orders, found, album,
    treatsUsed: count(raw.treatsUsed), treatDay: Number.isInteger(raw.treatDay) ? raw.treatDay : null,
    unpacked: Math.min(count(raw.unpacked), orders.length), sessions: count(raw.sessions),
    lastKey: typeof raw.lastKey === "string" ? raw.lastKey : null };
}

/** 届いた注文（注文した次の日から）。並びは注文順。 */
export const arrivedOrders = (rec, day) => rec.orders.filter(order => order.day < day);
export const pendingOrders = (rec, day) => rec.orders.filter(order => order.day >= day);
/** 持っている小物。ボールは最初から、箱は最初の荷物が届いた時から。 */
export function ownedProps(rec, day) {
  const arrived = arrivedOrders(rec, day);
  const ids = new Set(["ball"]);
  if (arrived.length) ids.add("box");
  for (const order of arrived) if (propById(order.id)) ids.add(order.id);
  return ids;
}
export const treatsLeft = (rec, day) => Math.max(0, arrivedOrders(rec, day).filter(order => order.id === TREAT.id).length * TREAT.count - rec.treatsUsed);

/** 配置を正す: 持っている物だけ・置ける枠だけ・同じ物は一か所。 */
export function normalizeLayout(layout, owned) {
  const used = new Set();
  return Object.fromEntries(SLOT_IDS.map(slot => {
    const id = layout?.[slot];
    const ok = typeof id === "string" && owned.has(id) && propById(id).slots.includes(slot) && !used.has(id);
    if (ok) used.add(id);
    return [slot, ok ? id : null];
  }));
}

// ---- 通販 -------------------------------------------------------------------------------------
/**
 * 注文できるか（読むだけ）。小物は一つずつ・一度だけ。おやつは届く前の注文が無い時だけ。
 * @returns {{ ok: boolean, price: number, status: "owned"|"pending"|"short"|"ready", why: string }}
 */
export function orderStatus(value, id, money, day = value?.day) {
  const item = id === TREAT.id ? TREAT : propById(id);
  if (!item || !(item.price > 0)) return { ok: false, price: 0, status: "owned", why: "" };
  const rec = tetsukoRecord(value);
  if (item !== TREAT && ownedProps(rec, day).has(id)) return { ok: false, price: item.price, status: "owned", why: "持っている" };
  if (pendingOrders(rec, day).some(order => order.id === id)) return { ok: false, price: item.price, status: "pending", why: "明日届く" };
  if (!(money >= item.price)) return { ok: false, price: item.price, status: "short", why: "お金が足りない" };
  return { ok: true, price: item.price, status: "ready", why: "" };
}

/** 注文を記録する（お金は呼び出し側が同じ処理の中で引く）。記録できたら値段を返す。 */
export function recordOrder(value, id, money, day = value?.day) {
  const status = orderStatus(value, id, money, day);
  if (!status.ok || !value?.flags) return 0;
  const raw = record(value.flags[TETSUKO_TIME_FLAG]) || {};
  value.flags[TETSUKO_TIME_FLAG] = { ...raw, v: 1, orders: [...tetsukoRecord(value).orders, { id, day }] };
  return status.price;
}

// ---- ふれあい ---------------------------------------------------------------------------------
/** 乱数（日と回数で決まる。テストで同じ流れを再現できる） */
function generator(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const line = (text, who = null) => ({ who, text });

/**
 * 画面を開いている間の自律行動。prop はその小物が置いてある時だけ（猫はその枠へ移る）。
 * at: stay=その場 / front=手前 / 枠ID。mode: sit・on（上）・in（中）・peek（顔だけ）・beside（横）・hidden（しっぽだけ）。
 */
const BEHAVIORS = Object.freeze([
  { id: "yawn", at: "stay", pose: "smile", text: "てつこが、大きなあくびをひとつした。" },
  { id: "groom", at: "stay", pose: "normal", text: "てつこが前足をなめて、顔を洗っている。", mood: "calm" },
  { id: "sco", at: "bench", pose: "normal", text: "てつこが壁にもたれて、スコ座りをしている。", mood: "calm", when: c => !c.layout.bench },
  { id: "door", at: "stay", pose: "serious", text: "てつこが、店の戸のほうをじっと見ている。" },
  { id: "tail", at: "stay", pose: "normal", text: "しっぽの先だけが、ゆっくり揺れている。" },
  { id: "doze", at: "stay", pose: "sleep", text: "うとうとして、頭がかくんと揺れた。", mood: "sleepy" },
  { id: "approach", at: "front", pose: "smile", text: "てつこが降りてきて、足元に座った。", mood: "clingy", when: c => c.stage >= 2 },
  { id: "look_up", at: "front", pose: "normal", text: "足元から、てつこがこちらの顔を見上げている。", mood: "clingy", when: c => c.stage >= 3 },
  { id: "box_in", prop: "box", mode: "in", pose: "normal", text: "てつこが段ボール箱に、するりと入った。", when: c => !c.has("bed") },
  { id: "box_peek", prop: "box", mode: "peek", pose: "surprise", text: "箱のふちから、てつこが顔だけ出している。", moment: "box_peek" },
  { id: "ball_watch", prop: "ball", mode: "beside", pose: "serious", text: "転がったボールを、てつこは目だけで見送った。", moment: "ball_watch", roll: true },
  { id: "ball_paw", prop: "ball", mode: "beside", pose: "surprise", text: "てつこが前足で、ボールをちょいとつついた。", mood: "playful", roll: true },
  { id: "scratch", prop: "scratcher", mode: "beside", pose: "serious", text: "爪とぎで、ばりばりと爪をといでいる。", mood: "playful" },
  { id: "cushion_curl", prop: "cushion", mode: "on", pose: "sleep", text: "てつこが座布団の上で、くるりと丸くなった。", mood: "sleepy" },
  { id: "bed_sleep", prop: "bed", mode: "in", pose: "sleep", text: "てつこが猫ベッドに入って、目を閉じた。", mood: "sleepy", when: c => !c.has("box") },
  { id: "box_over_bed", prop: "box", about: ["bed"], mode: "in", pose: "normal", when: c => c.has("bed"), moment: "box_over_bed",
    lines: (c, first) => [line("猫ベッドの横を素通りして、てつこは段ボール箱に入った。"), ...(first && c.met.mukai_master ? [line("……そっちか", "mukai_master")] : [])] },
  { id: "tunnel_tail", prop: "tunnel", mode: "hidden", pose: "normal", text: "トンネルの中から、しっぽだけが出ている。", mood: "playful" },
  { id: "odd_sleep", at: "stay", pose: "sleep", text: "お腹を半分出した、妙な格好で寝ている。", moment: "odd_sleep",
    when: c => c.stage >= 1 && (c.mood.id === "sleepy" || c.has("cushion") || c.has("bed")) },
  { id: "mashiro_pass", at: "stay", pose: "surprise", text: "戸の向こうをましろちゃんが通ると、てつこの耳がそちらを向いた。",
    when: c => !!c.met.mashiro && c.stage >= 1 && !c.mashiroSeen },
].map(Object.freeze));
export const BEHAVIOR_IDS = Object.freeze(BEHAVIORS.map(behavior => behavior.id));

/** その枠の小物に、猫がどう収まるか（座布団は上・箱とベッドは中・ほかは横） */
const restMode = id => id === "cushion" ? "on" : id === "box" || id === "bed" ? "in" : id ? "beside" : "sit";
const ctx = session => ({ stage: session.stage, mood: session.mood, met: session.met, layout: session.layout,
  has: id => SLOT_IDS.some(slot => session.layout[slot] === id), mashiroSeen: session.mashiroSeen });
const slotOf = (session, id) => SLOT_IDS.find(slot => session.layout[slot] === id) || null;

/**
 * ふれあいを始める。value は読むだけ（保存は settleTetsukoTime がまとめて書く）。
 * storyRead: 直前に段階の会話を読み終えた（それだけで意味のあるふれあいになる）。
 */
export function createSession(value, { day = value?.day || 1, key = null, storyRead = false, dayLabel = "" } = {}) {
  const rec = tetsukoRecord(value);
  const stage = tetsukoStage(value);
  const owned = ownedProps(rec, day);
  const arrived = arrivedOrders(rec, day);
  const arrivals = arrived.slice(rec.unpacked);
  const layout = normalizeLayout(rec.layout, owned);
  // 届いた物は空いている枠に置いておく（置けなければ、もようがえで置ける）。最初の荷物は箱も出る。
  const unpackedProps = [];
  const firstParcel = rec.unpacked === 0 && arrivals.length > 0;
  for (const id of [...arrivals.map(order => order.id), ...(firstParcel ? ["box"] : [])]) {
    const prop = propById(id);
    if (!prop || unpackedProps.some(item => item.id === id)) continue;
    const slot = prop.slots.find(slot => !layout[slot]) || null;
    if (slot) layout[slot] = id;
    unpackedProps.push({ id, slot });
  }
  const session = {
    day, key, stage, dayLabel, mood: tetsukoMood(day), met: { ...(value?.met || {}) },
    layout, owned, arrivals, unpackedProps, arrivedCount: arrived.length,
    treatsLeft: treatsLeft(rec, day), treatToday: rec.treatDay === day, treatsUsed: 0,
    found: new Set(rec.found), fresh: [], album: rec.album.map(entry => ({ ...entry })),
    meaningful: !!storyRead, storyRead: !!storyRead,
    streak: 0, lastAction: null, pets: 0, wiggles: 0, brushed: 0, watched: 0, lap: false, lapTicks: 0,
    mashiroSeen: false, lastBehavior: null, recent: [], tick: 0, focus: null, seeOff: false,
    cat: { at: stage >= 3 ? "front" : "bench", mode: stage >= 3 ? "sit" : restMode(layout.bench), pose: stage >= 3 ? "smile" : "normal", roll: false },
    moment: null,
    rng: generator(Math.imul(Number(day) || 1, 31) + tetsukoVisits(value) * 7 + 2454),
  };
  return session;
}

/** しぐさの発見（初めてなら新しく記録）。 */
function discover(session, id) {
  if (!id || !MOMENT_IDS.has(id)) return null;
  session.moment = id;
  if (session.found.has(id)) return null;
  session.found.add(id);
  session.fresh.push(id);
  return MOMENTS.find(moment => moment.id === id);
}

/** 画面の変化を一つの形にまとめる（UI はこれを描くだけ） */
function reaction(session, { lines, pose, at = "stay", mode = "sit", moment = null, roll = false, purr = false }) {
  if (at !== "stay") {
    session.cat.at = at;
    session.cat.mode = mode;
  } else if (mode !== "sit") session.cat.mode = mode;
  else if (session.cat.mode === "peek") session.cat.mode = "in"; // 顔だけ出していた箱の中に戻る
  else if (session.cat.mode === "hidden") session.cat.mode = "beside"; // トンネルから出てくる
  else if (session.cat.mode === "lap" && pose !== "sleep") session.cat.mode = "sit";
  session.lap = session.cat.mode === "lap"; // 膝から降りたら、次に見守った時はまた乗ってくる
  if (pose) session.cat.pose = pose;
  session.cat.roll = roll;
  session.moment = null;
  const found = discover(session, moment);
  return { lines, cat: { ...session.cat }, found, purr };
}

/** 開いた時の最初の一言（届いた荷物・段階ごとの迎え方） */
export function openingLines(session) {
  const lines = [];
  if (session.arrivals.length || session.unpackedProps.length) {
    if (session.met.mukai_master) lines.push(line("はじめくんの荷物、届いてたよ。裏に置いておいた", "mukai_master"));
    else lines.push(line("裏口に、自分宛ての荷物が届いていた。"));
    for (const item of session.unpackedProps.filter(item => item.id !== "box")) {
      lines.push(line(item.slot ? `${itemName(item.id)}を出して、${slotLabel(item.slot)}に置いた。` : `${itemName(item.id)}を出した。もようがえで置ける。`));
    }
    if (session.arrivals.some(order => order.id === TREAT.id)) lines.push(line(`${TREAT.name.replace(/（.*）/, "")}が届いた。`));
    if (session.unpackedProps.some(item => item.id === "box" && item.slot)) lines.push(line("空いた段ボール箱を、てつこがじっと見ている。"));
  }
  const greet = session.storyRead
    ? ["てつこは、まだベンチの上にいる。", "てつこは、まだベンチの上にいる。", "てつこが、ベンチからこちらを見ている。", "てつこは、まだ足元にいる。"]
    : ["てつこはベンチの上で、こちらを一度だけ見た。", "てつこはベンチの上で、片目だけ開けた。",
      "戸を開けると、てつこがもうこちらを見ていた。", "戸を開けると、てつこがベンチから降りてきた。"];
  lines.push(line(greet[session.stage]));
  const found = session.stage >= 2 ? discover(session, "waiting") : null;
  return { lines, cat: { ...session.cat }, found };
}

const PET_LINES = [
  ["撫でると、てつこは目を閉じて流した。", "撫でても、てつこは知らん顔をしている。"],
  ["撫でると、てつこが目を細めた。", "頭を撫でると、耳が少し寝た。"],
  ["撫でる手に、てつこが頭を寄せてきた。", "頬を撫でると、てつこが目を細めた。"],
  ["てつこが手にすり寄ってくる。喉の音が聞こえる。", "撫でると、てつこが手に額を押しつけてきた。"],
];
const PET_POSE = ["normal", "smile", "smile", "smile"];

/** 今押せる操作（label は表示名、why は押せない理由）。 */
export function actionState(session) {
  const treat = session.treatToday ? { ok: false, why: "今日はもうあげた" }
    : session.treatsLeft > 0 ? { ok: true, why: `残り${session.treatsLeft}本` } : { ok: false, why: "切れている（通販で頼める）" };
  return {
    pet: { ok: true, label: "なでる", why: "" },
    play: { ok: true, label: session.wiggles >= 3 ? "じゃらしを止める" : "あそぶ", why: "" },
    brush: session.stage >= 1 ? { ok: true, label: "ブラシ", why: "" } : { ok: false, label: "ブラシ", why: "もう少し慣れてから" },
    treat: { ...treat, label: "おやつ" },
    watch: { ok: true, label: "そっと見守る", why: "" },
  };
}

/** 主操作。押せない操作は何も変えず null。 */
export function interact(session, action) {
  const state = actionState(session)[action];
  if (!state?.ok) return null;
  session.meaningful = true;
  session.streak = session.lastAction === action ? session.streak + 1 : 1;
  session.lastAction = action;
  if (action !== "play") session.wiggles = 0;
  if (action === "pet") return pet(session);
  if (action === "play") return play(session);
  if (action === "brush") {
    session.brushed += 1;
    if (session.brushed === 1) return reaction(session, { lines: [line("背中にブラシを当てる。てつこが、ふにゃりと力を抜いた。")], pose: "smile", moment: "brush_bliss" });
    const text = session.brushed % 2 ? "ブラシを止めると、てつこが手を目で追った。" : "茶色の毛が、ブラシにふわりと絡む。";
    return reaction(session, { lines: [line(text)], pose: session.brushed % 2 ? "normal" : "smile" });
  }
  if (action === "treat") {
    session.treatToday = true;
    session.treatsLeft -= 1;
    session.treatsUsed += 1;
    return reaction(session, { lines: [line("小皿におやつを出す。てつこが、まず匂いを確かめた。"),
      line("静かに食べ終えると、前足で顔を洗い始めた。")], pose: "smile", at: "front" });
  }
  return watch(session);
}

function pet(session) {
  session.pets += 1;
  if (session.streak >= 5) return reaction(session, { lines: [line("（今は、そっとしておこう）", "hajime")], pose: "serious" });
  if (session.streak === 4) return reaction(session, { lines: [line("しっぽをぱたんと振った。今は、もういいらしい。")], pose: "serious" });
  if (session.mood.id === "sleepy" && session.stage >= 1 && session.pets === 2)
    return reaction(session, { lines: [line("撫でているうちに、てつこのまぶたが下がってきた。")], pose: "sleep" });
  const stage = session.stage;
  const text = PET_LINES[stage][(session.pets - 1) % 2];
  const lap = session.cat.mode === "lap";
  return reaction(session, { lines: [line(lap ? "膝の上のてつこを撫でる。寝息が、少し深くなった。" : text)],
    pose: lap ? "sleep" : PET_POSE[stage], moment: stage >= 3 ? "first_rub" : null, purr: stage >= 3 });
}

function play(session) {
  if (session.wiggles >= 3) {
    session.wiggles = 0;
    if (session.stage === 0) return reaction(session, { lines: [line("止めた先を、てつこが前足で押さえた。すぐに離す。")], pose: "surprise" });
    return reaction(session, { lines: [line("止めたとたん、てつこがじゃらしを抱えこんだ。")], pose: "surprise", moment: "hug_toy" });
  }
  session.wiggles += 1;
  if (session.wiggles === 1) return reaction(session, { lines: [line("猫じゃらしを小さく揺らす。てつこの目が、先を追った。")], pose: "serious" });
  if (session.wiggles === 2) return reaction(session, { lines: [line("てつこが身を低くした。じっと狙っている。")], pose: "serious" });
  return reaction(session, { lines: [line("前足が、ひょいと出た。")], pose: "surprise", moment: "first_paw" });
}

function watch(session) {
  session.watched += 1;
  if (session.watched === 1) return reaction(session, { lines: [line("隣に座って、黙って見ていた。てつこが前足をそろえた。")], pose: "normal", moment: "paws_together" });
  if (session.lap) { session.lapTicks = 0; return reaction(session, { lines: [line("膝の上で、てつこが寝息を立てている。")], pose: "sleep", at: "front", mode: "lap" }); }
  if (session.stage >= 3) {
    session.lap = true;
    session.lapTicks = 0;
    return reaction(session, { lines: [line("てつこが膝に乗ってきて、そのまま丸くなった。"),
      ...(session.met.mukai_master && !session.found.has("lap_nap") ? [line("……起こさないようにな", "mukai_master")] : [])], pose: "sleep", at: "front", mode: "lap", moment: "lap_nap" });
  }
  return nextBehavior(session, { quiet: false })
    || reaction(session, { lines: [line("しばらく、てつこと裏口の風に当たっていた。")], pose: "normal" });
}

/**
 * 自律行動を一つ選ぶ（画面を開いている間だけ呼ぶ。閉じている間は進めない）。
 * 1回おきに落ち着いた待機（null）を挟む。直前と同じ行動は選ばない。
 * 条件を満たした未発見のしぐさを 7 割で優先し、何度か会えば大事な思い出が見られるようにする。
 */
export function nextBehavior(session, { quiet = true } = {}) {
  session.tick += 1;
  if (quiet && session.tick % 2 === 0 && !session.focus) return null;
  // 膝で寝ている間は少しのあいだ起こさない。しばらくすると自分で降りる（立てなくなる演出で操作を止めない）。
  if (session.cat.mode === "lap") {
    session.lapTicks += 1;
    if (session.lapTicks < 3) return null;
    session.lapTicks = 0;
    session.lap = false;
    return { ...reaction(session, { lines: [line("てつこが膝から降りて、大きく伸びをした。")], pose: "normal", at: "front", mode: "sit" }), behavior: "stretch" };
  }
  const c = ctx(session);
  const open = BEHAVIORS.filter(behavior => (!behavior.prop || c.has(behavior.prop)) && (!behavior.when || behavior.when(c)));
  // 直近の行動は避ける（候補が少ない時は直前の一つだけ）
  const avoid = session.recent.slice(open.length > 4 ? -3 : -1);
  const usable = open.filter(behavior => !avoid.includes(behavior.id));
  if (!usable.length) return null;
  let pool = usable;
  if (session.focus) {
    const focused = usable.filter(behavior => behavior.prop === session.focus || behavior.about?.includes(session.focus));
    session.focus = null;
    if (focused.length) pool = focused;
  } else {
    const fresh = usable.filter(behavior => behavior.moment && !session.found.has(behavior.moment));
    if (fresh.length && session.rng() < 0.7) pool = fresh;
  }
  const weights = pool.map(behavior => behavior.mood === session.mood.id ? 3 : 1);
  let roll = session.rng() * weights.reduce((a, b) => a + b, 0);
  const behavior = pool.find((_, index) => (roll -= weights[index]) < 0) || pool[pool.length - 1];
  session.lastBehavior = behavior.id;
  session.recent = [...session.recent, behavior.id].slice(-3);
  if (behavior.id === "mashiro_pass") session.mashiroSeen = true;
  const at = behavior.prop ? slotOf(session, behavior.prop) : behavior.at;
  const first = !!behavior.moment && !session.found.has(behavior.moment); // 人の一言は初めて見た時だけ
  return { ...reaction(session, { lines: behavior.lines ? behavior.lines(c, first) : [line(behavior.text)], pose: behavior.pose,
    at, mode: behavior.mode || "sit", moment: behavior.moment || null, roll: !!behavior.roll }), behavior: behavior.id };
}

/** もようがえ。持っていない物・置けない枠は無視して null。置いた物を、てつこが確かめに来る。 */
export function arrange(session, slot, id) {
  if (!SLOT_IDS.includes(slot) || (id !== null && (!session.owned.has(id) || !propById(id)?.slots.includes(slot)))) return null;
  const next = { ...session.layout };
  for (const other of SLOT_IDS) if (id && next[other] === id) next[other] = null;
  next[slot] = id;
  session.layout = next;
  if (!id) {
    if (session.cat.at === slot && session.cat.mode !== "beside") session.cat.mode = "sit";
    return { lines: [line(`${slotLabel(slot)}を片付けた。`)], cat: { ...session.cat }, found: null };
  }
  session.focus = id;
  return reaction(session, { lines: [line(`置いた${itemName(id)}を、てつこが近づいて確かめている。`)], pose: "serious", at: slot, mode: "beside" });
}

/** 写真を一枚。今見えているしぐさがあればそれを、無ければ今の表情を残す。同じものは一枚だけ。 */
export function takePhoto(session) {
  const moment = session.moment ? MOMENTS.find(item => item.id === session.moment) : null;
  const id = moment ? moment.id : `pose:${session.cat.pose}`;
  const entry = { id, pose: session.cat.pose, caption: moment ? moment.name : POSE_CAPTIONS[session.cat.pose], label: session.dayLabel };
  const index = session.album.findIndex(item => item.id === id);
  if (index >= 0) { session.album[index] = entry; return { ok: true, entry, replaced: true }; }
  if (session.album.length >= ALBUM_LIMIT) return { ok: false, entry, full: true };
  session.album.push(entry);
  return { ok: true, entry, replaced: false };
}
export function removePhoto(session, id) {
  const before = session.album.length;
  session.album = session.album.filter(entry => entry.id !== id);
  return session.album.length !== before;
}

/** 帰る。気を許してくれていて、意味のあるふれあいの後なら、戸の前まで見送ってくれる。 */
export function leave(session) {
  if (session.stage >= 3 && session.meaningful && !session.seeOff) {
    session.seeOff = true;
    discover(session, "see_off");
  }
  return session.seeOff;
}

/** 画面から本編へ渡す結果（保存はまだ書かない） */
export function sessionResult(session) {
  return { key: session.key, meaningful: session.meaningful, day: session.day, layout: { ...session.layout },
    found: [...session.found], fresh: [...session.fresh], album: session.album.map(entry => ({ ...entry })),
    treatsUsed: session.treatsUsed, unpacked: session.arrivedCount, seeOff: session.seeOff };
}

/**
 * 本編の確定点（#2454 §10-4）。一つの同期処理の中で書く。
 * - 置いた小物・発見・アルバム・おやつ・荷ほどきの記録は、画面を開いて戻った時に残す（模様替えを失わない）。
 * - 回復と来訪の加算は、意味のあるふれあい（段階の会話を読んだ／主操作を一度でもした）の時だけ。
 *   同じ訪問キーでは二度目を付けない。回復の量だけ返し、体力は呼び出し側が同じ処理の中で足す。
 * 能力・経験値・火種・好感度・お金・日付・時間帯は変えない。
 * @returns {{ committed: boolean, stamina?: number, seeOff?: boolean, fresh?: string[] }}
 */
export function settleTetsukoTime(value, result) {
  if (!value?.flags || !record(result)) return { committed: false };
  const rec = tetsukoRecord(value);
  const day = Number.isInteger(result.day) ? result.day : value.day;
  const owned = ownedProps(rec, day);
  const found = [...new Set([...rec.found, ...(Array.isArray(result.found) ? result.found : [])].filter(id => MOMENT_IDS.has(id)))];
  // おやつは一日一本まで（同じ日の別の訪問でも二本目は付けない）
  const used = rec.treatDay === day ? 0 : Math.max(0, Math.min(Number.isInteger(result.treatsUsed) ? result.treatsUsed : 0, treatsLeft(rec, day), 1));
  const next = { ...rec,
    layout: normalizeLayout(record(result.layout) ? result.layout : rec.layout, owned),
    found,
    album: Array.isArray(result.album) ? tetsukoRecord({ flags: { [TETSUKO_TIME_FLAG]: { album: result.album } } }).album : rec.album,
    treatsUsed: rec.treatsUsed + used, treatDay: used ? day : rec.treatDay,
    unpacked: Math.max(rec.unpacked, Math.min(Number.isInteger(result.unpacked) ? result.unpacked : 0, arrivedOrders(rec, day).length)) };
  const grant = !!result.meaningful && typeof result.key === "string" && result.key !== rec.lastKey;
  if (grant) { next.lastKey = result.key; next.sessions = rec.sessions + 1; }
  const stored = value.flags[TETSUKO_TIME_FLAG];
  if (stored || JSON.stringify(next) !== JSON.stringify(tetsukoRecord({ flags: {} }))) value.flags[TETSUKO_TIME_FLAG] = next;
  if (!grant) return { committed: false };
  const counts = record(value.flags[OUTING_COUNT_FLAG]) || {};
  value.flags[OUTING_COUNT_FLAG] = { ...counts, tetsuko: tetsukoVisits(value) + 1 };
  return { committed: true, stamina: TETSUKO_STAMINA, seeOff: !!result.seeOff, fresh: Array.isArray(result.fresh) ? [...result.fresh] : [] };
}
