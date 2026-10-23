// Dr.fookah（問屋街の卸直営店）。フレーバー・機材の売り買いは時間を使わない。
// 2階のショールーム（凛）へ上がると1行動使う。
import { el, yen } from "../core/util.js";
import { shopText, shopProductName, groupShopFlavors } from "./shop-display.js";
import { DB, bgUrl } from "../core/data.js";
import { showScreen, setBg, toast, modal, retire } from "../core/ui.js";
import { state, save } from "../core/state.js";
import { cueTransition, refreshPlaceCue, cancelPlaceCue } from "../core/transitions.js";
import { artImg } from "../craft/art.js";
import { addMoney, addStamina } from "../core/stats.js";
import { SE, playBgm } from "../core/audio.js";
import { visitChar } from "./spots.js";
import { RIN_AWAY_DAY } from "../core/rules.js";
import { rinUnavailable as rinVisitReason } from "./spot-hours.js";
import { kujiRows, goodsSellRows } from "./kuji.js";
import { SHOP_ART } from "./shop-art.js";
import { REMAINING_SHOP_ART } from "./shop-art-remaining.js";
import { LIMITED_FLAVOR_ART } from "./shop-art-limited.js";
import { compareEquipment, flavorThermalGuide } from "../craft/temperature-model.js";

// 店頭に並ぶフレーバー（ch1）。定番＋レシピ帳のヒントで出てくる組み合わせの材料
export const SHOP_FLAVORS = [
  "mint", "double_apple", "blueberry", "strawberry", "vanilla", "pineapple", "coconut", "mango",
  "lemon", "peach", "orange", "grape", "melon", "watermelon", "banana", "cinnamon", "rose", "lychee",
];
const SHOP_EQUIP_TYPES = ["bowl", "hms", "charcoal"];
const CAT_LABEL = { cooling: "清涼", sweet: "スイート", fruit: "フルーツ", spice: "スパイス", floral: "フローラル" };
const TYPE_LABEL = { bowl: "ボウル", hms: "ヒートマネジメント", charcoal: "炭" };
export { RIN_AWAY_DAY };

// フレーバーは1箱50g（旧版 N3）。買う＝在庫+50g、大会で詰んだ分だけ減る（課題フレーバーは主催支給＝減らない）
export const FLAVOR_BOX_GRAMS = 50;
export const flavorStock = (id) => Math.max(0, state.flavorStock?.[id] || 0);
export function addFlavorStock(id, grams) {
  state.flavorStock = state.flavorStock || {};
  state.flavorStock[id] = Math.max(0, (state.flavorStock[id] || 0) + grams);
  if (grams > 0 && !state.flavors.includes(id)) state.flavors.push(id);
}
export const ownsFlavor = (id) => flavorStock(id) > 0;
/** 持っているフレーバー（店の品＋限定サンプル・もらった葉）。はじめはブロンドリーフのみ */
export function ownedFlavorIds() {
  return [...new Set([...SHOP_FLAVORS, "nightside_earlgrey", ...Object.keys(state.flavorStock || {})])]
    .filter((id) => ownsFlavor(id) && DB.flavorById[id] && (DB.flavorById[id].leaf || "blond") === "blond");
}

/** 店に並べる機材か（第1章の品揃え。贈り物などの非売品は並べない） */
export const forSale = (e) => !!e && SHOP_EQUIP_TYPES.includes(e.type) && (e.chapter_min || 1) <= 1 && !e.not_for_sale;
/** 売れる機材か（贈り物は売れない・装備中も売れない） */
export const sellable = (e) => !!e && !e.unsellable && !Object.values(state.equip || {}).includes(e.id);

/** 機材を売る。贈り物（unsellable）・装備中・未所持は、ボタンの出し分けに関係なくここで断る */
export function sellEquipment(id) {
  const e = DB.equipById[id];
  if (!e || !state.owned.includes(id) || !sellable(e)) return false;
  state.owned = state.owned.filter((x) => x !== id);
  addMoney(e.sell_price);
  return true;
}

const priceText = (n) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const FLAVOR_ART = new URL("../../img/shop/flavors.webp", import.meta.url).href;
// 生成原画1774×887の各イラストの窓。隣の葉を出さず、縦長の果実も切らない。
const FLAVOR_BOXES = [
  [24, 76, 270, 241], [322, 78, 277, 242], [609, 89, 280, 229], [891, 75, 286, 244], [1180, 83, 304, 246], [1487, 28, 270, 296],
  [10, 335, 285, 265], [311, 335, 296, 271], [607, 334, 283, 272], [893, 336, 291, 266], [1185, 337, 301, 268], [1490, 329, 275, 276],
  [19, 608, 280, 252], [310, 607, 288, 251], [607, 600, 281, 259], [889, 609, 288, 247], [1183, 606, 309, 255], [1485, 602, 281, 260],
];
const EQUIP_ART = {
  silicone_bowl: "bowl_empty_silicone.png", hagal_80beat: "bowl_empty_phunnel.png",
  suyaki_hagal: "bowl_empty_clay.png", flat_charcoal: "coal_flat_cold.png", cube_charcoal: "coal_cold.png",
};
// A real <img> error handler also covers failed/aborted delivery requests.
// Cropping retains the approved main sheet windows and the measured carton margin.
function windowArt(item, url, box, dimensions, size, kind, fallback) {
  const [x, y, w, h] = box;
  const k = Math.min(size * (kind === "generated" ? .88 : 1) / w,
                     size * (kind === "generated" ? .88 : 1) / h);
  const root = el(`span.shop-product-art.${kind}`, { "aria-hidden": "true", dataset: { productArt: item.id } });
  const image = el("img", { alt: "", decoding: "async", style: {
    position: "absolute", maxWidth: "none", width: `${dimensions[0] * k}px`, height: `${dimensions[1] * k}px`,
    left: `${-x * k}px`, top: `${-y * k}px`,
  }, onerror: () => root.replaceWith(fallback()) });
  root.append(el("span", { style: { position: "relative", display: "block", overflow: "hidden",
    width: `${w * k}px`, height: `${h * k}px`, flex: "none" } }, [image]));
  image.src = url; // Attach the error listener before starting the request.
  return root;
}
/** 制作の葉選びも、ショップで採用済みの商品パッケージを使う。未収録・配信失敗は文字へ。 */
export function flavorPackageArt(id, size = 54) {
  const item = { id };
  const fallback = () => el("span.shop-product-art", { "aria-hidden": "true", dataset: { productArt: id } }, [
    el("span.shop-type-mark", { style: { fontSize: "10px", letterSpacing: "0", whiteSpace: "nowrap" }, text: "フレーバー" }),
  ]);
  const art = SHOP_ART[id] || REMAINING_SHOP_ART[id] || LIMITED_FLAVOR_ART[id];
  return art ? windowArt(item, art.url, art.box, art.size, size, "generated", fallback) : fallback();
}
function productArt(item, flavor, size = 66) {
  const textArt = () => el("span.shop-product-art", { "aria-hidden": "true", dataset: { productArt: item.id } }, [
    el("span.shop-type-mark", { style: flavor ? { fontSize: "11px", letterSpacing: "0", whiteSpace: "nowrap" } : {}, text: flavor ? "フレーバー" : item.type === "hms" ? "HMD" : TYPE_LABEL[item.type] || "機材" }),
  ]);
  const botanical = () => windowArt(item, FLAVOR_ART, FLAVOR_BOXES[SHOP_FLAVORS.indexOf(item.id)],
    [1774, 887], size, "botanical", textArt);
  const generated = flavor && (SHOP_ART[item.id] || REMAINING_SHOP_ART[item.id]);
  if (generated) return windowArt(item, generated.url, generated.box, generated.size, size, "generated", botanical);
  if (flavor) return botanical();
  const art = EQUIP_ART[item.art || item.id];
  return art ? el("span.shop-product-art", { "aria-hidden": "true", dataset: { productArt: item.id } }, [artImg(art, 60)]) : textArt();
}
function shopHeader(sub, money) {
  return el("header.shop-head", [el("h2", { text: "Dr.fookah" }), el("span.shop-sub", { text: sub }), money]);
}
const rinUnavailable = () => rinVisitReason(state);

/** 入店前に行き先を選ぶ。買い出し・大会準備の案内では、そのまま1Fへ進む。戻り値は従来どおり。 */
export async function openShop(opts = {}) {
  if (!opts.errand) {
    const destination = await chooseShopFloor();
    if (destination !== "shop") return destination;
  }
  refreshPlaceCue("shop");
  return openCounter(opts);
}
function chooseShopFloor() {
  return new Promise((resolve) => {
    const session = state;
    let finished = false;
    const finish = (destination) => {
      if (finished || state !== session || !root.isConnected) return;
      if (destination === "rin" && rinUnavailable()) return;
      finished = true;
      // 2Fは呼び出し側の体力確認後にvisitRinで予約する。見送り時に演出を残さない。
      if (destination === "shop") refreshPlaceCue("shop"); else cancelPlaceCue("shop");
      destination ? SE.select() : SE.cancel();
      retire(root); resolve(destination);
    };
    const unavailable = rinUnavailable();
    const card = (floor, title, desc, bg, destination, disabled = false) => el(`button.shop-floor${floor === "2F" ? ".showroom" : ""}`, {
      disabled, dataset: { test: destination === "rin" ? "shop-upstairs" : "shop-enter" }, onclick: () => finish(destination),
    }, [
      el("span.shop-floor-picture", [el("img", { src: bgUrl(bg), alt: "", decoding: "async" }), el("span.shop-floor-number", { text: floor })]),
      el("span.shop-floor-caption", [el("b", { text: title }), el("small", { text: desc }), el("span.shop-floor-arrow", { text: "↗", "aria-hidden": "true" })]),
    ]);
    const root = showScreen("shop-entry", el("section.shop-paper.shop-entry", { "aria-label": "Dr.fookahの行き先" }, [
      shopHeader("卸直営店", el("div.shop-money", [el("small", { text: "所持金" }), el("span", { text: priceText(state.money) })])),
      el("h3", { text: "今日は、どちらへ？" }),
      el("div.shop-floors", [
        card("1F", "買い物", "時間消費なし", "bg_shop", "shop"),
        card("2F", "夜のショールーム", unavailable || "相談受付中・1行動消費", "bg_fookah_showroom", "rin", !!unavailable),
      ]),
      el("footer.shop-entry-foot", [el("button.shop-back", { text: "← 街に戻る", dataset: { test: "shop-entry-back" }, onclick: () => finish(null) })]),
    ]));
  });
}

/** 1階物販。数量選択だけでは支払わず、確定時に価格・在庫・経費を再確認する。 */
function openCounter({ errand = null, expense = false, minStock = 1, expenseFlag = "_errand_mint_expensed" } = {}) {
  return new Promise((resolve) => {
    const session = state;
    let finished = false, confirming = false, tab = "flavor", category = "all";
    const cart = new Map();
    const firstErrand = errand === "mint" && expense && expenseFlag === "_errand_mint_expensed" && !session.flags._errand_shop_done;
    setBg(bgUrl("bg_shop"), { fast: true, ready: [FLAVOR_ART, ...Object.values(SHOP_ART).map(art => art.url)] });
    playBgm("kansetsu_shomei_to_black_coffee");
    const body = el("div.shop-body", { tabindex: "0", "aria-label": "商品一覧" });
    const tabs = el("div.shop-tabs", { "aria-label": "売り場" });
    const filters = el("div.shop-filters", { "aria-label": "フレーバーの種類" });
    const money = el("div.shop-money");
    const summary = el("button.shop-summary", { dataset: { test: "shop-summary" }, onclick: () => showOrder() });
    const checkout = el("button.shop-checkout", { dataset: { test: "shop-checkout" }, onclick: () => purchase() });
    const errandName = errand ? shopProductName(DB.flavorById[errand] || {}) : "";
    const errandBox = errand ? el("div.shop-errand", { role: "status" }) : null;
    const live = () => !finished && state === session && root.isConnected;
    const onExpense = (id) => expense && errand === id && flavorStock(id) < minStock && !state.flags[expenseFlag];
    let refusedAt = -Infinity;
    const refuseOtherPurchase = () => {
      const now = performance.now();
      if (now - refusedAt < 2600) return; // 連打でも案内を同じ注意で埋めない。
      refusedAt = now;
      SE.error();
      toast("スミ「今日は頼んだミントだけだ。ほかの買い物は、買い出しが終わってからにしろ」", { kind: "warn" });
    };
    const pointTo = (button, active) => {
      if (firstErrand) {
        button.dataset.errandTarget = String(active);
        button.style.outline = active ? "3px solid #84569d" : "";
        button.style.outlineOffset = active ? "2px" : "";
      }
      return button;
    };
    const lookup = (id) => SHOP_FLAVORS.includes(id) ? { item: DB.flavorById[id], flavor: true } : { item: DB.equipById[id], flavor: false };
    const order = () => {
      const rows = [];
      for (const [id, quantity] of cart) {
        const { item, flavor } = lookup(id);
        if (!item || !Number.isInteger(quantity) || quantity < 1 || quantity > (flavor ? 99 : 1)
          || !flavor && (!forSale(item) || state.owned.includes(id))) { cart.delete(id); continue; }
        const free = flavor && onExpense(id);
        rows.push({ item, flavor, quantity, free, cost: (flavor ? item.price : item.buy_price) * (quantity - (free ? 1 : 0)) });
      }
      return rows;
    };
    const change = (id, delta) => {
      if (!live()) return;
      if (firstErrand && delta > 0 && id !== "mint") { refuseOtherPurchase(); return; }
      const { item, flavor } = lookup(id);
      if (!item || !flavor && (!forSale(item) || state.owned.includes(id))) return;
      const n = Math.max(0, Math.min(flavor ? 99 : 1, (cart.get(id) || 0) + delta));
      if (n) cart.set(id, n); else cart.delete(id);
      SE.click(); render(`${delta < 0 && n ? "minus" : "buy"}-${id}`);
    };
    const quantityPicker = (item, flavor) => {
      const n = cart.get(item.id) || 0, name = shopProductName(item);
      return el("div.shop-quantity", [
        el("button.shop-step", { text: "−", disabled: !n, "aria-label": `${name}を1つ減らす`, dataset: { test: `minus-${item.id}` }, onclick: () => change(item.id, -1) }),
        el("output", { text: n, "aria-label": `${name}の購入数`, dataset: { test: `quantity-${item.id}` } }),
        pointTo(el("button.shop-step.plus", { text: "＋", disabled: n >= (flavor ? 99 : 1), "aria-label": `${name}を1つ追加`, dataset: { test: `buy-${item.id}` }, onclick: () => change(item.id, 1) }),
          item.id === "mint" && !n && flavorStock("mint") < minStock),
      ]);
    };
    const detail = (item, flavor) => {
      if (!live()) return;
      const current = !flavor && DB.equipById[state.equip[item.type]];
      const cmp = !flavor ? compareEquipment(item.id, current?.id) : null;
      const fGuide = flavor ? flavorThermalGuide(item) : null;
      modal({ title: shopProductName(item), className: "shop-dialog", body: el("div.shop-detail", [
        productArt(item, flavor, 112), el("span.shop-detail-category", { text: flavor ? CAT_LABEL[item.category] : TYPE_LABEL[item.type] }),
        el("p", { text: flavor ? shopText(item.description) : item.description }),
        el("p", { text: flavor ? `所持 ${flavorStock(item.id)}g ／ 1箱 ${FLAVOR_BOX_GRAMS}g・${yen(item.price)}` : `${yen(item.buy_price)}${item.capacity ? ` ／ 容量 ${item.capacity}g` : ""}` }),
        current ? el("p.shop-current", { text: `装備中：${current.name}${current.capacity ? `（${current.capacity}g）` : ""}` }) : null,
        cmp ? el("small.shop-compare", {
          dataset: { test: "shop-equip-compare" },
          style: { display: "block", fontSize: "11px", lineHeight: "1.35", opacity: "0.92" },
          text: cmp.rows.map((r) => `${r.label}：${r.value}`).join(" ／ "),
        }) : null,
        fGuide ? el("small.shop-flavor-guide", {
          dataset: { test: "shop-flavor-guide" },
          style: { display: "block", fontSize: "11px", lineHeight: "1.35", opacity: "0.92" },
          text: `${shopText(fGuide.makerLabel)}（適温帯幅 ${fGuide.widthLabel}） ／ ${fGuide.tempBandLabel}`,
        }) : null,
      ]), options: [{ label: "一覧に戻る", value: null, primary: true, test: "shop-detail-close" }] });
    };
    const productRow = (item, flavor) => {
      const owned = !flavor && state.owned.includes(item.id), selected = cart.has(item.id);
      const needed = flavor && errand === item.id && flavorStock(item.id) < minStock;
      const name = `${shopProductName(item)}${flavor ? ` 1箱（${FLAVOR_BOX_GRAMS}g）` : ""}`;
      return el(`div.shop-row.product${selected ? ".selected" : ""}${needed ? ".errand" : ""}`, [
        el("button.shop-product", { dataset: { test: `detail-${item.id}` }, "aria-label": `${name}の詳細`, onclick: () => detail(item, flavor) }, [
          productArt(item, flavor), el("span.shop-main", [el("b", { text: name })]),
        ]),
        el("span.shop-stock", flavor ? [el("small", { text: "所持" }), el("span", { text: `${flavorStock(item.id)}g` })] : [el("small", { text: item.type === "hms" ? "HMD" : TYPE_LABEL[item.type] })]),
        el(`span.shop-price${flavor && onExpense(item.id) ? ".expense" : ""}`, { text: flavor && onExpense(item.id) ? "経費・1箱無料" : priceText(flavor ? item.price : item.buy_price) }),
        owned ? el("span.shop-owned", { text: Object.values(state.equip).includes(item.id) ? "装備中" : "所持済み" }) : quantityPicker(item, flavor),
      ]);
    };
    const sellRows = () => {
      const rows = state.owned.map((id) => DB.equipById[id]).filter((e) => e && !Object.values(state.equip).includes(e.id)).map((e) =>
        el("div.shop-row", [productArt(e, false),
          el("div.shop-main", [el("b", { text: e.name }), el("small", { text: e.unsellable ? "贈り物なので売れない" : "中古買い取り" })]),
          e.unsellable ? el("span.shop-owned", { text: "売却不可", dataset: { test: `sell-locked-${e.id}` } }) : el("button.btn.small", {
            text: `${yen(e.sell_price)}で売る`, dataset: { test: `sell-${e.id}` }, onclick: async () => {
              if (!live() || confirming) return;
              confirming = true;
              const ok = await modal({ title: "売却", className: "shop-dialog", body: `${e.name}を${yen(e.sell_price)}で売りますか？`, options: [
                { label: "やめる", value: false }, { label: "売る", value: true, primary: true, test: "shop-sell-confirm" },
              ] });
              confirming = false;
              if (!live() || !ok) return;
              if (sellEquipment(e.id)) { save(); SE.money(); }
              else { SE.error(); toast("これは売れない", { kind: "warn" }); }
              render();
            },
          }),
        ]));
      rows.push(...goodsSellRows(() => { if (live()) { save(); render(); } }));
      return rows.length ? rows : [el("p.shop-empty", { text: "売れる物がありません（装備中の機材は売れません）" })];
    };
    function render(focusTest = null) {
      if (finished || state !== session) return;
      const scroll = body.scrollTop, rows = order(), count = rows.reduce((n, r) => n + r.quantity, 0), total = rows.reduce((n, r) => n + r.cost, 0);
      money.replaceChildren(el("small", { text: "所持金" }), el("span", { text: priceText(state.money) }));
      if (errandBox) {
        const done = flavorStock(errand) >= minStock;
        errandBox.classList.toggle("done", done);
        errandBox.textContent = done ? `✓ ${errandName}を仕入れた。店を出て戻ろう` : `${errandName}を1箱選んで、下のボタンで購入${onExpense(errand) ? "（1箱は店の経費）" : ""}`;
        if (firstErrand) {
          const step = done ? "leave" : count ? "purchase" : tab !== "flavor" ? "return-tab"
            : category !== "all" && category !== DB.flavorById.mint.category ? "return-filter" : "select";
          errandBox.dataset.guideStep = step;
          errandBox.textContent = {
            select: `① ミントの「＋」を押す → ② 下の「購入する」${onExpense(errand) ? "（1箱は店の経費）" : ""}`,
            purchase: "② ↓ 下の「購入する」を押して、ミントの仕入れを確定しよう",
            leave: "③ ←「店を出る」を押して、スミさんのところへ戻ろう",
            "return-tab": "①「フレーバー」に戻り、ミントを選ぼう。今日はミントだけ仕入れる",
            "return-filter": "①「すべて」か「清涼」に戻り、ミントの「＋」を押そう",
          }[step];
        }
      }
      tabs.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b.dataset.tab === tab); b.setAttribute("aria-pressed", String(b.dataset.tab === tab));
        pointTo(b, errandBox?.dataset.guideStep === "return-tab" && b.dataset.tab === "flavor"); });
      filters.hidden = tab !== "flavor";
      filters.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b.dataset.category === category); b.setAttribute("aria-pressed", String(b.dataset.category === category));
        pointTo(b, errandBox?.dataset.guideStep === "return-filter" && b.dataset.category === "all"); });
      body.replaceChildren(...(tab === "flavor" ? groupShopFlavors(SHOP_FLAVORS.map((id) => DB.flavorById[id]).filter((f) => f && (category === "all" || category === f.category))).map((f) => productRow(f, true))
        : tab === "equip" ? DB.equipment.filter(forSale).map((e) => productRow(e, false)) : tab === "kuji" ? kujiRows(() => { if (live()) render(); }) : sellRows()));
      body.scrollTop = scroll;
      summary.replaceChildren(el("small", { text: "合計" }), el("strong", { text: priceText(total) }), el("span", { text: state.money >= total ? `購入後 ${priceText(state.money - total)}` : `あと ${priceText(total - state.money)}` }));
      summary.disabled = !count;
      summary.setAttribute("aria-label", `選択した${count}点の内容を確認。合計${yen(total)}`);
      checkout.disabled = !count || total > state.money;
      summary.hidden = checkout.hidden = !count && (tab === "kuji" || tab === "sell");
      checkout.textContent = count ? `${count}${rows.every((r) => r.flavor) ? "箱" : "点"}を購入する →` : "商品を選んでください";
      pointTo(checkout, errandBox?.dataset.guideStep === "purchase" && !checkout.disabled);
      pointTo(leaveButton, errandBox?.dataset.guideStep === "leave");
      if (focusTest) {
        const button = body.querySelector(`[data-test="${focusTest}"]`);
        if (button && !button.disabled) button.focus({ preventScroll: true });
      }
    }
    function purchase() {
      if (!live() || confirming) return;
      const rows = order(), total = rows.reduce((n, r) => n + r.cost, 0);
      if (!rows.length) return;
      if (firstErrand && rows.some(r => !r.flavor || r.item.id !== "mint")) { refuseOtherPurchase(); return; }
      if (state.money < total) { SE.error(); toast("お金が足りない", { kind: "warn" }); render(); return; }
      // 非同期処理を挟まず、支払いと全商品の反映を終えてから一度保存する。
      addMoney(-total);
      for (const { item, flavor, quantity, free } of rows) {
        if (flavor) { addFlavorStock(item.id, quantity * FLAVOR_BOX_GRAMS); if (free) state.flags[expenseFlag] = true; }
        else state.owned.push(item.id);
      }
      cart.clear(); save(); SE.money(); toast("仕入れが完了しました", { kind: "good" }); render();
    }
    async function showOrder() {
      if (!live() || confirming) return;
      const rows = order(); if (!rows.length) return;
      confirming = true;
      const clear = await modal({ title: "選択した商品", className: "shop-dialog", body: el("div.shop-order", rows.map((r) => el("p", [
        el("span", { text: `${shopProductName(r.item)} × ${r.quantity}` }), el("b", { text: priceText(r.cost) }),
      ]))), options: [{ label: "選択をクリア", value: true, test: "shop-clear" }, { label: "一覧に戻る", value: false, primary: true }] });
      confirming = false;
      if (!live()) return;
      if (clear) cart.clear(); render();
    }
    const leave = async () => {
      if (!live() || confirming) return;
      if (errand && flavorStock(errand) < minStock) {
        SE.error(); tab = "flavor"; category = "all"; render();
        body.querySelector(".errand")?.scrollIntoView({ block: "nearest" });
        toast(`スミ「おい、${errandName}を仕入れてから戻ってこい」`, { kind: "warn" }); return;
      }
      if (order().length) {
        confirming = true;
        const ok = await modal({ title: "買い物を終える", className: "shop-dialog", body: "選択した商品は、まだ購入していません。選択を取り消して店を出ますか？", options: [
          { label: "買い物に戻る", value: false }, { label: "店を出る", value: true, primary: true, test: "shop-discard-leave" },
        ] });
        confirming = false;
        if (!ok || !live()) return;
      }
      finished = true; SE.cancel(); retire(root); resolve(null);
    };
    for (const [id, label] of [["flavor", "フレーバー"], ["equip", "機材"], ["kuji", "シーシャくじ"], ["sell", "売却"]]) {
      tabs.append(el("button.shop-tab", { text: label, dataset: { tab: id }, onclick: () => { if (!live()) return; tab = id; body.scrollTop = 0; SE.click(); render(); } }));
    }
    for (const [id, label] of [["all", "すべて"], ["cooling", "清涼"], ["fruit", "フルーツ"], ["sweet", "スイート"], ["spice", "スパイス"], ["floral", "フローラル"]]) {
      filters.append(el("button.shop-filter", { text: label, dataset: { category: id }, onclick: () => { if (!live()) return; category = id; body.scrollTop = 0; SE.click(); render(); } }));
    }
    filters.append(el("span", { text: `1箱 ${FLAVOR_BOX_GRAMS}g` }));
    const leaveButton = el("button.shop-back", { text: "← 店を出る", dataset: { test: "shop-leave" }, onclick: leave });
    const root = showScreen("shop", el("section.shop.shop-paper", { "aria-label": "Dr.fookah ショップ" }, [
      shopHeader("1F ショップ", money), errandBox, tabs, filters, body,
      el("footer.shop-foot", [leaveButton, summary, checkout]),
    ]));
    // 過去の画面のイベントが、新しくロードしたセーブや閉店後の状態へ届かないようにする。
    root.addEventListener("click", (event) => {
      if (!live()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      // くじの表示・既存担当のdraw処理はそのまま、初回だけ購入入力を手前で断る。
      if (firstErrand && event.target.closest?.(".kuji-row button")) {
        event.preventDefault(); event.stopImmediatePropagation(); refuseOtherPurchase();
      }
    }, true);
    render();
  });
}

export async function visitRin() {
  if (state.phase !== "daily" || rinUnavailable()) return false;
  cueTransition("place", { spotId: "shop", label: "Dr.fookah", area: "問屋街" });
  addStamina(-14);
  state.visitedDay.rin = state.day;
  await visitChar("rin");
  // 3回目で限定フレーバー（NIGHTSIDE アールグレイ試作）を分けてもらえる
  if ((state.story.rin || 0) >= 3 && !state.flags._rin_sample) {
    state.flags._rin_sample = true;
    addFlavorStock("nightside_earlgrey", FLAVOR_BOX_GRAMS);
    toast("限定フレーバー「NS アールグレイ（試作）」を手に入れた", { kind: "good" });
  }
  return true;
}
