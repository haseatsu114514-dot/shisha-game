// Preserve production screenshots after the gallery viewer has finished fading in.
// This wraps capture timing only; it runs the existing real LIME tests unchanged.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(import.meta.url)("playwright");
process.env.BASE_URL ||= "https://haseatsu114514-dot.github.io/shisha-game/remake/";
process.env.TEST_CASES = "real-lime-invitation";
process.env.ARTIFACT_DIR ||= fileURLToPath(new URL("captures/", import.meta.url));
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args), newContext = browser.newContext.bind(browser);
  browser.newContext = async (...options) => {
    const context = await newContext(...options), newPage = context.newPage.bind(context);
    context.newPage = async (...settings) => {
      const page = await newPage(...settings), screenshot = page.screenshot.bind(page);
      page.screenshot = async (...capture) => {
        if (await page.locator(".gal-viewer.show").count()) {
          await page.waitForFunction(() => Number(getComputedStyle(document.querySelector(".gal-viewer.show")).opacity) >= .99);
        }
        return screenshot(...capture);
      };
      return page;
    };
    return context;
  };
  return browser;
};
await import("../../../../../remake/test/minto_cheki_cg.mjs");
