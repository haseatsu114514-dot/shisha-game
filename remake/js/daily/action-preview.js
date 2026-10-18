// 行動前の表示。消耗はstatsの実処理、給料はバイトと同じ計算を参照する。
import { el, yen } from "../core/util.js";
import { state, STAT_JA } from "../core/state.js";
import { staminaAfter, maxStamina, currentCondition, star } from "../core/stats.js";
import { conditionForRatio } from "../core/condition.js";
import { isRainy, RAIN_BAITO_BONUS } from "./weather.js";

export function conditionAfter(delta = 0) {
  const sick = state.restDay;
  return sick?.chapter === state.chapter && sick.day === state.day && sick.illnessHealth
    ? currentCondition() : conditionForRatio(staminaAfter(delta) / maxStamina());
}

export function shiftPay({ called = false, condition = currentCondition() } = {}) {
  const bonus = Math.round([0, 500, 1200, 2000, 3000][star("charm") - 1] * condition.bonusRate);
  const extra = called ? 5000 : 0;
  const rainPay = isRainy() ? RAIN_BAITO_BONUS : 0;
  return { bonus, extra, rainPay, pay: 8000 + bonus + extra + rainPay + condition.shiftBonus };
}

export function actionPreview(spot, { mode = null, free = false } = {}) {
  if (spot.kind === "tonari") {
    const work = mode === "baito";
    if (!mode) return { choice: true, label: "店内で選ぶ", detail: "入店だけなら0行動。客席かバイトを選びます。" };
    const delta = work ? -24 : -10;
    return { slots: 1, cost: 0, delta, income: work ? shiftPay({ condition: conditionAfter(delta) }).pay : 0,
      purpose: work ? "接客で稼ぐ・技術と魅力を磨く" : "客席で一服・常連と交流", label: work ? "バイト" : "客席" };
  }
  if (spot.kind === "shop") return mode === "rin"
    ? { slots: 1, cost: 0, delta: -14, purpose: "夜限定・凛に相談する", label: "2階の相談" }
    : { slots: 0, costText: "購入品による", delta: 0, purpose: "道具・フレーバーを仕入れる", label: "1階の買い物" };
  if (spot.kind === "fortune") return { slots: 0, costText: "相性占い 3,000円", delta: 0, purpose: "相性を占う" };
  if (spot.kind === "trpg") return { choice: true, label: "店内で選ぶ", detail: "入店は0行動・0円。試遊・購入・遊ぶ内容ごとに案内します。" };
  if (spot.kind === "axe") return { slots: 1, cost: spot.cost || 0, delta: spot.stamina || 0, purpose: "斧投げを楽しむ", costText: spot.playCost ? `プレイ ${yen(spot.playCost)}` : undefined };
  if (spot.kind === "rest" && mode === "practice") return { choice: true, label: "練習内容を選ぶ", detail: "選ぶまでは0行動。練習内容・使う葉・体力を家で確認できます。" };
  if (spot.id === "choizap" && !state.flags._gym_member) return { slots: 1, costText: "入会する場合 4,000円", delta: spot.stamina || 0, purpose: "体を整える・入会は現地で選べます" };
  return { slots: 1, cost: free ? 0 : spot.cost || 0, delta: free ? -10 : spot.stamina || 0,
    purpose: free ? "頼まれた用事を進める" : spot.kind === "rest" ? "体力を回復する"
      : spot.id === "choizap" ? "体を整える"
      : spot.kind === "rival" || spot.kind === "samechan" ? "店で一服・交流する"
      : spot.stat ? `${STAT_JA[spot.stat]}を磨く・街の話を聞く` : "街で過ごす" };
}

export function previewText(preview) {
  if (preview.choice) return preview.detail;
  const amount = preview.income ? `収入目安 +${yen(preview.income)}` : preview.costText || `料金 ${yen(preview.cost || 0)}`;
  return `${preview.slots}行動 ・ ${amount} ・ ${preview.delta ? `体調 ${currentCondition().label} → ${conditionAfter(preview.delta).label}` : "体力消費なし"}`;
}

export function previewCard(preview) {
  if (preview.choice) return el("p.action-preview-note", { text: preview.detail });
  const after = staminaAfter(preview.delta || 0), maximum = maxStamina();
  const condition = conditionAfter(preview.delta || 0);
  const warn = preview.delta < 0 && conditionForRatio(after / maximum).health === "red";
  return el("div.action-preview", { dataset: { health: condition.health, test: "action-preview" } }, [
    preview.label ? el("b", { text: preview.label }) : null,
    el("div.ap-summary", [el("span", { text: `${preview.slots}行動` }),
      el("span", { text: preview.income ? `収入目安 +${yen(preview.income)}` : preview.costText || `料金 ${yen(preview.cost || 0)}` })]),
    el("div.ap-condition", { text: preview.delta ? `体調 ${currentCondition().label} → ${condition.label}（体力 ${after}/${maximum}）` : "体力消費なし" }),
    preview.delta ? el("span.ap-gauge", { role: "img", "aria-label": `行動後の体力 ${after}/${maximum}` }, [el("i", { style: { width: `${after / maximum * 100}%` } })]) : null,
    preview.purpose ? el("small", { text: preview.purpose }) : null,
    warn ? el("strong.ap-warning", { text: "行動後は体力が赤くなります。風邪に注意。" }) : null,
  ]);
}
