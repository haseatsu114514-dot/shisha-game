// 試遊ページの起動（js/page-boot.js）。2026-11-11 オーナー「試遊リンクだと過去の仕様になってしまうので、最新版を本編同様遊べるようにして欲しい」。
// 公開版で古い版の HTML がキャッシュから出ても、build.json で最新を確かめて版付きの URL で開き直し、ページの本体は
// js-<版>/ から読む（古いモジュールが混ざらない）。遊んでいる途中に新しい版が出たら、勝手に読み直さずタブへ戻った時に知らせる。
// 公開版のふりは、HTML の版の meta を書き換え、js-<版>/ を js/ から配り、build.json に最新の版を返して作る。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const PAGES = [
  { file: "desert-ride.html", module: "desert-ride-page.js", ready: '[data-test="desert-page-start"]' },
  { file: "camel-race.html", module: "camel-race-page.js", ready: '[data-test="camel-menu-quick"]' },
  { file: "axe-throw.html", module: "axe-throw-page.js", ready: ".axe-menu" },
  { file: "ichidai.html", module: "ichidai-page.js", ready: '[data-test="ichi-menu-quick"]' },
  { file: "trpg-preview.html", module: "trpg/preview.js", ready: "#trpg-app [data-test]" },
  { file: "trpg-campaign-preview.html", module: "trpg/campaign-preview.js", ready: "#trpg-app [data-test]" },
];

/** 公開版のふり。served は版の付いていない URL で出す HTML の版（キャッシュに残った古い版）、latest.build は build.json の版。 */
async function publish(page, { served, latest }) {
  const requests = [];
  page.on("request", request => requests.push(request.url()));
  await page.route(/\/remake\/build\.json(\?.*)?$/, route => route.fulfill({ json: { build: latest.build, builtAt: "2026-11-11 21:00" } }));
  await page.route(/\/remake\/[\w-]+\.html(\?.*)?$/, async route => {
    const response = await route.fetch();
    const build = new URL(route.request().url()).searchParams.get("v") || served;
    const body = (await response.text()).replace('<meta name="suien-build" content="dev"', `<meta name="suien-build" content="${build}"`);
    await route.fulfill({ response, body });
  });
  await page.route(/\/remake\/js-\w+\//, async route => {
    const response = await route.fetch({ url: route.request().url().replace(/\/remake\/js-\w+\//, "/remake/js/") });
    await route.fulfill({ response });
  });
  return requests;
}

// 本編と同じ Service Worker は公開版で登録するが、検査では通信の差し替えを素通りさせないよう止める
const noServiceWorker = { serviceWorkers: "block" };

await suite("page-boot", async check => {
  await check("a-stale-trial-page-reopens-at-the-latest-build-and-reads-its-modules-from-that-build", async page => {
    const requests = await publish(page, { served: "old1111", latest: { build: "new2222" } });
    for (const spec of PAGES) {
      requests.length = 0;
      await page.goto(new URL(spec.file, baseURL).href);
      await page.waitForURL(url => url.searchParams.get("v") === "new2222");
      await page.locator(spec.ready).first().waitFor({ timeout: 30000 });
      assert.equal(await page.evaluate(() => window.SUIEN_BUILD), "new2222", `${spec.file}: the reopened page is the latest build`);
      assert(requests.some(url => url.endsWith(`/remake/js-new2222/${spec.module}`)), `${spec.file}: the page module comes from the build folder`);
      assert(!requests.some(url => url.includes(`/remake/js/${spec.module}`)), `${spec.file}: never the unversioned module, which a browser may hold from an older build`);
      assert(!requests.some(url => url.includes("/remake/js-old1111/")), `${spec.file}: nothing from the stale build`);
    }
  }, noServiceWorker);

  await check("an-up-to-date-page-plays-without-reloading-and-a-later-build-shows-an-update-note", async page => {
    const latest = { build: "new2222" };
    await page.clock.install();
    await publish(page, { served: "new2222", latest });
    await page.goto(new URL("desert-ride.html?course=ridge", baseURL).href);
    await page.locator('[data-test="desert-page-start"]').waitFor({ timeout: 30000 });
    assert.equal(new URL(page.url()).searchParams.get("v"), null, "an up-to-date page is not reopened");
    // 遊んでいる途中に新しい版が出ても、勝手に読み直さない。タブへ戻った時（1分以上たってから）に上で知らせる
    latest.build = "new3333";
    await page.clock.fastForward(61000);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const note = page.locator('[data-test="update-go"]');
    await note.waitFor();
    assert.match(await note.innerText(), /新しい版が出ています/);
    assert.equal(new URL(page.url()).searchParams.get("v"), null, "the page is not reloaded on its own");
    await note.click();
    await page.waitForURL(url => url.searchParams.get("v") === "new3333" && url.searchParams.get("course") === "ridge");
    await page.locator('[data-test="desert-page-start"]').waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => window.SUIEN_BUILD), "new3333");
  }, noServiceWorker);
}, { entry: new URL("desert-ride.html", baseURL).href, readySelector: '[data-test="desert-page-start"]' });
