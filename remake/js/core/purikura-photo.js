// 撮影時とギャラリーで同じ、受取済みプリクラの見た目を使う。
import { cgUrl, portraitInfo } from "./data.js";
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
