// 撮影時とギャラリーで同じ、受取済みプリクラの見た目を使う。
import { cgUrl, portraitInfo } from "./data.js";
import { el } from "./util.js";
import { purikuraKey } from "./purikura-data.js";
import { backdropSvg, doodleSvg, normalizeDoodle } from "./purikura-doodle.js";

/**
 * 選定した写真（core/purikura-data.js）のある撮影は、その絵を出す（PFC18）。
 * doodle: 「自分でらくがき」の落書き（VPO22）。落書き無しの写真の上に、保存した文字・スタンプ・ペンを重ねて描き直す
 */
export function purikuraPhoto(cg, people, mode, nameFor, { doodle = null } = {}) {
  const label = people.map(nameFor).join("と") + "のプリクラ";
  const own = doodledPhoto(cg, doodle, label + "（自分でらくがき）");
  if (own) { own.dataset.mode = mode; return own; }
  if (!cg) return stickerPhoto(people, mode, nameFor);
  return el("div.purikura-photo.purikura-photo-real", { dataset: { test: "purikura-photo", mode, cg }, "aria-label": label }, [
    el("img", { src: cgUrl(cg), alt: label }),
  ]);
}

/**
 * 自分でらくがきした1枚（撮影の受け取り・ギャラリー）。選んだコマの背景 → グリーンバックで抜いた写真（枠つき）→ 落書き の順に重ねる（VPO24）。
 * 抜いた写真か落書きが無ければ null
 */
export function doodledPhoto(cg, doodle, label) {
  const drawn = doodle && normalizeDoodle(doodle), key = drawn && purikuraKey(cg);
  if (!key) return null;
  return el("div.purikura-photo.purikura-photo-real.purikura-photo-doodle", { dataset: { test: "purikura-photo", cg, doodle: "own" }, "aria-label": label }, [
    backdropSvg(drawn.bg, key.panels),
    el("img.pkd-photo", { src: key.url, alt: label }),
    doodleSvg(drawn),
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
