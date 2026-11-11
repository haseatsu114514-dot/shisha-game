// シーシャくじの賞の札に載せる景品の絵。採用済みの商品絵（葉のパッケージ・機材・台）をそのまま使う。
// 絵が無い景品（小物・絵が未制作の台）は、賞の色のリボンを掛けた箱（景品の包み）にする。
import { el } from "../core/util.js";
import { DB, img } from "../core/data.js";
import { flavorPackageArt } from "./shop.js";
import { SHOP_EQUIPMENT_ART } from "./shop-equipment-art.js";

// 自室に置く台の絵（core/scene-art.js と同じ採用済みの原画）。[ファイル, 見せる範囲, 原画の大きさ]
const RIG_ART = {
  home_rig_pro: ["shisha_home_pro.png", [280, 21, 464, 1489], [1024, 1536]],
};

/** 原画の box の範囲だけを、size の正方形に収めて見せる */
function windowImg(url, [x, y, w, h], [fullW, fullH], size) {
  const k = Math.min(size / w, size / h);
  const frame = el("span.kj-art-img", { style: { width: `${w * k}px`, height: `${h * k}px` } });
  const image = el("img", { alt: "", decoding: "async", draggable: "false", style: {
    width: `${fullW * k}px`, height: `${fullH * k}px`, left: `${-x * k}px`, top: `${-y * k}px`,
  }, onerror: () => frame.replaceWith(giftBox()) });
  frame.append(image);
  image.src = url;
  return frame;
}

/** 景品の包み（絵の無い景品）。色は札の賞の色（CSS の --kj-main / --kj-acc）に従う */
function giftBox() {
  return el("span.kj-gift", [el("i.kj-gift-lid"), el("i.kj-gift-box"), el("i.kj-gift-bow")]);
}

/** 葉のパッケージ（絵が無ければ null）。読み込めなかったときは景品の包みに替える（ショップ用の文字の札は出さない） */
function leaf(id, size) {
  const art = flavorPackageArt(id, size);
  if (!art?.classList.contains("generated")) return null;
  art.classList.add("kj-art-leaf");
  art.style.width = art.style.height = `${size}px`;
  const holder = el("span.kj-art-pack", [art]);
  art.querySelector("img")?.addEventListener("error", () => holder.replaceChildren(giftBox()));
  return holder;
}

/** 景品の絵。size は絵を収める正方形の一辺（px） */
export function prizeArt(prize, size = 220) {
  if (prize.equipId) {
    // 店と同じ絵を使う（data/equipment.json の art は絵の借り先。例: 高密度フラット炭 → フラット炭）
    const shop = SHOP_EQUIPMENT_ART[DB.equipById?.[prize.equipId]?.art || prize.equipId];
    if (shop) return windowImg(shop.url, shop.box, shop.size, size);
    const rig = RIG_ART[prize.equipId];
    if (rig) return windowImg(img(`ui/scene_props/${rig[0]}`), rig[1], rig[2], size);
    return giftBox();
  }
  if (prize.type === "flavor" && prize.flavorId) return leaf(prize.flavorId, size) || giftBox();
  if (prize.type === "flavor" && prize.flavors?.length) {
    // 詰め合わせは、中身のパッケージを扇のように重ねる
    const each = Math.round(size * 0.62);
    const packs = prize.flavors.slice(0, 3).map((f) => leaf(f.id, each)).filter(Boolean);
    if (packs.length) return el("span.kj-art-fan", { dataset: { n: String(packs.length) } }, packs);
  }
  return giftBox();
}
