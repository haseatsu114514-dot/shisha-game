// フロア営業を最後まで回す検査用の操作役。pace＝一つの操作にかかる刻み（2＝手際がよい、16＝ほぼ放置）。
// pick＝注文で選ぶ一台（"best" ぴったり / "near" 悪くない / "off" 外れ）。合図には正しい手入れで応える。
// 会計は客の顔に合った一言を選ぶ。extend＝笑顔の客へ延長をすすめる（入口や作業台が混んでいる時はお礼で見送る）。
import { createFloorNight, floorTick, floorAct, floorTap, floorResult, floorUrgency, floorAirFull, floorSendOff } from "../js/daily/tonari-floor-model.js";
import { CALLS, MIXES } from "../js/daily/tonari-floor-data.js";

export function floorBotAction(s, { pick = "best", useBonusTime = true, extend = true } = {}) {
  const kinds = s.tables.map((table) => [table, floorTap(s, table.id)]);
  const by = (kind) => kinds.filter(([, k]) => k === kind)
    .sort((a, b) => floorUrgency(s, b[0].id) - floorUrgency(s, a[0].id)).map(([table]) => table);
  const enjoying = s.tables.filter((table) => table.phase === "enjoy").length;
  if (useBonusTime && s.air >= floorAirFull && !s.bonusTimeLeft && (enjoying >= 3 || s.t > s.length * 0.7)) return { type: "bonusTime" };
  const [ready] = by("serve");
  if (ready) return { type: "serve", tableId: ready.id };
  const [care] = by("care");
  if (care) return { type: "care", tableId: care.id, verb: CALLS[care.call.type].verb };
  const [consult] = by("consult");
  if (consult) return { type: "consult", tableId: consult.id, mixId: s.guests[consult.guestId].best };
  const [seat] = by("seat");
  if (seat) return { type: "seat", tableId: seat.id };
  const [order] = by("order");
  if (order) {
    const guest = s.guests[order.guestId];
    const family = MIXES[guest.best].family;
    const mixId = pick === "best" ? guest.best
      : guest.options.find((id) => id !== guest.best && (MIXES[id].family === family) === (pick === "near"));
    return { type: "order", tableId: order.id, mixId };
  }
  const [bill] = by("bill");
  if (bill) {
    const off = floorSendOff(s, bill.id);
    const busy = s.queue.length > 0 || s.line.length >= 2;
    return { type: "bill", tableId: bill.id, reply: off.best === "extend" && (!extend || busy) ? "thanks" : off.best };
  }
  const [clean] = by("clean");
  if (clean) return { type: "clean", tableId: clean.id };
  return null;
}

export function playFloorBot({ pace = 3, pick = "best", useBonusTime = true, extend = true, ...night } = {}) {
  let s = createFloorNight(night);
  let cool = 0;
  while (!s.done) {
    if (cool <= 0) {
      const action = floorBotAction(s, { pick, useBonusTime, extend });
      const next = action ? floorAct(s, action) : s;
      if (next !== s) { s = next; cool = pace; }
    }
    if (s.done) break;
    s = floorTick(s);
    cool -= 1;
  }
  return { state: s, result: floorResult(s) };
}
