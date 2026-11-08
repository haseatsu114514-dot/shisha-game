// 第5章の各地の店めぐり帳（MGR）: 来店を終えた時の判子と一言・くじ券・LIMEの「店めぐり帳」の行と帳面。
// 決まり（載せる店・判子・枚数）は chapters/ch5-shop-stamps-model.js。台詞の場面は無い（来店の会話は店のいつものもの）。
// 帳面は Dr.fookah がLIMEで配っている判子帳（Dr.fookah の店は地元・柚ヶ谷・東京・ドバイのどこにもある）。くじ券も Dr.fookah から。
// 判子は日常ループが行き先の行動を終えた後（daily/calendar.js の afterSpot）に押す。保存は日常ループの行動の精算が行う。
// お金・好感度・能力・経験値は動かさない（来店の分は、それぞれの店のいつもの来店が付ける）。
import { state, save } from "../core/state.js";
import { modal, toast } from "../core/ui.js";
import { el } from "../core/util.js";
import { grantKujiTickets } from "../daily/kuji-tickets.js";
import {
  REGION_TICKETS, COMPLETE_BONUS_TICKETS, recordShopStamp, shopStampsProgress, markShopStampsOpened,
} from "./ch5-shop-stamps-model.js";

const KUJI_NOTE = "1枚で、限定台くじを1回引ける";

/**
 * 行き先の行動を終えた後に呼ぶ（第5章の日常ループの afterSpot）。帳面の店なら判子を押して一言を出し、
 * 地域や帳面がそろえばくじ券を渡す。判子が増えなければ何もしない。戻り値＝記録の結果か null。
 */
export function noteShopStamp(spot, value = state) {
  const result = recordShopStamp(value, spot?.id, n => grantKujiTickets(n, "shop_stamps", value));
  if (!result || value !== state) return result;
  const first = result.count === 1 ? "。LIMEの「店めぐり帳」で見られる" : "";
  toast(`店めぐり帳に判子をもらった：${result.shop.label}（${result.count}/${result.total}）${first}`, { kind: "good", ms: 3600 });
  if (result.regionDone || result.complete) {
    const done = result.complete ? "店めぐり帳が全部そろった" : `店めぐり帳の${result.region.label}がそろった`;
    toast(result.tickets ? `${done}。Dr.fookahから、くじ券を${result.tickets}枚もらった（${KUJI_NOTE}）`
      : `${done}。くじ券は、もう持ちきれない`, { kind: "good", ms: 5200 });
  }
  return result;
}

/** LIMEのトーク一覧の一番上に出す「店めぐり帳」の行（第5章の日常ループの limeShortcuts）。 */
export function shopStampsShortcut(value = state) {
  const progress = shopStampsProgress(value);
  return {
    id: "ch5_shop_stamps", label: "店めぐり帳", icon: "印",
    sub: progress.complete ? `判子 ${progress.count}/${progress.total}・全部そろった` : `判子 ${progress.count}/${progress.total}・各地のシーシャ屋で一台ずつ`,
    tag: progress.complete ? "達成" : null, attention: !progress.opened,
    run: () => openShopStampBook(),
  };
}

/** 帳面の中身（地域ごとの店と判子）。 */
function bookBody(progress) {
  return el("div.shop-stamps", { dataset: { test: "shop-stamps" } }, [
    el("p.shop-stamps-lead", { text: "Dr.fookahがLIMEで配っている、各地のシーシャ屋の判子帳。店で一台を吸うと、判子を一つもらえる。" }),
    el("p.shop-stamps-lead", { text: `地域の判子がそろうとくじ券を${REGION_TICKETS}枚、全部そろうとさらに${COMPLETE_BONUS_TICKETS}枚。博士との勝負の日を決めるまで集められる。` }),
    el("p.shop-stamps-total", { dataset: { test: "shop-stamps-total" }, text: `判子 ${progress.count}/${progress.total}` }),
    ...progress.regions.map(entry => el(`section.shop-stamps-region${entry.complete ? ".done" : ""}`, { dataset: { test: `shop-stamps-${entry.id}` } }, [
      el("div.shop-stamps-head", [
        el("b", { text: entry.label }),
        el("span", { text: `${entry.count}/${entry.total}${entry.complete ? "・そろった" : ""}` }),
      ]),
      el("ul.shop-stamps-shops", entry.shops.map(item => el(`li${item.stamped ? ".on" : ""}`, {
        dataset: { test: `shop-stamp-${item.id}`, stamped: item.stamped ? "1" : "0" },
        "aria-label": `${item.label}（${item.stamped ? "判子あり" : "まだ"}）`,
      }, [el("i", { text: item.stamped ? "印" : "", "aria-hidden": "true" }), el("span", { text: item.label })]))),
    ])),
  ]);
}

/** LIMEの「店めぐり帳」を開く（時間は使わない）。 */
export async function openShopStampBook(value = state) {
  if (markShopStampsOpened(value) && value === state) save();
  await modal({ title: "店めぐり帳", className: "shop-stamps-modal", body: bookBody(shopStampsProgress(value)),
    options: [{ label: "閉じる", value: true, primary: true, test: "shop-stamps-close" }] });
}
