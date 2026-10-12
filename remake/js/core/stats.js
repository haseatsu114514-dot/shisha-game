// ステータス・好感度・体力・所持金。成長量は通知にPで出し、現在の強さは★で表す。
import { MAX_MONEY } from "./rules.js";
import { state, STAT_KEYS, STAT_JA } from "./state.js";
import { emit } from "./bus.js";
import { clamp } from "./util.js";
import { conditionForRatio } from "./condition.js";

// ---------------------------------------------------------------- 成長ステ（5種）

/** 章ごとのソフトキャップ（ch1で上限に張り付かない・ch5で全100を狙える） */
export function statCap() {
  return { 1: 48, 2: 66, 3: 82, 4: 90, 5: 100 }[state?.chapter || 1] || 100;
}

/** ★1〜5（内部値 0〜100 を 20 刻み） */
export function star(key) {
  return clamp(Math.ceil((state.stats[key] || 0) / 20), 1, 5);
}
/** 0（★1）〜1（★5）。効果量は ★ 刻みで効く（連続値にしない） */
export function tier01(key) {
  return (star(key) - 1) / 4;
}
export function starText(key) {
  const s = star(key);
  return "★".repeat(s) + "☆".repeat(5 - s);
}

export const RANK_LABELS = {
  technique: ["見習い", "様になってきた", "一人前", "職人肌", "神業"],
  sense: ["ふつう", "光るものがある", "冴えてる", "唯一無二", "天才肌"],
  guts: ["三日坊主", "粘り気味", "へこたれない", "不屈", "鋼メンタル"],
  charm: ["影うすい", "親しみやすい", "華がある", "目が離せない", "カリスマ"],
  insight: ["鈍め", "気が利く", "よく見てる", "見抜く目", "千里眼"],
};
export const rankLabel = (key) => RANK_LABELS[key][star(key) - 1];

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
  if (!STAT_KEYS.includes(key) || !(amount > 0)) return 0;
  const cap = statCap();
  // 上限に届いた項目は、まだ伸びる項目へ振り替える（伸びている実感を保つ）
  if (state.stats[key] >= cap || excludedKeys.includes(key)) {
    const open = STAT_KEYS.filter((k) => state.stats[k] < cap && !excludedKeys.includes(k));
    if (!open.length) return 0;
    key = open[Math.floor(Math.random() * open.length)];
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
  const starUp = star(key) > clamp(Math.ceil(before / 20), 1, 5);
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
    emit("stat-gain", { key, total, name: STAT_JA[key], word: gainWord(total), starUp, rank: rankLabel(key), star: star(key) });
  }
}

// 台本の報酬は、自由行動の終了まで預かる。先に報酬・後に消耗する誘いも同じ扱い。
// 強制イベント、レッスン、LIME、休憩など、行動の外では能力を増やさない。
export const ACTION_GROWTH_BUDGET = 2;
let earningAction = null;

/** 台本・訪問・制作の成長候補。確定済み報酬用の gainStat と分ける。 */
export function earnStat(key, amount = 1) {
  if (!earningAction || earningAction.owner !== state || !STAT_KEYS.includes(key) || !(amount > 0)) return;
  // 数字は育成候補の優先度に使う。台本・訪問終了の同じ能力を重複加算しない。
  earningAction.gains[key] = Math.max(earningAction.gains[key] || 0, amount);
}

/** 自分で選んだ行動だけを包む。通常は1能力につき1P、誘いは主な1能力に2P。 */
export async function paidAction(run, { budget = ACTION_GROWTH_BUDGET, points = 1, primary = null } = {}) {
  const parent = earningAction;
  const action = { owner: state, gains: {}, spent: 0 };
  earningAction = action;
  let value;
  try { value = await run(); }
  finally { earningAction = parent; }
  if (action.owner !== state) return { value, spent: 0 };
  if (parent?.owner === state) parent.spent += action.spent;
  if (action.spent > 0) {
    // 通常は最大2能力各1P。誘いはbudget=1・points=2で主な能力だけを伸ばす。
    const entries = Object.entries(action.gains).sort((a, b) => (b[0] === primary) - (a[0] === primary) || b[1] - a[1]).slice(0, Math.max(0, Math.floor(budget)));
    const rewarded = [];
    for (const [key] of entries) {
      const before = { ...state.stats };
      gainStat(key, points, { excludedKeys: rewarded });
      for (const k of STAT_KEYS) if (state.stats[k] > before[k]) rewarded.push(k);
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
export const ROMANCEABLE = ["tsumugi", "minto", "rin", "ageha", "hiyori", "kafuka"];

// 実際に答えた既存の関係分岐。未接続キャラの条件は推測で足さない。
export const AFFINITY_GATE_CHOICES = Object.freeze({
  tsumugi: "bond_q1_tsumugi", minto: "bond_q1_minto", rin: "bond_q1_rin",
  kafuka: "bond_q1_kafuka",
});
const hasAffinityGate = (id) => id === "hiyori" || !!AFFINITY_GATE_CHOICES[id];
const waitingKey = (id) => `_${id}_affinity_waiting_pts`;

export function affinityGateWaiting(id) {
  if (!hasAffinityGate(id) || (state.lovers || []).includes(id)) return false;
  if (id === "hiyori") return !state.flags._hiyori_tonari_return_done;
  // 完了済みの旧関係は維持。未回答の選択肢を埋めることはしない。
  return !state.flags[`_friend_${id}`] && !state.finales?.[id]
    && !state.romanceChoices?.[AFFINITY_GATE_CHOICES[id]];
}

export function affinityLevel(id) {
  if ((state.lovers || []).includes(id)) return 5; // 恋人は好感度MAX扱い（段階は絆Lvで別に持つ）
  const pts = state.affinity[id] || 0;
  let lv = 0;
  for (let i = 1; i < AFFINITY_RANK_PTS.length; i++) if (pts >= AFFINITY_RANK_PTS[i]) lv = i;
  return lv;
}

/** 読み終えた物語の節目で最低限の親しさを保証する。既存の好感度・端数・恋人の絆は減らさない。 */
export function ensureAffinityLevel(id, level) {
  let target = Number.isInteger(level) ? AFFINITY_RANK_PTS[level] : undefined;
  if (!id || !(target > 0) || (state.lovers || []).includes(id)) return 0;
  releaseAffinity(id);
  const before = affinityLevel(id);
  const prevPts = state.affinity[id] || 0;
  if (affinityGateWaiting(id) && target > Math.max(prevPts, AFFINITY_RANK_PTS[3])) {
    const cap = Math.max(prevPts, AFFINITY_RANK_PTS[3]);
    // 最低値の保証を何度呼んでも、同じ保証分を積み増さない。
    state.flags[waitingKey(id)] = Math.max(state.flags[waitingKey(id)] || 0, target - cap);
    target = cap;
  }
  if (prevPts >= target) return 0;
  state.affinity[id] = target;
  queueAffinityGain({ id, level: affinityLevel(id), levelUp: affinityLevel(id) > before, prevPts, pts: target });
  return target - prevPts;
}

/** 待っていた実獲得量を、既存イベントの後に一度だけ・次のハートまで救済する。 */
export function releaseAffinity(id) {
  const releasedKey = `_${id}_affinity_waiting_released`;
  if (id === "hiyori" && !state.flags._hiyori_tonari_return_done) return 0;
  if (!hasAffinityGate(id) || affinityGateWaiting(id) || state.flags[releasedKey]) return 0;
  state.flags[releasedKey] = true;
  if ((state.lovers || []).includes(id)) return 0;
  const prevPts = state.affinity[id] || 0;
  const before = affinityLevel(id);
  const next = AFFINITY_RANK_PTS[before + 1] ?? prevPts;
  const got = Math.min(Math.max(0, Number(state.flags[waitingKey(id)]) || 0),
    AFFINITY_RANK_PTS[4] - AFFINITY_RANK_PTS[3], Math.max(0, next - prevPts));
  // 元の獲得記録は残す。倍率・占い・端数処理をもう一度かけない。
  state.flags[`_${id}_affinity_released_pts`] = got;
  if (!got) return 0;
  state.affinity[id] = prevPts + got;
  queueAffinityGain({ id, level: affinityLevel(id), levelUp: affinityLevel(id) > before,
    prevPts, pts: state.affinity[id] });
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
export const bond = { private: false };

/** 普通の好感度は従来の加算量の85%（HF01）。恋人の絆は従来の半分 */
export const AFFINITY_PACE = 0.85;
export const BOND_PACE = 0.5;

// 会話のmetadata報酬と訪問終了の報酬は別々に加算される。同じ相手の通知だけを
// ステ通知と同じ時間窓で合算し、最初のハートから最後のハートまで一枚で見せる。
const affinityBatch = new Map();
let affinityBatchTimer = null;

function queueAffinityGain(payload) {
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
export function gainAffinity(id, pts) {
  if (!id || !(pts > 0)) return;
  let mult = 1 + 0.2 * tier01("charm");
  if ((state.lovers || []).includes(id)) {
    if (!bond.private) return;
    mult *= fortuneMult(id);
    const prevPts = state.lovePts[id] || 0;
    // 元の加算量の半分。1ポイントの会話も2回で1となり、切り捨てて失わない。
    state.loveCarry ||= {};
    const value = Math.round(pts * mult) * BOND_PACE + (state.loveCarry[id] || 0);
    const got = Math.floor(value + 1e-9);
    state.loveCarry[id] = Math.max(0, value - got);
    state.lovePts[id] = prevPts + got;
    if (!got) return 0;
    const before = state.loveLevel[id] || 1;
    const after = Math.max(before, rankOf(state.lovePts[id]));
    state.loveLevel[id] = after;
    queueAffinityGain({ id, level: after, levelUp: after > before, prevPts, pts: state.lovePts[id], bond: true });
    return got;
  }
  releaseAffinity(id);
  mult *= fortuneMult(id);
  const before = affinityLevel(id);
  const prevPts = state.affinity[id] || 0;
  // 従来の加算量（倍率込みで四捨五入）の85%。旧式（pts×倍率×0.85）は1〜2ptの報酬で従来より増えていた
  state.affinityCarry ||= {};
  const value = Math.round(pts * mult) * AFFINITY_PACE + (state.affinityCarry[id] || 0);
  const got = Math.floor(value + 1e-9);
  state.affinityCarry[id] = Math.max(0, value - got);
  const applied = affinityGateWaiting(id) ? Math.min(got, Math.max(0, AFFINITY_RANK_PTS[3] - prevPts)) : got;
  if (applied < got) state.flags[waitingKey(id)] = (state.flags[waitingKey(id)] || 0) + got - applied;
  state.affinity[id] = prevPts + applied;
  if (!applied) return 0;
  const after = affinityLevel(id);
  queueAffinityGain({ id, level: after, levelUp: after > before, prevPts, pts: state.affinity[id] });
  return applied;
}

// ---------------------------------------------------------------- 体力

const GUTS_STAMINA_BONUS = [0, 10, 25, 40, 60];
export const STAMINA_LOW = 25;

export function maxStamina() {
  return 100 + GUTS_STAMINA_BONUS[star("guts") - 1];
}

export function addStamina(n) {
  const before = state.stamina;
  const maximum = maxStamina();
  state.stamina = staminaAfter(n);
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

export const staminaRatio = () => state.stamina / maxStamina();
export const currentCondition = () => conditionForRatio(staminaRatio());

// ---------------------------------------------------------------- お金

export function addMoney(n) {
  const before = state.money;
  state.money = Math.min(MAX_MONEY, Math.max(0, Math.round(before + n)));
  emit("money", { delta: state.money - before });
  emit("hud");
}
