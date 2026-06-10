// シーシャ作り画面（チュートリアル / 大会共通）を1ステップ進める共通ヘルパー。
// 「勝ちに行く」選択で進める。opts.onResult(rows) は審査結果のとき呼ばれる。
export async function playTnStep(page, opts = {}) {
  const title = await page.locator("#tn-title").textContent();
  if (title.includes("機材選択")) {
    await page.locator("#tn-body .spot-btn:not([disabled])").first().click();
  } else if (title.includes("アルミ穴あけ")) {
    for (let k = 0; k < 6; k++) {
      await page.waitForTimeout(140);
      await page.locator("button", { hasText: "穴を開ける" }).click();
    }
    await page.locator("button", { hasText: "次へ" }).click();
  } else if (title.includes("炭起こし")) {
    await page.waitForTimeout(250);
    await page.locator("button", { hasText: "乗せる" }).click();
    await page.locator("button", { hasText: "次へ" }).click();
  } else if (title.includes("集中")) {
    for (let k = 0; k < 60; k++) {
      const fin = page.locator("button", { hasText: "仕上げに入る" });
      if (await fin.count()) { await fin.click(); break; }
      const w = page.locator(".focus-word");
      if (await w.count()) await w.first().click().catch(() => {});
      await page.waitForTimeout(150);
    }
  } else if (title.includes("テーマ選択")) {
    await page.locator(".spot-btn", { hasText: "フルーティ" }).click();
  } else if (title.includes("ミックス")) {
    // ブルーベリー8g + バニラ4g（fruit + sweet でテーマ一致）
    const rows = page.locator(".mix-row");
    const plusOf = (name) => rows.filter({ hasText: name }).locator("button", { hasText: "＋" });
    for (let i = 0; i < 8; i++) await plusOf("ブルーベリー").click();
    for (let i = 0; i < 4; i++) await plusOf("バニラ").click();
    await page.locator("button", { hasText: "この配合でいく" }).click();
  } else if (title.includes("パッキング")) {
    await page.locator(".spot-btn", { hasText: "ノーマル" }).click();
  } else if (title.includes("炭の配置")) {
    await page.locator(".spot-btn", { hasText: "トライアングル" }).click();
  } else if (title.includes("蒸らし時間")) {
    await page.locator(".spot-btn", { hasText: "8分" }).click();
  } else if (title.includes("引き")) {
    await page.waitForTimeout(300);
    await page.click("#tn-gauge-stop");
    await page.waitForTimeout(50);
    await page.locator("button", { hasText: /提供する|スミさんに出す/ }).click();
  } else if (title.includes("プレゼン")) {
    await page.locator(".spot-btn", { hasText: "味で語る" }).click();
  } else if (title.includes("審査結果")) {
    const rows = await page.locator(".result-row").allTextContents();
    if (opts.onResult) opts.onResult(rows);
    await page.locator("#tn-body .primary-btn").click();
  }
  await page.waitForTimeout(40);
}
