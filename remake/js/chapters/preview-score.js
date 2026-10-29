// 第1章の章末〜次回予告専用。外部音源を使わないオリジナルの短いTVサイズ曲。
import { config } from "../core/state.js";

const LENGTH = 47.8;
const frequency = note => 440 * 2 ** ((note - 69) / 12);
const volume = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;

function compose() {
  const notes = [];
  const add = (at, dur, note, voice, level = 1) => notes.push({ at, dur, note, voice, level });
  // 章末の一言は沈黙を主役にして、低い倍音だけを残す。
  add(.35, 3.5, 33, "air", .35);
  [5.28, 5.38, 5.47, 5.54].forEach((at, i) => add(at, .15, 48 - i * 3, "tom", .7));
  add(5.6, .65, 0, "crash", .7);

  function passage(start, end, beat, chords, melodies, urgent = false) {
    for (let bar = 0, at = start; at < end; bar++, at = start + bar * beat * 4) {
      const chord = chords[bar % chords.length];
      const melody = melodies[bar % melodies.length];
      for (let step = 0; step < 8; step++) {
        const t = at + step * beat / 2;
        if (t >= end - .05) break;
        const hush = urgent && t >= 22.6 ? .45 : 1;
        add(t, Math.min(beat * .46, end - t), melody[step], "lead", (urgent ? .84 : 1) * hush);
        add(t, .07, 0, "hat", (step % 2 ? .3 : .45) * hush);
        add(t, beat * .38, chord[0] - 12 + (step % 4 === 3 ? 12 : 0), "bass", .8 * hush);
        if (step % 2 === 0) add(t, .16, 0, step % 4 === 0 ? "kick" : "snare", .65 * hush);
      }
      for (const hit of [0, 1.5, 2.75]) {
        const t = at + hit * beat;
        if (t >= end - .05) break;
        const hush = urgent && t >= 22.6 ? .45 : 1;
        chord.forEach(note => add(t, Math.min(beat * .7, end - t), note, "chord", (urgent ? .7 : .85) * hush));
      }
      if (bar % 2 === 0) add(at + beat, Math.min(beat * 2, end - at - beat), chord[2] + 12, "bell", .5);
    }
  }

  passage(5.6, 13.1, 60 / 126,
    [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    [[76, 79, 81, 79, 76, 74, 72, 74], [76, 79, 84, 83, 81, 79, 76, 74],
      [77, 81, 84, 81, 79, 77, 76, 74], [74, 79, 83, 81, 79, 76, 74, 71]]);
  add(13.1, .55, 0, "crash", .55);
  passage(13.1, 28.1, 60 / 150,
    [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]],
    [[76, 81, 79, 76, 74, 72, 71, 72], [77, 81, 84, 81, 79, 77, 76, 74],
      [74, 77, 81, 77, 76, 74, 72, 69], [71, 76, 80, 83, 80, 76, 74, 71]], true);

  // 問いかけのカットではリズムを止め、タイトルの大きな和音へ溜める。
  add(28.1, .35, 40, "bass", .75);
  add(28.2, 2, 76, "bell", .25);
  add(32.6, 3.5, 45, "air", .3);
  add(36.9, 1.4, 47, "air", .3);
  add(38.6, .7, 0, "crash", .7);
  [[38.6, [57, 60, 64, 71]], [40.2, [53, 57, 60, 64]], [41.8, [52, 56, 59, 64]]].forEach(([at, chord]) => {
    chord.forEach(note => add(at, 1.85, note, "title", .9));
    add(at, .65, chord[0] - 12, "bass", 1);
    add(at, .18, 0, "kick", .8);
    [0, .4, .8].forEach((delay, i) => add(at + delay, .36, chord[i + 1] + 12, "lead", .7));
  });
  // 既存サンプルの最後の問いへ。43.8秒で和音を切り、短いベルの余韻だけにする。
  add(43.8, 1.1, 83, "bell", .18);
  return notes.sort((a, b) => a.at - b.at);
}

function sampleScore(timeline, originalTimeline, quiet) {
  if (quiet) {
    const notes = [];
    let at = 0;
    for (const cut of timeline) {
      const dur = cut.duration / 1000;
      if (cut.kind === "image" || cut.kind === "prologue") {
        notes.push({ at: at + .15, dur: Math.max(.2, dur - .4), note: cut.id === "empty-victory" ? 40 : 45, voice: "air", level: .4 });
        notes.push({ at: at + .45, dur: Math.min(2, dur - .5), note: cut.speaker === "みんと" ? 81 : 76, voice: "bell", level: .3 });
      }
      if (cut.kind === "title") [57, 60, 64, 71].forEach(note => notes.push({ at, dur: dur - .3, note, voice: "title", level: .45 }));
      at += dur;
    }
    return notes.sort((a, b) => a.at - b.at);
  }
  // カットごとに曲の区間を縮める。音程を上げず、タイトル/静寂の位置を映像に合わせる。
  const original = new Map();
  let sourceStart = 0;
  for (const cut of originalTimeline) {
    original.set(cut.id, { start: sourceStart, duration: cut.duration / 1000 });
    sourceStart += cut.duration / 1000;
  }
  const score = compose(), notes = [];
  let at = 0;
  for (const cut of timeline) {
    const source = original.get(cut.id), dur = cut.duration / 1000;
    if (source) {
      const rate = dur / source.duration;
      for (const event of score) {
        const start = Math.max(event.at, source.start);
        const end = Math.min(event.at + event.dur, source.start + source.duration);
        if (end > start) notes.push({ ...event, at: at + (start - source.start) * rate, dur: (end - start) * rate });
      }
    }
    at += dur;
  }
  return notes.sort((a, b) => a.at - b.at);
}

/** seek(0)で開始。比較案のみカットに合わせて曲を組み替える。events を渡すと、その音符列をそのまま使う（cue 駆動スコア用）。 */
export function createPreviewScore({ timeline = null, originalTimeline = null, quiet = false, events: providedEvents = null } = {}) {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, music = null, limiter = null, noise = null;
  let timer = null, stopped = false, paused = false, started = false, localMute = false;
  let offset = 0, epoch = 0, cursor = 0;
  const length = timeline ? timeline.reduce((total, cut) => total + cut.duration / 1000, 0) : LENGTH;
  const events = providedEvents ?? (timeline ? sampleScore(timeline, originalTimeline, quiet) : compose());
  const voices = new Set();

  function ensureContext() {
    if (ctx || !AC || stopped) return ctx;
    try { ctx = new AC(); } catch { return null; }
    music = ctx.createGain();
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -15;
    limiter.knee.value = 10;
    limiter.ratio.value = 3;
    limiter.attack.value = .005;
    limiter.release.value = .12;
    music.connect(limiter);
    limiter.connect(ctx.destination);
    noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .8), ctx.sampleRate);
    const data = noise.getChannelData(0);
    // 固定seedで録画・リプレイでも同じ打楽器の音色になる。
    let seed = 384;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    syncVolumes(true);
    return ctx;
  }

  function syncVolumes(instant = false) {
    if (!ctx) return;
    const silent = stopped || paused || localMute || config.mute || config.muted || document.hidden;
    const level = silent ? 0 : volume(config.bgmVolume) * 2;
    if (instant) music.gain.setValueAtTime(level, ctx.currentTime);
    else music.gain.setTargetAtTime(level, ctx.currentTime, .015);
  }

  function currentPosition() {
    return !ctx || paused || !started ? offset : Math.min(length, offset + ctx.currentTime - epoch);
  }

  function clearVoices() {
    for (const voice of voices) {
      voice.source.onended = null;
      try { voice.source.stop(); } catch { /* already ended */ }
      voice.nodes.forEach(node => node.disconnect());
    }
    voices.clear();
  }

  function schedule(event, position) {
    const remaining = event.at + event.dur - position;
    if (remaining <= .015) return;
    const t = ctx.currentTime + Math.max(0, event.at - position);
    const elapsed = Math.max(0, position - event.at);
    const dur = event.dur - elapsed;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const noisy = ["snare", "hat", "crash"].includes(event.voice);
    const percussive = noisy || ["kick", "tom"].includes(event.voice);
    const source = noisy ? ctx.createBufferSource() : ctx.createOscillator();
    const settings = {
      lead: ["sawtooth", .055, 2800, .009], bass: ["triangle", .1, 900, .006],
      chord: ["sawtooth", .025, 1600, .012], title: ["sawtooth", .026, 1800, .045],
      bell: ["sine", .045, 4000, .002], air: ["triangle", .035, 230, .35],
      kick: ["sine", .22, 700, .003], tom: ["sine", .13, 1200, .003],
      snare: [null, .12, 1800, .003], hat: [null, .045, 7500, .002], crash: [null, .065, 5000, .008],
    }[event.voice];
    filter.type = noisy ? "highpass" : "lowpass";
    filter.frequency.value = settings[2];
    filter.Q.value = .5;
    if (noisy) source.buffer = noise;
    else {
      source.type = settings[0];
      const f = event.voice === "kick" ? 128 : frequency(event.note);
      source.frequency.setValueAtTime(f, t);
      if (event.voice === "kick" || event.voice === "tom") {
        source.frequency.exponentialRampToValueAtTime(event.voice === "kick" ? 42 : f * .45, t + dur);
      }
      if (event.voice === "lead") source.detune.value = 4;
    }
    const peak = settings[1] * event.level * (elapsed ? Math.exp(-elapsed / event.dur * 3) : 1);
    gain.gain.setValueAtTime(.00001, t);
    gain.gain.linearRampToValueAtTime(peak, t + Math.min(settings[3], dur * .2));
    if (!percussive && ["title", "air"].includes(event.voice)) {
      gain.gain.setValueAtTime(peak * .65, t + dur * .65);
    }
    gain.gain.exponentialRampToValueAtTime(.00001, t + dur);
    source.connect(filter).connect(gain).connect(music);
    const voice = { source, nodes: [source, filter, gain] };
    voices.add(voice);
    source.onended = () => {
      voice.nodes.forEach(node => node.disconnect());
      voices.delete(voice);
    };
    source.start(t);
    source.stop(t + dur + .015);
  }

  function tick() {
    if (stopped || !started || paused || !ctx) return;
    syncVolumes();
    const position = currentPosition();
    // 短い先読みのみ。seek/休止時に未来の打楽器や音符を残さない。
    while (cursor < events.length && events[cursor].at < position + .25) {
      schedule(events[cursor++], position);
    }
    if (position >= length) {
      offset = length;
      paused = true;
      clearInterval(timer);
      timer = null;
      syncVolumes(true);
      clearVoices();
    }
  }

  function startClock() {
    if (stopped || paused || !ctx) return;
    epoch = ctx.currentTime;
    // 最初の操作で開始。ブラウザに音声が拒否されても映像の進行を妨げない。
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    tick();
    if (!paused && !timer) timer = setInterval(tick, 50);
  }

  function seek(seconds = 0) {
    if (stopped) return;
    const next = Number(seconds);
    offset = Number.isFinite(next) ? Math.max(0, Math.min(length, next)) : 0;
    if (!ensureContext()) return;
    clearVoices();
    cursor = events.findIndex(event => event.at + event.dur > offset + .015);
    if (cursor < 0) cursor = events.length;
    started = true;
    startClock();
  }

  function pause() {
    if (stopped || paused) return;
    offset = currentPosition();
    paused = true;
    clearInterval(timer);
    timer = null;
    syncVolumes(true);
    clearVoices();
  }

  function resume() {
    if (stopped || !paused) return;
    paused = false;
    seek(offset);
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    timer = null;
    syncVolumes(true);
    clearVoices();
    [music, limiter].forEach(node => node?.disconnect());
    if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
    noise = null;
  }

  function setMuted(value) {
    localMute = !!value;
    syncVolumes(true);
  }

  return { seek, pause, resume, stop, setMuted };
}
