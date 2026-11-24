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
