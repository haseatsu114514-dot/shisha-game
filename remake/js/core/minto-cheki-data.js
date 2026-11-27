// PEPPERMINTのみんとのチェキ（PFC14・15・17・#3941）。画面を持たない定義だけを置く（記念品・ギャラリー・周回の引き継ぎが共通で読む）。
// - solo: チェキを頼むと、持っていないものから無作為に1枚（1枚1,000円・被りなし）
// - twoShot: 2ショットは頼んで出るものではなく、来店の会話の流れで撮って、そのまま渡してくれる一度ずつの回（daily/spots.js の MINTO_TWOSHOT_EVENTS）
// - secret: 正体と本名を知った後、チェキを頼んだときにたまに、トレイの下からこっそりくれる私服の一枚（お代はいらない）
// 絵の元は asset_sources/photo-frames-3941/gen-20261127/ の候補（オーナー選定 2026-11-27）。
export const MINTO_CHEKI_PRICE = 1000;

const cheki = (slug, label) => ({ id: `minto_cheki_${slug}`, cg: `cg_minto_cheki_${slug}`, label });
const solo = (slug, label, words) => ({
  ...cheki(slug, label), scene: `minto_cheki_${slug}`, kind: "solo",
  name: `みんとのチェキ（${label}）`, cost: MINTO_CHEKI_PRICE,
  description: `PEPPERMINTで頼んだチェキ。余白に『${words}』。`,
});
const twoShot = (slug, label, description) => ({
  ...cheki(slug, label), scene: `minto_twoshot_${slug}`, kind: "twoShot", twoShot: true,
  name: `みんととの2ショットチェキ（${label}）`, cost: 0, description,
});
const secret = (slug, label, words) => ({
  id: `minto_secret_cheki_${slug}`, cg: `cg_minto_secret_cheki_${slug}`, label,
  scene: `minto_secret_cheki_${slug}`, kind: "secret", secret: true,
  name: `ないしょのチェキ（${label}）`, cost: 0,
  description: `閉店後の店で撮った、私服のみんと。トレイの下からこっそりくれた。余白に『${words}』。`,
});

/** 頼んで撮るチェキ（無作為・被りなし） */
export const MINTO_CHEKIS = Object.freeze([
  solo("heart", "両手でハート", "はじめくん いつもありがと♡"),
  solo("cheek_peace", "ほっぺにピース", "今日も来てくれて うれしいっ♪"),
  solo("devil_horns", "小悪魔のツノ", "小悪魔に ご注意♡"),
  solo("mint_sprig", "ミントのひと枝", "ミント ましまし♡"),
  solo("finger_heart", "指ハート", "推してくれて ありがと♡"),
  solo("chin_rest", "頬づえ", "みんとに 会いにきてね"),
  solo("salute", "敬礼ウインク", "本日も ご来店感謝♡"),
  solo("cheek_heart", "ほっぺにハート", "ほっぺに ハート♡"),
].map(Object.freeze));

/** 会話の流れで撮って渡してくれる2ショット（この順に一本ずつ。daily/spots.js の MINTO_TWOSHOT_EVENTS と同じ順） */
export const MINTO_TWOSHOT_CHEKIS = Object.freeze([
  twoShot("half_heart", "半分このハート", "初めての2ショット。みんとが「2ショット記念日」にしてくれた。余白に『2ショット 記念日♡』。"),
  twoShot("stiff_peace", "かたいピース", "常連さんのおごりで、みんなの前で撮った2ショット。余白に『かたいよ〜？ 次は笑ってね』。"),
  twoShot("drink", "ピンクのソーダ", "水分をとっていなかった日に、飲んだ証拠に撮った2ショット。余白に『ちゃんと 飲んでね♡』。"),
  twoShot("horns_prank", "ツノのいたずら", "シャッターの直前に、頭の上へ指のツノを立てられた2ショット。余白に『はじめくんも 悪魔の仲間♡』。"),
  twoShot("side_by_side", "肩を並べて", "「シーシャ相性チェック」のプレゼントの2ショット。余白に『相性 ばっちり♡』。"),
].map(Object.freeze));

/** こっそりくれる私服の一枚 */
export const MINTO_SECRET_CHEKIS = Object.freeze([
  secret("hush", "しーっ", "……ないしょの 一枚"),
  secret("blush", "てれる", "……てれる"),
].map(Object.freeze));

export const ALL_MINTO_CHEKIS = Object.freeze([...MINTO_CHEKIS, ...MINTO_TWOSHOT_CHEKIS, ...MINTO_SECRET_CHEKIS]);
