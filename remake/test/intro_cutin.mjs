// 初登場カットイン（vn/intro.js）: 全キャラの見た目が画面に収まるか、名乗った直後に一度だけ出るかを確かめる。
// サーバーを8123で起動後: node remake/test/intro_cutin.mjs   （SHOTS=<フォルダ> で各キャラの画像を保存）
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  const ids = await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), { DB } = await import("./js/core/data.js");
    const intro = await import("./js/vn/intro.js"), vn = await import("./js/vn/engine.js");
    core.newGame();
    const { introFlavor } = await import("./js/vn/intro-flavors.js");
    window.T = { core, DB, intro, introFlavor, vn };
    return Object.keys(DB.characters).filter((id) => DB.characters[id].intro_cutin);
  });
  assert(ids.length >= 20, `カットインのデータが少ない（${ids.length}人）`);
  const flavorCases = await page.evaluate(() => Object.fromEntries(
    ["hiyori", "kuze", "steve", "master_hookah", "sheikh", "maezono", "oneesan", "ageha", "unknown"].map((id) => [id, T.introFlavor(id)]),
  ));
  assert.deepEqual(flavorCases.hiyori, { main: "マンゴー", small: "ハバネロ" });
  for (const id of ["kuze", "steve", "master_hookah", "sheikh", "maezono", "oneesan", "unknown"]) {
    assert.equal(flavorCases[id], null, `${id}: 未確定の好みを表示しない`);
  }
  assert.equal(await page.evaluate(() => T.introFlavor("__proto__")), null, "未登録の特殊IDを表示しない");
  assert.deepEqual(flavorCases.ageha, { main: "ホワイトグミベア／レッドグミベア" });
  assert.equal(await page.evaluate(() => T.introFlavor("ageha", "unknown")), null, "正体不明版で好みを表示しない");

  // 1) 全員: 二つ名・名前・一言が画面（1280×720）の中に収まり、文字が空でない
  for (const id of ids) {
    await page.evaluate((id) => { T.core.state.met[id] = true; T.done = T.intro.playIntro(id); }, id);
    await page.waitForSelector(`.cutin.in[data-char="${id}"]`);
    await page.waitForTimeout(1300); // 一言が出そろうまで
    const box = await page.evaluate(() => {
      const stage = document.querySelector("#stage").getBoundingClientRect();
      const k = stage.width / 1280;
      const r = (sel) => {
        const n = document.querySelector(`.cutin ${sel}`);
        if (!n) return null;
        const b = n.getBoundingClientRect();
        return { text: n.textContent, left: (b.left - stage.left) / k, right: (b.right - stage.left) / k, top: (b.top - stage.top) / k, bottom: (b.bottom - stage.top) / k };
      };
      return { title: r(".ci-title"), name: r(".ci-name"), line: r(".ci-line"), flavor: r(".ci-flavor"), portrait: !!document.querySelector(".cutin img.ci-portrait") };
    });
    for (const key of ["title", "name", "line"]) {
      const b = box[key];
      assert(b && b.text.trim(), `${id}: ${key} が空`);
      assert(b.left >= 0 && b.right <= 1280 && b.top >= 0 && b.bottom <= 720, `${id}: ${key}「${b.text}」が画面からはみ出す ${JSON.stringify(b)}`);
    }
    const expectedFlavor = await page.evaluate((id) => T.introFlavor(id), id);
    assert.equal(!!box.flavor, !!expectedFlavor, `${id}: フレーバー札の有無`);
    if (box.flavor) {
      assert.equal(box.flavor.text, `好きなフレーバー${expectedFlavor.main}${expectedFlavor.small || ""}`);
      assert(box.flavor.left >= 0 && box.flavor.right <= 1280 && box.flavor.top >= 0 && box.flavor.bottom <= 720,
        `${id}: フレーバー札が画面からはみ出す ${JSON.stringify(box.flavor)}`);
      assert(box.flavor.bottom < box.line.top, `${id}: フレーバー札とセリフが重なる`);
    }
    assert(box.name.right <= 1280 - 40, `${id}: 名前「${box.name.text}」が右端に詰まりすぎ`);
    assert.equal(await page.locator('.cutin .ci-full').count(), 0, `${id}: 括弧付きの本名が表示されている`);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/cutin_${id}.png` });
    await page.locator(".cutin").click();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".cutin:not(.out)").count(), 1, `${id}: クリック/Enterで演出を飛ばせてしまう`);
    await page.evaluate(() => T.done);
    assert.equal(await page.locator(".cutin").count(), 0, `${id}: 自動で閉じない`);
  }

  // 2) 名前の出し方: 全員で呼び名のみ、本名の括弧を廃止。物語の名乗りは残す
  const rule = await page.evaluate(() => Object.fromEntries(["naru", "sumi", "tsumugi", "nagumo", "minto"].map((id) => [id, T.intro.introName(id)])));
  assert.deepEqual(rule.naru, { main: "なる", full: "" });
  assert.deepEqual(rule.sumi, { main: "スミさん", full: "" });
  assert.deepEqual(rule.tsumugi, { main: "つむぎ", full: "" }, "フルネームの無いキャラに（）が付く");
  assert.equal(rule.nagumo.full, "", "呼び名とフルネームが同じなら（）を付けない");
  assert.deepEqual(rule.minto, { main: "みんと", full: "" });
  const hidden = await page.evaluate(async () => {
    const out = {};
    for (const id of ["minto", "rei"]) {
      T.core.state.met[id] = true;
      const p = T.intro.playIntro(id);
      await new Promise((r) => setTimeout(r, 400));
      out[id] = document.querySelector(".cutin").textContent;
      document.querySelector(".cutin").dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      document.querySelector(".cutin")?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await p;
    }
    return out;
  });
  assert(!/栞|緑川/.test(hidden.minto), `みんとのカットインに本名が出ている: ${hidden.minto}`);
  assert(!/田中|健太/.test(hidden.rei), `零-REI-のカットインに本名が出ている: ${hidden.rei}`);

  // 3) 会話の中: 「？？？」の間は出ず、名乗り（_met_）の直後の台詞の前に一度だけ出る
  await page.evaluate(() => {
    T.core.newGame();
    T.seen = [];
    new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => n.classList?.contains("cutin") && T.seen.push(n.dataset.char))))
      .observe(document.querySelector("#fx"), { childList: true });
    T.talk = T.vn.play({ dialogue_id: "__intro_test", lines: [
      { speaker: "naru", face: "normal", text: "お、あんたが4人目？ 俺はなる" },
      { type: "set_flag", flag: "_met_naru" },
      { speaker: "hajime", face: "normal", text: "よろしくお願いします" },
      { speaker: "naru", face: "smile", text: "おう" },
    ] });
  });
  const advance = async () => { await page.waitForTimeout(450); await page.mouse.click(640, 600); };
  await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("俺はなる"));
  assert.deepEqual(await page.evaluate(() => T.seen), [], "名乗る前にカットインが出た");
  await advance(); await advance();
  await page.waitForSelector('.cutin[data-char="naru"]');
  assert.equal(await page.evaluate(() => T.core.state.flags._intro_naru), true);
  await page.waitForTimeout(600);
  await page.locator(".cutin").click();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control");
  assert.equal(await page.locator('.cutin[data-char="naru"]:not(.out)').count(), 1, "登場中の操作で閉じた");
  await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("よろしく"));
  await advance(); await advance();
  await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("おう"));
  await advance(); await advance();
  await page.evaluate(() => T.talk);
  assert.deepEqual(await page.evaluate(() => T.seen), ["naru"], "カットインが一度だけになっていない");

  assert.deepEqual(errors, []);
  console.log(`OK intro_cutin: ${ids.length}人のカットインが画面内に収まり、名乗った直後に一度だけ出る`);
} finally {
  await browser.close();
}
