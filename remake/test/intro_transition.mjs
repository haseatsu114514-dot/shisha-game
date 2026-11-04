// 立ち絵からカットインへの変身のつなぎ（intro-transition.js）。3案とも、立ち絵のある会話画面で
// 本人のカットインが出て閉じ、つなぎの部品が残らない。動きを減らす設定ではフェードだけ。
// サーバーを8123で起動後: node remake/test/intro_transition.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const base = process.env.BASE_URL || "http://127.0.0.1:8123";
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 804 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/remake/intro-transition-preview.html?character=naru`);
  await page.waitForFunction(() => !document.getElementById("play").disabled);
  const cases = [["morph", "naru"], ["card", "nagumo"], ["slash", "rin"], ["morph", "pakki"], ["none", "naru"]];
  for (const [variant, id] of cases) {
    await page.selectOption("#variant", variant);
    await page.selectOption("#character", id);
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__seen = { transition: 0, cutin: 0, silhouette: 0 };
      window.__obs?.disconnect();
      window.__obs = new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => {
        if (n.classList?.contains("ci-transition")) __seen.transition++;
        if (n.classList?.contains("cutin")) __seen.cutin++;
        if (n.querySelector?.(".ci-tr-sil") || n.classList?.contains("ci-tr-sil")) __seen.silhouette++;
      })));
      __obs.observe(document.getElementById("fx"), { childList: true, subtree: true }); });
    const started = Date.now();
    await page.click("#play");
    await page.waitForSelector(`.cutin.art-intro[data-char="${id}"]`, { timeout: 8000 });
    assert.equal(await page.locator("#vn").evaluate((node) => node.classList.contains("intro-morph-dialog-hidden")),
      variant === "morph", `${variant}/${id}: 会話ウィンドウの退避`);
    // つなぎの間も、クリック・Enterで短縮できない
    await page.mouse.click(640, 360); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("再生終了"), null, { timeout: 20000 });
    const elapsed = Date.now() - started;
    const seen = await page.evaluate(() => __seen);
    const left = await page.evaluate(() => ({
      transition: document.querySelectorAll(".ci-transition").length, cutin: document.querySelectorAll(".cutin").length,
      surface: document.querySelectorAll(".intro-fit-surface").length,
      portraitOpacity: getComputedStyle(document.querySelector(".vn-portraits img.portrait")).opacity,
      dialogueHidden: document.querySelector("#vn").classList.contains("intro-morph-dialog-hidden"),
    }));
    assert.equal(seen.cutin, 1, `${variant}/${id}: カットインが一度だけ出る`);
    assert.equal(seen.transition > 0, variant !== "none", `${variant}/${id}: つなぎの部品の有無`);
    if (variant === "morph") assert(seen.silhouette > 0, `${variant}/${id}: 影を作る`);
    assert.deepEqual(left, { transition: 0, cutin: 0, surface: 0, portraitOpacity: "1", dialogueHidden: false }, `${variant}/${id}: 終わった後に部品が残る・立ち絵が戻らない ${JSON.stringify(left)}`);
    assert(elapsed > 4000, `${variant}/${id}: 短縮されている（${elapsed}ms）`);
  }
  // 動きを減らす設定: 影も一閃も作らず、暗転とフェードだけ
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.selectOption("#variant", "morph"); await page.selectOption("#character", "naru");
  await page.evaluate(() => { window.__seen = { silhouette: 0, edge: 0 };
    window.__obs?.disconnect();
    window.__obs = new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => {
      if (n.querySelector?.(".ci-tr-sil,.ci-tr-edge,.ci-tr-card")) __seen.silhouette++;
    })));
    __obs.observe(document.getElementById("fx"), { childList: true, subtree: true }); });
  await page.click("#play");
  await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("再生終了"), null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => __seen.silhouette), 0, "動きを減らす設定で影や一閃を作った");
  // 外側のステージも縮む画面で、影と最終カットインの実際の顔位置が一致する。
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const { id, viewport, standingFace, graphicFace } of [
    { id: "naru", viewport: { width: 844, height: 474 }, standingFace: 450.5, graphicFace: 464 },
    { id: "kuze", viewport: { width: 390, height: 844 }, standingFace: 421.5, graphicFace: 528 },
  ]) {
    await page.setViewportSize(viewport);
    await page.selectOption("#variant", "morph");
    await page.selectOption("#character", id);
    await page.waitForTimeout(400);
    await page.click("#play");
    await page.waitForSelector(`.cutin.in[data-char="${id}"]`);
    const faceGap = await page.evaluate(({ standingFace, graphicFace }) => {
      const standing = document.querySelector(".ci-tr-sil").getBoundingClientRect();
      const graphic = document.querySelector(".cutin .ci-portrait").getBoundingClientRect();
      return standing.left + standing.width * standingFace / 896
        - graphic.left - graphic.width * graphicFace / 1024;
    }, { standingFace, graphicFace });
    assert(Math.abs(faceGap) < 2, `${id}/${viewport.width}: 影とカットインの顔がずれる（${faceGap}px）`);
    await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("再生終了"), null, { timeout: 20000 });
  }
  assert.deepEqual(errors, []);
  console.log("OK intro_transition: 3案とも立ち絵からカットインへつながり、部品が残らず、動きを減らす設定ではフェードだけ");
} finally {
  await browser.close();
}
