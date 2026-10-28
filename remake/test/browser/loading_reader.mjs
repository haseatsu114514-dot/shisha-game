// Gameplay tests read the loading comic like a player. Preparation remains unskippable;
// tests of the loading screen itself keep control of the reading hold.
export async function installLoadingComicReader(page) {
  await page.exposeBinding("__readLoadingComic", async () => {
    await page.keyboard.press("Enter");
  });
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const read = new WeakSet();
    new MutationObserver(() => {
      for (const gate of document.querySelectorAll(".loading-gate.is-ready")) {
        if (read.has(gate)) continue;
        read.add(gate);
        void window.__readLoadingComic();
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  });
}
