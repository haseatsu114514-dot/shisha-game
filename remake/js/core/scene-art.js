// 店内と台を同じ1280×720の座標で合成する。配置はWorkの採用済みアートに合わせた値。
import { DB, img } from "./data.js";

const TONARI_SCENE_PROPS = [
  { file: "shisha_tonari.png", x: 659, y: 360, h: 133, ratio: 469 / 768 },
  { file: "shisha_tonari.png", x: 1160, y: 347, h: 169, ratio: 469 / 768 },
  { file: "shisha_tonari.png", x: 341, y: 642, h: 340, ratio: 469 / 768 },
];
const C_STATION_SCENE_PROPS = [
  { file: "shisha_c_station.png", x: 448, y: 311, h: 140, ratio: 491 / 768 },
  { file: "shisha_c_station.png", x: 160, y: 447, h: 280, ratio: 491 / 768 },
  { file: "shisha_c_station.png", x: 1180, y: 438, h: 275, ratio: 491 / 768 },
];
export const SCENE_PROPS = {
  "bg_hideaway.png": [
    { file: "shisha_hideaway.png", x: 422, y: 529, h: 290, ratio: 515 / 768 },
    { file: "shisha_hideaway.png", x: 691, y: 371, h: 140, ratio: 515 / 768 },
    { file: "shisha_hideaway.png", x: 1146, y: 511, h: 252, ratio: 515 / 768 },
  ],
  "bg_c_station_day.png": C_STATION_SCENE_PROPS,
  "bg_c_station_night.png": C_STATION_SCENE_PROPS,
  "bg_tournament_stage.png": [242, 510, 770, 1038].map((x) => ({
    file: "shisha_c_station.png", x, y: 303, h: 124, ratio: 491 / 768,
  })),
  "bg_fookah_showroom.png": [
    { file: "shisha_fookah.png", x: 300, y: 462, h: 230, ratio: 522 / 768 },
    { file: "shisha_fookah.png", x: 955, y: 468, h: 230, ratio: 522 / 768 },
  ],
  "bg_shop.png": [
    { file: "shisha_eden.png", x: 620, y: 348, h: 155, ratio: 522 / 768 },
    { file: "shisha_kemurikusa.png", x: 390, y: 378, h: 190, ratio: 454 / 768 },
    { file: "shisha_tonari.png", x: 180, y: 406, h: 220, ratio: 469 / 768 },
  ],
  "bg_eden_shop.png": [
    { file: "shisha_eden.png", x: 550, y: 428, h: 130, ratio: 522 / 768 },
    { file: "shisha_eden.png", x: 955, y: 448, h: 170, ratio: 522 / 768 },
    { file: "shisha_eden.png", x: 139, y: 554, h: 220, ratio: 522 / 768 },
    { file: "shisha_eden.png", x: 1110, y: 609, h: 290, ratio: 522 / 768 },
  ],
  "bg_tonari_inside_day.png": TONARI_SCENE_PROPS,
  "bg_tonari_inside_night.png": TONARI_SCENE_PROPS,
  "peppermint.png": [
    { file: "shisha_peppermint.png", x: 900, y: 471, h: 180, ratio: 512 / 768 },
    { file: "shisha_peppermint.png", x: 950, y: 623, h: 260, ratio: 512 / 768 },
  ],
  "kemurikusa.png": [
    { file: "shisha_kemurikusa.png", x: 480, y: 484, h: 190, ratio: 454 / 768 },
    { file: "shisha_kemurikusa.png", x: 852, y: 541, h: 235, ratio: 454 / 768 },
    { file: "shisha_kemurikusa.png", x: 781, y: 697, h: 320, ratio: 454 / 768 },
  ],
};

const sceneFile = (url) => String(url || "").split(/[?#]/)[0].split("/").pop().replace(/\.webp$/, ".png");
function propsFor(url) {
  const available = new Set(DB.manifest.sceneProps || []);
  return (SCENE_PROPS[sceneFile(url)] || []).filter((p) => available.has(p.file));
}
export function sceneArtUrls(url) {
  if (!url) return [];
  return [...new Set([url, ...propsFor(url).map((p) => img(`ui/scene_props/${p.file}`))])];
}

/** 背景と台を一枚としてcoverする。横長のマッププレビューも同じ切り取りになる。 */
export function renderSceneArt(host, url) {
  host.querySelector(":scope > .scene-art")?.remove();
  delete host.dataset.sceneBg;
  host.style.backgroundImage = url ? `url("${url}")` : "none";
  const props = propsFor(url);
  if (!props.length) return;
  const file = sceneFile(url);
  host.dataset.sceneBg = file;
  host.style.backgroundImage = "none";
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.classList.add("scene-art");
  svg.setAttribute("viewBox", "0 0 1280 720");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  const picture = (src, x, y, width, height) => {
    const node = document.createElementNS(ns, "image");
    for (const [k, v] of Object.entries({ href: src, x, y, width, height })) node.setAttribute(k, String(v));
    svg.append(node);
    return node;
  };
  picture(url, 0, 0, 1280, 720);
  for (const p of props) {
    const width = p.h * p.ratio;
    const shadow = document.createElementNS(ns, "ellipse");
    for (const [k, v] of Object.entries({ cx: p.x, cy: p.y - 2, rx: width * 0.29, ry: p.h * 0.012, fill: "rgba(0,0,0,0.24)" })) shadow.setAttribute(k, String(v));
    svg.append(shadow);
    const node = picture(img(`ui/scene_props/${p.file}`), p.x - width / 2, p.y - p.h, width, p.h);
    node.classList.add("scene-prop");
    if (/_night\.png$/.test(file)) node.style.filter = "brightness(0.74)";
  }
  host.prepend(svg);
}

