// 経験値ゲージ → 寝る前のレベルアップ → 火種の印を実DOMで確かめる（GROWTH_BOARD の裏。?growth=1 で有効）。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, baseURL, assertFits } from "./support.mjs";

const out = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
fs.mkdirSync(out, { recursive: true });
const t = (id) => `[data-test="${id}"]`;

async function setupDaily(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 3, slot: 1, stamina: 90 });
    core.config.bgmVolume = 0; core.config.seVolume = 0; core.config.voiceBlip = false;
    const ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js"), hud = await import("./js/daily/hud.js");
    ui.showScreen("map", document.createElement("div"));
    await ui.setBg(data.bgUrl("bg_home", "night"), { fast: true });
    hud.initHud({ phone() {}, status() {}, menu() {} });
    hud.showHud(true);
  });
}

await suite("growth-levelup", async (runCheck) => {
  // ケースごとに独立したBrowserContext。検査の増加後も既存の5分枠へ収まるよう最大2件ずつ動かす。
  const cases=[];
  const check=(...args)=>{cases.push(args);};
  await check("chapter-five-entry-settles-previous-night-once",async(page)=>{
    await setupDaily(page);await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(async()=>{
      window.entryFiveCore=await import("./js/core/state.js");const g=await import("./js/core/growth.js"),s=entryFiveCore.state;
      Object.assign(s,{chapter:4,phase:"cleared",day:60});s.flags._ch4_cleared=true;
      g.setGrowthPreview(true);Object.assign(g.ensureGrowth(),{xp:260,level:1,settledXp:0});
      void (await import("./js/chapters/ch5.js")).beginChapterFive();
    });
    await page.locator(t("levelup")).waitFor({timeout:30000});
    assert.deepEqual(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem(entryFiveCore.SAVE_KEY));return{chapter:s.chapter,day:s.day,level:s.growth.level,fire:s.growth.hidane.any,xp:s.growth.xp};}),
      {chapter:5,day:61,level:2,fire:2,xp:260});
    await page.locator(t("levelup-ok")).click();await page.locator(t("ch5-scene")).waitFor();
    await page.evaluate(async()=>{if(!entryFiveCore.loadFromSlot(entryFiveCore.SAVE_KEY))throw new Error("entry autosave");void (await import("./js/chapters/ch5.js")).resumeChapterFive();});
    await page.locator(t("ch5-scene")).waitFor();assert.equal(await page.locator(t("levelup")).count(),0);
    assert.deepEqual(await page.evaluate(()=>({xp:entryFiveCore.state.growth.xp,fire:entryFiveCore.state.growth.hidane.any})),{xp:260,fire:2});
  });
  await check("chapter-five-finale-settles-and-Kannon-stays-free",async(page)=>{
    await setupDaily(page);await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(async()=>{
      window.finalCore=await import("./js/core/state.js");const p=await import("./js/chapters/ch5-progress.js"),g=await import("./js/core/growth.js");
      const s=finalCore.state;Object.assign(s,{chapter:4,phase:"cleared",day:60});s.flags._ch4_cleared=true;
      if(!p.advanceToChapterFive(s))throw new Error("chapter five");
      for(const scene of p.CH5_PROLOGUE)p.completeChapterFiveScene(s,scene.id);
      p.completeChapterFiveScene(s,"ch5_unrecorded_day");p.recordChapterFiveScheduleDecision(s,"decide");p.completeChapterFiveScene(s,"ch5_schedule_contact");p.beginChapterFiveMatch(s);
      for(const key of ["arrival","firstCup","beforeSecond"])p.completeChapterFiveScene(s,p.CH5_MATCH_SCENES[key]);
      p.recordChapterFiveSecondCup(s,{total:100,category:"steady"});
      for(const key of ["win","afterglow"])p.completeChapterFiveScene(s,p.CH5_MATCH_SCENES[key]);
      for(const scene of p.CH5_AFTERMATH)p.completeChapterFiveScene(s,scene.id);
      p.beginChapterFiveFinale(s,["ending_start","ending_normal","ending_daily_smoke"]);
      p.completeChapterFiveScene(s,"ending_start");p.completeChapterFiveScene(s,"ending_normal");
      g.setGrowthPreview(true);g.ensureGrowth().chapterLog[5]={people:["sumi","minto"],places:["one","two"]};
      Object.assign(s.reel,{setting:6,settingDraws:9,lastChapter:5});
      window.finalBefore={day:s.day,slot:s.slot,stamina:s.stamina,money:s.money,stats:JSON.stringify(s.stats),reel:JSON.stringify(s.reel),
        maximum:(await import("./js/core/stats.js")).maxStamina()};
      (await import("./js/vn/engine.js")).vnTest.turbo=true;
      void (await import("./js/chapters/ch5.js")).resumeChapterFive();
    });
    await page.locator(t("ch5-continue")).click();await page.locator(t("levelup")).waitFor();
    assert.deepEqual(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem(finalCore.SAVE_KEY));return{cleared:s.flags._ch5_cleared,level:s.growth.level,fire:s.growth.hidane.any,xp:s.growth.xp};}),
      {cleared:true,level:3,fire:4,xp:460});
    await page.locator(t("levelup-ok")).click();await page.locator(t("ch5-complete")).waitFor();
    await assertFits(page,t("ch5-reflect"));await page.locator(t("ch5-reflect")).click();
    await page.locator(t("kannon-reflect")).waitFor();assert.equal(await page.locator(t("kannon-visit")).count(),0);
    await page.locator(t("kannon-reflect")).click();await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor();
    await page.locator(t("board-node-B1")).click();await page.locator(t("board-light")).click();await page.locator(t("board-decide")).click();
    await page.locator(t("growth-board")).waitFor({state:"detached"});await page.locator(t("ch5-complete")).waitFor();
    const result=await page.evaluate(async()=>{
      const s=finalCore.state;finalCore.saveToSlot("final-growth-proof");finalCore.loadFromSlot("final-growth-proof");
      return{same:s.day===finalBefore.day&&s.slot===finalBefore.slot&&s.stamina===finalBefore.stamina&&s.money===finalBefore.money
        &&JSON.stringify(s.stats)===finalBefore.stats&&JSON.stringify(s.reel)===finalBefore.reel,
        fire:finalCore.state.growth.hidane.any,node:finalCore.state.growth.nodes.includes("B1"),xp:finalCore.state.growth.xp,
        maximum:(await import("./js/core/stats.js")).maxStamina()-finalBefore.maximum,intro:finalCore.state.flags._kannon_growth_intro_done};
    });
    assert(result.same&&result.node&&result.intro);assert.equal(result.fire,3);assert.equal(result.xp,460);assert.equal(result.maximum,2);
    await page.evaluate(async()=>{void (await import("./js/chapters/ch5.js")).resumeChapterFive();});
    await page.locator(t("ch5-complete")).waitFor();assert.equal(await page.locator(t("levelup")).count(),0);
  });
  await check("existing-Volk-and-FESTA-visits-teach-in-person",async(page)=>{
    await setupDaily(page);await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(async()=>{
      window.teacherCore=await import("./js/core/state.js");window.teacherGrowth=await import("./js/core/growth.js");
      const p=await import("./js/chapters/ch3-progress.js"),s=teacherCore.state;
      Object.assign(s,{chapter:2,day:28,phase:"cleared"});s.flags={_ch2_cleared:true,_ch2_read_ch2_tournament_ageha_heart:true,_ch2_tournament:{stage:"complete"}};
      if(!p.advanceToChapterThree(s))throw new Error("Tokyo boundary");
      for(let i=0;i<80;i++){
        const next=p.chapterThreeScenes(s)[s.flags._ch3_intro.stage];if(next?.id==="ch3_strategy")break;
        const w=p.chapterThreeFreeTime(s);if(w)p.completeChapterThreeFreeTime(s,w.id);
        else if(next)p.completeChapterThreeScene(s,next.id);else throw new Error("Tokyo strategy");
      }
      Object.assign(s.flags._ch3_intro,{titleSeen:true,prologueStep:4});s.flags._ch3_opening_read=true;s.met.volk=true;s.affinity.volk=66;
      teacherGrowth.setGrowthPreview(true);Object.assign(teacherGrowth.ensureGrowth(),{nodes:["M-W5"],learned:[]});
      (await import("./js/vn/engine.js")).vnTest.turbo=true;
      window.teacherBefore={day:s.day,slot:s.slot,stage:s.flags._ch3_intro.stage,stamina:s.stamina};
      void (await import("./js/chapters/ch3.js")).resumeChapterThree();
    });
    await page.locator(t("ch3-intro-optional-open")).click();
    await page.locator(t("ch3-intro-optional-ch3_volk_second")).click();
    await page.waitForFunction(()=>teacherCore.state.growth.learned.includes("M-W5"));
    const volk=await page.evaluate(async()=>{
      const s=teacherCore.state;return{same:s.day===teacherBefore.day&&s.slot===teacherBefore.slot&&s.flags._ch3_intro.stage===teacherBefore.stage&&s.stamina===teacherBefore.stamina,
        active:(await import("./js/core/growth-effects.js")).growthLesson(s,"M-W5"),
        xp:s.growth.xp,read:s.growth.read.includes("ch3_volk_second"),count:Object.keys(s.growth.fresh.counts).length};
    });
    assert(volk.same&&volk.active&&volk.read);assert.equal(volk.xp,30);assert.equal(volk.count,0);
    await page.locator(t("ch3-intro-scene")).waitFor();
    // 先に既存の訪問を読んだ保存でも、後から灯した相談だけを選べる（同じ話やXPを再演しない）。
    await page.evaluate(async()=>{
      teacherCore.state.growth.learned=[];
      void (await import("./js/chapters/ch3.js")).resumeChapterThree();
    });
    await page.locator(t("ch3-intro-optional-open")).click();
    await page.locator(t("ch3-intro-lesson-volk")).click();
    await page.waitForFunction(()=>teacherCore.state.growth.learned.includes("M-W5"));
    assert.equal(await page.evaluate(()=>teacherCore.state.growth.xp),30);
    await page.locator(t("ch3-intro-scene")).waitFor();
    await page.evaluate(async()=>{
      const p=await import("./js/chapters/ch4-progress.js"),s=teacherCore.newGame();
      Object.assign(s,{chapter:3,phase:"cleared",day:45});s.flags._ch3_cleared=true;
      if(!p.advanceToChapterFour(s))throw new Error("Dubai boundary");
      for(const scene of p.CH4_PROLOGUE)p.completeChapterFourScene(s,scene.id);
      s.flags._ch4.titleSeen=true;s.met.da_silva=true;s.affinity.da_silva=66;
      Object.assign(teacherGrowth.ensureGrowth(),{nodes:["M-B6"],learned:[]});
      const companion=await import("./js/core/overseas-companion.js");
      if(companion.canChooseOverseasCompanion(s))companion.chooseOverseasCompanion(s,null);
      window.teacherBefore={day:s.day,slot:s.slot,stamina:s.stamina};
      void (await import("./js/chapters/ch4.js")).resumeChapterFour();
    });
    await page.locator(t("ch4-go-festa")).click();
    await page.waitForFunction(()=>teacherCore.state.growth.learned.includes("M-B6"));
    const festa=await page.evaluate(async()=>{
      const s=teacherCore.state;teacherCore.saveToSlot("teacher-festa");teacherCore.loadFromSlot("teacher-festa");
      return{same:s.day===teacherBefore.day&&s.slot===teacherBefore.slot&&s.stamina===teacherBefore.stamina,
        active:(await import("./js/core/growth-effects.js")).growthLesson(teacherCore.state,"M-B6"),read:s.flags._ch4.read.ch4_festa};
    });
    assert(festa.same&&festa.active&&festa.read);
  });
  await check("Tokyo-night-saves-before-animation-and-LOAD-cleans-owner",async(page)=>{
    await setupDaily(page);await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(async()=>{
      window.nightCore=await import("./js/core/state.js");const p=await import("./js/chapters/ch3-progress.js"),g=await import("./js/core/growth.js");
      const s=nightCore.state;Object.assign(s,{chapter:2,day:28,phase:"cleared",stamina:80});
      s.flags={_ch2_cleared:true,_ch2_read_ch2_tournament_ageha_heart:true,_ch2_tournament:{stage:"complete"}};
      if(!p.advanceToChapterThree(s))throw new Error("chapter 3 boundary");
      while(p.chapterThreeScenes(s)[s.flags._ch3_intro.stage].id!=="ch3_daily_cup_1"){
        const w=p.chapterThreeFreeTime(s);if(w)p.completeChapterThreeFreeTime(s,w.id);
        else p.completeChapterThreeScene(s,p.chapterThreeScenes(s)[s.flags._ch3_intro.stage].id);
      }
      Object.assign(s.flags._ch3_intro,{titleSeen:true,prologueStep:4});s.flags._ch3_opening_read=true;
      g.setGrowthPreview(true);Object.assign(g.ensureGrowth(),{xp:260,level:1,settledXp:0});
      (await import("./js/vn/engine.js")).vnTest.turbo=true;
      window.nightBefore={day:s.day,slot:s.slot,stamina:s.stamina,money:s.money};
      window.tokyoNight=(await import("./js/chapters/ch3.js")).resumeChapterThree();
    });
    await page.locator(t("ch3-intro-continue")).click();await page.locator(t("levelup")).waitFor();
    const settled=await page.evaluate(()=>{
      const s=nightCore.state,saved=JSON.parse(localStorage.getItem(nightCore.SAVE_KEY));
      return{day:s.day,slot:s.slot,stamina:s.stamina,money:s.money,level:s.growth.level,fire:s.growth.hidane.any,
        saved:saved.growth.level===s.growth.level&&saved.growth.hidane.any===s.growth.hidane.any,before:nightBefore};
    });
    assert(settled.saved);assert.equal(settled.level,2);assert.equal(settled.fire,2);
    assert.equal(settled.day,settled.before.day+1);assert.equal(settled.slot,0);
    assert.equal(settled.stamina,settled.before.stamina);assert.equal(settled.money,settled.before.money);
    await page.evaluate(()=>{nightCore.newGame();window.nightNewOwner=JSON.stringify(nightCore.state);});
    await page.locator(t("levelup")).waitFor({state:"detached"});
    assert.equal(await page.evaluate(()=>JSON.stringify(nightCore.state)===nightNewOwner),true);
    assert.equal(await page.locator(t("growth-board")).count(),0);
    await page.evaluate(async()=>{
      if(!nightCore.loadFromSlot(nightCore.SAVE_KEY))throw new Error("night autosave");
      window.tokyoNight=(await import("./js/chapters/ch3.js")).resumeChapterThree();
    });
    await page.locator(t("ch3-intro-free")).waitFor();
    assert.deepEqual(await page.evaluate(()=>({level:nightCore.state.growth.level,fire:nightCore.state.growth.hidane.any})),{level:2,fire:2});
    assert.equal(await page.locator(t("levelup")).count(),0);
  });
  await check("minto-sales-through-real-shift",async(page)=>{
    await setupDaily(page);await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(async()=>{
      window.mintoCore=await import("./js/core/state.js");window.mintoGrowth=await import("./js/core/growth.js");
      window.mintoVn=await import("./js/vn/engine.js");window.mintoTonari=await import("./js/daily/tonari.js");
      window.mintoStats=await import("./js/core/stats.js");
      window.startMinto=(enabled,learned)=>{
        const s=mintoCore.newGame();Object.assign(s,{chapter:1,day:3,slot:1,money:20000,stamina:160,weatherSeed:456});s.stats.guts=100;
        mintoGrowth.setGrowthPreview(enabled);Object.assign(mintoGrowth.ensureGrowth(),{nodes:["M-B1"],learned:learned?["M-B1"]:[]});
        s.flags._ev_ageha_cameo=true;mintoVn.vnTest.turbo=true;
        window.mintoLines=[];mintoVn.hooks.onLine=id=>mintoLines.push(id);
        window.mintoRun=mintoTonari.doBaito({called:true});window.mintoDuplicate=mintoTonari.doBaito({called:true});
      };
      (await import("./js/core/data.js")).DB.baito=[];
    });
    const outcomes=[];
    for(const [enabled,learned] of [[false,true],[true,false],[true,true]]){
      await page.evaluate(([enabled,learned])=>startMinto(enabled,learned),[enabled,learned]);
      await page.locator(t("shift-order-0")).click();await page.locator(t("after-none")).click();
      outcomes.push(await page.evaluate(async()=>{
        const done=await mintoRun,duplicate=await mintoDuplicate,s=mintoCore.state;
        const result={done,duplicate,earned:s.money-20000,stamina:s.stamina,count:s.baitoCount,
          calling:mintoLines.includes("baito_minto_calling"),rate:mintoStats.currentCondition().bonusRate};
        mintoCore.saveToSlot("minto-sales-proof");const money=s.money;mintoCore.loadFromSlot("minto-sales-proof");
        result.reload=mintoCore.state.money===money;return result;
      }));
    }
    assert.equal(outcomes[0].earned,outcomes[1].earned);
    assert.equal(outcomes[2].earned-outcomes[1].earned,1150);
    for(let i=0;i<outcomes.length;i++){
      const r=outcomes[i];assert(r.done&&r.reload);assert.equal(r.duplicate,false);assert.equal(r.count,1);
      assert.equal(r.stamina,142);assert.equal(r.calling,i===2); // 根性100の既存の消耗軽減: 24→18
    }
    // 支払後のSAVE/LOADから同じ行動枠を再入力しても、授業の上乗せは再支給しない。
    await page.evaluate(()=>{
      window.mintoRepeatMoney=mintoCore.state.money;window.mintoLines=[];
      window.mintoRun=mintoTonari.doBaito({called:true});
    });
    await page.locator(t("after-none")).click();
    const repeat=await page.evaluate(async()=>{await mintoRun;return{earned:mintoCore.state.money-mintoRepeatMoney,
      calling:mintoLines.includes("baito_minto_calling"),stamp:mintoCore.state.flags._minto_calling_paid};});
    assert.equal(repeat.earned,outcomes[1].earned);assert.equal(repeat.calling,false);assert.equal(repeat.stamp,"1:3:1");
    await page.evaluate(()=>{mintoVn.hooks.onLine=null;});
  });
  await check("LOAD-during-calling-pays-neither-old-nor-new-owner",async(page)=>{
    await setupDaily(page);await page.emulateMedia({reducedMotion:"reduce"});
    await page.evaluate(async()=>{
      window.mintoCore=await import("./js/core/state.js");const growth=await import("./js/core/growth.js");
      window.mintoVn=await import("./js/vn/engine.js");const tonari=await import("./js/daily/tonari.js");
      mintoCore.state.money=54321;mintoCore.saveToSlot("minto-owner-proof");
      const s=mintoCore.newGame();Object.assign(s,{chapter:1,day:3,slot:1,money:20000,stamina:160});s.stats.guts=100;
      growth.setGrowthPreview(true);Object.assign(growth.ensureGrowth(),{nodes:["M-B1"],learned:["M-B1"]});
      (await import("./js/core/data.js")).DB.baito=[];mintoVn.vnTest.turbo=true;
      mintoVn.hooks.onLine=id=>{
        if(id!=="baito_minto_calling"||window.mintoLoaded)return;
        mintoCore.loadFromSlot("minto-owner-proof");window.mintoLoaded=JSON.stringify(mintoCore.state);
      };
      window.mintoOld=s;window.mintoRun=tonari.doBaito();
    });
    await page.locator(t("shift-order-0")).click();
    const r=await page.evaluate(async()=>({result:await mintoRun,swapped:!!window.mintoLoaded,
      same:JSON.stringify(mintoCore.state)===window.mintoLoaded,oldMoney:mintoOld.money,newMoney:mintoCore.state.money}));
    assert.equal(r.result,false);assert(r.swapped&&r.same);assert.equal(r.oldMoney,20000);assert.equal(r.newMoney,54321);
    await page.evaluate(()=>{mintoVn.hooks.onLine=null;});
  });
  await check("post-tournament-pizza-night",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      window.partyCore=await import("./js/core/state.js");
      const growth=await import("./js/core/growth.js");growth.setGrowthPreview(true);
      Object.assign(growth.ensureGrowth(),{nodes:["M-S5"],learned:["M-S5"]});
      const s=partyCore.state;Object.assign(s,{chapter:3,phase:"aftermath",day:43,slot:1});
      Object.assign(s.flags,{_ch3_intro:{startDay:29,stage:18,titleSeen:true},_ch3_tournament_won:true,
        _ch3_tournament:{stage:"complete",result:{rank:1,win:true}},_ch3_aftermath:{version:3,stage:2,winDay:42}});
      Object.assign(s.met,{mashiro:true,kuze:true,volk:true});
      (await import("./js/vn/engine.js")).vnTest.turbo=true;
      window.partyInitial={day:s.day,slot:s.slot,money:s.money,stamina:s.stamina,affinity:{...s.affinity},stock:JSON.stringify(s.flavorStock)};
      void (await import("./js/chapters/ch3-aftermath.js")).runChapterThreeAftermath();
    });
    await page.locator(t("ch3-aftermath-continue")).click();
    await page.locator(t("ch3-aftermath-party")).click();
    await page.waitForTimeout(350); // modalの既存pop-inが完了した実寸で測る。
    await assertFits(page,'[data-test^="ch3-party-guest-"]');
    assert.equal(await page.locator(".modal-backdrop").evaluate(n=>getComputedStyle(n).backdropFilter),"none");
    await page.screenshot({path:`${out}/pizza-invitation.png`});
    await page.locator(t("ch3-party-guest-mashiro")).click();
    await page.locator(t("ch3-party-cancel")).click();
    await page.locator(t("ch3-aftermath-party")).waitFor();
    assert.equal(await page.evaluate(()=>!!partyCore.state.flags._ch3_pizza_party),false);
    await page.locator(t("ch3-aftermath-party")).click();
    await page.locator(t("ch3-party-guest-mashiro")).click();
    await page.locator(t("ch3-party-guest-kuze")).click();
    await page.locator(t("ch3-party-start")).click();
    await page.waitForFunction(()=>!!partyCore.state.flags._ch3_pizza_party);
    await page.locator(t("ch3-aftermath-party-night")).waitFor();
    assert.equal(await page.locator(t("ch3-aftermath-party")).count(),0);
    const result=await page.evaluate(()=>{
      const s=partyCore.state;partyCore.saveToSlot("party-proof");
      const record=JSON.stringify({flags:s.flags,growth:s.growth,affinity:s.affinity});
      const loaded=!!partyCore.loadFromSlot("party-proof");
      return {same:loaded&&record===JSON.stringify({flags:partyCore.state.flags,growth:partyCore.state.growth,affinity:partyCore.state.affinity}),
        unchanged:s.day===partyInitial.day&&s.slot===partyInitial.slot&&s.money===partyInitial.money&&s.stamina===partyInitial.stamina&&JSON.stringify(s.flavorStock)===partyInitial.stock,
        guests:s.flags._ch3_pizza_party.guests,gains:["mashiro","kuze"].map(id=>(s.affinity[id]||0)-(partyInitial.affinity[id]||0)),stage:s.flags._ch3_aftermath.stage,
        xp:s.growth.xp,actionCount:s.growth.fresh.counts["tokyo:pizza_party"],firstPeople:s.growth.firsts.people,
        firstPlace:s.growth.firsts.places.includes("tokyo:pizza_party"),read:s.growth.read.includes("ch3_growth_pizza_party")};
    });
    assert(result.same&&result.unchanged);assert.deepEqual(result.guests,["mashiro","kuze"]);assert(result.gains.every(n=>n>0));assert.equal(result.stage,2);
    assert(result.xp>=255&&result.firstPlace&&result.read);assert.equal(result.actionCount,1);
    assert(result.firstPeople.includes("mashiro")&&result.firstPeople.includes("kuze"));
    // LOADでownerが切り替わった後、古いカードの入力では次の朝へ進まない。
    await page.locator(t("ch3-aftermath-party-next")).click();
    assert.equal(await page.evaluate(()=>partyCore.state.flags._ch3_aftermath.stage),2);
    await page.evaluate(async()=>{void (await import("./js/chapters/ch3-aftermath.js")).runChapterThreeAftermath();});
    await page.locator(t("ch3-aftermath-party-next")).click();
    await page.waitForFunction(()=>partyCore.state.flags._ch3_aftermath.stage===3);
    assert.deepEqual(await page.evaluate(()=>[partyCore.state.day,partyCore.state.slot]),[44,0]);
  },{viewport:{width:591,height:1280}});
  await check("LOAD-during-deep-pull-keeps-new-owner",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      window.ownerCore=await import("./js/core/state.js");const growth=await import("./js/core/growth.js");growth.setGrowthPreview(true);
      Object.assign(growth.ensureGrowth(),{nodes:["M-S4","K08"],learned:["M-S4"]});
      window.ownerSession=await import("./js/craft/session.js");ownerSession.craftTest.auto=null;
      window.oldPullCs=ownerSession.newSession("rehearsal");oldPullCs.steam={score:100,temp:.5};ownerSession.openBench(oldPullCs);
      ownerCore.save();window.oldPullRun=(await import("./js/craft/pull.js")).runPull(oldPullCs);
    });
    await page.waitForFunction(()=>document.querySelector('[data-test="pull-deep"]')&&!document.querySelector('[data-test="pull-deep"]').disabled);
    await page.locator(t("pull-deep")).click();await page.waitForSelector('.pull-play[data-draw]');
    await page.evaluate(()=>{ownerCore.load();window.loadedOwner=JSON.stringify(ownerCore.state);});
    const result=await page.evaluate(async()=>{const completed=await oldPullRun;const strain=ownerSession.strainBench(oldPullCs);return {completed,strain,same:JSON.stringify(ownerCore.state)===loadedOwner,pullDone:!!oldPullCs.pullDone};});
    assert.deepEqual(result,{completed:false,strain:false,same:true,pullDone:false});
  },{viewport:{width:591,height:1280}});

  await check("home-recipe-costs-and-stale-confirmation",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      window.homeCore=await import("./js/core/state.js");window.homeVn=await import("./js/vn/engine.js");window.homeModule=await import("./js/daily/home-shisha.js");
      window.startHome=()=>{homeCore.newGame();const s=homeCore.state;Object.assign(s,{phase:"daily",day:3,slot:1,stamina:100});s.stats.guts=100;s.owned.push("home_rig_set");s.flavorStock={lemon:100,mint:100};s.flavors=["lemon","mint"];s.recipes.ice_lemonade={day:1};homeVn.vnTest.turbo=false;window.homeUiRun=homeModule.runHomeShisha();};startHome();
    });
    assert.match(await page.locator(".modal-body").innerText(),/100→82（18消費）/);
    await page.locator(t("home-shisha-recipe")).click();const recipe=page.locator(t("home-recipe-ice_lemonade"));
    await recipe.waitFor();assert.match(await recipe.innerText(),/レモン8g/);assert.match(await recipe.innerText(),/ミント4g/);await assertFits(page,t("home-recipe-ice_lemonade"));
    assert.deepEqual(await page.evaluate(()=>({stock:homeCore.state.flavorStock,stamina:homeCore.state.stamina})),{stock:{lemon:100,mint:100},stamina:100});
    await page.evaluate(()=>{homeVn.vnTest.turbo=true;});await recipe.click();
    const applied=await page.evaluate(async()=>{await homeUiRun;return {stock:homeCore.state.flavorStock,stamina:homeCore.state.stamina,day:homeCore.state.day,slot:homeCore.state.slot};});
    assert.deepEqual(applied,{stock:{lemon:92,mint:96},stamina:82,day:3,slot:1});
    await page.evaluate(()=>startHome());await page.locator(t("home-shisha-recipe")).click();await recipe.waitFor();
    await page.evaluate(()=>{homeCore.newGame();window.newHomeOwner=JSON.stringify(homeCore.state);});await recipe.click();
    assert.equal(await page.evaluate(async()=>{const applied=await homeUiRun;return applied===false&&JSON.stringify(homeCore.state)===newHomeOwner;}),true);
  },{viewport:{width:591,height:1280}});

  await check("learned-pull-options-and-omen-fit",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      const growth=await import("./js/core/growth.js"),{NODES}=await import("./js/core/growth-board-layout.js");growth.setGrowthPreview(true);
      Object.assign(growth.ensureGrowth(),{nodes:["M-S4","M-B3",NODES.find(n=>n.feature==="omen").id],learned:["M-S4","M-B3"]});
      const session=await import("./js/craft/session.js");session.craftTest.auto=null;
      window.optionsCs=session.newSession("tournament");optionsCs.steam={score:80,temp:.88};session.openBench(optionsCs);
      window.optionsRun=(await import("./js/craft/pull.js")).runPull(optionsCs);
    });
    await page.waitForFunction(()=>{const n=document.querySelector('[data-test="pull-omen"]');if(!n?.textContent)return false;const at=performance.now();Object.defineProperty(performance,"now",{configurable:true,value:()=>at});return true;});assert.match(await page.locator(t("pull-omen")).innerText(),/熱|焦げ/);
    await assertFits(page,'[data-test="pull-stop"],[data-test="pull-deep"],[data-test="pull-blind"],[data-test="pull-serve"],[data-test="pull-omen"]');
  },{viewport:{width:591,height:1280}});

  await check("floral-layers-through-real-care",async(page)=>{
    await setupDaily(page);
    const report=await page.evaluate(async()=>{
      const growth=await import("./js/core/growth.js");growth.setGrowthPreview(true);Object.assign(growth.ensureGrowth(),{nodes:["M-B2"],learned:["M-B2"]});
      const session=await import("./js/craft/session.js"),pull=await import("./js/craft/pull.js"),score=await import("./js/craft/score.js");session.craftTest.auto="good";
      const cs=session.newSession("tournament");cs.chapter=2;cs.mix={rose:6,lavender:6};cs.steam={score:100,temp:.5};session.openBench(cs);
      await pull.runPull(cs);const before=score.bonusOf(cs).bonus;
      const first=document.querySelector('[data-test="floral-layer"]')?.textContent;
      await pull.runCare(cs,{round:1});const one=score.bonusOf(cs).bonus,second=document.querySelector('[data-test="floral-layer"]')?.textContent;
      await pull.runCare(cs,{round:2});const two=score.bonusOf(cs).bonus,third=document.querySelector('[data-test="floral-layer"]')?.textContent;
      return {before,one,two,first,second,third,care:cs.careHistory.length,failed:cs.failed||null};
    });
    assert.equal(report.before,0);assert.equal(report.one,2);assert.equal(report.two,4);assert.equal(report.care,2);assert.equal(report.failed,null);
    assert.match(report.first,/ラベンダー|ローズ/);assert.match(report.second,/ラベンダー|ローズ/);assert.notEqual(report.first,report.second);assert.match(report.third,/重なった花の余韻/);
  });

  await check("blind-service-roll-is-fixed",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      const growth=await import("./js/core/growth.js");growth.setGrowthPreview(true);Object.assign(growth.ensureGrowth(),{nodes:["M-B3"],learned:["M-B3"]});
      const session=await import("./js/craft/session.js");session.craftTest.auto="good";Math.random=()=>.9;
      window.blindCs=session.newSession("tournament");blindCs.chapter=2;blindCs.steam={score:100,temp:(await import("./js/craft/temperature-model.js")).temperatureBands(blindCs).center};
      session.openBench(blindCs);window.blindRun=(await import("./js/craft/pull.js")).runPull(blindCs);
    });
    await page.locator(t("pull-blind")).click();await assertFits(page,t("pull-blind"));
    const result=await page.evaluate(async()=>{await blindRun;const core=await import("./js/core/state.js"),score=await import("./js/craft/score.js");
      const first=score.bonusOf(blindCs);core.state.flags._growth_test_craft=blindCs;core.save();core.load();const copy=core.state.flags._growth_test_craft;
      return {variance:blindCs.blindVariance,chosen:blindCs.blindService,bonus:first.bonus,again:score.bonusOf(copy).bonus,notes:first.notes};});
    assert(Math.abs(result.variance-2.4)<1e-10);assert.equal(result.chosen,true);assert(Math.abs(result.bonus-2.4)<1e-10);assert.equal(result.again,result.bonus);assert(result.notes.some(n=>n.startsWith("白紙の味カード")));
  },{viewport:{width:591,height:1280}});

  await check("K20-stat-replacement-keeps-save-and-fire",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      const core=await import("./js/core/state.js"),growth=await import("./js/core/growth.js"),b=await import("./js/core/growth-board.js");
      growth.setGrowthPreview(true);core.state.chapter=2;growth.ensureGrowth().hidane.any=30;
      const route=b.pathTo("K20",new Set());b.commitPending(route.path);
      window.oldK20=JSON.stringify({nodes:core.state.growth.nodes,paid:core.state.growth.paid,hidane:core.state.growth.hidane,day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,stats:core.state.stats});
      core.state.schema=24;core.save();core.load();growth.ensureGrowth();
      window.k20Board=(await import("./js/daily/growth-board-screen.js")).openBoard({place:"kannon"});
    });
    const node=page.locator(t("board-node-K20"));await node.waitFor();assert.match(await node.getAttribute("class"),/gb-node stat/);
    await node.click();assert.match(await page.locator(t("board-perk")).innerText(),/好感度.*＋2%/);
    assert.doesNotMatch(await page.locator(t("board-preview")).innerText(),/差し入れ|手土産/);
    assert.match(await page.locator(t("board-tab-body")).getAttribute("aria-label"),/\/27/);
    await page.locator(t("board-close")).click();
    assert.equal(await page.evaluate(async()=>{await k20Board;const core=await import("./js/core/state.js");core.save();core.load();return JSON.stringify({nodes:core.state.growth.nodes,paid:core.state.growth.paid,hidane:core.state.growth.hidane,day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,stats:core.state.stats})===oldK20;}),true);
  },{viewport:{width:591,height:1280}});

  await check("tournament-insurance-only-once",async(page)=>{
    await setupDaily(page);
    for(const enabled of [false,true]){
      await page.evaluate(async(enabled)=>{
        const core=await import("./js/core/state.js"),growth=await import("./js/core/growth.js"),{NODES}=await import("./js/core/growth-board-layout.js");
        core.newGame();growth.setGrowthPreview(true);growth.ensureGrowth().nodes=enabled?NODES.filter(n=>["insurance","omen"].includes(n.feature)).map(n=>n.id):[];
        const session=await import("./js/craft/session.js");session.craftTest.auto="bad";Math.random=()=>.5;
        window.insuranceCs=session.newSession("tournament");insuranceCs.steam={score:80,temp:.5};insuranceCs.leaf={hp:1,max:5,burn:0,dmg:10,steps:10};session.openBench(insuranceCs);
        window.insuranceRun=(await import("./js/craft/pull.js")).runPull(insuranceCs);
      },enabled);
      await page.locator(t("pull-stop")).waitFor();assert.equal(await page.locator(t("pull-omen")).count(),enabled?1:0);
      const result=await page.evaluate(async()=>{await insuranceRun;return {pulls:insuranceCs.pull.pulls,failed:insuranceCs.failed,used:insuranceCs.growthInsuranceUsed===true,kind:insuranceCs.growthInsuranceKind||null};});
      assert.deepEqual(result,{pulls:enabled?5:4,failed:"leaf",used:enabled,kind:enabled?"leaf":null});
    }
  });

  await check("single-leaf-style-lesson",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      const core=await import("./js/core/state.js"),growth=await import("./js/core/growth.js");growth.setGrowthPreview(true);
      Object.assign(growth.ensureGrowth(),{nodes:["M-S2"],learned:["M-S2"]});core.state.flavorMastery.double_apple=60;
      const session=await import("./js/craft/session.js");session.craftTest.auto=null;
      window.singleCs=session.newSession("rehearsal");singleCs.practiceKind="midcheck";session.openBench(singleCs);
      window.singleRun=(await import("./js/craft/steps.js")).stepMix(singleCs);
    });
    await page.locator(t("mix-single-style")).click();await assertFits(page,t("mix-single-style"));
    for(let i=0;i<11;i++)await page.locator(t("mix-plus-double_apple")).click();
    await page.locator(t("mix-plus-mint")).click();assert.equal(await page.locator(t("mix-ok")).isDisabled(),true);
    await page.locator(t("mix-minus-mint")).click();await page.locator(t("mix-plus-double_apple")).click();assert.equal(await page.locator(t("mix-ok")).isEnabled(),true);
    await page.locator(t("mix-ok")).click();
    const result=await page.evaluate(async()=>{await singleRun;return {mix:singleCs.mix,score:singleCs.mixInfo.score,style:singleCs.singleStyle};});
    assert.deepEqual(result,{mix:{double_apple:12},score:88,style:true});
  },{viewport:{width:591,height:1280}});

  await check("critical-coal-momentum-and-judge-memory",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      const core=await import("./js/core/state.js"),growth=await import("./js/core/growth.js");
      growth.setGrowthPreview(true);growth.ensureGrowth().nodes=["K15","K16","K10"];core.markMet("dr_kemuri");
      window.phaseSession=await import("./js/craft/session.js");window.phaseHeat=await import("./js/craft/heat.js");
      phaseSession.craftTest.auto=null;Math.random=()=>.5;
      window.phaseClock=1000;Object.defineProperty(performance,"now",{configurable:true,value:()=>phaseClock});
      const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>raf(()=>fn(phaseClock));
      window.phaseCs=phaseSession.newSession("tournament");phaseCs.growthPhases={holes:{precise:true}};
      phaseSession.openBench(phaseCs);window.phaseRun=phaseHeat.runHeat(phaseCs);
      window.phaseWidth=.5*(await import("./js/craft/common.js")).skill.window(phaseCs);
    });
    await page.waitForFunction(()=>document.querySelector('[data-test="coal-0"]')?.dataset.phase==="raw");
    await page.evaluate(()=>{phaseClock=1000+5790;});
    await page.locator(t("coal-0")).click();await page.locator(t("coal-1")).click();
    await page.evaluate(()=>{phaseClock=1000+(5.8+phaseWidth/2)*1000;});await page.locator(t("coal-2")).click();
    await page.locator(t("step-next")).waitFor();
    const result=await page.evaluate(()=>({score:phaseCs.heat.score,base:phaseCs.heat.growthBaseScore,criticals:phaseCs.heat.criticals,accuracy:phaseCs.heat.timingAccuracy,bonus:phaseCs.heat.growthPhaseBonus}));
    assert.deepEqual(result,{score:88.5,base:86.5,criticals:1,accuracy:85,bonus:2});
    await assertFits(page,t("judge-reception"));await page.locator(t("judge-reception")).click();
    await page.locator("#modal.show").waitFor();assert.match(await page.locator(".modal-body").innerText(),/炭焼き.*博士|炭焼き.*ケムリ/);
    await page.locator(".modal-actions button").click();await page.locator(t("step-next")).click();await page.evaluate(async()=>await phaseRun);
  },{viewport:{width:591,height:1280}});

  await check("zero-steam-and-deep-pull-lesson",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      const growth=await import("./js/core/growth.js");growth.setGrowthPreview(true);
      Object.assign(growth.ensureGrowth(),{nodes:["M-W4","M-S4","M-W5"],learned:["M-W4","M-S4","M-W5"]});
      window.lessonSession=await import("./js/craft/session.js");lessonSession.craftTest.auto=null;
      window.lessonCs=lessonSession.newSession("rehearsal");lessonCs.practiceKind="midcheck";lessonSession.openBench(lessonCs);
      window.lessonTimer=(await import("./js/craft/timer.js")).runSteamTimer(lessonCs);
    });
    await page.locator(t("timer-start")).waitFor();assert.equal(await page.locator(t("timer-start")).isEnabled(),true);
    await page.locator(t("timer-start")).click();await page.evaluate(async()=>{await lessonTimer;window.zeroRun=(await import("./js/craft/steam.js")).runSteamDodge(lessonCs);});
    await page.locator(t("step-next")).waitFor();assert.equal(await page.locator(t("dodge")).count(),0);
    const zero=await page.evaluate(()=>({seconds:lessonCs.steam.seconds,temp:lessonCs.steam.temp,precision:lessonCs.environment.precision}));
    assert.equal(zero.seconds,0);assert(zero.temp<.12);assert.equal(zero.precision,true);
    await page.locator(t("step-next")).click();await page.evaluate(async()=>{await zeroRun;window.deepRun=(await import("./js/craft/pull.js")).runPull(lessonCs);});
    await page.locator(t("pull-deep")).waitFor();await assertFits(page,'[data-test="pull-deep"],[data-test="pull-stop"],[data-test="pull-serve"]');await page.waitForFunction(()=>!document.querySelector('[data-test="pull-deep"]').disabled);
    const before=Number(await page.locator(t("pull-temperature")).getAttribute("aria-valuenow"));
    await page.locator(t("pull-deep")).click();await page.waitForFunction(()=>!document.querySelector('[data-test="pull-deep"]').disabled);
    const after=Number(await page.locator(t("pull-temperature")).getAttribute("aria-valuenow"));assert(after>before+.2);
    assert.match(await page.locator(t("pull-count")).getAttribute("aria-label"),/1/);
    await page.locator(t("pull-stop")).click();await page.waitForFunction(()=>!document.querySelector('[data-test="pull-serve"]').disabled);
    await page.locator(t("pull-serve")).click();await page.locator(t("step-next")).waitFor();await page.locator(t("step-next")).click();
    const completed=await page.evaluate(async()=>{await deepRun;return {pulls:lessonCs.pull.pulls,failed:lessonCs.failed||null};});
    assert.deepEqual(completed,{pulls:2,failed:null});
    assert.match(await page.locator(".bench-mode").innerText(),/PRACTICE.*手順の中間チェック/s);
    assert.match(await page.locator(".bench-hint").innerText(),/自分で吸って/);
  },{viewport:{width:591,height:1280}});

  await check("just-pull-smoke-rings",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      const growth=await import("./js/core/growth.js");growth.setGrowthPreview(true);growth.ensureGrowth().nodes=["K15","K21"];
      const session=await import("./js/craft/session.js");session.craftTest.auto="good";
      window.ringCs=session.newSession("tournament");ringCs.steam={score:100,temp:(await import("./js/craft/temperature-model.js")).temperatureBands(ringCs).center};session.openBench(ringCs);
      window.ringRun=(await import("./js/craft/pull.js")).runPull(ringCs);
    });
    await page.locator(t("pull-smoke-ring")).first().waitFor();
    const rings=await page.evaluate(async()=>{await ringRun;const score=await import("./js/craft/score.js");return {count:ringCs.pull.smokeRings,criticals:ringCs.pull.criticals,justs:ringCs.pull.justs,bonus:score.bonusOf(ringCs).bonus};});
    assert.equal(rings.count,3);assert.equal(rings.criticals,0); // 広がったジャスト帯の中心は0.5より右。通常ジャストと会心を混同しない。
    assert.equal(rings.justs,3);assert.equal(rings.bonus,1);
  });

  await check("dense-pack-new-and-legacy",async(page)=>{
    await setupDaily(page);
    for(const kind of ["new","learned","legacy","old-mode"]) {
      await page.evaluate(async(kind)=>{
        const core=await import("./js/core/state.js"),growth=await import("./js/core/growth.js");
        core.newGame();Object.assign(core.state,{phase:"daily",day:3,slot:1,stamina:90});growth.setGrowthPreview(kind!=="old-mode");
        if(kind==="learned")growth.ensureGrowth().nodes=["K18"];
        if(kind==="legacy"){core.state.schema=24;core.save();core.load();}
        window.packBefore=JSON.stringify({day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,stats:core.state.stats});
        const session=await import("./js/craft/session.js");session.craftTest.auto=null;
        window.packCs=session.newSession("rehearsal");session.openBench(packCs);
        window.packRun=(await import("./js/craft/steps.js")).stepPack(packCs);
      },kind);
      const firm=page.locator(t("opt-firm"));await firm.waitFor();assert.equal(await firm.isEnabled(),kind!=="new");
      await page.locator(t(kind==="new"?"opt-normal":"opt-firm")).click();await page.locator(t("pack-confirm")).click();
      const result=await page.evaluate(async()=>{await packRun;return {pack:packCs.pack,same:packBefore===JSON.stringify({day:__remake.state.day,slot:__remake.state.slot,stamina:__remake.state.stamina,stats:__remake.state.stats}),legacy:__remake.state.flags._dense_pack_legacy};});
      assert.equal(result.pack,kind==="new"?"normal":"firm");assert(result.same);
      if(kind==="legacy"||kind==="old-mode") assert.equal(result.legacy,true);
    }
  });

  await check("ordinary-conversation-smoke-hint",async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      const growth=await import("./js/core/growth.js"),core=await import("./js/core/state.js");growth.setGrowthPreview(true);growth.ensureGrowth().nodes=["K07"];
      window.hintVn=await import("./js/vn/engine.js");hintVn.vnTest.turbo=false;
      window.showHint=async(optional)=>{
        const {DB}=await import("./js/core/data.js"),source=DB.dialogues.ch1_naru_first;
        const choice=source.lines.find(line=>line.id==="naru_first_scout");window.hintText=choice.choices.map(c=>c.text);
        window.hintAbort=new AbortController();window.hintRun=hintVn.play({dialogue_id:source.dialogue_id,lines:[choice],branches:source.branches},{growthScene:optional,signal:hintAbort.signal});
      };
      await showHint(true);
    });
    await page.locator('.vn-choices.show').waitFor();assert.equal(await page.locator(".vn-choice.growth-hint").count(),1);
    assert.deepEqual(await page.locator(".vn-choice").allTextContents(),await page.evaluate(()=>hintText));
    assert.match(await page.locator(".vn-choice.growth-hint").evaluate(n=>getComputedStyle(n,"::before").content),/〰/);
    await page.evaluate(async()=>{hintAbort.abort();await hintRun;await showHint(false);});
    await page.locator('.vn-choices.show').waitFor();assert.equal(await page.locator(".vn-choice.growth-hint").count(),0);
    await page.evaluate(async()=>{hintAbort.abort();await hintRun;});
  });

  await check("bargain-price-checkout",async(page)=>{
    await setupDaily(page);
    const deal=await page.evaluate(async()=>{
      const growth=await import("./js/core/growth.js"),core=await import("./js/core/state.js"),shop=await import("./js/daily/shop.js"),{DB}=await import("./js/core/data.js");
      growth.setGrowthPreview(true);growth.ensureGrowth().nodes=["K23"];core.state.weatherSeed=42;
      const id=shop.SHOP_FLAVORS.find(id=>shop.shopFlavorPrice(DB.flavorById[id],shop.SHOP_FLAVORS)<DB.flavorById[id].price);
      const price=shop.shopFlavorPrice(DB.flavorById[id],shop.SHOP_FLAVORS);window.dealBefore={money:core.state.money,stock:shop.flavorStock(id),day:core.state.day,slot:core.state.slot,stamina:core.state.stamina};
      window.dealShop=shop.openShop();return {id,price};
    });
    await page.locator(t("shop-enter")).click();await page.locator(t(`buy-${deal.id}`)).click();
    const row=page.locator(".shop-row").filter({has:page.locator(t(`buy-${deal.id}`))});assert.match(await row.innerText(),/掘り出し物/);
    await page.locator(t("shop-checkout")).click();
    const result=await page.evaluate(async(id)=>{
      const core=await import("./js/core/state.js"),shop=await import("./js/daily/shop.js");
      return {cost:dealBefore.money-core.state.money,gained:shop.flavorStock(id)-dealBefore.stock,same:dealBefore.day===core.state.day&&dealBefore.slot===core.state.slot&&dealBefore.stamina===core.state.stamina};
    },deal.id);
    assert.deepEqual(result,{cost:deal.price,gained:50,same:true});
  });

  await check("tomorrow-weather-on-map-and-morning", async(page)=>{
    await setupDaily(page);
    const forecast=await page.evaluate(async()=>{
      const growth=await import("./js/core/growth.js"),core=await import("./js/core/state.js");
      growth.setGrowthPreview(true);growth.ensureGrowth().nodes=["K05"];core.state.weatherSeed=42;
      window.forecastBefore=JSON.stringify(core.state);const weather=await import("./js/daily/weather.js");
      window.forecastMap=(await import("./js/daily/map.js")).chooseSpot();return weather.tomorrowForecast();
    });
    await page.locator(".map:not(.done)").waitFor();assert.match(await page.locator(".mi-foot").innerText(),new RegExp(`明日は${forecast}`));
    await page.evaluate(async()=>{const map=await import("./js/daily/map.js");map.interruptMap(null);await forecastMap;});
    await page.evaluate(async()=>{
      const wx=await import("./js/daily/weather.js"),ui=await import("./js/core/ui.js");
      window.forecastDay=ui.dayCard("DAY 3","朝の支度",{ms:2000,forecast:wx.tomorrowForecast()});
    });
    await page.locator(t("day-forecast")).waitFor();assert.equal(await page.locator(t("day-forecast")).innerText(),`明日は${forecast}`);
    await page.waitForFunction(() => { const card=document.querySelector(".day-card.show:not(.out)"); return card && new DOMMatrix(getComputedStyle(card).transform).isIdentity; });
    await assertFits(page,t("day-forecast"));await page.evaluate(async()=>await forecastDay);
    assert.equal(await page.evaluate(()=>JSON.stringify(__remake.state)===forecastBefore),true);
  },{viewport:{width:591,height:1280}});

  await check("mix-recall-and-score-memo", async(page)=>{
    await setupDaily(page);
    await page.evaluate(async()=>{
      window.memoCore=await import("./js/core/state.js");const growth=await import("./js/core/growth.js");
      const memory=await import("./js/core/growth-memory.js");growth.setGrowthPreview(true);growth.ensureGrowth().nodes=["K02","K24"];
      memory.rememberGrowthMix(memoCore.state,{lemon:9,mint:3});memoCore.state.recipes.ice_lemonade={day:1};
      memoCore.state.flavors=["lemon","mint"];memoCore.state.flavorStock={lemon:100,mint:100};
      window.memoSession=await import("./js/craft/session.js");memoSession.craftTest.auto=null;
      window.memoCs=memoSession.newSession("rehearsal");memoCs.staffPractice=true;memoSession.openBench(memoCs);
      window.memoMix=(await import("./js/craft/steps.js")).stepMix(memoCs);
    });
    await page.locator(".mix-recall summary").click();await page.locator(t("mix-recall-last")).click();
    assert.deepEqual(await page.evaluate(()=>memoCs.mix),{lemon:9,mint:3});
    assert.deepEqual(await page.evaluate(()=>memoCore.state.flavorStock),{lemon:100,mint:100});
    await assertFits(page,".mix-recall");await page.locator(t("mix-ok")).click();
    const score=await page.evaluate(async()=>{
      await memoMix;const {finalize}=await import("./js/craft/score.js");
      Object.assign(memoCs,{pack:"normal",steamSeconds:360,
        holes:{score:90,total:24,minimumComplete:true,outerEven:1,innerExcess:0},
        heat:{score:90,heatPower:70,heatStability:90,burnRisk:5,aromaRetention:90},
        steam:{score:90,hits:0,seconds:360,temp:.55},pull:{score:90,temp:.55,pulls:3},pullDone:true,
        careHistory:[{score:85},{score:85}]});
      finalize(memoCs);const score=memoCs.total;memoCore.save();memoCore.load();
      void(await import("./js/daily/status.js")).openStatus();return score;
    });
    await page.locator('.st-tab[data-tab="items"]').click();await page.locator(t("recipe-ice_lemonade")).click();
    await page.locator(t("recipe-detail")).waitFor();
    assert.match(await page.locator(t("recipe-detail")).innerText(),new RegExp(`直近の一台：${score.toFixed(1)}点`));
    assert.match(await page.locator(t("recipe-detail")).innerText(),/9g.*3g/s);
    await assertFits(page,t("recipe-detail"));await page.locator(t("status-close")).click();
  },{viewport:{width:591,height:1280}});

  for(const festa of [false,true]) await check(festa ? "festa-refresh-once" : "two-refresh-charges", async (page) => {
    await setupDaily(page);
    await page.evaluate(async(festa)=>{
      const growth=await import("./js/core/growth.js"),core=await import("./js/core/state.js");
      growth.setGrowthPreview(true);const g=growth.ensureGrowth();g.nodes=["K06","M-B6"];g.learned=festa?["M-B6"]:[];core.state.stats.guts=10;
      const session=await import("./js/craft/session.js"),steam=await import("./js/craft/steam.js");
      session.craftTest.auto=null;const cs=session.newSession("drill");cs.steamSeconds=180;
      session.openBench(cs);window.skillSteam=steam.runSteamDodge(cs);
    },festa);
    const button=page.locator(t("dodge-refresh"));
    await page.waitForFunction(()=>{const n=document.querySelector('[data-test="dodge-refresh"]');return n&&!n.disabled;});
    assert.equal(await button.getAttribute("data-remaining"),"2");
    await button.click();
    assert.equal(await button.getAttribute("data-remaining"),"1");assert.equal(await button.isEnabled(),true);
    const reach=await page.locator(".dodge-refresh-fx").last().evaluate(n=>parseFloat(n.style.getPropertyValue("--reach")));
    assert.equal(reach,festa?Math.hypot(784,414):90);
    await button.click();
    assert.equal(await button.getAttribute("data-remaining"),"0");assert.equal(await button.isDisabled(),true);
    assert.equal(await page.locator(".dodge-refresh-fx").last().evaluate(n=>n.style.getPropertyValue("--reach")),"45px");
    await page.evaluate(async()=>{(await import("./js/core/state.js")).newGame();await window.skillSteam;});
  });

  await check("replacement-coal-window", async (page) => {
    await setupDaily(page);
    await page.evaluate(async()=>{
      window.skillCore=await import("./js/core/state.js");window.skillGrowth=await import("./js/core/growth.js");
      window.skillSession=await import("./js/craft/session.js");window.skillHeat=await import("./js/craft/heat.js");
      window.skillCommon=await import("./js/craft/common.js");
      window.coalClock=1000;Object.defineProperty(performance,"now",{configurable:true,value:()=>window.coalClock});
      const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(()=>fn(window.coalClock));
      Math.random=()=>.5;skillSession.craftTest.auto=null;
      window.startSkillCoal=async({enabled,replacement})=>{
        skillCore.newGame();skillGrowth.setGrowthPreview(enabled);skillGrowth.ensureGrowth().nodes=["K11"];
        coalClock=1000;const cs=skillSession.newSession("tournament");skillSession.openBench(cs);
        await skillSession.waitBenchReady(cs,"heat");const panel=skillSession.stepPanel("heat","炭の交換");
        window.baseCoalWindow=.5*skillCommon.skill.window(cs);
        window.skillCoal=skillHeat.burnCoals(cs,panel,{count:1,compact:true,replacement});
      };
    });
    for(const [enabled,replacement,phase] of [[true,false,"hot"],[true,true,"just"],[false,true,"hot"]]) {
      await page.evaluate(args=>startSkillCoal(args),{enabled,replacement});
      await page.waitForFunction(()=>document.querySelector('[data-test="coal-0"]')?.dataset.phase==="raw");
      await page.evaluate(()=>{coalClock=1000+(5.8+baseCoalWindow+.03)*1000;});
      await page.waitForTimeout(40);await page.locator(t("coal-0")).click();
      const result=await page.evaluate(async()=>await window.skillCoal);
      assert.equal(result.timings[0].phase,phase);
    }
  });

  await check("scene-completion-transactions", async (page) => {
    await setupDaily(page);
    const report = await page.evaluate(async () => {
      const core=await import("./js/core/state.js"), stats=await import("./js/core/stats.js");
      const vn=await import("./js/vn/engine.js"), growth=await import("./js/core/growth.js");
      vn.vnTest.turbo=true; growth.setGrowthPreview(true);
      const scene={dialogue_id:"__growth_scene",lines:[{speaker:"hajime",text:"今日、見つけたことを振り返る。"}]};
      const raw=JSON.stringify(core.state.stats);
      const action=opts=>stats.paidAction(async()=>{stats.addStamina(-4);await vn.play(scene,opts);});
      await action({growthScene:true}); const first=core.state.growth.xp;
      core.save();core.load();await action({growthScene:true});const repeat=core.state.growth.xp;
      await stats.paidAction(async()=>{stats.addStamina(-4);await vn.play({...scene,dialogue_id:"__partial_scene"},{growthScene:true,fromLine:0});});
      await stats.paidAction(async()=>{stats.addStamina(-4);await vn.play({...scene,dialogue_id:"__forced_scene"});});
      await stats.paidAction(async()=>{
        stats.addStamina(-4);const controller=new AbortController();
        const playing=vn.play({...scene,dialogue_id:"__cancelled_scene"},{growthScene:true,signal:controller.signal});
        controller.abort();await playing;
      });
      await vn.play({...scene,dialogue_id:"__free_scene"},{growthScene:true});
      const after={xp:core.state.growth.xp,read:[...core.state.growth.read],sameRaw:raw===JSON.stringify(core.state.stats)};
      await stats.paidAction(async()=>{
        stats.addStamina(-4);const playing=vn.play({...scene,dialogue_id:"__old_owner_scene"},{growthScene:true});
        core.newGame();await playing;
      });
      return {first,repeat,after,loadedXp:core.state.growth?.xp||0};
    });
    assert.deepEqual(report,{first:20,repeat:20,after:{xp:20,read:["__growth_scene"],sameRaw:true},loadedXp:0});
  });

  await check("recipe-experience-through-mix", async (page) => {
    await setupDaily(page);
    const report=await page.evaluate(async()=>{
      const core=await import("./js/core/state.js"),stats=await import("./js/core/stats.js"),growth=await import("./js/core/growth.js");
      const craft=await import("./js/craft/session.js"),steps=await import("./js/craft/steps.js");
      growth.setGrowthPreview(true);craft.craftTest.auto="good";
      core.state.flavors=["double_apple","mint"];core.state.flavorStock={double_apple:100,mint:100};
      core.state.recipes={};const raw=JSON.stringify(core.state.stats);
      const mix=()=>stats.paidAction(async()=>{
        stats.addStamina(-4);const cs=craft.newSession("rehearsal");cs.staffPractice=true;
        craft.openBench(cs);await steps.stepMix(cs);return cs.mixInfo.recipe?.id;
      });
      const first=await mix(),xp=core.state.growth.xp;
      core.save();core.load();await mix();
      return {recipe:first.value,xp,repeated:core.state.growth.xp,raw:raw===JSON.stringify(core.state.stats),read:core.state.growth.discoveries.recipes};
    });
    assert.deepEqual(report,{recipe:"sumi_basic",xp:30,repeated:30,raw:true,read:["sumi_basic"]});
  });

  await check("flag-off-hides-everything", async (page) => {
    await page.evaluate(async () => (await import("./js/core/growth.js")).setGrowthPreview(false));
    await setupDaily(page);
    assert.equal(await page.evaluate(async () => (await import("./js/core/growth.js")).growthEnabled()), false);
    assert.equal(await page.locator(t("hud-exp")).isVisible(), false);
    assert.equal(await page.locator(t("hud-hidane")).isVisible(), false);
    assert.equal(await page.evaluate(() => __remake.state.growth), undefined);
  });

  await check("ordinary-kannon-visit-keeps-slot-setting", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), s = core.state;
      (await import("./js/core/growth.js")).setGrowthPreview(false);
      Object.assign(s, { day: 5, slot: 0 }); s.met.adam = true;
      Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true,
        _delivery_minto_done: true, _lime_tut: true, _lime_opened: true,
        _tsumugi_contest_research: true, _tsumugi_contest_progress: true,
        _spot_seen_kannon_adam_pakki: true, _spot_guide_adam: true, pakki_app_installed: true });
      Object.assign(s.reel, { installed: true, introDone: true, settingGuideDone: true,
        setting: 6, settingDraws: 4, settingSince: { chapter: 1, day: 5 }, lastChapter: 1 });
      core.config.textSpeed = 4;
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      (await import("./js/chapters/ch1.js")).setupHooks();
      window.ordinaryVisit = (await import("./js/daily/calendar.js")).runDaily({ nightEvents: {} });
    });
    await page.locator('.map:not(.done)').waitFor();
    await page.locator(t("pin-kannon")).click();
    await page.locator(t("map-go")).click();
    await page.waitForFunction(() => __remake.state.slot === 1, null, { timeout: 30000 });
    const after = await page.evaluate(() => ({ setting: __remake.state.reel.setting,
      draws: __remake.state.reel.settingDraws, since: __remake.state.reel.settingSince,
      visit: __remake.state.visitedDay.kannon, seen: __remake.state.flags._spot_seen_kannon_adam_pakki }));
    assert.deepEqual(after, { setting: 6, draws: 4, since: { chapter: 1, day: 5 }, visit: 5, seen: true });
  });

  // #1807: the real map and HUD entry points, with Adam unvisited.
  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["portrait", { viewport: { width: 591, height: 1280 } }],
  ]) {
    await check(`${label}-reflection-entry`, async (page) => {
      const tap = async (sel) => {
        const node = page.locator(sel).first();
        await node.scrollIntoViewIfNeeded();
        if (options.hasTouch) await node.tap(); else await node.click();
      };
      await setupDaily(page);
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        core.config.textSpeed = 4;
        Object.assign(core.state, { day: 6, slot: 0 });
        window.entryStatus = 0;
        (await import("./js/daily/hud.js")).initHud({ status: () => { window.entryStatus++; } });
        (await import("./js/daily/hud.js")).showHud(true);
        window.entryMap = async () => {
          const map = await import("./js/daily/map.js");
          window.entryFlow = map.chooseSpot().then(async id => {
            if (id === "kannon") await (await import("./js/core/growth.js")).reflectAtSpot(id);
          });
        };
        await window.entryMap();
      });
      await page.locator(".map:not(.done)").waitFor();
      assert.equal(await page.locator(t("pin-kannon")).count(), 0);
      await page.evaluate(async () => {
        const map = await import("./js/daily/map.js");
        map.interruptMap(null); await window.entryFlow;
        const growth = await import("./js/core/growth.js");
        growth.gainExp(205); growth.settleGrowth();
        __remake.state.stats.guts = 100;
        __remake.state.stamina = 81;
        const stats = await import("./js/core/stats.js");
        window.entryMaximum = stats.maxStamina();
        window.entryCondition = stats.currentCondition().health;
        window.entryRawStats = JSON.stringify(__remake.state.stats);
        window.entryBefore = { day: __remake.state.day, slot: __remake.state.slot, stamina: __remake.state.stamina };
        Object.assign(__remake.state.reel, { installed: true, introDone: true, settingGuideDone: true,
          setting: 6, settingDraws: 4, settingSince: { chapter: 1, day: 3 }, settingNotice: false, resetNext: true });
        window.entryReel = JSON.stringify(__remake.state.reel);
        await window.entryMap();
      });
      await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
      await page.locator(t("kannon-hidane")).waitFor();
      assert.equal(await page.evaluate(() => !!__remake.state.flags._spot_guide_adam || !!__remake.state.met.adam), false);
      await assertFits(page, t("kannon-hidane"));
      await tap(t("hud-status"));
      await page.locator(`${t("growth-board")}[data-mode="view"]`).waitFor();
      assert.equal(await page.locator(t("board-light")).count(), 0);
      await tap('.gb-node[data-status="available"]');
      assert.equal(await page.locator(t("board-light")).count(), 0);
      await tap(t("board-close"));
      await page.locator(t("growth-board")).waitFor({ state: "detached" });
      assert.equal(await page.evaluate(() => __remake.state.growth.hidane.any), 2); // レベル1つで火種2つ（SBD60）
      assert.equal(await page.evaluate(() => window.entryStatus), 0);
      await tap(t("pin-kannon")); await tap(t("map-go"));
      await tap(t("kannon-reflect"));
      for (let i = 0; i < 60 && !(await page.locator(t("growth-board")).count()); i++) {
        const next = page.locator(".vn-box");
        if (await next.isVisible()) await tap(".vn-box");
        await page.waitForTimeout(150);
      }
      await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor();
      assert.equal(await page.evaluate(() => __remake.state.flags._kannon_growth_intro_done), true);
      assert.match(await page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(x => x.text).join(" ")), /三つの盤/);
      for (let i = 0; i < 2; i++) { // 火種2つを使い切る
        await tap(i === 0 ? t("board-node-B1") : '.gb-node[data-status="available"]');
        await tap(t("board-light"));
      }
      await tap(t("board-decide"));
      await page.locator(t("growth-board")).waitFor({ state: "detached" });
      const maximum = await page.evaluate(async () => (await import("./js/core/stats.js")).maxStamina());
      assert(maximum >= await page.evaluate(() => window.entryMaximum) + 2, "旧最大体力160にもB1の+2を加算する");
      assert.equal(await page.evaluate(async () => (await import("./js/core/stats.js")).currentCondition().health),
        await page.evaluate(() => window.entryCondition));
      assert.equal(await page.evaluate(() => JSON.stringify(__remake.state.stats)), await page.evaluate(() => window.entryRawStats));
      await page.evaluate(async () => { await window.entryFlow; await window.entryMap(); });
      await page.locator(".map:not(.done)").waitFor();
      assert.equal(await page.locator(t("kannon-hidane")).count(), 0);
      assert.equal(await page.locator(t("hud-hidane")).isVisible(), false);
      assert.equal(await page.locator(t("pin-kannon")).count(), 1);
      assert.deepEqual(await page.evaluate(() => ({ day: __remake.state.day, slot: __remake.state.slot, stamina: __remake.state.stamina })),
        await page.evaluate(() => window.entryBefore));
      assert.equal(await page.evaluate(() => JSON.stringify(__remake.state.reel)), await page.evaluate(() => window.entryReel));
      const saved = await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        const before = JSON.stringify(core.state.growth);
        core.load();
        return { before, after: JSON.stringify(core.state.growth), intro: core.state.flags._kannon_growth_intro_done,
          reel: JSON.stringify(core.state.reel) };
      });
      assert.equal(saved.before, saved.after);
      assert.equal(saved.intro, true);
      assert.equal(saved.reel, await page.evaluate(() => window.entryReel));
      assert.equal(await page.evaluate(async () => (await import("./js/core/stats.js")).maxStamina()), maximum);
      await tap(t("hud-status"));
      assert.equal(await page.evaluate(() => window.entryStatus), 1);
    }, options);
  }

  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["portrait", { viewport: { width: 591, height: 1280 } }], // スマホ縦は横向きの案内になるため窓の縦長で見る
  ]) {
    await check(`${label}-gauge-chip-night`, async (page) => {
      const tap = (sel) => !options.hasTouch ? page.locator(sel).click() : page.locator(sel).tap();
      await setupDaily(page);
      const exp = page.locator(t("hud-exp"));
      await exp.waitFor();
      assert.match(await exp.innerText(), /Lv\.1[\s\S]*あと205/);

      // 自由行動1回 → チップ1枚（内訳の数字は出さない）
      await page.evaluate(async () => {
        const stats = await import("./js/core/stats.js");
        __remake.state.met.naru = true;
        await stats.paidAction(async () => { stats.addStamina(-16); return true; }, { exp: { key: "naru", person: "naru" } });
      });
      const chip = page.locator(t("exp-chip"));
      await chip.waitFor();
      assert.match(await chip.innerText(), /EXP \+70[\s\S]*はじめて/);
      assert.match(await exp.innerText(), /あと135/);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/growth-levelup-${label}-chip.png` });

      // 満タンを越えても日中は上がらない
      await page.evaluate(async () => (await import("./js/core/growth.js")).gainExp(400));
      await page.waitForFunction(() => /今夜 Lv UP/.test(document.querySelector('[data-test="hud-exp"]').textContent));
      assert.equal(await page.evaluate(() => __remake.state.growth.level), 1);
      await page.waitForFunction(() => !document.querySelector('[data-test="exp-chip"]'));
      await assertFits(page, '[data-test="hud-exp"]');

      // 寝る前: 初回はフル演出。押すと最後まで早送り → OK
      await page.evaluate(async () => {
        window.night = null;
        void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
      });
      const panel = page.locator(t("levelup"));
      await panel.waitFor();
      await tap(".levelup-backdrop");
      const ok = page.locator(t("levelup-ok"));
      await page.waitForFunction(() => document.querySelector(".levelup")?.classList.contains("lu-settled-state"));
      const text = await panel.innerText();
      assert.match(text, /Lv\.1 → Lv\.3/);
      assert.match(text, /火種 ＋4/, "レベル1つで火種2つ");
      assert.doesNotMatch(text, /？？？/, "名乗っていない相手の名前は出さない");
      await assertFits(page, '[data-test="levelup-ok"]');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/growth-levelup-${label}-full.png` });
      await tap(t("levelup-ok"));
      await page.waitForFunction(() => window.night?.to === 3);
      await panel.waitFor({ state: "detached" });
      const badge = page.locator(t("hud-hidane"));
      await badge.waitFor();
      assert.equal(await badge.innerText(), "4");
      assert.match(await exp.innerText(), /Lv\.3/);

      // ふだんの1レベルは短い帯で、押さなくても消える
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js");
        g.gainExp(g.totalExpFor(4) - __remake.state.growth.xp);
        window.night = null;
        void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
      });
      const band = page.locator(t("levelup-band"));
      await band.waitFor();
      assert.match(await band.innerText(), /Lv\.3 → 4[\s\S]*火種 ＋2/);
      await page.waitForFunction(() => document.querySelector('[data-test="levelup-band"]')?.classList.contains("show"));
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/growth-levelup-${label}-band.png` });
      await page.waitForFunction(() => window.night?.to === 4, null, { timeout: 5000 });
      await band.waitFor({ state: "detached" });
      assert.equal(await badge.innerText(), "6");

      // 保存・読込で残る
      await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.save(); core.load(); });
      assert.equal(await page.evaluate(() => __remake.state.growth.level), 4);
    }, options);
  }

  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`${label}-board-from-levelup`, async (page) => {
      const tap = (sel) => !options.hasTouch ? page.locator(sel).click() : page.locator(sel).tap();
      await setupDaily(page);
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js");
        g.gainExp(g.totalExpFor(3));
        window.night = null;
        void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
      });
      await page.locator(t("levelup")).waitFor();
      await tap(".levelup-backdrop");
      await page.waitForFunction(() => document.querySelector(".levelup")?.classList.contains("lu-settled-state"));
      await tap(t("levelup-board"));
      const board = page.locator(t("growth-board"));
      await board.waitFor();
      // 寝る前・メニューからは見るだけ（灯すのは参拝の場所。SPEC 2.8）
      assert.equal(await board.getAttribute("data-mode"), "view");
      assert.match(await page.locator(t("board-place")).innerText(), /見るだけ/);
      assert.match(await page.locator(t("board-wallet")).innerText(), /白火\s*4/, "Lv.1→3 で白火4");
      const ids = await page.evaluate(async () => {
        const b = await import("./js/core/growth-board.js");
        const first = b.boardNodes("body").find((n) => n.kind === "stat" && n.links.includes(b.HUB)).id;
        return { first, far: b.NODE_BY_ID[first].links.find((l) => l !== b.HUB) };
      });
      assert.equal(await page.locator(t(`board-node-${ids.first}`)).getAttribute("data-status"), "available");
      assert.equal(await page.locator(t(`board-node-${ids.far}`)).getAttribute("data-status"), "far");
      await tap(t("board-node-K03"));
      assert.match(await page.locator(t("board-preview")).innerText(), /スキル「早寝早起き」[\s\S]*まだ道がつながっていない/);
      assert.equal(await page.locator(t("board-light")).count(), 0, "見るだけの盤に「灯す」は無い");
      await tap(t("board-target"));
      assert.equal(await page.evaluate(() => __remake.state.growth.target), "K03", "目標は見るだけの盤でも決められる");
      await tap(t("board-close"));
      await board.waitFor({ state: "detached" });
      await page.waitForFunction(() => window.night?.to === 3);

      // 観音堂で内省 → 灯せる。目標まで灯す → 決定
      await page.evaluate(() => { window.lit = null; void import("./js/core/growth.js").then((g) => g.openGrowthBoard({ place: "kannon" })).then((r) => { window.lit = r; }); });
      await board.waitFor();
      assert.equal(await board.getAttribute("data-mode"), "light");
      assert.match(await page.locator(t("board-place")).innerText(), /観音堂で内省/);
      assert.match(await page.locator(t("board-preview")).innerText(), /早寝早起き/, "目標のマスが選ばれた状態で開く");
      await tap(t("board-towards"));
      const pend = await page.locator('[data-status="pending"]').count();
      assert.ok(pend >= 1 && pend <= 4, `火種4の分だけ道を仮置き（${pend}）`);
      await tap(t("board-tab-wisdom"));
      assert.equal(await page.locator(t("board-node-K01")).count(), 1, "札で理論盤へ");
      await assertFits(page, '[data-test="board-decide"], [data-test="board-close"], [data-test="board-tab-body"], [data-test="board-tab-wisdom"]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/growth-board-${label}.png` });
      await tap(t("board-decide"));
      await board.waitFor({ state: "detached" });
      await page.waitForFunction(() => Array.isArray(window.lit));
      assert.equal(await page.evaluate(() => __remake.state.growth.nodes.length), pend);
      assert.equal(await page.evaluate(() => __remake.state.growth.hidane.any), 4 - pend);
      await page.locator(".gain-card", { hasText: "能力の火" }).waitFor();
    }, options);
  }

  // 大会前夜の内省（SPEC 2.8・#1690）: 火種が残っていれば一度だけ、場面のあと灯せる盤が開く
  await check("eve-reflection-once", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      (await import("./js/core/growth.js")).ensureGrowth().hidane.any = 3;
      window.eve = null;
      void (await import("./js/daily/reflection.js")).eveReflection("kannon").then((r) => { window.eve = r; });
    });
    const board = page.locator(t("growth-board"));
    await board.waitFor({ timeout: 15000 });
    assert.equal(await board.getAttribute("data-mode"), "light");
    assert.match(await page.locator(t("board-place")).innerText(), /観音堂で内省/);
    await page.locator(t("board-close")).click();
    await page.waitForFunction(() => window.eve === true);
    assert.equal(await page.evaluate(async () => (await import("./js/daily/reflection.js")).eveReflection("kannon")), false, "同じ章の前夜は一度だけ");
  }, { viewport: { width: 1331, height: 760 } });

  // 章の範囲は章の数を出さず封で見せ、章が進んで初めて開くと「封が解けた」（SBD42）。ご褒美だけの夜は短い帯（SBD39・40）
  await check("chapter-seal-and-gifts", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => { (await import("./js/core/growth.js")).ensureGrowth().hidane.any = 2; void (await import("./js/core/growth.js")).openGrowthBoard(); });
    const board = page.locator(t("growth-board"));
    await board.waitFor();
    const text = await board.innerText();
    assert.doesNotMatch(text, /[0-9０-９]章/, "盤に章の数を書かない");
    assert.ok(await page.locator('[data-status="locked"]').count() > 0);
    assert.equal(await page.locator(t("board-opened")).count(), 0, "第1章では演出なし");
    await page.locator(t("board-close")).click();
    await board.waitFor({ state: "detached" });
    await page.evaluate(async () => { __remake.state.chapter = 2; void (await import("./js/core/growth.js")).openGrowthBoard(); });
    await page.locator(t("board-opened")).waitFor();
    assert.match(await page.locator(t("board-opened")).innerText(), /結界が解けた/);
    assert.ok(await page.locator(".gb-node.just-opened").count() > 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/growth-board-unseal.png` });
    await page.locator(t("board-close")).click();
    await board.waitFor({ state: "detached" });
    await page.evaluate(async () => { void (await import("./js/core/growth.js")).openGrowthBoard(); });
    await board.waitFor();
    assert.equal(await page.locator(t("board-opened")).count(), 0, "演出は一度だけ");
    await page.locator(t("board-close")).click();
    await board.waitFor({ state: "detached" });
    // くじを引き切った夜（レベルは上がっていない）
    await page.evaluate(async () => {
      __remake.state.kuji = { g500: { order: [0], drawn: 1, emptyDay: 3 } };
      window.night = null;
      void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
    });
    const band = page.locator(t("gift-band"));
    await band.waitFor();
    assert.match(await band.innerText(), /くじのラストワン賞[\s\S]*紅火 ＋1/);
    await assertFits(page, '[data-test="gift-band"]');
    await page.waitForFunction(() => window.night?.gifts?.length === 1, null, { timeout: 8000 });
  }, { viewport: { width: 1331, height: 760 } });

  // 既存スミ授業を実際のVNで中断→途中保存→再相談。好感度0でも、盤から同じ機能が開く。
  for (const id of ["M-S1", "M-W1"]) {
    await check(`sumi-${id}-resume`, async (page) => {
      await setupDaily(page);
      await page.evaluate(async (id) => {
        const g = await import("./js/core/growth.js");
        const b = await import("./js/core/growth-board.js");
        const node = b.NODE_BY_ID[id];
        const gr = g.ensureGrowth();
        __remake.state.affinity.sumi = 0;
        __remake.state.flags._intro_sumi = true;
        // 第1章の道と3段までの能力マスは既に灯した状態。
        gr.nodes = b.boardNodes(node.board).filter((n) => n.kind === "stat" && n.ring === 1).map((n) => n.id);
        if (!b.commitPending([id]).length) throw new Error("授業が灯せない");
        window.lessonAbort = new AbortController();
        window.lessonDone = null;
        void g.consultLessons("sumi", { only: id, signal: window.lessonAbort.signal }).then((r) => { window.lessonDone = r; });
      }, id);
      await page.locator("#vn.active").waitFor();
      const interrupted = await page.evaluate(async (id) => {
        const core = await import("./js/core/state.js");
        const g = await import("./js/core/growth.js");
        const b = await import("./js/core/growth-board.js");
        const flag = b.NODE_BY_ID[id].unlocks[0];
        core.save();
        window.lessonAbort.abort();
        return !!core.state.flags[flag];
      }, id);
      assert.equal(interrupted, false);
      await page.waitForFunction(() => window.lessonDone !== null);
      assert.deepEqual(await page.evaluate(() => window.lessonDone), []);
      const result = await page.evaluate(async (id) => {
        const core = await import("./js/core/state.js");
        core.load();
        const g = await import("./js/core/growth.js");
        const b = await import("./js/core/growth-board.js");
        const flag = b.NODE_BY_ID[id].unlocks[0];
        const before = [core.state.day, core.state.slot, core.state.stamina, g.hidaneTotal()];
        (await import("./js/vn/engine.js")).vnTest.turbo = true;
        const done = await g.consultLessons("sumi", { only: id });
        core.load();
        return { done: done.map((l) => l.id), learned: !!core.state.flags[flag],
          repeat: await g.consultLessons("sumi", { only: id }), before,
          after: [core.state.day, core.state.slot, core.state.stamina, g.hidaneTotal()] };
      }, id);
      assert.deepEqual(result.done, [id]);
      assert.equal(result.learned, true);
      assert.deepEqual(result.repeat, []);
      assert.deepEqual(result.after, result.before);
    });
  }

  // 授業（SBD50）: 盤で灯すと「相談できる」。次に会った時に、はじめが相談して話を聞く場面を最後まで見て習得
  await check("lesson-consult", async (page) => {
    await setupDaily(page);
    const r = await page.evaluate(async () => {
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      const g = await import("./js/core/growth.js");
      const gr = g.ensureGrowth();
      gr.nodes.push("M-W2");
      const before = g.readyLessons("sumi").map((l) => l.id);
      const done = await g.consultLessons("sumi");
      return { before, done: done.map((l) => l.id), learned: g.lessonLearned("M-W2"),
        four: __remake.state.flags._coal_four_unlocked, mix: __remake.state.flags._coal_mix_unlocked, after: g.readyLessons("sumi").length };
    });
    assert.deepEqual(r.before, ["M-W2"]);
    assert.deepEqual(r.done, ["M-W2"]);
    assert.equal(r.learned, true);
    assert.equal(r.four, true, "四つ置きが開く");
    assert.equal(r.mix, true, "混ぜ置きが開く");
    assert.equal(r.after, 0);
    await page.locator(".gain-card", { hasText: "四つ置き" }).waitFor();
  }, { viewport: { width: 1331, height: 760 } });
  // 段はなくした（SBD63）: 盤の札は「n/26」、右のパネルは恩恵の横棒、ステータス画面は三角のグラフ
  await check("no-steps-graph", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      const g = (await import("./js/core/growth.js")).ensureGrowth();
      g.nodes.push("B1", "B2");
      void (await import("./js/core/growth.js")).openGrowthBoard();
    });
    await page.locator(t("board-tab-body")).waitFor();
    assert.match(await page.locator(t("board-tab-body")).innerText(), /才能盤\s*2\/27/);
    assert.equal(await page.locator(t("board-bars")).count(), 1, "恩恵の横棒");
    assert.doesNotMatch(await page.locator(t("growth-board")).innerText(), /\d段/, "盤に段の文字は無い");
    await page.locator(t("board-decide")).click();
    await page.waitForSelector(t("growth-board"), { state: "detached" });
    await page.evaluate(async () => { void (await import("./js/daily/status.js")).openStatus(); });
    await page.locator(t("board-radar")).waitFor();
    assert.match(await page.locator(t("st-board-body")).innerText(), /2\/27/);
    assert.doesNotMatch(await page.locator(".st-me").innerText(), /\d段/, "ステータスに段の文字は無い");
  }, { viewport: { width: 1331, height: 760 } });
  // 授業は会って相談した時だけ習う（SBD61）: 盤には LIME で聞く入口が無く、次に会った時と出る
  await check("lesson-in-person", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      const g = await import("./js/core/growth.js");
      const gr = g.ensureGrowth();
      __remake.state.affinity.rei = 1; // 会っている
      gr.nodes.push("M-B2");
      void g.openGrowthBoard();
    });
    await page.locator(t("board-tab-body")).click();
    await page.locator(t("board-node-M-B2")).click();
    await page.locator(".gb-p-state", { hasText: "次に" }).waitFor();
    assert.equal(await page.locator(t("board-lime-consult")).count(), 0, "LIME で聞くボタンは無い");
  }, { viewport: { width: 1331, height: 760 } });
  for (const [label, viewport] of [["pc", { width: 1280, height: 720 }], ["touch", { width: 844, height: 390 }]]) {
    await check(`pending-lesson-cycle-${label}`, async page => {
      await setupDaily(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(async () => {
        window.pendingCore = await import("./js/core/state.js");
        const growth = await import("./js/core/growth.js");
        const g = growth.ensureGrowth();
        Object.assign(g, { nodes: ["M-B4", "M-S6"], learned: ["M-S6"], paid: { "M-B4": {}, "M-S6": {} } });
        pendingCore.state.affinity.hiyori = 66;
        (await import("./js/core/cycle-start.js")).startNextCycle(
          (await import("./js/core/carry.js")).buildCarryPackage(pendingCore.state));
        pendingCore.state.phase = "daily";
        pendingCore.save(); pendingCore.load();
        window.pendingResources = JSON.stringify({ day: pendingCore.state.day, slot: pendingCore.state.slot,
          stamina: pendingCore.state.stamina, money: pendingCore.state.money, stats: pendingCore.state.stats,
          hidane: pendingCore.state.growth.hidane, paid: pendingCore.state.growth.paid, nodes: pendingCore.state.growth.nodes });
        if ((await growth.consultLessons("hiyori")).length) throw new Error("hearts required");
        void growth.openGrowthBoard({ place: "kannon" });
      });
      await page.locator(t("board-node-M-B4")).scrollIntoViewIfNeeded();
      await page.locator(t("board-node-M-B4")).click();
      assert.match(await page.locator(".gb-p-state").innerText(), /今の周.*♥5/);
      await assertFits(page, ".gb-p-state");
      await page.screenshot({ path: `${out}/pending-lesson-cycle-${label}.png` });
      await page.locator(t("board-close")).click();
      await page.locator(t("growth-board")).waitFor({ state: "detached" });
      await page.evaluate(async () => {
        pendingCore.state.affinity.hiyori = 66;
        pendingCore.save(); pendingCore.load();
        void (await import("./js/core/growth.js")).openGrowthBoard({ place: "kannon" });
      });
      await page.locator(t("board-node-M-B4")).scrollIntoViewIfNeeded();
      await page.locator(t("board-node-M-B4")).click();
      assert.match(await page.locator(".gb-p-state").innerText(), /相談できる。次に/);
      await page.locator(t("board-close")).click();
      await page.locator(t("growth-board")).waitFor({ state: "detached" });
      const result = await page.evaluate(async () => {
        const growth = await import("./js/core/growth.js");
        (await import("./js/vn/engine.js")).vnTest.turbo = true;
        const done = (await growth.consultLessons("hiyori")).map(l => l.id);
        pendingCore.load();
        const s = pendingCore.state;
        const same = JSON.stringify({ day: s.day, slot: s.slot, stamina: s.stamina, money: s.money,
          stats: s.stats, hidane: s.growth.hidane, paid: s.growth.paid, nodes: s.growth.nodes }) === pendingResources;
        const learned = growth.lessonLearned("M-B4");
        (await import("./js/core/cycle-start.js")).startNextCycle((await import("./js/core/carry.js")).buildCarryPackage(s));
        return { done, same, learned, cycle: pendingCore.state.cycle, hearts: pendingCore.state.affinity.hiyori || 0,
          effective: (await import("./js/core/growth-effects.js")).growthLesson(pendingCore.state, "M-B4"),
          repeat: (await growth.consultLessons("hiyori")).length };
      });
      assert.deepEqual(result, { done: ["M-B4"], same: true, learned: true, cycle: 3, hearts: 0, effective: true, repeat: 0 });
    }, { viewport, ...(label === "touch" ? { isMobile: true, hasTouch: true } : {}) });
  }
  await Promise.all(Array.from({length:2},async()=>{
    for(;;){const next=cases.shift();if(!next)return;await runCheck(...next);}
  }));
}, { entry: `${baseURL}?growth=1` });
