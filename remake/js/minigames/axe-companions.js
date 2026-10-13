// Practice dialogue only. No romance, real-self reveal or character progression.
export const COMPANIONS = {
  hiyori: { name: "ひより", portraitKey: "hiyori", faces: ["axe_normal", "axe_laugh", "axe_shout"],
    before: ["……横、縦、力の順。焦らず止めてみて。", "青い小さな的、狙ってみる？ 宣言してからね。", "……次、どう狙う？ 見てるね。"],
    call: "……キルショット。小さいけど、当たれば大きいね。",
    bull: "……真ん中。うん、今のきれいだった。",
    hit: "ちゃんと刺さったね。……次も見てる。",
    killshot: "よっしゃ！ ……こほん。今の、すごかったね。",
    "killshot-miss": "……惜しい。宣言した投は青い的だけが得点なんだね。",
    miss: "……もう少しだったね。次の一投、いこう。",
    drop: "……力の加減かな。強すぎると、回転も合わないね。",
    summary: "……楽しかった。また一緒に投げようね。" },
  // Read the registered owner of this adopted SHISHARK art, across ID renames.
  shark: { name: "サメちゃん", titleSuffix: "_01_shishark_test_run.png", faces: ["normal", "smile", "excited"],
    before: ["お主の番じゃ。わしはここで見ておるぞ。", "青い的は先に宣言するのじゃな。忘れるでないぞ。", "どこを狙うのじゃ？ お主の好きなところでよいぞ。"],
    call: "おお、キルショットか！ わしもよく見ておくのじゃ。",
    bull: "真ん中じゃ！ お主、上手いのう。", hit: "ちゃんと刺さったのう。わしまで嬉しくなるぞ。",
    killshot: "あの小さい的に当てたのか！ すごいのじゃ！",
    "killshot-miss": "惜しいのう。青い的だけが得点になるのじゃな。",
    miss: "むう、惜しかったのじゃ。もう一度やってみようぞ。",
    drop: "力任せではいかんのじゃな。次は帯に合わせてみるのじゃ。",
    summary: "お主と遊ぶのは楽しいのう。また付き合ってほしいのじゃ。" },
};
export function reaction(id, phase, shots, called) {
  const companion = COMPANIONS[id];
  if (!companion) throw new RangeError("Unknown axe companion");
  const outcome = phase === "summary" ? "summary" : phase === "result" ? shots.at(-1)?.outcome : null;
  const text = outcome ? companion[outcome] : called ? companion.call : companion.before[shots.length % companion.before.length];
  const face = outcome === "killshot" ? companion.faces[2]
    : outcome === "bull" || outcome === "summary" ? companion.faces[1] : companion.faces[0];
  return { text, face };
}
