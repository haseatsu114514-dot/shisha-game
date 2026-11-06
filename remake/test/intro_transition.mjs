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
  const cases = [["morph", "naru"], ["card", "sui"], ["slash", "rio"], ["morph", "pakki"], ["none", "naru"]];
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
  // #2688 F10: 同じ人物の2回目以降（既読あり）は、変身（影）を作らず一閃に落とす。読む時間は削らない。
  // 台本で型を明示した紹介はそのまま。未知版を見た後の本来の紹介も「2回目」に数える。
  assert.deepEqual(await page.evaluate(async () => {
    const intro = await import("./js/vn/intro.js"), { state, config } = await import("./js/core/state.js");
    config.introTransition = "morph";
    const before = intro.introSeenBefore("ageha");
    state.flags._intro_ageha_unknown = true;
    const row = { before, afterUnknown: intro.introSeenBefore("ageha"), first: intro.introTransitionFor({}, false),
      repeat: intro.introTransitionFor({}, true), explicit: intro.introTransitionFor({ transition: "morph" }, true) };
    delete state.flags._intro_ageha_unknown;
    config.introTransition = "none";
    row.repeatNone = intro.introTransitionFor({}, true);
    return row;
  }), { before: false, afterUnknown: true, first: "morph", repeat: "slash", explicit: "morph", repeatNone: "none" });
  await page.selectOption("#variant", "morph"); await page.selectOption("#character", "naru");
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__seen = { silhouette: 0, edge: 0, cutin: 0 };
    window.__obs?.disconnect();
    window.__obs = new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => {
      if (n.querySelector?.(".ci-tr-sil") || n.classList?.contains("ci-tr-sil")) __seen.silhouette++;
      if (n.querySelector?.(".ci-tr-edge") || n.classList?.contains("ci-tr-edge")) __seen.edge++;
      if (n.classList?.contains("cutin")) __seen.cutin++;
    })));
    __obs.observe(document.getElementById("fx"), { childList: true, subtree: true }); });
  const repeatStarted = Date.now();
  const repeatElapsed = await page.evaluate(async () => {
    const intro = await import("./js/vn/intro.js"), { state, config } = await import("./js/core/state.js");
    config.introTransition = "morph"; state.flags._intro_naru = true;
    const t = performance.now(); await intro.playIntro("naru"); return performance.now() - t;
  });
  const repeatSeen = await page.evaluate(() => __seen);
  assert.equal(repeatSeen.cutin, 1, "再登場: カットインが一度だけ出る");
  assert.equal(repeatSeen.silhouette, 0, "再登場で変身の影を作った");
  assert(repeatSeen.edge > 0, "再登場で一閃が出ない");
  assert(repeatElapsed > 4000 && Date.now() - repeatStarted > 4000, `再登場で読む時間まで短縮された（${repeatElapsed}ms）`);
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
  // 立ち絵の両目の中心は画風ごとの測定値（data/portrait_metrics.json の characters と styles.new）。表示中の絵の画風で選ぶ。
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const { id, viewport, standingFace, graphicFace } of [
    { id: "naru", viewport: { width: 844, height: 474 }, standingFace: { classic: 450.5, new: 430 }, graphicFace: 464 },
    { id: "saku", viewport: { width: 390, height: 844 }, standingFace: { classic: 421.5, new: 419.5 }, graphicFace: 528 },
  ]) {
    await page.setViewportSize(viewport);
    await page.selectOption("#variant", "morph");
    await page.selectOption("#character", id);
    await page.waitForTimeout(400);
    await page.click("#play");
    await page.waitForSelector(`.cutin.in[data-char="${id}"]`);
    const faceGap = await page.evaluate(({ id, standingFace, graphicFace }) => {
      const portrait = document.querySelector(`.vn-portraits img.portrait[data-speaker="${id}"]`);
      const style = /\/character_variants\/new\//.test(portrait.currentSrc || portrait.src) ? "new" : "classic";
      const standing = document.querySelector(".ci-tr-sil").getBoundingClientRect();
      const graphic = document.querySelector(".cutin .ci-portrait").getBoundingClientRect();
      return standing.left + standing.width * standingFace[style] / 896
        - graphic.left - graphic.width * graphicFace / 1024;
    }, { id, standingFace, graphicFace });
    assert(Math.abs(faceGap) < 2, `${id}/${viewport.width}: 影とカットインの顔がずれる（${faceGap}px）`);
    await page.waitForFunction(() => document.getElementById("status").textContent.startsWith("再生終了"), null, { timeout: 20000 });
  }
  assert.deepEqual(errors, []);
  console.log("OK intro_transition: 3案とも立ち絵からカットインへつながり、部品が残らず、動きを減らす設定ではフェードだけ");
} finally {
  await browser.close();
}
