// 縦画面C案「煙の舞台」: Dr.fookah の 1F ショップ（仕入れ）を縦へ移した試作（要望台帳 VPS01）。
// 本編の 1F 物販（remake/js/daily/shop.js の openCounter）の流れをそのまま縦にした:
//   売り場（フレーバー・機材・シーシャくじ・売却）→ 種類で絞る → 「＋」でかごへ（押すだけでは払わない）→ 下の「購入する」で払う → 店を出る。
// 品ぞろえ・値段・説明は正本の data/flavors.json・equipment.json をそのまま読み、商品の絵は本編のショップと同じ採用済みの絵（shop-data.mjs）。
// 縦の並べ方（十字キーと丸ボタンは置かない）: 上＝店内の写真と凛想のひとこと（本編の店頭の応対 ch1_shop_rio_return）、
//   真ん中＝売り場の札と種類の札、下＝商品の札（2列。指でスクロール）、いちばん下（親指の届く所）＝かごの合計と「購入する」。
//   商品の札を押すと、下から説明の札がせり上がる（本編の説明のダイアログ）。「シーシャくじ」の売り場から、くじの棚（kuji.mjs）へ進む。
// お金と持ち物は試作だけの財布（shop-data.mjs の WALLET）。本編の所持金・在庫・保存には触れない。音は鳴らさない。
import { storeLogoUrl } from "../../js/core/store-logos.js";
import {
  WALLET, SHOP_FLAVORS, FLAVOR_BOX_GRAMS, CAT_LABEL, TYPE_LABEL, yen, addStock, loadShopData, forSale, productArtHtml,
  shopText, shopProductName, groupShopFlavors, flavorTags,
} from "./shop-data.mjs";
import { kujiBox, kujiGrade, RANK_NAME, kujiLeft, prizeArtHtml } from "./kuji.mjs";

const DIALOGUE_URL = new URL("../../../data/dialogue/ch1_rio.json", import.meta.url).href;
let greetPromise = null;
/** 店頭の応対の一言（正本 data/dialogue/ch1_rio.json の ch1_shop_rio_return）。読めなければ出さない */
const loadGreeting = () => (greetPromise ||= fetch(DIALOGUE_URL).then((res) => res.ok ? res.json() : null)
  .then((data) => data?.dialogues?.find((d) => d.dialogue_id === "ch1_shop_rio_return")?.lines?.[0]?.text || "").catch(() => ""));

const TABS = [["flavor", "フレーバー"], ["equip", "機材"], ["kuji", "シーシャくじ"], ["sell", "売却"]];
const CATS = [["all", "すべて"], ...Object.entries(CAT_LABEL)];
// 葉の熱の目安（remake/js/craft/flavor-profile.js の flavorFeatures の heatNote の写し）
const heatNote = (f) => { const t = Number.isFinite(f?.heat_tolerance) && f.heat_tolerance > 0 ? f.heat_tolerance : 1; return t >= 1.15 ? "熱はしっかりめが目安" : t <= 0.88 ? "控えめな熱から合わせる" : "標準の熱から合わせる"; };
const LOGO = { sheet: [2048, 768], frame: [1337, 281, 662, 260] }; // remake/js/core/store-logos.js の shop の切り抜き

const ICONS = {
  spOut: '<path d="M14 5H6.500A1.500 1.500 0 0 0 5 6.500v11A1.500 1.500 0 0 0 6.500 19H14"/><path d="M11 12h9M16.500 8.500 20 12l-3.500 3.500"/>',
  spBag: '<path d="M5.500 8.500h13l-1 11h-11z"/><path d="M9 8.500V7a3 3 0 0 1 6 0v1.500"/>',
  spPlus: '<path d="M12 5v14M5 12h14"/>',
  spMinus: '<path d="M5 12h14"/>',
  spX: '<path d="M6.500 6.500l11 11M17.500 6.500l-11 11"/>',
  spBall: '<circle cx="12" cy="12" r="7.500"/><path d="M4.500 12h15"/>',
};

export class ShopScene {
  /** 場面の名札（app.mjs が読む） */
  static META = {
    id: "shop", label: "仕入れ", acc: "#c6a6f0",
    options: { name: "tab", label: "売り場", default: "flavor", values: Object.fromEntries(TABS.map(([id, name]) => [id, name === "シーシャくじ" ? "くじ" : name])) },
    gallery: {
      title: "ショップ（Dr.fookah 1F・仕入れ）",
      note: "本編の 1F ショップを縦へ。品ぞろえ・値段・説明は本編のデータ（data/flavors.json・equipment.json）、商品の絵は本編と同じ採用済みのパッケージ。上に店内と凛想のひとこと、真ん中に売り場と種類の札、下に2列の商品の札、いちばん下に合計と「購入する」。「＋」はかごに入れるだけで、払うのは「購入する」（本編と同じ）。商品の札を押すと説明の札がせり上がる。お金と持ち物は試作だけの財布で、本編の保存には触れない。",
      shots: [
        { caption: "フレーバーの売り場" },
        { caption: "かごに入れた所（合計と購入後）", cart: "grape:1,peach:2" },
        { caption: "商品の説明（下からせり上がる）", detail: "grape", cart: "grape:1" },
        { caption: "機材の売り場", tab: "equip" },
        { caption: "シーシャくじの売り場", tab: "kuji" },
      ],
    },
  };

  /** @param opts tab＝最初の売り場、cat＝種類、cart＝かご（"mint:1,grape:2"）、detail＝最初に開く説明の品 */
  constructor(phone, kit, opts = {}) {
    Object.assign(this, { phone, kit, el: phone.el, opts: { ...opts } });
    Object.assign(kit.ICONS, ICONS);
    this.tab = TABS.some(([id]) => id === opts.tab) ? opts.tab : "flavor";
    this.cat = CATS.some(([id]) => id === opts.cat) ? opts.cat : "all";
    this.cart = new Map(String(opts.cart || "").split(",").map((pair) => pair.split(":")).filter(([id, n]) => id && Number(n) > 0).map(([id, n]) => [id, Number(n)]));
    this.sheet = null; // 開いている札（{ kind: "detail" | "order" | "leave" | "sell", id }）
    this.data = null;
    this.timers = new Set();
    if (!phone.fixed) { phone.extOpts.detail = null; phone.extOpts.cart = null; } // 途中から開くのは一度だけ
  }

  /* ── 骨組み ── */

  html() {
    const { REMAKE_IMG, icon } = this.kit;
    const [x, y, w, h] = LOGO.frame;
    return `
      <div class="sp-app">
        <section class="sp-top">
          <img class="sp-photo" src="${REMAKE_IMG}backgrounds/bg_shop.webp" alt="">
          <img class="sp-clerk" src="${REMAKE_IMG}sprites/character_variants/new/rio/chr_rio_normal.webp" alt="">
          <header class="sp-head">
            <span class="sp-logo" role="img" aria-label="Dr.fookah"><i class="sp-logo-win"><img src="${storeLogoUrl("shop")}" alt="" style="width:${LOGO.sheet[0] / w * 100}%;height:${LOGO.sheet[1] / h * 100}%;left:${-x / w * 100}%;top:${-y / h * 100}%" onerror="this.closest('.sp-logo').classList.add('missing')"></i><b>Dr.fookah</b></span>
            <span class="sp-floor">1F ショップ</span>
            <span class="sp-money"><small>所持金</small><b data-slot="money"></b></span>
          </header>
          <p class="sp-greet" data-slot="greet" hidden><b>凛想</b><span></span></p>
        </section>
        <nav class="sp-tabs" aria-label="売り場">${TABS.map(([id, name]) => `<button data-sp="tab" data-tab="${id}" aria-pressed="false">${name}</button>`).join("")}</nav>
        <nav class="sp-cats" data-slot="cats" aria-label="フレーバーの種類">${CATS.map(([id, name]) => `<button data-sp="cat" data-cat="${id}" aria-pressed="false">${name}</button>`).join("")}</nav>
        <div class="sp-list" data-slot="list" aria-label="商品一覧"><p class="sp-empty">…</p></div>
        <footer class="sp-foot">
          <button class="sp-leave" data-sp="leave" aria-label="店を出る">${icon("spOut")}<span>店を出る</span></button>
          <button class="sp-sum" data-sp="order" data-slot="sum" aria-label="かごの中身"></button>
          <button class="sp-buy" data-sp="buy" data-slot="buy"></button>
        </footer>
        <div class="sp-scrim" data-sp="close" data-slot="scrim" hidden></div>
        <section class="sp-sheet" data-slot="sheet" aria-modal="true" role="dialog" hidden></section>
        <p class="sp-toast" data-slot="toast" role="status" hidden></p>
      </div>`;
  }

  mount() {
    const q = (sel) => this.el.querySelector(sel);
    this.refs = Object.fromEntries(["money", "greet", "cats", "list", "sum", "buy", "scrim", "sheet", "toast"].map((k) => [k, q(`[data-slot="${k}"]`)]));
    loadGreeting().then((text) => {
      if (this.dead || !text) return;
      this.refs.greet.querySelector("span").textContent = text;
      this.refs.greet.hidden = false;
    });
    loadShopData().then((data) => {
      if (this.dead) return;
      this.data = data;
      this.render();
      if (this.opts.detail && this.lookup(this.opts.detail).item) this.openSheet({ kind: "detail", id: this.opts.detail });
    }).catch((error) => {
      if (this.dead) return;
      console.warn("ショップのデータを読めませんでした:", error);
      this.refs.list.innerHTML = `<p class="sp-empty">商品を読み込めませんでした</p>`;
    });
    this.syncFoot();
  }

  destroy() {
    this.dead = true;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }

  later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id); }

  /* ── 品と、かご（本編 openCounter の order・change と同じ形） ── */

  lookup(id) {
    const d = this.data;
    if (!d) return {};
    if (SHOP_FLAVORS.includes(id) && d.flavorById[id]) return { item: d.flavorById[id], flavor: true };
    return { item: d.equipById[id], flavor: false };
  }

  order() {
    const rows = [];
    for (const [id, quantity] of this.cart) {
      const { item, flavor } = this.lookup(id);
      if (!item || quantity < 1 || quantity > (flavor ? 99 : 1) || (!flavor && (!forSale(item) || WALLET.owned.includes(id)))) { this.cart.delete(id); continue; }
      rows.push({ item, flavor, quantity, cost: (flavor ? item.price : item.buy_price) * quantity });
    }
    return rows;
  }

  change(id, delta) {
    const { item, flavor } = this.lookup(id);
    if (!item || (!flavor && (!forSale(item) || WALLET.owned.includes(id)))) return;
    const n = Math.max(0, Math.min(flavor ? 99 : 1, (this.cart.get(id) || 0) + delta));
    if (n) this.cart.set(id, n); else this.cart.delete(id);
    this.refreshCard(id);
    if (this.sheet?.kind === "detail" && this.sheet.id === id) this.openSheet(this.sheet);
    this.syncFoot();
  }

  purchase() {
    const rows = this.order(), total = rows.reduce((n, r) => n + r.cost, 0);
    if (!rows.length) return;
    if (total > WALLET.money) { this.toast("お金が足りない"); this.syncFoot(); return; }
    WALLET.money -= total;
    for (const { item, flavor, quantity } of rows) {
      if (flavor) addStock(item.id, quantity * FLAVOR_BOX_GRAMS);
      else WALLET.owned.push(item.id);
    }
    this.cart.clear();
    this.closeSheet();
    this.render();
    this.toast("仕入れが完了しました");
    this.el.querySelector(".sp-money")?.classList.remove("paid");
    void this.el.querySelector(".sp-money")?.offsetWidth;
    this.el.querySelector(".sp-money")?.classList.add("paid");
  }

  /* ── 描画 ── */

  render() {
    const { list } = this.refs;
    this.el.dataset.spTab = this.tab;
    this.el.querySelectorAll('[data-sp="tab"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === this.tab)));
    this.el.querySelectorAll('[data-sp="cat"]').forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cat === this.cat)));
    this.refs.cats.hidden = this.tab !== "flavor";
    if (!this.data) return;
    const top = list.scrollTop;
    if (this.tab === "flavor") {
      const items = groupShopFlavors(SHOP_FLAVORS.map((id) => this.data.flavorById[id]).filter((f) => f && (f.chapter_min || 1) <= 1 && (this.cat === "all" || f.category === this.cat)));
      list.innerHTML = `<div class="sp-grid">${items.map((f) => this.cardHtml(f, true)).join("")}</div>`;
    } else if (this.tab === "equip") {
      const items = this.data.equipment.filter((e) => forSale(e));
      list.innerHTML = `<div class="sp-grid">${items.map((e) => this.cardHtml(e, false)).join("")}</div>`;
    } else if (this.tab === "kuji") list.innerHTML = this.kujiHtml();
    else list.innerHTML = this.sellHtml();
    list.scrollTop = this.tab === this.shownTab ? top : 0;
    this.shownTab = this.tab;
    this.syncFoot();
  }

  cardHtml(item, flavor) {
    const { icon, esc } = this.kit;
    const owned = !flavor && WALLET.owned.includes(item.id), n = this.cart.get(item.id) || 0;
    const name = shopProductName(item);
    const tags = flavor ? flavorTags(item).join("・") : TYPE_LABEL[item.type] + (item.capacity ? `・${item.capacity}g` : "");
    const stock = flavor && WALLET.stock[item.id] ? `<span class="sp-stock">所持 ${WALLET.stock[item.id]}g</span>` : "";
    const qty = owned ? `<span class="sp-owned">${Object.values(WALLET.equip).includes(item.id) ? "装備中" : "所持済み"}</span>`
      : n ? `<span class="sp-qty"><button data-sp="minus" data-id="${item.id}" aria-label="${esc(name)}を1つ減らす">${icon("spMinus")}</button><output>${n}</output><button data-sp="plus" data-id="${item.id}" aria-label="${esc(name)}を1つ追加"${n >= (flavor ? 99 : 1) ? " disabled" : ""}>${icon("spPlus")}</button></span>`
      : `<button class="sp-add" data-sp="plus" data-id="${item.id}" aria-label="${esc(name)}をかごに入れる">${icon("spPlus")}</button>`;
    return `<article class="sp-card${n ? " picked" : ""}${owned ? " owned" : ""}" data-card="${item.id}">
      <button class="sp-card-main" data-sp="detail" data-id="${item.id}" aria-label="${esc(name)}の説明">
        <span class="sp-card-art">${productArtHtml(flavor ? "flavor" : "equip", item.id, this.data, 8)}</span>
        <b class="sp-card-name">${esc(name)}</b>
        <small class="sp-card-tags">${esc(tags) || "&nbsp;"}</small>
      </button>
      ${stock}
      <div class="sp-card-row"><b class="sp-price">${yen(flavor ? item.price : item.buy_price)}</b>${qty}</div>
    </article>`;
  }

  /** 1枚だけ描き直す（スクロールの位置と、押した札の手応えを保つ） */
  refreshCard(id) {
    const card = this.el.querySelector(`[data-card="${id}"]`);
    if (!card) return;
    const { item, flavor } = this.lookup(id);
    const wrap = document.createElement("div");
    wrap.innerHTML = this.cardHtml(item, flavor);
    const next = wrap.firstElementChild;
    next.classList.add("bump");
    card.replaceWith(next);
  }

  /** シーシャくじの売り場: 箱の残りと景品の並び、くじの棚へ（本編の kujiRows・lineup を縦の札に） */
  kujiHtml() {
    const { esc } = this.kit;
    const g = kujiGrade(this.data), box = kujiBox(this.data);
    if (!g || !box) return `<p class="sp-empty">今はくじが置いてない</p>`;
    const left = kujiLeft(box);
    const rows = box.prizes.map((p, i) => ({ rank: p.rank, name: p.name, left: left[i], count: p.count, art: prizeArtHtml(p, this.data, 4.6) }));
    if (box.lastOne) rows.push({ rank: "LAST", name: "最後の1枚に付く・中身は秘密", left: box.drawn < box.order.length ? 1 : 0, count: 1, art: `<span class="sp-art sp-art-text secret" style="--s:4.6rem"><span>？</span></span>` });
    return `<section class="sp-kuji">
      <div class="sp-kuji-head"><b>${esc(g.label)}</b><span>残り <em>${box.order.length - box.drawn}</em> / ${box.order.length} 枚</span></div>
      <ul class="sp-kuji-list">${rows.map((r) => `<li class="sp-kuji-row" data-rank="${r.rank}"${r.left ? "" : ' data-out="1"'}>
        <i class="sp-kuji-ball" aria-hidden="true"></i>${r.art}<span class="sp-kuji-main"><b>${RANK_NAME[r.rank]}</b><span>${esc(r.name)}</span></span><small>${r.left ? `残り ${r.left}` : "なし"}</small></li>`).join("")}</ul>
      <p class="sp-kuji-note">くじは、下の「くじを引きに行く」から棚の前で引く（1回ごとに、この箱から1枚）</p>
    </section>`;
  }

  /** 売却: 使っていない機材と、くじで当たった小物（本編の sellRows と同じ。装備中は売れない） */
  sellHtml() {
    const { esc } = this.kit;
    const gear = WALLET.owned.map((id) => this.data.equipById[id]).filter((e) => e && !Object.values(WALLET.equip).includes(e.id));
    const rows = [
      ...gear.map((e) => ({ key: `e:${e.id}`, art: productArtHtml("equip", e.id, this.data, 5.6), name: e.name, note: e.unsellable ? "贈り物なので売れない" : "中古買い取り", price: e.unsellable ? 0 : e.sell_price })),
      ...WALLET.goods.map((g, i) => ({ key: `g:${i}`, art: `<span class="sp-art sp-art-text" style="--s:5.6rem"><span>小物</span></span>`, name: g.name, note: "くじの景品", price: g.sell })),
    ];
    if (!rows.length) return `<p class="sp-empty">売れる物がありません（装備中の機材は売れません）</p>`;
    return `<ul class="sp-sell">${rows.map((r) => `<li class="sp-sell-row">${r.art}<span class="sp-sell-main"><b>${esc(r.name)}</b><small>${r.note}</small></span>
      ${r.price ? `<button data-sp="sell" data-key="${r.key}">${yen(r.price)}で売る</button>` : `<span class="sp-owned">売却不可</span>`}</li>`).join("")}</ul>`;
  }

  syncFoot() {
    const { sum, buy, money } = this.refs;
    money.textContent = yen(WALLET.money);
    const rows = this.data ? this.order() : [], count = rows.reduce((n, r) => n + r.quantity, 0), total = rows.reduce((n, r) => n + r.cost, 0);
    const short = total - WALLET.money;
    sum.innerHTML = count ? `<small>合計 ${count}${rows.every((r) => r.flavor) ? "箱" : "点"}</small><b>${yen(total)}</b><span class="${short > 0 ? "short" : ""}">${short > 0 ? `あと ${yen(short)}` : `購入後 ${yen(WALLET.money - total)}`}</span>`
      : `<small>かご</small><b>${yen(0)}</b><span>＋で選ぶ</span>`;
    sum.disabled = !count;
    // くじの売り場でかごが空なら、親指の届く大きいボタンは「くじを引きに行く」（くじの棚へ）
    const toKuji = this.tab === "kuji" && !count;
    buy.dataset.sp = toKuji ? "kuji" : "buy";
    buy.classList.toggle("kuji", toKuji);
    buy.disabled = toKuji ? false : !count || short > 0;
    buy.innerHTML = toKuji ? `${this.kit.icon("spBall")}<span>くじを引きに行く</span>` : `${this.kit.icon("spBag")}<span>${count ? "購入する" : "商品を選ぶ"}</span>`;
    this.el.dataset.spCart = String(count);
  }

  toast(text) {
    const { toast } = this.refs;
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.remove("show"); void toast.offsetWidth; toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { if (!this.dead) toast.hidden = true; }, 2200);
  }

  /* ── 下からせり上がる札（説明・かごの中身・店を出る確認・売却の確認） ── */

  openSheet(sheet) {
    const { icon, esc } = this.kit;
    this.sheet = sheet;
    let body = "";
    if (sheet.kind === "detail") {
      const { item, flavor } = this.lookup(sheet.id);
      if (!item) return;
      const n = this.cart.get(item.id) || 0, owned = !flavor && WALLET.owned.includes(item.id);
      const current = !flavor && this.data.equipById[WALLET.equip[item.type]];
      const meta = flavor ? `所持 ${WALLET.stock[item.id] || 0}g ／ 1箱 ${FLAVOR_BOX_GRAMS}g・${yen(item.price)}` : `${yen(item.buy_price)}${item.capacity ? ` ／ 容量 ${item.capacity}g` : ""}`;
      body = `<div class="sp-detail">
        <span class="sp-detail-art">${productArtHtml(flavor ? "flavor" : "equip", item.id, this.data, 13)}</span>
        <div class="sp-detail-main">
          <small class="sp-detail-cat">${flavor ? CAT_LABEL[item.category] || "" : TYPE_LABEL[item.type] || ""}</small>
          <h3>${esc(shopProductName(item))}</h3>
          <p class="sp-detail-meta">${meta}</p>
          ${current && current.id !== item.id ? `<p class="sp-detail-now">装備中：${esc(current.name)}${current.capacity ? `（${current.capacity}g）` : ""}</p>` : ""}
        </div>
      </div>
      <p class="sp-detail-text">${esc(shopText(item.description))}</p>
      ${flavor ? `<p class="sp-detail-tags">${flavorTags(item).map((t) => `<span>${t}</span>`).join("")}<span class="heat">${heatNote(item)}</span></p>` : ""}
      <div class="sp-sheet-foot">
        ${owned ? `<span class="sp-owned">${Object.values(WALLET.equip).includes(item.id) ? "装備中" : "所持済み"}</span>`
          : `<span class="sp-qty big"><button data-sp="minus" data-id="${item.id}" aria-label="1つ減らす"${n ? "" : " disabled"}>${icon("spMinus")}</button><output>${n}</output><button data-sp="plus" data-id="${item.id}" aria-label="1つ追加"${n >= (flavor ? 99 : 1) ? " disabled" : ""}>${icon("spPlus")}</button></span>`}
        <button class="sp-sheet-ok" data-sp="close">一覧に戻る</button>
      </div>`;
    } else if (sheet.kind === "order") {
      const rows = this.order();
      if (!rows.length) { this.closeSheet(); return; }
      body = `<h3 class="sp-sheet-title">選択した商品</h3>
        <ul class="sp-order">${rows.map((r) => `<li><span>${esc(shopProductName(r.item))} × ${r.quantity}</span><b>${yen(r.cost)}</b></li>`).join("")}</ul>
        <div class="sp-sheet-foot"><button class="sp-sheet-sub" data-sp="clear">選択をクリア</button><button class="sp-sheet-ok" data-sp="close">一覧に戻る</button></div>`;
    } else if (sheet.kind === "leave") {
      body = `<h3 class="sp-sheet-title">買い物を終える</h3><p class="sp-sheet-text">選択した商品は、まだ購入していません。選択を取り消して店を出ますか？</p>
        <div class="sp-sheet-foot"><button class="sp-sheet-sub" data-sp="close">買い物に戻る</button><button class="sp-sheet-ok" data-sp="leave-ok">店を出る</button></div>`;
    } else if (sheet.kind === "sell") {
      const row = this.sellRow(sheet.key);
      if (!row) { this.closeSheet(); return; }
      body = `<h3 class="sp-sheet-title">売却</h3><p class="sp-sheet-text">${esc(row.name)}を${yen(row.price)}で売りますか？</p>
        <div class="sp-sheet-foot"><button class="sp-sheet-sub" data-sp="close">やめる</button><button class="sp-sheet-ok" data-sp="sell-ok" data-key="${sheet.key}">売る</button></div>`;
    }
    const { sheet: node, scrim } = this.refs;
    const was = !node.hidden;
    node.innerHTML = `<button class="sp-sheet-x" data-sp="close" aria-label="閉じる">${icon("spX")}</button>${body}`;
    node.dataset.kind = sheet.kind;
    node.hidden = scrim.hidden = false;
    if (!was) { node.classList.remove("in"); void node.offsetWidth; node.classList.add("in"); }
  }

  closeSheet() {
    this.sheet = null;
    this.refs.sheet.hidden = this.refs.scrim.hidden = true;
  }

  sellRow(key) {
    const [kind, ref] = String(key).split(":");
    if (kind === "e") { const e = this.data.equipById[ref]; return e && WALLET.owned.includes(ref) && !Object.values(WALLET.equip).includes(ref) && !e.unsellable ? { name: e.name, price: e.sell_price } : null; }
    const g = WALLET.goods[Number(ref)];
    return g ? { name: g.name, price: g.sell } : null;
  }

  sell(key) {
    const row = this.sellRow(key);
    if (!row) return;
    const [kind, ref] = key.split(":");
    if (kind === "e") WALLET.owned = WALLET.owned.filter((id) => id !== ref);
    else WALLET.goods.splice(Number(ref), 1);
    WALLET.money += row.price;
    this.closeSheet();
    this.render();
    this.toast(`${row.name}を売った（＋${yen(row.price)}）`);
  }

  leave() {
    if (this.order().length && this.sheet?.kind !== "leave") { this.openSheet({ kind: "leave" }); return; }
    this.cart.clear();
    this.closeSheet();
    if (this.phone.fixed) { this.render(); return; }
    this.phone.setScene("map");
  }

  /* ── 入力（app.mjs から） ── */

  onClick(event) {
    const hit = event.target.closest("[data-sp]");
    if (!hit || !this.el.contains(hit)) return false;
    const act = hit.dataset.sp, id = hit.dataset.id;
    if (act === "tab") { this.tab = hit.dataset.tab; this.phone.onExtOption?.("tab", this.tab); this.closeSheet(); this.render(); }
    else if (act === "cat") { this.cat = hit.dataset.cat; this.render(); }
    else if (act === "plus") this.change(id, 1);
    else if (act === "minus") this.change(id, -1);
    else if (act === "detail") this.openSheet({ kind: "detail", id });
    else if (act === "close") this.closeSheet();
    else if (act === "order") this.openSheet({ kind: "order" });
    else if (act === "clear") { this.cart.clear(); this.closeSheet(); this.render(); }
    else if (act === "buy") this.purchase();
    else if (act === "leave") this.leave();
    else if (act === "leave-ok") { this.sheet = { kind: "leave" }; this.leave(); }
    else if (act === "sell") this.openSheet({ kind: "sell", key: hit.dataset.key });
    else if (act === "sell-ok") this.sell(hit.dataset.key);
    else if (act === "kuji") { if (this.phone.fixed) this.toast("1台表示で、くじの棚へ進めます"); else this.phone.setScene("kuji"); }
    return true;
  }

  /** PC: ← → で売り場、Enter で購入 */
  move(dir) {
    if (dir !== "left" && dir !== "right" || this.sheet) return;
    const i = TABS.findIndex(([id]) => id === this.tab), next = TABS[(i + (dir === "right" ? 1 : -1) + TABS.length) % TABS.length][0];
    this.tab = next; this.phone.onExtOption?.("tab", next); this.render();
  }

  pressA() {
    if (this.sheet) { this.closeSheet(); return; }
    if (!this.refs.buy.disabled) this.refs.buy.click(); // 購入する／くじを引きに行く
  }

  tick() {}
}
