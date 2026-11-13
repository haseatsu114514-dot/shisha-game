// Real shared game flows in isolated browser saves, landscape only (DS風・スマホ縦画面モードは廃止。2026-11-04／11-10 オーナー決定).
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
async function normalGeometry(p) {
  assert.equal(await p.locator("body.game-ds, .game-ds-panel, .game-layout-toolbar").count(),0);
  // 通常表示は常に 1280×720 の固定ステージ（2026-11-09 オーナー決定・#3035。ワイド拡張 #2861 は廃止）
  const [size]=await p.locator("#stage").evaluate(n=>[[n.offsetWidth,n.offsetHeight]]);
  assert.deepEqual(size,[1280,720]);
  assert.deepEqual(await p.locator("#viewport").evaluate(n=>[n.getBoundingClientRect().top,n.scrollLeft,n.scrollTop]),[0,0,0]);
}
async function check(name, options, run, setup) {
  if (process.env.CASE_FILTER && name !== process.env.CASE_FILTER) return;
  // Isolate device emulation/input as well as storage between PC/touch fixtures.
  const browser=await chromium.launch(browserOptions);
  const context=await browser.newContext(options), p=await context.newPage(); const errors=[];
  await p.addInitScript(()=>{
    try { localStorage.setItem("suien_step_intro", "off"); } catch {} // 選ぶ工程の初回説明（#3028）はレイアウト検査の対象外
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
    {
      const device=touch?"touch":"pc", name=`${device}-shared-practice-save-load`;
      const options={viewport:touch?{width:844,height:390}:{width:1280,height:720}, ...(touch?{isMobile:true,hasTouch:true}:{})};
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
        // 表示の切り替え（通常版／DS風）はもう無い。CONFIG にも本編にも出さない。
        assert.equal(await p.locator('[data-test^="title-layout-"], [data-test^="game-layout-"]').count(),0);
        await p.evaluate(async()=>{__remake.vnTest.turbo=false;(await import("./js/core/state.js")).config.textSpeed=4;});
        await activate(p,"title-load",touch);await activate(p,"slot-1",touch);
        // Legacy LOAD may replay several authored unread scenes. Let real taps
        // finish those scenes, using the same bounded budget as practice below.
        await advanceUntil(p,()=>document.body.dataset.screen==="map"&&!document.body.classList.contains("vn-open"),touch,90000);
        await normalGeometry(p);
        const before=await state(p);assert.equal(before.money,45678);assert.equal(before.slot,0);
        assert.deepEqual(before.lovers,["hiyori"]);assert(before.memory.includes("actually-read"));
        await p.screenshot({path:path.join(dir,`${device}-map.png`)});
        // 店の制作本体の表示を検査する。日常の1行動は消費しない。
        await p.evaluate(() => {
          import("./js/craft/practice.js").then(m => m.runFullPractice())
            .then(() => import("./js/daily/map.js")).then(m => { window.__layoutMap = m.chooseSpot(); });
        });
        await confirmAppearanceSetup(p, { touch });
        await confirmWaterSetup(p, { touch });
        await button(p,"mix-ok").waitFor();
        for(let n=0;n<10;n++)await activate(p,"mix-plus-double_apple",touch);
        for(let n=0;n<2;n++)await activate(p,"mix-plus-lemon",touch);
        assert.equal(await button(p,"mix-ok").isEnabled(),true);
        await p.screenshot({path:path.join(dir,`${device}-mix.png`)});
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
        await p.screenshot({path:path.join(dir,`${device}-result.png`)});
        await activate(p,"hud-menu",touch);await activate(p,"menu-tab-system",touch);await activate(p,"menu-save",touch);await activate(p,"slot-1",touch);
        await activate(p,"confirm-overwrite",touch);
        await p.waitForFunction(()=>!document.querySelector("#modal.show"));
        const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem("suien_remake_slot1")));
        assert.equal(saved.slot,0);assert.equal(saved.money,after.money);assert.deepEqual(saved.flags._craft_practice_runs,after.runs);
        await activate(p,"hud-menu",touch);await activate(p,"menu-tab-system",touch);await activate(p,"menu-load",touch);await activate(p,"slot-1",touch);
        const navigation=p.waitForNavigation({waitUntil:"load"});
        await activate(p,"confirm-load",touch);await navigation;
        await p.locator("#boot").waitFor({state:"detached",timeout:35000});
        await advanceUntil(p,()=>document.body.dataset.screen==="map"&&!document.body.classList.contains("vn-open")&&__remake.state.slot===0,touch);
        assert.deepEqual(await state(p),after);await normalGeometry(p);
      });
    }
    await check(`${touch?"touch":"pc"}-dialogue-choice-geometry`,{viewport:touch?{width:844,height:390}:{width:1280,height:720},...(touch?{isMobile:true,hasTouch:true}:{})},async p=>{
      await p.evaluate(async()=>{
        const {play}=await import("./js/vn/engine.js");const core=await import("./js/core/state.js");
        core.newGame();core.config.textSpeed=4;__remake.vnTest.turbo=false;
        window.layoutChoice=play({dialogue_id:"qa_display_choice",lines:[{speaker:"sumi",face:"normal",text:"表示と操作を確認する。"},
          {type:"choice",choices:[{text:"一つ目",next:"done"},{text:"二つ目",next:"done"},{text:"三つ目",next:"done"}]}],
          branches:{done:[{speaker:"sumi",face:"normal",text:"選択できた。"}]}},{bg:"res://assets/backgrounds/bg_tonari_inside.png"});
      });
      await advanceUntil(p,()=>!!document.querySelector(".vn-choices.show"),touch);await normalGeometry(p);
      for(const theme of ["paper","smoke","smoke-purple","cut-paper","amber","tissue","classic"]){
        await p.evaluate(async id=>(await import("./js/core/ui-theme.js")).applyUiTheme(id),theme);
        // AUTO/SKIP/LOG/用語/設定 はステージの内側にあり、本文・選択肢と交差しない。
        const toolbar=await p.evaluate(()=>{
          const stage=document.querySelector("#stage").getBoundingClientRect();
          const ctl=document.querySelector(".vn-controls").getBoundingClientRect();
          // 通常表示ではボタン列が文章窓の上余白に載る設計なので、窓ではなく実際の本文の行と比べる。
          const range=document.createRange();range.selectNodeContents(document.querySelector(".vn-text"));
          const lines=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);
          // 選択肢はスクロール領域の中なので、見えている範囲（親の枠で切った矩形）だけを比べる。
          const box=document.querySelector(".vn-choices").getBoundingClientRect();
          const choices=[...document.querySelectorAll(".vn-choice")].map(n=>n.getBoundingClientRect())
            .map(r=>({left:Math.max(r.left,box.left),right:Math.min(r.right,box.right),top:Math.max(r.top,box.top),bottom:Math.min(r.bottom,box.bottom)}))
            .filter(r=>r.bottom>r.top && r.right>r.left);
          const clear=r=>!(ctl.right>r.left && ctl.left<r.right && ctl.bottom>r.top && ctl.top<r.bottom);
          return { inside:ctl.left>=stage.left-1 && ctl.right<=stage.right+1 && ctl.top>=stage.top-1 && ctl.bottom<=stage.bottom+1,
            clearText:lines.length>0 && lines.every(clear) && choices.every(clear) };
        });
        assert(toolbar.inside && toolbar.clearText,"VN controls stay on stage and clear of text/choices for "+theme+": "+JSON.stringify(toolbar));
      }
      assert.equal(await p.locator(".vn-choices.show button").count(),3);
      const choices=await p.locator(".vn-choice").evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));
      // PC は 44px。横持ちスマホは phone-density.css の --phone-tap の実寸下限（39px・#2851）。旧 44px は DS風の下画面の規格だった。
      const minTap=touch?39:44;
      assert(choices.every(h=>h>=minTap),`choices keep ${minTap}px targets: `+choices);
      await p.locator(".vn-choice").evaluateAll(ns=>Promise.allSettled(ns.flatMap(n=>n.getAnimations()).map(a=>a.finished)));
      await p.screenshot({path:path.join(dir,`${touch?"touch":"pc"}-conversation.png`)});
      await activate(p,"choice-2",touch);await advanceUntil(p,()=>!document.body.classList.contains("vn-open"),touch);
      await p.evaluate(()=>window.layoutChoice);
    });
  }
  await check("small-landscape-choice-and-return",{viewport:{width:568,height:320},isMobile:true,hasTouch:true},async p=>{
    await p.evaluate(async()=>{
      const core=await import("./js/core/state.js"), {play}=await import("./js/vn/engine.js");
      core.newGame();core.config.textSpeed=4;
      (await import("./js/core/ui.js")).showScreen("none");
      window.smallChoice=play({dialogue_id:"qa_small_display",lines:[{speaker:"sumi",text:"小さな画面でも選べる。"},
        {type:"choice",choices:[{text:"一つ目"},{text:"二つ目"},{text:"三つ目"}]}]},
        {bg:"res://assets/backgrounds/bg_tonari_inside.png"});
    });
    await advanceUntil(p,()=>!!document.querySelector(".vn-choices.show"),true);await normalGeometry(p);
    await activate(p,"choice-2",true);await advanceUntil(p,()=>!document.body.classList.contains("vn-open"),true);
    await p.evaluate(()=>window.smallChoice);
    await normalGeometry(p);
    assert.deepEqual(await p.locator("#stage").evaluate(n=>[n.scrollLeft,n.scrollTop]),[0,0]);
  });
  await check("small-landscape-station-arrival-shows-map",{viewport:{width:568,height:320},isMobile:true,hasTouch:true},async p=>{
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
    const confirm=await button(p,"station-confirm").boundingBox(), view=p.viewportSize();
    assert(confirm&&confirm.y>=0&&confirm.y+confirm.height<=view.height,"Station confirm is offscreen on the short viewport");
    await activate(p,"station-confirm",true);
    await button(p,"pin-ch2_rei").waitFor();
    const layout=await p.evaluate(()=>{
      const viewport=document.querySelector("#viewport").getBoundingClientRect();
      const hud=document.querySelector(".hud-card").getBoundingClientRect();
      return {visible:hud.top>=viewport.top&&hud.bottom<=viewport.bottom,region:document.querySelector(".map")?.dataset.region};
    });
    assert.equal(layout.region,"widehanga");assert(layout.visible,"Station arrival left the HUD offscreen");
    await normalGeometry(p);
    await p.screenshot({path:path.join(dir,"small-landscape-station-arrival.png")});
  });
  // 移行: 以前に DS風を選んでいた端末（suien_title_layout="ds"）でも、自動ロードは通常の横画面で再開し、古い表示設定は消える。
  await check("legacy-ds-preference-auto-load-migrates",{viewport:{width:844,height:390},isMobile:true,hasTouch:true},async p=>{
    await p.evaluate(async()=>{
      const core=await import("./js/core/state.js"),s=core.newState();
      Object.assign(s,{schema:14,phase:"daily",day:6,slot:0,money:45678,stamina:90});
      Object.assign(s.flags,{_morning_6:true,_lime_tut:1,_qa_ds:"preserved"});
      s.affinity.hiyori=22;s.relationshipMemories=["actually-read"];
      localStorage.setItem(core.SAVE_KEY,JSON.stringify(s));core.requestResumeOnBoot();
      localStorage.setItem("suien_title_layout","ds");
    });
    await p.reload();await p.locator("#boot").waitFor({state:"detached",timeout:35000});
    await p.waitForFunction(()=>document.body.classList.contains("in-vn") && !!document.querySelector(".vn-text")?.textContent);
    // 再開の入口でタイトルの画面を片付ける（#3514・#3527）。会話に入った時点で、残っているのは「画面なし」
    await normalGeometry(p);assert.equal(await p.locator("body").getAttribute("data-screen"),"none");
    assert.equal(await p.evaluate(()=>localStorage.getItem("suien_title_layout")),null,"legacy display preference is cleared");
    const loaded=await state(p);assert.equal(loaded.money,45678);assert.equal(loaded.slot,0);
    assert.equal(loaded.marker,"preserved");assert.deepEqual(loaded.memory,["actually-read"]);
    assert.equal(await p.evaluate(()=>__remake.state.affinity.hiyori),22);
  });
  // 旧「通常版で開き直す」リンク（?titleLayout=normal）をブックマークしていても、ふつうにタイトルが開く。
  await check("legacy-recovery-url-opens-title",{viewport:{width:1280,height:720}},async p=>{
    await p.goto(new URL("?titleLayout=normal",base).href);await ready(p);
    await normalGeometry(p);
    assert.equal(await p.locator(".title-ds-panel").count(),0);
  });
} finally {
  fs.writeFileSync(path.join(dir,"results.json"),JSON.stringify({base,results},null,2)+"\n");
}
assert(results.length > 0, "No game layout cases were selected");
assert.equal(results.filter(r=>r.status==="failed").length,0);
