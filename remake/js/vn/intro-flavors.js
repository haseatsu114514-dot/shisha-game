// 登場演出用の短い表示名。出典は characters.json の favorite_flavor
// （サメちゃんのみ samechan.json の profile）。未設定や正体を伏せる場面は表示しない。
// 表示しない人物: はじめ（推しなしが設定）、お姉さん（みんとの正体を伏せる）、ムカイさん（シーシャの好みでなくコーヒー）、
// 占い師（不明）、マキ・サイ（施設の進行役には専用フレーバーを設けない。brand/story_and_structure.md）
// 2026-10-31 オーナー指示: カットインではメーカー名（アフサール等）を付けず、味の名前だけを出す。
const flavors = {
  sumi: "カルダモン", naru: "バニラ", adam: "ダブルアップル", minto: "ミント",
  rei: "ローズ", tsumugi: "ラベンダー",
  rin: "ブルーベリー", ageha: "ホワイトグミベア／レッドグミベア",
  kumicho: "ドラゴンフルーツ", dr_kemuri: "コーラ", pakki: "ガムシナモン",
  emil: "ピスタチオ", da_silva: "アサイー",
  mashiro: "ブラックティー",
  samechan: "スプリングウォーター",
  // 2026-10-31 オーナー指示: 正本で決まっている好みを全員分そろえる
  kuze: "アールグレイ", steve: "マウンテンミスト", volk: "ブラストミント",
  nagumo: "シガー", maezono: "ミント／ダブルアップル",
  master_hookah: "ライチ", sheikh: "グレープ", shisha_9000: "ランダム",
};

// 2026-10-28 のオーナー指定: 二品のミックスではなく、後半を小さく組む単品名。
export function introFlavor(id, variant = "") {
  if (variant) return null;
  if (id === "hiyori") return { main: "マンゴー", small: "ハバネロ" };
  const main = Object.hasOwn(flavors, id) ? flavors[id] : null;
  return main ? { main } : null;
}
