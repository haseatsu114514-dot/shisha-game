// 中盤に自分で材料を選び、その材料で一台を作る。大会当日の救済だけに依存しない。
import { el } from "../core/util.js";
import { DB } from "../core/data.js";
import { showScreen, retire } from "../core/ui.js";
import { state, save } from "../core/state.js";
import { SE } from "../core/audio.js";
import { openShop, ownedFlavorIds, flavorStock } from "./shop.js";
import { autoSkill } from "../craft/common.js";

export const preparationFlavors = () => ownedFlavorIds().filter(id => !["mint", "double_apple"].includes(id) && flavorStock(id) >= 12);

export async function prepareFlavorStock() {
  const stocked = preparationFlavors();
  if (stocked.length) {
    if (!stocked.includes(state.flags._prep_flavor)) state.flags._prep_flavor = stocked[0];
    save();
    return;
  }
  const options = [
    { id: "blueberry", note: "ブルーベリー＋ミント。果実の香りと清涼感を合わせる" },
    { id: "lemon", note: "レモン＋ミント。すっきりした香りを確かめる" },
    { id: "grape", note: "グレープ＋ミント。甘さと後味を比べる" },
  ];
  const selected = await new Promise(resolve => {
    const buttons = options.map(({ id, note }) => el("button.big-choice", {
      dataset: { test: `prep-flavor-${id}` }, onclick: () => { SE.select(); retire(root); resolve(id); },
    }, [el("b", { text: DB.flavorById[id]?.short_name || id }), el("small", { text: note })]));
    const root = showScreen("preparation", el("div.sub-menu", [
      el("h2.sub-title", { text: "大会に持っていく香り" }),
      el("p.sub-lead", { text: "仕入れた材料を作業台で試そう。練習の葉は店で用意するので、本番用の在庫は減りません。" }),
      el("div.sub-choices", buttons),
    ]));
    if (autoSkill()) setTimeout(() => buttons[0].click(), 60);
  });
  const price = DB.flavorById[selected]?.price || 0;
  await openShop({ errand: selected, minStock: 12, expense: state.money < price, expenseFlag: "_prep_flavor_expensed" });
  state.flags._prep_flavor = selected;
  save();
}
