// 店内の伝票だけを管理。本編の状態・給与・在庫・経過日数から独立した一手制。
const PRICE = { seat: 500, drink: 400, shisha: 1600, extra: 800 };
const MAX_TURNS = 48;
const MENU = [
  { id: "citrus", labels: ["レモン＋ミント", "オレンジ＋レモン"], tastes: [
    { tags: ["柑橘", "涼しい後味"], preference: "涼しい後味", quote: "柑橘でさっぱり。あと、口に少し涼しさが残ると嬉しいな。" },
    { tags: ["柑橘", "オレンジの香り"], preference: "オレンジ香る柑橘", quote: "甘すぎない柑橘で。涼しさより、オレンジの香りが好きです。" },
  ] },
  { id: "fruit_mint_free", labels: ["ブルーベリー＋ピーチ", "グレープ＋オレンジ"], tastes: [
    { tags: ["果物の甘さ", "ピーチ", "ミントなし"], preference: "桃の甘さ・ミント抜き", quote: "ミントは抜きで、桃がふわっと甘いのが飲み物に合いそう。" },
    { tags: ["果物の甘さ", "グレープ", "ミントなし"], preference: "ぶどうの甘さ・ミント抜き", quote: "ミントなしで、甘いぶどうの香りが濃いほうをお願いします。" },
  ] },
  { id: "sweet_round", labels: ["バニラ＋ココナッツ", "ピーチ＋バニラ"], tastes: [
    { tags: ["お菓子の甘さ", "ココナッツ"], preference: "焼き菓子みたいな甘さ", quote: "果物よりお菓子っぽく。ココナッツのお菓子みたいな甘さ、出せますか？" },
    { tags: ["お菓子の甘さ", "ピーチ"], preference: "桃のお菓子の甘さ", quote: "甘いのがいいな。桃のお菓子のように、果物の香りが残るほうで。" },
  ] },
  { id: "double_apple", labels: ["ダブルアップル＋ミント少量", "ダブルアップル単体"], tastes: [
    { tags: ["ダブルアップル", "清涼感少し"], preference: "ダブルアップル＋少し涼しさ", quote: "ダブルアップルを。涼しい後味がほんの少しあるといいな。" },
    { tags: ["ダブルアップル", "ミントなし"], preference: "ダブルアップルそのまま", quote: "ダブルアップルの香りだけ、そのまま楽しみたいな。" },
  ] },
];
const PROFILES = [
  { name: "初めての方", firstTime: true, care: true },
  { name: "電車待ちの二人", party: 2, short: true },
  { name: "読書中の方", quiet: true },
  { name: "散歩帰りの二人", party: 2, extra: true },
  { name: "仕事終わりの方", short: true },
  { name: "香り好きの方", care: true },
];
const emptyTable = id => ({ id, phase: "empty", guest: null, request: null, due: null, recipeId: null, note: "" });

function menuRecipes(orders) {
  return MENU.flatMap(order => {
    const source = Array.isArray(orders) ? orders.find(x => x?.id === order.id) : null;
    return order.tastes.map(({ tags }, index) => ({
      id: `${order.id}:${index}`, orderId: order.id, index,
      label: source?.labels?.[index] || order.labels[index], tags: [...tags],
    }));
  });
}

export function createFloorShift({ seed = 0, orders = [], order = null, anchorOrderId = order?.id } = {}) {
  const variant = Number(seed) >>> 0;
  const anchor = MENU.find(x => x.id === anchorOrderId) || MENU[variant % MENU.length];
  const choices = [anchor, MENU[3], MENU[1], MENU[2], MENU[0], MENU[(variant + 2) % MENU.length]];
  const guests = PROFILES.map((p, i) => {
    const family = choices[i];
    const index = ((variant >>> (i + 2)) + i) % 2;
    const wanted = family.tastes[index];
    return {
      id: `g${i + 1}`, ...p, party: p.party || 1, short: !!p.short, quiet: !!p.quiet, firstTime: !!p.firstTime,
      arrival: 1 + 2 * i, preference: wanted.preference, quote: wanted.quote,
      orderId: family.id, preferredRecipeId: `${family.id}:${index}`,
      extraRecipeId: p.extra ? `citrus:${(index + 1) % 2}` : null,
      anchor: i === 0,
    };
  });
  return {
    turn: 1, maxTurns: MAX_TURNS, done: false,
    tables: Array.from({ length: 6 }, (_, i) => emptyTable(i + 1)),
    recipes: menuRecipes(order ? [order, ...orders] : orders), waiting: [guests[0]], upcoming: guests.slice(1),
    nextArrival: guests[1].arrival, bench: null, shelf: null, anchorOrderId: anchor.id,
    sales: 0, ledger: [], served: 0, matched: 0, cleared: 0, care: 0, extras: 0, missed: 0, anchorIndex: null,
    notice: "入口に最初のお客さん。空いている卓へ案内しましょう。",
  };
}

export function floorActions(s) {
  if (s.done) return [];
  const actions = [];
  const add = (kind, t, label, detail, recipeId) => actions.push({
    id: [s.turn, kind, t?.id, recipeId].filter(x => x != null).join("/"),
    kind, tableId: t?.id ?? null, label, detail, recipeId,
  });
  const menu = (kind, t) => {
    for (const r of s.recipes.filter(item => item.orderId === t.guest.orderId)) {
      add(kind, t, r.label, r.tags.join("・"), r.id);
    }
  };
  for (const t of s.tables) {
    switch (t.phase) {
      case "empty":
        if (s.waiting.length) add("seat", t, `${s.waiting[0].name}を案内`, `${s.waiting[0].party}名・1台`);
        break;
      case "seated":
        menu("order", t);
        break;
      case "ordered":
        if (!s.bench) add("start", t, t.orderKind === "redo" ? "作り直す" : "作り始める", "2手後に仕上がる");
        break;
      case "ready":
        if (s.shelf?.tableId === t.id) add("serve", t, "この卓へ運ぶ", t.orderKind === "extra" ? "新しい香り（トップ替え）" : "伝票の一台");
        break;
      case "lounging":
        if (t.request === "無料ケア") add("care", t, "一台を整える", "料金なし");
        if (t.request === "味の相談") {
          if (!t.redoUsed) menu("redo", t);
          add("decline", t, "シーシャ代を外す", "飲み物と席だけでお会計");
        }
        if (t.request === "追加希望") {
          const r = s.recipes.find(item => item.id === t.guest.extraRecipeId);
          add("extra", t, "トップ替えを受ける · 800円", r.label, r.id);
          add("decline", t, "今回は見送る", "最初の台だけでお会計");
        }
        break;
      case "checkout":
        add("checkout", t, "お会計", `${totalFor(t).total.toLocaleString("ja-JP")}円`);
        break;
      case "dirty":
        add("clear", t, "卓を片付ける", "次のお客さんをご案内できます");
        break;
    }
  }
  add("wait", null, "見守る", "店内を1手進める");
  add("finish", null, "残りを引き継ぐ", "スミさんに任せて営業を終える");
  return actions;
}

function totalFor(t) {
  const party = t.guest.party;
  const seat = PRICE.seat * party;
  const drink = PRICE.drink * party;
  const shisha = t.baseStatus === "accepted" ? PRICE.shisha : 0;
  const extra = t.extraServed ? PRICE.extra : 0;
  return { seat, drink, shisha, extra, total: seat + drink + shisha + extra };
}

function record(s, t, handedOff) {
  if (!t.guest || !t.firstServed || s.ledger.some(row => row.guestId === t.guest.id)) return;
  const row = { guestId: t.guest.id, tableId: t.id, name: t.guest.name, party: t.guest.party, ...totalFor(t), handedOff };
  s.ledger.push(row);
  s.sales += row.total;
  if (t.extraServed) s.extras += 1;
}

function unbook(s, t) {
  if (s.bench?.tableId === t.id) s.bench = null;
  if (s.shelf?.tableId === t.id) s.shelf = null;
}

function settled(t) {
  if (t.baseStatus === "pending") t.baseStatus = "waived";
  t.request = null;
  t.due = null;
}

function close(s, handoff = false) {
  s.done = true;
  s.missed += s.waiting.length;
  s.waiting = [];
  s.upcoming = [];
  s.nextArrival = null;
  for (const t of s.tables) {
    if (["empty", "dirty"].includes(t.phase)) continue;
    settled(t);
    if (t.firstServed) record(s, t, true);
    else s.missed += 1;
    t.phase = "dirty";
  }
  s.bench = null;
  s.shelf = null;
  if (handoff) s.notice = "残った卓はスミさんへ。お出しできた分だけを帳面に付けました。";
}

function accepted(s, t, recipeId) {
  t.baseStatus = "accepted";
  s.matched += 1;
  if (t.guest.anchor) s.anchorIndex = s.recipes.find(item => item.id === recipeId).index;
}

function serve(s, t) {
  s.shelf = null;
  t.phase = "lounging";
  t.request = null;
  t.due = null;
  if (t.orderKind === "extra") {
    t.extraServed = true;
    t.checkoutAt = s.turn + 2;
    t.note = "「さっきと違う香り、いいですね」";
  } else {
    if (t.orderKind === "base") {
      s.served += 1;
      t.firstServed = true;
    }
    if (t.guest.preferredRecipeId === t.recipeId) {
      accepted(s, t, t.recipeId);
      t.checkoutAt = s.turn + (t.guest.short ? 3 : 8);
      t.note = t.guest.firstTime ? "「思っていた香りです。教えてくれてありがとう」" : "「うん、この香りが欲しかった」";
      if (t.orderKind === "base" && t.guest.care) t.careAt = s.turn + 2;
      if (t.orderKind === "base" && t.guest.extra) t.extraAt = s.turn + 3;
    } else if (t.orderKind === "base") {
      t.baseStatus = "pending";
      t.consultAt = s.turn + 1;
      t.checkoutAt = s.turn + (t.guest.short ? 7 : 9);
      t.note = "「少し思っていた香りと違うかも。相談できますか？」";
    } else {
      t.baseStatus = "waived";
      t.checkoutAt = s.turn + 1;
      t.note = "「今日は飲み物だけで。ありがとう」";
    }
  }
  s.notice = `${t.id}卓に提供。 ${t.note}`;
}

function tick(s) {
  const before = s.turn;
  const stillWaiting = s.waiting.filter(g => before < g.arrival + 7);
  if (stillWaiting.length < s.waiting.length) {
    s.missed += s.waiting.length - stillWaiting.length;
    s.notice += " 入口で待っていた方を見送りました。";
  }
  s.waiting = stillWaiting;
  for (const t of s.tables) {
    if (t.due == null || before < t.due) continue;
    if (!t.firstServed && ["seated", "ordered", "cooking", "ready"].includes(t.phase)) {
      unbook(s, t);
      t.phase = "dirty";
      settled(t);
      t.note = "間に合わず、お代なしでお見送り。";
      s.missed += 1;
      s.notice += ` ${t.id}卓は提供前に退出。`;
    } else if (t.request === "無料ケア" || t.request === "追加希望") {
      t.request = null;
      t.due = null;
      t.note = "合図の受付を終了しました。";
    }
  }
  if (before >= s.maxTurns) {
    close(s, true);
    return;
  }
  s.turn += 1;
  for (const t of s.tables) {
    if (t.firstServed && t.checkoutAt === s.turn && t.phase !== "dirty") {
      unbook(s, t);
      settled(t);
      t.phase = "checkout";
      t.note = "「お会計、お願いします」";
    }
    if (t.phase !== "lounging") continue;
    if (t.consultAt === s.turn) {
      t.request = "味の相談";
      t.due = t.checkoutAt - 1;
    } else if (t.careAt === s.turn) {
      t.request = "無料ケア";
      t.due = Math.min(s.turn + 2, t.checkoutAt - 1);
      t.note = "「少し香りが薄くなったかも」";
    } else if (t.extraAt === s.turn) {
      t.request = "追加希望";
      t.due = Math.min(s.turn + 2, t.checkoutAt - 1);
      t.note = "「次は柑橘の香りも頼めますか？」";
    }
  }
  if (s.bench && s.bench.readyAt <= s.turn && !s.shelf) {
    s.shelf = s.bench;
    s.bench = null;
    const t = s.tables[s.shelf.tableId - 1];
    t.phase = "ready";
    t.note = "受渡棚に仕上がり。";
  }
  while (s.upcoming[0]?.arrival === s.turn) s.waiting.push(s.upcoming.shift());
  s.nextArrival = s.upcoming[0]?.arrival ?? null;
  if (!s.upcoming.length && !s.waiting.length && s.tables.every(t => t.phase === "empty")) close(s);
}

export function stepFloorShift(s, actionId) {
  const action = floorActions(s).find(a => a.id === actionId);
  if (!action) return s;
  const next = structuredClone(s);
  const t = action.tableId ? next.tables[action.tableId - 1] : null;
  switch (action.kind) {
    case "seat": {
      const guest = next.waiting.shift();
      Object.assign(t, { phase: "seated", guest, due: next.turn + (guest.short ? 12 : 21), note: guest.quote });
      next.notice = `${t.id}卓にご案内。希望の香りを伝票に書きましょう。`;
      break;
    }
    case "order":
    case "redo":
    case "extra":
      t.phase = "ordered";
      t.orderKind = action.kind === "order" ? "base" : action.kind;
      t.recipeId = action.recipeId;
      t.request = null;
      t.note = "作業台が空いたら着手。";
      if (action.kind === "redo") {
        t.redoUsed = true;
        t.due = t.checkoutAt - 1;
      }
      if (action.kind === "extra") {
        t.checkoutAt = next.turn + 7;
        t.due = t.checkoutAt - 1;
      }
      next.notice = `${t.id}卓の伝票を受け付けました。`;
      break;
    case "start":
      t.phase = "cooking";
      t.note = "作業台で準備中。";
      next.bench = { tableId: t.id, recipeId: t.recipeId, readyAt: next.turn + 2 };
      next.notice = `${t.id}卓の一台に着手。待つ間に別の卓へ。`;
      break;
    case "serve":
      serve(next, t);
      break;
    case "care":
      t.request = null;
      t.due = null;
      t.note = "「うん、さっきの香りに戻った」";
      next.care += 1;
      next.notice = `${t.id}卓の台を無料で整えました。`;
      break;
    case "decline":
      if (t.request === "味の相談") {
        t.baseStatus = "waived";
        t.checkoutAt = next.turn + 1;
      }
      t.request = null;
      t.due = null;
      t.note = "できることを伝え、今のご希望で進めます。";
      next.notice = `${t.id}卓へお伝えしました。追加料金はありません。`;
      break;
    case "checkout":
      record(next, t, false);
      t.phase = "dirty";
      t.note = "お見送り済み。片付けると空席に。";
      next.notice = `${t.id}卓をお見送り。お代を店のレジに記録しました。`;
      break;
    case "clear":
      next.tables[t.id - 1] = emptyTable(t.id);
      next.cleared += 1;
      next.notice = `${t.id}卓を片付けました。`;
      break;
    case "wait":
      next.notice = "一手、店を見守りました。";
      break;
    case "finish":
      close(next, true);
      return next;
  }
  tick(next);
  return next;
}

export function floorSummary(s) {
  const { sales, served, matched, cleared, care, extras, missed, anchorIndex, anchorOrderId, ledger } = s;
  return { sales, served, matched, cleared, care, extras, missed, anchorIndex, anchorOrderId, ledger: ledger.map(row => ({ ...row })) };
}
