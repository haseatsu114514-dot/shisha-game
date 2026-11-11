// ゲームオーバー画面の見た目の案（#2524・2026-11-11 オーナー「いくつかの案を出して見た目を考えて」）。
// 見比べ専用。本編は読まない（continue-concepts-demo.html だけが読む）。
// 本物の CONTINUE（buildGameOver の neon 配置）を作ってから、見た目だけを着せ替える。
// 台詞・20秒の時計・2択・反応・遷移は本編の処理がそのまま動く。採用が決まった案は continue-view.js の配置として作り直す。
import { el } from "../core/util.js";

export const CONTINUE_CONCEPTS = [
  { id: "current", name: "現行", note: "筆文字・円形HUD（いまの本編）" },
  { id: "ember", name: "A 熾火", note: "いまの構図のまま、炭火の色と火の粉。時計は燃え尽きていく炭の輪" },
  { id: "versus", name: "B 斜め割り", note: "人物を左、巨大な数字を右。台詞は名札つきの帯" },
  { id: "manga", name: "C 漫画の大ゴマ", note: "紙の白と黒。人物は大ゴマ、台詞は吹き出し、2択はコマ" },
  { id: "sign", name: "D 閉店前のネオン", note: "店のネオン看板。時間が減ると瞬き、時間切れで消灯" },
];

// 画面写真が毎回同じになるように、火の粉の位置は決まった数列から作る。
function sequence(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const svg = (name, attrs = {}, children = []) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
};

// 人物の上だけに色の光を重ねる（絵そのものは変えない）。立ち絵の表情差し替え・位置合わせ・弾みに追従する。
function portraitLight(root) {
  const image = root.querySelector(".go-sumi-img");
  if (!image) return;
  const light = el("i.gc-light");
  const sync = () => {
    light.style.cssText = image.style.cssText;
    const url = `url("${image.src}")`;
    light.style.setProperty("-webkit-mask-image", url);
    light.style.setProperty("mask-image", url);
    if (image.classList.contains("go-beat") !== light.classList.contains("go-beat") || image.classList.contains("go-beat")) {
      light.classList.remove("go-beat");
      if (image.classList.contains("go-beat")) { void light.offsetWidth; light.classList.add("go-beat"); }
    }
  };
  sync();
  new MutationObserver(sync).observe(image, { attributes: true, attributeFilter: ["src", "style", "class"] });
  image.after(light);
}

const BUILD = {
  ember({ root, back, fore }) {
    const next = sequence(20261111);
    const embers = el("div.gc-embers", Array.from({ length: 30 }, () => el("i", { style: {
      "--x": `${(next() * 100).toFixed(1)}%`, "--s": `${(3 + next() * 5).toFixed(1)}px`,
      "--d": `${(4.5 + next() * 5).toFixed(2)}s`, "--delay": `${(-next() * 9).toFixed(2)}s`,
      "--dx": `${(-70 + next() * 140).toFixed(0)}px`, "--h": `${(360 + next() * 330).toFixed(0)}px` } })));
    back.append(el("i.gc-tint"), el("i.gc-coal"), embers);
    root.querySelector(".go-clock").prepend(el("i.gc-ring", [el("i")]), el("i.gc-spark"));
    fore.append(el("i.gc-flare"));
    portraitLight(root);
  },
  versus({ root, back, fore }) {
    back.append(el("i.gc-stripes"), el("i.gc-slab"), el("i.gc-halftone"));
    fore.append(svg("svg", { class: "gc-edge", viewBox: "0 0 1280 720", preserveAspectRatio: "none" }, [
      svg("path", { class: "gc-edge-main", d: "M 742 -4 L 558 724" }),
      svg("path", { class: "gc-edge-thin", d: "M 770 -4 L 586 724" }),
    ]), el("i.gc-band"));
    root.querySelector(".go-clock").append(el("i.gc-gauge", [el("i")]));
  },
  manga({ root, back, fore }) {
    // 筆文字の絵（白い芯＋色の光）から芯だけを墨の黒で取り出す。光のにじみは落とす。
    const ink = svg("svg", { class: "gc-defs", width: "0", height: "0" }, [
      svg("filter", { id: "gc-ink", "color-interpolation-filters": "sRGB" }, [
        svg("feColorMatrix", { in: "SourceGraphic", type: "matrix", result: "core",
          values: "0 0 0 0 0.07  0 0 0 0 0.07  0 0 0 0 0.07  1.3 4.3 0.4 0 -4.2" }),
        svg("feComposite", { in: "core", in2: "SourceAlpha", operator: "in" }),
      ]),
    ]);
    back.append(ink, el("i.gc-paper"), el("i.gc-panel-tone"), el("i.gc-lines"), el("i.gc-panel-two"));
    fore.append(svg("svg", { class: "gc-frames", viewBox: "0 0 1280 720", preserveAspectRatio: "none" }, [
      svg("polygon", { points: "24,24 806,24 748,696 24,696" }),
      svg("polygon", { points: "828,24 1256,24 1256,318 803,318" }),
      svg("polygon", { class: "gc-frame-fill", points: "801,334 1256,334 1256,508 786,508" }),
      svg("polygon", { class: "gc-frame-fill", points: "785,524 1256,524 1256,696 770,696" }),
    ]));
    root.querySelector(".go-clock").prepend(el("i.gc-burst"));
  },
  sign({ root, back }) {
    portraitLight(root);
    const letters = text => Array.from(text, (char, index) => el("b", { text: char, style: { "--i": String(index) } }));
    back.append(el("i.gc-wall"), el("i.gc-wash"),
      el("div.gc-sign", [
        el("i.gc-wire.gc-wire-left"), el("i.gc-wire.gc-wire-right"),
        el("span.gc-sign-en", letters("CONTINUE?")),
        el("span.gc-sign-ja", letters("コンティニューする？")),
        el("i.gc-tube", [el("i")]),
      ]));
  },
};

/** buildGameOver が返した root を、指定した案の見た目へ着せ替える。"current" は何もしない。 */
export function applyContinueConcept(root, id) {
  if (id === "current" || !BUILD[id]) return root;
  const name = root.querySelector(".go-sumi-img")?.getAttribute("alt") || "";
  root.dataset.layout = "concept";
  root.dataset.concept = id;
  const back = el("div.gc-back", { "aria-hidden": "true" });
  const fore = el("div.gc-fore", { "aria-hidden": "true" });
  root.insertBefore(back, root.querySelector(".go-count-back") || root.querySelector(".go-heading"));
  root.insertBefore(fore, root.querySelector(".go-right"));
  root.querySelector(".go-right").prepend(el("span.gc-name", { text: name, "aria-hidden": "true" }));
  BUILD[id]({ root, back, fore, name });
  return root;
}
