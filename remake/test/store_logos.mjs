// 採用ロゴの看板・入店表示と、未解放／SKIP／読込失敗の境界を実画面で確認する。
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
const stores = ["tonari", "naru", "adam", "minto", "shop", "c_station", "choizap"];
const errors = [];
let checks = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1331, height: 760 } });
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js");
    const map = await import("./js/daily/map.js"), spots = await import("./js/daily/spots.js");
    const data = await import("./js/core/data.js"), hud = await import("./js/daily/hud.js");
    const transitions = await import("./js/core/transitions.js"), logos = await import("./js/core/store-logos.js");
    const util = await import("./js/core/util.js");
    const shop = await import("./js/daily/shop.js"), tonari = await import("./js/daily/tonari.js");
    window.T = { core, ui, map, spots, data, hud, transitions, logos, util, shop, tonari };
    core.newGame(); Object.assign(core.state, { phase: "daily", day: 4, slot: 0, money: 30000 });
    for (const id of ["naru", "adam", "minto", "rin", "tsumugi"]) core.state.met[id] = true;
    // 顔画像を持つ既知の店主の小バッジを、空のmanifestでも実物素材で検証する。
    data.DB.manifest.faceIcons = ["sumi", "naru", "adam", "minto"].map(id => `face_${id}.png`);
    hud.initHud({}); hud.showHud(); await ui.warmUiArt();
    T.openMap = async () => { map.interruptMap(null); ui.dropRetired(); T.mapPromise = map.chooseSpot({ eventPin: "naru" }); };
    await T.openMap();
  });
  for (const size of [{ width: 1331, height: 760 }, { width: 844, height: 390 }, { width: 591, height: 1280 }]) {
    await page.setViewportSize(size);
    await page.waitForSelector('.spot-pin.branded');
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const pins = [...document.querySelectorAll('.spot-pin')];
      const box = n => { const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}; };
      const overlaps = (a,b) => Math.min(a.right,b.right)>Math.max(a.x,b.x)+1 && Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1;
      return { logos: [...document.querySelectorAll('.spot-pin .store-logo')].map(n=>({id:n.dataset.storeLogo,loaded:n.querySelector('img')?.complete && n.querySelector('img')?.naturalWidth>0})),
        owners:[...document.querySelectorAll('.pin-owner-face')].map(n=>({id:n.closest('.spot-pin').dataset.spot,loaded:n.complete && n.naturalWidth>0,width:parseFloat(getComputedStyle(n).width),clear:!n.parentElement.querySelector('.evt-badge') || !overlaps(box(n),box(n.parentElement.querySelector('.evt-badge')))})),
        eventBadges:[...document.querySelectorAll('.spot-pin .evt-badge')].map(n=>n.closest('.spot-pin').dataset.spot),
        collisions:pins.flatMap((a,i)=>pins.slice(i+1).filter(b=>overlaps(box(a),box(b))).map(b=>[a.dataset.spot,b.dataset.spot])),
        labels:[...document.querySelectorAll('.sub-label')].map(n=>n.textContent),
        overflow:document.documentElement.scrollWidth>innerWidth };
    });
    assert.deepEqual(info.logos.map(n=>n.id).sort(), [...stores].sort());
    assert(info.logos.every(n=>n.loaded)); assert.deepEqual(info.collisions, []);
    assert.deepEqual(info.owners.map(n=>n.id).sort(), ["adam","minto","naru","tonari"]);
    assert(info.owners.every(n=>n.loaded && n.width===26 && n.clear));
    assert(info.eventBadges.includes("naru"));
    assert(info.labels.includes("喫茶こはく") && !info.overflow);
    if (shots) await page.screenshot({path:`${shots}/map-${size.width}.png`});
    checks++;
  }
  await page.setViewportSize({width:1331,height:760});
  // マップの実クリックが予約した行き先と、背景切替の入店ロゴが一致する。
  for (const id of stores) {
    await page.evaluate(async () => {
      await T.openMap(); T.arrived = null;
      T.mapPromise.then(async id => {
        T.arrivalTask = T.ui.setBg(T.data.sceneBg(T.spots.SPOT_PREVIEW[id], "day").url);
        T.ui.showScreen("arrival-test", T.util.el("div", {text:"到着"}));
        await T.arrivalTask; T.arrived=id;
      });
    });
    await page.locator(`[data-test="pin-${id}"]`).click();
    await page.locator('[data-test="map-go"]').click();
    const card = page.locator(`[data-test="store-arrival"][data-store="${id}"]`);
    await card.waitFor({state:"visible"});
    assert.equal(await card.locator('.store-logo').getAttribute('data-store-logo'), id);
    assert.equal(await card.locator('img').evaluate(n=>n.complete && n.naturalWidth>0),true);
    if (shots) { await page.waitForTimeout(180); await page.screenshot({path:`${shots}/arrival-${id}.png`}); }
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(()=>T.arrived),null);
    await page.waitForFunction(id=>T.arrived===id,id);
    assert.equal(await page.locator('.store-arrival,.scene-curtain').count(),0);
    checks++;
  }
  // 店舗メニューそのものも入店ロゴの後で現れる。
  for (const id of ["tonari","shop"]) {
    await page.evaluate(async id=>{
      await T.openMap(); T.mapPromise.then(()=>{
        T.menuPromise = id==="tonari" ? T.tonari.tonariMenu() : T.shop.openShop();
      });
    },id);
    await page.locator(`[data-test="pin-${id}"]`).click(); await page.locator('[data-test="map-go"]').click();
    await page.locator(`[data-test="store-arrival"][data-store="${id}"]`).waitFor();
    await page.locator(id==="tonari"?'[data-test="sub-back"]':'.shop-tabs').waitFor();
    assert.equal(await page.locator('.store-arrival').count(),0); checks++;
  }
  // 入店前に確認を読む時間がかかっても、実際の来店でロゴを見せる。
  await page.evaluate(async()=>{
    const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;
    await T.openMap();T.delayedVisitDone=false;
    T.mapPromise.then(async id=>{await T.util.sleep(3200);await T.spots.visitRival(T.spots.spotById(id));T.delayedVisitDone=true;});
  });
  await page.locator('[data-test="pin-naru"]').click();await page.locator('[data-test="map-go"]').click();
  await page.locator('[data-test="store-arrival"][data-store="naru"]').waitFor();
  await page.waitForFunction(()=>T.delayedVisitDone);
  assert.equal(await page.locator('.store-arrival,.scene-curtain').count(),0);checks++;
  // 会う前は店主の顔を隠す。未解放の店舗・カフェには採用ロゴを出さない。
  await page.evaluate(async()=>{T.core.state.met={}; await T.openMap();});
  await page.waitForSelector('[data-test="pin-choizap"]');
  assert.equal(await page.locator('[data-test="pin-choizap"] .store-logo,[data-test="pin-c_station"] .store-logo,[data-test="pin-cafe"] .store-logo').count(),0);
  assert.equal(await page.locator('[data-test="pin-naru"] .pin-face').count(),0); checks++;
  // SKIPは短く、減らした動きでは静止ロゴ。別の場面にロゴ予約を持ち越さない。
  for(const mode of ["skip","reduced"]){
    await page.emulateMedia({reducedMotion:mode==="reduced"?"reduce":"no-preference"});
    const elapsed=await page.evaluate(async mode=>{
      document.body.classList.toggle("vn-skip",mode==="skip");
      T.transitions.cueTransition("place",{spotId:"tonari",area:"バイト先"});
      const c=T.transitions.createSceneCurtain(T.ui.layers.fx,{fast:mode==="skip"});
      await c.covered;const start=performance.now();
      const visible=!!document.querySelector('[data-test="store-arrival"]');
      await c.release();await c.release();
      document.body.classList.remove("vn-skip");return {visible,ms:performance.now()-start};
    },mode);
    assert(elapsed.visible);if(mode==="skip")assert(elapsed.ms<1000,JSON.stringify(elapsed));
    assert.equal(await page.locator('.store-arrival,.scene-curtain').count(),0); checks++;
  }
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.evaluate(async()=>{const c=T.transitions.createSceneCurtain(T.ui.layers.fx,{fast:true});await c.covered;await c.release();});
  assert.equal(await page.locator('.store-arrival').count(),0);checks++;
  // PNGが取得できなくても看板名と操作は残る。
  await page.route('**/assets/ui/store_logos/tonari.png',r=>r.abort());
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async()=>{
    const logos=await import('./js/core/store-logos.js');
    document.querySelector('#screen').append(logos.storeLogo('tonari'));
  });
  await page.locator('.store-logo.missing').waitFor();
  assert.equal(await page.locator('.store-logo.missing').textContent(),'tonari');checks++;
  assert.deepEqual(errors,[]);
  console.log(`PASS store logos: ${checks} UI cases, 7 adopted brands, no page errors`);
} finally { await browser.close(); }
