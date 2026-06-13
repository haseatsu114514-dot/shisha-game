// シーシャ作り画面（チュートリアル / 大会共通）を1ステップ進める共通ヘルパー。
// 「勝ちに行く」選択で進める。opts.onResult(rows) は審査結果のとき呼ばれる。
export async function playTnStep(page, opts = {}) {
  const title = await page.locator("#tn-title").textContent();
  if (title.includes("機材選択")) {
    await page.locator("#tn-body .spot-btn:not([disabled])").first().click();
  } else if (title.includes("アルミ穴あけ") || title.includes("HOLE RHYTHM")) {
    // HOLE RHYTHM BATTLE: 各リングで数回穴を開けて「仕上げる」を押す（3リング）
    for (let ring = 0; ring < 3; ring++) {
      const punch = page.locator("#hole-punch");
      const target = [8, 6, 4][ring];
      for (let k = 0; k < target; k++) { await punch.click().catch(() => {}); await page.waitForTimeout(110); }
      const adv = page.locator("#hole-advance:not([disabled])");
      if (await adv.count()) await adv.click().catch(() => {});
      await page.waitForTimeout(60);
    }
    await page.locator("#tn-body button", { hasText: /次へ|結果を見る/ }).click();
  } else if (title.includes("炭起こし") || title.includes("HEAT IGNITION")) {
    // HEAT IGNITION: 3つの炭を観察し、芯がピカッと閃いた瞬間(justNow)に取り上げる。
    // 閃きを取り逃して白熱/灰(hot/ash)まで行った炭は救済で取る（取り残しを防ぐ）。
    for (let k = 0; k < 400; k++) {
      const d = await page.evaluate(() => (window.__heatDebug ? __heatDebug() : null));
      if (!d) { await page.waitForTimeout(40); continue; }
      if (d.every((c) => c.taken)) break;
      const pick = d.find((c) => c.justNow) || d.find((c) => !c.taken && (c.zone === "hot" || c.zone === "ash"));
      if (pick) await page.locator(`#heat-coal-${pick.i}`).click().catch(() => {});
      await page.waitForTimeout(40);
    }
    await page.locator("#tn-body button", { hasText: /次へ|結果を見る/ }).click();
  } else if (title.includes("集中")) {
    for (let k = 0; k < 60; k++) {
      const fin = page.locator("#tn-body button", { hasText: "仕上げに入る" });
      if (await fin.count()) { await fin.click(); break; }
      const w = page.locator(".focus-word");
      if (await w.count()) await w.first().click().catch(() => {});
      await page.waitForTimeout(150);
    }
  } else if (title.includes("炭替え・調整")) {
    // 調整ラウンド: 勝ちルートでは現状維持
    await page.locator(".spot-btn", { hasText: "このままでいく" }).click();
  } else if (title.includes("テーマ選択")) {
    await page.locator(".spot-btn", { hasText: "フルーティ" }).click();
  } else if (title.includes("ミックス")) {
    const rows = page.locator(".mix-row");
    const plusOf = (name) => rows.filter({ hasText: name }).locator("button", { hasText: "＋" });
    const totalText = (await page.locator("#tn-body .mix-total").textContent()) || "";
    if (totalText.includes("ストロベリー")) {
      // ch2課題: ストロベリー2g + ブルーベリー6g + バニラ4g（fruit + sweet でテーマ一致）
      for (let i = 0; i < 2; i++) await plusOf("ストロベリー").click();
      for (let i = 0; i < 6; i++) await plusOf("ブルーベリー").click();
      for (let i = 0; i < 4; i++) await plusOf("バニラ").click();
      await page.locator("#tn-body button", { hasText: "この配合でいく" }).click();
      await page.waitForTimeout(40);
      return;
    }
    // ch1課題: ミント2g + ブルーベリー6g + バニラ4g（fruit + sweet でテーマ一致）
    for (let i = 0; i < 2; i++) await plusOf("ミント").click();
    for (let i = 0; i < 6; i++) await plusOf("ブルーベリー").click();
    for (let i = 0; i < 4; i++) await plusOf("バニラ").click();
    // バイトの「ミント抜き」リクエストの日はミントをブルーベリーに振り替える
    const go = page.locator("#tn-body .mix-footer .primary-btn");
    if (await go.isDisabled()) {
      const minusOf = (name) => rows.filter({ hasText: name }).locator("button", { hasText: "−" });
      for (let i = 0; i < 2; i++) await minusOf("ミント").click();
      for (let i = 0; i < 2; i++) await plusOf("ブルーベリー").click();
    }
    await page.locator("#tn-body button", { hasText: "この配合でいく" }).click();
  } else if (title.includes("パッキング")) {
    await page.locator(".spot-btn", { hasText: "ノーマル" }).click();
  } else if (title.includes("炭の配置")) {
    await page.locator(".spot-btn", { hasText: "トライアングル" }).click();
  } else if (title.includes("蒸らし時間")) {
    await page.locator(".spot-btn", { hasText: "8分" }).click();
  } else if (title.includes("蒸らし中")) {
    // 雑念弾幕: 多少の被弾は許容してタイマー切れを待つ（craftへの影響は最大-4）
    for (let k = 0; k < 200; k++) {
      const next = page.locator("#tn-body button", { hasText: "次へ" });
      if (await next.count()) { await next.click(); break; }
      await page.waitForTimeout(120);
    }
  } else if (title.includes("吸い出し")) {
    // 温度合わせ: __pullDebug（針位置・狙いゾーン）を読み、狙いに入った瞬間に吸う。
    // 適温に入って最低回数を満たしたら提供する
    for (let k = 0; k < 600; k++) {
      const d = await page.evaluate(() => (window.__pullDebug ? __pullDebug() : null));
      if (!d) { await page.waitForTimeout(60); continue; }
      if ((d.canServe && d.tempOk) || d.count >= 5) {
        await page.locator("#tn-pull-serve").click();
        break;
      }
      if (d.pos >= d.wantZone[0] && d.pos <= d.wantZone[1]) {
        await page.locator("#tn-pull-go").click().catch(() => {});
        await page.waitForTimeout(120);
      } else {
        await page.waitForTimeout(20);
      }
    }
    await page.locator("#tn-body button", { hasText: "次へ" }).click();
  } else if (title.includes("審査結果")) {
    const rows = await page.locator(".result-row").allTextContents();
    if (opts.onResult) opts.onResult(rows);
    await page.locator("#tn-body .primary-btn").click();
  } else if (await page.locator("#tn-body .primary-btn:not([disabled])").count()) {
    // 練習結果など、ボタンひとつの結果パネル
    await page.locator("#tn-body .primary-btn:not([disabled])").first().click();
  }
  await page.waitForTimeout(40);
}
