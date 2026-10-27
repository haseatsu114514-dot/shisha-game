// Original procedural test audio. No recorded EDM, samples, external assets or network.
import { mod } from './model.mjs';
// Bの低音は補助128BPMでAと同じ音高になるよう事前補正する（key lock機能ではない）。
export const TRACKS = [{ name: 'RED / 試験音 A', bpm: 128, root: 55 }, { name: 'EMBER / 試験音 B', bpm: 126, root: 55 * 126 / 128 }];
export function renderTrack(id, sampleRate) {
  const track = TRACKS[id], duration = 32 * 60 / track.bpm;
  const samples = new Float32Array(Math.round(duration * sampleRate));
  let seed = id + 7;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, beat = t * track.bpm / 60;
    const kickT = mod(beat, 1) * 60 / track.bpm;
    const kick = Math.sin(2 * Math.PI * (48 * kickT + 9 * (1 - Math.exp(-kickT * 32)))) * Math.exp(-kickT * 20) * .46;
    const hatT = mod(beat, .5) * 60 / track.bpm;
    const rnd = noise(), hat = rnd * Math.exp(-hatT * 100) * .075;
    const snareT = mod(beat + 1, 2) * 60 / track.bpm;
    const snare = rnd * Math.exp(-snareT * 32) * .14;
    const note = [0, 0, 3, 7, 0, 10, 7, 3][Math.floor(beat / 4) % 8];
    const bassT = mod(beat, .5) * 60 / track.bpm;
    const freq = track.root * 2 ** (note / 12);
    const bass = Math.sin(2 * Math.PI * freq * bassT) * Math.sin(Math.PI * Math.min(1, bassT / .018))
      * Math.exp(-bassT * 12) * .17;
    const tick = Math.floor(beat) % 4 === 0 ? Math.sin(2 * Math.PI * (id ? 660 : 440) * kickT) * Math.exp(-kickT * 65) * .06 : 0;
    // Sub-millisecond edge fade avoids a discontinuity at the 8-bar wrap.
    const edge = Math.min(1, i / 64, (samples.length - 1 - i) / 64);
    samples[i] = edge === 0 ? 0 : (kick + snare + hat + bass + tick) * edge;
  }
  // Scheduling must use the actual buffer duration, including sample rounding.
  const nativeBpm = 32 * 60 / (samples.length / sampleRate);
  const stride = 128, peaks = [];
  for (let i = 0; i < samples.length; i += stride) {
    let peak = 0; for (let j = i; j < Math.min(i + stride, samples.length); j++) peak = Math.max(peak, Math.abs(samples[j]));
    peaks.push(peak);
  }
  return { samples, sampleRate, duration: samples.length / sampleRate, nativeBpm, peaks: Float32Array.from(peaks), stride };
}
export function peakAt(track, seconds) {
  return track.peaks[Math.min(track.peaks.length - 1, Math.floor(mod(seconds, track.duration) * track.sampleRate / track.stride))];
}
