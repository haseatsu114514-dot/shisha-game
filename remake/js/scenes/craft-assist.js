import { el } from "../core/util.js";
import { modal } from "../core/ui.js";
import { config, saveConfig } from "../core/state.js";

const OPTIONS = [
  ["normal", "通常"],
  ["slow", "ゆっくり操作"],
  ["auto", "反復操作をおまかせ"],
];

export const craftAssistMode = () => OPTIONS.some(([value]) => value === config.craftAssist) ? config.craftAssist : "normal";

export function craftAssistSelect() {
  return el("select", {
    dataset: { test: "craft-assist-select" },
    "aria-label": "制作補助",
    onchange: event => { config.craftAssist = event.target.value; saveConfig(); },
  }, OPTIONS.map(([value, label]) => {
    const option = el("option", { value, text: label });
    option.selected = value === craftAssistMode();
    return option;
  }));
}

export async function openCraftAssistSettings() {
  const value = await modal({
    title: "制作補助",
    body: "初回の手本は自分で体験します。配合や大事な選択は自分で決め、穴あけ・炭・蒸らしなど繰り返す操作を補助します。タイトルの設定やMENUから変更できます。",
    options: OPTIONS.map(([label, title]) => ({ label: title, value: label, test: `craft-assist-${label}`, primary: label === craftAssistMode() })),
  });
  if (!OPTIONS.some(([option]) => option === value)) return;
  config.craftAssist = value;
  saveConfig();
}
