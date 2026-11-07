import { CH2_CITY_EN, CH2_CITY_NAME, HOME_CITY_EN, HOME_CITY_NAME } from "../core/city-locations.js";
// 日常パートの常時表示（日付・時間帯・大会までの日数・所持金・体力・スマホ・MENU）。
// 左上に DAY カード、右上に LIME と MENU。ステータスは全画面MENU（daily/menu.js）のタブへ移し、
// 五角形のステータスボタンは廃止した（DUI05）。未使用の火種の印は MENU の右上に出す。
import { el, yen, sleep } from "../core/util.js";
import { layers, toast } from "../core/ui.js";
import { on } from "../core/bus.js";
import { state } from "../core/state.js";
import { staminaRatio, currentCondition, maxStamina } from "../core/stats.js";
import { conditionForRatio } from "../core/condition.js";
import { isRainy } from "./weather.js";
import { chapterDay, chapterDaysLeft, chapterFinalDay, chapterGoalLabel } from "../core/chapter-clock.js";
import { travelsBetweenCities } from "../core/travel-budget.js";
import { growthEnabled, growthView, gaugeInfo, hidaneTotal } from "../core/growth.js";
import { NODE_BY_ID, pathTo } from "../core/growth-board.js";

// 体力バーの長さ（最大体力100のとき）。根性で最大体力が伸びるとバーも同じ割合で伸びる（GUI26）。
const STAMINA_BAR_BASE = 92;

/** 章の最終日（大会・勝負の日）まであと何日か。決まっていなければ null。台詞の {daysLeft} もこれに一本化する */
export const daysLeft = () => chapterDaysLeft(state);

let dom = null;
let handlers = { phone: null, menu: null };
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

// 地図で行き先を選んでいる間だけ、M キーで MENU を開く（MENU の中では M・Esc で閉じる）。
let menuKey = false;
function installMenuKey() {
  if (menuKey) return;
  menuKey = true;
  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || (e.key !== "m" && e.key !== "M")) return;
    if (e.target?.closest?.("input, select, textarea, [contenteditable]")) return;
    const body = document.body;
    if (!dom || !layers.hud.classList.contains("show") || body.dataset.screen !== "map" || !document.querySelector("#screen .map:not(.done)")) return;
    if (layers.modal.classList.contains("show") || body.classList.contains("vn-open") || body.classList.contains("in-vn")
      || document.querySelector(".phone-overlay") || layers.fx.querySelector(".gboard, .levelup-backdrop")) return;
    const button = layers.hud.querySelector(".hud-menu");
    if (!button) return;
    e.preventDefault();
    button.click();
  });
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
    // 所持金・大会まで・体力のラベルは文字を残し（読み上げ・説明用）、画面では ¥・🏆・♥ の印に置き換える（CSS・#2853）
    leftLabel: el("span.dc-label", { text: "次の大会まで" }),
    stamina: el("div.hud-stamina", [el("span.dc-label", { text: "体力" }), el("i.hud-bar", [el("span.gauge-track", [el("b")])])]),
    phone: el("button.hud-lime", { title: "LIME", "aria-label": "LIME", dataset: { test: "hud-phone" }, onclick: () => handlers.phone?.() }, [el("span", { text: "LIME" }), el("em.badge")]),
    // 経験値と次のレベルまで（SPEC 6.1a）。置き場所は情報カードの体力の下（REPORT P4・R5）
    exp: el("div.hud-exp", { hidden: true, dataset: { test: "hud-exp" } }, [
      el("span.hx-lv"), el("i.hud-bar.hx-bar", [el("b.hx-settled"), el("b.hx-today")]), el("small.hx-left"),
      // 盤の目標までの火種（SPEC 6.1「火の番まで 火種6」）。目標が無い間は出さない
      el("small.hx-target", { hidden: true, dataset: { test: "hud-target" } }),
    ]),
    // 未使用の火種の印。火の色・個数入りで、LIME の未読の赤丸と区別する（REPORT P5・R6）
    hidane: el("em.hidane-badge", { hidden: true, dataset: { test: "hud-hidane" } }),
    menu: el("button.hud-menu", { title: "MENU（M）", "aria-label": "MENU", dataset: { test: "hud-menu" }, onclick: () => handlers.menu?.() }, [el("i"), el("span", { text: "MENU" })]),
  };
  dom.menu.append(dom.hidane);
  const moneyRow = el("div.dc-row.money", { title: "所持金" }, [el("span.dc-label", { text: "所持金" }), dom.money]);
  const root = el("div.hud", [
    el("div.hud-card", [
      el("div.dc-main", [dom.area, dom.day, dom.slot]),
      el("div.dc-meta", [moneyRow, el("div.dc-row.goal", { dataset: { test: "hud-goal" } }, [dom.leftLabel, dom.left]), dom.stamina, dom.exp]),
    ]),
    el("div.hud-right", [dom.phone, dom.menu]),
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
  installMenuKey();
}

/** 1行動につき1枚の「EXP +N　はじめて・なじみ」（内訳の数字は出さない。REPORT R7） */
function showExpChip({ total, tags = [], publicReward = false }) {
  if (!dom || !(total > 0)) return;
  if (!growthEnabled()) {
    if (publicReward) toast(`EXP +${total}（累計 ${state.growth?.xp || 0}）`, { kind: "good" });
    return;
  }
  const chip = el("div.exp-chip", { role: "status", dataset: { test: "exp-chip" } }, [
    el("b", { text: `EXP +${total}` }), tags.length ? el("span", { text: tags.join("・") }) : null,
  ]);
  dom.exp.append(chip);
  setTimeout(() => chip.remove(), 2200);
}

function updateGrowth() {
  const on = growthEnabled();
  dom.exp.hidden = !on;
  const view = on ? growthView() : null; // HUD は見るだけ。成長データが無くても作らない
  const total = view ? hidaneTotal(view) : 0;
  dom.hidane.hidden = !(total > 0);
  dom.hidane.textContent = total > 99 ? "99" : String(total || "");
  dom.menu.title = total > 0 ? `MENU（M）・未使用の火種 ${total}` : "MENU（M）";
  dom.menu.setAttribute("aria-label", total > 0 ? `MENU（未使用の火種 ${total}）` : "MENU");
  if (!on) return;
  const g = gaugeInfo(view);
  dom.exp.querySelector(".hx-lv").textContent = `Lv.${g.level}`;
  dom.exp.querySelector(".hx-settled").style.width = `${Math.round(g.settled * 100)}%`;
  dom.exp.querySelector(".hx-today").style.width = `${Math.round(g.now * 100)}%`;
  const left = dom.exp.querySelector(".hx-left");
  // 「あと○」の数字は出さない（オーナー指示 2026-11-08「ゲージでわかる」）。数字は title / aria-label に残す。
  // 状態を伝える「今夜 Lv UP」「MAX」だけ文字で出す。
  left.textContent = g.max ? "MAX" : g.pending > 0 ? `今夜 Lv UP${g.pending > 1 ? ` ×${g.pending}` : ""}` : "";
  left.hidden = !left.textContent;
  dom.exp.classList.toggle("ready", g.pending > 0);
  dom.exp.dataset.milestone = g.nextMilestone && !g.max ? "true" : "false";
  renderTarget(view);
  dom.exp.title = g.max ? `Lv.${g.level} MAX` : g.pending > 0
    ? `今夜レベルアップ（あふれた分 +${g.overflow}）` : `次のレベルまで EXP ${g.left}${g.nextMilestone ? "（次は火種が2つ）" : ""}`;
  dom.exp.setAttribute("aria-label", dom.exp.title);
}

/** 盤で目標にしたマスまでの経路で使う火種の合計（手持ちとの差額ではない）。届いたら目標は盤の決定で外れる（SPEC 2.4） */
function renderTarget(g) {
  const target = dom.exp.querySelector(".hx-target");
  const node = g.target ? NODE_BY_ID[g.target] : null;
  if (!node) { target.hidden = true; target.textContent = ""; return; }
  const name = node.kind === "stat" ? (node.peak ? "極み" : node.notable ? "要のマス" : "マス") : node.kind === "gate" ? "台座" : node.name;
  const { cost } = pathTo(node.id, new Set(g.nodes));
  target.hidden = false;
  // 情報カードは幅が狭いので、ゲージを潰さない短い印だけ出す。目標の名前は説明（title・読み上げ）で
  target.textContent = `◎火種${cost}`;
  target.title = `心得の盤の目標「${name}」までに使う火種${cost}（経路の合計）`;
  target.setAttribute("aria-label", target.title);
}

export function showHud(v = true) {
  layers.hud.classList.toggle("show", v);
  if (v) updateHud();
}

/**
 * 章の側の読み方やミニゲーム（クラブSEAM の DJ など）は HUD を差し替えるので、終わったら日常ループの HUD を戻す。
 * 第3章・第4章の日常ループにある同じ形の関数と同じ動き（第5章の東京で使う）。
 */
export async function keepDailyHud(task) {
  const root = layers.hud.firstElementChild;
  try { return await task(); }
  finally {
    if (root && !root.isConnected) layers.hud.replaceChildren(root);
    showHud(true);
  }
}

export function updateHud() {
  if (!dom || !state) return;
  // 今いる街（第2章・第5章は flags._ch2_region。第5章は東京にも泊まれる・#2033。第3章の東京も同じ印・VOL03）
  const region = travelsBetweenCities(state) || [3, 4].includes(state.chapter) ? state.flags._ch2_region : "home";
  const [areaId, areaEn, areaName] = region === "widehanga" ? ["widehanga", CH2_CITY_EN, CH2_CITY_NAME]
    : region === "tokyo" && [3, 5].includes(state.chapter) ? ["tokyo", "TOKYO", "東京"]
    : region === "dubai" && [4, 5].includes(state.chapter) ? ["dubai", "DUBAI", "ドバイ"] : ["sakae", HOME_CITY_EN, HOME_CITY_NAME];
  dom.area.dataset.region = areaId;
  dom.area.setAttribute("aria-label", areaEn);
  dom.area.replaceChildren(
    el("span.dc-area-full", { text: areaEn }),
    el("span.dc-area-short", { text: areaName }),
  );
  const finalDay = chapterFinalDay(state);
  dom.day.replaceChildren(...[el("b", { text: String(chapterDay(state)) }), finalDay === null ? null : el("small", { text: `/${finalDay}` })].filter(Boolean));
  const night = state.slot >= 1;
  const rain = isRainy() ? "・雨" : "";
  // 昼・夜の札に、今日あと何回動けるかを入れる（「☀残り2」。地図の案内箱にあった一言をここへ統合・#2853）
  const tournament = state.phase === "tournament";
  const moves = night ? 1 : 2;
  dom.slot.textContent = tournament ? "大会当日" : state.slot >= 2 ? "帰宅"
    : `${isRainy() ? "☂" : night ? "☾" : "☀"}残り${moves}`; // 雨の夜は ☂（夜は札の色で分かる）
  const slotName = tournament ? "大会当日" : state.slot >= 2 ? "帰宅" : `${night ? "夜" : "昼"}${rain} ── 今日はあと${moves}回動ける`;
  dom.slot.title = slotName;
  dom.slot.setAttribute("aria-label", slotName);
  dom.slot.dataset.slot = night ? "night" : "day";
  dom.money.textContent = yen(state.money);
  const left = daysLeft();
  dom.leftLabel.textContent = chapterGoalLabel(state);
  dom.leftLabel.parentElement.title = chapterGoalLabel(state);
  dom.left.textContent = left === null ? "未定" : `あと${left}日`;
  const r = staminaRatio();
  const condition = currentCondition();
  // ゲージは実残量。発病日の制作コンディションは従来どおり別に保持する。
  const health = conditionForRatio(staminaRatio({ forCondition: true })).health;
  dom.stamina.dataset.health = health;
  dom.stamina.title = `体力：${condition.label}。${condition.hint}`;
  dom.stamina.querySelector(".hud-bar").setAttribute("aria-label", dom.stamina.title);
  dom.stamina.querySelector("b").style.width = `${Math.round(r * 100)}%`;
  scheduleRecovery();
  dom.stamina.classList.toggle("low", health === "red");
  // 育成（根性）で最大体力が増えると、バー自体が伸びる。上乗せ分の色分け・印・点線の枠は出さない（DUI13・2026-10-31 オーナー指示）。
  dom.stamina.querySelector(".hud-bar").style.width = `${Math.round(STAMINA_BAR_BASE * (maxStamina() / 100))}px`;
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
  const panel = el("div.sleep-recovery", { dataset: { test: "sleep-recovery", health: conditionForRatio(after / maxStamina({ forCondition: true })).health }, role: "status" }, [
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
