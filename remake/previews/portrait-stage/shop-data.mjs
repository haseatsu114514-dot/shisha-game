// 縦画面C案「煙の舞台」: ショップ・シーシャくじ・チェキ・プリクラが共有する、試作だけの財布と持ち物（要望台帳 VPS01〜）。
// 地図の所持金（42,000円）から始まり、ページを開き直すと元に戻る。本編の保存・所持金・在庫には触れない。
// 商品・機材・くじの中身は正本の data/*.json をそのまま読む（値は写していない。データを直せば、この試作にもそのまま効く）。
// 商品の絵は本編のショップと同じ採用済みの絵（remake/js/daily/shop-art*.js・shop-equipment-art.js。どれも絵の置き場と窓だけを持つ部品）を読む。
import { SHOP_ART } from "../../js/daily/shop-art.js";
import { AF_VANILLA_ART } from "../../js/daily/shop-art-af-vanilla.js";
import { REMAINING_SHOP_ART } from "../../js/daily/shop-art-remaining.js";
import { LIMITED_FLAVOR_ART } from "../../js/daily/shop-art-limited.js";
import { NEW_FLAVOR_ART } from "../../js/daily/shop-art-new-flavors.js";
import { CHARACTER_FLAVOR_ART } from "../../js/daily/shop-art-character-flavors.js";
import { FLAVOR_CARTONS_3287_ART } from "../../js/daily/shop-art-flavor-cartons-3287.js";
import { SHOP_EQUIPMENT_ART } from "../../js/daily/shop-equipment-art.js";
import { shopText, shopProductName, groupShopFlavors } from "../../js/daily/shop-display.js";

export { shopText, shopProductName, groupShopFlavors };

const DATA = new URL("../../../data/", import.meta.url).href;
const REMAKE_IMG = new URL("../../img/", import.meta.url).href;

// ── 本編の値の写し（出どころ） ──
// 第1章の店頭に並ぶ葉（remake/js/daily/shop.js の SHOP_FLAVORS）
export const SHOP_FLAVORS = [
  "mint", "double_apple", "blueberry", "strawberry", "vanilla", "pineapple", "coconut", "mango",
  "lemon", "peach", "orange", "grape", "melon", "watermelon", "banana", "cinnamon", "rose", "lychee",
  "cardamom", "lavender", "cola", "raspberry", "gum_cinnamon", "bombshell", "white_musk",
  "grapefruit", "honey",
];
export const FLAVOR_BOX_GRAMS = 50;                       // shop.js: 1箱50g
export const SHOP_EQUIP_TYPES = ["bowl", "hms", "charcoal"]; // shop.js: 店に並べる機材の種類（台は第2章の店から）
export const CAT_LABEL = { cooling: "清涼", sweet: "スイート", fruit: "フルーツ", spice: "スパイス", floral: "フローラル" }; // shop.js
export const TYPE_LABEL = { bowl: "ボウル", hms: "HMD", charcoal: "炭", homeware: "シーシャ台" };                           // shop.js
// 絵の無いボウルは、制作の空のボウルの絵（shop.js の EQUIP_ART）
const EQUIP_ART = { silicone_bowl: "bowl_empty_silicone", hagal_80beat: "bowl_empty_phunnel", suyaki_hagal: "bowl_empty_clay", suyaki_hiyori: "bowl_empty_hiyori", suyaki_rei: "bowl_empty_rei" };
// 葉の特徴の札（remake/js/craft/flavor-profile.js の flavorFeatures の tags。本編は state を連れてくるので写した）
const TAG_RULES = [["sweet_natural", 6, "甘い香り"], ["sweet_confection", 6, "お菓子感"], ["cooling", 6, "清涼"], ["spiciness", 5, "スパイス"], ["sourness", 6, "酸味"], ["floral", 5, "花の香り"]];
export const flavorTags = (f) => TAG_RULES.filter(([key, at]) => Math.max(0, Math.min(10, Number(f?.stats?.[key]) || 0)) >= at).map(([, , label]) => label).slice(0, 2);
// くじの景品の自室の台（remake/js/daily/kuji-prize-art.js の RIG_ART）
const RIG_ART = { home_rig_pro: { url: `${REMAKE_IMG}ui/scene_props/shisha_home_pro.webp`, box: [280, 21, 464, 1489], size: [1024, 1536] } };

// ── 試作の財布（地図と同じ 第1章 DAY 5 の昼） ──
// 葉は買い出しのミントとレモンが少し残っている所から。機材ははじめの一式（シリコンボウル・ロートス・平炭）を使っている
export const WALLET = {
  money: 42000,
  stock: { mint: 30, lemon: 20 },
  owned: ["silicone_bowl", "lotos_hagal", "flat_charcoal"],
  equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
  goods: [],       // くじで当たった、売れる小物（{ name, sell }）
  keepsakes: [],   // 思い出の品（チェキ・プリクラ）
  kuji: null,      // くじの箱（shop-kuji.mjs が作る）
};
export const yen = (n) => `¥${Math.round(n).toLocaleString("ja-JP")}`;
export const addStock = (id, grams) => { WALLET.stock[id] = Math.max(0, (WALLET.stock[id] || 0) + grams); };

let dataPromise = null;
/** 正本の商品・機材・くじを一度だけ読む（一覧（PC）に何台並んでも通信は1回） */
export function loadShopData() {
  return (dataPromise ||= Promise.all(["flavors", "equipment", "kuji"].map((name) => fetch(`${DATA}${name}.json`).then((res) => {
    if (!res.ok) throw new Error(`${name}.json: HTTP ${res.status}`);
    return res.json();
  }))).then(([flavors, equipment, kuji]) => ({
    flavors: flavors.flavors, flavorById: Object.fromEntries(flavors.flavors.map((f) => [f.id, f])),
    equipment: equipment.equipment, equipById: Object.fromEntries(equipment.equipment.map((e) => [e.id, e])),
    kuji,
  })));
}

/** 店に並べる機材か（shop.js の forSale。第1章の店） */
export const forSale = (e, chapter = 1) => !!e && SHOP_EQUIP_TYPES.includes(e.type) && (e.chapter_min || 1) <= chapter && !e.not_for_sale;

const generatedFlavorArt = (id) => AF_VANILLA_ART[id] || SHOP_ART[id] || REMAINING_SHOP_ART[id] || LIMITED_FLAVOR_ART[id]
  || NEW_FLAVOR_ART[id] || CHARACTER_FLAVOR_ART[id] || FLAVOR_CARTONS_3287_ART[id];

/** 機材に採用済みの絵があるか（くじの景品で、絵の無い物は景品の包みにする） */
export const hasEquipArt = (id, data) => !!(SHOP_EQUIPMENT_ART[data?.equipById?.[id]?.art || id] || RIG_ART[id] || EQUIP_ART[id]);

/**
 * 商品の絵（窓の範囲だけを、正方形 size の中に収める）。size は rem。
 * 本編の windowArt と同じ切り抜き。読み込めなかった時は、種類の札（文字）に替える。
 */
export function productArtHtml(kind, id, data, size = 9, { pad = 0.88 } = {}) {
  const label = (text) => `<span class="sp-art sp-art-text" style="--s:${size}rem"><span>${text}</span></span>`;
  let art = null;
  if (kind === "flavor") art = generatedFlavorArt(id);
  else {
    const item = data?.equipById?.[id];
    art = SHOP_EQUIPMENT_ART[item?.art || id] || RIG_ART[id] || null;
    if (!art && EQUIP_ART[id]) {
      return `<span class="sp-art" style="--s:${size}rem"><img class="sp-art-whole" src="${REMAKE_IMG}ui/making/${EQUIP_ART[id]}.webp" alt="" decoding="async" draggable="false"></span>`;
    }
    if (!art) return label(item ? TYPE_LABEL[item.type] || "機材" : "景品");
  }
  if (!art) return label("フレーバー");
  const [x, y, w, h] = art.box, [fw, fh] = art.size, k = Math.min(size * pad / w, size * pad / h);
  const f = (n) => `${(n * k).toFixed(3)}rem`;
  return `<span class="sp-art" style="--s:${size}rem"><span class="sp-art-win" style="width:${f(w)};height:${f(h)}">`
    + `<img src="${art.url}" alt="" decoding="async" draggable="false" style="width:${f(fw)};height:${f(fh)};left:${f(-x)};top:${f(-y)}" onerror="this.closest('.sp-art').classList.add('missing')"></span></span>`;
}
