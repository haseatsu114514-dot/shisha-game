/** Open the story through its cover and finish the optional picture book. */
export async function startTrpgStory(page, keyboard = false) {
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const press = test => {
    const button = page.locator(`[data-test="${test}"]`);
    return keyboard ? button.press("Enter") : touch ? button.tap() : button.click();
  };
  await press("trpg-start");
  const pictureBook = page.locator('[data-test="trpg-picturebook"]');
  if (await pictureBook.count()) {
    await press("trpg-picturebook-skip");
    await pictureBook.locator('[data-test="trpg-picturebook-next"]:enabled').waitFor();
    await press("trpg-picturebook-next");
    await pictureBook.waitFor({ state: "detached" });
  }
}

/**
 * ボドゲカフェの本選び（見開きの本・TRP11）: 操作の名前（trpg-play-<本> など）から本を割り出し、その頁までめくる。
 * 本の中の操作ではない名前・すでに開いている本なら何もしない。プレイヤーと同じく、上の見出し（しおり）を押してめくる。
 */
export async function turnToTrpgBook(page, control) {
  const id = /^trpg-(?:play|buy|resume|picturebook|bookmark|memory|book)-(.+)$/.exec(control)?.[1];
  if (!id) return;
  const tab = page.locator(`[data-test="trpg-tab-${id}"]`);
  if (!await tab.count() || await tab.getAttribute("aria-current") === "true") return;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await tab.tap(); else await tab.click();
  await page.locator(`[data-test="trpg-book-${id}"]:not([hidden]):not([data-flip])`).waitFor();
}
