// 第5章の出張シーシャの依頼（DLV）: スミさんのLIME・返事・地図の「出張シーシャ」・現地の場面とくじ券。
// 決まり（日程・期限・合い方・枚数）は chapters/ch5-catering-model.js。台詞は data/dialogue/ch5_catering.json（報酬は台詞に書かない）。
// 依頼は tonari の店のLIMEに来て、スミさんがはじめへ回す（送り主はスミさん。依頼主は名前の無い客で、新しい人物は作らない）。
// 地図の行き先は地元の「出張シーシャ」。行動1回・体力は mukai のシフトと同じ。経験値は日常ループの普通の行動と同じ。
// 本人が行くか、つむぎに任せるかを選べる。表示と入金は手取りだけ。委託は行動・体力・育成報酬を使わない。
// 中断・LOAD では、体力・くじ券・依頼の記録を残さない（次に地図から選べば、最初から作り直せる）。
import { state, save, timeOfDay } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { modal, setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, earnStat } from "../core/stats.js";
import { deliverLimeMessage, registerLimeReplyAction } from "../daily/phone.js";
import { cateringBusinessOpen } from "./ch5-catering-origin.js";
import { grantKujiTickets } from "../daily/kuji-tickets.js";
import {
  CATERING_SPOT_ID, CATERING_PIN, CATERING_STAMINA, CATERING_SCENE_IDS, JOB_DAYS,
  cateringState, cateringRequestById, cateringRequestDue, recordCateringOffer, expireCatering, acceptCatering, declineCatering,
  cateringJob, cateringSlotBlock, cateringFit, settleCatering, cateringSceneId, cateringCloseId, cateringServedTotal, cateringDelegation, cateringDelegationBlock, delegateCatering,
  settleDelegatedCatering, closeCatering, isTsumugiCateringAway, cateringFirstRoundComplete,
} from "./ch5-catering-model.js";

const unused = Object.freeze({ used: false, exerted: false });
const slotWord = entry => entry.slot === 1 ? "夜" : "昼";

// ---- LIME -----------------------------------------------------------------------------------------------
const sumiUnread = value => (value.inbox || []).some(item => !item.read && (item.account || item.msg?.sender) === "sumi");

/** 依頼のLIME（送り主はスミさん）。最初の一通だけ、くじ券のことと「目の前の一人に届けてこい」を添える。 */
function requestMessage(entry, value) {
  const record = cateringState(value);
  const first = record.offers === 0;
  const repeat = cateringFirstRoundComplete(value);
  const opening = first ? "店のLIMEに、出張の頼みが来てる。お前に回すぞ"
    : (record.served[entry.id] || 0) > 0 ? "店のLIMEに、また出張の頼みが来てる。前にも似た頼みがあったな" : "店のLIMEに、また出張の頼みが来てる";
  return {
    id: `ch5-catering:${entry.id}:d${value.day}`, sender: "sumi", type: "chat", ch5Catering: entry.id,
    messages: [
      ...(repeat ? [`${entry.place}から、また出張の予約だ。${slotWord(entry)}の会な`, "前と同じ好みで頼みたいそうだ"] : [opening, ...entry.lime]),
      `手取りは${entry.payout.toLocaleString()}円だ`,
      "自分で行っても、つむぎに任せてもいい。店の段取りは、お前に任せる",
      ...(first ? ["自分で届けて喜んでもらえたら、店のくじ券も回す", "何人いても同じだ。目の前の一人に届けてこい"] : []),
      "受けるかどうか、明日までに返事をくれ",
    ],
    replies: [
      { text: "つむぎに任せます", action: "ch5_catering_delegate", affinity: 0 },
      { text: "引き受けます", action: "ch5_catering_accept", response: "おう。向こうには、お前が行くって伝えとく", affinity: 0 },
      { text: "今回は見送ります", action: "ch5_catering_decline", response: "わかった。向こうには、俺から断っとく", affinity: 0 },
    ],
  };
}

/** 引き受けたのに日が過ぎた時の、スミさんの一言（叱らない）。 */
const lapseMessage = (entry, value) => ({
  id: `ch5-catering-lapse:${entry.id}:d${value.day}`, sender: "sumi", type: "chat",
  messages: [`${entry.title}の件、日が過ぎたから、向こうには俺から断っといた`, "気にすんな。また頼みが来たら回す"],
});

/**
 * 朝のLIME（日常ループの morningLime）。期限の過ぎた依頼を片付け、届く日なら新しい依頼を一通届ける。戻り値＝届いた件数。
 * スミさんの未読がある朝は重ねない（同じ相手からは1朝1話題。次の朝に届く）。
 */
export function deliverCateringMorning(value = state) {
  if (value?.chapter !== 5) return 0;
  let delivered = settleCateringWork() ? 1 : 0;
  suspendCateringInvites(value);
  const expired = expireCatering(value);
  if (expired && !expired.accepted) {
    // 返事をしないまま締め切られた依頼は、返事のボタンを出さない
    const item = (value.inbox || []).find(entry => entry.id === expired.msg);
    if (item && !item.done) {
      item.done = true;
      item.replyState = "expired";
      (item.log ||= []).push({ note: "返事をしないうちに、依頼の日が過ぎてしまった" });
    }
  } else if (expired && !sumiUnread(value)) {
    deliverLimeMessage(lapseMessage(cateringRequestById(expired.id), value));
    delivered += 1;
  }
  // 新規依頼は事業の相談を読んでから。旧依頼の失効/委託精算は上で継続する。
  const entry = cateringBusinessOpen(value) ? cateringRequestDue(value) : null;
  if (entry && !sumiUnread(value)) {
    const message = requestMessage(entry, value);
    deliverLimeMessage(message);
    recordCateringOffer(value, entry.id, message.id);
    delivered += 1;
  }
  return delivered;
}

registerLimeReplyAction("ch5_catering_accept", item => {
  const entry = cateringRequestById(item.msg?.ch5Catering);
  if (!entry || !acceptCatering(state, item.id)) return "この依頼は、もう締め切られていた";
  return `引き受けた：明日から${JOB_DAYS}日のうちの${slotWord(entry)}に、地図の「出張シーシャ」から向かう`;
});
registerLimeReplyAction("ch5_catering_decline", item =>
  declineCatering(state, item.id) ? "今回は見送った。また頼みが来たら、スミさんが回してくれる" : null);

// 予約時点で分かるつむぎの約束を優先する。返事待ちの誘いも勝手に取り消して予約しない。
function delegationBlocked(value, day, slot) {
  return (value.inbox || []).some(item => !item.done && item.day === day && item.msg?.sender === "tsumugi"
    && item.msg.type === "invitation" && (item.msg.time_slot === "night" || item.msg.after_close ? 1 : 0) === slot);
}

function assignTsumugi(value, msg) {
  const offer = cateringState(value).offer;
  const entry = cateringRequestById(offer?.id);
  if (!entry) return null;
  for (let day = value.day + 1; day <= (offer.accepted === null ? value.day + JOB_DAYS : offer.until); day++) {
    const blocked = delegationBlocked(value, day, entry.slot);
    if (!cateringDelegationBlock(value, day, blocked) && delegateCatering(value, msg, { day, blocked })) return day;
  }
  return null;
}

registerLimeReplyAction("ch5_catering_delegate", item => {
  const day = assignTsumugi(state, item.id);
  const entry = cateringRequestById(item.msg?.ch5Catering);
  if (day !== null) return `つむぎに任せた：${day - state.day}日後の${slotWord(entry)}。手取り${entry.payout.toLocaleString()}円。自分は別の行動を選べる`;
  // 返信ボタンは一度だけなので、委託不可なら本人の受注として残し、地図から選び直せるようにする。
  if (acceptCatering(state, item.id)) return "つむぎの予定が合わなかった。依頼は引き受けて、地図から段取りを選び直す";
  return "この依頼は、もう締め切られていた";
});

const payCatering = amount => {
  const before = state.money;
  addMoney(amount);
  return state.money - before;
};

/** 行動終了・夜・翌朝・LOADの共通精算。読了や通知開封には依存せず一度だけ入金する。 */
export function settleCateringWork(options = {}) {
  const result = settleDelegatedCatering(state, { ...options, pay: payCatering });
  if (!result) return null;
  const entry = cateringRequestById(result.id);
  deliverLimeMessage({ id: `ch5-catering-done:${result.id}:d${result.day}`, sender: "tsumugi", type: "chat",
    messages: [...(result.repeat ? [`${entry.place}の出張、終わりました`,
      "また呼んでくださってありがとうございますって、お伝えしました", "皆さん、最後までゆっくり楽しんでくださったみたいです"] : entry.report),
      `精算しました。手取りは${result.paid.toLocaleString()}円です`],
    replies: [{ text: "お疲れさま。ありがとう", response: result.repeat ? "また次も、って言ってもらえました" : entry.reportReply, affinity: 0 }] });
  save();
  return result;
}

/** その日はつむぎから誘いを重ねない。既存の朝配信のexcludeへ渡す（同行者の設定は変えない）。 */
export function cateringBusyContacts(value = state) {
  return cateringDelegation(value)?.jobDay === value.day ? ["tsumugi"] : [];
}

/** 同じ枠の未返信の誘いが旧保存に残っていても、出張と二重予約しない。物語の誘いは後日また届く。 */
function suspendCateringInvites(value) {
  for (const item of value.inbox || []) {
    const msg = item.msg;
    const slot = msg?.time_slot === "night" || msg?.after_close ? 1 : 0;
    if (item.done || msg?.sender !== "tsumugi" || msg.type !== "invitation" || item.day !== value.day
      || !isTsumugiCateringAway(value, value.day, slot)) continue;
    item.done = true; item.result = "expired"; item.replyState = "expired"; item.needsResend = true;
    (item.log ||= []).push({ note: "出張の予定があるため、つむぎとの約束はまた別の日に" });
  }
}

/** 博士との勝負を決めたら、未完の依頼はスミさんへ戻す。完了済みの枠だけ先に精算する。 */
export function finishCateringSeason() {
  settleCateringWork();
  const offer = closeCatering(state);
  if (!offer) return;
  const item = (state.inbox || []).find(item => item.id === offer.msg);
  if (item && !item.done) { item.done = true; item.replyState = "expired"; }
  deliverLimeMessage({ id: `ch5-catering-close:${offer.id}:d${state.day}`, sender: "sumi", type: "chat",
    messages: ["残ってる出張の段取りは、俺が引き取る", "お前は博士との勝負に集中してこい"] });
  save();
}

// ---- 地図 -----------------------------------------------------------------------------------------------
/** 地元の地図の「出張シーシャ」（引き受けた翌日から期限まで。時間帯が違えば理由を出して押せない）。無ければ null。 */
export function chapterFiveCateringSpot(value = state) {
  const booking = cateringDelegation(value);
  const entry = cateringJob(value) || cateringRequestById(booking?.id);
  if (!entry) return null;
  const spot = { id: CATERING_SPOT_ID, kind: "ch5_catering", label: "出張シーシャ", area: entry.place, ...CATERING_PIN,
    theme: "baito", glyph: "出", preview: entry.bg, stamina: CATERING_STAMINA, catering: entry.id,
    desc: `${entry.title}（${entry.client}から・${slotWord(entry)}の会）。手取り${entry.payout.toLocaleString()}円。自分で行くか、つむぎに任せる。` };
  if (booking) return Object.freeze({ ...spot, stamina: 0,
    desc: `${entry.title}。${booking.jobDay - value.day > 0 ? `${booking.jobDay - value.day}日後` : "今日"}の${slotWord(entry)}はつむぎが担当。手取り${entry.payout.toLocaleString()}円。自分は別の行動を選べる。`,
    unavailable: "つむぎに任せている。自分は別の行動を選ぼう", unavailableTag: "つむぎが担当" });
  const block = cateringSlotBlock(entry, value);
  return Object.freeze(block ? { ...spot, unavailable: block.why, unavailableTag: block.tag } : spot);
}

// ---- 現地 -----------------------------------------------------------------------------------------------
let loading = null;
async function loadCateringScenes() {
  if (CATERING_SCENE_IDS.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues("ch5_catering", CATERING_SCENE_IDS)
    .then(found => { for (const id of CATERING_SCENE_IDS) DB.dialogues[id] = found[id]; })
    .finally(() => { loading = null; });
  await loading;
}

const showBg = ref => { const { url, tint } = sceneBg(ref, timeOfDay()); return setBg(url, { tint }); };

/**
 * 「出張シーシャ」へ向かう: 導入（客の様子）→ 葉の組み合わせを三つから選ぶ → 結果と、tonari に戻ってスミさんの一言 → くじ券。
 * 対象外の行き先は null。読み終えて { used: true, exerted: true }（行動1回。経験値は日常ループの普通の行動と同じ）。
 */
export async function performCateringSpot(spot, { staminaGuard } = {}) {
  if (spot?.id !== CATERING_SPOT_ID) return null;
  const owner = state;
  const entry = cateringJob(state);
  const repeat = cateringState(state).offer?.repeat === true;
  if (!entry) { toast("この依頼は、もう終わっている"); return unused; }
  const block = cateringSlotBlock(entry, state);
  if (block) { toast(block.why); return unused; }
  const canDelegate = Array.from({ length: JOB_DAYS }, (_, i) => state.day + i + 1)
    .some(day => !cateringDelegationBlock(state, day, delegationBlocked(state, day, entry.slot)));
  const choice = await modal({ title: entry.title,
    body: `手取り${entry.payout.toLocaleString()}円。自分で向かうなら1行動。つむぎに任せれば、明日以降の空いている枠を予約する。`,
    options: [
      { label: "自分で向かう", value: "go", test: "catering-go", primary: true },
      ...(canDelegate ? [{ label: "つむぎに任せる", value: "delegate", test: "catering-delegate" }] : []),
      { label: "戻る", value: null, test: "catering-cancel" },
    ] });
  if (state !== owner || !choice) return unused;
  if (choice === "delegate") {
    const day = assignTsumugi(state, cateringState(state).offer?.msg);
    if (day !== null) {
      save();
      toast(`つむぎに任せた。${day - state.day}日後の${slotWord(entry)}は、別の行動を選べる`);
    }
    return unused;
  }
  try { await loadCateringScenes(); } catch {
    toast("会話を読み込めませんでした。体力と行動は使っていません。地図からもう一度選べます");
    return unused;
  }
  if (state !== owner) return unused;
  if (staminaGuard && !(await staminaGuard(CATERING_STAMINA))) return unused;
  await showBg(entry.bg);
  if (state !== owner) return unused;
  const intro = await play(cateringSceneId(repeat ? "repeat" : entry.id, "intro"));
  if (state !== owner || !intro || intro.cancelled) return unused;
  const index = await modal({ title: `出張の一台（${entry.title}）`, className: "catering-order",
    body: `持ってきた葉で、一台を作る。<br>${entry.conditions.map(text => `・${text}`).join("<br>")}`,
    options: entry.options.map((option, i) => ({ label: option.label, value: i, test: `catering-option-${i}` })) });
  const fit = cateringFit(entry, index);
  if (state !== owner || !fit) return unused;
  const scene = DB.dialogues[cateringSceneId(repeat ? "repeat" : entry.id, fit)];
  const close = DB.dialogues[cateringCloseId(fit, cateringServedTotal(state))];
  const result = await play({ ...scene, lines: [...scene.lines, ...(repeat ? [] : close.lines)] });
  if (state !== owner || !result || result.cancelled) return unused;
  const settled = settleCatering(state, index, n => grantKujiTickets(n, "delivery"), payCatering);
  if (!settled) return unused;
  addStamina(CATERING_STAMINA);
  earnStat("insight", 4);
  save();
  toast(`出張の手取り ${settled.paid.toLocaleString()}円`, { kind: "good" });
  if (settled.tickets) toast(`スミさんから、くじ券を${settled.tickets}枚もらった（Dr.fookahの限定台くじを1回ずつ引ける）`, { kind: "good" });
  else toast("出張を終えた。また頼みが来たら、スミさんから届く");
  return { used: true, exerted: true };
}
