// 水煙前線 -EN:CODE- 公式サイトの動き。外部ライブラリは使わない。
// JSが動かなくても文章と絵は全部読める（人物は一人目だけが見える状態になる）。
(() => {
  "use strict";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = matchMedia("(max-width: 820px)");
  document.documentElement.classList.add("js");

  // 左右のスワイプ（縦のスクロールとは区別する）。handler(+1) が「次へ」
  const onSwipe = (el, handler) => {
    if (!el) return;
    let startX = 0, startY = 0;
    el.addEventListener("touchstart", (event) => { startX = event.touches[0].clientX; startY = event.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchend", (event) => {
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      handler(dx < 0 ? 1 : -1);
    }, { passive: true });
  };
  // 横に送る列（顔・絵・店の札）の中で、選んだ物が見える所へ列だけを送る（ページは動かさない）
  const centerIn = (strip, item) => {
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth + 1) return;
    const left = item.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
    strip.scrollTo({ left: left - strip.clientWidth / 2 + item.clientWidth / 2, behavior: calm ? "auto" : "smooth" });
  };

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
  let kvMoved = false; // 最初の表示では、絵を選ぶ列を動かさない
  const loadKv = (img) => {
    if (!img || !img.dataset.src) return Promise.resolve();
    const mobileSource = img.parentElement.querySelector("source[data-srcset]");
    if (mobileSource) {
      mobileSource.srcset = mobileSource.dataset.srcset;
      delete mobileSource.dataset.srcset;
    }
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
    if (tab && kvMoved) centerIn(tab.closest("ul"), tab);
    if (now && tab) {
      now.firstElementChild.textContent = tab.dataset.name;
      now.lastElementChild.textContent = tab.dataset.place;
    }
    loadKv(kvs[(next + 1) % kvs.length]); // 次の1枚だけ先に読む
  };
  const playKv = () => {
    clearInterval(kvTimer);
    if (!calm && kvs.length > 1) kvTimer = setInterval(() => { if (!document.hidden) { kvMoved = true; showKv(kvIndex + 1); } }, 6500);
  };
  tabs.forEach((tab, i) => tab.addEventListener("click", () => { kvMoved = true; showKv(i); playKv(); }));
  // 絵を左右に払っても切り替わる
  onSwipe($(".hero-art"), (step) => { kvMoved = true; showKv(kvIndex + step); playKv(); });
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
        centerIn(tab.closest(".cast-tabs"), tab);
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
  onSwipe($(".cast-deck"), (step) => {
    const current = castTabs.findIndex((tab) => tab.classList.contains("is-on"));
    showCast(castTabs[(current + step + castTabs.length) % castTabs.length].dataset.cast);
  });

  // ── 舞台: 昼と夜の地図、店の切り替え ──
  const town = $(".town");
  if (town) {
    for (const button of $$(".tone button", town)) {
      button.addEventListener("click", () => {
        town.dataset.tone = button.dataset.tone;
        for (const other of $$(".tone button", town)) other.setAttribute("aria-pressed", String(other === button));
      });
    }
    const picks = $$(".pin, .shop-tab", town); // 地図のピンと、スマホ用の札の列。どちらからでも選べる
    const shops = $$(".shop", town);
    for (const pick of picks) {
      pick.addEventListener("click", () => {
        const id = pick.dataset.shop;
        for (const other of picks) other.classList.toggle("is-on", other.dataset.shop === id);
        for (const shop of shops) {
          const on = shop.dataset.shop === id;
          shop.hidden = !on;
          shop.classList.toggle("is-in", on);
        }
        const chip = picks.find((el) => el.classList.contains("shop-tab") && el.dataset.shop === id);
        if (chip) centerIn(chip.closest(".shop-tabs"), chip);
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
      showShot(shots.indexOf(shot));
      lightbox.showModal();
    });
  }
  // 拡大表示: ボタン・矢印キー・左右のスワイプで前後の絵へ送れる
  const shots = $$(".shot");
  let shotIndex = 0;
  const showShot = (index) => {
    if (!lightbox || !shots.length) return;
    shotIndex = (index + shots.length) % shots.length;
    const shot = shots[shotIndex];
    const img = $("img", lightbox);
    img.src = shot.dataset.full;
    img.alt = $("img", shot).alt;
    $("figcaption", lightbox).textContent = shot.dataset.caption || "";
    const count = $(".lightbox-count", lightbox);
    if (count) count.textContent = (shotIndex + 1) + " / " + shots.length;
  };
  if (lightbox) {
    lightbox.addEventListener("click", (event) => { if (event.target === lightbox || event.target.tagName === "FIGURE") lightbox.close(); });
    $(".lightbox-prev", lightbox)?.addEventListener("click", () => showShot(shotIndex - 1));
    $(".lightbox-next", lightbox)?.addEventListener("click", () => showShot(shotIndex + 1));
    lightbox.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") showShot(shotIndex + 1);
      if (event.key === "ArrowLeft") showShot(shotIndex - 1);
    });
    onSwipe(lightbox, (step) => showShot(shotIndex + step));
  }

  // ── スクロールに合わせた小さな動き（詩のコマ絵の帯）と、画面に入ったときの出かた ──
  const strip = $(".strip img");
  let ticking = false;
  const drift = () => {
    ticking = false;
    if (!strip) return;
    const vh = innerHeight;
    const box = strip.parentElement.getBoundingClientRect();
    if (box.bottom < 0 || box.top > vh) return;
    if (narrow.matches) {
      // スマホ: 帯が画面の下から入って上へ抜けるまでに、絵の左端から右端までを見せる
      const over = Math.max(0, strip.offsetWidth - box.width);
      const through = Math.min(1, Math.max(0, (vh - box.top) / (vh + box.height)));
      strip.style.transform = "translate3d(" + (-through * over).toFixed(1) + "px, 0, 0)";
    } else {
      const progress = (box.top + box.height / 2 - vh / 2) / vh; // 画面の真ん中で0
      strip.style.transform = "translate3d(" + (progress * 4).toFixed(2) + "%, 0, 0)";
    }
  };
  if (!calm && strip) {
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
    addEventListener("resize", drift, { passive: true });
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
