// 場面カード式の章（第3〜5章）から、第1・2章と同じ恋人の処理（daily/romance.js）を呼ぶ入口（#2024）。
// 文面・条件・既読は romance.js の loverMessages / loverMilestoneDue / playLoverMilestone と phone.js の openPhone が持ち、
// ここでは持たない。デートの誘いは第1・2章の約束（calendar.js）専用なので、場面カードの章では出さない。
// 恋人の絆は、ここでは足さない（LIMEの返信で phone.js が足す分と、節目の読了で解放される分だけ）。
import { state, save } from "../core/state.js";
import { loverMessages, loverMilestoneDue, playLoverMilestone } from "../daily/romance.js";
import { openPhone } from "../daily/phone.js";

/**
 * いま届く恋人LIME（私用アカウントの最初のひとこと・記念日・朝のひとこと）。
 * @param opts.senders この相手からだけ（省略時は恋人全員）
 * @param opts.exclude その場に一緒にいて、LIMEを送ってこない恋人
 */
export function pendingLoverLime({ senders = null, exclude = [] } = {}) {
  const delivered = new Set((state.inbox || []).map(item => item.id));
  return loverMessages({ invitations: false }).filter(m => (!senders || senders.includes(m.sender))
    && !exclude.includes(m.sender) && !delivered.has(m.id));
}

/** 届いている恋人LIMEを既存の端末で読む。返信の絆・既読は phone.js（runItem）が付ける。 */
export async function readLoverLime({ senders = null, exclude = [], title = "恋人からのLIME", time = null } = {}) {
  const due = pendingLoverLime({ senders, exclude });
  if (!due.length) return false;
  await openPhone(due, { title, time: time || (state.slot ? "夜" : "昼") });
  save();
  return true;
}

/** 節目を読める恋人。ids=その場で会える恋人に絞る（遠くにいる恋人の節目は、会えた時まで待つ）。 */
export const loverMilestonesDue = (ids = state.lovers || []) =>
  [...new Set(ids)].filter(id => (state.lovers || []).includes(id) && !!loverMilestoneDue(id));

/** 会えた恋人の未読の節目を一つだけ読む。読了と既読は romance.js が保存する。 */
export async function readLoverMilestone(id, { signal = null } = {}) {
  if (!loverMilestonesDue([id]).length) return false;
  return playLoverMilestone(id, { signal });
}
