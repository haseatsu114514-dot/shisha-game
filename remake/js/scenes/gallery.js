// ギャラリー（見たCGを見返す）。記録はセーブとは別に端末単位で持つ＝はじめからやり直しても消えない。
import { el } from "../core/util.js";
import { DB, cgUrl } from "../core/data.js";
import { layers } from "../core/ui.js";
import { SE } from "../core/audio.js";

const KEY = "suien_remake_gallery";

function seen() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { return new Set(); }
}

/** CG を見た（engine の hooks.onCg から呼ばれる） */
export function recordCg(id) {
  const s = seen();
  if (s.has(id)) return;
  s.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* 記録できなくても遊べる */ }
}

export function openGallery() {
  return new Promise((resolve) => {
    const ids = (DB.manifest.cgs || []).map((f) => f.replace(/\.png$/, "")).sort();
    const got = seen();
    const viewer = el("div.gal-viewer", { onclick: () => { viewer.classList.remove("show"); SE.cancel(); } });
    const grid = el("div.gal-grid", ids.map((id) => got.has(id)
      ? el("button.gal-cell", { dataset: { test: `gal-${id}` }, onclick: () => { viewer.style.backgroundImage = `url("${cgUrl(id)}")`; viewer.classList.add("show"); SE.select(); } }, [
        el("img", { src: cgUrl(id), alt: "", loading: "lazy" }),
      ])
      : el("div.gal-cell.locked", [el("span", { text: "？？？" })])));
    const close = () => { SE.cancel(); layers.modal.classList.remove("show"); layers.modal.replaceChildren(); resolve(); };
    const box = el("div.gal", [
      el("div.gal-head", [
        el("h2", { text: "GALLERY" }),
        el("span.gal-count", { text: `${ids.filter((id) => got.has(id)).length} / ${ids.length}` }),
        el("button.gal-close", { text: "閉じる", dataset: { test: "gallery-close" }, onclick: close }),
      ]),
      ids.length ? grid : el("p.gal-empty", { text: "CGはまだ準備中……物語の更新をお楽しみに。" }),
      el("p.gal-note", { text: "物語の中で見た一枚が、ここに残ります。" }),
    ]);
    layers.modal.replaceChildren(el("div.gal-overlay", [box, viewer]));
    layers.modal.classList.add("show");
    SE.phone();
  });
}
