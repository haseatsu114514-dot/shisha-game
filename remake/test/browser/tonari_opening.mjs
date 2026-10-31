// 冒頭の実台本・通常送り・中断・SKIP・画像欠落とプレビューの保存非干渉。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite, assertFits, storageSnapshot as rawStorageSnapshot } from "./support.mjs";
// #1950: 既読SKIP用の既読記録は端末設定として意図して保存される。セーブ・スロット・セッションの不変だけを確かめる。
const SEEN_LINES_KEY = "suien_remake_seen_dialogue_lines";
async function storageSnapshot(page) { const snap = await rawStorageSnapshot(page); delete snap.local[SEEN_LINES_KEY]; return snap; }

const captures = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");
fs.mkdirSync(captures, { recursive: true });

async function setup(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const vn = await import("./js/vn/engine.js");
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const opening = await import("./js/scenes/tonari-opening.js");
    core.newGame();
    core.config.textSpeed = 4;
    core.state.flags._intro_hajime = core.state.flags._intro_sumi = true;
    ui.clearScreen();
    window.O531 = { core, vn, data, opening, cues: [], lines: [], done: false };
    O531.previous = (id, line) => {
      O531.lines.push({ id, text: line.text });
      if (line.shot) O531.cues.push(line.shot);
    };
    vn.hooks.onLine = O531.previous;
    O531.launch = options => {
      O531.controller = new AbortController();
      O531.promise = opening.playTonariOpening({ signal: O531.controller.signal, ...options })
        .then(result => { O531.result = result; O531.done = true; });
    };
  });
}

async function assertClean(page) {
  assert.equal(await page.locator(".tonari-opening").count(), 0);
  assert(await page.evaluate(() => O531.vn.hooks.onLine === O531.previous), "Previous line hook was not restored");
}

await suite("tonari-opening", async check => {
  for (const [label, options] of [["desktop", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${label}-normal-cuts`, async page => {
      await setup(page);
      await page.evaluate(() => O531.launch());
      await page.locator('.tonari-opening[data-shot="room"]').waitFor();
      const saved = new Set();
      for (let n = 0; n < 45; n++) {
        const cue = await page.locator(".tonari-opening").getAttribute("data-shot");
        const before = await page.evaluate(() => ({ count: O531.lines.length, text: document.querySelector(".vn-text").textContent }));
        if (!saved.has(cue)) {
          await page.waitForTimeout(720);
          await assertFits(page, ".vn-box, .vn-controls");
          assert.equal(await page.locator(".tonari-opening").evaluate(node => node.parentElement.id), "bg");
          if (["coal", "bowl", "hose", "empty", "lamps"].includes(cue)) {
            await page.screenshot({ path: path.join(captures, `${label}-${cue}.png`) });
          }
          if (cue === "coal") {
            const coal = page.locator("img.to-coal");
            assert.equal(await coal.count(), 1);
            assert(await coal.evaluate(image => image.complete && image.naturalWidth > 1280
              && image.src.endsWith("bg_tonari_opening_coal.webp")), "Adopted single-image coal cut did not decode");
            assert.equal(await page.locator(".to-hand, .to-ember").count(), 0, "Old composite remained");
            await assertFits(page, "img.to-coal");
            // LOGは冒頭のカットや本文を進めず、閉じた後に同じ場面へ戻る。
            await page.locator('[data-test="vn-log"]').click();
            await page.locator(".vn-log.show").waitFor();
            assert.ok((await page.locator(".vn-log .log-row").count()) > 0);
            await assertFits(page, ".log-head button");
            // LOGを開くと「閉じる」にフォーカスが移るので、Enterはそのボタンを押してLOGを閉じる（本文は進めない）。
            assert.equal(await page.evaluate(() => document.activeElement?.textContent), "閉じる");
            await page.keyboard.press("Enter");
            await page.locator(".vn-log.show").waitFor({ state: "hidden" });
            assert.equal(await page.locator(".tonari-opening").getAttribute("data-shot"), cue);
            assert.equal(await page.evaluate(() => O531.lines.length), before.count);
            // 閉じた後はフォーカスがLOGボタンへ戻る。次のEnterで再びLOGを開かないよう外す。
            assert.equal(await page.evaluate(() => document.activeElement?.dataset?.test), "vn-log");
            await page.evaluate(() => document.activeElement?.blur());
          }
          saved.add(cue);
        }
        if (await page.evaluate(() => O531.cues.length === 10)) break; // スミさんで店内の引きへ戻る
        await page.waitForTimeout(65);
        if (label === "touch") await page.locator(".vn-box").tap();
        else await page.keyboard.press("Enter");
        // 長い既存の内心は同じ台詞の2ページ目に進む。onLineはページ送りでは再発火しない。
        await page.waitForFunction(before => O531.lines.length > before.count || document.querySelector(".vn-text").textContent !== before.text, before);
      }
      assert.deepEqual(await page.evaluate(() => O531.cues), ["room", "lamps", "room", "coal", "bowl", "customer", "hose", "depart", "empty", "room"]);
      await page.evaluate(() => { O531.vn.vnTest.turbo = true; });
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => O531.done);
      await assertClean(page);
      // 次の会話にも前のフックが届く。手元の絵は出ない。
      await page.evaluate(() => O531.vn.play({ dialogue_id: "__after_opening", lines: [{ speaker: "", text: "次の場面。" }] }));
      assert(await page.evaluate(() => O531.lines.at(-1).id === "__after_opening"));
      await assertClean(page);
    }, options);
  }

  await check("skip-reduced-motion-and-abort", async page => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setup(page);
    await page.evaluate(() => O531.launch());
    await page.locator('.tonari-opening[data-shot="room"]').waitFor();
    assert(await page.locator(".tonari-opening *").evaluateAll(nodes => nodes.every(node => {
      const style = getComputedStyle(node);
      return style.animationName === "none" && style.transitionDuration === "0s";
    })));
    await page.locator('[data-test="vn-skip"]').click();
    await page.locator(".vn-choices.show").waitFor();
    assert(await page.evaluate(() => ["coal", "bowl", "hose", "empty"].every(cue => O531.cues.includes(cue))));
    await page.evaluate(() => O531.controller.abort());
    await page.waitForFunction(() => O531.done);
    assert(await page.evaluate(() => O531.result.cancelled));
    await assertClean(page);
  });

  await check("missing-insert-keeps-dialogue-playable", async page => {
    await setup(page);
    await page.route("**/bg_tonari_customer_hands.webp", route => route.fulfill({ status: 200, contentType: "image/png", body: "invalid image" }));
    await page.evaluate(() => {
      const source = O531.data.DB.dialogues.ch1_opening;
      O531.launch({ dialogue: { ...source, lines: source.lines.filter(line => line.shot === "hose"), branches: {} } });
    });
    await page.locator("#vn.active").waitFor();
    assert.equal(await page.locator(".tonari-opening").getAttribute("data-shot"), "room");
    assert.equal(await page.locator(".to-customer").count(), 0);
    await page.waitForTimeout(350);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => O531.done);
    await assertClean(page);
  });

  await check("missing-coal-keeps-dialogue-playable", async page => {
    await setup(page);
    await page.route("**/bg_tonari_opening_coal.webp", route => route.fulfill({ status: 200, contentType: "image/png", body: "invalid image" }));
    await page.evaluate(() => {
      const source = O531.data.DB.dialogues.ch1_opening;
      O531.launch({ dialogue: { ...source, lines: source.lines.filter(line => line.shot === "coal"), branches: {} } });
    });
    await page.locator("#vn.active").waitFor();
    assert.equal(await page.locator(".tonari-opening").getAttribute("data-shot"), "room");
    assert.equal(await page.locator(".to-coal").count(), 0);
    await page.waitForTimeout(350);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => O531.done);
    await assertClean(page);
  });

  await check("preview-start-stop-replay-preserves-storage", async page => {
    await page.evaluate(() => {
      localStorage.setItem("suien_remake_save", JSON.stringify({ sentinel: "keep existing game" }));
      localStorage.setItem("suien_remake_slot1", JSON.stringify({ sentinel: "keep manual save" }));
      sessionStorage.setItem("opening-preview-sentinel", "keep");
    });
    const before = await storageSnapshot(page);
    await page.goto(new URL("opening-preview.html", page.url()).href);
    await page.waitForFunction(() => !document.getElementById("opening-play").disabled);
    for (const shot of ["hose", "coal"]) {
      await page.selectOption("#opening-from", shot);
      await page.click("#opening-play");
      await page.locator(`.tonari-opening[data-shot="${shot}"]`).waitFor();
      if (shot === "coal") {
        await page.locator('[data-test="vn-auto"]').click();
        await page.locator('.tonari-opening[data-shot="bowl"]').waitFor({ timeout: 15000 });
      }
      await page.click("#opening-stop");
      await page.waitForFunction(() => !document.getElementById("opening-play").disabled);
      assert.equal(await page.locator(".tonari-opening").count(), 0);
    }
    assert.deepEqual(await storageSnapshot(page), before);
  });
});
