// シーシャ作りの新しい配置「一枚の舞台」（CSL・docs/design/craft-stage-layout.md）の切り替え。
// 見た目（css/craft-stage.css）だけを替え、工程・判定・点数・保存には触れない。
// 全工程の配置がそろうまでは既定で切。URL に ?craftStage=1 で入（端末に覚える）、?craftStage=0 で切。
const KEY = "suien_craft_stage";

/** 起動時に一度呼ぶ。body に craft-stage を付け外しし、入っているかを返す。 */
export function initCraftStage() {
  let on = false;
  try {
    const q = new URLSearchParams(location.search).get("craftStage");
    if (q === "1" || q === "0") localStorage.setItem(KEY, q);
    on = localStorage.getItem(KEY) === "1";
  } catch { /* 保存できない端末では切のまま */ }
  document.body.classList.toggle("craft-stage", on);
  return on;
}

/** 新しい配置が入っているか（DS風2画面では使わない）。 */
export const craftStageEnabled = () => typeof document !== "undefined"
  && !!document.body?.classList.contains("craft-stage") && !document.body.classList.contains("game-ds");
