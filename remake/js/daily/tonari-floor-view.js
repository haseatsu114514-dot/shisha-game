// tonari フロア営業の画面。店の時間は実時間で流れ、伝票（選ぶ窓）・休止・別タブの間は止まる。
// 状態と金額は tonari-floor-model.js から読むだけで、本編の所持金・在庫・日付には触れない。
import { el, yen } from "../core/util.js";
import { showScreen, retire, toast } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { faceIconUrl } from "../core/data.js";
import { buildVersioned } from "../core/asset-version.js";
import {
  createFloorNight, floorTick, floorAct, floorTap, floorAdvice, floorResult, floorClock, floorUrgency, floorQueueUrgency,
  pickNight, floorChillFull, floorChillLength, FLOOR_TICK_MS, FLOOR_TABLE_COUNT,
} from "./tonari-floor-model.js";
import { MIXES, VERBS, CALLS, PLANS, STAY_LABEL, PRICE } from "./tonari-floor-data.js";
import { glyph, guestArt } from "./tonari-floor-art.js";

/** 検査用。manual を立てると実時間では進まず、api.tick(n) で刻みを送る。 */
export const floorTest = { manual: false, api: null };

// 採用済みの tonari 店内（16:9）に合わせた位置（絵に対する％）。seat＝客の札、plate＝卓の上の番号札。
// 専用の店内画が届いたら、絵と一緒にこの表を差し替える（asset_sources/ui/tonari-floor-20261120/README.md）。
const SPOTS = [
  { seat: [20.5, 57], plate: [25.5, 76], name: "窓際の広い卓" },
  { seat: [39.5, 43], plate: [44, 58.5], name: "ソファの卓" },
  { seat: [54, 38], plate: [55.3, 55.5], name: "奥の卓" },
  { seat: [69.5, 38.5], plate: [70.3, 55], name: "奥の小さな卓" },
  { seat: [88.5, 55], plate: [84.5, 49.5], name: "カウンター" },
];
const LAMPS = [[32.9, 17.5, 9], [37.8, 5.6, 7], [37.4, 22.7, 6], [42.5, 13, 9], [40.2, 26.5, 5], [46, 20.5, 5], [49.3, 9.5, 8],
  [52.8, 22, 5], [56.1, 16, 6], [60.2, 23.5, 8], [63.4, 14, 9], [68.8, 10.5, 6], [67.7, 25.3, 5], [72, 21.5, 5]];
const BUBBLE = {
  seat: ["seat", "ご案内"], order: ["order", "注文"], serve: ["serve", "配膳"], top: ["top", "トップ替え"],
  consult: ["consult", "相談"], bill: ["bill", "会計"], clean: ["clean", "片付け"],
};
const POP = {
  best: ["ぴったり！", "best"], near: ["悪くない", "near"], off: ["ちがうかも…", "off"], redo: ["作り直し成功", "best"], top: ["香りを替えた", "near"],
};
const MOOD_FACE = (mood) => (mood >= 80 ? "smile" : mood >= 45 ? "flat" : "frown");
const test = (key) => ({ test: `tonari-floor-${key}` });
const stars = (n) => el("span.tf-stars", { "aria-label": `星${n}つ`, dataset: { n } }, [1, 2, 3].map((i) => glyph("star", i <= n ? "on" : "off")));

function stylesheet() {
  if (document.querySelector("link[data-tonari-floor]")) return;
  const href = buildVersioned(new URL("../../css/tonari-floor.css", import.meta.url).href);
  document.head.append(el("link", { rel: "stylesheet", href, "data-tonari-floor": true }));
}

// 矢印キーは、絵の上の実際の位置に沿って卓を移る。
function spotInDirection(id, key) {
  const heading = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  if (!heading) return null;
  const [x, y] = SPOTS[id - 1].seat;
  const [hx, hy] = heading;
  let best = Infinity, target = null;
  SPOTS.forEach(({ seat: [tx, ty] }, i) => {
    const dx = (tx - x) * 16, dy = (ty - y) * 9;
    const along = dx * hx + dy * hy, across = Math.abs(dx * hy - dy * hx);
    if (along <= 0 || across > along * 1.6) return;
    const rank = along + across * 2;
    if (rank < best) { best = rank; target = i + 1; }
  });
  return target;
}

/**
 * 一晩の営業を表示して、結果（floorResult）を返す。中断・LOAD では null。
 * @param opts.art 店内の絵のURL（昼夜・天気は呼び出し側が選ぶ）
 */
export function runTonariFloor({
  seed = 0, level = 0, chapter = 1, anchor = null, rainy = false, night = false, art = null,
  // night＝夜のシフト（絵と時計・呼び名を夜にする）。昼のシフトは false
  isCurrent = () => true, signal = null,
} = {}) {
  if (signal?.aborted || !isCurrent()) return Promise.resolve(null);
  stylesheet();
  const daytime = !night;
  const plan = pickNight(level, seed, { rainy, daytime });
  let state = createFloorNight({ seed, level, chapter, anchor, rainy, daytime });
  let mode = "intro"; // intro → live ⇄ panel / pause → closing → result
  let panel = null, selected = 1, speed = 1, active = true, leaving = false, outerMenu = false;
  let carry = 0, lastAt = 0, timer = null, noteTimer = null, lastAdvice = "";
  const refs = { spots: [], sayTimers: new Map() };

  return new Promise((resolve) => {
  // ---- 骨組み（一度だけ作り、あとは sync で書き換える。作り直すと動きが途切れる） ----
  const room = el("div.tf-room", {}, [
    art ? el("img", { src: art, alt: "", decoding: "async", draggable: false }) : null,
    el("div.tf-glow", { "aria-hidden": true }, LAMPS.map(([x, y, r]) => el("i", { style: { "--x": `${x}%`, "--y": `${y}%`, "--r": r } }))),
    el("div.tf-haze", { "aria-hidden": true }, [el("i"), el("i"), el("i")]),
  ]);
  const spotsBox = el("div.tf-spots", { role: "group", "aria-label": `全${FLOOR_TABLE_COUNT}卓。矢印キーで選ぶ` });
  SPOTS.forEach((spot, i) => {
    const id = i + 1;
    const seat = el("button.tf-seat", { type: "button", dataset: test(`table-${id}`), onclick: () => tapTable(id) }, [
      el("span.tf-medal", {}, [el("span.tf-mood-ring", { "aria-hidden": true }), el("span.tf-who"), el("span.tf-face")]),
      el("span.tf-bubble"),
    ]);
    const plate = el("button.tf-plate", { type: "button", tabIndex: -1, "aria-hidden": true, onclick: () => tapTable(id) }, [
      el("b", { text: String(id) }),
    ]);
    const root = el("div.tf-spot", { dataset: { id, phase: "empty" }, style: {
      "--x": `${spot.seat[0]}%`, "--y": `${spot.seat[1]}%`, "--px": `${spot.plate[0]}%`, "--py": `${spot.plate[1]}%`,
    } }, [
      el("span.tf-smoke", { "aria-hidden": true, style: { left: `${spot.plate[0]}%`, top: `${spot.plate[1]}%` } }, [el("i"), el("i"), el("i")]),
      plate, seat, el("span.tf-say", { "aria-hidden": true }), el("span.tf-fx", { "aria-hidden": true }),
    ]);
    refs.spots.push({ root, seat, plate, who: seat.querySelector(".tf-who"), face: seat.querySelector(".tf-face"),
      bubble: seat.querySelector(".tf-bubble"), say: root.querySelector(".tf-say"), fx: root.querySelector(".tf-fx"), guestId: null, bubbleKey: "", faceKey: "" });
    spotsBox.append(root);
  });
  const stage = el("div.tf-stage", {}, [room, spotsBox]);

  const clockText = el("b", { text: "18:00" });
  const clockBar = el("i");
  const salesText = el("strong", { text: yen(0), dataset: test("sales") });
  const chillButton = el("button.tf-chill", { type: "button", dataset: test("chill"), onclick: () => useChill() }, [
    el("span.tf-chill-lamp", {}, [glyph("lamp"), el("i")]),
    el("span.tf-chill-text", {}, [el("small", { text: "店の空気" }), el("b", { text: "チルタイム" })]),
  ]);
  const top = el("header.tf-top", {}, [
    el("div.tf-clock", {}, [glyph("clock"), el("div", {}, [el("small", { text: plan.title }), clockText]), el("span.tf-clock-bar", {}, [clockBar])]),
    chillButton,
    el("div.tf-sales", {}, [el("small", { text: "店の売上" }), salesText]),
    el("button.tf-pause-button", { type: "button", "aria-label": "休止", dataset: test("pause"), onclick: () => openPause() }, [glyph("pause")]),
  ]);
  const doorList = el("div.tf-door-list");
  const door = el("aside.tf-door", { dataset: test("door") }, [el("h2", {}, [glyph("door"), el("span", { text: "入口" })]), doorList]);
  const benchNow = el("div.tf-bench-now");
  const benchLine = el("div.tf-bench-line");
  const shelf = el("div.tf-shelf");
  const kitchen = el("aside.tf-kitchen", {}, [
    el("h2", {}, [glyph("cook"), el("span", { text: "作業台" })]), benchNow, benchLine,
    el("h2", {}, [glyph("serve"), el("span", { text: "受渡棚" })]), shelf,
  ]);
  const adviceText = el("p", { dataset: test("advice") });
  const sumiFace = faceIconUrl("sumi");
  const ticker = el("button.tf-ticker", { type: "button", onclick: () => followAdvice() }, [
    sumiFace ? el("img", { src: sumiFace, alt: "スミさん", draggable: false }) : el("span.tf-ticker-name", { text: "スミ" }),
    adviceText,
  ]);
  const layer = el("div.tf-layer");
  const announce = el("p.tf-sr", { "aria-live": "polite", "aria-atomic": "true" });
  const host = el("section.tonari-floor", { "aria-label": "tonari フロア営業", dataset: { ...test("screen"), night: String(night), mode } }, [
    stage, top, door, kitchen, ticker, el("div.tf-cutin", { "aria-hidden": true }), layer, announce,
  ]);

    function settle(result) {
      if (!active) return;
      active = false;
      clearInterval(timer);
      clearTimeout(noteTimer);
      for (const t of refs.sayTimers.values()) clearTimeout(t);
      signal?.removeEventListener("abort", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("keydown", onKey);
      if (floorTest.api?.host === host) floorTest.api = null;
      retire(host);
      resolve(result);
    }
    const cancel = () => settle(null);
    const alive = () => active && isCurrent() && !signal?.aborted;

    function setMode(next) {
      mode = next;
      host.dataset.mode = next;
      const blocked = next !== "live";
      for (const node of [spotsBox, top, door, kitchen, ticker]) node.inert = blocked;
    }

    // ---- 時計 ----
    function clock() {
      if (!alive()) return cancel();
      const now = performance.now();
      const dt = Math.min(1000, now - lastAt);
      lastAt = now;
      if (mode !== "live" || document.hidden || floorTest.manual) return;
      carry += dt * speed;
      let steps = 0;
      while (carry >= FLOOR_TICK_MS) { carry -= FLOOR_TICK_MS; steps += 1; }
      if (steps) advance(steps);
    }
    function advance(steps) {
      if (!alive() || state.done) return;
      state = floorTick(state, steps);
      play(state.log);
      sync();
      if (state.done) closeNight();
    }
    function perform(action) {
      if (!alive()) return cancel();
      const next = floorAct(state, action);
      if (next === state) return false;
      state = next;
      play(state.log);
      sync();
      if (state.done) closeNight();
      return true;
    }

    // ---- 出来事の手応え ----
    function pop(id, text, kind = "") {
      const spot = refs.spots[id - 1];
      if (!spot) return;
      const node = el("span.tf-pop", { text, dataset: { kind } });
      spot.fx.append(node);
      node.addEventListener("animationend", () => node.remove(), { once: true });
      setTimeout(() => node.remove(), 1800);
    }
    function say(id, text) {
      const spot = refs.spots[id - 1];
      if (!spot || !text) return;
      spot.say.textContent = text.startsWith("（") ? text : `「${text}」`;
      spot.say.dataset.on = "true";
      clearTimeout(refs.sayTimers.get(id));
      refs.sayTimers.set(id, setTimeout(() => { spot.say.dataset.on = "false"; }, 3200));
    }
    function note(text) {
      announce.textContent = text;
    }
    function cutin(title, sub) {
      const band = host.querySelector(".tf-cutin");
      band.replaceChildren(el("b", { text: title }), sub ? el("small", { text: sub }) : "");
      band.dataset.on = "false";
      void band.offsetWidth; // 同じ帯を続けて出す時に、動きを最初からやり直す
      band.dataset.on = "true";
      setTimeout(() => { band.dataset.on = "false"; }, 1700);
    }
    function play(log) {
      for (const e of log) {
        switch (e.type) {
          case "arrive": SE.doorbell(); note(`${state.guests[e.guestId].name}が来店`); break;
          case "left": SE.miss(); toast(`${state.guests[e.guestId].name}は、待ちきれずに帰ってしまった`, { kind: "warn" }); break;
          case "seat": SE.select(); pop(e.tableId, e.quick ? "すぐご案内" : "ご案内", e.quick ? "best" : ""); break;
          case "order": SE.click(); pop(e.tableId, "伝票"); break;
          case "ready": SE.good(); note(`${e.tableId}卓の一台が仕上がった`); break;
          case "serve": {
            const [text, kind] = POP[e.grade] || POP.near;
            if (e.grade === "best" || e.grade === "redo") SE.perfect(); else if (e.grade === "off") SE.miss(); else SE.good();
            pop(e.tableId, text, kind);
            say(e.tableId, e.line);
            note(`${e.tableId}卓に提供。${text}`);
            break;
          }
          case "call": SE.tick(); note(`${e.tableId}卓から合図`); break;
          case "care":
            if (e.ok) { SE.perfect(); pop(e.tableId, e.refill ? `もう一杯 ＋${yen(PRICE.refill)}` : "いい手入れ", "best"); }
            else { SE.miss(); pop(e.tableId, "ちがったみたい", "off"); }
            say(e.tableId, e.line);
            break;
          case "callLate":
            if (!CALLS[e.call]?.quiet && e.call !== "top") { SE.miss(); pop(e.tableId, "合図を見逃した", "off"); }
            break;
          case "top": SE.select(); say(e.tableId, refs.lastLine?.(e.tableId)); break;
          case "consult": SE.select(); break;
          case "billReady": SE.tick(); break;
          case "bill":
            SE.money();
            pop(e.tableId, `＋${yen(e.total)}`, "coin");
            if (e.by === "sumi" && !state.done) note(`${e.tableId}卓はスミさんが会計`);
            break;
          case "clean": SE.pour(); pop(e.tableId, "ぴかぴか", ""); break;
          case "chillFull": SE.jingle(); note("チルタイムを使える"); break;
          case "chillStart": SE.just(); SE.whoosh(); cutin("チルタイム", "店じゅうが、いい煙"); break;
          default: break;
        }
      }
    }
    refs.lastLine = (id) => state.tables[id - 1]?.line;

    // ---- 画面の書き換え ----
    function bubbleFor(table, tap) {
      if (tap === "care") {
        const call = CALLS[table.call.type];
        return state.hint === "said" ? [table.call.type, call.label, true] : ["alert", "合図", true];
      }
      if (BUBBLE[tap]) return [...BUBBLE[tap], true];
      if (table.phase === "wait" || table.delivery) {
        return ["cook", state.bench?.tableId === table.id ? "仕込み中" : "順番待ち", false];
      }
      return null;
    }
    function syncSpot(spot, table) {
      const guest = table.guestId ? state.guests[table.guestId] : null;
      const tap = floorTap(state, table.id);
      const bubble = bubbleFor(table, tap);
      const urgency = floorUrgency(state, table.id);
      Object.assign(spot.root.dataset, {
        phase: table.phase, tap, act: String(!!bubble?.[2]), smoke: String(table.phase === "enjoy" && !table.delivery),
        urgent: urgency > 0.66 ? "high" : urgency > 0.33 ? "mid" : "", selected: String(selected === table.id),
      });
      spot.root.style.setProperty("--urge", urgency.toFixed(3));
      spot.root.style.setProperty("--mood", (table.mood / 100).toFixed(3));
      if (spot.guestId !== (guest?.id || null)) {
        spot.guestId = guest?.id || null;
        spot.who.replaceChildren(guest ? guestArt(guest) : "");
        spot.say.dataset.on = "false";
      }
      const faceKey = guest && table.phase !== "dirty" ? MOOD_FACE(table.mood) : "";
      if (spot.faceKey !== faceKey) {
        spot.faceKey = faceKey;
        spot.face.replaceChildren(faceKey ? glyph(faceKey) : "");
        spot.root.dataset.mood = faceKey;
      }
      const key = bubble ? bubble.join("/") : "";
      if (spot.bubbleKey !== key) {
        spot.bubbleKey = key;
        spot.bubble.replaceChildren(...(bubble ? [el("span.tf-urge", { "aria-hidden": true }), glyph(bubble[0]), el("b", { text: bubble[1] })] : []));
        spot.bubble.dataset.on = String(!!bubble);
      }
      const status = bubble ? bubble[1] : table.phase === "enjoy" ? "くつろいでいる" : table.phase === "empty" ? "空席" : "";
      spot.seat.setAttribute("aria-label", `${table.id}卓 ${SPOTS[table.id - 1].name}、${guest ? `${guest.name}、` : ""}${status}`);
      spot.seat.tabIndex = selected === table.id ? 0 : -1;
    }
    function syncDoor() {
      const key = state.queue.map((q) => q.id).join(",");
      if (doorList.dataset.key !== key) {
        doorList.dataset.key = key;
        doorList.replaceChildren(...state.queue.slice(0, 3).map((entry) => {
          const guest = state.guests[entry.id];
          return el("div.tf-door-chip", { dataset: { id: entry.id }, title: guest.name }, [
            el("span.tf-urge", { "aria-hidden": true }), guestArt(guest), el("small", { text: `${guest.party}名` }),
          ]);
        }), state.queue.length > 3 ? el("small.tf-door-more", { text: `ほか${state.queue.length - 3}組` }) : "");
      }
      door.dataset.waiting = String(state.queue.length);
      for (const chip of doorList.querySelectorAll(".tf-door-chip")) {
        const entry = state.queue.find((q) => q.id === chip.dataset.id);
        if (entry) chip.style.setProperty("--urge", floorQueueUrgency(state, entry).toFixed(3));
      }
    }
    function syncKitchen() {
      const job = state.bench;
      const nowKey = job ? `${job.tableId}/${job.mixId}` : "";
      if (benchNow.dataset.key !== nowKey) {
        benchNow.dataset.key = nowKey;
        benchNow.replaceChildren(...(job
          ? [el("b", { text: `${job.tableId}卓` }), el("span", { text: MIXES[job.mixId].label }), el("i.tf-bar", {}, [el("i")])]
          : [el("span.tf-empty", { text: "空き" })]));
      }
      if (job) benchNow.querySelector(".tf-bar i").style.width = `${Math.round((1 - job.left / job.total) * 100)}%`;
      benchNow.dataset.blocked = String(!!job && job.left <= 0);
      const lineKey = state.line.map((j) => j.tableId).join(",");
      if (benchLine.dataset.key !== lineKey) {
        benchLine.dataset.key = lineKey;
        benchLine.replaceChildren(...state.line.map((j, i) => el("button.tf-ticket", {
          type: "button", text: `${j.tableId}卓`, disabled: i === 0, title: i ? "先に作る" : "次に作る",
          "aria-label": `${j.tableId}卓の伝票${i ? "。押すと先に作る" : "。次に作る"}`,
          onclick: () => { if (perform({ type: "rush", tableId: j.tableId })) SE.select(); },
        })));
      }
      const shelfKey = state.shelf.map((j) => j.tableId).join(",");
      if (shelf.dataset.key !== shelfKey) {
        shelf.dataset.key = shelfKey;
        shelf.replaceChildren(...[0, 1].map((i) => {
          const item = state.shelf[i];
          return item
            ? el("button.tf-shelf-item", { type: "button", text: `${item.tableId}卓へ`, dataset: test(`shelf-${item.tableId}`),
              onclick: () => tapTable(item.tableId) })
            : el("span.tf-shelf-item.empty", { text: "空き" });
        }));
      }
    }
    function sync() {
      state.tables.forEach((table, i) => syncSpot(refs.spots[i], table));
      syncDoor();
      syncKitchen();
      clockText.textContent = floorClock(state);
      clockBar.style.width = `${Math.min(100, (state.t / state.length) * 100).toFixed(1)}%`;
      salesText.textContent = yen(state.sales);
      const chillOn = state.chillLeft > 0;
      const full = state.chill >= floorChillFull;
      host.dataset.chill = chillOn ? "on" : full ? "ready" : "";
      chillButton.disabled = !full || chillOn;
      chillButton.style.setProperty("--fill", chillOn ? (state.chillLeft / floorChillLength).toFixed(3) : (state.chill / floorChillFull).toFixed(3));
      chillButton.setAttribute("aria-label", chillOn ? "チルタイム中" : full ? "チルタイムを使う" : `店の空気 ${Math.round(state.chill)}パーセント`);
      const advice = floorAdvice(state);
      if (advice.text !== lastAdvice) {
        lastAdvice = advice.text;
        adviceText.textContent = advice.text;
        ticker.dataset.kind = advice.kind;
      }
      ticker.dataset.table = advice.tableId || "";
    }

    // ---- 操作 ----
    function select(id, focus = false) {
      selected = id;
      for (const spot of refs.spots) {
        spot.root.dataset.selected = String(spot.root.dataset.id === String(id));
        spot.seat.tabIndex = spot.root.dataset.id === String(id) ? 0 : -1;
      }
      if (focus) refs.spots[id - 1].seat.focus({ preventScroll: true });
    }
    function tapTable(id) {
      if (!alive() || mode !== "live") return;
      select(id);
      const tap = floorTap(state, id);
      const table = state.tables[id - 1];
      if (["seat", "serve", "bill", "clean"].includes(tap)) { perform({ type: tap, tableId: id }); return; }
      if (["order", "care", "top", "consult"].includes(tap)) { openPanel(tap, id); return; }
      const guest = table.guestId ? state.guests[table.guestId] : null;
      SE.click();
      if (!guest) pop(id, "空席");
      else if (table.phase === "wait") pop(id, state.bench?.tableId === id ? "仕込み中" : "順番待ち");
      else pop(id, "くつろいでいる");
    }
    function followAdvice() {
      const id = Number(ticker.dataset.table);
      if (mode !== "live") return;
      if (ticker.dataset.kind === "chillReady") return useChill();
      if (id) select(id, true);
    }
    function useChill() {
      if (mode !== "live") return;
      if (!perform({ type: "chill" })) SE.error();
    }

    // ---- 伝票（選ぶ窓）。開いている間、店の時間は止まる ----
    function option(label, noteText, onPick, { icon = null, primary = false, key = "" } = {}) {
      return el("button.tf-option", { type: "button", onclick: onPick, dataset: { ...test(`option${key ? "-" + key : ""}`), primary: String(primary) } }, [
        icon ? glyph(icon) : null,
        el("span", {}, [el("b", { text: label }), noteText ? el("small", { text: noteText }) : null]),
      ]);
    }
    function openPanel(kind, id) {
      panel = { kind, id };
      setMode("panel");
      renderLayer();
      layer.querySelector(".tf-option")?.focus({ preventScroll: true });
    }
    function closePanel(action = null) {
      const id = panel?.id;
      panel = null;
      setMode("live");
      renderLayer();
      if (action) perform(action); else SE.cancel();
      if (id && mode === "live") select(id, true);
    }
    function renderPanel() {
      const table = state.tables[panel.id - 1];
      const guest = state.guests[table.guestId];
      const head = el("header.tf-sheet-head", {}, [
        el("span.tf-sheet-no", { text: `${table.id}卓` }), guestArt(guest),
        el("div", {}, [el("h2#tf-sheet-title", { text: guest.name }), el("small", { text: `${guest.party}名・${STAY_LABEL[guest.stay]}${guest.party > 1 ? "・一台をシェア" : ""}` })]),
      ]);
      let lead, options, kindLabel;
      if (panel.kind === "order") {
        kindLabel = "ご注文";
        lead = el("p.tf-sheet-quote", { text: `「${guest.quote}」` });
        options = guest.options.map((mixId, i) => option(MIXES[mixId].label, MIXES[mixId].note,
          () => closePanel({ type: "order", tableId: table.id, mixId }), { key: `mix-${i}` }));
      } else if (panel.kind === "care") {
        const call = CALLS[table.call.type];
        kindLabel = "合図";
        lead = el("p.tf-sheet-quote", { dataset: { sight: String(state.hint === "sight") },
          text: state.hint === "said" ? (call.quiet ? call.sight : `「${call.said}」`) : call.sight });
        options = VERBS.map((verb, i) => option(verb.label, verb.note,
          () => closePanel({ type: "care", tableId: table.id, verb: verb.id }), { icon: verb.id, key: verb.id }));
        options.forEach((node, i) => { node.dataset.digit = String(i + 1); });
      } else if (panel.kind === "top") {
        const best = MIXES[guest.best];
        const next = MIXES[`${best.family}:${1 - best.index}`];
        kindLabel = "トップ替え";
        lead = el("p.tf-sheet-quote", { text: "「次は、違う香りも試してみたいな」" });
        options = [
          option(`${next.label}に替える`, `${yen(PRICE.top)}・もう一度仕込む`, () => closePanel({ type: "top", tableId: table.id, accept: true }), { icon: "top", key: "accept" }),
          option("今日は見送る", "手が回らない時は、断ってよい", () => closePanel({ type: "top", tableId: table.id, accept: false }), { icon: "leave", key: "decline" }),
        ];
      } else {
        kindLabel = "ご相談";
        lead = el("p.tf-sheet-quote", { text: `「${table.line}」` });
        options = [
          ...guest.options.filter((mixId) => mixId !== table.mixId && !table.redoUsed).map((mixId, i) => option(`${MIXES[mixId].label}で作り直す`, `お代はそのまま・${MIXES[mixId].note}`,
            () => closePanel({ type: "consult", tableId: table.id, mixId }), { icon: "cook", key: `redo-${i}` })),
          option("台代を外す", "席と飲み物だけいただく", () => closePanel({ type: "consult", tableId: table.id }), { icon: "bill", key: "waive" }),
        ];
      }
      const said = panel.kind === "order" ? null : el("p.tf-sheet-said", { text: `ご注文：「${guest.quote}」` });
      return el("section.tf-sheet", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-sheet-title", dataset: { ...test("sheet"), kind: panel.kind } }, [
        el("div.tf-sheet-paper", {}, [
          el("span.tf-sheet-kind", { text: kindLabel }), head, lead, panel.kind === "consult" || panel.kind === "top" ? said : null,
          el("div.tf-options", { dataset: { count: options.length } }, options),
          el("footer.tf-sheet-foot", {}, [
            el("small", { text: "伝票を見ている間、店の時間は止まっています" }),
            el("button.tf-link", { type: "button", text: "あとで", dataset: test("sheet-later"), onclick: () => closePanel() }),
          ]),
        ]),
      ]);
    }

    // ---- 開店前・休止・締め ----
    function renderIntro() {
      const start = (planId = null) => {
        if (!alive()) return cancel();
        if (planId) state = createFloorNight({ seed, level, chapter, anchor, rainy, daytime, plan: planId });
        SE.select();
        setMode("live");
        renderLayer();
        lastAt = performance.now();
        sync();
        cutin("営業開始", plan.title);
        select(1, true);
      };
      const how = [
        ["seat", "卓を押して、案内・配膳・会計・片付け"],
        ["order", "注文と合図は、言葉や様子を読んで選ぶ"],
        ["lamp", "いい接客で灯りが溜まると、チルタイム"],
      ];
      return el("section.tf-intro", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-intro-title", dataset: test("intro") }, [
        el("div.tf-intro-card", {}, [
          el("p.tf-eyebrow", { text: "tonari・フロア営業" }),
          el("h2#tf-intro-title", { text: plan.title }),
          el("p.tf-forecast", { text: `今日の予報：${plan.forecast}` }),
          el("ul.tf-how", {}, how.map(([icon, text]) => el("li", {}, [glyph(icon), el("span", { text })]))),
          level >= 2
            ? el("div.tf-plans", {}, [
              el("p", { text: "始める前に、今日の段取りを一つ決める" }),
              el("div.tf-options", { dataset: { count: PLANS.length } }, PLANS.map((p) => option(p.label, p.note, () => start(p.id), { key: `plan-${p.id}` }))),
            ])
            : el("div.tf-options", { dataset: { count: 1 } }, [option("フロアに出る", "店の時間が流れはじめる", () => start(), { primary: true, key: "start" })]),
          el("small.tf-intro-note", { text: "選ぶ窓を開いている間と休止中は、時間が止まります。店の売上は、はじめの所持金には入りません。" }),
        ]),
      ]);
    }
    function openPause(kind = "pause") {
      if (mode !== "live" && mode !== "pause") return;
      panel = { kind };
      setMode("pause");
      renderLayer();
      layer.querySelector(".tf-option")?.focus({ preventScroll: true });
    }
    function resume() {
      panel = null;
      setMode("live");
      renderLayer();
      lastAt = performance.now();
      select(selected, true);
    }
    async function gameMenu() {
      if (outerMenu || !alive()) return;
      outerMenu = true;
      layer.inert = true;
      try {
        const { openMenu } = await import("./menu.js");
        if (!alive()) return;
        await openMenu({
          tab: "system", canSave: () => false, current: () => alive(),
          // 営業の途中を保存しない。離れる時は、画面だけ片付けて勤務前の保存へ戻る。
          leave: () => { leaving = true; retire(host); },
          saveRule: "営業中は保存しません。最後に保存した勤務前の場所から再開できます。",
        });
      } catch {
        if (alive()) toast("本編メニューを開けませんでした。", { kind: "warn" });
      } finally {
        if (!leaving) { outerMenu = false; layer.inert = false; layer.querySelector(".tf-option")?.focus({ preventScroll: true }); }
      }
    }
    function renderPause() {
      const leave = panel.kind === "delegate";
      return el("section.tf-pause", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-pause-title", dataset: test(leave ? "delegate-panel" : "pause-panel") }, [
        el("div.tf-intro-card", {}, [
          el("p.tf-eyebrow", { text: "tonari" }),
          el("h2#tf-pause-title", { text: leave ? "残りをスミさんに任せる？" : "ひと休み" }),
          el("p", { text: leave
            ? "提供済みの卓だけ会計して、残りはスミさんに引き継ぎます。日当は変わりませんが、今回の評価は下がります。"
            : "休止中は、店の時間が止まっています。" }),
          el("div.tf-options", { dataset: { count: leave ? 2 : 4 } }, leave ? [
            option("営業に戻る", "", resume, { primary: true, key: "resume" }),
            option("引き継いで締める", "", () => { panel = null; setMode("live"); renderLayer(); perform({ type: "finish" }); }, { key: "confirm-delegate" }),
          ] : [
            option("つづける", "", resume, { primary: true, key: "resume" }),
            option(speed === 1 ? "ゆっくりにする" : "ふつうの速さに戻す", speed === 1 ? "店の時間が遅くなる" : "今はゆっくり",
              () => { speed = speed === 1 ? 0.6 : 1; SE.select(); renderLayer(); layer.querySelector('[data-test="tonari-floor-option-speed"]')?.focus({ preventScroll: true }); }, { key: "speed" }),
            option("残りを任せる", "スミさんに引き継いで締める", () => openPause("delegate"), { key: "delegate" }),
            option("本編メニュー", "", gameMenu, { key: "menu" }),
          ]),
        ]),
      ]);
    }
    function closeNight() {
      if (mode === "closing" || mode === "result") return;
      panel = null;
      setMode("closing");
      renderLayer();
      cutin("営業終了", state.closing === "handoff" ? "残りはスミさんへ" : "おつかれさまでした");
      SE.doorbell();
      const show = () => {
        if (!alive()) return cancel();
        setMode("result");
        renderLayer();
        const result = floorResult(state);
        setTimeout(() => { if (active) { SE.stamp(); if (result.rank === "S") SE.fanfare(); else if (result.rank === "A") SE.jingle(); } }, 380);
        layer.querySelector('[data-test="tonari-floor-option-continue"]')?.focus({ preventScroll: true });
      };
      if (floorTest.manual) show(); else setTimeout(show, 1500);
    }
    function renderResult() {
      const result = floorResult(state);
      const tag = (row) => row.missed ? "お迎えできず" : row.unserved ? "引き継ぎ" : "";
      return el("section.tf-result", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-result-title", dataset: { ...test("result"), rank: result.rank } }, [
        el("div.tf-slip", {}, [
          el("p.tf-eyebrow", { text: `${result.title}・締めの伝票` }),
          el("div.tf-slip-top", {}, [
            el("div", {}, [el("h2#tf-result-title", { text: "店の売上" }), el("strong", { text: yen(result.sales), dataset: test("final-sales") })]),
            el("div.tf-stamp", { dataset: { ...test("rank"), rank: result.rank } }, [el("b", { text: result.stamp })]),
          ]),
          el("ul.tf-slip-rows", { "aria-label": "組ごとの満足" }, result.groups.map((row) => el("li", { dataset: { lost: String(!!(row.missed || row.unserved)) } }, [
            el("span", { text: `${row.name}（${row.party}名）` }),
            tag(row) ? el("small", { text: tag(row) }) : null,
            row.missed ? el("span.tf-stars", { text: "—" }) : stars(row.stars),
          ]))),
          el("p.tf-slip-counts", { text: `ぴったりの一台 ${result.counts.best}組・いい手入れ ${result.counts.care}回・チルタイム ${result.chillCount}回` }),
          el("p.tf-slip-sumi", {}, [
            sumiFace ? el("img", { src: sumiFace, alt: "", draggable: false }) : null,
            el("span", { text: `スミ「${result.comment}」` }),
          ]),
          el("p.tf-slip-bonus", { dataset: { none: String(!result.bonus) }, text: result.bonus
            ? `店からの売上ボーナス ＋${yen(result.bonus)}` : "今回の売上ボーナスはなし" }),
          el("small.tf-intro-note", { text: "日当は、いつもどおり別にもらえます。" }),
          el("div.tf-options", { dataset: { count: 1 } }, [
            option("シフトを終える", "", () => settle(alive() ? result : null), { primary: true, key: "continue" }),
          ]),
        ]),
      ]);
    }
    function renderLayer() {
      if (!alive()) return cancel();
      const node = mode === "intro" ? renderIntro() : mode === "panel" ? renderPanel() : mode === "pause" ? renderPause()
        : mode === "result" ? renderResult() : null;
      layer.replaceChildren(node || "");
      layer.dataset.on = String(!!node);
    }

    // ---- 入力 ----
    function onVisibility() {
      if (document.hidden && mode === "live" && active && host.isConnected) openPause();
    }
    function onKey(event) {
      if (!active || outerMenu) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (mode === "panel") closePanel();
        else if (mode === "pause") resume();
        else if (mode === "live") openPause();
        return;
      }
      if (mode === "live") {
        if (event.key === "c" || event.key === "C") { event.preventDefault(); useChill(); return; }
        if (event.target instanceof HTMLButtonElement && event.target.classList.contains("tf-seat")) {
          const next = spotInDirection(selected, event.key);
          if (next) { event.preventDefault(); SE.click(); select(next, true); }
        }
        return;
      }
      const buttons = [...layer.querySelectorAll("button")];
      if (/^[1-9]$/.test(event.key)) {
        const hit = layer.querySelector(`.tf-option[data-digit="${event.key}"]`);
        if (hit) { event.preventDefault(); hit.click(); }
      } else if (event.key === "Tab" && buttons.length) {
        const edge = event.shiftKey ? buttons[0] : buttons.at(-1);
        if (document.activeElement === edge || !layer.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? buttons.at(-1) : buttons[0]).focus();
        }
      } else if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) {
        const options = [...layer.querySelectorAll(".tf-option")];
        const at = options.indexOf(document.activeElement);
        if (options.length && at >= 0) {
          event.preventDefault();
          const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
          options[(at + step + options.length) % options.length].focus();
        }
      }
    }

    signal?.addEventListener("abort", cancel, { once: true });
    document.addEventListener("visibilitychange", onVisibility);
    host.addEventListener("keydown", onKey);
    floorTest.api = {
      host, state: () => state, mode: () => mode,
      tick: (n = 1) => { if (mode === "live") advance(n); },
      act: (action) => perform(action),
    };
    setMode("intro");
    sync();
    renderLayer();
    showScreen("tonari-floor", host);
    lastAt = performance.now();
    timer = setInterval(clock, 100);
    requestAnimationFrame(() => {
      if (active && host.isConnected && !host.contains(document.activeElement)) layer.querySelector(".tf-option")?.focus({ preventScroll: true });
    });
  });
}
