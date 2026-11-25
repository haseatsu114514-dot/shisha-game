import { createSet, resumeMix, playDeck, pauseMix, beatAt, gains, lowCutDb, mod, updateSet, chooseTrack, nudgeDeck, cancelReserve } from './model.mjs';
import { TRACKS, SETS, buildBufferTrackData, previewBeat } from './tracks.mjs';
import { FEEL } from './feel.mjs';

const CLIP_BARS = 2, CLIP_SECONDS = 3.5;

async function decodeTrack(context, key, url, signal, priority) {
  const response = await fetch(url, { signal, priority });
  if (!response.ok) throw new Error(`音源読み込み失敗: ${TRACKS[key].title}`);
  return context.decodeAudioData(await response.arrayBuffer());
}

async function loadDeck(context, key, signal) {
  const cfg = TRACKS[key];
  const buffer = await decodeTrack(context, key, new URL('../../../assets/audio/dj/' + cfg.file, import.meta.url), signal, 'high');
  return { ...await buildBufferTrackData(buffer, cfg, signal), buffer, trimDb: cfg.trimDb };
}

function loadClip(context, key, signal, priority) {
  return decodeTrack(context, key, new URL(`./clips/${key}.flac`, import.meta.url), signal, priority);
}

function loadOnce(cache, key, load) {
  if (!cache.has(key)) {
    const pending = load();
    cache.set(key, pending);
    // A later click can retry a failed request.
    pending.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
  }
  return cache.get(key);
}

function disconnectVoice(voice) {
  voice.source.onended = null;
  voice.source.disconnect();
  voice.source.buffer = null;
  voice.filter?.disconnect();
  voice.gain.disconnect();
}

export class DJAudio {
  constructor(Context = globalThis.AudioContext, options = {}) {
    this.set = SETS[options.setIndex ?? 0];
    this.loadTrack = options.loadTrack || loadDeck;
    this.loadPreview = options.loadPreview || (options.loadTrack ? null : loadClip);
    this.Context = Context; this.mix = createSet(this.set, options.rng || Math.random, { allowance: options.allowance || 0, ...(options.entry || {}) }); this.context = null; this.voices = [null, null];
    this.cache = new Map(); this.clips = new Map(); this.tracks = [null, null];
    this.loading = new AbortController();
    this.retiring = new Set(); this.volume = .18; this.muted = false; this.busy = false; this.disposed = false; this.revision = 0;
    this.previewing = null; this.previewGen = 0; // 試聴 (DJK06): the card being listened to, and a counter so a slow load never plays after another card was picked
  }
  get now() { return this.context?.currentTime || 0; }
  async decodeDeck(key) {
    const context = this.context, t = await this.loadTrack(context, key, this.loading.signal);
    if (!t.buffer) {
      const buffer = context.createBuffer(1, t.samples.length, t.sampleRate);
      buffer.copyToChannel(t.samples, 0);
      t.buffer = buffer;
    }
    return t;
  }
  /** Only tracks assigned to decks retain their full PCM buffers. */
  track(key) {
    return loadOnce(this.cache, key, () => this.decodeDeck(key));
  }
  previewClip(key, priority = 'auto') {
    return loadOnce(this.clips, key, () => this.loadPreview(this.context, key, this.loading.signal, priority));
  }
  async ensure(id) {
    const key = this.mix.decks[id].track; if (!key) { this.tracks[id] = null; return null; }
    const context = this.context, t = await this.track(key);
    if (!this.disposed && this.context === context && this.mix.decks[id].track === key) this.tracks[id] = t;
    return t;
  }
  loaded(id) { const key = this.mix.decks[id].track; return !!key && !!this.tracks[id] && this.tracks[id].nativeBpm === TRACKS[key].bpm && this.tracks[id].firstBeat === TRACKS[key].firstBeat; }
  async start(deckId = null) {
    if (this.busy || this.disposed) return false;
    this.busy = true;
    const revision = ++this.revision;
    let onAir = false; // set while the next track loads during a running set: its failure must not take the playing track down
    try {
      if (!this.context) {
        if (!this.Context) throw new Error('Web Audioが利用できません');
        this.context = new this.Context({ latencyHint: 'interactive' });
        const context = this.context;
        context.addEventListener('statechange', () => {
          if (this.context === context && context.state !== 'running' && this.mix.running) {
            ++this.revision; this.stopPreview(); pauseMix(this.mix, this.now); this.clearVoices();
            this.onInterrupted?.(context.state);
          }
        });
        this.output = this.context.createGain(); this.output.gain.value = 0;
        this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 256;
        this.output.connect(this.analyser); this.analyser.connect(this.context.destination);
        this.meterData = new Float32Array(this.analyser.fftSize);
        this.initialResume = this.context.resume();
        this.initialResume.catch(() => {});
        await Promise.all([this.ensure(0), this.ensure(1)]);
      }
      if (deckId !== null) { onAir = this.mix.running; await this.ensure(deckId); onAir = false; }
      await (this.initialResume || this.context.resume()); this.initialResume = null;
      if (this.disposed || revision !== this.revision) {
        try { await this.context.suspend(); } catch { /* A concurrent dispose may close it. */ }
        return false;
      }
      if (this.context.state !== 'running') throw new Error('音声の開始が許可されませんでした。▶を押してください');
      if (deckId === null) resumeMix(this.mix, this.now);
      else if (!playDeck(this.mix, deckId, this.now)) return false;
      for (let id = 0; id < 2; id++) if (this.mix.decks[id].playing && !this.voices[id]) this.spawn(id);
      this.setMix(this.mix.mix); this.setVolume(this.volume);
      return true;
    } catch (error) {
      if (this.disposed && error.name === 'AbortError') return false;
      if (this.disposed || onAir) throw error; // a failure loading the next track leaves the playing one on air (#2456 review 3)
      this.initialResume = null;
      if (this.context) pauseMix(this.mix, this.now);
      this.clearVoices();
      try { await this.context?.suspend(); } catch { /* Preserve original start failure. */ }
      if (this.context && !this.tracks[0] && !this.tracks[1]) {
        try { await this.context.close(); } catch { /* Partial initialization. */ }
        this.output?.disconnect(); this.analyser?.disconnect(); this.context = null; this.cache.clear();
      }
      throw error;
    } finally { this.busy = false; }
  }
  spawn(id) {
    const context = this.context, now = this.now, old = this.voices[id], track = this.tracks[id], d = this.mix.decks[id];
    if (!track) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = track.buffer; source.loop = true;
    source.playbackRate.value = d.bpm / track.nativeBpm;
    // Automatic low cut (bass swap) tied to the crossfader; skipped when the context has no filters.
    const filter = context.createBiquadFilter ? context.createBiquadFilter() : null;
    if (filter) { filter.type = 'lowshelf'; filter.frequency.value = 220; filter.gain.value = lowCutDb(this.mix.mix)[id]; source.connect(filter); filter.connect(gain); }
    else source.connect(gain);
    gain.connect(this.output);
    const voice = { source, gain, filter, stopped: false };
    source.onended = () => { disconnectVoice(voice); this.retiring.delete(voice); };
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gains(this.mix.mix)[id] * 10 ** ((track.trimDb || 0) / 20), now + .008);
    const first = track.firstBeat || 0;
    source.loopStart = first; source.loopEnd = first + track.beats * 60 / track.nativeBpm;
    const b = beatAt(d, now);
    // A ▶ pressed a little early is held for the entry line (予約, #2456 §4): beat 0 is still ahead, so start the source when it comes
    // (counted from now, so a pause and resume while it waits still lands on the line).
    if (b < 0) source.start(now - b * 60 / d.bpm, first); else source.start(now, first + mod(b, track.beats) * 60 / track.nativeBpm);
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
  killVoice(id) {
    const voice = this.voices[id];
    if (voice) { this.stopVoice(voice); disconnectVoice(voice); this.voices[id] = null; }
  }
  clearVoices() {
    for (const voice of [...this.voices, ...this.retiring]) if (voice) {
      this.stopVoice(voice); disconnectVoice(voice);
    }
    this.voices = [null, null]; this.retiring.clear();
  }
  async pause() {
    ++this.revision; this.stopPreview();
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
      if (p) { p.cancelScheduledValues(this.now); p.setValueAtTime(p.value, this.now); p.linearRampToValueAtTime(g * 10 ** ((this.tracks[id]?.trimDb || 0) / 20), this.now + .012); }
      const f = this.voices[id]?.filter?.gain;
      if (f) f.setTargetAtTime(lowCutDb(this.mix.mix)[id], this.now, .03);
    });
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(.5, Number(value)));
    const duck = this.previewing ? FEEL.preview.duck : 1; // 試聴のあいだ、手元で聞こえる今の曲を少し下げる（フロアの曲は流れ続けた扱い）
    if (this.output) this.output.gain.setTargetAtTime(this.muted || !this.mix.running ? 0 : this.volume * duck, this.now, .012);
  }
  /** 試聴 (DJK06, #2456 §3): the player listens to a candidate for a few seconds, like a DJ on one ear of the headphones. Its loudest
   *  bars play at the playing tempo on their own path (not the meters), and the music the player hears dips meanwhile. The floor, the
   *  beats, the decks and the scores are untouched. A newer call (another card) or stopPreview() cancels it. Resolves true if it plays. */
  async preview(key) {
    this.stopPreview();
    const gen = this.previewGen;
    if (!key || !TRACKS[key] || !this.context || this.disposed || this.context.state !== 'running' || !this.mix.running) return false;
    const P = FEEL.preview, len = Math.max(.5, P.seconds), cfg = TRACKS[key];
    let buffer, offset = 0;
    if (this.loadPreview && P.bars === CLIP_BARS && len + .05 <= CLIP_SECONDS) {
      try { buffer = await this.previewClip(key); } catch { /* The original track is a fallback for an unavailable clip. */ }
    }
    if (!buffer && gen === this.previewGen) {
      const pending = this.track(key);
      try {
        // Sound tuning overrides can request a different passage or a longer extract.
        const t = await pending;
        buffer = t.buffer;
        offset = (t.firstBeat || 0) + previewBeat(t, P.bars) * 60 / t.nativeBpm;
      } catch { return false; }
      finally {
        if (!this.mix.decks.some(deck => deck.track === key) && this.cache.get(key) === pending) this.cache.delete(key);
      }
    }
    if (gen !== this.previewGen || this.disposed || !this.context || this.context.state !== 'running' || !this.mix.running) return false;
    const c = this.context, now = this.now, master = this.mix.decks[this.mix.master];
    const source = c.createBufferSource(), gain = c.createGain();
    source.buffer = buffer; source.playbackRate.value = (master?.bpm || cfg.bpm) / cfg.bpm;
    source.connect(gain); gain.connect(c.destination);
    const level = this.muted ? 0 : this.volume * P.level * 10 ** ((cfg.trimDb || 0) / 20);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + .06);
    gain.gain.setValueAtTime(level, now + len - .25); gain.gain.linearRampToValueAtTime(0, now + len);
    source.start(now, offset, len + .05);
    const voice = { key, source, gain, until: now + len, stopped: false };
    source.onended = () => {
      disconnectVoice(voice);
      this.retiring.delete(voice);
      if (this.previewing === voice) { this.previewing = null; this.setVolume(this.volume); }
    };
    this.previewing = voice; this.setVolume(this.volume);
    return true;
  }
  /** Stop the preview at once (a pick, a pause, another card) and bring the music back up. */
  stopPreview() {
    ++this.previewGen;
    const v = this.previewing; if (!v) return;
    this.previewing = null;
    const now = this.now;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, now + .03);
    this.retiring.add(v);
    this.stopVoice(v, now + .04);
    this.setVolume(this.volume);
  }
  applyRate(id) { const t = this.tracks[id]; if (t) this.voices[id]?.source.playbackRate.setValueAtTime(this.mix.decks[id].bpm / t.nativeBpm, this.now); }
  async play(id) { return this.start(id); }
  /** 選曲: load the picked candidate on the empty deck (see model chooseTrack). */
  choose(index) {
    const picked = chooseTrack(this.mix, index, this.now);
    if (picked) { this.stopPreview(); this.clips.clear(); }
    if (picked && this.context) { this.tracks[picked.id] = null; this.ensure(picked.id).catch(() => {}); }
    return picked;
  }
  /** Advance the set and apply what changed to the audio graph. Call every frame. */
  update() {
    if (this.previewing && this.now >= this.previewing.until) this.stopPreview(); // the few seconds are over
    const view = updateSet(this.mix, this.now);
    if (view.retuned != null) this.applyRate(view.retuned); // a slip starts or settles: the incoming track runs a little fast or slow (DJG)
    if (view.stopped != null) {
      const id = view.stopped;
      this.killVoice(id);
      this.cache.delete(view.transition.from);
      // Keep the outgoing waveform until the deck display changes.
      if (this.tracks[id]) {
        const { buffer, samples, ...waveform } = this.tracks[id];
        this.tracks[id] = waveform;
      }
    }
    // 選曲: warm only the short excerpts at low priority. The choice loads the full recording for its deck.
    if (view.select && this.context && this.loadPreview) {
      for (const key of view.select.options) this.previewClip(key, 'low').catch(() => {});
    }
    if (view.stopped != null || view.finished) this.setVolume(this.volume);
    return view;
  }
  /** The platter: move the incoming track along or back while it is out of time (model nudgeDeck). The voice is re-seeked to the new position. */
  nudge(id, beats) { const moved = nudgeDeck(this.mix, id, beats, this.now); if (moved && this.context) this.spawn(id); return moved; }
  /** 予約の取り消し（DJR01）: the held track's source was scheduled for the entry line; stop it before it sounds. */
  cancelReserve(id) { if (!this.context || this.busy || !cancelReserve(this.mix, id, this.now)) return false; this.killVoice(id); return true; }
  level() {
    if (!this.analyser || !this.mix.running) return 0;
    this.analyser.getFloatTimeDomainData(this.meterData);
    return Math.sqrt(this.meterData.reduce((sum, v) => sum + v * v, 0) / this.meterData.length);
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true; ++this.revision; this.stopPreview();
    this.loading.abort();
    pauseMix(this.mix, this.now); this.clearVoices();
    this.cache.clear(); this.clips.clear(); this.tracks = [null, null];
    this.output?.disconnect(); this.analyser?.disconnect();
    await this.context?.close();
  }
}
