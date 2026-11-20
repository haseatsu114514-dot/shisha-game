// 心得の盤のキーボード操作（#1801 U4）と「同じ効果」の一文（#1801 U2）。
// MENU から開いた盤は aria-modal の窓で、焦点が盤の中へ移り、Tab・Shift+Tab は盤の中だけを回る。
// 描き直し（盤の切替・横棒・倍率・灯す・取り消す・結界が解けた後の描き直し・確認の「戻る」）でも焦点は盤の外へ落ちず、
// 閉じると開く前の MENU のボタンへ戻る。K13「声援」は ✦「弾消しで回復」と同じ効き目なので、持っていれば「重ねても増えない」と出す。
// PC（1280×720）とスマホ横（844×390・タッチ）。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const shot = (name) => `/tmp/board-focus-${name}.png`;

/** 今の焦点: 盤の中か・どの部品か（data-test） */
const focused = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { inBoard: !!a?.closest?.('[data-test="growth-board"]'), inModal: !!a?.closest?.("#modal"), test: a?.dataset?.test || a?.tagName || null };
});
/** 盤の中で Tab が止まる部品（表示されていて押せるもの）の data-test を DOM 順に */
const tabStops = (page) => page.evaluate(() => [...document.querySelector('[data-test="growth-board"]').querySelectorAll(
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
)].filter((n) => n.getClientRects().length).map((n) => n.dataset.test || n.textContent));

async function setup(page, { nodes = [], seenRing = 5 } = {}) {
  await page.evaluate(async ({ nodes, seenRing }) => {
    const core = await import("./js/core/state.js"), growth = await import("./js/core/growth.js"), board = await import("./js/core/growth-board.js");
    const { openMenu } = await import("./js/daily/menu.js"), hud = await import("./js/daily/hud.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 5, day: 3, slot: 1, stamina: 90 });
    const mental = board.NODES.find((n) => n.feature === "mental").id;
    Object.assign(growth.ensureGrowth(), { hidane: { any: 30, body: 0, sense: 0, wisdom: 0 }, earned: 30, seenRing, ringsOpen: 5,
      nodes: nodes.map((id) => id === "mental" ? mental : id) });
    window.F = { core, growth, mental, openBoard: (await import("./js/daily/growth-board-screen.js")).openBoard };
    (await import("./js/core/ui.js")).clearScreen(); // タイトル画面の Enter（はじめから）を残さない
    hud.initHud({ menu: () => { window.F.menu = openMenu({ tab: "status" }); } });
    hud.showHud();
  }, { nodes, seenRing });
}

/** 焦点が盤の中にあり、ある部品にあることを確かめる */
async function expectFocus(page, test, label) {
  const f = await focused(page);
  assert(f.inBoard, `${label}: focus left the board (${JSON.stringify(f)})`);
  if (test instanceof RegExp) assert.match(f.test, test, label);
  else if (test) assert.equal(f.test, test, label);
  return f;
}

await suite("board-focus", async (check) => {
  for (const touch of [false, true]) {
    const label = touch ? "touch" : "desktop";
    await check(`${label}-menu-board-keyboard`, async (page) => {
      await setup(page, { nodes: ["mental"] });
      // MENU をキーボードで開き、ステータスの「心得の盤」を選ぶ（MENU は閉じてから盤が開く）
      await page.locator(t("hud-menu")).focus();
      await page.keyboard.press("Enter");
      await page.locator(t("menu-board")).waitFor();
      await page.locator(t("menu-board")).focus();
      await page.keyboard.press("Enter");
      const board = page.locator(`${t("growth-board")}[data-mode="view"][data-art]`);
      await board.waitFor();
      assert.equal(await board.getAttribute("role"), "dialog");
      assert.equal(await board.getAttribute("aria-modal"), "true", "The board is a modal dialog");
      await expectFocus(page, "board-tab-body", "Opening moves focus to the current board's tab");

      // Tab・Shift+Tab は盤の中だけを回る（端で反対の端へ）
      const stops = await tabStops(page);
      assert(stops.length > 10, JSON.stringify(stops));
      await page.locator(t(stops[0])).focus();
      await page.keyboard.press("Shift+Tab");
      await expectFocus(page, stops.at(-1), "Shift+Tab on the first stop wraps to the last");
      await page.keyboard.press("Tab");
      await expectFocus(page, stops[0], "Tab on the last stop wraps to the first");
      for (let i = 0; i < stops.length + 2; i++) {
        await page.keyboard.press("Tab");
        await expectFocus(page, null, `Tab ${i + 1}/${stops.length + 2}`);
      }
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press("Shift+Tab");
        await expectFocus(page, null, `Shift+Tab ${i + 1}`);
      }

      // 盤の切替（全部描き直す）: 押した札に焦点が残る
      await page.locator(t("board-tab-sense")).focus();
      await page.keyboard.press("Enter");
      await expectFocus(page, "board-tab-sense", "Switching boards keeps focus on the pressed tab");
      assert.equal(await page.locator(t("board-tab-sense")).getAttribute("aria-selected"), "true");
      // 横棒（右のパネルだけ描き直す）: 押した棒に焦点が残る
      const bar = page.locator(".gb-bar").first();
      const barTest = await bar.getAttribute("data-test");
      await bar.focus();
      await page.keyboard.press("Enter");
      await expectFocus(page, barTest, "Opening a bar's note keeps focus on that bar");
      assert.equal(await page.locator(t(barTest)).getAttribute("aria-expanded"), "true");
      // 「全体」は押すと使えなくなる: 焦点は隣の使えるボタンへ
      await page.locator(t("board-zoom-fit")).focus();
      await page.keyboard.press("Enter");
      assert(await page.locator(t("board-zoom-fit")).isDisabled());
      await expectFocus(page, "board-zoom-in", "A zoom button that becomes disabled hands focus to an enabled one");

      // U2: ✦「弾消しで回復」を持っている時、K13「声援」は重ねても増えない（持っている側には出さない）
      await page.locator(t(`board-node-${await page.evaluate(() => window.F.mental)}`)).focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(t("board-overlap")).count(), 0, "The owned ✦ square has no overlap note");
      await page.locator(t("board-tab-body")).focus();
      await page.keyboard.press("Enter");
      await page.locator(t("board-node-K13")).focus();
      await page.keyboard.press("Enter");
      await expectFocus(page, "board-node-K13", "Selecting a square keeps focus on it");
      const note = page.locator(t("board-overlap"));
      assert.equal(await note.innerText(), "同じ効果の✦「弾消しで回復」を習得済み。重ねても増えない");
      assert(await note.isVisible(), "The overlap note is visible in the side panel");
      const box = await note.boundingBox(), side = await page.locator(t("board-preview")).boundingBox();
      assert(box.x >= side.x - 1 && box.x + box.width <= side.x + side.width + 1, `The note stays inside the panel ${JSON.stringify({ box, side })}`);
      assert.match(await page.locator(t("board-preview")).innerText(), /火種7/, "K13 keeps its fire cost");
      await page.screenshot({ path: shot(`${label}-overlap`) });

      // 閉じる（Escape）: 開く前の MENU のボタンへ戻る
      await page.keyboard.press("Escape");
      await page.locator(t("growth-board")).waitFor({ state: "detached" });
      assert.equal((await focused(page)).test, "hud-menu", "Closing returns focus to the MENU button");
    }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});

    await check(`${label}-light-redraws-keep-focus`, async (page) => {
      // 第4章で最後に開いた盤を第5章で開く: 3.2秒後に結界の光を消して描き直す
      await setup(page, { seenRing: 4 });
      await page.locator(t("hud-menu")).focus();
      await page.evaluate(() => { window.F.done = window.F.openBoard({ place: "kannon" }); });
      await page.locator(`${t("growth-board")}[data-mode="light"][data-art]`).waitFor();
      await page.locator(t("board-opened")).waitFor();
      const start = await expectFocus(page, /^board-tab-/, "Opening to light moves focus to a board tab");
      await page.locator(t("board-opened")).waitFor({ state: "detached", timeout: 6000 });
      await page.waitForTimeout(150);
      await expectFocus(page, start.test, "The redraw after the chapter banner keeps focus");

      // 灯す（全部描き直す。押したボタンは消える）: 焦点は灯したマスか、自動で選んだ隣のマスへ
      const node = page.locator('.gb-node[data-status="available"]').first();
      await node.focus();
      await page.keyboard.press("Enter");
      await page.locator(t("board-light")).focus();
      await page.keyboard.press("Enter");
      await page.locator('.gb-node[data-status="pending"]').first().waitFor();
      await expectFocus(page, /^board-node-/, "Lighting moves focus to a square, not out of the board");
      // Escape → 確認の「戻る」: 焦点は盤の中へ戻る
      await page.keyboard.press("Escape");
      const back = page.locator("#modal.show .modal-box button", { hasText: "戻る" });
      await back.waitFor();
      assert((await focused(page)).inModal, "The confirmation takes focus");
      await back.focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.querySelector("#modal.show"));
      await expectFocus(page, /^board-node-/, "「戻る」 returns focus into the board");
      // 取り消す（押したボタンは消える）
      await page.locator(t("board-reset")).focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator('.gb-node[data-status="pending"]').count(), 0);
      await expectFocus(page, null, "Resetting keeps focus in the board");
      await page.screenshot({ path: shot(`${label}-light`) });
      // ×で閉じる: 開く前の MENU のボタンへ戻る
      await page.locator(t("board-close")).focus();
      await page.keyboard.press("Enter");
      await page.evaluate(() => window.F.done);
      assert.equal((await focused(page)).test, "hud-menu", "Closing returns focus to where it was before opening");
    }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});
  }
}, { acknowledgeGrowth: false });
