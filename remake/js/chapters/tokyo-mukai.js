// 東京の mukai のシフト（VOL09・2026-11-02 オーナー「ムカイでもバイトできるようにしたい」）。第3章の東京と第5章の東京で共通。
// tonari のシフト（daily/tonari.js の今日の注文）と同じく、その日の注文に合う配合を二つから選び、客の反応を見る。
// 一度シフトに入った次の日からは、知らない客に何を聞くか・あいまいな注文をどう読むかを選ぶ注文も混ざる（#2020 E）。
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
  // 任される注文（#2020 E）。前の日までに一度シフトに入ってから混ざる。知らない客の好みを聞き出す（labels は何を聞くか）、
  // あいまいな注文の解釈を選ぶ（labels はどう読むか）。mixes は聞いた／読んだ結果の一台。ask＝注文の後の問い。
  { id: "first_timer", entrusted: true, text: "シーシャ、初めてで。何を頼めばいいのか……", ask: "作る前に、一つ聞いてみる。",
    labels: ["普段よく飲むものを聞く", "今日ここへ来たわけを聞く"], mixes: [{ black_tea: 8, peach: 4 }, { absal_earlgrey: 8, lemon: 4 }] },
  { id: "anything_fine", entrusted: true, text: "何でもいいです。……おまかせで", ask: "作る前に、一つ聞いてみる。",
    labels: ["このあとの予定を聞く", "今日は何をしてきたか聞く"], mixes: [{ lime: 8, mint: 4 }, { chamomile: 8, honey: 4 }] },
  { id: "tokyo_like", entrusted: true, text: "東京っぽいのを。地方から出てきたばかりで", ask: "「東京っぽい」を、どう読む？",
    labels: ["この店のラテに寄せる", "来たばかりの気持ちに寄せる"], mixes: [{ caramel: 8, coffee: 4 }, { milk: 8, honey: 4 }] },
  { id: "celebration", entrusted: true, text: "今日はお祝いなんだ。それっぽいのを頼むよ", ask: "「お祝い」を、どう読む？",
    labels: ["華やかな香りで祝う", "長く話せる一台で祝う"], mixes: [{ cherry: 8, rose: 4 }, { biscuit: 8, black_tea: 4 }] },
].map(order => Object.freeze(order)));
export const MUKAI_REACTION_IDS = Object.freeze(MUKAI_ORDERS.flatMap(order => [0, 1].map(index => `mukai_shift_${order.id}_${index}`)));

/** 任される注文が混ざるか。前の日までに mukai のシフトに入っていれば（第5章は第3章の記録がそのまま効く）。
 * 今日のシフトを終えても今日の候補は変えない（同じ日は同じ注文）。 */
export const mukaiEntrusted = (value = state) => Number.isInteger(value?.flags?.[MUKAI_SHIFT_FLAG]) && value.flags[MUKAI_SHIFT_FLAG] < value.day;

/** その日の注文（日付と天気の種で決まる。同じ日は同じ注文）。 */
export function mukaiOrderOf(value = state) {
  const seed = (value.weatherSeed || 0) ^ Math.imul(value.day + value.chapter * 37 + 11, 0x45d9f3b);
  const orders = MUKAI_ORDERS.filter(order => !order.entrusted || mukaiEntrusted(value));
  return orders[((seed ^ (seed >>> 16)) >>> 0) % orders.length];
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
    body: `カウンター越しに注文を聞いた。<br>「${order.text}」 ${order.ask || "店の葉で一台を作る。"}`,
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
