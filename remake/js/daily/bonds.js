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
//   文面は remake/data/friends.json。朝に届く友人のLIMEは1通まで・同じ相手は数日おき。恋人と告白待ちの相手には届かない。
import { DB, callName } from "../core/data.js";
import { state, save } from "../core/state.js";
import { affinityLevel } from "../core/stats.js";
import { emit } from "../core/bus.js";
import { play } from "../vn/engine.js";
import { isLover, romanceRouteOpen } from "./romance.js";
import { VISIT_SEQ, storyCount, hasContact } from "./spots.js";

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
};

/**
 * 途中の質問（恋愛／友情）。host を読んだ直後（after）か、host の後の最初の訪問（visit）で一度だけ。
 * choice は data 側の選択肢 id（romance_char つき）
 */
export const BOND_QUESTIONS = {
  tsumugi: { dialogue: "ch1_tsumugi_bond_question", choice: "bond_q1_tsumugi", host: "ch1_tsumugi_fourth", when: "after" },
  minto: { dialogue: "ch1_minto_bond_question", choice: "bond_q1_minto", host: "ch1_minto_private_1", when: "after" },
  rin: { dialogue: "ch1_rin_bond_question", choice: "bond_q1_rin", host: "ch1_rin_third", when: "visit" },
};

// ---------------------------------------------------------------- 隠し恋愛値

/** 隠し恋愛値（恋愛寄りに答えた数）。プレイヤーには見せない */
export const romanceValue = (id) => state.romance?.[id] || 0;
const answers = (id) => Object.values(state.romanceChoices || {}).filter((a) => a.char === id);
const answered = (choiceId) => !!state.romanceChoices?.[choiceId];

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
  return !!BOND_FINALES[id]?.question && !isLover(id) && !state.flags[`_friend_${id}`]
    && answers(id).every((a) => a.value > 0);
}

/** 恋愛の答えを重ねたか（答えた質問がすべて恋愛寄りで、締めくくりの最後の質問でも恋愛を選んだ） */
function romanceChosen(id) {
  const last = BOND_FINALES[id]?.question;
  return !!last && (state.romanceChoices?.[last]?.value || 0) > 0 && romanceOpen(id);
}

/** 会話の条件分岐（hooks.evalCondition）: lover / romance_open。知らない型は undefined */
export function bondCondition(line) {
  if (line.condition_type === "lover") return isLover(line.char_id);
  if (line.condition_type === "romance_open") return romanceOpen(line.char_id);
  return undefined;
}

// ---------------------------------------------------------------- 途中の質問

/** 固有会話（host）を読んだ直後に呼ぶ。対応する質問が残っていれば続けて出す */
export async function afterStory(dialogueId, { bg = null } = {}) {
  for (const [id, q] of Object.entries(BOND_QUESTIONS)) {
    if (q.when !== "after" || q.host !== dialogueId || !questionOpen(id)) continue;
    await play(q.dialogue, bg && !DB.dialogues[q.dialogue]?.metadata?.bg ? { bg } : {});
    save();
  }
}

const questionOpen = (id) => {
  const q = BOND_QUESTIONS[id];
  return !!q && !!DB.dialogues[q.dialogue] && !answered(q.choice) && !isLover(id) && !state.flags[`_friend_${id}`];
};
const hostSeen = (id) => {
  const q = BOND_QUESTIONS[id];
  const at = (VISIT_SEQ[id] || []).indexOf(q?.host);
  return at >= 0 && storyCount(id) > at;
};

/** 次の訪問で質問の場面を出すか（host の後の最初の訪問。固有会話が残っていればそちらが先） */
export const questionVisitDue = (id) => BOND_QUESTIONS[id]?.when === "visit" && questionOpen(id) && hostSeen(id);

/** 訪問の中で質問の場面を出す（通い訪問の小会話の代わり） */
export async function playQuestionVisit(id, { bg = null } = {}) {
  const q = BOND_QUESTIONS[id];
  await play(q.dialogue, bg && !DB.dialogues[q.dialogue]?.metadata?.bg ? { bg } : {});
  save();
}

// ---------------------------------------------------------------- 締めくくり（好感度MAXイベント）

export const finaleSeen = (id) => !!state.finales?.[id];
const storiesDone = (id) => storyCount(id) >= (VISIT_SEQ[id] || []).length;

/**
 * 締めくくりを始められるか: 固有会話を全部読み、好感度MAX（恋人も含む）で、まだ読んでいない。
 * みんとは私的な場面で会うので、私服の約束で本名を聞いた後
 */
export function finaleDue(id) {
  const def = BOND_FINALES[id];
  if (!def || finaleSeen(id) || !DB.dialogues[def.dialogue] || !storiesDone(id)) return false;
  if (affinityLevel(id) < 5 || questionVisitDue(id)) return false;
  if (id === "minto" && !(state.flags._minto_identity_revealed && state.flags._minto_name_known)) return false;
  return true;
}

/** 店で会ったときに始めるか（私的な約束で会う相手は除く・閉店後の場面は夜だけ） */
export const finaleAtVisit = (id) => finaleDue(id) && !BOND_FINALES[id].invite && (!BOND_FINALES[id].night || state.slot >= 1);
export const isFinaleEvent = (dialogueId) => Object.values(BOND_FINALES).some((d) => d.dialogue === dialogueId);

/** 締めくくりを再生し、ルート（恋人／恋愛／友情）を記録して専用ハガルを渡す。一度だけ */
export async function playFinale(id, { bg = null } = {}) {
  const def = BOND_FINALES[id];
  if (!def || finaleSeen(id) || !DB.dialogues[def.dialogue]) return false;
  await play(def.dialogue, bg && !DB.dialogues[def.dialogue].metadata?.bg ? { bg } : {});
  const route = isLover(id) ? "lover" : romanceChosen(id) ? "romance" : "friend";
  state.finales ||= {};
  state.finales[id] = { day: state.day, chapter: state.chapter, route };
  grantGift(def.gift);
  // 恋愛ルート: 告白を予約（一日の終わりに、再生前にもう一度ルートを確かめる）
  if (route === "romance" && romanceRouteOpen(id) && !state.flags._confession_due) state.flags._confession_due = id;
  save();
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
 * 断ったり約束が流れたりしても、締めくくりを読むまで二日おきに改めて届く。時刻は phone.js が休日午後か仕事後に決める
 */
export function bondInvites({ tournamentDay = false } = {}) {
  if (tournamentDay || state.phase !== "daily" || (state.chapter || 1) !== 1) return [];
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

/** この相手から届いた友人のLIME（雑談・お誘い）の履歴 */
const friendSent = (id) => (state.inbox || []).filter((i) => i.msg?.sender === id && String(i.originId || i.id).startsWith(FRIEND_PREFIX));

/**
 * 今朝の友人のLIMEの候補（雑談かシーシャのお誘い）。長く連絡のない相手から順。phone.js が1通だけ採る。
 * 締めくくりの日と前の連絡から gapDays 日あけ、雑談→お誘い→雑談…と交互。お誘いの時刻（休日午後／仕事後）は phone.js が決め、
 * 合わない日は同じ相手の雑談に切り替える。お誘いは大会前日まで
 */
export function friendMessages({ tournamentDay = false } = {}) {
  if (tournamentDay || state.phase !== "daily" || (state.chapter || 1) !== 1) return [];
  const gap = DB.friends?.gapDays || 4;
  const out = [];
  const due = Object.keys(BOND_FINALES)
    .filter((id) => settledFriend(id) && hasContact(id))
    .map((id) => {
      const sent = friendSent(id);
      return { id, sent, last: Math.max(state.finales[id].day || 0, ...sent.map((i) => i.day || 0)) };
    })
    .filter((c) => state.day - c.last >= gap && !c.sent.some((i) => !i.read))
    .sort((a, b) => a.last - b.last);
  for (const { id, sent } of due) {
    const f = friendData(id);
    const chats = sent.filter((i) => i.msg.type === "chat").length;
    const chat = f.chats?.length ? { id: `${FRIEND_PREFIX}chat_${id}_d${state.day}`, sender: id, type: "chat", friend: true,
      messages: f.chats[chats % f.chats.length].m.slice(), replies: f.chats[chats % f.chats.length].r } : null;
    const invite = f.invite && state.day < 14 ? { id: `${FRIEND_PREFIX}inv_${id}_d${state.day}`, sender: id, type: "invitation", friend: true,
      private_schedule: "holiday_or_after_close", accept_event: `friend_${id}`, accept_text: f.invite.accept_text,
      messages: f.invite.messages.slice(), decline_response: { text: f.invite.decline } } : null;
    const inviteTurn = sent.length % 2 === 1; // 雑談→お誘い→雑談…
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
      { speaker: id, face: v.arrive.face, text: v.arrive.text },
      { speaker: "", text: "一台の煙を、急がずに回す。勝ち負けも、試香の数字もない時間だった。" },
      { speaker: id, face: v.mid.face, text: v.mid.text },
      { speaker: id, face: v.close.face, text: v.close.text },
      { type: "apply", stats: { [f.stat]: 2 } },
    ],
  });
  state.friendHangouts[id] = n + 1;
  save();
  return true;
}
