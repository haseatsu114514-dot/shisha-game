// タイトルの一枚絵。次の画像が読めてから重ね、画面を離れたら待機処理を片付ける。
import { el, shuffle } from "../core/util.js";
import { DB, assetUrl } from "../core/data.js";

const FALLBACK = "title_art_keyvisual_01.png";
const FIRST = "title_art_mashiro_heavy_smoke.png";
const HOLD_MS = 12000;
const FADE_MS = 1800;

function files() {
  const listed = [...new Set(DB.manifest.titleArts || [])];
  const daily = listed.filter((name) => name !== FALLBACK);
  return daily.length ? daily : [FALLBACK];
}

const url = (name) => assetUrl(`assets/ui/title_arts/${name}`);
const firstFile = () => files().includes(FIRST) ? FIRST : files()[0];
export const initialTitleArtUrl = () => url(firstFile());

export function createTitleArt() {
  let current = firstFile();
  const frame = el("div.title-art", { "aria-hidden": "true", dataset: { art: current } });
  const picture = (name) => el("img.title-art-image", { src: url(name), alt: "", draggable: "false" });
  let visible = picture(current);
  visible.classList.add("visible");
  frame.append(visible);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const failed = new Set();
  let deck = [];
  let timer, fadeTimer, loadTimer;
  let attached = false, disposed = false;

  function stop() {
    disposed = true;
    clearTimeout(timer);
    clearTimeout(fadeTimer);
    clearTimeout(loadTimer);
    observer.disconnect();
  }

  function schedule(ms = HOLD_MS) {
    if (!disposed && !reduced.matches && files().filter((name) => !failed.has(name)).length > 1)
      timer = setTimeout(rotate, ms);
  }

  async function rotate() {
    if (!frame.isConnected) { stop(); return; }
    if (document.hidden || document.querySelector("#modal.show") || reduced.matches) {
      schedule(); return;
    }
    if (!deck.length) deck = shuffle(files().filter((name) => name !== current && !failed.has(name)));
    const next = deck.pop();
    if (!next) return;
    const image = picture(next);
    const ready = await Promise.race([
      image.decode().then(() => true, () => false),
      new Promise((resolve) => { loadTimer = setTimeout(() => resolve(false), 8000); }),
    ]);
    clearTimeout(loadTimer);
    if (disposed || !frame.isConnected) return;
    if (!ready) { failed.add(next); schedule(1000); return; }
    if (document.hidden || document.querySelector("#modal.show") || reduced.matches) {
      deck.push(next); schedule(); return;
    }
    const previous = visible;
    frame.append(image);
    // 初期の opacity:0 を確定させてからクロスフェードする。
    image.getBoundingClientRect();
    image.classList.add("visible");
    previous.classList.remove("visible");
    visible = image;
    current = next;
    frame.dataset.art = current;
    fadeTimer = setTimeout(() => previous.remove(), FADE_MS);
    schedule();
  }

  // 煙ワイプによってタイトルの取り付けが遅れる場合も、実際の表示後から数える。
  const observer = new MutationObserver(() => {
    if (frame.isConnected && !attached) { attached = true; schedule(); }
    else if (!frame.isConnected && attached) stop();
  });
  observer.observe(document.getElementById("screen"), { childList: true });
  return frame;
}
