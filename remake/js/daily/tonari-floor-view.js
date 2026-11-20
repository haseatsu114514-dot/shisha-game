// tonari フロア営業の画面（ワンオペ＆フレーバー調合型）。店の時間は実時間で流れ、調合・ケア・会計を選んでいる間と
// フィーバーの突入演出・休止・別タブの間は止まる（営業の時計と、画面の動きの時計は別）。
// 画面の構成: 上＝作成中の一台（左）・残り時間（中央）・売上（右）／右＝定番ミックス／卓の上＝卓の札／
//   下＝選んでいる卓の詳細（左）・出来事の行とはじめの心の声（中央）・フィーバーのゲージ（右）。
// 注文待ちの卓を押すと「調合」の窓が開く（棚の30種から1〜3種を選ぶ。定番ならひと押し）。
// ケアと会計は、店内がその卓へ寄り、左に選択肢の列が出る。
// 状態と金額は tonari-floor-model.js から読むだけで、本編の所持金・在庫・日付には触れない。
import { el, yen } from "../core/util.js";
import { showScreen, clearScreen, retire, toast } from "../core/ui.js";
import { SE, playBgm, requestedBgm } from "../core/audio.js";
import { faceIconUrl } from "../core/data.js";
import { buildVersioned } from "../core/asset-version.js";
import {
  createFloorNight, floorTick, floorAct, floorTap, floorHint, floorResult, floorUrgency, floorWaitLeft,
  floorStayLeft, floorCoalLeft, floorMaking, floorTimeLeft, floorStage, floorBill, floorFeverLevel,
  mixInfo, mixKey, mixLabel, evaluateMix, pickNight, floorFeverLength, floorSlots, FLOOR_TICK_MS, FLOOR_TABLE_COUNT,
} from "./tonari-floor-model.js";
import {
  FLAVORS, FAMILIES, FAMILY_LABEL, TRAITS, TAG_LABEL, NG, VERBS, CALLS, MOODS, STAY_LABEL, RANK_LABEL, PRICE, COST, PRESET_MAX, DEMAND,
} from "./tonari-floor-data.js";
import { glyph, guestArt } from "./tonari-floor-art.js";
import { FLOOR_ART, artUrl, currentStage, spotCenter } from "./tonari-floor-stage.js";

/**
 * 検査用。manual を立てると実時間では進まず、api.tick(n) で刻みを送る。
 * verdictMs＝判定の印を見せる長さ（ミリ秒）。省くと実時間では1秒、manual では0（すぐ閉じる）。
 */
export const floorTest = { manual: false, api: null, verdictMs: null };

const TRAIT = Object.fromEntries(TRAITS.map((t) => [t.id, t]));
const MOOD = Object.fromEntries(MOODS.map((m) => [m.id, m]));
// 提供した時の手応え: [言葉, 色, 判定の印]
const POP = {
  best: ["ぴったり！", "best", "best"], good: ["いい感じ", "best", "good"], ok: ["悪くない", "near", "good"],
  off: ["ちがうかも…", "off", "miss"], ng: ["抜いてほしかった…", "off", "bad"],
};
const MARK = { best: "markBest", good: "markGood", miss: "markMiss", bad: "markBad" };
const CALL_ICON = { coal: "add", thin: "thin", harsh: "harsh", thirsty: "glass", cough: "ask", chatty: "talk" };
const VERB_ICON = { add: "add", ease: "ease", water: "drink", teach: "ask", chat: "talk" };
const APT_MARK = { best: "◎", good: "○", weak: "△", none: "×" };
const FEVER_BGM = "bgm_tournament_edm"; // 専用の曲が届くまで、手持ちの速い曲へ切り替える
const SHIFT_BGM = "tonari"; // フィーバーの前に流れていた曲が分からない時に戻す先
const SALES_STEP = 10000; // 店の売上がこの額をまたぐたびに、下の帯で知らせる
const test = (key) => ({ test: `tonari-floor-${key}` });
const quoted = (text) => (text.startsWith("（") ? text : `「${text}」`);
const seconds = (ticks) => Math.ceil(ticks * FLOOR_TICK_MS / 1000);

/** 注文の要望を、短い札にする（卓の札の帯・調合の窓の上に出す）。 */
function orderChips(order) {
  const chips = [];
  if (order.type === "omakase") chips.push({ kind: "family", text: "おまかせ" });
  else if (order.family) chips.push({ kind: "family", text: order.type === "pin" ? `仕上げ：${FAMILY_LABEL[order.family]}` : FAMILY_LABEL[order.family] });
  chips.push({ kind: "trait", text: TRAIT[order.trait].label, color: TRAIT[order.trait].color });
  if (order.must) chips.push({ kind: "must", text: `${FLAVORS[order.must].label}を入れる` });
  if (order.ng) chips.push({ kind: "ng", text: NG[order.ng].label });
  return chips;
}
// 卓の札の帯に出す短い要望（系統か指定の一種。求める吸い心地は帯の色と右下の字で出す）
const orderShort = (order) => (order.type === "omakase" ? "おまかせ" : order.must ? FLAVORS[order.must].label : FAMILIES.find((f) => f.id === order.family).tab);
/** ミックスの名前を、フレーバーの切れ目でだけ折れる形にする。 */
const mixSpans = (ids) => ids.map((id, i) => el("span", { text: `${i ? "＋" : ""}${FLAVORS[id].label}` }));

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

/** 4特性の小さな棒（0〜3）。want＝客が求める特性（強調する）。 */
function traitBars(traits, { want = null, demand = null } = {}) {
  return el("span.tf-traits", {}, TRAITS.map((t) => el("span", { dataset: { want: String(t.id === want) }, style: { "--c": t.color } }, [
    el("small", { text: t.short }),
    el("i", {}, [el("i", { style: { width: `${Math.round(Math.min(3, traits[t.id]) / 3 * 100)}%` } }),
      t.id === want && demand ? el("u", { style: { left: `${Math.round(demand / 3 * 100)}%` } }) : null]),
  ])));
}

/** 4特性の小さな目盛り（棚のフレーバー用。3段。色は特性の色）。 */
function traitPips(values, want = null) {
  return el("span.tf-pips", { "aria-hidden": true }, TRAITS.map((t, i) => el("i", { dataset: { want: String(t.id === want), v: String(values[i]) }, style: { "--c": t.color } }, [el("i"), el("i"), el("i")])));
}
const traitLegend = () => el("span.tf-legend", {}, TRAITS.map((t) => el("span", { text: t.short, style: { "--c": t.color } })));

/** 定番の顔ぶれの釣り合い（4特性のレーダー）。 */
function radar(presets) {
  const infos = presets.map((ids) => mixInfo(ids));
  const avg = TRAITS.map((t) => infos.reduce((sum, m) => sum + m.traits[t.id], 0) / Math.max(1, infos.length) / 3);
  const at = (i, r) => { const a = -Math.PI / 2 + i * Math.PI / 2; return `${(50 + Math.cos(a) * r * 38).toFixed(1)},${(50 + Math.sin(a) * r * 38).toFixed(1)}`; };
  const ring = (r) => `<polygon points="${[0, 1, 2, 3].map((i) => at(i, r)).join(" ")}" fill="none" stroke="#6b5338" stroke-width="0.8"/>`;
  const labels = TRAITS.map((t, i) => { const [x, y] = at(i, 1.26).split(","); return `<text x="${x}" y="${Number(y) + 3}" text-anchor="middle" font-size="8.5" fill="${t.color}">${t.short}</text>`; }).join("");
  return el("span.tf-radar", { "aria-hidden": true, html: `<svg viewBox="-6 -4 112 108">${ring(1)}${ring(0.66)}${ring(0.33)}
    <polygon points="${avg.map((v, i) => at(i, Math.max(0.08, v))).join(" ")}" fill="#f0b64e55" stroke="#ffe2a6" stroke-width="1.6"/>${labels}</svg>` });
}

/**
 * 一晩の営業を表示して、結果（floorResult。定番 presets を含む）を返す。中断・LOAD では null。
 * @param opts.art 店内の絵のURL（昼夜・天気は呼び出し側が選ぶ）
 * @param opts.presets 保存してある定番ミックス
 * @param opts.fans これまでの店のファンの合計（表示だけに使う）
 */
export function runTonariFloor({
  seed = 0, level = 0, chapter = 1, presets = null, fans = 0, rainy = false, night = false, art = null,
  // night＝夜のシフト（絵と時計・呼び名を夜にする）。stage＝店内の絵と位置。guests・props＝絵の登録（検査と配置図で差し替える）
  stage = null, guests = FLOOR_ART.guests, props = FLOOR_ART.props,
  isCurrent = () => true, signal = null,
} = {}) {
  if (signal?.aborted || !isCurrent()) return Promise.resolve(null);
  stylesheet();
  const layout = currentStage(stage);
  const SPOTS = layout.spots;
  const seated = layout.style === "seated";
  const roomArt = layout.art ? artUrl(night ? layout.art.night : layout.art.day) : art;
  const frontArt = layout.art ? artUrl(night ? layout.art.frontNight : layout.art.frontDay) : null;
  const shishaArt = artUrl(props?.shisha);
  const daytime = !night;
  const plan = pickNight(level, seed, { rainy, daytime });
  let state = createFloorNight({ seed, level, chapter, presets, rainy, daytime });
  let mode = "intro"; // intro → live ⇄ mix / panel / pause / cutin → closing → result
  let panel = null, mix = null, selected = 1, speed = 1, active = true, leaving = false, outerMenu = false;
  let carry = 0, lastAt = 0, timer = null, bannerTimer = null, verdictTimer = null, cutinTimer = null, lastHint = "", salesMark = 0;
  let feverBgm = null; // フィーバー中だけ、前に流れていた曲の名前を持つ（明けたらその曲へ戻す）
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
      // 卓のボタン（読み上げとキーボードの入口）。座る形では座った客、会話用の店内画では卓の札と同じ所の押し所になる
      const seat = el("button.tf-seat", { type: "button", dataset: test(`table-${id}`), onclick: tap }, [el("span.tf-medal", {}, [el("span.tf-who")])]);
      seat.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse" && mode === "live") select(id); });
      // 卓の札: 上に用件、箱の上の帯に要望（求める吸い心地の色）、左に卓番号と客、右に顔（注文待ちは残り秒）とドリンクの杯数、
      // 箱の下の棒は作成の進み（提供後は炭の残り）、左下の円は滞在の残り、右下はケア・会計を待たせている残り秒
      const tagWant = el("b.tf-tag-want"), tagReq = el("span.tf-tag-req", {}, [el("span")]), tagWho = el("span.tf-tag-who");
      const tagFace = el("span.tf-tag-face"), tagNote = el("small.tf-tag-note"), tagBar = el("i"), tagCount = el("span.tf-tag-count");
      const bubble = el("button.tf-bubble", { type: "button", tabIndex: -1, "aria-hidden": true, onclick: tap }, [
        tagWant,
        el("span.tf-tag-box", {}, [
          tagReq, el("i.tf-tag-no", { text: String(id) }),
          el("span.tf-tag-cell", {}, [tagWho]), el("span.tf-tag-cell", {}, [tagFace, tagNote]),
          el("span.tf-tag-empty"), el("span.tf-tag-gauge", {}, [tagBar]),
        ]),
        el("span.tf-tag-foot", {}, [el("i.tf-tag-pie"), tagCount]),
      ]);
      const plate = el("button.tf-plate", { type: "button", tabIndex: -1, "aria-hidden": true, onclick: tap }, [el("b", { text: String(id) })]);
      const [sx, sy] = spotCenter(spot);
      const anchor = seated
        ? { "--bx": `${spot.bubble[0]}%`, "--by": `${spot.bubble[1]}%`, "--fx": `${spot.fx[0]}%`, "--fy": `${spot.fx[1]}%` }
        : { "--x": `${sx}%`, "--y": `${sy}%`, "--bx": `${sx}%`, "--by": `calc(${sy}% + 76px)`, "--fx": `${sx}%`, "--fy": `calc(${sy}% + 110px)` };
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
        tagWant, tagReq, tagWho, tagFace, tagNote, tagBar, tagCount, tagEmpty: bubble.querySelector(".tf-tag-empty"),
        guestId: null, wantKey: "", faceKey: "", countKey: "", noteKey: "", happy: false });
      spotsBox.append(root);
    });
    if (frontArt) spotsBox.append(el("img.tf-front", { src: frontArt, alt: "", decoding: "async", draggable: false, "aria-hidden": true }));
    const cam = el("div.tf-cam", {}, [room, spotsBox]);
    const stageBox = el("div.tf-stage", {}, [cam]);

    // 上の帯: 左に作成中の一台（同時に作れる枠）、まん中に残り時間、右に店の売上
    const makingList = el("div.tf-making-list");
    const making = el("div.tf-making", { dataset: test("making") }, [el("small", {}, [glyph("cook"), el("span", { text: "作成中" })]), makingList]);
    const clockText = el("b", { text: "0:00", dataset: test("time-left") });
    const clockBar = el("i");
    const salesText = el("strong", { text: yen(0), dataset: test("sales") });
    const top = el("header.tf-top", {}, [
      making,
      el("div.tf-clock", {}, [el("small", { text: "残り時間" }), clockText, el("span.tf-clock-bar", {}, [clockBar])]),
      el("div.tf-sales", {}, [el("small", { text: "店の売上" }), salesText]),
      el("button.tf-pause-button", { type: "button", "aria-label": "休止", dataset: test("pause"), onclick: () => openPause() }, [glyph("pause")]),
    ]);
    // 右の列: 定番ミックス（押すと、いちばん急ぎの注文待ちの卓へそのまま出す）
    const presetList = el("div.tf-preset-list");
    const side = el("aside.tf-presets", { dataset: test("presets") }, [el("h2", {}, [glyph("serve"), el("span", { text: "定番" })]), presetList]);
    // 下の帯: 選んでいる卓の詳細／出来事の行とはじめの心の声／フィーバーのゲージ
    const dockNo = el("b.tf-dock-no"), dockWho = el("span.tf-dock-who"), dockName = el("b"), dockSub = el("small");
    const dockMood = el("i"), dockStay = el("i"), dockQuote = el("span"), dockMix = el("span");
    const dockBill = el("strong", { dataset: test("dock-bill") }), dockFace = el("span.tf-dock-face"), dockEmpty = el("p.tf-dock-empty");
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
    const logLines = el("div.tf-log", { "aria-hidden": true, dataset: test("log") });
    const hintText = el("p", { dataset: test("advice") });
    const hajimeFace = faceIconUrl("hajime");
    const ticker = el("button.tf-ticker", { type: "button", onclick: () => followHint() }, [
      logLines,
      el("span.tf-advice", {}, [hajimeFace ? el("img", { src: hajimeFace, alt: "はじめ", draggable: false }) : null, hintText]),
    ]);
    const feverLevels = el("span.tf-fever-levels", { "aria-hidden": true }, [1, 2, 3].map((n) => el("i", { dataset: { n } }, [el("i")])));
    const feverLabel = el("b", { text: "フィーバー" });
    const bonusButton = el("button.tf-bonus", { type: "button", dataset: test("bonus"), onclick: () => useFever() }, [
      el("span.tf-bonus-lamp", {}, [glyph("lamp")]),
      el("span.tf-bonus-text", {}, [feverLabel, feverLevels]),
    ]);
    const bottom = el("footer.tf-bottom", {}, [dock, ticker, bonusButton]);
    const layer = el("div.tf-layer");
    const banner = el("div.tf-banner", { "aria-hidden": true });
    const cutinBand = el("div.tf-cutin", { "aria-hidden": true });
    const announce = el("p.tf-sr", { "aria-live": "polite", "aria-atomic": "true" });
    const host = el("section.tonari-floor", { "aria-label": "tonari フロア営業", dataset: {
      ...test("screen"), night: String(night), mode, stage: layout.id, style: layout.style } }, [
      stageBox, top, side, bottom, cutinBand, layer, banner, announce,
    ]);

    function settle(result) {
      if (!active) return;
      active = false;
      clearInterval(timer);
      for (const t of [bannerTimer, verdictTimer, cutinTimer]) clearTimeout(t);
      if (feverBgm) playBgm(feverBgm);
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
      for (const node of [spotsBox, top, side, ticker, bonusButton]) node.inert = blocked;
      if (next !== "panel") cam.style.transform = "";
    }
    // 接客ビュー: 選んだ卓が、左の列と下の詳細に隠れない所（画面の右寄り）へ来るように寄る
    function focusCam(id) {
      const [px, py] = spotCenter(SPOTS[id - 1]);
      const zoom = 1.3;
      const tx = Math.max(100 - 100 * zoom, Math.min(26, 68 - zoom * px));
      const ty = Math.max(-40, Math.min(0, 47 - zoom * py));
      cam.style.transform = `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) scale(${zoom})`;
    }

    // ---- 時計（営業の時間。止まっている間も、画面の動きは CSS が進める） ----
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
    // 出来事の行（下の帯。新しい行が下に入る）。読み上げにも同じ言葉を流す
    function log(text, tone = "") {
      if (!text) return;
      announce.textContent = text;
      logLines.append(el("p", { text, dataset: { tone } }));
      while (logLines.children.length > 2) logLines.firstElementChild.remove();
    }
    const say = (id, text, tone = "") => { if (text) log(`${id}卓${quoted(text)}`, tone); };
    function showBanner(title, sub = "") {
      banner.replaceChildren(el("b", { text: title }), sub ? el("small", { text: sub }) : "");
      banner.dataset.on = "false";
      void banner.offsetWidth;
      banner.dataset.on = "true";
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { banner.dataset.on = "false"; }, 1400);
    }
    function cutin(title, sub, kind = "") {
      cutinBand.replaceChildren(el("b", { text: title }), sub ? el("small", { text: sub }) : "");
      cutinBand.dataset.kind = kind;
      cutinBand.dataset.on = "false";
      void cutinBand.offsetWidth; // 同じ帯を続けて出す時に、動きを最初からやり直す
      cutinBand.dataset.on = "true";
      setTimeout(() => { cutinBand.dataset.on = "false"; }, 1700);
    }
    function play(events) {
      for (const e of events) {
        const guest = e.guestId ? state.guests[e.guestId] : null;
        switch (e.type) {
          case "arrive": SE.doorbell(); log(`${guest.name}が来店。${e.tableId}卓へ`); break;
          case "left": SE.miss(); pop(e.tableId, "帰ってしまった", "off", "bad"); log(`${e.tableId}卓の${guest.name}が、待ちきれずに帰ってしまいました`, "bad"); break;
          case "order": SE.click(); pop(e.tableId, e.preset ? "定番で作成" : "作成開始"); log(`${e.tableId}卓　${mixLabel(e.mix)}を作りはじめた`); break;
          case "serve": {
            const [text, kind, mark] = POP[e.grade] || POP.ok;
            if (e.grade === "best") SE.perfect(); else if (e.grade === "off" || e.grade === "ng") SE.miss(); else SE.good();
            pop(e.tableId, text, kind, mark);
            say(e.tableId, e.line, e.grade === "best" || e.grade === "good" ? "good" : e.grade === "ok" ? "" : "bad");
            break;
          }
          case "call": SE.tick(); log(e.call === "coal" ? `${e.tableId}卓　炭の替え時です` : `${e.tableId}卓で、お客さんの様子が変わりました`); break;
          case "care":
            if (e.ok) { SE.perfect(); pop(e.tableId, "いいケア", "best", "best"); } else { SE.miss(); pop(e.tableId, "ちがったみたい", "off", "bad"); }
            say(e.tableId, e.line, e.ok ? "good" : "bad");
            break;
          case "callLate": SE.miss(); pop(e.tableId, "見逃した", "off"); log(`${e.tableId}卓のケアを見逃しました`, "bad"); break;
          case "drink":
            SE.money();
            pop(e.tableId, `追加ドリンク！ ＋${yen(PRICE.drink)}`, "coin");
            log(`${e.tableId}卓　追加ドリンク注文！`, "good");
            break;
          case "extend":
            SE.perfect(); SE.money();
            pop(e.tableId, "自然延長！", "best", "best");
            log(`${e.tableId}卓　自然延長！「${e.line}」`, "good");
            showBanner("トップ替え、いただきました！", `おかわり ＋${yen(PRICE.top)}`);
            break;
          case "billReady": SE.tick(); log(`${e.tableId}卓がお会計です`); break;
          case "bill":
            SE.money();
            pop(e.tableId, e.fans > 0 ? `ファン ＋${e.fans}` : "お見送り", e.fans > 0 ? "best" : "");
            if (e.line) say(e.tableId, e.line, e.fans > 1 ? "good" : "");
            break;
          case "feverReady": SE.jingle(); log(`フィーバー Lv${e.level} が使えます`, "good"); break;
          case "feverStart": SE.just(); SE.whoosh(); break;
          case "feverEnd": endFever(); break;
          default: break;
        }
      }
      // 店の売上が区切りをまたいだら知らせる
      const mark = Math.floor(state.sales / SALES_STEP);
      if (mark > salesMark && !state.done) log(`店の売上が${yen(mark * SALES_STEP)}を超えました`, "good");
      salesMark = mark;
    }

    // ---- 画面の書き換え ----
    // 卓の札の上に出る用件: [記号, 言葉, 札の色]
    function wantFor(table) {
      const feverOn = table.fever && state.feverLeft > 0;
      switch (table.phase) {
        case "order": return ["order", "注文", "act"];
        case "prep": return ["cook", table.make.active ? "作成中" : "作成待ち", "wait"];
        case "enjoy":
          if (feverOn) return ["lamp", "フィーバー", "fever"];
          if (table.call) return state.hint === "said" ? [CALL_ICON[table.call.type], CALLS[table.call.type].label, "act"] : ["alert", "様子が変だ", "act"];
          return ["lamp", table.extended ? "延長中" : "くつろぎ中", "fine"];
        case "bill": return ["bill", "会計", "act"];
        case "cool": return ["", "片付け中", "idle"];
        default: return ["", "空席", "idle"];
      }
    }
    function syncSpot(spot, table) {
      const guest = table.guestId ? state.guests[table.guestId] : null;
      const tap = floorTap(state, table.id);
      const want = wantFor(table);
      const urgency = floorUrgency(state, table.id);
      const stay = floorStayLeft(state, table.id);
      const stageId = guest && table.phase !== "order" && table.phase !== "prep" ? floorStage(table.mood).id : "";
      Object.assign(spot.root.dataset, {
        phase: table.phase, tap, act: String(want[2] === "act"), tone: want[2], smoke: String(table.phase === "enjoy"),
        served: String(table.phase === "enjoy" || table.phase === "bill"),
        urgent: urgency > 0.66 ? "high" : urgency > 0.33 ? "mid" : "", selected: String(selected === table.id),
        leaving: String(table.phase === "enjoy" && stay > 0 && stay <= 0.3), mood: stageId,
      });
      spot.root.style.setProperty("--stay", stay.toFixed(3));
      spot.root.style.setProperty("--tf-mood-color", stageId ? MOOD[stageId].color : "#d9c6a4");
      // 満足している客は、登録があれば笑顔の絵に替える（座った絵だけ）
      const happy = seated && !!guest && table.mood >= 85 && !!stageId;
      if (spot.guestId !== (guest?.id || null) || spot.happy !== happy) {
        if (spot.guestId !== (guest?.id || null)) {
          spot.tagWho.replaceChildren(guest ? guestArt(guest, { art: guests }) : "");
          spot.tagReq.firstElementChild.textContent = guest ? orderShort(guest.order) : "";
          spot.tagReq.dataset.ng = String(!!guest?.order.ng);
          spot.root.style.setProperty("--c", guest ? TRAIT[guest.order.trait].color : "transparent");
        }
        spot.guestId = guest?.id || null;
        spot.happy = happy;
        spot.who.replaceChildren(guest ? guestArt(guest, { happy, seated, art: guests }) : "");
        spot.root.dataset.party = guest ? String(guest.party) : "";
      }
      const wantKey = want.join("/");
      if (spot.wantKey !== wantKey) {
        spot.wantKey = wantKey;
        spot.tagWant.replaceChildren(want[0] ? glyph(want[0]) : "", el("span", { text: want[1] }));
        spot.tagEmpty.textContent = guest ? "" : want[1];
      }
      // 右の窓: 注文待ちは残り秒（大きな数字）、作成中は鍋の印、提供後は顔。下の小さな字はドリンクの杯数
      const left = floorWaitLeft(state, table.id);
      const faceKey = table.phase === "order" ? `n${seconds(left)}` : table.phase === "prep" ? "prep" : stageId ? floorStage(table.mood).face + stageId : "";
      if (spot.faceKey !== faceKey) {
        spot.faceKey = faceKey;
        spot.tagFace.replaceChildren(...(table.phase === "order" ? [glyph("clock"), el("b", { text: String(seconds(left)) })]
          : table.phase === "prep" ? [glyph("cook")] : stageId ? [glyph(floorStage(table.mood).face)] : []));
      }
      // 下の小さな字: 注文待ちは求める吸い心地、作成中は残り秒、提供後はドリンクの杯数
      const noteKey = table.phase === "order" ? `t${guest.order.trait}` : table.phase === "prep" ? `${seconds(table.make.left)}秒` : table.drinks ? `d${table.drinks}` : "";
      if (spot.noteKey !== noteKey) {
        spot.noteKey = noteKey;
        spot.tagNote.dataset.kind = table.phase === "order" ? "trait" : "";
        spot.tagNote.replaceChildren(...(table.phase === "order" ? [el("span", { text: TRAIT[guest.order.trait].short })]
          : noteKey.startsWith("d") ? [glyph("glass"), el("span", { text: `×${table.drinks}` })] : noteKey ? [el("span", { text: noteKey })] : []));
      }
      const bar = table.phase === "prep" ? 1 - table.make.left / table.make.total : table.phase === "enjoy" ? floorCoalLeft(state, table.id) : 0;
      spot.tagBar.style.width = `${Math.round(bar * 100)}%`;
      spot.root.dataset.gauge = table.phase === "prep" ? "make" : table.phase === "enjoy" ? "coal" : "";
      // ケア・会計を待たせている残り（秒）
      const countKey = (table.call || table.phase === "bill") && left != null ? (left > 0 ? String(seconds(left)) : "!") : "";
      if (spot.countKey !== countKey) {
        spot.countKey = countKey;
        spot.tagCount.replaceChildren(...(countKey ? [glyph("clock"), el("b", { text: countKey === "!" ? "！" : countKey })] : []));
        spot.tagCount.dataset.over = String(countKey === "!");
      }
      spot.seat.setAttribute("aria-label", `${table.id}卓 ${SPOTS[table.id - 1].name}、${guest ? `${guest.name}、` : ""}${want[1]}`);
      spot.seat.tabIndex = selected === table.id ? 0 : -1;
    }
    function syncMaking() {
      const list = floorMaking(state);
      const key = list.map((m) => `${m.tableId}/${m.active}`).join(",");
      if (makingList.dataset.key !== key) {
        makingList.dataset.key = key;
        const rows = list.slice(0, floorSlots).map((m) => el("div.tf-making-row", { dataset: { table: m.tableId } }, [
          el("b", { text: `${m.tableId}卓` }), el("span", { text: m.label }), el("i.tf-bar", {}, [el("i")]),
        ]));
        while (rows.length < floorSlots) rows.push(el("div.tf-making-row.empty", {}, [el("span", { text: "空き" })]));
        makingList.replaceChildren(...rows, list.length > floorSlots ? el("small.tf-making-more", { text: `待ち ${list.length - floorSlots}台` }) : "");
      }
      for (const m of list.slice(0, floorSlots)) {
        const bar = makingList.querySelector(`[data-table="${m.tableId}"] .tf-bar i`);
        if (bar) bar.style.width = `${Math.round((1 - m.left / m.total) * 100)}%`;
      }
    }
    function syncPresets() {
      const key = state.presets.map(mixKey).join(",");
      if (presetList.dataset.key === key) return;
      presetList.dataset.key = key;
      presetList.replaceChildren(...state.presets.map((ids, i) => el("button.tf-preset", {
        type: "button", "aria-label": `定番 ${mixLabel(ids)}`, dataset: test(`preset-${i}`), onclick: () => quickPreset(ids),
      }, mixSpans(ids))));
    }
    function syncDock() {
      const table = state.tables[selected - 1];
      const guest = table.guestId ? state.guests[table.guestId] : null;
      const key = `${selected}/${guest?.id || table.phase}`;
      if (dock.dataset.key !== key) {
        dock.dataset.key = key;
        dock.dataset.on = String(!!guest);
        dockNo.textContent = `${selected}卓`;
        dockWho.replaceChildren(guest ? guestArt(guest, { art: guests }) : "");
        dockName.textContent = guest ? guest.name : "";
        dockSub.textContent = guest ? `${guest.party}名・${STAY_LABEL[guest.stay]}${guest.rank === "keen" ? `・${RANK_LABEL.keen}` : ""}` : "";
        dockQuote.textContent = guest ? `「${guest.order.quote}」` : "";
        dockEmpty.textContent = guest ? "" : table.phase === "cool" ? "片付け中" : "空席";
      }
      if (!guest) return;
      const stage = floorStage(table.mood);
      const shown = table.phase === "order" || table.phase === "prep" ? "" : stage.id;
      if (dock.dataset.mood !== shown) {
        dock.dataset.mood = shown;
        dock.style.setProperty("--tf-mood-color", shown ? stage.color : "#d9c6a4");
        dockFace.replaceChildren(shown ? glyph(stage.face) : "");
      }
      dockMood.style.width = `${shown ? Math.round(table.mood) : 0}%`;
      dockStay.style.width = `${Math.round(floorStayLeft(state, selected) * 100)}%`;
      const label = table.mix ? `${mixLabel(table.mix)}${table.phase === "prep" ? "（作成中）" : ""}${table.extended ? "・トップ替え" : ""}` : "これから";
      const text = `${label}${table.drinks ? `／ドリンク${table.drinks}杯` : ""}`;
      if (dockMix.textContent !== text) dockMix.textContent = text;
      const bill = yen(floorBill(state, selected)?.total || 0);
      if (dockBill.textContent !== bill) dockBill.textContent = bill;
    }
    function sync() {
      state.tables.forEach((table, i) => syncSpot(refs.spots[i], table));
      syncMaking();
      syncPresets();
      syncDock();
      clockText.textContent = floorTimeLeft(state);
      clockBar.style.width = `${Math.max(0, 100 - (state.t / state.length) * 100).toFixed(1)}%`;
      host.dataset.late = String(state.length - state.t <= 60); // 残り30秒で時計を赤くする
      host.dataset.ordering = String(state.tables.some((x) => x.phase === "order")); // 注文待ちの卓がある間、定番の列を灯す
      if (salesText.dataset.value !== String(state.sales)) {
        if (salesText.dataset.value !== undefined) { salesText.dataset.bump = "false"; void salesText.offsetWidth; salesText.dataset.bump = "true"; }
        salesText.dataset.value = String(state.sales);
        salesText.textContent = yen(state.sales);
      }
      // フィーバー: 3段のゲージ。溜まった段までを一度に使う
      const feverOn = state.feverLeft > 0;
      const level = floorFeverLevel(state);
      host.dataset.fever = feverOn ? "on" : level ? "ready" : "";
      bonusButton.disabled = feverOn || !level || !state.tables.some((x) => x.phase === "enjoy");
      bonusButton.dataset.level = String(feverOn ? state.feverLevel : level);
      feverLevels.querySelectorAll(":scope > i").forEach((seg, i) => {
        const fill = feverOn ? (i < state.feverLevel ? state.feverLeft / floorFeverLength : 0) : Math.max(0, Math.min(1, state.fever / 100 - i));
        seg.firstElementChild.style.width = `${Math.round(fill * 100)}%`;
      });
      feverLabel.textContent = feverOn ? `フィーバー中 Lv${state.feverLevel}` : level ? `フィーバー Lv${level}` : "フィーバー";
      bonusButton.setAttribute("aria-label", feverOn ? "フィーバー中" : level ? `フィーバー Lv${level} を使う` : `フィーバーのゲージ ${Math.round(state.fever)}`);
      const hint = floorHint(state);
      for (const spot of refs.spots) spot.root.dataset.guide = String(state.level === 0 && String(hint.tableId) === spot.root.dataset.id);
      if (hint.text !== lastHint) { lastHint = hint.text; hintText.textContent = hint.text; }
      ticker.dataset.kind = hint.kind;
      ticker.dataset.table = hint.tableId || "";
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
      if (tap === "order") { openMix(id); return; }
      if (tap === "care" || tap === "bill") { openPanel(tap, id); return; }
      const table = state.tables[id - 1];
      SE.click();
      pop(id, table.phase === "prep" ? (table.make.active ? "作成中" : "作成待ち") : table.phase === "enjoy" ? "くつろいでいる" : table.phase === "cool" ? "片付け中" : "空席");
    }
    function followHint() {
      if (mode !== "live") return;
      if (ticker.dataset.kind === "feverReady") return useFever();
      const id = Number(ticker.dataset.table);
      if (id) select(id, true);
    }
    // 定番をひと押しで出す（いちばん急ぎの注文待ちの卓へ。選んでいる卓が注文待ちなら、その卓へ）
    function waitingTable() {
      const waiting = state.tables.filter((x) => x.phase === "order").sort((a, b) => floorUrgency(state, b.id) - floorUrgency(state, a.id));
      return waiting.find((x) => x.id === selected) || waiting[0] || null;
    }
    function quickPreset(ids) {
      if (mode !== "live") return;
      const target = waitingTable();
      if (!target) { SE.error(); log("注文待ちの卓がありません"); return; }
      select(target.id);
      perform({ type: "order", tableId: target.id, mix: ids });
    }
    function useFever() {
      if (mode !== "live") return;
      if (!perform({ type: "fever" })) { SE.error(); return; }
      if (state.done) return;
      // 突入の演出: 時間を止めて、帯と曲を切り替える
      const level = state.feverLevel;
      feverBgm = requestedBgm() || SHIFT_BGM;
      playBgm(FEVER_BGM);
      cutin("FEVER TIME!", `Lv${level}　${state.tables.filter((x) => x.fever).length}卓が最高の居心地`, "fever");
      log(`フィーバー Lv${level}！`, "good");
      if (floorTest.manual) return;
      setMode("cutin");
      cutinTimer = setTimeout(() => { if (active && mode === "cutin") { setMode("live"); lastAt = performance.now(); } }, 1200);
    }
    function endFever() {
      if (!feverBgm) return;
      playBgm(feverBgm);
      feverBgm = null;
      log("フィーバーが明けました");
    }

    // ---- 選ぶ札（共通） ----
    function option(label, noteText, onPick, { icon = null, primary = false, key = "" } = {}) {
      return el("button.tf-option", { type: "button", onclick: onPick, dataset: { ...test(`option${key ? "-" + key : ""}`), primary: String(primary) } }, [
        icon ? glyph(icon) : null,
        el("span", {}, [el("b", { text: label }), noteText ? el("small", { text: noteText }) : null]),
      ]);
    }

    // ---- 調合の窓（時間停止）。棚の30種から1〜3種を選ぶ。定番はひと押しでボウルに入る ----
    function openMix(tableId = null, back = "live") {
      const order = tableId ? state.guests[state.tables[tableId - 1].guestId].order : null;
      mix = { tableId, back, tab: order?.family || "fruit", bowl: [] };
      setMode("mix");
      renderLayer();
      layer.querySelector(".tf-mix-preset, .tf-flavor")?.focus({ preventScroll: true });
    }
    function closeMix({ cancel = true } = {}) {
      const { tableId, back } = mix || {};
      mix = null;
      setMode(back || "live");
      renderLayer();
      lastAt = performance.now();
      if (cancel) SE.cancel();
      if (back === "live" && tableId) select(tableId, true);
      else layer.querySelector(".tf-option")?.focus({ preventScroll: true });
    }
    function redrawMix(focusKey = "") {
      renderLayer();
      (focusKey && layer.querySelector(`[data-key="${focusKey}"]`) || layer.querySelector(".tf-mix-confirm"))?.focus({ preventScroll: true });
    }
    function toggleFlavor(id) {
      const at = mix.bowl.indexOf(id);
      if (at >= 0) mix.bowl.splice(at, 1);
      else if (mix.bowl.length < 3) mix.bowl.push(id);
      else { SE.error(); return; }
      SE.click();
      redrawMix(`flavor-${id}`);
    }
    function confirmMix() {
      if (!mix?.bowl.length) return;
      const { tableId, bowl } = mix;
      if (!tableId) return;
      mix = null;
      setMode("live");
      renderLayer();
      lastAt = performance.now();
      if (!perform({ type: "order", tableId, mix: bowl })) SE.error();
      if (mode === "live") select(tableId, true);
    }
    function togglePreset() {
      if (!mix?.bowl.length) return;
      const has = state.presets.some((ids) => mixKey(ids) === mixKey(mix.bowl));
      if (!perform({ type: "preset", op: has ? "remove" : "add", mix: mix.bowl })) { SE.error(); return; }
      SE.select();
      log(has ? `定番から外した：${mixLabel(mix.bowl)}` : `定番に登録：${mixLabel(mix.bowl)}`);
      redrawMix("mix-save");
    }
    function renderMix() {
      const table = mix.tableId ? state.tables[mix.tableId - 1] : null;
      const guest = table ? state.guests[table.guestId] : null;
      const order = guest?.order || null;
      const info = mixInfo(mix.bowl);
      const result = info && order ? evaluateMix(mix.bowl, order, guest.rank) : null;
      const isPreset = !!info && state.presets.some((ids) => mixKey(ids) === info.key);
      const head = el("header.tf-mix-head", {}, guest ? [
        el("b.tf-mix-no", { text: `${table.id}卓` }),
        el("span.tf-mix-who", {}, [guestArt(guest, { art: guests })]),
        el("div", {}, [
          el("h2#tf-mix-title", { text: `「${order.quote}」`, dataset: test("mix-quote") }),
          el("p.tf-chips", {}, [el("small", { text: `${guest.name}・${RANK_LABEL[guest.rank]}` }),
            ...orderChips(order).map((chip) => el("span", { text: chip.text, dataset: { kind: chip.kind }, style: chip.color ? { "--c": chip.color } : {} }))]),
        ]),
        el("span.tf-mix-wait", { text: `あと${seconds(floorWaitLeft(state, table.id))}秒（選んでいる間は止まる）` }),
      ] : [el("h2#tf-mix-title", { text: "定番を組む" }), el("p.tf-chips", {}, [el("small", { text: `定番は最大${PRESET_MAX}枠。営業中にひと押しで出せて、少し早く仕上がる` })])]);
      const presetsCol = el("div.tf-mix-presets", {}, [
        el("h3", { text: `定番 ${state.presets.length}／${PRESET_MAX}` }),
        ...state.presets.map((ids, i) => {
          const fit = order ? evaluateMix(ids, order, guest.rank) : null;
          return el("button.tf-mix-preset", { type: "button", dataset: { ...test(`mix-preset-${i}`), key: `preset-${i}`, on: String(mixKey(ids) === info?.key) },
            onclick: () => { mix.bowl = [...ids]; SE.click(); redrawMix("mix-confirm"); } }, [
            el("b", {}, mixSpans(ids)),
            fit ? el("i", { dataset: { grade: fit.grade }, text: { best: "◎", good: "○", ok: "△", off: "×", ng: "×" }[fit.grade] }) : null,
          ]);
        }),
      ]);
      const shelf = el("div.tf-mix-shelf", {}, [
        el("div.tf-mix-tabs", { role: "tablist" }, [...FAMILIES.map((f) => el("button", { type: "button", role: "tab", text: f.tab,
          "aria-selected": String(mix.tab === f.id), dataset: { ...test(`mix-tab-${f.id}`), key: `tab-${f.id}`, want: String(order?.family === f.id) },
          onclick: () => { mix.tab = f.id; SE.click(); redrawMix(`tab-${f.id}`); } }))]),
        el("div.tf-flavors", {}, Object.values(FLAVORS).filter((f) => f.family === mix.tab).map((f) => {
          const ngHit = !!order?.ng && f.tags.some((tag) => NG[order.ng].tags.includes(tag));
          return el("button.tf-flavor", { type: "button", "aria-pressed": String(mix.bowl.includes(f.id)),
            dataset: { ...test(`flavor-${f.id}`), key: `flavor-${f.id}`, ng: String(ngHit), must: String(order?.must === f.id) }, onclick: () => toggleFlavor(f.id) }, [
            el("b", { text: f.label }), traitPips(f.traits, order?.trait),
            el("small", { text: f.tags.map((tag) => TAG_LABEL[tag]).join("・") }),
          ]);
        })),
      ]);
      const slots = [0, 1, 2].map((i) => mix.bowl[i]
        ? el("button.tf-bowl-slot", { type: "button", text: FLAVORS[mix.bowl[i]].label, title: "押すと外す", dataset: { key: `slot-${i}` },
          onclick: () => { mix.bowl.splice(i, 1); SE.click(); redrawMix(`slot-${Math.max(0, i - 1)}`); } })
        : el("span.tf-bowl-slot.empty", { text: "—" }));
      const stage = result ? floorStage(result.mood) : null;
      const preview = el("div.tf-mix-preview", { dataset: { ...test("mix-preview"), grade: result?.grade || "", mood: result ? String(Math.round(result.mood)) : "" } }, info ? [
        traitBars(info.traits, { want: order?.trait, demand: order ? DEMAND[guest.rank] : null }),
        el("p.tf-mix-lines", {}, [
          order?.family ? el("span", { dataset: { apt: result.family }, text: `${FAMILY_LABEL[order.family]} ${APT_MARK[result.family]}` }) : null,
          info.synergies.length ? el("span", { dataset: { kind: "synergy" }, text: `相性 ${info.synergies.map(([a, b]) => `${TAG_LABEL[a]}×${TAG_LABEL[b]}`).join("、")}` }) : el("span", { dataset: { kind: "plain" }, text: "相性なし" }),
          result?.ngHit ? el("span", { dataset: { kind: "ng" }, text: `${NG[order.ng].label}に当たる！` }) : null,
          order?.must && !result.mustOk ? el("span", { dataset: { kind: "ng" }, text: `${FLAVORS[order.must].label}が入っていない` }) : null,
        ]),
        result ? el("p.tf-mix-gauge", { style: { "--c": stage.color } }, [el("small", { text: "予想の満足" }), el("i", {}, [el("i", { style: { width: `${Math.round(result.mood)}%` } })]), el("b", { text: stage.label })]) : null,
        el("p.tf-mix-meta", { text: `作成 約${seconds(mixInfo(mix.bowl, { preset: isPreset }).time)}秒・原価 ${yen(info.cost)}` }),
      ] : [el("p.tf-mix-empty", { text: "棚か定番から、1〜3種を選ぶ" })]);
      const bowl = el("div.tf-mix-bowl", {}, [
        el("h3", { text: "ボウル（最大3種）" }),
        el("div.tf-bowl-slots", {}, slots),
        preview,
        el("div.tf-mix-actions", {}, [
          guest ? el("button.tf-option.tf-mix-confirm", { type: "button", disabled: !info, dataset: { ...test("mix-confirm"), key: "mix-confirm", primary: "true" }, onclick: confirmMix },
            [el("span", {}, [el("b", { text: "この一台で作る" })])]) : null,
          el("button.tf-option", { type: "button", disabled: !info || (!isPreset && state.presets.length >= PRESET_MAX) || (isPreset && state.presets.length <= 1),
            dataset: { ...test("mix-save"), key: "mix-save", primary: String(!guest) }, onclick: togglePreset },
            [el("span", {}, [el("b", { text: isPreset ? "定番から外す" : "定番に登録" })])]),
        ]),
      ]);
      return el("section.tf-mix", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-mix-title", dataset: test("mix") }, [
        head, el("div.tf-mix-body", {}, [presetsCol, shelf, bowl]),
        el("footer.tf-mix-foot", {}, [
          el("button.tf-link", { type: "button", text: guest ? "あとで" : "もどる", dataset: test("mix-later"), onclick: () => closeMix() }),
          el("small", { text: "目盛りは左から" }), traitLegend(),
        ]),
      ]);
    }

    // ---- 接客ビュー（ケア・会計）。開いている間、店の時間は止まる ----
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
    // 選んだ結果の印（◎ ○ △ ×）
    function verdictOf(events) {
      for (const e of events) {
        if (e.type === "care") return e.ok ? { mark: "best", text: "いいケア！", line: e.line } : { mark: "bad", text: "ちがったみたい", line: e.line };
        if (e.type === "bill") return { mark: e.fans >= 3 ? "best" : e.fans > 0 ? "good" : "miss", text: e.fans > 0 ? `ファン ＋${e.fans}` : "お見送り", line: e.line };
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
      const stage = floorStage(table.mood);
      let lead, options, kindLabel, tip = "";
      if (panel.kind === "care") {
        const call = CALLS[table.call.type];
        kindLabel = table.call.type === "coal" ? "温度調整" : "ケア";
        lead = state.hint === "said" ? (call.said.startsWith("（") ? call.said : `「${call.said}」`) : call.sight;
        options = VERBS.map((verb) => option(verb.label, verb.note, pick({ type: "care", tableId: table.id, verb: verb.id }), { icon: VERB_ICON[verb.id], key: verb.id }));
      } else {
        kindLabel = "お会計";
        lead = quoted(table.line || "お会計、お願いします");
        if (state.level < 2) tip = "満足した客にカードを渡すと、店のファンが増える";
        options = [
          option("ショップカードを渡す", `ファンが増える・${yen(COST.card)}`, pick({ type: "bill", tableId: table.id, card: true }), { icon: "order", key: "card" }),
          option("笑顔でお見送り", "いつもの見送り", pick({ type: "bill", tableId: table.id, card: false }), { icon: "smile", key: "bye" }),
        ];
      }
      options.forEach((node, i) => { node.dataset.digit = String(i + 1); });
      return el("section.tf-sheet", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-sheet-title", dataset: { ...test("sheet"), kind: panel.kind } }, [
        el("div.tf-sheet-lead", { style: { "--tf-mood-color": stage.color } }, [
          el("span.tf-sheet-kind", { text: kindLabel }),
          el("h2#tf-sheet-title.tf-sr", { text: `${table.id}卓 ${guest.name}、${kindLabel}` }),
          el("span.tf-sheet-face", {}, [glyph(stage.face)]),
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

    // ---- 準備（開店前）・休止・締め ----
    function start() {
      if (!alive()) return cancel();
      SE.select();
      setMode("live");
      renderLayer();
      lastAt = performance.now();
      sync();
      cutin("営業開始", plan.title);
      select(1, true);
    }
    function renderIntro() {
      const how = [
        ["order", "客は自分で座る。注文待ちの卓を押して、一台を調合する"],
        ["cook", "作成は同時に2台まで。待つ間に、ほかの卓を見る"],
        ["add", "炭の替え時や客の様子に、ケアで応える"],
        ["lamp", "ゲージが溜まったら、フィーバー"],
      ];
      const cost = Math.round(state.presets.reduce((sum, ids) => sum + mixInfo(ids).cost, 0) / state.presets.length);
      return el("section.tf-intro", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-intro-title", dataset: test("intro") }, [
        el("div.tf-intro-card", {}, [
          el("p.tf-eyebrow", { text: "tonari・ワンオペ営業" }),
          el("h2#tf-intro-title", { text: plan.title }),
          el("p.tf-forecast", { text: `今日の予報：${plan.forecast}${fans > 0 ? `　／　店のファン ${fans}人` : ""}` }),
          el("div.tf-prep", {}, [
            el("div.tf-prep-list", {}, [
              el("h3", { text: `今日の定番 ${state.presets.length}／${PRESET_MAX}` }),
              el("ul", {}, state.presets.map((ids) => { const t = mixInfo(ids).traits; return el("li", {}, [el("b", { text: mixLabel(ids) }), traitPips(TRAITS.map((x) => Math.round(t[x.id])))]); })),
              el("small", { text: `一台あたりの原価の目安 ${yen(cost)}` }),
            ]),
            el("div.tf-prep-side", {}, [radar(state.presets), el("small", { text: "定番の釣り合い" })]),
          ]),
          level === 0 ? el("ul.tf-how", {}, how.map(([icon, text]) => el("li", {}, [glyph(icon), el("span", { text })]))) : null,
          el("div.tf-options", { dataset: { count: level === 0 ? 1 : 2 } }, [
            option("開店する", "店の時間が流れはじめる", start, { primary: true, key: "start" }),
            level === 0 ? null : option("定番を組む", "棚から組んで登録する", () => { SE.select(); openMix(null, "intro"); }, { key: "edit-presets" }),
          ]),
          el("small.tf-intro-note", { text: "調合・ケア・会計を選んでいる間と休止中は、時間が止まります。店の売上は、はじめの所持金には入りません。" }),
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
      const closing = panel.kind === "close";
      return el("section.tf-pause", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-pause-title", dataset: test(closing ? "close-panel" : "pause-panel") }, [
        el("div.tf-intro-card", {}, [
          el("p.tf-eyebrow", { text: "tonari" }),
          el("h2#tf-pause-title", { text: closing ? "早じまいにする？" : "ひと休み" }),
          el("p", { text: closing
            ? "いまいる客を送り出して、店を閉めます。日当は変わりませんが、まだ来ていない客の分は売上になりません。"
            : "休止中は、店の時間が止まっています。" }),
          el("div.tf-options", { dataset: { count: closing ? 2 : 4 } }, closing ? [
            option("営業に戻る", "", resume, { primary: true, key: "resume" }),
            option("店を閉める", "", () => { panel = null; setMode("live"); renderLayer(); perform({ type: "finish" }); }, { key: "confirm-close" }),
          ] : [
            option("つづける", "", resume, { primary: true, key: "resume" }),
            option(speed === 1 ? "ゆっくりにする" : "ふつうの速さに戻す", speed === 1 ? "店の時間が遅くなる" : "今はゆっくり",
              () => { speed = speed === 1 ? 0.6 : 1; SE.select(); renderLayer(); layer.querySelector('[data-test="tonari-floor-option-speed"]')?.focus({ preventScroll: true }); }, { key: "speed" }),
            option("早じまいにする", "いまいる客を送り出して閉める", () => openPause("close"), { key: "close" }),
            option("本編メニュー", "", gameMenu, { key: "menu" }),
          ]),
        ]),
      ]);
    }
    function closeNight() {
      if (mode === "closing" || mode === "result") return;
      for (const t of [verdictTimer, cutinTimer]) clearTimeout(t);
      if (feverBgm) { playBgm(feverBgm); feverBgm = null; }
      panel = null; mix = null;
      setMode("closing");
      renderLayer();
      cutin("営業終了", state.closing === "early" ? "早じまい" : "おつかれさまでした");
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
    // 結果（精算）: 左に売上の内訳・原価・利益、右に評価・ファン・満足の内訳・好評だったミックス
    function renderResult() {
      const result = floorResult(state);
      const drinks = result.groups.reduce((sum, row) => sum + Math.round((row.drink || 0) / PRICE.drink), 0);
      const items = [
        ["お迎えした組", `${result.served}／${result.came}組`],
        ["チャージ", yen(result.items.charge)],
        ["シーシャ", yen(result.items.shisha)],
        [`ドリンク（${drinks}杯）`, yen(result.items.drink)],
        ["トップ替え（おかわり）", yen(result.items.top)],
      ];
      const minus = [["原価（フレーバー・炭）", `−${yen(result.cost)}`], ["サービス費（カード）", `−${yen(result.service)}`]];
      const registered = (m) => state.presets.some((ids) => mixKey(ids) === mixKey(m.ids));
      return el("section.tf-result", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-result-title", dataset: { ...test("result"), rank: result.rank } }, [
        el("div.tf-slip", {}, [
          el("p.tf-eyebrow", { text: `tonari・${result.title}・本日の精算` }),
          el("div.tf-slip-body", {}, [
            el("div.tf-slip-sales", {}, [
              el("dl.tf-slip-items", {}, items.map(([name, value]) => el("div", {}, [el("dt", { text: name }), el("dd", { text: value })]))),
              el("div.tf-slip-total", {}, [el("h2#tf-result-title", { text: "店の売上" }), el("strong", { text: yen(result.sales), dataset: test("final-sales") })]),
              el("dl.tf-slip-items.minus", {}, minus.map(([name, value]) => el("div", {}, [el("dt", { text: name }), el("dd", { text: value })]))),
              el("div.tf-slip-profit", {}, [el("b", { text: "利益" }), el("strong", { text: yen(result.profit), dataset: test("profit") })]),
            ]),
            el("div.tf-slip-side", {}, [
              el("div.tf-stamp", { dataset: { ...test("rank"), rank: result.rank } }, [el("i", { "aria-hidden": true }), el("b", { text: result.stamp })]),
              el("p.tf-slip-fans", { dataset: { ...test("fans"), down: String(result.fans < 0) }, text: `店のファン ${result.fans >= 0 ? "＋" : "−"}${Math.abs(result.fans)}人（合計 ${Math.max(0, fans + result.fans)}人）` }),
              el("p.tf-slip-stages", {}, MOODS.filter((m) => result.stages[m.id]).map((m) => el("span", { style: { "--c": m.color }, text: `${m.label} ${result.stages[m.id]}組` }))),
              el("h3", { text: "好評だったミックス" }),
              el("ul.tf-slip-mixes", {}, result.mixes.length ? result.mixes.map((m, i) => el("li", {}, [
                el("span", { text: `${i + 1}. ${m.label}` }), el("small", { text: `${floorStage(m.avg).label}・${m.n}台` }),
                registered(m) ? el("small.on", { text: "定番" })
                  : el("button.tf-chip-button", { type: "button", text: "定番に登録", disabled: state.presets.length >= PRESET_MAX, dataset: test(`result-save-${i}`),
                    onclick: () => { state = floorAct({ ...state, done: false }, { type: "preset", op: "add", mix: m.ids }); state.done = true; SE.select(); renderLayer(); } }),
              ])) : [el("li", {}, [el("small", { text: "提供できた一台がありませんでした" })])]),
            ]),
          ]),
          el("p.tf-slip-counts", { text: `いいケア ${result.counts.care}回・追加ドリンク ${result.counts.drink}杯・自然延長 ${result.counts.extend}組・フィーバー ${result.fevers}回` }),
          el("p.tf-slip-sumi", {}, [
            sumiFace ? el("img", { src: sumiFace, alt: "", draggable: false }) : null,
            el("span", { text: `スミ「${result.comment}」` }),
          ]),
          el("p.tf-slip-bonus", { dataset: { none: String(!result.bonus) }, text: result.bonus
            ? `店からの売上ボーナス ＋${yen(result.bonus)}（日当とは別）` : "今回の売上ボーナスはなし（日当はいつもどおり）" }),
          el("div.tf-options", { dataset: { count: 1 } }, [
            option("シフトを終える", "", () => settle(alive() ? floorResult(state) : null), { primary: true, key: "continue" }),
          ]),
        ]),
      ]);
    }
    const sumiFace = faceIconUrl("sumi");
    function renderLayer() {
      if (!alive()) return cancel();
      const node = mode === "intro" ? renderIntro() : mode === "mix" ? renderMix() : mode === "panel" ? renderPanel() : mode === "pause" ? renderPause()
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
        else if (mode === "mix") closeMix();
        else if (mode === "pause") resume();
        else if (mode === "live") openPause();
        return;
      }
      if (mode === "live") {
        if (event.key === "f" || event.key === "F") { event.preventDefault(); useFever(); return; }
        if (event.target instanceof HTMLButtonElement && event.target.classList.contains("tf-seat")) {
          // 動かす起点は、いまフォーカスのある卓（マウスを乗せて選んだ卓とは別のことがある）
          const next = spotInDirection(SPOTS, Number(event.target.closest(".tf-spot")?.dataset.id) || selected, event.key);
          if (next) { event.preventDefault(); SE.click(); select(next, true); }
        }
        return;
      }
      const buttons = [...layer.querySelectorAll("button:not(:disabled)")];
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
        const at = buttons.indexOf(document.activeElement);
        if (buttons.length && at >= 0) {
          event.preventDefault();
          const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
          buttons[(at + step + buttons.length) % buttons.length].focus();
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
