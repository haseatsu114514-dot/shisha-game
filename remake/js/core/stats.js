// ステータス・好感度・体力・所持金。数値はプレイヤーに見せない（★と抽象語だけ）。
import { state, STAT_KEYS, STAT_JA } from "./state.js";
import { emit } from "./bus.js";
import { clamp } from "./util.js";

// ---------------------------------------------------------------- 成長ステ（5種）

/** 章ごとのソフトキャップ（ch1で上限に張り付かない・ch5で全100を狙える） */
export function statCap() {
  return { 1: 48, 2: 66, 3: 82, 4: 96, 5: 100 }[state?.chapter || 1] || 100;
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

// ★帯が上がるほど +1 に必要な経験値が重くなる（★1帯=1 … ★5帯=4）
const TIER_COST = [1, 1.5, 2, 3, 4];
const costAt = (v) => TIER_COST[clamp(Math.ceil(v / 20) - 1, 0, 4)];

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
 * ステを伸ばす（経験値として足し、★段階ごとの伸びにくさと章の上限を通す）。戻り値=実際に伸びたポイント
 * @param opts.silent 通知カードを出さない（スロットのように自前で見せるとき）
 */
export function gainStat(key, amount, { silent = false } = {}) {
  if (!STAT_KEYS.includes(key) || !(amount > 0)) return 0;
  const cap = statCap();
  // 上限に届いた項目は、まだ伸びる項目へ振り替える（伸びている実感を保つ）
  if (state.stats[key] >= cap) {
    const open = STAT_KEYS.filter((k) => state.stats[k] < cap);
    if (!open.length) return 0;
    key = open[Math.floor(Math.random() * open.length)];
  }
  const before = state.stats[key];
  let xp = (state.statXp[key] || 0) + amount;
  let v = before;
  while (v < cap && xp >= costAt(v)) { xp -= costAt(v); v += 1; }
  state.statXp[key] = v >= cap ? 0 : xp;
  state.stats[key] = v;
  const got = v - before;
  if (got <= 0) return 0;
  emit("stat-raw", { key, got }); // スロットの「直前の行動で伸びたステ」の記録用
  if (silent) return got;
  const starUp = Math.ceil(v / 20) > Math.ceil(before / 20);
  batch[key] = batch[key] || { total: 0, starUp: false };
  batch[key].total += got;
  batch[key].starUp ||= starUp;
  clearTimeout(batchTimer);
  batchTimer = setTimeout(flushBatch, MERGE_MS);
  return got;
}

function flushBatch() {
  const b = batch;
  batch = {};
  for (const [key, { total, starUp }] of Object.entries(b)) {
    emit("stat-gain", { key, name: STAT_JA[key], word: gainWord(total), starUp, rank: rankLabel(key), star: star(key) });
  }
}

/** 報酬オブジェクト {technique:2, ...} をまとめて適用 */
export function applyStats(obj = {}) {
  for (const [k, v] of Object.entries(obj)) gainStat(k, v);
}

// ---------------------------------------------------------------- 好感度（二層: ポイント→5段階）

export const AFFINITY_RANK_PTS = [0, 9, 20, 33, 48, 66];
export const ROMANCEABLE = ["tsumugi", "minto", "rin", "ageha"];

export function affinityLevel(id) {
  if ((state.lovers || []).includes(id)) return 5; // 恋人は好感度MAX扱い（段階は絆Lvで別に持つ）
  const pts = state.affinity[id] || 0;
  let lv = 0;
  for (let i = 1; i < AFFINITY_RANK_PTS.length; i++) if (pts >= AFFINITY_RANK_PTS[i]) lv = i;
  return lv;
}

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
    emit("affinity-gain", { id, level: after, levelUp: after > before, prevPts, pts: state.lovePts[id], bond: true });
    return got;
  }
  mult *= fortuneMult(id);
  const before = affinityLevel(id);
  const prevPts = state.affinity[id] || 0;
  // 従来の加算量（倍率込みで四捨五入）の85%。旧式（pts×倍率×0.85）は1〜2ptの報酬で従来より増えていた
  state.affinityCarry ||= {};
  const value = Math.round(pts * mult) * AFFINITY_PACE + (state.affinityCarry[id] || 0);
  const got = Math.floor(value + 1e-9);
  state.affinityCarry[id] = Math.max(0, value - got);
  state.affinity[id] = prevPts + got;
  if (!got) return 0;
  const after = affinityLevel(id);
  emit("affinity-gain", { id, level: after, levelUp: after > before, prevPts, pts: state.affinity[id] });
  return got;
}

// ---------------------------------------------------------------- 体力

const GUTS_STAMINA_BONUS = [0, 10, 25, 40, 60];
export const STAMINA_LOW = 25;

export function maxStamina() {
  return 100 + GUTS_STAMINA_BONUS[star("guts") - 1];
}

export function addStamina(n) {
  // 根性★で消耗が少し軽くなる（最大 -25%）
  const d = n < 0 ? n * (1 - 0.25 * tier01("guts")) : n;
  const before = state.stamina;
  const maximum = maxStamina();
  state.stamina = clamp(Math.round(state.stamina + d), 0, maximum);
  if (state.stamina !== before) emit("stamina-change", { before, after: state.stamina, maximum });
  emit("hud");
  return state.stamina - before;
}

export const staminaRatio = () => state.stamina / maxStamina();

// ---------------------------------------------------------------- お金

export function addMoney(n) {
  state.money = Math.max(0, Math.round(state.money + n));
  emit("money", { delta: n });
  emit("hud");
}
