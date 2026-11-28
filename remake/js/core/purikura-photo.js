// 撮影時とギャラリーで同じ、受取済みプリクラの見た目を使う。
import { homeRigFile } from "./scene-art.js";
import { DB, cgUrl, img, portraitInfo } from "./data.js";
import { el } from "./util.js";

/** 選定した写真（core/purikura-data.js）のある撮影は、その絵を出す（PFC18）。 */
export function purikuraPhoto(cg, people, mode, nameFor) {
  const url = cg ? cgUrl(cg) : null;
  if (!url) return stickerPhoto(people, mode, nameFor);
  return el("div.purikura-photo.purikura-photo-real", { dataset: { test: "purikura-photo", mode, cg }, "aria-label": people.map(nameFor).join("と") + "のプリクラ" }, [
    el("img", { src: url, alt: people.map(nameFor).join("と") + "のプリクラ" }),
  ]);
}

/** 写真の絵が無い相手（審査員など）と、絵を記録する前に撮った写真の、立ち絵の顔を並べた写真。 */
export function stickerPhoto(people, mode, nameFor) {
  return el("div.purikura-photo", { dataset: { test: "purikura-photo", mode }, "aria-label": people.map(nameFor).join("と") + "のプリクラ" }, [
    el("div.purikura-people", people.map(id => {
      const face = portraitInfo(id, "smile");
      return el("div.purikura-person", [face ? el("img", { src: face.src, alt: nameFor(id) }) : null]);
    })),
    el("span.purikura-sparkles", { "aria-hidden": "true", text: "✦ ♡ ✧ ♡ ✦" }),
    el("strong.purikura-doodle", { text: mode === "solo" ? "ソロぷり盛れすぎ♡" : "うちら優勝☆" }),
    el("span.purikura-caption", { text: people.map(nameFor).join(" ＆ ") }),
  ]);
}

const themes = {
  original: "おまかせ",
  "flavor-double-apple": "ダブルアップルランド",
  "flavor-mint-glacier": "ミント氷河鉄道",
  "flavor-grape-aquarium": "巨峰クラゲ水族館",
  "flavor-chai-desert": "チャイの砂時計砂漠",
  "flavor-lemon-launch": "レモンソーダ発射場",
  "flavor-peach-onsen": "桃のお月見温泉",
  petal: "桜ミルク", pakki: "パッキーランド", mint: "ミントラウンジ", orbit: "宇宙たこ焼き",
};
const stamps = {
  heart: ["ハート", "💗"], star: ["きらきら", "✨"], apple: ["ダブルアップル", "🍎🍏"],
  mint: ["ミント", "🌿"], coal: ["キューブ炭", "cube_charcoal"], bowl: ["ハガル", "lotos_hagal"],
  hms: ["HMS", "amaburst_hms"], rings: ["煙の輪", "◎"],
};
const colors = { pink: "#e74085", blue: "#3175d4", gold: "#f1a526", white: "#ffffff", ink: "#393046" };
const fonts = { round: "sans-serif", book: "serif", mono: "monospace" };
const LIMIT = 32;
const svg = (tag, attrs) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
  return node;
};
const pointValid = p => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger)
  && p[0] >= 0 && p[0] <= 320 && p[1] >= 0 && p[1] <= 440;

function paint(mark) {
  const color = Object.hasOwn(colors, mark?.color) ? colors[mark.color] : colors.pink;
  if (mark?.kind === "pen" && Array.isArray(mark.points)) {
    const points = mark.points.slice(0, 96).filter(pointValid);
    if (!points.length) return null;
    if (points.length === 1) return svg("circle", { cx: points[0][0], cy: points[0][1], r: 2, fill: color });
    return svg("polyline", { points: points.join(" "), fill: "none", stroke: color, "stroke-width": 4, "stroke-linejoin": "round", "stroke-linecap": "round" });
  }
  if (!pointValid(mark?.at)) return null;
  const [x,y] = mark.at;
  let text, font = fonts.round;
  if (mark.kind === "stamp" && Object.hasOwn(stamps, mark.stamp)) {
    text = stamps[mark.stamp][1];
    if (/^[a-z_]+$/.test(text)) return svg("image", { x: x-27, y: y-27, width: 54, height: 54, href: "img/shop/equipment-v2/"+text+".webp" });
  } else if (mark.kind === "text" && typeof mark.text === "string") {
    text = mark.text.slice(0, 24);
    if (Object.hasOwn(fonts, mark.font)) font = fonts[mark.font];
  } else return null;
  const node = svg("text", { x, y, fill: color, stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "text-anchor": "middle", "dominant-baseline": "central", "font-family": font, "font-size": mark.kind === "text" ? 21 : 30, "font-weight": 800 });
  node.textContent = text;
  return node;
}

function sheet(photo, design, nameFor) {
  const theme = Object.hasOwn(themes, design.theme) ? design.theme : "original";
  const root = el("div.pb-sheet", { dataset: { theme }, "aria-label": photo.people.map(nameFor).join("と")+"のプリクラ" });
  if (theme === "original") root.append(purikuraPhoto(photo.cg, photo.people, photo.mode, nameFor));
  else {
    const people = photo.cg === "cg_purikura_kumicho_trio" ? [...photo.people, "ageha"] : photo.people;
    const cast = people.map(id => {
      const face = portraitInfo(id === "minto" ? "oneesan" : id, "smile", design.style === "classic" ? "classic" : "new");
      return face && el("img", { src: face.src, alt: nameFor(id) });
    });
    root.append(el("div.pb-cast", { dataset: { count: people.length } }, cast));
    const strip = photo.cg && cgUrl(photo.cg);
    if (strip) root.append(el("img.pb-strip", { src: strip, alt: "撮ったシール" }));
  }
  const file = homeRigFile(design.rig);
  if (file) {
    root.append(el("img.pb-rig", { alt: DB.equipById[design.rig]?.name || "シーシャ台", src: img("ui/scene_props/"+file) }));
  }
  const layer = svg("svg", { viewBox: "0 0 320 440", class: "pb-ink", "aria-label": "落書き" });
  for (const mark of design.marks.slice(0, LIMIT)) { const n = paint(mark); if (n) layer.append(n); }
  root.append(layer);
  return root;
}

export function printedPurikura(photo, nameFor) {
  if (photo.design) {
    try {
      const design = JSON.parse(photo.design);
      if (design?.v === 1 && Array.isArray(design.marks)) return sheet(photo, design, nameFor);
    } catch { /* 古い記録・読めない落書きは元の写真で表示。 */ }
  }
  return purikuraPhoto(photo.cg, photo.people, photo.mode, nameFor);
}


export { themes, stamps, colors, LIMIT, paint, sheet };
