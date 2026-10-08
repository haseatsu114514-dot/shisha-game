// 売らずに持ち歩く、物語の記念品。入手条件・価格はここに集約する。
import { state } from "./state.js";
import { addMoney } from "./stats.js";
import { toast } from "./ui.js";

export const KEEPSAKES = {
  minto_first_cheki: { name: "みんとの初来店チェキ", cost: 1000, cg: "cg_minto_first_cheki", description: "PEPPERMINTで撮った、みんとの落書き付きチェキ。" },
};

export function buyKeepsake(id) {
  const item = KEEPSAKES[id];
  if (!item) return false;
  state.keepsakes ||= [];
  if (state.keepsakes.includes(id)) return true;
  if (state.money < item.cost) return false;
  addMoney(-item.cost);
  state.keepsakes.push(id);
  toast(`${item.name}を持ち物にしまった`, { kind: "good" });
  return true;
}
