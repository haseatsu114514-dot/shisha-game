// 「てつこといっしょ / TETSUKO TIME」のモデル（#2454・Issue の実装計画 §4）。DOM・音・保存を持たない。
// 画面は tetsuko-time.js、本編との確定（回復・来訪・記録の保存）は tetsuko-time.js の settleTetsukoTime。
//
// ゆるさの約束（本文 §1・§4）: 点数・成績・失敗・時間制限は持たない。どの操作にも反応があり、
// 関係が下がる経路はない。世話をしない日の悪化もない。てつこは最後まで気まぐれな同じ猫で、絵は既存の5表情だけを使う。
//
// 関係の段階は新しい数値を作らず、既存の来訪記録（_ch3_outings.tetsuko）から導く（§3）。
// 乱数は通算日と来訪回数を種にして再現できる（Node のテストで固定）。
import { OUTINGS_FLAG, outingCounts } from "../chapters/ch3-outing-progress.js";

export const TETSUKO_TIME_FLAG = "_tetsuko_time";
export const RECORD_VERSION = 1;
export const ALBUM_LIMIT = 12;
export const PET_REST_STREAK = 6;   // なでるを6回続けると「今は、もういいらしい」。ほかの操作か、てつこが自分で動くと戻る
export const PLAY_PAW = 3;          // 猫じゃらしを3回振ると前足が出る（①）。その次のひと振りで飛びつく（様子見の段階は前足だけ）
export const PLAY_AUTO_CATCH = 5;   // 猫じゃらしを5回振ったら、てつこが必ず捕まえる（逃がし続ける勝負にしない）
export const DISCOVERY_BIAS = 0.7;  // 条件を満たした未発見のしぐさを優先する割合
// 自律行動の間隔。1回おきに落ち着く間を挟むので、見た目の変化はおよそ2倍の間隔（画面はその間に小さな身じろぎを入れる）。
export const AUTO_DELAY = Object.freeze({ min: 1700, max: 2400, reduced: 4000 });
export const MAIN_ACTIONS = Object.freeze(["pet", "play", "catch", "miss", "brush", "treat", "watch"]);
// ごきげん（§10）: ふれあうほどハートがたまり、いっぱいになると「とっておき」が見られる。減らない・持ち越さない。
export const JOY_MAX = 100;
export const JOY_HEARTS = 5;
export const JOY = Object.freeze({
  pet: 6, sweet: 12, shy: 3, look: 4, stalk: 5, paw: 8, catch: 14, miss: 8, brush: 7, bliss: 12, treat: 22, watch: 6,
  auto: 3, found: 8, wish: 10, invite: 5,
});
// なでる場所（広い範囲で分ける。しっぽだけは触らせてくれない）。今日のお気に入りは日によって変わる。
export const PET_ZONES = Object.freeze(["head", "chin", "back", "tail"]);
export const SWEET_ZONES = Object.freeze(["head", "chin", "back"]);
export const WISH_PATIENCE = 3;     // おねだりは、てつこが3回ほかのことをすると忘れる（叱らない・損もない）
export const WISH_REST = 4;         // 次のおねだりまでに挟む自律行動の拍数

// 気分（通算日で決まる。開き直しでは変わらない）。反応の出やすさだけを変え、どの気分でも全部の操作ができる。
export const MOODS = Object.freeze([
  { id: "calm", label: "今日は、のんびりしているみたいだ。" },
  { id: "sleepy", label: "今日は、少し眠そうだ。" },
  { id: "playful", label: "今日は、少し遊びたいみたいだ。" },
  // 段階0〜1ではまだ甘えないので、言い方を変える。
  { id: "clingy", label: "今日は、なんだか甘えたいみたいだ。", shyLabel: "今日は、こちらを気にしているみたいだ。" },
].map(Object.freeze));
export const STAGE_NAMES = Object.freeze(["まだ様子見", "顔なじみ", "待ってくれる", "気を許す"]);

// 小物を置く3つの枠。
export const SLOTS = Object.freeze(["bench", "floor", "bed"]);
export const SLOT_NAMES = Object.freeze({ bench: "ベンチ", floor: "床", bed: "寝床" });
// 小物（計画 §4）。専用通貨・買い直し・耐久はない。使っていない物も失わない。
export const PROPS = Object.freeze([
  { id: "box", name: "段ボール箱", slots: ["bench", "floor", "bed"], stage: 0, from: "店の段ボール箱" },
  { id: "ball", name: "ボール", slots: ["floor"], stage: 0, from: "店の奥で転がっていた" },
  { id: "cushion", name: "座布団", slots: ["bench", "bed"], stage: 1, from: "ムカイさんに借りた" },
  { id: "scratcher", name: "爪とぎ", slots: ["floor"], stage: 2, from: "店の奥で見つけた" },
  { id: "tunnel", name: "小さなトンネル", slots: ["floor"], stage: 2, met: "mashiro", from: "ましろちゃんが持ってきた" },
  { id: "bed", name: "猫ベッド", slots: ["bed"], stage: 3, from: "ムカイさんが買ってきた" },
].map(prop => Object.freeze({ ...prop, slots: Object.freeze(prop.slots) })));
const PROP = Object.fromEntries(PROPS.map(prop => [prop.id, prop]));

// しぐさ図鑑（12件・並びが図鑑の番号）。発見は自動で記録し、写真を撮らなくても失わない。
// face は図鑑・アルバムで見せる表情（既存の5表情のどれか）、art は届いたら使うしぐさの絵（tetsuko-art.js）。
// memo は手帳の「てつこメモ」（見つけた後に読める一言。地の文）。
export const MOMENTS = Object.freeze([
  { id: "first_paw", name: "はじめて前足が出た", hint: "猫じゃらしを、何度か振ってみると……", face: "surprise", art: "reach",
    memo: "最初は見ているだけ。三回目くらいで、前足が出る。" },
  { id: "hug_toy", name: "じゃらしを抱える", hint: "少し慣れてから、じゃらしを止めてみると……", face: "smile", art: "hug",
    memo: "じゃらしは、止まった瞬間に取りにくる。" },
  { id: "brush_bliss", name: "ブラシでうっとり", hint: "ブラシを借りられるようになったら……", face: "smile", art: "loaf",
    memo: "ブラシは背中から。途中でやめると、しっぽで続けろと言う。" },
  { id: "waiting", name: "こちらを待っていた", hint: "何度か通ううちに……", face: "normal", art: "lookback",
    memo: "戸の開く音を、もう覚えているらしい。" },
  { id: "first_rub", name: "初めてすりすり", hint: "すっかり気を許したら、なでてみると……", face: "smile", art: "rub",
    memo: "すねに頭をこすりつけるのが、てつこの挨拶。" },
  { id: "box_peek", name: "箱から顔だけ", hint: "箱があると……", face: "normal", art: null,
    memo: "箱があると、とりあえず入る。" },
  { id: "ball_watch", name: "ボールを見送る", hint: "床にボールがあると……", face: "surprise", art: "crouch",
    memo: "ボールは追わない。見送る派。" },
  { id: "paws_together", name: "前足をそろえる", hint: "そっと見守っていると……", face: "normal", art: null,
    memo: "隣に座ると、前足をそろえて座り直す。" },
  { id: "odd_sleep", name: "変な寝相", hint: "眠そうな日や、座布団の上だと……", face: "sleep", art: "belly",
    memo: "眠い日は、寝相がひどい。" },
  { id: "lap_nap", name: "膝で寝る", hint: "すっかり気を許したら、そっと見守ると……", face: "sleep", art: null,
    memo: "膝に乗ると、しばらく降りない。" },
  { id: "box_over_bed", name: "新しいベッドより箱", hint: "新しいベッドの近くに箱があると……", face: "normal", art: null,
    memo: "新しいベッドより、その箱。ムカイさんは少し寂しそうだった。" },
  { id: "see_off", name: "帰りの見送り", hint: "すっかり気を許したら、帰るときに……", face: "smile", art: "rub",
    memo: "帰りは、戸の前まで見送ってくれる。" },
].map(Object.freeze));
const MOMENT_IDS = MOMENTS.map(moment => moment.id);

/** 再現できる乱数（0〜1）。 */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 今日の気分（通算日から決まる・同じ日は何度開いても同じ）。 */
export function moodOf(day) {
  return MOODS[Math.floor(rng(Math.imul((Number(day) || 1) + 2454, 0x9E3779B1))() * MOODS.length)];
}
/** 今日のお気に入りの場所（通算日で決まる・同じ日は何度開いても同じ）。 */
export function sweetZoneOf(day) {
  return SWEET_ZONES[Math.floor(rng(Math.imul((Number(day) || 1) + 3181, 0x85EBCA6B))() * SWEET_ZONES.length)];
}
/** 状態の一行（「？」で読める）。段階0〜1の「甘えたい」は言い換える。 */
export const moodLabel = (mood, stage) => (stage <= 1 && mood.shyLabel) || mood.label;

/** これまでの来訪回数（「少し構っていく」と「てつこといっしょ」の共通記録）。 */
export const tetsukoVisits = value => Math.max(0, Math.floor(Number(outingCounts(value).tetsuko) || 0));
/**
 * 関係の段階（0 まだ様子見／1 顔なじみ／2 待ってくれる／3 気を許す）。読み終えた段階会話の数から導く:
 * 初回だけ→0、ブラシまで→1、待つまで→2、すり寄るまで（回数4以上）→3。
 */
export const relationStage = count => Math.min(3, Math.max(0, (Number(count) || 0) - 1));
/** 今回のふれあいの段階。回数が4未満なら入口で次の段階会話を読んでから来るので、その会話の分を含める。 */
export const sessionStage = count => relationStage((Number(count) || 0) + 1);

/** 保存の記録（無ければ既定）。旧セーブ・壊れた値でも入れる形に整える。読取のみ。 */
export function readTetsukoRecord(value) {
  const raw = value?.flags?.[TETSUKO_TIME_FLAG];
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const props = {};
  for (const slot of SLOTS) {
    const id = record.props?.[slot];
    props[slot] = PROP[id]?.slots.includes(slot) ? id : null;
  }
  // 同じ物が二か所にある壊れた記録は、先の枠だけ残す。
  const seen = new Set();
  for (const slot of SLOTS) { if (props[slot] && seen.has(props[slot])) props[slot] = null; else if (props[slot]) seen.add(props[slot]); }
  const found = MOMENT_IDS.filter(id => Array.isArray(record.found) && record.found.includes(id));
  const album = [];
  for (const entry of Array.isArray(record.album) ? record.album : []) {
    if (!MOMENT_IDS.includes(entry?.moment) || album.some(item => item.moment === entry.moment)) continue;
    album.push({ moment: entry.moment, day: Number(entry.day) || 0, props: cleanProps(entry.props) });
  }
  return {
    v: RECORD_VERSION, props, found, album: album.slice(0, ALBUM_LIMIT),
    treatDay: Number.isFinite(record.treatDay) ? record.treatDay : null,
    sessions: Math.max(0, Math.floor(Number(record.sessions) || 0)),
    // ごきげんがいっぱいになった通算の回数（手帳に出すだけ。報酬・解放の条件にしない）
    peaks: Math.max(0, Math.floor(Number(record.peaks) || 0)),
    lastKey: typeof record.lastKey === "string" ? record.lastKey : null,
  };
}
function cleanProps(props) {
  return Object.fromEntries(SLOTS.map(slot => [slot, PROP[props?.[slot]]?.slots.includes(slot) ? props[slot] : null]));
}

/** その小物が使えるか（段階・面識で増える。減らない）。 */
export const propUnlocked = (prop, stage, metMashiro) => !!prop && stage >= prop.stage && (!prop.met || !!metMashiro);
export const unlockedProps = (stage, metMashiro) => PROPS.filter(prop => propUnlocked(prop, stage, metMashiro));

/**
 * ふれあいの1回分の状態。保存には書かない（確定は settleTetsukoTime）。
 * @param {object} value 現在のセーブ（読むだけ）
 */
export function createSession(value, { visitKey = null } = {}) {
  const day = Number(value?.day) || 1;
  const count = tetsukoVisits(value);
  const stage = sessionStage(count);
  const metMashiro = !!value?.met?.mashiro;
  const metMukai = !!value?.met?.mukai_master;
  const record = readTetsukoRecord(value);
  const props = { ...record.props };
  for (const slot of SLOTS) if (props[slot] && !propUnlocked(PROP[props[slot]], stage, metMashiro)) props[slot] = null;
  const before = new Set(unlockedProps(count ? relationStage(count) : -1, metMashiro).map(prop => prop.id));
  return {
    day, count, stage, metMashiro, metMukai, visitKey,
    mood: moodOf(day).id,
    random: rng(day * 31 + count),
    timing: rng(day * 31 + count + 7),
    props,
    found: [...record.found],
    newFound: [],
    album: record.album.map(entry => ({ ...entry, props: { ...entry.props } })),
    treatDay: record.treatDay,
    // 今回の訪問で新しく使えるようになった小物（もようがえの「新」）
    newProps: unlockedProps(stage, metMashiro).filter(prop => !before.has(prop.id)).map(prop => prop.id),
    meaningful: false,
    // 画面に出ている猫: 居場所・姿勢・表情。今見えているしぐさ（写真に撮れる瞬間）
    cat: { spot: stage >= 3 ? "front" : "bench", pose: "sit", face: stage === 0 ? "serious" : "normal", flip: false, inside: null, art: null },
    moment: null,
    last: null, lastAuto: null, autoTicks: 0,
    petStreak: 0, swings: 0, watches: 0, brushes: 0, misses: 0,
    mashiroPassed: false, said: [],
    curiousProp: null,
    // ごきげん・今日のお気に入りの場所・おねだり（どれも保存しない。通算の回数だけ peaks として記録に足す）
    joy: 0, peaks: 0, peakReady: false, pastPeaks: record.peaks,
    sweet: sweetZoneOf(day), sweetFound: false,
    wish: null, wishAge: 0, nextWishTick: 1, lastWish: null, sessions: record.sessions,
  };
}

const prop = id => PROP[id] || null;
/** その小物が置いてある枠（無ければ null）。 */
export const slotOf = (session, id) => SLOTS.find(slot => session.props[slot] === id) || null;
const has = (session, id) => !!slotOf(session, id);

/** 小物を置く／片付ける（id=null）。同じ物は一か所だけ（別の枠へ置けば移る）。置けたら true。 */
export function placeProp(session, slot, id) {
  if (!SLOTS.includes(slot)) return false;
  if (id === null) {
    const removed = session.props[slot];
    session.props[slot] = null;
    if (session.curiousProp === removed) session.curiousProp = null;
    if (session.cat.inside === removed && removed) session.cat = { ...session.cat, inside: null, pose: "sit", spot: "floor", art: null };
    return true;
  }
  const item = prop(id);
  if (!item || !item.slots.includes(slot) || !propUnlocked(item, session.stage, session.metMashiro)) return false;
  for (const other of SLOTS) if (session.props[other] === id) session.props[other] = null;
  session.props[slot] = id;
  session.curiousProp = id;
  // 中に入っていた物が片付いたら、てつこは外へ出てくる。
  if (session.cat.inside && !has(session, session.cat.inside)) session.cat = { ...session.cat, inside: null, pose: "sit", spot: "floor", art: null };
  return true;
}

function discover(session, id) {
  if (!MOMENT_IDS.includes(id) || session.found.includes(id)) return null;
  session.found.push(id);
  session.newFound.push(id);
  return id;
}

/** たまっているハートの数（0〜JOY_HEARTS）。 */
export const joyHearts = session => Math.floor((session.joy / JOY_MAX) * JOY_HEARTS + 1e-9);
// ごきげんを足す（減らない）。いっぱいになったら peakReady（画面が peakReaction を呼ぶまで、それ以上は足さない）。
function gainJoy(session, amount) {
  const before = session.joy;
  const add = Math.max(0, Math.round(Number(amount) || 0));
  if (add && !session.peakReady) session.joy = Math.min(JOY_MAX, session.joy + add);
  const peak = !session.peakReady && session.joy >= JOY_MAX;
  if (peak) session.peakReady = true;
  return { gain: session.joy - before, value: session.joy, hearts: joyHearts(session), peak };
}
// おねだりに応えたか（じゃらしは振る・捕まえる・空振りのどれでも。物のおねだりは、置いた物をてつこが使った時）。
function grantWish(session, kind, usedProp) {
  const wish = session.wish;
  if (!wish) return false;
  const did = kind === "catch" || kind === "miss" ? "play" : kind;
  const ok = wish.kind === "decor" ? kind === "auto" && !!usedProp && (!wish.prop || wish.prop === usedProp) : wish.kind === did;
  if (!ok) return false;
  session.wish = null;
  session.wishAge = 0;
  session.nextWishTick = session.autoTicks + WISH_REST;
  return true;
}

/**
 * 反応を確定して画面用の形にする。moment は写真に撮れる瞬間、found は今回初めて見つけたしぐさ。
 * pop は猫のそばに出す短い擬音、joy は足すごきげん（見つけた時・おねだりに応えた時は上乗せ）。
 */
function react(session, kind, { text, face = "normal", pose = "sit", spot = session.cat.spot, fx = null, moment = null, inside = null, flip = false, line = null, art = null,
  pop = null, joy = 0, zone = null, sweet = false, pounce = false, usedProp = null }) {
  // art: しぐさの絵が届いていれば使う名前（tetsuko-art.js）。無ければ face と pose（CSS）で見せる。
  session.cat = { spot, pose, face, flip, inside, art };
  session.moment = moment;
  const found = moment ? discover(session, moment) : null;
  // 人物の一言は、名乗りを受けた相手だけ・その訪問で一度だけ（長い会話は挟まない）。
  const known = line && (line.speaker !== "mukai_master" || session.metMukai);
  const said = known && !session.said.includes(line.id) ? (session.said.push(line.id), line) : null;
  const granted = grantWish(session, kind, usedProp || inside);
  const gained = gainJoy(session, joy + (found ? JOY.found : 0) + (granted ? JOY.wish : 0));
  return { kind, text, face, pose, spot, fx, moment, found, art, pop, zone, sweet, pounce, granted, joy: gained,
    line: said ? { speaker: said.speaker, text: said.text } : null };
}

/** 画面を開いたとき（入口の段階会話の後）。段階2以上なら「こちらを待っていた」。 */
export function openingReaction(session) {
  if (session.stage >= 3) return react(session, "open", { text: "てつこが、すぐそばでこちらを見上げている。", spot: "front", moment: "waiting" });
  if (session.stage === 2) return react(session, "open", { text: "てつこが、ベンチの上からこちらを見ている。", spot: "bench", moment: "waiting" });
  if (session.stage === 1) return react(session, "open", { text: "てつこはベンチで丸くなったまま、しっぽの先だけ動かした。", face: "sleep", pose: "curl", spot: "bench" });
  return react(session, "open", { text: "てつこはベンチの上から、こちらを一度だけ見た。", face: "serious", spot: "bench" });
}

export const canBrush = session => session.stage >= 1;
export const canTreat = session => session.treatDay !== session.day;
export const toyOut = session => session.swings > 0;
/** その操作が今できるか（できない時はボタンを押せなくするだけ。叱らない）。 */
export function canAct(session, kind) {
  if (kind === "brush") return canBrush(session);
  if (kind === "treat") return canTreat(session);
  if (kind === "catch" || kind === "miss") return toyOut(session);
  return MAIN_ACTIONS.includes(kind);
}

/**
 * 主操作（なでる・じゃらし・捕まえる・空振り・ブラシ・おやつ・見守る）。できない操作は null（何も変えない）。
 * @param {{ zone?: string }} [opts] なでる場所（head / chin / back / tail。既定は頭）
 */
export function act(session, kind, opts = {}) {
  if (!canAct(session, kind)) return null;
  session.meaningful = true;
  session.petStreak = kind === "pet" ? session.petStreak + 1 : 0;
  if (kind !== "play" && kind !== "catch" && kind !== "miss") { session.swings = 0; session.misses = 0; }
  session.last = kind;
  return ACTIONS[kind](session, opts);
}

// なでた場所ごとの反応（顔なじみから。様子見の段階は、どこをなでてもされるがまま）。
const ZONE_TEXT = Object.freeze({
  head: "頭をなでると、てつこが目を細めた。",
  chin: "あごの下をかくと、首をのばしてきた。",
  back: "背中のほうまでなでると、しっぽがゆっくり揺れた。",
});

const ACTIONS = {
  pet(session, { zone = "head" } = {}) {
    const at = PET_ZONES.includes(zone) ? zone : "head";
    const away = session.cat.inside ? { spot: "floor" } : {};
    if (session.cat.pose === "lap")
      return react(session, "pet", { text: "膝の上で、低く喉を鳴らしている。", face: "sleep", pose: "lap", spot: "lap", fx: "heart", pop: "ごろごろ", joy: JOY.pet, zone: at });
    // しっぽだけは触らせてくれない（ぷいと向こうを向くだけ。関係は下がらない・続けた回数にも数えない）。
    if (at === "tail") {
      session.petStreak = Math.max(0, session.petStreak - 1);
      return react(session, "pet", { text: "しっぽは、だめらしい。ぷいと横を向いた。", face: "serious", flip: true, ...away, fx: "tail", pop: "ぷいっ", zone: at });
    }
    if (session.petStreak >= PET_REST_STREAK)
      return react(session, "pet", { text: "しっぽをぱたんと振った。今は、もういいらしい。", face: "serious", ...away, fx: "tail", pop: "ぱたん", zone: at });
    // 気を許した段階は、まずすり寄ってくる（⑤）。待ってくれる段階は、手に頭を寄せてくる。
    if (session.stage >= 3 && session.petStreak === 1)
      return react(session, "pet", { text: "てつこがすり寄ってきて、低く喉を鳴らした。", face: "smile", spot: "front", fx: "heart", moment: "first_rub", art: "rub",
        pop: "すりすり", joy: JOY.pet, zone: at });
    // 今日のお気に入りの場所（日によって変わる）。見つけると、喉が鳴りだす。
    if (at === session.sweet) {
      const first = !session.sweetFound;
      session.sweetFound = true;
      if (session.stage === 0)
        return react(session, "pet", { text: first ? "耳が、ぴくりと動いた。悪くはないらしい。" : "耳だけが、こちらを向いている。", ...away, pop: first ? "ぴくっ" : null,
          joy: JOY.pet, zone: at, sweet: true });
      return react(session, "pet", { text: first ? "そこが、今日のお気に入りらしい。喉が鳴りだした。" : session.stage >= 2 ? "もっと、と頭を押しつけてくる。" : "目を閉じて、じっと味わっている。",
        face: "smile", ...away, fx: "heart", pop: "ごろごろ", joy: JOY.sweet, zone: at, sweet: true });
    }
    if (session.stage === 0) return react(session, "pet", { text: "てつこは目を閉じて、されるがままになっている。", face: "serious", ...away, joy: JOY.shy, zone: at });
    if (session.stage === 2 && session.petStreak === 1)
      return react(session, "pet", { text: "てつこが、手のひらに頭を寄せてきた。", face: "smile", ...away, fx: "heart", joy: JOY.pet, zone: at });
    return react(session, "pet", { text: ZONE_TEXT[at], face: "smile", ...away, fx: "heart", joy: JOY.pet, zone: at });
  },
  // 猫じゃらし: 見る→狙う→前足（①）→飛びつく。飛びついた先にじゃらしがあれば捕まえ（catch）、引いていれば空振り（miss）。
  // どちらも遊びのうち。5回目は必ず捕まえる。様子見の段階は飛びつかず、その場で前足を出す。
  play(session) {
    session.swings += 1;
    if (session.swings >= PLAY_AUTO_CATCH) return ACTIONS.catch(session);
    if (session.swings === 1) return react(session, "play", { text: "てつこの目が、じゃらしの先を追った。", spot: "floor", fx: "toy", joy: JOY.look });
    if (session.swings === 2) return react(session, "play", { text: "てつこが身を低くした。狙っている。", face: "serious", pose: "low", spot: "floor", fx: "toy", art: "crouch", pop: "じりっ", joy: JOY.stalk });
    if (session.swings === PLAY_PAW) return react(session, "play", { text: "前足が、さっと伸びた。", face: "surprise", pose: "paw", spot: "floor", fx: "toy", moment: "first_paw", art: "reach", pop: "ぺしっ", joy: JOY.paw });
    if (session.stage === 0) return react(session, "play", { text: "もう一度、前足が伸びた。", face: "serious", pose: "paw", spot: "floor", fx: "toy", art: "reach", pop: "ぺしっ", joy: JOY.look });
    return react(session, "play", { text: "てつこが、じゃらしに飛びついた。", face: "surprise", pose: "paw", spot: "floor", fx: "toy", art: "leap", pop: "ばっ", joy: JOY.look, pounce: true });
  },
  catch(session) {
    session.swings = 0;
    session.misses = 0;
    if (session.stage === 0)
      return react(session, "catch", { text: "てつこが前足で押さえて、すぐに離した。", face: "serious", spot: "floor", fx: "toy", pop: "ぺたっ", joy: JOY.paw });
    return react(session, "catch", { text: "てつこが、じゃらしを抱えこんで離さない。", face: "smile", pose: "hug", spot: "floor", fx: "toy-held", moment: "hug_toy", art: "hug",
      pop: "がしっ", joy: JOY.catch });
  },
  // 空振り（飛びついた先に、じゃらしがもう無かった）。てつこの負けではなく、遊びの一コマ。2回続いたら、次は必ず捕まえる。
  miss(session) {
    session.misses += 1;
    const again = session.misses >= 2;
    if (!again) session.swings = PLAY_PAW;
    return react(session, "miss", { text: again ? "また空振り。しっぽが、ぶんと揺れた。" : "空振り。てつこは、何事もなかった顔をしている。", face: again ? "serious" : "surprise",
      spot: "floor", fx: "toy", pop: "すかっ", joy: JOY.miss, art: "flop" });
  },
  brush(session) {
    session.brushes += 1;
    const spot = session.cat.inside || session.cat.spot === "lap" ? "bench" : session.cat.spot;
    if (session.brushes === 1)
      return react(session, "brush", { text: "背中にブラシを当てる。てつこの体から、力が抜けていく。", face: "smile", pose: "melt", spot, fx: "fur", moment: "brush_bliss", pop: "ふにゃ", joy: JOY.bliss });
    if (session.brushes % 2 === 0)
      return react(session, "brush", { text: "ブラシを止めると、前足が手を追ってきた。", face: "normal", pose: "paw", spot, fx: "fur", art: "reach", pop: "ちょい", joy: JOY.brush });
    return react(session, "brush", { text: "ブラシのたびに、てつこが少しずつ平たくなる。", face: "smile", pose: "melt", spot, fx: "fur", pop: "ふにゃ", joy: JOY.brush });
  },
  // 一日一回の小さな楽しみ（店の人が用意した猫用のおやつ）。なくても関係は進む。
  // steps は画面が順に見せる途中の様子（匂いを確かめる→食べる）。最後が反応の本体（顔を洗う）。
  treat(session) {
    session.treatDay = session.day;
    const steps = [
      { text: "猫用のおやつを、小皿に少しだけ出す。", face: "normal", pose: "sit", spot: session.cat.inside ? "bench" : session.cat.spot, fx: "treat", pop: "！" },
      { text: "てつこが近づいてきて、匂いを確かめている。", face: "serious", pose: "low", spot: "floor", fx: "treat", art: "crouch", pop: "くんくん" },
      { text: "てつこは、ゆっくり食べはじめた。", face: "smile", pose: "low", spot: "floor", fx: "treat", art: "crouch", pop: "かりかり" },
    ];
    return { ...react(session, "treat", { text: "食べ終わると、前足で顔を洗いはじめた。", face: "smile", spot: "floor", fx: "treat-done", art: "groom", pop: "ぺろぺろ", joy: JOY.treat }), steps };
  },
  // 何もしないで隣にいる（画面は、しばらく触らずにいると自動でこれを呼ぶ）。触るより劣る選択にしない。
  watch(session) {
    session.watches += 1;
    const mood = session.mood;
    if (session.stage >= 3 && (session.watches >= 2 || mood === "clingy")) {
      if (session.cat.pose === "lap") return react(session, "watch", { text: "膝の上で、てつこが寝息を立てている。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap", fx: "zzz", joy: JOY.watch });
      return react(session, "watch", { text: "隣に座ると、てつこが膝に乗ってきた。そのまま丸くなる。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap", pop: "ごろごろ", joy: JOY.watch,
        line: { id: "lap", speaker: "mukai_master", text: "……起こすなよ" } });
    }
    if (session.watches === 1)
      return react(session, "watch", { text: "隣に座ると、てつこが前足をそろえて座り直した。", spot: session.cat.inside ? "bench" : session.cat.spot, moment: "paws_together", joy: JOY.watch });
    return autonomous(session, { force: true });
  },
};

// 自律行動（画面を開いている間だけ・閉じている間は進めない）。when が真の物から引く。
// weight は気分で変える（{ 気分: 倍率 }）。moment があれば図鑑のしぐさ。pop は猫のそばに出す短い擬音。
const AUTO = [
  { id: "yawn", when: () => true, weight: { calm: 1.4, sleepy: 1.6 },
    react: s => ({ text: "てつこが大きなあくびをした。", face: "surprise", art: "yawn", pop: "ふわぁ" }) },
  { id: "groom", when: () => true, weight: { calm: 1.4 },
    react: s => ({ text: "てつこが前足をなめて、顔を洗っている。", face: "smile", art: "groom", pop: "ぺろぺろ" }) },
  { id: "lean", when: () => true, weight: { calm: 1.2 },
    react: s => ({ text: "てつこが壁にもたれて、どっしり座りこんだ。", face: "serious", spot: "bench", art: "loaf" }) },
  { id: "door", when: () => true, weight: { clingy: 1.4 },
    react: s => ({ text: "てつこが、裏口の戸のほうを見ている。", flip: true, art: "lookback" }) },
  { id: "tail", when: () => true, weight: { playful: 1.2 },
    react: s => ({ text: "しっぽの先が、ゆっくり揺れている。", fx: "tail", pop: "ぱたぱた" }) },
  { id: "stretch", when: () => true, weight: { calm: 1.2, sleepy: 1.2 },
    react: s => ({ text: "てつこが、前足をぐーっと伸ばした。", pose: "stretch", art: "stretch", pop: "ぐーっ" }) },
  { id: "stare", when: s => s.stage <= 1, weight: { calm: 1.2 },
    react: s => ({ text: "てつこが、横目でこちらを見ている。", face: "serious", pop: "じー" }) },
  { id: "mew", when: s => s.stage >= 1, weight: { clingy: 1.8, playful: 1.4 },
    react: s => ({ text: "てつこが、こちらを見て短く鳴いた。", face: "surprise", fx: "mew", pop: "にゃ", art: "mew" }) },
  { id: "poke", when: s => s.stage >= 2, weight: { clingy: 1.8, playful: 1.6 },
    react: s => ({ text: "てつこが、前足でちょんとつついてきた。", pose: "paw", spot: "front", fx: "poke", art: "poke", pop: "ちょん" }) },
  { id: "doze", when: s => s.mood === "sleepy", weight: { sleepy: 2 },
    react: s => ({ text: "てつこがうとうとしている。", face: "sleep", pose: "curl", fx: "zzz" }) },
  { id: "come", when: s => s.stage >= 2, weight: { clingy: 2 },
    react: s => ({ text: "てつこが、すぐ近くまで来て座った。", spot: "front" }) },
  { id: "box_in", when: s => has(s, "box"), weight: { playful: 1.4 },
    react: s => ({ text: "てつこが箱に入って、すっぽり収まった。", spot: slotOf(s, "box"), pose: "box", inside: "box", pop: "すぽっ" }) },
  { id: "box_peek", when: s => has(s, "box"), moment: "box_peek", weight: { playful: 1.2 },
    react: s => ({ text: "箱のふちから、顔だけ出している。", spot: slotOf(s, "box"), pose: "peek", inside: "box", pop: "ひょこっ" }) },
  { id: "ball_paw", when: s => has(s, "ball"), weight: { playful: 1.6 },
    react: s => ({ text: "前足で、ボールをちょいと転がした。", face: "serious", pose: "paw", spot: "floor", inside: "ball", fx: "ball-roll", art: "reach", pop: "ちょい" }) },
  { id: "ball_watch", when: s => has(s, "ball"), moment: "ball_watch", weight: { playful: 1.2 },
    react: s => ({ text: "転がっていくボールを、目だけで見送った。", face: "surprise", spot: "floor", inside: "ball", fx: "ball-away", pop: "……" }) },
  { id: "scratch", when: s => has(s, "scratcher"), weight: { playful: 1.4 },
    react: s => ({ text: "てつこが爪とぎで、がりがりと爪をといでいる。", face: "serious", pose: "paw", spot: "floor", inside: "scratcher", fx: "scratch", art: "stretch", pop: "ばりばり" }) },
  { id: "cushion", when: s => has(s, "cushion"), weight: { sleepy: 1.6, calm: 1.2 },
    react: s => ({ text: "座布団の上で、てつこが丸くなった。", face: "sleep", pose: "curl", spot: slotOf(s, "cushion"), inside: "cushion", fx: "zzz" }) },
  { id: "bed_sleep", when: s => has(s, "bed"), weight: { sleepy: 1.6 },
    react: s => ({ text: "てつこが猫ベッドで丸くなった。", face: "sleep", pose: "curl", spot: "bed", inside: "bed", fx: "zzz" }) },
  { id: "odd_sleep", when: s => s.stage >= 1 && (s.mood === "sleepy" || has(s, "cushion") || has(s, "bed")), moment: "odd_sleep", weight: { sleepy: 1.6 },
    react: s => {
      const on = has(s, "bed") ? "bed" : has(s, "cushion") ? "cushion" : null;
      return { text: "ひっくり返ったような格好で、てつこが寝ている。", face: "sleep", pose: "odd", spot: on ? slotOf(s, on) : "bench", inside: on, art: "belly", fx: "zzz", pop: "ぐでー" };
    } },
  { id: "box_over_bed", when: s => has(s, "bed") && has(s, "box"), moment: "box_over_bed", weight: {},
    react: s => ({ text: "新しいベッドには見向きもせず、てつこは箱に入った。", spot: slotOf(s, "box"), pose: "box", inside: "box", pop: "すぽっ",
      line: { id: "box_over_bed", speaker: "mukai_master", text: "……そっちか" } }) },
  { id: "tunnel", when: s => has(s, "tunnel"), weight: { playful: 1.4 },
    react: s => ({ text: "トンネルから、しっぽだけが出ている。", spot: "floor", pose: "tunnel", inside: "tunnel", pop: "ごそごそ" }) },
  { id: "mashiro", when: s => s.metMashiro && s.stage >= 1 && !s.mashiroPassed, weight: { calm: 0.6, sleepy: 0.6, playful: 0.6, clingy: 0.6 },
    react: s => { s.mashiroPassed = true; return { text: "戸の向こうを、ましろちゃんが通った。てつこの耳が、すぐそっちを向く。", face: "surprise", flip: true, art: "lookback", pop: "！" }; } },
];
export const AUTO_IDS = Object.freeze(AUTO.map(item => item.id));

// ---- おねだり: てつこのほうから「これがいい」を見せる（頭の上の吹き出し。文字ではなくアイコン）。
// まだ見つけていないしぐさへの手がかりを優先し、全部見つけた後は気分で決める。応えなくても損はなく、しばらくすると忘れる。
const WISH_TEXT = Object.freeze({
  pet: "てつこが、こちらを見上げて待っている。",
  play: "てつこが、じゃらしのほうをじっと見ている。",
  brush: "てつこが、背中をこちらへ向けた。",
  treat: "てつこが、小皿のあたりを気にしている。",
  watch: "てつこが、隣を空けて座っている。",
  decor: "てつこが、何もない床を前足でつついている。",
});
const WISH_POOL = Object.freeze({
  calm: ["pet", "watch", "play", "brush"], sleepy: ["watch", "pet", "brush", "play"],
  playful: ["play", "pet", "brush", "watch"], clingy: ["pet", "brush", "play", "watch"],
});
const wishOk = (session, kind) => kind === "decor" || kind === "watch" || kind === "play" ? true
  : kind === "pet" ? session.stage >= 1 : canAct(session, kind);
function pickWish(session) {
  const guide = discoveryGuide(session, session.focus);
  const fromGuide = guide.id ? { kind: guide.kind === "catch" ? "play" : guide.kind, prop: guide.prop || null, moment: guide.id } : null;
  if (fromGuide && wishOk(session, fromGuide.kind) && (fromGuide.kind !== session.lastWish || session.focus === guide.id)) return fromGuide;
  const pool = (WISH_POOL[session.mood] || WISH_POOL.calm).filter(kind => wishOk(session, kind) && kind !== session.lastWish);
  if (canTreat(session) && session.lastWish !== "treat" && session.random() < 0.2) return { kind: "treat", prop: null, moment: null };
  const kind = pool[Math.floor(session.random() * Math.min(2, pool.length))] || fromGuide?.kind || "watch";
  return { kind, prop: null, moment: null };
}
// おねだりは、てつこの居場所を変えない（箱の中からでも、写真を撮れるしぐさのままでも出せる）。
// keep: 今の姿（表情・しぐさ）をそのまま保つ（見つけたばかりのしぐさを、写真に撮れるように）。
function ask(session, { keep = false } = {}) {
  const wish = pickWish(session);
  session.wish = wish;
  session.wishAge = 0;
  session.lastWish = wish.kind;
  session.lastAuto = "ask";
  const cat = session.cat;
  const settled = ["sit", "box", "peek"].includes(cat.pose) ? cat.pose : "sit";
  // 箱の中・寝ている時以外は、鳴いてねだる（しぐさの絵 mew。無ければ表情の絵）。
  const meow = !cat.inside && wish.kind !== "watch" ? { art: "mew" } : {};
  const look = { play: { face: "serious", ...meow }, brush: { flip: true }, decor: { face: "serious", pose: cat.inside ? settled : "paw" }, treat: { face: "surprise", ...meow }, pet: meow }[wish.kind] || {};
  const shape = keep ? { ...cat, moment: session.moment } : { spot: cat.spot, inside: cat.inside, pose: settled, ...look };
  const reaction = react(session, "auto", { text: WISH_TEXT[wish.kind], pop: wish.kind === "watch" ? null : "にゃ", ...shape });
  return { ...reaction, id: "ask", wish: { ...wish } };
}
/** 手帳で選んだ「このしぐさを探す」。次のおねだりが、そのしぐさの手がかりになる。 */
export function seekMoment(session, id) {
  session.focus = MOMENT_IDS.includes(id) ? id : null;
  session.wish = null;
  session.lastWish = null;
  session.nextWishTick = session.autoTicks;
}

/**
 * 自律行動を一つ（画面のタイマーから呼ぶ）。1回おきに「座って落ち着く」待機（quiet: 見た目を変えない）を挟む。
 * 直前と同じ行動は引かない。条件を満たした未発見のしぐさを DISCOVERY_BIAS の割合で優先する。
 * @param {{ force?: boolean, idle?: boolean, holding?: boolean }} [opts] force: 待機を挟まずに必ず行動を引く（見守る・物で誘うから呼ぶ）／
 *   idle: しばらく触らずに眺めている（＝隣で見守っている。時々、見守った時の反応になる）／
 *   holding: 見つけたばかりのしぐさを写真に撮れるよう、姿を保っている（おねだりだけは出す）
 */
export function autonomous(session, { force = false, idle = false, holding = false } = {}) {
  session.autoTicks += 1;
  if (!force && !session.curiousProp && session.autoTicks % 2 === 0) return { kind: "auto", id: "settle", quiet: true };
  // 寝ている・トンネルの中・膝の上では、おねだりをしない。
  const canAsk = !force && !session.curiousProp && !session.wish && session.autoTicks >= session.nextWishTick
    && session.cat.face !== "sleep" && session.cat.pose !== "tunnel" && session.cat.pose !== "lap";
  if (holding && !force) return canAsk ? ask(session, { keep: true }) : { kind: "auto", id: "settle", quiet: true };
  // 膝の上では、しばらくそのまま寝ている（すぐ降りない。ほかの遊びを始めれば降りる）。
  if (!force && session.cat.pose === "lap" && (session.lapTicks = (session.lapTicks || 0) + 1) <= 5) {
    const id = session.lastAuto === "lap_doze" ? "lap_purr" : "lap_doze";
    session.lastAuto = id;
    return { ...react(session, "auto", id === "lap_doze"
      ? { text: "膝の上で、てつこが寝息を立てている。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap", fx: "zzz", joy: JOY.auto }
      : { text: "膝の上が、じんわり温かい。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap", pop: "ごろごろ", joy: JOY.auto }), id };
  }
  if (session.cat.pose !== "lap") session.lapTicks = 0;
  // 眺めているだけの時は、時々「隣で見守る」の反応になる（見守る＝操作と同じ扱い）。
  if (!force && idle && !session.curiousProp && session.autoTicks >= (session.nextWatchTick || 0)) {
    session.nextWatchTick = session.autoTicks + 6;
    return { ...act(session, "watch"), watched: true };
  }
  // おねだりは、しばらく応えないと忘れる。忘れた後・応えた後は、少し間をあけてから次を出す。
  let forgot = false;
  if (session.wish && (session.wishAge += 1) > WISH_PATIENCE) {
    session.wish = null;
    session.nextWishTick = session.autoTicks + WISH_REST;
    forgot = true;
  }
  if (canAsk && !forgot) return ask(session);
  const pool = AUTO.filter(item => item.id !== session.lastAuto && item.when(session));
  const fresh = pool.filter(item => item.moment && !session.found.includes(item.moment));
  const from = fresh.length && session.random() < DISCOVERY_BIAS ? fresh : pool;
  // 置いた物にはまず気づく。ランダム待ちだけでなく、模様替えが遊びにつながる。物をタップして誘った時は、同じ反応を続けない。
  const curious = { box: "box_peek", ball: "ball_watch", cushion: "cushion", scratcher: "scratch", tunnel: "tunnel", bed: has(session, "box") ? "box_over_bed" : "bed_sleep" };
  const other = { box_peek: "box_in", box_in: "box_peek", ball_watch: "ball_paw", ball_paw: "ball_watch", box_over_bed: "bed_sleep" };
  const usedProp = session.curiousProp;
  let wanted = usedProp ? curious[usedProp] : null;
  if (wanted && session.lastAuto === wanted && other[wanted]) wanted = other[wanted];
  const invited = wanted && AUTO.find(item => item.id === wanted && item.when(session));
  session.curiousProp = null;
  const item = invited || weighted(from, session);
  session.lastAuto = item.id;
  // てつこが自分で動いたら、なで過ぎの「もういい」は解ける。
  session.petStreak = 0;
  const shape = item.react(session);
  const reaction = react(session, "auto", { spot: shape.spot || restingSpot(session), ...shape, moment: item.moment || null, joy: JOY.auto, usedProp: invited ? usedProp : null });
  // 自分の目でしぐさを見届けたら、見守ったのと同じ（何もせず帰っただけ、にはしない）。
  if (reaction.found) session.meaningful = true;
  // 寝てしまったら、出していたおねだりは引っこめる（寝顔の上に吹き出しを残さない）。
  if (session.wish && (session.cat.face === "sleep" || session.cat.pose === "tunnel")) {
    session.wish = null;
    session.nextWishTick = session.autoTicks + WISH_REST;
    forgot = true;
  }
  return { ...reaction, id: item.id, forgot };
}
// 箱・トンネルの中から別の行動に移るときは外へ出る。
function restingSpot(session) {
  const spot = session.cat.spot;
  return session.cat.inside || spot === "lap" ? (session.stage >= 3 ? "front" : "bench") : spot;
}
function weighted(items, session) {
  const weights = items.map(item => item.weight?.[session.mood] ?? 1);
  let roll = session.random() * weights.reduce((sum, w) => sum + w, 0);
  for (const [index, item] of items.entries()) { roll -= weights[index]; if (roll < 0) return item; }
  return items[items.length - 1];
}

/**
 * 置いてある物をタップして、てつこを誘う（箱なら入る・顔を出す、ボールなら転がす・見送る）。一緒に遊んだことになる。
 * @returns {object|null} 反応。置いていない物は null
 */
export function invite(session, id) {
  if (!has(session, id)) return null;
  session.meaningful = true;
  session.petStreak = 0;
  session.swings = 0;
  session.misses = 0;
  session.last = "invite";
  session.curiousProp = id;
  const reaction = autonomous(session, { force: true });
  const more = gainJoy(session, JOY.invite);
  return { ...reaction, invited: id, joy: { ...more, gain: reaction.joy.gain + more.gain, peak: reaction.joy.peak || more.peak } };
}

/**
 * ごきげんがいっぱいになった時の「とっておき」（段階ごと）。ハートは空に戻り、またためられる。
 * @returns {object|null} 反応（peak: true）。まだいっぱいでなければ null
 */
export function peakReaction(session) {
  if (!session.peakReady) return null;
  session.peakReady = false;
  session.joy = 0;
  session.peaks += 1;
  session.meaningful = true;
  let shape;
  if (session.stage >= 3) {
    shape = session.cat.pose === "lap" || session.peaks % 2 === 0
      ? { text: "てつこが、何度も頭をこすりつけてくる。", face: "smile", spot: "front", moment: "first_rub", art: "rub", pop: "すりすり" }
      : { text: "てつこが膝に乗ってきた。そのまま丸くなる。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap", pop: "ごろごろ",
        line: { id: "lap", speaker: "mukai_master", text: "……起こすなよ" } };
  } else if (session.stage === 2) shape = { text: "てつこが、手のひらに頭をぶつけてきた。", face: "smile", spot: "front", pop: "ごつん" };
  else if (session.stage === 1) shape = { text: "てつこが、指先の匂いをたしかめに来た。", spot: "front", pop: "くんくん" };
  else shape = { text: "てつこが、ゆっくりまばたきを返した。", face: "smile", pop: "……" };
  session.lapTicks = 0;
  // 満足したので、出していたおねだりは引っこめる（しばらくは次を出さない）。
  session.wish = null;
  session.nextWishTick = session.autoTicks + WISH_REST * 2;
  const reaction = react(session, "peak", { fx: "peak", ...shape });
  return { ...reaction, peak: true, peaks: session.peaks };
}

/** 次の自律行動までの待ち時間（ミリ秒）。動きを減らす設定では長めの一定間隔。 */
export function autoDelay(session, { reduced = false } = {}) {
  return reduced ? AUTO_DELAY.reduced : Math.round(AUTO_DELAY.min + session.timing() * (AUTO_DELAY.max - AUTO_DELAY.min));
}

/** 写真: 今見えているしぐさをアルバムに残す（同じしぐさは1件・撮り直すと新しい方）。撮れたら true。 */
export function takePhoto(session) {
  const moment = session.moment;
  if (!MOMENT_IDS.includes(moment)) return false;
  const entry = { moment, day: session.day, props: { ...session.props } };
  const index = session.album.findIndex(item => item.moment === moment);
  if (index >= 0) session.album[index] = entry;
  else if (session.album.length < ALBUM_LIMIT) session.album.push(entry);
  else return false;
  return true;
}

/** 帰るとき。気を許した段階で、ふれあいの後なら見送ってくれる（図鑑⑫）。 */
export function farewell(session) {
  if (session.stage < 3 || !session.meaningful) return null;
  return react(session, "leave", { text: "帰ろうとすると、てつこが戸の前までついてきた。", face: "smile", spot: "front", moment: "see_off", art: "rub", pop: "にゃ" });
}

/** 確定に渡す結果（settleTetsukoTime の result）。 */
export function sessionResult(session) {
  return {
    meaningful: !!session.meaningful,
    visitKey: session.visitKey,
    props: { ...session.props },
    found: [...session.found],
    newFound: [...session.newFound],
    album: session.album.map(entry => ({ ...entry, props: { ...entry.props } })),
    treatDay: session.treatDay,
    peaks: session.peaks,
  };
}

/** 未発見のしぐさの一言ヒント（図鑑）。 */
export const momentHint = id => MOMENTS.find(moment => moment.id === id)?.hint || "";
export const propById = id => PROP[id] || null;
export const momentById = id => MOMENTS.find(moment => moment.id === id) || null;
export { OUTINGS_FLAG };

/**
 * 今できる小さな発見。能力・得点を増やさず「試す→反応→写真」の手がかりだけを返す。
 * kind は、おねだりの吹き出しに出す道具（play / brush / pet / watch＝何もせず待つ / decor＝もようがえ）。text は読み上げ用の一言。
 */
export function discoveryGuide(session, preferred = null) {
  const resting = session.mood === "sleepy" || has(session, "cushion") || has(session, "bed");
  const guides = [
    { id: "first_paw", kind: "play", text: session.swings < 2 ? "じゃらしを振ると、目で追って……" : "狙っている。もうひと振り。" },
    { id: "hug_toy", when: session.stage >= 1, kind: "play", text: toyOut(session) ? "じゃらしを止めて、捕まえさせてみよう。" : "じゃらしを振ってから、止めてみよう。" },
    { id: "brush_bliss", when: canBrush(session), kind: "brush", text: "ブラシで、背中をゆっくり。" },
    { id: "paws_together", when: session.watches === 0 && !(session.stage >= 3 && session.mood === "clingy"), kind: "watch", text: "何もしないで、少し待ってみよう。" },
    { id: "box_peek", kind: has(session, "box") ? "watch" : "decor", prop: "box", text: has(session, "box") ? "箱のそばで、少し待ってみよう。" : "もようがえで箱を置いてみよう。" },
    { id: "ball_watch", kind: has(session, "ball") ? "watch" : "decor", prop: "ball", text: has(session, "ball") ? "ボールをどうするか、待ってみよう。" : "もようがえで床にボールを置こう。" },
    { id: "first_rub", when: session.stage >= 3, kind: "pet", text: "近くに来たら、そっとなでてみよう。" },
    { id: "lap_nap", when: session.stage >= 3, kind: "watch", text: "隣で、もう少し待ってみよう。" },
    { id: "odd_sleep", when: session.stage >= 1, kind: resting ? "watch" : "decor", prop: "cushion", text: resting ? "眠れる場所で、ゆっくり待ってみよう。" : "座布団を置いて、くつろげる場所に。" },
    { id: "box_over_bed", when: session.stage >= 3, kind: has(session, "box") && has(session, "bed") ? "watch" : "decor", text: has(session, "box") && has(session, "bed") ? "箱とベッド、どちらが好きかな。" : "箱と猫ベッドを、両方置いてみよう。" },
  ].filter(item => item.when !== false && !session.found.includes(item.id));
  const pick = guides.find(item => item.id === preferred) || guides[0];
  if (!pick) return { id: null, kind: "watch", text: "今日は一緒に、のんびり。手帳はいつでも読める。" };
  return { ...pick, name: momentById(pick.id).name };
}
