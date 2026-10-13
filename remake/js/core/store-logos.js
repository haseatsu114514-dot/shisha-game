// 採用済みの店ロゴ。元PNGの採用部分だけを表示し、文字・配色・透明度を保持する。
import { el } from "./util.js";

export const STORE_LOGOS = Object.freeze({
  tonari: { name: "tonari", file: "tonari", sheet: [2172, 724], frame: [812, 15, 551, 684] },
  naru: { name: "KEMURIKUSA", file: "kemurikusa", sheet: [2172, 724], frame: [45, 240, 736, 248] },
  adam: { name: "EDEN", file: "eden", sheet: [1960, 802], frame: [36, 53, 605, 719] },
  minto: { name: "PEPPERMINT", file: "peppermint", sheet: [2172, 724], frame: [772, 242, 640, 231] },
  shop: { name: "Dr.fookah", file: "dr-fookah", sheet: [2048, 768], frame: [1337, 281, 662, 260] },
  c_station: { name: "C.STATION", file: "c-station", sheet: [2048, 768], frame: [1533, 157, 481, 440] },
  choizap: { name: "チョイザップ", file: "choizap", sheet: [2172, 724], frame: [754, 89, 693, 547] },
});

export const hasStoreLogo = (id) => Object.hasOwn(STORE_LOGOS, id);
export const storeLogoUrl = (id) => hasStoreLogo(id)
  ? new URL(`../../../assets/ui/store_logos/${STORE_LOGOS[id].file}.png`, import.meta.url).href : null;
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
    onerror: () => { node.classList.add("missing"); node.replaceChildren(el("span", { text: logo.name })); },
  });
  node.append(img);
  return node;
}
