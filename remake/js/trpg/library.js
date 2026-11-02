import { el } from "../core/util.js";
import { displayName, portraitUrl, portraitTop, sceneArt } from "./presentation.js";

export function mountTrpgLibrary(host, { scenarios, characters, manifest, audio, onChoose, onClose = null, closeLabel = "閉じる" }) {
  const root = el("section.trpg-root.trpg-library", { tabindex: "-1", dataset: { phase: "library", many: String(scenarios.length > 2) } });
  let disposed = false;
  const sound = el("button.trpg-button.small", { type: "button", dataset: { test: "trpg-audio" },
    onclick: async () => { sound.disabled = true; await audio.setEnabled(!audio.enabled); if (!disposed) syncSound(); } });
  function syncSound() { sound.textContent = audio.enabled ? "音 ON" : "音 OFF"; sound.setAttribute("aria-pressed", String(audio.enabled)); sound.disabled = !audio.available; }
  syncSound();
  root.append(el("header.trpg-library-header", [
    el("div", [el("span.trpg-kicker", { text: "水煙前線 -EN:CODE- / TABLETOP COLLECTION" }),
      el("h1", { text: "ひと息、物語の中へ。" })]),
    el("div.trpg-library-meta", [el("span", { text: String(scenarios.length).padStart(2, "0") + " STORIES" }), sound,
      ...(onClose ? [el("button.trpg-button.small", { type: "button", text: closeLabel,
        dataset: { test: "trpg-collection-close" }, onclick: () => { if (!disposed) onClose(); } })] : [])]),
  ]), el("p.trpg-library-intro", { text: "いつもの仲間と、小さな卓を囲む。今夜は、どの物語にする？" }));
  const books = el("div.trpg-library-books");
  for (const s of scenarios) {
    const p = s.presentation, gm = s.cast.find(c => c.part === "GM");
    const cast = el("div.trpg-library-cast", s.cast.map(c => el("div", [
      el("span.trpg-library-face", { style: { "--person-color": c.color } },
        el("img", { src: portraitUrl(manifest, c.id), alt: "", style: { top: portraitTop(manifest, c.id, 140, 7),
          transform: "translateX(-" + (manifest.portraits[c.id].ax * 100) + "%)" } })),
      el("span", { text: displayName(characters, c.id) }),
    ])));
    books.append(el("article.trpg-library-book", { dataset: { theme: p.theme } }, [
      el("div.trpg-library-art", [sceneArt(el, s),
        el("span.trpg-library-number", { text: p.number }), el("span.trpg-library-genre", { text: p.genre })]),
      el("div.trpg-library-copy", [
        el("div.trpg-library-byline", { text: s.collection + " / 作 · " + s.author }),
        el("h2", { text: s.title }), el("p", { text: p.tagline }),
        el("div.trpg-library-details", [el("span", { text: s.duration }), el("span", { text: "4つの結末" }),
          el("span", { text: "GM " + displayName(characters, gm.id) })]),
        cast,
        el("button.trpg-button.primary", { type: "button", dataset: { test: "trpg-select-" + s.id },
          onclick: () => { if (!disposed) { audio.play("open"); onChoose(s.id); } },
        }, [el("span", { text: "この物語を開く" }), el("span", { text: "→", "aria-hidden": "true" })]),
      ]),
    ]));
  }
  root.append(books, el("footer.trpg-library-footer", [
    el("span", { text: "作中の作者が書いた短編を、キャラたちがGMとプレイヤーとして遊びます。" }),
    el("span", { text: "クリック / タップ · 会話は Enter / Space" }),
  ]));
  host.replaceChildren(root); root.focus({ preventScroll: true });
  audio.setTheme("harbor");
  return { destroy() { disposed = true; root.remove(); }, snapshot: () => ({ phase: "library" }) };
}
