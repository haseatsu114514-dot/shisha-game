// #1044 A10後半: 「見た演出を短く」設定の確認。
// 設定画面でオン/オフを切り替えて保存されること、オンのときシフト終了の演出が
// 初回はフル（採用パターン b のコイン）、2回目以降は短縮（brief の CLOSED 札だけ）になること。
// 初回は設定がオンでも必ずフルで見せる。PC と横持ちの両方で確認する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function startGame(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const title = await import("./js/scenes/title.js");
    core.loadConfig();
    core.config.shortSeen = false;
    core.saveConfig();
    core.newGame();
    core.save();
    title.showTitle();
  });
  await page.locator('[data-test="title-config"]').waitFor();
}

// 設定画面の「見た演出を短く」をオン/オフにして、config に保存されることを確かめる。
async function setShortSeen(page, on) {
  await page.locator('[data-test="title-config"]').click();
  await page.locator('#modal.show .cfg').waitFor();
  const box = page.locator('[data-test="cfg-short-seen"]');
  if ((await box.isChecked()) !== on) await box.click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_config")).shortSeen);
  assert.equal(stored, on, `config.shortSeen must persist as ${on}`);
  await page.locator('[data-test="cfg-close"]').click();
  await page.locator("#modal.show").waitFor({ state: "hidden" });
}

// シフト終了の演出を1回再生し、フル（.mo-coin）か短縮（.mo-sign のみ）かを返す。
async function runShift(page) {
  await page.evaluate(async () => {
    const m = await import("./js/core/scene-motions.js");
    window.__shiftDone = false;
    window.__shiftP = m.shiftClose().then(() => { window.__shiftDone = true; });
  });
  await page.locator("#fx .mo-shift").waitFor({ timeout: 6000 });
  await page.waitForTimeout(260);
  const kind = await page.evaluate(() => {
    const n = document.querySelector("#fx .mo-shift");
    if (!n) return "gone";
    if (n.querySelector(".mo-coin")) return "full";
    return n.querySelector(".mo-sign") ? "brief" : "?";
  });
  await page.evaluate(() => window.__shiftP);
  return kind;
}

await suite("short_seen", async (check) => {
  for (const [label, viewport] of [["pc", { width: 1280, height: 720 }], ["landscape", { width: 844, height: 390 }]]) {
    await check(label, async (page) => {
      await startGame(page);

      // 設定をオンにしても、初回のシフト終了は必ずフルで見せる。
      await setShortSeen(page, true);
      assert.equal(await runShift(page), "full", "first shift close must stay full even with shortSeen on");
      const seen = await page.evaluate(async () => (await import("./js/core/state.js")).state.flags._motion_seen_shift);
      assert.equal(seen, true, "seeing the full motion records it");

      // 2回目以降は短縮表示。
      assert.equal(await runShift(page), "brief", "second shift close is shortened when shortSeen is on");

      // 設定をオフに戻すと、見た演出でもまたフルに戻る。
      await setShortSeen(page, false);
      assert.equal(await runShift(page), "full", "shift close is full again when shortSeen is off");
    }, { viewport });
  }
});
