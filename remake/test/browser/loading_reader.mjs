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
        // 表示直後は入力を受け付けない（loading.js の READ_GUARD_*）。一度目が早すぎても、
        // 札が残っていれば守りが明けたあとにもう一度送る。
        void window.__readLoadingComic();
        setTimeout(() => {
          if (gate.isConnected && gate.classList.contains("is-ready")) void window.__readLoadingComic();
        }, 800);
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  });
}
