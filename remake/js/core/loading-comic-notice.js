import { el } from "./util.js";
import { state } from "./state.js";
import { hasMetCharacter } from "./title-art-unlock.js";
import { LOADING_COMICS } from "./loading-comics.js";
import { selectLoadingComic } from "./loading.js";
import { prepareImage } from "./loading-prefetch.js";

// The notice already waits 500 ms before appearing. Decode both panels before adding
// them so a short wait or a slow image cannot leave a half-painted comic on screen.
export function attachLoadingComic(notice, { comics = LOADING_COMICS, context = "scene",
  chapter = state?.chapter || 1, isMet = id => hasMetCharacter(state, id) } = {}) {
  const controller = new AbortController();
  const comic = selectLoadingComic(comics, { context, chapter, isMet });
  if (comic) {
    void Promise.all(comic.panels.map(panel => prepareImage(panel.src, {
      timeoutMs: 4000, signal: controller.signal,
    }))).then(images => {
      if (controller.signal.aborted || !notice.isConnected) return;
      const panels = el("div.vn-loading-comic-panels", images.map((image, index) => {
        const panel = comic.panels[index];
        image.alt = panel.alt;
        const art = el("div.vn-loading-comic-art", [image]);
        if (panel.region) {
          const { x, y, width, height, sourceWidth, sourceHeight } = panel.region;
          image.style.width = `${sourceWidth / width * 100}%`;
          image.style.height = `${sourceHeight / height * 100}%`;
          image.style.maxWidth = "none";
          image.style.left = `${-x / width * 100}%`;
          image.style.top = `${-y / height * 100}%`;
          image.style.position = "absolute";
        }
        for (const bubble of panel.bubbles || []) {
          const node = el("p.vn-loading-comic-bubble", { text: bubble.text });
          node.style.left = `${bubble.x}%`;
          node.style.top = `${bubble.y}%`;
          if (bubble.width != null) node.style.width = `${bubble.width}%`;
          if (bubble.fontSize != null) node.style.fontSize = `${bubble.fontSize}cqw`;
          art.append(node);
        }
        return el("figure", [art]);
      }));
      const body = el("div.vn-loading-comic", { role: "group", "aria-label": comic.title }, [
        el("h2", { text: comic.title }), panels,
      ]);
      if (comic.caption) body.append(el("p.vn-loading-comic-caption", { text: comic.caption }));
      notice.append(body);
      notice.classList.add("has-comic");
    }).catch(() => { /* Missing art leaves the original loading notice visible. */ });
  }
  return () => { controller.abort(); notice.remove(); };
}
