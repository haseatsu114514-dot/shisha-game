// tonari フロア営業の画面（ワンオペ・ミックスを一覧から選ぶ形）。店の時間は実時間で流れ、ミックスやケアを選んでいる間と
// フィーバーの突入演出・休止・別タブの間は止まる（営業の時計と、画面の動きの時計は別）。
// 画面の構成: 上＝仕込み中の一台（左）・残り時間（中央）・売上（右）／右＝ミックスの一覧（原作の、控えの列にあたる）／卓の上＝卓の札／
//   下＝選んでいる卓の詳細（左）・出来事の行とはじめの心の声（中央）・フィーバーのゲージ（右）。
// 注文待ちの卓を押すと、店内がその卓へ寄り、左にミックスの列が出る（属性の印と、客の気分との合い方 ◎ ○ × つき。シャッフルできる）。
// 文字で説明しすぎない: 気分とミックスの属性は色と印（wishChip・attrBadge）で見せ、卓の札の見出しは押すと進む用件の時だけ出す。
// 炭の調整（頼まれる前に自分から）と会計は、卓を押すだけ。客からの頼み（ケア）は、卓へ寄って5つの手から選ぶ。
// 状態と金額は tonari-floor-model.js から読むだけで、本編の所持金・在庫・日付には触れない。
import { el, yen } from "../core/util.js";
import { FLOOR_COMMISSION_PERCENT } from "../core/shift-pay.js";
import { dirhamText } from "../chapters/ch4-dubai-local.js";
import { showScreen, clearScreen, retire, toast } from "../core/ui.js";
import { SE, playBgm, preloadBgm, requestedBgm } from "../core/audio.js";
import { state as gameState } from "../core/state.js";
import { displayName, faceIconUrl } from "../core/data.js";
import { buildVersioned } from "../core/asset-version.js";
import { sideSlot, releaseSideSlot } from "../core/side-area.js";
import {
  createFloorNight, floorTick, floorAct, floorTap, floorOrderTarget, floorHint, floorResult, floorUrgency, floorWaitLeft,
  floorStayLeft, floorCoalLeft, floorTendDue, floorMaking, floorHand, floorShuffleLeft, floorTimeLeft, floorStage, floorBill, floorFeverReady,
  mixName, mixNameParts, mixFlavorParts, mixFullName, floorOutlook, floorPlan, floorFeverMax, floorFeverCost, floorFeverLength, FLOOR_TICK_MS,
  floorCallLine, floorDusk, createFloorTutorial, floorTutorialCue,
} from "./tonari-floor-model.js";
import {
  MIXES, WISHES, VERBS, CALLS, MOODS, VISITORS, TUTORIAL,
} from "./tonari-floor-data.js";
import { floorVenue } from "./floor-venues.js";
import { glyph, guestArt } from "./tonari-floor-art.js";
import { FLOOR_ART, artUrl, currentStage, floorArtPath, spotCenter } from "./tonari-floor-stage.js";

/**
 * 検査用。manual を立てると実時間では進まず、api.tick(n) で刻みを送る。
 * verdictMs＝判定の印を見せる長さ（ミリ秒）。省くと実時間では1秒、manual では0（すぐ閉じる）。
 * instant を立てると画面を出さずにすぐ返す（店番を通り過ぎるだけの検査用。営業は開店してすぐ早じまい、チュートリアルは飛ばした扱い）。
 */
export const floorTest = { manual: false, api: null, verdictMs: null, instant: false };
// ブラウザ検査の既定（remake/test/browser/support.mjs が "suien_floor" を "instant" にする）。シフトを通り過ぎるだけの検査で、店番を回さない。
// 店番そのものの検査（tonari_floor.mjs）は外す。遊ぶ時は使わない。デバッグの試遊（mount）には効かない
const instantFloor = () => { if (floorTest.instant) return true; try { return globalThis.localStorage?.getItem("suien_floor") === "instant"; } catch { return false; } };
/** たまに遊びに来る本編の人物の表（来る条件は tonari.js が決める）。 */
export const FLOOR_VISITORS = VISITORS;

const WISH = Object.fromEntries(WISHES.map((w) => [w.id, w]));
const MOOD = Object.fromEntries(MOODS.map((m) => [m.id, m]));
// 提供した時の手応え: [言葉, 色, 判定の印]
const POP = { best: ["ぴったり！", "best", "best"], good: ["いい感じ", "best", "good"], off: ["ちがうかも", "off", "miss"] };
const MARK = { best: "markBest", good: "markGood", miss: "markMiss", bad: "markBad", drink: "glass", bill: "coin", anger: "anger" };
const CALL_ICON = { thin: "thin", harsh: "harsh", thirsty: "glass", cough: "ask", chatty: "talk" };
const VERB_ICON = { add: "add", ease: "ease", water: "drink", teach: "ask", chat: "talk" };
const APT_MARK = { best: "◎", good: "○", none: "×" };
const WISH_ICON = { fruit: "wishFruit", sweet: "wishSweet", fresh: "wishFresh", deep: "wishDeep" };
// フィーバーの曲: プリクラ用に作った平成ユーロビート（2026-11-20 オーナー「フィーバーのBGMはプリクラ用に作ったイケイケなアレで」）
const FEVER_BGM = "bgm_purikura";
// 画面を横切る帯（営業開始・フィーバー・営業終了）が出ている長さ。その間は、卓の札と手応えの言葉を出さない（文字の上に文字を重ねない。TFL45）
const CUTIN_MS = 1500;
const SHIFT_BGM = "tonari"; // フィーバーの前に流れていた曲が分からない時に戻す先
const SALES_STEP = 10000; // 店の売上がこの額をまたぐたびに、下の帯で知らせる
const test = (key) => ({ test: `tonari-floor-${key}` });
const quoted = (text) => (text.startsWith("（") ? text : `「${text}」`);
const seconds = (ticks) => Math.ceil(ticks * FLOOR_TICK_MS / 1000);
/** ミックスの名前を、決まった切れ目でだけ折れる形にする。 */
const mixSpans = (id) => mixNameParts(id).map((text) => el("span", { text }));
// 使ったフレーバー: ミックス名のあとに、必ず（）で添える（2026-11-20 オーナー「ミックス名はわたあめとかにしてもいいけど
// 必ず()で何のフレーバー使ったミックスなのかお願い。グラム数までは書かなくていい」・TFL44）。
// 狭い札では、まずフレーバーの切れ目（・のあと）で折れ、1つが1行に収まらない時だけ、長い名前の語の切れ目（データの「｜」）で折れる。
// 括弧は、隣の語から離れない
const recipeNode = (id) => {
  const flavors = mixFlavorParts(id);
  if (flavors.length < 2) return null; // 1種の物は、名前がそのまま中身（ダブルアップル単）。（）は付けない
  return el("span.tf-recipe", {}, flavors.map((words, i) => el("span.tf-recipe-flavor", {}, words.map((text, w) => el("span", {}, [
    i === 0 && w === 0 ? el("i.tf-paren", { text: "（", dataset: { side: "open" } }) : null,
    `${text}${w === words.length - 1 && i < flavors.length - 1 ? "・" : ""}`,
    i === flavors.length - 1 && w === words.length - 1 ? el("i.tf-paren", { text: "）", dataset: { side: "close" } }) : null,
  ])))));
};
/** 気分（＝属性）の札: 色と印と名前。label を渡すと、名前の代わりにその言葉（本編の人物の名指しの注文）。 */
function wishChip(id, label = null) {
  return el("span.tf-wish", { dataset: { wish: id, pref: String(!!label) }, style: { "--c": WISH[id].color } }, [glyph(WISH_ICON[id]), el("span", { text: label || WISH[id].label })]);
}
/** 客の注文の札。ふつうの客は気分、本編の人物は好きなフレーバーの名指し（色と印は気分のまま。TFL66）。 */
const orderChip = (order) => wishChip(order.wish, order.pref?.label || null);
/** 注文の呼び名（読み上げ・見出し）。 */
const orderLabel = (order) => (order.pref ? order.pref.label : `${WISH[order.wish].label}の気分`);
/** ミックスの属性の印: メイン（大きい。その気分の客に ◎）と、サブ（小さい。○）。 */
function attrBadge(id) {
  const { main, sub } = MIXES[id];
  const part = (attr, secondary = false) => {
    const sprite = artUrl(floorArtPath(`attr-${attr}${secondary ? "-sub" : ""}`));
    return el(secondary ? "i.tf-attr-sub" : "i.tf-attr-main", {
      style: { "--c": WISH[attr].color, "--tf-attr-art": `url("${buildVersioned(sprite)}")` },
    }, [glyph(WISH_ICON[attr])]);
  };
  return el("span.tf-attr", { role: "img", "aria-label": `${WISH[main].label}がメイン${sub ? `、${WISH[sub].label}がサブ` : ""}`, dataset: { main, sub: sub || "" } }, [
    part(main), sub ? part(sub, true) : null,
  ]);
}

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
 * @param opts.fans これまでの店のファンの合計（表示だけに使う）
 */
export function runTonariFloor({
  venue = "tonari",
  seed = 0, level = 0, chapter = 1, fans = 0, visitor = null, floorPerks = null, rainy = false, night = false, art = null,
  // night＝夜のシフト（絵と時計・呼び名を夜にする）。stage＝店内の絵と位置。guests・props＝絵の登録（検査と配置図で差し替える）
  stage = null, guests = FLOOR_ART.guests, props = FLOOR_ART.props, cutins = FLOOR_ART.cutins,
  // mount＝画面を載せる先（デバッグの試遊。省くと本編の画面として出す）。kind＝営業の種類を名指しする（省くと回数と天気で決まる）
  mount = null, kind = null,
  // topSales＝これまでの売上の最高（超えると、精算に「自己ベスト」が出る。0 は記録なし）
  topSales = 0,
  // getAllowances＝精算時に本編の店番でつく手当の合計を取得する
  getAllowances = () => 0,
  // dusk＝昼から夜まで通しの店番（本編のバイト。TFL62）。営業の半ばで日が暮れ、店内の絵を artNight（夜の絵）へ替える
  dusk = false, artNight = null,
  // tutorial＝チュートリアル（スミさんが横について一通りやらせる。TFL64）。結果は { tutorial: true, skipped }。
  // offerTutorial＝開店前の札に「遊び方（チュートリアル）」を出す（選ぶと { again: "tutorial" } を返す。呼び出し側がチュートリアルを開いてから、もう一度呼ぶ）
  tutorial = false, offerTutorial = false,
  isCurrent = () => true, signal = null,
} = {}) {
  if (signal?.aborted || !isCurrent()) return Promise.resolve(null);
  const v = floorVenue(venue);
  const r = v.rules;
  const venueSlots = r.slots;
  const venueShuffle = r.shuffle;
  const venueLastCall = r.lastCall;
  const venuePrice = v.price;
  const venueRanks = v.ranks;
  const tableCount = r.tableCount;
  const speaker = visitor === "minto" ? "oneesan" : visitor;
  const visitorName = gameState && (speaker === "oneesan" || speaker === "samechan") ? displayName(speaker, gameState) : null;
  const openNight = () => createFloorNight({ venue, seed, level, chapter, rainy, daytime: !night, visitor, visitorName, night: kind, dusk, floorPerks });
  if (!mount && instantFloor()) {
    if (tutorial) return Promise.resolve({ tutorial: true, skipped: true });
    const opened = openNight();
    return Promise.resolve(floorResult(floorAct(opened, { type: "finish" }), getAllowances()));
  }
  stylesheet();
  const layout = currentStage(stage || v.stage);
  const SPOTS = layout.spots.slice(0, tableCount);
  const seated = layout.style === "seated";
  const roomArt = layout.art ? artUrl(night ? layout.art.night : layout.art.day) : art;
  const duskArt = dusk && !night && !tutorial ? (layout.art ? artUrl(layout.art.night) : artNight) : null;
  const frontArt = layout.art ? artUrl(night ? layout.art.frontNight : layout.art.frontDay) : null;
  const shishaArt = artUrl(props?.shisha);
  const daytime = !night;
  let state = tutorial ? createFloorTutorial({ chapter, daytime }) : openNight();
  const plan = floorPlan(state);
  // 客の絵は、どこでも「丸の中の顔」（全身は描かない）。本編の人物は顔アイコン
  const artOf = (guest, { happy = false } = {}) => {
    const who = guest.charId === "minto" ? "oneesan" : guest.charId;
    const face = who ? faceIconUrl(who) : null;
    if (!face) return guestArt(guest, { happy, art: guests });
    const img = el("img", { src: face, alt: "", decoding: "async", draggable: false });
    const node = el("span.tf-guest-art", { "aria-hidden": true, dataset: { party: 1 } }, [el("span.tf-person", { dataset: { i: 0, face: "true" } }, [img])]);
    img.addEventListener("error", () => node.replaceWith(guestArt(guest, { art: guests })), { once: true }); // 顔アイコンを読めない時は影絵で出す
    return node;
  };
  let mode = "intro"; // intro → live ⇄ panel / pause / cutin → closing → result
  let panel = null, selected = 1, speed = 1, active = true, leaving = false, outerMenu = false;
  let carry = 0, lastAt = 0, timer = null, bannerTimer = null, verdictTimer = null, cutinTimer = null, bandTimer = null, lastHint = "", salesMark = 0;
  let feverBgm = null; // フィーバー中だけ、前に流れていた曲の名前を持つ（明けたらその曲へ戻す）
  // 手応えの演出（TFL46）: 売上の数字の回り方・フィーバーで増えた売上・いまの調子・残り10秒の刻み・ラストオーダーの知らせ
  let salesShown = 0, salesRaf = 0, feverSalesAt = 0, lastOutlook = null, outlookAt = -99, lastFinal = 99, lastCalled = false;
  let duskShown = false; // 日が暮れたのを知らせたか
  let coach = null; // チュートリアルの進み（{ index, step }）。本番の営業では null
  const calm = () => floorTest.manual || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; // 動きを省く時（検査の手動送り・動きを減らす設定）
  const refs = { spots: [] };

  return new Promise((resolve) => {
    // ---- 骨組み（一度だけ作り、あとは sync で書き換える。作り直すと動きが途切れる） ----
    const room = el("div.tf-room", {}, [
      roomArt ? el("img", { src: roomArt, alt: "", decoding: "async", draggable: false }) : null,
      // 昼から夜まで通しの店番: 日が暮れたら、夜の絵を上に重ねて灯す（host の data-dusk）
      duskArt ? el("img.tf-room-night", { src: duskArt, alt: "", decoding: "async", draggable: false, "aria-hidden": true }) : null,
      el("div.tf-glow", { "aria-hidden": true }, layout.lamps.map(([x, y, r]) => el("i", { style: { "--x": `${x}%`, "--y": `${y}%`, "--r": r } }))),
      el("div.tf-haze", { "aria-hidden": true }, [el("i"), el("i"), el("i")]),
    ]);
    const spotsBox = el("div.tf-spots", { role: "group", "aria-label": `全${tableCount}卓。矢印キーで選ぶ` });
    SPOTS.forEach((spot, i) => {
      const id = i + 1;
      const tap = () => tapTable(id);
      // 卓のボタン（読み上げとキーボードの入口）。専用の店内では席（丸の中の顔が出る）、会話用の店内画では卓の札と同じ所の押し所になる
      const seat = el("button.tf-seat", { type: "button", dataset: test(`table-${id}`), onclick: tap }, [el("span.tf-medal", {}, [el("span.tf-who")])]);
      seat.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse" && mode === "live") select(id); });
      // 卓の札: 上に用件（押すと進む時だけ）、箱の上の帯に客の気分（注文待ちの間だけ。色と印）、左に卓番号と客、右に顔（注文待ち・仕込み中は残り秒）、
      // 箱の下の棒は仕込みの進み（提供後は炭の残り）、左下の円は滞在の残り、右下は頼み・会計を待たせている残り秒
      const tagWant = el("b.tf-tag-want"), tagReq = el("span.tf-tag-req", {}, [el("span")]), tagWho = el("span.tf-tag-who");
      const tagFace = el("span.tf-tag-face"), tagBar = el("i"), tagCount = el("span.tf-tag-count");
      const bubble = el("button.tf-bubble", { type: "button", tabIndex: -1, "aria-hidden": true, onclick: tap }, [
        // 手応えの言葉・客のひとことは、見出しと同じ所（箱のすぐ上）に出す。出ている間は見出しを隠すので、札の上に札が重ならない
        el("span.tf-fx", { "aria-hidden": true }), tagWant,
        el("span.tf-tag-box", {}, [
          el("i.tf-burst", { "aria-hidden": true }), // 手応えの光の輪と火花（文字は足さない）
          tagReq, el("i.tf-tag-no", { text: String(id) }),
          el("span.tf-tag-cell", {}, [tagWho]), el("span.tf-tag-cell", {}, [tagFace]),
          el("i.tf-tag-anger", { "aria-hidden": true }, [glyph("anger")]), // 待たせている客の、怒りの印
          el("span.tf-tag-empty"), el("span.tf-tag-gauge", {}, [tagBar]),
        ]),
        el("span.tf-tag-foot", {}, [el("i.tf-tag-pie"), tagCount]),
      ]);
      const plate = el("button.tf-plate", { type: "button", tabIndex: -1, "aria-hidden": true, onclick: tap }, [el("b", { text: String(id) })]);
      const [sx, sy] = spotCenter(spot);
      const anchor = seated
        ? { "--bx": `${spot.bubble[0]}%`, "--by": `${spot.bubble[1]}%`, "--fx": `${spot.fx[0]}%`, "--fy": `${spot.fx[1]}%` }
        : { "--x": `${sx}%`, "--y": `${sy}%`, "--bx": `${sx}%`, "--by": `calc(${sy}% + 84px)`, "--fx": `${sx}%`, "--fy": `calc(${sy}% + 120px)` };
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
        plate, bubble,
      ]);
      refs.spots.push({ root, seat, plate, bubble, who: seat.querySelector(".tf-who"), fx: root.querySelector(".tf-fx"),
        tagWant, tagReq, tagWho, tagFace, tagBar, tagCount, tagEmpty: bubble.querySelector(".tf-tag-empty"),
        guestId: null, wantKey: "", reqKey: "", faceKey: "", countKey: "", happy: false });
      spotsBox.append(root);
    });
    if (frontArt) spotsBox.append(el("img.tf-front", { src: frontArt, alt: "", decoding: "async", draggable: false, "aria-hidden": true }));
    const cam = el("div.tf-cam", {}, [room, spotsBox]);
    const stageBox = el("div.tf-stage", {}, [cam]);

    // 上の帯は、触らない情報だけを小さく（2026-11-20 オーナー「UIシンプルにしたい。タイマーのサイズとか余計な情報入れない感じ。
    // タップしやすいサイズ感はいるから、触らないとこと、うまいことUIを組んで」・TFL49）。左に仕込み中、画面のまん中に残り時間と売上、右に休止
    // （2026-11-20 オーナー「中央に制限時間とか置いて欲しい」・TFL50）
    // 仕込み中: 器の印と、同時に仕込める枠の数だけ丸（満ちていく進み）。順番待ちの台数は「＋N」。どの卓の何かは、卓の札と読み上げに出す
    const makingPips = el("span.tf-making-pips", { "aria-hidden": true }, Array.from({ length: venueSlots }, () => el("i", { dataset: { on: "false" } })));
    const makingMore = el("i.tf-making-more", { hidden: true, "aria-hidden": true });
    const making = el("div.tf-making", { role: "img", "aria-label": "仕込み中: なし", dataset: test("making") }, [glyph("cook"), makingPips, makingMore]);
    const clockText = el("b", { text: "0:00", dataset: test("time-left") });
    const clockBar = el("i");
    const salesText = el("strong", { text: yen(0), dataset: test("sales") });
    // いまの調子: いま締めたらどの評価か。満足の平均のゲージに、評価の境目の刻み（まずまず・上々・大入り）
    const outlookFill = el("i");
    const outlookBar = el("span.tf-outlook", { role: "img", "aria-label": "いまの調子: まだ分からない", dataset: { ...test("outlook"), rank: "" } },
      [outlookFill, ...venueRanks.filter((rk) => rk.min > 0).map((rk) => el("b", { style: { left: `${rk.min}%` }, dataset: { rank: rk.id } }))]);
    const top = el("header.tf-top", {}, [
      making,
      el("div.tf-top-mid", {}, [
        el("div.tf-clock", {}, [el("small", {}, [glyph("clock"), el("span.tf-sr", { text: "残り時間" })]), clockText, el("span.tf-clock-bar", {}, [clockBar])]), // 残り時間は小さく
        el("div.tf-sales", {}, [el("small", {}, [glyph("coin"), el("span.tf-sr", { text: "店の売上" })]), el("span.tf-sales-main", {}, [salesText, outlookBar])]),
      ]),
      el("button.tf-pause-button", { type: "button", "aria-label": "休止", dataset: test("pause"), onclick: () => openPause() }, [glyph("pause")]),
    ]);
    // 右の列: ミックスの一覧（原作の、控えの列にあたる）。押すと、いちばん急ぎの注文待ちの卓へそのまま出す。全部は並ばないので、シャッフルで入れ替える
    const handList = el("div.tf-preset-list");
    // 出す先の卓は、店内の卓の札の点線の枠と、列の縁の色（その客の気分）で示す（TFL52 で列の上の番号の丸は無くし、空いた分を一覧に回した）
    // シャッフルは入れ替えに時間がかかる（その間はミックスを出せない）。かかる秒数を、ボタンの中に出す
    const shuffleSeconds = seconds(venueShuffle);
    const shuffleCost = `${shuffleSeconds}秒`;
    const countNumber = () => el("span", { text: String(shuffleSeconds) });
    const sideCount = countNumber();
    // 右の列では時計の横、親指ボタンの入れ替え中は輪の中に同じ秒数を出す。
    const shuffleFace = (number) => [
      el("span.tf-shuffle-main", {}, [
        el("img.tf-shuffle-emblem", { src: artUrl(floorArtPath("emblem-shuffle")), alt: "", "aria-hidden": "true", draggable: "false" }),
        el("span", { text: "シャッフル" }),
      ]),
      el("small.tf-shuffle-cost", {}, [
        glyph("clock"),
        el("span", { dataset: test("shuffle-count") }, [number, el("span.tf-shuffle-unit", { text: "秒" })]),
      ]),
    ];
    const shuffleButton = el("button.tf-shuffle", { type: "button", "aria-label": `シャッフル（${shuffleCost}かかる）`, dataset: test("shuffle-side"), onclick: () => doShuffle() }, shuffleFace(sideCount));
    // 入れ替えの最中に、一覧の上へ掛ける札（進みの棒と残り秒つき）
    const busyBar = el("i");
    const busySec = el("span.tf-busy-sec");
    const busyCover = el("div.tf-presets-busy", { "aria-hidden": true, dataset: test("shuffle-busy") }, [
      el("span.tf-busy-badge", {}, [glyph("shuffle")]),
      el("b", { text: "入れ替え中" }),
      el("span.tf-bar", {}, [busyBar]),
      busySec,
    ]);
    // 右の列は、画面の上の端から下の端まで。上にミックスの一覧、下にボタンの段（シャッフルとフィーバー。フィーバーはあとで足す）（TFL52）
    const actions = el("div.tf-actions", {}, [shuffleButton]);
    const side = el("aside.tf-presets", { "aria-label": "ミックスの一覧とフィーバー", dataset: { ...test("presets"), busy: "false" } }, [
      el("div.tf-preset-box", {}, [handList, busyCover]), actions,
    ]);
    // 下の帯は、出来事の行とはじめの心の声だけ（押すと、心の声が指す卓へ）。選んでいる卓のドックは無くした（卓の札と同じ情報のため。TFL49）
    const logLines = el("div.tf-log", { "aria-hidden": true, dataset: test("log") });
    const hintText = el("p", { dataset: test("advice") });
    const hajimeFace = faceIconUrl("hajime");
    const ticker = el("button.tf-ticker", { type: "button", onclick: () => followHint() }, [
      logLines,
      el("span.tf-advice", {}, [hajimeFace ? el("img", { src: hajimeFace, alt: "はじめ", draggable: false }) : null, hintText]),
    ]);
    const feverFill = el("i.tf-fever-fill");
    // フィーバーのボタンとゲージは、右の列のボタンの段（シャッフルの下）に置く（2026-11-20 オーナー「フィーバーボタンやゲージとか一部のボタンを
    // サイドバーに移動したり、スペースを活用して欲しい」・TFL41／「右のサイドバーにボタンとして設置したい」・TFL52）。一行の名前と、その下の3段目盛りゲージ
    const feverLabel = el("b", { text: "フィーバー" });
    const feverVal = el("span.tf-bonus-val", { "aria-hidden": true });
    const feverTicks = [];
    for (let mark = floorFeverCost; mark < floorFeverMax; mark += floorFeverCost) {
      feverTicks.push(el("i.tf-fever-tick", {
        dataset: { first: String(mark === floorFeverCost) },
        style: { left: `${(mark / floorFeverMax) * 100}%` },
      }));
    }
    const bonusButton = el("button.tf-bonus", { type: "button", dataset: test("bonus"), onclick: () => useFever() }, [
      el("span.tf-bonus-head", {}, [el("span.tf-bonus-lamp", {}, [glyph("lamp")]), feverLabel, feverVal]),
      el("span.tf-bonus-gauge", { "aria-hidden": true, style: { "--tf-fever-start": `${floorFeverCost / floorFeverMax * 100}%` } }, [feverFill, ...feverTicks]),
    ]);
    actions.append(bonusButton);
    const bottom = el("footer.tf-bottom", {}, [ticker]);
    // チュートリアルのスミさん（下の帯の所に出す。下の帯はその間は隠れるので、重ならない）。待つ段は時間が流れ、やる段は止まる
    const coachText = el("p.tf-coach-text", { dataset: test("coach-text") });
    const coachNextButton = el("button.tf-coach-next", { type: "button", text: "次へ", dataset: test("coach-next"), onclick: () => coachTalkDone() });
    const coachFace = faceIconUrl("sumi");
    const coachBox = tutorial ? el("div.tf-coach", { dataset: test("coach") }, [
      coachFace ? el("img", { src: coachFace, alt: "", draggable: false }) : null,
      el("div.tf-coach-body", {}, [el("b.tf-sr", { text: "スミ" }), coachText]),
      el("div.tf-coach-actions", {}, [
        coachNextButton,
        el("button.tf-coach-skip", { type: "button", text: "説明を飛ばす", dataset: test("coach-skip"), onclick: () => finishTutorial(true) }),
      ]),
    ]) : null;
    const layer = el("div.tf-layer");
    const banner = el("div.tf-banner", { "aria-hidden": true });
    const cutinBand = el("div.tf-cutin", { "aria-hidden": true });
    // 帯の表示は短いので、開店前に画像の読み込みを始める。
    function cutinImage(path, className) {
      const url = artUrl(path);
      if (!url) return null;
      const src = /^(data:|blob:)/.test(url) ? url : buildVersioned(url);
      const image = el(`img.${className}`, { src, alt: "", decoding: "async", draggable: false });
      void image.decode().catch(() => {}); // 短い帯が出る前に、画像を表示できる状態にしておく
      return image;
    }
    const cutinImages = new Map();
    for (const [name, art] of Object.entries(cutins || {})) {
      const background = cutinImage(typeof art === "string" ? art : art?.background, "tf-cutin-art");
      const portrait = cutinImage(art?.portrait, "tf-cutin-portrait");
      background?.addEventListener("load", () => {
        if (background.parentNode === cutinBand) cutinBand.dataset.art = "true";
      }, { once: true });
      cutinImages.set(name, { background, portrait });
    }
    const flash = el("div.tf-flash", { "aria-hidden": true });
    const announce = el("p.tf-sr", { "aria-live": "polite", "aria-atomic": "true" });
    const host = el("section.tonari-floor", { "aria-label": `${v.name} フロア営業`, dataset: {
      ...test("screen"), venue: v.id, night: String(night), mode, stage: layout.id, style: layout.style } }, [
      stageBox, top, side, bottom, coachBox, cutinBand, flash, layer, banner, announce,
    ]);
    host.dataset.tutorial = String(!!tutorial);
    host.style.setProperty("--tf-cutin-ms", `${CUTIN_MS}ms`);

    function settle(result) {
      if (!active) return;
      active = false;
      clearInterval(timer);
      for (const t of [bannerTimer, verdictTimer, cutinTimer, bandTimer]) clearTimeout(t);
      if (feverBgm) playBgm(feverBgm);
      signal?.removeEventListener("abort", cancel);
      document.removeEventListener("visibilitychange", onVisibility);
      host.removeEventListener("keydown", onKey);
      if (floorTest.api?.host === host) floorTest.api = null;
      document.removeEventListener("sidepadchange", placeActions);
      if (shuffleButton.parentElement !== actions) releaseSideSlot("floor");
      retire(host);
      // 営業の画面のままなら片付ける（本編のHUDが戻る）。LOAD などで別の画面に替わっていれば触らない。
      if (mount) host.remove();
      else if (!leaving && host.isConnected && document.body.dataset.screen === "tonari-floor") clearScreen();
      resolve(result);
    }
    const cancel = () => settle(null);
    const alive = () => active && isCurrent() && !signal?.aborted;

    /** いま店内に見えている絵（日が暮れたら夜の絵）。接客の画面で、卓へ寄せて映す。 */
    function shownArt() { return duskArt && floorDusk(state) ? duskArt : roomArt; }
    function setMode(next) {
      mode = next;
      host.dataset.mode = next;
      const blocked = next !== "live";
      for (const node of [spotsBox, top, side, ticker]) node.inert = blocked;
      placeActions();
    }
    // シャッフルとフィーバーのボタンは、親指ボタンの出る端末（横に余白のあるスマホ）では、画面外の右（会話の SKIP・次へ の所）に置く
    // （2026-11-20 オーナー「フィーバーとかシャッフルボタンは画面外の右側の、普段はオートとかスキップとかあるような画面外UIにボタンとして置いて」・TFL54）。
    // 余白の無い端末（PC・16:9）では、右の列の下（ボタンの段）のまま。置き場所が変わってもボタンは同じ物なので、表示の更新はそのまま効く
    function placeActions() {
      if (!active) return;
      const slot = host.isConnected ? sideSlot("floor", host) : null;
      if (slot) {
        if (bonusButton.parentElement !== slot) slot.replaceChildren(bonusButton, shuffleButton); // 親指にいちばん近い下の端に、よく押すシャッフル
        slot.dataset.mode = mode;
        slot.inert = mode !== "live";
      } else if (shuffleButton.parentElement !== actions) {
        releaseSideSlot("floor");
        actions.replaceChildren(shuffleButton, bonusButton);
      }
      host.dataset.gutter = String(!!slot);
    }
    document.addEventListener("sidepadchange", placeActions);
    // ---- 時計（営業の時間。止まっている間も、画面の動きは CSS が進める） ----
    function clock() {
      if (!alive()) return cancel();
      const now = performance.now();
      const dt = Math.min(1000, now - lastAt);
      lastAt = now;
      if (mode !== "live" || document.hidden || floorTest.manual) return;
      if (coach && !coach.step.wait) return; // チュートリアルは、待つ段だけ時間が流れる（少し速く）
      carry += dt * (coach ? 2 : speed);
      let steps = 0;
      while (carry >= FLOOR_TICK_MS) { carry -= FLOOR_TICK_MS; steps += 1; }
      if (steps) advance(steps);
    }
    function advance(steps) {
      if (!alive() || state.done) return;
      if (coach && !coach.step.wait) return;
      state = floorTick(state, steps);
      play(state.log);
      sync();
      if (state.done) closeNight();
      if (coach) coachCheck();
    }
    function perform(action) {
      if (!alive()) return cancel();
      if (coach && !coachExpects(action)) { coachNudge(); return false; } // チュートリアル: 今の段でやること以外は受けない
      const next = floorAct(state, action);
      if (next === state) return false;
      state = next;
      play(state.log);
      sync();
      if (state.done) closeNight();
      if (coach) coachDid(action);
      return true;
    }

    // ---- 出来事の手応え ----
    function pop(id, text, kind = "", mark = "") {
      const spot = refs.spots[id - 1];
      if (!spot) return;
      const node = el("span.tf-pop", { dataset: { kind } }, [mark ? glyph(MARK[mark]) : null, el("span", { text })]);
      // 同じ卓に続けて出た時は、新しい言葉に替える（言葉の上に言葉を重ねない。出来事の行には両方残る。TFL39）
      spot.fx.replaceChildren(node);
      node.addEventListener("animationend", () => node.remove(), { once: true });
      setTimeout(() => node.remove(), 1800);
    }
    // 卓の札の手応え: 弾む・光の輪と火花が散る・揺れる（kind＝chain / best / good / tend / coin / off）
    function hit(id, kind) {
      const spot = refs.spots[id - 1];
      if (!spot) return;
      spot.root.dataset.hit = "";
      void spot.root.offsetWidth; // 続けて起きた時に、動きを最初からやり直す
      spot.root.dataset.hit = kind;
      clearTimeout(spot.hitTimer);
      spot.hitTimer = setTimeout(() => { spot.root.dataset.hit = ""; }, 700);
    }
    // 画面全体の光（fever＝フィーバーの入り / soft＝明け / bad＝客が帰った）
    function flashNow(kind) {
      flash.dataset.on = "";
      void flash.offsetWidth;
      flash.dataset.on = kind;
    }
    // 売上の数字は、増えた分だけ回って上がる
    function rollSales(to) {
      cancelAnimationFrame(salesRaf);
      const from = salesShown, start = performance.now(), ms = calm() ? 0 : 420;
      const step = (now) => {
        const k = ms ? Math.min(1, (now - start) / ms) : 1;
        salesShown = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
        salesText.textContent = yen(salesShown);
        if (k < 1 && active) salesRaf = requestAnimationFrame(step);
      };
      step(start);
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
    // 画面を横切る帯。art＝絵の登録名（open / fever / close）。絵が届いていれば、帯の中に敷く
    function cutin(title, sub, kind = "", art = "") {
      const { background, portrait } = cutinImages.get(art) || {};
      cutinBand.replaceChildren(background || "", portrait || "", el("b", { text: title }), sub ? el("small", { text: sub }) : "");
      cutinBand.dataset.art = String(!!background?.naturalWidth);
      cutinBand.dataset.kind = kind;
      cutinBand.dataset.on = "false";
      void cutinBand.offsetWidth; // 同じ帯を続けて出す時に、動きを最初からやり直す
      cutinBand.dataset.on = "true";
      // 帯が消えきるまで、卓の札・手応えの言葉・まん中の札を出さない（帯の文字と重ねない）
      host.dataset.band = "true";
      clearTimeout(bandTimer);
      bandTimer = setTimeout(() => { cutinBand.dataset.on = "false"; host.dataset.band = "false"; }, CUTIN_MS);
    }
    function play(events) {
      for (const e of events) {
        const guest = e.guestId ? state.guests[e.guestId] : null;
        switch (e.type) {
          case "arrive":
            SE.doorbell();
            // 来店した客は、気分を吹き出しで言う
            pop(e.tableId, e.line, "say");
            if (e.rare) { SE.jingle(); log(`${guest.name}が遊びに来た！ ${e.tableId}卓へ`, "good"); }
            else log(`${e.tableId}卓　${guest.name}「${e.line}」`);
            break;
          case "left":
            SE.miss(); hit(e.tableId, "off"); flashNow("bad"); pop(e.tableId, "帰った…", "off", "anger");
            log(guest.charId ? `${e.tableId}卓　${guest.name}「${e.line}」` : `${e.tableId}卓の${guest.name}が、待ちきれずに帰ってしまいました`, "bad");
            break;
          case "order":
            SE.click(); log(`${e.tableId}卓　${e.refill ? "おかわりに" : ""}${mixName(e.mix)}を仕込みはじめた`);
            if (e.refill) { SE.money(); showBanner("トップ替え、いただきました！", `おかわり ＋${yen(venuePrice.top)}`); }
            break;
          case "shuffle": SE.whoosh(); log(`ミックスを入れ替える（${seconds(e.ticks)}秒かかる）`); break;
          case "shuffleDone": SE.select(); log("新しいミックスが並んだ", "good"); break;
          case "serve": {
            const [text, kind, mark] = POP[e.grade] || POP.good;
            // 流れ: ◎を続けて出すと、言葉が「2連続！」「3連続！」に変わり、音が一段ずつ上がる
            const chained = e.grade === "best" && e.streak >= 2;
            if (e.grade === "best") SE.chain(e.streak || 1); else if (e.grade === "off") SE.miss(); else SE.good();
            hit(e.tableId, chained ? "chain" : e.grade === "best" ? "best" : e.grade === "off" ? "off" : "good");
            pop(e.tableId, chained ? `${e.streak}連続！` : text, e.late >= 3 && kind === "best" ? "near" : kind, mark); // 待たせた分は、最初の満足から引かれている（札の色を一段落とす）
            say(e.tableId, e.line, e.grade === "off" ? "bad" : "good");
            break;
          }
          case "tend": SE.good(); hit(e.tableId, "tend"); pop(e.tableId, "いい調整", "best", "best"); log(`${e.tableId}卓　炭を整えた`, "good"); break;
          case "call": SE.tick(); log(e.coal ? `${e.tableId}卓　炭を見てほしそうです` : `${e.tableId}卓で、お客さんの様子が変わりました`, e.coal ? "bad" : ""); break;
          case "care":
            if (e.ok) { SE.perfect(); hit(e.tableId, "good"); pop(e.tableId, "いいケア", "best", "best"); } else { SE.miss(); hit(e.tableId, "off"); pop(e.tableId, "ちがった…", "off", "bad"); }
            say(e.tableId, e.line, e.ok ? "good" : "bad");
            break;
          case "callLate": SE.miss(); pop(e.tableId, "見逃した", "off"); log(`${e.tableId}卓の頼みを見逃しました`, "bad"); break;
          case "drink":
            SE.money();
            hit(e.tableId, "coin");
            pop(e.tableId, `＋${yen(venuePrice.drink)}`, "coin", "drink");
            log(`${e.tableId}卓　追加ドリンク注文！`, "good");
            break;
          case "extend":
            // おかわりも注文と同じく、吸いたい気分を聞いて、並んだミックスから選ぶ
            SE.perfect();
            hit(e.tableId, "best");
            pop(e.tableId, "おかわり！", "best", "best");
            say(e.tableId, e.line, "good");
            log(`${e.tableId}卓　おかわりの注文！「${e.line}」`, "good");
            break;
          case "refillMissed": SE.miss(); pop(e.tableId, "おかわり逃した", "off"); log(`${e.tableId}卓　おかわりを聞きそびれて、お会計に`, "bad"); break;
          case "billReady": SE.tick(); log(`${e.tableId}卓がお会計です`); break;
          case "bill":
            SE.money();
            hit(e.tableId, "coin");
            pop(e.tableId, e.fans > 0 ? `ファン ＋${e.fans}` : yen(e.total), e.fans > 0 ? "best" : "coin", e.fans > 0 ? "" : "bill");
            if (e.line) say(e.tableId, e.line, e.fans > 1 ? "good" : "");
            break;
          case "feverReady": SE.jingle(); log("フィーバーが使えます", "good"); break;
          case "feverStart": SE.just(); SE.whoosh(); flashNow("fever"); break;
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
    // 卓の札の上に出る用件: [記号, 言葉, 札の色, 見出しを出すか]。
    // 見出しを出すのは、押すと進む用件（注文・調整・頼み・会計）と「おかわり中」だけ。ほかは札の色と中身で分かるので、文字を出さない
    function wantFor(table) {
      const feverOn = table.fever && state.feverLeft > 0;
      switch (table.phase) {
        case "order": return ["order", table.refill ? "おかわり" : "注文", "act", true];
        case "prep": return ["cook", table.make.active ? "仕込み中" : "順番待ち", "wait", false];
        case "enjoy":
          if (feverOn) return ["lamp", "フィーバー", "fever", false];
          if (table.call) return state.hint === "said" ? [CALL_ICON[table.call.type], CALLS[table.call.type].label, "act", true] : ["alert", "様子が変だ", "act", true];
          if (floorTendDue(state, table.id)) return ["add", "炭の調整", "tend", true]; // 頼まれる前に、自分から行ける
          return table.extended ? ["top", "おかわり中", "fine", true] : ["lamp", "くつろぎ中", "fine", false];
        case "bill": return ["bill", "会計", "act", true];
        case "cool": return ["clean", "片付け中", "idle", false];
        default: return ["", "空席", "idle", false];
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
        phase: table.phase, tap, act: String(want[2] === "act"), tone: want[2], head: String(want[3]), smoke: String(table.phase === "enjoy"),
        queued: String(table.phase === "prep" && !table.make.active),
        served: String(table.phase === "enjoy" || table.phase === "bill"),
        urgent: urgency > 0.66 ? "high" : urgency > 0.33 ? "mid" : "", selected: String(selected === table.id),
        leaving: String(table.phase === "enjoy" && stay > 0 && stay <= 0.3), mood: stageId,
      });
      spot.root.style.setProperty("--stay", stay.toFixed(3));
      spot.root.style.setProperty("--tf-mood-color", stageId ? MOOD[stageId].color : "#d9c6a4");
      // 満足している客は、登録があれば笑顔の絵に替える（席に顔の丸が出る舞台だけ）
      const happy = seated && !!guest && table.mood >= 85 && !!stageId;
      if (spot.guestId !== (guest?.id || null) || spot.happy !== happy) {
        if (spot.guestId !== (guest?.id || null)) {
          spot.tagWho.replaceChildren(guest ? artOf(guest) : "");
          spot.root.dataset.rare = String(!!guest?.charId);
          spot.root.dataset.wish = guest?.order.wish || "";
          spot.root.style.setProperty("--c", guest ? WISH[guest.order.wish].color : "transparent");
        }
        spot.guestId = guest?.id || null;
        spot.happy = happy;
        spot.who.replaceChildren(guest ? artOf(guest, { happy }) : "");
        spot.root.dataset.party = guest ? String(guest.party) : "";
      }
      // 帯: 注文待ちの間だけ、客の気分（色と印と名前）。出したあとは畳む（満足の顔と炭の残りだけを見せる）
      const reqKey = guest && table.phase === "order" ? `${guest.order.wish}/${guest.order.pref?.label || ""}` : "";
      if (spot.reqKey !== reqKey) {
        spot.reqKey = reqKey;
        spot.tagReq.replaceChildren(reqKey ? orderChip(guest.order) : "");
        spot.tagReq.dataset.kind = reqKey ? "wish" : "";
      }
      const wantKey = want.join("/");
      if (spot.wantKey !== wantKey) {
        spot.wantKey = wantKey;
        spot.tagWant.replaceChildren(want[0] ? glyph(want[0]) : "", el("span", { text: want[1] }));
        // 片付け中は印だけ（言葉は読み上げに残す）
        spot.tagEmpty.replaceChildren(...(guest ? [] : [want[0] ? glyph(want[0]) : "", el("span.tf-sr", { text: want[1] })]));
      }
      // 右の窓: 注文待ちは残り秒（大きな数字）、仕込み中は器の印と残り秒（順番待ちは時計の印だけ）、提供後は満足の顔
      const left = floorWaitLeft(state, table.id);
      const making = table.phase === "prep" && table.make.active;
      const faceKey = table.phase === "order" ? `n${seconds(left)}` : table.phase === "prep" ? (making ? `p${seconds(table.make.left)}` : "queue")
        : stageId ? floorStage(table.mood).face + stageId : "";
      if (spot.faceKey !== faceKey) {
        spot.faceKey = faceKey;
        spot.tagFace.replaceChildren(...(table.phase === "order" ? [glyph("clock"), el("b", { text: String(seconds(left)) })]
          : table.phase === "prep" ? (making ? [glyph("cook"), el("b", { text: String(seconds(table.make.left)) })] : [glyph("clock")])
          : stageId ? [glyph(floorStage(table.mood).face)] : []));
      }
      // 箱の下の棒: 仕込みの進み。提供後は炭の残り（少なくなったら調整どき）
      const bar = table.phase === "prep" ? 1 - table.make.left / table.make.total : table.phase === "enjoy" ? floorCoalLeft(state, table.id) : 0;
      spot.tagBar.style.width = `${Math.round(bar * 100)}%`;
      spot.root.dataset.gauge = table.phase === "prep" ? "make" : table.phase === "enjoy" ? "coal" : "";
      // 頼み・会計を待たせている残り（秒）
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
      const active = list.slice(0, venueSlots);
      [...makingPips.children].forEach((pip, i) => {
        const m = active[i];
        pip.dataset.on = String(!!m);
        pip.style.setProperty("--p", m ? `${Math.round((1 - m.left / m.total) * 100)}%` : "0%");
      });
      const key = list.map((m) => `${m.tableId}/${m.active}`).join(",");
      if (making.dataset.key === key) return;
      making.dataset.key = key;
      const waiting = Math.max(0, list.length - venueSlots);
      makingMore.hidden = !waiting;
      makingMore.textContent = waiting ? `＋${waiting}` : "";
      making.dataset.busy = String(active.length);
      making.setAttribute("aria-label", list.length
        ? `仕込み中: ${active.map((m) => `${m.tableId}卓 ${m.label}`).join("、")}${waiting ? `。順番待ち ${waiting}台` : ""}` : "仕込み中: なし");
    }
    // 右の列: 並んでいるミックス。左に属性の印（メインが大きく、サブが小さい）。注文待ちの卓があれば、その客に合う札（◎・○）が灯り、合わない札は沈む
    function syncHand() {
      const target = floorOrderTarget(state, selected);
      const order = target ? state.guests[target.guestId].order : null;
      const wish = order?.wish || null;
      const hand = floorHand(state, order);
      const key = `${state.hand.join(",")}/${wish || ""}/${order?.pref?.label || ""}/${target?.id || ""}`;
      if (handList.dataset.key !== key) {
        handList.dataset.key = key;
        side.dataset.target = target ? String(target.id) : "";
        side.setAttribute("aria-label", target ? `ミックスの一覧（押すと${target.id}卓・${orderLabel(order)}へ出す）とフィーバー` : "ミックスの一覧とフィーバー");
        side.dataset.wish = wish || "";
        side.style.setProperty("--c", wish ? WISH[wish].color : "transparent");
        handList.replaceChildren(...hand.map((mix, i) => el("button.tf-preset", {
          type: "button", "aria-label": `${mixFullName(mix.id)}、${WISH[mix.main].label}${mix.sub ? `・${WISH[mix.sub].label}` : ""}${mix.rating ? `、${target.id}卓に${APT_MARK[mix.rating]}` : ""}`,
          dataset: { ...test(`mix-${i}`), mix: mix.id, main: mix.main, rating: mix.rating || "", single: String(mix.single) }, onclick: () => quickServe(mix.id),
        }, [attrBadge(mix.id), el("span.tf-preset-name", {}, mixSpans(mix.id)), recipeNode(mix.id), mix.rating && mix.rating !== "none" ? el("i.tf-match", { text: APT_MARK[mix.rating] }) : null])));
      }
      for (const spot of refs.spots) spot.root.dataset.target = String(String(target?.id || "") === spot.root.dataset.id);
      // 入れ替えの最中は、一覧を隠して進みを出す（ミックスは出せない）
      const wait = floorShuffleLeft(state);
      side.dataset.busy = String(wait > 0);
      for (const row of handList.children) row.disabled = wait > 0;
      const progress = `${Math.round((1 - wait / venueShuffle) * 100)}%`;
      busyBar.style.width = progress;
      shuffleButton.style.setProperty("--p", progress);
      shuffleButton.disabled = wait > 0;
      shuffleButton.dataset.wait = String(wait > 0);
      const count = String(wait > 0 ? seconds(wait) : shuffleSeconds);
      if (sideCount.textContent !== count) sideCount.textContent = count;
      const busyText = wait > 0 ? `あと${seconds(wait)}秒` : "";
      if (busySec.textContent !== busyText) busySec.textContent = busyText;
      // 合う一台が並んでいない時は、シャッフルを光らせる
      shuffleButton.dataset.call = String(!!target && wait === 0 && hand.every((mix) => mix.rating === "none"));
    }
    function sync() {
      state.tables.forEach((table, i) => syncSpot(refs.spots[i], table));
      syncMaking();
      syncHand();
      clockText.textContent = floorTimeLeft(state);
      clockBar.style.width = `${Math.max(0, 100 - (state.t / state.length) * 100).toFixed(1)}%`;
      host.dataset.late = String(state.length - state.t <= 60); // 残り30秒で時計を赤くする
      host.dataset.ordering = String(state.tables.some((x) => x.phase === "order")); // 注文待ちの卓がある間、ミックスの列を灯す
      if (salesText.dataset.value !== String(state.sales)) {
        if (salesText.dataset.value !== undefined) { salesText.dataset.bump = "false"; void salesText.offsetWidth; salesText.dataset.bump = "true"; }
        salesText.dataset.value = String(state.sales);
        rollSales(state.sales);
      }
      // いまの調子: 評価の段が変わったら、ゲージが光って、出来事の行で知らせる（続けては知らせない）
      const outlook = state.done ? null : floorOutlook(state);
      if (outlook) {
        outlookFill.style.width = `${outlook.score}%`;
        outlookBar.dataset.rank = outlook.rank;
        outlookBar.setAttribute("aria-label", `いまの調子: ${outlook.stamp}`);
        if (!lastOutlook) lastOutlook = outlook.rank;
        else if (lastOutlook !== outlook.rank && state.t - outlookAt >= 8) {
          const up = venueRanks.findIndex((rk) => rk.id === outlook.rank) < venueRanks.findIndex((rk) => rk.id === lastOutlook);
          lastOutlook = outlook.rank;
          outlookAt = state.t;
          outlookBar.dataset.bump = ""; void outlookBar.offsetWidth; outlookBar.dataset.bump = up ? "up" : "down";
          if (up) SE.select(); else SE.cancel();
          log(`いまの調子：${outlook.stamp}`, up ? "good" : "bad");
        }
      }
      // 流れ（◎の連続）が伸びるほど、フィーバーのゲージが強く光る
      bonusButton.dataset.streak = String(Math.min(3, Math.max(0, state.streak - 1)));
      // 残り10秒は、1秒ごとに刻む。ラストオーダー（新しい客が来なくなる時）は、まん中の札で知らせる
      const leftTicks = state.length - state.t, leftSec = Math.ceil(leftTicks / 2);
      host.dataset.final = String(leftSec <= 10 && !state.done);
      if (leftSec <= 10 && leftSec < lastFinal && !state.done && mode === "live") { lastFinal = leftSec; if (!calm()) SE.tick(); }
      if (!lastCalled && leftTicks <= venueLastCall && !state.done && mode === "live") {
        lastCalled = true;
        if (leftTicks > venueLastCall - 4) { SE.count(); showBanner("ラストオーダー", "新しい来店は、ここまで"); log("ラストオーダーです", ""); }
      }
      // 使った分だけ減るゲージ（最大300＝3ストック、100で15秒分・小分け使用可）。発動中は同じボタンで切り上げられる。
      const feverOn = state.feverLeft > 0;
      const feverReady = floorFeverReady(state);
      const feverCanUse = !feverOn && feverReady && state.tables.some((x) => x.phase === "enjoy");
      host.dataset.fever = feverOn ? "on" : feverReady ? "ready" : "";
      bonusButton.dataset.fever = host.dataset.fever; // 画面外の右に置いた時の見た目用（host の外なので、ボタン自身に持たせる）
      bonusButton.dataset.usable = String(feverOn || feverCanUse);
      bonusButton.disabled = !feverOn && !feverCanUse;
      const filled = state.fever / floorFeverMax * 100;
      feverFill.style.width = `${filled}%`;
      const stocks = Math.floor(state.fever / floorFeverCost);
      bonusButton.dataset.stocks = String(stocks);
      feverLabel.textContent = feverOn ? "終了する" : state.feverResume ? "再開する" : "フィーバー";
      const valText = feverOn ? `${seconds(state.feverLeft)}秒`
        : !feverCanUse && feverReady ? "待機"
        : state.feverResume ? `残${seconds(state.feverResume)}秒`
        : feverReady ? `×${stocks}`
        : `${Math.floor(state.fever)}/${floorFeverCost}`;
      if (feverVal.textContent !== valText) feverVal.textContent = valText;
      const action = feverOn ? "フィーバーを終了" : state.feverResume ? "フィーバーを再開" : feverReady ? "フィーバーを使う" : "フィーバー";
      bonusButton.setAttribute("aria-label", `${action}、ゲージ残り${Math.round(filled)}％`);
      // 日が暮れたら、店内の絵を夜へ（昼から夜まで通しの店番）。出来事の行で一度だけ知らせる
      if (duskArt && !duskShown && floorDusk(state)) {
        duskShown = true;
        host.dataset.dusk = "true";
        if (!state.done) log(v.duskLog || "外が暗くなってきた。夜の客が入りはじめる", "good");
      }
      const hint = floorHint(state);
      for (const spot of refs.spots) spot.root.dataset.guide = String(state.level === 0 && !coach && String(hint.tableId) === spot.root.dataset.id);
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
      syncHand(); // ミックスを出す先（選んでいる注文待ちの卓）が変わる
      if (focus) refs.spots[id - 1].seat.focus({ preventScroll: true });
    }
    function tapTable(id) {
      if (!alive() || mode !== "live") return;
      select(id);
      const tap = floorTap(state, id);
      // チュートリアル: 今の段で指している卓の、その用件だけを受ける（ほかの卓を押したら、スミさんが光っている所を指す）
      if (coach) {
        const want = coach.step.expect;
        const ok = !!want && want.tableId === id && (tap === "order" || tap === "care" ? coachOpens(tap, id) : tap === want.type);
        if (!ok) { SE.error(); coachNudge(); return; }
      }
      // 入れ替えの最中は、ミックスを出せない（列を開かない。その間に、ほかの卓を見る）
      if (tap === "order" && floorShuffleLeft(state) > 0) { SE.error(); pop(id, "入れ替え中…"); return; }
      if (tap === "order" || tap === "care") { openPanel(tap, id); return; } // 読んで選ぶもの（その間、時間は止まる）
      if (tap === "bill") { perform({ type: "bill", tableId: id }); return; } // 会計はひと押し（見送りの言葉は出来事の行に出る）
      if (tap === "tend") { perform({ type: "tend", tableId: id }); return; } // 炭の調整もひと押し（頼まれる前に行く）
      const table = state.tables[id - 1];
      SE.click();
      if (table.phase !== "empty") pop(id, table.phase === "prep" ? (table.make.active ? "仕込み中" : "順番待ち") : table.phase === "enjoy" ? "炭はまだ平気" : "片付け中");
    }
    function followHint() {
      if (mode !== "live") return;
      if (ticker.dataset.kind === "feverReady") return useFever();
      const id = Number(ticker.dataset.table);
      if (id) select(id, true);
    }
    // 右の列のミックスをひと押しで出す（いちばん急ぎの注文待ちの卓へ。選んでいる卓が注文待ちなら、その卓へ）
    function quickServe(mixId) {
      if (mode !== "live") return;
      const target = floorOrderTarget(state, selected);
      if (!target) { SE.error(); log("注文待ちの卓がありません"); return; }
      select(target.id);
      if (!perform({ type: "order", tableId: target.id, mix: mixId })) SE.error();
    }
    function doShuffle() {
      if (!perform({ type: "shuffle", tableId: selected })) { SE.error(); return; }
      // 入れ替えには時間がかかるので、列は閉じて店へ戻る（その間に、ほかの卓を見られる）
      if (mode === "panel" && panel?.kind === "order") closePanel({ cancel: false });
    }

    function useFever() {
      if (mode !== "live") return;
      if (state.feverLeft > 0) {
        if (!perform({ type: "feverStop" })) SE.error();
        return;
      }
      if (!perform({ type: "fever" })) { SE.error(); return; }
      if (state.done) return;
      // 突入の演出: 時間を止めて、帯と曲を切り替える
      feverSalesAt = state.sales;
      feverBgm = requestedBgm() || v.bgm || SHIFT_BGM;
      playBgm(FEVER_BGM);
      cutin("FEVER TIME!", `${state.tables.filter((x) => x.fever).length}卓が最高の居心地`, "fever", "fever");
      log("フィーバー！", "good");
      if (floorTest.manual) return;
      const focused = document.activeElement;
      setMode("cutin");
      cutinTimer = setTimeout(() => {
        if (!active || mode !== "cutin") return;
        setMode("live");
        lastAt = performance.now();
        focused?.focus({ preventScroll: true });
      }, CUTIN_MS);
    }
    function endFever() {
      if (!feverBgm) return;
      playBgm(feverBgm);
      feverBgm = null;
      flashNow("soft");
      log(`フィーバーが明けました（＋${yen(Math.max(0, state.sales - feverSalesAt))}）`, "good");
    }

    // ---- 選ぶ札（共通） ----
    function option(label, noteText, onPick, { icon = null, primary = false, key = "" } = {}) {
      return el("button.tf-option", { type: "button", onclick: onPick, dataset: { ...test(`option${key ? "-" + key : ""}`), primary: String(primary) } }, [
        icon ? glyph(icon) : null,
        el("span", {}, [el("b", { text: label }), noteText ? el("small", { text: noteText }) : null]),
      ]);
    }

    // ---- 接客の画面（注文＝ミックスを選ぶ／ケア＝頼みに応える）。左に大きな選択肢、右に卓の様子。開いている間、店の時間は止まり、
    //      店内の札・一覧・帯は隠れる（UI の上に UI を重ねない）。対応が済んだら、店へ戻る ----
    function openPanel(kind, id) {
      if (coach?.step.expect?.panel === kind && coach.step.expect.tableId === id) coachNext(); // 卓を開く段は、開いたら次へ
      panel = { kind, id, locked: false };
      setMode("panel");
      select(id);
      // 専用の画面に替わる。店内の帯や手応えは出したままにしない
      cutinBand.dataset.on = "false";
      banner.dataset.on = "false";
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
    // ミックスの札: 左に属性の印（メインが大きく、サブが小さい）、右に、この客との合い方（◎ ○ ×）
    function mixOption(mix, order, onPick, i) {
      return el("button.tf-option.tf-mix-option", { type: "button", onclick: onPick,
        "aria-label": `${mixFullName(mix.id)}、${WISH[mix.main].label}${mix.sub ? `・${WISH[mix.sub].label}` : ""}、${orderLabel(order)}に${APT_MARK[mix.rating]}`,
        dataset: { ...test(`option-mix-${i}`), mix: mix.id, main: mix.main, rating: mix.rating } }, [
        attrBadge(mix.id), el("span.tf-mix-text", {}, [el("b", { text: mix.name }), recipeNode(mix.id)]), el("i.tf-rate", { text: APT_MARK[mix.rating], dataset: { rating: mix.rating } }),
      ]);
    }
    function renderPanel() {
      const table = state.tables[panel.id - 1];
      const guest = state.guests[table.guestId];
      const pick = (action) => (event) => choose(action, event.currentTarget);
      const stage = floorStage(table.mood);
      const ordering = panel.kind === "order";
      const wish = WISH[guest.order.wish];
      let lead, options, kindLabel, extra = null;
      if (ordering) {
        kindLabel = orderLabel(guest.order);
        lead = quoted(guest.order.quote);
        options = floorHand(state, guest.order).map((mix, i) => mixOption(mix, guest.order, pick({ type: "order", tableId: table.id, mix: mix.id }), i));
        const wait = floorShuffleLeft(state) > 0;
        extra = el("button.tf-shuffle.tf-shuffle-big", { type: "button", disabled: wait, "aria-label": `シャッフル（${shuffleCost}かかる）`,
          dataset: { ...test("shuffle"), wait: String(wait), call: String(!wait && options.every((node) => node.dataset.rating === "none")) },
          onclick: () => doShuffle() }, shuffleFace(countNumber()));
      } else {
        const call = floorCallLine(state, table.id); // 本編の人物は、その人の口調で頼む
        kindLabel = table.call.coal ? "炭の調整" : "ケア";
        lead = state.hint === "said" ? (call.said.startsWith("（") ? call.said : `「${call.said}」`) : call.sight;
        options = VERBS.map((verb) => {
          const node = option(verb.label, verb.note, pick({ type: "care", tableId: table.id, verb: verb.id }), { icon: VERB_ICON[verb.id], key: verb.id });
          node.dataset.verb = verb.id;
          return node;
        });
      }
      options.forEach((node, i) => { node.dataset.digit = String(i + 1); });
      // チュートリアル: 今の段でやる一つだけを押せる（ほかは沈める）。画面の上に、スミさんの言葉を出す
      if (coach) {
        for (const node of options) {
          const ok = coachExpects(ordering ? { type: "order", tableId: table.id, mix: node.dataset.mix } : { type: "care", tableId: table.id, verb: node.dataset.verb });
          node.disabled = !ok;
          node.dataset.coach = ok ? "focus" : "off";
        }
      }
      // 右: 卓の様子。店内の絵をその卓へ寄せて映し、客の顔・客の言葉・いまの状態を出す（店内の札や帯は、この画面の間は隠れる）
      const [px, py] = SPOTS[table.id - 1].plate;
      const zoom = 2.4;
      const at = (p) => Math.max(0, Math.min(100, ((0.5 - (p / 100) * zoom) / (1 - zoom)) * 100)).toFixed(1);
      const served = table.phase === "enjoy" || table.phase === "bill";
      const bar = (label, kind, value) => el("span", {}, [el("small", { text: label }), el("i.tf-bar", { dataset: { kind } }, [el("i", { style: { width: `${Math.round(value * 100)}%` } })])]);
      const visit = el("aside.tf-visit", { dataset: test("visit"), style: { "--tf-mood-color": ordering ? wish.color : stage.color } }, [
        el("div.tf-visit-view", { style: shownArt() ? { backgroundImage: `url("${shownArt()}")`, backgroundSize: `${zoom * 100}% auto`, backgroundPosition: `${at(px)}% ${at(py)}%` } : {} }, [
          el("b.tf-visit-no", { text: `${table.id}卓` }),
          el("p.tf-sheet-quote", { text: lead, dataset: { sight: String(!ordering && state.hint === "sight") } }),
          el("span.tf-visit-who", { dataset: { party: guest.party } }, [artOf(guest)]),
          el("div.tf-verdict", { "aria-hidden": true }),
        ]),
        el("div.tf-visit-info", {}, [
          el("b", { text: guest.name }),
          ordering ? orderChip(guest.order) : el("span.tf-visit-mix", {}, [attrBadge(table.mix), el("span.tf-mix-text", {}, [el("b", { text: mixName(table.mix) }), recipeNode(table.mix)])]),
          served ? el("span.tf-visit-face", {}, [glyph(stage.face)]) : null,
          served ? el("div.tf-visit-bars", {}, [bar("満足", "mood", table.mood / 100), bar("滞在", "stay", floorStayLeft(state, table.id)), bar("炭", "coal", floorCoalLeft(state, table.id))]) : null,
          el("span.tf-visit-bill", {}, [glyph("coin"), el("strong", { text: yen(floorBill(state, table.id)?.total || 0) })]),
        ]),
      ]);
      return el("section.tf-sheet", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-sheet-title", dataset: { ...test("sheet"), kind: panel.kind } }, [
        el("div.tf-sheet-main", {}, [
          el("header.tf-sheet-head", {}, [
            el("h2#tf-sheet-title", {}, [el("b", { text: String(table.id) }), el("span", { text: ordering ? "ミックスを選ぶ" : kindLabel })]),
            el("span.tf-sheet-kind", { dataset: { wish: ordering ? wish.id : "" }, style: ordering ? { "--c": wish.color } : {} }, [ordering ? orderChip(guest.order) : glyph(table.call.coal ? "add" : "ask")]),
          ]),
          coach ? el("p.tf-sheet-coach", { dataset: test("sheet-coach") }, [
            coachFace ? el("img", { src: coachFace, alt: "", draggable: false }) : null, el("span", { text: TUTORIAL[coach.step.id] || "" }),
          ]) : null,
          el("div.tf-options.tf-list", { dataset: { count: options.length } }, options),
          el("footer.tf-sheet-foot", {}, [
            el("button.tf-link", { type: "button", text: "あとで", dataset: test("sheet-later"), onclick: () => closePanel() }),
            extra,
          ]),
        ]),
        visit,
      ]);
    }



    // ---- チュートリアル（TFL64）: スミさんが一段ずつ「やること」を出し、それ以外は受けない。talk＝読んで「次へ」／wait＝時間を流して待つ／
    //      expect＝この操作をしたら次へ（panel＝その卓の接客の画面を開く）。cue＝段に入った時にスミさんが起こすこと（floorTutorialCue）。
    //      focus＝光らせる所（table＝卓の札／shuffle／hand＝右の一覧の◎の札／fever） ----
    const TUTORIAL_FLOW = [
      { id: "hello", talk: true },
      { id: "arrive", wait: (s) => s.tables[0].phase === "order" },
      { id: "wish", talk: true, focus: ["table", 1] },
      { id: "open", expect: { panel: "order", tableId: 1 }, focus: ["table", 1] },
      { id: "pick", expect: { type: "order", tableId: 1, rating: "best" } },
      { id: "prep", wait: (s) => s.tables[0].phase === "enjoy" && s.tables[1].phase === "order" },
      { id: "shuffle", expect: { type: "shuffle" }, focus: ["shuffle"] },
      { id: "shuffling", wait: (s) => floorShuffleLeft(s) === 0 },
      { id: "quick", expect: { type: "order", tableId: 2, rating: "best" }, focus: ["hand"] },
      { id: "prep2", wait: (s) => s.tables[1].phase === "enjoy" },
      { id: "care", cue: ["cough", 1], expect: { panel: "care", tableId: 1 }, focus: ["table", 1] },
      { id: "careAnswer", expect: { type: "care", tableId: 1, verb: "teach" } },
      { id: "tend", cue: ["coal", 2], expect: { type: "tend", tableId: 2 }, focus: ["table", 2] },
      { id: "bill", cue: ["bill", 1], expect: { type: "bill", tableId: 1 }, focus: ["table", 1] },
      { id: "fever", cue: ["fever"], expect: { type: "fever" }, focus: ["fever"] },
      { id: "feverWait", wait: (s) => s.feverLeft <= floorFeverLength - 4 },
      { id: "feverStop", expect: { type: "feverStop" }, focus: ["fever"] },
      { id: "done", talk: true },
    ];
    /** 今の段で、この操作をしてよいか（チュートリアルでなければ、いつでもよい）。 */
    function coachExpects(action) {
      const want = coach?.step.expect;
      if (!coach) return true;
      if (!want?.type || want.type !== action.type) return false;
      if (want.tableId && want.tableId !== action.tableId) return false;
      if (want.verb && want.verb !== action.verb) return false;
      if (want.rating) {
        const guest = state.guests[state.tables[action.tableId - 1]?.guestId];
        if (!guest || floorHand(state, guest.order).find((mix) => mix.id === action.mix)?.rating !== want.rating) return false;
      }
      return true;
    }
    /** 今の段で、その卓の接客の画面を開いてよいか。 */
    function coachOpens(kind, id) {
      const want = coach?.step.expect;
      return !!want && want.tableId === id && (want.panel === kind || (kind === "order" && want.type === "order"));
    }
    function coachNudge() {
      if (!coach) return;
      coachBox.dataset.nudge = "";
      void coachBox.offsetWidth;
      coachBox.dataset.nudge = "true";
      if (!coach.step.talk) coachText.textContent = TUTORIAL.nudge;
      clearTimeout(coach.nudgeTimer);
      coach.nudgeTimer = setTimeout(() => { if (coach) coachText.textContent = TUTORIAL[coach.step.id] || ""; }, 1600);
    }
    function coachFocus() {
      const [kind, id] = coach?.step.focus || [];
      for (const spot of refs.spots) spot.root.dataset.coach = String(kind === "table" && spot.root.dataset.id === String(id));
      shuffleButton.dataset.coach = String(kind === "shuffle");
      bonusButton.dataset.coach = String(kind === "fever");
      side.dataset.coach = String(kind === "hand");
      for (const row of handList.children) row.dataset.coach = String(kind === "hand" && row.dataset.rating === "best");
    }
    /** 段に入る: スミさんの段取りを起こし、言葉と光らせる所を替える。待つ段がもう済んでいれば、すぐ次へ。 */
    function coachEnter(index) {
      const step = TUTORIAL_FLOW[index];
      if (!step) return finishTutorial(false);
      coach = { ...coach, index, step };
      if (step.cue) {
        state = floorTutorialCue(state, step.cue[0], step.cue[1] || null);
        play(state.log);
        sync();
      }
      clearTimeout(coach.nudgeTimer);
      coachText.textContent = TUTORIAL[step.id] || "";
      coachNextButton.hidden = !step.talk;
      coachBox.dataset.step = step.id;
      coachFocus();
      if (step.wait && step.wait(state)) { coachNext(); return; }
      if (step.talk && mode === "live") coachNextButton.focus({ preventScroll: true });
      // 接客の画面の中のスミさんの言葉も替える（画面は作り直さない。選んだ直後の判定の印を消さない）
      const inPanel = layer.querySelector('[data-test="tonari-floor-sheet-coach"] span');
      if (inPanel) inPanel.textContent = TUTORIAL[step.id] || "";
    }
    const coachNext = () => { if (coach) coachEnter(coach.index + 1); };
    function coachCheck() { if (coach?.step.wait?.(state)) coachNext(); }
    function coachDid(action) { if (coach && coach.step.expect?.type === action.type) coachNext(); }
    function coachTalkDone() {
      if (!coach?.step.talk || !alive()) return;
      SE.select();
      coachNext();
    }
    function startTutorial() {
      void preloadBgm(FEVER_BGM);
      setMode("live");
      renderLayer();
      lastAt = performance.now();
      sync();
      coach = { index: -1, step: TUTORIAL_FLOW[0], nudgeTimer: 0 };
      coachEnter(0);
    }
    function finishTutorial(skipped) {
      if (!coach || !alive()) return;
      clearTimeout(coach.nudgeTimer);
      SE.select();
      settle({ tutorial: true, skipped: !!skipped });
    }

    // ---- 準備（開店前）・休止・締め ----
    function start() {
      if (!alive()) return cancel();
      SE.select();
      void preloadBgm(FEVER_BGM); // フィーバーに入った時に、曲が遅れて鳴らないよう先に読んでおく
      setMode("live");
      renderLayer();
      lastAt = performance.now();
      sync();
      cutin("営業開始", plan.title, "", "open");
      select(1, true);
    }
    function renderIntro() {
      const how = (v.introHints || [
        ["order", "客の気分と同じ印のミックスを出す"],
        ["shuffle", "合うのが無ければシャッフル（{shuffle}かかる）"],
        ["add", "炭が減ったら、頼まれる前に調整へ"],
        ["lamp", "フィーバーはもう一度押すと終了。残りは次に使える"],
      ]).map(([icon, text]) => [icon, text.replace("{shuffle}", shuffleCost)]);
      return el("section.tf-intro", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-intro-title", dataset: test("intro") }, [
        el("div.tf-intro-card", {}, [
          el("p.tf-eyebrow", { text: v.subtitle }),
          el("h2#tf-intro-title", { text: plan.title }),
          el("p.tf-forecast", { text: `今日の予報：${plan.forecast}${fans > 0 ? `　／　店のファン ${fans}人` : ""}` }),
          // 気分（＝ミックスの属性）の色と印の見本
          el("p.tf-intro-wishes", { dataset: test("intro-wishes") }, WISHES.map((w) => wishChip(w.id))),
          level === 0 ? el("ul.tf-how", {}, how.map(([icon, text]) => el("li", {}, [glyph(icon), el("span", { text })]))) : null,
          el("div.tf-options", { dataset: { count: offerTutorial ? 2 : 1 } }, [
            option("開店する", "", start, { primary: true, key: "start" }),
            // 遊び方をもう一度（スミさんのチュートリアル。営業はその後で、同じ一日を始める）
            offerTutorial ? option("遊び方（チュートリアル）", "スミさんと一通りやってみる", () => { SE.select(); settle({ again: "tutorial" }); }, { key: "tutorial" }) : null,
          ]),
          level === 0 ? el("small.tf-intro-note", { text: "選んでいる間と休止中は、時間が止まります。店の売上は、はじめの所持金には入りません。" }) : null,
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
          el("p.tf-eyebrow", { text: v.name }),
          el("h2#tf-pause-title", { text: closing ? "早じまいにする？" : "ひと休み" }),
          el("p", { text: closing
            ? "いまいる客を送り出して、店を閉めます。基本給はそのまま受け取れます。歩合は閉店までの売上で決まります。"
            : "休止中は、店の時間が止まっています。" }),
          coach ? el("div.tf-options", { dataset: { count: 2 } }, [
            option("つづける", "", resume, { primary: true, key: "resume" }),
            option("説明を飛ばす", "そのまま営業へ", () => finishTutorial(true), { key: "skip-tutorial" }),
          ]) : el("div.tf-options", { dataset: { count: closing ? 2 : mount ? 3 : 4 } }, closing ? [
            option("営業に戻る", "", resume, { primary: true, key: "resume" }),
            option("店を閉める", "", () => { panel = null; setMode("live"); renderLayer(); perform({ type: "finish" }); }, { key: "confirm-close" }),
          ] : [
            option("つづける", "", resume, { primary: true, key: "resume" }),
            option(speed === 1 ? "ゆっくりにする" : "ふつうの速さに戻す", speed === 1 ? "店の時間が遅くなる" : "今はゆっくり",
              () => { speed = speed === 1 ? 0.6 : 1; SE.select(); renderLayer(); layer.querySelector('[data-test="tonari-floor-option-speed"]')?.focus({ preventScroll: true }); }, { key: "speed" }),
            option("早じまいにする", "いまいる客を送り出して閉める", () => openPause("close"), { key: "close" }),
            mount ? null : option("本編メニュー", "", gameMenu, { key: "menu" }),
          ]),
        ]),
      ]);
    }
    function closeNight() {
      if (mode === "closing" || mode === "result") return;
      for (const t of [verdictTimer, cutinTimer]) clearTimeout(t);
      if (feverBgm) { playBgm(feverBgm); feverBgm = null; }
      panel = null;
      setMode("closing");
      renderLayer();
      cutin("営業終了", state.closing === "early" ? "早じまい" : "おつかれさまでした", "", "close");
      SE.doorbell();
      const show = () => {
        if (!alive()) return cancel();
        setMode("result");
        renderLayer();
        const result = floorResult(state);
        setTimeout(() => { if (active) { SE.stamp(); if (result.rank === "S") SE.fanfare(); else if (result.rank === "A") SE.jingle(); } }, 380);
        // 売上は、0から数え上がる（動きを省く時は、そのまま出す）
        const total = layer.querySelector('[data-test="tonari-floor-final-sales"]');
        if (total && !calm()) {
          const start = performance.now();
          let beat = -1;
          const step = (now) => {
            if (!active || !total.isConnected) return;
            const k = Math.min(1, (now - start) / 900);
            total.textContent = yen(Math.round(result.sales * (1 - (1 - k) ** 3)));
            const n = Math.floor(k * 9);
            if (n !== beat && k < 1) { beat = n; SE.tick(); }
            if (k < 1) requestAnimationFrame(step); else { total.dataset.done = "true"; SE.money(); }
          };
          requestAnimationFrame(step);
        }
        layer.querySelector('[data-test="tonari-floor-option-continue"]')?.focus({ preventScroll: true });
      };
      if (floorTest.manual) show(); else setTimeout(show, CUTIN_MS);
    }
    // 結果（精算）: 左に売上の内訳と合計、右に評価・ファン・満足の内訳・好評だったミックス（原価・利益は扱わない）
    function renderResult() {
      const result = floorResult(state, getAllowances());
      const pay = result.pay;
      const commissionPercent = v.entry?.commissionPercent ?? FLOOR_COMMISSION_PERCENT;
      const record = topSales > 0 && result.sales > topSales; // これまでの売上の最高を超えた
      const drinks = result.groups.reduce((sum, row) => sum + Math.round((row.drink || 0) / venuePrice.drink), 0);
      const items = [
        ["お迎えしたお客さん", `${result.served}／${result.came}人`],
        ["チャージ", yen(result.items.charge)],
        ["シーシャ", yen(result.items.shisha)],
        [`ドリンク（${drinks}杯）`, yen(result.items.drink)],
        ["トップ替え（おかわり）", yen(result.items.top)],
      ];
      return el("section.tf-result", { role: "dialog", "aria-modal": "true", "aria-labelledby": "tf-result-title", dataset: { ...test("result"), rank: result.rank } }, [
        el("div.tf-slip", {}, [
          el("p.tf-eyebrow", { text: `${v.name}・${result.title}・本日の精算` }),
          el("div.tf-slip-body", {}, [
            el("div.tf-slip-sales", {}, [
              el("dl.tf-slip-items", {}, items.map(([name, value]) => el("div", {}, [el("dt", { text: name }), el("dd", { text: value })]))),
              el("div.tf-slip-total", {}, [
                el("h2#tf-result-title", { text: "店の売上" }),
                el("strong", { text: yen(result.sales), dataset: { ...test("final-sales"), value: String(result.sales) } }),
                v.currency === "aed" && result.sales > 0 ? el("small", { text: `（${dirhamText(result.sales)}）` }) : null,
              ]),
              // これまでの売上の最高を超えた夜だけ、合計の下に出す
              record ? el("p.tf-slip-record", { dataset: test("record") }, [el("b", { text: "自己ベスト！" }), el("span", { text: `これまで ${yen(topSales)}` })]) : null,
              result.visitor ? el("p.tf-slip-visitor", { dataset: test("visitor"), text: `今日は、${state.guests.g3.name}が遊びに来た` }) : null,
            ]),
            el("div.tf-slip-side", {}, [
              el("div.tf-stamp", { dataset: { ...test("rank"), rank: result.rank } }, [el("i", { "aria-hidden": true }), el("b", { text: result.stamp })]),
              el("p.tf-slip-fans", { dataset: { ...test("fans"), down: String(result.fans < 0) }, text: `店のファン ${result.fans >= 0 ? "＋" : "−"}${Math.abs(result.fans)}人（合計 ${Math.max(0, fans + result.fans)}人）` }),
              el("p.tf-slip-stages", {}, MOODS.filter((m) => result.stages[m.id]).map((m) => el("span", { style: { "--c": m.color }, text: `${m.label} ${result.stages[m.id]}人` }))),
              el("h3", { text: "好評だったミックス" }),
              el("ul.tf-slip-mixes", {}, result.mixes.length ? result.mixes.map((m, i) => el("li", {}, [
                el("span", {}, [el("b", { text: String(i + 1) }), attrBadge(m.id), el("span.tf-mix-text", {}, [el("span.tf-slip-mix", {}, mixSpans(m.id)), recipeNode(m.id)])]), el("small", { text: `${floorStage(m.avg).label}・${m.n}台` }),
              ])) : [el("li", {}, [el("small", { text: "提供できた一台がありませんでした" })])]),
            ]),
          ]),
          el("p.tf-slip-counts", { text: `いい調整 ${result.counts.tend}回・いいケア ${result.counts.care}回・追加ドリンク ${result.counts.drink}杯・おかわり ${result.counts.extend}人・フィーバー ${result.fevers}回${result.streak >= 2 ? `・ぴったり ${result.streak}連続` : ""}` }),
          // 大入りの夜は、紙吹雪で祝う（文字は足さない）
          result.rank === "S" ? el("div.tf-confetti", { "aria-hidden": true }, Array.from({ length: 22 }, (_, i) => el("i", { style: { "--i": String(i) } }))) : null,
          el("p.tf-slip-sumi", {}, [
            bossFace ? el("img", { src: bossFace, alt: "", draggable: false }) : null,
            el("span", { text: `${bossName}「${result.comment}」` }),
          ]),
          el("p.tf-slip-pay", { dataset: test("pay") }, [
            el("span", { text: `基本給 ${yen(pay.base)}` }),
            el("span", { text: `＋ 歩合（売上の${commissionPercent}%）${yen(pay.commission)}` }),
            pay.allowances ? el("span", { text: `＋ 手当 ${yen(pay.allowances)}` }) : null,
            el("strong", { text: `＝ 支給額 ${yen(pay.total)}` }),
          ]),
          el("div.tf-options", { dataset: { count: 1 } }, [
            option("シフトを終える", "", () => settle(alive() ? result : null), { primary: true, key: "continue" }),
          ]),
        ]),
      ]);
    }

    const bossFace = v.boss?.id ? faceIconUrl(v.boss.id) : null;
    const bossName = v.boss?.name || "店長";
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
        if (event.key === "f" || event.key === "F") { event.preventDefault(); if (!event.repeat) useFever(); return; }
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
      // チュートリアルの今の段（チュートリアルでなければ null）と、読む段の「次へ」
      coach: () => coach?.step.id || null, next: () => coachTalkDone(),
    };
    setMode("intro");
    sync();
    if (!tutorial) renderLayer();
    if (mount) mount.replaceChildren(host); else showScreen("tonari-floor", host);
    if (tutorial) startTutorial();
    lastAt = performance.now();
    timer = setInterval(clock, 100);
    requestAnimationFrame(() => {
      if (active && host.isConnected && !host.contains(document.activeElement)) layer.querySelector(".tf-option")?.focus({ preventScroll: true });
    });
  });
}
