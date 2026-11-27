// 売らずに持ち歩く、物語の記念品。入手条件・価格はここに集約する。
import { state } from "./state.js";
import { addMoney } from "./stats.js";
import { toast } from "./ui.js";
import { ALL_MINTO_CHEKIS } from "./minto-cheki-data.js";

export const KEEPSAKES = {
  ryuji_purikura: { name: "神崎との職人プリ", cost: 0, cg: "cg_ryuji_purikura", description: "挨拶に来た神崎と撮った一枚。盛れても筋は通す。" },
  ageha_first_purikura: { name: "あげはとの初プリ", cost: 0, cg: "cg_ageha_first_purikura", description: "MELTY PUFFの初回サービス。あげはのギャル落書きと、盛れた二人のプリクラ。" },
  minto_first_cheki: { name: "みんとの初来店チェキ", cost: 1000, cg: "cg_minto_first_cheki", description: "PEPPERMINTで撮った、みんとの落書き付きチェキ。" },
  // PEPPERMINTで頼むチェキ（被りなし）と、こっそりくれる私服の一枚（core/minto-cheki-data.js）
  ...Object.fromEntries(ALL_MINTO_CHEKIS.map(({ id, name, cost, cg, description }) => [id, { name, cost, cg, description }])),
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
