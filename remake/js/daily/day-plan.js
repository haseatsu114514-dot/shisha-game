import { el } from "../core/util.js";
import { state } from "../core/state.js";
import { displayName } from "../core/data.js";

export function todayPlan(events = []) {
  const invite = state.pendingInvite;
  const booked = invite && (invite.day ?? state.day) === state.day ? invite : null;
  const slots = [0, 1].map(slot => ({ slot, time: slot ? "夜" : "昼", done: slot < state.slot,
    booked: booked?.slot === slot,
    label: booked?.slot === slot ? `${displayName(booked.sender, state)}との約束${booked.afterClose ? "（閉店後に合流）" : ""}` : "自由行動" }));
  return { slots, free: slots.filter(s => !s.done && !s.booked).length, events,
    future: invite && (invite.day ?? state.day) > state.day ? invite : null };
}

export function planPanel(events = []) {
  const plan = todayPlan(events);
  return el("section.notebook-plan", { dataset: { test: "today-plan" } }, [
    el("h4.plan-title", { text: `今日の予定　自由あと${plan.free}行動` }),
    el("div.plan-items", [
      ...plan.slots.map(s => el(`div.plan-item${s.done ? ".past" : ""}${s.booked ? ".booked" : ""}`, [
        el("b", { text: `${s.time}${s.done ? "・終了" : ""}` }), el("span", { text: s.label })])),
      ...events.map(ev => el("div.plan-item.automatic", [el("b", { text: "行動後・自動" }), el("span", { text: ev.label || "夜の予定" })])),
      plan.future ? el("div.plan-item.booked", { text: `DAY ${plan.future.day}：${displayName(plan.future.sender, state)}との約束` }) : null,
      el("small.plan-note", { text: "買い物・LIME・街の切替は0行動。約束の時間になると自動で向かいます。" }),
    ]),
  ]);
}
