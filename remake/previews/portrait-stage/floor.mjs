// 縦画面C案「煙の舞台」: 店番（tonari フロア営業）を縦へ移した試作（要望台帳 VPM02）。
// ルール・数値・客・ミックス・台詞は本編のもの（remake/js/daily/tonari-floor-model.js・tonari-floor-data.js）をそのまま呼ぶ。
// ここで作るのは縦の画面だけ: 上の画面＝16:9に近い形で写した店内と、その中の5つの卓のボックス／下の画面＝選んでいる卓の専用の画面（VPM17・VPM18）。
// 十字キーと丸ボタンは置かない（2026-11-27 オーナー「縦レイアウトは必ず十字ボタンや決定ボタンはいらない　その分を専用UIに」・VPM07）。
// 卓の札を押すと、下の画面がその卓のものに替わる（オーナー「卓をタップすると下画面がそれに応じたUIになる感じがいいかも」）:
//   注文待ち＝客の一言と、ミックス5つ（属性の印・名前・使ったフレーバー・その客との合い方 ◎○×。VPM08）／頼み＝客の一言と、5つの手（短い言葉の大きな札。VPM12）／
//   炭の調整・会計＝押したらその場で済む（本編と同じ）／それ以外＝その卓の様子（満足・炭・滞在・仕込みの進み）と、いまのミックスの棚。
//   注文と頼みを聞いている間は、店の時間が止まる（本編の「接客の画面」と同じ）。上の店内はそのまま見えていて、ほかの卓を押せばそちらへ移る。
// 上の画面に置くのは、卓のボックスと、残り時間・店の売上だけ（2026-11-27 オーナー「16:9に近い形で店全体を上に写して、その中に卓ごとにボックスを置き下で色々操作する感じ」
//   「左上のシーシャ作る本数のやついらない」「中間の横並びの卓のやつもいらない　その代わり卓をタップすると専用UIになる」・VPM18）。卓を選ぶのは、上の卓のボックスだけ。
// 会計の客が出たら、チリーンと鳴らす（VPM13。音はこの一つだけ）。
// 本編の進行・所持金・保存には触れない。
import {
  createFloorNight, createFloorTutorial, floorTick, floorAct, floorTap, floorTutorialCue, floorHint, floorResult,
  floorUrgency, floorWaitLeft, floorStayLeft, floorCoalLeft, floorTendDue, floorHand, floorShuffleLeft, floorTimeLeft, floorStage,
  floorFeverReady, floorOutlook, floorPlan, floorCallLine, floorDusk, floorBill, mixName, mixFlavorNames, mixIsSingle,
  floorFeverMax, floorFeverCost, floorFeverLength, FLOOR_TICK_MS,
} from "../../js/daily/tonari-floor-model.js";
import { MIXES, WISHES, VERBS, CALLS, MOODS, TUTORIAL, PRICE } from "../../js/daily/tonari-floor-data.js";
import { floorVenue } from "../../js/daily/floor-venues.js";

const VENUE = floorVenue("tonari");
const RULES = VENUE.rules;
const WISH = Object.fromEntries(WISHES.map((w) => [w.id, w]));
const seconds = (ticks) => Math.ceil(ticks * FLOOR_TICK_MS / 1000);
const yen = (n) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const quoted = (text) => (text.startsWith("（") ? text : `「${text}」`);
const BAND_MS = 1500; // 画面を横切る帯（営業開始・フィーバー・営業終了）が出ている長さ。本編と同じ
const SALES_STEP = 10000;

// 卓の並び: 上に3つ・下に2つ（卓の番号の若い順に座るので、上の段から埋まる）。x は画面の幅に対する %
const SEATS = [[17.6, 0], [50, 0], [82.4, 0], [33.8, 1], [66.2, 1]];
const UPPER = [1, 2, 3], LOWER = [4, 5];
// 上下キーで段を移る時の相手（来た卓を覚えていれば、そこへ戻る）
const ROW_MATE = { 1: 4, 2: 4, 3: 5, 4: 1, 5: 3 };

// 営業の種類（1台表示のつまみ・?shift= で選ぶ）
export const FLOOR_SHIFTS = {
  usual: { name: "いつもの昼", opts: { level: 1, kind: "usual", visitor: true } },
  first: { name: "はじめて", opts: { level: 0, kind: "first" } },
  full: { name: "満席の日", opts: { level: 6, kind: "full" } },
  tutorial: { name: "遊び方", opts: { tutorial: true } },
};
// 第1章で遊びに来る本編の人物（本編の VISITORS のうち、第1章に来られる3人）
const CH1_VISITORS = ["tsumugi", "naru", "adam"];

// 記号（24×24。本編 remake/js/daily/tonari-floor-art.js の GLYPHS と同じ形）
const FL_ICONS = {
  order: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  cook: '<path d="M5 11h14a7 7 0 0 1-14 0z"/><path d="M9 21h6M12 18v3"/><path d="M15 3l-3 8"/>',
  thin: '<path d="M9 21c-2-3 2-4 0-7s2-4 0-7"/><path d="M16 8v9m-3-3 3 3 3-3"/>',
  harsh: '<path d="M12 3c1 4 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500 0 2 1 3 2 3 1.500-1.500 1.500-5 1-8.500z"/>',
  glass: '<path d="M7 4h10l-1.200 15a1.500 1.500 0 0 1-1.500 1.400H9.700a1.500 1.500 0 0 1-1.500-1.400z"/><path d="M7.600 9h8.800"/>',
  ask: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><path d="M10 9.200a2 2 0 1 1 3 1.700c-.700.400-1 .800-1 1.500"/><path d="M12 14.400v.100"/>',
  talk: '<path d="M4 5h16v11H10l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
  top: '<path d="M5 12a7 7 0 0 1 12-5l2 2"/><path d="M19 5v4h-4"/><path d="M19 12a7 7 0 0 1-12 5l-2-2"/><path d="M5 19v-4h4"/>',
  bill: '<path d="M6 3h12v18l-2-1.500-2 1.500-2-1.500-2 1.500-2-1.500-2 1.500z"/><path d="M9 8h6M9 12h6"/>',
  clean: '<path d="M9 4l1.500 4.500L15 10l-4.500 1.500L9 16l-1.500-4.500L3 10l4.500-1.500z"/><path d="M17 14l.800 2.200L20 17l-2.200.800L17 20l-.800-2.200L14 17l2.200-.800z"/>',
  alert: '<path d="M12 5v9"/><path d="M12 18v.100"/>',
  add: '<path d="M4 11l5-3 5 3v6l-5 3-5-3z"/><path d="M4 11l5 3 5-3M9 14v6"/><path d="M19 3v6m-3-3h6"/>',
  ease: '<path d="M4 11l5-3 5 3v6l-5 3-5-3z"/><path d="M4 11l5 3 5-3M9 14v6"/><path d="M16 6h6"/>',
  lamp: '<path d="M12 2v3"/><path d="M8.500 5h7l2.500 8a6 6 0 0 1-12 0z"/><path d="M10 21h4M12 19v2"/>',
  coins: '<ellipse cx="12" cy="7" rx="6" ry="2.500"/><path d="M6 7v5c0 1.400 2.700 2.500 6 2.500s6-1.100 6-2.500V7"/><path d="M6 12v5c0 1.400 2.700 2.500 6 2.500s6-1.100 6-2.500v-5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  pause: '<path d="M9 6v12m6-12v12"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  anger: '<path d="M9.400 2.600c.400 3.900-2.200 6.500-6.800 6.800M14.600 2.600c-.400 3.900 2.200 6.500 6.800 6.800M9.400 21.400c.400-3.900-2.200-6.500-6.800-6.800M14.600 21.400c-.400-3.900 2.200-6.500 6.800-6.800"/>',
  star: '<path d="M12 3l2.700 5.600 6.100.800-4.500 4.200 1.100 6.100L12 16.800 6.600 19.700l1.100-6.100L3.200 9.400l6.100-.800z" class="f"/>',
  back: '<path d="M10 6l-6 6 6 6M4 12h16"/>',
  fans: '<path d="M12 20s-7.500-4.600-7.500-10A4.300 4.300 0 0 1 12 7.600 4.300 4.300 0 0 1 19.500 10c0 5.400-7.500 10-7.500 10z"/>',
  wishFruit: '<path d="M12 8.200c-1.700-1.300-4.700-1.100-6.100 1.100-1.600 2.500-.600 6.800 1.700 9.300 1.300 1.500 2.900 1.600 4.400.700 1.500.900 3.100.800 4.400-.700 2.300-2.500 3.300-6.800 1.700-9.300-1.400-2.200-4.400-2.400-6.100-1.100z" class="f"/><path d="M12 8.200c0-2.200 1-3.900 3.200-4.800"/>',
  wishSweet: '<circle cx="12" cy="12" r="4.600" class="f"/><path d="M7.600 12 3 8.200v7.600zM16.400 12 21 8.200v7.600z" class="f"/>',
  wishFresh: '<path d="M10.500 3H19l-5.600 7.100H18L4.700 21l4.400-8H4.600z" class="f"/>',
  wishDeep: '<path d="M19.600 14.900A8.200 8.200 0 1 1 9.100 4.400a6.600 6.600 0 0 0 10.500 10.500z" class="f"/>',
};
const WISH_ICON = { fruit: "wishFruit", sweet: "wishSweet", fresh: "wishFresh", deep: "wishDeep" };
const CALL_ICON = { thin: "thin", harsh: "harsh", thirsty: "glass", cough: "ask", chatty: "talk" };
const VERB_ICON = { add: "add", ease: "ease", water: "glass", teach: "ask", chat: "talk" };
const MOOD_ART = { max: "mood-max", good: "mood-good", ok: "mood-ok", low: "mood-low", mad: "mood-mad" };
const RATE_MARK = { best: "◎", good: "○", none: "×" };
const MEDAL = { S: "medal-s", A: "medal-a", B: "medal-b", C: "medal-c" };

/** 属性の印（メイン＝大きい角丸、サブ＝右下に重なる小さい丸）。絵は本編の印（remake/img/ui/tonari-floor/attr-*.webp）。 */
const attrHtml = (art, id) => {
  const { main, sub } = MIXES[id];
  return `<span class="fl-attr" role="img" aria-label="${WISH[main].label}がメイン${sub ? `、${WISH[sub].label}がサブ` : ""}"><img src="${art(`attr-${main}`)}" alt="">${sub ? `<img class="sub" src="${art(`attr-${sub}-sub`)}" alt="">` : ""}</span>`;
};

export class FloorScene {
  /** 場面の名札（app.mjs が読む）: 名前・光の色・1台表示のつまみの選び方・一覧（PC）に並べる場面。 */
  static META = {
    id: "floor", label: "店番", acc: "#ffc978",
    options: { name: "shift", default: "usual", values: Object.fromEntries(Object.entries(FLOOR_SHIFTS).map(([id, shift]) => [id, shift.name])) },
    gallery: {
      title: "店番（tonari のフロア営業）",
      note: "本編の店番（バイト）を縦へ。ルール・数値・客・ミックス・台詞は本編のものをそのまま使い、画面だけ縦に組んだ。上に16:9に近い形で店内を写し、その中に卓のボックスを置く。十字キーは無い。卓を押すと、下の画面がその卓の専用の画面（注文＝ミックス5つ／頼み＝5つの手／それ以外＝卓の様子と棚）に替わる。",
      shots: [
        { caption: "開店前", shot: "intro" },
        { caption: "営業中（下は、選んでいる卓の様子と棚）", shot: "live" },
        { caption: "注文を聞く（下が、その卓のミックス5つに）", shot: "order" },
        { caption: "頼みを聞く（下が、5つの手に）", shot: "care" },
        { caption: "フィーバー", shot: "fever" },
        { caption: "精算（1枚め・評価と売上）", shot: "result" },
        { caption: "精算（2枚め・内訳と日当）", shot: "result2" },
        { caption: "遊び方（スミさんと一通り）", shot: "coach", shift: "tutorial" },
      ],
    },
  };

  /**
   * @param phone 1台ぶんの画面（app.mjs の Phone）
   * @param kit app.mjs の部品（icon・esc・dpadHtml・aHtml・BTN・TOOL_SVG・ICONS・REMAKE_IMG）
   * @param opts shift＝営業の種類、shot＝一覧（PC）に並べる時の場面（intro / live / order / care / fever / result / result2 / coach）
   */
  constructor(phone, kit, { shift = "usual", shot = null } = {}) {
    Object.assign(this, { phone, kit, el: phone.el, shot });
    Object.assign(kit.ICONS, FL_ICONS);
    this.shiftId = FLOOR_SHIFTS[shift] ? shift : "usual";
    this.art = (name) => `${kit.REMAKE_IMG}ui/tonari-floor/${name}.webp`;
    this.roomDay = `${kit.REMAKE_IMG}backgrounds/bg_tonari_inside_day.webp`;
    this.roomNight = `${kit.REMAKE_IMG}backgrounds/bg_tonari_inside_night.webp`;
    this.face = (id) => `${kit.REMAKE_IMG}ui/face_icons/new/face_${id}.webp`;
    this.timers = new Set();
    this.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!phone.fixed) phone.extOpts.shot = null; // 途中の場面から開くのは一度だけ（入り直したら開店前から）
    this.open();
  }

  /** 営業を一つ作る（客の並びは開くたびに変わる。一覧では同じ並び）。 */
  open() {
    const { opts } = FLOOR_SHIFTS[this.shiftId];
    const seed = this.phone.fixed ? 20261127 : (Date.now() >>> 0);
    this.tutorial = !!opts.tutorial;
    this.s = this.tutorial ? createFloorTutorial({ chapter: 1, daytime: true })
      : createFloorNight({ seed, level: opts.level, chapter: 1, daytime: true, dusk: true, night: opts.kind,
        visitor: opts.visitor ? CH1_VISITORS[seed % CH1_VISITORS.length] : null });
    // ?fast=8 で店の時間を速める（動きの確認用。遊ぶ時は使わない）
    const fast = Number(new URLSearchParams(location.search).get("fast")) || 1;
    Object.assign(this, { mode: "intro", sel: 1, panel: null, pausePick: 0, speed: 1, fast, carry: 0, lastAt: 0, coach: null, band: false,
      salesShown: 0, salesMark: 0, lastOutlook: null, outlookAt: -99, lastCalled: false, duskShown: false, feverSalesAt: 0, resultPage: 0,
      back: {}, logs: [], lineLog: "", said: {}, reopen: 0 });
    this.plan = floorPlan(this.s);
    this.preload();
  }

  /** 客の顔（ふだんと笑顔）・満足の顔・判定の印・メダルを先に読んでおく（替わる瞬間に、窓が空にならないように）。 */
  preload() {
    const urls = [...Object.values(MOOD_ART), "verdict-best", "verdict-bad", ...Object.values(MEDAL)].map((name) => this.art(name));
    for (const guest of Object.values(this.s.guests)) {
      if (guest.charId) continue;
      const id = guest.art || guest.kind;
      urls.push(this.art(`guest-${id}`), this.art(`guest-${id}-happy`));
    }
    this.preloaded = urls.map((src) => Object.assign(new Image(), { src }));
  }

  later(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); if (!this.dead) fn(); }, ms);
    this.timers.add(id);
    return id;
  }

  destroy() {
    this.dead = true;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    cancelAnimationFrame(this.salesRaf);
  }

  /* ── 骨組み（一度だけ作り、あとは sync で書き換える。作り直すと動きが途切れる） ── */

  html() {
    const { kit } = this, { icon } = kit;
    const tables = SEATS.map(([x, row], i) => `<button class="fl-table" data-act="fl-table" data-id="${i + 1}" data-phase="empty" data-row="${row}" style="--x:${x}%">
        <span class="fl-head"><span class="fl-want"></span><span class="fl-fx"></span></span>
        <span class="fl-box"><i class="fl-burst"></i><span class="fl-who"></span><i class="fl-no">${i + 1}</i><span class="fl-cell"></span>
          <i class="fl-anger">${icon("anger")}</i><span class="fl-bar"><i></i></span></span>
        <i class="fl-pie"></i><span class="fl-count"></span>
      </button>`).join("");
    return `
      <img class="amb" src="${this.roomDay}" alt="">
      <div class="pic fl-room"><img class="bg" src="${this.roomDay}" alt=""><img class="bg fl-night" src="${this.roomNight}" alt=""><i class="fl-lights"></i></div>
      <i class="veil"></i>
      <div class="fl-hud">
        <span class="pill fl-status fl-status-clock">
          <span class="fl-clock">${icon("clock")}<b>0:00</b><i class="fl-timebar"><i></i></i></span></span>
        <span class="pill fl-status">
          <span class="fl-sales">${icon("coins")}<b>0</b><small>円</small>
            <i class="fl-outlook" role="img" aria-label="いまの調子: まだ分からない">${VENUE.ranks.filter((r) => r.min > 0).map((r) => `<u style="left:${r.min}%"></u>`).join("")}<i></i></i></span>
        </span>
      </div>
      <div class="fl-tables" role="group" aria-label="全${RULES.tableCount}卓">${tables}</div>
      <div class="fl-band" data-on="false"></div>
      <div class="fl-notice" data-on="false"></div>
      <i class="fl-flash"></i>
      <div class="body fl-body">
        <div class="telop fl-telop" data-slot="telop">
          <p class="fl-line" role="status" aria-live="polite"></p>
          <button class="coach fl-coach" data-act="fl-coach" aria-label="スミさんの言葉" hidden><img src="${this.face("sumi")}" alt=""><span class="say"><span class="say-text"></span><i class="fl-coach-next"></i></span></button>
        </div>
        <div class="fl-deck" data-slot="deck" data-busy="false" data-kind="info">
          <div class="fl-guest"></div>
          <div class="fl-main">
            <div class="fl-rows"></div>
            <div class="fl-info"></div>
            <div class="fl-busy">${icon("shuffle")}<b>入れ替え中</b><span class="fl-busy-bar"><i></i></span><small></small></div>
          </div>
          <div class="fl-acts" data-slot="acts"></div>
        </div>
      </div>
      <div class="fl-layer" data-slot="layer"></div>`;
  }

  mount() {
    const { el } = this, q = (sel) => el.querySelector(sel);
    this.refs = {
      room: q(".fl-room"), tables: [...el.querySelectorAll(".fl-table")].map((root) => ({ root, want: root.querySelector(".fl-want"), fx: root.querySelector(".fl-fx"),
        who: root.querySelector(".fl-who"), cell: root.querySelector(".fl-cell"), bar: root.querySelector(".fl-bar i"), count: root.querySelector(".fl-count"), keys: {} })),
      clock: q(".fl-clock b"), timebar: q(".fl-timebar i"), sales: q(".fl-sales b"), outlook: q(".fl-outlook"),
      band: q(".fl-band"), notice: q(".fl-notice"), flash: q(".fl-flash"), line: q(".fl-line"),
      coach: q(".fl-coach"), coachText: q(".fl-coach .say-text"), deck: q(".fl-deck"), who: q(".fl-guest"), rows: q(".fl-rows"), info: q(".fl-info"), busy: q(".fl-busy"),
      acts: q('[data-slot="acts"]'), layer: q('[data-slot="layer"]'),
    };
    if (this.shot) this.pose(this.shot);
    this.renderActs();
    this.renderLayer();
    this.sync();
    if (this.mode === "live" && !this.phone.fixed) this.lastAt = performance.now();
  }

  /* ── 一覧（PC）に並べる時の場面を作る ── */

  /** 手本の一手: 合う一台を出し、炭・頼み・会計に応える（検査用のボットと同じ考え方）。 */
  botStep(s, { skip = [] } = {}) {
    for (let id = 1; id <= RULES.tableCount; id++) {
      const table = s.tables[id - 1], tap = floorTap(s, id);
      if (skip.includes(tap)) continue;
      if (tap === "order" && floorShuffleLeft(s) === 0) {
        const hand = floorHand(s, s.guests[table.guestId].order);
        const pick = hand.find((m) => m.rating === "best") || hand.find((m) => m.rating === "good") || hand[0];
        s = floorAct(s, { type: "order", tableId: id, mix: pick.id });
      } else if (tap === "tend") s = floorAct(s, { type: "tend", tableId: id });
      else if (tap === "care") s = floorAct(s, { type: "care", tableId: id, verb: CALLS[table.call.type].verb });
      else if (tap === "bill") s = floorAct(s, { type: "bill", tableId: id });
    }
    return s;
  }

  pose(shot) {
    if (shot === "intro") return;
    if (shot === "coach") { this.mode = "live"; this.startTutorial(); return; }
    let s = this.s;
    this.mode = "live";
    const run = (until, opts) => { while (!s.done && !until(s)) { s = floorTick(s, 1); s = this.botStep(s, opts); } };
    if (shot === "result" || shot === "result2") {
      run(() => false);
      this.s = s; this.salesShown = s.sales; this.mode = "result"; this.resultPage = shot === "result2" ? 1 : 0;
      return;
    }
    // 営業の中ほど: 卓がだいたい埋まり、いろいろな用件が並んでいる所まで進める
    run((x) => x.t >= 96);
    const wants = (x, kind) => x.tables.some((t) => floorTap(x, t.id) === kind);
    if (shot === "order" || shot === "live") {
      // 手を止めて、注文待ち・炭の調整・会計がたまった所
      for (let i = 0; i < 160 && !s.done; i++) {
        s = floorTick(s, 1);
        const order = s.tables.find((t) => t.phase === "order");
        if (order && (shot === "order" || (wants(s, "tend") || wants(s, "bill")))) break;
        if (!order) s = this.botStep(s);
      }
    } else if (shot === "care") {
      for (let i = 0; i < 200 && !s.done && !wants(s, "care"); i++) { s = floorTick(s, 1); s = this.botStep(s, { skip: ["care", "tend"] }); }
    } else if (shot === "fever") {
      s.fever = Math.max(s.fever, 180);
      const next = floorAct(s, { type: "fever" });
      if (next !== s) s = floorTick(next, 6);
    }
    this.s = s; this.salesShown = s.sales;
    const first = (kind) => s.tables.find((t) => floorTap(s, t.id) === kind)?.id;
    if (shot === "order") { this.sel = first("order") || 1; this.openPanel("order", this.sel, { quiet: true }); }
    else if (shot === "care") { this.sel = first("care") || 1; if (first("care")) this.openPanel("care", this.sel, { quiet: true }); }
    else this.sel = s.tables.find((t) => t.phase === "enjoy" && floorTap(s, t.id) === "info")?.id || first("tend") || 1; // 営業中の見本は、くつろいでいる卓を選んでいる所
  }

  /* ── 時計（営業の時間。接客の画面・休止・帯の間は止まる） ── */

  tick(now) {
    if (this.dead) return;
    const dt = Math.min(1000, now - (this.lastAt || now));
    this.lastAt = now;
    if (this.phone.fixed || this.mode !== "live" || this.band || document.hidden) return;
    if (this.coach && !this.coach.step.wait) return; // チュートリアルは、待つ段だけ時間が流れる（少し速く）
    this.carry += dt * (this.coach ? 2 : this.speed) * this.fast;
    let steps = 0;
    while (this.carry >= FLOOR_TICK_MS) { this.carry -= FLOOR_TICK_MS; steps += 1; }
    if (steps) this.advance(steps);
  }

  advance(steps) {
    if (this.s.done) return;
    this.s = floorTick(this.s, steps);
    this.play(this.s.log);
    this.sync();
    if (this.s.done) this.closeNight();
    if (this.coach) this.coachCheck();
    // 注文待ちの卓を選んでシャッフルした時は、入れ替えが済んだら、その卓の注文を聞く画面が開く（卓を押し直さなくていい）
    if (this.reopen && floorShuffleLeft(this.s) === 0) {
      const id = this.reopen;
      this.reopen = 0;
      if (this.mode === "live" && !this.band && this.sel === id && floorTap(this.s, id) === "order" && (!this.coach || this.coachOpens("order", id))) this.openPanel("order", id);
    }
  }

  perform(action) {
    if (this.coach && !this.coachExpects(action)) { this.coachNudge(); return false; } // チュートリアル: 今の段でやること以外は受けない
    const next = floorAct(this.s, action);
    if (next === this.s) return false;
    this.s = next;
    this.play(this.s.log);
    this.sync();
    if (this.s.done) this.closeNight();
    if (this.coach) this.coachDid(action);
    return true;
  }

  /* ── 出来事の手応え（卓の札の見出しの所に言葉、札は弾む・光る・揺れる） ── */

  pop(id, text, kind = "") {
    const spot = this.refs.tables[id - 1];
    if (!spot || this.phone.fixed) return;
    // 同じ卓に続けて出た時は、新しい言葉に替える（言葉の上に言葉を重ねない）
    spot.fx.innerHTML = `<span class="fl-pop" data-kind="${kind}">${this.kit.esc(text)}</span>`;
    const node = spot.fx.firstElementChild;
    this.later(() => node.remove(), 1700);
  }

  hit(id, kind) {
    const spot = this.refs.tables[id - 1];
    if (!spot) return;
    spot.root.dataset.hit = "";
    void spot.root.offsetWidth;
    spot.root.dataset.hit = kind;
    clearTimeout(spot.hitTimer);
    spot.hitTimer = this.later(() => { spot.root.dataset.hit = ""; }, 700);
  }

  flashNow(kind) {
    const { flash } = this.refs;
    flash.dataset.on = "";
    void flash.offsetWidth;
    flash.dataset.on = kind;
  }

  log(text) {
    if (!text) return;
    this.logs.push(text);
    this.lineLog = text;
    this.syncLine();
  }

  /** 出来事の一行は、画面には出さない（卓の札の言葉・光り方・下の画面で伝わる）。読み上げ（スクリーンリーダー）のために、見えない所へ書いておく。 */
  syncLine() {
    const line = this.refs?.line;
    if (line && line.textContent !== this.lineLog) line.textContent = this.lineLog;
  }

  /* ── 音（会計の客が出た時の「チリーン」だけ。VPM13）。この試作に本編の音の仕組みは無いので、ここで鳴らす ── */

  /** 最初に画面を押した時に、音を鳴らせるようにする（ブラウザは、押す前の音を止める）。 */
  unlockAudio() {
    if (this.phone.fixed) return;
    try {
      this.actx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.actx.state === "suspended") this.actx.resume();
    } catch { this.actx = null; }
  }

  /** 卓上ベルの「チリーン」: 短く打つ音のあとに、高い澄んだ音が伸びる。 */
  chime() {
    const ctx = this.actx;
    if (!ctx || this.phone.fixed || ctx.state !== "running") return;
    const t = ctx.currentTime, out = ctx.createGain();
    out.gain.value = 0.2;
    out.connect(ctx.destination);
    const ring = (freq, at, dur, vol) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + at);
      gain.gain.exponentialRampToValueAtTime(vol, t + at + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      osc.connect(gain).connect(out);
      osc.start(t + at); osc.stop(t + at + dur + 0.05);
    };
    ring(2093, 0, 0.1, 0.5);          // チ
    ring(2637, 0.08, 1.4, 0.9);       // リーン
    ring(2637 * 2.005, 0.08, 1.0, 0.28); // わずかにずらした倍音（鈴のうなり）
    ring(2637 * 2.76, 0.08, 0.5, 0.12);
  }

  say(id, text) {
    if (!text) return;
    this.log(`${id}卓${quoted(text)}`);
    this.remember(id, text);
  }

  /** その卓の客が最後に言った一言（下の画面のいちばん上に出す）。 */
  remember(id, text) {
    const guestId = this.s.tables[id - 1]?.guestId;
    if (guestId && text) this.said[id] = { guestId, text };
  }

  /** まん中の札（ラストオーダー・トップ替え）。 */
  notice(title, sub = "") {
    const { notice } = this.refs;
    notice.innerHTML = `<b>${this.kit.esc(title)}</b>${sub ? `<small>${this.kit.esc(sub)}</small>` : ""}`;
    notice.dataset.on = "false"; void notice.offsetWidth; notice.dataset.on = "true";
    clearTimeout(this.noticeTimer);
    this.noticeTimer = this.later(() => { notice.dataset.on = "false"; }, 1400);
  }

  /** 画面を横切る帯（営業開始・フィーバー・営業終了）。出ている間は、卓の札と手応えの言葉を出さず、時間も止める。 */
  cutin(title, sub, kind = "", then = null) {
    const { band } = this.refs;
    band.innerHTML = `<i></i><b>${this.kit.esc(title)}</b>${sub ? `<small>${this.kit.esc(sub)}</small>` : ""}`;
    band.dataset.kind = kind;
    band.dataset.on = "false"; void band.offsetWidth; band.dataset.on = "true";
    this.band = true;
    this.el.dataset.band = "true";
    clearTimeout(this.bandTimer);
    this.bandTimer = this.later(() => {
      band.dataset.on = "false"; this.band = false; this.el.dataset.band = "false"; this.lastAt = performance.now();
      then?.();
    }, this.phone.fixed ? 0 : BAND_MS);
  }

  play(events) {
    const s = this.s;
    for (const e of events) {
      const guest = e.guestId ? s.guests[e.guestId] : null;
      switch (e.type) {
        case "arrive":
          this.pop(e.tableId, e.line, "say"); // 来店した客は、気分を吹き出しで言う
          this.remember(e.tableId, e.line);
          this.log(e.rare ? `${guest.name}が遊びに来た！ ${e.tableId}卓へ` : `${e.tableId}卓　${guest.name}「${e.line}」`);
          break;
        case "left":
          this.hit(e.tableId, "off"); this.flashNow("bad"); this.pop(e.tableId, "帰った…", "off");
          this.log(guest.charId ? `${e.tableId}卓　${guest.name}「${e.line}」` : `${e.tableId}卓の${guest.name}が、待ちきれずに帰ってしまいました`);
          break;
        case "order":
          this.log(`${e.tableId}卓　${e.refill ? "おかわりに" : ""}${mixName(e.mix)}を仕込みはじめた`);
          if (e.refill) this.notice("トップ替え、いただきました！", `おかわり ＋${yen(PRICE.top)}`);
          break;
        case "shuffle": this.log(`ミックスを入れ替える（${seconds(e.ticks)}秒かかる）`); break;
        case "shuffleDone": this.log("新しいミックスが並んだ"); break;
        case "serve": {
          // 流れ: ◎を続けて出すと、言葉が「2連続！」「3連続！」に変わる
          const chained = e.grade === "best" && e.streak >= 2;
          this.hit(e.tableId, chained ? "chain" : e.grade === "best" ? "best" : e.grade === "off" ? "off" : "good");
          this.pop(e.tableId, chained ? `${e.streak}連続！` : e.grade === "best" ? "ぴったり！" : e.grade === "off" ? "ちがうかも" : "いい感じ", e.grade === "off" ? "off" : e.late >= 3 && e.grade === "best" ? "near" : "best");
          this.say(e.tableId, e.line);
          break;
        }
        case "tend": this.hit(e.tableId, "tend"); this.pop(e.tableId, "いい調整", "best"); this.log(`${e.tableId}卓　炭を整えた`); break;
        case "call": this.log(e.coal ? `${e.tableId}卓　炭を見てほしそうです` : `${e.tableId}卓で、お客さんの様子が変わりました`); break;
        case "care":
          if (e.ok) { this.hit(e.tableId, "good"); this.pop(e.tableId, "いいケア", "best"); } else { this.hit(e.tableId, "off"); this.pop(e.tableId, "ちがった…", "off"); }
          this.say(e.tableId, e.line);
          break;
        case "callLate": this.pop(e.tableId, "見逃した", "off"); this.log(`${e.tableId}卓の頼みを見逃しました`); break;
        case "drink": this.hit(e.tableId, "coin"); this.pop(e.tableId, `＋${yen(PRICE.drink)}`, "coin"); this.log(`${e.tableId}卓　追加ドリンク注文！`); break;
        case "extend": // おかわりも注文と同じく、吸いたい気分を聞いて、並んだミックスから選ぶ
          this.hit(e.tableId, "best"); this.pop(e.tableId, "おかわり！", "best");
          this.log(`${e.tableId}卓　おかわりの注文！「${e.line}」`);
          break;
        case "refillMissed": this.pop(e.tableId, "おかわり逃した", "off"); this.log(`${e.tableId}卓　おかわりを聞きそびれて、お会計に`); break;
        case "billReady": this.chime(); this.log(`${e.tableId}卓がお会計です`); break; // 会計の客が出たら、チリーン
        case "bill":
          this.hit(e.tableId, "coin");
          this.pop(e.tableId, e.fans > 0 ? `ファン ＋${e.fans}` : yen(e.total), e.fans > 0 ? "best" : "coin");
          if (e.line) this.say(e.tableId, e.line);
          break;
        case "feverReady": this.log("フィーバーが使えます"); break;
        case "feverStart": this.flashNow("fever"); break;
        case "feverEnd":
          this.flashNow("soft");
          this.log(`フィーバーが明けました（＋${yen(Math.max(0, s.sales - this.feverSalesAt))}）`);
          break;
        default: break;
      }
    }
    // 店の売上が区切りをまたいだら知らせる
    const mark = Math.floor(s.sales / SALES_STEP);
    if (mark > this.salesMark && !s.done) this.log(`店の売上が${yen(mark * SALES_STEP)}を超えました`);
    this.salesMark = mark;
  }

  /* ── 画面の書き換え ── */

  /** 気分（＝属性）の札: 色と印と名前。本編の人物は、名前の代わりに名指しのフレーバー。 */
  wishChip(order, { refill = false } = {}) {
    const w = WISH[order.wish], label = order.pref?.label || w.label;
    // 名指しの長い名前（ダブルアップル・スプリングウォーター など）は、札の幅に収まるよう2行に折る
    return `<span class="fl-wish${[...label].length > 6 ? " long" : ""}" style="--c:${w.color}">${refill ? `<i class="fl-again">${this.kit.icon("top")}</i>` : ""}${this.kit.icon(WISH_ICON[w.id])}<b>${this.kit.esc(label)}</b></span>`;
  }

  guestImg(guest, happy = false) {
    if (guest.charId) return `<img src="${this.face(guest.charId === "minto" ? "minto_private" : guest.charId)}" alt="">`;
    return `<img src="${this.art(`guest-${guest.art || guest.kind}${happy ? "-happy" : ""}`)}" alt="">`;
  }

  /** 卓の札の上に出る用件: [記号, 言葉, 札の色, 見出しを出すか]。見出しを出すのは、押すと進む用件と「おかわり中」だけ（本編と同じ）。 */
  wantFor(table) {
    const s = this.s, feverOn = table.fever && s.feverLeft > 0;
    switch (table.phase) {
      case "order": return ["order", table.refill ? "おかわり" : "注文", "act", true];
      case "prep": return ["cook", table.make.active ? "仕込み中" : "順番待ち", "wait", false];
      case "enjoy":
        if (feverOn) return ["lamp", "フィーバー", "fever", false];
        if (table.call) return s.hint === "said" ? [CALL_ICON[table.call.type], CALLS[table.call.type].label, "act", true] : ["alert", "様子が変だ", "act", true];
        if (floorTendDue(s, table.id)) return ["add", "炭の調整", "tend", true];
        return table.extended ? ["top", "おかわり中", "fine", true] : ["lamp", "くつろぎ中", "fine", false];
      case "bill": return ["bill", "会計", "act", true];
      case "cool": return ["clean", "片付け中", "idle", false];
      default: return ["", "空席", "idle", false];
    }
  }

  syncTable(spot, table) {
    const s = this.s, { icon } = this.kit, k = spot.keys;
    const guest = table.guestId ? s.guests[table.guestId] : null;
    const want = this.wantFor(table), urgency = floorUrgency(s, table.id), stay = floorStayLeft(s, table.id);
    const served = table.phase === "enjoy" || table.phase === "bill";
    const stage = guest && served ? floorStage(table.mood) : null;
    Object.assign(spot.root.dataset, {
      phase: table.phase, tone: want[2], sel: String(this.sel === table.id), rare: String(!!guest?.charId),
      urgent: urgency > 0.66 ? "high" : urgency > 0.33 ? "mid" : "", mood: stage?.id || "",
      gauge: table.phase === "prep" ? "make" : table.phase === "enjoy" ? "coal" : "",
      leaving: String(table.phase === "enjoy" && stay > 0 && stay <= 0.3),
    });
    spot.root.style.setProperty("--stay", stay.toFixed(3));
    spot.root.style.setProperty("--c", guest ? WISH[guest.order.wish].color : "transparent");
    // 客の顔（大満足の客は笑顔の絵）
    const happy = !!stage && table.mood >= 85;
    const whoKey = guest ? `${guest.id}/${happy}` : "";
    if (k.who !== whoKey) { k.who = whoKey; spot.who.innerHTML = guest ? this.guestImg(guest, happy) : ""; }
    // 見出し: 注文待ちの間は客の気分（色と印と名前）、押すと進む用件はその名前
    const wantKey = !guest ? "" : table.phase === "order" ? `w/${guest.order.wish}/${guest.order.pref?.label || ""}/${table.refill}` : want[3] ? `h/${want[0]}/${want[1]}/${want[2]}` : "";
    if (k.want !== wantKey) {
      k.want = wantKey;
      spot.want.innerHTML = !wantKey ? "" : table.phase === "order" ? this.wishChip(guest.order, { refill: table.refill })
        : `<span class="fl-need" data-tone="${want[2]}">${icon(want[0])}<b>${want[1]}</b></span>`;
    }
    // 右の窓: 注文待ちは残り秒、仕込み中は器の印と残り秒（順番待ちは時計の印だけ）、提供後は満足の顔
    const left = floorWaitLeft(s, table.id);
    const making = table.phase === "prep" && table.make.active;
    const cellKey = table.phase === "order" ? `n${seconds(left)}` : table.phase === "prep" ? (making ? `p${seconds(table.make.left)}` : "queue")
      : stage ? `m${stage.id}` : table.phase === "cool" ? "cool" : "";
    if (k.cell !== cellKey) {
      k.cell = cellKey;
      spot.cell.innerHTML = table.phase === "order" ? `${icon("clock")}<b>${seconds(left)}</b>`
        : table.phase === "prep" ? (making ? `${icon("cook")}<b>${seconds(table.make.left)}</b>` : icon("clock"))
        : stage ? `<img src="${this.art(MOOD_ART[stage.id])}" alt="${stage.label}">` : table.phase === "cool" ? icon("clean") : "";
    }
    // 箱の下の棒: 仕込みの進み。提供後は炭の残り
    const bar = table.phase === "prep" ? 1 - table.make.left / table.make.total : table.phase === "enjoy" ? floorCoalLeft(s, table.id) : 0;
    spot.bar.style.width = `${Math.round(bar * 100)}%`;
    // 頼み・会計を待たせている残り（秒）
    const countKey = (table.call || table.phase === "bill") && left != null ? (left > 0 ? String(seconds(left)) : "!") : "";
    if (k.count !== countKey) { k.count = countKey; spot.count.innerHTML = countKey ? `${icon("clock")}<b>${countKey === "!" ? "！" : countKey}</b>` : ""; }
    spot.root.setAttribute("aria-label", `${table.id}卓、${guest ? `${guest.name}、` : ""}${want[1]}`);
  }

  /** 下の画面＝選んでいる卓の画面（VPM17）。いちばん上に、その卓の客と一言。その下は、卓の用件で替わる:
   *  注文を聞いている間＝ミックス5つ（属性の印・名前・使ったフレーバー・その客との合い方 ◎○×）／頼みを聞いている間＝5つの手／それ以外＝その卓の様子と、いまのミックスの棚。 */
  syncDeck() {
    const s = this.s, { deck, rows, busy } = this.refs, { icon, esc } = this.kit;
    const panel = this.mode === "panel" ? this.panel : null;
    const table = s.tables[(panel?.id ?? this.sel) - 1];
    const kind = !panel ? "info" : panel.kind === "care" ? "care" : "mix";
    const order = table.phase === "order" && table.guestId ? s.guests[table.guestId].order : null;
    const list = floorHand(s, order);
    this.noMatch = !!order && list.every((mix) => mix.rating === "none");
    this.syncWho(table);
    let key, html;
    if (kind === "care") {
      key = `care/${panel.id}/${this.coach?.index ?? ""}`;
      html = () => this.panelOptions().map(({ verb, action }, i) => {
        const ok = !this.coach || this.coachExpects(action); // チュートリアル: 今の段でやる一つだけを押せる
        return `<button class="fl-opt" data-act="fl-pick" data-i="${i}" aria-label="${verb.label}"${ok ? "" : " disabled"}${this.coach && ok ? ` data-coach="true"` : ""}>
          <span class="fl-opt-icon">${icon(VERB_ICON[verb.id])}</span><span class="fl-opt-text"><b>${verb.label}</b></span></button>`;
      }).join("") + `<button class="fl-opt fl-opt-later" data-act="fl-later" aria-label="あとで">${icon("back")}<span class="fl-opt-text"><b>あとで</b></span></button>`;
    } else if (kind === "mix") {
      key = `mix/${s.hand.join(",")}/${order?.wish || ""}/${order?.pref?.label || ""}/${table.id}/${this.coach?.index ?? ""}`;
      html = () => list.map((mix, i) => {
        const ok = !this.coach || this.coachExpects({ type: "order", tableId: table.id, mix: mix.id }); // チュートリアル: 今の段でやる一つだけを押せる
        return `<button class="fl-opt" data-act="fl-pick" data-i="${i}" data-rating="${mix.rating || ""}"
          aria-label="${mix.full}、${WISH[mix.main].label}${mix.sub ? `・${WISH[mix.sub].label}` : ""}${mix.rating ? `、${table.id}卓に${RATE_MARK[mix.rating]}` : ""}"${ok ? "" : " disabled"}${this.coach && ok ? ` data-coach="true"` : ""}>
          ${attrHtml(this.art, mix.id)}<span class="fl-opt-text"><b>${esc(mix.name)}</b>${mix.single ? "" : `<small>（${mix.recipe.join("・")}）</small>`}</span>
          ${mix.rating ? `<i class="fl-opt-rate" data-rating="${mix.rating}">${RATE_MARK[mix.rating]}</i>` : ""}</button>`;
      }).join("");
    } else { key = "info"; html = () => ""; }
    if (deck.dataset.key !== key) {
      deck.dataset.key = key;
      deck.dataset.kind = kind;
      rows.innerHTML = html();
    }
    deck.style.setProperty("--c", table.guestId ? WISH[s.guests[table.guestId].order.wish].color : "transparent");
    if (kind === "info") this.syncInfo(table, list);
    if (panel) this.syncCursor();
    // 入れ替えの最中は、ミックスを出せない（一覧を隠して、進みを出す）
    const wait = floorShuffleLeft(s);
    deck.dataset.busy = String(wait > 0 && kind === "mix");
    busy.querySelector(".fl-busy-bar i").style.width = `${Math.round((1 - wait / RULES.shuffle) * 100)}%`;
    busy.querySelector("small").textContent = wait > 0 ? `あと${seconds(wait)}秒` : "";
    const chip = this.el.querySelector(".fl-chip-shuffle");
    if (chip) {
      chip.disabled = wait > 0;
      chip.dataset.wait = String(wait > 0);
      chip.querySelector("span").textContent = wait > 0 ? `あと${seconds(wait)}秒` : "シャッフル";
      // 選んでいる卓の注文に合う一台が並んでいない時は、シャッフルを光らせる
      chip.dataset.call = String(wait === 0 && !!this.noMatch);
    }
  }

  /** 客の一言が無い時に出す、その卓の様子（短い一行）。 */
  stateLine(table) {
    const s = this.s;
    switch (table.phase) {
      case "order": return "注文を待っています";
      case "prep": return table.make.active ? `${mixName(table.mix)}を仕込んでいます` : "仕込みの順番を待っています";
      case "enjoy": return table.fever && s.feverLeft > 0 ? "最高の居心地で、くつろいでいます" : floorTendDue(s, table.id) ? "炭が減ってきました" : "くつろいでいます";
      case "bill": return "お会計を待っています";
      case "cool": return "片付けています";
      default: return "お客さんを待っています";
    }
  }

  /** 下の画面のいちばん上: 選んでいる卓の客（顔・卓番号・呼び名・気分か用件・ご利用の金額）と、客の一言（一言が無い時は、その卓の様子）。 */
  syncWho(table) {
    const s = this.s, { who } = this.refs, { icon, esc } = this.kit;
    if (this.panel?.locked) return; // 頼みの判定（◎ ×）を見せている間は、そのまま
    const guest = table.guestId ? s.guests[table.guestId] : null;
    const tap = floorTap(s, table.id), want = this.wantFor(table);
    const total = guest ? floorBill(s, table.id)?.total || 0 : 0;
    const happy = !!guest && (table.phase === "enjoy" || table.phase === "bill") && table.mood >= 85;
    let lead, sight = true;
    if (guest && table.phase === "order") { lead = quoted(guest.order.quote); sight = false; }
    else if (guest && tap === "care") { const call = floorCallLine(s, table.id); sight = s.hint !== "said"; lead = sight ? call.sight : quoted(call.said); }
    else {
      const said = this.said[table.id];
      if (guest && said?.guestId === guest.id) { lead = quoted(said.text); sight = false; } else lead = this.stateLine(table);
    }
    const key = [table.id, table.phase, guest?.id || "", tap, want[1], want[2], total, lead, happy, guest?.order.wish || "", guest?.order.pref?.label || "", table.refill].join("/");
    if (who.dataset.key === key) return;
    who.dataset.key = key;
    who.dataset.verdict = "";
    who.dataset.guest = String(!!guest);
    who.style.setProperty("--sx", `${(SEATS[table.id - 1][0] / 100 * 39 - 1.2).toFixed(2)}rem`); // 上の卓のボックスの真下に、つなぐ印を出す（画面の幅39rem・左右の余白1.2rem）
    // 札は、注文の気分か、押すと進む用件（頼み・炭の調整・会計）だけ。金額は、札が無い時と会計の時に出す（幅が足りず、呼び名が切れるので）
    const acting = ["care", "tend", "bill"].includes(tap);
    const chip = !guest ? "" : table.phase === "order" ? this.wishChip(guest.order, { refill: table.refill })
      : acting ? `<span class="fl-need" data-tone="${want[2]}">${icon(want[0])}<b>${want[1]}</b></span>` : "";
    const showTotal = total > 0 && (!chip || tap === "bill");
    who.innerHTML = `<span class="fl-guest-face">${guest ? this.guestImg(guest, happy) : ""}<b class="fl-guest-no" aria-label="${table.id}卓">${table.id}</b><i class="fl-guest-mark" aria-hidden="true"></i></span>
      <div class="fl-guest-side">
        <div class="fl-guest-top"><b class="fl-guest-name">${guest ? esc(guest.name) : table.phase === "cool" ? "片付け中" : "空席"}</b>${chip}${showTotal ? `<em>${icon("coins")}${yen(total)}</em>` : ""}</div>
        <p class="fl-quote" data-sight="${sight}"><span class="fl-q"></span></p>
      </div>`;
    this.fitText(who.querySelector(".fl-q"), lead); // 吹き出しの余白の内側（.fl-q）の幅で測って折る
  }

  /** 用件を聞いていない時の下の画面: その卓でいま出来ること（大きな札ひとつ）・その卓の様子（待たせている時間／仕込みの進み／満足・炭・滞在）・いまのミックスの棚。 */
  syncInfo(table, list) {
    const s = this.s, { info } = this.refs, { icon, esc } = this.kit;
    const guest = table.guestId ? s.guests[table.guestId] : null;
    const tap = floorTap(s, table.id), need = ["order", "care", "tend", "bill"].includes(tap) ? tap : "";
    const served = table.phase === "enjoy" || table.phase === "bill";
    const stage = guest && served ? floorStage(table.mood) : null;
    const wait = floorShuffleLeft(s);
    const glow = !!this.coach && !this.coach.step.talk && this.coachTable() === table.id;
    const key = [table.id, table.phase, guest?.id || "", need, stage?.id || "", table.mix || "", s.hand.join(","), wait > 0, table.make?.active ?? "", glow, guest?.order.wish || "", table.refill].join("/");
    if (info.dataset.key !== key) {
      info.dataset.key = key;
      const GO = { order: ["order", table.refill ? "おかわりを聞く" : "注文を聞く"], care: ["ask", "頼みを聞く"], tend: ["add", "炭を整える"], bill: ["bill", "会計する"] };
      const go = need ? `<button class="fl-go" data-act="fl-table" data-id="${table.id}" data-need="${need}"${glow ? ` data-coach="true"` : ""}>${icon(GO[need][0])}<b>${GO[need][1]}</b></button>` : "";
      const bar = (name, label, iconName) => `<span class="fl-meter" data-k="${name}">${icon(iconName)}<b>${label}</b><i class="fl-meter-bar"><i></i></i><small></small></span>`;
      let meters = "";
      if (table.phase === "order") meters = bar("wait", "待ち時間", "clock");
      else if (table.phase === "prep") meters = `<span class="fl-meter wide" data-k="mix">${attrHtml(this.art, table.mix)}<b>${esc(mixName(table.mix))}</b></span>${bar("make", "仕込み", "cook")}`;
      else if (served) meters = `${table.mix ? `<span class="fl-meter wide" data-k="mix">${attrHtml(this.art, table.mix)}<b>${esc(mixName(table.mix))}</b><span class="fl-meter-mood"><img src="${this.art(MOOD_ART[stage.id])}" alt=""><small>${stage.label}</small></span></span>` : ""}
        ${table.phase === "enjoy" ? `${bar("coal", "炭", "add")}${bar("stay", "滞在", "clock")}` : ""}`;
      // いまのミックスの棚（見るだけ。選んでいる卓が注文待ちなら、その客との合い方も出す）
      const shelf = wait > 0 ? `<p class="fl-shelf-busy">${icon("shuffle")}<b>入れ替え中</b><small></small></p>`
        : `<ul>${list.map((mix) => `<li data-rating="${mix.rating || ""}">${attrHtml(this.art, mix.id)}<b>${esc(mix.name)}</b>${mix.single ? "" : `<small>（${mix.recipe.join("・")}）</small>`}${mix.rating ? `<i>${RATE_MARK[mix.rating]}</i>` : ""}</li>`).join("")}</ul>`;
      info.innerHTML = `${go}${meters ? `<div class="fl-meters" data-phase="${table.phase}">${meters}</div>` : ""}<div class="fl-shelf"><h4>いまのミックスの棚</h4>${shelf}</div>`;
    }
    // 動く所（棒と秒）だけ書き換える
    const set = (name, ratio, text = "") => {
      const node = info.querySelector(`.fl-meter[data-k="${name}"]`);
      if (!node) return;
      node.querySelector(".fl-meter-bar i").style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
      node.querySelector("small").textContent = text;
    };
    if (table.phase === "order") { const left = floorWaitLeft(s, table.id); set("wait", 1 - floorUrgency(s, table.id), left != null ? `あと${seconds(left)}秒` : ""); info.querySelector('.fl-meter[data-k="wait"]')?.setAttribute("data-urgent", String(floorUrgency(s, table.id) > 0.66)); }
    else if (table.phase === "prep") set("make", table.make.active ? 1 - table.make.left / table.make.total : 0, table.make.active ? `あと${seconds(table.make.left)}秒` : "順番待ち");
    else if (table.phase === "enjoy") { set("coal", floorCoalLeft(s, table.id)); set("stay", floorStayLeft(s, table.id)); }
    const busyText = info.querySelector(".fl-shelf-busy small");
    if (busyText) busyText.textContent = `あと${seconds(wait)}秒`;
  }

  sync() {
    const s = this.s, r = this.refs;
    if (!r) return;
    s.tables.forEach((table, i) => this.syncTable(r.tables[i], table));
    this.syncDeck();
    r.clock.textContent = floorTimeLeft(s);
    r.timebar.style.width = `${Math.max(0, 100 - (s.t / s.length) * 100).toFixed(1)}%`;
    const leftTicks = s.length - s.t, leftSec = Math.ceil(leftTicks / 2);
    Object.assign(this.el.dataset, { late: String(leftTicks <= 60), final: String(leftSec <= 10 && !s.done), flMode: this.mode, coach: String(!!this.coach) });
    if (r.sales.dataset.value !== String(s.sales)) {
      if (r.sales.dataset.value !== undefined) { r.sales.dataset.bump = "false"; void r.sales.offsetWidth; r.sales.dataset.bump = "true"; }
      r.sales.dataset.value = String(s.sales);
      this.rollSales(s.sales);
    }
    // いまの調子: いま締めたらどの評価か。段が変わったら、ゲージが光って、出来事の行で知らせる
    const outlook = s.done ? null : floorOutlook(s);
    if (outlook) {
      r.outlook.lastElementChild.style.width = `${outlook.score}%`;
      r.outlook.dataset.rank = outlook.rank;
      r.outlook.setAttribute("aria-label", `いまの調子: ${outlook.stamp}`);
      if (!this.lastOutlook) this.lastOutlook = outlook.rank;
      else if (this.lastOutlook !== outlook.rank && s.t - this.outlookAt >= 8) {
        this.lastOutlook = outlook.rank; this.outlookAt = s.t;
        this.log(`いまの調子：${outlook.stamp}`);
      }
    }
    // ラストオーダー（新しい客が来なくなる時）は、まん中の札で知らせる
    if (!this.lastCalled && leftTicks <= RULES.lastCall && !s.done && this.mode === "live" && !this.tutorial) {
      this.lastCalled = true;
      if (leftTicks > RULES.lastCall - 4 && !this.phone.fixed) { this.notice("ラストオーダー", "新しい来店は、ここまで"); this.log("ラストオーダーです"); }
    }
    this.syncFever();
    // 日が暮れたら、店内の絵を夜へ（昼から夜まで通しの店番）
    if (!this.duskShown && floorDusk(s)) {
      this.duskShown = true;
      r.room.dataset.dusk = "true";
      if (!s.done) this.log(VENUE.duskLog || "外が暗くなってきた。夜の客が入りはじめる");
    }
    const hint = floorHint(s);
    this.hint = hint;
    for (const spot of r.tables) spot.root.dataset.guide = String(s.level === 0 && !this.coach && String(hint.tableId) === spot.root.dataset.id);
  }

  /** フィーバーの札: 灯りと残量。使える量まで溜まると金に灯り、使っている間は紫。もう一度押すと終了し、残りは次に使える。 */
  syncFever() {
    const s = this.s, chip = this.el.querySelector(".fl-chip-fever");
    const on = s.feverLeft > 0, ready = floorFeverReady(s), usable = !on && ready && s.tables.some((t) => t.phase === "enjoy");
    this.el.dataset.fever = on ? "on" : ready ? "ready" : "";
    if (!chip) return;
    chip.disabled = !on && !usable;
    chip.dataset.usable = String(on || usable);
    chip.dataset.streak = String(Math.min(3, Math.max(0, s.streak - 1)));
    chip.querySelector(".fl-fever-fill").style.width = `${s.fever / floorFeverMax * 100}%`;
    chip.querySelector("b").textContent = on ? "終了する" : s.feverResume ? "再開する" : "フィーバー";
    const stocks = Math.floor(s.fever / floorFeverCost);
    chip.querySelector("small").textContent = on ? `${seconds(s.feverLeft)}秒` : !usable && ready ? "待機" : s.feverResume ? `残${seconds(s.feverResume)}秒` : ready ? `×${stocks}` : `${Math.floor(s.fever)}/${floorFeverCost}`;
    chip.setAttribute("aria-label", `${on ? "フィーバーを終了" : s.feverResume ? "フィーバーを再開" : ready ? "フィーバーを使う" : "フィーバー"}、ゲージ残り${Math.round(s.fever / floorFeverMax * 100)}％`);
  }

  /** 売上の数字は、増えた分だけ回って上がる。 */
  rollSales(to) {
    cancelAnimationFrame(this.salesRaf);
    const from = this.salesShown, start = performance.now(), ms = this.reduce || this.phone.fixed ? 0 : 420;
    const step = (now) => {
      const k = ms ? Math.min(1, (now - start) / ms) : 1;
      this.salesShown = Math.round(from + (to - from) * (1 - (1 - k) ** 3));
      this.refs.sales.textContent = this.salesShown.toLocaleString("ja-JP");
      if (k < 1 && !this.dead) this.salesRaf = requestAnimationFrame(step);
    };
    step(start);
  }

  /* ── いちばん下の段（押す所）。場面ごとに替える: 店＝シャッフル・フィーバー・休止／接客＝あとで（とシャッフル）／開店前＝遊び方・開店する／精算＝次へ ── */

  renderActs() {
    const { icon } = this.kit, mode = this.mode;
    const act = (id, name, label, cls = "") => `<button class="fl-act ${cls}" data-act="${id}" aria-label="${label}">${name ? icon(name) : ""}<span>${label}</span></button>`;
    const shuffle = act("fl-shuffle", "shuffle", "シャッフル", "fl-chip-shuffle fl-gold");
    const fever = `<button class="fl-act fl-chip-fever" data-act="fl-fever" aria-label="フィーバー"><img class="fl-lamp" src="${this.art("lamp-on")}" alt=""><span class="fl-fever-main"><span class="fl-fever-name"><b>フィーバー</b><small></small></span>
      <span class="fl-fever-gauge"><i class="fl-fever-fill"></i>${[1, 2].map((n) => `<u style="left:${n * floorFeverCost / floorFeverMax * 100}%"></u>`).join("")}</span></span></button>`;
    const pause = act("fl-pause", "pause", "休止", "sub small");
    let html;
    if (mode === "intro") html = `${this.tutorial ? "" : act("fl-howto", "help", "遊び方", "sub")}${act("fl-start", "", this.tutorial ? "はじめる" : "開店する", "primary")}`;
    else if (mode === "result") html = act("fl-result-next", "", this.resultPage === 0 ? "次へ" : "シフトを終える", "primary");
    else if (mode === "pause") html = "";
    else if (mode === "panel") html = this.panel.kind === "order" ? `${act("fl-later", "back", "あとで", "sub")}${shuffle}` : ""; // 頼みの時は、「あとで」も札の並びの中
    else if (this.coach?.step.talk) html = `${act("fl-coach", "", "次へ", "primary")}${pause}`;
    else html = `${shuffle}${fever}${pause}`;
    const key = `${mode}/${this.panel?.kind || ""}/${!!this.coach?.step.talk}/${this.tutorial}/${this.resultPage}`;
    if (this.refs.acts.dataset.key !== key) { this.refs.acts.dataset.key = key; this.refs.acts.dataset.mode = mode; this.refs.acts.innerHTML = html; }
    this.coachFocus();
  }

  setMode(mode) {
    this.mode = mode;
    this.el.dataset.flMode = mode;
    this.renderActs();
    this.renderLayer();
    this.sync();
    this.lastAt = performance.now();
  }

  /* ── 操作 ── */

  select(id) {
    if (id !== this.reopen) this.reopen = 0;
    this.sel = id;
    for (const spot of this.refs.tables) spot.root.dataset.sel = String(spot.root.dataset.id === String(id));
    this.syncDeck(); // 下の画面を、その卓のものに替える
  }

  /** 卓を押した（上の卓のボックス・下の画面の大きな札で同じ）: 下の画面がその卓のものに替わり、用件があれば進む。
   *  注文・頼みは、客の一言を読んで選ぶ（その間、店の時間は止まる）。炭の調整・会計は、押したらその場で済む。 */
  tapTable(id) {
    if (this.band) return;
    if (this.mode === "panel") {
      // 聞いている途中で別の卓を押したら、そちらへ移る（判定を見せている間と、チュートリアルの間は移らない）
      if (id === this.panel.id || this.panel.locked) return;
      if (this.coach) { this.coachNudge(); return; }
      this.closePanel();
    }
    if (this.mode !== "live") return;
    const s = this.s, tap = floorTap(s, id);
    // チュートリアル: 今の段で指している卓の、その用件だけを受ける
    if (this.coach) {
      const want = this.coach.step.expect;
      const ok = !!want && want.tableId === id && (tap === "order" || tap === "care" ? this.coachOpens(tap, id) : tap === want.type);
      if (!ok) { this.coachNudge(); return; }
    }
    this.select(id);
    // 入れ替えの最中は、ミックスを出せない（その間に、ほかの卓を見る）
    if (tap === "order" && floorShuffleLeft(s) > 0) { this.pop(id, "入れ替え中…"); return; }
    if (tap === "order" || tap === "care") { this.openPanel(tap, id); return; } // 読んで選ぶもの（その間、時間は止まる）
    if (tap === "bill") { this.perform({ type: "bill", tableId: id }); return; }
    if (tap === "tend") { this.perform({ type: "tend", tableId: id }); return; }
  }

  followHint() {
    if (this.mode !== "live" || !this.hint) return;
    if (this.hint.kind === "feverReady") return this.useFever();
    if (this.hint.tableId) this.select(this.hint.tableId);
  }

  doShuffle() {
    if (!this.perform({ type: "shuffle", tableId: this.sel })) { this.nudge(this.el.querySelector(".fl-chip-shuffle")); return; }
    // 入れ替えには時間がかかるので、聞いている画面はいったん閉じて、店の時間を流す（その間に、ほかの卓を見られる）。済んだら、同じ卓の注文へ戻る
    if (this.mode === "panel" && this.panel?.kind === "order") { const id = this.panel.id; this.closePanel(); this.reopen = id; }
    else { if (floorTap(this.s, this.sel) === "order") this.reopen = this.sel; this.syncDeck(); }
  }

  useFever() {
    if (this.mode !== "live" || this.band) return;
    if (this.s.feverLeft > 0) { if (!this.perform({ type: "feverStop" })) this.nudge(this.el.querySelector(".fl-chip-fever")); return; }
    if (!this.perform({ type: "fever" })) { this.nudge(this.el.querySelector(".fl-chip-fever")); return; }
    if (this.s.done) return;
    // 突入の演出: 時間を止めて、帯を出す
    this.feverSalesAt = this.s.sales;
    this.cutin("FEVER TIME!", `${this.s.tables.filter((t) => t.fever).length}卓が最高の居心地`, "fever");
    this.log("フィーバー！");
  }

  nudge(node) {
    if (!node) return;
    node.classList.remove("fl-nudge"); void node.offsetWidth; node.classList.add("fl-nudge");
  }

  onClick(event) {
    const hit = event.target.closest("[data-act]");
    if (!hit || !this.el.contains(hit)) return false;
    const act = hit.dataset.act;
    this.keyNav = false;
    this.unlockAudio();
    if (act === "fl-table") this.tapTable(Number(hit.dataset.id));
    else if (act === "fl-pick") this.pickRow(Number(hit.dataset.i));
    else if (act === "fl-shuffle") this.doShuffle();
    else if (act === "fl-fever") this.useFever();
    else if (act === "fl-pause") { if (this.mode === "live" && !this.band) this.setModePause("pause"); }
    else if (act === "fl-later") this.closePanel();
    else if (act === "fl-howto") this.startTutorial();
    else if (act === "fl-start") this.start();
    else if (act === "fl-result-next") this.resultNext();
    else if (act === "fl-coach") this.coachTalkDone();
    else if (act === "fl-pause-pick") { this.pausePick = Number(hit.dataset.i); this.pauseChoose(); }
    else return false;
    return true;
  }

  /** 下の画面の札（ミックス・頼みの手）を押した: その札で決める。 */
  pickRow(index) {
    if (this.mode !== "panel" || !this.panel) return;
    if (!this.panel.locked) this.panel.cursor = index;
    this.choose();
  }

  move(dir) {
    this.keyNav = true; // 矢印キーで選んでいる間だけ、選んでいる札に枠を出す
    if (this.mode === "panel") {
      if (this.panel.locked || (dir !== "up" && dir !== "down")) return;
      const n = this.panelOptions().length;
      this.panel.cursor = (this.panel.cursor + (dir === "down" ? 1 : n - 1)) % n;
      this.syncCursor();
      return;
    }
    if (this.mode === "pause") {
      if (dir !== "up" && dir !== "down") return;
      const n = this.pauseOptions().length;
      this.pausePick = (this.pausePick + (dir === "down" ? 1 : n - 1)) % n;
      this.renderLayer();
      return;
    }
    if (this.mode !== "live") return;
    // 左右で隣の卓へ順に（5卓の次は1卓）。上下で上の段と下の段を移る
    if (dir === "left" || dir === "right") { this.select((this.sel - 1 + (dir === "right" ? 1 : RULES.tableCount - 1)) % RULES.tableCount + 1); return; }
    const upper = UPPER.includes(this.sel);
    if ((dir === "down") === upper) {
      const to = this.back[this.sel] && UPPER.includes(this.back[this.sel]) !== upper ? this.back[this.sel] : ROW_MATE[this.sel];
      this.back[to] = this.sel;
      this.select(to);
    }
  }

  /** PC のキー（矢印＝卓を選ぶ／一覧の札を選ぶ、Enter＝進める）のほか: F＝フィーバー、S＝シャッフル、Esc＝休止／接客の画面を閉じる（本編の PC 操作と同じ）。 */
  onKey(key) {
    const k = key.toLowerCase();
    if (k === "f") { this.useFever(); return true; }
    if (k === "s" && (this.mode === "live" || this.panel?.kind === "order")) { this.doShuffle(); return true; }
    if (key === "Escape") {
      if (this.mode === "panel") this.closePanel(); else if (this.mode === "pause") this.resume(); else if (this.mode === "live" && !this.band) this.setModePause("pause");
      return true;
    }
    return false;
  }

  /** Enter（PC）: 選んでいる卓の用件を進める。用件が無ければ、はじめの心の声が指す卓へ移る。 */
  pressA() {
    if (this.band) return;
    if (this.mode === "intro") return this.start();
    if (this.mode === "panel") return this.choose();
    if (this.mode === "pause") return this.pauseChoose();
    if (this.mode === "result") return this.resultNext();
    if (this.mode !== "live") return;
    if (this.coach?.step.talk) return this.coachTalkDone();
    const busy = ["order", "care", "tend", "bill"].includes(floorTap(this.s, this.sel));
    if (busy || !this.hint?.tableId || this.hint.tableId === this.sel) this.tapTable(this.sel); else this.followHint();
  }

  /* ── 注文・頼みを聞いている間（本編の「接客の画面」）: 下の画面が、その卓の客の一言と、選ぶ札（ミックス5つ／5つの手）に替わる。
     上の店内はそのまま見えている（選んでいる卓だけ明るい）。聞いている間、店の時間は止まる（本編と同じ） ── */

  panelOptions() {
    const s = this.s, table = s.tables[this.panel.id - 1], guest = s.guests[table.guestId];
    return this.panel.kind === "order" ? floorHand(s, guest?.order).map((mix) => ({ mix, action: { type: "order", tableId: table.id, mix: mix.id } }))
      : VERBS.map((verb) => ({ verb, action: { type: "care", tableId: table.id, verb: verb.id } }));
  }

  openPanel(kind, id, { quiet = false } = {}) {
    if (this.coach?.step.expect?.panel === kind && this.coach.step.expect.tableId === id) this.coachNext(); // 卓を開く段は、開いたら次へ
    this.panel = { kind, id, cursor: 0, locked: false };
    // 矢印キーの印は、はじめ、いちばん合う一台に置く（頼みは上から）
    if (kind === "order") {
      const opts = this.panelOptions();
      const best = opts.findIndex((o) => o.mix.rating === "best"), good = opts.findIndex((o) => o.mix.rating === "good");
      this.panel.cursor = best >= 0 ? best : good >= 0 ? good : 0;
    }
    this.sel = id;
    if (quiet) { this.mode = "panel"; return; }
    this.refs.band.dataset.on = "false"; this.refs.notice.dataset.on = "false";
    this.setMode("panel");
  }

  closePanel() {
    clearTimeout(this.verdictTimer);
    const id = this.panel?.id;
    this.panel = null;
    this.refs.who.dataset.key = ""; // 判定の印を出していたら、消して書き直す
    this.setMode("live");
    // チュートリアルで次に指す卓があれば、そこを選んでおく
    const next = this.coachTable() || id;
    if (next) this.select(next);
  }

  /** 矢印キーで選んでいる札（PC）。指で押す時は使わない。 */
  syncCursor() {
    const keys = this.keyNav;
    [...this.refs.rows.children].forEach((node, i) => node.setAttribute("aria-current", String(!!keys && !!this.panel && i === this.panel.cursor)));
  }

  choose() {
    const { panel } = this;
    if (!panel || this.mode !== "panel") return;
    if (panel.locked) { this.closePanel(); return; } // 印が出ている間にもう一度押したら、先へ進む
    const option = this.panelOptions()[panel.cursor], node = this.refs.rows.children[panel.cursor];
    if (!option || node?.disabled || !this.perform(option.action)) { this.nudge(node); return; }
    if (this.mode !== "panel" || !this.panel) return; // 営業が締まった
    const care = this.s.log.find((e) => e.type === "care");
    if (!care || this.phone.fixed) { this.closePanel(); return; }
    // 頼み: 判定の印（◎ ×）が客の顔の所に出て、吹き出しが客の返事に替わる。1秒で店へ戻る
    panel.locked = true;
    const { who } = this.refs;
    who.dataset.verdict = care.ok ? "best" : "bad";
    this.refs.rows.children[panel.cursor]?.setAttribute("data-picked", "true");
    who.querySelector(".fl-guest-mark").innerHTML = `<img src="${this.art(care.ok ? "verdict-best" : "verdict-bad")}" alt="">`;
    const quote = who.querySelector(".fl-quote");
    if (care.line) { quote.dataset.sight = "false"; this.fitText(quote.querySelector(".fl-q"), quoted(care.line)); }
    this.verdictTimer = this.later(() => { if (this.panel?.locked && this.mode === "panel") this.closePanel(); }, 1000);
  }

  /* ── 開店前・休止・精算 ── */

  introHtml() {
    const { esc } = this.kit;
    return `<section class="fl-intro" role="dialog" aria-label="${esc(this.plan.title)}">
      <img class="fl-orn" src="${this.art("deco-ornament")}" alt="">
      <p class="fl-eyebrow">${VENUE.subtitle}</p>
      <h2 class="fl-title" style="background-image:url(${this.art("deco-ribbon")})"><span>${esc(this.tutorial ? "段取りのおさらい" : this.plan.title)}</span></h2>
      <p class="fl-forecast">${this.tutorial ? "スミさんと、一通りやってみる" : `今日の予報：${esc(this.plan.forecast)}`}</p>
      <p class="fl-wishes">${WISHES.map((w) => this.wishChip({ wish: w.id })).join("")}</p>
    </section>`;
  }

  start() {
    if (this.phone.fixed) return;
    if (this.tutorial) { this.startTutorial(); return; }
    this.setMode("live");
    this.cutin("営業開始", this.plan.title);
    this.select(1);
  }

  pauseOptions() {
    if (this.pauseKind === "close") return [["営業に戻る", () => this.resume()], ["店を閉める", () => { this.pauseKind = null; this.setMode("live"); this.perform({ type: "finish" }); }]];
    if (this.coach) return [["つづける", () => this.resume()], ["説明を飛ばす", () => this.finishTutorial()]];
    return [["つづける", () => this.resume()],
      [this.speed === 1 ? "ゆっくりにする" : "ふつうの速さに戻す", () => { this.speed = this.speed === 1 ? 0.6 : 1; this.renderLayer(); }],
      ["早じまいにする", () => { this.pauseKind = "close"; this.pausePick = 0; this.renderLayer(); }]];
  }

  setModePause(kind) {
    this.pauseKind = kind; this.pausePick = 0;
    this.setMode("pause");
  }

  resume() {
    this.pauseKind = null;
    this.setMode("live");
  }

  pauseChoose() { this.pauseOptions()[this.pausePick]?.[1](); }

  pauseHtml() {
    const closing = this.pauseKind === "close";
    return `<section class="fl-intro fl-pause" role="dialog" aria-label="${closing ? "早じまいにする？" : "ひと休み"}">
      <p class="fl-eyebrow">${VENUE.name}</p>
      <h2 class="fl-title plain"><span>${closing ? "早じまいにする？" : "ひと休み"}</span></h2>
      <p class="fl-forecast">${closing ? "いまいる客を送り出して、店を閉めます" : "休止中は、店の時間が止まっています"}</p>
      <div class="choices">${this.pauseOptions().map(([label], i) => `<button class="choice" data-act="fl-pause-pick" data-i="${i}" aria-current="${i === this.pausePick}" style="--i:${i}"><i></i>${label}</button>`).join("")}</div>
    </section>`;
  }

  closeNight() {
    if (this.mode === "closing" || this.mode === "result") return;
    clearTimeout(this.verdictTimer);
    this.panel = null; this.pauseKind = null;
    this.setMode("closing");
    this.cutin("営業終了", this.s.closing === "early" ? "早じまい" : "おつかれさまでした", "close", () => {
      this.resultPage = 0;
      this.setMode("result");
      this.countUp();
    });
  }

  /** 精算の店の売上は、0から数え上がる。 */
  countUp() {
    const total = this.refs.layer.querySelector(".fl-total b");
    if (!total || this.reduce) return;
    const to = this.s.sales, start = performance.now();
    const step = (now) => {
      if (this.dead || !total.isConnected) return;
      const k = Math.min(1, (now - start) / 900);
      total.textContent = Math.round(to * (1 - (1 - k) ** 3)).toLocaleString("ja-JP");
      if (k < 1) requestAnimationFrame(step); else total.parentElement.dataset.done = "true";
    };
    requestAnimationFrame(step);
  }

  resultNext() {
    if (this.resultPage === 0) { this.resultPage = 1; this.renderActs(); this.renderLayer(); return; }
    if (this.phone.fixed) { this.resultPage = 0; this.renderActs(); this.renderLayer(); return; }
    this.phone.setScene("map");
  }

  /** 精算。1枚め＝評価と店の売上、2枚め＝好評だったミックス・数の内訳・スミさんの一言・日当（丸ボタンで送る）。 */
  resultHtml() {
    const s = this.s, { icon, esc } = this.kit, result = floorResult(s, 0), pay = result.pay;
    const drinks = result.groups.reduce((sum, row) => sum + Math.round((row.drink || 0) / PRICE.drink), 0);
    const head = `<p class="fl-eyebrow ribbon" style="background-image:url(${this.art("deco-ribbon")})"><span>${VENUE.name}・${esc(result.title)}・本日の精算</span></p>`;
    if (this.resultPage === 0) {
      const items = [["チャージ", yen(result.items.charge)], ["シーシャ", yen(result.items.shisha)], [`ドリンク ${drinks}杯`, yen(result.items.drink)], ["トップ替え", yen(result.items.top)],
        ["お客さん", `${result.served}／${result.came}人`], ["店のファン", `${result.fans >= 0 ? "＋" : "−"}${Math.abs(result.fans)}人`, result.fans < 0 ? "down" : "fans"]];
      return `<section class="fl-result" data-rank="${result.rank}" role="dialog" aria-label="本日の精算">${head}
        <div class="fl-medal"><img src="${this.art(MEDAL[result.rank])}" alt=""><b>${result.stamp}</b></div>
        <div class="fl-total"><small>店の売上</small><b>${result.sales.toLocaleString("ja-JP")}</b><small>円</small></div>
        <dl class="fl-items">${items.map(([name, value, tone = ""]) => `<div data-tone="${tone}"><dt>${tone ? icon("fans") : ""}${name}</dt><dd>${value}</dd></div>`).join("")}</dl>
        <p class="fl-stages">${MOODS.filter((m) => result.stages[m.id]).map((m) => `<span aria-label="${m.label} ${result.stages[m.id]}人"><img src="${this.art(MOOD_ART[m.id])}" alt=""><b>${result.stages[m.id]}</b></span>`).join("")}</p>
        ${result.visitor ? `<p class="fl-visitor">今日は、${esc(s.guests.g3.name)}が遊びに来た</p>` : ""}
        ${result.rank === "S" ? `<div class="fl-confetti" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>` : ""}
        <i class="fl-pages"><i class="on"></i><i></i></i>
      </section>`;
    }
    const counts = [["add", "いい調整", result.counts.tend, "回"], ["talk", "いいケア", result.counts.care, "回"], ["glass", "追加ドリンク", result.counts.drink, "杯"],
      ["top", "おかわり", result.counts.extend, "人"], ["lamp", "フィーバー", result.fevers, "回"], ...(result.streak >= 2 ? [["star", "ぴったり", result.streak, "連続"]] : [])];
    return `<section class="fl-result page2" data-rank="${result.rank}" role="dialog" aria-label="本日の精算">${head}
      <h3 class="fl-sub">好評だったミックス</h3>
      <ul class="fl-tops">${result.mixes.length ? result.mixes.map((m, i) => `<li><i>${i + 1}</i>${attrHtml(this.art, m.id)}<span class="fl-opt-text"><b>${esc(mixName(m.id))}</b>${mixIsSingle(m.id) ? "" : `<small>（${mixFlavorNames(m.id).join("・")}）</small>`}</span>
        <em aria-label="${floorStage(m.avg).label}・${m.n}台"><img src="${this.art(MOOD_ART[floorStage(m.avg).id])}" alt="">${m.n}台</em></li>`).join("") : `<li class="none">提供できた一台がありませんでした</li>`}</ul>
      <p class="fl-counts">${counts.map(([name, label, value, unit]) => `<span aria-label="${label} ${value}${unit}">${icon(name)}<b>${value}</b></span>`).join("")}</p>
      <div class="coach fl-boss"><img src="${this.face("sumi")}" alt="スミさん"><span class="say"><span class="say-text">${esc(result.comment)}</span></span></div>
      <p class="fl-pay"><span>基本給 <b>${yen(pay.base)}</b></span><span>歩合 <b>${yen(pay.commission)}</b></span><strong>支給額 <b>${yen(pay.total)}</b></strong></p>
      <i class="fl-pages"><i></i><i class="on"></i></i>
    </section>`;
  }

  renderLayer() {
    const { layer } = this.refs;
    layer.innerHTML = this.mode === "intro" ? this.introHtml() : this.mode === "pause" ? this.pauseHtml() : this.mode === "result" ? this.resultHtml() : "";
    layer.dataset.mode = this.mode;
    this.el.dataset.flMode = this.mode;
    if (this.mode === "result") this.fitBoss();
  }

  /** 精算のスミさんの一言も、本編の組版で折る（2行まで）。 */
  fitBoss() {
    const say = this.refs.layer.querySelector(".fl-boss .say-text");
    if (say) this.fitText(say, say.textContent);
  }

  /** 文を、箱の幅と書体で測って折る（本編の組版）。2行に収まらない時は、字を一段（客の一言は二段まで）小さくして収める。 */
  fitText(node, text) {
    const { paginateForBox, plain } = this.kit;
    node.classList.remove("small", "tiny");
    node.textContent = text;
    if (!node.clientWidth) return;
    let pages = paginateForBox(text, node);
    if (pages.length > 1) { node.classList.add("small"); pages = paginateForBox(text, node); }
    if (pages.length > 1) { node.classList.add("tiny"); pages = paginateForBox(text, node); } // 客の長い一言は、もう一段小さく
    if (pages.length === 1) node.innerHTML = plain(pages[0]);
    else { node.textContent = text; console.warn("2行に収まらない:", text); }
  }

  relayout() {
    if (this.coach) this.coachSay();
    if (this.refs && !this.panel?.locked) { this.refs.who.dataset.key = ""; this.syncDeck(); } // 客の一言を、新しい幅で折り直す
    if (this.mode === "result") this.fitBoss();
  }

  /* ── チュートリアル（TFL64）: スミさんが一段ずつ「やること」を出し、それ以外は受けない。
     talk＝読んで丸ボタンで次へ／wait＝時間を流して待つ／expect＝この操作をしたら次へ（panel＝その卓の接客の画面を開く）。
     cue＝段に入った時にスミさんが起こすこと。focus＝光らせる所。言葉は本編の TUTORIAL（縦では一覧が下にあるので「右の一覧」だけ「下の一覧」に読み替える）。
     縦のテロップは2行までなので、二言の長い言葉（シャッフル・フィーバーの3つ）は句点で分けて、読む段とやる段にした（言葉は変えていない） ── */

  static FLOW = [
    { id: "hello", talk: true },
    { id: "arrive", wait: (s) => s.tables[0].phase === "order" },
    { id: "wish", talk: true, focus: ["table", 1] },
    { id: "open", expect: { panel: "order", tableId: 1 }, focus: ["table", 1] },
    { id: "pick", expect: { type: "order", tableId: 1, rating: "best" } },
    { id: "prep", wait: (s) => s.tables[0].phase === "enjoy" && s.tables[1].phase === "order" },
    { id: "shuffle", part: 0, talk: true, focus: ["table", 2] },
    { id: "shuffle", part: 1, expect: { type: "shuffle" }, focus: ["shuffle"] },
    { id: "shuffling", wait: (s) => floorShuffleLeft(s) === 0 },
    { id: "quick", expect: { type: "order", tableId: 2, rating: "best" }, focus: ["table", 2] },
    { id: "prep2", wait: (s) => s.tables[1].phase === "enjoy" },
    { id: "care", cue: ["cough", 1], expect: { panel: "care", tableId: 1 }, focus: ["table", 1] },
    { id: "careAnswer", expect: { type: "care", tableId: 1, verb: "teach" } },
    { id: "tend", cue: ["coal", 2], expect: { type: "tend", tableId: 2 }, focus: ["table", 2] },
    { id: "bill", cue: ["bill", 1], expect: { type: "bill", tableId: 1 }, focus: ["table", 1] },
    { id: "fever", part: 0, cue: ["fever"], talk: true, focus: ["fever"] },
    { id: "fever", part: 1, expect: { type: "fever" }, focus: ["fever"] },
    { id: "feverWait", part: 0, talk: true },
    { id: "feverWait", part: 1, wait: (s) => s.feverLeft <= floorFeverLength - 4 },
    { id: "feverStop", part: 0, expect: { type: "feverStop" }, focus: ["fever"] },
    { id: "feverStop", part: 1, talk: true },
    { id: "done", talk: true },
  ];

  coachLine(step = this.coach?.step) {
    if (!step) return "";
    const text = (TUTORIAL[step.id] || "").replace("右の一覧", "下の一覧");
    return step.part === undefined ? text : text.split("。")[step.part] || text;
  }

  coachExpects(action) {
    const want = this.coach?.step.expect;
    if (!this.coach) return true;
    if (!want?.type || want.type !== action.type) return false;
    if (want.tableId && want.tableId !== action.tableId) return false;
    if (want.verb && want.verb !== action.verb) return false;
    if (want.rating) {
      const guest = this.s.guests[this.s.tables[action.tableId - 1]?.guestId];
      if (!guest || floorHand(this.s, guest.order).find((mix) => mix.id === action.mix)?.rating !== want.rating) return false;
    }
    return true;
  }

  coachOpens(kind, id) {
    const want = this.coach?.step.expect;
    return !!want && want.tableId === id && (want.panel === kind || want.type === kind); // 選ぶ段の途中で「あとで」と閉じても、同じ卓を開き直せる
  }

  coachNudge() {
    if (!this.coach) return;
    this.nudge(this.refs.coach);
    if (this.coach.step.talk) return;
    this.coachSay(TUTORIAL.nudge);
    clearTimeout(this.nudgeTimer);
    this.nudgeTimer = this.later(() => { if (this.coach) this.coachSay(); }, 1600);
  }

  /** スミさんの言葉を出す（下の画面のいちばん上。店内と、客の段のあいだ）。 */
  coachSay(text = this.coachLine()) {
    const { coach, coachText } = this.refs;
    coach.hidden = !this.coach;
    if (!this.coach) return;
    coach.dataset.talk = String(!!this.coach.step.talk);
    this.fitText(coachText, text);
  }

  /** チュートリアルがいま指している卓（光らせる所が決まっていない段は、やることの卓）。 */
  coachTable() {
    const step = this.coach?.step;
    return step?.focus?.[0] === "table" ? step.focus[1] : step?.focus ? 0 : step?.expect?.tableId || 0;
  }

  coachFocus() {
    if (!this.refs) return;
    const step = this.coach?.step, table = this.coachTable();
    const [kind, id] = table ? ["table", table] : step?.focus || [];
    for (const spot of this.refs.tables) spot.root.dataset.coach = String(kind === "table" && spot.root.dataset.id === String(id));
    this.el.querySelector(".fl-chip-shuffle")?.setAttribute("data-coach", String(kind === "shuffle"));
    this.el.querySelector(".fl-chip-fever")?.setAttribute("data-coach", String(kind === "fever"));
  }

  /** 段に入る: スミさんの段取りを起こし、言葉と光らせる所を替える。待つ段がもう済んでいれば、すぐ次へ。 */
  coachEnter(index) {
    const step = FloorScene.FLOW[index];
    if (!step) return this.finishTutorial();
    this.coach = { index, step };
    if (step.cue) {
      this.s = floorTutorialCue(this.s, step.cue[0], step.cue[1] || null);
      this.play(this.s.log);
    }
    clearTimeout(this.nudgeTimer);
    if (step.focus?.[0] === "table") this.sel = step.focus[1];
    this.renderActs(); // 読む段は「次へ」、やる段はシャッフル・フィーバー・休止
    this.sync();
    this.coachSay();
    if (step.wait && step.wait(this.s)) this.coachNext();
  }

  coachNext() { if (this.coach) this.coachEnter(this.coach.index + 1); }
  coachCheck() { if (this.coach?.step.wait?.(this.s)) this.coachNext(); }
  coachDid(action) { if (this.coach && this.coach.step.expect?.type === action.type) this.coachNext(); }
  coachTalkDone() { if (this.coach?.step.talk && this.mode === "live") this.coachNext(); }

  startTutorial() {
    if (!this.tutorial) { this.shiftId = "tutorial"; this.open(); }
    this.mode = "live";
    this.coach = { index: -1, step: FloorScene.FLOW[0] };
    if (this.refs) { this.el.dataset.flMode = "live"; this.renderLayer(); }
    this.coachEnter(0);
  }

  /** 一通り済んだ（または飛ばした）: そのまま、はじめてのワンオペの開店前へ。 */
  finishTutorial() {
    if (!this.coach) return;
    clearTimeout(this.nudgeTimer);
    this.coach = null; this.pauseKind = null;
    this.shiftId = "first";
    this.open();
    this.refs.coach.hidden = true;
    this.refs.room.dataset.dusk = "false";
    this.lineLog = "";
    this.refs.deck.dataset.key = "";
    for (const spot of this.refs.tables) { spot.keys = {}; spot.fx.innerHTML = ""; }
    this.said = {}; this.reopen = 0;
    this.refs.who.dataset.key = ""; this.refs.info.dataset.key = "";
    this.setMode("intro");
    this.phone.onExtOption?.("shift", this.shiftId);
  }
}
