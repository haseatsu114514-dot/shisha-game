import { el } from "../core/util.js";
import { displayName, portraitUrl, portraitAx, portraitTop, sceneArt } from "./presentation.js";
import { shelfHelpButton } from "./shelf-help.js";

// 操作と遊び方は画面に常に出さず、右上の「？」で読む（#2719・ミニゲーム共通のUI方針）。
const LIBRARY_HELP = [
  ["物語を選ぶ", "作中の作者が書いた短編を、キャラたちがGMとプレイヤーとして遊びます。本を選んで「この物語を開く」。"],
  ["操作", "クリック・タップで選びます。会話は Enter／Space でも進みます。"],
  ["卓の中", "卓を囲んでいる間は、右上の「？」でいつでも遊び方を確認できます。"],
];

// 文字にしなくてよい所は記号に（#2862・スマホ表示の見直し）。読み上げは隠し文字で補う。
const ICON_PATHS = {
  clock: ["M8 1.9a6.1 6.1 0 1 0 0 12.2A6.1 6.1 0 1 0 8 1.9Z", "M8 4.6V8l2.4 1.6"],
  endings: ["M5 2.5v11", "M5 7.5c0-2.6 6-2.2 6-5", "M5 9.5c0 2.6 6 2.2 6 4.5"],
  soundOn: ["M2.5 6h2.4L8.5 3v10L4.9 10H2.5Z", "M10.8 5.7a3.3 3.3 0 0 1 0 4.6", "M12.7 3.9a5.9 5.9 0 0 1 0 8.2"],
  soundOff: ["M2.5 6h2.4L8.5 3v10L4.9 10H2.5Z", "M11 6l4 4", "M15 6l-4 4"],
};
function icon(name) {
  const NS = "http://www.w3.org/2000/svg", node = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ class: "trpg-icon", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" })) node.setAttribute(k, v);
  for (const d of ICON_PATHS[name]) { const path = document.createElementNS(NS, "path"); path.setAttribute("d", d); node.append(path); }
  return node;
}

export function mountTrpgLibrary(host, { scenarios, characters, manifest, audio, onChoose, onClose = null, closeLabel = "閉じる" }) {
  const root = el("section.trpg-root.trpg-library", { tabindex: "-1", dataset: { phase: "library", many: String(scenarios.length > 2) } });
  let disposed = false;
  const sound = el("button.trpg-button.small.trpg-icon-button", { type: "button", dataset: { test: "trpg-audio" },
    onclick: async () => { sound.disabled = true; await audio.setEnabled(!audio.enabled); if (!disposed) syncSound(); } });
  function syncSound() {
    const label = audio.enabled ? "音 ON" : "音 OFF";
    sound.replaceChildren(icon(audio.enabled ? "soundOn" : "soundOff"), el("span.sr-only", { text: label }));
    sound.title = label; sound.setAttribute("aria-pressed", String(audio.enabled)); sound.disabled = !audio.available;
  }
  syncSound();
  root.append(el("header.trpg-library-header", [
    el("div", [el("span.trpg-kicker", { text: "水煙前線 -EN:CODE- / TABLETOP COLLECTION" }),
      el("h1", { text: "ひと息、物語の中へ。" })]),
    el("div.trpg-library-meta", [el("span", { text: String(scenarios.length).padStart(2, "0") + " STORIES" }), sound,
      shelfHelpButton(() => root, { title: "この本棚の遊び方", sections: LIBRARY_HELP, test: "trpg-library-help" }),
      ...(onClose ? [el("button.trpg-button.small", { type: "button", text: closeLabel,
        dataset: { test: "trpg-collection-close" }, onclick: () => { if (!disposed) onClose(); } })] : [])]),
  ]), el("p.trpg-library-intro", { text: "いつもの仲間と、小さな卓を囲む。今夜は、どの物語にする？" }));
  const books = el("div.trpg-library-books");
  for (const s of scenarios) {
    const p = s.presentation, gm = s.cast.find(c => c.part === "GM");
    const cast = el("div.trpg-library-cast", s.cast.map(c => el("div", [
      el("span.trpg-library-face", { style: { "--person-color": c.color } },
        el("img", { src: portraitUrl(manifest, c.id), alt: "", style: { top: portraitTop(manifest, c.id, 140, 7),
          transform: "translateX(-" + (portraitAx(manifest, c.id) * 100) + "%)" } })),
      el("span", { text: displayName(characters, c.id) }),
    ])));
    books.append(el("article.trpg-library-book", { dataset: { theme: p.theme } }, [
      el("div.trpg-library-art", [sceneArt(el, s),
        el("span.trpg-library-number", { text: p.number }), el("span.trpg-library-genre", { text: p.genre })]),
      el("div.trpg-library-copy", [
        el("div.trpg-library-byline", { text: s.collection + " / 作 · " + s.author }),
        el("h2", { text: s.title }), el("p", { text: p.tagline }),
        el("div.trpg-library-details", [
          el("span.trpg-library-time", { title: s.duration }, [icon("clock"), /^約/.test(s.duration) ? el("span.sr-only", { text: "約" }) : null,
            el("span", { text: String(s.duration).replace(/^約\s*/, "") })]),
          el("span.trpg-library-endings", { title: "4つの結末" }, [icon("endings"), el("span", { text: "4" }), el("span.sr-only", { text: "つの結末" })]),
          el("span", { text: "GM " + displayName(characters, gm.id) })]),
        cast,
        el("button.trpg-button.primary", { type: "button", dataset: { test: "trpg-select-" + s.id },
          onclick: () => { if (!disposed) { audio.play("open"); onChoose(s.id); } },
        }, [el("span", { text: "この物語を開く" }), el("span", { text: "→", "aria-hidden": "true" })]),
      ]),
    ]));
  }
  root.append(books);
  host.replaceChildren(root); root.focus({ preventScroll: true });
  audio.setTheme("harbor");
  return { destroy() { disposed = true; root.remove(); }, snapshot: () => ({ phase: "library" }) };
}
