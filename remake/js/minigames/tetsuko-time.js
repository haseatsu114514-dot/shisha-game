// 「てつこといっしょ / TETSUKO TIME」の画面（#2454）。mukai の帰りに裏口をのぞいた時だけ開く。
// 猫の状態と行動の選び方・保存の確定は tetsuko-model.js（DOM なし）。ここは描画と入力だけ。
//
// 動線: mukai で行動 → 帰りに裏口をのぞく（ch3-tokyo-daily.js の offerTetsuko）→「てつこといっしょ」
//       → 段階の会話がまだあれば先に読む → この画面 → 「帰る」→ settleTetsukoTime で確定。
// 画面を開いている間に保存を書くのは通販の注文だけ（お金を引くのと同じ処理の中で保存する）。
// 回復・来訪の加算・置いた小物・発見は、帰った後に呼び出し側が settleTetsukoTime でまとめて書く。
//
// 画像: 会話と同じてつこの立ち絵（5表情）を、猫の部分だけ切り出して大きく見せる。新しい猫の絵は作らない。
// 小物は CSS と SVG で描く（文字を画像に焼き込まない）。
//
// DOM 依存（ui.js / util.js / audio.js / data.js / stats.js / state.js）は openTetsukoTime の中で遅延 import する。
import { SLOTS, PROPS, CATALOG, TREAT, MOMENTS, ALBUM_LIMIT, POSES, createSession, openingLines, actionState, interact,
  nextBehavior, arrange, takePhoto, removePhoto, leave, sessionResult, orderStatus, recordOrder, tetsukoRecord,
  pendingOrders, moodLabel, itemName, slotLabel } from "./tetsuko-model.js";

export { settleTetsukoTime, TETSUKO_STAMINA } from "./tetsuko-model.js";

export const TETSUKO_TIME = Object.freeze({
  id: "tetsuko_time",
  title: "てつこといっしょ",
  roman: "TETSUKO TIME",
});

// 置き場所（x は横の%、y は下からの%、s は奥行きの縮尺）。front は手前（足元・膝）。
const SPOTS = Object.freeze({
  bench: { x: 22, y: 50, s: 0.72 }, floor: { x: 52, y: 36, s: 0.86 }, bed: { x: 79, y: 35, s: 0.82 }, front: { x: 40, y: 30, s: 1 },
});
const BESIDE = { bench: 9, floor: -12, bed: -11 };
const SINK = { in: 14, peek: 54, on: -5 };
const ACTIONS = ["pet", "play", "brush", "treat", "watch"];

// 小物の絵（奥の面と手前の面。猫が中に入る時だけ手前の面を猫より前に出す）
const svg = (view, body) => `<svg viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
const PROP_ART = {
  ball: { w: 7, back: svg("0 0 40 40", `<circle cx="20" cy="20" r="17" fill="#c98b9a"/><path d="M6 15c9 5 19 5 28 0M7 26c9-4 18-4 26 0" stroke="#e9c3cb" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="14" cy="13" r="4" fill="#f2d9de" opacity=".7"/>`) },
  box: { w: 33,
    back: svg("0 0 150 110", `<path d="M14 28h122l-8 14H22z" fill="#8b6237"/><path d="M14 28 0 8l30 6zM136 28l14-20-30 6z" fill="#b98a52"/><rect x="22" y="40" width="106" height="66" fill="#6e4b29"/>`),
    front: svg("0 0 150 110", `<path d="M10 44h130v62H10z" fill="#c4935a"/><path d="M10 44h130v6H10z" fill="#a87a45"/><rect x="66" y="44" width="18" height="62" fill="#e4cc9a" opacity=".75"/><path d="M20 60h22M20 68h14" stroke="#8b6237" stroke-width="3" stroke-linecap="round"/>`) },
  cushion: { w: 30, back: svg("0 0 150 58", `<path d="M10 30C8 22 20 14 36 12h78c16 2 28 10 26 18v10c2 8-10 14-26 15H36c-16-1-28-7-26-15z" fill="#7d2f36"/><path d="M12 28C12 20 24 13 38 12h74c14 1 26 8 26 16-2 9-14 14-28 15H40c-14-1-27-6-28-15z" fill="#a8424a"/><path d="M30 27c14-5 76-5 90 0" stroke="#c96a6e" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="75" cy="27" r="4.5" fill="#e3b45a"/><path d="M10 30l-6 6M140 30l6 6M38 12l-4-6M112 12l4-6" stroke="#e3b45a" stroke-width="3" stroke-linecap="round"/>`) },
  scratcher: { w: 30, back: svg("0 0 150 36", `<path d="M6 10h138l-6 22H12z" fill="#a9844f"/><path d="M6 10h138v6H6z" fill="#c9a46b"/>${Array.from({ length: 13 }, (_, i) => `<path d="M${16 + i * 10} 17v12" stroke="#7d5f35" stroke-width="2"/>`).join("")}`) },
  tunnel: { w: 36, back: svg("0 0 180 90", `<ellipse cx="150" cy="50" rx="24" ry="34" fill="#2c3d55"/>`),
    front: svg("0 0 180 90", `<path d="M30 16h120c14 0 24 16 24 34s-10 34-24 34H30z" fill="#4f7aa8"/><path d="M60 16v68M90 16v68M120 16v68" stroke="#3d6390" stroke-width="5"/><ellipse cx="30" cy="50" rx="24" ry="34" fill="#6a96c4"/><ellipse cx="30" cy="50" rx="17" ry="27" fill="#1c2738"/><path class="tt-tail" d="M28 66c-10 4-22 0-26-10" stroke="#c97b3c" stroke-width="9" fill="none" stroke-linecap="round"/>`) },
  bed: { w: 36,
    back: svg("0 0 180 110", `<ellipse cx="90" cy="44" rx="86" ry="32" fill="#a8927c"/><ellipse cx="90" cy="40" rx="80" ry="26" fill="#c2ad97"/><ellipse cx="90" cy="48" rx="58" ry="19" fill="#efe5d6"/><ellipse cx="90" cy="52" rx="44" ry="12" fill="#e3d6c3"/>`),
    front: svg("0 0 180 110", `<path d="M4 44c0 18 38 32 86 32s86-14 86-32v26c0 20-38 34-86 34S4 90 4 70z" fill="#8f7a66"/><path d="M14 58c16 12 44 18 76 18s60-6 76-18" stroke="#c4b09b" stroke-width="10" fill="none" stroke-linecap="round"/>`) },
};
const BENCH_ART = svg("0 0 300 120", `<rect x="10" y="18" width="280" height="14" rx="3" fill="#8a6a4a"/><rect x="14" y="32" width="272" height="10" rx="2" fill="#6f5338"/><path d="M40 42v74M260 42v74" stroke="#4f3b28" stroke-width="12"/><path d="M40 92h220" stroke="#4f3b28" stroke-width="6"/>`);
const MAT_ART = svg("0 0 200 50", `<ellipse cx="100" cy="25" rx="98" ry="23" fill="#4a3a52" opacity=".75"/><ellipse cx="100" cy="25" rx="84" ry="17" fill="none" stroke="#8f7a9a" stroke-width="2" stroke-dasharray="6 5"/>`);

/**
 * 「てつこといっしょ」を開く。「帰る」で閉じたらふれあいの結果を返す（保存はまだ書かない）。
 * 中断（LOAD・章跨ぎ・pagehide・signal）は null。
 * @param {object} ctx
 * @param {object} ctx.value 本編のセーブ（state そのもの。通販の注文だけ、ここで書いて保存する）
 * @param {string} [ctx.key] 親の mukai 訪問から作った訪問キー（回復と来訪を二重にしない）
 * @param {boolean} [ctx.storyRead] 直前に段階の会話を読み終えた
 * @param {string} [ctx.dayLabel] 写真に残す日付の言葉（例「東京 3日目」）
 * @param {() => boolean} [ctx.isCurrent] このセッションがまだ有効か
 * @param {AbortSignal} [ctx.signal]
 * @returns {Promise<object|null>}
 */
export async function openTetsukoTime({ value, key = null, storyRead = false, dayLabel = "", isCurrent = () => true, signal = null } = {}) {
  if (!value || signal?.aborted || !isCurrent()) return null;
  const [{ el }, ui, audio, data, stats, store, budget] = await Promise.all([
    import("../core/util.js"), import("../core/ui.js"), import("../core/audio.js"), import("../core/data.js"),
    import("../core/stats.js"), import("../core/state.js"), import("../core/travel-budget.js"),
  ]);
  if (signal?.aborted || !isCurrent()) return null;
  const { layers, showScreen } = ui;
  const SE = audio.SE || {};
  const reduce = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const poseUrl = pose => data.portraitInfo("tetsuko", pose)?.src || "";
  for (const pose of POSES) { const image = new Image(); image.src = poseUrl(pose); }
  const nameOf = who => who === "mukai_master" ? data.displayName(who, value) || "ムカイさん" : data.displayName(who, value) || "";

  const session = createSession(value, { day: value.day, key, storyRead, dayLabel });

  return await new Promise(resolve => {
    let done = false;
    let panel = null;
    let autoTimer = 0;
    const lineTimers = [];
    let foundTimer = 0;

    // ---- 骨組み -------------------------------------------------------------------------------
    const lineWho = el("span.tt-who");
    const lineText = el("span.tt-text");
    const lineBox = el("div.tt-line.panel", { role: "status", "aria-live": "polite", dataset: { test: "tt-line" },
      onclick: () => flushLines() }, [lineWho, lineText]);
    const foundChip = el("div.tt-found", { "aria-live": "polite", dataset: { test: "tt-found" } });
    const moodLine = el("p.tt-mood", { text: moodLabel(session.mood, session.stage) });
    const catImg = el("img.tt-cat-img", { alt: "", draggable: "false", src: poseUrl(session.cat.pose) });
    const purr = el("span.tt-purr", { "aria-hidden": "true", text: "ごろごろ" });
    const hit = el("button.tt-cat-hit", { type: "button", "aria-label": "てつこを撫でる", dataset: { test: "tt-cat" } });
    const cat = el("div.tt-cat", { dataset: { test: "tt-cat-figure" } }, [
      el("div.tt-cat-body", [el("div.tt-cat-motion", [catImg])]), purr, hit,
    ]);
    const propNodes = {};
    const slotNodes = SLOTS.flatMap(slot => {
      const back = el("div.tt-prop.back", { dataset: { slot: slot.id } });
      const front = el("div.tt-prop.front", { dataset: { slot: slot.id } });
      propNodes[slot.id] = { back, front };
      return [back, front];
    });
    const scene = el("div.tt-scene", [
      el("div.tt-ground"),
      el("div.tt-bench", { html: BENCH_ART }),
      el("div.tt-mat", { html: MAT_ART }),
      ...slotNodes, cat,
    ]);
    const actionButtons = Object.fromEntries(ACTIONS.map(action => [action, el("button.btn.tt-act", { type: "button",
      dataset: { test: `tt-${action}`, action }, onclick: () => act(action) })]));
    const tool = (label, test, onclick) => el("button.btn.small.tt-tool", { type: "button", text: label, dataset: { test }, onclick });
    const back = el("button.btn.small.tt-tool.tt-back", { type: "button", text: "← 帰る", dataset: { test: "tetsuko-time-back" },
      onclick: () => { SE.select?.(); finish(false); } });
    const panelHost = el("div.tt-panel-host");
    const root = el("div.tetsuko-time", { dataset: { test: "tetsuko-time-screen", stage: String(session.stage), mood: session.mood.id } }, [
      scene,
      el("header.tt-head", [el("h2.tt-title", [TETSUKO_TIME.title, el("small", { text: TETSUKO_TIME.roman })]), moodLine]),
      el("nav.tt-tools", { "aria-label": "道具" }, [
        tool("もようがえ", "tt-arrange", () => openPanel("arrange")),
        tool("通販", "tt-shop", () => openPanel("shop")),
        tool("図鑑", "tt-book", () => openPanel("book")),
        tool("写真", "tt-photo", photo),
        back,
      ]),
      foundChip, lineBox,
      el("nav.tt-actions", { "aria-label": "てつこと過ごす" }, ACTIONS.map(action => actionButtons[action])),
      panelHost,
    ]);

    // ---- 描画 -------------------------------------------------------------------------------
    function renderProps() {
      for (const slot of SLOTS) {
        const id = session.layout[slot.id];
        const art = id ? PROP_ART[id] : null;
        const pos = SPOTS[slot.id];
        for (const part of ["back", "front"]) {
          const node = propNodes[slot.id][part];
          node.dataset.prop = id || "";
          node.innerHTML = art?.[part] || "";
          node.style.setProperty("--x", `${pos.x}%`);
          node.style.setProperty("--y", `${pos.y}%`);
          node.style.setProperty("--s", String(pos.s));
          node.style.setProperty("--w", `${art?.w || 0}cqh`);
        }
      }
    }
    function renderCat() {
      const { at, mode, pose } = session.cat;
      const spot = SPOTS[at] || SPOTS.bench;
      const offset = mode === "beside" ? BESIDE[at] || 0 : 0;
      cat.style.setProperty("--x", `${spot.x + offset}%`);
      cat.style.setProperty("--y", `${spot.y}%`);
      cat.style.setProperty("--s", String(spot.s));
      cat.style.setProperty("--sink", `${SINK[mode] || 0}%`);
      Object.assign(cat.dataset, { at, mode, pose });
      const url = poseUrl(pose);
      if (url && catImg.getAttribute("src") !== url) catImg.src = url;
      for (const slot of SLOTS) {
        const holds = at === slot.id && ["in", "peek", "hidden"].includes(mode);
        propNodes[slot.id].front.classList.toggle("holds", holds);
      }
      root.dataset.pose = pose;
    }
    function renderActions() {
      const states = actionState(session);
      for (const action of ACTIONS) {
        const node = actionButtons[action];
        const state = states[action];
        node.disabled = !state.ok;
        node.replaceChildren(...[el("b", { text: state.label }), state.why ? el("small", { text: state.why }) : null].filter(Boolean));
        node.title = state.why || "";
      }
    }
    function showLine(entry) {
      const who = entry.who ? nameOf(entry.who) : "";
      lineWho.textContent = who;
      lineWho.hidden = !who;
      lineText.textContent = entry.text;
      lineBox.dataset.who = entry.who || "";
    }
    function clearLineTimers() { while (lineTimers.length) clearTimeout(lineTimers.pop()); }
    let pending = [];
    function showLines(lines) {
      clearLineTimers();
      pending = [...(lines || [])];
      const step = () => {
        const next = pending.shift();
        if (!next) return;
        showLine(next);
        if (pending.length) lineTimers.push(setTimeout(step, 1900));
      };
      step();
    }
    function flushLines() {
      if (!pending.length) return;
      clearLineTimers();
      showLine(pending.shift());
      if (pending.length) lineTimers.push(setTimeout(() => showLines(pending), 1900));
    }
    function showFound(moment) {
      if (!moment) return;
      clearTimeout(foundTimer);
      foundChip.textContent = `しぐさ図鑑に記録した：${moment.name}`;
      foundChip.classList.add("show");
      SE.good?.();
      foundTimer = setTimeout(() => foundChip.classList.remove("show"), 2600);
    }
    function bounce() {
      if (reduce()) return;
      cat.classList.remove("react");
      void cat.offsetWidth;
      cat.classList.add("react");
    }
    function apply(result, { motion = true } = {}) {
      if (!result) return;
      renderCat();
      if (result.cat?.roll) {
        const ball = SLOTS.map(slot => propNodes[slot.id].back).find(node => node.dataset.prop === "ball");
        if (ball && !reduce()) { ball.classList.remove("roll"); void ball.offsetWidth; ball.classList.add("roll"); }
      }
      purr.classList.toggle("show", !!result.purr);
      if (result.purr) setTimeout(() => purr.classList.remove("show"), 1800);
      if (motion) bounce();
      showLines(result.lines);
      showFound(result.found);
      renderActions();
    }

    // ---- 自律行動（画面を開いている間だけ） -----------------------------------------------------------
    function schedule(delay = null) {
      clearTimeout(autoTimer);
      if (done) return;
      const ms = delay ?? (reduce() ? 4200 : 2600 + Math.random() * 900);
      autoTimer = setTimeout(() => {
        if (done) return;
        if (panel || pending.length) { schedule(); return; }
        apply(nextBehavior(session), { motion: false });
        schedule();
      }, ms);
    }

    // ---- 操作 -------------------------------------------------------------------------------
    function act(action) {
      if (done || panel) return;
      const result = interact(session, action);
      if (!result) return;
      SE.click?.();
      apply(result);
      schedule(4200); // 反応を読めるよう、次の自律行動は少し待つ
    }
    function photo() {
      if (done) return;
      const shot = takePhoto(session);
      SE.select?.();
      if (!reduce()) { root.classList.remove("flash"); void root.offsetWidth; root.classList.add("flash"); }
      showLines([{ who: null, text: shot.ok ? `スマホで一枚撮った。「${shot.entry.caption}」` : "アルバムがいっぱいだ。図鑑から整理できる。" }]);
      if (panel === "book") openPanel("book");
    }
    function order(id) {
      if (done || !isCurrent()) return;
      const price = recordOrder(value, id, budget.spendableMoney(value), value.day);
      if (!price) { openPanel("shop"); return; }
      stats.addMoney(-price);
      store.save();
      SE.money?.();
      openPanel("shop");
      showLines([{ who: null, text: `${itemName(id)}を注文した。明日、mukaiに届く。` }]);
    }

    // 猫に触れる: タップで撫でる。押したままゆっくり動かしても撫でる（精度や筆圧は見ない）。
    let stroke = null;
    let lastStroke = 0;
    hit.addEventListener("pointerdown", event => {
      stroke = { x: event.clientX, y: event.clientY, dist: 0, moved: false };
      try { hit.setPointerCapture(event.pointerId); } catch { /* noop */ }
    });
    hit.addEventListener("pointermove", event => {
      if (!stroke) return;
      stroke.dist += Math.hypot(event.clientX - stroke.x, event.clientY - stroke.y);
      stroke.x = event.clientX; stroke.y = event.clientY;
      const now = performance.now();
      if (stroke.dist > 70 && now - lastStroke > 900) { lastStroke = now; stroke.dist = 0; stroke.moved = true; act("pet"); }
    });
    hit.addEventListener("pointerup", () => { if (stroke && !stroke.moved) act("pet"); stroke = null; });
    hit.addEventListener("pointercancel", () => { stroke = null; });
    hit.addEventListener("click", event => { if (event.detail === 0) act("pet"); }); // キーボード（Enter・Space）

    // ---- 小窓（もようがえ・通販・図鑑） ----------------------------------------------------------
    function openPanel(kind) {
      if (done) return;
      panel = kind;
      const body = kind === "arrange" ? arrangeBody() : kind === "shop" ? shopBody() : bookBody();
      const title = { arrange: "もようがえ", shop: "通販（スマホ）", book: "しぐさ図鑑とアルバム" }[kind];
      panelHost.replaceChildren(el("div.tt-panel.panel", { role: "dialog", "aria-label": title, dataset: { test: `tt-panel-${kind}` } }, [
        el("h3", { text: title }), body,
        el("button.btn.small.tt-panel-close", { type: "button", text: "閉じる", dataset: { test: "tt-panel-close" }, onclick: closePanel }),
      ]));
      panelHost.querySelector(".tt-panel-close")?.focus({ preventScroll: true });
    }
    function closePanel() {
      SE.cancel?.();
      panel = null;
      panelHost.replaceChildren();
      schedule(1200);
    }
    function arrangeBody() {
      const owned = PROPS.filter(prop => session.owned.has(prop.id));
      const waiting = pendingOrders(tetsukoRecord(value), value.day);
      return el("div.tt-arrange", [
        ...SLOTS.map(slot => el("div.tt-arrange-row", [
          el("span.tt-arrange-label", { text: slot.label }),
          el("div.tt-arrange-options", [null, ...owned.filter(prop => prop.slots.includes(slot.id)).map(prop => prop.id)].map(id =>
            el("button.btn.small", { type: "button", text: id ? itemName(id) : "なし", "aria-pressed": String(session.layout[slot.id] === id),
              dataset: { test: `tt-place-${slot.id}-${id || "none"}` },
              onclick: () => { const result = arrange(session, slot.id, id); if (!result) return; SE.click?.(); renderProps(); apply(result); openPanel("arrange"); } }))),
        ])),
        el("p.tt-note", { text: waiting.length ? `届くのを待っている物: ${waiting.map(order => itemName(order.id)).join("、")}（明日、mukaiに届く）`
          : "置いた物で、てつこの過ごし方が変わる。良し悪しはない。" }),
      ]);
    }
    function shopBody() {
      const money = budget.spendableMoney(value);
      const rec = tetsukoRecord(value);
      return el("div.tt-shop", [
        el("p.tt-note", { text: `専門店は近くにないので、スマホの通販で頼む。注文した次の日に、mukaiへ届く。　所持金 ${money.toLocaleString("ja-JP")}円` }),
        el("div.tt-shop-list", CATALOG.map(item => {
          const status = orderStatus(value, item.id, money, value.day);
          const extra = item.id === TREAT.id ? `（手元に${Math.max(0, session.treatsLeft)}本）` : "";
          return el("div.tt-shop-item", { dataset: { item: item.id, status: status.status } }, [
            el("div.tt-shop-text", [el("b", { text: item.name }), el("small", { text: `${item.desc}${extra}` })]),
            el("button.btn.small", { type: "button", disabled: !status.ok, dataset: { test: `tt-order-${item.id}` },
              text: status.ok || status.status === "short" ? `${status.price.toLocaleString("ja-JP")}円` : status.why,
              title: status.why || "", onclick: () => order(item.id) }),
          ]);
        })),
        el("p.tt-note.small", { text: `注文済み ${pendingOrders(rec, value.day).length}件　小物は一度買えば無くならない。` }),
      ]);
    }
    function bookBody() {
      const count = MOMENTS.filter(moment => session.found.has(moment.id)).length;
      return el("div.tt-book", [
        el("p.tt-note", { text: `見つけたしぐさ ${count} / ${MOMENTS.length}` }),
        el("ol.tt-moments", MOMENTS.map(moment => {
          const seen = session.found.has(moment.id);
          return el(`li.tt-moment${seen ? ".seen" : ""}`, { dataset: { test: `tt-moment-${moment.id}` } },
            [el("b", { text: seen ? moment.name : "？？？" }), seen ? null : el("small", { text: moment.hint })]);
        })),
        el("p.tt-note", { text: `アルバム ${session.album.length} / ${ALBUM_LIMIT}　「写真」で、今のてつこを残せる。` }),
        el("ul.tt-album", session.album.map(entry => el("li.tt-photo", [
          el("span.tt-thumb", [el("img", { src: poseUrl(entry.pose), alt: "" })]),
          el("span.tt-photo-text", [el("b", { text: entry.caption }), entry.label ? el("small", { text: entry.label }) : null]),
          el("button.btn.small.tt-photo-remove", { type: "button", text: "×", "aria-label": `${entry.caption}の写真を消す`,
            onclick: () => { removePhoto(session, entry.id); openPanel("book"); } }),
        ]))),
      ]);
    }

    // ---- 終わり -------------------------------------------------------------------------------
    const onKey = event => { if (event.key === "Escape" && panel) { event.preventDefault(); closePanel(); } };
    const abort = () => finish(true);
    function finish(aborted) {
      if (done) return;
      done = true;
      clearTimeout(autoTimer); clearTimeout(foundTimer); clearLineTimers();
      window.removeEventListener("pagehide", abort);
      window.removeEventListener("keydown", onKey);
      signal?.removeEventListener?.("abort", abort);
      const live = !aborted && isCurrent();
      if (live) leave(session);
      // 自分の画面がまだ出ていれば片付ける（親の日常ループが次に地図を描き直す）。
      if (layers.screen?.firstElementChild === root) showScreen("none", null);
      resolve(live ? sessionResult(session) : null);
    }
    window.addEventListener("pagehide", abort, { once: true });
    window.addEventListener("keydown", onKey);
    signal?.addEventListener?.("abort", abort, { once: true });

    renderProps();
    renderCat();
    renderActions();
    showScreen("tetsuko-time", root);
    const opening = openingLines(session);
    showLines(opening.lines);
    showFound(opening.found);
    schedule(Math.max(3600, opening.lines.length * 1900 + 600));
  });
}
