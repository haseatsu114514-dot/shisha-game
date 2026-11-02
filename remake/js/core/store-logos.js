// 採用済みの店ロゴ。元PNGの採用部分だけを表示し、文字・配色・透明度を保持する。
import { el } from "./util.js";

const BASE_LOGOS = {
  tonari: { name: "tonari", file: "tonari", ext: "webp", sheet: [2172, 724], frame: [812, 15, 551, 684] },
  naru: { name: "KEMURIKUSA", file: "kemurikusa", ext: "webp", sheet: [2172, 724], frame: [45, 240, 736, 248] },
  adam: { name: "EDEN", file: "eden", ext: "webp", sheet: [1960, 802], frame: [36, 53, 605, 719] },
  minto: { name: "PEPPERMINT", file: "peppermint", ext: "webp", sheet: [2172, 724], frame: [772, 242, 640, 231] },
  shop: { name: "Dr.fookah", file: "dr-fookah", ext: "webp", sheet: [2048, 768], frame: [1337, 281, 662, 260] },
  c_station: { name: "C.STATION", file: "c-station", ext: "webp", sheet: [2048, 768], frame: [1533, 157, 481, 440] },
  choizap: { name: "CHOI-ZAP", file: "choizap", ext: "webp", sheet: [2172, 724], frame: [754, 89, 693, 547] },
  ch2_ageha: { name: "MELTY PUFF", file: "melty-puff", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  ch2_kumicho: { name: "神崎煙草店", file: "kanzaki", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  ch2_rei: { name: "零-ZERO-", file: "zero", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
};
export const STORE_LOGOS = Object.freeze({ ...BASE_LOGOS,
  ch2_shop: { ...BASE_LOGOS.shop, name: "Dr.fookah 柚ヶ谷店" },
  ch2_c_station: { ...BASE_LOGOS.c_station, name: "C.STATION 柚ヶ谷店" },
  ch2_aquarium: { name: "都市型水族館", file: "ch2-aquarium", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  ch2_sento: { name: "銭湯・サウナ", file: "ch2-sento", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  trpg_bar: { name: "ボドゲカフェ / TRPG BAR", file: "trpg-bar", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  ch4_festa: { name: "FESTA", file: "ch4-festa", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  // 第3章・東京（#2034）。キーは ch3-map-model.js の地点 id に ch3_ を付けたもの。
  ch3_enmaku: { name: "煙幕", file: "ch3-enmaku", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  ch3_steve: { name: "Smoke & Glory", file: "ch3-smoke-and-glory", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  ch3_volk: { name: "Железный Дым（鉄の煙）", file: "ch3-iron-smoke", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  ch3_mukai: { name: "mukai", file: "ch3-mukai", ext: "webp", sheet: [768, 512], frame: [0, 0, 768, 512] },
  ch3_club: { name: "SEAM", file: "ch3-seam", ext: "webp", sheet: [768, 512], frame: [20, 191, 728, 130] }, // クラブSEAM（DJS15・#2199）。横長の文字ロゴなので外枠を文字の周りに詰める
});

export const hasStoreLogo = (id) => Object.hasOwn(STORE_LOGOS, id);
export const storeLogoUrl = (id) => hasStoreLogo(id)
  ? new URL(`../../../assets/ui/store_logos/${STORE_LOGOS[id].file}.${STORE_LOGOS[id].ext || "png"}`, import.meta.url).href : null;
export const allStoreLogoUrls = () => Object.keys(STORE_LOGOS).map(storeLogoUrl);

/** 店舗ごとに異なる縦横比を保ち、指定された枠へ収める。 */
export function storeLogo(id, { width = 104, height = 60 } = {}) {
  if (!hasStoreLogo(id)) return null;
  const logo = STORE_LOGOS[id];
  const [x, y, w, h] = logo.frame;
  const scale = Math.min(width / w, height / h);
  const node = el("span.store-logo", {
    role: "img", "aria-label": `${logo.name}のロゴ`, dataset: { storeLogo: id },
    style: { width: `${w * scale}px`, height: `${h * scale}px` },
  });
  const img = el("img", {
    src: storeLogoUrl(id), alt: "", decoding: "async", draggable: false,
    style: { width: `${logo.sheet[0] / w * 100}%`, height: `${logo.sheet[1] / h * 100}%`, left: `${-x / w * 100}%`, top: `${-y / h * 100}%` },
    onerror: () => {
      // 店名は画像の切り抜き比率ではなく、呼び出し元が用意した枠へ収める。
      node.style.width = `${width}px`; node.style.height = `${height}px`;
      node.classList.add("missing"); node.replaceChildren(el("span", { text: logo.name }));
    },
  });
  node.append(img);
  return node;
}
