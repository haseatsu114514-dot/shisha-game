// 縦画面「煙の舞台」: タイトル。見た目は試作のタイトル（remake/previews/portrait-stage/title.mjs・VPM01）と同じ:
// 人物のキービジュアル（縦長の絵）を画面いっぱいに置き、裾を煙でぼかしてロゴを重ね、下に5行のメニュー（押すとそのまま選べる）。
// 十字キーと丸ボタンは置かない（試作の決まり VPM07。下画面の統一はあとで行う・VPN13）。
// 絵・ロゴ・メニューの中身（つづきからの章と日付・押せるか）は本編のタイトル（scenes/title.js）が出した物をそのまま読み、押したら本編へ中継する。
import { el } from "../../core/util.js";
import { textOf, cssUrl } from "./frame.js";

// キービジュアルの顔の高さ（絵の高さに対する位置。試作 title.mjs の KEY_VISUALS の写し）。縦に切り抜く時、顔が上から3割に来るよう合わせる
const FACE = {
  title_art_tsumugi_04_painting_studio: 0.27, title_art_minto_05_mint_cloud: 0.24, title_art_sumi_01_own_clay_bowl: 0.2,
  title_art_naru_01_bakery_morning: 0.17, title_art_adam_01_sunset_proclamation: 0.17, title_art_hiyori_06_riverside_hoodie: 0.19,
  title_art_samechan_04_throne_pose: 0.2, title_art_rio_04_rainy_neon_umbrella: 0.2, title_art_ageha_04_gummy_light: 0.22,
  title_art_mashiro_05_rooftop_dusk_yawn: 0.22,
};
const IMG = new URL("../../../img/", import.meta.url).href;

export function createTitleScene(frame) {
  const bg = el("img.vt-tt-bg", { alt: "", draggable: "false", src: `${IMG}backgrounds/bg_title.webp` });
  const art = el("img.vt-tt-art", { alt: "", draggable: "false" });
  const ember = el("i.vt-tt-ember", { "aria-hidden": "true" });
  const pic = el("div.vt-tt-pic", [bg, art, ember]);
  const veil = el("i.vt-tt-veil", { "aria-hidden": "true" });
  const ver = el("div.vt-tt-ver");
  const logo = el("img.vt-tt-logo", { alt: "水煙前線 -EN:CODE-", draggable: "false" });
  const brand = el("div.vt-tt-brand", [el("div.vt-tt-logo-smoke", { "aria-hidden": "true" }, [el("i"), el("i"), el("i")]), logo]);
  const items = el("nav.vt-tt-menu", { "aria-label": "メニュー", dataset: { test: "vt-title-menu" } });
  const body = el("div.vt-tt-body", [brand, items]);
  const root = el("div.vt-tt", { dataset: { test: "vt-title" } }, [pic, veil, ver, body]);
  let pick = -1, sig = "", artUrl = "";
  const liveItems = () => [...document.querySelectorAll("#screen > .title .title-menu > .title-item")];
  const usable = (node) => !!node && !node.disabled;

  function renderPick() {
    for (const node of items.children) node.setAttribute("aria-current", String(Number(node.dataset.index) === pick));
  }
  items.addEventListener("click", (event) => {
    const node = event.target.closest(".vt-tt-item");
    if (!node || node.disabled) return;
    event.stopPropagation();
    pick = Number(node.dataset.index);
    renderPick();
    node.classList.remove("is-picked"); void node.offsetWidth; node.classList.add("is-picked");
    const live = liveItems()[pick];
    if (usable(live)) live.click();
  });

  /** キービジュアルを縦に切り抜く位置: 顔が、絵の場所の上から3割あたりに来るようにする。 */
  function placeArt() {
    if (!pic.clientWidth || !art.naturalWidth) return;
    const stem = (artUrl.split("/").pop() || "").replace(/\.[a-z]+(\?.*)?$/, "");
    const face = FACE[stem];
    if (face == null) { art.style.objectPosition = "50% 30%"; return; }
    const boxH = pic.clientHeight, imgH = pic.clientWidth * art.naturalHeight / art.naturalWidth, spare = imgH - boxH;
    const y = spare <= 0 ? 0 : Math.max(0, Math.min(1, (face * imgH - boxH * 0.3) / spare));
    art.style.objectPosition = `50% ${(y * 100).toFixed(1)}%`;
  }
  art.addEventListener("load", placeArt);

  function sync() {
    const live = document.querySelector("#screen > .title");
    if (!live) return;
    const list = liveItems();
    const next = list.map((node) => `${node.dataset.test}|${node.disabled}|${node.textContent}`).join("\n");
    if (next !== sig) {
      sig = next;
      // 決定を押すだけで本編へ入れるよう、いちばん使う行を選んでおく（セーブがあれば CONTINUE）
      if (!usable(list[pick])) pick = Math.max(0, list.findIndex((node) => node.dataset.test === "title-continue" && usable(node)), 0);
      if (!usable(list[pick])) pick = Math.max(0, list.findIndex(usable));
      items.replaceChildren(...list.map((node, index) => {
        const note = textOf(node.querySelector(".ti-note"));
        return el("button.vt-tt-item", { type: "button", disabled: node.disabled, style: { "--i": String(index) },
          dataset: { index: String(index), test: `vt-${node.dataset.test}` } }, [
          el("i"), el("span.vt-tt-en", { text: textOf(node.querySelector(".ti-en")) || textOf(node) }),
          el("span.vt-tt-side", [el("span.vt-tt-ja", { text: textOf(node.querySelector(".ti-ja")) }), note ? el("span.vt-tt-note", { text: note }) : null]),
        ]);
      }));
      renderPick();
    }
    const artNode = live.querySelector(".title-art");
    const url = artNode ? cssUrl(getComputedStyle(artNode).backgroundImage) : "";
    if (url && url !== artUrl) { artUrl = url; art.src = url; }
    frame.setAmbient(url || bg.src);
    const img = live.querySelector("img.title-logo");
    const src = img && img.complete && img.naturalWidth ? img.currentSrc || img.src : "";
    if (src && logo.getAttribute("src") !== src) logo.src = src;
    logo.hidden = !src;
    ver.textContent = textOf(live.querySelector(".title-ver"));
    frame.setChips([]);
    frame.setPad({});
    frame.setHud("none");
  }

  return {
    name: "title",
    layout: "full", // 下画面（十字キーと丸ボタン）を出さない（VPM07）
    enter() {
      frame.over.append(root);
      frame.over.hidden = false;
      root.classList.remove("vt-tt-enter"); void root.offsetWidth; root.classList.add("vt-tt-enter");
      sig = "\u0000";
    },
    leave() {},
    sync,
    relayout: placeArt,
    dir(dir) {
      const list = liveItems();
      if (!list.length || (dir !== "up" && dir !== "down")) return;
      for (let i = 0; i < list.length; i++) {
        pick = (pick + (dir === "down" ? 1 : list.length - 1)) % list.length;
        if (usable(list[pick])) break;
      }
      renderPick();
    },
    a() { const live = liveItems()[pick]; if (usable(live)) live.click(); },
    chip() {},
    tap() {},
  };
}
