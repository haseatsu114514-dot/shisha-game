// LIMEで示した参加費を、実際に向かう直前に支払う。
export const STORE_INVITE_COST = 3000;
const STORE_EVENTS = new Set(["interaction_naru_night_01", "interaction_minto_noon_01", "outing_ageha_1", "outing_tsumugi_1"]);
export function invitationCost(event) {
  if (event === "ch1_minto_fifth") return 800;
  if (STORE_EVENTS.has(event) || /^date_/.test(event)) return STORE_INVITE_COST;
  if (/^friend_/.test(event) && !["friend_sumi", "friend_rin"].includes(event)) return STORE_INVITE_COST;
  return 0;
}
export const invitationGrowth = (event) => event === "__sumi_baito__" ? { points: 1 } : { budget: 1, points: 2 };
