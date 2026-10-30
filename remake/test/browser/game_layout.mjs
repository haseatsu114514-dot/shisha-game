// Real shared game flows in isolated browser saves; rendering does not fork progression.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { confirmAppearanceSetup, prepareAppearanceCatalog } from "./appearance_setup.mjs";
import { confirmWaterSetup } from "./water_setup.mjs";
prepareAppearanceCatalog();
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const dir = process.env.ARTIFACT_DIR || ".codex/artifacts/game-layout";
fs.mkdirSync(dir, { recursive: true });
const browserOptions = { headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) };
const results = [];
const button = (p, id) => p.locator(`[data-test="${id}"]`);
const activate = async (p, id, touch) => {
  if (["title-layout-normal", "title-layout-ds", "title-layout-recover"].includes(id)
    && !(await p.locator(".title-layout-toolbar").evaluate(node => node.open)))
    await activate(p, "title-layout-settings", touch);
  // 本編の表示切替も「表示」を開いてから選ぶ（DS風ではヒンジの小さなボタン）。
  if (["game-layout-normal", "game-layout-ds", "game-layout-recover"].includes(id)
    && !(await p.locator(".game-layout-toolbar").evaluate(node => node.open)))
    await activate(p, "game-layout-settings", touch);
  const target = button(p, id); await target.scrollIntoViewIfNeeded();
  if (touch) await target.tap(); else await target.click();
};
const state = p => p.evaluate(() => ({ day:__remake.state.day, slot:__remake.state.slot, money:__remake.state.money,
  marker:__remake.state.flags._qa_ds, lovers:__remake.state.lovers, memory:__remake.state.relationshipMemories,
  runs:__remake.state.flags._craft_practice_runs || [] }));
async function ready(p) {
  await button(p, "title-new").waitFor({ timeout:35000 });
  await p.locator("#boot").waitFor({ state:"detached" });
}
async function diagnostics(p) {
  return p.evaluate(() => ({ screen:document.body.dataset.screen, classes:document.body.className,
    display:localStorage.getItem("suien_title_layout"), inputs:window.__layoutInputs,
    day:__remake.state?.day, slot:__remake.state?.slot, money:__remake.state?.money,
    text:document.querySelector(".vn-text")?.textContent,
    choices:[...document.querySelectorAll(".vn-choices.show button")].map(n=>n.textContent),
    craft:document.querySelector(".bench")?.dataset.step,
    modal:document.querySelector("#modal.show")?.textContent }));
}
async function advanceUntil(p, predicate, touch, timeout=45000) {
  const deadline = Date.now()+timeout;
  while (Date.now()<deadline) {
    if (await p.evaluate(predicate)) return;
    const choices = p.locator(".vn-choices.show button:not(:disabled)");
    if (await choices.count()) {
      try { if (touch) await choices.first().tap({timeout:500}); else await choices.first().click({timeout:500}); }
      catch { /* scene transitions can replace the candidate; the deadline still fails blocked input */ }
    }
    else if (await p.evaluate(()=>{
      const vn=document.querySelector("#vn.active");
      // Opacity-zero loading DOM is not yet a player-visible input target.
      return document.body.classList.contains("in-vn") && vn &&
        Number(getComputedStyle(vn).opacity)>=.99 && !!vn.querySelector(".vn-text")?.textContent;
    })) {
      if (touch) { try { await p.locator(".vn-box").tap({timeout:500}); } catch {} }
      else await p.keyboard.press("Enter");
    }
    await p.waitForTimeout(100); // bounded polling, never a long fixed completion delay
  }
  assert.fail(`state wait timed out: ${JSON.stringify(await diagnostics(p))}`);
}
async function dsGeometry(p) {
  await p.locator("body.game-ds").waitFor();
  const rects = await p.locator(".game-ds-panel").evaluateAll(ns=>ns.map(n=>{
    const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,hidden:n.hidden};
  }));
  assert.equal(rects.length,2); assert(rects.every(r=>!r.hidden&&r.w>0&&r.h>0));
  assert(Math.abs(rects[0].w-rects[1].w)<1&&Math.abs(rects[0].h-rects[1].h)<1);
  assert(rects[1].x>=rects[0].x+rects[0].w+9||rects[1].y>=rects[0].y+rects[0].h+9,"two panels overlap or gap missing");
  if (await p.locator("body").getAttribute("data-ds-view")==="map") {
    // MENUは下画面（触る画面）のタッチバーにある。
    const menu=await button(p,"hud-menu").boundingBox(), touchPanel=rects[1];
    assert(menu && menu.x>=touchPanel.x-1 && menu.x+menu.width<=touchPanel.x+touchPanel.w+1
      && menu.y>=touchPanel.y-1 && menu.y+menu.height<=touchPanel.y+touchPanel.h+1,"MENU clipped outside touch panel");
  }
}
async function normalGeometry(p) {
  assert.equal(await p.locator("body.game-ds").count(),0);
  assert.deepEqual(await p.locator("#stage").evaluate(n=>[n.offsetWidth,n.offsetHeight]),[1280,720]);
  assert.deepEqual(await p.locator("#viewport").evaluate(n=>[n.getBoundingClientRect().top,n.scrollLeft,n.scrollTop]),[0,0,0]);
}
async function check(name, options, run, setup) {
  if (process.env.CASE_FILTER && name !== process.env.CASE_FILTER) return;
  // Isolate device emulation/input as well as storage between landscape/portrait fixtures.
  const browser=await chromium.launch(browserOptions);
  const context=await browser.newContext(options), p=await context.newPage(); const errors=[];
  await p.addInitScript(()=>{
    window.__layoutInputs=[];
    document.addEventListener("click",e=>{
      const test=e.target.closest("[data-test]")?.dataset.test;
      if(test) window.__layoutInputs.push(test);
      if(window.__layoutInputs.length>12)window.__layoutInputs.shift();
    },true);
  });
  p.on("pageerror",e=>errors.push(e.message)); p.setDefaultTimeout(25000);
  try {
    if(setup) await setup(p);
    await p.goto(base); await ready(p); await run(p);
    assert.deepEqual(errors,[]); results.push({name,status:"passed"}); console.log(`PASS: ${name}`);
  } catch(e) {
    results.push({name,status:"failed",error:e.stack,diagnostic:await diagnostics(p).catch(()=>null)});
    console.error(`FAIL: ${name}\n${e.stack}`); await p.screenshot({path:path.join(dir,`${name}-failed.png`)}).catch(()=>{});
  } finally { await context.close(); await browser.close(); }
}
try {
  for (const touch of [false,true]) {
    for (const mode of ["normal","ds"]) {
      const device=touch?"touch":"pc", name=`${device}-${mode}-shared-practice-save-load`;
      const options={viewport:touch?(mode==="ds"?{width:390,height:844}:{width:844,height:390}):{width:1280,height:720}, ...(touch?{isMobile:true,hasTouch:true}:{}),
        ...(touch&&mode==="ds"?{recordVideo:{dir:path.join(dir,"video"),size:{width:390,height:844}}}:{})};
      await check(name,options,async p=>{
        await p.evaluate(async()=>{
          const core=await import("./js/core/state.js"), s=core.newState();
          Object.assign(s,{schema:14,phase:"daily",day:6,slot:0,money:45678,stamina:90,weatherSeed:4});
          // This is an old save that already received the former starting box.
          s.flavors=["double_apple"];s.flavorStock={double_apple:50};
          Object.assign(s.flags,{_morning_6:true,_lime_tut:1,_lime_opened:true,_qa_ds:"preserved",_hiyori_meeting_done:true});
          s.owned.push("home_rig_set");
          s.lovers=["hiyori"];s.affinity.hiyori=66;s.relationshipMemories=["actually-read"];
          localStorage.setItem(core.SAVE_KEY,JSON.stringify(s));localStorage.setItem("suien_remake_slot1",JSON.stringify(s));
        });
        await p.reload();await ready(p);
        await activate(p,`title-layout-${mode}`,touch);
        assert.equal(await p.locator(".title").getAttribute("data-layout"),mode,"requested title mode did not activate");
        await p.evaluate(async()=>{__remake.vnTest.turbo=false;(await import("./js/core/state.js")).config.textSpeed=4;});
        await activate(p,"title-load",touch);await activate(p,"slot-1",touch);
        // Legacy LOAD may replay several authored unread scenes. Let real taps
        // finish those scenes, using the same bounded budget as practice below.
        await advanceUntil(p,()=>document.body.dataset.screen==="map"&&!document.body.classList.contains("vn-open"),touch,90000);
        if(mode==="ds")await dsGeometry(p);else await normalGeometry(p);
        const before=await state(p);assert.equal(before.money,45678);assert.equal(before.slot,0);
        assert.deepEqual(before.lovers,["hiyori"]);assert(before.memory.includes("actually-read"));
        await p.screenshot({path:path.join(dir,`${device}-${mode}-map.png`)});
        if(mode==="ds"){
          const raw=await p.evaluate(()=>JSON.stringify(__remake.state));
          await activate(p,"game-layout-normal",touch);
          await p.waitForFunction(()=>!document.body.classList.contains("game-ds"));await normalGeometry(p);
          if(touch)await p.setViewportSize({width:844,height:390});
          await activate(p,"hud-menu",touch);
          await p.getByRole("button",{name:"閉じる",exact:true}).click();
          assert.equal(await p.evaluate(()=>JSON.stringify(__remake.state)),raw);
          if(touch)await p.setViewportSize({width:390,height:844});
          await activate(p,"game-layout-ds",touch);await dsGeometry(p);
          assert.equal(await p.evaluate(()=>JSON.stringify(__remake.state)),raw);
        }
        // 店の制作本体の表示を検査する。日常の1行動は消費しない。
        await p.evaluate(() => {
          import("./js/craft/practice.js").then(m => m.runFullPractice())
            .then(() => import("./js/daily/map.js")).then(m => { window.__layoutMap = m.chooseSpot(); });
        });
        await confirmAppearanceSetup(p, { touch });
        await confirmWaterSetup(p, { touch });
        await button(p,"mix-ok").waitFor();
        if(mode==="ds")await dsGeometry(p);
        for(let n=0;n<10;n++)await activate(p,"mix-plus-double_apple",touch);
        for(let n=0;n<2;n++)await activate(p,"mix-plus-lemon",touch);
        assert.equal(await button(p,"mix-ok").isEnabled(),true);
        await p.screenshot({path:path.join(dir,`${device}-${mode}-mix.png`)});
        await activate(p,"mix-ok",touch);await button(p,"pack-confirm").waitFor();
        await activate(p,"opt-normal",touch);
        // Existing timed-stage automation only, after real DOM mix/packing input.
        // No state/score/slot/result is synthesized by this test.
        await p.evaluate(()=>{__remake.craftTest.auto="good";});
        await activate(p,"pack-confirm",touch);
        await advanceUntil(p,()=>document.body.dataset.screen==="map"&&!document.body.classList.contains("vn-open")&&__remake.state.slot===0,touch,90000);
        const after=await state(p);assert.equal(after.day,6);assert.equal(after.slot,0);assert.equal(after.money,before.money);
        assert.equal(after.marker,"preserved");assert.deepEqual(after.lovers,before.lovers);assert.deepEqual(after.memory,before.memory);
        assert.equal(after.runs.length,before.runs.length+1);assert.equal(after.runs.at(-1).served,true);
        assert.equal(after.runs.at(-1).adjustments,2);assert.equal(after.runs.at(-1).success,true);
        assert.deepEqual(after.runs.at(-1).mix,{double_apple:10,lemon:2});
        await p.screenshot({path:path.join(dir,`${device}-${mode}-result.png`)});
        await activate(p,"hud-menu",touch);await activate(p,"menu-save",touch);await activate(p,"slot-2",touch);
        await p.waitForFunction(()=>!document.querySelector("#modal.show"));
        const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem("suien_remake_slot2")));
        assert.equal(saved.slot,0);assert.equal(saved.money,after.money);assert.deepEqual(saved.flags._craft_practice_runs,after.runs);
        await activate(p,"hud-menu",touch);await activate(p,"menu-load",touch);await activate(p,"slot-2",touch);
        const navigation=p.waitForNavigation({waitUntil:"load"});
        await activate(p,"confirm-load",touch);await navigation;
        await p.locator("#boot").waitFor({state:"detached",timeout:35000});
        await advanceUntil(p,()=>document.body.dataset.screen==="map"&&!document.body.classList.contains("vn-open")&&__remake.state.slot===0,touch);
        assert.deepEqual(await state(p),after);if(mode==="ds")await dsGeometry(p);else await normalGeometry(p);
        if(mode==="ds"){
          await activate(p,"game-layout-recover",touch);await ready(p);
          assert.equal(await p.locator(".title").getAttribute("data-layout"),"normal");
          assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem("suien_remake_slot2")).slot),0);
        }
      });
    }
    await check(`${touch?"touch":"pc"}-dialogue-choice-geometry`,{viewport:touch?{width:390,height:844}:{width:1280,height:720},...(touch?{isMobile:true,hasTouch:true}:{})},async p=>{
      await activate(p,"title-layout-ds",touch);
      await p.evaluate(async()=>{
        const {play}=await import("./js/vn/engine.js");const core=await import("./js/core/state.js");
        core.newGame();core.config.textSpeed=4;__remake.vnTest.turbo=false;
        window.layoutChoice=play({dialogue_id:"qa_display_choice",lines:[{speaker:"sumi",face:"normal",text:"表示と操作を確認する。"},
          {type:"choice",choices:[{text:"一つ目",next:"done"},{text:"二つ目",next:"done"},{text:"三つ目",next:"done"}]}],
          branches:{done:[{speaker:"sumi",face:"normal",text:"選択できた。"}]}},{bg:"res://assets/backgrounds/bg_tonari_inside.png"});
      });
      await advanceUntil(p,()=>!!document.querySelector(".vn-choices.show"),touch);await dsGeometry(p);
      for(const theme of ["smoke","smoke-purple","cut-paper","amber","tissue","classic"]){
        await p.evaluate(async id=>(await import("./js/core/ui-theme.js")).applyUiTheme(id),theme);
        // 2026-10-30: 縦持ちの見直しで、AUTO/SKIP/LOG/用語/設定 は下画面（触る画面）の下端のタッチバーへ移した。
        // 上画面の立ち絵の顔を覆わず、本文・選択肢とも交差しない。
        const toolbar=await p.evaluate(()=>{
          const visual=document.querySelector(".game-ds-visual").getBoundingClientRect();
          const panel=document.querySelector(".game-ds-controls").getBoundingClientRect();
          const ctl=document.querySelector(".vn-controls").getBoundingClientRect();
          const text=document.querySelector(".vn-text").getBoundingClientRect();
          const choices=[...document.querySelectorAll(".vn-choice")].map(n=>n.getBoundingClientRect());
          const clear=r=>!(ctl.right>r.left && ctl.left<r.right && ctl.bottom>r.top && ctl.top<r.bottom);
          return { inside:ctl.left>=panel.left && ctl.right<=panel.right && ctl.top>=panel.top && ctl.bottom<=panel.bottom+1,
            offVisual:ctl.top>=visual.bottom, bottomBar:panel.bottom-ctl.bottom<12,
            clearText:clear(text) && choices.every(clear),
            sizes:[...document.querySelectorAll(".vn-ctl")].map(n=>n.getBoundingClientRect().height) };
        });
        assert(toolbar.inside && toolbar.offVisual && toolbar.bottomBar && toolbar.clearText,"DS toolbar sits in the touch bar of the lower screen for "+theme);
        assert(toolbar.sizes.every(h=>h>=44),"DS controls keep 44px touch targets");
      }
      if(!touch){
        const before=await p.evaluate(()=>JSON.stringify(__remake.state));
        const keyboardSwitch=async id=>{
          if(!(await p.locator(".game-layout-toolbar").evaluate(n=>n.open))){await button(p,"game-layout-settings").focus();await p.keyboard.press("Enter");}
          await button(p,id).focus();await p.keyboard.press("Enter");
        };
        await keyboardSwitch("game-layout-normal");
        await p.waitForFunction(()=>!document.body.classList.contains("game-ds"));await normalGeometry(p);
        await keyboardSwitch("game-layout-ds");await dsGeometry(p);
        assert.equal(await p.evaluate(()=>JSON.stringify(__remake.state)),before);
        assert.equal(await p.locator(".vn-choices.show button").count(),3);
      }
      const choices=await p.locator(".vn-choice").evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));assert(choices.every(h=>h>=44));
      await p.locator(".vn-choice").evaluateAll(ns=>Promise.allSettled(ns.flatMap(n=>n.getAnimations()).map(a=>a.finished)));
      await p.screenshot({path:path.join(dir,`${touch?"touch":"pc"}-ds-conversation.png`)});
      await activate(p,"choice-2",touch);await advanceUntil(p,()=>!document.body.classList.contains("vn-open"),touch);
      await p.evaluate(()=>window.layoutChoice);
    });
  }
  await check("small-phone-scroll-choice-and-return",{viewport:{width:320,height:568},isMobile:true,hasTouch:true},async p=>{
    await activate(p,"title-layout-ds",true);
    await p.evaluate(async()=>{
      const core=await import("./js/core/state.js"), {play}=await import("./js/vn/engine.js");
      core.newGame();core.config.textSpeed=4;
      (await import("./js/core/ui.js")).showScreen("none");
      window.smallChoice=play({dialogue_id:"qa_small_display",lines:[{speaker:"sumi",text:"小さな画面でも選べる。"},
        {type:"choice",choices:[{text:"一つ目"},{text:"二つ目"},{text:"三つ目"}]}]},
        {bg:"res://assets/backgrounds/bg_tonari_inside.png"});
    });
    await advanceUntil(p,()=>!!document.querySelector(".vn-choices.show"),true);await dsGeometry(p);
    await activate(p,"choice-2",true);await advanceUntil(p,()=>!document.body.classList.contains("vn-open"),true);
    await p.evaluate(()=>window.smallChoice);
    await activate(p,"game-layout-normal",true);await p.waitForFunction(()=>!document.body.classList.contains("game-ds"));
    await normalGeometry(p);
    assert.deepEqual(await p.locator("#stage").evaluate(n=>[n.scrollLeft,n.scrollTop]),[0,0]);
  });
  await check("small-phone-station-arrival-shows-map-top",{viewport:{width:320,height:568},isMobile:true,hasTouch:true},async p=>{
    await activate(p,"title-layout-ds",true);
    await p.evaluate(async()=>{
      const core=await import("./js/core/state.js"),s=core.newGame();
      Object.assign(s,{chapter:2,phase:"daily",day:15,slot:2,money:36000,stamina:100,weatherSeed:7});
      s.flags={_ch1_cleared:true,_ch2_day1:{startDay:15,stage:"complete",titleSeen:true},
        _ch2_city_visit_c_station:true,_lime_tut:1,_lime_opened:true,
        _hiyori_meeting_done:true,_hiyori_message_delivered:true};
      s.stats={technique:31,sense:31,guts:31,charm:31,insight:31};
      s.flavorStock={mint:21.5,double_apple:6};
      core.save();__remake.vnTest.turbo=true;
      (await import("./js/chapters/ch1.js")).setupHooks();
      void (await import("./js/chapters/ch2.js")).resumeChapterTwo();
    });
    // J07: 初日完了後は共通の帰宅・就寝で翌朝へ進む。「翌日へ」ボタンはない。
    await button(p,"ch2-morning-home").waitFor();
    assert.deepEqual(await p.evaluate(async()=>{
      const {state}=await import("./js/core/state.js");
      return [state.day,state.slot];
    }),[16,0]);
    assert.equal(await button(p,"ch2-main-next-day").count(),0);
    await activate(p,"ch2-morning-home",true);
    await p.locator('[data-destination-selection]:not(.done)').waitFor();
    await p.waitForFunction(()=>!document.querySelector('.map[data-revealing="true"]'));
    await activate(p,"station-open",true);
    await activate(p,"station-destination-widehanga",true);
    // DS風では行き先の一覧が下画面の中でスクロールする。決定ボタンが画面内に見えていればよい。
    const confirm=await button(p,"station-confirm").boundingBox(), view=p.viewportSize();
    assert(confirm&&confirm.y>=0&&confirm.y+confirm.height<=view.height,"Station confirm is offscreen on the short viewport");
    await activate(p,"station-confirm",true);
    await button(p,"pin-ch2_rei").waitFor();
    await p.waitForFunction(()=>document.querySelector("#viewport").scrollTop===0);
    const layout=await p.evaluate(()=>{
      const viewport=document.querySelector("#viewport").getBoundingClientRect();
      const hud=document.querySelector(".hud-card").getBoundingClientRect();
      return {visible:hud.top>=viewport.top&&hud.bottom<=viewport.bottom,region:document.querySelector(".map")?.dataset.region};
    });
    assert.equal(layout.region,"widehanga");assert(layout.visible,"Station arrival left the HUD offscreen");
    await p.screenshot({path:path.join(dir,"small-phone-station-arrival.png")});
  });
  await check("old-auto-load-ds-conversation",{viewport:{width:390,height:844},isMobile:true,hasTouch:true},async p=>{
    await activate(p,"title-layout-ds",true);
    await p.evaluate(async()=>{
      const core=await import("./js/core/state.js"),s=core.newState();
      Object.assign(s,{schema:14,phase:"daily",day:6,slot:0,money:45678,stamina:90});
      Object.assign(s.flags,{_morning_6:true,_lime_tut:1,_qa_ds:"preserved"});
      s.affinity.hiyori=22;s.relationshipMemories=["actually-read"];
      localStorage.setItem(core.SAVE_KEY,JSON.stringify(s));core.requestResumeOnBoot();
    });
    await p.reload();await p.locator("#boot").waitFor({state:"detached",timeout:35000});
    await p.waitForFunction(()=>document.body.classList.contains("in-vn") && !!document.querySelector(".vn-text")?.textContent);
    await dsGeometry(p);assert.equal(await p.locator("body").getAttribute("data-screen"),"boot");
    const loaded=await state(p);assert.equal(loaded.money,45678);assert.equal(loaded.slot,0);
    assert.equal(loaded.marker,"preserved");assert.deepEqual(loaded.memory,["actually-read"]);
    assert.equal(await p.evaluate(()=>__remake.state.affinity.hiyori),22);
    await activate(p,"game-layout-recover",true);await ready(p);
    assert.equal(await p.locator(".title").getAttribute("data-layout"),"normal");
  });
  await check("game-css-failure-normal-recovery",{viewport:{width:1280,height:720}},async p=>{
    await activate(p,"title-layout-ds",false);await activate(p,"title-new",false);
    await p.locator("body.vn-open").waitFor();await normalGeometry(p);
    await button(p,"game-layout-recover").click();await ready(p);
    assert.equal(await p.locator(".title").getAttribute("data-layout"),"normal");
  },p=>p.route("**/css/game-ds.css",r=>r.fulfill({status:200,contentType:"text/css",body:""})));
} finally {
  fs.writeFileSync(path.join(dir,"results.json"),JSON.stringify({base,results},null,2)+"\n");
}
assert(results.length > 0, "No game layout cases were selected");
assert.equal(results.filter(r=>r.status==="failed").length,0);
