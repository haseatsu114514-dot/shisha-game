// 標準の場面の切り替え「煙のにじみ」（core/transitions.js smokeCurtain・TMG44）。
// 前の背景を覆わずに煙の形のマスクでほどくこと、ほどけている間は入力と新しい台詞を待たせること、終わったら片付くことを確かめる。
// node remake/test/browser/smoke_dissolve.mjs（プレビューサーバーが必要）
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const tr = await import("./js/core/transitions.js");
    const engine = await import("./js/vn/engine.js");
    window.S = { ui, data, tr, engine };
    ui.clearScreen();
    await tr.warmSmoke();
    await ui.setBg(data.bgUrl("bg_tonari_inside", "night"), { instant: true });
    await ui.imageReady(data.bgUrl("bg_street", "night"), 15000);
    window.keys = 0;
    document.addEventListener("keydown", (e) => { if (e.key === "Enter") keys++; });
  });
}

/** 背景を替え、切り替えの間を毎フレーム見張る */
async function watch(page, run) {
  await page.evaluate((run) => {
    window.audit = { types: [], purple: false, maskedOld: false, bgDuring: 0, done: false, ms: 0 };
    const t0 = performance.now();
    const sample = () => {
      const curtain = document.querySelector(".scene-curtain");
      if (curtain) {
        if (!audit.types.includes(curtain.dataset.transition)) audit.types.push(curtain.dataset.transition);
        if (curtain.querySelector(".tr-svg") || curtain.classList.contains("veil")) audit.purple = true; // 紫の一筆・紫の面
        const bgs = [...document.querySelectorAll("#bg .bg-img")];
        audit.bgDuring = Math.max(audit.bgDuring, bgs.length);
        if (bgs.some((b) => (b.style.maskImage || b.style.webkitMaskImage || "").includes("wipe-a"))) audit.maskedOld = true;
      }
      if (!audit.done) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    const task = run === "vn"
      ? S.engine.play({ dialogue_id: "smoke-dissolve-test", metadata: {}, lines: [
        { type: "bg", bg: "bg_street" },
        { type: "choice", choices: [{ text: "歩く" }] },
      ] })
      : S.ui.setBg(S.data.bgUrl("bg_street", "night"), run === "fast" ? { brief: true } : {});
    if (run !== "vn") task.then(() => { audit.done = true; audit.ms = performance.now() - t0; });
    else window.vnTask = task;
  }, run);
}

async function settled(page) {
  return page.evaluate(() => {
    const bgs = [...document.querySelectorAll("#bg .bg-img")];
    return {
      curtains: document.querySelectorAll(".scene-curtain").length,
      bgs: bgs.length,
      mask: bgs.map((b) => b.style.maskImage || b.style.webkitMaskImage || ""),
      shown: bgs.at(-1)?.style.backgroundImage || bgs.at(-1)?.querySelector("image")?.getAttribute("href") || "",
      opacity: bgs.at(-1) ? getComputedStyle(bgs.at(-1)).opacity : null,
    };
  });
}

await suite("smoke-dissolve", async (check) => {
  for (const [label, run, ms] of [["normal", "normal", [600, 1500]], ["skip", "fast", [300, 1000]]]) {
    await check(label, async (page) => {
      await prepare(page);
      await watch(page, run);
      await page.waitForSelector(".scene-curtain");
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => keys), 0, "Enter leaked through the dissolve");
      await page.waitForFunction(() => audit.done, null, { timeout: 15000 });
      const audit = await page.evaluate(() => window.audit);
      assert.deepEqual(audit.types, ["smoke"], "the standard switch is the smoke dissolve");
      assert.equal(audit.purple, false, "no purple band or purple veil");
      assert.equal(audit.maskedOld, true, "the previous background is dissolved by the smoke mask");
      assert.equal(audit.bgDuring, 2, "both backgrounds exist while dissolving (not covered)");
      assert.ok(audit.ms >= ms[0] && audit.ms <= ms[1], `duration ${Math.round(audit.ms)}ms`);
      const after = await settled(page);
      assert.equal(after.curtains, 0);
      assert.equal(after.bgs, 1, "the old background was removed");
      assert.deepEqual(after.mask, [""], "no mask left on the new background");
      assert.match(after.shown, /bg_street/);
      assert.equal(after.opacity, "1");
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => keys), 1, "input stayed blocked after cleanup");
    });
  }

  await check("dialogue-waits", async (page) => {
    await prepare(page);
    await watch(page, "vn");
    await page.waitForSelector(".scene-curtain");
    // ほどけている間に選択肢が出ない
    const early = await page.evaluate(async () => {
      let seen = false;
      while (document.querySelector(".scene-curtain")) {
        if (document.querySelector(".vn-choice")) seen = true;
        await new Promise((r) => requestAnimationFrame(r));
      }
      return seen;
    });
    assert.equal(early, false, "a choice appeared before the dissolve finished");
    await page.locator(".vn-choice").first().waitFor();
    await page.evaluate(() => { audit.done = true; });
    const audit = await page.evaluate(() => window.audit);
    assert.deepEqual(audit.types, ["smoke"]);
    assert.equal((await settled(page)).bgs, 1);
  });

  await check("reduced-motion", async (page) => {
    await prepare(page);
    await watch(page, "normal");
    await page.waitForFunction(() => audit.done, null, { timeout: 15000 });
    const audit = await page.evaluate(() => window.audit);
    assert.deepEqual(audit.types, ["fade"], "reduced motion fades the old background only");
    assert.equal(audit.purple, false);
    assert.equal(audit.maskedOld, false);
    assert.ok(audit.ms <= 800, `duration ${Math.round(audit.ms)}ms`);
    assert.equal((await settled(page)).bgs, 1);
  }, { reducedMotion: "reduce" });

  await check("back-to-back", async (page) => {
    await prepare(page);
    // ほどけている途中に次の背景が来ても、最後の背景だけが残る
    const result = await page.evaluate(async () => {
      const a = S.ui.setBg(S.data.bgUrl("bg_street", "night"));
      await new Promise((r) => setTimeout(r, 250));
      const b = S.ui.setBg(S.data.bgUrl("bg_tonari_inside", "night"));
      await Promise.all([a, b]);
      await new Promise((r) => setTimeout(r, 100));
      const bgs = [...document.querySelectorAll("#bg .bg-img")];
      return { bgs: bgs.length, curtains: document.querySelectorAll(".scene-curtain").length, last: bgs.at(-1)?.style.backgroundImage || "", mask: bgs.map((x) => x.style.maskImage || "") };
    });
    assert.equal(result.curtains, 0);
    assert.equal(result.bgs, 1);
    assert.match(result.last, /bg_tonari_inside/);
    assert.deepEqual(result.mask, [""]);
  });
});
console.log("PASS smoke-dissolve: standard switch dissolves the old background with the smoke mask (normal/SKIP), waits dialogue, reduced fade, back-to-back cleanup");
