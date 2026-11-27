// 縦画面C案「煙の舞台」: 斧投げを縦へ移した試作（要望台帳 VPM05）。
// 第1章のひよりと行く斧投げ（3投の練習・見守りはひより。remake/js/daily/hiyori-axe.js が呼ぶ runAxeThrow({ mode: "practice", opponent: "hiyori" })）を基準にする。
// ルール・採点・回転と横流れの計算・手応えの数値・ひよりの一言・ランクは本編の部品をそのまま呼ぶ:
//   axe-model.js（採点の正本）／axe-pull-model.js（弾きの読み取り）／axe-equipment.js（店の斧）／axe-feel.js（間と演出の数値）／
//   axe-flight.js・axe-geometry.js（斧の形と刺さった姿）／axe-presentation.js（結果の言葉）／axe-challenges.js（目標とランク）／axe-companions.js（ひより）。
// 本編の画面（remake/js/minigames/axe.js）は core/ui・core/audio・core/state を連れてくるので読まず、そこにだけある値と言葉は、出どころを書いて写した。
// 縦の並べ方（十字キーと丸ボタンは置かない）: 上＝投げ数と累計／的（レーンいっぱい）／ひよりの一言／下の広い場所＝投げる専用の場所。
//   構える前は「構える」と宣言、針を止める間は場所ぜんぶが「止める」ボタン、投げる時は斧の握りを上へ弾く。
// 本編の進行・所持金・記録・保存には触れない。音は鳴らさない（この試作には音の仕組みが無い）。
import {
  MODES, RINGS, LINE, BLADE, CLUSTERS, KILLS, BOARD, POWER, SWAY, liftFor, gaugeAt, axisAt, releaseAimAt, closuresOf, killState, canCall,
  resolveThrow, totalOf, gradeOf,
} from "../../js/minigames/axe-model.js";
import { AXE_FEEL } from "../../js/minigames/axe-feel.js";
import { TARGET, CAMERA, AXE, FLIGHT, flightTime, flightDuration, impactPose, projectPoint, projectAxePoint } from "../../js/minigames/axe-flight.js";
import { createAxe, renderAxe } from "../../js/minigames/axe-geometry.js";
import { flickRead, flickPower, flickTilt, flickDriftScale } from "../../js/minigames/axe-pull-model.js";
import { axePower, axeGreenBand, HOUSE_AXE } from "../../js/minigames/axe-equipment.js";
import { impactFeedback, contactHold, powerVerdict, shotFeedback, sessionStats, quiverAt, zoneLabel, haloFor, killPlaces } from "../../js/minigames/axe-presentation.js";
import { pickChallenges, evaluateChallenges, heatOf, rankOf, rankTargets, titleOf } from "../../js/minigames/axe-challenges.js";
import { COMPANIONS, portraitFocus, reaction } from "../../js/minigames/axe-companions.js";

const { x: CX, y: CY, radius: R } = TARGET;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const RULES = MODES.practice;                       // 3投・満点22（第1章のひよりとの斧投げ）
const OPTIONS = { division: "rec", throws: RULES.throws };
const MATE = "hiyori";
const T = AXE_FEEL.tempo, CUE = AXE_FEEL.cue;
// ── 本編の画面（remake/js/minigames/axe.js）にだけある値と言葉の写し ──
const CYCLES = { horizontal: 3600, vertical: 3600 };  // 針が往復する長さ（ms）: cycles
const CALL_ORDER = ["upper-left", "lower-left", "upper-right", "lower-right"]; // 宣言の札を押すたびに回る順: callOrder
const KEY_HOLD_MS = 1000;                           // Space を押している長さ→回転（axe-pull-input.js の KEYBOARD_HOLD_MS）
// 弾き損ねの理由の札: FLICK_MISS
const FLICK_MISS = { shallow: ["弾きが浅い", "↑ もう少し上まで弾く"], lean: ["斜めすぎ", "↑ まっすぐ上へ弾く"],
  down: ["上へ弾いて投げる", "↑ 下ではなく上へ"], hold: ["Space を長めに", "押している長さが回転"] };
const GRADE_LABEL = { great: "GREAT THROWING", good: "NICE SESSION", again: "KEEP THROWING" }; // 集計の見出し
// 板の絵（target_board_watl_c_800.webp）の、木が描かれている範囲: OPAQUE。板の四隅: PLANK
const OPAQUE = { left: 69 / 1254, right: 1185 / 1254, top: 61 / 1254, bottom: 1190 / 1254 };
const PLANK = { left: CX + BOARD.left * R, right: CX + BOARD.right * R, top: CY + BOARD.top * R, bottom: CY + BOARD.bottom * R };
const CHIPS = { cell: 128, cols: 4, rows: 2, size: 26 }; // 木片の絵（wood-chips.webp・4×2マス）
// ── 縦の画面だけの値 ──
// 的の描く範囲（本編と同じ座標: 的の中心 330,245・1のリングの半径 164）。板の5枚ぶんと少しの余白
const VIEW = { x: 105, y: 12, w: 450, h: 466 };
const BLADE_PX = BLADE.halfLength * R;
const NEAR = CAMERA.focal / (CAMERA.focal + AXE_FEEL.path.startZ); // 手元（放す所）での見かけの大きさ

const SHOTS = ["choice", "horizontal", "power", "result", "summary"];

const ICONS = {
  axAxe: '<path d="M14.5 3.5 20.5 9.500"/><path d="M9 5c3-2.600 7-2.400 9.500.300L11.600 12.200C8.800 10.700 7.700 7.400 9 5Z" class="f"/><path d="M12.600 9.200 3.600 20.400"/>',
  axClose: '<path d="M6 6l12 12M18 6 6 18"/>',
  axAim: '<circle cx="12" cy="12" r="6.500"/><path d="M12 2.500v5M12 16.500v5M2.500 12h5M16.500 12h5"/>',
  axUp: '<path d="M12 20V5M5.500 11.500 12 5l6.500 6.500"/>',
  axRedo: '<path d="M4.500 12a7.500 7.500 0 1 0 2.400-5.500"/><path d="M4 4.500v4.500h4.500"/>',
  axBreath: '<path d="M3 9.500h10a3 3 0 1 0-3-3M3 14.500h14a3 3 0 1 1-3 3"/>',
};

export class AxeScene {
  /** 場面の名札（app.mjs が読む）: 名前・光の色・一覧（PC）に並べる場面。 */
  static META = {
    id: "axe", label: "斧投げ", acc: "#ff8c3a",
    gallery: {
      title: "斧投げ",
      note: "本編の斧投げ（第1章・ひよりと3投）を縦へ。採点・回転・横流れ・手応えの数値・ひよりの一言は本編のものをそのまま使い、画面だけ縦に組んだ。十字キーと丸ボタンは置かず、下の広い場所が投げる専用の場所になる（構える→横と縦の針を止める→斧の握りを上へ弾く）。",
      shots: [
        { caption: "構える前（青をタップでキルショット宣言）", shot: "choice" },
        { caption: "針を止める（場所ぜんぶが「止める」）", shot: "horizontal" },
        { caption: "上へ弾いて投げる", shot: "power" },
        { caption: "刺さった所の点と、回転の振り返り", shot: "result" },
        { caption: "3投の結果", shot: "summary" },
      ],
    },
  };

  /**
   * @param phone 1台ぶんの画面（app.mjs の Phone）
   * @param kit app.mjs の部品（icon・esc・plain・paginateForBox・ICONS・REMAKE_IMG）
   * @param opts shot＝途中の場面から開く（一覧に並べる時・確かめる時）: choice / horizontal / power / result / summary
   */
  constructor(phone, kit, { shot = null } = {}) {
    Object.assign(this, { phone, kit, el: phone.el, shot: SHOTS.includes(shot) ? shot : null });
    Object.assign(kit.ICONS, ICONS);
    if (!phone.fixed) phone.extOpts.shot = null; // 途中の場面から開くのは一度だけ
    const img = kit.REMAKE_IMG;
    this.art = {
      lane: `${img}backgrounds/bg_axe_lane.webp`, board: `${img}ui/axe_throw/target_board_watl_c_800.webp`,
      axe: `${img}ui/axe_throw/throwing_axe.webp`, chips: `${img}ui/axe_throw/wood-chips.webp`, cut: `${img}ui/axe_throw/cut-mark.webp`,
      face: (name) => `${img}sprites/character_variants/new/${MATE}/chr_${MATE}_${name}.webp`,
    };
    this.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.timers = new Set();
    this.life = new AbortController();
    this.uid = (AxeScene.seq = (AxeScene.seq || 0) + 1);
    this.newGame();
  }

  newGame() {
    // 目標は投げ始めの種で決まる（本編と同じ pickChallenges）。一覧（PC）は同じ並び
    this.seed = this.phone.fixed ? 20261127 : (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0);
    this.goalIds = pickChallenges("practice", this.seed);
    Object.assign(this, { shots: [], called: null, phase: "choice", elapsed: 0, stamp: null, lastAction: -1e9, lastHud: 0, pending: null,
      cleared: new Set(), cuts: [], quiver: null, shown: null, legend: false, shakePhase: [0, 0], lastInput: "pointer" });
    this.resetThrow();
  }

  resetThrow() {
    Object.assign(this, { aim: { x: 0, y: 0 }, power: POWER.ideal, raw: 0, held: 0, focusUntil: -1, focusUsed: false, flick: null, tilt: 0, keyHold: null, swipe: 0 });
  }

  later(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); if (!this.dead) fn(); }, ms);
    this.timers.add(id);
    return id;
  }

  destroy() {
    this.dead = true;
    this.life.abort();
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
  }

  /* ── 骨組み（一度だけ作り、あとは render で書き換える） ── */

  boardSvg() {
    const id = `ax${this.uid}`, line = LINE * 2 * R, n = (v) => Number(v.toFixed(2));
    const pw = (PLANK.right - PLANK.left) / (OPAQUE.right - OPAQUE.left), ph = (PLANK.bottom - PLANK.top) / (OPAQUE.bottom - OPAQUE.top);
    // 塗装は公式の寸法（本編 axe.js の markings と同じ描き方）: 20mmの黒い線、赤い中心、青いキルショット
    const rings = RINGS.slice(2).map((ring) => `<circle cx="${CX}" cy="${CY}" r="${n(ring.radius * R)}" fill="none" stroke="#1c1410" stroke-width="${n(line)}" opacity=".9"/>`).join("");
    const numbers = ["1", "2", "3", "4"].map((text, i) => `<text x="${CX + 7}" y="${n(CY - (RINGS[5 - i].radius + RINGS[4 - i].radius) / 2 * R)}" dominant-baseline="central" fill="#f1e3c8" opacity=".8" font-size="22" font-weight="900" paint-order="stroke" stroke="#1c1410" stroke-width="3">${text}</text>`).join("");
    const clusters = CLUSTERS.map((c) => `<circle cx="${n(CX + c.x * R)}" cy="${n(CY + c.y * R)}" r="${n(RINGS[1].radius * R)}" fill="none" stroke="#1c1410" stroke-width="${n(line)}" opacity=".9"/>
      <circle cx="${n(CX + c.x * R)}" cy="${n(CY + c.y * R)}" r="${n(RINGS[0].radius * R)}" fill="#c23b2a"/>`).join("");
    const kills = KILLS.map((k) => `<g data-kill="${k.id}"><circle cx="${n(CX + k.x * R)}" cy="${n(CY + k.y * R)}" r="${n(k.outer * R - 1)}" fill="#2f7fc1" stroke="#c23b2a" stroke-width="2"/>
      <circle cx="${n(CX + k.x * R)}" cy="${n(CY + k.y * R)}" r="${n(k.inner * R - 0.6)}" fill="#163f78" stroke="#e2412c" stroke-width="1.2"/></g>`).join("");
    const tri = (x, y, rotate) => `<path d="M0 0L-11 -18H11Z" transform="translate(${n(x)} ${n(y)}) rotate(${rotate})" fill="#ffd36b" stroke="#2a1a10" stroke-width="2.5" stroke-linejoin="round"/>`;
    const chips = Array.from({ length: 24 }, (_, i) => {
      const chip = i % (CHIPS.cols * CHIPS.rows), half = CHIPS.size / 2;
      return `<g class="ax-chip"><svg x="${-half}" y="${-half}" width="${CHIPS.size}" height="${CHIPS.size}" overflow="hidden" viewBox="${chip % CHIPS.cols * CHIPS.cell} ${Math.floor(chip / CHIPS.cols) * CHIPS.cell} ${CHIPS.cell} ${CHIPS.cell}"><image href="${this.art.chips}" width="${CHIPS.cell * CHIPS.cols}" height="${CHIPS.cell * CHIPS.rows}"/></svg></g>`;
    }).join("");
    return `<svg class="ax-board" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" role="img" aria-label="斧投げの的。赤6点・5の円・リング4〜1点・宣言した青7／8点">
      <defs>
        <radialGradient id="${id}v" cx="${CX}" cy="${CY}" r="${n(R * 1.62)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff3d6" stop-opacity=".08"/><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".58"/></radialGradient>
        <radialGradient id="${id}s"><stop offset="0" stop-color="#120a05" stop-opacity=".95"/><stop offset=".6" stop-color="#120a05" stop-opacity=".55"/><stop offset="1" stop-color="#120a05" stop-opacity="0"/></radialGradient>
      </defs>
      <g class="ax-art">
        <image href="${this.art.board}" x="${n(PLANK.left - OPAQUE.left * pw)}" y="${n(PLANK.top - OPAQUE.top * ph)}" width="${n(pw)}" height="${n(ph)}" preserveAspectRatio="none"/>
        <rect x="${n(PLANK.left)}" y="${n(PLANK.top)}" width="${n(PLANK.right - PLANK.left)}" height="${n(PLANK.bottom - PLANK.top)}" fill="url(#${id}v)"/>
        <g class="ax-markings" aria-hidden="true">${rings}${numbers}${clusters}${kills}</g>
        <g class="ax-cuts" aria-hidden="true"></g>
      </g>
      <circle class="ax-halo" r="0" fill="none" opacity="0"/>
      <circle class="ax-called" r="${n(KILLS[0].outer * R + 5)}" fill="none" stroke="#fff5b1" stroke-width="3" opacity="0"/>
      <path class="ax-shift" fill="none" opacity="0"/><circle class="ax-release" r="4" opacity="0"/>
      <ellipse class="ax-shadow" rx="0" ry="0" fill="url(#${id}s)" opacity="0"/>
      <g class="ax-impacts"></g>
      <path class="ax-trail" fill="none" stroke="#fff1cf" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
      <g class="ax-flying"></g>
      <g class="ax-fixed" opacity="0"><path d="M-9 0H9M0 -9V9" stroke="#140d08" stroke-width="4.5" stroke-linecap="round"/><path d="M-9 0H9M0 -9V9" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>
      <g class="ax-cross" opacity="0"><path d="M0 ${n(-BLADE_PX)}V${n(BLADE_PX)}" stroke="#140d08" stroke-width="6.5" stroke-linecap="round"/><path d="M0 ${n(-BLADE_PX)}V${n(BLADE_PX)}" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
        <circle r="8" fill="none" stroke="#140d08" stroke-width="5"/><circle r="8" fill="none" stroke="#fff" stroke-width="2.2"/></g>
      <g class="ax-guide" data-guide="x" opacity="0" aria-hidden="true">${tri(0, PLANK.top + 26, 0)}${tri(0, PLANK.bottom - 4, 180)}</g>
      <g class="ax-guide" data-guide="y" opacity="0" aria-hidden="true">${tri(PLANK.left + 2, 0, -90)}${tri(PLANK.right - 2, 0, 90)}</g>
      <path class="ax-needle" data-needle="x" d="M0 ${n(PLANK.top)}V${n(PLANK.bottom)}" stroke="#91cfe6" stroke-width="2.5" opacity="0"/>
      <path class="ax-needle" data-needle="y" d="M${n(PLANK.left)} 0H${n(PLANK.right)}" stroke="#e5bd70" stroke-width="2.5" opacity="0"/>
      <g class="ax-kill-hits">${KILLS.map((k) => `<circle data-kill-hit="${k.id}" cx="${n(CX + k.x * R)}" cy="${n(CY + k.y * R)}" r="27" fill="transparent"/>`).join("")}</g>
      <g class="ax-fx" opacity="0" aria-hidden="true" pointer-events="none">
        <circle class="ax-flash" r="30" fill="#fff5da"/><circle class="ax-ring-dark" r="18" fill="none" stroke="#2a1a10" stroke-width="5"/>
        <circle class="ax-ring" r="18" fill="none" stroke-width="3"/><circle class="ax-echo" r="18" fill="none" stroke-width="1.5"/>
        ${Array.from({ length: 10 }, () => `<circle class="ax-dust" r="3" fill="#d8b477"/>`).join("")}${chips}
        <text class="ax-burst" text-anchor="middle" font-size="38" font-weight="900" paint-order="stroke" stroke="#17120e" stroke-width="4"></text>
      </g>
    </svg>`;
  }

  html() {
    const { icon } = this.kit, green = axeGreenBand(HOUSE_AXE.id), pc = (v) => `${(v * 100).toFixed(1)}%`;
    return `
      <img class="amb" src="${this.art.lane}" alt="">
      <div class="pic ax-lane"><img class="bg" src="${this.art.lane}" alt=""></div>
      <i class="veil ax-veil"></i>
      <header class="ax-hud">
        <button class="ax-round" data-act="ax-quit" aria-label="やめる">${icon("axClose")}</button>
        <button class="ax-round" data-act="ax-legend" aria-label="遊び方・ルール" aria-expanded="false"><b>？</b></button>
        <ol class="ax-tiles" aria-label="各投の点">${Array.from({ length: RULES.throws }, (_, i) => `<li data-i="${i}"><i>${i + 1}</i><strong>—</strong><em></em></li>`).join("")}</ol>
        <div class="ax-total"><small>累計</small><b>0</b><span>/ ${RULES.max}</span><em></em></div>
      </header>
      <div class="ax-stage" data-act="ax-board">${this.boardSvg()}
        <div class="ax-legend" hidden><b>得点</b>
          <span><i style="--c:#c23b2a"></i>赤6</span><span><i class="ring"></i>5の円</span><span><i class="ring big"></i>リング4〜1</span><span><i style="--c:#2f7fc1"></i>宣言した青7／8</span></div>
        <div class="ax-cue" data-on="false" aria-hidden="true"></div>
      </div>
      <div class="body ax-body">
        <div class="ax-mate"><span class="ax-face" role="img" aria-label="${COMPANIONS[MATE].name}"></span>
          <p class="ax-line"><small>${COMPANIONS[MATE].name}</small><span class="ax-line-text"></span></p></div>
        <div class="ax-pad" data-phase="choice">
          <ul class="ax-goals" aria-label="目標"></ul>
          <div class="ax-tools">
            <button class="ax-tag" data-act="ax-reaim">${icon("axRedo")}<span>構え直す</span></button>
            <button class="ax-tag" data-act="ax-focus">${icon("axBreath")}<span>集中</span></button>
            <span class="ax-live" hidden><small>今の刃先</small><b>0点</b><em></em></span>
          </div>
          <button class="ax-tag ax-call" data-act="ax-call" aria-pressed="false">${icon("axAim")}<span><b>キルショット</b><small></small></span></button>
          <div class="ax-mat" aria-label="上へ弾いて投げる">
            <svg class="ax-arrow" viewBox="0 0 144 300" fill="none" aria-hidden="true"><path d="M55 232V80m34 152V80" stroke="#886b48" stroke-width="2"/><path class="ax-arrow-path" stroke="#fff2bd" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="ax-grip"><img src="${this.art.axe}" alt=""></span>
            <b class="ax-mat-label">${icon("axUp")}<span>上へ弾いて<br>投げる</span></b>
          </div>
          <div class="ax-gauge" role="img" aria-label="回転ゲージ。緑の帯が刃から当たる回転">
            <i class="ax-stick" style="bottom:${pc(POWER.stickMin)};height:${pc(POWER.stickMax - POWER.stickMin)}"></i>
            <i class="ax-sweet" style="bottom:${pc(green.min)};height:${pc(green.max - green.min)}"></i>
            <i class="ax-fill"></i><i class="ax-pin"></i><small>回転</small>
          </div>
          <div class="ax-result" hidden>
            <p class="ax-result-head"><b class="ax-result-label"></b><strong class="ax-result-num"></strong><small class="ax-result-unit"></small></p>
            <p class="ax-zone"></p>
            <div class="ax-review" hidden><span class="ax-review-bar"><i class="ax-stick" style="left:${pc(POWER.stickMin)};width:${pc(POWER.stickMax - POWER.stickMin)}"></i><i class="ax-sweet" style="left:${pc(POWER.sweetMin)};width:${pc(POWER.sweetMax - POWER.sweetMin)}"></i><i class="ax-mark"></i></span><b></b></div>
            <p class="ax-tip"></p>
          </div>
          <button class="ax-primary" data-act="ax-act"><span class="ax-primary-icon">${icon("axAxe")}</span><b></b></button>
        </div>
      </div>
      <section class="ax-summary" hidden role="dialog" aria-label="3投の結果">
        <p class="ax-sum-label"></p>
        <div class="ax-sum-main"><span class="ax-rank"><b></b></span><p class="ax-sum-score"><strong></strong><small>/ ${RULES.max}</small><em></em></p></div>
        <ol class="ax-sum-throws"></ol>
        <p class="ax-sum-stats"></p>
        <ul class="ax-goals ax-sum-goals"></ul>
        <div class="ax-mate ax-sum-mate"><span class="ax-face" role="img" aria-label="${COMPANIONS[MATE].name}"></span><p class="ax-line"><small>${COMPANIONS[MATE].name}</small><span class="ax-line-text"></span></p></div>
        <div class="ax-sum-buttons"><button class="ax-tag" data-act="ax-retry"><span>もう一度</span></button><button class="ax-primary" data-act="ax-finish"><b>終了</b></button></div>
      </section>
      <i class="ax-flashbox"></i>`;
  }

  mount() {
    const { el } = this, q = (sel) => el.querySelector(sel), all = (sel) => [...el.querySelectorAll(sel)];
    const flying = createAxe(HOUSE_AXE), ghosts = [createAxe(HOUSE_AXE), createAxe(HOUSE_AXE)];
    for (const node of [...ghosts, flying]) { node.setAttribute("opacity", 0); q(".ax-flying").append(node); }
    this.r = {
      stage: q(".ax-stage"), board: q(".ax-board"), cuts: q(".ax-cuts"), halo: q(".ax-halo"), calledRing: q(".ax-called"), shift: q(".ax-shift"), release: q(".ax-release"),
      shadow: q(".ax-shadow"), impacts: q(".ax-impacts"), trail: q(".ax-trail"), flying, ghosts, fixed: q(".ax-fixed"), cross: q(".ax-cross"),
      guideX: q('[data-guide="x"]'), guideY: q('[data-guide="y"]'), needleX: q('[data-needle="x"]'), needleY: q('[data-needle="y"]'),
      fx: q(".ax-fx"), flash: q(".ax-flash"), ringDark: q(".ax-ring-dark"), ring: q(".ax-ring"), echo: q(".ax-echo"), dust: all(".ax-dust"), chips: all(".ax-chip"), burst: q(".ax-burst"),
      tiles: all(".ax-tiles li"), total: q(".ax-total b"), next: q(".ax-total em"), legend: q(".ax-legend"), cue: q(".ax-cue"),
      face: q(".ax-body .ax-face"), line: q(".ax-body .ax-line-text"), sumFace: q(".ax-sum-mate .ax-face"), sumLine: q(".ax-sum-mate .ax-line-text"), pad: q(".ax-pad"), goals: q(".ax-pad > .ax-goals"), tools: q(".ax-tools"), reaim: q('[data-act="ax-reaim"]'), focus: q('[data-act="ax-focus"]'),
      live: q(".ax-live"), call: q(".ax-call"), mat: q(".ax-mat"), grip: q(".ax-grip"), arrow: q(".ax-arrow-path"), gauge: q(".ax-gauge"), fill: q(".ax-fill"), pin: q(".ax-pin"),
      result: q(".ax-result"), review: q(".ax-review"), primary: q(".ax-pad > .ax-primary"), summary: q(".ax-summary"), flashbox: q(".ax-flashbox"),
    };
    // 弾く操作は、投げる場所（下の広い所）で受ける。指が場所の外へ抜けても、捕まえた指を離す所まで追う
    const opt = { signal: this.life.signal }, { mat } = this.r;
    mat.addEventListener("pointerdown", (e) => this.flickDown(e), opt);
    mat.addEventListener("pointermove", (e) => this.flickMove(e), opt);
    mat.addEventListener("pointerup", (e) => this.flickUp(e), opt);
    mat.addEventListener("pointercancel", () => this.flickCancel(), opt);
    mat.addEventListener("lostpointercapture", (e) => { if (this.flick?.id === e.pointerId) this.flickCancel(); }, opt);
    // PC: Space・Enter で構える・針を止める・次へ。投げる時は Space を押している長さが回転（本編と同じ）。F で集中、Esc で構え直す
    addEventListener("keydown", (e) => this.keyDown(e), { ...opt, capture: true });
    addEventListener("keyup", (e) => this.keyUp(e), { ...opt, capture: true });
    addEventListener("blur", () => this.flickCancel(), opt);
    // 書体が届く前に測った折り目は、届いてから測り直す
    document.fonts?.ready.then(() => { if (!this.dead && this.r) this.relayout(); });
    if (this.shot) this.pose(this.shot);
    this.setPhase(this.phase, { keep: true });
    this.relayout();
  }

  /* ── 途中の場面を作る（一覧に並べる時・確かめる時） ── */

  pose(shot) {
    const throwAt = (x, y, power, called = null) => {
      const s = { ...resolveThrow({ x, y, power, called }, this.shots, OPTIONS), baseAim: { x, y }, sway: { x: 0, y: 0, amplitude: 0, fatigue: 0, focused: false } };
      this.shots.push(s);
      return s;
    };
    if (shot === "horizontal") { this.phase = "horizontal"; this.elapsed = this.held = 1330; }
    else if (shot === "power") {
      throwAt(0.3, -0.12, 0.6);
      this.cuts = [this.shots[0]];
      Object.assign(this, { phase: "power", aim: { x: 0.02, y: -0.03 }, held: 2600, elapsed: 900, raw: 0.6, power: 0.6, swipe: 0.42, tilt: 0.12, posed: this.phone.fixed });
    } else if (shot === "result") {
      throwAt(0.3, -0.12, 0.6);
      this.cuts = [this.shots[0]];
      const s = throwAt(0.05, 0.02, 0.57);
      Object.assign(this, { phase: "result", elapsed: 5000, shown: s });
      this.embed(s, false);
    } else if (shot === "summary") {
      throwAt(0.3, -0.12, 0.6); throwAt(0.05, 0.02, 0.57); throwAt(-0.4, 0.21, 0.66);
      this.cuts = this.shots.slice(0, 2);
      Object.assign(this, { phase: "summary", elapsed: 5000, shown: this.shots[2] });
      this.embed(this.shots[2], false);
    }
  }

  /* ── 段階: choice（構える前）→ horizontal → vertical（針を止める）→ power（弾く）→ flight → result →（次の投 / summary） ── */

  setPhase(next, { keep = false } = {}) {
    this.clearCue();
    this.phase = next;
    if (!keep) { this.elapsed = 0; this.stamp = null; }
    const { r } = this;
    if (next === "choice" && !keep) {
      // 前の投の斧は抜いて、刺さった跡を残す
      if (this.shown?.stuck) this.cuts.push(this.shown);
      this.shown = null; this.quiver = null; r.impacts.replaceChildren();
    }
    if (next === "flight") {
      this.contacted = null; this.holdFrame = 0;
      renderAxe(r.flying, this.flightPose(this.pending, this.reduce ? FLIGHT.travel + FLIGHT.fall : 0));
      r.flying.setAttribute("opacity", 1);
    }
    if (next === "power" && !keep && !this.demoShown && !this.reduce) { this.demoShown = true; r.mat.dataset.demo = "true"; this.later(() => { r.mat.dataset.demo = "false"; }, 1100); }
    this.phaseCue(next);
    this.render();
  }

  /** 大きな場面だけ帯で知らせる（本編の phaseCue）: 最後の一投と、この投で届いた目標。 */
  phaseCue(next) {
    if (this.phone.fixed) return;
    if (next === "choice" && this.shots.length === RULES.throws - 1) this.showCue({ label: "LAST THROW", place: this.rankLine(8) || "最後の一投", kind: "last", duration: CUE.last });
    else if (next === "result") {
      const fresh = evaluateChallenges(this.goalIds, this.shots).filter((c) => c.state === "done" && !this.cleared.has(c.id));
      fresh.forEach((c) => this.cleared.add(c.id));
      if (fresh.length) this.showCue({ label: "目標達成", place: fresh.map((c) => c.short).join(" / "), kind: "goal", duration: CUE.goal });
    }
  }

  /** 次のランクまでの残り点。最後の一投で届くものだけ（本編の rankLine）。 */
  rankLine(reachable = Infinity) {
    return rankTargets(totalOf(this.shots), RULES.max).filter((t) => t.need <= reachable).slice(0, 2).map((t, i) => (i ? "" : "あと") + t.need + "点で" + t.rank).join(" · ");
  }

  showCue({ label, place = "", kind = "", duration = CUE.declare }) {
    const { cue } = this.r;
    clearTimeout(this.cueTimer);
    cue.innerHTML = `<strong>${this.kit.esc(label)}</strong>${place ? `<span>${this.kit.esc(place)}</span>` : ""}`;
    cue.dataset.kind = kind;
    cue.dataset.on = "false"; void cue.offsetWidth; cue.dataset.on = "true";
    this.cueTimer = this.later(() => { cue.dataset.on = "false"; }, duration);
  }

  clearCue() { clearTimeout(this.cueTimer); if (this.r) this.r.cue.dataset.on = "false"; }

  guarded() { return performance.now() - this.lastAction < T.guard || (CYCLES[this.phase] && this.elapsed < T.guard); }

  /** 押して進める操作（下のボタン・的のタップ・Space/Enter が同じ道を通る）: 構える → 横を止める → 縦を止める →（弾く）→ 次の一投へ → 終了。 */
  act() {
    if (this.phone.fixed || this.guarded() || !["choice", "horizontal", "vertical", "result", "summary"].includes(this.phase)) return;
    this.lastAction = performance.now();
    if (this.phase === "choice") { this.held = 0; this.setPhase("horizontal"); }
    else if (this.phase === "horizontal") { this.aim.x = axisAt(gaugeAt(this.elapsed, CYCLES.horizontal)); this.setPhase("vertical"); }
    else if (this.phase === "vertical") { this.aim.y = axisAt(gaugeAt(this.elapsed, CYCLES.vertical)); this.setPhase("power"); }
    else if (this.phase === "result") {
      if (this.shots.length === RULES.throws) this.setPhase("summary");
      else { this.called = null; this.resetThrow(); this.setPhase("choice"); }
    } else this.finish();
  }

  finish() { if (!this.phone.fixed) this.phone.setScene("map"); }

  reaim() {
    if (this.phone.fixed || this.guarded() || !["horizontal", "vertical", "power"].includes(this.phase)) return;
    this.flickCancel();
    this.lastAction = performance.now();
    Object.assign(this, { aim: { x: 0, y: 0 }, power: POWER.ideal, raw: 0, held: 0, focusUntil: -1 });
    this.setPhase("choice");
  }

  /** 息を整える: 1投に1回、少しの間だけ手ぶれを抑える（本編の focusAim）。 */
  focusAim() {
    if (this.phone.fixed || !["horizontal", "vertical", "power"].includes(this.phase) || this.focusUsed || performance.now() - this.lastAction < T.guard) return;
    this.focusUsed = true; this.focusUntil = this.held + SWAY.focusDuration;
    this.render();
  }

  /* ── キルショットの宣言（構える前だけ）: 札を押すたびに青が替わる。的の青をタップしても宣言できる ── */

  canChooseCall() { return this.phase === "choice" && !this.phone.fixed && performance.now() - this.lastAction >= T.guard; }

  callStatus() {
    const status = killState(this.shots, RULES.throws);
    if (status.remaining && !KILLS.some((k) => canCall(k.id, this.shots, RULES.throws))) status.remaining = 0;
    return status;
  }

  cycleCall() {
    if (!this.canChooseCall()) return;
    const next = CALL_ORDER.slice(CALL_ORDER.indexOf(this.called) + 1).find((id) => canCall(id, this.shots, RULES.throws));
    this.selectCall(next || null);
  }

  selectCall(id) {
    if (!this.canChooseCall() || (id && !canCall(id, this.shots, RULES.throws))) return;
    const previous = this.called;
    this.called = id;
    this.render();
    if (!id) { this.clearCue(); return; }
    this.showCue(previous ? { label: killPlaces[id], kind: "retarget", duration: 320 } : { label: "キルショット", place: "挑戦", kind: "challenge", duration: 1000 });
  }

  /* ── 弾いて投げる（投げる場所で受ける）。強さ＝離す直前の上向きの速さ、横の流れ＝弾いた向きの傾き（axe-pull-model.js の flickRead） ── */

  /** 速さの物差し。本編は横持ちの画面の高さ（短い辺）で測るので、縦持ちでは画面の幅（短い辺）を使う（同じ指の速さで同じ回転になる）。 */
  flickSpan() { return this.el.getBoundingClientRect().width; }

  canFlick() { return this.phase === "power" && !this.phone.fixed && !document.hidden; }

  flickDown(e) {
    if (e.button !== 0 || !e.isPrimary || this.flick || !this.canFlick()) return;
    e.preventDefault();
    this.flick = { id: e.pointerId, samples: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }] };
    this.r.mat.setPointerCapture?.(e.pointerId);
    this.r.mat.dataset.demo = "false";
    this.raw = 0; this.tilt = 0; this.swipe = 0;
  }

  flickMove(e) {
    if (!this.flick || this.flick.id !== e.pointerId) return;
    if (!this.canFlick()) { this.flickCancel(); return; }
    const { samples } = this.flick, span = this.flickSpan();
    samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    // 弾いている間の目安: 今の速さでの回転を見せる（投げるのは離した時の速さ）
    // （まだ上へ動いていない間は、ちょうどいい回転の見込みのまま。触れただけで刃先の予測が跳ねないように）
    this.raw = flickPower(samples, span)?.raw || 0;
    this.power = this.raw > 0 ? axePower(this.raw, HOUSE_AXE.id) : POWER.ideal;
    this.tilt = flickTilt(samples, span);
    this.swipe = clamp((samples[0].y - samples.at(-1).y) / Math.max(1, span * 0.3), 0, 1);
  }

  flickUp(e) {
    if (!this.flick || this.flick.id !== e.pointerId) return;
    e.preventDefault();
    this.flickMove(e);
    if (!this.flick) return;
    const read = flickRead(this.flick.samples, this.flickSpan());
    if (!read.throw) { this.flickCancel(read.miss); return; }
    this.flick = null;
    this.throwNow(read.throw.raw, read.throw.tilt, "pointer");
  }

  /** 投げずに終える。理由（浅い・斜めすぎ・下へ）がある時は札で返す。触れただけ・戻しただけは黙って取り消す。 */
  flickCancel(reason = null) {
    const had = this.flick || this.keyHold !== null;
    if (this.flick) this.r?.mat.releasePointerCapture?.(this.flick.id);
    Object.assign(this, { flick: null, keyHold: null, raw: 0, tilt: 0, swipe: 0 });
    if (!had || this.phase !== "power") return;
    this.power = POWER.ideal;
    const words = FLICK_MISS[reason];
    if (words) this.showCue({ label: words[0], place: words[1], kind: "flick", duration: CUE.flick });
  }

  throwNow(raw, tilt, source) {
    if (this.phase !== "power") return;
    this.lastInput = source;
    this.lastAction = performance.now();
    this.raw = raw; this.power = axePower(raw, HOUSE_AXE.id);
    // 緑の帯の外で弾くと、力んで横へ流れやすい（本編の onRelease と同じ式）
    const inBand = this.power >= POWER.sweetMin && this.power <= POWER.sweetMax;
    const drift = flickDriftScale(tilt) * AXE_FEEL.flick.drift * (inBand ? 1 : AXE_FEEL.flick.leanOutside);
    const release = releaseAimAt(this.aim, this.held, this.power, this.shots.length, this.held < this.focusUntil, HOUSE_AXE.steady);
    this.pending = { ...resolveThrow({ x: release.x, y: release.y, power: this.power, called: this.called, drift }, this.shots, OPTIONS), baseAim: { ...this.aim }, sway: release.sway };
    this.hand = this.gripWorld();
    this.swipe = 0; this.tilt = 0;
    this.setPhase("flight");
  }

  keyDown(e) {
    if (this.dead || this.phone.fixed || e.repeat && e.code !== "Space") return;
    if (e.code === "KeyF") { this.focusAim(); return; }
    if (e.code === "Escape") { if (this.flick || this.keyHold !== null) this.flickCancel(); else this.reaim(); return; }
    if (e.code !== "Space" && e.code !== "Enter") return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    if (this.phase === "power") { if (e.code === "Space" && this.canFlick() && !this.flick && this.keyHold === null) { this.keyHold = 0; this.r.mat.dataset.demo = "false"; } return; }
    this.act();
  }

  keyUp(e) {
    if (e.code !== "Space" || this.keyHold === null) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const raw = clamp(this.keyHold / KEY_HOLD_MS, 0, 1);
    if (raw < 0.06) { this.flickCancel("hold"); return; }
    this.keyHold = null;
    this.throwNow(raw, 0, "keyboard");
  }

  /* ── 飛ぶ斧: 形と回り方・着地点は本編（axe-flight.js）。放す位置だけ、縦持ちの手元（下の握り）にする ── */

  /** 握りの位置を、的の座標の世界（放す時の奥行き）へ直す。 */
  gripWorld() {
    const { board, grip } = this.r, ctm = board.getScreenCTM?.();
    const fallback = { x: 0, y: (VIEW.y + VIEW.h + 150 - CY) / NEAR, z: AXE_FEEL.path.startZ };
    if (!ctm) return fallback;
    const box = grip.getBoundingClientRect();
    try {
      const p = new DOMPoint(box.left + box.width / 2, box.top + box.height / 2).matrixTransform(ctm.inverse());
      return Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: (p.x - CX) / NEAR, y: (p.y - CY) / NEAR, z: AXE_FEEL.path.startZ } : fallback;
    } catch { return fallback; }
  }

  flightPose(shot, ms) {
    const t = clamp(ms / FLIGHT.travel, 0, 1), end = impactPose(shot), P = AXE_FEEL.path, start = this.hand || this.gripWorld();
    const decorate = (pose) => {
      const c = projectPoint(pose), b = projectAxePoint(pose, AXE.blade);
      return { ...pose, pixelX: c.x, pixelY: c.y, bladeX: b.x, bladeY: b.y };
    };
    // 横の流れは、放した直後は小さく、板に近づくほど効く（本編の flightPose と同じ式）
    const driftWorld = (shot.landing.x - shot.aim.x) * R * ((CAMERA.focal + CAMERA.boardDepth) / CAMERA.focal);
    const pose = t === 1 ? { ...end } : { x: start.x + (end.x - start.x) * t + driftWorld * (t * t - t), y: start.y + (end.y - start.y) * t - P.arc * t * (1 - t),
      z: start.z + (end.z - start.z) * t, pitch: -shot.rotation * t, opacity: 1 };
    const fall = !shot.stuck ? clamp((ms - FLIGHT.travel) / FLIGHT.fall, 0, 1) : 0;
    if (fall) { pose.y += P.fallDrop * fall * fall; pose.pitch -= P.fallPitch * fall; pose.opacity = 1 - fall; }
    return { ...decorate(pose), contact: t === 1, done: t === 1 && (shot.stuck || fall === 1) };
  }

  /** 刺さった斧を板に残す。刃先を軸に、柄が少しの間ふるえる。 */
  embed(shot, quiver = true) {
    const { impacts } = this.r || {};
    if (!impacts || !shot.stuck) return;
    const node = createAxe(HOUSE_AXE);
    renderAxe(node, impactPose(shot));
    node.dataset.scored = String(shot.score > 0);
    impacts.replaceChildren(node);
    this.quiver = null;
    if (quiver && !this.reduce) {
      const inner = document.createElementNS("http://www.w3.org/2000/svg", "g");
      inner.append(...node.childNodes); node.append(inner);
      const edge = inner.querySelector(".axe-cut-contact");
      this.quiver = { node: inner, x: Number(edge.getAttribute("cx")), y: Number(edge.getAttribute("cy")) };
    }
  }

  /* ── 時計（毎フレーム）。タブが隠れている間は進めない ── */

  tick(now) {
    if (this.dead || !this.r) return;
    const delta = this.stamp === null ? 0 : clamp(now - this.stamp, 0, 50);
    this.stamp = now;
    if (this.phone.fixed || document.hidden) return;
    this.elapsed += delta;
    if (CYCLES[this.phase] || this.phase === "power") this.held += delta;
    if (this.keyHold !== null) { this.keyHold += delta; this.raw = clamp(this.keyHold / KEY_HOLD_MS, 0, 1); this.power = axePower(this.raw, HOUSE_AXE.id); this.swipe = this.raw; }
    if (this.phase === "flight") this.tickFlight();
    if (this.phase === "result") {
      if (this.elapsed <= AXE_FEEL.impact.duration + 100) this.drawImpact(this.shown);
      if (this.quiver) {
        const q = quiverAt(this.elapsed), { x, y, node } = this.quiver;
        node.setAttribute("transform", q ? `translate(${x} ${y}) rotate(${q.rotate}) scale(1 ${q.scale}) translate(${-x} ${-y})` : "");
        if (!q) this.quiver = null;
      }
    }
    if (this.phase === "summary" && this.elapsed <= T.countUp + 80) this.renderSummary();
    if (CYCLES[this.phase] || this.phase === "power") {
      this.renderAim();
      if (now - this.lastHud >= 100) { this.lastHud = now; this.renderHud(); }
    }
  }

  tickFlight() {
    const { r } = this, shot = this.pending, slow = Boolean(shot.called) && !this.reduce;
    // 接触の止め（本編と同じ）: 板に届いた瞬間、飛ぶ斧を接触の姿のまま止めて見せる。止めの間は板を左右に震わせる
    const arrive = flightDuration({ stuck: true }, slow), hold = this.reduce ? 0 : contactHold(shot);
    const touching = !this.reduce && this.elapsed >= arrive && this.elapsed < arrive + hold;
    const display = this.reduce ? FLIGHT.travel + FLIGHT.fall : touching ? FLIGHT.travel : flightTime(this.elapsed >= arrive ? this.elapsed - hold : this.elapsed, slow);
    const pose = this.flightPose(shot, display);
    if (touching) { this.holdFrame++; r.stage.style.transform = `translate(${(this.holdFrame % 2 ? 1 : -1) * AXE_FEEL.hitstop.shake}px, 0)`; }
    else if (this.holdFrame) { this.holdFrame = 0; r.stage.style.transform = ""; }
    const TR = AXE_FEEL.trail;
    if (!this.reduce && display < FLIGHT.travel) {
      const points = TR.offsets.map((offset) => this.flightPose(shot, Math.max(0, display - offset)));
      r.trail.setAttribute("d", points.map((p, i) => `${i ? "L" : "M"}${p.bladeX.toFixed(1)} ${p.bladeY.toFixed(1)}`).join(" "));
      r.trail.setAttribute("opacity", TR.opacity * Math.min(1, display / 120));
      r.ghosts.forEach((node, i) => { renderAxe(node, this.flightPose(shot, Math.max(0, display - (i + 1) * TR.ghostStep))); node.setAttribute("opacity", TR.ghostOpacity[i] * Math.min(1, display / 80)); });
      const near = display / FLIGHT.travel, size = 6 + 16 * near;
      r.shadow.setAttribute("cx", CX + shot.landing.x * R); r.shadow.setAttribute("cy", CY + shot.landing.y * R + 4);
      r.shadow.setAttribute("rx", size); r.shadow.setAttribute("ry", size * 0.42); r.shadow.setAttribute("opacity", TR.shadow * near * near);
    } else {
      r.trail.setAttribute("opacity", 0); r.shadow.setAttribute("opacity", 0);
      r.ghosts.forEach((node) => node.setAttribute("opacity", 0));
    }
    renderAxe(r.flying, pose); r.flying.setAttribute("opacity", pose.opacity);
    if (!pose.done || touching) return;
    // 着いた: この投を記録して、結果へ
    this.shots.push(shot);
    this.pending = null; this.shown = shot;
    if (this.holdFrame) { this.holdFrame = 0; r.stage.style.transform = ""; }
    r.flying.setAttribute("opacity", 0);
    const mix = Math.imul((this.seed ^ Math.imul(this.shots.length + 1, 0x9e3779b1)) >>> 0, 0x85ebca6b) >>> 0;
    this.shakePhase = [(mix % 6283) / 1000, ((mix >>> 13) % 6283) / 1000]; // 揺れの位相を投ごとに変える
    this.embed(shot);
    if (!shot.stuck && shot.dropReason !== "off-board") this.flashNow("drop");
    this.setPhase("result");
  }

  flashNow(kind) {
    const { flashbox } = this.r;
    flashbox.dataset.on = ""; void flashbox.offsetWidth; flashbox.dataset.on = kind;
  }

  /** 着弾の手応え（本編の drawImpact と同じ式・同じ数値）: 木片・閃光・揺れは刺さったら必ず、色の輪と +N は得点した時だけ。 */
  drawImpact(shot) {
    const { r } = this, effect = impactFeedback(shot), F = AXE_FEEL.impact, elapsed = this.elapsed;
    const show = this.phase === "result" && effect.physical && !this.reduce && elapsed < effect.duration;
    r.fx.setAttribute("opacity", show ? Math.min(1, (1 - elapsed / effect.duration) * 2) : 0);
    r.stage.style.transform = "";
    if (!show) return;
    const party = effect.celebration, progress = Math.min(1, elapsed / effect.duration), x = CX + shot.landing.x * R, y = CY + shot.landing.y * R;
    const S = AXE_FEEL.shake, pattern = S[effect.tier === "large" ? "large" : effect.tier === "medium" ? "medium" : "small"];
    const k = (effect.special ? F.specialScale : 1) * (effect.tier === "wood" ? F.strength.wood / F.strength.small : 1);
    const decay = Math.max(0, 1 - elapsed / F.recoilMs) ** 2;
    const punch = Math.max(0, 1 - elapsed / F.punchMs) * (effect.special ? F.specialPunch : F.punch) * (party ? 1 : 0.5);
    const dx = Math.sin(elapsed * S.speedX + this.shakePhase[0]) * pattern.x * decay * k, dy = Math.cos(elapsed * S.speedY + this.shakePhase[1]) * pattern.y * decay * k;
    r.stage.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${(1 + punch + pattern.scale * decay).toFixed(4)})`;
    r.fx.setAttribute("transform", `translate(${x} ${y})`);
    const dark = party && elapsed < F.darkFlashMs && Math.floor(elapsed / 17) % 2 === 0;
    r.flash.setAttribute("r", 8 + Math.min(1, elapsed / F.flashGrow) * (effect.special ? F.specialFlashRadius : F.flashRadius) * (party ? 1 : 0.6));
    r.flash.setAttribute("fill", !party ? "#3a2a1c" : dark ? "#2a1a10" : "#fff5da");
    r.flash.setAttribute("opacity", !party ? Math.max(0, 1 - elapsed / F.flashFade) * 0.5 : dark ? 0.35 : Math.max(0, 1 - elapsed / (effect.special ? F.specialFlashFade : F.flashFade)) * (effect.special ? 0.9 : 0.7));
    const ringR = 8 + Math.sqrt(progress) * F.ringRadius[effect.special ? "special" : shot.score >= 6 ? "medium" : "small"];
    for (const [ring, strength] of [[r.ringDark, 0.5], [r.ring, 0.8]]) { ring.setAttribute("r", ringR); ring.setAttribute("opacity", party ? (1 - progress) * strength : 0); }
    r.ring.setAttribute("stroke", effect.color);
    r.echo.setAttribute("r", 5 + Math.sqrt(progress) * F.echoRadius[shot.score >= 6 ? "medium" : "small"]);
    r.echo.setAttribute("stroke", effect.color); r.echo.setAttribute("opacity", party ? (1 - progress) * 0.5 : 0);
    r.dust.forEach((mote, i) => {
      const angle = i * 2.4, distance = 8 + progress * (F.dustSpread + i * F.dustStep);
      mote.setAttribute("cx", Math.cos(angle) * distance); mote.setAttribute("cy", Math.sin(angle) * distance + progress * 12);
      mote.setAttribute("r", 2 + progress * 7); mote.setAttribute("opacity", (1 - progress) * 0.25);
    });
    r.chips.forEach((shard, i) => {
      const visible = party || i < F.woodChips;
      shard.setAttribute("opacity", visible ? 1 : 0);
      if (!visible) return;
      const angle = i * 137.5, radian = angle * Math.PI / 180, distance = 6 + progress * (i % 3 ? F.chipNear : F.chipFar) * (party ? 1 : 0.7);
      shard.setAttribute("transform", `translate(${Math.cos(radian) * distance} ${Math.sin(radian) * distance + progress * progress * F.chipFall}) rotate(${angle + progress * 200}) scale(${(1 - progress * 0.8) * (i % 2 ? 0.65 : 1)})`);
    });
    r.burst.textContent = effect.burst;
    r.burst.setAttribute("font-size", party ? 38 : 30);
    r.burst.setAttribute("y", F.burstTop - progress * F.burstRise); r.burst.setAttribute("fill", effect.color);
  }

  /* ── 描き直し ── */

  /** 今の狙いと手ぶれから、放す位置と着地点を出す（本編と同じ: releaseAimAt → 回転の上下ずれ・横の流れ）。 */
  aimNow() {
    const { phase } = this;
    if (phase === "horizontal") this.aim.x = axisAt(gaugeAt(this.elapsed, CYCLES.horizontal));
    if (phase === "vertical") this.aim.y = axisAt(gaugeAt(this.elapsed, CYCLES.vertical));
    const release = releaseAimAt(this.aim, this.held, this.power, this.shots.length, this.held < this.focusUntil, HOUSE_AXE.steady);
    const pulling = phase === "power" && (this.flick || this.keyHold !== null || this.posed);
    const inBand = this.power >= POWER.sweetMin && this.power <= POWER.sweetMax;
    const drift = pulling ? flickDriftScale(this.tilt) * AXE_FEEL.flick.drift * (inBand ? 1 : AXE_FEEL.flick.leanOutside) : 0;
    const landing = { x: release.x + drift, y: release.y + (phase === "power" ? liftFor(this.power) : 0) };
    return { release, landing, drift, pulling };
  }

  /** 今止めたい所（宣言した青、なければ赤い中心）と、刃がそこへ触れる幅（本編の aimTarget）。 */
  aimTarget() {
    const k = KILLS.find((t) => t.id === this.called);
    if (k) return { x: k.x, y: k.y, tolX: k.outer, tolY: k.outer + BLADE.halfLength };
    const closed = closuresOf(this.shots, this.shots.length, RULES.throws, OPTIONS.division);
    const c = CLUSTERS.find((t) => !closed.cluster.has(t.id) && !closed.bull.has(t.id));
    return c && { x: c.x, y: c.y, tolX: RINGS[0].radius, tolY: RINGS[0].radius + BLADE.halfLength };
  }

  /** 毎フレーム動く所だけ: 針・狙い目の印・白い刃先・回転ゲージ・握り。 */
  renderAim() {
    const { r, phase } = this, moving = Boolean(CYCLES[phase]) || phase === "power";
    for (const node of [r.cross, r.fixed, r.needleX, r.needleY, r.guideX, r.guideY, r.shift, r.release, r.halo]) node.setAttribute("opacity", 0);
    if (!moving) return;
    const { release, landing, drift, pulling } = this.aimNow();
    r.cross.setAttribute("transform", `translate(${CX + landing.x * R} ${CY + landing.y * R})`); r.cross.setAttribute("opacity", 1);
    r.fixed.setAttribute("transform", `translate(${CX + this.aim.x * R} ${CY + this.aim.y * R})`); r.fixed.setAttribute("opacity", 0.8);
    r.needleX.setAttribute("transform", `translate(${CX + this.aim.x * R} 0)`); r.needleY.setAttribute("transform", `translate(0 ${CY + this.aim.y * R})`);
    r.needleX.setAttribute("opacity", phase === "horizontal" ? 0.95 : 0.3); r.needleY.setAttribute("opacity", phase === "vertical" ? 0.95 : phase === "power" ? 0.3 : 0);
    const goal = phase === "horizontal" || phase === "vertical" ? this.aimTarget() : null;
    if (goal) { r.guideX.setAttribute("transform", `translate(${CX + goal.x * R} 0)`); r.guideY.setAttribute("transform", `translate(0 ${CY + goal.y * R})`); }
    r.guideX.setAttribute("opacity", goal && phase === "horizontal" ? 1 : 0); r.guideY.setAttribute("opacity", goal && phase === "vertical" ? 1 : 0);
    // 針が印に重なると、針が緑に太くなる（刃が赤／青に触れる幅）
    const onGoal = !!goal && (phase === "horizontal" ? Math.abs(this.aim.x - goal.x) <= goal.tolX : Math.abs(this.aim.y - goal.y) <= goal.tolY);
    for (const [needle, base, live] of [[r.needleX, "#91cfe6", phase === "horizontal"], [r.needleY, "#e5bd70", phase === "vertical"]]) {
      needle.setAttribute("stroke", onGoal && live ? "#8ff0a4" : base); needle.setAttribute("stroke-width", onGoal && live ? 5 : 2.5);
    }
    r.pad.dataset.onTarget = String(onGoal);
    if (phase === "power") {
      const rx = CX + release.x * R, ry = CY + release.y * R, lx = CX + landing.x * R, ly = CY + landing.y * R;
      r.shift.setAttribute("d", Math.abs(lx - rx) < 1 ? `M${rx} ${ry}V${ly}` : `M${rx} ${ry}Q${rx} ${(ry + ly) / 2} ${lx} ${ly}`);
      r.shift.setAttribute("opacity", pulling ? 0.9 : 0);
      r.release.setAttribute("cx", rx); r.release.setAttribute("cy", ry); r.release.setAttribute("opacity", pulling ? 0.9 : 0);
    }
    // 回転ゲージ（下が0%・上が100%。茶＝刺さる範囲、緑＝ちょうどいい帯）と、握り・矢印
    const shown = pulling ? this.power : 0;
    r.fill.style.transform = `scaleY(${shown})`; r.pin.style.bottom = `${(shown * 100).toFixed(1)}%`;
    const quality = !pulling ? "" : this.power >= POWER.sweetMin && this.power <= POWER.sweetMax ? "sweet" : this.power < POWER.stickMin || this.power > POWER.stickMax ? "drop" : "edge";
    if (r.gauge.dataset.quality !== quality) r.gauge.dataset.quality = quality;
    r.mat.dataset.pulling = String(Boolean(pulling));
    r.mat.style.setProperty("--swipe", this.swipe.toFixed(3));
    r.arrow.setAttribute("d", arrowD(pulling ? this.tilt : 0, this.swipe));
    // 今の刃先が取る点（投げる前に分かる）。刃が触れる円が光る
    let preview = null;
    try { preview = resolveThrow({ x: release.x, y: release.y, power: this.power, called: this.called, drift }, this.shots, OPTIONS); } catch { preview = null; }
    this.preview = preview;
    const halo = preview && haloFor(preview);
    if (halo) { r.halo.setAttribute("cx", CX + halo.x * R); r.halo.setAttribute("cy", CY + halo.y * R); r.halo.setAttribute("r", halo.r * R); r.halo.dataset.kind = halo.kind; r.halo.setAttribute("opacity", 1); }
  }

  /** ゆっくり変わる所（0.1秒ごと）: 今の刃先の点・集中の残り。 */
  renderHud() {
    const { r, phase } = this, moving = Boolean(CYCLES[phase]) || phase === "power", p = this.preview;
    r.live.hidden = !moving || !p;
    if (moving && p) {
      r.live.querySelector("b").textContent = `${p.score}点`;
      // 落下する回転の時は理由を添える（本編の liveReason）
      r.live.querySelector("em").textContent = p.outcome === "drop" ? (p.dropReason === "weak" ? "柄から当たる・落下" : "回りすぎ・落下") : "";
      r.live.dataset.drop = String(p.outcome === "drop");
    }
    const remaining = Math.max(0, this.focusUntil - this.held);
    const label = remaining > 0 ? "集中中" : this.focusUsed ? "使用済み" : "集中";
    const span = r.focus.querySelector("span");
    if (span.textContent !== label) span.textContent = label;
    r.focus.disabled = this.focusUsed;
    r.focus.dataset.on = String(remaining > 0);
    r.focus.setAttribute("aria-label", remaining > 0 ? "集中中" : this.focusUsed ? "集中は使用済み" : "息を整える · 1回");
  }

  /** 場面が変わった時の描き直し。 */
  render() {
    const { r, phase } = this;
    if (!r) return;
    const total = totalOf(this.shots), last = this.shown, moving = Boolean(CYCLES[phase]) || phase === "power";
    this.el.dataset.axPhase = phase;
    r.pad.dataset.phase = phase;
    // 上: 各投の点（K＝キルショット、●＝赤、↓＝落下、×＝宣言外。本編の tileMark）と累計・次のランクまで
    r.tiles.forEach((tile, i) => {
      const s = this.shots[i];
      tile.dataset.state = s ? "done" : i === this.shots.length && phase !== "summary" ? "now" : "";
      tile.querySelector("strong").textContent = s ? String(s.score) : "—";
      tile.querySelector("em").textContent = !s ? "" : s.outcome === "killshot" ? "K" : s.outcome === "bull" ? "●" : !s.stuck ? "↓" : s.called ? "×" : "";
      tile.setAttribute("aria-label", `${i + 1}投目 ${s ? `${s.score}点` : "未投擲"}`);
    });
    r.total.textContent = String(total);
    const goal = phase !== "summary" ? rankTargets(total, RULES.max)[0] : null;
    r.next.textContent = goal ? `${goal.rank}まで${goal.need}` : "";
    // 刺さった跡（前の投）: 跡の絵と点数
    r.cuts.innerHTML = this.cuts.map((s) => `<g transform="translate(${CX + s.landing.x * R} ${CY + s.landing.y * R})"><image href="${this.art.cut}" x="${-BLADE_PX * 0.55}" y="${-BLADE_PX * 1.1}" width="${BLADE_PX * 1.1}" height="${BLADE_PX * 2.2}" opacity=".9"/>
      <path d="M0 ${-BLADE_PX * 0.9}V${BLADE_PX * 0.9}" stroke="#2a1a10" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
      <text x="7" y="7" fill="#f6e5c8" font-size="22" font-weight="900" paint-order="stroke" stroke="#1b120c" stroke-width="2.500">${s.score}</text></g>`).join("");
    // 宣言した青を輪で囲む
    const k = KILLS.find((t) => t.id === this.called);
    r.calledRing.setAttribute("opacity", k ? 1 : 0);
    if (k) { r.calledRing.setAttribute("cx", CX + k.x * R); r.calledRing.setAttribute("cy", CY + k.y * R); }
    this.el.dataset.axChoosing = String(phase === "choice" && this.callStatus().remaining > 0);
    // ひよりの一言（本編 axe-companions.js の reaction。場面と投げ数で決まり、コマごとに揺れない）
    const bonus = this.shots.length > 0 && killState(this.shots, RULES.throws).bonus > killState(this.shots.slice(0, -1), RULES.throws).bonus;
    const line = reaction(MATE, phase, this.shots, this.called, { heat: heatOf(this.shots), last: this.shots.length === RULES.throws - 1, grade: phase === "summary" ? gradeOf(total, RULES.max) : null, bonus });
    const lineBox = phase === "summary" ? r.sumLine : r.line;
    if (this.lineText !== line.text || this.lineBox !== lineBox) { this.lineText = line.text; this.lineBox = lineBox; this.lineFit = false; }
    this.showFace(phase === "summary" ? r.sumFace : r.face, line.face);
    // 下の場所: 場面ごとに中身を替える
    const status = this.callStatus();
    r.goals.innerHTML = this.goalsHtml(false);
    r.tools.hidden = !moving;
    r.call.hidden = phase !== "choice" || !(status.remaining > 0 || this.called);
    r.call.setAttribute("aria-pressed", String(Boolean(this.called)));
    r.call.querySelector("small").textContent = this.called ? `${killPlaces[this.called]}の青 · 青以外0点` : `残り${status.remaining}回`;
    r.mat.hidden = phase !== "power" && phase !== "flight";
    r.gauge.hidden = r.mat.hidden;
    r.result.hidden = phase !== "result";
    r.primary.hidden = !["choice", "horizontal", "vertical", "result"].includes(phase);
    r.primary.querySelector("b").textContent = { choice: "構える", horizontal: "横を止める", vertical: "縦を止める", result: this.shots.length === RULES.throws ? "結果を見る" : "次の一投へ" }[phase] || "";
    r.primary.dataset.wide = String(phase === "horizontal" || phase === "vertical");
    r.primary.dataset.fill = String(phase === "choice"); // 構える→横→縦を、同じ場所の親指で続けて押せるように
    if (phase === "result" && last) {
      const fb = shotFeedback(last, { inputMode: "tap-pull", source: this.lastInput, closed: closuresOf(this.shots, this.shots.length, RULES.throws, OPTIONS.division) });
      r.result.dataset.tone = fb.tone;
      r.result.querySelector(".ax-result-label").textContent = fb.label;
      r.result.querySelector(".ax-result-num").textContent = `+${last.score}`;
      r.result.querySelector(".ax-result-unit").textContent = "PTS";
      r.result.querySelector(".ax-zone").textContent = last.stuck ? zoneLabel(last) : last.dropReason === "off-board" ? "板の外" : last.dropReason === "weak" ? "柄から当たって落下" : "回りすぎて落下";
      // 自分の回転の振り返り: 横棒（茶＝刺さる範囲・緑の帯・この投の印）と一言
      const review = powerVerdict(last.power, { inputMode: "tap-pull", source: this.lastInput });
      r.review.hidden = false; r.review.dataset.zone = review.zone;
      r.review.querySelector(".ax-mark").style.left = `${clamp(last.power * 100, 0, 100)}%`;
      r.review.querySelector("b").textContent = review.short;
      r.review.setAttribute("aria-label", review.text);
      this.fitTip(r.result.querySelector(".ax-tip"), fb.tip);
    }
    r.summary.hidden = phase !== "summary";
    this.el.dataset.axSummary = String(phase === "summary");
    if (phase === "summary") this.renderSummary(true);
    // 一言は、箱が見えてから測って折る（集計の札は、出した後でないと幅が無い）
    if (!this.lineFit && this.lineBox?.clientWidth) { this.lineFit = true; this.fitText(this.lineBox, this.lineText); }
    this.renderAim();
    this.renderHud();
    if (phase === "result" && this.phone.fixed) r.fx.setAttribute("opacity", 0);
  }

  goalsHtml(finished) {
    return evaluateChallenges(this.goalIds, this.shots, finished).map((c) => `<li data-state="${c.state}" aria-label="${c.label}"><i aria-hidden="true">${c.state === "done" ? "✓" : c.state === "failed" ? "×" : "◇"}</i>${c.short}</li>`).join("");
  }

  /** 集計: 合計は0.5秒で数え上げ、ランクの焼き印は数え終わってから押す（本編と同じ）。 */
  renderSummary(full = false) {
    const { r } = this, sum = totalOf(this.shots), q = (sel) => r.summary.querySelector(sel);
    const counted = this.reduce || this.phone.fixed ? sum : Math.round(sum * Math.min(1, this.elapsed / T.countUp));
    q(".ax-sum-score strong").textContent = String(counted);
    q(".ax-rank").dataset.stamped = String(counted === sum);
    if (!full) return;
    const stats = sessionStats(this.shots), done = evaluateChallenges(this.goalIds, this.shots, true).filter((c) => c.state === "done").length;
    q(".ax-sum-label").textContent = GRADE_LABEL[gradeOf(sum, RULES.max)];
    q(".ax-rank b").textContent = rankOf(sum, RULES.max);
    q(".ax-rank").dataset.rank = rankOf(sum, RULES.max);
    q(".ax-sum-score em").textContent = `「${titleOf(this.shots, RULES.max)}」`;
    q(".ax-sum-throws").innerHTML = this.shots.map((s, i) => `<li><i>${i + 1}</i><strong>${s.score}</strong></li>`).join("");
    q(".ax-sum-stats").innerHTML = [`平均 ${stats.average.toFixed(2)}点/投`, `ブル ${stats.bulls}`, `キル ${stats.killshots}/${stats.calls}`, `落下 ${stats.drops}`, `チャレンジ ${done}/${this.goalIds.length}`].map((s) => `<span>${s}</span>`).join("");
    q(".ax-sum-goals").innerHTML = this.goalsHtml(true);
  }

  /** ひよりの顔（立ち絵から、表情ごとの顔の位置で切り出す）。 */
  showFace(node, face) {
    if (node.dataset.face === face) return;
    node.dataset.face = face;
    const { x, y } = portraitFocus(MATE, face), zoom = 3.3, zy = zoom * 1200 / 896;
    Object.assign(node.style, { backgroundImage: `url("${this.art.face(face)}")`, backgroundSize: `${zoom * 100}% auto`,
      backgroundPosition: `${((x * zoom - 0.5) / (zoom - 1) * 100).toFixed(1)}% ${((y * zy - 0.5) / (zy - 1) * 100).toFixed(1)}%` });
  }

  /** 一言は本編の組版で折る（2行まで）。収まらない時は字を一段小さくする。 */
  fitText(node, text) {
    const { paginateForBox, plain } = this.kit;
    node.classList.remove("small");
    node.textContent = text;
    if (!node.clientWidth) return;
    let pages = paginateForBox(text, node);
    if (pages.length > 1) { node.classList.add("small"); pages = paginateForBox(text, node); }
    node.innerHTML = plain(pages[0]);
    if (pages.length > 1 && document.fonts?.status !== "loading") console.warn("2行に収まらない:", text);
  }

  /** 次への助言は2行まで（本編の助言は3文になる時がある。縦では先の2行＝原因と直し方までを出す）。 */
  fitTip(node, text) {
    const { paginateForBox, plain } = this.kit;
    node.textContent = text;
    if (!text || !node.clientWidth) return;
    node.innerHTML = plain(paginateForBox(text, node)[0]);
  }

  relayout() {
    if (!this.r) return;
    this.lineFit = false;
    this.render();
  }

  /* ── 押した時 ── */

  onClick(event) {
    const hit = event.target.closest("[data-act]");
    if (!hit || !this.el.contains(hit)) return false;
    const act = hit.dataset.act;
    if (!act.startsWith("ax-")) return false;
    if (act === "ax-act") this.act();
    else if (act === "ax-finish") this.finish();
    else if (act === "ax-retry") { if (!this.phone.fixed && this.phase === "summary" && !this.guarded()) { this.newGame(); this.r.impacts.replaceChildren(); this.setPhase("choice"); } }
    else if (act === "ax-reaim") this.reaim();
    else if (act === "ax-focus") this.focusAim();
    else if (act === "ax-call") this.cycleCall();
    else if (act === "ax-quit") this.finish();
    else if (act === "ax-legend") { this.legend = !this.legend; this.r.legend.hidden = !this.legend; hit.setAttribute("aria-expanded", String(this.legend)); }
    else if (act === "ax-board") this.tapBoard(event);
    return true;
  }

  /** 的をタップ: 構える前は青＝宣言・それ以外＝構える。針の間は止める。結果の間（0.6秒後）は次の一投へ。 */
  tapBoard(event) {
    if (this.legend) { this.legend = false; this.r.legend.hidden = true; this.el.querySelector('[data-act="ax-legend"]').setAttribute("aria-expanded", "false"); return; }
    if (this.phase === "choice") {
      const kill = event.target.closest?.("[data-kill-hit]")?.dataset.killHit;
      if (kill && canCall(kill, this.shots, RULES.throws)) { this.selectCall(this.called === kill ? null : kill); return; }
      this.act();
    } else if (this.phase === "horizontal" || this.phase === "vertical") this.act();
    else if (this.phase === "result" && this.elapsed >= T.resultMin) this.act();
  }

  // 十字キーと丸ボタンは置かない（PC のキーは mount の keydown で受ける）
  move() {}
  pressA() {}
}

/** 握りから伸びる矢印（本編 axe.js の flickArrowD と同じ形）: 弾く向きへ曲がり、引くほど伸びる。 */
function arrowD(bend, stretch = 0) {
  const b = clamp(bend, -1, 1) * 38, s = clamp(stretch, 0, 1);
  const baseY = 218, tip = { x: 72 + b, y: 52 - 24 * s };
  const ctrl = { x: 72 + b * (1 / 3 + s / 6), y: baseY + (tip.y - baseY) * 0.45 };
  const tx = tip.x - ctrl.x, ty = tip.y - ctrl.y, len = Math.hypot(tx, ty), ux = tx / len, uy = ty / len;
  const wing = (side) => `${(tip.x - ux * 24 - uy * 19 * side).toFixed(1)} ${(tip.y - uy * 24 + ux * 19 * side).toFixed(1)}`;
  return `M72 ${baseY}Q${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${tip.x.toFixed(1)} ${tip.y.toFixed(1)}M${wing(-1)}L${tip.x.toFixed(1)} ${tip.y.toFixed(1)}L${wing(1)}`;
}
