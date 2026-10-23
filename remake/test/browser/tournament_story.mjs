import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suite } from './support.mjs';
const shots=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)),process.env.ARTIFACT_DIR||'.codex/artifacts/remake-browser');
fs.mkdirSync(shots,{recursive:true});

await suite('tournament-story',async check=>{
  for(const touch of [false,true]) await check(`${touch?'touch':'pc'}-dialogue-pause-cancel-and-json-resume`,async page=>{
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js');core.newGame();
      const vn=await import('./js/vn/engine.js');
      const session=await import('./js/craft/session.js');
      const story=await import('./js/craft/tournament-story.js');
      const cs=window.cs=session.newSession('tournament');
      cs.mix={mint:12};cs.pack='fluffy';cs.steam={temp:.52,score:85};
      for(const id of ['hajime','pakki','dr_kemuri','maezono'])core.state.flags[`_intro_${id}`]=true;
      Object.assign(core.config,{textSpeed:4,bgmVolume:0,seVolume:0,voiceBlip:false});
      vn.vnTest.turbo=false;
      window.T={core,vn,session,story};
      session.openBench(cs);
      await session.waitBenchReady(cs);
      window.before=JSON.stringify(cs);
      window.controller=new AbortController();
      window.pending=story.playTournamentEvent(cs,'packed',{signal:controller.signal});
    });
    await page.locator('#vn.active').waitFor();
    await page.waitForFunction(()=>document.querySelector('.vn-text')?.textContent.includes('パッキング完了'));
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(()=>cs.steam.temp),.52,'Dialogue must not advance temperature');
    assert.equal(await page.evaluate(()=>cs.tournamentStory.seen.length),0,'Incomplete conversation is not read');
    // Record a representative VN screenshot before cancellation.
    await page.screenshot({path:path.join(shots,`tournament-story-packed-${touch?'touch':'pc'}.png`)});
    await page.evaluate(()=>controller.abort());
    assert.equal(await page.evaluate(()=>pending),false);
    assert.equal(await page.evaluate(()=>cs.tournamentStory.seen.length),0);
    await page.evaluate(async()=>{
      T.vn.vnTest.turbo=true;
      window.cs=JSON.parse(JSON.stringify(cs));
      if(!await T.story.playTournamentEvent(cs,'packed'))throw Error('Conversation did not complete');
      window.logCount=T.vn.backlog().length;
      await T.story.playTournamentEvent(cs,'packed');
    });
    assert.equal(await page.evaluate(()=>T.vn.backlog().length),await page.evaluate(()=>logCount));
    assert.deepEqual(await page.evaluate(()=>cs.tournamentStory.seen),['packed']);
    assert.equal(await page.locator('#vn.active').count(),0);
    assert.equal(await page.evaluate(()=>cs.steam.temp),.52);
    assert.equal(await page.locator('.bench').evaluate(n=>n.getBoundingClientRect().width>0),true);
  },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{});

  await check('chapter1-four-events-in-real-tournament',async page=>{
    page.setDefaultTimeout(60000);
    // この会話テストでは、外部CONTINUE曲だけを同梱音源で代用する。
    await page.route('**/assets/audio/bgm/bgm_continue_urgent.mp3',route=>route.fulfill({
      path:new URL('../../../assets/audio/bgm/bgm_tournament_wait.mp3',import.meta.url).pathname,contentType:'audio/mpeg',
    }));
    // CDPへ動的importのPromiseを返さず、ブラウザ自身に依存moduleを読み込ませる。
    await page.addScriptTag({type:'module',content:`
      import * as core from './js/core/state.js';
      import * as chapter from './js/chapters/ch1.js';
      import * as story from './js/chapters/tsumugi-story.js';
      import * as data from './js/core/data.js';
      import * as vn from './js/vn/engine.js';
      import * as session from './js/craft/session.js';
      window.tournamentFixture={core,chapter,story,data,vn,session};
    `});
    await page.evaluate(()=>{
      const {core,chapter,story,data,vn,session}=window.tournamentFixture;
      const s=core.newGame();
      Object.assign(s,{day:14,phase:'tournament',stamina:100,flavorStock:{double_apple:60,mint:30}});
      s.stats={technique:42,sense:42,guts:42,charm:42,insight:42};
      for(const step of story.TSUMUGI_STORY)s.flags[step.flag]=true;
      for(const id of Object.keys(data.DB.characters))s.flags[`_intro_${id}`]=true;
      Object.assign(core.config,{textSpeed:4,bgmVolume:0,seVolume:0,voiceBlip:false});
      vn.vnTest.turbo=true;vn.vnTest.choose=()=>0;
      session.craftTest.auto='good';
      window.events=[];
      vn.hooks.onLine=id=>{if(id.startsWith('tournament_craft_')&&events.at(-1)!==id)events.push(id);};
      window.tournamentRun=chapter.devTournament();
    });
    await page.waitForFunction(()=>events.includes('tournament_craft_1_tasting'),null,{timeout:60000});
    assert.deepEqual(await page.evaluate(()=>events),['opening','packed','waiting','tasting'].map(e=>`tournament_craft_1_${e}`));
  });
});
