// すれ違い（恋人の裏の数値）の決まり（純粋。DOM・再生・保存の呼び出しに触れない）。
// 2026-11-13 オーナー「彼女のストレスみたいな裏ステータスが一定に行くと別れ話になって、引き止めないと友達に戻る」
// 「よっぽど雑に扱うと別れ話」「2人以上なら動かすけど1人でもよっぽど放置とかしたり冷たくしてると起こる」
// 「引き止めは何度でも」「なぜ別れ話になったかわかりやすいように」「恋人増えれば増えるほど発生しやすい（女の勘）」（台帳 STR）。
//
// - 数値は画面にも台詞にも出さない。溜まるのは雑に扱った時だけ: 恋人のLIMEを何日も開かない・デートの誘いを断る／返事をしない・
//   プチ修羅場で勘づかれる。恋人が2人以上いる間は、何もしなくても少しずつ溜まる（女の勘。人数が多いほど速い）。
// - 減るのは、デート・LIMEの返事・その人の店へ顔を出すこと。記念日は数えない（オーナー「記念日は面倒なのでなくていい」）。
// - 4 と 7 で予兆（本人のLIMEと、はじめの独り言）、10 で夜の帰り道に別れ話。引き止めれば恋人のまま（何度でも）、
//   受け入れると友達に戻る。能力・お金・体力には一切触れない。
// - 止まっている間: はじめが東京・ドバイにいる・出発前の準備・修羅場が未解決。遠くに住む恋人（ましろ・ヌール）は対象外。
// 差し込み口と再生は daily/lover-strain.js、台本は data/dialogue/lover_strain.json、予兆のLIMEは remake/data/lover.json の strain。
import { relationshipElapsedDay, departurePrep } from "./chapter-clock.js";

/** 対象の恋人（地元で会える相手）。東京のましろ・ドバイのヌールは、会えないことを責められないので対象外 */
export const STRAIN_IDS = Object.freeze(["tsumugi", "minto", "rio", "ageha", "samechan", "hiyori"]);
export const STRAIN_SIGN1 = 4;   // 予兆①（素っ気ないLIME）
export const STRAIN_SIGN2 = 7;   // 予兆②（「話したい」のLIME）
export const STRAIN_TALK = 10;   // 別れ話
export const STRAIN_MAX = 12;    // これ以上は溜めない（一度のデートで予兆②まで戻れる幅）
/** 別れ話で彼女が口にする理由: 誘いを断り続けた／LIMEを開かない／ほかの誰かの気配（女の勘） */
export const STRAIN_CAUSES = Object.freeze(["decline", "unread", "suspect"]);
export const STRAIN_GAIN = Object.freeze({ decline: 2, expired: 1, unreadPerDay: 0.5, petit: 1 });
export const STRAIN_EASE = Object.freeze({ date: 4, reply: 1, visit: 1 });
export const STRAIN_UNREAD_DAYS = 2;  // 届いてからこの日数、開かれないLIMEを「放ってある」と数える
export const STRAIN_TALK_GAP = 7;     // 別れ話どうしの間隔（誰とでも。多くても週に一度）
export const STRAIN_TALK_REST = 14;   // 同じ相手との別れ話の間隔
export const STRAIN_KEEP_VALUE = 1;   // 向き合うと約束して引き止めた後の値
export const STRAIN_EXCUSE_VALUE = 5; // 言い訳で引き止めた後の値（予兆①のまま。次は早い）

const AWAY_REGIONS = Object.freeze(["tokyo", "dubai"]);
const round = n => Math.round(n * 100) / 100;
const plainObject = v => !!v && typeof v === "object" && !Array.isArray(v);

function store(value) {
  if (!plainObject(value.loverStrain)) value.loverStrain = {};
  if (!plainObject(value.loverStrain.by)) value.loverStrain.by = {};
  return value.loverStrain;
}

/** その恋人の記録（無ければ作る）。v: 数値 / why: 理由ごとの内訳 / sign: 見せた予兆の段 / talks: 別れ話の回数 */
export function strainRecord(value, id) {
  const by = store(value).by;
  const r = plainObject(by[id]) ? by[id] : (by[id] = {});
  r.v = Number.isFinite(r.v) && r.v > 0 ? Math.min(STRAIN_MAX, r.v) : 0;
  if (!plainObject(r.why)) r.why = {};
  r.sign = [1, 2].includes(r.sign) ? r.sign : 0;
  r.talks = Number.isInteger(r.talks) && r.talks > 0 ? r.talks : 0;
  return r;
}

/** 今の値（読むだけ。記録を作らない） */
export const strainOf = (value, id) => {
  const v = value?.loverStrain?.by?.[id]?.v;
  return Number.isFinite(v) && v > 0 ? v : 0;
};

/** 数値が動く恋人。サメちゃんと恋人として連絡を取り合うのは第2章から（romance.js の loverMessages と同じ） */
export const strainLovers = value => [...new Set(value?.lovers || [])]
  .filter(id => STRAIN_IDS.includes(id) && !(id === "samechan" && (value.chapter || 1) < 2));

/** 止まっている時期か: 対象の恋人がいない・修羅場が未解決・はじめが東京かドバイにいる・出発前の準備 */
export const strainPaused = value => !value || !strainLovers(value).length || !!value.flags?._story_shuraba_unresolved
  || AWAY_REGIONS.includes(value.flags?._ch2_region) || !!departurePrep(value);

/** 女の勘: 恋人が2人以上いる間、一日ごとに全員へ溜まる量（1人なら0。人数が多いほど速く、6人で頭打ち） */
export const strainDrift = count => round(Math.min(0.5, 0.1 * Math.max(0, (Number(count) || 0) - 1)));

/** 溜める。対象外の相手・止まっている恋人には何もしない。増えた量を返す */
export function addStrain(value, id, amount, cause) {
  if (!(amount > 0) || !strainLovers(value).includes(id)) return 0;
  const r = strainRecord(value, id);
  const next = round(Math.min(STRAIN_MAX, r.v + amount));
  const got = round(next - r.v);
  r.v = next;
  if (STRAIN_CAUSES.includes(cause)) r.why[cause] = round((r.why[cause] || 0) + amount);
  return got;
}

/** 減らす（理由の内訳も同じ割合で薄める）。減った量を返す */
export function easeStrain(value, id, amount) {
  const r = value?.loverStrain?.by?.[id];
  if (!plainObject(r) || !(amount > 0) || !(r.v > 0)) return 0;
  const next = round(Math.max(0, r.v - amount));
  const rate = next / r.v;
  for (const cause of STRAIN_CAUSES) if (r.why?.[cause]) r.why[cause] = round(r.why[cause] * rate);
  const eased = round(r.v - next);
  r.v = next;
  return eased;
}

/** いちばん効いている理由。内訳が無い時は、恋人が2人以上なら「気配」、1人なら「LIME」 */
export function strainCause(value, id) {
  const why = value?.loverStrain?.by?.[id]?.why || {};
  const top = STRAIN_CAUSES.reduce((best, cause) => (why[cause] || 0) > (why[best] || 0) ? cause : best, STRAIN_CAUSES[0]);
  return (why[top] || 0) > 0 ? top : (value?.lovers || []).length >= 2 ? "suspect" : "unread";
}

/** その恋人からのLIMEを、届いてから STRAIN_UNREAD_DAYS 日以上開いていないか */
export function strainUnread(value, id) {
  const today = relationshipElapsedDay(value);
  // 届いた日も今日と同じ数え方の通算日にそろえる（章をまたいだ翌朝を「何日も放ってある」と数えない）
  const arrived = item => relationshipElapsedDay({ flags: value.flags, chapter: item.chapter ?? value.chapter, day: item.day });
  return (value?.inbox || []).some(item => item && !item.read && item.msg?.lover && item.msg.sender === id
    && Number.isFinite(item.day) && today - arrived(item) >= STRAIN_UNREAD_DAYS);
}

const dateInvite = m => m?.type === "invitation" && /^date_/.test(m.accept_event || "");

/**
 * 受信箱とデートの記録から、まだ数えていない出来事を拾う（一件につき一度だけ。item.strain が数えた印）。
 * 誘いを断った +2・返事をしないまま流れた +1・返事の要るLIMEに返した −1・デートをした −4。
 * この仕組みが入る前から受信箱にあった分は、最初の一度だけ「数えた」ことにして、過去の辞退をさかのぼって責めない。
 */
export function syncStrain(value) {
  if (!value) return;
  const s = store(value);
  const ids = strainLovers(value);
  if (!s.init) {
    for (const item of value.inbox || []) if (item?.msg?.lover) item.strain = true;
    s.init = true;
  }
  for (const item of value.inbox || []) {
    const m = item?.msg;
    if (!m?.lover || item.strain || !ids.includes(m.sender)) continue;
    if (dateInvite(m)) {
      if (item.result === "declined") { addStrain(value, m.sender, STRAIN_GAIN.decline, "decline"); item.strain = true; }
      else if (item.result === "expired") { addStrain(value, m.sender, STRAIN_GAIN.expired, "decline"); item.strain = true; }
      else if (item.completed) item.strain = true; // 会えた誘い（デートそのものが下の lastDate で効く）
    } else if (m.replies?.length && item.replyState === "replied") {
      easeStrain(value, m.sender, STRAIN_EASE.reply);
      item.strain = true;
    }
  }
  for (const id of ids) {
    const r = strainRecord(value, id);
    const last = Number.isFinite(value.lastDate?.[id]) ? value.lastDate[id] : null;
    if (!("date" in r)) r.date = last; // 付き合う前・仕組みが入る前のデートは数えない
    else if (last !== null && r.date !== last) { easeStrain(value, id, STRAIN_EASE.date); r.date = last; }
  }
}

/**
 * 朝に一度だけ進める（同じ日に二度呼んでも二度目は何もしない）。
 * 戻り値: 今朝あらたに見せる予兆 [{ id, stage: 1 | 2, cause }]。
 */
export function tickStrain(value, today = relationshipElapsedDay(value)) {
  if (!value || !Number.isFinite(today)) return [];
  const s = store(value);
  if (s.day === today) return [];
  s.day = today;
  if (strainPaused(value)) return [];
  syncStrain(value);
  const drift = strainDrift((value.lovers || []).length);
  const events = [];
  for (const id of strainLovers(value)) {
    if (strainUnread(value, id)) addStrain(value, id, STRAIN_GAIN.unreadPerDay, "unread");
    if (drift > 0) addStrain(value, id, drift, "suspect");
    const r = strainRecord(value, id);
    const stage = r.v >= STRAIN_SIGN2 ? 2 : r.v >= STRAIN_SIGN1 ? 1 : 0;
    if (stage > r.sign) {
      r.sign = stage;
      events.push({ id, stage, cause: strainCause(value, id) });
    } else if (stage < r.sign && r.v < (r.sign === 2 ? STRAIN_SIGN2 : STRAIN_SIGN1) - 1) {
      r.sign = stage; // 1 だけ余裕を持って下げる（境目を行き来して同じ予兆を繰り返さない）
    }
  }
  return events;
}

/** 今夜、別れ話を切り出す恋人（いなければ null）。いちばん溜まっている一人だけ。 */
export function strainTalkPick(value, today = relationshipElapsedDay(value)) {
  if (strainPaused(value) || !Number.isFinite(today)) return null;
  const s = store(value);
  if (Number.isFinite(s.lastTalk) && today - s.lastTalk < STRAIN_TALK_GAP) return null;
  const due = strainLovers(value).map(id => ({ id, r: strainRecord(value, id) }))
    .filter(({ r }) => r.v >= STRAIN_TALK && !(Number.isFinite(r.talkDay) && today - r.talkDay < STRAIN_TALK_REST))
    .sort((a, b) => b.r.v - a.r.v)[0];
  return due ? { id: due.id, cause: strainCause(value, due.id), again: due.r.talks > 0 } : null;
}

/** 恋人から友達へ戻す。好感度・絆の段・読んだ場面は消さない。約束していたデートと、返事待ちの誘いは流す。 */
export function endLoverRelation(value, id, today = relationshipElapsedDay(value)) {
  if (!value || !(value.lovers || []).includes(id)) return false;
  value.lovers = value.lovers.filter(other => other !== id);
  value.flags[`_friend_${id}`] = true; // 「友達のまま」と同じ印（帰り道の告白をもう一度始めない）
  Object.assign(strainRecord(value, id), { v: 0, why: {}, sign: 0, ex: Number.isFinite(today) ? today : null });
  if (value.pendingInvite?.sender === id && /^date_/.test(value.pendingInvite.event || "")) value.pendingInvite = null;
  for (const item of value.inbox || []) {
    if (item?.msg?.sender !== id || !item.msg.lover || item.done || item.msg.type !== "invitation") continue;
    Object.assign(item, { done: true, result: "expired", replyState: "expired", strain: true });
  }
  if (value.flags._confession_due === id) delete value.flags._confession_due;
  return true;
}

/**
 * 別れ話の結果を記録する。outcome: "keep" 向き合うと約束して引き止めた / "excuse" 言い訳で引き止めた / "end" 受け入れた。
 * 引き止めに回数の上限は無い。同じ相手とは STRAIN_TALK_REST 日、誰とでも STRAIN_TALK_GAP 日は次の別れ話が起きない。
 */
export function settleStrainTalk(value, id, outcome, today = relationshipElapsedDay(value)) {
  if (!value || !(value.lovers || []).includes(id)) return false;
  const s = store(value), r = strainRecord(value, id);
  r.talks += 1;
  if (Number.isFinite(today)) { r.talkDay = today; s.lastTalk = today; }
  if (outcome === "end") return endLoverRelation(value, id, today);
  if (outcome === "excuse") {
    const rate = r.v > 0 ? STRAIN_EXCUSE_VALUE / r.v : 0;
    for (const cause of STRAIN_CAUSES) if (r.why[cause]) r.why[cause] = round(r.why[cause] * rate);
    r.v = STRAIN_EXCUSE_VALUE;
    r.sign = 1;
  } else {
    r.v = STRAIN_KEEP_VALUE;
    r.why = {};
    r.sign = 0;
  }
  return true;
}

/** プチ修羅場に居合わせた恋人は、少し勘づく */
export function strainSuspect(value, ids, amount = STRAIN_GAIN.petit) {
  if (strainPaused(value)) return;
  for (const id of new Set(ids || [])) addStrain(value, id, amount, "suspect");
}

/** その人の店へ顔を出した（一日一度だけ効く）。減った量を返す */
export function strainVisit(value, id, today = relationshipElapsedDay(value)) {
  if (!value || !strainLovers(value).includes(id) || !Number.isFinite(today)) return 0;
  const r = strainRecord(value, id);
  if (r.visit === today) return 0;
  r.visit = today;
  return easeStrain(value, id, STRAIN_EASE.visit);
}

/** 予兆のLIME（remake/data/lover.json の strain.sign1 / sign2）。文面が無い相手は null */
export function strainSignMessage(lover, id, stage, today) {
  const line = lover?.strain?.[`sign${stage}`]?.[id];
  if (!line?.m?.length) return null;
  return { id: `_lover_strain_${id}_s${stage}_t${today}`, sender: id, type: "chat", lover: true,
    messages: [...line.m], ...(line.r?.length ? { replies: line.r.map(reply => ({ ...reply })) } : {}) };
}

/** 別れ話の台本（data/dialogue/lover_strain.json）。再生する側が、使う時にまとめて読む */
export const STRAIN_SCENES = Object.freeze(STRAIN_IDS.flatMap(id => [
  `strain_talk_open_${id}`, `strain_talk_again_${id}`,
  ...STRAIN_CAUSES.map(cause => `strain_talk_why_${cause}_${id}`), `strain_talk_ask_${id}`,
]));

/** 選んだ答えを台本から受け取る印（再生の前後で必ず消す） */
export const STRAIN_OUTCOME_FLAGS = Object.freeze({ keep: "_strain_keep", excuse: "_strain_excuse", end: "_strain_end" });

/** 今夜の別れ話に使う場面の並び: 切り出し →（二度目からの一言）→ 理由 → 問いかけと答え */
export const strainTalkScenes = pick => [`strain_talk_open_${pick.id}`, ...(pick.again ? [`strain_talk_again_${pick.id}`] : []),
  `strain_talk_why_${pick.cause}_${pick.id}`, `strain_talk_ask_${pick.id}`];

/** 場面を一つの会話につなぐ（私的な場面なので、みんとは栞として名前が出る）。足りなければ null */
export function joinStrainScenes(dialogues, ids) {
  const parts = ids.map(id => dialogues?.[id]);
  if (parts.some(part => !part?.lines?.length)) return null;
  return { dialogue_id: ids[0], metadata: { private_scene: true }, lines: parts.flatMap(part => part.lines),
    branches: Object.assign({}, ...parts.map(part => part.branches || {})) };
}
