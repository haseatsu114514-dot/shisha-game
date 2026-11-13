// 心得の盤の母数（分母）は三つの表示で同じ（#2444 の追記「心得の盤の母数」）。
// 盤の画面が 1/27、MENU のステータスが 1/26 と食い違った不具合を 627d12e61（PR #2166）で直し、
// 盤の画面（growth-board-screen.js）・ステータス（status.js）・メニューの盤カード（menu.js）の
// どれも母数に core/growth-board.js の statTotal(k) を使うようにした。退行（誰かが STAT_SQUARES[k] や
// boardNodes の数え直しに戻す）を見逃さないよう、実際に描いた文字列の分母が三表示とも statTotal(k) に
// 等しいことを、火種の進み具合が違う二つの盤の状態で確かめる。テストだけの追加でゲーム本体は変えない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

// 盤の状態を用意して、三つの画面を本物の入口で描き、各盤の分母（"/" の後ろの数）と
// 期待値 statTotal(k) を読み出す。lit は各盤で先に灯しておく能力のマスの数（進み具合）。
async function denominators(page, lit) {
  return page.evaluate(async (lit) => {
    const core = await import("./js/core/state.js");
    const growth = await import("./js/core/growth.js");
    const boardMod = await import("./js/core/growth-board.js");
    const { openBoard } = await import("./js/daily/growth-board-screen.js");
    const { openStatus } = await import("./js/daily/status.js");
    const { openMenu } = await import("./js/daily/menu.js");

    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 3, slot: 1, stamina: 90 });
    const g = growth.ensureGrowth();
    // 各盤の能力のマス（極みを除く）の先頭 lit 個を灯した状態にする（進み具合を作る）
    const nodes = [];
    for (const k of boardMod.BOARD_KEYS) {
      const stats = boardMod.boardNodes(k).filter((n) => n.kind === "stat" && !n.peak).map((n) => n.id);
      nodes.push(...stats.slice(0, lit));
    }
    g.nodes = nodes;

    const expected = Object.fromEntries(boardMod.BOARD_KEYS.map((k) => [k, boardMod.statTotal(k)]));
    const litCount = Object.fromEntries(boardMod.BOARD_KEYS.map((k) => [k, boardMod.statCount(k, new Set(g.nodes))]));
    const denomOf = (text) => { const m = /\/\s*(\d+)/.exec(text || ""); return m ? Number(m[1]) : null; };

    // 盤の画面: 各盤のタブの数と読み上げ、開いている盤の見出し
    openBoard();
    const boardScreen = {};
    for (const k of boardMod.BOARD_KEYS) {
      const tab = document.querySelector(`[data-test="board-tab-${k}"]`);
      boardScreen[k] = {
        count: denomOf(tab?.querySelector(".gb-tab-count")?.textContent),
        aria: denomOf(tab?.getAttribute("aria-label")),
      };
    }
    boardScreen.panelTitle = denomOf(document.querySelector(".gb-p-title")?.textContent);
    boardScreen.panelBoard = document.querySelector(".gb-tab.on")?.dataset.test?.replace("board-tab-", "") || null;

    // MENU のステータス（「ステータス」タブの盤ごとの行）
    openStatus();
    const status = {};
    for (const k of boardMod.BOARD_KEYS) {
      const row = document.querySelector(`[data-test="st-board-${k}"]`);
      status[k] = denomOf(row?.querySelector(".st-count")?.textContent);
    }
    // ステータスの modal を閉じてから MENU を開く
    document.querySelector('[data-test="status-close"]')?.click();

    // MENU の盤カード
    openMenu({ tab: "status" });
    const menu = {};
    for (const k of boardMod.BOARD_KEYS) {
      const row = document.querySelector(`[data-test="menu-board-${k}"]`);
      menu[k] = denomOf(row?.querySelector(".dm-count")?.textContent);
    }

    return { keys: boardMod.BOARD_KEYS, expected, litCount, boardScreen, status, menu };
  }, lit);
}

async function checkState(page, lit) {
  const r = await denominators(page, lit);
  assert(r.keys.length === 3, "盤は3枚");
  for (const k of r.keys) {
    const total = r.expected[k];
    assert(total > 0, `${k}: statTotal は正の数（${total}）`);
    // 進み具合が違っても分母は statTotal(k) のまま
    assert.equal(r.boardScreen[k].count, total, `盤の画面タブ ${k}: 分母が statTotal(${total})`);
    assert.equal(r.boardScreen[k].aria, total, `盤の画面の読み上げ ${k}: 分母が statTotal(${total})`);
    assert.equal(r.status[k], total, `MENUステータス ${k}: 分母が statTotal(${total})`);
    assert.equal(r.menu[k], total, `MENU盤カード ${k}: 分母が statTotal(${total})`);
    // 三表示の分母が完全に一致する（1/27 と 1/26 の食い違いを防ぐ）
    assert.equal(r.status[k], r.boardScreen[k].count, `${k}: 盤の画面と MENUステータスの分母が一致`);
    assert.equal(r.menu[k], r.boardScreen[k].count, `${k}: 盤の画面と MENU盤カードの分母が一致`);
  }
  // 開いている盤の見出しの分母も statTotal
  assert.equal(r.boardScreen.panelTitle, r.expected[r.boardScreen.panelBoard], "開いている盤の見出しの分母も statTotal");
  // 進み具合は意図どおり（分母の検査が「0/0」などで素通りしていないことの保険）
  if (lit > 0) assert(r.keys.some((k) => r.litCount[k] > 0), "進んだ状態では灯した数が 1 以上");
  else assert(r.keys.every((k) => r.litCount[k] === 0), "新規は灯した数が 0");
  return r;
}

await suite("growth-board-denominator", async (check) => {
  await check("fresh-game-shares-one-denominator", async (page) => {
    await checkState(page, 0);
  });
  await check("with-progress-shares-one-denominator", async (page) => {
    await checkState(page, 3);
  });
});
