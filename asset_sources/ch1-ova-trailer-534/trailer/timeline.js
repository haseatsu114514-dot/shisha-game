export const spec = {
  duration: 40,
  chapter: { label: "第一章", title: "煙がつなぐ街", subtitle: "Smoke & Ties" },
  segments: [
    { id: "city-night", duration: 4, image: "01-city-night", text: "この街で、夢が動き出す。", source: "予告用コピー。ch1_mainの自分の店への夢に基づく", anchor: "left", move: "out" },
    { id: "sumi-teaches", duration: 4, image: "02-sumi-teaches", speaker: "スミ", text: "技は盗め。", source: "data/dialogue/remake_ch1.json / remake_tutorial_result", anchor: "left", move: "hold" },
    { id: "sumi-rule", duration: 3, kind: "quote", text: "ただし、誰から盗んだかは忘れるな。", source: "同じ台詞の続き" },
    { id: "naru-invites", duration: 5, image: "03-naru-invites", speaker: "なる", text: "うまくなりたいなら全部見てけ", source: "data/dialogue/remake_ch1.json / remake_repeat_naru_2", anchor: "left", move: "in" },
    { id: "tsumugi-sketch", duration: 5.5, image: "04-tsumugi-sketch", speaker: "つむぎ", text: "ここで過ごしてる時間を、\n１枚にしたいです", source: "data/dialogue/ch1_tsumugi.json / ch1_tsumugi_research", anchor: "right", move: "hold" },
    { id: "rival-silhouette", duration: 3.5, image: "05-rival-silhouette", text: "", source: "みんとの本編用衣装を手がかりに、顔と名前を伏せる。予告用構図", move: "hold" },
    { id: "first-step", duration: 5, image: "06-first-step", text: "初めての舞台が、待っている。", source: "予告用コピー。ch1_tournament_arrivalに基づく", anchor: "left", move: "in" },
    { id: "breath", duration: 1, kind: "black", text: "" },
    { id: "chapter-title", duration: 4.5, kind: "title", text: "" },
    { id: "question", duration: 4.5, image: "06-first-step", text: "あなたなら、何を込める？", source: "予告用の問い。勝敗・後の秘密を明かさない", anchor: "left", move: "hold" },
  ],
};
let at = 0;
for (const cut of spec.segments) {
  cut.start = at;
  at += cut.duration;
  cut.end = at;
}
if (Math.abs(at - spec.duration) > .001) throw new Error("Trailer duration mismatch");
