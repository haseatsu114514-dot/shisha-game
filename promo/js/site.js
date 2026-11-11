// 水煙前線 -EN:CODE- 公式サイトの動き。外部ライブラリは使わない。
// JSが動かなくても文章と絵は全部読める（人物は一人目だけが見える状態になる）。
(() => {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");

  // ── 「遊ぶ」ボタン。<body data-play="soon"> にすると、リンクを止めて「近日公開」に変える ──
  if (document.body.dataset.play === "soon") {
    for (const link of $$("[data-play-link]")) {
      link.removeAttribute("href");
      link.setAttribute("aria-disabled", "true");
      link.textContent = "近日公開";
    }
  }

  // ── 共有リンクに、いま開いているこのページのURLを入れる ──
  for (const link of $$("[data-share]")) {
    try {
      const url = new URL(link.href);
      url.searchParams.set("url", location.origin + location.pathname);
      link.href = url.href;
    } catch { /* 元のリンクのまま */ }
  }

  // ── ヘッダー: ヒーローを過ぎたら地を敷く／狭い画面のメニュー ──
  const head = $("#head");
  const hero = $("#top");
  if (head && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => head.classList.toggle("is-solid", !entry.isIntersecting),
      { rootMargin: "-72px 0px 0px 0px", threshold: 0.12 }).observe(hero);
  }
  const menu = $(".head-menu");
  const nav = $("#nav");
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    menu.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) head.classList.add("is-solid");
  };
  if (menu && nav) {
    menu.addEventListener("click", () => setMenu(menu.getAttribute("aria-expanded") !== "true"));
    nav.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });
    addEventListener("keydown", (event) => { if (event.key === "Escape") setMenu(false); });
  }

  // ── ヒーロー: 横長のキービジュアル（サイトのために描いた絵）と、1キャラ1枚の絵（タイトル画面と同じ絵）を順に見せる ──
  const kvs = $$(".kv");
  const tabs = $$(".reel-tab");
  const now = $(".reel-now");
  let kvIndex = 0;
  let kvTimer = 0;
  const loadKv = (img) => {
    if (!img || !img.dataset.src) return Promise.resolve();
    if (img.dataset.srcset) { // 横長の絵は、スマホでは小さい絵を読む
      img.srcset = img.dataset.srcset;
      delete img.dataset.srcset;
    }
    img.src = img.dataset.src;
    delete img.dataset.src;
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  };
  const showKv = async (index) => {
    const next = (index + kvs.length) % kvs.length;
    await loadKv(kvs[next]);
    kvIndex = next;
    kvs.forEach((img, i) => img.classList.toggle("is-on", i === next));
    hero?.classList.toggle("is-wide", kvs[next].classList.contains("kv-wide")); // 横長の絵の間は、コピーを出さない（人物に掛かるので）
    tabs.forEach((tab, i) => tab.classList.toggle("is-on", i === next));
    const tab = tabs[next];
    if (now && tab) {
      now.firstElementChild.textContent = tab.dataset.name;
      now.lastElementChild.textContent = tab.dataset.place;
    }
    loadKv(kvs[(next + 1) % kvs.length]); // 次の1枚だけ先に読む
  };
  const playKv = () => {
    clearInterval(kvTimer);
    if (!calm && kvs.length > 1) kvTimer = setInterval(() => { if (!document.hidden) showKv(kvIndex + 1); }, 6500);
  };
  tabs.forEach((tab, i) => tab.addEventListener("click", () => { showKv(i); playKv(); }));
  if (kvs.length) {
    addEventListener("load", () => { loadKv(kvs[1]); playKv(); }, { once: true });
  }

  // ── 登場人物の切り替え ──
  const casts = $$(".cast");
  const castTabs = $$(".cast-tab");
  const showCast = (id, focus = false) => {
    const target = casts.find((cast) => cast.dataset.cast === id);
    if (!target) return;
    for (const cast of casts) {
      cast.hidden = cast !== target;
      cast.classList.remove("is-in");
    }
    void target.offsetWidth; // 出る動きをやり直す
    target.classList.add("is-in");
    for (const tab of castTabs) {
      const on = tab.dataset.cast === id;
      tab.classList.toggle("is-on", on);
      tab.setAttribute("aria-pressed", String(on));
      if (on) {
        if (focus) tab.focus({ preventScroll: true });
        const strip = tab.closest(".cast-tabs");
        if (strip && strip.scrollWidth > strip.clientWidth) {
          strip.scrollTo({ left: tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2, behavior: calm ? "auto" : "smooth" });
        }
      }
    }
  };
  castTabs.forEach((tab, i) => {
    tab.addEventListener("click", () => showCast(tab.dataset.cast));
    tab.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      showCast(castTabs[(i + step + castTabs.length) % castTabs.length].dataset.cast, true);
    });
  });
  // 人物の絵は、選ばれる少し前（その人の顔に触れたとき）に読み始める
  for (const tab of castTabs) {
    tab.addEventListener("pointerenter", () => {
      const cast = casts.find((c) => c.dataset.cast === tab.dataset.cast);
      for (const img of $$("img[loading='lazy']", cast || document.createElement("div"))) img.loading = "eager";
    }, { once: true });
  }
  // 左右のスワイプでも切り替える
  const deck = $(".cast-deck");
  if (deck) {
    let startX = 0, startY = 0;
    deck.addEventListener("touchstart", (event) => { startX = event.touches[0].clientX; startY = event.touches[0].clientY; }, { passive: true });
    deck.addEventListener("touchend", (event) => {
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      const current = castTabs.findIndex((tab) => tab.classList.contains("is-on"));
      showCast(castTabs[(current + (dx < 0 ? 1 : -1) + castTabs.length) % castTabs.length].dataset.cast);
    }, { passive: true });
  }

  // ── 舞台: 昼と夜の地図、店の切り替え ──
  const town = $(".town");
  if (town) {
    for (const button of $$(".tone button", town)) {
      button.addEventListener("click", () => {
        town.dataset.tone = button.dataset.tone;
        for (const other of $$(".tone button", town)) other.setAttribute("aria-pressed", String(other === button));
      });
    }
    const pins = $$(".pin", town);
    const shops = $$(".shop", town);
    for (const pin of pins) {
      pin.addEventListener("click", () => {
        for (const other of pins) other.classList.toggle("is-on", other === pin);
        for (const shop of shops) {
          const on = shop.dataset.shop === pin.dataset.shop;
          shop.hidden = !on;
          shop.classList.toggle("is-in", on);
        }
      });
    }
  }

  // ── 場面の棚: つかんで横に送る／絵を大きく見る ──
  const shelf = $(".shelf");
  const lightbox = $("#lightbox");
  if (shelf) {
    let down = false, moved = 0, startX = 0, startLeft = 0;
    shelf.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") return; // 指のときはブラウザの横スクロールに任せる
      down = true; moved = 0; startX = event.clientX; startLeft = shelf.scrollLeft;
    });
    addEventListener("pointermove", (event) => {
      if (!down) return;
      const dx = event.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) { shelf.classList.add("is-drag"); shelf.scrollLeft = startLeft - dx; }
    });
    addEventListener("pointerup", () => { down = false; setTimeout(() => shelf.classList.remove("is-drag"), 0); });
    shelf.addEventListener("click", (event) => {
      const shot = event.target.closest(".shot");
      if (!shot || moved > 6 || !lightbox || !lightbox.showModal) return;
      const img = $("img", lightbox);
      img.src = shot.dataset.full;
      img.alt = $("img", shot).alt;
      $("figcaption", lightbox).textContent = shot.dataset.caption || "";
      lightbox.showModal();
    });
  }
  if (lightbox) {
    lightbox.addEventListener("click", (event) => { if (event.target === lightbox || event.target.tagName === "FIGURE") lightbox.close(); });
  }

  // ── スクロールに合わせた小さな動き（詩のコマ絵の帯）と、画面に入ったときの出かた ──
  const drifters = [
    [$(".strip img"), -4],
  ].filter(([el]) => el);
  let ticking = false;
  const drift = () => {
    ticking = false;
    const vh = innerHeight;
    for (const [el, amount] of drifters) {
      const box = el.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) continue;
      const progress = (box.top + box.height / 2 - vh / 2) / vh; // 画面の真ん中で0
      el.style.transform = `translate3d(${(-progress * amount).toFixed(2)}%, 0, 0)`;
    }
  };
  if (!calm && drifters.length) {
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
    drift();
  }

  const reveal = $$(".sec-head, .intro-head, .intro-body, .chapter-text, .chapter-art, .chapter-rest li, .step-text, .judge, .world-lead, .spec-table, .fan");
  if ("IntersectionObserver" in window && !calm) {
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-seen");
        seen.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    for (const el of reveal) { el.classList.add("rv"); seen.observe(el); }
  }
})();
