import { CH2_CITY_EN, CH2_CITY_NAME, HOME_CITY_EN, HOME_CITY_NAME } from "../core/city-locations.js";
// 日常パートの常時表示（日付・時間帯・大会までの日数・所持金・体力・スマホ・ステータス）。
// 見た目は旧版の墨×金を踏襲: 左上に DAY カード、右上に体力・ステータスの五角形・LIME・MENU。
import { el, yen, sleep } from "../core/util.js";
import { layers } from "../core/ui.js";
import { on } from "../core/bus.js";
import { state, STAT_KEYS } from "../core/state.js";
import { staminaRatio, currentCondition, maxStamina, star } from "../core/stats.js";
import { conditionForRatio } from "../core/condition.js";
import { isRainy } from "./weather.js";
import { TOURNAMENT_DAY } from "../core/rules.js";
import { chapterDay, chapterDaysLeft } from "../core/chapter-clock.js";
import { growthEnabled, ensureGrowth, gaugeInfo, hidaneTotal, currentBoost } from "../core/growth.js";

/** 大会（DAY14）まであと何日か。台詞の {daysLeft} もこれに一本化する */
export const daysLeft = () => chapterDaysLeft(state);

let dom = null;
let handlers = { phone: null, status: null, menu: null };
let recoveryTimer = null;
let pendingRecovery = null;
let recoveryFrame = 0;
function showRecovery({ before, after }) {
  if (!dom || after <= before) return;
  pendingRecovery = { before: Math.min(pendingRecovery?.owner === state ? pendingRecovery.before : before, before), owner: state };
  scheduleRecovery();
}
on("stamina-change", showRecovery);

// 就寝・会話の裏で増えた分は、街へ戻って本来のゲージが見えてから伸ばす。
function scheduleRecovery() {
  if (recoveryFrame || !pendingRecovery) return;
  recoveryFrame = requestAnimationFrame(() => {
    recoveryFrame = 0;
    if (pendingRecovery && pendingRecovery.owner !== state) pendingRecovery = null;
    if (!dom || !pendingRecovery || !layers.hud.classList.contains("show") ||
      document.body.dataset.screen !== "map" || document.body.classList.contains("vn-open") ||
      document.body.classList.contains("in-vn") || layers.modal.classList.contains("show") ||
      layers.wipe.classList.contains("black") || layers.wipe.classList.contains("cover") ||
      layers.fx.querySelector(".day-card")) return;
    const recovery = pendingRecovery;
    pendingRecovery = null;
    const fill = dom.stamina.querySelector("b");
    const target = `${Math.round(staminaRatio() * 100)}%`;
    if (state.stamina <= recovery.before) return;
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
    area: el("div.dc-area", { text: HOME_CITY_EN }),
    day: el("div.dc-day"),
    slot: el("div.dc-slot"),
    money: el("b"),
    left: el("b"),
    stamina: el("div.hud-stamina", [el("span", { text: "体力" }), el("i.hud-bar", [el("span.gauge-track", [el("b")])])]),
    radar: miniRadar(),
    phone: el("button.hud-lime", { title: "LIME", dataset: { test: "hud-phone" }, onclick: () => handlers.phone?.() }, [el("span", { text: "LIME" }), el("em.badge")]),
    status: el("button.hud-level", { title: "ステータス", dataset: { test: "hud-status" }, onclick: () => handlers.status?.() }),
    // 経験値と次のレベルまで（SPEC 6.1a）。置き場所は情報カードの体力の下（REPORT P4・R5）
    exp: el("div.hud-exp", { hidden: true, dataset: { test: "hud-exp" } }, [
      el("span.hx-lv"), el("i.hud-bar.hx-bar", [el("b.hx-settled"), el("b.hx-today")]), el("small.hx-left"), el("small.hx-boost", { hidden: true, dataset: { test: "hud-boost" } }),
    ]),
    // 未使用の火種の印。火の色・個数入りで、LIME の未読の赤丸と区別する（REPORT P5・R6）
    hidane: el("em.hidane-badge", { hidden: true, dataset: { test: "hud-hidane" } }),
    menu: el("button.hud-menu", { dataset: { test: "hud-menu" }, onclick: () => handlers.menu?.() }, [el("i"), el("span", { text: "MENU" })]),
  };
  dom.status.append(dom.radar, dom.hidane);
  const moneyRow = el("div.dc-row.money", [el("span", { text: "所持金" }), dom.money]);
  const root = el("div.hud", [
    el("div.hud-card", [
      el("div.dc-main", [dom.area, dom.day, dom.slot]),
      el("div.dc-meta", [moneyRow, el("div.dc-row", [el("span", { text: "次の大会まで" }), dom.left]), dom.stamina, dom.exp]),
    ]),
    el("div.hud-right", [dom.status, dom.phone, dom.menu]),
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
  on("exp-gain", showExpChip);
}

/** 1行動につき1枚の「EXP +N　はじめて・なじみ」（内訳の数字は出さない。REPORT R7） */
function showExpChip({ total, tags = [] }) {
  if (!dom || !growthEnabled() || !(total > 0)) return;
  const chip = el("div.exp-chip", { role: "status", dataset: { test: "exp-chip" } }, [
    el("b", { text: `EXP +${total}` }), tags.length ? el("span", { text: tags.join("・") }) : null,
  ]);
  dom.exp.append(chip);
  setTimeout(() => chip.remove(), 2200);
}

function updateGrowth() {
  const on = growthEnabled();
  dom.exp.hidden = !on;
  const total = on ? hidaneTotal(ensureGrowth()) : 0;
  dom.hidane.hidden = !(total > 0);
  dom.hidane.textContent = total > 99 ? "99" : String(total || "");
  dom.status.title = total > 0 ? `ステータス（未使用の火種 ${total}）` : "ステータス";
  dom.status.setAttribute("aria-label", dom.status.title);
  if (!on) return;
  const g = gaugeInfo();
  dom.exp.querySelector(".hx-lv").textContent = `Lv.${g.level}`;
  dom.exp.querySelector(".hx-settled").style.width = `${Math.round(g.settled * 100)}%`;
  dom.exp.querySelector(".hx-today").style.width = `${Math.round(g.now * 100)}%`;
  const left = dom.exp.querySelector(".hx-left");
  left.textContent = g.max ? "MAX" : g.pending > 0 ? `今夜 Lv UP${g.pending > 1 ? ` ×${g.pending}` : ""}` : `あと${g.left}`;
  dom.exp.classList.toggle("ready", g.pending > 0);
  // スロットの追い風（stat-design SPEC 1.8）。「追い風 ×1.5 あと3」
  const b = currentBoost();
  const boostEl = dom.exp.querySelector(".hx-boost");
  boostEl.hidden = !b;
  boostEl.textContent = b ? `${b.mult >= 2 ? "大追い風" : "追い風"} ×${b.mult} あと${b.left}` : "";
  dom.exp.dataset.milestone = g.nextMilestone && !g.max ? "true" : "false";
  dom.exp.title = g.max ? "Lv.80 MAX" : g.pending > 0
    ? `今夜レベルアップ（あふれた分 +${g.overflow}）` : `次のレベルまで EXP ${g.left}${g.nextMilestone ? "（次は火種が2つ）" : ""}`;
  dom.exp.setAttribute("aria-label", dom.exp.title);
}

export function showHud(v = true) {
  layers.hud.classList.toggle("show", v);
  if (v) updateHud();
}

export function updateHud() {
  if (!dom || !state) return;
  const widehanga = state.chapter === 2 && state.flags._ch2_region === "widehanga";
  dom.area.dataset.region = widehanga ? "widehanga" : "sakae";
  dom.area.setAttribute("aria-label", widehanga ? CH2_CITY_EN : HOME_CITY_EN);
  dom.area.replaceChildren(
    el("span.dc-area-full", { text: widehanga ? CH2_CITY_EN : HOME_CITY_EN }),
    el("span.dc-area-short", { text: widehanga ? CH2_CITY_NAME : HOME_CITY_NAME }),
  );
  dom.day.replaceChildren(el("b", { text: String(chapterDay(state)) }), el("small", { text: `/${TOURNAMENT_DAY}` }));
  const night = state.slot >= 1;
  const rain = isRainy() ? "・雨" : "";
  dom.slot.textContent = state.phase === "tournament" ? "大会当日" : state.slot >= 2 ? "帰宅" : night ? `夜${rain}` : `昼${rain}`;
  dom.slot.dataset.slot = night ? "night" : "day";
  dom.money.textContent = yen(state.money);
  dom.left.textContent = `あと${daysLeft()}日`;
  const r = staminaRatio();
  const condition = currentCondition();
  // ゲージは実残量。発病日の制作コンディションは従来どおり別に保持する。
  const health = conditionForRatio(r).health;
  dom.stamina.dataset.health = health;
  dom.stamina.title = `体力：${condition.label}。${condition.hint}`;
  dom.stamina.querySelector(".hud-bar").setAttribute("aria-label", dom.stamina.title);
  dom.stamina.querySelector("b").style.width = `${Math.round(r * 100)}%`;
  scheduleRecovery();
  dom.stamina.classList.toggle("low", health === "red");
  // 根性★で体力の器が増えると、バー自体が伸びる
  dom.stamina.querySelector(".hud-bar").style.width = `${Math.round(92 * (maxStamina() / 100))}px`;
  dom.radar.querySelector(".hr-fill").setAttribute("points", STAT_KEYS.map((k, i) => pt(i, 4 + 3.2 * star(k))).join(" "));
  updateGrowth();
}

let recoveryObserver = null;

/** 未読件数を表示。従来の真偽値呼び出しにも互換対応する。 */
export function setPhoneBadge(unread) {
  if (!dom) return;
  const count = typeof unread === "number" ? unread : unread ? 1 : 0;
  const name = count ? `LIME（未読${count}件）` : "LIME";
  dom.phone.classList.toggle("has", count > 0);
  const badge = dom.phone.querySelector(".badge");
  badge.classList.toggle("single", count > 0 && count < 10);
  badge.replaceChildren(el("b.badge-number", { text: count > 99 ? "99" : String(count || "") }));
  if (count > 99) badge.append(el("small.badge-plus", { text: "+" }));
  dom.phone.title = name;
  dom.phone.setAttribute("aria-label", name);
}

/** 朝の家の画面で、就寝前の残量から回復後までゲージを伸ばす。 */
export async function presentSleepRecovery({ before, after }) {
  if (after <= before) return;
  pendingRecovery = null;
  const maximum = maxStamina();
  const fill = el("b", { style: `width:${Math.min(100, before / maximum * 100)}%` });
  const panel = el("div.sleep-recovery", { dataset: { test: "sleep-recovery", health: conditionForRatio(after / maximum).health }, role: "status" }, [
    el("p", { text: "ぐっすり眠って、体力が回復した" }),
    el("div.sleep-gauge", { role: "img", "aria-label": "睡眠で体力が回復している" }, [fill]),
  ]);
  layers.fx.append(panel);
  await sleep(30);
  panel.classList.add("show");
  await sleep(180);
  fill.style.width = `${Math.min(100, after / maximum * 100)}%`;
  panel.querySelector(".sleep-gauge").setAttribute("aria-label", "睡眠で体力が回復した");
  await sleep(1250);
  panel.classList.remove("show");
  await sleep(220);
  panel.remove();
}
