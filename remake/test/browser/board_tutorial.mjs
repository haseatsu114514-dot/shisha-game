// 心得の盤のはじめての案内（growth-board-tutorial.js・2026-11-02 オーナー）: キャラの台詞ではなく画面の部品を光らせて説明し、
// 最初の火種（白火6）で実際に灯す。観音堂は火種が0でも初回だけ開ける。済んだら二度と出さない。飛ばすこともできる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;

async function openKannon(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 3, slot: 1, stamina: 90 });
    s.met.adam = true; s.flags._spot_guide_adam = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    (await import("./js/vn/engine.js")).vnTest.turbo = true;
    window.T = { core, growth: await import("./js/core/growth.js") };
    window.T.run = window.T.growth.reflectAtSpot("kannon", { boardOnly: true });
  });
  await page.locator(t("kannon-reflect")).click();
  await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor({ timeout: 60000 });
}
const hidane = (page) => page.evaluate(() => window.T.core.state.growth.hidane.any);
const flags = (page) => page.evaluate(() => ({ starter: !!window.T.core.state.flags._board_starter_given,
  done: !!window.T.core.state.flags._board_tutorial_done }));

await suite("board-tutorial", async (check) => {
  await check("first-board-explains-step-by-step-with-starter-fire", async (page) => {
    await openKannon(page);
    // 火種が0でも、はじめての観音堂では盤が開き、最初の白火を6つもらえる
    await page.locator(t("board-tutorial")).waitFor();
    assert.equal(await hidane(page), 6);
    assert.deepEqual(await flags(page), { starter: true, done: false });
    for (let n = 0; n < 3; n++) await page.locator(t("board-tutorial-next")).click(); // 盤・火種・3枚の盤
    // 光っているマスを押す → 「灯す」を押す（どちらも押すと次へ進む）
    const target = await page.locator(".gb-node.s-available").first().getAttribute("data-test");
    await page.locator(t(target)).click();
    await page.locator(".gb-light").click();
    await page.locator(`${t(target)}[data-status="pending"]`).waitFor();
    await page.locator(t("board-tutorial-next")).click(); // 続けて灯す
    await page.locator(t("board-tutorial-next")).click(); // 決定
    await page.locator(t("board-tutorial-done")).click(); // くわしい決まり → 灯しはじめる
    assert.equal(await page.locator(t("board-tutorial")).count(), 0);
    assert.deepEqual(await flags(page), { starter: true, done: true });
    await page.locator(t("board-decide")).click();
    await page.locator(t("growth-board")).waitFor({ state: "detached" });
    const after = await page.evaluate(() => ({ nodes: window.T.core.state.growth.nodes.length, fire: window.T.core.state.growth.hidane.any }));
    assert.equal(after.nodes, 1, "One square is lit through the tutorial");
    assert.equal(after.fire, 5, "The rest of the starter fire stays");
    // 二度目は案内も最初の火種も無い
    await page.evaluate(() => { window.T.run = window.T.growth.reflectAtSpot("kannon", { boardOnly: true }); });
    await page.locator(t("kannon-reflect")).click();
    await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor();
    assert.equal(await page.locator(t("board-tutorial")).count(), 0, "The tutorial runs once");
    assert.equal(await hidane(page), 5, "The starter fire is given once");
  });

  await check("tutorial-can-be-skipped-and-keeps-the-starter-fire", async (page) => {
    await openKannon(page);
    await page.locator(t("board-tutorial-skip")).click();
    assert.equal(await page.locator(t("board-tutorial")).count(), 0);
    assert.deepEqual(await flags(page), { starter: true, done: true });
    assert.equal(await hidane(page), 6);
  });
}, { boardTutorial: true, acknowledgeGrowth: false }); // 盤を自分で操作する（自動で「決定」を押さない）
