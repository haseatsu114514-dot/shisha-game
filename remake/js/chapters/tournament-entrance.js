// 大会の入場カットイン（ライバル → 主人公）。第1章の entrance() を共有部品にしたもの（#2031）。
// 保存には触れない演出だけの部品。自動で送られる。
import { faceIconUrl, portraitInfo, realName } from "../core/data.js";
import { el, sleep } from "../core/util.js";
import { layers } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { vnTest } from "../vn/engine.js";

// 章ごとの入場カード。ring＝二つ名、note＝スミさんの一言。face は顔アイコンの id（内部名と違う人物だけ）。
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
    { id: "rei", ring: "薔薇の余韻", note: "REIは間で聴かせる。お前は自分の拍で作れ" },
    { id: "hajime", ring: "県大会の挑戦者", note: "前の大会の自分と比べろ。隣は見なくていい" },
  ],
  3: [
    { id: "kuze", ring: "煙幕の勝負師", note: "久世は相手の判断を動かしてくる。味の名前に釣られるな" },
    { id: "steve", ring: "低温の研究家", note: "スティーブは熱を急がない。最後の一口まで崩れないぞ" },
    { id: "volk", ring: "鉄の煙", note: "ヴォルクの精度は本物だ。数字で張り合っても仕方ない" },
    { id: "hajime", ring: "柚ヶ谷の代表", note: "全国だろうが、やることは一台だ。いつもどおり作ってこい" },
  ],
  4: [
    { id: "naru", ring: "孤高の探求者", note: "なる……ここまで来たか。あいつの基礎は世界でも通じる" },
    { id: "wang", face: "master_hookah", ring: "龍龍水煙所の宗師", note: "王さんは派手な煙の裏で、相手の呼吸を見ている" },
    { id: "sheikh", ring: "世界王者", note: "王者は急がない。全部受け止めるつもりで来るぞ" },
    { id: "hajime", ring: "日本の挑戦者", note: "──行ってこい。目の前の一人に届けてこい" },
  ],
});

const NAME = { wang: "王 煙楼" };

function faceOf(card) {
  if (card.id === "hajime") return el("span.ent-face.ph", { text: "YOU" });
  const id = card.face || card.id;
  const src = faceIconUrl(id) || portraitInfo(id, "normal")?.src;
  return src ? el("img.ent-face", { src, alt: "" }) : el("span.ent-face.ph", { text: (NAME[card.id] || realName(id)).slice(0, 1) });
}

/** cards を順に1枚ずつ出す。chapter を渡すと ENTRANCE_CARDS の章のカードを使う。 */
export async function playEntrance(chapterOrCards, { auto = Boolean(window.__remake?.craftTest?.auto || vnTest.turbo) } = {}) {
  const cards = Array.isArray(chapterOrCards) ? chapterOrCards : ENTRANCE_CARDS[chapterOrCards];
  if (!cards?.length || !layers?.fx) return;
  const host = el("div.entrance");
  layers.fx.append(host);
  try {
    for (const c of cards) {
      const me = c.id === "hajime";
      const card = el(`div.ent-card${me ? ".me" : ""}`, [
        el("div.ent-cut", [faceOf(c), el("span.ent-tag", { text: me ? "CHALLENGER" : "RIVAL" })]),
        el("div.ent-meta", [
          el("div.ent-ring", { text: c.ring }),
          el("div.ent-name", { text: me ? "はじめ" : (NAME[c.id] || realName(c.face || c.id)) }),
          el("div.ent-note", { text: `スミ「${c.note}」` }),
        ]),
      ]);
      host.replaceChildren(card);
      await sleep(30);
      card.classList.add("in");
      me ? SE.fanfare() : SE.select();
      await sleep(auto ? 80 : 2100);
    }
  } finally {
    host.remove();
  }
}
