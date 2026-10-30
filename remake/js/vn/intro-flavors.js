// 登場演出用の短い表示名。出典は characters.json の favorite_flavor
// （サメちゃんのみ samechan.json の profile）。未設定や正体を伏せる場面は表示しない。
const flavors = {
  sumi: "カルダモン", naru: "バニラ", adam: "ダブルアップル", minto: "ミント",
  rei: "ローズ", tsumugi: "ラベンダー",
  rin: "ブルーベリー", ageha: "ホワイトグミベア／レッドグミベア",
  kumicho: "ドラゴンフルーツ", dr_kemuri: "コーラ", pakki: "ガムシナモン",
  emil: "ピスタチオ", da_silva: "アサイー",
  mashiro: "ブラックティー",
  samechan: "アフサール スプリングウォーター",
};

// 2026-10-28 のオーナー指定: 二品のミックスではなく、後半を小さく組む単品名。
export function introFlavor(id, variant = "") {
  if (variant) return null;
  if (id === "hiyori") return { main: "マンゴー", small: "ハバネロ" };
  const main = Object.hasOwn(flavors, id) ? flavors[id] : null;
  return main ? { main } : null;
}
