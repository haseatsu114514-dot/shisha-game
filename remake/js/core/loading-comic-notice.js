import { el } from "./util.js";
import { state } from "./state.js";
import { hasMetCharacter } from "./title-art-unlock.js";
import { LOADING_COMICS } from "./loading-comics.js";
import { selectLoadingComic } from "./loading.js";
import { prepareImage } from "./loading-prefetch.js";
import { hasReadLoadingComic } from "./loading-comic-log.js";

// The notice already waits 500 ms before appearing. Decode both panels before adding
// them so a short wait or a slow image cannot leave a half-painted comic on screen.
// A notice closes the moment its wait ends, so a comic added to a wait that is about to end would only
// flash. The comic therefore joins the notice no sooner than this long after the notice appeared
// (a wait of about 1.2 s in total); shorter waits keep the plain notice and nothing is ever delayed.
export const NOTICE_COMIC_MIN_MS = 700;
// A scene wait offers the comics registered for scene waits and the bench comics alike, so a newly
// registered comic needs no extra entry to appear here.
export const NOTICE_COMIC_CONTEXTS = ["scene", "craft"];
export function attachLoadingComic(notice, { comics = LOADING_COMICS, context = NOTICE_COMIC_CONTEXTS,
  chapter = state?.chapter || 1, isMet = id => hasMetCharacter(state, id), isRead = hasReadLoadingComic } = {}) {
  const controller = new AbortController();
  // Unread comics come first here too. A notice closes with the wait, so showing one here never marks it
  // as read: the reading record is only written by the bench loading screen (craft/loading.js).
  const comic = selectLoadingComic(comics, { context, chapter, isMet, isRead });
  if (comic) {
    const settled = new Promise(resolve => {
      const timer = setTimeout(resolve, NOTICE_COMIC_MIN_MS);
      controller.signal.addEventListener("abort", () => clearTimeout(timer), { once: true });
    });
    void Promise.all([...comic.panels.map(panel => prepareImage(panel.src, {
      timeoutMs: 4000, signal: controller.signal,
    })), settled]).then(([...images]) => {
      images.pop();
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
