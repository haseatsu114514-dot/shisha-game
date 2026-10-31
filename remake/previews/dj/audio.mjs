import { createMix, createStageMix, resumeMix, playDeck, pauseDeck, pauseMix, beatAt, gains, lowCutDb, mod, setTempo, nudgeDeck } from './model.mjs';
import { TRACKS, STAGES, buildTrackData } from './tracks.mjs';
export class DJAudio {
  constructor(Context = globalThis.AudioContext, options = {}) {
    this.stage=STAGES[options.stageIndex ?? 0];
    const legacy=options.loadTracks && options.stageIndex === undefined;
    const detune=options.detuneFactor ?? (this.stage.detune==='random'?1+(Math.random()<.5?-1:1)*(.012+Math.random()*.016):1);
    this.loadTracks=options.loadTracks || (async context=>Promise.all([this.stage.a,this.stage.b].map(async key=>{
      const cfg=TRACKS[key],response=await fetch(new URL('../../../assets/audio/dj/'+cfg.file,import.meta.url));
      if(!response.ok)throw new Error(`音源読み込み失敗: ${cfg.title}`);
      const buffer=await context.decodeAudioData(await response.arrayBuffer());
      return {...buildTrackData(buffer.getChannelData(0),buffer.sampleRate,cfg),buffer,trimDb:cfg.trimDb};
    })));
    this.legacy=legacy;
    this.Context = Context; this.mix = legacy ? createMix() : createStageMix(this.stage,detune); this.context = null; this.voices = [null, null];
    this.retiring = new Set(); this.volume = .18; this.muted = false; this.busy = false; this.disposed = false; this.revision = 0;
  }
  get now() { return this.context?.currentTime || 0; }
  async start(deckId = null) {
    if (this.busy || this.disposed) return false;
    this.busy = true;
    const revision = ++this.revision;
    try {
      if (!this.context) {
        if (!this.Context) throw new Error('Web Audioが利用できません');
        this.context = new this.Context({ latencyHint: 'interactive' });
        const context = this.context;
        context.addEventListener('statechange', () => {
          if (this.context === context && context.state !== 'running' && this.mix.running) {
            ++this.revision; pauseMix(this.mix, this.now); this.clearVoices();
            this.onInterrupted?.(context.state);
          }
        });
        this.output = this.context.createGain(); this.output.gain.value = 0;
        this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
        this.output.connect(this.analyser); this.analyser.connect(this.context.destination);
        this.meterData = new Float32Array(this.analyser.fftSize);
        this.initialResume = this.context.resume();
        this.initialResume.catch(()=>{});
        this.tracks = await this.loadTracks(this.context);
        this.buffers = this.tracks.map(t => { if(t.buffer)return t.buffer; const b = this.context.createBuffer(1, t.samples.length, t.sampleRate); b.copyToChannel(t.samples, 0); return b; });
      }
      await (this.initialResume || this.context.resume()); this.initialResume=null;
      if (this.disposed || revision !== this.revision) {
        try { await this.context.suspend(); } catch { /* A concurrent dispose may close it. */ }
        return false;
      }
      if (this.context.state !== 'running') throw new Error('音声の開始が許可されませんでした。開始ボタンを押してください');
      if (deckId === null) resumeMix(this.mix, this.now);
      else if (!playDeck(this.mix, deckId, this.now)) return false;
      for (let id = 0; id < 2; id++) if (this.mix.decks[id].playing && !this.voices[id]) this.spawn(id);
      this.setMix(this.mix.mix); this.setVolume(this.volume);
      return true;
    } catch (error) {
      this.initialResume=null;
      if (this.context) pauseMix(this.mix, this.now);
      this.clearVoices();
      try { await this.context?.suspend(); } catch { /* Preserve original start failure. */ }
      if (this.context && !this.buffers) {
        try { await this.context.close(); } catch { /* Partial initialization. */ }
        this.output?.disconnect(); this.analyser?.disconnect(); this.context = null;
      }
      throw error;
    } finally { this.busy = false; }
  }
  spawn(id) {
    const context = this.context, now = this.now, old = this.voices[id];
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = this.buffers[id]; source.loop = true;
    source.playbackRate.value = this.mix.decks[id].bpm / this.tracks[id].nativeBpm;
    // Automatic low cut (bass swap) tied to the crossfader; skipped when the context has no filters.
    const filter = context.createBiquadFilter ? context.createBiquadFilter() : null;
    if (filter) { filter.type = 'lowshelf'; filter.frequency.value = 220; filter.gain.value = lowCutDb(this.mix.mix)[id]; source.connect(filter); filter.connect(gain); }
    else source.connect(gain);
    gain.connect(this.output);
    const voice = { source, gain, filter, stopped: false };
    source.onended = () => { source.disconnect(); filter?.disconnect(); gain.disconnect(); this.retiring.delete(voice); };
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gains(this.mix.mix)[id] * 10 ** ((this.tracks[id].trimDb || 0)/20), now + .008);
    const track=this.tracks[id];
    source.loopStart=track.firstBeat || 0; source.loopEnd=(track.firstBeat || 0)+track.beats*60/track.nativeBpm;
    source.start(now, (track.firstBeat || 0)+mod(beatAt(this.mix.decks[id], now), track.beats) * 60 / track.nativeBpm);
    if (old) {
      this.retiring.add(old); old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now); old.gain.gain.linearRampToValueAtTime(0, now + .008);
      this.stopVoice(old, now + .009);
    }
    this.voices[id] = voice;
  }
  stopVoice(voice, when = this.now) {
    if (!voice || voice.stopped) return;
    voice.stopped = true; try { voice.source.stop(when); } catch { /* Already ended. */ }
  }
  clearVoices() {
    for (const voice of [...this.voices, ...this.retiring]) if (voice) {
      this.stopVoice(voice); voice.source.disconnect(); voice.filter?.disconnect(); voice.gain.disconnect();
    }
    this.voices = [null, null]; this.retiring.clear();
  }
  async pause() {
    ++this.revision;
    if (!this.context || this.disposed) return;
    pauseMix(this.mix, this.now); // Freeze positions even if suspend() fails.
    this.clearVoices();
    this.output.gain.cancelScheduledValues(this.now); this.output.gain.setValueAtTime(0, this.now);
    await this.context.suspend();
  }
  setMix(value) {
    this.mix.mix = Math.max(0, Math.min(1, Number(value)));
    if (!this.context) return;
    gains(this.mix.mix).forEach((g, id) => {
      const p = this.voices[id]?.gain.gain;
      if (p) { p.cancelScheduledValues(this.now); p.setValueAtTime(p.value, this.now); p.linearRampToValueAtTime(g * 10 ** ((this.tracks[id].trimDb || 0)/20), this.now + .012); }
      const f = this.voices[id]?.filter?.gain;
      if (f) f.setTargetAtTime(lowCutDb(this.mix.mix)[id], this.now, .03);
    });
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(.5, Number(value)));
    if (this.output) this.output.gain.setTargetAtTime(this.muted || !this.mix.running ? 0 : this.volume, this.now, .012);
  }
  tempo(id, value) {
    setTempo(this.mix.decks[id], value, this.now);
    this.voices[id]?.source.playbackRate.setValueAtTime(this.mix.decks[id].bpm / this.tracks[id].nativeBpm, this.now);
  }
  nudgeMs(id, ms) { return this.nudge(id, ms/1000*this.mix.decks[id].bpm/60); }
  play(id) { return this.start(id); }
  pauseDeck(id) {
    pauseDeck(this.mix, id, this.now);
    const voice = this.voices[id];
    if (voice) { this.stopVoice(voice); voice.source.disconnect(); voice.filter?.disconnect(); voice.gain.disconnect(); this.voices[id] = null; }
    this.setVolume(this.volume);
  }
  nudge(id, beats) {
    if (!nudgeDeck(this.mix, id, beats, this.now)) return false;
    this.spawn(id); return true;
  }
  level() {
    if (!this.analyser || !this.mix.running) return 0;
    this.analyser.getFloatTimeDomainData(this.meterData);
    return Math.sqrt(this.meterData.reduce((sum, v) => sum + v * v, 0) / this.meterData.length);
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true; ++this.revision;
    pauseMix(this.mix, this.now); this.clearVoices();
    this.output?.disconnect(); this.analyser?.disconnect();
    await this.context?.close();
  }
}
