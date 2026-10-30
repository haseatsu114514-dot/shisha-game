// タイトルのコレクション。見たCG・受取写真と、章クリアで開く採用済み漫画/動画。
import { el } from "../core/util.js";
import { DB, cgUrl, cgThumbUrl, realName } from "../core/data.js";
import { layers, loadingNotice } from "../core/ui.js";
import { withLoadingNotice } from "../core/module-loading.js";
import { state, SAVE_SLOTS, readSlot, config } from "../core/state.js";
import { SE, currentBgm, playBgm, stopBgm } from "../core/audio.js";
import { readGalleryProgress, recordGalleryProgress, shouldAnnounceCompletion, markCompletionAnnounced } from "../core/gallery-progress.js";
import { CHAR_LABELS, GALLERY_TABS, galleryEntries, galleryStats, galleryHint } from "../core/gallery-catalog.js";
import { stickerPhoto } from "../core/purikura-photo.js";

const KEY = "suien_remake_gallery";
const photoName = id => id === "samechan" ? "サメちゃん" : id === "minto" ? "みんと" : realName(id);
function seen() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter(id => typeof id === "string") : []);
  } catch { return new Set(); }
}
export function recordCg(id) {
  const s = seen();
  if (s.has(id)) return;
  s.add(id);
  try { localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* 記録できなくても遊べる */ }
}

export function openGallery() {
  // 旧保存もロード/上書きせず、明示的な実績だけを取り込む。
  recordGalleryProgress(state);
  SAVE_SLOTS.forEach(slot => recordGalleryProgress(readSlot(slot.key)));
  const progress = readGalleryProgress();
  const entries = galleryEntries(DB.manifest, DB.gallery, progress, seen());
  const stats = galleryStats(entries);
  const announceComplete = shouldAnnounceCompletion(stats, progress);
  if (announceComplete) markCompletionAnnounced();
  const fraction = s => `${s.unlocked} / ${s.total}（${s.rate}%）`;
  return new Promise(resolve => {
    let tab = "all", closed = false, active = null, page = 0, trigger = null;
    let video = null, movieBgm = null, observer;
    let cancelImageLoad = null;
    const galleryOwner = document.body.dataset.screen;
    const count = el("span.gal-count");
    const collection = el("div.gal-collection", [
      el("strong.gal-rate", { text: `収集率 ${stats.rate}%（${stats.unlocked}/${stats.total}）` }),
      stats.total > 0 && stats.rate === 100 ? el("span.gal-complete", { text: "★コンプリート" }) : null,
      announceComplete ? el("span.gal-complete-notice", { text: "収集率100%を達成しました" }) : null,
      el("small.gal-photos", { text: `プリクラ撮影記録 ${stats.purikuraPhotos}枚` }),
    ]);
    const characters = el("div.gal-characters", { "aria-label": "キャラ別収集率" },
      Object.entries(CHAR_LABELS).filter(([char]) => stats.byChar[char].total > 0).map(([char, label]) => {
        const s = stats.byChar[char];
        return el("span", { text: `${label} ${s.unlocked}/${s.total}（${s.rate}%）` });
      }));
    const recordedRoutes = Object.entries(progress.routeRecords);
    const routes = recordedRoutes.length ? el("section.gal-route-records", { "aria-label": "ルート記録" }, [
      el("h3", { text: "ルート記録" }),
      ...recordedRoutes.map(([char, record]) => el("div.gal-route-record", [
        el("strong", { text: Object.hasOwn(CHAR_LABELS, char) ? CHAR_LABELS[char] : char }),
        record.becameLover ? el("p", { text: "恋人成立" }) : null,
        record.eventsSeen.length ? el("p", { text: `閲覧した段階・派生：${record.eventsSeen.join("、")}` }) : null,
        record.trueEndAsLover ? el("p", { text: "真エンド同行" }) : null,
      ])),
    ]) : null;
    const grid = el("div.gal-grid", { id: "gallery-items", role: "tabpanel" });
    const note = el("p.gal-note", { text: "見た一枚や受け取った写真が残ります。漫画・ムービーは章クリアで解放。" });
    const tools = el("div.gal-viewer-tools");
    const content = el("div.gal-viewer-content");
    const viewer = el("div.gal-viewer", { role: "dialog", "aria-modal": "true", "aria-label": "作品の閲覧", onclick: e => {
      // ページ送りで押したボタンが置換されても、元のイベント経路を使う。
      if (!e.composedPath().includes(tools) && !e.target.closest("video, .gal-comic-scroll")) closeViewer();
    } }, [tools, content]);
    const closeButton = el("button.gal-close", { text: "閉じる", dataset: { test: "gallery-close" }, onclick: () => close() });
    const tabs = el("div.gal-tabs", { role: "tablist", "aria-label": "コレクションの種類" }, GALLERY_TABS.map(([kind, name]) =>
      el("button.gal-tab", { text: `${name} ${fraction(kind === "all" ? stats : stats.byKind[kind])}`, role: "tab", "aria-controls": "gallery-items", "aria-selected": kind === tab ? "true" : "false",
        dataset: { kind, test: "gallery-tab-" + kind }, onclick: () => { tab = kind; render(); SE.select(); } })));
    const box = el("div.gal", [
      el("div.gal-head", [el("h2", { text: "GALLERY" }), collection, count, closeButton]), tabs, characters, routes, grid, note,
    ]);
    const overlay = el("div.gal-overlay", [box, viewer]);
    const restoreMusic = () => {
      if (movieBgm && overlay.isConnected && document.body.dataset.screen === galleryOwner && !currentBgm()) playBgm(movieBgm);
      movieBgm = null;
    };
    function releaseVideo() {
      if (video) { video.pause(); video.removeAttribute("src"); video.load(); video = null; }
      restoreMusic();
    }
    function closeViewer() {
      cancelImageLoad?.();
      releaseVideo(); active = null; content.replaceChildren(); tools.replaceChildren();
      viewer.classList.remove("show");
      trigger?.focus({ preventScroll: true }); SE.cancel();
    }
    function close() {
      if (closed) return;
      cancelImageLoad?.();
      releaseVideo(); closed = true; observer?.disconnect();
      document.removeEventListener("keydown", onKey);
      if (overlay.parentNode === layers.modal) { layers.modal.classList.remove("show"); layers.modal.replaceChildren(); }
      resolve(); SE.cancel();
    }
    function onKey(e) {
      if (e.key === "Tab") {
        const root = active ? viewer : box;
        const nodes = [...root.querySelectorAll("button:not(:disabled), video[controls], [tabindex='0']")].filter(n => n.getClientRects().length);
        const first = nodes[0], last = nodes.at(-1);
        if (first && (!root.contains(document.activeElement) || e.shiftKey && document.activeElement === first || !e.shiftKey && document.activeElement === last)) {
          e.preventDefault(); (e.shiftKey ? last : first).focus();
        }
        return;
      }
      if (e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation();
      if (active) closeViewer(); else close();
    }
    function image(url, name) {
      return el("img.gal-media-image", { src: url, alt: name, onerror: e => {
        if (!e.target.isConnected || !content.contains(e.target)) return;
        e.target.hidden = true;
        content.append(el("p.gal-media-error", { text: "画像を読み込めませんでした。閉じて、もう一度開いてください。" }));
      } });
    }
    // CGの実際のimgを待つ。失敗表示はimage()の既存ハンドラに任せる。
    function trackImageLoad(img) {
      if (img.complete) return;
      const notice = loadingNotice("画像を読み込んでいます…");
      let finish;
      const task = new Promise(resolve => {
        finish = () => {
          img.removeEventListener("load", finish);
          img.removeEventListener("error", finish);
          if (cancelImageLoad === finish) cancelImageLoad = null;
          // 閉じる・差し替え時はfinallyのマイクロタスクを待たずに消す。
          notice.onHide();
          resolve();
        };
        img.addEventListener("load", finish);
        img.addEventListener("error", finish);
      });
      cancelImageLoad = finish;
      void withLoadingNotice(task, {
        onShow: () => {
          if (cancelImageLoad === finish && img.isConnected && content.contains(img)) notice.onShow();
        },
        onHide: notice.onHide,
      });
    }
    function show(entry, button) {
      if (!entry.unlocked || closed) return;
      releaseVideo(); active = entry; page = 0; trigger = button;
      viewer.classList.add("show"); drawViewer(); SE.select();
    }
    function drawViewer() {
      cancelImageLoad?.();
      content.replaceChildren();
      const back = el("button.btn", { text: "一覧へ戻る", dataset: { test: "gallery-viewer-close" }, onclick: closeViewer });
      const controls = [el("strong", { text: active.title }), back];
      if (active.kind === "comic") {
        const pages = active.pages;
        const previous = el("button.btn", { text: "前のページ", disabled: page === 0, dataset: { test: "gallery-page-prev" }, onclick: () => { page--; drawViewer(); } });
        const next = el("button.btn", { text: "次のページ", disabled: page === pages.length - 1, dataset: { test: "gallery-page-next" }, onclick: () => { page++; drawViewer(); } });
        const scroll = el("div.gal-comic-scroll", { tabindex: "0", "aria-label": "漫画。スクロールして読む" }, [image(pages[page], active.title + " " + (page + 1) + "ページ")]);
        const zoom = el("button.btn", { text: "拡大", "aria-pressed": "false", dataset: { test: "gallery-zoom" }, onclick: () => {
          const on = scroll.classList.toggle("zoomed"); zoom.textContent = on ? "全体表示" : "拡大"; zoom.setAttribute("aria-pressed", String(on));
        } });
        controls.splice(1, 0, previous, el("span", { text: (page + 1) + " / " + pages.length, dataset: { test: "gallery-page-count" } }), next, zoom);
        content.append(scroll);
      } else if (active.kind === "movie") {
        video = el("video.gal-movie", { src: active.src, controls: true, playsinline: true, preload: "metadata", "aria-label": active.title,
          onplay: e => {
            if (video !== e.target || !overlay.isConnected) { e.target.pause(); return; }
            if (!movieBgm) { movieBgm = currentBgm(); stopBgm(0); }
          },
          onended: e => { if (video === e.target) restoreMusic(); },
          onerror: e => {
            if (video !== e.target) return;
            restoreMusic(); content.append(el("p.gal-media-error", { text: "動画を読み込めませんでした。閉じて、もう一度開いてください。" }));
          },
        });
        video.volume = config.mute || config.muted ? 0 : config.bgmVolume;
        content.append(video);
      } else if (active.photo) {
        content.append(stickerPhoto(active.photo.people, active.photo.mode, photoName));
      } else {
        const url = cgUrl(active.cg);
        const img = image(url, active.title);
        content.append(img);
        trackImageLoad(img);
      }
      tools.replaceChildren(...controls); back.focus({ preventScroll: true });
    }
    function thumbnail(url) {
      return el("img", { src: url, alt: "", loading: "lazy", onerror: e => {
        e.target.replaceWith(el("span.gal-media-symbol", { text: "画像なし", "aria-hidden": "true" }));
      } });
    }
    function render() {
      const items = entries.filter(entry => tab === "all" || entry.kind === tab);
      count.textContent = fraction(tab === "all" ? stats : stats.byKind[tab]);
      tabs.querySelectorAll("button").forEach(button => button.setAttribute("aria-selected", String(button.dataset.kind === tab)));
      grid.dataset.kind = tab;
      grid.replaceChildren(...items.map(entry => {
        if (!entry.unlocked) return el("div.gal-cell.locked", [
          el("span", { text: "？？？" }), galleryHint(entry) ? el("small", { text: galleryHint(entry) }) : null,
        ]);
        const button = el("button.gal-cell", { title: entry.title, "aria-label": entry.title,
          dataset: { test: "gal-" + entry.id, cg: entry.cg, kind: entry.kind }, onclick: () => show(entry, button) });
        if (entry.cg) button.append(thumbnail(cgThumbUrl(entry.cg) || cgUrl(entry.cg)));
        else if (entry.kind === "comic") button.append(thumbnail(entry.pages[0]));
        else if (entry.photo) {
          const thumb = stickerPhoto(entry.photo.people, entry.photo.mode, photoName); thumb.classList.add("gal-photo-thumb"); button.append(thumb);
        }
        else button.append(el("span.gal-media-symbol", { text: entry.kind === "movie" ? "▶" : "PHOTO" }));
        button.append(el("span.gal-caption", { text: entry.title }));
        return button;
      }));
      if (!items.length) grid.append(el("p.gal-empty", { text: tab === "comic" ? "漫画は準備中です。" : tab === "movie" ? "ムービーは準備中です。" : "物語で出会った一枚が、ここに並びます。" }));
    }
    render(); layers.modal.replaceChildren(overlay); layers.modal.classList.add("show");
    document.addEventListener("keydown", onKey);
    observer = new MutationObserver(() => { if (!overlay.isConnected) close(); });
    observer.observe(layers.modal, { childList: true });
    closeButton.focus({ preventScroll: true }); SE.phone();
  });
}
