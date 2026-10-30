// cue 駆動の共通スコア（DESIGN 7-3）。台本の各カットが持つ cue で曲の区間を進めるため、
// 台本の秒数を直しても曲が破綻しない。第1章の曲（preview-score.js の固定作曲）には触らない。
// ここは音符列を組み立てる純粋関数だけを置き、再生は preview-score.js の createPreviewScore が担う。

const CUE_BY_KIND = { prologue: "intro", slate: "slate", image: "build", title: "title", echo: "echo" };

/** カットの cue（台本に無い場合は kind から決める）。 */
export function cueOf(frame) {
  return frame.cue || CUE_BY_KIND[frame.kind] || "build";
}

/**
 * frames（duration は ms）から音符列を作る。
 * arrangement は章ごとの違いを表すパラメータ: air=低い倍音の基準音、bell=言葉に寄せるベルの音、
 * titleChord=タイトルカットの和音、level=全体の音量係数。省略時は第1章 quiet の実績値。
 * slate と echo は無音にする（言葉と間を主役にする。第1章 quiet の実績どおり）。
 */
export function composeCueNotes(frames, arrangement = {}) {
  const air = arrangement.air ?? 45;
  const bell = arrangement.bell ?? 76;
  const titleChord = arrangement.titleChord ?? [57, 60, 64, 71];
  const level = arrangement.level ?? 1;
  const notes = [];
  let at = 0;
  for (const frame of frames) {
    const dur = frame.duration / 1000;
    const cue = cueOf(frame);
    if (cue === "intro" || cue === "build") {
      notes.push({ at: at + .15, dur: Math.max(.2, dur - .4), note: air, voice: "air", level: .4 * level });
      notes.push({ at: at + .45, dur: Math.min(2, Math.max(.2, dur - .5)), note: bell, voice: "bell", level: .3 * level });
    }
    if (cue === "title") {
      titleChord.forEach(note => notes.push({ at, dur: Math.max(.2, dur - .3), note, voice: "title", level: .45 * level }));
    }
    at += dur;
  }
  return notes.sort((a, b) => a.at - b.at);
}
