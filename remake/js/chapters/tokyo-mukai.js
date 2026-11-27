// 東京の mukai のシフト（VOL09・Issue #4254）。第3章の東京と第5章の東京で共通。
// tonari と同じ店番ゲーム（フロア営業・daily/floor-venues.js の venue: "mukai"）を回し、
// 基本給（章ごとの共通テーブル）＋売上の歩合10%＋手当（魅力・調子・心得の盤 K27・呼ばれた日の上乗せ）を受け取る。
// 店の業務用の葉なので私物は減らず、お客さんへの提供は熟練度を稼がない（2026-10-26 の規則）。
// 旧・二択注文の定数（MUKAI_ORDERS 等）は既存参照との互換のため残す。
import { state, save } from "../core/state.js";
import { DB } from "../core/data.js";
import { earnStat } from "../core/stats.js";
import { readDialogues } from "../core/chapter-data.js";
import { floorVenueBasePay, floorVenuePayText } from "../daily/floor-venues.js";
import { runVenueFloorShift } from "../daily/floor-shift.js";
import { growthFloorPerks } from "../core/growth-effects.js";

export const MUKAI_PAY = 8000;
export const MUKAI_CALLED_BONUS = 5000;
export const mukaiShiftPay = (value = state, called = false) =>
  floorVenueBasePay("mukai", value?.chapter || 3) + (called ? MUKAI_CALLED_BONUS : 0);
// 歩合の率は心得の盤の「売り上手」（K28。SBD157）で上がる
export const mukaiShiftPayText = (value = state) => floorVenuePayText("mukai", value?.chapter || 3, growthFloorPerks(value)?.commission);
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
 * シフトを一回。導入（章の側の場面）→ mukai フロア営業（店番ゲーム）→ 日当・体力・能力。
 * 完走して true。中断・LOADは false（日当・体力・記録を残さない）。能力は日常ループの行動の中で効く。
 * @param opts.intro () => Promise<boolean> 導入の場面（章の側）
 * @param opts.called ムカイさんの LIME で呼ばれたシフト（日当に上乗せ）
 * @param opts.signal AbortSignal（中断用）
 */
export async function runMukaiShift({ intro, called = false, signal = null } = {}) {
  const owner = state;
  const outcome = await runVenueFloorShift({
    venue: "mukai",
    owner,
    called,
    intro,
    signal,
    staminaCost: -MUKAI_SHIFT_STAMINA,
  });
  if (!outcome || state !== owner) return false;
  earnStat("charm", 4);
  earnStat("technique", 2);
  state.flags[MUKAI_SHIFT_FLAG] = state.day;
  save();
  return true;
}
