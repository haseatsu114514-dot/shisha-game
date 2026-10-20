// テンプレートの正本。追加時は counts と説明を登録し、交流で解放する場合は
// unlockFlag を付ける。既存の state.flags にそのフラグが立った一台から選べる。
import { RINGS } from "./holes_logic.js";

export const HOLE_TEMPLATES = [
  {
    id: "outer24", label: "外周24穴",
    unlockFlag: "_hole_outer24_unlocked",
    counts: { outer: 24, middle: 0, inner: 0 },
    description: "外周から広く熱を回す。温度を落ち着かせやすい",
  },
  {
    id: "outer12-middle12", label: "外周12穴＋中周12穴",
    counts: { outer: 12, middle: 12, inner: 0 },
    description: "中周にも熱を届ける。外周だけより温度を動かしやすい",
  },
];
export const DEFAULT_HOLE_TEMPLATE = "outer12-middle12";
export const availableHoleTemplates = (flags = {}, templates = HOLE_TEMPLATES) =>
  templates.filter((template) => !template.unlockFlag || flags[template.unlockFlag]);
export const ringsForTemplate = (template) => RINGS
  .map((ring) => ({ ...ring, targets: template.counts[ring.id] || 0 }))
  .filter((ring) => ring.targets > 0);
export const templateCountsLabel = (template) => RINGS
  .map((ring) => `${ring.label}${template.counts[ring.id] || 0}`).join("・");
