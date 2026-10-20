// LIMEで示した参加費を、実際に向かう直前に支払う。
export const STORE_INVITE_COST = 3000;
const STORE_EVENTS = new Set(["interaction_naru_night_01", "interaction_minto_noon_01", "outing_ageha_1", "outing_tsumugi_1"]);
export function invitationCost(event) {
  if (event === "ch1_minto_fifth") return 800;
  if (STORE_EVENTS.has(event) || event === "__hiyori_shop__" || /^date_/.test(event)) return STORE_INVITE_COST;
  if (/^friend_/.test(event) && !["friend_sumi", "friend_rin"].includes(event)) return STORE_INVITE_COST;
  return 0;
}
export const invitationGrowth = (event) => event === "__sumi_baito__" ? { points: 1 } : { budget: 1, points: 2 };

// 店内の試飲だけは当日の夜にも向かえる。昼限定の外出・定休日の私的な約束は延長しない。
export const storeInvitationSpot = (message) => message?.accept_event === "interaction_minto_noon_01"
  && !message.private_schedule && !message.after_close && !message.temporary_closed ? "minto" : null;

/** 同じ試飲台本の時間描写だけを実際の来店時刻に合わせる。DBの正本は変更しない。 */
export function storeInvitationDialogue(dialogue, slot) {
  if (!dialogue || slot !== 1) return dialogue;
  return { ...dialogue, lines: (dialogue.lines || []).map((line, i) => i === 0
    ? { ...line, text: line.text.replace("昼下がりのPEPPERMINT", "夜のPEPPERMINT") } : line) };
}

/**
 * 通常の訪問先と誘いの会場が同じ場合だけ、移動前のLIME思い出し対象にする。
 * private_schedule/after_close は普段の店訪問とは別の約束なので除く。
 * 新規イベントでは本文から場所を推測せず reminder_spot を明示する。
 */
export function visitReminderSpot(message) {
  if (!message || message.type !== "invitation" || message.private_schedule || message.after_close) return null;
  if (message.accept_event === "__sumi_baito__" || message.accept_event === "hiyori_tonari_return") return "tonari";
  if (message.accept_event === "__hiyori_shop__") return message.visit_spot || null;
  return storeInvitationSpot(message) || message.reminder_spot || null;
}
