// 経験値・レベル・火種（心得の盤 第二弾の芯。docs/stat-design/SPEC.md 1章・6.1a・6.3）。
// 盤の画面ができるまでは GROWTH_BOARD=false の裏に置き、プレイヤーには旧しくみだけが見える。
// 開発中は URL の ?growth=1（または __remake.dev.growth(true)）でこの端末だけ有効にできる。
// 有効でも能力の伸び方（旧しくみ）は変えない。経験値・レベル・火種を横で数えるだけ。
import { state, STAT_KEYS } from "./state.js";
import { emit } from "./bus.js";
import { setExpHooks } from "./stats.js";

export const GROWTH_BOARD = false;
const PREVIEW_KEY = "suien_growth_preview";

export function growthEnabled() {
  if (GROWTH_BOARD) return true;
  try { return globalThis.localStorage?.getItem(PREVIEW_KEY) === "1"; } catch { return false; }
}
export function setGrowthPreview(on) {
  try {
    if (on) globalThis.localStorage?.setItem(PREVIEW_KEY, "1");
    else globalThis.localStorage?.removeItem?.(PREVIEW_KEY);
  } catch { /* 保存できない環境では今回の起動だけ無効のまま */ }
  emit("hud");
}

// ---------------------------------------------------------------- 数値（SPEC 1.2〜1.5）

export const MAX_LEVEL = 80;
export const BOARD_TOTAL = 86; // 盤の全部。これ以上の火種は渡さない（5.5「盤は埋まった」）
export const MILESTONE_LEVELS = [10, 20, 30, 40, 50, 60, 70];
export const CHAPTER_MULT = { 1: 1, 2: 1.25, 3: 1.5, 4: 1.75, 5: 2 };
export const EXP = { action: 30, firstPerson: 40, firstPlace: 40, affinityStep: 30 };
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

export const HIDANE_KEYS = ["any", ...STAT_KEYS];

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
    today: { xp: 0, learned: {} },     // 寝る時までの分。learned は鍵 -> 経験値（「今日学んだこと」）
    seen: { fullLevelUp: false },      // フル演出を一度見たか（初回の判定）
    nodes: [],             // 盤で解放したノードID（確定済みだけ。HUB は数えない）
    paid: {},              // ノードID -> 払った火種 { any: n, technique: n, … }（組み直しで同じ種類に戻す）
  };
}

const num = (v, min = 0) => Number.isFinite(v) && v >= min ? v : min;
const strings = (list) => [...new Set((Array.isArray(list) ? list : []).filter((v) => typeof v === "string" && v))];

/** 有効なときだけ呼ぶ。壊れた値は既定値に戻し、累計と精算済みの順を保つ。 */
export function ensureGrowth(s = state) {
  if (!s) return null;
  const fresh = newGrowth();
  const g = s.growth && typeof s.growth === "object" && !Array.isArray(s.growth) ? s.growth : (s.growth = fresh);
  g.xp = Math.min(num(g.xp), totalExpFor(MAX_LEVEL));
  g.level = Math.min(levelForExp(g.xp), Math.max(1, Math.floor(num(g.level, 1))));
  g.settledXp = Math.min(g.xp, Math.max(num(g.settledXp), totalExpFor(g.level)));
  g.hidane = Object.fromEntries(HIDANE_KEYS.map((k) => [k, Math.floor(num(g.hidane?.[k]))]));
  g.earned = Math.floor(num(g.earned));
  g.milestones = (Array.isArray(g.milestones) ? g.milestones : []).filter((l) => MILESTONE_LEVELS.includes(l));
  if (!g.fresh || typeof g.fresh !== "object") g.fresh = fresh.fresh;
  if (!g.fresh.counts || typeof g.fresh.counts !== "object") g.fresh.counts = {};
  g.firsts = { people: strings(g.firsts?.people), places: strings(g.firsts?.places) };
  if (!g.today || typeof g.today !== "object") g.today = fresh.today;
  g.today.xp = num(g.today.xp);
  if (!g.today.learned || typeof g.today.learned !== "object") g.today.learned = {};
  g.seen = { fullLevelUp: g.seen?.fullLevelUp === true };
  g.nodes = strings(g.nodes);
  if (!g.paid || typeof g.paid !== "object" || Array.isArray(g.paid)) g.paid = {};
  return g;
}

export const hidaneTotal = (g = state?.growth) => g ? HIDANE_KEYS.reduce((n, k) => n + (g.hidane?.[k] || 0), 0) : 0;
export const pendingLevels = (g = state?.growth) => g ? levelForExp(g.xp) - g.level : 0;

// ---------------------------------------------------------------- 通知チップ（1行動につき1枚・REPORT R7）

const MERGE_MS = 700;
let chip = null;
let chipTimer = null;
let holdDepth = 0;

function addToChip(amount, tag) {
  if (chip?.owner !== state) chip = { owner: state, total: 0, tags: [] };
  chip.total += amount;
  if (tag && !chip.tags.includes(tag)) chip.tags.push(tag);
  clearTimeout(chipTimer);
  if (!holdDepth) chipTimer = setTimeout(flushChip, MERGE_MS);
}
function flushChip() {
  clearTimeout(chipTimer);
  const c = chip;
  chip = null;
  if (!c || c.owner !== state || !(c.total > 0)) return;
  emit("exp-gain", { total: c.total, tags: c.tags });
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
export function gainExp(base, { key = null, tag = null } = {}) {
  if (!growthEnabled() || !state || !(base > 0)) return 0;
  const g = ensureGrowth();
  const room = totalExpFor(MAX_LEVEL) - g.xp;
  const amount = Math.min(room, Math.round(base * (CHAPTER_MULT[state.chapter] || 1)));
  if (!(amount > 0)) return 0;
  g.xp += amount;
  g.today.xp += amount;
  if (key) g.today.learned[key] = (g.today.learned[key] || 0) + amount;
  addToChip(amount, tag);
  emit("hud");
  return amount;
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
  let got = gainExp(EXP.action * freshness(count), { key: target.key, tag: count >= 3 ? "なじみ" : null });
  if (target.person && !g.firsts.people.includes(target.person)) {
    g.firsts.people.push(target.person);
    got += gainExp(EXP.firstPerson, { key: target.key, tag: "はじめて" });
  }
  if (target.place && !g.firsts.places.includes(target.place)) {
    g.firsts.places.push(target.place);
    got += gainExp(EXP.firstPlace, { key: target.key, tag: "はじめて" });
  }
  return got;
}

/** 好感度・恋人の絆の段が上がった（X4）。段ごとに +30。 */
export function awardAffinityStepExp(id, steps) {
  if (!(steps > 0)) return 0;
  return gainExp(EXP.affinityStep * steps, { key: id, tag: "仲が深まった" });
}

// ---------------------------------------------------------------- 寝る時の精算（6.3）

/** 節目の2つ目の系統。盤ができるまでは「振った系統」が無いので、一番段の低い系統（1.9 の規則の末尾）。 */
export function milestoneSystem(stats = state.stats) {
  const step = (k) => Math.min(10, Math.max(1, Math.ceil((stats?.[k] || 0) / 10)));
  return STAT_KEYS.reduce((best, k) => step(k) < step(best) ? k : best, STAT_KEYS[0]);
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
    if (g.earned < BOARD_TOTAL) { g.hidane.any++; g.earned++; gains.any++; }
    if (MILESTONE_LEVELS.includes(level) && !g.milestones.includes(level)) {
      g.milestones.push(level);
      if (g.earned < BOARD_TOTAL) {
        const system = milestoneSystem();
        g.hidane[system]++; g.earned++;
        gains.limited.push({ level, system });
      }
    }
  }
  g.level = to;
  g.settledXp = g.xp;
  g.today = { xp: 0, learned: {} };
  if (to > from) emit("hud");
  const milestone = gains.limited.length > 0 || MILESTONE_LEVELS.some((l) => l > from && l <= to);
  const full = to > from && (!g.seen.fullLevelUp || milestone || to - from >= 2);
  if (full) g.seen.fullLevelUp = true;
  return { from, to, xpFrom, xpTo: g.xp, gains, learned, milestone, full, boardFull: g.earned >= BOARD_TOTAL };
}

/** 寝る直前の精算と演出。無効のときは何もしない（演出の画面は使う時だけ読む）。 */
export async function presentNight() {
  if (!growthEnabled()) return null;
  const { presentNightGrowth } = await import("../daily/levelup.js");
  return presentNightGrowth();
}

/** メニューの「心得の盤」。無効なら出さない。 */
export const growthMenuItems = () => growthEnabled()
  ? [{ label: hidaneTotal(ensureGrowth()) ? `心得の盤（火種 ${hidaneTotal(state.growth)}）` : "心得の盤", value: "board", test: "menu-board" }] : [];

/** 盤の画面を開き、閉じるまで待つ。大会の当日は開かない（2.2）。 */
export async function openGrowthBoard() {
  if (!growthEnabled() || !state || state.phase === "tournament") return null;
  const { openBoard } = await import("../daily/growth-board-screen.js");
  return openBoard();
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
setExpHooks({ enabled: growthEnabled, hold: holdExpChip, action: awardActionExp, affinity: awardAffinityStepExp });
