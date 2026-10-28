// チュートリアル改善パイロット: 穴あけ工程の実プレイを CDP スクリーンキャストで撮影する。
// 通常の合否テストではなく「実演デモの撮影」が目的。フレームは .codex/artifacts/demo-record-holes/
// に JPEG 連番＋マニフェスト（相対時刻つき）で保存され、CI の artifact から取得できる。
// ローカルで Chromium が起動できる環境では remake/test/browser/ に置いて直接実行してもよい。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite } from "./support.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const outDir = path.join(root, ".codex/artifacts/demo-record-holes");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ページ内パンチループ: 現在リングの未達マーカーが無くなるまで、
// カーソル（回る光）がマーカーに重なった瞬間にフォイルへ pointerdown を送る。
const PUNCH_UNTIL_RING_DONE = () => new Promise((resolve) => {
  const disc = document.querySelector('[data-test="foil"]');
  if (!disc) return resolve({ punches: 0, error: "no-foil" });
  const cursor = disc.querySelector(".foil-cursor");
  const ang = (el) => Math.atan2(parseFloat(el.style.top) - 50, parseFloat(el.style.left) - 50);
  const diff = (a, b) => { let d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d; };
  let punches = 0;
  const iv = setInterval(() => {
    const markers = [...disc.querySelectorAll(".foil-marker.cur")];
    const plan = document.querySelector('[data-test="hole-plan"]')?.textContent || "";
    if (!markers.length && plan.includes("完成")) { clearInterval(iv); resolve({ punches, plan }); return; }
    if (!markers.length) return;
    const ca = ang(cursor);
    let best = Infinity;
    for (const m of markers) best = Math.min(best, diff(ca, ang(m)));
    if (best < 0.022) {
      disc.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
      punches++;
    }
  }, 16);
  setTimeout(() => { clearInterval(iv); resolve({ punches, timeout: true }); }, 90000);
});

await suite("demo-record-holes", async (check) => {
  await check("record", async (page) => {
    page.setDefaultTimeout(60000);
    fs.mkdirSync(outDir, { recursive: true });

    // ---- スクリーンキャスト開始（フレームは ~11fps に間引いて保存）
    const cdp = await page.context().newCDPSession(page);
    const frames = [];
    let firstTs = null;
    let lastKept = 0;
    cdp.on("Page.screencastFrame", async (ev) => {
      try { await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }); } catch {}
      const ts = ev.metadata.timestamp;
      if (firstTs === null) firstTs = ts;
      if (ts - lastKept < 0.09) return;
      lastKept = ts;
      const file = `frame-${String(frames.length + 1).padStart(5, "0")}.jpg`;
      fs.writeFileSync(path.join(outDir, file), Buffer.from(ev.data, "base64"));
      frames.push({ file, t: Math.round((ts - firstTs) * 1000) / 1000 });
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 60, maxWidth: 960, maxHeight: 540, everyNthFrame: 2 });

    try {
      // ---- 状態を用意し、チュートリアルモードで穴あけ工程を開始（実フロー）
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        const session = await import("./js/craft/session.js");
        const holes = await import("./js/craft/holes.js");
        const ui = await import("./js/core/ui.js");
        const s = core.newGame();
        s.flavors.push("double_apple", "mint");
        s.flavorStock = { double_apple: 50, mint: 50 };
        s.equip.hms = "tanukish_lid"; // アルミを使う HMD（ロートスは穴あけ自体が無い）
        if (!s.owned.includes("tanukish_lid")) s.owned.push("tanukish_lid");
        ui.clearScreen();
        const cs = session.newSession("tutorial");
        window.__cs = cs;
        session.openBench(cs, { steps: [["holes", "FOIL"]] });
        window.__holes = holes.runHoles(cs).then(() => "done").catch((e) => "err: " + e.message);
      });

      // ---- テンプレート選択 → 開始（実マウス操作）
      const tpl = page.locator('[data-test="hole-template-outer12-middle12"]');
      await tpl.waitFor({ timeout: 60000 });
      await sleep(1500);
      await tpl.click();
      await sleep(1200);
      await page.locator('[data-test="hole-start"]').click();
      await page.locator('[data-test="foil"]').waitFor({ timeout: 30000 });
      await sleep(600);

      // ---- リングを順に打ち切る
      for (let ring = 0; ring < 3; ring++) {
        const r = await page.evaluate(PUNCH_UNTIL_RING_DONE);
        console.log(`[demo-record-holes] ring ${ring + 1}:`, JSON.stringify(r));
        await sleep(900);
        const doneBtn = page.locator('[data-test="hole-done"]');
        if (await doneBtn.isEnabled().catch(() => false)) { await doneBtn.click(); break; }
        const nextBtn = page.locator('[data-test="hole-next"]');
        if (await nextBtn.isEnabled().catch(() => false)) { await nextBtn.click(); await sleep(800); continue; }
        break;
      }

      // ---- 結果カードを確認して閉じる（runHoles の完走条件）
      const confirmBtn = page.getByRole("button", { name: "確認して次の工程へ" });
      await confirmBtn.waitFor({ timeout: 30000 });
      await sleep(2000); // 結果カードを映像に残す
      await confirmBtn.click();
      const result = await Promise.race([
        page.evaluate(() => window.__holes),
        sleep(20000).then(() => "timeout-waiting"),
      ]);
      console.log("[demo-record-holes] runHoles:", result);
      assert.equal(result, "done");
      await sleep(1000);
    } finally {
      await cdp.send("Page.stopScreencast").catch(() => {});
      fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ frames, count: frames.length }, null, 2) + "\n");
      console.log(`[demo-record-holes] frames saved: ${frames.length}`);
    }
    assert(frames.length > 100, `expected a real recording, got ${frames.length} frames`);
  });
});
