import { spendableMoney } from "../core/travel-budget.js";
// シーシャくじ（master_spec #25）。正本データは data/kuji.json（旧版と共通）。
// ボックス制・上位集約。リセマラ防止: 箱の並びは作った時点で確定して保存し、引くたびに先頭から出す。
// 引いた直後に保存するので、結果を見てからのロードでは変わらない。
import { el, yen, sleep, shuffle } from "../core/util.js";
import { DB, displayName } from "../core/data.js";
import { layers, toast } from "../core/ui.js";
import { state, save } from "../core/state.js";
import { addMoney } from "../core/stats.js";
import { SE } from "../core/audio.js";
import { vnTest } from "../vn/engine.js";
import { addFlavorStock, FLAVOR_BOX_GRAMS } from "./shop.js";
import { RIN_AWAY_DAY } from "../core/rules.js";

// 全等級で購入を共有ロック。表示・セーブには保存しない。
let purchaseLock = null, currentRows = null;

const grades = () => Object.entries(DB.kuji?.grades || {})
  .filter(([, g]) => (g.chapterMin || 1) <= (state.chapter || 1))
  .map(([id, g]) => ({ id, ...g }));

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

/** 景品を実体化。goods は売れる小物、flavor は手持ちに加わる、consumable は使う物（演出のみ） */
function grant(prize) {
  if (prize.equipId) {
    if (state.owned.includes(prize.equipId)) { if (prize.sell) addMoney(Math.round(prize.sell * 0.5)); }
    else state.owned.push(prize.equipId);
    return;
  }
  if (prize.type === "flavor" && prize.flavorId) {
    addFlavorStock(prize.flavorId, prize.grams ?? FLAVOR_BOX_GRAMS);
    return;
  }
  if (prize.type === "flavor" && prize.flavors) {
    for (const leaf of prize.flavors) addFlavorStock(leaf.id, leaf.grams);
    return;
  }
  if ((prize.type === "goods" || prize.type === "stand") && prize.sell) state.goods.push({ name: prize.name, sell: prize.sell });
}

/** ショップの「くじ」タブの中身 */
export function kujiRows(rerender) {
  const view = currentRows = {};
  const session = state, boxes = state.kuji;
  const { chapter, day, slot, phase } = state;
  const buttons = [];
  const live = button => currentRows === view && state === session && state.kuji === boxes
    && state.chapter === chapter && state.day === day && state.slot === slot && state.phase === phase
    && button.isConnected && !button.closest(".done");
  const list = grades();
  if (!list.length) return [el("p.shop-empty", { text: "くじはまだ入荷していない" })];
  const rows = [];
  if (!state.flags._kuji_seen) {
    state.flags._kuji_seen = true;
    const staffed = state.slot === 1 && state.day % 7 !== RIN_AWAY_DAY && state.met.rin;
    rows.push(el("p.kuji-note", { text: staffed
      ? `${displayName("rin", state)}「これ、実は在庫しょぶ……なんでもない。引きは引き。直感で行きなさい」`
      : "棚の案内には、残り枚数と景品が書かれている。くじは1階で昼夜とも引ける。" }));
  }
  const refill = DB.kuji.meta?.refillDays || 3;
  for (const g of list) {
    const box = boxOf(g);
    const size = box.order.length;
    const left = size - box.drawn;
    const empty = left <= 0;
    const top = box.prizes.filter((p) => p.rank === "S").map((p) => p.name).join("・");
    const drawn = box.drawn, order = box.order;
    const buyButton = (count, label, test) => {
      const button = el("button.btn.small", {
        text: label,
        disabled: empty || count > left || spendableMoney(state) < g.price * count || null,
        dataset: { test },
        onclick: async () => {
          if (!live(button) || boxes[g.id] !== box || box.order !== order || box.drawn !== drawn
            || count > left || spendableMoney(state) < g.price * count || layers.modal.classList.contains("show")) return;
          if (purchaseLock?.session === session
            && (purchaseLock.committing || purchaseLock.overlay?.isConnected)) return;
          const lock = purchaseLock = { session, committing: true, overlay: null };
          // Enterのrepeatも含め、演出中は背後の購入ボタンへ再入力させない。
          buttons.forEach(b => { b.disabled = true; });
          try {
            const pending = count === 1 ? draw(g, box) : drawMany(g, box, count);
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
    const actions = [buyButton(1, empty ? "売り切れ" : `${yen(g.price)}で引く`, `kuji-${g.id}`)];
    for (const target of [5, 10]) {
      const count = Math.min(target, left);
      if (count < 2 || (target === 10 && count <= 5)) continue;
      actions.push(buyButton(count, `${count}回まとめて引く（${yen(g.price * count)}）`, `kuji-${g.id}-${target}`));
    }
    rows.push(el("div.shop-row.kuji-row", [
      el("span.shop-cat.kuji-cat", { text: "くじ" }),
      el("div.shop-main", [
        el("b", { text: g.label }),
        el("small", { text: empty
          ? `売り切れ（あと${Math.max(0, refill - (state.day - box.emptyDay))}日で新しい箱）`
          : `のこり ${left} / ${size} 枚 ・ S賞: ${top}${size !== g.boxSize ? "（旧箱・次回は50枚）" : ""}` }),
        el("small", { text: left === 1 ? "次が最後の1枚！ ラストワン賞・シークレットつき" : "ラストワン賞・シークレット（中身は獲得してから）" }),
      ]),
      el("div.kuji-actions", actions),
    ]));
  }
  return rows;
}

function takeTicket(g, box) {
  if (box.drawn >= box.order.length || spendableMoney(state) < g.price) return;
  addMoney(-g.price);
  const prize = box.prizes[box.order[box.drawn]];
  box.drawn += 1;
  const last = box.drawn >= box.order.length;
  if (last) box.emptyDay = state.day;
  grant(prize);
  const extras = last && box.lastOne ? [box.lastOne] : [];
  extras.forEach(grant);
  save(); // 引いた直後に保存（結果を見てからのロードでは変わらない）
  return { prize, extras };
}

async function draw(g, box) {
  const result = takeTicket(g, box);
  if (result) await reveal(result.prize, result.extras);
}

async function drawMany(g, box, count) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const result = takeTicket(g, box);
    if (!result) break;
    results.push(result.prize, ...result.extras);
  }
  if (results.length) await revealMany(results, count);
}

function revealMany(results, count) {
  return new Promise(resolve => {
    const close = el("button.btn", { text: "結果を閉じる", onclick: () => {
      layers.modal.classList.remove("show");
      layers.modal.replaceChildren();
      resolve();
    } });
    const cards = results.map(prize => el(`div.kuji-card.kuji-short.rank-${prize.rank}`, [
      el("div.kuji-rank", { text: prize.rank === "LAST" ? "ラストワン賞" : `${prize.rank}賞` }),
      el("div.kuji-name", { text: prize.rank === "LAST" ? prize.name.replace(/^ラストワン賞・/, "") : prize.name }),
    ]));
    layers.modal.replaceChildren(el("div.kuji-overlay.kuji-multi", { dataset: { test: "kuji-multi-reveal" } }, [
      el("div.kuji-multi-panel", [
        el("h2", { text: `${count}回の結果` }),
        el("div.kuji-multi-cards", cards),
        close,
      ]),
    ]));
    layers.modal.classList.add("show");
  });
}

// 引き演出: ガラガラ（福引きの回転抽選器）を回し、賞の色の玉が出る → 賞のカードが開く。上位賞は係の人が鐘を鳴らす。
// 箱の最後の1枚なら、カードを閉じたあとにもう一度ガラガラを回し、ラストワン賞の黒い玉とカードを見せる（extras）。
// （motions/garagara.js。SKIP中とテストの高速送りでは回さずにカードだけ出し、ラストワン賞はトーストで知らせる）
function reveal(prize, extras = []) {
  return new Promise((resolve) => {
    const ov = el("div.kuji-overlay", { dataset: { test: "kuji-reveal" } });
    layers.modal.replaceChildren(ov);
    layers.modal.classList.add("show");
    const skip = vnTest.turbo || document.body.classList.contains("vn-skip");
    const queue = skip ? [prize] : [prize, ...extras];
    let open = false;
    const next = async () => {
      const p = queue.shift();
      if (!p) {
        layers.modal.classList.remove("show");
        layers.modal.replaceChildren();
        resolve();
        return;
      }
      await revealOne(ov, p, skip);
      open = true;
      if (skip) for (const ex of extras) { await sleep(500); toast(`${ex.name} を手に入れた！`, { kind: "good" }); }
    };
    ov.onclick = () => {
      if (!open) return;
      open = false;
      SE.click();
      next();
    };
    next();
  });
}

/** 1つの賞を引いて見せる。カードが開いたら解決する */
function revealOne(ov, prize, skip) {
  return new Promise((done) => {
    const card = el("div.kuji-card.drawing", [el("div.kuji-label", { text: prize.rank === "LAST" ? "ラストワン賞！" : "ガラガラ……" })]);
    // 前のカードが残っていれば、ガラガラが上に重なり切ってから入れ替える（いきなり消えて背景だけになる間を作らない）
    const prev = [...ov.children];
    if (skip || !prev.length) ov.replaceChildren(card);
    else setTimeout(() => { prev.forEach((n) => n.remove()); ov.prepend(card); }, 360);
    SE.select();
    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      card.style.visibility = "";
      const last = prize.rank === "LAST";
      card.className = `kuji-card reveal rank-${prize.rank}`;
      card.replaceChildren(
        el("div.kuji-rank", { text: last ? "ラストワン賞" : `${prize.rank}賞` }),
        el("div.kuji-name", { text: last ? prize.name.replace(/^ラストワン賞・/, "") : prize.name }),
        el("div.kuji-desc", { text: prize.desc || "" }),
        el("div.kuji-tap", { text: "タップで閉じる" }),
      );
      SE.stamp();
      if (prize.rank === "S" || last) SE.fanfare();
      done();
    };
    // ガラガラが消え始めたところでカードを下で開き、重ねて受け渡す（回っているあいだ札は隠す）
    if (!skip) card.style.visibility = "hidden";
    (skip ? sleep(300) : import("../motions/garagara.js").then((m) => m.garagara(ov, prize.rank, { onHandoff: show })).catch((e) => console.error(e))).then(show);
  });
}

/** 開発用: 景品を渡さずに、指定の賞で引く演出だけ見る（__remake.dev.motion("garagara-S") など）。
 * "LAST" はラストワン賞の場面だけ、"C+LAST" のように書くと C賞のカードを閉じたあとにラストワン賞へ続く */
export function previewReveal(rank = "S") {
  const g = grades()[0];
  const find = (r) => (r === "LAST" ? g?.lastOne : g?.prizes.find((p) => p.rank === r)) || { rank: r, name: r === "LAST" ? "ラストワン賞" : `${r}賞`, desc: "" };
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
