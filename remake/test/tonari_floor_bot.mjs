// フロア営業を最後まで回す検査用の操作役。pace＝一つの操作にかかる刻み（2＝手際がよい、16＝ほぼ放置）。
// pick＝注文に出す一台: "best"（棚の単体と2種からいちばん合うもの）/ "preset"（定番の中でいちばん合うもの）/ "off"（いちばん合わないもの）。
// ケアには正しい言葉で応え、会計は居心地の良い客へショップカードを渡す。フィーバーは溜まって卓が2つ以上くつろいでいれば使う。
import { createFloorNight, floorTick, floorAct, floorTap, floorResult, floorUrgency, floorFeverLevel, evaluateMix, mixInfo } from "../js/daily/tonari-floor-model.js";
import { CALLS, FLAVORS } from "../js/daily/tonari-floor-data.js";

const IDS = Object.keys(FLAVORS);
const SHELF = [...IDS.map((id) => [id]), ...IDS.flatMap((a, i) => IDS.slice(i + 1).map((b) => [a, b]))];

/** その注文にいちばん合う一台（同点なら原価の安いほう）。worst＝いちばん合わない一台。 */
export function bestMix(order, rank = "plain", { from = SHELF, worst = false } = {}) {
  let best = null;
  for (const ids of from) {
    const mood = evaluateMix(ids, order, rank).mood * (worst ? -1 : 1);
    const cost = mixInfo(ids).cost;
    if (!best || mood > best.mood || (mood === best.mood && cost < best.cost)) best = { ids, mood, cost };
  }
  return best.ids;
}

export function floorBotAction(s, { pick = "best", fever = true, card = true } = {}) {
  const kinds = s.tables.map((table) => [table, floorTap(s, table.id)]);
  const by = (kind) => kinds.filter(([, k]) => k === kind)
    .sort((a, b) => floorUrgency(s, b[0].id) - floorUrgency(s, a[0].id)).map(([table]) => table);
  const enjoying = s.tables.filter((table) => table.phase === "enjoy").length;
  if (fever && floorFeverLevel(s) >= 1 && !s.feverLeft && enjoying >= 2) return { type: "fever" };
  const [order] = by("order");
  if (order) {
    const guest = s.guests[order.guestId];
    const mix = pick === "preset" ? bestMix(guest.order, guest.rank, { from: s.presets })
      : bestMix(guest.order, guest.rank, { worst: pick === "off" });
    return { type: "order", tableId: order.id, mix };
  }
  const [care] = by("care");
  if (care) return { type: "care", tableId: care.id, verb: CALLS[care.call.type].verb };
  const [bill] = by("bill");
  if (bill) return { type: "bill", tableId: bill.id, card: card && bill.mood >= 65 };
  return null;
}

export function playFloorBot({ pace = 3, pick = "best", fever = true, card = true, ...night } = {}) {
  let s = createFloorNight(night);
  let cool = 0;
  while (!s.done) {
    if (cool <= 0) {
      const action = floorBotAction(s, { pick, fever, card });
      const next = action ? floorAct(s, action) : s;
      if (next !== s) { s = next; cool = pace; }
    }
    if (s.done) break;
    s = floorTick(s);
    cool -= 1;
  }
  return { state: s, result: floorResult(s) };
}
