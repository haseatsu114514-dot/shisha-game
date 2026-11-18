// 店内と台を同じ1280×720の座標で合成する。配置はWorkの採用済みアートに合わせた値。
import { DB, img } from "./data.js";
import { state } from "./state.js";
import { on } from "./bus.js";

// 承認済みv3原画をそのまま使う。cropは透明な余白だけを表示から外す座標。
// x/yは接地点、hは台本体の高さ。机の手前左と、その右側の床へ置く。
// 特注台と、それをもとにしたくじ限定の台3種（equipment.json の base: "stand_custom"）は同じ場所に置く。
// crop は絵ごとに、ホースなし版の原画の不透明範囲（実測）へ合わせる（接地のため）。
// 以前の crop は下端が実物より 200px 以上深く、台が接地点から浮いて見えた（#3418）。
// 特注台系は床ではなく部屋中央のローテーブルの天板へ置く（#3418・オーナー「テーブルの上とかに置けるとベスト」）。
const CUSTOM_SPOT = { x: 700, y: 524, size: [1024, 1536] };
const HOME_SCENE_PROPS = [
  { owned: "home_rig_set", file: "shisha_home_tabletop.png", x: 563, y: 552, h: 126, ratio: 648 / 1048, crop: [286, 181, 648, 1048], size: [1222, 1287] },
  { owned: "home_rig_pro", file: "shisha_home_pro.png", x: 914, y: 563, h: 236, ratio: 464 / 1489, crop: [280, 21, 464, 1489], size: [1024, 1536] },
  { owned: "stand_walnut", file: "shisha_home_stand_walnut.png", x: 1000, y: 563, h: 197, ratio: 523 / 1289, crop: [130, 47, 523, 1289], size: [1024, 1536] },
  { owned: "stand_custom", file: "shisha_home_stand_custom.png", ...CUSTOM_SPOT, h: 175, ratio: 504 / 1184, crop: [197, 68, 504, 1184] },
  { owned: "stand_custom_melty", file: "shisha_home_stand_custom_melty.png", ...CUSTOM_SPOT, h: 175, ratio: 515 / 1190, crop: [191, 66, 515, 1190] },
  { owned: "stand_custom_tosu", file: "shisha_home_stand_custom_tosu.png", ...CUSTOM_SPOT, h: 175, ratio: 507 / 1185, crop: [195, 68, 507, 1185] },
  { owned: "stand_custom_engraved", file: "shisha_home_stand_custom_engraved.png", ...CUSTOM_SPOT, h: 175, ratio: 508 / 1190, crop: [196, 67, 508, 1190] },
];
const isHome = (url) => /^bg_home(?:_(?:overcast_)?(?:day|night))?\.png$/.test(sceneFile(url));

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
  // 隠れ家（#3282 B6・2026-11-13 に描き直した絵）: 台を描いていない絵なので、中央の卓・中の卓・右の卓の天板へ重ねる。
  // x は台の中心、y は台の底（卓の天板の中ほど）、h は高さ。奥の卓ほど小さく、手前の卓ほど大きい。
  "bg_hideaway.png": [
    { file: "shisha_hideaway.png", x: 805, y: 398, h: 140, ratio: 368 / 768 },
    { file: "shisha_hideaway.png", x: 925, y: 492, h: 152, ratio: 368 / 768 },
    { file: "shisha_hideaway.png", x: 1165, y: 520, h: 172, ratio: 368 / 768 },
  ],
  "bg_c_station_day.png": C_STATION_SCENE_PROPS,
  "bg_c_station_night.png": C_STATION_SCENE_PROPS,
  // 大会会場（#3282 B10・2026-11-13 に描き直した絵）: 4つの作業台の天板（y≈347）の中央へ重ねる。台の中心は x=274・509・765・1003。
  "bg_tournament_stage.png": [274, 509, 765, 1003].map((x) => ({
    file: "shisha_c_station.png", x, y: 347, h: 124, ratio: 424 / 768,
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
  // EDENの採用背景はテーブル・展示台上のシーシャを含む。旧位置の台を重ねない。
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
// homeRigs:false は制作画面用。作業中は大会用の台だけを見せ、所持品の台を背景に置かない（#873）。
// 自室に置くのは、いちばん後に手に入れた1台だけ（全台横断。オーナー指示 2026-11-18）。
// state.owned の並びが入手順なので、最後尾に近い所持品ほど新しい。絵が目録に無い台は数えない。
function homeProps(available) {
  const owned = state?.owned || [];
  let best = null;
  for (const p of HOME_SCENE_PROPS) {
    if (!owned.includes(p.owned) || !available.has(p.file)) continue;
    if (!best || owned.lastIndexOf(p.owned) > owned.lastIndexOf(best.owned)) best = p;
  }
  return best ? [best] : [];
}
function propsFor(url, { homeRigs = true } = {}) {
  const available = new Set(DB.manifest.sceneProps || []);
  if (isHome(url)) {
    // 昼・夜の自室背景は台をローテーブルの真ん中へ描き込んだ絵（#3418・2026-11-18 オーナー採用の背景リメイク、昼夜ペア）。
    // 所持品の台を重ねると台が二重になるので、昼と夜は小道具を出さない。曇天は描き込みが無いので従来どおり重ねる。
    if (sceneFile(url) === "bg_home_day.png" || sceneFile(url) === "bg_home_night.png") return [];
    return homeRigs ? homeProps(available) : [];
  }
  return (SCENE_PROPS[sceneFile(url)] || []).filter((p) => available.has(p.file));
}
export function sceneArtUrls(url, options) {
  if (!url) return [];
  return [...new Set([url, ...propsFor(url, options).map((p) => img(`ui/scene_props/${p.file}`))])];
}

/** 背景と台を一枚としてcoverする。横長のマッププレビューも同じ切り取りになる。 */
export function renderSceneArt(host, url, { homeRigs = true } = {}) {
  host.querySelector(":scope > .scene-art")?.remove();
  delete host.dataset.sceneBg;
  delete host.dataset.homeScene;
  delete host.dataset.homeRigs;
  // 制作画面の家背景は所持品が変わっても台を足さないので、再描画の対象にしない。
  if (isHome(url) && homeRigs) {
    host.dataset.homeScene = url;
    host.dataset.homeRigs = propsFor(url).map((p) => p.owned).join(",");
  }
  host.style.backgroundImage = url ? `url("${url}")` : "none";
  // 絵の名前はいつも data-scene-bg にも書く。時間帯の色（css/look-neo.css）はこの名前で判定する。
  // inline の style を :has() で見ると、ページ内のどの style の書き換えでもページ全体の見た目を計算し直すことになり、
  // 針や炭が動くたびに毎フレーム重くなる（CRN・穴あけの重さ）。
  if (url) host.dataset.sceneBg = sceneFile(url);
  const props = propsFor(url, { homeRigs });
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
  // 自室の所持品の影は、平らな楕円だと「貼った」感じが強いので、中心が濃く縁へ消える放射グラデにする（#3418）
  if (props.some((p) => p.owned)) {
    const defs = document.createElementNS(ns, "defs");
    const grad = document.createElementNS(ns, "radialGradient");
    grad.setAttribute("id", "home-prop-shadow");
    for (const [offset, opacity] of [["0%", "0.34"], ["62%", "0.20"], ["100%", "0"]]) {
      const stop = document.createElementNS(ns, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", "#1a0f08");
      stop.setAttribute("stop-opacity", opacity);
      grad.append(stop);
    }
    defs.append(grad);
    svg.append(defs);
  }
  for (const p of props) {
    const width = p.h * p.ratio;
    const shadow = document.createElementNS(ns, "ellipse");
    for (const [k, v] of Object.entries(p.owned
      ? { cx: p.x, cy: p.y + 1, rx: width * 0.46, ry: p.h * 0.032, fill: "url(#home-prop-shadow)" }
      : { cx: p.x, cy: p.y - 2, rx: width * 0.29, ry: p.h * 0.012, fill: "rgba(0,0,0,0.24)" })) shadow.setAttribute(k, String(v));
    svg.append(shadow);
    let node;
    if (p.crop) {
      node = document.createElementNS(ns, "svg");
      for (const [k, v] of Object.entries({ x: p.x - width / 2, y: p.y - p.h, width, height: p.h, viewBox: p.crop.join(" ") })) node.setAttribute(k, String(v));
      const art = picture(img(`ui/scene_props/${p.file}`), 0, 0, ...p.size);
      node.append(art);
      node.dataset.homeRig = p.owned;
      svg.append(node);
    } else node = picture(img(`ui/scene_props/${p.file}`), p.x - width / 2, p.y - p.h, width, p.h);
    node.classList.add("scene-prop");
    if (/_night\.png$/.test(file)) node.style.filter = "brightness(0.74)";
    // 自室の所持品は、部屋の暖かい光に合わせて色を寄せる（無補正だと合成感が強い・#3418）
    if (p.owned && /^bg_home/.test(file)) {
      node.style.filter = /_night\.png$/.test(file) ? "brightness(0.74) sepia(0.18)" : "sepia(0.25) saturate(0.95) brightness(1.02)";
    }
  }
  host.prepend(svg);
}

// LOAD/NEW GAMEはhud、卓上台の受取はnotice、くじは支払いのhudを発行する。
// 同期処理中の所持品更新が終わってから、接続中の家背景だけを再評価する。
// stateや所持品のスナップショットを保持せず、別セーブへ表示を持ち越さない。
let refreshQueued = false;
function refreshHomeArt() {
  if (!globalThis.document?.querySelectorAll) return;
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    document.querySelectorAll("[data-home-scene]").forEach((host) => {
      const url = host.dataset.homeScene;
      const rigs = propsFor(url).map((p) => p.owned).join(",");
      if (rigs !== host.dataset.homeRigs) renderSceneArt(host, url);
    });
  });
}
on("hud", refreshHomeArt);
on("notice", refreshHomeArt);

