// 東京の既存章カードから呼ぶ、遠距離LIME・旅程・行動枠のアダプタ。
import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { visitContacts, tokyoVisitState, playerRegion, characterRegion, syncTokyoVisits,
  proposeTokyoVisit, bookTokyoVisit } from "../core/tokyo-visits.js";
import { openContactLime } from "../daily/phone.js";
import { readDialogues } from "./ch2-city-data.js";

let definitions = null;
export async function loadTokyoSocial() {
  if (definitions) return definitions;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("../data/tokyo_visits.json", { cache: "no-cache", signal: controller.signal });
    if (!response.ok) throw new Error(`tokyo_visits: HTTP ${response.status}`);
    const data = await response.json();
    if (data.version !== 1 || !Number.isInteger(data.leadDays) || data.leadDays < 1
      || !Number.isInteger(data.stayDays) || data.stayDays < 2 || !data.characters) throw new Error("東京訪問の定義が不正です");
    const ids = Object.entries(data.characters).filter(([, character]) => character.dateMinChapter === 3)
      .flatMap(([id]) => [`ch3_visit_${id}_meetup`, `ch3_visit_${id}_date`]);
    const dialogues = await readDialogues("ch3_visits", ids);
    for (const id of ids) DB.dialogues[id] = dialogues[id];
    definitions = data;
    return definitions;
  } finally { clearTimeout(timer); }
}

// chat は日替わりの候補列（時間帯を名指さない文面）。旧定義の文字列もそのまま受ける。
const dailyLine = text => Array.isArray(text) ? text[state.day % text.length] : text;

function logMessage(id, key, mine, peer) {
  const messageId = `_tokyo_${id}_${key}`;
  if (state.inbox.some(item => item.id === messageId)) return;
  const log = [...(mine ? [{ me: true, text: mine }] : []), { me: false, text: peer }];
  state.inbox.push({ id: messageId, day: state.day, account: id === "minto" ? "minto_private" : id,
    read: true, done: true, log, msg: { id: messageId, sender: id, type: "chat", lover: true, tokyoVisit: true, messages: [] } });
  if (!state.limeRead.includes(messageId)) state.limeRead.push(messageId);
}

export function syncTokyoSocial() {
  const visits = syncTokyoVisits(state);
  if (!definitions) return;
  for (const plan of visits.plans) {
    const character = definitions.characters[plan.characterId];
    if (!character || !visitContacts(state, definitions).includes(plan.characterId)) continue;
    if (["arrived", "staying"].includes(plan.status)) logMessage(plan.characterId, `${plan.id}_arrived`, null, character.arrived);
    if (plan.status === "returned") logMessage(plan.characterId, `${plan.id}_returned`, null,
      plan.returnReason === "player_home" ? character.homeChat : character.returned);
  }
}

const dayLabel = day => `DAY ${day - state.flags._ch3_intro.startDay + 1}`;
const timeLabel = time => `${dayLabel(time.day)} ${time.slot ? "夜" : "昼"}`;
const latestPlan = id => [...tokyoVisitState(state).plans].reverse().find(plan => plan.characterId === id);
const tripLabel = trip => `${timeLabel(trip.meetup)}に東京駅で合流、${timeLabel(trip.date)}に散歩。${dayLabel(trip.returnDay)}に帰郷。`;

export async function openTokyoLime({ signal = null } = {}) {
  await loadTokyoSocial();
  if (signal?.aborted) return;
  syncTokyoSocial();
  save();
  const contacts = () => visitContacts(state, definitions);
  const notes = {};
  const summary = id => {
    if (notes[id]) return notes[id];
    const offer = state.tokyoVisits.offers[id];
    if (offer) return `${offer.held ? "保留中の訪問" : "訪問の相談"}：${tripLabel(offer)}`;
    const plan = latestPlan(id);
    if (plan && plan.status !== "returned") return `${plan.met ? "合流済み。" : plan.status === "arrived" ? "東京駅に到着。" : "予約済み。"}${tripLabel(plan)}${plan.dateDone ? " 散歩を終えた。" : ""}`;
    if (playerRegion(state) === "home") return "地元へ戻った。次に会える日を、また相談しよう。";
    return `${plan ? "訪問を終えて帰郷済み。" : "地元からの連絡。"}離れていても、二人の関係は続いている。`;
  };
  const actions = id => {
    if (state.tokyoVisits.offers[id] && !state.tokyoVisits.offers[id].held) return [
      { id: "book", label: "この日程で約束する" },
      { id: "hold", label: "今は保留する" },
    ];
    const options = [{ id: "chat", label: "話しかける" }];
    const plan = latestPlan(id);
    if (playerRegion(state) === "tokyo" && (!plan || plan.status === "returned")
      && state.chapter >= definitions.characters[id].dateMinChapter) options.push({ id: "offer", label: state.tokyoVisits.offers[id]?.held ? "保留中の訪問を相談" : "デートに誘う" });
    return options;
  };
  await openContactLime({ contacts, summary, actions, signal, onAction: (id, action) => {
    syncTokyoSocial();
    delete notes[id];
    const character = definitions.characters[id];
    if (action === "chat") {
      const key = `${state.chapter}:${state.day}`;
      if (state.tokyoVisits.chats[id] !== key) {
        const local = characterRegion(state, definitions, id) === playerRegion(state);
        logMessage(id, `chat_${key}`, "今、少し話せる？", playerRegion(state) === "home" ? character.homeChat : local ? character.localChat : dailyLine(character.chat));
        state.tokyoVisits.chats[id] = key;
      } else notes[id] = "今日のやり取りはトークに残っている。また落ち着いた時に話そう。";
    }
    if (action === "offer") {
      const proposal = proposeTokyoVisit(state, definitions, id);
      if (proposal) {
        state.tokyoVisits.offers[id] = proposal;
        logMessage(id, `offer_${proposal.arrivalDay}`, "東京で会える日を相談したい。", character.offer);
      } else notes[id] = "今の予定では、移動・合流・散歩の時間を確保できない。また都合の合う時に相談しよう。";
    }
    if (action === "book") {
      const proposal = state.tokyoVisits.offers[id];
      if (bookTokyoVisit(state, definitions, proposal)) logMessage(id, `book_${proposal.arrivalDay}`, "その日程で会おう。", tripLabel(proposal));
      else {
        delete state.tokyoVisits.offers[id];
        notes[id] = "予定が変わったため、もう一度空いている日を相談しよう。関係は変わらない。";
      }
    }
    if (action === "hold") {
      // 取り消しても次回の相談を失効させず、旧pendingInviteや好感度を触らない。
      state.tokyoVisits.offers[id].held = true;
      notes[id] = "訪問は保留にした。次に都合が合う時、ここからまた相談できる。";
    }
    save();
  } });
}

