export function mountPortraitTable(stage, host) {
  const events = new AbortController(), signal = events.signal;
  // 段の進み（見出しの「1/7 話を聞く」）を、段の名前と7つの点で見せる（VPG17。「1/7」の字は点で分かる。読み上げは本編の見出しのまま）。
  // 見出しの字は本編が書き換えるので、隣に点の列を置き、字だけを CSS で隠す（本編の DOM の中身には触れない）。
  const STEP = /^(\d+)\/(\d+)\s+(.+)$/;
  function syncStep() {
    const node = host.querySelector('[data-test="trpg-heading-step"]');
    if (!node) return;
    const match = STEP.exec(node.textContent.trim());
    let track = node.nextElementSibling?.classList.contains("p-step") ? node.nextElementSibling : null;
    if (!match) { track?.remove(); node.classList.remove("p-step-source"); return; }
    const [, at, of, label] = match;
    if (!track) {
      track = Object.assign(document.createElement("span"), { className: "p-step" });
      track.setAttribute("aria-hidden", "true");
      node.after(track);
    }
    const key = `${at}/${of} ${label}`;
    if (track.dataset.key === key) return;
    track.dataset.key = key;
    const name = Object.assign(document.createElement("b"), { textContent: label });
    const pips = Object.assign(document.createElement("span"), { className: "p-step-pips" });
    for (let i = 1; i <= Number(of); i++) pips.append(Object.assign(document.createElement("i"), { className: i < Number(at) ? "done" : i === Number(at) ? "now" : "" }));
    track.replaceChildren(name, pips);
    node.classList.add("p-step-source");
  }
  // 調べる場面で、横長の絵の外側に同じ絵をぼかして敷く（trpg.css の --scene-art。VPG20）。今の部屋の絵を写すだけで、本編の DOM には触れない。
  function syncSceneArt() {
    const img = host.querySelector(".trpg-room > img");
    const src = img?.currentSrc || img?.src || "";
    if (host.dataset.sceneArt === src) return;
    host.dataset.sceneArt = src;
    if (src) host.style.setProperty("--scene-art", `url("${src.replace(/"/g, "%22")}")`);
    else host.style.removeProperty("--scene-art");
  }
  // 調べる場面（VPG23→VPG27）: 部屋の絵を、画面の上から下の段（見る範囲の切り替え・相談）の上まで、縦いっぱいに大きく見せる（上下に空きを残さない）。
  // 横長の絵は縦に収まらないので、左・中・右の3つの範囲に分けて見せ、◀ ▶・範囲の札・絵を横に払うので切り替える（2026-11-27 オーナー「三分割していいかも　その代わり余白は上下埋まるように」）。
  // 3つの範囲は、印のある所を覆うように置き、どの印もどれかの範囲で丸ごと見える（入りきらない時だけ、絵を少し小さくする）。
  // 調べる印は絵と一緒に動き、今の範囲に無い印は隠す（ほかの範囲の札に、そこでしか見えない「まだ調べていない数」）。
  // 本編の DOM には触れない: 印の位置（本編が style の left/top に % で書く）を CSS の変数に写し、見ている範囲は #stage の data-pan に立てる。
  const PANES = ["left", "center", "right"], PANE_LABEL = { left: "左", center: "中", right: "右" };
  const EX_BOTTOM = 200; // 絵の下に置く段（切り替え 84・相談 80・間）の高さ
  const MARK = 46; // 印（丸 80px）の半分と少し: この幅が範囲の中に入れば「丸ごと見える」
  const panNav = document.createElement("nav");
  panNav.className = "p-pan";
  panNav.setAttribute("aria-label", "部屋の見る範囲");
  const makeButton = (cls, test, html, label, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = cls;
    button.dataset.test = test;
    button.innerHTML = html;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);
    return button;
  };
  const prevButton = makeButton("p-pan-step", "trpg-pan-prev", '<i aria-hidden="true">◀</i>', "左の範囲へ", () => step(-1));
  const nextButton = makeButton("p-pan-step", "trpg-pan-next", '<i aria-hidden="true">▶</i>', "右の範囲へ", () => step(1));
  prevButton.dataset.dir = "prev"; nextButton.dataset.dir = "next";
  const paneButtons = PANES.map(pane => {
    const button = makeButton("p-pan-side", `trpg-pan-${pane}`, `<b>${PANE_LABEL[pane]}</b><em aria-hidden="true"></em>`, `部屋の${PANE_LABEL[pane]}を見る`, () => pan(pane));
    button.dataset.side = pane;
    return button;
  });
  const paneRow = document.createElement("div");
  paneRow.className = "p-pan-panes";
  paneRow.append(...paneButtons);
  panNav.append(prevButton, paneRow, nextButton);
  stage.append(panNav);
  stage.dataset.pan = "center";
  let panRoom = "";
  function pan(pane) {
    if (stage.dataset.pan === pane) return;
    stage.dataset.pan = pane;
    syncExplore();
  }
  function step(dir) {
    const at = PANES.indexOf(stage.dataset.pan) + dir;
    if (at >= 0 && at < PANES.length) pan(PANES[at]);
  }
  /** 印のある所を覆う3つの範囲（幅 640）の左端。どの印も、どれかの範囲で丸ごと見えるか。 */
  function paneLayout(xs, exW) {
    const width = 640, span = Math.max(0, exW - width);
    const lo = xs.length ? Math.min(...xs) - MARK - 24 : 0, hi = xs.length ? Math.max(...xs) + MARK + 24 : exW;
    const left = Math.max(0, Math.min(span, lo)), right = Math.max(0, Math.min(span, hi - width));
    const offsets = [left, (left + right) / 2, right];
    const fits = xs.every(x => offsets.some(o => x - MARK >= o && x + MARK <= o + width));
    return { offsets, fits };
  }
  function syncExplore() {
    const root = host.querySelector(".trpg-root");
    // 窓（メモ・見立て・判定など）が開いている間は、範囲の切り替えを出さない
    const room = root?.matches('.trpg-idle[data-phase="explore"]') && !root.querySelector(".trpg-modal, .trpg-roll-show") ? root.querySelector(".trpg-room.interactive") : null;
    stage.dataset.exploring = room ? "true" : "false";
    if (!room) return;
    const img = room.querySelector(":scope > img");
    const src = img?.currentSrc || img?.src || "";
    if (src !== panRoom) { panRoom = src; stage.dataset.pan = "center"; } // 別の部屋に入ったら、真ん中から
    const ratio = img?.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 16 / 9;
    const spots = [...room.querySelectorAll(".trpg-spot")].map(spot => ({ spot, sx: parseFloat(spot.style.left), sy: parseFloat(spot.style.top) }))
      .filter(({ sx, sy }) => Number.isFinite(sx) && Number.isFinite(sy));
    // 絵の高さ: 画面の上から下の段の上まで。印が3つの範囲に収まらない時だけ、少しずつ小さくする
    let exH = Math.max(600, stage.clientHeight - EX_BOTTOM), layout = null;
    for (let tries = 0; tries < 12; tries++) {
      layout = paneLayout(spots.map(({ sx }) => sx / 100 * exH * ratio), exH * ratio);
      if (layout.fits) break;
      exH *= .96;
    }
    const exW = exH * ratio, width = 640, current = PANES.indexOf(stage.dataset.pan), panX = layout.offsets[current];
    stage.style.setProperty("--ex-h", `${exH.toFixed(1)}px`);
    stage.style.setProperty("--ex-ar", ratio.toFixed(5));
    stage.style.setProperty("--pan-x", `${panX.toFixed(1)}px`);
    const unseen = PANES.map(() => 0);
    for (const { spot, sx, sy } of spots) {
      spot.style.setProperty("--sx", String(sx));
      spot.style.setProperty("--sy", String(sy));
      const at = sx / 100 * exW;
      const inPane = layout.offsets.map(o => at - MARK >= o && at + MARK <= o + width);
      // どの範囲にも丸ごとは入らない印（絵が足りない時）は、中心が入る範囲で見せる
      if (!inPane.some(Boolean)) layout.offsets.forEach((o, i) => { inPane[i] = at >= o && at <= o + width; });
      spot.dataset.off = String(!inPane[current]);
      const x = at - panX;
      spot.dataset.edge = x < 130 ? "start" : x > width - 130 ? "end" : "";
      // 名前の札は印の下に。絵の下の端に近い印だけ上に
      spot.dataset.pside = sy > 82 ? "above" : "below";
      if (!spot.classList.contains("checked") && !spot.disabled && !inPane[current]) inPane.forEach((inside, i) => { if (inside) unseen[i]++; });
    }
    paneButtons.forEach((button, i) => {
      const here = i === current, count = here ? 0 : unseen[i];
      button.setAttribute("aria-pressed", String(here));
      button.querySelector("em").textContent = count ? String(count) : "";
      button.setAttribute("aria-label", `部屋の${PANE_LABEL[PANES[i]]}を見る${count ? `。まだ調べていない所が${count}つ` : ""}`);
    });
    prevButton.disabled = current <= 0;
    nextButton.disabled = current >= PANES.length - 1;
    prevButton.dataset.more = String(unseen.slice(0, current).some(Boolean));
    nextButton.dataset.more = String(unseen.slice(current + 1).some(Boolean));
  }
  // 絵を横に払って、となりの範囲へ（印を押す途中で払った時は、その印は押さない）
  let swipe = null, swallowClick = false;
  stage.addEventListener("pointerdown", event => {
    if (stage.dataset.exploring !== "true" || event.target.closest?.(".p-pan, .trpg-stage-companions, .trpg-stage-pockets, .trpg-stage-action, .trpg-header")) return;
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, { signal });
  stage.addEventListener("pointerup", event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y, unit = stage.getBoundingClientRect().width / 640;
    swipe = null;
    if (Math.abs(dx) < 48 * unit || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    step(dx < 0 ? 1 : -1);
  }, { signal });
  stage.addEventListener("pointercancel", () => { swipe = null; }, { signal });
  stage.addEventListener("click", event => { if (swallowClick) { swallowClick = false; event.stopPropagation(); event.preventDefault(); } }, { capture: true, signal });

  let frame = 0;
  function sync() {
    frame = 0;
    stage.style.setProperty("--rs-k", String(Math.min(640 / 720, (stage.clientHeight - 110) / 1300)));
    syncStep();
    syncSceneArt();
    syncExplore();
  }
  const queue = () => { if (!frame) frame = requestAnimationFrame(sync); };
  const observer = new MutationObserver(queue);
  observer.observe(host, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "data-phase", "disabled"] });
  const resize = new ResizeObserver(queue);
  resize.observe(stage);
  sync();
  return () => {
    events.abort();
    observer.disconnect();
    resize.disconnect();
    cancelAnimationFrame(frame);
    panNav.remove();
    for (const node of host.querySelectorAll(".p-step")) node.remove();
    for (const node of host.querySelectorAll(".p-step-source")) node.classList.remove("p-step-source");
    delete stage.dataset.exploring;
    delete stage.dataset.pan;
    delete host.dataset.sceneArt;
    host.style.removeProperty("--scene-art");
    for (const prop of ["--rs-k", "--ex-h", "--ex-ar", "--pan-x"]) stage.style.removeProperty(prop);
  };
}
