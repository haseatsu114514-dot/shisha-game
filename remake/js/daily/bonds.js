// 交友の締めくくり（好感度MAXイベント）・途中の恋愛／友情の質問・専用ハガルの贈呈（HF04〜HF06）。
// 文面の正本: data/dialogue/ch1_bonds.json（質問・締めくくり）、贈り物の性能: data/equipment.json（gift）、
// 私的な約束の誘い: data/lime_messages.json（delivery: "bond_finale"・ここで日付つきに複製して届ける）。
//
// - 固有会話を全部読み、好感度MAX（恋人を含む）になった相手は、次に会うと締めくくりの場面になる。
//   MAXだけを理由に前半の固有会話は飛ばさない。締めくくりは一度だけで、終わりに専用ハガルを受け取る。
// - 恋愛対象には途中で人物ごとの質問がある（choice.romance＝隠し恋愛値・選択肢 id ごとに一度だけ数える）。
//   友情寄りに答えた相手は、締めくくりも友情の着地になり告白は起きない。答えた質問がすべて恋愛寄りで、
//   締めくくりの最後の質問でも恋愛を選んだ相手だけが恋愛ルートに入り、告白を予約する（再生時も romance.js で確かめる）。
//   旧セーブで読み終えていた質問は推測で埋めない（答えていない質問は数えないだけ）。
// - 友情ルートでも締めくくりの場面と贈り物は同じだけ受け取れる。
// - 友人になった後（友情の締めくくり・告白で友達のまま）は、たまにシーシャのお誘いか雑談のLIMEが届く（HF09）。
//   文面と間隔は remake/data/friends.json。友人のLIMEは全員あわせて数日に1通、お誘いは全員あわせて週に1回ほど、
//   物語・恋人の誘いと同じ朝には重ねない（スミさんのバイトの誘いとは重なってよい）。恋人と告白待ちの相手には届かない。
import { DB, callName } from "../core/data.js";
import { state, save } from "../core/state.js";
import { affinityLevel, AFFINITY_GATE_CHOICES, releaseAffinity } from "../core/stats.js";
import { AGEHA_AFFINITY_VISITS, questionComplete, questionDoneKey, CH2_VISIT_STORIES, ch2VisitStoriesDone, mashiroScenesRead } from "../core/affinity-stages.js";
import { emit } from "../core/bus.js";
import { play } from "../vn/engine.js";
import { giftOpen } from "../core/scene-motions.js";
import { isLover, romanceRouteOpen } from "./romance.js";
import { VISIT_SEQ, storyCount, hasContact } from "./spots.js";
import { hiyoriRoute, hiyoriStoriesDone, hiyoriFinaleReady } from "../core/hiyori-route.js";
// #2090: 第2章の対峙（決裂・休業）以降か。spots.js / core/fortune-effects.js の naruRiftActive と同じ条件（試験の依存を増やさないため写し）
const naruRiftActive = (save) => (save?.chapter || 1) >= 2 && !!(save?.flags?._ch2_read_ch2_naru_confrontation
  || save?.flags?._ch2_night_11_done || save?.flags?._ch2_naru_listened || save?.flags?._ch2_naru_hurt);

/**
 * 締めくくり（好感度MAXイベント）。gift=受け取る専用ハガル（equipment.json）、question=最後の質問の選択肢 id。
 * night=閉店後の場面（夜の訪問でだけ始まる）。invite=店ではなく私的な約束（LIMEの誘い）で会う
 */
export const BOND_FINALES = {
  sumi: { dialogue: "ch1_sumi_bond_finale", gift: "suyaki_sumi", night: true },
  naru: { dialogue: "ch1_naru_bond_finale", gift: "suyaki_naru" },
  adam: { dialogue: "ch1_adam_bond_finale", gift: "suyaki_adam" },
  tsumugi: { dialogue: "ch1_tsumugi_bond_finale", gift: "suyaki_tsumugi", night: true, question: "bond_q2_tsumugi" },
  minto: { dialogue: "ch1_minto_bond_finale", gift: "suyaki_minto", invite: "lime_minto_bond_finale", question: "bond_q2_minto" },
  rin: { dialogue: "ch1_rin_bond_finale", gift: "suyaki_rin", question: "bond_q2_rin" },
  // 第2章の店（柚ヶ谷）で会う。訪問列（CH2_VISIT_STORIES）を読み終えた♥5の次の来店で一度だけ（#2027）
  kumicho: { dialogue: "ch2_kumicho_bond_finale", gift: "suyaki_kumicho" },
  rei: { dialogue: "ch2_rei_bond_finale", gift: "suyaki_rei" },
  samechan: { dialogue: "samechan_bond_finale", gift: "suyaki_samechan", night: true, question: "bond_q2_samechan" },
  // あげは（#2023）: 第2章のMELTY PUFFで。方向は♥3の答え（bond_q1_ageha）だけで決まり、最後の質問は置かない。
  // 告白は日常の予約ではなく、第3章の帰郷後に ch3-romance-entry.js が出す（laterConfession）。
  ageha: { dialogue: "ch2_ageha_bond_finale", gift: "suyaki_ageha", laterConfession: true },
  // ましろ（#2022）: 第3章の場面カードから（chapters/ch3.js）。告白は仮置きの寄り道 confession_mashiro（#1930）が担うので予約しない。
  mashiro: { dialogue: "ch3_mashiro_bond_finale", gift: "suyaki_mashiro", question: "bond_q2_mashiro", ownConfession: true },
  hiyori: {
    get dialogue() { return hiyoriRoute().finale?.dialogue || ""; },
    get gift() { return hiyoriRoute().finale?.gift || null; },
    get question() { return hiyoriRoute().finale?.question || ""; },
    get flag() { return hiyoriRoute().finale?.flag || ""; },
    get night() { return !!hiyoriRoute().finale?.night; },
  },
};

/**
 * 途中の質問（恋愛／友情）。host を読んだ直後（after）か、host の後の最初の訪問（visit）で一度だけ。
 * choice は data 側の選択肢 id（romance_char つき）
 */
export const BOND_QUESTIONS = {
  tsumugi: { dialogue: "ch1_tsumugi_bond_question", choice: AFFINITY_GATE_CHOICES.tsumugi, host: "ch1_tsumugi_fourth", when: "after" },
  minto: { dialogue: "ch1_minto_bond_question", choice: AFFINITY_GATE_CHOICES.minto, host: "ch1_minto_private_1", alsoAfter: ["ch1_minto_fifth"], when: "after" },
  rin: { dialogue: "ch1_rin_bond_question", choice: AFFINITY_GATE_CHOICES.rin, host: "ch1_rin_third", when: "visit" },
  // あげは（#1988）: 第2章の店に通う回「初めての客」（♥3）を読んだ直後。第3章の帰郷後の告白はこの答えが恋愛寄りで♥5のときだけ。
  ageha: { dialogue: "ch2_ageha_bond_question", choice: AFFINITY_GATE_CHOICES.ageha, host: "remake_ch2_ageha_newcomer", when: "after" },
  // ましろ（#2022）: 第3章の寄り道「閉店後の練習」を読んだ後、♥3で場面カードから。
  mashiro: { dialogue: "ch3_mashiro_bond_question", choice: AFFINITY_GATE_CHOICES.mashiro, host: "ch3_mashiro_practice", when: "visit" },
  hiyori: {
    get dialogue() { return hiyoriRoute().question?.dialogue || ""; },
    get choice() { return hiyoriRoute().question?.choice || ""; },
    get host() { return hiyoriRoute().question?.host || ""; },
    when: "after",
  },
};

// ---------------------------------------------------------------- 隠し恋愛値

/** 隠し恋愛値（恋愛寄りに答えた数）。プレイヤーには見せない */
export const romanceValue = (id) => state.romance?.[id] || 0;
const answers = (id) => Object.values(state.romanceChoices || {}).filter((a) => a.char === id);

/** 選んだ答えを記録する（engine の onChoice から）。同じ選択肢 id は一度だけ＝再読で稼げない */
export function recordRomanceChoice(line, choice) {
  const char = line?.romance_char;
  const key = line?.id;
  if (!char || !key || !Number.isFinite(choice?.romance)) return false;
  state.romanceChoices ||= {};
  state.romance ||= {};
  if (state.romanceChoices[key]) return false;
  const value = Math.max(0, Math.round(choice.romance));
  state.romanceChoices[key] = { char, value, day: state.day };
  if (value > 0) state.romance[char] = romanceValue(char) + value;
  return true;
}

/** まだ恋愛に進める相手か（友情寄りの答えも、断った告白もない）。締めくくりの最後の質問を出す条件 */
export function romanceOpen(id) {
  if (id === "hiyori" && !hiyoriFinaleReady()) return false;
  if (id === "samechan" && (!(state.chapter >= 2 && state.chapter <= 3)
    || !state.flags._samechan_bond_question_done
    || state.romanceChoices?.bond_q1_samechan?.char !== id)) return false;
  const def = BOND_FINALES[id];
  // 最後の質問がない相手は、実際に答えた質問がある時だけ（未回答を恋愛と推測しない）
  return !!(def?.question || def?.laterConfession && answers(id).length) && !isLover(id) && !state.flags[`_friend_${id}`]
    && answers(id).every((a) => a.value > 0);
}

/** 恋愛の答えを重ねたか（答えた質問がすべて恋愛寄りで、締めくくりの最後の質問でも恋愛を選んだ） */
function romanceChosen(id) {
  if (BOND_FINALES[id]?.laterConfession) return romanceOpen(id);
  const last = BOND_FINALES[id]?.question;
  return !!last && (state.romanceChoices?.[last]?.value || 0) > 0 && romanceOpen(id);
}

/** 会話の条件分岐（hooks.evalCondition）: lover / romance_open / finale_seen（締めくくりを読んだか）。知らない型は undefined */
export function bondCondition(line) {
  if (line.condition_type === "lover") return isLover(line.char_id);
  if (line.condition_type === "romance_open") return romanceOpen(line.char_id);
  if (line.condition_type === "finale_seen") return finaleSeen(line.char_id);
  return undefined;
}

// ---------------------------------------------------------------- 途中の質問

/** 固有会話（host）を読んだ直後に呼ぶ。対応する質問が残っていれば続けて出す */
export async function afterStory(dialogueId, { bg = null, signal = null, deferSave = false } = {}) {
  if (hiyoriRoute().question?.host && dialogueId === hiyoriRoute().question.host) return playHiyoriQuestion({ bg, signal, deferSave });
  for (const [id, q] of Object.entries(BOND_QUESTIONS)) {
    if (q.when !== "after" || !(q.host === dialogueId || q.alsoAfter?.includes(dialogueId)) || !questionOpen(id)) continue;
    return playQuestionVisit(id, { bg, signal, deferSave });
  }
  return true;
}

/** 保存済みの実回答から反応へ戻す。友人のvalue:0も回答で、再選択・再加算しない。 */
function resumeChoice(scene, key, answer) {
  if (!answer || !scene) return scene;
  const rows = lines => (lines || []).flatMap(line => {
    if (line.type !== "choice" || line.id !== key) return [line];
    const selected = line.choices.find(c => (c.romance > 0) === (answer.value > 0));
    return selected ? scene.branches?.[selected.next] || [] : [line];
  });
  return { ...scene, lines: rows(scene.lines), branches: Object.fromEntries(Object.entries(scene.branches || {}).map(([k,v]) => [k,rows(v)])) };
}

/** 質問を実際に再生できるか。地図の在店表示も同じ条件を読む。 */
export function hiyoriQuestionReady() {
  const q = hiyoriRoute().question, scene = DB.dialogues[q?.dialogue];
  if (!state || !hiyoriRoute().enabled || !state.flags._hiyori_work_talk_done
    || !state.flags._hiyori_real_self_known || !state.met.hiyori || ![1,2].includes(state.chapter)
    || !q?.flag || state.flags[q.flag] || !scene?.lines?.length || scene.metadata?.preview_only
    || finaleSeen("hiyori") || isLover("hiyori") || state.flags._friend_hiyori) return false;
  const answer = state.romanceChoices[q.choice];
  return !answer || answer.char === "hiyori" && Number.isFinite(answer.value) && answer.value >= 0;
}

/** 正式仕事相談の後、質問の反応も読み終えてから締めくくりへ進む。 */
export async function playHiyoriQuestion({ bg = null, signal = null, deferSave = false } = {}) {
  if (!hiyoriQuestionReady() || signal?.aborted) return false;
  const q = hiyoriRoute().question, scene = DB.dialogues[q.dialogue];
  const answer = state.romanceChoices[q.choice];
  const owner = state;
  const result = await play(resumeChoice(scene,q.choice,answer), { ...(bg && !scene.metadata?.bg ? { bg } : {}), signal });
  if (state !== owner || signal?.aborted || (!result || result.cancelled) || state.romanceChoices[q.choice]?.char !== "hiyori") return false;
  state.flags[q.flag] = true;
  releaseAffinity("hiyori");
  if (!deferSave) save();
  return true;
}

const questionOpen = (id) => {
  if (id === "hiyori" && !hiyoriRoute().enabled) return false;
  if (id === "mashiro" && state.chapter !== 3) return false;
  if (AFFINITY_GATE_CHOICES[id] && affinityLevel(id) < 3) return false;
  const q = BOND_QUESTIONS[id];
  const answer = state.romanceChoices?.[q?.choice];
  return !!q && !!DB.dialogues[q.dialogue]?.lines?.length && !questionComplete(state, id)
    && (!answer || answer.char === id && Number.isFinite(answer.value) && answer.value >= 0);
};
const hostSeen = (id) => {
  if (id === "minto") return !!(state.flags._minto_private_done || state.flags._minto_fifth_done);
  if (id === "ageha") return !!state.flags[`_ch2_read_${BOND_QUESTIONS.ageha.host}`];
  if (id === "mashiro") return !!state.flags[`_ch3_read_${BOND_QUESTIONS.mashiro.host}`];
  const q = BOND_QUESTIONS[id];
  const at = (VISIT_SEQ[id] || []).indexOf(q?.host);
  return at >= 0 && storyCount(id) > at;
};

/** 節目の読了と♥3が揃った次の実対面。先に節目を読んだ旧進行も未回答の質問を受け取る。 */
export const questionVisitDue = (id) => (BOND_QUESTIONS[id]?.when === "visit" || !!AFFINITY_GATE_CHOICES[id])
  && questionOpen(id) && hostSeen(id);

/** 訪問の中で質問の場面を出す（通い訪問の小会話の代わり） */
const questionsInFlight = new WeakMap();
export async function playQuestionVisit(id, { bg = null, signal = null, deferSave = false } = {}) {
  if (id === "hiyori") return playHiyoriQuestion({ bg, signal, deferSave });
  if (!questionOpen(id) || signal?.aborted) return false;
  const q = BOND_QUESTIONS[id], owner = state;
  const active = questionsInFlight.get(owner) || new Set();
  if (active.has(id)) return false;
  questionsInFlight.set(owner, active); active.add(id);
  try {
    const scene = DB.dialogues[q.dialogue];
    const script = resumeChoice(scene, q.choice, state.romanceChoices?.[q.choice]);
    const result = await play(script, { ...(bg && !scene.metadata?.bg ? { bg } : {}), signal });
    const answer = state.romanceChoices?.[q.choice];
    if (state !== owner || signal?.aborted || (!result || result.cancelled)
      || answer?.char !== id || !Number.isFinite(answer.value) || answer.value < 0) return false;
    state.flags[questionDoneKey(id)] = true;
    releaseAffinity(id);
    if (!deferSave) save();
    return true;
  } finally { active.delete(id); }
}

// ---------------------------------------------------------------- 締めくくり（好感度MAXイベント）

export const finaleSeen = (id) => !!state.finales?.[id];
const storiesDone = (id) => id === "hiyori" ? hiyoriStoriesDone()
  : id === "mashiro" ? mashiroScenesRead(state.flags) && questionComplete(state, id)
  : id === "samechan"
  ? storyCount(id) >= 3 && !!state.flags._samechan_quiet_seat_done && !!state.flags._samechan_closing_check_done
    && (isLover(id) || !!state.flags._friend_samechan || !!state.flags._samechan_bond_question_done
      && state.romanceChoices?.bond_q1_samechan?.char === id)
  : id === "ageha" ? AGEHA_AFFINITY_VISITS.every((scene) => !!state.flags[`_ch2_read_${scene}`]) && questionComplete(state, id)
  : CH2_VISIT_STORIES[id] ? ch2VisitStoriesDone(state.flags, id)
  : storyCount(id) >= (VISIT_SEQ[id] || []).length
    && (!AFFINITY_GATE_CHOICES[id] || questionComplete(state, id));

/**
 * 締めくくりを始められるか: 固有会話を全部読み、好感度MAX（恋人も含む）で、まだ読んでいない。
 * みんとは私的な場面で会うので、私服の約束で本名を聞いた後
 */
export function finaleDue(id) {
  if (id === "hiyori" && !hiyoriFinaleReady()) return false;
  if (id === "samechan" && (state.chapter || 1) < 2) return false;
  if (id === "ageha" && state.chapter !== 2) return false; // MELTY PUFFに通えるのは第2章だけ
  if (id === "mashiro" && state.chapter !== 3) return false;
  const def = BOND_FINALES[id];
  if (!def || finaleSeen(id) || !DB.dialogues[def.dialogue] || !storiesDone(id)) return false;
  if (affinityLevel(id) < 5 || questionVisitDue(id)) return false;
  // つむぎは第1章本筋のDAY11「絵を描き終えて応募する」を関係の節目にする。
  // DAY12以降は旧セーブで当時の読了フラグが欠ける場合だけ進行不能を避けるフォールバック。
  if (id === "tsumugi" && (state.chapter || 1) === 1 && state.day < 12 && !state.flags._tsumugi_contest_submitted) return false;
  if (id === "minto" && !(state.flags._minto_identity_revealed && state.flags._minto_name_known)) return false;
  return true;
}

/** 店で会ったときに始めるか（私的な約束で会う相手は除く・閉店後の場面は夜だけ） */
export const finaleAtVisit = (id) => finaleDue(id) && !BOND_FINALES[id].invite && (!BOND_FINALES[id].night || state.slot >= 1);
export const isFinaleEvent = (dialogueId) => Object.values(BOND_FINALES).some((d) => d.dialogue === dialogueId);

/** 締めくくりを再生し、ルート（恋人／恋愛／友情）を記録して専用ハガルを渡す。一度だけ */
export async function playFinale(id, { bg = null, deferSave = false, signal = null } = {}) {
  if (["hiyori", "samechan", "mashiro"].includes(id) && !finaleDue(id)) return false;
  const def = BOND_FINALES[id];
  if (!def || finaleSeen(id) || !DB.dialogues[def.dialogue]) return false;
  const owner = state;
  // 中断保存に実回答が残ったサメちゃんの最終質問は、その答えの続きへ戻す。
  // 未回答を補わず、読み直しで気持ちを変更/加算しない。
  const answer = ["samechan", "hiyori"].includes(id) && state.romanceChoices?.[def.question];
  if (id === "hiyori" && answer && (answer.char !== id || !Number.isFinite(answer.value) || answer.value < 0)) return false;
  const scene = DB.dialogues[def.dialogue];
  if (!scene) return false;
  const resumeRows = rows => (rows || []).flatMap(line => {
    if (line.type !== "choice" || line.id !== def.question) return [line];
    const choice = line.choices.find(c => (c.romance > 0) === (answer.value > 0));
    return scene.branches?.[choice.next] || [];
  });
  const script = answer ? { ...scene, lines: resumeRows(scene.lines),
    branches: Object.fromEntries(Object.entries(scene.branches || {}).map(([key, rows]) => [key, resumeRows(rows)])) } : def.dialogue;
  const result = await play(script, { ...(bg && !scene.metadata?.bg ? { bg } : {}), signal });
  if (state !== owner || (!result || result.cancelled) || signal?.aborted) return false;
  const route = isLover(id) ? "lover" : romanceChosen(id) ? "romance" : "friend";
  if (!state.owned.includes(def.gift)) await giftOpen(def.gift); // 箱がほどけて専用ハガルが出てくる（受け取りの通知はこの後）
  if (state !== owner || signal?.aborted) return false;
  state.finales ||= {};
  state.finales[id] = { day: state.day, chapter: state.chapter, route };
  if (def.flag) state.flags[def.flag] = true;
  grantGift(def.gift);
  // 恋愛ルート: 告白を予約（一日の終わりに、再生前にもう一度ルートを確かめる）
  if (route === "romance" && !def.laterConfession && !def.ownConfession && romanceRouteOpen(id) && !state.flags._confession_due) state.flags._confession_due = id;
  if (!deferSave) save(); // 有料訪問はcalendarの支払い/行動確定と同時に保存する。
  return true;
}

/** 専用ハガルを所持品へ（一度だけ）。対象のフレーバーが店に並んでいない相手は、葉も一箱ぶん添える */
export function grantGift(giftId) {
  const gear = DB.equipById[giftId];
  if (!gear || state.owned.includes(giftId)) return false;
  state.owned.push(giftId);
  const leaf = gear.gift?.flavor;
  const grams = gear.gift?.leaf_grams || 0;
  if (leaf && grams > 0 && DB.flavorById[leaf]) {
    state.flavorStock ||= {};
    state.flavorStock[leaf] = Math.max(0, state.flavorStock[leaf] || 0) + grams;
    if (!state.flavors.includes(leaf)) state.flavors.push(leaf);
  }
  emit("notice", { text: `「${gear.name}」を受け取った（持ち物から機材として選べる）` });
  return true;
}

// ---------------------------------------------------------------- 私的な約束で会う相手の誘い（LIME）

/**
 * 今朝届く締めくくりの誘い（data/lime_messages.json の delivery: "bond_finale" を日付つきに複製）。
 * 章をまたいでも、断ったり約束が流れたりしても、締めくくりを読むまで二日おきに改めて届く。
 * 時刻は phone.js が休日午後か仕事後に決める
 */
export function bondInvites({ tournamentDay = false } = {}) {
  if (tournamentDay || state.phase !== "daily") return [];
  const out = [];
  for (const [id, def] of Object.entries(BOND_FINALES)) {
    if (!def.invite || !finaleDue(id) || !hasContact(id)) continue;
    const template = DB.lime.find((m) => m.id === def.invite);
    if (!template) continue;
    const sent = (state.inbox || []).filter((i) => (i.originId || i.id) === template.id);
    if (sent.some((i) => !i.done) || state.pendingInvite?.event === template.accept_event) continue;
    const last = Math.max(-9, ...sent.map((i) => i.day || 0));
    if (state.day - last < 2) continue;
    const msgId = `${template.id}_c${state.chapter || 1}_d${state.day}`;
    if (state.limeRead.includes(msgId)) continue;
    out.push({ ...template, id: msgId, origin_id: template.id, important: true,
      messages: sent.length && template.reminder_text ? [template.reminder_text, ...template.messages] : template.messages });
  }
  return out;
}

// ---------------------------------------------------------------- 友人になった後の、たまのLIME（HF09）

const FRIEND_PREFIX = "_friend_";
const friendData = (id) => DB.friends?.friends?.[id];

/**
 * 友人として落ち着いた相手か: 締めくくりを読み、恋人ではなく、友情の着地か告白で「友達のまま」を選んだ。
 * 告白を待つ恋愛ルートの相手は、まだ友人扱いにしない
 */
export function settledFriend(id) {
  const f = state.finales?.[id];
  return !!f && !!friendData(id) && !isLover(id) && (f.route === "friend" || !!state.flags[`_friend_${id}`]);
}

/** 届いた友人のLIME（雑談・お誘い）の履歴。id を渡すとその相手の分だけ */
const friendSent = (id = null) => (state.inbox || [])
  .filter((i) => String(i.originId || i.id).startsWith(FRIEND_PREFIX) && (!id || i.msg?.sender === id));
const lastDay = (items) => Math.max(-99, ...items.map((i) => i.day ?? -99));

/**
 * 今朝の友人のLIMEの候補（雑談かシーシャのお誘い）。phone.js が1通だけ採る。
 * 何人と友人になっても重ならないよう、全員で間隔を分け合う（data: remake/data/friends.json）:
 * - 友人のLIMEは全員あわせて globalGapDays 日に1通まで。いちばん長く連絡のない相手から順（同じ相手は gapDays 日以上あける）
 * - お誘いは全員あわせて inviteGapDays 日に1回まで。その相手との雑談のあとだけ（最初の連絡は雑談・お誘いは続けない）。
 *   約束のある日は出さず同じ相手の雑談に（物語・恋人の誘いが届く朝と、時刻の合わない日の切り替えは phone.js。バイトの誘いとは重なってよい）。各章の大会当日を除く
 */
export function friendMessages({ tournamentDay = false, sceneChapter = false } = {}) {
  // sceneChapter: 場面カード式の第3〜5章（chapters/friend-entry.js）から。日常の朝の端末は無いので phase は見ない。
  // お誘いの約束は第1・2章の calendar.js 専用なので、第3章以降は雑談だけ（#2022）。
  if (tournamentDay) return [];
  if (sceneChapter ? ![3, 4, 5].includes(state.chapter) : (state.phase !== "daily" || ![1, 2].includes(state.chapter || 1))) return [];
  const cfg = DB.friends || {};
  const gap = cfg.gapDays || 4;
  const all = friendSent();
  if (state.day - lastDay(all) < (cfg.globalGapDays || 2)) return [];
  const inviteOk = !state.pendingInvite
    && state.day - lastDay(all.filter((i) => i.msg?.type === "invitation")) >= (cfg.inviteGapDays || 6);
  const out = [];
  const due = Object.keys(BOND_FINALES)
    .filter((id) => settledFriend(id) && hasContact(id) && !(id === "naru" && naruRiftActive(state))) // #2090
    .map((id) => {
      const sent = friendSent(id);
      return { id, sent, last: Math.max(state.finales[id].day || 0, lastDay(sent)) };
    })
    .filter((c) => state.day - c.last >= gap && !c.sent.some((i) => !i.read))
    .sort((a, b) => a.last - b.last);
  for (const { id, sent } of due) {
    const f = friendData(id);
    const chats = sent.filter((i) => i.msg.type === "chat").length;
    // 出来事前提の雑談は、前提が揃うまで chats[0] へ退避（TL-01: 素焼き贈呈・正体開示は締めくくりで保証される前提だが、旧セーブ等でも先出ししない防御）
    let pick = f.chats?.length ? chats % f.chats.length : 0;
    if ((pick === 2 && ["minto", "tsumugi", "rin", "kumicho", "rei", "mashiro", "samechan"].includes(id) && !state.owned.includes(`suyaki_${id}`))
      || (pick === 1 && id === "adam" && !state.owned.includes("suyaki_adam"))
      || (pick === 1 && id === "minto" && !state.flags._minto_identity_revealed)) pick = 0;
    const chat = f.chats?.length ? { id: `${FRIEND_PREFIX}chat_${id}_d${state.day}`, sender: id, type: "chat", friend: true,
      messages: f.chats[pick].m.slice(), replies: f.chats[pick].r } : null;
    const invite = f.invite ? { id: `${FRIEND_PREFIX}inv_${id}_d${state.day}`, sender: id, type: "invitation", friend: true,
      private_schedule: "holiday_or_after_close", accept_event: `friend_${id}`, accept_text: f.invite.accept_text,
      messages: f.invite.messages.slice(), decline_response: { text: f.invite.decline } } : null;
    const inviteTurn = !sceneChapter && inviteOk && sent.at(-1)?.msg?.type === "chat"; // 雑談→お誘い→雑談…（見送った回は雑談のまま次へ）
    for (const m of inviteTurn ? [invite, chat] : [chat]) if (m && !state.limeRead.includes(m.id)) out.push(m);
  }
  return out;
}

export const isFriendEvent = (event) => /^friend_/.test(event || "");

/**
 * シーシャのお誘いに乗ったときの一服（私的な場面）。報酬は相手の得意なステ。場面の言い回しは回ごとに入れ替わる
 */
export async function playFriendHangout(id) {
  const f = friendData(id);
  if (!f) return false;
  state.friendHangouts ||= {};
  const n = state.friendHangouts[id] || 0;
  const v = f.hangouts[n % f.hangouts.length];
  const name = f.call || callName(id, state, { context: "private" });
  await play({
    dialogue_id: `remake_friend_${id}`,
    metadata: { bg: `res://assets/backgrounds/${f.bg}`, private_scene: true },
    lines: [
      { speaker: "", text: `${state.slot === 0 ? "定休日の午後。" : "仕事を終えてから。"}${f.place}で、${name}と一服した。` },
      { speaker: id, face: v.arrive.face, text: v.arrive.text, inner: v.arrive.inner },
      { speaker: "", text: "１台の煙を、急がずに回す。勝ち負けも、試香の数字もない時間だった。" },
      { speaker: id, face: v.mid.face, text: v.mid.text, inner: v.mid.inner },
      { speaker: id, face: v.close.face, text: v.close.text, inner: v.close.inner },
      { type: "apply", stats: { [f.stat]: 2 } },
    ],
  });
  state.friendHangouts[id] = n + 1;
  save();
  return true;
}
