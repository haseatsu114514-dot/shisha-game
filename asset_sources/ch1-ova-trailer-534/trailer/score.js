// この40秒の予告用に作曲。外部音源・既存アニメの旋律は使用しない。
const hz = note => 440 * 2 ** ((note - 69) / 12);
function compose() {
  const events = [];
  const add = (at, dur, note, voice, level = 1) => {
    const limit = at < 35.5 ? 35.5 : 40;
    events.push({ at, dur: Math.min(dur, limit - at), note, voice, level });
  };
  [60, 64, 67].forEach(note => add(.2, 3.5, note - 12, "pad", .55));
  add(.65, 2, 79, "bell", .65);
  add(2.45, 1.2, 76, "bell", .45);
  const phrase = (start, end, beat, chords, melody, level = 1) => {
    for (let bar = 0, at = start; at < end; bar++, at = start + bar * beat * 4) {
      const chord = chords[bar % chords.length];
      chord.forEach(note => add(at, Math.min(beat * 3.6, end - at), note, "chord", level));
      for (let step = 0; step < 8; step++) {
        const t = at + step * beat / 2;
        if (t >= end - .08) break;
        add(t, Math.min(beat * .42, end - t), melody[(bar * 2 + step) % melody.length], "lead", level * .8);
        add(t, .065, 0, "hat", level * (step % 2 ? .35 : .55));
        if (step % 2 === 0) {
          add(t, .19, 0, step % 4 ? "snare" : "kick", level * .8);
          add(t, Math.min(beat * .7, end - t), chord[0] - 12, "bass", level);
        }
      }
    }
  };
  phrase(4, 8, 60 / 120, [[60,64,67],[57,60,64]], [76,79,81,79,76,74,72,74], .65);
  [53,57,60].forEach(note => add(8.05, 2.6, note, "pad", .6));
  phrase(11, 16, 60 / 128, [[60,64,67],[55,59,62],[57,60,64]], [79,81,84,83,79,76,74,76], .85);
  phrase(16, 21.5, 60 / 116, [[53,57,60],[60,64,67],[55,59,62]], [77,79,81,79,76,74,72,76], .42);
  [16.2,18.5,20].forEach((at,i) => add(at, 1.2, [84,81,79][i], "bell", .55));
  [45,52,57].forEach(note => add(21.5, 3.2, note, "pad", .65));
  add(21.5, .25, 0, "impact", .6);
  add(23.7, 1.1, 76, "bell", .2);
  phrase(25, 29.4, 60 / 138, [[50,53,57],[52,56,59]], [74,77,81,79,76,80,83,80], .82);
  [29.1,29.3,29.5,29.7].forEach((at,i) => add(at, .16, 52-i*4, "tom", .8));
  // 30–31秒は無音の一拍。章タイトルの和音へ。
  [[31,[60,64,67,71]],[32.5,[53,57,60,64]],[34,[55,59,62,67]]].forEach(([at,chord]) => {
    chord.forEach(note => add(at, 1.45, note, "chord", 1.3));
    add(at, .9, chord[0]-12, "bass", 1.1);
    add(at, .5, 0, "impact", .55);
    chord.slice(1).forEach((note,i) => add(at+i*.25, .7, note+12, "lead", .65));
  });
  // 問いかけはリズムと和音を切り、ベルの短い余韻のみ。
  add(35.55, 1.15, 83, "bell", .16);
  return events.sort((a,b) => a.at-b.at);
}

export function createScore() {
  const events = compose();
  let ctx, mix, compressor, noise, timer, offset = 0, epoch = 0, cursor = 0;
  let playing = false, muted = false;
  const voices = new Set();
  const position = () => playing && ctx ? offset + ctx.currentTime - epoch : offset;
  function clear() {
    clearInterval(timer);
    for (const voice of voices) {
      try { voice.source.stop(); } catch { /* already stopped */ }
      voice.source.onended = null;
      voice.nodes.forEach(node => node.disconnect());
    }
    voices.clear();
  }
  function schedule(event, now) {
    const elapsed = Math.max(0, now-event.at), dur = event.dur-elapsed;
    if (dur <= .02) return;
    const t = ctx.currentTime + Math.max(0,event.at-now);
    const noisy = ["hat","snare","impact"].includes(event.voice);
    const source = noisy ? ctx.createBufferSource() : ctx.createOscillator();
    const filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    const settings = {
      lead:["sawtooth",.048,2600,.008], chord:["sawtooth",.022,1300,.035],
      pad:["triangle",.027,650,.24], bell:["sine",.085,5000,.002],
      bass:["triangle",.13,700,.006], kick:["sine",.2,700,.002],
      tom:["sine",.12,1100,.002], snare:[null,.09,1700,.002],
      hat:[null,.025,7500,.001], impact:[null,.05,4200,.01],
    }[event.voice];
    filter.type = noisy ? "highpass" : "lowpass";
    filter.frequency.value = settings[2];
    if (noisy) { source.buffer = noise; source.loop = true; }
    else {
      source.type = settings[0];
      const frequency = event.voice === "kick" ? 115 : hz(event.note);
      source.frequency.setValueAtTime(frequency,t);
      if (["kick","tom"].includes(event.voice)) source.frequency.exponentialRampToValueAtTime(frequency*.36,t+dur);
      if (["lead","chord"].includes(event.voice)) source.detune.value = event.voice === "lead" ? 3 : -4;
    }
    const peak = settings[1]*event.level*Math.exp(-elapsed/Math.max(.1,event.dur)*2);
    gain.gain.setValueAtTime(.00001,t);
    gain.gain.linearRampToValueAtTime(peak,t+Math.min(settings[3],dur*.25));
    if (event.voice === "pad") gain.gain.setValueAtTime(peak*.65,t+dur*.65);
    gain.gain.exponentialRampToValueAtTime(.00001,t+dur);
    source.connect(filter).connect(gain).connect(mix);
    const voice = {source,nodes:[source,filter,gain]};
    voices.add(voice);
    source.onended = () => { voice.nodes.forEach(node=>node.disconnect()); voices.delete(voice); };
    source.start(t); source.stop(t+dur+.015);
  }
  function tick() {
    const now = position();
    while (cursor < events.length && events[cursor].at < now+.18) schedule(events[cursor++],now);
    if (now >= 40) { offset=40; playing=false; clear(); }
  }
  return {
    async play(from) {
      clear(); playing=false; offset=from;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) {
        ctx = new AC(); mix=ctx.createGain(); compressor=ctx.createDynamicsCompressor();
        compressor.threshold.value=-13; compressor.knee.value=10; compressor.ratio.value=3;
        mix.connect(compressor).connect(ctx.destination);
        noise=ctx.createBuffer(1,ctx.sampleRate*.7,ctx.sampleRate);
        let seed=534;
        const data=noise.getChannelData(0);
        for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
      }
      await ctx.resume();
      mix.gain.setValueAtTime(muted?0:.68,ctx.currentTime);
      epoch=ctx.currentTime;playing=true;
      cursor=events.findIndex(event=>event.at+event.dur>from);
      if(cursor<0)cursor=events.length;
      tick();timer=setInterval(tick,50);
    },
    pause() { offset=Math.min(40,position());playing=false;clear(); },
    mute(value) { muted=value;if(ctx)mix.gain.setTargetAtTime(value?0:.68,ctx.currentTime,.01); },
    get state() { return {playing,muted,position:Math.min(40,position()),voices:voices.size,contextState:ctx?.state||"uncreated"}; },
  };
}
