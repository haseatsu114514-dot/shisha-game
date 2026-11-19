import { test } from "node:test";
import assert from "node:assert/strict";
import { createFloorShift, floorActions, stepFloorShift, floorSummary } from "../js/daily/tonari-floor-model.js";

const at = (s, id) => s.tables[id - 1];
const find = (s, kind, tableId = null, recipeId) => floorActions(s).find(a => a.kind === kind && a.tableId === tableId
  && (recipeId === undefined || a.recipeId === recipeId));
const doIt = (s, kind, tableId = null, recipeId) => {
  const a = find(s, kind, tableId, recipeId);
  assert.ok(a, `手${s.turn} ${tableId ?? "店"} ${kind}:${recipeId ?? ""}`);
  return stepFloorShift(s, a.id);
};
const waitFor = (s, turn) => {
  while (!s.done && s.turn < turn) s = doIt(s, "wait");
  return s;
};
const serveFirst = (initial, { tableId = 1, match = true } = {}) => {
  let s = doIt(initial, "seat", tableId);
  const t = at(s, tableId);
  const recipe = floorActions(s).find(a => a.kind === "order" && a.tableId === tableId
    && (a.recipeId === t.guest.preferredRecipeId) === match);
  s = doIt(s, "order", tableId, recipe.recipeId);
  s = doIt(s, "start", tableId);
  s = waitFor(s, s.bench.readyAt);
  return doIt(s, "serve", tableId);
};

test("six actual table actions; deterministic orders, immutable state and time-stamped inputs", () => {
  const input = { seed: 321, anchorOrderId: "fruit_mint_free", orders: [{ id: "fruit_mint_free", labels: ["試験A", "試験B"] }] };
  const a = createFloorShift(input), b = createFloorShift(input);
  assert.deepEqual(a, b);
  assert.equal(a.tables.length, 6);
  assert.deepEqual(floorActions(a).filter(x => x.kind === "seat").map(x => x.tableId), [1, 2, 3, 4, 5, 6]);
  assert.equal(a.waiting[0].orderId, "fruit_mint_free");
  assert.notEqual(createFloorShift({ seed: 0 }).waiting[0].preferredRecipeId,
    createFloorShift({ seed: 4 }).waiting[0].preferredRecipeId);
  const stale = find(a, "seat", 6);
  const next = doIt(a, "seat", 6);
  assert.equal(at(a, 6).phase, "empty");
  assert.equal(at(next, 6).phase, "seated");
  assert.deepEqual(floorActions(next).filter(x => x.kind === "order").map(x => x.label), ["試験A", "試験B"]);
  assert.equal(stepFloorShift(next, stale.id), next);
  assert.equal(stepFloorShift(next, "forged"), next);
  assert.equal(next.turn, 2);
});

test("all six seats can be in use concurrently and all six can serve, check out and reset", () => {
  let s = createFloorShift({ seed: 18, anchorOrderId: "citrus" });
  const order = id => { s = doIt(s, "order", id, at(s, id).guest.preferredRecipeId); };
  s = doIt(s, "seat", 1); order(1);
  s = doIt(s, "seat", 2); s = doIt(s, "start", 1);
  s = doIt(s, "seat", 3); order(2);
  s = doIt(s, "seat", 4); s = doIt(s, "start", 2);
  s = doIt(s, "seat", 5); order(3);
  s = doIt(s, "seat", 6);
  assert.ok(s.tables.every(t => t.guest && t.phase !== "empty"));
  assert.equal(s.shelf.tableId, 1);
  assert.equal(s.bench.tableId, 2, "two-stage staging, not parallel workbenches");
  s = doIt(s, "serve", 1);
  assert.equal(s.shelf.tableId, 2);
  s = doIt(s, "serve", 2);
  const rank = s => a => {
    const t = a.tableId ? at(s, a.tableId) : null;
    if (a.recipeId && a.kind === "order" && a.recipeId !== t.guest.preferredRecipeId) return 99;
    switch (a.kind) {
      case "serve": return 0;
      case "start": return 10 + (t.due || s.maxTurns) / 100;
      case "order": return 20 + t.due / 100;
      case "care": return 22;
      case "decline": return 23;
      case "checkout": return 30;
      case "clear": return 31;
      case "wait": return 40;
      default: return 99;
    }
  };
  while (!s.done) {
    const p = rank(s);
    s = stepFloorShift(s, floorActions(s).sort((a, b) => p(a) - p(b))[0].id);
  }
  const r = floorSummary(s);
  assert.equal(r.served, 6);
  assert.equal(r.matched, 6);
  assert.equal(r.cleared, 6);
  assert.equal(r.missed, 0);
  assert.equal(r.sales, 16_800); // 四人＋二組、いずれも一台。
  assert.ok(Number.isInteger(r.anchorIndex));
  assert.equal(new Set(r.ledger.map(x => x.guestId)).size, 6);
  assert.equal(new Set(r.ledger.map(x => x.tableId)).size, 6);
  assert.ok(r.ledger.every(row => !row.handedOff));
});

test("unmatched flavor holds the line item; a free corrected bowl settles only one base sale", () => {
  let s = serveFirst(createFloorShift({ seed: 2 }), { match: false });
  assert.equal(at(s, 1).request, "味の相談");
  assert.equal(s.anchorIndex, null);
  assert.equal(s.sales, 0);
  assert.equal(find(s, "extra", 1), undefined);
  const good = at(s, 1).guest.preferredRecipeId;
  s = doIt(s, "redo", 1, good);
  s = doIt(s, "start", 1);
  s = waitFor(s, s.bench.readyAt);
  s = doIt(s, "serve", 1);
  s = waitFor(s, at(s, 1).checkoutAt);
  const checkout = find(s, "checkout", 1);
  s = stepFloorShift(s, checkout.id);
  assert.equal(s.sales, 2500);
  assert.equal(s.ledger[0].shisha, 1600);
  assert.equal(s.ledger[0].extra, 0);
  assert.equal(s.served, 1);
  assert.equal(s.matched, 1);
  assert.ok(Number.isInteger(s.anchorIndex));
  assert.equal(stepFloorShift(s, checkout.id), s);
  const final = doIt(s, "finish");
  assert.equal(final.sales, 2500);
  assert.equal(final.ledger.length, 1);
});

test("an unresolved or rejected correction waives only the shisha; unserved parties pay nothing", () => {
  const wrong = serveFirst(createFloorShift(), { match: false });
  assert.equal(doIt(wrong, "finish").sales, 900);
  let s = doIt(wrong, "decline", 1);
  s = doIt(s, "checkout", 1);
  assert.equal(s.sales, 900);
  assert.equal(s.ledger[0].shisha, 0);
  assert.equal(s.ledger[0].extra, 0);
  s = doIt(createFloorShift(), "seat", 1);
  assert.equal(doIt(s, "finish").sales, 0);
  assert.equal(doIt(s, "finish").missed, 1);
});

test("natural expiry is inclusive, frees workbench/ready shelf, never serves empty or reused tables", () => {
  let s = doIt(createFloorShift(), "seat", 1);
  s = doIt(s, "order", 1, at(s, 1).guest.preferredRecipeId);
  s = doIt(s, "start", 1);
  s = waitFor(s, at(s, 1).due);
  assert.equal(at(s, 1).phase, "ready");
  assert.equal(at(doIt(s, "serve", 1), 1).firstServed, true);
  const oldServe = find(s, "serve", 1);
  s = doIt(s, "wait");
  assert.equal(at(s, 1).phase, "dirty");
  assert.equal(s.shelf, null);
  assert.equal(s.sales, 0);
  assert.equal(stepFloorShift(s, oldServe.id), s);
});

test("free care neither charges nor accidentally offers extra; quiet table never asks for greetings", () => {
  let s = serveFirst(createFloorShift());
  s = waitFor(s, at(s, 1).careAt);
  assert.equal(at(s, 1).request, "無料ケア");
  assert.equal(find(s, "extra", 1), undefined);
  s = doIt(s, "care", 1);
  assert.equal(s.care, 1);
  s = doIt(s, "finish");
  assert.equal(s.sales, 2500);
  assert.equal(s.ledger[0].extra, 0);
  assert.equal(s.ledger[0].handedOff, true);
  let quiet = createFloorShift();
  quiet = doIt(quiet, "seat", 1);
  quiet = waitFor(quiet, 3);
  quiet = doIt(quiet, "seat", 2);
  quiet = waitFor(quiet, 5);
  assert.equal(quiet.waiting[0].quiet, true);
  quiet = serveFirst(quiet, { tableId: 3 });
  assert.equal(at(quiet, 3).guest.quiet, true);
  assert.deepEqual(floorActions(quiet).filter(x => x.tableId === 3), []);
});

test("the sharing party's requested paid top is charged once, only if accepted AND delivered", () => {
  let s = createFloorShift();
  for (const table of [1, 2, 3]) {
    s = waitFor(s, table * 2 - 1);
    s = doIt(s, "seat", table);
  }
  s = waitFor(s, 7);
  s = serveFirst(s, { tableId: 4 });
  assert.equal(at(s, 4).guest.party, 2);
  assert.equal(find(s, "extra", 4), undefined, "cannot upsell unprompted");
  s = waitFor(s, at(s, 4).extraAt);
  assert.equal(at(s, 4).request, "追加希望");
  const no = doIt(s, "decline", 4);
  assert.equal(doIt(no, "finish").sales, 3400);
  s = doIt(s, "extra", 4);
  assert.equal(doIt(s, "finish").sales, 3400, "accepted but not served");
  s = doIt(s, "start", 4);
  s = waitFor(s, s.bench.readyAt);
  s = doIt(s, "serve", 4);
  assert.equal(s.sales, 0, "no automatic pay on delivery");
  s = waitFor(s, at(s, 4).checkoutAt);
  s = doIt(s, "checkout", 4);
  assert.equal(s.sales, 4200);
  assert.equal(s.extras, 1);
  assert.equal(s.ledger[0].shisha, 1600);
  assert.equal(s.ledger[0].extra, 800);
});

test("inactivity never runs wall time; bounded wait exits without imaginary sale", () => {
  const initial = createFloorShift();
  const s = waitFor(initial, initial.maxTurns + 1);
  assert.equal(initial.turn, 1);
  assert.equal(s.done, true);
  assert.ok(s.turn <= initial.maxTurns);
  assert.equal(s.sales, 0);
  assert.equal(s.missed, 6);
  assert.deepEqual(floorActions(s), []);
});

test("the hard turn cap hands off served but unpaid tables and rolls up each bill once", () => {
  let s = serveFirst(createFloorShift());
  s = waitFor(s, s.maxTurns + 1);
  assert.equal(s.done, true);
  assert.equal(s.turn, s.maxTurns);
  assert.equal(s.sales, 2500);
  assert.equal(s.ledger.length, 1);
  assert.equal(s.ledger[0].handedOff, true);
});
