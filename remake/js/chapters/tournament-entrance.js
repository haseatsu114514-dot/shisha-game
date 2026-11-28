// 大会の入場カットイン（ライバル → 主人公）。第1章の entrance() を共有部品にしたもの（#2031）。
// 保存には触れない演出だけの部品。自動で送られる。
import { realName } from "../core/data.js";
import { el, sleep } from "../core/util.js";
import { layers, imageReady } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { vnTest } from "../vn/engine.js";
import { introSources } from "../vn/intro.js";
import { stageLights } from "../craft/tournament-show.js";

// 章ごとの入場カード。ring＝二つ名、note＝はじめの心の声。face は人物素材の id（内部名と違う人物だけ）。
export const ENTRANCE_CARDS = Object.freeze({
  1: [
    { id: "naru", ring: "孤高の探求者", note: "なるさんなら、レモンの香りをどこまで拾うだろう" },
    { id: "adam", ring: "ダブルアップルの匠", note: "ダブルアップルにレモンか。俺ならどっちを立てるだろう" },
    { id: "minto", ring: "甘い嵐", note: "甘い煙であれだけ評判の人だ。酸味をどう使うんだろう" },
    { id: "hajime", ring: "tonariの新星", note: "……俺だ。よし、行こう" },
  ],
  2: [
    { id: "ageha", ring: "MELTY PUFF の直感", note: "あげはさん、もう葉を決めてるのかな。迷いが顔に出ない" },
    { id: "kumicho", ring: "スジを通す煙", note: "神崎さんの煙、あんなに穏やかなのに味が残るんだよな" },
    { id: "kuraudo", ring: "カシスの余韻", note: "吸い終わった後の香りか。クラウドさんならそこまで考えてそうだ" },
    { id: "hajime", ring: "橙須の新星", note: "手順は頭に入ってる。よし、最後まで作りきろ" },
  ],
  3: [
    { id: "ayatori", ring: "煙幕の勝負師", note: "綾取さん、何を混ぜたんだろう。……もう考えさせられてる" },
    { id: "steve", ring: "低温の研究家", note: "スティーブさんなら、低い熱でチョコの甘さを引き出せそうだ" },
    { id: "volk", ring: "鉄の煙", note: "ヴォルクさんは手がぶれない。二度目の調整も強そうだ" },
    { id: "hajime", ring: "A県を背負う職人", note: "……呼ばれた。息を吐こう。よし、俺の番だ" },
  ],
  4: [
    { id: "naru", ring: "孤高の探求者", note: "なるとまた同じ舞台だ。あの甘さ、今日はどう来るかな" },
    { id: "master_hookah", ring: "龍龍水煙所の宗師", note: "王さん、客席を見てる。もう吸う人の息を見てるのか" },
    { id: "sheikh", ring: "世界王者", note: "あれだけ歓声が上がっても、王者は自分の間で歩くんだな" },
    { id: "hajime", ring: "日本を背負う職人", note: "ここまで来た。俺の一台、吸ってもらおう" },
  ],
});

const NAME = { master_hookah: "王 煙楼" };

// 第1章の自分の番では、前夜の過ごし方を思い返す。未選択なら通常のカードを使う。
export const CH1_EVE_NOTES = Object.freeze({
  practice: "昨日は最後まで通せた。今日もあの手順でいこう",
  talk_sumi: "俺が決められるのは、出す煙だ。よし、作ろう",
  sleep_early: "よく寝た。手も軽い。よし、行ける",
  drill: "昨日何度もやったところだ。一つずついこう",
});

// 透過原画が届いた層だけ文字と置き換える。通信中や欠番でも名乗りは読める。
function ticketImage(name) {
  return el("img", {
    src: `img/ui/tournament-show/entry-${name}.webp`, alt: "", draggable: "false",
    onload: e => e.currentTarget.parentElement?.classList.add("printed"),
    onerror: e => e.currentTarget.remove(),
  });
}

function entryTag(number) {
  const folio = String(number).padStart(2, "0");
  return el("span.ent-tag", [
    el("span.ent-tag-label", { text: "エントリーナンバー" }),
    ticketImage("caption"),
    el("b.ent-number", [folio, number <= 4 ? ticketImage(`number-${folio}`) : null]),
  ]);
}

/** cards を順に1枚ずつ出す。chapter を渡すと ENTRANCE_CARDS の章のカードを使う。heroNote ははじめのカードの一言を差し替える。 */
export async function playEntrance(chapterOrCards, { auto = Boolean(window.__remake?.craftTest?.auto || vnTest.turbo), heroNote = null } = {}) {
  const cards = Array.isArray(chapterOrCards) ? chapterOrCards : ENTRANCE_CARDS[chapterOrCards];
  if (!cards?.length || !layers?.fx) return;
  const host = el("div.entrance");
  // 初対面の既読や台詞を動かさず、設定で選ばれた人物絵・背景だけを再利用する。
  const tags = cards.map((_, index) => entryTag(index + 1));
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
        tags[index],
        el("div.ent-meta", [
          el("div.ent-ring", { text: c.ring }),
          el("div.ent-name", { text: me ? "はじめ" : (NAME[c.id] || realName(c.face || c.id)) }),
          el("div.ent-note", [el("small.ent-speaker", { text: "はじめ" }), el("span", { text: `（${me && heroNote ? heroNote : c.note}）` })]),
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
