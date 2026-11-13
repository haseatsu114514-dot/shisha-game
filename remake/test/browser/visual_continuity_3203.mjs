// #3203: 表示の不連続の2件。
// 1. 地図→Dr.fookah の入口で、出た直後のフレームの写真の枠が空白だった（スマホ横 844×390・写真の読み込み待ち）。
//    写真のデコードを待ってから入口を出す。遅い通信では上限で入口を出し、写真が届くまで枠に下地を見せる。
// 2. 背景画像の取得に失敗すると、前の背景を片付けて黒一色の画面になっていた（ui.setBg）。読めなければ前の背景を残す。
// node remake/test/browser/visual_continuity_3203.mjs（プレビューサーバーが必要）
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const FLOOR_PHOTOS = /\/img\/backgrounds\/bg_(?:shop|fookah_showroom)\.webp(?:[?#]|$)/;
const SHOWROOM_PHOTO = /\/img\/backgrounds\/bg_fookah_showroom\.webp(?:[?#]|$)/; // 2F。店頭の応対の背景（1F）には使わない
const FAILING_BG = /\/img\/backgrounds\/bg_eden_shop\.webp(?:[?#]|$)/; // 起動時の先読みに入っていない背景

async function setup(page, values = {}) {
  await page.evaluate(async values => {
    window.S = { core: await import("./js/core/state.js"), shop: await import("./js/daily/shop.js"),
      ui: await import("./js/core/ui.js"), data: await import("./js/core/data.js"), hud: await import("./js/daily/hud.js") };
    const s = S.core.newGame(); Object.assign(s, { phase: "daily", day: 5, slot: 0, money: 12800, stamina: 100 }, values);
    S.ui.clearScreen(); S.hud.initHud({}); S.hud.showHud();
    await S.ui.setBg(S.data.bgUrl("bg_osu_map_day"), { instant: true });
  }, values);
}

/** 写真の通信を止めておき、release() で流す。止めた通信のURLは seen に残る。 */
async function holdFloorPhotos(page, pattern = FLOOR_PHOTOS) {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const seen = [];
  await page.route(pattern, async route => {
    seen.push(route.request().url());
    await held;
    await route.continue().catch(() => {});
  });
  return { release: () => release(), seen };
}

/** 入口が #screen に入った瞬間（描画より前）と、その次のフレームの写真の枠を記録する。 */
async function watchEntry(page) {
  await page.evaluate(() => {
    window.firstEntry = null;
    const look = () => [...document.querySelectorAll("#screen .shop-entry .shop-floor-picture")].map(picture => {
      const image = picture.querySelector("img");
      return { floor: picture.querySelector(".shop-floor-number")?.textContent || "",
        decoded: !!image && image.complete && image.naturalWidth > 0,
        loading: picture.hasAttribute("data-loading"), under: getComputedStyle(picture).backgroundImage };
    });
    const observer = new MutationObserver(() => {
      if (window.firstEntry || !document.querySelector("#screen .shop-entry")) return;
      observer.disconnect();
      const entry = window.firstEntry = { at: performance.now(), pictures: look(), frame: null };
      requestAnimationFrame(() => { entry.frame = look(); });
    });
    observer.observe(document.getElementById("screen"), { childList: true, subtree: true });
  });
}
const firstEntry = async page => {
  await page.waitForFunction(() => window.firstEntry?.frame, null, { timeout: 8000 });
  return page.evaluate(() => window.firstEntry);
};
const visible = picture => picture.decoded || picture.loading && /gradient/.test(picture.under);

/** #bg に今出ている背景（いちばん上の層） */
const shownBg = page => page.evaluate(() => {
  const layers = [...document.querySelectorAll("#bg .bg-img")];
  const top = layers.at(-1);
  const painted = top?.style.backgroundImage || "";
  // 台や小物のある背景は SVG の <image> で描く（core/scene-art.js）。
  return { count: layers.length, curtains: document.querySelectorAll(".scene-curtain").length,
    url: painted && painted !== "none" ? painted : top?.querySelector("image")?.getAttribute("href") || painted,
    black: !!top?.classList.contains("black"), opacity: top ? getComputedStyle(top).opacity : null,
    mask: top ? top.style.maskImage || top.style.webkitMaskImage || "" : "" };
});

await suite("visual-continuity-3203", async check => {
  await check("phone-map-to-shop-entry-photo", async page => {
    page.setDefaultTimeout(45000);
    const photos = await holdFloorPhotos(page);
    await setup(page);
    await page.evaluate(async () => {
      Object.assign(S.core.state.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true, _lime_tut: 1, _lime_opened: true });
      const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
      (await import("./js/chapters/ch1.js")).setupHooks();
      S.error = null; (await import("./js/daily/calendar.js")).runDaily({ nightEvents: {} }).catch(e => { S.error = e.stack; });
    });
    await page.locator('.map:not(.done):not([data-revealing="true"])').waitFor();
    await page.locator('.map:not(.done) [data-test="pin-shop"]').tap();
    await watchEntry(page);
    await page.evaluate(() => { window.goAt = performance.now(); });
    await page.locator('[data-test="map-go"]').tap();
    // 写真は行き先を選んでから 600ms 後に届く（上限の範囲の遅れ）。
    setTimeout(photos.release, 600);
    const entry = await firstEntry(page);
    assert(photos.seen.some(url => url.includes("bg_fookah_showroom")), "the 2F photo was not loaded before the entry (the slow path was exercised)");
    assert.equal(entry.pictures.length, 2);
    for (const picture of [...entry.pictures, ...entry.frame]) {
      assert(picture.decoded, `entry appeared before its photo was decoded: ${JSON.stringify(picture)}`);
    }
    const waited = await page.evaluate(() => window.firstEntry.at - window.goAt);
    assert(waited < 2500, `entry waited too long: ${Math.round(waited)}ms`);
    await page.locator('[data-test="shop-entry-back"]').tap();
    await page.locator(".map:not(.done)").waitFor();
    assert.equal(await page.evaluate(() => S.error), null);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });

  await check("slow-photo-entry-not-blank", async page => {
    await setup(page);
    // 入口の前に凛想の店頭の応対（#3491）を読む。応対の背景は1Fの写真と同じ絵なので止めず、
    // 入口でだけ読む2Fの写真を遅らせる。入口の待ちは応対が閉じた時から測る。
    const photos = await holdFloorPhotos(page, SHOWROOM_PHOTO);
    await watchEntry(page);
    await page.evaluate(() => {
      S.result = "pending"; S.openedAt = null;
      let greeted = false;
      const tick = () => {
        if (document.body.classList.contains("vn-open")) greeted = true;
        else if (greeted) { S.openedAt = performance.now(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      S.shop.openShop().then(r => { S.result = r; });
    });
    await page.waitForFunction(() => S.openedAt !== null, null, { timeout: 30000 });
    // 調査の再現と同じ 3000ms の遅れ。入口は上限で出て、写真が届くまでは枠に下地が見える。
    setTimeout(photos.release, 3000);
    const entry = await firstEntry(page);
    const waited = entry.at - await page.evaluate(() => S.openedAt);
    assert(waited >= 1400 && waited < 2600, `entry should wait for the photos up to the limit: ${Math.round(waited)}ms`);
    assert.equal(entry.pictures.length, 2);
    for (const picture of [...entry.pictures, ...entry.frame]) assert(visible(picture), `blank photo frame: ${JSON.stringify(picture)}`);
    const showroom = entry.pictures.find(picture => picture.floor === "2F");
    assert.equal(showroom.decoded, false, "the 2F photo was still on its way (the limit path was exercised)");
    assert.equal(showroom.loading, true);
    // 届いたら下地を外し、写真を出す。
    await page.waitForFunction(() => [...document.querySelectorAll("#screen .shop-entry .shop-floor-picture")].every(picture => {
      const image = picture.querySelector("img");
      return !picture.hasAttribute("data-loading") && image.complete && image.naturalWidth > 0;
    }), null, { timeout: 8000 });
    await page.locator('[data-test="shop-entry-back"]').click();
    await page.waitForFunction(() => S.result !== "pending");
    assert.equal(await page.evaluate(() => S.result), null);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });

  await check("failed-background-keeps-previous", async page => {
    await setup(page);
    // 天気で曇りの差分（_overcast_night）になる日もあるので、実際に選ばれた絵の名前で比べる。
    const previous = await page.evaluate(async () => {
      const url = S.data.bgUrl("bg_tonari_inside", "night");
      await S.ui.imageReady(url, 15000);
      await S.ui.setBg(url, { instant: true });
      return url.split("/").at(-1);
    });
    assert.match(previous, /^bg_tonari_inside_(?:overcast_)?night\.webp$/);
    let blocked = 0;
    await page.route(FAILING_BG, route => { blocked++; return route.abort(); });
    // 標準の切り替え（煙のにじみ）・幕のない即時の切り替えのどちらでも、前の背景が残る。
    for (const options of [{}, { instant: true }, { brief: true }]) {
      await page.evaluate(options => S.ui.setBg(S.data.bgUrl("bg_eden_shop"), options), options);
      const now = await shownBg(page);
      assert.equal(now.black, false, `black screen after a failed background ${JSON.stringify(options)}`);
      assert(now.url.includes(previous), `the previous background must stay ${JSON.stringify(options)} ${JSON.stringify(now)}`);
      assert.equal(now.count, 1); assert.equal(now.opacity, "1"); assert.equal(now.mask, ""); assert.equal(now.curtains, 0);
    }
    assert(blocked >= 1, "the background request was really failed");
    // 通信が戻れば、同じ背景の指定で読み直して出せる（失敗した指定が「表示済み」として残らない）。
    await page.unroute(FAILING_BG);
    await page.evaluate(() => S.ui.setBg(S.data.bgUrl("bg_eden_shop")));
    const recovered = await shownBg(page);
    assert.match(recovered.url, /bg_eden_shop/);
    assert.equal(recovered.count, 1); assert.equal(recovered.black, false); assert.equal(recovered.opacity, "1");
    // 背景を消す指定（暗転）はこれまでどおり黒にする。
    await page.evaluate(() => S.ui.setBg(null));
    const cleared = await shownBg(page);
    assert.equal(cleared.black, true); assert.equal(cleared.count, 1); assert.equal(cleared.url, "none");
  }, { ignoreFailedResource: failure => FAILING_BG.test(failure.split(" ").at(-1)) });
});
console.log("PASS visual-continuity-3203: shop entry waits for its photos (bounded, placeholder when slow), a failed background keeps the previous one");
