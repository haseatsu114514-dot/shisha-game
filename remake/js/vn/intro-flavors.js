// 登場演出用の短い表示名。出典は characters.json の favorite_flavor
// （サメちゃんのみ samechan.json の profile）。未設定や正体を伏せる場面は表示しない。
const flavors = {
  sumi: "カルダモン", naru: "バニラ", adam: "ダブルアップル", minto: "ミント",
  kuze: "アフサール アールグレイ", steve: "マウンテンミスト",
  rei: "ローズ", master_hookah: "ライチ", tsumugi: "ラベンダー",
  rin: "ブルーベリー", ageha: "ホワイトグミベア／レッドグミベア",
  kumicho: "ドラゴンフルーツ", dr_kemuri: "コーラ", pakki: "ガムシナモン",
  emil: "ピスタチオ", sheikh: "グレープ", da_silva: "アサイー",
  mashiro: "ブラックティー", maezono: "ミント／ダブルアップル",
  samechan: "アフサール スプリングウォーター",
};

// 2026-10-28 のオーナー指定: 二品のミックスではなく、後半を小さく組む単品名。
export function introFlavor(id, variant = "") {
  if (variant) return null;
  if (id === "hiyori") return { main: "マンゴー", small: "ハバネロ" };
  const main = flavors[id];
  return main ? { main } : null;
}
