// 配色・素材だけの設定。進行や報酬・判定・セーブデータには触れない。
export const UI_THEMES = Object.freeze([
  { id: "smoke", label: "11 煙だけの輪郭", note: "透ける墨色と、淡い煙の線" },
  { id: "smoke-purple", label: "11 煙だけの輪郭・紫", note: "墨紫とラベンダーの光" },
  { id: "cut-paper", label: "16 紫・切り紙エディトリアル", note: "斜めに重なる紙と、鮮やかな紫" },
  { id: "amber", label: "25 琥珀ラウンジ", note: "深い茶色と、琥珀の灯り" },
  { id: "tissue", label: "28 重なる薄紙", note: "生成りの薄紙と、静かな金の線" },
  { id: "classic", label: "これまでのゴージャス", note: "墨紫・真鍮の装飾枠" },
]);
export const DEFAULT_UI_THEME = "smoke";
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
