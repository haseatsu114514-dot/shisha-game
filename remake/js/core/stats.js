// ステータス・好感度・体力・所持金。成長量は通知にPで出し、現在の強さは段で表す。
import { MAX_MONEY } from "./rules.js";
import { GUTS_STAMINA_BONUS } from "./stat-step-tables.js";
import { state, STAT_KEYS, STAT_JA } from "./state.js";
import { DB } from "./data.js";
import { pendingLoveStage, questionComplete } from "./affinity-stages.js";
import { emit } from "./bus.js";
import { clamp } from "./util.js";
import { conditionForRatio, STAMINA_CONDITIONS } from "./condition.js";

// ---------------------------------------------------------------- 成長ステ（5種）

/** 章キャップと周回開始値から能力ごとに決めるソフトキャップ。 */
export const CYCLE_START_CAP_MARGIN = 10;
export function statCap(key) {
  const chapterCap = { 1: 48, 2: 66, 3: 82, 4: 90, 5: 100 }[state?.chapter || 1] || 100;
  const start = state?.cycleStartStats?.[key];
  return Math.max(chapterCap, (Number.isFinite(start) ? start : 10) + CYCLE_START_CAP_MARGIN);
}

/** ★1〜5（内部値 0〜100 を 20 刻み） */
export function star(key) {
  return clamp(Math.ceil((state.stats[key] || 0) / 20), 1, 5);
}
/** 内部値から10段へ。旧セーブの端数も切り上げる。 */
export function step(key) {
  return clamp(Math.ceil((state.stats[key] || 0) / 10), 1, 10);
}
/** 1段の0から10段の1まで、効果量を9等分する。 */
export function tier01(key) {
  return (step(key) - 1) / 9;
}
export function starText(key) {
  const s = step(key);
  return "★".repeat(s) + "☆".repeat(10 - s);
}

export const RANK_LABELS = {
  technique: ["見習い", "様になってきた", "一人前", "職人肌", "神業"],
  sense: ["ふつう", "光るものがある", "冴えてる", "唯一無二", "天才肌"],
  guts: ["三日坊主", "粘り気味", "へこたれない", "不屈", "鋼メンタル"],
  charm: ["影うすい", "親しみやすい", "華がある", "目が離せない", "カリスマ"],
  insight: ["鈍め", "気が利く", "よく見てる", "見抜く目", "千里眼"],
};
export const rankLabel = (key) => RANK_LABELS[key][Math.floor((step(key) - 1) / 2)];

// 同じステへの連続加算は1枚のバナーに合算する（CLAUDE.md: statGainBatch と同じ約束）
const MERGE_MS = 700;
let batch = {};
let batchTimer = null;

/** 伸びの抽象表現（1〜2=少し／3〜4=ふつう／5〜7=かなり／8〜=大きく） */
export function gainWord(total) {
  return total >= 8 ? "大きく上がった" : total >= 5 ? "かなり上がった" : total >= 3 ? "上がった" : "少し上がった";
}

/**
 * 通常は実増加1P。スロットなどは明示したボーナスポイントを足す。
 * ★帯による減衰は廃止。章の上限と振替、旧セーブの進捗の端数は維持する。
 * 戻り値=実際に伸びたポイント。
 * @param opts.silent 通知カードを出さない（スロットのように自前で見せるとき）
 */
export function gainStat(key, amount = 1, { silent = false, excludedKeys = [] } = {}) {
  // 盤モードの成長は経験値と確定したマスだけ。旧セーブの基礎値は書き換えない。
  if (expHooks?.enabled?.()) return 0;
  if (!STAT_KEYS.includes(key) || !(amount > 0)) return 0;
  let cap = statCap(key);
  // 上限に届いた項目は、まだ伸びる項目へ振り替える（伸びている実感を保つ）
  if (state.stats[key] >= cap || excludedKeys.includes(key)) {
    const open = STAT_KEYS.filter((k) => state.stats[k] < statCap(k) && !excludedKeys.includes(k));
    if (!open.length) return 0;
    key = open[Math.floor(Math.random() * open.length)];
    cap = statCap(key);
  }
  const before = state.stats[key];
  let xp = (state.statXp[key] || 0) + amount;
  let v = before;
  while (v < cap && xp >= 1) { xp -= 1; v += 1; }
  state.statXp[key] = v >= cap ? 0 : xp;
  state.stats[key] = v;
  const got = v - before;
  if (got <= 0) return 0;
  emit("stat-raw", { key, got }); // スロットの「直前の行動で伸びたステ」の記録用
  emit("hud");
  if (silent) return got;
  const starUp = step(key) > clamp(Math.ceil(before / 10), 1, 10);
  if (batch[key]?.owner !== state) batch[key] = { owner: state, total: 0, starUp: false };
  batch[key].total += got;
  batch[key].starUp ||= starUp;
  clearTimeout(batchTimer);
  batchTimer = setTimeout(flushBatch, MERGE_MS);
  return got;
}

function flushBatch() {
  const b = batch;
  batch = {};
  for (const [key, { owner, total, starUp }] of Object.entries(b)) {
    if (owner !== state) continue;
    emit("stat-gain", { key, total, name: STAT_JA[key], word: gainWord(total), starUp, rank: rankLabel(key), star: step(key) });
  }
}

// 台本の報酬は、自由行動の終了まで預かる。先に報酬・後に消耗する誘いも同じ扱い。
// 強制イベント、レッスン、LIME、休憩など、行動の外では能力を増やさない。
export const ACTION_GROWTH_BUDGET = 2;
let earningAction = null;

// 経験値（core/growth.js）は自分をここへ登録する。stats.js からは読みに行かない（未公開の機能に依存させない）。
let expHooks = null;
export function setExpHooks(hooks) { expHooks = hooks || null; }
const growthPerks = s => expHooks?.enabled?.() ? expHooks.perks?.(s) : null;
const noop = () => {};

/** 台本・訪問・制作の成長候補。確定済み報酬用の gainStat と分ける。 */
export function earnStat(key, amount = 1) {
  if (expHooks?.enabled?.()) return;
  if (!earningAction || earningAction.owner !== state || !STAT_KEYS.includes(key) || !(amount > 0)) return;
  // 数字は育成候補の優先度に使う。台本・訪問終了の同じ能力を重複加算しない。
  earningAction.gains[key] = Math.max(earningAction.gains[key] || 0, amount);
}

/** 配合確定時の発見も、体力を使った自由行動が終わるまで預かる（家・教材・大会は対象外）。 */
export function earnRecipeDiscovery(id, { discovered = false, golden = false } = {}) {
  if (!expHooks?.enabled?.() || !earningAction || earningAction.owner !== state || typeof id !== "string" || !id) return;
  const previous = earningAction.recipes[id] || {};
  earningAction.recipes[id] = { discovered: !!(discovered || previous.discovered), golden: !!(golden || previous.golden) };
}

/** 自由行動として選んだ固有場面の完読。取消・部分再生・強制イベントは呼出し元が除外する。 */
export function earnSceneCompletion(id, owner = state) {
  if (!expHooks?.enabled?.() || owner !== state || earningAction?.owner !== owner || typeof id !== "string" || !id) return;
  earningAction.scenes.add(id);
}

/**
 * 自分で選んだ行動だけを包む。通常は1能力につき1P、誘いは主な1能力に2P。
 * @param opts.exp 経験値の対象 {key, person, place}。関数なら行動の結果から決める（core/growth.js）
 */
export async function paidAction(run, { budget = ACTION_GROWTH_BUDGET, points = 1, primary = null, consumed = () => false, exp = null } = {}) {
  const parent = earningAction;
  const action = { owner: state, gains: {}, recipes: Object.create(null), scenes: new Set(), spent: 0 };
  earningAction = action;
  const releaseChip = expHooks?.hold?.() || noop;
  let value;
  try { value = await run(); }
  catch (error) { releaseChip(); throw error; }
  finally { earningAction = parent; }
  try { return settleAction(action, parent, value, { budget, points, primary, consumed, exp }); }
  finally { releaseChip(); }
}

function settleAction(action, parent, value, { budget, points, primary, consumed, exp }) {
  if (action.owner !== state) return { value, spent: 0 };
  if (parent?.owner === state) parent.spent += action.spent;
  if (action.spent > 0 || consumed(value)) {
    expHooks?.committed?.(state);
    // 通常は最大2能力各1P。誘いはbudget=1・points=2で主な能力だけを伸ばす。
    const entries = expHooks?.enabled?.() ? [] : Object.entries(action.gains).sort((a, b) => (b[0] === primary) - (a[0] === primary) || b[1] - a[1]).slice(0, Math.max(0, Math.floor(budget)));
    const rewarded = [];
    for (const [key] of entries) {
      const before = { ...state.stats };
      gainStat(key, points, { excludedKeys: rewarded });
      for (const k of STAT_KEYS) if (state.stats[k] > before[k]) rewarded.push(k);
    }
    if (expHooks?.enabled()) {
      expHooks.action(typeof exp === "function" ? exp(value) : exp);
      for (const [id, result] of Object.entries(action.recipes)) expHooks.recipe?.(id, result);
      for (const id of action.scenes) expHooks.scene?.(id);
    }
  }
  return { value, spent: action.spent };
}

/** 正の項目は通常1Pの候補。旧版向けの報酬量は正本JSONに残す。 */
export function applyStats(obj = {}) {
  for (const [k, v] of Object.entries(obj)) earnStat(k, v);
}

// ---------------------------------------------------------------- 好感度（二層: ポイント→5段階）

export const AFFINITY_RANK_PTS = [0, 9, 20, 33, 48, 66];
export const ROMANCEABLE = ["tsumugi", "minto", "rin", "ageha", "mashiro", "hiyori", "samechan"];

// 実際に答えた既存の関係分岐。未接続キャラの条件は推測で足さない。
export const AFFINITY_GATE_CHOICES = Object.freeze({
  tsumugi: "bond_q1_tsumugi", minto: "bond_q1_minto", rin: "bond_q1_rin",
  samechan: "bond_q1_samechan", ageha: "bond_q1_ageha", mashiro: "bond_q1_mashiro",
});
const hasAffinityGate = (id) => id === "hiyori" || !!AFFINITY_GATE_CHOICES[id];
const waitingKey = (id) => `_${id}_affinity_waiting_pts`;

export function affinityGateWaiting(id) {
  if (!hasAffinityGate(id) || (state.lovers || []).includes(id)) return false;
  if (id === "hiyori") return !state.flags._hiyori_tonari_return_done;
  // 完了済みの旧関係は維持。未回答の選択肢を埋めることはしない。
  return !state.flags[`_friend_${id}`] && !state.finales?.[id]
    && !questionComplete(state, id);
}

// PR970の公開portと保存済み保留値を保ち、精算は同じ台帳へ集約する。
let storyAffinityCap = () => Infinity;
export function setStoryAffinityCap(fn) { storyAffinityCap = typeof fn === "function" ? fn : () => Infinity; }
export function releaseStoryAffinity(id) { return releaseAffinity(id); }

export function affinityLevel(id) {
  if ((state.lovers || []).includes(id)) return 5; // 恋人は好感度MAX扱い（段階は絆Lvで別に持つ）
  const pts = state.affinity[id] || 0;
  let lv = 0;
  for (let i = 1; i < AFFINITY_RANK_PTS.length; i++) if (pts >= AFFINITY_RANK_PTS[i]) lv = i;
  return lv;
}

/** 通常好感度の獲得と段階会話の既読は独立。質問・専用ルートの前提は各callerで判定する。 */
export function affinityPointCap(id) {
  return Infinity;
}

const releasedPoints = id => (Number(state.flags[`_${id}_affinity_released_pts`]) || 0)
  + (Number(state.flags[`_${id}_affinity_stage_released_pts`]) || 0);

/** 読み終えた物語の最低値保証。既存846の呼出し・端数・恋人の絆はそのまま。 */
export function ensureAffinityLevel(id, level) {
  const target = Number.isInteger(level) ? AFFINITY_RANK_PTS[level] : undefined;
  if (!id || !(target > 0) || (state.lovers || []).includes(id)) return 0;
  releaseAffinity(id);
  const before = affinityLevel(id), prevPts = state.affinity[id] || 0;
  const next = Math.max(prevPts, Math.min(target, affinityPointCap(id)));
  // 既に保留中の保証分も数えるので、再入しても積み増さない。
  const pending = Math.max(0, (state.flags[waitingKey(id)] || 0) - releasedPoints(id));
  const held = Math.max(0, target - next - pending);
  if (held) state.flags[waitingKey(id)] = (state.flags[waitingKey(id)] || 0) + held;
  if (next === prevPts) return 0;
  state.affinity[id] = next;
  queueAffinityGain({ id, level: affinityLevel(id), levelUp: affinityLevel(id) > before, prevPts, pts: next });
  return next - prevPts;
}

/** 元の獲得履歴と旧救済量を保持し、未消費分だけ解放。倍率・占い・端数は再適用しない。 */
export function releaseAffinity(id) {
  const legacyKey = `_${id}_story_waiting_pts`;
  const legacy = Math.max(0, Number(state.flags[legacyKey]) || 0);
  if (legacy) {
    state.flags[waitingKey(id)] = Math.max(Number(state.flags[waitingKey(id)]) || 0, releasedPoints(id)) + legacy;
    delete state.flags[legacyKey];
  }
  if ((state.lovers || []).includes(id)) return 0;
  const prevPts = state.affinity[id] || 0, before = affinityLevel(id);
  const held = Math.max(0, (Number(state.flags[waitingKey(id)]) || 0) - releasedPoints(id));
  const got = Math.min(held, Math.max(0, affinityPointCap(id) - prevPts));
  if (!got) return 0;
  const key = `_${id}_affinity_stage_released_pts`;
  state.flags[key] = (state.flags[key] || 0) + got;
  state.affinity[id] = prevPts + got;
  queueAffinityGain({ id, level: affinityLevel(id), levelUp: affinityLevel(id) > before, prevPts, pts: state.affinity[id] });
  return got;
}

/** 私的な絆も最初の未読段階を越えない。旧高値・loveLevelは減らさない。 */
function lovePointCap(id) {
  const level = pendingLoveStage(state, id, DB);
  return Math.max(state.lovePts[id] || 0, level && level < 5 ? AFFINITY_RANK_PTS[level + 1] - 1 : Infinity);
}
export function releaseLoveAffinity(id) {
  if (!(state.lovers || []).includes(id)) return 0;
  const key = `_${id}_love_waiting_pts`, prevPts = state.lovePts[id] || 0;
  const got = Math.min(state.flags[key] || 0, Math.max(0, lovePointCap(id) - prevPts));
  if (!got) return 0;
  state.flags[key] -= got;
  state.lovePts[id] = prevPts + got;
  const before = state.loveLevel[id] || 1;
  state.loveLevel[id] = Math.max(before, rankOf(state.lovePts[id]));
  queueAffinityGain({ id, level: state.loveLevel[id], levelUp: state.loveLevel[id] > before, prevPts, pts: state.lovePts[id], bond: true });
  return got;
}

// #320 の呼出し口と保存キーは互換のまま。
export const releaseHiyoriAffinity = () => releaseAffinity("hiyori");

const rankOf = (pts) => {
  let lv = 0;
  for (let i = 1; i < AFFINITY_RANK_PTS.length; i++) if (pts >= AFFINITY_RANK_PTS[i]) lv = i;
  return lv;
};

/** 恋人の絆はプライベート（デート・恋愛イベント・恋人とのLIME）でだけ深まる（master_spec #24） */
let privateOwner = null, privateValue = false, privateRevision = 0;
export const bond = {
  get private() { return privateOwner === state && privateValue; },
  set private(value) { privateOwner = state; privateValue = !!value; privateRevision++; },
};
/** LOAD後の旧finallyが、新しい私的会話のスコープを閉じない。
 *  スコープはスタックで管理し、入れ子・順不同の復元でも private が残留しないよう防御する（#1361）。 */
const privateScopeStack = [];
export function privateBondScope() {
  const owner = state, previous = bond.private;
  const entry = { owner, previous };
  privateScopeStack.push(entry);
  bond.private = true;
  return () => {
    const idx = privateScopeStack.indexOf(entry);
    if (idx === -1) return; // 復元済み、または陳腐化した旧finally
    privateScopeStack.splice(idx, 1);
    if (idx < privateScopeStack.length) {
      // 外側から先に閉じた: 内側の復元先を、このスコープ開始前の値へ引き継ぐ
      privateScopeStack[idx].previous = entry.previous;
      return;
    }
    // 最後に開いたスコープの復元だけが実値を戻す。所有stateが現行と異なる（LOAD済み）
    // 場合は、新しい会話のスコープを閉じないよう触らない。
    if (state === owner) bond.private = entry.previous;
  };
}

/** 普通の好感度は従来の加算量の85%（HF01）。恋人の絆は従来の半分 */
export const AFFINITY_PACE = 0.85;
export const BOND_PACE = 0.5;

// 会話のmetadata報酬と訪問終了の報酬は別々に加算される。同じ相手の通知だけを
// ステ通知と同じ時間窓で合算し、最初のハートから最後のハートまで一枚で見せる。
const affinityBatch = new Map();
let affinityBatchTimer = null;

function queueAffinityGain(payload) {
  // 自由行動の中で段が上がった分だけ経験値にする（LIME・強制イベントでは入らない。SPEC 1.1・X4）
  if (earningAction?.owner === state && expHooks?.enabled()) expHooks.affinity(payload.id, rankOf(payload.pts) - rankOf(payload.prevPts));
  const key = `${payload.id}:${!!payload.bond}`;
  const pending = affinityBatch.get(key);
  const previous = pending?.owner === state ? pending.payload : null;
  affinityBatch.set(key, {
    owner: state,
    payload: {
      ...payload,
      prevPts: previous?.prevPts ?? payload.prevPts,
      levelUp: !!(previous?.levelUp || payload.levelUp),
    },
  });
  clearTimeout(affinityBatchTimer);
  affinityBatchTimer = setTimeout(flushAffinityBatch, MERGE_MS);
}

function flushAffinityBatch() {
  const pending = [...affinityBatch.values()];
  affinityBatch.clear();
  affinityBatchTimer = null;
  // ロード・はじめからの直後に、前のセーブの通知を出さない。
  for (const { owner, payload } of pending) if (owner === state) emit("affinity-gain", payload);
}

/** 占い師に見てもらった相手と次に会ったときだけ ×1.5（一度きり） */
function fortuneMult(id) {
  if (state.fortune?.char !== id) return 1;
  delete state.fortune;
  setTimeout(() => emit("notice", { text: "（占いの効果もあってか、いつもより仲良くなれた気がする）" }), 1400);
  return 1.5;
}

/**
 * 好感度を足す。魅力★で少しだけ伸びやすい（×1.0〜1.2）。
 * 加算量は従来どおり倍率込みで四捨五入してから緩める。端数は相手ごとに持ち越すので、
 * 小さい報酬を何度足しても従来の合計を超えず、取りこぼしもしない。
 * 恋人は店で会っても深まらず、bond.private の間だけ絆ポイントに入る。
 * 告白はMAXだけでは予約しない（交友の締めくくりで恋愛を選んだ相手だけ・daily/bonds.js）。
 */
export const LIME_AFFINITY_SCALE = 0.25;

// LIMEの端数も実際に積もったときだけ、小さな返信内の通知へ渡す。
// 上限の外に保留した分は上昇として見せず、通常のハート通知と重複させない。
function reportAffinityGain(opts, payload, carryBefore, carryAfter, cap) {
  if (opts.source === "lime" && typeof opts.onGain === "function") {
    const delta = Math.min(cap, payload.pts + carryAfter) - Math.min(cap, payload.prevPts + carryBefore);
    if (delta > 1e-9) opts.onGain(delta);
  } else if (payload.pts > payload.prevPts) queueAffinityGain(payload);
}

export function gainAffinity(id, pts, opts = {}) {
  if (!id || !(pts > 0)) return;
  let mult = 1 + 0.2 * tier01("charm");
  // 旧報酬の丸めは保ち、盤の上乗せだけを端数台帳へ渡す。小さい恩恵も失わない。
  const boardRate = (growthPerks(state)?.charm || 0) / 100;
  if ((state.lovers || []).includes(id)) {
    if (!bond.private) return;
    releaseLoveAffinity(id);
    const fortune = fortuneMult(id);
    mult *= fortune;
    const prevPts = state.lovePts[id] || 0;
    // 元の加算量の半分。1ポイントの会話も2回で1となり、切り捨てて失わない。
    state.loveCarry ||= {};
    const carryBefore = state.loveCarry[id] || 0;
    const value = (Math.round(pts * mult) + pts * boardRate * fortune) * BOND_PACE + carryBefore;
    const got = Math.floor(value + 1e-9);
    state.loveCarry[id] = Math.max(0, value - got);
    const cap = lovePointCap(id);
    const applied = Math.min(got, Math.max(0, cap - prevPts));
    if (applied < got) {
      const key = `_${id}_love_waiting_pts`;
      state.flags[key] = (state.flags[key] || 0) + got - applied;
    }
    state.lovePts[id] = prevPts + applied;
    const before = state.loveLevel[id] || 1;
    const after = applied ? Math.max(before, rankOf(state.lovePts[id])) : before;
    if (applied) state.loveLevel[id] = after;
    reportAffinityGain(opts, { id, level: after, levelUp: after > before, prevPts, pts: state.lovePts[id], bond: true }, carryBefore, state.loveCarry[id], cap);
    return applied;
  }
  releaseAffinity(id);
  const fortune = fortuneMult(id);
  mult *= fortune;
  const before = affinityLevel(id);
  const prevPts = state.affinity[id] || 0;
  // 従来の加算量（倍率込みで四捨五入）の85%。旧式（pts×倍率×0.85）は1〜2ptの報酬で従来より増えていた
  state.affinityCarry ||= {};
  // LIME返信のみ、整数丸めの後・端数繰り越しの前に倍率を掛ける（丸めで0にならず微量が累積する）
  const scale = opts.source === "lime" ? LIME_AFFINITY_SCALE : 1;
  const carryBefore = state.affinityCarry[id] || 0;
  const value = (Math.round(pts * mult) + pts * boardRate * fortune) * AFFINITY_PACE * scale + (state.affinityCarry[id] || 0);
  const got = Math.floor(value + 1e-9);
  state.affinityCarry[id] = Math.max(0, value - got);
  const cap = affinityPointCap(id);
  const applied = Math.min(got, Math.max(0, cap - prevPts));

  if (applied < got) state.flags[waitingKey(id)] = (state.flags[waitingKey(id)] || 0) + got - applied;
  state.affinity[id] = prevPts + applied;
  const after = affinityLevel(id);
  reportAffinityGain(opts, { id, level: after, levelUp: after > before, prevPts, pts: state.affinity[id] }, carryBefore, state.affinityCarry[id], cap);
  return applied;
}

// ---------------------------------------------------------------- 体力

export const STAMINA_LOW = 25;

export function maxStamina({ forCondition = false } = {}) {
  // 盤の容量増加だけで体調や発病リスクを悪化させない。ゲージの容量と体調の基準を分ける。
  return 100 + GUTS_STAMINA_BONUS[step("guts") - 1] + (forCondition ? 0 : (growthPerks(state)?.stamina || 0)
    + (expHooks?.enabled?.() ? expHooks.capacityBonus?.(state) || 0 : 0));
}

export function addStamina(n, { sleep = false } = {}) {
  const before = state.stamina;
  const maximum = maxStamina();
  const amount = sleep && n > 0 ? n * (1 + (growthPerks(state)?.sleep || 0) / 100)
    * (expHooks?.enabled?.() ? expHooks.sleepMultiplier?.(state) || 1 : 1) : n;
  state.stamina = staminaAfter(amount);
  if (earningAction?.owner === state && state.stamina < before) earningAction.spent += before - state.stamina;
  if (state.stamina !== before) emit("stamina-change", { before, after: state.stamina, maximum });
  emit("hud");
  return state.stamina - before;
}

/** 行動前の警告にも、実際の消耗と同じ根性補正・丸め・最大値を使う。 */
export function staminaAfter(n) {
  const d = n < 0 ? n * (1 - 0.25 * tier01("guts")) : n;
  return clamp(Math.round(state.stamina + d), 0, maxStamina());
}

export const staminaRatio = ({ forCondition = false } = {}) => state.stamina / maxStamina({ forCondition });
export const currentCondition = () => {
  const sick = state.restDay;
  return sick?.chapter === state.chapter && sick.day === state.day && STAMINA_CONDITIONS[sick.illnessHealth]
    || conditionForRatio(staminaRatio({ forCondition: true }));
};

// ---------------------------------------------------------------- お金

export function addMoney(n) {
  const before = state.money;
  state.money = Math.min(MAX_MONEY, Math.max(0, Math.round(before + n)));
  emit("money", { delta: state.money - before });
  emit("hud");
}
