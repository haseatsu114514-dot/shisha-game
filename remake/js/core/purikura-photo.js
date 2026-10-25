// 撮影時とギャラリーで同じ、受取済みプリクラの見た目を使う。
import { portraitInfo } from "./data.js";
import { el } from "./util.js";

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
