// フロア営業を最後まで回す検査用の操作役。pace＝一つの操作にかかる刻み（2＝手際がよい、16＝ほぼ放置）。
// pick＝注文に出す一台: "best"（並んでいる中でいちばん合うもの。◎も○も無ければシャッフルしてから）/ "first"（いちばん上をそのまま）/ "off"（いちばん合わないもの）。
// tend＝頼まれる前に炭を整えに行くか。頼みには正しい手で応え、会計はすぐ受ける。フィーバーは溜まって卓が2つ以上くつろいでいれば使う。
import { createFloorNight, floorTick, floorAct, floorTap, floorResult, floorUrgency, floorFeverLevel, floorHand, floorShuffleLeft } from "../js/daily/tonari-floor-model.js";
import { CALLS } from "../js/daily/tonari-floor-data.js";

const ORDER = ["best", "good", "none"];
/** 並んでいるミックスから、その気分にいちばん合う一台（worst＝いちばん合わない一台）。 */
export function bestMix(s, order, { worst = false } = {}) {
  const hand = floorHand(s, order.wish).sort((a, b) => (ORDER.indexOf(a.rating) - ORDER.indexOf(b.rating)) * (worst ? -1 : 1));
  return hand[0];
}

export function floorBotAction(s, { pick = "best", fever = true, tend = true } = {}) {
  const kinds = s.tables.map((table) => [table, floorTap(s, table.id)]);
  const by = (kind) => kinds.filter(([, k]) => k === kind)
    .sort((a, b) => floorUrgency(s, b[0].id) - floorUrgency(s, a[0].id)).map(([table]) => table);
  const enjoying = s.tables.filter((table) => table.phase === "enjoy").length;
  if (fever && floorFeverLevel(s) >= 1 && !s.feverLeft && enjoying >= 2) return { type: "fever" };
  const [order] = by("order");
  if (order) {
    const wish = s.guests[order.guestId].order;
    if (pick === "first") return { type: "order", tableId: order.id, mix: s.hand[0] };
    const choice = bestMix(s, wish, { worst: pick === "off" });
    if (pick === "best" && ORDER.indexOf(choice.rating) >= 2 && !floorShuffleLeft(s)) return { type: "shuffle" };
    return { type: "order", tableId: order.id, mix: choice.id };
  }
  const [care] = by("care");
  if (care) return { type: "care", tableId: care.id, verb: CALLS[care.call.type].verb };
  const [bill] = by("bill");
  if (bill) return { type: "bill", tableId: bill.id };
  const [due] = tend ? by("tend") : [];
  if (due) return { type: "tend", tableId: due.id };
  return null;
}

export function playFloorBot({ pace = 3, pick = "best", fever = true, tend = true, ...night } = {}) {
  let s = createFloorNight(night);
  let cool = 0;
  while (!s.done) {
    if (cool <= 0) {
      const action = floorBotAction(s, { pick, fever, tend });
      const next = action ? floorAct(s, action) : s;
      if (next !== s) { s = next; cool = action.type === "shuffle" ? 1 : pace; }
    }
    if (s.done) break;
    s = floorTick(s);
    cool -= 1;
  }
  return { state: s, result: floorResult(s) };
}
