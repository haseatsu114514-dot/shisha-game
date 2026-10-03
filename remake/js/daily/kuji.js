// シーシャくじ（master_spec #25）。正本データは data/kuji.json（旧版と共通）。
// ボックス制・上位集約。リセマラ防止: 箱の並びは作った時点で確定して保存し、引くたびに先頭から出す。
// 引いた直後に保存するので、結果を見てからのロードでは変わらない。
import { el, yen, sleep, shuffle } from "../core/util.js";
import { DB, displayName } from "../core/data.js";
import { layers, toast } from "../core/ui.js";
import { state, save } from "../core/state.js";
import { addMoney } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { addFlavorStock, FLAVOR_BOX_GRAMS } from "./shop.js";

const grades = () => Object.entries(DB.kuji?.grades || {})
  .filter(([, g]) => (g.chapterMin || 1) <= (state.chapter || 1))
  .map(([id, g]) => ({ id, ...g }));

function newBox(g) {
  const order = [];
  g.prizes.forEach((p, i) => { for (let k = 0; k < p.count; k++) order.push(i); });
  return { order: shuffle(order), drawn: 0, emptyDay: null };
}

/** 箱の状態。引き切ってから refillDays 経ったら新しい箱に入れ替わる */
function boxOf(g) {
  let b = state.kuji[g.id];
  const refill = DB.kuji.meta?.refillDays || 3;
  if (b && b.drawn >= g.boxSize && b.emptyDay != null && state.day - b.emptyDay >= refill) b = null;
  if (!b) { b = state.kuji[g.id] = newBox(g); save(); }
  return b;
}

/** 景品を実体化。goods は売れる小物、flavor は手持ちに加わる、consumable は使う物（演出のみ） */
function grant(prize) {
  if (prize.equipId) {
    if (state.owned.includes(prize.equipId)) { if (prize.sell) addMoney(Math.round(prize.sell * 0.5)); }
    else state.owned.push(prize.equipId);
    return;
  }
  if (prize.type === "flavor" && prize.flavorId) {
    addFlavorStock(prize.flavorId, FLAVOR_BOX_GRAMS); // 1箱（50g）ぶん在庫に入る
    return;
  }
  if ((prize.type === "goods" || prize.type === "stand") && prize.sell) state.goods.push({ name: prize.name, sell: prize.sell });
}

/** ショップの「くじ」タブの中身 */
export function kujiRows(rerender) {
  const list = grades();
  if (!list.length) return [el("p.shop-empty", { text: "くじはまだ入荷していない" })];
  const rows = [];
  if (!state.flags._kuji_seen) {
    state.flags._kuji_seen = true;
    rows.push(el("p.kuji-note", { text: `${displayName("rin", state)}「これ、実は在庫しょぶ……なんでもない。引きは引き。直感で行きなさい」` }));
  }
  const refill = DB.kuji.meta?.refillDays || 3;
  for (const g of list) {
    const box = boxOf(g);
    const left = g.boxSize - box.drawn;
    const empty = left <= 0;
    const top = g.prizes.filter((p) => p.rank === "S").map((p) => p.name).join("・");
    rows.push(el("div.shop-row.kuji-row", [
      el("span.shop-cat.kuji-cat", { text: "くじ" }),
      el("div.shop-main", [
        el("b", { text: g.label }),
        el("small", { text: empty
          ? `売り切れ（あと${Math.max(0, refill - (state.day - box.emptyDay))}日で新しい箱）`
          : `のこり ${left} / ${g.boxSize} 枚 ・ S賞: ${top}${left === 1 ? " ・ 次がラスト1枚！ラストワン賞つき" : ""}` }),
      ]),
      el("button.btn.small", {
        text: empty ? "売り切れ" : `${yen(g.price)}で引く`,
        disabled: empty || state.money < g.price || null,
        dataset: { test: `kuji-${g.id}` },
        onclick: async () => { await draw(g); rerender(); },
      }),
    ]));
  }
  return rows;
}

async function draw(g) {
  const box = boxOf(g);
  if (box.drawn >= g.boxSize || state.money < g.price) return;
  addMoney(-g.price);
  const prize = g.prizes[box.order[box.drawn]];
  box.drawn += 1;
  const last = box.drawn >= g.boxSize;
  if (last) box.emptyDay = state.day;
  grant(prize);
  const extras = last && g.lastOne ? [g.lastOne] : [];
  extras.forEach(grant);
  save(); // 引いた直後に保存（結果を見てからのロードでは変わらない）
  await reveal(prize, extras);
}

// 引き演出: 棚の箱から1つを引き当てる → ランクが開く。上位賞は光が走る
function reveal(prize, extras) {
  return new Promise((resolve) => {
    const shelf = el("div.kuji-shelf", Array.from({ length: 6 }, (_, i) => el("i.kuji-box")));
    const pickIdx = Math.floor(Math.random() * 6);
    const card = el("div.kuji-card.drawing", [shelf, el("div.kuji-label", { text: "箱を引いています……" })]);
    const ov = el("div.kuji-overlay", { dataset: { test: "kuji-reveal" } }, [card]);
    layers.modal.replaceChildren(ov);
    layers.modal.classList.add("show");
    SE.select();
    requestAnimationFrame(() => shelf.children[pickIdx].classList.add("reach"));
    let open = false;
    setTimeout(async () => {
      const top = prize.rank === "S" || prize.rank === "LAST";
      card.className = `kuji-card reveal rank-${prize.rank}`;
      card.replaceChildren(
        el("div.kuji-rank", { text: prize.rank === "LAST" ? "LAST" : `${prize.rank}賞` }),
        el("div.kuji-name", { text: prize.name }),
        el("div.kuji-desc", { text: prize.desc || "" }),
        el("div.kuji-tap", { text: "タップで閉じる" }),
      );
      SE.stamp();
      if (top) SE.fanfare();
      open = true;
      for (const ex of extras) { await sleep(500); toast(`${ex.name} を手に入れた！`, { kind: "good" }); }
    }, 800);
    ov.onclick = () => {
      if (!open) return;
      SE.click();
      layers.modal.classList.remove("show");
      layers.modal.replaceChildren();
      resolve();
    };
  });
}

/** 売れる小物（くじの景品など）の買い取り行 */
export function goodsSellRows(rerender) {
  return (state.goods || []).map((g, i) => el("div.shop-row", [
    el("span.shop-cat", { text: "小物" }),
    el("div.shop-main", [el("b", { text: g.name }), el("small", { text: "くじの景品・中古買い取り" })]),
    el("button.btn.small", {
      text: `${yen(g.sell)}で売る`,
      onclick: () => { state.goods.splice(i, 1); addMoney(g.sell); SE.money(); rerender(); },
    }),
  ]));
}
