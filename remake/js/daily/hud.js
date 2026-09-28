// 日常パートの常時表示（日付・時間帯・大会までの日数・所持金・体力・スマホ・ステータス）。
import { el, yen } from "../core/util.js";
import { layers } from "../core/ui.js";
import { on } from "../core/bus.js";
import { state } from "../core/state.js";
import { staminaRatio, STAMINA_LOW, maxStamina } from "../core/stats.js";

export const MAX_DAYS = 14;
/** 大会（DAY15）まであと何日か。台詞の {daysLeft} もこれに一本化する */
export const daysLeft = () => Math.max(0, MAX_DAYS + 1 - (state?.day || 1));

let dom = null;
let handlers = { phone: null, status: null, menu: null };

export function initHud(h) {
  handlers = { ...handlers, ...h };
  dom = {
    day: el("div.hud-day"),
    slot: el("div.hud-slot"),
    left: el("div.hud-left"),
    money: el("div.hud-money"),
    stamina: el("div.hud-stamina", [el("span", { text: "体力" }), el("i.hud-bar", [el("b")])]),
    phone: el("button.hud-btn.hud-phone", { dataset: { test: "hud-phone" }, onclick: () => handlers.phone?.() }, [el("span", { text: "LIME" }), el("em.badge")]),
    status: el("button.hud-btn", { text: "STATUS", dataset: { test: "hud-status" }, onclick: () => handlers.status?.() }),
    menu: el("button.hud-btn", { text: "MENU", dataset: { test: "hud-menu" }, onclick: () => handlers.menu?.() }),
  };
  const root = el("div.hud", [
    el("div.hud-date", [dom.day, dom.slot, dom.left]),
    el("div.hud-right", [dom.money, dom.stamina, dom.phone, dom.status, dom.menu]),
  ]);
  layers.hud.replaceChildren(root);
  on("hud", updateHud);
  on("money", ({ delta }) => {
    if (!delta || !dom) return;
    const pop = el(`div.money-pop${delta < 0 ? ".minus" : ""}`, { text: `${delta > 0 ? "+" : "−"}${yen(Math.abs(delta))}` });
    dom.money.append(pop);
    setTimeout(() => pop.remove(), 1400);
  });
}

export function showHud(v = true) {
  layers.hud.classList.toggle("show", v);
  if (v) updateHud();
}

export function updateHud() {
  if (!dom || !state) return;
  dom.day.textContent = `DAY ${state.day}`;
  const night = state.slot >= 1;
  dom.slot.textContent = state.slot >= 2 ? "夜・帰宅" : night ? "夜" : "昼";
  dom.slot.dataset.slot = night ? "night" : "day";
  dom.left.textContent = state.phase === "tournament" ? "大会当日" : `SMOKE CROWN CUPまで あと${daysLeft()}日`;
  dom.money.textContent = yen(state.money);
  const r = staminaRatio();
  const bar = dom.stamina.querySelector("b");
  bar.style.width = `${Math.round(r * 100)}%`;
  dom.stamina.classList.toggle("low", state.stamina < STAMINA_LOW);
  // 根性★で体力の器が増えると、バー自体が伸びる
  dom.stamina.querySelector(".hud-bar").style.width = `${Math.round(96 * (maxStamina() / 100))}px`;
}

export function setPhoneBadge(n) {
  if (!dom) return;
  const b = dom.phone.querySelector(".badge");
  b.textContent = n ? String(n) : "";
  dom.phone.classList.toggle("has", !!n);
}
