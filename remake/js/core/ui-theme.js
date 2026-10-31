import { imgFileUrl } from "./img-file.js";

// 配色・素材だけの設定。進行や報酬・判定・セーブデータには触れない。
export const UI_THEMES = Object.freeze([
  { id: "paper", label: "紙とラベンダー", note: "生成りの紙と、ラベンダーの札（DUI08）" },
  { id: "smoke", label: "11 煙だけの輪郭", note: "透ける墨色と、淡い煙の線" },
  { id: "smoke-purple", label: "11 煙だけの輪郭・紫", note: "墨紫とラベンダーの光" },
  { id: "cut-paper", label: "16 紫・ペーパーラウンジ", note: "温かな墨紫と、柔らかく重なる紙" },
  { id: "amber", label: "25 琥珀ラウンジ", note: "深い茶色と、琥珀の灯り" },
  { id: "tissue", label: "28 重なる薄紙", note: "生成りの薄紙と、静かな金の線" },
  { id: "classic", label: "これまでのゴージャス", note: "墨紫・真鍮の装飾枠" },
]);
export const DEFAULT_UI_THEME = "paper";
const FRAME_ART = Object.freeze({
  paper: imgFileUrl("ui/paper/dialogue.webp"),
  smoke: imgFileUrl("ui/vn-faithful/smoke.webp"), "smoke-purple": imgFileUrl("ui/vn-faithful/smoke-purple.webp"),
  "cut-paper": imgFileUrl("ui/vn-calm/paper.webp"), amber: imgFileUrl("ui/vn-lounge/amber.svg"),
  tissue: imgFileUrl("ui/vn-faithful/tissue.webp"), classic: imgFileUrl("ui/vn-lounge/narration.svg"),
  "heisei-blue": imgFileUrl("ui/blue-preview/panel.webp"),
});
export function uiThemeFrame(value) { return FRAME_ART[value] || FRAME_ART[DEFAULT_UI_THEME]; }
export function normalizeUiTheme(value) {
  return UI_THEMES.some(theme => theme.id === value) ? value : DEFAULT_UI_THEME;
}
export function applyUiTheme(value) {
  const id = normalizeUiTheme(value);
  if (typeof document !== "undefined") document.documentElement.dataset.uiTheme = id;
  return id;
}
export function createUiThemeSelect(value, onChange) {
  const select = document.createElement("select");
  select.className = "ui-theme-select";
  select.setAttribute("aria-label", "UIデザイン");
  select.dataset.test = "ui-theme-select";
  for (const theme of UI_THEMES) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.label;
    select.append(option);
  }
  select.value = normalizeUiTheme(value);
  select.addEventListener("change", () => onChange(applyUiTheme(select.value)));
  return select;
}
