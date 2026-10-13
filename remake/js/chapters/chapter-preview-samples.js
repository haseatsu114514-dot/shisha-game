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
    const durations = [1700, 1700, 1200, 2600, 3400, 3500, 2600, 2600, 3600, 3700, 2600];
    data.frames.forEach((cut, i) => { cut.duration = durations[i]; cut.move = "still"; });
    data.frames.find(cut => cut.id === "naru-confrontation").text = "話してる相手まで\n点で見なくていいだろ";
    data.frames.find(cut => cut.id === "minto-warning").text = "何があっても、\nわたしはここにいるから。";
    data.frames.find(cut => cut.id === "empty-victory").text = "……俺、なんのために\n勝ったんだっけ。";
  }
  if (id === "quiet") {
    const durations = [3000, 3500, 1500, 4000, 4500, 4500, 5000, 4000, 6000, 4000, 4000];
    data.frames.forEach((cut, i) => { cut.duration = durations[i]; cut.move = "still"; });
    const minto = structuredClone(data.frames.find(cut => cut.id === "minto-warning"));
    minto.id = "minto-return";
    minto.duration = 3500;
    data.frames.splice(data.frames.length - 1, 0, minto);
  }
  data.duration = data.frames.reduce((total, cut) => total + cut.duration, 0);
  return data;
}
