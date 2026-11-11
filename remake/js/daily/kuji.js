import { spendableMoney } from "../core/travel-budget.js";
// シーシャくじ（master_spec #25）。正本データは data/kuji.json（旧版と共通）。
// ボックス制・上位集約。リセマラ防止: 箱の並びは作った時点で確定して保存し、引くたびに先頭から出す。
// 引いた直後に保存するので、結果を見てからのロードでは変わらない。
import { el, yen, shuffle } from "../core/util.js";
import { DB, displayName } from "../core/data.js";
import { layers, modal } from "../core/ui.js";
import { state, save } from "../core/state.js";
import { addMoney } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { addFlavorStock, FLAVOR_BOX_GRAMS } from "./shop.js";
import { RIO_AWAY_DAY, KUJI_TICKET_MAX } from "../core/rules.js";
import { kujiTickets, grantKujiTickets, spendKujiTicket } from "./kuji-tickets.js";
import { reveal, revealMany } from "./kuji-reveal.js";

// 全等級で購入を共有ロック。表示・セーブには保存しない。
let purchaseLock = null, currentRows = null;

/** その店で今引けるくじ。くじは店ごとに1種類で、章が進むと新しい街の店に上位のくじがある（KJ11）。
 * shop は置いてある店: "home"（地元の本店）・"widehanga"（柚ヶ谷店）・"tokyo"（東京店）・"dubai"（ドバイ店）。
 * 本店は第5章になると、シーシャくじが限定台くじに入れ替わる（data/kuji.json の chapterMin〜chapterMax） */
const grades = (shop = "home") => Object.entries(DB.kuji?.grades || {})
  .filter(([, g]) => (g.shop || "home") === shop && (g.chapterMin || 1) <= (state.chapter || 1) && (state.chapter || 1) <= (g.chapterMax || Infinity))
  .map(([id, g]) => ({ id, ...g }));
/** その店に今くじが置いてあるか（ショップの「シーシャくじ」タブを出すか） */
export const hasKuji = (shop = "home") => grades(shop).length > 0;

function newBox(g) {
  const order = [];
  g.prizes.forEach((p, i) => { for (let k = 0; k < p.count; k++) order.push(i); });
  return { order: shuffle(order), drawn: 0, emptyDay: null,
    version: DB.kuji.meta.version, prizes: structuredClone(g.prizes), lastOne: structuredClone(g.lastOne) };
}

/** 箱の状態。引き切ってから refillDays 経ったら新しい箱に入れ替わる */
function boxOf(g) {
  let b = state.kuji[g.id];
  const refill = DB.kuji.meta?.refillDays || 3;
  // 既存セーブの20/12枚箱は順番も景品もそのまま。引き切った次の補充から50枚へ。
  if (b && b.drawn >= b.order.length && b.emptyDay != null && state.day - b.emptyDay >= refill) b = null;
  if (!b) { b = state.kuji[g.id] = newBox(g); save(); }
  if (!b.prizes) {
    const original = DB.kuji.legacyGrades?.[g.id] || g;
    b.prizes = structuredClone(original.prizes);
    b.lastOne = structuredClone(original.lastOne);
    b.version = 1;
    save();
  }
  return b;
}

/** 景品を実体化。goods は売れる小物、flavor は手持ちに加わる、台・機材（equipId）は持ち物に入る、consumable（旧箱）は演出のみ。
 * 機材は同じ物を二つ持てないので、持っている物が当たったら中古買い取りの額をお金で渡す（非売品で買い取りの無い台は景品評価の半額）。
 * くじ限定の台（kuji_only・KJ05）は売れないので、持っていたらお金ではなくくじ券1枚に替える（上限なら0枚）。
 * 戻り値はその時に渡した額か { dupTicket: 枚数 }（持っていなかった・機材でない景品は null） */
function grant(prize) {
  if (prize.equipId) {
    if (!state.owned.includes(prize.equipId)) { state.owned.push(prize.equipId); return null; }
    const gear = DB.equipById?.[prize.equipId];
    if (gear?.kuji_only) return { dupTicket: grantKujiTickets(1, "kuji_dupe") };
    const cash = gear && !gear.unsellable && gear.sell_price > 0 ? gear.sell_price : Math.round((prize.sell || 0) * 0.5);
    if (cash) addMoney(cash);
    return cash;
  }
  if (prize.type === "flavor" && prize.flavorId) {
    addFlavorStock(prize.flavorId, prize.grams ?? FLAVOR_BOX_GRAMS);
    return null;
  }
  if (prize.type === "flavor" && prize.flavors) {
    for (const leaf of prize.flavors) addFlavorStock(leaf.id, leaf.grams);
    return null;
  }
  if ((prize.type === "goods" || prize.type === "stand") && prize.sell) state.goods.push({ name: prize.name, sell: prize.sell });
  return null;
}
/** 持っていた機材をお金に替えた時は、結果の札にその額を出す */
const yen2 = (n) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
const withDupe = (prize, cash) => cash == null ? prize : typeof cash === "object" ? { ...prize, ...cash } : { ...prize, dupCash: cash };
/** 結果の札に出す重複の文を賞に添える（dupText＝1回引きの札の文、dupShort＝連続の小さい札の短い表記。見せ方は kuji-reveal.js） */
const noted = (prize) => prize.dupCash == null && prize.dupTicket == null ? prize : { ...prize,
  dupText: prize.dupTicket == null ? `持っているので、中古買い取りの${yen(prize.dupCash)}を受け取った`
    : prize.dupTicket > 0 ? "持っているので、くじ券を1枚受け取った" : `持っている（くじ券は${KUJI_TICKET_MAX}枚まで）`,
  dupShort: prize.dupTicket == null ? yen(prize.dupCash) : `券+${prize.dupTicket}` };

/** ショップの「くじ」タブの中身。shop はその店（grades を参照） */
export function kujiRows(rerender, shop = "home") {
  const view = currentRows = {};
  const session = state, boxes = state.kuji;
  const { chapter, day, slot, phase } = state;
  const buttons = [];
  const live = button => currentRows === view && state === session && state.kuji === boxes
    && state.chapter === chapter && state.day === day && state.slot === slot && state.phase === phase
    && button.isConnected && !button.closest(".done");
  const list = grades(shop);
  if (!list.length) return [el("p.shop-empty", { text: "くじはまだ入荷していない" })];
  const rows = [];
  const guide = "棚の案内には、残り枚数と景品が書かれている。くじは1階で昼夜とも引ける。置いてあるくじは店ごとに1種類で、ほかの街の Dr.fookah には別のくじがある。";
  const staffed = state.slot === 1 && state.day % 7 !== RIO_AWAY_DAY && state.met.rio;
  const firstSeen = !state.flags._kuji_seen;
  state.flags._kuji_seen = true;
  // 初回にリオが居る時のひと言は台詞なのでそのまま出し、棚の案内は「?」を押して開く。
  if (firstSeen && staffed) rows.push(el("p.kuji-note", { text: `${displayName("rio", state)}「これ、実は在庫しょぶ……なんでもない。引きは引き。直感で行きなさい」` }));
  // 「?」は専用の行を作らず、最初のくじの見出しの横に小さく置く（行を押した時の詳細は開かない）。
  let help = el("button.kuji-help", {
    text: "?", "aria-label": "くじの案内", dataset: { test: "kuji-help" },
    onclick: (event) => { event.stopPropagation(); SE.select(); modal({ title: "くじの案内", className: "shop-dialog", body: guide, options: [{ label: "閉じる", value: null, primary: true, test: "kuji-help-close" }] }); },
  });
  const refill = DB.kuji.meta?.refillDays || 3;
  for (const g of list) {
    const box = boxOf(g);
    const size = box.order.length;
    const left = size - box.drawn;
    const empty = left <= 0;
    const tops = box.prizes.filter((p) => p.rank === "S").map((p) => p.name);
    // 限定台くじ（KJ05）はS賞が3種あるので、行には種類の数だけ出し、名前は行を押した案内に載せる（行を横にはみ出させない）
    const top = g.limited ? `くじ限定の台${tops.length}種` : tops.join("・");
    const drawn = box.drawn, order = box.order;
    // pay: "money"＝1回の値段を払う、"ticket"＝くじ券1枚で1回（限定台くじだけ。お金は使わない）
    const affordable = (count, pay) => pay === "ticket" ? !!g.limited && count === 1 && kujiTickets() >= 1
      : spendableMoney(state) >= g.price * count;
    const buyButton = (count, label, test, pay = "money") => {
      const button = el("button.btn.small", {
        text: label,
        disabled: empty || count > left || !affordable(count, pay) || null,
        dataset: { test },
        onclick: async () => {
          if (!live(button) || boxes[g.id] !== box || box.order !== order || box.drawn !== drawn
            || count > left || !affordable(count, pay) || layers.modal.classList.contains("show")) return;
          if (purchaseLock?.session === session
            && (purchaseLock.committing || purchaseLock.overlay?.isConnected)) return;
          const lock = purchaseLock = { session, committing: true, overlay: null };
          // Enterのrepeatも含め、演出中は背後の購入ボタンへ再入力させない。
          buttons.forEach(b => { b.disabled = true; });
          try {
            const pending = count === 1 ? draw(g, box, pay) : drawMany(g, box, count);
            lock.overlay = layers.modal.firstElementChild;
            lock.committing = false;
            await pending;
          } finally {
            if (purchaseLock === lock) purchaseLock = null;
            if (live(button)) rerender();
          }
        },
      });
      buttons.push(button);
      return button;
    };
    const actions = [buyButton(1, empty ? "売り切れ" : `×1 ${yen2(g.price)}`, `kuji-${g.id}`)];
    for (const target of [5, 10]) {
      const count = Math.min(target, left);
      if (count < 2 || (target === 10 && count <= 5)) continue;
      actions.push(buyButton(count, `×${count} ${yen2(g.price * count)}`, `kuji-${g.id}-${target}`));
    }
    const secret = el("small.kuji-secret", { hidden: true, text: left === 1 ? "次が最後の1枚！ ラストワン賞・シークレットつき" : "ラストワン賞・シークレット（中身は獲得してから）" });
    const detailBody = () => g.limited ? el("div.kuji-detail", [
      el("p", { text: `S賞（くじ限定の台。店では売っていない）: ${tops.join("・")}` }),
      el("p", { text: "持っている限定の台が当たったら、お金ではなくくじ券1枚に替わる。くじ券1枚で、このくじを1回引ける。" }),
      el("p", { text: secret.textContent }),
    ]) : secret.textContent;
    const openDetail = () => { SE.select(); modal({ title: g.label, className: "shop-dialog", body: detailBody(), options: [{ label: "閉じる", value: null, primary: true, test: "kuji-detail-close" }] }); };
    rows.push(el("div.shop-row.kuji-row", { dataset: { test: `kuji-row-${g.id}` }, onclick: (e) => { if (!e.target.closest(".kuji-actions")) openDetail(); } }, [
      el("span.shop-cat.kuji-cat", { text: "🎫", "aria-label": "くじ" }),
      el("div.shop-main", [
        help ? el("span.kuji-title", [el("b", { text: g.label }), help]) : el("b", { text: g.label }),
        el("small", { text: empty
          ? `売り切れ（あと${Math.max(0, refill - (state.day - box.emptyDay))}日で新しい箱）`
          : `のこり ${left} / ${size} 枚 ・ S賞: ${top}${size !== g.boxSize ? `（旧箱・次回は${g.boxSize}枚）` : ""}` }),
        secret,
      ]),
      el("div.kuji-actions", actions),
    ]));
    help = null;
    // くじ券（KJ05）: 限定台くじの行のすぐ下に、残りの枚数と「くじ券で引く」を置く。0枚・売り切れでは押せない
    if (g.limited) {
      const tickets = kujiTickets();
      rows.push(el("div.shop-row.kuji-ticket-row", { dataset: { test: `kuji-ticket-row-${g.id}` } }, [
        el("span.shop-cat.kuji-cat", { text: "券", "aria-label": "くじ券" }),
        el("div.shop-main", [
          el("b", { text: `くじ券 ${tickets}枚` }),
          el("small", { text: "1枚で、お金を使わずに限定台くじを1回引ける" }),
        ]),
        el("div.kuji-actions", [buyButton(1, `くじ券で引く（残り${tickets}枚）`, `kuji-${g.id}-ticket`, "ticket")]),
      ]));
    }
  }
  return rows;
}

function takeTicket(g, box, pay = "money") {
  if (box.drawn >= box.order.length) return;
  if (pay === "ticket") {
    // くじ券は限定台くじだけに使える。1枚減らし、お金は動かさない（0枚なら引かない）
    if (!g.limited || !spendKujiTicket()) return;
  } else {
    if (spendableMoney(state) < g.price) return;
    addMoney(-g.price);
  }
  const prize = box.prizes[box.order[box.drawn]];
  box.drawn += 1;
  const last = box.drawn >= box.order.length;
  if (last) box.emptyDay = state.day;
  const shown = withDupe(prize, grant(prize));
  const extras = (last && box.lastOne ? [box.lastOne] : []).map((ex) => withDupe(ex, grant(ex)));
  save(); // 引いた直後に保存（結果を見てからのロードでは変わらない）
  return { prize: shown, extras };
}

async function draw(g, box, pay = "money") {
  const result = takeTicket(g, box, pay);
  if (result) await reveal(noted(result.prize), result.extras.map(noted));
}

async function drawMany(g, box, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const result = takeTicket(g, box);
    if (!result) break;
    results.push(noted(result.prize), ...result.extras.map(noted));
  }
  if (results.length) await revealMany(results, count);
}

/** 開発用: 景品を渡さずに、指定の賞で引く演出だけ見る（__remake.dev.motion("garagara-S") など）。
 * "LAST" はラストワン賞の場面だけ、"C+LAST" のように書くと C賞の札を閉じたあとにラストワン賞へ続く。
 * 数字で始めると連続の演出: "10"（B・C賞だけ）・"10A"・"10S"（その賞が1つ入る）・"10LAST"（最後にラストワン賞が付く）・"5S" など */
export function previewReveal(rank = "S") {
  const g = Object.values(DB.kuji?.grades || {})[0];
  const find = (r) => (r === "LAST" ? g?.lastOne : g?.prizes.find((p) => p.rank === r)) || { rank: r, name: r === "LAST" ? "ラストワン賞" : `${r}賞`, desc: "" };
  const many = /^(\d+)(.*)$/.exec(String(rank));
  if (many) {
    const count = Math.max(2, Math.min(10, Number(many[1]))), best = many[2] || "";
    const pool = (r) => g?.prizes.filter((p) => p.rank === r) || [];
    const some = (r, i) => pool(r)[i % (pool(r).length || 1)] || find(r);
    const results = [...Array(count)].map((_, i) => (i % 3 === 1 ? some("C", i) : some("B", i)));
    if (best === "A" || best === "S") results[Math.floor(count * 0.6)] = some("A", 0);
    if (best === "S") results[count - 2] = find("S");
    if (best === "LAST") results.push(find("LAST"));
    return revealMany(results, count);
  }
  const [main, extra] = String(rank).split("+");
  return reveal(find(main), extra ? [find(extra)] : []);
}

/** 売れる小物（くじの景品など）の買い取り行 */
export function goodsSellRows(rerender, confirmSale) {
  const session = state, goods = state.goods;
  return (goods || []).map((g) => {
    const button = el("button.btn.small", {
      text: `${yen(g.sell)}で売る`,
      onclick: async () => {
        if (state !== session || state.goods !== goods || !button.isConnected || !goods.includes(g)) return;
        if (!await confirmSale(g.name, g.sell)) return;
        if (state !== session || state.goods !== goods || !button.isConnected) return;
        const idx = goods.indexOf(g);
        if (idx < 0) return;
        goods.splice(idx, 1); addMoney(g.sell); SE.money(); rerender();
      },
    });
    return el("div.shop-row", [
      el("span.shop-cat", { text: "小物" }),
      el("div.shop-main", [el("b", { text: g.name }), el("small", { text: "くじの景品・中古買い取り" })]),
      button,
    ]);
  });
}
