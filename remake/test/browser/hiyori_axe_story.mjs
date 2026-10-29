import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";
const required=["_hiyori_cracks_done","_hiyori_tonari_return_done","_hiyori_tonari_followup_done","_hiyori_tonari_afterwork_done"];
async function setup(page) {
  await page.evaluate(async required=>{
    window.S={core:await import("./js/core/state.js"),data:await import("./js/core/data.js"),vn:await import("./js/vn/engine.js"),
      daily:await import("./js/daily/hiyori.js"),route:await import("./js/core/hiyori-route.js"),axe:await import("./js/daily/hiyori-axe.js"),
      tonari:await import("./js/daily/tonari.js"),calendar:await import("./js/daily/calendar.js"),phone:await import("./js/daily/phone.js")};
    (await import("./js/chapters/ch1.js")).setupHooks();
    S.fresh=()=>{
      const s=S.core.newGame();Object.assign(s,{phase:"daily",day:10,slot:1,money:90000,stamina:80});
      s.met.hiyori=true;s.contacts.push("hiyori");s.affinity.hiyori=51;s.story.hiyori=2;
      s.flags._intro_hiyori=true;s.flags._hiyori_meeting_done=true;
      for(const f of required)s.flags[f]=true;
      Object.assign(s.flags,{_errand_scout_done:true,_delivery_adam_done:true,_delivery_minto_done:true,_lime_tut:true,_morning_10:true});
      S.core.config.textSpeed=4;S.vn.vnTest.turbo=true;return s;
    };S.fresh();
    S.before=()=>({money:S.core.state.money,stamina:S.core.state.stamina,slot:S.core.state.slot,
      affinity:S.core.state.affinity.hiyori,held:S.core.state.flags._hiyori_affinity_waiting_pts||0,story:S.core.state.story.hiyori||0,known:!!S.core.state.flags._hiyori_real_self_known});
  },required);
}
async function phase(page,value){await page.waitForFunction(value=>document.querySelector('[data-test="axe-game"]')?.dataset.phase===value,value);}
async function action(page,touch=false) {
  const button=page.locator('[data-test="axe-action"]:not([disabled])');await button.waitFor();
  if(touch)await button.tap();else await button.click();
}
async function finish(page,touch=false) {
  for(let n=0;n<3;n++) for(const p of ["choice","horizontal","vertical","power","result"]){await phase(page,p);await action(page,touch);}
  await phase(page,"summary");await action(page,touch);
}
async function start(page){await page.evaluate(()=>{S.started=S.before();S.run=S.daily.playHiyoriEvent("axe_reveal");});await phase(page,"choice");}
async function unchanged(page){assert.deepEqual(await page.evaluate(()=>S.before()),await page.evaluate(()=>S.started));}
await suite("hiyori-axe-story",async check=>{
  await check("read-gates-and-legacy-do-not-infer",async page=>{
    await setup(page);
    const result=await page.evaluate(required=>{
      const s=S.core.state;s.affinity.hiyori=100;s.lovers=["hiyori","rin"];s.flags._friend_hiyori=true;
      const gates=required.map(f=>{delete s.flags[f];const status=S.route.hiyoriEventStatus("axe_reveal");s.flags[f]=true;return status;});
      s.chapter=3;const chapter=S.route.hiyoriEventStatus("axe_reveal");s.chapter=1;s.slot=0;const time=S.route.hiyoriEventStatus("axe_reveal");s.slot=1;
      s.lovers=["rin"];s.affinity.hiyori=20;const low=S.route.hiyoriEventStatus("axe_reveal");s.affinity.hiyori=51;
      const saved=S.data.DB.dialogues.hiyori_axe_reveal_close;delete S.data.DB.dialogues.hiyori_axe_reveal_close;
      const missing=S.route.hiyoriEventStatus("axe_reveal");S.data.DB.dialogues.hiyori_axe_reveal_close={...saved,metadata:{preview_only:true}};
      const preview=S.route.hiyoriEventStatus("axe_reveal");S.data.DB.dialogues.hiyori_axe_reveal_close=saved;
      return {gates,chapter,time,low,missing,preview,known:!!s.flags._hiyori_real_self_known};
    },required);
    assert(result.gates.every(v=>v==="prerequisites"));assert.equal(result.chapter,"chapter");assert.equal(result.time,"time");
    assert.equal(result.low,"prerequisites");assert.equal(result.missing,"missing_script");assert.equal(result.preview,"missing_script");assert(!result.known);
  });
  for(const [label,options] of [["pc",{}],["touch",{viewport:{width:844,height:390},hasTouch:true,isMobile:true}]])
    await check(label+"-actual-three-throws-and-once",async page=>{
      await setup(page);await start(page);
      assert(!await page.evaluate(()=>S.daily.playHiyoriEvent("axe_reveal")),"A second start must not overlap");
      await unchanged(page);await finish(page,label==="touch");assert(await page.evaluate(()=>S.run));
      const result=await page.evaluate(async()=>{
        const done=S.before(),replay=await S.daily.playHiyoriEvent("axe_reveal");
        S.core.saveToSlot("suien_remake_slot1");S.core.newGame();S.core.loadFromSlot("suien_remake_slot1");
        return {done,replay,loaded:S.before(),work:!!S.core.state.flags._hiyori_work_talk_done,
          dialogues:S.vn.backlog().filter(l=>l.name==="ひより").map(l=>l.text)};
      });
      assert.equal(result.done.money,87000);assert.equal(result.done.stamina,70);assert.equal(result.done.slot,2);
      assert.equal(result.done.story,3);assert(result.done.known&&!result.replay&&!result.work);assert.deepEqual(result.loaded,result.done);
      assert.equal(result.done.affinity,59);assert.equal(result.done.held,0);assert(result.dialogues.some(t=>t.includes("よっしゃあ")));assert(result.dialogues.some(t=>t.includes("仕事で疲れてるのは")));
    },options);
  await check("cancel-and-unread-retry",async page=>{
    await setup(page);await start(page);await page.locator('[data-test="axe-cancel"]').click();assert(!await page.evaluate(()=>S.run));await unchanged(page);
    await page.evaluate(()=>{S.core.saveToSlot("suien_remake_slot1");S.core.newGame();S.core.loadFromSlot("suien_remake_slot1");});
    assert.equal(await page.evaluate(()=>S.route.hiyoriEventStatus("axe_reveal")),"ready");await start(page);await finish(page);assert(await page.evaluate(()=>S.run));
    assert.equal(await page.evaluate(()=>S.core.state.money),87000);
  });
  await check("full-game-with-unread-outro-is-not-completion",async page=>{
    await setup(page);await page.evaluate(()=>{
      const previous=S.vn.hooks.onEnter;S.vn.hooks.onEnter=(id,dlg)=>{previous?.(id,dlg);if(id==="hiyori_axe_reveal_close")S.vn.vnTest.turbo=false;};
    });await start(page);await finish(page);
    await page.locator('#vn.active .vn-next.show').waitFor();await unchanged(page);
    const result=await page.evaluate(()=>{
      const owner=S.core.state;S.core.saveToSlot("suien_remake_slot1");S.core.newGame();S.core.loadFromSlot("suien_remake_slot1");
      return {oldKnown:!!owner.flags._hiyori_real_self_known,loaded:S.before()};
    });assert(!result.oldKnown&&!result.loaded.known);assert.equal(result.loaded.money,90000);
    assert(!await page.evaluate(()=>S.run));assert.equal(await page.evaluate(()=>S.core.state.money),90000);
    assert(!await page.evaluate(()=>S.vn.isPlaying()));
  });
  await check("new-game-during-opening-cancels-vn-and-pre-abort",async page=>{
    await setup(page);
    const pre=await page.evaluate(async()=>{
      const abort=new AbortController();abort.abort();const before=JSON.stringify(S.core.state);
      const result=await S.daily.playHiyoriEvent("axe_reveal",{signal:abort.signal});
      return {result,same:before===JSON.stringify(S.core.state),running:S.vn.isPlaying()};
    });assert(!pre.result&&pre.same&&!pre.running);
    await page.evaluate(()=>{S.vn.vnTest.turbo=false;S.run=S.daily.playHiyoriEvent("axe_reveal");});
    await page.locator('#vn.active .vn-next.show').waitFor();
    await page.evaluate(()=>{S.core.newGame();S.changed=JSON.stringify(S.core.state);});
    assert(!await page.evaluate(()=>S.run));assert(!await page.evaluate(()=>S.vn.isPlaying()));
    await page.waitForTimeout(100);assert(await page.evaluate(()=>JSON.stringify(S.core.state)===S.changed));
  });
  await check("load-during-game-aborts-old-owner",async page=>{
    await setup(page);await start(page);
    const fresh=await page.evaluate(()=>{const old=S.core.state;S.core.newGame();S.changed=JSON.stringify(S.core.state);return !!old.flags._hiyori_real_self_known;});
    assert(!fresh);assert(!await page.evaluate(()=>S.run));assert.equal(await page.locator('[data-test="axe-game"]').count(),0);
    assert(await page.evaluate(()=>JSON.stringify(S.core.state)===S.changed));
  });
  await check("money-and-lime-appointments-are-preserved",async page=>{
    await setup(page);
    const result=await page.evaluate(async()=>{
      const s=S.core.state;s.money=2999;const poor=JSON.stringify(s),paid=await S.daily.playHiyoriEvent("axe_reveal"),poorSame=JSON.stringify(s)===poor;
      s.money=90000;s.pendingInvite={sender:"rin",day:s.day,slot:1,event:"date_rin"};const booked=JSON.stringify(s),play=await S.daily.playHiyoriEvent("axe_reveal");
      return {paid,poorSame,play,bookedSame:JSON.stringify(s)===booked};
    });assert(!result.paid&&result.poorSame&&!result.play&&result.bookedSame);
    await page.evaluate(()=>{S.core.state.pendingInvite.day++;S.core.state.inbox=[{id:"keep",read:false,msg:{sender:"rin"},log:["keep"]}];S.booked=JSON.stringify(S.core.state.pendingInvite);S.inbox=JSON.stringify(S.core.state.inbox);});
    await start(page);await finish(page);assert(await page.evaluate(()=>S.run));
    assert(await page.evaluate(()=>JSON.stringify(S.core.state.pendingInvite)===S.booked&&JSON.stringify(S.core.state.inbox)===S.inbox));
  });
  for(const relationship of ["friend","lovers"]) await check("existing-"+relationship+"-never-reclassified",async page=>{
    await setup(page);await page.evaluate(relationship=>{
      const s=S.core.state;s.finales.hiyori={route:relationship==="friend"?"friend":"romance",day:3,chapter:1};
      s.flags._friend_hiyori=relationship==="friend";s.lovers=relationship==="friend"?["rin"]:["hiyori","rin"];
      s.affinity.hiyori=88;s.lovePts.hiyori=12;s.loveLevel.hiyori=2;s.romanceChoices.bond_q1_hiyori={char:"hiyori",value:0,day:3};
      S.relationship=JSON.stringify({finales:s.finales,lovers:s.lovers,friend:s.flags._friend_hiyori,lovePts:s.lovePts,loveLevel:s.loveLevel,choices:s.romanceChoices});
    },relationship);await start(page);await finish(page);assert(await page.evaluate(()=>S.run));
    assert(await page.evaluate(()=>{const s=S.core.state;return JSON.stringify({finales:s.finales,lovers:s.lovers,friend:s.flags._friend_hiyori,lovePts:s.lovePts,loveLevel:s.loveLevel,choices:s.romanceChoices})===S.relationship;}));
  });
  await check("calendar-menu-cancel-does-not-spend-action",async page=>{
    await setup(page);
    // B06 exposes the axe outing only after the mandatory Sumi talk at shift end.
    await page.evaluate(async()=>{
      const timer=setInterval(()=>{
        document.querySelector('[data-test="shift-order-0"]')?.click();
        document.querySelector('[data-test="after-none"]')?.click();
      },20);
      try { await S.tonari.doBaito(); } finally { clearInterval(timer); }
      if(!S.core.state.flags._axe_throw_unlocked) throw new Error("Sumi shift talk did not expose axe throwing");
      // Isolate the calendar cancellation from the paid shift used to unlock it.
      Object.assign(S.core.state,{money:90000,stamina:80,slot:1});
      S.runDaily=S.calendar.runDaily({nightEvents:{},onQuit(){}});
    });
    await page.locator('[data-test="pin-tonari"]').click();await page.locator('[data-test="map-go"]').click();
    await page.locator('[data-test="tonari-hiyori-axe"]').waitFor();await assertFits(page,".sub-choices button");
    await page.locator('[data-test="tonari-hiyori-axe"]').click();await phase(page,"choice");
    await page.locator('[data-test="axe-cancel"]').click();await page.locator('[data-test="pin-tonari"]').waitFor();
    const result=await page.evaluate(()=>({snapshot:S.before(),visited:S.core.state.visitedDay.tonari_hiyori_axe}));
    assert.equal(result.snapshot.money,90000);assert.equal(result.snapshot.stamina,80);assert.equal(result.snapshot.slot,1);assert(!result.snapshot.known&&!result.visited);
  });
});
