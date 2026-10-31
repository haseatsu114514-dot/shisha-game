// 実際の通知とマップをPC・スマホ縦横で検証。SHOTSで確認画像を保存。
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
try {
  const page = await browser.newPage({ viewport: { width: 1331, height: 760 } });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), stats = await import("./js/core/stats.js");
    const ui = await import("./js/core/ui.js"), hud = await import("./js/daily/hud.js");
    const map = await import("./js/daily/map.js"), spots = await import("./js/daily/spots.js");
    const vn = await import("./js/vn/engine.js");
    window.T = { core, stats, ui, hud, map, spots, vn };
    core.newGame(); Object.assign(core.state, { phase: "daily", day: 4, slot: 1 });
    for (const id of ["naru", "minto", "adam", "tsumugi", "rin"]) core.state.met[id] = true;
    for (const s of spots.SPOTS) if (s.requiresMet) core.state.flags[`_spot_guide_${s.requiresMet}`] = true;
    core.state.flags._cafe_introduced = true;
    hud.initHud({}); hud.showHud(); await ui.warmUiArt();
    T.openMap = async () => {
      map.interruptMap(null); ui.dropRetired();
      await new Promise((resolve, reject) => {
        T.mapPromise = map.chooseSpot({ onShown: resolve });
        T.mapPromise.catch(reject);
      });
    };
    T.inkOffset = n => {
      const style=getComputedStyle(n), box=n.getBoundingClientRect(), range=document.createRange();
      range.selectNodeContents(n); const r=range.getBoundingClientRect(), scale=box.width/n.offsetWidth;
      const ctx=document.createElement("canvas").getContext("2d");
      ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const m=ctx.measureText(n.textContent);
      return { x:(r.left-box.left)/scale+(m.actualBoundingBoxRight-m.actualBoundingBoxLeft)/2-n.offsetWidth/2,
        y:(r.top-box.top)/scale+m.fontBoundingBoxAscent+(m.actualBoundingBoxDescent-m.actualBoundingBoxAscent)/2-n.offsetHeight/2 };
    };
    await document.fonts.ready;
    await T.openMap();
  });
  const sizes = [{ width: 1331, height: 760 }, { width: 844, height: 390 }, { width: 591, height: 1280 }];
  for (const size of sizes) {
    await page.setViewportSize(size); await page.waitForSelector('[data-test="pin-naru"]');
    await page.waitForTimeout(300);
    const map = await page.evaluate(() => {
      const keys = ["tonari", "naru", "adam", "minto", "shop", "cafe", "kannon", "choizap", "c_station", "rest"];
      const pins = keys.map(k => document.querySelector(`[data-test="pin-${k}"]`));
      const rect = n => { const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom }; };
      const overlap = (a,b) => Math.min(a.right,b.right) > Math.max(a.x,b.x) + 1 && Math.min(a.bottom,b.bottom) > Math.max(a.y,b.y) + 1;
      return { labels: pins.map(p => p.querySelector(".sub-label").textContent),
        faces: [...document.querySelectorAll(".pin-face")].map(f => ({ width: f.offsetWidth, owner: f.classList.contains("pin-owner-face"), loaded: f.complete && f.naturalWidth > 0 })),
        icons: ["shop","cafe","kannon","choizap","c_station","rest"].map(k => {
          const p = document.querySelector(`[data-test="pin-${k}"]`), symbol = p.querySelector(".pin-symbol"), name = p.querySelector(".sub-label");
          const logo = p.querySelector(".store-logo"), facility = p.querySelector(".facility-icon");
          return { k, vector: !!symbol?.querySelector("svg"), logo: !!logo, facility: !!facility, below: rect(name).y > rect(symbol || logo || facility).y, oldGlyph: !!p.querySelector(".label") };
        }),
        badges: [...document.querySelectorAll(".evt-badge.story")].map(n => ({ text: n.textContent, radius: getComputedStyle(n).borderRadius, width:n.clientWidth,height:n.clientHeight, ink:T.inkOffset(n) })),
        collisions: pins.flatMap((a,i) => pins.slice(i+1).filter(b => overlap(rect(a),rect(b))).map(b => [a.dataset.spot,b.dataset.spot])),
        gym: document.querySelector('[data-test="pin-choizap"] .facility-icon img').src,
        leakedShark: !!document.querySelector('[data-test="pin-shishark"], [data-test="pin-samechan"]') };
    });
    assert.deepEqual(map.labels, ["tonariへ行く","KEMURIKUSAへ行く","EDENへ行く","PEPPERMINTへ行く","Dr.fookahへ行く","喫茶こはく","観音堂","CHOI-ZAP","C.STATION","家"]);
    assert(map.faces.every(f => f.width === (f.owner ? 32 : 52) && f.loaded), JSON.stringify(map.faces));
    assert(map.icons.every(i => (i.vector || i.logo || i.facility) && i.below && !i.oldGlyph));
    assert(map.badges.length >= 5 && map.badges.every(b => b.text === "!" && b.radius === "50%" && b.width === b.height));
    assert(map.badges.every(b => Math.abs(b.ink.x)<.75 && Math.abs(b.ink.y)<.75), JSON.stringify(map.badges));
    assert.match(map.gym, /ui\/map-facilities-extra-579\.webp/); assert.deepEqual(map.collisions, []); assert(!map.leakedShark);
    if (shots) await page.screenshot({ path: `${shots}/map-${size.width}.png` });

    // 煙なしの金枠の札（原画）は「これまでのゴージャス」（classic）の素材。既定の紙テーマ（#2136）ではテーマの色で描くため、札の確認だけ classic で行う。
    await page.evaluate(async () => {
      T.theme = document.documentElement.dataset.uiTheme; document.documentElement.dataset.uiTheme = "classic";
      for (const key of T.core.STAT_KEYS) T.core.state.stats[key] = 12; // 10段では10の倍数を越えると段到達カードになるため、段の途中から始める
      T.core.state.statXp = {};
      await T.stats.paidAction(async () => { T.stats.earnStat("sense", 4); T.stats.addStamina(-8); });
    });
    await page.waitForSelector(".gain-card.st-sense.show"); await page.waitForTimeout(500);
    // 光が横切る演出（::before）が動いている間は札の外へはみ出して見えるため、演出が終わってから測る。
    await page.waitForFunction(() => document.querySelector(".gain-card.st-sense")?.getAnimations({ subtree: true }).every(a => a.playState !== "running"));
    const card = await page.locator(".gain-card.st-sense").evaluate(n => {
      const r=n.getBoundingClientRect(), stage=document.querySelector("#stage").getBoundingClientRect();
      const after=getComputedStyle(n,"::after"), points=n.querySelector(".gc-points"), name=n.querySelector(".gc-main");
      return { heading:n.querySelector(".gc-top").textContent, points:n.querySelector(".gc-points").textContent,
        word:n.querySelector(".gc-change")?.textContent || "", name:n.querySelector(".gc-main").textContent,
        earned:n.querySelector(".gc-earned")?.textContent,
        height:n.clientHeight, badge:n.querySelector(".gc-badge").clientWidth,
        frame:after.backgroundImage, enabled:after.content !== "none", mask:after.maskImage,
        badgeFrame:getComputedStyle(n.querySelector(".gc-badge")).borderImageSource,
        inside:r.left >= stage.left && r.right <= stage.right + 1,
        noOverflow:n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1,
        noSub:!n.querySelector(".gc-sub"), actual:T.core.state.stats.sense,
        pointGap:points.getBoundingClientRect().left-n.querySelector(".gc-earned").getBoundingClientRect().right,
        smaller:parseFloat(getComputedStyle(n.querySelector(".gc-count")).fontSize)<parseFloat(getComputedStyle(name).fontSize),
        badgeInk:T.inkOffset(n.querySelector(".gc-badge")),
        sameSize:getComputedStyle(n.querySelector(".gc-count")).fontSize === getComputedStyle(n.querySelector(".gc-unit")).fontSize };
    });
    assert.deepEqual([card.heading,card.name,card.points,card.word,card.actual], ["STATUS UP","センス","+1P","",13]);
    assert.equal(card.height,68); assert.equal(card.badge,44);
    assert.equal(card.earned,"今回");
    assert(card.frame.includes("reward-clean.webp") && card.mask.includes("reward-clean.webp") && card.badgeFrame.includes("panel.webp") && card.enabled);
    assert(card.inside && card.noOverflow && card.noSub && card.sameSize && card.smaller && card.pointGap < 8,JSON.stringify(card));
    assert(Math.abs(card.badgeInk.x)<.75 && Math.abs(card.badgeInk.y)<.75,JSON.stringify(card));
    if (shots) await page.screenshot({ path: `${shots}/gain-${size.width}.png` });
    await page.evaluate(() => { T.ui.bannersIdle(); document.documentElement.dataset.uiTheme = T.theme; });
  }
  await page.setViewportSize(sizes[0]);

  // 実際に施設の初回を読むと、新規印が消える。名前・記号はそのまま。
  await page.evaluate(async () => { T.vn.vnTest.turbo=true; await T.spots.visitSpot(T.spots.spotById("cafe")); await T.openMap(); });
  await page.waitForSelector('[data-test="pin-cafe"]');
  assert.equal(await page.evaluate(() => T.spots.hasNewEvent(T.spots.spotById("cafe"))), false);
  assert.equal(await page.locator('[data-test="pin-cafe"] .evt-badge').count(),0, await page.locator('[data-test="pin-cafe"]').evaluate(n=>n.outerHTML));
  assert.equal(await page.locator('[data-test="pin-cafe"] .sub-label').textContent(),"喫茶こはく");

  // 通常会話の後でも、凛の未回答の質問が残っていれば印を残す。
  await page.evaluate(async () => {
    for(const [id,seq] of Object.entries(T.spots.VISIT_SEQ)) T.core.state.story[id]=seq.length;
    T.core.state.affinity={rin:T.stats.AFFINITY_RANK_PTS[3]}; T.core.state.flags._gym_member=true;
    T.core.state.spotVisits={cafe:1,kannon:1,choizap:1,c_station:1}; await T.openMap();
  });
  await page.waitForSelector('[data-test="pin-naru"]');
  assert.equal(await page.locator('[data-test="pin-shop"] .evt-badge.story').textContent(), "!");
  // 質問・締めくくりの読了後も、凛の試作品イベントが未読なら印を残す。
  await page.evaluate(async () => {
    T.core.state.finales=Object.fromEntries(Object.keys(T.spots.VISIT_SEQ).map(id => [id,{day:3,chapter:1,route:"friend"}]));
    await T.openMap();
  });
  await page.locator('.map:not(.done) [data-test="pin-shop"]').waitFor();
  assert.equal(await page.evaluate(() => T.spots.rinPrototypeDue()), true);
  assert.equal(await page.locator('[data-test="pin-shop"] .evt-badge.story').count(),1);
  // 試作品も読了した状態では、全店舗の新規印が消える。
  await page.evaluate(async () => {
    T.core.state.flags._spot_seen_ch1_rin_prototype_night=true;
    await T.openMap();
  });
  await page.locator('.map:not(.done) [data-test="pin-shop"]').waitFor();
  assert.equal(await page.evaluate(() => T.spots.rinPrototypeDue()), false);
  assert.equal(await page.locator(".evt-badge.story").count(),0);

  // 店名は閉店日も残す。臨時休暇は別の札で伝え、訪問できない理由も一致する。
  await page.evaluate(async () => { T.core.state.flags._temporary_closed_naru="1:4"; await T.openMap(); });
  await page.waitForSelector('[data-test="pin-naru"] .pin-status');
  assert.equal(await page.locator('[data-test="pin-naru"] .sub-label').textContent(),"KEMURIKUSAへ行く");
  assert.equal(await page.locator('[data-test="pin-naru"] .pin-status').textContent(),"本日臨時休業");
  await page.locator('[data-test="pin-naru"]').click();
  assert.equal(await page.locator(".mi-no").textContent(),"本日臨時休業");
  assert.equal(await page.locator('[data-test="map-go"]').count(),0);
  await page.evaluate(async () => { T.core.state.day=5; await T.openMap(); });
  await page.waitForSelector('[data-test="pin-naru"]');
  assert.equal(await page.locator('[data-test="pin-naru"] .pin-status').count(),0);
  await page.locator('[data-test="pin-naru"]').click(); await page.locator('[data-test="map-go"]').click();
  assert.equal(await page.evaluate(() => T.mapPromise),"naru");

  // 凛がいない日は買い物を開けても新規印を付けない。顔・施設の未解放も漏らさない。
  await page.evaluate(async () => {
    T.core.newGame(); Object.assign(T.core.state,{phase:"daily",day:2}); await T.openMap();
  });
  await page.waitForSelector('[data-test="pin-shop"]');
  assert.equal(await page.locator('[data-test="pin-shop"] .evt-badge').count(),0);
  assert.equal(await page.locator('[data-test="pin-choizap"]').count(),0);
  assert.equal(await page.locator('[data-test="pin-naru"] .pin-face').count(),0);
  assert.equal(await page.locator('[data-test="pin-naru"] .sub-label').textContent(),"KEMURIKUSAへ行く");
  await page.evaluate(async () => { T.core.state.chapter=2; await T.openMap(); });
  await page.waitForSelector('[data-test="pin-shishark"]');
  assert.equal(await page.locator('[data-test="pin-shishark"] .sub-label').textContent(),"SHISHARKへ行く");
  assert.doesNotMatch(await page.locator('[data-test="pin-shishark"]').textContent(),/2章|準備中/);
  assert.deepEqual(errors,[]);
  console.log("[compact map] PASS: three sizes, true 1P, STATUS UP and smoke-free metal frame, store logos and owner badges, facility symbols, round new-event marks, read events, closures, navigation, hidden chapter-2 shop");
} finally { await browser.close(); }
