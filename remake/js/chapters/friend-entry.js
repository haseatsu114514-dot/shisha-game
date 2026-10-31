// 場面カード式の章（第3〜5章）で、友人になった相手からのたまのLIME（雑談）を読む入口（#2022）。
// 文面・間隔・相手の選び方は daily/bonds.js の friendMessages（remake/data/friends.json）が持ち、ここでは持たない。
// 第3章以降はお誘い（約束）を出さない。間隔は第1・2章と同じ（全員あわせて数日に1通）。
// 友人のLIMEが無い時は、♥3以上で締めくくり前の知り合いの読むだけの雑談（daily/casual-lime.js・LM07）。
import { state, save } from "../core/state.js";
import { friendMessages } from "../daily/bonds.js";
import { casualMessages } from "../daily/casual-lime.js";
import { openPhone } from "../daily/phone.js";

/**
 * いま届く友人LIME（最大1通）。友人のLIMEが無ければ、知り合いの雑談（最大1通）。
 * @param opts.exclude その場に一緒にいる・会えている相手（LIMEを送ってこない）
 */
export function pendingFriendLime({ exclude = [] } = {}) {
  const delivered = new Set((state.inbox || []).map(item => item.id));
  const fresh = m => m.type === "chat" && !exclude.includes(m.sender) && !delivered.has(m.id);
  const friend = friendMessages({ sceneChapter: true }).filter(fresh).slice(0, 1);
  return friend.length ? friend : casualMessages({ sceneChapter: true }).filter(fresh).slice(0, 1);
}

/** 届いている友人LIMEを既存の端末で読む。返信・既読は phone.js が付ける。 */
export async function readFriendLime({ exclude = [], title = "友人からのLIME", time = null } = {}) {
  const due = pendingFriendLime({ exclude });
  if (!due.length) return false;
  await openPhone(due, { title, time: time || (state.slot ? "夜" : "昼") });
  save();
  return true;
}
