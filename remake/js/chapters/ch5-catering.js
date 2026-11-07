// 第5章の出張シーシャの依頼（DLV）: スミさんのLIME・返事・地図の「出張シーシャ」・現地の場面とくじ券。
// 決まり（日程・期限・合い方・枚数）は chapters/ch5-catering-model.js。台詞は data/dialogue/ch5_catering.json（報酬は台詞に書かない）。
// 依頼は tonari の店のLIMEに来て、スミさんがはじめへ回す（送り主はスミさん。依頼主は名前の無い客で、新しい人物は作らない）。
// 地図の行き先は地元の「出張シーシャ」。行動1回・体力は mukai のシフトと同じ。経験値は日常ループの普通の行動と同じ。
// お金は動かさない（出張の代金は店の売上）。くじ券は店の仕入れで溜まった Dr.fookah の券を、スミさんが回してくれる形。
// 中断・LOAD では、体力・くじ券・依頼の記録を残さない（次に地図から選べば、最初から作り直せる）。
import { state, save, timeOfDay } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { modal, setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addStamina, earnStat } from "../core/stats.js";
import { deliverLimeMessage, registerLimeReplyAction } from "../daily/phone.js";
import { grantKujiTickets } from "../daily/kuji-tickets.js";
import {
  CATERING_SPOT_ID, CATERING_PIN, CATERING_STAMINA, CATERING_SCENE_IDS, JOB_DAYS,
  cateringState, cateringRequestById, cateringRequestDue, recordCateringOffer, expireCatering, acceptCatering, declineCatering,
  cateringJob, cateringSlotBlock, cateringFit, settleCatering, cateringSceneId, cateringCloseId, cateringServedTotal,
} from "./ch5-catering-model.js";

const unused = Object.freeze({ used: false, exerted: false });
const slotWord = entry => entry.slot === 1 ? "夜" : "昼";

// ---- LIME -----------------------------------------------------------------------------------------------
const sumiUnread = value => (value.inbox || []).some(item => !item.read && (item.account || item.msg?.sender) === "sumi");

/** 依頼のLIME（送り主はスミさん）。最初の一通だけ、くじ券のことと「目の前の一人に届けてこい」を添える。 */
function requestMessage(entry, value) {
  const record = cateringState(value);
  const first = record.offers === 0;
  const opening = first ? "店のLIMEに、出張の頼みが来てる。お前に回すぞ"
    : (record.served[entry.id] || 0) > 0 ? "店のLIMEに、また出張の頼みが来てる。前にも似た頼みがあったな" : "店のLIMEに、また出張の頼みが来てる";
  return {
    id: `ch5-catering:${entry.id}:d${value.day}`, sender: "sumi", type: "chat", ch5Catering: entry.id,
    messages: [
      opening, ...entry.lime,
      ...(first ? ["向こうが喜んだら、店に溜まってるDr.fookahのくじ券を回す", "何人いても同じだ。目の前の一人に届けてこい"] : []),
      "受けるかどうか、明日までに返事をくれ",
    ],
    replies: [
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
  let delivered = 0;
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
  const entry = cateringRequestDue(value);
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

// ---- 地図 -----------------------------------------------------------------------------------------------
/** 地元の地図の「出張シーシャ」（引き受けた翌日から期限まで。時間帯が違えば理由を出して押せない）。無ければ null。 */
export function chapterFiveCateringSpot(value = state) {
  const entry = cateringJob(value);
  if (!entry) return null;
  const spot = { id: CATERING_SPOT_ID, kind: "ch5_catering", label: "出張シーシャ", area: entry.place, ...CATERING_PIN,
    theme: "baito", glyph: "出", preview: entry.bg, stamina: CATERING_STAMINA, catering: entry.id,
    desc: `${entry.title}（${entry.client}から・${slotWord(entry)}の会）。客の様子を見て、持っていく葉の組み合わせを選ぶ。` };
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
  if (!entry) { toast("この依頼は、もう終わっている"); return unused; }
  const block = cateringSlotBlock(entry, state);
  if (block) { toast(block.why); return unused; }
  try { await loadCateringScenes(); } catch {
    toast("会話を読み込めませんでした。体力と行動は使っていません。地図からもう一度選べます");
    return unused;
  }
  if (state !== owner) return unused;
  if (staminaGuard && !(await staminaGuard(CATERING_STAMINA))) return unused;
  await showBg(entry.bg);
  if (state !== owner) return unused;
  const intro = await play(cateringSceneId(entry.id, "intro"));
  if (state !== owner || !intro || intro.cancelled) return unused;
  const index = await modal({ title: `出張の一台（${entry.title}）`, className: "catering-order",
    body: `持ってきた葉で、一台を作る。<br>${entry.conditions.map(text => `・${text}`).join("<br>")}`,
    options: entry.options.map((option, i) => ({ label: option.label, value: i, test: `catering-option-${i}` })) });
  const fit = cateringFit(entry, index);
  if (state !== owner || !fit) return unused;
  const scene = DB.dialogues[cateringSceneId(entry.id, fit)];
  const close = DB.dialogues[cateringCloseId(fit, cateringServedTotal(state))];
  const result = await play({ ...scene, lines: [...scene.lines, ...close.lines] });
  if (state !== owner || !result || result.cancelled) return unused;
  const settled = settleCatering(state, index, n => grantKujiTickets(n, "delivery"));
  if (!settled) return unused;
  addStamina(CATERING_STAMINA);
  earnStat("insight", 4);
  save();
  if (settled.tickets) toast(`スミさんから、くじ券を${settled.tickets}枚もらった（Dr.fookahの限定台くじを1回ずつ引ける）`, { kind: "good" });
  else toast("出張を終えた。また頼みが来たら、スミさんから届く");
  return { used: true, exerted: true };
}
