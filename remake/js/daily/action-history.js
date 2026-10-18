import { state, STAT_KEYS, STAT_JA } from "../core/state.js";
import { displayName } from "../core/data.js";
import { yen } from "../core/util.js";

export const actionSnapshot = () => ({ owner: state, chapter: state.chapter, day: state.day, slot: state.slot,
  money: state.money, stamina: state.stamina, stats: { ...state.stats }, affinity: { ...state.affinity } });

export function recordAction(before, label, used = true) {
  if (before.owner !== state) return;
  const changes = [];
  const money = state.money - before.money, stamina = state.stamina - before.stamina;
  if (money) changes.push(`所持金 ${money > 0 ? "+" : "−"}${yen(Math.abs(money))}`);
  if (stamina) changes.push(`体力 ${stamina > 0 ? "+" : "−"}${Math.abs(stamina)}`);
  for (const key of STAT_KEYS) {
    const delta = state.stats[key] - before.stats[key];
    if (delta > 0) changes.push(`${STAT_JA[key]} +${delta}P`);
  }
  for (const [id, points] of Object.entries(state.affinity || {})) {
    if (state.met[id] && points > (before.affinity[id] || 0)) changes.push(`${displayName(id, state)}との仲が深まった`);
  }
  if (!used && !changes.length) return;
  (state.actionHistory ||= []).push({ chapter: before.chapter, day: before.day, slot: before.slot, label,
    changes: changes.length ? changes : ["交流・体験を記録した"] });
  state.actionHistory = state.actionHistory.slice(-40);
}
