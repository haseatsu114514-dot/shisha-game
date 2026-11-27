// 「てつこといっしょ / TETSUKO TIME」のモデル（#2454・Issue の実装計画 §4）。DOM・音・保存を持たない。
// 画面は tetsuko-time.js、本編との確定（回復・来訪・記録の保存）は tetsuko-time.js の settleTetsukoTime。
//
// ゆるさの約束（本文 §1・§4）: 点数・成績・時間制限は持たない。どの操作にも反応があり、
// 関係（なかよし・来訪の段階）が下がる経路はない。世話をしない日の悪化もない。てつこは最後まで気まぐれな同じ猫。
// ハートは2つの物に分けた（2026-11-27 オーナー要望・docs/spec/tetsuko_time.md §12）:
// ・ごきげん（画面のハート5つ。session.joy）: その日だけの物。ふれあいで上がり、嫌がることを続けると少し下がる（先に必ずしぐさで知らせる）。
//   枠いっぱいまで溜まると「とっておき」を見せる。その後も、付き合ってくれる回数（VISIT_TURNS）が残っていれば続けられる
//   （ごきげんが良い間だけの、写真・すり寄る・膝に乗る、を楽しむ時間）。回数を使い切ると「今日はこれぐらいにしておこう。」と切り上げる。
// ・なかよし（肉球5つ。_tetsuko_time.affection）: 来訪をまたいで溜まる。帰る時のハートの数で伸び方が変わる（BOND_GAIN）。減らない。
//   段が上がると、来た時のごきげんが高くなり、付き合ってくれる回数が増え、節目でおみやげ（BOND_GIFTS）を置いていく。
//
// 関係の段階は新しい数値を作らず、既存の来訪記録（_ch3_outings.tetsuko）から導く（§3）。
// 乱数は通算日と来訪回数を種にして再現できる（Node のテストで固定）。
import { OUTINGS_FLAG, outingCounts } from "../chapters/ch3-outing-progress.js";

export const TETSUKO_TIME_FLAG = "_tetsuko_time";
export const RECORD_VERSION = 1;
export const ALBUM_LIMIT = 12;
export const PET_REST_STREAK = 4;   // なでるを4回続けると「今は、もういいらしい」。ほかの操作か、てつこが自分で動くと戻る
export const PLAY_PAW = 3;          // 猫じゃらしを3回振ると前足が出る（①）。その次のひと振りで飛びつく（様子見の段階は前足だけ）
export const PLAY_AUTO_CATCH = 5;   // 猫じゃらしを5回振ったら、てつこが必ず捕まえる（逃がし続ける勝負にしない）
export const DISCOVERY_BIAS = 0.7;  // 条件を満たした未発見のしぐさを優先する割合
// 自律行動の間隔。1回おきに落ち着く間を挟むので、見た目の変化はおよそ2倍の間隔（画面はその間に小さな身じろぎを入れる）。
export const AUTO_DELAY = Object.freeze({ min: 1700, max: 2400, reduced: 4000 });
export const MAIN_ACTIONS = Object.freeze(["pet", "play", "catch", "miss", "brush", "treat", "watch"]);
// ごきげん（その日のハート）と、なかよし（来訪をまたぐ積み上げ）の調整値（測り直しは tools/balance/tetsuko_hearts.mjs）。
export const JOY_MAX = 100;
export const JOY_HEARTS = 5;
export const JOY_UNIT = 4;            // 手応え1つ分のごきげん（ハート1/5）
export const JOY_START = 10;          // 来た時のごきげん（ハート半分）。なかよしの段と気分で上下する
export const JOY_START_PER_LEVEL = 4; // なかよし1段ごとに、来た時のごきげんへ足す量
export const VISIT_JOY = 10;          // 1回の来訪で伸びるなかよしの上限（ハート5つで帰った日）
export const BOND_GAIN = Object.freeze([2, 3, 5, 7, 9, 10]); // 帰る時のハートの数（0〜5）→ なかよしの伸び
export const BOND_STEP = 20;          // なかよしの1段（肉球1つ）。5段で JOY_MAX
// ハートの枠: なかよしが0段の時は3つまで。1段で4つ、2段で5つ（なかよしになるほど、ごきげんが大きく伸びる）。
// 枠がいっぱいになった時に、その日の「とっておき」を見せる（切り上げにはしない）。
export const HEART_CAP_BASE = 3;
/** その段でたまるハートの数（3〜JOY_HEARTS）。 */
export const heartCap = level => Math.max(1, Math.min(JOY_HEARTS, HEART_CAP_BASE + Math.max(0, Math.floor(Number(level) || 0))));
// 付き合ってくれる回数（1回の来訪でできるやりとり）。なかよしが2段・4段で1回ずつ増える（BOND_TURN_LEVELS）。
export const VISIT_TURNS = Object.freeze({ calm: 8, sleepy: 7, playful: 8, clingy: 8, grumpy: 8 });
export const BOND_TURN_LEVELS = Object.freeze([2, 4]);
export const PHOTO_HEARTS = 3;        // 写真を撮らせてくれるハートの数（すり寄る・見送るも同じ）
export const RARE_HEARTS = 4;         // 膝に乗ってくるハートの数（気を許した段階）
export const TOUCH_HEARTS = 2;        // ご機嫌ななめの日に、触らせてくれるようになるハートの数
// 嫌がった時に下がる量。同じ理由で下がるのは limit 回まで（その後は知らんぷりで、もう下がらない）。
export const DROP = Object.freeze({ first: 8, again: 6, limit: 2 });
// 操作ごとの手応え（反応の名前。1つ＝JOY_UNIT）。auto（てつこが自分で動いた）は溜まらない（画面を開けておくだけでは溜まらない）。
export const JOY = Object.freeze({
  pet: 2, sweet: 3, shy: 1, look: 0, stalk: 1, paw: 1, catch: 3, miss: 1, brush: 2, bliss: 3, treat: 3, watch: 2,
  auto: 0, found: 1, wish: 3, invite: 2,
});
// どのお世話に数えるか（JOY の名前 → お世話の種類）と、その種類が1回の来訪で溜められる上限。
// 一種類だけではハートは5つにならず、色々組み合わせたり、おねだり・気分に合わせると届く。
export const CARE = Object.freeze({
  pet: "pet", sweet: "pet", shy: "pet", look: "play", stalk: "play", paw: "play", catch: "play", miss: "play", brush: "brush", bliss: "brush",
  treat: "treat", watch: "watch", auto: "watch", found: "found", wish: "wish", invite: "props",
});
export const CARE_CAP = Object.freeze({ pet: 6, play: 5, brush: 5, treat: 4, props: 4, watch: 4, found: 2, wish: 6 });
// 気分に合うお世話（+1 上乗せ）。猫の気まぐれに合わせると、ハートが伸びやすい。
const MOOD_FIT = Object.freeze({
  calm: Object.freeze([]),
  sleepy: Object.freeze(["watch", "bliss", "brush"]),
  playful: Object.freeze(["catch", "paw", "invite"]),
  clingy: Object.freeze(["sweet", "pet", "bliss"]),
  grumpy: Object.freeze(["treat", "watch"]),
});
// 気分で変わること: 来た時のごきげん・続けてなでさせてくれる回数・その日は嫌がる道具。
const MOOD_START = Object.freeze({ calm: 0, sleepy: 0, playful: 0, clingy: 10, grumpy: -10 });
export const PET_LIMIT = Object.freeze({ calm: PET_REST_STREAK, sleepy: 4, playful: 3, clingy: 5, grumpy: 3 });
export const MOOD_DISLIKE = Object.freeze({ sleepy: "play", playful: "brush" });
/** なかよしの段（0〜5。肉球の数）。 */
export const bondLevel = affection => Math.max(0, Math.min(JOY_MAX / BOND_STEP, Math.floor((Number(affection) || 0) / BOND_STEP)));
// 節目のおみやげ: なかよしが at に届いた来訪の帰りに、てつこが置いていく（一度だけ。手帳に貼る。能力・お金は増やさない）。
// memo は手帳の一言（地の文）。火種は別（growth-board-data.js の PLAY_REWARDS: 3段で色つき1つ、5段で白火1つ）。
export const BOND_GIFTS = Object.freeze([
  { id: "acorn", at: 20, name: "どんぐり", memo: "つやのいいのを、選んできたらしい。" },
  { id: "cap", at: 40, name: "びんの王冠", memo: "光る物は、とりあえず持ってくる。" },
  { id: "feather", at: 80, name: "はとの羽", memo: "得意そうな顔で、足もとに置いていった。" },
].map(Object.freeze));
const GIFT_IDS = BOND_GIFTS.map(gift => gift.id);
// 肉球の節目に何があるか（手帳の「なかよし」に並べる小さなしるし。BOND_GIFTS の id か、ember＝火種）。
export const BOND_MARKS = Object.freeze(["acorn", "cap", "ember", "feather", "ember"]);
// 火種の節目（なかよしの値）。届いた確定で "tetsuko-hearts" を知らせ、growth が精算する（growth-board-data.js の tetsuko-bond・tetsuko-heart）。
export const BOND_EMBERS = Object.freeze([60, JOY_MAX]);
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
  // ご機嫌ななめ（顔なじみから・約2割の日。moodFor が上の4つに重ねる）。機嫌が直るまでは触らせてくれない。
  { id: "grumpy", label: "今日は、ご機嫌ななめみたいだ。" },
].map(Object.freeze));
const BASE_MOODS = 4; // moodOf が引く気分の数（ご機嫌ななめは引かない）
export const STAGE_NAMES = Object.freeze(["まだ様子見", "顔なじみ", "待ってくれる", "気を許す"]);

// 小物を置く3つの枠。
export const SLOTS = Object.freeze(["bench", "floor", "bed"]);
export const SLOT_NAMES = Object.freeze({ bench: "ベンチ", floor: "床", bed: "寝床" });
// 小物（計画 §4）。専用通貨・買い直し・耐久はない。使っていない物も失わない。
export const PROPS = Object.freeze([
  { id: "box", name: "段ボール箱", slots: ["floor", "bed"], stage: 0, from: "店の段ボール箱" },
  { id: "ball", name: "ボール", slots: ["floor"], stage: 0, from: "店の奥で転がっていた" },
  { id: "cushion", name: "座布団", slots: ["bench", "bed"], stage: 1, from: "ムカイさんに借りた" },
  { id: "scratcher", name: "爪とぎ", slots: ["floor"], stage: 2, from: "店の奥で見つけた" },
  { id: "tunnel", name: "小さなトンネル", slots: ["floor"], stage: 2, met: "mashiro", from: "ましろちゃんが持ってきた" },
  { id: "bed", name: "猫ベッド", slots: ["bed"], stage: 3, from: "ムカイさんが買ってきた" },
].map(prop => Object.freeze({ ...prop, slots: Object.freeze(prop.slots) })));
const PROP = Object.fromEntries(PROPS.map(prop => [prop.id, prop]));
// ベンチの上は薄い座布団だけ。床の大物と寝床側の箱は、絵の占有幅が重なるため並べない。
const floorLarge = new Set(["box", "tunnel"]);
function propsFit(props) {
  return !(floorLarge.has(props.floor) && props.bed === "box");
}

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
  { id: "first_rub", name: "はじめてすりすり", hint: "すっかり気を許して、ごきげんな時になでると……", face: "smile", art: "rub",
    memo: "すねに頭をこすりつけるのが、てつこの挨拶。" },
  { id: "box_peek", name: "箱から顔だけ", hint: "箱があると……", face: "normal", art: null,
    memo: "箱があると、とりあえず入る。" },
  { id: "ball_watch", name: "ボールを見送る", hint: "床にボールがあると……", face: "surprise", art: "crouch",
    memo: "ボールは追わない。見送る派。" },
  { id: "paws_together", name: "前足をそろえる", hint: "そっと見守っていると……", face: "normal", art: null,
    memo: "隣に座ると、前足をそろえて座り直す。" },
  { id: "odd_sleep", name: "変な寝相", hint: "眠そうな日や、座布団の上だと……", face: "sleep", art: "belly",
    memo: "眠い日は、寝相がひどい。" },
  { id: "lap_nap", name: "膝で寝る", hint: "すっかり気を許して、ごきげんな日に見守ると……", face: "sleep", art: null, scene: "lap_nap",
    memo: "膝に乗ると、しばらく降りない。" },
  { id: "box_over_bed", name: "新しいベッドより箱", hint: "新しいベッドの近くに箱があると……", face: "normal", art: null,
    memo: "新しいベッドより、その箱。ムカイさんは少し寂しそうだった。" },
  { id: "see_off", name: "帰りの見送り", hint: "すっかり気を許して、ごきげんなまま帰ると……", face: "smile", art: "rub",
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
  return MOODS[Math.floor(rng(Math.imul((Number(day) || 1) + 2454, 0x9E3779B1))() * BASE_MOODS)];
}
/** ご機嫌ななめの日か（通算日で決まる・約2割）。 */
export const grumpyDay = day => rng(Math.imul((Number(day) || 1) + 4127, 0x9E3779B1))() < 0.22;
/** 今回の気分。顔なじみ（段階1）からは、ご機嫌ななめの日がある（様子見の段階は、まだそこまで気を許していない）。 */
export const moodFor = (day, stage) => (stage >= 1 && grumpyDay(day) ? MOODS[BASE_MOODS] : moodOf(day));
export const moodById = id => MOODS.find(mood => mood.id === id) || MOODS[0];
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
  if (!propsFit(props)) props.bed = null;
  const found = MOMENT_IDS.filter(id => Array.isArray(record.found) && record.found.includes(id));
  const album = [];
  for (const entry of Array.isArray(record.album) ? record.album : []) {
    if (!MOMENT_IDS.includes(entry?.moment) || album.some(item => item.moment === entry.moment)) continue;
    // night: 夜に撮った写真（手帳で、夜の裏口を背にして見せる）。無い旧い記録は昼。
    album.push({ moment: entry.moment, day: Number(entry.day) || 0, props: cleanProps(entry.props), ...(entry.night === true ? { night: true } : {}) });
  }
  return {
    v: RECORD_VERSION, props, found, album: album.slice(0, ALBUM_LIMIT),
    treatDay: Number.isFinite(record.treatDay) ? record.treatDay : null,
    playedDay: Number.isFinite(record.playedDay) ? record.playedDay : null,
    sessions: Math.max(0, Math.floor(Number(record.sessions) || 0)),
    // とっておきを見た通算の回数（手帳に出すだけ。報酬・解放の条件にしない）。旧い記録は「ごきげんがいっぱいになった回数」で、同じ数え方
    peaks: Math.max(0, Math.floor(Number(record.peaks) || 0)),
    // 来訪をまたいで溜まった、なかよし（0〜JOY_MAX。JOY_MAX＝肉球5つ）。無い旧い記録は 0 から。
    // 2026-11-26 までの記録（画面のハート＝この値だった頃）も、同じ値をなかよしとして引き継ぐ
    affection: Math.min(JOY_MAX, Math.max(0, Math.floor(Number(record.affection) || 0))),
    // もらったおみやげ（BOND_GIFTS の id）。無い旧い記録は空（次の来訪の帰りに、届いている節目の分をまとめて置いていく）
    gifts: GIFT_IDS.filter(id => Array.isArray(record.gifts) && record.gifts.includes(id)),
    lastKey: typeof record.lastKey === "string" ? record.lastKey : null,
  };
}
/** 今日はもうてつこと遊んだか（1日1回制限。日付の進み方は日常システムの通算日 state.day に合わせる）。 */
export function tetsukoPlayedToday(value) {
  const day = Number(value?.day);
  return Number.isFinite(day) && readTetsukoRecord(value).playedDay === day;
}
function cleanProps(props) {
  const clean = Object.fromEntries(SLOTS.map(slot => [slot, PROP[props?.[slot]]?.slots.includes(slot) ? props[slot] : null]));
  const seen = new Set();
  for (const slot of SLOTS) { if (seen.has(clean[slot])) clean[slot] = null; else if (clean[slot]) seen.add(clean[slot]); }
  if (!propsFit(clean)) clean.bed = null;
  return clean;
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
  const night = (Number(value?.slot) || 0) >= 1;
  const record = readTetsukoRecord(value);
  const props = { ...record.props };
  for (const slot of SLOTS) if (props[slot] && !propUnlocked(PROP[props[slot]], stage, metMashiro)) props[slot] = null;
  const before = new Set(unlockedProps(count ? relationStage(count) : -1, metMashiro).map(prop => prop.id));
  const moodId = moodFor(day, stage).id;
  const level = bondLevel(record.affection);
  const joyMax = heartCap(level) * (JOY_MAX / JOY_HEARTS);
  const start = Math.max(0, Math.min(joyMax - JOY_MAX / JOY_HEARTS, JOY_START + level * JOY_START_PER_LEVEL + (MOOD_START[moodId] || 0)));
  return {
    day, count, stage, metMashiro, metMukai, visitKey, night,
    mood: moodId,
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
    photoTaken: false,
    // 画面に出ている猫: 居場所・姿勢・表情。今見えているしぐさ（写真に撮れる瞬間）
    cat: { spot: stage >= 3 ? "front" : "bench", pose: "sit", face: stage === 0 ? "serious" : "normal", flip: false, inside: null, art: null },
    moment: null,
    last: null, lastAuto: null, autoTicks: 0,
    petStreak: 0, petZone: null, petZoneStreak: 0, swings: 0, watches: 0, brushes: 0, misses: 0,
    mashiroPassed: false, said: [],
    curiousProp: null,
    // ごきげん（joy。その日だけ・0〜joyMax）と、なかよし（bond。保存済みの値。この画面の中では変えない）。
    // joyMax はハートの枠（heartCap。なかよしの段で3〜5つ）。お世話の手応えは care（種類ごとの上限 careBy）、やりとりの回数は turns（上限 maxTurns）。
    // ハートが枠いっぱいになると、とっておき（peakReady）。回数を使い切ると ended=true（endReason "turns"）で、その日は切り上げて終わる。
    joy: start, joyStart: start, joyMax, heartCap: heartCap(level), care: 0, careBy: {}, bond: record.affection, bondLevel: level, gifts: [...record.gifts],
    turns: 0, maxTurns: (VISIT_TURNS[moodId] ?? 8) + BOND_TURN_LEVELS.filter(at => level >= at).length,
    ended: false, endReason: null, wrapReady: false, wrapped: false,
    // 嫌がった記録: warned＝しぐさで知らせた理由、irk＝理由ごとに下がった回数、drops・lost＝この回に下がった回数と量。
    warned: {}, irk: {}, drops: 0, lost: 0, thawed: false,
    peaks: 0, peakReady: false, pastPeaks: record.peaks,
    sweet: sweetZoneOf(day), sweetFound: false,
    wish: null, wishAge: 0, nextWishTick: 1, lastWish: null, sessions: record.sessions,
  };
}

const prop = id => PROP[id] || null;
/** その小物が置いてある枠（無ければ null）。 */
export const slotOf = (session, id) => SLOTS.find(slot => session.props[slot] === id) || null;
const has = (session, id) => !!slotOf(session, id);

/** 置ける組み合わせか。画面の予告と確定で同じ判定を使う。 */
export function canPlaceProp(session, slot, id) {
  const item = prop(id);
  if (!SLOTS.includes(slot) || !item || !item.slots.includes(slot) || !propUnlocked(item, session.stage, session.metMashiro)) return false;
  const next = { ...session.props };
  for (const other of SLOTS) if (next[other] === id) next[other] = null;
  next[slot] = id;
  return propsFit(next);
}

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
  if (!canPlaceProp(session, slot, id)) return false;
  const wasInside = slotOf(session, id) !== slot && session.cat.inside === id;
  for (const other of SLOTS) if (session.props[other] === id) session.props[other] = null;
  session.props[slot] = id;
  session.curiousProp = id;
  // 中に入っていた物が片付いたら、てつこは外へ出てくる。
  if (wasInside || (session.cat.inside && !has(session, session.cat.inside))) session.cat = { ...session.cat, inside: null, pose: "sit", spot: "floor", art: null };
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
/** ご機嫌ななめで、まだ機嫌が直っていない（触らせてくれない）。 */
export const sulky = session => session.mood === "grumpy" && joyHearts(session) < TOUCH_HEARTS;
/** 今のてつこが嫌がる操作か（気分に合わない道具・機嫌が直る前に触る）。嫌がる操作は、おねだりにも手がかりにも出さない。 */
export const dislikes = (session, kind) => MOOD_DISLIKE[session.mood] === kind || (sulky(session) && (kind === "pet" || kind === "brush"));
/** 続けてなでさせてくれる回数（気分で変わる）。この回数目で「もういい」を見せ、その先は嫌がる。 */
export const petLimit = session => PET_LIMIT[session.mood] ?? PET_REST_STREAK;
/** 膝に乗ってくるか（気を許した段階で、ハートが RARE_HEARTS 以上）。 */
export const lapReady = session => session.stage >= 3 && joyHearts(session) >= RARE_HEARTS;
/** 写真を撮らせてくれるか（しぐさが見えていて、ハートが PHOTO_HEARTS 以上）。 */
export const canPhoto = session => MOMENT_IDS.includes(session.moment) && joyHearts(session) >= PHOTO_HEARTS;
/**
 * 嫌がった時の段階。最初の1回は、しぐさで知らせるだけ（warn: ごきげんは減らず、付き合ってくれる回数も使わない）。
 * 続けると少し下がる（drop）。同じ理由で下がるのは DROP.limit 回までで、その後は知らんぷり（ignore: もう下がらない）。
 * warned: 先に別のしぐさで知らせてある（なですぎの「もういい」）。
 */
function irritate(session, key, { warned = false } = {}) {
  if (!warned && !session.warned[key]) { session.warned[key] = true; return { level: "warn", loss: 0 }; }
  const count = session.irk[key] = (session.irk[key] || 0) + 1;
  if (count > DROP.limit) return { level: "ignore", loss: 0 };
  return { level: "drop", loss: count === 1 ? DROP.first : DROP.again };
}
/**
 * ごきげんを足し引きし、とっておき（ハートが枠いっぱい）と、切り上げ（付き合ってくれる回数を使い切った）を判定する。
 * parts は [JOY の名前, 量] の並び（1つ＝JOY_UNIT）。loss は嫌がった時に下がる量。
 */
function gainJoy(session, parts, { spendTurn = false, deferEnd = false, loss = 0 } = {}) {
  const before = session.joy;
  let care = 0;
  const fits = MOOD_FIT[session.mood] || [];
  for (const [key, raw] of parts) {
    const kind = CARE[key];
    let amount = Math.max(0, Math.round(Number(raw) || 0));
    if (!kind || !amount) continue;
    if (fits.includes(key)) amount += 1;
    const add = Math.max(0, Math.min(amount, CARE_CAP[kind] - (session.careBy[kind] || 0)));
    if (!add) continue;
    session.careBy[kind] = (session.careBy[kind] || 0) + add;
    care += add;
  }
  session.care += care;
  const joyMax = session.joyMax || JOY_MAX;
  session.joy = Math.max(session.joy, Math.min(joyMax, session.joy + care * JOY_UNIT));
  if (loss > 0) {
    const lost = Math.min(session.joy, loss);
    session.joy -= lost;
    session.lost += lost;
    session.drops += 1;
  }
  if (spendTurn) session.turns += 1;
  let peak = false;
  let wrap = false;
  // とっておきは1回の来訪に一度だけ。見せた後も、回数が残っていれば続けられる（最後の1回で届いた時は、とっておきの後で切り上げる）。
  if (!session.ended && !deferEnd && session.joy >= joyMax && !session.peakReady && session.peaks === 0) { session.peakReady = true; peak = true; }
  if (!session.ended && !deferEnd && session.turns >= session.maxTurns) {
    session.ended = true;
    session.endReason = "turns";
    session.wrapReady = true;
    wrap = true;
  }
  return { gain: session.joy - before, care, value: session.joy, hearts: joyHearts(session), peak, wrap, ended: session.ended, endReason: session.endReason };
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
 * pop は猫のそばに出す短い擬音、joy は足すごきげんの名前（JOY の鍵。見つけた時・おねだりに応えた時は上乗せ）。
 * irk は嫌がった時（irritate の戻り値）。返す warn・drop・ignored は、画面がしぐさ（怒りのしるし・こぼれるハート）で見せる。
 */
function react(session, kind, { text, face = "normal", pose = "sit", spot = session.cat.spot, fx = null, moment = null, inside = null, flip = false, line = null, art = null,
  pop = null, joy = null, zone = null, sweet = false, pounce = false, usedProp = null, irk = null }) {
  // art: しぐさの絵が届いていれば使う名前（tetsuko-art.js）。無ければ face と pose（CSS）で見せる。
  session.cat = { spot, pose, face, flip, inside, art };
  session.moment = irk ? null : moment;
  const found = session.moment ? discover(session, session.moment) : null;
  // 人物の一言は、名乗りを受けた相手だけ・その訪問で一度だけ（長い会話は挟まない）。
  const known = line && (line.speaker !== "mukai_master" || session.metMukai);
  const said = known && !session.said.includes(line.id) ? (session.said.push(line.id), line) : null;
  const granted = irk ? false : grantWish(session, kind, usedProp || inside);
  // 同じ場所を続けてなでると、ごきげんの伸びは小さくなる（観察して合わせる遊びに寄せる・#3642）。
  let baseJoy = joy && !irk ? JOY[joy] || 0 : 0;
  if (kind === "pet" && zone && !irk) {
    session.petZoneStreak = zone === session.petZone ? session.petZoneStreak + 1 : 1;
    session.petZone = zone;
    if (baseJoy > 0 && session.petZoneStreak > 1)
      baseJoy = Math.max(1, Math.round(baseJoy * (session.petZoneStreak === 2 ? 0.5 : 0.25)));
  } else if (kind !== "pet") {
    session.petZone = null;
    session.petZoneStreak = 0;
  }
  // 主操作のうち、1回のやりとり完了（なでる・捕獲/空振り・ブラシ・おやつ・見守る）で、付き合ってくれる回数を1つ使う。
  // じゃらしの振り途中（play）は回数も切り上げの判定も保留し、飛びつき・捕獲まで途切れさせない。
  // 嫌がった時: 最初の知らせ（warn）は回数を使わない。下がった時・知らんぷりは1つ使う。
  const turnKind = kind === "pet" || kind === "catch" || kind === "miss" || kind === "brush" || kind === "treat" || kind === "watch";
  const spendTurn = irk ? irk.level !== "warn" : turnKind;
  const deferEnd = kind === "leave" || kind === "shy" || (kind === "play" && !irk);
  const parts = kind === "leave" || irk ? [] : [[joy, baseJoy], ...(found ? [["found", JOY.found]] : []), ...(granted ? [["wish", JOY.wish]] : [])];
  const gained = gainJoy(session, parts, { spendTurn, deferEnd, loss: irk?.loss || 0 });
  return { kind, text, face, pose, spot, fx, moment: session.moment, found, art, pop, zone, sweet, pounce, granted, joy: gained,
    warn: irk?.level === "warn", drop: irk?.level === "drop" ? irk.loss : 0, ignored: irk?.level === "ignore",
    line: said ? { speaker: said.speaker, text: said.text } : null };
}

/**
 * 画面を開いたとき（入口の段階会話の後）。今日の気分は、入口の姿・表情・ひと声で見せる（文で説明しない）。
 * 様子見の段階は、気分にかかわらずベンチから一度見るだけ。のんびりの日は、段階2以上なら「こちらを待っていた」。
 */
export function openingReaction(session) {
  const stage = session.stage;
  if (stage === 0) return react(session, "open", { text: "てつこはベンチの上から、こちらを一度だけ見た。", face: "serious", spot: "bench" });
  if (session.mood === "grumpy")
    return react(session, "open", { text: "てつこは、そっぽを向いて座っている。", face: "serious", spot: "bench", flip: true, fx: "tail", pop: "つーん" });
  if (session.mood === "sleepy")
    return react(session, "open", { text: "てつこは丸くなったまま、片目だけ開けた。", face: "sleep", pose: "curl", spot: "bench", art: "loaf", fx: "zzz", pop: "ふあ…" });
  if (session.mood === "playful")
    return react(session, "open", { text: "てつこが身を低くして、こちらを狙っている。", face: "serious", pose: "low", spot: "floor", art: "crouch", pop: "うずうず" });
  if (session.mood === "clingy") {
    if (stage >= 2) return react(session, "open", { text: "てつこが足もとまで来て、短く鳴いた。", face: "smile", spot: "front", fx: "mew", art: "mew", pop: "にゃー", moment: "waiting" });
    return react(session, "open", { text: "てつこが、ベンチの端まで出てきている。", spot: "bench", pop: "……" });
  }
  if (stage >= 3) return react(session, "open", { text: "てつこが、すぐそばでこちらを見上げている。", spot: "front", moment: "waiting" });
  if (stage === 2) return react(session, "open", { text: "てつこが、ベンチの上からこちらを見ている。", spot: "bench", moment: "waiting" });
  return react(session, "open", { text: "てつこはベンチで丸くなったまま、しっぽの先だけ動かした。", face: "sleep", pose: "curl", spot: "bench" });
}

export const canBrush = session => session.stage >= 1;
export const canTreat = session => session.treatDay !== session.day;
export const toyOut = session => session.swings > 0;
/** その操作が今できるか（できない時はボタンを押せなくするだけ。叱らない）。 */
export function canAct(session, kind) {
  if (session.ended) return false;
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
  chin: "あごの下をかくと、首を伸ばしてきた。",
  back: "背中のほうまでなでると、しっぽがゆっくり揺れた。",
});

const ACTIONS = {
  pet(session, { zone = "head" } = {}) {
    const at = PET_ZONES.includes(zone) ? zone : "head";
    const away = session.cat.inside ? { spot: "floor" } : {};
    if (session.cat.pose === "lap")
      return react(session, "pet", { text: "膝の上で、低く喉を鳴らしている。", face: "smile", pose: "lap", spot: "lap", fx: "heart", pop: "ごろごろ", joy: "pet", zone: at });
    // しっぽだけは触らせてくれない。1回目は、じろりと見て知らせるだけ。続けると、ごきげんが少し下がる（続けた回数には数えない）。
    if (at === "tail") {
      session.petStreak = Math.max(0, session.petStreak - 1);
      const irk = irritate(session, "tail");
      const shape = irk.level === "warn" ? { text: "しっぽに触ると、じろりと見られた。しっぽは、だめらしい。", pop: "じろっ" }
        : irk.level === "drop" ? { text: "しっぽを引っこめて、ぷいと横を向いた。", flip: true, pop: "ぷいっ" }
        : { text: "しっぽは、もう届かない所へしまわれた。", flip: true, pop: "……" };
      return react(session, "pet", { ...shape, face: "serious", ...away, fx: "tail", zone: at, irk });
    }
    // ご機嫌ななめの日は、機嫌が直るまで（ハート TOUCH_HEARTS）触らせてくれない。おやつ・じゃらし・そばで待つ、で直る。
    if (sulky(session)) {
      session.petStreak = Math.max(0, session.petStreak - 1);
      const irk = irritate(session, "touch");
      const shape = irk.level === "warn" ? { text: "手を伸ばすと、しっぽが床をぱたんと打った。今は、だめらしい。", fx: "tail", pop: "ぱたん" }
        : irk.level === "drop" ? { text: "てつこは、すっと手をよけて、そっぽを向いた。", flip: true, pop: "ぷいっ" }
        : { text: "てつこは、そっぽを向いたまま動かない。", flip: true, pop: "つーん" };
      return react(session, "pet", { ...shape, face: "serious", ...away, zone: at, irk });
    }
    // なですぎ: 気分ごとの回数（petLimit）目で「もういい」を見せる。それでも続けると、するりと逃げてごきげんが少し下がる。
    const limit = petLimit(session);
    if (session.petStreak > limit) {
      const irk = irritate(session, "pet", { warned: true });
      return react(session, "pet", irk.level === "drop"
        ? { text: "てつこは手の下から、するりと抜けた。", face: "serious", flip: true, ...away, fx: "tail", pop: "ぷいっ", zone: at, irk }
        : { text: "てつこは少し離れて、毛づくろいを始めた。", face: "serious", ...away, art: "groom", pop: "……", zone: at, irk });
    }
    if (session.petStreak === limit)
      return react(session, "pet", { text: "しっぽをぱたんと振った。今は、もういいらしい。", face: "serious", ...away, fx: "tail", pop: "ぱたん", zone: at, irk: { level: "warn", loss: 0 } });
    // 気を許した段階で、ごきげんが良ければ、すり寄ってくる（⑤）。待ってくれる段階からは、手に頭を寄せてくる。
    if (session.stage >= 3 && session.petStreak === 1 && joyHearts(session) >= PHOTO_HEARTS)
      return react(session, "pet", { text: "てつこがすり寄ってきて、低く喉を鳴らした。", face: "smile", spot: "front", fx: "heart", moment: "first_rub", art: "rub",
        pop: "すりすり", joy: "pet", zone: at });
    // 今日のお気に入りの場所（日によって変わる）。見つけると、喉が鳴りだす。
    if (at === session.sweet) {
      const first = !session.sweetFound;
      session.sweetFound = true;
      if (session.stage === 0)
        return react(session, "pet", { text: first ? "耳が、ぴくりと動いた。悪くはないらしい。" : "耳だけが、こちらを向いている。", ...away, pop: first ? "ぴくっ" : null,
          joy: "pet", zone: at, sweet: true });
      return react(session, "pet", { text: first ? "そこが、今日のお気に入りらしい。喉が鳴りだした。" : session.stage >= 2 ? "もっと、と頭を押しつけてくる。" : "目を閉じて、じっと味わっている。",
        face: "smile", ...away, fx: "heart", pop: "ごろごろ", joy: "sweet", zone: at, sweet: true });
    }
    if (session.stage === 0) return react(session, "pet", { text: "てつこは目を閉じて、されるがままになっている。", face: "serious", ...away, joy: "shy", zone: at });
    if (session.stage >= 2 && session.petStreak === 1)
      return react(session, "pet", { text: "てつこが、手のひらに頭を寄せてきた。", face: "smile", ...away, fx: "heart", joy: "pet", zone: at });
    return react(session, "pet", { text: ZONE_TEXT[at], face: "smile", ...away, fx: "heart", joy: "pet", zone: at });
  },
  // 猫じゃらし: 見る→狙う→前足（①）→飛びつく。飛びついた先にじゃらしがあれば捕まえ（catch）、引いていれば空振り（miss）。
  // どちらも遊びのうち。5回目は必ず捕まえる。様子見の段階は飛びつかず、その場で前足を出す。
  play(session) {
    // 眠い日は、じゃらしに乗ってこない。1回目はあくびで知らせるだけ。続けると、背中を向けて丸くなる。
    if (dislikes(session, "play")) {
      session.swings = 0;
      const irk = irritate(session, "toy");
      const shape = irk.level === "warn" ? { text: "じゃらしを見て、てつこは大きなあくびをした。今は、眠いらしい。", face: "surprise", art: "yawn", pop: "ふわぁ" }
        : irk.level === "drop" ? { text: "てつこは、じゃらしに背中を向けて丸くなった。", face: "sleep", pose: "curl", flip: true, pop: "ぷいっ" }
        : { text: "てつこは丸くなったまま、しっぽも動かさない。", face: "sleep", pose: "curl", flip: true, pop: "……" };
      return react(session, "play", { ...shape, spot: restingSpot(session), irk });
    }
    session.swings += 1;
    if (session.swings >= PLAY_AUTO_CATCH) return ACTIONS.catch(session);
    if (session.swings === 1) return react(session, "play", { text: "てつこの目が、じゃらしの先を追った。", spot: "floor", fx: "toy", joy: "look" });
    if (session.swings === 2) return react(session, "play", { text: "てつこが身を低くした。狙っている。", face: "serious", pose: "low", spot: "floor", fx: "toy", art: "crouch", pop: "じりっ", joy: "stalk" });
    if (session.swings === PLAY_PAW) return react(session, "play", { text: "前足が、さっと伸びた。", face: "surprise", pose: "paw", spot: "floor", fx: "toy", moment: "first_paw", art: "reach", pop: "ぺしっ", joy: "paw" });
    if (session.stage === 0) return react(session, "play", { text: "もう一度、前足が伸びた。", face: "serious", pose: "paw", spot: "floor", fx: "toy", art: "reach", pop: "ぺしっ", joy: "look" });
    return react(session, "play", { text: "てつこが、じゃらしに飛びついた。", face: "surprise", pose: "paw", spot: "floor", fx: "toy", art: "leap", pop: "ばっ", joy: "look", pounce: true });
  },
  catch(session) {
    session.swings = 0;
    session.misses = 0;
    if (session.stage === 0)
      return react(session, "catch", { text: "てつこが前足で押さえて、すぐに離した。", face: "serious", spot: "floor", fx: "toy", pop: "ぺたっ", joy: "paw" });
    return react(session, "catch", { text: "てつこが、じゃらしを抱えこんで離さない。", face: "smile", pose: "hug", spot: "floor", fx: "toy-held", moment: "hug_toy", art: "hug",
      pop: "がしっ", joy: "catch" });
  },
  // 空振り（飛びついた先に、じゃらしがもう無かった）。てつこの負けではなく、遊びの一コマ。2回続いたら、次は必ず捕まえる。
  miss(session) {
    session.misses += 1;
    const again = session.misses >= 2;
    if (!again) session.swings = PLAY_PAW;
    return react(session, "miss", { text: again ? "また空振り。しっぽが、ぶんと揺れた。" : "空振り。てつこは、何事もなかった顔をしている。", face: again ? "serious" : "surprise",
      spot: "floor", fx: "toy", pop: "すかっ", joy: "miss", art: "flop" });
  },
  brush(session) {
    const spot = session.cat.inside || session.cat.spot === "lap" ? "bench" : session.cat.spot;
    // 遊びたい日は、じっとしていられない。機嫌が直る前（ご機嫌ななめ）も、ブラシを当てさせてくれない。
    if (dislikes(session, "brush")) {
      const moody = sulky(session);
      const irk = irritate(session, moody ? "touch" : "brush");
      const shape = moody
        ? (irk.level === "warn" ? { text: "ブラシを近づけると、しっぽが床をぱたんと打った。今は、だめらしい。", fx: "tail", pop: "ぱたん" }
          : irk.level === "drop" ? { text: "てつこは、ブラシをよけて、そっぽを向いた。", flip: true, pop: "ぷいっ" }
          : { text: "てつこは、そっぽを向いたまま動かない。", flip: true, pop: "つーん" })
        : (irk.level === "warn" ? { text: "ブラシを当てると、前足でぺしっと払われた。今は、遊びたいらしい。", pose: "paw", art: "reach", pop: "ぺしっ" }
          : irk.level === "drop" ? { text: "てつこはブラシの下から、するりと逃げた。", flip: true, pop: "ぷいっ" }
          : { text: "てつこは、ブラシのほうを見もしない。", flip: true, pop: "……" });
      return react(session, "brush", { ...shape, face: "serious", spot, irk });
    }
    session.brushes += 1;
    // 1回目はうっとり（③）。ごきげんが良い時（ハート PHOTO_HEARTS 以上）は、1回おきにまたうっとりする（写真に残せる）。
    if (session.brushes === 1 || (session.brushes % 2 === 1 && joyHearts(session) >= PHOTO_HEARTS))
      return react(session, "brush", { text: "背中にブラシを当てる。てつこの体から、力が抜けていく。", face: "smile", pose: "melt", spot, fx: "fur", moment: "brush_bliss", pop: "ふにゃ", joy: "bliss" });
    if (session.brushes % 2 === 0)
      return react(session, "brush", { text: "ブラシを止めると、前足が手を追ってきた。", face: "normal", pose: "paw", spot, fx: "fur", art: "reach", pop: "ちょい", joy: "brush" });
    return react(session, "brush", { text: "ブラシのたびに、てつこが少しずつ平たくなる。", face: "smile", pose: "melt", spot, fx: "fur", pop: "ふにゃ", joy: "brush" });
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
    return { ...react(session, "treat", { text: "食べ終わると、前足で顔を洗いはじめた。", face: "smile", spot: "floor", fx: "treat-done", art: "groom", pop: "ぺろぺろ", joy: "treat" }), steps };
  },
  // 何もしないで隣にいる（画面は、しばらく触らずにいると自動でこれを呼ぶ）。触るより劣る選択にしない。
  watch(session) {
    session.watches += 1;
    if (lapReady(session)) {
      if (session.cat.pose === "lap") return react(session, "watch", { text: "膝の上で、てつこが寝息を立てている。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap", fx: "zzz", joy: "watch" });
      return react(session, "watch", { text: "隣に座ると、てつこが膝に乗ってきた。", face: "smile", pose: "lap", spot: "lap", moment: "lap_nap", pop: "ごろごろ", joy: "watch",
        line: { id: "lap", speaker: "mukai_master", text: "……起こすなよ" } });
    }
    // 気を許していても、ごきげんが足りない日は、膝に前足をかけて、やめる（もう少しで乗ってくる、の合図）。
    if (session.stage >= 3 && session.watches >= 2 && !session.lapTease && !sulky(session)) {
      session.lapTease = true;
      return react(session, "watch", { text: "てつこが膝に前足をかけて、少し考えて、やめた。", pose: "paw", spot: "front", art: "poke", pop: "ちょん", joy: "watch" });
    }
    if (session.watches === 1 || (session.watches % 2 === 1 && joyHearts(session) >= PHOTO_HEARTS && !session.cat.inside))
      return react(session, "watch", { text: "隣に座ると、てつこが前足をそろえて座り直した。", spot: session.cat.inside ? "bench" : session.cat.spot, moment: "paws_together", joy: "watch" });
    return autonomous(session, { force: true, watching: true });
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
  { id: "sulk", when: s => sulky(s), weight: { grumpy: 4 },
    react: s => ({ text: "てつこはそっぽを向いたまま、しっぽだけ揺らしている。", face: "serious", flip: true, spot: "bench", fx: "tail", pop: "つーん" }) },
  { id: "tail", when: () => true, weight: { playful: 1.2, grumpy: 1.6 },
    react: s => ({ text: "しっぽの先が、ゆっくり揺れている。", fx: "tail", pop: "ぱたぱた" }) },
  { id: "stretch", when: () => true, weight: { calm: 1.2, sleepy: 1.2 },
    react: s => ({ text: "てつこが、前足をぐーっと伸ばした。", pose: "stretch", art: "stretch", pop: "ぐーっ" }) },
  { id: "stare", when: s => s.stage <= 1, weight: { calm: 1.2 },
    react: s => ({ text: "てつこが、横目でこちらを見ている。", face: "serious", pop: "じー" }) },
  { id: "mew", when: s => s.stage >= 1 && !sulky(s), weight: { clingy: 1.8, playful: 1.4 },
    react: s => ({ text: "てつこが、こちらを見て短く鳴いた。", face: "surprise", fx: "mew", pop: "にゃ", art: "mew" }) },
  { id: "poke", when: s => s.stage >= 2 && !sulky(s), weight: { clingy: 1.8, playful: 1.6 },
    react: s => ({ text: "てつこが、前足でちょんとつついてきた。", pose: "paw", spot: "front", fx: "poke", art: "poke", pop: "ちょん" }) },
  { id: "doze", when: s => s.mood === "sleepy", weight: { sleepy: 2 },
    react: s => ({ text: "てつこがうとうとしている。", face: "sleep", pose: "curl", fx: "zzz" }) },
  { id: "come", when: s => s.stage >= 2 && !sulky(s), weight: { clingy: 2 },
    react: s => ({ text: "てつこが、すぐ近くまで来て座った。", spot: "front" }) },
  // ごきげんが良いと、開いた時と同じ「こちらを待っていた」（④）をまた見せる（写真に残せる）。
  { id: "wait_look", when: s => s.stage >= 2 && joyHearts(s) >= PHOTO_HEARTS, moment: "waiting", weight: { clingy: 1.4 },
    react: s => ({ text: "てつこが、こちらの手が動くのを待っている。", spot: s.stage >= 3 ? "front" : "bench" }) },
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
  calm: ["pet", "watch", "play", "brush"], sleepy: ["watch", "pet", "brush"],
  playful: ["play", "pet", "watch"], clingy: ["pet", "brush", "play", "watch"], grumpy: ["watch", "play", "pet", "brush"],
});
// 嫌がる操作（気分に合わない道具・機嫌が直る前に触る）は、ねだらない。
const wishOk = (session, kind) => dislikes(session, kind) ? false
  : kind === "decor" || kind === "watch" || kind === "play" ? true
  : kind === "pet" ? session.stage >= 1 : canAct(session, kind);
function pickWish(session) {
  const guide = discoveryGuide(session, session.focus);
  const fromGuide = guide.id ? { kind: guide.kind === "catch" ? "play" : guide.kind, prop: guide.prop || null, moment: guide.id } : null;
  if (fromGuide && wishOk(session, fromGuide.kind) && (fromGuide.kind !== session.lastWish || session.focus === guide.id)) return fromGuide;
  const pool = (WISH_POOL[session.mood] || WISH_POOL.calm).filter(kind => wishOk(session, kind) && kind !== session.lastWish);
  if (canTreat(session) && session.lastWish !== "treat" && session.random() < 0.2) return { kind: "treat", prop: null, moment: null };
  const kind = pool[Math.floor(session.random() * Math.min(2, pool.length))] || (fromGuide && wishOk(session, fromGuide.kind) ? fromGuide.kind : "watch");
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
 * @param {{ force?: boolean, idle?: boolean, holding?: boolean, watching?: boolean }} [opts] force: 待機を挟まずに必ず行動を引く（見守る・物で誘うから呼ぶ）／
 *   idle: しばらく触らずに眺めている（＝隣で見守っている。時々、見守った時の反応になる）／
 *   holding: 見つけたばかりのしぐさを写真に撮れるよう、姿を保っている（おねだりだけは出す）／
 *   watching: 見守る操作の一手として数える
 */
export function autonomous(session, { force = false, idle = false, holding = false, watching = false } = {}) {
  if (session.ended) return { kind: "auto", id: "settle", quiet: true };
  session.autoTicks += 1;
  if (!force && !session.curiousProp && session.autoTicks % 2 === 0) return { kind: "auto", id: "settle", quiet: true };
  // 寝ている・トンネルの中・膝の上では、おねだりをしない。
  const canAsk = !force && !session.curiousProp && !session.wish && session.autoTicks >= session.nextWishTick && !sulky(session)
    && session.cat.face !== "sleep" && session.cat.pose !== "tunnel" && session.cat.pose !== "lap";
  // ご機嫌ななめの日: 機嫌が直ったら（ハート TOUCH_HEARTS）、てつこのほうから一度だけ知らせる（もう触っていい、の合図）。
  if (!force && session.mood === "grumpy" && !session.thawed && !sulky(session) && session.cat.pose !== "lap") {
    session.thawed = true;
    session.lastAuto = "thaw";
    session.petStreak = 0;
    return { ...react(session, "auto", { text: "てつこが、ようやくこちらを向いた。機嫌が直ってきたらしい。", face: "normal", spot: restingSpot(session), fx: "mew", art: "mew", pop: "にゃ" }), id: "thaw", thaw: true };
  }
  if (holding && !force) return canAsk ? ask(session, { keep: true }) : { kind: "auto", id: "settle", quiet: true };
  // 膝の上では、しばらくそのまま寝ている（すぐ降りない。ほかの遊びを始めれば降りる）。
  if (!force && session.cat.pose === "lap" && (session.lapTicks = (session.lapTicks || 0) + 1) <= 5) {
    const id = session.lastAuto === "lap_doze" ? "lap_purr" : "lap_doze";
    session.lastAuto = id;
    return { ...react(session, "auto", id === "lap_doze"
      ? { text: "膝の上で、てつこが寝息を立てている。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap", fx: "zzz", joy: "auto" }
      : { text: "膝の上が、じんわり温かい。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap", pop: "ごろごろ", joy: "auto" }), id };
  }
  if (session.cat.pose !== "lap") session.lapTicks = 0;
  // 眺めているだけの時は、時々「隣で見守る」の反応になる（見守る＝操作と同じ扱い）。
  const watchLeft = (session.careBy.watch || 0) < CARE_CAP.watch || lapReady(session);
  if (!force && idle && watchLeft && !session.curiousProp && session.autoTicks >= (session.nextWatchTick || 0)) {
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
  // 見守る操作の一手として動いた時は、見守った手応えが入る（見守る手応えの上限まで）。自分から動いただけの時は入らない。
  const reaction = react(session, watching ? "watch" : "auto", { spot: shape.spot || restingSpot(session), ...shape, moment: item.moment || null,
    joy: watching ? "watch" : "auto", usedProp: invited ? usedProp : null });
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
  if (session.ended || !has(session, id)) return null;
  session.meaningful = true;
  session.petStreak = 0;
  session.swings = 0;
  session.misses = 0;
  session.last = "invite";
  session.curiousProp = id;
  const reaction = autonomous(session, { force: true });
  const more = gainJoy(session, [["invite", JOY.invite]], { spendTurn: true });
  return { ...reaction, invited: id, joy: { ...more, gain: reaction.joy.gain + more.gain, care: reaction.joy.care + more.care,
    peak: reaction.joy.peak || more.peak, wrap: reaction.joy.wrap || more.wrap, ended: session.ended, endReason: session.endReason } };
}

/**
 * 「とっておき」（段階ごと）。ハートが枠いっぱいになった時に、1回の来訪に一度だけ見せる。切り上げにはしない
 * （回数が残っていれば、そのまま写真を撮ったり、見守って膝に乗せたりできる）。
 * @returns {object|null} 反応（peak: true）。まだなら null
 */
export function peakReaction(session) {
  if (!session.peakReady) return null;
  session.peakReady = false;
  session.peaks += 1;
  session.meaningful = true;
  let shape;
  if (session.stage >= 3) shape = session.cat.pose === "lap"
    ? { text: "膝の上で、てつこが前足をふみふみと動かしている。", face: "smile", pose: "lap", spot: "lap", moment: "lap_nap", pop: "ふみふみ" }
    : { text: "てつこが、何度も頭をこすりつけてくる。", face: "smile", spot: "front", moment: "first_rub", art: "rub", pop: "すりすり" };
  else if (session.stage === 2) shape = { text: "てつこが、手のひらに頭をぶつけてきた。", face: "smile", spot: "front", pop: "ごつん" };
  else if (session.stage === 1) shape = { text: "てつこが、指先の匂いを確かめに来た。", spot: "front", pop: "くんくん" };
  else shape = { text: "てつこが、ゆっくりまばたきを返した。", face: "smile", pop: "……" };
  session.lapTicks = 0;
  // 満足したので、出していたおねだりは引っこめる。
  session.wish = null;
  session.nextWishTick = session.autoTicks + WISH_REST * 2;
  const reaction = react(session, "peak", { fx: "peak", ...shape });
  return { ...reaction, peak: true, peaks: session.peaks };
}

/**
 * 付き合ってくれる回数を使い切った日の切り上げ。気分に合わせて穏やかに終わる（ハートが3つ以上なら、満足そうな顔で）。
 * @returns {object|null} 反応（wrap: true）。まだなら null
 */
export function wrapUpReaction(session) {
  if (!session.wrapReady || session.wrapped) return null;
  session.wrapReady = false;
  session.wrapped = true;
  session.wish = null;
  const shapes = {
    sleepy: { text: "てつこはもう眠そうだ。今日はこれぐらいにしておこう。", face: "sleep", pose: "curl", spot: "bench", fx: "zzz" },
    calm: { text: "てつこはのんびり丸くなった。今日はこれぐらいにしておこう。", face: "sleep", pose: "curl", spot: "bench" },
    playful: { text: "てつこはひとしきり動いて落ち着いた。今日はこれぐらいにしておこう。", face: "normal", pose: "sit", spot: "bench" },
    clingy: { text: "てつこはベンチへ戻って落ち着いた。今日はこれぐらいにしておこう。", face: "normal", pose: "sit", spot: "bench" },
    grumpy: sulky(session)
      ? { text: "てつこは、最後までそっぽを向いていた。今日はこれぐらいにしておこう。", face: "serious", pose: "sit", spot: "bench", flip: true }
      : { text: "てつこは、ちらりとこちらを見て丸くなった。今日はこれぐらいにしておこう。", face: "sleep", pose: "curl", spot: "bench" },
  };
  // 気を許した段階で、ごきげんが良ければ（ハート PHOTO_HEARTS 以上）、戸の前まで見送ってくれる（図鑑⑫。帰る時の farewell と同じしぐさ）。
  const seeOff = session.stage >= 3 && joyHearts(session) >= PHOTO_HEARTS
    ? { text: "てつこが、戸の前まで見送りにきた。今日はこれぐらいにしておこう。", face: "smile", pose: "sit", spot: "front", moment: "see_off", art: "rub", pop: "にゃ" } : null;
  const shape = seeOff || shapes[session.mood] || shapes.calm;
  const happy = joyHearts(session) >= PHOTO_HEARTS && shape.face === "normal" ? { face: "smile" } : {};
  const reaction = react(session, "wrap", { ...shape, ...happy });
  return { ...reaction, wrap: true };
}

/** 次の自律行動までの待ち時間（ミリ秒）。動きを減らす設定では長めの一定間隔。 */
export function autoDelay(session, { reduced = false } = {}) {
  return reduced ? AUTO_DELAY.reduced : Math.round(AUTO_DELAY.min + session.timing() * (AUTO_DELAY.max - AUTO_DELAY.min));
}

/**
 * 写真: 今見えているしぐさをアルバムに残す（同じしぐさは1件・撮り直すと新しい方）。撮れたら true。
 * ごきげんが足りない時（ハート PHOTO_HEARTS 未満）は撮らせてくれない（画面は photoShy で、顔をそむけるしぐさを見せる）。
 */
export function takePhoto(session) {
  const moment = session.moment;
  if (!canPhoto(session)) return false;
  const entry = { moment, day: session.day, props: { ...session.props }, ...(session.night ? { night: true } : {}) };
  const index = session.album.findIndex(item => item.moment === moment);
  if (index >= 0) session.album[index] = entry;
  else if (session.album.length < ALBUM_LIMIT) session.album.push(entry);
  else return false;
  session.photoTaken = true;
  return true;
}

/**
 * カメラを向けたのに、ごきげんが足りなくて撮らせてくれない時のしぐさ（顔をそむける）。ごきげんは減らず、回数も使わない。
 * @returns {object|null} 反応（shy: true）。しぐさが見えていない・撮れる時は null
 */
export function photoShy(session) {
  if (session.ended || !MOMENT_IDS.includes(session.moment) || canPhoto(session)) return null;
  const cat = session.cat;
  const lying = cat.face === "sleep" || cat.pose === "curl" || cat.pose === "odd" || cat.pose === "lap" || cat.pose === "tunnel";
  const reaction = react(session, "shy", lying
    ? { text: "カメラを向けると、てつこは前足で顔を隠した。", face: "sleep", pose: cat.pose, spot: cat.spot, inside: cat.inside, pop: "ぷいっ" }
    : { text: "カメラを向けると、てつこはぷいと顔をそむけた。", face: "serious", pose: "sit", spot: cat.spot, inside: cat.inside, flip: !cat.flip, pop: "ぷいっ" });
  return { ...reaction, shy: true };
}

/** 帰るとき。気を許した段階で、ごきげんが良ければ（ハート PHOTO_HEARTS 以上）見送ってくれる（図鑑⑫）。 */
export function farewell(session) {
  if (session.stage < 3 || !session.meaningful || joyHearts(session) < PHOTO_HEARTS) return null;
  return react(session, "leave", { text: "帰ろうとすると、てつこが戸の前までついてきた。", face: "smile", spot: "front", moment: "see_off", art: "rub", pop: "にゃ" });
}

/**
 * この回の出来（帰る時に決まる）: ハートの数・なかよしの伸び・肉球の段・置いていくおみやげ。保存は変えない。
 * ふれあいをしていない（meaningful でない）回は、なかよしも、おみやげも動かない。
 */
export function visitOutcome(session) {
  const hearts = joyHearts(session);
  const gain = session.meaningful ? Math.max(0, Math.min(VISIT_JOY, BOND_GAIN[hearts] ?? 0, JOY_MAX - session.bond)) : 0;
  const after = session.bond + gain;
  const gifts = session.meaningful ? BOND_GIFTS.filter(gift => gift.at <= after && !session.gifts.includes(gift.id)).map(gift => gift.id) : [];
  return { hearts, gain, before: session.bond, after, levelBefore: bondLevel(session.bond), level: bondLevel(after),
    levelUp: bondLevel(after) > bondLevel(session.bond), gifts, full: session.bond < JOY_MAX && after >= JOY_MAX,
    // この回に届いた火種の節目（BOND_EMBERS。帰りの札に火種のしるしを出す。火種そのものは確定の後に growth が渡す）
    embers: BOND_EMBERS.filter(at => session.bond < at && after >= at),
    // 次の来訪からのハートの枠（段が上がって増えた時は capUp）
    cap: heartCap(bondLevel(session.bond)), nextCap: heartCap(bondLevel(after)), capUp: heartCap(bondLevel(after)) > heartCap(bondLevel(session.bond)) };
}

/** 確定に渡す結果（settleTetsukoTime の result）。 */
export function sessionResult(session) {
  const outcome = visitOutcome(session);
  return {
    meaningful: !!session.meaningful,
    photoTaken: session.photoTaken,
    visitKey: session.visitKey,
    props: { ...session.props },
    found: [...session.found],
    newFound: [...session.newFound],
    album: session.album.map(entry => ({ ...entry, props: { ...entry.props } })),
    treatDay: session.treatDay,
    peaks: session.peaks,
    // この回に伸びる、なかよし（帰る時のハートの数で決まる。上限 VISIT_JOY）。確定点が affection に足す（肉球5つで止まる）。
    care: outcome.gain,
    affectionUp: outcome.gain > 0,
    hearts: outcome.hearts,
    // おみやげ（持っている物＋この回に置いていった物）。確定点が、なかよしの値と照らしてから書く。
    gifts: [...session.gifts, ...outcome.gifts],
    newGifts: outcome.gifts,
    endReason: session.endReason,
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
    { id: "first_paw", when: !dislikes(session, "play"), kind: "play", text: session.swings < 2 ? "じゃらしを振ると、目で追って……" : "狙っている。もうひと振り。" },
    { id: "hug_toy", when: session.stage >= 1 && !dislikes(session, "play"), kind: "play", text: toyOut(session) ? "じゃらしを止めて、捕まえさせてみよう。" : "じゃらしを振ってから、止めてみよう。" },
    { id: "brush_bliss", when: canBrush(session) && !dislikes(session, "brush"), kind: "brush", text: "ブラシで、背中をゆっくり。" },
    { id: "paws_together", when: session.watches === 0 && !lapReady(session), kind: "watch", text: "何もしないで、少し待ってみよう。" },
    { id: "box_peek", kind: has(session, "box") ? "watch" : "decor", prop: "box", text: has(session, "box") ? "箱のそばで、少し待ってみよう。" : "もようがえで箱を置いてみよう。" },
    { id: "ball_watch", kind: has(session, "ball") ? "watch" : "decor", prop: "ball", text: has(session, "ball") ? "ボールをどうするか、待ってみよう。" : "もようがえで床にボールを置こう。" },
    { id: "first_rub", when: session.stage >= 3 && joyHearts(session) >= PHOTO_HEARTS, kind: "pet", text: "近くに来たら、そっとなでてみよう。" },
    { id: "lap_nap", when: lapReady(session), kind: "watch", text: "隣で、もう少し待ってみよう。" },
    { id: "odd_sleep", when: session.stage >= 1, kind: resting ? "watch" : "decor", prop: "cushion", text: resting ? "眠れる場所で、ゆっくり待ってみよう。" : "座布団を置いて、くつろげる場所に。" },
    { id: "box_over_bed", when: session.stage >= 3, kind: has(session, "box") && has(session, "bed") ? "watch" : "decor", text: has(session, "box") && has(session, "bed") ? "箱とベッド、どちらが好きかな。" : "箱と猫ベッドを、両方置いてみよう。" },
  ].filter(item => item.when !== false && !session.found.includes(item.id));
  const pick = guides.find(item => item.id === preferred) || guides[0];
  if (!pick) return { id: null, kind: "watch", text: "今日は一緒に、のんびり。手帳はいつでも読める。" };
  return { ...pick, name: momentById(pick.id).name };
}
