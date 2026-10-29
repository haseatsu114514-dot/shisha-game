// 心得の盤のデータと解放の規則（SPEC 2章・3.7・6.2）。画面は daily/growth-board-screen.js。
// 盤の形はここだけが持つ。配置（座標）は描画側が輪・扇から計算する。
// まだ GROWTH_BOARD の裏の試作: 盤の解放は state.stats に書き戻さない（旧しくみの能力はそのまま）。
import { state, STAT_KEYS, STAT_JA } from "./state.js";
import { ensureGrowth, HIDANE_KEYS } from "./growth.js";

/** 扇の並び（時計回り、上から）: 技術 → センス → 洞察 → 魅力 → 根性（2.1） */
export const SECTORS = ["technique", "sense", "insight", "charm", "guts"];
export const STAT_HEAD = { technique: "技", sense: "感", guts: "根", charm: "魅", insight: "察" };
const PREFIX = { technique: "T", sense: "S", guts: "G", charm: "C", insight: "I" };
/** その段が属する輪（第1輪で5段まで、第2輪で7段、第3輪8段、第4輪9段、第5輪10段） */
export const ringOfStep = (step) => step <= 5 ? 1 : step <= 7 ? 2 : step - 5;
export const RING_MAX_STEP = { 1: 5, 2: 7, 3: 8, 4: 9, 5: 10 };

// 段ごとの言葉（3.7。数値は出さない）
export const STEP_TEXT = {
  technique: ["まだゲージは速い", "ゲージがほんの少しゆっくりに", "ゲージが少しゆっくりに", "ゲージがゆっくりに", "ゲージがだいぶゆっくりに", "ゲージがかなりゆっくりに", "針の動きがよく見える", "ゲージがとてもゆっくりに", "ほとんど止まって見える", "ゲージが最もゆっくりに"],
  sense: ["ジャスト帯は狭め", "ジャスト帯がほんの少し広く", "ジャスト帯が少し広く", "ジャスト帯が広く", "ジャスト帯がだいぶ広く", "ジャスト帯がかなり広く", "いい瞬間を掴みやすい", "ジャスト帯がとても広く", "外す方が難しい", "ジャスト帯が最も広く"],
  guts: ["体力はふつう・小さな範囲の弾を消す", "体力が少し増えた", "体力が増え、弾消しの範囲が広がった", "疲れにくくなった", "弾消しでメンタルも回復する", "体力と範囲が大きく増えた", "弾消しがかなり広い", "一日中動いてもへこたれない", "体力ほぼ最大・弾消しがとても広い", "体力最大・画面全体の弾消し"],
  charm: ["指名ボーナスはまだなし", "指名ボーナスが少しつく", "指名ボーナス＋少し好かれやすく", "指名が増えてきた", "指名ボーナス増・好かれやすい", "常連に覚えられてきた", "指名ボーナス大", "好かれやすい", "指名が途切れない", "指名ボーナス最大"],
  insight: ["配合も炭も、まだ勘だのみ", "炭の気配がかすかに分かる", "配合の相性ヒントが出るように", "蒸らしの弾が少し減った", "黄金比まで何を足すか分かる", "炭の気配に早めに気づける", "蒸らしの読みが当たってきた", "熱の読み違いがかなり減った", "炭も配合も、ほとんど読める", "読めるものは全部読める"],
};
/** 効く工程（6.2 の効果プレビュー・能力欄の説明） */
export const STAT_WHERE = {
  technique: "穴あけ・吸い出しのゲージ",
  sense: "穴あけ・炭焼き・吸い出しのジャスト帯",
  guts: "体力・蒸らしの当たり判定とリフレッシュ",
  charm: "バイトの指名ボーナス・好かれやすさ",
  insight: "配合のヒント・炭の気配・蒸らしの予測",
};
/** 質が変わる段（✦）。新しくできることが増える段だけ（REPORT P1・R3） */
export const QUALITY_STEPS = {
  guts: { 5: "弾消しでメンタルも回復" },
  insight: { 3: "配合の相性ヒント", 5: "黄金比まで何を足すか分かる" },
  charm: { 2: "指名ボーナスがつく" },
};
// ランク名は2段ずつ同じ（3.8。core/stats.js の RANK_LABELS と同じ並び）
const RANKS = {
  technique: ["見習い", "様になってきた", "一人前", "職人肌", "神業"],
  sense: ["ふつう", "光るものがある", "冴えてる", "唯一無二", "天才肌"],
  guts: ["三日坊主", "粘り気味", "へこたれない", "不屈", "鋼メンタル"],
  charm: ["影うすい", "親しみやすい", "華がある", "目が離せない", "カリスマ"],
  insight: ["鈍め", "気が利く", "よく見てる", "見抜く目", "千里眼"],
};
export const rankOfStep = (stat, step) => RANKS[stat][Math.min(4, Math.floor((step - 1) / 2))];

/** スキル14個（2.5）。効果の実装は後続（B14〜B16）。ここは名前・色・輪・コストと、画面の説明だけ。 */
export const SKILLS = [
  { id: "K01", key: "dandori", name: "段取り八分", colors: ["technique"], ring: 1, cost: 2, scene: "制作（穴あけ）", text: "穴あけの制限時間が少し延びる" },
  { id: "K02", key: "kaori", name: "香りの記憶", colors: ["sense"], ring: 1, cost: 2, scene: "制作（配合）", text: "前回の配合やレシピ帳の配合を1回で呼び出せる（黄金比の答えは出ない）" },
  { id: "K03", key: "hayane", name: "早寝早起き", colors: ["guts"], ring: 1, cost: 2, scene: "日常", text: "ふつうに眠ったときの体力の回復が増える" },
  { id: "K04", key: "hitomishiri", name: "人見知りしない", colors: ["charm"], ring: 1, cost: 2, scene: "日常", text: "はじめての相手・場所・場面で入る経験値が増える" },
  { id: "K05", key: "soramoyou", name: "空模様", colors: ["insight"], ring: 1, cost: 2, scene: "日常", text: "地図と朝の画面で明日の天気が分かる" },
  { id: "K06", key: "nimaime", name: "二枚目のリフレッシュ", colors: ["guts"], ring: 2, cost: 3, scene: "制作（蒸らし）", text: "蒸らしのリフレッシュを2回使える（2回目は範囲が半分）" },
  { id: "K07", key: "kuuki", name: "空気を読む", colors: ["charm", "insight"], ring: 2, cost: 3, scene: "日常", text: "会話で、仲が深まる選択肢に小さな印が出る（告白や大事な場面では出ない）" },
  { id: "K08", key: "tsukare", name: "疲れ知らず", colors: ["technique"], ring: 3, cost: 3, scene: "制作（炭焼き・吸い出し）", text: "長く作っても、疲れで手元が崩れにくくなる" },
  { id: "K09", key: "jukuren", name: "熟練の舌", colors: ["sense"], ring: 3, cost: 3, scene: "制作・家シーシャ", text: "フレーバーの熟練度が早く育つ" },
  { id: "K10", key: "shinsain", name: "審査員の目", colors: ["insight"], ring: 3, cost: 3, scene: "大会", text: "大会の各工程のあとに、審査員の受け止めが分かる" },
  { id: "K11", key: "hinoban", name: "火の番", colors: ["technique", "sense"], ring: 4, cost: 4, scene: "制作（熱管理）", text: "熱管理で炭を替えるときのジャストの幅が広がる" },
  { id: "K12", key: "tanryoku", name: "大一番の胆力", colors: ["guts"], ring: 4, cost: 4, scene: "大会", text: "大会本番の一台だけ、体調を1段良く扱う" },
  { id: "K13", key: "seien", name: "声援", colors: ["charm"], ring: 4, cost: 4, scene: "大会", text: "大会の蒸らしでリフレッシュを使うと、メンタルが1段回復する" },
  { id: "K14", key: "suminokoe", name: "炭の声", colors: ["insight"], ring: 4, cost: 4, scene: "制作（蒸らし）", text: "蒸らしの揺らぎをもっと深く予測できる" },
].map((s) => Object.freeze({ ...s, kind: "skill", colors: Object.freeze(s.colors) }));

/** 能力ノード45（各色 2〜10段、コスト1） */
export const STAT_NODES = SECTORS.flatMap((stat) => Array.from({ length: 9 }, (_, i) => Object.freeze({
  id: `${PREFIX[stat]}${i + 1}`, kind: "stat", stat, step: i + 2, ring: ringOfStep(i + 2), cost: 1, colors: Object.freeze([stat]),
})));
export const NODES = Object.freeze([...STAT_NODES, ...SKILLS]);
export const NODE_BY_ID = Object.freeze(Object.fromEntries(NODES.map((n) => [n.id, n])));
export const BOARD_TOTAL_COST = NODES.reduce((n, node) => n + node.cost, 0);

export const nodeLabel = (node) => node.kind === "skill" ? node.name : `${STAT_JA[node.stat]} ${node.step}段`;

// ---------------------------------------------------------------- 規則（2.2: 輪・火種・段の順の3つだけ）

/** 開いている輪。第N章で第N輪（周回の引き継ぎは後続で growth.ringsOpen に持つ） */
export function ringsOpen(s = state) {
  return Math.min(5, Math.max(1, Number(s?.chapter) || 1, Number(s?.growth?.ringsOpen) || 1));
}

/** 解放済み（確定）＋仮置き。能力の段は「その色の解放数＋1」 */
export function stepOf(stat, unlocked) {
  let step = 1;
  for (const node of STAT_NODES) if (node.stat === stat && unlocked.has(node.id)) step = Math.max(step, node.step);
  return step;
}

/**
 * 払い方。合う限定の火種を先に使い、足りない分を万能で（1.9）。
 * 2色のスキルは、持っている数の多い色から使う。払えなければ null。
 */
export function paymentFor(node, hidane) {
  const pay = {};
  let left = node.cost;
  const colors = [...node.colors].sort((a, b) => (hidane[b] || 0) - (hidane[a] || 0));
  for (const c of colors) {
    const use = Math.min(left, hidane[c] || 0);
    if (use) { pay[c] = use; left -= use; }
  }
  const any = Math.min(left, hidane.any || 0);
  if (any) { pay.any = any; left -= any; }
  return left > 0 ? null : pay;
}
const spend = (hidane, pay) => { for (const [k, n] of Object.entries(pay)) hidane[k] -= n; };

/**
 * 仮置きを順に積み直す。払えなくなった・段の順が崩れた仮置きは外す。
 * 戻り値: { pending: [ids], unlocked: Set（確定＋仮置き）, hidane: 残り, pays: id -> 払い方 }
 */
export function replay(g, pendingIds, s = state) {
  const unlocked = new Set(g.nodes);
  const hidane = Object.fromEntries(HIDANE_KEYS.map((k) => [k, g.hidane[k] || 0]));
  const open = ringsOpen(s), kept = [], pays = {};
  for (const id of pendingIds) {
    const node = NODE_BY_ID[id];
    if (!node || unlocked.has(id) || node.ring > open) continue;
    if (node.kind === "stat" && stepOf(node.stat, unlocked) !== node.step - 1) continue;
    const pay = paymentFor(node, hidane);
    if (!pay) continue;
    spend(hidane, pay);
    unlocked.add(id);
    kept.push(id);
    pays[id] = pay;
  }
  return { pending: kept, unlocked, hidane, pays };
}

/** ノードの状態: unlocked | pending | available | short | waiting | locked（6.2） */
export function nodeStatus(node, g, view, s = state) {
  if (g.nodes.includes(node.id)) return "unlocked";
  if (view.pending.includes(node.id)) return "pending";
  if (node.ring > ringsOpen(s)) return "locked";
  if (node.kind === "stat" && stepOf(node.stat, view.unlocked) !== node.step - 1) return "waiting";
  return paymentFor(node, view.hidane) ? "available" : "short";
}

/** 仮置きを確定する。払った種類を記録し（組み直しで同じ種類に戻すため）、確定したノードを返す。 */
export function commitPending(pendingIds, s = state) {
  const g = ensureGrowth(s);
  const view = replay(g, pendingIds, s);
  for (const id of view.pending) {
    g.nodes.push(id);
    g.paid[id] = view.pays[id];
    spend(g.hidane, view.pays[id]);
  }
  return view.pending.map((id) => NODE_BY_ID[id]);
}

/** 輪ごとの埋まり（玉ではなく火種の数で数える） */
export function ringFill(g, ring) {
  let got = 0, total = 0;
  for (const node of NODES) if (node.ring === ring) { total += node.cost; if (g.nodes.includes(node.id)) got += node.cost; }
  return { got, total };
}

/** 今の盤で使い道のある火種があるか（未使用の印を出す条件。REPORT R6） */
export function hasUsableHidane(g, s = state) {
  const view = replay(g, [], s);
  return NODES.some((node) => nodeStatus(node, g, view, s) === "available");
}

export { STAT_KEYS };
