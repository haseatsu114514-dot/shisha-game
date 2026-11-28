// 大会の入場カットイン（ライバル → 主人公）。第1章の entrance() を共有部品にしたもの（#2031）。
// 保存には触れない演出だけの部品。自動で送られる。
import { realName } from "../core/data.js";
import { el, sleep } from "../core/util.js";
import { layers, imageReady } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { vnTest } from "../vn/engine.js";
import { introSources } from "../vn/intro.js";
import { stageLights } from "../craft/tournament-show.js";

// 章ごとの入場カード。ring＝二つ名、note＝スミさんの一言。face は人物素材の id（内部名と違う人物だけ）。
export const ENTRANCE_CARDS = Object.freeze({
  1: [
    { id: "naru", ring: "孤高の探求者", note: "なる……人格者だが、煙は別人だ。基礎が異常に堅い" },
    { id: "adam", ring: "ダブルアップルの匠", note: "アダムは一点突破。正面から殴り合うな" },
    { id: "minto", ring: "甘い嵐", note: "みんとは緩急で揺さぶってくる。乗せられるな" },
    { id: "hajime", ring: "tonari の新星", note: "──行ってこい。目の前の一人に届けてこい" },
  ],
  2: [
    { id: "ageha", ring: "MELTY PUFF の直感", note: "あげはは理屈より先に手が動く。あれを真似しようとするな" },
    { id: "kumicho", ring: "スジを通す煙", note: "神崎さんの煙は穏やかだ。派手さで勝とうとしたら負ける" },
    { id: "kuraudo", ring: "カシスの余韻", note: "クラウドは間で聴かせる。お前は自分の拍で作れ" },
    { id: "hajime", ring: "県大会の挑戦者", note: "前の大会の自分と比べろ。隣は見なくていい" },
  ],
  3: [
    { id: "ayatori", ring: "煙幕の勝負師", note: "綾取は相手の判断を動かしてくる。味の名前に釣られるな" },
    { id: "steve", ring: "低温の研究家", note: "スティーブは熱を急がない。最後の一口まで崩れないぞ" },
    { id: "volk", ring: "鉄の煙", note: "ヴォルクの精度は本物だ。数字で張り合っても仕方ない" },
    { id: "hajime", ring: "柚ヶ谷の代表", note: "全国だろうが、やることは一台だ。いつもどおり作ってこい" },
  ],
  4: [
    { id: "naru", ring: "孤高の探求者", note: "なる……ここまで来たか。あいつの基礎は世界でも通じる" },
    { id: "master_hookah", ring: "龍龍水煙所の宗師", note: "王さんは派手な煙の裏で、相手の呼吸を見ている" },
    { id: "sheikh", ring: "世界王者", note: "王者は急がない。全部受け止めるつもりで来るぞ" },
    { id: "hajime", ring: "日本の挑戦者", note: "──行ってこい。目の前の一人に届けてこい" },
  ],
});

const NAME = { master_hookah: "王 煙楼" };

// 第1章: 前夜の過ごし方（ch1_day7_last_night の4択）を、はじめの入場カードのスミの一言で受ける（#2091）。
// 旧セーブや未選択は ENTRANCE_CARDS の一言のまま。
// どの一言も、正本の入場メッセージ「目の前の一人に届けてこい」で締める（優勝の場面 ch1_tournament_reveal がこの言葉を回収する）。
export const CH1_EVE_NOTES = Object.freeze({
  practice: "手はもう覚えてる。目の前の一人に届けてこい",
  talk_sumi: "決められるのは、出す煙だけだ。目の前の一人に届けてこい",
  sleep_early: "いい顔だ。よく眠れたな。目の前の一人に届けてこい",
  drill: "昨夜さらった工程、焦るなよ。目の前の一人に届けてこい",
});

/** cards を順に1枚ずつ出す。chapter を渡すと ENTRANCE_CARDS の章のカードを使う。heroNote ははじめのカードの一言を差し替える。 */
export async function playEntrance(chapterOrCards, { auto = Boolean(window.__remake?.craftTest?.auto || vnTest.turbo), heroNote = null } = {}) {
  const cards = Array.isArray(chapterOrCards) ? chapterOrCards : ENTRANCE_CARDS[chapterOrCards];
  if (!cards?.length || !layers?.fx) return;
  const host = el("div.entrance");
  // 初対面の既読や台詞を動かさず、設定で選ばれた人物絵・背景だけを再利用する。
  const cast = cards.map(c => introSources(c.face || c.id));
  const ready = cast.map(({ p, background }) => Promise.all([
    p && imageReady(p.src), background && imageReady(background),
  ]));
  // 舞台の光（TSH12）。
  stageLights(host, { beams: 4, dust: 16 });
  layers.fx.append(host);
  try {
    for (const [index, c] of cards.entries()) {
      const me = c.id === "hajime";
      const { p, art, background, graphic } = cast[index];
      await ready[index];
      const card = el(`div.ent-card${me ? ".me" : ""}`, { dataset: { art: graphic ? "graphic" : "classic" } }, [
        background ? el("img.ent-backdrop", { src: background, alt: "", onerror: e => e.currentTarget.remove() }) : null,
        p ? el("img.ent-portrait", { src: p.src, alt: "", onerror: e => e.currentTarget.remove() }) : null,
        el("span.ent-tag", { text: `エントリーナンバー${index + 1}` }),
        el("div.ent-meta", [
          el("div.ent-ring", { text: c.ring }),
          el("div.ent-name", { text: me ? "はじめ" : (NAME[c.id] || realName(c.face || c.id)) }),
          el("div.ent-note", [el("small.ent-speaker", { text: "スミ" }), el("span", { text: `「${me && heroNote ? heroNote : c.note}」` })]),
        ]),
      ]);
      if (art?.color) card.style.setProperty("--entry-ink", art.color);
      host.querySelector(".ent-card")?.remove();
      host.append(card);
      await sleep(30);
      card.classList.add("in");
      me ? SE.fanfare() : SE.select();
      await sleep(auto ? 80 : 2800);
    }
  } finally {
    host.remove();
  }
}
