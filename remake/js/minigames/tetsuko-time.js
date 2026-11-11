// 「てつこといっしょ / TETSUKO TIME」（#2454）の画面と本編との確定点。猫の状態・反応・自律行動は tetsuko-model.js。
//
// 動線（オーナー判断 2026-11-04・実装計画 §1）: mukai で行動を使う → 帰りに裏口をのぞく（ch3-tokyo-daily.js の
// offerTetsuko）→「てつこといっしょ」→ 来訪4回未満なら既存の段階会話を先に読む（関係進展の正本）→ この画面 →
// 「帰る」→ settleTetsukoTime で確定 → 呼び出し側が回復12と toast。地図のピンは作らない。第5章の入口は今回触らない。
//
// 画面（計画 §5・UI v2 は docs/spec/tetsuko_time.md §6）: #stage（1280×720）の #screen 層に重ねる。HUD はそのまま。
// 背景は裏口の絵（届くまでは bg_street に CSS の壁・戸・ベンチ）。猫は既存の5表情を同じ枠で切り出して大きく見せ、
// しぐさの絵が届いた物から差し替える（tetsuko-art.js の ART_READY）。小物・UI も同じ。文字は絵に焼き込まない。
// 手元の道具: なでる手／猫じゃらし／ブラシ。じゃらしは指やマウスで直接動かし、てつこが飛びつく。ブラシは猫をなぞる。
// どれも下のボタン1回でも同じ結果（筆圧・精度・時間制限は求めない）。「帰る」は膝に乗られている時も含めて、いつでも押せる。
// 手応えの作り直し（§10・2026-11-11）: ごきげんのハート・おねだりの吹き出し・なでる場所・飛びつきと空振り・擬音と小さな粒・
// 触らずにいると見守ったことになる。常に出す文字は道具の名前だけにし、反応の一行は少しで消す。
//
// 素材は Codex への依頼（asset_sources/tetsuko-care/README.md）。設計・コード担当は別個体の猫や未承認の素材を生成・採用しない。
//
// DOM 依存（ui.js / util.js / audio.js / data.js）は openTetsukoTime の中で遅延 import する。
// 本ファイルの top-level（確定点）は DOM 非依存で、Node のテストからそのまま import できる。
import { TOKYO_OUTINGS } from "../chapters/ch3-outing-progress.js";
import {
  OUTINGS_FLAG, TETSUKO_TIME_FLAG, readTetsukoRecord, tetsukoVisits, createSession, openingReaction, act, canAct, toyOut,
  autonomous, autoDelay, placeProp, takePhoto, farewell, sessionResult, moodOf, moodLabel, propById, momentById, propUnlocked,
  MOMENTS, PROPS, SLOTS, SLOT_NAMES, discoveryGuide, invite, peakReaction, seekMoment, joyHearts, JOY_MAX, JOY_HEARTS, PLAY_AUTO_CATCH,
} from "./tetsuko-model.js";
import { ART_READY, hasPose, poseUrl, artAttrs } from "./tetsuko-art.js";
import { tetsukoTheme } from "./tetsuko-theme.js";
import { HELP_TITLE, helpCard } from "./tetsuko-help.js";

export const TETSUKO_TIME = Object.freeze({
  id: "tetsuko_time",
  title: "てつこといっしょ",
  roman: "TETSUKO TIME",
});

/** 有効なふれあい1回で戻る体力。「少し構っていく」と同じ内部値（正本は TOKYO_OUTINGS.tetsuko.stamina = 12）。 */
export const TETSUKO_STAMINA = TOKYO_OUTINGS.find(outing => outing.id === "tetsuko")?.stamina ?? 12;

/**
 * 本編アダプターの確定点（#2454 §10-4・実装計画 §3）。DOM を持たない同期の純関数。
 * 意味のあるふれあい（result.meaningful）で、まだ確定していない訪問キー（result.visitKey）のときだけ、
 * この一回の処理の中で (a) 来訪記録 _ch3_outings.tetsuko を +1、(b) _tetsuko_time に小物の配置・発見・
 * アルバム・おやつの日・ごきげんの通算回数・訪問キーを書き、{ committed:true, stamina:12 } を返す。呼び出し側が同じ処理の中で
 * addStamina(12) と toast を出す。それ以外は { committed:false } で、保存には一切触らない。
 * 増やさないもの: 経験値・能力・火種・好感度・お金・日付・時間帯（ここでは書けない API しか使わない）。
 * 「少し構っていく」（台本だけ読む短い経路）も同じ確定点を通る（result に小物・発見が無ければ記録を保つ）。
 * @param {object} value 現在のセーブ
 * @param {{ meaningful?: boolean, visitKey?: string, props?: object, found?: string[], album?: object[], treatDay?: number|null, peaks?: number }} [result]
 * @returns {{ committed: boolean, stamina?: number }}
 */
export function settleTetsukoTime(value, result) {
  if (!value?.flags || !result?.meaningful || typeof result.visitKey !== "string" || !result.visitKey) return { committed: false };
  const record = readTetsukoRecord(value);
  if (record.lastKey === result.visitKey) return { committed: false };
  const counts = value.flags[OUTINGS_FLAG] && typeof value.flags[OUTINGS_FLAG] === "object" ? value.flags[OUTINGS_FLAG] : {};
  value.flags[OUTINGS_FLAG] = { ...counts, tetsuko: tetsukoVisits(value) + 1 };
  // 新しい記録は正規化してから書く（壊れた値・未知の id・同じ瞬間の重複を残さない）。
  const next = readTetsukoRecord({ flags: { [TETSUKO_TIME_FLAG]: {
    props: result.props || record.props,
    found: [...record.found, ...(Array.isArray(result.found) ? result.found : [])],
    album: Array.isArray(result.album) ? result.album : record.album,
    treatDay: result.treatDay === undefined ? record.treatDay : result.treatDay,
    // ごきげんがいっぱいになった通算の回数（手帳に出すだけ）。壊れた値は足さない。
    peaks: record.peaks + Math.max(0, Math.floor(Number(result.peaks) || 0)),
  } } });
  value.flags[TETSUKO_TIME_FLAG] = { ...next, sessions: record.sessions + 1, lastKey: result.visitKey };
  return { committed: true, stamina: TETSUKO_STAMINA };
}

/** 親の mukai 訪問から作る、安定した訪問キー（同じ訪問の再確定・二重押しを止める）。 */
export const tetsukoVisitKey = value => `${value?.chapter ?? 0}:${value?.day ?? 0}:${value?.slot ?? 0}:${tetsukoVisits(value)}`;

// ---- 画面 ---------------------------------------------------------------------------------------
const FACES = Object.freeze(["normal", "smile", "serious", "surprise", "sleep"]);
// 手元の道具（右下）。tool のある物は、押すとその道具に持ち替えて1回行う（じゃらし・ブラシは直接も動かせる）。おやつは1回の操作。
// 「止める」「そっと見守る」のボタンは無い: じゃらしは、てつこが自分で飛びつく。触らずにいれば、隣で見守ったことになる。
const DOCK = Object.freeze([
  { kind: "pet", tool: "hand", label: "なでる", icon: "hand" },
  { kind: "play", tool: "toy", label: "じゃらし", icon: "teaser" },
  { kind: "brush", tool: "brush", label: "ブラシ", locked: "まだ早い", icon: "brush" },
  { kind: "treat", label: "おやつ", locked: "今日はもう", icon: "treat" },
]);
// 線のアイコン（Codex のアイコンが届くまで。currentColor の細い線で描く）
const ICONS = Object.freeze({
  hand: '<path d="M8.5 13V6.2a1.4 1.4 0 0 1 2.8 0V12m0-1.6V4.6a1.4 1.4 0 0 1 2.8 0v6.2m0-5a1.4 1.4 0 0 1 2.8 0v6m0-3.6a1.4 1.4 0 0 1 2.8 0v5.6c0 4-2.6 6.8-6.4 6.8-2.7 0-4.4-1.3-5.7-3.4L4.6 14.4a1.5 1.5 0 0 1 2.4-1.8L8.5 14"/>',
  teaser: '<path d="M4 20 15.5 8.5"/><path d="M15.5 8.5c1.6-3.4 3.3-4.6 5-4.5-.2 1.9-1.2 3.6-4.3 5.3"/><path d="M15.2 8.8c3.5-.4 5 .5 5.6 1.8-1.7.8-3.6.6-5.8-1.4"/><circle cx="16.5" cy="7.5" r="1.1"/>',
  brush: '<rect x="3.5" y="4.5" width="11" height="7" rx="2"/><path d="M5.5 11.5v2.2m2.5-2.2v2.6m2.5-2.6v2.2m2.5-2.2v2.6"/><path d="M12.8 7.2 20.5 18.6a1.6 1.6 0 0 1-2.7 1.7L10.6 9"/>',
  treat: '<ellipse cx="12" cy="15.5" rx="8.5" ry="3"/><path d="M3.5 15.5c.6 2.4 3.9 4 8.5 4s7.9-1.6 8.5-4"/><path d="M8.5 12.4c1.6-1.5 3.7-1.9 6.1-.6m-4.4-1.4c1-.9 2.6-1.1 4 .1"/>',
  watch: '<path d="M3.5 13.5h17M5.5 13.5v6m13-6v6"/><path d="M6.5 13.5c.4-1.6 1.7-2.4 5.5-2.4s5.1.8 5.5 2.4"/><circle cx="12" cy="5.6" r="1.9"/><path d="M12 7.5v3.6"/>',
  decor: '<path d="M4 9.5 12 6l8 3.5v8.5L12 21.5 4 18z"/><path d="M4 9.5 12 13l8-3.5M12 13v8.5"/><path d="M4 9.5 2 6.4 9.8 3.2 12 6m8 3.5 2-3.1L14.2 3.2 12 6"/>',
  book: '<path d="M4.5 4.5h10.5a2.5 2.5 0 0 1 2.5 2.5v13H7a2.5 2.5 0 0 1-2.5-2.5z"/><path d="M4.5 17.5A2.5 2.5 0 0 1 7 15h10.5"/><circle cx="11" cy="10.6" r="1.6"/><circle cx="8.6" cy="8.2" r=".8"/><circle cx="10.4" cy="7.3" r=".8"/><circle cx="12.4" cy="7.4" r=".8"/><circle cx="13.9" cy="8.6" r=".8"/>',
  photo: '<rect x="3.5" y="6.5" width="17" height="13" rx="2"/><path d="M8.5 6.5 10 4h4l1.5 2.5"/><circle cx="12" cy="13" r="3.6"/><path d="M17.3 9.3h.01"/>',
  back: '<path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21"/><path d="M4 21h16"/><rect x="9" y="6" width="6" height="5" rx=".5"/><path d="M14.8 15.2h.01"/>',
  heart: '<path d="M12 20.3C7.4 17 3 13.4 3 8.9 3 6 5.1 3.9 7.8 3.9c1.7 0 3.2.9 4.2 2.3 1-1.4 2.5-2.3 4.2-2.3C18.9 3.9 21 6 21 8.9c0 4.5-4.4 8.1-9 11.4z"/>',
  wish: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8L8 20.5v-4H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
  dots: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3.2"/>',
  tap: '<circle cx="12" cy="13" r="3.2"/><path d="M12 3.5v3M5.3 6.3l2.1 2.1M18.7 6.3l-2.1 2.1M3.5 13h3M17.5 13h3"/>',
});
const icon = name => `<svg class="tt-ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
const HEART_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.heart}</svg>`;
// おねだりの吹き出しに出すアイコン（見守る＝「……」。何もせず待つ）
const WISH_ICON = Object.freeze({ pet: "hand", play: "teaser", brush: "brush", treat: "treat", watch: "dots", decor: "decor" });
const WISH_LABEL = Object.freeze({ pet: "なでてほしい", play: "じゃらしで遊びたい", brush: "ブラシをかけてほしい", treat: "おやつがほしい", watch: "そばにいてほしい", decor: "何か置いてほしい" });
// 居場所の x（歩く向きと、じゃらしの先の初めの位置に使う。CSS の --x と同じ値）
const SPOT_X = Object.freeze({ bench: 292, floor: 548, bed: 1012, front: 668, lap: 640, "slot-bench": 400, "slot-floor": 770, "slot-bed": 1012 });
const HAND_AT = Object.freeze({ x: 1310, y: 540 }); // じゃらしの棒の根元（はじめの手元＝右の外。下の操作の帯に重ねない）
// カメラ（TKT17・てつこを主役に）: 舞台（.tt-cam）を寄せて、てつこの体の真ん中を画面の at に映す。舞台の外は映さない。
// もようがえの間は引いて（zoom 1）置き場所を全部見せる。座標はどれも舞台（1280×720）の px。猫の枠の高さは CSS の .tt-cat と同じ。
export const TETSUKO_CAMERA = Object.freeze({ zoom: 1.4, at: Object.freeze({ x: 640, y: 330 }), catHeight: 280 });
// じゃらしで遊ぶ間のカメラ: 飛びつく先とじゃらしを振る場所が見えるよう、少し引いて床の真ん中に固定する（てつこを追わない）。
export const TETSUKO_TOY_VIEW = Object.freeze({ zoom: 1.12, at: Object.freeze({ x: 640, y: 440 }) });
/** てつこの居場所（CSS の --x・--y＝足元・--s）に向けたカメラ { k, x, y }（舞台の点 p は画面の x + k*p に映る）。測れなければ引いた全体。 */
export function tetsukoCameraFor({ x, y, s = 1 } = {}) {
  const { zoom: k, at, catHeight } = TETSUKO_CAMERA;
  const fx = x, fy = y - catHeight / 2 * (s || 1);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return { k: 1, x: 0, y: 0 };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return { k, x: clamp(at.x - k * fx, 1280 * (1 - k), 0), y: clamp(at.y - k * fy, 720 * (1 - k), 0) };
}
/** 飛びついた先の範囲（舞台の px・足元）。じゃらしで遊ぶ間のカメラで、てつこの体が外枠の内側に収まる幅にする。 */
export const TETSUKO_LEAP = Object.freeze({ min: 230, max: 1050, y: 550 });
/** じゃらしで遊ぶ間のカメラ { k, x, y }（舞台の外は映さない）。 */
export function tetsukoToyCamera() {
  const { zoom: k, at } = TETSUKO_TOY_VIEW;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return { k, x: clamp(640 - k * at.x, 1280 * (1 - k), 0), y: clamp(360 - k * at.y, 720 * (1 - k), 0) };
}
/**
 * なでた場所（猫の枠の中の割合 rx・ry から）。広い範囲で分け、隠れた一点の正解探しにしない。
 * 座った絵: 上が頭、その下があご、下の左がしっぽ、ほかは体（背中）。丸くなった絵: 右が頭、左が背中。
 */
export function petZoneAt(rx, ry, { curled = false, flip = false } = {}) {
  const x = flip ? 1 - rx : rx;
  if (!Number.isFinite(x) || !Number.isFinite(ry)) return "head";
  if (curled) return x > 0.52 ? "head" : "back";
  if (ry < 0.46) return "head";
  if (ry < 0.64) return "chin";
  return x < 0.28 ? "tail" : "back";
}
const STEP_MS = 1000, STEP_REDUCED_MS = 700, FAREWELL_MS = 1400, FAREWELL_REDUCED_MS = 800, AFTER_ACTION_MS = 1600;
const STROKE_PX = 80, STROKE_GAP_MS = 420, BRUSH_PX = 100, BRUSH_GAP_MS = 520;
const TOY_SWING_PX = 170, TOY_SWING_GAP_MS = 480, TOY_STILL_MS = 750, TOY_CATCH_PX = 300, TOY_HELD_MS = 1700;
const POUNCE_MS = 380, POUNCE_HIT_PX = 150, POUNCE_LEAD = 0.5, HEADING_FRESH_MS = 140;
const TOAST_MS = 3200, CAPTION_MS = 3800, PHOTO_HOLD_MS = 6500, PEAK_DELAY_MS = 900, PEAK_GLOW_MS = 2400, HEART_FLY_MS = 480, GHOST_MS = 1500;
/** この長さだけ触らずにいると、隣で見守っていることになる（見守る＝操作と同じ扱い）。 */
export const WATCH_IDLE_MS = 7000;
// 体の小さな動き（.tt-cat-body に Web Animations で掛ける。姿勢の transform とは別の層）
const MOVES = Object.freeze({
  squish: [[{ transform: "scale(1.07, .92)" }, { transform: "scale(.98, 1.03)", offset: .55 }, { transform: "none" }], 320],
  wiggle: [[{ transform: "none" }, { transform: "rotate(-4deg) scale(1.05, .96)", offset: .25 }, { transform: "rotate(4deg) scale(1.05, .96)", offset: .6 }, { transform: "none" }], 560],
  hop: [[{ transform: "translateY(0) scale(1.08, .9)" }, { transform: "translateY(-34px) scale(.96, 1.06)", offset: .45 }, { transform: "translateY(0) scale(1.08, .9)", offset: .85 }, { transform: "none" }], 420],
  hop2: [[{ transform: "translateY(0) scale(1.08, .9)" }, { transform: "translateY(-40px) scale(.96, 1.06)", offset: .22 }, { transform: "translateY(0) scale(1.08, .9)", offset: .45 },
    { transform: "translateY(-26px) scale(.97, 1.04)", offset: .68 }, { transform: "translateY(0) scale(1.05, .94)", offset: .9 }, { transform: "none" }], 820],
  jolt: [[{ transform: "none" }, { transform: "translateY(-18px) scale(.95, 1.07)", offset: .3 }, { transform: "none" }], 280],
  skid: [[{ transform: "none" }, { transform: "translateX(28px) rotate(10deg) scale(1.1, .88)", offset: .32 }, { transform: "translateX(-8px) rotate(-4deg)", offset: .7 }, { transform: "none" }], 580],
  turn: [[{ transform: "none" }, { transform: "translateX(10px) rotate(6deg)", offset: .4 }, { transform: "translateX(4px) rotate(2deg)", offset: .8 }, { transform: "none" }], 520],
  shake: [[{ transform: "none" }, { transform: "translateX(-5px)", offset: .2 }, { transform: "translateX(5px)", offset: .4 }, { transform: "translateX(-4px)", offset: .6 }, { transform: "translateX(4px)", offset: .8 }, { transform: "none" }], 380],
  nod: [[{ transform: "none" }, { transform: "rotate(-3deg) translateY(4px)", offset: .35 }, { transform: "rotate(2deg)", offset: .7 }, { transform: "none" }], 520],
  tilt: [[{ transform: "none" }, { transform: "rotate(5deg)", offset: .3 }, { transform: "rotate(5deg)", offset: .7 }, { transform: "none" }], 900],
  sway: [[{ transform: "none" }, { transform: "rotate(-2.5deg)", offset: .25 }, { transform: "rotate(2.5deg)", offset: .75 }, { transform: "none" }], 1300],
  stretch: [[{ transform: "none" }, { transform: "scale(1.14, .86) translateY(2%)", offset: .35 }, { transform: "scale(1.14, .86) translateY(2%)", offset: .7 }, { transform: "none" }], 980],
  melt: [[{ transform: "none" }, { transform: "scale(1.1, .9)", offset: .5 }, { transform: "none" }], 620],
  munch: [[{ transform: "none" }, { transform: "translateY(5px)", offset: .17 }, { transform: "none", offset: .34 }, { transform: "translateY(5px)", offset: .5 }, { transform: "none", offset: .67 }, { transform: "translateY(5px)", offset: .84 }, { transform: "none" }], 720],
});
const LIFE = Object.freeze(["tilt", "sway", "peer", "nod", "hop"]);
// 小さな粒（文字の形の物は字で、そうでない物は CSS で描く）
const BIT = Object.freeze({ heart: "♥", spark: "✦", note: "♪", zzz: "z" });

/**
 * 「てつこといっしょ」の画面を開く（#2454 §10-2）。「帰る」か中断で閉じ、確定に渡す結果を返す。
 * 保存はここでは書かない（確定は呼び出し側が settleTetsukoTime で同じ処理の中に行う）。
 * @param {object} ctx
 * @param {object} ctx.value 現在のセーブ（読むだけ）
 * @param {string} [ctx.visitKey] 親の mukai 訪問の訪問キー（tetsukoVisitKey）
 * @param {string} [ctx.bg] 背景の URL（裏口）。裏口の絵（bg_mukai_backdoor）が届くまでの代わり
 * @param {() => boolean} [ctx.isCurrent] このセッションがまだ有効か（LOAD/章跨ぎで false）
 * @param {AbortSignal} [ctx.signal] 中断シグナル（pagehide などで閉じる）
 * @returns {Promise<object>} sessionResult。中断・LOAD では { meaningful:false }
 */
export async function openTetsukoTime({ value = null, visitKey = null, bg = null, isCurrent = () => true, signal = null } = {}) {
  const idle = { meaningful: false, visitKey };
  if (signal?.aborted || !isCurrent() || !value) return idle;
  const [{ el }, ui, audio, data, kit] = await Promise.all([
    import("../core/util.js"),
    import("../core/ui.js"),
    import("../core/audio.js"),
    import("../core/data.js"),
    import("../core/transition-kit.js"),
  ]);
  if (signal?.aborted || !isCurrent()) return idle;
  const tod = value.slot >= 1 ? "night" : "day";
  const backdoor = ART_READY.background ? data.sceneBg?.("bg_mukai_backdoor", tod) : null;
  const scene = backdoor?.url ? backdoor : bg ? { url: bg, tint: null } : null;
  if (scene) await ui.setBg(scene.url, { instant: true, ...(scene.tint ? { tint: scene.tint } : {}) });
  if (signal?.aborted || !isCurrent()) return idle;
  const { layers, showScreen } = ui;
  const SE = audio.SE || {};
  const bgmBefore = audio.currentBgm();
  const reduced = !!kit.reducedMotion?.();
  const session = createSession(value, { visitKey });
  const name = id => data.displayName?.(id, value) || (id === "mukai_master" ? "ムカイさん" : id);
  const faceSrc = face => data.portraitInfo?.("tetsuko", face)?.src || "";
  const startDay = Number(value.flags?._ch3_intro?.startDay) || null;
  const dayLabel = day => startDay && day >= startDay ? `東京 ${day - startDay + 1}日目` : "";
  const moodText = moodLabel(moodOf(session.day), session.stage);

  return await new Promise(resolve => {
    let done = false, leaving = false, mounted = false, panel = null;
    let timer = 0, stepTimer = 0, fxTimer = 0, purrTimer = 0, walkTimer = 0, stillTimer = 0, heldTimer = 0, flashTimer = 0, quietUntil = 0;
    let capTimer = 0, peakTimer = 0, peakGlowTimer = 0, pounceTimer = 0, ghostTimer = 0, shotTimer = 0, joyTimer = 0, wishTimer = 0, peerTimer = 0;
    let tool = "hand", stroke = null, lastPetAt = 0, lastBrushAt = 0, lastSwingAt = 0, toyTravel = 0, held = false, pouncing = false;
    let toyTip = null, toyGoal = null, toyVel = { x: 0, y: 0 }, toyFrame = 0, heldFrame = 0, toyHeading = { x: 0, y: 0 }, toyMovedAt = 0;
    let selected = null, fresh = [], bookSel = null, lastAt = null, lastX = null, stepFrames = 0, walkFrame = "walk_a";
    let photoUntil = 0, free = null, lastInputAt = Date.now(), pressZone = 0, lastBitAt = 0, motion = null, asked = false;

    // -- 猫（5表情を重ねて置き、表情は data-face で切り替える。しぐさの絵が届いていれば .tt-cat-pose に出す）。
    //    .tt-cat-body は体の小さな動き（はねる・のびる・傾く）の層。姿勢（.tt-cat-frame の transform）とは別に動かす。
    const imgs = FACES.map(face => el("img.tt-cat-img", { src: faceSrc(face), alt: "", draggable: "false", dataset: { face }, decoding: "async" }));
    const pose = el("img.tt-cat-pose", { alt: "", draggable: "false", hidden: true, decoding: "async" });
    const body = el("span.tt-cat-body", [el("span.tt-cat-frame", imgs), pose]);
    const purr = el("span.tt-purr", { "aria-hidden": "true" }, [el("i"), el("i"), el("i")]);
    // おねだりの吹き出し（頭の上。文字ではなくアイコン）と、はじめての人への手本（なでる手が頭の上を往復する）
    const wish = el("span.tt-wish", { "aria-hidden": "true", hidden: true, dataset: { test: "tetsuko-wish" } });
    const ghost = el("span.tt-ghost", { "aria-hidden": "true", hidden: true, html: icon("hand") });
    const cat = el("button.tt-cat", { type: "button", "aria-label": "てつこ", dataset: { test: "tetsuko-cat" } }, [
      el("span.tt-cat-shadow"), body, purr, el("span.tt-fx", { "aria-hidden": "true" }), wish, ghost,
    ]);
    const toyStick = el("i.tt-toy-stick"), toyTipEl = el("i.tt-toy-tip");
    const toy = el("span.tt-toy", { "aria-hidden": "true", dataset: { test: "tetsuko-toy" } }, [toyStick, toyTipEl]);
    const plate = el("span.tt-plate", { "aria-hidden": "true" });
    const lap = el("span.tt-lap", { "aria-hidden": "true" });
    const slots = Object.fromEntries(SLOTS.map(slot => [slot, el("div.tt-slot", { dataset: { slot } })]));
    // 置き場所の当たり: もようがえの間は「置く・片付ける」、ふだんは置いてある物をタップして、てつこを誘う。
    const slotHits = Object.fromEntries(SLOTS.map(slot => [slot, el("button.tt-slot-hit", { type: "button", hidden: true,
      dataset: { slot, test: `tetsuko-slot-${slot}` }, "aria-label": `${SLOT_NAMES[slot]}に置く`, onclick: () => (panel === "decor" ? pickSlot(slot) : pokeProp(slot)) },
      [el("span.tt-slot-label", { text: SLOT_NAMES[slot] })])]));
    // 擬音と小さな粒（舞台の座標。カメラと一緒に動く）
    const pops = el("div.tt-pops", { "aria-hidden": "true" });
    // 舞台は2枚の層に分けて同じカメラで寄せる（奥＝裏口の飾り、手前＝小物・猫・じゃらし）。間の .tt-vignette は画面に固定した
    // 周りの陰で、飾りだけを落として猫・小物は暗くしない。.tt-glow は、ごきげんがいっぱいになった時の明かり。
    const camPlay = el("div.tt-cam.tt-cam-play", [...Object.values(slots), lap, plate, cat, toy, ...Object.values(slotHits), pops]);
    const yard = el("div.tt-yard", [
      el("div.tt-cam.tt-cam-set", { "aria-hidden": "true" }, [
        el("div.tt-set", [
          el("div.tt-wall", [el("div.tt-door", [el("i.tt-door-window"), el("i.tt-door-knob")]), el("i.tt-lamp")]),
          el("div.tt-ground"),
          el("div.tt-bench", [el("i.tt-bench-seat"), el("i.tt-bench-leg.l"), el("i.tt-bench-leg.r")]),
          el("div.tt-sacks", [el("i"), el("i"), el("i")]),
        ]),
      ]),
      el("i.tt-vignette", { "aria-hidden": "true" }),
      el("i.tt-glow", { "aria-hidden": "true" }),
      camPlay,
    ]);

    // -- ごきげん（題の札の下。ハート5つ）と、今日のてつこ（気分のしるし。文は「？」で読める）
    const hearts = Array.from({ length: JOY_HEARTS }, () => el("i.tt-heart", { html: HEART_SVG + HEART_SVG }));
    const joyBar = el("div.tt-joy", { role: "img", dataset: { test: "tetsuko-joy" } }, hearts);
    const mood = el("span.tt-mood", { role: "img", title: moodText, "aria-label": moodText, dataset: { test: "tetsuko-mood", mood: session.mood } });
    const status = el("div.tt-status", [joyBar, mood]);
    // -- 反応の一行（左下。少しで消える）と、見つけた・撮った時の小さな札
    const text = el("p.tt-text", { dataset: { test: "tetsuko-caption" } });
    const line = el("p.tt-line", { hidden: true }, [el("b.tt-line-name"), el("span.tt-line-text")]);
    const chips = el("div.tt-chips");
    const caption = el("div.tt-caption", { role: "status", "aria-live": "polite", dataset: { stale: "false" } }, [text, line, chips]);

    // -- 手元の道具（右下）と、上の道具（右上）。写真は、しぐさが見えた時だけ猫のそばに出る。
    const dockButtons = Object.fromEntries(DOCK.map(item => [item.kind,
      el("button.tt-act", { type: "button", dataset: { test: `tetsuko-${item.kind}`, kind: item.kind }, onclick: () => press(item) }, [
        el("span.tt-act-token", { html: icon(item.icon) }), el("span.tt-act-label", { text: item.label }),
      ])]));
    const dock = el("nav.tt-dock", { "aria-label": "てつことのふれあい" }, Object.values(dockButtons));
    const tool_ = (id, label, ico, onclick) => el("button.tt-tool", { type: "button", dataset: { test: `tetsuko-${id}` }, onclick },
      [el("span.tt-tool-ico", { html: icon(ico) }), el("span.tt-tool-label", { text: label })]);
    const decorButton = tool_("decor", "もようがえ", "decor", () => openDecor());
    const bookButton = tool_("book", "てつこ手帳", "book", () => openBook());
    const backButton = tool_("time-back", "帰る", "back", () => leave());
    const shot = el("button.tt-shot", { type: "button", hidden: true, "aria-label": "写真を撮る", dataset: { test: "tetsuko-photo" }, onclick: () => snap() },
      [el("span.tt-shot-ico", { html: icon("photo") })]);
    // 遊び方は画面に常に出さず、「？」を開いた時だけ見せる（#2717・ミニゲーム共通の方針）。
    const helpButton = el("button.tt-tool.tt-help-btn", { type: "button", dataset: { test: "tetsuko-help" }, "aria-label": HELP_TITLE, title: HELP_TITLE,
      onclick: () => openHelp() }, [el("span.tt-help-q", { "aria-hidden": "true", text: "？" })]);
    const tools = el("div.tt-tools", [helpButton, decorButton, bookButton, backButton]);
    const drawer = el("div.tt-drawer", { hidden: true, dataset: { test: "tetsuko-decor-panel" } });
    const book = el("div.tt-book", { hidden: true, dataset: { test: "tetsuko-book-panel" }, role: "dialog", "aria-label": "てつこ手帳" });
    const help = el("div.tt-help", { hidden: true, dataset: { test: "tetsuko-help-panel" }, role: "dialog", "aria-label": HELP_TITLE });
    // 専用テーマの飾り（#2717）: 段ボールの外枠・左上の題・入った時に箱が開く演出。操作は止めない。
    const theme = tetsukoTheme({ el, title: TETSUKO_TIME.title, roman: TETSUKO_TIME.roman, reduced, SE });

    const host = el("section.tetsuko-time", {
      dataset: { test: "tetsuko-time-screen", stage: String(session.stage), mood: session.mood, tod, tool, reduced: String(reduced), ...artAttrs(),
        artBg: String(!!backdoor?.url), ...theme.attrs },
      "aria-label": TETSUKO_TIME.title,
    }, [yard, status, tools, caption, dock, shot, drawer, book, help, ...theme.nodes]);

    // -- 表示の更新
    const slotOf = id => SLOTS.find(slot => session.props[slot] === id) || null;
    const noteInput = () => { lastInputAt = Date.now(); if (!ghost.hidden) ghost.hidden = true; clearTimeout(ghostTimer); };
    function renderProps() {
      for (const slot of SLOTS) {
        const id = session.props[slot];
        const node = slots[slot];
        node.dataset.prop = id || "";
        node.classList.toggle("holding", !!id && session.cat.inside === id);
        if ((node.firstElementChild?.dataset.prop || "") === (id || "")) continue;
        node.replaceChildren(...(id ? [propNode(id)] : []));
      }
    }
    const propNode = id => el("span.tt-prop", { dataset: { prop: id }, "aria-hidden": "true" },
      [el("i.tt-prop-back"), el("i.tt-prop-front"), id === "tunnel" ? el("i.tt-prop-tail") : null]);
    // 飛びついた先（床の上の好きな位置）。床にいる間はそこに居つづけ、別の居場所へ移る時に解く。
    function clearFree() {
      free = null;
      for (const key of ["--x", "--y", "--s"]) cat.style.removeProperty(key);
    }
    // じゃらしが出ている間は、先のあるほうを向く。
    const faceLeft = () => (tool === "toy" && toyTip && !held ? toyTip.x < catCenter().x - 20 : !!session.cat.flip);
    function renderCat() {
      const c = session.cat;
      let at = c.inside && slotOf(c.inside) ? `slot-${slotOf(c.inside)}` : c.spot;
      if (at === "floor" && free) at = "free";
      else if (free) clearFree();
      const toX = at === "free" ? free.x : SPOT_X[at] ?? 548;
      // 居場所が変わる時は歩く（小さく弾む。しぐさの絵が届いていれば歩きの2枚を交互に）。
      if (lastAt && at !== lastAt && !reduced && !pouncing) {
        const fromX = lastX ?? 548;
        cat.dataset.walk = toX >= fromX ? "right" : "left";
        clearTimeout(walkTimer); clearInterval(stepFrames);
        const travel = Math.max(420, Math.min(1600, Math.abs(toX - fromX) * 2.1));
        cat.style.setProperty("--travel-ms", `${travel}ms`);
        yard.style.setProperty("--travel-ms", `${travel}ms`);
        if (hasPose("walk_a") && hasPose("walk_b")) stepFrames = setInterval(() => { walkFrame = walkFrame === "walk_a" ? "walk_b" : "walk_a"; renderPose(); }, 220);
        walkTimer = setTimeout(() => { delete cat.dataset.walk; clearInterval(stepFrames); walkFrame = "walk_a"; renderPose(); }, travel);
      }
      lastAt = at; lastX = toX;
      Object.assign(cat.dataset, { at, spot: c.spot, pose: c.pose, face: c.face, flip: String(faceLeft()), inside: c.inside || "" });
      lap.classList.toggle("show", c.pose === "lap");
      renderPose();
      renderProps();
      aimCamera();
    }
    // -- カメラ: てつこの居場所（CSS の --x・--y・--s。箱やボールの中の位置の上書きも含む）へ向ける。画面に出る前は測れないので、
    //    出たフレームで動かさずに合わせる（aimWhenShown）。じゃらしの間は少し引いて床の真ん中、もようがえの間は全体。
    let cam = { k: 1, x: 0, y: 0 };
    function aimCamera({ cut = false } = {}) {
      let next = { k: 1, x: 0, y: 0 };
      if (panel !== "decor" && host.isConnected) {
        if (tool === "toy") next = tetsukoToyCamera();
        else {
          const css = getComputedStyle(cat);
          const num = key => parseFloat(css.getPropertyValue(key));
          next = tetsukoCameraFor({ x: num("--x"), y: num("--y"), s: num("--s") });
        }
      }
      if (cut) { yard.dataset.cam = "cut"; }
      cam = next;
      yard.style.setProperty("--cam-k", String(next.k));
      yard.style.setProperty("--cam-x", `${Math.round(next.x)}px`);
      yard.style.setProperty("--cam-y", `${Math.round(next.y)}px`);
      if (cut) { void yard.offsetWidth; delete yard.dataset.cam; }
    }
    const aimWhenShown = () => { if (done) return; if (host.isConnected) { aimCamera({ cut: true }); placeShot(); } else requestAnimationFrame(aimWhenShown); };
    // 舞台の座標 → 画面（1280×720）の座標（手帳へ飛ぶ写真など、舞台の外に出す物の位置）
    const onScreen = point => {
      const rect = camPlay.getBoundingClientRect(), frame = host.getBoundingClientRect();
      const stageScale = frame.width / 1280 || 1, cameraScale = rect.width / 1280;
      return { x: (rect.left - frame.left + cameraScale * point.x) / stageScale,
        y: (rect.top - frame.top + cameraScale * point.y) / stageScale };
    };
    // しぐさの絵（届いた物だけ）。歩いている間は歩きの絵、届いていなければ表情の絵と CSS の姿勢。
    function renderPose() {
      const walking = !!cat.dataset.walk && hasPose(walkFrame);
      const art = walking ? walkFrame : session.cat.art;
      const src = hasPose(art) ? poseUrl(art) : null;
      cat.dataset.art = src ? art : "";
      pose.hidden = !src;
      if (src && pose.getAttribute("src") !== src) pose.src = src;
    }
    function renderButtons() {
      for (const item of DOCK) {
        const button = dockButtons[item.kind];
        const ok = canAct(session, item.kind);
        button.disabled = !ok || leaving || !!panel;
        button.classList.toggle("active", !!item.tool && item.tool === tool);
        button.title = !ok && item.locked ? item.locked : "";
      }
      // 写真: しぐさが見えている間だけ、猫のそばにカメラが出る（まだ撮っていないしぐさは光る）。
      const canShoot = !!session.moment && !leaving && !panel;
      shot.hidden = !canShoot;
      shot.classList.toggle("ready", canShoot && !session.album.some(entry => entry.moment === session.moment));
      shot.title = session.moment ? `今のしぐさ（${momentById(session.moment)?.name}）を写真に残す` : "";
      if (canShoot) placeShot();
      decorButton.classList.toggle("new", session.newProps.length > 0);
      for (const button of [decorButton, bookButton, helpButton]) button.disabled = leaving;
      host.dataset.tool = tool;
      host.dataset.toy = held ? "held" : tool === "toy" ? "out" : "";
      renderSlots();
    }
    function placeShot() {
      if (shot.hidden || !host.isConnected) return;
      const c = onScreen(catCenter());
      shot.style.left = `${Math.round(Math.max(120, Math.min(1160, c.x + 176)))}px`;
      shot.style.top = `${Math.round(Math.max(150, Math.min(470, c.y - 150)))}px`;
    }
    // ごきげんのハート（5つ。途中まで満ちた分も見える）
    function renderJoy({ bump = false } = {}) {
      const per = JOY_MAX / JOY_HEARTS;
      hearts.forEach((node, index) => {
        const fill = Math.max(0, Math.min(1, (session.joy - index * per) / per));
        node.style.setProperty("--f", fill.toFixed(2));
        node.dataset.full = String(fill >= 1);
      });
      if (bump) { joyBar.classList.remove("bump"); void joyBar.offsetWidth; joyBar.classList.add("bump"); }
    }
    function gainJoy() {
      joyBar.dataset.value = String(session.joy);
      joyBar.dataset.hearts = String(joyHearts(session));
      joyBar.setAttribute("aria-label", `ごきげん ${joyHearts(session)} / ${JOY_HEARTS}`);
      clearTimeout(joyTimer);
      if (reduced || !host.isConnected) { renderJoy(); return; }
      // 猫のところからハートが一つ飛んできて、着いたところで満ちる。
      const from = onScreen(catCenter()), box = joyBar.getBoundingClientRect(), frame = host.getBoundingClientRect();
      const scale = frame.width / 1280 || 1;
      const to = { x: (box.left - frame.left + box.width / 2) / scale, y: (box.top - frame.top + box.height / 2) / scale };
      // 顔に重ならないよう、頭の上あたりから飛ばす。
      const flying = el("i.tt-fly-heart", { "aria-hidden": "true", html: HEART_SVG, style: { left: `${from.x + 60}px`, top: `${Math.max(60, from.y - 210)}px` } });
      host.append(flying);
      requestAnimationFrame(() => { flying.style.left = `${to.x}px`; flying.style.top = `${to.y}px`; flying.classList.add("go"); });
      setTimeout(() => flying.remove(), HEART_FLY_MS + 80);
      joyTimer = setTimeout(() => { renderJoy({ bump: true }); }, HEART_FLY_MS);
    }
    // おねだりの吹き出しと、応える道具のしるし
    function renderWish(reaction) {
      const want = session.wish;
      clearTimeout(wishTimer);
      if (want) {
        wish.hidden = false;
        wish.innerHTML = icon(WISH_ICON[want.kind] || "dots");
        // 猫が画面の左寄り（ベンチ）にいる時は、頭の右上に出す（左上の題の札とハートに重ねない）。
        Object.assign(wish.dataset, { kind: want.kind, state: "ask", side: cam.x + cam.k * (lastX ?? 640) < 560 ? "right" : "left" });
        wish.title = WISH_LABEL[want.kind] || "";
      } else if (reaction?.granted && !wish.hidden) {
        wish.dataset.state = "granted";
        wishTimer = setTimeout(() => { if (!session.wish) wish.hidden = true; }, 650);
      } else wish.hidden = true;
      for (const [kind, button] of Object.entries(dockButtons)) button.classList.toggle("asked", !!want && want.kind === kind);
      decorButton.classList.toggle("asked", !!want && want.kind === "decor");
      host.dataset.wish = want?.kind || "";
    }
    function fx(kind) {
      clearTimeout(fxTimer);
      host.dataset.fx = "";
      void host.offsetWidth; // 同じ演出を続けて出す時も最初から
      host.dataset.fx = kind || "";
      if (kind && !kind.startsWith("toy") && kind !== "treat") fxTimer = setTimeout(() => { if (host.dataset.fx === kind) host.dataset.fx = ""; }, 1800);
    }
    // 喉の音（気を許してなでた時・お気に入りの場所・膝の上）。波の線と小さな音。
    function purrNow() {
      clearTimeout(purrTimer);
      host.dataset.purr = "1";
      SE.purr?.();
      purrTimer = setTimeout(() => { host.dataset.purr = ""; }, 1700);
    }
    // 体の小さな動き（動きを減らす設定では出さない）
    function move(id, { mirror = false } = {}) {
      const spec = MOVES[id];
      if (!spec || reduced || !body.animate) return;
      motion?.cancel();
      const frames = mirror ? spec[0].map(frame => ({ ...frame, transform: frame.transform.replace(/translateX\((-?)([\d.]+)px\)/g, (_, sign, n) => `translateX(${sign ? "" : "-"}${n}px)`)
        .replace(/rotate\((-?)([\d.]+)deg\)/g, (_, sign, n) => `rotate(${sign ? "" : "-"}${n}deg)`) })) : spec[0];
      motion = body.animate(frames, { duration: spec[1], easing: "ease-out" });
    }
    function moveFor(reaction) {
      if (reaction.peak) return "hop2";
      if (reaction.kind === "pet") return reaction.pop === "ぷいっ" ? "turn" : reaction.pop === "ぱたん" ? "shake" : reaction.sweet ? "wiggle" : "squish";
      if (reaction.kind === "catch") return "hop";
      if (reaction.kind === "miss") return "skid";
      if (reaction.kind === "play") return reaction.pounce ? null : reaction.pop === "ぺしっ" ? "jolt" : reaction.pop === "じりっ" ? "shake" : "tilt";
      if (reaction.kind === "brush") return "melt";
      if (reaction.kind === "treat" || reaction.pop === "かりかり") return "munch";
      if (reaction.kind === "watch") return "nod";
      if (reaction.kind === "leave") return "hop";
      return { ask: "tilt", yawn: "stretch", stretch: "stretch", mew: "nod", poke: "jolt", tail: "sway", box_in: "hop", box_peek: "jolt", ball_paw: "jolt",
        scratch: "shake", mashiro: "jolt", groom: "nod", tunnel: "shake", come: "hop" }[reaction.id] || null;
    }
    // 小さな粒（ハート・きらきら・音符・Zzz・汗・肉球・毛）。舞台の座標で出し、カメラと一緒に動く。
    function burst(kind, point, count = 3, spread = 90) {
      if (reduced || !point || !host.isConnected) return;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2, far = spread * (.45 + Math.random() * .55);
        const node = el("i.tt-bit", { text: BIT[kind] || "", dataset: { kind }, style: { left: `${Math.round(point.x)}px`, top: `${Math.round(point.y)}px`,
          "--dx": `${Math.round(Math.cos(angle) * far)}px`, "--dy": `${Math.round(Math.sin(angle) * far * .6 - spread * .7)}px`,
          "--rot": `${Math.round(Math.random() * 70 - 35)}deg`, animationDelay: `${i * 45}ms` } });
        pops.append(node);
        setTimeout(() => node.remove(), 1500 + i * 45);
      }
    }
    // 擬音（猫の頭の上に、大きく短く）。読み上げは反応の一行が受け持つ。
    function popWord(word, point) {
      if (!word || !point || !host.isConnected) return;
      for (const old of pops.querySelectorAll(".tt-pop")) old.remove();
      // おねだりの吹き出し（頭の左上）が出ている間は、右へ寄せて重ねない。
      const shift = wish.hidden ? 0 : wish.dataset.side === "right" ? -70 : 70;
      const node = el("b.tt-pop", { text: word, style: { left: `${Math.round(point.x + shift + (reduced ? 0 : Math.random() * 70 - 35))}px`, top: `${Math.round(point.y)}px`,
        "--rot": `${Math.round(Math.random() * 14 - 7)}deg` } });
      pops.append(node);
      setTimeout(() => node.remove(), 1300);
    }
    function bitsFor(reaction, head, chest) {
      if (reaction.peak) { burst("heart", chest, 9, 170); burst("spark", chest, 9, 210); return; }
      if (reaction.found) burst("spark", chest, 6, 150);
      if (reaction.granted) burst("note", head, 3, 80);
      if (reaction.kind === "pet" && reaction.sweet) burst("spark", head, 4, 80);
      if (reaction.kind === "catch") burst("heart", chest, 4, 110);
      if (reaction.kind === "miss") burst("sweat", head, 2, 60);
      if (reaction.fx === "zzz") burst("zzz", head, 2, 40);
      if (reaction.fx === "mew") burst("note", head, 1, 50);
      if (reaction.fx === "poke") burst("paw", { x: chest.x + 40, y: chest.y + 10 }, 1, 0);
      if (reaction.fx === "scratch" || reaction.kind === "brush") burst("fur", chest, 3, 70);
    }
    function sound(reaction) {
      if (reaction.peak) { SE.twinkle?.(); return; }
      if (reaction.found) SE.perfect?.();
      if (reaction.kind === "pet") { (reaction.pop === "ぷいっ" || reaction.pop === "ぱたん" ? SE.cancel : SE.pon)?.(); return; }
      if (reaction.kind === "catch") { SE.select?.(); return; }
      if (reaction.kind === "miss") { SE.boing?.(); return; }
      if (reaction.kind === "play") { if (!reaction.pounce) SE.click?.(); return; }
      if (reaction.kind === "brush") { SE.pour?.(); return; }
      if (reaction.id === "mew" || reaction.id === "ask" || reaction.kind === "leave") { SE.mew?.(); return; }
      if (reaction.id === "poke" || reaction.invited) { SE.pon?.(); return; }
      if (reaction.granted) SE.good?.();
    }
    // 反応の一行: 自分の操作への反応・新しいしぐさ・人物の一言・最初のおねだりは見せる。てつこが勝手にしている、いつものしぐさは
    // 擬音と動きだけで見せ、文は出さない（quiet。帯が消えている間だけ、読み上げ用に文を入れ替える）。
    function setCaption(value, { quiet = false } = {}) {
      if (quiet) { if (caption.dataset.stale === "true") text.textContent = value; return; }
      text.textContent = value;
      wakeCaption();
    }
    // 反応の一行は少しで消える（見つけた・撮った札が出ている間は残す）。読み上げと検査のために文は残る。
    function wakeCaption() {
      caption.dataset.stale = "false";
      clearTimeout(capTimer);
      capTimer = setTimeout(() => { caption.dataset.stale = "true"; }, CAPTION_MS);
    }
    function show(reaction) {
      if (!reaction || reaction.quiet) return;
      renderCat();
      const routine = reaction.kind === "auto" && !reaction.found && !reaction.line && !reaction.invited && !reaction.watched && !(reaction.id === "ask" && !asked);
      if (reaction.id === "ask") asked = true;
      setCaption(reaction.text, { quiet: routine });
      if (reaction.line) {
        line.hidden = false;
        line.firstElementChild.textContent = name(reaction.line.speaker);
        line.lastElementChild.textContent = `「${reaction.line.text}」`;
      } else if (!routine) line.hidden = true;
      if (reaction.found) { toast("found", reaction.found); photoUntil = Date.now() + PHOTO_HOLD_MS; }
      fx(reaction.fx);
      const head = headPoint(), chest = catCenter();
      popWord(reaction.pop, head);
      bitsFor(reaction, head, chest);
      const id = moveFor(reaction);
      if (id) move(id, { mirror: cat.dataset.flip === "true" });
      sound(reaction);
      if (reaction.pop === "ごろごろ" || reaction.pop === "すりすり" || reaction.pose === "lap" || (reaction.kind === "pet" && session.stage >= 2 && reaction.fx === "heart")) purrNow();
      if (reaction.joy?.gain || reaction.peak) gainJoy();
      renderWish(reaction);
      renderButtons();
      placeToy();
    }
    // 途中の様子（おやつの「匂いを確かめる→食べる」）を順に見せてから、反応の本体を出す。
    // 途中で別の操作をすれば、そちらの反応に切り替わる（待たせない）。
    function play(reaction) {
      clearTimeout(stepTimer);
      const steps = reaction?.steps || [];
      if (!steps.length) { show(reaction); return; }
      const final = { ...session.cat };
      let index = 0;
      const next = () => {
        if (done) return;
        if (panel || document.hidden) { stepTimer = setTimeout(next, 250); return; }
        if (index < steps.length) {
          const step = steps[index++];
          session.cat = { spot: step.spot, pose: step.pose, face: step.face, inside: null, flip: false, art: step.art || null };
          show({ ...step, found: null, line: null });
          quietUntil = Date.now() + AFTER_ACTION_MS + STEP_MS;
          stepTimer = setTimeout(next, reduced ? STEP_REDUCED_MS : STEP_MS);
        } else {
          session.cat = final;
          show(reaction);
        }
      };
      next();
    }

    // -- 見つけた・撮った時の小さな札（反応の帯の中）。数秒で消え、手帳に残る。
    function thumb(momentId) {
      const moment = momentById(momentId);
      const art = moment?.art && hasPose(moment.art) ? poseUrl(moment.art) : null;
      return el("span.tt-thumb", { dataset: { face: moment?.face || "normal", art: art ? "1" : "" } },
        [el("img", { src: art || faceSrc(moment?.face || "normal"), alt: "" })]);
    }
    function toast(kind, momentId) {
      const card = el("div.tt-toast", { dataset: { kind } }, [
        thumb(momentId),
        el("p", { dataset: { test: "tetsuko-note" } }, [
          el("small", { text: kind === "photo" ? "写真に残した" : "しぐさ図鑑に記録" }),
          el("b", { text: momentById(momentId)?.name || "" }),
        ]),
        kind === "found" ? el("i.tt-stamp", { "aria-hidden": "true" }) : null,
      ]);
      chips.replaceChildren(card);
      wakeCaption();
      setTimeout(() => card.remove(), TOAST_MS);
      if (kind === "found") { bookButton.classList.remove("got"); void bookButton.offsetWidth; bookButton.classList.add("got"); }
    }
    // 撮った写真が、猫のところから手帳へ飛んでいく（動きを減らす設定では飛ばさない）。
    function flyToBook(momentId) {
      if (reduced) return;
      const c = onScreen(catCenter());
      const card = el("span.tt-fly", { "aria-hidden": "true", style: { left: `${c.x}px`, top: `${c.y}px` } }, [thumb(momentId)]);
      host.append(card);
      requestAnimationFrame(() => card.classList.add("go"));
      setTimeout(() => card.remove(), 900);
    }

    // -- 操作
    function doAct(kind, opts = {}) {
      if (done || leaving || panel) return null;
      const reaction = act(session, kind, opts);
      if (!reaction) return null;
      noteInput();
      quietUntil = Date.now() + AFTER_ACTION_MS;
      play(reaction);
      // 捕まえたら、じゃらしはしばらく猫の胸元にある。
      if (reaction.kind === "catch") holdToy();
      queuePeak(reaction);
      schedule();
      return reaction;
    }
    function press(item) {
      if (done || leaving || panel) return;
      noteInput();
      if (item.kind === "play") {
        if (tool !== "toy") setTool("toy");
        if (held || pouncing) return;
        // ボタンでも1回振ったことになる（先が猫の近くで小さく揺れる）。
        const home = toyHome();
        toyGoal = { x: home.x + (session.swings % 2 ? -46 : 46), y: home.y - 18 };
        if (reduced) { toyTip = toyGoal; placeToy(); } else if (!toyFrame) toyFrame = requestAnimationFrame(springToy);
        swing();
        return;
      }
      if (item.tool) setTool(item.tool);
      // ボタンのなでるは、頭→あご→背中の順に手を移す（ボタンだけでも、お気に入りの場所が見つかる）。
      if (item.kind === "pet") { doAct("pet", { zone: ["head", "chin", "back"][pressZone++ % 3] }); return; }
      doAct(item.kind);
    }
    function setTool(next) {
      if (tool === next) return;
      tool = next;
      clearTimeout(stillTimer); clearTimeout(heldTimer);
      cancelAnimationFrame(toyFrame); toyFrame = 0;
      held = false; toyTravel = 0; toyVel = { x: 0, y: 0 }; toyHeading = { x: 0, y: 0 };
      toyTip = toyGoal = tool === "toy" ? toyHome() : null;
      cat.dataset.flip = String(faceLeft());
      renderButtons();
      placeToy();
      aimCamera();
    }

    // -- 猫じゃらし: 先は指・マウスの位置を、少し遅れて弾みながら追う。動かすと振ったことになり、3回目で前足、その次で飛びつく。
    //    飛びついた先にじゃらしがあれば捕まえ、引いていれば空振り（どちらも遊びのうち）。止めて近くに置いておいても捕まえる。
    // 指・マウスの位置 → 舞台の座標。寄せた・動いている途中のカメラも、手前の層の実際の位置と大きさから戻す。
    const yardPoint = event => {
      const rect = camPlay.getBoundingClientRect();
      const k = rect.width / 1280 || 1;
      return { x: (event.clientX - rect.left) / k, y: (event.clientY - rect.top) / k };
    };
    // 移動途中の実際の位置を使う。行き先へじゃらしだけが先に飛ばない。
    const catCenter = () => {
      const rect = cat.getBoundingClientRect();
      return yardPoint({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height * .62 });
    };
    const headPoint = () => {
      const rect = cat.getBoundingClientRect();
      const curled = session.cat.face === "sleep" || session.cat.pose === "tunnel";
      return yardPoint({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height * (curled ? .4 : .04) });
    };
    const toyHome = () => { const c = catCenter(); return { x: Math.min(1100, c.x + 150), y: c.y - 30 }; };
    const clampTip = point => ({ x: Math.max(60, Math.min(1220, point.x)), y: Math.max(130, Math.min(600, point.y)) });
    function placeToy() {
      if (tool !== "toy") { toy.hidden = true; return; }
      toy.hidden = false;
      const tip = held ? { x: catCenter().x - 10, y: catCenter().y + 40 } : (toyTip ||= toyHome());
      const dx = tip.x - HAND_AT.x, dy = tip.y - HAND_AT.y;
      toy.style.setProperty("--tx", `${tip.x}px`);
      toy.style.setProperty("--ty", `${tip.y}px`);
      toyStick.style.width = `${Math.hypot(dx, dy)}px`;
      toyStick.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
    function springToy() {
      toyFrame = 0;
      if (done || tool !== "toy" || held || !toyGoal || !toyTip) return;
      toyVel = { x: toyVel.x * .68 + (toyGoal.x - toyTip.x) * .2, y: toyVel.y * .68 + (toyGoal.y - toyTip.y) * .2 };
      toyTip = { x: toyTip.x + toyVel.x, y: toyTip.y + toyVel.y };
      placeToy();
      const left = String(faceLeft());
      if (!pouncing && cat.dataset.flip !== left) cat.dataset.flip = left;
      if (Math.abs(toyVel.x) + Math.abs(toyVel.y) > .25 || Math.hypot(toyGoal.x - toyTip.x, toyGoal.y - toyTip.y) > .5) toyFrame = requestAnimationFrame(springToy);
    }
    function moveToy(point) {
      if (done || held || panel || leaving) return;
      const next = clampTip(point), now = performance.now();
      if (toyGoal) {
        toyTravel += Math.hypot(next.x - toyGoal.x, next.y - toyGoal.y) * cam.k; // 振った長さは画面の上で測る（寄せても手の動きは同じ）
        // 手の向きと速さ（舞台の px／ミリ秒）。飛びつく時に、行き先を少しだけ先読みする。
        const dt = Math.max(8, Math.min(120, now - toyMovedAt));
        toyHeading = { x: toyHeading.x * .5 + (next.x - toyGoal.x) / dt * .5, y: toyHeading.y * .5 + (next.y - toyGoal.y) / dt * .5 };
      }
      toyMovedAt = now;
      toyGoal = next;
      if (reduced || !toyTip) { toyTip = next; placeToy(); }
      else if (!toyFrame) toyFrame = requestAnimationFrame(springToy);
      if (!pouncing && toyTravel >= TOY_SWING_PX && Date.now() - lastSwingAt >= TOY_SWING_GAP_MS) {
        toyTravel = 0; lastSwingAt = Date.now();
        swing();
      }
      clearTimeout(stillTimer);
      stillTimer = setTimeout(() => {
        if (done || panel || leaving || document.hidden || tool !== "toy" || held || pouncing || !toyOut(session) || !toyTip) return;
        const c = catCenter();
        if (Math.hypot(toyTip.x - c.x, toyTip.y - c.y) <= TOY_CATCH_PX) pounce({ sure: true });
      }, TOY_STILL_MS);
    }
    // ひと振り。5回目は、必ず捕まえる飛びつき。
    function swing() {
      if (session.swings + 1 >= PLAY_AUTO_CATCH && toyOut(session)) { pounce({ sure: true }); return; }
      const reaction = doAct("play");
      if (reaction?.pounce) pounce();
    }
    // 飛びつく: じゃらしの先へ弧を描いて跳び、着いた時に先が近くにあれば捕まえる。様子見の段階・動きを減らす設定では跳ばない。
    function pounce({ sure = false } = {}) {
      const land = () => {
        if (done || leaving || tool !== "toy") return;
        const c = catCenter(), tip = toyTip || toyGoal;
        const near = !!tip && (reduced || session.stage === 0 ? Math.hypot(tip.x - c.x, tip.y - c.y) <= TOY_CATCH_PX : Math.abs(tip.x - c.x) <= POUNCE_HIT_PX);
        doAct(sure || near ? "catch" : "miss");
      };
      if (reduced || session.stage === 0 || !toyTip) { land(); return; }
      // 狙うのは手の行き先（指・マウスの位置）を少し先読みした所。ゆっくり動かす・止めると届き、速く振る・切り返すと空振りになる。
      // （先そのものは少し遅れてついてくるので、遅れた先へ跳ぶと届かない。）
      const goal = toyGoal || toyTip;
      const moving = !sure && performance.now() - toyMovedAt <= HEADING_FRESH_MS;
      const aim = moving ? clampTip({ x: goal.x + toyHeading.x * POUNCE_MS * POUNCE_LEAD, y: goal.y + toyHeading.y * POUNCE_MS * POUNCE_LEAD }) : goal;
      leapTo(aim, { ms: sure ? 300 : POUNCE_MS, onLand: land });
    }
    function leapTo(point, { ms = POUNCE_MS, onLand }) {
      const from = catCenter();
      const dir = point.x >= from.x ? 1 : -1;
      free = { x: Math.max(TETSUKO_LEAP.min, Math.min(TETSUKO_LEAP.max, point.x - dir * 34)), y: TETSUKO_LEAP.y, s: 1 };
      pouncing = true;
      clearTimeout(walkTimer); clearInterval(stepFrames); clearTimeout(pounceTimer);
      delete cat.dataset.walk;
      cat.style.setProperty("--travel-ms", `${ms}ms`);
      cat.style.setProperty("--x", `${free.x}px`);
      cat.style.setProperty("--y", `${free.y}px`);
      cat.style.setProperty("--s", String(free.s));
      Object.assign(cat.dataset, { at: "free", flip: String(dir < 0), inside: "" });
      lastAt = "free"; lastX = free.x;
      const apex = Math.max(70, Math.min(190, 560 - point.y));
      motion?.cancel();
      motion = body.animate?.([{ transform: "translateY(0) rotate(0deg) scale(1.1, .86)" },
        { transform: `translateY(-${apex}px) rotate(${dir * 12}deg) scale(.94, 1.1)`, offset: .5 },
        { transform: "translateY(0) rotate(0deg) scale(1.12, .86)", offset: .92 }, { transform: "none" }], { duration: ms + 90, easing: "ease-out" }) || null;
      SE.swish?.();
      pounceTimer = setTimeout(() => { pouncing = false; onLand(); }, ms);
    }
    function holdToy() {
      held = true;
      toyTravel = 0; toyVel = { x: 0, y: 0 };
      clearTimeout(stillTimer); clearTimeout(heldTimer);
      cancelAnimationFrame(toyFrame); toyFrame = 0;
      renderButtons(); placeToy();
      if (!heldFrame) heldFrame = requestAnimationFrame(followHeldToy);
      heldTimer = setTimeout(() => { held = false; toyTip = toyGoal = tool === "toy" ? toyHome() : null; renderButtons(); placeToy(); }, TOY_HELD_MS);
    }
    yard.addEventListener("pointermove", event => {
      if (tool !== "toy" || panel || leaving) return;
      if (event.pointerType !== "mouse" && !(event.buttons & 1)) return;
      noteInput();
      moveToy(yardPoint(event));
    });
    yard.addEventListener("pointerdown", event => {
      if (tool !== "toy" || panel || leaving || done) return;
      noteInput();
      yard.setPointerCapture?.(event.pointerId);
      moveToy(yardPoint(event));
    });
    yard.addEventListener("pointercancel", () => { clearTimeout(stillTimer); toyTravel = 0; });
    // 捕まえた先は猫と一緒に運ぶ。操作も移動もない時はフレームを回さない。
    function followHeldToy() {
      if (done || !held || !(cat.dataset.walk || pouncing)) { heldFrame = 0; return; }
      placeToy(); heldFrame = requestAnimationFrame(followHeldToy);
    }

    // -- 猫を直接: なでる手ならタップ／ゆっくりなぞる＝なでる（触った場所で反応が変わる）。ブラシなら、なぞる＝ブラシ。
    //    じゃらしの時は猫を押しても振らない。なぞっている間は、手のほうへ体を少し寄せる。
    const zoneOf = event => {
      const rect = cat.getBoundingClientRect();
      if (!rect.width || !Number.isFinite(event.clientX) || (event.type === "click" && event.detail === 0)) return ["head", "chin", "back"][pressZone++ % 3];
      const c = session.cat;
      return petZoneAt((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height,
        { curled: c.face === "sleep" || c.pose === "curl" || c.pose === "lap", flip: cat.dataset.flip === "true" });
    };
    const lean = event => {
      const rect = cat.getBoundingClientRect();
      if (!rect.width) return;
      cat.style.setProperty("--lean", `${(Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5)) * 10).toFixed(1)}deg`);
      cat.dataset.press = "1";
    };
    const unlean = () => { cat.style.removeProperty("--lean"); cat.dataset.press = ""; };
    cat.addEventListener("pointerdown", event => {
      if (done || leaving || panel || tool === "toy") return;
      noteInput();
      cat.setPointerCapture?.(event.pointerId);
      const point = yardPoint(event);
      stroke = { ...point, dist: 0, done: false, id: event.pointerId };
      lean(event);
    });
    cat.addEventListener("pointermove", event => {
      if (!stroke || event.pointerId !== stroke.id || !(event.buttons & 1) || panel || done || leaving) return;
      const point = yardPoint(event), now = Date.now();
      stroke.dist += Math.hypot(point.x - stroke.x, point.y - stroke.y);
      stroke.x = point.x; stroke.y = point.y;
      lean(event);
      if (now - lastBitAt > 150) { lastBitAt = now; burst(tool === "brush" ? "fur" : "dot", point, 1, 24); }
      if (tool === "hand" && stroke.dist >= STROKE_PX && now - lastPetAt >= STROKE_GAP_MS) { stroke.dist = 0; stroke.done = true; lastPetAt = now; doAct("pet", { zone: zoneOf(event) }); }
      if (tool === "brush" && stroke.dist >= BRUSH_PX && now - lastBrushAt >= BRUSH_GAP_MS) { stroke.dist = 0; stroke.done = true; lastBrushAt = now; doAct("brush"); }
    });
    cat.addEventListener("pointerup", event => {
      unlean();
      const id = event.pointerId;
      setTimeout(() => { if (stroke?.id === id) stroke = null; }, 120); // click が来なかった時の後始末
    });
    cat.addEventListener("pointercancel", () => { stroke = null; unlean(); });
    cat.addEventListener("click", event => {
      const stroked = stroke?.done;
      stroke = null;
      unlean();
      if (stroked || panel || done || leaving || tool === "toy") return;
      if (tool === "brush") { lastBrushAt = Date.now(); doAct("brush"); return; }
      lastPetAt = Date.now();
      doAct("pet", { zone: zoneOf(event) });
    });
    // 置いてある物をタップして、てつこを誘う（箱なら入る・顔を出す、ボールなら転がす・見送る）。
    function pokeProp(slot) {
      if (done || leaving || panel) return;
      const reaction = invite(session, session.props[slot]);
      if (!reaction) return;
      noteInput();
      quietUntil = Date.now() + AFTER_ACTION_MS;
      show(reaction);
      queuePeak(reaction);
      schedule();
    }

    // -- ごきげんがいっぱいになったら、少し間を置いて「とっておき」（段階ごとのしぐさ）。ハートは空に戻り、またためられる。
    function queuePeak(reaction) {
      if (!reaction?.joy?.peak) return;
      clearTimeout(peakTimer);
      peakTimer = setTimeout(firePeak, reduced ? 300 : PEAK_DELAY_MS);
    }
    function firePeak() {
      if (done || leaving) return;
      if (panel || pouncing || held || document.hidden) { peakTimer = setTimeout(firePeak, 400); return; }
      const reaction = peakReaction(session);
      if (!reaction) return;
      clearTimeout(stepTimer);
      if (tool === "toy") setTool("hand");
      quietUntil = Date.now() + PEAK_GLOW_MS;
      host.dataset.peak = "1";
      clearTimeout(peakGlowTimer);
      peakGlowTimer = setTimeout(() => { host.dataset.peak = ""; }, PEAK_GLOW_MS);
      show(reaction);
      schedule();
    }

    // -- 自律行動（画面を開いている間だけ。閉じている間は進めない）。落ち着く間は、小さな身じろぎだけ入れる。
    function schedule() {
      clearTimeout(timer);
      if (done) return;
      timer = setTimeout(tick, autoDelay(session, { reduced }));
    }
    function life() {
      if (reduced || done || cat.dataset.walk || pouncing || stroke) return;
      const c = session.cat;
      if (c.face === "sleep" || c.pose === "tunnel" || c.pose === "odd") { burst("zzz", headPoint(), 1, 36); return; }
      const pick = LIFE[Math.floor(Math.random() * LIFE.length)];
      if (pick === "peer") {
        if (c.inside || tool === "toy") { move("tilt"); return; }
        cat.dataset.flip = String(cat.dataset.flip !== "true");
        clearTimeout(peerTimer);
        peerTimer = setTimeout(() => { if (!done && !pouncing) cat.dataset.flip = String(faceLeft()); }, 1100);
        return;
      }
      move(pick === "hop" && (session.stage < 2 || c.inside) ? "sway" : pick);
    }
    function tick() {
      if (done) return;
      // LOAD などで画面が差し替わったら、ここで閉じる（確定しない）。
      if (host.isConnected) mounted = true;
      if (!isCurrent() || (mounted && !host.isConnected)) { finish(true); return; }
      if (leaving || panel || held || pouncing || stroke || document.hidden || Date.now() < quietUntil) { schedule(); return; }
      // 見つけたばかりのしぐさは、写真を撮れるようにしばらく保つ（その間も体は小さく動き、おねだりは出る）。
      const reaction = autonomous(session, { idle: Date.now() - lastInputAt >= WATCH_IDLE_MS, holding: Date.now() < photoUntil });
      if (reaction.quiet) life();
      else { show(reaction); queuePeak(reaction); }
      schedule();
    }

    // -- 写真（今見えているしぐさだけ。シャッターの光と、手帳へ飛ぶ小さな写真）
    function snap() {
      if (done || leaving || panel || !session.moment) return;
      noteInput();
      const id = session.moment;
      if (!takePhoto(session)) return;
      (SE.shutter || SE.click)?.();
      clearTimeout(flashTimer);
      host.dataset.flash = "";
      void host.offsetWidth;
      host.dataset.flash = "1";
      flashTimer = setTimeout(() => { host.dataset.flash = ""; }, 700);
      toast("photo", id);
      flyToBook(id);
      photoUntil = 0; renderButtons();
    }

    // -- もようがえ: 道具箱から物を選び、光った場所をタップして置く。置いた物をタップすると片付ける。
    function openDecor() {
      if (done || leaving) return;
      noteInput();
      SE.click?.();
      closePanelQuietly();
      setTool("hand");
      panel = "decor"; host.dataset.panel = "decor";
      clearTimeout(stillTimer); stroke = null;
      aimCamera();
      fresh = [...session.newProps];
      session.newProps = [];
      selected = null;
      renderDrawer(); renderButtons();
    }
    function renderDrawer() {
      const items = PROPS.filter(item => propUnlocked(item, session.stage, session.metMashiro));
      drawer.hidden = false;
      drawer.replaceChildren(
        el("div.tt-drawer-head", [el("b", { text: "もようがえ" })]),
        el("div.tt-drawer-items", items.map(item => {
          const at = slotOf(item.id);
          return el("button.tt-item", { type: "button", dataset: { prop: item.id, test: `tetsuko-item-${item.id}` }, "aria-pressed": String(selected === item.id),
            title: item.from, onclick: () => { SE.click?.(); selected = selected === item.id ? null : item.id; renderDrawer(); renderSlots(); } }, [
            el("span.tt-item-pic", [propNode(item.id)]),
            el("b", { text: item.name }),
            at ? el("small.tt-item-at", { text: SLOT_NAMES[at] }) : null,
            fresh.includes(item.id) ? el("i.tt-new", { text: "新" }) : null,
          ]);
        })),
        el("button.btn.small.tt-drawer-close", { type: "button", text: "おわる", dataset: { test: "tetsuko-panel-close" }, onclick: () => { SE.cancel?.(); closePanel(); } }),
      );
    }
    function renderSlots() {
      for (const slot of SLOTS) {
        const hit = slotHits[slot];
        const id = session.props[slot];
        if (panel === "decor") {
          const allowed = !!selected && propById(selected).slots.includes(slot);
          hit.hidden = false;
          Object.assign(hit.dataset, { mode: "decor", allowed: String(allowed), filled: String(!!id) });
          hit.disabled = !allowed && !id;
          hit.setAttribute("aria-label", `${SLOT_NAMES[slot]}に置く`);
        } else {
          // ふだんは、置いてある物をタップして誘える（じゃらしを振っている間は、じゃらしに任せる）。
          const playable = !panel && !leaving && !!id && tool !== "toy";
          hit.hidden = !playable;
          Object.assign(hit.dataset, { mode: "play", allowed: "false", filled: String(!!id) });
          hit.disabled = false;
          if (id) hit.setAttribute("aria-label", `${propById(id)?.name || ""}で誘う`);
        }
      }
    }
    function pickSlot(slot) {
      if (panel !== "decor") return;
      const ok = selected ? placeProp(session, slot, selected) : !!session.props[slot] && placeProp(session, slot, null);
      if (!ok) return;
      SE.click?.();
      selected = null;
      renderCat(); renderDrawer(); renderWish(); renderButtons();
    }

    // -- てつこ手帳: 左に12のしぐさ、右に選んだしぐさ（写真・てつこメモ）。
    function openBook(focus = null) {
      if (done || leaving) return;
      noteInput();
      SE.click?.();
      closePanelQuietly();
      panel = "book"; host.dataset.panel = "book";
      clearTimeout(stillTimer); stroke = null;
      bookSel = focus || session.newFound.at(-1) || session.found.at(-1) || MOMENTS[0].id;
      renderBook(); renderButtons();
    }
    function renderBook() {
      const count = session.found.length;
      const peaks = session.pastPeaks + session.peaks;
      const cards = MOMENTS.map((moment, index) => {
        const found = session.found.includes(moment.id);
        const photo = session.album.find(entry => entry.moment === moment.id);
        return el("button.tt-card", { type: "button", dataset: { found: String(found), photo: String(!!photo), test: `tetsuko-book-${moment.id}` },
          "aria-pressed": String(bookSel === moment.id), onclick: () => { SE.click?.(); bookSel = moment.id; renderBook(); } }, [
          el("span.tt-card-no", { text: String(index + 1).padStart(2, "0") }),
          found ? thumb(moment.id) : el("span.tt-thumb.unknown", { text: "？" }),
          el("b", { text: found ? moment.name : "？？？" }),
          found ? el("i.tt-stamp", { "aria-hidden": "true" }) : null,
        ]);
      });
      const pick = momentById(bookSel) || MOMENTS[0];
      const known = session.found.includes(pick.id);
      const photo = session.album.find(entry => entry.moment === pick.id);
      const detail = el("div.tt-detail", [
        el("div.tt-polaroid", { dataset: { photo: String(!!photo), known: String(known) } }, [
          el("i.tt-tape"), known ? thumb(pick.id) : el("span.tt-thumb.unknown", { text: "？" }),
          el("small", { text: photo ? dayLabel(photo.day) || "写真" : known ? "写真はまだ" : "" }),
        ]),
        el("h4", { text: known ? pick.name : "まだ見つけていない" }),
        el("p.tt-detail-memo", { text: known ? pick.memo : pick.hint }),
        !known && discoveryGuide(session, pick.id).id === pick.id
          ? el("button.btn.small.tt-seek", { type: "button", text: "このしぐさを探す", dataset: { test: "tetsuko-seek" }, onclick: () => { seekMoment(session, pick.id); closePanel(); } }) : null,
      ]);
      book.hidden = false;
      book.replaceChildren(el("div.tt-book-spread", [
        el("div.tt-page.left", [el("h3", { text: "てつこ手帳" }),
          el("p.tt-book-count", [`見つけたしぐさ　${count} / ${MOMENTS.length}`,
            peaks > 0 ? el("span.tt-book-joy", { dataset: { test: "tetsuko-book-joy" } }, [el("i.tt-book-heart", { "aria-hidden": "true", html: HEART_SVG }), `ごきげん　${peaks}回`]) : null]),
          el("div.tt-cards", cards)]),
        el("div.tt-page.right", [detail]),
      ]), el("button.btn.small.tt-book-close", { type: "button", text: "閉じる", dataset: { test: "tetsuko-panel-close" }, onclick: () => { SE.cancel?.(); closePanel(); } }));
    }
    // -- あそびかた（「？」）: 開いている間は自律行動を止める。Esc・閉じるで戻る。
    function openHelp() {
      if (done || leaving) return;
      noteInput();
      SE.click?.();
      closePanelQuietly();
      panel = "help"; host.dataset.panel = "help";
      clearTimeout(stillTimer); stroke = null;
      help.hidden = false;
      help.replaceChildren(helpCard({ el, icon, mood: moodText, onClose: () => { SE.cancel?.(); closePanel(); } }));
      renderButtons();
    }
    function closePanelQuietly() {
      const wasDecor = panel === "decor";
      panel = null; host.dataset.panel = ""; selected = null;
      if (wasDecor) aimCamera();
      drawer.hidden = true; drawer.replaceChildren();
      book.hidden = true; book.replaceChildren();
      help.hidden = true; help.replaceChildren();
      renderSlots();
    }
    function closePanel() { closePanelQuietly(); lastInputAt = Date.now(); renderButtons(); schedule(); }
    const onKey = event => { if (event.key === "Escape" && panel) { event.preventDefault(); closePanel(); } };

    // -- 帰る（いつでも押せる。気を許した段階で、ふれあいの後なら戸の前まで見送ってくれる）
    function leave() {
      if (done || leaving) return;
      SE.select?.();
      const bye = farewell(session);
      if (!bye) { finish(); return; }
      leaving = true;
      clearTimeout(stepTimer); clearTimeout(peakTimer); clearTimeout(pounceTimer);
      pouncing = false;
      closePanelQuietly();
      setTool("hand");
      show(bye);
      backButton.disabled = true;
      setTimeout(finish, reduced ? FAREWELL_REDUCED_MS : FAREWELL_MS);
    }
    function finish(aborted = false) {
      if (done) return;
      done = true;
      for (const t of [timer, stepTimer, fxTimer, purrTimer, walkTimer, stillTimer, heldTimer, flashTimer, capTimer, peakTimer, peakGlowTimer, pounceTimer,
        ghostTimer, joyTimer, wishTimer, peerTimer]) clearTimeout(t);
      clearInterval(stepFrames); clearInterval(shotTimer);
      cancelAnimationFrame(toyFrame); cancelAnimationFrame(heldFrame);
      motion?.cancel();
      theme.stop();
      window.removeEventListener("pagehide", abort);
      window.removeEventListener("keydown", onKey);
      signal?.removeEventListener?.("abort", abort);
      if (layers.screen?.firstElementChild === host) showScreen("none", null);
      if (audio.currentBgm() === "bgm_tetsuko_time") audio.playBgm(bgmBefore);
      resolve(aborted || !isCurrent() ? idle : sessionResult(session));
    }
    const abort = () => finish(true);

    window.addEventListener("pagehide", abort, { once: true });
    window.addEventListener("keydown", onKey);
    signal?.addEventListener?.("abort", abort, { once: true });
    // 開いた時の居場所・表情を先に決めてから出す（ベンチから滑ってこない）。
    show(openingReaction(session));
    renderJoy();
    showScreen("tetsuko-time", host);
    aimWhenShown();
    theme.start(host);
    audio.playBgm("bgm_tetsuko_time");
    // カメラ（写真）の札は、歩く猫と寄るカメラについていく。
    shotTimer = setInterval(placeShot, 300);
    // 通いはじめの人には、なでる手の手本を少しだけ見せる（触ると消える）。
    if (!reduced && session.sessions < 2) ghostTimer = setTimeout(() => { if (!done && Date.now() - lastInputAt >= GHOST_MS - 50) ghost.hidden = false; }, GHOST_MS);
    lastInputAt = Date.now();
    schedule();
  });
}
