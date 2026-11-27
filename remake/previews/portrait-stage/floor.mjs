// 縦画面C案「煙の舞台」: 店番（tonari フロア営業）を縦へ移した試作（要望台帳 VPM02）。
// ルール・数値・客・ミックス・台詞は本編のもの（remake/js/daily/tonari-floor-model.js・tonari-floor-data.js）をそのまま呼ぶ。
// ここで作るのは縦の画面だけ: 上の絵＝店内と5つの卓の札／真ん中＝はじめの心の声とミックスの一覧／下＝補助の段（シャッフル・フィーバー・休止）と十字キー・丸ボタン。
// 十字キーで卓を選び、丸ボタンでその卓の用件（注文を聞く・炭を整える・会計・頼みを聞く）。注文と頼みは「接客の画面」に替わり、その間は時間が止まる（本編と同じ）。
// 本編の進行・所持金・保存には触れない。音は鳴らさない（この試作には音の仕組みが無い）。
import {
  createFloorNight, createFloorTutorial, floorTick, floorAct, floorTap, floorTutorialCue, floorOrderTarget, floorHint, floorResult,
  floorUrgency, floorWaitLeft, floorStayLeft, floorCoalLeft, floorTendDue, floorMaking, floorHand, floorShuffleLeft, floorTimeLeft, floorStage,
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

// 丸ボタンの顔（卓の用件ごと）。白い図形で描き、文字は使わない（VPL31・VPL34）。読み上げ用の名前は aria-label
const FL_BTN = {
  fl_open: { label: "開店する", text: "開店" },
  fl_order: { label: "注文を聞く", tool: "fl_order" },
  fl_care: { label: "頼みを聞く", tool: "fl_care" },
  fl_tend: { label: "炭を整える", tool: "fl_tend" },
  fl_bill: { label: "会計する", tool: "fl_bill" },
  fl_go: { label: "用事のある卓へ", svg: '<path d="M8 9l8 7-8 7M17 9l8 7-8 7"/>' },
  fl_idle: { label: "用事なし", svg: '<circle cx="8" cy="16" r="1.800"/><circle cx="16" cy="16" r="1.800"/><circle cx="24" cy="16" r="1.800"/>' },
};
const FL_TOOL = {
  // 注文を聞く: 伝票（上に留め具、中に3本の行）
  fl_order: `<svg class="tool-svg tool-fl" viewBox="0 0 100 100" aria-hidden="true"><path d="M30 19h40a6 6 0 0 1 6 6v54a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V25a6 6 0 0 1 6-6z"/><rect x="39" y="12" width="22" height="13" rx="4"/>
    <path class="gl-cut" d="M35 42h30M35 55h30M35 68h17"/></svg>`,
  // 頼みを聞く: 吹き出しの中に「！」
  fl_care: `<svg class="tool-svg tool-fl" viewBox="0 0 100 100" aria-hidden="true"><path d="M22 20h56a7 7 0 0 1 7 7v36a7 7 0 0 1-7 7H52L34 87V70H22a7 7 0 0 1-7-7V27a7 7 0 0 1 7-7z"/>
    <path class="gl-cut" d="M50 31v20"/><circle class="gl-cutf" cx="50" cy="60" r="3"/></svg>`,
  // 炭を整える: 熾きた炭（立方体）と、立ちのぼる熱
  fl_tend: `<svg class="tool-svg tool-fl" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 38 77 52v24L50 90 23 76V52z"/><path class="gl-cut" d="M23 52l27 14 27-14M50 66v24"/>
    <path class="gl-line" d="M36 30c-5-6 5-9 0-16M50 26c-5-6 5-9 0-16M64 30c-5-6 5-9 0-16"/></svg>`,
  // 会計する: 伝票の控え（下がぎざぎざ）と、右下に硬貨
  fl_bill: `<svg class="tool-svg tool-fl" viewBox="0 0 100 100" aria-hidden="true"><path d="M22 13h44v70l-7.300-5.500L51.300 83 44 77.500 36.700 83l-7.400-5.500L22 83z"/><path class="gl-cut" d="M31 29h26M31 42h26M31 55h13"/>
    <circle class="gl-coin" cx="71" cy="66" r="17"/><path class="gl-cut thin" d="M65 60l6 7 6-7M71 67v8M66 69h10"/></svg>`,
};

/** 属性の印（メイン＝大きい角丸、サブ＝右下に重なる小さい丸）。絵は本編の印（remake/img/ui/tonari-floor/attr-*.webp）。 */
const attrHtml = (art, id) => {
  const { main, sub } = MIXES[id];
  return `<span class="fl-attr" role="img" aria-label="${WISH[main].label}がメイン${sub ? `、${WISH[sub].label}がサブ` : ""}"><img src="${art(`attr-${main}`)}" alt="">${sub ? `<img class="sub" src="${art(`attr-${sub}-sub`)}" alt="">` : ""}</span>`;
};

export class FloorScene {
  /**
   * @param phone 1台ぶんの画面（app.mjs の Phone）
   * @param kit app.mjs の部品（icon・esc・dpadHtml・aHtml・BTN・TOOL_SVG・ICONS・REMAKE_IMG）
   * @param opts shift＝営業の種類、shot＝一覧（PC）に並べる時の場面（intro / live / order / care / fever / result / result2 / coach）
   */
  constructor(phone, kit, { shift = "usual", shot = null } = {}) {
    Object.assign(this, { phone, kit, el: phone.el, shot });
    Object.assign(kit.ICONS, FL_ICONS);
    Object.assign(kit.BTN, FL_BTN);
    Object.assign(kit.TOOL_SVG, FL_TOOL);
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
      back: {}, logs: [], lastHint: "" });
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
        <span class="fl-making" role="img" aria-label="仕込み中: なし">${icon("cook")}${Array.from({ length: RULES.slots }, () => `<i></i>`).join("")}<em hidden></em></span>
        <span class="pill fl-status">
          <span class="fl-clock">${icon("clock")}<b>0:00</b><i class="fl-timebar"><i></i></i></span><i class="sep"></i>
          <span class="fl-sales">${icon("coins")}<b>0</b><small>円</small>
            <i class="fl-outlook" role="img" aria-label="いまの調子: まだ分からない">${VENUE.ranks.filter((r) => r.min > 0).map((r) => `<u style="left:${r.min}%"></u>`).join("")}<i></i></i></span>
        </span>
      </div>
      <div class="fl-tables" role="group" aria-label="全${RULES.tableCount}卓">${tables}</div>
      <div class="fl-band" data-on="false"></div>
      <div class="fl-notice" data-on="false"></div>
      <i class="fl-flash"></i>
      <div class="body">
        <div class="telop fl-telop" data-slot="telop">
          <button class="fl-ticker" data-act="fl-hint" aria-label="はじめの心の声"><span class="fl-log"></span><span class="fl-voice"><img src="${this.face("hajime")}" alt=""><b></b></span></button>
          <button class="coach fl-coach" data-act="fl-coach" aria-label="スミさんの言葉" hidden><img src="${this.face("sumi")}" alt=""><span class="say"><span class="say-text"></span><i class="fl-coach-next"></i></span></button>
          <div class="fl-hand" data-busy="false"><i class="fl-target"></i><div class="fl-mixes"></div>
            <div class="fl-busy">${icon("shuffle")}<b>入れ替え中</b><span class="fl-busy-bar"><i></i></span><small></small></div></div>
        </div>
        <div class="ctrl fl-ctrl" data-slot="ctrl"></div>
      </div>
      <div class="fl-layer" data-slot="layer"></div>`;
  }

  mount() {
    const { el } = this, q = (sel) => el.querySelector(sel);
    this.refs = {
      room: q(".fl-room"), tables: [...el.querySelectorAll(".fl-table")].map((root) => ({ root, want: root.querySelector(".fl-want"), fx: root.querySelector(".fl-fx"),
        who: root.querySelector(".fl-who"), cell: root.querySelector(".fl-cell"), bar: root.querySelector(".fl-bar i"), count: root.querySelector(".fl-count"), keys: {} })),
      making: q(".fl-making"), clock: q(".fl-clock b"), timebar: q(".fl-timebar i"), sales: q(".fl-sales b"), outlook: q(".fl-outlook"),
      band: q(".fl-band"), notice: q(".fl-notice"), flash: q(".fl-flash"), ticker: q(".fl-ticker"), log: q(".fl-log"), voice: q(".fl-voice b"),
      coach: q(".fl-coach"), coachText: q(".fl-coach .say-text"), hand: q(".fl-hand"), mixes: q(".fl-mixes"), busy: q(".fl-busy"),
      ctrl: q('[data-slot="ctrl"]'), layer: q('[data-slot="layer"]'),
    };
    if (this.shot) this.pose(this.shot);
    this.renderCtrl();
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
    else this.sel = first("order") || first("tend") || 1;
    for (const e of s.log) if (e.type === "arrive") this.log(`${e.tableId}卓　${s.guests[e.guestId].name}「${e.line}」`);
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
    if (this.refs) this.refs.log.textContent = text;
  }

  say(id, text) { if (text) this.log(`${id}卓${quoted(text)}`); }

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
        case "billReady": this.log(`${e.tableId}卓がお会計です`); break;
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

  syncMaking() {
    const list = floorMaking(this.s), active = list.slice(0, RULES.slots), { making } = this.refs;
    [...making.querySelectorAll("i")].forEach((pip, i) => {
      const m = active[i];
      pip.dataset.on = String(!!m);
      pip.style.setProperty("--p", m ? `${Math.round((1 - m.left / m.total) * 100)}%` : "0%");
    });
    const waiting = Math.max(0, list.length - RULES.slots), more = making.querySelector("em");
    more.hidden = !waiting; more.textContent = waiting ? `＋${waiting}` : "";
    making.setAttribute("aria-label", list.length ? `仕込み中: ${active.map((m) => `${m.tableId}卓 ${m.label}`).join("、")}${waiting ? `。順番待ち ${waiting}台` : ""}` : "仕込み中: なし");
  }

  /** ミックスの一覧（5つ）。属性の印だけで見せ、注文待ちの卓があれば、その客に合う札に判（◎・○）が付く。押すと、その卓へそのまま出す。 */
  syncHand() {
    const s = this.s, { hand, mixes, busy } = this.refs;
    const target = floorOrderTarget(s, this.sel);
    const order = target ? s.guests[target.guestId].order : null;
    const list = floorHand(s, order);
    const key = `${s.hand.join(",")}/${order?.wish || ""}/${order?.pref?.label || ""}/${target?.id || ""}`;
    if (hand.dataset.key !== key) {
      hand.dataset.key = key;
      hand.dataset.target = target ? String(target.id) : "";
      hand.style.setProperty("--c", order ? WISH[order.wish].color : "transparent");
      hand.querySelector(".fl-target").textContent = target ? String(target.id) : "";
      mixes.innerHTML = list.map((mix, i) => `<button class="fl-mix" data-act="fl-mix" data-i="${i}" data-rating="${mix.rating || ""}"
        aria-label="${mix.full}、${WISH[mix.main].label}${mix.sub ? `・${WISH[mix.sub].label}` : ""}${mix.rating ? `、${target.id}卓に${RATE_MARK[mix.rating]}` : ""}">
        ${attrHtml(this.art, mix.id)}<span class="fl-kinds">${mix.flavors.map(() => `<i></i>`).join("")}</span>
        ${mix.rating && mix.rating !== "none" ? `<i class="fl-rate" data-rating="${mix.rating}">${RATE_MARK[mix.rating]}</i>` : ""}</button>`).join("");
      this.coachFocus();
    }
    for (const spot of this.refs.tables) spot.root.dataset.target = String(String(target?.id || "") === spot.root.dataset.id);
    // 入れ替えの最中は、一覧を隠して進みを出す（ミックスは出せない）
    const wait = floorShuffleLeft(s);
    hand.dataset.busy = String(wait > 0);
    busy.querySelector(".fl-busy-bar i").style.width = `${Math.round((1 - wait / RULES.shuffle) * 100)}%`;
    busy.querySelector("small").textContent = wait > 0 ? `あと${seconds(wait)}秒` : "";
    const chip = this.el.querySelector(".fl-chip-shuffle");
    if (chip) {
      chip.disabled = wait > 0;
      chip.dataset.wait = String(wait > 0);
      chip.querySelector("span").textContent = wait > 0 ? `あと${seconds(wait)}秒` : "シャッフル";
      // 合う一台が並んでいない時は、シャッフルを光らせる
      chip.dataset.call = String(!!target && wait === 0 && list.every((mix) => mix.rating === "none"));
    }
  }

  sync() {
    const s = this.s, r = this.refs;
    if (!r) return;
    s.tables.forEach((table, i) => this.syncTable(r.tables[i], table));
    this.syncMaking();
    this.syncHand();
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
    if (hint.text !== this.lastHint) { this.lastHint = hint.text; r.voice.textContent = hint.text; }
    this.syncA();
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

  /* ── 下の操作（補助の段・十字キー・丸ボタン）。場面ごとに替える ── */

  /** 丸ボタンが今することを決める: 選んでいる卓の用件。用件が無ければ、はじめの心の声が指す卓へ移る。 */
  aKind() {
    if (this.mode === "intro") return ["fl_open", false];
    if (this.mode === "result") return [this.resultPage === 0 ? "next" : "ok", false];
    if (this.mode === "panel" || this.mode === "pause") return ["ok", false];
    if (this.coach?.step.talk) return ["next", false];
    const tap = floorTap(this.s, this.sel);
    if (tap === "order") return ["fl_order", floorShuffleLeft(this.s) > 0];
    if (tap === "care") return ["fl_care", false];
    if (tap === "tend") return ["fl_tend", false];
    if (tap === "bill") return ["fl_bill", false];
    const go = this.hint?.tableId && this.hint.tableId !== this.sel;
    return go ? ["fl_go", false] : ["fl_idle", true];
  }

  syncA() {
    const btn = this.el.querySelector(".fl-ctrl .btn-a");
    if (!btn) return;
    const [kind, dim] = this.aKind();
    if (btn.dataset.kind !== kind) {
      btn.dataset.kind = kind;
      btn.setAttribute("aria-label", this.kit.BTN[kind].label);
      btn.innerHTML = this.kit.btnFace(kind);
    }
    btn.disabled = !!dim;
    btn.classList.toggle("hot", ["fl_order", "fl_care", "fl_tend", "fl_bill"].includes(kind) && !dim);
  }

  renderCtrl() {
    const { kit, mode } = this, { icon, dpadHtml, aHtml } = kit;
    const chip = (act, name, label, cls = "", inner = "") => `<button class="chip ${cls}" data-act="${act}" aria-label="${label}">${icon(name)}<span>${label}</span>${inner}</button>`;
    let chips, dirs;
    if (mode === "intro") {
      chips = this.tutorial ? "" : chip("fl-howto", "help", "遊び方");
      dirs = "";
    } else if (mode === "panel") {
      const ordering = this.panel.kind === "order";
      chips = `${chip("fl-later", "back", "あとで")}${ordering ? chip("fl-shuffle", "shuffle", "シャッフル", "fl-chip-shuffle fl-gold") : ""}`;
      dirs = "up down";
    } else if (mode === "pause") {
      chips = chip("fl-resume", "back", "つづける");
      dirs = "up down";
    } else if (mode === "result") {
      chips = "";
      dirs = "";
    } else {
      chips = `${chip("fl-shuffle", "shuffle", "シャッフル", "fl-chip-shuffle fl-gold")}
        <button class="chip fl-chip-fever" data-act="fl-fever" aria-label="フィーバー"><img class="fl-lamp" src="${this.art("lamp-on")}" alt=""><span class="fl-fever-main"><span class="fl-fever-name"><b>フィーバー</b><small></small></span>
          <span class="fl-fever-gauge"><i class="fl-fever-fill"></i>${[1, 2].map((n) => `<u style="left:${n * floorFeverCost / floorFeverMax * 100}%"></u>`).join("")}</span></span></button>
        ${chip("fl-pause", "pause", "休止", "fl-chip-pause")}`;
      dirs = "up down left right";
    }
    const [kind, dim] = this.aKind();
    this.refs.ctrl.innerHTML = `<div class="chips labeled fl-chips" data-mode="${mode}">${chips}</div>${dpadHtml(dirs)}${aHtml(kind, { disabled: dim })}`;
    this.refs.ctrl.querySelector(".btn-a").dataset.kind = kind;
    this.coachFocus();
  }

  setMode(mode) {
    this.mode = mode;
    this.el.dataset.flMode = mode;
    this.renderCtrl();
    this.renderLayer();
    this.sync();
    this.lastAt = performance.now();
  }

  /* ── 操作 ── */

  select(id) {
    this.sel = id;
    for (const spot of this.refs.tables) spot.root.dataset.sel = String(spot.root.dataset.id === String(id));
    this.syncHand(); // ミックスを出す先（選んでいる注文待ちの卓）が変わる
    this.syncA();
  }

  /** 卓の用件を進める（札を押した時・丸ボタンを押した時で同じ）。 */
  tapTable(id) {
    if (this.mode !== "live" || this.band) return;
    this.select(id);
    const s = this.s, tap = floorTap(s, id);
    // チュートリアル: 今の段で指している卓の、その用件だけを受ける
    if (this.coach) {
      const want = this.coach.step.expect;
      const ok = !!want && want.tableId === id && (tap === "order" || tap === "care" ? this.coachOpens(tap, id) : tap === want.type);
      if (!ok) { this.coachNudge(); return; }
    }
    // 入れ替えの最中は、ミックスを出せない（その間に、ほかの卓を見る）
    if (tap === "order" && floorShuffleLeft(s) > 0) { this.pop(id, "入れ替え中…"); return; }
    if (tap === "order" || tap === "care") { this.openPanel(tap, id); return; } // 読んで選ぶもの（その間、時間は止まる）
    if (tap === "bill") { this.perform({ type: "bill", tableId: id }); return; }
    if (tap === "tend") { this.perform({ type: "tend", tableId: id }); return; }
    const table = s.tables[id - 1];
    if (table.phase !== "empty") this.pop(id, table.phase === "prep" ? (table.make.active ? "仕込み中" : "順番待ち") : table.phase === "enjoy" ? "炭はまだ平気" : "片付け中");
  }

  followHint() {
    if (this.mode !== "live" || !this.hint) return;
    if (this.hint.kind === "feverReady") return this.useFever();
    if (this.hint.tableId) this.select(this.hint.tableId);
  }

  /** 一覧のミックスをひと押しで出す（選んでいる卓が注文待ちならその卓へ、それ以外はいちばん長く待っている卓へ）。 */
  quickServe(index) {
    if (this.mode !== "live" || this.band) return;
    const target = floorOrderTarget(this.s, this.sel), mix = this.s.hand[index];
    if (!target) { this.log("注文待ちの卓がありません"); this.nudge(this.refs.hand); return; }
    this.select(target.id);
    if (!this.perform({ type: "order", tableId: target.id, mix })) this.nudge(this.refs.hand);
  }

  doShuffle() {
    if (!this.perform({ type: "shuffle", tableId: this.sel })) { this.nudge(this.el.querySelector(".fl-chip-shuffle")); return; }
    // 入れ替えには時間がかかるので、接客の画面は閉じて店へ戻る（その間に、ほかの卓を見られる）
    if (this.mode === "panel" && this.panel?.kind === "order") this.closePanel();
    else this.syncHand();
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
    if (act === "fl-table") this.tapTable(Number(hit.dataset.id));
    else if (act === "fl-mix") this.quickServe(Number(hit.dataset.i));
    else if (act === "fl-hint") this.followHint();
    else if (act === "fl-shuffle") this.doShuffle();
    else if (act === "fl-fever") this.useFever();
    else if (act === "fl-pause") { if (this.mode === "live" && !this.band) this.setModePause("pause"); }
    else if (act === "fl-resume") this.resume();
    else if (act === "fl-later") this.closePanel();
    else if (act === "fl-howto") this.startTutorial();
    else if (act === "fl-coach") this.coachTalkDone();
    else if (act === "fl-opt") { if (!this.panel || this.panel.locked) { this.choose(); return true; } this.panel.cursor = Number(hit.dataset.i); this.syncCursor(); this.choose(); }
    else if (act === "fl-pick") { this.pausePick = Number(hit.dataset.i); this.pauseChoose(); }
    else return false;
    return true;
  }

  move(dir) {
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

  /** PC のキー: F＝フィーバー、S＝シャッフル、Esc＝休止／接客の画面を閉じる（本編の PC 操作と同じ）。 */
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

  pressA() {
    if (this.band) return;
    if (this.mode === "intro") return this.start();
    if (this.mode === "panel") return this.choose();
    if (this.mode === "pause") return this.pauseChoose();
    if (this.mode === "result") return this.resultNext();
    if (this.mode !== "live") return;
    if (this.coach?.step.talk) return this.coachTalkDone();
    const [kind] = this.aKind();
    if (kind === "fl_go") this.followHint(); else this.tapTable(this.sel);
  }

  /* ── 接客の画面（注文＝ミックスを選ぶ／頼み＝5つの手から選ぶ）。上の絵とテロップの場所に重ね、パッドは残す。開いている間、店の時間は止まる ── */

  panelOptions() {
    const s = this.s, table = s.tables[this.panel.id - 1], guest = s.guests[table.guestId];
    return this.panel.kind === "order" ? floorHand(s, guest.order).map((mix) => ({ mix, action: { type: "order", tableId: table.id, mix: mix.id } }))
      : VERBS.map((verb) => ({ verb, action: { type: "care", tableId: table.id, verb: verb.id } }));
  }

  openPanel(kind, id, { quiet = false } = {}) {
    if (this.coach?.step.expect?.panel === kind && this.coach.step.expect.tableId === id) this.coachNext(); // 卓を開く段は、開いたら次へ
    this.panel = { kind, id, cursor: 0, locked: false };
    // はじめは、いちばん合う一台に印を置く（頼みは上から）
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
    this.setMode("live");
    // チュートリアルで次に指す卓があれば、そこを選んでおく（丸ボタンでそのまま進める）
    const next = this.coach?.step.focus?.[0] === "table" ? this.coach.step.focus[1] : id;
    if (next) this.select(next);
  }

  syncCursor() {
    this.refs.layer.querySelectorAll(".fl-opt").forEach((node, i) => node.setAttribute("aria-current", String(i === this.panel.cursor)));
  }

  choose() {
    const { panel } = this;
    if (!panel || this.mode !== "panel") return;
    if (panel.locked) { this.closePanel(); return; } // 印が出ている間にもう一度押したら、先へ進む
    const option = this.panelOptions()[panel.cursor];
    if (!option) return;
    const node = this.refs.layer.querySelectorAll(".fl-opt")[panel.cursor];
    if (node?.disabled || !this.perform(option.action)) { this.nudge(node); return; }
    if (this.mode !== "panel" || !this.panel) return; // 営業が締まった
    const care = this.s.log.find((e) => e.type === "care");
    if (!care || this.phone.fixed) { this.closePanel(); return; }
    // 頼み: 判定の印（◎ ×）が卓の様子のまん中に大きく出て、吹き出しが客の返事に替わる。1秒で店へ戻る
    panel.locked = true;
    const sheet = this.refs.layer.querySelector(".fl-sheet");
    sheet.dataset.verdict = care.ok ? "best" : "bad";
    node.dataset.picked = "true";
    sheet.querySelector(".fl-verdict").innerHTML = `<img src="${this.art(care.ok ? "verdict-best" : "verdict-bad")}" alt=""><b>${care.ok ? "いいケア！" : "ちがったみたい"}</b>`;
    if (care.line) { const quote = sheet.querySelector(".fl-quote"); quote.dataset.sight = "false"; this.fitText(quote, quoted(care.line)); }
    this.verdictTimer = this.later(() => { if (this.panel?.locked && this.mode === "panel") this.closePanel(); }, 1000);
  }

  panelHtml() {
    const s = this.s, { kit } = this, { icon, esc } = kit;
    const table = s.tables[this.panel.id - 1], guest = s.guests[table.guestId];
    if (!guest) return "";
    const ordering = this.panel.kind === "order", wish = WISH[guest.order.wish], stage = floorStage(table.mood);
    let lead, sight = false;
    if (ordering) lead = quoted(guest.order.quote);
    else {
      const call = floorCallLine(s, table.id); // 本編の人物は、その人の口調で頼む
      sight = s.hint !== "said";
      lead = sight ? call.sight : quoted(call.said);
    }
    const options = this.panelOptions().map(({ mix, verb, action }, i) => {
      // チュートリアル: 今の段でやる一つだけを押せる（ほかは沈める）
      const ok = !this.coach || this.coachExpects(action);
      const attrs = `class="fl-opt" data-act="fl-opt" data-i="${i}" aria-current="${i === this.panel.cursor}"${ok ? "" : " disabled"}${this.coach && ok ? ` data-coach="true"` : ""}`;
      if (mix) {
        return `<button ${attrs} data-rating="${mix.rating}" aria-label="${mix.full}、${RATE_MARK[mix.rating]}">${attrHtml(this.art, mix.id)}
          <span class="fl-opt-text"><b>${esc(mix.name)}</b>${mixIsSingle(mix.id) ? "" : `<small>（${mixFlavorNames(mix.id).join("・")}）</small>`}</span>
          <i class="fl-opt-rate" data-rating="${mix.rating}">${RATE_MARK[mix.rating]}</i></button>`;
      }
      return `<button ${attrs} aria-label="${verb.label}"><span class="fl-opt-icon">${icon(VERB_ICON[verb.id])}</span>
        <span class="fl-opt-text"><b>${verb.label}</b><small>${verb.note}</small></span></button>`;
    }).join("");
    const served = table.phase === "enjoy" || table.phase === "bill";
    return `<section class="fl-sheet" data-kind="${this.panel.kind}" role="dialog" aria-label="${table.id}卓 ${ordering ? "ミックスを選ぶ" : "頼みを聞く"}" style="--c:${ordering ? wish.color : stage.color}">
      <header class="fl-visit">
        <img class="fl-visit-bg" src="${floorDusk(s) ? this.roomNight : this.roomDay}" alt="">
        <div class="fl-visit-row"><span class="fl-visit-who">${this.guestImg(guest)}<b class="fl-visit-no" aria-label="${table.id}卓">${table.id}</b></span>
          <div class="fl-visit-side">
            <div class="fl-visit-name"><b>${esc(guest.name)}</b>${served ? `<img src="${this.art(MOOD_ART[stage.id])}" alt="${stage.label}">` : ""}${served && table.mix ? attrHtml(this.art, table.mix) : ""}</div>
            <div class="fl-visit-kind">${ordering ? this.wishChip(guest.order, { refill: table.refill }) : `<span class="fl-need" data-tone="act">${icon(table.call.coal ? "add" : "ask")}<b>${table.call.coal ? "炭の調整" : "ケア"}</b></span>`}<em>${icon("coins")}${yen(floorBill(s, table.id)?.total || 0)}</em></div>
          </div></div>
        <p class="fl-quote" data-sight="${sight}">${esc(lead)}</p>
        <div class="fl-verdict" aria-hidden="true"></div>
      </header>
      ${this.coach ? `<div class="coach fl-sheet-coach"><img src="${this.face("sumi")}" alt=""><span class="say"><span class="say-text"></span></span></div>` : ""}
      <div class="fl-list">${options}</div>
    </section>`;
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
      <div class="choices">${this.pauseOptions().map(([label], i) => `<button class="choice" data-act="fl-pick" data-i="${i}" aria-current="${i === this.pausePick}" style="--i:${i}"><i></i>${label}</button>`).join("")}</div>
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
    if (this.resultPage === 0) { this.resultPage = 1; this.renderCtrl(); this.renderLayer(); return; }
    if (this.phone.fixed) { this.resultPage = 0; this.renderCtrl(); this.renderLayer(); return; }
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
    layer.innerHTML = this.mode === "intro" ? this.introHtml() : this.mode === "panel" ? this.panelHtml() : this.mode === "pause" ? this.pauseHtml()
      : this.mode === "result" ? this.resultHtml() : "";
    layer.dataset.mode = this.mode;
    this.el.dataset.flMode = this.mode;
    if (this.mode === "panel" && this.coach) this.coachSay();
    if (this.mode === "panel") this.fitQuote();
    if (this.mode === "result") this.fitBoss();
  }

  /** 接客の画面の客の一言も、本編の組版で折る（2行まで。収まらない時は字を一段小さく）。 */
  fitQuote() {
    const quote = this.refs.layer.querySelector(".fl-quote");
    if (quote && !this.panel?.locked) this.fitText(quote, quote.textContent);
  }

  /** 精算のスミさんの一言も、本編の組版で折る（2行まで）。 */
  fitBoss() {
    const say = this.refs.layer.querySelector(".fl-boss .say-text");
    if (say) this.fitText(say, say.textContent);
  }

  /** 文を、箱の幅と書体で測って折る（本編の組版）。2行に収まらない時は、字を一段小さくして収める。 */
  fitText(node, text) {
    const { paginateForBox, plain } = this.kit;
    node.classList.remove("small");
    node.textContent = text;
    if (!node.clientWidth) return;
    let pages = paginateForBox(text, node);
    if (pages.length > 1) { node.classList.add("small"); pages = paginateForBox(text, node); }
    if (pages.length === 1) node.innerHTML = plain(pages[0]);
    else { node.textContent = text; console.warn("2行に収まらない:", text); }
  }

  relayout() {
    if (this.coach) this.coachSay();
    if (this.mode === "panel") this.fitQuote();
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
    { id: "quick", expect: { type: "order", tableId: 2, rating: "best" }, focus: ["hand"] },
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
    return !!want && want.tableId === id && (want.panel === kind || (kind === "order" && want.type === "order"));
  }

  coachNudge() {
    if (!this.coach) return;
    this.nudge(this.refs.coach);
    if (this.coach.step.talk) return;
    this.coachSay(TUTORIAL.nudge);
    clearTimeout(this.nudgeTimer);
    this.nudgeTimer = this.later(() => { if (this.coach) this.coachSay(); }, 1600);
  }

  /** スミさんの言葉を出す（店ではテロップの所、接客の画面ではその中）。 */
  coachSay(text = this.coachLine()) {
    const { coach, coachText } = this.refs;
    coach.hidden = !this.coach;
    if (!this.coach) return;
    coach.dataset.talk = String(!!this.coach.step.talk);
    this.fitText(coachText, text);
    const inPanel = this.refs.layer.querySelector(".fl-sheet-coach .say-text");
    if (inPanel) this.fitText(inPanel, text);
  }

  coachFocus() {
    if (!this.refs) return;
    const [kind, id] = this.coach?.step.focus || [];
    for (const spot of this.refs.tables) spot.root.dataset.coach = String(kind === "table" && spot.root.dataset.id === String(id));
    this.el.querySelector(".fl-chip-shuffle")?.setAttribute("data-coach", String(kind === "shuffle"));
    this.el.querySelector(".fl-chip-fever")?.setAttribute("data-coach", String(kind === "fever"));
    this.refs.hand.dataset.coach = String(kind === "hand");
    this.refs.mixes.querySelectorAll(".fl-mix").forEach((node) => { node.dataset.coach = String(kind === "hand" && node.dataset.rating === "best"); });
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
    this.sync();
    this.coachSay();
    this.coachFocus();
    this.syncA();
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
    if (this.refs) { this.el.dataset.flMode = "live"; this.renderCtrl(); this.renderLayer(); }
    this.coachEnter(0);
    if (this.refs) this.renderCtrl();
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
    this.refs.log.textContent = "";
    this.refs.hand.dataset.key = "";
    for (const spot of this.refs.tables) { spot.keys = {}; spot.fx.innerHTML = ""; }
    this.setMode("intro");
    this.phone.onFloorShift?.(this.shiftId);
  }
}
