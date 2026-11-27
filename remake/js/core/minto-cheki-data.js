// PEPPERMINTで頼むみんとのチェキ（PFC14・#3941）。画面を持たない定義だけを置く（記念品・ギャラリー・周回の引き継ぎが共通で読む）。
// 普通のチェキは1枚1,000円で、持っていないものから無作為に1枚（被りなし）。
// secret は正体と本名を知った後、頼んだときにたまに、トレイの下からこっそりくれる私服の一枚（お代はいらない）。
// 絵の元は asset_sources/photo-frames-3941/gen-20261127/ の候補（オーナー選定 2026-11-27）。
export const MINTO_CHEKI_PRICE = 1000;

const normal = (slug, label, words) => ({
  id: `minto_cheki_${slug}`, cg: `cg_minto_cheki_${slug}`, scene: `minto_cheki_${slug}`, label,
  name: `みんとのチェキ（${label}）`, cost: MINTO_CHEKI_PRICE,
  description: `PEPPERMINTで頼んだチェキ。余白に『${words}』。`,
});
const secret = (slug, label, words) => ({
  id: `minto_secret_cheki_${slug}`, cg: `cg_minto_secret_cheki_${slug}`, scene: `minto_secret_cheki_${slug}`, label,
  name: `ないしょのチェキ（${label}）`, cost: 0, secret: true,
  description: `閉店後の店で撮った、私服のみんと。トレイの下からこっそりくれた。余白に『${words}』。`,
});

export const MINTO_CHEKIS = Object.freeze([
  normal("heart", "両手でハート", "はじめくん いつもありがと♡"),
  normal("cheek_peace", "ほっぺにピース", "今日も来てくれて うれしいっ♪"),
  normal("devil_horns", "小悪魔のツノ", "小悪魔に ご注意♡"),
  normal("mint_sprig", "ミントのひと枝", "ミント ましまし♡"),
  normal("finger_heart", "指ハート", "推してくれて ありがと♡"),
  normal("chin_rest", "頬づえ", "みんとに 会いにきてね"),
  normal("salute", "敬礼ウインク", "本日も ご来店感謝♡"),
  normal("cheek_heart", "ほっぺにハート", "ほっぺに ハート♡"),
  normal("half_heart", "2ショット・半分このハート", "2ショット 記念日♡"),
  normal("stiff_peace", "2ショット・かたいピース", "かたいよ〜？ 次は笑ってね"),
  normal("horns_prank", "2ショット・ツノのいたずら", "はじめくんも 悪魔の仲間♡"),
  normal("side_by_side", "2ショット・肩を並べて", "相性 ばっちり♡"),
  normal("drink", "2ショット・ソーダ", "ちゃんと 飲んでね♡"),
].map(Object.freeze));

export const MINTO_SECRET_CHEKIS = Object.freeze([
  secret("hush", "しーっ", "……ないしょの 一枚"),
  secret("blush", "てれる", "……てれる"),
  secret("parfait", "チョコミントパフェ", "チョコミント ……すき"),
].map(Object.freeze));

export const ALL_MINTO_CHEKIS = Object.freeze([...MINTO_CHEKIS, ...MINTO_SECRET_CHEKIS]);
