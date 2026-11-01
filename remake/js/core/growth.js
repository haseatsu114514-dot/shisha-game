// 経験値・レベル・火種（心得の盤 第二弾の芯。docs/stat-design/SPEC.md 1章・6.1a・6.3）。
// 盤の画面ができるまでは GROWTH_BOARD=false の裏に置く。恋人EXPの保存・獲得表示だけは先行公開。
// 開発中は URL の ?growth=1（または __remake.dev.growth(true)）でこの端末だけ有効にできる。
// 無効時は旧成長、有効時は経験値へ置き換える。通常マスの恩恵は旧能力由来の効き目へ加算する（保存値へは書き戻さない）。
// 第2版（SPEC 2026-10-30）: 能力は3つ（才能・感覚・理論）、火種はレベル1つで2つ、色つきの火種は才・感・理。
import { state, save } from "./state.js";
import { emit } from "./bus.js";
import { setExpHooks, affinityLevel } from "./stats.js";
import { BOARD_KEYS, BOARD_PREFIX, BOARD_SHAPES, STAT_SQUARES, SKILLS, LESSONS, CHAR_TYPE, PLAY_REWARDS, KUJI_LAST_ONE_GIFT } from "./growth-board-data.js";
import { growthEnabled, PREVIEW_KEY } from "./growth-mode.js";
import { growthPerks, growthSkill, growthLesson, SKILL_TUNING, LESSON_TUNING } from "./growth-effects.js";
import { masteryHooks } from "./flavor-mastery.js";
export { GROWTH_BOARD, growthEnabled } from "./growth-mode.js";

export function setGrowthPreview(on) {
  try {
    if (on) globalThis.localStorage?.setItem(PREVIEW_KEY, "1");
    else globalThis.localStorage?.removeItem?.(PREVIEW_KEY);
  } catch { /* 保存できない環境では今回の起動だけ無効のまま */ }
  emit("hud");
}

// ---------------------------------------------------------------- 数値（SPEC 1.2〜1.5）

export const MAX_LEVEL = 99; // 2周目の終わりにやり込んで届く上限（SBD51）
/** 盤の全部（能力のマス＋関門＋スキル。v3 で約270）。これ以上の火種は渡さない（1.5「盤は埋まった」） */
export const BOARD_TOTAL = BOARD_KEYS.reduce((n, b) => n + STAT_SQUARES[b]
  + BOARD_SHAPES[b].cells.filter(([, kind]) => kind === "gate").length, 0) + SKILLS.reduce((n, s) => n + s.cost, 0);
/** 盤の型の版。違う版の灯し方は、使った火種を返して最初から（習得した授業は残す） */
export const BOARD_VERSION = 13; // 4: 授業の小道、5: 授業20、6: 1レベル1つ、7: 3盤とも7割、8: 3盤を同じ大きさに・1レベル2つ、9: 紋を下に・関門の先に授業、10: 関門を紋のそばに・極みは盤を埋めたご褒美、11: 3枚の形をそれぞれ変える、12: 紋の場所も盤ごと・授業は章の順に遠く（2026-10-30）、13: 輪つきの木・要のマス・アイコン（2026-10-31）
/**
 * レベルアップ1回でもらう万能の火種（1.5）。2026-10-30 オーナー「いろんな盤をあけてく爽快感も欲しい」→「1レベル2つ・盤を細かく」（SBD60）:
 * どのレベルも2つ。盤は198（3盤とも66）で、1周目（中央 Lv.57、約140）で3つの盤どれも7割。
 */
export const HIDANE_PER_LEVEL = 2;
export const hidaneForLevel = () => HIDANE_PER_LEVEL;
export const COLORED_GIFT = 2;      // 節目・大会・♥5の色つきの火種（1.5）
export const MILESTONE_LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
export const CHAPTER_MULT = { 1: 1, 2: 1.25, 3: 1.5, 4: 1.75, 5: 2 };
export const EXP = { action: 30, firstPerson: 40, firstPlace: 40, affinityStep: 30, recipe: 30, golden: 20, scene: 20 };
/** その章で同じ鍵の 1・2回目 ×1.0、3回目 ×0.8、4回目 ×0.6、5回目以降 ×0.4（1.3） */
export const FRESHNESS = [1, 1, 0.8, 0.6, 0.4];
export const freshness = (count) => FRESHNESS[Math.min(FRESHNESS.length, Math.max(1, count)) - 1];

/** Lv L → L+1 に必要な経験値 */
export const expToNext = (level) => 200 + 5 * level;
/** Lv L に届く累計経験値（Lv.1 は 0、Lv.2 は 205、Lv.10 は 2,025） */
export const totalExpFor = (level) => 200 * (level - 1) + 5 * (level - 1) * level / 2;
export function levelForExp(xp) {
  let level = 1;
  while (level < MAX_LEVEL && totalExpFor(level + 1) <= xp) level++;
  return level;
}

// ---------------------------------------------------------------- 状態

export const HIDANE_KEYS = ["any", ...BOARD_KEYS];

// 盤のマスID（データから。規則の growth-board.js とは循環させない）
const BOARD_IDS = Object.fromEntries(BOARD_KEYS.map((b) => [b, [
  ...Array.from({ length: STAT_SQUARES[b] }, (_, i) => `${BOARD_PREFIX[b]}${i + 1}`),
  ...Array.from({ length: BOARD_SHAPES[b].cells.filter(([, kind]) => kind === "gate").length }, (_, i) => `${BOARD_PREFIX[b]}G${i + 1}`),
  ...SKILLS.filter((x) => x.board === b).map((x) => x.id),
]]));
const VALID_IDS = new Set([...Object.values(BOARD_IDS).flat(), ...LESSONS.map((l) => l.id)]);
/** 盤の火種で灯すマスが全部灯っているか（受け取りの上限とは別。#1801 引継ぎ B4） */
const boardAllLit = (g) => Object.values(BOARD_IDS).every((ids) => ids.every((id) => g.nodes.includes(id)));
/** その盤に、火種で灯せる未解放のマスが残っているか */
const boardHasRoom = (g, board) => BOARD_IDS[board].some((id) => !g.nodes.includes(id));

export function newGrowth() {
  return {
    level: 1,
    xp: 0,                 // 累計経験値（行動の確定時にその場で入る）
    settledXp: 0,          // 最後に寝た時点の累計（ゲージの濃い金）
    hidane: Object.fromEntries(HIDANE_KEYS.map((k) => [k, 0])), // 未使用の火種（万能と系統限定）
    earned: 0,             // これまでに受け取った火種の総数
    milestones: [],        // 2つ目を渡した節目のレベル（重複防止）
    fresh: { chapter: 1, counts: {} }, // 新鮮さの鍵 -> その章の回数
    firsts: { people: [], places: [] }, // 周回内の「はじめて」
    discoveries: { recipes: [], golden: [] }, // 自由行動で精算した配合の発見（周回ごと）
    read: [],              // 自分で選んだ固有場面の完読報酬（開始台本ID、周回ごと）
    chapterLog: {},        // 章 -> X1で関わった人・場所（X11）
    tournamentXp: {},      // 章 -> 大会の参加・最高順位・色の火種（再挑戦で戻さない）
    cleared: [],           // X10/X11を精算した章（周回ごと）
    today: { xp: 0, learned: {}, gifts: [] }, // 寝る時までの分。learned は鍵 -> 経験値（「今日学んだこと」）、gifts は♥5の贈り物
    seen: { fullLevelUp: false },      // フル演出を一度見たか（初回の判定）
    nodes: [],             // 盤で灯したマスID（確定済みだけ。紋は数えない。取った授業も入る）
    paid: {},              // マスID -> 払った火種 { any: n, body: n, … }（組み直しで同じ種類に戻す）
    ringsOpen: 1,          // 開いている章の範囲（周回で引き継ぐ）
    gifted: {},            // ♥5で色つきの火種を受け取った人（周回で空に戻す）
    litSince: {},          // 前の節目から盤ごとに灯した火種（節目の色を決める。1.5）
    target: null,          // 目標のマス（2.4）
    learned: [],           // 相談を終えて習得した授業（盤で灯した授業は「相談できる」。次に会った時に相談して習得）
    rewards: {},           // 受け取った遊びのご褒美（斧投げ・TRPG・DJ の水準、くじのラストワン賞）
    seenRing: 1,           // 盤で「新しい道が開いた」を見せた章の範囲（章が進んで初めて開いた時の演出）
    boardVersion: BOARD_VERSION, // 盤の型の版（v2→v3 で灯し方を返す）
  };
}

const num = (v, min = 0) => Number.isFinite(v) && v >= min ? v : min;
const strings = (list) => [...new Set((Array.isArray(list) ? list : []).filter((v) => typeof v === "string" && v))];

/**
 * 前の版の盤で灯したマスを外し、払った火種を同じ種類で返す（払いの記録が無い分は万能で1つ）。
 * 習得した授業（と相談待ちの授業）は火種いらずなので残す。2026-10-30 v3 の盤（SBD53）。
 */
function refundOldBoard(g) {
  const lessonIds = new Set(LESSONS.map((l) => l.id));
  const kept = [];
  for (const id of strings(g.nodes)) {
    if (lessonIds.has(id)) { kept.push(id); continue; }
    const pay = g.paid[id];
    if (pay && typeof pay === "object") {
      for (const [k, n] of Object.entries(pay)) if (HIDANE_KEYS.includes(k)) g.hidane[k] += Math.floor(num(n));
    } else g.hidane.any += 1;
    delete g.paid[id];
  }
  g.nodes = kept;
  g.target = null;
  g.boardVersion = BOARD_VERSION;
}

/** 有効なときだけ呼ぶ。壊れた値は既定値に戻し、累計と精算済みの順を保つ。 */
export function ensureGrowth(s = state) {
  if (!s) return null;
  const fresh = newGrowth();
  const g = s.growth && typeof s.growth === "object" && !Array.isArray(s.growth) ? s.growth : (s.growth = fresh);
  g.xp = Math.min(num(g.xp), totalExpFor(MAX_LEVEL));
  g.level = Math.min(levelForExp(g.xp), Math.max(1, Math.floor(num(g.level, 1))));
  g.settledXp = Math.min(g.xp, Math.max(num(g.settledXp), totalExpFor(g.level)));
  // 第1版の試作の色（技・感・根・魅・察）が残っていれば万能に寄せる
  const oldColors = ["technique", "guts", "charm", "insight"].reduce((n, k) => n + Math.floor(num(g.hidane?.[k])), 0);
  g.hidane = Object.fromEntries(HIDANE_KEYS.map((k) => [k, Math.floor(num(g.hidane?.[k]))]));
  g.hidane.any += oldColors;
  g.earned = Math.floor(num(g.earned));
  g.milestones = (Array.isArray(g.milestones) ? g.milestones : []).filter((l) => MILESTONE_LEVELS.includes(l));
  if (!g.fresh || typeof g.fresh !== "object") g.fresh = fresh.fresh;
  if (!g.fresh.counts || typeof g.fresh.counts !== "object") g.fresh.counts = {};
  g.firsts = { people: strings(g.firsts?.people), places: strings(g.firsts?.places) };
  g.discoveries = { recipes: strings(g.discoveries?.recipes), golden: strings(g.discoveries?.golden) };
  g.read = strings(g.read);
  for (const key of ["chapterLog", "tournamentXp"]) {
    if (!g[key] || typeof g[key] !== "object" || Array.isArray(g[key])) g[key] = {};
  }
  g.cleared = [...new Set((Array.isArray(g.cleared) ? g.cleared : []).filter(c => Number.isInteger(c) && c >= 1 && c <= 5))];
  if (!g.today || typeof g.today !== "object") g.today = fresh.today;
  g.today.xp = num(g.today.xp);
  if (!g.today.learned || typeof g.today.learned !== "object") g.today.learned = {};
  if (!Array.isArray(g.today.gifts)) g.today.gifts = [];
  g.seen = { fullLevelUp: g.seen?.fullLevelUp === true };
  if (!g.paid || typeof g.paid !== "object" || Array.isArray(g.paid)) g.paid = {};
  if (g.boardVersion !== BOARD_VERSION) refundOldBoard(g);
  g.nodes = strings(g.nodes).filter((id) => VALID_IDS.has(id));
  g.ringsOpen = Math.min(5, Math.max(1, Math.floor(num(g.ringsOpen, 1))));
  if (!g.gifted || typeof g.gifted !== "object" || Array.isArray(g.gifted)) g.gifted = {};
  g.litSince = Object.fromEntries(BOARD_KEYS.map((k) => [k, Math.floor(num(g.litSince?.[k]))]));
  if (!VALID_IDS.has(g.target)) g.target = null;
  if (!g.rewards || typeof g.rewards !== "object" || Array.isArray(g.rewards)) g.rewards = {};
  g.learned = strings(g.learned).filter((id) => g.nodes.includes(id));
  g.seenRing = Math.min(5, Math.max(1, Math.floor(num(g.seenRing, 1))));
  syncLessonFlags(g, s);
  return g;
}

/**
 * 授業と今のゲームのフラグをそろえる（4.5・2.6）。
 * 旧セーブで習得済みのフラグがあれば、道が届いていなくてもその授業を灯す。灯した授業はフラグを立てる（周回で消えても戻す）。
 */
function syncLessonFlags(g, s) {
  if (!s.flags || typeof s.flags !== "object") return;
  for (const lesson of LESSONS) {
    const unlocks = lesson.unlocks || [];
    // 旧セーブで習得済み（今のゲームのフラグがある）なら、灯して習得した状態にする
    if (unlocks.some((f) => s.flags[f] === true)) {
      if (!g.nodes.includes(lesson.id)) { g.nodes.push(lesson.id); g.paid[lesson.id] = {}; }
      if (!g.learned.includes(lesson.id)) g.learned.push(lesson.id);
    }
    // 習得した授業はフラグを立てる（周回で消えても戻す）
    if (g.learned.includes(lesson.id)) for (const f of unlocks) s.flags[f] = true;
  }
}

/** 灯して「相談できる」まま、まだ相談していない授業（その人の分）。場面のある授業だけ */
export function readyLessons(who, s = state) {
  if (!growthEnabled() || !s) return [];
  const g = ensureGrowth(s);
  return LESSONS.filter((l) => l.who === who && l.scene && g.nodes.includes(l.id) && !g.learned.includes(l.id));
}
export const lessonLearned = (id, s = state) => !!s?.growth?.learned?.includes(id);

/** 相談を終えて習得する（今のゲームのフラグも立てる） */
export function learnLesson(id, s = state) {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson || !s) return false;
  const g = ensureGrowth(s);
  if (!g.nodes.includes(id) || g.learned.includes(id)) return false;
  g.learned.push(id);
  for (const f of lesson.unlocks || []) s.flags[f] = true;
  return true;
}

/** 同じセーブの授業を最後まで読んだ時だけ習得・保存する。中断やロード後の古い完了通知は捨てる。 */
export function completeLesson(student, id, result) {
  const lesson = LESSONS.find((l) => l.id === id);
  if (student !== state || !lesson?.scene || !growthEnabled() || result?.cancelled
    || result?.id !== lesson.scene || !result.visited?.includes(lesson.scene)
    || !learnLesson(id)) return false;
  save();
  return true;
}

/**
 * その人に会った時の相談（2.6・SBD50）: 相談できる授業があれば、はじめが相談して話を聞く場面を見て習得する。
 * 場面を最後まで読んだ時だけ習得（途中でやめたら、また次に会った時）。戻り値=習得した授業
 */
export async function consultLessons(who, { only = null, bg, signal } = {}) {
  const owner = state;
  const lessons = readyLessons(who).filter((l) => !only || l.id === only);
  if (!lessons.length) return [];
  const { play } = await import("../vn/engine.js");
  const { gainCard } = await import("./ui.js");
  const done = [];
  for (const lesson of lessons) {
    const result = await play(lesson.scene, { ...(bg ? { bg } : {}), signal });
    if (!completeLesson(owner, lesson.id, result)) break;
    done.push(lesson);
    gainCard({ kind: "info", badge: "授", top: "TRAINING", main: lesson.name, sub: lesson.text });
  }
  if (done.length) emit("hud");
  return done;
}


/** 盤で灯した火種を数える（節目の色。growth-board.js の決定から呼ぶ） */
export function noteLit(g, board, cost) {
  if (BOARD_KEYS.includes(board)) g.litSince[board] = (g.litSince[board] || 0) + (cost || 0);
}

/**
 * 色つきの火種を渡す。その盤に灯せるマスが残っていなければ万能で渡す（1.9）。
 * 戻り値: 実際に渡した { kind, n }（盤が全部埋まっていれば n=0）
 */
export function giveColored(g, board, n = COLORED_GIFT) {
  const give = Math.max(0, Math.min(n, BOARD_TOTAL - g.earned));
  const kind = boardHasRoom(g, board) ? board : "any";
  g.hidane[kind] += give;
  g.earned += give;
  return { kind, n: give };
}

/** 埋まった盤の色つきの火種は万能に変える（1.9「持っている間に埋まれば万能に」） */
export function foldFullBoards(g) {
  for (const board of BOARD_KEYS) {
    if (g.hidane[board] > 0 && !boardHasRoom(g, board)) { g.hidane.any += g.hidane[board]; g.hidane[board] = 0; }
  }
}

export const hidaneTotal = (g = state?.growth) => g ? HIDANE_KEYS.reduce((n, k) => n + (g.hidane?.[k] || 0), 0) : 0;
export const pendingLevels = (g = state?.growth) => g ? levelForExp(g.xp) - g.level : 0;

// ---------------------------------------------------------------- 通知チップ（1行動につき1枚・REPORT R7）

const MERGE_MS = 700;
let chip = null;
let chipTimer = null;
let holdDepth = 0;

function addToChip(amount, tag, source) {
  if (chip?.owner !== state) chip = { owner: state, total: 0, tags: [] };
  chip.total += amount;
  if (source === "lover") chip.publicReward = true;
  if (tag && !chip.tags.includes(tag)) chip.tags.push(tag);
  clearTimeout(chipTimer);
  if (!holdDepth) chipTimer = setTimeout(flushChip, MERGE_MS);
}
function flushChip() {
  clearTimeout(chipTimer);
  const c = chip;
  chip = null;
  if (!c || c.owner !== state || !(c.total > 0)) return;
  emit("exp-gain", { total: c.total, tags: c.tags, ...(c.publicReward ? { publicReward: true } : {}) });
}
/** 自由行動の間は、行動中に入った分（好感度の段など）を行動の確定まで1枚にまとめる。 */
export function holdExpChip() {
  holdDepth++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holdDepth = Math.max(0, holdDepth - 1);
    if (!holdDepth && chip) flushChip();
  };
}

// ---------------------------------------------------------------- 経験値の入口

/**
 * 経験値の唯一の入口（4.1 の gainExp）。章倍率を掛けて累計と「今日」に足す。
 * レベルはまだ上げない（寝る時に精算する。1.7）。戻り値=入った量。
 */
export function gainExp(base, { key = null, tag = null, silent = false, source = null, first = false } = {}) {
  // 恋人イベントだけは通常プレイでも貯める。精算・火種・盤の公開条件は変えない。
  if ((!growthEnabled() && source !== "lover") || !state || !(base > 0)) return 0;
  const g = ensureGrowth();
  const room = totalExpFor(MAX_LEVEL) - g.xp;
  const firstBonus = first && growthSkill(state, "K04") ? 1 + SKILL_TUNING.first : 1;
  const amount = Math.min(room, Math.round(base * (CHAPTER_MULT[state.chapter] || 1) * firstBonus));
  if (!(amount > 0)) return 0;
  g.xp += amount;
  g.today.xp += amount;
  if (key) g.today.learned[key] = (g.today.learned[key] || 0) + amount;
  if (!silent) addToChip(amount, tag, source); // silent: 呼び出し側が自分の通知で見せる（スロットの結果カード）
  emit("hud");
  return amount;
}

// パッキースロットで図柄が揃ったときの経験値（#1281 オーナー指示 2026-10-30「図柄が揃ったら経験値が入る」）。
// ハズレ・リプレイは無し。1章30回転の平均は約510（SPEC 1.4 の「スロット分は章の約2割」）。チェリー重複は REG/BIG
export const SLOT_EXP = { cherry: 10, bell: 15, reg: 90, big: 130, rare: 130, freeze: 200 };
/** スロットの当たり1回ぶんの経験値を入れる。通知はスロットの演出で出す。戻り値=入った量 */
export function awardSlotExp(role) {
  const base = SLOT_EXP[role];
  return base ? gainExp(base, { key: "pakki_slot", silent: true }) : 0;
}

/**
 * 体力を使った自由行動1回の経験値（X1〜X3）。
 * @param target.key 新鮮さの鍵（相手のキャラID、スポットID、行動の種類）
 * @param target.person はじめての相手（X2）／ target.place はじめての場所・遊び（X3）
 */
export function awardActionExp(target) {
  if (!growthEnabled() || !state || !target?.key) return 0;
  const g = ensureGrowth();
  if (g.fresh.chapter !== state.chapter) g.fresh = { chapter: state.chapter, counts: {} };
  const count = (g.fresh.counts[target.key] = (Number(g.fresh.counts[target.key]) || 0) + 1);
  let log = g.chapterLog[state.chapter];
  if (!log || typeof log !== "object" || Array.isArray(log)) log = g.chapterLog[state.chapter] = { people: [], places: [] };
  log.people = strings(log.people); log.places = strings(log.places);
  const collection = target.person ? log.people : log.places, id = target.person || target.place || target.key;
  if (!collection.includes(id)) collection.push(id);
  let got = gainExp(EXP.action * freshness(count), { key: target.key, tag: count >= 3 ? "なじみ" : null });
  if (target.person && !g.firsts.people.includes(target.person)) {
    g.firsts.people.push(target.person);
    got += gainExp(EXP.firstPerson, { key: target.key, tag: "はじめて", first: true });
  }
  if (target.place && !g.firsts.places.includes(target.place)) {
    g.firsts.places.push(target.place);
    got += gainExp(EXP.firstPlace, { key: target.key, tag: "はじめて", first: true });
  }
  return got;
}

/** X6/X7。配合画面を閉じただけでは渡さず、paidAction の確定から呼ぶ。周回ごとに各レシピ1回。 */
export function awardRecipeExp(id, { discovered = false, golden = false } = {}) {
  if (!growthEnabled() || !state || typeof id !== "string" || !id) return 0;
  const g = ensureGrowth();
  let got = 0;
  for (const [kind, eligible, base] of [["recipes", discovered, EXP.recipe], ["golden", golden, EXP.golden]]) {
    if (!eligible || g.discoveries[kind].includes(id)) continue;
    g.discoveries[kind].push(id);
    got += gainExp(base, { key: `recipe:${id}`, tag: kind === "recipes" ? "新レシピ" : "黄金比" });
  }
  return got;
}

/** X5/X5s。専用の恋人報酬は lover-rewards.js が扱い、同じ完読を二重に数えない。 */
export function awardSceneExp(id) {
  if (!growthEnabled() || !state || typeof id !== "string" || !id
    || /^lover_/.test(id) || id === "hiyori_feelings_spoken") return 0;
  const g = ensureGrowth();
  if (g.read.includes(id)) return 0;
  g.read.push(id);
  return gainExp(EXP.scene, { key: `scene:${id}`, tag: "会話", first: true });
}

/** X8/X9。順位の報酬は最高記録との差分だけ。制作が最後まで終わった大会では色の火種も一度渡す。 */
export function awardTournamentExp(rank, craft) {
  if (!growthEnabled() || !state || !Number.isInteger(rank) || rank < 1) return 0;
  const g = ensureGrowth(), chapter = state.chapter;
  let entry = g.tournamentXp[chapter];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) entry = g.tournamentXp[chapter] = {};
  let got = 0;
  if (entry.entered !== true) {
    entry.entered = true;
    got += gainExp(100, { key: "tournament", tag: "大会出場" });
  }
  const base = [200, 120, 80][rank - 1] || 40;
  const previous = [40, 80, 120, 200].includes(entry.rankBase) ? entry.rankBase : 0;
  if (base > previous) {
    entry.rankBase = base;
    got += gainExp(base - previous, { key: "tournament", tag: `${rank}位` });
  }
  if (entry.gifted !== true && !craft?.failed && craft?.pullDone && craft?.careHistory?.length === 2) {
    const stages = [
      ["body", craft.careHistory[0]?.score], ["body", craft.careHistory[1]?.score],
      ["sense", craft.heat?.score], ["sense", craft.steam?.score],
      ["wisdom", craft.holes?.skipped ? null : craft.holes?.score], ["wisdom", craft.stats?.craftQuality],
    ].filter(([, score]) => Number.isFinite(score));
    if (stages.length) {
      const top = Math.max(...stages.map(([, score]) => score));
      const colors = [...new Set(stages.filter(([, score]) => score === top).map(([color]) => color))];
      const color = colors.reduce((best, key) => boardFill(g, key) < boardFill(g, best) ? key : best);
      entry.gifted = true;
      const gift = giveColored(g, color);
      if (gift.n > 0) g.today.gifts.push({ label: "大会の学び", parts: [gift] });
    }
  }
  return got;
}

/** X10/X11。物語が章を閉じる同期的な確定地点で呼ぶ。初回だけ内訳を経験値チップへ渡す。 */
export function awardChapterClearExp() {
  if (!growthEnabled() || !state) return 0;
  const g = ensureGrowth(), chapter = state.chapter;
  if (g.cleared.includes(chapter)) return 0;
  g.cleared.push(chapter);
  const log = g.chapterLog[chapter] || {}, people = strings(log.people).length, places = strings(log.places).length;
  return gainExp(150, { key: "chapter_clear", tag: "章クリア" })
    + gainExp(people * 25 + places * 15, { key: "chapter_breadth", tag: `広さ ${people}人・${places}種類` });
}

/** 好感度・恋人の絆の段が上がった（X4）。段ごとに +30。♥5になった人からは、その人の色の火種（2.7） */
export function awardAffinityStepExp(id, steps) {
  if (!(steps > 0)) return 0;
  const got = gainExp(EXP.affinityStep * steps, { key: id, tag: "仲が深まった" });
  giftAtMaxHeart(id);
  return got;
}

/** ♥5になった人から、その人のタイプの色の火種2つ（1.5・2.7）。周回ごとに1回 */
export function giftAtMaxHeart(id) {
  const color = CHAR_TYPE[id];
  if (!growthEnabled() || !state || !color || affinityLevel(id) < 5) return null;
  const g = ensureGrowth();
  if (g.gifted[id]) return null;
  g.gifted[id] = true;
  const got = giveColored(g, color);
  // 寝る前のレベルアップでまとめて知らせる（会話の途中に割り込まない）
  if (got.n > 0) { g.today.gifts.push({ who: id, parts: [got] }); emit("hud"); }
  return got;
}

/** 色つきの火種のセットを渡す。戻り値=実際に渡した内訳 */
function giveSet(g, set) {
  const parts = [];
  for (const [kind, n] of Object.entries(set)) { const got = giveColored(g, kind, n); if (got.n > 0) parts.push(got); }
  return parts;
}

const RANK_ORDER = ["D", "C", "B", "A", "S"];
// 斧投げのランクの境目（minigames/axe-challenges.js の RANKS と同じ。依存を増やさないため写す。テストで照合）
export const AXE_RANKS = [["S", 0.8], ["A", 0.62], ["B", 0.45], ["C", 0.25], ["D", 0]];
const rankOf = (total, max) => AXE_RANKS.find(([, min]) => (max > 0 ? total / max : 0) >= min)[0];
const atLeast = (rank, need) => RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf(need);
/** 斧投げの自己ベストのランク（どのルールでも一番良いもの） */
function bestAxeRank(s) {
  let best = null;
  for (const record of Object.values(s.flags?._axe_bar_records || {})) {
    const b = record?.best;
    if (!b || !(b.maximum > 0)) continue;
    const rank = rankOf(b.total, b.maximum);
    if (!best || atLeast(rank, best)) best = rank;
  }
  return best;
}
function playRewardMet(reward, s) {
  if (reward.game === "axe") { const rank = bestAxeRank(s); return !!rank && atLeast(rank, reward.rank); }
  if (reward.game === "trpg") {
    const cleared = Object.values(s.trpg?.cleared || {});
    if (reward.stars) return cleared.some((c) => (c?.stars || 0) >= reward.stars);
    return cleared.length >= reward.clears;
  }
  if (reward.game === "dj") { const rank = s.dj?.bestRank; return typeof rank === "string" && atLeast(rank, reward.rank); }
  return false;
}

/**
 * 遊びのご褒美（SBD39）と、くじのラストワン賞の火種（SBD40）を受け取る。寝る前の精算から呼ぶ。
 * 戻り値: [{ label, parts: [{ kind, n }] }]
 */
export function claimPlayRewards(g, s = state) {
  const out = [];
  for (const reward of PLAY_REWARDS) {
    if (g.rewards[reward.id] || !playRewardMet(reward, s)) continue;
    g.rewards[reward.id] = true;
    out.push({ label: reward.label, parts: giveSet(g, reward.gift) });
  }
  for (const [grade, box] of Object.entries(s.kuji || {})) {
    if (!box || !Array.isArray(box.order) || box.drawn < box.order.length || box.emptyDay == null) continue;
    const key = `kuji:${grade}:${s.chapter}:${box.emptyDay}`;
    if (g.rewards[key]) continue;
    g.rewards[key] = true;
    const low = BOARD_KEYS.reduce((best, k) => boardFill(g, k) < boardFill(g, best) ? k : best, BOARD_KEYS[0]);
    out.push({ label: "くじのラストワン賞", parts: giveSet(g, { [low]: KUJI_LAST_ONE_GIFT }) });
  }
  return out;
}

// ---------------------------------------------------------------- 寝る時の精算（6.3）

/** 盤の伸び（灯した能力のマスの割合）。規則の growth-board.js と同じ数え方を、循環させずに持つ（段は SBD63 でなくした） */
function boardFill(g, board) {
  const prefix = BOARD_PREFIX[board];
  let n = g.nodes.filter((id) => id.startsWith(prefix) && /^\D\d+$/.test(id)).length;
  for (const l of LESSONS) if (l.board === board && l.reward === "stat" && g.nodes.includes(l.id)) n += l.bonus || 0;
  return Math.min(STAT_SQUARES[board], n) / STAT_SQUARES[board];
}

/** 節目の色: 前の節目から一番火種を灯した盤。同数なら伸びの少ない盤（1.5） */
export function milestoneSystem(g = ensureGrowth()) {
  return BOARD_KEYS.reduce((best, k) => {
    const a = g.litSince[k] || 0, b = g.litSince[best] || 0;
    return a > b || (a === b && boardFill(g, k) < boardFill(g, best)) ? k : best;
  }, BOARD_KEYS[0]);
}

/**
 * その日の分を精算する。上がったレベルの数だけ火種を渡し、「今日」を空にする。
 * 何度呼んでも、同じ経験値で二重に渡さない（level と milestones で判定）。
 */
export function settleGrowth() {
  if (!growthEnabled() || !state) return null;
  const g = ensureGrowth();
  const from = g.level, to = levelForExp(g.xp);
  const xpFrom = g.settledXp;
  const learned = Object.entries(g.today.learned).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => key);
  const gains = { any: 0, limited: [] };
  for (let level = from + 1; level <= to; level++) {
    const n = Math.min(hidaneForLevel(level), BOARD_TOTAL - g.earned);
    if (n > 0) { g.hidane.any += n; g.earned += n; gains.any += n; }
    if (MILESTONE_LEVELS.includes(level) && !g.milestones.includes(level)) {
      g.milestones.push(level);
      const system = milestoneSystem(g);
      const got = giveColored(g, system);
      g.litSince = Object.fromEntries(BOARD_KEYS.map((k) => [k, 0]));
      if (got.n > 0) gains.limited.push({ level, system: got.kind, n: got.n });
    }
  }
  const gifts = [...g.today.gifts, ...claimPlayRewards(g)].filter((x) => x.parts.length);
  foldFullBoards(g);
  g.level = to;
  g.settledXp = g.xp;
  g.today = { xp: 0, learned: {}, gifts: [] };
  if (to > from || gifts.length) emit("hud");
  const milestone = gains.limited.length > 0 || MILESTONE_LEVELS.some((l) => l > from && l <= to);
  const full = to > from && (!g.seen.fullLevelUp || milestone || to - from >= 2);
  if (full) g.seen.fullLevelUp = true;
  return { from, to, xpFrom, xpTo: g.xp, gains, gifts, learned, milestone, full, boardFull: boardAllLit(g) };
}

/**
 * 寝る直前の精算と演出。無効のときは何もしない（演出の画面は使う時だけ読む）。
 * evePlace（大会前夜）があれば、精算のあと火種が残っている時だけ内省の場面で盤を開く（2.8・#1690）。
 */
export async function presentNight({ evePlace = null } = {}) {
  if (!growthEnabled()) return null;
  const owner = state;
  const { presentNightGrowth } = await import("../daily/levelup.js");
  const result = await presentNightGrowth();
  if (evePlace && state === owner) {
    const { eveReflection } = await import("../daily/reflection.js");
    await eveReflection(evePlace);
  }
  return result;
}

/**
 * 参拝の場所に着いた時の「静かに振り返る」（時間を使わない）。
 * 火種が無ければ何もしない（false）。振り返った・戻った時は true（呼び出し側は行動にしない）。
 */
export async function reflectAtSpot(spotId) {
  if (spotId !== "kannon" || !growthEnabled() || !state) return false;
  const owner = state;
  const { canReflect, reflectAt } = await import("../daily/reflection.js");
  if (!canReflect()) return false;
  const { modal } = await import("./ui.js");
  const how = await modal({ title: "観音堂", body: "学んできたことを振り返り、火種を盤に灯せる。", options: [
    { label: "盤を開く（時間は進まない）", value: "reflect", primary: true, test: "kannon-reflect" },
    { label: "いつもどおり過ごす（1行動）", value: "visit", test: "kannon-visit" },
    { label: "戻る", value: null },
  ] });
  if (state !== owner || !growthEnabled()) return true;
  if (how === "visit") return false;
  if (how === "reflect") {
    if (!owner.flags._kannon_growth_intro_done) {
      const { play } = await import("../vn/engine.js");
      const result = await play("kannon_growth_intro", { bg: "res://assets/backgrounds/bg_kannon_night.png" });
      if (state !== owner || !growthEnabled() || result?.cancelled
        || result?.id !== "kannon_growth_intro" || !result.visited?.includes("kannon_growth_intro")) return true;
      owner.flags._kannon_growth_intro_done = true;
      save();
    }
    await reflectAt("kannon");
  }
  return true;
}

/** メニューの「心得の盤」。無効なら出さない。メニューからは見るだけ（灯すのは参拝の場所。2.8） */
export const growthMenuItems = () => growthEnabled()
  ? [{ label: hidaneTotal(ensureGrowth()) ? `心得の盤（火種 ${hidaneTotal(state.growth)}）` : "心得の盤", value: "board", test: "menu-board" }] : [];

/**
 * 盤の画面を開き、閉じるまで待つ。大会の当日は開かない。
 * place を渡した時（参拝の場所での内省）だけ灯せる。渡さなければ見るだけ（目標は決められる）。
 */
export async function openGrowthBoard({ place = null } = {}) {
  if (!growthEnabled() || !state || state.phase === "tournament") return null;
  const { openBoard } = await import("../daily/growth-board-screen.js");
  return openBoard({ place });
}

// ---------------------------------------------------------------- ゲージ（6.1a）

/** 今のレベルの区間での割合。settled=濃い金（精算済み）、now=薄い金（今日の分まで）。 */
export function gaugeAt(level, settledXp, xp) {
  if (level >= MAX_LEVEL) return { level, settled: 1, now: 1, left: 0, pending: 0, overflow: 0, max: true, nextMilestone: false };
  const base = totalExpFor(level), need = expToNext(level), next = base + need;
  const ratio = (v) => Math.min(1, Math.max(0, (v - base) / need));
  return {
    level, settled: ratio(settledXp), now: ratio(xp),
    left: Math.max(0, next - xp),
    pending: levelForExp(xp) - level,
    overflow: Math.max(0, xp - next),
    max: false,
    nextMilestone: MILESTONE_LEVELS.includes(level + 1),
  };
}
export function gaugeInfo(g = state?.growth) {
  if (!g) return null;
  return gaugeAt(g.level, g.settledXp, g.xp);
}

// 自由行動の確定（paidAction）と好感度の段から呼ばれる入口を登録する。
setExpHooks({ enabled: growthEnabled, hold: holdExpChip, action: awardActionExp, recipe: awardRecipeExp, scene: awardSceneExp, affinity: awardAffinityStepExp, perks: growthPerks,
  capacityBonus: s => growthLesson(s, "M-B4") ? LESSON_TUNING.stamina : 0,
  sleepMultiplier: s => (growthSkill(s, "K03") ? 1 + SKILL_TUNING.sleep : 1)
    * (growthLesson(s, "M-S3") && s.flags?._home_lavender_sleep === `${s.chapter || 1}:${s.day}` ? 1 + LESSON_TUNING.lavenderSleep : 1) });
masteryHooks.multiplier = s => (1 + (growthPerks(s)?.tongue || 0) / 100)
  * (growthSkill(s, "K09") ? 1 + SKILL_TUNING.mastery : 1);
