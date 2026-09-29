// 日常パートの常時表示（日付・時間帯・大会までの日数・所持金・体力・スマホ・ステータス）。
// 見た目は旧版の墨×金を踏襲: 左上に DAY カード、右上に体力・ステータスの五角形・LIME・MENU。
import { el, yen } from "../core/util.js";
import { layers } from "../core/ui.js";
import { on } from "../core/bus.js";
import { state, STAT_KEYS } from "../core/state.js";
import { staminaRatio, STAMINA_LOW, maxStamina, star } from "../core/stats.js";
import { isRainy } from "./weather.js";

export const MAX_DAYS = 14;
/** 大会（DAY15）まであと何日か。台詞の {daysLeft} もこれに一本化する */
export const daysLeft = () => Math.max(0, MAX_DAYS + 1 - (state?.day || 1));

let dom = null;
let handlers = { phone: null, status: null, menu: null };

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
  handlers = { ...handlers, ...h };
  dom = {
    area: el("div.dc-area", { text: "SAKAE" }),
    day: el("div.dc-day"),
    slot: el("div.dc-slot"),
    money: el("b"),
    left: el("b"),
    stamina: el("div.hud-stamina", [el("span", { text: "体力" }), el("i.hud-bar", [el("b")])]),
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
      el("div.dc-meta", [moneyRow, el("div.dc-row", [el("span", { text: "大会まで" }), dom.left])]),
    ]),
    el("div.hud-right", [dom.stamina, dom.status, dom.phone, dom.menu]),
  ]);
  dom.moneyRow = moneyRow;
  layers.hud.replaceChildren(root);
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
  dom.day.replaceChildren(el("b", { text: String(state.day) }), el("small", { text: `/${MAX_DAYS}` }));
  const night = state.slot >= 1;
  const rain = isRainy() ? "・雨" : "";
  dom.slot.textContent = state.phase === "tournament" ? "大会当日" : state.slot >= 2 ? "DAY ・ 帰宅" : night ? `DAY ・ 夜${rain}` : `DAY ・ 昼${rain}`;
  dom.slot.dataset.slot = night ? "night" : "day";
  dom.money.textContent = yen(state.money);
  dom.left.textContent = state.phase === "tournament" ? "本日" : `あと${daysLeft()}日`;
  const r = staminaRatio();
  dom.stamina.querySelector("b").style.width = `${Math.round(r * 100)}%`;
  dom.stamina.classList.toggle("low", state.stamina < STAMINA_LOW);
  // 根性★で体力の器が増えると、バー自体が伸びる
  dom.stamina.querySelector(".hud-bar").style.width = `${Math.round(92 * (maxStamina() / 100))}px`;
  dom.radar.querySelector(".hr-fill").setAttribute("points", STAT_KEYS.map((k, i) => pt(i, 4 + 3.2 * star(k))).join(" "));
}

/** 未読の赤丸（数字は出さない・通知バッジ風） */
export function setPhoneBadge(unread) {
  if (!dom) return;
  dom.phone.classList.toggle("has", !!unread);
  dom.phone.title = unread ? "LIME（未読あり）" : "LIME";
}
