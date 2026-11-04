// 既存台本から採用案と比較案を組み立てる。セーブには触れない。
export const previewSamples = [
  { id: "tv", letter: "A", name: "王道のテレビ予告", description: "4:3のテレビ枠、ドット字幕。6人の言葉を順に見せる。", hook: "勝ちは、始まりだった。", seconds: 48 },
  { id: "rush", letter: "B", name: "短く畳みかける予告", description: "約30秒。大きな字幕と速い曲から、最後だけ静寂へ。", hook: "勝つほど、遠くなる。", seconds: 30 },
  { id: "quiet", letter: "C", name: "言葉を残す静かな予告", description: "横長の画面、静かな音。最後にみんとの言葉が戻る。", hook: "誰のために、煙を作る。", seconds: 48 },
];

export function createChapterSample(base, id) {
  if (!previewSamples.some(sample => sample.id === id)) return base;
  const data = structuredClone(base);
  data.sample = id;
  if (id === "rush") {
    const durations = { afterglow: 900, next: 1800, "tsumugi-water": 2600,
      "minto-warning": 3400, "ageha-promise": 3500, "sumi-silence": 5000,
      "naru-confrontation": 2600, "empty-victory": 3600, "chapter-title": 3700, "last-question": 3500 };
    data.frames.forEach(cut => { cut.duration = durations[cut.id] ?? cut.duration; cut.move = "still"; });
  }
  if (id === "quiet") {
    data.frames.forEach(cut => { cut.move = "still"; });
    const minto = structuredClone(data.frames.find(cut => cut.id === "minto-warning"));
    minto.id = "minto-return";
    minto.duration = 3500;
    data.frames.splice(data.frames.length - 1, 0, minto);
  }
  data.duration = data.frames.reduce((total, cut) => total + cut.duration, 0);
  return data;
}
