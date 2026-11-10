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
export const PET_REST_STREAK = 4;   // なでるを4回続けると「今は、もういいらしい」。ほかの操作で戻る
export const PLAY_AUTO_CATCH = 5;   // 猫じゃらしを5回振ったら、てつこが自分から捕まえる
export const DISCOVERY_BIAS = 0.7;  // 条件を満たした未発見のしぐさを優先する割合
export const AUTO_DELAY = Object.freeze({ min: 2400, max: 3200, reduced: 4000 });
export const MAIN_ACTIONS = Object.freeze(["pet", "play", "catch", "brush", "treat", "watch"]);

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
/** 状態の一行（上に出す）。段階0〜1の「甘えたい」は言い換える。 */
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
    petStreak: 0, swings: 0, watches: 0, brushes: 0,
    mashiroPassed: false, said: [],
    curiousProp: null,
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

/** 反応を確定して画面用の形にする。moment は写真に撮れる瞬間、found は今回初めて見つけたしぐさ。 */
function react(session, kind, { text, face = "normal", pose = "sit", spot = session.cat.spot, fx = null, moment = null, inside = null, flip = false, line = null, art = null }) {
  // art: しぐさの絵が届いていれば使う名前（tetsuko-art.js）。無ければ face と pose（CSS）で見せる。
  session.cat = { spot, pose, face, flip, inside, art };
  session.moment = moment;
  const found = moment ? discover(session, moment) : null;
  // 人物の一言は、名乗りを受けた相手だけ・その訪問で一度だけ（長い会話は挟まない）。
  const known = line && (line.speaker !== "mukai_master" || session.metMukai);
  const said = known && !session.said.includes(line.id) ? (session.said.push(line.id), line) : null;
  return { kind, text, face, pose, spot, fx, moment, found, art, line: said ? { speaker: said.speaker, text: said.text } : null };
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
  if (kind === "catch") return toyOut(session);
  return MAIN_ACTIONS.includes(kind);
}

/** 主操作（なでる・あそぶ・止める・ブラシ・おやつ・見守る）。できない操作は null（何も変えない）。 */
export function act(session, kind) {
  if (!canAct(session, kind)) return null;
  session.meaningful = true;
  session.petStreak = kind === "pet" ? session.petStreak + 1 : 0;
  if (kind !== "play" && kind !== "catch") session.swings = 0;
  session.last = kind;
  const reaction = ACTIONS[kind](session);
  return reaction;
}

const ACTIONS = {
  pet(session) {
    const away = session.cat.inside ? { spot: "floor" } : {};
    if (session.petStreak >= PET_REST_STREAK)
      return react(session, "pet", { text: "しっぽをぱたんと振った。今は、もういいらしい。", face: "serious", ...away, fx: "tail" });
    if (session.cat.pose === "lap")
      return react(session, "pet", { text: "膝の上で、低く喉を鳴らしている。", face: "sleep", pose: "lap", spot: "lap", fx: "heart" });
    if (session.stage >= 3)
      return react(session, "pet", { text: "てつこがすり寄ってきて、低く喉を鳴らした。", face: "smile", spot: "front", fx: "heart", moment: "first_rub", art: "rub" });
    if (session.stage === 2) return react(session, "pet", { text: "てつこが、手のひらに頭を寄せてきた。", face: "smile", ...away, fx: "heart" });
    if (session.stage === 1) return react(session, "pet", { text: "喉元をなでると、てつこが目を細めた。", face: "smile", ...away, fx: "heart" });
    return react(session, "pet", { text: "てつこは目を閉じて、されるがままになっている。", face: "serious", ...away });
  },
  play(session) {
    session.swings += 1;
    if (session.swings >= PLAY_AUTO_CATCH) return ACTIONS.catch(session, { auto: true });
    if (session.swings === 1) return react(session, "play", { text: "猫じゃらしを小さく振る。てつこの目が、先を追った。", spot: "floor", fx: "toy" });
    if (session.swings === 2) return react(session, "play", { text: "てつこが身を低くした。狙っている。", face: "serious", pose: "low", spot: "floor", fx: "toy", art: "crouch" });
    return react(session, "play", { text: "前足が、さっと伸びた。", face: "surprise", pose: "paw", spot: "floor", fx: "toy", moment: "first_paw", art: "reach" });
  },
  catch(session, { auto = false } = {}) {
    session.swings = 0;
    if (session.stage === 0)
      return react(session, "catch", { text: auto ? "てつこが前足で押さえて、すぐに離した。" : "じゃらしを止めると、前足で押さえて、すぐに離した。",
        face: "serious", spot: "floor", fx: "toy" });
    return react(session, "catch", { text: auto ? "てつこが飛びついて、じゃらしを抱えこんだ。" : "じゃらしを止めると、てつこが抱えこんで離さない。",
      face: "smile", pose: "hug", spot: "floor", fx: "toy-held", moment: "hug_toy", art: "hug" });
  },
  brush(session) {
    session.brushes += 1;
    const spot = session.cat.inside || session.cat.spot === "lap" ? "bench" : session.cat.spot;
    if (session.brushes === 1)
      return react(session, "brush", { text: "背中にブラシを当てる。てつこの体から、力が抜けていく。", face: "smile", spot, fx: "fur", moment: "brush_bliss" });
    return react(session, "brush", { text: "ブラシを止めると、前足が手を追ってきた。", face: "normal", pose: "paw", spot, fx: "fur", art: "reach" });
  },
  // 一日一回の小さな楽しみ（店の人が用意した猫用のおやつ）。なくても関係は進む。
  // steps は画面が順に見せる途中の様子（匂いを確かめる→食べる）。最後が反応の本体（顔を洗う）。
  treat(session) {
    session.treatDay = session.day;
    const steps = [
      { text: "ムカイさんが置いている猫用のおやつを、小皿に少しだけ出す。", face: "normal", pose: "sit", spot: session.cat.inside ? "bench" : session.cat.spot, fx: "treat" },
      { text: "てつこが近づいてきて、匂いを確かめている。", face: "serious", pose: "low", spot: "floor", fx: "treat", art: "crouch" },
      { text: "てつこは、ゆっくり食べはじめた。", face: "smile", pose: "low", spot: "floor", fx: "treat", art: "crouch" },
    ];
    return { ...react(session, "treat", { text: "食べ終わると、前足で顔を洗いはじめた。", face: "smile", spot: "floor", fx: "treat-done", art: "groom" }), steps };
  },
  watch(session) {
    session.watches += 1;
    const mood = session.mood;
    if (session.stage >= 3 && (session.watches >= 2 || mood === "clingy")) {
      if (session.cat.pose === "lap") return react(session, "watch", { text: "膝の上で、てつこが寝息を立てている。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap" });
      return react(session, "watch", { text: "隣に座ると、てつこが膝に乗ってきた。そのまま丸くなる。", face: "sleep", pose: "lap", spot: "lap", moment: "lap_nap",
        line: { id: "lap", speaker: "mukai_master", text: "……起こすなよ" } });
    }
    if (session.watches === 1)
      return react(session, "watch", { text: "何もしないで、隣に座っている。てつこが前足をそろえて座り直した。", spot: session.cat.inside ? "bench" : session.cat.spot, moment: "paws_together" });
    return autonomous(session, { force: true });
  },
};

// 自律行動（画面を開いている間だけ・閉じている間は進めない）。when が真の物から引く。
// weight は気分で変える（{ 気分: 倍率 }）。moment があれば図鑑のしぐさ。
const AUTO = [
  { id: "yawn", when: () => true, weight: { calm: 1.4, sleepy: 1.6 },
    react: s => ({ text: "てつこが大きなあくびをした。", face: "surprise", art: "yawn" }) },
  { id: "groom", when: () => true, weight: { calm: 1.4 },
    react: s => ({ text: "てつこが前足をなめて、顔を洗っている。", face: "smile", art: "groom" }) },
  { id: "lean", when: () => true, weight: { calm: 1.2 },
    react: s => ({ text: "てつこが壁にもたれて、どっしり座りこんだ。", face: "serious", spot: "bench", art: "loaf" }) },
  { id: "door", when: () => true, weight: { clingy: 1.4 },
    react: s => ({ text: "てつこが、裏口の戸のほうを見ている。", flip: true, art: "lookback" }) },
  { id: "tail", when: () => true, weight: { playful: 1.2 },
    react: s => ({ text: "しっぽの先が、ゆっくり揺れている。", fx: "tail" }) },
  { id: "doze", when: s => s.mood === "sleepy", weight: { sleepy: 2 },
    react: s => ({ text: "てつこがうとうとしている。", face: "sleep", pose: "curl" }) },
  { id: "come", when: s => s.stage >= 2, weight: { clingy: 2 },
    react: s => ({ text: "てつこが、すぐ近くまで来て座った。", spot: "front" }) },
  { id: "box_in", when: s => has(s, "box"), weight: { playful: 1.4 },
    react: s => ({ text: "てつこが箱に入って、すっぽり収まった。", spot: slotOf(s, "box"), pose: "box", inside: "box" }) },
  { id: "box_peek", when: s => has(s, "box"), moment: "box_peek", weight: { playful: 1.2 },
    react: s => ({ text: "箱のふちから、顔だけ出している。", spot: slotOf(s, "box"), pose: "peek", inside: "box" }) },
  { id: "ball_paw", when: s => has(s, "ball"), weight: { playful: 1.6 },
    react: s => ({ text: "前足で、ボールをちょいと転がした。", face: "serious", pose: "paw", spot: "floor", inside: "ball", fx: "ball-roll", art: "reach" }) },
  { id: "ball_watch", when: s => has(s, "ball"), moment: "ball_watch", weight: { playful: 1.2 },
    react: s => ({ text: "転がっていくボールを、目だけで見送った。", face: "surprise", spot: "floor", inside: "ball", fx: "ball-away" }) },
  { id: "scratch", when: s => has(s, "scratcher"), weight: { playful: 1.4 },
    react: s => ({ text: "てつこが爪とぎで、がりがりと爪をといでいる。", face: "serious", pose: "paw", spot: "floor", inside: "scratcher", art: "stretch" }) },
  { id: "cushion", when: s => has(s, "cushion"), weight: { sleepy: 1.6, calm: 1.2 },
    react: s => ({ text: "座布団の上で、てつこが丸くなった。", face: "sleep", pose: "curl", spot: slotOf(s, "cushion"), inside: "cushion" }) },
  { id: "bed_sleep", when: s => has(s, "bed"), weight: { sleepy: 1.6 },
    react: s => ({ text: "てつこが猫ベッドで丸くなった。", face: "sleep", pose: "curl", spot: "bed", inside: "bed" }) },
  { id: "odd_sleep", when: s => s.stage >= 1 && (s.mood === "sleepy" || has(s, "cushion") || has(s, "bed")), moment: "odd_sleep", weight: { sleepy: 1.6 },
    react: s => {
      const on = has(s, "bed") ? "bed" : has(s, "cushion") ? "cushion" : null;
      return { text: "ひっくり返ったような格好で、てつこが寝ている。", face: "sleep", pose: "odd", spot: on ? slotOf(s, on) : "bench", inside: on, art: "belly" };
    } },
  { id: "box_over_bed", when: s => has(s, "bed") && has(s, "box"), moment: "box_over_bed", weight: {},
    react: s => ({ text: "新しいベッドには見向きもせず、てつこは箱に入った。", spot: slotOf(s, "box"), pose: "box", inside: "box",
      line: { id: "box_over_bed", speaker: "mukai_master", text: "……そっちか" } }) },
  { id: "tunnel", when: s => has(s, "tunnel"), weight: { playful: 1.4 },
    react: s => ({ text: "トンネルから、しっぽだけが出ている。", spot: "floor", pose: "tunnel", inside: "tunnel" }) },
  { id: "mashiro", when: s => s.metMashiro && s.stage >= 1 && !s.mashiroPassed, weight: { calm: 0.6, sleepy: 0.6, playful: 0.6, clingy: 0.6 },
    react: s => { s.mashiroPassed = true; return { text: "戸の向こうを、ましろちゃんが通った。てつこの耳が、すぐそっちを向く。", face: "surprise", flip: true, art: "lookback" }; } },
];
export const AUTO_IDS = Object.freeze(AUTO.map(item => item.id));

/**
 * 自律行動を一つ（画面のタイマーから呼ぶ）。1回おきに「座って落ち着く」待機（quiet: 見た目を変えない）を挟む。
 * 直前と同じ行動は引かない。条件を満たした未発見のしぐさを DISCOVERY_BIAS の割合で優先する。
 * @param {{ force?: boolean }} [opts] force: 待機を挟まずに必ず行動を引く（見守るから呼ぶ）
 */
export function autonomous(session, { force = false } = {}) {
  session.autoTicks += 1;
  if (!force && !session.curiousProp && session.autoTicks % 2 === 0) return { kind: "auto", id: "settle", quiet: true };
  const pool = AUTO.filter(item => item.id !== session.lastAuto && item.when(session));
  const fresh = pool.filter(item => item.moment && !session.found.includes(item.moment));
  const from = fresh.length && session.random() < DISCOVERY_BIAS ? fresh : pool;
  // 置いた物にはまず気づく。ランダム待ちだけでなく、模様替えが遊びにつながる。
  const curious = { box: "box_peek", ball: "ball_watch", cushion: "cushion", scratcher: "scratch", tunnel: "tunnel", bed: has(session, "box") ? "box_over_bed" : "bed_sleep" };
  const invited = session.curiousProp && AUTO.find(item => item.id === curious[session.curiousProp] && item.when(session));
  session.curiousProp = null;
  const item = invited || weighted(from, session);
  session.lastAuto = item.id;
  const shape = item.react(session);
  const reaction = react(session, "auto", { spot: shape.spot || restingSpot(session), ...shape, moment: item.moment || null });
  // 自分の目でしぐさを見届けたら、見守ったのと同じ（何もせず帰っただけ、にはしない）。
  if (reaction.found) session.meaningful = true;
  return { ...reaction, id: item.id };
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
  return react(session, "leave", { text: "帰ろうとすると、てつこが戸の前までついてきた。", face: "smile", spot: "front", moment: "see_off", art: "rub" });
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
  };
}

/** 未発見のしぐさの一言ヒント（図鑑）。 */
export const momentHint = id => MOMENTS.find(moment => moment.id === id)?.hint || "";
export const propById = id => PROP[id] || null;
export const momentById = id => MOMENTS.find(moment => moment.id === id) || null;
export { OUTINGS_FLAG };


/** 今できる小さな発見。能力・得点を増やさず「試す→反応→写真」の手がかりだけを返す。 */
export function discoveryGuide(session, preferred = null) {
  const guides = [
    { id: "first_paw", kind: "play", text: session.swings < 2 ? "じゃらしを振ると、目で追って……" : "狙っている。もうひと振り。" },
    { id: "hug_toy", when: session.stage >= 1, kind: toyOut(session) ? "catch" : "play", text: toyOut(session) ? "じゃらしを止めて、捕まえさせてみよう。" : "じゃらしを振ってから、止めてみよう。" },
    { id: "brush_bliss", when: canBrush(session), kind: "brush", text: "ブラシで、背中をゆっくり。" },
    { id: "paws_together", kind: "watch", text: "そっと見守ると、どんな顔をするかな。" },
    { id: "box_peek", kind: has(session, "box") ? "watch" : "decor", prop: "box", text: has(session, "box") ? "箱のそばで、そっと見守ろう。" : "もようがえで箱を置いてみよう。" },
    { id: "ball_watch", kind: has(session, "ball") ? "watch" : "decor", prop: "ball", text: has(session, "ball") ? "ボールをどうするか、見守ってみよう。" : "もようがえで床にボールを置こう。" },
    { id: "first_rub", when: session.stage >= 3, kind: "pet", text: "近くに来たら、そっとなでてみよう。" },
    { id: "lap_nap", when: session.stage >= 3, kind: "watch", text: "隣に座って、もう少し見守ろう。" },
    { id: "odd_sleep", when: session.stage >= 1, kind: session.mood === "sleepy" || has(session, "cushion") || has(session, "bed") ? "watch" : "decor", prop: "cushion", text: session.mood === "sleepy" || has(session, "cushion") || has(session, "bed") ? "眠れる場所で、ゆっくり待ってみよう。" : "座布団を置いて、くつろげる場所に。" },
    { id: "box_over_bed", when: session.stage >= 3, kind: has(session, "box") && has(session, "bed") ? "watch" : "decor", text: has(session, "box") && has(session, "bed") ? "箱とベッド、どちらが好きかな。" : "箱と猫ベッドを、両方置いてみよう。" },
  ].filter(item => item.when !== false && !session.found.includes(item.id));
  const pick = guides.find(item => item.id === preferred) || guides[0];
  if (!pick) return { id: null, kind: "watch", text: "今日は一緒に、のんびり。手帳はいつでも読める。" };
  return { ...pick, name: momentById(pick.id).name };
}
