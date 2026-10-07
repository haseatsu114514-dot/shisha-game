// 日常パートの常時表示（日付・時間帯・大会までの日数・所持金・体力・スマホ・ステータス）。
// 見た目は旧版の墨×金を踏襲: 左上に DAY カード、右上に体力・ステータスの五角形・LIME・MENU。
import { el, yen } from "../core/util.js";
import { layers } from "../core/ui.js";
import { on } from "../core/bus.js";
import { state, STAT_KEYS } from "../core/state.js";
import { staminaRatio, currentCondition, maxStamina, star } from "../core/stats.js";
import { isRainy } from "./weather.js";
import { TOURNAMENT_DAY } from "../core/rules.js";

/** 大会（DAY14）まであと何日か。台詞の {daysLeft} もこれに一本化する */
export const daysLeft = () => Math.max(0, TOURNAMENT_DAY - (state?.day || 1));

let dom = null;
let handlers = { phone: null, status: null, menu: null };
let recoveryTimer = null;
let pendingRecovery = null;
let recoveryFrame = 0;
function showRecovery({ before, after, maximum }) {
  if (!dom || after <= before) return;
  pendingRecovery = { before: Math.min(pendingRecovery?.before ?? before, before), after, maximum };
  scheduleRecovery();
}
on("stamina-change", showRecovery);

// 就寝・会話の裏で増えた分は、街へ戻って本来のゲージが見えてから伸ばす。
function scheduleRecovery() {
  if (recoveryFrame || !pendingRecovery) return;
  recoveryFrame = requestAnimationFrame(() => {
    recoveryFrame = 0;
    if (!dom || !pendingRecovery || !layers.hud.classList.contains("show") ||
      document.body.dataset.screen !== "map" || document.body.classList.contains("vn-open") ||
      document.body.classList.contains("in-vn") || layers.modal.classList.contains("show") ||
      layers.wipe.classList.contains("black") || layers.wipe.classList.contains("cover") ||
      layers.fx.querySelector(".day-card")) return;
    const recovery = pendingRecovery;
    pendingRecovery = null;
    const fill = dom.stamina.querySelector("b");
    const target = `${Math.round(staminaRatio() * 100)}%`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { fill.style.width = target; return; }
    fill.style.transition = "none";
    fill.style.width = `${Math.round(Math.min(recovery.before, state.stamina) / maxStamina() * 100)}%`;
    void fill.offsetWidth;
    fill.style.transition = "";
    fill.style.width = target;
    clearTimeout(recoveryTimer);
    dom.stamina.classList.remove("recovering");
    void dom.stamina.offsetWidth;
    dom.stamina.classList.add("recovering");
    const holder = dom.stamina;
    recoveryTimer = setTimeout(() => holder.classList.remove("recovering"), 1600);
  });
}

const SVG = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const pt = (i, r) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  return `${(24 + Math.cos(a) * r).toFixed(1)},${(24 + Math.sin(a) * r).toFixed(1)}`;
};
/** ステータスの五角形（数値は出さず★段階の形だけ） */
function miniRadar() {
  const svg = svgEl("svg", { viewBox: "0 0 48 48", class: "hud-radar" });
  for (const k of [1, 0.6]) svg.append(svgEl("polygon", { points: [0, 1, 2, 3, 4].map((i) => pt(i, 20 * k)).join(" "), class: "hr-grid" }));
  svg.append(svgEl("polygon", { class: "hr-fill" }));
  return svg;
}

export function initHud(h) {
  clearTimeout(recoveryTimer);
  pendingRecovery = null;
  handlers = { ...handlers, ...h };
  dom = {
    area: el("div.dc-area", { text: "SAKAE" }),
    day: el("div.dc-day"),
    slot: el("div.dc-slot"),
    money: el("b"),
    left: el("b"),
    stamina: el("div.hud-stamina", [el("span", { text: "体力" }), el("i.hud-bar", [el("span.gauge-track", [el("b")])])]),
    radar: miniRadar(),
    phone: el("button.hud-lime", { title: "LIME", dataset: { test: "hud-phone" }, onclick: () => handlers.phone?.() }, [el("span", { text: "LIME" }), el("em.badge")]),
    status: el("button.hud-level", { title: "ステータス", dataset: { test: "hud-status" }, onclick: () => handlers.status?.() }),
    menu: el("button.hud-menu", { dataset: { test: "hud-menu" }, onclick: () => handlers.menu?.() }, [el("i"), el("span", { text: "MENU" })]),
  };
  dom.status.append(dom.radar);
  const moneyRow = el("div.dc-row.money", [el("span", { text: "所持金" }), dom.money]);
  const root = el("div.hud", [
    el("div.hud-card", [
      el("div.dc-main", [dom.area, dom.day, dom.slot]),
      el("div.dc-meta", [moneyRow, el("div.dc-row", [el("span", { text: "次の大会まで" }), dom.left])]),
    ]),
    el("div.hud-right", [dom.stamina, dom.status, dom.phone, dom.menu]),
  ]);
  dom.moneyRow = moneyRow;
  layers.hud.replaceChildren(root);
  recoveryObserver?.disconnect();
  recoveryObserver = new MutationObserver(scheduleRecovery);
  recoveryObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "data-screen"] });
  on("hud", updateHud);
  on("money", ({ delta }) => {
    if (!delta || !dom) return;
    const pop = el(`div.money-pop${delta < 0 ? ".minus" : ""}`, { text: `${delta > 0 ? "+" : "−"}${yen(Math.abs(delta))}` });
    dom.moneyRow.append(pop);
    setTimeout(() => pop.remove(), 1400);
  });
}

export function showHud(v = true) {
  layers.hud.classList.toggle("show", v);
  if (v) updateHud();
}

export function updateHud() {
  if (!dom || !state) return;
  dom.day.replaceChildren(el("b", { text: String(state.day) }), el("small", { text: `/${TOURNAMENT_DAY}` }));
  const night = state.slot >= 1;
  const rain = isRainy() ? "・雨" : "";
  dom.slot.textContent = state.phase === "tournament" ? "大会当日" : state.slot >= 2 ? "帰宅" : night ? `夜${rain}` : `昼${rain}`;
  dom.slot.dataset.slot = night ? "night" : "day";
  dom.money.textContent = yen(state.money);
  dom.left.textContent = `あと${daysLeft()}日`;
  const r = staminaRatio();
  const condition = currentCondition();
  dom.stamina.dataset.health = condition.health;
  dom.stamina.title = `体力：${condition.label}。${condition.hint}`;
  dom.stamina.querySelector(".hud-bar").setAttribute("aria-label", dom.stamina.title);
  dom.stamina.querySelector("b").style.width = `${Math.round(r * 100)}%`;
  scheduleRecovery();
  dom.stamina.classList.toggle("low", condition.health === "red");
  // 根性★で体力の器が増えると、バー自体が伸びる
  dom.stamina.querySelector(".hud-bar").style.width = `${Math.round(92 * (maxStamina() / 100))}px`;
  dom.radar.querySelector(".hr-fill").setAttribute("points", STAT_KEYS.map((k, i) => pt(i, 4 + 3.2 * star(k))).join(" "));
}

let recoveryObserver = null;

/** 未読の赤丸（数字は出さない・通知バッジ風） */
export function setPhoneBadge(unread) {
  if (!dom) return;
  dom.phone.classList.toggle("has", !!unread);
  dom.phone.title = unread ? "LIME（未読あり）" : "LIME";
}
