// Real WebAudio output, including the quiet ticks before the final five seconds.
import assert from "node:assert/strict";
import { suite } from "./browser/support.mjs";
await suite("continue-output", async check => {
  for (const music of [false, true]) await check(music ? "with-bgm" : "without-bgm", async page => {
    await page.mouse.click(4, 4);
    const result = await page.evaluate(async music => {
      const audio = await import("./js/core/audio.js"), {config} = await import("./js/core/state.js");
      // Observe the existing shared context; gain nodes are captured before boot.
      config.bgmVolume = music ? .4 : 0; config.seVolume = .5; config.mute = config.muted = false;
      audio.unlockAudio(); audio.applyVolumes();
      const ctx = window.__continueOutputContext;
      if (!ctx) throw new Error("Shared AudioContext was not captured");
      await ctx.resume();
      const analyser=ctx.createAnalyser();analyser.fftSize=2048;
      window.__continueOutputGains[1].connect(analyser); // actual SE bus, after per-voice envelope and SE volume
      const data=new Float32Array(analyser.fftSize);
      const sample=async duration=>{
        let peak=0,energy=0;
        const until=performance.now()+duration;
        while(performance.now()<until){analyser.getFloatTimeDomainData(data);for(const n of data){peak=Math.max(peak,Math.abs(n));energy+=n*n;}await new Promise(r=>setTimeout(r,5));}
        return {peak,energy};
      };
      const session=audio.createContinueAudio();session.start();
      await new Promise(r=>setTimeout(r,600));
      const ticks=[];
      for(let remaining=20;remaining>=0;remaining--){
        if(remaining>5)session.tick();else session.count(remaining);
        ticks.push({remaining,...await sample(90)});
        await new Promise(r=>setTimeout(r,170));
      }
      session.pause();session.tick();await new Promise(r=>setTimeout(r,100));const paused=await sample(100);
      session.resume();session.setEnabled(false);session.tick();const disabled=await sample(100);
      session.setEnabled(true);config.mute=true;audio.applyVolumes();session.tick();const muted=await sample(100);
      session.cleanup();analyser.disconnect();return {ticks,paused,disabled,muted};
    },music);
    assert.equal(result.ticks.length,21);
    for(const t of result.ticks) assert(t.peak>0.00001 && t.energy>0 && t.peak<1,JSON.stringify(t));
    for(const mode of ["paused","disabled","muted"])assert(result[mode].peak<0.00001,`${mode}: ${JSON.stringify(result[mode])}`);
    console.log(`Real output: 15 dry ticks + 5 urgent counts + zero, BGM=${music}; pause/OFF/mute silent`);
  });
}, { initScript: () => {
  const Native=window.AudioContext;
  window.AudioContext=class extends Native {
    constructor(...args){super(...args);window.__continueOutputContext=this;window.__continueOutputGains=[];}
    createGain(){const g=super.createGain();window.__continueOutputGains.push(g);return g;}
  };
} });
