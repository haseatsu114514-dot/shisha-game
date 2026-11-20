// tonari フロア営業の画面。店の時間は実時間で流れ、接客ビュー（卓へ寄って選ぶ）・休止・別タブの間は止まる。
// 画面の構成: 上＝店の時計・残り時間・売上／左右＝入口の列・作業台／卓の上＝卓の札（用件・客・顔・コース・滞在の残り）／
//   下＝選んでいる卓のドック・出来事とスミさんの一言・ボーナスタイム。
// 卓を押して選ぶ場面（注文・合図・相談・会計）は、店内がその卓へ寄り、左に選択肢の列、下に客の様子が出る。
// 状態と金額は tonari-floor-model.js から読むだけで、本編の所持金・在庫・日付には触れない。
import { el, yen } from "../core/util.js";
import { showScreen, clearScreen, retire, toast } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { faceIconUrl } from "../core/data.js";
import { buildVersioned } from "../core/asset-version.js";
import {
  createFloorNight, floorTick, floorAct, floorTap, floorAdvice, floorResult, floorClock, floorUrgency, floorQueueUrgency,
  floorStayLeft, floorTimeLeft, floorFace, floorSendOff, floorBill, floorWaitLeft,
  pickNight, floorAirFull, floorBonusTimeLength, FLOOR_TICK_MS, FLOOR_TABLE_COUNT,
} from "./tonari-floor-model.js";
import { MIXES, VERBS, CALLS, SENDS, PLANS, STAY_LABEL, PRICE } from "./tonari-floor-data.js";
import { glyph, guestArt } from "./tonari-floor-art.js";
import { FLOOR_ART, artUrl, currentStage, spotCenter } from "./tonari-floor-stage.js";

/**
 * 検査用。manual を立てると実時間では進まず、api.tick(n) で刻みを送る。
 * verdictMs＝判定の印を見せる長さ（ミリ秒）。省くと実時間では1秒、manual では0（すぐ閉じる）。
 */
export const floorTest = { manual: false, api: null, verdictMs: null };

// 卓の札の上に出る用件: [記号, 言葉]
const BUBBLE = {
  seat: ["seat", "ご案内"], order: ["order", "注文"], serve: ["serve", "配膳"],
  consult: ["consult", "相談"], bill: ["bill", "会計"], clean: ["clean", "片付け"],
};
// 卓の札に出すコースの短い呼び名（札の幅に収める）
const TAG_STAY = { short: "短め", normal: "ふつう", long: "長め" };
const DOOR_SLOTS = 3;
const SALES_STEP = 5000; // 店の売上がこの額をまたぐたびに、下の帯で知らせる
// 提供した時の手応え: [言葉, 色, 判定の印]
const POP = {
  best: ["ぴったり！", "best", "best"], near: ["悪くない", "near", "good"], off: ["ちがうかも…", "off", "miss"],
  redo: ["作り直し成功", "best", "best"], top: ["香りを替えた", "near", "good"],
};
const MARK = { best: "markBest", good: "markGood", miss: "markMiss", bad: "markBad" };
const SEND_ICON = { extend: "top", thanks: "bill", sorry: "talk" };
const SEND_BLOCKED = { used: "トップ替えは一卓に一度まで", late: "そろそろ閉店", none: "今日は誘えない" };
const quoted = (text) => (text.startsWith("（") ? text : `「${text}」`);
const test = (key) => ({ test: `tonari-floor-${key}` });
const stars = (n) => el("span.tf-stars", { "aria-label": `星${n}つ`, dataset: { n } }, [1, 2, 3].map((i) => glyph("star", i <= n ? "on" : "off")));

function stylesheet() {
  if (document.querySelector("link[data-tonari-floor]")) return;
  const href = buildVersioned(new URL("../../css/tonari-floor.css", import.meta.url).href);
  document.head.append(el("link", { rel: "stylesheet", href, "data-tonari-floor": true }));
}

// 矢印キーは、絵の上の実際の位置に沿って卓を移る。
function spotInDirection(spots, id, key) {
  const heading = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
  if (!heading) return null;
  const [x, y] = spotCenter(spots[id - 1]);
  const [hx, hy] = heading;
  let best = Infinity, target = null;
  spots.map(spotCenter).forEach(([tx, ty], i) => {
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
  // stage＝店内の絵と位置（省くと tonari-floor-stage.js の今の舞台）。guests・props＝絵の登録（検査と配置図で差し替える）
  stage = null, guests = FLOOR_ART.guests, props = FLOOR_ART.props,
  isCurrent = () => true, signal = null,
} = {}) {
  if (signal?.aborted || !isCurrent()) return Promise.resolve(null);
  stylesheet();
  const layout = currentStage(stage);
  const SPOTS = layout.spots;
  const seated = layout.style === "seated";
  // 専用の店内画は昼夜の絵を自分で持つ。会話用の店内画（classic）は呼び出し側が渡した絵を敷く
  const roomArt = layout.art ? artUrl(night ? layout.art.night : layout.art.day) : art;
  const frontArt = layout.art ? artUrl(night ? layout.art.frontNight : layout.art.frontDay) : null;
  const shishaArt = artUrl(props?.shisha);
  const daytime = !night;
  const plan = pickNight(level, seed, { rainy, daytime });
  const total = plan.cast.length;
  let state = createFloorNight({ seed, level, chapter, anchor, rainy, daytime });
  let mode = "intro"; // intro → live ⇄ panel / pause → closing → result
  let panel = null, selected = 1, speed = 1, active = true, leaving = false, outerMenu = false;
  let carry = 0, lastAt = 0, timer = null, bannerTimer = null, verdictTimer = null, lastAdvice = "", salesMark = 0;
  const refs = { spots: [] };

  return new Promise((resolve) => {
    // ---- 骨組み（一度だけ作り、あとは sync で書き換える。作り直すと動きが途切れる） ----
    const room = el("div.tf-room", {}, [
      roomArt ? el("img", { src: roomArt, alt: "", decoding: "async", draggable: false }) : null,
      el("div.tf-glow", { "aria-hidden": true }, layout.lamps.map(([x, y, r]) => el("i", { style: { "--x": `${x}%`, "--y": `${y}%`, "--r": r } }))),
      el("div.tf-haze", { "aria-hidden": true }, [el("i"), el("i"), el("i")]),
    ]);
    const spotsBox = el("div.tf-spots", { role: "group", "aria-label": `全${FLOOR_TABLE_COUNT}卓。矢印キーで選ぶ` });
    SPOTS.forEach((spot, i) => {
      const id = i + 1;
      const tap = () => tapTable(id);
      // 卓のボタン（読み上げとキーボードの入口）。座る形では座った客、丸い札の舞台では卓の札と同じ所の押し所になる
      const seat = el("button.tf-seat", { type: "button", dataset: test(`table-${id}`), onclick: tap }, [
        el("span.tf-medal", {}, [el("span.tf-who")]),
      ]);
      // マウスを乗せた卓は、下のドックに様子が出る（押さなくても見られる）
      seat.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse" && mode === "live") select(id); });
      // 卓の札: 上に用件、箱の左に卓番号と客、右に顔とコース、下に滞在の残り（円）と待たせている残り秒。
      // 札と番号札も押せる（押す先は同じ卓）。読み上げとキーボードの入口は卓のボタン一つにする
      const tagWant = el("b.tf-tag-want");
      const tagWho = el("span.tf-tag-who");
      const tagFace = el("span.tf-tag-face");
      const tagCourse = el("small.tf-tag-course");
      const tagCount = el("span.tf-tag-count");
      const bubble = el("button.tf-bubble", { type: "button", tabIndex: -1, "aria-hidden": true, onclick: tap }, [
        tagWant,
        el("span.tf-tag-box", {}, [
          el("i.tf-tag-no", { text: String(id) }),
          el("span.tf-tag-cell", {}, [tagWho]),
          el("span.tf-tag-cell", {}, [tagFace, tagCourse]),
          el("span.tf-tag-empty"),
        ]),
        el("span.tf-tag-foot", {}, [el("i.tf-tag-pie"), tagCount]),
      ]);
      const plate = el("button.tf-plate", { type: "button", tabIndex: -1, "aria-hidden": true, onclick: tap }, [el("b", { text: String(id) })]);
      // 位置は舞台の表から。丸い札（medal）は札の中心を基準に、座る形（seated）は客の入る範囲・卓のマーカー・手応えを別々に持つ
      const [sx, sy] = spotCenter(spot);
      const anchor = seated
        ? { "--bx": `${spot.bubble[0]}%`, "--by": `${spot.bubble[1]}%`, "--fx": `${spot.fx[0]}%`, "--fy": `${spot.fx[1]}%` }
        : { "--x": `${sx}%`, "--y": `${sy}%`, "--bx": `${sx}%`, "--by": `calc(${sy}% + 68px)`, "--fx": `${sx}%`, "--fy": `calc(${sy}% + 104px)` };
      if (seated) Object.assign(seat.style, { left: `${spot.box[0]}%`, top: `${spot.box[1]}%`, width: `${spot.box[2]}%`, height: `${spot.box[3]}%` });
      const smokeAt = seated ? [spot.prop[0], spot.prop[1] - spot.propH * 0.86] : spot.plate;
      const prop = seated && shishaArt ? el("span.tf-prop", { "aria-hidden": true, style: {
        left: `${spot.prop[0]}%`, top: `${spot.prop[1]}%`, height: `${spot.propH}%`,
      } }, [el("img", { src: shishaArt, alt: "", decoding: "async", draggable: false })]) : null;
      const root = el("div.tf-spot", { dataset: { id, phase: "empty", row: spot.row || "", flip: String(!!spot.flip) }, style: {
        "--px": `${spot.plate[0]}%`, "--py": `${spot.plate[1]}%`, ...anchor,
      } }, [
        seat, prop,
        el("span.tf-smoke", { "aria-hidden": true, style: { left: `${smokeAt[0]}%`, top: `${smokeAt[1]}%` } }, [el("i"), el("i"), el("i")]),
        plate, bubble, el("span.tf-fx", { "aria-hidden": true }),
      ]);
      refs.spots.push({ root, seat, plate, bubble, who: seat.querySelector(".tf-who"), fx: root.querySelector(".tf-fx"),
        tagWant, tagWho, tagFace, tagCourse, tagCount, tagEmpty: bubble.querySelector(".tf-tag-empty"),
        guestId: null, bubbleKey: "", faceKey: "", countKey: "", happy: false });
      spotsBox.append(root);
    });
    // 卓の前景（卓だけを抜いた絵）。客より手前・札より奥に重ねて、座った客の膝を隠す
    if (frontArt) spotsBox.append(el("img.tf-front", { src: frontArt, alt: "", decoding: "async", draggable: false, "aria-hidden": true }));
    // 接客ビューでは、店内ごと選んだ卓へ寄る（カメラ）
    const cam = el("div.tf-cam", {}, [room, spotsBox]);
    const stageBox = el("div.tf-stage", {}, [cam]);

    // 上の帯は、左に店の時計と来店・まん中に残り時間・右に売上（経営ゲームの定石の並び）
    const clockText = el("b", { text: "0:00", dataset: test("time-left") });
    const clockNote = el("b", { text: plan.title });
    const clockBar = el("i");
    const visitText = el("b", { text: "0" });
    const salesText = el("strong", { text: yen(0), dataset: test("sales") });
    const top = el("header.tf-top", {}, [
      el("div.tf-info", {}, [clockNote, el("small.tf-visits", {}, [el("span", { text: "来店 " }), visitText])]),
      el("div.tf-clock", {}, [el("small", { text: "残り時間" }), clockText, el("span.tf-clock-bar", {}, [clockBar])]),
      el("div.tf-sales", {}, [el("small", { text: "店の売上" }), salesText]),
      el("button.tf-pause-button", { type: "button", "aria-label": "休止", dataset: test("pause"), onclick: () => openPause() }, [glyph("pause")]),
    ]);
    // 入口の列: 待っている組が上から並ぶ（枠は3つ。あふれた組は「ほか◯組」）
    const doorCount = el("b", { text: "0組" });
    const doorList = el("div.tf-door-list");
    const door = el("aside.tf-door", { dataset: test("door") }, [el("h2", {}, [glyph("door"), el("span", { text: "入口" }), doorCount]), doorList]);
    const benchNow = el("div.tf-bench-now");
    const benchLine = el("div.tf-bench-line");
    const shelf = el("div.tf-shelf");
    const kitchen = el("aside.tf-kitchen", {}, [
      el("div.tf-bench-head", {}, [el("h2", {}, [glyph("cook"), el("span", { text: "作業台" })]), benchLine]), benchNow,
      el("h2", {}, [glyph("serve"), el("span", { text: "受渡棚" })]), shelf,
    ]);
    // 下の帯: 選んでいる卓のドック（客・注文・ご利用・顔）／スミさんの一言／店の空気（ボーナスタイム）
    const dockNo = el("b.tf-dock-no");
    const dockWho = el("span.tf-dock-who");
    const dockName = el("b");
    const dockSub = el("small");
    const dockMood = el("i"), dockStay = el("i");
    const dockQuote = el("span"), dockMix = el("span");
    const dockBill = el("strong", { dataset: test("dock-bill") });
    const dockFace = el("span.tf-dock-face");
    const dockEmpty = el("p.tf-dock-empty");
    const dock = el("aside.tf-dock", { "aria-label": "選んでいる卓の様子", dataset: { ...test("dock"), on: "false" } }, [
      dockNo, dockWho,
      el("div.tf-dock-main", {}, [dockName, dockSub,
        el("div.tf-dock-bars", {}, [
          el("span", {}, [el("small", { text: "満足" }), el("i.tf-bar", { dataset: { kind: "mood" } }, [dockMood])]),
          el("span", {}, [el("small", { text: "滞在" }), el("i.tf-bar", { dataset: { kind: "stay" } }, [dockStay])]),
        ])]),
      el("div.tf-dock-req", {}, [
        el("p", {}, [el("small", { text: "ご注文" }), dockQuote]),
        el("p", {}, [el("small", { text: "一台" }), dockMix]),
      ]),
      el("div.tf-dock-bill", {}, [el("small", { text: "ご利用" }), dockBill]),
      dockFace, dockEmpty,
    ]);
    // 出来事の行（新しい行が下）と、その下にスミさんの一言
    const logLines = el("div.tf-log", { "aria-hidden": true, dataset: test("log") });
    const adviceText = el("p", { dataset: test("advice") });
    const sumiFace = faceIconUrl("sumi");
    const ticker = el("button.tf-ticker", { type: "button", onclick: () => followAdvice() }, [
      logLines,
      el("span.tf-advice", {}, [
        sumiFace ? el("img", { src: sumiFace, alt: "スミさん", draggable: false }) : el("span.tf-ticker-name", { text: "スミ" }),
        adviceText,
      ]),
    ]);
    const bonusButton = el("button.tf-bonus", { type: "button", dataset: test("bonus"), onclick: () => useBonusTime() }, [
      el("span.tf-bonus-lamp", {}, [glyph("lamp"), el("i")]),
      el("span.tf-bonus-text", {}, [el("small", { text: "店の空気" }), el("b", { text: "ボーナスタイム" }), el("i.tf-bonus-bar", {}, [el("i")])]),
    ]);
    const bottom = el("footer.tf-bottom", {}, [dock, ticker, bonusButton]);
    const layer = el("div.tf-layer");
    const banner = el("div.tf-banner", { "aria-hidden": true });
    const announce = el("p.tf-sr", { "aria-live": "polite", "aria-atomic": "true" });
    const host = el("section.tonari-floor", { "aria-label": "tonari フロア営業", dataset: {
      ...test("screen"), night: String(night), mode, stage: layout.id, style: layout.style } }, [
      stageBox, top, door, kitchen, bottom, el("div.tf-cutin", { "aria-hidden": true }), layer, banner, announce,
    ]);

    function settle(result) {
      if (!active) return;
      active = false;
      clearInterval(timer);
      clearTimeout(bannerTimer);
      clearTimeout(verdictTimer);
      signal?.removeEventListener("abort", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("keydown", onKey);
      if (floorTest.api?.host === host) floorTest.api = null;
      retire(host);
      // 営業の画面のままなら片付ける（本編のHUDが戻る）。LOAD などで別の画面に替わっていれば触らない。
      if (!leaving && host.isConnected && document.body.dataset.screen === "tonari-floor") clearScreen();
      resolve(result);
    }
    const cancel = () => settle(null);
    const alive = () => active && isCurrent() && !signal?.aborted;

    function setMode(next) {
      mode = next;
      host.dataset.mode = next;
      const blocked = next !== "live";
      for (const node of [spotsBox, top, door, kitchen, ticker, bonusButton]) node.inert = blocked;
      if (next !== "panel") cam.style.transform = "";
    }
    // 接客ビュー: 選んだ卓が、左の列と下のドックに隠れない所（画面の右寄り）へ来るように寄る
    function focusCam(id) {
      const [px, py] = spotCenter(SPOTS[id - 1]);
      const zoom = 1.3;
      const tx = Math.max(100 - 100 * zoom, Math.min(26, 68 - zoom * px));
      const ty = Math.max(-40, Math.min(0, 47 - zoom * py));
      cam.style.transform = `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) scale(${zoom})`;
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
    function pop(id, text, kind = "", mark = "") {
      const spot = refs.spots[id - 1];
      if (!spot) return;
      const node = el("span.tf-pop", { dataset: { kind } }, [mark ? glyph(MARK[mark]) : null, el("span", { text })]);
      spot.fx.append(node);
      node.addEventListener("animationend", () => node.remove(), { once: true });
      setTimeout(() => node.remove(), 1800);
    }
    // 出来事の行（下の帯。新しい行が下に入り、古い行は上へ薄れて消える）。読み上げにも同じ言葉を流す
    function log(text, tone = "") {
      if (!text) return;
      announce.textContent = text;
      logLines.append(el("p", { text, dataset: { tone } }));
      while (logLines.children.length > 2) logLines.firstElementChild.remove();
    }
    // 客のひとことは「◯卓「…」」の行にする（かっこ書きの様子は、そのまま）
    const say = (id, text, tone = "") => { if (text) log(`${id}卓${quoted(text)}`, tone); };
    // まん中の札（トップ替え・ドリンクの注文など、売上が増える出来事だけ）
    function showBanner(title, sub = "") {
      banner.replaceChildren(el("b", { text: title }), sub ? el("small", { text: sub }) : "");
      banner.dataset.on = "false";
      void banner.offsetWidth;
      banner.dataset.on = "true";
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { banner.dataset.on = "false"; }, 1400);
    }
    function cutin(title, sub) {
      const band = host.querySelector(".tf-cutin");
      band.replaceChildren(el("b", { text: title }), sub ? el("small", { text: sub }) : "");
      band.dataset.on = "false";
      void band.offsetWidth; // 同じ帯を続けて出す時に、動きを最初からやり直す
      band.dataset.on = "true";
      setTimeout(() => { band.dataset.on = "false"; }, 1700);
    }
    function play(events) {
      for (const e of events) {
        switch (e.type) {
          case "arrive": SE.doorbell(); log(`${state.guests[e.guestId].name}が来店しました`); break;
          case "left": SE.miss(); log(`${state.guests[e.guestId].name}は、待ちきれずに帰ってしまいました`, "bad"); break;
          case "seat":
            SE.select();
            pop(e.tableId, e.quick ? "すぐご案内" : "ご案内", e.quick ? "best" : "");
            log(`${state.guests[state.tables[e.tableId - 1].guestId].name}を${e.tableId}卓へお通ししました`);
            break;
          case "order": SE.click(); pop(e.tableId, "伝票"); break;
          case "ready": SE.good(); log(`${e.tableId}卓の一台が仕上がりました`); break;
          case "serve": {
            const [text, kind, mark] = POP[e.grade] || POP.near;
            if (e.grade === "best" || e.grade === "redo") SE.perfect(); else if (e.grade === "off") SE.miss(); else SE.good();
            pop(e.tableId, text, kind, mark);
            say(e.tableId, e.line, e.grade === "off" ? "bad" : e.grade === "near" ? "" : "good");
            break;
          }
          case "call": SE.tick(); log(e.call === "consult" ? `${e.tableId}卓から、ご相談です` : `${e.tableId}卓で、お客さんが呼んでいます`); break;
          case "care":
            if (e.ok) { SE.perfect(); pop(e.tableId, e.drink ? `ドリンク ＋${yen(PRICE.drink)}` : "いい手入れ", "best", "best"); }
            else { SE.miss(); pop(e.tableId, "ちがったみたい", "off", "bad"); }
            say(e.tableId, e.line, e.ok ? "good" : "bad");
            // 飲み物の合図に応えると、ドリンクの注文になる
            if (e.drink) showBanner("ドリンク、いただきました！", `ご注文 ＋${yen(PRICE.drink)}`);
            break;
          case "callLate":
            if (!CALLS[e.call]?.quiet) { SE.miss(); pop(e.tableId, "合図を見逃した", "off"); log(`${e.tableId}卓の合図を見逃しました`, "bad"); }
            break;
          case "extend":
            SE.perfect(); SE.money();
            pop(e.tableId, "トップ替え", "best", "best");
            say(e.tableId, e.line, "good");
            showBanner("トップ替え、いただきました！", `おかわり ＋${yen(PRICE.top)}`);
            break;
          case "consult": SE.select(); break;
          case "billReady": SE.tick(); log(`${e.tableId}卓がお会計です`); break;
          case "bill":
            SE.money();
            if (e.verdict === "best") SE.good();
            pop(e.tableId, `＋${yen(e.total)}`, "coin");
            if (e.line) say(e.tableId, e.line, e.verdict === "best" ? "good" : e.verdict === "miss" ? "bad" : "");
            else if (e.by === "sumi" && !state.done) log(`${e.tableId}卓は、スミさんが会計しました`);
            break;
          case "clean": SE.pour(); pop(e.tableId, "ぴかぴか", ""); break;
          case "airFull": SE.jingle(); log("店の空気が満ちました。ボーナスタイムを使えます", "good"); break;
          case "bonusTimeStart": SE.just(); SE.whoosh(); cutin("ボーナスタイム", "店じゅうが、いい煙"); break;
          default: break;
        }
      }
      // 店の売上が区切りをまたいだら知らせる
      const mark = Math.floor(state.sales / SALES_STEP);
      if (mark > salesMark && !state.done) log(`店の売上が${yen(mark * SALES_STEP)}を超えました`, "good");
      salesMark = mark;
    }
    // ---- 画面の書き換え ----
    // 卓の札の上に出る用件: [記号, 言葉, 押すと進むか, 札の色]
    function bubbleFor(table, tap) {
      if (tap === "care") {
        const call = CALLS[table.call.type];
        return state.hint === "said" ? [table.call.type, call.label, true, "act"] : ["alert", "合図", true, "act"];
      }
      if (BUBBLE[tap]) return [...BUBBLE[tap], true, "act"];
      if (table.phase === "wait" || table.delivery) {
        return ["cook", state.bench?.tableId === table.id ? "仕込み中" : "順番待ち", false, "wait"];
      }
      if (table.phase === "enjoy") return ["lamp", "くつろぎ中", false, "fine"];
      return ["", table.phase === "dirty" ? "片付け待ち" : "空席", false, "idle"];
    }
    function syncSpot(spot, table) {
      const guest = table.guestId && table.phase !== "dirty" ? state.guests[table.guestId] : null;
      const tap = floorTap(state, table.id);
      const bubble = bubbleFor(table, tap);
      const urgency = floorUrgency(state, table.id);
      const stay = floorStayLeft(state, table.id);
      Object.assign(spot.root.dataset, {
        phase: table.phase, tap, act: String(bubble[2]), tone: bubble[3], smoke: String(table.phase === "enjoy" && !table.delivery),
        served: String(table.served && (table.phase === "enjoy" || table.phase === "bill")),
        urgent: urgency > 0.66 ? "high" : urgency > 0.33 ? "mid" : "", selected: String(selected === table.id),
        leaving: String(table.phase === "enjoy" && stay > 0 && stay <= 0.3),
      });
      spot.root.style.setProperty("--urge", urgency.toFixed(3));
      spot.root.style.setProperty("--stay", stay.toFixed(3));
      spot.root.style.setProperty("--mood", (table.mood / 100).toFixed(3));
      // 満足している客は、登録があれば笑顔の絵に替える（座った絵だけ。札の顔は切り抜きなので替えない）
      const happy = seated && !!guest && table.mood >= 80;
      if (spot.guestId !== (guest?.id || null) || spot.happy !== happy) {
        if (spot.guestId !== (guest?.id || null)) {
          spot.tagWho.replaceChildren(guest ? guestArt(guest, { art: guests }) : "");
          spot.tagCourse.textContent = guest ? TAG_STAY[guest.stay] : "";
        }
        spot.guestId = guest?.id || null;
        spot.happy = happy;
        spot.who.replaceChildren(guest ? guestArt(guest, { happy, seated, art: guests }) : "");
        spot.root.dataset.party = guest ? String(guest.party) : "";
      }
      const faceKey = guest ? floorFace(table.mood) : "";
      if (spot.faceKey !== faceKey) {
        spot.faceKey = faceKey;
        spot.tagFace.replaceChildren(faceKey ? glyph(faceKey) : "");
        spot.root.dataset.mood = faceKey;
      }
      const key = bubble.join("/");
      if (spot.bubbleKey !== key) {
        spot.bubbleKey = key;
        spot.tagWant.replaceChildren(bubble[0] ? glyph(bubble[0]) : "", el("span", { text: bubble[1] }));
        spot.tagEmpty.textContent = guest ? "" : table.phase === "dirty" ? "片付け待ち" : "空席";
        spot.bubble.dataset.on = "true";
      }
      // 待たせている残り（秒）。0 になったら「！」で、満足が下がり始めている
      const left = floorWaitLeft(state, table.id);
      const countKey = left == null || !guest ? "" : left > 0 ? String(Math.ceil(left * FLOOR_TICK_MS / 1000)) : "!";
      if (spot.countKey !== countKey) {
        spot.countKey = countKey;
        spot.tagCount.replaceChildren(...(countKey ? [glyph("clock"), el("b", { text: countKey === "!" ? "！" : countKey })] : []));
        spot.tagCount.dataset.over = String(countKey === "!");
      }
      spot.seat.setAttribute("aria-label", `${table.id}卓 ${SPOTS[table.id - 1].name}、${guest ? `${guest.name}、` : ""}${bubble[1]}`);
      spot.seat.tabIndex = selected === table.id ? 0 : -1;
    }
    function syncDoor() {
      const key = state.queue.map((q) => q.id).join(",");
      if (doorList.dataset.key !== key) {
        doorList.dataset.key = key;
        doorCount.textContent = `${state.queue.length}組`;
        const chips = state.queue.slice(0, DOOR_SLOTS).map((entry) => {
          const guest = state.guests[entry.id];
          return el("div.tf-door-chip", { dataset: { id: entry.id }, title: guest.name }, [
            el("span.tf-urge", { "aria-hidden": true }), guestArt(guest, { art: guests }), el("small", { text: `${guest.party}名` }),
          ]);
        });
        while (chips.length < DOOR_SLOTS) chips.push(el("div.tf-door-slot", { "aria-hidden": true }));
        doorList.replaceChildren(...chips, state.queue.length > DOOR_SLOTS ? el("small.tf-door-more", { text: `ほか${state.queue.length - DOOR_SLOTS}組` }) : "");
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
    function syncDock() {
      const table = state.tables[selected - 1];
      const guest = table.guestId && table.phase !== "dirty" ? state.guests[table.guestId] : null;
      const key = `${selected}/${guest?.id || table.phase}`;
      if (dock.dataset.key !== key) {
        dock.dataset.key = key;
        dock.dataset.on = String(!!guest);
        dockNo.textContent = `${selected}卓`;
        dockWho.replaceChildren(guest ? guestArt(guest, { art: guests }) : "");
        dockName.textContent = guest ? guest.name : "";
        dockSub.textContent = guest ? `${guest.party}名・${STAY_LABEL[guest.stay]}` : "";
        dockQuote.textContent = guest ? `「${guest.quote}」` : "";
        dockEmpty.textContent = guest ? "" : table.phase === "dirty" ? "片付け待ち" : "空席";
      }
      if (!guest) return;
      const face = floorFace(table.mood);
      if (dock.dataset.mood !== face) { dock.dataset.mood = face; dockFace.replaceChildren(glyph(face)); }
      dockMood.style.width = `${Math.round(table.mood)}%`;
      dockStay.style.width = `${Math.round(floorStayLeft(state, selected) * 100)}%`;
      const mix = table.mixId ? `${MIXES[table.mixId].label}${table.top === "served" ? "＋トップ替え" : ""}`
        : table.delivery ? `${MIXES[table.delivery.mixId].label}（仕込み中）` : "これから";
      if (dockMix.textContent !== mix) dockMix.textContent = mix;
      const bill = yen(floorBill(state, selected)?.total || 0);
      if (dockBill.textContent !== bill) dockBill.textContent = bill;
    }
    function sync() {
      state.tables.forEach((table, i) => syncSpot(refs.spots[i], table));
      syncDoor();
      syncKitchen();
      syncDock();
      clockText.textContent = floorTimeLeft(state);
      const noteText = `${plan.title}・${floorClock(state)}`;
      if (clockNote.textContent !== noteText) clockNote.textContent = noteText;
      visitText.textContent = `${total - state.upcoming.length}／${total}組`;
      clockBar.style.width = `${Math.max(0, 100 - (state.t / state.length) * 100).toFixed(1)}%`;
      host.dataset.late = String(state.length - state.t <= 60); // 残り30秒で時計を赤くする
      if (salesText.dataset.value !== String(state.sales)) {
        if (salesText.dataset.value !== undefined) { salesText.dataset.bump = "false"; void salesText.offsetWidth; salesText.dataset.bump = "true"; }
        salesText.dataset.value = String(state.sales);
        salesText.textContent = yen(state.sales);
      }
      const bonusOn = state.bonusTimeLeft > 0;
      const full = state.air >= floorAirFull;
      host.dataset.bonus = bonusOn ? "on" : full ? "ready" : "";
      bonusButton.disabled = !full || bonusOn;
      bonusButton.style.setProperty("--fill", bonusOn ? (state.bonusTimeLeft / floorBonusTimeLength).toFixed(3) : (state.air / floorAirFull).toFixed(3));
      bonusButton.querySelector("b").textContent = bonusOn ? "ボーナスタイム中" : "ボーナスタイム";
      bonusButton.setAttribute("aria-label", bonusOn ? "ボーナスタイム中" : full ? "ボーナスタイムを使う" : `店の空気 ${Math.round(state.air)}パーセント`);
      const advice = floorAdvice(state);
      for (const spot of refs.spots) spot.root.dataset.guide = String(state.level === 0 && String(advice.tableId) === spot.root.dataset.id);
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
      syncDock();
      if (focus) refs.spots[id - 1].seat.focus({ preventScroll: true });
    }
    function tapTable(id) {
      if (!alive() || mode !== "live") return;
      select(id);
      const tap = floorTap(state, id);
      const table = state.tables[id - 1];
      if (["seat", "serve", "clean"].includes(tap)) { perform({ type: tap, tableId: id }); return; }
      if (["order", "care", "consult", "bill"].includes(tap)) { openPanel(tap, id); return; }
      const guest = table.guestId ? state.guests[table.guestId] : null;
      SE.click();
      if (!guest) pop(id, "空席");
      else if (table.delivery) pop(id, state.bench?.tableId === id ? "仕込み中" : "順番待ち");
      else pop(id, "くつろいでいる");
    }
    function followAdvice() {
      const id = Number(ticker.dataset.table);
      if (mode !== "live") return;
      if (ticker.dataset.kind === "bonusTimeReady") return useBonusTime();
      if (id) select(id, true);
    }
    function useBonusTime() {
      if (mode !== "live") return;
      if (!perform({ type: "bonusTime" })) SE.error();
    }

    // ---- 接客ビュー（卓へ寄って選ぶ）。開いている間、店の時間は止まる ----
    function option(label, noteText, onPick, { icon = null, primary = false, key = "" } = {}) {
      return el("button.tf-option", { type: "button", onclick: onPick, dataset: { ...test(`option${key ? "-" + key : ""}`), primary: String(primary) } }, [
        icon ? glyph(icon) : null,
        el("span", {}, [el("b", { text: label }), noteText ? el("small", { text: noteText }) : null]),
      ]);
    }
    function openPanel(kind, id) {
      panel = { kind, id, locked: false };
      setMode("panel");
      select(id);
      focusCam(id);
      renderLayer();
      layer.querySelector(".tf-option:not(:disabled)")?.focus({ preventScroll: true });
    }
    function closePanel({ cancel = true } = {}) {
      const id = panel?.id;
      clearTimeout(verdictTimer);
      panel = null;
      setMode("live");
      renderLayer();
      lastAt = performance.now();
      if (cancel) SE.cancel();
      if (id && mode === "live") select(id, true);
    }
    // 選んだ結果の印（◎ ○ △ ×）。合図への手入れと、会計の声かけで出す
    function verdictOf(log) {
      for (const e of log) {
        if (e.type === "care") return e.ok
          ? { mark: "best", text: e.drink ? "ドリンクのご注文！" : "いい手入れ！", line: e.line }
          : { mark: "bad", text: "ちがったみたい", line: e.line };
        if (e.type === "extend") return { mark: "best", text: "トップ替え！", line: e.line };
        if (e.type === "bill" && e.verdict) {
          return { mark: e.verdict, text: { best: "いいお見送り！", good: "お見送り", miss: "かみ合わなかった…" }[e.verdict], line: e.line };
        }
      }
      return null;
    }
    function choose(action, button) {
      if (!panel || mode !== "panel") return;
      if (panel.locked) { closePanel({ cancel: false }); return; } // 印が出ている間にもう一度押したら、先へ進む
      if (!perform(action)) { SE.error(); return; }
      if (mode !== "panel" || !panel) return; // 営業が締まった
      const verdict = verdictOf(state.log);
      if (verdict) host.dataset.verdict = verdict.mark;
      const hold = verdict ? floorTest.verdictMs ?? (floorTest.manual ? 0 : 1000) : 0;
      if (!hold) { closePanel({ cancel: false }); return; }
      panel.locked = true;
      const sheet = layer.querySelector(".tf-sheet");
      sheet.dataset.verdict = verdict.mark;
      if (button) button.dataset.picked = "true";
      sheet.querySelector(".tf-verdict").replaceChildren(glyph(MARK[verdict.mark]), el("b", { text: verdict.text }));
      if (verdict.line) sheet.querySelector(".tf-sheet-quote").textContent = quoted(verdict.line);
      verdictTimer = setTimeout(() => { if (active && panel?.locked && mode === "panel") closePanel({ cancel: false }); }, hold);
    }
    function renderPanel() {
      const table = state.tables[panel.id - 1];
      const guest = state.guests[table.guestId];
      const pick = (action) => (event) => choose(action, event.currentTarget);
      let lead, options, kindLabel, face = null, tip = "";
      if (panel.kind === "order") {
        kindLabel = "ご注文";
        lead = `「${guest.quote}」`;
        options = guest.options.map((mixId, i) => option(MIXES[mixId].label, MIXES[mixId].note,
          pick({ type: "order", tableId: table.id, mixId }), { key: `mix-${i}` }));
      } else if (panel.kind === "care") {
        const call = CALLS[table.call.type];
        kindLabel = "合図";
        lead = state.hint === "said" ? (call.quiet ? call.sight : `「${call.said}」`) : call.sight;
        options = VERBS.map((verb) => option(verb.label, verb.note,
          pick({ type: "care", tableId: table.id, verb: verb.id }), { icon: verb.id, key: verb.id }));
      } else if (panel.kind === "bill") {
        // 会計の声かけ: 客の顔を見て選ぶ。笑顔の客は、トップ替え（おかわり）に応じてくれる
        const off = floorSendOff(state, table.id);
        kindLabel = "お会計";
        face = off.face;
        lead = quoted(table.line || "お会計、お願いします");
        if (state.level < 2) tip = "顔を見て選ぶ。笑顔ならトップ替えを誘える、曇り顔にはお詫び";
        options = SENDS.map((send) => {
          const open = send.id !== "extend" || off.extend === "ok";
          const noteText = send.id !== "extend" ? send.note : open ? `${send.note}・＋${yen(PRICE.top)}` : SEND_BLOCKED[off.extend];
          const node = option(send.label, noteText, pick({ type: "bill", tableId: table.id, reply: send.id }), { icon: SEND_ICON[send.id], key: send.id });
          node.disabled = !open;
          return node;
        });
      } else {
        kindLabel = "ご相談";
        lead = `「${table.line}」`;
        options = [
          ...guest.options.filter((mixId) => mixId !== table.mixId && !table.redoUsed).map((mixId, i) => option(`${MIXES[mixId].label}で作り直す`, `お代はそのまま・${MIXES[mixId].note}`,
            pick({ type: "consult", tableId: table.id, mixId }), { icon: "cook", key: `redo-${i}` })),
          option("台代を外す", "チャージだけいただく", pick({ type: "consult", tableId: table.id }), { icon: "bill", key: "waive" }),
        ];
      }
      options.forEach((node, i) => { node.dataset.digit = String(i + 1); });
      return el("section.tf-sheet", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-sheet-title", dataset: { ...test("sheet"), kind: panel.kind } }, [
        el("div.tf-sheet-lead", { dataset: { mood: face || "" } }, [
          el("span.tf-sheet-kind", { text: kindLabel }),
          el("h2#tf-sheet-title.tf-sr", { text: `${table.id}卓 ${guest.name}、${kindLabel}` }),
          face ? el("span.tf-sheet-face", {}, [glyph(face)]) : null,
          el("p.tf-sheet-quote", { text: lead, dataset: { sight: String(panel.kind === "care" && state.hint === "sight") } }),
        ]),
        tip ? el("small.tf-sheet-tip", { text: tip }) : null,
        el("div.tf-options.tf-list", { dataset: { count: options.length } }, options),
        el("footer.tf-sheet-foot", {}, [
          el("button.tf-link", { type: "button", text: "あとで", dataset: test("sheet-later"), onclick: () => closePanel() }),
          el("small", { text: "選んでいる間、店の時間は止まります" }),
        ]),
        el("div.tf-verdict", { "aria-hidden": true }),
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
        ["seat", "卓を押して、案内・配膳・片付け"],
        ["order", "注文と合図は、言葉や様子を読んで選ぶ"],
        ["bill", "会計は、客の顔を見て声をかける"],
        ["lamp", "いい接客で灯りが溜まると、ボーナスタイム"],
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
          el("small.tf-intro-note", { text: "卓で選んでいる間と休止中は、時間が止まります。店の売上は、はじめの所持金には入りません。" }),
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
      clearTimeout(verdictTimer);
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
    // 結果: 左に売上の内訳（項目ごと）と合計、右に評価のメダルと組ごとの満足
    function renderResult() {
      const result = floorResult(state);
      const tag = (row) => row.missed ? "お迎えできず" : row.unserved ? "引き継ぎ" : "";
      const sum = (key) => result.groups.reduce((total, row) => total + (row[key] || 0), 0);
      const items = [
        ["お迎えした組", `${result.served}／${result.expected}組`],
        ["チャージ", yen(sum("charge"))],
        ["シーシャ", yen(sum("shisha"))],
        ["トップ替え（おかわり）", yen(sum("top"))],
        ["ドリンク", yen(sum("drink"))],
      ];
      return el("section.tf-result", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-result-title", dataset: { ...test("result"), rank: result.rank } }, [
        el("div.tf-slip", {}, [
          el("p.tf-eyebrow", { text: `tonari・${result.title}・本日の営業結果` }),
          el("div.tf-slip-body", {}, [
            el("div.tf-slip-sales", {}, [
              el("dl.tf-slip-items", {}, items.map(([name, value]) => el("div", {}, [el("dt", { text: name }), el("dd", { text: value })]))),
              el("div.tf-slip-total", {}, [el("h2#tf-result-title", { text: "店の売上" }), el("strong", { text: yen(result.sales), dataset: test("final-sales") })]),
            ]),
            el("div.tf-slip-side", {}, [
              el("div.tf-stamp", { dataset: { ...test("rank"), rank: result.rank } }, [el("i", { "aria-hidden": true }), el("b", { text: result.stamp })]),
              el("ul.tf-slip-rows", { "aria-label": "組ごとの満足" }, result.groups.map((row) => el("li", { dataset: { lost: String(!!(row.missed || row.unserved)) } }, [
                el("span", { text: `${row.name}（${row.party}名）` }),
                tag(row) ? el("small", { text: tag(row) }) : null,
                row.missed ? el("span.tf-stars", { text: "—" }) : stars(row.stars),
              ]))),
            ]),
          ]),
          el("p.tf-slip-counts", { text: `ぴったりの一台 ${result.counts.best}組・いい手入れ ${result.counts.care}回・トップ替え ${result.counts.extend}組・ボーナスタイム ${result.bonusTimes}回` }),
          el("p.tf-slip-sumi", {}, [
            sumiFace ? el("img", { src: sumiFace, alt: "", draggable: false }) : null,
            el("span", { text: `スミ「${result.comment}」` }),
          ]),
          el("p.tf-slip-bonus", { dataset: { none: String(!result.bonus) }, text: result.bonus
            ? `店からの売上ボーナス ＋${yen(result.bonus)}（日当とは別）` : "今回の売上ボーナスはなし（日当はいつもどおり）" }),
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
      layer.dataset.kind = node ? mode : "";
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
        if (mode === "panel") closePanel({ cancel: !panel?.locked });
        else if (mode === "pause") resume();
        else if (mode === "live") openPause();
        return;
      }
      if (mode === "live") {
        if (event.key === "b" || event.key === "B") { event.preventDefault(); useBonusTime(); return; }
        if (event.target instanceof HTMLButtonElement && event.target.classList.contains("tf-seat")) {
          // 動かす起点は、いまフォーカスのある卓（マウスを乗せて選んだ卓とは別のことがある）
          const next = spotInDirection(SPOTS, Number(event.target.closest(".tf-spot")?.dataset.id) || selected, event.key);
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

    // 判定の印が出ている間は、どこを押しても先へ進む
    layer.addEventListener("click", (event) => {
      if (mode === "panel" && panel?.locked && !event.target.closest(".tf-option")) closePanel({ cancel: false });
    });
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
