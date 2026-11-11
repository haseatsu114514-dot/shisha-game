// シーシャ作りの新しい配置「一枚の舞台」（CSL・docs/design/craft-stage-layout.md）の切り替え。
// 見た目（css/craft-stage.css）だけを替え、工程・判定・点数・保存には触れない。
// 既定で入（2026-11-10 オーナー「大会パートやチュートリアルやバイト後の練習にこの新しいシーシャ作りパートを組み込んで」）。
// 比べたいときは URL に ?craftStage=0 で旧配置（端末に覚える）、?craftStage=1 で戻す。
const KEY = "suien_craft_stage";

/** 起動時に一度呼ぶ。body に craft-stage を付け外しし、入っているかを返す。 */
export function initCraftStage() {
  let on = true;
  try {
    const q = new URLSearchParams(location.search).get("craftStage");
    if (q === "1" || q === "0") localStorage.setItem(KEY, q);
    on = localStorage.getItem(KEY) !== "0";
  } catch { on = true; /* 保存できない端末でも既定の新しい配置 */ }
  document.body.classList.toggle("craft-stage", on);
  return on;
}

/** 新しい配置が入っているか（DS風2画面では使わない）。 */
export const craftStageEnabled = () => typeof document !== "undefined"
  && !!document.body?.classList.contains("craft-stage") && !document.body.classList.contains("game-ds");
