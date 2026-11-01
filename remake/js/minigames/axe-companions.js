// Practice dialogue only. No romance, real-self reveal or character progression.
// Lists are picked by throw number, so a line never flickers between frames.
export const COMPANIONS = {
  // focus: face center per expression, in the 896x1200 sprite. The poses lean, so one crop would jump.
  hiyori: { name: "ひより", portraitKey: "hiyori", faces: ["axe_normal", "axe_laugh", "axe_shout"],
    focus: { axe_normal: [432, 322], axe_laugh: [372, 322], axe_shout: [380, 322] },
    before: ["……横、縦、回転の順。焦らず止めてみて", "青い小さな的、狙ってみる？ 宣言してからね", "……次、どう狙う？ 見てるね",
      "……肩の力、抜いて。斧に任せるくらいでいいの", "……白い刃先、揺れてるね。止まった瞬間がチャンス"],
    call: ["……キルショット。小さいけど、当たれば大きいね", "……青を宣言。見てるこっちまで息が止まりそう"],
    bull: ["……真ん中。うん、今のきれいだった", "……ど真ん中。木が、斧を待ってたみたい", "えっ、すごっ！ ……こほん。……見事ね"],
    hit: ["ちゃんと刺さったね。……次も見てる", "……いい音。刺さる音って、落ち着くね", "……うん、悪くない。次はもう少し中へ"],
    killshot: ["よっしゃ！ ……こほん。今の、すごかったね", "うおっ、青に命中！ ……失礼。……鮮やかね"],
    "killshot-miss": ["……惜しい。宣言した投は青い的だけが得点なんだね", "……青、遠かったね。でも宣言した勇気は好き"],
    miss: ["……もう少しだったね。次の一投、いこう", "……的の外。狙いは、ほんの少しだけ内側へ"],
    drop: ["……回転の加減かな。強すぎると、回りすぎちゃうね", "……落ちちゃった。緑の帯、焦らず待ってみて"],
    streak: ["……連続で高得点。今、流れが来てるよ", "ちょっ、止まらないじゃん！ ……こほん。……続けて"],
    last: ["……最後の一投。深呼吸して、好きに投げて", "……ラスト。ここで決めたら、かっこいいよ"],
    switch: ["……後半。的を交代だね。板の木目、さっきと違う", "……折り返し。閉じてた赤も、また開くよ"],
    closed: ["……そこ、もう使った円。開いてる赤を探そう", "……閉じた5に触れちゃった。次は別の赤へ"],
    bonus: ["……落下のぶん、宣言が1回増えたね。反対の高さの青だよ", "……もう1回、青を狙える。落ちた甲斐があったかも"],
    summary: { great: "……すごかった。見てるだけで、心臓が忙しかった", good: "……楽しかった。見てるだけで、私のほうが消えかけたけど",
      again: "……刺さる音、まだまだ聞きたいな。またやろう" } },
  // Read the registered owner of this adopted SHISHARK art, across ID renames.
  shark: { name: "サメちゃん", titleSuffix: "_01_shishark_test_run.png", faces: ["normal", "smile", "excited"],
    focus: { normal: [458, 398], smile: [458, 398], excited: [452, 398] },
    before: ["お主の番じゃ。わしはここで見ておるぞ", "青い的は先に宣言するのじゃな。忘れるでないぞ", "どこを狙うのじゃ？ お主の好きなところでよいぞ",
      "肩に力が入っておるぞ。深呼吸じゃ、深呼吸", "揺れが止まる瞬間を待つのじゃ。サメも獲物を待つぞ"],
    call: ["おお、キルショットか！ わしもよく見ておくのじゃ", "青を狙うとは強気じゃのう。わしは好きじゃぞ"],
    bull: ["真ん中じゃ！ お主、上手いのう", "ど真ん中じゃ！ サメの歯より鋭いのう"],
    hit: ["ちゃんと刺さったのう。わしまで嬉しくなるぞ", "よい音じゃ。次はもっと真ん中を狙うのじゃ"],
    killshot: ["あの小さい的に当てたのか！ すごいのじゃ！", "見事じゃ！ コロちゃんも拍手しておるぞ"],
    "killshot-miss": ["惜しいのう。青い的だけが得点になるのじゃな", "むむ、青は小さいのう。じゃが狙いは悪くないぞ"],
    miss: ["むう、惜しかったのじゃ。もう一度やってみようぞ", "的の外じゃ。少し内側へ寄せてみるのじゃ"],
    drop: ["力任せではいかんのじゃな。次は帯に合わせてみるのじゃ", "落ちてしもうた。緑の帯で止めるのじゃぞ"],
    streak: ["連続じゃ！ お主、今は波に乗っておるのう", "止まらんのう！ サメの群れのような勢いじゃ"],
    last: ["最後の一投じゃ。お主の好きに投げるがよい", "ラストじゃな。わしはここで見届けるぞ"],
    switch: ["後半じゃ！ 的を交代するのじゃな", "折り返しじゃ。赤もまた開くぞ、気を楽にな"],
    closed: ["そこはもう閉じた円じゃ。開いておる赤を狙うのじゃ", "むむ、閉じた5に触れたのう。別の赤へ行くのじゃ"],
    bonus: ["落ちた代わりに宣言が増えたのじゃ。反対の高さの青じゃぞ", "もう1回青を狙えるのじゃ。サメは転んでもただでは起きぬ"],
    summary: { great: "お主、見事じゃった！ わしは鼻が高いぞ", good: "お主と遊ぶのは楽しいのう。また付き合ってほしいのじゃ",
      again: "お主、気を落とすでないぞ。次はきっと刺さるのじゃ" } },
};
/** Fractions of the sprite that should sit at the icon's center. */
export function portraitFocus(id, face) {
  const [x, y] = COMPANIONS[id]?.focus?.[face] || [448, 330];
  return { x: x / 896, y: y / 1200 };
}
const pick = (list, n) => Array.isArray(list) ? list[n % list.length] : list;

/** context: { heat, last, grade } from the caller; all optional and read-only. */
export function reaction(id, phase, shots, called, context = {}) {
  const companion = COMPANIONS[id];
  if (!companion) throw new RangeError("Unknown axe companion");
  const n = shots.length;
  if (phase === "summary") return { text: companion.summary[context.grade || "again"] || companion.summary.good, face: companion.faces[1] };
  const last = phase === "result" ? shots.at(-1) : null, outcome = last?.outcome || null;
  const streak = outcome && ["hit", "bull"].includes(outcome) && context.heat >= 2;
  const closed = outcome === "miss" && last?.zone?.kind === "closed";
  const bonus = outcome === "drop" && context.bonus;
  const text = streak ? pick(companion.streak, n - 1) : closed ? pick(companion.closed, n - 1) : bonus ? pick(companion.bonus, n - 1)
    : outcome ? pick(companion[outcome], n - 1)
    : called ? pick(companion.call, n) : context.switching ? pick(companion.switch, n) : context.last ? pick(companion.last, n) : pick(companion.before, n);
  const face = outcome === "killshot" || streak ? companion.faces[2]
    : outcome === "bull" ? companion.faces[1] : companion.faces[0];
  return { text, face };
}

/** Match lines come from data/dialogue/axe_versus.json, never story flags. */
export function matchReaction(lines, phase, match, actor, pending, called, context = {}) {
  const p = match.player.reduce((sum, shot) => sum + shot.score, 0);
  const o = match.opponent.reduce((sum, shot) => sum + shot.score, 0);
  let key;
  if (phase === "summary") key = p === o ? "draw" : p > o ? "player" : "opponent";
  else if (actor === "opponent") key = context.suddenDeath ? (phase === "result" ? (pending?.score ? "sudden-hit" : "sudden-miss") : "sudden-call")
    : phase === "result" ? match.opponent.at(-1)?.outcome
    : pending?.called ? "call" : match.opponent.length === 9 ? "last" : "before";
  else if (context.suddenDeath) key = phase === "result" ? (match.suddenDeath.at(-1)?.player?.score ? "sudden-player-hit" : "sudden-player-miss") : "sudden";
  else if (phase === "result" || called) return reaction("hiyori", phase, match.player, called, context);
  else if (match.player.length === 9) key = "player-last";
  else if (context.switching) key = "switch";
  else key = p === o ? "level" : p - o >= 10 ? "big-behind" : o - p >= 10 ? "big-ahead" : p > o ? "behind" : "ahead";
  return { text: lines[key] || lines.before,
    face: ["killshot", "sudden-hit"].includes(key) ? "axe_shout" : ["bull", "player", "opponent", "draw", "big-ahead", "sudden-player-hit"].includes(key) ? "axe_laugh" : "axe_normal" };
}
