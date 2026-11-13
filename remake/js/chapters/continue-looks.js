// CONTINUE の見た目の候補「A 熾火（ember）」「C 漫画の大ゴマ（manga）」（#2524・CV58）。
// 2026-11-12 オーナー「AとCを両方作りたい　実際のできを見て決める」。本編の既定は neon のまま。
// どちらも neon と同じ部品（筆文字・時計・2択・台詞・反応）を使い、飾りの部品を足して見た目だけを替える。
// 台詞・20秒の時計・2択・遷移・保存には触れない。見た目は css/continue-looks.css・continue-ember.css・continue-manga.css。
// 本編で比べるときは URL に ?continueLook=ember / ?continueLook=manga（端末に覚える）、?continueLook=neon で戻す。
import { el } from "../core/util.js";

export const CONTINUE_LOOKS = ["ember", "manga"];
const KEY = "suien_continue_look";

/** 本編で使う配置。URL の continueLook を端末に覚え、覚えた候補を返す（既定・不明・保存できない端末は neon）。 */
export function continueLayoutSetting() {
  try {
    const q = new URLSearchParams(location.search).get("continueLook");
    if (q === "neon" || CONTINUE_LOOKS.includes(q)) localStorage.setItem(KEY, q);
    const saved = localStorage.getItem(KEY);
    return CONTINUE_LOOKS.includes(saved) ? saved : "neon";
  } catch { return "neon"; }
}

// 火の粉の位置は決まった数列から作る（毎回同じ見え方にする）。
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

// 人物の形にだけ色の光を重ねる（絵そのものは加工しない）。表情の差し替え・位置合わせ・弾みに追従する。
function portraitLight(root) {
  const image = root.querySelector(".go-sumi-img");
  if (!image) return;
  const light = el("i.go-look-light", { "aria-hidden": "true" });
  const sync = (records = []) => {
    light.style.cssText = image.style.cssText;
    const url = `url("${image.src}")`;
    light.style.setProperty("-webkit-mask-image", url);
    light.style.setProperty("mask-image", url);
    if (records.some(record => record.attributeName === "class")) {
      light.classList.remove("go-beat");
      if (image.classList.contains("go-beat")) { void light.offsetWidth; light.classList.add("go-beat"); }
    }
  };
  sync();
  new MutationObserver(sync).observe(image, { attributes: true, attributeFilter: ["src", "style", "class"] });
  image.after(light);
}

const BUILD = {
  // A 熾火: 炭火の色・足元の火・上がる火の粉・燃え尽きていく炭の輪。
  ember({ root, back, fore }) {
    const next = sequence(20261111);
    const sparks = el("div.go-ember-sparks", Array.from({ length: 30 }, () => el("i", { style: {
      "--x": `${(next() * 100).toFixed(1)}%`, "--s": `${(3 + next() * 5).toFixed(1)}px`,
      "--d": `${(4.5 + next() * 5).toFixed(2)}s`, "--delay": `${(-next() * 9).toFixed(2)}s`,
      "--dx": `${(-70 + next() * 140).toFixed(0)}px`, "--h": `${(360 + next() * 330).toFixed(0)}px` } })));
    back.append(el("i.go-ember-tint"), el("i.go-ember-coal"), sparks);
    root.querySelector(".go-clock").prepend(el("i.go-ember-ring", [el("i")]), el("i.go-ember-spark"));
    fore.append(el("i.go-ember-flare"));
    portraitLight(root);
  },
  // C 漫画の大ゴマ: 紙・集中線の大ゴマ・コマ枠・ギザギザの残り秒数・吹き出しと名札。
  manga({ root, back, fore, character }) {
    // 筆文字の絵（白い芯＋色の光）から芯だけを墨の黒で取り出す。光のにじみは落とす。
    const ink = svg("svg", { class: "go-manga-defs", width: "0", height: "0", "aria-hidden": "true" }, [
      svg("filter", { id: "go-manga-ink", "color-interpolation-filters": "sRGB" }, [
        svg("feColorMatrix", { in: "SourceGraphic", type: "matrix", result: "core",
          values: "0 0 0 0 0.07  0 0 0 0 0.07  0 0 0 0 0.07  1.3 4.3 0.4 0 -4.2" }),
        svg("feComposite", { in: "core", in2: "SourceAlpha", operator: "in" }),
      ]),
    ]);
    back.append(ink, el("i.go-manga-paper"), el("i.go-manga-tone"), el("i.go-manga-lines"), el("i.go-manga-panel"));
    fore.append(svg("svg", { class: "go-manga-frames", viewBox: "0 0 1280 720", preserveAspectRatio: "none" }, [
      svg("polygon", { points: "24,24 806,24 748,696 24,696" }),
      svg("polygon", { points: "828,24 1256,24 1256,318 803,318" }),
      svg("polygon", { class: "go-manga-fill", points: "801,334 1256,334 1256,508 786,508" }),
      svg("polygon", { class: "go-manga-fill", points: "785,524 1256,524 1256,696 770,696" }),
    ]));
    root.querySelector(".go-clock").prepend(el("i.go-manga-burst"));
    root.querySelector(".go-right").prepend(el("span.go-look-name", { text: character, "aria-hidden": "true" }));
  },
};

/** createContinueView が作った neon 系の root に、候補の飾りを足す。 */
export function decorateContinueLook(root, look, { character = "" } = {}) {
  if (!BUILD[look]) return root;
  const back = el("div.go-look-back", { "aria-hidden": "true" });
  const fore = el("div.go-look-fore", { "aria-hidden": "true" });
  root.insertBefore(back, root.querySelector(".go-count-back") || root.querySelector(".go-heading"));
  root.insertBefore(fore, root.querySelector(".go-right"));
  BUILD[look]({ root, back, fore, character });
  return root;
}
