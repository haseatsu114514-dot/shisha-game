// Dr.fookah（問屋街の卸直営店）。フレーバー・機材の売り買いは時間を使わない。
// 2階のショールーム（凛）へ上がると1行動使う。
import { el, yen } from "../core/util.js";
import { DB, bgUrl } from "../core/data.js";
import { showScreen, setBg, toast, modal, retire } from "../core/ui.js";
import { state } from "../core/state.js";
import { addMoney, addStamina } from "../core/stats.js";
import { SE, playBgm } from "../core/audio.js";
import { visitChar } from "./spots.js";
import { kujiRows, goodsSellRows } from "./kuji.js";

// 店頭に並ぶフレーバー（ch1）。定番＋レシピ帳のヒントで出てくる組み合わせの材料
export const SHOP_FLAVORS = [
  "mint", "double_apple", "blueberry", "strawberry", "vanilla", "pineapple", "coconut", "mango",
  "lemon", "peach", "orange", "grape", "melon", "watermelon", "banana", "cinnamon", "rose", "lychee",
];
const SHOP_EQUIP_TYPES = ["bowl", "hms", "charcoal"];
const CAT_LABEL = { cooling: "清涼", sweet: "スイート", fruit: "フルーツ", spice: "スパイス", floral: "フローラル" };
const TYPE_LABEL = { bowl: "ボウル", hms: "ヒートマネジメント", charcoal: "炭" };
export const RIN_AWAY_DAY = 2; // day % 7 === 2 は凛が出張で不在

export const ownsFlavor = (id) => (state.flavors || []).includes(id) || (id === "nightside_earlgrey" && state.flags._rin_sample);

/** 店に入る。戻り値: "rin"（2階へ＝行動を使う）/ null（買い物だけで出る） */
/**
 * Dr.fookah（1階物販）。戻り値: "rin"（2階へ）/ null（店を出た）
 * @param opts.errand 1日目の案内: このフレーバーを買うまで店を出られない（スミさんの頼み）
 */
export function openShop({ errand = null } = {}) {
  return new Promise((resolve) => {
    setBg(bgUrl("bg_shop"));
    playBgm("daily_part");
    let tab = "flavor";
    const body = el("div.shop-body");
    const tabs = el("div.shop-tabs");
    const money = el("div.shop-money");

    const errandFlavor = errand ? DB.flavorById[errand] : null;
    const errandName = errandFlavor ? errandFlavor.short_name || errandFlavor.name : "";
    const errandBox = errand ? el("div.shop-errand") : null;
    const render = () => {
      money.textContent = `所持金 ${yen(state.money)}`;
      if (errandBox) {
        const done = ownsFlavor(errand);
        errandBox.classList.toggle("done", done);
        errandBox.textContent = done ? `✓ ${errandName}を仕入れた。店を出てスミさんに報告しよう` : `スミさんの頼み：${errandName}を仕入れる`;
      }
      tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
      body.replaceChildren(...(tab === "flavor" ? flavorRows() : tab === "equip" ? equipRows() : tab === "kuji" ? kujiRows(render) : sellRows()));
    };

    const buy = async (label, price, apply) => {
      if (state.money < price) { SE.error(); toast("お金が足りない", { kind: "warn" }); return; }
      addMoney(-price);
      apply();
      SE.money();
      toast(`${label} を買った`, { kind: "good" });
      render();
    };

    const flavorRows = () => SHOP_FLAVORS.map((id) => DB.flavorById[id]).filter(Boolean).map((f) => {
      const owned = ownsFlavor(f.id);
      return el(`div.shop-row${errand === f.id && !owned ? ".errand" : ""}`, [
        el("span.shop-cat", { text: CAT_LABEL[f.category] || "", dataset: { cat: f.category } }),
        el("div.shop-main", [el("b", { text: f.short_name || f.name }), el("small", { text: f.description })]),
        owned
          ? el("span.shop-owned", { text: "在庫あり" })
          : el("button.btn.small", { text: yen(f.price), dataset: { test: `buy-${f.id}` }, onclick: () => buy(f.short_name || f.name, f.price, () => state.flavors.push(f.id)) }),
      ]);
    });

    const equipRows = () => DB.equipment.filter((e) => SHOP_EQUIP_TYPES.includes(e.type) && (e.chapter_min || 1) <= 1).map((e) => {
      const owned = state.owned.includes(e.id);
      return el("div.shop-row", [
        el("span.shop-cat", { text: TYPE_LABEL[e.type] }),
        el("div.shop-main", [el("b", { text: e.name }), el("small", { text: e.description })]),
        owned
          ? el("span.shop-owned", { text: "所持" })
          : el("button.btn.small", { text: yen(e.buy_price), dataset: { test: `buy-${e.id}` }, onclick: () => buy(e.name, e.buy_price, () => state.owned.push(e.id)) }),
      ]);
    });

    // 売れるのは機材とくじの小物だけ（フレーバーは開封済み扱いで中古に流せない）。装備中の機材は売れない
    const sellRows = () => {
      const rows = state.owned.map((id) => DB.equipById[id]).filter((e) => e && !Object.values(state.equip).includes(e.id)).map((e) =>
        el("div.shop-row", [
          el("span.shop-cat", { text: TYPE_LABEL[e.type] || "" }),
          el("div.shop-main", [el("b", { text: e.name }), el("small", { text: "中古買い取り" })]),
          el("button.btn.small", {
            text: `${yen(e.sell_price)}で売る`,
            onclick: async () => {
              const ok = await modal({ title: "売却", body: `${e.name} を ${yen(e.sell_price)} で売りますか？`, options: [{ label: "やめる", value: false }, { label: "売る", value: true, primary: true }] });
              if (!ok) return;
              state.owned = state.owned.filter((x) => x !== e.id);
              addMoney(e.sell_price);
              render();
            },
          }),
        ]));
      rows.push(...goodsSellRows(render));
      return rows.length ? rows : [el("p.shop-empty", { text: "売れる物がない（装備中の機材は売れない）" })];
    };

    const rinAway = state.day % 7 === RIN_AWAY_DAY;
    const upstairs = el("button.btn.primary", {
      disabled: errand || rinAway || state.visitedDay.rin === state.day || null,
      dataset: { test: "shop-upstairs" },
      onclick: () => { SE.select(); retire(root); resolve("rin"); },
    }, [
      el("span.btn-label", { text: "2階のショールームへ" }),
      el("small.btn-desc", { text: errand ? "今は仕入れの途中" : rinAway ? "今日は担当者が出張中らしい" : state.met.rin ? "凛に会う（1行動使う）" : "上の階に誰かいる……？（1行動使う）" }),
    ]);

    for (const [id, label] of [["flavor", "フレーバー"], ["equip", "機材"], ["kuji", "シーシャくじ"], ["sell", "売る"]]) {
      tabs.append(el("button.shop-tab", { text: label, dataset: { tab: id }, onclick: () => { tab = id; SE.click(); render(); } }));
    }
    const root = showScreen("shop", el("div.shop.panel", [
      el("div.shop-head", [el("h2", { text: "Dr.fookah" }), el("span.shop-sub", { text: "卸直営・1階物販" }), money]),
      errandBox,
      tabs,
      body,
      el("div.shop-foot", [
        upstairs,
        el("button.btn.ghost", {
          text: "店を出る",
          dataset: { test: "shop-leave" },
          onclick: () => {
            // 買い出し中は、頼まれた物を仕入れるまで出られない（詰みにはしない軽い押し戻し）
            if (errand && !ownsFlavor(errand)) {
              SE.error();
              tab = "flavor";
              render();
              toast(`スミ「おい、${errandName}を仕入れてから戻ってこい」`, { kind: "warn" });
              return;
            }
            SE.cancel(); retire(root); resolve(null);
          },
        }),
      ]),
    ]));
    render();
  });
}

export async function visitRin() {
  addStamina(-14);
  state.visitedDay.rin = state.day;
  await visitChar("rin");
  // 3回目で限定フレーバー（NIGHTSIDE アールグレイ試作）を分けてもらえる
  if ((state.story.rin || 0) >= 3 && !state.flags._rin_sample) {
    state.flags._rin_sample = true;
    toast("限定フレーバー「NS アールグレイ（試作）」を手に入れた", { kind: "good" });
  }
}
