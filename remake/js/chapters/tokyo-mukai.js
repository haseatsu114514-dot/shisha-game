// 東京の mukai のシフト（VOL09・2026-11-02 オーナー「ムカイでもバイトできるようにしたい」）。第3章の東京と第5章の東京で共通。
// tonari のシフト（daily/tonari.js の今日の注文）と同じく、その日の注文に合う配合を二つから選び、客の反応を見る。
// 店の業務用の葉なので私物は減らず、お客さんへの提供は熟練度を稼がない（2026-10-26 の規則）。
// 日当は従来の mukai の手伝いと同じ 6,000円。ムカイさんの LIME で呼ばれた日は上乗せ（VOL10。daily/phone.js の誘い）。
// 台詞は data/dialogue/mukai_shift.json（注文ごとの客の反応）。導入の一言は章の側（第3章は手伝いの場面、第5章は手伝いの小会話）。
import { state, save, timeOfDay } from "../core/state.js";
import { DB, bgUrl } from "../core/data.js";
import { modal, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { addMoney, addStamina, earnStat } from "../core/stats.js";
import { readDialogues } from "../core/chapter-data.js";

export const MUKAI_PAY = 6000;
export const MUKAI_CALLED_BONUS = 3000;
export const MUKAI_SHIFT_STAMINA = -14;
export const MUKAI_SHIFT_FLAG = "_mukai_shift_day"; // 最後に mukai のシフトに入った通算日（誘いの間隔に使う）

export const MUKAI_ORDERS = Object.freeze([
  { id: "after_coffee", text: "コーヒーのあとに、甘すぎないのを", labels: ["ヘーゼルナッツ＋コーヒー", "ブラックティー＋オレンジ"],
    mixes: [{ hazelnut: 8, coffee: 4 }, { black_tea: 8, orange: 4 }] },
  { id: "light_break", text: "仕事の合間に。軽くて、すっきりするやつ", labels: ["レモンティー＋ミント", "ジャスミン＋レモン"],
    mixes: [{ lemon_tea: 9, mint: 3 }, { jasmine: 8, lemon: 4 }] },
  { id: "sweet_latte", text: "甘いラテみたいなのが吸いたいな", labels: ["キャラメル＋バニラ", "カプチーノ＋チョコレート"],
    mixes: [{ caramel: 8, vanilla: 4 }, { cappuccino: 8, chocolate: 4 }] },
  { id: "slow_heavy", text: "重めでいい。ゆっくり吸いたい", labels: ["ダークチョコ＋シナモン", "ダブルアップル＋アニス少量"],
    mixes: [{ dark_chocolate: 8, cinnamon: 4 }, { double_apple: 10, anise: 2 }] },
].map(order => Object.freeze(order)));
export const MUKAI_REACTION_IDS = Object.freeze(MUKAI_ORDERS.flatMap(order => [0, 1].map(index => `mukai_shift_${order.id}_${index}`)));

/** その日の注文（日付と天気の種で決まる。同じ日は同じ注文）。 */
export function mukaiOrderOf(value = state) {
  const seed = (value.weatherSeed || 0) ^ Math.imul(value.day + value.chapter * 37 + 11, 0x45d9f3b);
  return MUKAI_ORDERS[((seed ^ (seed >>> 16)) >>> 0) % MUKAI_ORDERS.length];
}

export async function loadMukaiShift() {
  if (MUKAI_REACTION_IDS.every(id => DB.dialogues[id]?.lines?.length)) return;
  Object.assign(DB.dialogues, await readDialogues("mukai_shift", MUKAI_REACTION_IDS));
}

/**
 * シフトを一回。導入（章の側の場面）→ 今日の注文を二択で作る → 客の反応 → 日当・体力・能力。
 * 読み終えて true。中断・LOADは false（日当・体力・記録を残さない）。能力は日常ループの行動の中で効く。
 * @param opts.intro () => Promise<boolean> 導入の場面（章の側）
 * @param opts.called ムカイさんの LIME で呼ばれたシフト（日当に上乗せ）
 */
export async function runMukaiShift({ intro, called = false } = {}) {
  const owner = state;
  await loadMukaiShift();
  if (state !== owner || !await intro()) return false;
  const order = mukaiOrderOf(owner);
  const index = await modal({ title: "今日の注文", className: "mukai-order",
    body: `カウンター越しに注文を聞いた。<br>「${order.text}」 店の葉で一台を作る。`,
    options: order.labels.map((label, i) => ({ label, value: i, test: `mukai-order-${i}` })) });
  if (state !== owner || !Number.isInteger(index) || !order.mixes[index]) return false;
  const result = await play(DB.dialogues[`mukai_shift_${order.id}_${index}`], { bg: bgUrl("bg_mukai_shop", timeOfDay()) });
  if (state !== owner || !result || result.cancelled) return false;
  const pay = MUKAI_PAY + (called ? MUKAI_CALLED_BONUS : 0);
  addMoney(pay);
  addStamina(MUKAI_SHIFT_STAMINA);
  earnStat("charm", 4);
  earnStat("technique", 2);
  state.flags[MUKAI_SHIFT_FLAG] = state.day;
  save();
  toast(`mukaiの日当 +${pay.toLocaleString("ja-JP")}円${called ? "（呼ばれた日の上乗せ込み）" : ""}`, { kind: "good" });
  return true;
}
